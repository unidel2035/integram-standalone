/**
 * API monitoring utility
 * Wraps API calls to track performance and errors
 */

import { logger } from './logger'
import { errorTracker } from './errorTracking'
import { performanceMonitor } from './performance'

/**
 * Wrap an API function with monitoring
 * @param {Function} apiFn - The API function to wrap
 * @param {string} name - Name for tracking
 * @returns {Function} Wrapped API function
 */
export function monitorApi(apiFn, name) {
  return async function(...args) {
    const startTime = performance.now()

    // Add breadcrumb
    errorTracker.addBreadcrumb({
      category: 'api',
      message: `API call: ${name}`,
      level: 'info',
      data: { args: args.slice(0, 2) } // Only log first 2 args to avoid sensitive data
    })

    try {
      const result = await apiFn(...args)
      const duration = performance.now() - startTime

      // Log successful API call
      logger.debug(`API success: ${name}`, {
        duration,
        status: 'success'
      })

      // Track performance
      performanceMonitor.trackMetric(`api.${name}`, duration, {
        status: 'success'
      })

      return result
    } catch (error) {
      const duration = performance.now() - startTime

      // Log API error
      logger.error(`API error: ${name}`, {
        duration,
        error: error.message,
        status: error.status || 'unknown'
      })

      // Track error
      errorTracker.captureError(error, {
        tags: {
          api_call: name,
          api_duration: duration,
          api_status: error.status
        }
      })

      // Track failed performance
      performanceMonitor.trackMetric(`api.${name}`, duration, {
        status: 'error',
        error: error.message
      })

      throw error
    }
  }
}

/**
 * Create a monitored version of the API function
 * @param {Function} createApiFn - Function that creates the API
 * @returns {Function} Monitored API function
 */
export function createMonitoredApi(createApiFn) {
  const api = createApiFn()

  return function monitoredApi(base, endpoint, options = {}) {
    const apiName = `${base}/${endpoint}`

    return monitorApi(
      () => api(base, endpoint, options),
      apiName
    )()
  }
}

/**
 * Monitor fetch requests globally
 */
export function monitorFetch() {
  if (typeof window === 'undefined' || !window.fetch) return

  const originalFetch = window.fetch

  window.fetch = async function(...args) {
    const url = args[0]
    const options = args[1] || {}
    const method = options.method || 'GET'

    const startTime = performance.now()

    // Add breadcrumb
    errorTracker.addBreadcrumb({
      category: 'fetch',
      message: `${method} ${url}`,
      level: 'info'
    })

    try {
      const response = await originalFetch.apply(this, args)
      const duration = performance.now() - startTime

      logger.debug(`Fetch ${method} ${url}`, {
        status: response.status,
        duration
      })

      performanceMonitor.trackMetric('fetch', duration, {
        url,
        method,
        status: response.status
      })

      return response
    } catch (error) {
      const duration = performance.now() - startTime

      logger.error(`Fetch error ${method} ${url}`, {
        error: error.message,
        duration
      })

      errorTracker.captureError(error, {
        tags: {
          fetch_url: url,
          fetch_method: method
        }
      })

      throw error
    }
  }
}
