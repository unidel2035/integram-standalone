import { logger } from '@/utils/logger'
/**
 * Unified WebRTC Service supporting both P2P and Server Relay modes
 * Provides a single interface for video conferencing with mode switching
 */
import WebRTCService from './WebRTCService'
import WebRTCRelayService from './WebRTCRelayService'

export const CONNECTION_MODE = {
  P2P: 'p2p',
  RELAY: 'relay'
}

export default class UnifiedWebRTCService {
  constructor(roomName, userName = 'User', mode = CONNECTION_MODE.RELAY) {
    this.roomName = roomName
    this.userName = userName
    this.currentMode = mode
    this.activeService = null
    this.eventHandlers = new Map()
    this.localStream = null

    logger.debug(`🔄 [Unified] Initializing with mode: ${mode}`)
    this.initializeService(mode)
  }

  /**
   * Initialize the appropriate service based on mode
   */
  initializeService(mode) {
    if (this.activeService) {
      logger.debug('🔄 [Unified] Cleaning up previous service')
      this.activeService.disconnect()
    }

    if (mode === CONNECTION_MODE.P2P) {
      logger.debug('🔄 [Unified] Creating P2P service (direct peer connections)')
      this.activeService = new WebRTCService(this.roomName, this.userName)
    } else {
      logger.debug('🔄 [Unified] Creating Relay service (server-mediated connections)')
      this.activeService = new WebRTCRelayService(this.roomName, this.userName)
    }

    // Forward all events from active service
    this.setupEventForwarding()

    // Set local stream if it was already set
    if (this.localStream) {
      this.activeService.setLocalStream(this.localStream)
    }
  }

  /**
   * Setup event forwarding from active service to unified handlers
   */
  setupEventForwarding() {
    const events = [
      'peer-joined',
      'peer-left',
      'stream',
      'chat-message',
      'reaction',
      'raise-hand',
      'disconnected',
      'error',
      'peer-error',
      // Poll events (Issue #2351)
      'poll:created',
      'poll:started',
      'poll:ended',
      'poll:vote',
      'poll:results',
      // Q&A events (Issue #2351)
      'qa:question-submitted',
      'qa:question-upvoted',
      'qa:question-answered',
      'qa:question-dismissed',
      'qa:mode-changed',
      'qa:sync',
      'qa:request-sync'
    ]

    events.forEach(event => {
      this.activeService.on(event, (...args) => {
        this.emit(event, ...args)
      })
    })
  }

  /**
   * Switch between P2P and Relay modes
   * @param {string} newMode - CONNECTION_MODE.P2P or CONNECTION_MODE.RELAY
   */
  async switchMode(newMode) {
    if (newMode === this.currentMode) {
      logger.debug('🔄 [Unified] Already in requested mode:', newMode)
      return
    }

    logger.debug(`🔄 [Unified] Switching from ${this.currentMode} to ${newMode}`)

    // Store current state
    const wasConnected = this.activeService?.connected

    // Disconnect current service
    if (this.activeService) {
      this.activeService.disconnect()
    }

    // Update mode
    this.currentMode = newMode

    // Initialize new service
    this.initializeService(newMode)

    // Reconnect if we were connected before
    if (wasConnected) {
      try {
        await this.connect()
        logger.debug('✅ [Unified] Reconnected in new mode:', newMode)
        this.emit('mode-changed', newMode)
      } catch (error) {
        console.error('❌ [Unified] Failed to reconnect after mode switch:', error)
        throw error
      }
    }
  }

  /**
   * Get current connection mode
   */
  getMode() {
    return this.currentMode
  }

  /**
   * Get mode description for UI
   */
  getModeDescription() {
    if (this.currentMode === CONNECTION_MODE.P2P) {
      return {
        name: 'P2P (Прямое соединение)',
        description: 'Прямое соединение между участниками. Лучшее качество, но может не работать за некоторыми типами NAT.',
        icon: 'pi-link'
      }
    } else {
      return {
        name: 'Relay (Через сервер)',
        description: 'Подключение через сервер. Работает всегда, но может иметь немного большую задержку.',
        icon: 'pi-server'
      }
    }
  }

  // Delegate all other methods to active service

  async connect() {
    return this.activeService.connect()
  }

  disconnect() {
    if (this.activeService) {
      this.activeService.disconnect()
    }
  }

  setLocalStream(stream) {
    this.localStream = stream
    if (this.activeService) {
      this.activeService.setLocalStream(stream)
    }
  }

  broadcastScreenShare(screenStream) {
    if (this.activeService) {
      this.activeService.broadcastScreenShare(screenStream)
    }
  }

  sendChatMessage(message) {
    if (this.activeService) {
      this.activeService.sendChatMessage(message)
    }
  }

  sendReaction(emoji) {
    if (this.activeService && this.activeService.sendReaction) {
      this.activeService.sendReaction(emoji)
    }
  }

  sendRaiseHand(raised) {
    if (this.activeService && this.activeService.sendRaiseHand) {
      this.activeService.sendRaiseHand(raised)
    }
  }

  async getStats(peerId) {
    if (this.activeService && this.activeService.getStats) {
      return this.activeService.getStats(peerId)
    }
    return null
  }

  logConnectionStates() {
    logger.debug(`🔍 [Unified] Current mode: ${this.currentMode}`)
    if (this.activeService && this.activeService.logConnectionStates) {
      this.activeService.logConnectionStates()
    }
  }

  async verifyAndFixConnections() {
    if (this.activeService && this.activeService.verifyAndFixConnections) {
      return this.activeService.verifyAndFixConnections()
    }
  }

  get connected() {
    return this.activeService?.connected || false
  }

  get peerId() {
    return this.activeService?.peerId
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
      handlers.forEach(handler => handler(...args))
    }
  }

  /**
   * Get available connection modes
   */
  static getAvailableModes() {
    return [
      {
        value: CONNECTION_MODE.P2P,
        label: 'P2P (Прямое соединение)',
        description: 'Прямое соединение между участниками. Лучшее качество, но может не работать за некоторыми типами NAT.',
        icon: 'pi-link',
        recommended: false
      },
      {
        value: CONNECTION_MODE.RELAY,
        label: 'Relay (Через сервер)',
        description: 'Подключение через сервер. Работает всегда, но может иметь немного большую задержку.',
        icon: 'pi-server',
        recommended: true
      }
    ]
  }

  /**
   * Waiting Room Control Methods (Issue #2349)
   * Delegated to active service
   */

  enableWaitingRoom() {
    if (this.activeService && this.activeService.enableWaitingRoom) {
      return this.activeService.enableWaitingRoom()
    }
  }

  disableWaitingRoom() {
    if (this.activeService && this.activeService.disableWaitingRoom) {
      return this.activeService.disableWaitingRoom()
    }
  }

  requestEntry(email = null) {
    if (this.activeService && this.activeService.requestEntry) {
      return this.activeService.requestEntry(email)
    }
  }

  admitParticipant(targetPeerId) {
    if (this.activeService && this.activeService.admitParticipant) {
      return this.activeService.admitParticipant(targetPeerId)
    }
  }

  admitAllParticipants() {
    if (this.activeService && this.activeService.admitAllParticipants) {
      return this.activeService.admitAllParticipants()
    }
  }

  denyParticipant(targetPeerId, reason = null) {
    if (this.activeService && this.activeService.denyParticipant) {
      return this.activeService.denyParticipant(targetPeerId, reason)
    }
  }

  sendWaitingRoomMessage(message, targetPeerId = null) {
    if (this.activeService && this.activeService.sendWaitingRoomMessage) {
      return this.activeService.sendWaitingRoomMessage(message, targetPeerId)
    }
  }

  updateAutoAdmitRules(autoAdmitRules) {
    if (this.activeService && this.activeService.updateAutoAdmitRules) {
      return this.activeService.updateAutoAdmitRules(autoAdmitRules)
    }
  }
}
