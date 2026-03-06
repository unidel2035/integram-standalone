import { logger } from '@/utils/logger'
import { reactive, computed } from 'vue'

/**
 * @typedef {Object} Workflow
 * @property {string} id - Unique workflow identifier
 * @property {string} name - Workflow name
 * @property {string} description - Workflow description
 * @property {Object} configuration - Workflow configuration with nodes and edges
 * @property {string} createdAt - Creation timestamp in ISO format
 * @property {string} [updatedAt] - Last update timestamp in ISO format
 * @property {number} version - Current version number
 */

/**
 * @typedef {Object} WorkflowExecution
 * @property {string} id - Unique execution identifier
 * @property {string} workflowId - ID of the workflow being executed
 * @property {string} status - Execution status (running|completed|error|cancelled)
 * @property {Object} params - Execution parameters
 * @property {string} startedAt - Execution start timestamp
 * @property {string} [finishedAt] - Execution finish timestamp
 * @property {number} progress - Execution progress (0-100)
 * @property {string|null} currentStep - Current execution step
 */

/**
 * Reactive state for workflow management
 */
const state = reactive({
  workflows: [],
  activeWorkflows: [],
  workflowExecutions: {},
  workflowResults: {},
  workflowVersions: {}
})

/**
 * Composable for managing workflows in the Flow Editor
 *
 * Provides functionality for creating, updating, executing, and managing workflows.
 * Includes version control, execution tracking, and import/export capabilities.
 *
 * @returns {Object} Workflow store methods and state
 *
 * @example
 * import { useWorkflowStore } from '@/stores/workflowStore'
 *
 * const workflowStore = useWorkflowStore()
 * const newWorkflow = workflowStore.addWorkflow({
 *   name: 'Data Processing',
 *   description: 'Process sales data',
 *   configuration: { nodes: [], edges: [] }
 * })
 */
export const useWorkflowStore = () => {
  // Getters
  const allWorkflows = computed(() => state.workflows)
  const activeWorkflowsCount = computed(() => state.activeWorkflows.length)
  const getWorkflowById = (id) => computed(() => state.workflows.find(w => w.id === id))
  const getWorkflowExecutions = (id) => computed(() => state.workflowExecutions[id] || [])
  const getWorkflowResults = (id) => computed(() => state.workflowResults[id])
  const getWorkflowVersions = (id) => computed(() => state.workflowVersions[id] || [])
  const getLatestExecution = (id) => computed(() => {
    const executions = state.workflowExecutions[id] || []
    return executions[executions.length - 1]
  })

  // Actions
  /**
   * Adds a new workflow to the store
   *
   * @param {Object} workflow - Workflow data
   * @param {string} workflow.name - Workflow name
   * @param {string} workflow.description - Workflow description
   * @param {Object} workflow.configuration - Workflow configuration
   * @returns {Workflow} Created workflow with generated ID and metadata
   *
   * @example
   * const workflow = addWorkflow({
   *   name: 'Sales Analysis',
   *   description: 'Analyze sales data',
   *   configuration: { nodes: [...], edges: [...] }
   * })
   */
  const addWorkflow = (workflow) => {
    const newWorkflow = {
      id: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...workflow,
      createdAt: new Date().toISOString(),
      version: 1
    }
    state.workflows.push(newWorkflow)

    // Initialize versions array
    state.workflowVersions[newWorkflow.id] = [{
      version: 1,
      workflow: { ...newWorkflow },
      createdAt: newWorkflow.createdAt
    }]

    return newWorkflow
  }

  const updateWorkflow = (id, updates) => {
    const index = state.workflows.findIndex(w => w.id === id)
    if (index !== -1) {
      const currentVersion = state.workflows[index].version || 1
      const newVersion = currentVersion + 1

      state.workflows[index] = {
        ...state.workflows[index],
        ...updates,
        updatedAt: new Date().toISOString(),
        version: newVersion
      }

      // Save version
      if (!state.workflowVersions[id]) {
        state.workflowVersions[id] = []
      }
      state.workflowVersions[id].push({
        version: newVersion,
        workflow: { ...state.workflows[index] },
        createdAt: new Date().toISOString()
      })
    }
  }

  const deleteWorkflow = (id) => {
    const index = state.workflows.findIndex(w => w.id === id)
    if (index !== -1) {
      state.workflows.splice(index, 1)
    }
    delete state.workflowExecutions[id]
    delete state.workflowResults[id]
    delete state.workflowVersions[id]

    // Remove from active workflows
    const activeIndex = state.activeWorkflows.findIndex(w => w === id)
    if (activeIndex !== -1) {
      state.activeWorkflows.splice(activeIndex, 1)
    }
  }

  const startWorkflowExecution = async (id, params = {}) => {
    const workflow = state.workflows.find(w => w.id === id)
    if (!workflow) {
      throw new Error(`Workflow ${id} not found`)
    }

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const execution = {
      id: executionId,
      workflowId: id,
      status: 'running',
      params,
      startedAt: new Date().toISOString(),
      progress: 0,
      currentStep: null
    }

    if (!state.workflowExecutions[id]) {
      state.workflowExecutions[id] = []
    }
    state.workflowExecutions[id].push(execution)

    // Add to active workflows
    if (!state.activeWorkflows.includes(id)) {
      state.activeWorkflows.push(id)
    }

    try {
      // TODO: Call backend API to execute workflow
      // const response = await window.api('workflows', `${id}/execute`, {
      //   method: 'POST',
      //   body: { executionId, params }
      // })
      logger.debug('Starting workflow execution:', executionId)
      return executionId
    } catch (error) {
      updateExecutionStatus(id, executionId, 'error', { error: error.message })
      throw error
    }
  }

  const updateExecutionStatus = (workflowId, executionId, status, data = {}) => {
    const executions = state.workflowExecutions[workflowId]
    if (!executions) return

    const execution = executions.find(e => e.id === executionId)
    if (!execution) return

    Object.assign(execution, {
      status,
      ...data,
      updatedAt: new Date().toISOString()
    })

    // If execution is completed or errored, remove from active workflows
    if (status === 'completed' || status === 'error' || status === 'cancelled') {
      execution.finishedAt = new Date().toISOString()

      // Check if there are any other running executions
      const hasRunningExecutions = executions.some(e =>
        e.status === 'running' && e.id !== executionId
      )

      if (!hasRunningExecutions) {
        const activeIndex = state.activeWorkflows.findIndex(w => w === workflowId)
        if (activeIndex !== -1) {
          state.activeWorkflows.splice(activeIndex, 1)
        }
      }
    }
  }

  const updateExecutionProgress = (workflowId, executionId, progress, currentStep) => {
    const executions = state.workflowExecutions[workflowId]
    if (!executions) return

    const execution = executions.find(e => e.id === executionId)
    if (!execution) return

    execution.progress = progress
    execution.currentStep = currentStep
    execution.updatedAt = new Date().toISOString()
  }

  const setWorkflowResults = (workflowId, executionId, results) => {
    if (!state.workflowResults[workflowId]) {
      state.workflowResults[workflowId] = {}
    }
    state.workflowResults[workflowId][executionId] = {
      results,
      timestamp: new Date().toISOString()
    }
  }

  const cancelExecution = async (workflowId, executionId) => {
    try {
      // TODO: Call backend API to cancel execution
      // await window.api('workflows', `${workflowId}/executions/${executionId}/cancel`, {
      //   method: 'POST'
      // })
      updateExecutionStatus(workflowId, executionId, 'cancelled')
      logger.debug('Cancelling execution:', executionId)
    } catch (error) {
      console.error('Failed to cancel execution:', error)
      throw error
    }
  }

  const loadWorkflows = async () => {
    try {
      // TODO: Call backend API to load workflows
      // const response = await window.api('workflows', '')
      // state.workflows = response.workflows || []
      logger.debug('Loading workflows from backend...')
    } catch (error) {
      console.error('Failed to load workflows:', error)
      throw error
    }
  }

  const saveWorkflow = async (workflow) => {
    try {
      // TODO: Call backend API to save workflow
      // const response = await window.api('workflows', '', {
      //   method: 'POST',
      //   body: workflow
      // })
      // return response
      logger.debug('Saving workflow to backend:', workflow)
      return workflow
    } catch (error) {
      console.error('Failed to save workflow:', error)
      throw error
    }
  }

  const loadWorkflowStatus = async (id) => {
    try {
      // TODO: Call backend API to get workflow status
      // const response = await window.api('workflows', `${id}/status`)
      // return response
      logger.debug('Loading workflow status:', id)
      return { status: 'idle' }
    } catch (error) {
      console.error('Failed to load workflow status:', error)
      throw error
    }
  }

  const exportWorkflow = (id, version = null) => {
    let workflow

    if (version !== null) {
      const versions = state.workflowVersions[id] || []
      const versionData = versions.find(v => v.version === version)
      workflow = versionData?.workflow
    } else {
      workflow = state.workflows.find(w => w.id === id)
    }

    if (!workflow) {
      throw new Error(`Workflow ${id} not found`)
    }

    return {
      workflow,
      version: version || workflow.version,
      exportedAt: new Date().toISOString()
    }
  }

  const importWorkflow = (data) => {
    const { workflow } = data
    const newWorkflow = addWorkflow(workflow)
    return newWorkflow
  }

  const revertToVersion = (id, version) => {
    const versions = state.workflowVersions[id]
    if (!versions) {
      throw new Error(`No versions found for workflow ${id}`)
    }

    const versionData = versions.find(v => v.version === version)
    if (!versionData) {
      throw new Error(`Version ${version} not found for workflow ${id}`)
    }

    const index = state.workflows.findIndex(w => w.id === id)
    if (index !== -1) {
      state.workflows[index] = {
        ...versionData.workflow,
        updatedAt: new Date().toISOString(),
        revertedFrom: state.workflows[index].version
      }
    }
  }

  const getExecutionHistory = () => {
    const history = []

    Object.keys(state.workflowExecutions).forEach(workflowId => {
      const workflow = state.workflows.find(w => w.id === workflowId)
      const executions = state.workflowExecutions[workflowId] || []

      executions.forEach(execution => {
        history.push({
          ...execution,
          workflowName: workflow?.name || 'Unknown',
          workflow
        })
      })
    })

    // Sort by start date, newest first
    return history.sort((a, b) =>
      new Date(b.startedAt) - new Date(a.startedAt)
    )
  }

  return {
    // State
    state,
    // Getters
    allWorkflows,
    activeWorkflowsCount,
    getWorkflowById,
    getWorkflowExecutions,
    getWorkflowResults,
    getWorkflowVersions,
    getLatestExecution,
    // Actions
    addWorkflow,
    updateWorkflow,
    deleteWorkflow,
    startWorkflowExecution,
    updateExecutionStatus,
    updateExecutionProgress,
    setWorkflowResults,
    cancelExecution,
    loadWorkflows,
    saveWorkflow,
    loadWorkflowStatus,
    exportWorkflow,
    importWorkflow,
    revertToVersion,
    getExecutionHistory
  }
}

export default useWorkflowStore
