/**
 * SuperChat Engine — event-driven AI brain for sidebar chat.
 *
 * Model Orchestrator — 3-tier Claude routing:
 *   FAST   (Haiku)  → простые запросы, приветствия, факты из контекста
 *   MEDIUM (Sonnet)  → анализ данных, сравнения, пояснения
 *   DEEP   (Opus)    → стратегия, прогнозы, мультишаговый анализ
 *
 * Model Events (LLM decides which to fire):
 *   SEARCH_MEMORY   → KAG knowledge graph search
 *   SEARCH_WEB      → Internet search via Tavily
 *   QUERY_COMPANY   → Integram company data
 *   RENDER_BLOCKS   → Dashboard block generation on page
 *   NAVIGATE        → Router navigation (MCP-like)
 *   REMEMBER        → Save user preference/habit to KAG
 *   ANALYZE         → Deep analysis via orchestrator agents
 *   RESPOND         → Direct text response
 *
 * Flow:
 *   User query + page context
 *     → Haiku classifies intent + complexity + selects events
 *     → Engine executes events in parallel
 *     → Appropriate model synthesizes final response
 *     → Chat displays response + side effects applied to UI
 */

import { useChatContextStore } from '@/stores/chatContextStore'
import { searchWeb as tavilySearch } from '@/services/chatAgentService'

// Claude-sub endpoint (same as sidebar chat — Claude Max subscription)
const API_CLAUDE = '/api/chat/claude-sub'
const API_KAG = '/api/mcp/kag-fst/execute'

// ── Model Tier Definitions ──────────────────────────────────────────────────

const MODELS = {
  FAST:   'claude-haiku-4-5-20251001',   // ~0.5s — simple, fast, cheap
  MEDIUM: 'claude-sonnet-4-6',            // ~2s   — balanced
  DEEP:   'claude-opus-4-6',              // ~5s   — deepest reasoning
}

/**
 * Send a message to Claude via claude-sub proxy.
 * Handles SSE streaming response and collects full text.
 */
async function askClaude(message, systemPrompt, model = MODELS.MEDIUM) {
  const resp = await fetch(API_CLAUDE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      systemPrompt,
      model,
      provider: 'claude-sub',
      conversationHistory: [],
      maxTokens: model === MODELS.FAST ? 1024 : 4096,
      temperature: model === MODELS.FAST ? 0.1 : 0.3,
    })
  })

  // claude-sub returns SSE stream: "data: {json}\n\ndata: [DONE]\n\n"
  const text = await resp.text()
  let result = ''
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
    try {
      const payload = JSON.parse(line.slice(6))
      if (payload.content) result += payload.content
      else if (payload.response) result += payload.response
      else if (payload.text) result += payload.text
    } catch {
      // Not JSON — skip
    }
  }
  return result || text.slice(0, 2000)
}

// ── Model Event Definitions ─────────────────────────────────────────────────

const MODEL_EVENTS = {
  SEARCH_MEMORY:  { id: 'search_memory',  label: 'Поиск в памяти' },
  SEARCH_WEB:     { id: 'search_web',     label: 'Поиск в интернете' },
  QUERY_COMPANY:  { id: 'query_company',  label: 'Данные компании' },
  RENDER_BLOCKS:  { id: 'render_blocks',  label: 'Визуализация на странице' },
  NAVIGATE:       { id: 'navigate',       label: 'Навигация' },
  REMEMBER:       { id: 'remember',       label: 'Запоминание' },
  ANALYZE:        { id: 'analyze',        label: 'Глубокий анализ' },
  RESPOND:        { id: 'respond',        label: 'Ответ' },
}

// ── Intent Classification + Model Selection (Haiku — fastest) ───────────────

function buildClassificationPrompt(query, ctx) {
  const contextLines = []
  if (ctx.page) contextLines.push(`Страница: ${ctx.page}`)
  if (ctx.tab) contextLines.push(`Вкладка: ${ctx.tab}`)
  if (ctx.selectedEntity) contextLines.push(`Выбрано: ${ctx.selectedEntity.name} (${ctx.selectedEntity.type})`)
  if (ctx.pageSummary) contextLines.push(`Данные: ${ctx.pageSummary.slice(0, 500)}`)

  return `Ты — маршрутизатор AI-чата AI-фонда ai2fund. Определи:
1) Какие действия нужны для ответа
2) Какой уровень модели нужен для синтеза ответа

КОНТЕКСТ:
${contextLines.join('\n') || 'Нет контекста страницы'}

ЗАПРОС: "${query}"

Верни JSON:
{
  "tier": "fast|medium|deep",
  "actions": [{ "event": "EVENT_ID", "params": { ... } }]
}

УРОВНИ МОДЕЛЕЙ (tier):
- "fast" — простые вопросы, приветствия, факты прямо из контекста страницы, навигация. Ответ в 1-3 предложения.
- "medium" — анализ данных из таблиц, сравнение компаний, пояснение метрик, формирование списков/ранжирование. Ответ с таблицами/списками.
- "deep" — стратегические рекомендации, прогнозы, сценарный анализ, мультишаговая аналитика, что-если вопросы.

ДОСТУПНЫЕ СОБЫТИЯ (actions):
- search_memory: { "query": "..." } — поиск в базе знаний фонда (KAG)
- search_web: { "query": "..." } — поиск в интернете (новости, рынок)
- query_company: { "company": "...", "fields": [...] } — данные компании из Integram
- render_blocks: { "query": "..." } — визуализация на дашборде (ТОЛЬКО на вкладке dashboard)
- navigate: { "path": "/fst-...", "reason": "..." } — перейти на страницу
- remember: { "fact": "...", "category": "preference|habit|note" } — запомнить
- analyze: { "query": "...", "agents": [...] } — глубокий анализ через оркестратор
- respond: { "hint": "..." } — прямой текстовый ответ

ПРАВИЛА:
- respond — всегда последним
- Если данные уже есть на странице (в контексте) и вопрос простой → tier: "fast", только respond
- search_memory — если спрашивают про конкретные компании/историю
- render_blocks — ТОЛЬКО если вкладка dashboard
- analyze — ТОЛЬКО для стратегических вопросов, автоматически tier: "deep"

Отвечай ТОЛЬКО JSON, без текста.`
}

// ── Event Executors ─────────────────────────────────────────────────────────

async function executeSearchMemory(params) {
  try {
    const resp = await fetch(API_KAG, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: 'kag_search', arguments: { query: params.query, limit: 10 } })
    })
    const data = await resp.json()
    const text = data?.result?.content?.[0]?.text || data?.content?.[0]?.text || JSON.stringify(data)
    try {
      const parsed = JSON.parse(text)
      if (parsed.results?.length) {
        return { source: 'memory', data: parsed.results.map(r => `${r.name || r.id}: ${r.observations?.join('; ') || r.entityType || ''}`).join('\n') }
      }
      return { source: 'memory', data: 'Ничего не найдено в памяти' }
    } catch {
      return { source: 'memory', data: text.slice(0, 1000) }
    }
  } catch (err) {
    return { source: 'memory', data: `Ошибка KAG: ${err.message}` }
  }
}

async function executeSearchWeb(params) {
  try {
    const results = await tavilySearch(params.query)
    if (results?.results?.length) {
      return { source: 'web', data: results.results.slice(0, 5).map(r => `${r.title}: ${r.content?.slice(0, 200)}`).join('\n\n') }
    }
    if (typeof results === 'string') return { source: 'web', data: results.slice(0, 2000) }
    return { source: 'web', data: 'Нет результатов' }
  } catch (err) {
    return { source: 'web', data: `Ошибка поиска: ${err.message}` }
  }
}

async function executeQueryCompany(params, ctx) {
  if (ctx.selectedEntity && ctx.selectedEntity.name?.toLowerCase() === params.company?.toLowerCase()) {
    const d = ctx.selectedEntity.data || {}
    const facts = Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')
    return { source: 'integram', data: `${ctx.selectedEntity.name}: ${facts}` }
  }
  return executeSearchMemory({ query: params.company })
}

async function executeRenderBlocks(params, ctx) {
  const chatCtx = useChatContextStore()
  if (chatCtx.hasPageHandler() && chatCtx.responseMode === 'blocks') {
    try {
      const result = await chatCtx.executeOnPage(params.query)
      if (result?.type === 'blocks') {
        return { source: 'blocks', data: result.data, blockCount: result.blockCount, rendered: true }
      }
    } catch (err) {
      return { source: 'blocks', data: `Ошибка блоков: ${err.message}`, rendered: false }
    }
  }
  return { source: 'blocks', data: 'Не на дашборде — блоки не отрисованы', rendered: false }
}

async function executeNavigate(params) {
  return { source: 'navigate', path: params.path, reason: params.reason }
}

async function executeRemember(params) {
  try {
    await fetch(API_KAG, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'kag_create_entities',
        arguments: {
          entities: [{
            name: `user_pref_${Date.now()}`,
            entityType: `UserPreference:${params.category || 'note'}`,
            observations: [params.fact]
          }]
        }
      })
    })
    return { source: 'memory', data: `Запомнил: ${params.fact}` }
  } catch (err) {
    return { source: 'memory', data: `Не удалось запомнить: ${err.message}` }
  }
}

async function executeAnalyze(params) {
  try {
    const resp = await fetch('/api/orchestrator/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: params.query, includeTrace: false })
    })
    const data = await resp.json()
    return { source: 'analyst', data: data.answer || data.result || JSON.stringify(data).slice(0, 2000) }
  } catch {
    // Fallback: Opus does the analysis directly
    try {
      const text = await askClaude(
        params.query,
        'Ты — старший аналитик AI-фонда ai2fund. Дай глубокий стратегический анализ с конкретными рекомендациями.',
        MODELS.DEEP
      )
      return { source: 'analyst', data: text || 'Нет результата' }
    } catch (err2) {
      return { source: 'analyst', data: `Ошибка анализа: ${err2.message}` }
    }
  }
}

// ── Event Dispatcher ────────────────────────────────────────────────────────

const EVENT_EXECUTORS = {
  search_memory: executeSearchMemory,
  search_web: executeSearchWeb,
  query_company: executeQueryCompany,
  render_blocks: executeRenderBlocks,
  navigate: executeNavigate,
  remember: executeRemember,
  analyze: executeAnalyze,
  respond: async (params) => ({ source: 'hint', data: params.hint || '' }),
}

// ── Tier → Model mapping ────────────────────────────────────────────────────

function tierToModel(tier) {
  switch (tier) {
    case 'fast': return MODELS.FAST
    case 'deep': return MODELS.DEEP
    default:     return MODELS.MEDIUM
  }
}

function tierLabel(tier) {
  switch (tier) {
    case 'fast': return 'Haiku'
    case 'deep': return 'Opus'
    default:     return 'Sonnet'
  }
}

// ── Main Engine ─────────────────────────────────────────────────────────────

/**
 * Process a user query through the SuperChat engine.
 *
 * @param {string} query - User's message
 * @param {Object} options
 * @param {Function} options.onEvent - (event) => void — called for each model event
 * @param {Function} options.onStatus - (status) => void — status updates
 * @returns {Promise<{ text: string, events: Array, navigation?: Object, tier: string }>}
 */
export async function processQuery(query, options = {}) {
  const { onEvent, onStatus } = options
  const chatCtx = useChatContextStore()

  const ctx = {
    page: chatCtx.page,
    tab: chatCtx.tab,
    subTab: chatCtx.subTab,
    selectedEntity: chatCtx.selectedEntity,
    pageSummary: chatCtx.pageSummary,
    responseMode: chatCtx.responseMode,
  }

  // ── Phase 1: Classify intent + select model tier (Haiku — fastest) ────
  onStatus?.('Определяю намерение...')

  let actions
  let tier = 'medium' // default
  try {
    const raw = await askClaude(query, buildClassificationPrompt(query, ctx), MODELS.FAST)
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(jsonStr)

    if (parsed.tier) tier = parsed.tier
    actions = parsed.actions || parsed
    if (!Array.isArray(actions)) actions = [{ event: 'respond', params: { hint: '' } }]

    // Force deep tier when analyze event is present
    if (actions.some(a => a.event === 'analyze')) tier = 'deep'
  } catch {
    actions = [{ event: 'respond', params: { hint: '' } }]
  }

  const selectedModel = tierToModel(tier)
  onStatus?.(`${tierLabel(tier)} · Обрабатываю...`)

  // ── Force render_blocks on dashboard ────────────────
  if (ctx.responseMode === 'blocks') {
    const hasRenderBlocks = actions.some(a => a.event === 'render_blocks')
    if (!hasRenderBlocks) {
      actions.unshift({ event: 'render_blocks', params: { query } })
    }
  }

  // ── Phase 2: Execute events in parallel ─────────────
  const eventResults = []
  let navigationAction = null

  const executableEvents = actions.filter(a => a.event !== 'respond')
  const respondHint = actions.find(a => a.event === 'respond')?.params?.hint || ''

  if (executableEvents.length > 0) {
    onStatus?.(`${tierLabel(tier)} · ${executableEvents.length} действий...`)

    const promises = executableEvents.map(async (action) => {
      const executor = EVENT_EXECUTORS[action.event]
      if (!executor) return { event: action.event, result: { source: 'unknown', data: 'Неизвестное событие' } }

      onEvent?.({ type: 'start', event: action.event, label: MODEL_EVENTS[action.event.toUpperCase()]?.label || action.event })

      const result = await executor(action.params || {}, ctx)

      onEvent?.({ type: 'end', event: action.event, result })

      if (action.event === 'navigate' && result.path) {
        navigationAction = result
      }

      return { event: action.event, result }
    })

    const results = await Promise.allSettled(promises)
    for (const r of results) {
      if (r.status === 'fulfilled') eventResults.push(r.value)
    }
  }

  // ── Phase 3: Synthesize response (tier-appropriate model) ─────────────
  onStatus?.(`${tierLabel(tier)} · Формирую ответ...`)

  const eventContext = eventResults
    .filter(e => e.result?.data && e.event !== 'navigate' && e.event !== 'remember')
    .map(e => `[${e.result.source?.toUpperCase() || e.event}]\n${e.result.data}`)
    .join('\n\n---\n\n')

  const blocksRendered = eventResults.some(e => e.event === 'render_blocks' && e.result?.rendered)
  const remembered = eventResults.find(e => e.event === 'remember')

  const pageData = ctx.pageSummary || ''
  const entityData = ctx.selectedEntity
    ? `Выбрана: ${ctx.selectedEntity.name} (${JSON.stringify(ctx.selectedEntity.data || {})})`
    : ''

  const synthSystemPrompt = `Ты — AI-ассистент AI-фонда ai2fund. Отвечай кратко и по делу, по-русски.

${chatCtx.systemPromptExtra || ''}

${pageData ? `ДАННЫЕ ПОРТФЕЛЯ (из интерфейса — ДОСТОВЕРНЫЕ данные):\n${pageData}` : ''}
${entityData ? `\n${entityData}` : ''}

${eventContext ? `ДОПОЛНИТЕЛЬНЫЕ ДАННЫЕ (из поиска):\n\n${eventContext}` : ''}
${respondHint ? `\nПодсказка: ${respondHint}` : ''}
${blocksRendered ? '\nВизуализация уже отрисована на дашборде — упомяни это.' : ''}
${remembered ? `\nТы запомнил: "${remembered.result.data}"` : ''}
${navigationAction ? `\nТы перенаправишь пользователя на ${navigationAction.path} (${navigationAction.reason})` : ''}

ВАЖНО: Используй ДАННЫЕ ПОРТФЕЛЯ как основной источник. Не говори что данных нет если они есть выше.
Форматируй ответ Markdown.`

  let finalText
  try {
    finalText = await askClaude(query, synthSystemPrompt, selectedModel)
    if (!finalText) finalText = 'Не удалось сформировать ответ.'
  } catch {
    finalText = 'Ошибка при формировании ответа.'
  }

  onStatus?.(null)

  return {
    text: finalText,
    events: eventResults,
    navigation: navigationAction,
    blocksRendered,
    tier,
    model: tierLabel(tier),
  }
}

export { MODEL_EVENTS, MODELS }
