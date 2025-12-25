/**
 * ProcessOrchestrator - Workflow Runtime Execution Engine
 *
 * Orchestrates process execution with state management through Role-Sets.
 * Implements Process Execution Engine (Phase 3) for BPMN process workflows.
 *
 * Key Responsibilities:
 * - Process instance lifecycle (start, pause, resume, cancel, complete)
 * - Task distribution to agents
 * - Gateway execution (exclusive, parallel, inclusive)
 * - Event correlation (message, timer, signal, error)
 * - State persistence via Role-Sets
 *
 * @see Issue #2460 - Phase 3: Process Execution Engine
 * @see /CLAUDE.md - Flow Editor Development Guidelines (Role-Sets)
 */

import EventEmitter from 'events'
import { randomUUID } from 'crypto'
import logger from '../../utils/logger.js'
import { RoleSetStorage } from '../../storage/RoleSetStorage.js'
import {
  PROCESS_EXECUTION_PRISM,
  PROCESS_EXECUTION_ROLES,
  isValidProcessState,
  isValidTaskState,
  isValidEventType
} from '../../prisms/ProcessExecutionPrism.js'

/**
 * Process states
 */
export const ProcessState = {
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

/**
 * Task states
 */
export const TaskState = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

/**
 * Event types
 */
export const EventType = {
  MESSAGE: 'message',
  TIMER: 'timer',
  SIGNAL: 'signal',
  ERROR: 'error',
  ESCALATION: 'escalation',
  CONDITIONAL: 'conditional',
  COMPENSATION: 'compensation'
}

/**
 * Gateway types
 */
export const GatewayType = {
  EXCLUSIVE: 'exclusive', // XOR - one path
  PARALLEL: 'parallel', // AND - all paths
  INCLUSIVE: 'inclusive', // OR - multiple paths based on conditions
  EVENT_BASED: 'eventBased' // Wait for events
}

/**
 * ProcessOrchestrator Class
 * Manages process instance lifecycle and execution
 */
export class ProcessOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super()

    // Dependencies
    this.agentManager = options.agentManager
    this.storage = options.storage || new RoleSetStorage()

    // In-memory active instances for quick access
    this.activeInstances = new Map() // processInstanceId -> instance metadata

    // Prism and role IDs (initialized later)
    this.prismId = null
    this.roleIds = {}

    // Configuration
    this.maxConcurrentInstances = options.maxConcurrentInstances || 100
    this.taskExecutionTimeout = options.taskExecutionTimeout || 300000 // 5 minutes
    this.enableVariableSnapshots = options.enableVariableSnapshots !== false

    logger.info('ProcessOrchestrator initialized', {
      maxConcurrentInstances: this.maxConcurrentInstances,
      taskExecutionTimeout: this.taskExecutionTimeout
    })
  }

  /**
   * Initialize prism and roles
   */
  async initialize() {
    try {
      // Ensure ProcessExecution prism exists
      const prisms = await this.storage.getAllPrisms()
      let prism = prisms.find(p => p.name === PROCESS_EXECUTION_PRISM.name)

      if (!prism) {
        logger.info('Creating ProcessExecution prism...')
        prism = await this.storage.createPrism(PROCESS_EXECUTION_PRISM)
      }

      this.prismId = prism.id

      // Ensure roles exist
      const existingRoles = await this.storage.getRolesByPrism(this.prismId)

      for (const [roleName, roleDefinition] of Object.entries(PROCESS_EXECUTION_ROLES)) {
        let role = existingRoles.find(r => r.name === roleName)

        if (!role) {
          logger.info(`Creating role: ${roleName}`)
          role = await this.storage.createRole(this.prismId, roleDefinition)
        }

        this.roleIds[roleName] = role.id
      }

      logger.info('ProcessOrchestrator initialized with prism', {
        prismId: this.prismId,
        roles: Object.keys(this.roleIds)
      })
    } catch (error) {
      logger.error('Failed to initialize ProcessOrchestrator:', error)
      throw error
    }
  }

  /**
   * Start a new process instance
   *
   * @param {Object} processDefinition - BPMN process definition
   * @param {Object} variables - Initial process variables
   * @param {Object} options - Start options (businessKey, priority, etc.)
   * @returns {Promise<Object>} Process instance
   */
  async startProcess(processDefinition, variables = {}, options = {}) {
    // Validate process definition
    if (!processDefinition || !processDefinition.id) {
      throw new Error('Invalid process definition: missing id')
    }

    if (!processDefinition.nodes || processDefinition.nodes.length === 0) {
      throw new Error('Invalid process definition: no nodes')
    }

    // Check max concurrent instances
    if (this.activeInstances.size >= this.maxConcurrentInstances) {
      throw new Error('Maximum concurrent process instances reached')
    }

    try {
      // Create Thing for process instance
      const instanceThing = await this.storage.createThing()
      const instanceId = instanceThing.id

      // Create ProcessInstance role binding
      const witness = {
        processDefinitionId: processDefinition.id,
        state: ProcessState.RUNNING,
        variables,
        startTime: new Date().toISOString(),
        currentNodeIds: [],
        businessKey: options.businessKey,
        priority: options.priority || 5,
        metadata: options.metadata || {}
      }

      const binding = await this.storage.createRoleBinding(
        instanceId,
        this.prismId,
        this.roleIds.ProcessInstance,
        witness
      )

      // Create initial variable snapshot
      if (this.enableVariableSnapshots) {
        await this.createVariableSnapshot(instanceId, variables, 'process_start', 'checkpoint')
      }

      // Add to active instances
      this.activeInstances.set(instanceId, {
        id: instanceId,
        definitionId: processDefinition.id,
        startTime: new Date(),
        state: ProcessState.RUNNING
      })

      logger.info('Process instance started', {
        instanceId,
        definitionId: processDefinition.id,
        businessKey: options.businessKey
      })

      this.emit('process:started', { instanceId, processDefinition, variables })

      // Find and execute start event
      const startEvent = processDefinition.nodes.find(n =>
        n.type === 'bpmn:startEvent'
      )

      if (!startEvent) {
        throw new Error('No start event found in process definition')
      }

      // Execute from start event
      await this.executeNode(instanceId, processDefinition, startEvent)

      return {
        instanceId,
        state: ProcessState.RUNNING,
        startTime: witness.startTime,
        variables
      }
    } catch (error) {
      logger.error('Failed to start process:', error)
      throw error
    }
  }

  /**
   * Execute a node in the process
   */
  async executeNode(instanceId, processDefinition, node) {
    try {
      logger.debug('Executing node', { instanceId, nodeId: node.id, nodeType: node.type })

      // Update current node IDs
      await this.updateCurrentNodes(instanceId, [node.id])

      switch (node.type) {
        case 'bpmn:startEvent':
          await this.executeStartEvent(instanceId, processDefinition, node)
          break

        case 'bpmn:endEvent':
          await this.executeEndEvent(instanceId, processDefinition, node)
          break

        case 'bpmn:task':
        case 'bpmn:userTask':
        case 'bpmn:serviceTask':
        case 'bpmn:scriptTask':
          await this.executeTask(instanceId, processDefinition, node)
          break

        case 'bpmn:exclusiveGateway':
          await this.executeExclusiveGateway(instanceId, processDefinition, node)
          break

        case 'bpmn:parallelGateway':
          await this.executeParallelGateway(instanceId, processDefinition, node)
          break

        case 'bpmn:inclusiveGateway':
          await this.executeInclusiveGateway(instanceId, processDefinition, node)
          break

        case 'bpmn:intermediateCatchEvent':
          await this.executeIntermediateCatchEvent(instanceId, processDefinition, node)
          break

        case 'bpmn:intermediateThrowEvent':
          await this.executeIntermediateThrowEvent(instanceId, processDefinition, node)
          break

        default:
          logger.warn('Unknown node type', { nodeType: node.type, nodeId: node.id })
          // Continue to next nodes
          await this.continueExecution(instanceId, processDefinition, node)
      }
    } catch (error) {
      logger.error('Failed to execute node:', error, { instanceId, nodeId: node.id })
      await this.failProcess(instanceId, error)
      throw error
    }
  }

  /**
   * Execute start event
   */
  async executeStartEvent(instanceId, processDefinition, node) {
    logger.debug('Executing start event', { instanceId, nodeId: node.id })

    // Record event occurrence
    await this.recordEventOccurrence(instanceId, EventType.SIGNAL, {
      eventName: 'process_start',
      sourceNodeId: node.id,
      payload: {}
    })

    // Continue to next nodes
    await this.continueExecution(instanceId, processDefinition, node)
  }

  /**
   * Execute end event
   */
  async executeEndEvent(instanceId, processDefinition, node) {
    logger.debug('Executing end event', { instanceId, nodeId: node.id })

    // Record event occurrence
    await this.recordEventOccurrence(instanceId, EventType.SIGNAL, {
      eventName: 'process_end',
      sourceNodeId: node.id,
      payload: {}
    })

    // Complete process
    await this.completeProcess(instanceId)
  }

  /**
   * Execute task (assign to agent)
   */
  async executeTask(instanceId, processDefinition, node) {
    try {
      // Get process instance to access variables
      const instance = await this.getProcessInstance(instanceId)

      // Create TaskInstance Thing and role binding
      const taskThing = await this.storage.createThing()
      const taskId = taskThing.id

      const taskWitness = {
        processInstanceId: instanceId,
        nodeId: node.id,
        state: TaskState.ACTIVE,
        taskType: node.type.replace('bpmn:', ''),
        assignee: node.data?.assignee,
        startTime: new Date().toISOString(),
        inputVariables: node.data?.inputVariables || {},
        metadata: node.data?.metadata || {}
      }

      await this.storage.createRoleBinding(
        taskId,
        this.prismId,
        this.roleIds.TaskInstance,
        taskWitness
      )

      logger.info('Task created', { instanceId, taskId, nodeId: node.id })

      this.emit('task:created', { instanceId, taskId, node })

      // Assign to agent if AgentManager is available
      if (this.agentManager) {
        const task = {
          id: taskId,
          type: node.type,
          data: node.data || {},
          requiredCapabilities: this.getRequiredCapabilities(node),
          priority: instance.priority || 5,
          metadata: {
            processInstanceId: instanceId,
            nodeId: node.id
          }
        }

        try {
          const result = await this.agentManager.assignTask(task)

          // Update task with result
          await this.completeTask(taskId, result)

          // Continue to next nodes after task completion
          await this.continueExecution(instanceId, processDefinition, node)
        } catch (error) {
          logger.error('Task execution failed:', error, { taskId })
          await this.failTask(taskId, error)
          throw error
        }
      } else {
        // No agent manager - mark task as pending
        logger.warn('No AgentManager available - task created but not assigned', { taskId })
        this.emit('task:pending', { taskId, node })
      }
    } catch (error) {
      logger.error('Failed to execute task:', error)
      throw error
    }
  }

  /**
   * Execute exclusive gateway (XOR) - one path
   */
  async executeExclusiveGateway(instanceId, processDefinition, node) {
    const instance = await this.getProcessInstance(instanceId)
    const variables = instance.variables

    // Get outgoing edges
    const outgoingEdges = this.getOutgoingEdges(processDefinition, node)

    // Evaluate conditions
    for (const edge of outgoingEdges) {
      const condition = edge.condition || edge.data?.condition

      if (this.evaluateCondition(condition, variables)) {
        logger.debug('Exclusive gateway condition matched', {
          instanceId,
          edgeId: edge.id,
          targetNodeId: edge.target
        })

        const nextNode = this.getNodeById(processDefinition, edge.target)
        await this.executeNode(instanceId, processDefinition, nextNode)
        return // Only one path for XOR
      }
    }

    // No condition matched - check for default flow
    const defaultEdge = outgoingEdges.find(e => e.isDefault || e.data?.isDefault)
    if (defaultEdge) {
      logger.debug('Using default flow in exclusive gateway', { instanceId })
      const nextNode = this.getNodeById(processDefinition, defaultEdge.target)
      await this.executeNode(instanceId, processDefinition, nextNode)
    } else {
      throw new Error('No condition matched in exclusive gateway and no default flow')
    }
  }

  /**
   * Execute parallel gateway (AND) - all paths
   */
  async executeParallelGateway(instanceId, processDefinition, node) {
    const outgoingEdges = this.getOutgoingEdges(processDefinition, node)

    logger.debug('Executing parallel gateway', {
      instanceId,
      nodeId: node.id,
      paths: outgoingEdges.length
    })

    // Execute all outgoing paths in parallel
    await Promise.all(
      outgoingEdges.map(async (edge) => {
        const nextNode = this.getNodeById(processDefinition, edge.target)
        await this.executeNode(instanceId, processDefinition, nextNode)
      })
    )
  }

  /**
   * Execute inclusive gateway (OR) - multiple paths based on conditions
   */
  async executeInclusiveGateway(instanceId, processDefinition, node) {
    const instance = await this.getProcessInstance(instanceId)
    const variables = instance.variables
    const outgoingEdges = this.getOutgoingEdges(processDefinition, node)

    // Evaluate all conditions and execute matching paths
    const matchingEdges = outgoingEdges.filter(edge => {
      const condition = edge.condition || edge.data?.condition
      return this.evaluateCondition(condition, variables)
    })

    if (matchingEdges.length === 0) {
      // No conditions matched - use default flow
      const defaultEdge = outgoingEdges.find(e => e.isDefault || e.data?.isDefault)
      if (defaultEdge) {
        const nextNode = this.getNodeById(processDefinition, defaultEdge.target)
        await this.executeNode(instanceId, processDefinition, nextNode)
      } else {
        logger.warn('No conditions matched in inclusive gateway and no default flow')
      }
    } else {
      // Execute all matching paths in parallel
      await Promise.all(
        matchingEdges.map(async (edge) => {
          const nextNode = this.getNodeById(processDefinition, edge.target)
          await this.executeNode(instanceId, processDefinition, nextNode)
        })
      )
    }
  }

  /**
   * Execute intermediate catch event (wait for event)
   */
  async executeIntermediateCatchEvent(instanceId, processDefinition, node) {
    const eventType = node.data?.eventType || EventType.MESSAGE

    logger.debug('Waiting for intermediate catch event', {
      instanceId,
      nodeId: node.id,
      eventType
    })

    // In a real implementation, this would register a listener and pause execution
    // For now, we'll emit an event and assume external event handling
    this.emit('event:waiting', { instanceId, nodeId: node.id, eventType })

    // TODO: Implement event correlation and waiting logic
    // For now, continue execution (simplified)
    await this.continueExecution(instanceId, processDefinition, node)
  }

  /**
   * Execute intermediate throw event (trigger event)
   */
  async executeIntermediateThrowEvent(instanceId, processDefinition, node) {
    const eventType = node.data?.eventType || EventType.SIGNAL
    const eventName = node.data?.eventName

    await this.recordEventOccurrence(instanceId, eventType, {
      eventName,
      sourceNodeId: node.id,
      payload: node.data?.payload || {}
    })

    this.emit('event:thrown', { instanceId, eventType, eventName })

    await this.continueExecution(instanceId, processDefinition, node)
  }

  /**
   * Continue execution to next nodes
   */
  async continueExecution(instanceId, processDefinition, currentNode) {
    const outgoingEdges = this.getOutgoingEdges(processDefinition, currentNode)

    for (const edge of outgoingEdges) {
      const nextNode = this.getNodeById(processDefinition, edge.target)
      await this.executeNode(instanceId, processDefinition, nextNode)
    }
  }

  /**
   * Complete a task
   */
  async completeTask(taskId, result) {
    const bindings = await this.storage.getRoleBindingsByThing(taskId)
    const taskBinding = bindings.find(b => b.roleId === this.roleIds.TaskInstance)

    if (!taskBinding) {
      throw new Error(`Task binding not found: ${taskId}`)
    }

    const updatedWitness = {
      ...taskBinding.witness,
      state: TaskState.COMPLETED,
      endTime: new Date().toISOString(),
      result
    }

    await this.storage.updateRoleBinding(taskBinding.id, updatedWitness)

    logger.info('Task completed', { taskId })
    this.emit('task:completed', { taskId, result })
  }

  /**
   * Fail a task
   */
  async failTask(taskId, error) {
    const bindings = await this.storage.getRoleBindingsByThing(taskId)
    const taskBinding = bindings.find(b => b.roleId === this.roleIds.TaskInstance)

    if (!taskBinding) {
      throw new Error(`Task binding not found: ${taskId}`)
    }

    const updatedWitness = {
      ...taskBinding.witness,
      state: TaskState.FAILED,
      endTime: new Date().toISOString(),
      error: error.message || String(error)
    }

    await this.storage.updateRoleBinding(taskBinding.id, updatedWitness)

    logger.error('Task failed', { taskId, error: error.message })
    this.emit('task:failed', { taskId, error })
  }

  /**
   * Complete process instance
   */
  async completeProcess(instanceId) {
    const bindings = await this.storage.getRoleBindingsByThing(instanceId)
    const instanceBinding = bindings.find(b => b.roleId === this.roleIds.ProcessInstance)

    if (!instanceBinding) {
      throw new Error(`Process instance binding not found: ${instanceId}`)
    }

    const updatedWitness = {
      ...instanceBinding.witness,
      state: ProcessState.COMPLETED,
      endTime: new Date().toISOString(),
      currentNodeIds: []
    }

    await this.storage.updateRoleBinding(instanceBinding.id, updatedWitness)

    // Create final variable snapshot
    if (this.enableVariableSnapshots) {
      await this.createVariableSnapshot(
        instanceId,
        instanceBinding.witness.variables,
        'process_end',
        'checkpoint'
      )
    }

    // Remove from active instances
    this.activeInstances.delete(instanceId)

    logger.info('Process completed', { instanceId })
    this.emit('process:completed', { instanceId })
  }

  /**
   * Fail process instance
   */
  async failProcess(instanceId, error) {
    const bindings = await this.storage.getRoleBindingsByThing(instanceId)
    const instanceBinding = bindings.find(b => b.roleId === this.roleIds.ProcessInstance)

    if (!instanceBinding) {
      throw new Error(`Process instance binding not found: ${instanceId}`)
    }

    const updatedWitness = {
      ...instanceBinding.witness,
      state: ProcessState.FAILED,
      endTime: new Date().toISOString(),
      currentNodeIds: [],
      metadata: {
        ...instanceBinding.witness.metadata,
        error: error.message || String(error)
      }
    }

    await this.storage.updateRoleBinding(instanceBinding.id, updatedWitness)

    // Remove from active instances
    this.activeInstances.delete(instanceId)

    logger.error('Process failed', { instanceId, error: error.message })
    this.emit('process:failed', { instanceId, error })
  }

  /**
   * Pause process instance
   */
  async pauseProcess(instanceId) {
    const bindings = await this.storage.getRoleBindingsByThing(instanceId)
    const instanceBinding = bindings.find(b => b.roleId === this.roleIds.ProcessInstance)

    if (!instanceBinding) {
      throw new Error(`Process instance binding not found: ${instanceId}`)
    }

    const updatedWitness = {
      ...instanceBinding.witness,
      state: ProcessState.PAUSED
    }

    await this.storage.updateRoleBinding(instanceBinding.id, updatedWitness)

    logger.info('Process paused', { instanceId })
    this.emit('process:paused', { instanceId })
  }

  /**
   * Resume process instance
   */
  async resumeProcess(instanceId) {
    const bindings = await this.storage.getRoleBindingsByThing(instanceId)
    const instanceBinding = bindings.find(b => b.roleId === this.roleIds.ProcessInstance)

    if (!instanceBinding) {
      throw new Error(`Process instance binding not found: ${instanceId}`)
    }

    if (instanceBinding.witness.state !== ProcessState.PAUSED) {
      throw new Error(`Cannot resume process in state: ${instanceBinding.witness.state}`)
    }

    const updatedWitness = {
      ...instanceBinding.witness,
      state: ProcessState.RUNNING
    }

    await this.storage.updateRoleBinding(instanceBinding.id, updatedWitness)

    logger.info('Process resumed', { instanceId })
    this.emit('process:resumed', { instanceId })

    // TODO: Resume execution from current nodes
  }

  /**
   * Cancel process instance
   */
  async cancelProcess(instanceId) {
    const bindings = await this.storage.getRoleBindingsByThing(instanceId)
    const instanceBinding = bindings.find(b => b.roleId === this.roleIds.ProcessInstance)

    if (!instanceBinding) {
      throw new Error(`Process instance binding not found: ${instanceId}`)
    }

    const updatedWitness = {
      ...instanceBinding.witness,
      state: ProcessState.CANCELLED,
      endTime: new Date().toISOString(),
      currentNodeIds: []
    }

    await this.storage.updateRoleBinding(instanceBinding.id, updatedWitness)

    // Remove from active instances
    this.activeInstances.delete(instanceId)

    logger.info('Process cancelled', { instanceId })
    this.emit('process:cancelled', { instanceId })
  }

  /**
   * Get process instance
   */
  async getProcessInstance(instanceId) {
    const bindings = await this.storage.getRoleBindingsByThing(instanceId)
    const instanceBinding = bindings.find(b => b.roleId === this.roleIds.ProcessInstance)

    if (!instanceBinding) {
      throw new Error(`Process instance not found: ${instanceId}`)
    }

    return {
      id: instanceId,
      ...instanceBinding.witness
    }
  }

  /**
   * Get all active process instances
   */
  async getActiveProcessInstances() {
    const allBindings = await this.storage.getAllRoleBindings()
    const instanceBindings = allBindings.filter(
      b => b.roleId === this.roleIds.ProcessInstance &&
        b.witness.state === ProcessState.RUNNING
    )

    return instanceBindings.map(b => ({
      id: b.thingId,
      ...b.witness
    }))
  }

  /**
   * Record event occurrence
   */
  async recordEventOccurrence(instanceId, eventType, eventData = {}) {
    const eventThing = await this.storage.createThing()
    const eventId = eventThing.id

    const witness = {
      processInstanceId: instanceId,
      eventType,
      timestamp: new Date().toISOString(),
      ...eventData,
      handled: false
    }

    await this.storage.createRoleBinding(
      eventId,
      this.prismId,
      this.roleIds.EventOccurrence,
      witness
    )

    logger.debug('Event recorded', { instanceId, eventType, eventId })
    this.emit('event:recorded', { instanceId, eventType, eventId })

    return eventId
  }

  /**
   * Create variable snapshot
   */
  async createVariableSnapshot(instanceId, variables, triggeredBy, snapshotType = 'checkpoint') {
    const snapshotThing = await this.storage.createThing()
    const snapshotId = snapshotThing.id

    const witness = {
      processInstanceId: instanceId,
      timestamp: new Date().toISOString(),
      variables,
      triggeredBy,
      snapshotType
    }

    await this.storage.createRoleBinding(
      snapshotId,
      this.prismId,
      this.roleIds.VariableSnapshot,
      witness
    )

    logger.debug('Variable snapshot created', { instanceId, snapshotId, triggeredBy })
    return snapshotId
  }

  /**
   * Update current executing nodes
   */
  async updateCurrentNodes(instanceId, nodeIds) {
    const bindings = await this.storage.getRoleBindingsByThing(instanceId)
    const instanceBinding = bindings.find(b => b.roleId === this.roleIds.ProcessInstance)

    if (!instanceBinding) {
      throw new Error(`Process instance binding not found: ${instanceId}`)
    }

    const updatedWitness = {
      ...instanceBinding.witness,
      currentNodeIds: nodeIds
    }

    await this.storage.updateRoleBinding(instanceBinding.id, updatedWitness)
  }

  /**
   * Helper: Get outgoing edges from a node
   */
  getOutgoingEdges(processDefinition, node) {
    return processDefinition.edges.filter(edge => edge.source === node.id)
  }

  /**
   * Helper: Get node by ID
   */
  getNodeById(processDefinition, nodeId) {
    const node = processDefinition.nodes.find(n => n.id === nodeId)
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`)
    }
    return node
  }

  /**
   * Helper: Evaluate condition expression
   */
  evaluateCondition(condition, variables) {
    if (!condition) {
      return true // No condition = always true
    }

    try {
      // Simple expression evaluation (can be enhanced with a proper expression parser)
      // For now, support basic comparisons like "amount > 1000"
      const func = new Function('variables', `with(variables) { return ${condition}; }`)
      return func(variables)
    } catch (error) {
      logger.error('Failed to evaluate condition:', error, { condition })
      return false
    }
  }

  /**
   * Helper: Get required capabilities from node
   */
  getRequiredCapabilities(node) {
    return node.data?.requiredCapabilities || ['generic']
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activeInstances: this.activeInstances.size,
      maxConcurrentInstances: this.maxConcurrentInstances
    }
  }

  /**
   * Shutdown orchestrator
   */
  async shutdown() {
    logger.info('Shutting down ProcessOrchestrator')
    this.activeInstances.clear()
    this.removeAllListeners()
  }
}
