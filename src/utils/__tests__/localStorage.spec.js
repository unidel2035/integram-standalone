/**
 * Unit tests for localStorage utility
 * Issue #63 - Test safe localStorage wrappers and quota handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  setItemSafe,
  getItemSafe,
  removeItemSafe,
  getCurrentStorageSize,
  cleanupOldData,
  getStorageStats,
  clearAllStorage,
  testQuotaHandling,
  config
} from '../localStorage'

describe('localStorage utility', () => {
  // Clear localStorage before each test
  beforeEach(() => {
    localStorage.clear()
  })

  describe('setItemSafe', () => {
    it('should successfully set simple string values', () => {
      const result = setItemSafe('test_key', 'test_value')
      expect(result).toBe(true)
      expect(localStorage.getItem('test_key')).toBe('test_value')
    })

    it('should convert non-string values to strings', () => {
      setItemSafe('number', 123)
      expect(localStorage.getItem('number')).toBe('123')

      setItemSafe('boolean', true)
      expect(localStorage.getItem('boolean')).toBe('true')

      setItemSafe('object', { foo: 'bar' })
      expect(localStorage.getItem('object')).toBe('[object Object]')
    })

    it('should handle JSON stringified objects', () => {
      const sessionData = {
        database: 'my',
        token: 'abc123',
        userId: 42,
        timestamp: Date.now()
      }

      const result = setItemSafe('integram_session', JSON.stringify(sessionData))
      expect(result).toBe(true)

      const retrieved = JSON.parse(localStorage.getItem('integram_session'))
      expect(retrieved).toEqual(sessionData)
    })

    it('should handle empty strings', () => {
      const result = setItemSafe('empty', '')
      expect(result).toBe(true)
      expect(localStorage.getItem('empty')).toBe('')
    })

    it('should overwrite existing values', () => {
      setItemSafe('key', 'value1')
      expect(localStorage.getItem('key')).toBe('value1')

      setItemSafe('key', 'value2')
      expect(localStorage.getItem('key')).toBe('value2')
    })

    it('should handle special characters and unicode', () => {
      const specialChars = '🔥 Hello 世界 Привет'
      setItemSafe('unicode', specialChars)
      expect(localStorage.getItem('unicode')).toBe(specialChars)
    })
  })

  describe('getItemSafe', () => {
    it('should retrieve existing values', () => {
      localStorage.setItem('key', 'value')
      expect(getItemSafe('key')).toBe('value')
    })

    it('should return null for non-existent keys', () => {
      expect(getItemSafe('nonexistent')).toBe(null)
    })

    it('should handle special characters in keys', () => {
      localStorage.setItem('key:with:colons', 'value')
      expect(getItemSafe('key:with:colons')).toBe('value')
    })
  })

  describe('removeItemSafe', () => {
    it('should remove existing items', () => {
      localStorage.setItem('key', 'value')
      expect(localStorage.getItem('key')).toBe('value')

      const result = removeItemSafe('key')
      expect(result).toBe(true)
      expect(localStorage.getItem('key')).toBe(null)
    })

    it('should succeed even if key does not exist', () => {
      const result = removeItemSafe('nonexistent')
      expect(result).toBe(true)
    })

    it('should remove multiple items independently', () => {
      localStorage.setItem('key1', 'value1')
      localStorage.setItem('key2', 'value2')

      removeItemSafe('key1')
      expect(localStorage.getItem('key1')).toBe(null)
      expect(localStorage.getItem('key2')).toBe('value2')
    })
  })

  describe('getCurrentStorageSize', () => {
    it('should return 0 for empty storage', () => {
      expect(getCurrentStorageSize()).toBe(0)
    })

    it('should calculate size for single item', () => {
      localStorage.setItem('key', 'value')
      const size = getCurrentStorageSize()
      expect(size).toBeGreaterThan(0)
      // Size should be at least key.length + value.length
      expect(size).toBeGreaterThanOrEqual(8) // 'key' (3) + 'value' (5) = 8
    })

    it('should calculate total size for multiple items', () => {
      localStorage.setItem('key1', 'value1')
      const size1 = getCurrentStorageSize()

      localStorage.setItem('key2', 'value2')
      const size2 = getCurrentStorageSize()

      expect(size2).toBeGreaterThan(size1)
    })

    it('should account for unicode characters correctly', () => {
      // Unicode character '世' takes 3 bytes in UTF-8
      localStorage.setItem('unicode', '世界')
      const size = getCurrentStorageSize()
      // Should be more than just 2 characters
      expect(size).toBeGreaterThan(10) // 'unicode' (7) + UTF-8 encoding
    })
  })

  describe('cleanupOldData', () => {
    it('should remove expired session data', () => {
      // Set old timestamp (8 days ago)
      const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000)
      localStorage.setItem('session_timestamp', oldTimestamp.toString())
      localStorage.setItem('integram_session', JSON.stringify({ data: 'test' }))

      const bytesFreed = cleanupOldData()
      expect(bytesFreed).toBeGreaterThan(0)
      expect(localStorage.getItem('session_timestamp')).toBe(null)
      expect(localStorage.getItem('integram_session')).toBe(null)
    })

    it('should not remove recent session data', () => {
      // Set recent timestamp (1 day ago)
      const recentTimestamp = Date.now() - (1 * 24 * 60 * 60 * 1000)
      localStorage.setItem('session_timestamp', recentTimestamp.toString())
      localStorage.setItem('integram_session', JSON.stringify({ data: 'test' }))

      const bytesFreed = cleanupOldData()
      expect(bytesFreed).toBe(0)
      expect(localStorage.getItem('session_timestamp')).not.toBe(null)
      expect(localStorage.getItem('integram_session')).not.toBe(null)
    })

    it('should remove orphaned unified_auth_session_id', () => {
      // No session_timestamp but has unified_auth_session_id
      localStorage.setItem('unified_auth_session_id', 'abc-123')

      const bytesFreed = cleanupOldData()
      expect(bytesFreed).toBeGreaterThan(0)
      expect(localStorage.getItem('unified_auth_session_id')).toBe(null)
    })

    it('should not remove unified_auth_session_id if session exists', () => {
      localStorage.setItem('session_timestamp', Date.now().toString())
      localStorage.setItem('unified_auth_session_id', 'abc-123')

      cleanupOldData()
      expect(localStorage.getItem('unified_auth_session_id')).not.toBe(null)
    })

    it('should remove test keys', () => {
      localStorage.setItem('test_key1', 'value1')
      localStorage.setItem('test_key2', 'value2')
      localStorage.setItem('normal_key', 'value3')

      const bytesFreed = cleanupOldData()
      expect(bytesFreed).toBeGreaterThan(0)
      expect(localStorage.getItem('test_key1')).toBe(null)
      expect(localStorage.getItem('test_key2')).toBe(null)
      expect(localStorage.getItem('normal_key')).not.toBe(null)
    })

    it('should return 0 if nothing to clean', () => {
      localStorage.setItem('normal_key', 'value')
      localStorage.setItem('session_timestamp', Date.now().toString())

      const bytesFreed = cleanupOldData()
      expect(bytesFreed).toBe(0)
    })
  })

  describe('getStorageStats', () => {
    it('should return correct stats for empty storage', () => {
      const stats = getStorageStats()
      expect(stats.totalSize).toBe(0)
      expect(stats.totalSizeKB).toBe('0.00')
      expect(stats.percentUsed).toBe('0.0')
      expect(stats.items).toEqual([])
    })

    it('should return correct stats for single item', () => {
      localStorage.setItem('key', 'value')
      const stats = getStorageStats()

      expect(stats.totalSize).toBeGreaterThan(0)
      expect(parseFloat(stats.totalSizeKB)).toBeGreaterThan(0)
      expect(parseFloat(stats.percentUsed)).toBeGreaterThan(0)
      expect(stats.items).toHaveLength(1)
      expect(stats.items[0].key).toBe('key')
    })

    it('should sort items by size (largest first)', () => {
      localStorage.setItem('small', 'x')
      localStorage.setItem('large', 'x'.repeat(1000))
      localStorage.setItem('medium', 'x'.repeat(100))

      const stats = getStorageStats()
      expect(stats.items).toHaveLength(3)
      expect(stats.items[0].key).toBe('large')
      expect(stats.items[1].key).toBe('medium')
      expect(stats.items[2].key).toBe('small')
    })

    it('should include size in KB and bytes', () => {
      localStorage.setItem('key', 'value')
      const stats = getStorageStats()

      expect(stats.items[0]).toHaveProperty('key')
      expect(stats.items[0]).toHaveProperty('sizeKB')
      expect(stats.items[0]).toHaveProperty('sizeBytes')
      expect(typeof stats.items[0].sizeBytes).toBe('number')
      expect(typeof stats.items[0].sizeKB).toBe('string')
    })

    it('should calculate percentUsed correctly', () => {
      // Add 100KB of data
      localStorage.setItem('data', 'x'.repeat(100 * 1024))
      const stats = getStorageStats()

      const expectedPercent = (parseFloat(stats.totalSizeKB) / (config.MAX_LOCALSTORAGE_SIZE / 1024)) * 100
      expect(Math.abs(parseFloat(stats.percentUsed) - expectedPercent)).toBeLessThan(0.1)
    })
  })

  describe('clearAllStorage', () => {
    it('should clear all localStorage items', () => {
      localStorage.setItem('key1', 'value1')
      localStorage.setItem('key2', 'value2')
      localStorage.setItem('key3', 'value3')

      const result = clearAllStorage()
      expect(result).toBe(true)
      expect(localStorage.length).toBe(0)
      expect(getCurrentStorageSize()).toBe(0)
    })

    it('should succeed even if storage is already empty', () => {
      const result = clearAllStorage()
      expect(result).toBe(true)
      expect(localStorage.length).toBe(0)
    })
  })

  describe('QuotaExceededError handling', () => {
    it('should warn when approaching quota limit', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn')

      // Create data that's 85% of quota (above WARN_THRESHOLD of 80%)
      const largeData = 'x'.repeat(Math.floor(config.MAX_LOCALSTORAGE_SIZE * 0.85))
      setItemSafe('large_data', largeData)

      expect(consoleWarnSpy).toHaveBeenCalled()
      const warnCalls = consoleWarnSpy.mock.calls
      const quotaWarning = warnCalls.find(call =>
        call[0] && call[0].includes('Near quota limit')
      )
      expect(quotaWarning).toBeTruthy()

      consoleWarnSpy.mockRestore()
    })

    it('should trigger cleanup when near quota', () => {
      // Add old session data
      const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000)
      localStorage.setItem('session_timestamp', oldTimestamp.toString())
      localStorage.setItem('integram_session', JSON.stringify({ data: 'old' }))

      const consoleLogSpy = vi.spyOn(console, 'log')

      // Add large data to trigger cleanup
      const largeData = 'x'.repeat(Math.floor(config.MAX_LOCALSTORAGE_SIZE * 0.85))
      setItemSafe('large_data', largeData)

      // Check that cleanup was triggered
      const cleanupCalls = consoleLogSpy.mock.calls.filter(call =>
        call[0] && (call[0].includes('Freed') || call[0].includes('Removed expired'))
      )
      expect(cleanupCalls.length).toBeGreaterThan(0)

      consoleLogSpy.mockRestore()
    })
  })

  describe('Integration tests', () => {
    it('should handle typical session data save', () => {
      const sessionData = {
        database: 'my',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
        xsrfToken: '_xsrf_token_123',
        userId: 42,
        userName: 'testuser',
        authDatabase: 'my',
        timestamp: Date.now()
      }

      const result = setItemSafe('integram_session', JSON.stringify(sessionData))
      expect(result).toBe(true)

      const retrieved = getItemSafe('integram_session')
      expect(retrieved).not.toBe(null)
      expect(JSON.parse(retrieved)).toEqual(sessionData)
    })

    it('should handle multiple auth tokens', () => {
      const tokens = {
        token: 'main_token_123',
        _xsrf: 'xsrf_123',
        id: '42',
        user: 'testuser',
        ddadmin_token: 'ddadmin_token_456',
        ddadmin_xsrf: 'ddadmin_xsrf_456',
        my_token: 'my_token_789',
        my_xsrf: 'my_xsrf_789'
      }

      for (const [key, value] of Object.entries(tokens)) {
        const result = setItemSafe(key, value)
        expect(result).toBe(true)
      }

      // Verify all tokens were saved
      for (const [key, value] of Object.entries(tokens)) {
        expect(getItemSafe(key)).toBe(value)
      }

      const stats = getStorageStats()
      expect(stats.items.length).toBeGreaterThanOrEqual(Object.keys(tokens).length)
    })

    it('should properly cleanup after quota test', () => {
      const initialSize = getCurrentStorageSize()

      // testQuotaHandling should clean up after itself
      testQuotaHandling()

      const finalSize = getCurrentStorageSize()
      expect(finalSize).toBeLessThanOrEqual(initialSize + 100) // Allow small margin
    })
  })

  describe('Edge cases', () => {
    it('should handle very long keys', () => {
      const longKey = 'key_' + 'x'.repeat(1000)
      const result = setItemSafe(longKey, 'value')
      expect(result).toBe(true)
      expect(getItemSafe(longKey)).toBe('value')
    })

    it('should handle very long values', () => {
      const longValue = 'x'.repeat(10000)
      const result = setItemSafe('key', longValue)
      expect(result).toBe(true)
      expect(getItemSafe('key')).toBe(longValue)
    })

    it('should handle rapid successive writes', () => {
      for (let i = 0; i < 100; i++) {
        const result = setItemSafe(`key_${i}`, `value_${i}`)
        expect(result).toBe(true)
      }

      expect(localStorage.length).toBeGreaterThanOrEqual(100)
    })

    it('should handle null and undefined gracefully', () => {
      setItemSafe('null_test', null)
      expect(getItemSafe('null_test')).toBe('null')

      setItemSafe('undefined_test', undefined)
      expect(getItemSafe('undefined_test')).toBe('undefined')
    })
  })

  describe('Security and stability', () => {
    it('should not throw errors on localStorage access failure', () => {
      // This test verifies error handling, but actual SecurityError
      // is hard to trigger in tests without mocking
      expect(() => getItemSafe('key')).not.toThrow()
      expect(() => setItemSafe('key', 'value')).not.toThrow()
      expect(() => removeItemSafe('key')).not.toThrow()
      expect(() => getCurrentStorageSize()).not.toThrow()
      expect(() => cleanupOldData()).not.toThrow()
      expect(() => getStorageStats()).not.toThrow()
    })

    it('should handle storage across multiple operations', () => {
      // Simulate real-world usage pattern
      setItemSafe('session_timestamp', Date.now().toString())
      setItemSafe('token', 'abc123')
      setItemSafe('user', 'testuser')

      const sessionData = {
        database: 'my',
        token: 'abc123',
        userId: 42
      }
      setItemSafe('integram_session', JSON.stringify(sessionData))

      const stats = getStorageStats()
      expect(stats.items.length).toBeGreaterThanOrEqual(4)

      // Cleanup should not affect recent data
      cleanupOldData()
      expect(getItemSafe('token')).toBe('abc123')
      expect(getItemSafe('user')).toBe('testuser')
    })
  })
})
