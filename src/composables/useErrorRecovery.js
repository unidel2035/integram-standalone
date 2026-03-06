import { logger } from '@/utils/logger'
/**
 * Composable for error recovery and retry mechanisms
 */

import { ref } from 'vue'
import { isRetryableError } from '@/utils/errorHandling'

/**
 * Create a retry mechanism with exponential backoff
 */
export function useRetry(options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry = null
  } = options

  const attempt = ref(0)
  const isRetrying = ref(false)

  /**
   * Execute a function with retry logic
   */
  const executeWithRetry = async (fn) => {
    attempt.value = 0
    isRetrying.value = false

    while (attempt.value < maxAttempts) {
      try {
        attempt.value++
        const result = await fn()
        attempt.value = 0
        return result
      } catch (error) {
        // Check if error is retryable
        if (!isRetryableError(error)) {
          throw error
        }

        // If this was the last attempt, throw the error
        if (attempt.value >= maxAttempts) {
          throw error
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(backoffFactor, attempt.value - 1),
          maxDelay
        )

        // Call onRetry callback if provided
        if (onRetry) {
          onRetry(attempt.value, delay, error)
        }

        // Wait before retrying
        isRetrying.value = true
        await new Promise(resolve => setTimeout(resolve, delay))
        isRetrying.value = false
      }
    }
  }

  const reset = () => {
    attempt.value = 0
    isRetrying.value = false
  }

  return {
    attempt,
    isRetrying,
    executeWithRetry,
    reset
  }
}

/**
 * Create offline queue for failed requests
 */
export function useOfflineQueue() {
  const queue = ref([])
  const isProcessing = ref(false)

  /**
   * Add request to queue
   */
  const enqueue = (request) => {
    queue.value.push({
      id: Date.now() + Math.random(),
      request,
      timestamp: new Date(),
      attempts: 0
    })
    saveQueue()
  }

  /**
   * Process queue when online
   */
  const processQueue = async () => {
    if (isProcessing.value || !navigator.onLine || queue.value.length === 0) {
      return
    }

    isProcessing.value = true

    while (queue.value.length > 0 && navigator.onLine) {
      const item = queue.value[0]

      try {
        await item.request()
        // Remove successful request from queue
        queue.value.shift()
        saveQueue()
      } catch (error) {
        item.attempts++

        // If max attempts reached, remove from queue
        if (item.attempts >= 3) {
          queue.value.shift()
          saveQueue()
        } else {
          // Move to end of queue
          queue.value.push(queue.value.shift())
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    isProcessing.value = false
  }

  /**
   * Clear queue
   */
  const clearQueue = () => {
    queue.value = []
    saveQueue()
  }

  /**
   * Save queue to localStorage
   */
  const saveQueue = () => {
    try {
      localStorage.setItem('offline_queue', JSON.stringify(queue.value))
    } catch (error) {
      console.error('Failed to save offline queue:', error)
    }
  }

  /**
   * Load queue from localStorage
   */
  const loadQueue = () => {
    try {
      const saved = localStorage.getItem('offline_queue')
      if (saved) {
        queue.value = JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error)
    }
  }

  // Load queue on initialization
  loadQueue()

  // Process queue when coming online
  window.addEventListener('online', processQueue)

  return {
    queue,
    isProcessing,
    enqueue,
    processQueue,
    clearQueue
  }
}

/**
 * Composable for handling component errors with recovery
 */
export function useErrorBoundary(options = {}) {
  const {
    onError = null,
    fallback = null,
    resetKeys = []
  } = options

  const error = ref(null)
  const hasError = ref(false)

  /**
   * Catch error
   */
  const catchError = (err) => {
    error.value = err
    hasError.value = true

    if (onError) {
      onError(err)
    }
  }

  /**
   * Reset error state
   */
  const reset = () => {
    error.value = null
    hasError.value = false
  }

  /**
   * Execute function with error boundary
   */
  const tryExecute = async (fn) => {
    try {
      reset()
      return await fn()
    } catch (err) {
      catchError(err)
      throw err
    }
  }

  return {
    error,
    hasError,
    catchError,
    reset,
    tryExecute
  }
}

/**
 * Composable for debounced error reporting
 */
export function useDebouncedErrorReporting(delay = 5000) {
  const errors = ref([])
  let timeoutId = null

  /**
   * Add error to report
   */
  const reportError = (error) => {
    errors.value.push({
      error,
      timestamp: new Date()
    })

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Set new timeout
    timeoutId = setTimeout(() => {
      sendErrorReport()
    }, delay)
  }

  /**
   * Send error report
   */
  const sendErrorReport = async () => {
    if (errors.value.length === 0) return

    // TODO: Send to error tracking service
    logger.error('[Error Report]', errors.value)

    // Clear errors
    errors.value = []
  }

  return {
    errors,
    reportError
  }
}
