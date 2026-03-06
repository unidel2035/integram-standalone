/**
 * DronDoc Agents Service
 *
 * Frontend service for interacting with the unified DronDoc Agents API
 *
 * Issue #4692 - DronDoc API for agent creation and connection
 *
 * API Specification: /backend/monolith/docs/DRONDOC_AGENT_API.md
 */

import { getOrchestratorUrl } from '@/utils/apiConfig'

const API_BASE_URL = getOrchestratorUrl()
const API_PATH = '/api/drondoc-agents'

/**
 * Base fetch wrapper with error handling
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${API_PATH}${endpoint}`

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `API request failed with status ${response.status}`)
  }

  return data
}

// ============================================================================
// AGENT TEMPLATES (REGISTRY)
// ============================================================================

/**
 * Get all available agent templates
 * @param {Object} filters - Optional filters (category, search, tags)
 * @returns {Promise<Object>} { success, data: templates[], count }
 */
export async function getAgentTemplates(filters = {}) {
  const params = new URLSearchParams()

  if (filters.category) params.append('category', filters.category)
  if (filters.search) params.append('search', filters.search)
  if (filters.tags) params.append('tags', filters.tags)

  const query = params.toString()
  const endpoint = query ? `/templates?${query}` : '/templates'

  return apiFetch(endpoint)
}

/**
 * Get specific agent template by ID
 * @param {string} templateId - Agent template ID
 * @returns {Promise<Object>} { success, data: template }
 */
export async function getAgentTemplate(templateId) {
  return apiFetch(`/templates/${templateId}`)
}

/**
 * Get agent categories with counts
 * @returns {Promise<Object>} { success, data: { category: count } }
 */
export async function getAgentCategories() {
  return apiFetch('/categories')
}

/**
 * Get agent code template
 * @param {string} templateId - Agent template ID
 * @returns {Promise<Object>} { success, data: codeTemplate }
 */
export async function getAgentCodeTemplate(templateId) {
  return apiFetch(`/templates/${templateId}/template`)
}

/**
 * Get agent table schemas
 * @param {string} templateId - Agent template ID
 * @returns {Promise<Object>} { success, data: schemas }
 */
export async function getAgentTableSchemas(templateId) {
  return apiFetch(`/templates/${templateId}/schema`)
}

/**
 * Get agent configuration schema
 * @param {string} templateId - Agent template ID
 * @returns {Promise<Object>} { success, data: configSchema }
 */
export async function getAgentConfigSchema(templateId) {
  return apiFetch(`/templates/${templateId}/config-schema`)
}

// ============================================================================
// AGENT INSTANCES (DEPLOYMENTS)
// ============================================================================

/**
 * Create a new agent instance
 * @param {Object} instanceData - Instance configuration
 * @returns {Promise<Object>} { success, data: instance, message }
 */
export async function createAgentInstance(instanceData) {
  return apiFetch('/create', {
    method: 'POST',
    body: JSON.stringify(instanceData)
  })
}

/**
 * Get all agent instances for an organization
 * @param {string} organizationId - Organization ID
 * @param {Object} filters - Optional filters (agentId, status)
 * @returns {Promise<Object>} { success, data: instances[], count }
 */
export async function getAgentInstances(organizationId, filters = {}) {
  const params = new URLSearchParams({ organizationId })

  if (filters.agentId) params.append('agentId', filters.agentId)
  if (filters.status) params.append('status', filters.status)

  return apiFetch(`/instances?${params.toString()}`)
}

/**
 * Get specific agent instance
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} { success, data: instance }
 */
export async function getAgentInstance(instanceId, organizationId) {
  return apiFetch(`/instances/${instanceId}?organizationId=${organizationId}`)
}

/**
 * Update agent instance configuration
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {Object} config - New configuration
 * @returns {Promise<Object>} { success, data: updated, message }
 */
export async function updateAgentConfig(instanceId, organizationId, config) {
  return apiFetch(`/instances/${instanceId}/config`, {
    method: 'PUT',
    body: JSON.stringify({ organizationId, config })
  })
}

/**
 * Update agent instance code
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {string} code - New code
 * @param {Object} metadata - Optional metadata (commitMessage, authorId)
 * @returns {Promise<Object>} { success, data: result, message }
 */
export async function updateAgentCode(instanceId, organizationId, code, metadata = {}) {
  return apiFetch(`/instances/${instanceId}/code`, {
    method: 'PUT',
    body: JSON.stringify({
      organizationId,
      code,
      ...metadata
    })
  })
}

/**
 * Reset agent code to template
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} { success, data: result, message }
 */
export async function resetAgentCode(instanceId, organizationId) {
  return apiFetch(`/instances/${instanceId}/code/reset`, {
    method: 'POST',
    body: JSON.stringify({ organizationId })
  })
}

// ============================================================================
// AGENT LIFECYCLE
// ============================================================================

/**
 * Start an agent instance
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} { success, data: instance }
 */
export async function startAgentInstance(instanceId, organizationId) {
  return apiFetch(`/instances/${instanceId}/start`, {
    method: 'POST',
    body: JSON.stringify({ organizationId })
  })
}

/**
 * Stop an agent instance
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} { success, data: instance }
 */
export async function stopAgentInstance(instanceId, organizationId) {
  return apiFetch(`/instances/${instanceId}/stop`, {
    method: 'POST',
    body: JSON.stringify({ organizationId })
  })
}

/**
 * Pause an agent instance
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} { success, data: instance }
 */
export async function pauseAgentInstance(instanceId, organizationId) {
  return apiFetch(`/instances/${instanceId}/pause`, {
    method: 'POST',
    body: JSON.stringify({ organizationId })
  })
}

/**
 * Delete an agent instance
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} { success, data: result, message }
 */
export async function deleteAgentInstance(instanceId, organizationId) {
  return apiFetch(`/instances/${instanceId}?organizationId=${organizationId}`, {
    method: 'DELETE'
  })
}

// ============================================================================
// CODE VERSION MANAGEMENT
// ============================================================================

/**
 * Get version history for an instance
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {Object} options - Optional pagination (limit, offset)
 * @returns {Promise<Object>} { success, data: history }
 */
export async function getVersionHistory(instanceId, organizationId, options = {}) {
  const params = new URLSearchParams({ organizationId })

  if (options.limit) params.append('limit', options.limit)
  if (options.offset) params.append('offset', options.offset)

  return apiFetch(`/instances/${instanceId}/versions?${params.toString()}`)
}

/**
 * Get specific version
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {number} version - Version number
 * @returns {Promise<Object>} { success, data: versionData }
 */
export async function getVersion(instanceId, organizationId, version) {
  return apiFetch(`/instances/${instanceId}/versions/${version}?organizationId=${organizationId}`)
}

/**
 * Get diff between versions
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {number} fromVersion - From version
 * @param {number} toVersion - To version
 * @returns {Promise<Object>} { success, data: diff }
 */
export async function getVersionDiff(instanceId, organizationId, fromVersion, toVersion) {
  const params = new URLSearchParams({
    organizationId,
    from: fromVersion,
    to: toVersion
  })

  return apiFetch(`/instances/${instanceId}/versions/diff?${params.toString()}`)
}

/**
 * Rollback to a specific version
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {number} version - Version to rollback to
 * @param {Object} metadata - Optional metadata (commitMessage, authorId)
 * @returns {Promise<Object>} { success, data: result, message }
 */
export async function rollbackToVersion(instanceId, organizationId, version, metadata = {}) {
  return apiFetch(`/instances/${instanceId}/versions/${version}/rollback`, {
    method: 'POST',
    body: JSON.stringify({
      organizationId,
      ...metadata
    })
  })
}

// ============================================================================
// TESTING & VALIDATION
// ============================================================================

/**
 * Test agent code in sandbox
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @param {Object} testOptions - Test configuration
 * @returns {Promise<Object>} { success, data: testResult }
 */
export async function testAgentCode(instanceId, organizationId, testOptions = {}) {
  return apiFetch(`/instances/${instanceId}/test`, {
    method: 'POST',
    body: JSON.stringify({
      organizationId,
      ...testOptions
    })
  })
}

// ============================================================================
// STATISTICS & MONITORING
// ============================================================================

/**
 * Get overall agent statistics
 * @returns {Promise<Object>} { success, data: stats }
 */
export async function getAgentStats() {
  return apiFetch('/stats')
}

/**
 * Get instance statistics
 * @param {string} instanceId - Instance ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} { success, data: stats }
 */
export async function getInstanceStats(instanceId, organizationId) {
  return apiFetch(`/instances/${instanceId}/stats?organizationId=${organizationId}`)
}

// ============================================================================
// INTEGRATIONS
// ============================================================================

/**
 * Get available MCP tools
 * @returns {Promise<Object>} { success, data: tools[], count }
 */
export async function getMCPTools() {
  return apiFetch('/integrations/mcp/tools')
}

/**
 * Get available AI models
 * @returns {Promise<Object>} { success, data: models[], count }
 */
export async function getAIModels() {
  return apiFetch('/integrations/ai/models')
}

/**
 * Execute AI chat (uses token system)
 * @param {Object} chatData - Chat configuration
 * @returns {Promise<Object>} { success, data: response }
 */
export async function executeAIChat(chatData) {
  return apiFetch('/integrations/ai/chat', {
    method: 'POST',
    body: JSON.stringify(chatData)
  })
}

// ============================================================================
// ADMIN/DEVELOPMENT
// ============================================================================

/**
 * Reload agent templates from filesystem (development only)
 * @returns {Promise<Object>} { success, data: result, message }
 */
export async function reloadTemplates() {
  return apiFetch('/templates/reload', {
    method: 'POST'
  })
}

/**
 * Register a new agent template dynamically
 * @param {Object} templateData - Template configuration
 * @returns {Promise<Object>} { success, data: registered, message }
 */
export async function registerTemplate(templateData) {
  return apiFetch('/templates/register', {
    method: 'POST',
    body: JSON.stringify(templateData)
  })
}

/**
 * Update an existing agent template
 * @param {string} templateId - Template ID
 * @param {Object} updates - Template updates
 * @returns {Promise<Object>} { success, data: updated, message }
 */
export async function updateTemplate(templateId, updates) {
  return apiFetch(`/templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  })
}

// Export all functions as named exports
export default {
  // Templates
  getAgentTemplates,
  getAgentTemplate,
  getAgentCategories,
  getAgentCodeTemplate,
  getAgentTableSchemas,
  getAgentConfigSchema,

  // Instances
  createAgentInstance,
  getAgentInstances,
  getAgentInstance,
  updateAgentConfig,
  updateAgentCode,
  resetAgentCode,

  // Lifecycle
  startAgentInstance,
  stopAgentInstance,
  pauseAgentInstance,
  deleteAgentInstance,

  // Version Management
  getVersionHistory,
  getVersion,
  getVersionDiff,
  rollbackToVersion,

  // Testing
  testAgentCode,

  // Statistics
  getAgentStats,
  getInstanceStats,

  // Integrations
  getMCPTools,
  getAIModels,
  executeAIChat,

  // Admin
  reloadTemplates,
  registerTemplate,
  updateTemplate
}
