/**
 * Performance Monitor
 *
 * Tracks performance metrics for Role-Sets operations:
 * - PQ execution times
 * - Witness validation times
 * - Transport operation times
 * - Cache hit rates
 *
 * @see /CLAUDE.md - Monitoring and logging requirements
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pqExecutions: [],
      witnessValidations: [],
      transportOperations: [],
      cacheHits: 0,
      cacheMisses: 0
    }
    this.isEnabled = import.meta.env.VITE_ENABLE_PERFORMANCE_TRACKING === 'true'
  }

  /**
   * Start timing an operation
   *
   * @param {string} operationType - Type of operation ('pq', 'witness', 'transport')
   * @param {Object} metadata - Additional metadata about the operation
   * @returns {Function} Function to call when operation completes
   */
  startTiming(operationType, metadata = {}) {
    if (!this.isEnabled) {
      return () => {} // No-op
    }

    const startTime = performance.now()

    return (result = {}) => {
      const duration = performance.now() - startTime

      this._recordMetric(operationType, {
        duration,
        timestamp: Date.now(),
        ...metadata,
        ...result
      })
    }
  }

  /**
   * Record a metric
   * @private
   */
  _recordMetric(type, data) {
    switch (type) {
      case 'pq':
        this.metrics.pqExecutions.push(data)
        this._trimMetrics('pqExecutions')
        break
      case 'witness':
        this.metrics.witnessValidations.push(data)
        this._trimMetrics('witnessValidations')
        break
      case 'transport':
        this.metrics.transportOperations.push(data)
        this._trimMetrics('transportOperations')
        break
    }
  }

  /**
   * Keep only last N metrics to prevent memory growth
   * @private
   */
  _trimMetrics(metricType, maxSize = 1000) {
    if (this.metrics[metricType].length > maxSize) {
      this.metrics[metricType] = this.metrics[metricType].slice(-maxSize)
    }
  }

  /**
   * Record cache hit
   */
  recordCacheHit() {
    if (this.isEnabled) {
      this.metrics.cacheHits++
    }
  }

  /**
   * Record cache miss
   */
  recordCacheMiss() {
    if (this.isEnabled) {
      this.metrics.cacheMisses++
    }
  }

  /**
   * Get performance statistics
   *
   * @returns {Object} Performance statistics
   */
  getStats() {
    const pqStats = this._calculateStats(this.metrics.pqExecutions)
    const witnessStats = this._calculateStats(this.metrics.witnessValidations)
    const transportStats = this._calculateStats(this.metrics.transportOperations)

    const totalCache = this.metrics.cacheHits + this.metrics.cacheMisses
    const cacheHitRate = totalCache > 0 ? (this.metrics.cacheHits / totalCache) * 100 : 0

    return {
      pqExecution: {
        count: this.metrics.pqExecutions.length,
        avgDuration: pqStats.avg,
        minDuration: pqStats.min,
        maxDuration: pqStats.max,
        p95Duration: pqStats.p95
      },
      witnessValidation: {
        count: this.metrics.witnessValidations.length,
        avgDuration: witnessStats.avg,
        minDuration: witnessStats.min,
        maxDuration: witnessStats.max,
        p95Duration: witnessStats.p95
      },
      transportOperations: {
        count: this.metrics.transportOperations.length,
        avgDuration: transportStats.avg,
        minDuration: transportStats.min,
        maxDuration: transportStats.max,
        p95Duration: transportStats.p95
      },
      cache: {
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
        hitRate: cacheHitRate.toFixed(2) + '%'
      }
    }
  }

  /**
   * Calculate statistics for a set of durations
   * @private
   */
  _calculateStats(metrics) {
    if (metrics.length === 0) {
      return { avg: 0, min: 0, max: 0, p95: 0 }
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b)
    const sum = durations.reduce((acc, d) => acc + d, 0)

    const p95Index = Math.floor(durations.length * 0.95)

    return {
      avg: sum / durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      p95: durations[p95Index] || durations[durations.length - 1]
    }
  }

  /**
   * Get slow operations (above threshold)
   *
   * @param {string} operationType - Type of operation
   * @param {number} thresholdMs - Threshold in milliseconds
   * @returns {Array} Slow operations
   */
  getSlowOperations(operationType, thresholdMs = 1000) {
    let operations = []

    switch (operationType) {
      case 'pq':
        operations = this.metrics.pqExecutions
        break
      case 'witness':
        operations = this.metrics.witnessValidations
        break
      case 'transport':
        operations = this.metrics.transportOperations
        break
    }

    return operations.filter(op => op.duration > thresholdMs)
  }

  /**
   * Export metrics for external monitoring systems
   *
   * @returns {Object} Metrics in exportable format
   */
  exportMetrics() {
    return {
      timestamp: Date.now(),
      stats: this.getStats(),
      rawMetrics: {
        pqExecutions: this.metrics.pqExecutions.slice(-100), // Last 100
        witnessValidations: this.metrics.witnessValidations.slice(-100),
        transportOperations: this.metrics.transportOperations.slice(-100)
      }
    }
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = {
      pqExecutions: [],
      witnessValidations: [],
      transportOperations: [],
      cacheHits: 0,
      cacheMisses: 0
    }
  }
}

// Create global monitor instance
const performanceMonitor = new PerformanceMonitor()

export default performanceMonitor
