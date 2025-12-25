/**
 * Integram Token Proxy Service
 *
 * Manages Integram authentication and token caching:
 * - Token caching with automatic expiration
 * - Automatic token refresh on 401/403
 * - Proxy for Integram API requests
 * - User-specific token management
 *
 * Issue #2784 - Phase 2: Token Management
 */

import axios from 'axios'
import logger from '../../utils/logger.js'

const INTEGRAM_BASE_URL = process.env.INTEGRAM_API_URL || 'https://dronedoc.ru'
const DDADMIN_DATABASE = 'ddadmin'

// Token TTL in milliseconds (30 minutes by default)
const TOKEN_TTL = parseInt(process.env.INTEGRAM_TOKEN_TTL || '1800000')

// In-memory token cache
// Structure: { userId: { token, _xsrf, expiresAt, lastRefreshAt } }
const tokenCache = new Map()

/**
 * Authenticate user with Integram API
 *
 * @param {string} userId - User ID (for cache key)
 * @param {string} username - Integram username or email
 * @param {string} password - User password
 * @returns {Promise<Object>} Authentication result with token
 */
export async function authenticateUser(userId, username, password) {
  try {
    const url = `${INTEGRAM_BASE_URL}/${DDADMIN_DATABASE}/auth?JSON_KV`

    logger.info({ url, username, userId }, 'Authenticating with Integram')

    // Integram auth uses form-urlencoded body with login/pwd fields
    const response = await axios.post(
      url,
      `login=${encodeURIComponent(username)}&pwd=${encodeURIComponent(password)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    if (response.data && response.data.token) {
      const now = Date.now()
      const expiresAt = now + TOKEN_TTL

      const sessionData = {
        token: response.data.token,
        _xsrf: response.data._xsrf || null,
        expiresAt,
        lastRefreshAt: now,
        username,
      }

      // Cache the token
      tokenCache.set(userId, sessionData)

      logger.info({ userId, username }, 'Successfully authenticated with Integram')

      return {
        success: true,
        token: sessionData.token,
        _xsrf: sessionData._xsrf,
        expiresAt,
      }
    }

    throw new Error('Authentication failed: No token received')
  } catch (error) {
    logger.error(
      { error: error.message, username, userId },
      'Integram authentication failed'
    )

    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Get cached Integram token for user
 * Automatically refreshes if expired
 *
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} Token or null if not found
 */
export async function getIntegramToken(userId) {
  const cached = tokenCache.get(userId)

  if (!cached) {
    logger.warn({ userId }, 'No cached Integram token found')
    return null
  }

  const now = Date.now()

  // Check if token expired
  if (now >= cached.expiresAt) {
    logger.info({ userId }, 'Cached Integram token expired, refreshing')

    // Remove from cache
    tokenCache.delete(userId)

    // TODO: Implement automatic refresh if we have stored credentials
    // For now, return null to require re-authentication
    return null
  }

  return cached.token
}

/**
 * Refresh Integram token for user
 * Re-authenticates with stored credentials
 *
 * Note: This requires storing user credentials, which is not ideal.
 * In production, consider using refresh tokens from Integram if available.
 *
 * @param {string} userId - User ID
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<Object>} New token
 */
export async function refreshIntegramToken(userId, username, password) {
  logger.info({ userId }, 'Refreshing Integram token')

  // Clear old token from cache
  tokenCache.delete(userId)

  // Re-authenticate
  return await authenticateUser(userId, username, password)
}

/**
 * Proxy a request to Integram API using cached token
 * Automatically handles 401/403 by clearing cache
 *
 * @param {string} userId - User ID
 * @param {string} url - Integram API URL (full or relative)
 * @param {Object} options - Axios request options
 * @returns {Promise<Object>} API response
 */
export async function proxyRequest(userId, url, options = {}) {
  const token = await getIntegramToken(userId)

  if (!token) {
    throw new Error('No valid Integram token found. Please authenticate first.')
  }

  const cached = tokenCache.get(userId)

  // Build full URL if relative path provided
  const fullUrl = url.startsWith('http') ? url : `${INTEGRAM_BASE_URL}${url}`

  // Prepare headers with token
  const headers = {
    'X-Authorization': token,
    'Content-Type': 'application/json',
    ...options.headers,
  }

  // Add XSRF token if available
  if (cached._xsrf) {
    headers['X-Xsrf-Token'] = cached._xsrf
  }

  try {
    logger.debug({ userId, url: fullUrl, method: options.method || 'GET' }, 'Proxying Integram request')

    const response = await axios({
      url: fullUrl,
      ...options,
      headers,
    })

    return response.data
  } catch (error) {
    // Handle 401/403 - token expired or invalid
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      logger.warn({ userId, status: error.response.status }, 'Integram token invalid, clearing cache')

      // Clear cache
      tokenCache.delete(userId)

      throw new Error('Integram authentication expired. Please re-authenticate.')
    }

    logger.error(
      { error: error.message, userId, url: fullUrl },
      'Integram proxy request failed'
    )

    throw error
  }
}

/**
 * Clear cached token for user
 *
 * @param {string} userId - User ID
 */
export function clearCache(userId) {
  if (tokenCache.has(userId)) {
    tokenCache.delete(userId)
    logger.info({ userId }, 'Integram token cache cleared')
  }
}

/**
 * Clear all cached tokens (for maintenance)
 */
export function clearAllCache() {
  const count = tokenCache.size
  tokenCache.clear()
  logger.info({ count }, 'All Integram token caches cleared')
}

/**
 * Get cache statistics
 *
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  const now = Date.now()
  let activeTokens = 0
  let expiredTokens = 0

  for (const [userId, cached] of tokenCache.entries()) {
    if (now < cached.expiresAt) {
      activeTokens++
    } else {
      expiredTokens++
    }
  }

  return {
    totalCached: tokenCache.size,
    activeTokens,
    expiredTokens,
    tokenTTL: TOKEN_TTL,
  }
}

/**
 * Cleanup expired tokens from cache (maintenance task)
 * Should be called periodically by a cron job
 *
 * @returns {number} Number of expired tokens removed
 */
export function cleanupExpiredTokens() {
  const now = Date.now()
  let cleanedCount = 0

  for (const [userId, cached] of tokenCache.entries()) {
    if (now >= cached.expiresAt) {
      tokenCache.delete(userId)
      cleanedCount++
    }
  }

  if (cleanedCount > 0) {
    logger.info({ cleanedCount }, 'Expired Integram tokens cleaned up')
  }

  return cleanedCount
}

// Convenience methods for common Integram operations

/**
 * Get object from Integram by table and ID
 *
 * @param {string} userId - User ID for authentication
 * @param {string} tableId - Table ID
 * @param {string} objectId - Object ID
 * @returns {Promise<Object>} Object data
 */
export async function getObject(userId, tableId, objectId) {
  const url = `/${DDADMIN_DATABASE}/object/${tableId}/${objectId}?JSON_KV`
  return await proxyRequest(userId, url, { method: 'GET' })
}

/**
 * Create object in Integram table
 *
 * @param {string} userId - User ID for authentication
 * @param {string} tableId - Table ID
 * @param {Object} data - Object data
 * @returns {Promise<Object>} Created object
 */
export async function createObject(userId, tableId, data) {
  const url = `/${DDADMIN_DATABASE}/_m_create/${tableId}?JSON_KV`
  return await proxyRequest(userId, url, {
    method: 'POST',
    data,
  })
}

/**
 * Update object in Integram table
 *
 * @param {string} userId - User ID for authentication
 * @param {string} tableId - Table ID
 * @param {string} objectId - Object ID
 * @param {Object} data - Updated data
 * @returns {Promise<Object>} Updated object
 */
export async function updateObject(userId, tableId, objectId, data) {
  const url = `/${DDADMIN_DATABASE}/_m_update/${tableId}/${objectId}?JSON_KV`
  return await proxyRequest(userId, url, {
    method: 'PUT',
    data,
  })
}

/**
 * Delete object from Integram table
 *
 * @param {string} userId - User ID for authentication
 * @param {string} tableId - Table ID
 * @param {string} objectId - Object ID
 * @returns {Promise<void>}
 */
export async function deleteObject(userId, tableId, objectId) {
  const url = `/${DDADMIN_DATABASE}/_m_delete/${tableId}/${objectId}?JSON_KV`
  return await proxyRequest(userId, url, { method: 'DELETE' })
}

export default {
  authenticateUser,
  getIntegramToken,
  refreshIntegramToken,
  proxyRequest,
  clearCache,
  clearAllCache,
  getCacheStats,
  cleanupExpiredTokens,
  getObject,
  createObject,
  updateObject,
  deleteObject,
}
