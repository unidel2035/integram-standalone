/**
 * useUserAvatar.js - Composable for fetching and caching user avatars
 *
 * Provides avatar URL lookup with localStorage caching to avoid repeated API calls
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'

// Global cache for user avatars (shared across all instances)
const avatarCache = reactive({})

export function useUserAvatar() {
  /**
   * Get user avatar URL by user ID
   * Uses cache-first strategy with fallback to API
   *
   * @param {string|number} userId - User ID
   * @returns {Promise<string|null>} Avatar URL or null if not available
   */
  async function getUserAvatar(userId) {
    if (!userId) return null

    const userIdStr = userId.toString()

    // 1. Check memory cache first
    if (avatarCache[userIdStr]) {
      return avatarCache[userIdStr]
    }

    // 2. Check localStorage cache
    const cachedUrl = localStorage.getItem(`userPhoto_${userIdStr}`)
    if (cachedUrl) {
      avatarCache[userIdStr] = cachedUrl
      return cachedUrl
    }

    // 3. Fetch from API
    try {
      const token = localStorage.getItem('my_token') || localStorage.getItem('token')
      if (!token) {
        logger.warn('[useUserAvatar] No token available for fetching avatar')
        return null
      }

      const response = await fetch(`/api/profile/${userIdStr}`, {
        headers: { 'X-Authorization': token }
      })

      if (response.ok) {
        const data = await response.json()
        const photoUrl = data.success && data.data?.photo ? data.data.photo : null

        // Cache the result (even if null, to avoid repeated failed requests)
        if (photoUrl) {
          avatarCache[userIdStr] = photoUrl
          localStorage.setItem(`userPhoto_${userIdStr}`, photoUrl)
          logger.debug(`[useUserAvatar] Fetched and cached avatar for user ${userIdStr}`)
        } else {
          // Cache null for 5 minutes to avoid repeated requests
          avatarCache[userIdStr] = null
          logger.debug(`[useUserAvatar] No avatar found for user ${userIdStr}`)
        }

        return photoUrl
      } else {
        logger.warn(`[useUserAvatar] Failed to fetch avatar for user ${userIdStr}: ${response.status}`)
        return null
      }
    } catch (error) {
      logger.error(`[useUserAvatar] Error fetching avatar for user ${userIdStr}:`, error)
      return null
    }
  }

  /**
   * Prefetch avatars for multiple users
   * Useful for bulk loading (e.g., for chat message list)
   *
   * @param {Array<string|number>} userIds - Array of user IDs
   * @returns {Promise<Object>} Map of userId -> avatarUrl
   */
  async function prefetchAvatars(userIds) {
    const uniqueIds = [...new Set(userIds.filter(Boolean).map(id => id.toString()))]
    const results = {}

    await Promise.all(
      uniqueIds.map(async (userId) => {
        results[userId] = await getUserAvatar(userId)
      })
    )

    return results
  }

  /**
   * Clear avatar cache for a specific user or all users
   * @param {string|number} userId - User ID to clear, or null to clear all
   */
  function clearAvatarCache(userId = null) {
    if (userId) {
      const userIdStr = userId.toString()
      delete avatarCache[userIdStr]
      localStorage.removeItem(`userPhoto_${userIdStr}`)
      logger.debug(`[useUserAvatar] Cleared cache for user ${userIdStr}`)
    } else {
      // Clear all
      Object.keys(avatarCache).forEach(key => delete avatarCache[key])
      // Clear all userPhoto_* from localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('userPhoto_')) {
          localStorage.removeItem(key)
        }
      })
      logger.debug('[useUserAvatar] Cleared all avatar cache')
    }
  }

  return {
    getUserAvatar,
    prefetchAvatars,
    clearAvatarCache
  }
}
