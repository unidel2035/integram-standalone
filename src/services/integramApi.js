/**
 * Integram API Helper Function
 *
 * Issue #6570: Simple API helper similar to newApi from backend/legacy_integram/js/js.js
 *
 * This module provides a simplified interface for making Integram API calls,
 * automatically handling authentication headers and XSRF tokens.
 *
 * The function is designed to be similar to the legacy `newApi` function
 * used in backend/legacy_integram/ but works with the modern Vue.js frontend
 * and integramService/integramApiClient.
 *
 * @module services/integramApi
 *
 * @example
 * // Basic GET request
 * const result = await integramApi('GET', 'dict')
 * console.log(result.types) // List of types
 *
 * @example
 * // GET request with parameters
 * const objects = await integramApi('GET', 'object/996443', { LIMIT: 100 })
 *
 * @example
 * // POST request to create object
 * const newDoc = await integramApi('POST', '_m_new/996443', {
 *   t996443: 'Document Title',
 *   t996444: 'Document content here',
 *   up: 1
 * })
 *
 * @example
 * // POST request with FormData
 * const formData = new FormData()
 * formData.append('t996443', 'Document Title')
 * formData.append('up', '1')
 * const result = await integramApi('POST', '_m_new/996443', formData)
 */

import integramService from '@/services/integramApiClient'
import { logger } from '@/utils/logger'

/**
 * Make an Integram API request with automatic authentication handling
 *
 * This function wraps integramService.get() and integramService.post() methods,
 * providing a simpler interface similar to the legacy newApi function.
 *
 * Authentication is handled automatically:
 * - Token is read from integramService session
 * - XSRF token is automatically added to POST requests
 * - Headers are set based on authentication database (X-Authorization or 'my' header)
 *
 * @param {'GET'|'POST'} method - HTTP method ('GET' or 'POST')
 * @param {string} endpoint - API endpoint (e.g., 'dict', 'object/123', '_m_new/456')
 * @param {Object|FormData|URLSearchParams} [data={}] - Request data
 *   - For GET requests: query parameters object
 *   - For POST requests: form data (object, FormData, or URLSearchParams)
 * @param {Object} [options={}] - Additional options
 * @param {string} [options.database] - Override current database
 * @param {string} [options.server] - Override current server URL
 * @param {Function} [options.onSuccess] - Success callback (receives response data)
 * @param {Function} [options.onError] - Error callback (receives error object)
 * @returns {Promise<any>} Response data from API
 * @throws {Error} If not authenticated or request fails
 *
 * @example
 * // GET dictionary
 * const dict = await integramApi('GET', 'dict')
 *
 * @example
 * // GET objects with limit
 * const objects = await integramApi('GET', 'object/996443', { LIMIT: 50, F_U: 0 })
 *
 * @example
 * // Create new object
 * const newObj = await integramApi('POST', '_m_new/996443', {
 *   t996443: 'Test Document',
 *   t996444: 'Some content',
 *   up: 1
 * })
 *
 * @example
 * // With callbacks
 * await integramApi('GET', 'dict', {}, {
 *   onSuccess: (data) => console.log('Success:', data),
 *   onError: (err) => console.error('Error:', err)
 * })
 */
export async function integramApi(method, endpoint, data = {}, options = {}) {
  const { database, server, onSuccess, onError } = options

  // Validate method
  const normalizedMethod = method.toUpperCase()
  if (normalizedMethod !== 'GET' && normalizedMethod !== 'POST') {
    const error = new Error(`Invalid HTTP method: ${method}. Use 'GET' or 'POST'.`)
    if (onError) {
      onError(error)
    }
    throw error
  }

  // Check authentication
  if (!integramService.isAuthenticated()) {
    const error = new Error('Not authenticated. Please login first.')
    if (onError) {
      onError(error)
    }
    throw error
  }

  // Save original database/server if we're overriding
  const originalDatabase = integramService.getDatabase()
  const originalServer = integramService.getServer()

  try {
    // Apply overrides if provided
    if (server) {
      integramService.setServer(server)
    }
    if (database) {
      await integramService.setDatabase(database)
    }

    let result

    if (normalizedMethod === 'GET') {
      // For GET requests, data is treated as query parameters
      result = await integramService.get(endpoint, data)
    } else {
      // For POST requests
      // Convert data to plain object if it's FormData or URLSearchParams
      let postData = {}

      if (data instanceof FormData) {
        // Convert FormData to object
        for (const [key, value] of data.entries()) {
          postData[key] = value
        }
      } else if (data instanceof URLSearchParams) {
        // Convert URLSearchParams to object
        for (const [key, value] of data.entries()) {
          postData[key] = value
        }
      } else {
        postData = { ...data }
      }

      result = await integramService.post(endpoint, postData)
    }

    logger.debug('[integramApi] Response:', { method, endpoint, result })

    // Call success callback if provided
    if (onSuccess) {
      onSuccess(result)
    }

    return result

  } catch (error) {
    logger.error('[integramApi] Error:', { method, endpoint, error: error.message })

    // Call error callback if provided
    if (onError) {
      onError(error)
    }

    throw error

  } finally {
    // Restore original database/server if we overrode them
    if (server && originalServer !== server) {
      integramService.setServer(originalServer)
    }
    if (database && originalDatabase !== database) {
      await integramService.setDatabase(originalDatabase)
    }
  }
}

/**
 * Shorthand for GET requests
 *
 * @param {string} endpoint - API endpoint
 * @param {Object} [params={}] - Query parameters
 * @param {Object} [options={}] - Additional options
 * @returns {Promise<any>} Response data
 *
 * @example
 * const dict = await integramGet('dict')
 * const objects = await integramGet('object/996443', { LIMIT: 100 })
 */
export async function integramGet(endpoint, params = {}, options = {}) {
  return integramApi('GET', endpoint, params, options)
}

/**
 * Shorthand for POST requests
 *
 * @param {string} endpoint - API endpoint
 * @param {Object|FormData} [data={}] - Request body data
 * @param {Object} [options={}] - Additional options
 * @returns {Promise<any>} Response data
 *
 * @example
 * const newDoc = await integramPost('_m_new/996443', {
 *   t996443: 'New Document',
 *   up: 1
 * })
 */
export async function integramPost(endpoint, data = {}, options = {}) {
  return integramApi('POST', endpoint, data, options)
}

/**
 * Create a new object in Integram database
 *
 * This is a convenience wrapper around integramApi for creating objects.
 * It automatically formats the request according to Integram API requirements.
 *
 * @param {number} typeId - Type ID (table ID) to create object in
 * @param {string} value - Object name/value (main field)
 * @param {Object} [requisites={}] - Additional requisites { reqId: value }
 * @param {Object} [options={}] - Additional options
 * @param {number} [options.parentId=1] - Parent object ID (default: 1 = root)
 * @returns {Promise<Object>} Created object data with id
 *
 * @example
 * // Create a simple document
 * const doc = await integramCreate(996443, 'My Document', {
 *   996444: 'Document content here',
 *   996446: '<h1>HTML content</h1>'
 * })
 * console.log('Created document ID:', doc.id)
 */
export async function integramCreate(typeId, value, requisites = {}, options = {}) {
  const { parentId = 1, ...restOptions } = options

  // Build request data
  const data = {
    [`t${typeId}`]: value,
    up: parentId
  }

  // Add requisites with t prefix
  for (const [reqId, reqValue] of Object.entries(requisites)) {
    if (reqValue !== null && reqValue !== undefined) {
      // Add t prefix if not already present
      const key = String(reqId).startsWith('t') ? reqId : `t${reqId}`
      data[key] = reqValue
    }
  }

  return integramApi('POST', `_m_new/${typeId}`, data, restOptions)
}

/**
 * Update an existing object in Integram database
 *
 * Uses _m_set which does PARTIAL update (only updates provided fields).
 * This is safer than _m_save which replaces ALL fields.
 *
 * @param {number} objectId - Object ID to update
 * @param {Object} requisites - Requisites to update { reqId: value }
 * @param {Object} [options={}] - Additional options
 * @returns {Promise<Object>} Update result
 *
 * @example
 * // Update document content
 * await integramUpdate(998719, {
 *   996444: 'Updated content',
 *   996446: '<h1>New HTML content</h1>'
 * })
 */
export async function integramUpdate(objectId, requisites, options = {}) {
  const data = {}

  // Add requisites with t prefix
  for (const [reqId, reqValue] of Object.entries(requisites)) {
    if (reqValue !== null && reqValue !== undefined) {
      const key = String(reqId).startsWith('t') ? reqId : `t${reqId}`
      data[key] = reqValue
    }
  }

  return integramApi('POST', `_m_set/${objectId}`, data, options)
}

/**
 * Delete an object from Integram database
 *
 * @param {number} objectId - Object ID to delete
 * @param {Object} [options={}] - Additional options
 * @returns {Promise<Object>} Delete result
 *
 * @example
 * await integramDelete(998719)
 */
export async function integramDelete(objectId, options = {}) {
  return integramApi('POST', `_m_del/${objectId}`, {}, options)
}

/**
 * Get dictionary (list of all types/tables)
 *
 * @param {Object} [options={}] - Additional options
 * @returns {Promise<Object>} Dictionary data with types array
 *
 * @example
 * const dict = await integramDict()
 * console.log(dict.types) // Array of types
 */
export async function integramDict(options = {}) {
  return integramApi('GET', 'dict', {}, options)
}

/**
 * Get objects of a specific type
 *
 * @param {number} typeId - Type ID (table ID)
 * @param {Object} [params={}] - Query parameters (LIMIT, F_U, etc.)
 * @param {Object} [options={}] - Additional options
 * @returns {Promise<Object>} Objects data
 *
 * @example
 * // Get all documents (including hidden)
 * const docs = await integramObjects(996443, { LIMIT: 100, F_U: 0 })
 */
export async function integramObjects(typeId, params = {}, options = {}) {
  return integramApi('GET', `object/${typeId}`, params, options)
}

// Default export for convenience
export default integramApi
