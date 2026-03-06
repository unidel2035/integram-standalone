import { logger } from '@/utils/logger'
import EventEmitter from 'events'

/**
 * BreakoutRoomsService - Manages breakout rooms for video conferences
 *
 * Features:
 * - Create multiple breakout rooms
 * - Automatic or manual participant assignment
 * - Timer functionality for breakout sessions
 * - Host navigation between rooms
 * - Broadcast messaging to all rooms
 * - Return all participants to main room
 *
 * Architecture:
 * - Main room: The original conference room
 * - Breakout rooms: Temporary sub-rooms for small group discussions
 * - Host: Can navigate between all rooms and manage breakout sessions
 * - Participants: Assigned to specific breakout rooms
 */
export default class BreakoutRoomsService extends EventEmitter {
  constructor(mainRoomName, webrtcService, isHost = false) {
    super()

    this.mainRoomName = mainRoomName
    this.webrtcService = webrtcService
    this.isHost = isHost

    // Breakout rooms state
    this.breakoutRooms = new Map() // roomId -> { name, participants: Set<peerId> }
    this.currentRoom = mainRoomName // Current room the user is in
    this.isInBreakout = false

    // Participants state
    this.participants = new Map() // peerId -> { name, currentRoom, isHost }
    this.participantAssignments = new Map() // peerId -> breakoutRoomId

    // Timer state
    this.sessionTimer = null
    this.sessionDuration = 0 // milliseconds
    this.sessionStartTime = null
    this.sessionTimeRemaining = 0

    // WebSocket connection (from webrtcService)
    this.socket = null

    logger.debug('🔀 [BreakoutRooms] Service initialized', {
      mainRoomName,
      isHost
    })
  }

  /**
   * Set WebSocket connection for signaling
   */
  setSocket(socket) {
    this.socket = socket
    this.setupSocketListeners()
  }

  /**
   * Setup WebSocket listeners for breakout room signaling
   */
  setupSocketListeners() {
    if (!this.socket) return

    const originalOnMessage = this.socket.onmessage
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleSocketMessage(data)
      } catch (error) {
        logger.error('Failed to parse socket message:', error)
      }

      // Call original handler
      if (originalOnMessage) {
        originalOnMessage.call(this.socket, event)
      }
    }
  }

  /**
   * Handle WebSocket messages for breakout rooms
   */
  handleSocketMessage(data) {
    switch (data.type) {
      case 'breakout:rooms-created':
        this.handleRoomsCreated(data)
        break
      case 'breakout:assigned':
        this.handleAssignment(data)
        break
      case 'breakout:session-started':
        this.handleSessionStarted(data)
        break
      case 'breakout:session-ending':
        this.handleSessionEnding(data)
        break
      case 'breakout:return-to-main':
        this.handleReturnToMain(data)
        break
      case 'breakout:broadcast':
        this.handleBroadcast(data)
        break
      case 'breakout:host-joined':
        this.handleHostJoined(data)
        break
      case 'breakout:host-left':
        this.handleHostLeft(data)
        break
    }
  }

  /**
   * Create breakout rooms (host only)
   * @param {number} numRooms - Number of breakout rooms to create
   * @param {Object} options - Configuration options
   * @returns {Array<Object>} Created rooms
   */
  createRooms(numRooms, options = {}) {
    if (!this.isHost) {
      throw new Error('Only host can create breakout rooms')
    }

    const {
      namePrefix = 'Комната',
      duration = 600000, // 10 minutes default
    } = options

    // Clear existing breakout rooms
    this.breakoutRooms.clear()
    this.participantAssignments.clear()

    // Create rooms
    const rooms = []
    for (let i = 1; i <= numRooms; i++) {
      const roomId = `${this.mainRoomName}-breakout-${i}`
      const room = {
        id: roomId,
        name: `${namePrefix} ${i}`,
        participants: new Set(),
        number: i
      }
      this.breakoutRooms.set(roomId, room)
      rooms.push(room)
    }

    this.sessionDuration = duration

    logger.debug('🔀 [BreakoutRooms] Created rooms:', {
      numRooms,
      duration,
      rooms: rooms.map(r => ({ id: r.id, name: r.name }))
    })

    // Broadcast to all participants
    this.broadcastToMain({
      type: 'breakout:rooms-created',
      rooms: rooms.map(r => ({ id: r.id, name: r.name, number: r.number })),
      duration
    })

    this.emit('rooms-created', rooms)

    return rooms
  }

  /**
   * Assign participants to breakout rooms
   * @param {string} mode - 'auto' or 'manual'
   * @param {Map<string, string>} manualAssignments - peerId -> roomId for manual mode
   */
  assignParticipants(mode = 'auto', manualAssignments = null) {
    if (!this.isHost) {
      throw new Error('Only host can assign participants')
    }

    const participants = Array.from(this.participants.keys())
    const rooms = Array.from(this.breakoutRooms.keys())

    if (rooms.length === 0) {
      throw new Error('No breakout rooms created')
    }

    this.participantAssignments.clear()

    if (mode === 'auto') {
      // Distribute participants evenly across rooms
      participants.forEach((peerId, index) => {
        const roomIndex = index % rooms.length
        const roomId = rooms[roomIndex]
        this.participantAssignments.set(peerId, roomId)
        this.breakoutRooms.get(roomId).participants.add(peerId)
      })
    } else if (mode === 'manual' && manualAssignments) {
      // Use manual assignments
      manualAssignments.forEach((roomId, peerId) => {
        if (this.breakoutRooms.has(roomId)) {
          this.participantAssignments.set(peerId, roomId)
          this.breakoutRooms.get(roomId).participants.add(peerId)
        }
      })
    }

    logger.debug('🔀 [BreakoutRooms] Assigned participants:', {
      mode,
      assignments: Array.from(this.participantAssignments.entries())
    })

    // Send individual assignments to each participant
    this.participantAssignments.forEach((roomId, peerId) => {
      const room = this.breakoutRooms.get(roomId)
      this.sendToParticipant(peerId, {
        type: 'breakout:assigned',
        roomId: room.id,
        roomName: room.name,
        roomNumber: room.number
      })
    })

    this.emit('participants-assigned', this.participantAssignments)

    return this.participantAssignments
  }

  /**
   * Start breakout session (host only)
   */
  startSession() {
    if (!this.isHost) {
      throw new Error('Only host can start session')
    }

    if (this.breakoutRooms.size === 0) {
      throw new Error('No breakout rooms created')
    }

    if (this.participantAssignments.size === 0) {
      throw new Error('No participants assigned')
    }

    this.sessionStartTime = Date.now()
    this.sessionTimeRemaining = this.sessionDuration

    // Start countdown timer
    this.startTimer()

    logger.debug('🔀 [BreakoutRooms] Session started:', {
      duration: this.sessionDuration,
      startTime: this.sessionStartTime
    })

    // Broadcast session start to all participants
    this.broadcastToMain({
      type: 'breakout:session-started',
      duration: this.sessionDuration,
      startTime: this.sessionStartTime
    })

    this.emit('session-started', {
      duration: this.sessionDuration,
      startTime: this.sessionStartTime
    })
  }

  /**
   * Start countdown timer
   */
  startTimer() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer)
    }

    this.sessionTimer = setInterval(() => {
      const elapsed = Date.now() - this.sessionStartTime
      this.sessionTimeRemaining = Math.max(0, this.sessionDuration - elapsed)

      this.emit('timer-update', {
        remaining: this.sessionTimeRemaining,
        elapsed,
        total: this.sessionDuration
      })

      // Warn participants when 1 minute remaining
      if (this.sessionTimeRemaining <= 60000 && this.sessionTimeRemaining > 59000) {
        this.broadcastToAllRooms({
          type: 'breakout:session-ending',
          timeRemaining: this.sessionTimeRemaining
        })
        this.emit('session-ending-soon', { timeRemaining: this.sessionTimeRemaining })
      }

      // End session when time is up
      if (this.sessionTimeRemaining <= 0) {
        this.endSession()
      }
    }, 1000)
  }

  /**
   * Stop timer
   */
  stopTimer() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer)
      this.sessionTimer = null
    }
  }

  /**
   * End breakout session and return all to main room (host only)
   */
  endSession() {
    if (!this.isHost) {
      throw new Error('Only host can end session')
    }

    this.stopTimer()

    logger.debug('🔀 [BreakoutRooms] Session ended')

    // Broadcast return to main room to all participants
    this.broadcastToAllRooms({
      type: 'breakout:return-to-main',
      mainRoomName: this.mainRoomName
    })

    // Clear breakout room participants
    this.breakoutRooms.forEach(room => room.participants.clear())

    // Reset state
    this.sessionStartTime = null
    this.sessionTimeRemaining = 0

    // Host returns to main room
    if (this.isInBreakout) {
      this.returnToMainRoom()
    }

    this.emit('session-ended')
  }

  /**
   * Join a breakout room
   * @param {string} roomId - Room ID to join
   */
  async joinBreakoutRoom(roomId) {
    const room = this.breakoutRooms.get(roomId)
    if (!room) {
      throw new Error('Breakout room not found')
    }

    // Leave current room
    if (this.currentRoom === this.mainRoomName) {
      // Leave main room
      await this.webrtcService.disconnect()
    } else {
      // Leave current breakout room
      await this.webrtcService.disconnect()
    }

    // Join new breakout room
    this.currentRoom = roomId
    this.isInBreakout = true

    // Reconnect to new room
    const oldRoomName = this.webrtcService.roomName
    this.webrtcService.roomName = roomId
    await this.webrtcService.connect()

    logger.debug('🔀 [BreakoutRooms] Joined breakout room:', {
      roomId,
      roomName: room.name,
      previousRoom: oldRoomName
    })

    // Notify other participants in breakout room
    if (this.isHost) {
      this.sendToRoom(roomId, {
        type: 'breakout:host-joined',
        roomId
      })
    }

    this.emit('joined-breakout', { roomId, roomName: room.name })
  }

  /**
   * Return to main room
   */
  async returnToMainRoom() {
    if (this.currentRoom === this.mainRoomName) {
      logger.debug('🔀 [BreakoutRooms] Already in main room')
      return
    }

    const previousRoom = this.currentRoom

    // Leave current breakout room
    await this.webrtcService.disconnect()

    // Rejoin main room
    this.currentRoom = this.mainRoomName
    this.isInBreakout = false

    this.webrtcService.roomName = this.mainRoomName
    await this.webrtcService.connect()

    logger.debug('🔀 [BreakoutRooms] Returned to main room:', {
      previousRoom,
      mainRoom: this.mainRoomName
    })

    // Notify previous breakout room that host left
    if (this.isHost) {
      this.sendToRoom(previousRoom, {
        type: 'breakout:host-left',
        roomId: previousRoom
      })
    }

    this.emit('returned-to-main', { previousRoom })
  }

  /**
   * Broadcast message to all breakout rooms (host only)
   * @param {string} message - Message to broadcast
   */
  broadcastToAllRooms(data) {
    if (!this.isHost) {
      throw new Error('Only host can broadcast to all rooms')
    }

    // Send to main room
    this.broadcastToMain(data)

    // Send to all breakout rooms
    this.breakoutRooms.forEach((room, roomId) => {
      this.sendToRoom(roomId, data)
    })

    logger.debug('🔀 [BreakoutRooms] Broadcast to all rooms:', {
      type: data.type,
      numRooms: this.breakoutRooms.size + 1
    })
  }

  /**
   * Send message to specific room via WebSocket
   */
  sendToRoom(roomId, data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      logger.warn('🔀 [BreakoutRooms] WebSocket not connected')
      return
    }

    this.socket.send(JSON.stringify({
      type: 'breakout:message-to-room',
      roomId,
      data
    }))
  }

  /**
   * Send message to main room
   */
  broadcastToMain(data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      logger.warn('🔀 [BreakoutRooms] WebSocket not connected')
      return
    }

    this.socket.send(JSON.stringify({
      type: 'breakout:message-to-main',
      roomName: this.mainRoomName,
      data
    }))
  }

  /**
   * Send message to specific participant
   */
  sendToParticipant(peerId, data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      logger.warn('🔀 [BreakoutRooms] WebSocket not connected')
      return
    }

    this.socket.send(JSON.stringify({
      type: 'breakout:message-to-participant',
      peerId,
      data
    }))
  }

  /**
   * Handle rooms created notification (for participants)
   */
  handleRoomsCreated(data) {
    const { rooms, duration } = data

    rooms.forEach(room => {
      this.breakoutRooms.set(room.id, {
        ...room,
        participants: new Set()
      })
    })

    this.sessionDuration = duration

    logger.debug('🔀 [BreakoutRooms] Rooms created notification received:', {
      numRooms: rooms.length,
      duration
    })

    this.emit('rooms-created', rooms)
  }

  /**
   * Handle assignment notification (for participants)
   */
  handleAssignment(data) {
    const { roomId, roomName, roomNumber } = data

    logger.debug('🔀 [BreakoutRooms] Assigned to room:', {
      roomId,
      roomName,
      roomNumber
    })

    this.emit('assigned', { roomId, roomName, roomNumber })
  }

  /**
   * Handle session started notification
   */
  handleSessionStarted(data) {
    const { duration, startTime } = data

    this.sessionDuration = duration
    this.sessionStartTime = startTime
    this.sessionTimeRemaining = duration

    logger.debug('🔀 [BreakoutRooms] Session started notification received')

    this.emit('session-started', { duration, startTime })
  }

  /**
   * Handle session ending warning
   */
  handleSessionEnding(data) {
    const { timeRemaining } = data

    logger.debug('🔀 [BreakoutRooms] Session ending soon:', { timeRemaining })

    this.emit('session-ending-soon', { timeRemaining })
  }

  /**
   * Handle return to main room notification
   */
  handleReturnToMain(data) {
    const { mainRoomName } = data

    logger.debug('🔀 [BreakoutRooms] Return to main room notification received')

    // Auto-return to main room
    this.returnToMainRoom().catch(error => {
      logger.error('Failed to return to main room:', error)
      this.emit('error', error)
    })
  }

  /**
   * Handle broadcast message from host
   */
  handleBroadcast(data) {
    logger.debug('🔀 [BreakoutRooms] Broadcast message received:', data)

    this.emit('broadcast', data)
  }

  /**
   * Handle host joined room notification
   */
  handleHostJoined(data) {
    const { roomId } = data

    logger.debug('🔀 [BreakoutRooms] Host joined room:', roomId)

    this.emit('host-joined', { roomId })
  }

  /**
   * Handle host left room notification
   */
  handleHostLeft(data) {
    const { roomId } = data

    logger.debug('🔀 [BreakoutRooms] Host left room:', roomId)

    this.emit('host-left', { roomId })
  }

  /**
   * Add participant to tracking
   */
  addParticipant(peerId, name, isHost = false) {
    this.participants.set(peerId, {
      name,
      currentRoom: this.mainRoomName,
      isHost
    })
  }

  /**
   * Remove participant from tracking
   */
  removeParticipant(peerId) {
    this.participants.delete(peerId)
    this.participantAssignments.delete(peerId)

    // Remove from all breakout rooms
    this.breakoutRooms.forEach(room => {
      room.participants.delete(peerId)
    })
  }

  /**
   * Get current room info
   */
  getCurrentRoom() {
    if (this.currentRoom === this.mainRoomName) {
      return {
        id: this.mainRoomName,
        name: 'Основная комната',
        isMain: true,
        isBreakout: false
      }
    }

    const room = this.breakoutRooms.get(this.currentRoom)
    return room ? {
      id: room.id,
      name: room.name,
      number: room.number,
      isMain: false,
      isBreakout: true
    } : null
  }

  /**
   * Get all breakout rooms
   */
  getBreakoutRooms() {
    return Array.from(this.breakoutRooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      number: room.number,
      participantCount: room.participants.size
    }))
  }

  /**
   * Get assignment for specific participant
   */
  getAssignment(peerId) {
    return this.participantAssignments.get(peerId)
  }

  /**
   * Get timer info
   */
  getTimerInfo() {
    if (!this.sessionStartTime) {
      return null
    }

    const elapsed = Date.now() - this.sessionStartTime
    const remaining = Math.max(0, this.sessionDuration - elapsed)

    return {
      total: this.sessionDuration,
      elapsed,
      remaining,
      isActive: remaining > 0
    }
  }

  /**
   * Cleanup service
   */
  cleanup() {
    this.stopTimer()
    this.breakoutRooms.clear()
    this.participants.clear()
    this.participantAssignments.clear()
    this.removeAllListeners()

    logger.debug('🔀 [BreakoutRooms] Service cleaned up')
  }
}
