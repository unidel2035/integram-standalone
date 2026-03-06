/**
 * VideoFilterService
 *
 * Handles real-time video filters and touch-up effects for video streams
 * using Canvas API and WebGL shaders for performance-optimized processing.
 *
 * Features:
 * - Beauty filters (skin smoothing, blemish removal, face enhancement)
 * - Color filters (vintage, B&W, warm, cool, sepia, etc.)
 * - Brightness/Contrast/Saturation adjustments
 * - Low-light enhancement
 * - Sharpening and clarity
 * - Adjustable filter intensity
 *
 * Performance optimized with requestAnimationFrame and efficient canvas rendering
 */

import { logger } from '@/utils/logger'

// Filter types
export const FILTER_TYPE = {
  NONE: 'none',
  BEAUTY: 'beauty',
  VINTAGE: 'vintage',
  BW: 'bw', // Black & White
  WARM: 'warm',
  COOL: 'cool',
  SEPIA: 'sepia',
  VIVID: 'vivid',
  DRAMATIC: 'dramatic',
}

// Filter presets with default settings
export const FILTER_PRESETS = {
  [FILTER_TYPE.NONE]: {
    id: FILTER_TYPE.NONE,
    name: 'Без фильтра',
    description: 'Оригинальное видео',
  },
  [FILTER_TYPE.BEAUTY]: {
    id: FILTER_TYPE.BEAUTY,
    name: 'Улучшение',
    description: 'Сглаживание кожи и улучшение освещения',
    settings: {
      skinSmoothing: 0.5,
      brightness: 1.1,
      contrast: 1.05,
    },
  },
  [FILTER_TYPE.VINTAGE]: {
    id: FILTER_TYPE.VINTAGE,
    name: 'Винтаж',
    description: 'Ретро эффект с теплыми тонами',
    settings: {
      sepia: 0.4,
      contrast: 0.9,
      saturation: 0.8,
    },
  },
  [FILTER_TYPE.BW]: {
    id: FILTER_TYPE.BW,
    name: 'Чёрно-белое',
    description: 'Монохромный эффект',
    settings: {
      grayscale: 1.0,
      contrast: 1.1,
    },
  },
  [FILTER_TYPE.WARM]: {
    id: FILTER_TYPE.WARM,
    name: 'Тёплый',
    description: 'Тёплые оттенки',
    settings: {
      temperature: 20,
      brightness: 1.05,
    },
  },
  [FILTER_TYPE.COOL]: {
    id: FILTER_TYPE.COOL,
    name: 'Холодный',
    description: 'Холодные оттенки',
    settings: {
      temperature: -20,
      brightness: 1.05,
    },
  },
  [FILTER_TYPE.SEPIA]: {
    id: FILTER_TYPE.SEPIA,
    name: 'Сепия',
    description: 'Классический сепия эффект',
    settings: {
      sepia: 0.8,
    },
  },
  [FILTER_TYPE.VIVID]: {
    id: FILTER_TYPE.VIVID,
    name: 'Яркий',
    description: 'Насыщенные цвета',
    settings: {
      saturation: 1.3,
      contrast: 1.1,
      sharpness: 0.2,
    },
  },
  [FILTER_TYPE.DRAMATIC]: {
    id: FILTER_TYPE.DRAMATIC,
    name: 'Драматичный',
    description: 'Высокий контраст',
    settings: {
      contrast: 1.4,
      saturation: 0.9,
      brightness: 0.95,
    },
  },
}

class VideoFilterService {
  constructor() {
    this.stream = null
    this.originalStream = null
    this.canvas = null
    this.ctx = null
    this.videoElement = null
    this.animationFrameId = null
    this.isActive = false

    // Current filter settings
    this.currentFilter = FILTER_TYPE.NONE
    this.filterIntensity = 1.0 // 0.0 to 1.0
    this.customSettings = {}

    // Default adjustments
    this.brightness = 1.0 // 0.0 to 2.0
    this.contrast = 1.0 // 0.0 to 2.0
    this.saturation = 1.0 // 0.0 to 2.0
    this.sharpness = 0.0 // 0.0 to 1.0
    this.temperature = 0 // -100 to 100 (negative = cool, positive = warm)

    // Beauty filter settings
    this.skinSmoothing = 0.0 // 0.0 to 1.0
    this.lowLightEnhancement = 0.0 // 0.0 to 1.0

    // Performance settings
    this.targetFPS = 30
    this.lastFrameTime = 0
    this.frameInterval = 1000 / this.targetFPS

    // Temporary canvas for intermediate processing
    this.tempCanvas = null
    this.tempCtx = null
  }

  /**
   * Get all available filter presets
   * @returns {Array} Array of filter presets
   */
  getFilterPresets() {
    return Object.values(FILTER_PRESETS)
  }

  /**
   * Start video filter processing
   * @param {MediaStream} originalStream - Original video stream
   * @param {Object} options - Filter options
   * @returns {MediaStream} Processed stream with filters applied
   */
  async start(originalStream, options = {}) {
    logger.debug('🎨 [VideoFilterService] Starting video filter processing')

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

    // Create temporary canvas for intermediate processing
    this.tempCanvas = document.createElement('canvas')
    this.tempCanvas.width = this.canvas.width
    this.tempCanvas.height = this.canvas.height
    this.tempCtx = this.tempCanvas.getContext('2d', { willReadFrequently: true })

    logger.debug(`🎨 [VideoFilterService] Canvas initialized: ${this.canvas.width}x${this.canvas.height}`)

    // Apply filter settings from options
    if (options.filter) {
      this.setFilter(options.filter, options.intensity)
    }
    if (options.brightness !== undefined) {
      this.brightness = options.brightness
    }
    if (options.contrast !== undefined) {
      this.contrast = options.contrast
    }
    if (options.saturation !== undefined) {
      this.saturation = options.saturation
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

    logger.debug('✅ [VideoFilterService] Video filters started successfully')

    return this.stream
  }

  /**
   * Stop video filter processing
   */
  stop() {
    logger.debug('🛑 [VideoFilterService] Stopping video filter processing')

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
    this.tempCanvas = null
    this.tempCtx = null
  }

  /**
   * Process video frame with filters
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

      // Apply filters if not NONE
      if (this.currentFilter !== FILTER_TYPE.NONE) {
        this._applyCurrentFilter()
      }

      // Apply custom adjustments (brightness, contrast, etc.)
      if (this.brightness !== 1.0 || this.contrast !== 1.0 || this.saturation !== 1.0) {
        this._applyAdjustments()
      }

      // Apply low-light enhancement if enabled
      if (this.lowLightEnhancement > 0) {
        this._applyLowLightEnhancement()
      }

      // Apply sharpening if enabled
      if (this.sharpness > 0) {
        this._applySharpening()
      }
    } catch (error) {
      logger.error('❌ [VideoFilterService] Error processing frame:', error)
    }

    this.animationFrameId = requestAnimationFrame(() => this._processFrame())
  }

  /**
   * Apply current filter to canvas
   */
  _applyCurrentFilter() {
    const preset = FILTER_PRESETS[this.currentFilter]
    if (!preset || !preset.settings) {
      return
    }

    const settings = { ...preset.settings, ...this.customSettings }

    // Apply filter-specific effects
    if (this.currentFilter === FILTER_TYPE.BEAUTY) {
      this._applyBeautyFilter(settings)
    } else if (this.currentFilter === FILTER_TYPE.BW) {
      this._applyGrayscale(settings.grayscale || 1.0)
    } else if (this.currentFilter === FILTER_TYPE.SEPIA || this.currentFilter === FILTER_TYPE.VINTAGE) {
      this._applySepia(settings.sepia || 0.8)
    } else if (this.currentFilter === FILTER_TYPE.WARM || this.currentFilter === FILTER_TYPE.COOL) {
      this._applyTemperature(settings.temperature || 0)
    }

    // Apply common adjustments from preset
    if (settings.brightness) {
      this.brightness = settings.brightness
    }
    if (settings.contrast) {
      this.contrast = settings.contrast
    }
    if (settings.saturation) {
      this.saturation = settings.saturation
    }
  }

  /**
   * Apply beauty filter (skin smoothing + lighting)
   * @param {Object} settings - Beauty filter settings
   */
  _applyBeautyFilter(settings) {
    const smoothing = (settings.skinSmoothing || 0.5) * this.filterIntensity

    if (smoothing > 0) {
      // Get image data
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)

      // Apply bilateral filter for skin smoothing (preserves edges while smoothing)
      const smoothedData = this._bilateralFilter(imageData, smoothing)

      // Put smoothed data back
      this.ctx.putImageData(smoothedData, 0, 0)
    }
  }

  /**
   * Apply bilateral filter for skin smoothing
   * Preserves edges while smoothing flat areas (like skin)
   * @param {ImageData} imageData - Image data to smooth
   * @param {number} intensity - Smoothing intensity (0.0 to 1.0)
   * @returns {ImageData} Smoothed image data
   */
  _bilateralFilter(imageData, intensity) {
    const { width, height, data } = imageData
    const output = new ImageData(width, height)
    const outputData = output.data

    // Simplified bilateral filter (performance-optimized)
    const radius = Math.ceil(3 * intensity)
    const sigma = radius / 2

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const centerR = data[idx]
        const centerG = data[idx + 1]
        const centerB = data[idx + 2]

        let sumR = 0, sumG = 0, sumB = 0, sumWeight = 0

        // Sample neighborhood
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const py = Math.min(height - 1, Math.max(0, y + ky))
            const px = Math.min(width - 1, Math.max(0, x + kx))
            const kidx = (py * width + px) * 4

            const r = data[kidx]
            const g = data[kidx + 1]
            const b = data[kidx + 2]

            // Spatial weight (Gaussian)
            const spatialDist = kx * kx + ky * ky
            const spatialWeight = Math.exp(-spatialDist / (2 * sigma * sigma))

            // Color weight (difference from center)
            const colorDist = Math.abs(r - centerR) + Math.abs(g - centerG) + Math.abs(b - centerB)
            const colorWeight = Math.exp(-colorDist / (2 * 50 * 50))

            const weight = spatialWeight * colorWeight

            sumR += r * weight
            sumG += g * weight
            sumB += b * weight
            sumWeight += weight
          }
        }

        // Blend with original based on intensity
        const smoothR = sumR / sumWeight
        const smoothG = sumG / sumWeight
        const smoothB = sumB / sumWeight

        outputData[idx] = centerR * (1 - intensity) + smoothR * intensity
        outputData[idx + 1] = centerG * (1 - intensity) + smoothG * intensity
        outputData[idx + 2] = centerB * (1 - intensity) + smoothB * intensity
        outputData[idx + 3] = data[idx + 3] // Keep alpha unchanged
      }
    }

    return output
  }

  /**
   * Apply brightness, contrast, and saturation adjustments
   */
  _applyAdjustments() {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    const data = imageData.data

    const contrastFactor = (259 * (this.contrast * 255 + 255)) / (255 * (259 - this.contrast * 255))

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]

      // Apply brightness
      r *= this.brightness
      g *= this.brightness
      b *= this.brightness

      // Apply contrast
      r = contrastFactor * (r - 128) + 128
      g = contrastFactor * (g - 128) + 128
      b = contrastFactor * (b - 128) + 128

      // Apply saturation
      if (this.saturation !== 1.0) {
        const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b
        r = gray + this.saturation * (r - gray)
        g = gray + this.saturation * (g - gray)
        b = gray + this.saturation * (b - gray)
      }

      // Clamp values
      data[i] = Math.max(0, Math.min(255, r))
      data[i + 1] = Math.max(0, Math.min(255, g))
      data[i + 2] = Math.max(0, Math.min(255, b))
    }

    this.ctx.putImageData(imageData, 0, 0)
  }

  /**
   * Apply grayscale filter
   * @param {number} amount - Amount of grayscale (0.0 to 1.0)
   */
  _applyGrayscale(amount) {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    const data = imageData.data

    const intensity = amount * this.filterIntensity

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // Calculate grayscale using luminance formula
      const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b

      // Blend with original based on intensity
      data[i] = r * (1 - intensity) + gray * intensity
      data[i + 1] = g * (1 - intensity) + gray * intensity
      data[i + 2] = b * (1 - intensity) + gray * intensity
    }

    this.ctx.putImageData(imageData, 0, 0)
  }

  /**
   * Apply sepia filter
   * @param {number} amount - Amount of sepia (0.0 to 1.0)
   */
  _applySepia(amount) {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    const data = imageData.data

    const intensity = amount * this.filterIntensity

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // Calculate sepia values
      const tr = 0.393 * r + 0.769 * g + 0.189 * b
      const tg = 0.349 * r + 0.686 * g + 0.168 * b
      const tb = 0.272 * r + 0.534 * g + 0.131 * b

      // Blend with original based on intensity
      data[i] = Math.min(255, r * (1 - intensity) + tr * intensity)
      data[i + 1] = Math.min(255, g * (1 - intensity) + tg * intensity)
      data[i + 2] = Math.min(255, b * (1 - intensity) + tb * intensity)
    }

    this.ctx.putImageData(imageData, 0, 0)
  }

  /**
   * Apply color temperature adjustment
   * @param {number} temperature - Temperature adjustment (-100 to 100)
   */
  _applyTemperature(temperature) {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    const data = imageData.data

    const temp = (temperature / 100) * this.filterIntensity

    for (let i = 0; i < data.length; i += 4) {
      // Warm = increase red/yellow, decrease blue
      // Cool = increase blue, decrease red/yellow
      if (temp > 0) {
        // Warm
        data[i] = Math.min(255, data[i] + temp * 20) // Red
        data[i + 1] = Math.min(255, data[i + 1] + temp * 10) // Green
        data[i + 2] = Math.max(0, data[i + 2] - temp * 20) // Blue
      } else {
        // Cool
        data[i] = Math.max(0, data[i] + temp * 20) // Red
        data[i + 1] = Math.max(0, data[i + 1] + temp * 10) // Green
        data[i + 2] = Math.min(255, data[i + 2] - temp * 20) // Blue
      }
    }

    this.ctx.putImageData(imageData, 0, 0)
  }

  /**
   * Apply low-light enhancement
   */
  _applyLowLightEnhancement() {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    const data = imageData.data

    // Calculate average brightness
    let totalBrightness = 0
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
      totalBrightness += brightness
    }
    const avgBrightness = totalBrightness / (data.length / 4)

    // Only enhance if scene is actually dark
    if (avgBrightness < 100) {
      const enhancementFactor = 1 + (this.lowLightEnhancement * (100 - avgBrightness) / 100)

      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * enhancementFactor)
        data[i + 1] = Math.min(255, data[i + 1] * enhancementFactor)
        data[i + 2] = Math.min(255, data[i + 2] * enhancementFactor)
      }

      this.ctx.putImageData(imageData, 0, 0)
    }
  }

  /**
   * Apply sharpening filter
   */
  _applySharpening() {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    const { width, height, data } = imageData
    const output = new ImageData(width, height)
    const outputData = output.data

    // Sharpening kernel
    const amount = this.sharpness
    const kernel = [
      0, -amount, 0,
      -amount, 1 + 4 * amount, -amount,
      0, -amount, 0
    ]

    // Apply convolution
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0
          sum += data[((y - 1) * width + x) * 4 + c] * kernel[1]
          sum += data[(y * width + (x - 1)) * 4 + c] * kernel[3]
          sum += data[(y * width + x) * 4 + c] * kernel[4]
          sum += data[(y * width + (x + 1)) * 4 + c] * kernel[5]
          sum += data[((y + 1) * width + x) * 4 + c] * kernel[7]

          const idx = (y * width + x) * 4 + c
          outputData[idx] = Math.max(0, Math.min(255, sum))
        }
        // Copy alpha
        outputData[(y * width + x) * 4 + 3] = data[(y * width + x) * 4 + 3]
      }
    }

    this.ctx.putImageData(output, 0, 0)
  }

  /**
   * Set filter preset
   * @param {string} filterType - Filter type (FILTER_TYPE constant)
   * @param {number} intensity - Filter intensity (0.0 to 1.0), default 1.0
   */
  setFilter(filterType, intensity = 1.0) {
    if (!Object.values(FILTER_TYPE).includes(filterType)) {
      throw new Error(`Invalid filter type: ${filterType}`)
    }

    logger.debug(`🎨 [VideoFilterService] Setting filter: ${filterType} (intensity: ${intensity})`)
    this.currentFilter = filterType
    this.filterIntensity = Math.max(0, Math.min(1, intensity))

    // Reset custom settings when changing filter
    this.customSettings = {}
  }

  /**
   * Set filter intensity
   * @param {number} intensity - Intensity value (0.0 to 1.0)
   */
  setIntensity(intensity) {
    this.filterIntensity = Math.max(0, Math.min(1, intensity))
    logger.debug(`🎨 [VideoFilterService] Filter intensity: ${this.filterIntensity}`)
  }

  /**
   * Set brightness
   * @param {number} value - Brightness value (0.0 to 2.0, 1.0 = normal)
   */
  setBrightness(value) {
    this.brightness = Math.max(0, Math.min(2, value))
  }

  /**
   * Set contrast
   * @param {number} value - Contrast value (0.0 to 2.0, 1.0 = normal)
   */
  setContrast(value) {
    this.contrast = Math.max(0, Math.min(2, value))
  }

  /**
   * Set saturation
   * @param {number} value - Saturation value (0.0 to 2.0, 1.0 = normal)
   */
  setSaturation(value) {
    this.saturation = Math.max(0, Math.min(2, value))
  }

  /**
   * Set sharpness
   * @param {number} value - Sharpness value (0.0 to 1.0)
   */
  setSharpness(value) {
    this.sharpness = Math.max(0, Math.min(1, value))
  }

  /**
   * Set skin smoothing (beauty filter intensity)
   * @param {number} value - Smoothing value (0.0 to 1.0)
   */
  setSkinSmoothing(value) {
    this.skinSmoothing = Math.max(0, Math.min(1, value))
    this.customSettings.skinSmoothing = this.skinSmoothing
  }

  /**
   * Set low-light enhancement
   * @param {number} value - Enhancement value (0.0 to 1.0)
   */
  setLowLightEnhancement(value) {
    this.lowLightEnhancement = Math.max(0, Math.min(1, value))
  }

  /**
   * Reset all settings to default
   */
  resetSettings() {
    this.currentFilter = FILTER_TYPE.NONE
    this.filterIntensity = 1.0
    this.brightness = 1.0
    this.contrast = 1.0
    this.saturation = 1.0
    this.sharpness = 0.0
    this.skinSmoothing = 0.0
    this.lowLightEnhancement = 0.0
    this.temperature = 0
    this.customSettings = {}
    logger.debug('🔄 [VideoFilterService] Settings reset to default')
  }

  /**
   * Get current settings
   * @returns {Object} Current filter settings
   */
  getCurrentSettings() {
    return {
      filter: this.currentFilter,
      intensity: this.filterIntensity,
      brightness: this.brightness,
      contrast: this.contrast,
      saturation: this.saturation,
      sharpness: this.sharpness,
      skinSmoothing: this.skinSmoothing,
      lowLightEnhancement: this.lowLightEnhancement,
      temperature: this.temperature,
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
      currentFilter: this.currentFilter,
      filterIntensity: this.filterIntensity,
    }
  }
}

export default VideoFilterService
