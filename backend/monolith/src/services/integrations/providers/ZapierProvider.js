/**
 * Zapier Integration Provider
 *
 * Implements Zapier-specific integration features:
 * - Webhook triggers for Zapier Zaps
 * - Actions that Zapier can call
 * - Subscription management
 * - Event notifications
 */

import crypto from 'crypto'
import logger from '../../../utils/logger.js'

export class ZapierProvider {
  constructor(config) {
    this.apiKey = config.apiKey || process.env.ZAPIER_API_KEY
  }

  /**
   * Subscribe to webhook
   * @param {string} hookUrl - Zapier webhook URL
   * @param {string} event - Event type to subscribe to
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Subscription data
   */
  async subscribe(hookUrl, event, userId) {
    try {
      // Store subscription in memory or database
      const subscription = {
        id: crypto.randomUUID(),
        hookUrl,
        event,
        userId,
        createdAt: new Date(),
        active: true
      }

      logger.info('Zapier subscription created', { subscriptionId: subscription.id, event, userId })

      // TODO: Save to database
      // await db.saveZapierSubscription(subscription)

      return subscription
    } catch (error) {
      logger.error('Failed to create Zapier subscription', { error: error.message, event, userId })
      throw error
    }
  }

  /**
   * Unsubscribe from webhook
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<boolean>} Success status
   */
  async unsubscribe(subscriptionId) {
    try {
      logger.info('Zapier subscription deleted', { subscriptionId })

      // TODO: Delete from database
      // await db.deleteZapierSubscription(subscriptionId)

      return true
    } catch (error) {
      logger.error('Failed to delete Zapier subscription', { error: error.message, subscriptionId })
      throw error
    }
  }

  /**
   * Trigger: New recording created
   * @param {Object} recording - Recording metadata
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async triggerNewRecording(recording, userId) {
    try {
      // TODO: Get user's Zapier subscriptions for 'recording.created' event
      // const subscriptions = await db.getZapierSubscriptions(userId, 'recording.created')

      const subscriptions = [] // Placeholder

      const payload = {
        event: 'recording.created',
        timestamp: new Date().toISOString(),
        data: {
          id: recording.id,
          title: recording.title,
          duration: recording.duration,
          url: recording.url,
          createdAt: recording.createdAt,
          participantCount: recording.participantCount
        }
      }

      // Send to all subscribed Zapier hooks
      const promises = subscriptions.map(sub =>
        this.sendWebhook(sub.hookUrl, payload)
      )

      await Promise.allSettled(promises)

      logger.info('Triggered Zapier new recording event', { recordingId: recording.id, subscriptionCount: subscriptions.length })
    } catch (error) {
      logger.error('Failed to trigger Zapier new recording event', { error: error.message, recordingId: recording.id })
    }
  }

  /**
   * Trigger: Meeting scheduled
   * @param {Object} meeting - Meeting metadata
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async triggerMeetingScheduled(meeting, userId) {
    try {
      const subscriptions = [] // TODO: Get from database

      const payload = {
        event: 'meeting.scheduled',
        timestamp: new Date().toISOString(),
        data: {
          id: meeting.id,
          title: meeting.title,
          scheduledAt: meeting.scheduledAt,
          duration: meeting.duration,
          joinUrl: meeting.joinUrl
        }
      }

      const promises = subscriptions.map(sub =>
        this.sendWebhook(sub.hookUrl, payload)
      )

      await Promise.allSettled(promises)

      logger.info('Triggered Zapier meeting scheduled event', { meetingId: meeting.id, subscriptionCount: subscriptions.length })
    } catch (error) {
      logger.error('Failed to trigger Zapier meeting scheduled event', { error: error.message, meetingId: meeting.id })
    }
  }

  /**
   * Trigger: Meeting completed
   * @param {Object} meeting - Meeting metadata
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async triggerMeetingCompleted(meeting, userId) {
    try {
      const subscriptions = [] // TODO: Get from database

      const payload = {
        event: 'meeting.completed',
        timestamp: new Date().toISOString(),
        data: {
          id: meeting.id,
          title: meeting.title,
          startedAt: meeting.startedAt,
          endedAt: meeting.endedAt,
          duration: meeting.duration,
          participantCount: meeting.participantCount,
          recordingUrl: meeting.recordingUrl
        }
      }

      const promises = subscriptions.map(sub =>
        this.sendWebhook(sub.hookUrl, payload)
      )

      await Promise.allSettled(promises)

      logger.info('Triggered Zapier meeting completed event', { meetingId: meeting.id, subscriptionCount: subscriptions.length })
    } catch (error) {
      logger.error('Failed to trigger Zapier meeting completed event', { error: error.message, meetingId: meeting.id })
    }
  }

  /**
   * Action: Create meeting
   * @param {Object} meetingData - Meeting data from Zapier
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created meeting
   */
  async createMeeting(meetingData, userId) {
    try {
      // TODO: Implement meeting creation via DronDoc API
      const meeting = {
        id: crypto.randomUUID(),
        title: meetingData.title,
        scheduledAt: meetingData.scheduledAt,
        duration: meetingData.duration || 60,
        userId,
        createdAt: new Date()
      }

      logger.info('Created meeting via Zapier action', { meetingId: meeting.id, userId })

      return meeting
    } catch (error) {
      logger.error('Failed to create meeting via Zapier', { error: error.message, userId })
      throw error
    }
  }

  /**
   * Action: Start recording
   * @param {Object} recordingData - Recording data from Zapier
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Started recording
   */
  async startRecording(recordingData, userId) {
    try {
      // TODO: Implement recording start via DronDoc API
      const recording = {
        id: crypto.randomUUID(),
        meetingId: recordingData.meetingId,
        userId,
        startedAt: new Date(),
        status: 'recording'
      }

      logger.info('Started recording via Zapier action', { recordingId: recording.id, meetingId: recordingData.meetingId })

      return recording
    } catch (error) {
      logger.error('Failed to start recording via Zapier', { error: error.message, userId })
      throw error
    }
  }

  /**
   * Send webhook to Zapier
   * @param {string} hookUrl - Webhook URL
   * @param {Object} payload - Payload to send
   * @returns {Promise<void>}
   */
  async sendWebhook(hookUrl, payload) {
    try {
      const response = await fetch(hookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`)
      }

      logger.debug('Sent webhook to Zapier', { hookUrl })
    } catch (error) {
      logger.error('Failed to send Zapier webhook', { error: error.message, hookUrl })
      // Don't throw - we don't want to fail the original operation
    }
  }

  /**
   * Get available triggers
   * @returns {Array} List of trigger definitions
   */
  getAvailableTriggers() {
    return [
      {
        key: 'recording.created',
        name: 'New Recording',
        description: 'Triggers when a new recording is created',
        sample: {
          id: 'rec_123',
          title: 'Team Standup',
          duration: 1800,
          url: 'https://drondoc.ru/recordings/rec_123',
          createdAt: '2025-11-07T10:00:00Z',
          participantCount: 5
        }
      },
      {
        key: 'meeting.scheduled',
        name: 'Meeting Scheduled',
        description: 'Triggers when a meeting is scheduled',
        sample: {
          id: 'meet_456',
          title: 'Product Review',
          scheduledAt: '2025-11-08T15:00:00Z',
          duration: 60,
          joinUrl: 'https://drondoc.ru/join/meet_456'
        }
      },
      {
        key: 'meeting.completed',
        name: 'Meeting Completed',
        description: 'Triggers when a meeting ends',
        sample: {
          id: 'meet_789',
          title: 'Sprint Planning',
          startedAt: '2025-11-07T09:00:00Z',
          endedAt: '2025-11-07T10:30:00Z',
          duration: 90,
          participantCount: 8,
          recordingUrl: 'https://drondoc.ru/recordings/rec_789'
        }
      }
    ]
  }

  /**
   * Get available actions
   * @returns {Array} List of action definitions
   */
  getAvailableActions() {
    return [
      {
        key: 'create_meeting',
        name: 'Create Meeting',
        description: 'Creates a new meeting in DronDoc',
        inputFields: [
          { key: 'title', label: 'Meeting Title', required: true },
          { key: 'scheduledAt', label: 'Scheduled Time', required: true, type: 'datetime' },
          { key: 'duration', label: 'Duration (minutes)', required: false, type: 'integer' }
        ]
      },
      {
        key: 'start_recording',
        name: 'Start Recording',
        description: 'Starts recording for a meeting',
        inputFields: [
          { key: 'meetingId', label: 'Meeting ID', required: true }
        ]
      }
    ]
  }
}

export default ZapierProvider
