/**
 * LEGACY INTEGRAM API CLIENT
 *
 * ⚠️ WARNING: This axios client is ONLY for legacy Integram backend API calls.
 *
 * Use this client ONLY for:
 * - Traditional CRUD operations (fields, harvests, observations, etc.)
 * - Endpoints served by https://api.ai2o.ru/A2025
 *
 * DO NOT use this client for:
 * - Monolithic backend APIs (ai-tokens, youtube, recording, etc.)
 * - For those, use @/orchestratorAxios instead
 *
 * Base URL: https://api.ai2o.ru/A2025 (hardcoded)
 */

import axios from 'axios'

let activeRequests = 0
const loaders = new Map()

export const registerLoaderCallbacks = (show, hide, loaderId) => {
  loaders.set(loaderId, { show, hide })
  return () => loaders.delete(loaderId)
}

const updateLoaders = isLoading => {
  loaders.forEach(loader => {
    isLoading ? loader.show() : loader.hide()
  })
}

const apiClient = axios.create({
  baseURL: 'https://api.ai2o.ru/A2025',
  timeout: 5000000,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
})

// Helper function to get cookie value by name (Issue #4025)
function getCookie(name) {
  const matches = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + "=([^;]*)"));
  return matches ? decodeURIComponent(matches[1]) : undefined;
}

/**
 * Get token and authentication database
 * Issue #3811 (simplified): Use single token source
 * Issue #4025: Use 'my' cookie token for cross-database requests
 *
 * Simplified token storage system:
 * 1. Single 'token' in localStorage for all databases ('my' and others)
 * 2. authDb determined from localStorage 'db' key
 * 3. No more integram_session or my_token checks (those are only for /integram)
 * 4. Issue #4025: For 'my' database, also check 'my' cookie (set by PHP backend)
 */
function getTokenForCurrentDb() {
  const token = localStorage.getItem('token')
  const authDb = localStorage.getItem('db') || 'my'
  // Issue #4025: Get 'my' cookie token for cross-database requests
  const myCookieToken = getCookie('my')
  return { token, db: authDb, myCookieToken }
}

// Issue #3811 (production fix): Removed async to ensure headers are set correctly in production
apiClient.interceptors.request.use(
  config => {
    // Get token and authentication database
    // Issue #4025: Also get 'my' cookie token for cross-database requests
    const { token, db: authDb, myCookieToken } = getTokenForCurrentDb()

    // Issue #3811 (simplified): Authorization header selection
    // Issue #4025: Use 'my' cookie token for cross-database requests
    //
    // Logic:
    // 1. If logged in to 'my':
    //    - Requests to /my/ → X-Authorization header
    //    - Requests to other databases (e.g., /a2025/) → 'my' header with 'my' cookie token
    // 2. If logged in to other database (e.g., a2025):
    //    - All requests → X-Authorization header
    // Extract target database from request URL
    // baseURL is 'https://api.ai2o.ru/A2025' - extract 'A2025'
    const requestDb = config.baseURL?.match(/\/([^/]+)\/?$/)?.[1]?.toLowerCase() || authDb

    if (authDb === 'my') {
      // Logged in to 'my' database
      if (requestDb === 'my') {
        // Request to /my/ → X-Authorization
        if (token) {
          config.headers['X-Authorization'] = token
        }
      } else {
        // Request to other database → 'my' header (kernel routing)
        // Issue #4025: Use 'my' cookie token (set by PHP), fallback to localStorage token
        const tokenForMyHeader = myCookieToken || token
        if (tokenForMyHeader) {
          config.headers['my'] = tokenForMyHeader
        }
      }
    } else if (token) {
      // Logged in to specific database (not 'my') → always X-Authorization
      config.headers['X-Authorization'] = token
    }

    activeRequests++
    if (activeRequests === 1) updateLoaders(true)
    return config
  },
  error => {
    activeRequests = Math.max(0, activeRequests - 1)
    if (activeRequests === 0) updateLoaders(false)

    // Handle request error
    if (window.errorHandler) {
      window.errorHandler.handle(error, { source: 'axios-request' })
    }

    return Promise.reject(error)
  },
)

apiClient.interceptors.response.use(
  response => {
    activeRequests = Math.max(0, activeRequests - 1)
    if (activeRequests === 0) updateLoaders(false)
    return response
  },
  error => {
    activeRequests = Math.max(0, activeRequests - 1)
    if (activeRequests === 0) updateLoaders(false)

    // Handle response error
    if (window.errorHandler) {
      window.errorHandler.handle(error, {
        source: 'axios-response',
        url: error.config?.url,
        method: error.config?.method
      })
    }

    return Promise.reject(error)
  },
)

export default apiClient
