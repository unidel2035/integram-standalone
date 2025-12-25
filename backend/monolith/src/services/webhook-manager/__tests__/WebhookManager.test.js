/**
 * Tests for WebhookManager
 *
 * Issue: #2494
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebhookManager } from '../WebhookManager.js'
import { WebhookStorage } from '../WebhookStorage.js'
import { RateLimiter } from '../RateLimiter.js'
import { WebhookRetryQueue } from '../WebhookRetryQueue.js'

describe('WebhookManager', () => {
  let webhookManager
  let mockStorage
  let mockRateLimiter
  let mockRetryQueue

  beforeEach(() => {
    // Create mocks
    mockStorage = {
      saveWebhook: vi.fn(),
      getWebhook: vi.fn(),
      deleteWebhook: vi.fn(),
      listWebhooksByUser: vi.fn(),
      listWebhooksByEvent: vi.fn(),
      saveWebhookLog: vi.fn(),
      logWebhookReceipt: vi.fn()
    }

    mockRateLimiter = {
      checkLimit: vi.fn().mockReturnValue(true)
    }

    mockRetryQueue = {
      enqueue: vi.fn()
    }

    webhookManager = new WebhookManager({
      storage: mockStorage,
      rateLimiter: mockRateLimiter,
      retryQueue: mockRetryQueue
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('registerWebhook', () => {
    it('should create a new webhook with all required fields', async () => {
      const config = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['test.event'],
        userId: 'user-123'
      }

      mockStorage.saveWebhook.mockResolvedValue()

      const webhook = await webhookManager.registerWebhook(config)

      expect(webhook).toHaveProperty('id')
      expect(webhook).toHaveProperty('name', config.name)
      expect(webhook).toHaveProperty('url', config.url)
      expect(webhook).toHaveProperty('events', config.events)
      expect(webhook).toHaveProperty('status', 'active')
      expect(webhook).toHaveProperty('hasSecret', true)
      expect(webhook).not.toHaveProperty('secret') // Secret should not be exposed

      expect(mockStorage.saveWebhook).toHaveBeenCalledTimes(1)
    })

    it('should throw error if required fields are missing', async () => {
      await expect(webhookManager.registerWebhook({}))
        .rejects.toThrow('Missing required fields')
    })

    it('should throw error if URL is invalid', async () => {
      await expect(webhookManager.registerWebhook({
        name: 'Test',
        url: 'invalid-url',
        events: ['test']
      })).rejects.toThrow('Invalid webhook URL')
    })

    it('should generate a secret if not provided', async () => {
      mockStorage.saveWebhook.mockResolvedValue()

      const webhook = await webhookManager.registerWebhook({
        name: 'Test',
        url: 'https://example.com',
        events: ['test']
      })

      expect(webhook.hasSecret).toBe(true)
    })
  })

  describe('updateWebhook', () => {
    it('should update webhook fields', async () => {
      const existingWebhook = {
        id: 'wh-123',
        name: 'Old Name',
        url: 'https://old.com',
        events: ['old.event'],
        status: 'active'
      }

      mockStorage.getWebhook.mockResolvedValue(existingWebhook)
      mockStorage.saveWebhook.mockResolvedValue()

      const updates = {
        name: 'New Name',
        url: 'https://new.com'
      }

      const updated = await webhookManager.updateWebhook('wh-123', updates)

      expect(updated.name).toBe('New Name')
      expect(updated.url).toBe('https://new.com')
      expect(updated.events).toEqual(['old.event']) // Unchanged
    })

    it('should throw error if webhook not found', async () => {
      mockStorage.getWebhook.mockResolvedValue(null)

      await expect(webhookManager.updateWebhook('nonexistent', {}))
        .rejects.toThrow('Webhook not found')
    })
  })

  describe('deleteWebhook', () => {
    it('should delete a webhook', async () => {
      const webhook = { id: 'wh-123', name: 'Test' }
      mockStorage.getWebhook.mockResolvedValue(webhook)
      mockStorage.deleteWebhook.mockResolvedValue()

      const result = await webhookManager.deleteWebhook('wh-123')

      expect(result).toBe(true)
      expect(mockStorage.deleteWebhook).toHaveBeenCalledWith('wh-123')
    })

    it('should throw error if webhook not found', async () => {
      mockStorage.getWebhook.mockResolvedValue(null)

      await expect(webhookManager.deleteWebhook('nonexistent'))
        .rejects.toThrow('Webhook not found')
    })
  })

  describe('receiveWebhook', () => {
    it('should verify webhook signature and log receipt', async () => {
      const request = {
        body: { test: 'data' },
        headers: {},
        ip: '127.0.0.1'
      }

      mockStorage.logWebhookReceipt.mockResolvedValue()

      const result = await webhookManager.receiveWebhook(request, 'test-provider')

      expect(result).toHaveProperty('received', true)
      expect(result).toHaveProperty('provider', 'test-provider')
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('127.0.0.1')
      expect(mockStorage.logWebhookReceipt).toHaveBeenCalled()
    })

    it('should reject webhook if rate limit exceeded', async () => {
      mockRateLimiter.checkLimit.mockReturnValue(false)

      const request = {
        body: {},
        headers: {},
        ip: '127.0.0.1'
      }

      await expect(webhookManager.receiveWebhook(request, 'test'))
        .rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('registerHandler', () => {
    it('should register a webhook handler for a provider', () => {
      const handler = vi.fn()

      webhookManager.registerHandler('github', handler)

      expect(webhookManager.handlers.has('github')).toBe(true)
      expect(webhookManager.handlers.get('github')).toBe(handler)
    })
  })
})
