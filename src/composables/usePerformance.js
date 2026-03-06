import { logger } from '@/utils/logger'
/**
 * Performance Monitoring Composable
 * Tracks Web Vitals metrics (LCP, FID, CLS, FCP, TTFB)
 */

import { onMounted } from 'vue'

export function usePerformance() {
  const reportWebVitals = (onPerfEntry) => {
    if (onPerfEntry && onPerfEntry instanceof Function) {
      import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
        onCLS(onPerfEntry)
        onFID(onPerfEntry)
        onFCP(onPerfEntry)
        onLCP(onPerfEntry)
        onTTFB(onPerfEntry)
      })
    }
  }

  const logMetric = ({ name, value, rating, delta, id }) => {
    // Log to console in development
    if (import.meta.env.DEV) {
      logger.debug(`[Performance] ${name}:`, {
        value: `${Math.round(value)}ms`,
        rating,
        delta: `${Math.round(delta)}ms`,
        id,
      })
    }

    // Send to analytics in production (optional)
    if (import.meta.env.PROD && window.gtag) {
      window.gtag('event', name, {
        event_category: 'Web Vitals',
        value: Math.round(value),
        event_label: id,
        non_interaction: true,
      })
    }

    // Could also send to custom analytics endpoint
    // fetch('/api/metrics/web-vitals', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ name, value, rating, delta, id })
    // })
  }

  onMounted(() => {
    // Start tracking Web Vitals
    reportWebVitals(logMetric)
  })

  return {
    reportWebVitals,
  }
}

/**
 * Resource Timing API - Monitor resource loading performance
 */
export function useResourceTiming() {
  const getResourceTimings = () => {
    if (!window.performance || !window.performance.getEntriesByType) {
      return []
    }

    return window.performance.getEntriesByType('resource').map((entry) => ({
      name: entry.name,
      duration: Math.round(entry.duration),
      size: entry.transferSize,
      type: entry.initiatorType,
    }))
  }

  const getLargestResources = (limit = 10) => {
    const resources = getResourceTimings()
    return resources
      .filter((r) => r.size > 0)
      .sort((a, b) => b.size - a.size)
      .slice(0, limit)
  }

  const getSlowestResources = (limit = 10) => {
    const resources = getResourceTimings()
    return resources.sort((a, b) => b.duration - a.duration).slice(0, limit)
  }

  return {
    getResourceTimings,
    getLargestResources,
    getSlowestResources,
  }
}

/**
 * Navigation Timing API - Monitor page load performance
 */
export function useNavigationTiming() {
  const getNavigationTiming = () => {
    if (!window.performance || !window.performance.timing) {
      return null
    }

    const timing = window.performance.timing
    const navigation = {
      // DNS lookup time
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      // TCP connection time
      tcp: timing.connectEnd - timing.connectStart,
      // Request time
      request: timing.responseStart - timing.requestStart,
      // Response time
      response: timing.responseEnd - timing.responseStart,
      // DOM processing time
      domProcessing: timing.domComplete - timing.domLoading,
      // Total page load time
      totalLoadTime: timing.loadEventEnd - timing.navigationStart,
      // Time to first byte
      ttfb: timing.responseStart - timing.navigationStart,
      // DOM ready time
      domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
    }

    return navigation
  }

  onMounted(() => {
    // Wait for page to fully load
    window.addEventListener('load', () => {
      setTimeout(() => {
        const timing = getNavigationTiming()
        if (timing && import.meta.env.DEV) {
          logger.debug('[Navigation Timing]', timing)
        }
      }, 0)
    })
  })

  return {
    getNavigationTiming,
  }
}

/**
 * Lazy load images with Intersection Observer
 */
export function useLazyLoad() {
  const lazyLoadImages = (selector = 'img[data-src]') => {
    if (!('IntersectionObserver' in window)) {
      // Fallback for older browsers
      document.querySelectorAll(selector).forEach((img) => {
        img.src = img.dataset.src
        if (img.dataset.srcset) {
          img.srcset = img.dataset.srcset
        }
      })
      return
    }

    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target
          img.src = img.dataset.src
          if (img.dataset.srcset) {
            img.srcset = img.dataset.srcset
          }
          img.classList.remove('lazy')
          observer.unobserve(img)
        }
      })
    })

    document.querySelectorAll(selector).forEach((img) => {
      imageObserver.observe(img)
    })
  }

  const lazyLoadComponents = (selector = '[data-lazy]') => {
    if (!('IntersectionObserver' in window)) {
      return
    }

    const componentObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target
          element.classList.add('lazy-loaded')
          observer.unobserve(element)
        }
      })
    })

    document.querySelectorAll(selector).forEach((element) => {
      componentObserver.observe(element)
    })
  }

  return {
    lazyLoadImages,
    lazyLoadComponents,
  }
}
