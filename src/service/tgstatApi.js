/**
 * TGStat API Service
 * API Documentation: https://api.tgstat.ru/docs/ru/start/intro.html
 */

import axios from 'axios'

class TgstatApiService {
  constructor() {
    // Use environment variables for backend URL configuration
    this.baseURL = this.getBaseURL()
    this.token = localStorage.getItem('tgstat_api_token') || ''

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      config => {
        if (this.token) {
          // Use custom header for backend proxy
          config.headers['X-TGStat-Token'] = this.token
        }
        return config
      },
      error => Promise.reject(error)
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('TGStat API Error:', error.response?.data || error.message)
        return Promise.reject(error)
      }
    )
  }

  /**
   * Get the base URL for the TGStat API proxy
   * Uses environment variables for configuration
   */
  getBaseURL() {
    // If VITE_ORCHESTRATOR_URL is set, use it directly
    if (import.meta.env.VITE_ORCHESTRATOR_URL) {
      return `${import.meta.env.VITE_ORCHESTRATOR_URL}/api/tgstat`
    }

    // Otherwise, construct from individual components
    const protocol = import.meta.env.VITE_BACKEND_PROTOCOL || 'https'
    const host = import.meta.env.VITE_BACKEND_HOST || 'drondoc.ru'
    const port = import.meta.env.VITE_BACKEND_PORT || '8081'

    return `${protocol}://${host}:${port}/api/tgstat`
  }

  /**
   * Set API token for authentication
   * @param {string} token - TGStat API token
   */
  setToken(token) {
    this.token = token
    localStorage.setItem('tgstat_api_token', token)
  }

  /**
   * Get API token
   * @returns {string} Current API token
   */
  getToken() {
    return this.token
  }

  /**
   * Get channel info by username or ID
   * @param {string} channelId - Channel username or ID
   * @returns {Promise} Channel information
   */
  async getChannel(channelId) {
    try {
      const response = await this.client.get('/channels/get', {
        params: { channelId }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get channel statistics
   * @param {string} channelId - Channel username or ID
   * @returns {Promise} Channel statistics
   */
  async getChannelStat(channelId) {
    try {
      const response = await this.client.get('/channels/stat', {
        params: { channelId }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get channel posts
   * @param {string} channelId - Channel username or ID
   * @param {Object} params - Query parameters (limit, offset, etc.)
   * @returns {Promise} Channel posts
   */
  async getChannelPosts(channelId, params = {}) {
    try {
      const response = await this.client.get('/channels/posts', {
        params: { channelId, ...params }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get channel subscribers statistics
   * @param {string} channelId - Channel username or ID
   * @returns {Promise} Subscribers data
   */
  async getChannelSubscribers(channelId) {
    try {
      const response = await this.client.get('/channels/subscribers', {
        params: { channelId }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get channel views statistics
   * @param {string} channelId - Channel username or ID
   * @returns {Promise} Views data
   */
  async getChannelViews(channelId) {
    try {
      const response = await this.client.get('/channels/views', {
        params: { channelId }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get channel average posts reach
   * @param {string} channelId - Channel username or ID
   * @returns {Promise} Average reach data
   */
  async getChannelAvgPostsReach(channelId) {
    try {
      const response = await this.client.get('/channels/avg-posts-reach', {
        params: { channelId }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Search posts by keywords
   * @param {string} query - Search query
   * @param {Object} params - Query parameters
   * @returns {Promise} Search results
   */
  async searchPosts(query, params = {}) {
    try {
      const response = await this.client.get('/posts/search', {
        params: { q: query, ...params }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get mentions by period
   * @param {string} query - Search query
   * @param {Object} params - Query parameters (startDate, endDate, etc.)
   * @returns {Promise} Mentions data
   */
  async getMentionsByPeriod(query, params = {}) {
    try {
      const response = await this.client.get('/words/mentions-by-period', {
        params: { q: query, ...params }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get post statistics
   * @param {string} postId - Post ID
   * @returns {Promise} Post statistics
   */
  async getPostStat(postId) {
    try {
      const response = await this.client.get('/posts/stat', {
        params: { postId }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Search channels
   * @param {string} query - Search query
   * @param {Object} params - Query parameters
   * @returns {Promise} Search results
   */
  async searchChannels(query, params = {}) {
    try {
      const response = await this.client.get('/channels/search', {
        params: { q: query, ...params }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get callback subscriptions
   * @returns {Promise} Active subscriptions
   */
  async getCallbackSubscriptions() {
    try {
      const response = await this.client.get('/callback/subscriptions')
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Subscribe to channel updates via callback
   * @param {string} channelId - Channel ID to subscribe
   * @param {string} callbackUrl - Webhook URL
   * @returns {Promise} Subscription result
   */
  async subscribeCallback(channelId, callbackUrl) {
    try {
      const response = await this.client.post('/callback/subscribe', {
        channelId,
        callbackUrl
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Unsubscribe from channel updates
   * @param {number} subscriptionId - Subscription ID
   * @returns {Promise} Unsubscription result
   */
  async unsubscribeCallback(subscriptionId) {
    try {
      const response = await this.client.post('/callback/unsubscribe', {
        subscriptionId
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Handle API errors
   * @param {Error} error - Error object
   * @returns {Object} Formatted error
   */
  handleError(error) {
    if (error.response) {
      return {
        status: error.response.status,
        message: error.response.data?.error || 'API request failed',
        data: error.response.data
      }
    } else if (error.request) {
      return {
        status: 0,
        message: 'No response from server',
        data: null
      }
    } else {
      return {
        status: -1,
        message: error.message,
        data: null
      }
    }
  }
}

export default new TgstatApiService()
