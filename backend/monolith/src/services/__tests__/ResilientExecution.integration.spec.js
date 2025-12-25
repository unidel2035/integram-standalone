// ResilientExecution.integration.spec.js - Integration test for complete resilient execution system
// Issue #5306 - Robust Error Recovery: Circuit Breaker & Self-Healing

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ResilientExecutor } from '../ResilientExecutor.js'
import { CircuitBreakerManager } from '../CircuitBreakerManager.js'
import { ErrorClassifier, ErrorCategory } from '../ErrorClassifier.js'
import { ResilienceMetricsCollector } from '../ResilienceMetricsCollector.js'

describe('Resilient Execution System Integration', () => {
  let circuitBreakerManager
  let errorClassifier
  let metricsCollector
  let executor

  beforeEach(() => {
    circuitBreakerManager = new CircuitBreakerManager({
      defaultConfig: {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 100
      }
    })

    errorClassifier = new ErrorClassifier()
    metricsCollector = new ResilienceMetricsCollector()

    executor = new ResilientExecutor({
      circuitBreakerManager,
      errorClassifier,
      maxRetries: 3,
      enableCircuitBreaker: true
    })
  })

  afterEach(() => {
    circuitBreakerManager.cleanup()
    metricsCollector.cleanup()
    executor.cleanup()
  })

  it('should execute successfully with circuit breaker protection', async () => {
    const operation = vi.fn().mockResolvedValue('success')

    const result = await executor.execute({
      serviceName: 'integration-test-service',
      operation
    })

    expect(result.result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(1)

    // Verify circuit breaker is still closed
    const cbState = circuitBreakerManager.get('integration-test-service')
    expect(cbState.state).toBe('CLOSED')
  })

  it('should retry transient errors with exponential backoff', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' }))
      .mockRejectedValueOnce(Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' }))
      .mockResolvedValueOnce('success')

    const startTime = Date.now()
    const result = await executor.execute({
      serviceName: 'retry-test-service',
      operation,
      maxRetries: 3
    })
    const duration = Date.now() - startTime

    expect(result.result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(3)
    // Should have delays due to backoff
    expect(duration).toBeGreaterThan(1000) // At least 1 second of backoff
  })

  it('should use fallback when primary service fails', async () => {
    const primaryOperation = vi.fn().mockRejectedValue(
      Object.assign(new Error('Service down'), { statusCode: 503 })
    )
    const fallbackOperation = vi.fn().mockResolvedValue('fallback-result')

    metricsCollector.recordFailure('primary-service', ErrorCategory.TRANSIENT)

    const result = await executor.execute({
      serviceName: 'primary-service',
      operation: primaryOperation,
      fallbacks: [fallbackOperation],
      maxRetries: 1
    })

    expect(result.result).toBe('fallback-result')
    expect(result.usedFallback).toBe(true)

    const metrics = executor.getStats()
    expect(metrics.fallbackExecutions).toBe(1)
  })

  it('should open circuit breaker after threshold failures', async () => {
    const operation = vi.fn().mockRejectedValue(
      Object.assign(new Error('Service error'), { statusCode: 500 })
    )

    // Cause failures to trigger circuit breaker
    for (let i = 0; i < 5; i++) {
      try {
        await executor.execute({
          serviceName: 'failing-service',
          operation,
          maxRetries: 0
        })
      } catch (e) {
        // Expected failures
      }
    }

    // Circuit should now be OPEN
    const cbState = circuitBreakerManager.get('failing-service')
    expect(cbState.state).toBe('OPEN')

    // Next request should be rejected immediately
    try {
      await executor.execute({
        serviceName: 'failing-service',
        operation,
        maxRetries: 0
      })
      expect.fail('Should have thrown circuit breaker open error')
    } catch (error) {
      expect(error.circuitBreakerOpen).toBe(true)
    }

    const stats = executor.getStats()
    expect(stats.circuitBreakerRejections).toBeGreaterThan(0)
  })

  it('should collect comprehensive metrics during execution', async () => {
    const successOp = vi.fn().mockResolvedValue('success')
    const failOp = vi.fn().mockRejectedValue(
      Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' })
    )

    // Record various events
    metricsCollector.recordSuccess('metrics-service', 100)
    metricsCollector.recordFailure('metrics-service', ErrorCategory.TRANSIENT, true)
    metricsCollector.recordRecovery('metrics-service', 'retry', 500)

    const metrics = metricsCollector.getServiceMetrics('metrics-service')

    expect(metrics.totalFailures).toBe(1)
    expect(metrics.totalRecoveries).toBe(1)
    expect(parseFloat(metrics.recoveryRate)).toBe(100)
    expect(metrics.failuresByCategory[ErrorCategory.TRANSIENT]).toBe(1)
    expect(metrics.recoveriesByMethod['retry']).toBe(1)
  })

  it('should handle complex scenario with retries, fallbacks, and metrics', async () => {
    const primaryOp = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' }))
      .mockRejectedValueOnce(Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' }))
      .mockRejectedValue(Object.assign(new Error('Still failing'), { statusCode: 503 }))

    const fallbackOp = vi.fn().mockResolvedValue('fallback-success')

    const result = await executor.execute({
      serviceName: 'complex-service',
      operation: primaryOp,
      fallbacks: [fallbackOp],
      maxRetries: 2
    })

    expect(result.usedFallback).toBe(true)
    expect(result.result).toBe('fallback-success')

    const stats = executor.getStats()
    expect(stats.retriedExecutions).toBeGreaterThan(0)
    expect(stats.fallbackExecutions).toBe(1)
    expect(stats.successfulExecutions).toBe(1)
  })
})
