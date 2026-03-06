/**
 * DronDoc Agent Service
 *
 * Frontend service layer for the unified DronDoc Agent API
 * Provides methods for creating, managing, and connecting agents
 *
 * Issue #4692 - DronDoc API for agent creation and connection
 */

import { getIntegramApiBaseUrl } from '@/utils/integramConfig'

// Construct API base URL
// If VITE_ORCHESTRATOR_URL is set, append '/api' to it
// Otherwise, use '/api' (for development proxy)
const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL
  ? `${import.meta.env.VITE_ORCHESTRATOR_URL}/api`
  : '/api'

/**
 * Handle API response
 */
async function handleResponse(response) {
  // Check if response is ok (status 200-299)
  if (!response.ok) {
    // Try to parse as JSON first
    const contentType = response.headers.get('content-type')

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json()
      throw new Error(data.error || data.message || `HTTP ${response.status}: ${response.statusText}`)
    } else {
      // Not JSON - likely HTML error page or plain text
      const text = await response.text()
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`)
    }
  }

  // Response is OK, parse JSON
  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'API request failed')
  }

  return data.data
}

/**
 * Handle API errors
 */
function handleError(error) {
  console.error('[DronDoc Agent Service]', error)
  throw error
}

// =============================================================================
// Agent Templates & Discovery
// =============================================================================

/**
 * List all available agent templates
 * @param {Object} filters - Optional filters (category, search, tags)
 * @returns {Promise<Array>} - List of agent templates
 */
export async function listAgentTemplates(filters = {}) {
  try {
    const queryParams = new URLSearchParams()

    if (filters.category) queryParams.append('category', filters.category)
    if (filters.search) queryParams.append('search', filters.search)
    if (filters.tags) queryParams.append('tags', filters.tags.join(','))

    const url = `${API_BASE_URL}/drondoc-agents/templates?${queryParams}`
    const response = await fetch(url)

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Get detailed agent template
 * @param {string} agentId - Agent template ID
 * @returns {Promise<Object>} - Agent template details
 */
export async function getAgentTemplate(agentId) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/templates/${agentId}`)
    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Get all agent categories with counts
 * @returns {Promise<Object>} - Categories with counts
 */
export async function getAgentCategories() {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/categories`)
    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Get agent code template
 * @param {string} agentId - Agent template ID
 * @returns {Promise<Object>} - Code template
 */
export async function getAgentCodeTemplate(agentId) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/templates/${agentId}/template`)
    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Get agent table schemas
 * @param {string} agentId - Agent template ID
 * @returns {Promise<Object>} - Table schemas
 */
export async function getAgentTableSchemas(agentId) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/templates/${agentId}/schema`)
    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Get agent configuration schema
 * @param {string} agentId - Agent template ID
 * @returns {Promise<Object>} - Configuration schema
 */
export async function getAgentConfigSchema(agentId) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/templates/${agentId}/config-schema`)
    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

// =============================================================================
// Agent Creation & Management
// =============================================================================

/**
 * Create a new agent instance
 * @param {Object} params - Creation parameters
 * @returns {Promise<Object>} - Created instance
 */
export async function createAgentInstance(params) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * List all agent instances for an organization
 * @param {string} organizationId - Organization ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} - List of instances
 */
export async function listAgentInstances(organizationId, filters = {}) {
  try {
    const queryParams = new URLSearchParams({
      organizationId
    })

    if (filters.agentId) queryParams.append('agentId', filters.agentId)
    if (filters.status) queryParams.append('status', filters.status)

    const url = `${API_BASE_URL}/drondoc-agents/instances?${queryParams}`
    const response = await fetch(url)

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Get agent instance details
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} - Instance details
 */
export async function getAgentInstance(instanceId, organizationId) {
  try {
    const url = `${API_BASE_URL}/drondoc-agents/instances/${instanceId}?organizationId=${organizationId}`
    const response = await fetch(url)

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Update agent configuration
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {Object} config - New configuration
 * @returns {Promise<Object>} - Updated instance
 */
export async function updateAgentConfig(instanceId, organizationId, config) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/instances/${instanceId}/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organizationId,
        config
      })
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Update agent custom code
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {string} code - New code
 * @param {Object} options - Optional commit message and author
 * @returns {Promise<Object>} - Update result
 */
export async function updateAgentCode(instanceId, organizationId, code, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/instances/${instanceId}/code`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organizationId,
        code,
        commitMessage: options.commitMessage,
        authorId: options.authorId
      })
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Reset agent code to template
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} - Reset result
 */
export async function resetAgentCode(instanceId, organizationId) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/instances/${instanceId}/code/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organizationId
      })
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

// =============================================================================
// Agent Lifecycle
// =============================================================================

/**
 * Start an agent instance
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} - Start result
 */
export async function startAgentInstance(instanceId, organizationId) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/instances/${instanceId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organizationId
      })
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Stop an agent instance
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} - Stop result
 */
export async function stopAgentInstance(instanceId, organizationId) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/instances/${instanceId}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organizationId
      })
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Pause an agent instance
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} - Pause result
 */
export async function pauseAgentInstance(instanceId, organizationId) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/instances/${instanceId}/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organizationId
      })
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Delete an agent instance
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} - Delete result
 */
export async function deleteAgentInstance(instanceId, organizationId) {
  try {
    const url = `${API_BASE_URL}/drondoc-agents/instances/${instanceId}?organizationId=${organizationId}`
    const response = await fetch(url, {
      method: 'DELETE'
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

// =============================================================================
// Code Version Management
// =============================================================================

/**
 * Get version history for an instance
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} - Version history
 */
export async function getVersionHistory(instanceId, organizationId, options = {}) {
  try {
    const queryParams = new URLSearchParams({
      organizationId
    })

    if (options.limit) queryParams.append('limit', options.limit)
    if (options.offset) queryParams.append('offset', options.offset)

    const url = `${API_BASE_URL}/drondoc-agents/instances/${instanceId}/versions?${queryParams}`
    const response = await fetch(url)

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Get a specific version
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {number} version - Version number
 * @returns {Promise<Object>} - Version data
 */
export async function getVersion(instanceId, organizationId, version) {
  try {
    const url = `${API_BASE_URL}/drondoc-agents/instances/${instanceId}/versions/${version}?organizationId=${organizationId}`
    const response = await fetch(url)

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Get diff between versions
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {number} fromVersion - From version
 * @param {number} toVersion - To version
 * @returns {Promise<Object>} - Diff data
 */
export async function getVersionDiff(instanceId, organizationId, fromVersion, toVersion) {
  try {
    const url = `${API_BASE_URL}/drondoc-agents/instances/${instanceId}/versions/diff?organizationId=${organizationId}&from=${fromVersion}&to=${toVersion}`
    const response = await fetch(url)

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Rollback to a specific version
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {number} version - Version to rollback to
 * @param {Object} options - Optional commit message and author
 * @returns {Promise<Object>} - Rollback result
 */
export async function rollbackToVersion(instanceId, organizationId, version, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/instances/${instanceId}/versions/${version}/rollback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organizationId,
        commitMessage: options.commitMessage,
        authorId: options.authorId
      })
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

// =============================================================================
// Testing & Validation
// =============================================================================

/**
 * Test agent code in sandbox
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {Object} options - Test options
 * @returns {Promise<Object>} - Test result
 */
export async function testAgentCode(instanceId, organizationId, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/instances/${instanceId}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organizationId,
        testData: options.testData || {},
        testCases: options.testCases || [],
        timeout: options.timeout || 30000
      })
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

// =============================================================================
// Statistics & Monitoring
// =============================================================================

/**
 * Get overall agent statistics
 * @returns {Promise<Object>} - Statistics
 */
export async function getAgentStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/stats`)
    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Get instance statistics
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} - Instance statistics
 */
export async function getInstanceStats(instanceId, organizationId) {
  try {
    const url = `${API_BASE_URL}/drondoc-agents/instances/${instanceId}/stats?organizationId=${organizationId}`
    const response = await fetch(url)

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

// =============================================================================
// Integration Endpoints
// =============================================================================

/**
 * Get available MCP tools
 * @returns {Promise<Array>} - List of MCP tools
 */
export async function getMCPTools() {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/integrations/mcp/tools`)
    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Get available AI models
 * @returns {Promise<Array>} - List of AI models
 */
export async function getAIModels() {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/integrations/ai/models`)
    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Execute AI chat
 * @param {Object} params - Chat parameters
 * @returns {Promise<Object>} - Chat result
 */
export async function executeAIChat(params) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/integrations/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

// =============================================================================
// Admin/Development Functions
// =============================================================================

/**
 * Reload agent templates from filesystem
 * @returns {Promise<Object>} - Reload result
 */
export async function reloadAgentTemplates() {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/templates/reload`, {
      method: 'POST'
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Register a new agent template
 * @param {Object} agentDefinition - Agent template definition
 * @returns {Promise<Object>} - Registered template
 */
export async function registerAgentTemplate(agentDefinition) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/templates/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(agentDefinition)
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Update an existing agent template
 * @param {string} agentId - Agent template ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} - Updated template
 */
export async function updateAgentTemplate(agentId, updates) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/templates/${agentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

// =============================================================================
// Integram Integration
// =============================================================================

/**
 * Save agent instance to Integram database
 * @param {Object} instance - Agent instance data
 * @param {Object} options - Integram connection options
 * @returns {Promise<Object>} - Saved instance with Integram ID
 */
export async function saveAgentToIntegram(instance, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/integram/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instance,
        serverUrl: options.serverUrl || getIntegramApiBaseUrl(),
        database: options.database || 'my',
        userId: options.userId
      })
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Load all agent instances from Integram database
 * @param {Object} options - Integram connection and filter options
 * @returns {Promise<Array>} - List of agent instances
 */
export async function loadAgentsFromIntegram(options = {}) {
  try {
    const queryParams = new URLSearchParams({
      serverUrl: options.serverUrl || getIntegramApiBaseUrl(),
      database: options.database || 'my'
    })

    if (options.userId) queryParams.append('userId', options.userId)
    if (options.organizationId) queryParams.append('organizationId', options.organizationId)
    if (options.status) queryParams.append('status', options.status)

    const url = `${API_BASE_URL}/drondoc-agents/integram/load?${queryParams}`
    const response = await fetch(url)

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Update agent instance in Integram
 * @param {string} integramId - Integram object ID
 * @param {Object} updates - Updates to apply
 * @param {Object} options - Integram connection options
 * @returns {Promise<Object>} - Updated instance
 */
export async function updateAgentInIntegram(integramId, updates, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/drondoc-agents/integram/${integramId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        updates,
        serverUrl: options.serverUrl || getIntegramApiBaseUrl(),
        database: options.database || 'my'
      })
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}

/**
 * Delete agent instance from Integram
 * @param {string} integramId - Integram object ID
 * @param {Object} options - Integram connection options
 * @returns {Promise<Object>} - Delete result
 */
export async function deleteAgentFromIntegram(integramId, options = {}) {
  try {
    const queryParams = new URLSearchParams({
      serverUrl: options.serverUrl || getIntegramApiBaseUrl(),
      database: options.database || 'my'
    })

    const url = `${API_BASE_URL}/drondoc-agents/integram/${integramId}?${queryParams}`
    const response = await fetch(url, {
      method: 'DELETE'
    })

    return await handleResponse(response)
  } catch (error) {
    return handleError(error)
  }
}
