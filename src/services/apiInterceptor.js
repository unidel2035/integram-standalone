/**
 * API Interceptor
 *
 * This module provides axios interceptors that transform proxy-style API requests
 * to direct API calls and remap the responses to maintain compatibility with Vue components.
 *
 * It replaces the server-side proxy.php functionality with client-side request/response transformation.
 */

import apiService from './apiService'

/**
 * Install request and response interceptors
 * @param {Object} axiosInstance - Axios instance to intercept
 */
export function installApiInterceptors(axiosInstance) {
  // Request interceptor - transforms proxy-style endpoints to original API endpoints
  axiosInstance.interceptors.request.use(
    async (config) => {
      const url = config.url
      const method = config.method.toUpperCase()

      // Check if this is a proxy-style endpoint that needs transformation
      // If it starts with /tables, /auth, /user, /columns, /rows
      // then we need to handle it specially
      // Note: /report is NOT intercepted - it goes directly to the target server

      const proxyEndpoints = ['/tables', '/auth', '/user', '/columns', '/rows']
      const isProxyEndpoint = proxyEndpoints.some(endpoint => url.startsWith(endpoint))

      if (isProxyEndpoint) {
        // Mark this request as needing special handling
        // Issue #3872: Pass targetDatabase and params to apiService calls
        config.metadata = {
          isProxyEndpoint: true,
          originalUrl: url,
          originalMethod: method,
          targetDatabase: config.targetDatabase, // Pass through targetDatabase from original config
          queryParams: config.params || {} // Pass through query params (includes JSON_RICH, etc.)
        }
      }

      return config
    },
    (error) => {
      return Promise.reject(error)
    }
  )

  // Response interceptor - transforms responses from original API to expected format
  axiosInstance.interceptors.response.use(
    async (response) => {
      const config = response.config

      // Check if this was a proxy-style request that needs response transformation
      if (config.metadata?.isProxyEndpoint) {
        const url = config.metadata.originalUrl
        const method = config.metadata.originalMethod

        // Transform the response based on the endpoint
        try {
          const transformedResponse = await transformProxyResponse(url, method, response, config)
          if (transformedResponse) {
            response.data = transformedResponse
          }
        } catch (error) {
          console.error('Error transforming proxy response:', error)
          // Return original response if transformation fails
        }
      }

      return response
    },
    (error) => {
      return Promise.reject(error)
    }
  )
}

/**
 * Transform proxy-style response to expected format
 * @param {string} url - Original URL
 * @param {string} method - HTTP method
 * @param {Object} response - Axios response
 * @param {Object} config - Axios config
 * @returns {Object} Transformed response
 */
async function transformProxyResponse(url, method, response, config) {
  // Parse URL to extract parameters
  const urlParts = url.split('?')
  const path = urlParts[0]
  const queryString = urlParts[1] || ''
  const queryParams = {}

  // Issue #3872: First, get params from metadata (includes JSON_RICH, etc.)
  if (config.metadata?.queryParams) {
    Object.assign(queryParams, config.metadata.queryParams)
  }

  // Then merge with params from URL query string (for backwards compatibility)
  if (queryString) {
    new URLSearchParams(queryString).forEach((value, key) => {
      queryParams[key] = value
    })
  }

  // Match against proxy endpoints and transform accordingly
  // GET /tables -> returns list of tables
  if (method === 'GET' && path === '/tables') {
    return await apiService.getTables()
  }

  // GET /tables/{id} or /tables/{id}/page/{page} -> returns table data
  const tableMatch = path.match(/^\/tables\/([^/]+)(?:\/page\/(\d+))?(?:\/rows\/(\d+))?(?:\/nested\/(\d+))?/)
  if (method === 'GET' && tableMatch) {
    const [, tableId, page, rowId, nestedId] = tableMatch

    if (nestedId) {
      // GET /tables/{id}/nested/{nestedId}
      return await apiService.getNestedTable(tableId, nestedId, queryParams)
    } else if (rowId) {
      // GET /tables/{id}/rows/{rowId}
      return await apiService.getTableRow(tableId, rowId, queryParams)
    } else if (page) {
      // GET /tables/{id}/page/{page}
      return await apiService.getTable(tableId, queryParams, parseInt(page))
    } else {
      // GET /tables/{id}
      return await apiService.getTable(tableId, queryParams)
    }
  }

  // POST /tables/{tableId}/rows/{rowId}/multi/{columnId}
  const multiMatch = path.match(/^\/tables\/([^/]+)\/rows\/(\d+)\/multi\/(\d+)/)
  if (method === 'POST' && multiMatch) {
    const [, tableId, rowId, columnId] = multiMatch
    const { dirRowId } = config.data || {}
    const result = await apiService.addMultiDirValue(tableId, rowId, columnId, dirRowId)
    return {
      status: 200,
      response: result
    }
  }

  // DELETE /multi/{linkId}
  const deleteMultiMatch = path.match(/^\/multi\/(\d+)/)
  if (method === 'DELETE' && deleteMultiMatch) {
    const [, linkId] = deleteMultiMatch
    const result = await apiService.deleteMultiDirValue(linkId)
    return {
      status: 200,
      response: result
    }
  }

  // POST /tables/update
  if (method === 'POST' && path === '/tables/update') {
    const dirTableId = queryParams.dir || null
    const result = await apiService.updateTable(config.data, dirTableId)
    return {
      status: 200,
      response: result
    }
  }

  // POST /tables/{id}/rows
  if (method === 'POST' && path.match(/^\/tables\/([^/]+)\/rows$/)) {
    const tableMatch = path.match(/^\/tables\/([^/]+)\/rows$/)
    const [, tableId] = tableMatch
    const result = await apiService.createRow(tableId, config.data)
    return {
      status: 200,
      response: result
    }
  }

  // POST /tables/{id}/rows/update
  if (method === 'POST' && path.match(/^\/tables\/([^/]+)\/rows\/update$/)) {
    const tableMatch = path.match(/^\/tables\/([^/]+)\/rows\/update$/)
    const [, tableId] = tableMatch
    const dirTableId = queryParams.dir || null
    const result = await apiService.createAndUpdateRow(tableId, config.data, dirTableId)
    return {
      status: 200,
      response: result
    }
  }

  // DELETE /rows
  if (method === 'DELETE' && path === '/rows') {
    const { rowId } = config.data || {}
    const result = await apiService.deleteRow(rowId)
    return {
      status: 200,
      response: result
    }
  }

  // PUT /columns
  if (method === 'PUT' && path === '/columns') {
    const { headerId, termId, value, type } = config.data || {}
    const result = await apiService.updateColumn(headerId, termId, value, type)
    return {
      status: 200,
      response: result
    }
  }

  // DELETE /columns
  if (method === 'DELETE' && path === '/columns') {
    const { id, termId } = config.data || {}
    const result = await apiService.deleteColumn(id, termId)
    return {
      status: 200,
      response: result
    }
  }

  // POST /auth
  if (method === 'POST' && path === '/auth') {
    const formData = config.data
    let login, password
    if (formData instanceof FormData) {
      login = formData.get('login')
      password = formData.get('password')
    } else if (typeof formData === 'string') {
      const params = new URLSearchParams(formData)
      login = params.get('login')
      password = params.get('password')
    } else {
      login = formData.login
      password = formData.password
    }
    return await apiService.auth(login, password)
  }

  // GET /user
  if (method === 'GET' && path === '/user') {
    return await apiService.getUser()
  }

  // Note: /report endpoints are NOT intercepted - they go directly to target server
  // This avoids duplicate requests and format mismatch issues

  // If we get here, this is a proxy endpoint we don't recognize
  // Return the original response
  return null
}

export default {
  installApiInterceptors
}
