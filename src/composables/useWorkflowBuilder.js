import { ref, computed } from 'vue'
import { useWorkflowStore } from '@/stores/workflowStore'

/**
 * @typedef {Object} WorkflowNode
 * @property {string} id - Unique node identifier
 * @property {string} type - Node type (StartNode, EndNode, DataSourceNode, etc.)
 * @property {string} label - Node display label
 * @property {Object} position - Node position on canvas
 * @property {number} position.x - X coordinate
 * @property {number} position.y - Y coordinate
 * @property {Object} data - Node data and configuration
 * @property {string} data.nodeType - Node type reference
 * @property {string} data.category - Node category (control|data|transform|agent)
 * @property {string} data.icon - PrimeVue icon class
 * @property {string} data.description - Node description
 * @property {Object} data.config - Node-specific configuration
 */

/**
 * @typedef {Object} WorkflowEdge
 * @property {string} id - Unique edge identifier
 * @property {string} source - Source node ID
 * @property {string} target - Target node ID
 * @property {string} type - Edge type (default|conditional)
 * @property {string} [label] - Edge label
 * @property {boolean} animated - Whether edge is animated
 * @property {Object} data - Edge data
 * @property {string} [data.condition] - Conditional expression
 */

/**
 * Composable for building and managing workflow diagrams in the Flow Editor
 *
 * Provides a complete workflow builder interface with node management,
 * validation, execution tracking, and import/export functionality. Supports
 * various node types including data sources, transformations, filters, joins,
 * agents, and control flow elements.
 *
 * @returns {Object} Workflow builder methods and state
 *
 * @example
 * import { useWorkflowBuilder } from '@/composables/useWorkflowBuilder'
 *
 * const builder = useWorkflowBuilder()
 *
 * // Add start node
 * const startNode = builder.addWorkflowNode('StartNode', { x: 100, y: 100 })
 *
 * // Add data source node
 * const dataNode = builder.addWorkflowNode('DataSourceNode', { x: 300, y: 100 })
 * builder.updateNodeConfig(dataNode.id, { tableId: 'sales', columns: ['id', 'amount'] })
 *
 * // Add filter node
 * const filterNode = builder.addWorkflowNode('FilterNode', { x: 500, y: 100 })
 * builder.updateNodeConfig(filterNode.id, { condition: 'amount > 100' })
 *
 * // Connect nodes
 * builder.connectNodes(startNode.id, dataNode.id)
 * builder.connectNodes(dataNode.id, filterNode.id)
 *
 * // Validate and save
 * if (builder.validateWorkflow()) {
 *   await builder.saveWorkflow('Sales Analysis', 'Filter high-value sales')
 * }
 */
export function useWorkflowBuilder() {
  const workflowStore = useWorkflowStore()

  const nodes = ref([])
  const edges = ref([])
  const selectedNode = ref(null)
  const validationErrors = ref([])
  const executionState = ref(null)

  // Workflow node types
  const nodeTypes = [
    {
      type: 'StartNode',
      label: 'Start',
      icon: 'pi-play',
      category: 'control',
      description: 'Workflow entry point',
      maxInstances: 1
    },
    {
      type: 'EndNode',
      label: 'End',
      icon: 'pi-stop',
      category: 'control',
      description: 'Workflow exit point',
      maxInstances: null
    },
    {
      type: 'DataSourceNode',
      label: 'Data Source',
      icon: 'pi-database',
      category: 'data',
      description: 'Load data from table'
    },
    {
      type: 'TransformNode',
      label: 'Transform',
      icon: 'pi-sync',
      category: 'transform',
      description: 'Apply transformation'
    },
    {
      type: 'FilterNode',
      label: 'Filter',
      icon: 'pi-filter',
      category: 'transform',
      description: 'Filter data rows'
    },
    {
      type: 'AggregateNode',
      label: 'Aggregate',
      icon: 'pi-chart-bar',
      category: 'transform',
      description: 'Aggregate data'
    },
    {
      type: 'JoinNode',
      label: 'Join',
      icon: 'pi-sitemap',
      category: 'transform',
      description: 'Join tables'
    },
    {
      type: 'ConditionNode',
      label: 'Condition',
      icon: 'pi-question',
      category: 'control',
      description: 'Conditional branching'
    },
    {
      type: 'LoopNode',
      label: 'Loop',
      icon: 'pi-replay',
      category: 'control',
      description: 'Iterate over data'
    },
    {
      type: 'AgentNode',
      label: 'Agent',
      icon: 'pi-android',
      category: 'agent',
      description: 'Call agent'
    },
    {
      type: 'OutputNode',
      label: 'Output',
      icon: 'pi-save',
      category: 'data',
      description: 'Save result'
    },
    {
      type: 'FrameNode',
      label: 'Frame',
      icon: 'pi-table',
      category: 'container',
      description: 'Group nodes in a frame',
      isContainer: true
    }
  ]

  // Add a new workflow node
  const addWorkflowNode = (type, position = { x: 100, y: 100 }) => {
    const nodeType = nodeTypes.find(t => t.type === type)
    if (!nodeType) {
      console.error('Unknown node type:', type)
      return null
    }

    // Check max instances
    if (nodeType.maxInstances !== null && nodeType.maxInstances !== undefined) {
      const existingCount = nodes.value.filter(n => n.type === type).length
      if (existingCount >= nodeType.maxInstances) {
        console.warn(`Maximum instances of ${type} reached`)
        return null
      }
    }

    const newNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      label: nodeType.label,
      position,
      data: {
        nodeType: type,
        category: nodeType.category,
        icon: nodeType.icon,
        description: nodeType.description,
        config: getDefaultConfig(type)
      }
    }

    nodes.value.push(newNode)
    return newNode
  }

  // Get default configuration for node type
  const getDefaultConfig = (type) => {
    switch (type) {
      case 'DataSourceNode':
        return { tableId: null, columns: [] }
      case 'TransformNode':
        return { operation: 'map', expression: '' }
      case 'FilterNode':
        return { condition: '', operator: 'and' }
      case 'AggregateNode':
        return { groupBy: [], functions: [] }
      case 'JoinNode':
        return { joinType: 'inner', leftKey: '', rightKey: '' }
      case 'ConditionNode':
        return { condition: '', trueLabel: 'Yes', falseLabel: 'No' }
      case 'LoopNode':
        return { iterationVar: 'item', collection: '' }
      case 'AgentNode':
        return { agentId: null, params: {} }
      case 'OutputNode':
        return { destination: 'table', name: '' }
      case 'FrameNode':
        return {
          label: 'New Frame',
          color: 'rgba(99, 102, 241, 0.1)',
          width: 400,
          height: 300,
          frameId: `frame-${Date.now()}`
        }
      default:
        return {}
    }
  }

  // Connect two nodes
  const connectNodes = (sourceId, targetId, label = null, condition = null) => {
    // Check if connection already exists
    const existingEdge = edges.value.find(
      e => e.source === sourceId && e.target === targetId
    )
    if (existingEdge) {
      console.warn('Connection already exists')
      return existingEdge
    }

    const edge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source: sourceId,
      target: targetId,
      type: condition ? 'conditional' : 'default',
      label: label || '',
      animated: true,
      data: {
        condition
      }
    }

    edges.value.push(edge)
    return edge
  }

  // Update node configuration
  const updateNodeConfig = (nodeId, config) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node) {
      node.data.config = { ...node.data.config, ...config }
    }
  }

  // Update node position
  const updateNodePosition = (nodeId, position) => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node) {
      node.position = position
    }
  }

  // Delete node
  const deleteNode = (nodeId) => {
    const nodeIndex = nodes.value.findIndex(n => n.id === nodeId)
    if (nodeIndex !== -1) {
      nodes.value.splice(nodeIndex, 1)
    }

    // Remove connected edges
    edges.value = edges.value.filter(e => e.source !== nodeId && e.target !== nodeId)
  }

  // Delete edge
  const deleteEdge = (edgeId) => {
    const edgeIndex = edges.value.findIndex(e => e.id === edgeId)
    if (edgeIndex !== -1) {
      edges.value.splice(edgeIndex, 1)
    }
  }

  // Validate workflow
  const validateWorkflow = () => {
    const errors = []

    // Check for start node
    const startNodes = nodes.value.filter(n => n.type === 'StartNode')
    if (startNodes.length === 0) {
      errors.push({
        message: 'Workflow must have a Start node',
        severity: 'error'
      })
    } else if (startNodes.length > 1) {
      errors.push({
        message: 'Workflow can only have one Start node',
        severity: 'error'
      })
    }

    // Check for end node
    const endNodes = nodes.value.filter(n => n.type === 'EndNode')
    if (endNodes.length === 0) {
      errors.push({
        message: 'Workflow should have at least one End node',
        severity: 'warning'
      })
    }

    // Check for orphaned nodes
    const connectedNodes = new Set()
    edges.value.forEach(edge => {
      connectedNodes.add(edge.source)
      connectedNodes.add(edge.target)
    })

    nodes.value.forEach(node => {
      if (!connectedNodes.has(node.id) && nodes.value.length > 1) {
        errors.push({
          nodeId: node.id,
          message: `Node "${node.label}" is not connected`,
          severity: 'warning'
        })
      }

      // Validate node configuration
      const configErrors = validateNodeConfig(node)
      errors.push(...configErrors)
    })

    // Check for dead ends
    nodes.value.forEach(node => {
      if (node.type !== 'EndNode') {
        const hasOutgoing = edges.value.some(e => e.source === node.id)
        if (!hasOutgoing && connectedNodes.has(node.id)) {
          errors.push({
            nodeId: node.id,
            message: `Node "${node.label}" has no outgoing connections`,
            severity: 'warning'
          })
        }
      }
    })

    validationErrors.value = errors
    return errors.filter(e => e.severity === 'error').length === 0
  }

  // Validate individual node configuration
  const validateNodeConfig = (node) => {
    const errors = []
    const config = node.data.config

    switch (node.type) {
      case 'DataSourceNode':
        if (!config.tableId) {
          errors.push({
            nodeId: node.id,
            message: `${node.label}: Table not selected`,
            severity: 'error'
          })
        }
        break
      case 'AgentNode':
        if (!config.agentId) {
          errors.push({
            nodeId: node.id,
            message: `${node.label}: Agent not selected`,
            severity: 'error'
          })
        }
        break
      case 'OutputNode':
        if (!config.name) {
          errors.push({
            nodeId: node.id,
            message: `${node.label}: Output name not specified`,
            severity: 'error'
          })
        }
        break
    }

    return errors
  }

  // Export workflow
  const exportWorkflow = () => {
    return {
      nodes: nodes.value.map(node => ({
        id: node.id,
        type: node.type,
        label: node.label,
        position: node.position,
        config: node.data.config
      })),
      edges: edges.value.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        label: edge.label,
        condition: edge.data?.condition
      })),
      exportedAt: new Date().toISOString()
    }
  }

  // Import workflow
  const importWorkflow = (workflow) => {
    nodes.value = workflow.nodes.map(node => {
      const nodeType = nodeTypes.find(t => t.type === node.type)
      return {
        ...node,
        data: {
          nodeType: node.type,
          category: nodeType?.category || 'unknown',
          icon: nodeType?.icon || 'pi-circle',
          description: nodeType?.description || '',
          config: node.config
        }
      }
    })

    edges.value = workflow.edges.map(edge => ({
      ...edge,
      animated: true,
      data: {
        condition: edge.condition
      }
    }))
  }

  // Save workflow
  const saveWorkflow = async (name, description = '') => {
    if (!validateWorkflow()) {
      throw new Error('Invalid workflow configuration')
    }

    const workflow = {
      name,
      description,
      configuration: exportWorkflow()
    }

    const savedWorkflow = workflowStore.addWorkflow(workflow)
    await workflowStore.saveWorkflow(savedWorkflow)

    return savedWorkflow
  }

  // Load workflow
  const loadWorkflow = (workflowId) => {
    const workflow = workflowStore.getWorkflowById(workflowId).value
    if (workflow && workflow.configuration) {
      importWorkflow(workflow.configuration)
    }
  }

  // Execute workflow
  const executeWorkflow = async (workflowId, params = {}) => {
    const executionId = await workflowStore.startWorkflowExecution(workflowId, params)
    executionState.value = {
      executionId,
      workflowId,
      status: 'running'
    }
    return executionId
  }

  // Update execution visualization
  const updateExecutionVisualization = (currentNodeId, progress) => {
    if (executionState.value) {
      executionState.value.currentNodeId = currentNodeId
      executionState.value.progress = progress
    }
  }

  // Clear canvas
  const clearCanvas = () => {
    nodes.value = []
    edges.value = []
    selectedNode.value = null
    validationErrors.value = []
    executionState.value = null
  }

  // Auto-layout nodes
  const autoLayout = () => {
    // Simple hierarchical layout
    const startNode = nodes.value.find(n => n.type === 'StartNode')
    if (!startNode) return

    const levels = []
    const visited = new Set()

    const buildLevels = (nodeId, level = 0) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      if (!levels[level]) levels[level] = []
      levels[level].push(nodeId)

      const outgoing = edges.value.filter(e => e.source === nodeId)
      outgoing.forEach(edge => buildLevels(edge.target, level + 1))
    }

    buildLevels(startNode.id)

    // Position nodes
    levels.forEach((level, levelIndex) => {
      level.forEach((nodeId, nodeIndex) => {
        const node = nodes.value.find(n => n.id === nodeId)
        if (node) {
          node.position = {
            x: 100 + levelIndex * 250,
            y: 100 + nodeIndex * 150
          }
        }
      })
    })
  }

  // Frame-specific methods
  const createFrame = (startPos, endPos) => {
    const width = Math.abs(endPos.x - startPos.x)
    const height = Math.abs(endPos.y - startPos.y)

    const position = {
      x: Math.min(startPos.x, endPos.x),
      y: Math.min(startPos.y, endPos.y)
    }

    const frameNode = addWorkflowNode('FrameNode', position)
    if (frameNode) {
      frameNode.data.config.width = Math.max(width, 200)
      frameNode.data.config.height = Math.max(height, 150)
    }
    return frameNode
  }

  const groupIntoFrame = (selectedNodeIds) => {
    if (!selectedNodeIds || selectedNodeIds.length === 0) return null

    // Calculate bounding box of selected nodes
    const selectedNodesList = nodes.value.filter(n => selectedNodeIds.includes(n.id))
    if (selectedNodesList.length === 0) return null

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    selectedNodesList.forEach(node => {
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + 160) // Assuming node width ~160
      maxY = Math.max(maxY, node.position.y + 80) // Assuming node height ~80
    })

    const padding = 20
    const headerHeight = 40

    // Create frame
    const frameId = `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const frameNode = {
      id: frameId,
      type: 'FrameNode',
      label: 'Frame',
      position: {
        x: minX - padding,
        y: minY - headerHeight - padding
      },
      data: {
        nodeType: 'FrameNode',
        category: 'container',
        icon: 'pi-table',
        description: 'Group nodes in a frame',
        config: {
          label: 'Group',
          color: 'rgba(99, 102, 241, 0.1)',
          width: maxX - minX + 2 * padding,
          height: maxY - minY + headerHeight + 2 * padding,
          frameId
        }
      },
      style: {
        zIndex: -1
      }
    }

    nodes.value.push(frameNode)

    // Update selected nodes to be children of frame
    selectedNodesList.forEach(node => {
      node.parentNode = frameId
      node.extent = 'parent'
      // Adjust position to be relative to frame
      node.position = {
        x: node.position.x - frameNode.position.x,
        y: node.position.y - frameNode.position.y
      }
    })

    return frameNode
  }

  const ungroupFrame = (frameId) => {
    const frameNode = nodes.value.find(n => n.id === frameId)
    if (!frameNode) return

    // Find all child nodes
    const childNodes = nodes.value.filter(n => n.parentNode === frameId)

    // Convert child positions back to absolute
    childNodes.forEach(node => {
      node.position = {
        x: node.position.x + frameNode.position.x,
        y: node.position.y + frameNode.position.y
      }
      delete node.parentNode
      delete node.extent
    })

    // Remove frame node
    deleteNode(frameId)
  }

  const deleteFrame = (frameId, deleteChildren = false) => {
    if (deleteChildren) {
      // Delete all child nodes first
      const childNodes = nodes.value.filter(n => n.parentNode === frameId)
      childNodes.forEach(node => deleteNode(node.id))
    } else {
      // Ungroup first
      ungroupFrame(frameId)
      return
    }

    // Delete frame
    deleteNode(frameId)
  }

  const updateFrameTitle = (frameId, title) => {
    const frameNode = nodes.value.find(n => n.id === frameId)
    if (frameNode && frameNode.data.config) {
      frameNode.data.config.label = title
    }
  }

  const updateFrameColor = (frameId, color) => {
    const frameNode = nodes.value.find(n => n.id === frameId)
    if (frameNode && frameNode.data.config) {
      frameNode.data.config.color = color
    }
  }

  const updateFrameSize = (frameId, size) => {
    const frameNode = nodes.value.find(n => n.id === frameId)
    if (frameNode && frameNode.data.config) {
      frameNode.data.config.width = size.width
      frameNode.data.config.height = size.height
    }
  }

  // Computed properties
  const nodeCount = computed(() => nodes.value.length)
  const edgeCount = computed(() => edges.value.length)
  const isValid = computed(() => {
    validateWorkflow()
    return validationErrors.value.filter(e => e.severity === 'error').length === 0
  })
  const hasStartNode = computed(() => nodes.value.some(n => n.type === 'StartNode'))
  const hasEndNode = computed(() => nodes.value.some(n => n.type === 'EndNode'))

  return {
    // State
    nodes,
    edges,
    selectedNode,
    validationErrors,
    executionState,
    nodeTypes,

    // Computed
    nodeCount,
    edgeCount,
    isValid,
    hasStartNode,
    hasEndNode,

    // Methods
    addWorkflowNode,
    connectNodes,
    updateNodeConfig,
    updateNodePosition,
    deleteNode,
    deleteEdge,
    validateWorkflow,
    exportWorkflow,
    importWorkflow,
    saveWorkflow,
    loadWorkflow,
    executeWorkflow,
    updateExecutionVisualization,
    clearCanvas,
    autoLayout,

    // Frame methods
    createFrame,
    groupIntoFrame,
    ungroupFrame,
    deleteFrame,
    updateFrameTitle,
    updateFrameColor,
    updateFrameSize
  }
}
