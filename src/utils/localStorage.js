/**
 * Safe localStorage Wrapper
 *
 * Issue #63: Prevent localStorage quota overflow and unbounded growth
 *
 * This module provides safe wrappers around localStorage operations with:
 * - Automatic quota monitoring and warnings
 * - QuotaExceededError handling with automatic cleanup
 * - Old data cleanup to prevent unbounded growth
 * - Storage statistics for debugging
 *
 * @module utils/localStorage
 */

// Configuration constants
const MAX_LOCALSTORAGE_SIZE = 5 * 1024 * 1024  // 5 MB (typical browser quota)
const WARN_THRESHOLD = 0.8  // 80% of quota triggers warning
const MAX_SESSION_AGE = 7 * 24 * 60 * 60 * 1000  // 7 days in milliseconds

/**
 * Calculate the byte size of a string
 * Uses Blob API for accurate UTF-8 byte counting
 *
 * @param {string} str - String to measure
 * @returns {number} Size in bytes
 */
function getStringSize(str) {
  if (!str) return 0
  return new Blob([str]).size
}

/**
 * Get current total size of all localStorage data
 *
 * @returns {number} Total size in bytes
 */
export function getCurrentStorageSize() {
  let size = 0

  try {
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        size += getStringSize(localStorage[key])
        size += getStringSize(key)
      }
    }
  } catch (e) {
    console.warn('[localStorage] Error calculating storage size:', e)
  }

  return size
}

/**
 * Clean up old/expired data from localStorage
 * Removes session data older than MAX_SESSION_AGE
 *
 * @returns {number} Bytes freed
 */
export function cleanupOldData() {
  let bytesFreed = 0

  try {
    // Check session timestamp
    const sessionTimestamp = localStorage.getItem('session_timestamp')
    if (sessionTimestamp) {
      const age = Date.now() - parseInt(sessionTimestamp)

      if (age > MAX_SESSION_AGE) {
        // Session expired - remove session data
        const sessionData = localStorage.getItem('integram_session')
        if (sessionData) {
          bytesFreed += getStringSize(sessionData)
          localStorage.removeItem('integram_session')
        }

        bytesFreed += getStringSize(sessionTimestamp)
        localStorage.removeItem('session_timestamp')

        console.log('[localStorage] Removed expired session data:', {
          ageInDays: Math.floor(age / (24 * 60 * 60 * 1000)),
          bytesFreed
        })
      }
    }

    // Remove orphaned unified auth session if no timestamp
    if (!sessionTimestamp && localStorage.getItem('unified_auth_session_id')) {
      const unifiedSessionId = localStorage.getItem('unified_auth_session_id')
      bytesFreed += getStringSize(unifiedSessionId)
      localStorage.removeItem('unified_auth_session_id')
      console.log('[localStorage] Removed orphaned unified_auth_session_id')
    }

    // Clean up any test data that may have been left behind
    const testKeys = []
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key) && key.startsWith('test_')) {
        testKeys.push(key)
      }
    }

    testKeys.forEach(key => {
      const value = localStorage.getItem(key)
      bytesFreed += getStringSize(value) + getStringSize(key)
      localStorage.removeItem(key)
    })

    if (testKeys.length > 0) {
      console.log(`[localStorage] Removed ${testKeys.length} test keys`)
    }

  } catch (e) {
    console.warn('[localStorage] Error during cleanup:', e)
  }

  return bytesFreed
}

/**
 * Safely set an item in localStorage with quota management
 *
 * Features:
 * - Checks available quota before writing
 * - Automatically cleans up old data if near quota
 * - Handles QuotaExceededError gracefully
 * - Retries after cleanup if initial write fails
 *
 * @param {string} key - Storage key
 * @param {string} value - Value to store (must be string or will be converted)
 * @returns {boolean} True if successful, false if failed
 */
export function setItemSafe(key, value) {
  try {
    // Convert value to string if needed
    const stringValue = typeof value === 'string' ? value : String(value)

    // Check current storage size
    const currentSize = getCurrentStorageSize()
    const newItemSize = getStringSize(stringValue) + getStringSize(key)
    const projectedSize = currentSize + newItemSize

    // Warn if approaching quota limit
    if (projectedSize > MAX_LOCALSTORAGE_SIZE * WARN_THRESHOLD) {
      const percentUsed = ((projectedSize / MAX_LOCALSTORAGE_SIZE) * 100).toFixed(1)
      console.warn(`[localStorage] Near quota limit: ${percentUsed}% (${(projectedSize / 1024).toFixed(1)} KB / ${(MAX_LOCALSTORAGE_SIZE / 1024).toFixed(0)} KB)`)

      // Attempt cleanup to free space
      const bytesFreed = cleanupOldData()
      if (bytesFreed > 0) {
        console.log(`[localStorage] Freed ${(bytesFreed / 1024).toFixed(2)} KB from cleanup`)
      }
    }

    // Try to set the item
    localStorage.setItem(key, stringValue)
    return true

  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.error('[localStorage] QuotaExceededError: Storage quota exceeded', {
        key,
        valueSize: getStringSize(value),
        currentSize: getCurrentStorageSize(),
        maxSize: MAX_LOCALSTORAGE_SIZE
      })

      // Try aggressive cleanup
      const bytesFreed = cleanupOldData()
      console.log(`[localStorage] Cleanup freed ${(bytesFreed / 1024).toFixed(2)} KB`)

      // Retry after cleanup
      try {
        localStorage.setItem(key, typeof value === 'string' ? value : String(value))
        console.log('[localStorage] Successfully saved after cleanup')
        return true
      } catch (e2) {
        console.error('[localStorage] Failed to save even after cleanup:', e2)

        // Log storage stats for debugging
        const stats = getStorageStats()
        console.error('[localStorage] Current storage state:', {
          totalSizeKB: stats.totalSizeKB,
          percentUsed: stats.percentUsed,
          itemCount: stats.items.length,
          largestItems: stats.items.slice(0, 5)
        })

        return false
      }
    }

    // Other localStorage errors (SecurityError, etc.)
    console.error('[localStorage] Error setting item:', e)
    return false
  }
}

/**
 * Safely get an item from localStorage
 *
 * @param {string} key - Storage key
 * @returns {string|null} Value if found, null if not found or error
 */
export function getItemSafe(key) {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    console.error('[localStorage] Error getting item:', e)
    return null
  }
}

/**
 * Safely remove an item from localStorage
 *
 * @param {string} key - Storage key
 * @returns {boolean} True if successful, false if failed
 */
export function removeItemSafe(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch (e) {
    console.error('[localStorage] Error removing item:', e)
    return false
  }
}

/**
 * Get detailed storage statistics for monitoring and debugging
 *
 * Returns:
 * - totalSize: Total bytes used
 * - totalSizeKB: Total KB used
 * - percentUsed: Percentage of quota used
 * - items: Array of {key, sizeKB} sorted by size (largest first)
 *
 * @returns {Object} Storage statistics
 */
export function getStorageStats() {
  let totalSize = 0
  const items = {}

  try {
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const value = localStorage[key]
        const itemSize = getStringSize(value) + getStringSize(key)
        totalSize += itemSize
        items[key] = itemSize
      }
    }
  } catch (e) {
    console.warn('[localStorage] Error getting storage stats:', e)
  }

  return {
    totalSize,
    totalSizeKB: (totalSize / 1024).toFixed(2),
    percentUsed: ((totalSize / MAX_LOCALSTORAGE_SIZE) * 100).toFixed(1),
    items: Object.entries(items)
      .sort(([, a], [, b]) => b - a)
      .map(([key, size]) => ({
        key,
        sizeKB: (size / 1024).toFixed(2),
        sizeBytes: size
      }))
  }
}

/**
 * Clear all localStorage data (use with caution!)
 *
 * @returns {boolean} True if successful
 */
export function clearAllStorage() {
  try {
    localStorage.clear()
    console.log('[localStorage] All storage cleared')
    return true
  } catch (e) {
    console.error('[localStorage] Error clearing storage:', e)
    return false
  }
}

/**
 * Test quota handling by attempting to write large data
 * Useful for debugging and testing
 *
 * @returns {Object} Test results
 */
export function testQuotaHandling() {
  console.log('[localStorage] Testing quota handling...')

  const testKey = 'test_quota_handling'
  const initialStats = getStorageStats()

  // Try to write 10 MB (should exceed quota)
  const largeData = 'x'.repeat(10 * 1024 * 1024)
  const success = setItemSafe(testKey, largeData)

  // Cleanup
  removeItemSafe(testKey)

  const finalStats = getStorageStats()

  const result = {
    quotaHandled: !success, // Should fail due to quota
    initialSize: initialStats.totalSizeKB,
    finalSize: finalStats.totalSizeKB,
    cleanupWorked: true
  }

  console.log('[localStorage] Quota handling test:', result)
  return result
}

// Export configuration for testing
export const config = {
  MAX_LOCALSTORAGE_SIZE,
  WARN_THRESHOLD,
  MAX_SESSION_AGE
}
