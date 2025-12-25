// ResilienceMetricsCollector.js - Collect and analyze resilience metrics
// Issue #5306 - Robust Error Recovery: Circuit Breaker & Self-Healing
//
// Collects comprehensive metrics for resilient execution:
// - MTBF (Mean Time Between Failures)
// - MTTR (Mean Time To Recovery)
// - Error rates by category and service
// - Circuit breaker state transitions
// - Availability percentages
// - Recovery success rates

import EventEmitter from 'events'
import logger from '../utils/logger.js'
import metrics from '../utils/metrics.js'

/**
 * Time window for metrics aggregation
 */
export const MetricsWindow = {
  LAST_HOUR: 'last_hour',
  LAST_DAY: 'last_day',
  LAST_WEEK: 'last_week',
  ALL_TIME: 'all_time'
}

/**
 * ResilienceMetricsCollector - Comprehensive metrics collection for resilient systems
 *
 * Tracks:
 * - MTBF (Mean Time Between Failures): Average time between failures
 * - MTTR (Mean Time To Recovery): Average time to recover from failures
 * - Availability: Percentage of successful executions
 * - Error rates by category and service
 * - Circuit breaker state transitions
 * - Recovery success rates (retries, fallbacks, self-healing)
 *
 * Events:
 * - metrics:collected - When metrics are collected
 * - threshold:exceeded - When a metric exceeds threshold (for alerting)
 */
export class ResilienceMetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super()

    // Configuration
    this.retentionPeriod = options.retentionPeriod || 7 * 24 * 60 * 60 * 1000 // 7 days
    this.aggregationInterval = options.aggregationInterval || 60 * 1000 // 1 minute

    // Metrics storage
    this.events = [] // Array of {timestamp, type, serviceName, duration, metadata}
    this.failures = [] // Array of {timestamp, serviceName, errorCategory, recovered}
    this.recoveries = [] // Array of {timestamp, serviceName, recoveryMethod, duration}
    this.circuitBreakerEvents = [] // Array of {timestamp, serviceName, oldState, newState}

    // Aggregated metrics
    this.serviceMetrics = new Map() // serviceName -> metrics object

    // Thresholds for alerting
    this.thresholds = {
      mtbf: options.mtbfThreshold || 3600000, // 1 hour
      mttr: options.mttrThreshold || 300000,  // 5 minutes
      errorRate: options.errorRateThreshold || 10, // 10%
      availability: options.availabilityThreshold || 99.9 // 99.9%
    }

    // Start cleanup interval
    this._startCleanupInterval()

    logger.info(
      {
        retentionPeriod: this.retentionPeriod,
        aggregationInterval: this.aggregationInterval,
        thresholds: this.thresholds
      },
      'ResilienceMetricsCollector initialized'
    )
  }

  /**
   * Record a successful execution
   *
   * @param {string} serviceName - Service identifier
   * @param {number} duration - Execution duration in milliseconds
   * @param {Object} [metadata] - Additional metadata
   */
  recordSuccess(serviceName, duration, metadata = {}) {
    this.events.push({
      timestamp: Date.now(),
      type: 'success',
      serviceName,
      duration,
      metadata
    })

    this._updateServiceMetrics(serviceName, 'success', duration)
    metrics.increment('resilienceMetrics.success', { serviceName })
  }

  /**
   * Record a failure
   *
   * @param {string} serviceName - Service identifier
   * @param {string} errorCategory - Error category from ErrorClassifier
   * @param {boolean} [recovered] - Whether failure was recovered (via retry/fallback)
   * @param {Object} [metadata] - Additional metadata
   */
  recordFailure(serviceName, errorCategory, recovered = false, metadata = {}) {
    const failureEvent = {
      timestamp: Date.now(),
      serviceName,
      errorCategory,
      recovered,
      metadata
    }

    this.events.push({
      ...failureEvent,
      type: 'failure'
    })

    this.failures.push(failureEvent)

    this._updateServiceMetrics(serviceName, 'failure', null, errorCategory)
    metrics.increment('resilienceMetrics.failure', { serviceName, errorCategory })

    // Check thresholds
    this._checkThresholds(serviceName)
  }

  /**
   * Record a recovery (retry, fallback, or self-healing)
   *
   * @param {string} serviceName - Service identifier
   * @param {string} recoveryMethod - Method used (retry, fallback, self-healing)
   * @param {number} duration - Time taken to recover in milliseconds
   * @param {Object} [metadata] - Additional metadata
   */
  recordRecovery(serviceName, recoveryMethod, duration, metadata = {}) {
    const recoveryEvent = {
      timestamp: Date.now(),
      serviceName,
      recoveryMethod,
      duration,
      metadata
    }

    this.events.push({
      ...recoveryEvent,
      type: 'recovery'
    })

    this.recoveries.push(recoveryEvent)

    this._updateServiceMetrics(serviceName, 'recovery', duration, null, recoveryMethod)
    metrics.increment('resilienceMetrics.recovery', { serviceName, recoveryMethod })
  }

  /**
   * Record circuit breaker state change
   *
   * @param {string} serviceName - Service identifier
   * @param {string} oldState - Previous state
   * @param {string} newState - New state
   * @param {Object} [metadata] - Additional metadata
   */
  recordCircuitBreakerStateChange(serviceName, oldState, newState, metadata = {}) {
    const event = {
      timestamp: Date.now(),
      serviceName,
      oldState,
      newState,
      metadata
    }

    this.events.push({
      ...event,
      type: 'circuit_breaker_state_change'
    })

    this.circuitBreakerEvents.push(event)

    metrics.increment('resilienceMetrics.circuitBreakerStateChange', {
      serviceName,
      oldState,
      newState
    })
  }

  /**
   * Calculate MTBF (Mean Time Between Failures) for a service
   *
   * @param {string} serviceName - Service identifier
   * @param {string} [window] - Time window for calculation
   * @returns {number|null} MTBF in milliseconds, or null if insufficient data
   */
  calculateMTBF(serviceName, window = MetricsWindow.ALL_TIME) {
    const windowStart = this._getWindowStart(window)
    const serviceFailures = this.failures.filter(
      f => f.serviceName === serviceName && f.timestamp >= windowStart
    )

    if (serviceFailures.length < 2) {
      return null // Need at least 2 failures to calculate MTBF
    }

    // Calculate time between consecutive failures
    const intervals = []
    for (let i = 1; i < serviceFailures.length; i++) {
      intervals.push(serviceFailures[i].timestamp - serviceFailures[i - 1].timestamp)
    }

    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
  }

  /**
   * Calculate MTTR (Mean Time To Recovery) for a service
   *
   * @param {string} serviceName - Service identifier
   * @param {string} [window] - Time window for calculation
   * @returns {number|null} MTTR in milliseconds, or null if no recoveries
   */
  calculateMTTR(serviceName, window = MetricsWindow.ALL_TIME) {
    const windowStart = this._getWindowStart(window)
    const serviceRecoveries = this.recoveries.filter(
      r => r.serviceName === serviceName && r.timestamp >= windowStart
    )

    if (serviceRecoveries.length === 0) {
      return null
    }

    const totalRecoveryTime = serviceRecoveries.reduce((sum, r) => sum + r.duration, 0)
    return totalRecoveryTime / serviceRecoveries.length
  }

  /**
   * Calculate availability percentage for a service
   *
   * @param {string} serviceName - Service identifier
   * @param {string} [window] - Time window for calculation
   * @returns {number} Availability percentage (0-100)
   */
  calculateAvailability(serviceName, window = MetricsWindow.ALL_TIME) {
    const windowStart = this._getWindowStart(window)
    const serviceEvents = this.events.filter(
      e => e.serviceName === serviceName && e.timestamp >= windowStart
    )

    if (serviceEvents.length === 0) {
      return 100 // No events = 100% availability
    }

    const successCount = serviceEvents.filter(e => e.type === 'success').length
    return (successCount / serviceEvents.length) * 100
  }

  /**
   * Calculate error rate for a service
   *
   * @param {string} serviceName - Service identifier
   * @param {string} [window] - Time window for calculation
   * @returns {number} Error rate percentage (0-100)
   */
  calculateErrorRate(serviceName, window = MetricsWindow.ALL_TIME) {
    return 100 - this.calculateAvailability(serviceName, window)
  }

  /**
   * Get comprehensive metrics for a service
   *
   * @param {string} serviceName - Service identifier
   * @param {string} [window] - Time window for calculation
   * @returns {Object} Comprehensive metrics
   */
  getServiceMetrics(serviceName, window = MetricsWindow.ALL_TIME) {
    const windowStart = this._getWindowStart(window)

    const mtbf = this.calculateMTBF(serviceName, window)
    const mttr = this.calculateMTTR(serviceName, window)
    const availability = this.calculateAvailability(serviceName, window)
    const errorRate = this.calculateErrorRate(serviceName, window)

    const serviceFailures = this.failures.filter(
      f => f.serviceName === serviceName && f.timestamp >= windowStart
    )

    const serviceRecoveries = this.recoveries.filter(
      r => r.serviceName === serviceName && r.timestamp >= windowStart
    )

    const recoveryRate = serviceFailures.length > 0
      ? (serviceRecoveries.length / serviceFailures.length) * 100
      : 0

    // Group failures by error category
    const failuresByCategory = {}
    serviceFailures.forEach(f => {
      failuresByCategory[f.errorCategory] = (failuresByCategory[f.errorCategory] || 0) + 1
    })

    // Group recoveries by method
    const recoveriesByMethod = {}
    serviceRecoveries.forEach(r => {
      recoveriesByMethod[r.recoveryMethod] = (recoveriesByMethod[r.recoveryMethod] || 0) + 1
    })

    return {
      serviceName,
      window,
      mtbf: mtbf ? `${(mtbf / 1000).toFixed(2)}s` : 'N/A',
      mttr: mttr ? `${(mttr / 1000).toFixed(2)}s` : 'N/A',
      availability: `${availability.toFixed(2)}%`,
      errorRate: `${errorRate.toFixed(2)}%`,
      recoveryRate: `${recoveryRate.toFixed(2)}%`,
      totalFailures: serviceFailures.length,
      totalRecoveries: serviceRecoveries.length,
      failuresByCategory,
      recoveriesByMethod,
      circuitBreakerTransitions: this.circuitBreakerEvents.filter(
        e => e.serviceName === serviceName && e.timestamp >= windowStart
      ).length
    }
  }

  /**
   * Get metrics for all services
   *
   * @param {string} [window] - Time window for calculation
   * @returns {Array<Object>} Array of service metrics
   */
  getAllServiceMetrics(window = MetricsWindow.ALL_TIME) {
    const services = new Set()

    this.events.forEach(e => services.add(e.serviceName))

    return Array.from(services).map(serviceName =>
      this.getServiceMetrics(serviceName, window)
    )
  }

  /**
   * Get global metrics across all services
   *
   * @param {string} [window] - Time window for calculation
   * @returns {Object} Global metrics
   */
  getGlobalMetrics(window = MetricsWindow.ALL_TIME) {
    const windowStart = this._getWindowStart(window)

    const windowEvents = this.events.filter(e => e.timestamp >= windowStart)
    const windowFailures = this.failures.filter(f => f.timestamp >= windowStart)
    const windowRecoveries = this.recoveries.filter(r => r.timestamp >= windowStart)

    const totalExecutions = windowEvents.filter(e => ['success', 'failure'].includes(e.type)).length
    const successfulExecutions = windowEvents.filter(e => e.type === 'success').length
    const availability = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 100
    const recoveryRate = windowFailures.length > 0
      ? (windowRecoveries.length / windowFailures.length) * 100
      : 0

    return {
      window,
      totalExecutions,
      successfulExecutions,
      totalFailures: windowFailures.length,
      totalRecoveries: windowRecoveries.length,
      availability: `${availability.toFixed(2)}%`,
      errorRate: `${(100 - availability).toFixed(2)}%`,
      recoveryRate: `${recoveryRate.toFixed(2)}%`,
      uniqueServices: new Set(windowEvents.map(e => e.serviceName)).size,
      circuitBreakerTransitions: this.circuitBreakerEvents.filter(
        e => e.timestamp >= windowStart
      ).length
    }
  }

  /**
   * Update service-specific metrics cache
   * @private
   */
  _updateServiceMetrics(serviceName, type, duration, errorCategory = null, recoveryMethod = null) {
    if (!this.serviceMetrics.has(serviceName)) {
      this.serviceMetrics.set(serviceName, {
        successCount: 0,
        failureCount: 0,
        recoveryCount: 0,
        totalDuration: 0,
        lastUpdated: Date.now()
      })
    }

    const metrics = this.serviceMetrics.get(serviceName)

    if (type === 'success') {
      metrics.successCount++
      metrics.totalDuration += duration
    } else if (type === 'failure') {
      metrics.failureCount++
    } else if (type === 'recovery') {
      metrics.recoveryCount++
      metrics.totalDuration += duration
    }

    metrics.lastUpdated = Date.now()
  }

  /**
   * Get window start timestamp based on window type
   * @private
   */
  _getWindowStart(window) {
    const now = Date.now()

    switch (window) {
      case MetricsWindow.LAST_HOUR:
        return now - (60 * 60 * 1000)
      case MetricsWindow.LAST_DAY:
        return now - (24 * 60 * 60 * 1000)
      case MetricsWindow.LAST_WEEK:
        return now - (7 * 24 * 60 * 60 * 1000)
      case MetricsWindow.ALL_TIME:
      default:
        return 0
    }
  }

  /**
   * Check if metrics exceed thresholds and emit alerts
   * @private
   */
  _checkThresholds(serviceName) {
    const metrics = this.getServiceMetrics(serviceName, MetricsWindow.LAST_HOUR)

    // Check MTBF
    const mtbfMs = this.calculateMTBF(serviceName, MetricsWindow.LAST_HOUR)
    if (mtbfMs && mtbfMs < this.thresholds.mtbf) {
      this.emit('threshold:exceeded', {
        serviceName,
        metric: 'mtbf',
        value: mtbfMs,
        threshold: this.thresholds.mtbf,
        severity: 'warning'
      })
    }

    // Check MTTR
    const mttrMs = this.calculateMTTR(serviceName, MetricsWindow.LAST_HOUR)
    if (mttrMs && mttrMs > this.thresholds.mttr) {
      this.emit('threshold:exceeded', {
        serviceName,
        metric: 'mttr',
        value: mttrMs,
        threshold: this.thresholds.mttr,
        severity: 'warning'
      })
    }

    // Check error rate
    const errorRate = this.calculateErrorRate(serviceName, MetricsWindow.LAST_HOUR)
    if (errorRate > this.thresholds.errorRate) {
      this.emit('threshold:exceeded', {
        serviceName,
        metric: 'errorRate',
        value: errorRate,
        threshold: this.thresholds.errorRate,
        severity: 'critical'
      })
    }

    // Check availability
    const availability = this.calculateAvailability(serviceName, MetricsWindow.LAST_HOUR)
    if (availability < this.thresholds.availability) {
      this.emit('threshold:exceeded', {
        serviceName,
        metric: 'availability',
        value: availability,
        threshold: this.thresholds.availability,
        severity: 'critical'
      })
    }
  }

  /**
   * Start cleanup interval to remove old data
   * @private
   */
  _startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this._cleanup()
    }, this.aggregationInterval)
  }

  /**
   * Remove data older than retention period
   * @private
   */
  _cleanup() {
    const cutoff = Date.now() - this.retentionPeriod

    const eventsBefore = this.events.length
    const failuresBefore = this.failures.length
    const recoveriesBefore = this.recoveries.length

    this.events = this.events.filter(e => e.timestamp >= cutoff)
    this.failures = this.failures.filter(f => f.timestamp >= cutoff)
    this.recoveries = this.recoveries.filter(r => r.timestamp >= cutoff)
    this.circuitBreakerEvents = this.circuitBreakerEvents.filter(e => e.timestamp >= cutoff)

    const removed = {
      events: eventsBefore - this.events.length,
      failures: failuresBefore - this.failures.length,
      recoveries: recoveriesBefore - this.recoveries.length
    }

    if (removed.events > 0 || removed.failures > 0 || removed.recoveries > 0) {
      logger.debug({ removed, cutoff: new Date(cutoff) }, 'Cleaned up old metrics data')
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.removeAllListeners()
    logger.info('ResilienceMetricsCollector cleaned up')
  }
}

export default ResilienceMetricsCollector
