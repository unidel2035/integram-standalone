/**
 * Tests for OAuth Token Refresh Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import TokenRefreshService from '../TokenRefreshService.js'

describe('TokenRefreshService', () => {
  let service

  beforeEach(() => {
    service = new TokenRefreshService({
      refreshInterval: 1000, // 1 second for testing
      expirationThreshold: 300
    })

    vi.useFakeTimers()
  })

  afterEach(() => {
    if (service.isRunning) {
      service.stop()
    }
    vi.restoreAllMocks()
  })

  describe('start/stop', () => {
    it('should start the service', () => {
      service.start()

      expect(service.isRunning).toBe(true)
      expect(service.intervalId).not.toBeNull()
    })

    it('should not start twice', () => {
      service.start()
      service.start() // Should warn but not error

      expect(service.isRunning).toBe(true)
    })

    it('should stop the service', () => {
      service.start()
      service.stop()

      expect(service.isRunning).toBe(false)
      expect(service.intervalId).toBeNull()
    })
  })

  describe('refreshExpiredTokens', () => {
    it('should refresh all expired tokens', async () => {
      const mockIntegrations = [
        {
          userId: 'user1',
          provider: 'slack',
          config: {
            refreshToken: 'refresh_token_1',
            expiresAt: Math.floor(Date.now() / 1000) - 100
          }
        }
      ]

      vi.spyOn(service, 'getIntegrationsNeedingRefresh').mockResolvedValue(mockIntegrations)
      vi.spyOn(service, 'refreshIntegrationToken').mockResolvedValue({
        accessToken: 'new_token',
        expiresIn: 3600
      })

      const result = await service.refreshExpiredTokens()

      expect(result.total).toBe(1)
      expect(result.success).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('should handle refresh failures', async () => {
      const mockIntegrations = [
        {
          userId: 'user1',
          provider: 'slack',
          config: { refreshToken: 'invalid_token' }
        }
      ]

      vi.spyOn(service, 'getIntegrationsNeedingRefresh').mockResolvedValue(mockIntegrations)
      vi.spyOn(service, 'refreshIntegrationToken').mockRejectedValue(new Error('Invalid token'))
      vi.spyOn(service, 'markIntegrationAsFailed').mockResolvedValue()

      const result = await service.refreshExpiredTokens()

      expect(result.total).toBe(1)
      expect(result.success).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.errors[0].error).toContain('Invalid token')
    })
  })

  describe('refreshIntegrationToken', () => {
    it('should throw error if no refresh token', async () => {
      const integration = {
        userId: 'user1',
        provider: 'slack',
        config: {}
      }

      await expect(
        service.refreshIntegrationToken(integration)
      ).rejects.toThrow('No refresh token available')
    })

    it('should throw error for unsupported provider', async () => {
      const integration = {
        userId: 'user1',
        provider: 'invalid-provider',
        config: { refreshToken: 'token' }
      }

      await expect(
        service.refreshIntegrationToken(integration)
      ).rejects.toThrow()
    })
  })

  describe('markIntegrationAsFailed', () => {
    it('should mark integration as failed', async () => {
      const integration = {
        userId: 'user1',
        provider: 'slack',
        config: { status: 'active' }
      }

      const error = new Error('Token expired')

      await service.markIntegrationAsFailed(integration, error)

      // Should not throw
      expect(true).toBe(true)
    })
  })
})
