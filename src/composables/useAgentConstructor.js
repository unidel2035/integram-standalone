import { ref, computed } from 'vue'
import { useAgentStore } from '@/stores/agentStore'

export function useAgentConstructor() {
  const agentStore = useAgentStore()

  const nodes = ref([])
  const edges = ref([])
  const selectedNode = ref(null)
  const validationErrors = ref([])

  // Agent types configuration
  const agentTypes = [
    {
      type: 'TableAnalyzerAgent',
      label: 'Table Analyzer',
      icon: 'pi-chart-bar',
      description: 'Analyze table structure and data',
      defaultConfig: {
        analysisTypes: ['structure', 'data', 'statistics'],
        depth: 'full',
        thresholds: {
          nullPercentage: 10,
          uniquePercentage: 95
        }
      }
    },
    {
      type: 'DataTransformAgent',
      label: 'Data Transform',
      icon: 'pi-refresh',
      description: 'Transform and manipulate data',
      defaultConfig: {
        transformationType: 'map',
        rules: [],
        validation: true
      }
    },
    {
      type: 'ValidatorAgent',
      label: 'Validator',
      icon: 'pi-check-circle',
      description: 'Validate data against rules',
      defaultConfig: {
        rules: [],
        severityLevels: ['error', 'warning', 'info'],
        stopOnError: true
      }
    },
    {
      type: 'ReportGeneratorAgent',
      label: 'Report Generator',
      icon: 'pi-file',
      description: 'Generate reports from data',
      defaultConfig: {
        format: 'pdf',
        template: 'default',
        includeCharts: true
      }
    },
    {
      type: 'IntegrationAgent',
      label: 'Integration',
      icon: 'pi-link',
      description: 'Connect with external systems',
      defaultConfig: {
        endpoint: '',
        method: 'POST',
        auth: 'bearer',
        mapping: {}
      }
    }
  ]

  // Add a new agent node
  const addAgentNode = (type, position = { x: 100, y: 100 }) => {
    const agentType = agentTypes.find(t => t.type === type)
    if (!agentType) {
      console.error('Unknown agent type:', type)
      return null
    }

    const newNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      label: agentType.label,
      position,
      data: {
        config: { ...agentType.defaultConfig },
        agentType: type,
        icon: agentType.icon,
        description: agentType.description
      }
    }

    nodes.value.push(newNode)
    return newNode
  }

  // Connect two nodes
  const connectNodes = (sourceId, targetId, edgeType = 'default') => {
    const edge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source: sourceId,
      target: targetId,
      type: edgeType,
      animated: true
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

  // Validate configuration
  const validateConfiguration = () => {
    const errors = []

    // Check for disconnected nodes
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
      if (!node.data.config) {
        errors.push({
          nodeId: node.id,
          message: `Node "${node.label}" has no configuration`,
          severity: 'error'
        })
      }
    })

    // Check for cycles
    const hasCycles = detectCycles()
    if (hasCycles) {
      errors.push({
        message: 'Configuration contains cycles',
        severity: 'error'
      })
    }

    validationErrors.value = errors
    return errors.length === 0
  }

  // Detect cycles in the graph
  const detectCycles = () => {
    const visited = new Set()
    const recStack = new Set()

    const dfs = (nodeId) => {
      visited.add(nodeId)
      recStack.add(nodeId)

      const outgoingEdges = edges.value.filter(e => e.source === nodeId)
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          if (dfs(edge.target)) return true
        } else if (recStack.has(edge.target)) {
          return true
        }
      }

      recStack.delete(nodeId)
      return false
    }

    for (const node of nodes.value) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true
      }
    }

    return false
  }

  // Export configuration
  const exportConfiguration = () => {
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
        type: edge.type
      })),
      exportedAt: new Date().toISOString()
    }
  }

  // Import configuration
  const importConfiguration = (config) => {
    nodes.value = config.nodes.map(node => ({
      ...node,
      data: {
        config: node.config,
        agentType: node.type,
        icon: agentTypes.find(t => t.type === node.type)?.icon || 'pi-circle',
        description: agentTypes.find(t => t.type === node.type)?.description || ''
      }
    }))

    edges.value = config.edges.map(edge => ({
      ...edge,
      animated: true
    }))
  }

  // Save agent definition
  const saveAgentDefinition = async (name, description = '') => {
    if (!validateConfiguration()) {
      throw new Error('Invalid configuration')
    }

    const agent = {
      name,
      description,
      type: 'composite',
      configuration: exportConfiguration()
    }

    const savedAgent = agentStore.addAgent(agent)
    agentStore.saveAgentDefinition(savedAgent.id, agent.configuration)

    // Save to backend
    await agentStore.saveAgent(savedAgent)

    return savedAgent
  }

  // Load agent definition
  const loadAgentDefinition = (agentId) => {
    const definition = agentStore.getAgentDefinition(agentId).value
    if (definition) {
      importConfiguration(definition)
    }
  }

  // Clear canvas
  const clearCanvas = () => {
    nodes.value = []
    edges.value = []
    selectedNode.value = null
    validationErrors.value = []
  }

  // Generate code preview
  const generateCodePreview = () => {
    const config = exportConfiguration()
    return JSON.stringify(config, null, 2)
  }

  // Computed properties
  const nodeCount = computed(() => nodes.value.length)
  const edgeCount = computed(() => edges.value.length)
  const isValid = computed(() => validateConfiguration())

  return {
    // State
    nodes,
    edges,
    selectedNode,
    validationErrors,
    agentTypes,

    // Computed
    nodeCount,
    edgeCount,
    isValid,

    // Methods
    addAgentNode,
    connectNodes,
    updateNodeConfig,
    deleteNode,
    deleteEdge,
    validateConfiguration,
    exportConfiguration,
    importConfiguration,
    saveAgentDefinition,
    loadAgentDefinition,
    clearCanvas,
    generateCodePreview
  }
}
