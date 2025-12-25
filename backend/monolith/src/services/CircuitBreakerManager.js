// CircuitBreakerManager.js - Manages circuit breakers for all agents
// Issue #2707 - Phase 3.2: Circuit Breaker Pattern between agents
//
// Centralized manager for all circuit breakers in the multi-agent system.
// Provides:
// - Circuit breaker creation and lifecycle management
// - Bulk state queries and statistics
// - Integration with monitoring systems
// - Bulk reset/recovery operations

import EventEmitter from 'events'
import { CircuitBreaker, CircuitState } from './CircuitBreaker.js'
import logger from '../utils/logger.js'
import metrics from '../utils/metrics.js'

/**
 * CircuitBreakerManager - Centralized management of circuit breakers
 *
 * Manages circuit breakers for all agents in the system. Provides:
 * - Automatic circuit breaker creation on demand
 * - Bulk state queries for monitoring dashboards
 * - Bulk reset/recovery operations
 * - Event aggregation from all circuit breakers
 *
 * Events:
 * - breaker:created - When a new circuit breaker is created
 * - breaker:state:changed - When any circuit breaker changes state (forwarded)
 * - breaker:failure - When any circuit breaker records a failure (forwarded)
 * - breaker:success - When any circuit breaker records a success (forwarded)
 *
 * Usage:
 *   const manager = new CircuitBreakerManager()
 *   await manager.executeWithBreaker('agent-123', async () => {
 *     // Make request to agent
 *   })
 *
 * Reference: /docs/MULTI_AGENT_ORGANISM_AUDIT.md - section 4.3
 */
export class CircuitBreakerManager extends EventEmitter {
  /**
   * Create a circuit breaker manager
   *
   * @param {Object} options - Configuration options
   * @param {Object} [options.defaultConfig] - Default config for new circuit breakers
   */
  constructor(options = {}) {
    super()

    // Map of agentId -> CircuitBreaker
    this.breakers = new Map()

    // Default configuration for new circuit breakers
    this.defaultConfig = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 60 seconds
      ...options.defaultConfig
    }

    logger.info(
      { defaultConfig: this.defaultConfig },
      'CircuitBreakerManager initialized'
    )
  }

  /**
   * Get or create a circuit breaker for an agent
   *
   * @param {string} agentId - Agent ID
   * @param {Object} [options] - Optional configuration overrides
   * @returns {CircuitBreaker} Circuit breaker instance
   */
  getOrCreate(agentId, options = {}) {
    if (!this.breakers.has(agentId)) {
      const config = {
        name: agentId,
        ...this.defaultConfig,
        ...options
      }

      const breaker = new CircuitBreaker(config)

      // Forward events from circuit breaker
      breaker.on('state:changed', (event) => {
        this.emit('breaker:state:changed', event)
        metrics.increment('circuitBreakerManager.stateChanges')
      })

      breaker.on('failure', (event) => {
        this.emit('breaker:failure', event)
      })

      breaker.on('success', (event) => {
        this.emit('breaker:success', event)
      })

      this.breakers.set(agentId, breaker)

      logger.info({ agentId, config }, 'Created new circuit breaker')
      this.emit('breaker:created', { agentId, config })
      metrics.increment('circuitBreakerManager.breakersCreated')
    }

    return this.breakers.get(agentId)
  }

  /**
   * Execute a function through a circuit breaker
   *
   * @param {string} agentId - Target agent ID
   * @param {Function} fn - Async function to execute
   * @param {Object} [options] - Optional circuit breaker configuration
   * @returns {Promise<any>} Result of the function
   * @throws {Error} If circuit is OPEN or function fails
   */
  async executeWithBreaker(agentId, fn, options = {}) {
    const breaker = this.getOrCreate(agentId, options)
    return breaker.execute(fn)
  }

  /**
   * Get a circuit breaker for an agent (without creating)
   *
   * @param {string} agentId - Agent ID
   * @returns {CircuitBreaker|undefined} Circuit breaker or undefined if not found
   */
  get(agentId) {
    return this.breakers.get(agentId)
  }

  /**
   * Check if a circuit breaker exists for an agent
   *
   * @param {string} agentId - Agent ID
   * @returns {boolean} True if circuit breaker exists
   */
  has(agentId) {
    return this.breakers.has(agentId)
  }

  /**
   * Get all circuit breaker states
   *
   * @returns {Object} Map of agentId -> state info
   */
  getAllStates() {
    const states = {}

    for (const [agentId, breaker] of this.breakers) {
      states[agentId] = breaker.getState()
    }

    return states
  }

  /**
   * Get circuit breakers by state
   *
   * @param {string} state - State to filter by (CLOSED, OPEN, HALF_OPEN)
   * @returns {Array<Object>} Array of state objects
   */
  getByState(state) {
    const results = []

    for (const [agentId, breaker] of this.breakers) {
      if (breaker.state === state) {
        results.push(breaker.getState())
      }
    }

    return results
  }

  /**
   * Get all open circuit breakers
   *
   * @returns {Array<Object>} Array of open circuit breaker states
   */
  getOpenCircuits() {
    return this.getByState(CircuitState.OPEN)
  }

  /**
   * Get all half-open circuit breakers
   *
   * @returns {Array<Object>} Array of half-open circuit breaker states
   */
  getHalfOpenCircuits() {
    return this.getByState(CircuitState.HALF_OPEN)
  }

  /**
   * Get statistics for all circuit breakers
   *
   * @returns {Object} Aggregated statistics
   */
  getStats() {
    const stats = {
      totalBreakers: this.breakers.size,
      byState: {
        [CircuitState.CLOSED]: 0,
        [CircuitState.OPEN]: 0,
        [CircuitState.HALF_OPEN]: 0
      },
      aggregated: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rejectedRequests: 0
      }
    }

    for (const breaker of this.breakers.values()) {
      // Count by state
      stats.byState[breaker.state]++

      // Aggregate request stats
      const breakerState = breaker.getState()
      stats.aggregated.totalRequests += breakerState.stats.totalRequests
      stats.aggregated.successfulRequests += breakerState.stats.successfulRequests
      stats.aggregated.failedRequests += breakerState.stats.failedRequests
      stats.aggregated.rejectedRequests += breakerState.stats.rejectedRequests
    }

    // Calculate success rate
    if (stats.aggregated.totalRequests > 0) {
      stats.aggregated.successRate =
        (stats.aggregated.successfulRequests / stats.aggregated.totalRequests) * 100
    } else {
      stats.aggregated.successRate = 0
    }

    return stats
  }

  /**
   * Reset a specific circuit breaker to CLOSED state
   *
   * @param {string} agentId - Agent ID
   * @returns {boolean} True if circuit breaker was reset
   */
  reset(agentId) {
    const breaker = this.breakers.get(agentId)

    if (!breaker) {
      logger.warn({ agentId }, 'Cannot reset - circuit breaker not found')
      return false
    }

    breaker.reset()
    logger.info({ agentId }, 'Circuit breaker reset')
    metrics.increment('circuitBreakerManager.resets')

    return true
  }

  /**
   * Reset all circuit breakers to CLOSED state
   *
   * @returns {number} Number of circuit breakers reset
   */
  resetAll() {
    let count = 0

    for (const [agentId, breaker] of this.breakers) {
      breaker.reset()
      count++
    }

    logger.info({ count }, 'All circuit breakers reset')
    metrics.increment('circuitBreakerManager.resetAll', { count })

    return count
  }

  /**
   * Manually open a circuit breaker
   *
   * @param {string} agentId - Agent ID
   * @returns {boolean} True if circuit breaker was opened
   */
  open(agentId) {
    const breaker = this.breakers.get(agentId)

    if (!breaker) {
      logger.warn({ agentId }, 'Cannot open - circuit breaker not found')
      return false
    }

    breaker.open()
    logger.info({ agentId }, 'Circuit breaker manually opened')
    metrics.increment('circuitBreakerManager.manualOpen')

    return true
  }

  /**
   * Remove a circuit breaker
   *
   * @param {string} agentId - Agent ID
   * @returns {boolean} True if circuit breaker was removed
   */
  remove(agentId) {
    const breaker = this.breakers.get(agentId)

    if (!breaker) {
      return false
    }

    // Remove all listeners
    breaker.removeAllListeners()

    // Delete from map
    this.breakers.delete(agentId)

    logger.info({ agentId }, 'Circuit breaker removed')
    metrics.increment('circuitBreakerManager.removed')

    return true
  }

  /**
   * Remove all circuit breakers
   *
   * @returns {number} Number of circuit breakers removed
   */
  removeAll() {
    let count = 0

    for (const [agentId, breaker] of this.breakers) {
      breaker.removeAllListeners()
      this.breakers.delete(agentId)
      count++
    }

    logger.info({ count }, 'All circuit breakers removed')

    return count
  }

  /**
   * Check if a circuit is open for a specific agent
   *
   * @param {string} agentId - Agent ID
   * @returns {boolean} True if circuit is open
   */
  isOpen(agentId) {
    const breaker = this.breakers.get(agentId)
    return breaker ? breaker.state === CircuitState.OPEN : false
  }

  /**
   * Check if a circuit is closed for a specific agent
   *
   * @param {string} agentId - Agent ID
   * @returns {boolean} True if circuit is closed
   */
  isClosed(agentId) {
    const breaker = this.breakers.get(agentId)
    return breaker ? breaker.state === CircuitState.CLOSED : true // Default to closed if not found
  }

  /**
   * Cleanup - remove all circuit breakers and listeners
   */
  cleanup() {
    logger.info({ count: this.breakers.size }, 'Cleaning up CircuitBreakerManager')

    this.removeAll()
    this.removeAllListeners()
  }
}
