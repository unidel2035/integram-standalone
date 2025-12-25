/**
 * Notification Service - Integram MCP Backend
 *
 * This service provides notification management using Integram MCP as the storage backend.
 * Replaces PostgreSQL custom tables with Integram-based storage.
 *
 * Following guidelines from:
 * - Issue #3411: Database Design with Integram MCP Server
 * - Issue #4193: Notification System Implementation
 */

import IntegramNotificationAdapter from './IntegramNotificationAdapter.js'
import FileNotificationAdapter from './FileNotificationAdapter.js'
import logger from '../../utils/logger.js'

// Singleton adapter instance
let adapterInstance = null
let adapterInitialized = false

/**
 * Determine which adapter to use based on configuration
 * @returns {string} Adapter type ('integram' or 'file')
 */
function getAdapterType() {
  const typeId = process.env.NOTIFICATION_TYPE_ID
  const hasIntegramConfig = typeId && parseInt(typeId) > 0

  if (hasIntegramConfig) {
    return 'integram'
  }

  // Default to file-based storage
  return 'file'
}

/**
 * Get or create adapter instance
 * @returns {Promise<Object>} Adapter instance
 */
async function getAdapter() {
  if (!adapterInstance || !adapterInitialized) {
    const adapterType = getAdapterType()

    if (adapterType === 'integram') {
      logger.info('Using Integram MCP storage for notifications')
      adapterInstance = new IntegramNotificationAdapter({
        serverURL: process.env.INTEGRAM_SERVER_URL || 'https://dronedoc.ru',
        database: process.env.INTEGRAM_DATABASE || 'my',
        notificationTypeId: process.env.NOTIFICATION_TYPE_ID,
        preferencesTypeId: process.env.PREFERENCES_TYPE_ID
      })

      // Auto-authenticate if credentials are provided
      const login = process.env.INTEGRAM_LOGIN || 'd'
      const password = process.env.INTEGRAM_PASSWORD || 'd'

      if (login && password) {
        try {
          await adapterInstance.authenticate(login, password)
          logger.info('Integram adapter authenticated successfully')
        } catch (err) {
          logger.error({ error: err.message }, 'Failed to authenticate Integram adapter, falling back to file storage')
          // Fall back to file storage
          adapterInstance = new FileNotificationAdapter()
          await adapterInstance.authenticate()
        }
      }
    } else {
      logger.info('Using file-based storage for notifications (Integram not configured)')
      adapterInstance = new FileNotificationAdapter()
      await adapterInstance.authenticate()
    }

    adapterInitialized = true
  }

  return adapterInstance
}

/**
 * Create a new notification
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Created notification
 */
export async function createNotification(notificationData) {
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

  // Validate type
  const validTypes = ['system', 'activity', 'security', 'billing', 'team', 'achievement']
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid notification type. Must be one of: ${validTypes.join(', ')}`)
  }

  // Validate priority
  const validPriorities = ['critical', 'high', 'medium', 'low']
  if (!validPriorities.includes(priority)) {
    throw new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`)
  }

  try {
    const adapter = await getAdapter()
    const notification = await adapter.createNotification({
      userId,
      type,
      title,
      message,
      priority,
      link,
      icon,
      iconColor: iconColor || null,
      metadata
    })

    logger.info({ userId, type, title, priority }, 'Notification created')
    return notification
  } catch (error) {
    logger.error({ error: error.message, userId, type }, 'Failed to create notification')
    throw error
  }
}

/**
 * Get notifications for a user with pagination and filters
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Notifications and metadata
 */
export async function getNotifications(userId, options = {}) {
  const {
    limit = 50,
    offset = 0,
    type = null,
    priority = null,
    read = null,
    orderBy = 'created_at',
    orderDir = 'DESC'
  } = options

  try {
    const adapter = await getAdapter()
    const result = await adapter.getNotifications(userId, {
      limit,
      offset,
      type,
      priority,
      read
    })

    // Note: Ordering is done in the adapter (by created_at DESC)
    // orderBy and orderDir parameters are kept for API compatibility

    return result
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to get notifications')
    throw error
  }
}

/**
 * Get notification by ID
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object|null>} Notification or null
 */
export async function getNotificationById(notificationId, userId) {
  try {
    const adapter = await getAdapter()
    return await adapter.getNotificationById(notificationId, userId)
  } catch (error) {
    logger.error({ error: error.message, notificationId }, 'Failed to get notification by ID')
    throw error
  }
}

/**
 * Get unread count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Count of unread notifications
 */
export async function getUnreadCount(userId) {
  try {
    const adapter = await getAdapter()
    return await adapter.getUnreadCount(userId)
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to get unread count')
    throw error
  }
}

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} Updated notification
 */
export async function markAsRead(notificationId, userId) {
  try {
    const adapter = await getAdapter()
    const notification = await adapter.markAsRead(notificationId, userId)

    logger.info({ notificationId, userId }, 'Notification marked as read')
    return notification
  } catch (error) {
    logger.error({ error: error.message, notificationId }, 'Failed to mark notification as read')
    throw error
  }
}

/**
 * Mark notification as unread
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} Updated notification
 */
export async function markAsUnread(notificationId, userId) {
  try {
    const adapter = await getAdapter()
    const notification = await adapter.markAsUnread(notificationId, userId)

    logger.info({ notificationId, userId }, 'Notification marked as unread')
    return notification
  } catch (error) {
    logger.error({ error: error.message, notificationId }, 'Failed to mark notification as unread')
    throw error
  }
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of notifications marked as read
 */
export async function markAllAsRead(userId) {
  try {
    const adapter = await getAdapter()
    const count = await adapter.markAllAsRead(userId)

    logger.info({ userId, count }, 'All notifications marked as read')
    return count
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to mark all notifications as read')
    throw error
  }
}

/**
 * Delete notification (soft delete)
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<boolean>} Success status
 */
export async function deleteNotification(notificationId, userId) {
  try {
    const adapter = await getAdapter()
    const success = await adapter.deleteNotification(notificationId, userId)

    logger.info({ notificationId, userId }, 'Notification deleted')
    return success
  } catch (error) {
    logger.error({ error: error.message, notificationId }, 'Failed to delete notification')
    throw error
  }
}

/**
 * Clear all notifications for a user (soft delete)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of notifications deleted
 */
export async function clearAllNotifications(userId) {
  try {
    const adapter = await getAdapter()
    const count = await adapter.clearAllNotifications(userId)

    logger.info({ userId, count }, 'All notifications cleared')
    return count
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to clear all notifications')
    throw error
  }
}

/**
 * Get notifications grouped by date
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Grouped notifications
 */
export async function getGroupedNotifications(userId, options = {}) {
  const { read = null } = options

  try {
    const adapter = await getAdapter()
    const { notifications } = await adapter.getNotifications(userId, { read, limit: 1000 })

    // Group notifications by date
    const grouped = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    notifications.forEach((notification) => {
      const createdAt = new Date(notification.created_at)
      const createdDate = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate())

      if (createdDate.getTime() === today.getTime()) {
        grouped.today.push(notification)
      } else if (createdDate.getTime() === yesterday.getTime()) {
        grouped.yesterday.push(notification)
      } else if (createdDate >= weekAgo) {
        grouped.thisWeek.push(notification)
      } else {
        grouped.older.push(notification)
      }
    })

    return grouped
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to get grouped notifications')
    throw error
  }
}

/**
 * Permanently delete old soft-deleted notifications
 * Note: This is not applicable to Integram as we use soft delete only
 * @param {number} daysOld - Delete notifications older than this many days
 * @returns {Promise<number>} Always returns 0
 */
export async function permanentlyDeleteOldNotifications(daysOld = 30) {
  logger.warn({ daysOld }, 'Permanent deletion not supported with Integram backend')
  return 0
}
