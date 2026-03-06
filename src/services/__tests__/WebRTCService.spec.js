import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import WebRTCService from '../WebRTCService'

// Mock SimplePeer
vi.mock('simple-peer', () => {
  return {
    default: class SimplePeerMock {
      constructor(options) {
        this.initiator = options.initiator
        this.stream = options.stream
        this.config = options.config
        this._pc = {
          connectionState: 'new',
          iceConnectionState: 'new',
          signalingState: 'stable',
          iceGatheringState: 'new',
          getSenders: vi.fn(() => []),
          getReceivers: vi.fn(() => []),
          addTrack: vi.fn(),
          oniceconnectionstatechange: null,
          onconnectionstatechange: null
        }
        this._eventHandlers = {}
      }

      on(event, handler) {
        if (!this._eventHandlers[event]) {
          this._eventHandlers[event] = []
        }
        this._eventHandlers[event].push(handler)
      }

      emit(event, ...args) {
        if (this._eventHandlers[event]) {
          this._eventHandlers[event].forEach(handler => handler(...args))
        }
      }

      signal(data) {
        // Simulate signaling
        setTimeout(() => {
          this.emit('signal', { type: 'answer', sdp: 'mock-sdp' })
        }, 0)
      }

      destroy() {
        this.emit('close')
      }

      send(data) {
        // Mock send
      }
    }
  }
})

// Mock WebSocket
global.WebSocket = class WebSocketMock {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  constructor(url) {
    this.url = url
    this.readyState = WebSocket.OPEN
    this._eventHandlers = {}

    // Simulate connection
    setTimeout(() => {
      if (this.onopen) this.onopen()
    }, 0)
  }

  addEventListener(event, handler) {
    if (!this._eventHandlers[event]) {
      this._eventHandlers[event] = []
    }
    this._eventHandlers[event].push(handler)
  }

  send(data) {
    // Mock send
  }

  close() {
    this.readyState = WebSocket.CLOSED
    if (this.onclose) this.onclose({ code: 1000, reason: 'Normal closure' })
  }
}

// Mock fetch for health check
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ status: 'ok' })
  })
)

describe('WebRTCService', () => {
  let service
  let mockStream

  beforeEach(() => {
    // Create a mock MediaStream
    mockStream = {
      id: 'mock-stream-id',
      active: true,
      getVideoTracks: () => [{
        id: 'video-track',
        kind: 'video',
        enabled: true,
        readyState: 'live',
        muted: false,
        label: 'Mock Video'
      }],
      getAudioTracks: () => [{
        id: 'audio-track',
        kind: 'audio',
        enabled: true,
        readyState: 'live',
        muted: false,
        label: 'Mock Audio'
      }],
      getTracks: function() {
        return [...this.getVideoTracks(), ...this.getAudioTracks()]
      }
    }

    service = new WebRTCService('test-room', 'Test User')

    // Suppress console logs in tests
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    if (service) {
      service.disconnect()
    }
    vi.restoreAllMocks()
  })

  describe('Initialization', () => {
    it('should create a service instance with correct properties', () => {
      expect(service.roomName).toBe('test-room')
      expect(service.userName).toBe('Test User')
      expect(service.peers).toBeInstanceOf(Map)
      expect(service.peerNames).toBeInstanceOf(Map)
      expect(service.peerDevices).toBeInstanceOf(Map)
      expect(service.connected).toBe(false)
    })

    it('should generate a unique peer ID', () => {
      const peerId = service.peerId
      expect(peerId).toBeTruthy()
      expect(peerId).toMatch(/^peer_/)
    })

    it('should configure ICE servers', () => {
      const iceServers = service.iceServers
      expect(iceServers).toHaveProperty('iceServers')
      expect(Array.isArray(iceServers.iceServers)).toBe(true)
      expect(iceServers.iceServers.length).toBeGreaterThan(0)
    })
  })

  describe('Local Stream Management', () => {
    it('should set local stream', () => {
      service.setLocalStream(mockStream)
      expect(service.localStream).toBe(mockStream)
    })

    it('should update stream on existing peers when setting local stream', () => {
      // Create a peer first
      const peer = service.createPeer('peer-1', true)
      const replaceSpy = vi.fn().mockResolvedValue(undefined)

      peer._pc.getSenders = vi.fn(() => [
        { track: { kind: 'video' }, replaceTrack: replaceSpy },
        { track: { kind: 'audio' }, replaceTrack: replaceSpy }
      ])

      service.setLocalStream(mockStream)

      // Should attempt to replace tracks
      expect(replaceSpy).toHaveBeenCalled()
    })
  })

  describe('Peer Connection Management', () => {
    beforeEach(() => {
      service.setLocalStream(mockStream)
    })

    it('should create a peer as initiator', () => {
      const peer = service.createPeer('peer-1', true)

      expect(peer).toBeTruthy()
      expect(peer.initiator).toBe(true)
      expect(service.peers.has('peer-1')).toBe(true)
    })

    it('should create a peer as receiver', () => {
      const peer = service.createPeer('peer-2', false)

      expect(peer).toBeTruthy()
      expect(peer.initiator).toBe(false)
      expect(service.peers.has('peer-2')).toBe(true)
    })

    it('should handle incoming stream from peer', async () => {
      const peer = service.createPeer('peer-1', true)

      const streamPromise = new Promise((resolve) => {
        service.on('stream', (peerId, stream, peerName, deviceType) => {
          expect(peerId).toBe('peer-1')
          expect(stream).toBe(mockStream)
          resolve()
        })
      })

      // Simulate receiving a stream
      peer.emit('stream', mockStream)
      await streamPromise
    })

    it('should handle peer connection established', async () => {
      const peer = service.createPeer('peer-1', true)

      const connectPromise = new Promise((resolve) => {
        peer.on('connect', () => {
          expect(service.peers.has('peer-1')).toBe(true)
          resolve()
        })
      })

      peer.emit('connect')
      await connectPromise
    })

    it('should handle peer disconnection', async () => {
      const peer = service.createPeer('peer-1', true)

      const disconnectPromise = new Promise((resolve) => {
        service.on('peer-left', (peerId) => {
          expect(peerId).toBe('peer-1')
          expect(service.peers.has('peer-1')).toBe(false)
          resolve()
        })
      })

      peer.emit('close')
      await disconnectPromise
    })

    it('should remove peer and cleanup', () => {
      const peer = service.createPeer('peer-1', true)
      service.peerNames.set('peer-1', 'Peer One')
      service.peerDevices.set('peer-1', 'Desktop')

      service.removePeer('peer-1')

      expect(service.peers.has('peer-1')).toBe(false)
      expect(service.peerNames.has('peer-1')).toBe(false)
      expect(service.peerDevices.has('peer-1')).toBe(false)
    })
  })

  describe('Signaling', () => {
    beforeEach(() => {
      service.setLocalStream(mockStream)
    })

    it('should handle incoming signal for new peer', () => {
      const signal = { type: 'offer', sdp: 'mock-sdp' }

      service.signal('peer-1', signal)

      // Should create a new peer if it doesn't exist
      expect(service.peers.has('peer-1')).toBe(true)
    })

    it('should handle incoming signal for existing peer', () => {
      const peer = service.createPeer('peer-1', false)
      const signalSpy = vi.spyOn(peer, 'signal')

      const signal = { type: 'answer', sdp: 'mock-sdp' }
      service.signal('peer-1', signal)

      expect(signalSpy).toHaveBeenCalledWith(signal)
    })
  })

  describe('Connection to Signaling Server', () => {
    it('should connect to WebSocket server', async () => {
      await service.connect()

      expect(service.connected).toBe(true)
      expect(service.socket).toBeTruthy()
    })

    it('should handle connection failure when backend is unavailable', async () => {
      // Mock failed health check
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Connection refused'))
      )

      const newService = new WebRTCService('test-room', 'Test User')

      await expect(newService.connect()).rejects.toThrow()
    })
  })

  describe('Event Handling', () => {
    it('should register event handlers', () => {
      const handler = vi.fn()
      service.on('test-event', handler)

      service.emit('test-event', 'arg1', 'arg2')

      expect(handler).toHaveBeenCalledWith('arg1', 'arg2')
    })

    it('should support multiple handlers for same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      service.on('test-event', handler1)
      service.on('test-event', handler2)

      service.emit('test-event', 'data')

      expect(handler1).toHaveBeenCalledWith('data')
      expect(handler2).toHaveBeenCalledWith('data')
    })
  })

  describe('Device Detection', () => {
    it('should detect device type', () => {
      const deviceType = service.detectDeviceType()
      expect(deviceType).toBeTruthy()
      expect(typeof deviceType).toBe('string')
    })
  })

  describe('Debugging and Diagnostics', () => {
    beforeEach(() => {
      service.setLocalStream(mockStream)
    })

    it('should log connection states', () => {
      const consoleLogSpy = vi.spyOn(console, 'log')

      service.createPeer('peer-1', true)
      service.createPeer('peer-2', false)

      service.logConnectionStates()

      expect(consoleLogSpy).toHaveBeenCalled()
      expect(consoleLogSpy.mock.calls.some(call =>
        call[0].includes('Total peers: 2')
      )).toBe(true)
    })
  })

  describe('Cleanup', () => {
    it('should disconnect and cleanup all resources', async () => {
      // Ensure fetch mock is set for this test
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok' })
        })
      )

      service.setLocalStream(mockStream)
      await service.connect()

      service.createPeer('peer-1', true)
      service.createPeer('peer-2', false)

      service.disconnect()

      expect(service.peers.size).toBe(0)
      expect(service.connected).toBe(false)
    })
  })
})
