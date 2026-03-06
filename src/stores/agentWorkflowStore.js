import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * Store for managing agent-specific workflows
 * Each agent can have its own workflow configuration that defines its internal logic
 */
export const useAgentWorkflowStore = defineStore('agentWorkflow', () => {
  // State: Map of agentId -> workflow configuration
  const agentWorkflows = ref({})

  // Getters
  const getAgentWorkflow = computed(() => (agentId) => {
    return agentWorkflows.value[agentId] || null
  })

  const getAllAgentWorkflows = computed(() => agentWorkflows.value)

  const hasWorkflow = computed(() => (agentId) => {
    return !!agentWorkflows.value[agentId]
  })

  const getWorkflowStatus = computed(() => (agentId) => {
    const workflow = agentWorkflows.value[agentId]
    if (!workflow) return 'none'
    return workflow.status || 'draft'
  })

  // Actions
  function saveAgentWorkflow(agentId, workflowConfig) {
    if (!agentId) {
      throw new Error('Agent ID is required')
    }

    const workflow = {
      ...workflowConfig,
      agentId,
      updatedAt: new Date().toISOString(),
      status: workflowConfig.status || 'active'
    }

    // Add createdAt if it's a new workflow
    if (!agentWorkflows.value[agentId]) {
      workflow.createdAt = new Date().toISOString()
      workflow.version = 1
    } else {
      // Preserve createdAt and increment version
      workflow.createdAt = agentWorkflows.value[agentId].createdAt
      workflow.version = (agentWorkflows.value[agentId].version || 1) + 1
    }

    agentWorkflows.value[agentId] = workflow

    // Persist to localStorage
    persistToLocalStorage()

    return workflow
  }

  function deleteAgentWorkflow(agentId) {
    if (agentWorkflows.value[agentId]) {
      delete agentWorkflows.value[agentId]
      persistToLocalStorage()
      return true
    }
    return false
  }

  function clearAllWorkflows() {
    agentWorkflows.value = {}
    persistToLocalStorage()
  }

  function updateWorkflowStatus(agentId, status) {
    if (agentWorkflows.value[agentId]) {
      agentWorkflows.value[agentId].status = status
      agentWorkflows.value[agentId].updatedAt = new Date().toISOString()
      persistToLocalStorage()
      return true
    }
    return false
  }

  function exportAgentWorkflow(agentId) {
    const workflow = agentWorkflows.value[agentId]
    if (!workflow) {
      throw new Error(`No workflow found for agent: ${agentId}`)
    }
    return JSON.stringify(workflow, null, 2)
  }

  function importAgentWorkflow(agentId, workflowJson) {
    try {
      const workflow = typeof workflowJson === 'string'
        ? JSON.parse(workflowJson)
        : workflowJson

      return saveAgentWorkflow(agentId, workflow)
    } catch (error) {
      throw new Error(`Failed to import workflow: ${error.message}`)
    }
  }

  // Persistence
  function persistToLocalStorage() {
    try {
      localStorage.setItem('agentWorkflows', JSON.stringify(agentWorkflows.value))
    } catch (error) {
      console.error('Failed to persist agent workflows to localStorage:', error)
    }
  }

  function loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('agentWorkflows')
      if (stored) {
        agentWorkflows.value = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load agent workflows from localStorage:', error)
    }
  }

  // Initialize from localStorage on store creation
  loadFromLocalStorage()

  return {
    // State
    agentWorkflows,

    // Getters
    getAgentWorkflow,
    getAllAgentWorkflows,
    hasWorkflow,
    getWorkflowStatus,

    // Actions
    saveAgentWorkflow,
    deleteAgentWorkflow,
    clearAllWorkflows,
    updateWorkflowStatus,
    exportAgentWorkflow,
    importAgentWorkflow,
    loadFromLocalStorage
  }
})
