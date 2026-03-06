/**
 * WebRTC Metrics Collector
 *
 * Purpose: Collect real-time WebRTC statistics from peer connections
 * for performance testing and monitoring.
 *
 * Metrics collected:
 * - Bandwidth (upload/download)
 * - Video resolution and FPS
 * - Audio/video quality
 * - Packet loss and jitter
 * - Round-trip time (RTT)
 * - Connection state
 *
 * Related Issues: #2402
 */

import { logger } from '@/utils/logger'

export class WebRTCMetricsCollector {
  constructor() {
    this.peerConnections = new Map() // Map<peerId, RTCPeerConnection>
    this.metricsHistory = new Map() // Map<peerId, Array<metrics>>
    this.lastStats = new Map() // Map<peerId, lastStatsSnapshot>
  }

  /**
   * Register a peer connection for metrics collection
   * @param {string} peerId - Peer ID
   * @param {RTCPeerConnection} peerConnection - WebRTC peer connection
   */
  registerPeerConnection(peerId, peerConnection) {
    logger.debug(`📊 [Metrics] Registering peer connection: ${peerId}`)
    this.peerConnections.set(peerId, peerConnection)
    this.metricsHistory.set(peerId, [])
  }

  /**
   * Unregister a peer connection
   * @param {string} peerId - Peer ID
   */
  unregisterPeerConnection(peerId) {
    logger.debug(`📊 [Metrics] Unregistering peer connection: ${peerId}`)
    this.peerConnections.delete(peerId)
    this.lastStats.delete(peerId)
    // Keep history for later analysis
  }

  /**
   * Collect metrics from all registered peer connections
   * @returns {Promise<Object>} Aggregated metrics
   */
  async collectMetrics() {
    const timestamp = Date.now()
    const peerMetrics = []

    for (const [peerId, pc] of this.peerConnections.entries()) {
      try {
        const metrics = await this.collectPeerMetrics(peerId, pc)
        if (metrics) {
          metrics.timestamp = timestamp
          peerMetrics.push(metrics)

          // Store in history
          const history = this.metricsHistory.get(peerId) || []
          history.push(metrics)
          this.metricsHistory.set(peerId, history)
        }
      } catch (error) {
        logger.error(`❌ [Metrics] Failed to collect metrics for peer ${peerId}:`, error)
      }
    }

    // Aggregate metrics across all peers
    return this.aggregateMetrics(peerMetrics)
  }

  /**
   * Collect metrics for a single peer connection
   * @param {string} peerId - Peer ID
   * @param {RTCPeerConnection} pc - Peer connection
   * @returns {Promise<Object>} Peer metrics
   */
  async collectPeerMetrics(peerId, pc) {
    const stats = await pc.getStats()
    const lastStats = this.lastStats.get(peerId)

    const metrics = {
      peerId,
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      inbound: {
        video: null,
        audio: null
      },
      outbound: {
        video: null,
        audio: null
      },
      candidate: null
    }

    stats.forEach(report => {
      if (report.type === 'inbound-rtp') {
        // Inbound RTP stream (receiving)
        const mediaType = report.mediaType || report.kind

        const inboundMetrics = {
          kind: mediaType,
          bytesReceived: report.bytesReceived,
          packetsReceived: report.packetsReceived,
          packetsLost: report.packetsLost || 0,
          jitter: report.jitter || 0,
          framesReceived: report.framesReceived,
          framesDropped: report.framesDropped || 0,
          frameWidth: report.frameWidth,
          frameHeight: report.frameHeight,
          framesPerSecond: report.framesPerSecond
        }

        // Calculate bandwidth from delta
        if (lastStats && lastStats[report.id]) {
          const timeDelta = report.timestamp - lastStats[report.id].timestamp
          const bytesDelta = report.bytesReceived - lastStats[report.id].bytesReceived

          if (timeDelta > 0) {
            // Convert bytes/ms to Mbps
            inboundMetrics.bitrate = (bytesDelta * 8 / timeDelta / 1000).toFixed(2)
          }
        }

        if (mediaType === 'video') {
          metrics.inbound.video = inboundMetrics
        } else if (mediaType === 'audio') {
          metrics.inbound.audio = inboundMetrics
        }
      } else if (report.type === 'outbound-rtp') {
        // Outbound RTP stream (sending)
        const mediaType = report.mediaType || report.kind

        const outboundMetrics = {
          kind: mediaType,
          bytesSent: report.bytesSent,
          packetsSent: report.packetsSent,
          framesEncoded: report.framesEncoded,
          frameWidth: report.frameWidth,
          frameHeight: report.frameHeight,
          framesPerSecond: report.framesPerSecond,
          retransmittedPacketsSent: report.retransmittedPacketsSent || 0
        }

        // Calculate bandwidth from delta
        if (lastStats && lastStats[report.id]) {
          const timeDelta = report.timestamp - lastStats[report.id].timestamp
          const bytesDelta = report.bytesSent - lastStats[report.id].bytesSent

          if (timeDelta > 0) {
            // Convert bytes/ms to Mbps
            outboundMetrics.bitrate = (bytesDelta * 8 / timeDelta / 1000).toFixed(2)
          }
        }

        if (mediaType === 'video') {
          metrics.outbound.video = outboundMetrics
        } else if (mediaType === 'audio') {
          metrics.outbound.audio = outboundMetrics
        }
      } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        // ICE candidate pair (for RTT measurement)
        metrics.candidate = {
          currentRoundTripTime: report.currentRoundTripTime,
          availableOutgoingBitrate: report.availableOutgoingBitrate,
          availableIncomingBitrate: report.availableIncomingBitrate
        }
      }
    })

    // Store current stats for next delta calculation
    const statsSnapshot = {}
    stats.forEach(report => {
      statsSnapshot[report.id] = {
        timestamp: report.timestamp,
        bytesReceived: report.bytesReceived,
        bytesSent: report.bytesSent
      }
    })
    this.lastStats.set(peerId, statsSnapshot)

    return metrics
  }

  /**
   * Aggregate metrics from all peers
   * @param {Array} peerMetrics - Array of peer metrics
   * @returns {Object} Aggregated metrics
   */
  aggregateMetrics(peerMetrics) {
    if (peerMetrics.length === 0) {
      return {
        peerCount: 0,
        bandwidth: { upload: 0, download: 0 },
        videoQuality: { resolution: null, fps: 0 },
        latency: 0,
        packetsLost: 0,
        jitter: 0,
        connectionStates: {}
      }
    }

    let totalUploadBitrate = 0
    let totalDownloadBitrate = 0
    let totalLatency = 0
    let totalPacketsLost = 0
    let totalJitter = 0
    let videoFPS = []
    let videoResolutions = []
    const connectionStates = {}

    peerMetrics.forEach(metrics => {
      // Upload bandwidth (outbound)
      if (metrics.outbound.video && metrics.outbound.video.bitrate) {
        totalUploadBitrate += parseFloat(metrics.outbound.video.bitrate)
      }
      if (metrics.outbound.audio && metrics.outbound.audio.bitrate) {
        totalUploadBitrate += parseFloat(metrics.outbound.audio.bitrate)
      }

      // Download bandwidth (inbound)
      if (metrics.inbound.video && metrics.inbound.video.bitrate) {
        totalDownloadBitrate += parseFloat(metrics.inbound.video.bitrate)
      }
      if (metrics.inbound.audio && metrics.inbound.audio.bitrate) {
        totalDownloadBitrate += parseFloat(metrics.inbound.audio.bitrate)
      }

      // Video quality
      if (metrics.inbound.video) {
        if (metrics.inbound.video.framesPerSecond) {
          videoFPS.push(metrics.inbound.video.framesPerSecond)
        }
        if (metrics.inbound.video.frameWidth && metrics.inbound.video.frameHeight) {
          videoResolutions.push(`${metrics.inbound.video.frameWidth}x${metrics.inbound.video.frameHeight}`)
        }
        totalPacketsLost += metrics.inbound.video.packetsLost || 0
        totalJitter += metrics.inbound.video.jitter || 0
      }

      // Latency (RTT)
      if (metrics.candidate && metrics.candidate.currentRoundTripTime) {
        totalLatency += metrics.candidate.currentRoundTripTime * 1000 // Convert to ms
      }

      // Connection states
      connectionStates[metrics.connectionState] = (connectionStates[metrics.connectionState] || 0) + 1
    })

    const peerCount = peerMetrics.length
    const avgFPS = videoFPS.length > 0 ? videoFPS.reduce((sum, fps) => sum + fps, 0) / videoFPS.length : 0
    const avgLatency = peerCount > 0 ? totalLatency / peerCount : 0

    return {
      peerCount,
      bandwidth: {
        upload: totalUploadBitrate,
        download: totalDownloadBitrate
      },
      videoQuality: {
        resolution: videoResolutions.length > 0 ? videoResolutions[0] : null,
        fps: avgFPS
      },
      latency: avgLatency,
      packetsLost: totalPacketsLost,
      jitter: totalJitter / (peerCount || 1),
      connectionStates
    }
  }

  /**
   * Get metrics history for a peer
   * @param {string} peerId - Peer ID
   * @returns {Array} Metrics history
   */
  getPeerHistory(peerId) {
    return this.metricsHistory.get(peerId) || []
  }

  /**
   * Get all metrics history
   * @returns {Map} Map of peer ID to metrics history
   */
  getAllHistory() {
    return this.metricsHistory
  }

  /**
   * Clear metrics history
   */
  clearHistory() {
    this.metricsHistory.clear()
    this.lastStats.clear()
    logger.info('🗑️ [Metrics] Cleared metrics history')
  }

  /**
   * Export metrics as CSV
   * @param {string} peerId - Peer ID (optional, exports all if not provided)
   * @returns {string} CSV string
   */
  exportCSV(peerId = null) {
    const headers = [
      'timestamp',
      'peerId',
      'connectionState',
      'uploadBitrate',
      'downloadBitrate',
      'videoFPS',
      'videoResolution',
      'latency',
      'packetsLost',
      'jitter'
    ]

    const rows = [headers.join(',')]

    const histories = peerId
      ? [[peerId, this.metricsHistory.get(peerId) || []]]
      : Array.from(this.metricsHistory.entries())

    histories.forEach(([pid, history]) => {
      history.forEach(metrics => {
        const uploadBitrate = (metrics.outbound.video?.bitrate || 0) + (metrics.outbound.audio?.bitrate || 0)
        const downloadBitrate = (metrics.inbound.video?.bitrate || 0) + (metrics.inbound.audio?.bitrate || 0)
        const videoFPS = metrics.inbound.video?.framesPerSecond || 0
        const videoResolution = metrics.inbound.video?.frameWidth
          ? `${metrics.inbound.video.frameWidth}x${metrics.inbound.video.frameHeight}`
          : ''
        const latency = metrics.candidate?.currentRoundTripTime
          ? (metrics.candidate.currentRoundTripTime * 1000).toFixed(2)
          : 0
        const packetsLost = metrics.inbound.video?.packetsLost || 0
        const jitter = metrics.inbound.video?.jitter || 0

        rows.push([
          metrics.timestamp,
          pid,
          metrics.connectionState,
          uploadBitrate,
          downloadBitrate,
          videoFPS,
          videoResolution,
          latency,
          packetsLost,
          jitter
        ].join(','))
      })
    })

    return rows.join('\n')
  }
}

export default WebRTCMetricsCollector
