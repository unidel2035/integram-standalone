/**
 * Performance Monitoring Utility
 *
 * Tracks route chunk load times, failures, and overall application performance.
 * Provides insights for optimization and debugging.
 *
 * Usage:
 *   import { trackRouteLoad, getPerformanceReport } from '@/utils/performanceMonitor'
 *
 *   // In router afterEach hook
 *   router.afterEach((to, from) => {
 *     trackRouteLoad(to.path, performance.now())
 *   })
 *
 *   // Get performance report
 *   const report = getPerformanceReport()
 *   console.log(report)
 */

// Performance metrics storage
const metrics = {
  routeLoads: [], // { path, timestamp, duration, success }
  chunkFailures: [], // { chunk, error, timestamp }
  navigationTimes: [], // { from, to, duration, timestamp }
  resourceHints: {
    prefetched: new Set(), // Prefetched chunk names
    preloaded: new Set(), // Preloaded chunk names
  },
}

// Configuration
const CONFIG = {
  maxStoredMetrics: 1000, // Maximum metrics to keep in memory
  slowLoadThreshold: 3000, // Consider load slow if > 3s
  reportInterval: 60000, // Auto-report every 60s (if enabled)
  enableAutoReporting: false, // Set to true to enable automatic reporting
}

/**
 * Track a route load event
 *
 * @param {string} path - Route path
 * @param {number} startTime - Performance.now() when route load started
 * @param {boolean} success - Whether load was successful
 */
export function trackRouteLoad(path, startTime, success = true) {
  const duration = performance.now() - startTime

  const metric = {
    path,
    timestamp: Date.now(),
    duration: Math.round(duration),
    success,
  }

  metrics.routeLoads.push(metric)

  // Trim old metrics if exceeds max
  if (metrics.routeLoads.length > CONFIG.maxStoredMetrics) {
    metrics.routeLoads.shift()
  }

  // Log slow loads
  if (duration > CONFIG.slowLoadThreshold) {
    console.warn(`[Performance] Slow route load: ${path} took ${duration.toFixed(0)}ms`)
  }

  return metric
}

/**
 * Track a chunk load failure
 *
 * @param {string} chunkName - Name of the chunk that failed
 * @param {Error} error - Error object
 */
export function trackChunkFailure(chunkName, error) {
  const failure = {
    chunk: chunkName,
    error: error.message,
    stack: error.stack,
    timestamp: Date.now(),
  }

  metrics.chunkFailures.push(failure)

  // Trim old failures
  if (metrics.chunkFailures.length > CONFIG.maxStoredMetrics) {
    metrics.chunkFailures.shift()
  }

  console.error(`[Performance] Chunk load failed: ${chunkName}`, error)

  return failure
}

/**
 * Track a navigation event
 *
 * @param {string} from - Previous route path
 * @param {string} to - New route path
 * @param {number} startTime - Performance.now() when navigation started
 */
export function trackNavigation(from, to, startTime) {
  const duration = performance.now() - startTime

  const metric = {
    from,
    to,
    duration: Math.round(duration),
    timestamp: Date.now(),
  }

  metrics.navigationTimes.push(metric)

  // Trim old metrics
  if (metrics.navigationTimes.length > CONFIG.maxStoredMetrics) {
    metrics.navigationTimes.shift()
  }

  return metric
}

/**
 * Track prefetched resources
 *
 * @param {string} resourceName - Name of prefetched resource
 */
export function trackPrefetch(resourceName) {
  metrics.resourceHints.prefetched.add(resourceName)
}

/**
 * Track preloaded resources
 *
 * @param {string} resourceName - Name of preloaded resource
 */
export function trackPreload(resourceName) {
  metrics.resourceHints.preloaded.add(resourceName)
}

/**
 * Calculate statistics from metrics
 */
function calculateStats(values) {
  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0, p95: 0, p99: 0 }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const sum = sorted.reduce((acc, val) => acc + val, 0)

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length),
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  }
}

/**
 * Get performance report
 *
 * @returns {object} Performance report with statistics
 */
export function getPerformanceReport() {
  // Route load stats
  const successfulLoads = metrics.routeLoads.filter((m) => m.success)
  const failedLoads = metrics.routeLoads.filter((m) => !m.success)
  const loadDurations = successfulLoads.map((m) => m.duration)

  // Navigation stats
  const navigationDurations = metrics.navigationTimes.map((m) => m.duration)

  // Slowest routes
  const routeLoadsByPath = {}
  successfulLoads.forEach((load) => {
    if (!routeLoadsByPath[load.path]) {
      routeLoadsByPath[load.path] = []
    }
    routeLoadsByPath[load.path].push(load.duration)
  })

  const slowestRoutes = Object.entries(routeLoadsByPath)
    .map(([path, durations]) => ({
      path,
      avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      loadCount: durations.length,
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 10)

  // Most failed routes
  const failuresByPath = {}
  failedLoads.forEach((load) => {
    failuresByPath[load.path] = (failuresByPath[load.path] || 0) + 1
  })

  const mostFailedRoutes = Object.entries(failuresByPath)
    .map(([path, count]) => ({ path, failureCount: count }))
    .sort((a, b) => b.failureCount - a.failureCount)
    .slice(0, 10)

  // Chunk failures
  const failuresByChunk = {}
  metrics.chunkFailures.forEach((failure) => {
    failuresByChunk[failure.chunk] = (failuresByChunk[failure.chunk] || 0) + 1
  })

  const topFailedChunks = Object.entries(failuresByChunk)
    .map(([chunk, count]) => ({ chunk, failureCount: count }))
    .sort((a, b) => b.failureCount - a.failureCount)
    .slice(0, 10)

  return {
    summary: {
      totalRouteLoads: metrics.routeLoads.length,
      successfulLoads: successfulLoads.length,
      failedLoads: failedLoads.length,
      successRate: metrics.routeLoads.length > 0
        ? Math.round((successfulLoads.length / metrics.routeLoads.length) * 100)
        : 0,
      totalNavigations: metrics.navigationTimes.length,
      totalChunkFailures: metrics.chunkFailures.length,
      prefetchedResources: metrics.resourceHints.prefetched.size,
      preloadedResources: metrics.resourceHints.preloaded.size,
    },

    routeLoadTimes: {
      ...calculateStats(loadDurations),
      slowLoads: successfulLoads.filter((m) => m.duration > CONFIG.slowLoadThreshold).length,
    },

    navigationTimes: calculateStats(navigationDurations),

    slowestRoutes,
    mostFailedRoutes,
    topFailedChunks,

    recentFailures: metrics.chunkFailures.slice(-10).reverse(),

    resourceHints: {
      prefetched: Array.from(metrics.resourceHints.prefetched),
      preloaded: Array.from(metrics.resourceHints.preloaded),
    },
  }
}

/**
 * Print performance report to console
 */
export function printPerformanceReport() {
  const report = getPerformanceReport()

  console.log('\n📊 Performance Report')
  console.log('=====================\n')

  console.log('📈 Summary:')
  console.log(`   Total route loads: ${report.summary.totalRouteLoads}`)
  console.log(`   Success rate: ${report.summary.successRate}%`)
  console.log(`   Failed loads: ${report.summary.failedLoads}`)
  console.log(`   Total navigations: ${report.summary.totalNavigations}`)
  console.log(`   Chunk failures: ${report.summary.totalChunkFailures}`)
  console.log(`   Prefetched resources: ${report.summary.prefetchedResources}`)
  console.log(`   Preloaded resources: ${report.summary.preloadedResources}\n`)

  console.log('⏱️  Route Load Times:')
  console.log(`   Min: ${report.routeLoadTimes.min}ms`)
  console.log(`   Avg: ${report.routeLoadTimes.avg}ms`)
  console.log(`   Median: ${report.routeLoadTimes.median}ms`)
  console.log(`   95th percentile: ${report.routeLoadTimes.p95}ms`)
  console.log(`   99th percentile: ${report.routeLoadTimes.p99}ms`)
  console.log(`   Max: ${report.routeLoadTimes.max}ms`)
  console.log(`   Slow loads (>${CONFIG.slowLoadThreshold}ms): ${report.routeLoadTimes.slowLoads}\n`)

  if (report.slowestRoutes.length > 0) {
    console.log('🐌 Slowest Routes:')
    report.slowestRoutes.forEach((route, index) => {
      console.log(`   ${index + 1}. ${route.path} - ${route.avgDuration}ms avg (${route.loadCount} loads)`)
    })
    console.log('')
  }

  if (report.mostFailedRoutes.length > 0) {
    console.log('❌ Most Failed Routes:')
    report.mostFailedRoutes.forEach((route, index) => {
      console.log(`   ${index + 1}. ${route.path} - ${route.failureCount} failures`)
    })
    console.log('')
  }

  if (report.topFailedChunks.length > 0) {
    console.log('💥 Top Failed Chunks:')
    report.topFailedChunks.forEach((chunk, index) => {
      console.log(`   ${index + 1}. ${chunk.chunk} - ${chunk.failureCount} failures`)
    })
    console.log('')
  }

  console.log('=====================\n')

  return report
}

/**
 * Clear all metrics
 */
export function clearMetrics() {
  metrics.routeLoads = []
  metrics.chunkFailures = []
  metrics.navigationTimes = []
  metrics.resourceHints.prefetched.clear()
  metrics.resourceHints.preloaded.clear()

  console.log('[Performance] Metrics cleared')
}

/**
 * Export metrics as JSON
 */
export function exportMetrics() {
  return {
    ...metrics,
    resourceHints: {
      prefetched: Array.from(metrics.resourceHints.prefetched),
      preloaded: Array.from(metrics.resourceHints.preloaded),
    },
    exportedAt: new Date().toISOString(),
  }
}

/**
 * Start automatic reporting (if enabled)
 */
export function startAutoReporting() {
  if (!CONFIG.enableAutoReporting) {
    return
  }

  setInterval(() => {
    printPerformanceReport()
  }, CONFIG.reportInterval)

  console.log(`[Performance] Auto-reporting enabled (every ${CONFIG.reportInterval}ms)`)
}

// Make performance monitor globally accessible in development
if (import.meta.env.DEV) {
  window.__performanceMonitor = {
    getReport: getPerformanceReport,
    printReport: printPerformanceReport,
    clearMetrics,
    exportMetrics,
    trackRouteLoad,
    trackChunkFailure,
    trackNavigation,
  }

  console.log('[Performance] Monitor available at window.__performanceMonitor')
}

export default {
  trackRouteLoad,
  trackChunkFailure,
  trackNavigation,
  trackPrefetch,
  trackPreload,
  getPerformanceReport,
  printPerformanceReport,
  clearMetrics,
  exportMetrics,
  startAutoReporting,
}
