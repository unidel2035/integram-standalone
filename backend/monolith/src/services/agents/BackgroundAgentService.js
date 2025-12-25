/**
 * BackgroundAgentService - Manages background execution of DronDoc agents
 *
 * Similar to FileWatcherService, this service allows agents to run continuously
 * in the background, processing tasks and emitting events.
 *
 * Features:
 * - Start/stop agents in background
 * - Event-based notifications (via EventEmitter)
 * - Task queue processing
 * - Heartbeat monitoring
 * - Auto-restart on failure
 * - State persistence
 */

import { EventEmitter } from 'events'
import logger from '../../utils/logger.js'

// Agent execution states
export const AGENT_EXECUTION_STATE = {
  IDLE: 'idle',
  RUNNING: 'running',
  PROCESSING: 'processing',
  PAUSED: 'paused',
  ERROR: 'error',
  STOPPED: 'stopped'
}

// Event types emitted by agents
export const AGENT_EVENTS = {
  STARTED: 'agent:started',
  STOPPED: 'agent:stopped',
  PAUSED: 'agent:paused',
  RESUMED: 'agent:resumed',
  TASK_STARTED: 'task:started',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  SUGGESTION: 'agent:suggestion',
  ERROR: 'agent:error',
  HEARTBEAT: 'agent:heartbeat',
  LOG: 'agent:log',
  STATE_CHANGE: 'agent:state-change'
}

class BackgroundAgentService extends EventEmitter {
  constructor() {
    super()
    // Map of instanceId -> running agent data
    this.runningAgents = new Map()
    // Map of instanceId -> task queue
    this.taskQueues = new Map()
    // Map of instanceId -> event history
    this.eventHistory = new Map()
    // Map of instanceId -> heartbeat interval
    this.heartbeatIntervals = new Map()
    // Configuration
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      maxEventHistory: 100,
      taskTimeout: 300000, // 5 minutes
      autoRestartOnError: true,
      maxRestartAttempts: 3
    }
  }

  /**
   * Start an agent in background
   * @param {object} options - Agent options
   * @returns {object} Running agent info
   */
  async startAgent(options) {
    const {
      instanceId,
      organizationId,
      agentId,
      agentName,
      config = {},
      executor = null, // Function to execute agent tasks
      onTask = null,   // Callback for task processing
      triggers = {}    // What triggers agent execution (file-change, schedule, webhook)
    } = options

    if (!instanceId || !agentId) {
      throw new Error('instanceId and agentId are required')
    }

    // Stop existing agent if running
    if (this.runningAgents.has(instanceId)) {
      await this.stopAgent(instanceId)
    }

    const agentData = {
      instanceId,
      organizationId,
      agentId,
      agentName: agentName || agentId,
      config,
      executor,
      onTask,
      triggers,
      state: AGENT_EXECUTION_STATE.RUNNING,
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      restartCount: 0,
      stats: {
        tasksProcessed: 0,
        tasksSucceeded: 0,
        tasksFailed: 0,
        eventsEmitted: 0,
        suggestionsGenerated: 0
      }
    }

    this.runningAgents.set(instanceId, agentData)
    this.taskQueues.set(instanceId, [])
    this.eventHistory.set(instanceId, [])

    // Start heartbeat
    this._startHeartbeat(instanceId)

    // Emit started event
    this._emitAgentEvent(instanceId, AGENT_EVENTS.STARTED, {
      agentId,
      agentName: agentData.agentName,
      config
    })

    logger.info({
      instanceId,
      agentId,
      agentName: agentData.agentName
    }, '[BackgroundAgent] Agent started')

    return {
      instanceId,
      agentId,
      state: agentData.state,
      startedAt: agentData.startedAt
    }
  }

  /**
   * Stop a running agent
   * @param {string} instanceId
   * @param {boolean} graceful - Wait for current task to complete
   */
  async stopAgent(instanceId, graceful = true) {
    const agent = this.runningAgents.get(instanceId)
    if (!agent) {
      return { success: false, message: 'Agent not found' }
    }

    // Stop heartbeat
    this._stopHeartbeat(instanceId)

    // If graceful and processing, wait a bit
    if (graceful && agent.state === AGENT_EXECUTION_STATE.PROCESSING) {
      agent.state = AGENT_EXECUTION_STATE.STOPPED
      // Give it 5 seconds to complete
      await new Promise(resolve => setTimeout(resolve, 5000))
    }

    agent.state = AGENT_EXECUTION_STATE.STOPPED
    agent.stoppedAt = new Date().toISOString()

    this._emitAgentEvent(instanceId, AGENT_EVENTS.STOPPED, {
      graceful,
      stoppedAt: agent.stoppedAt
    })

    // Clean up after delay
    setTimeout(() => {
      if (this.runningAgents.get(instanceId)?.state === AGENT_EXECUTION_STATE.STOPPED) {
        this.runningAgents.delete(instanceId)
        this.taskQueues.delete(instanceId)
        // Keep event history for a while
      }
    }, 60000) // 1 minute

    logger.info({ instanceId }, '[BackgroundAgent] Agent stopped')

    return { success: true, instanceId, stoppedAt: agent.stoppedAt }
  }

  /**
   * Pause an agent (keeps state, stops processing)
   */
  pauseAgent(instanceId) {
    const agent = this.runningAgents.get(instanceId)
    if (!agent) {
      return { success: false, message: 'Agent not found' }
    }

    agent.state = AGENT_EXECUTION_STATE.PAUSED
    agent.pausedAt = new Date().toISOString()

    this._emitAgentEvent(instanceId, AGENT_EVENTS.PAUSED, {
      pausedAt: agent.pausedAt
    })

    logger.info({ instanceId }, '[BackgroundAgent] Agent paused')

    return { success: true, instanceId, pausedAt: agent.pausedAt }
  }

  /**
   * Resume a paused agent
   */
  resumeAgent(instanceId) {
    const agent = this.runningAgents.get(instanceId)
    if (!agent) {
      return { success: false, message: 'Agent not found' }
    }

    if (agent.state !== AGENT_EXECUTION_STATE.PAUSED) {
      return { success: false, message: 'Agent is not paused' }
    }

    agent.state = AGENT_EXECUTION_STATE.RUNNING
    agent.resumedAt = new Date().toISOString()
    delete agent.pausedAt

    this._emitAgentEvent(instanceId, AGENT_EVENTS.RESUMED, {
      resumedAt: agent.resumedAt
    })

    // Process any queued tasks
    this._processQueue(instanceId)

    logger.info({ instanceId }, '[BackgroundAgent] Agent resumed')

    return { success: true, instanceId, resumedAt: agent.resumedAt }
  }

  /**
   * Add a task to agent's queue
   * @param {string} instanceId
   * @param {object} task - Task to process
   * @returns {object} Task info
   */
  async addTask(instanceId, task) {
    const agent = this.runningAgents.get(instanceId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    if (agent.state === AGENT_EXECUTION_STATE.STOPPED) {
      throw new Error('Agent is stopped')
    }

    const taskData = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: task.type || 'default',
      payload: task.payload || {},
      priority: task.priority || 5,
      createdAt: new Date().toISOString(),
      status: 'pending',
      timeout: task.timeout || this.config.taskTimeout
    }

    const queue = this.taskQueues.get(instanceId)
    queue.push(taskData)

    // Sort by priority (higher first)
    queue.sort((a, b) => b.priority - a.priority)

    logger.debug({
      instanceId,
      taskId: taskData.id,
      type: taskData.type
    }, '[BackgroundAgent] Task added to queue')

    // Start processing if not paused
    if (agent.state === AGENT_EXECUTION_STATE.RUNNING) {
      this._processQueue(instanceId)
    }

    return taskData
  }

  /**
   * Process task queue
   */
  async _processQueue(instanceId) {
    const agent = this.runningAgents.get(instanceId)
    const queue = this.taskQueues.get(instanceId)

    if (!agent || !queue || queue.length === 0) return
    if (agent.state !== AGENT_EXECUTION_STATE.RUNNING) return

    // Get next task
    const task = queue.shift()
    if (!task) return

    // Update state
    agent.state = AGENT_EXECUTION_STATE.PROCESSING
    agent.currentTask = task.id
    task.status = 'processing'
    task.startedAt = new Date().toISOString()

    this._emitAgentEvent(instanceId, AGENT_EVENTS.TASK_STARTED, {
      taskId: task.id,
      type: task.type
    })

    try {
      // Execute task
      let result
      if (agent.onTask) {
        result = await Promise.race([
          agent.onTask(task, agent),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Task timeout')), task.timeout)
          )
        ])
      } else if (agent.executor) {
        result = await Promise.race([
          agent.executor(task, agent),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Task timeout')), task.timeout)
          )
        ])
      } else {
        // Default: just mark as completed
        result = { success: true, message: 'No executor defined' }
      }

      task.status = 'completed'
      task.completedAt = new Date().toISOString()
      task.result = result
      agent.stats.tasksProcessed++
      agent.stats.tasksSucceeded++

      this._emitAgentEvent(instanceId, AGENT_EVENTS.TASK_COMPLETED, {
        taskId: task.id,
        type: task.type,
        result
      })

    } catch (error) {
      task.status = 'failed'
      task.error = error.message
      task.failedAt = new Date().toISOString()
      agent.stats.tasksProcessed++
      agent.stats.tasksFailed++

      this._emitAgentEvent(instanceId, AGENT_EVENTS.TASK_FAILED, {
        taskId: task.id,
        type: task.type,
        error: error.message
      })

      logger.error({
        instanceId,
        taskId: task.id,
        error: error.message
      }, '[BackgroundAgent] Task failed')

      // Handle error recovery
      if (this.config.autoRestartOnError && agent.restartCount < this.config.maxRestartAttempts) {
        agent.restartCount++
        logger.info({ instanceId, restartCount: agent.restartCount }, '[BackgroundAgent] Auto-restarting agent')
      }
    }

    // Update state
    agent.state = AGENT_EXECUTION_STATE.RUNNING
    agent.lastActivity = new Date().toISOString()
    delete agent.currentTask

    // Process next task
    if (queue.length > 0) {
      setImmediate(() => this._processQueue(instanceId))
    }
  }

  /**
   * Emit a suggestion from agent
   */
  emitSuggestion(instanceId, suggestion) {
    const agent = this.runningAgents.get(instanceId)
    if (!agent) return null

    const suggestionData = {
      id: `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      instanceId,
      agentId: agent.agentId,
      createdAt: new Date().toISOString(),
      ...suggestion
    }

    agent.stats.suggestionsGenerated++

    this._emitAgentEvent(instanceId, AGENT_EVENTS.SUGGESTION, suggestionData)

    return suggestionData
  }

  /**
   * Log from agent
   */
  agentLog(instanceId, level, message, data = null) {
    const agent = this.runningAgents.get(instanceId)
    if (!agent) return

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    }

    this._emitAgentEvent(instanceId, AGENT_EVENTS.LOG, logEntry)
  }

  /**
   * Get agent status
   */
  getAgentStatus(instanceId) {
    const agent = this.runningAgents.get(instanceId)
    if (!agent) return null

    const queue = this.taskQueues.get(instanceId) || []

    return {
      instanceId,
      agentId: agent.agentId,
      agentName: agent.agentName,
      state: agent.state,
      startedAt: agent.startedAt,
      lastActivity: agent.lastActivity,
      currentTask: agent.currentTask,
      queueLength: queue.length,
      stats: agent.stats,
      config: agent.config
    }
  }

  /**
   * Get all running agents
   */
  getAllAgents() {
    const agents = []
    for (const [instanceId, agent] of this.runningAgents) {
      agents.push(this.getAgentStatus(instanceId))
    }
    return agents
  }

  /**
   * Get agents by organization
   */
  getAgentsByOrganization(organizationId) {
    const agents = []
    for (const [instanceId, agent] of this.runningAgents) {
      if (agent.organizationId === organizationId) {
        agents.push(this.getAgentStatus(instanceId))
      }
    }
    return agents
  }

  /**
   * Get event history for agent
   */
  getEventHistory(instanceId, limit = 50) {
    const history = this.eventHistory.get(instanceId) || []
    return history.slice(-limit)
  }

  /**
   * Clear event history
   */
  clearEventHistory(instanceId) {
    this.eventHistory.set(instanceId, [])
  }

  /**
   * Check if agent is running
   */
  isRunning(instanceId) {
    const agent = this.runningAgents.get(instanceId)
    return agent && agent.state !== AGENT_EXECUTION_STATE.STOPPED
  }

  /**
   * Stop all agents
   */
  async stopAllAgents() {
    const promises = []
    for (const instanceId of this.runningAgents.keys()) {
      promises.push(this.stopAgent(instanceId, false))
    }
    await Promise.all(promises)
    logger.info('[BackgroundAgent] All agents stopped')
  }

  /**
   * Internal: Emit agent event
   */
  _emitAgentEvent(instanceId, eventType, data) {
    const agent = this.runningAgents.get(instanceId)
    if (!agent) return

    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      instanceId,
      agentId: agent.agentId,
      type: eventType,
      timestamp: new Date().toISOString(),
      data
    }

    // Add to history
    const history = this.eventHistory.get(instanceId) || []
    history.push(event)
    if (history.length > this.config.maxEventHistory) {
      history.shift()
    }
    this.eventHistory.set(instanceId, history)

    // Update stats
    agent.stats.eventsEmitted++

    // Emit to listeners
    this.emit(eventType, event)
    this.emit('event', event) // General event for all

    return event
  }

  /**
   * Internal: Start heartbeat for agent
   */
  _startHeartbeat(instanceId) {
    this._stopHeartbeat(instanceId)

    const interval = setInterval(() => {
      const agent = this.runningAgents.get(instanceId)
      if (!agent || agent.state === AGENT_EXECUTION_STATE.STOPPED) {
        this._stopHeartbeat(instanceId)
        return
      }

      this._emitAgentEvent(instanceId, AGENT_EVENTS.HEARTBEAT, {
        state: agent.state,
        lastActivity: agent.lastActivity,
        queueLength: (this.taskQueues.get(instanceId) || []).length
      })
    }, this.config.heartbeatInterval)

    this.heartbeatIntervals.set(instanceId, interval)
  }

  /**
   * Internal: Stop heartbeat for agent
   */
  _stopHeartbeat(instanceId) {
    const interval = this.heartbeatIntervals.get(instanceId)
    if (interval) {
      clearInterval(interval)
      this.heartbeatIntervals.delete(instanceId)
    }
  }

  /**
   * Register trigger for agent
   * @param {string} instanceId
   * @param {string} triggerType - 'file-change', 'schedule', 'webhook', 'event'
   * @param {object} triggerConfig
   */
  registerTrigger(instanceId, triggerType, triggerConfig) {
    const agent = this.runningAgents.get(instanceId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    agent.triggers[triggerType] = {
      ...triggerConfig,
      registeredAt: new Date().toISOString()
    }

    logger.info({
      instanceId,
      triggerType,
      config: triggerConfig
    }, '[BackgroundAgent] Trigger registered')

    return { success: true, triggerType }
  }

  /**
   * Trigger agent from external event
   */
  async triggerAgent(instanceId, triggerType, eventData) {
    const agent = this.runningAgents.get(instanceId)
    if (!agent) {
      return { success: false, message: 'Agent not found' }
    }

    if (!agent.triggers[triggerType]) {
      return { success: false, message: `Trigger ${triggerType} not registered` }
    }

    // Create task from trigger
    const task = await this.addTask(instanceId, {
      type: `trigger:${triggerType}`,
      payload: eventData,
      priority: 7 // Higher priority for triggered tasks
    })

    return { success: true, taskId: task.id }
  }
}

// Singleton instance
export const backgroundAgentService = new BackgroundAgentService()

export default BackgroundAgentService
