// AgentDiscoveryService.spec.js - Unit tests for AgentDiscoveryService
// Issue #2704 - Phase 2.1

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentDiscoveryService } from '../AgentDiscoveryService.js';

describe('AgentDiscoveryService', () => {
  let discoveryService;

  beforeEach(() => {
    // Create service with shorter intervals for testing
    discoveryService = new AgentDiscoveryService({
      heartbeatInterval: 100, // 100ms for fast testing
      heartbeatTimeout: 300, // 300ms timeout
      maxAgents: 100
    });
  });

  afterEach(() => {
    if (discoveryService) {
      discoveryService.shutdown();
    }
  });

  describe('register()', () => {
    it('should register an agent with valid info', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test_capability'],
        endpoint: 'http://localhost:3000/agent'
      };

      const result = await discoveryService.register(agentInfo);

      expect(result.success).toBe(true);
      expect(result.agent).toBeDefined();
      expect(result.agent.id).toBeDefined();
      expect(result.agent.name).toBe('TestAgent');
      expect(result.agent.capabilities).toEqual(['test_capability']);
      expect(result.agent.endpoint).toBe('http://localhost:3000/agent');
    });

    it('should generate agent ID if not provided', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      const result = await discoveryService.register(agentInfo);

      expect(result.agent.id).toBeDefined();
      expect(result.agent.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    it('should use provided agent ID', async () => {
      const agentInfo = {
        id: 'custom-agent-id',
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      const result = await discoveryService.register(agentInfo);

      expect(result.agent.id).toBe('custom-agent-id');
    });

    it('should throw error if name is missing', async () => {
      const agentInfo = {
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      await expect(discoveryService.register(agentInfo)).rejects.toThrow('Agent name is required');
    });

    it('should throw error if capabilities is missing', async () => {
      const agentInfo = {
        name: 'TestAgent',
        endpoint: 'http://localhost:3000'
      };

      await expect(discoveryService.register(agentInfo)).rejects.toThrow('Agent capabilities array is required');
    });

    it('should throw error if capabilities is empty', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: [],
        endpoint: 'http://localhost:3000'
      };

      await expect(discoveryService.register(agentInfo)).rejects.toThrow('Agent must have at least one capability');
    });

    it('should throw error if endpoint is missing', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test']
      };

      await expect(discoveryService.register(agentInfo)).rejects.toThrow('Agent endpoint is required');
    });

    it('should emit agent:registered event', async () => {
      const eventSpy = vi.fn();
      discoveryService.on('agent:registered', eventSpy);

      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      await discoveryService.register(agentInfo);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy.mock.calls[0][0]).toMatchObject({
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      });
    });

    it('should index agent by capabilities', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['capability1', 'capability2'],
        endpoint: 'http://localhost:3000'
      };

      await discoveryService.register(agentInfo);

      const agents1 = discoveryService.discover('capability1');
      const agents2 = discoveryService.discover('capability2');

      expect(agents1).toHaveLength(1);
      expect(agents2).toHaveLength(1);
      expect(agents1[0].name).toBe('TestAgent');
      expect(agents2[0].name).toBe('TestAgent');
    });

    it('should store metadata if provided', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000',
        metadata: {
          version: '1.0.0',
          criticality: 'high'
        }
      };

      const result = await discoveryService.register(agentInfo);
      const agent = discoveryService.discoverById(result.agent.id);

      expect(agent.metadata).toEqual({
        version: '1.0.0',
        criticality: 'high'
      });
    });
  });

  describe('deregister()', () => {
    it('should deregister an existing agent', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      const { agent } = await discoveryService.register(agentInfo);
      const result = await discoveryService.deregister(agent.id);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe(agent.id);

      // Verify agent is removed
      const foundAgent = discoveryService.discoverById(agent.id);
      expect(foundAgent).toBeNull();
    });

    it('should throw error if agent not found', async () => {
      await expect(discoveryService.deregister('non-existent-id')).rejects.toThrow('Agent non-existent-id not found');
    });

    it('should emit agent:deregistered event', async () => {
      const eventSpy = vi.fn();
      discoveryService.on('agent:deregistered', eventSpy);

      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      const { agent } = await discoveryService.register(agentInfo);
      await discoveryService.deregister(agent.id);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy.mock.calls[0][0]).toMatchObject({
        id: agent.id,
        name: 'TestAgent'
      });
    });

    it('should remove agent from capability index', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test_capability'],
        endpoint: 'http://localhost:3000'
      };

      const { agent } = await discoveryService.register(agentInfo);

      // Verify agent is in capability index
      let agents = discoveryService.discover('test_capability');
      expect(agents).toHaveLength(1);

      // Deregister
      await discoveryService.deregister(agent.id);

      // Verify agent is removed from capability index
      agents = discoveryService.discover('test_capability');
      expect(agents).toHaveLength(0);
    });
  });

  describe('discover()', () => {
    it('should discover agents by capability', async () => {
      const agent1Info = {
        name: 'Agent1',
        capabilities: ['capability1', 'capability2'],
        endpoint: 'http://localhost:3001'
      };

      const agent2Info = {
        name: 'Agent2',
        capabilities: ['capability1'],
        endpoint: 'http://localhost:3002'
      };

      const agent3Info = {
        name: 'Agent3',
        capabilities: ['capability3'],
        endpoint: 'http://localhost:3003'
      };

      await discoveryService.register(agent1Info);
      await discoveryService.register(agent2Info);
      await discoveryService.register(agent3Info);

      const agents = discoveryService.discover('capability1');

      expect(agents).toHaveLength(2);
      expect(agents.map(a => a.name)).toContain('Agent1');
      expect(agents.map(a => a.name)).toContain('Agent2');
    });

    it('should return empty array if no agents have capability', () => {
      const agents = discoveryService.discover('non-existent-capability');

      expect(agents).toEqual([]);
    });

    it('should throw error if capability not provided', () => {
      expect(() => discoveryService.discover()).toThrow('Capability is required');
    });

    it('should only return active agents', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      const { agent } = await discoveryService.register(agentInfo);

      // Mark agent as inactive
      const agentObj = discoveryService.agents.get(agent.id);
      agentObj.status = 'inactive';

      const agents = discoveryService.discover('test');

      expect(agents).toHaveLength(0);
    });
  });

  describe('discoverById()', () => {
    it('should discover agent by ID', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      const { agent } = await discoveryService.register(agentInfo);
      const foundAgent = discoveryService.discoverById(agent.id);

      expect(foundAgent).toBeDefined();
      expect(foundAgent.id).toBe(agent.id);
      expect(foundAgent.name).toBe('TestAgent');
    });

    it('should return null if agent not found', () => {
      const agent = discoveryService.discoverById('non-existent-id');

      expect(agent).toBeNull();
    });

    it('should throw error if ID not provided', () => {
      expect(() => discoveryService.discoverById()).toThrow('Agent ID is required');
    });
  });

  describe('getAll()', () => {
    it('should return all active agents by default', async () => {
      const agent1Info = {
        name: 'Agent1',
        capabilities: ['test'],
        endpoint: 'http://localhost:3001'
      };

      const agent2Info = {
        name: 'Agent2',
        capabilities: ['test'],
        endpoint: 'http://localhost:3002'
      };

      await discoveryService.register(agent1Info);
      await discoveryService.register(agent2Info);

      const agents = discoveryService.getAll();

      expect(agents).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      const { agent } = await discoveryService.register(agentInfo);

      // Mark as inactive
      const agentObj = discoveryService.agents.get(agent.id);
      agentObj.status = 'inactive';

      const activeAgents = discoveryService.getAll({ status: 'active' });
      const inactiveAgents = discoveryService.getAll({ status: 'inactive' });
      const allAgents = discoveryService.getAll({ status: 'all' });

      expect(activeAgents).toHaveLength(0);
      expect(inactiveAgents).toHaveLength(1);
      expect(allAgents).toHaveLength(1);
    });
  });

  describe('subscribe()', () => {
    it('should subscribe to all events by default', async () => {
      const callback = vi.fn();
      const unsubscribe = discoveryService.subscribe(callback);

      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      const { agent } = await discoveryService.register(agentInfo);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        name: 'TestAgent'
      }));

      unsubscribe();
    });

    it('should subscribe to specific event type', async () => {
      const callback = vi.fn();
      const unsubscribe = discoveryService.subscribe(callback, 'agent:registered');

      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      await discoveryService.register(agentInfo);

      expect(callback).toHaveBeenCalled();

      unsubscribe();
    });

    it('should unsubscribe when calling returned function', async () => {
      const callback = vi.fn();
      const unsubscribe = discoveryService.subscribe(callback);

      unsubscribe();

      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      await discoveryService.register(agentInfo);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should throw error if callback is not a function', () => {
      expect(() => discoveryService.subscribe('not-a-function')).toThrow('Callback must be a function');
    });
  });

  describe('updateHeartbeat()', () => {
    it('should update agent heartbeat', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      const { agent } = await discoveryService.register(agentInfo);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      const result = await discoveryService.updateHeartbeat(agent.id);

      expect(result.success).toBe(true);
      expect(result.agentId).toBe(agent.id);
      expect(result.lastHeartbeat).toBeDefined();
    });

    it('should reactivate inactive agent on heartbeat', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      const { agent } = await discoveryService.register(agentInfo);

      // Mark as inactive
      const agentObj = discoveryService.agents.get(agent.id);
      agentObj.status = 'inactive';

      await discoveryService.updateHeartbeat(agent.id);

      const updatedAgent = discoveryService.discoverById(agent.id);
      expect(updatedAgent.status).toBe('active');
    });

    it('should throw error if agent not found', async () => {
      await expect(discoveryService.updateHeartbeat('non-existent-id')).rejects.toThrow('Agent non-existent-id not found');
    });

    it('should emit agent:heartbeat event', async () => {
      const eventSpy = vi.fn();
      discoveryService.on('agent:heartbeat', eventSpy);

      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      const { agent } = await discoveryService.register(agentInfo);
      await discoveryService.updateHeartbeat(agent.id);

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('heartbeat monitoring', () => {
    it('should mark agent as inactive after timeout', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      const { agent } = await discoveryService.register(agentInfo);

      // Wait for timeout (300ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 400));

      const updatedAgent = discoveryService.discoverById(agent.id);
      expect(updatedAgent.status).toBe('inactive');
    });

    it('should emit agent:timeout event when agent times out', async () => {
      const eventSpy = vi.fn();
      discoveryService.on('agent:timeout', eventSpy);

      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      await discoveryService.register(agentInfo);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 400));

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should keep agent active if heartbeat updated', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      const { agent } = await discoveryService.register(agentInfo);

      // Update heartbeat every 100ms
      const heartbeatInterval = setInterval(async () => {
        try {
          await discoveryService.updateHeartbeat(agent.id);
        } catch (error) {
          // Ignore errors if agent removed
        }
      }, 100);

      // Wait 500ms (should still be active)
      await new Promise(resolve => setTimeout(resolve, 500));

      clearInterval(heartbeatInterval);

      const updatedAgent = discoveryService.discoverById(agent.id);
      expect(updatedAgent.status).toBe('active');
    });
  });

  describe('getStats()', () => {
    it('should return service statistics', async () => {
      const agent1Info = {
        name: 'Agent1',
        capabilities: ['cap1'],
        endpoint: 'http://localhost:3001'
      };

      const agent2Info = {
        name: 'Agent2',
        capabilities: ['cap2'],
        endpoint: 'http://localhost:3002'
      };

      await discoveryService.register(agent1Info);
      await discoveryService.register(agent2Info);

      const stats = discoveryService.getStats();

      expect(stats.totalAgents).toBe(2);
      expect(stats.activeAgents).toBe(2);
      expect(stats.inactiveAgents).toBe(0);
      expect(stats.capabilities).toBe(2);
      expect(stats.heartbeatInterval).toBeDefined();
      expect(stats.heartbeatTimeout).toBeDefined();
    });
  });

  describe('shutdown()', () => {
    it('should shutdown cleanly', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      await discoveryService.register(agentInfo);

      discoveryService.shutdown();

      expect(discoveryService.agents.size).toBe(0);
      expect(discoveryService.capabilityIndex.size).toBe(0);
      expect(discoveryService.heartbeatTimers.size).toBe(0);
    });

    it('should stop heartbeat monitoring on shutdown', async () => {
      const agentInfo = {
        name: 'TestAgent',
        capabilities: ['test'],
        endpoint: 'http://localhost:3000'
      };

      await discoveryService.register(agentInfo);

      discoveryService.shutdown();

      expect(discoveryService.heartbeatMonitoringTimer).toBeNull();
    });
  });
});
