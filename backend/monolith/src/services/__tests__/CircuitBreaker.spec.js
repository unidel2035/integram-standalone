// CircuitBreaker.spec.js - Unit tests for CircuitBreaker
// Issue #2707 - Phase 3.2: Circuit Breaker Pattern between agents

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CircuitBreaker, CircuitState } from '../CircuitBreaker.js'

describe('CircuitBreaker', () => {
  let breaker

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test-agent',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000 // 1 second for faster tests
    })
  })

  describe('Initial State', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.state).toBe(CircuitState.CLOSED)
    })

    it('should have zero failure count initially', () => {
      expect(breaker.failureCount).toBe(0)
    })

    it('should have zero success count initially', () => {
      expect(breaker.successCount).toBe(0)
    })

    it('should have correct configuration', () => {
      expect(breaker.name).toBe('test-agent')
      expect(breaker.failureThreshold).toBe(3)
      expect(breaker.successThreshold).toBe(2)
      expect(breaker.timeout).toBe(1000)
    })
  })

  describe('CLOSED -> OPEN Transition', () => {
    it('should open circuit after failure threshold is reached', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Service unavailable'))

      // Execute 3 times (failure threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch (error) {
          // Expected to fail
        }
      }

      expect(breaker.state).toBe(CircuitState.OPEN)
      expect(breaker.failureCount).toBe(3)
    })

    it('should emit state:changed event when opening', async () => {
      const stateChangedHandler = vi.fn()
      breaker.on('state:changed', stateChangedHandler)

      const failingFn = vi.fn().mockRejectedValue(new Error('Service unavailable'))

      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch (error) {
          // Expected to fail
        }
      }

      expect(stateChangedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-agent',
          oldState: CircuitState.CLOSED,
          newState: CircuitState.OPEN
        })
      )
    })

    it('should not open circuit if failures are below threshold', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Service unavailable'))

      // Execute 2 times (below threshold of 3)
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failingFn)
        } catch (error) {
          // Expected to fail
        }
      }

      expect(breaker.state).toBe(CircuitState.CLOSED)
      expect(breaker.failureCount).toBe(2)
    })
  })

  describe('OPEN State Behavior', () => {
    beforeEach(async () => {
      // Open the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('Service unavailable'))
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch (error) {
          // Expected to fail
        }
      }
    })

    it('should reject requests immediately when OPEN', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is OPEN')
      expect(fn).not.toHaveBeenCalled() // Function should not be executed
    })

    it('should include circuitBreakerOpen flag in error', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      try {
        await breaker.execute(fn)
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error.circuitBreakerOpen).toBe(true)
        expect(error.nextAttempt).toBeDefined()
      }
    })

    it('should track rejected requests in stats', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const initialRejected = breaker.stats.rejectedRequests

      try {
        await breaker.execute(fn)
      } catch (error) {
        // Expected
      }

      expect(breaker.stats.rejectedRequests).toBe(initialRejected + 1)
    })
  })

  describe('OPEN -> HALF_OPEN Transition', () => {
    it('should transition to HALF_OPEN after timeout', async () => {
      // Open the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('Service unavailable'))
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch (error) {
          // Expected to fail
        }
      }

      expect(breaker.state).toBe(CircuitState.OPEN)

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100))

      // Try to execute - should transition to HALF_OPEN, then potentially CLOSED
      const successFn = vi.fn().mockResolvedValue('success')
      await breaker.execute(successFn)

      // After one success in HALF_OPEN, should still be HALF_OPEN (needs 2 successes)
      expect(breaker.state).toBe(CircuitState.HALF_OPEN)
      expect(successFn).toHaveBeenCalled()

      // Second success should close the circuit
      await breaker.execute(successFn)
      expect(breaker.state).toBe(CircuitState.CLOSED)
    })

    it('should emit state:changed event when transitioning to HALF_OPEN', async () => {
      const stateChangedHandler = vi.fn()

      // Open the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('Service unavailable'))
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch (error) {
          // Expected to fail
        }
      }

      // Add listener after circuit is open
      breaker.on('state:changed', stateChangedHandler)

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100))

      // Try to execute
      const successFn = vi.fn().mockResolvedValue('success')
      await breaker.execute(successFn)

      // Should have seen OPEN -> HALF_OPEN -> CLOSED
      expect(stateChangedHandler).toHaveBeenCalled()
    })
  })

  describe('HALF_OPEN -> CLOSED Transition', () => {
    beforeEach(async () => {
      // Open the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('Service unavailable'))
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for timeout to transition to HALF_OPEN
      await new Promise(resolve => setTimeout(resolve, 1100))
    })

    it('should close circuit after success threshold is reached', async () => {
      const successFn = vi.fn().mockResolvedValue('success')

      // Execute successfully 2 times (success threshold)
      await breaker.execute(successFn)

      // After first success, should still be in HALF_OPEN
      // (need 2 successes to close)

      await breaker.execute(successFn)

      // After second success, should be CLOSED
      expect(breaker.state).toBe(CircuitState.CLOSED)
      expect(breaker.successCount).toBe(0) // Reset after closing
    })

    it('should emit state:changed event when closing', async () => {
      const stateChangedHandler = vi.fn()
      breaker.on('state:changed', stateChangedHandler)

      const successFn = vi.fn().mockResolvedValue('success')

      // Execute successfully 2 times
      await breaker.execute(successFn)
      await breaker.execute(successFn)

      expect(stateChangedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-agent',
          newState: CircuitState.CLOSED
        })
      )
    })
  })

  describe('HALF_OPEN -> OPEN Transition', () => {
    beforeEach(async () => {
      // Open the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('Service unavailable'))
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for timeout to transition to HALF_OPEN
      await new Promise(resolve => setTimeout(resolve, 1100))
    })

    it('should reopen circuit if failure occurs in HALF_OPEN', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Still failing'))

      try {
        await breaker.execute(failingFn)
      } catch (error) {
        // Expected to fail
      }

      expect(breaker.state).toBe(CircuitState.OPEN)
      // Failure count is from previous failures + this one
      expect(breaker.failureCount).toBeGreaterThanOrEqual(1)
    })

    it('should reset success count on failure in HALF_OPEN', async () => {
      const successFn = vi.fn().mockResolvedValue('success')
      const failingFn = vi.fn().mockRejectedValue(new Error('Failure'))

      // One success
      await breaker.execute(successFn)
      expect(breaker.successCount).toBe(1)

      // Then failure
      try {
        await breaker.execute(failingFn)
      } catch (error) {
        // Expected to fail
      }

      expect(breaker.successCount).toBe(0)
    })
  })

  describe('Manual Operations', () => {
    it('should allow manual reset to CLOSED', async () => {
      // Open the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('Service unavailable'))
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch (error) {
          // Expected to fail
        }
      }

      expect(breaker.state).toBe(CircuitState.OPEN)

      // Manual reset
      breaker.reset()

      expect(breaker.state).toBe(CircuitState.CLOSED)
      expect(breaker.failureCount).toBe(0)
      expect(breaker.successCount).toBe(0)
    })

    it('should allow manual open', () => {
      expect(breaker.state).toBe(CircuitState.CLOSED)

      breaker.open()

      expect(breaker.state).toBe(CircuitState.OPEN)
    })

    it('should emit state:changed event on manual reset from non-CLOSED state', async () => {
      // Open the circuit first
      const failingFn = vi.fn().mockRejectedValue(new Error('Failure'))
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.state).toBe(CircuitState.OPEN)

      const stateChangedHandler = vi.fn()
      breaker.on('state:changed', stateChangedHandler)

      breaker.reset()

      expect(stateChangedHandler).toHaveBeenCalled()
    })
  })

  describe('Statistics', () => {
    it('should track total requests', async () => {
      const successFn = vi.fn().mockResolvedValue('success')

      await breaker.execute(successFn)
      await breaker.execute(successFn)

      expect(breaker.stats.totalRequests).toBe(2)
    })

    it('should track successful requests', async () => {
      const successFn = vi.fn().mockResolvedValue('success')

      await breaker.execute(successFn)
      await breaker.execute(successFn)

      expect(breaker.stats.successfulRequests).toBe(2)
    })

    it('should track failed requests', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Failure'))

      try {
        await breaker.execute(failingFn)
      } catch (error) {
        // Expected
      }

      try {
        await breaker.execute(failingFn)
      } catch (error) {
        // Expected
      }

      expect(breaker.stats.failedRequests).toBe(2)
    })

    it('should track last failure time', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Failure'))

      const beforeTime = new Date()

      try {
        await breaker.execute(failingFn)
      } catch (error) {
        // Expected
      }

      const afterTime = new Date()

      expect(breaker.stats.lastFailureTime).toBeDefined()
      expect(breaker.stats.lastFailureTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
      expect(breaker.stats.lastFailureTime.getTime()).toBeLessThanOrEqual(afterTime.getTime())
    })

    it('should track last success time', async () => {
      const successFn = vi.fn().mockResolvedValue('success')

      const beforeTime = new Date()
      await breaker.execute(successFn)
      const afterTime = new Date()

      expect(breaker.stats.lastSuccessTime).toBeDefined()
      expect(breaker.stats.lastSuccessTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
      expect(breaker.stats.lastSuccessTime.getTime()).toBeLessThanOrEqual(afterTime.getTime())
    })
  })

  describe('getState()', () => {
    it('should return complete state information', () => {
      const state = breaker.getState()

      expect(state).toHaveProperty('name', 'test-agent')
      expect(state).toHaveProperty('state', CircuitState.CLOSED)
      expect(state).toHaveProperty('failureCount', 0)
      expect(state).toHaveProperty('successCount', 0)
      expect(state).toHaveProperty('nextAttempt')
      expect(state).toHaveProperty('isOpen', false)
      expect(state).toHaveProperty('canAttempt', true)
      expect(state).toHaveProperty('config')
      expect(state).toHaveProperty('stats')
    })

    it('should indicate when circuit is open', async () => {
      // Open the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('Service unavailable'))
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn)
        } catch (error) {
          // Expected to fail
        }
      }

      const state = breaker.getState()

      expect(state.isOpen).toBe(true)
      expect(state.canAttempt).toBe(false)
    })
  })

  describe('Event Emissions', () => {
    it('should emit success event on successful execution', async () => {
      const successHandler = vi.fn()
      breaker.on('success', successHandler)

      const successFn = vi.fn().mockResolvedValue('success')
      await breaker.execute(successFn)

      expect(successHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-agent',
          state: CircuitState.CLOSED
        })
      )
    })

    it('should emit failure event on failed execution', async () => {
      const failureHandler = vi.fn()
      breaker.on('failure', failureHandler)

      const failingFn = vi.fn().mockRejectedValue(new Error('Failure'))

      try {
        await breaker.execute(failingFn)
      } catch (error) {
        // Expected
      }

      expect(failureHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-agent',
          state: CircuitState.CLOSED,
          failureCount: 1
        })
      )
    })
  })
})
