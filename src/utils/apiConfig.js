/**
 * API Configuration Utility
 *
 * Provides dynamic API URL configuration based on the current environment.
 * Automatically detects whether running on production (drondoc.ru) or dev (dev.drondoc.ru)
 * and returns the appropriate backend orchestrator URL.
 */

/**
 * Get the orchestrator base URL based on current hostname
 * @returns {string} The orchestrator URL (e.g., https://drondoc.ru or https://dev.drondoc.ru)
 *                   Returns empty string in dev mode to use Vite proxy
 */
export function getOrchestratorUrl() {
  // In development mode, return empty string to use Vite proxy
  // This avoids CORS issues when running locally
  if (import.meta.env.DEV) {
    // If explicitly set to use direct URL (e.g., for testing without proxy)
    if (import.meta.env.VITE_ORCHESTRATOR_DIRECT === 'true' && import.meta.env.VITE_ORCHESTRATOR_URL) {
      return import.meta.env.VITE_ORCHESTRATOR_URL
    }
    // Return empty string to use relative paths with Vite proxy
    return ''
  }

  // Check if VITE_ORCHESTRATOR_URL is explicitly set (for production builds)
  if (import.meta.env.VITE_ORCHESTRATOR_URL) {
    return import.meta.env.VITE_ORCHESTRATOR_URL
  }

  // In production, detect from current hostname
  const hostname = window.location.hostname

  // If running on dev.drondoc.ru, use dev orchestrator
  if (hostname === 'dev.drondoc.ru') {
    return 'https://dev.drondoc.ru'
  }

  // Default to production orchestrator
  return 'https://drondoc.ru'
}

/**
 * Get the API base URL for a specific API path
 * @param {string} apiPath - The API path (e.g., '/api/youtube', '/api/telegram')
 * @returns {string} Full API URL
 */
export function getApiUrl(apiPath = '') {
  const baseUrl = getOrchestratorUrl()

  // Remove leading slash from apiPath if present to avoid double slashes
  const normalizedPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`

  return `${baseUrl}${normalizedPath}`
}

/**
 * Get WebSocket URL based on current hostname
 * @returns {string} WebSocket URL (e.g., wss://drondoc.ru or wss://dev.drondoc.ru)
 */
export function getWebSocketUrl() {
  // Check if VITE_WS_URL is explicitly set
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL
  }

  // In development mode, use WebSocket on localhost
  if (import.meta.env.DEV) {
    const host = import.meta.env.VITE_BACKEND_HOST || 'localhost'
    const port = import.meta.env.VITE_BACKEND_PORT || '8081'
    return `ws://${host}:${port}`
  }

  // In production, use secure WebSocket and detect hostname
  const hostname = window.location.hostname

  if (hostname === 'dev.drondoc.ru') {
    return 'wss://dev.drondoc.ru'
  }

  return 'wss://drondoc.ru'
}

/**
 * Check if running in development mode
 * @returns {boolean}
 */
export function isDevelopment() {
  return import.meta.env.DEV
}

/**
 * Check if running on dev environment (dev.drondoc.ru)
 * @returns {boolean}
 */
export function isDevEnvironment() {
  return window.location.hostname === 'dev.drondoc.ru'
}

/**
 * Check if running on production environment (drondoc.ru)
 * @returns {boolean}
 */
export function isProductionEnvironment() {
  return window.location.hostname === 'drondoc.ru'
}
