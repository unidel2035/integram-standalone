import { logger } from '@/utils/logger'
import { getOrchestratorUrl } from '@/utils/apiConfig'

/**
 * Streaming Service - Handles live streaming to platforms (YouTube, Facebook, Twitch)
 * Issue #2360 - Webinar mode и live streaming
 *
 * This service provides the frontend interface for streaming configuration.
 * Actual RTMP encoding and streaming happens on the backend.
 */

export const STREAMING_PLATFORM = {
  YOUTUBE: 'youtube',
  FACEBOOK: 'facebook',
  TWITCH: 'twitch',
  CUSTOM_RTMP: 'custom_rtmp'
}

export const STREAMING_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  LIVE: 'live',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  ERROR: 'error'
}

export const STREAMING_QUALITY = {
  LOW: { width: 640, height: 360, bitrate: 500, fps: 24 },
  MEDIUM: { width: 1280, height: 720, bitrate: 2500, fps: 30 },
  HIGH: { width: 1920, height: 1080, bitrate: 4500, fps: 30 },
  ULTRA: { width: 1920, height: 1080, bitrate: 6000, fps: 60 }
}

export default class StreamingService {
  constructor() {
    this.streams = new Map() // streamId -> stream object
    this.eventHandlers = new Map()

    // Backend API base URL (from env or default to orchestrator)
    this.apiBaseUrl = getOrchestratorUrl()

    logger.debug('📡 [Streaming] Service initialized')
  }

  /**
   * Create a new stream configuration
   */
  createStream(config) {
    const streamId = this.generateStreamId()

    const stream = {
      id: streamId,
      platform: config.platform,
      title: config.title || 'Live Stream',
      description: config.description || '',

      // Platform-specific settings
      rtmpUrl: config.rtmpUrl || null,
      streamKey: config.streamKey || null,

      // YouTube specific
      youtubeStreamKey: config.youtubeStreamKey || null,
      youtubeLiveId: config.youtubeLiveId || null,

      // Facebook specific
      facebookStreamKey: config.facebookStreamKey || null,
      facebookVideoId: config.facebookVideoId || null,

      // Twitch specific
      twitchStreamKey: config.twitchStreamKey || null,
      twitchChannel: config.twitchChannel || null,

      // Stream quality settings
      quality: config.quality || STREAMING_QUALITY.MEDIUM,

      // Branding
      branding: {
        enabled: config.branding?.enabled || false,
        logoUrl: config.branding?.logoUrl || null,
        logoPosition: config.branding?.logoPosition || 'top-right',
        logoSize: config.branding?.logoSize || { width: 100, height: 100 },
        overlayText: config.branding?.overlayText || null,
        overlayPosition: config.branding?.overlayPosition || 'bottom-left'
      },

      // Status
      status: STREAMING_STATUS.IDLE,
      startedAt: null,
      stoppedAt: null,

      // Analytics
      analytics: {
        viewerCount: 0,
        peakViewers: 0,
        duration: 0,
        bitrateSent: 0,
        framesSent: 0,
        errors: []
      }
    }

    this.streams.set(streamId, stream)
    logger.debug('📡 [Streaming] Stream created:', streamId, config.platform)

    return stream
  }

  /**
   * Start streaming to platform
   * Note: This calls the backend API which handles actual RTMP encoding
   */
  async startStream(streamId, mediaStream) {
    const stream = this.streams.get(streamId)
    if (!stream) {
      throw new Error('Stream not found')
    }

    if (stream.status === STREAMING_STATUS.LIVE) {
      throw new Error('Stream is already live')
    }

    try {
      stream.status = STREAMING_STATUS.CONNECTING
      this.emit('stream:connecting', stream)

      logger.debug('📡 [Streaming] Starting stream:', streamId)

      // Get RTMP URL for the platform
      const rtmpConfig = this.getRTMPConfig(stream)

      // For now, this is a placeholder that documents requirements
      // TODO: Connect to backend API when available
      // Backend will handle:
      // 1. MediaStream -> RTMP encoding (using FFmpeg)
      // 2. Connection to streaming platform
      // 3. Bitrate adaptation
      // 4. Error recovery

      // Simulate connection (replace with actual backend call)
      await this.simulateBackendConnection(rtmpConfig, mediaStream)

      stream.status = STREAMING_STATUS.LIVE
      stream.startedAt = new Date().toISOString()

      logger.debug('📡 [Streaming] Stream is live:', streamId)
      this.emit('stream:live', stream)

      // Start analytics polling
      this.startAnalyticsPolling(streamId)

      return stream
    } catch (error) {
      stream.status = STREAMING_STATUS.ERROR
      stream.analytics.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message
      })

      logger.error('📡 [Streaming] Failed to start stream:', error)
      this.emit('stream:error', { stream, error })

      throw error
    }
  }

  /**
   * Stop streaming
   */
  async stopStream(streamId) {
    const stream = this.streams.get(streamId)
    if (!stream) {
      throw new Error('Stream not found')
    }

    if (stream.status !== STREAMING_STATUS.LIVE) {
      throw new Error('Stream is not live')
    }

    try {
      logger.debug('📡 [Streaming] Stopping stream:', streamId)

      // TODO: Call backend API to stop streaming
      await this.simulateBackendDisconnection(streamId)

      stream.status = STREAMING_STATUS.STOPPED
      stream.stoppedAt = new Date().toISOString()

      // Calculate duration
      if (stream.startedAt) {
        const start = new Date(stream.startedAt)
        const stop = new Date(stream.stoppedAt)
        stream.analytics.duration = (stop - start) / 1000 / 60 // minutes
      }

      // Stop analytics polling
      this.stopAnalyticsPolling(streamId)

      logger.debug('📡 [Streaming] Stream stopped:', streamId)
      this.emit('stream:stopped', stream)

      return stream
    } catch (error) {
      logger.error('📡 [Streaming] Failed to stop stream:', error)
      this.emit('stream:error', { stream, error })
      throw error
    }
  }

  /**
   * Get RTMP configuration for platform
   */
  getRTMPConfig(stream) {
    let rtmpUrl, streamKey

    switch (stream.platform) {
      case STREAMING_PLATFORM.YOUTUBE:
        rtmpUrl = 'rtmp://a.rtmp.youtube.com/live2'
        streamKey = stream.youtubeStreamKey
        break

      case STREAMING_PLATFORM.FACEBOOK:
        rtmpUrl = 'rtmps://live-api-s.facebook.com:443/rtmp/'
        streamKey = stream.facebookStreamKey
        break

      case STREAMING_PLATFORM.TWITCH:
        rtmpUrl = 'rtmp://live.twitch.tv/app'
        streamKey = stream.twitchStreamKey
        break

      case STREAMING_PLATFORM.CUSTOM_RTMP:
        rtmpUrl = stream.rtmpUrl
        streamKey = stream.streamKey
        break

      default:
        throw new Error(`Unsupported platform: ${stream.platform}`)
    }

    if (!streamKey) {
      throw new Error('Stream key is required')
    }

    return {
      rtmpUrl,
      streamKey,
      quality: stream.quality,
      branding: stream.branding
    }
  }

  /**
   * Simulate backend connection (placeholder for actual implementation)
   * TODO: Replace with actual backend API call
   */
  async simulateBackendConnection(rtmpConfig, mediaStream) {
    // This is a placeholder that documents what the backend should do:
    //
    // 1. Accept MediaStream from frontend
    // 2. Set up FFmpeg to encode the stream:
    //    - Video codec: H.264
    //    - Audio codec: AAC
    //    - Bitrate: Based on quality settings
    //    - Resolution: Based on quality settings
    //    - FPS: Based on quality settings
    // 3. Add branding overlay if enabled:
    //    - Logo image
    //    - Text overlay
    // 4. Connect to RTMP server
    // 5. Start streaming
    // 6. Handle reconnection on errors
    // 7. Send analytics back to frontend

    return new Promise((resolve, reject) => {
      // Simulate async connection
      setTimeout(() => {
        // Check if backend is available
        // For now, just log the configuration
        logger.debug('📡 [Streaming] RTMP Config:', {
          url: rtmpConfig.rtmpUrl.substring(0, 30) + '...',
          hasStreamKey: !!rtmpConfig.streamKey,
          quality: rtmpConfig.quality
        })

        resolve()
      }, 2000)
    })
  }

  /**
   * Simulate backend disconnection (placeholder)
   * TODO: Replace with actual backend API call
   */
  async simulateBackendDisconnection(streamId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        logger.debug('📡 [Streaming] Disconnected:', streamId)
        resolve()
      }, 1000)
    })
  }

  /**
   * Start polling analytics from backend
   */
  startAnalyticsPolling(streamId) {
    const stream = this.streams.get(streamId)
    if (!stream) return

    // Poll every 5 seconds
    stream._analyticsInterval = setInterval(async () => {
      try {
        // TODO: Fetch analytics from backend
        const analytics = await this.fetchStreamAnalytics(streamId)
        stream.analytics = { ...stream.analytics, ...analytics }
        this.emit('stream:analytics-updated', { streamId, analytics: stream.analytics })
      } catch (error) {
        logger.error('📡 [Streaming] Failed to fetch analytics:', error)
      }
    }, 5000)
  }

  /**
   * Stop polling analytics
   */
  stopAnalyticsPolling(streamId) {
    const stream = this.streams.get(streamId)
    if (stream && stream._analyticsInterval) {
      clearInterval(stream._analyticsInterval)
      delete stream._analyticsInterval
    }
  }

  /**
   * Fetch stream analytics from backend (placeholder)
   * TODO: Implement actual backend API call
   */
  async fetchStreamAnalytics(streamId) {
    // Placeholder - simulates analytics
    return {
      viewerCount: Math.floor(Math.random() * 1000),
      bitrateSent: Math.floor(Math.random() * 5000),
      framesSent: Math.floor(Math.random() * 10000)
    }
  }

  /**
   * Update stream branding
   */
  updateBranding(streamId, branding) {
    const stream = this.streams.get(streamId)
    if (!stream) {
      throw new Error('Stream not found')
    }

    stream.branding = { ...stream.branding, ...branding }
    logger.debug('📡 [Streaming] Branding updated:', streamId)

    // TODO: Send branding update to backend if stream is live
    this.emit('stream:branding-updated', { streamId, branding: stream.branding })
  }

  /**
   * Get stream by ID
   */
  getStream(streamId) {
    return this.streams.get(streamId)
  }

  /**
   * Get all streams
   */
  getAllStreams() {
    return Array.from(this.streams.values())
  }

  /**
   * Delete stream
   */
  deleteStream(streamId) {
    const stream = this.streams.get(streamId)
    if (stream) {
      if (stream.status === STREAMING_STATUS.LIVE) {
        throw new Error('Cannot delete live stream. Stop it first.')
      }

      this.stopAnalyticsPolling(streamId)
      this.streams.delete(streamId)
      logger.debug('📡 [Streaming] Stream deleted:', streamId)
      this.emit('stream:deleted', { streamId })
    }
  }

  /**
   * Generate unique stream ID
   */
  generateStreamId() {
    return `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Validate platform credentials
   * TODO: Implement actual validation with platform APIs
   */
  async validateCredentials(platform, credentials) {
    logger.debug('📡 [Streaming] Validating credentials for:', platform)

    // Placeholder validation
    switch (platform) {
      case STREAMING_PLATFORM.YOUTUBE:
        return !!credentials.youtubeStreamKey
      case STREAMING_PLATFORM.FACEBOOK:
        return !!credentials.facebookStreamKey
      case STREAMING_PLATFORM.TWITCH:
        return !!credentials.twitchStreamKey
      case STREAMING_PLATFORM.CUSTOM_RTMP:
        return !!credentials.rtmpUrl && !!credentials.streamKey
      default:
        return false
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
    // Stop all live streams
    this.streams.forEach((stream, streamId) => {
      if (stream.status === STREAMING_STATUS.LIVE) {
        this.stopStream(streamId).catch(error => {
          logger.error('📡 [Streaming] Error stopping stream during cleanup:', error)
        })
      }
      this.stopAnalyticsPolling(streamId)
    })

    this.streams.clear()
    this.eventHandlers.clear()
    logger.debug('📡 [Streaming] Cleaned up')
  }
}
