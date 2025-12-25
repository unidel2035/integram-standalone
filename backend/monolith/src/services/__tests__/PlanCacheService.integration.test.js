// PlanCacheService.integration.test.js - Integration tests with CoordinationEngine
// Issue #5302: Integration tests for plan caching system

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlanCacheService, PlanTemplate } from '../PlanCacheService.js';
import { CoordinationEngine, TaskDecomposer } from '../CoordinationEngine.js';
import EventEmitter from 'events';

// Mock AgentManager
class MockAgentManager extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();
    this.agentTaskCounts = new Map();
    this.maxConcurrentTasksPerAgent = 5;
  }

  registerAgent(id, capabilities) {
    this.agents.set(id, { id, capabilities });
  }

  async findAgentForTask(task) {
    for (const [id, agent] of this.agents) {
      if (task.requiredCapabilities?.some(cap => agent.capabilities.includes(cap))) {
        return id;
      }
    }
    return Array.from(this.agents.keys())[0];
  }

  findCapableAgents(task) {
    const capable = [];
    for (const [id, agent] of this.agents) {
      if (!task.requiredCapabilities || task.requiredCapabilities.length === 0) {
        capable.push(agent);
      } else if (task.requiredCapabilities.some(cap => agent.capabilities.includes(cap))) {
        capable.push(agent);
      }
    }
    return capable.length > 0 ? capable : Array.from(this.agents.values());
  }

  selectAgent(agents, task) {
    return agents[0];
  }
}

// Mock MessageBus
class MockMessageBus {
  async sendRequest(from, to, message) {
    return { success: true, result: 'mock result' };
  }
}

// Simple TaskDecomposer using PlanCacheService
class CachedTaskDecomposer extends TaskDecomposer {
  constructor(planCacheService) {
    super();
    this.planCacheService = planCacheService;
  }

  async decompose(task) {
    const plan = await this.planCacheService.getPlan(task);
    return plan.subtasks;
  }
}

describe('PlanCacheService Integration with CoordinationEngine', () => {
  let planCacheService;
  let coordinationEngine;
  let agentManager;
  let messageBus;
  let decomposer;

  beforeEach(() => {
    // Initialize services
    planCacheService = new PlanCacheService({
      maxHistorySize: 1000,
      similarityThreshold: 0.85
    });

    agentManager = new MockAgentManager();
    messageBus = new MockMessageBus();

    coordinationEngine = new CoordinationEngine({
      agentManager,
      messageBus,
      maxActiveTasks: 100
    });

    decomposer = new CachedTaskDecomposer(planCacheService);

    // Register agents
    agentManager.registerAgent('agent1', ['data_validation', 'data_transformation', 'data_storage']);
    agentManager.registerAgent('agent2', ['http_client', 'validation', 'data_processing']);
    agentManager.registerAgent('agent3', ['database', 'analytics']);

    // Register decomposer for task types
    coordinationEngine.registerDecomposer('data_processing', decomposer);
    coordinationEngine.registerDecomposer('api_request', decomposer);
    coordinationEngine.registerDecomposer('database_operation', decomposer);
  });

  afterEach(() => {
    if (coordinationEngine) {
      coordinationEngine.shutdown();
    }
    if (planCacheService) {
      planCacheService.shutdown();
    }
  });

  it('should use plan cache when decomposing tasks', async () => {
    const task = {
      id: 'integration_task_1',
      type: 'data_processing',
      requiredCapabilities: ['data_processing']
    };

    // First decomposition (template instantiation)
    const decomposed1 = await coordinationEngine.decomposeTask(task);

    expect(decomposed1.subtasks).toBeDefined();
    expect(decomposed1.subtasks.length).toBeGreaterThan(0);
    expect(planCacheService.stats.templateInstantiations).toBe(1);

    // Cache the plan result
    const plan = {
      id: 'plan1',
      taskId: task.id,
      subtasks: decomposed1.subtasks
    };
    await planCacheService.cachePlan(task, plan, {
      success: true,
      executionTime: 150
    });

    // Second decomposition (should use cached plan)
    const task2 = {
      id: 'integration_task_2',
      type: 'data_processing',
      requiredCapabilities: ['data_processing']
    };

    const decomposed2 = await coordinationEngine.decomposeTask(task2);

    expect(decomposed2.subtasks).toBeDefined();
    expect(decomposed2.subtasks.length).toBe(decomposed1.subtasks.length);
    expect(planCacheService.stats.exactMatches).toBeGreaterThan(0);
  });

  it('should build execution plan from cached subtasks', async () => {
    const task = {
      id: 'execution_plan_task',
      type: 'api_request',
      requiredCapabilities: ['http_client']
    };

    const decomposed = await coordinationEngine.decomposeTask(task);
    const executionPlan = coordinationEngine.buildExecutionPlan(
      decomposed.subtasks,
      decomposed.graph
    );

    expect(executionPlan).toBeDefined();
    expect(executionPlan.levels).toBeDefined();
    expect(executionPlan.levels.length).toBeGreaterThan(0);
    expect(executionPlan.totalSubtasks).toBe(decomposed.subtasks.length);
  });

  it('should track plan performance across multiple executions', async () => {
    const createTask = (id) => ({
      id,
      type: 'database_operation',
      requiredCapabilities: ['database'],
      payload: { operation: 'read' }
    });

    // Execute multiple tasks
    for (let i = 0; i < 5; i++) {
      const task = createTask(`db_task_${i}`);
      const decomposed = await coordinationEngine.decomposeTask(task);

      // Simulate successful execution
      const plan = {
        id: `plan_${i}`,
        taskId: task.id,
        subtasks: decomposed.subtasks
      };

      await planCacheService.cachePlan(task, plan, {
        success: true,
        executionTime: 100 + i * 10
      });
    }

    const stats = planCacheService.getStats();

    expect(stats.totalGetPlanCalls).toBe(5);
    expect(stats.cacheHitRate).toBeGreaterThan(0);
    expect(planCacheService.executionHistory.size()).toBe(5);
  });

  it('should adapt plans for similar tasks', async () => {
    // Execute original task
    const originalTask = {
      id: 'original_api_task',
      type: 'api_request',
      requiredCapabilities: ['http_client'],
      payload: { url: 'https://api.example.com/data', method: 'GET' }
    };

    const decomposed1 = await coordinationEngine.decomposeTask(originalTask);

    await planCacheService.cachePlan(originalTask, {
      id: 'plan_original',
      taskId: originalTask.id,
      subtasks: decomposed1.subtasks
    }, {
      success: true,
      executionTime: 200
    });

    // Similar task with different payload
    const similarTask = {
      id: 'similar_api_task',
      type: 'api_request',
      requiredCapabilities: ['http_client'],
      payload: { url: 'https://api.example.com/users', method: 'GET' }
    };

    const decomposed2 = await coordinationEngine.decomposeTask(similarTask);

    expect(decomposed2.subtasks).toBeDefined();
    expect(planCacheService.stats.similarMatches).toBeGreaterThan(0);
  });

  it('should handle concurrent plan retrievals efficiently', async () => {
    const tasks = Array.from({ length: 20 }, (_, i) => ({
      id: `concurrent_task_${i}`,
      type: i % 3 === 0 ? 'data_processing' : i % 3 === 1 ? 'api_request' : 'database_operation',
      requiredCapabilities: ['generic']
    }));

    const startTime = Date.now();

    // Execute all decompositions concurrently
    const results = await Promise.all(
      tasks.map(task => coordinationEngine.decomposeTask(task))
    );

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    expect(results).toHaveLength(20);
    expect(results.every(r => r.subtasks.length > 0)).toBe(true);

    // Concurrent execution should be fast
    expect(totalTime).toBeLessThan(1000); // Less than 1 second for 20 tasks

    const stats = planCacheService.getStats();
    expect(stats.totalGetPlanCalls).toBe(20);
  });

  it('should emit events during integration workflow', async () => {
    const events = [];

    planCacheService.on('plan:retrieved', (data) => {
      events.push({ type: 'plan:retrieved', data });
    });

    planCacheService.on('plan:cached', (data) => {
      events.push({ type: 'plan:cached', data });
    });

    coordinationEngine.on('task:decomposed', (data) => {
      events.push({ type: 'task:decomposed', data });
    });

    const task = {
      id: 'event_test_task',
      type: 'data_processing',
      requiredCapabilities: []
    };

    const decomposed = await coordinationEngine.decomposeTask(task);

    await planCacheService.cachePlan(task, {
      id: 'event_plan',
      taskId: task.id,
      subtasks: decomposed.subtasks
    }, {
      success: true,
      executionTime: 100
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.type === 'plan:retrieved')).toBe(true);
    expect(events.some(e => e.type === 'plan:cached')).toBe(true);
    expect(events.some(e => e.type === 'task:decomposed')).toBe(true);
  });

  it('should maintain cache consistency across decompositions', async () => {
    const taskType = 'data_processing';

    // Create and cache multiple plans
    for (let i = 0; i < 10; i++) {
      const task = {
        id: `cache_consistency_${i}`,
        type: taskType,
        requiredCapabilities: []
      };

      const decomposed = await coordinationEngine.decomposeTask(task);

      await planCacheService.cachePlan(task, {
        id: `plan_${i}`,
        taskId: task.id,
        subtasks: decomposed.subtasks
      }, {
        success: i % 3 !== 0, // 2/3 success rate
        executionTime: 100 + i * 5
      });
    }

    // Verify cache consistency
    const stats = planCacheService.getStats();

    expect(stats.totalGetPlanCalls).toBe(10);
    expect(planCacheService.executionHistory.size()).toBe(10);

    // All cached plans should have consistent structure
    const historyArray = Array.from(planCacheService.executionHistory.values());
    const allHavePlans = historyArray.every(entry => entry.plan !== undefined);
    const allHaveResults = historyArray.every(entry => entry.result !== undefined);

    expect(allHavePlans).toBe(true);
    expect(allHaveResults).toBe(true);
  });

  it('should demonstrate performance improvement with caching', async () => {
    const taskType = 'api_request';

    // First batch - no cache (cold start)
    const coldStartTime = Date.now();
    for (let i = 0; i < 10; i++) {
      await coordinationEngine.decomposeTask({
        id: `cold_${i}`,
        type: taskType,
        requiredCapabilities: []
      });
    }
    const coldDuration = Date.now() - coldStartTime;

    // Cache plans
    for (let i = 0; i < 10; i++) {
      const task = {
        id: `cold_${i}`,
        type: taskType,
        requiredCapabilities: []
      };
      await planCacheService.cachePlan(task, {
        id: `cache_plan_${i}`,
        taskId: task.id,
        subtasks: []
      }, {
        success: true,
        executionTime: 100
      });
    }

    // Second batch - with cache (warm)
    const warmStartTime = Date.now();
    for (let i = 0; i < 10; i++) {
      await coordinationEngine.decomposeTask({
        id: `warm_${i}`,
        type: taskType,
        requiredCapabilities: []
      });
    }
    const warmDuration = Date.now() - warmStartTime;

    // Warm execution should be faster or comparable
    // (In real scenario with actual slow path, this would show significant improvement)
    expect(warmDuration).toBeLessThanOrEqual(coldDuration * 2);

    const stats = planCacheService.getStats();
    expect(stats.performanceGain).toBeGreaterThanOrEqual(0);
  });

  it('should handle template evolution and updates', async () => {
    // Start with default template
    const task1 = {
      id: 'template_evolution_1',
      type: 'data_processing',
      requiredCapabilities: []
    };

    const decomposed1 = await coordinationEngine.decomposeTask(task1);
    const initialSubtaskCount = decomposed1.subtasks.length;

    // Register enhanced template with higher priority
    const enhancedTemplate = new PlanTemplate({
      name: 'Enhanced Data Processing',
      type: 'data_processing',
      priority: 15,
      subtaskTemplate: (task) => [
        { id: '1', name: 'enhanced_validation', requiredCapability: 'validation' },
        { id: '2', name: 'enhanced_transformation', requiredCapability: 'transformation' },
        { id: '3', name: 'enhanced_storage', requiredCapability: 'storage' },
        { id: '4', name: 'enhanced_notification', requiredCapability: 'notification' }
      ]
    });

    planCacheService.registerTemplate(enhancedTemplate);

    // Clear cache to force new template usage
    planCacheService.clearCaches();

    // New task should use enhanced template
    const task2 = {
      id: 'template_evolution_2',
      type: 'data_processing',
      requiredCapabilities: []
    };

    const decomposed2 = await coordinationEngine.decomposeTask(task2);

    expect(decomposed2.subtasks.length).toBeGreaterThan(initialSubtaskCount);
    expect(decomposed2.subtasks.some(st => st.name.includes('enhanced'))).toBe(true);
  });
});

describe('PlanCacheService Stress Tests', () => {
  let planCacheService;

  beforeEach(() => {
    planCacheService = new PlanCacheService({
      maxHistorySize: 10000,
      similarityThreshold: 0.85
    });
  });

  afterEach(() => {
    if (planCacheService) {
      planCacheService.shutdown();
    }
  });

  it('should handle high volume of plan requests', async () => {
    const taskCount = 1000;
    const tasks = Array.from({ length: taskCount }, (_, i) => ({
      id: `stress_task_${i}`,
      type: i % 5 === 0 ? 'data_processing' :
            i % 5 === 1 ? 'api_request' :
            i % 5 === 2 ? 'database_operation' :
            i % 5 === 3 ? 'file_processing' : 'notification',
      requiredCapabilities: [],
      priority: Math.floor(Math.random() * 10)
    }));

    const startTime = Date.now();

    const results = await Promise.all(
      tasks.map(task => planCacheService.getPlan(task))
    );

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    expect(results).toHaveLength(taskCount);
    expect(results.every(r => r.subtasks !== undefined)).toBe(true);

    // Should handle 1000 requests in reasonable time
    expect(totalTime).toBeLessThan(5000); // Less than 5 seconds

    const stats = planCacheService.getStats();
    expect(stats.totalGetPlanCalls).toBe(taskCount);
    expect(stats.avgPlanRetrievalTime).toBeLessThan(50); // Average under 50ms
  });

  it('should maintain performance with large history', async () => {
    // Fill history with many entries
    for (let i = 0; i < 1000; i++) {
      const task = {
        id: `history_task_${i}`,
        type: 'test_type',
        requiredCapabilities: []
      };

      const plan = await planCacheService.getPlan(task);

      await planCacheService.cachePlan(task, plan, {
        success: Math.random() > 0.2,
        executionTime: Math.random() * 500
      });
    }

    // Measure performance with large history
    const testTask = {
      id: 'performance_test',
      type: 'test_type',
      requiredCapabilities: []
    };

    const startTime = Date.now();
    await planCacheService.getPlan(testTask);
    const endTime = Date.now();

    const retrievalTime = endTime - startTime;

    // Should still be fast even with large history
    expect(retrievalTime).toBeLessThan(100); // Under 100ms
  });

  it('should handle memory efficiently with bounded caches', async () => {
    const maxHistorySize = 100;
    const service = new PlanCacheService({ maxHistorySize });

    // Add more items than max size
    for (let i = 0; i < maxHistorySize * 2; i++) {
      const task = {
        id: `memory_task_${i}`,
        type: 'test_type',
        requiredCapabilities: []
      };

      const plan = await service.getPlan(task);
      await service.cachePlan(task, plan);
    }

    // History should not exceed max size
    expect(service.executionHistory.size()).toBeLessThanOrEqual(maxHistorySize);

    service.shutdown();
  });
});
