/**
 * Agent Trigger Service
 *
 * Analyzes user queries to determine if a specialized agent should be invoked.
 * Supports both automatic detection and explicit commands.
 *
 * Agents:
 * - DeepResearchAgent: Company analysis, market research, HR research
 * - FinancialResearchAgent: Stock quotes, currency rates, financial analysis
 */

import deepResearchService from './deepResearchService'

// Trigger patterns for DeepResearchAgent
const DEEP_RESEARCH_PATTERNS = [
  // Explicit commands
  /^\/research\s+/i,
  /^@исследование\s+/i,
  /^@исследуй\s+/i,
  /^@research\s+/i,

  // Company analysis triggers
  /(?:проанализируй|анализ|исследуй|изучи)\s+(?:компанию|организацию|фирму|ооо|ао|пао|ип)\s+/i,
  /(?:найди|собери)\s+(?:информацию|данные|сведения)\s+(?:о|про|по)\s+(?:компании|организации)/i,
  /(?:что известно|расскажи)\s+(?:о|про)\s+(?:компании|организации|фирме)/i,
  /проверь\s+(?:компанию|контрагента|организацию)/i,
  /due\s*diligence/i,

  // HR/Job research triggers
  /(?:найди|поищи)\s+(?:вакансии|работу|сотрудников)\s+/i,
  /(?:зарплаты|оклады)\s+(?:в|на|для)\s+/i,
  /(?:рынок труда|hr\s*аналитика)/i,

  // Market research triggers
  /(?:исследуй|изучи|проанализируй)\s+(?:рынок|отрасль|сегмент)/i,
  /(?:конкуренты|конкурентный анализ)/i
]

// Trigger patterns for FinancialResearchAgent
const FINANCIAL_RESEARCH_PATTERNS = [
  // Explicit commands
  /^\/finance\s+/i,
  /^@финансы\s+/i,
  /^@finance\s+/i,

  // Stock/Market triggers
  /(?:котировки?|цена акций?)\s+(?:на\s+)?(?:сбер|газпром|лукойл|яндекс|сбербанк)/i,
  /(?:акции|бумаги)\s+(?:сбер|газпром|яндекс|лукойл|роснефть|норникель)/i,
  /(?:индекс|imoex|ммвб|rtsi)/i,
  /(?:тикер|ticker)\s+[a-z]{4}/i,

  // Currency triggers
  /курс\s+(?:доллара|евро|юаня|рубля|валют)/i,
  /(?:usd|eur|cny|rub)\/(?:usd|eur|cny|rub)/i,
  /(?:ключевая ставка|ставка цб)/i,

  // Financial analysis
  /(?:финансовый анализ|финансовое состояние)\s+/i,
  /(?:выручка|прибыль|рентабельность|ebitda)\s+(?:компании)?/i
]

// Agent types
export const AGENT_TYPES = {
  DEEP_RESEARCH: 'deep_research',
  FINANCIAL_RESEARCH: 'financial_research',
  NONE: null
}

// Agent metadata
export const AGENT_METADATA = {
  [AGENT_TYPES.DEEP_RESEARCH]: {
    name: 'Deep Research',
    icon: 'pi-search',
    description: 'Глубокий анализ компаний, рынков и HR',
    color: '#6366f1'
  },
  [AGENT_TYPES.FINANCIAL_RESEARCH]: {
    name: 'Financial Research',
    icon: 'pi-chart-line',
    description: 'Котировки, валюты, финансовый анализ',
    color: '#22c55e'
  }
}

class AgentTriggerService {
  constructor() {
    this.activeAgent = null
    this.sessionId = null
  }

  /**
   * Detect which agent should handle the query
   * @param {string} query - User query
   * @returns {Object} { agent: AGENT_TYPE, confidence: number, matchedPattern: string }
   */
  detectAgent(query) {
    if (!query || typeof query !== 'string') {
      return { agent: AGENT_TYPES.NONE, confidence: 0, matchedPattern: null }
    }

    const normalizedQuery = query.trim().toLowerCase()

    // Check explicit commands first (high confidence)
    for (const pattern of DEEP_RESEARCH_PATTERNS.slice(0, 4)) {
      if (pattern.test(query)) {
        return {
          agent: AGENT_TYPES.DEEP_RESEARCH,
          confidence: 1.0,
          matchedPattern: pattern.toString(),
          isExplicit: true
        }
      }
    }

    for (const pattern of FINANCIAL_RESEARCH_PATTERNS.slice(0, 3)) {
      if (pattern.test(query)) {
        return {
          agent: AGENT_TYPES.FINANCIAL_RESEARCH,
          confidence: 1.0,
          matchedPattern: pattern.toString(),
          isExplicit: true
        }
      }
    }

    // Check implicit triggers
    let deepResearchScore = 0
    let financialResearchScore = 0

    for (const pattern of DEEP_RESEARCH_PATTERNS) {
      if (pattern.test(query)) {
        deepResearchScore += 0.3
      }
    }

    for (const pattern of FINANCIAL_RESEARCH_PATTERNS) {
      if (pattern.test(query)) {
        financialResearchScore += 0.3
      }
    }

    // Cap at 0.9 for implicit triggers
    deepResearchScore = Math.min(deepResearchScore, 0.9)
    financialResearchScore = Math.min(financialResearchScore, 0.9)

    // Return highest scoring agent if above threshold
    const THRESHOLD = 0.3

    if (deepResearchScore > financialResearchScore && deepResearchScore >= THRESHOLD) {
      return {
        agent: AGENT_TYPES.DEEP_RESEARCH,
        confidence: deepResearchScore,
        matchedPattern: 'implicit',
        isExplicit: false
      }
    }

    if (financialResearchScore >= THRESHOLD) {
      return {
        agent: AGENT_TYPES.FINANCIAL_RESEARCH,
        confidence: financialResearchScore,
        matchedPattern: 'implicit',
        isExplicit: false
      }
    }

    return { agent: AGENT_TYPES.NONE, confidence: 0, matchedPattern: null }
  }

  /**
   * Extract the actual query from command
   * @param {string} input - Full user input
   * @returns {string} Query without command prefix
   */
  extractQuery(input) {
    // Remove command prefixes
    return input
      .replace(/^\/research\s+/i, '')
      .replace(/^@исследование\s+/i, '')
      .replace(/^@исследуй\s+/i, '')
      .replace(/^@research\s+/i, '')
      .replace(/^\/finance\s+/i, '')
      .replace(/^@финансы\s+/i, '')
      .replace(/^@finance\s+/i, '')
      .trim()
  }

  /**
   * Start agent execution
   * @param {string} agentType - Agent type
   * @param {string} query - Research query
   * @param {Object} options - Options
   * @returns {Promise<Object>} Session info or result
   */
  async executeAgent(agentType, query, options = {}) {
    const { accessToken, onProgress, onComplete, onError } = options

    this.activeAgent = agentType

    try {
      if (agentType === AGENT_TYPES.DEEP_RESEARCH) {
        return await this.executeDeepResearch(query, { accessToken, onProgress, onComplete, onError })
      }

      if (agentType === AGENT_TYPES.FINANCIAL_RESEARCH) {
        return await this.executeFinancialResearch(query, { accessToken, onProgress, onComplete, onError })
      }

      throw new Error(`Unknown agent type: ${agentType}`)
    } catch (error) {
      this.activeAgent = null
      throw error
    }
  }

  /**
   * Execute DeepResearchAgent
   */
  async executeDeepResearch(query, options = {}) {
    const { accessToken, onProgress, onComplete, onError } = options

    // Determine template based on query
    const template = this.detectResearchTemplate(query)

    // Start research session
    const session = await deepResearchService.startResearch(query, {
      template,
      accessToken
    })

    this.sessionId = session.sessionId

    // Subscribe to events
    deepResearchService.subscribeToSession(session.sessionId, {
      onPhase: (event) => {
        onProgress?.({
          type: 'phase',
          phase: event.phase,
          iteration: event.iteration,
          message: this.getPhaseMessage(event.phase)
        })
      },
      onTask: (event) => {
        onProgress?.({
          type: 'task',
          tool: event.tool,
          status: event.status,
          message: `${event.tool}: ${event.description || ''}`
        })
      },
      onComplete: async (event) => {
        this.activeAgent = null
        const result = await deepResearchService.getSessionResult(session.sessionId)
        onComplete?.({
          answer: result.result?.answer || event.answer,
          entities: result.result?.entities || [],
          sources: result.result?.taskResults || [],
          iterations: result.result?.iterations || event.iterations,
          duration: result.result?.duration || event.duration
        })
      },
      onError: (event) => {
        this.activeAgent = null
        onError?.(event.error || 'Research failed')
      }
    })

    return { sessionId: session.sessionId, status: 'running' }
  }

  /**
   * Detect financial query type from query text
   */
  detectFinancialQueryType(query) {
    const q = query.toLowerCase()

    // Currency patterns
    if (/курс|валют|доллар|евро|юан|рубл|usd|eur|cny|rub/i.test(q)) {
      return 'currency'
    }

    // Market/Stock patterns
    if (/акци|котировк|тикер|индекс|moex|ммвб|биржа|сбер|газпром|яндекс|лукойл/i.test(q)) {
      return 'market'
    }

    // Company patterns
    if (/компани|организаци|ооо|ао|пао|ип|инн|огрн|егрюл|контрагент/i.test(q)) {
      return 'company'
    }

    return 'general'
  }

  /**
   * Execute FinancialResearchAgent
   */
  async executeFinancialResearch(query, options = {}) {
    const { accessToken, onProgress, onComplete, onError, useOrchestrator = true } = options

    try {
      // Detect query type for proper tool selection
      const queryType = this.detectFinancialQueryType(query)

      onProgress?.({
        type: 'phase',
        phase: 'analyzing',
        message: `Анализирую запрос (${queryType})...`
      })

      // Use multi-agent orchestrator for better results
      const endpoint = useOrchestrator
        ? '/api/financial-research/orchestrate'
        : '/api/financial-research/analyze'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, type: queryType, accessToken })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()

      this.activeAgent = null

      if (result.success) {
        onComplete?.({
          answer: result.answer || result.synthesis?.summary,
          data: result.data,
          sources: result.sources || [],
          confidence: result.synthesis?.confidence || result.confidence,
          steps: result.steps,
          executionTime: result.executionTime
        })
      } else {
        onError?.(result.error || 'Financial research failed')
      }

      return result
    } catch (error) {
      this.activeAgent = null
      onError?.(error.message)
      throw error
    }
  }

  /**
   * Execute multi-agent orchestration for complex queries
   * @param {string} query - User query
   * @param {Object} options - Options
   * @returns {Promise<Object>}
   */
  async executeOrchestration(query, options = {}) {
    const { accessToken, onProgress, onComplete, onError, includeTrace = false } = options

    try {
      onProgress?.({
        type: 'phase',
        phase: 'planning',
        message: 'Планирую выполнение агентов...'
      })

      const response = await fetch('/api/financial-research/orchestrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, accessToken, includeTrace })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        onComplete?.({
          answer: result.answer,
          data: result.data,
          sources: result.sources || [],
          steps: result.steps,
          executionTime: result.executionTime,
          trace: result.trace
        })
      } else {
        onError?.(result.error || 'Orchestration failed')
      }

      return result
    } catch (error) {
      onError?.(error.message)
      throw error
    }
  }

  /**
   * Detect research template from query
   */
  detectResearchTemplate(query) {
    const q = query.toLowerCase()

    if (/вакансии|зарплат|hr|работ|сотрудник/i.test(q)) {
      return 'hr-research'
    }

    if (/рынок|конкурент|отрасль|сегмент/i.test(q)) {
      return 'market-research'
    }

    if (/компани|организаци|контрагент|ооо|ао|ип/i.test(q)) {
      return 'company-analysis'
    }

    return 'general'
  }

  /**
   * Get human-readable phase message
   */
  getPhaseMessage(phase) {
    const messages = {
      understand: 'Понимаю запрос и извлекаю ключевые сущности...',
      plan: 'Планирую исследование и выбираю инструменты...',
      execute: 'Выполняю поиск и сбор данных...',
      reflect: 'Анализирую результаты и проверяю полноту...',
      answer: 'Формирую финальный ответ...'
    }
    return messages[phase] || phase
  }

  /**
   * Cancel active agent
   */
  async cancel() {
    if (this.activeAgent === AGENT_TYPES.DEEP_RESEARCH && this.sessionId) {
      await deepResearchService.cancelSession(this.sessionId)
    }
    this.activeAgent = null
    this.sessionId = null
  }

  /**
   * Check if agent is currently running
   */
  isRunning() {
    return this.activeAgent !== null
  }

  /**
   * Get active agent type
   */
  getActiveAgent() {
    return this.activeAgent
  }
}

// Singleton instance
const agentTriggerService = new AgentTriggerService()

export default agentTriggerService

export { AgentTriggerService }
