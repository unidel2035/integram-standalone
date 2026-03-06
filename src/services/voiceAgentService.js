// Voice Agent Service
// Issue #1275 - Frontend service for voice agent interaction and microtask management

// Use direct API URL to the monolith backend
// Issue #1504: Connect directly to monolith API without proxy
import { getApiUrl } from '../utils/apiConfig'

const API_BASE_URL = getApiUrl('/api')

/**
 * Voice Agent Service
 * Handles communication with the voice agent backend
 */
class VoiceAgentService {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/voice-agent`
    this.userId = null
    this.accessToken = null
  }

  /**
   * Initialize service with user credentials
   * @param {string} userId - User ID
   * @param {string} accessToken - AI access token
   */
  initialize(userId, accessToken) {
    this.userId = userId
    this.accessToken = accessToken
  }

  /**
   * Send voice input to the agent
   * @param {string} input - Voice input text
   * @param {string} conversationId - Optional conversation ID
   * @param {Object} context - Optional context
   * @returns {Promise<Object>} - Agent response
   */
  async sendVoiceInput(input, conversationId = null, context = {}) {
    if (!this.userId || !this.accessToken) {
      throw new Error('Voice agent service not initialized. Call initialize() first.')
    }

    const response = await fetch(`${this.baseUrl}/interact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: this.userId,
        input,
        accessToken: this.accessToken,
        conversationId,
        context
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to send voice input')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Get user's microtasks
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} - List of microtasks
   */
  async getMicrotasks(filters = {}) {
    if (!this.userId) {
      throw new Error('Voice agent service not initialized')
    }

    const params = new URLSearchParams({
      userId: this.userId,
      ...filters
    })

    const response = await fetch(`${this.baseUrl}/microtasks?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get microtasks')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Get specific microtask
   * @param {string} taskId - Microtask ID
   * @returns {Promise<Object>} - Microtask details
   */
  async getMicrotask(taskId) {
    const response = await fetch(`${this.baseUrl}/microtasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get microtask')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Update microtask status
   * @param {string} taskId - Microtask ID
   * @param {string} status - New status
   * @param {Object} updates - Additional updates
   * @returns {Promise<Object>} - Updated microtask
   */
  async updateMicrotaskStatus(taskId, status, updates = {}) {
    const response = await fetch(`${this.baseUrl}/microtasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status,
        ...updates
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to update microtask')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Assign microtask to user
   * @param {string} taskId - Microtask ID
   * @param {string} assigneeId - User ID to assign to
   * @returns {Promise<Object>} - Updated microtask
   */
  async assignMicrotask(taskId, assigneeId) {
    const response = await fetch(`${this.baseUrl}/microtasks/${taskId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assigneeId
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to assign microtask')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Complete a microtask
   * @param {string} taskId - Microtask ID
   * @param {Object} result - Task result
   * @param {string} notes - Optional completion notes
   * @returns {Promise<Object>} - Completed microtask
   */
  async completeMicrotask(taskId, result, notes = null) {
    const response = await fetch(`${this.baseUrl}/microtasks/${taskId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        result,
        notes
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to complete microtask')
    }

    const result_data = await response.json()
    return result_data.data
  }

  /**
   * Cancel a microtask
   * @param {string} taskId - Microtask ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} - Cancelled microtask
   */
  async cancelMicrotask(taskId, reason) {
    const response = await fetch(`${this.baseUrl}/microtasks/${taskId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reason
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to cancel microtask')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Delete a microtask
   * @param {string} taskId - Microtask ID
   * @returns {Promise<void>}
   */
  async deleteMicrotask(taskId) {
    const response = await fetch(`${this.baseUrl}/microtasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to delete microtask')
    }
  }

  /**
   * Get microtask statistics
   * @returns {Promise<Object>} - Statistics
   */
  async getMicrotaskStats() {
    if (!this.userId) {
      throw new Error('Voice agent service not initialized')
    }

    const response = await fetch(`${this.baseUrl}/stats?userId=${this.userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get microtask stats')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Get microtasks for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Array>} - List of microtasks
   */
  async getConversationMicrotasks(conversationId) {
    const response = await fetch(`${this.baseUrl}/conversations/${conversationId}/microtasks`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get conversation microtasks')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Check service health
   * @returns {Promise<Object>} - Health status
   */
  async checkHealth() {
    const response = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Voice agent service is unhealthy')
    }

    const result = await response.json()
    return result
  }
}

// Export singleton instance
export const voiceAgentService = new VoiceAgentService()

// Export class for testing
export { VoiceAgentService }

export default voiceAgentService
