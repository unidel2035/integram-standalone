import { logger } from '@/utils/logger'
import { reactive, computed } from 'vue'

const state = reactive({
  agents: [],
  activeAgents: [],
  agentDefinitions: {},
  agentStatus: {},
  agentLogs: {},
  agentMetrics: {}
})

export const useAgentStore = () => {
  // Getters
  const allAgents = computed(() => state.agents)
  const activeAgentsCount = computed(() => state.activeAgents.length)
  const getAgentById = (id) => computed(() => state.agents.find(a => a.id === id))
  const getAgentDefinition = (id) => computed(() => state.agentDefinitions[id])
  const getAgentStatus = (id) => computed(() => state.agentStatus[id] || 'unknown')
  const getAgentLogs = (id) => computed(() => state.agentLogs[id] || [])
  const getAgentMetrics = (id) => computed(() => state.agentMetrics[id] || {})

  // Actions
  const addAgent = (agent) => {
    const newAgent = {
      id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...agent,
      createdAt: new Date().toISOString()
    }
    state.agents.push(newAgent)
    return newAgent
  }

  const updateAgent = (id, updates) => {
    const index = state.agents.findIndex(a => a.id === id)
    if (index !== -1) {
      state.agents[index] = { ...state.agents[index], ...updates, updatedAt: new Date().toISOString() }
    }
  }

  const deleteAgent = (id) => {
    const index = state.agents.findIndex(a => a.id === id)
    if (index !== -1) {
      state.agents.splice(index, 1)
    }
    delete state.agentDefinitions[id]
    delete state.agentStatus[id]
    delete state.agentLogs[id]
    delete state.agentMetrics[id]
  }

  const saveAgentDefinition = (id, definition) => {
    state.agentDefinitions[id] = {
      ...definition,
      savedAt: new Date().toISOString()
    }
  }

  const updateAgentStatus = (id, status) => {
    state.agentStatus[id] = {
      status,
      timestamp: new Date().toISOString()
    }

    // Update active agents list
    const isActive = status === 'running' || status === 'active'
    const activeIndex = state.activeAgents.findIndex(a => a === id)

    if (isActive && activeIndex === -1) {
      state.activeAgents.push(id)
    } else if (!isActive && activeIndex !== -1) {
      state.activeAgents.splice(activeIndex, 1)
    }
  }

  const addAgentLog = (id, log) => {
    if (!state.agentLogs[id]) {
      state.agentLogs[id] = []
    }
    state.agentLogs[id].push({
      ...log,
      timestamp: new Date().toISOString()
    })

    // Keep only last 1000 logs
    if (state.agentLogs[id].length > 1000) {
      state.agentLogs[id] = state.agentLogs[id].slice(-1000)
    }
  }

  const clearAgentLogs = (id) => {
    state.agentLogs[id] = []
  }

  const updateAgentMetrics = (id, metrics) => {
    state.agentMetrics[id] = {
      ...state.agentMetrics[id],
      ...metrics,
      updatedAt: new Date().toISOString()
    }
  }

  const startAgent = async (id) => {
    updateAgentStatus(id, 'starting')
    try {
      // TODO: Call backend API to start agent
      // await window.api('agents', `${id}/start`, { method: 'POST' })
      updateAgentStatus(id, 'running')
      addAgentLog(id, { level: 'info', message: 'Agent started' })
    } catch (error) {
      updateAgentStatus(id, 'error')
      addAgentLog(id, { level: 'error', message: `Failed to start: ${error.message}` })
      throw error
    }
  }

  const stopAgent = async (id) => {
    updateAgentStatus(id, 'stopping')
    try {
      // TODO: Call backend API to stop agent
      // await window.api('agents', `${id}/stop`, { method: 'POST' })
      updateAgentStatus(id, 'stopped')
      addAgentLog(id, { level: 'info', message: 'Agent stopped' })
    } catch (error) {
      updateAgentStatus(id, 'error')
      addAgentLog(id, { level: 'error', message: `Failed to stop: ${error.message}` })
      throw error
    }
  }

  const restartAgent = async (id) => {
    await stopAgent(id)
    await new Promise(resolve => setTimeout(resolve, 500)) // Wait 500ms
    await startAgent(id)
  }

  const loadAgents = async () => {
    try {
      // TODO: Call backend API to load agents
      // const response = await window.api('agents', 'entities')
      // state.agents = response.agents || []
      logger.debug('Loading agents from backend...')
    } catch (error) {
      console.error('Failed to load agents:', error)
      throw error
    }
  }

  const saveAgent = async (agent) => {
    try {
      // TODO: Call backend API to save agent
      // const response = await window.api('agents', 'entities', {
      //   method: 'POST',
      //   body: agent
      // })
      // return response
      logger.debug('Saving agent to backend:', agent)
      return agent
    } catch (error) {
      console.error('Failed to save agent:', error)
      throw error
    }
  }

  const exportAgent = (id) => {
    const agent = state.agents.find(a => a.id === id)
    const definition = state.agentDefinitions[id]

    if (!agent) {
      throw new Error(`Agent ${id} not found`)
    }

    return {
      agent,
      definition,
      exportedAt: new Date().toISOString()
    }
  }

  const importAgent = (data) => {
    const newAgent = addAgent(data.agent)
    if (data.definition) {
      saveAgentDefinition(newAgent.id, data.definition)
    }
    return newAgent
  }

  return {
    // State
    state,
    // Getters
    allAgents,
    activeAgentsCount,
    getAgentById,
    getAgentDefinition,
    getAgentStatus,
    getAgentLogs,
    getAgentMetrics,
    // Actions
    addAgent,
    updateAgent,
    deleteAgent,
    saveAgentDefinition,
    updateAgentStatus,
    addAgentLog,
    clearAgentLogs,
    updateAgentMetrics,
    startAgent,
    stopAgent,
    restartAgent,
    loadAgents,
    saveAgent,
    exportAgent,
    importAgent
  }
}

export default useAgentStore
