/**
 * BPMN Service
 *
 * This service provides functionality for creating, managing, and transforming
 * BPMN 2.0 process definitions in the Flow2 editor.
 */

import { logger } from '@/utils/logger'

/**
 * Create a new BPMN process definition
 * @param {string} name - Process name
 * @param {string} description - Process description
 * @returns {Object} BPMN process definition
 */
export function createBPMNProcess(name, description = '') {
  const processId = `process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  return {
    id: processId,
    name,
    description,
    version: '1.0',
    isExecutable: true,
    processType: 'Private',
    elements: [],
    sequenceFlows: [],
    participants: [],
    lanes: [],
    variables: [],
    dataObjects: [],
    metadata: {
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    }
  }
}

/**
 * Create a BPMN Start Event
 * @param {string} label - Event label
 * @param {Object} position - Position {x, y}
 * @param {string} eventDefinitionType - Type of event definition
 * @returns {Object} BPMN start event node
 */
export function createStartEvent(label = 'Start', position = { x: 100, y: 100 }, eventDefinitionType = null) {
  const nodeId = `startEvent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  return {
    id: nodeId,
    type: 'bpmn:startEvent',
    position,
    data: {
      id: nodeId,
      type: 'bpmn:startEvent',
      label,
      eventDefinitionType
    }
  }
}

/**
 * Create a BPMN End Event
 * @param {string} label - Event label
 * @param {Object} position - Position {x, y}
 * @param {string} eventDefinitionType - Type of event definition
 * @returns {Object} BPMN end event node
 */
export function createEndEvent(label = 'End', position = { x: 400, y: 100 }, eventDefinitionType = null) {
  const nodeId = `endEvent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  return {
    id: nodeId,
    type: 'bpmn:endEvent',
    position,
    data: {
      id: nodeId,
      type: 'bpmn:endEvent',
      label,
      eventDefinitionType
    }
  }
}

/**
 * Create a BPMN Task
 * @param {string} label - Task label
 * @param {Object} position - Position {x, y}
 * @param {Object} options - Additional task options
 * @returns {Object} BPMN task node
 */
export function createTask(label = 'Task', position = { x: 250, y: 100 }, options = {}) {
  const nodeId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  return {
    id: nodeId,
    type: 'bpmn:task',
    position,
    data: {
      id: nodeId,
      type: 'bpmn:task',
      label,
      ...options
    }
  }
}

/**
 * Create a BPMN User Task
 * @param {string} label - Task label
 * @param {Object} position - Position {x, y}
 * @param {string} assignee - Task assignee
 * @param {Array} candidateGroups - Candidate groups
 * @returns {Object} BPMN user task node
 */
export function createUserTask(label = 'User Task', position = { x: 250, y: 100 }, assignee = null, candidateGroups = []) {
  const nodeId = `userTask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  return {
    id: nodeId,
    type: 'bpmn:userTask',
    position,
    data: {
      id: nodeId,
      type: 'bpmn:userTask',
      label,
      assignee,
      candidateGroups,
      candidateUsers: []
    }
  }
}

/**
 * Create a BPMN Service Task
 * @param {string} label - Task label
 * @param {Object} position - Position {x, y}
 * @param {string} implementation - Service implementation
 * @returns {Object} BPMN service task node
 */
export function createServiceTask(label = 'Service Task', position = { x: 250, y: 100 }, implementation = '') {
  const nodeId = `serviceTask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  return {
    id: nodeId,
    type: 'bpmn:serviceTask',
    position,
    data: {
      id: nodeId,
      type: 'bpmn:serviceTask',
      label,
      implementation
    }
  }
}

/**
 * Create a BPMN Script Task
 * @param {string} label - Task label
 * @param {Object} position - Position {x, y}
 * @param {string} scriptFormat - Script format (e.g., 'javascript', 'python')
 * @param {string} script - Script content
 * @returns {Object} BPMN script task node
 */
export function createScriptTask(label = 'Script Task', position = { x: 250, y: 100 }, scriptFormat = 'javascript', script = '') {
  const nodeId = `scriptTask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  return {
    id: nodeId,
    type: 'bpmn:scriptTask',
    position,
    data: {
      id: nodeId,
      type: 'bpmn:scriptTask',
      label,
      scriptFormat,
      script
    }
  }
}

/**
 * Create a BPMN Exclusive Gateway (XOR)
 * @param {string} label - Gateway label
 * @param {Object} position - Position {x, y}
 * @returns {Object} BPMN exclusive gateway node
 */
export function createExclusiveGateway(label = '', position = { x: 250, y: 100 }) {
  const nodeId = `exclusiveGateway_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  return {
    id: nodeId,
    type: 'bpmn:exclusiveGateway',
    position,
    data: {
      id: nodeId,
      type: 'bpmn:exclusiveGateway',
      label,
      gatewayType: 'XOR'
    }
  }
}

/**
 * Create a BPMN Parallel Gateway (AND)
 * @param {string} label - Gateway label
 * @param {Object} position - Position {x, y}
 * @returns {Object} BPMN parallel gateway node
 */
export function createParallelGateway(label = '', position = { x: 250, y: 100 }) {
  const nodeId = `parallelGateway_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  return {
    id: nodeId,
    type: 'bpmn:parallelGateway',
    position,
    data: {
      id: nodeId,
      type: 'bpmn:parallelGateway',
      label,
      gatewayType: 'AND'
    }
  }
}

/**
 * Create a BPMN Inclusive Gateway (OR)
 * @param {string} label - Gateway label
 * @param {Object} position - Position {x, y}
 * @returns {Object} BPMN inclusive gateway node
 */
export function createInclusiveGateway(label = '', position = { x: 250, y: 100 }) {
  const nodeId = `inclusiveGateway_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  return {
    id: nodeId,
    type: 'bpmn:inclusiveGateway',
    position,
    data: {
      id: nodeId,
      type: 'bpmn:inclusiveGateway',
      label,
      gatewayType: 'OR'
    }
  }
}

/**
 * Create a BPMN Sequence Flow
 * @param {string} sourceId - Source node ID
 * @param {string} targetId - Target node ID
 * @param {string} label - Flow label
 * @param {string} conditionExpression - Condition expression for conditional flows
 * @returns {Object} BPMN sequence flow edge
 */
export function createSequenceFlow(sourceId, targetId, label = '', conditionExpression = null) {
  const flowId = `sequenceFlow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  return {
    id: flowId,
    source: sourceId,
    target: targetId,
    type: 'default',
    animated: false,
    data: {
      id: flowId,
      source: sourceId,
      target: targetId,
      type: 'sequenceFlow',
      label,
      conditionExpression
    }
  }
}

/**
 * Validate BPMN process definition
 * @param {Object} process - BPMN process definition
 * @returns {Object} Validation result
 */
export function validateBPMNProcess(process) {
  const errors = []
  const warnings = []

  // Check for required fields
  if (!process.id) {
    errors.push({
      message: 'Process must have an ID',
      code: 'MISSING_PROCESS_ID',
      severity: 'error'
    })
  }

  if (!process.name) {
    errors.push({
      message: 'Process must have a name',
      code: 'MISSING_PROCESS_NAME',
      severity: 'error'
    })
  }

  // Check for start events
  const startEvents = process.elements.filter(el => el.type === 'bpmn:startEvent')
  if (startEvents.length === 0) {
    errors.push({
      message: 'Process must have at least one start event',
      code: 'MISSING_START_EVENT',
      severity: 'error'
    })
  }

  // Check for end events
  const endEvents = process.elements.filter(el => el.type === 'bpmn:endEvent')
  if (endEvents.length === 0) {
    warnings.push({
      message: 'Process should have at least one end event',
      code: 'MISSING_END_EVENT',
      severity: 'warning'
    })
  }

  // Check for orphaned nodes (nodes with no incoming or outgoing flows)
  const flowNodeIds = new Set()
  process.sequenceFlows.forEach(flow => {
    flowNodeIds.add(flow.source)
    flowNodeIds.add(flow.target)
  })

  process.elements.forEach(element => {
    if (!flowNodeIds.has(element.id) && element.type !== 'bpmn:startEvent' && element.type !== 'bpmn:endEvent') {
      warnings.push({
        elementId: element.id,
        message: `Node "${element.data.label || element.id}" is not connected`,
        code: 'ORPHANED_NODE',
        severity: 'warning'
      })
    }
  })

  // Check for gateways with only one outgoing flow
  const gateways = process.elements.filter(el => el.type.includes('Gateway'))
  gateways.forEach(gateway => {
    const outgoingFlows = process.sequenceFlows.filter(flow => flow.source === gateway.id)
    if (outgoingFlows.length <= 1) {
      warnings.push({
        elementId: gateway.id,
        message: `Gateway should have more than one outgoing sequence flow`,
        code: 'GATEWAY_SINGLE_OUTGOING',
        severity: 'warning'
      })
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Convert Vue Flow diagram to BPMN process definition
 * @param {Array} nodes - Vue Flow nodes
 * @param {Array} edges - Vue Flow edges
 * @param {Object} metadata - Process metadata
 * @returns {Object} BPMN process definition
 */
export function convertToBPMNProcess(nodes, edges, metadata = {}) {
  const processId = metadata.id || `process_${Date.now()}`

  const elements = nodes.map(node => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data
  }))

  const sequenceFlows = edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.data?.type || 'sequenceFlow',
    label: edge.data?.label || '',
    conditionExpression: edge.data?.conditionExpression || null
  }))

  return {
    id: processId,
    name: metadata.name || 'Unnamed Process',
    description: metadata.description || '',
    version: metadata.version || '1.0',
    isExecutable: metadata.isExecutable !== false,
    processType: metadata.processType || 'Private',
    elements,
    sequenceFlows,
    participants: metadata.participants || [],
    lanes: metadata.lanes || [],
    variables: metadata.variables || [],
    dataObjects: metadata.dataObjects || [],
    metadata: {
      created: metadata.created || new Date().toISOString(),
      modified: new Date().toISOString(),
      ...metadata.customMetadata
    }
  }
}

/**
 * Log BPMN operation
 * @param {string} operation - Operation name
 * @param {Object} details - Operation details
 */
function logBPMNOperation(operation, details) {
  logger.info(`BPMN Service: ${operation}`, details)
}

export default {
  createBPMNProcess,
  createStartEvent,
  createEndEvent,
  createTask,
  createUserTask,
  createServiceTask,
  createScriptTask,
  createExclusiveGateway,
  createParallelGateway,
  createInclusiveGateway,
  createSequenceFlow,
  validateBPMNProcess,
  convertToBPMNProcess
}
