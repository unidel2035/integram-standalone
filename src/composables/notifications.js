import { reactive, computed, onMounted, onUnmounted } from 'vue'
import {
  fetchNotifications as fetchNotificationsAPI,
  fetchGroupedNotifications as fetchGroupedNotificationsAPI,
  fetchUnreadCount as fetchUnreadCountAPI,
  markNotificationAsRead as markNotificationAsReadAPI,
  markNotificationAsUnread as markNotificationAsUnreadAPI,
  markAllNotificationsAsRead as markAllNotificationsAsReadAPI,
  deleteNotification as deleteNotificationAPI,
  clearAllNotifications as clearAllNotificationsAPI,
  fetchPreferences as fetchPreferencesAPI,
  updatePreferences as updatePreferencesAPI,
  resetPreferences as resetPreferencesAPI,
  createNotificationWebSocket
} from '@/services/notificationService'
import { logger } from '@/utils/logger'

// Get initial preferences from localStorage as fallback
const getInitialPreferences = () => {
  if (typeof window === 'undefined') return getDefaultPreferences()
  try {
    const saved = localStorage.getItem('notificationPreferences')
    // Check for null, undefined, or invalid values
    if (!saved || saved === 'undefined' || saved === 'null') {
      return getDefaultPreferences()
    }
    return JSON.parse(saved)
  } catch (e) {
    // If JSON parsing fails, return defaults and clean up invalid data
    console.warn('[notifications] Invalid preferences in localStorage, using defaults')
    localStorage.removeItem('notificationPreferences')
    return getDefaultPreferences()
  }
}

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

const notificationState = reactive({
  notifications: [],
  preferences: getInitialPreferences(),
  isLoading: false,
  error: null,
  unreadCountValue: 0,
  wsConnection: null
})

// WebSocket connection management
let wsInstance = null

export function useNotifications() {
  // Computed properties
  const unreadCount = computed(() => {
    return notificationState.unreadCountValue
  })

  const unreadNotifications = computed(() => {
    return notificationState.notifications.filter(n => !n.read)
  })

  const readNotifications = computed(() => {
    return notificationState.notifications.filter(n => n.read)
  })

  const groupedNotifications = computed(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const thisWeek = new Date(today)
    thisWeek.setDate(thisWeek.getDate() - 7)

    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    }

    notificationState.notifications.forEach(notification => {
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
  })

  // Actions
  const markAsRead = async (notificationId) => {
    try {
      await markNotificationAsReadAPI(notificationId)

      // Update local state
      const notification = notificationState.notifications.find(n => n.id === notificationId)
      if (notification) {
        notification.read = true
        notificationState.unreadCountValue = Math.max(0, notificationState.unreadCountValue - 1)
      }
    } catch (error) {
      logger.error('Failed to mark notification as read:', error)
      notificationState.error = error.message
    }
  }

  const markAsUnread = async (notificationId) => {
    try {
      await markNotificationAsUnreadAPI(notificationId)

      // Update local state
      const notification = notificationState.notifications.find(n => n.id === notificationId)
      if (notification) {
        notification.read = false
        notificationState.unreadCountValue++
      }
    } catch (error) {
      logger.error('Failed to mark notification as unread:', error)
      notificationState.error = error.message
    }
  }

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsReadAPI()

      // Update local state
      notificationState.notifications.forEach(notification => {
        notification.read = true
      })
      notificationState.unreadCountValue = 0
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error)
      notificationState.error = error.message
    }
  }

  const deleteNotification = async (notificationId) => {
    try {
      await deleteNotificationAPI(notificationId)

      // Update local state
      const index = notificationState.notifications.findIndex(n => n.id === notificationId)
      if (index !== -1) {
        const wasUnread = !notificationState.notifications[index].read
        notificationState.notifications.splice(index, 1)
        if (wasUnread) {
          notificationState.unreadCountValue = Math.max(0, notificationState.unreadCountValue - 1)
        }
      }
    } catch (error) {
      logger.error('Failed to delete notification:', error)
      notificationState.error = error.message
    }
  }

  const clearAll = async () => {
    try {
      await clearAllNotificationsAPI()

      // Update local state
      notificationState.notifications = []
      notificationState.unreadCountValue = 0
    } catch (error) {
      logger.error('Failed to clear all notifications:', error)
      notificationState.error = error.message
    }
  }

  const addNotification = (notification) => {
    // Add notification to local state (used by WebSocket)
    const newNotification = {
      id: notification.id || Date.now(),
      read: false,
      createdAt: notification.createdAt || new Date(),
      priority: notification.priority || 'medium',
      icon: notification.icon || 'pi-bell',
      iconColor: notification.iconColor || 'blue',
      ...notification
    }
    notificationState.notifications.unshift(newNotification)
    if (!newNotification.read) {
      notificationState.unreadCountValue++
    }
    return newNotification
  }

  const updatePreferences = async (newPreferences) => {
    try {
      const updated = await updatePreferencesAPI(newPreferences)
      notificationState.preferences = updated

      // Also save to localStorage as backup
      if (typeof window !== 'undefined') {
        localStorage.setItem('notificationPreferences', JSON.stringify(updated))
      }
    } catch (error) {
      logger.error('Failed to update preferences:', error)
      notificationState.error = error.message
    }
  }

  const resetPreferencesToDefault = async () => {
    try {
      const defaultPrefs = await resetPreferencesAPI()
      notificationState.preferences = defaultPrefs

      // Clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('notificationPreferences')
      }
    } catch (error) {
      logger.error('Failed to reset preferences:', error)
      notificationState.error = error.message
    }
  }

  const fetchNotifications = async (options = {}) => {
    notificationState.isLoading = true
    notificationState.error = null
    try {
      const response = await fetchNotificationsAPI(options)
      notificationState.notifications = response.notifications || []
      notificationState.unreadCountValue = response.notifications.filter(n => !n.read).length
    } catch (error) {
      logger.error('Failed to fetch notifications:', error)
      notificationState.error = error.message
    } finally {
      notificationState.isLoading = false
    }
  }

  const loadPreferences = async () => {
    try {
      const prefs = await fetchPreferencesAPI()
      notificationState.preferences = prefs

      // Sync to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('notificationPreferences', JSON.stringify(prefs))
      }
    } catch (error) {
      logger.error('Failed to load preferences:', error)
      // Keep using localStorage/default preferences
    }
  }

  const loadUnreadCount = async () => {
    try {
      const count = await fetchUnreadCountAPI()
      notificationState.unreadCountValue = count
    } catch (error) {
      logger.error('Failed to load unread count:', error)
    }
  }

  const initializeWebSocket = () => {
    if (wsInstance) {
      logger.debug('WebSocket already initialized')
      return
    }

    try {
      wsInstance = createNotificationWebSocket(
        // onNotification callback
        (notification) => {
          logger.debug('New notification received via WebSocket:', notification)
          addNotification(notification)
        },
        // onUnreadCount callback
        (count) => {
          logger.debug('Unread count updated via WebSocket:', count)
          notificationState.unreadCountValue = count
        }
      )

      notificationState.wsConnection = wsInstance
      logger.debug('WebSocket connection established')
    } catch (error) {
      logger.error('Failed to initialize WebSocket:', error)
    }
  }

  const closeWebSocket = () => {
    if (wsInstance) {
      wsInstance.close()
      wsInstance = null
      notificationState.wsConnection = null
      logger.debug('WebSocket connection closed')
    }
  }

  const getNotificationsByType = (type) => {
    return computed(() => {
      return notificationState.notifications.filter(n => n.type === type)
    })
  }

  const getNotificationsByPriority = (priority) => {
    return computed(() => {
      return notificationState.notifications.filter(n => n.priority === priority)
    })
  }

  // Format relative time
  const formatRelativeTime = (date) => {
    const now = new Date()
    const diff = now - new Date(date)
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 7) {
      return new Date(date).toLocaleDateString('ru-RU')
    } else if (days > 0) {
      return `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'} назад`
    } else if (hours > 0) {
      return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'} назад`
    } else if (minutes > 0) {
      return `${minutes} ${minutes === 1 ? 'минуту' : minutes < 5 ? 'минуты' : 'минут'} назад`
    } else {
      return 'только что'
    }
  }

  // Initialize on mount
  const initialize = async () => {
    await Promise.all([
      fetchNotifications(),
      loadPreferences(),
      loadUnreadCount()
    ])
    initializeWebSocket()
  }

  // Cleanup WebSocket on component unmount
  onUnmounted(() => {
    closeWebSocket()
  })

  return {
    // State
    notifications: computed(() => notificationState.notifications),
    preferences: computed(() => notificationState.preferences),
    isLoading: computed(() => notificationState.isLoading),
    error: computed(() => notificationState.error),

    // Computed
    unreadCount,
    unreadNotifications,
    readNotifications,
    groupedNotifications,

    // Actions
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    clearAll,
    addNotification,
    updatePreferences,
    resetPreferencesToDefault,
    fetchNotifications,
    loadPreferences,
    loadUnreadCount,
    getNotificationsByType,
    getNotificationsByPriority,
    formatRelativeTime,

    // WebSocket management
    initializeWebSocket,
    closeWebSocket,
    initialize
  }
}
