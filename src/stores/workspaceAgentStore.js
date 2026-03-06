/**
 * Workspace Agent Store
 *
 * Manages autonomous agents that run within workspaces.
 * Agents are session-specific - only visible to the user who started them.
 *
 * Agent ID format: {server}_{userId}_{agentType}_{timestamp}
 * Example: dronedoc.ru_196935_workspace-analyzer_1734095847123
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { logger } from '@/utils/logger'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

// Agent types
export const AGENT_TYPES = {
  WORKSPACE_ANALYZER: 'workspace-analyzer',
  CODE_REVIEWER: 'code-reviewer',
  SECURITY_SCANNER: 'security-scanner',
  PERFORMANCE_OPTIMIZER: 'performance-optimizer',
  FILE_WATCHER: 'file-watcher'
}

// Agent statuses
export const AGENT_STATUS = {
  IDLE: 'idle',
  WATCHING: 'watching',
  ANALYZING: 'analyzing',
  SUGGESTING: 'suggesting',
  EXECUTING: 'executing',
  WAITING_APPROVAL: 'waiting-approval',
  ERROR: 'error',
  STOPPED: 'stopped'
}

// Autonomy levels
export const AUTONOMY_LEVEL = {
  SUPERVISED: 'supervised',      // Ask before every action
  SEMI_AUTO: 'semi-auto',        // Auto for small fixes, ask for big changes
  FULL_AUTO: 'full-auto'         // Do everything, only ask for destructive ops
}

export const useWorkspaceAgentStore = defineStore('workspaceAgent', () => {
  // Running agents map: agentId -> agent data
  const runningAgents = ref(new Map())

  // Suggestions queue per agent
  const suggestions = ref(new Map())

  // Agent logs
  const agentLogs = ref(new Map())

  // File change history per workspace (for file watcher agent)
  const fileChanges = ref(new Map())

  // Save timeout reference for cleanup
  let saveTimeout = null

  // Global settings
  const globalSettings = ref({
    autonomyLevel: AUTONOMY_LEVEL.SUPERVISED,
    enabledTriggers: {
      fileSave: true,
      preCommit: true,
      onError: true,
      idle: false
    },
    idleTimeout: 5 * 60 * 1000, // 5 minutes
    maxSuggestionsPerAgent: 50
  })

  // Computed
  const runningAgentsCount = computed(() => runningAgents.value.size)

  const allRunningAgents = computed(() => Array.from(runningAgents.value.values()))

  const hasActiveAgents = computed(() => {
    return Array.from(runningAgents.value.values()).some(
      agent => agent.status !== AGENT_STATUS.STOPPED && agent.status !== AGENT_STATUS.ERROR
    )
  })

  const totalSuggestionsCount = computed(() => {
    let count = 0
    suggestions.value.forEach(agentSuggestions => {
      count += agentSuggestions.filter(s => !s.dismissed && !s.applied).length
    })
    return count
  })

  /**
   * Generate agent ID
   * Format: {server}_{userId}_{agentType}_{timestamp}
   */
  function generateAgentId(server, userId, agentType) {
    const timestamp = Date.now()
    // Sanitize server to remove protocol and special chars
    const sanitizedServer = server
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
    return `${sanitizedServer}_${userId}_${agentType}_${timestamp}`
  }

  /**
   * Start a new workspace agent
   */
  function startAgent({
    server = 'dronedoc.ru',
    userId,
    workspaceId,
    workspaceName,
    agentType = AGENT_TYPES.WORKSPACE_ANALYZER,
    autonomyLevel = null
  }) {
    if (!userId || !workspaceId) {
      throw new Error('userId and workspaceId are required')
    }

    const agentId = generateAgentId(server, userId, agentType)

    const agent = {
      id: agentId,
      server,
      userId,
      workspaceId,
      workspaceName,
      agentType,
      status: AGENT_STATUS.WATCHING,
      autonomyLevel: autonomyLevel || globalSettings.value.autonomyLevel,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      stats: {
        filesAnalyzed: 0,
        suggestionsGenerated: 0,
        suggestionsApplied: 0,
        errorsFound: 0
      }
    }

    runningAgents.value.set(agentId, agent)
    suggestions.value.set(agentId, [])
    agentLogs.value.set(agentId, [])

    addLog(agentId, 'info', `Agent started for workspace "${workspaceName}"`)
    logger.info(`[WorkspaceAgent] Started agent ${agentId}`)

    return agent
  }

  /**
   * Stop an agent
   * @param {string} agentId - Agent ID to stop
   * @param {boolean} removeAfterDelay - If true, remove agent from memory after 5 minutes
   */
  function stopAgent(agentId, removeAfterDelay = true) {
    const agent = runningAgents.value.get(agentId)
    if (!agent) {
      logger.warn(`[WorkspaceAgent] Agent ${agentId} not found`)
      return false
    }

    agent.status = AGENT_STATUS.STOPPED
    agent.stoppedAt = new Date().toISOString()
    addLog(agentId, 'info', 'Agent stopped')

    logger.info(`[WorkspaceAgent] Stopped agent ${agentId}`)

    // Schedule removal after 5 minutes to prevent memory leak
    if (removeAfterDelay) {
      setTimeout(() => {
        const currentAgent = runningAgents.value.get(agentId)
        if (currentAgent && currentAgent.status === AGENT_STATUS.STOPPED) {
          removeAgent(agentId)
          logger.info(`[WorkspaceAgent] Auto-removed stopped agent ${agentId}`)
        }
      }, 5 * 60 * 1000) // 5 minutes
    }

    return true
  }

  /**
   * Remove an agent completely
   */
  function removeAgent(agentId) {
    runningAgents.value.delete(agentId)
    suggestions.value.delete(agentId)
    agentLogs.value.delete(agentId)
    logger.info(`[WorkspaceAgent] Removed agent ${agentId}`)
  }

  /**
   * Update agent status
   */
  function updateAgentStatus(agentId, status) {
    const agent = runningAgents.value.get(agentId)
    if (agent) {
      agent.status = status
      agent.lastActivity = new Date().toISOString()
    }
  }

  /**
   * Add a suggestion from an agent
   */
  function addSuggestion(agentId, suggestion) {
    const agentSuggestions = suggestions.value.get(agentId)
    if (!agentSuggestions) {
      logger.warn(`[WorkspaceAgent] Agent ${agentId} not found for suggestion`)
      return null
    }

    const newSuggestion = {
      id: `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      createdAt: new Date().toISOString(),
      dismissed: false,
      applied: false,
      ...suggestion
    }

    agentSuggestions.unshift(newSuggestion)

    // Limit suggestions per agent
    if (agentSuggestions.length > globalSettings.value.maxSuggestionsPerAgent) {
      agentSuggestions.pop()
    }

    // Update agent stats
    const agent = runningAgents.value.get(agentId)
    if (agent) {
      agent.stats.suggestionsGenerated++
      if (suggestion.type === 'error' || suggestion.type === 'security') {
        agent.stats.errorsFound++
      }
    }

    addLog(agentId, 'info', `New suggestion: ${suggestion.title}`)
    return newSuggestion
  }

  /**
   * Apply a suggestion
   */
  function applySuggestion(agentId, suggestionId) {
    const agentSuggestions = suggestions.value.get(agentId)
    if (!agentSuggestions) return false

    const suggestion = agentSuggestions.find(s => s.id === suggestionId)
    if (suggestion) {
      suggestion.applied = true
      suggestion.appliedAt = new Date().toISOString()

      const agent = runningAgents.value.get(agentId)
      if (agent) {
        agent.stats.suggestionsApplied++
      }

      addLog(agentId, 'info', `Applied suggestion: ${suggestion.title}`)
      return true
    }
    return false
  }

  /**
   * Dismiss a suggestion
   */
  function dismissSuggestion(agentId, suggestionId) {
    const agentSuggestions = suggestions.value.get(agentId)
    if (!agentSuggestions) return false

    const suggestion = agentSuggestions.find(s => s.id === suggestionId)
    if (suggestion) {
      suggestion.dismissed = true
      suggestion.dismissedAt = new Date().toISOString()
      addLog(agentId, 'debug', `Dismissed suggestion: ${suggestion.title}`)
      return true
    }
    return false
  }

  /**
   * Get suggestions for an agent
   */
  function getAgentSuggestions(agentId, includeResolved = false) {
    const agentSuggestions = suggestions.value.get(agentId) || []
    if (includeResolved) {
      return agentSuggestions
    }
    return agentSuggestions.filter(s => !s.dismissed && !s.applied)
  }

  /**
   * Add a log entry for an agent
   */
  function addLog(agentId, level, message, data = null) {
    const logs = agentLogs.value.get(agentId)
    if (!logs) return

    logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    })

    // Keep only last 500 logs per agent
    if (logs.length > 500) {
      logs.shift()
    }
  }

  /**
   * Get logs for an agent
   */
  function getAgentLogs(agentId, limit = 100) {
    const logs = agentLogs.value.get(agentId) || []
    return logs.slice(-limit)
  }

  /**
   * Get agent by workspace
   */
  function getAgentByWorkspace(workspaceId) {
    return Array.from(runningAgents.value.values()).find(
      agent => agent.workspaceId === workspaceId && agent.status !== AGENT_STATUS.STOPPED
    )
  }

  /**
   * Update global settings
   */
  function updateSettings(newSettings) {
    globalSettings.value = { ...globalSettings.value, ...newSettings }
    logger.info('[WorkspaceAgent] Settings updated', newSettings)
  }

  /**
   * Clear all agents (cleanup)
   */
  function clearAllAgents() {
    runningAgents.value.clear()
    suggestions.value.clear()
    agentLogs.value.clear()
    fileChanges.value.clear()
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
    logger.info('[WorkspaceAgent] All agents cleared')
  }

  /**
   * Clean up stopped agents older than specified time
   * @param {number} maxAgeMs - Maximum age in milliseconds (default: 30 minutes)
   */
  function cleanupStoppedAgents(maxAgeMs = 30 * 60 * 1000) {
    const now = Date.now()
    let cleaned = 0

    for (const [agentId, agent] of runningAgents.value) {
      if (agent.status === AGENT_STATUS.STOPPED && agent.stoppedAt) {
        const stoppedTime = new Date(agent.stoppedAt).getTime()
        if (now - stoppedTime > maxAgeMs) {
          removeAgent(agentId)
          cleaned++
        }
      }
    }

    if (cleaned > 0) {
      logger.info(`[WorkspaceAgent] Cleaned up ${cleaned} stopped agents`)
    }
    return cleaned
  }

  /**
   * Get agent summary for UI
   */
  function getAgentSummary(agentId) {
    const agent = runningAgents.value.get(agentId)
    if (!agent) return null

    const agentSuggestions = suggestions.value.get(agentId) || []
    const pendingSuggestions = agentSuggestions.filter(s => !s.dismissed && !s.applied)

    return {
      ...agent,
      pendingSuggestionsCount: pendingSuggestions.length,
      pendingSuggestions: pendingSuggestions.slice(0, 5) // Last 5 for quick view
    }
  }

  /**
   * Save state to backend
   */
  async function saveState() {
    try {
      const userId = localStorage.getItem('id')
      if (!userId) return

      const state = {
        agents: Object.fromEntries(runningAgents.value),
        suggestions: Object.fromEntries(suggestions.value),
        globalSettings: globalSettings.value
      }

      await axios.post(`${API_BASE}/workspace-agent/state/save`, {
        userId,
        agentState: state
      })

      logger.debug('[WorkspaceAgent] State saved to backend')
    } catch (error) {
      logger.error('[WorkspaceAgent] Failed to save state:', error)
    }
  }

  /**
   * Load state from backend
   */
  async function loadState() {
    try {
      const userId = localStorage.getItem('id')
      if (!userId) return

      const response = await axios.get(`${API_BASE}/workspace-agent/state/${userId}`)

      if (response.data.success && response.data.state) {
        const state = response.data.state

        // Restore agents
        if (state.agents) {
          runningAgents.value = new Map(Object.entries(state.agents))
        }

        // Restore suggestions
        if (state.suggestions) {
          suggestions.value = new Map(Object.entries(state.suggestions))
        }

        // Restore settings
        if (state.globalSettings) {
          globalSettings.value = { ...globalSettings.value, ...state.globalSettings }
        }

        logger.info('[WorkspaceAgent] State loaded from backend, agents:', runningAgents.value.size)
      }
    } catch (error) {
      logger.error('[WorkspaceAgent] Failed to load state:', error)
    }
  }

  // Auto-save on changes (debounced)
  watch([runningAgents, suggestions], () => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(saveState, 1000)
  }, { deep: true })

  // Load state on init
  loadState()

  /**
   * Start file watcher for a workspace
   */
  async function startFileWatcher(workspaceId, userId) {
    try {
      const response = await axios.post(`${API_BASE}/workspace-agent/watch/start`, {
        workspaceId,
        userId
      })
      if (response.data.success) {
        fileChanges.value.set(workspaceId, [])
        logger.info(`[WorkspaceAgent] File watcher started for ${workspaceId}`)
      }
      return response.data
    } catch (error) {
      logger.error('[WorkspaceAgent] Failed to start file watcher:', error)
      throw error
    }
  }

  /**
   * Stop file watcher for a workspace
   */
  async function stopFileWatcher(workspaceId) {
    try {
      const response = await axios.post(`${API_BASE}/workspace-agent/watch/stop`, {
        workspaceId
      })
      if (response.data.success) {
        fileChanges.value.delete(workspaceId)
        logger.info(`[WorkspaceAgent] File watcher stopped for ${workspaceId}`)
      }
      return response.data
    } catch (error) {
      logger.error('[WorkspaceAgent] Failed to stop file watcher:', error)
      throw error
    }
  }

  /**
   * Get file change history for a workspace
   */
  async function getFileChanges(workspaceId, limit = 50) {
    try {
      const response = await axios.get(`${API_BASE}/workspace-agent/watch/history/${workspaceId}?limit=${limit}`)
      if (response.data.success) {
        fileChanges.value.set(workspaceId, response.data.data.changes)
        return response.data.data.changes
      }
      return []
    } catch (error) {
      logger.error('[WorkspaceAgent] Failed to get file changes:', error)
      return []
    }
  }

  /**
   * Get file watcher status
   */
  async function getFileWatcherStatus() {
    try {
      const response = await axios.get(`${API_BASE}/workspace-agent/watch/status`)
      return response.data.success ? response.data.data : { watchers: [], count: 0 }
    } catch (error) {
      logger.error('[WorkspaceAgent] Failed to get file watcher status:', error)
      return { watchers: [], count: 0 }
    }
  }

  return {
    // State
    runningAgents,
    suggestions,
    agentLogs,
    globalSettings,
    fileChanges,

    // Computed
    runningAgentsCount,
    allRunningAgents,
    hasActiveAgents,
    totalSuggestionsCount,

    // Actions
    generateAgentId,
    startAgent,
    stopAgent,
    removeAgent,
    updateAgentStatus,
    addSuggestion,
    applySuggestion,
    dismissSuggestion,
    getAgentSuggestions,
    addLog,
    getAgentLogs,
    getAgentByWorkspace,
    updateSettings,
    clearAllAgents,
    cleanupStoppedAgents,
    getAgentSummary,
    saveState,
    loadState,

    // File Watcher Actions
    startFileWatcher,
    stopFileWatcher,
    getFileChanges,
    getFileWatcherStatus,

    // Constants export
    AGENT_TYPES,
    AGENT_STATUS,
    AUTONOMY_LEVEL
  }
})
