/**
 * Tests for integramApiClient and integramService session synchronization
 *
 * This test ensures that both services use the same localStorage key
 * so that authentication tokens are shared between them.
 *
 * Related to issue #3332 - fixing empty reference field lists
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('IntegrimService and IntegrimApiClient Session Sync', () => {
  const STORAGE_KEY = 'integram_session'

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    // Clean up
    localStorage.clear()
  })

  it('integramService and integramApiClient use the same localStorage key', async () => {
    // Import services dynamically to ensure fresh instances
    const { default: integramService } = await import('@/services/integramService')
    const { default: integramApiClient } = await import('@/services/integramApiClient')

    // Simulate login with integramService
    const mockSessionData = {
      database: 'a2025',
      token: 'test-token-123',
      xsrfToken: 'xsrf-456',
      userId: 1,
      userName: 'testuser',
      userRole: 'admin'
    }

    // Set session data in localStorage (simulating login)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockSessionData))

    // Reload session for both services
    integramService.loadSession()
    integramApiClient.loadSession()

    // Verify both services have the same token
    expect(integramService.authToken).toBe(mockSessionData.token)
    expect(integramApiClient.token).toBe(mockSessionData.token)
    expect(integramService.xsrfToken).toBe(mockSessionData.xsrfToken)
    expect(integramApiClient.xsrfToken).toBe(mockSessionData.xsrfToken)
  })

  it('integramService saves session to the correct localStorage key', async () => {
    const { default: integramService } = await import('@/services/integramService')

    // Set session data
    integramService.authToken = 'test-token'
    integramService.xsrfToken = 'xsrf-token'
    integramService.currentDatabase = 'a2025'
    integramService.userId = 1
    integramService.userName = 'testuser'
    integramService.userRole = 'admin'

    // Save session
    integramService.saveSession()

    // Check localStorage
    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).not.toBeNull()

    const sessionData = JSON.parse(stored)
    expect(sessionData.token).toBe('test-token')
    expect(sessionData.xsrfToken).toBe('xsrf-token')
    expect(sessionData.database).toBe('a2025')
  })

  it('integramApiClient saves session to the correct localStorage key', async () => {
    const { default: integramApiClient } = await import('@/services/integramApiClient')

    // Set session data
    integramApiClient.token = 'test-token'
    integramApiClient.xsrfToken = 'xsrf-token'
    integramApiClient.database = 'a2025'
    integramApiClient.userId = 1
    integramApiClient.userName = 'testuser'
    integramApiClient.userRole = 'admin'

    // Save session
    integramApiClient.saveSession()

    // Check localStorage
    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).not.toBeNull()

    const sessionData = JSON.parse(stored)
    expect(sessionData.token).toBe('test-token')
    expect(sessionData.xsrfToken).toBe('xsrf-token')
    expect(sessionData.database).toBe('a2025')
  })

  it('both services can authenticate using the same session', async () => {
    const { default: integramService } = await import('@/services/integramService')
    const { default: integramApiClient } = await import('@/services/integramApiClient')

    // Simulate login with integramService
    const mockSessionData = {
      database: 'a2025',
      token: 'shared-token-789',
      xsrfToken: 'shared-xsrf-123',
      userId: 42,
      userName: 'shareduser',
      userRole: 'user'
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockSessionData))

    // Load session in both services
    integramService.loadSession()
    integramApiClient.loadSession()

    // Verify authentication status
    expect(integramService.isAuthenticated()).toBe(true)
    expect(integramApiClient.isAuthenticated()).toBe(true)

    // Verify they have the same credentials
    expect(integramService.authToken).toBe(integramApiClient.token)
    expect(integramService.xsrfToken).toBe(integramApiClient.xsrfToken)
    expect(integramService.currentDatabase).toBe(integramApiClient.database)
  })

  it('clearing session in one service affects both', async () => {
    const { default: integramService } = await import('@/services/integramService')
    const { default: integramApiClient } = await import('@/services/integramApiClient')

    // Set up session
    const mockSessionData = {
      database: 'a2025',
      token: 'token-to-clear',
      xsrfToken: 'xsrf-to-clear',
      userId: 99,
      userName: 'user99',
      userRole: 'user'
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockSessionData))
    integramService.loadSession()
    integramApiClient.loadSession()

    // Clear session with integramService
    integramService.clearSession()

    // Verify localStorage is cleared
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    // Reload both services
    integramService.loadSession()
    integramApiClient.loadSession()

    // Both should be unauthenticated now
    expect(integramService.isAuthenticated()).toBe(false)
    expect(integramApiClient.isAuthenticated()).toBe(false)
  })

  it('session persists across page reloads (simulated)', async () => {
    // Simulate first page load
    const mockSessionData = {
      database: 'a2025',
      token: 'persistent-token',
      xsrfToken: 'persistent-xsrf',
      userId: 100,
      userName: 'persistentuser',
      userRole: 'admin'
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockSessionData))

    // Import services (simulating page load)
    const { default: integramService1 } = await import('@/services/integramService')
    const { default: integramApiClient1 } = await import('@/services/integramApiClient')

    // Both should auto-load session from localStorage on import
    integramService1.loadSession()
    integramApiClient1.loadSession()

    expect(integramService1.isAuthenticated()).toBe(true)
    expect(integramApiClient1.isAuthenticated()).toBe(true)
    expect(integramService1.authToken).toBe('persistent-token')
    expect(integramApiClient1.token).toBe('persistent-token')
  })
})
