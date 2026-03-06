import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import VideoFilterService, {
  FILTER_TYPE,
  FILTER_PRESETS,
} from '../VideoFilterService'

describe('VideoFilterService', () => {
  let service
  let mockStream
  let mockVideoElement
  let mockCanvas
  let mockContext

  beforeEach(() => {
    // Create mock MediaStream
    mockStream = {
      getTracks: vi.fn(() => [
        {
          kind: 'video',
          enabled: true,
          stop: vi.fn(),
        },
        {
          kind: 'audio',
          enabled: true,
          stop: vi.fn(),
        },
      ]),
      getVideoTracks: vi.fn(() => [
        {
          kind: 'video',
          enabled: true,
          stop: vi.fn(),
        },
      ]),
      getAudioTracks: vi.fn(() => [
        {
          kind: 'audio',
          enabled: true,
          stop: vi.fn(),
        },
      ]),
      addTrack: vi.fn(),
    }

    // Mock video element
    mockVideoElement = {
      srcObject: null,
      autoplay: false,
      playsInline: false,
      play: vi.fn(),
      videoWidth: 640,
      videoHeight: 480,
      onloadedmetadata: null,
    }

    // Mock canvas and context
    mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        width: 640,
        height: 480,
        data: new Uint8ClampedArray(640 * 480 * 4),
      })),
      putImageData: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    }

    mockCanvas = {
      width: 640,
      height: 480,
      getContext: vi.fn(() => mockContext),
      captureStream: vi.fn(() => mockStream),
    }

    // Mock DOM elements creation
    global.document.createElement = vi.fn((tagName) => {
      if (tagName === 'video') {
        return mockVideoElement
      } else if (tagName === 'canvas') {
        return mockCanvas
      }
      return {}
    })

    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn((cb) => {
      setTimeout(cb, 16)
      return 1
    })

    global.cancelAnimationFrame = vi.fn()

    // Mock ImageData
    global.ImageData = class {
      constructor(width, height) {
        this.width = width
        this.height = height
        this.data = new Uint8ClampedArray(width * height * 4)
      }
    }

    service = new VideoFilterService()
  })

  afterEach(() => {
    if (service) {
      service.stop()
    }
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      expect(service.currentFilter).toBe(FILTER_TYPE.NONE)
      expect(service.filterIntensity).toBe(1.0)
      expect(service.brightness).toBe(1.0)
      expect(service.contrast).toBe(1.0)
      expect(service.saturation).toBe(1.0)
      expect(service.isActive).toBe(false)
    })

    it('should load filter presets', () => {
      const presets = service.getFilterPresets()
      expect(presets.length).toBeGreaterThan(0)
      expect(presets).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: FILTER_TYPE.NONE }),
        expect.objectContaining({ id: FILTER_TYPE.BEAUTY }),
        expect.objectContaining({ id: FILTER_TYPE.VINTAGE }),
      ]))
    })
  })

  describe('Filter Type Management', () => {
    it('should set filter to BEAUTY', () => {
      service.setFilter(FILTER_TYPE.BEAUTY)
      expect(service.currentFilter).toBe(FILTER_TYPE.BEAUTY)
    })

    it('should set filter to VINTAGE', () => {
      service.setFilter(FILTER_TYPE.VINTAGE)
      expect(service.currentFilter).toBe(FILTER_TYPE.VINTAGE)
    })

    it('should set filter to BW (Black & White)', () => {
      service.setFilter(FILTER_TYPE.BW)
      expect(service.currentFilter).toBe(FILTER_TYPE.BW)
    })

    it('should set filter to WARM', () => {
      service.setFilter(FILTER_TYPE.WARM)
      expect(service.currentFilter).toBe(FILTER_TYPE.WARM)
    })

    it('should set filter to COOL', () => {
      service.setFilter(FILTER_TYPE.COOL)
      expect(service.currentFilter).toBe(FILTER_TYPE.COOL)
    })

    it('should set filter to NONE', () => {
      service.setFilter(FILTER_TYPE.BEAUTY)
      service.setFilter(FILTER_TYPE.NONE)
      expect(service.currentFilter).toBe(FILTER_TYPE.NONE)
    })

    it('should throw error for invalid filter type', () => {
      expect(() => {
        service.setFilter('invalid-filter')
      }).toThrow('Invalid filter type')
    })

    it('should set filter with custom intensity', () => {
      service.setFilter(FILTER_TYPE.BEAUTY, 0.5)
      expect(service.currentFilter).toBe(FILTER_TYPE.BEAUTY)
      expect(service.filterIntensity).toBe(0.5)
    })
  })

  describe('Filter Intensity Management', () => {
    it('should set intensity to 0.5', () => {
      service.setIntensity(0.5)
      expect(service.filterIntensity).toBe(0.5)
    })

    it('should clamp intensity to 0.0 minimum', () => {
      service.setIntensity(-0.5)
      expect(service.filterIntensity).toBe(0.0)
    })

    it('should clamp intensity to 1.0 maximum', () => {
      service.setIntensity(1.5)
      expect(service.filterIntensity).toBe(1.0)
    })
  })

  describe('Adjustment Controls', () => {
    describe('Brightness', () => {
      it('should set brightness to 1.5', () => {
        service.setBrightness(1.5)
        expect(service.brightness).toBe(1.5)
      })

      it('should clamp brightness to 0.0 minimum', () => {
        service.setBrightness(-0.5)
        expect(service.brightness).toBe(0.0)
      })

      it('should clamp brightness to 2.0 maximum', () => {
        service.setBrightness(3.0)
        expect(service.brightness).toBe(2.0)
      })
    })

    describe('Contrast', () => {
      it('should set contrast to 1.3', () => {
        service.setContrast(1.3)
        expect(service.contrast).toBe(1.3)
      })

      it('should clamp contrast to 0.0 minimum', () => {
        service.setContrast(-0.5)
        expect(service.contrast).toBe(0.0)
      })

      it('should clamp contrast to 2.0 maximum', () => {
        service.setContrast(3.0)
        expect(service.contrast).toBe(2.0)
      })
    })

    describe('Saturation', () => {
      it('should set saturation to 1.2', () => {
        service.setSaturation(1.2)
        expect(service.saturation).toBe(1.2)
      })

      it('should clamp saturation to 0.0 minimum', () => {
        service.setSaturation(-0.5)
        expect(service.saturation).toBe(0.0)
      })

      it('should clamp saturation to 2.0 maximum', () => {
        service.setSaturation(3.0)
        expect(service.saturation).toBe(2.0)
      })
    })

    describe('Sharpness', () => {
      it('should set sharpness to 0.5', () => {
        service.setSharpness(0.5)
        expect(service.sharpness).toBe(0.5)
      })

      it('should clamp sharpness to 0.0 minimum', () => {
        service.setSharpness(-0.5)
        expect(service.sharpness).toBe(0.0)
      })

      it('should clamp sharpness to 1.0 maximum', () => {
        service.setSharpness(1.5)
        expect(service.sharpness).toBe(1.0)
      })
    })
  })

  describe('Beauty Mode Controls', () => {
    it('should set skin smoothing', () => {
      service.setSkinSmoothing(0.7)
      expect(service.skinSmoothing).toBe(0.7)
    })

    it('should clamp skin smoothing to 0.0 minimum', () => {
      service.setSkinSmoothing(-0.5)
      expect(service.skinSmoothing).toBe(0.0)
    })

    it('should clamp skin smoothing to 1.0 maximum', () => {
      service.setSkinSmoothing(1.5)
      expect(service.skinSmoothing).toBe(1.0)
    })

    it('should set low light enhancement', () => {
      service.setLowLightEnhancement(0.6)
      expect(service.lowLightEnhancement).toBe(0.6)
    })

    it('should clamp low light enhancement to 0.0 minimum', () => {
      service.setLowLightEnhancement(-0.5)
      expect(service.lowLightEnhancement).toBe(0.0)
    })

    it('should clamp low light enhancement to 1.0 maximum', () => {
      service.setLowLightEnhancement(1.5)
      expect(service.lowLightEnhancement).toBe(1.0)
    })
  })

  describe('Reset Settings', () => {
    it('should reset all settings to default', () => {
      // Change some settings
      service.setFilter(FILTER_TYPE.BEAUTY, 0.5)
      service.setBrightness(1.5)
      service.setContrast(1.3)
      service.setSaturation(1.2)
      service.setSharpness(0.5)
      service.setSkinSmoothing(0.7)

      // Reset
      service.resetSettings()

      // Check all defaults
      expect(service.currentFilter).toBe(FILTER_TYPE.NONE)
      expect(service.filterIntensity).toBe(1.0)
      expect(service.brightness).toBe(1.0)
      expect(service.contrast).toBe(1.0)
      expect(service.saturation).toBe(1.0)
      expect(service.sharpness).toBe(0.0)
      expect(service.skinSmoothing).toBe(0.0)
      expect(service.lowLightEnhancement).toBe(0.0)
    })
  })

  describe('Stream Processing', () => {
    it('should start processing with default filter', async () => {
      const processedStream = await service.start(mockStream)

      expect(processedStream).toBeDefined()
      expect(service.isActive).toBe(true)
      expect(service.stream).toBeDefined()
    })

    it('should start processing with beauty filter', async () => {
      const processedStream = await service.start(mockStream, {
        filter: FILTER_TYPE.BEAUTY,
        intensity: 0.8,
      })

      expect(processedStream).toBeDefined()
      expect(service.isActive).toBe(true)
      expect(service.currentFilter).toBe(FILTER_TYPE.BEAUTY)
      expect(service.filterIntensity).toBe(0.8)
    })

    it('should start processing with adjustments', async () => {
      const processedStream = await service.start(mockStream, {
        brightness: 1.2,
        contrast: 1.1,
        saturation: 1.3,
      })

      expect(processedStream).toBeDefined()
      expect(service.brightness).toBe(1.2)
      expect(service.contrast).toBe(1.1)
      expect(service.saturation).toBe(1.3)
    })

    it('should throw error when starting without stream', async () => {
      await expect(service.start(null)).rejects.toThrow('Original stream is required')
    })

    it('should stop processing', async () => {
      await service.start(mockStream)
      expect(service.isActive).toBe(true)

      service.stop()

      expect(service.isActive).toBe(false)
      expect(service.stream).toBeNull()
    })

    it('should copy audio tracks from original stream', async () => {
      await service.start(mockStream)

      expect(mockStream.getAudioTracks).toHaveBeenCalled()
      expect(mockStream.addTrack).toHaveBeenCalled()
    })
  })

  describe('Get Current Settings', () => {
    it('should return current settings', () => {
      service.setFilter(FILTER_TYPE.BEAUTY, 0.8)
      service.setBrightness(1.2)
      service.setContrast(1.1)
      service.setSaturation(1.3)
      service.setSharpness(0.5)
      service.setSkinSmoothing(0.7)
      service.setLowLightEnhancement(0.6)

      const settings = service.getCurrentSettings()

      expect(settings).toEqual({
        filter: FILTER_TYPE.BEAUTY,
        intensity: 0.8,
        brightness: 1.2,
        contrast: 1.1,
        saturation: 1.3,
        sharpness: 0.5,
        skinSmoothing: 0.7,
        lowLightEnhancement: 0.6,
        temperature: 0,
      })
    })
  })

  describe('Get Status', () => {
    it('should return inactive status initially', () => {
      const status = service.getStatus()

      expect(status).toEqual({
        isActive: false,
        hasStream: false,
        currentFilter: FILTER_TYPE.NONE,
        filterIntensity: 1.0,
      })
    })

    it('should return active status after starting', async () => {
      await service.start(mockStream)

      const status = service.getStatus()

      expect(status.isActive).toBe(true)
      expect(status.hasStream).toBe(true)
    })
  })

  describe('Filter Presets', () => {
    it('should have preset for NONE', () => {
      const preset = FILTER_PRESETS[FILTER_TYPE.NONE]
      expect(preset).toBeDefined()
      expect(preset.id).toBe(FILTER_TYPE.NONE)
    })

    it('should have preset for BEAUTY with settings', () => {
      const preset = FILTER_PRESETS[FILTER_TYPE.BEAUTY]
      expect(preset).toBeDefined()
      expect(preset.id).toBe(FILTER_TYPE.BEAUTY)
      expect(preset.settings).toBeDefined()
      expect(preset.settings.skinSmoothing).toBeDefined()
    })

    it('should have preset for VINTAGE', () => {
      const preset = FILTER_PRESETS[FILTER_TYPE.VINTAGE]
      expect(preset).toBeDefined()
      expect(preset.id).toBe(FILTER_TYPE.VINTAGE)
    })

    it('should have preset for all filter types', () => {
      Object.values(FILTER_TYPE).forEach(filterType => {
        const preset = FILTER_PRESETS[filterType]
        expect(preset).toBeDefined()
        expect(preset.id).toBe(filterType)
        expect(preset.name).toBeDefined()
        expect(preset.description).toBeDefined()
      })
    })
  })
})
