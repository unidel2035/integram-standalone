// ResilientExecutor.js - Orchestrates resilient execution with fallback chains
// Issue #5306 - Robust Error Recovery: Circuit Breaker & Self-Healing
//
// Combines CircuitBreaker, ErrorClassifier, and SelfHealingManager to provide
// comprehensive error recovery:
// - Automatic retry with exponential backoff
// - Fallback chains (primary → secondary → tertiary → ultimate fallback)
// - Error classification and adaptive retry strategies
// - Circuit breaker integration
// - Self-healing triggers
// - Metrics collection

import EventEmitter from 'events'
import logger from '../utils/logger.js'
import metrics from '../utils/metrics.js'
import { CircuitBreakerManager } from './CircuitBreakerManager.js'
import { ErrorClassifier, ErrorCategory } from './ErrorClassifier.js'
import { SelfHealingManager } from './SelfHealingManager.js'

/**
 * Execution result status
 */
export const ExecutionStatus = {
  SUCCESS: 'success',
  FAILED_WITH_FALLBACK: 'failed_with_fallback',
  FAILED_ALL: 'failed_all'
}

/**
 * ResilientExecutor - Orchestrates resilient execution with comprehensive error recovery
 *
 * Features:
 * - Automatic retry with intelligent backoff based on error classification
 * - Multi-level fallback chains (primary → secondary → tertiary → safe mode)
 * - Circuit breaker integration to prevent cascade failures
 * - Self-healing triggers for permanent failures
 * - Detailed execution metrics (MTBF, MTTR, success rates)
 *
 * Usage:
 *   const executor = new ResilientExecutor({ maxRetries: 3 })
 *
 *   const result = await executor.execute({
 *     serviceName: 'llm-service',
 *     operation: async () => await callLLM(),
 *     fallbacks: [
 *       async () => await callBackupLLM(),
 *       async () => await callCachedResponse()
 *     ]
 *   })
 *
 * Events:
 * - execution:started - When execution begins
 * - execution:retry - When retry is attempted
 * - execution:fallback - When fallback is used
 * - execution:success - When execution succeeds
 * - execution:failed - When all attempts fail
 */
export class ResilientExecutor extends EventEmitter {
  constructor(options = {}) {
    super()

    // Core components
    this.circuitBreakerManager = options.circuitBreakerManager || new CircuitBreakerManager(options.circuitBreakerConfig)
    this.errorClassifier = options.errorClassifier || new ErrorClassifier()
    this.selfHealingManager = options.selfHealingManager || null

    // Configuration
    this.maxRetries = options.maxRetries || 3
    this.enableCircuitBreaker = options.enableCircuitBreaker !== false // Default: enabled
    this.enableSelfHealing = options.enableSelfHealing !== false // Default: enabled

    // Fallback chain configuration
    this.fallbackChains = new Map() // operationType -> [fallback functions]

    // Statistics
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      retriedExecutions: 0,
      fallbackExecutions: 0,
      circuitBreakerRejections: 0,
      byErrorCategory: {
        [ErrorCategory.TRANSIENT]: 0,
        [ErrorCategory.PERMANENT]: 0,
        [ErrorCategory.RESOURCE]: 0,
        [ErrorCategory.RATE_LIMIT]: 0,
        [ErrorCategory.UNKNOWN]: 0
      },
      executionTimes: [], // For MTBF/MTTR calculation
      lastFailureTime: null,
      lastSuccessTime: null
    }

    logger.info(
      {
        maxRetries: this.maxRetries,
        enableCircuitBreaker: this.enableCircuitBreaker,
        enableSelfHealing: this.enableSelfHealing
      },
      'ResilientExecutor initialized'
    )
  }

  /**
   * Execute operation with resilience (retry, fallback, circuit breaker)
   *
   * @param {Object} config - Execution configuration
   * @param {string} config.serviceName - Service identifier (for circuit breaker)
   * @param {Function} config.operation - Async operation to execute
   * @param {Array<Function>} [config.fallbacks] - Array of fallback functions
   * @param {number} [config.maxRetries] - Override default max retries
   * @param {Object} [config.context] - Additional context for error classification
   * @returns {Promise<Object>} Execution result
   */
  async execute(config) {
    const {
      serviceName,
      operation,
      fallbacks = [],
      maxRetries = this.maxRetries,
      context = {}
    } = config

    this.stats.totalExecutions++
    const startTime = Date.now()

    const executionId = `${serviceName}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    logger.info(
      {
        executionId,
        serviceName,
        hasFallbacks: fallbacks.length > 0,
        maxRetries
      },
      'Starting resilient execution'
    )

    this.emit('execution:started', { executionId, serviceName })

    try {
      // Try primary operation with retries
      const primaryResult = await this._executeWithRetry({
        executionId,
        serviceName,
        operation,
        maxRetries,
        context
      })

      this.stats.successfulExecutions++
      this.stats.lastSuccessTime = new Date()
      const executionTime = Date.now() - startTime
      this.stats.executionTimes.push(executionTime)

      logger.info(
        {
          executionId,
          serviceName,
          executionTime
        },
        'Execution succeeded'
      )

      this.emit('execution:success', {
        executionId,
        serviceName,
        executionTime,
        usedFallback: false
      })

      metrics.increment('resilientExecutor.success', { serviceName })

      return {
        status: ExecutionStatus.SUCCESS,
        result: primaryResult,
        usedFallback: false,
        executionTime
      }
    } catch (primaryError) {
      logger.warn(
        {
          executionId,
          serviceName,
          error: primaryError.message,
          fallbacksAvailable: fallbacks.length
        },
        'Primary operation failed - trying fallbacks'
      )

      // Try fallbacks
      for (let i = 0; i < fallbacks.length; i++) {
        const fallback = fallbacks[i]
        const fallbackName = `${serviceName}-fallback-${i + 1}`

        logger.info(
          {
            executionId,
            serviceName,
            fallbackIndex: i + 1,
            totalFallbacks: fallbacks.length
          },
          'Attempting fallback'
        )

        this.emit('execution:fallback', {
          executionId,
          serviceName,
          fallbackIndex: i + 1
        })

        try {
          const fallbackResult = await this._executeWithRetry({
            executionId,
            serviceName: fallbackName,
            operation: fallback,
            maxRetries: Math.max(1, maxRetries - 1), // Fewer retries for fallbacks
            context
          })

          this.stats.successfulExecutions++
          this.stats.fallbackExecutions++
          this.stats.lastSuccessTime = new Date()
          const executionTime = Date.now() - startTime
          this.stats.executionTimes.push(executionTime)

          logger.info(
            {
              executionId,
              serviceName,
              fallbackIndex: i + 1,
              executionTime
            },
            'Fallback succeeded'
          )

          this.emit('execution:success', {
            executionId,
            serviceName,
            executionTime,
            usedFallback: true,
            fallbackIndex: i + 1
          })

          metrics.increment('resilientExecutor.success.fallback', {
            serviceName,
            fallbackIndex: i + 1
          })

          return {
            status: ExecutionStatus.FAILED_WITH_FALLBACK,
            result: fallbackResult,
            usedFallback: true,
            fallbackIndex: i + 1,
            primaryError: primaryError.message,
            executionTime
          }
        } catch (fallbackError) {
          logger.warn(
            {
              executionId,
              serviceName,
              fallbackIndex: i + 1,
              error: fallbackError.message
            },
            'Fallback failed - trying next'
          )
          // Continue to next fallback
        }
      }

      // All fallbacks exhausted - permanent failure
      this.stats.failedExecutions++
      this.stats.lastFailureTime = new Date()
      const executionTime = Date.now() - startTime
      this.stats.executionTimes.push(executionTime)

      logger.error(
        {
          executionId,
          serviceName,
          error: primaryError.message,
          executionTime
        },
        'All execution attempts failed'
      )

      this.emit('execution:failed', {
        executionId,
        serviceName,
        error: primaryError,
        executionTime
      })

      metrics.increment('resilientExecutor.failed', { serviceName })

      // Trigger self-healing if enabled
      if (this.enableSelfHealing && this.selfHealingManager) {
        logger.info(
          { executionId, serviceName },
          'Triggering self-healing for failed service'
        )
        await this.selfHealingManager.handleAgentFailure(serviceName, primaryError)
      }

      throw new Error(
        `Execution failed for ${serviceName} after all retry and fallback attempts: ${primaryError.message}`
      )
    }
  }

  /**
   * Execute operation with retry logic
   * @private
   */
  async _executeWithRetry(config) {
    const {
      executionId,
      serviceName,
      operation,
      maxRetries,
      context
    } = config

    let lastError = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Use circuit breaker if enabled
        if (this.enableCircuitBreaker) {
          return await this.circuitBreakerManager.executeWithBreaker(
            serviceName,
            operation
          )
        } else {
          return await operation()
        }
      } catch (error) {
        lastError = error

        // Classify error
        const classification = this.errorClassifier.classify(error, context)
        this.stats.byErrorCategory[classification.category]++

        logger.debug(
          {
            executionId,
            serviceName,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            errorCategory: classification.category,
            errorMessage: error.message
          },
          'Operation failed - analyzing error'
        )

        // Check if circuit breaker rejected the request
        if (error.circuitBreakerOpen) {
          this.stats.circuitBreakerRejections++
          logger.warn(
            {
              executionId,
              serviceName,
              nextAttempt: error.nextAttempt
            },
            'Circuit breaker is OPEN - skipping retries'
          )
          throw error // Don't retry when circuit is open
        }

        // Check if error is retriable
        if (!classification.metadata.isRetriable || attempt === maxRetries) {
          logger.warn(
            {
              executionId,
              serviceName,
              errorCategory: classification.category,
              isRetriable: classification.metadata.isRetriable,
              isLastAttempt: attempt === maxRetries
            },
            'Not retrying - error is not retriable or max retries reached'
          )
          throw error
        }

        // Calculate retry delay based on error classification
        const retryDelay = this.errorClassifier.getRetryDelay(error, attempt, context)

        if (retryDelay === Infinity) {
          logger.warn(
            {
              executionId,
              serviceName,
              errorCategory: classification.category
            },
            'Not retrying - error requires infinite delay (permanent error)'
          )
          throw error
        }

        logger.info(
          {
            executionId,
            serviceName,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            errorCategory: classification.category,
            retryDelay
          },
          'Retrying after delay'
        )

        this.stats.retriedExecutions++
        this.emit('execution:retry', {
          executionId,
          serviceName,
          attempt: attempt + 1,
          retryDelay,
          errorCategory: classification.category
        })

        metrics.increment('resilientExecutor.retry', {
          serviceName,
          errorCategory: classification.category
        })

        // Wait before retry
        await this._sleep(retryDelay)
      }
    }

    throw lastError
  }

  /**
   * Register a fallback chain for an operation type
   *
   * @param {string} operationType - Type of operation
   * @param {Array<Function>} fallbacks - Array of fallback functions
   */
  registerFallbackChain(operationType, fallbacks) {
    this.fallbackChains.set(operationType, fallbacks)

    logger.info(
      {
        operationType,
        fallbackCount: fallbacks.length
      },
      'Fallback chain registered'
    )
  }

  /**
   * Get fallback chain for operation type
   *
   * @param {string} operationType - Type of operation
   * @returns {Array<Function>} Fallback functions
   */
  getFallbackChain(operationType) {
    return this.fallbackChains.get(operationType) || []
  }

  /**
   * Get execution statistics
   *
   * @returns {Object} Statistics including MTBF, MTTR, success rates
   */
  getStats() {
    const successRate = this.stats.totalExecutions > 0
      ? (this.stats.successfulExecutions / this.stats.totalExecutions) * 100
      : 0

    const fallbackRate = this.stats.successfulExecutions > 0
      ? (this.stats.fallbackExecutions / this.stats.successfulExecutions) * 100
      : 0

    // Calculate MTBF (Mean Time Between Failures)
    const failureCount = this.stats.failedExecutions
    const totalTime = this.stats.executionTimes.reduce((sum, time) => sum + time, 0)
    const mtbf = failureCount > 0 ? totalTime / failureCount : null

    // Calculate MTTR (Mean Time To Recovery) - average execution time for recovered failures
    const mttr = this.stats.executionTimes.length > 0
      ? this.stats.executionTimes.reduce((sum, time) => sum + time, 0) / this.stats.executionTimes.length
      : null

    return {
      totalExecutions: this.stats.totalExecutions,
      successfulExecutions: this.stats.successfulExecutions,
      failedExecutions: this.stats.failedExecutions,
      retriedExecutions: this.stats.retriedExecutions,
      fallbackExecutions: this.stats.fallbackExecutions,
      circuitBreakerRejections: this.stats.circuitBreakerRejections,
      successRate: `${successRate.toFixed(2)}%`,
      fallbackRate: `${fallbackRate.toFixed(2)}%`,
      byErrorCategory: { ...this.stats.byErrorCategory },
      mtbf: mtbf ? `${(mtbf / 1000).toFixed(2)}s` : 'N/A',
      mttr: mttr ? `${(mttr / 1000).toFixed(2)}s` : 'N/A',
      lastFailureTime: this.stats.lastFailureTime?.toISOString() || null,
      lastSuccessTime: this.stats.lastSuccessTime?.toISOString() || null,
      circuitBreaker: this.circuitBreakerManager.getStats(),
      errorClassifier: this.errorClassifier.getStats()
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      retriedExecutions: 0,
      fallbackExecutions: 0,
      circuitBreakerRejections: 0,
      byErrorCategory: {
        [ErrorCategory.TRANSIENT]: 0,
        [ErrorCategory.PERMANENT]: 0,
        [ErrorCategory.RESOURCE]: 0,
        [ErrorCategory.RATE_LIMIT]: 0,
        [ErrorCategory.UNKNOWN]: 0
      },
      executionTimes: [],
      lastFailureTime: null,
      lastSuccessTime: null
    }

    this.errorClassifier.resetStats()
    logger.info('ResilientExecutor statistics reset')
  }

  /**
   * Sleep for specified milliseconds
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    logger.info('Cleaning up ResilientExecutor')
    this.circuitBreakerManager.cleanup()
    this.removeAllListeners()
  }
}

export default ResilientExecutor
