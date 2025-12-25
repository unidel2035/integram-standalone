// AgentManager.spec.js - Unit tests for AgentManager
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentManager, TaskPriority, TaskStatus, LoadBalancingStrategy } from '../AgentManager.js';
import { AgentRegistry, AgentCapabilities } from '../../core/AgentRegistry.js';
import { BaseAgent } from '../../agents/BaseAgent.js';

describe('AgentManager', () => {
  let agentManager;
  let agentRegistry;

  beforeEach(() => {
    agentRegistry = new AgentRegistry({ maxAgents: 100 });
    agentManager = new AgentManager({
      registry: agentRegistry,
      maxTasks: 1000,
      loadBalancingStrategy: LoadBalancingStrategy.LEAST_LOADED,
      taskAssignmentInterval: 100
    });
  });

  afterEach(() => {
    agentManager.shutdown();
  });

  describe('Agent Registration', () => {
    it('should register an agent with the manager', () => {
      const agent = agentManager.registerAgent({
        name: 'TestAgent',
        capabilities: [AgentCapabilities.GENERIC]
      });

      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('TestAgent');
      expect(agentRegistry.getAgent(agent.id)).toBeDefined();
    });

    it('should register an agent with BaseAgent instance', () => {
      const agentInstance = new BaseAgent({
        id: 'test-agent-1',
        name: 'TestAgent',
        capabilities: [AgentCapabilities.GENERIC]
      });

      const agent = agentManager.registerAgent(
        {
          id: 'test-agent-1',
          name: 'TestAgent',
          capabilities: [AgentCapabilities.GENERIC]
        },
        agentInstance
      );

      expect(agent).toBeDefined();
      expect(agent.id).toBe('test-agent-1');
      expect(agentManager.agentInstances.get(agent.id)).toBe(agentInstance);
    });

    it('should initialize task count for registered agent', () => {
      const agent = agentManager.registerAgent({
        name: 'TestAgent',
        capabilities: [AgentCapabilities.GENERIC]
      });

      expect(agentManager.agentTaskCounts.get(agent.id)).toBe(0);
    });
  });

  describe('Agent Unregistration', () => {
    it('should unregister an agent', () => {
      const agent = agentManager.registerAgent({
        name: 'TestAgent',
        capabilities: [AgentCapabilities.GENERIC]
      });

      const unregistered = agentManager.unregisterAgent(agent.id);

      expect(unregistered.id).toBe(agent.id);
      expect(agentRegistry.getAgent(agent.id)).toBeUndefined();
      expect(agentManager.agentInstances.has(agent.id)).toBe(false);
      expect(agentManager.agentTaskCounts.has(agent.id)).toBe(false);
    });

    it('should reassign tasks when agent is unregistered', () => {
      const agent = agentManager.registerAgent({
        name: 'TestAgent',
        capabilities: [AgentCapabilities.GENERIC]
      });

      const task = agentManager.createTask({
        type: 'test',
        requiredCapabilities: [AgentCapabilities.GENERIC]
      });

      // Manually assign task
      task.status = TaskStatus.ASSIGNED;
      task.assignedAgentId = agent.id;

      agentManager.unregisterAgent(agent.id);

      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.assignedAgentId).toBeNull();
      expect(agentManager.taskQueue).toContainEqual(task);
    });
  });

  describe('Task Creation', () => {
    it('should create a task with default values', () => {
      const task = agentManager.createTask({
        type: 'test_task'
      });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.type).toBe('test_task');
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.priority).toBe(TaskPriority.NORMAL);
      expect(task.requiredCapabilities).toEqual([AgentCapabilities.GENERIC]);
      expect(agentManager.tasks.has(task.id)).toBe(true);
    });

    it('should create a task with custom priority', () => {
      const task = agentManager.createTask({
        type: 'urgent_task',
        priority: TaskPriority.URGENT
      });

      expect(task.priority).toBe(TaskPriority.URGENT);
    });

    it('should add task to queue', () => {
      const task = agentManager.createTask({
        type: 'test_task'
      });

      expect(agentManager.taskQueue).toContainEqual(task);
    });

    it('should sort task queue by priority', () => {
      const lowPriorityTask = agentManager.createTask({
        type: 'low',
        priority: TaskPriority.LOW
      });

      const urgentTask = agentManager.createTask({
        type: 'urgent',
        priority: TaskPriority.URGENT
      });

      const normalTask = agentManager.createTask({
        type: 'normal',
        priority: TaskPriority.NORMAL
      });

      expect(agentManager.taskQueue[0]).toBe(urgentTask);
      expect(agentManager.taskQueue[2]).toBe(lowPriorityTask);
    });
  });

  describe('Capability Matching', () => {
    it('should find agents with required capabilities', () => {
      agentManager.registerAgent({
        name: 'Agent1',
        capabilities: [AgentCapabilities.GENERIC, AgentCapabilities.ANALYZER]
      });

      agentManager.registerAgent({
        name: 'Agent2',
        capabilities: [AgentCapabilities.VALIDATOR]
      });

      const task = agentManager.createTask({
        type: 'analyze',
        requiredCapabilities: [AgentCapabilities.ANALYZER]
      });

      const capableAgents = agentManager.findCapableAgents(task);

      expect(capableAgents).toHaveLength(1);
      expect(capableAgents[0].name).toBe('Agent1');
    });

    it('should not return offline agents', () => {
      const agent = agentManager.registerAgent({
        name: 'Agent1',
        capabilities: [AgentCapabilities.GENERIC]
      });

      agentRegistry.updateAgentStatus(agent.id, 'offline');

      const task = agentManager.createTask({
        type: 'test',
        requiredCapabilities: [AgentCapabilities.GENERIC]
      });

      const capableAgents = agentManager.findCapableAgents(task);

      expect(capableAgents).toHaveLength(0);
    });

    it('should not return agents at max capacity', () => {
      const agent = agentManager.registerAgent({
        name: 'Agent1',
        capabilities: [AgentCapabilities.GENERIC]
      });

      // Set agent to max capacity
      agentManager.agentTaskCounts.set(agent.id, agentManager.maxConcurrentTasksPerAgent);

      const task = agentManager.createTask({
        type: 'test',
        requiredCapabilities: [AgentCapabilities.GENERIC]
      });

      const capableAgents = agentManager.findCapableAgents(task);

      expect(capableAgents).toHaveLength(0);
    });
  });

  describe('Load Balancing Strategies', () => {
    it('should select agent using LEAST_LOADED strategy', () => {
      const agent1 = agentManager.registerAgent({
        name: 'Agent1',
        capabilities: [AgentCapabilities.GENERIC]
      });

      const agent2 = agentManager.registerAgent({
        name: 'Agent2',
        capabilities: [AgentCapabilities.GENERIC]
      });

      // Set different loads
      agentManager.agentTaskCounts.set(agent1.id, 2);
      agentManager.agentTaskCounts.set(agent2.id, 1);

      const task = agentManager.createTask({
        type: 'test',
        requiredCapabilities: [AgentCapabilities.GENERIC]
      });

      const capableAgents = agentManager.findCapableAgents(task);
      const selectedAgent = agentManager.selectAgent(capableAgents, task);

      expect(selectedAgent.id).toBe(agent2.id);
    });

    it('should select agent using ROUND_ROBIN strategy', () => {
      agentManager.loadBalancingStrategy = LoadBalancingStrategy.ROUND_ROBIN;

      const agent1 = agentManager.registerAgent({
        name: 'Agent1',
        capabilities: [AgentCapabilities.GENERIC]
      });

      const agent2 = agentManager.registerAgent({
        name: 'Agent2',
        capabilities: [AgentCapabilities.GENERIC]
      });

      const task1 = agentManager.createTask({
        type: 'test',
        requiredCapabilities: [AgentCapabilities.GENERIC]
      });

      const task2 = agentManager.createTask({
        type: 'test',
        requiredCapabilities: [AgentCapabilities.GENERIC]
      });

      const capableAgents = agentManager.findCapableAgents(task1);

      const selected1 = agentManager.selectAgent(capableAgents, task1);
      const selected2 = agentManager.selectAgent(capableAgents, task2);

      expect(selected1.id).not.toBe(selected2.id);
    });

    it('should select agent using RANDOM strategy', () => {
      agentManager.loadBalancingStrategy = LoadBalancingStrategy.RANDOM;

      agentManager.registerAgent({
        name: 'Agent1',
        capabilities: [AgentCapabilities.GENERIC]
      });

      agentManager.registerAgent({
        name: 'Agent2',
        capabilities: [AgentCapabilities.GENERIC]
      });

      const task = agentManager.createTask({
        type: 'test',
        requiredCapabilities: [AgentCapabilities.GENERIC]
      });

      const capableAgents = agentManager.findCapableAgents(task);
      const selectedAgent = agentManager.selectAgent(capableAgents, task);

      expect(selectedAgent).toBeDefined();
      expect(capableAgents).toContainEqual(selectedAgent);
    });
  });

  describe('Task Assignment', () => {
    it('should assign task to agent manually', async () => {
      const agent = agentManager.registerAgent({
        name: 'TestAgent',
        capabilities: [AgentCapabilities.GENERIC]
      });

      const task = agentManager.createTask({
        type: 'test',
        requiredCapabilities: [AgentCapabilities.GENERIC]
      });

      await agentManager.assignTaskToAgent(task.id, agent.id);

      expect(task.status).toBe(TaskStatus.ASSIGNED);
      expect(task.assignedAgentId).toBe(agent.id);
      expect(agentManager.agentTaskCounts.get(agent.id)).toBe(1);
    });

    it('should throw error if agent lacks required capabilities', async () => {
      const agent = agentManager.registerAgent({
        name: 'TestAgent',
        capabilities: [AgentCapabilities.GENERIC]
      });

      const task = agentManager.createTask({
        type: 'analyze',
        requiredCapabilities: [AgentCapabilities.ANALYZER]
      });

      await expect(agentManager.assignTaskToAgent(task.id, agent.id))
        .rejects.toThrow('does not have required capabilities');
    });

    it('should throw error if agent is at max capacity', async () => {
      const agent = agentManager.registerAgent({
        name: 'TestAgent',
        capabilities: [AgentCapabilities.GENERIC]
      });

      agentManager.agentTaskCounts.set(agent.id, agentManager.maxConcurrentTasksPerAgent);

      const task = agentManager.createTask({
        type: 'test',
        requiredCapabilities: [AgentCapabilities.GENERIC]
      });

      await expect(agentManager.assignTaskToAgent(task.id, agent.id))
        .rejects.toThrow('at maximum capacity');
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel a pending task', () => {
      const task = agentManager.createTask({
        type: 'test'
      });

      const cancelled = agentManager.cancelTask(task.id);

      expect(cancelled.status).toBe(TaskStatus.CANCELLED);
      expect(cancelled.completedAt).toBeDefined();
      expect(agentManager.taskQueue).not.toContainEqual(task);
    });

    it('should free up agent when cancelling assigned task', () => {
      const agent = agentManager.registerAgent({
        name: 'TestAgent',
        capabilities: [AgentCapabilities.GENERIC]
      });

      const task = agentManager.createTask({
        type: 'test',
        requiredCapabilities: [AgentCapabilities.GENERIC]
      });

      task.status = TaskStatus.ASSIGNED;
      task.assignedAgentId = agent.id;
      agentManager.agentTaskCounts.set(agent.id, 1);

      agentManager.cancelTask(task.id);

      expect(agentManager.agentTaskCounts.get(agent.id)).toBe(0);
    });

    it('should throw error when cancelling completed task', () => {
      const task = agentManager.createTask({
        type: 'test'
      });

      task.status = TaskStatus.COMPLETED;

      expect(() => agentManager.cancelTask(task.id))
        .toThrow('Cannot cancel completed task');
    });
  });

  describe('Statistics', () => {
    it('should return agent statistics', () => {
      const agent = agentManager.registerAgent({
        name: 'TestAgent',
        capabilities: [AgentCapabilities.GENERIC]
      });

      agentManager.agentTaskCounts.set(agent.id, 2);

      const stats = agentManager.getAgentStats(agent.id);

      expect(stats.id).toBe(agent.id);
      expect(stats.currentTaskCount).toBe(2);
      expect(stats.utilizationPercent).toBe(200); // 2/1 * 100
    });

    it('should return manager statistics', () => {
      agentManager.registerAgent({
        name: 'Agent1',
        capabilities: [AgentCapabilities.GENERIC]
      });

      agentManager.createTask({ type: 'test1' });
      agentManager.createTask({ type: 'test2' });

      const stats = agentManager.getStats();

      expect(stats.agents).toBeDefined();
      expect(stats.agents.total).toBe(1);
      expect(stats.tasks.total).toBe(2);
      expect(stats.tasks.pending).toBe(2);
      expect(stats.loadBalancingStrategy).toBe(LoadBalancingStrategy.LEAST_LOADED);
    });
  });

  describe('Task Retrieval', () => {
    it('should get task by ID', () => {
      const task = agentManager.createTask({ type: 'test' });

      const retrieved = agentManager.getTask(task.id);

      expect(retrieved).toBe(task);
    });

    it('should get all tasks', () => {
      agentManager.createTask({ type: 'test1' });
      agentManager.createTask({ type: 'test2' });

      const allTasks = agentManager.getAllTasks();

      expect(allTasks).toHaveLength(2);
    });

    it('should get tasks by status', () => {
      agentManager.createTask({ type: 'test1' });
      const task2 = agentManager.createTask({ type: 'test2' });
      task2.status = TaskStatus.COMPLETED;

      const pendingTasks = agentManager.getTasksByStatus(TaskStatus.PENDING);
      const completedTasks = agentManager.getTasksByStatus(TaskStatus.COMPLETED);

      expect(pendingTasks).toHaveLength(1);
      expect(completedTasks).toHaveLength(1);
    });
  });
});
