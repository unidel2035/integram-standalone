/**
 * Integram Configuration Utility (Backend)
 *
 * Provides centralized configuration for Integram API endpoints.
 * Issue #5405: Migration from dronedoc.ru/my to ai2o.ru/my
 *
 * @module integramConfig
 */

/**
 * Get Integram server URL from environment variables
 * Defaults to ai2o.ru (punycode: ai2o.ru)
 *
 * @returns {string} Integram server URL without protocol (e.g., 'ai2o.ru' or 'dronedoc.ru')
 */
export function getIntegramServerUrl() {
  const url = process.env.INTEGRAM_SERVER_URL || 'ai2o.ru'
  // Strip protocol if present (for backward compatibility)
  return url.replace(/^https?:\/\//, '')
}

/**
 * Get Integram database name from environment variables
 * Defaults to 'my'
 *
 * @returns {string} Integram database name
 */
export function getIntegramDatabase() {
  return process.env.INTEGRAM_DATABASE || 'my'
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
 * Get V2 API base URL (AI Data Layer)
 * @returns {string} V2 API URL (e.g., 'https://api.ai2o.ru/api/v2')
 */
export function getIntegramV2ApiUrl() {
  const override = process.env.INTEGRAM_V2_API_URL
  if (override) return override.replace(/\/$/, '')
  const serverUrl = getIntegramServerUrl()
  if (serverUrl.includes('localhost')) {
    return `http://${serverUrl}/api/v2`
  }
  return `https://api.${serverUrl}/api/v2`
}

/**
 * Get V2 API URL for a specific database
 * @param {string} [db] — database name (defaults to configured database)
 * @returns {string} e.g., 'https://api.ai2o.ru/api/v2/databases/kval'
 */
export function getIntegramV2DatabaseUrl(db) {
  return `${getIntegramV2ApiUrl()}/databases/${db || getIntegramDatabase()}`
}

/**
 * Get Integram configuration object
 *
 * @returns {Object} Configuration object with serverUrl, database, apiBaseUrl, v2ApiUrl
 */
export function getIntegramConfig() {
  return {
    serverUrl: getIntegramServerUrl(),
    database: getIntegramDatabase(),
    apiBaseUrl: getIntegramApiBaseUrl(),
    v2ApiUrl: getIntegramV2ApiUrl(),
    v2DatabaseUrl: getIntegramV2DatabaseUrl()
  }
}

/**
 * Get system credentials for Integram API operations
 *
 * @returns {Object} Object with username and password
 */
export function getIntegramSystemCredentials() {
  return {
    username: process.env.INTEGRAM_SYSTEM_USERNAME || 'd',
    password: process.env.INTEGRAM_SYSTEM_PASSWORD || 'd'
  }
}

/**
 * Get registration credentials for Integram API
 *
 * @returns {Object} Object with username and password
 */
export function getIntegramRegistrationCredentials() {
  return {
    username: process.env.INTEGRAM_REGISTRATION_USERNAME || 'api_reg',
    password: process.env.INTEGRAM_REGISTRATION_PASSWORD || 'ca84qkcx'
  }
}
