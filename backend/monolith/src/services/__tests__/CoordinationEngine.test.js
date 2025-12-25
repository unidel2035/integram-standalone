// CoordinationEngine.test.js - Unit tests for CoordinationEngine
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CoordinationEngine,
  TaskDecomposer,
  CoordinatedTaskStatus,
  SubtaskStatus
} from '../CoordinationEngine.js';
import { Graph } from 'graphlib';

// Mock dependencies
const createMockAgentManager = () => ({
  findAgentForTask: vi.fn().mockResolvedValue('mock-agent-id')
});

const createMockMessageBus = () => ({
  sendRequest: vi.fn().mockResolvedValue({ success: true, data: 'mock-result' })
});

// Mock TaskDecomposer implementation
class MockTaskDecomposer extends TaskDecomposer {
  async decompose(task) {
    // Simple decomposition: 3 subtasks with linear dependencies
    return [
      {
        id: 'subtask-1',
        type: 'fetch_data',
        requiredCapability: 'data_fetching',
        dependencies: [],
        compensationAction: 'delete_cached_data'
      },
      {
        id: 'subtask-2',
        type: 'analyze_data',
        requiredCapability: 'data_analysis',
        dependencies: ['subtask-1'],
        compensationAction: 'clear_analysis'
      },
      {
        id: 'subtask-3',
        type: 'generate_report',
        requiredCapability: 'report_generation',
        dependencies: ['subtask-2'],
        compensationAction: 'delete_report'
      }
    ];
  }
}

// Mock TaskDecomposer with parallel tasks
class ParallelTaskDecomposer extends TaskDecomposer {
  async decompose(task) {
    // Decomposition with parallel branches
    return [
      {
        id: 'subtask-1',
        type: 'fetch_sales',
        requiredCapability: 'data_fetching',
        dependencies: [],
        compensationAction: null
      },
      {
        id: 'subtask-2',
        type: 'fetch_inventory',
        requiredCapability: 'data_fetching',
        dependencies: [],
        compensationAction: null
      },
      {
        id: 'subtask-3',
        type: 'analyze_sales',
        requiredCapability: 'data_analysis',
        dependencies: ['subtask-1'],
        compensationAction: null
      },
      {
        id: 'subtask-4',
        type: 'analyze_inventory',
        requiredCapability: 'data_analysis',
        dependencies: ['subtask-2'],
        compensationAction: null
      },
      {
        id: 'subtask-5',
        type: 'generate_report',
        requiredCapability: 'report_generation',
        dependencies: ['subtask-3', 'subtask-4'],
        compensationAction: 'delete_report'
      }
    ];
  }
}

// Mock TaskDecomposer with cyclic dependencies (invalid)
class CyclicTaskDecomposer extends TaskDecomposer {
  async decompose(task) {
    return [
      {
        id: 'subtask-1',
        type: 'task_a',
        requiredCapability: 'capability_a',
        dependencies: ['subtask-2'],
        compensationAction: null
      },
      {
        id: 'subtask-2',
        type: 'task_b',
        requiredCapability: 'capability_b',
        dependencies: ['subtask-1'],
        compensationAction: null
      }
    ];
  }
}

describe('CoordinationEngine', () => {
  let coordinationEngine;
  let mockAgentManager;
  let mockMessageBus;

  beforeEach(() => {
    mockAgentManager = createMockAgentManager();
    mockMessageBus = createMockMessageBus();

    coordinationEngine = new CoordinationEngine({
      agentManager: mockAgentManager,
      messageBus: mockMessageBus,
      maxActiveTasks: 100,
      subtaskTimeout: 5000
    });
  });

  afterEach(async () => {
    await coordinationEngine.shutdown();
  });

  describe('Constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(coordinationEngine).toBeDefined();
      expect(coordinationEngine.agentManager).toBe(mockAgentManager);
      expect(coordinationEngine.messageBus).toBe(mockMessageBus);
    });

    it('should throw error if agentManager is missing', () => {
      expect(() => {
        new CoordinationEngine({
          messageBus: mockMessageBus
        });
      }).toThrow('CoordinationEngine requires agentManager');
    });

    it('should throw error if messageBus is missing', () => {
      expect(() => {
        new CoordinationEngine({
          agentManager: mockAgentManager
        });
      }).toThrow('CoordinationEngine requires messageBus');
    });
  });

  describe('Task Decomposer Registration', () => {
    it('should register task decomposer', () => {
      const decomposer = new MockTaskDecomposer();
      coordinationEngine.registerDecomposer('test_task', decomposer);

      expect(coordinationEngine.decomposers.has('test_task')).toBe(true);
    });

    it('should throw error if decomposer is not TaskDecomposer instance', () => {
      expect(() => {
        coordinationEngine.registerDecomposer('test_task', {});
      }).toThrow('Decomposer must be an instance of TaskDecomposer');
    });
  });

  describe('Task Decomposition', () => {
    beforeEach(() => {
      const decomposer = new MockTaskDecomposer();
      coordinationEngine.registerDecomposer('test_task', decomposer);
    });

    it('should decompose task into subtasks', async () => {
      const task = {
        id: 'task-123',
        type: 'test_task',
        parameters: { foo: 'bar' }
      };

      const decomposed = await coordinationEngine.decomposeTask(task);

      expect(decomposed).toBeDefined();
      expect(decomposed.taskId).toBe('task-123');
      expect(decomposed.subtasks).toHaveLength(3);
      expect(decomposed.graph).toBeInstanceOf(Graph);
      expect(decomposed.status).toBe(CoordinatedTaskStatus.PENDING);
    });

    it('should build dependency graph correctly', async () => {
      const task = {
        id: 'task-123',
        type: 'test_task',
        parameters: {}
      };

      const decomposed = await coordinationEngine.decomposeTask(task);
      const graph = decomposed.graph;

      // Check nodes
      expect(graph.nodes()).toHaveLength(3);
      expect(graph.hasNode('subtask-1')).toBe(true);
      expect(graph.hasNode('subtask-2')).toBe(true);
      expect(graph.hasNode('subtask-3')).toBe(true);

      // Check edges (dependencies)
      expect(graph.hasEdge('subtask-1', 'subtask-2')).toBe(true);
      expect(graph.hasEdge('subtask-2', 'subtask-3')).toBe(true);
    });

    it('should throw error for cyclic dependencies', async () => {
      const cyclicDecomposer = new CyclicTaskDecomposer();
      coordinationEngine.registerDecomposer('cyclic_task', cyclicDecomposer);

      const task = {
        id: 'task-123',
        type: 'cyclic_task',
        parameters: {}
      };

      await expect(coordinationEngine.decomposeTask(task)).rejects.toThrow(
        'Subtask dependency graph contains cycles'
      );
    });

    it('should throw error if decomposer not registered', async () => {
      const task = {
        id: 'task-123',
        type: 'unknown_task',
        parameters: {}
      };

      await expect(coordinationEngine.decomposeTask(task)).rejects.toThrow(
        'No decomposer registered for task type: unknown_task'
      );
    });
  });

  describe('Execution Plan Building', () => {
    it('should build execution plan with correct levels (linear dependencies)', async () => {
      const decomposer = new MockTaskDecomposer();
      coordinationEngine.registerDecomposer('test_task', decomposer);

      const task = { id: 'task-123', type: 'test_task', parameters: {} };
      const decomposed = await coordinationEngine.decomposeTask(task);

      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      expect(plan).toBeDefined();
      expect(plan.levels).toHaveLength(3);
      expect(plan.totalSubtasks).toBe(3);
      expect(plan.executionOrder).toHaveLength(3);

      // Level 0: subtask-1 (no dependencies)
      expect(plan.levels[0]).toHaveLength(1);
      expect(plan.levels[0][0].id).toBe('subtask-1');

      // Level 1: subtask-2 (depends on subtask-1)
      expect(plan.levels[1]).toHaveLength(1);
      expect(plan.levels[1][0].id).toBe('subtask-2');

      // Level 2: subtask-3 (depends on subtask-2)
      expect(plan.levels[2]).toHaveLength(1);
      expect(plan.levels[2][0].id).toBe('subtask-3');
    });

    it('should build execution plan with parallel levels', async () => {
      const parallelDecomposer = new ParallelTaskDecomposer();
      coordinationEngine.registerDecomposer('parallel_task', parallelDecomposer);

      const task = { id: 'task-123', type: 'parallel_task', parameters: {} };
      const decomposed = await coordinationEngine.decomposeTask(task);

      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      expect(plan.levels).toHaveLength(3);

      // Level 0: subtask-1 and subtask-2 (can run in parallel)
      expect(plan.levels[0]).toHaveLength(2);
      const level0Ids = plan.levels[0].map(st => st.id);
      expect(level0Ids).toContain('subtask-1');
      expect(level0Ids).toContain('subtask-2');

      // Level 1: subtask-3 and subtask-4 (can run in parallel)
      expect(plan.levels[1]).toHaveLength(2);
      const level1Ids = plan.levels[1].map(st => st.id);
      expect(level1Ids).toContain('subtask-3');
      expect(level1Ids).toContain('subtask-4');

      // Level 2: subtask-5 (final task)
      expect(plan.levels[2]).toHaveLength(1);
      expect(plan.levels[2][0].id).toBe('subtask-5');
    });
  });

  describe('Coordinated Execution', () => {
    it('should execute coordinated workflow successfully', async () => {
      const decomposer = new MockTaskDecomposer();
      coordinationEngine.registerDecomposer('test_task', decomposer);

      const task = { id: 'task-123', type: 'test_task', parameters: {} };
      const decomposed = await coordinationEngine.decomposeTask(task);
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      const results = await coordinationEngine.executeCoordinated(task.id, plan);

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(3);
      expect(results.has('subtask-1')).toBe(true);
      expect(results.has('subtask-2')).toBe(true);
      expect(results.has('subtask-3')).toBe(true);

      // Verify agent manager was called to find agents
      expect(mockAgentManager.findAgentForTask).toHaveBeenCalledTimes(3);

      // Verify message bus was called to execute subtasks
      expect(mockMessageBus.sendRequest).toHaveBeenCalledTimes(3);
    });

    it('should emit coordination events', async () => {
      const decomposer = new MockTaskDecomposer();
      coordinationEngine.registerDecomposer('test_task', decomposer);

      const events = [];
      coordinationEngine.on('coordination:started', (e) => events.push(e));
      coordinationEngine.on('subtask:completed', (e) => events.push(e));
      coordinationEngine.on('coordination:completed', (e) => events.push(e));

      const task = { id: 'task-123', type: 'test_task', parameters: {} };
      const decomposed = await coordinationEngine.decomposeTask(task);
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      await coordinationEngine.executeCoordinated(task.id, plan);

      // Should have 1 started + 3 subtask completed + 1 completed = 5 events
      expect(events.length).toBe(5);
      expect(events[0].taskId).toBe('task-123');
      expect(events[events.length - 1]).toHaveProperty('results');
    });

    it('should track task status during execution', async () => {
      const decomposer = new MockTaskDecomposer();
      coordinationEngine.registerDecomposer('test_task', decomposer);

      const task = { id: 'task-123', type: 'test_task', parameters: {} };
      const decomposed = await coordinationEngine.decomposeTask(task);
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      // Start execution (don't await)
      const executionPromise = coordinationEngine.executeCoordinated(task.id, plan);

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      const status = coordinationEngine.getTaskStatus(task.id);
      expect(status).toBeDefined();
      expect(status.taskId).toBe('task-123');
      expect(status.totalSubtasks).toBe(3);
      expect(status.totalLevels).toBe(3);

      await executionPromise;

      const finalStatus = coordinationEngine.getTaskStatus(task.id);
      expect(finalStatus.status).toBe(CoordinatedTaskStatus.COMPLETED);
      expect(finalStatus.completedSubtasks).toBe(3);
    });
  });

  describe('Rollback and Compensation', () => {
    it('should rollback and execute compensation actions on failure', async () => {
      const decomposer = new MockTaskDecomposer();
      coordinationEngine.registerDecomposer('test_task', decomposer);

      // Make the second subtask fail
      mockMessageBus.sendRequest
        .mockResolvedValueOnce({ success: true }) // subtask-1 succeeds
        .mockRejectedValueOnce(new Error('Subtask failed')); // subtask-2 fails

      const task = { id: 'task-123', type: 'test_task', parameters: {} };
      const decomposed = await coordinationEngine.decomposeTask(task);
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      await expect(
        coordinationEngine.executeCoordinated(task.id, plan)
      ).rejects.toThrow();

      // After failure, rollback should have been called
      // Compensation should execute for subtask-1 (which succeeded)
      // We can verify this by checking if sendRequest was called for compensation
      const compensationCalls = mockMessageBus.sendRequest.mock.calls.filter(
        call => call[2].type === 'compensate'
      );
      expect(compensationCalls.length).toBeGreaterThan(0);
    });

    it('should emit rollback events', async () => {
      const decomposer = new MockTaskDecomposer();
      coordinationEngine.registerDecomposer('test_task', decomposer);

      const events = [];
      coordinationEngine.on('coordination:rollback:started', (e) => events.push(e));
      coordinationEngine.on('coordination:rollback:completed', (e) => events.push(e));

      mockMessageBus.sendRequest.mockRejectedValue(new Error('All subtasks fail'));

      const task = { id: 'task-123', type: 'test_task', parameters: {} };
      const decomposed = await coordinationEngine.decomposeTask(task);
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      await expect(
        coordinationEngine.executeCoordinated(task.id, plan)
      ).rejects.toThrow();

      expect(events.length).toBe(2);
      expect(events[0].taskId).toBe('task-123');
      expect(events[1].taskId).toBe('task-123');
    });

    it('should handle manual rollback', async () => {
      const decomposer = new MockTaskDecomposer();
      coordinationEngine.registerDecomposer('test_task', decomposer);

      const task = { id: 'task-123', type: 'test_task', parameters: {} };
      const decomposed = await coordinationEngine.decomposeTask(task);
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      // Execute successfully first
      await coordinationEngine.executeCoordinated(task.id, plan);

      // Manually trigger rollback
      await coordinationEngine.rollback(task.id);

      // Verify compensation was called for all subtasks
      const compensationCalls = mockMessageBus.sendRequest.mock.calls.filter(
        call => call[2].type === 'compensate'
      );
      expect(compensationCalls.length).toBe(3);
    });
  });

  describe('Subtask Completion Handling', () => {
    it('should handle subtask completion callback', async () => {
      const decomposer = new MockTaskDecomposer();
      coordinationEngine.registerDecomposer('test_task', decomposer);

      const task = { id: 'task-123', type: 'test_task', parameters: {} };
      const decomposed = await coordinationEngine.decomposeTask(task);
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      // Start execution without awaiting
      const executionPromise = coordinationEngine.executeCoordinated(task.id, plan);

      // Simulate external subtask completion callback
      coordinationEngine.handleSubtaskCompletion('subtask-1', { data: 'external result' });

      await executionPromise;

      // The external result should be stored
      const coordinatedTask = coordinationEngine.activeTasks.get(task.id);
      expect(coordinatedTask.results.get('subtask-1')).toBeDefined();
    });
  });

  describe('Active Tasks Management', () => {
    it('should list all active tasks', async () => {
      const decomposer = new MockTaskDecomposer();
      coordinationEngine.registerDecomposer('test_task', decomposer);

      const task1 = { id: 'task-1', type: 'test_task', parameters: {} };
      const task2 = { id: 'task-2', type: 'test_task', parameters: {} };

      const decomposed1 = await coordinationEngine.decomposeTask(task1);
      const decomposed2 = await coordinationEngine.decomposeTask(task2);

      const plan1 = coordinationEngine.buildExecutionPlan(
        decomposed1.subtasks,
        decomposed1.graph
      );
      const plan2 = coordinationEngine.buildExecutionPlan(
        decomposed2.subtasks,
        decomposed2.graph
      );

      // Start both (don't await)
      const promise1 = coordinationEngine.executeCoordinated(task1.id, plan1);
      const promise2 = coordinationEngine.executeCoordinated(task2.id, plan2);

      // Give them a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      const activeTasks = coordinationEngine.getActiveTasks();
      expect(activeTasks.length).toBeGreaterThanOrEqual(1); // At least one should be active

      await Promise.all([promise1, promise2]);
    });

    it('should return null for non-existent task status', () => {
      const status = coordinationEngine.getTaskStatus('non-existent-task');
      expect(status).toBeNull();
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout subtask execution', async () => {
      const decomposer = new MockTaskDecomposer();
      coordinationEngine.registerDecomposer('test_task', decomposer);

      // Make subtask hang
      mockMessageBus.sendRequest.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );

      const task = { id: 'task-123', type: 'test_task', parameters: {} };
      const decomposed = await coordinationEngine.decomposeTask(task);
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      await expect(
        coordinationEngine.executeCoordinated(task.id, plan)
      ).rejects.toThrow();
    }, 10000); // Increase test timeout
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await coordinationEngine.shutdown();
      expect(coordinationEngine.listenerCount('coordination:started')).toBe(0);
    });

    it('should wait for active tasks during shutdown', async () => {
      const decomposer = new MockTaskDecomposer();
      coordinationEngine.registerDecomposer('test_task', decomposer);

      const task = { id: 'task-123', type: 'test_task', parameters: {} };
      const decomposed = await coordinationEngine.decomposeTask(task);
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      // Start execution
      const executionPromise = coordinationEngine.executeCoordinated(task.id, plan);

      // Start shutdown (should wait)
      const shutdownPromise = coordinationEngine.shutdown();

      // Wait for both
      await Promise.all([executionPromise, shutdownPromise]);

      expect(coordinationEngine.activeTasks.size).toBe(0);
    }, 10000);
  });
});
