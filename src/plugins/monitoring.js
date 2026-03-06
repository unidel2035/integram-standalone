/**
 * Vue monitoring plugin
 * Integrates error tracking, logging, performance monitoring, and analytics
 */

import { logger } from '@/utils/logger'
import { errorTracker } from '@/utils/errorTracking'
import { performanceMonitor } from '@/utils/performance'
import { analytics } from '@/utils/analytics'
import { errorReportingService } from '@/services/errorReportingService'

export default {
  async install(app, options = {}) {
    // Initialize all monitoring services
    await Promise.all([
      errorTracker.init(options.errorTracking),
      performanceMonitor.init(),
      analytics.init(options.analytics)
    ])

    // Set up global error handler for Vue
    app.config.errorHandler = (err, instance, info) => {
      // Log error
      logger.error('Vue component error', {
        error: err.message,
        stack: err.stack,
        info,
        component: instance?.$options?.name || instance?.$options?.__name || 'Unknown'
      })

      // Send to error tracker
      errorTracker.captureError(err, {
        tags: {
          errorInfo: info,
          component: instance?.$options?.name || instance?.$options?.__name
        }
      })

      // Report to GitHub issue system
      const error = err instanceof Error ? err : new Error(String(err))
      error.name = error.name || 'VueError'

      errorReportingService.reportError(error, {
        componentName: instance?.$options?.name || instance?.$options?.__name || 'Unknown',
        vueErrorInfo: info,
        eventType: 'vue-error'
      })

      // Re-throw in development for debugging
      if (import.meta.env.DEV) {
        console.error('[Vue Error Handler]', err)
      }
    }

    // Set up warning handler (development only)
    if (import.meta.env.DEV) {
      app.config.warnHandler = (msg, instance, trace) => {
        logger.warn('Vue warning', {
          message: msg,
          component: instance?.$options?.name || instance?.$options?.__name || 'Unknown',
          trace
        })

        console.warn('[Vue Warning]', msg)
      }
    }

    // Make monitoring utilities available globally
    app.config.globalProperties.$logger = logger
    app.config.globalProperties.$errorTracker = errorTracker
    app.config.globalProperties.$performance = performanceMonitor
    app.config.globalProperties.$analytics = analytics

    // Track route changes
    if (app.config.globalProperties.$router) {
      const router = app.config.globalProperties.$router

      router.beforeEach((to, from, next) => {
        // Track page view
        analytics.trackPageView(to.path, {
          page_title: to.meta.title || to.name,
          from_path: from.path
        })

        // Add breadcrumb for debugging
        errorTracker.addBreadcrumb({
          category: 'navigation',
          message: `Navigating from ${from.path} to ${to.path}`,
          level: 'info'
        })

        next()
      })

      router.onError((error) => {
        logger.error('Router error', { error: error.message })
        errorTracker.captureError(error, {
          tags: { type: 'router_error' }
        })
      })
    }

    // NOTE: Global error and unhandledrejection handlers are already registered in main.js
    // (lines 96-335 for 'error' and lines 281-335 for 'unhandledrejection')
    // These monitoring plugin handlers have been removed to prevent duplicate
    // error handling which was causing "Unhandled error event" issues (Issue #1850).
    // All global error handling is now centralized in main.js for better consistency.

    // Log successful initialization
    // Use DEBUG level if all monitoring services are disabled to reduce console noise
    const anyServiceEnabled = errorTracker.initialized || performanceMonitor.enabled || analytics.enabled
    const logLevel = anyServiceEnabled ? 'info' : 'debug'
    logger[logLevel]('Monitoring plugin initialized', {
      errorTracking: errorTracker.initialized,
      performance: performanceMonitor.enabled,
      analytics: analytics.enabled
    })
  }
}
