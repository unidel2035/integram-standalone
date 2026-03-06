import { logger } from '@/utils/logger'
import { getOrchestratorUrl, getWebSocketUrl } from '@/utils/apiConfig'
import integramApiClient from '@/services/integramApiClient'

/**
 * Notification Service
 *
 * Service for managing notifications using Integram database.
 * Uses table "Уведомление" (ID: 198140) in "my" database.
 *
 * Table structure:
 * - 198142: Заголовок (title) - SHORT
 * - 198143: Сообщение (message) - LONG
 * - 198144: Приоритет (priority) - SHORT
 * - 198145: Создано (createdAt) - DATETIME
 * - 198146: Тип (type) - SHORT
 * - 198147: Ссылка (link) - SHORT
 * - 198148: Прочитано (read) - NUMBER (0/1)
 * - 198151: Пользователь (userId) - REFERENCE to User (18)
 */

// Integram table configuration
const NOTIFICATION_TYPE_ID = 198140
const NOTIFICATION_DATABASE = 'my'
const REQUISITES = {
  TITLE: '198142',
  MESSAGE: '198143',
  PRIORITY: '198144',
  CREATED_AT: '198145',
  TYPE: '198146',
  LINK: '198147',
  READ: '198148',
  USER_ID: '198151'
}

const API_BASE_URL = getOrchestratorUrl()

// Determine WebSocket URL based on current host
function getWebSocketURL() {
  if (typeof window === 'undefined') {
    // Server-side fallback
    const host = process.env.BACKEND_HOST || 'localhost'
    const port = process.env.BACKEND_PORT || '8081'
    return `ws://${host}:${port}/ws`
  }

  return getWebSocketUrl()  // getWebSocketUrl() already includes /ws path
}

const WS_URL = getWebSocketURL()

/**
 * Get current user ID from auth system
 */
function getUserId() {
  // Check primary user ID from authStore
  const userId = localStorage.getItem('id')
  if (userId) return userId

  // Fallback to F_U param from URL (used in some contexts)
  const urlParams = new URLSearchParams(window.location.search)
  const fuParam = urlParams.get('F_U')
  if (fuParam) return fuParam

  return null
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return getUserId() !== null
}

/**
 * Ensure Integram client is configured for notifications database
 */
async function ensureIntegramConnection() {
  if (!integramApiClient.isAuthenticated()) {
    // Try to load session from localStorage
    integramApiClient.loadSession()
  }

  // Set database to 'my' for notifications
  const currentDb = integramApiClient.getDatabase()
  if (currentDb !== NOTIFICATION_DATABASE) {
    integramApiClient.setDatabase(NOTIFICATION_DATABASE)
  }

  return integramApiClient.isAuthenticated()
}

/**
 * Convert Integram object to notification format
 */
function parseNotificationFromIntegram(obj, reqs) {
  const objReqs = reqs[obj.id] || {}

  return {
    id: obj.id,
    title: objReqs[REQUISITES.TITLE] || obj.val || '',
    message: objReqs[REQUISITES.MESSAGE] || '',
    priority: objReqs[REQUISITES.PRIORITY] || 'medium',
    createdAt: objReqs[REQUISITES.CREATED_AT] || new Date().toISOString(),
    type: objReqs[REQUISITES.TYPE] || 'system',
    link: objReqs[REQUISITES.LINK] || '',
    read: objReqs[REQUISITES.READ] === '1' || objReqs[REQUISITES.READ] === 1,
    userId: objReqs[REQUISITES.USER_ID] || ''
  }
}

/**
 * Fetch notifications with pagination and filters
 * Uses Integram table "Уведомление" (198140)
 */
export async function fetchNotifications(options = {}) {
  const userId = getUserId()
  if (!userId) {
    return { notifications: [], total: 0 }
  }

  try {
    const connected = await ensureIntegramConnection()
    if (!connected) {
      logger.warn('[notifications] Integram not connected, returning empty')
      return { notifications: [], total: 0 }
    }

    // Fetch notifications from Integram
    const params = {
      [`r${REQUISITES.USER_ID}`]: userId, // Filter by user
      ...options
    }

    const response = await integramApiClient.getObjectList(NOTIFICATION_TYPE_ID, params)

    if (!response || !response.object) {
      return { notifications: [], total: 0 }
    }

    const notifications = response.object.map(obj =>
      parseNotificationFromIntegram(obj, response.reqs || {})
    )

    // Sort by createdAt descending
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return {
      notifications,
      total: notifications.length
    }
  } catch (error) {
    logger.warn('[notifications] Failed to fetch from Integram:', error.message)
    return { notifications: [], total: 0 }
  }
}

/**
 * Get grouped notifications (today, yesterday, thisWeek, older)
 * Groups notifications from Integram by date
 */
export async function fetchGroupedNotifications(readFilter = null) {
  const userId = getUserId()
  const emptyGroups = { today: [], yesterday: [], thisWeek: [], older: [] }

  if (!userId) return emptyGroups

  try {
    // Fetch all notifications first
    const { notifications } = await fetchNotifications()

    // Filter by read status if specified
    let filtered = notifications
    if (readFilter !== null) {
      filtered = notifications.filter(n => n.read === readFilter)
    }

    // Group by date
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const thisWeek = new Date(today)
    thisWeek.setDate(thisWeek.getDate() - 7)

    const groups = { today: [], yesterday: [], thisWeek: [], older: [] }

    filtered.forEach(notification => {
      const notifDate = new Date(notification.createdAt)
      if (notifDate >= today) {
        groups.today.push(notification)
      } else if (notifDate >= yesterday) {
        groups.yesterday.push(notification)
      } else if (notifDate >= thisWeek) {
        groups.thisWeek.push(notification)
      } else {
        groups.older.push(notification)
      }
    })

    return groups
  } catch (error) {
    logger.warn('[notifications] Failed to fetch grouped:', error.message)
    return emptyGroups
  }
}

/**
 * Get unread notification count
 * Counts unread notifications from Integram
 */
export async function fetchUnreadCount() {
  const userId = getUserId()
  if (!userId) return 0

  try {
    const { notifications } = await fetchNotifications()
    return notifications.filter(n => !n.read).length
  } catch (error) {
    logger.warn('[notifications] Failed to fetch unread count:', error.message)
    return 0
  }
}

/**
 * Mark notification as read
 * Updates Integram object requisite "Прочитано" to 1
 */
export async function markNotificationAsRead(notificationId) {
  try {
    const connected = await ensureIntegramConnection()
    if (!connected) throw new Error('Integram not connected')

    await integramApiClient.setObjectRequisites(notificationId, {
      [REQUISITES.READ]: '1'
    })

    return { id: notificationId, read: true }
  } catch (error) {
    logger.error('[notifications] Failed to mark as read:', error.message)
    throw new Error('Failed to mark notification as read')
  }
}

/**
 * Mark notification as unread
 * Updates Integram object requisite "Прочитано" to 0
 */
export async function markNotificationAsUnread(notificationId) {
  try {
    const connected = await ensureIntegramConnection()
    if (!connected) throw new Error('Integram not connected')

    await integramApiClient.setObjectRequisites(notificationId, {
      [REQUISITES.READ]: '0'
    })

    return { id: notificationId, read: false }
  } catch (error) {
    logger.error('[notifications] Failed to mark as unread:', error.message)
    throw new Error('Failed to mark notification as unread')
  }
}

/**
 * Mark all notifications as read
 * Updates all user's notifications in Integram
 */
export async function markAllNotificationsAsRead() {
  try {
    const { notifications } = await fetchNotifications()
    const unread = notifications.filter(n => !n.read)

    const connected = await ensureIntegramConnection()
    if (!connected) throw new Error('Integram not connected')

    // Mark each notification as read
    for (const notification of unread) {
      await integramApiClient.setObjectRequisites(notification.id, {
        [REQUISITES.READ]: '1'
      })
    }

    return unread.length
  } catch (error) {
    logger.error('[notifications] Failed to mark all as read:', error.message)
    throw new Error('Failed to mark all as read')
  }
}

/**
 * Delete notification
 * Removes object from Integram
 */
export async function deleteNotification(notificationId) {
  try {
    const connected = await ensureIntegramConnection()
    if (!connected) throw new Error('Integram not connected')

    await integramApiClient.deleteObject(notificationId)
    return true
  } catch (error) {
    logger.error('[notifications] Failed to delete:', error.message)
    throw new Error('Failed to delete notification')
  }
}

/**
 * Clear all notifications
 * Deletes all user's notifications from Integram
 */
export async function clearAllNotifications() {
  try {
    const { notifications } = await fetchNotifications()

    const connected = await ensureIntegramConnection()
    if (!connected) throw new Error('Integram not connected')

    // Delete each notification
    for (const notification of notifications) {
      await integramApiClient.deleteObject(notification.id)
    }

    return notifications.length
  } catch (error) {
    logger.error('[notifications] Failed to clear all:', error.message)
    throw new Error('Failed to clear notifications')
  }
}

/**
 * Create a new notification
 * Creates object in Integram table "Уведомление"
 */
export async function createNotification(data) {
  try {
    const connected = await ensureIntegramConnection()
    if (!connected) throw new Error('Integram not connected')

    const userId = data.userId || getUserId()
    const now = new Date().toISOString()

    const requisites = {
      [REQUISITES.TITLE]: data.title || '',
      [REQUISITES.MESSAGE]: data.message || '',
      [REQUISITES.PRIORITY]: data.priority || 'medium',
      [REQUISITES.TYPE]: data.type || 'system',
      [REQUISITES.LINK]: data.link || '',
      [REQUISITES.READ]: '0',
      [REQUISITES.CREATED_AT]: now,
      [REQUISITES.USER_ID]: userId
    }

    const result = await integramApiClient.createObject(
      NOTIFICATION_TYPE_ID,
      data.title || 'Уведомление',
      requisites
    )

    return {
      id: result.id,
      ...data,
      read: false,
      createdAt: now,
      userId
    }
  } catch (error) {
    logger.error('[notifications] Failed to create:', error.message)
    throw new Error('Failed to create notification')
  }
}

/**
 * Get default notification preferences
 */
function getDefaultPreferences() {
  return {
    email: {
      mentions: true,
      shares: true,
      digest: false,
      updates: false
    },
    push: {
      enabled: false,
      mentions: true,
      all: false
    },
    quietHours: {
      enabled: false,
      from: '22:00',
      to: '08:00'
    },
    channels: {
      inApp: true,
      email: true,
      push: false,
      sms: false
    }
  }
}

/**
 * Get notification preferences
 * Stores in localStorage since preferences don't need Integram
 */
export async function fetchPreferences() {
  try {
    const stored = localStorage.getItem('notificationPreferences')
    if (stored && stored !== 'undefined' && stored !== 'null') {
      return JSON.parse(stored)
    }
  } catch (error) {
    logger.warn('[notifications] Invalid preferences in localStorage')
    localStorage.removeItem('notificationPreferences')
  }
  return getDefaultPreferences()
}

/**
 * Update notification preferences
 * Saves to localStorage
 */
export async function updatePreferences(preferences) {
  const merged = { ...getDefaultPreferences(), ...preferences }
  localStorage.setItem('notificationPreferences', JSON.stringify(merged))
  return merged
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferences() {
  const defaults = getDefaultPreferences()
  localStorage.setItem('notificationPreferences', JSON.stringify(defaults))
  return defaults
}

/**
 * Create WebSocket connection for real-time notifications
 * @param {Function} onNotification - Callback for new notifications
 * @param {Function} onUnreadCount - Callback for unread count updates
 */
export function createNotificationWebSocket(onNotification, onUnreadCount) {
  const userId = getUserId()
  if (!userId) {
    // Return a mock WebSocket object if user not authenticated
    return { close: () => {} }
  }

  const ws = new WebSocket(WS_URL)

  ws.onopen = () => {
    logger.debug('WebSocket connected')
    // Subscribe to notifications
    ws.send(JSON.stringify({
      type: 'notifications:subscribe',
      userId
    }))
  }

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)

      if (message.type === 'notification:new' && onNotification) {
        onNotification(message.data)
      } else if (message.type === 'notification:unread-count' && onUnreadCount) {
        onUnreadCount(message.data.count)
      }
    } catch (error) {
      console.error('WebSocket message error:', error)
    }
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
  }

  ws.onclose = () => {
    logger.debug('WebSocket disconnected')
  }

  return ws
}
