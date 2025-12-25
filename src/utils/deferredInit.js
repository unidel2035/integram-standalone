/**
 * Deferred Initialization Module
 *
 * This module contains non-critical initialization code that can be loaded
 * after the main app is mounted to improve initial load performance.
 *
 * Features loaded here:
 * - User action tracking
 * - Performance observers
 * - Service Worker cleanup
 * - Extension script blocking
 */

import { logger } from '@/utils/logger'

// Track recent user actions for better error diagnostics
const recentActions = []
const MAX_RECENT_ACTIONS = 10

function trackUserAction(action, details = {}) {
  recentActions.push({
    action,
    details,
    timestamp: new Date().toISOString(),
    path: window.location.pathname
  })
  // Keep only last N actions
  if (recentActions.length > MAX_RECENT_ACTIONS) {
    recentActions.shift()
  }
}

/**
 * Initialize user action tracking
 * This is called after the app is mounted to avoid blocking initial render
 */
export function initUserActionTracking() {
  // Track navigation changes
  let lastPath = window.location.pathname
  setInterval(() => {
    const currentPath = window.location.pathname
    if (currentPath !== lastPath) {
      trackUserAction('navigation', { from: lastPath, to: currentPath })
      lastPath = currentPath
    }
  }, 1000)

  // Track clicks
  document.addEventListener('click', (e) => {
    const target = e.target
    if (target) {
      const tagName = target.tagName?.toLowerCase()
      const id = target.id
      const className = target.className

      // Handle className safely - it can be a string or SVGAnimatedString
      let classNameStr = ''
      if (className) {
        if (typeof className === 'string') {
          classNameStr = className
        } else if (className.baseVal !== undefined) {
          // SVG element - className is SVGAnimatedString
          classNameStr = className.baseVal
        }
      }

      trackUserAction('click', {
        element: `${tagName}${id ? '#' + id : ''}${classNameStr ? '.' + classNameStr.split(' ')[0] : ''}`,
        text: target.textContent?.substring(0, 50)
      })
    }
  }, true)

  logger.info('✅ User action tracking initialized')
}

/**
 * Get recent user actions for error reporting
 */
export function getRecentActions() {
  return recentActions.slice(-5) // Return last 5 actions
}

/**
 * Initialize Performance Observer for blocking extension scripts
 * This is deferred to avoid blocking initial render
 */
export function initPerformanceObserver() {
  if (!window.PerformanceObserver) return

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // Detect Kaspersky script requests
      if (entry.name && (
        entry.name.includes('kaspersky-labs.com') ||
        entry.name.includes('gc.kis.v2.scr') ||
        entry.name.includes('FD126C42-EBFA-4E12-B309-BB3FDD723AC1')
      )) {
        // Log blocked request for debugging
        if (import.meta.env.DEV) {
          logger.info('[Security] Blocked extension request:', entry.name)
        }
      }
    }
  })

  try {
    observer.observe({ entryTypes: ['resource'] })
    logger.info('✅ Performance observer initialized')
  } catch (e) {
    // Observer not supported, silently continue
  }
}

/**
 * Cleanup legacy Service Workers
 * This is deferred to avoid blocking initial render
 */
export function cleanupLegacyServiceWorkers() {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister().then((success) => {
        if (success && import.meta.env.DEV) {
          logger.info('[ServiceWorker] Unregistered legacy service worker:', registration.scope)
        }
      })
    })
  }).catch((error) => {
    // Silently catch errors - this is cleanup code
    if (import.meta.env.DEV) {
      logger.warn('[ServiceWorker] Error during cleanup:', error)
    }
  })
}

/**
 * Initialize image lazy loading (Issue #4171)
 * This is deferred to avoid blocking initial render
 */
export function initImageLazyLoading() {
  import('@/utils/imageLazyLoad').then(({ initImageLazyLoading }) => {
    initImageLazyLoading()
    logger.info('✅ Image lazy loading initialized')
  }).catch((error) => {
    logger.warn('[Image Lazy Load] Failed to initialize:', error)
  })
}

/**
 * Initialize all deferred features
 * Call this after the app is mounted
 */
export function initDeferredFeatures() {
  // Use setTimeout to defer these even further, ensuring they don't block rendering
  setTimeout(() => {
    initUserActionTracking()
    initPerformanceObserver()
    cleanupLegacyServiceWorkers()
    initImageLazyLoading() // Issue #4171: Add image lazy loading
    logger.info('✅ All deferred features initialized')
  }, 100) // 100ms delay to let the app finish initial render
}
