// CoordinationEngine.js - Coordination Protocol for multi-agent workflows
// Implements Phase 4.1 of Multi-Agent Organism (Issue #2710)

import EventEmitter from 'events';
import { randomUUID } from 'crypto';
import { Graph, alg } from 'graphlib';
import logger from '../utils/logger.js';
import metrics from '../utils/metrics.js';
import { BoundedMap } from '../utils/memoryOptimization.js';

/**
 * Coordinated task statuses
 */
export const CoordinatedTaskStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ROLLEDBACK: 'rolledback'
};

/**
 * Subtask statuses
 */
export const SubtaskStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  COMPENSATED: 'compensated'
};

/**
 * Task Decomposer interface
 * Implement this interface to create custom task decomposers
 */
export class TaskDecomposer {
  /**
   * Decompose a task into subtasks
   * @param {Object} task - The task to decompose
   * @returns {Promise<Array>} Array of subtasks with dependencies
   */
  async decompose(task) {
    throw new Error('TaskDecomposer.decompose() must be implemented by subclass');
  }
}

/**
 * CoordinationEngine manages multi-agent workflows
 * Implements Saga pattern for distributed transactions
 */
export class CoordinationEngine extends EventEmitter {
  constructor(options = {}) {
    super();

    // Dependencies
    this.agentManager = options.agentManager;
    this.messageBus = options.messageBus;

    if (!this.agentManager) {
      throw new Error('CoordinationEngine requires agentManager');
    }
    if (!this.messageBus) {
      throw new Error('CoordinationEngine requires messageBus');
    }

    // Active coordinated tasks
    this.maxActiveTasks = options.maxActiveTasks || 1000;
    this.activeTasks = new BoundedMap(this.maxActiveTasks);

    // Task decomposers registry
    this.decomposers = new Map(); // taskType -> TaskDecomposer

    // Configuration
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second
    this.subtaskTimeout = options.subtaskTimeout || 300000; // 5 minutes

    logger.info('CoordinationEngine initialized', {
      maxActiveTasks: this.maxActiveTasks,
      maxRetries: this.maxRetries,
      subtaskTimeout: this.subtaskTimeout
    });
  }

  /**
   * Register a task decomposer for a specific task type
   * @param {string} taskType - Type of task
   * @param {TaskDecomposer} decomposer - Decomposer instance
   */
  registerDecomposer(taskType, decomposer) {
    if (!(decomposer instanceof TaskDecomposer)) {
      throw new Error('Decomposer must be an instance of TaskDecomposer');
    }

    this.decomposers.set(taskType, decomposer);
    logger.info({ taskType }, 'Task decomposer registered');
  }

  /**
   * Get decomposer for task type
   * @param {string} taskType - Type of task
   * @returns {TaskDecomposer} Decomposer instance
   * @private
   */
  _getDecomposerForType(taskType) {
    const decomposer = this.decomposers.get(taskType);
    if (!decomposer) {
      throw new Error(`No decomposer registered for task type: ${taskType}`);
    }
    return decomposer;
  }

  /**
   * Decompose task into subtasks with dependency graph
   * @param {Object} task - Task to decompose
   * @returns {Promise<Object>} Decomposed task with subtasks and graph
   */
  async decomposeTask(task) {
    logger.info({ taskId: task.id, taskType: task.type }, 'Decomposing task');

    try {
      // Get appropriate decomposer
      const decomposer = this._getDecomposerForType(task.type);

      // Decompose into subtasks
      const subtasks = await decomposer.decompose(task);

      // Build dependency graph
      const graph = this._buildDependencyGraph(subtasks);

      // Validate graph (check for cycles)
      if (!alg.isAcyclic(graph)) {
        throw new Error('Subtask dependency graph contains cycles');
      }

      const decomposed = {
        taskId: task.id,
        subtasks,
        graph,
        status: CoordinatedTaskStatus.PENDING,
        createdAt: Date.now()
      };

      logger.info(
        { taskId: task.id, subtaskCount: subtasks.length },
        'Task decomposed successfully'
      );

      this.emit('task:decomposed', { taskId: task.id, subtaskCount: subtasks.length });

      return decomposed;
    } catch (error) {
      logger.error({ error, taskId: task.id }, 'Failed to decompose task');
      throw error;
    }
  }

  /**
   * Build dependency graph from subtasks
   * @param {Array} subtasks - Array of subtasks
   * @returns {Graph} Dependency graph
   * @private
   */
  _buildDependencyGraph(subtasks) {
    const graph = new Graph({ directed: true });

    // Add all subtasks as nodes
    subtasks.forEach(subtask => {
      graph.setNode(subtask.id, subtask);
    });

    // Add edges for dependencies
    subtasks.forEach(subtask => {
      if (subtask.dependencies && Array.isArray(subtask.dependencies)) {
        subtask.dependencies.forEach(depId => {
          // Edge from dependency to dependent subtask
          graph.setEdge(depId, subtask.id);
        });
      }
    });

    return graph;
  }

  /**
   * Build execution plan from subtasks and dependency graph
   * @param {Array} subtasks - Array of subtasks
   * @param {Graph} graph - Dependency graph
   * @returns {Object} Execution plan with levels
   */
  buildExecutionPlan(subtasks, graph) {
    logger.info({ subtaskCount: subtasks.length }, 'Building execution plan');

    try {
      // Topological sort to get execution order
      const executionOrder = alg.topsort(graph);

      // Group by execution level (for parallel execution)
      const levels = this._groupByLevel(executionOrder, graph);

      const plan = {
        levels,
        executionOrder,
        totalSubtasks: subtasks.length,
        createdAt: Date.now()
      };

      logger.info(
        { levelCount: levels.length, totalSubtasks: subtasks.length },
        'Execution plan built'
      );

      return plan;
    } catch (error) {
      logger.error({ error }, 'Failed to build execution plan');
      throw error;
    }
  }

  /**
   * Group subtasks by execution level for parallel execution
   * @param {Array} executionOrder - Topologically sorted subtask IDs
   * @param {Graph} graph - Dependency graph
   * @returns {Array} Array of levels, each containing subtasks
   * @private
   */
  _groupByLevel(executionOrder, graph) {
    const levels = [];
    const processed = new Set();
    const levelMap = new Map(); // subtaskId -> level number

    // Assign level to each subtask
    executionOrder.forEach(subtaskId => {
      // Get predecessors (dependencies)
      const predecessors = graph.predecessors(subtaskId) || [];

      // Level is max(predecessor levels) + 1
      let level = 0;
      predecessors.forEach(predId => {
        const predLevel = levelMap.get(predId);
        if (predLevel !== undefined) {
          level = Math.max(level, predLevel + 1);
        }
      });

      levelMap.set(subtaskId, level);

      // Add to levels array
      if (!levels[level]) {
        levels[level] = [];
      }
      levels[level].push(graph.node(subtaskId));
    });

    return levels;
  }

  /**
   * Execute coordinated multi-agent workflow
   * @param {string} taskId - Task ID
   * @param {Object} plan - Execution plan
   * @returns {Promise<Map>} Results map (subtaskId -> result)
   */
  async executeCoordinated(taskId, plan) {
    logger.info({ taskId, levelCount: plan.levels.length }, 'Starting coordinated execution');

    const coordinatedTask = {
      taskId,
      plan,
      status: CoordinatedTaskStatus.RUNNING,
      results: new Map(),
      errors: new Map(),
      startTime: Date.now(),
      currentLevel: 0
    };

    this.activeTasks.set(taskId, coordinatedTask);
    this.emit('coordination:started', { taskId });

    try {
      // Execute level by level
      for (let i = 0; i < plan.levels.length; i++) {
        coordinatedTask.currentLevel = i;
        const level = plan.levels[i];

        logger.info(
          { taskId, level: i, subtaskCount: level.length },
          'Executing level'
        );

        await this._executeLevel(taskId, level);
      }

      // All subtasks completed successfully
      coordinatedTask.status = CoordinatedTaskStatus.COMPLETED;
      coordinatedTask.endTime = Date.now();
      coordinatedTask.duration = coordinatedTask.endTime - coordinatedTask.startTime;

      logger.info(
        { taskId, duration: coordinatedTask.duration },
        'Coordinated execution completed'
      );

      this.emit('coordination:completed', {
        taskId,
        results: coordinatedTask.results,
        duration: coordinatedTask.duration
      });

      // Record metrics
      metrics.recordHistogram('coordination_task_duration_ms', coordinatedTask.duration, {
        taskId,
        success: 'true'
      });

      return coordinatedTask.results;
    } catch (error) {
      // Rollback on failure
      coordinatedTask.status = CoordinatedTaskStatus.FAILED;
      coordinatedTask.error = error.message;
      coordinatedTask.endTime = Date.now();

      logger.error({ error, taskId }, 'Coordinated execution failed');
      this.emit('coordination:failed', { taskId, error: error.message });

      // Record failure metrics
      metrics.recordHistogram('coordination_task_duration_ms', Date.now() - coordinatedTask.startTime, {
        taskId,
        success: 'false'
      });

      // Execute rollback (Saga pattern)
      await this.rollback(taskId);

      throw error;
    } finally {
      // Clean up after some time
      setTimeout(() => {
        this.activeTasks.delete(taskId);
      }, 60000); // Keep for 1 minute for debugging
    }
  }

  /**
   * Execute all subtasks in a level (parallel execution)
   * @param {string} taskId - Coordinated task ID
   * @param {Array} subtasks - Subtasks to execute
   * @returns {Promise<void>}
   * @private
   */
  async _executeLevel(taskId, subtasks) {
    // Execute all subtasks in parallel
    const promises = subtasks.map(subtask =>
      this._executeSubtask(taskId, subtask)
    );

    const results = await Promise.allSettled(promises);

    // Check for failures
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      const errorMessages = failures.map(f => f.reason.message).join('; ');
      throw new Error(`${failures.length} subtask(s) failed in level: ${errorMessages}`);
    }
  }

  /**
   * Execute a single subtask
   * @param {string} taskId - Coordinated task ID
   * @param {Object} subtask - Subtask to execute
   * @returns {Promise<any>} Subtask result
   * @private
   */
  async _executeSubtask(taskId, subtask) {
    logger.info(
      { taskId, subtaskId: subtask.id, requiredCapability: subtask.requiredCapability },
      'Executing subtask'
    );

    const coordinatedTask = this.activeTasks.get(taskId);

    try {
      // Find capable agent
      const agentId = await this._findAgentForSubtask(subtask);

      logger.info({ taskId, subtaskId: subtask.id, agentId }, 'Agent assigned to subtask');

      // Execute subtask with timeout
      const result = await this._executeWithTimeout(
        this.messageBus.sendRequest(
          'coordination-engine',
          agentId,
          {
            type: 'execute_subtask',
            subtask,
            coordinatedTaskId: taskId
          }
        ),
        this.subtaskTimeout
      );

      // Store result
      coordinatedTask.results.set(subtask.id, result);

      logger.info({ taskId, subtaskId: subtask.id }, 'Subtask completed');

      this.emit('subtask:completed', {
        taskId,
        subtaskId: subtask.id,
        agentId,
        result
      });

      return result;
    } catch (error) {
      // Store error
      coordinatedTask.errors.set(subtask.id, error.message);

      logger.error(
        { error, taskId, subtaskId: subtask.id },
        'Subtask execution failed'
      );

      this.emit('subtask:failed', {
        taskId,
        subtaskId: subtask.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Find agent for subtask based on required capability
   * @param {Object} subtask - Subtask
   * @returns {Promise<string>} Agent ID
   * @private
   */
  async _findAgentForSubtask(subtask) {
    return await this.agentManager.findAgentForTask({
      requiredCapabilities: [subtask.requiredCapability]
    });
  }

  /**
   * Execute promise with timeout
   * @param {Promise} promise - Promise to execute
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<any>}
   * @private
   */
  _executeWithTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Subtask execution timeout')), timeout)
      )
    ]);
  }

  /**
   * Handle subtask completion (called by agents)
   * @param {string} subtaskId - Subtask ID
   * @param {any} result - Subtask result
   */
  handleSubtaskCompletion(subtaskId, result) {
    logger.info({ subtaskId }, 'Handling subtask completion');

    // Find coordinated task containing this subtask
    for (const [taskId, coordinatedTask] of this.activeTasks.entries()) {
      const subtask = coordinatedTask.plan.levels
        .flat()
        .find(st => st.id === subtaskId);

      if (subtask) {
        coordinatedTask.results.set(subtaskId, result);

        this.emit('subtask:completed', {
          taskId,
          subtaskId,
          result
        });

        logger.info({ taskId, subtaskId }, 'Subtask result stored');
        return;
      }
    }

    logger.warn({ subtaskId }, 'Subtask not found in any coordinated task');
  }

  /**
   * Rollback coordinated task (Saga pattern)
   * Executes compensation actions for completed subtasks
   * @param {string} taskId - Coordinated task ID
   * @returns {Promise<void>}
   */
  async rollback(taskId) {
    logger.warn({ taskId }, 'Rolling back coordinated task');

    const coordinatedTask = this.activeTasks.get(taskId);
    if (!coordinatedTask) {
      logger.warn({ taskId }, 'Coordinated task not found for rollback');
      return;
    }

    coordinatedTask.status = CoordinatedTaskStatus.ROLLEDBACK;
    this.emit('coordination:rollback:started', { taskId });

    // Get completed subtasks in reverse order
    const completedSubtasks = [];
    for (const [subtaskId, result] of coordinatedTask.results.entries()) {
      const subtask = coordinatedTask.plan.levels
        .flat()
        .find(st => st.id === subtaskId);
      if (subtask) {
        completedSubtasks.push(subtask);
      }
    }

    // Reverse order for compensation
    completedSubtasks.reverse();

    logger.info(
      { taskId, compensationCount: completedSubtasks.length },
      'Executing compensation actions'
    );

    // Execute compensation actions
    for (const subtask of completedSubtasks) {
      try {
        await this._executeCompensation(taskId, subtask);
      } catch (error) {
        // Log but continue with other compensations
        logger.error(
          { error, taskId, subtaskId: subtask.id },
          'Compensation action failed'
        );
      }
    }

    logger.info({ taskId }, 'Rollback completed');
    this.emit('coordination:rollback:completed', { taskId });
  }

  /**
   * Execute compensation action for a subtask
   * @param {string} taskId - Coordinated task ID
   * @param {Object} subtask - Subtask
   * @returns {Promise<void>}
   * @private
   */
  async _executeCompensation(taskId, subtask) {
    if (!subtask.compensationAction) {
      logger.info(
        { taskId, subtaskId: subtask.id },
        'No compensation action defined for subtask'
      );
      return;
    }

    logger.info(
      { taskId, subtaskId: subtask.id, compensationAction: subtask.compensationAction },
      'Executing compensation action'
    );

    try {
      // Find agent that executed the subtask
      const agentId = await this._findAgentForSubtask(subtask);

      // Send compensation request
      await this.messageBus.sendRequest(
        'coordination-engine',
        agentId,
        {
          type: 'compensate',
          subtaskId: subtask.id,
          action: subtask.compensationAction
        }
      );

      logger.info({ taskId, subtaskId: subtask.id }, 'Compensation action completed');

      this.emit('compensation:executed', {
        taskId,
        subtaskId: subtask.id,
        action: subtask.compensationAction
      });
    } catch (error) {
      logger.error(
        { error, taskId, subtaskId: subtask.id },
        'Compensation action failed'
      );
      throw error;
    }
  }

  /**
   * Get status of coordinated task
   * @param {string} taskId - Task ID
   * @returns {Object|null} Task status
   */
  getTaskStatus(taskId) {
    const coordinatedTask = this.activeTasks.get(taskId);
    if (!coordinatedTask) {
      return null;
    }

    return {
      taskId,
      status: coordinatedTask.status,
      currentLevel: coordinatedTask.currentLevel,
      totalLevels: coordinatedTask.plan.levels.length,
      completedSubtasks: coordinatedTask.results.size,
      totalSubtasks: coordinatedTask.plan.totalSubtasks,
      failedSubtasks: coordinatedTask.errors.size,
      startTime: coordinatedTask.startTime,
      duration: coordinatedTask.endTime
        ? coordinatedTask.endTime - coordinatedTask.startTime
        : Date.now() - coordinatedTask.startTime
    };
  }

  /**
   * Get all active coordinated tasks
   * @returns {Array} Array of task statuses
   */
  getActiveTasks() {
    const tasks = [];
    for (const [taskId, _] of this.activeTasks.entries()) {
      const status = this.getTaskStatus(taskId);
      if (status) {
        tasks.push(status);
      }
    }
    return tasks;
  }

  /**
   * Shutdown coordination engine
   */
  async shutdown() {
    logger.info('Shutting down CoordinationEngine');

    // Wait for active tasks to complete or timeout after 30 seconds
    const timeout = 30000;
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

    this.removeAllListeners();
    logger.info('CoordinationEngine shutdown complete');
  }
}

export default CoordinationEngine;
