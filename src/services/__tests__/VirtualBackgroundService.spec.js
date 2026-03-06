import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import VirtualBackgroundService, {
  BACKGROUND_TYPE,
  BLUR_LEVEL,
  BACKGROUND_CATEGORY,
} from '../VirtualBackgroundService'

describe('VirtualBackgroundService', () => {
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

    // Mock Image
    global.Image = class {
      constructor() {
        this.onload = null
        this.onerror = null
        this.crossOrigin = null
        this._src = null
      }

      set src(value) {
        this._src = value
        setTimeout(() => {
          if (this.onload) {
            this.onload()
          }
        }, 0)
      }

      get src() {
        return this._src
      }
    }

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }

    service = new VirtualBackgroundService()
  })

  afterEach(() => {
    if (service) {
      service.stop()
    }
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      expect(service.currentBackgroundType).toBe(BACKGROUND_TYPE.NONE)
      expect(service.currentBlurLevel).toBe(BLUR_LEVEL.MEDIUM)
      expect(service.isActive).toBe(false)
    })

    it('should load built-in backgrounds', () => {
      const backgrounds = service.getBuiltInBackgrounds()
      expect(backgrounds.length).toBeGreaterThan(0)
    })

    it('should have backgrounds in all categories', () => {
      const officeBackgrounds = service.getBackgroundsByCategory(BACKGROUND_CATEGORY.OFFICE)
      const natureBackgrounds = service.getBackgroundsByCategory(BACKGROUND_CATEGORY.NATURE)
      const abstractBackgrounds = service.getBackgroundsByCategory(BACKGROUND_CATEGORY.ABSTRACT)

      expect(officeBackgrounds.length).toBeGreaterThan(0)
      expect(natureBackgrounds.length).toBeGreaterThan(0)
      expect(abstractBackgrounds.length).toBeGreaterThan(0)
    })
  })

  describe('Background Type Management', () => {
    it('should set background type to BLUR', () => {
      service.setBackgroundType(BACKGROUND_TYPE.BLUR)
      expect(service.currentBackgroundType).toBe(BACKGROUND_TYPE.BLUR)
    })

    it('should set background type to IMAGE', () => {
      service.setBackgroundType(BACKGROUND_TYPE.IMAGE)
      expect(service.currentBackgroundType).toBe(BACKGROUND_TYPE.IMAGE)
    })

    it('should set background type to NONE', () => {
      service.setBackgroundType(BACKGROUND_TYPE.IMAGE)
      service.setBackgroundType(BACKGROUND_TYPE.NONE)
      expect(service.currentBackgroundType).toBe(BACKGROUND_TYPE.NONE)
    })

    it('should throw error for invalid background type', () => {
      expect(() => {
        service.setBackgroundType('invalid-type')
      }).toThrow('Invalid background type')
    })
  })

  describe('Blur Level Management', () => {
    it('should set blur level to LOW', () => {
      service.setBlurLevel(BLUR_LEVEL.LOW)
      expect(service.currentBlurLevel).toBe(BLUR_LEVEL.LOW)
    })

    it('should set blur level to MEDIUM', () => {
      service.setBlurLevel(BLUR_LEVEL.MEDIUM)
      expect(service.currentBlurLevel).toBe(BLUR_LEVEL.MEDIUM)
    })

    it('should set blur level to HIGH', () => {
      service.setBlurLevel(BLUR_LEVEL.HIGH)
      expect(service.currentBlurLevel).toBe(BLUR_LEVEL.HIGH)
    })

    it('should set custom blur level', () => {
      service.setBlurLevel(15)
      expect(service.currentBlurLevel).toBe(15)
    })
  })

  describe('Background Image Management', () => {
    it('should load background image', async () => {
      await service.setBackgroundImage('/test-background.jpg')
      expect(service.currentBackgroundImage).toBeTruthy()
      expect(service.currentBackgroundType).toBe(BACKGROUND_TYPE.IMAGE)
    })

    it('should handle image load error', async () => {
      // Override Image mock to simulate error
      global.Image = class {
        constructor() {
          this.onerror = null
          this._src = null
        }

        set src(value) {
          this._src = value
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new Error('Failed to load'))
            }
          }, 0)
        }
      }

      await expect(service.setBackgroundImage('/invalid.jpg')).rejects.toThrow(
        'Failed to load background image'
      )
    })
  })

  describe('Custom Background Upload', () => {
    it('should upload custom background', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      // Mock FileReader
      const mockFileReader = {
        readAsDataURL: vi.fn(function () {
          this.onload({ target: { result: 'data:image/jpeg;base64,abc123' } })
        }),
        onload: null,
        onerror: null,
      }

      global.FileReader = vi.fn(() => mockFileReader)

      const dataUrl = await service.uploadCustomBackground(mockFile)
      expect(dataUrl).toBe('data:image/jpeg;base64,abc123')
    })

    it('should reject non-image files', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' })

      await expect(service.uploadCustomBackground(mockFile)).rejects.toThrow(
        'File must be an image'
      )
    })

    it('should handle upload error', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      const mockFileReader = {
        readAsDataURL: vi.fn(function () {
          this.onerror(new Error('Upload failed'))
        }),
        onload: null,
        onerror: null,
      }

      global.FileReader = vi.fn(() => mockFileReader)

      await expect(service.uploadCustomBackground(mockFile)).rejects.toThrow(
        'Failed to upload custom background'
      )
    })
  })

  describe('Favorites Management', () => {
    const testBackground = {
      id: 'test-bg-1',
      name: 'Test Background',
      category: BACKGROUND_CATEGORY.OFFICE,
      url: '/test.jpg',
    }

    it('should add background to favorites', () => {
      service.addToFavorites(testBackground)
      expect(service.isFavorite(testBackground.id)).toBe(true)
    })

    it('should not add duplicate to favorites', () => {
      service.addToFavorites(testBackground)
      service.addToFavorites(testBackground)
      const favorites = service.getFavorites()
      expect(favorites.length).toBe(1)
    })

    it('should remove background from favorites', () => {
      service.addToFavorites(testBackground)
      service.removeFromFavorites(testBackground.id)
      expect(service.isFavorite(testBackground.id)).toBe(false)
    })

    it('should get all favorites', () => {
      const bg1 = { ...testBackground, id: 'bg-1' }
      const bg2 = { ...testBackground, id: 'bg-2' }

      service.addToFavorites(bg1)
      service.addToFavorites(bg2)

      const favorites = service.getFavorites()
      expect(favorites.length).toBe(2)
    })

    it('should persist favorites to localStorage', () => {
      service.addToFavorites(testBackground)
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'virtual-backgrounds-favorites',
        expect.any(String)
      )
    })
  })

  describe('Stream Processing', () => {
    it('should start processing stream', async () => {
      // Simulate video loaded
      setTimeout(() => {
        if (mockVideoElement.onloadedmetadata) {
          mockVideoElement.onloadedmetadata()
        }
      }, 0)

      const processedStream = await service.start(mockStream)

      expect(service.isActive).toBe(true)
      expect(processedStream).toBeTruthy()
      expect(mockCanvas.captureStream).toHaveBeenCalled()
    })

    it('should throw error if stream is not provided', async () => {
      await expect(service.start(null)).rejects.toThrow('Original stream is required')
    })

    it('should stop processing stream', async () => {
      setTimeout(() => {
        if (mockVideoElement.onloadedmetadata) {
          mockVideoElement.onloadedmetadata()
        }
      }, 0)

      await service.start(mockStream)
      service.stop()

      expect(service.isActive).toBe(false)
      expect(cancelAnimationFrame).toHaveBeenCalled()
    })

    it('should apply background settings from options', async () => {
      setTimeout(() => {
        if (mockVideoElement.onloadedmetadata) {
          mockVideoElement.onloadedmetadata()
        }
      }, 0)

      await service.start(mockStream, {
        backgroundType: BACKGROUND_TYPE.BLUR,
        blurLevel: BLUR_LEVEL.HIGH,
      })

      expect(service.currentBackgroundType).toBe(BACKGROUND_TYPE.BLUR)
      expect(service.currentBlurLevel).toBe(BLUR_LEVEL.HIGH)
    })
  })

  describe('Service Status', () => {
    it('should return correct status', () => {
      const status = service.getStatus()

      expect(status).toHaveProperty('isActive')
      expect(status).toHaveProperty('hasStream')
      expect(status).toHaveProperty('backgroundType')
      expect(status).toHaveProperty('blurLevel')
      expect(status).toHaveProperty('hasBackgroundImage')
      expect(status).toHaveProperty('favoritesCount')
    })

    it('should return correct current settings', () => {
      service.setBackgroundType(BACKGROUND_TYPE.BLUR)
      service.setBlurLevel(BLUR_LEVEL.HIGH)

      const settings = service.getCurrentSettings()

      expect(settings.type).toBe(BACKGROUND_TYPE.BLUR)
      expect(settings.blurLevel).toBe(BLUR_LEVEL.HIGH)
    })
  })

  describe('Box Blur Algorithm', () => {
    it('should apply blur to image data', () => {
      const imageData = {
        width: 10,
        height: 10,
        data: new Uint8ClampedArray(10 * 10 * 4).fill(128),
      }

      const blurred = service._boxBlur(imageData, 2)

      expect(blurred).toBeInstanceOf(ImageData)
      expect(blurred.width).toBe(imageData.width)
      expect(blurred.height).toBe(imageData.height)
    })
  })
})
