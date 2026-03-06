/**
 * Composable for managing agent execution state
 * Provides reactive state for thinking blocks, execution steps, and workflow visualization
 */
import { ref, computed, reactive, watch } from 'vue'

export function useAgentExecution() {
  // State
  const currentAgent = ref(null)
  const involvedAgents = ref([])
  const executionStatus = ref('idle') // idle, running, completed, error
  const currentAction = ref('')
  const executionStartTime = ref(null)

  // Thinking state
  const thinking = ref('')
  const thinkingType = ref('')
  const thinkingDuration = ref(null)
  const isThinking = ref(false)

  // Execution steps
  const steps = ref([])
  let stepIdCounter = 0

  // Workflow state (Taskade-like)
  const workflowNodes = ref([])
  const workflowEdges = ref([])

  // Handoff state
  const currentHandoff = ref(null)

  // Methods

  /**
   * Start agent execution
   */
  const startExecution = (agent) => {
    currentAgent.value = agent
    executionStatus.value = 'running'
    executionStartTime.value = Date.now()
    steps.value = []
    thinking.value = ''

    if (agent && !involvedAgents.value.find(a => a.id === agent.id)) {
      involvedAgents.value.push(agent)
    }

    // Add start node to workflow
    addWorkflowNode({
      id: 'start',
      label: 'Start',
      type: 'start',
      status: 'completed'
    })
  }

  /**
   * End agent execution
   */
  const endExecution = (status = 'completed') => {
    executionStatus.value = status
    currentAction.value = ''
    isThinking.value = false

    // Add end node to workflow
    addWorkflowNode({
      id: 'end',
      label: status === 'error' ? 'Error' : 'Complete',
      type: 'end',
      status: status
    })
  }

  /**
   * Update thinking content (streaming)
   */
  const updateThinking = (content, options = {}) => {
    thinking.value = content
    thinkingType.value = options.type || ''
    isThinking.value = true

    if (options.duration) {
      thinkingDuration.value = options.duration
    }
  }

  /**
   * Clear thinking block
   */
  const clearThinking = () => {
    if (isThinking.value) {
      thinkingDuration.value = Date.now() - (executionStartTime.value || Date.now())
    }
    isThinking.value = false
  }

  /**
   * Add execution step
   */
  const addStep = (step) => {
    const newStep = {
      id: `step-${++stepIdCounter}`,
      status: 'running',
      startTime: Date.now(),
      ...step
    }

    steps.value.push(newStep)
    currentAction.value = step.title || step.type

    // Add to workflow if it's a significant step
    if (step.addToWorkflow !== false) {
      addWorkflowNode({
        id: newStep.id,
        label: step.title,
        type: step.type,
        status: 'running'
      })
    }

    return newStep.id
  }

  /**
   * Update step status
   */
  const updateStep = (stepId, updates) => {
    const step = steps.value.find(s => s.id === stepId)
    if (step) {
      Object.assign(step, updates)

      if (updates.status === 'completed' || updates.status === 'error') {
        step.duration = Date.now() - step.startTime
      }

      // Update workflow node
      updateWorkflowNode(stepId, { status: updates.status })
    }
  }

  /**
   * Complete a step
   */
  const completeStep = (stepId, result = null) => {
    updateStep(stepId, {
      status: 'completed',
      result
    })
  }

  /**
   * Fail a step
   */
  const failStep = (stepId, error = null) => {
    updateStep(stepId, {
      status: 'error',
      error
    })
  }

  /**
   * Add tool call step
   */
  const addToolCall = (toolName, toolInput) => {
    return addStep({
      type: 'tool_call',
      title: `Calling ${toolName}`,
      toolName,
      toolInput
    })
  }

  /**
   * Add API call step
   */
  const addApiCall = (endpoint, method = 'GET') => {
    return addStep({
      type: 'api_call',
      title: `${method} ${endpoint}`,
      endpoint,
      method
    })
  }

  /**
   * Add search step
   */
  const addSearch = (query) => {
    return addStep({
      type: 'search',
      title: `Searching: ${query.substring(0, 50)}...`,
      query
    })
  }

  /**
   * Agent handoff
   */
  const handoffToAgent = (toAgent, reason = '', context = null) => {
    const fromAgent = currentAgent.value

    currentHandoff.value = {
      from: fromAgent,
      to: toAgent,
      reason,
      context,
      timestamp: Date.now()
    }

    // Add handoff step
    addStep({
      type: 'handoff',
      title: `Handing off to ${toAgent.name}`,
      fromAgent: fromAgent?.name || 'Unknown',
      toAgent: toAgent.name,
      reason
    })

    // Update current agent
    currentAgent.value = toAgent
    if (!involvedAgents.value.find(a => a.id === toAgent.id)) {
      involvedAgents.value.push(toAgent)
    }

    // Add handoff edge in workflow
    const fromNodeId = workflowNodes.value[workflowNodes.value.length - 2]?.id
    const toNodeId = `agent-${toAgent.id}`

    addWorkflowNode({
      id: toNodeId,
      label: toAgent.name,
      type: 'agent',
      icon: toAgent.icon,
      status: 'running'
    })

    if (fromNodeId) {
      addWorkflowEdge(fromNodeId, toNodeId, { animated: true })
    }

    // Clear handoff after animation
    setTimeout(() => {
      currentHandoff.value = null
    }, 3000)
  }

  // Workflow methods

  /**
   * Add workflow node
   */
  const addWorkflowNode = (node) => {
    const existingIndex = workflowNodes.value.findIndex(n => n.id === node.id)
    if (existingIndex >= 0) {
      workflowNodes.value[existingIndex] = { ...workflowNodes.value[existingIndex], ...node }
    } else {
      workflowNodes.value.push(node)

      // Auto-connect to previous node
      if (workflowNodes.value.length > 1) {
        const prevNode = workflowNodes.value[workflowNodes.value.length - 2]
        addWorkflowEdge(prevNode.id, node.id)
      }
    }
  }

  /**
   * Update workflow node
   */
  const updateWorkflowNode = (nodeId, updates) => {
    const node = workflowNodes.value.find(n => n.id === nodeId)
    if (node) {
      Object.assign(node, updates)
    }
  }

  /**
   * Add workflow edge
   */
  const addWorkflowEdge = (sourceId, targetId, options = {}) => {
    const edgeId = `${sourceId}->${targetId}`
    const existingIndex = workflowEdges.value.findIndex(e => e.id === edgeId)

    if (existingIndex < 0) {
      workflowEdges.value.push({
        id: edgeId,
        source: sourceId,
        target: targetId,
        ...options
      })
    }
  }

  /**
   * Reset all state
   */
  const reset = () => {
    currentAgent.value = null
    involvedAgents.value = []
    executionStatus.value = 'idle'
    currentAction.value = ''
    executionStartTime.value = null
    thinking.value = ''
    thinkingType.value = ''
    thinkingDuration.value = null
    isThinking.value = false
    steps.value = []
    workflowNodes.value = []
    workflowEdges.value = []
    currentHandoff.value = null
    stepIdCounter = 0
  }

  /**
   * Parse streaming response and extract thinking blocks
   */
  const parseStreamingResponse = (chunk) => {
    // Check for thinking block markers
    if (chunk.includes('<thinking>')) {
      isThinking.value = true
      const thinkingMatch = chunk.match(/<thinking>([\s\S]*?)(?:<\/thinking>|$)/)
      if (thinkingMatch) {
        thinking.value = thinkingMatch[1]
      }
    } else if (chunk.includes('</thinking>')) {
      clearThinking()
    } else if (isThinking.value) {
      thinking.value += chunk
    }

    // Check for tool use markers
    if (chunk.includes('<tool_call>') || chunk.includes('"tool_calls"')) {
      // Parse tool call from chunk
      try {
        const toolMatch = chunk.match(/"name":\s*"([^"]+)"/)
        if (toolMatch) {
          addToolCall(toolMatch[1], {})
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    return chunk
  }

  // Computed
  const isRunning = computed(() => executionStatus.value === 'running')
  const hasSteps = computed(() => steps.value.length > 0)
  const hasWorkflow = computed(() => workflowNodes.value.length > 0)
  const completedSteps = computed(() => steps.value.filter(s => s.status === 'completed').length)
  const totalSteps = computed(() => steps.value.length)
  const progress = computed(() => {
    if (totalSteps.value === 0) return 0
    return Math.round((completedSteps.value / totalSteps.value) * 100)
  })

  return {
    // State
    currentAgent,
    involvedAgents,
    executionStatus,
    currentAction,
    executionStartTime,
    thinking,
    thinkingType,
    thinkingDuration,
    isThinking,
    steps,
    workflowNodes,
    workflowEdges,
    currentHandoff,

    // Computed
    isRunning,
    hasSteps,
    hasWorkflow,
    completedSteps,
    totalSteps,
    progress,

    // Methods
    startExecution,
    endExecution,
    updateThinking,
    clearThinking,
    addStep,
    updateStep,
    completeStep,
    failStep,
    addToolCall,
    addApiCall,
    addSearch,
    handoffToAgent,
    addWorkflowNode,
    updateWorkflowNode,
    addWorkflowEdge,
    reset,
    parseStreamingResponse
  }
}

export default useAgentExecution
