import { query, getClient } from '../../config/database.js'
import logger from '../../utils/logger.js'

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

  const result = await query(
    `INSERT INTO notifications (
      user_id, type, title, message, priority, link, icon, icon_color, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, user_id, type, title, message, priority, read, link, icon, icon_color, metadata, created_at, updated_at`,
    [userId, type, title, message, priority, link, icon, iconColor, JSON.stringify(metadata)]
  )

  logger.info({ userId, type, title, priority }, 'Notification created')
  return result.rows[0]
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

  const whereClauses = ['user_id = $1', 'deleted_at IS NULL']
  const params = [userId]
  let paramCount = 2

  if (type) {
    whereClauses.push(`type = $${paramCount}`)
    params.push(type)
    paramCount++
  }

  if (priority) {
    whereClauses.push(`priority = $${paramCount}`)
    params.push(priority)
    paramCount++
  }

  if (read !== null) {
    whereClauses.push(`read = $${paramCount}`)
    params.push(read)
    paramCount++
  }

  const whereClause = whereClauses.join(' AND ')
  const validOrderBy = ['created_at', 'updated_at', 'priority']
  const validOrderDir = ['ASC', 'DESC']
  const safeOrderBy = validOrderBy.includes(orderBy) ? orderBy : 'created_at'
  const safeOrderDir = validOrderDir.includes(orderDir.toUpperCase()) ? orderDir.toUpperCase() : 'DESC'

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM notifications WHERE ${whereClause}`,
    params
  )
  const total = parseInt(countResult.rows[0].total, 10)

  // Get notifications
  const result = await query(
    `SELECT id, user_id, type, title, message, priority, read, link, icon, icon_color, metadata, created_at, updated_at
     FROM notifications
     WHERE ${whereClause}
     ORDER BY ${safeOrderBy} ${safeOrderDir}
     LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
    [...params, limit, offset]
  )

  return {
    notifications: result.rows,
    total,
    limit,
    offset,
    hasMore: offset + limit < total
  }
}

/**
 * Get notification by ID
 * @param {string} notificationId - Notification UUID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object|null>} Notification or null
 */
export async function getNotificationById(notificationId, userId) {
  const result = await query(
    `SELECT id, user_id, type, title, message, priority, read, link, icon, icon_color, metadata, created_at, updated_at
     FROM notifications
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [notificationId, userId]
  )
  return result.rows[0] || null
}

/**
 * Get unread count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Count of unread notifications
 */
export async function getUnreadCount(userId) {
  const result = await query(
    `SELECT COUNT(*) as count
     FROM notifications
     WHERE user_id = $1 AND read = false AND deleted_at IS NULL`,
    [userId]
  )
  return parseInt(result.rows[0].count, 10)
}

/**
 * Mark notification as read
 * @param {string} notificationId - Notification UUID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} Updated notification
 */
export async function markAsRead(notificationId, userId) {
  const result = await query(
    `UPDATE notifications
     SET read = true
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id, user_id, type, title, message, priority, read, link, icon, icon_color, metadata, created_at, updated_at`,
    [notificationId, userId]
  )

  if (result.rows.length === 0) {
    throw new Error('Notification not found')
  }

  logger.info({ notificationId, userId }, 'Notification marked as read')
  return result.rows[0]
}

/**
 * Mark notification as unread
 * @param {string} notificationId - Notification UUID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} Updated notification
 */
export async function markAsUnread(notificationId, userId) {
  const result = await query(
    `UPDATE notifications
     SET read = false
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id, user_id, type, title, message, priority, read, link, icon, icon_color, metadata, created_at, updated_at`,
    [notificationId, userId]
  )

  if (result.rows.length === 0) {
    throw new Error('Notification not found')
  }

  logger.info({ notificationId, userId }, 'Notification marked as unread')
  return result.rows[0]
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of notifications marked as read
 */
export async function markAllAsRead(userId) {
  const result = await query(
    `UPDATE notifications
     SET read = true
     WHERE user_id = $1 AND read = false AND deleted_at IS NULL`,
    [userId]
  )

  logger.info({ userId, count: result.rowCount }, 'All notifications marked as read')
  return result.rowCount
}

/**
 * Delete notification (soft delete)
 * @param {string} notificationId - Notification UUID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<boolean>} Success status
 */
export async function deleteNotification(notificationId, userId) {
  const result = await query(
    `UPDATE notifications
     SET deleted_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [notificationId, userId]
  )

  if (result.rowCount === 0) {
    throw new Error('Notification not found')
  }

  logger.info({ notificationId, userId }, 'Notification deleted')
  return true
}

/**
 * Clear all notifications for a user (soft delete)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of notifications deleted
 */
export async function clearAllNotifications(userId) {
  const result = await query(
    `UPDATE notifications
     SET deleted_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  )

  logger.info({ userId, count: result.rowCount }, 'All notifications cleared')
  return result.rowCount
}

/**
 * Get notifications grouped by date
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Grouped notifications
 */
export async function getGroupedNotifications(userId, options = {}) {
  const { read = null } = options

  const whereClauses = ['user_id = $1', 'deleted_at IS NULL']
  const params = [userId]
  let paramCount = 2

  if (read !== null) {
    whereClauses.push(`read = $${paramCount}`)
    params.push(read)
    paramCount++
  }

  const whereClause = whereClauses.join(' AND ')

  const result = await query(
    `SELECT
      id, user_id, type, title, message, priority, read, link, icon, icon_color, metadata, created_at, updated_at,
      CASE
        WHEN created_at::date = CURRENT_DATE THEN 'today'
        WHEN created_at::date = CURRENT_DATE - INTERVAL '1 day' THEN 'yesterday'
        WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 'thisWeek'
        ELSE 'older'
      END as date_group
     FROM notifications
     WHERE ${whereClause}
     ORDER BY created_at DESC`,
    params
  )

  // Group notifications by date
  const grouped = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: []
  }

  result.rows.forEach((notification) => {
    const group = notification.date_group
    delete notification.date_group
    grouped[group].push(notification)
  })

  return grouped
}

/**
 * Permanently delete old soft-deleted notifications
 * @param {number} daysOld - Delete notifications older than this many days
 * @returns {Promise<number>} Number of notifications permanently deleted
 */
export async function permanentlyDeleteOldNotifications(daysOld = 30) {
  const result = await query(
    `DELETE FROM notifications
     WHERE deleted_at IS NOT NULL
       AND deleted_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'`
  )

  logger.info({ count: result.rowCount, daysOld }, 'Old notifications permanently deleted')
  return result.rowCount
}
