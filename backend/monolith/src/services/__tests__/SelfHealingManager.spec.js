// SelfHealingManager.spec.js - Unit tests for SelfHealingManager
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SelfHealingManager } from '../SelfHealingManager.js'
import EventEmitter from 'events'

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock metrics
vi.mock('../../utils/metrics.js', () => ({
  default: {
    increment: vi.fn(),
    decrement: vi.fn(),
  },
}))

describe('SelfHealingManager', () => {
  let selfHealingManager
  let mockOrchestrator
  let mockDiscoveryService
  let mockNotificationHub

  beforeEach(() => {
    // Create mocks
    mockOrchestrator = new EventEmitter()
    mockOrchestrator.manifests = new Map()
    mockOrchestrator.startAgent = vi.fn().mockResolvedValue(true)
    mockOrchestrator.stopAgent = vi.fn().mockResolvedValue(true)

    mockDiscoveryService = {
      discover: vi.fn().mockReturnValue([]),
    }

    mockNotificationHub = {
      sendCriticalAlert: vi.fn().mockResolvedValue(true),
    }

    // Create SelfHealingManager instance
    selfHealingManager = new SelfHealingManager({
      orchestrator: mockOrchestrator,
      discoveryService: mockDiscoveryService,
      notificationHub: mockNotificationHub,
      maxRestartAttempts: 5,
      baseRestartDelay: 100, // Use short delays for tests
    })
  })

  afterEach(() => {
    selfHealingManager.shutdown()
    vi.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const manager = new SelfHealingManager({})
      expect(manager.maxRestartAttempts).toBe(5)
      expect(manager.baseRestartDelay).toBe(5000)
      manager.shutdown()
    })

    it('should initialize with custom options', () => {
      const manager = new SelfHealingManager({
        maxRestartAttempts: 3,
        baseRestartDelay: 10000,
      })
      expect(manager.maxRestartAttempts).toBe(3)
      expect(manager.baseRestartDelay).toBe(10000)
      manager.shutdown()
    })

    it('should initialize empty data structures', () => {
      expect(selfHealingManager.restartHistory.size).toBe(0)
      expect(selfHealingManager.restartTimers.size).toBe(0)
    })
  })

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff correctly', () => {
      // Base delay: 100ms
      expect(selfHealingManager.calculateBackoff(0, 100)).toBe(100) // 100 * 2^0 = 100
      expect(selfHealingManager.calculateBackoff(1, 100)).toBe(200) // 100 * 2^1 = 200
      expect(selfHealingManager.calculateBackoff(2, 100)).toBe(400) // 100 * 2^2 = 400
      expect(selfHealingManager.calculateBackoff(3, 100)).toBe(800) // 100 * 2^3 = 800
      expect(selfHealingManager.calculateBackoff(4, 100)).toBe(1600) // 100 * 2^4 = 1600
    })

    it('should use instance base delay if not provided', () => {
      selfHealingManager.baseRestartDelay = 5000
      expect(selfHealingManager.calculateBackoff(0)).toBe(5000)
      expect(selfHealingManager.calculateBackoff(1)).toBe(10000)
      expect(selfHealingManager.calculateBackoff(2)).toBe(20000)
    })
  })

  describe('recordRestartAttempt and getRestartAttempts', () => {
    it('should record restart attempts', () => {
      selfHealingManager.recordRestartAttempt('agent-1')
      expect(selfHealingManager.getRestartAttempts('agent-1')).toBe(1)

      selfHealingManager.recordRestartAttempt('agent-1')
      expect(selfHealingManager.getRestartAttempts('agent-1')).toBe(2)
    })

    it('should only count attempts within 5-minute window', () => {
      const now = Date.now()

      // Mock Date.now()
      vi.spyOn(Date, 'now').mockReturnValue(now)

      selfHealingManager.recordRestartAttempt('agent-1')

      // Simulate 6 minutes later
      vi.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 1000)

      // Old attempt should not count
      expect(selfHealingManager.getRestartAttempts('agent-1')).toBe(0)

      vi.restoreAllMocks()
    })

    it('should return 0 for agent with no history', () => {
      expect(selfHealingManager.getRestartAttempts('unknown-agent')).toBe(0)
    })
  })

  describe('clearRestartHistory', () => {
    it('should clear restart history for agent', () => {
      selfHealingManager.recordRestartAttempt('agent-1')
      selfHealingManager.recordRestartAttempt('agent-1')
      expect(selfHealingManager.getRestartAttempts('agent-1')).toBe(2)

      selfHealingManager.clearRestartHistory('agent-1')
      expect(selfHealingManager.getRestartAttempts('agent-1')).toBe(0)
    })
  })

  describe('getRestartHistory', () => {
    it('should return restart timestamps', () => {
      selfHealingManager.recordRestartAttempt('agent-1')
      selfHealingManager.recordRestartAttempt('agent-1')

      const history = selfHealingManager.getRestartHistory('agent-1')
      expect(history).toBeInstanceOf(Array)
      expect(history.length).toBe(2)
      expect(typeof history[0]).toBe('number')
    })

    it('should return empty array for agent with no history', () => {
      const history = selfHealingManager.getRestartHistory('unknown-agent')
      expect(history).toEqual([])
    })
  })

  describe('handleAgentFailure', () => {
    it('should handle agent failure when self-healing enabled', async () => {
      const agentId = 'test-agent'
      const error = new Error('Test error')

      // Setup manifest
      mockOrchestrator.manifests.set(agentId, {
        name: 'Test Agent',
        selfHealing: { enabled: true },
      })

      await selfHealingManager.handleAgentFailure(agentId, error)

      // Should schedule restart
      expect(selfHealingManager.restartTimers.has(agentId)).toBe(true)
    })

    it('should not restart if self-healing disabled', async () => {
      const agentId = 'test-agent'
      const error = new Error('Test error')

      // Setup manifest with self-healing disabled
      mockOrchestrator.manifests.set(agentId, {
        name: 'Test Agent',
        selfHealing: { enabled: false },
      })

      await selfHealingManager.handleAgentFailure(agentId, error)

      // Should not schedule restart
      expect(selfHealingManager.restartTimers.has(agentId)).toBe(false)
    })

    it('should handle critical failure when max attempts exceeded', async () => {
      const agentId = 'test-agent'
      const error = new Error('Test error')

      // Setup manifest
      mockOrchestrator.manifests.set(agentId, {
        name: 'Test Agent',
        selfHealing: { enabled: true },
        criticality: 'high',
      })

      // Record max attempts
      for (let i = 0; i < 5; i++) {
        selfHealingManager.recordRestartAttempt(agentId)
      }

      const handleCriticalFailureSpy = vi.spyOn(
        selfHealingManager,
        'handleCriticalFailure',
      )

      await selfHealingManager.handleAgentFailure(agentId, error)

      expect(handleCriticalFailureSpy).toHaveBeenCalledWith(agentId, error)
    })

    it('should not proceed if manifest not found', async () => {
      const agentId = 'unknown-agent'
      const error = new Error('Test error')

      await selfHealingManager.handleAgentFailure(agentId, error)

      // Should not schedule restart
      expect(selfHealingManager.restartTimers.has(agentId)).toBe(false)
    })
  })

  describe('restartAgent', () => {
    it('should restart agent successfully', async () => {
      const agentId = 'test-agent'

      const result = await selfHealingManager.restartAgent(agentId)

      expect(result).toBe(true)
      expect(mockOrchestrator.stopAgent).toHaveBeenCalledWith(agentId)
      expect(mockOrchestrator.startAgent).toHaveBeenCalledWith(agentId)
      expect(selfHealingManager.getRestartAttempts(agentId)).toBe(0) // History cleared
    })

    it('should emit agent:restarted event on success', async () => {
      const agentId = 'test-agent'
      const eventSpy = vi.fn()

      selfHealingManager.on('agent:restarted', eventSpy)

      await selfHealingManager.restartAgent(agentId)

      expect(eventSpy).toHaveBeenCalledWith({ agentId })
    })

    it('should handle restart failure', async () => {
      const agentId = 'test-agent'
      const error = new Error('Start failed')

      mockOrchestrator.startAgent.mockRejectedValueOnce(error)

      // Setup manifest for handleAgentFailure
      mockOrchestrator.manifests.set(agentId, {
        name: 'Test Agent',
        selfHealing: { enabled: true },
      })

      const result = await selfHealingManager.restartAgent(agentId)

      expect(result).toBe(false)
      expect(selfHealingManager.getRestartAttempts(agentId)).toBe(1) // Attempt recorded
    })

    it('should emit agent:restart-failed event on failure', async () => {
      const agentId = 'test-agent'
      const error = new Error('Start failed')

      mockOrchestrator.startAgent.mockRejectedValueOnce(error)
      mockOrchestrator.manifests.set(agentId, {
        name: 'Test Agent',
        selfHealing: { enabled: true },
      })

      const eventSpy = vi.fn()
      selfHealingManager.on('agent:restart-failed', eventSpy)

      await selfHealingManager.restartAgent(agentId)

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ agentId, error }),
      )
    })
  })

  describe('findFallback', () => {
    it('should find healthy fallback agent', async () => {
      const capability = 'data-processing'
      const mockAgents = [
        { id: 'agent-1', name: 'Agent 1', status: 'active' },
        { id: 'agent-2', name: 'Agent 2', status: 'active' },
      ]

      mockDiscoveryService.discover.mockReturnValue(mockAgents)

      const fallback = await selfHealingManager.findFallback(capability)

      expect(fallback).toEqual(mockAgents[0])
      expect(mockDiscoveryService.discover).toHaveBeenCalledWith(capability)
    })

    it('should filter out inactive agents', async () => {
      const capability = 'data-processing'
      const mockAgents = [
        { id: 'agent-1', name: 'Agent 1', status: 'inactive' },
        { id: 'agent-2', name: 'Agent 2', status: 'active' },
      ]

      mockDiscoveryService.discover.mockReturnValue(mockAgents)

      const fallback = await selfHealingManager.findFallback(capability)

      expect(fallback).toEqual(mockAgents[1])
    })

    it('should return null if no healthy agents found', async () => {
      const capability = 'data-processing'
      mockDiscoveryService.discover.mockReturnValue([])

      const fallback = await selfHealingManager.findFallback(capability)

      expect(fallback).toBeNull()
    })

    it('should handle discovery service errors', async () => {
      const capability = 'data-processing'
      mockDiscoveryService.discover.mockImplementation(() => {
        throw new Error('Discovery failed')
      })

      const fallback = await selfHealingManager.findFallback(capability)

      expect(fallback).toBeNull()
    })
  })

  describe('enableGracefulDegradation', () => {
    it('should emit graceful-degradation:enabled event', async () => {
      const feature = 'test-feature'
      const eventSpy = vi.fn()

      selfHealingManager.on('graceful-degradation:enabled', eventSpy)

      await selfHealingManager.enableGracefulDegradation(feature)

      expect(eventSpy).toHaveBeenCalledWith({ feature })
    })
  })

  describe('handleCriticalFailure', () => {
    it('should send critical alert for critical agents', async () => {
      const agentId = 'critical-agent'
      const error = new Error('Critical failure')

      mockOrchestrator.manifests.set(agentId, {
        name: 'Critical Agent',
        criticality: 'critical',
        provides: { capabilities: [] },
      })

      await selfHealingManager.handleCriticalFailure(agentId, error)

      expect(mockNotificationHub.sendCriticalAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Critical Agent Failure',
          agentId,
          criticality: 'critical',
        }),
      )
    })

    it('should try to find fallback for non-critical agents', async () => {
      const agentId = 'test-agent'
      const error = new Error('Failure')

      mockOrchestrator.manifests.set(agentId, {
        name: 'Test Agent',
        criticality: 'medium',
        provides: { capabilities: ['data-processing'] },
      })

      mockDiscoveryService.discover.mockReturnValue([
        { id: 'fallback-agent', name: 'Fallback', status: 'active' },
      ])

      await selfHealingManager.handleCriticalFailure(agentId, error)

      expect(mockDiscoveryService.discover).toHaveBeenCalledWith('data-processing')
    })

    it('should enable graceful degradation if no fallback found', async () => {
      const agentId = 'test-agent'
      const error = new Error('Failure')

      mockOrchestrator.manifests.set(agentId, {
        name: 'Test Agent',
        criticality: 'medium',
        provides: { capabilities: ['data-processing'] },
      })

      mockDiscoveryService.discover.mockReturnValue([])

      const gracefulDegradationSpy = vi.spyOn(
        selfHealingManager,
        'enableGracefulDegradation',
      )

      await selfHealingManager.handleCriticalFailure(agentId, error)

      expect(gracefulDegradationSpy).toHaveBeenCalledWith(agentId)
    })

    it('should emit agent:critical-failure event', async () => {
      const agentId = 'test-agent'
      const error = new Error('Failure')

      mockOrchestrator.manifests.set(agentId, {
        name: 'Test Agent',
        provides: { capabilities: [] },
      })

      const eventSpy = vi.fn()
      selfHealingManager.on('agent:critical-failure', eventSpy)

      await selfHealingManager.handleCriticalFailure(agentId, error)

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({ agentId, error }),
      )
    })
  })

  describe('getAllRestartHistory', () => {
    it('should return restart history for all agents', () => {
      selfHealingManager.recordRestartAttempt('agent-1')
      selfHealingManager.recordRestartAttempt('agent-1')
      selfHealingManager.recordRestartAttempt('agent-2')

      const history = selfHealingManager.getAllRestartHistory()

      expect(history.length).toBe(2)
      expect(history[0].agentId).toBe('agent-1')
      expect(history[0].totalRestarts).toBe(2)
      expect(history[1].agentId).toBe('agent-2')
      expect(history[1].totalRestarts).toBe(1)
    })

    it('should return empty array when no history', () => {
      const history = selfHealingManager.getAllRestartHistory()
      expect(history).toEqual([])
    })
  })

  describe('getStats', () => {
    it('should return statistics', () => {
      selfHealingManager.recordRestartAttempt('agent-1')
      selfHealingManager.recordRestartAttempt('agent-2')

      const stats = selfHealingManager.getStats()

      expect(stats).toHaveProperty('totalAgentsWithHistory', 2)
      expect(stats).toHaveProperty('totalRestarts', 2)
      expect(stats).toHaveProperty('maxRestartAttempts', 5)
      expect(stats).toHaveProperty('baseRestartDelay', 100)
      expect(stats).toHaveProperty('restartHistory')
    })
  })

  describe('registerOrchestratorIntegration', () => {
    it('should register with orchestrator events', () => {
      selfHealingManager.registerOrchestratorIntegration()

      // Emit agent:failed event
      mockOrchestrator.manifests.set('test-agent', {
        name: 'Test Agent',
        selfHealing: { enabled: true },
      })

      mockOrchestrator.emit('agent:failed', {
        agentId: 'test-agent',
        error: new Error('Test'),
      })

      // Should schedule restart
      expect(selfHealingManager.restartTimers.has('test-agent')).toBe(true)
    })
  })

  describe('registerAgentRegistryIntegration', () => {
    it('should register with agent registry events', () => {
      const mockRegistry = new EventEmitter()

      selfHealingManager.registerAgentRegistryIntegration(mockRegistry)

      // Emit agent:offline event
      mockOrchestrator.manifests.set('test-agent', {
        name: 'Test Agent',
        selfHealing: { enabled: true },
      })

      mockRegistry.emit('agent:offline', { agentId: 'test-agent' })

      // Should schedule restart
      expect(selfHealingManager.restartTimers.has('test-agent')).toBe(true)
    })
  })

  describe('shutdown', () => {
    it('should clear all timers and data', () => {
      // Setup some data
      selfHealingManager.recordRestartAttempt('agent-1')
      selfHealingManager.restartTimers.set('agent-1', setTimeout(() => {}, 1000))

      selfHealingManager.shutdown()

      expect(selfHealingManager.restartHistory.size).toBe(0)
      expect(selfHealingManager.restartTimers.size).toBe(0)
      expect(selfHealingManager.listenerCount('agent:restarted')).toBe(0)
    })
  })
})
