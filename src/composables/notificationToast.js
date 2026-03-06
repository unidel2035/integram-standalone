import { useToast } from 'primevue/usetoast'

/**
 * Composable for showing toast notifications
 * Wraps PrimeVue's Toast service with predefined notification types
 */
export function useNotificationToast() {
  const toast = useToast()

  /**
   * Show a success notification
   */
  const showSuccess = (title, message, life = 3000) => {
    toast.add({
      severity: 'success',
      summary: title,
      detail: message,
      life
    })
  }

  /**
   * Show an error notification
   */
  const showError = (title, message, life = 5000) => {
    toast.add({
      severity: 'error',
      summary: title,
      detail: message,
      life
    })
  }

  /**
   * Show a warning notification
   */
  const showWarning = (title, message, life = 4000) => {
    toast.add({
      severity: 'warn',
      summary: title,
      detail: message,
      life
    })
  }

  /**
   * Show an info notification
   */
  const showInfo = (title, message, life = 3000) => {
    toast.add({
      severity: 'info',
      summary: title,
      detail: message,
      life
    })
  }

  /**
   * Show a notification based on type
   */
  const showNotification = (type, title, message, options = {}) => {
    const defaultLife = {
      system: 5000,
      activity: 4000,
      security: 6000,
      billing: 5000,
      team: 4000,
      achievement: 3000
    }

    const severityMap = {
      system: 'info',
      activity: 'info',
      security: 'warn',
      billing: 'info',
      team: 'success',
      achievement: 'success'
    }

    toast.add({
      severity: severityMap[type] || 'info',
      summary: title,
      detail: message,
      life: options.life || defaultLife[type] || 4000,
      ...options
    })
  }

  /**
   * Show a custom notification with full control
   */
  const showCustom = (options) => {
    toast.add(options)
  }

  /**
   * Remove all notifications
   */
  const removeAll = () => {
    toast.removeAllGroups()
  }

  /**
   * Show a browser notification (Web Push API)
   */
  const showBrowserNotification = async (title, options = {}) => {
    if (!('Notification' in window)) {
      console.warn('Browser notifications not supported')
      return false
    }

    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          icon: '/meta/icon1.svg',
          badge: '/meta/icon1.svg',
          ...options
        })

        if (options.onClick) {
          notification.onclick = options.onClick
        }

        return notification
      } catch (error) {
        console.error('Error showing browser notification:', error)
        return false
      }
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        return showBrowserNotification(title, options)
      }
    }

    return false
  }

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showNotification,
    showCustom,
    removeAll,
    showBrowserNotification
  }
}
