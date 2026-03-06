/**
 * CRM Integration Service
 *
 * Frontend service for CRM integration with Lead Qualification Agent.
 * Handles connection, authentication, and data synchronization with CRM systems.
 *
 * Issue #3041 - Lead Qualification Agent CRM Integration
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

/**
 * Get list of supported CRM providers
 * @returns {Promise<Array>} Available CRM providers
 */
export async function getCRMProviders() {
  try {
    const response = await axios.get(`${API_BASE_URL}/crm/providers`)
    return response.data.providers
  } catch (error) {
    console.error('Failed to fetch CRM providers:', error)
    throw error
  }
}

/**
 * Initiate OAuth flow for CRM connection
 * @param {string} provider - CRM provider (hubspot, salesforce, pipedrive)
 * @param {string} userId - User ID
 * @param {string} redirectUri - OAuth callback URL
 * @returns {Promise<Object>} { authUrl, state }
 */
export async function initiateCRMConnection(provider, userId, redirectUri) {
  try {
    const response = await axios.post(`${API_BASE_URL}/crm/connect/${provider}`, {
      userId,
      redirectUri
    })

    return response.data
  } catch (error) {
    console.error(`Failed to initiate ${provider} connection:`, error)
    throw error
  }
}

/**
 * Complete OAuth flow and get connection
 * @param {string} provider - CRM provider
 * @param {string} code - OAuth authorization code
 * @param {string} state - OAuth state
 * @returns {Promise<Object>} Connection object
 */
export async function completeCRMConnection(provider, code, state) {
  try {
    const response = await axios.post(`${API_BASE_URL}/crm/callback/${provider}`, {
      code,
      state
    })

    return response.data.connection
  } catch (error) {
    console.error(`Failed to complete ${provider} connection:`, error)
    throw error
  }
}

/**
 * Get user's CRM connections
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of CRM connections
 */
export async function getCRMConnections(userId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/crm/connections/${userId}`)
    return response.data.connections
  } catch (error) {
    console.error('Failed to fetch CRM connections:', error)
    throw error
  }
}

/**
 * Disconnect CRM
 * @param {string} connectionId - Connection ID
 * @returns {Promise<Object>} Disconnection result
 */
export async function disconnectCRM(connectionId) {
  try {
    const response = await axios.delete(`${API_BASE_URL}/crm/connections/${connectionId}`)
    return response.data
  } catch (error) {
    console.error('Failed to disconnect CRM:', error)
    throw error
  }
}

/**
 * Sync lead to CRM
 * @param {string} leadId - Lead ID
 * @param {string} connectionId - CRM connection ID
 * @param {Object} leadData - Lead information
 * @returns {Promise<Object>} Sync result with CRM lead ID
 */
export async function syncLeadToCRM(leadId, connectionId, leadData) {
  try {
    const response = await axios.post(`${API_BASE_URL}/crm/sync/lead`, {
      leadId,
      connectionId,
      leadData
    })

    return response.data
  } catch (error) {
    console.error('Failed to sync lead to CRM:', error)
    throw error
  }
}

/**
 * Fetch lead from CRM
 * @param {string} crmLeadId - CRM lead/contact ID
 * @param {string} connectionId - CRM connection ID
 * @returns {Promise<Object>} Lead data from CRM
 */
export async function fetchLeadFromCRM(crmLeadId, connectionId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/crm/fetch/lead/${crmLeadId}`, {
      params: { connectionId }
    })

    return response.data.leadData
  } catch (error) {
    console.error('Failed to fetch lead from CRM:', error)
    throw error
  }
}

/**
 * Update lead in CRM
 * @param {string} crmLeadId - CRM lead/contact ID
 * @param {string} connectionId - CRM connection ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated lead data
 */
export async function updateLeadInCRM(crmLeadId, connectionId, updates) {
  try {
    const response = await axios.patch(`${API_BASE_URL}/crm/update/lead/${crmLeadId}`, {
      connectionId,
      updates
    })

    return response.data.updatedLead
  } catch (error) {
    console.error('Failed to update lead in CRM:', error)
    throw error
  }
}

/**
 * Get field mappings for CRM provider
 * @param {string} provider - CRM provider
 * @returns {Promise<Object>} Field mappings
 */
export async function getCRMFieldMappings(provider) {
  try {
    const response = await axios.get(`${API_BASE_URL}/crm/field-mappings/${provider}`)
    return response.data.fieldMappings
  } catch (error) {
    console.error('Failed to get field mappings:', error)
    throw error
  }
}

/**
 * Get sync queue (failed syncs awaiting retry)
 * @returns {Promise<Array>} Queued sync items
 */
export async function getSyncQueue() {
  try {
    const response = await axios.get(`${API_BASE_URL}/crm/sync-queue`)
    return response.data.queue
  } catch (error) {
    console.error('Failed to fetch sync queue:', error)
    throw error
  }
}

/**
 * Open CRM OAuth popup window
 * @param {string} authUrl - OAuth authorization URL
 * @returns {Promise<Object>} { code, state } from OAuth callback
 */
export function openCRMOAuthPopup(authUrl) {
  return new Promise((resolve, reject) => {
    const width = 600
    const height = 700
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2

    const popup = window.open(
      authUrl,
      'CRM OAuth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    )

    if (!popup) {
      reject(new Error('Failed to open OAuth popup. Please allow popups for this site.'))
      return
    }

    // Listen for OAuth callback message
    const messageHandler = (event) => {
      // Verify origin
      if (event.origin !== window.location.origin) {
        return
      }

      if (event.data.type === 'CRM_OAUTH_SUCCESS') {
        window.removeEventListener('message', messageHandler)
        popup.close()
        resolve({
          code: event.data.code,
          state: event.data.state
        })
      } else if (event.data.type === 'CRM_OAUTH_ERROR') {
        window.removeEventListener('message', messageHandler)
        popup.close()
        reject(new Error(event.data.error || 'OAuth authentication failed'))
      }
    }

    window.addEventListener('message', messageHandler)

    // Check if popup was closed
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed)
        window.removeEventListener('message', messageHandler)
        reject(new Error('OAuth popup was closed'))
      }
    }, 1000)
  })
}

export const crmIntegrationService = {
  getCRMProviders,
  initiateCRMConnection,
  completeCRMConnection,
  getCRMConnections,
  disconnectCRM,
  syncLeadToCRM,
  fetchLeadFromCRM,
  updateLeadInCRM,
  getCRMFieldMappings,
  getSyncQueue,
  openCRMOAuthPopup
}

export default crmIntegrationService
