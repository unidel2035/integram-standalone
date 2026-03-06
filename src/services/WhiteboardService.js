import { logger } from '@/utils/logger'
import { getOrchestratorUrl } from '@/utils/apiConfig'
import io from 'socket.io-client'

/**
 * Whiteboard Service for collaborative real-time drawing
 * Uses Socket.IO for WebSocket communication
 */
export default class WhiteboardService {
  constructor(roomName, userName = 'User') {
    this.roomName = roomName
    this.userName = userName
    this.socket = null
    this.connected = false
    this.eventHandlers = new Map()
    this.userId = this.generateUserId()
  }

  /**
   * Generate a unique user ID
   */
  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get the backend orchestrator URL
   */
  getBackendUrl() {
    return getOrchestratorUrl().replace(/\/$/, '')
  }

  /**
   * Connect to the whiteboard room
   */
  async connect() {
    try {
      const baseUrl = this.getBackendUrl()
      logger.debug('🎨 [Whiteboard] Connecting to:', baseUrl)

      this.socket = io(baseUrl, {
        path: '/socket.io',
        // Use only polling due to Cloudflare HTTP/2 WebSocket incompatibility (Issue #6252)
        // Cloudflare uses HTTP/2 which doesn't support WebSocket upgrade
        transports: ['polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      })

      this.setupSocketListeners()

      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 10000)

        this.socket.once('connect', () => {
          clearTimeout(timeout)
          this.connected = true
          logger.debug('🎨 [Whiteboard] Connected to WebSocket')
          resolve()
        })

        this.socket.once('connect_error', (error) => {
          clearTimeout(timeout)
          reject(error)
        })
      })

      // Join whiteboard room
      this.socket.emit('whiteboard:join', {
        roomName: this.roomName,
        userId: this.userId,
        userName: this.userName
      })

      logger.info('🎨 [Whiteboard] Joined room:', this.roomName)
      return true
    } catch (error) {
      logger.error('🎨 [Whiteboard] Connection error:', error)
      this.emit('error', error)
      return false
    }
  }

  /**
   * Setup socket event listeners
   */
  setupSocketListeners() {
    this.socket.on('connect', () => {
      this.connected = true
      logger.debug('🎨 [Whiteboard] Socket connected')
      this.emit('connected')
    })

    this.socket.on('disconnect', (reason) => {
      this.connected = false
      logger.debug('🎨 [Whiteboard] Socket disconnected:', reason)
      this.emit('disconnected', reason)
    })

    this.socket.on('whiteboard:room-joined', (data) => {
      logger.debug('🎨 [Whiteboard] Room joined:', data)
      this.emit('room-joined', data)
    })

    this.socket.on('whiteboard:user-joined', (data) => {
      logger.debug('🎨 [Whiteboard] User joined:', data)
      this.emit('user-joined', data)
    })

    this.socket.on('whiteboard:user-left', (data) => {
      logger.debug('🎨 [Whiteboard] User left:', data)
      this.emit('user-left', data)
    })

    this.socket.on('whiteboard:canvas-update', (data) => {
      logger.debug('🎨 [Whiteboard] Canvas update from:', data.userId)
      this.emit('canvas-update', data)
    })

    this.socket.on('whiteboard:cursor-update', (data) => {
      this.emit('cursor-update', data)
    })

    this.socket.on('whiteboard:clear', (data) => {
      logger.debug('🎨 [Whiteboard] Board cleared by:', data.userId)
      this.emit('clear', data)
    })

    this.socket.on('error', (error) => {
      logger.error('🎨 [Whiteboard] Socket error:', error)
      this.emit('error', error)
    })
  }

  /**
   * Send canvas update to other users
   */
  sendCanvasUpdate(canvasJSON) {
    if (!this.connected || !this.socket) {
      logger.warn('🎨 [Whiteboard] Not connected, cannot send canvas update')
      return
    }

    this.socket.emit('whiteboard:canvas-update', {
      roomName: this.roomName,
      userId: this.userId,
      userName: this.userName,
      canvasJSON
    })
  }

  /**
   * Send cursor position update
   */
  sendCursorUpdate(x, y) {
    if (!this.connected || !this.socket) {
      return
    }

    this.socket.emit('whiteboard:cursor-update', {
      roomName: this.roomName,
      userId: this.userId,
      userName: this.userName,
      x,
      y
    })
  }

  /**
   * Broadcast clear board action
   */
  sendClearBoard() {
    if (!this.connected || !this.socket) {
      logger.warn('🎨 [Whiteboard] Not connected, cannot send clear command')
      return
    }

    this.socket.emit('whiteboard:clear', {
      roomName: this.roomName,
      userId: this.userId,
      userName: this.userName
    })
  }

  /**
   * Request current canvas state from room
   */
  requestCanvasState() {
    if (!this.connected || !this.socket) {
      logger.warn('🎨 [Whiteboard] Not connected, cannot request canvas state')
      return
    }

    this.socket.emit('whiteboard:request-state', {
      roomName: this.roomName,
      userId: this.userId
    })
  }

  /**
   * Disconnect from whiteboard room
   */
  disconnect() {
    if (!this.socket) return

    logger.debug('🎨 [Whiteboard] Disconnecting from room:', this.roomName)

    this.socket.emit('whiteboard:leave', {
      roomName: this.roomName,
      userId: this.userId
    })

    this.socket.disconnect()
    this.socket = null
    this.connected = false

    logger.info('🎨 [Whiteboard] Disconnected from room:', this.roomName)
  }

  /**
   * Event emitter methods
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event).push(handler)
  }

  off(event, handler) {
    if (!this.eventHandlers.has(event)) return

    const handlers = this.eventHandlers.get(event)
    const index = handlers.indexOf(handler)
    if (index > -1) {
      handlers.splice(index, 1)
    }
  }

  emit(event, data) {
    if (!this.eventHandlers.has(event)) return

    const handlers = this.eventHandlers.get(event)
    handlers.forEach(handler => {
      try {
        handler(data)
      } catch (error) {
        logger.error('🎨 [Whiteboard] Error in event handler:', error)
      }
    })
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.connected
  }
}
