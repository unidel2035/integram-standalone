// SelfHealingManager.integration.spec.js - Integration tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SelfHealingManager } from '../SelfHealingManager.js'
import { MultiAgentOrchestrator } from '../MultiAgentOrchestrator.js'
import { AgentDiscoveryService } from '../AgentDiscoveryService.js'
import { AgentRegistry } from '../../core/AgentRegistry.js'
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
    gauge: vi.fn(),
  },
}))

describe('SelfHealingManager Integration Tests', () => {
  let selfHealingManager
  let orchestrator
  let discoveryService
  let agentRegistry
  let notificationHub

  beforeEach(() => {
    // Create real instances
    agentRegistry = new AgentRegistry()

    orchestrator = new MultiAgentOrchestrator({
      agentRegistry,
      manifestsDir: '/tmp/test-manifests',
    })

    discoveryService = new AgentDiscoveryService({
      agentRegistry,
    })

    notificationHub = {
      sendCriticalAlert: vi.fn().mockResolvedValue(true),
    }

    selfHealingManager = new SelfHealingManager({
      orchestrator,
      discoveryService,
      notificationHub,
      maxRestartAttempts: 3,
      baseRestartDelay: 50, // Short delay for tests
    })
  })

  afterEach(() => {
    selfHealingManager.shutdown()
    discoveryService.shutdown()
    agentRegistry.shutdown()
    vi.clearAllMocks()
  })

  describe('Integration with MultiAgentOrchestrator', () => {
    it('should handle orchestrator agent:failed event', async () => {
      // Register integration
      selfHealingManager.registerOrchestratorIntegration()

      // Setup agent manifest
      orchestrator.manifests.set('test-agent', {
        name: 'Test Agent',
        selfHealing: { enabled: true },
      })

      // Mock orchestrator methods
      orchestrator.startAgent = vi.fn().mockResolvedValue(true)
      orchestrator.stopAgent = vi.fn().mockResolvedValue(true)

      // Emit agent:failed event
      orchestrator.emit('agent:failed', {
        agentId: 'test-agent',
        error: new Error('Agent crashed'),
      })

      // Wait for restart to be scheduled
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should have scheduled a restart
      expect(selfHealingManager.restartTimers.has('test-agent')).toBe(true)
    })

    it('should successfully restart agent through orchestrator', async () => {
      const agentId = 'test-agent'

      // Setup manifest
      orchestrator.manifests.set(agentId, {
        name: 'Test Agent',
        selfHealing: { enabled: true },
      })

      // Mock orchestrator methods
      orchestrator.startAgent = vi.fn().mockResolvedValue(true)
      orchestrator.stopAgent = vi.fn().mockResolvedValue(true)

      // Restart agent
      const result = await selfHealingManager.restartAgent(agentId)

      expect(result).toBe(true)
      expect(orchestrator.stopAgent).toHaveBeenCalledWith(agentId)
      expect(orchestrator.startAgent).toHaveBeenCalledWith(agentId)
    })
  })

  describe('Integration with AgentDiscoveryService', () => {
    it('should find fallback agent using discovery service', async () => {
      const capability = 'data-processing'

      // Register agents with discovery service
      await discoveryService.register({
        id: 'agent-1',
        name: 'Agent 1',
        capabilities: [capability],
        endpoint: 'http://localhost:3001',
      })

      await discoveryService.register({
        id: 'agent-2',
        name: 'Agent 2',
        capabilities: [capability],
        endpoint: 'http://localhost:3002',
      })

      // Find fallback
      const fallback = await selfHealingManager.findFallback(capability)

      expect(fallback).toBeDefined()
      expect(fallback.capabilities).toContain(capability)
    })

    it('should handle no fallback available scenario', async () => {
      const capability = 'rare-capability'

      // No agents registered with this capability
      const fallback = await selfHealingManager.findFallback(capability)

      expect(fallback).toBeNull()
    })
  })

  describe('Integration with AgentRegistry', () => {
    it('should handle agent:offline event from registry', async () => {
      const agentId = 'test-agent'

      // Register integration
      selfHealingManager.registerAgentRegistryIntegration(agentRegistry)

      // Setup manifest
      orchestrator.manifests.set(agentId, {
        name: 'Test Agent',
        selfHealing: { enabled: true },
      })

      // Mock orchestrator methods
      orchestrator.startAgent = vi.fn().mockResolvedValue(true)
      orchestrator.stopAgent = vi.fn().mockResolvedValue(true)

      // Emit agent:offline event
      agentRegistry.emit('agent:offline', { agentId })

      // Wait for restart to be scheduled
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(selfHealingManager.restartTimers.has(agentId)).toBe(true)
    })
  })

  describe('End-to-End Restart Workflow', () => {
    it('should complete full restart cycle on failure', async () => {
      const agentId = 'test-agent'

      // Setup
      orchestrator.manifests.set(agentId, {
        name: 'Test Agent',
        selfHealing: {
          enabled: true,
          maxRestartAttempts: 3,
        },
      })

      orchestrator.startAgent = vi.fn().mockResolvedValue(true)
      orchestrator.stopAgent = vi.fn().mockResolvedValue(true)

      // Track events
      const events = []
      selfHealingManager.on('agent:restarted', data => {
        events.push({ type: 'restarted', data })
      })

      // Trigger failure
      await selfHealingManager.handleAgentFailure(
        agentId,
        new Error('Simulated crash'),
      )

      // Wait for restart (with backoff delay)
      await new Promise(resolve => setTimeout(resolve, 200))

      // Verify restart completed
      expect(orchestrator.stopAgent).toHaveBeenCalled()
      expect(orchestrator.startAgent).toHaveBeenCalled()
      expect(events.some(e => e.type === 'restarted')).toBe(true)
    })

    it('should handle multiple failures with exponential backoff', async () => {
      const agentId = 'flaky-agent'

      orchestrator.manifests.set(agentId, {
        name: 'Flaky Agent',
        selfHealing: { enabled: true },
      })

      // First attempt succeeds, second fails, third succeeds
      orchestrator.startAgent = vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Still broken'))
        .mockResolvedValueOnce(true)

      orchestrator.stopAgent = vi.fn().mockResolvedValue(true)

      // First failure
      await selfHealingManager.handleAgentFailure(
        agentId,
        new Error('First crash'),
      )

      // Wait for first restart
      await new Promise(resolve => setTimeout(resolve, 200))

      // Should have 1 restart attempt
      expect(selfHealingManager.getRestartAttempts(agentId)).toBe(1)
    })
  })

  describe('Critical Failure Handling', () => {
    it('should send notification for critical failure', async () => {
      const agentId = 'critical-agent'

      orchestrator.manifests.set(agentId, {
        name: 'Critical Agent',
        criticality: 'critical',
        selfHealing: {
          enabled: true,
          maxRestartAttempts: 2,
        },
        provides: { capabilities: [] },
      })

      orchestrator.startAgent = vi.fn().mockRejectedValue(new Error('Fatal error'))
      orchestrator.stopAgent = vi.fn().mockResolvedValue(true)

      // Record max attempts
      for (let i = 0; i < 2; i++) {
        selfHealingManager.recordRestartAttempt(agentId)
      }

      // Trigger failure (should hit critical)
      await selfHealingManager.handleAgentFailure(
        agentId,
        new Error('Fatal error'),
      )

      expect(notificationHub.sendCriticalAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Critical Agent Failure',
          agentId,
          criticality: 'critical',
        }),
      )
    })

    it('should enable graceful degradation for non-critical failures', async () => {
      const agentId = 'non-critical-agent'

      orchestrator.manifests.set(agentId, {
        name: 'Non-Critical Agent',
        criticality: 'low',
        selfHealing: {
          enabled: true,
          maxRestartAttempts: 2,
        },
        provides: { capabilities: ['optional-feature'] },
      })

      orchestrator.startAgent = vi.fn().mockRejectedValue(new Error('Error'))
      orchestrator.stopAgent = vi.fn().mockResolvedValue(true)

      // Record max attempts
      for (let i = 0; i < 2; i++) {
        selfHealingManager.recordRestartAttempt(agentId)
      }

      // Track graceful degradation event
      const events = []
      selfHealingManager.on('graceful-degradation:enabled', data => {
        events.push(data)
      })

      // Trigger critical failure
      await selfHealingManager.handleAgentFailure(
        agentId,
        new Error('Error'),
      )

      // Should enable graceful degradation
      expect(events.some(e => e.feature === agentId)).toBe(true)
    })
  })

  describe('Fallback Discovery and Switching', () => {
    it('should find and switch to fallback on critical failure', async () => {
      const agentId = 'primary-agent'
      const capability = 'data-processing'

      // Setup primary agent
      orchestrator.manifests.set(agentId, {
        name: 'Primary Agent',
        criticality: 'medium',
        selfHealing: {
          enabled: true,
          maxRestartAttempts: 2,
        },
        provides: { capabilities: [capability] },
      })

      // Register fallback agent
      await discoveryService.register({
        id: 'fallback-agent',
        name: 'Fallback Agent',
        capabilities: [capability],
        endpoint: 'http://localhost:3003',
      })

      // Record max attempts for primary
      for (let i = 0; i < 2; i++) {
        selfHealingManager.recordRestartAttempt(agentId)
      }

      // Trigger critical failure
      await selfHealingManager.handleCriticalFailure(
        agentId,
        new Error('Primary failed'),
      )

      // Should have found fallback
      const fallback = await selfHealingManager.findFallback(capability)
      expect(fallback).toBeDefined()
      expect(fallback.id).toBe('fallback-agent')
    })
  })

  describe('Statistics and Monitoring', () => {
    it('should track restart statistics across multiple agents', async () => {
      // Record restarts for multiple agents
      selfHealingManager.recordRestartAttempt('agent-1')
      selfHealingManager.recordRestartAttempt('agent-1')
      selfHealingManager.recordRestartAttempt('agent-2')

      const stats = selfHealingManager.getStats()

      expect(stats.totalAgentsWithHistory).toBe(2)
      expect(stats.totalRestarts).toBe(3)
      expect(stats.restartHistory).toHaveLength(2)
    })

    it('should provide detailed history per agent', () => {
      selfHealingManager.recordRestartAttempt('agent-1')
      selfHealingManager.recordRestartAttempt('agent-1')

      const history = selfHealingManager.getAllRestartHistory()
      const agent1History = history.find(h => h.agentId === 'agent-1')

      expect(agent1History).toBeDefined()
      expect(agent1History.totalRestarts).toBe(2)
      expect(agent1History.recentRestarts).toBe(2)
      expect(agent1History.timestamps).toHaveLength(2)
    })
  })
})
