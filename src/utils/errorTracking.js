/**
 * Error tracking utility with Sentry integration
 * Provides centralized error handling and reporting
 */

import { logger } from './logger'

class ErrorTracker {
  constructor() {
    this.initialized = false
    this.sentryInstance = null
    this.userContext = null
    this.additionalContext = {}
  }

  /**
   * Initialize error tracking with Sentry
   * @param {Object} options - Configuration options
   */
  async init(options = {}) {
    if (this.initialized) {
      logger.warn('ErrorTracker already initialized')
      return
    }

    const {
      dsn = import.meta.env.VITE_SENTRY_DSN,
      environment = import.meta.env.MODE,
      enabled = import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true',
      sampleRate = parseFloat(import.meta.env.VITE_SENTRY_SAMPLE_RATE || '1.0'),
      tracesSampleRate = parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1')
    } = options

    if (!enabled) {
      logger.debug('Error tracking is disabled')
      return
    }

    if (!dsn) {
      logger.warn('Sentry DSN not configured, error tracking will not work')
      return
    }

    try {
      // Dynamic import to avoid loading Sentry if not needed
      const Sentry = await import('@sentry/vue')

      this.sentryInstance = Sentry

      Sentry.init({
        dsn,
        environment,
        sampleRate,
        tracesSampleRate,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
        ],
        // Performance monitoring
        trackComponents: true,
        // Error filtering
        beforeSend(event, hint) {
          // Filter out errors we don't want to track
          const error = hint.originalException

          // Don't track ResizeObserver errors (common browser quirk)
          if (error && error.message && error.message.includes('ResizeObserver')) {
            return null
          }

          // Don't track network errors in development
          if (environment === 'development' && error && error.message &&
              error.message.includes('NetworkError')) {
            return null
          }

          // Don't track third-party browser extension errors (Kaspersky, AdBlock, etc.)
          if (error && error.message) {
            const extensionPatterns = [
              'kaspersky-labs.com',
              'gc.kis.v2.scr',
              'FD126C42-EBFA-4E12-B309-BB3FDD723AC1',
              'FD126C42-EBFA',
              'ERR_NETWORK_IO_SUSPENDED',
              'chrome-extension://',
              'moz-extension://',
              'safari-extension://',
              'edge-extension://'
            ]

            if (extensionPatterns.some(pattern => error.message.includes(pattern))) {
              return null
            }
          }

          // Filter errors from extension scripts
          if (event.exception && event.exception.values) {
            for (const exception of event.exception.values) {
              if (exception.stacktrace && exception.stacktrace.frames) {
                const hasExtensionFrame = exception.stacktrace.frames.some(frame =>
                  frame.filename && (
                    frame.filename.includes('chrome-extension://') ||
                    frame.filename.includes('moz-extension://') ||
                    frame.filename.includes('safari-extension://') ||
                    frame.filename.includes('edge-extension://') ||
                    frame.filename.includes('kaspersky') ||
                    frame.filename.includes('gc.kis.v2.scr') ||
                    frame.filename.includes('FD126C42-EBFA')
                  )
                )
                if (hasExtensionFrame) {
                  return null
                }
              }
            }
          }

          return event
        },
        // Breadcrumbs
        beforeBreadcrumb(breadcrumb) {
          // Filter sensitive data from breadcrumbs
          if (breadcrumb.category === 'console') {
            return null // Don't send console logs as breadcrumbs
          }
          return breadcrumb
        }
      })

      this.initialized = true
      logger.info('Error tracking initialized', { environment })
    } catch (error) {
      logger.error('Failed to initialize error tracking', { error: error.message })
    }
  }

  /**
   * Set user context for error tracking
   * @param {Object} user - User information
   */
  setUser(user) {
    if (!this.initialized || !this.sentryInstance) return

    this.userContext = user

    this.sentryInstance.setUser({
      id: user.id,
      email: user.email,
      username: user.username
    })

    logger.debug('User context set for error tracking', { userId: user.id })
  }

  /**
   * Clear user context
   */
  clearUser() {
    if (!this.initialized || !this.sentryInstance) return

    this.userContext = null
    this.sentryInstance.setUser(null)
    logger.debug('User context cleared')
  }

  /**
   * Set additional context for errors
   * @param {string} key - Context key
   * @param {any} value - Context value
   */
  setContext(key, value) {
    if (!this.initialized || !this.sentryInstance) return

    this.additionalContext[key] = value
    this.sentryInstance.setContext(key, value)
  }

  /**
   * Capture an error
   * @param {Error} error - Error object
   * @param {Object} context - Additional context
   */
  captureError(error, context = {}) {
    // Always log the error
    logger.error(error.message, {
      error: error.stack,
      ...context
    })

    if (!this.initialized || !this.sentryInstance) return

    this.sentryInstance.captureException(error, {
      contexts: context,
      tags: {
        ...context.tags
      }
    })
  }

  /**
   * Capture a message
   * @param {string} message - Message to capture
   * @param {string} level - Severity level
   * @param {Object} context - Additional context
   */
  captureMessage(message, level = 'info', context = {}) {
    logger[level](message, context)

    if (!this.initialized || !this.sentryInstance) return

    this.sentryInstance.captureMessage(message, {
      level,
      contexts: context
    })
  }

  /**
   * Add breadcrumb for debugging
   * @param {Object} breadcrumb - Breadcrumb data
   */
  addBreadcrumb(breadcrumb) {
    if (!this.initialized || !this.sentryInstance) return

    this.sentryInstance.addBreadcrumb({
      timestamp: Date.now() / 1000,
      ...breadcrumb
    })
  }
}

// Create singleton instance
export const errorTracker = new ErrorTracker()

// Export class for testing
export { ErrorTracker }
