/**
 * Sales Agent API Service
 *
 * Service for interacting with Sales Agent API
 * Manages lead generation, scoring, funnels, and AI-powered communication
 */

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'https://drondoc.ru'

export const salesAgentService = {
  /**
   * Generate leads from Telegram group messages
   * @param {Object} params - Parameters
   * @param {Array} params.messages - Telegram messages
   * @param {Object} params.groupInfo - Group information
   * @param {Object} params.filters - Optional filters
   * @returns {Promise<Object>} Lead generation result
   */
  async generateLeads({ messages, groupInfo, filters = {} }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-agent/generate-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages, groupInfo, filters })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to generate leads')
      }

      return response.json()
    } catch (error) {
      console.error('Generate leads error:', error)
      throw error
    }
  },

  /**
   * Score leads using AI and rule-based criteria
   * @param {Object} params - Parameters
   * @param {Array<string>} params.leadIds - Lead IDs to score
   * @param {Object} params.criteria - Optional custom scoring criteria
   * @returns {Promise<Object>} Lead scoring result
   */
  async scoreLeads({ leadIds, criteria }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-agent/score-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ leadIds, criteria })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to score leads')
      }

      return response.json()
    } catch (error) {
      console.error('Score leads error:', error)
      throw error
    }
  },

  /**
   * Create a sales funnel
   * @param {Object} params - Parameters
   * @param {string} params.name - Funnel name
   * @param {Array<string>} params.leadIds - Lead IDs
   * @param {string} params.targetProduct - Target product name
   * @returns {Promise<Object>} Funnel creation result
   */
  async createFunnel({ name, leadIds, targetProduct = 'DronDoc Platform' }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-agent/create-funnel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, leadIds, targetProduct })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to create funnel')
      }

      return response.json()
    } catch (error) {
      console.error('Create funnel error:', error)
      throw error
    }
  },

  /**
   * Generate AI-powered communication journey
   * @param {Object} params - Parameters
   * @param {string} params.leadId - Lead ID
   * @param {string} params.funnelId - Funnel ID
   * @param {string} params.targetProduct - Target product name
   * @returns {Promise<Object>} Communication journey
   */
  async generateCommunicationJourney({ leadId, funnelId, targetProduct = 'DronDoc Platform' }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-agent/generate-communication-journey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ leadId, funnelId, targetProduct })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to generate communication journey')
      }

      return response.json()
    } catch (error) {
      console.error('Generate communication journey error:', error)
      throw error
    }
  },

  /**
   * Send outreach message
   * @param {Object} params - Parameters
   * @param {string} params.journeyId - Journey ID
   * @param {number} params.stepIndex - Step index
   * @returns {Promise<Object>} Outreach result
   */
  async sendOutreach({ journeyId, stepIndex }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-agent/send-outreach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ journeyId, stepIndex })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to send outreach')
      }

      return response.json()
    } catch (error) {
      console.error('Send outreach error:', error)
      throw error
    }
  },

  /**
   * Update lead stage in funnel
   * @param {Object} params - Parameters
   * @param {string} params.leadId - Lead ID
   * @param {string} params.funnelId - Funnel ID
   * @param {string} params.newStage - New stage name
   * @returns {Promise<Object>} Update result
   */
  async updateLeadStage({ leadId, funnelId, newStage }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-agent/update-lead-stage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ leadId, funnelId, newStage })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to update lead stage')
      }

      return response.json()
    } catch (error) {
      console.error('Update lead stage error:', error)
      throw error
    }
  },

  /**
   * Analyze campaign performance
   * @param {Object} params - Parameters
   * @param {string} params.funnelId - Funnel ID
   * @returns {Promise<Object>} Campaign analysis
   */
  async analyzeCampaign({ funnelId }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-agent/analyze-campaign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ funnelId })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to analyze campaign')
      }

      return response.json()
    } catch (error) {
      console.error('Analyze campaign error:', error)
      throw error
    }
  },

  /**
   * Get sales agent statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-agent/statistics`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get statistics')
      }

      return response.json()
    } catch (error) {
      console.error('Get statistics error:', error)
      throw error
    }
  },

  /**
   * Get sales agent status
   * @returns {Promise<Object>} Status
   */
  async getStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-agent/status`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get status')
      }

      return response.json()
    } catch (error) {
      console.error('Get status error:', error)
      throw error
    }
  },

  /**
   * Health check
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sales-agent/health`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return response.json()
    } catch (error) {
      console.error('Health check error:', error)
      throw error
    }
  }
}

export default salesAgentService
