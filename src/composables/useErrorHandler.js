/**
 * Composable for comprehensive error handling in Vue components
 * Integrates with existing error handling infrastructure
 *
 * Usage:
 * ```vue
 * <script setup>
 * import { useErrorHandler } from '@/composables/useErrorHandler'
 *
 * const { handleError, isError, error, clearError, executeAsync } = useErrorHandler()
 *
 * const loadData = async () => {
 *   await executeAsync(
 *     async () => {
 *       const data = await api.fetchData()
 *       return data
 *     },
 *     'loadData in MyComponent'
 *   )
 * }
 * </script>
 *
 * <template>
 *   <div v-if="isError">
 *     <Message severity="error">Error occurred</Message>
 *   </div>
 * </template>
 * ```
 */

import { ref, computed } from 'vue'
import { errorHandler } from '@/service/errorHandler'
import {
  getUserFriendlyMessage,
  getErrorSuggestion,
  isRetryableError,
  createErrorLog,
  getErrorCategory
} from '@/utils/errorHandling'
import { useRetry } from '@/composables/useErrorRecovery'

/**
 * Main error handler composable
 */
export function useErrorHandler(options = {}) {
  const {
    showToast = true,
    context = '',
    onError = null,
    autoRetry = false,
    retryOptions = {}
  } = options

  const error = ref(null)
  const isError = ref(false)
  const lastError = ref(null)
  const errorCount = ref(0)

  // Setup retry mechanism if enabled
  const { executeWithRetry, isRetrying, attempt } = autoRetry
    ? useRetry(retryOptions)
    : { executeWithRetry: null, isRetrying: ref(false), attempt: ref(0) }

  /**
   * Handle error
   */
  const handleError = (err, customContext = '') => {
    error.value = err
    isError.value = true
    lastError.value = err
    errorCount.value++

    const fullContext = customContext || context

    // Log error
    console.error(`[Error] ${fullContext}:`, err)

    // Call custom error handler if provided
    if (onError) {
      try {
        onError(err, fullContext)
      } catch (handlerError) {
        console.error('[ErrorHandler] Custom handler failed:', handlerError)
      }
    }

    // Use global error handler
    if (showToast) {
      errorHandler.handle(err, { context: fullContext })
    }

    return err
  }

  /**
   * Clear error state
   */
  const clearError = () => {
    error.value = null
    isError.value = false
  }

  /**
   * Reset all error state including count
   */
  const reset = () => {
    clearError()
    lastError.value = null
    errorCount.value = 0
  }

  /**
   * Execute async function with error handling
   */
  const executeAsync = async (fn, customContext = '') => {
    clearError()

    try {
      const result = autoRetry && isRetryableError(error.value)
        ? await executeWithRetry(fn)
        : await fn()

      return result
    } catch (err) {
      handleError(err, customContext)
      throw err
    }
  }

  /**
   * Execute async function with error handling (no throw)
   */
  const executeSafe = async (fn, customContext = '', defaultValue = null) => {
    try {
      return await executeAsync(fn, customContext)
    } catch (err) {
      // Error already handled by executeAsync
      return defaultValue
    }
  }

  /**
   * Get user-friendly error message
   */
  const errorMessage = computed(() => {
    if (!error.value) return ''
    return getUserFriendlyMessage(error.value)
  })

  /**
   * Get error suggestion
   */
  const errorSuggestion = computed(() => {
    if (!error.value) return ''
    return getErrorSuggestion(error.value)
  })

  /**
   * Check if error is retryable
   */
  const canRetry = computed(() => {
    if (!error.value) return false
    return isRetryableError(error.value)
  })

  /**
   * Get error category
   */
  const errorCategory = computed(() => {
    if (!error.value) return null
    return getErrorCategory(error.value)
  })

  /**
   * Create error log
   */
  const getErrorLog = () => {
    if (!error.value) return null
    return createErrorLog(error.value, { context })
  }

  return {
    // State
    error,
    isError,
    lastError,
    errorCount,
    isRetrying,
    attempt,

    // Computed
    errorMessage,
    errorSuggestion,
    canRetry,
    errorCategory,

    // Methods
    handleError,
    clearError,
    reset,
    executeAsync,
    executeSafe,
    getErrorLog
  }
}

/**
 * Composable for API error handling
 * Specifically designed for API calls
 */
export function useApiErrorHandler(options = {}) {
  const {
    showToast = true,
    context = 'API call',
    onError = null
  } = options

  const handler = useErrorHandler({ showToast, context, onError })

  /**
   * Execute API call with error handling
   */
  const executeApiCall = async (apiCall, customContext = '') => {
    return handler.executeAsync(apiCall, customContext || context)
  }

  /**
   * Execute API call safely (no throw)
   */
  const executeApiCallSafe = async (apiCall, customContext = '', defaultValue = null) => {
    return handler.executeSafe(apiCall, customContext || context, defaultValue)
  }

  /**
   * Check if error is authentication error
   */
  const isAuthError = computed(() => {
    if (!handler.error.value) return false
    const status = handler.error.value?.response?.status || handler.error.value?.status
    return status === 401 || status === 403
  })

  /**
   * Check if error is network error
   */
  const isNetworkError = computed(() => {
    return handler.errorCategory.value === 'network'
  })

  /**
   * Check if error is server error
   */
  const isServerError = computed(() => {
    if (!handler.error.value) return false
    const status = handler.error.value?.response?.status || handler.error.value?.status
    return status >= 500 && status < 600
  })

  return {
    ...handler,
    executeApiCall,
    executeApiCallSafe,
    isAuthError,
    isNetworkError,
    isServerError
  }
}

/**
 * Composable for form error handling
 * Specifically designed for form validation and submission
 */
export function useFormErrorHandler(options = {}) {
  const {
    showToast = true,
    context = 'Form submission',
    onError = null
  } = options

  const handler = useErrorHandler({ showToast, context, onError })
  const fieldErrors = ref({})

  /**
   * Handle form submission error
   */
  const handleSubmitError = (err, customContext = '') => {
    handler.handleError(err, customContext || context)

    // Extract field-level validation errors
    const validationErrors = err?.response?.data?.errors || {}
    if (Object.keys(validationErrors).length > 0) {
      fieldErrors.value = validationErrors
    }

    return err
  }

  /**
   * Clear field error
   */
  const clearFieldError = (field) => {
    if (fieldErrors.value[field]) {
      delete fieldErrors.value[field]
    }
  }

  /**
   * Clear all field errors
   */
  const clearFieldErrors = () => {
    fieldErrors.value = {}
  }

  /**
   * Get error for specific field
   */
  const getFieldError = (field) => {
    return fieldErrors.value[field] || null
  }

  /**
   * Check if field has error
   */
  const hasFieldError = (field) => {
    return !!fieldErrors.value[field]
  }

  /**
   * Execute form submission with error handling
   */
  const executeSubmit = async (submitFn, customContext = '') => {
    clearFieldErrors()

    try {
      return await handler.executeAsync(submitFn, customContext || context)
    } catch (err) {
      handleSubmitError(err, customContext)
      throw err
    }
  }

  return {
    ...handler,
    fieldErrors,
    handleSubmitError,
    clearFieldError,
    clearFieldErrors,
    getFieldError,
    hasFieldError,
    executeSubmit
  }
}

/**
 * Composable for component lifecycle error handling
 * Use for onMounted, onBeforeMount, etc.
 */
export function useLifecycleErrorHandler(lifecycleName = 'lifecycle') {
  return useErrorHandler({
    showToast: true,
    context: lifecycleName,
    autoRetry: false
  })
}
