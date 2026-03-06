/**
 * Content Marketing Agent API Service
 *
 * Service for interacting with Content Marketing Agent API
 * Manages competitor channel parsing, trending topic analysis, article generation and publishing
 */

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'https://drondoc.ru'

export const contentMarketingService = {
  /**
   * Get list of competitor channels
   * @returns {Promise<Object>} Competitor channels result
   */
  async getCompetitorChannels() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/content-marketing/competitor-channels`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get competitor channels')
      }

      return response.json()
    } catch (error) {
      console.error('Get competitor channels error:', error)
      throw error
    }
  },

  /**
   * Add a new competitor channel
   * @param {Object} channelData - Channel data (name, username, category)
   * @returns {Promise<Object>} Add channel result
   */
  async addCompetitorChannel(channelData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/content-marketing/competitor-channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(channelData)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to add competitor channel')
      }

      return response.json()
    } catch (error) {
      console.error('Add competitor channel error:', error)
      throw error
    }
  },

  /**
   * Remove a competitor channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Remove channel result
   */
  async removeCompetitorChannel(channelId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/content-marketing/competitor-channels/${channelId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to remove competitor channel')
      }

      return response.json()
    } catch (error) {
      console.error('Remove competitor channel error:', error)
      throw error
    }
  },

  /**
   * Parse a competitor channel
   * @param {Object} params - Parameters
   * @param {string} params.channelId - Channel ID
   * @param {string} params.botToken - Telegram bot token
   * @returns {Promise<Object>} Parse channel result
   */
  async parseChannel({ channelId, botToken }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/content-marketing/parse-channel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ channelId, botToken })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to parse channel')
      }

      return response.json()
    } catch (error) {
      console.error('Parse channel error:', error)
      throw error
    }
  },

  /**
   * Parse all competitor channels
   * @param {Object} params - Parameters
   * @param {string} params.botToken - Telegram bot token
   * @returns {Promise<Object>} Parse all channels result
   */
  async parseAllChannels({ botToken }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/content-marketing/parse-all-channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ botToken })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to parse all channels')
      }

      return response.json()
    } catch (error) {
      console.error('Parse all channels error:', error)
      throw error
    }
  },

  /**
   * Analyze trending topics from parsed data
   * @returns {Promise<Object>} Trending topics result
   */
  async analyzeTrendingTopics() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/content-marketing/analyze-trending-topics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to analyze trending topics')
      }

      return response.json()
    } catch (error) {
      console.error('Analyze trending topics error:', error)
      throw error
    }
  },

  /**
   * Generate article for a trending topic
   * @param {Object} params - Parameters
   * @param {string} params.topicId - Topic ID
   * @param {string} params.modelId - AI model ID (optional)
   * @returns {Promise<Object>} Generated article result
   */
  async generateArticle({ topicId, modelId }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/content-marketing/generate-article`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ topicId, modelId })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to generate article')
      }

      return response.json()
    } catch (error) {
      console.error('Generate article error:', error)
      throw error
    }
  },

  /**
   * Publish an article
   * @param {Object} params - Parameters
   * @param {string} params.articleId - Article ID
   * @param {string} params.targetChannel - Target Telegram channel
   * @returns {Promise<Object>} Publish article result
   */
  async publishArticle({ articleId, targetChannel }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/content-marketing/publish-article`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ articleId, targetChannel })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to publish article')
      }

      return response.json()
    } catch (error) {
      console.error('Publish article error:', error)
      throw error
    }
  },

  /**
   * Publish multiple articles
   * @param {Object} params - Parameters
   * @param {Array<string>} params.articleIds - Article IDs
   * @param {string} params.targetChannel - Target Telegram channel
   * @returns {Promise<Object>} Publish multiple articles result
   */
  async publishMultipleArticles({ articleIds, targetChannel }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/content-marketing/publish-multiple-articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ articleIds, targetChannel })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to publish multiple articles')
      }

      return response.json()
    } catch (error) {
      console.error('Publish multiple articles error:', error)
      throw error
    }
  },

  /**
   * Get all articles
   * @returns {Promise<Object>} Articles result
   */
  async getArticles() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/content-marketing/articles`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get articles')
      }

      return response.json()
    } catch (error) {
      console.error('Get articles error:', error)
      throw error
    }
  },

  /**
   * Get agent status
   * @returns {Promise<Object>} Agent status result
   */
  async getStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/content-marketing/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get agent status')
      }

      return response.json()
    } catch (error) {
      console.error('Get agent status error:', error)
      throw error
    }
  },

  /**
   * Get analytics data
   * @returns {Promise<Object>} Analytics result
   */
  async getAnalytics() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/content-marketing/analytics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get analytics')
      }

      return response.json()
    } catch (error) {
      console.error('Get analytics error:', error)
      throw error
    }
  }
}

export default contentMarketingService
