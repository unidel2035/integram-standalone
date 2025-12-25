// CircuitBreaker.js - Circuit Breaker Pattern implementation for agent resilience
// Issue #2707 - Phase 3.2: Circuit Breaker Pattern between agents
//
// Implements the Circuit Breaker pattern to prevent cascade failures when agents fail.
// Based on Martin Fowler's Circuit Breaker pattern:
// https://martinfowler.com/bliki/CircuitBreaker.html
//
// States:
// - CLOSED: Normal operation, requests pass through
// - OPEN: Agent is unavailable, requests fail immediately
// - HALF_OPEN: Testing if agent has recovered, limited requests allowed

import EventEmitter from 'events'
import logger from '../utils/logger.js'
import metrics from '../utils/metrics.js'

/**
 * Circuit breaker states
 */
export const CircuitState = {
  CLOSED: 'CLOSED',       // Normal operation
  OPEN: 'OPEN',           // Circuit is open, requests fail immediately
  HALF_OPEN: 'HALF_OPEN'  // Testing recovery, limited requests allowed
}

/**
 * CircuitBreaker - Implements circuit breaker pattern for agent resilience
 *
 * The circuit breaker acts as a proxy that monitors failures and prevents
 * repeated calls to a failing service. It has three states:
 *
 * 1. CLOSED (default): Requests pass through normally. Failures are counted.
 *    When failure threshold is reached, transitions to OPEN.
 *
 * 2. OPEN: All requests fail immediately without attempting the call.
 *    After timeout period, transitions to HALF_OPEN.
 *
 * 3. HALF_OPEN: Limited requests are allowed to test if service recovered.
 *    Success transitions to CLOSED. Failure transitions back to OPEN.
 *
 * Events:
 * - state:changed - Emitted when circuit state changes
 * - failure - Emitted when a failure is recorded
 * - success - Emitted when a success is recorded
 *
 * Reference: /docs/MULTI_AGENT_ORGANISM_AUDIT.md - section 4.3
 */
export class CircuitBreaker extends EventEmitter {
  /**
   * Create a circuit breaker
   *
   * @param {Object} options - Configuration options
   * @param {string} options.name - Name/ID of the circuit breaker (usually agentId)
   * @param {number} [options.failureThreshold=5] - Number of failures before opening circuit
   * @param {number} [options.successThreshold=2] - Number of successes before closing circuit (in HALF_OPEN)
   * @param {number} [options.timeout=60000] - Time in milliseconds to wait before attempting recovery (OPEN -> HALF_OPEN)
   */
  constructor(options = {}) {
    super()

    // Circuit breaker identifier
    this.name = options.name || 'unnamed'

    // Configuration
    this.failureThreshold = options.failureThreshold || 5
    this.successThreshold = options.successThreshold || 2
    this.timeout = options.timeout || 60000 // 60 seconds default

    // State
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.nextAttempt = Date.now()

    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0, // Rejected while circuit is OPEN
      lastStateChange: new Date(),
      lastFailureTime: null,
      lastSuccessTime: null
    }

    logger.info(
      {
        name: this.name,
        failureThreshold: this.failureThreshold,
        successThreshold: this.successThreshold,
        timeout: this.timeout
      },
      'CircuitBreaker created'
    )
  }

  /**
   * Execute a function through the circuit breaker
   *
   * @param {Function} fn - Async function to execute
   * @returns {Promise<any>} Result of the function
   * @throws {Error} If circuit is OPEN or function fails
   */
  async execute(fn) {
    this.stats.totalRequests++

    // Check if circuit is OPEN
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        // Still in timeout period - reject immediately
        this.stats.rejectedRequests++
        metrics.increment('circuitBreaker.rejected', { name: this.name })

        const error = new Error(`Circuit breaker is OPEN for ${this.name}`)
        error.circuitBreakerOpen = true
        error.nextAttempt = this.nextAttempt
        throw error
      }

      // Timeout period expired - transition to HALF_OPEN
      this._transitionTo(CircuitState.HALF_OPEN)
    }

    try {
      // Execute the function
      const result = await fn()

      // Success - record it
      this.onSuccess()

      return result
    } catch (error) {
      // Failure - record it
      this.onFailure()

      // Re-throw the error
      throw error
    }
  }

  /**
   * Record a successful execution
   * @private
   */
  onSuccess() {
    this.failureCount = 0
    this.stats.successfulRequests++
    this.stats.lastSuccessTime = new Date()

    metrics.increment('circuitBreaker.success', { name: this.name })
    this.emit('success', { name: this.name, state: this.state })

    logger.debug(
      { name: this.name, state: this.state, successCount: this.successCount },
      'CircuitBreaker recorded success'
    )

    // Handle HALF_OPEN -> CLOSED transition
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++

      if (this.successCount >= this.successThreshold) {
        // Enough successes - close the circuit
        this._transitionTo(CircuitState.CLOSED)
        this.successCount = 0
      }
    }
  }

  /**
   * Record a failed execution
   * @private
   */
  onFailure() {
    this.failureCount++
    this.successCount = 0 // Reset success count on any failure
    this.stats.failedRequests++
    this.stats.lastFailureTime = new Date()

    metrics.increment('circuitBreaker.failure', { name: this.name })
    this.emit('failure', { name: this.name, state: this.state, failureCount: this.failureCount })

    logger.debug(
      { name: this.name, state: this.state, failureCount: this.failureCount },
      'CircuitBreaker recorded failure'
    )

    // Check if we should open the circuit
    if (this.failureCount >= this.failureThreshold) {
      // Too many failures - open the circuit
      this._transitionTo(CircuitState.OPEN)
      this.nextAttempt = Date.now() + this.timeout

      logger.warn(
        {
          name: this.name,
          failureCount: this.failureCount,
          threshold: this.failureThreshold,
          nextAttempt: new Date(this.nextAttempt).toISOString()
        },
        'Circuit breaker OPEN due to failures'
      )
    }
  }

  /**
   * Get current state and statistics
   *
   * @returns {Object} State information
   */
  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      nextAttemptReadable: new Date(this.nextAttempt).toISOString(),
      isOpen: this.state === CircuitState.OPEN,
      canAttempt: this.state === CircuitState.CLOSED ||
                  (this.state === CircuitState.OPEN && Date.now() >= this.nextAttempt),
      config: {
        failureThreshold: this.failureThreshold,
        successThreshold: this.successThreshold,
        timeout: this.timeout
      },
      stats: {
        ...this.stats,
        lastStateChange: this.stats.lastStateChange.toISOString(),
        lastFailureTime: this.stats.lastFailureTime?.toISOString() || null,
        lastSuccessTime: this.stats.lastSuccessTime?.toISOString() || null
      }
    }
  }

  /**
   * Manually reset the circuit breaker to CLOSED state
   */
  reset() {
    logger.info({ name: this.name, previousState: this.state }, 'Manually resetting circuit breaker')

    this._transitionTo(CircuitState.CLOSED)
    this.failureCount = 0
    this.successCount = 0
    this.nextAttempt = Date.now()

    metrics.increment('circuitBreaker.reset', { name: this.name })
  }

  /**
   * Manually open the circuit breaker
   */
  open() {
    logger.info({ name: this.name, previousState: this.state }, 'Manually opening circuit breaker')

    this._transitionTo(CircuitState.OPEN)
    this.nextAttempt = Date.now() + this.timeout

    metrics.increment('circuitBreaker.manualOpen', { name: this.name })
  }

  /**
   * Transition to a new state
   * @private
   *
   * @param {string} newState - The new state to transition to
   */
  _transitionTo(newState) {
    const oldState = this.state

    if (oldState === newState) {
      return // No state change
    }

    this.state = newState
    this.stats.lastStateChange = new Date()

    logger.info(
      { name: this.name, oldState, newState },
      `Circuit breaker state transition: ${oldState} -> ${newState}`
    )

    metrics.increment('circuitBreaker.stateChange', {
      name: this.name,
      from: oldState,
      to: newState
    })

    this.emit('state:changed', {
      name: this.name,
      oldState,
      newState,
      timestamp: this.stats.lastStateChange
    })
  }
}
