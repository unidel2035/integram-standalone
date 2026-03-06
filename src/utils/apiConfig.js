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
 *                   Returns empty string ONLY in dev mode on localhost to use Vite proxy
 */
export function getOrchestratorUrl() {
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'

  // In development mode on LOCALHOST, return empty string to use Vite proxy
  // This avoids CORS issues when running locally
  if (import.meta.env.DEV && isLocalhost) {
    // If explicitly set to use direct URL (e.g., for testing without proxy)
    if (import.meta.env.VITE_ORCHESTRATOR_DIRECT === 'true' && import.meta.env.VITE_ORCHESTRATOR_URL) {
      return import.meta.env.VITE_ORCHESTRATOR_URL
    }
    // Return empty string to use relative paths with Vite proxy
    return ''
  }

  // Check if VITE_ORCHESTRATOR_URL is explicitly set (for production builds)
  // Skip if it's set to "auto" - in that case, use hostname detection
  if (import.meta.env.VITE_ORCHESTRATOR_URL && import.meta.env.VITE_ORCHESTRATOR_URL !== 'auto') {
    return import.meta.env.VITE_ORCHESTRATOR_URL
  }

  // Auto-detect based on current hostname (Issue #6346)
  // This allows the same build to work on multiple domains
  // Works both in production builds AND dev mode on remote servers
  if (hostname === 'dev.drondoc.ru' || hostname === 'proxy.drondoc.ru' || hostname.endsWith('.drondoc.ru')) {
    return `${protocol}//${hostname}`
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
 * Get the base API URL (auto-detects if VITE_API_URL is set to "auto")
 * @returns {string} API base URL (e.g., https://dev.drondoc.ru/api or https://proxy.drondoc.ru/api)
 */
export function getBaseApiUrl() {
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'

  // Check if VITE_API_URL is explicitly set
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== 'auto') {
    return import.meta.env.VITE_API_URL
  }

  // In dev mode on LOCALHOST, use relative path for Vite proxy
  if (import.meta.env.DEV && isLocalhost) {
    return '/api'
  }

  // Auto-detect based on current hostname (Issue #6346)
  // Works both in production builds AND dev mode on remote servers
  if (hostname === 'dev.drondoc.ru' || hostname === 'proxy.drondoc.ru' || hostname.endsWith('.drondoc.ru')) {
    return `${protocol}//${hostname}/api`
  }

  // Default to production API
  return 'https://drondoc.ru/api'
}

/**
 * Get WebSocket URL based on current hostname
 * @returns {string} WebSocket URL (e.g., wss://drondoc.ru or wss://dev.drondoc.ru)
 */
export function getWebSocketUrl() {
  const hostname = window.location.hostname
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'

  // Check if VITE_WS_URL is explicitly set (skip if it's "auto")
  if (import.meta.env.VITE_WS_URL && import.meta.env.VITE_WS_URL !== 'auto') {
    return import.meta.env.VITE_WS_URL
  }

  // In development mode on LOCALHOST, use WebSocket on localhost backend
  if (import.meta.env.DEV && isLocalhost) {
    const host = import.meta.env.VITE_BACKEND_HOST || 'localhost'
    const port = import.meta.env.VITE_BACKEND_PORT || '8081'
    return `ws://${host}:${port}/ws`
  }

  // Auto-detect for drondoc.ru subdomains (Issue #6346)
  // Works both in production builds AND dev mode on remote servers
  // WebSocket server listens on /ws path (backend/monolith/src/index.js:1684)
  if (hostname === 'dev.drondoc.ru' || hostname === 'proxy.drondoc.ru' || hostname.endsWith('.drondoc.ru')) {
    return `${protocol}//${hostname}/ws`
  }

  return 'wss://drondoc.ru/ws'
}

/**
 * Check if running in development mode
 * @returns {boolean}
 */
export function isDevelopment() {
  return import.meta.env.DEV
}

/**
 * Check if running on dev environment (dev.drondoc.ru or proxy.drondoc.ru)
 * @returns {boolean}
 */
export function isDevEnvironment() {
  const hostname = window.location.hostname
  return hostname === 'dev.drondoc.ru' || hostname === 'proxy.drondoc.ru'
}

/**
 * Check if running on production environment (drondoc.ru)
 * @returns {boolean}
 */
export function isProductionEnvironment() {
  return window.location.hostname === 'drondoc.ru'
}

/**
 * Get current environment name
 * @returns {string} 'production', 'dev', 'proxy', or 'local'
 */
export function getEnvironmentName() {
  const hostname = window.location.hostname
  if (hostname === 'drondoc.ru') return 'production'
  if (hostname === 'dev.drondoc.ru') return 'dev'
  if (hostname === 'proxy.drondoc.ru') return 'proxy'
  return 'local'
}
