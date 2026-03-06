/**
 * ORD (VK Advertising) API Service
 * API Documentation: https://ord.vk.com/help/api/
 * Swagger: https://ord.vk.com/help/api/swagger/
 */

import axios from 'axios'

class OrdApiService {
  constructor() {
    this.baseURL = 'https://api.ord.vk.com'
    this.token = localStorage.getItem('ord_api_token') || ''

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
          config.headers['Authorization'] = `Bearer ${this.token}`
        }
        return config
      },
      error => Promise.reject(error)
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('ORD API Error:', error.response?.data || error.message)
        return Promise.reject(error)
      }
    )
  }

  /**
   * Set API token for authentication
   * @param {string} token - ORD API token
   */
  setToken(token) {
    this.token = token
    localStorage.setItem('ord_api_token', token)
  }

  /**
   * Get API token
   * @returns {string} Current API token
   */
  getToken() {
    return this.token
  }

  /**
   * Get campaigns list
   * @param {Object} params - Query parameters
   * @returns {Promise} Campaign data
   */
  async getCampaigns(params = {}) {
    try {
      const response = await this.client.get('/campaigns', { params })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get campaign by ID
   * @param {number} campaignId - Campaign ID
   * @returns {Promise} Campaign details
   */
  async getCampaign(campaignId) {
    try {
      const response = await this.client.get(`/campaigns/${campaignId}`)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Create new campaign
   * @param {Object} campaignData - Campaign data
   * @returns {Promise} Created campaign
   */
  async createCampaign(campaignData) {
    try {
      const response = await this.client.post('/campaigns', campaignData)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Update campaign
   * @param {number} campaignId - Campaign ID
   * @param {Object} campaignData - Updated campaign data
   * @returns {Promise} Updated campaign
   */
  async updateCampaign(campaignId, campaignData) {
    try {
      const response = await this.client.put(`/campaigns/${campaignId}`, campaignData)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Delete campaign
   * @param {number} campaignId - Campaign ID
   * @returns {Promise} Deletion result
   */
  async deleteCampaign(campaignId) {
    try {
      const response = await this.client.delete(`/campaigns/${campaignId}`)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get campaign statistics
   * @param {number} campaignId - Campaign ID
   * @param {Object} params - Query parameters (date range, metrics, etc.)
   * @returns {Promise} Campaign statistics
   */
  async getCampaignStats(campaignId, params = {}) {
    try {
      const response = await this.client.get(`/campaigns/${campaignId}/stats`, { params })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get clients list
   * @param {Object} params - Query parameters
   * @returns {Promise} Clients data
   */
  async getClients(params = {}) {
    try {
      const response = await this.client.get('/clients', { params })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Create new client
   * @param {Object} clientData - Client data
   * @returns {Promise} Created client
   */
  async createClient(clientData) {
    try {
      const response = await this.client.post('/clients', clientData)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Update client
   * @param {number} clientId - Client ID
   * @param {Object} clientData - Updated client data
   * @returns {Promise} Updated client
   */
  async updateClient(clientId, clientData) {
    try {
      const response = await this.client.put(`/clients/${clientId}`, clientData)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Delete client
   * @param {number} clientId - Client ID
   * @returns {Promise} Deletion result
   */
  async deleteClient(clientId) {
    try {
      const response = await this.client.delete(`/clients/${clientId}`)
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
        message: error.response.data?.message || 'API request failed',
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

export default new OrdApiService()
