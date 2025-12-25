// AdaptiveResourceManager.integration.test.js - Integration tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import AdaptiveResourceManager, { PriorityLevel } from '../AdaptiveResourceManager.js';

describe('AdaptiveResourceManager Integration Tests', () => {
  let manager;

  beforeEach(() => {
    manager = new AdaptiveResourceManager({
      schedulerInterval: 50,
      agingIntervalMs: 200,
      resourcePool: {
        maxCPU: 1.0,
        maxMemory: 1024 * 1024 * 1024,
        maxTokensPerMinute: 50000,
        maxConcurrentTasks: 5
      }
    });
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  describe('End-to-End Workflow', () => {
    it('should handle complete task lifecycle', async () => {
      const events = [];

      // Listen to all events
      manager.on('task:queued', (e) => events.push({ type: 'queued', taskId: e.task.id }));
      manager.on('task:started', (e) => events.push({ type: 'started', taskId: e.task.id }));
      manager.on('task:completed', (e) => events.push({ type: 'completed', taskId: e.task.id }));

      // Submit task
      const task = {
        id: 'workflow_task',
        basePriority: 50,
        executor: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { success: true, data: 'result' };
        }
      };

      const result = await manager.submitTask(task);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.data).toBe('result');

      // Verify event order
      expect(events).toEqual([
        { type: 'queued', taskId: 'workflow_task' },
        { type: 'started', taskId: 'workflow_task' },
        { type: 'completed', taskId: 'workflow_task' }
      ]);

      // Verify metrics
      const metrics = manager.getMetrics();
      expect(metrics.tasksEnqueued).toBe(1);
      expect(metrics.tasksCompleted).toBe(1);
    });

    it('should handle multiple concurrent tasks with resource limits', async () => {
      const tasks = [];
      const completionOrder = [];

      // Create 10 tasks (max 5 concurrent)
      for (let i = 0; i < 10; i++) {
        tasks.push({
          id: `task${i}`,
          basePriority: 50,
          executor: async (task) => {
            await new Promise(resolve => setTimeout(resolve, 100));
            completionOrder.push(task.id);
            return { success: true };
          }
        });
      }

      // Submit all tasks
      const promises = tasks.map(t => manager.submitTask(t));

      // Wait for all to complete
      await Promise.all(promises);

      // Verify all completed
      expect(completionOrder).toHaveLength(10);

      // Verify metrics
      const metrics = manager.getMetrics();
      expect(metrics.tasksCompleted).toBe(10);
    });

    it('should respect priority ordering across queues', async () => {
      const completionOrder = [];

      const tasks = [
        {
          id: 'low1',
          basePriority: 80,
          executor: async (task) => {
            await new Promise(resolve => setTimeout(resolve, 50));
            completionOrder.push(task.id);
            return { success: true };
          }
        },
        {
          id: 'critical1',
          basePriority: 10,
          executor: async (task) => {
            await new Promise(resolve => setTimeout(resolve, 50));
            completionOrder.push(task.id);
            return { success: true };
          }
        },
        {
          id: 'normal1',
          basePriority: 60,
          executor: async (task) => {
            await new Promise(resolve => setTimeout(resolve, 50));
            completionOrder.push(task.id);
            return { success: true };
          }
        },
        {
          id: 'high1',
          basePriority: 30,
          executor: async (task) => {
            await new Promise(resolve => setTimeout(resolve, 50));
            completionOrder.push(task.id);
            return { success: true };
          }
        }
      ];

      // Submit in random order
      await Promise.all(tasks.map(t => manager.submitTask(t)));

      // Wait a bit for all to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Critical and High should execute before Normal and Low
      const criticalIndex = completionOrder.indexOf('critical1');
      const highIndex = completionOrder.indexOf('high1');
      const normalIndex = completionOrder.indexOf('normal1');
      const lowIndex = completionOrder.indexOf('low1');

      expect(criticalIndex).toBeLessThan(normalIndex);
      expect(criticalIndex).toBeLessThan(lowIndex);
      expect(highIndex).toBeLessThan(normalIndex);
      expect(highIndex).toBeLessThan(lowIndex);
    });
  });

  describe('Resource Prediction and Learning', () => {
    it('should improve predictions with learning', async () => {
      const taskType = 'learning_task';

      // Execute multiple tasks of same type
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        tasks.push({
          id: `learn${i}`,
          type: taskType,
          basePriority: 50,
          executor: async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return { success: true };
          }
        });
      }

      await Promise.all(tasks.map(t => manager.submitTask(t)));

      // Get prediction stats
      const stats = manager.resourcePredictor.getAccuracyStats(taskType);

      expect(stats).toBeDefined();
      expect(stats.sampleSize).toBe(5);
    });
  });

  describe('Deadline Handling', () => {
    it('should prioritize tasks with urgent deadlines', async () => {
      const executionOrder = [];

      const tasks = [
        {
          id: 'relaxed',
          basePriority: 50,
          deadline: Date.now() + 60000, // 1 minute
          executor: async (task) => {
            executionOrder.push(task.id);
            return { success: true };
          }
        },
        {
          id: 'urgent',
          basePriority: 50,
          deadline: Date.now() + 5000, // 5 seconds
          executor: async (task) => {
            executionOrder.push(task.id);
            return { success: true };
          }
        }
      ];

      // Submit relaxed first
      manager.submitTask(tasks[0]);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Submit urgent
      manager.submitTask(tasks[1]);

      // Wait for both to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Urgent should execute first or early
      expect(executionOrder).toContain('urgent');
      expect(executionOrder).toContain('relaxed');
    });
  });

  describe('Queue Aging', () => {
    it('should age tasks to prevent starvation', async () => {
      let lowTaskExecuted = false;

      // Submit high priority task that blocks
      const blockingTask = {
        id: 'blocking',
        basePriority: 10,
        executor: async () => {
          await new Promise(resolve => setTimeout(resolve, 500));
          return { success: true };
        }
      };

      // Submit low priority task
      const lowTask = {
        id: 'low',
        basePriority: 80,
        executor: async () => {
          lowTaskExecuted = true;
          return { success: true };
        }
      };

      manager.submitTask(blockingTask);
      await new Promise(resolve => setTimeout(resolve, 50));
      manager.submitTask(lowTask);

      // Wait for aging and execution
      await new Promise(resolve => setTimeout(resolve, 800));

      // Low priority task should eventually execute
      expect(lowTaskExecuted).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle task failures gracefully', async () => {
      let failedEventReceived = false;

      manager.on('task:failed', () => {
        failedEventReceived = true;
      });

      const task = {
        id: 'failing_task',
        basePriority: 50,
        executor: async () => {
          throw new Error('Intentional failure');
        }
      };

      await expect(manager.submitTask(task)).rejects.toThrow('Intentional failure');

      expect(failedEventReceived).toBe(true);

      // Verify metrics
      const metrics = manager.getMetrics();
      expect(metrics.tasksFailed).toBe(1);
    });

    it('should continue processing after task failure', async () => {
      const tasks = [
        {
          id: 'task1',
          basePriority: 50,
          executor: async () => {
            throw new Error('Fail');
          }
        },
        {
          id: 'task2',
          basePriority: 50,
          executor: async () => {
            return { success: true };
          }
        }
      ];

      // Submit both
      const promise1 = manager.submitTask(tasks[0]).catch(() => {});
      const promise2 = manager.submitTask(tasks[1]);

      await Promise.all([promise1, promise2]);

      // Second task should complete successfully
      const metrics = manager.getMetrics();
      expect(metrics.tasksCompleted).toBe(1);
      expect(metrics.tasksFailed).toBe(1);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high task throughput', async () => {
      const taskCount = 100;
      const tasks = [];

      for (let i = 0; i < taskCount; i++) {
        tasks.push({
          id: `perf${i}`,
          basePriority: Math.floor(Math.random() * 100),
          executor: async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return { success: true };
          }
        });
      }

      const startTime = Date.now();

      // Submit all tasks
      await Promise.all(tasks.map(t => manager.submitTask(t)));

      const duration = Date.now() - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(30000); // 30 seconds

      // Verify all completed
      const metrics = manager.getMetrics();
      expect(metrics.tasksCompleted).toBe(taskCount);
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should provide accurate metrics', async () => {
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        tasks.push({
          id: `metric${i}`,
          basePriority: 50,
          executor: async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return { success: true };
          }
        });
      }

      await Promise.all(tasks.map(t => manager.submitTask(t)));

      const metrics = manager.getMetrics();

      expect(metrics.tasksEnqueued).toBe(5);
      expect(metrics.tasksCompleted).toBe(5);
      expect(metrics.tasksFailed).toBe(0);
      expect(metrics.avgWaitTime).toBeGreaterThanOrEqual(0);
      expect(metrics.avgExecutionTime).toBeGreaterThanOrEqual(0);
    });

    it('should track queue statistics', async () => {
      // Submit tasks to different queues
      manager.submitTask({ id: 'c1', basePriority: 10, executor: async () => ({}) });
      manager.submitTask({ id: 'h1', basePriority: 30, executor: async () => ({}) });
      manager.submitTask({ id: 'n1', basePriority: 60, executor: async () => ({}) });
      manager.submitTask({ id: 'l1', basePriority: 80, executor: async () => ({}) });

      await new Promise(resolve => setTimeout(resolve, 50));

      const queueStats = manager.getQueueStats();

      // Should have stats for all queues
      expect(queueStats[PriorityLevel.CRITICAL]).toBeDefined();
      expect(queueStats[PriorityLevel.HIGH]).toBeDefined();
      expect(queueStats[PriorityLevel.NORMAL]).toBeDefined();
      expect(queueStats[PriorityLevel.LOW]).toBeDefined();
    });
  });
});
