/**
 * useAgentWorkflow.js — Agent Workflow Builder (Giselle/Dust pattern)
 *
 * Create, save, and execute agent pipelines:
 *   Agent A → Agent B → Agent C
 *
 * Workflow modes:
 *   - sequential: output of A becomes input of B
 *   - parallel: all agents run simultaneously, results merged
 *   - conditional: route to different agents based on content
 *
 * Stored in localStorage, can be shared via JSON export/import.
 */

import { ref, computed, watch } from 'vue'
import { logger } from '@/utils/logger'

const WORKFLOWS_KEY = 'agentWorkflows'
const ACTIVE_WORKFLOW_KEY = 'activeWorkflowId'

// Singleton state
const workflows = ref([])
const activeWorkflowId = ref(null)
const isLoaded = ref(false)

function loadWorkflows() {
  if (isLoaded.value) return
  try {
    const raw = localStorage.getItem(WORKFLOWS_KEY)
    workflows.value = raw ? JSON.parse(raw) : []
    activeWorkflowId.value = localStorage.getItem(ACTIVE_WORKFLOW_KEY) || null
  } catch {
    workflows.value = []
  }
  isLoaded.value = true
}

function saveWorkflows() {
  try {
    localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows.value))
    if (activeWorkflowId.value) {
      localStorage.setItem(ACTIVE_WORKFLOW_KEY, activeWorkflowId.value)
    } else {
      localStorage.removeItem(ACTIVE_WORKFLOW_KEY)
    }
  } catch { /* storage full */ }
}

export function useAgentWorkflow() {
  loadWorkflows()

  const activeWorkflow = computed(() =>
    workflows.value.find(w => w.id === activeWorkflowId.value) || null
  )

  /**
   * Create a new workflow
   * @param {string} name
   * @param {string} mode - 'sequential' | 'parallel' | 'conditional'
   * @returns {Object} workflow
   */
  function createWorkflow(name, mode = 'sequential') {
    const workflow = {
      id: `wf_${Date.now()}`,
      name,
      mode,
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      runCount: 0,
      lastRunAt: null
    }
    workflows.value.push(workflow)
    saveWorkflows()
    logger.info(`[AgentWorkflow] Created workflow: ${name} (${mode})`)
    return workflow
  }

  /**
   * Add a step (agent) to a workflow
   * @param {string} workflowId
   * @param {Object} agent - agent object from useAgentSelector
   * @param {Object} options - { condition, transformPrompt }
   */
  function addStep(workflowId, agent, options = {}) {
    const wf = workflows.value.find(w => w.id === workflowId)
    if (!wf) return null

    const step = {
      id: `step_${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      agentIcon: agent.icon,
      systemPrompt: agent.systemPrompt,
      order: wf.steps.length,
      condition: options.condition || null, // for conditional mode: regex or keyword
      transformPrompt: options.transformPrompt || null, // template to wrap previous output
      enabled: true
    }
    wf.steps.push(step)
    wf.updatedAt = Date.now()
    saveWorkflows()
    logger.info(`[AgentWorkflow] Added step ${agent.name} to ${wf.name}`)
    return step
  }

  /**
   * Remove a step from workflow
   */
  function removeStep(workflowId, stepId) {
    const wf = workflows.value.find(w => w.id === workflowId)
    if (!wf) return
    wf.steps = wf.steps.filter(s => s.id !== stepId)
    wf.steps.forEach((s, i) => { s.order = i })
    wf.updatedAt = Date.now()
    saveWorkflows()
  }

  /**
   * Reorder steps (move step to new position)
   */
  function reorderStep(workflowId, stepId, newIndex) {
    const wf = workflows.value.find(w => w.id === workflowId)
    if (!wf) return
    const idx = wf.steps.findIndex(s => s.id === stepId)
    if (idx === -1) return
    const [step] = wf.steps.splice(idx, 1)
    wf.steps.splice(newIndex, 0, step)
    wf.steps.forEach((s, i) => { s.order = i })
    wf.updatedAt = Date.now()
    saveWorkflows()
  }

  /**
   * Execute workflow — returns array of { agent, response } for each step
   * @param {string} workflowId
   * @param {string} userMessage
   * @param {Function} sendFn - async (message, systemPrompt, agentContext) => response text
   * @returns {Promise<Array>} results
   */
  async function executeWorkflow(workflowId, userMessage, sendFn) {
    const wf = workflows.value.find(w => w.id === workflowId)
    if (!wf || wf.steps.length === 0) return []

    const enabledSteps = wf.steps.filter(s => s.enabled)
    const results = []

    if (wf.mode === 'sequential') {
      let currentInput = userMessage
      for (const step of enabledSteps) {
        const prompt = step.transformPrompt
          ? step.transformPrompt.replace('[INPUT]', currentInput).replace('[PREV]', currentInput)
          : currentInput
        const response = await sendFn(prompt, step.systemPrompt, {
          id: step.agentId,
          name: step.agentName
        })
        results.push({ step, response })
        currentInput = response // chain output to next agent
      }
    } else if (wf.mode === 'parallel') {
      const promises = enabledSteps.map(async step => {
        const response = await sendFn(userMessage, step.systemPrompt, {
          id: step.agentId,
          name: step.agentName
        })
        return { step, response }
      })
      results.push(...await Promise.all(promises))
    } else if (wf.mode === 'conditional') {
      for (const step of enabledSteps) {
        if (!step.condition) {
          // Default/fallback step (no condition)
          const response = await sendFn(userMessage, step.systemPrompt, {
            id: step.agentId,
            name: step.agentName
          })
          results.push({ step, response })
          break
        }
        try {
          const regex = new RegExp(step.condition, 'i')
          if (regex.test(userMessage)) {
            const response = await sendFn(userMessage, step.systemPrompt, {
              id: step.agentId,
              name: step.agentName
            })
            results.push({ step, response })
            break
          }
        } catch { /* invalid regex, skip */ }
      }
    }

    // Track execution
    wf.runCount++
    wf.lastRunAt = Date.now()
    wf.updatedAt = Date.now()
    saveWorkflows()

    logger.info(`[AgentWorkflow] Executed ${wf.name}: ${results.length} steps, mode=${wf.mode}`)
    return results
  }

  /**
   * Delete a workflow
   */
  function deleteWorkflow(workflowId) {
    workflows.value = workflows.value.filter(w => w.id !== workflowId)
    if (activeWorkflowId.value === workflowId) {
      activeWorkflowId.value = null
    }
    saveWorkflows()
  }

  /**
   * Set active workflow for chat
   */
  function setActiveWorkflow(workflowId) {
    activeWorkflowId.value = workflowId
    saveWorkflows()
  }

  function clearActiveWorkflow() {
    activeWorkflowId.value = null
    saveWorkflows()
  }

  /**
   * Export workflow as JSON
   */
  function exportWorkflow(workflowId) {
    const wf = workflows.value.find(w => w.id === workflowId)
    return wf ? JSON.stringify(wf, null, 2) : null
  }

  /**
   * Import workflow from JSON
   */
  function importWorkflow(json) {
    try {
      const wf = JSON.parse(json)
      wf.id = `wf_${Date.now()}`
      wf.createdAt = Date.now()
      wf.updatedAt = Date.now()
      wf.runCount = 0
      workflows.value.push(wf)
      saveWorkflows()
      return wf
    } catch (e) {
      logger.error('[AgentWorkflow] Import failed:', e)
      return null
    }
  }

  /**
   * Get preset workflow templates
   */
  function getTemplates() {
    return [
      {
        name: 'Research & Summarize',
        mode: 'sequential',
        description: 'Research agent gathers info, then summarizer condenses it',
        stepHints: ['analytics', 'content']
      },
      {
        name: 'Code Review Pipeline',
        mode: 'sequential',
        description: 'Code reviewer finds issues, then fixer suggests solutions',
        stepHints: ['development', 'testing']
      },
      {
        name: 'Multi-perspective Analysis',
        mode: 'parallel',
        description: 'Multiple agents analyze the same question from different angles',
        stepHints: ['analytics', 'business', 'development']
      },
      {
        name: 'Smart Router',
        mode: 'conditional',
        description: 'Route to the right agent based on message content',
        stepHints: ['ai', 'development', 'analytics']
      }
    ]
  }

  return {
    workflows,
    activeWorkflow,
    activeWorkflowId,
    createWorkflow,
    addStep,
    removeStep,
    reorderStep,
    executeWorkflow,
    deleteWorkflow,
    setActiveWorkflow,
    clearActiveWorkflow,
    exportWorkflow,
    importWorkflow,
    getTemplates
  }
}
