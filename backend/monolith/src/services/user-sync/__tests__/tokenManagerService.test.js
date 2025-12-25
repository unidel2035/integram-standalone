/**
 * Unit Tests for TokenManagerService
 * Issue #2784 - Phase 2: Token Management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import * as tokenManager from '../tokenManagerService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test registry path
const TEST_REGISTRY_PATH = path.join(__dirname, '../../../../data/token_registry_test.json')

describe('TokenManagerService', () => {
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

  describe('createDefaultToken', () => {
    it('should create a default token with correct configuration', async () => {
      const userId = 'test-user-123'
      const token = await tokenManager.createDefaultToken(userId)

      expect(token).toBeDefined()
      expect(token.id).toMatch(/^dd_tok_/)
      expect(token.userId).toBe(userId)
      expect(token.type).toBe('default')
      expect(token.provider).toBe('deepseek')
      expect(token.balance).toBe(1000000) // 1M tokens
      expect(token.dailyLimit).toBe(100000) // 100K
      expect(token.monthlyLimit).toBe(1000000) // 1M
      expect(token.status).toBe('active')
      expect(token.usageStats).toBeDefined()
      expect(token.usageStats.totalUsed).toBe(0)
    })

    it('should store token in registry', async () => {
      const userId = 'test-user-456'
      const token = await tokenManager.createDefaultToken(userId)

      const tokens = await tokenManager.getTokensByUser(userId)
      expect(tokens).toHaveLength(1)
      expect(tokens[0].id).toBe(token.id)
    })

    it('should allow multiple tokens for the same user', async () => {
      const userId = 'test-user-789'

      const token1 = await tokenManager.createDefaultToken(userId)
      const token2 = await tokenManager.createDefaultToken(userId)

      expect(token1.id).not.toBe(token2.id)

      const tokens = await tokenManager.getTokensByUser(userId)
      expect(tokens).toHaveLength(2)
    })
  })

  describe('createCustomToken', () => {
    it('should create a custom token with specified options', async () => {
      const userId = 'test-user-custom'
      const options = {
        type: 'premium',
        provider: 'openai',
        modelId: 'gpt-4',
        balance: 5000000,
        dailyLimit: 500000,
        monthlyLimit: 5000000,
      }

      const token = await tokenManager.createCustomToken(userId, options)

      expect(token.type).toBe('premium')
      expect(token.provider).toBe('openai')
      expect(token.modelId).toBe('gpt-4')
      expect(token.balance).toBe(5000000)
      expect(token.dailyLimit).toBe(500000)
      expect(token.monthlyLimit).toBe(5000000)
    })

    it('should use default values for omitted options', async () => {
      const userId = 'test-user-defaults'
      const token = await tokenManager.createCustomToken(userId, {})

      expect(token.type).toBe('custom')
      expect(token.provider).toBe('deepseek')
      expect(token.balance).toBe(1000000)
    })
  })

  describe('getTokensByUser', () => {
    it('should return empty array for user with no tokens', async () => {
      const userId = 'user-no-tokens'
      const tokens = await tokenManager.getTokensByUser(userId)

      expect(tokens).toEqual([])
    })

    it('should return only active tokens', async () => {
      const userId = 'user-with-revoked'

      const token1 = await tokenManager.createDefaultToken(userId)
      const token2 = await tokenManager.createDefaultToken(userId)

      // Revoke one token
      await tokenManager.revokeToken(token1.id)

      const tokens = await tokenManager.getTokensByUser(userId)
      expect(tokens).toHaveLength(1)
      expect(tokens[0].id).toBe(token2.id)
    })
  })

  describe('updateTokenBalance', () => {
    it('should add balance when amount is positive', async () => {
      const userId = 'user-recharge'
      const token = await tokenManager.createDefaultToken(userId)

      const updated = await tokenManager.updateTokenBalance(token.id, 500000)

      expect(updated.balance).toBe(1500000) // 1M + 500K
      expect(updated.usageStats.totalUsed).toBe(0)
    })

    it('should deduct balance and update usage when amount is negative', async () => {
      const userId = 'user-usage'
      const token = await tokenManager.createDefaultToken(userId)

      const updated = await tokenManager.updateTokenBalance(token.id, -10000)

      expect(updated.balance).toBe(990000) // 1M - 10K
      expect(updated.usageStats.totalUsed).toBe(10000)
      expect(updated.usageStats.today).toBe(10000)
      expect(updated.usageStats.thisMonth).toBe(10000)
    })

    it('should throw error for non-existent token', async () => {
      await expect(
        tokenManager.updateTokenBalance('non-existent-token', 1000)
      ).rejects.toThrow('Token non-existent-token not found')
    })
  })

  describe('revokeToken', () => {
    it('should mark token as revoked', async () => {
      const userId = 'user-revoke'
      const token = await tokenManager.createDefaultToken(userId)

      const revoked = await tokenManager.revokeToken(token.id)

      expect(revoked.status).toBe('revoked')
      expect(revoked.revokedAt).toBeDefined()
    })

    it('should remove revoked token from active tokens list', async () => {
      const userId = 'user-revoke-check'
      const token = await tokenManager.createDefaultToken(userId)

      await tokenManager.revokeToken(token.id)

      const tokens = await tokenManager.getTokensByUser(userId)
      expect(tokens).toHaveLength(0)
    })
  })

  describe('checkTokenAvailability', () => {
    it('should allow usage when sufficient balance and within limits', async () => {
      const userId = 'user-check-ok'
      const token = await tokenManager.createDefaultToken(userId)

      const result = await tokenManager.checkTokenAvailability(token.id, 1000)

      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('OK')
    })

    it('should deny when insufficient balance', async () => {
      const userId = 'user-low-balance'
      const token = await tokenManager.createDefaultToken(userId)

      // Use up most of the balance
      await tokenManager.updateTokenBalance(token.id, -999000)

      const result = await tokenManager.checkTokenAvailability(token.id, 5000)

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Insufficient balance')
    })

    it('should deny when daily limit exceeded', async () => {
      const userId = 'user-daily-limit'
      const token = await tokenManager.createDefaultToken(userId)

      // Use up daily limit (100K)
      await tokenManager.updateTokenBalance(token.id, -100000)

      const result = await tokenManager.checkTokenAvailability(token.id, 1000)

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Daily limit exceeded')
    })

    it('should deny when monthly limit exceeded', async () => {
      const userId = 'user-monthly-limit'
      const token = await tokenManager.createCustomToken(userId, {
        balance: 2000000,
        dailyLimit: 200000,
        monthlyLimit: 100000, // Set monthly limit lower than balance
      })

      // Use up monthly limit
      await tokenManager.updateTokenBalance(token.id, -100000)

      const result = await tokenManager.checkTokenAvailability(token.id, 1000)

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Monthly limit exceeded')
    })

    it('should deny for revoked token', async () => {
      const userId = 'user-revoked-check'
      const token = await tokenManager.createDefaultToken(userId)

      await tokenManager.revokeToken(token.id)

      const result = await tokenManager.checkTokenAvailability(token.id, 1000)

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Token is not active')
    })

    it('should deny for non-existent token', async () => {
      const result = await tokenManager.checkTokenAvailability('non-existent', 1000)

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Token not found')
    })
  })

  describe('linkTokenToUser', () => {
    it('should link existing token to user', async () => {
      const userId1 = 'user-original'
      const userId2 = 'user-new-owner'

      const token = await tokenManager.createDefaultToken(userId1)

      await tokenManager.linkTokenToUser(token.id, userId2)

      const updated = await tokenManager.getTokenById(token.id)
      expect(updated.userId).toBe(userId2)

      const user2Tokens = await tokenManager.getTokensByUser(userId2)
      expect(user2Tokens.some(t => t.id === token.id)).toBe(true)
    })
  })
})
