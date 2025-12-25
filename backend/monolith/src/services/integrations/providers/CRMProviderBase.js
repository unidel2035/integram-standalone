/**
 * CRM Provider Base Class
 *
 * Abstract base class for CRM integrations (HubSpot, Salesforce, Pipedrive).
 * Defines common interface that all CRM providers must implement.
 *
 * Issue #3041 - Lead Qualification Agent CRM Integration
 */

import logger from '../../../utils/logger.js'

export class CRMProviderBase {
  constructor(config) {
    this.providerName = config.providerName || 'unknown'
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
    this.apiBaseUrl = config.apiBaseUrl
  }

  /**
   * Exchange OAuth authorization code for access token
   * @param {string} code - Authorization code
   * @param {string} redirectUri - OAuth redirect URI
   * @returns {Promise<Object>} Token response { accessToken, refreshToken, expiresIn }
   */
  async exchangeCodeForToken(code, redirectUri) {
    throw new Error('exchangeCodeForToken must be implemented by subclass')
  }

  /**
   * Refresh expired access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken(refreshToken) {
    throw new Error('refreshAccessToken must be implemented by subclass')
  }

  /**
   * Create/sync lead to CRM
   * @param {string} accessToken - OAuth access token
   * @param {Object} leadData - Lead information
   * @returns {Promise<Object>} CRM contact/lead object with ID
   */
  async syncLeadToCRM(accessToken, leadData) {
    throw new Error('syncLeadToCRM must be implemented by subclass')
  }

  /**
   * Fetch lead from CRM by external ID
   * @param {string} accessToken - OAuth access token
   * @param {string} crmLeadId - CRM lead/contact ID
   * @returns {Promise<Object>} CRM lead/contact data
   */
  async fetchLeadFromCRM(accessToken, crmLeadId) {
    throw new Error('fetchLeadFromCRM must be implemented by subclass')
  }

  /**
   * Update lead status in CRM
   * @param {string} accessToken - OAuth access token
   * @param {string} crmLeadId - CRM lead/contact ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated CRM object
   */
  async updateLeadInCRM(accessToken, crmLeadId, updates) {
    throw new Error('updateLeadInCRM must be implemented by subclass')
  }

  /**
   * Search for lead in CRM by email
   * @param {string} accessToken - OAuth access token
   * @param {string} email - Lead email address
   * @returns {Promise<Object|null>} CRM lead/contact or null if not found
   */
  async searchLeadByEmail(accessToken, email) {
    throw new Error('searchLeadByEmail must be implemented by subclass')
  }

  /**
   * Verify webhook signature (if CRM supports webhooks)
   * @param {Object} req - Express request object
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(req) {
    logger.warn(`Webhook signature verification not implemented for ${this.providerName}`)
    return false
  }

  /**
   * Map internal lead data to CRM-specific format
   * @param {Object} leadData - Internal lead object
   * @returns {Object} CRM-specific lead object
   */
  mapLeadToCRMFormat(leadData) {
    // Base implementation - override in subclasses for CRM-specific mapping
    return {
      firstName: leadData.firstName,
      lastName: leadData.lastName,
      email: leadData.email,
      phone: leadData.phone,
      company: leadData.company,
      industry: leadData.industry,
      budget: leadData.budget,
      timeline: leadData.timeline,
      notes: leadData.notes,
      source: leadData.source,
      status: leadData.status,
      qualificationScore: leadData.qualificationScore
    }
  }

  /**
   * Map CRM lead data to internal format
   * @param {Object} crmLead - CRM-specific lead object
   * @returns {Object} Internal lead object
   */
  mapCRMLeadToInternalFormat(crmLead) {
    throw new Error('mapCRMLeadToInternalFormat must be implemented by subclass')
  }

  /**
   * Get field mapping configuration
   * @returns {Object} Field mappings { internalField: crmField }
   */
  getFieldMappings() {
    return {
      firstName: 'firstName',
      lastName: 'lastName',
      email: 'email',
      phone: 'phone',
      company: 'company',
      industry: 'industry',
      budget: 'budget',
      timeline: 'timeline',
      notes: 'notes',
      source: 'source',
      status: 'status',
      qualificationScore: 'score'
    }
  }

  /**
   * Handle API rate limiting
   * @param {Response} response - Fetch API response
   * @returns {Promise<void>}
   */
  async handleRateLimit(response) {
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000 // Default 60s

      logger.warn(`Rate limit hit for ${this.providerName}, waiting ${waitTime}ms`, {
        provider: this.providerName,
        retryAfter: waitTime
      })

      await new Promise(resolve => setTimeout(resolve, waitTime))
      throw new Error('RATE_LIMIT_RETRY')
    }
  }

  /**
   * Make API request with error handling and retry logic
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @param {number} retries - Number of retries remaining
   * @returns {Promise<Object>} API response data
   */
  async makeAPIRequest(endpoint, options = {}, retries = 3) {
    try {
      const response = await fetch(endpoint, options)

      // Handle rate limiting
      await this.handleRateLimit(response)

      // Handle non-2xx responses
      if (!response.ok) {
        const errorBody = await response.text()
        logger.error(`API request failed for ${this.providerName}`, {
          provider: this.providerName,
          endpoint,
          status: response.status,
          error: errorBody
        })

        throw new Error(`${this.providerName} API error: ${response.status} - ${errorBody}`)
      }

      return await response.json()
    } catch (error) {
      // Retry on rate limit or network errors
      if (error.message === 'RATE_LIMIT_RETRY' && retries > 0) {
        logger.info(`Retrying request to ${this.providerName}, ${retries} retries left`)
        return this.makeAPIRequest(endpoint, options, retries - 1)
      }

      logger.error(`API request failed for ${this.providerName}`, {
        provider: this.providerName,
        endpoint,
        error: error.message,
        retriesLeft: retries
      })

      throw error
    }
  }
}

export default CRMProviderBase
