/**
 * Microsoft Teams Integration Provider
 *
 * Implements Microsoft Teams-specific integration features:
 * - OAuth2 authentication with Microsoft
 * - Post messages to Teams channels
 * - Post meeting recordings with Adaptive Cards
 * - Teams bot integration
 * - Meeting notifications
 * - Webhook handling
 */

import logger from '../../../utils/logger.js'

export class MicrosoftTeamsProvider {
  constructor(config) {
    this.clientId = config.clientId || process.env.MICROSOFT_TEAMS_CLIENT_ID
    this.clientSecret = config.clientSecret || process.env.MICROSOFT_TEAMS_CLIENT_SECRET
    this.tenantId = config.tenantId || process.env.MICROSOFT_TEAMS_TENANT_ID || 'common'
    this.graphApiBaseUrl = 'https://graph.microsoft.com/v1.0'
  }

  /**
   * Post message to Teams channel
   * @param {string} accessToken - OAuth access token
   * @param {string} teamId - Team ID
   * @param {string} channelId - Channel ID
   * @param {string} content - Message content (HTML supported)
   * @returns {Promise<Object>} API response
   */
  async postMessage(accessToken, teamId, channelId, content) {
    try {
      const payload = {
        body: {
          contentType: 'html',
          content
        }
      }

      const response = await fetch(
        `${this.graphApiBaseUrl}/teams/${teamId}/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Microsoft Graph API error: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Posted message to Teams channel', { teamId, channelId })

      return data
    } catch (error) {
      logger.error('Failed to post Teams message', { error: error.message, teamId, channelId })
      throw error
    }
  }

  /**
   * Post recording to Teams channel with Adaptive Card
   * @param {string} accessToken - OAuth access token
   * @param {string} teamId - Team ID
   * @param {string} channelId - Channel ID
   * @param {Object} recording - Recording metadata
   * @returns {Promise<Object>} API response
   */
  async postRecording(accessToken, teamId, channelId, recording) {
    try {
      const adaptiveCard = {
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
              type: 'AdaptiveCard',
              version: '1.4',
              body: [
                {
                  type: 'TextBlock',
                  text: '🎥 New Meeting Recording',
                  weight: 'bolder',
                  size: 'large'
                },
                {
                  type: 'FactSet',
                  facts: [
                    {
                      title: 'Meeting:',
                      value: recording.title || 'Untitled'
                    },
                    {
                      title: 'Duration:',
                      value: recording.duration || 'Unknown'
                    },
                    {
                      title: 'Date:',
                      value: new Date(recording.createdAt).toLocaleString()
                    },
                    {
                      title: 'Participants:',
                      value: `${recording.participantCount || 0}`
                    }
                  ]
                }
              ],
              actions: recording.url ? [
                {
                  type: 'Action.OpenUrl',
                  title: '▶️ Watch Recording',
                  url: recording.url
                }
              ] : []
            }
          }
        ]
      }

      const response = await fetch(
        `${this.graphApiBaseUrl}/teams/${teamId}/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(adaptiveCard)
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Microsoft Graph API error: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Posted recording to Teams channel', { teamId, channelId, recordingId: recording.id })

      return data
    } catch (error) {
      logger.error('Failed to post recording to Teams', { error: error.message, recordingId: recording.id })
      throw error
    }
  }

  /**
   * Send meeting notification to Teams channel
   * @param {string} accessToken - OAuth access token
   * @param {string} teamId - Team ID
   * @param {string} channelId - Channel ID
   * @param {Object} meeting - Meeting metadata
   * @returns {Promise<Object>} API response
   */
  async sendMeetingNotification(accessToken, teamId, channelId, meeting) {
    try {
      const adaptiveCard = {
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
              type: 'AdaptiveCard',
              version: '1.4',
              body: [
                {
                  type: 'TextBlock',
                  text: '📅 Meeting Reminder',
                  weight: 'bolder',
                  size: 'large'
                },
                {
                  type: 'TextBlock',
                  text: meeting.title || 'Untitled Meeting',
                  weight: 'bolder'
                },
                {
                  type: 'FactSet',
                  facts: [
                    {
                      title: 'When:',
                      value: new Date(meeting.scheduledAt).toLocaleString()
                    },
                    {
                      title: 'Duration:',
                      value: `${meeting.duration || 60} minutes`
                    }
                  ]
                }
              ],
              actions: meeting.joinUrl ? [
                {
                  type: 'Action.OpenUrl',
                  title: '🎥 Join Meeting',
                  url: meeting.joinUrl
                }
              ] : []
            }
          }
        ]
      }

      if (meeting.description) {
        adaptiveCard.attachments[0].content.body.push({
          type: 'TextBlock',
          text: meeting.description,
          wrap: true
        })
      }

      const response = await fetch(
        `${this.graphApiBaseUrl}/teams/${teamId}/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(adaptiveCard)
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Microsoft Graph API error: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Sent meeting notification to Teams', { teamId, channelId, meetingId: meeting.id })

      return data
    } catch (error) {
      logger.error('Failed to send meeting notification to Teams', { error: error.message, meetingId: meeting.id })
      throw error
    }
  }

  /**
   * List teams
   * @param {string} accessToken - OAuth access token
   * @returns {Promise<Array>} List of teams
   */
  async listTeams(accessToken) {
    try {
      const response = await fetch(`${this.graphApiBaseUrl}/me/joinedTeams`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Microsoft Graph API error: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Listed Teams teams', { count: data.value?.length || 0 })

      return data.value || []
    } catch (error) {
      logger.error('Failed to list Teams teams', { error: error.message })
      throw error
    }
  }

  /**
   * List channels in a team
   * @param {string} accessToken - OAuth access token
   * @param {string} teamId - Team ID
   * @returns {Promise<Array>} List of channels
   */
  async listChannels(accessToken, teamId) {
    try {
      const response = await fetch(`${this.graphApiBaseUrl}/teams/${teamId}/channels`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Microsoft Graph API error: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Listed Teams channels', { teamId, count: data.value?.length || 0 })

      return data.value || []
    } catch (error) {
      logger.error('Failed to list Teams channels', { error: error.message, teamId })
      throw error
    }
  }

  /**
   * Get user profile
   * @param {string} accessToken - OAuth access token
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile(accessToken) {
    try {
      const response = await fetch(`${this.graphApiBaseUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Microsoft Graph API error: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Retrieved Teams user profile', { userId: data.id })

      return data
    } catch (error) {
      logger.error('Failed to get Teams user profile', { error: error.message })
      throw error
    }
  }

  /**
   * Create online meeting
   * @param {string} accessToken - OAuth access token
   * @param {Object} meetingDetails - Meeting details
   * @returns {Promise<Object>} Created meeting
   */
  async createOnlineMeeting(accessToken, meetingDetails) {
    try {
      const payload = {
        subject: meetingDetails.title || 'DronDoc Meeting',
        startDateTime: meetingDetails.startDateTime,
        endDateTime: meetingDetails.endDateTime
      }

      const response = await fetch(`${this.graphApiBaseUrl}/me/onlineMeetings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Microsoft Graph API error: ${error.error?.message || 'Unknown error'}`)
      }

      const data = await response.json()

      logger.info('Created Teams online meeting', { meetingId: data.id })

      return data
    } catch (error) {
      logger.error('Failed to create Teams online meeting', { error: error.message })
      throw error
    }
  }

  /**
   * Handle webhook event
   * @param {Object} req - Express request object
   * @returns {Object} Processed event data
   */
  handleWebhook(req) {
    const { validationToken } = req.query

    // Handle subscription validation
    if (validationToken) {
      logger.info('Teams webhook validation request received')
      return {
        validationResponse: validationToken
      }
    }

    const payload = req.body

    logger.info('Received Teams webhook event', {
      changeType: payload.value?.[0]?.changeType,
      resource: payload.value?.[0]?.resource
    })

    // Process different event types
    if (payload.value && payload.value.length > 0) {
      const event = payload.value[0]

      switch (event.changeType) {
        case 'created':
          return this.handleMessageCreated(event)
        case 'updated':
          return this.handleMessageUpdated(event)
        default:
          logger.warn('Unknown Teams webhook event type', { changeType: event.changeType })
          return { processed: false }
      }
    }

    return { processed: true }
  }

  /**
   * Handle message created event
   * @param {Object} event - Webhook event
   * @returns {Object} Processing result
   */
  handleMessageCreated(event) {
    logger.info('Teams message created', { resource: event.resource })

    // TODO: Implement custom logic for message created events
    // - Trigger recording analysis
    // - Save to analytics
    // - etc.

    return { processed: true, eventType: 'message.created' }
  }

  /**
   * Handle message updated event
   * @param {Object} event - Webhook event
   * @returns {Object} Processing result
   */
  handleMessageUpdated(event) {
    logger.info('Teams message updated', { resource: event.resource })

    // TODO: Implement custom logic for message updated events

    return { processed: true, eventType: 'message.updated' }
  }
}

export default MicrosoftTeamsProvider
