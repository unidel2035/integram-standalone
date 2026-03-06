import { logger } from '@/utils/logger'
import { ref, computed, onUnmounted } from 'vue'
import { useAgentStore } from '@/stores/agentStore'
import { useWorkflowStore } from '@/stores/workflowStore'

export function useAgentMonitoring() {
  const agentStore = useAgentStore()
  const workflowStore = useWorkflowStore()

  const ws = ref(null)
  const connected = ref(false)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5

  // WebSocket connection
  const connect = () => {
    if (ws.value) {
      ws.value.close()
    }

    try {
      // TODO: Update with actual WebSocket URL from environment
      const wsUrl = 'ws://localhost:3000/ws/agents'
      ws.value = new WebSocket(wsUrl)

      ws.value.onopen = () => {
        logger.debug('WebSocket connected')
        connected.value = true
        reconnectAttempts.value = 0
      }

      ws.value.onmessage = (event) => {
        handleWebSocketMessage(event.data)
      }

      ws.value.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.value.onclose = () => {
        logger.debug('WebSocket disconnected')
        connected.value = false
        attemptReconnect()
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
    }
  }

  // Reconnect logic
  const attemptReconnect = () => {
    if (reconnectAttempts.value < maxReconnectAttempts) {
      reconnectAttempts.value++
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.value), 30000)
      logger.debug(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.value})`)
      setTimeout(connect, delay)
    } else {
      console.error('Max reconnection attempts reached')
    }
  }

  // Handle WebSocket messages
  const handleWebSocketMessage = (data) => {
    try {
      const message = JSON.parse(data)

      switch (message.type) {
        case 'agent:status':
          handleAgentStatus(message.payload)
          break
        case 'agent:log':
          handleAgentLog(message.payload)
          break
        case 'agent:metrics':
          handleAgentMetrics(message.payload)
          break
        case 'workflow:progress':
          handleWorkflowProgress(message.payload)
          break
        case 'workflow:completed':
          handleWorkflowCompleted(message.payload)
          break
        case 'workflow:error':
          handleWorkflowError(message.payload)
          break
        default:
          console.warn('Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  // Event handlers
  const handleAgentStatus = (payload) => {
    const { agentId, status, details } = payload
    agentStore.updateAgentStatus(agentId, status)

    if (details) {
      agentStore.addAgentLog(agentId, {
        level: 'info',
        message: `Status changed to: ${status}`,
        details
      })
    }
  }

  const handleAgentLog = (payload) => {
    const { agentId, level, message, details } = payload
    agentStore.addAgentLog(agentId, { level, message, details })
  }

  const handleAgentMetrics = (payload) => {
    const { agentId, metrics } = payload
    agentStore.updateAgentMetrics(agentId, metrics)
  }

  const handleWorkflowProgress = (payload) => {
    const { workflowId, executionId, progress, currentStep } = payload
    workflowStore.updateExecutionProgress(workflowId, executionId, progress, currentStep)
  }

  const handleWorkflowCompleted = (payload) => {
    const { workflowId, executionId, results } = payload
    workflowStore.updateExecutionStatus(workflowId, executionId, 'completed', {
      progress: 100
    })
    if (results) {
      workflowStore.setWorkflowResults(workflowId, executionId, results)
    }
  }

  const handleWorkflowError = (payload) => {
    const { workflowId, executionId, error } = payload
    workflowStore.updateExecutionStatus(workflowId, executionId, 'error', {
      error: error.message,
      details: error.details
    })
  }

  // Send message via WebSocket
  const sendMessage = (type, payload) => {
    if (ws.value && connected.value) {
      ws.value.send(JSON.stringify({ type, payload }))
    } else {
      console.warn('WebSocket not connected')
    }
  }

  // Subscribe to agent updates
  const subscribeToAgent = (agentId) => {
    sendMessage('subscribe:agent', { agentId })
  }

  // Unsubscribe from agent updates
  const unsubscribeFromAgent = (agentId) => {
    sendMessage('unsubscribe:agent', { agentId })
  }

  // Subscribe to workflow updates
  const subscribeToWorkflow = (workflowId) => {
    sendMessage('subscribe:workflow', { workflowId })
  }

  // Unsubscribe from workflow updates
  const unsubscribeFromWorkflow = (workflowId) => {
    sendMessage('unsubscribe:workflow', { workflowId })
  }

  // Disconnect WebSocket
  const disconnect = () => {
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    connected.value = false
  }

  // Computed properties
  const activeAgents = computed(() => {
    return agentStore.allAgents.value.filter(agent => {
      const status = agentStore.getAgentStatus(agent.id).value
      return status?.status === 'running' || status?.status === 'active'
    })
  })

  const activeWorkflows = computed(() => {
    return workflowStore.state.activeWorkflows.map(workflowId => {
      const workflow = workflowStore.getWorkflowById(workflowId).value
      const execution = workflowStore.getLatestExecution(workflowId).value
      return {
        workflow,
        execution
      }
    })
  })

  const systemMetrics = computed(() => {
    const agents = agentStore.allAgents.value
    const totalAgents = agents.length
    const activeAgentsCount = activeAgents.value.length

    const statusCounts = {}
    agents.forEach(agent => {
      const status = agentStore.getAgentStatus(agent.id).value?.status || 'unknown'
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })

    return {
      totalAgents,
      activeAgents: activeAgentsCount,
      statusCounts,
      activeWorkflows: workflowStore.state.activeWorkflows.length
    }
  })

  // Polling fallback (when WebSocket is not available)
  const pollingInterval = ref(null)

  const startPolling = (interval = 5000) => {
    if (pollingInterval.value) {
      stopPolling()
    }

    pollingInterval.value = setInterval(async () => {
      try {
        // Poll agent statuses
        await agentStore.loadAgents()

        // Poll active workflow statuses
        for (const workflowId of workflowStore.state.activeWorkflows) {
          await workflowStore.loadWorkflowStatus(workflowId)
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, interval)
  }

  const stopPolling = () => {
    if (pollingInterval.value) {
      clearInterval(pollingInterval.value)
      pollingInterval.value = null
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect()
    stopPolling()
  })

  // Alert configuration
  const alerts = ref([])

  const addAlert = (alert) => {
    alerts.value.push({
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...alert,
      timestamp: new Date().toISOString()
    })

    // Auto-remove after 10 seconds
    setTimeout(() => {
      removeAlert(alert.id)
    }, 10000)
  }

  const removeAlert = (alertId) => {
    const index = alerts.value.findIndex(a => a.id === alertId)
    if (index !== -1) {
      alerts.value.splice(index, 1)
    }
  }

  const clearAlerts = () => {
    alerts.value = []
  }

  return {
    // State
    connected,
    reconnectAttempts,
    alerts,

    // Computed
    activeAgents,
    activeWorkflows,
    systemMetrics,

    // WebSocket methods
    connect,
    disconnect,
    sendMessage,
    subscribeToAgent,
    unsubscribeFromAgent,
    subscribeToWorkflow,
    unsubscribeFromWorkflow,

    // Polling methods
    startPolling,
    stopPolling,

    // Alert methods
    addAlert,
    removeAlert,
    clearAlerts
  }
}
