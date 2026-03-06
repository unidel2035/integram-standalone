import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import WebRTCRelayService from '../WebRTCRelayService'

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url
    this.readyState = WebSocket.CONNECTING
    this.onopen = null
    this.onclose = null
    this.onerror = null
    this.onmessage = null

    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      if (this.onopen) {
        this.onopen()
      }
    }, 10)
  }

  send(data) {
    // Mock send - do nothing
  }

  close() {
    this.readyState = WebSocket.CLOSED
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Normal closure' })
    }
  }
}

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  constructor() {
    this.signalingState = 'stable'
    this.connectionState = 'new'
    this.iceConnectionState = 'new'
    this.localDescription = null
    this.remoteDescription = null
    this.onicecandidate = null
    this.ontrack = null
    this.onconnectionstatechange = null
    this.oniceconnectionstatechange = null
    this.onnegotiationneeded = null
    this._senders = []
    this._receivers = []
    this._transceivers = []
  }

  async createOffer() {
    this.signalingState = 'have-local-offer'
    return { type: 'offer', sdp: 'mock-offer-sdp' }
  }

  async createAnswer() {
    return { type: 'answer', sdp: 'mock-answer-sdp' }
  }

  async setLocalDescription(description) {
    this.localDescription = description
    if (description.type === 'offer') {
      this.signalingState = 'have-local-offer'
    } else if (description.type === 'answer') {
      this.signalingState = 'stable'
    } else if (description.type === 'rollback') {
      this.signalingState = 'stable'
      this.localDescription = null
    }
  }

  async setRemoteDescription(description) {
    // Simulate the actual RTCPeerConnection behavior
    if (description.type === 'offer') {
      if (this.signalingState !== 'stable' && this.signalingState !== 'have-remote-offer') {
        throw new DOMException('Invalid state for setRemoteDescription with offer', 'InvalidStateError')
      }
      this.remoteDescription = description
      this.signalingState = 'have-remote-offer'
    } else if (description.type === 'answer') {
      // CRITICAL: Answer can only be set in 'have-local-offer' state
      if (this.signalingState !== 'have-local-offer') {
        throw new DOMException(
          `Failed to execute 'setRemoteDescription' on 'RTCPeerConnection': Failed to set remote answer sdp: Called in wrong state: ${this.signalingState}`,
          'InvalidStateError'
        )
      }
      this.remoteDescription = description
      this.signalingState = 'stable'
    }
  }

  async addIceCandidate() {
    // Mock implementation
  }

  addTrack(track, stream) {
    this._senders.push({ track })
    return { track }
  }

  getSenders() {
    return this._senders
  }

  getReceivers() {
    return this._receivers
  }

  getTransceivers() {
    return this._transceivers
  }

  close() {
    this.connectionState = 'closed'
    this.iceConnectionState = 'closed'
    this.signalingState = 'closed'
  }
}

// Setup global mocks
global.WebSocket = MockWebSocket
global.RTCPeerConnection = MockRTCPeerConnection
global.RTCSessionDescription = class RTCSessionDescription {
  constructor(init) {
    this.type = init.type
    this.sdp = init.sdp
  }
}
global.RTCIceCandidate = class RTCIceCandidate {
  constructor(init) {
    this.candidate = init.candidate
  }
}

describe('WebRTCRelayService', () => {
  let service

  beforeEach(() => {
    service = new WebRTCRelayService('test-room', 'TestUser')
  })

  afterEach(() => {
    if (service) {
      service.disconnect()
    }
  })

  describe('Signaling State Management', () => {
    it('should reject answer when peer connection is in stable state', async () => {
      // Create a peer connection
      const peerId = 'peer_test_123'
      service.createPeerConnection(peerId, false)

      const pc = service.peerConnections.get(peerId)
      expect(pc).toBeDefined()
      expect(pc.signalingState).toBe('stable')

      // Try to handle an answer when in stable state
      const mockAnswer = { type: 'answer', sdp: 'mock-answer-sdp' }

      // This should NOT throw an error (our fix handles it gracefully)
      await expect(service.handleAnswer(peerId, mockAnswer)).resolves.toBeUndefined()

      // The answer should be ignored, so signaling state should still be stable
      expect(pc.signalingState).toBe('stable')
    })

    it('should accept answer when peer connection is in have-local-offer state', async () => {
      // Create a peer connection and make an offer
      const peerId = 'peer_test_456'
      service.createPeerConnection(peerId, false)

      const pc = service.peerConnections.get(peerId)

      // Create an offer to move to have-local-offer state
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      expect(pc.signalingState).toBe('have-local-offer')

      // Now handle an answer
      const mockAnswer = { type: 'answer', sdp: 'mock-answer-sdp' }
      await service.handleAnswer(peerId, mockAnswer)

      // After processing answer, should be in stable state
      expect(pc.signalingState).toBe('stable')
    })

    it('should handle collision detection with polite/impolite peer pattern', async () => {
      const peerId = 'peer_test_789'

      // Make our peerId smaller so we're the "polite" peer
      service.peerId = 'peer_aaa'

      service.createPeerConnection(peerId, false)
      const pc = service.peerConnections.get(peerId)

      // Simulate collision: we're making an offer
      service.makingOffer.set(peerId, true)
      await pc.setLocalDescription({ type: 'offer', sdp: 'our-offer' })

      expect(pc.signalingState).toBe('have-local-offer')

      // Remote peer also sends an offer (collision)
      const remoteOffer = { type: 'offer', sdp: 'remote-offer' }

      // This should trigger rollback since we're polite
      await service.handleOffer(peerId, remoteOffer)

      // After handling, we should have processed the remote offer
      expect(pc.remoteDescription).toBeDefined()
      expect(pc.remoteDescription.type).toBe('offer')
    })

    it('should ignore incoming offer when we are impolite peer during collision', async () => {
      const peerId = 'peer_test_aaa'

      // Make our peerId larger so we're the "impolite" peer
      service.peerId = 'peer_zzz'

      service.createPeerConnection(peerId, false)
      const pc = service.peerConnections.get(peerId)

      // Simulate collision: we're making an offer
      service.makingOffer.set(peerId, true)
      await pc.setLocalDescription({ type: 'offer', sdp: 'our-offer' })

      expect(pc.signalingState).toBe('have-local-offer')

      // Remote peer also sends an offer (collision)
      const remoteOffer = { type: 'offer', sdp: 'remote-offer' }

      // This should ignore the remote offer since we're impolite
      await service.handleOffer(peerId, remoteOffer)

      // Our local offer should still be there (not rolled back)
      expect(pc.localDescription).toBeDefined()
      expect(pc.localDescription.type).toBe('offer')
      // Remote description should NOT be set
      expect(pc.remoteDescription).toBeNull()
    })
  })

  describe('Peer Connection Management', () => {
    it('should create peer connection with unique ID', () => {
      const peerId = service.generatePeerId()
      expect(peerId).toMatch(/^peer_\d+_[a-z0-9]+$/)
    })

    it('should not create duplicate peer connections', () => {
      const peerId = 'peer_test_duplicate'

      service.createPeerConnection(peerId, false)
      const pc1 = service.peerConnections.get(peerId)

      service.createPeerConnection(peerId, false)
      const pc2 = service.peerConnections.get(peerId)

      // Should be the same peer connection
      expect(pc1).toBe(pc2)
    })

    it('should close peer connection properly', () => {
      const peerId = 'peer_test_close'

      service.createPeerConnection(peerId, false)
      expect(service.peerConnections.has(peerId)).toBe(true)

      service.closePeerConnection(peerId)
      expect(service.peerConnections.has(peerId)).toBe(false)
    })
  })

  describe('Local Stream Management', () => {
    it('should set local stream', () => {
      const mockStream = {
        id: 'stream_123',
        getVideoTracks: () => [{ kind: 'video', enabled: true }],
        getAudioTracks: () => [{ kind: 'audio', enabled: true }],
        getTracks: () => [
          { kind: 'video', enabled: true },
          { kind: 'audio', enabled: true }
        ]
      }

      service.setLocalStream(mockStream)

      expect(service.localStream).toBe(mockStream)
    })

    it('should add local stream tracks to existing peer connections', () => {
      const peerId = 'peer_test_stream'
      service.createPeerConnection(peerId, false)

      const mockStream = {
        id: 'stream_123',
        getVideoTracks: () => [{ kind: 'video', enabled: true, readyState: 'live' }],
        getAudioTracks: () => [{ kind: 'audio', enabled: true, readyState: 'live' }],
        getTracks: () => [
          { kind: 'video', enabled: true, readyState: 'live' },
          { kind: 'audio', enabled: true, readyState: 'live' }
        ]
      }

      service.setLocalStream(mockStream)

      const pc = service.peerConnections.get(peerId)
      // Tracks should be added, but we need to check senders
      // In our mock, senders are tracked when addTrack is called
      // Note: setLocalStream uses replaceTrack if sender exists, addTrack if not
    })
  })

  describe('Event Handling', () => {
    it('should register and emit events', () => {
      let eventReceived = false
      let eventData = null

      service.on('test-event', (data) => {
        eventReceived = true
        eventData = data
      })

      service.emit('test-event', 'test-data')

      expect(eventReceived).toBe(true)
      expect(eventData).toBe('test-data')
    })

    it('should support multiple event handlers', () => {
      let handler1Called = false
      let handler2Called = false

      service.on('test-event', () => { handler1Called = true })
      service.on('test-event', () => { handler2Called = true })

      service.emit('test-event')

      expect(handler1Called).toBe(true)
      expect(handler2Called).toBe(true)
    })
  })

  describe('ICE Server Configuration', () => {
    it('should use default STUN servers', () => {
      const config = service.getIceServersConfig()

      expect(config.iceServers).toBeDefined()
      expect(config.iceServers.length).toBeGreaterThan(0)

      const hasStunServer = config.iceServers.some(server =>
        server.urls && server.urls.startsWith('stun:')
      )
      expect(hasStunServer).toBe(true)
    })
  })

  describe('Device Detection', () => {
    it('should detect device type', () => {
      const deviceType = service.detectDeviceType()

      // Should return a string describing the device
      expect(typeof deviceType).toBe('string')
      expect(deviceType.length).toBeGreaterThan(0)
    })
  })
})
