/**
 * Performance Tracking Utility
 *
 * Measures and logs Web Vitals and custom performance metrics
 * for the DronDoc application.
 *
 * Metrics tracked:
 * - LCP (Largest Contentful Paint)
 * - FID (First Input Delay)
 * - CLS (Cumulative Layout Shift)
 * - FCP (First Contentful Paint)
 * - TTFB (Time to First Byte)
 * - Custom: Time to Interactive, Router Ready Time
 */

import { logger } from '@/utils/logger'

/**
 * Check if a performance entry type is supported by the browser
 * @param {string} entryType - The entry type to check (e.g., 'layout-shift', 'largest-contentful-paint')
 * @returns {boolean} - True if supported, false otherwise
 */
function isEntryTypeSupported(entryType) {
  // Check if PerformanceObserver exists
  if (!('PerformanceObserver' in window)) {
    return false
  }

  // Use supportedEntryTypes if available (Chrome 73+, Firefox 68+)
  if (PerformanceObserver.supportedEntryTypes) {
    return PerformanceObserver.supportedEntryTypes.includes(entryType)
  }

  // Fallback: try to create an observer and see if it throws
  // This is for older browsers that don't have supportedEntryTypes
  try {
    const testObserver = new PerformanceObserver(() => {})
    testObserver.observe({ entryTypes: [entryType] })
    testObserver.disconnect()
    return true
  } catch (e) {
    return false
  }
}

/**
 * Track performance metric and log it
 */
function trackMetric(name, value, rating) {
  const metric = {
    name,
    value: Math.round(value),
    rating,
    timestamp: Date.now(),
    url: window.location.pathname
  }

  // Log to console in development
  if (import.meta.env.DEV) {
    const emoji = rating === 'good' ? '✅' : rating === 'needs-improvement' ? '🟡' : '🔴'
    logger.info(`${emoji} [Performance] ${name}: ${metric.value}ms (${rating})`)
  }

  // Store metrics for analytics
  if (!window.performanceMetrics) {
    window.performanceMetrics = []
  }
  window.performanceMetrics.push(metric)

  // Send to analytics if available
  if (window.analytics && typeof window.analytics.track === 'function') {
    window.analytics.track('performance_metric', metric)
  }
}

/**
 * Get rating for metric based on Web Vitals thresholds
 */
function getRating(name, value) {
  const thresholds = {
    'LCP': { good: 2500, poor: 4000 },
    'FID': { good: 100, poor: 300 },
    'CLS': { good: 0.1, poor: 0.25 },
    'FCP': { good: 1800, poor: 3000 },
    'TTFB': { good: 600, poor: 1500 },
    'TTI': { good: 3800, poor: 7300 }
  }

  const threshold = thresholds[name]
  if (!threshold) return 'unknown'

  if (value <= threshold.good) return 'good'
  if (value <= threshold.poor) return 'needs-improvement'
  return 'poor'
}

/**
 * Measure Largest Contentful Paint (LCP)
 */
function measureLCP() {
  if (!('PerformanceObserver' in window)) return

  // Check if largest-contentful-paint is supported before observing
  if (!isEntryTypeSupported('largest-contentful-paint')) {
    logger.debug('[Performance] LCP measurement not supported (largest-contentful-paint entry type unavailable)')
    return
  }

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]

      if (lastEntry) {
        const value = lastEntry.renderTime || lastEntry.loadTime
        trackMetric('LCP', value, getRating('LCP', value))
      }
    })

    observer.observe({ entryTypes: ['largest-contentful-paint'] })
  } catch (e) {
    logger.warn('[Performance] LCP measurement failed:', e.message)
  }
}

/**
 * Measure First Input Delay (FID)
 */
function measureFID() {
  if (!('PerformanceObserver' in window)) return

  // Check if first-input is supported before observing
  if (!isEntryTypeSupported('first-input')) {
    logger.debug('[Performance] FID measurement not supported (first-input entry type unavailable)')
    return
  }

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()

      entries.forEach((entry) => {
        const value = entry.processingStart - entry.startTime
        trackMetric('FID', value, getRating('FID', value))
      })
    })

    observer.observe({ entryTypes: ['first-input'] })
  } catch (e) {
    logger.warn('[Performance] FID measurement failed:', e.message)
  }
}

/**
 * Measure Cumulative Layout Shift (CLS)
 */
function measureCLS() {
  if (!('PerformanceObserver' in window)) return

  // Check if layout-shift is supported before observing
  if (!isEntryTypeSupported('layout-shift')) {
    logger.debug('[Performance] CLS measurement not supported (layout-shift entry type unavailable)')
    return
  }

  try {
    let clsValue = 0

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()

      entries.forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value
        }
      })

      trackMetric('CLS', clsValue * 1000, getRating('CLS', clsValue)) // Convert to ms for consistency
    })

    observer.observe({ entryTypes: ['layout-shift'] })
  } catch (e) {
    logger.warn('[Performance] CLS measurement failed:', e.message)
  }
}

/**
 * Measure First Contentful Paint (FCP)
 */
function measureFCP() {
  if (!window.performance || !window.performance.getEntriesByName) return

  try {
    const paintEntries = performance.getEntriesByType('paint')
    const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint')

    if (fcpEntry) {
      trackMetric('FCP', fcpEntry.startTime, getRating('FCP', fcpEntry.startTime))
    }
  } catch (e) {
    logger.warn('[Performance] FCP measurement failed')
  }
}

/**
 * Measure Time to First Byte (TTFB)
 */
function measureTTFB() {
  if (!window.performance || !window.performance.timing) return

  try {
    const { responseStart, requestStart } = performance.timing
    const ttfb = responseStart - requestStart

    if (ttfb > 0) {
      trackMetric('TTFB', ttfb, getRating('TTFB', ttfb))
    }
  } catch (e) {
    logger.warn('[Performance] TTFB measurement failed')
  }
}

/**
 * Measure custom app metrics
 */
function measureCustomMetrics() {
  // Measure time from navigation to router ready
  if (window.performance && window.performance.timing && window.routerReadyTime) {
    const routerReadyDuration = window.routerReadyTime - performance.timing.navigationStart
    trackMetric('Router Ready', routerReadyDuration, getRating('TTI', routerReadyDuration))
  }

  // Measure time from navigation to app mounted
  if (window.performance && window.performance.timing && window.appMountedTime) {
    const appMountedDuration = window.appMountedTime - performance.timing.navigationStart
    trackMetric('App Mounted', appMountedDuration, getRating('TTI', appMountedDuration))
  }
}

/**
 * Initialize performance tracking
 * Should be called after DOM is ready
 */
export function initPerformanceTracking() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startTracking()
    })
  } else {
    startTracking()
  }
}

function startTracking() {
  logger.info('🚀 [Performance] Starting performance tracking...')

  // Measure Web Vitals
  measureLCP()
  measureFID()
  measureCLS()
  measureFCP()
  measureTTFB()

  // Measure custom metrics after a short delay
  setTimeout(() => {
    measureCustomMetrics()
  }, 500)

  // Log summary after page load is complete
  window.addEventListener('load', () => {
    setTimeout(() => {
      logPerformanceSummary()
    }, 1000)
  })
}

/**
 * Log performance summary
 */
function logPerformanceSummary() {
  if (!window.performanceMetrics || window.performanceMetrics.length === 0) {
    logger.warn('[Performance] No metrics collected')
    return
  }

  logger.group('[Performance] Summary')

  window.performanceMetrics.forEach(metric => {
    const emoji = metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '🟡' : '🔴'
    logger.info(`${emoji} ${metric.name}: ${metric.value}ms (${metric.rating})`)
  })

  logger.groupEnd()

  // Calculate overall score
  const goodCount = window.performanceMetrics.filter(m => m.rating === 'good').length
  const totalCount = window.performanceMetrics.length
  const score = Math.round((goodCount / totalCount) * 100)

  logger.info(`📊 [Performance] Overall Score: ${score}% (${goodCount}/${totalCount} metrics passing)`)
}

/**
 * Get all collected metrics
 */
export function getPerformanceMetrics() {
  return window.performanceMetrics || []
}

/**
 * Clear collected metrics
 */
export function clearPerformanceMetrics() {
  window.performanceMetrics = []
}
