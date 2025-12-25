/**
 * File-Based Notification Adapter
 *
 * This adapter provides a simple file-based storage for notifications as a fallback
 * when Integram is not available or configured. Uses JSON files for storage.
 *
 * This is a temporary solution until Integram is properly configured.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import logger from '../../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * File-Based Notification Adapter
 * Stores notifications in JSON files
 */
class FileNotificationAdapter {
  constructor(config = {}) {
    this.dataDir = config.dataDir || path.join(__dirname, '../../../data/notifications')
    this.notificationsFile = path.join(this.dataDir, 'notifications.json')
    this.preferencesFile = path.join(this.dataDir, 'preferences.json')
    this.initialized = false
  }

  /**
   * Initialize storage (create directories and files)
   * @private
   */
  async _initialize() {
    if (this.initialized) return

    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dataDir, { recursive: true })

      // Initialize notifications file if it doesn't exist
      try {
        await fs.access(this.notificationsFile)
      } catch {
        await fs.writeFile(this.notificationsFile, JSON.stringify([]), 'utf8')
      }

      // Initialize preferences file if it doesn't exist
      try {
        await fs.access(this.preferencesFile)
      } catch {
        await fs.writeFile(this.preferencesFile, JSON.stringify([]), 'utf8')
      }

      this.initialized = true
      logger.info({ dataDir: this.dataDir }, 'File notification storage initialized')
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to initialize file storage')
      throw new Error(`Failed to initialize file storage: ${error.message}`)
    }
  }

  /**
   * Read notifications from file
   * @private
   */
  async _readNotifications() {
    await this._initialize()
    const data = await fs.readFile(this.notificationsFile, 'utf8')
    return JSON.parse(data)
  }

  /**
   * Write notifications to file
   * @private
   */
  async _writeNotifications(notifications) {
    await this._initialize()
    await fs.writeFile(this.notificationsFile, JSON.stringify(notifications, null, 2), 'utf8')
  }

  /**
   * Authenticate (no-op for file storage)
   * @param {string} login - Username (ignored)
   * @param {string} password - Password (ignored)
   * @returns {Promise<boolean>} Always returns true
   */
  async authenticate(login, password) {
    await this._initialize()
    return true
  }

  /**
   * Create a notification
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Created notification
   */
  async createNotification(notificationData) {
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

    // Validate required fields
    if (!userId || !type || !title) {
      throw new Error('userId, type, and title are required fields')
    }

    const now = new Date().toISOString()
    const notification = {
      id: uuidv4(),
      user_id: userId,
      type,
      title,
      message: message || '',
      priority,
      read: false,
      link,
      icon,
      icon_color: iconColor,
      metadata,
      created_at: now,
      updated_at: now,
      deleted: false,
      deleted_at: null
    }

    const notifications = await this._readNotifications()
    notifications.push(notification)
    await this._writeNotifications(notifications)

    logger.info({ userId, type, title, id: notification.id }, 'Notification created in file storage')
    return notification
  }

  /**
   * Get notifications for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Notifications and metadata
   */
  async getNotifications(userId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      type = null,
      priority = null,
      read = null
    } = options

    const allNotifications = await this._readNotifications()

    // Filter notifications
    let notifications = allNotifications
      .filter(n => n.user_id === userId && !n.deleted)

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
  }

  /**
   * Get notification by ID
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object|null>} Notification or null
   */
  async getNotificationById(notificationId, userId) {
    const notifications = await this._readNotifications()
    const notification = notifications.find(n => n.id === notificationId)

    if (!notification || notification.user_id !== userId || notification.deleted) {
      return null
    }

    return notification
  }

  /**
   * Get unread count for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount(userId) {
    const notifications = await this._readNotifications()
    return notifications.filter(n => n.user_id === userId && !n.read && !n.deleted).length
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object>} Updated notification
   */
  async markAsRead(notificationId, userId) {
    const notifications = await this._readNotifications()
    const index = notifications.findIndex(n => n.id === notificationId)

    if (index === -1 || notifications[index].user_id !== userId || notifications[index].deleted) {
      throw new Error('Notification not found')
    }

    notifications[index].read = true
    notifications[index].updated_at = new Date().toISOString()

    await this._writeNotifications(notifications)
    logger.info({ notificationId, userId }, 'Notification marked as read')
    return notifications[index]
  }

  /**
   * Mark notification as unread
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object>} Updated notification
   */
  async markAsUnread(notificationId, userId) {
    const notifications = await this._readNotifications()
    const index = notifications.findIndex(n => n.id === notificationId)

    if (index === -1 || notifications[index].user_id !== userId || notifications[index].deleted) {
      throw new Error('Notification not found')
    }

    notifications[index].read = false
    notifications[index].updated_at = new Date().toISOString()

    await this._writeNotifications(notifications)
    logger.info({ notificationId, userId }, 'Notification marked as unread')
    return notifications[index]
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of notifications marked as read
   */
  async markAllAsRead(userId) {
    const notifications = await this._readNotifications()
    const now = new Date().toISOString()
    let count = 0

    for (const notification of notifications) {
      if (notification.user_id === userId && !notification.read && !notification.deleted) {
        notification.read = true
        notification.updated_at = now
        count++
      }
    }

    await this._writeNotifications(notifications)
    logger.info({ userId, count }, 'All notifications marked as read')
    return count
  }

  /**
   * Delete notification (soft delete)
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} Success status
   */
  async deleteNotification(notificationId, userId) {
    const notifications = await this._readNotifications()
    const index = notifications.findIndex(n => n.id === notificationId)

    if (index === -1 || notifications[index].user_id !== userId || notifications[index].deleted) {
      throw new Error('Notification not found')
    }

    const now = new Date().toISOString()
    notifications[index].deleted = true
    notifications[index].deleted_at = now
    notifications[index].updated_at = now

    await this._writeNotifications(notifications)
    logger.info({ notificationId, userId }, 'Notification soft-deleted')
    return true
  }

  /**
   * Clear all notifications for a user (soft delete)
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of notifications deleted
   */
  async clearAllNotifications(userId) {
    const notifications = await this._readNotifications()
    const now = new Date().toISOString()
    let count = 0

    for (const notification of notifications) {
      if (notification.user_id === userId && !notification.deleted) {
        notification.deleted = true
        notification.deleted_at = now
        notification.updated_at = now
        count++
      }
    }

    await this._writeNotifications(notifications)
    logger.info({ userId, count }, 'All notifications cleared')
    return count
  }
}

export default FileNotificationAdapter
