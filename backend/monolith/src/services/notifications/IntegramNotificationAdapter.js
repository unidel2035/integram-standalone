/**
 * Integram Notification Adapter
 *
 * This adapter wraps the IntegramMCPClient to provide notification-specific
 * operations with proper requisite ID mapping and data type conversions.
 *
 * Following guidelines from Issue #3411: Database Design with Integram MCP Server
 */

import IntegramMCPClient from '../mcp/IntegramMCPClient.js'
import logger from '../../utils/logger.js'

/**
 * Integram Notification Adapter
 * Manages notification data storage in Integram database
 */
class IntegramNotificationAdapter {
  /**
   * Create adapter instance
   * @param {Object} config - Configuration
   * @param {string} config.serverURL - Integram server URL
   * @param {string} config.database - Database name
   */
  constructor(config = {}) {
    this.client = new IntegramMCPClient({
      serverURL: config.serverURL || process.env.INTEGRAM_SERVER_URL || 'https://dronedoc.ru',
      database: config.database || process.env.INTEGRAM_DATABASE || 'my'
    })

    // Table type IDs (configured based on actual Integram setup)
    // These need to be set after tables are created
    this.NOTIFICATION_TYPE_ID = config.notificationTypeId || parseInt(process.env.NOTIFICATION_TYPE_ID || '0')
    this.PREFERENCES_TYPE_ID = config.preferencesTypeId || parseInt(process.env.PREFERENCES_TYPE_ID || '0')

    // Requisite ID mapping for Уведомления (Notifications)
    // These IDs are specific to the Integram database and must be configured
    this.NOTIFICATION_REQUISITES = {
      USER_ID: parseInt(process.env.NOTIF_REQ_USER_ID || '0'),
      TYPE: parseInt(process.env.NOTIF_REQ_TYPE || '0'),
      TITLE: parseInt(process.env.NOTIF_REQ_TITLE || '0'),
      MESSAGE: parseInt(process.env.NOTIF_REQ_MESSAGE || '0'),
      PRIORITY: parseInt(process.env.NOTIF_REQ_PRIORITY || '0'),
      READ: parseInt(process.env.NOTIF_REQ_READ || '0'),
      LINK: parseInt(process.env.NOTIF_REQ_LINK || '0'),
      ICON: parseInt(process.env.NOTIF_REQ_ICON || '0'),
      ICON_COLOR: parseInt(process.env.NOTIF_REQ_ICON_COLOR || '0'),
      METADATA: parseInt(process.env.NOTIF_REQ_METADATA || '0'),
      CREATED_AT: parseInt(process.env.NOTIF_REQ_CREATED_AT || '0'),
      UPDATED_AT: parseInt(process.env.NOTIF_REQ_UPDATED_AT || '0'),
      DELETED: parseInt(process.env.NOTIF_REQ_DELETED || '0'),
      DELETED_AT: parseInt(process.env.NOTIF_REQ_DELETED_AT || '0')
    }

    // Requisite ID mapping for Настройки уведомлений (Notification Preferences)
    this.PREFERENCES_REQUISITES = {
      USER_ID: parseInt(process.env.PREF_REQ_USER_ID || '0'),
      CHANNELS: parseInt(process.env.PREF_REQ_CHANNELS || '0'),
      EMAIL_SETTINGS: parseInt(process.env.PREF_REQ_EMAIL_SETTINGS || '0'),
      PUSH_SETTINGS: parseInt(process.env.PREF_REQ_PUSH_SETTINGS || '0'),
      DO_NOT_DISTURB: parseInt(process.env.PREF_REQ_DO_NOT_DISTURB || '0'),
      METADATA: parseInt(process.env.PREF_REQ_METADATA || '0'),
      CREATED_AT: parseInt(process.env.PREF_REQ_CREATED_AT || '0'),
      UPDATED_AT: parseInt(process.env.PREF_REQ_UPDATED_AT || '0')
    }

    this.authenticated = false
  }

  /**
   * Authenticate with Integram
   * @param {string} login - Username
   * @param {string} password - Password
   * @returns {Promise<boolean>} Success status
   */
  async authenticate(login, password) {
    try {
      await this.client.authenticate(login, password)
      this.authenticated = true
      logger.info({ userId: this.client.userId }, 'Integram adapter authenticated')
      return true
    } catch (error) {
      logger.error({ error: error.message }, 'Integram authentication failed')
      throw new Error(`Integram authentication failed: ${error.message}`)
    }
  }

  /**
   * Ensure adapter is authenticated
   * @private
   */
  _ensureAuthenticated() {
    if (!this.authenticated) {
      throw new Error('Integram adapter not authenticated. Call authenticate() first.')
    }
  }

  /**
   * Ensure configuration is valid
   * @private
   */
  _ensureConfigured() {
    if (this.NOTIFICATION_TYPE_ID === 0 || this.PREFERENCES_TYPE_ID === 0) {
      throw new Error(
        'Integram tables not configured. Please set NOTIFICATION_TYPE_ID and PREFERENCES_TYPE_ID environment variables.'
      )
    }

    const allZero = Object.values(this.NOTIFICATION_REQUISITES).every(id => id === 0)
    if (allZero) {
      throw new Error(
        'Notification requisites not configured. Please set NOTIF_REQ_* environment variables.'
      )
    }
  }

  /**
   * Create a notification object in Integram
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Created notification
   */
  async createNotification(notificationData) {
    this._ensureAuthenticated()
    this._ensureConfigured()

    const {
      userId,
      type,
      title,
      message,
      priority = 'medium',
      link = null,
      icon = null,
      iconColor = null,
      metadata = {}
    } = notificationData

    const now = new Date().toISOString()

    const requisites = {
      [this.NOTIFICATION_REQUISITES.USER_ID]: userId,
      [this.NOTIFICATION_REQUISITES.TYPE]: type,
      [this.NOTIFICATION_REQUISITES.TITLE]: title,
      [this.NOTIFICATION_REQUISITES.MESSAGE]: message || '',
      [this.NOTIFICATION_REQUISITES.PRIORITY]: priority,
      [this.NOTIFICATION_REQUISITES.READ]: 'false',
      [this.NOTIFICATION_REQUISITES.LINK]: link || '',
      [this.NOTIFICATION_REQUISITES.ICON]: icon || '',
      [this.NOTIFICATION_REQUISITES.ICON_COLOR]: iconColor || '',
      [this.NOTIFICATION_REQUISITES.METADATA]: JSON.stringify(metadata),
      [this.NOTIFICATION_REQUISITES.CREATED_AT]: now,
      [this.NOTIFICATION_REQUISITES.UPDATED_AT]: now,
      [this.NOTIFICATION_REQUISITES.DELETED]: 'false',
      [this.NOTIFICATION_REQUISITES.DELETED_AT]: ''
    }

    try {
      const result = await this.client.createObject({
        typeId: this.NOTIFICATION_TYPE_ID,
        value: title, // Object name/value
        requisites
      })

      logger.info({ userId, type, title, objectId: result.id }, 'Notification created in Integram')

      // Transform Integram object to notification format
      return this._transformNotificationObject(result)
    } catch (error) {
      logger.error({ error: error.message, userId, type }, 'Failed to create notification in Integram')
      throw new Error(`Failed to create notification: ${error.message}`)
    }
  }

  /**
   * Get notifications for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Notifications and metadata
   */
  async getNotifications(userId, options = {}) {
    this._ensureAuthenticated()
    this._ensureConfigured()

    const {
      limit = 50,
      offset = 0,
      type = null,
      priority = null,
      read = null
    } = options

    try {
      // Fetch all notifications (Integram doesn't support complex filtering)
      const result = await this.client.getObjectList({
        typeId: this.NOTIFICATION_TYPE_ID,
        params: { offset: 0, limit: 1000 } // Fetch more for filtering
      })

      // Transform and filter in application code
      let notifications = result
        .map(obj => this._transformNotificationObject(obj))
        .filter(notif => notif.user_id === userId && !notif.deleted)

      // Apply filters
      if (type) {
        notifications = notifications.filter(n => n.type === type)
      }
      if (priority) {
        notifications = notifications.filter(n => n.priority === priority)
      }
      if (read !== null) {
        notifications = notifications.filter(n => n.read === read)
      }

      // Sort by created_at DESC
      notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      // Apply pagination
      const total = notifications.length
      const paginatedNotifications = notifications.slice(offset, offset + limit)

      return {
        notifications: paginatedNotifications,
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to get notifications from Integram')
      throw new Error(`Failed to get notifications: ${error.message}`)
    }
  }

  /**
   * Get notification by ID
   * @param {string} notificationId - Notification object ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object|null>} Notification or null
   */
  async getNotificationById(notificationId, userId) {
    this._ensureAuthenticated()
    this._ensureConfigured()

    try {
      const result = await this.client.getObjectEditData(parseInt(notificationId))
      const notification = this._transformNotificationObject(result)

      // Authorization check
      if (notification.user_id !== userId || notification.deleted) {
        return null
      }

      return notification
    } catch (error) {
      logger.error({ error: error.message, notificationId }, 'Failed to get notification by ID')
      return null
    }
  }

  /**
   * Get unread count for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount(userId) {
    this._ensureAuthenticated()
    this._ensureConfigured()

    try {
      const result = await this.client.getObjectList({
        typeId: this.NOTIFICATION_TYPE_ID,
        params: { offset: 0, limit: 1000 }
      })

      const count = result
        .map(obj => this._transformNotificationObject(obj))
        .filter(notif => notif.user_id === userId && !notif.read && !notif.deleted)
        .length

      return count
    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to get unread count')
      throw new Error(`Failed to get unread count: ${error.message}`)
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification object ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object>} Updated notification
   */
  async markAsRead(notificationId, userId) {
    return this._updateNotificationStatus(notificationId, userId, { read: true })
  }

  /**
   * Mark notification as unread
   * @param {string} notificationId - Notification object ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object>} Updated notification
   */
  async markAsUnread(notificationId, userId) {
    return this._updateNotificationStatus(notificationId, userId, { read: false })
  }

  /**
   * Update notification status
   * @private
   */
  async _updateNotificationStatus(notificationId, userId, updates) {
    this._ensureAuthenticated()
    this._ensureConfigured()

    // Verify ownership
    const notification = await this.getNotificationById(notificationId, userId)
    if (!notification) {
      throw new Error('Notification not found')
    }

    const requisites = {}

    if ('read' in updates) {
      requisites[this.NOTIFICATION_REQUISITES.READ] = updates.read ? 'true' : 'false'
    }

    requisites[this.NOTIFICATION_REQUISITES.UPDATED_AT] = new Date().toISOString()

    try {
      const result = await this.client.setObjectRequisites({
        objectId: parseInt(notificationId),
        requisites
      })

      logger.info({ notificationId, userId, updates }, 'Notification updated in Integram')
      return this._transformNotificationObject(result)
    } catch (error) {
      logger.error({ error: error.message, notificationId }, 'Failed to update notification')
      throw new Error(`Failed to update notification: ${error.message}`)
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of notifications marked as read
   */
  async markAllAsRead(userId) {
    this._ensureAuthenticated()
    this._ensureConfigured()

    try {
      const { notifications } = await this.getNotifications(userId, { read: false })

      let count = 0
      for (const notif of notifications) {
        await this.markAsRead(notif.id, userId)
        count++
      }

      logger.info({ userId, count }, 'All notifications marked as read')
      return count
    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to mark all as read')
      throw new Error(`Failed to mark all as read: ${error.message}`)
    }
  }

  /**
   * Delete notification (soft delete)
   * @param {string} notificationId - Notification object ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} Success status
   */
  async deleteNotification(notificationId, userId) {
    this._ensureAuthenticated()
    this._ensureConfigured()

    // Verify ownership
    const notification = await this.getNotificationById(notificationId, userId)
    if (!notification) {
      throw new Error('Notification not found')
    }

    const now = new Date().toISOString()

    try {
      await this.client.setObjectRequisites({
        objectId: parseInt(notificationId),
        requisites: {
          [this.NOTIFICATION_REQUISITES.DELETED]: 'true',
          [this.NOTIFICATION_REQUISITES.DELETED_AT]: now,
          [this.NOTIFICATION_REQUISITES.UPDATED_AT]: now
        }
      })

      logger.info({ notificationId, userId }, 'Notification soft-deleted in Integram')
      return true
    } catch (error) {
      logger.error({ error: error.message, notificationId }, 'Failed to delete notification')
      throw new Error(`Failed to delete notification: ${error.message}`)
    }
  }

  /**
   * Clear all notifications for a user (soft delete)
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of notifications deleted
   */
  async clearAllNotifications(userId) {
    this._ensureAuthenticated()
    this._ensureConfigured()

    try {
      const { notifications } = await this.getNotifications(userId)

      let count = 0
      for (const notif of notifications) {
        await this.deleteNotification(notif.id, userId)
        count++
      }

      logger.info({ userId, count }, 'All notifications cleared')
      return count
    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to clear all notifications')
      throw new Error(`Failed to clear all notifications: ${error.message}`)
    }
  }

  /**
   * Transform Integram object to notification format
   * @private
   * @param {Object} obj - Integram object
   * @returns {Object} Notification object
   */
  _transformNotificationObject(obj) {
    // Handle different response formats
    const requisites = obj.reqs || obj.requisites || {}
    const id = obj.id || obj.objectId
    const value = obj.val || obj.value

    return {
      id: String(id),
      user_id: requisites[this.NOTIFICATION_REQUISITES.USER_ID] || '',
      type: requisites[this.NOTIFICATION_REQUISITES.TYPE] || '',
      title: requisites[this.NOTIFICATION_REQUISITES.TITLE] || value || '',
      message: requisites[this.NOTIFICATION_REQUISITES.MESSAGE] || '',
      priority: requisites[this.NOTIFICATION_REQUISITES.PRIORITY] || 'medium',
      read: requisites[this.NOTIFICATION_REQUISITES.READ] === 'true',
      link: requisites[this.NOTIFICATION_REQUISITES.LINK] || null,
      icon: requisites[this.NOTIFICATION_REQUISITES.ICON] || null,
      icon_color: requisites[this.NOTIFICATION_REQUISITES.ICON_COLOR] || null,
      metadata: this._parseJSON(requisites[this.NOTIFICATION_REQUISITES.METADATA]) || {},
      created_at: requisites[this.NOTIFICATION_REQUISITES.CREATED_AT] || new Date().toISOString(),
      updated_at: requisites[this.NOTIFICATION_REQUISITES.UPDATED_AT] || new Date().toISOString(),
      deleted: requisites[this.NOTIFICATION_REQUISITES.DELETED] === 'true',
      deleted_at: requisites[this.NOTIFICATION_REQUISITES.DELETED_AT] || null
    }
  }

  /**
   * Safely parse JSON string
   * @private
   */
  _parseJSON(str) {
    try {
      return str ? JSON.parse(str) : null
    } catch {
      return null
    }
  }
}

export default IntegramNotificationAdapter
