/**
 * Unit Tests for SessionManagerService
 * Issue #2784 - Phase 2: Token Management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import * as sessionManager from '../sessionManagerService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test registry path
const TEST_REGISTRY_PATH = path.join(__dirname, '../../../../data/session_registry_test.json')

// Test user object
const testUser = {
  id: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
}

describe('SessionManagerService', () => {
  beforeEach(async () => {
    // Clean up test registry before each test
    try {
      await fs.unlink(TEST_REGISTRY_PATH)
    } catch (error) {
      // File doesn't exist, that's OK
    }
  })

  afterEach(async () => {
    // Clean up test registry after each test
    try {
      await fs.unlink(TEST_REGISTRY_PATH)
    } catch (error) {
      // Ignore errors
    }
  })

  describe('createSession', () => {
    it('should create a new session with tokens', async () => {
      const deviceInfo = {
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      }

      const session = await sessionManager.createSession(testUser, deviceInfo)

      expect(session).toBeDefined()
      expect(session.sessionId).toMatch(/^session_/)
      expect(session.accessToken).toBeDefined()
      expect(session.refreshToken).toBeDefined()
      expect(session.expiresIn).toBeDefined()
      expect(session.tokenType).toBe('Bearer')
    })

    it('should parse device info correctly', async () => {
      const deviceInfo = {
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      }

      const session = await sessionManager.createSession(testUser, deviceInfo)

      const sessions = await sessionManager.getUserSessions(testUser.id)
      expect(sessions).toHaveLength(1)
      expect(sessions[0].deviceInfo.deviceType).toBe('desktop')
      expect(sessions[0].deviceInfo.browser).toContain('Chrome')
    })

    it('should detect mobile devices', async () => {
      const deviceInfo = {
        ip: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
      }

      const session = await sessionManager.createSession(testUser, deviceInfo)

      const sessions = await sessionManager.getUserSessions(testUser.id)
      expect(sessions[0].deviceInfo.deviceType).toBe('mobile')
    })

    it('should allow multiple sessions for the same user', async () => {
      const deviceInfo1 = { ip: '192.168.1.100', userAgent: 'Chrome' }
      const deviceInfo2 = { ip: '192.168.1.101', userAgent: 'Firefox' }

      await sessionManager.createSession(testUser, deviceInfo1)
      await sessionManager.createSession(testUser, deviceInfo2)

      const sessions = await sessionManager.getUserSessions(testUser.id)
      expect(sessions).toHaveLength(2)
    })
  })

  describe('refreshSession', () => {
    it('should generate new tokens when refresh token is valid', async () => {
      const session = await sessionManager.createSession(testUser, {
        ip: '192.168.1.100',
        userAgent: 'Chrome',
      })

      const originalAccessToken = session.accessToken
      const refreshedSession = await sessionManager.refreshSession(session.refreshToken)

      expect(refreshedSession.accessToken).toBeDefined()
      expect(refreshedSession.accessToken).not.toBe(originalAccessToken)
      expect(refreshedSession.refreshToken).toBeDefined()
      expect(refreshedSession.tokenType).toBe('Bearer')
    })

    it('should throw error for invalid refresh token', async () => {
      await expect(
        sessionManager.refreshSession('invalid-token')
      ).rejects.toThrow('Invalid or expired refresh token')
    })

    it('should throw error for revoked session', async () => {
      const session = await sessionManager.createSession(testUser, {})

      await sessionManager.revokeSession(session.sessionId)

      await expect(
        sessionManager.refreshSession(session.refreshToken)
      ).rejects.toThrow('Session is not active')
    })
  })

  describe('validateSession', () => {
    it('should validate correct access token', async () => {
      const session = await sessionManager.createSession(testUser, {
        ip: '192.168.1.100',
        userAgent: 'Chrome',
      })

      const validation = await sessionManager.validateSession(session.accessToken)

      expect(validation).toBeDefined()
      expect(validation.sessionId).toBe(session.sessionId)
      expect(validation.userId).toBe(testUser.id)
      expect(validation.user.id).toBe(testUser.id)
      expect(validation.user.email).toBe(testUser.email)
    })

    it('should throw error for invalid access token', async () => {
      await expect(
        sessionManager.validateSession('invalid-token')
      ).rejects.toThrow('Invalid or expired access token')
    })

    it('should throw error for revoked session', async () => {
      const session = await sessionManager.createSession(testUser, {})

      await sessionManager.revokeSession(session.sessionId)

      await expect(
        sessionManager.validateSession(session.accessToken)
      ).rejects.toThrow('Session is not active')
    })
  })

  describe('revokeSession', () => {
    it('should mark session as revoked', async () => {
      const session = await sessionManager.createSession(testUser, {})

      const revoked = await sessionManager.revokeSession(session.sessionId)

      expect(revoked.status).toBe('revoked')
      expect(revoked.revokedAt).toBeDefined()
    })

    it('should remove revoked session from active sessions list', async () => {
      const session = await sessionManager.createSession(testUser, {})

      await sessionManager.revokeSession(session.sessionId)

      const sessions = await sessionManager.getUserSessions(testUser.id)
      expect(sessions).toHaveLength(0)
    })

    it('should throw error for non-existent session', async () => {
      await expect(
        sessionManager.revokeSession('non-existent-session')
      ).rejects.toThrow('Session non-existent-session not found')
    })
  })

  describe('getUserSessions', () => {
    it('should return empty array for user with no sessions', async () => {
      const sessions = await sessionManager.getUserSessions('user-no-sessions')

      expect(sessions).toEqual([])
    })

    it('should return all active sessions for user', async () => {
      await sessionManager.createSession(testUser, { ip: '192.168.1.100' })
      await sessionManager.createSession(testUser, { ip: '192.168.1.101' })

      const sessions = await sessionManager.getUserSessions(testUser.id)

      expect(sessions).toHaveLength(2)
    })

    it('should not return revoked sessions', async () => {
      const session1 = await sessionManager.createSession(testUser, {})
      await sessionManager.createSession(testUser, {})

      await sessionManager.revokeSession(session1.sessionId)

      const sessions = await sessionManager.getUserSessions(testUser.id)
      expect(sessions).toHaveLength(1)
    })

    it('should include device info in returned sessions', async () => {
      await sessionManager.createSession(testUser, {
        ip: '192.168.1.100',
        userAgent: 'Chrome/120',
      })

      const sessions = await sessionManager.getUserSessions(testUser.id)

      expect(sessions[0].deviceInfo).toBeDefined()
      expect(sessions[0].deviceInfo.ip).toBe('192.168.1.100')
    })
  })

  describe('revokeAllSessions', () => {
    it('should revoke all sessions for user', async () => {
      await sessionManager.createSession(testUser, {})
      await sessionManager.createSession(testUser, {})
      await sessionManager.createSession(testUser, {})

      const revokedCount = await sessionManager.revokeAllSessions(testUser.id)

      expect(revokedCount).toBe(3)

      const sessions = await sessionManager.getUserSessions(testUser.id)
      expect(sessions).toHaveLength(0)
    })

    it('should return 0 for user with no sessions', async () => {
      const revokedCount = await sessionManager.revokeAllSessions('user-no-sessions')

      expect(revokedCount).toBe(0)
    })

    it('should not affect other users sessions', async () => {
      const user2 = { id: 'user-2', username: 'user2', email: 'user2@example.com' }

      await sessionManager.createSession(testUser, {})
      await sessionManager.createSession(user2, {})

      await sessionManager.revokeAllSessions(testUser.id)

      const user2Sessions = await sessionManager.getUserSessions(user2.id)
      expect(user2Sessions).toHaveLength(1)
    })
  })

  describe('cleanupExpiredSessions', () => {
    it('should return 0 when no sessions are expired', async () => {
      await sessionManager.createSession(testUser, {})

      const cleanedCount = await sessionManager.cleanupExpiredSessions()

      expect(cleanedCount).toBe(0)
    })

    // Note: Testing actual expiration would require mocking time or waiting,
    // which is not practical for unit tests. Integration tests should cover this.
  })
})
