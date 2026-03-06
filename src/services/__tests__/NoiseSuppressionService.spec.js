import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import NoiseSuppressionService, { NOISE_SUPPRESSION_MODE } from '../NoiseSuppressionService'

// Mock Web Audio API
class MockAudioContext {
  constructor() {
    this.state = 'running'
    this.sampleRate = 48000
  }

  createMediaStreamSource() {
    return {
      connect: vi.fn()
    }
  }

  createAnalyser() {
    return {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      frequencyBinCount: 1024,
      connect: vi.fn(),
      getByteFrequencyData: vi.fn((arr) => {
        // Simulate some audio data
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.random() * 255
        }
      })
    }
  }

  createGain() {
    return {
      gain: { value: 1.0 },
      connect: vi.fn()
    }
  }

  createBiquadFilter() {
    return {
      type: 'highpass',
      frequency: { value: 100 },
      Q: { value: 0.7 },
      connect: vi.fn()
    }
  }

  createMediaStreamDestination() {
    return {
      stream: new MediaStream()
    }
  }

  close() {
    return Promise.resolve()
  }
}

// Mock MediaStream
global.MediaStream = class MediaStream {
  constructor(tracks = []) {
    this.tracks = tracks
    this.id = Math.random().toString(36)
  }

  getAudioTracks() {
    return this.tracks.filter(t => t.kind === 'audio')
  }

  getVideoTracks() {
    return this.tracks.filter(t => t.kind === 'video')
  }

  getTracks() {
    return this.tracks
  }

  addTrack(track) {
    this.tracks.push(track)
  }
}

// Mock AudioContext in window
global.AudioContext = MockAudioContext
global.webkitAudioContext = MockAudioContext

describe('NoiseSuppressionService', () => {
  let service
  let mockStream

  beforeEach(() => {
    service = new NoiseSuppressionService()

    // Create mock audio track
    const mockAudioTrack = {
      kind: 'audio',
      label: 'Mock Microphone',
      id: 'audio-track-1',
      enabled: true,
      readyState: 'live',
      stop: vi.fn()
    }

    mockStream = new MediaStream([mockAudioTrack])
  })

  afterEach(() => {
    if (service) {
      service.cleanup()
    }
    vi.clearAllTimers()
  })

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const result = await service.initialize()
      expect(result).toBe(true)
      expect(service.audioContext).toBeDefined()
      expect(service.audioContext.state).toBe('running')
    })

    it('should have default state', () => {
      expect(service.mode).toBe(NOISE_SUPPRESSION_MODE.OFF)
      expect(service.audioContext).toBeNull()
      expect(service.currentAudioLevel).toBe(0)
      expect(service.noiseFloor).toBe(0)
    })
  })

  describe('processStream', () => {
    it('should return original stream when mode is OFF', async () => {
      const result = await service.processStream(mockStream, NOISE_SUPPRESSION_MODE.OFF)
      expect(result).toBe(mockStream)
      expect(service.mode).toBe(NOISE_SUPPRESSION_MODE.OFF)
    })

    it('should process stream with MODERATE mode', async () => {
      const result = await service.processStream(mockStream, NOISE_SUPPRESSION_MODE.MODERATE)

      expect(result).toBeDefined()
      expect(service.mode).toBe(NOISE_SUPPRESSION_MODE.MODERATE)
      expect(service.audioContext).toBeDefined()
      expect(service.sourceNode).toBeDefined()
      expect(service.analyzerNode).toBeDefined()
      expect(service.filterNode).toBeDefined()
      expect(service.gainNode).toBeDefined()
    })

    it('should process stream with AGGRESSIVE mode', async () => {
      const result = await service.processStream(mockStream, NOISE_SUPPRESSION_MODE.AGGRESSIVE)

      expect(result).toBeDefined()
      expect(service.mode).toBe(NOISE_SUPPRESSION_MODE.AGGRESSIVE)
      expect(service.audioContext).toBeDefined()
    })

    it('should return original stream on processing error', async () => {
      // Mock error in audio context creation
      global.AudioContext = class {
        constructor() {
          throw new Error('AudioContext error')
        }
      }

      const newService = new NoiseSuppressionService()
      const result = await newService.processStream(mockStream, NOISE_SUPPRESSION_MODE.MODERATE)

      expect(result).toBe(mockStream)
    })

    it('should handle stream without audio track gracefully', async () => {
      const videoOnlyStream = new MediaStream([])
      const result = await service.processStream(videoOnlyStream, NOISE_SUPPRESSION_MODE.MODERATE)

      expect(result).toBe(videoOnlyStream)
    })
  })

  describe('mode management', () => {
    beforeEach(async () => {
      await service.processStream(mockStream, NOISE_SUPPRESSION_MODE.MODERATE)
    })

    it('should change mode successfully', async () => {
      await service.changeMode(NOISE_SUPPRESSION_MODE.AGGRESSIVE)
      expect(service.mode).toBe(NOISE_SUPPRESSION_MODE.AGGRESSIVE)
    })

    it('should not change if mode is the same', async () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

      await service.changeMode(NOISE_SUPPRESSION_MODE.MODERATE)

      consoleSpy.mockRestore()
    })

    it('should cleanup when changing to OFF mode', async () => {
      const cleanupSpy = vi.spyOn(service, 'cleanup')

      const result = await service.changeMode(NOISE_SUPPRESSION_MODE.OFF)

      expect(service.mode).toBe(NOISE_SUPPRESSION_MODE.OFF)
      expect(result).toBe(mockStream)
    })

    it('should update filters when changing between active modes', async () => {
      const setupFiltersSpy = vi.spyOn(service, 'setupFilters')

      await service.changeMode(NOISE_SUPPRESSION_MODE.AGGRESSIVE)

      expect(setupFiltersSpy).toHaveBeenCalledWith(NOISE_SUPPRESSION_MODE.AGGRESSIVE)
    })
  })

  describe('filter setup', () => {
    beforeEach(async () => {
      await service.initialize()
      service.filterNode = service.audioContext.createBiquadFilter()
    })

    it('should setup MODERATE mode filters correctly', () => {
      service.setupFilters(NOISE_SUPPRESSION_MODE.MODERATE)

      expect(service.filterNode.type).toBe('highpass')
      expect(service.filterNode.frequency.value).toBe(100)
      expect(service.activityThreshold).toBe(0.02)
    })

    it('should setup AGGRESSIVE mode filters correctly', () => {
      service.setupFilters(NOISE_SUPPRESSION_MODE.AGGRESSIVE)

      expect(service.filterNode.type).toBe('highpass')
      expect(service.filterNode.frequency.value).toBe(200)
      expect(service.activityThreshold).toBe(0.03)
    })
  })

  describe('activity monitoring', () => {
    beforeEach(async () => {
      vi.useFakeTimers()
      await service.processStream(mockStream, NOISE_SUPPRESSION_MODE.MODERATE)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should emit activity events', async () => {
      const activityHandler = vi.fn()
      service.on('activity', activityHandler)

      // Fast-forward time to trigger monitoring
      vi.advanceTimersByTime(200)

      expect(activityHandler).toHaveBeenCalled()
      const callArg = activityHandler.mock.calls[0][0]
      expect(callArg).toHaveProperty('level')
      expect(callArg).toHaveProperty('noiseFloor')
      expect(callArg).toHaveProperty('isVoiceActive')
      expect(callArg).toHaveProperty('suppressionActive')
    })

    it('should stop monitoring when cleanup is called', () => {
      service.cleanup()
      expect(service.monitoringInterval).toBeNull()
    })
  })

  describe('noise profile learning', () => {
    it('should learn noise profile', async () => {
      vi.useFakeTimers()

      const profileLearnedHandler = vi.fn()
      service.on('profile-learned', profileLearnedHandler)

      await service.processStream(mockStream, NOISE_SUPPRESSION_MODE.MODERATE)

      expect(service.isLearningNoise).toBe(true)

      // Fast-forward past learning duration
      vi.advanceTimersByTime(2100)

      expect(service.isLearningNoise).toBe(false)
      expect(profileLearnedHandler).toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('statistics', () => {
    it('should return correct stats when inactive', () => {
      const stats = service.getStats()

      expect(stats).toEqual({
        mode: NOISE_SUPPRESSION_MODE.OFF,
        audioLevel: 0,
        noiseFloor: 0,
        isActive: false,
        isLearning: false,
        contextState: undefined
      })
    })

    it('should return correct stats when active', async () => {
      await service.processStream(mockStream, NOISE_SUPPRESSION_MODE.MODERATE)

      const stats = service.getStats()

      expect(stats.mode).toBe(NOISE_SUPPRESSION_MODE.MODERATE)
      expect(stats.isActive).toBe(true)
      expect(stats.contextState).toBe('running')
    })
  })

  describe('mode descriptions', () => {
    it('should return correct description for OFF mode', () => {
      const desc = service.getModeDescription(NOISE_SUPPRESSION_MODE.OFF)
      expect(desc.name).toBe('Выключено')
      expect(desc.description).toBe('Без подавления шума')
    })

    it('should return correct description for MODERATE mode', () => {
      const desc = service.getModeDescription(NOISE_SUPPRESSION_MODE.MODERATE)
      expect(desc.name).toBe('Умеренное')
      expect(desc.description).toBe('Сбалансированное подавление шума')
    })

    it('should return correct description for AGGRESSIVE mode', () => {
      const desc = service.getModeDescription(NOISE_SUPPRESSION_MODE.AGGRESSIVE)
      expect(desc.name).toBe('Агрессивное')
      expect(desc.description).toBe('Максимальное подавление шума')
    })
  })

  describe('event handling', () => {
    it('should register and call event handlers', () => {
      const handler = vi.fn()
      service.on('test-event', handler)

      service.emit('test-event', { data: 'test' })

      expect(handler).toHaveBeenCalledWith({ data: 'test' })
    })

    it('should unregister event handlers', () => {
      const handler = vi.fn()
      service.on('test-event', handler)
      service.off('test-event', handler)

      service.emit('test-event', { data: 'test' })

      expect(handler).not.toHaveBeenCalled()
    })

    it('should handle errors in event handlers gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error')
      })
      const goodHandler = vi.fn()

      service.on('test-event', errorHandler)
      service.on('test-event', goodHandler)

      service.emit('test-event', {})

      expect(goodHandler).toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    beforeEach(async () => {
      await service.processStream(mockStream, NOISE_SUPPRESSION_MODE.MODERATE)
    })

    it('should cleanup all resources', () => {
      service.cleanup()

      expect(service.sourceNode).toBeNull()
      expect(service.analyzerNode).toBeNull()
      expect(service.filterNode).toBeNull()
      expect(service.gainNode).toBeNull()
      expect(service.destinationStream).toBeNull()
      expect(service.monitoringInterval).toBeNull()
    })

    it('should close audio context', async () => {
      const closeSpy = vi.spyOn(service.audioContext, 'close')

      service.cleanup()

      await vi.waitFor(() => {
        expect(closeSpy).toHaveBeenCalled()
      })
    })

    it('should handle cleanup errors gracefully', () => {
      // Mock disconnect to throw error
      if (service.sourceNode) {
        service.sourceNode.disconnect = () => {
          throw new Error('Disconnect error')
        }
      }

      expect(() => service.cleanup()).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle null stream', async () => {
      await expect(service.processStream(null, NOISE_SUPPRESSION_MODE.MODERATE))
        .rejects
        .toThrow('No stream provided')
    })

    it('should handle undefined stream', async () => {
      await expect(service.processStream(undefined, NOISE_SUPPRESSION_MODE.MODERATE))
        .rejects
        .toThrow('No stream provided')
    })

    it('should handle multiple processStream calls', async () => {
      const result1 = await service.processStream(mockStream, NOISE_SUPPRESSION_MODE.MODERATE)
      const result2 = await service.processStream(mockStream, NOISE_SUPPRESSION_MODE.AGGRESSIVE)

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      expect(service.mode).toBe(NOISE_SUPPRESSION_MODE.AGGRESSIVE)
    })
  })
})
