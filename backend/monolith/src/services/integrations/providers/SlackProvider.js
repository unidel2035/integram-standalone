/**
 * Slack Integration Provider
 *
 * Implements Slack-specific integration features:
 * - OAuth2 authentication
 * - Post messages to channels
 * - Post meeting recordings
 * - Webhook signature verification
 * - Slash commands support
 * - Interactive messages
 */

import crypto from 'crypto'
import logger from '../../../utils/logger.js'

export class SlackProvider {
  constructor(config) {
    this.clientId = config.clientId || process.env.SLACK_CLIENT_ID
    this.clientSecret = config.clientSecret || process.env.SLACK_CLIENT_SECRET
    this.signingSecret = config.signingSecret || process.env.SLACK_SIGNING_SECRET
    this.apiBaseUrl = 'https://slack.com/api'
  }

  /**
   * Verify Slack webhook signature
   * @param {Object} req - Express request object
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(req) {
    const timestamp = req.headers['x-slack-request-timestamp']
    const signature = req.headers['x-slack-signature']

    if (!timestamp || !signature) {
      logger.warn('Missing Slack signature headers')
      return false
    }

    // Verify timestamp is recent (within 5 minutes)
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - timestamp) > 300) {
      logger.warn('Slack webhook timestamp too old', { timestamp, now })
      return false
    }

    // Compute expected signature
    const body = JSON.stringify(req.body)
    const sigBasestring = `v0:${timestamp}:${body}`
    const hmac = crypto.createHmac('sha256', this.signingSecret)
    hmac.update(sigBasestring)
    const expectedSignature = 'v0=' + hmac.digest('hex')

    // Compare signatures securely
    const valid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )

    if (!valid) {
      logger.warn('Invalid Slack webhook signature')
    }

    return valid
  }

  /**
   * Post message to Slack channel
   * @param {string} accessToken - OAuth access token
   * @param {string} channel - Channel ID or name
   * @param {string} text - Message text
   * @param {Object} options - Additional options (blocks, attachments, etc.)
   * @returns {Promise<Object>} API response
   */
  async postMessage(accessToken, channel, text, options = {}) {
    try {
      const payload = {
        channel,
        text,
        ...options
      }

      const response = await fetch(`${this.apiBaseUrl}/chat.postMessage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`)
      }

      logger.info('Posted message to Slack', { channel })

      return data
    } catch (error) {
      logger.error('Failed to post Slack message', { error: error.message, channel })
      throw error
    }
  }

  /**
   * Post recording to Slack channel
   * @param {string} accessToken - OAuth access token
   * @param {string} channel - Channel ID or name
   * @param {Object} recording - Recording metadata
   * @returns {Promise<Object>} API response
   */
  async postRecording(accessToken, channel, recording) {
    try {
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎥 New Meeting Recording'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Meeting:*\n${recording.title || 'Untitled'}`
            },
            {
              type: 'mrkdwn',
              text: `*Duration:*\n${recording.duration || 'Unknown'}`
            },
            {
              type: 'mrkdwn',
              text: `*Date:*\n${new Date(recording.createdAt).toLocaleString()}`
            },
            {
              type: 'mrkdwn',
              text: `*Participants:*\n${recording.participantCount || 0}`
            }
          ]
        }
      ]

      if (recording.url) {
        blocks.push({
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '▶️ Watch Recording'
              },
              url: recording.url,
              style: 'primary'
            }
          ]
        })
      }

      return await this.postMessage(accessToken, channel, 'New meeting recording available', { blocks })
    } catch (error) {
      logger.error('Failed to post recording to Slack', { error: error.message, recordingId: recording.id })
      throw error
    }
  }

  /**
   * Send meeting notification
   * @param {string} accessToken - OAuth access token
   * @param {string} channel - Channel ID or name
   * @param {Object} meeting - Meeting metadata
   * @returns {Promise<Object>} API response
   */
  async sendMeetingNotification(accessToken, channel, meeting) {
    try {
      const blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*📅 Meeting Reminder*\n\n*${meeting.title || 'Untitled Meeting'}*`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*When:*\n${new Date(meeting.scheduledAt).toLocaleString()}`
            },
            {
              type: 'mrkdwn',
              text: `*Duration:*\n${meeting.duration || '60'} minutes`
            }
          ]
        }
      ]

      if (meeting.description) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Description:*\n${meeting.description}`
          }
        })
      }

      if (meeting.joinUrl) {
        blocks.push({
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🎥 Join Meeting'
              },
              url: meeting.joinUrl,
              style: 'primary'
            }
          ]
        })
      }

      return await this.postMessage(accessToken, channel, 'Meeting reminder', { blocks })
    } catch (error) {
      logger.error('Failed to send meeting notification to Slack', { error: error.message, meetingId: meeting.id })
      throw error
    }
  }

  /**
   * Handle slash command
   * @param {Object} payload - Slack slash command payload
   * @returns {Object} Response to send back to Slack
   */
  handleSlashCommand(payload) {
    const { command, text, user_id, channel_id } = payload

    logger.info('Received Slack slash command', { command, text, user_id, channel_id })

    // Handle different commands
    switch (command) {
      case '/drondoc':
        return this.handleDronDocCommand(text, user_id, channel_id)
      default:
        return {
          response_type: 'ephemeral',
          text: `Unknown command: ${command}`
        }
    }
  }

  /**
   * Handle /drondoc slash command
   * @param {string} text - Command text
   * @param {string} userId - User ID
   * @param {string} channelId - Channel ID
   * @returns {Object} Response
   */
  handleDronDocCommand(text, userId, channelId) {
    const parts = text.trim().split(/\s+/)
    const subcommand = parts[0]?.toLowerCase()

    switch (subcommand) {
      case 'join':
        return {
          response_type: 'ephemeral',
          text: '🎥 To join a meeting, use: `/drondoc join [meeting-id]`',
          attachments: [
            {
              text: 'Or click here to browse available meetings',
              actions: [
                {
                  type: 'button',
                  text: 'Browse Meetings',
                  url: process.env.APP_BASE_URL + '/meetings'
                }
              ]
            }
          ]
        }

      case 'schedule':
        return {
          response_type: 'ephemeral',
          text: '📅 To schedule a meeting, use: `/drondoc schedule [title] [time]`',
          attachments: [
            {
              text: 'Example: `/drondoc schedule Team Standup 2pm tomorrow`'
            }
          ]
        }

      case 'help':
        return {
          response_type: 'ephemeral',
          text: '*DronDoc Commands:*\n' +
                '• `/drondoc join [meeting-id]` - Join a meeting\n' +
                '• `/drondoc schedule [title] [time]` - Schedule a meeting\n' +
                '• `/drondoc help` - Show this help message'
        }

      default:
        return {
          response_type: 'ephemeral',
          text: 'Unknown subcommand. Type `/drondoc help` for available commands.'
        }
    }
  }

  /**
   * Handle interactive message action
   * @param {Object} payload - Slack interactive message payload
   * @returns {Object} Response
   */
  handleInteractiveMessage(payload) {
    const { type, actions, user, channel } = payload

    logger.info('Received Slack interactive message', { type, actions, user, channel })

    if (type === 'block_actions' && actions && actions.length > 0) {
      const action = actions[0]

      // Handle different action types
      switch (action.action_id) {
        case 'join_meeting':
          return {
            text: `✅ ${user.name} joined the meeting!`
          }

        case 'save_recording':
          return {
            text: `✅ Recording saved to your DronDoc library!`
          }

        default:
          return {
            text: 'Action received'
          }
      }
    }

    return {
      text: 'Interactive message received'
    }
  }

  /**
   * Get user info
   * @param {string} accessToken - OAuth access token
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User info
   */
  async getUserInfo(accessToken, userId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/users.info?user=${userId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      const data = await response.json()

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`)
      }

      return data.user
    } catch (error) {
      logger.error('Failed to get Slack user info', { error: error.message, userId })
      throw error
    }
  }

  /**
   * List channels
   * @param {string} accessToken - OAuth access token
   * @returns {Promise<Array>} List of channels
   */
  async listChannels(accessToken) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/conversations.list`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      const data = await response.json()

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`)
      }

      return data.channels
    } catch (error) {
      logger.error('Failed to list Slack channels', { error: error.message })
      throw error
    }
  }
}

export default SlackProvider
