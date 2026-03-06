/**
 * Route Prefetch Composable
 *
 * Preloads route components on hover/focus for faster navigation.
 * Uses Intersection Observer for visible links and hover for others.
 *
 * @example
 * // In component
 * const { prefetchRoute, onLinkHover, onLinkVisible } = useRoutePrefetch()
 *
 * // In template
 * <router-link :to="path" @mouseenter="onLinkHover(path)" />
 */

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { logger } from '@/utils/logger'

// Cache of already prefetched routes
const prefetchedRoutes = new Set()

// Pending prefetch timers (for debouncing)
const pendingPrefetch = new Map()

// Default delay before prefetching (ms)
const PREFETCH_DELAY = 100

export function useRoutePrefetch(options = {}) {
  const router = useRouter()
  const { delay = PREFETCH_DELAY } = options

  /**
   * Prefetch a route's component by path
   * @param {string} path - Route path to prefetch
   */
  async function prefetchRoute(path) {
    if (!path || prefetchedRoutes.has(path)) {
      return
    }

    try {
      // Find matching route
      const resolved = router.resolve(path)
      if (!resolved || !resolved.matched.length) {
        return
      }

      // Get all matched route components
      for (const match of resolved.matched) {
        const components = match.components
        if (!components) continue

        // Prefetch each component
        for (const [name, component] of Object.entries(components)) {
          if (typeof component === 'function') {
            // This is a lazy-loaded component - trigger the import
            try {
              await component()
              logger.debug(`✅ Prefetched: ${path} (${name})`)
            } catch (err) {
              // Silently fail - component will be loaded on navigation
              logger.debug(`⚠️ Prefetch failed: ${path}`, err.message)
            }
          }
        }
      }

      prefetchedRoutes.add(path)
    } catch (err) {
      logger.debug(`Prefetch error for ${path}:`, err)
    }
  }

  /**
   * Handle link hover - prefetch after short delay
   * @param {string} path - Route path
   */
  function onLinkHover(path) {
    if (!path || prefetchedRoutes.has(path)) {
      return
    }

    // Clear any existing timer for this path
    if (pendingPrefetch.has(path)) {
      clearTimeout(pendingPrefetch.get(path))
    }

    // Set new timer
    const timer = setTimeout(() => {
      prefetchRoute(path)
      pendingPrefetch.delete(path)
    }, delay)

    pendingPrefetch.set(path, timer)
  }

  /**
   * Cancel pending prefetch on mouse leave
   * @param {string} path - Route path
   */
  function onLinkLeave(path) {
    if (pendingPrefetch.has(path)) {
      clearTimeout(pendingPrefetch.get(path))
      pendingPrefetch.delete(path)
    }
  }

  /**
   * Handle link focus (keyboard navigation)
   * @param {string} path - Route path
   */
  function onLinkFocus(path) {
    onLinkHover(path)
  }

  /**
   * Check if route was already prefetched
   * @param {string} path - Route path
   * @returns {boolean}
   */
  function isPrefetched(path) {
    return prefetchedRoutes.has(path)
  }

  /**
   * Get prefetch stats
   * @returns {{ count: number, routes: string[] }}
   */
  function getPrefetchStats() {
    return {
      count: prefetchedRoutes.size,
      routes: Array.from(prefetchedRoutes)
    }
  }

  /**
   * Prefetch multiple routes at once (e.g., on app init)
   * @param {string[]} paths - Array of route paths
   */
  async function prefetchRoutes(paths) {
    await Promise.allSettled(paths.map(p => prefetchRoute(p)))
  }

  /**
   * Clear prefetch cache (for testing/debugging)
   */
  function clearPrefetchCache() {
    prefetchedRoutes.clear()
    pendingPrefetch.forEach(timer => clearTimeout(timer))
    pendingPrefetch.clear()
  }

  return {
    prefetchRoute,
    onLinkHover,
    onLinkLeave,
    onLinkFocus,
    isPrefetched,
    getPrefetchStats,
    prefetchRoutes,
    clearPrefetchCache
  }
}

/**
 * Vue directive for automatic prefetch on hover
 *
 * @example
 * <router-link v-prefetch :to="/dashboard">Dashboard</router-link>
 */
export const vPrefetch = {
  mounted(el, binding) {
    const path = binding.value || el.getAttribute('href') || el.getAttribute('to')
    if (!path) return

    const { prefetchRoute } = useRoutePrefetch()

    let timer = null

    el.addEventListener('mouseenter', () => {
      timer = setTimeout(() => prefetchRoute(path), PREFETCH_DELAY)
    })

    el.addEventListener('mouseleave', () => {
      if (timer) clearTimeout(timer)
    })

    el.addEventListener('focus', () => {
      timer = setTimeout(() => prefetchRoute(path), PREFETCH_DELAY)
    })
  }
}

export default useRoutePrefetch
