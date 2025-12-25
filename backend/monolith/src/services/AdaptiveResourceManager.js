// AdaptiveResourceManager.js - Smart Resource Management System
// Implements Issue #5304: Priority Queuing & Dynamic Allocation

import EventEmitter from 'events';
import PriorityQueue from './PriorityQueue.js';
import ResourcePredictor from './ResourcePredictor.js';
import logger from '../utils/logger.js';
import metrics from '../utils/metrics.js';

/**
 * Priority Levels
 */
export const PriorityLevel = {
  CRITICAL: 'critical', // System tasks (priority 0-24)
  HIGH: 'high',         // User requests (priority 25-49)
  NORMAL: 'normal',     // Background tasks (priority 50-74)
  LOW: 'low'            // Optimization, learning (priority 75-99)
};

/**
 * Resource Pool for tracking available resources
 */
class ResourcePool {
  constructor(options = {}) {
    this.maxCPU = options.maxCPU || 1.0; // 100%
    this.maxMemory = options.maxMemory || 2 * 1024 * 1024 * 1024; // 2GB
    this.maxTokensPerMinute = options.maxTokensPerMinute || 100000; // 100k tokens/min
    this.maxConcurrentTasks = options.maxConcurrentTasks || 10;

    this.availableCPU = this.maxCPU;
    this.availableMemory = this.maxMemory;
    this.tokensUsedThisMinute = 0;
    this.activeTasks = 0;

    // Reset token counter every minute
    this.tokenResetInterval = setInterval(() => {
      this.tokensUsedThisMinute = 0;
    }, 60000);
  }

  /**
   * Check if resources are available for task
   */
  canAllocate(resources) {
    return (
      this.availableCPU >= resources.cpu &&
      this.availableMemory >= resources.memory &&
      this.tokensUsedThisMinute + resources.tokens <= this.maxTokensPerMinute &&
      this.activeTasks < this.maxConcurrentTasks
    );
  }

  /**
   * Allocate resources for task
   */
  allocate(resources) {
    if (!this.canAllocate(resources)) {
      return false;
    }

    this.availableCPU -= resources.cpu;
    this.availableMemory -= resources.memory;
    this.tokensUsedThisMinute += resources.tokens;
    this.activeTasks++;

    return true;
  }

  /**
   * Release resources after task completion
   */
  release(resources) {
    this.availableCPU = Math.min(this.maxCPU, this.availableCPU + resources.cpu);
    this.availableMemory = Math.min(
      this.maxMemory,
      this.availableMemory + resources.memory
    );
    this.activeTasks = Math.max(0, this.activeTasks - 1);
  }

  /**
   * Get current utilization
   */
  getUtilization() {
    return {
      cpu: (this.maxCPU - this.availableCPU) / this.maxCPU,
      memory: (this.maxMemory - this.availableMemory) / this.maxMemory,
      tokens: this.tokensUsedThisMinute / this.maxTokensPerMinute,
      tasks: this.activeTasks / this.maxConcurrentTasks
    };
  }

  /**
   * Cleanup
   */
  shutdown() {
    clearInterval(this.tokenResetInterval);
  }
}

/**
 * AdaptiveResourceManager - Smart resource management with priority queuing
 *
 * Features:
 * - 4-level priority queuing (Critical, High, Normal, Low)
 * - Dynamic priority calculation (aging, deadline, user)
 * - Resource prediction (CPU, memory, tokens)
 * - Preemptive scheduling
 * - Queue aging to prevent starvation
 */
export class AdaptiveResourceManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Priority queues for each level
    this.queues = {
      [PriorityLevel.CRITICAL]: new PriorityQueue(),
      [PriorityLevel.HIGH]: new PriorityQueue(),
      [PriorityLevel.NORMAL]: new PriorityQueue(),
      [PriorityLevel.LOW]: new PriorityQueue()
    };

    // Resource management
    this.resourcePool = new ResourcePool(options.resourcePool || {});
    this.resourcePredictor = options.resourcePredictor || new ResourcePredictor();

    // Active tasks tracking
    this.activeTasks = new Map(); // taskId -> { task, resources, startTime }

    // Configuration
    this.agingIntervalMs = options.agingIntervalMs || 60000; // 1 minute
    this.agingPointsPerInterval = options.agingPointsPerInterval || 1;
    this.enablePreemption = options.enablePreemption !== false; // Default: true
    this.preemptionThreshold = options.preemptionThreshold || 0.9; // 90% utilization

    // Scheduling
    this.schedulerRunning = false;
    this.schedulerInterval = options.schedulerInterval || 100; // 100ms

    // Metrics
    this.metrics = {
      tasksEnqueued: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksPreempted: 0,
      totalWaitTime: 0,
      totalExecutionTime: 0
    };

    // Start aging timer
    this._startAgingTimer();

    logger.info('AdaptiveResourceManager initialized', {
      queues: Object.keys(this.queues),
      agingIntervalMs: this.agingIntervalMs,
      enablePreemption: this.enablePreemption
    });
  }

  /**
   * Submit task for execution
   * @param {Object} task - Task to execute
   * @returns {Promise} Resolves when task is completed
   */
  async submitTask(task) {
    // Ensure task has required fields
    if (!task.id) {
      task.id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Calculate priority
    const priority = this.calculatePriority(task);
    task.calculatedPriority = priority;
    task.submittedAt = Date.now();

    // Determine queue level
    const level = this._getPriorityLevel(priority);

    // Enqueue task
    this.queues[level].enqueue(task, priority);
    this.metrics.tasksEnqueued++;

    logger.info(
      { taskId: task.id, priority, level },
      'Task submitted to queue'
    );

    this.emit('task:queued', { task, priority, level });
    metrics.increment('resourceManager.tasksQueued', { level });

    // Start scheduler if not running
    if (!this.schedulerRunning) {
      this._startScheduler();
    }

    // Return promise that resolves when task completes
    return new Promise((resolve, reject) => {
      task._resolve = resolve;
      task._reject = reject;
    });
  }

  /**
   * Calculate dynamic priority for task
   * Factors: base priority, aging, deadline, user
   */
  calculatePriority(task) {
    let score = task.basePriority || 50; // Default: NORMAL

    // Aging factor (+1 point per minute)
    if (task.submittedAt) {
      const age = Date.now() - task.submittedAt;
      score -= age / 60000; // Lower score = higher priority
    }

    // Deadline factor (urgent tasks get higher priority)
    if (task.deadline) {
      const timeLeft = task.deadline - Date.now();
      if (timeLeft < 60000) {
        score -= 50; // < 1 min: critical
      } else if (timeLeft < 300000) {
        score -= 20; // < 5 min: high
      } else if (timeLeft < 3600000) {
        score -= 5; // < 1 hour: slightly higher
      }
    }

    // User factor (user-facing tasks get priority)
    if (task.userId) {
      score -= 30;
    }

    // System task factor
    if (task.isSystemTask) {
      score -= 100; // Highest priority
    }

    // Clamp to 0-99 range
    return Math.max(0, Math.min(99, Math.floor(score)));
  }

  /**
   * Get priority level from priority score
   * @private
   */
  _getPriorityLevel(priority) {
    if (priority < 25) return PriorityLevel.CRITICAL;
    if (priority < 50) return PriorityLevel.HIGH;
    if (priority < 75) return PriorityLevel.NORMAL;
    return PriorityLevel.LOW;
  }

  /**
   * Start task scheduler
   * @private
   */
  _startScheduler() {
    if (this.schedulerRunning) return;

    this.schedulerRunning = true;

    const schedule = async () => {
      if (!this.schedulerRunning) return;

      try {
        await this._scheduleNext();
      } catch (error) {
        logger.error({ error: error.message }, 'Scheduler error');
      }

      setTimeout(schedule, this.schedulerInterval);
    };

    schedule();
    logger.info('Task scheduler started');
  }

  /**
   * Stop task scheduler
   */
  stopScheduler() {
    this.schedulerRunning = false;
    logger.info('Task scheduler stopped');
  }

  /**
   * Schedule next task for execution
   * @private
   */
  async _scheduleNext() {
    // Get next task from queues (priority order)
    const task = this._getNextTask();

    if (!task) {
      // No tasks to schedule
      return;
    }

    // Predict resource requirements
    const resources = this.resourcePredictor.predict(task);

    // Check if resources available
    if (this.resourcePool.canAllocate(resources)) {
      // Allocate and execute
      await this._executeTask(task, resources);
    } else {
      // Resources not available
      // Check if we should preempt low priority tasks
      if (this.enablePreemption && this._shouldPreempt(task, resources)) {
        await this._preemptLowPriorityTasks(resources);

        // Try again
        if (this.resourcePool.canAllocate(resources)) {
          await this._executeTask(task, resources);
        } else {
          // Still can't allocate, put back in queue
          this._requeueTask(task);
        }
      } else {
        // Put back in queue
        this._requeueTask(task);
      }
    }
  }

  /**
   * Get next task from queues (priority order)
   * @private
   */
  _getNextTask() {
    // Try queues in priority order
    const levels = [
      PriorityLevel.CRITICAL,
      PriorityLevel.HIGH,
      PriorityLevel.NORMAL,
      PriorityLevel.LOW
    ];

    for (const level of levels) {
      const task = this.queues[level].dequeue();
      if (task) {
        return task;
      }
    }

    return null;
  }

  /**
   * Execute task
   * @private
   */
  async _executeTask(task, resources) {
    // Allocate resources
    this.resourcePool.allocate(resources);

    // Track active task
    this.activeTasks.set(task.id, {
      task,
      resources,
      startTime: Date.now()
    });

    const waitTime = Date.now() - task.submittedAt;
    this.metrics.totalWaitTime += waitTime;

    logger.info(
      { taskId: task.id, resources, waitTime },
      'Executing task'
    );

    this.emit('task:started', { task, resources, waitTime });
    metrics.recordHistogram('resourceManager.waitTime', waitTime);

    try {
      // Execute task (simulate with executor callback if provided)
      const result = task.executor
        ? await task.executor(task)
        : { success: true, message: 'Task executed' };

      // Task completed
      const executionTime = Date.now() - this.activeTasks.get(task.id).startTime;
      this.metrics.totalExecutionTime += executionTime;
      this.metrics.tasksCompleted++;

      // Record actual usage for learning
      this.resourcePredictor.recordActualUsage(task.type, {
        ...resources,
        executionTime
      });

      // Release resources
      this.resourcePool.release(resources);
      this.activeTasks.delete(task.id);

      logger.info(
        { taskId: task.id, executionTime },
        'Task completed'
      );

      this.emit('task:completed', { task, result, executionTime });
      metrics.recordHistogram('resourceManager.executionTime', executionTime);

      // Resolve promise
      if (task._resolve) {
        task._resolve(result);
      }
    } catch (error) {
      // Task failed
      this.metrics.tasksFailed++;

      // Release resources
      this.resourcePool.release(resources);
      this.activeTasks.delete(task.id);

      logger.error(
        { error: error.message, taskId: task.id },
        'Task failed'
      );

      this.emit('task:failed', { task, error: error.message });
      metrics.increment('resourceManager.tasksFailed');

      // Reject promise
      if (task._reject) {
        task._reject(error);
      }
    }
  }

  /**
   * Requeue task when resources not available
   * @private
   */
  _requeueTask(task) {
    const level = this._getPriorityLevel(task.calculatedPriority);
    this.queues[level].enqueue(task, task.calculatedPriority);
  }

  /**
   * Check if should preempt low priority tasks
   * @private
   */
  _shouldPreempt(task, requiredResources) {
    // Only preempt for high priority tasks
    if (task.calculatedPriority >= 50) {
      return false;
    }

    // Check current utilization
    const utilization = this.resourcePool.getUtilization();
    const avgUtilization =
      (utilization.cpu + utilization.memory + utilization.tasks) / 3;

    // Preempt if utilization is high
    return avgUtilization >= this.preemptionThreshold;
  }

  /**
   * Preempt low priority tasks to free resources
   * @private
   */
  async _preemptLowPriorityTasks(requiredResources) {
    logger.info('Attempting to preempt low priority tasks');

    const tasksToPreempt = [];
    let freedCPU = 0;
    let freedMemory = 0;

    // Find low priority tasks to preempt
    for (const [taskId, activeTask] of this.activeTasks.entries()) {
      if (activeTask.task.calculatedPriority >= 75) {
        // Low priority
        tasksToPreempt.push(activeTask);
        freedCPU += activeTask.resources.cpu;
        freedMemory += activeTask.resources.memory;

        // Check if we've freed enough resources
        if (
          freedCPU >= requiredResources.cpu &&
          freedMemory >= requiredResources.memory
        ) {
          break;
        }
      }
    }

    // Preempt tasks
    for (const activeTask of tasksToPreempt) {
      await this._preemptTask(activeTask);
    }

    logger.info({ count: tasksToPreempt.length }, 'Preempted low priority tasks');
  }

  /**
   * Preempt a running task
   * @private
   */
  async _preemptTask(activeTask) {
    const { task, resources } = activeTask;

    logger.warn({ taskId: task.id }, 'Preempting task');

    // Release resources
    this.resourcePool.release(resources);
    this.activeTasks.delete(task.id);

    // Increase priority to prevent repeated preemption
    task.calculatedPriority = Math.max(0, task.calculatedPriority - 10);

    // Requeue task
    this._requeueTask(task);

    this.metrics.tasksPreempted++;
    this.emit('task:preempted', { task });
    metrics.increment('resourceManager.tasksPreempted');
  }

  /**
   * Start aging timer to prevent starvation
   * @private
   */
  _startAgingTimer() {
    this.agingTimer = setInterval(() => {
      this._ageQueuedTasks();
    }, this.agingIntervalMs);

    logger.info('Queue aging timer started');
  }

  /**
   * Age queued tasks by increasing their priority
   * @private
   */
  _ageQueuedTasks() {
    let agedCount = 0;

    // Age tasks in each queue
    for (const [level, queue] of Object.entries(this.queues)) {
      const tasks = queue.toArray();

      for (const task of tasks) {
        // Increase priority (decrease score)
        const newPriority = Math.max(
          0,
          task.calculatedPriority - this.agingPointsPerInterval
        );

        if (newPriority !== task.calculatedPriority) {
          task.calculatedPriority = newPriority;
          queue.updatePriority(task.id, newPriority);
          agedCount++;

          // Check if task should move to higher priority queue
          const newLevel = this._getPriorityLevel(newPriority);
          if (newLevel !== level) {
            queue.remove(task.id);
            this.queues[newLevel].enqueue(task, newPriority);

            logger.debug(
              { taskId: task.id, oldLevel: level, newLevel },
              'Task moved to higher priority queue'
            );
          }
        }
      }
    }

    if (agedCount > 0) {
      logger.debug({ agedCount }, 'Aged queued tasks');
      this.emit('aging:completed', { agedCount });
    }
  }

  /**
   * Get current queue statistics
   */
  getQueueStats() {
    const stats = {};

    for (const [level, queue] of Object.entries(this.queues)) {
      stats[level] = queue.getStats();
    }

    return stats;
  }

  /**
   * Get resource pool statistics
   */
  getResourceStats() {
    return {
      utilization: this.resourcePool.getUtilization(),
      activeTasks: this.activeTasks.size,
      available: {
        cpu: this.resourcePool.availableCPU,
        memory: this.resourcePool.availableMemory,
        tokensPerMinute: this.resourcePool.maxTokensPerMinute - this.resourcePool.tokensUsedThisMinute
      }
    };
  }

  /**
   * Get overall system metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      avgWaitTime:
        this.metrics.tasksCompleted > 0
          ? this.metrics.totalWaitTime / this.metrics.tasksCompleted
          : 0,
      avgExecutionTime:
        this.metrics.tasksCompleted > 0
          ? this.metrics.totalExecutionTime / this.metrics.tasksCompleted
          : 0,
      throughput: this.metrics.tasksCompleted,
      queues: this.getQueueStats(),
      resources: this.getResourceStats()
    };
  }

  /**
   * Shutdown resource manager
   */
  async shutdown() {
    logger.info('Shutting down AdaptiveResourceManager');

    // Stop scheduler
    this.stopScheduler();

    // Stop aging timer
    if (this.agingTimer) {
      clearInterval(this.agingTimer);
    }

    // Wait for active tasks to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const start = Date.now();

    while (this.activeTasks.size > 0 && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeTasks.size > 0) {
      logger.warn(
        { activeTaskCount: this.activeTasks.size },
        'Some tasks still active during shutdown'
      );
    }

    // Cleanup resource pool
    this.resourcePool.shutdown();

    // Clear queues
    for (const queue of Object.values(this.queues)) {
      queue.clear();
    }

    this.removeAllListeners();
    logger.info('AdaptiveResourceManager shutdown complete');
  }
}

export default AdaptiveResourceManager;
