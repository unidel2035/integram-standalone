/**
 * Image Lazy Loading Utilities (Issue #4171)
 *
 * Provides utilities for:
 * - Lazy loading images using Intersection Observer
 * - Modern image format detection (WebP, AVIF)
 * - Responsive image loading
 * - Progressive image loading with blur effect
 *
 * Usage:
 * 1. Add class="lazy" and data-src attribute to images:
 *    <img data-src="image.jpg" class="lazy" alt="Description">
 *
 * 2. Initialize lazy loading in your component or main.js:
 *    import { initImageLazyLoading } from '@/utils/imageLazyLoad'
 *    initImageLazyLoading()
 *
 * 3. For responsive images:
 *    <img
 *      data-src="image-large.jpg"
 *      data-srcset="image-small.jpg 480w, image-medium.jpg 768w, image-large.jpg 1200w"
 *      class="lazy"
 *      alt="Description"
 *    >
 */

/**
 * Initialize image lazy loading using Intersection Observer
 * @param {Object} options - Configuration options
 * @param {string} options.selector - CSS selector for lazy images (default: 'img.lazy')
 * @param {number} options.rootMargin - Margin around viewport to start loading (default: '50px')
 * @param {number} options.threshold - Visibility threshold to trigger loading (default: 0.01)
 * @returns {IntersectionObserver} The observer instance
 */
export function initImageLazyLoading(options = {}) {
  const {
    selector = 'img.lazy',
    rootMargin = '50px',
    threshold = 0.01
  } = options

  // Check for Intersection Observer support
  if (!('IntersectionObserver' in window)) {
    console.warn('[Image Lazy Load] IntersectionObserver not supported, loading all images immediately')
    loadAllImagesImmediately(selector)
    return null
  }

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target
        loadImage(img)
        observer.unobserve(img)
      }
    })
  }, {
    rootMargin,
    threshold
  })

  // Observe all lazy images
  const images = document.querySelectorAll(selector)
  images.forEach((img) => {
    imageObserver.observe(img)
  })

  console.log(`[Image Lazy Load] Initialized for ${images.length} images`)

  return imageObserver
}

/**
 * Load a single image and handle srcset
 * @param {HTMLImageElement} img - The image element to load
 */
function loadImage(img) {
  const src = img.dataset.src
  const srcset = img.dataset.srcset

  if (!src && !srcset) {
    console.warn('[Image Lazy Load] No data-src or data-srcset found for image:', img)
    return
  }

  // Add loading class for CSS transitions
  img.classList.add('loading')

  // Create a new image to preload
  const tempImage = new Image()

  tempImage.onload = () => {
    // Set the actual src/srcset once loaded
    if (src) {
      img.src = src
    }
    if (srcset) {
      img.srcset = srcset
    }

    // Remove lazy class and add loaded class
    img.classList.remove('lazy', 'loading')
    img.classList.add('loaded')

    // Remove data attributes to prevent re-loading
    delete img.dataset.src
    delete img.dataset.srcset
  }

  tempImage.onerror = () => {
    console.error('[Image Lazy Load] Failed to load image:', src || srcset)
    img.classList.remove('lazy', 'loading')
    img.classList.add('error')

    // Set alt text as placeholder on error
    if (img.alt) {
      img.setAttribute('aria-label', `Failed to load: ${img.alt}`)
    }
  }

  // Start loading
  if (srcset) {
    tempImage.srcset = srcset
  }
  if (src) {
    tempImage.src = src
  }
}

/**
 * Fallback for browsers without Intersection Observer
 * Loads all images immediately
 * @param {string} selector - CSS selector for lazy images
 */
function loadAllImagesImmediately(selector) {
  const images = document.querySelectorAll(selector)
  images.forEach(loadImage)
}

/**
 * Check if browser supports WebP format
 * @returns {Promise<boolean>} True if WebP is supported
 */
export function supportsWebP() {
  return new Promise((resolve) => {
    const webp = new Image()
    webp.onload = () => resolve(webp.width === 1)
    webp.onerror = () => resolve(false)
    webp.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='
  })
}

/**
 * Check if browser supports AVIF format
 * @returns {Promise<boolean>} True if AVIF is supported
 */
export function supportsAVIF() {
  return new Promise((resolve) => {
    const avif = new Image()
    avif.onload = () => resolve(avif.width === 1)
    avif.onerror = () => resolve(false)
    avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A='
  })
}

/**
 * Detect supported modern image formats
 * Caches results to avoid repeated checks
 * @returns {Promise<Object>} Object with webp and avif boolean properties
 */
let formatSupportCache = null

export async function detectImageFormatSupport() {
  if (formatSupportCache) {
    return formatSupportCache
  }

  const [webp, avif] = await Promise.all([
    supportsWebP(),
    supportsAVIF()
  ])

  formatSupportCache = { webp, avif }

  console.log('[Image Lazy Load] Format support:', formatSupportCache)

  return formatSupportCache
}

/**
 * Get optimal image source based on format support
 * @param {Object} sources - Object with different format sources
 * @param {string} sources.avif - AVIF source URL
 * @param {string} sources.webp - WebP source URL
 * @param {string} sources.fallback - Fallback source URL (JPEG/PNG)
 * @returns {Promise<string>} The optimal source URL
 */
export async function getOptimalImageSource(sources) {
  const support = await detectImageFormatSupport()

  if (support.avif && sources.avif) {
    return sources.avif
  }

  if (support.webp && sources.webp) {
    return sources.webp
  }

  return sources.fallback
}

/**
 * Vue directive for lazy loading images
 * Usage: <img v-lazy="'/path/to/image.jpg'" alt="Description">
 *
 * This can be registered globally in main.js:
 * app.directive('lazy', lazyImageDirective)
 */
export const lazyImageDirective = {
  mounted(el, binding) {
    if (!('IntersectionObserver' in window)) {
      // Fallback for older browsers
      el.src = binding.value
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target
          img.src = binding.value
          img.classList.add('loaded')
          observer.unobserve(img)
        }
      })
    }, {
      rootMargin: '50px',
      threshold: 0.01
    })

    observer.observe(el)

    // Store observer on element for cleanup
    el._lazyObserver = observer
  },
  unmounted(el) {
    if (el._lazyObserver) {
      el._lazyObserver.disconnect()
      delete el._lazyObserver
    }
  }
}

/**
 * Composable for lazy loading images in Vue 3
 * Usage in component:
 *
 * import { useLazyImage } from '@/utils/imageLazyLoad'
 *
 * const { imgRef } = useLazyImage('/path/to/image.jpg', {
 *   onLoad: () => console.log('Image loaded'),
 *   onError: () => console.log('Image failed')
 * })
 *
 * <img ref="imgRef" alt="Description">
 */
export function useLazyImage(src, options = {}) {
  const {
    onLoad = null,
    onError = null,
    rootMargin = '50px',
    threshold = 0.01
  } = options

  const imgRef = (el) => {
    if (!el) return

    if (!('IntersectionObserver' in window)) {
      el.src = src
      if (onLoad) el.addEventListener('load', onLoad)
      if (onError) el.addEventListener('error', onError)
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target
          img.src = src

          if (onLoad) img.addEventListener('load', onLoad)
          if (onError) img.addEventListener('error', onError)

          img.classList.add('loaded')
          observer.unobserve(img)
        }
      })
    }, { rootMargin, threshold })

    observer.observe(el)
  }

  return { imgRef }
}

/**
 * Get recommended CSS for lazy loaded images
 * Add this to your global styles or component styles
 */
export const lazyImageCSS = `
/* Lazy image styles */
img.lazy {
  opacity: 0;
  transition: opacity 0.3s ease-in-out;
}

img.lazy.loading {
  opacity: 0.5;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

img.lazy.loaded {
  opacity: 1;
}

img.lazy.error {
  opacity: 0.3;
  background: #f5f5f5;
  border: 1px dashed #ccc;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Optional: blur-up effect for progressive loading */
img.lazy.blur-up {
  filter: blur(10px);
  transition: filter 0.3s ease-in-out;
}

img.lazy.blur-up.loaded {
  filter: blur(0);
}
`
