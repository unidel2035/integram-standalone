/**
 * JWT Interceptor for Axios
 *
 * Automatically handles JWT token refresh when access token expires (401).
 * Attaches access token to all authenticated requests.
 *
 * Features:
 * - Automatic token refresh on 401 responses
 * - Request queuing during token refresh
 * - Authorization header injection
 * - Automatic logout on refresh failure
 *
 * Issue #2786 - Phase 4: Frontend Integration
 */

import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { refreshToken as refreshAccessToken } from '@/services/authService'
import { logger } from '@/utils/logger'
import router from '@/router'

let isRefreshing = false
let failedQueue = []

/**
 * Process queued requests after token refresh
 */
const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })

  failedQueue = []
}

/**
 * Install JWT interceptor on axios instance
 *
 * @param {Object} axiosInstance - Axios instance to install interceptor on
 */
export function installJWTInterceptor(axiosInstance) {
  // Request interceptor - attach access token to all requests
  axiosInstance.interceptors.request.use(
    config => {
      const authStore = useAuthStore()

      // Skip if auth header already set
      if (config.headers['Authorization']) {
        return config
      }

      // Attach access token if available
      if (authStore.accessToken) {
        config.headers['Authorization'] = `Bearer ${authStore.accessToken}`
        logger.debug('JWT attached to request', {
          url: config.url,
          method: config.method
        })
      }

      return config
    },
    error => {
      logger.error('JWT request interceptor error', { error: error.message })
      return Promise.reject(error)
    }
  )

  // Response interceptor - handle 401 and token refresh
  axiosInstance.interceptors.response.use(
    response => response, // Pass through successful responses
    async error => {
      const originalRequest = error.config

      // Check if this is a 401 error and we haven't retried yet
      if (error.response?.status === 401 && !originalRequest._retry) {
        // Mark this request as retried to prevent infinite loops
        originalRequest._retry = true

        const authStore = useAuthStore()

        // If already refreshing, queue this request
        if (isRefreshing) {
          logger.debug('Queueing request during token refresh', {
            url: originalRequest.url
          })

          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          }).then(token => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`
            return axiosInstance(originalRequest)
          }).catch(err => {
            return Promise.reject(err)
          })
        }

        // Start token refresh process
        isRefreshing = true

        logger.info('Access token expired, attempting refresh')

        try {
          // Attempt to refresh token
          const refreshTokenValue = authStore.refreshToken

          if (!refreshTokenValue) {
            throw new Error('No refresh token available')
          }

          const result = await refreshAccessToken(refreshTokenValue)

          // Update store with new tokens
          authStore.accessToken = result.accessToken
          authStore.refreshToken = result.refreshToken || refreshTokenValue

          // Update localStorage
          localStorage.setItem('accessToken', result.accessToken)
          if (result.refreshToken) {
            localStorage.setItem('refreshToken', result.refreshToken)
          }

          logger.info('Access token refreshed successfully')

          // Update authorization header with new token
          originalRequest.headers['Authorization'] = `Bearer ${result.accessToken}`

          // Process all queued requests
          processQueue(null, result.accessToken)

          // Retry the original request
          return axiosInstance(originalRequest)
        } catch (refreshError) {
          // Token refresh failed - logout user
          logger.error('Token refresh failed, logging out user', {
            error: refreshError.message
          })

          processQueue(refreshError, null)

          // Clear auth state
          await authStore.logout()

          // Redirect to login page
          if (router.currentRoute.value.path !== '/login') {
            router.push('/login')
          }

          return Promise.reject(refreshError)
        } finally {
          isRefreshing = false
        }
      }

      // Not a 401 or already retried - reject with original error
      return Promise.reject(error)
    }
  )

  logger.info('JWT interceptor installed on axios instance')
}

/**
 * Install JWT interceptor on the default axios instance
 */
export function installDefaultJWTInterceptor() {
  installJWTInterceptor(axios)
  logger.info('JWT interceptor installed on default axios instance')
}

export default {
  installJWTInterceptor,
  installDefaultJWTInterceptor
}
