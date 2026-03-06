/**
 * User Settings Service
 * Issue #6361: Migrate menu category settings from localStorage to Integram
 *
 * This service provides methods to interact with user settings stored in Integram.
 */

import { getApiUrl } from '@/utils/apiConfig'
import { logger } from '@/utils/logger'

/**
 * Get current user ID from Integram token
 * @returns {string|null} User ID or null if not authenticated
 */
function getUserId() {
  try {
    const token = localStorage.getItem('token') || localStorage.getItem('my_token')
    if (!token) {
      logger.debug('[UserSettings] No Integram token found')
      return null
    }

    // Try integram_session first (has structured user data)
    const session = localStorage.getItem('integram_session')
    if (session) {
      try {
        const data = JSON.parse(session)
        if (data.userId) return data.userId
      } catch (e) { /* ignore */ }
    }

    // Fallback: parse token format "token|userId|xsrf"
    const parts = token.split('|')
    if (parts.length >= 2) {
      return parts[1]
    }

    logger.warn('[UserSettings] Invalid token format')
    return null
  } catch (error) {
    logger.error('[UserSettings] Failed to get user ID:', error)
    return null
  }
}

/**
 * Get a user setting by key
 * @param {string} settingKey - Setting key (e.g., "menuCategoryVisibility")
 * @returns {Promise<any>} Setting value or null if not found
 */
export async function getUserSetting(settingKey) {
  try {
    const userId = getUserId()
    if (!userId) {
      logger.warn('[UserSettings] Cannot get setting without user ID')
      return null
    }

    logger.debug('[UserSettings] Getting setting:', { userId, settingKey })

    const response = await fetch(
      `${getApiUrl('/api/user-settings')}/${settingKey}?userId=${userId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        logger.debug('[UserSettings] Setting not found:', settingKey)
        return null
      }
      throw new Error(`Failed to get setting: ${response.statusText}`)
    }

    const data = await response.json()
    if (data.success) {
      logger.info('[UserSettings] Setting retrieved:', { settingKey, value: data.settingValue })
      return data.settingValue
    } else {
      throw new Error(data.error || 'Failed to get setting')
    }
  } catch (error) {
    logger.error('[UserSettings] Error getting setting:', error)
    throw error
  }
}

/**
 * Save a user setting
 * @param {string} settingKey - Setting key
 * @param {any} settingValue - Setting value (any JSON-serializable value)
 * @returns {Promise<string>} Integram object ID
 */
export async function saveUserSetting(settingKey, settingValue) {
  try {
    const userId = getUserId()
    if (!userId) {
      throw new Error('Cannot save setting without user ID')
    }

    logger.info('[UserSettings] Saving setting:', { userId, settingKey })

    const response = await fetch(
      `${getApiUrl('/api/user-settings')}/${settingKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          settingValue
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to save setting: ${response.statusText}`)
    }

    const data = await response.json()
    if (data.success) {
      logger.info('[UserSettings] Setting saved successfully:', { settingKey, objectId: data.objectId })
      return data.objectId
    } else {
      throw new Error(data.error || 'Failed to save setting')
    }
  } catch (error) {
    logger.error('[UserSettings] Error saving setting:', error)
    throw error
  }
}

/**
 * Delete a user setting
 * @param {string} settingKey - Setting key
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteUserSetting(settingKey) {
  try {
    const userId = getUserId()
    if (!userId) {
      throw new Error('Cannot delete setting without user ID')
    }

    logger.info('[UserSettings] Deleting setting:', { userId, settingKey })

    const response = await fetch(
      `${getApiUrl('/api/user-settings')}/${settingKey}?userId=${userId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        logger.debug('[UserSettings] Setting not found to delete:', settingKey)
        return false
      }
      throw new Error(`Failed to delete setting: ${response.statusText}`)
    }

    const data = await response.json()
    if (data.success) {
      logger.info('[UserSettings] Setting deleted successfully:', settingKey)
      return data.deleted
    } else {
      throw new Error(data.error || 'Failed to delete setting')
    }
  } catch (error) {
    logger.error('[UserSettings] Error deleting setting:', error)
    throw error
  }
}

/**
 * Get all settings for the current user
 * @returns {Promise<object>} Object with settingKey: settingValue pairs
 */
export async function getAllUserSettings() {
  try {
    const userId = getUserId()
    if (!userId) {
      throw new Error('Cannot get settings without user ID')
    }

    logger.debug('[UserSettings] Getting all settings for user:', userId)

    const response = await fetch(
      `${getApiUrl('/api/user-settings')}?userId=${userId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get all settings: ${response.statusText}`)
    }

    const data = await response.json()
    if (data.success) {
      logger.info('[UserSettings] All settings retrieved:', { count: data.count })
      return data.settings
    } else {
      throw new Error(data.error || 'Failed to get all settings')
    }
  } catch (error) {
    logger.error('[UserSettings] Error getting all settings:', error)
    throw error
  }
}

/**
 * Migrate setting from localStorage to Integram
 * @param {string} settingKey - Setting key
 * @param {string} localStorageKey - localStorage key (defaults to settingKey)
 * @returns {Promise<boolean>} True if migrated, false if nothing to migrate
 */
export async function migrateSetting(settingKey, localStorageKey = null) {
  try {
    const storageKey = localStorageKey || settingKey
    const localValue = localStorage.getItem(storageKey)

    if (!localValue) {
      logger.debug('[UserSettings] No local value to migrate for:', settingKey)
      return false
    }

    logger.info('[UserSettings] Migrating setting from localStorage:', settingKey)

    // Parse if JSON
    let value
    try {
      value = JSON.parse(localValue)
    } catch {
      value = localValue
    }

    // Save to Integram
    await saveUserSetting(settingKey, value)

    // Remove from localStorage
    localStorage.removeItem(storageKey)

    logger.info('[UserSettings] Setting migrated successfully:', settingKey)
    return true
  } catch (error) {
    logger.error('[UserSettings] Failed to migrate setting:', error)
    throw error
  }
}
