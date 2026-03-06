import { logger } from '@/utils/logger'

/**
 * Conference Security Service
 * Handles advanced security features for video conferencing:
 * - End-to-End Encryption (E2EE)
 * - Password protection for rooms
 * - Room locking
 * - Host controls (remove/mute participants)
 * - Audit logging
 * - Domain whitelisting/blacklisting
 * - Screen sharing control
 * - Watermarking
 *
 * Based on requirements from issue #2362
 */

// Security Event Types for Audit Logging
export const SECURITY_EVENT = {
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  ROOM_LEFT: 'room_left',
  ROOM_LOCKED: 'room_locked',
  ROOM_UNLOCKED: 'room_unlocked',
  PASSWORD_SET: 'password_set',
  PASSWORD_VERIFIED: 'password_verified',
  PASSWORD_FAILED: 'password_failed',
  PARTICIPANT_REMOVED: 'participant_removed',
  PARTICIPANT_MUTED: 'participant_muted',
  HOST_PROMOTED: 'host_promoted',
  SCREEN_SHARE_STARTED: 'screen_share_started',
  SCREEN_SHARE_STOPPED: 'screen_share_stopped',
  SCREEN_SHARE_BLOCKED: 'screen_share_blocked',
  RECORDING_STARTED: 'recording_started',
  RECORDING_STOPPED: 'recording_stopped',
  ENCRYPTION_ENABLED: 'encryption_enabled',
  ENCRYPTION_DISABLED: 'encryption_disabled',
  ACCESS_DENIED: 'access_denied',
  DOMAIN_BLOCKED: 'domain_blocked',
}

// Security Policy
export const SECURITY_POLICY = {
  REQUIRE_PASSWORD: 'require_password',
  LOCK_ON_START: 'lock_on_start',
  HOST_ONLY_SCREEN_SHARE: 'host_only_screen_share',
  HOST_ONLY_RECORDING: 'host_only_recording',
  REQUIRE_E2EE: 'require_e2ee',
  WATERMARK_ENABLED: 'watermark_enabled',
}

export default class ConferenceSecurityService {
  constructor(roomName, userId, isHost = false) {
    this.roomName = roomName
    this.userId = userId
    this.isHost = isHost

    // Room security state
    this.roomPassword = null
    this.roomPasswordHash = null
    this.isRoomLocked = false
    this.allowedParticipants = new Set()
    this.hostIds = new Set([userId])

    // Security policies
    this.policies = new Set()
    this.domainWhitelist = []
    this.domainBlacklist = []

    // E2EE state
    this.e2eeEnabled = false
    this.encryptionKey = null
    this.encryptionKeyId = null

    // Audit log
    this.auditLog = []
    this.maxAuditLogSize = 1000

    // Watermark settings
    this.watermarkEnabled = false
    this.watermarkText = ''

    // Screen sharing control
    this.screenSharingAllowed = true
    this.screenSharingHostOnly = false

    // Initialize
    this.logSecurityEvent(SECURITY_EVENT.ROOM_CREATED, {
      roomName,
      userId,
      isHost,
    })
  }

  /**
   * ===================================
   * PASSWORD PROTECTION
   * ===================================
   */

  /**
   * Set password for the room
   * @param {string} password - Plain text password
   */
  async setRoomPassword(password) {
    if (!this.isHost) {
      throw new Error('Only hosts can set room password')
    }

    if (!password || password.length < 4) {
      throw new Error('Password must be at least 4 characters')
    }

    // Hash the password using SubtleCrypto
    this.roomPasswordHash = await this.hashPassword(password)
    this.roomPassword = password // Store for session (cleared on disconnect)

    this.logSecurityEvent(SECURITY_EVENT.PASSWORD_SET, {
      passwordLength: password.length,
    })

    logger.info('🔒 Room password set')
    return true
  }

  /**
   * Verify room password
   * @param {string} password - Password to verify
   */
  async verifyRoomPassword(password) {
    if (!this.roomPasswordHash) {
      return true // No password required
    }

    const passwordHash = await this.hashPassword(password)
    const isValid = passwordHash === this.roomPasswordHash

    if (isValid) {
      this.logSecurityEvent(SECURITY_EVENT.PASSWORD_VERIFIED, {
        userId: this.userId,
      })
      logger.info('✅ Password verified successfully')
    } else {
      this.logSecurityEvent(SECURITY_EVENT.PASSWORD_FAILED, {
        userId: this.userId,
      })
      logger.warn('❌ Password verification failed')
    }

    return isValid
  }

  /**
   * Hash password using SHA-256
   */
  async hashPassword(password) {
    const encoder = new TextEncoder()
    const data = encoder.encode(password + this.roomName) // Add room name as salt
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Clear room password
   */
  clearRoomPassword() {
    if (!this.isHost) {
      throw new Error('Only hosts can clear room password')
    }

    this.roomPassword = null
    this.roomPasswordHash = null
    logger.info('🔓 Room password cleared')
  }

  /**
   * ===================================
   * ROOM LOCKING
   * ===================================
   */

  /**
   * Lock the room (prevent new participants from joining)
   */
  lockRoom() {
    if (!this.isHost) {
      throw new Error('Only hosts can lock the room')
    }

    this.isRoomLocked = true
    this.logSecurityEvent(SECURITY_EVENT.ROOM_LOCKED, {
      userId: this.userId,
    })
    logger.info('🔒 Room locked')
  }

  /**
   * Unlock the room (allow new participants)
   */
  unlockRoom() {
    if (!this.isHost) {
      throw new Error('Only hosts can unlock the room')
    }

    this.isRoomLocked = false
    this.logSecurityEvent(SECURITY_EVENT.ROOM_UNLOCKED, {
      userId: this.userId,
    })
    logger.info('🔓 Room unlocked')
  }

  /**
   * Check if a participant can join the room
   */
  canParticipantJoin(participantId, participantEmail = null) {
    // Check if room is locked
    if (this.isRoomLocked) {
      // Allow if participant is already in allowed list
      if (!this.allowedParticipants.has(participantId)) {
        this.logSecurityEvent(SECURITY_EVENT.ACCESS_DENIED, {
          participantId,
          reason: 'room_locked',
        })
        return { allowed: false, reason: 'Room is locked' }
      }
    }

    // Check domain restrictions
    if (participantEmail) {
      const domain = participantEmail.split('@')[1]?.toLowerCase()

      // Check blacklist first
      if (this.domainBlacklist.length > 0 && this.domainBlacklist.includes(domain)) {
        this.logSecurityEvent(SECURITY_EVENT.DOMAIN_BLOCKED, {
          participantId,
          domain,
        })
        return { allowed: false, reason: `Domain ${domain} is blocked` }
      }

      // Check whitelist (if configured)
      if (this.domainWhitelist.length > 0 && !this.domainWhitelist.includes(domain)) {
        this.logSecurityEvent(SECURITY_EVENT.ACCESS_DENIED, {
          participantId,
          domain,
          reason: 'domain_not_whitelisted',
        })
        return { allowed: false, reason: `Domain ${domain} is not allowed` }
      }
    }

    return { allowed: true }
  }

  /**
   * Add participant to allowed list (for locked rooms)
   */
  addAllowedParticipant(participantId) {
    this.allowedParticipants.add(participantId)
  }

  /**
   * ===================================
   * HOST CONTROLS
   * ===================================
   */

  /**
   * Remove a participant from the conference
   */
  removeParticipant(participantId, reason = 'Removed by host') {
    if (!this.isHost) {
      throw new Error('Only hosts can remove participants')
    }

    this.logSecurityEvent(SECURITY_EVENT.PARTICIPANT_REMOVED, {
      participantId,
      removedBy: this.userId,
      reason,
    })

    logger.info(`🚫 Participant ${participantId} removed: ${reason}`)
    return true
  }

  /**
   * Mute a participant
   */
  muteParticipant(participantId, reason = 'Muted by host') {
    if (!this.isHost) {
      throw new Error('Only hosts can mute participants')
    }

    this.logSecurityEvent(SECURITY_EVENT.PARTICIPANT_MUTED, {
      participantId,
      mutedBy: this.userId,
      reason,
    })

    logger.info(`🔇 Participant ${participantId} muted: ${reason}`)
    return true
  }

  /**
   * Promote a participant to host
   */
  promoteToHost(participantId) {
    if (!this.isHost) {
      throw new Error('Only hosts can promote participants')
    }

    this.hostIds.add(participantId)

    this.logSecurityEvent(SECURITY_EVENT.HOST_PROMOTED, {
      participantId,
      promotedBy: this.userId,
    })

    logger.info(`👑 Participant ${participantId} promoted to host`)
    return true
  }

  /**
   * Check if a user is a host
   */
  isUserHost(userId) {
    return this.hostIds.has(userId)
  }

  /**
   * ===================================
   * END-TO-END ENCRYPTION (E2EE)
   * ===================================
   */

  /**
   * Enable E2EE for the conference
   * Generates a symmetric encryption key that will be shared among participants
   */
  async enableE2EE() {
    if (this.e2eeEnabled) {
      logger.warn('E2EE already enabled')
      return this.encryptionKey
    }

    try {
      // Generate a symmetric AES-GCM key
      this.encryptionKey = await crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256,
        },
        true, // extractable
        ['encrypt', 'decrypt']
      )

      // Generate a key ID for reference
      this.encryptionKeyId = this.generateKeyId()
      this.e2eeEnabled = true

      this.logSecurityEvent(SECURITY_EVENT.ENCRYPTION_ENABLED, {
        keyId: this.encryptionKeyId,
      })

      logger.info('🔐 E2EE enabled with key ID:', this.encryptionKeyId)
      return this.encryptionKey
    } catch (error) {
      console.error('Failed to enable E2EE:', error)
      throw error
    }
  }

  /**
   * Disable E2EE
   */
  disableE2EE() {
    if (!this.isHost) {
      throw new Error('Only hosts can disable E2EE')
    }

    this.e2eeEnabled = false
    this.encryptionKey = null
    this.encryptionKeyId = null

    this.logSecurityEvent(SECURITY_EVENT.ENCRYPTION_DISABLED, {
      userId: this.userId,
    })

    logger.info('🔓 E2EE disabled')
  }

  /**
   * Export encryption key for sharing with new participants
   * Returns key as base64 string
   */
  async exportEncryptionKey() {
    if (!this.encryptionKey) {
      throw new Error('No encryption key available')
    }

    const keyBuffer = await crypto.subtle.exportKey('raw', this.encryptionKey)
    const keyArray = new Uint8Array(keyBuffer)
    return {
      key: this.arrayBufferToBase64(keyArray),
      keyId: this.encryptionKeyId,
    }
  }

  /**
   * Import encryption key (for participants joining encrypted room)
   */
  async importEncryptionKey(keyBase64, keyId) {
    try {
      const keyArray = this.base64ToArrayBuffer(keyBase64)

      this.encryptionKey = await crypto.subtle.importKey(
        'raw',
        keyArray,
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      )

      this.encryptionKeyId = keyId
      this.e2eeEnabled = true

      logger.info('🔐 Encryption key imported successfully')
      return true
    } catch (error) {
      console.error('Failed to import encryption key:', error)
      throw error
    }
  }

  /**
   * Encrypt data using E2EE key
   * @param {ArrayBuffer} data - Data to encrypt
   * @returns {Object} - { encrypted: ArrayBuffer, iv: Uint8Array }
   */
  async encryptData(data) {
    if (!this.encryptionKey) {
      throw new Error('E2EE not enabled')
    }

    // Generate initialization vector
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Encrypt data
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      this.encryptionKey,
      data
    )

    return { encrypted, iv }
  }

  /**
   * Decrypt data using E2EE key
   * @param {ArrayBuffer} encrypted - Encrypted data
   * @param {Uint8Array} iv - Initialization vector
   * @returns {ArrayBuffer} - Decrypted data
   */
  async decryptData(encrypted, iv) {
    if (!this.encryptionKey) {
      throw new Error('E2EE not enabled')
    }

    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        this.encryptionKey,
        encrypted
      )

      return decrypted
    } catch (error) {
      console.error('Failed to decrypt data:', error)
      throw error
    }
  }

  /**
   * ===================================
   * SCREEN SHARING CONTROL
   * ===================================
   */

  /**
   * Set screen sharing policy
   */
  setScreenSharingPolicy(hostOnly = false) {
    if (!this.isHost) {
      throw new Error('Only hosts can set screen sharing policy')
    }

    this.screenSharingHostOnly = hostOnly
    this.screenSharingAllowed = true

    logger.info(`📺 Screen sharing policy: ${hostOnly ? 'Host only' : 'All participants'}`)
  }

  /**
   * Check if a participant can share screen
   */
  canShareScreen(participantId) {
    if (!this.screenSharingAllowed) {
      return { allowed: false, reason: 'Screen sharing is disabled' }
    }

    if (this.screenSharingHostOnly && !this.hostIds.has(participantId)) {
      this.logSecurityEvent(SECURITY_EVENT.SCREEN_SHARE_BLOCKED, {
        participantId,
        reason: 'not_host',
      })
      return { allowed: false, reason: 'Only hosts can share screen' }
    }

    return { allowed: true }
  }

  /**
   * ===================================
   * WATERMARKING
   * ===================================
   */

  /**
   * Enable watermarking for recordings
   */
  enableWatermark(text = null) {
    if (!this.isHost) {
      throw new Error('Only hosts can enable watermarking')
    }

    this.watermarkEnabled = true
    this.watermarkText = text || `${this.roomName} - ${new Date().toISOString()}`

    logger.info('💧 Watermarking enabled:', this.watermarkText)
  }

  /**
   * Disable watermarking
   */
  disableWatermark() {
    if (!this.isHost) {
      throw new Error('Only hosts can disable watermarking')
    }

    this.watermarkEnabled = false
    this.watermarkText = ''

    logger.info('💧 Watermarking disabled')
  }

  /**
   * Get watermark configuration
   */
  getWatermarkConfig() {
    return {
      enabled: this.watermarkEnabled,
      text: this.watermarkText,
      position: 'bottom-right',
      opacity: 0.7,
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.8)',
    }
  }

  /**
   * ===================================
   * DOMAIN WHITELISTING/BLACKLISTING
   * ===================================
   */

  /**
   * Set domain whitelist
   */
  setDomainWhitelist(domains) {
    if (!this.isHost) {
      throw new Error('Only hosts can set domain whitelist')
    }

    this.domainWhitelist = domains.map(d => d.toLowerCase())
    logger.info('✅ Domain whitelist set:', this.domainWhitelist)
  }

  /**
   * Set domain blacklist
   */
  setDomainBlacklist(domains) {
    if (!this.isHost) {
      throw new Error('Only hosts can set domain blacklist')
    }

    this.domainBlacklist = domains.map(d => d.toLowerCase())
    logger.info('🚫 Domain blacklist set:', this.domainBlacklist)
  }

  /**
   * ===================================
   * AUDIT LOGGING
   * ===================================
   */

  /**
   * Log a security event
   */
  logSecurityEvent(eventType, details = {}) {
    const event = {
      timestamp: new Date().toISOString(),
      type: eventType,
      roomName: this.roomName,
      userId: this.userId,
      isHost: this.isHost,
      ...details,
    }

    this.auditLog.push(event)

    // Trim log if it exceeds max size
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog = this.auditLog.slice(-this.maxAuditLogSize)
    }

    logger.debug('📝 Security event logged:', eventType, details)
  }

  /**
   * Get audit log
   */
  getAuditLog(limit = 100) {
    return this.auditLog.slice(-limit)
  }

  /**
   * Export audit log as JSON
   */
  exportAuditLog() {
    return JSON.stringify(this.auditLog, null, 2)
  }

  /**
   * Clear audit log (host only)
   */
  clearAuditLog() {
    if (!this.isHost) {
      throw new Error('Only hosts can clear audit log')
    }

    this.auditLog = []
    logger.info('🗑️ Audit log cleared')
  }

  /**
   * ===================================
   * SECURITY POLICIES
   * ===================================
   */

  /**
   * Enable a security policy
   */
  enablePolicy(policy) {
    if (!this.isHost) {
      throw new Error('Only hosts can enable security policies')
    }

    this.policies.add(policy)
    logger.info('🛡️ Security policy enabled:', policy)
  }

  /**
   * Disable a security policy
   */
  disablePolicy(policy) {
    if (!this.isHost) {
      throw new Error('Only hosts can disable security policies')
    }

    this.policies.delete(policy)
    logger.info('🛡️ Security policy disabled:', policy)
  }

  /**
   * Check if a policy is enabled
   */
  isPolicyEnabled(policy) {
    return this.policies.has(policy)
  }

  /**
   * ===================================
   * UTILITY FUNCTIONS
   * ===================================
   */

  /**
   * Generate a unique key ID
   */
  generateKeyId() {
    return `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Convert Base64 to ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Get current security status
   */
  getSecurityStatus() {
    return {
      isHost: this.isHost,
      passwordProtected: !!this.roomPasswordHash,
      roomLocked: this.isRoomLocked,
      e2eeEnabled: this.e2eeEnabled,
      watermarkEnabled: this.watermarkEnabled,
      screenSharingPolicy: this.screenSharingHostOnly ? 'host_only' : 'all',
      domainWhitelist: this.domainWhitelist,
      domainBlacklist: this.domainBlacklist,
      activePolicies: Array.from(this.policies),
      auditLogSize: this.auditLog.length,
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.encryptionKey = null
    this.roomPassword = null
    this.roomPasswordHash = null
    this.auditLog = []
    this.policies.clear()
    this.hostIds.clear()
    this.allowedParticipants.clear()

    logger.info('🧹 Security service destroyed')
  }
}
