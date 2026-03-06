/**
 * Data Sources Service
 *
 * Frontend service for managing organization data sources
 * Issue #3194 - Data source connection and management
 */

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

/**
 * Create a new data source
 *
 * @param {Object} dataSourceData - Data source configuration
 * @returns {Promise<Object>} Created data source
 */
export async function createDataSource(dataSourceData) {
  const response = await fetch(`${API_BASE_URL}/data-sources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dataSourceData)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error || 'Failed to create data source')
  }

  return data.data
}

/**
 * List data sources for an organization
 *
 * @param {string} organizationId - Organization ID
 * @param {Object} filters - Optional filters (type, status)
 * @returns {Promise<Array>} List of data sources
 */
export async function listDataSources(organizationId, filters = {}) {
  const params = new URLSearchParams({
    organizationId,
    ...filters
  })

  const response = await fetch(`${API_BASE_URL}/data-sources?${params}`)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error || 'Failed to list data sources')
  }

  return data.data
}

/**
 * Get a specific data source
 *
 * @param {string} dataSourceId - Data source ID
 * @returns {Promise<Object>} Data source details
 */
export async function getDataSource(dataSourceId) {
  const response = await fetch(`${API_BASE_URL}/data-sources/${dataSourceId}`)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error || 'Failed to get data source')
  }

  return data.data
}

/**
 * Update a data source
 *
 * @param {string} dataSourceId - Data source ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated data source
 */
export async function updateDataSource(dataSourceId, updates) {
  const response = await fetch(`${API_BASE_URL}/data-sources/${dataSourceId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error || 'Failed to update data source')
  }

  return data.data
}

/**
 * Delete a data source
 *
 * @param {string} dataSourceId - Data source ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteDataSource(dataSourceId) {
  const response = await fetch(`${API_BASE_URL}/data-sources/${dataSourceId}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error || 'Failed to delete data source')
  }

  return true
}

/**
 * Test data source connection
 *
 * @param {string} dataSourceId - Data source ID
 * @returns {Promise<Object>} Test result
 */
export async function testConnection(dataSourceId) {
  const response = await fetch(`${API_BASE_URL}/data-sources/${dataSourceId}/test`, {
    method: 'POST'
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  return data.data
}

/**
 * Trigger data synchronization
 *
 * @param {string} dataSourceId - Data source ID
 * @returns {Promise<Object>} Sync result
 */
export async function triggerSync(dataSourceId) {
  const response = await fetch(`${API_BASE_URL}/data-sources/${dataSourceId}/sync`, {
    method: 'POST'
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error || 'Failed to trigger sync')
  }

  return data.data
}

/**
 * Get data source statistics for an organization
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Statistics
 */
export async function getStatistics(organizationId) {
  const response = await fetch(`${API_BASE_URL}/data-sources/stats/${organizationId}`)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error || 'Failed to get statistics')
  }

  return data.data
}

/**
 * Get available data source types and configurations
 *
 * @returns {Promise<Object>} Metadata about available types
 */
export async function getSourceTypes() {
  const response = await fetch(`${API_BASE_URL}/data-sources/meta/types`)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) {
    throw new Error(data.error || 'Failed to get source types')
  }

  return data.data
}

/**
 * Get health status of data sources service
 *
 * @returns {Promise<Object>} Health status
 */
export async function getHealthStatus() {
  const response = await fetch(`${API_BASE_URL}/data-sources/health`)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  return data
}
