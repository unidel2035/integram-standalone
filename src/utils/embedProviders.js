/**
 * Embed Providers Utility
 * Detects and transforms URLs for embedding external content
 *
 * Issue #6886: Universal Embed block for block-editor
 */

/**
 * Provider configuration
 * Each provider has detection patterns and URL transformation logic
 */
export const EMBED_PROVIDERS = {
  // Design and Prototypes
  figma: {
    name: 'Figma',
    patterns: [
      /figma\.com\/(design|proto|file)\//,
      /figma\.com\/([a-z0-9]+\/)?file\//
    ],
    transform: (url) => {
      // Extract file ID from Figma URL
      const match = url.match(/figma\.com\/(?:design|proto|file)\/([a-zA-Z0-9]+)/)
      if (match) {
        return `https://www.figma.com/embed?embed_host=dronedoc&url=${encodeURIComponent(url)}`
      }
      return url
    },
    defaultHeight: 450,
    sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms'
  },

  miro: {
    name: 'Miro',
    patterns: [/miro\.com\/app\/board\//],
    transform: (url) => {
      // Miro boards can be embedded directly
      if (url.includes('?')) {
        return url + '&embedMode=view_only'
      }
      return url + '?embedMode=view_only'
    },
    defaultHeight: 450,
    sandbox: 'allow-scripts allow-same-origin allow-popups'
  },

  excalidraw: {
    name: 'Excalidraw',
    patterns: [/excalidraw\.com/],
    transform: (url) => url,
    defaultHeight: 450,
    sandbox: 'allow-scripts allow-same-origin'
  },

  // Video
  youtube: {
    name: 'YouTube',
    patterns: [
      /youtube\.com\/watch/,
      /youtu\.be\//,
      /youtube\.com\/embed\//
    ],
    transform: (url) => {
      // Extract video ID from various YouTube URL formats
      let videoId = null

      // youtu.be/VIDEO_ID
      const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
      if (shortMatch) {
        videoId = shortMatch[1]
      }

      // youtube.com/watch?v=VIDEO_ID
      const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/)
      if (watchMatch) {
        videoId = watchMatch[1]
      }

      // youtube.com/embed/VIDEO_ID
      const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/)
      if (embedMatch) {
        videoId = embedMatch[1]
      }

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`
      }
      return url
    },
    defaultHeight: 400,
    sandbox: 'allow-scripts allow-same-origin allow-presentation'
  },

  vimeo: {
    name: 'Vimeo',
    patterns: [/vimeo\.com\//],
    transform: (url) => {
      // Extract video ID from Vimeo URL
      const match = url.match(/vimeo\.com\/([0-9]+)/)
      if (match) {
        return `https://player.vimeo.com/video/${match[1]}`
      }
      return url
    },
    defaultHeight: 400,
    sandbox: 'allow-scripts allow-same-origin'
  },

  rutube: {
    name: 'RuTube',
    patterns: [/rutube\.ru\/video\//],
    transform: (url) => {
      // Extract video ID from RuTube URL
      const match = url.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)/)
      if (match) {
        return `https://rutube.ru/play/embed/${match[1]}`
      }
      return url
    },
    defaultHeight: 400,
    sandbox: 'allow-scripts allow-same-origin'
  },

  loom: {
    name: 'Loom',
    patterns: [/loom\.com\/share\//],
    transform: (url) => {
      // Loom share links can be converted to embed
      const match = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)
      if (match) {
        return `https://www.loom.com/embed/${match[1]}`
      }
      return url
    },
    defaultHeight: 400,
    sandbox: 'allow-scripts allow-same-origin'
  },

  // Documents and Spreadsheets
  'google-docs': {
    name: 'Google Docs',
    patterns: [/docs\.google\.com\/document\//],
    transform: (url) => {
      // Convert Google Docs URL to embed format
      if (url.includes('/edit')) {
        return url.replace('/edit', '/preview')
      }
      if (!url.includes('/preview')) {
        return url + '/preview'
      }
      return url
    },
    defaultHeight: 600,
    sandbox: 'allow-scripts allow-same-origin allow-popups'
  },

  'google-sheets': {
    name: 'Google Sheets',
    patterns: [/docs\.google\.com\/spreadsheets\//],
    transform: (url) => {
      // Convert Google Sheets URL to embed format
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
      if (match) {
        const docId = match[1]
        return `https://docs.google.com/spreadsheets/d/${docId}/preview`
      }
      return url
    },
    defaultHeight: 600,
    sandbox: 'allow-scripts allow-same-origin'
  },

  'google-slides': {
    name: 'Google Slides',
    patterns: [/docs\.google\.com\/presentation\//],
    transform: (url) => {
      // Convert Google Slides URL to embed format
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
      if (match) {
        const docId = match[1]
        return `https://docs.google.com/presentation/d/${docId}/embed`
      }
      return url
    },
    defaultHeight: 500,
    sandbox: 'allow-scripts allow-same-origin'
  },

  pdf: {
    name: 'PDF',
    patterns: [/\.pdf($|\?)/i],
    transform: (url) => url,
    defaultHeight: 600,
    sandbox: 'allow-scripts allow-same-origin',
    useObject: true // Use <object> tag instead of iframe for better PDF support
  },

  // Code
  'github-gist': {
    name: 'GitHub Gist',
    patterns: [/gist\.github\.com\//],
    transform: (url) => url,
    defaultHeight: 400,
    sandbox: 'allow-scripts allow-same-origin',
    useScript: true // Gists use script embed
  },

  codepen: {
    name: 'CodePen',
    patterns: [/codepen\.io\/.*\/pen\//],
    transform: (url) => {
      // Convert CodePen URL to embed format
      const match = url.match(/codepen\.io\/([^\/]+)\/pen\/([a-zA-Z0-9]+)/)
      if (match) {
        const [, user, penId] = match
        return `https://codepen.io/${user}/embed/${penId}?default-tab=result`
      }
      return url
    },
    defaultHeight: 400,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups'
  },

  codesandbox: {
    name: 'CodeSandbox',
    patterns: [/codesandbox\.io\/s\//],
    transform: (url) => {
      // Convert CodeSandbox URL to embed format
      const match = url.match(/codesandbox\.io\/s\/([a-zA-Z0-9-]+)/)
      if (match) {
        return `https://codesandbox.io/embed/${match[1]}`
      }
      return url
    },
    defaultHeight: 500,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals'
  },

  stackblitz: {
    name: 'StackBlitz',
    patterns: [/stackblitz\.com\/edit\//],
    transform: (url) => {
      // Convert StackBlitz URL to embed format
      return url.replace('/edit/', '/edit/') + '?embed=1'
    },
    defaultHeight: 500,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals'
  },

  // Social Media
  telegram: {
    name: 'Telegram',
    patterns: [/t\.me\//],
    transform: (url) => url,
    defaultHeight: 400,
    sandbox: 'allow-scripts allow-same-origin',
    useScript: true, // Telegram uses widget script
    requiresSpecialHandling: true
  },

  twitter: {
    name: 'Twitter/X',
    patterns: [
      /twitter\.com\/.*\/status\//,
      /x\.com\/.*\/status\//
    ],
    transform: (url) => url,
    defaultHeight: 500,
    sandbox: 'allow-scripts allow-same-origin allow-popups',
    useScript: true, // Twitter uses embed script
    requiresSpecialHandling: true
  },

  vk: {
    name: 'VK',
    patterns: [
      /vk\.com\/wall-/,
      /vk\.com\/video/
    ],
    transform: (url) => url,
    defaultHeight: 400,
    sandbox: 'allow-scripts allow-same-origin allow-popups',
    requiresSpecialHandling: true // VK uses widgets API
  },

  // Maps
  'yandex-maps': {
    name: 'Yandex Maps',
    patterns: [/yandex\.ru\/maps/],
    transform: (url) => {
      // Yandex Maps embed
      if (!url.includes('?')) {
        return url + '?iframe=1'
      }
      return url + '&iframe=1'
    },
    defaultHeight: 400,
    sandbox: 'allow-scripts allow-same-origin'
  },

  'google-maps': {
    name: 'Google Maps',
    patterns: [/maps\.google\.com/, /google\.com\/maps/],
    transform: (url) => {
      // Extract coordinates or place from Google Maps URL
      // This is simplified - Google Maps embed requires API key for full functionality
      return url
    },
    defaultHeight: 400,
    sandbox: 'allow-scripts allow-same-origin'
  },

  '2gis': {
    name: '2GIS',
    patterns: [/2gis\.ru\//],
    transform: (url) => url,
    defaultHeight: 400,
    sandbox: 'allow-scripts allow-same-origin'
  }
}

/**
 * Detect provider from URL
 * @param {string} url - The URL to check
 * @returns {string|null} - Provider key or null if no match
 */
export function detectProvider(url) {
  if (!url) return null

  for (const [key, provider] of Object.entries(EMBED_PROVIDERS)) {
    for (const pattern of provider.patterns) {
      if (pattern.test(url)) {
        return key
      }
    }
  }

  // Default to iframe for any other URL
  return 'iframe'
}

/**
 * Get provider configuration
 * @param {string} providerKey - Provider key
 * @returns {object} - Provider configuration
 */
export function getProvider(providerKey) {
  return EMBED_PROVIDERS[providerKey] || {
    name: 'IFrame',
    transform: (url) => url,
    defaultHeight: 400,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups'
  }
}

/**
 * Transform URL for embedding
 * @param {string} url - Original URL
 * @param {string} providerKey - Provider key (optional, will auto-detect)
 * @returns {object} - { embedUrl, provider, providerConfig }
 */
export function transformUrlForEmbed(url, providerKey = null) {
  if (!url) {
    return { embedUrl: '', provider: null, providerConfig: null }
  }

  // Auto-detect provider if not specified
  const provider = providerKey || detectProvider(url)
  const providerConfig = getProvider(provider)

  // Transform URL using provider's transformation logic
  const embedUrl = providerConfig.transform(url)

  return {
    embedUrl,
    provider,
    providerConfig
  }
}

/**
 * Get list of all supported providers
 * @returns {Array} - List of provider info
 */
export function getSupportedProviders() {
  return Object.entries(EMBED_PROVIDERS).map(([key, config]) => ({
    key,
    name: config.name,
    patterns: config.patterns.map(p => p.toString())
  }))
}

/**
 * Validate if URL is safe for embedding
 * Uses a whitelist approach - only known providers are allowed
 * @param {string} url - URL to validate
 * @returns {object} - { valid: boolean, warning: string|null }
 */
export function validateEmbedUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, warning: 'URL обязателен' }
  }

  // Check if URL is valid
  try {
    new URL(url)
  } catch {
    return { valid: false, warning: 'Некорректный URL' }
  }

  // Check if provider is known
  const provider = detectProvider(url)

  if (provider === 'iframe') {
    // Unknown provider - show warning but allow
    return {
      valid: true,
      warning: 'Неизвестный провайдер. Содержимое будет встроено через iframe. Убедитесь, что источник безопасен.'
    }
  }

  return { valid: true, warning: null }
}

/**
 * Available height options for embed blocks
 */
export const HEIGHT_OPTIONS = [
  { label: '300px', value: 300 },
  { label: '400px', value: 400 },
  { label: '450px', value: 450 },
  { label: '500px', value: 500 },
  { label: '600px', value: 600 },
  { label: '700px', value: 700 },
  { label: '800px', value: 800 },
  { label: 'Кастомная', value: 'custom' }
]

/**
 * Width options for embed blocks
 */
export const WIDTH_OPTIONS = [
  { label: '100%', value: '100%' },
  { label: '80%', value: '80%' },
  { label: '60%', value: '60%' },
  { label: '600px', value: '600px' },
  { label: '800px', value: '800px' },
  { label: '1000px', value: '1000px' }
]
