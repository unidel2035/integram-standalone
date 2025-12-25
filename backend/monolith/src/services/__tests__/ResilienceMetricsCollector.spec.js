// ResilienceMetricsCollector.spec.js - Unit tests for ResilienceMetricsCollector
// Issue #5306 - Robust Error Recovery: Circuit Breaker & Self-Healing

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ResilienceMetricsCollector, MetricsWindow } from '../ResilienceMetricsCollector.js'
import { ErrorCategory } from '../ErrorClassifier.js'

describe('ResilienceMetricsCollector', () => {
  let collector

  beforeEach(() => {
    collector = new ResilienceMetricsCollector({
      retentionPeriod: 1000, // 1 second for fast tests
      aggregationInterval: 100 // 100ms
    })
  })

  afterEach(() => {
    collector.cleanup()
  })

  describe('recordSuccess()', () => {
    it('should record successful execution', () => {
      collector.recordSuccess('service1', 100)

      const metrics = collector.getServiceMetrics('service1')
      expect(metrics.serviceName).toBe('service1')
    })
  })

  describe('recordFailure()', () => {
    it('should record failure with error category', () => {
      collector.recordFailure('service1', ErrorCategory.TRANSIENT, false)

      const metrics = collector.getServiceMetrics('service1')
      expect(metrics.failuresByCategory[ErrorCategory.TRANSIENT]).toBe(1)
    })

    it('should emit threshold:exceeded event when error rate is high', (done) => {
      const testCollector = new ResilienceMetricsCollector({
        errorRateThreshold: 10 // 10%
      })

      testCollector.on('threshold:exceeded', (event) => {
        expect(event.metric).toBe('errorRate')
        expect(event.serviceName).toBe('test-service')
        testCollector.cleanup()
        done()
      })

      // Generate high error rate (90% failures)
      for (let i = 0; i < 9; i++) {
        testCollector.recordFailure('test-service', ErrorCategory.TRANSIENT)
      }
      testCollector.recordSuccess('test-service', 100)
    })
  })

  describe('recordRecovery()', () => {
    it('should record recovery with method and duration', () => {
      collector.recordRecovery('service1', 'retry', 500)

      const metrics = collector.getServiceMetrics('service1')
      expect(metrics.recoveriesByMethod['retry']).toBe(1)
    })
  })

  describe('calculateMTBF()', () => {
    it('should calculate mean time between failures', () => {
      const now = Date.now()

      // Record failures at specific intervals
      collector.failures = [
        { serviceName: 'service1', timestamp: now - 10000 },
        { serviceName: 'service1', timestamp: now - 5000 },
        { serviceName: 'service1', timestamp: now }
      ]

      const mtbf = collector.calculateMTBF('service1')

      // MTBF should be average interval: (5000 + 5000) / 2 = 5000ms
      expect(mtbf).toBe(5000)
    })

    it('should return null when insufficient failures', () => {
      collector.recordFailure('service1', ErrorCategory.TRANSIENT)

      const mtbf = collector.calculateMTBF('service1')

      expect(mtbf).toBeNull() // Need at least 2 failures
    })
  })

  describe('calculateMTTR()', () => {
    it('should calculate mean time to recovery', () => {
      collector.recordRecovery('service1', 'retry', 1000)
      collector.recordRecovery('service1', 'retry', 2000)
      collector.recordRecovery('service1', 'fallback', 3000)

      const mttr = collector.calculateMTTR('service1')

      // Average: (1000 + 2000 + 3000) / 3 = 2000ms
      expect(mttr).toBe(2000)
    })

    it('should return null when no recoveries', () => {
      const mttr = collector.calculateMTTR('service1')

      expect(mttr).toBeNull()
    })
  })

  describe('calculateAvailability()', () => {
    it('should calculate availability percentage', () => {
      collector.recordSuccess('service1', 100)
      collector.recordSuccess('service1', 100)
      collector.recordFailure('service1', ErrorCategory.TRANSIENT)

      const availability = collector.calculateAvailability('service1')

      // 2 successes out of 3 total = 66.67%
      expect(availability).toBeCloseTo(66.67, 1)
    })

    it('should return 100% when no events', () => {
      const availability = collector.calculateAvailability('service1')

      expect(availability).toBe(100)
    })
  })

  describe('calculateErrorRate()', () => {
    it('should calculate error rate as inverse of availability', () => {
      collector.recordSuccess('service1', 100)
      collector.recordFailure('service1', ErrorCategory.TRANSIENT)

      const errorRate = collector.calculateErrorRate('service1')

      // 1 failure out of 2 = 50% error rate
      expect(errorRate).toBe(50)
    })
  })

  describe('getServiceMetrics()', () => {
    it('should return comprehensive metrics for a service', () => {
      collector.recordSuccess('service1', 100)
      collector.recordFailure('service1', ErrorCategory.TRANSIENT, true)
      collector.recordRecovery('service1', 'retry', 500)

      const metrics = collector.getServiceMetrics('service1')

      expect(metrics.serviceName).toBe('service1')
      expect(metrics.totalFailures).toBe(1)
      expect(metrics.totalRecoveries).toBe(1)
      expect(metrics.failuresByCategory[ErrorCategory.TRANSIENT]).toBe(1)
      expect(metrics.recoveriesByMethod['retry']).toBe(1)
      expect(parseFloat(metrics.recoveryRate)).toBe(100)
    })
  })

  describe('getGlobalMetrics()', () => {
    it('should aggregate metrics across all services', () => {
      collector.recordSuccess('service1', 100)
      collector.recordSuccess('service2', 200)
      collector.recordFailure('service1', ErrorCategory.TRANSIENT)

      const metrics = collector.getGlobalMetrics()

      expect(metrics.totalExecutions).toBe(3)
      expect(metrics.successfulExecutions).toBe(2)
      expect(metrics.totalFailures).toBe(1)
      expect(metrics.uniqueServices).toBe(2)
      expect(parseFloat(metrics.availability)).toBeCloseTo(66.67, 1)
    })
  })

  describe('cleanup()', () => {
    it('should remove old data based on retention period', async () => {
      collector.recordSuccess('service1', 100)

      // Wait for retention period to expire
      await new Promise(resolve => setTimeout(resolve, 1100))

      collector._cleanup()

      expect(collector.events.length).toBe(0)
    })
  })
})
