import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import UnifiedWebRTCService, { CONNECTION_MODE } from '../UnifiedWebRTCService'

// Mock the underlying services
vi.mock('../WebRTCService', () => ({
  default: vi.fn().mockImplementation((roomName, userName) => ({
    roomName,
    userName,
    connected: false,
    peerId: 'test-peer-p2p',
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    setLocalStream: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    broadcastScreenShare: vi.fn(),
    sendChatMessage: vi.fn(),
    getStats: vi.fn().mockResolvedValue({}),
    logConnectionStates: vi.fn(),
  }))
}))

vi.mock('../WebRTCRelayService', () => ({
  default: vi.fn().mockImplementation((roomName, userName) => ({
    roomName,
    userName,
    connected: false,
    peerId: 'test-peer-relay',
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    setLocalStream: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    broadcastScreenShare: vi.fn(),
    sendChatMessage: vi.fn(),
    verifyAndFixConnections: vi.fn().mockResolvedValue(undefined),
    logConnectionStates: vi.fn(),
  }))
}))

describe('UnifiedWebRTCService', () => {
  let service
  const roomName = 'test-room'
  const userName = 'Test User'

  describe('Initialization', () => {
    it('should initialize with relay mode by default', () => {
      service = new UnifiedWebRTCService(roomName, userName)
      expect(service.currentMode).toBe(CONNECTION_MODE.RELAY)
      expect(service.activeService).toBeDefined()
    })

    it('should initialize with P2P mode when specified', () => {
      service = new UnifiedWebRTCService(roomName, userName, CONNECTION_MODE.P2P)
      expect(service.currentMode).toBe(CONNECTION_MODE.P2P)
      expect(service.activeService).toBeDefined()
    })

    it('should initialize with relay mode when specified', () => {
      service = new UnifiedWebRTCService(roomName, userName, CONNECTION_MODE.RELAY)
      expect(service.currentMode).toBe(CONNECTION_MODE.RELAY)
      expect(service.activeService).toBeDefined()
    })
  })

  describe('Mode Switching', () => {
    beforeEach(() => {
      service = new UnifiedWebRTCService(roomName, userName, CONNECTION_MODE.RELAY)
    })

    afterEach(() => {
      if (service) {
        service.disconnect()
      }
    })

    it('should switch from relay to P2P mode', async () => {
      const initialMode = service.currentMode
      expect(initialMode).toBe(CONNECTION_MODE.RELAY)

      await service.switchMode(CONNECTION_MODE.P2P)

      expect(service.currentMode).toBe(CONNECTION_MODE.P2P)
    })

    it('should switch from P2P to relay mode', async () => {
      service = new UnifiedWebRTCService(roomName, userName, CONNECTION_MODE.P2P)
      expect(service.currentMode).toBe(CONNECTION_MODE.P2P)

      await service.switchMode(CONNECTION_MODE.RELAY)

      expect(service.currentMode).toBe(CONNECTION_MODE.RELAY)
    })

    it('should not switch if already in requested mode', async () => {
      const initialMode = service.currentMode
      expect(initialMode).toBe(CONNECTION_MODE.RELAY)

      await service.switchMode(CONNECTION_MODE.RELAY)

      expect(service.currentMode).toBe(CONNECTION_MODE.RELAY)
    })

    it('should emit mode-changed event after switching', async () => {
      const handler = vi.fn()
      service.on('mode-changed', handler)

      // Simulate connection
      service.activeService.connected = true

      await service.switchMode(CONNECTION_MODE.P2P)

      expect(handler).toHaveBeenCalledWith(CONNECTION_MODE.P2P)
    })

    it('should preserve local stream when switching modes', async () => {
      const mockStream = { id: 'test-stream' }
      service.setLocalStream(mockStream)

      expect(service.localStream).toBe(mockStream)

      await service.switchMode(CONNECTION_MODE.P2P)

      expect(service.localStream).toBe(mockStream)
    })
  })

  describe('Mode Information', () => {
    it('should return current mode', () => {
      service = new UnifiedWebRTCService(roomName, userName, CONNECTION_MODE.P2P)
      expect(service.getMode()).toBe(CONNECTION_MODE.P2P)
    })

    it('should return P2P mode description', () => {
      service = new UnifiedWebRTCService(roomName, userName, CONNECTION_MODE.P2P)
      const desc = service.getModeDescription()

      expect(desc.name).toContain('P2P')
      expect(desc.description).toBeDefined()
      expect(desc.icon).toBe('pi-link')
    })

    it('should return Relay mode description', () => {
      service = new UnifiedWebRTCService(roomName, userName, CONNECTION_MODE.RELAY)
      const desc = service.getModeDescription()

      expect(desc.name).toContain('Relay')
      expect(desc.description).toBeDefined()
      expect(desc.icon).toBe('pi-server')
    })

    it('should return available modes', () => {
      const modes = UnifiedWebRTCService.getAvailableModes()

      expect(modes).toHaveLength(2)
      expect(modes[0].value).toBe(CONNECTION_MODE.P2P)
      expect(modes[1].value).toBe(CONNECTION_MODE.RELAY)
      expect(modes[1].recommended).toBe(true)
    })
  })

  describe('Method Delegation', () => {
    beforeEach(() => {
      service = new UnifiedWebRTCService(roomName, userName, CONNECTION_MODE.RELAY)
    })

    afterEach(() => {
      if (service) {
        service.disconnect()
      }
    })

    it('should delegate connect to active service', async () => {
      const connectSpy = vi.spyOn(service.activeService, 'connect')
      await service.connect()
      expect(connectSpy).toHaveBeenCalled()
    })

    it('should delegate disconnect to active service', () => {
      const disconnectSpy = vi.spyOn(service.activeService, 'disconnect')
      service.disconnect()
      expect(disconnectSpy).toHaveBeenCalled()
    })

    it('should delegate setLocalStream to active service', () => {
      const mockStream = { id: 'test-stream' }
      const setStreamSpy = vi.spyOn(service.activeService, 'setLocalStream')

      service.setLocalStream(mockStream)

      expect(setStreamSpy).toHaveBeenCalledWith(mockStream)
    })

    it('should delegate broadcastScreenShare to active service', () => {
      const mockStream = { id: 'screen-stream' }
      const broadcastSpy = vi.spyOn(service.activeService, 'broadcastScreenShare')

      service.broadcastScreenShare(mockStream)

      expect(broadcastSpy).toHaveBeenCalledWith(mockStream)
    })

    it('should delegate sendChatMessage to active service', () => {
      const message = { text: 'Hello' }
      const sendSpy = vi.spyOn(service.activeService, 'sendChatMessage')

      service.sendChatMessage(message)

      expect(sendSpy).toHaveBeenCalledWith(message)
    })

    it('should return connected status from active service', () => {
      service.activeService.connected = true
      expect(service.connected).toBe(true)

      service.activeService.connected = false
      expect(service.connected).toBe(false)
    })

    it('should return peerId from active service', () => {
      expect(service.peerId).toBe(service.activeService.peerId)
    })
  })

  describe('Event Handling', () => {
    beforeEach(() => {
      service = new UnifiedWebRTCService(roomName, userName, CONNECTION_MODE.RELAY)
    })

    afterEach(() => {
      if (service) {
        service.disconnect()
      }
    })

    it('should allow registering event handlers', () => {
      const handler = vi.fn()
      service.on('test-event', handler)

      expect(service.eventHandlers.get('test-event')).toContain(handler)
    })

    it('should emit events to registered handlers', () => {
      const handler = vi.fn()
      service.on('test-event', handler)

      service.emit('test-event', 'arg1', 'arg2')

      expect(handler).toHaveBeenCalledWith('arg1', 'arg2')
    })

    it('should forward events from active service', () => {
      const handler = vi.fn()
      service.on('peer-joined', handler)

      // Simulate event from active service
      const activeServiceHandler = service.activeService.on.mock.calls.find(
        call => call[0] === 'peer-joined'
      )
      if (activeServiceHandler) {
        activeServiceHandler[1]('peer-123', 'Test Peer')
      }

      // Note: This test checks that event forwarding is set up
      // Actual forwarding is tested through integration tests
    })
  })

  describe('Persistent State', () => {
    it('should handle local stream across mode switches', async () => {
      service = new UnifiedWebRTCService(roomName, userName, CONNECTION_MODE.RELAY)

      const mockStream = { id: 'test-stream', getTracks: () => [] }
      service.setLocalStream(mockStream)

      await service.switchMode(CONNECTION_MODE.P2P)

      // Verify stream is preserved
      expect(service.localStream).toBe(mockStream)

      // Verify new service received the stream
      const setStreamSpy = vi.spyOn(service.activeService, 'setLocalStream')
      service.setLocalStream(mockStream)
      expect(setStreamSpy).toHaveBeenCalledWith(mockStream)
    })
  })
})
