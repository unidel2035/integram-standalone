/**
 * Integram Session Manager
 *
 * Issue #3784: Система авторизации с кэшированием токенов
 *
 * Централизованное управление сессиями Integram MCP:
 * 1. Получает токен базы 'my' ОДИН РАЗ
 * 2. Хранит токен локально в localStorage
 * 3. Переиспользует session ID для всех MCP запросов
 * 4. НЕТ повторных запросов авторизации
 *
 * Использование:
 * ```javascript
 * import { integramSessionManager } from '@/services/integramSessionManager'
 *
 * // Один раз при запуске приложения
 * await integramSessionManager.authenticateOnce('my')
 *
 * // Все последующие вызовы MCP инструментов
 * const result = await integramSessionManager.callMCPTool('integram_get_dictionary', {})
 * ```
 */

import { getIntegramApiBaseUrl } from '@/utils/integramConfig'

// Use empty base URL in dev to go through Vite proxy (avoids CORS with X-Session-ID header)
const MCP_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || ''
const STORAGE_KEY_SESSION = 'integram_mcp_session'
const STORAGE_KEY_AUTH = 'integram_session'

class IntegramSessionManager {
  constructor() {
    this.mcpSessionId = null
    this.loadSession()
  }

  /**
   * Загрузка MCP session ID из localStorage
   */
  loadSession() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SESSION)
      if (stored) {
        const data = JSON.parse(stored)
        this.mcpSessionId = data.sessionId
        console.log('[SessionManager] Loaded MCP session ID from localStorage:', this.mcpSessionId)
      }
    } catch (error) {
      console.error('[SessionManager] Failed to load session:', error)
    }
  }

  /**
   * Сохранение MCP session ID в localStorage
   * @param {string} sessionId - Session ID от MCP сервера
   */
  saveSession(sessionId) {
    this.mcpSessionId = sessionId
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
      sessionId,
      savedAt: new Date().toISOString()
    }))
    console.log('[SessionManager] Saved MCP session ID to localStorage:', sessionId)
  }

  /**
   * Получение текущего session ID
   * @returns {string|null} Session ID или null
   */
  getSessionId() {
    return this.mcpSessionId
  }

  /**
   * Проверка наличия действительного токена авторизации
   * @param {string} database - Имя базы данных
   * @returns {Object|null} Данные авторизации или null
   */
  getExistingAuth(database) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTH)
      if (!stored) {
        return null
      }

      const data = JSON.parse(stored)

      // Проверка соответствия базы данных и наличия токена
      if (data.database === database && data.token && data.xsrfToken) {
        console.log('[SessionManager] Found existing auth token for database:', database)
        return data
      }

      return null
    } catch (error) {
      console.error('[SessionManager] Failed to get existing auth:', error)
      return null
    }
  }

  /**
   * Авторизация в базе данных (ТОЛЬКО если нет действительного токена)
   *
   * Issue #3784: Шаг 1 - Получить токен базы my, хранить локально
   *
   * @param {string} database - Имя базы данных (по умолчанию 'my')
   * @param {string} serverURL - URL сервера (по умолчанию https://ai2o.ru)
   * @param {string} login - Логин (по умолчанию 'd')
   * @param {string} password - Пароль (по умолчанию 'd')
   * @returns {Promise<Object>} Результат авторизации
   */
  async authenticateOnce(database = 'my', serverURL = null, login = 'd', password = 'd') {
    // Use config if serverURL not provided
    if (!serverURL) {
      serverURL = getIntegramApiBaseUrl();
    }
    console.log('[SessionManager] authenticateOnce called for database:', database)

    // Проверка существующего токена И наличия MCP session
    const existingAuth = this.getExistingAuth(database)
    if (existingAuth && this.mcpSessionId) {
      console.log('[SessionManager] Using existing token from localStorage - NO new authentication')
      return {
        success: true,
        ...existingAuth,
        cached: true
      }
    }

    // Если нет MCP session ID, нужно переаутентифицироваться
    if (!this.mcpSessionId) {
      console.log('[SessionManager] No MCP session ID. Need to authenticate to get new session.')
    }

    console.log('[SessionManager] Authenticating with Integram API...')

    // Авторизация через MCP инструмент
    try {
      const response = await fetch(`${MCP_BASE_URL}/api/mcp/integram/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.mcpSessionId && { 'X-Session-ID': this.mcpSessionId })
        },
        body: JSON.stringify({
          toolName: 'integram_authenticate',
          arguments: {
            serverURL,
            database,
            login,
            password
          }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      // Сохранение MCP session ID из заголовка ответа
      const mcpSessionId = response.headers.get('X-Session-ID')
      if (mcpSessionId) {
        this.saveSession(mcpSessionId)
      }

      // Парсинг результата авторизации
      const authResult = JSON.parse(result.result.content[0].text)

      if (authResult.success) {
        // Сохранение токенов в localStorage
        const authData = {
          database,
          token: authResult.token,
          xsrfToken: authResult.xsrf,
          userId: authResult.userId,
          userName: authResult.userName,
          userRole: authResult.userRole,
          serverURL,
          authenticatedAt: new Date().toISOString()
        }

        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(authData))

        console.log('[SessionManager] Authentication successful. Token saved to localStorage.')

        return {
          success: true,
          ...authData,
          cached: false
        }
      } else {
        throw new Error(authResult.error || 'Authentication failed')
      }
    } catch (error) {
      console.error('[SessionManager] Authentication failed:', error)
      throw error
    }
  }

  /**
   * Вызов MCP инструмента с переиспользованием session
   *
   * Issue #3784: Шаг 2 - При запросах в базы Integram использовать токен из кэша
   *
   * @param {string} toolName - Название MCP инструмента
   * @param {Object} toolArgs - Аргументы для инструмента
   * @returns {Promise<Object>} Результат выполнения инструмента
   */
  async callMCPTool(toolName, toolArgs = {}) {
    console.log('[SessionManager] Calling MCP tool:', toolName, 'with session ID:', this.mcpSessionId)

    try {
      const response = await fetch(`${MCP_BASE_URL}/api/mcp/integram/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.mcpSessionId && { 'X-Session-ID': this.mcpSessionId })
        },
        body: JSON.stringify({
          toolName,
          arguments: toolArgs
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Обновление session ID если изменился
      const newSessionId = response.headers.get('X-Session-ID')
      if (newSessionId && newSessionId !== this.mcpSessionId) {
        console.log('[SessionManager] Session ID updated:', newSessionId)
        this.saveSession(newSessionId)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Tool execution failed')
      }

      return result
    } catch (error) {
      console.error('[SessionManager] MCP tool call failed:', error)
      throw error
    }
  }

  /**
   * Парсинг результата MCP инструмента
   * @param {Object} mcpResult - Результат от MCP сервера
   * @returns {Object} Распарсенный результат
   */
  parseToolResult(mcpResult) {
    try {
      if (mcpResult.result && mcpResult.result.content && mcpResult.result.content[0]) {
        return JSON.parse(mcpResult.result.content[0].text)
      }
      return mcpResult
    } catch (error) {
      console.error('[SessionManager] Failed to parse tool result:', error)
      return mcpResult
    }
  }

  /**
   * Вызов MCP инструмента с автоматическим парсингом результата
   * @param {string} toolName - Название инструмента
   * @param {Object} toolArgs - Аргументы
   * @returns {Promise<Object>} Распарсенный результат
   */
  async callAndParse(toolName, toolArgs = {}) {
    const result = await this.callMCPTool(toolName, toolArgs)
    return this.parseToolResult(result)
  }

  /**
   * Очистка сохраненной сессии и токенов
   */
  clearSession() {
    this.mcpSessionId = null
    localStorage.removeItem(STORAGE_KEY_SESSION)
    localStorage.removeItem(STORAGE_KEY_AUTH)
    console.log('[SessionManager] Session cleared')
  }

  /**
   * Проверка наличия активной сессии
   * @returns {boolean} true если есть session ID и токен авторизации
   */
  isSessionActive() {
    return !!this.mcpSessionId && !!this.getExistingAuth('my')
  }

  /**
   * Инициализация сессии с авторизацией
   * Удобный метод для быстрой настройки при запуске приложения
   *
   * @param {string} database - База данных (по умолчанию 'my')
   * @returns {Promise<Object>} Результат авторизации
   */
  async initialize(database = 'my') {
    console.log('[SessionManager] Initializing session for database:', database)

    try {
      const result = await this.authenticateOnce(database)

      if (result.success) {
        console.log('[SessionManager] Session initialized successfully')
        console.log('  - Database:', database)
        console.log('  - Cached token:', result.cached ? 'YES' : 'NO (new auth)')
        console.log('  - MCP Session ID:', this.mcpSessionId)
      }

      return result
    } catch (error) {
      console.error('[SessionManager] Failed to initialize session:', error)
      throw error
    }
  }
}

// Singleton instance
export const integramSessionManager = new IntegramSessionManager()

// Default export
export default integramSessionManager
