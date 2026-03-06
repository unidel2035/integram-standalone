/**
 * Image Service - Comprehensive image sourcing and management
 * Supports: Free stock photos (Unsplash, Pexels), AI generation, animated icons
 */

const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY || 'demo'
const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY || 'demo'

/**
 * Image source providers
 */
export const ImageProviders = {
  UNSPLASH: 'unsplash',
  PEXELS: 'pexels',
  PIXABAY: 'pixabay',
  AI_GENERATED: 'ai',
  LOTTIE: 'lottie',
  LOCAL: 'local'
}

/**
 * Fetch images from Unsplash
 * @param {string} query - Search query
 * @param {number} perPage - Number of results
 * @returns {Promise<Array>} Array of image objects
 */
export async function searchUnsplash(query, perPage = 10) {
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&client_id=${UNSPLASH_ACCESS_KEY}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`)
    }

    const data = await response.json()

    return data.results.map(img => ({
      id: img.id,
      provider: ImageProviders.UNSPLASH,
      url: img.urls.regular,
      thumbnail: img.urls.thumb,
      description: img.description || img.alt_description,
      author: img.user.name,
      authorUrl: img.user.links.html,
      downloadUrl: img.links.download,
      width: img.width,
      height: img.height,
      color: img.color
    }))
  } catch (error) {
    console.error('Unsplash search error:', error)
    return []
  }
}

/**
 * Fetch images from Pexels
 * @param {string} query - Search query
 * @param {number} perPage - Number of results
 * @returns {Promise<Array>} Array of image objects
 */
export async function searchPexels(query, perPage = 10) {
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`

    const response = await fetch(url, {
      headers: {
        'Authorization': PEXELS_API_KEY
      }
    })

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`)
    }

    const data = await response.json()

    return data.photos.map(img => ({
      id: img.id,
      provider: ImageProviders.PEXELS,
      url: img.src.large,
      thumbnail: img.src.tiny,
      description: img.alt,
      author: img.photographer,
      authorUrl: img.photographer_url,
      width: img.width,
      height: img.height,
      color: img.avg_color
    }))
  } catch (error) {
    console.error('Pexels search error:', error)
    return []
  }
}

/**
 * Fetch curated Lottie animations from LottieFiles
 * @param {string} category - Animation category
 * @returns {Promise<Array>} Array of animation objects
 */
export async function searchLottieAnimations(category = 'business') {
  try {
    // LottieFiles public API endpoint
    const url = `https://lottiefiles.com/api/v1/featured?category=${encodeURIComponent(category)}`

    const response = await fetch(url)
    if (!response.ok) {
      // Fallback to popular animations
      return getPopularLottieAnimations()
    }

    const data = await response.json()

    return data.data.map(anim => ({
      id: anim.id,
      provider: ImageProviders.LOTTIE,
      name: anim.name,
      url: anim.lottie_url,
      thumbnailUrl: anim.thumbnail_url,
      description: anim.description,
      author: anim.created_by?.name,
      authorUrl: anim.created_by?.url
    }))
  } catch (error) {
    console.error('Lottie search error:', error)
    return getPopularLottieAnimations()
  }
}

/**
 * Popular Lottie animations (fallback)
 */
function getPopularLottieAnimations() {
  return [
    {
      id: 'business-1',
      provider: ImageProviders.LOTTIE,
      name: 'Business Growth',
      url: 'https://assets9.lottiefiles.com/packages/lf20_w51pcehl.json',
      description: 'Animated business growth chart'
    },
    {
      id: 'ai-1',
      provider: ImageProviders.LOTTIE,
      name: 'AI Brain',
      url: 'https://assets2.lottiefiles.com/packages/lf20_vnikrcia.json',
      description: 'Animated AI brain'
    },
    {
      id: 'team-1',
      provider: ImageProviders.LOTTIE,
      name: 'Team Collaboration',
      url: 'https://assets4.lottiefiles.com/packages/lf20_kyu7xb1v.json',
      description: 'Animated team working together'
    },
    {
      id: 'automation-1',
      provider: ImageProviders.LOTTIE,
      name: 'Automation',
      url: 'https://assets3.lottiefiles.com/packages/lf20_dmw9u9az.json',
      description: 'Automated processes'
    }
  ]
}

/**
 * Generate image using AI (integrated with DronDoc token system)
 * @param {string} prompt - Image generation prompt
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated image object
 */
export async function generateImageWithAI(prompt, options = {}) {
  try {
    const {
      model = 'dall-e-3',
      size = '1024x1024',
      quality = 'standard',
      style = 'natural'
    } = options

    // Get user's default token from AI token service
    const userId = getCurrentUserId()
    const { token } = await getDefaultToken(userId)

    // Call orchestrator AI image generation endpoint
    const response = await fetch('/api/ai-tokens/image-generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.id}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        model,
        size,
        quality,
        style,
        application: 'ImageManagement',
        operation: 'generate'
      })
    })

    if (!response.ok) {
      throw new Error(`AI image generation failed: ${response.status}`)
    }

    const data = await response.json()

    return {
      id: `ai-${Date.now()}`,
      provider: ImageProviders.AI_GENERATED,
      url: data.url,
      prompt,
      model,
      revisedPrompt: data.revised_prompt,
      width: parseInt(size.split('x')[0]),
      height: parseInt(size.split('x')[1])
    }
  } catch (error) {
    console.error('AI image generation error:', error)
    throw error
  }
}

/**
 * Helper to get current user ID from auth
 */
function getCurrentUserId() {
  // Get from localStorage or auth store
  const userId = localStorage.getItem('id')
  if (!userId) {
    throw new Error('User not authenticated')
  }
  return userId
}

/**
 * Helper to get default AI token (placeholder - will use actual aiTokenService)
 */
async function getDefaultToken(userId) {
  // Import the actual service when available
  // For now, return a placeholder
  return {
    token: {
      id: 'placeholder-token',
      token_balance: 1000000
    }
  }
}

/**
 * Search images from all providers
 * @param {string} query - Search query
 * @param {Array<string>} providers - List of providers to search
 * @returns {Promise<Object>} Results grouped by provider
 */
export async function searchAllProviders(query, providers = [ImageProviders.UNSPLASH, ImageProviders.PEXELS]) {
  const results = {}

  const promises = providers.map(async provider => {
    switch (provider) {
      case ImageProviders.UNSPLASH:
        results[provider] = await searchUnsplash(query)
        break
      case ImageProviders.PEXELS:
        results[provider] = await searchPexels(query)
        break
      case ImageProviders.LOTTIE:
        results[provider] = await searchLottieAnimations(query)
        break
      default:
        results[provider] = []
    }
  })

  await Promise.all(promises)

  return results
}

/**
 * Predefined thematic image sets for landing pages
 */
export const ThematicImageSets = {
  business: {
    keywords: ['business team', 'office collaboration', 'digital workspace', 'business meeting'],
    lottieCategory: 'business'
  },
  ai: {
    keywords: ['artificial intelligence', 'machine learning', 'ai technology', 'neural network'],
    lottieCategory: 'technology'
  },
  development: {
    keywords: ['software development', 'coding', 'programming', 'developer workspace'],
    lottieCategory: 'technology'
  },
  automation: {
    keywords: ['automation', 'workflow', 'process automation', 'digital transformation'],
    lottieCategory: 'business'
  },
  growth: {
    keywords: ['business growth', 'success', 'chart analytics', 'investment'],
    lottieCategory: 'business'
  },
  integration: {
    keywords: ['system integration', 'api connection', 'cloud services', 'network'],
    lottieCategory: 'technology'
  }
}

/**
 * Get themed images for a specific category
 * @param {string} theme - Theme category
 * @param {number} count - Number of images to return
 * @returns {Promise<Array>} Array of themed images
 */
export async function getThemedImages(theme, count = 5) {
  const themeConfig = ThematicImageSets[theme]
  if (!themeConfig) {
    console.warn(`Unknown theme: ${theme}`)
    return []
  }

  // Pick random keyword from theme
  const keyword = themeConfig.keywords[Math.floor(Math.random() * themeConfig.keywords.length)]

  // Search from multiple providers
  const results = await searchAllProviders(keyword, [ImageProviders.UNSPLASH, ImageProviders.PEXELS])

  // Flatten and limit results
  const allImages = [
    ...(results[ImageProviders.UNSPLASH] || []),
    ...(results[ImageProviders.PEXELS] || [])
  ]

  return allImages.slice(0, count)
}

/**
 * Save image to local storage for later use
 * @param {Object} image - Image object
 * @returns {string} Local storage key
 */
export function saveImageToLocalStorage(image) {
  const key = `image-${image.provider}-${image.id}`
  localStorage.setItem(key, JSON.stringify(image))
  return key
}

/**
 * Get saved image from local storage
 * @param {string} key - Storage key
 * @returns {Object|null} Image object or null
 */
export function getSavedImage(key) {
  const data = localStorage.getItem(key)
  return data ? JSON.parse(data) : null
}

/**
 * Image library for landing pages (curated)
 */
export const LandingImageLibrary = {
  hero: {
    business: [
      'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200',
      'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200'
    ],
    ai: [
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200',
      'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200'
    ],
    automation: [
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200',
      'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=1200'
    ]
  },
  valueProposition: {
    businessOwners: [
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800'
    ],
    developers: [
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800',
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800'
    ],
    engineers: [
      'https://images.unsplash.com/photo-1581092918484-8313feb7c0c6?w=800',
      'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800'
    ],
    investors: [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800'
    ]
  }
}

export default {
  searchUnsplash,
  searchPexels,
  searchLottieAnimations,
  searchAllProviders,
  generateImageWithAI,
  getThemedImages,
  saveImageToLocalStorage,
  getSavedImage,
  ImageProviders,
  ThematicImageSets,
  LandingImageLibrary
}
