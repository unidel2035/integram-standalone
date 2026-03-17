/**
 * FundOrchestrator — Multi-agent orchestrator adapted for VentureOS fund
 *
 * Based on MultiAgentOrchestrator from dronedoc2026, simplified for fund:
 * - Uses /api/ai-tokens/chat for LLM calls (not TokenBasedLLMCoordinator)
 * - Built-in fund-specific agents (portfolio, metrics, KAG, memory)
 * - No external AgentService/KnowledgeBaseService dependencies
 *
 * 3-phase execution: Plan → Execute → Synthesize
 */

import ExecutionContext from './ExecutionContext.js'
import logger from '../../utils/logger.js'
import { ExecutionLifecycle, LIFECYCLE_STATES } from './ExecutionLifecycle.js'
import { ThinkingEmitter, THINKING_TYPES } from './ThinkingBlocks.js'

// ── Built-in fund agents ────────────────────────────────────────

class PortfolioAgent {
  constructor(baseUrl) { this.baseUrl = baseUrl }
  get name() { return 'portfolio' }
  get description() { return 'Портфельные компании фонда ФСТ НТИ. Знает все 27 компаний, их TRL, сектора, субфонды, оценки ИК.' }
  get capabilities() { return ['компании', 'портфель', 'TRL', 'суверенность', 'патенты', 'субфонд', 'инвестиции'] }

  async execute(input) {
    const resp = await fetch(`${this.baseUrl}/api/mcp/kag-fst/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: 'kag_search', arguments: { query: input.query || input, limit: 20 } }),
      signal: AbortSignal.timeout(5000),
    })
    const data = await resp.json()
    const text = data.result?.content?.[0]?.text
    if (!text) return { success: false, error: 'KAG returned empty' }
    const parsed = JSON.parse(text)
    return { success: true, data: parsed.results, count: parsed.results?.length || 0 }
  }
}

class MetricsAgent {
  constructor(baseUrl) { this.baseUrl = baseUrl }
  get name() { return 'metrics' }
  get description() { return 'Финансовые метрики компаний: выручка, EBITDA, прибыль, Cash Flow, IRR. Данные из Integram БД (type 126255).' }
  get capabilities() { return ['выручка', 'revenue', 'EBITDA', 'прибыль', 'метрики', 'финансы', 'cashflow', 'IRR'] }

  async execute(input) {
    // Search KAG for financial metric schema info
    const resp = await fetch(`${this.baseUrl}/api/mcp/kag-fst/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: 'kag_search', arguments: { query: `${input.query || input} метрика финансы`, limit: 10 } }),
      signal: AbortSignal.timeout(5000),
    })
    const data = await resp.json()
    const text = data.result?.content?.[0]?.text
    if (!text) return { success: false, error: 'No metrics found' }
    const parsed = JSON.parse(text)
    const finMetrics = (parsed.results || []).filter(e => e.type === 'FinMetric' || e.type === 'DB_Table')
    return { success: true, data: finMetrics, count: finMetrics.length }
  }
}

class MemoryAgent {
  constructor(baseUrl) { this.baseUrl = baseUrl }
  get name() { return 'memory' }
  get description() { return 'Анамнестическая память фонда — поиск по записям сессий, проектным заметкам, решениям.' }
  get capabilities() { return ['помнишь', 'память', 'ранее', 'история', 'решение', 'сессия', 'контекст'] }

  async execute(input) {
    const q = encodeURIComponent(input.query || input)
    const resp = await fetch(`${this.baseUrl}/api/claude-memory/search?q=${q}&limit=10`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!resp.ok) return { success: false, error: `Memory API error ${resp.status}` }
    const data = await resp.json()
    return { success: true, data: data.data || [], count: data.count || 0 }
  }
}

class AnalystAgent {
  constructor(baseUrl) { this.baseUrl = baseUrl }
  get name() { return 'analyst' }
  get description() { return 'AI-аналитик: отвечает на сложные бизнес-вопросы, сравнивает компании, считает средние, делает выводы.' }
  get capabilities() { return ['сравни', 'анализ', 'лучшие', 'худшие', 'средний', 'рекомендация', 'вывод', 'тренд'] }

  async execute(input) {
    const resp = await fetch(`${this.baseUrl}/api/ai-tokens/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: input.query || input,
        systemPrompt: `Ты — финансовый аналитик фонда ФСТ НТИ. Анализируй данные, считай, делай выводы. Отвечай кратко.\n\nКонтекст:\n${JSON.stringify(input.context || {})}`,
        application: 'FundOrchestrator-Analyst',
      }),
      signal: AbortSignal.timeout(15000),
    })
    const data = await resp.json()
    return { success: true, answer: data.response || 'Нет ответа' }
  }
}

// ── Orchestrator ─────────────────────────────────────────────────

export class FundOrchestrator {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || `http://localhost:${options.port || 8082}`
    this.defaultModel = options.defaultModel || 'deepseek/deepseek-chat'

    this.config = {
      maxDepth: options.maxDepth || 5,
      maxSteps: options.maxSteps || 20,
      timeout: options.timeout || 60000,
      enablePlanning: options.enablePlanning !== false,
      enableSynthesis: options.enableSynthesis !== false,
    }

    // Register built-in agents
    this.agents = new Map()
    this._registerBuiltinAgents()

    // ThinkingEmitter is reusable, lifecycle created per-execution
    this.thinking = new ThinkingEmitter()
  }

  _registerBuiltinAgents() {
    const agents = [
      new PortfolioAgent(this.baseUrl),
      new MetricsAgent(this.baseUrl),
      new MemoryAgent(this.baseUrl),
      new AnalystAgent(this.baseUrl),
    ]
    for (const a of agents) {
      this.agents.set(a.name, a)
    }
  }

  /**
   * Register a custom agent
   */
  registerAgent(agent) {
    this.agents.set(agent.name, agent)
  }

  /**
   * Main entry: execute a user query with multi-agent orchestration
   */
  async execute(query, options = {}) {
    const ctx = new ExecutionContext(query, {
      maxDepth: this.config.maxDepth,
      maxSteps: this.config.maxSteps,
      timeout: this.config.timeout,
    })

    const onThinking = options.onThinking || (() => {})
    const lifecycle = new ExecutionLifecycle()

    try {
      // Phase 1: Plan
      lifecycle.transition(LIFECYCLE_STATES.PLANNING)
      onThinking({ type: THINKING_TYPES.PLANNING, content: 'Анализирую запрос и выбираю агентов...' })

      const plan = await this._planExecution(query, ctx)
      ctx.plan = plan
      logger.info(`[FundOrch] Plan: ${plan.steps.map(s => s.agent).join(' → ')}`)

      // Phase 2: Execute
      lifecycle.transition(LIFECYCLE_STATES.EXECUTING)
      onThinking({ type: THINKING_TYPES.ANALYZING, content: `Выполняю ${plan.steps.length} шагов...` })

      const results = await this._executePlan(plan, ctx, onThinking)

      // Phase 3: Synthesize
      lifecycle.transition(LIFECYCLE_STATES.SYNTHESIZING)
      onThinking({ type: THINKING_TYPES.SYNTHESIZING, content: 'Формирую ответ...' })

      const answer = await this._synthesize(query, results, ctx)

      lifecycle.transition(LIFECYCLE_STATES.COMPLETED)
      ctx.endTime = Date.now()

      return {
        success: true,
        query,
        answer,
        steps: ctx.steps,
        agents: plan.steps.map(s => s.agent),
        executionTime: ctx.endTime - ctx.startTime,
        trace: ctx.getTrace(),
      }
    } catch (error) {
      logger.error(`[FundOrch] Error: ${error.message}`)
      lifecycle.transition(LIFECYCLE_STATES.COMPLETED)
      return {
        success: false,
        query,
        answer: `Ошибка оркестрации: ${error.message}`,
        steps: ctx.steps,
        executionTime: Date.now() - ctx.startTime,
      }
    }
  }

  /**
   * Phase 1: Use LLM to create execution plan
   */
  async _planExecution(query, ctx) {
    if (!this.config.enablePlanning) {
      return this._createDefaultPlan(query)
    }

    const agentDescriptions = [...this.agents.values()].map(a =>
      `- ${a.name}: ${a.description} [ключевые слова: ${a.capabilities.join(', ')}]`
    ).join('\n')

    try {
      const resp = await fetch(`${this.baseUrl}/api/ai-tokens/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: this.defaultModel,
          prompt: `Запрос пользователя: "${query}"

Доступные агенты:
${agentDescriptions}

Создай JSON-план выполнения. Формат:
{
  "steps": [
    { "agent": "имя_агента", "query": "что запросить у агента", "dependsOn": [] }
  ],
  "reasoning": "краткое объяснение плана"
}

Правила:
- Используй минимум агентов (1-3)
- portfolio — для данных о компаниях
- metrics — для финансовых показателей
- memory — для исторических данных/решений
- analyst — для сложного анализа (если нужно сравнить, посчитать, рекомендовать)
- Если шаг зависит от другого, укажи в dependsOn имя агента
- Ответь ТОЛЬКО JSON, без markdown`,
          systemPrompt: 'Ты — планировщик агентной системы фонда ФСТ НТИ. Отвечай строго JSON.',
          application: 'FundOrchestrator-Planner',
        }),
        signal: AbortSignal.timeout(10000),
      })

      const data = await resp.json()
      const text = data.response || ''

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0])
        if (plan.steps?.length > 0) {
          return plan
        }
      }
    } catch (e) {
      logger.warn(`[FundOrch] Planning failed: ${e.message}, using default plan`)
    }

    return this._createDefaultPlan(query)
  }

  /**
   * Default plan when LLM planning fails
   */
  _createDefaultPlan(query) {
    const q = query.toLowerCase()
    const steps = []

    // Always start with portfolio data
    steps.push({ agent: 'portfolio', query, dependsOn: [] })

    // Add metrics agent for financial queries
    const finKeywords = ['выручк', 'ebitda', 'прибыл', 'метрик', 'финанс', 'cashflow', 'irr', 'доход']
    if (finKeywords.some(k => q.includes(k))) {
      steps.push({ agent: 'metrics', query, dependsOn: [] })
    }

    // Add memory for history/context queries
    const memKeywords = ['помнишь', 'ранее', 'историч', 'решен', 'прошл']
    if (memKeywords.some(k => q.includes(k))) {
      steps.push({ agent: 'memory', query, dependsOn: [] })
    }

    // Add analyst for complex analysis
    const analyticKeywords = ['сравни', 'лучш', 'худш', 'средн', 'рекоменд', 'анализ', 'вывод', 'рейтинг', 'топ']
    if (analyticKeywords.some(k => q.includes(k))) {
      steps.push({ agent: 'analyst', query: `${query}`, dependsOn: ['portfolio'] })
    }

    return { steps, reasoning: 'Default keyword-based plan' }
  }

  /**
   * Phase 2: Execute plan steps (parallel where possible)
   */
  async _executePlan(plan, ctx, onThinking) {
    const results = {}

    // Group by dependency level
    const levels = this._groupByDependencyLevel(plan.steps)

    for (const level of levels) {
      // Execute all steps in this level in parallel
      const promises = level.map(async (step) => {
        const agent = this.agents.get(step.agent)
        if (!agent) {
          logger.warn(`[FundOrch] Agent not found: ${step.agent}`)
          return
        }

        onThinking({
          type: THINKING_TYPES.ANALYZING,
          content: `Агент "${step.agent}": ${step.query?.slice(0, 60)}...`,
        })

        const startTime = Date.now()
        try {
          // Inject context from dependent steps
          const input = {
            query: step.query,
            context: {},
          }
          for (const dep of (step.dependsOn || [])) {
            if (results[dep]) input.context[dep] = results[dep]
          }

          const result = await agent.execute(input)
          results[step.agent] = result

          ctx.addStep(step.agent, step.query, result, { startTime })
        } catch (error) {
          logger.error(`[FundOrch] Agent ${step.agent} failed: ${error.message}`)
          ctx.addStep(step.agent, step.query, { success: false, error: error.message }, { startTime })
        }
      })

      await Promise.allSettled(promises)
    }

    return results
  }

  /**
   * Group steps by dependency level for parallel execution
   */
  _groupByDependencyLevel(steps) {
    const levels = []
    const placed = new Set()

    while (placed.size < steps.length) {
      const level = steps.filter(s => {
        if (placed.has(s.agent)) return false
        return (s.dependsOn || []).every(d => placed.has(d))
      })
      if (level.length === 0) break // Circular dependency
      for (const s of level) placed.add(s.agent)
      levels.push(level)
    }

    return levels
  }

  /**
   * Phase 3: Synthesize results into final answer
   */
  async _synthesize(query, results, ctx) {
    if (!this.config.enableSynthesis) {
      return this._basicSummary(results)
    }

    // Collect successful results
    const resultsSummary = Object.entries(results)
      .filter(([, r]) => r && r.success !== false)
      .map(([agent, r]) => {
        if (r.answer) return `[${agent}] ${r.answer}`
        if (r.data) return `[${agent}] ${JSON.stringify(r.data).slice(0, 1000)}`
        return `[${agent}] ${JSON.stringify(r).slice(0, 500)}`
      })
      .join('\n\n')

    if (!resultsSummary) {
      return 'Агенты не смогли найти данные по запросу.'
    }

    try {
      const resp = await fetch(`${this.baseUrl}/api/ai-tokens/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: this.defaultModel,
          prompt: `Запрос пользователя: "${query}"

Результаты агентов:
${resultsSummary}

Составь единый связный ответ на запрос пользователя. Используй данные от агентов. Будь точен и конкретен.`,
          systemPrompt: 'Ты — AI-аналитик фонда ФСТ НТИ. Синтезируй данные от нескольких агентов в один связный ответ. По-русски, кратко.',
          application: 'FundOrchestrator-Synthesizer',
        }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await resp.json()
      return data.response || this._basicSummary(results)
    } catch (e) {
      logger.warn(`[FundOrch] Synthesis failed: ${e.message}`)
      return this._basicSummary(results)
    }
  }

  _basicSummary(results) {
    return Object.entries(results)
      .filter(([, r]) => r && r.success !== false)
      .map(([agent, r]) => `**${agent}**: ${r.answer || JSON.stringify(r.data || r).slice(0, 300)}`)
      .join('\n\n')
  }

  /**
   * Get all registered agents info
   */
  getAgents() {
    return [...this.agents.values()].map(a => ({
      name: a.name,
      description: a.description,
      capabilities: a.capabilities,
    }))
  }
}

/**
 * Create a pre-configured orchestrator
 */
export function createFundOrchestrator(options = {}) {
  return new FundOrchestrator(options)
}
