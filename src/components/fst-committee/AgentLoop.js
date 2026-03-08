/**
 * AgentLoop.js — Multi-agent orchestrator: настоящий agentic loop
 *
 * Каждый агент — отдельная "сессия" с инструментами.
 * Loop: think → tool_call? → observe → [repeat] → publish
 *
 * Работает через тот же /api/ai-tokens/chat endpoint что и остальные вызовы.
 * Модель выбирается через resolveModel() (существующий оркестратор).
 *
 * Протокол (text-based tool use — работает с любой моделью):
 *   LLM отвечает JSON:
 *     {"action": "tool_call", "tool": "...", "args": {...}, "reasoning": "..."}
 *     ИЛИ
 *     {"action": "publish", "text": "...", "dimension": "...", "confidence": 0.0-1.0, "stance": "APPROVE|DEFER|REJECT"}
 */

import { resolveModel } from './fstCommitteeModelOrchestrator.js'
import { getCurrentUserId } from '@/services/aiTokenService.js'
import {
  getToolsForAgent, formatToolsForPrompt,
  execCalcIrr, execCalcNpv, execMonteCarlo, execPowerScore, execBayesian,
} from './AgentToolRegistry.js'

const API_BASE      = ''
const MAX_ITER      = 5           // Максимум tool_call итераций до публикации
const TIMEOUT_MS    = 45_000
const MAX_PARALLEL  = 4           // Максимум агентов одновременно (concurrency limit)
const MAX_TOKENS    = 600         // Достаточно для JSON + аргумент 3-4 предложения
const TEMPERATURE   = 0.75        // Вариативность ответов

// ── Auth helpers — точная копия паттерна из fstCommitteeAI.js ────────────────

let _loopToken = null
async function getLoopToken() {
  if (_loopToken) return _loopToken
  try {
    const userId = getCurrentUserId()
    if (!userId) return null
    const res = await fetch(`${API_BASE}/api/ai-tokens/default-token/${userId}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const d = await res.json()
    _loopToken = d?.data?.token?.id || d?.data?.id || null
    return _loopToken
  } catch { return null }
}
function getLocalAuth() {
  // Перебираем все возможные ключи Integram/ddadmin токенов
  return localStorage.getItem('auth_token') ||
         localStorage.getItem('token') ||
         localStorage.getItem('ddadmin_token') ||
         localStorage.getItem('fst_token') ||
         localStorage.getItem('X-Authorization') ||
         sessionStorage.getItem('auth_token') ||
         sessionStorage.getItem('token') ||
         ''
}
export function resetLoopTokenCache() { _loopToken = null }

// ── Системные промпты агентов (источник правды — AgentLoop знает все роли) ───

const LOOP_SYSTEM_PROMPTS = {
  tech: `Ты Технический аналитик инвесткомитета ФСТ НТИ.
Специализация: TRL/MRL (NASA-шкала), техническая готовность, патентная чистота, цепочки поставок.
Порядок работы: query_data(trl, mrl) → web_search("технология конкуренты аналоги") → memory_search(технология) → read_room → publish.
Если нужен нестандартный расчёт — exec_code.
Критикуй TRL<6. Одобряй TRL≥7 + производственный партнёр + патенты.`,

  finance: `Ты Финансовый аналитик инвесткомитета ФСТ НТИ.
Специализация: IRR/NPV, unit economics, burn rate, cap table.
Порядок: query_data(projectedIRR, requestedAmount) → calc_irr → calc_npv → read_room → publish.
Для нестандартных моделей используй exec_code. web_search для рыночных мультипликаторов аналогов.
Будь скептичен к IRR>50% без обоснования. Runway <18 мес — красный флаг.`,

  sovereignty: `Ты Эксперт суверенности инвесткомитета ФСТ НТИ.
Специализация: 9-мерная матрица суверенности. Импортозамещение.
Порядок: query_data(sovereigntyScore, localizationRatio) → web_search("импортозамещение компонент") → memory_search(суверенность) → read_room → publish.
Любая зависимость от недружественных стран — красный флаг.`,

  risk: `Ты Риск-менеджер инвесткомитета ФСТ НТИ.
Специализация: реестр рисков PMBOK — технические, рыночные, регуляторные, операционные.
Порядок: query_data(risks) → search_precedents → web_search("регуляторика риски отрасль") → read_room → publish.
exec_code для количественной оценки рисков. Критикуй отсутствие сертификации.`,

  portfolio: `Ты Стратег портфеля инвесткомитета ФСТ НТИ.
Специализация: портфельная теория, синергии между субфондами, стратегия НТИ 2030.
Порядок: memory_search(портфель компании) → search_precedents → query_data → read_room → publish.
web_search для оценки конкурентной позиции на рынке.`,

  devil: `Ты Критический аналитик инвесткомитета ФСТ НТИ.
Твоя роль — находить слабые места, оспаривать допущения.
Порядок: read_room → query_data → web_search("провалы аналоги риски") → publish.
exec_code чтобы проверить расчёты коллег. Никогда не давай безоговорочного одобрения.`,

  monte_carlo: `Ты Квантовый риск-аналитик инвесткомитета ФСТ НТИ.
ОБЯЗАТЕЛЬНО: calc_monte_carlo с базовым IRR и волатильностью 0.35.
Потом read_room. exec_code для дополнительных симуляций. Говори числами: P(успех), медианный MOIC, VaR(95%).`,

  real_options: `Ты Аналитик реальных опционов инвесткомитета ФСТ НТИ.
Специализация: ROV, биномиальное дерево, staged financing.
Порядок: calc_npv → calc_irr → exec_code(биномиальная модель) → read_room → publish.
web_search для волатильности аналогов.`,

  market_timing: `Ты Аналитик рыночного цикла инвесткомитета ФСТ НТИ.
Специализация: шкала Маркса, "Почему именно сейчас?", конкурентные окна.
Порядок: web_search("рынок тренды конкуренты 2025") → memory_search(рынок) → search_precedents → read_room → publish.
Используй реальные данные из поиска.`,

  bayesian: `Ты Байесовский аналитик инвесткомитета ФСТ НТИ.
ОБЯЗАТЕЛЬНО: calc_bayesian с prior=0.08 (базовая ставка БПЛА-стартапов).
Порядок: memory_search(прецеденты успех провал) → web_search(base rate аналоги) → calc_bayesian → read_room → publish.
Всегда начинай с Reference Class.`,

  power_score: `Ты Аналитик стратегического моата инвесткомитета ФСТ НТИ.
ОБЯЗАТЕЛЬНО: calc_power_score по 7 Powers.
Порядок: web_search("конкуренты барьеры входа") → memory_search(компания технология) → calc_power_score → read_room → publish.
Если Power Score < 25 — не венчурная инвестиция.`,

  game_theory: `Ты Теоретик игр инвесткомитета ФСТ НТИ.
Специализация: Nash Equilibrium, Shapley Value, механизмы стимулов.
Порядок: read_room → exec_code(Shapley расчёт) → query_data → publish.
exec_code для точных математических расчётов теории игр.`,
}

// ── Форматирование проекта ────────────────────────────────────────────────────

function formatProjectBrief(project) {
  return [
    `Проект: ${project.title || project.company || 'Без названия'}`,
    `Субфонд: ${project.subFund || '—'}`,
    `TRL: ${project.trl || '—'} / MRL: ${project.mrl || '—'}`,
    `Суверенность: ${project.sovereigntyScore || '—'}/9`,
    `IRR прогноз: ${project.projectedIRR ? (project.projectedIRR * 100).toFixed(0) + '%' : '—'}`,
    `Рынок (TAM): ${project.marketSize ? (project.marketSize / 1e9).toFixed(1) + ' млрд ₽' : '—'}`,
    `Запрос: ${project.askRub ? (project.askRub / 1e6).toFixed(0) + ' млн ₽' : project.requestedAmount ? (project.requestedAmount / 1e6).toFixed(1) + ' млн ₽' : '—'}`,
    `Команда: ${project.teamStrength ? Math.round(project.teamStrength * 10) + '/10' : '—'}`,
  ].join('\n')
}

// ── Исполнение инструментов ───────────────────────────────────────────────────

async function executeTool(toolName, args = {}, context) {
  const { room, project, session } = context
  const t0 = Date.now()

  let result
  try {
    switch (toolName) {

      case 'read_room':
        result = { messages: room.format(args.n || 8) }
        break

      case 'query_data': {
        const out = {}
        for (const f of (args.fields || [])) {
          out[f] = project[f] ?? null
        }
        result = out
        break
      }

      case 'calc_irr': {
        const cf = args.cashflows || []
        const ic = args.initial_investment || 1
        result = execCalcIrr(cf, ic)
        break
      }

      case 'calc_npv': {
        const cf   = args.cashflows || []
        const ic   = args.initial_investment || 1
        const wacc = args.wacc || 0.18
        result = execCalcNpv(cf, ic, wacc)
        break
      }

      case 'calc_monte_carlo': {
        const baseIrr   = args.base_irr   || project.projectedIRR || 0.30
        const vol       = args.volatility  || 0.35
        result = execMonteCarlo(baseIrr, vol, 1000)
        break
      }

      case 'calc_power_score':
        result = execPowerScore(args)
        break

      case 'calc_bayesian': {
        const prior = args.prior || 0.08
        result = execBayesian(prior, args.evidence_up || [], args.evidence_down || [])
        break
      }

      case 'search_precedents': {
        // Используем кешированный KAG-контекст сессии
        const kagCtx = session?._kagContext || ''
        result = {
          precedents: kagCtx || 'Прецеденты из базы знаний не найдены. Используй общие знания о рынке.',
          query: args.query || '',
        }
        break
      }

      case 'web_search': {
        const webQuery = (args.query || '').trim()
        if (!webQuery) { result = { error: 'query required', results: '', count: 0 }; break }
        try {
          const resp = await fetch(`${API_BASE}/api/kag/web-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(18_000),
            body: JSON.stringify({ query: webQuery, n: args.n || 4 }),
          })
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const d = await resp.json()
          result = {
            results: (d.results || []).map(r => `${r.title}\n${r.snippet}`).join('\n\n---\n\n'),
            count:   (d.results || []).length,
          }
        } catch (e) {
          result = { error: `web_search failed: ${e.message}`, results: '', count: 0 }
        }
        break
      }

      case 'memory_search': {
        const memQuery = (args.query || '').trim()
        if (!memQuery) { result = { error: 'query required', results: '', count: 0 }; break }
        try {
          const resp = await fetch(`${API_BASE}/api/kag/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({ query: memQuery, limit: args.n || 5 }),
          })
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const d = await resp.json()
          const hits = (d.results || []).slice(0, args.n || 5)
          result = {
            results: hits.map(r => {
              const obs = (r.entity?.observations || []).slice(0, 3).join(' | ')
              return `${r.entity?.name}: ${obs}`
            }).join('\n'),
            count: hits.length,
          }
        } catch (e) {
          result = { error: `memory_search failed: ${e.message}`, results: '', count: 0 }
        }
        break
      }

      case 'exec_code': {
        try {
          // Sandbox: только Math и project, без DOM/fetch/global
          const fn = new Function('Math', 'project', `"use strict";\n${args.code || 'return null'}`)
          const raw = fn(Math, { ...project })
          result = { result: typeof raw === 'object' ? raw : { value: raw }, description: args.description || '' }
        } catch (e) {
          result = { error: `exec_code: ${e.message}` }
        }
        break
      }

      default:
        result = { error: `Неизвестный инструмент: ${toolName}` }
    }
  } catch (e) {
    result = { error: e.message }
  }

  const duration = Date.now() - t0
  room.logToolCall(context.agentId, toolName, args, result, duration)
  return result
}

// ── Парсинг ответа LLM ────────────────────────────────────────────────────────

function extractFirstJson(str) {
  let depth = 0, start = -1
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') { if (depth++ === 0) start = i }
    else if (str[i] === '}' && --depth === 0 && start !== -1) return str.slice(start, i + 1)
  }
  return null
}

function parseLoopResponse(raw) {
  if (!raw) return null
  const jsonStr = extractFirstJson(raw)
  if (jsonStr) {
    try {
      const p = JSON.parse(jsonStr)
      if (p.action === 'tool_call' && p.tool) return { type: 'tool_call', tool: p.tool, args: p.args || {}, reasoning: p.reasoning || '' }
      if (p.action === 'publish' && p.text)  return { type: 'publish', text: p.text, dimension: p.dimension, confidence: p.confidence, stance: p.stance }
      // LLM вернул аргумент без action (совместимость с generateArgumentAI)
      if (p.text) return { type: 'publish', text: p.text, dimension: p.dimension, confidence: p.confidence, stance: p.stance }
    } catch { /* fall through */ }
  }
  // Fallback: plain text ответ
  const text = raw.replace(/```[\s\S]*?```/g, '').replace(/\{[\s\S]*?\}/g, '').trim()
  if (text.length > 15) return { type: 'publish', text, dimension: null, confidence: 0.65, stance: null }
  return null
}

// ── LLM вызов ────────────────────────────────────────────────────────────────

async function callLLM({ agent, argType, conversationHistory, systemPrompt, modelId, projectBrief }) {
  const ddToken   = await getLoopToken()
  const authToken = ddToken || getLocalAuth()
  // Без токена backend использует virtual_token — вызов всё равно пройдёт
  console.debug(`[AgentLoop] callLLM: agent=${agent.id} model=${modelId} auth=${authToken ? authToken.slice(0,8)+'...' : 'virtual'}`)

  // Строим user-prompt из истории
  const historyStr = conversationHistory.length
    ? conversationHistory.map(h => `[${h.role}]: ${h.content}`).join('\n\n')
    : `Проект:\n${projectBrief}\n\nНачни анализ: сначала вызови инструменты, потом опубликуй аргумент.`

  const ctrl = new AbortController()
  const tid  = setTimeout(() => ctrl.abort(), TIMEOUT_MS)

  try {
    const resp = await fetch(`${API_BASE}/api/ai-tokens/chat`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        modelId,
        prompt:       historyStr,
        systemPrompt,
        application:  'FstCommitteeAgentLoop',
        maxTokens:    MAX_TOKENS,
        temperature:  TEMPERATURE,
      }),
    })
    clearTimeout(tid)
    if (!resp.ok) return null
    const d = await resp.json()
    return d.response || d.text || d.content || null
  } catch (e) {
    clearTimeout(tid)
    if (e.name !== 'AbortError') console.warn('[AgentLoop] LLM error:', e.message)
    return null
  }
}

// ── Главный loop агента ───────────────────────────────────────────────────────

/**
 * Запускает полный agentic loop для одного агента в одной фазе.
 *
 * @param {Object} agent          — агент из FstCommitteeConfig
 * @param {string} argType        — OPENING | CHALLENGE | COUNTER | SUMMARY
 * @param {Object} room           — DebateRoom
 * @param {Object} project        — данные проекта
 * @param {Object|null} targetArg — аргумент-цель (для COUNTER)
 * @param {Object} session        — полная сессия (для KAG-контекста)
 * @param {Object} opts           — { speedProfile, modelOverrides }
 * @returns {Object|null}         — аргумент для session.arguments
 */
export async function runAgentLoop(agent, argType, room, project, targetArg = null, session = {}, opts = {}, onProgress = null) {
  const tools     = getToolsForAgent(agent.id)
  const toolsDesc = formatToolsForPrompt(tools)
  const modelId   = resolveModel(agent.id, argType, opts.speedProfile || 'balanced', opts.modelOverrides || {})
  const projectBrief = formatProjectBrief(project)

  const VALID_DIMS    = ['trl','mrl','sovereignty','market','finance','risk','team']
  const VALID_STANCES = ['APPROVE','DEFER','REJECT']

  // ── Системный промпт: роль + инструменты + протокол ──────────────────────
  const baseRole = LOOP_SYSTEM_PROMPTS[agent.id] || `Ты аналитик инвесткомитета ФСТ НТИ. Роль: ${agent.name}.`
  const phaseDesc = {
    OPENING:   'ПЕРВИЧНЫЕ ПОЗИЦИИ — дай свою первичную позицию (2-3 конкретных предложения). Назови 1 сильную сторону и 1 ключевой риск.',
    CHALLENGE: 'ПЕРЕКРЁСТНЫЕ ДЕБАТЫ — выдвини ВЫЗОВ. Атакуй конкретное уязвимое место. Будь конкретен, используй числа.',
    COUNTER:   targetArg
      ? `ПЕРЕКРЁСТНЫЕ ДЕБАТЫ — дай ПРЯМОЙ КОНТРАРГУМЕНТ на: "${targetArg.text.slice(0, 120)}..."`
      : 'ПЕРЕКРЁСТНЫЕ ДЕБАТЫ — дай контраргумент на последний аргумент.',
    SUMMARY:   'ФИНАЛЬНЫЕ ПОЗИЦИИ — итоговая позиция с вердиктом (APPROVE / DEFER / REJECT) и обоснованием.',
    SYNTHESIS: 'СИНТЕЗ — итоговая взвешенная позиция с учётом всех аргументов.',
    CLOSING:   'ФИНАЛЬНОЕ СЛОВО — подведи итог и назови свой вердикт.',
  }

  const systemPrompt = `${baseRole}

ТЕКУЩАЯ ФАЗА: ${phaseDesc[argType] || argType}

ДАННЫЕ ПРОЕКТА:
${projectBrief}

ТВОИ ИНСТРУМЕНТЫ:
${toolsDesc}

ПРОТОКОЛ ОТВЕТА (СТРОГО JSON, без markdown, без текста вне JSON):

Если нужен инструмент:
{"action": "tool_call", "tool": "имя_инструмента", "args": {...}, "reasoning": "конкретное действие: что именно вычисляю/ищу и зачем, 1 фраза"}

Если готов к публикации финального аргумента:
{"action": "publish", "text": "твой аргумент (2-4 предложения с конкретными числами)", "dimension": "trl|mrl|sovereignty|market|finance|risk|team", "confidence": 0.0-1.0, "stance": "APPROVE|DEFER|REJECT"}

ПРАВИЛА:
— Сначала вызови хотя бы 1 инструмент (данные или зал), потом публикуй
— Максимум 5 tool_call итераций, потом обязательно publish
— Аргумент должен содержать конкретные числа из инструментов
— confidence отражает уверенность в своём вердикте`

  // ── История диалога в loop ────────────────────────────────────────────────
  const history = []
  const toolsUsed = []
  let iterNum = 0

  // Начальный контекст
  history.push({
    role: 'user',
    content: `Проект:\n${projectBrief}\n\nВызови первый инструмент чтобы начать анализ.`,
  })

  // ── Основной loop ─────────────────────────────────────────────────────────
  while (iterNum < MAX_ITER) {
    const rawResponse = await callLLM({
      agent, argType,
      conversationHistory: history,
      systemPrompt,
      modelId,
      projectBrief,
    })

    if (!rawResponse) {
      console.warn(`[AgentLoop] ${agent.id} iter${iterNum}: no response from LLM (model=${modelId})`)
      break
    }

    console.debug(`[AgentLoop] ${agent.id} iter${iterNum} raw:`, rawResponse.slice(0, 200))

    const parsed = parseLoopResponse(rawResponse)
    if (!parsed) {
      console.warn(`[AgentLoop] ${agent.id} iter${iterNum}: parse failed, raw=`, rawResponse.slice(0, 150))
      break
    }

    // ── Tool call ────────────────────────────────────────────────────────────
    if (parsed.type === 'tool_call') {
      onProgress?.({ agentId: agent.id, type: 'tool_start', tool: parsed.tool, args: parsed.args, reasoning: parsed.reasoning, iter: iterNum })
      const toolResult = await executeTool(parsed.tool, parsed.args, {
        room, project, session, agentId: agent.id,
      })
      toolsUsed.push(parsed.tool)
      onProgress?.({ agentId: agent.id, type: 'tool_done', tool: parsed.tool, result: toolResult, iter: iterNum })

      // Добавляем в историю: вызов + результат
      history.push({ role: 'assistant', content: JSON.stringify({ action: 'tool_call', tool: parsed.tool, reasoning: parsed.reasoning }) })
      history.push({ role: 'user',      content: `[Tool result: ${parsed.tool}]\n${JSON.stringify(toolResult, null, 2)}` })
      iterNum++
      continue
    }

    // ── Publish ──────────────────────────────────────────────────────────────
    if (parsed.type === 'publish' && parsed.text) {
      onProgress?.({ agentId: agent.id, type: 'publish', iter: iterNum })
      return {
        id:          `arg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        agentId:     agent.id,
        type:        argType,
        text:        parsed.text,
        targetArgId: targetArg?.id || null,
        dimension:   VALID_DIMS.includes(parsed.dimension)    ? parsed.dimension : agent.focus?.[0] || 'general',
        confidence:  typeof parsed.confidence === 'number'    ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7,
        stance:      VALID_STANCES.includes(parsed.stance)    ? parsed.stance : null,
        timestamp:   Date.now(),
        strength:    parsed.confidence || 0.7,
        aiGenerated: true,
        agentLoop:   true,   // маркер: сгенерировано через agentic loop
        toolsUsed,
        model:       modelId,
        iterCount:   iterNum,
      }
    }

    break // неизвестный формат
  }

  // ── Принудительная публикация если MAX_ITER исчерпан ─────────────────────
  // Агент мог всё время вызывать инструменты — делаем финальный вызов с явным требованием publish.
  if (toolsUsed.length > 0) {
    history.push({
      role: 'user',
      content: `Ты использовал ${toolsUsed.length} инструментов и получил данные. Теперь ОБЯЗАТЕЛЬНО опубликуй финальный аргумент.
Ответь ТОЛЬКО JSON без лишнего текста:
{"action":"publish","text":"твой аргумент с конкретными числами","dimension":"${agent.focus?.[0]||'finance'}","confidence":0.7,"stance":"APPROVE"}`,
    })
    const forceRaw = await callLLM({ agent, argType, conversationHistory: history, systemPrompt, modelId, projectBrief })
    if (forceRaw) {
      const fp = parseLoopResponse(forceRaw)
      if (fp?.type === 'publish' && fp.text) {
        onProgress?.({ agentId: agent.id, type: 'publish', iter: iterNum })
        return {
          id:          `arg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          agentId:     agent.id,
          type:        argType,
          text:        fp.text,
          targetArgId: targetArg?.id || null,
          dimension:   VALID_DIMS.includes(fp.dimension) ? fp.dimension : agent.focus?.[0] || 'finance',
          confidence:  typeof fp.confidence === 'number' ? Math.max(0, Math.min(1, fp.confidence)) : 0.7,
          stance:      VALID_STANCES.includes(fp.stance) ? fp.stance : null,
          timestamp:   Date.now(),
          strength:    fp.confidence || 0.7,
          aiGenerated: true,
          agentLoop:   true,
          toolsUsed,
          model:       modelId,
          iterCount:   iterNum,
        }
      }
    }
  }

  return null  // engine использует fallback-шаблон
}

// ── Параллельный запуск всех агентов одной фазы ───────────────────────────────

/**
 * Запускает агентов параллельно с ограничением concurrency.
 * MAX_PARALLEL агентов одновременно — не flood на бэкенд.
 */
export async function runParallelAgents(agents, argType, room, project, session, opts = {}) {
  const results = []
  // Разбиваем на батчи по MAX_PARALLEL
  for (let i = 0; i < agents.length; i += MAX_PARALLEL) {
    const batch = agents.slice(i, i + MAX_PARALLEL)
    const batchResults = await Promise.allSettled(
      batch.map(agent => runAgentLoop(agent, argType, room, project, null, session, opts))
    )
    results.push(...batchResults)
  }
  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value)
}
