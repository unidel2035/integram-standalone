// AgentManager.js - Manages agent lifecycle, task assignment, and load balancing
import EventEmitter from 'events';
import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';
import metrics from '../utils/metrics.js';
import { AgentRegistry, AgentStatus, AgentCapabilities } from '../core/AgentRegistry.js';
import { BoundedMap } from '../utils/memoryOptimization.js';

/**
 * Task priorities
 */
export const TaskPriority = {
  LOW: 1,
  NORMAL: 3,
  HIGH: 5,
  URGENT: 10
};

/**
 * Task statuses
 */
export const TaskStatus = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Load balancing strategies
 */
export const LoadBalancingStrategy = {
  ROUND_ROBIN: 'round_robin',
  LEAST_LOADED: 'least_loaded',
  RANDOM: 'random',
  PRIORITY: 'priority'
};

/**
 * AgentManager orchestrates agent registration, task assignment, and load balancing
 * Implements Phase 2 of the Multi-Agent System (Issue #2459)
 */
export class AgentManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Agent registry for tracking all agents
    this.registry = options.registry || new AgentRegistry(options.registryOptions);

    // Task management
    this.maxTasks = options.maxTasks || 10000;
    this.tasks = new BoundedMap(this.maxTasks);
    this.taskQueue = []; // Priority queue for pending tasks

    // Load balancing configuration
    this.loadBalancingStrategy = options.loadBalancingStrategy || LoadBalancingStrategy.LEAST_LOADED;
    this.roundRobinIndex = new Map(); // Track round-robin indices per capability

    // Agent instances (for BaseAgent subclasses)
    this.agentInstances = new Map(); // agentId -> BaseAgent instance

    // Task assignment tracking
    this.agentTaskCounts = new Map(); // agentId -> current task count

    // Configuration
    this.taskAssignmentInterval = options.taskAssignmentInterval || 1000; // 1 second
    this.maxConcurrentTasksPerAgent = options.maxConcurrentTasksPerAgent || 1; // Default: 1 task at a time

    // ML-based task router (optional)
    this.mlTaskRouter = options.mlTaskRouter || null;
    this.useMLRouter = options.useMLRouter || false;

    // Start task assignment loop
    this._startTaskAssignmentLoop();

    logger.info('AgentManager initialized', {
      loadBalancingStrategy: this.loadBalancingStrategy,
      maxTasks: this.maxTasks,
      taskAssignmentInterval: this.taskAssignmentInterval,
      useMLRouter: this.useMLRouter
    });
  }

  /**
   * Register an agent with the manager
   */
  registerAgent(agentData, agentInstance = null) {
    // Register with registry
    const agent = this.registry.registerAgent(agentData);

    // Store agent instance if provided (for BaseAgent subclasses)
    if (agentInstance) {
      this.agentInstances.set(agent.id, agentInstance);

      // Set up event listeners
      agentInstance.on('task:started', (task) => {
        this._handleAgentTaskStarted(agent.id, task);
      });

      agentInstance.on('task:completed', ({ task, result }) => {
        this._handleAgentTaskCompleted(agent.id, task, result);
      });

      agentInstance.on('task:failed', ({ task, error }) => {
        this._handleAgentTaskFailed(agent.id, task, error);
      });
    }

    // Initialize task count
    this.agentTaskCounts.set(agent.id, 0);

    logger.info({ agentId: agent.id }, 'Agent registered with AgentManager');
    this.emit('agent:registered', agent);

    return agent;
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId) {
    const agent = this.registry.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Reassign any tasks assigned to this agent
    const agentTasks = Array.from(this.tasks.values()).filter(t => t.assignedAgentId === agentId);
    for (const task of agentTasks) {
      logger.info({ taskId: task.id, agentId }, 'Reassigning task from unregistered agent');
      task.status = TaskStatus.PENDING;
      task.assignedAgentId = null;
      this.taskQueue.push(task);
    }

    // Remove from registry
    this.registry.unregisterAgent(agentId);

    // Clean up instances and counts
    this.agentInstances.delete(agentId);
    this.agentTaskCounts.delete(agentId);

    logger.info({ agentId }, 'Agent unregistered from AgentManager');
    this.emit('agent:unregistered', agent);

    return agent;
  }

  /**
   * Create a new task
   */
  createTask(taskData) {
    const task = {
      id: taskData.id || randomUUID(),
      type: taskData.type,
      payload: taskData.payload || {},
      requiredCapabilities: taskData.requiredCapabilities || [AgentCapabilities.GENERIC],
      priority: taskData.priority || TaskPriority.NORMAL,
      status: TaskStatus.PENDING,
      assignedAgentId: null,
      createdAt: new Date(),
      assignedAt: null,
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
      metadata: taskData.metadata || {}
    };

    this.tasks.set(task.id, task);
    this.taskQueue.push(task);

    // Sort task queue by priority (descending)
    this.taskQueue.sort((a, b) => b.priority - a.priority);

    metrics.increment('tasksCreated');
    logger.info({ taskId: task.id, type: task.type, priority: task.priority }, 'Task created');
    this.emit('task:created', task);

    return task;
  }

  /**
   * Assign a task to an agent manually
   */
  async assignTaskToAgent(taskId, agentId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const agent = this.registry.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Check if agent can handle task capabilities
    const canHandle = task.requiredCapabilities.every(cap =>
      agent.capabilities.includes(cap)
    );

    if (!canHandle) {
      throw new Error(`Agent ${agentId} does not have required capabilities`);
    }

    // Check if agent is available
    const currentTaskCount = this.agentTaskCounts.get(agentId) || 0;
    if (currentTaskCount >= this.maxConcurrentTasksPerAgent) {
      throw new Error(`Agent ${agentId} is at maximum capacity`);
    }

    // Assign task
    task.status = TaskStatus.ASSIGNED;
    task.assignedAgentId = agentId;
    task.assignedAt = new Date();

    // Update agent status
    this.registry.updateAgentStatus(agentId, AgentStatus.BUSY, task.id);
    this.agentTaskCounts.set(agentId, currentTaskCount + 1);

    // Remove from queue if present
    this.taskQueue = this.taskQueue.filter(t => t.id !== taskId);

    metrics.increment('tasksAssigned');
    logger.info({ taskId: task.id, agentId }, 'Task assigned to agent');
    this.emit('task:assigned', { task, agent });

    // Execute task if agent instance available
    const agentInstance = this.agentInstances.get(agentId);
    if (agentInstance) {
      try {
        task.status = TaskStatus.IN_PROGRESS;
        task.startedAt = new Date();
        this.emit('task:started', { task, agent });

        const result = await agentInstance.processTask(task);

        // Task completion is handled by event listener
        return result;
      } catch (error) {
        // Task failure is handled by event listener
        throw error;
      }
    }

    return task;
  }

  /**
   * Find capable agents for a task
   */
  findCapableAgents(task) {
    return this.registry.getAllAgents().filter(agent => {
      // Check capabilities
      const hasCapabilities = task.requiredCapabilities.every(cap =>
        agent.capabilities.includes(cap)
      );

      if (!hasCapabilities) {
        return false;
      }

      // Check availability (not offline, not at max capacity)
      if (agent.status === AgentStatus.OFFLINE) {
        return false;
      }

      const currentTaskCount = this.agentTaskCounts.get(agent.id) || 0;
      if (currentTaskCount >= this.maxConcurrentTasksPerAgent) {
        return false;
      }

      return true;
    });
  }

  /**
   * Select best agent from capable agents using load balancing strategy
   * Can optionally use ML-based routing if enabled
   */
  async selectAgent(capableAgents, task, options = {}) {
    if (capableAgents.length === 0) {
      return null;
    }

    // Use ML router if enabled and available (unless explicitly disabled)
    if (this.useMLRouter && this.mlTaskRouter && options.useML !== false) {
      try {
        const selectedAgent = await this.mlTaskRouter.route(task);
        logger.debug({ taskId: task.id, agentId: selectedAgent.id }, 'Agent selected using ML router');
        return selectedAgent;
      } catch (error) {
        logger.warn({ taskId: task.id, error: error.message }, 'ML routing failed, falling back to traditional strategy');
        // Fall through to traditional strategy
      }
    }

    // Traditional load balancing strategies
    switch (this.loadBalancingStrategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this._selectAgentRoundRobin(capableAgents, task);

      case LoadBalancingStrategy.LEAST_LOADED:
        return this._selectAgentLeastLoaded(capableAgents);

      case LoadBalancingStrategy.RANDOM:
        return this._selectAgentRandom(capableAgents);

      case LoadBalancingStrategy.PRIORITY:
        return this._selectAgentPriority(capableAgents, task);

      default:
        return capableAgents[0];
    }
  }

  /**
   * Round-robin agent selection
   * @private
   */
  _selectAgentRoundRobin(agents, task) {
    const capabilityKey = task.requiredCapabilities.sort().join(',');
    const currentIndex = this.roundRobinIndex.get(capabilityKey) || 0;
    const selectedAgent = agents[currentIndex % agents.length];
    this.roundRobinIndex.set(capabilityKey, (currentIndex + 1) % agents.length);
    return selectedAgent;
  }

  /**
   * Least-loaded agent selection
   * @private
   */
  _selectAgentLeastLoaded(agents) {
    return agents.reduce((leastLoaded, agent) => {
      const agentLoad = this.agentTaskCounts.get(agent.id) || 0;
      const leastLoadedLoad = this.agentTaskCounts.get(leastLoaded.id) || 0;
      return agentLoad < leastLoadedLoad ? agent : leastLoaded;
    });
  }

  /**
   * Random agent selection
   * @private
   */
  _selectAgentRandom(agents) {
    return agents[Math.floor(Math.random() * agents.length)];
  }

  /**
   * Priority-based agent selection (prefer idle agents)
   * @private
   */
  _selectAgentPriority(agents, task) {
    // Prefer idle agents
    const idleAgents = agents.filter(a => a.status === AgentStatus.IDLE);
    if (idleAgents.length > 0) {
      return this._selectAgentLeastLoaded(idleAgents);
    }

    // Fall back to least loaded
    return this._selectAgentLeastLoaded(agents);
  }

  /**
   * Get task by ID
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status) {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * Get agent statistics
   */
  getAgentStats(agentId) {
    const agent = this.registry.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const currentTaskCount = this.agentTaskCounts.get(agentId) || 0;

    return {
      ...agent,
      currentTaskCount,
      maxConcurrentTasks: this.maxConcurrentTasksPerAgent,
      utilizationPercent: (currentTaskCount / this.maxConcurrentTasksPerAgent) * 100
    };
  }

  /**
   * Get manager statistics
   */
  getStats() {
    return {
      agents: this.registry.getStats(),
      tasks: {
        total: this.tasks.size,
        pending: this.taskQueue.length,
        assigned: this.getTasksByStatus(TaskStatus.ASSIGNED).length,
        inProgress: this.getTasksByStatus(TaskStatus.IN_PROGRESS).length,
        completed: this.getTasksByStatus(TaskStatus.COMPLETED).length,
        failed: this.getTasksByStatus(TaskStatus.FAILED).length,
        cancelled: this.getTasksByStatus(TaskStatus.CANCELLED).length
      },
      loadBalancingStrategy: this.loadBalancingStrategy
    };
  }

  /**
   * Handle agent task started event
   * @private
   */
  _handleAgentTaskStarted(agentId, task) {
    const managedTask = this.tasks.get(task.id);
    if (managedTask) {
      managedTask.status = TaskStatus.IN_PROGRESS;
      managedTask.startedAt = new Date();
    }

    logger.debug({ agentId, taskId: task.id }, 'Agent task started');
  }

  /**
   * Handle agent task completed event
   * @private
   */
  _handleAgentTaskCompleted(agentId, task, result) {
    const managedTask = this.tasks.get(task.id);
    if (managedTask) {
      managedTask.status = TaskStatus.COMPLETED;
      managedTask.completedAt = new Date();
      managedTask.result = result;
    }

    // Update agent status and counts
    const currentTaskCount = this.agentTaskCounts.get(agentId) || 0;
    this.agentTaskCounts.set(agentId, Math.max(0, currentTaskCount - 1));

    // If agent has no more tasks, set to idle
    if (this.agentTaskCounts.get(agentId) === 0) {
      this.registry.updateAgentStatus(agentId, AgentStatus.IDLE);
    }

    // Increment success counter
    this.registry.incrementTaskCounter(agentId, true);

    metrics.increment('tasksCompleted');
    logger.info({ agentId, taskId: task.id }, 'Agent task completed');
    this.emit('task:completed', { task: managedTask, agent: this.registry.getAgent(agentId), result });
  }

  /**
   * Handle agent task failed event
   * @private
   */
  _handleAgentTaskFailed(agentId, task, error) {
    const managedTask = this.tasks.get(task.id);
    if (managedTask) {
      managedTask.status = TaskStatus.FAILED;
      managedTask.completedAt = new Date();
      managedTask.error = error.message || String(error);
    }

    // Update agent status and counts
    const currentTaskCount = this.agentTaskCounts.get(agentId) || 0;
    this.agentTaskCounts.set(agentId, Math.max(0, currentTaskCount - 1));

    // If agent has no more tasks, set to idle (or error if needed)
    if (this.agentTaskCounts.get(agentId) === 0) {
      this.registry.updateAgentStatus(agentId, AgentStatus.IDLE);
    }

    // Increment failure counter
    this.registry.incrementTaskCounter(agentId, false);

    metrics.increment('tasksFailed');
    logger.error({ agentId, taskId: task.id, error: error.message }, 'Agent task failed');
    this.emit('task:failed', { task: managedTask, agent: this.registry.getAgent(agentId), error });
  }

  /**
   * Start automatic task assignment loop
   * @private
   */
  _startTaskAssignmentLoop() {
    this.taskAssignmentTimer = setInterval(() => {
      this._assignPendingTasks();
    }, this.taskAssignmentInterval);

    logger.debug('Task assignment loop started');
  }

  /**
   * Assign pending tasks to available agents
   * @private
   */
  async _assignPendingTasks() {
    if (this.taskQueue.length === 0) {
      return;
    }

    // Try to assign tasks from queue
    const tasksToAssign = [...this.taskQueue];

    for (const task of tasksToAssign) {
      // Find capable agents
      const capableAgents = this.findCapableAgents(task);

      if (capableAgents.length === 0) {
        logger.debug({ taskId: task.id }, 'No capable agents available for task');
        continue;
      }

      // Select best agent
      const selectedAgent = this.selectAgent(capableAgents, task);

      if (!selectedAgent) {
        logger.debug({ taskId: task.id }, 'No agent selected for task');
        continue;
      }

      // Assign task
      try {
        await this.assignTaskToAgent(task.id, selectedAgent.id);
      } catch (error) {
        logger.error({ taskId: task.id, agentId: selectedAgent.id, error: error.message },
          'Failed to assign task to agent');
      }
    }
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
      throw new Error(`Cannot cancel ${task.status} task`);
    }

    // Remove from queue
    this.taskQueue = this.taskQueue.filter(t => t.id !== taskId);

    // Update task status
    task.status = TaskStatus.CANCELLED;
    task.completedAt = new Date();

    // If assigned to agent, free up agent
    if (task.assignedAgentId) {
      const currentTaskCount = this.agentTaskCounts.get(task.assignedAgentId) || 0;
      this.agentTaskCounts.set(task.assignedAgentId, Math.max(0, currentTaskCount - 1));

      if (this.agentTaskCounts.get(task.assignedAgentId) === 0) {
        this.registry.updateAgentStatus(task.assignedAgentId, AgentStatus.IDLE);
      }
    }

    metrics.increment('tasksCancelled');
    logger.info({ taskId }, 'Task cancelled');
    this.emit('task:cancelled', task);

    return task;
  }

  /**
   * Enable ML-based task routing
   */
  enableMLRouting(mlTaskRouter) {
    if (!mlTaskRouter) {
      throw new Error('mlTaskRouter instance is required');
    }

    this.mlTaskRouter = mlTaskRouter;
    this.useMLRouter = true;

    logger.info('ML-based task routing enabled');
  }

  /**
   * Disable ML-based task routing
   */
  disableMLRouting() {
    this.useMLRouter = false;
    logger.info('ML-based task routing disabled');
  }

  /**
   * Get ML router statistics (if available)
   */
  getMLRouterStats() {
    if (!this.mlTaskRouter) {
      return null;
    }

    return this.mlTaskRouter.getStats();
  }

  /**
   * Manually trigger ML model retraining (if available)
   */
  async retrainMLModel() {
    if (!this.mlTaskRouter) {
      throw new Error('ML task router not available');
    }

    await this.mlTaskRouter.manualRetrain();
    logger.info('ML model retrained manually');
  }

  /**
   * Shutdown the manager
   */
  shutdown() {
    logger.info('Shutting down AgentManager');

    // Stop task assignment loop
    if (this.taskAssignmentTimer) {
      clearInterval(this.taskAssignmentTimer);
      this.taskAssignmentTimer = null;
    }

    // Shutdown ML router if present
    if (this.mlTaskRouter) {
      this.mlTaskRouter.shutdown();
    }

    // Shutdown registry
    this.registry.shutdown();

    // Clear data structures
    this.tasks.clear();
    this.taskQueue = [];
    this.agentInstances.clear();
    this.agentTaskCounts.clear();
    this.roundRobinIndex.clear();
  }
}
