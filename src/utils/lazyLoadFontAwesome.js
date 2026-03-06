/**
 * Utility for lazy loading FontAwesome CSS
 *
 * Issue #4432: FontAwesome CSS (~200-400KB) is eagerly loaded in main.js,
 * increasing initial bundle size even if not all icons are used on first page.
 *
 * This utility ensures FontAwesome is only loaded when actually needed,
 * with retry logic for production reliability.
 *
 * Usage in components:
 * ```js
 * import { loadFontAwesome } from '@/utils/lazyLoadFontAwesome'
 *
 * onMounted(async () => {
 *   if (needsFontAwesome) {
 *     await loadFontAwesome()
 *   }
 * })
 * ```
 */

import { logger } from './logger'
import { retryDynamicImport } from './dynamicImport'

let fontAwesomeLoaded = false
let fontAwesomePromise = null

/**
 * Lazy load FontAwesome CSS (singleton pattern - loads only once)
 * @returns {Promise<void>} Resolves when FontAwesome is loaded
 */
export async function loadFontAwesome() {
  // If already loaded, return immediately
  if (fontAwesomeLoaded) {
    logger.debug('✅ FontAwesome already loaded')
    return
  }

  // If loading is in progress, wait for it
  if (fontAwesomePromise) {
    logger.debug('⏳ FontAwesome loading in progress, waiting...')
    return fontAwesomePromise
  }

  // Start loading with retry logic
  logger.info('📦 Loading FontAwesome CSS...')
  fontAwesomePromise = retryDynamicImport(
    () => import('@fortawesome/fontawesome-free/css/all.css'),
    3, // max retries
    1000 // base delay in ms
  )
    .then(() => {
      fontAwesomeLoaded = true
      logger.info('✅ FontAwesome CSS loaded successfully')
    })
    .catch((error) => {
      logger.error('❌ Failed to load FontAwesome CSS:', error)
      fontAwesomePromise = null // Reset promise to allow retry
      throw error
    })

  return fontAwesomePromise
}

/**
 * Check if FontAwesome is loaded
 * @returns {boolean} True if FontAwesome CSS is loaded
 */
export function isFontAwesomeLoaded() {
  return fontAwesomeLoaded
}

/**
 * Preload FontAwesome CSS in the background (for optimization)
 * This can be called during idle time to prefetch FontAwesome
 * without blocking the main thread.
 *
 * Usage:
 * ```js
 * requestIdleCallback(() => {
 *   preloadFontAwesome()
 * })
 * ```
 */
export function preloadFontAwesome() {
  if (!fontAwesomeLoaded && !fontAwesomePromise) {
    logger.debug('🔄 Preloading FontAwesome in background...')
    loadFontAwesome().catch(() => {
      // Silently fail for preload - not critical
    })
  }
}
