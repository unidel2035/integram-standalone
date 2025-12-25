/**
 * Utility for lazy loading Chart.js library
 *
 * Issue #4393: Chart.js is a heavy library that's not needed on all pages.
 * This utility ensures it's only loaded when actually needed.
 *
 * Usage in components:
 * ```js
 * import { loadChartJS } from '@/utils/lazyLoadChartJS'
 *
 * async function createChart() {
 *   const { Chart, registerables } = await loadChartJS()
 *   // Use Chart here
 * }
 * ```
 */

let chartModule = null
let chartRegistered = false

/**
 * Lazy load Chart.js library (singleton pattern - loads only once)
 * @returns {Promise<Object>} Chart.js module with Chart and registerables
 */
export async function loadChartJS() {
  if (!chartModule) {
    chartModule = await import('chart.js')
    if (!chartRegistered) {
      chartModule.Chart.register(...chartModule.registerables)
      chartRegistered = true
    }
  }
  return chartModule
}
