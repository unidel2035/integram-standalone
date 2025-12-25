// CircuitBreaker.integration.spec.js - Integration tests for Circuit Breaker with MessageBus
// Issue #2707 - Phase 3.2: Circuit Breaker Pattern between agents

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MessageBus, MessageType } from '../MessageBus.js'
import { CircuitState } from '../CircuitBreaker.js'
import { EventEmitter } from 'events'

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  constructor() {
    super()
    this.readyState = 1 // OPEN
    this.sentMessages = []
  }

  send(data) {
    this.sentMessages.push(data)
    return true
  }

  close() {
    this.readyState = 3 // CLOSED
  }
}

describe('Circuit Breaker Integration with MessageBus', () => {
  let messageBus

  beforeEach(() => {
    messageBus = new MessageBus({
      maxMessages: 1000,
      messageRetryAttempts: 3,
      messageRetryDelay: 100,
      messageDefaultTTL: 60000,
      cleanupInterval: 10000,
      circuitBreakerConfig: {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000
      }
    })
  })

  afterEach(() => {
    messageBus.shutdown()
  })

  describe('Circuit Breaker Initialization', () => {
    it('should initialize CircuitBreakerManager with MessageBus', () => {
      expect(messageBus.circuitBreakerManager).toBeDefined()
    })

    it('should forward circuit breaker state changes', () => {
      const stateChangedHandler = vi.fn()
      messageBus.on('circuitBreaker:stateChanged', stateChangedHandler)

      // Manually open a circuit breaker
      const breaker = messageBus.circuitBreakerManager.getOrCreate('test-agent')
      breaker.open()

      expect(stateChangedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-agent',
          newState: CircuitState.OPEN
        })
      )
    })
  })

  describe('sendRequest with Circuit Breaker', () => {
    it('should successfully send request when circuit is closed', async () => {
      const ws = new MockWebSocket()
      messageBus.registerConnection('agent-2', ws)

      const requestPromise = messageBus.sendRequest(
        'agent-1',
        'agent-2',
        { action: 'process', data: 'test' }
      )

      // Simulate response
      setTimeout(() => {
        const sentMessage = JSON.parse(ws.sentMessages[0])
        messageBus._handleIncomingMessage('agent-2', JSON.stringify({
          messageType: MessageType.RESPONSE,
          metadata: {
            responseToMessageId: sentMessage.messageId
          },
          payload: { result: 'success' }
        }))
      }, 10)

      const response = await requestPromise

      expect(response).toEqual({ result: 'success' })

      // Circuit breaker should exist and be closed
      expect(messageBus.circuitBreakerManager.has('agent-2')).toBe(true)
      expect(messageBus.circuitBreakerManager.isClosed('agent-2')).toBe(true)
    })

    it('should open circuit breaker after repeated failures', async () => {
      // Don't register connection to simulate agent unavailability

      // Try to send 3 requests (failure threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await messageBus.sendRequest('agent-1', 'agent-offline', { data: 'test' })
          expect.fail('Should have thrown error')
        } catch (error) {
          expect(error.message).toContain('Failed to send request')
        }
      }

      // Circuit breaker should now be open
      expect(messageBus.circuitBreakerManager.isOpen('agent-offline')).toBe(true)
    })

    it('should reject requests immediately when circuit is open', async () => {
      // Open the circuit by failing 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await messageBus.sendRequest('agent-1', 'agent-offline', { data: 'test' })
        } catch (error) {
          // Expected
        }
      }

      // Circuit is now open - next request should fail immediately
      const startTime = Date.now()

      try {
        await messageBus.sendRequest('agent-1', 'agent-offline', { data: 'test' })
        expect.fail('Should have thrown error')
      } catch (error) {
        const elapsed = Date.now() - startTime

        expect(error.message).toContain('Circuit breaker is OPEN')
        expect(error.circuitBreakerOpen).toBe(true)
        expect(elapsed).toBeLessThan(100) // Should fail immediately
      }
    })

    it('should transition to half-open after timeout and close on success', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await messageBus.sendRequest('agent-1', 'agent-2', { data: 'test' })
        } catch (error) {
          // Expected to fail
        }
      }

      expect(messageBus.circuitBreakerManager.isOpen('agent-2')).toBe(true)

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100))

      // Register connection and send successful request
      const ws = new MockWebSocket()
      messageBus.registerConnection('agent-2', ws)

      const requestPromise = messageBus.sendRequest(
        'agent-1',
        'agent-2',
        { action: 'process', data: 'test' }
      )

      // Simulate response
      setTimeout(() => {
        const sentMessage = JSON.parse(ws.sentMessages[0])
        messageBus._handleIncomingMessage('agent-2', JSON.stringify({
          messageType: MessageType.RESPONSE,
          metadata: {
            responseToMessageId: sentMessage.messageId
          },
          payload: { result: 'success' }
        }))
      }, 10)

      await requestPromise

      // After 2 successes (successThreshold), circuit should be closed
      const requestPromise2 = messageBus.sendRequest(
        'agent-1',
        'agent-2',
        { action: 'process', data: 'test2' }
      )

      setTimeout(() => {
        const sentMessage = JSON.parse(ws.sentMessages[1])
        messageBus._handleIncomingMessage('agent-2', JSON.stringify({
          messageType: MessageType.RESPONSE,
          metadata: {
            responseToMessageId: sentMessage.messageId
          },
          payload: { result: 'success' }
        }))
      }, 10)

      await requestPromise2

      expect(messageBus.circuitBreakerManager.isClosed('agent-2')).toBe(true)
    })
  })

  describe('Circuit Breaker State Management', () => {
    it('should track circuit breaker states for multiple agents', async () => {
      const ws1 = new MockWebSocket()
      const ws2 = new MockWebSocket()

      messageBus.registerConnection('agent-1', ws1)
      messageBus.registerConnection('agent-2', ws2)

      // Send requests to multiple agents
      const promise1 = messageBus.sendRequest('sender', 'agent-1', { data: 'test1' })
      const promise2 = messageBus.sendRequest('sender', 'agent-2', { data: 'test2' })

      // Simulate responses
      setTimeout(() => {
        const msg1 = JSON.parse(ws1.sentMessages[0])
        messageBus._handleIncomingMessage('agent-1', JSON.stringify({
          messageType: MessageType.RESPONSE,
          metadata: { responseToMessageId: msg1.messageId },
          payload: { result: 'success' }
        }))

        const msg2 = JSON.parse(ws2.sentMessages[0])
        messageBus._handleIncomingMessage('agent-2', JSON.stringify({
          messageType: MessageType.RESPONSE,
          metadata: { responseToMessageId: msg2.messageId },
          payload: { result: 'success' }
        }))
      }, 10)

      await Promise.all([promise1, promise2])

      // Both circuit breakers should exist
      const states = messageBus.getCircuitBreakerStates()
      expect(states['agent-1']).toBeDefined()
      expect(states['agent-2']).toBeDefined()
      expect(states['agent-1'].state).toBe(CircuitState.CLOSED)
      expect(states['agent-2'].state).toBe(CircuitState.CLOSED)
    })

    it('should get circuit breaker statistics through MessageBus', async () => {
      const ws = new MockWebSocket()
      messageBus.registerConnection('agent-1', ws)

      const promise = messageBus.sendRequest('sender', 'agent-1', { data: 'test' })

      setTimeout(() => {
        const msg = JSON.parse(ws.sentMessages[0])
        messageBus._handleIncomingMessage('agent-1', JSON.stringify({
          messageType: MessageType.RESPONSE,
          metadata: { responseToMessageId: msg.messageId },
          payload: { result: 'success' }
        }))
      }, 10)

      await promise

      const stats = messageBus.getStats()

      expect(stats.circuitBreakers).toBeDefined()
      expect(stats.circuitBreakers.totalBreakers).toBe(1)
      expect(stats.circuitBreakers.byState[CircuitState.CLOSED]).toBe(1)
    })

    it('should reset circuit breaker through MessageBus', async () => {
      // Open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await messageBus.sendRequest('agent-1', 'agent-offline', { data: 'test' })
        } catch (error) {
          // Expected
        }
      }

      expect(messageBus.circuitBreakerManager.isOpen('agent-offline')).toBe(true)

      // Reset circuit breaker
      const result = messageBus.resetCircuitBreaker('agent-offline')

      expect(result).toBe(true)
      expect(messageBus.circuitBreakerManager.isClosed('agent-offline')).toBe(true)
    })

    it('should reset all circuit breakers through MessageBus', async () => {
      // Open multiple circuits
      for (let i = 0; i < 3; i++) {
        try {
          await messageBus.sendRequest('sender', 'agent-1', { data: 'test' })
        } catch (error) {
          // Expected
        }
      }

      for (let i = 0; i < 3; i++) {
        try {
          await messageBus.sendRequest('sender', 'agent-2', { data: 'test' })
        } catch (error) {
          // Expected
        }
      }

      expect(messageBus.circuitBreakerManager.isOpen('agent-1')).toBe(true)
      expect(messageBus.circuitBreakerManager.isOpen('agent-2')).toBe(true)

      // Reset all
      const count = messageBus.resetAllCircuitBreakers()

      expect(count).toBe(2)
      expect(messageBus.circuitBreakerManager.isClosed('agent-1')).toBe(true)
      expect(messageBus.circuitBreakerManager.isClosed('agent-2')).toBe(true)
    })
  })

  describe('Cascade Failure Prevention', () => {
    it('should prevent cascade failures by opening circuits', async () => {
      // Simulate cascade: agent-1 -> agent-2 -> agent-3
      // If agent-3 fails, circuit breaker should prevent repeated failures

      // agent-3 is offline
      for (let i = 0; i < 3; i++) {
        try {
          await messageBus.sendRequest('agent-2', 'agent-3', { data: 'test' })
        } catch (error) {
          // Expected
        }
      }

      // Circuit to agent-3 is now open
      expect(messageBus.circuitBreakerManager.isOpen('agent-3')).toBe(true)

      // Further requests should fail immediately (not timeout)
      const startTime = Date.now()

      try {
        await messageBus.sendRequest('agent-2', 'agent-3', { data: 'test' })
      } catch (error) {
        const elapsed = Date.now() - startTime
        expect(elapsed).toBeLessThan(100) // Failed immediately, not after timeout
      }

      // This prevents agent-2 from waiting on agent-3
      // Cascade is prevented
    })

    it('should isolate failures to specific agents', async () => {
      const ws1 = new MockWebSocket()
      messageBus.registerConnection('agent-1', ws1)

      // agent-2 fails
      for (let i = 0; i < 3; i++) {
        try {
          await messageBus.sendRequest('sender', 'agent-2', { data: 'test' })
        } catch (error) {
          // Expected
        }
      }

      // Circuit to agent-2 is open
      expect(messageBus.circuitBreakerManager.isOpen('agent-2')).toBe(true)

      // But agent-1 should still work
      const promise = messageBus.sendRequest('sender', 'agent-1', { data: 'test' })

      setTimeout(() => {
        const msg = JSON.parse(ws1.sentMessages[0])
        messageBus._handleIncomingMessage('agent-1', JSON.stringify({
          messageType: MessageType.RESPONSE,
          metadata: { responseToMessageId: msg.messageId },
          payload: { result: 'success' }
        }))
      }, 10)

      const result = await promise

      expect(result).toEqual({ result: 'success' })
      expect(messageBus.circuitBreakerManager.isClosed('agent-1')).toBe(true)
    })
  })

  describe('Custom Circuit Breaker Configuration', () => {
    it('should accept custom circuit breaker config per request', async () => {
      // Send request with custom failure threshold
      try {
        await messageBus.sendRequest(
          'agent-1',
          'agent-custom',
          { data: 'test' },
          {
            circuitBreakerConfig: {
              failureThreshold: 5
            }
          }
        )
      } catch (error) {
        // Expected
      }

      const breaker = messageBus.circuitBreakerManager.get('agent-custom')
      expect(breaker).toBeDefined()
      expect(breaker.failureThreshold).toBe(5)
    })
  })

  describe('MessageBus Shutdown', () => {
    it('should cleanup circuit breakers on shutdown', () => {
      // Create some circuit breakers
      messageBus.circuitBreakerManager.getOrCreate('agent-1')
      messageBus.circuitBreakerManager.getOrCreate('agent-2')

      expect(messageBus.circuitBreakerManager.breakers.size).toBe(2)

      // Shutdown should not throw
      expect(() => messageBus.shutdown()).not.toThrow()
    })
  })
})
