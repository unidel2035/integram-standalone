/**
 * HubSpot CRM Provider
 *
 * Implements HubSpot-specific CRM integration:
 * - OAuth2 authentication
 * - Contact/lead sync
 * - Deal tracking
 * - Custom properties support
 * - Webhook signature verification
 *
 * API Documentation: https://developers.hubspot.com/docs/api/overview
 * Issue #3041 - Lead Qualification Agent CRM Integration
 */

import CRMProviderBase from './CRMProviderBase.js'
import crypto from 'crypto'
import logger from '../../../utils/logger.js'

export class HubSpotCRMProvider extends CRMProviderBase {
  constructor(config) {
    super({
      providerName: 'HubSpot',
      clientId: config.clientId || process.env.HUBSPOT_CLIENT_ID,
      clientSecret: config.clientSecret || process.env.HUBSPOT_CLIENT_SECRET,
      apiBaseUrl: 'https://api.hubapi.com'
    })

    this.appSecret = config.appSecret || process.env.HUBSPOT_APP_SECRET
    this.tokenUrl = 'https://api.hubapi.com/oauth/v1/token'
  }

  /**
   * Exchange OAuth authorization code for access token
   * @param {string} code - Authorization code
   * @param {string} redirectUri - OAuth redirect URI
   * @returns {Promise<Object>} Token response
   */
  async exchangeCodeForToken(code, redirectUri) {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        code
      })

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HubSpot OAuth error: ${errorText}`)
      }

      const data = await response.json()

      logger.info('Successfully exchanged HubSpot OAuth code for token')

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in
      }
    } catch (error) {
      logger.error('Failed to exchange HubSpot OAuth code', { error: error.message })
      throw error
    }
  }

  /**
   * Refresh expired access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken(refreshToken) {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken
      })

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HubSpot token refresh error: ${errorText}`)
      }

      const data = await response.json()

      logger.info('Successfully refreshed HubSpot access token')

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in
      }
    } catch (error) {
      logger.error('Failed to refresh HubSpot token', { error: error.message })
      throw error
    }
  }

  /**
   * Sync lead to HubSpot as contact
   * @param {string} accessToken - OAuth access token
   * @param {Object} leadData - Lead information
   * @returns {Promise<Object>} HubSpot contact object with ID
   */
  async syncLeadToCRM(accessToken, leadData) {
    try {
      // First, search if contact exists by email
      const existingContact = await this.searchLeadByEmail(accessToken, leadData.email)

      if (existingContact) {
        // Update existing contact
        logger.info('Updating existing HubSpot contact', { email: leadData.email, contactId: existingContact.id })
        return this.updateLeadInCRM(accessToken, existingContact.id, leadData)
      }

      // Create new contact
      const contactData = this.mapLeadToCRMFormat(leadData)

      const response = await this.makeAPIRequest(
        `${this.apiBaseUrl}/crm/v3/objects/contacts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: contactData
          })
        }
      )

      logger.info('Created new HubSpot contact', { email: leadData.email, contactId: response.id })

      return {
        id: response.id,
        email: leadData.email,
        properties: response.properties,
        createdAt: response.createdAt
      }
    } catch (error) {
      logger.error('Failed to sync lead to HubSpot', { error: error.message, email: leadData.email })
      throw error
    }
  }

  /**
   * Fetch contact from HubSpot by ID
   * @param {string} accessToken - OAuth access token
   * @param {string} contactId - HubSpot contact ID
   * @returns {Promise<Object>} HubSpot contact data
   */
  async fetchLeadFromCRM(accessToken, contactId) {
    try {
      const response = await this.makeAPIRequest(
        `${this.apiBaseUrl}/crm/v3/objects/contacts/${contactId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      logger.info('Fetched HubSpot contact', { contactId })

      return this.mapCRMLeadToInternalFormat(response)
    } catch (error) {
      logger.error('Failed to fetch contact from HubSpot', { error: error.message, contactId })
      throw error
    }
  }

  /**
   * Update contact in HubSpot
   * @param {string} accessToken - OAuth access token
   * @param {string} contactId - HubSpot contact ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated HubSpot contact
   */
  async updateLeadInCRM(accessToken, contactId, updates) {
    try {
      const contactData = this.mapLeadToCRMFormat(updates)

      const response = await this.makeAPIRequest(
        `${this.apiBaseUrl}/crm/v3/objects/contacts/${contactId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: contactData
          })
        }
      )

      logger.info('Updated HubSpot contact', { contactId })

      return {
        id: response.id,
        properties: response.properties,
        updatedAt: response.updatedAt
      }
    } catch (error) {
      logger.error('Failed to update contact in HubSpot', { error: error.message, contactId })
      throw error
    }
  }

  /**
   * Search for contact in HubSpot by email
   * @param {string} accessToken - OAuth access token
   * @param {string} email - Contact email address
   * @returns {Promise<Object|null>} HubSpot contact or null if not found
   */
  async searchLeadByEmail(accessToken, email) {
    try {
      const response = await this.makeAPIRequest(
        `${this.apiBaseUrl}/crm/v3/objects/contacts/search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'email',
                    operator: 'EQ',
                    value: email
                  }
                ]
              }
            ]
          })
        }
      )

      if (response.results && response.results.length > 0) {
        logger.info('Found existing HubSpot contact', { email, contactId: response.results[0].id })
        return response.results[0]
      }

      logger.info('No existing HubSpot contact found', { email })
      return null
    } catch (error) {
      logger.error('Failed to search contact in HubSpot', { error: error.message, email })
      throw error
    }
  }

  /**
   * Verify HubSpot webhook signature
   * @param {Object} req - Express request object
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(req) {
    try {
      const signature = req.headers['x-hubspot-signature']

      if (!signature || !this.appSecret) {
        logger.warn('Missing HubSpot signature or app secret')
        return false
      }

      const body = JSON.stringify(req.body)
      const expectedSignature = crypto
        .createHmac('sha256', this.appSecret)
        .update(body)
        .digest('hex')

      const valid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )

      if (!valid) {
        logger.warn('Invalid HubSpot webhook signature')
      }

      return valid
    } catch (error) {
      logger.error('Error verifying HubSpot webhook signature', { error: error.message })
      return false
    }
  }

  /**
   * Map internal lead data to HubSpot contact properties
   * @param {Object} leadData - Internal lead object
   * @returns {Object} HubSpot contact properties
   */
  mapLeadToCRMFormat(leadData) {
    const properties = {}

    // Standard HubSpot contact properties
    if (leadData.firstName) properties.firstname = leadData.firstName
    if (leadData.lastName) properties.lastname = leadData.lastName
    if (leadData.email) properties.email = leadData.email
    if (leadData.phone) properties.phone = leadData.phone
    if (leadData.company) properties.company = leadData.company

    // Custom properties (must be created in HubSpot first)
    if (leadData.industry) properties.industry = leadData.industry
    if (leadData.budget !== undefined) properties.budget = String(leadData.budget)
    if (leadData.timeline) properties.timeline = leadData.timeline
    if (leadData.source) properties.lead_source = leadData.source
    if (leadData.status) properties.hs_lead_status = leadData.status
    if (leadData.qualificationScore !== undefined) {
      properties.qualification_score = String(leadData.qualificationScore)
    }

    // Notes - append to existing notes
    if (leadData.notes) {
      properties.notes = leadData.notes
    }

    return properties
  }

  /**
   * Map HubSpot contact data to internal format
   * @param {Object} hubspotContact - HubSpot contact object
   * @returns {Object} Internal lead object
   */
  mapCRMLeadToInternalFormat(hubspotContact) {
    const props = hubspotContact.properties || {}

    return {
      crmId: hubspotContact.id,
      crmProvider: 'hubspot',
      firstName: props.firstname || '',
      lastName: props.lastname || '',
      email: props.email || '',
      phone: props.phone || '',
      company: props.company || '',
      industry: props.industry || '',
      budget: props.budget ? parseFloat(props.budget) : null,
      timeline: props.timeline || '',
      source: props.lead_source || props.hs_analytics_source || '',
      status: props.hs_lead_status || 'new',
      qualificationScore: props.qualification_score ? parseFloat(props.qualification_score) : null,
      notes: props.notes || '',
      crmCreatedAt: hubspotContact.createdAt,
      crmUpdatedAt: hubspotContact.updatedAt,
      crmUrl: `https://app.hubspot.com/contacts/${hubspotContact.id}`
    }
  }

  /**
   * Get HubSpot-specific field mappings
   * @returns {Object} Field mappings
   */
  getFieldMappings() {
    return {
      firstName: 'firstname',
      lastName: 'lastname',
      email: 'email',
      phone: 'phone',
      company: 'company',
      industry: 'industry',
      budget: 'budget',
      timeline: 'timeline',
      notes: 'notes',
      source: 'lead_source',
      status: 'hs_lead_status',
      qualificationScore: 'qualification_score'
    }
  }
}

export default HubSpotCRMProvider
