/**
 * Global Error Handler Service
 * Centralized error handling for the application
 */

import {
  getUserFriendlyMessage,
  getErrorSuggestion,
  getErrorCategory,
  getErrorSeverity,
  createErrorLog,
  shouldShowToUser,
  getTranslatedMessage,
} from '@/utils/errorHandling'
import { useToast } from 'primevue/usetoast'

class ErrorHandlerService {
  constructor() {
    this._toast = null
    this._toastInitialized = false
    this.router = null
    this.i18n = null
    this.errorListeners = []
  }

  /**
   * Initialize the error handler with dependencies
   */
  init({ router, i18n }) {
    this.router = router
    this.i18n = i18n
  }

  /**
   * Lazy getter for toast - initializes on first use to avoid race condition
   */
  get toast() {
    // Return cached toast if already initialized
    if (this._toastInitialized) {
      return this._toast
    }

    // Try to initialize toast
    try {
      // Call useToast() - will throw if ToastService is not available
      this._toast = useToast()
      this._toastInitialized = true
    } catch (error) {
      // Toast not available yet, will retry next time
      this._toast = null
      this._toastInitialized = false
    }

    return this._toast
  }

  /**
   * Add error listener for custom handling
   */
  addListener(callback) {
    this.errorListeners.push(callback)
    return () => {
      this.errorListeners = this.errorListeners.filter(cb => cb !== callback)
    }
  }

  /**
   * Get translation function
   */
  getTranslator() {
    return this.i18n?.global?.t || ((key) => key)
  }

  /**
   * Handle any error
   */
  handle(error, context = {}) {
    // Create structured log
    const errorLog = createErrorLog(error, context)

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('[ErrorHandler]', errorLog)
    }

    // TODO: Send to error tracking service (Sentry, etc.)
    // this.sendToSentry(errorLog)

    // Notify listeners
    this.notifyListeners(error, errorLog)

    // Handle specific error types
    this.handleByCategory(error, errorLog)

    // Show user-friendly message if appropriate
    if (shouldShowToUser(error)) {
      this.showErrorToast(error)
    }
  }

  /**
   * Handle error based on category
   */
  handleByCategory(error, errorLog) {
    const category = errorLog.category
    const status = errorLog.status

    // Handle authentication errors
    // Issue #5xxx: Only clear session for critical auth endpoints, not for 3rd party API errors
    if (status === 401) {
      const url = error.config?.url || error.message || ''

      // Don't clear session for:
      // 1. Requests to integram.io/xsrf (3rd party session check)
      // 2. Requests to external APIs (app.integram.io, ai2o.ru, etc.)
      // 3. Non-critical endpoints (let axios2.js handle this)
      const isExternalApi = url.includes('integram.io') ||
                           url.includes('ai2o.ru') ||  // ai2o.ru (punycode)
                           url.includes('dronedoc.ru/my') ||
                           url.includes('/xsrf')

      // Only clear session for critical auth endpoints on OUR backend
      const isCriticalAuthEndpoint = (url.includes('/auth') || url.includes('/login')) &&
                                     !isExternalApi

      if (isCriticalAuthEndpoint) {
        console.warn('[ErrorHandler] 401 on critical auth endpoint - clearing session:', url)
        this.handleAuthenticationError(error)
      } else {
        console.warn('[ErrorHandler] 401 on external/non-critical endpoint - NOT clearing session:', url)
      }
      return
    }

    // Handle network errors
    if (category === 'network') {
      this.handleNetworkError(error)
      return
    }

    // Handle validation errors
    if (category === 'validation') {
      this.handleValidationError(error)
      return
    }
  }

  /**
   * Handle authentication errors
   * Only called for critical auth endpoints (see handleByCategory)
   */
  handleAuthenticationError(error) {
    // Clear auth data - including session_timestamp for consistency
    localStorage.removeItem('token')
    localStorage.removeItem('_xsrf')
    localStorage.removeItem('user')
    localStorage.removeItem('session_timestamp')  // Issue #5xxx: Also clear timestamp

    // Redirect to login if not already there
    if (this.router && this.router.currentRoute.value.path !== '/login') {
      this.router.push({
        name: 'Авторизация',
        query: { redirect: this.router.currentRoute.value.fullPath }
      })
    }
  }

  /**
   * Handle network errors
   */
  handleNetworkError(error) {
    const t = this.getTranslator()

    if (!navigator.onLine) {
      this.showErrorToast(error, {
        severity: 'warn',
        life: 10000,
      })
    }
  }

  /**
   * Handle validation errors
   */
  handleValidationError(error) {
    // Validation errors are usually handled inline in forms
    // But we can log them for debugging
    if (import.meta.env.DEV) {
      console.warn('[ValidationError]', error)
    }
  }

  /**
   * Show error toast notification
   */
  showErrorToast(error, options = {}) {
    if (!this.toast) return

    const t = this.getTranslator()
    const severity = options.severity || this.getSeverityForToast(error)
    const message = getUserFriendlyMessage(error, t)
    const suggestion = getErrorSuggestion(error, t)

    this.toast.add({
      severity,
      summary: getTranslatedMessage('errors.actions.error', t) || 'Ошибка',
      detail: options.detail || `${message} ${suggestion}`,
      life: options.life || 5000,
      ...options,
    })
  }

  /**
   * Show success toast
   */
  showSuccess(message, options = {}) {
    if (!this.toast) return

    this.toast.add({
      severity: 'success',
      summary: 'Успешно',
      detail: message,
      life: options.life || 3000,
      ...options,
    })
  }

  /**
   * Show info toast
   */
  showInfo(message, options = {}) {
    if (!this.toast) return

    this.toast.add({
      severity: 'info',
      summary: 'Информация',
      detail: message,
      life: options.life || 3000,
      ...options,
    })
  }

  /**
   * Show warning toast
   */
  showWarning(message, options = {}) {
    if (!this.toast) return

    this.toast.add({
      severity: 'warn',
      summary: 'Предупреждение',
      detail: message,
      life: options.life || 4000,
      ...options,
    })
  }

  /**
   * Get severity level for toast
   */
  getSeverityForToast(error) {
    const errorSeverity = getErrorSeverity(error)

    switch (errorSeverity) {
      case 'critical':
        return 'error'
      case 'error':
        return 'error'
      case 'warn':
        return 'warn'
      case 'info':
        return 'info'
      default:
        return 'error'
    }
  }

  /**
   * Notify all listeners
   */
  notifyListeners(error, errorLog) {
    this.errorListeners.forEach(callback => {
      try {
        callback(error, errorLog)
      } catch (err) {
        console.error('[ErrorHandler] Listener error:', err)
      }
    })
  }

  /**
   * Send error to tracking service
   */
  sendToSentry(errorLog) {
    // TODO: Implement Sentry integration
    // if (window.Sentry) {
    //   window.Sentry.captureException(errorLog)
    // }
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandlerService()
export default errorHandler
