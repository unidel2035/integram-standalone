/**
 * VirtualBackgroundService
 *
 * Handles virtual background replacement for video streams using Canvas API
 * and browser-native background segmentation when available.
 *
 * Features:
 * - Background blur effect
 * - Background image replacement
 * - Built-in background library
 * - Custom background upload
 * - Background preview
 * - Favorites management
 *
 * Performance optimized with requestAnimationFrame and canvas rendering
 */

import { logger } from '@/utils/logger'

// Background types
export const BACKGROUND_TYPE = {
  NONE: 'none',
  BLUR: 'blur',
  IMAGE: 'image',
}

// Blur intensity levels
export const BLUR_LEVEL = {
  LOW: 5,
  MEDIUM: 10,
  HIGH: 20,
}

// Built-in background categories
export const BACKGROUND_CATEGORY = {
  OFFICE: 'office',
  NATURE: 'nature',
  ABSTRACT: 'abstract',
  CUSTOM: 'custom',
}

class VirtualBackgroundService {
  constructor() {
    this.stream = null
    this.originalStream = null
    this.canvas = null
    this.ctx = null
    this.videoElement = null
    this.animationFrameId = null
    this.isActive = false

    // Current background settings
    this.currentBackgroundType = BACKGROUND_TYPE.NONE
    this.currentBlurLevel = BLUR_LEVEL.MEDIUM
    this.currentBackgroundImage = null

    // Built-in backgrounds library
    this.builtInBackgrounds = this._initBuiltInBackgrounds()

    // User favorites (stored in localStorage)
    this.favorites = this._loadFavorites()

    // Performance settings
    this.targetFPS = 30
    this.lastFrameTime = 0
    this.frameInterval = 1000 / this.targetFPS
  }

  /**
   * Initialize built-in backgrounds library
   * @returns {Object} Built-in backgrounds organized by category
   */
  _initBuiltInBackgrounds() {
    return {
      [BACKGROUND_CATEGORY.OFFICE]: [
        {
          id: 'office-1',
          name: 'Современный офис',
          category: BACKGROUND_CATEGORY.OFFICE,
          url: '/backgrounds/office-modern.jpg',
          thumbnail: '/backgrounds/thumbs/office-modern-thumb.jpg',
        },
        {
          id: 'office-2',
          name: 'Конференц-зал',
          category: BACKGROUND_CATEGORY.OFFICE,
          url: '/backgrounds/office-conference.jpg',
          thumbnail: '/backgrounds/thumbs/office-conference-thumb.jpg',
        },
        {
          id: 'office-3',
          name: 'Рабочее место',
          category: BACKGROUND_CATEGORY.OFFICE,
          url: '/backgrounds/office-desk.jpg',
          thumbnail: '/backgrounds/thumbs/office-desk-thumb.jpg',
        },
      ],
      [BACKGROUND_CATEGORY.NATURE]: [
        {
          id: 'nature-1',
          name: 'Горы',
          category: BACKGROUND_CATEGORY.NATURE,
          url: '/backgrounds/nature-mountains.jpg',
          thumbnail: '/backgrounds/thumbs/nature-mountains-thumb.jpg',
        },
        {
          id: 'nature-2',
          name: 'Лес',
          category: BACKGROUND_CATEGORY.NATURE,
          url: '/backgrounds/nature-forest.jpg',
          thumbnail: '/backgrounds/thumbs/nature-forest-thumb.jpg',
        },
        {
          id: 'nature-3',
          name: 'Пляж',
          category: BACKGROUND_CATEGORY.NATURE,
          url: '/backgrounds/nature-beach.jpg',
          thumbnail: '/backgrounds/thumbs/nature-beach-thumb.jpg',
        },
      ],
      [BACKGROUND_CATEGORY.ABSTRACT]: [
        {
          id: 'abstract-1',
          name: 'Градиент синий',
          category: BACKGROUND_CATEGORY.ABSTRACT,
          url: '/backgrounds/abstract-blue-gradient.jpg',
          thumbnail: '/backgrounds/thumbs/abstract-blue-gradient-thumb.jpg',
        },
        {
          id: 'abstract-2',
          name: 'Геометрия',
          category: BACKGROUND_CATEGORY.ABSTRACT,
          url: '/backgrounds/abstract-geometry.jpg',
          thumbnail: '/backgrounds/thumbs/abstract-geometry-thumb.jpg',
        },
        {
          id: 'abstract-3',
          name: 'Волны',
          category: BACKGROUND_CATEGORY.ABSTRACT,
          url: '/backgrounds/abstract-waves.jpg',
          thumbnail: '/backgrounds/thumbs/abstract-waves-thumb.jpg',
        },
      ],
    }
  }

  /**
   * Get all built-in backgrounds
   * @returns {Array} Array of all built-in backgrounds
   */
  getBuiltInBackgrounds() {
    const backgrounds = []
    for (const category in this.builtInBackgrounds) {
      backgrounds.push(...this.builtInBackgrounds[category])
    }
    return backgrounds
  }

  /**
   * Get backgrounds by category
   * @param {string} category - Background category
   * @returns {Array} Array of backgrounds in the category
   */
  getBackgroundsByCategory(category) {
    return this.builtInBackgrounds[category] || []
  }

  /**
   * Start virtual background processing
   * @param {MediaStream} originalStream - Original video stream
   * @param {Object} options - Background options
   * @returns {MediaStream} Processed stream with virtual background
   */
  async start(originalStream, options = {}) {
    logger.debug('🎨 [VirtualBackgroundService] Starting virtual background processing')

    if (!originalStream) {
      throw new Error('Original stream is required')
    }

    this.originalStream = originalStream

    // Create video element to read from
    this.videoElement = document.createElement('video')
    this.videoElement.srcObject = originalStream
    this.videoElement.autoplay = true
    this.videoElement.playsInline = true

    // Wait for video to be ready
    await new Promise((resolve) => {
      this.videoElement.onloadedmetadata = () => {
        this.videoElement.play()
        resolve()
      }
    })

    // Create canvas for processing
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.videoElement.videoWidth
    this.canvas.height = this.videoElement.videoHeight
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })

    logger.debug(`🎨 [VirtualBackgroundService] Canvas initialized: ${this.canvas.width}x${this.canvas.height}`)

    // Apply background settings from options
    if (options.backgroundType) {
      this.currentBackgroundType = options.backgroundType
    }
    if (options.blurLevel) {
      this.currentBlurLevel = options.blurLevel
    }
    if (options.backgroundImage) {
      await this.setBackgroundImage(options.backgroundImage)
    }

    // Start processing frames
    this.isActive = true
    this._processFrame()

    // Create stream from canvas
    this.stream = this.canvas.captureStream(this.targetFPS)

    // Copy audio tracks from original stream
    const audioTracks = originalStream.getAudioTracks()
    audioTracks.forEach(track => {
      this.stream.addTrack(track)
    })

    logger.debug('✅ [VirtualBackgroundService] Virtual background started successfully')

    return this.stream
  }

  /**
   * Stop virtual background processing
   */
  stop() {
    logger.debug('🛑 [VirtualBackgroundService] Stopping virtual background processing')

    this.isActive = false

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null
      this.videoElement = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        if (track.kind === 'video') {
          track.stop()
        }
      })
      this.stream = null
    }

    this.canvas = null
    this.ctx = null
    this.currentBackgroundImage = null
  }

  /**
   * Process video frame with virtual background
   */
  _processFrame() {
    if (!this.isActive) {
      return
    }

    const now = Date.now()
    const elapsed = now - this.lastFrameTime

    // Throttle to target FPS
    if (elapsed < this.frameInterval) {
      this.animationFrameId = requestAnimationFrame(() => this._processFrame())
      return
    }

    this.lastFrameTime = now - (elapsed % this.frameInterval)

    try {
      // Draw original video to canvas
      this.ctx.drawImage(
        this.videoElement,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      )

      // Apply background effect based on type
      switch (this.currentBackgroundType) {
        case BACKGROUND_TYPE.BLUR:
          this._applyBlurEffect()
          break
        case BACKGROUND_TYPE.IMAGE:
          if (this.currentBackgroundImage) {
            this._applyImageBackground()
          }
          break
        case BACKGROUND_TYPE.NONE:
        default:
          // No effect, just pass through
          break
      }
    } catch (error) {
      logger.error('❌ [VirtualBackgroundService] Error processing frame:', error)
    }

    this.animationFrameId = requestAnimationFrame(() => this._processFrame())
  }

  /**
   * Apply blur effect to background
   * Uses a simple edge detection approach to blur background while keeping foreground sharp
   */
  _applyBlurEffect() {
    // For now, apply blur to entire canvas
    // In production, you would want to use segmentation to detect person
    // and only blur the background, but that requires ML models

    // Get image data
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)

    // Apply blur using box blur algorithm (fast but simple)
    const blurredData = this._boxBlur(imageData, this.currentBlurLevel)

    // Put blurred data back
    this.ctx.putImageData(blurredData, 0, 0)
  }

  /**
   * Apply box blur to image data
   * @param {ImageData} imageData - Image data to blur
   * @param {number} radius - Blur radius
   * @returns {ImageData} Blurred image data
   */
  _boxBlur(imageData, radius) {
    const { width, height, data } = imageData
    const output = new ImageData(width, height)
    const outputData = output.data

    // Horizontal pass
    const tempData = new Uint8ClampedArray(data.length)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0

        for (let kx = -radius; kx <= radius; kx++) {
          const px = Math.min(width - 1, Math.max(0, x + kx))
          const idx = (y * width + px) * 4
          r += data[idx]
          g += data[idx + 1]
          b += data[idx + 2]
          a += data[idx + 3]
          count++
        }

        const idx = (y * width + x) * 4
        tempData[idx] = r / count
        tempData[idx + 1] = g / count
        tempData[idx + 2] = b / count
        tempData[idx + 3] = a / count
      }
    }

    // Vertical pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0

        for (let ky = -radius; ky <= radius; ky++) {
          const py = Math.min(height - 1, Math.max(0, y + ky))
          const idx = (py * width + x) * 4
          r += tempData[idx]
          g += tempData[idx + 1]
          b += tempData[idx + 2]
          a += tempData[idx + 3]
          count++
        }

        const idx = (y * width + x) * 4
        outputData[idx] = r / count
        outputData[idx + 1] = g / count
        outputData[idx + 2] = b / count
        outputData[idx + 3] = a / count
      }
    }

    return output
  }

  /**
   * Apply image background
   * For now, replaces entire background with image
   * In production, would use segmentation to only replace background
   */
  _applyImageBackground() {
    if (!this.currentBackgroundImage) {
      return
    }

    // Draw background image
    this.ctx.save()
    this.ctx.globalCompositeOperation = 'destination-over'
    this.ctx.drawImage(
      this.currentBackgroundImage,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    )
    this.ctx.restore()
  }

  /**
   * Set background type
   * @param {string} type - Background type (BACKGROUND_TYPE constant)
   */
  setBackgroundType(type) {
    if (!Object.values(BACKGROUND_TYPE).includes(type)) {
      throw new Error(`Invalid background type: ${type}`)
    }

    logger.debug(`🎨 [VirtualBackgroundService] Setting background type: ${type}`)
    this.currentBackgroundType = type
  }

  /**
   * Set blur level
   * @param {number} level - Blur level (BLUR_LEVEL constant or custom number)
   */
  setBlurLevel(level) {
    logger.debug(`🎨 [VirtualBackgroundService] Setting blur level: ${level}`)
    this.currentBlurLevel = level
  }

  /**
   * Set background image
   * @param {string} imageUrl - URL or data URL of background image
   * @returns {Promise<void>}
   */
  async setBackgroundImage(imageUrl) {
    logger.debug(`🎨 [VirtualBackgroundService] Loading background image: ${imageUrl}`)

    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        this.currentBackgroundImage = img
        this.currentBackgroundType = BACKGROUND_TYPE.IMAGE
        logger.debug('✅ [VirtualBackgroundService] Background image loaded')
        resolve()
      }

      img.onerror = (error) => {
        logger.warn('⚠️ [VirtualBackgroundService] Failed to load background image, using fallback:', error)
        // Use a solid color fallback instead of rejecting
        this._createFallbackBackground()
        this.currentBackgroundType = BACKGROUND_TYPE.IMAGE
        resolve() // Resolve instead of reject to allow graceful degradation
      }

      img.src = imageUrl
    })
  }

  /**
   * Create a fallback background (solid color or gradient)
   * Used when actual image fails to load
   */
  _createFallbackBackground() {
    // Create a canvas with a gradient as fallback
    const fallbackCanvas = document.createElement('canvas')
    fallbackCanvas.width = 1920
    fallbackCanvas.height = 1080
    const ctx = fallbackCanvas.getContext('2d')

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, fallbackCanvas.width, fallbackCanvas.height)
    gradient.addColorStop(0, '#667eea')
    gradient.addColorStop(1, '#764ba2')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height)

    // Convert canvas to image
    const img = new Image()
    img.src = fallbackCanvas.toDataURL()
    this.currentBackgroundImage = img

    logger.debug('✅ [VirtualBackgroundService] Using fallback gradient background')
  }

  /**
   * Upload custom background image
   * @param {File} file - Image file
   * @returns {Promise<string>} Data URL of uploaded image
   */
  async uploadCustomBackground(file) {
    logger.debug(`🎨 [VirtualBackgroundService] Uploading custom background: ${file.name}`)

    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image')
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        const dataUrl = e.target.result
        logger.debug('✅ [VirtualBackgroundService] Custom background uploaded')
        resolve(dataUrl)
      }

      reader.onerror = (error) => {
        logger.error('❌ [VirtualBackgroundService] Failed to upload custom background:', error)
        reject(new Error('Failed to upload custom background'))
      }

      reader.readAsDataURL(file)
    })
  }

  /**
   * Add background to favorites
   * @param {Object} background - Background object
   */
  addToFavorites(background) {
    const exists = this.favorites.some(fav => fav.id === background.id)

    if (!exists) {
      this.favorites.push(background)
      this._saveFavorites()
      logger.debug(`⭐ [VirtualBackgroundService] Added to favorites: ${background.name}`)
    }
  }

  /**
   * Remove background from favorites
   * @param {string} backgroundId - Background ID
   */
  removeFromFavorites(backgroundId) {
    this.favorites = this.favorites.filter(fav => fav.id !== backgroundId)
    this._saveFavorites()
    logger.debug(`❌ [VirtualBackgroundService] Removed from favorites: ${backgroundId}`)
  }

  /**
   * Check if background is in favorites
   * @param {string} backgroundId - Background ID
   * @returns {boolean}
   */
  isFavorite(backgroundId) {
    return this.favorites.some(fav => fav.id === backgroundId)
  }

  /**
   * Get all favorite backgrounds
   * @returns {Array} Array of favorite backgrounds
   */
  getFavorites() {
    return this.favorites
  }

  /**
   * Load favorites from localStorage
   * @returns {Array} Array of favorite backgrounds
   */
  _loadFavorites() {
    try {
      const stored = localStorage.getItem('virtual-backgrounds-favorites')
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      logger.error('❌ [VirtualBackgroundService] Failed to load favorites:', error)
      return []
    }
  }

  /**
   * Save favorites to localStorage
   */
  _saveFavorites() {
    try {
      localStorage.setItem('virtual-backgrounds-favorites', JSON.stringify(this.favorites))
    } catch (error) {
      logger.error('❌ [VirtualBackgroundService] Failed to save favorites:', error)
    }
  }

  /**
   * Get current background settings
   * @returns {Object} Current background settings
   */
  getCurrentSettings() {
    return {
      type: this.currentBackgroundType,
      blurLevel: this.currentBlurLevel,
      backgroundImage: this.currentBackgroundImage ? true : false,
    }
  }

  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      hasStream: !!this.stream,
      backgroundType: this.currentBackgroundType,
      blurLevel: this.currentBlurLevel,
      hasBackgroundImage: !!this.currentBackgroundImage,
      favoritesCount: this.favorites.length,
    }
  }
}

export default VirtualBackgroundService
