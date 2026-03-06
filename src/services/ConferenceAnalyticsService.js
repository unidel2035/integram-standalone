/**
 * Conference Analytics Service
 *
 * Collects and manages analytics data for video conferences:
 * - Attendance tracking (join/leave events)
 * - Engagement metrics (chat activity, reactions)
 * - Speaking time per participant
 * - Network quality metrics
 * - Device statistics
 * - Recording analytics
 */

import { logger } from '@/utils/logger'

export default class ConferenceAnalyticsService {
  constructor(roomId, userId) {
    this.roomId = roomId
    this.userId = userId
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Analytics data storage
    this.participants = new Map() // participantId -> participant data
    this.events = [] // All events timeline
    this.chatActivity = [] // Chat messages timeline
    this.reactions = [] // Reactions timeline
    this.networkStats = [] // Network quality measurements
    this.speakingTime = new Map() // participantId -> speaking time in ms
    this.deviceInfo = new Map() // participantId -> device info

    // Session metadata
    this.sessionStart = Date.now()
    this.sessionEnd = null
    this.recordingDuration = 0
    this.recordingStartTime = null

    // Active tracking
    this.currentSpeaker = null
    this.speakingStartTime = null

    logger.info('[ConferenceAnalytics] Service initialized', {
      roomId: this.roomId,
      userId: this.userId,
      sessionId: this.sessionId
    })
  }

  /**
   * Track participant joining the conference
   */
  trackParticipantJoin(participantId, participantName, deviceType = 'Unknown') {
    const joinTime = Date.now()

    const participantData = {
      id: participantId,
      name: participantName,
      deviceType,
      joinTime,
      leaveTime: null,
      duration: 0,
      isHost: false,
      speakingTime: 0,
      chatMessages: 0,
      reactions: 0,
      networkQuality: {
        avgBitrate: 0,
        avgPacketLoss: 0,
        avgLatency: 0,
        measurements: 0
      }
    }

    this.participants.set(participantId, participantData)

    // Add to events timeline
    this.events.push({
      type: 'participant_join',
      participantId,
      participantName,
      deviceType,
      timestamp: joinTime
    })

    logger.debug('[ConferenceAnalytics] Participant joined', {
      participantId,
      participantName,
      deviceType
    })
  }

  /**
   * Track participant leaving the conference
   */
  trackParticipantLeave(participantId) {
    const participant = this.participants.get(participantId)
    if (!participant) {
      logger.warn('[ConferenceAnalytics] Participant not found for leave event', { participantId })
      return
    }

    const leaveTime = Date.now()
    participant.leaveTime = leaveTime
    participant.duration = leaveTime - participant.joinTime

    this.events.push({
      type: 'participant_leave',
      participantId,
      participantName: participant.name,
      timestamp: leaveTime,
      duration: participant.duration
    })

    logger.debug('[ConferenceAnalytics] Participant left', {
      participantId,
      duration: participant.duration
    })
  }

  /**
   * Track chat message
   */
  trackChatMessage(participantId, messageLength) {
    const participant = this.participants.get(participantId)
    if (participant) {
      participant.chatMessages++
    }

    this.chatActivity.push({
      participantId,
      messageLength,
      timestamp: Date.now()
    })

    this.events.push({
      type: 'chat_message',
      participantId,
      timestamp: Date.now()
    })
  }

  /**
   * Track reaction
   */
  trackReaction(participantId, emoji) {
    const participant = this.participants.get(participantId)
    if (participant) {
      participant.reactions++
    }

    this.reactions.push({
      participantId,
      emoji,
      timestamp: Date.now()
    })

    this.events.push({
      type: 'reaction',
      participantId,
      emoji,
      timestamp: Date.now()
    })
  }

  /**
   * Start tracking speaking time for a participant
   */
  startSpeaking(participantId) {
    if (this.currentSpeaker === participantId) return

    // Stop previous speaker
    if (this.currentSpeaker) {
      this.stopSpeaking(this.currentSpeaker)
    }

    this.currentSpeaker = participantId
    this.speakingStartTime = Date.now()

    this.events.push({
      type: 'speaking_start',
      participantId,
      timestamp: this.speakingStartTime
    })
  }

  /**
   * Stop tracking speaking time for a participant
   */
  stopSpeaking(participantId) {
    if (this.currentSpeaker !== participantId) return

    const speakingDuration = Date.now() - this.speakingStartTime

    // Add to total speaking time
    const currentTime = this.speakingTime.get(participantId) || 0
    this.speakingTime.set(participantId, currentTime + speakingDuration)

    // Update participant data
    const participant = this.participants.get(participantId)
    if (participant) {
      participant.speakingTime = currentTime + speakingDuration
    }

    this.events.push({
      type: 'speaking_stop',
      participantId,
      duration: speakingDuration,
      timestamp: Date.now()
    })

    this.currentSpeaker = null
    this.speakingStartTime = null
  }

  /**
   * Track network quality stats from WebRTC
   */
  trackNetworkQuality(participantId, stats) {
    const participant = this.participants.get(participantId)
    if (!participant) return

    // Calculate averages
    const prevMeasurements = participant.networkQuality.measurements
    const n = prevMeasurements + 1

    participant.networkQuality.avgBitrate =
      (participant.networkQuality.avgBitrate * prevMeasurements + stats.bitrate) / n
    participant.networkQuality.avgPacketLoss =
      (participant.networkQuality.avgPacketLoss * prevMeasurements + stats.packetLoss) / n
    participant.networkQuality.avgLatency =
      (participant.networkQuality.avgLatency * prevMeasurements + stats.latency) / n
    participant.networkQuality.measurements = n

    // Store detailed stats
    this.networkStats.push({
      participantId,
      ...stats,
      timestamp: Date.now()
    })
  }

  /**
   * Track device information
   */
  trackDeviceInfo(participantId, deviceInfo) {
    this.deviceInfo.set(participantId, {
      ...deviceInfo,
      timestamp: Date.now()
    })

    const participant = this.participants.get(participantId)
    if (participant) {
      participant.deviceType = deviceInfo.type || participant.deviceType
    }
  }

  /**
   * Track recording start
   */
  trackRecordingStart() {
    this.recordingStartTime = Date.now()

    this.events.push({
      type: 'recording_start',
      timestamp: this.recordingStartTime
    })
  }

  /**
   * Track recording stop
   */
  trackRecordingStop() {
    if (this.recordingStartTime) {
      this.recordingDuration += Date.now() - this.recordingStartTime
      this.recordingStartTime = null
    }

    this.events.push({
      type: 'recording_stop',
      timestamp: Date.now(),
      totalDuration: this.recordingDuration
    })
  }

  /**
   * Get comprehensive analytics report
   */
  getAnalyticsReport() {
    this.sessionEnd = Date.now()
    const sessionDuration = this.sessionEnd - this.sessionStart

    // Convert participants map to array
    const participantsArray = Array.from(this.participants.values()).map(p => ({
      ...p,
      // Calculate duration if still in conference
      duration: p.leaveTime ? p.duration : (Date.now() - p.joinTime),
      speakingTimePercent: p.speakingTime > 0
        ? ((p.speakingTime / sessionDuration) * 100).toFixed(2)
        : 0
    }))

    // Calculate engagement metrics
    const totalChatMessages = participantsArray.reduce((sum, p) => sum + p.chatMessages, 0)
    const totalReactions = participantsArray.reduce((sum, p) => sum + p.reactions, 0)
    const totalSpeakingTime = Array.from(this.speakingTime.values()).reduce((sum, time) => sum + time, 0)

    // Get peak concurrent participants
    const peakParticipants = this.calculatePeakParticipants()

    // Device breakdown
    const deviceBreakdown = this.getDeviceBreakdown()

    return {
      session: {
        id: this.sessionId,
        roomId: this.roomId,
        startTime: this.sessionStart,
        endTime: this.sessionEnd,
        duration: sessionDuration,
        recordingDuration: this.recordingDuration
      },
      attendance: {
        totalParticipants: participantsArray.length,
        peakConcurrent: peakParticipants,
        participants: participantsArray
      },
      engagement: {
        totalChatMessages,
        totalReactions,
        avgChatPerParticipant: totalChatMessages / participantsArray.length || 0,
        avgReactionsPerParticipant: totalReactions / participantsArray.length || 0,
        chatActivity: this.chatActivity,
        reactions: this.reactions
      },
      speaking: {
        totalSpeakingTime,
        speakingTimeByParticipant: Object.fromEntries(this.speakingTime),
        mostActiveSpeaker: this.getMostActiveSpeaker()
      },
      network: {
        overallQuality: this.calculateOverallNetworkQuality(),
        byParticipant: participantsArray.map(p => ({
          id: p.id,
          name: p.name,
          ...p.networkQuality
        }))
      },
      devices: deviceBreakdown,
      events: this.events
    }
  }

  /**
   * Calculate peak concurrent participants
   */
  calculatePeakParticipants() {
    const joinLeaveEvents = this.events.filter(
      e => e.type === 'participant_join' || e.type === 'participant_leave'
    )

    let current = 0
    let peak = 0

    for (const event of joinLeaveEvents) {
      if (event.type === 'participant_join') {
        current++
        peak = Math.max(peak, current)
      } else {
        current--
      }
    }

    return peak
  }

  /**
   * Get device type breakdown
   */
  getDeviceBreakdown() {
    const breakdown = {}

    for (const participant of this.participants.values()) {
      const deviceType = participant.deviceType || 'Unknown'
      breakdown[deviceType] = (breakdown[deviceType] || 0) + 1
    }

    return breakdown
  }

  /**
   * Calculate overall network quality
   */
  calculateOverallNetworkQuality() {
    let totalBitrate = 0
    let totalPacketLoss = 0
    let totalLatency = 0
    let count = 0

    for (const participant of this.participants.values()) {
      if (participant.networkQuality.measurements > 0) {
        totalBitrate += participant.networkQuality.avgBitrate
        totalPacketLoss += participant.networkQuality.avgPacketLoss
        totalLatency += participant.networkQuality.avgLatency
        count++
      }
    }

    return count > 0 ? {
      avgBitrate: totalBitrate / count,
      avgPacketLoss: totalPacketLoss / count,
      avgLatency: totalLatency / count
    } : null
  }

  /**
   * Get most active speaker
   */
  getMostActiveSpeaker() {
    let maxTime = 0
    let mostActive = null

    for (const [participantId, time] of this.speakingTime.entries()) {
      if (time > maxTime) {
        maxTime = time
        mostActive = participantId
      }
    }

    const participant = mostActive ? this.participants.get(mostActive) : null

    return participant ? {
      id: participant.id,
      name: participant.name,
      speakingTime: maxTime
    } : null
  }

  /**
   * Export analytics to JSON
   */
  exportToJSON() {
    const report = this.getAnalyticsReport()
    const json = JSON.stringify(report, null, 2)

    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conference-analytics-${this.roomId}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    logger.info('[ConferenceAnalytics] Exported analytics to JSON')
  }

  /**
   * Export analytics to CSV
   */
  exportToCSV() {
    const report = this.getAnalyticsReport()

    // Participants CSV
    const csvRows = []
    csvRows.push([
      'Participant ID',
      'Name',
      'Device Type',
      'Join Time',
      'Leave Time',
      'Duration (min)',
      'Speaking Time (min)',
      'Speaking %',
      'Chat Messages',
      'Reactions',
      'Avg Bitrate (kbps)',
      'Avg Packet Loss (%)',
      'Avg Latency (ms)'
    ].join(','))

    for (const participant of report.attendance.participants) {
      csvRows.push([
        participant.id,
        `"${participant.name}"`,
        participant.deviceType,
        new Date(participant.joinTime).toISOString(),
        participant.leaveTime ? new Date(participant.leaveTime).toISOString() : 'In conference',
        (participant.duration / 60000).toFixed(2),
        (participant.speakingTime / 60000).toFixed(2),
        participant.speakingTimePercent,
        participant.chatMessages,
        participant.reactions,
        participant.networkQuality.avgBitrate.toFixed(2),
        participant.networkQuality.avgPacketLoss.toFixed(2),
        participant.networkQuality.avgLatency.toFixed(2)
      ].join(','))
    }

    const csv = csvRows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conference-analytics-${this.roomId}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)

    logger.info('[ConferenceAnalytics] Exported analytics to CSV')
  }

  /**
   * Export analytics to PDF
   */
  async exportToPDF() {
    logger.warn('[ConferenceAnalytics] PDF export not yet implemented')
    // TODO: Implement PDF export using jsPDF or similar library
    // For now, just export JSON
    this.exportToJSON()
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // Stop any active speaking tracking
    if (this.currentSpeaker) {
      this.stopSpeaking(this.currentSpeaker)
    }

    // Mark session as ended
    this.sessionEnd = Date.now()

    logger.info('[ConferenceAnalytics] Service cleanup complete')
  }
}
