/**
 * Cloud Recording Service (Frontend)
 *
 * Client-side service for managing cloud-based video conference recordings
 * with AI features: transcription, summarization, highlights, smart chapters
 */

import axios from 'axios'
import { logger } from '@/utils/logger'

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

/**
 * Recording status constants
 */
export const RECORDING_STATUS = {
  RECORDING: 'recording',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELETED: 'deleted'
}

/**
 * Retention policy constants (in days)
 */
export const RETENTION_POLICY = {
  ONE_WEEK: 7,
  ONE_MONTH: 30,
  THREE_MONTHS: 90,
  SIX_MONTHS: 180,
  ONE_YEAR: 365,
  FOREVER: -1
}

class CloudRecordingService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/cloud-recording`
  }

  /**
   * Start cloud recording for a room
   *
   * @param {object} options - Recording options
   * @param {string} options.roomId - Room identifier
   * @param {string} options.userId - User who started recording
   * @param {string} options.roomName - Display name of the room
   * @param {string[]} options.participants - List of participant IDs
   * @param {number} options.retentionDays - Retention policy in days
   * @param {string[]} options.folders - Folder organization
   * @param {string[]} options.tags - Tags for categorization
   * @returns {Promise<object>} - Recording information
   */
  async startRecording(options) {
    try {
      const response = await axios.post(`${this.baseURL}/start`, options)
      logger.debug('Started cloud recording', response.data)
      return response.data
    } catch (error) {
      logger.error('Failed to start cloud recording', error)
      throw error
    }
  }

  /**
   * Stop cloud recording and upload video
   *
   * @param {string} roomId - Room identifier
   * @param {Blob} videoBlob - Recorded video blob
   * @returns {Promise<object>} - Recording metadata
   */
  async stopRecording(roomId, videoBlob) {
    try {
      const formData = new FormData()
      formData.append('video', videoBlob, `${roomId}.webm`)

      const response = await axios.post(`${this.baseURL}/stop/${roomId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        // Show upload progress
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          logger.debug(`Upload progress: ${percentCompleted}%`)
        }
      })

      logger.debug('Stopped cloud recording', response.data)
      return response.data
    } catch (error) {
      logger.error('Failed to stop cloud recording', error)
      throw error
    }
  }

  /**
   * Add chat message to recording
   *
   * @param {string} roomId - Room identifier
   * @param {object} message - Chat message
   * @returns {Promise<void>}
   */
  async addChatMessage(roomId, message) {
    try {
      await axios.post(`${this.baseURL}/chat/${roomId}`, message)
    } catch (error) {
      logger.warn('Failed to add chat message to recording', error)
    }
  }

  /**
   * Add event to recording
   *
   * @param {string} roomId - Room identifier
   * @param {object} event - Event data
   * @returns {Promise<void>}
   */
  async addEvent(roomId, event) {
    try {
      await axios.post(`${this.baseURL}/event/${roomId}`, event)
    } catch (error) {
      logger.warn('Failed to add event to recording', error)
    }
  }

  /**
   * List all cloud recordings with optional filtering
   *
   * @param {object} filters - Filter options
   * @param {string} filters.userId - Filter by user
   * @param {string[]} filters.folders - Filter by folders
   * @param {string[]} filters.tags - Filter by tags
   * @param {string} filters.status - Filter by status
   * @param {number} filters.limit - Limit results
   * @param {number} filters.offset - Offset for pagination
   * @returns {Promise<object>} - List of recordings with pagination info
   */
  async listRecordings(filters = {}) {
    try {
      const params = new URLSearchParams()

      if (filters.userId) params.append('userId', filters.userId)
      if (filters.folders) params.append('folders', filters.folders.join(','))
      if (filters.tags) params.append('tags', filters.tags.join(','))
      if (filters.status) params.append('status', filters.status)
      if (filters.limit) params.append('limit', filters.limit)
      if (filters.offset) params.append('offset', filters.offset)

      const response = await axios.get(`${this.baseURL}/list?${params.toString()}`)
      return response.data
    } catch (error) {
      logger.error('Failed to list cloud recordings', error)
      throw error
    }
  }

  /**
   * Get recording metadata
   *
   * @param {string} recordingId - Recording identifier
   * @returns {Promise<object>} - Recording metadata
   */
  async getRecording(recordingId) {
    try {
      const response = await axios.get(`${this.baseURL}/${recordingId}`)
      return response.data.data
    } catch (error) {
      logger.error('Failed to get recording', error)
      throw error
    }
  }

  /**
   * Update recording metadata
   *
   * @param {string} recordingId - Recording identifier
   * @param {object} updates - Fields to update
   * @returns {Promise<object>} - Updated recording metadata
   */
  async updateRecording(recordingId, updates) {
    try {
      const response = await axios.put(`${this.baseURL}/${recordingId}`, updates)
      logger.debug('Updated recording', response.data)
      return response.data.data
    } catch (error) {
      logger.error('Failed to update recording', error)
      throw error
    }
  }

  /**
   * Delete a cloud recording
   *
   * @param {string} recordingId - Recording identifier
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async deleteRecording(recordingId) {
    try {
      const response = await axios.delete(`${this.baseURL}/${recordingId}`)
      logger.debug('Deleted recording', response.data)
      return response.data.success
    } catch (error) {
      logger.error('Failed to delete recording', error)
      throw error
    }
  }

  /**
   * Get video URL for playback
   *
   * @param {string} recordingId - Recording identifier
   * @returns {string} - Video URL
   */
  getVideoUrl(recordingId) {
    return `${this.baseURL}/${recordingId}/video`
  }

  /**
   * Download video file
   *
   * @param {string} recordingId - Recording identifier
   * @param {string} filename - Desired filename
   * @returns {Promise<void>}
   */
  async downloadVideo(recordingId, filename = null) {
    try {
      const response = await axios.get(`${this.baseURL}/${recordingId}/video`, {
        responseType: 'blob'
      })

      const blob = new Blob([response.data], { type: 'video/webm' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename || `${recordingId}.webm`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      logger.debug('Downloaded video', recordingId)
    } catch (error) {
      logger.error('Failed to download video', error)
      throw error
    }
  }

  /**
   * Get transcript
   *
   * @param {string} recordingId - Recording identifier
   * @returns {Promise<object>} - Transcript data
   */
  async getTranscript(recordingId) {
    try {
      const response = await axios.get(`${this.baseURL}/${recordingId}/transcript`)
      return response.data.data
    } catch (error) {
      logger.error('Failed to get transcript', error)
      throw error
    }
  }

  /**
   * Search in transcripts
   *
   * @param {string} query - Search query
   * @param {object} filters - Additional filters
   * @returns {Promise<Array>} - Search results
   */
  async searchTranscripts(query, filters = {}) {
    try {
      const params = new URLSearchParams({ query })

      if (filters.userId) params.append('userId', filters.userId)
      if (filters.folders) params.append('folders', filters.folders.join(','))
      if (filters.tags) params.append('tags', filters.tags.join(','))

      const response = await axios.get(`${this.baseURL}/search/transcripts?${params.toString()}`)
      return response.data.data
    } catch (error) {
      logger.error('Failed to search transcripts', error)
      throw error
    }
  }

  /**
   * Enable public sharing for a recording
   *
   * @param {string} recordingId - Recording identifier
   * @returns {Promise<object>} - Sharing information
   */
  async enableSharing(recordingId) {
    try {
      const baseUrl = window.location.origin
      const response = await axios.post(`${this.baseURL}/${recordingId}/share`, { baseUrl })
      logger.debug('Enabled sharing', response.data)
      return response.data.data
    } catch (error) {
      logger.error('Failed to enable sharing', error)
      throw error
    }
  }

  /**
   * Disable public sharing for a recording
   *
   * @param {string} recordingId - Recording identifier
   * @returns {Promise<void>}
   */
  async disableSharing(recordingId) {
    try {
      const response = await axios.delete(`${this.baseURL}/${recordingId}/share`)
      logger.debug('Disabled sharing', response.data)
    } catch (error) {
      logger.error('Failed to disable sharing', error)
      throw error
    }
  }

  /**
   * Get recording by sharing token (public access)
   *
   * @param {string} sharingToken - Sharing token
   * @returns {Promise<object>} - Recording metadata
   */
  async getSharedRecording(sharingToken) {
    try {
      const response = await axios.get(`${this.baseURL}/shared/${sharingToken}`)
      return response.data.data
    } catch (error) {
      logger.error('Failed to get shared recording', error)
      throw error
    }
  }

  /**
   * Get storage statistics
   *
   * @returns {Promise<object>} - Storage statistics
   */
  async getStorageStats() {
    try {
      const response = await axios.get(`${this.baseURL}/stats/storage`)
      return response.data.data
    } catch (error) {
      logger.error('Failed to get storage stats', error)
      throw error
    }
  }

  /**
   * Trigger cleanup of expired recordings
   *
   * @returns {Promise<object>} - Cleanup statistics
   */
  async cleanupExpiredRecordings() {
    try {
      const response = await axios.post(`${this.baseURL}/cleanup`)
      logger.debug('Cleanup completed', response.data)
      return response.data.data
    } catch (error) {
      logger.error('Failed to cleanup expired recordings', error)
      throw error
    }
  }

  /**
   * Format duration in seconds to human-readable string
   *
   * @param {number} seconds - Duration in seconds
   * @returns {string} - Formatted duration
   */
  formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0:00'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * Format file size in bytes to human-readable string
   *
   * @param {number} bytes - Size in bytes
   * @returns {string} - Formatted size
   */
  formatFileSize(bytes) {
    if (!bytes || bytes < 0) return '0 B'

    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * Get retention policy label
   *
   * @param {number} days - Retention days
   * @returns {string} - Retention label
   */
  getRetentionLabel(days) {
    switch (days) {
      case RETENTION_POLICY.ONE_WEEK:
        return '1 неделя'
      case RETENTION_POLICY.ONE_MONTH:
        return '1 месяц'
      case RETENTION_POLICY.THREE_MONTHS:
        return '3 месяца'
      case RETENTION_POLICY.SIX_MONTHS:
        return '6 месяцев'
      case RETENTION_POLICY.ONE_YEAR:
        return '1 год'
      case RETENTION_POLICY.FOREVER:
        return 'Навсегда'
      default:
        return `${days} дней`
    }
  }

  /**
   * Get status label
   *
   * @param {string} status - Recording status
   * @returns {string} - Status label
   */
  getStatusLabel(status) {
    switch (status) {
      case RECORDING_STATUS.RECORDING:
        return 'Идёт запись'
      case RECORDING_STATUS.PROCESSING:
        return 'Обработка'
      case RECORDING_STATUS.COMPLETED:
        return 'Готово'
      case RECORDING_STATUS.FAILED:
        return 'Ошибка'
      case RECORDING_STATUS.DELETED:
        return 'Удалено'
      default:
        return status
    }
  }

  /**
   * Get status color for UI
   *
   * @param {string} status - Recording status
   * @returns {string} - Status color (PrimeVue severity)
   */
  getStatusSeverity(status) {
    switch (status) {
      case RECORDING_STATUS.RECORDING:
        return 'danger' // Red for active recording
      case RECORDING_STATUS.PROCESSING:
        return 'warn' // Orange for processing
      case RECORDING_STATUS.COMPLETED:
        return 'success' // Green for completed
      case RECORDING_STATUS.FAILED:
        return 'danger' // Red for failed
      case RECORDING_STATUS.DELETED:
        return 'secondary' // Gray for deleted
      default:
        return 'info'
    }
  }
}

export default new CloudRecordingService()
