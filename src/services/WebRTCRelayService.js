import { logger } from '@/utils/logger'
import { getOrchestratorUrl } from '@/utils/apiConfig'

/**
 * WebRTC Relay Service for server-mediated video conferencing
 * Uses a mesh P2P architecture with server-relayed signaling
 * Each client establishes peer connections to all other clients in the room
 */
export default class WebRTCRelayService {
  constructor(roomName, userName = 'User') {
    this.roomName = roomName
    this.userName = userName
    this.socket = null
    this.peerConnections = new Map() // peerId -> RTCPeerConnection (one per remote peer)
    this.localStream = null
    this.remoteStreams = new Map() // peerId -> MediaStream
    this.peerNames = new Map() // peerId -> peerName
    this.peerDevices = new Map() // peerId -> deviceType
    this.eventHandlers = new Map()
    this.peerId = this.generatePeerId()
    this.connected = false
    this.deviceType = this.detectDeviceType()
    this.makingOffer = new Map() // peerId -> boolean (for perfect negotiation)
    this.pendingCandidates = new Map() // peerId -> [candidates] (queued until remote description is set)

    // Configuration for ICE servers (STUN/TURN)
    this.iceServers = this.getIceServersConfig()
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
   * Get ICE servers configuration from environment variables
   */
  getIceServersConfig() {
    const iceServers = []

    // Add STUN servers (from env or defaults)
    const stunServers = import.meta.env.VITE_WEBRTC_STUN_SERVERS
      ? import.meta.env.VITE_WEBRTC_STUN_SERVERS.split(',').map(url => ({ urls: url.trim() }))
      : [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ]
    iceServers.push(...stunServers)

    // Add TURN server if configured
    const turnUrl = import.meta.env.VITE_WEBRTC_TURN_URL
    if (turnUrl) {
      const turnConfig = {
        urls: turnUrl,
        username: import.meta.env.VITE_WEBRTC_TURN_USERNAME || '',
        credential: import.meta.env.VITE_WEBRTC_TURN_CREDENTIAL || ''
      }
      iceServers.push(turnConfig)
      logger.debug('🔄 [Relay] TURN server configured')
    }

    logger.debug('🔄 [Relay] ICE servers configuration:', iceServers)
    return { iceServers }
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

      logger.debug('🔄 [Relay] Checking backend health:', healthUrl)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        logger.debug('🔄 [Relay] Backend orchestrator is available')
        return { available: true, url: baseUrl }
      } else {
        console.warn('🔄 [Relay] Backend health check failed with status:', response.status)
        return { available: false, error: `HTTP ${response.status}`, url: baseUrl }
      }
    } catch (error) {
      console.warn('🔄 [Relay] Backend orchestrator not available:', error.message)
      return {
        available: false,
        error: error.name === 'AbortError' ? 'Connection timeout' : error.message,
        url: this.getBackendUrl()
      }
    }
  }

  /**
   * Connect to signaling server and set up relay connection
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

        logger.debug('🔄 [Relay] Connecting to WebSocket:', wsUrl)

        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
          if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
            this.socket.close()
            const error = new Error('WebSocket connection timeout')
            const isDev = import.meta.env.DEV

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
        }, 10000)

        this.socket = new WebSocket(wsUrl)

        this.socket.onopen = () => {
          logger.debug('🔄 [Relay] WebSocket connected')
          clearTimeout(connectionTimeout)
          this.connected = true

          // Join the relay room
          this.socket.send(JSON.stringify({
            type: 'relay:join-room',
            roomName: this.roomName,
            peerId: this.peerId,
            peerName: this.userName,
            deviceType: this.deviceType
          }))

          resolve()
        }

        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.handleServerMessage(data)
          } catch (error) {
            console.error('🔄 [Relay] Failed to parse WebSocket message:', error)
          }
        }

        this.socket.onerror = (error) => {
          console.error('🔄 [Relay] WebSocket error:', error)
          clearTimeout(connectionTimeout)
          this.connected = false

          const enhancedError = new Error('WebSocket connection error')
          const isDev = import.meta.env.DEV

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
          logger.debug('🔄 [Relay] WebSocket disconnected', event.code, event.reason)
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
    logger.debug('🔄 [Relay] Received server message:', data.type)

    switch (data.type) {
      case 'relay:room-joined':
        // Successfully joined the room
        logger.info('✅ [Relay] Room joined successfully')
        logger.debug('👥 [Relay] Existing peers:', data.peers.length)

        // Store peer information and create connections to existing peers
        data.peers.forEach(peer => {
          this.peerNames.set(peer.peerId, peer.peerName)
          this.peerDevices.set(peer.peerId, peer.deviceType)
          this.emit('peer-joined', peer.peerId, peer.peerName, peer.deviceType)

          // Create peer connection and make offer (we're the initiator for existing peers)
          this.createPeerConnection(peer.peerId, true)
        })
        break

      case 'relay:peer-joined':
        // A new peer joined the room (they will initiate connection to us)
        logger.debug('🆕 [Relay] New peer joined:', data.peerId, data.peerName, data.deviceType)
        this.peerNames.set(data.peerId, data.peerName)
        this.peerDevices.set(data.peerId, data.deviceType)
        this.emit('peer-joined', data.peerId, data.peerName, data.deviceType)

        // Create peer connection but don't make offer (they will offer to us)
        this.createPeerConnection(data.peerId, false)
        break

      case 'relay:peer-left':
        // A peer left the room
        logger.debug('👋 [Relay] Peer left:', data.peerId)
        this.closePeerConnection(data.peerId)
        this.peerNames.delete(data.peerId)
        this.peerDevices.delete(data.peerId)
        this.remoteStreams.delete(data.peerId)
        this.emit('peer-left', data.peerId)
        break

      case 'relay:offer':
        // Received offer from a specific peer
        logger.debug('📥 [Relay] Received offer from peer:', data.fromPeerId)
        this.handleOffer(data.fromPeerId, data.offer)
        break

      case 'relay:answer':
        // Received answer from a specific peer
        logger.debug('📥 [Relay] Received answer from peer:', data.fromPeerId)
        this.handleAnswer(data.fromPeerId, data.answer)
        break

      case 'relay:ice-candidate':
        // Received ICE candidate from a specific peer
        logger.debug('📥 [Relay] Received ICE candidate from peer:', data.fromPeerId)
        this.handleIceCandidate(data.fromPeerId, data.candidate)
        break

      case 'relay:chat-message':
        // Received chat message from a peer
        logger.debug('💬 [Relay] Received chat message from peer:', data.peerId)
        this.emit('chat-message', {
          text: data.message.text,
          timestamp: data.message.timestamp,
          sender: data.peerName || `User_${data.peerId.substring(0, 4)}`,
          isOwn: false
        })
        break

      case 'relay:reaction':
        // Received reaction from a peer
        logger.debug('😊 [Relay] Received reaction from peer:', data.peerId, data.emoji)
        this.emit('reaction', {
          emoji: data.emoji,
          peerId: data.peerId,
          peerName: data.peerName || `User_${data.peerId.substring(0, 4)}`,
          timestamp: data.timestamp || Date.now()
        })
        break

      case 'relay:raise-hand':
        // Received raise hand event from a peer
        logger.debug('✋ [Relay] Received raise hand event from peer:', data.peerId, data.raised)
        this.emit('raise-hand', {
          peerId: data.peerId,
          peerName: data.peerName || `User_${data.peerId.substring(0, 4)}`,
          raised: data.raised,
          timestamp: data.timestamp || Date.now()
        })
        break

      // Waiting Room events (Issue #2349)
      case 'waitingroom:enabled':
        logger.debug('🚪 [Relay] Waiting room enabled')
        this.emit('waitingroom:enabled', data)
        break

      case 'waitingroom:disabled':
        logger.debug('🚪 [Relay] Waiting room disabled')
        this.emit('waitingroom:disabled', data)
        break

      case 'waitingroom:status':
        logger.debug('🚪 [Relay] Waiting room status:', data.enabled)
        this.emit('waitingroom:status', data)
        break

      case 'waitingroom:waiting':
        logger.debug('🚪 [Relay] Waiting for admission')
        this.emit('waitingroom:waiting', data)
        break

      case 'waitingroom:admitted':
        logger.debug('✅ [Relay] Admitted to conference')
        this.emit('waitingroom:admitted', data)
        break

      case 'waitingroom:denied':
        logger.debug('❌ [Relay] Entry denied')
        this.emit('waitingroom:denied', data)
        break

      case 'waitingroom:participant-waiting':
        logger.debug('🚪 [Relay] Participant waiting:', data.participant.peerName)
        this.emit('waitingroom:participant-waiting', data)
        break

      case 'waitingroom:participant-admitted':
        logger.debug('✅ [Relay] Participant admitted:', data.peerId)
        this.emit('waitingroom:participant-admitted', data)
        break

      case 'waitingroom:participant-denied':
        logger.debug('❌ [Relay] Participant denied:', data.peerId)
        this.emit('waitingroom:participant-denied', data)
        break

      case 'waitingroom:all-admitted':
        logger.debug('✅ [Relay] All participants admitted')
        this.emit('waitingroom:all-admitted', data)
        break

      case 'waitingroom:message':
        logger.debug('💬 [Relay] Message from host:', data.message)
        this.emit('waitingroom:message', data)
        break

      case 'waitingroom:message-sent':
        logger.debug('💬 [Relay] Message sent to waiting room')
        this.emit('waitingroom:message-sent', data)
        break

      case 'waitingroom:rules-updated':
        logger.debug('📋 [Relay] Auto-admit rules updated')
        this.emit('waitingroom:rules-updated', data)
        break

      // Poll events (Issue #2351)
      case 'poll:created':
        logger.debug('📊 [Relay] Poll created:', data.poll?.id)
        this.emit('poll:created', data)
        break

      case 'poll:started':
        logger.debug('📊 [Relay] Poll started:', data.pollId)
        this.emit('poll:started', data)
        break

      case 'poll:ended':
        logger.debug('📊 [Relay] Poll ended:', data.pollId)
        this.emit('poll:ended', data)
        break

      case 'poll:vote':
        logger.debug('📊 [Relay] Vote received for poll:', data.pollId)
        this.emit('poll:vote', data)
        break

      case 'poll:results':
        logger.debug('📊 [Relay] Poll results received:', data.pollId)
        this.emit('poll:results', data)
        break

      // Q&A events (Issue #2351)
      case 'qa:question-submitted':
        logger.debug('❓ [Relay] Question submitted:', data.question?.id)
        this.emit('qa:question-submitted', data)
        break

      case 'qa:question-upvoted':
        logger.debug('❓ [Relay] Question upvoted:', data.questionId)
        this.emit('qa:question-upvoted', data)
        break

      case 'qa:question-answered':
        logger.debug('❓ [Relay] Question answered:', data.questionId)
        this.emit('qa:question-answered', data)
        break

      case 'qa:question-dismissed':
        logger.debug('❓ [Relay] Question dismissed:', data.questionId)
        this.emit('qa:question-dismissed', data)
        break

      case 'qa:mode-changed':
        logger.debug('❓ [Relay] Q&A mode changed:', data.mode)
        this.emit('qa:mode-changed', data)
        break

      case 'qa:sync':
        logger.debug('❓ [Relay] Q&A sync received')
        this.emit('qa:sync', data)
        break

      case 'qa:request-sync':
        logger.debug('❓ [Relay] Q&A sync requested')
        this.emit('qa:request-sync', data)
        break

      case 'connected':
        logger.debug('🔄 [Relay] WebSocket connection acknowledged')
        break

      case 'error':
        console.error('🔄 [Relay] Server error:', data.message)
        this.emit('error', data.message)
        break

      default:
        logger.debug('🔄 [Relay] Unknown message type:', data.type)
    }
  }

  /**
   * Create WebRTC peer connection to a specific peer
   * @param {string} peerId - The ID of the remote peer
   * @param {boolean} initiator - Whether we should create and send an offer
   */
  createPeerConnection(peerId, initiator = false) {
    logger.debug('🔗 [Relay] Creating peer connection to:', peerId, `(initiator: ${initiator})`)

    // Don't create duplicate connections
    if (this.peerConnections.has(peerId)) {
      logger.debug('⚠️ [Relay] Peer connection already exists for:', peerId)
      return
    }

    const pc = new RTCPeerConnection(this.iceServers)
    this.peerConnections.set(peerId, pc)

    // CRITICAL FIX: Always add local stream tracks if available
    // This ensures the remote peer receives our media from the start
    if (this.localStream) {
      logger.debug('🔗 [Relay] Adding local stream tracks for peer:', peerId)
      logger.debug('   Local stream details:', {
        id: this.localStream.id,
        active: this.localStream.active,
        videoTracks: this.localStream.getVideoTracks().length,
        audioTracks: this.localStream.getAudioTracks().length
      })

      // Add each track with explicit stream association
      this.localStream.getTracks().forEach(track => {
        logger.debug(`   Adding track: ${track.kind}, enabled: ${track.enabled}, readyState: ${track.readyState}, muted: ${track.muted}`)
        // Ensure track is enabled before adding
        if (!track.enabled) {
          console.warn(`   ⚠️ Track ${track.kind} is disabled - enabling it`)
          track.enabled = true
        }
        // Ensure track is not muted at the source
        if (track.muted) {
          console.warn(`   ⚠️ Track ${track.kind} is muted at source - this may affect transmission`)
        }
        // Check track readyState
        if (track.readyState === 'ended') {
          console.error(`   ❌ CRITICAL: Track ${track.kind} has ended! Cannot add ended track to peer connection`)
          return // Skip this track
        }
        pc.addTrack(track, this.localStream)
      })

      logger.debug(`✅ [Relay] Added ${this.localStream.getTracks().filter(t => t.readyState !== 'ended').length} tracks to peer connection for ${peerId}`)
    } else {
      console.error('❌ [Relay] CRITICAL: No local stream available when creating peer connection for:', peerId)
      console.error('   Remote peer will NOT receive our media!')
      console.error('   This should not happen - local stream must be set before connecting')
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        logger.debug('📤 [Relay] Sending ICE candidate to peer:', peerId)
        this.socket.send(JSON.stringify({
          type: 'relay:ice-candidate',
          targetPeerId: peerId,
          candidate: event.candidate
        }))
      }
    }

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      logger.debug('🎥 [Relay] Received remote track from peer:', peerId, event.track.kind)
      const stream = event.streams[0]

      if (!stream) {
        console.error('❌ [Relay] No stream in ontrack event for peer:', peerId)
        console.error('   Creating a new stream for the track')
        // Fallback: create a stream with the track
        const newStream = new MediaStream([event.track])
        this.remoteStreams.set(peerId, newStream)
        const peerName = this.peerNames.get(peerId) || `User_${peerId.substring(0, 4)}`
        const deviceType = this.peerDevices.get(peerId) || 'Устройство'
        this.emit('stream', peerId, newStream, peerName, deviceType)
        return
      }

      logger.debug('🎥 [Relay] Stream details:', {
        id: stream.id,
        active: stream.active,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      })

      // Ensure tracks are enabled and monitor their state
      stream.getTracks().forEach(track => {
        logger.debug(`   Track ${track.kind}: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`)

        if (track.readyState === 'ended') {
          console.warn(`   ⚠️ Track ${track.kind} has ended for peer ${peerId}`)
        }

        // CRITICAL: Check if track is enabled
        // The remote track's enabled state is controlled by the sender,
        // but we should log if it's disabled to help with debugging
        if (!track.enabled) {
          console.error(`   ❌ CRITICAL: Track ${track.kind} is DISABLED for peer ${peerId}!`)
          console.error(`      This means the sender has their ${track.kind === 'video' ? 'camera' : 'microphone'} turned off`)
        }

        if (track.muted) {
          console.warn(`   ⚠️ Track ${track.kind} is muted for peer ${peerId}`)
          console.warn(`      This is different from 'enabled' - muted means temporary playback pause`)
        }

        // Add event listeners to track state changes
        track.onended = () => {
          console.warn(`   ⚠️ Track ${track.kind} ended for peer ${peerId}`)
        }
        track.onmute = () => {
          console.warn(`   ⚠️ Track ${track.kind} muted for peer ${peerId}`)
        }
        track.onunmute = () => {
          logger.debug(`   ✅ Track ${track.kind} unmuted for peer ${peerId}`)
        }

        // For video tracks, monitor dimensions to detect placeholder/dummy video
        if (track.kind === 'video') {
          // Check video dimensions after a short delay
          setTimeout(() => {
            const settings = track.getSettings()
            if (settings.width && settings.height) {
              if (settings.width <= 2 || settings.height <= 2) {
                console.error(`   ❌ CRITICAL: Video track has ${settings.width}x${settings.height} dimensions for peer ${peerId}!`)
                console.error(`      This indicates the remote peer is not sending actual video`)
                console.error(`      Possible causes:`)
                console.error(`        1. Remote peer's camera is disabled or not working`)
                console.error(`        2. Remote peer denied camera permissions`)
                console.error(`        3. Remote peer's video track failed to initialize`)
                console.error(`      Suggestion: Ask the remote user to check their camera settings`)
              } else {
                logger.debug(`   ✅ Video dimensions: ${settings.width}x${settings.height} for peer ${peerId}`)
              }
            }
          }, 1000)
        }
      })

      // Check if we already have a stream for this peer
      const existingStream = this.remoteStreams.get(peerId)
      if (existingStream && existingStream.id === stream.id) {
        logger.debug('🔄 [Relay] Stream already exists for peer, updating tracks:', peerId)
        // Stream already tracked, just log
      } else {
        // Store the stream
        this.remoteStreams.set(peerId, stream)
        logger.debug('✅ [Relay] Stored remote stream for peer:', peerId)
      }

      const peerName = this.peerNames.get(peerId) || `User_${peerId.substring(0, 4)}`
      const deviceType = this.peerDevices.get(peerId) || 'Устройство'

      logger.debug('🎬 [Relay] Emitting stream event for:', peerId, peerName, deviceType)

      // CRITICAL FIX: Emit stream event each time we receive a track
      // This ensures the UI gets all tracks (video + audio may arrive separately)
      this.emit('stream', peerId, stream, peerName, deviceType)
    }

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      logger.debug('🔗 [Relay] Connection state with', peerId, ':', pc.connectionState)
      if (pc.connectionState === 'connected') {
        logger.debug('✅ [Relay] Connected to peer:', peerId)
        // Clear any reconnection attempts
        if (pc._reconnectAttempts) {
          delete pc._reconnectAttempts
        }
      } else if (pc.connectionState === 'failed') {
        console.error('❌ [Relay] Connection to peer failed:', peerId)
        // Attempt ICE restart before giving up
        this.attemptIceRestart(peerId).catch(err => {
          console.error('❌ [Relay] ICE restart failed for peer:', peerId, err)
          // Only close connection after restart attempt failed
          setTimeout(() => {
            if (pc.connectionState === 'failed') {
              this.closePeerConnection(peerId)
            }
          }, 5000)
        })
      } else if (pc.connectionState === 'disconnected') {
        console.warn('⚠️ [Relay] Disconnected from peer:', peerId)
        // Wait a bit to see if it reconnects automatically
        setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            console.warn('⚠️ [Relay] Connection still disconnected/failed, attempting restart for peer:', peerId)
            this.attemptIceRestart(peerId).catch(err => {
              console.error('❌ [Relay] Failed to restart connection:', err)
            })
          }
        }, 3000)
      }
    }

    pc.oniceconnectionstatechange = () => {
      logger.debug('🧊 [Relay] ICE connection state with', peerId, ':', pc.iceConnectionState)
    }

    // Handle negotiation needed
    pc.onnegotiationneeded = async () => {
      try {
        logger.debug('🔄 [Relay] Negotiation needed for peer:', peerId, 'initiator:', initiator, 'signalingState:', pc.signalingState)
        // Only create offer if we're not already making one and connection is stable
        if (!this.makingOffer.get(peerId) && pc.signalingState === 'stable') {
          await this.createOfferForPeer(peerId)
        } else {
          logger.debug('⏸️ [Relay] Skipping negotiation - already in progress or unstable state:', pc.signalingState)
        }
      } catch (error) {
        console.error('❌ [Relay] Negotiation failed for peer:', peerId, error)
      }
    }

    // If we're the initiator, create and send offer
    if (initiator) {
      this.createOfferForPeer(peerId)
    }
  }

  /**
   * Create and send offer to a specific peer
   */
  async createOfferForPeer(peerId) {
    const pc = this.peerConnections.get(peerId)
    if (!pc) {
      console.error('❌ [Relay] No peer connection for:', peerId)
      return
    }

    // Avoid creating multiple simultaneous offers
    if (this.makingOffer.get(peerId)) {
      logger.debug('⏸️ [Relay] Already making offer to peer:', peerId)
      return
    }

    // Only create offer if in stable state or we have local offer
    if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
      logger.debug('⏸️ [Relay] Peer connection not in stable state:', peerId, pc.signalingState)
      return
    }

    try {
      this.makingOffer.set(peerId, true)

      // Create offer with explicit instructions to receive audio and video
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      })

      logger.debug('📝 [Relay] Created offer for peer:', peerId)
      logger.debug('   Offer SDP includes:', {
        audioTransceivers: pc.getTransceivers().filter(t => t.mid && t.receiver.track.kind === 'audio').length,
        videoTransceivers: pc.getTransceivers().filter(t => t.mid && t.receiver.track.kind === 'video').length,
        totalTransceivers: pc.getTransceivers().length,
        senders: pc.getSenders().length,
        receivers: pc.getReceivers().length
      })

      await pc.setLocalDescription(offer)

      logger.debug('📤 [Relay] Sending offer to peer:', peerId)
      this.socket.send(JSON.stringify({
        type: 'relay:offer',
        targetPeerId: peerId,
        offer: offer
      }))
    } catch (error) {
      console.error('❌ [Relay] Failed to create offer for peer:', peerId, error)
      this.emit('error', `Failed to create offer for peer ${peerId}`)
    } finally {
      this.makingOffer.set(peerId, false)
    }
  }

  /**
   * Handle offer from a specific peer
   */
  async handleOffer(fromPeerId, offer) {
    let pc = this.peerConnections.get(fromPeerId)

    // Create peer connection if it doesn't exist
    if (!pc) {
      logger.debug('🔗 [Relay] Creating peer connection for incoming offer from:', fromPeerId)
      this.createPeerConnection(fromPeerId, false)
      pc = this.peerConnections.get(fromPeerId)
    }

    if (!pc) {
      console.error('❌ [Relay] Failed to create peer connection for:', fromPeerId)
      return
    }

    try {
      logger.debug('📥 [Relay] Handling offer from peer:', fromPeerId, 'Current signaling state:', pc.signalingState)

      // Perfect negotiation pattern: handle collision detection
      const isStable = pc.signalingState === 'stable' ||
                      (pc.signalingState === 'have-local-offer' && this.makingOffer.get(fromPeerId))

      if (!isStable) {
        console.warn('⚠️ [Relay] Collision detected with peer:', fromPeerId, 'state:', pc.signalingState)

        // Implement polite/impolite peer resolution
        // The peer with lower ID is "polite" and backs down
        const isPolite = this.peerId < fromPeerId

        if (isPolite) {
          console.warn('⚠️ [Relay] We are polite peer - rolling back our offer')
          // Rollback if we're not stable
          await pc.setLocalDescription({ type: 'rollback' })
          this.makingOffer.set(fromPeerId, false)
        } else {
          console.warn('⚠️ [Relay] We are impolite peer - ignoring incoming offer during collision')
          // Ignore the incoming offer, remote peer will rollback
          return
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      logger.debug('✅ [Relay] Remote description set, signaling state now:', pc.signalingState)

      // Process any pending ICE candidates
      const pending = this.pendingCandidates.get(fromPeerId) || []
      if (pending.length > 0) {
        logger.debug(`🧊 [Relay] Processing ${pending.length} pending ICE candidates`)
      }
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
      this.pendingCandidates.delete(fromPeerId)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      logger.debug('📝 [Relay] Created answer for peer:', fromPeerId, 'Signaling state:', pc.signalingState)
      logger.debug('   Answer SDP includes:', {
        audioTransceivers: pc.getTransceivers().filter(t => t.mid && t.receiver.track.kind === 'audio').length,
        videoTransceivers: pc.getTransceivers().filter(t => t.mid && t.receiver.track.kind === 'video').length,
        totalTransceivers: pc.getTransceivers().length,
        senders: pc.getSenders().length,
        receivers: pc.getReceivers().length
      })

      logger.debug('📤 [Relay] Sending answer to peer:', fromPeerId)
      this.socket.send(JSON.stringify({
        type: 'relay:answer',
        targetPeerId: fromPeerId,
        answer: answer
      }))
    } catch (error) {
      console.error('❌ [Relay] Failed to handle offer from peer:', fromPeerId, error)
      console.error('   Signaling state was:', pc.signalingState)
      console.error('   Connection state:', pc.connectionState)
      this.emit('error', `Failed to handle offer from peer ${fromPeerId}`)
    }
  }

  /**
   * Handle answer from a specific peer
   */
  async handleAnswer(fromPeerId, answer) {
    const pc = this.peerConnections.get(fromPeerId)
    if (!pc) {
      console.error('❌ [Relay] No peer connection for answer from:', fromPeerId)
      return
    }

    try {
      // CRITICAL FIX: Check signaling state before setting remote description
      // Answer can only be set when we're in "have-local-offer" state
      if (pc.signalingState !== 'have-local-offer') {
        console.warn('⚠️ [Relay] Received answer from peer', fromPeerId, 'but signaling state is:', pc.signalingState)

        // If we're in stable state, it means we didn't send an offer
        // This can happen due to race conditions or out-of-order messages
        if (pc.signalingState === 'stable') {
          console.warn('⚠️ [Relay] Peer connection is in stable state - ignoring unexpected answer')
          console.warn('   This may indicate a signaling race condition')
          console.warn('   The connection might still work if the peer sends another offer')
          return
        }

        // For other states, try to rollback to stable before giving up
        console.warn('⚠️ [Relay] Attempting to rollback to stable state before processing answer')
        try {
          await pc.setLocalDescription({ type: 'rollback' })
          logger.debug('✅ [Relay] Rolled back to stable state')
        } catch (rollbackError) {
          console.error('❌ [Relay] Rollback failed:', rollbackError)
          // If rollback fails, we can't process this answer
          return
        }

        // After rollback, we're in stable state, so we still can't accept this answer
        console.warn('⚠️ [Relay] After rollback, cannot process answer - ignoring')
        return
      }

      await pc.setRemoteDescription(new RTCSessionDescription(answer))

      // Process any pending ICE candidates
      const pending = this.pendingCandidates.get(fromPeerId) || []
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
      this.pendingCandidates.delete(fromPeerId)

      logger.debug('✅ [Relay] Answer processed from peer:', fromPeerId)
    } catch (error) {
      console.error('❌ [Relay] Failed to handle answer from peer:', fromPeerId, error)
      console.error('   Signaling state was:', pc.signalingState)
      console.error('   Connection state:', pc.connectionState)
      console.error('   ICE connection state:', pc.iceConnectionState)
      this.emit('error', `Failed to handle answer from peer ${fromPeerId}`)
    }
  }

  /**
   * Handle ICE candidate from a specific peer
   */
  async handleIceCandidate(fromPeerId, candidate) {
    const pc = this.peerConnections.get(fromPeerId)
    if (!pc) {
      console.warn('⚠️ [Relay] No peer connection for ICE candidate from:', fromPeerId)
      return
    }

    try {
      // If remote description is not set yet, queue the candidate
      if (!pc.remoteDescription || !pc.remoteDescription.type) {
        logger.debug('⏳ [Relay] Queuing ICE candidate from peer:', fromPeerId)
        if (!this.pendingCandidates.has(fromPeerId)) {
          this.pendingCandidates.set(fromPeerId, [])
        }
        this.pendingCandidates.get(fromPeerId).push(candidate)
        return
      }

      await pc.addIceCandidate(new RTCIceCandidate(candidate))
      logger.debug('✅ [Relay] ICE candidate added from peer:', fromPeerId)
    } catch (error) {
      console.error('❌ [Relay] Failed to add ICE candidate from peer:', fromPeerId, error)
    }
  }

  /**
   * Close peer connection to a specific peer
   */
  closePeerConnection(peerId) {
    const pc = this.peerConnections.get(peerId)
    if (pc) {
      logger.debug('🔌 [Relay] Closing peer connection to:', peerId)
      pc.close()
      this.peerConnections.delete(peerId)
    }
    this.makingOffer.delete(peerId)
    this.pendingCandidates.delete(peerId)
  }

  /**
   * Set local media stream
   */
  setLocalStream(stream) {
    logger.debug('📹 [Relay] Setting local stream')
    logger.debug('   Stream ID:', stream?.id || 'null')
    logger.debug('   Video tracks:', stream?.getVideoTracks().length || 0)
    logger.debug('   Audio tracks:', stream?.getAudioTracks().length || 0)

    this.localStream = stream

    // Update stream on all peer connections if they exist
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]

      this.peerConnections.forEach((pc, peerId) => {
        const senders = pc.getSenders()

        // Flag to track if we need to renegotiate
        let needsRenegotiation = false

        // Replace video track
        const videoSender = senders.find(s => s.track?.kind === 'video')
        if (videoSender && videoTrack) {
          videoSender.replaceTrack(videoTrack)
            .then(() => logger.debug(`✅ [Relay] Replaced video track for peer ${peerId}`))
            .catch(err => console.error(`❌ [Relay] Failed to replace video track for peer ${peerId}:`, err))
        } else if (videoTrack && !videoSender) {
          pc.addTrack(videoTrack, stream)
          logger.debug(`➕ [Relay] Added video track for peer ${peerId}`)
          needsRenegotiation = true
        }

        // Replace audio track
        const audioSender = senders.find(s => s.track?.kind === 'audio')
        if (audioSender && audioTrack) {
          audioSender.replaceTrack(audioTrack)
            .then(() => logger.debug(`✅ [Relay] Replaced audio track for peer ${peerId}`))
            .catch(err => console.error(`❌ [Relay] Failed to replace audio track for peer ${peerId}:`, err))
        } else if (audioTrack && !audioSender) {
          pc.addTrack(audioTrack, stream)
          logger.debug(`➕ [Relay] Added audio track for peer ${peerId}`)
          needsRenegotiation = true
        }

        // CRITICAL FIX: If we added new tracks, trigger renegotiation
        // This ensures the remote peer receives our media
        if (needsRenegotiation) {
          logger.debug(`🔄 [Relay] Triggering renegotiation for peer ${peerId} after adding tracks`)
          // The onnegotiationneeded event will fire automatically due to addTrack
          // But we'll also explicitly create a new offer to be sure
          this.createOfferForPeer(peerId).catch(err => {
            console.error(`❌ [Relay] Failed to renegotiate with peer ${peerId}:`, err)
          })
        }
      })
    }
  }

  /**
   * Broadcast screen share (not implemented in relay mode yet)
   */
  broadcastScreenShare(/* screenStream */) {
    logger.debug('🔄 [Relay] Screen share broadcast not yet implemented in relay mode')
    // TODO: Implement screen share in relay mode
  }

  /**
   * Send chat message to all participants in the room
   */
  sendChatMessage(message) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('❌ [Relay] Cannot send chat message - WebSocket not connected')
      return
    }

    if (!this.connected || !this.roomName) {
      console.error('❌ [Relay] Cannot send chat message - not in a room')
      return
    }

    logger.debug('💬 [Relay] Sending chat message to room:', this.roomName)

    this.socket.send(JSON.stringify({
      type: 'relay:chat-message',
      roomName: this.roomName,
      peerId: this.peerId,
      peerName: this.userName,
      message: message
    }))
  }

  /**
   * Send a reaction emoji to all peers in the room
   * @param {string} emoji - Emoji reaction to send
   */
  sendReaction(emoji) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('❌ [Relay] Cannot send reaction - WebSocket not connected')
      return
    }

    if (!this.connected || !this.roomName) {
      console.error('❌ [Relay] Cannot send reaction - not in a room')
      return
    }

    logger.debug('😊 [Relay] Sending reaction to room:', this.roomName, emoji)

    this.socket.send(JSON.stringify({
      type: 'relay:reaction',
      roomName: this.roomName,
      peerId: this.peerId,
      peerName: this.userName,
      emoji: emoji,
      timestamp: Date.now()
    }))
  }

  /**
   * Send raise hand event to all peers in the room
   * @param {boolean} raised - Whether hand is raised or lowered
   */
  sendRaiseHand(raised) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('❌ [Relay] Cannot send raise hand - WebSocket not connected')
      return
    }

    if (!this.connected || !this.roomName) {
      console.error('❌ [Relay] Cannot send raise hand - not in a room')
      return
    }

    logger.debug('✋ [Relay] Sending raise hand to room:', this.roomName, raised)

    this.socket.send(JSON.stringify({
      type: 'relay:raise-hand',
      roomName: this.roomName,
      peerId: this.peerId,
      peerName: this.userName,
      raised: raised,
      timestamp: Date.now()
    }))
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
   * Disconnect from the relay room
   */
  disconnect() {
    logger.debug('🔄 [Relay] Disconnecting')

    // Notify server we're leaving
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'relay:leave-room',
        roomName: this.roomName,
        peerId: this.peerId
      }))
    }

    // Close all peer connections
    this.peerConnections.forEach((pc, peerId) => {
      logger.debug('🔌 [Relay] Closing peer connection to:', peerId)
      pc.close()
    })
    this.peerConnections.clear()

    // Close WebSocket
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    // Clear data
    this.remoteStreams.clear()
    this.peerNames.clear()
    this.peerDevices.clear()
    this.makingOffer.clear()
    this.pendingCandidates.clear()
    this.connected = false
  }

  /**
   * Attempt ICE restart for a failed peer connection
   * This creates a new offer with iceRestart: true
   */
  async attemptIceRestart(peerId) {
    const pc = this.peerConnections.get(peerId)
    if (!pc) {
      console.warn('⚠️ [Relay] No peer connection found for ICE restart:', peerId)
      return
    }

    // Track reconnection attempts
    if (!pc._reconnectAttempts) {
      pc._reconnectAttempts = 0
    }

    pc._reconnectAttempts++

    // Give up after 3 attempts
    if (pc._reconnectAttempts > 3) {
      console.error('❌ [Relay] Too many reconnection attempts for peer:', peerId)
      this.closePeerConnection(peerId)
      return
    }

    logger.debug(`🔄 [Relay] Attempting ICE restart for peer ${peerId} (attempt ${pc._reconnectAttempts}/3)`)

    try {
      // Create offer with iceRestart flag
      const offer = await pc.createOffer({ iceRestart: true })
      await pc.setLocalDescription(offer)

      logger.debug('📤 [Relay] Sending ICE restart offer to peer:', peerId)
      this.socket.send(JSON.stringify({
        type: 'relay:offer',
        targetPeerId: peerId,
        offer: offer
      }))

      logger.debug('✅ [Relay] ICE restart initiated for peer:', peerId)
    } catch (error) {
      console.error('❌ [Relay] Failed to create ICE restart offer for peer:', peerId, error)
      throw error
    }
  }

  /**
   * Verify and fix peer connections (ensure all have proper tracks)
   * Call this periodically or when issues are detected
   */
  async verifyAndFixConnections() {
    logger.debug('🔍 [Relay] Verifying all peer connections...')

    if (!this.localStream) {
      console.warn('⚠️ [Relay] No local stream - cannot verify connections')
      return
    }

    const localVideoTrack = this.localStream.getVideoTracks()[0]
    const localAudioTrack = this.localStream.getAudioTracks()[0]

    for (const [peerId, pc] of this.peerConnections.entries()) {
      if (pc.connectionState === 'connected' || pc.connectionState === 'connecting') {
        const senders = pc.getSenders()

        // Check if we're sending video
        const videoSender = senders.find(s => s.track?.kind === 'video')
        if (localVideoTrack && !videoSender) {
          console.warn(`⚠️ [Relay] Peer ${peerId} is missing video sender - adding track`)
          pc.addTrack(localVideoTrack, this.localStream)
          // Trigger renegotiation
          await this.createOfferForPeer(peerId)
        }

        // Check if we're sending audio
        const audioSender = senders.find(s => s.track?.kind === 'audio')
        if (localAudioTrack && !audioSender) {
          console.warn(`⚠️ [Relay] Peer ${peerId} is missing audio sender - adding track`)
          pc.addTrack(localAudioTrack, this.localStream)
          // Trigger renegotiation
          await this.createOfferForPeer(peerId)
        }

        // Check if remote tracks are being received
        const receivers = pc.getReceivers()
        const hasVideoReceiver = receivers.some(r => r.track?.kind === 'video')
        const hasAudioReceiver = receivers.some(r => r.track?.kind === 'audio')

        if (!hasVideoReceiver || !hasAudioReceiver) {
          console.warn(`⚠️ [Relay] Peer ${peerId} receivers: video=${hasVideoReceiver}, audio=${hasAudioReceiver}`)
        }
      }
    }

    logger.debug('✅ [Relay] Connection verification complete')
  }

  /**
   * Debug helper: Log detailed connection state
   */
  logConnectionStates() {
    logger.debug('🔍 [Relay] Current connection state:')
    logger.debug(`   Connected to server: ${this.connected}`)
    logger.debug(`   Local stream: ${this.localStream ? 'Available' : 'Not set'}`)
    logger.debug(`   Remote streams: ${this.remoteStreams.size}`)
    logger.debug(`   Peer connections: ${this.peerConnections.size}`)

    if (this.peerConnections.size > 0) {
      this.peerConnections.forEach((pc, peerId) => {
        logger.debug(`\n   🔗 Peer: ${peerId} (${this.peerNames.get(peerId) || 'unknown'})`)
        logger.debug(`      Connection state: ${pc.connectionState}`)
        logger.debug(`      ICE connection state: ${pc.iceConnectionState}`)
        logger.debug(`      Signaling state: ${pc.signalingState}`)

        const senders = pc.getSenders()
        logger.debug(`      Senders (${senders.length}):`)
        senders.forEach((sender, idx) => {
          logger.debug(`        ${idx}: ${sender.track?.kind || 'null'} - enabled: ${sender.track?.enabled}`)
        })

        const receivers = pc.getReceivers()
        logger.debug(`      Receivers (${receivers.length}):`)
        receivers.forEach((receiver, idx) => {
          logger.debug(`        ${idx}: ${receiver.track?.kind || 'null'} - enabled: ${receiver.track?.enabled}`)
        })
      })
    } else {
      logger.debug(`   ❌ No peer connections`)
    }
  }

  /**
   * Waiting Room Control Methods (Issue #2349)
   */

  /**
   * Enable waiting room for this conference (host only)
   */
  enableWaitingRoom() {
    if (!this.socket || !this.connected) {
      console.error('🚪 [Relay] Cannot enable waiting room: not connected')
      return
    }

    logger.debug('🚪 [Relay] Enabling waiting room')
    this.socket.send(JSON.stringify({
      type: 'waitingroom:enable',
      roomName: this.roomName,
      hostPeerId: this.peerId
    }))
  }

  /**
   * Disable waiting room for this conference (host only)
   */
  disableWaitingRoom() {
    if (!this.socket || !this.connected) {
      console.error('🚪 [Relay] Cannot disable waiting room: not connected')
      return
    }

    logger.debug('🚪 [Relay] Disabling waiting room')
    this.socket.send(JSON.stringify({
      type: 'waitingroom:disable',
      roomName: this.roomName,
      hostPeerId: this.peerId
    }))
  }

  /**
   * Request entry to a conference (participant)
   * @param {string} email - Optional email for auto-admit rules
   */
  requestEntry(email = null) {
    if (!this.socket || !this.connected) {
      console.error('🚪 [Relay] Cannot request entry: not connected')
      return
    }

    logger.debug('🚪 [Relay] Requesting entry to conference')
    this.socket.send(JSON.stringify({
      type: 'waitingroom:request-entry',
      roomName: this.roomName,
      peerId: this.peerId,
      peerName: this.userName,
      email,
      deviceType: this.deviceType
    }))
  }

  /**
   * Admit a participant from waiting room (host only)
   * @param {string} targetPeerId - The peer ID to admit
   */
  admitParticipant(targetPeerId) {
    if (!this.socket || !this.connected) {
      console.error('🚪 [Relay] Cannot admit participant: not connected')
      return
    }

    logger.debug('🚪 [Relay] Admitting participant:', targetPeerId)
    this.socket.send(JSON.stringify({
      type: 'waitingroom:admit',
      roomName: this.roomName,
      hostPeerId: this.peerId,
      targetPeerId
    }))
  }

  /**
   * Admit all participants from waiting room (host only)
   */
  admitAllParticipants() {
    if (!this.socket || !this.connected) {
      console.error('🚪 [Relay] Cannot admit all participants: not connected')
      return
    }

    logger.debug('🚪 [Relay] Admitting all participants')
    this.socket.send(JSON.stringify({
      type: 'waitingroom:admit-all',
      roomName: this.roomName,
      hostPeerId: this.peerId
    }))
  }

  /**
   * Deny a participant from waiting room (host only)
   * @param {string} targetPeerId - The peer ID to deny
   * @param {string} reason - Optional reason for denial
   */
  denyParticipant(targetPeerId, reason = null) {
    if (!this.socket || !this.connected) {
      console.error('🚪 [Relay] Cannot deny participant: not connected')
      return
    }

    logger.debug('🚪 [Relay] Denying participant:', targetPeerId)
    this.socket.send(JSON.stringify({
      type: 'waitingroom:deny',
      roomName: this.roomName,
      hostPeerId: this.peerId,
      targetPeerId,
      reason
    }))
  }

  /**
   * Send a message to waiting room participants (host only)
   * @param {string} message - The message to send
   * @param {string} targetPeerId - Optional specific participant to send to
   */
  sendWaitingRoomMessage(message, targetPeerId = null) {
    if (!this.socket || !this.connected) {
      console.error('🚪 [Relay] Cannot send waiting room message: not connected')
      return
    }

    logger.debug('🚪 [Relay] Sending waiting room message')
    this.socket.send(JSON.stringify({
      type: 'waitingroom:send-message',
      roomName: this.roomName,
      hostPeerId: this.peerId,
      targetPeerId,
      message
    }))
  }

  /**
   * Update auto-admit rules for waiting room (host only)
   * @param {Object} autoAdmitRules - Rules for auto-admitting participants
   * @param {Array<string>} autoAdmitRules.allowedEmails - List of allowed email addresses
   * @param {Array<string>} autoAdmitRules.allowedDomains - List of allowed email domains
   */
  updateAutoAdmitRules(autoAdmitRules) {
    if (!this.socket || !this.connected) {
      console.error('🚪 [Relay] Cannot update auto-admit rules: not connected')
      return
    }

    logger.debug('🚪 [Relay] Updating auto-admit rules')
    this.socket.send(JSON.stringify({
      type: 'waitingroom:update-rules',
      roomName: this.roomName,
      hostPeerId: this.peerId,
      autoAdmitRules
    }))
  }
}
