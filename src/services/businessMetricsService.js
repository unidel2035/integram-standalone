/**
 * Business Metrics Service
 *
 * Frontend service for interacting with Business Metrics API
 * Handles event tracking, KPI calculations, A/B testing, and feature flags
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

class BusinessMetricsService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/business-metrics`
  }

  /**
   * Track an event
   * @param {Object} event - Event data
   * @returns {Promise<Object>} Tracked event
   */
  async trackEvent(event) {
    try {
      const response = await axios.post(`${this.baseURL}/events`, event)
      return response.data.data
    } catch (error) {
      console.error('Error tracking event:', error)
      throw error
    }
  }

  /**
   * Get events with filters
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Object>} Events data
   */
  async getEvents(filters = {}) {
    try {
      const response = await axios.get(`${this.baseURL}/events`, { params: filters })
      return response.data.data
    } catch (error) {
      console.error('Error getting events:', error)
      throw error
    }
  }

  /**
   * Get retention metrics
   * @param {Object} options - Calculation options
   * @returns {Promise<Object>} Retention data
   */
  async getRetention(options = {}) {
    try {
      const response = await axios.get(`${this.baseURL}/retention`, { params: options })
      return response.data.data
    } catch (error) {
      console.error('Error getting retention:', error)
      throw error
    }
  }

  /**
   * Get churn metrics
   * @param {Object} options - Calculation options
   * @returns {Promise<Object>} Churn data
   */
  async getChurn(options = {}) {
    try {
      const response = await axios.get(`${this.baseURL}/churn`, { params: options })
      return response.data.data
    } catch (error) {
      console.error('Error getting churn:', error)
      throw error
    }
  }

  /**
   * Get LTV metrics
   * @param {Object} options - Calculation options
   * @returns {Promise<Object>} LTV data
   */
  async getLTV(options = {}) {
    try {
      const response = await axios.get(`${this.baseURL}/ltv`, { params: options })
      return response.data.data
    } catch (error) {
      console.error('Error getting LTV:', error)
      throw error
    }
  }

  /**
   * Create A/B test
   * @param {Object} test - Test configuration
   * @returns {Promise<Object>} Created test
   */
  async createABTest(test) {
    try {
      const response = await axios.post(`${this.baseURL}/ab-tests`, test)
      return response.data.data
    } catch (error) {
      console.error('Error creating A/B test:', error)
      throw error
    }
  }

  /**
   * Get A/B test variant for user
   * @param {string} testId - Test ID
   * @param {string} userId - User ID
   * @returns {Promise<string>} Variant
   */
  async getABTestVariant(testId, userId) {
    try {
      const response = await axios.get(`${this.baseURL}/ab-tests/${testId}/variant`, {
        params: { userId }
      })
      return response.data.data.variant
    } catch (error) {
      console.error('Error getting A/B test variant:', error)
      throw error
    }
  }

  /**
   * Get A/B test results
   * @param {string} testId - Test ID
   * @returns {Promise<Object>} Test results
   */
  async getABTestResults(testId) {
    try {
      const response = await axios.get(`${this.baseURL}/ab-tests/${testId}/results`)
      return response.data.data
    } catch (error) {
      console.error('Error getting A/B test results:', error)
      throw error
    }
  }

  /**
   * Create or update feature flag
   * @param {Object} flag - Feature flag configuration
   * @returns {Promise<Object>} Created/updated flag
   */
  async setFeatureFlag(flag) {
    try {
      const response = await axios.post(`${this.baseURL}/feature-flags`, flag)
      return response.data.data
    } catch (error) {
      console.error('Error setting feature flag:', error)
      throw error
    }
  }

  /**
   * Get all feature flags
   * @returns {Promise<Array>} Feature flags
   */
  async getFeatureFlags() {
    try {
      const response = await axios.get(`${this.baseURL}/feature-flags`)
      return response.data.data
    } catch (error) {
      console.error('Error getting feature flags:', error)
      throw error
    }
  }

  /**
   * Check if feature is enabled for user
   * @param {string} flagId - Feature flag ID
   * @param {string} userId - User ID
   * @param {Array} userGroups - User groups
   * @returns {Promise<boolean>} Is feature enabled
   */
  async isFeatureEnabled(flagId, userId, userGroups = []) {
    try {
      const response = await axios.get(`${this.baseURL}/feature-flags/${flagId}/enabled`, {
        params: {
          userId,
          userGroups: userGroups.join(',')
        }
      })
      return response.data.data.enabled
    } catch (error) {
      console.error('Error checking feature flag:', error)
      throw error
    }
  }

  /**
   * Export metrics to external system
   * @param {string} system - Target system (google-analytics, mixpanel, etc.)
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export result
   */
  async exportMetrics(system, options = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/export`, {
        system,
        ...options
      })
      return response.data.data
    } catch (error) {
      console.error('Error exporting metrics:', error)
      throw error
    }
  }

  /**
   * Get dashboard data
   * @param {Object} options - Date range options
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboardData(options = {}) {
    try {
      const response = await axios.get(`${this.baseURL}/dashboard`, { params: options })
      return response.data.data
    } catch (error) {
      console.error('Error getting dashboard data:', error)
      throw error
    }
  }
}

export default new BusinessMetricsService()
