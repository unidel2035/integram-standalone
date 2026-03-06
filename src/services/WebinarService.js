import { logger } from '@/utils/logger'

/**
 * Webinar Service - Manages webinar sessions, roles, and permissions
 * Issue #2360 - Webinar mode и live streaming
 */

export const WEBINAR_ROLE = {
  HOST: 'host',           // Can manage everything
  PRESENTER: 'presenter', // Can speak, share screen, manage attendees
  MODERATOR: 'moderator', // Can manage chat, Q&A, and attendees
  ATTENDEE: 'attendee'    // Can only view and chat
}

export const WEBINAR_PERMISSION = {
  CAN_SPEAK: 'can_speak',
  CAN_SHARE_SCREEN: 'can_share_screen',
  CAN_ENABLE_CAMERA: 'can_enable_camera',
  CAN_MANAGE_CHAT: 'can_manage_chat',
  CAN_MANAGE_ATTENDEES: 'can_manage_attendees',
  CAN_START_RECORDING: 'can_start_recording',
  CAN_START_STREAMING: 'can_start_streaming',
  CAN_MANAGE_POLLS: 'can_manage_polls',
  CAN_MANAGE_QNA: 'can_manage_qna'
}

export const WEBINAR_STATUS = {
  SCHEDULED: 'scheduled',
  WAITING: 'waiting',      // Waiting for host to start
  LIVE: 'live',            // Webinar is live
  PAUSED: 'paused',        // Temporarily paused
  ENDED: 'ended'           // Webinar has ended
}

export default class WebinarService {
  constructor(webinarId, userId, userRole = WEBINAR_ROLE.ATTENDEE) {
    this.webinarId = webinarId
    this.userId = userId
    this.userRole = userRole
    this.status = WEBINAR_STATUS.WAITING

    // Webinar metadata
    this.webinarInfo = {
      id: webinarId,
      title: '',
      description: '',
      scheduledStartTime: null,
      actualStartTime: null,
      endTime: null,
      maxAttendees: 10000,
      registrationRequired: false,
      recordingEnabled: false,
      streamingEnabled: false
    }

    // Participants tracking
    this.participants = new Map() // userId -> participant object
    this.presenters = new Set()
    this.moderators = new Set()

    // Permissions tracking
    this.permissions = new Map() // userId -> Set of permissions

    // Analytics
    this.analytics = {
      totalAttendees: 0,
      peakAttendees: 0,
      averageViewDuration: 0,
      chatMessages: 0,
      questions: 0,
      polls: 0,
      reactions: {},
      joinTimes: [],
      leaveTimes: []
    }

    // Event handlers
    this.eventHandlers = new Map()

    logger.debug(`🎤 [Webinar] Service initialized for webinar ${webinarId} as ${userRole}`)
  }

  /**
   * Initialize webinar with metadata
   */
  async initialize(webinarInfo) {
    this.webinarInfo = { ...this.webinarInfo, ...webinarInfo }
    logger.debug('🎤 [Webinar] Initialized with info:', this.webinarInfo)
    this.emit('webinar:initialized', this.webinarInfo)
  }

  /**
   * Start the webinar (host only)
   */
  async startWebinar() {
    if (this.userRole !== WEBINAR_ROLE.HOST) {
      throw new Error('Only host can start the webinar')
    }

    this.status = WEBINAR_STATUS.LIVE
    this.webinarInfo.actualStartTime = new Date().toISOString()

    logger.debug('🎤 [Webinar] Started:', this.webinarId)
    this.emit('webinar:started', {
      webinarId: this.webinarId,
      startTime: this.webinarInfo.actualStartTime
    })
  }

  /**
   * End the webinar (host only)
   */
  async endWebinar() {
    if (this.userRole !== WEBINAR_ROLE.HOST) {
      throw new Error('Only host can end the webinar')
    }

    this.status = WEBINAR_STATUS.ENDED
    this.webinarInfo.endTime = new Date().toISOString()

    // Calculate final analytics
    this.calculateFinalAnalytics()

    logger.debug('🎤 [Webinar] Ended:', this.webinarId)
    this.emit('webinar:ended', {
      webinarId: this.webinarId,
      endTime: this.webinarInfo.endTime,
      analytics: this.analytics
    })
  }

  /**
   * Add participant to webinar
   */
  addParticipant(userId, userInfo) {
    const participant = {
      userId,
      name: userInfo.name || 'Attendee',
      email: userInfo.email || null,
      role: userInfo.role || WEBINAR_ROLE.ATTENDEE,
      joinedAt: new Date().toISOString(),
      leftAt: null,
      isOnline: true,
      micEnabled: false,
      cameraEnabled: false,
      handRaised: false
    }

    this.participants.set(userId, participant)
    this.analytics.totalAttendees++
    this.analytics.joinTimes.push(new Date())

    // Update peak attendees
    const currentCount = this.getOnlineAttendeesCount()
    if (currentCount > this.analytics.peakAttendees) {
      this.analytics.peakAttendees = currentCount
    }

    // Set initial permissions based on role
    this.setRolePermissions(userId, participant.role)

    logger.debug('🎤 [Webinar] Participant joined:', userId, participant.role)
    this.emit('participant:joined', participant)

    return participant
  }

  /**
   * Remove participant from webinar
   */
  removeParticipant(userId) {
    const participant = this.participants.get(userId)
    if (!participant) return

    participant.isOnline = false
    participant.leftAt = new Date().toISOString()
    this.analytics.leaveTimes.push(new Date())

    logger.debug('🎤 [Webinar] Participant left:', userId)
    this.emit('participant:left', participant)
  }

  /**
   * Change participant role
   */
  changeParticipantRole(userId, newRole) {
    if (!this.canManageAttendees()) {
      throw new Error('No permission to change participant roles')
    }

    const participant = this.participants.get(userId)
    if (!participant) {
      throw new Error('Participant not found')
    }

    const oldRole = participant.role
    participant.role = newRole

    // Update role-based sets
    if (newRole === WEBINAR_ROLE.PRESENTER) {
      this.presenters.add(userId)
      this.moderators.delete(userId)
    } else if (newRole === WEBINAR_ROLE.MODERATOR) {
      this.moderators.add(userId)
      this.presenters.delete(userId)
    } else {
      this.presenters.delete(userId)
      this.moderators.delete(userId)
    }

    // Update permissions
    this.setRolePermissions(userId, newRole)

    logger.debug(`🎤 [Webinar] Role changed: ${userId} ${oldRole} -> ${newRole}`)
    this.emit('participant:role-changed', { userId, oldRole, newRole, permissions: this.permissions.get(userId) })
  }

  /**
   * Set permissions based on role
   */
  setRolePermissions(userId, role) {
    const perms = new Set()

    switch (role) {
      case WEBINAR_ROLE.HOST:
        // Host has all permissions
        Object.values(WEBINAR_PERMISSION).forEach(p => perms.add(p))
        break

      case WEBINAR_ROLE.PRESENTER:
        perms.add(WEBINAR_PERMISSION.CAN_SPEAK)
        perms.add(WEBINAR_PERMISSION.CAN_SHARE_SCREEN)
        perms.add(WEBINAR_PERMISSION.CAN_ENABLE_CAMERA)
        perms.add(WEBINAR_PERMISSION.CAN_MANAGE_POLLS)
        perms.add(WEBINAR_PERMISSION.CAN_MANAGE_QNA)
        break

      case WEBINAR_ROLE.MODERATOR:
        perms.add(WEBINAR_PERMISSION.CAN_SPEAK)
        perms.add(WEBINAR_PERMISSION.CAN_MANAGE_CHAT)
        perms.add(WEBINAR_PERMISSION.CAN_MANAGE_ATTENDEES)
        perms.add(WEBINAR_PERMISSION.CAN_MANAGE_QNA)
        break

      case WEBINAR_ROLE.ATTENDEE:
        // Attendees have no special permissions by default
        break
    }

    this.permissions.set(userId, perms)
    return perms
  }

  /**
   * Grant specific permission to user
   */
  grantPermission(userId, permission) {
    if (!this.canManageAttendees()) {
      throw new Error('No permission to grant permissions')
    }

    const perms = this.permissions.get(userId) || new Set()
    perms.add(permission)
    this.permissions.set(userId, perms)

    logger.debug(`🎤 [Webinar] Permission granted: ${userId} -> ${permission}`)
    this.emit('permission:granted', { userId, permission })
  }

  /**
   * Revoke specific permission from user
   */
  revokePermission(userId, permission) {
    if (!this.canManageAttendees()) {
      throw new Error('No permission to revoke permissions')
    }

    const perms = this.permissions.get(userId)
    if (perms) {
      perms.delete(permission)
      logger.debug(`🎤 [Webinar] Permission revoked: ${userId} -> ${permission}`)
      this.emit('permission:revoked', { userId, permission })
    }
  }

  /**
   * Check if current user has permission
   */
  hasPermission(permission) {
    const perms = this.permissions.get(this.userId)
    return perms ? perms.has(permission) : false
  }

  /**
   * Check if current user can speak
   */
  canSpeak() {
    return this.hasPermission(WEBINAR_PERMISSION.CAN_SPEAK)
  }

  /**
   * Check if current user can share screen
   */
  canShareScreen() {
    return this.hasPermission(WEBINAR_PERMISSION.CAN_SHARE_SCREEN)
  }

  /**
   * Check if current user can enable camera
   */
  canEnableCamera() {
    return this.hasPermission(WEBINAR_PERMISSION.CAN_ENABLE_CAMERA)
  }

  /**
   * Check if current user can manage chat
   */
  canManageChat() {
    return this.hasPermission(WEBINAR_PERMISSION.CAN_MANAGE_CHAT)
  }

  /**
   * Check if current user can manage attendees
   */
  canManageAttendees() {
    return this.hasPermission(WEBINAR_PERMISSION.CAN_MANAGE_ATTENDEES)
  }

  /**
   * Check if current user can start recording
   */
  canStartRecording() {
    return this.hasPermission(WEBINAR_PERMISSION.CAN_START_RECORDING)
  }

  /**
   * Check if current user can start streaming
   */
  canStartStreaming() {
    return this.hasPermission(WEBINAR_PERMISSION.CAN_START_STREAMING)
  }

  /**
   * Raise/lower hand
   */
  toggleHand(userId, raised) {
    const participant = this.participants.get(userId)
    if (participant) {
      participant.handRaised = raised
      this.emit('participant:hand-changed', { userId, raised })
    }
  }

  /**
   * Toggle participant microphone (by presenter/moderator)
   */
  toggleParticipantMic(userId, enabled) {
    if (!this.canManageAttendees()) {
      throw new Error('No permission to control participant audio')
    }

    const participant = this.participants.get(userId)
    if (participant) {
      participant.micEnabled = enabled
      this.emit('participant:mic-changed', { userId, enabled })
    }
  }

  /**
   * Toggle participant camera (by presenter/moderator)
   */
  toggleParticipantCamera(userId, enabled) {
    if (!this.canManageAttendees()) {
      throw new Error('No permission to control participant video')
    }

    const participant = this.participants.get(userId)
    if (participant) {
      participant.cameraEnabled = enabled
      this.emit('participant:camera-changed', { userId, enabled })
    }
  }

  /**
   * Get all participants
   */
  getParticipants() {
    return Array.from(this.participants.values())
  }

  /**
   * Get online attendees count
   */
  getOnlineAttendeesCount() {
    return Array.from(this.participants.values()).filter(p => p.isOnline).length
  }

  /**
   * Get presenters
   */
  getPresenters() {
    return Array.from(this.participants.values()).filter(p =>
      p.role === WEBINAR_ROLE.PRESENTER || p.role === WEBINAR_ROLE.HOST
    )
  }

  /**
   * Get attendees (viewers only)
   */
  getAttendees() {
    return Array.from(this.participants.values()).filter(p =>
      p.role === WEBINAR_ROLE.ATTENDEE
    )
  }

  /**
   * Record analytics event
   */
  recordAnalyticsEvent(eventType, data) {
    switch (eventType) {
      case 'chat_message':
        this.analytics.chatMessages++
        break
      case 'question':
        this.analytics.questions++
        break
      case 'poll':
        this.analytics.polls++
        break
      case 'reaction':
        const emoji = data.emoji
        this.analytics.reactions[emoji] = (this.analytics.reactions[emoji] || 0) + 1
        break
    }
  }

  /**
   * Calculate final analytics
   */
  calculateFinalAnalytics() {
    // Calculate average view duration
    const durations = []
    this.participants.forEach(p => {
      if (p.joinedAt && p.leftAt) {
        const join = new Date(p.joinedAt)
        const leave = new Date(p.leftAt)
        const duration = (leave - join) / 1000 / 60 // minutes
        durations.push(duration)
      }
    })

    if (durations.length > 0) {
      this.analytics.averageViewDuration = durations.reduce((a, b) => a + b, 0) / durations.length
    }
  }

  /**
   * Get analytics summary
   */
  getAnalytics() {
    return {
      ...this.analytics,
      currentAttendees: this.getOnlineAttendeesCount(),
      totalPresenters: this.getPresenters().length,
      duration: this.webinarInfo.actualStartTime ?
        (new Date() - new Date(this.webinarInfo.actualStartTime)) / 1000 / 60 : 0
    }
  }

  /**
   * Register event handler
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event).push(handler)
  }

  /**
   * Emit event to handlers
   */
  emit(event, ...args) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args)
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error)
        }
      })
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.eventHandlers.clear()
    this.participants.clear()
    this.presenters.clear()
    this.moderators.clear()
    this.permissions.clear()
    logger.debug('🎤 [Webinar] Cleaned up')
  }
}
