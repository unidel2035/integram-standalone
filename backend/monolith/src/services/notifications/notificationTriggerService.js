import { createNotification } from './notificationService.js'
import logger from '../../utils/logger.js'

/**
 * Notification Trigger Service
 * Creates notifications for various system events
 * Integrates with WebSocket server for real-time delivery
 */
class NotificationTriggerService {
  constructor() {
    this.websocket = null
  }

  /**
   * Set WebSocket instance for real-time notifications
   * @param {OrchestratorWebSocket} websocket - WebSocket server instance
   */
  setWebSocket(websocket) {
    this.websocket = websocket
    logger.info('WebSocket set for notification trigger service')
  }

  /**
   * Create and send a notification
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Created notification
   */
  async createAndSend(notificationData) {
    try {
      // Create notification in database
      const notification = await createNotification(notificationData)

      // Send via WebSocket if available
      if (this.websocket) {
        this.websocket.sendNotificationToUser(notificationData.userId, notification)
      }

      return notification
    } catch (error) {
      logger.error({ error: error.message, notificationData }, 'Failed to create and send notification')
      throw error
    }
  }

  /**
   * Trigger system notification
   * @param {string} userId - User ID
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} options - Additional options
   */
  async triggerSystemNotification(userId, title, message, options = {}) {
    return this.createAndSend({
      userId,
      type: 'system',
      title,
      message,
      priority: options.priority || 'medium',
      link: options.link,
      icon: options.icon || 'pi-info-circle',
      iconColor: options.iconColor || 'blue',
      metadata: options.metadata || {}
    })
  }

  /**
   * Trigger activity notification (mentions, comments, shares)
   * @param {string} userId - User ID
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} options - Additional options
   */
  async triggerActivityNotification(userId, title, message, options = {}) {
    return this.createAndSend({
      userId,
      type: 'activity',
      title,
      message,
      priority: options.priority || 'medium',
      link: options.link,
      icon: options.icon || 'pi-comment',
      iconColor: options.iconColor || 'purple',
      metadata: options.metadata || {}
    })
  }

  /**
   * Trigger security notification (login, password change, etc.)
   * @param {string} userId - User ID
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} options - Additional options
   */
  async triggerSecurityNotification(userId, title, message, options = {}) {
    return this.createAndSend({
      userId,
      type: 'security',
      title,
      message,
      priority: options.priority || 'high',
      link: options.link,
      icon: options.icon || 'pi-shield',
      iconColor: options.iconColor || 'red',
      metadata: options.metadata || {}
    })
  }

  /**
   * Trigger billing notification (payments, subscriptions, etc.)
   * @param {string} userId - User ID
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} options - Additional options
   */
  async triggerBillingNotification(userId, title, message, options = {}) {
    return this.createAndSend({
      userId,
      type: 'billing',
      title,
      message,
      priority: options.priority || 'high',
      link: options.link,
      icon: options.icon || 'pi-credit-card',
      iconColor: options.iconColor || 'green',
      metadata: options.metadata || {}
    })
  }

  /**
   * Trigger team notification (invitations, role changes, etc.)
   * @param {string} userId - User ID
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} options - Additional options
   */
  async triggerTeamNotification(userId, title, message, options = {}) {
    return this.createAndSend({
      userId,
      type: 'team',
      title,
      message,
      priority: options.priority || 'medium',
      link: options.link,
      icon: options.icon || 'pi-users',
      iconColor: options.iconColor || 'cyan',
      metadata: options.metadata || {}
    })
  }

  /**
   * Trigger achievement notification (milestones, goals, etc.)
   * @param {string} userId - User ID
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} options - Additional options
   */
  async triggerAchievementNotification(userId, title, message, options = {}) {
    return this.createAndSend({
      userId,
      type: 'achievement',
      title,
      message,
      priority: options.priority || 'low',
      link: options.link,
      icon: options.icon || 'pi-trophy',
      iconColor: options.iconColor || 'orange',
      metadata: options.metadata || {}
    })
  }

  /**
   * Broadcast unread count update via WebSocket
   * @param {string} userId - User ID
   * @param {number} count - Unread count
   */
  sendUnreadCountUpdate(userId, count) {
    if (this.websocket) {
      this.websocket.sendUnreadCountToUser(userId, count)
    }
  }
}

// Export singleton instance
export const notificationTrigger = new NotificationTriggerService()

// Export class for testing
export { NotificationTriggerService }
