/**
 * Dynamic Import Helper with Retry Logic
 *
 * Handles failed dynamic imports gracefully with:
 * - Automatic retry on failure
 * - Better error messages
 * - Fallback to error page
 *
 * Common causes of dynamic import failures:
 * 1. Production server running dev mode instead of serving built dist/
 * 2. Incomplete deployment (build artifacts missing)
 * 3. Network issues or CDN cache problems
 * 4. Browser cache with stale chunk references
 *
 * @see https://github.com/unidel2035/dronedoc2025/issues/2686
 */

import { logger } from './logger'

/**
 * Retry a dynamic import with exponential backoff
 *
 * @param {Function} importFn - The import function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} baseDelay - Base delay in ms (default: 1000)
 * @returns {Promise} - The imported module
 */
export async function retryDynamicImport(importFn, maxRetries = 3, baseDelay = 1000) {
  let lastError = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`🔄 Dynamic import attempt ${attempt + 1}/${maxRetries + 1}`)
      return await importFn()
    } catch (error) {
      lastError = error

      // Log the error with context
      logger.error(`❌ Dynamic import failed (attempt ${attempt + 1}/${maxRetries + 1}):`, {
        error: error.message,
        stack: error.stack,
        attempt: attempt + 1,
        maxRetries: maxRetries + 1
      })

      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) // Exponential backoff
        logger.info(`⏳ Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // All retries failed
  logger.error('💥 Dynamic import failed after all retries', {
    error: lastError.message,
    stack: lastError.stack,
    attempts: maxRetries + 1
  })

  // Throw enhanced error with helpful message
  const enhancedError = new Error(
    `Failed to load module after ${maxRetries + 1} attempts. ` +
    `This usually means the production server is misconfigured or the build is incomplete. ` +
    `Original error: ${lastError.message}`
  )
  enhancedError.originalError = lastError
  enhancedError.isModuleLoadError = true

  throw enhancedError
}

/**
 * Create a wrapped dynamic import with retry logic
 *
 * @param {Function} importFn - The import function
 * @param {Object} options - Configuration options
 * @returns {Function} - Wrapped import function
 */
export function wrapDynamicImport(importFn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    fallback = null
  } = options

  return async () => {
    try {
      return await retryDynamicImport(importFn, maxRetries, baseDelay)
    } catch (error) {
      // If a fallback is provided, return it
      if (fallback) {
        logger.warn('⚠️ Using fallback component due to import failure', {
          error: error.message
        })
        return fallback
      }

      // Otherwise, re-throw the error
      throw error
    }
  }
}

/**
 * Check if the current environment is development
 *
 * @returns {boolean}
 */
export function isDevelopment() {
  return import.meta.env.MODE === 'development'
}

/**
 * Check if the server is running in dev mode (not serving built files)
 *
 * This checks if source files are being served directly,
 * which indicates the server is running `vite dev` instead of serving `dist/`
 *
 * @returns {boolean}
 */
export function isServerInDevMode() {
  // Check if we're trying to load .vue files directly
  const scripts = document.querySelectorAll('script[type="module"]')
  for (const script of scripts) {
    if (script.src && script.src.includes('/src/')) {
      logger.warn('⚠️ Detected server running in development mode (serving source files)')
      return true
    }
  }
  return false
}

/**
 * Suggest reload with cache clear if module load fails
 */
export function suggestCacheClear() {
  const message =
    '⚠️ Module loading failed. This could be due to:\n\n' +
    '1. Browser cache with stale references\n' +
    '2. Incomplete deployment\n' +
    '3. Server running in dev mode\n\n' +
    'Try: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac) to hard reload'

  logger.warn(message)

  // Show user-friendly message
  if (window.confirm(
    'Failed to load page component. This might be a caching issue.\n\n' +
    'Would you like to reload the page and clear cache?'
  )) {
    // Hard reload with cache clear
    // Note: reload(true) is deprecated, use cache control header or reload()
    window.location.reload()
  }
}

export default {
  retryDynamicImport,
  wrapDynamicImport,
  isDevelopment,
  isServerInDevMode,
  suggestCacheClear
}
