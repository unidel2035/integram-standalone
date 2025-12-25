/**
 * Local Placeholder Utility
 * Maps CDN placeholder URLs to local SVG placeholders
 */

/**
 * Placeholder URL mappings
 */
const PLACEHOLDER_MAPPINGS = {
  // via.placeholder.com patterns
  'via.placeholder.com/48': '/img/placeholders/48x48-product.svg',
  'via.placeholder.com/150': '/img/placeholders/150x150-no-image.svg',
  'via.placeholder.com/200': '/img/placeholders/200x200.svg',
  'via.placeholder.com/300': '/img/placeholders/300x300.svg',
  'via.placeholder.com/400x300': '/img/placeholders/400x300-product.svg',
  'via.placeholder.com/600x150': '/img/placeholders/600x150-survey.svg',

  // picsum.photos patterns
  'picsum.photos/1920/1080': '/img/placeholders/1920x1080-random.svg'
}

/**
 * Get local placeholder URL from CDN URL
 * @param {string} cdnUrl - CDN placeholder URL
 * @returns {string} Local placeholder URL
 */
export function getLocalPlaceholder(cdnUrl) {
  if (!cdnUrl) return ''

  // Check for exact matches in mappings
  for (const [pattern, localPath] of Object.entries(PLACEHOLDER_MAPPINGS)) {
    if (cdnUrl.includes(pattern)) {
      return localPath
    }
  }

  // If no mapping found, generate a dynamic SVG placeholder
  // Extract dimensions from URL
  const dimensionMatch = cdnUrl.match(/(\d+)x?(\d*)/i)
  if (dimensionMatch) {
    const width = dimensionMatch[1]
    const height = dimensionMatch[2] || width
    return generatePlaceholderDataUrl(width, height, 'Image')
  }

  // Fallback to a generic placeholder
  return '/img/placeholders/300x300.svg'
}

/**
 * Generate an inline SVG data URL placeholder
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {string} text - Text to display
 * @returns {string} Data URL for SVG
 */
export function generatePlaceholderDataUrl(width, height, text = '') {
  const displayText = text || `${width}×${height}`
  const fontSize = Math.min(width, height) / 8

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#e0e7ff"/>
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="${fontSize}px"
        fill="#4f46e5"
      >${displayText}</text>
    </svg>
  `.trim()

  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}

/**
 * Replace CDN placeholder in image element
 * @param {HTMLImageElement} imgElement - Image element
 */
export function replaceImagePlaceholder(imgElement) {
  if (!imgElement || !imgElement.src) return

  const localUrl = getLocalPlaceholder(imgElement.src)
  if (localUrl && !imgElement.src.startsWith('data:')) {
    imgElement.src = localUrl
  }
}

/**
 * Error handler for image load failures
 * Replaces failed image with local placeholder
 * @param {Event} event - Error event
 */
export function handleImageError(event) {
  const img = event.target
  if (!img) return

  // Don't loop on errors
  if (img.dataset.errorHandled) return
  img.dataset.errorHandled = 'true'

  // Try to use a local no-image placeholder
  img.src = '/img/placeholders/150x150-no-image.svg'
}

/**
 * Vue composable for local placeholders
 * @returns {Object} Placeholder utilities
 */
export function usePlaceholders() {
  return {
    getLocalPlaceholder,
    generatePlaceholderDataUrl,
    handleImageError,
    replaceImagePlaceholder
  }
}

export default {
  getLocalPlaceholder,
  generatePlaceholderDataUrl,
  replaceImagePlaceholder,
  handleImageError,
  usePlaceholders
}
