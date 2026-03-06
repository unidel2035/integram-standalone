import { logger } from '@/utils/logger'
import axios from 'axios'

// In-memory storage for menu config (for development/testing)
let menuConfigStorage = null

// In-memory cache for menu config with timestamp
let menuConfigCache = {
  data: null,
  timestamp: null,
  ttl: 60000 // Cache TTL: 60 seconds
}

// Debounce map for preventing rapid repeated calls
const pendingRequests = new Map()

// Create a dedicated axios instance for the orchestrator API
// This bypasses the database-specific prefix used by the main apiClient
//
// Uses environment variables for backend URL configuration
const getOrchestratorBaseURL = () => {
  // В режиме разработки используем относительный путь для Vite прокси
  // чтобы избежать CORS ошибок
  if (import.meta.env.DEV) {
    return '/api'
  }

  // If VITE_ORCHESTRATOR_URL is set, use it directly (for production)
  if (import.meta.env.VITE_ORCHESTRATOR_URL) {
    return `${import.meta.env.VITE_ORCHESTRATOR_URL}/api`
  }

  // Otherwise, construct from individual components
  const protocol = import.meta.env.VITE_BACKEND_PROTOCOL || 'https'
  const host = import.meta.env.VITE_BACKEND_HOST || 'drondoc.ru'
  const port = import.meta.env.VITE_BACKEND_PORT || '8081'

  return `${protocol}://${host}:${port}/api`
}

const orchestratorClient = axios.create({
  baseURL: getOrchestratorBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  // Treat 404 and 500 as valid responses to prevent console errors
  // The service layer will handle these gracefully
  validateStatus: function (status) {
    return status >= 200 && status < 300 || status === 404 || status === 500
  },
})

// Add auth token to requests if available
orchestratorClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = token
    }
    return config
  },
  error => Promise.reject(error)
)

const MenuConfigService = {
  /**
   * Get menu configuration with caching and debouncing
   * @returns {Promise} Menu configuration response
   */
  async getMenuConfig() {
    try {
      // Check if we have a valid cache entry
      const now = Date.now()
      if (menuConfigCache.data && menuConfigCache.timestamp) {
        const age = now - menuConfigCache.timestamp
        if (age < menuConfigCache.ttl) {
          logger.debug('Returning cached menu config', { age: age + 'ms' })
          return menuConfigCache.data
        }
      }

      // Check if there's already a pending request
      const pendingKey = 'menu-config'
      if (pendingRequests.has(pendingKey)) {
        logger.debug('Waiting for pending menu config request')
        return await pendingRequests.get(pendingKey)
      }

      // Create new request promise
      const requestPromise = (async () => {
        try {
          const response = await orchestratorClient.get('/menu/config')

          // Handle non-2xx responses (404, 500) that were allowed by validateStatus
          if (response.status === 404 || response.status === 500) {
            // Orchestrator not available, return stored config or null
            return menuConfigStorage ? { response: { config: menuConfigStorage } } : null
          }

          // Backend returns { success: true, response: { config: null } } when no config exists
          // Check if config is null and fall back to stored config
          if (response.data?.response?.config === null) {
            return menuConfigStorage ? { response: { config: menuConfigStorage } } : null
          }

          // Update cache
          menuConfigCache.data = response.data
          menuConfigCache.timestamp = Date.now()

          return response.data
        } finally {
          // Remove from pending requests
          pendingRequests.delete(pendingKey)
        }
      })()

      // Store pending request
      pendingRequests.set(pendingKey, requestPromise)

      return await requestPromise
    } catch (error) {
      // Remove from pending requests on error
      pendingRequests.delete('menu-config')

      // Handle network errors (orchestrator not running, CORS, etc.)
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        return menuConfigStorage ? { response: { config: menuConfigStorage } } : null
      }
      // For unexpected errors, log but don't throw to prevent app crash
      console.warn('Unexpected error fetching menu config:', error.message)
      return null
    }
  },

  /**
   * Save menu configuration
   * @param {string} config - JSON string of menu configuration
   * @returns {Promise} Save response
   */
  async saveMenuConfig(config) {
    try {
      const response = await orchestratorClient.post('/menu/config', { config })
      // Store in memory as backup
      menuConfigStorage = config
      return response.data
    } catch (error) {
      // If API is not available, store in localStorage as fallback
      if (error.response?.status === 404 || error.response?.status === 500 || error.code === 'ERR_NETWORK') {
        logger.debug('API not available, storing menu config in localStorage')
        localStorage.setItem('menuConfig', config)
        menuConfigStorage = config
        return { success: true, message: 'Saved to local storage' }
      }
      throw error
    }
  },

  /**
   * Load menu config from localStorage (fallback)
   * @returns {string|null} Menu configuration JSON string
   */
  getLocalMenuConfig() {
    return localStorage.getItem('menuConfig')
  },

  /**
   * Clear local menu config
   */
  clearLocalMenuConfig() {
    localStorage.removeItem('menuConfig')
    menuConfigStorage = null
  },

  /**
   * Clear menu config cache
   */
  clearCache() {
    menuConfigCache.data = null
    menuConfigCache.timestamp = null
    logger.debug('Menu config cache cleared')
  },

  /**
   * Set cache TTL (time-to-live) in milliseconds
   * @param {number} ttl - Cache TTL in ms
   */
  setCacheTTL(ttl) {
    menuConfigCache.ttl = ttl
    logger.debug('Menu config cache TTL updated:', ttl + 'ms')
  }
}

export default MenuConfigService
