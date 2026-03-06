/**
 * Backup Service
 *
 * Frontend service for interacting with backup and recovery API
 *
 * @module services/backupService
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

/**
 * Get backup system status
 * @returns {Promise<Object>} Backup status
 */
export async function getBackupStatus() {
  const response = await fetch(`${API_BASE_URL}/backup/status`)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Failed to get backup status')
  }

  return data.data
}

/**
 * Get backup metrics
 * @param {Object} options - Query options
 * @param {number} options.days - Number of days to include in metrics
 * @returns {Promise<Object>} Backup metrics
 */
export async function getBackupMetrics(options = {}) {
  const params = new URLSearchParams()

  if (options.days) {
    params.append('days', options.days.toString())
  }

  const response = await fetch(`${API_BASE_URL}/backup/metrics?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Failed to get backup metrics')
  }

  return data.data
}

/**
 * List backups with optional filters
 * @param {Object} filters - Filter options
 * @param {string} filters.type - Backup type (full, wal, volume, config)
 * @param {string} filters.status - Backup status (completed, running, failed)
 * @param {string} filters.startDate - Start date filter
 * @param {number} filters.limit - Maximum number of results
 * @returns {Promise<Array>} List of backups
 */
export async function listBackups(filters = {}) {
  const params = new URLSearchParams()

  if (filters.type) {
    params.append('type', filters.type)
  }

  if (filters.status) {
    params.append('status', filters.status)
  }

  if (filters.startDate) {
    params.append('startDate', filters.startDate)
  }

  if (filters.limit) {
    params.append('limit', filters.limit.toString())
  }

  const response = await fetch(`${API_BASE_URL}/backup/list?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Failed to list backups')
  }

  return data.data
}

/**
 * Get details of a specific backup
 * @param {string} backupId - Backup job ID
 * @returns {Promise<Object>} Backup details
 */
export async function getBackupDetails(backupId) {
  const response = await fetch(`${API_BASE_URL}/backup/${backupId}`)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Failed to get backup details')
  }

  return data.data
}

/**
 * Create a new backup
 * @param {Object} options - Backup options
 * @param {string} options.type - Backup type (full, wal, volume, config)
 * @param {Object} options.options - Type-specific options
 * @returns {Promise<Object>} Created backup job
 */
export async function createBackup(options) {
  const response = await fetch(`${API_BASE_URL}/backup/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(options)
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Failed to create backup')
  }

  return data.data
}

/**
 * Verify backup integrity
 * @param {string} backupId - Backup job ID
 * @returns {Promise<Object>} Verification result
 */
export async function verifyBackup(backupId) {
  const response = await fetch(`${API_BASE_URL}/backup/${backupId}/verify`, {
    method: 'POST'
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Failed to verify backup')
  }

  return data.data
}

/**
 * Cleanup old backups based on retention policies
 * @returns {Promise<Object>} Cleanup result
 */
export async function cleanupOldBackups() {
  const response = await fetch(`${API_BASE_URL}/backup/cleanup`, {
    method: 'POST'
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Failed to cleanup backups')
  }

  return data.data
}

/**
 * Get backup configuration
 * @returns {Promise<Object>} Backup configuration
 */
export async function getBackupConfig() {
  const response = await fetch(`${API_BASE_URL}/backup/config`)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Failed to get backup config')
  }

  return data.data
}

/**
 * Update backup configuration
 * @param {string} configKey - Configuration key
 * @param {string} configValue - Configuration value
 * @returns {Promise<Object>} Updated configuration
 */
export async function updateBackupConfig(configKey, configValue) {
  const response = await fetch(`${API_BASE_URL}/backup/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ configKey, configValue })
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Failed to update backup config')
  }

  return data.data
}

/**
 * Request user data export (GDPR)
 * @param {Object} options - Export options
 * @param {string} options.userId - User ID
 * @param {string} options.format - Export format (json, csv, etc.)
 * @param {boolean} options.includeFiles - Include user files
 * @returns {Promise<Object>} Export job
 */
export async function requestUserDataExport(options) {
  const response = await fetch(`${API_BASE_URL}/backup/user-data-export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(options)
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Failed to request user data export')
  }

  return data.data
}

/**
 * Get user data export status or download link
 * @param {string} exportId - Export job ID
 * @param {boolean} download - Whether to get download link
 * @returns {Promise<Object>} Export status or download info
 */
export async function getUserDataExport(exportId, download = false) {
  const params = new URLSearchParams()

  if (download) {
    params.append('download', 'true')
  }

  const response = await fetch(`${API_BASE_URL}/backup/user-data-export/${exportId}?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Failed to get user data export')
  }

  return data.data
}

export default {
  getBackupStatus,
  getBackupMetrics,
  listBackups,
  getBackupDetails,
  createBackup,
  verifyBackup,
  cleanupOldBackups,
  getBackupConfig,
  updateBackupConfig,
  requestUserDataExport,
  getUserDataExport
}
