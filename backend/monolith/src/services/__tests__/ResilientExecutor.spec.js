// ResilientExecutor.spec.js - Unit tests for ResilientExecutor
// Issue #5306 - Robust Error Recovery: Circuit Breaker & Self-Healing

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ResilientExecutor, ExecutionStatus } from '../ResilientExecutor.js'
import { ErrorCategory } from '../ErrorClassifier.js'

describe('ResilientExecutor', () => {
  let executor

  beforeEach(() => {
    executor = new ResilientExecutor({
      maxRetries: 3,
      enableCircuitBreaker: false // Disable for unit tests
    })
  })

  describe('execute() - success cases', () => {
    it('should execute operation successfully on first try', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      const result = await executor.execute({
        serviceName: 'test-service',
        operation
      })

      expect(result.status).toBe(ExecutionStatus.SUCCESS)
      expect(result.result).toBe('success')
      expect(result.usedFallback).toBe(false)
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry transient errors and succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' }))
        .mockResolvedValueOnce('success')

      const result = await executor.execute({
        serviceName: 'test-service',
        operation,
        maxRetries: 3
      })

      expect(result.status).toBe(ExecutionStatus.SUCCESS)
      expect(result.result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })
  })

  describe('execute() - fallback cases', () => {
    it('should use fallback when primary fails', async () => {
      const primaryOperation = vi.fn().mockRejectedValue(
        Object.assign(new Error('Service unavailable'), { statusCode: 503 })
      )
      const fallbackOperation = vi.fn().mockResolvedValue('fallback-result')

      const result = await executor.execute({
        serviceName: 'test-service',
        operation: primaryOperation,
        fallbacks: [fallbackOperation],
        maxRetries: 1
      })

      expect(result.status).toBe(ExecutionStatus.FAILED_WITH_FALLBACK)
      expect(result.result).toBe('fallback-result')
      expect(result.usedFallback).toBe(true)
      expect(result.fallbackIndex).toBe(1)
      expect(fallbackOperation).toHaveBeenCalledTimes(1)
    })

    it('should try multiple fallbacks in order', async () => {
      const primaryOperation = vi.fn().mockRejectedValue(new Error('Primary failed'))
      const fallback1 = vi.fn().mockRejectedValue(new Error('Fallback 1 failed'))
      const fallback2 = vi.fn().mockResolvedValue('fallback-2-success')

      const result = await executor.execute({
        serviceName: 'test-service',
        operation: primaryOperation,
        fallbacks: [fallback1, fallback2],
        maxRetries: 0
      })

      expect(result.status).toBe(ExecutionStatus.FAILED_WITH_FALLBACK)
      expect(result.result).toBe('fallback-2-success')
      expect(result.fallbackIndex).toBe(2)
      expect(primaryOperation).toHaveBeenCalledTimes(1)
      expect(fallback1).toHaveBeenCalledTimes(1)
      expect(fallback2).toHaveBeenCalledTimes(1)
    })
  })

  describe('execute() - failure cases', () => {
    it('should throw when all retries and fallbacks fail', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'))
      const fallback = vi.fn().mockRejectedValue(new Error('Fallback also fails'))

      await expect(
        executor.execute({
          serviceName: 'test-service',
          operation,
          fallbacks: [fallback],
          maxRetries: 2
        })
      ).rejects.toThrow('Execution failed for test-service')

      const stats = executor.getStats()
      expect(stats.failedExecutions).toBe(1)
    })

    it('should not retry permanent errors', async () => {
      const operation = vi.fn().mockRejectedValue(
        Object.assign(new Error('Not found'), { statusCode: 404 })
      )

      await expect(
        executor.execute({
          serviceName: 'test-service',
          operation,
          maxRetries: 3
        })
      ).rejects.toThrow()

      // Should not retry permanent errors
      expect(operation).toHaveBeenCalledTimes(1)
    })
  })

  describe('getStats()', () => {
    it('should track execution statistics', async () => {
      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('Fail'))

      await executor.execute({ serviceName: 'service1', operation: successOp })

      try {
        await executor.execute({ serviceName: 'service2', operation: failOp, maxRetries: 0 })
      } catch (e) {
        // Expected
      }

      const stats = executor.getStats()

      expect(stats.totalExecutions).toBe(2)
      expect(stats.successfulExecutions).toBe(1)
      expect(stats.failedExecutions).toBe(1)
      expect(parseFloat(stats.successRate)).toBe(50.0)
    })

    it('should track error categories', async () => {
      const networkError = Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' })
      const rateLimitError = Object.assign(new Error('Too many requests'), { statusCode: 429 })

      const op1 = vi.fn().mockRejectedValue(networkError)
      const op2 = vi.fn().mockRejectedValue(rateLimitError)

      try {
        await executor.execute({ serviceName: 's1', operation: op1, maxRetries: 0 })
      } catch (e) { /* ignore */ }

      try {
        await executor.execute({ serviceName: 's2', operation: op2, maxRetries: 0 })
      } catch (e) { /* ignore */ }

      const stats = executor.getStats()
      expect(stats.byErrorCategory[ErrorCategory.TRANSIENT]).toBeGreaterThan(0)
      expect(stats.byErrorCategory[ErrorCategory.RATE_LIMIT]).toBeGreaterThan(0)
    })
  })

  describe('resetStats()', () => {
    it('should clear statistics', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      await executor.execute({ serviceName: 'test', operation })

      executor.resetStats()

      const stats = executor.getStats()
      expect(stats.totalExecutions).toBe(0)
      expect(stats.successfulExecutions).toBe(0)
    })
  })
})
