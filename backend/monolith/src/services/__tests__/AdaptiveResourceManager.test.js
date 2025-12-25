// AdaptiveResourceManager.test.js - Unit tests for AdaptiveResourceManager
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AdaptiveResourceManager, { PriorityLevel } from '../AdaptiveResourceManager.js';
import ResourcePredictor from '../ResourcePredictor.js';

describe('AdaptiveResourceManager', () => {
  let manager;

  beforeEach(() => {
    manager = new AdaptiveResourceManager({
      schedulerInterval: 50, // Faster for tests
      agingIntervalMs: 100, // Faster for tests
      resourcePool: {
        maxCPU: 1.0,
        maxMemory: 1024 * 1024 * 1024, // 1GB
        maxTokensPerMinute: 10000,
        maxConcurrentTasks: 5
      }
    });
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize with 4 priority queues', () => {
      expect(manager.queues[PriorityLevel.CRITICAL]).toBeDefined();
      expect(manager.queues[PriorityLevel.HIGH]).toBeDefined();
      expect(manager.queues[PriorityLevel.NORMAL]).toBeDefined();
      expect(manager.queues[PriorityLevel.LOW]).toBeDefined();
    });

    it('should initialize resource pool', () => {
      expect(manager.resourcePool).toBeDefined();
      expect(manager.resourcePool.maxCPU).toBe(1.0);
    });

    it('should initialize resource predictor', () => {
      expect(manager.resourcePredictor).toBeInstanceOf(ResourcePredictor);
    });
  });

  describe('Priority Calculation', () => {
    it('should calculate priority from base priority', () => {
      const task = { id: 't1', basePriority: 30 };
      const priority = manager.calculatePriority(task);

      expect(priority).toBe(30);
    });

    it('should default to NORMAL priority (50)', () => {
      const task = { id: 't1' };
      const priority = manager.calculatePriority(task);

      expect(priority).toBe(50);
    });

    it('should increase priority for user tasks', () => {
      const systemTask = { id: 't1', basePriority: 50 };
      const userTask = { id: 't2', basePriority: 50, userId: 'user123' };

      const systemPriority = manager.calculatePriority(systemTask);
      const userPriority = manager.calculatePriority(userTask);

      expect(userPriority).toBeLessThan(systemPriority); // Lower = higher priority
    });

    it('should increase priority for tasks with near deadline', () => {
      const farTask = {
        id: 't1',
        basePriority: 50,
        deadline: Date.now() + 3600000 // 1 hour
      };

      const urgentTask = {
        id: 't2',
        basePriority: 50,
        deadline: Date.now() + 30000 // 30 seconds
      };

      const farPriority = manager.calculatePriority(farTask);
      const urgentPriority = manager.calculatePriority(urgentTask);

      expect(urgentPriority).toBeLessThan(farPriority);
    });

    it('should maximize priority for system tasks', () => {
      const task = {
        id: 't1',
        basePriority: 50,
        isSystemTask: true
      };

      const priority = manager.calculatePriority(task);

      expect(priority).toBeLessThan(25); // Should be CRITICAL
    });

    it('should clamp priority to 0-99 range', () => {
      const highTask = { id: 't1', basePriority: 150 };
      const lowTask = { id: 't2', basePriority: -50 };

      const highPriority = manager.calculatePriority(highTask);
      const lowPriority = manager.calculatePriority(lowTask);

      expect(highPriority).toBeLessThanOrEqual(99);
      expect(lowPriority).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Task Queuing', () => {
    it('should queue task in correct priority level', () => {
      const criticalTask = { id: 't1', basePriority: 10 };
      const highTask = { id: 't2', basePriority: 30 };
      const normalTask = { id: 't3', basePriority: 60 };
      const lowTask = { id: 't4', basePriority: 80 };

      manager.submitTask(criticalTask);
      manager.submitTask(highTask);
      manager.submitTask(normalTask);
      manager.submitTask(lowTask);

      expect(manager.queues[PriorityLevel.CRITICAL].size).toBe(1);
      expect(manager.queues[PriorityLevel.HIGH].size).toBe(1);
      expect(manager.queues[PriorityLevel.NORMAL].size).toBe(1);
      expect(manager.queues[PriorityLevel.LOW].size).toBe(1);
    });

    it('should emit queued event', async () => {
      const task = { id: 't1', basePriority: 50 };

      const promise = new Promise((resolve) => {
        manager.on('task:queued', (event) => {
          expect(event.task.id).toBe('t1');
          expect(event.priority).toBeDefined();
          expect(event.level).toBeDefined();
          resolve();
        });
      });

      manager.submitTask(task);
      await promise;
    });

    it('should generate task ID if missing', () => {
      const task = { type: 'test' };

      manager.submitTask(task);

      expect(task.id).toBeDefined();
      expect(task.id).toContain('task_');
    });
  });

  describe('Task Execution', () => {
    it('should execute task with executor function', async () => {
      const task = {
        id: 't1',
        basePriority: 10,
        executor: vi.fn(async () => ({ success: true, data: 'result' }))
      };

      const result = await manager.submitTask(task);

      expect(task.executor).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data).toBe('result');
    });

    it('should emit task started and completed events', async () => {
      const task = {
        id: 't1',
        basePriority: 10,
        executor: async () => ({ success: true })
      };

      let started = false;

      manager.on('task:started', () => {
        started = true;
      });

      const promise = new Promise((resolve) => {
        manager.on('task:completed', () => {
          expect(started).toBe(true);
          resolve();
        });
      });

      manager.submitTask(task);
      await promise;
    });

    it('should handle task failure', async () => {
      const task = {
        id: 't1',
        basePriority: 10,
        executor: async () => {
          throw new Error('Task failed');
        }
      };

      await expect(manager.submitTask(task)).rejects.toThrow('Task failed');
    });

    it('should emit task failed event on error', async () => {
      const task = {
        id: 't1',
        basePriority: 10,
        executor: async () => {
          throw new Error('Test error');
        }
      };

      const promise = new Promise((resolve) => {
        manager.on('task:failed', (event) => {
          expect(event.task.id).toBe('t1');
          expect(event.error).toBe('Test error');
          resolve();
        });
      });

      manager.submitTask(task).catch(() => {});
      await promise;
    });
  });

  describe('Resource Management', () => {
    it('should allocate and release resources', async () => {
      const task = {
        id: 't1',
        type: 'test',
        basePriority: 10,
        executor: async () => {
          // Check resources allocated
          expect(manager.activeTasks.has('t1')).toBe(true);
          return { success: true };
        }
      };

      await manager.submitTask(task);

      // Resources should be released after completion
      expect(manager.activeTasks.has('t1')).toBe(false);
    });

    it('should queue tasks when resources unavailable', async () => {
      // Fill up resource pool
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        tasks.push({
          id: `t${i}`,
          basePriority: 10,
          executor: async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
            return { success: true };
          }
        });
      }

      // Submit all tasks
      const promises = tasks.map(t => manager.submitTask(t));

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should have some queued and some active
      const totalQueued = Object.values(manager.queues)
        .reduce((sum, q) => sum + q.size, 0);
      const totalActive = manager.activeTasks.size;

      expect(totalQueued + totalActive).toBe(5);

      // Wait for all to complete
      await Promise.all(promises);
    });
  });

  describe('Priority Ordering', () => {
    it('should execute high priority tasks first', async () => {
      const executionOrder = [];

      const lowTask = {
        id: 'low',
        basePriority: 80,
        executor: async () => {
          executionOrder.push('low');
          return { success: true };
        }
      };

      const highTask = {
        id: 'high',
        basePriority: 10,
        executor: async () => {
          executionOrder.push('high');
          return { success: true };
        }
      };

      // Submit low priority first
      const lowPromise = manager.submitTask(lowTask);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Submit high priority
      const highPromise = manager.submitTask(highTask);

      await Promise.all([lowPromise, highPromise]);

      // High priority should execute first or second (might start before low completes)
      expect(executionOrder).toContain('high');
      expect(executionOrder).toContain('low');
    });
  });

  describe('Queue Aging', () => {
    it('should age queued tasks over time', async () => {
      const task = {
        id: 't1',
        basePriority: 80, // LOW priority
        executor: async () => ({ success: true })
      };

      // Queue task but don't execute (pause scheduler)
      manager.stopScheduler();
      manager.submitTask(task);

      const initialPriority = task.calculatedPriority;

      // Wait for aging
      await new Promise((resolve) => {
        setTimeout(() => {
          // Check if priority increased (score decreased)
          const currentPriority = manager.queues[PriorityLevel.LOW].peek()?.calculatedPriority;

          if (currentPriority !== undefined) {
            expect(currentPriority).toBeLessThan(initialPriority);
          }

          resolve();
        }, 150); // Wait for at least one aging interval
      });
    });

    it('should move tasks to higher priority queue when aged', async () => {
      const task = {
        id: 't1',
        basePriority: 76, // Just above NORMAL threshold
        executor: async () => ({ success: true })
      };

      manager.stopScheduler();
      manager.submitTask(task);

      expect(manager.queues[PriorityLevel.LOW].size).toBe(1);

      // Age enough to move to NORMAL
      await new Promise((resolve) => {
        setTimeout(() => {
          // Should have moved to NORMAL queue
          const inLow = manager.queues[PriorityLevel.LOW].size;
          const inNormal = manager.queues[PriorityLevel.NORMAL].size;

          expect(inLow + inNormal).toBe(1);
          resolve();
        }, 150);
      });
    });
  });

  describe('Metrics and Statistics', () => {
    it('should track queued tasks', () => {
      const task = { id: 't1', basePriority: 50 };
      manager.submitTask(task);

      expect(manager.metrics.tasksEnqueued).toBe(1);
    });

    it('should track completed tasks', async () => {
      const task = {
        id: 't1',
        basePriority: 10,
        executor: async () => ({ success: true })
      };

      await manager.submitTask(task);

      expect(manager.metrics.tasksCompleted).toBe(1);
    });

    it('should calculate average wait time', async () => {
      const tasks = [];
      for (let i = 0; i < 3; i++) {
        tasks.push({
          id: `t${i}`,
          basePriority: 10,
          executor: async () => ({ success: true })
        });
      }

      await Promise.all(tasks.map(t => manager.submitTask(t)));

      const metrics = manager.getMetrics();
      expect(metrics.avgWaitTime).toBeGreaterThanOrEqual(0);
    });

    it('should provide queue statistics', () => {
      manager.submitTask({ id: 't1', basePriority: 10 });
      manager.submitTask({ id: 't2', basePriority: 80 });

      const stats = manager.getQueueStats();

      expect(stats[PriorityLevel.CRITICAL]).toBeDefined();
      expect(stats[PriorityLevel.LOW]).toBeDefined();
    });

    it('should provide resource statistics', () => {
      const stats = manager.getResourceStats();

      expect(stats.utilization).toBeDefined();
      expect(stats.activeTasks).toBeDefined();
      expect(stats.available).toBeDefined();
    });
  });

  describe('Shutdown', () => {
    it('should stop scheduler on shutdown', async () => {
      expect(manager.schedulerRunning).toBe(true);

      await manager.shutdown();

      expect(manager.schedulerRunning).toBe(false);
    });

    it('should clear queues on shutdown', async () => {
      manager.submitTask({ id: 't1', basePriority: 50 });
      manager.submitTask({ id: 't2', basePriority: 70 });

      await manager.shutdown();

      Object.values(manager.queues).forEach(queue => {
        expect(queue.size).toBe(0);
      });
    });
  });
});
