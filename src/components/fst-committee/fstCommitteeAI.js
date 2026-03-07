/**
 * fstCommitteeAI.js — LLM-генерация аргументов для инвесткомитета ФСТ НТИ
 *
 * Каждый агент получает:
 *   1. Системный промпт с ролью/специализацией/байасом
 *   2. Контекст проекта (TRL, IRR, суверенность, рынок...)
 *   3. Историю последних N аргументов из дебатов
 *   4. (для COUNTER) Точный аргумент, на который нужно ответить
 *
 * Возвращает JSON-объект аргумента; при ошибке — null (движок использует шаблон).
 */

import { getDefaultToken, getCurrentUserId } from '@/services/aiTokenService.js'

const API_BASE = ''  // всегда относительный URL → Vite proxy → порт 8082
const COMMITTEE_MODEL = 'deepseek-chat'       // надёжная модель, поддерживает несколько запросов
const CONTEXT_ARGS = 6                        // аргументов в контексте
const TIMEOUT_MS   = 25_000                   // таймаут LLM-вызова

// ── KAG: поиск прошлых решений ИК ─────────────────────────────────────────────

// Кеш KAG-контекста по проекту (обнуляется при новой сессии)
const _kagCache = new Map()

export async function fetchKagContext(project) {
  const key = project.title || project.company || 'unknown'
  if (_kagCache.has(key)) return _kagCache.get(key)
  try {
    const res = await fetch(`${API_BASE}/api/kag/search`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  AbortSignal.timeout(5000),
      body: JSON.stringify({
        query:       `инвесткомитет ФСТ ${project.subFund || ''} ${project.trl ? 'TRL ' + project.trl : ''}`,
        limit:       4,
        entityTypes: ['CommitteeSession'],
        minScore:    0.25,
      }),
    })
    if (!res.ok) { _kagCache.set(key, ''); return '' }
    const data = await res.json()
    const hits = (data.results || [])
      .filter(r => r.entity?.observations?.length)
      .slice(0, 3)
    if (!hits.length) { _kagCache.set(key, ''); return '' }
    const text = hits
      .map(r => r.entity.observations.slice(0, 4).join(' | '))
      .join('\n')
    const result = `Прошлые решения ИК по схожим проектам:\n${text}`
    _kagCache.set(key, result)
    return result
  } catch {
    _kagCache.set(key, '')
    return ''
  }
}

export function clearKagCache() { _kagCache.clear() }

// ── KAG: сохранение сессии ────────────────────────────────────────────────────

export async function saveSessionToKag(session) {
  const { exportToKagEntities } = await import('./fstCommitteeOntology.js')
  const entities = exportToKagEntities(session)
  if (!entities.length) return { saved: 0 }
  try {
    const res = await fetch(`${API_BASE}/api/mcp/kag/execute`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: 'kag_create_entities', arguments: { entities } }),
    })
    if (!res.ok) return { saved: 0, error: res.statusText }
    const data = await res.json()
    const count = data.result?.content?.[0]?.text
      ? JSON.parse(data.result.content[0].text)?.count || entities.length
      : entities.length
    return { saved: count }
  } catch (e) {
    return { saved: 0, error: e.message }
  }
}

// Кеш токена на время сессии
let _cachedToken = null
async function getToken() {
  if (_cachedToken) return _cachedToken
  try {
    const userId = getCurrentUserId()
    if (!userId) return null
    const result = await getDefaultToken(userId)
    _cachedToken = result?.token?.id || result?.id || null
    return _cachedToken
  } catch {
    return null
  }
}

function getLocalAuthToken() {
  // FST app stores token as 'token', main dronedoc app as 'auth_token'
  return localStorage.getItem('auth_token') ||
         localStorage.getItem('token') ||
         sessionStorage.getItem('auth_token') || ''
}

// ── Системные промпты агентов ─────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPTS = {
  tech: `Ты Технический аналитик инвесткомитета ФСТ НТИ (Фонд Суверенных Технологий НТИ).

Специализация: уровни TRL/MRL (NASA-шкала), техническая готовность производства, патентная чистота, цепочки поставок, критические технологические зависимости.

Правила:
— Оценивай ТОЛЬКО технические аспекты, игнорируй финансы и рынок
— Используй конкретные числа из данных проекта (TRL=X, MRL=Y)
— Критикуй низкий TRL(<6), отсутствие прототипа, незащищённые ИС, зависимость от импортных компонентов
— Одобряй TRL≥7, наличие производственного партнёра, патентный портфель
— Отвечай кратко (2-3 предложения), конкретно, без воды`,

  finance: `Ты Финансовый аналитик инвесткомитета ФСТ НТИ.

Специализация: IRR/NPV, unit economics, burn rate, runway, структура раунда, оценка (valuation), cap table.

Правила:
— Оценивай ТОЛЬКО финансовые показатели
— Будь скептичен: проверяй реалистичность прогнозов (TAM занижен или завышен?)
— Критикуй: IRR>50% без обоснования, runway<18 мес, слабая unit economics, размытый путь к прибыли
— Одобряй: IRR 25-40%, чёткая монетизация, позитивная gross margin, разумная оценка
— Ссылайся на конкретные числа из заявки`,

  sovereignty: `Ты Эксперт суверенности инвесткомитета ФСТ НТИ.

Специализация: 9-мерная матрица суверенности (компоненты, ПО, ИС, данные, производство, кадры, сертификация, стандарты, экспортный контроль). Импортозамещение критических компонентов.

Правила:
— Оценивай ТОЛЬКО суверенность и технологическую независимость
— Любая зависимость от недружественных стран — красный флаг
— Критикуй: иностранные чипы/двигатели/ПО без плана замены, отсутствие локализации, зарубежные облака для критических данных
— Одобряй: отечественные компоненты >70%, российская элементная база, ГЛОНАСС вместо GPS
— Называй конкретные риски (Qualcomm, NVIDIA, AWS и т.п.)`,

  risk: `Ты Риск-менеджер инвесткомитета ФСТ НТИ.

Специализация: реестр рисков по PMBOK — технические, рыночные, регуляторные (авиация/БПЛА в России), операционные, командные, форс-мажор.

Правила:
— Оценивай ВСЕ категории рисков, будь пессимистом
— Критикуй: отсутствие сертификации ФАВТ/ФСБ/Росавиации, ключевой-человек риск, отсутствие IP-защиты, концентрация клиентов
— Одобряй: диверсифицированный пайплайн клиентов, опытная команда с трек-рекордом, страхование ключевых рисков
— Всегда предлагай конкретные митигации рисков`,

  portfolio: `Ты Стратег портфеля инвесткомитета ФСТ НТИ.

Специализация: портфельная теория, синергии между компаниями БАС/РОБО/МЭ, диверсификация рынков НТИ (Аэронет, Маринет, Автонет, Нейронет), стратегическая позиция фонда.

Правила:
— Оценивай вписанность в портфель ФСТ, не финансы сами по себе
— Критикуй: дублирование с существующими портфельными компаниями, отсутствие синергий, чрезмерную концентрацию в одном субфонде
— Одобряй: уникальная ниша, кросс-субфондовые синергии, соответствие стратегии НТИ 2030
— Думай о портфеле как о целом`,

  devil: `Ты Критический аналитик инвесткомитета ФСТ НТИ.

Специализация: оспаривание допущений, поиск системных рисков и скрытых проблем, альтернативные интерпретации данных.

Правила:
— Твоя роль — задавать неудобные вопросы, которые другие не задают
— Всегда находи слабое место: в прогнозах, в команде, в технологии, в рынке
— Критикуй оптимистичные TAM/SAM, оспаривай уникальность, ищи конкурентов которых "нет"
— НИКОГДА не давай безоговорочного одобрения — всегда есть "но"
— Оспаривай аргументы других агентов, даже если они кажутся разумными`,
}

// ── Форматирование проекта для промпта ───────────────────────────────────────

function formatProject(project) {
  return `ПРОЕКТ: ${project.title || project.name || project.company}
Субфонд: ${project.subFund || '—'}
Описание: ${(project.description || '').slice(0, 300)}
Запрашиваемая сумма: ${project.requestedAmount ? (project.requestedAmount / 1e6).toFixed(1) + ' млн ₽' : '—'}
TRL: ${project.trl || '—'} / MRL: ${project.mrl || '—'}
Суверенность: ${project.sovereigntyScore || '—'}/9
Рынок (TAM): ${project.marketSize ? (project.marketSize / 1e9).toFixed(1) + ' млрд ₽' : '—'}
IRR прогноз: ${project.projectedIRR ? (project.projectedIRR * 100).toFixed(0) + '%' : '—'}
Выручка (план): ${project.revenueYear1 ? project.revenueYear1 + ' ₽' : '—'}
Команда: ${project.teamStrength ? Math.round(project.teamStrength * 10) + '/10' : '—'}
Стадия: ${project.stage || 'Seed'}`
}

function formatDebateHistory(args, agentNames) {
  if (!args || args.length === 0) return 'Дебаты только начались, аргументов пока нет.'
  return args
    .slice(-CONTEXT_ARGS)
    .map(a => `[${agentNames[a.agentId] || a.agentId}]: ${a.text}`)
    .join('\n\n')
}

const AGENT_SHORT_NAMES = {
  tech: 'Техн.аналитик', finance: 'Фин.аналитик', sovereignty: 'Эксперт суверенности',
  risk: 'Риск-менеджер', portfolio: 'Стратег', devil: 'Критик',
}

// Случайные аспекты фокуса — делают каждую дискуссию уникальной
const AGENT_FOCUS_VARIANTS = {
  tech: [
    'особое внимание — производственной масштабируемости',
    'особое внимание — патентной защите и IP',
    'особое внимание — цепочке поставок компонентов',
    'особое внимание — независимым испытаниям и сертификации',
    'особое внимание — критическим технологическим зависимостям',
  ],
  finance: [
    'особое внимание — unit economics и CAC/LTV',
    'особое внимание — runway и burn rate',
    'особое внимание — обоснованности TAM и прогноза доли рынка',
    'особое внимание — структуре раунда и cap table',
    'особое внимание — сценарному анализу (базовый vs пессимистичный)',
  ],
  sovereignty: [
    'особое внимание — конкретным критическим импортным компонентам',
    'особое внимание — программному обеспечению и облачным зависимостям',
    'особое внимание — кадровому суверенитету и утечке технологий',
    'особое внимание — дорожной карте импортозамещения',
    'особое внимание — рискам экспортного контроля',
  ],
  risk: [
    'особое внимание — регуляторным рискам (Росавиация, ФСБ, ФАВТ)',
    'особое внимание — ключевому-человек риску и команде',
    'особое внимание — концентрации клиентской базы',
    'особое внимание — рискам масштабирования операций',
    'особое внимание — киберрискам и защите данных',
  ],
  portfolio: [
    'особое внимание — синергиям с конкретными портфельными компаниями',
    'особое внимание — уникальности ниши и дифференциации',
    'особое внимание — соответствию стратегии НТИ 2030',
    'особое внимание — кросс-субфондовым возможностям',
    'особое внимание — конкурентной разведке внутри портфеля',
  ],
  devil: [
    'особое внимание — слабым местам в команде основателей',
    'особое внимание — скрытым конкурентам которых "нет"',
    'особое внимание — нереалистичным допущениям в прогнозах',
    'особое внимание — системным рискам всего рынка',
    'особое внимание — тому, чего нет в заявке, но должно быть',
  ],
}

function pickFocus(agentId) {
  const variants = AGENT_FOCUS_VARIANTS[agentId] || []
  if (!variants.length) return ''
  return variants[Math.floor(Math.random() * variants.length)]
}

// ── Промпты по типам аргументов ───────────────────────────────────────────────

function buildUserPrompt(agent, type, project, prevArgs, targetArg, kagContext = '') {
  const projectInfo = formatProject(project)
  const history = formatDebateHistory(prevArgs, AGENT_SHORT_NAMES)
  const focus = pickFocus(agent.id)

  const responseFormat = `
Ответь СТРОГО только JSON (без markdown, без пояснений):
{"text": "твой аргумент", "dimension": "trl|mrl|sovereignty|market|finance|risk|team", "confidence": 0.0-1.0, "stance": "APPROVE|DEFER|REJECT"}`

  if (type === 'OPENING') {
    return `${projectInfo}
${kagContext ? '\n' + kagContext + '\n' : ''}
Фаза: ПЕРВИЧНЫЕ ПОЗИЦИИ
Твоя задача: представь свою первичную позицию по проекту (2-3 конкретных предложения).
Используй данные из заявки. Назови 1 сильную сторону и 1 ключевой риск/вопрос.
Сегодня: ${focus}.
${responseFormat}`
  }

  if (type === 'CHALLENGE') {
    return `${projectInfo}

Фаза: ПЕРЕКРЁСТНЫЕ ДЕБАТЫ
История дебатов:
${history}

Твоя задача: выдвини ВЫЗОВ — атакуй конкретное уязвимое место проекта (1-2 предложения).
Будь конкретен, используй числа. Можешь ответить на позицию другого агента.
Сегодня: ${focus}.
${responseFormat}`
  }

  if (type === 'COUNTER' && targetArg) {
    const targetAgentName = AGENT_SHORT_NAMES[targetArg.agentId] || targetArg.agentId
    return `${projectInfo}

Фаза: ПЕРЕКРЁСТНЫЕ ДЕБАТЫ
Аргумент, на который тебе нужно ответить:
[${targetAgentName}]: "${targetArg.text}"

История контекста:
${history}

Твоя задача: дай ПРЯМОЙ КОНТРАРГУМЕНТ (1-2 предложения).
Адресуй конкретно то, что сказал ${targetAgentName}. Не повторяй его слова.
${responseFormat}`
  }

  if (type === 'SYNTHESIS' || type === 'CLOSING' || type === 'SUMMARY') {
    return `${projectInfo}

Фаза: ФИНАЛЬНЫЕ ПОЗИЦИИ
Все аргументы из дебатов:
${history}

Твоя задача: дай ИТОГОВУЮ ПОЗИЦИЮ (2-3 предложения).
Учти аргументы других агентов. Вынеси окончательный вердикт с обоснованием.
${responseFormat}`
  }

  return `${projectInfo}\n\nИстория: ${history}\n\nДай аргумент по проекту (2 предложения).${responseFormat}`
}

// ── Парсинг ответа LLM ────────────────────────────────────────────────────────

function parseAgentResponse(rawText) {
  if (!rawText) return null

  const VALID_DIMS = ['trl','mrl','sovereignty','market','finance','risk','team']
  const VALID_STANCES = ['APPROVE','DEFER','REJECT']

  // 1. Попробуем найти JSON-блок в ответе
  const jsonMatch = rawText.match(/\{[\s\S]*?\}(?=\s*(?:```|$|\n\n))/) || rawText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.text && typeof parsed.text === 'string') {
        return {
          text:       parsed.text.trim(),
          dimension:  VALID_DIMS.includes(parsed.dimension) ? parsed.dimension : null,
          confidence: typeof parsed.confidence === 'number'
                        ? Math.max(0, Math.min(1, parsed.confidence))
                        : 0.7,
          stance:     VALID_STANCES.includes(parsed.stance) ? parsed.stance : null,
        }
      }
    } catch { /* fall through to plain-text fallback */ }
  }

  // 2. Модель ответила не JSON — используем сырой текст как аргумент
  const text = rawText
    .replace(/```[\s\S]*?```/g, '')  // убрать markdown code blocks
    .replace(/^(json|JSON)\s*/i, '')  // убрать случайное слово json
    .trim()

  if (text.length < 10) return null  // слишком короткий — скорее всего мусор

  return {
    text:       text,
    dimension:  null,
    confidence: 0.7,
    stance:     null,
  }
}

// ── Основная функция генерации ────────────────────────────────────────────────

export async function generateArgumentAI(agent, type, project, prevArgs = [], targetArgId = null, kagContext = '') {
  const targetArg = targetArgId ? prevArgs.find(a => a.id === targetArgId) : null
  const systemPrompt = AGENT_SYSTEM_PROMPTS[agent.id]

  if (!systemPrompt) return null

  const userPrompt = buildUserPrompt(agent, type, project, prevArgs, targetArg, kagContext)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  // Получаем токен авторизации
  const ddToken   = await getToken()
  const authToken = ddToken || getLocalAuthToken()

  try {
    const response = await fetch(`${API_BASE}/api/ai-tokens/chat`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
      signal:  controller.signal,
      body: JSON.stringify({
        modelId:      COMMITTEE_MODEL,
        prompt:       userPrompt,
        systemPrompt: systemPrompt,
        application:  'FstCommittee',
        maxTokens:    300,
      }),
    })

    clearTimeout(timeoutId)

    if (!response.ok) return null

    const data = await response.json()
    const rawText = data.response || data.text || data.content || data.message || ''
    const parsed = parseAgentResponse(rawText)

    if (!parsed) return null

    return {
      id:          `arg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      agentId:     agent.id,
      type,
      text:        parsed.text,
      targetArgId: targetArgId || null,
      dimension:   parsed.dimension || agent.focus?.[0] || 'general',
      timestamp:   Date.now(),
      strength:    parsed.confidence,
      confidence:  parsed.confidence,
      stance:      parsed.stance,
      aiGenerated: true,
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name !== 'AbortError') console.warn('[FstCommitteeAI] error:', err.message)
    return null
  }
}

// ── Параллельная генерация (для PRIMARY_POSITIONS) ────────────────────────────

export async function generateAllOpenings(agents, project) {
  return Promise.all(
    agents.map(agent => generateArgumentAI(agent, 'OPENING', project, [], null))
  )
}


// ── Сохранение сессии в СОД (Предметные события) ─────────────────────────────

const FST_SERVER_AI   = ''
const FST_DB_AI       = import.meta.env?.VITE_FST_DB     || 'fst-api'
const TYPE_SOD_EVENTS = 2451   // СОД Предметные события
const REQ_SOD_DATE    = 2458   // Дата
const REQ_SOD_EFFECT  = 2460   // Эффект
const REQ_SOD_SOURCE  = 2461   // Источник
const REQ_SOD_ACTORS  = 3007   // Акторы (MULTI ref → 2406)
const ACTOR_IK_MAIN   = 2527   // "ИИ-инвесткомитет" (общий актор ИК)

/**
 * Сохраняет результат заседания ИК как Предметное событие в СОД.
 * Каждый участвовавший агент → его sodActorId привязывается к событию.
 * Замыкает цикл: Агент ИК (3674) → СОД Актор (2406) → Предметное событие (2451).
 */
export async function saveSessionToIntegram(session) {
  try {
    const { authenticate } = await import('@/services/fstApi.js')
    const { loadAgents }   = await import('@/services/fstAgentsService.js')

    const { token, xsrf } = await authenticate()
    const agents = await loadAgents()

    // Словарь sodActorId по id агента
    const actorMap = {}
    if (agents) {
      for (const a of agents) {
        if (a.sodActorId) actorMap[a.id] = a.sodActorId
      }
    }

    const decision = session.decision || {}
    const project  = session.project  || {}
    const rec      = decision.recommendation || 'DEFER'
    const score    = decision.aggregatedScore != null ? Number(decision.aggregatedScore).toFixed(2) : '—'
    const now      = new Date().toISOString()
    const title    = `ИК ФСТ: ${project.title || session.projectId} — ${new Date().toLocaleDateString('ru')}`

    const effect = [
      `Решение: ${rec}`,
      `Балл: ${score}`,
      decision.conditions?.length ? `Условия: ${decision.conditions.slice(0, 2).join('; ')}` : '',
      decision.risks?.length      ? `Риски: ${decision.risks.slice(0, 2).join('; ')}`         : '',
    ].filter(Boolean).join('\n')

    // Собираем ID акторов: главный "ИИ-инвесткомитет" + конкретные агенты
    const participantIds = [String(ACTOR_IK_MAIN)]
    const participantAgentIds = [...new Set(
      (session.arguments || []).map(a => a.agentId).filter(Boolean)
    )]
    for (const agId of participantAgentIds) {
      if (actorMap[agId]) participantIds.push(String(actorMap[agId]))
    }

    // Создаём Предметное событие
    const body = new URLSearchParams()
    body.set(`t${TYPE_SOD_EVENTS}`, title)
    body.set(`t${REQ_SOD_DATE}`,    now)
    body.set(`t${REQ_SOD_EFFECT}`,  effect)
    body.set(`t${REQ_SOD_SOURCE}`,  'ИИ-инвесткомитет FST')
    for (const actorId of participantIds) {
      body.append(`t${REQ_SOD_ACTORS}`, actorId)
    }
    body.set('_xsrf', xsrf)

    const res = await fetch(`${FST_SERVER_AI}/${FST_DB_AI}/_m_new/${TYPE_SOD_EVENTS}?JSON_KV`, {
      method:  'POST',
      headers: { 'X-Authorization': token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = await res.json()
    if (data.error) return { error: data.error }

    const eventId = data.obj || data.id
    return { eventId, actorCount: participantIds.length }
  } catch (e) {
    console.warn('[saveSessionToIntegram]', e.message)
    return { error: e.message }
  }
}
