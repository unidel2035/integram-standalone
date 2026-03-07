/**
 * fstAgentsService.js — загрузка конфигурации агентов ИК из Integram FST
 *
 * Таблица 3674 "Агенты ИК" (ai2o.ru/fst):
 *   3676 = Код агента (SHORT)         — tech, finance, sovereignty, risk, portfolio, devil
 *   3678 = Специализация (SHORT)
 *   3680 = Системный промпт (LONG)
 *   3682 = Байас (SHORT)              — neutral / skeptic / optimist / pessimist
 *   3684 = Иконка (SHORT)
 *   3686 = Цвет (SHORT)
 *   3688 = Аватар (SHORT)
 *   3690 = Вес голоса (NUMBER)
 *   3692 = Вес TRL (NUMBER)
 *   3694 = Вес MRL (NUMBER)
 *   3696 = Вес суверенности (NUMBER)
 *   3698 = Вес рынка (NUMBER)
 *   3700 = Вес финансов (NUMBER)
 *   3702 = Вес риска (NUMBER)
 *   3704 = Вес команды (NUMBER)
 *   3706 = Фразы размышлений (LONG)   — строки через \n
 *   3820 = Актор СОД (REF → 2406)     — онтологический двойник в событийной модели
 */

import { authenticate } from './fstApi.js'

// Пустая строка → использует Vite proxy /fst → https://ai2o.ru/fst
const FST_SERVER = ''
const FST_DB     = import.meta.env.VITE_FST_DB     || 'fst-api'
const TYPE_AGENTS = 3674

// Кеш: загружается один раз на сессию браузера
let _agentsCache = null

async function fstGet(path) {
  const { token } = await authenticate()
  const res = await fetch(`${FST_SERVER}/${FST_DB}/${path}`, {
    headers: { 'X-Authorization': token },
  })
  return res.json()
}

// ── Перевод объекта из Integram в формат агента ИК ─────────────────────────

function parseAgent(obj, reqs) {
  const r   = reqs[obj.id] || {}
  const id  = r['3676'] || obj.id
  const num = k => parseFloat(r[k] || 0)

  const scoringWeights = {
    trl:         num('3692'),
    mrl:         num('3694'),
    sovereignty: num('3696'),
    market:      num('3698'),
    finance:     num('3700'),
    risk:        num('3702'),
    team:        num('3704'),
  }

  // Фокус — топ-2 измерения по весу
  const focus = Object.entries(scoringWeights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => k)

  // Фразы размышлений — строки через \n
  const phrasesRaw  = r['3706'] || ''
  const thinkingPhrases = phrasesRaw
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  return {
    // Поля используемые движком
    id,
    dbId:         obj.id,
    name:         obj.val,
    shortName:    obj.val.split(' ')[0],
    avatar:       r['3688'] || '🤖',
    color:        r['3686'] || '#90a4ae',
    bias:         r['3682'] || 'neutral',
    weight:       num('3690') || 0.16,
    focus,
    description:  r['3678'] || '',
    scoringWeights,
    thinkingPhrases: thinkingPhrases.length ? thinkingPhrases : ['Анализирую данные...'],
    // Системный промпт для AI
    systemPrompt: r['3680'] || null,
    // Онтологический двойник в СОД (таблица 2406 "СОД Акторы")
    sodActorId:   r['ref_3820'] ? r['ref_3820'].split(':')[1] : null,
  }
}

// ── Публичный API ───────────────────────────────────────────────────────────

/**
 * Загружает агентов из Integram FST.
 * Первый вызов делает HTTP-запрос, последующие возвращают кеш.
 * При ошибке возвращает null — вызывающий код использует хардкод-фолбек.
 */
export async function loadAgents() {
  if (_agentsCache) return _agentsCache
  try {
    const data    = await fstGet(`_m_list/${TYPE_AGENTS}?JSON_KV`)
    const objects = data.object || []
    const reqs    = data.reqs   || {}
    if (!objects.length) return null

    const agents = objects
      .map(obj => parseAgent(obj, reqs))
      .filter(a => a.id)
      .sort((a, b) => b.weight - a.weight)  // по весу голоса

    _agentsCache = agents
    return agents
  } catch (e) {
    console.warn('[fstAgentsService] не удалось загрузить агентов из базы:', e.message)
    return null
  }
}

/**
 * Словарь systemPrompt по id агента.
 * Используется в fstCommitteeAI.js вместо хардкод-объекта.
 */
export async function loadAgentPrompts() {
  const agents = await loadAgents()
  if (!agents) return null
  return Object.fromEntries(
    agents
      .filter(a => a.systemPrompt)
      .map(a => [a.id, a.systemPrompt])
  )
}

/** Сбросить кеш (например при смене аккаунта) */
export function clearAgentsCache() {
  _agentsCache = null
}
