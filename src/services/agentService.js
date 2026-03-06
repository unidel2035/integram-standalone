/**
 * Agent Service
 *
 * Frontend service for loading agents from the unified table 220847 via /api/agents/db
 * Issue #7043: Consolidation of agent tables into a single table 220847
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

/**
 * Get all agents from the unified database (table 220847)
 * @param {Object} params - Query parameters
 * @param {string} params.category - Filter by category
 * @param {string} params.search - Search keyword
 * @param {string} params.status - Filter by status
 * @param {boolean} params.enabled - Filter by enabled
 * @param {number} params.limit - Page size (default: 200)
 * @param {number} params.page - Page number (default: 1)
 * @returns {Promise<Object>} Response with agents array
 */
export async function getProductionAgents({ category, search, status, enabled, limit = 200, page = 1 } = {}) {
  try {
    const params = { limit, page }

    if (category && category !== 'all') {
      params.category = category
    }
    if (search) {
      params.search = search
    }
    if (status) {
      params.status = status
    }
    if (enabled !== undefined) {
      params.enabled = enabled
    }

    const response = await axios.get(`${API_BASE_URL}/agents`, { params })

    return {
      success: true,
      agents: response.data.agents || [],
      total: response.data.total || 0,
      count: response.data.total || 0
    }
  } catch (error) {
    console.error('[AgentService] getProductionAgents error:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      agents: [],
      total: 0,
      count: 0
    }
  }
}

/**
 * Get all agents (alias for getProductionAgents with high limit)
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Response with agents array
 */
export async function getAllAgents(params = {}) {
  return getProductionAgents({ ...params, limit: 2000 })
}

/**
 * Get unique tags from all agents
 * @returns {Promise<Object>} Response with tags array
 */
export async function getAgentTags() {
  try {
    const response = await axios.get(`${API_BASE_URL}/agents/db/tags`)
    return {
      success: true,
      tags: response.data.tags || []
    }
  } catch (error) {
    console.error('[AgentService] getAgentTags error:', error)
    return { success: false, error: error.message, tags: [] }
  }
}

/**
 * Get agent statistics
 * @returns {Promise<Object>} Agent statistics
 */
export async function getAgentStats() {
  try {
    const response = await axios.get(`${API_BASE_URL}/agents/production/stats`)

    return {
      success: true,
      data: response.data.data || {}
    }
  } catch (error) {
    console.error('[AgentService] getAgentStats error:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      data: {}
    }
  }
}

/**
 * Get agents grouped by category
 * @returns {Promise<Object>} Agents grouped by category
 */
export async function getAgentsByCategory() {
  try {
    const response = await axios.get(`${API_BASE_URL}/agents/production/by-category`)

    return {
      success: true,
      data: response.data.data || {}
    }
  } catch (error) {
    console.error('[AgentService] getAgentsByCategory error:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      data: {}
    }
  }
}

/**
 * Get specific agent by name
 * @param {string} name - Agent name
 * @returns {Promise<Object>} Agent details
 */
export async function getAgentByName(name) {
  try {
    const response = await axios.get(`${API_BASE_URL}/agents/db/${encodeURIComponent(name)}`)

    return {
      success: true,
      agent: response.data.agent || null
    }
  } catch (error) {
    console.error('[AgentService] getAgentByName error:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      agent: null
    }
  }
}

export default {
  getProductionAgents,
  getAllAgents,
  getAgentTags,
  getAgentStats,
  getAgentsByCategory,
  getAgentByName
}
