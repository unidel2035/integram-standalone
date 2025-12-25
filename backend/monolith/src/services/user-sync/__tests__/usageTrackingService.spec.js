// usageTrackingService.spec.js - Unit tests for Usage Tracking Service
// Phase 3: Payment Integration - Issue #2785

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import UsageTrackingService from '../usageTrackingService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test data directory
const TEST_DATA_DIR = path.join(__dirname, '../../../../data/payments-test')
const USAGE_LOGS_FILE = path.join(TEST_DATA_DIR, 'usage_logs.json')
const USAGE_STATS_FILE = path.join(TEST_DATA_DIR, 'usage_stats.json')

describe('UsageTrackingService', () => {
  let service
  let mockDb

  beforeEach(async () => {
    // Mock database
    mockDb = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          cost_per_1k_input: '0.00014',
          cost_per_1k_output: '0.00028'
        }]
      })
    }

    // Create test data directory
    await fs.mkdir(TEST_DATA_DIR, { recursive: true })

    // Override DATA_DIR for testing
    service = new UsageTrackingService({ db: mockDb })

    // Patch the service to use test directory
    const originalInitialize = service.initialize.bind(service)
    service.initialize = async function() {
      if (this.initialized) return

      await fs.mkdir(TEST_DATA_DIR, { recursive: true })

      try {
        await fs.access(USAGE_LOGS_FILE)
      } catch {
        await fs.writeFile(USAGE_LOGS_FILE, JSON.stringify({ logs: [] }, null, 2))
      }

      try {
        await fs.access(USAGE_STATS_FILE)
      } catch {
        await fs.writeFile(USAGE_STATS_FILE, JSON.stringify({
          daily: {},
          weekly: {},
          monthly: {}
        }, null, 2))
      }

      this.initialized = true
    }

    // Override file paths for testing
    service._readUsageLogs = async () => {
      try {
        const data = await fs.readFile(USAGE_LOGS_FILE, 'utf8')
        return JSON.parse(data)
      } catch {
        return { logs: [] }
      }
    }

    service._writeUsageLogs = async (logs) => {
      await fs.writeFile(USAGE_LOGS_FILE, JSON.stringify(logs, null, 2))
    }

    service._readUsageStats = async () => {
      try {
        const data = await fs.readFile(USAGE_STATS_FILE, 'utf8')
        return JSON.parse(data)
      } catch {
        return { daily: {}, weekly: {}, monthly: {} }
      }
    }

    service._writeUsageStats = async (stats) => {
      await fs.writeFile(USAGE_STATS_FILE, JSON.stringify(stats, null, 2))
    }

    await service.initialize()
  })

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('recordUsage', () => {
    it('should record usage with all fields', async () => {
      const operation = {
        modelId: 'model-123',
        provider: 'deepseek',
        application: 'TestApp',
        operationType: 'chat',
        promptTokens: 100,
        completionTokens: 200,
        metadata: { test: 'data' }
      }

      const result = await service.recordUsage('user-123', 'token-456', operation)

      expect(result).toBeDefined()
      expect(result.id).toMatch(/^usage_/)
      expect(result.userId).toBe('user-123')
      expect(result.tokenId).toBe('token-456')
      expect(result.usage.totalTokens).toBe(300)
      expect(result.cost.amount).toBeGreaterThan(0)
      expect(result.metadata.application).toBe('TestApp')
    })

    it('should calculate cost correctly', async () => {
      const operation = {
        modelId: 'model-123',
        provider: 'deepseek',
        promptTokens: 1000,
        completionTokens: 2000
      }

      const result = await service.recordUsage('user-123', 'token-456', operation)

      // DeepSeek pricing: $0.14/$0.28 per 1M tokens
      // Cost = (1000/1000) * 0.00014 + (2000/1000) * 0.00028
      const expectedCost = (1000 / 1000) * 0.00014 + (2000 / 1000) * 0.00028
      expect(result.cost.amount).toBeCloseTo(expectedCost, 6)
    })

    it('should append log to file', async () => {
      await service.recordUsage('user-123', 'token-456', {
        modelId: 'model-123',
        provider: 'deepseek',
        promptTokens: 100,
        completionTokens: 200
      })

      const logs = await service._readUsageLogs()
      expect(logs.logs.length).toBe(1)
      expect(logs.logs[0].userId).toBe('user-123')
    })

    it('should update aggregated statistics', async () => {
      await service.recordUsage('user-123', 'token-456', {
        modelId: 'model-123',
        provider: 'deepseek',
        promptTokens: 100,
        completionTokens: 200
      })

      const stats = await service._readUsageStats()
      expect(stats.daily['user-123']).toBeDefined()
    })
  })

  describe('getUserUsageStats', () => {
    beforeEach(async () => {
      // Seed test data
      await service.recordUsage('user-123', 'token-456', {
        modelId: 'model-123',
        provider: 'deepseek',
        promptTokens: 100,
        completionTokens: 200
      })
    })

    it('should return usage stats for user', async () => {
      const stats = await service.getUserUsageStats('user-123', 'day')

      expect(stats).toBeDefined()
      const today = new Date().toISOString().split('T')[0]
      expect(stats[today]).toBeDefined()
      expect(stats[today].totalTokens).toBe(300)
    })

    it('should return empty stats for user with no usage', async () => {
      const stats = await service.getUserUsageStats('user-999', 'day')

      expect(stats.userId).toBe('user-999')
      expect(stats.totalTokens).toBe(0)
    })

    it('should handle different periods (day, week, month)', async () => {
      const dailyStats = await service.getUserUsageStats('user-123', 'day')
      const weeklyStats = await service.getUserUsageStats('user-123', 'week')
      const monthlyStats = await service.getUserUsageStats('user-123', 'month')

      expect(dailyStats).toBeDefined()
      expect(weeklyStats).toBeDefined()
      expect(monthlyStats).toBeDefined()
    })
  })

  describe('getTokenUsageStats', () => {
    beforeEach(async () => {
      await service.recordUsage('user-123', 'token-456', {
        modelId: 'model-123',
        provider: 'deepseek',
        promptTokens: 100,
        completionTokens: 200
      })
    })

    it('should return aggregated stats for token', async () => {
      const stats = await service.getTokenUsageStats('token-456', 'day')

      expect(stats.totalTokens).toBe(300)
      expect(stats.operations).toBe(1)
      expect(stats.byModel.deepseek).toBeDefined()
    })

    it('should filter by period', async () => {
      const stats = await service.getTokenUsageStats('token-456', 'week')

      expect(stats.operations).toBeGreaterThan(0)
    })
  })

  describe('calculateCost', () => {
    it('should calculate cost from database pricing', async () => {
      const cost = await service.calculateCost({
        modelId: 'model-123',
        promptTokens: 1000,
        completionTokens: 2000
      }, 'deepseek')

      expect(cost).toBeGreaterThan(0)
      expect(mockDb.query).toHaveBeenCalled()
    })

    it('should use fallback pricing if database fails', async () => {
      mockDb.query = vi.fn().mockResolvedValue({ rows: [] })

      const cost = await service.calculateCost({
        promptTokens: 1000,
        completionTokens: 2000
      }, 'deepseek')

      // Fallback pricing for deepseek
      const expected = (1000 / 1000) * 0.00014 + (2000 / 1000) * 0.00028
      expect(cost).toBeCloseTo(expected, 6)
    })

    it('should handle different providers', async () => {
      mockDb.query = vi.fn().mockResolvedValue({ rows: [] })

      const deepseekCost = await service.calculateCost({
        promptTokens: 1000,
        completionTokens: 1000
      }, 'deepseek')

      const openaiCost = await service.calculateCost({
        promptTokens: 1000,
        completionTokens: 1000
      }, 'openai')

      expect(deepseekCost).toBeDefined()
      expect(openaiCost).toBeDefined()
      // OpenAI is more expensive than DeepSeek
      expect(openaiCost).toBeGreaterThan(deepseekCost)
    })
  })

  describe('aggregateUsage', () => {
    beforeEach(async () => {
      // Create multiple usage entries
      for (let i = 0; i < 5; i++) {
        await service.recordUsage('user-123', 'token-456', {
          modelId: 'model-123',
          provider: 'deepseek',
          promptTokens: 100 * (i + 1),
          completionTokens: 200 * (i + 1)
        })
      }
    })

    it('should aggregate usage for date range', async () => {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 1)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 1)

      const aggregated = await service.aggregateUsage('user-123', startDate, endDate)

      expect(aggregated.operations).toBe(5)
      expect(aggregated.totalTokens).toBe(100 + 200 + 300 + 600 + 900 + 1500) // Sum of all tokens
      expect(aggregated.byModel.deepseek).toBeDefined()
    })

    it('should return empty aggregation for user with no usage', async () => {
      const startDate = new Date()
      const endDate = new Date()

      const aggregated = await service.aggregateUsage('user-999', startDate, endDate)

      expect(aggregated.operations).toBe(0)
      expect(aggregated.totalTokens).toBe(0)
    })
  })

  describe('getRecentUsage', () => {
    beforeEach(async () => {
      for (let i = 0; i < 10; i++) {
        await service.recordUsage('user-123', 'token-456', {
          modelId: 'model-123',
          provider: 'deepseek',
          promptTokens: 100,
          completionTokens: 200
        })
      }
    })

    it('should return recent usage logs', async () => {
      const logs = await service.getRecentUsage('user-123', 5)

      expect(logs.length).toBe(5)
      expect(logs[0].userId).toBe('user-123')
    })

    it('should sort logs by timestamp (most recent first)', async () => {
      const logs = await service.getRecentUsage('user-123', 10)

      for (let i = 1; i < logs.length; i++) {
        const prevTimestamp = new Date(logs[i - 1].timestamp)
        const currentTimestamp = new Date(logs[i].timestamp)
        expect(prevTimestamp >= currentTimestamp).toBe(true)
      }
    })

    it('should respect limit parameter', async () => {
      const logs = await service.getRecentUsage('user-123', 3)

      expect(logs.length).toBe(3)
    })
  })

  describe('cleanupOldLogs', () => {
    it('should remove logs older than retention period', async () => {
      // Create old log
      const oldLog = {
        id: 'usage_old',
        userId: 'user-123',
        tokenId: 'token-456',
        timestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days ago
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
        cost: { amount: 0.05, currency: 'USD' },
        metadata: {}
      }

      const logs = await service._readUsageLogs()
      logs.logs.push(oldLog)
      await service._writeUsageLogs(logs)

      const deletedCount = await service.cleanupOldLogs(90) // 90 days retention

      expect(deletedCount).toBeGreaterThan(0)

      const updatedLogs = await service._readUsageLogs()
      expect(updatedLogs.logs.find(log => log.id === 'usage_old')).toBeUndefined()
    })

    it('should keep recent logs', async () => {
      await service.recordUsage('user-123', 'token-456', {
        modelId: 'model-123',
        provider: 'deepseek',
        promptTokens: 100,
        completionTokens: 200
      })

      const beforeCount = (await service._readUsageLogs()).logs.length
      await service.cleanupOldLogs(30)
      const afterCount = (await service._readUsageLogs()).logs.length

      expect(afterCount).toBe(beforeCount)
    })
  })

  describe('Error handling', () => {
    it('should handle file read errors gracefully', async () => {
      // Delete files to simulate error
      await fs.rm(USAGE_LOGS_FILE, { force: true })

      // Should not throw
      const stats = await service.getUserUsageStats('user-123', 'day')
      expect(stats).toBeDefined()
    })

    it('should handle database errors in cost calculation', async () => {
      mockDb.query = vi.fn().mockRejectedValue(new Error('Database error'))

      // Should not throw, should use fallback pricing
      const cost = await service.calculateCost({
        promptTokens: 1000,
        completionTokens: 2000
      }, 'deepseek')

      expect(cost).toBeGreaterThan(0)
    })
  })
})
