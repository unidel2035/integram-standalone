/**
 * Application Performance Monitoring (APM)
 * Tracks page load times, API calls, and custom metrics
 */

import { logger } from './logger'

class PerformanceMonitor {
  constructor() {
    this.enabled = import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true'
    this.metrics = new Map()
    this.observers = []
    this.eventListeners = [] // Track event listeners for cleanup
  }

  /**
   * Initialize performance monitoring
   */
  init() {
    if (!this.enabled) {
      logger.debug('Performance monitoring is disabled')
      return
    }

    // Monitor page load performance
    this._monitorPageLoad()

    // Monitor long tasks
    this._monitorLongTasks()

    // Monitor resource loading
    this._monitorResources()

    logger.info('Performance monitoring initialized')
  }

  /**
   * Monitor page load metrics
   */
  _monitorPageLoad() {
    if (typeof window === 'undefined' || !window.performance) return

    const loadHandler = () => {
      // Use setTimeout to ensure all metrics are available
      setTimeout(() => {
        const perfData = performance.getEntriesByType('navigation')[0]

        if (perfData) {
          const metrics = {
            dns: perfData.domainLookupEnd - perfData.domainLookupStart,
            tcp: perfData.connectEnd - perfData.connectStart,
            ttfb: perfData.responseStart - perfData.requestStart,
            download: perfData.responseEnd - perfData.responseStart,
            domInteractive: perfData.domInteractive,
            domComplete: perfData.domComplete,
            loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
            total: perfData.loadEventEnd
          }

          logger.info('Page load metrics', metrics)
          this._sendMetric('page_load', metrics)
        }

        // Web Vitals
        this._measureWebVitals()
      }, 0)
    }

    window.addEventListener('load', loadHandler)
    this.eventListeners.push({ target: window, event: 'load', handler: loadHandler })
  }

  /**
   * Measure Core Web Vitals
   */
  _measureWebVitals() {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          const lastEntry = entries[entries.length - 1]

          logger.info('LCP', { value: lastEntry.renderTime || lastEntry.loadTime })
          this._sendMetric('lcp', { value: lastEntry.renderTime || lastEntry.loadTime })
        })

        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.push(lcpObserver)
      } catch (e) {
        logger.warn('LCP observer not supported', { error: e.message })
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          entries.forEach(entry => {
            logger.info('FID', { value: entry.processingStart - entry.startTime })
            this._sendMetric('fid', { value: entry.processingStart - entry.startTime })
          })
        })

        fidObserver.observe({ entryTypes: ['first-input'] })
        this.observers.push(fidObserver)
      } catch (e) {
        logger.warn('FID observer not supported', { error: e.message })
      }

      // Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0
        const clsObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
            }
          }
        })

        clsObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.push(clsObserver)

        // Report CLS on page hide
        const visibilityChangeHandler = () => {
          if (document.visibilityState === 'hidden') {
            logger.info('CLS', { value: clsValue })
            this._sendMetric('cls', { value: clsValue })
          }
        }

        window.addEventListener('visibilitychange', visibilityChangeHandler)
        this.eventListeners.push({ target: window, event: 'visibilitychange', handler: visibilityChangeHandler })
      } catch (e) {
        logger.warn('CLS observer not supported', { error: e.message })
      }
    }
  }

  /**
   * Monitor long tasks (tasks taking >50ms)
   */
  _monitorLongTasks() {
    if (!('PerformanceObserver' in window)) return

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          logger.warn('Long task detected', {
            duration: entry.duration,
            startTime: entry.startTime
          })

          this._sendMetric('long_task', {
            duration: entry.duration,
            startTime: entry.startTime
          })
        }
      })

      observer.observe({ entryTypes: ['longtask'] })
      this.observers.push(observer)
    } catch (e) {
      logger.debug('Long task monitoring not supported', { error: e.message })
    }
  }

  /**
   * Monitor resource loading
   */
  _monitorResources() {
    if (!window.performance || !window.performance.getEntriesByType) return

    const resourceLoadHandler = () => {
      setTimeout(() => {
        const resources = performance.getEntriesByType('resource')

        const slowResources = resources.filter(r => r.duration > 1000)

        if (slowResources.length > 0) {
          logger.warn('Slow resources detected', {
            count: slowResources.length,
            resources: slowResources.map(r => ({
              name: r.name,
              duration: r.duration,
              type: r.initiatorType
            }))
          })
        }

        // Calculate total resource size and count by type
        const byType = {}
        resources.forEach(r => {
          if (!byType[r.initiatorType]) {
            byType[r.initiatorType] = { count: 0, size: 0, duration: 0 }
          }
          byType[r.initiatorType].count++
          byType[r.initiatorType].size += r.transferSize || 0
          byType[r.initiatorType].duration += r.duration
        })

        logger.info('Resource loading summary', byType)
        this._sendMetric('resources', byType)
      }, 0)
    }

    window.addEventListener('load', resourceLoadHandler)
    this.eventListeners.push({ target: window, event: 'load', handler: resourceLoadHandler })
  }

  /**
   * Track custom metric
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {Object} tags - Additional tags
   */
  trackMetric(name, value, tags = {}) {
    if (!this.enabled) return

    const metric = {
      name,
      value,
      tags,
      timestamp: Date.now()
    }

    this.metrics.set(name, metric)
    logger.debug('Custom metric tracked', metric)
    this._sendMetric(name, { value, ...tags })
  }

  /**
   * Measure execution time of a function
   * @param {string} name - Operation name
   * @param {Function} fn - Function to measure
   */
  async measure(name, fn) {
    const startTime = performance.now()

    try {
      const result = await fn()
      const duration = performance.now() - startTime

      logger.debug(`${name} completed`, { duration })
      this._sendMetric(name, { duration, success: true })

      return result
    } catch (error) {
      const duration = performance.now() - startTime

      logger.error(`${name} failed`, { duration, error: error.message })
      this._sendMetric(name, { duration, success: false, error: error.message })

      throw error
    }
  }

  /**
   * Start a manual performance mark
   * @param {string} name - Mark name
   */
  mark(name) {
    if (!this.enabled || !performance.mark) return
    performance.mark(name)
  }

  /**
   * Measure time between two marks
   * @param {string} name - Measure name
   * @param {string} startMark - Start mark name
   * @param {string} endMark - End mark name
   */
  measureBetween(name, startMark, endMark) {
    if (!this.enabled || !performance.measure) return

    try {
      performance.measure(name, startMark, endMark)
      const measure = performance.getEntriesByName(name)[0]

      logger.debug(`Performance measure: ${name}`, { duration: measure.duration })
      this._sendMetric(name, { duration: measure.duration })

      return measure.duration
    } catch (error) {
      logger.warn(`Failed to measure ${name}`, { error: error.message })
    }
  }

  /**
   * Send metric to external monitoring service
   * @param {string} name - Metric name
   * @param {Object} data - Metric data
   */
  _sendMetric(name, data) {
    // This is a hook for sending metrics to external services
    // like Grafana, Prometheus, DataDog, etc.
    // Implementation depends on the chosen service

    if (window.dataLayer) {
      // Send to Google Analytics / Tag Manager if available
      window.dataLayer.push({
        event: 'performance_metric',
        metricName: name,
        metricData: data
      })
    }
  }

  /**
   * Get all collected metrics
   */
  getMetrics() {
    return Object.fromEntries(this.metrics)
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics.clear()
  }

  /**
   * Cleanup observers
   */
  destroy() {
    // Disconnect all performance observers
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []

    // Remove all event listeners
    this.eventListeners.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler)
    })
    this.eventListeners = []

    // Clear metrics
    this.metrics.clear()
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Export class for testing
export { PerformanceMonitor }
