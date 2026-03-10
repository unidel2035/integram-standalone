/**
 * Integram Configuration Utility
 *
 * Provides centralized configuration for Integram API endpoints.
 * Issue #5405: Migration from dronedoc.ru/my to api.ai2o.ru/my
 *
 * @module integramConfig
 */

/**
 * Get Integram server URL from environment variables
 * Defaults to api.ai2o.ru (punycode: api.ai2o.ru)
 *
 * @returns {string} Integram server URL without protocol (e.g., 'api.ai2o.ru' or 'dronedoc.ru')
 */
export function getIntegramServerUrl() {
  const raw = import.meta.env.VITE_INTEGRAM_SERVER_URL || 'api.ai2o.ru'
  // Strip protocol if accidentally included in env (e.g. "https://api.ai2o.ru" → "api.ai2o.ru")
  return raw.replace(/^https?:\/\//, '')
}

/**
 * Get Integram database name from environment variables
 * Defaults to 'my'
 *
 * @returns {string} Integram database name
 */
export function getIntegramDatabase() {
  return import.meta.env.VITE_INTEGRAM_DATABASE || 'my'
}

/**
 * Get full Integram API base URL with protocol
 *
 * @returns {string} Full API URL with https:// prefix
 */
export function getIntegramApiBaseUrl() {
  const serverUrl = getIntegramServerUrl()
  // Handle localhost for development
  if (serverUrl.includes('localhost')) {
    return `http://${serverUrl}`
  }
  return `https://${serverUrl}`
}

/**
 * Get Integram configuration object
 *
 * @returns {Object} Configuration object with serverUrl, database, and apiBaseUrl
 */
export function getIntegramConfig() {
  return {
    serverUrl: getIntegramServerUrl(),
    database: getIntegramDatabase(),
    apiBaseUrl: getIntegramApiBaseUrl()
  }
}
