/**
 * Token Consumption Logger Service
 *
 * Logs AI token consumption to Integram table 198038 (Транзакция)
 * Issue #3962: Token consumption logging for polza.ai
 *
 * Table structure (198038 "Транзакция"):
 * - 198040: Модель (reference to 195686)
 * - 198041: Входящих токенов (SHORT)
 * - 198042: Исходящих токенов (SHORT)
 * - 198043: Сумма (SIGNED/FLOAT)
 */

import logger from '../../utils/logger.js'

// Model name to ID mapping for table 195686
const MODEL_IDS = {
  'claude-3.5-haiku': '195703',
  'claude-3.5-haiku (2024-10-22)': '195714',
  'claude-3.5-haiku:beta': '195721',
  'claude-3.5-sonnet': '195728',
  'claude-3.5-sonnet-20240620': '195737',
  'claude-3.5-sonnet-20240620:beta': '195744',
  'claude-3.5-sonnet:beta': '195751',
  'claude-3-haiku': '195758',
  'claude-3-haiku:beta': '195765',
  'claude-3-opus': '195772',
  'claude-3-opus:beta': '195781',
  'claude-3.7-sonnet': '195788',
  'claude-3.7-sonnet:beta': '195795',
  'claude-3.7-sonnet:thinking': '195802',
  'claude-haiku-4.5': '195809',
  'claude-opus-4': '195816',
  'claude-opus-4.1': '195823',
  'claude-sonnet-4': '195830',
  'claude-sonnet-4.5': '195838',
  'deepseek-chat': '195845',
  // Polza.ai model aliases
  'anthropic/claude-sonnet-4.5': '195838',
  'anthropic/claude-3.5-sonnet': '195728',
  'anthropic/claude-3-haiku': '195758',
  'anthropic/claude-3-opus': '195772',
  'openai/gpt-5.1': null,
  'openai/gpt-5.1-chat': null,
  'openai/gpt-5.1-codex': null,
  'openai/gpt-5.1-codex-mini': null,
  'amazon/nova-premier-v1': null,
  'google/gemini-3-pro-preview': null,
  'moonshotai/kimi-k2-thinking': null,
  'openrouter/sherlock-dash-alpha': null,
  'openrouter/sherlock-think-alpha': null
}

// Requisite IDs for table 198038
const REQUISITE_IDS = {
  model: '198040',
  promptTokens: '198041',
  completionTokens: '198042',
  cost: '198043'
}

// Table and type IDs
const TRANSACTION_TYPE_ID = 198038
const AI_TOKEN_TYPE_ID = 198016

class TokenConsumptionLogger {
  constructor() {
    this.baseUrl = process.env.INTEGRAM_API_URL || 'https://dronedoc.ru'
    this.database = 'my'
    this.authToken = null
    this.xsrfToken = null
    this.authenticated = false
    this.userTokenCache = new Map() // Cache user tokens to avoid repeated lookups
  }

  /**
   * Authenticate with Integram API
   */
  async authenticate() {
    if (this.authenticated && this.authToken) {
      return true
    }

    try {
      const loginData = new URLSearchParams()
      loginData.append('login', process.env.INTEGRAM_LOGIN || 'd')
      loginData.append('password', process.env.INTEGRAM_PASSWORD || 'd')

      const response = await fetch(`${this.baseUrl}/${this.database}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: loginData,
        redirect: 'manual' // Не следовать редиректу, чтобы получить cookies из 302
      })

      // 302 редирект означает успешную аутентификацию
      if (response.status !== 302 && !response.ok) {
        throw new Error(`Authentication failed: ${response.status}`)
      }

      // Extract cookies from response
      // В Node.js 18+ используем getSetCookie(), иначе get('set-cookie')
      let cookiesArray = []
      if (typeof response.headers.getSetCookie === 'function') {
        cookiesArray = response.headers.getSetCookie()
      } else {
        const singleCookie = response.headers.get('set-cookie')
        if (singleCookie) {
          cookiesArray = [singleCookie]
        }
      }

      const cookiesStr = cookiesArray.join('; ')
      logger.info(`Cookies received: ${cookiesArray.length} cookies`)

      if (cookiesStr) {
        const tokenMatch = cookiesStr.match(/token=([^;]+)/)
        const xsrfMatch = cookiesStr.match(/xsrf=([^;]+)/)

        if (tokenMatch) {
          this.authToken = tokenMatch[1]
          logger.info(`Auth token extracted: ${this.authToken.substring(0, 8)}...`)
        }
        if (xsrfMatch) {
          this.xsrfToken = xsrfMatch[1]
          logger.info(`XSRF token extracted: ${this.xsrfToken.substring(0, 8)}...`)
        }
      } else {
        logger.warn('No cookies received from login response')
      }

      if (!this.authToken) {
        throw new Error('Failed to extract auth token from cookies')
      }

      this.authenticated = true
      logger.info('TokenConsumptionLogger authenticated successfully')
      return true
    } catch (error) {
      logger.error('TokenConsumptionLogger authentication failed:', error.message)
      this.authenticated = false
      return false
    }
  }

  /**
   * Получить токен пользователя из таблицы 198016 (ai_token)
   * Транзакции должны создаваться как подчиненные записи к токену пользователя
   */
  async getUserToken(userId) {
    // Проверяем кэш
    if (this.userTokenCache.has(userId)) {
      return this.userTokenCache.get(userId)
    }

    try {
      // Ищем токен пользователя в таблице 198016 с фильтром F_U
      // Добавляем JSON параметр для получения JSON ответа
      const url = `${this.baseUrl}/${this.database}/object/${AI_TOKEN_TYPE_ID}?F_U=${userId}&JSON`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cookie': `token=${this.authToken}; xsrf=${this.xsrfToken}`,
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        logger.warn(`Не удалось получить токен пользователя ${userId}: ${response.status}`)
        return null
      }

      const text = await response.text()

      // Проверяем что ответ - JSON
      let data
      try {
        data = JSON.parse(text)
      } catch (parseError) {
        logger.warn(`Ответ не JSON для пользователя ${userId}, возможно HTML: ${text.substring(0, 100)}`)
        return null
      }

      // Ищем первый токен пользователя
      if (data.object && data.object.length > 0) {
        const tokenId = data.object[0].id
        this.userTokenCache.set(userId, tokenId)
        logger.info(`Найден токен ${tokenId} для пользователя ${userId}`)
        return tokenId
      }

      logger.warn(`Токен не найден для пользователя ${userId}`)
      return null
    } catch (error) {
      logger.error(`Ошибка при поиске токена пользователя ${userId}:`, error.message)
      return null
    }
  }

  /**
   * Get model ID from model name
   */
  getModelId(modelName) {
    if (MODEL_IDS[modelName]) {
      return MODEL_IDS[modelName]
    }

    const normalizedName = modelName.toLowerCase()
    for (const [key, value] of Object.entries(MODEL_IDS)) {
      if (key.toLowerCase().includes(normalizedName) || normalizedName.includes(key.toLowerCase())) {
        return value
      }
    }

    logger.warn(`Model ${modelName} not found in mapping, using default claude-sonnet-4.5`)
    return MODEL_IDS['claude-sonnet-4.5']
  }

  /**
   * Calculate cost in RUB based on model pricing
   * Prices are per 1M tokens in RUB (from table 195686)
   */
  calculateCost(modelName, promptTokens, completionTokens) {
    let promptPrice = 265.52 / 1000000
    let completionPrice = 1327.62 / 1000000

    const modelPricing = {
      'claude-3.5-haiku': { prompt: 70.81, completion: 354.03 },
      'claude-haiku-4.5': { prompt: 88.51, completion: 442.54 },
      'claude-3-haiku': { prompt: 22.13, completion: 110.64 },
      'claude-3.5-sonnet': { prompt: 265.52, completion: 1327.62 },
      'claude-sonnet-4.5': { prompt: 265.52, completion: 1327.62 },
      'claude-sonnet-4': { prompt: 265.52, completion: 1327.62 },
      'claude-3.7-sonnet': { prompt: 265.52, completion: 1327.62 },
      'claude-3-opus': { prompt: 1327.62, completion: 6638.10 },
      'claude-opus-4': { prompt: 1327.62, completion: 6638.10 },
      'claude-opus-4.1': { prompt: 1327.62, completion: 6638.10 },
      'deepseek-chat': { prompt: 26.55, completion: 106.21 },
      'anthropic/claude-sonnet-4.5': { prompt: 265.52, completion: 1327.62 },
      'anthropic/claude-3.5-sonnet': { prompt: 265.52, completion: 1327.62 }
    }

    const normalizedName = modelName.toLowerCase()
    for (const [key, prices] of Object.entries(modelPricing)) {
      if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
        promptPrice = prices.prompt / 1000000
        completionPrice = prices.completion / 1000000
        break
      }
    }

    const totalCost = (promptTokens * promptPrice) + (completionTokens * completionPrice)
    return totalCost
  }

  /**
   * Log token consumption to Integram
   * Транзакции создаются как подчиненные записи к токену пользователя (up=tokenId)
   *
   * Issue #4921: Gracefully handles Integram unavailability by:
   * 1. Logging locally to console/file
   * 2. Returning success=false but continuing execution
   * 3. Not blocking AI features if logging fails
   */
  async logConsumption({ userId, model, promptTokens, completionTokens, tokenId }) {
    logger.info('[TokenConsumptionLogger] Starting logConsumption', {
      userId,
      model,
      promptTokens,
      completionTokens,
      tokenId
    })

    try {
      if (!await this.authenticate()) {
        logger.warn('[TokenConsumptionLogger] Cannot log to Integram: authentication failed - logging locally only')
        // Fallback: Log locally to file/console
        logger.info('[TokenConsumptionLogger] LOCAL FALLBACK - Token consumption', {
          userId,
          model,
          promptTokens,
          completionTokens,
          cost: this.calculateCost(model, promptTokens, completionTokens).toFixed(6),
          timestamp: new Date().toISOString()
        })
        return { success: false, error: 'Authentication failed', fallbackLogged: true }
      }
      logger.info('[TokenConsumptionLogger] Authentication successful')

      const modelId = this.getModelId(model)
      if (!modelId) {
        logger.warn(`[TokenConsumptionLogger] Unknown model: ${model} - logging locally only`)
        // Fallback: Log locally even for unknown models
        logger.info('[TokenConsumptionLogger] LOCAL FALLBACK - Token consumption (unknown model)', {
          userId,
          model,
          promptTokens,
          completionTokens,
          cost: this.calculateCost(model, promptTokens, completionTokens).toFixed(6),
          timestamp: new Date().toISOString()
        })
        return { success: false, error: 'Unknown model', fallbackLogged: true }
      }
      logger.info('[TokenConsumptionLogger] Model ID resolved', { model, modelId })

      // Получаем tokenId пользователя если не передан
      let parentTokenId = tokenId
      if (!parentTokenId && userId) {
        logger.info(`[TokenConsumptionLogger] Looking up token for user ${userId}`)
        parentTokenId = await this.getUserToken(userId)
      }

      if (!parentTokenId) {
        logger.warn(`[TokenConsumptionLogger] Token not found for user ${userId} - logging locally only`)
        // Fallback: Log locally when user token not found
        logger.info('[TokenConsumptionLogger] LOCAL FALLBACK - Token consumption (no user token)', {
          userId,
          model,
          modelId,
          promptTokens,
          completionTokens,
          cost: this.calculateCost(model, promptTokens, completionTokens).toFixed(6),
          timestamp: new Date().toISOString()
        })
        return { success: false, error: 'User token not found', fallbackLogged: true }
      }
      logger.info('[TokenConsumptionLogger] Found parent token', { userId, parentTokenId })

      const cost = this.calculateCost(model, promptTokens, completionTokens)

      const requestParams = new URLSearchParams()
      requestParams.append('_xsrf', this.xsrfToken)  // CSRF token required
      requestParams.append('val', `Транзакция ${new Date().toISOString()}`)
      requestParams.append('up', parentTokenId.toString()) // Подчиненная запись к токену пользователя
      requestParams.append(`t${REQUISITE_IDS.model}`, modelId)
      requestParams.append(`t${REQUISITE_IDS.promptTokens}`, promptTokens.toString())
      requestParams.append(`t${REQUISITE_IDS.completionTokens}`, completionTokens.toString())
      requestParams.append(`t${REQUISITE_IDS.cost}`, cost.toFixed(6))

      const response = await fetch(`${this.baseUrl}/${this.database}/_m_new/${TRANSACTION_TYPE_ID}?JSON&up=${parentTokenId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': `token=${this.authToken}; xsrf=${this.xsrfToken}`,
          'X-XSRF-TOKEN': this.xsrfToken
        },
        body: requestParams
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create transaction: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      logger.info('Token consumption logged successfully', {
        userId,
        model,
        modelId,
        promptTokens,
        completionTokens,
        cost: cost.toFixed(6),
        transactionId: result.id,
        parentTokenId: parentTokenId
      })

      return {
        success: true,
        transactionId: result.id,
        cost,
        promptTokens,
        completionTokens
      }
    } catch (error) {
      logger.error('Failed to log token consumption to Integram:', error.message)
      // Fallback: Log locally when Integram request fails
      logger.info('[TokenConsumptionLogger] LOCAL FALLBACK - Token consumption (Integram error)', {
        userId,
        model,
        promptTokens,
        completionTokens,
        cost: this.calculateCost(model, promptTokens, completionTokens).toFixed(6),
        timestamp: new Date().toISOString(),
        errorMessage: error.message
      })
      return {
        success: false,
        error: error.message,
        fallbackLogged: true
      }
    }
  }

  /**
   * Log consumption from polza.ai response
   */
  async logFromPolzaResponse(userId, model, usage) {
    if (!usage) {
      logger.debug('No usage data in response, skipping consumption logging')
      return { success: false, error: 'No usage data' }
    }

    return this.logConsumption({
      userId,
      model,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0
    })
  }
}

const tokenConsumptionLogger = new TokenConsumptionLogger()
export default tokenConsumptionLogger
