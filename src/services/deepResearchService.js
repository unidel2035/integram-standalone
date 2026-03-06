/**
 * Deep Research Service
 *
 * Client-side service for interacting with DeepResearchAgent API
 */

import axios from 'axios'

const API_BASE = '/api/deep-research'

class DeepResearchService {
  constructor() {
    this.activeSession = null
    this.eventSource = null
  }

  /**
   * Get available research templates
   */
  async getTemplates() {
    const response = await axios.get(`${API_BASE}/templates`)
    return response.data.templates
  }

  /**
   * Start a new research session
   * @param {string} query - Research query
   * @param {Object} options - Options
   * @returns {Promise<Object>} Session info
   */
  async startResearch(query, options = {}) {
    const { template, modelId, maxIterations, accessToken } = options

    const response = await axios.post(`${API_BASE}/start`, {
      query,
      template,
      modelId,
      maxIterations
    }, {
      headers: accessToken ? { 'X-AI-Token': accessToken } : {}
    })

    if (response.data.success) {
      this.activeSession = response.data.session
      return response.data.session
    }

    throw new Error(response.data.error || 'Failed to start research')
  }

  /**
   * Subscribe to session events via SSE
   * @param {string} sessionId - Session ID
   * @param {Object} callbacks - Event callbacks
   * @returns {Function} Unsubscribe function
   */
  subscribeToSession(sessionId, callbacks = {}) {
    const { onPhase, onTask, onComplete, onError, onStatus } = callbacks

    // Close existing connection
    this.unsubscribe()

    const url = `${API_BASE}/sessions/${sessionId}/stream`
    this.eventSource = new EventSource(url)

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'phase':
            onPhase?.(data)
            break
          case 'task':
            onTask?.(data)
            break
          case 'complete':
            onComplete?.(data)
            this.unsubscribe()
            break
          case 'error':
            onError?.(data)
            this.unsubscribe()
            break
          case 'status':
            onStatus?.(data)
            break
          case 'cancelled':
            onError?.({ error: 'Research cancelled' })
            this.unsubscribe()
            break
        }
      } catch (error) {
        console.error('Failed to parse SSE event:', error)
      }
    }

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      onError?.({ error: 'Connection lost' })
      this.unsubscribe()
    }

    return () => this.unsubscribe()
  }

  /**
   * Unsubscribe from SSE events
   */
  unsubscribe() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }

  /**
   * Get session status
   * @param {string} sessionId - Session ID
   */
  async getSessionStatus(sessionId) {
    const response = await axios.get(`${API_BASE}/sessions/${sessionId}`)
    return response.data.session
  }

  /**
   * Get session result
   * @param {string} sessionId - Session ID
   */
  async getSessionResult(sessionId) {
    const response = await axios.get(`${API_BASE}/sessions/${sessionId}/result`)
    return response.data
  }

  /**
   * Get session events
   * @param {string} sessionId - Session ID
   */
  async getSessionEvents(sessionId) {
    const response = await axios.get(`${API_BASE}/sessions/${sessionId}/events`)
    return response.data.events
  }

  /**
   * Cancel a running session
   * @param {string} sessionId - Session ID
   */
  async cancelSession(sessionId) {
    const response = await axios.post(`${API_BASE}/sessions/${sessionId}/cancel`)
    this.unsubscribe()
    return response.data.success
  }

  /**
   * Quick research (synchronous, shorter)
   * @param {string} query - Research query
   * @param {Object} options - Options
   */
  async quickResearch(query, options = {}) {
    const { template, modelId, accessToken } = options

    const response = await axios.post(`${API_BASE}/quick`, {
      query,
      template,
      modelId
    }, {
      headers: accessToken ? { 'X-AI-Token': accessToken } : {},
      timeout: 150000 // 2.5 minutes
    })

    return response.data
  }

  /**
   * List user's research sessions
   * @param {Object} options - Filter options
   */
  async listSessions(options = {}) {
    const { status, limit } = options
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    if (limit) params.append('limit', limit)

    const response = await axios.get(`${API_BASE}/sessions?${params}`)
    return response.data.sessions
  }
}

// Singleton instance
const deepResearchService = new DeepResearchService()

export default deepResearchService

export { DeepResearchService }
