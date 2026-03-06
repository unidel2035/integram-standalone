import { logger } from '@/utils/logger'
import SimplePeer from 'simple-peer'
import { getOrchestratorUrl } from '@/utils/apiConfig'

/**
 * WebRTC Service for managing peer-to-peer video conferencing
 * Uses a mesh architecture where each peer connects directly to others
 */
export default class WebRTCService {
  constructor(roomName, userName = 'User') {
    this.roomName = roomName
    this.userName = userName
    this.socket = null
    this.peers = new Map() // Map of peerId -> SimplePeer instance
    this.peerNames = new Map() // Map of peerId -> peerName (for tracking participant names)
    this.peerDevices = new Map() // Map of peerId -> deviceType (for tracking device types)
    this.localStream = null
    this.eventHandlers = new Map()
    this.peerId = this.generatePeerId()
    this.connected = false

    // Configuration for ICE servers (STUN/TURN) - configurable via environment
    this.iceServers = this.getIceServersConfig()
  }

  /**
   * Get ICE servers configuration from environment variables
   */
  getIceServersConfig() {
    const iceServers = []

    // Add STUN servers (from env or defaults with multiple reliable public servers)
    const stunServers = import.meta.env.VITE_WEBRTC_STUN_SERVERS
      ? import.meta.env.VITE_WEBRTC_STUN_SERVERS.split(',').map(url => ({ urls: url.trim() }))
      : [
          // Google STUN servers (primary, most reliable)
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Mozilla STUN server (backup)
          { urls: 'stun:stun.services.mozilla.com:3478' },
          // OpenRelay free STUN server
          { urls: 'stun:openrelay.metered.ca:80' },
          // Twilio STUN server
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
    iceServers.push(...stunServers)

    // Add TURN servers (from env or free public TURN servers)
    const turnUrl = import.meta.env.VITE_WEBRTC_TURN_URL
    const turnUsername = import.meta.env.VITE_WEBRTC_TURN_USERNAME
    const turnCredential = import.meta.env.VITE_WEBRTC_TURN_CREDENTIAL

    if (turnUrl && turnUsername && turnCredential) {
      // Use custom TURN server from environment
      const turnConfig = {
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential
      }
      iceServers.push(turnConfig)
      logger.debug('Custom TURN server configured for NAT traversal')
    } else {
      // Use free public TURN servers (OpenRelay.metered.ca)
      // These are rate-limited but work for testing/development
      const publicTurnServers = [
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
      iceServers.push(...publicTurnServers)
      logger.debug('Using free public TURN servers (OpenRelay) for NAT traversal')
      logger.debug('Note: For production, configure custom TURN server via VITE_WEBRTC_TURN_* env variables')
    }

    logger.debug('ICE servers configuration:', iceServers)
    return { iceServers }
  }

  /**
   * Generate a unique peer ID
   */
  generatePeerId() {
    return `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Detect device type based on user agent
   */
  detectDeviceType() {
    const ua = navigator.userAgent.toLowerCase()

    // Check for mobile devices
    if (/android/.test(ua)) {
      return /mobile/.test(ua) ? 'Телефон (Android)' : 'Планшет (Android)'
    }
    if (/iphone/.test(ua)) {
      return 'Телефон (iPhone)'
    }
    if (/ipad/.test(ua)) {
      return 'Планшет (iPad)'
    }
    if (/mobile|android|touch|webos|blackberry|opera mini|opera mobi/i.test(ua)) {
      return 'Мобильное устройство'
    }

    // Check for desktop OS
    if (/mac os x/.test(ua)) {
      return 'Компьютер (Mac)'
    }
    if (/windows/.test(ua)) {
      return 'Компьютер (Windows)'
    }
    if (/linux/.test(ua)) {
      return 'Компьютер (Linux)'
    }

    return 'Компьютер'
  }

  /**
   * Get the backend orchestrator URL from environment or default
   */
  getBackendUrl() {
    // Use the centralized API config utility which automatically detects
    // whether running on drondoc.ru or dev.drondoc.ru
    return getOrchestratorUrl().replace(/\/$/, '') // Remove trailing slash
  }

  /**
   * Check if the backend orchestrator is available
   */
  async checkBackendHealth() {
    try {
      const baseUrl = this.getBackendUrl()
      const healthUrl = `${baseUrl}/api/health`

      logger.debug('Checking backend health:', healthUrl)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        logger.debug('Backend orchestrator is available')
        return { available: true, url: baseUrl }
      } else {
        console.warn('Backend health check failed with status:', response.status)
        return { available: false, error: `HTTP ${response.status}`, url: baseUrl }
      }
    } catch (error) {
      console.warn('Backend orchestrator not available:', error.message)
      return {
        available: false,
        error: error.name === 'AbortError' ? 'Connection timeout' : error.message,
        url: this.getBackendUrl()
      }
    }
  }

  /**
   * Connect to signaling server
   */
  async connect() {
    // Check backend health first
    const health = await this.checkBackendHealth()
    if (!health.available) {
      const error = new Error('Backend orchestrator not available')
      const backendUrl = health.url || this.getBackendUrl()
      const isDev = import.meta.env.DEV

      error.details = {
        message: 'Сервер видеоконференций недоступен',
        hint: isDev
          ? `Запустите backend сервер локально:\n\n1. Откройте новый терминал\n2. cd backend/monolith\n3. npm install (если еще не установлены зависимости)\n4. npm run dev\n5. Обновите страницу после запуска сервера\n\nСервер должен быть доступен по адресу: ${backendUrl}`
          : `Сервер по адресу ${backendUrl} недоступен. Обратитесь к администратору.`,
        technical: health.error,
        backendUrl
      }
      throw error
    }

    return new Promise((resolve, reject) => {
      try {
        // Get WebSocket URL from backend URL
        const backendUrl = health.url || this.getBackendUrl()
        const wsUrl = backendUrl.replace(/^http/, 'ws') + '/ws'

        logger.debug('Connecting to WebSocket:', wsUrl)

        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
          if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
            this.socket.close()
            const error = new Error('WebSocket connection timeout')
            const isDev = import.meta.env.DEV
            const backendUrl = health.url || this.getBackendUrl()

            error.details = {
              message: 'Не удалось подключиться к серверу видеоконференций',
              hint: isDev
                ? `Запустите backend сервер локально:\n\n1. Откройте новый терминал\n2. cd backend/monolith\n3. npm install\n4. npm run dev\n5. Обновите страницу\n\nСервер должен быть доступен по адресу: ${backendUrl}`
                : `Сервер по адресу ${backendUrl} недоступен. Обратитесь к администратору.`,
              technical: 'Connection timeout after 10 seconds',
              backendUrl
            }
            reject(error)
          }
        }, 10000) // 10 second timeout

        this.socket = new WebSocket(wsUrl)

        this.socket.onopen = () => {
          logger.debug('WebSocket connected')
          clearTimeout(connectionTimeout)
          this.connected = true

          // Detect device type
          const deviceType = this.detectDeviceType()

          // Join the video conference room
          this.socket.send(JSON.stringify({
            type: 'video:join-room',
            roomName: this.roomName,
            peerId: this.peerId,
            peerName: this.userName,
            deviceType: deviceType
          }))

          // Store device type locally
          this.deviceType = deviceType

          resolve()
        }

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleServerMessage(data)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error)
          clearTimeout(connectionTimeout)
          this.connected = false

          const enhancedError = new Error('WebSocket connection error')
          const isDev = import.meta.env.DEV
          const backendUrl = health.url || this.getBackendUrl()

          enhancedError.details = {
            message: 'Ошибка подключения к серверу видеоконференций',
            hint: isDev
              ? `Запустите backend сервер локально:\n\n1. Откройте новый терминал\n2. cd backend/monolith\n3. npm install\n4. npm run dev\n5. Обновите страницу\n\nСервер должен быть доступен по адресу: ${backendUrl}`
              : `Сервер по адресу ${backendUrl} недоступен. Обратитесь к администратору.`,
            technical: error.message || 'WebSocket connection failed',
            backendUrl
          }
          reject(enhancedError)
        }

        this.socket.onclose = (event) => {
          logger.debug('WebSocket disconnected', event.code, event.reason)
          clearTimeout(connectionTimeout)
          this.connected = false
          this.emit('disconnected', { code: event.code, reason: event.reason })
        }
      } catch (error) {
        const enhancedError = new Error('Failed to initialize WebSocket connection')
        const isDev = import.meta.env.DEV
        const backendUrl = health?.url || this.getBackendUrl()

        enhancedError.details = {
          message: 'Не удалось инициализировать подключение',
          hint: isDev
            ? `Запустите backend сервер локально:\n\n1. Откройте новый терминал\n2. cd backend/monolith\n3. npm install\n4. npm run dev\n5. Обновите страницу\n\nСервер должен быть доступен по адресу: ${backendUrl}`
            : `Сервер по адресу ${backendUrl} недоступен. Обратитесь к администратору.`,
          technical: error.message,
          backendUrl
        }
        reject(enhancedError)
      }
    })
  }

  /**
   * Handle messages from the signaling server
   */
  handleServerMessage(data) {
    logger.debug('🔔 [WebRTC] Received server message:', data.type, data)

    switch (data.type) {
      case 'video:room-joined':
        // We successfully joined the room, connect to existing peers
        logger.info('✅ [WebRTC] Room joined successfully')
        logger.debug('👥 [WebRTC] Existing peers in room:', data.peers.length, data.peers)

        // Create peer connections to all existing peers (we are the initiator)
        data.peers.forEach(peer => {
          logger.debug('🤝 [WebRTC] Initiating connection to existing peer:', peer.peerId, peer.peerName, peer.deviceType)
          // Store peer name and device type first
          this.peerNames.set(peer.peerId, peer.peerName)
          this.peerDevices.set(peer.peerId, peer.deviceType)
          this.addPeer(peer.peerId, peer.peerName, peer.deviceType)
        })

        if (data.peers.length === 0) {
          logger.debug('ℹ️ [WebRTC] No existing peers - you are the first in the room')
        }
        break

      case 'video:peer-joined':
        // A new peer joined the room
        logger.debug('🆕 [WebRTC] New peer joined room:', data.peerId, data.peerName, data.deviceType)
        logger.debug('⏳ [WebRTC] Waiting for incoming connection from new peer...')
        // Store the peer name and device type for later use
        this.peerNames.set(data.peerId, data.peerName)
        this.peerDevices.set(data.peerId, data.deviceType)
        logger.debug('📝 [WebRTC] Stored peer info:', data.peerName, data.deviceType, 'for peer:', data.peerId)
        // NOTE: We should NOT initiate connection here because the new peer
        // will initiate to all existing peers (see 'video:room-joined' handling).
        // Creating a connection here would result in duplicate connections.
        // We'll create the peer connection when we receive their signal.
        // Just notify the UI about the new participant
        this.emit('peer-joined', data.peerId, data.peerName, data.deviceType)
        break

      case 'video:peer-left':
        // A peer left the room
        logger.debug('👋 [WebRTC] Peer left room:', data.peerId)
        this.removePeer(data.peerId)
        break

      case 'video:signal':
        // Received WebRTC signaling data from a peer
        logger.debug('📡 [WebRTC] Received signal from:', data.fromPeerId, 'Type:', data.signal.type)
        this.signal(data.fromPeerId, data.signal)
        break

      case 'connected':
        logger.debug('WebSocket connection acknowledged')
        break

      case 'error':
        console.error('Server error:', data.message)
        this.emit('error', data.message)
        break

      default:
        logger.debug('Unknown message type:', data.type)
    }
  }

  /**
   * Set local media stream
   */
  setLocalStream(stream) {
    logger.debug('📹 [WebRTC] Setting local stream')
    logger.debug('   Stream ID:', stream?.id || 'null')
    logger.debug('   Video tracks:', stream?.getVideoTracks().length || 0)
    logger.debug('   Audio tracks:', stream?.getAudioTracks().length || 0)
    logger.debug('   Existing peers:', this.peers.size)

    this.localStream = stream

    // Update stream on all existing peer connections
    if (stream) {
      this.updateStreamOnPeers(stream)
    }
  }

  /**
   * Update the local stream on all existing peer connections
   * This is critical when the stream changes (e.g., device change, restart)
   */
  updateStreamOnPeers(stream) {
    logger.debug('🔄 [WebRTC] Updating stream on all peer connections')

    this.peers.forEach((peer, peerId) => {
      if (!peer._pc) {
        console.warn(`⚠️ [WebRTC] Peer ${peerId} has no RTCPeerConnection`)
        return
      }

      try {
        const senders = peer._pc.getSenders()
        logger.debug(`   Updating peer ${peerId} - found ${senders.length} senders`)

        // Get tracks from the new stream
        const videoTrack = stream.getVideoTracks()[0]
        const audioTrack = stream.getAudioTracks()[0]

        // Replace video track
        const videoSender = senders.find(s => s.track?.kind === 'video')
        if (videoSender && videoTrack) {
          videoSender.replaceTrack(videoTrack)
            .then(() => {
              logger.debug(`   ✅ Replaced video track for peer ${peerId}`)
            })
            .catch(err => {
              console.error(`   ❌ Failed to replace video track for peer ${peerId}:`, err)
            })
        } else if (videoTrack && !videoSender) {
          // Add video track if it wasn't present before
          peer._pc.addTrack(videoTrack, stream)
          logger.debug(`   ➕ Added video track for peer ${peerId}`)
        }

        // Replace audio track
        const audioSender = senders.find(s => s.track?.kind === 'audio')
        if (audioSender && audioTrack) {
          audioSender.replaceTrack(audioTrack)
            .then(() => {
              logger.debug(`   ✅ Replaced audio track for peer ${peerId}`)
            })
            .catch(err => {
              console.error(`   ❌ Failed to replace audio track for peer ${peerId}:`, err)
            })
        } else if (audioTrack && !audioSender) {
          // Add audio track if it wasn't present before
          peer._pc.addTrack(audioTrack, stream)
          logger.debug(`   ➕ Added audio track for peer ${peerId}`)
        }
      } catch (error) {
        console.error(`❌ [WebRTC] Failed to update stream for peer ${peerId}:`, error)
      }
    })
  }

  /**
   * Create a new peer connection
   */
  createPeer(peerId, initiator = false) {
    logger.debug(`🔗 [WebRTC] Creating peer connection with ${peerId}`)
    logger.debug(`   Role: ${initiator ? 'INITIATOR (offering)' : 'RECEIVER (answering)'}`)
    logger.debug(`   Local stream:`, this.localStream ? 'Available' : 'NOT AVAILABLE')

    if (!this.localStream) {
      console.error('❌ [WebRTC] Cannot create peer - no local stream available!')
    }

    const peer = new SimplePeer({
      initiator,
      stream: this.localStream,
      config: this.iceServers,
      trickle: true,
      // Enable more verbose debugging for connection issues
      offerOptions: {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      }
    })

    // Handle peer events
    peer.on('signal', (signal) => {
      logger.debug(`📤 [WebRTC] Sending ${signal.type} signal to ${peerId}`)
      logger.debug(`   Signal details:`, {
        type: signal.type,
        sdpType: signal.sdp ? 'SDP present' : 'No SDP',
        candidateType: signal.candidate ? 'ICE candidate' : 'No candidate'
      })
      // Send signal through WebSocket server
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({
          type: 'video:signal',
          targetPeerId: peerId,
          signal
        }))
      } else {
        console.error('❌ [WebRTC] Cannot send signal - WebSocket not connected')
      }
    })

    peer.on('stream', (stream) => {
      const peerName = this.peerNames.get(peerId) || `User_${peerId.substring(0, 4)}`
      const deviceType = this.peerDevices.get(peerId) || 'Устройство'
      logger.debug(`🎥 [WebRTC] Received media stream from ${peerId} (${peerName} - ${deviceType})`)
      logger.debug(`   Stream ID:`, stream.id)
      logger.debug(`   Stream active:`, stream.active)
      logger.debug(`   Video tracks:`, stream.getVideoTracks().length)
      logger.debug(`   Audio tracks:`, stream.getAudioTracks().length)

      // Log track states
      stream.getVideoTracks().forEach((track, idx) => {
        logger.debug(`   Video track ${idx}:`, {
          id: track.id,
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
          label: track.label
        })
      })
      stream.getAudioTracks().forEach((track, idx) => {
        logger.debug(`   Audio track ${idx}:`, {
          id: track.id,
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
          label: track.label
        })
      })

      // Emit stream event with peerId, stream, peerName, and deviceType
      this.emit('stream', peerId, stream, peerName, deviceType)
    })

    peer.on('connect', () => {
      logger.debug(`✅ [WebRTC] Peer connection established with ${peerId}`)
      logger.debug(`   Connection state:`, peer._pc?.connectionState)
      logger.debug(`   ICE connection state:`, peer._pc?.iceConnectionState)
      logger.debug(`   Signaling state:`, peer._pc?.signalingState)

      // Double-check that we're sending our stream
      if (this.localStream && peer._pc) {
        const senders = peer._pc.getSenders()
        logger.debug(`   Active senders: ${senders.length}`)
        senders.forEach((sender, idx) => {
          logger.debug(`   Sender ${idx}:`, {
            track: sender.track?.kind || 'null',
            enabled: sender.track?.enabled
          })
        })
      }
    })

    peer.on('error', (error) => {
      console.error(`❌ [WebRTC] Peer ${peerId} error:`, error.message)
      console.error('   Full error:', error)
      console.error('   Error stack:', error.stack)
      this.emit('peer-error', peerId, error)
    })

    peer.on('close', () => {
      logger.debug(`🔌 [WebRTC] Peer ${peerId} connection closed`)
      this.peers.delete(peerId)
      this.emit('peer-left', peerId)
    })

    // Track ICE connection state changes
    if (peer._pc) {
      peer._pc.oniceconnectionstatechange = () => {
        logger.debug(`🧊 [WebRTC] ICE connection state for ${peerId}:`, peer._pc.iceConnectionState)
        if (peer._pc.iceConnectionState === 'failed' || peer._pc.iceConnectionState === 'disconnected') {
          console.error(`❌ [WebRTC] ICE connection ${peer._pc.iceConnectionState} for peer ${peerId}`)
          console.error('   This might indicate NAT traversal issues or network problems')
        }
      }

      peer._pc.onconnectionstatechange = () => {
        logger.debug(`🔗 [WebRTC] Connection state for ${peerId}:`, peer._pc.connectionState)
      }
    }

    this.peers.set(peerId, peer)
    logger.debug(`📊 [WebRTC] Total active peer connections: ${this.peers.size}`)
    return peer
  }

  /**
   * Handle incoming signal from peer
   */
  signal(peerId, signal) {
    let peer = this.peers.get(peerId)

    if (!peer) {
      logger.debug(`📥 [WebRTC] Creating new peer for incoming signal from ${peerId}`)
      peer = this.createPeer(peerId, false)
    } else {
      logger.debug(`📥 [WebRTC] Processing signal for existing peer ${peerId}`)
    }

    try {
      peer.signal(signal)
      logger.info(`✅ [WebRTC] Signal processed successfully for ${peerId}`)
    } catch (error) {
      console.error(`❌ [WebRTC] Error processing signal for ${peerId}:`, error.message)
    }
  }

  /**
   * Add a new peer to the room
   */
  addPeer(peerId, peerName, deviceType) {
    if (!this.peers.has(peerId)) {
      this.createPeer(peerId, true)
      this.emit('peer-joined', peerId, peerName, deviceType)
    }
  }

  /**
   * Remove a peer from the room
   */
  removePeer(peerId) {
    const peer = this.peers.get(peerId)
    if (peer) {
      peer.destroy()
      this.peers.delete(peerId)
      this.peerNames.delete(peerId)
      this.peerDevices.delete(peerId)
      this.emit('peer-left', peerId)
    }
  }

  /**
   * Broadcast screen share to all peers
   */
  broadcastScreenShare(screenStream) {
    this.peers.forEach((peer) => {
      // Replace video track with screen share track
      const screenTrack = screenStream.getVideoTracks()[0]
      const sender = peer._pc.getSenders().find(s => s.track?.kind === 'video')
      if (sender) {
        sender.replaceTrack(screenTrack)
      }
    })
  }

  /**
   * Send chat message to all peers
   */
  sendChatMessage(message) {
    const chatData = {
      type: 'chat',
      ...message
    }

    this.peers.forEach((peer) => {
      try {
        peer.send(JSON.stringify(chatData))
      } catch (error) {
        console.error('Error sending chat message:', error)
      }
    })

    // Also emit locally
    this.emit('chat-message', message)
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
   * Disconnect from the room
   */
  disconnect() {
    // Notify server we're leaving
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'video:leave-room',
        roomName: this.roomName,
        peerId: this.peerId
      }))
    }

    // Destroy all peer connections
    this.peers.forEach(peer => peer.destroy())
    this.peers.clear()

    // Disconnect socket
    if (this.socket) {
      this.socket.close()
    }

    this.connected = false
  }

  /**
   * Get connection statistics for a peer
   */
  async getStats(peerId) {
    const peer = this.peers.get(peerId)
    if (!peer || !peer._pc) {
      return null
    }

    try {
      const stats = await peer._pc.getStats()
      const result = {
        bytesReceived: 0,
        bytesSent: 0,
        packetsLost: 0,
        roundTripTime: 0
      }

      stats.forEach(report => {
        if (report.type === 'inbound-rtp') {
          result.bytesReceived += report.bytesReceived || 0
          result.packetsLost += report.packetsLost || 0
        }
        if (report.type === 'outbound-rtp') {
          result.bytesSent += report.bytesSent || 0
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          result.roundTripTime = report.currentRoundTripTime || 0
        }
      })

      return result
    } catch (error) {
      console.error('Error getting stats:', error)
      return null
    }
  }

  /**
   * Debug helper: Log detailed connection state for all peers
   */
  logConnectionStates() {
    logger.debug('🔍 [WebRTC] Current connection states:')
    logger.debug(`   Total peers: ${this.peers.size}`)
    logger.debug(`   Local stream: ${this.localStream ? 'Available' : 'Not set'}`)

    if (this.localStream) {
      logger.debug(`   Local stream tracks:`)
      logger.debug(`     Video: ${this.localStream.getVideoTracks().length}`)
      logger.debug(`     Audio: ${this.localStream.getAudioTracks().length}`)
    }

    this.peers.forEach((peer, peerId) => {
      const peerName = this.peerNames.get(peerId) || 'Unknown'
      logger.debug(`\n   Peer: ${peerId} (${peerName})`)

      if (peer._pc) {
        logger.debug(`     Connection state: ${peer._pc.connectionState}`)
        logger.debug(`     ICE connection state: ${peer._pc.iceConnectionState}`)
        logger.debug(`     ICE gathering state: ${peer._pc.iceGatheringState}`)
        logger.debug(`     Signaling state: ${peer._pc.signalingState}`)

        const senders = peer._pc.getSenders()
        logger.debug(`     Senders (${senders.length}):`)
        senders.forEach((sender, idx) => {
          logger.debug(`       ${idx}: ${sender.track?.kind || 'null'} - enabled: ${sender.track?.enabled}`)
        })

        const receivers = peer._pc.getReceivers()
        logger.debug(`     Receivers (${receivers.length}):`)
        receivers.forEach((receiver, idx) => {
          logger.debug(`       ${idx}: ${receiver.track?.kind || 'null'} - enabled: ${receiver.track?.enabled}`)
        })
      } else {
        logger.debug(`     ❌ No RTCPeerConnection`)
      }
    })
  }
}
