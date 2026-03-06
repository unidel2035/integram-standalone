/**
 * Secrets Management Service
 *
 * Frontend service for communicating with the Secrets Management API.
 * Handles secrets CRUD operations, rotation, audit logs, and leak detection.
 *
 * Issue #2471 - Агент управления секретами и токенами
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

/**
 * Get all secrets (without values)
 * @param {Object} filters - Optional filters (type, tag, search)
 * @returns {Promise<Array>} List of secrets
 */
export async function listSecrets(filters = {}) {
  try {
    const params = new URLSearchParams()
    if (filters.type) params.append('type', filters.type)
    if (filters.tag) params.append('tag', filters.tag)
    if (filters.search) params.append('search', filters.search)

    const response = await axios.get(`${API_BASE_URL}/secrets?${params}`)
    return response.data.data
  } catch (error) {
    console.error('[SecretsService] List secrets error:', error)
    throw new Error(error.response?.data?.error || 'Failed to list secrets')
  }
}

/**
 * Get a specific secret
 * @param {string} secretId - Secret ID
 * @param {boolean} includeValue - Whether to include decrypted value
 * @returns {Promise<Object>} Secret details
 */
export async function getSecret(secretId, includeValue = false) {
  try {
    const response = await axios.get(`${API_BASE_URL}/secrets/${secretId}`, {
      params: { includeValue }
    })
    return response.data.data
  } catch (error) {
    console.error('[SecretsService] Get secret error:', error)
    throw new Error(error.response?.data?.error || 'Failed to get secret')
  }
}

/**
 * Create a new secret
 * @param {Object} secretData - Secret data (name, value, type, etc.)
 * @returns {Promise<Object>} Created secret
 */
export async function createSecret(secretData) {
  try {
    const response = await axios.post(`${API_BASE_URL}/secrets`, secretData)
    return response.data.data
  } catch (error) {
    console.error('[SecretsService] Create secret error:', error)
    throw new Error(error.response?.data?.error || 'Failed to create secret')
  }
}

/**
 * Update a secret
 * @param {string} secretId - Secret ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Updated secret
 */
export async function updateSecret(secretId, updates) {
  try {
    const response = await axios.put(`${API_BASE_URL}/secrets/${secretId}`, updates)
    return response.data.data
  } catch (error) {
    console.error('[SecretsService] Update secret error:', error)
    throw new Error(error.response?.data?.error || 'Failed to update secret')
  }
}

/**
 * Rotate a secret (update its value)
 * @param {string} secretId - Secret ID
 * @param {string} newValue - New secret value
 * @returns {Promise<Object>} Rotated secret
 */
export async function rotateSecret(secretId, newValue) {
  try {
    const response = await axios.post(`${API_BASE_URL}/secrets/${secretId}/rotate`, {
      newValue
    })
    return response.data.data
  } catch (error) {
    console.error('[SecretsService] Rotate secret error:', error)
    throw new Error(error.response?.data?.error || 'Failed to rotate secret')
  }
}

/**
 * Delete a secret
 * @param {string} secretId - Secret ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteSecret(secretId) {
  try {
    const response = await axios.delete(`${API_BASE_URL}/secrets/${secretId}`)
    return response.data.data
  } catch (error) {
    console.error('[SecretsService] Delete secret error:', error)
    throw new Error(error.response?.data?.error || 'Failed to delete secret')
  }
}

/**
 * Get secrets that need rotation
 * @returns {Promise<Array>} Secrets needing rotation
 */
export async function getSecretsNeedingRotation() {
  try {
    const response = await axios.get(`${API_BASE_URL}/secrets/rotation-needed`)
    return response.data.data
  } catch (error) {
    console.error('[SecretsService] Get rotation needed error:', error)
    throw new Error(error.response?.data?.error || 'Failed to get secrets needing rotation')
  }
}

/**
 * Get secrets statistics
 * @returns {Promise<Object>} Statistics about secrets
 */
export async function getStatistics() {
  try {
    const response = await axios.get(`${API_BASE_URL}/secrets/statistics`)
    return response.data.data
  } catch (error) {
    console.error('[SecretsService] Get statistics error:', error)
    throw new Error(error.response?.data?.error || 'Failed to get statistics')
  }
}

/**
 * Get audit logs
 * @param {Object} filters - Optional filters (secretId, userId, action, dates, limit)
 * @returns {Promise<Array>} Audit log entries
 */
export async function getAuditLogs(filters = {}) {
  try {
    const params = new URLSearchParams()
    if (filters.secretId) params.append('secretId', filters.secretId)
    if (filters.userId) params.append('userId', filters.userId)
    if (filters.action) params.append('action', filters.action)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.limit) params.append('limit', filters.limit)

    const response = await axios.get(`${API_BASE_URL}/secrets/audit/logs?${params}`)
    return response.data.data
  } catch (error) {
    console.error('[SecretsService] Get audit logs error:', error)
    throw new Error(error.response?.data?.error || 'Failed to get audit logs')
  }
}

/**
 * Detect potential secret leaks in text
 * @param {string} text - Text to scan for leaks
 * @returns {Promise<Object>} Detection results
 */
export async function detectLeaks(text) {
  try {
    const response = await axios.post(`${API_BASE_URL}/secrets/detect-leaks`, { text })
    return response.data.data
  } catch (error) {
    console.error('[SecretsService] Detect leaks error:', error)
    throw new Error(error.response?.data?.error || 'Failed to detect leaks')
  }
}

/**
 * Get available secret types
 * @returns {Promise<Array>} Secret types
 */
export async function getSecretTypes() {
  try {
    const response = await axios.get(`${API_BASE_URL}/secrets/meta/types`)
    return response.data.data
  } catch (error) {
    console.error('[SecretsService] Get secret types error:', error)
    throw new Error(error.response?.data?.error || 'Failed to get secret types')
  }
}

/**
 * Get available rotation policies
 * @returns {Promise<Array>} Rotation policies
 */
export async function getRotationPolicies() {
  try {
    const response = await axios.get(`${API_BASE_URL}/secrets/meta/rotation-policies`)
    return response.data.data
  } catch (error) {
    console.error('[SecretsService] Get rotation policies error:', error)
    throw new Error(error.response?.data?.error || 'Failed to get rotation policies')
  }
}

/**
 * Generate a secure random password
 * @param {number} length - Password length
 * @param {Object} options - Generation options (includeSymbols, includeNumbers, etc.)
 * @returns {string} Generated password
 */
export function generateSecurePassword(length = 32, options = {}) {
  const {
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true
  } = options

  let charset = ''
  if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz'
  if (includeNumbers) charset += '0123456789'
  if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?'

  if (charset.length === 0) {
    throw new Error('At least one character type must be included')
  }

  const array = new Uint8Array(length)
  crypto.getRandomValues(array)

  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length]
  }

  return password
}

/**
 * Generate a secure API key
 * @returns {string} Generated API key
 */
export function generateApiKey() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return `sk_${Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
export function formatDate(dateString) {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

/**
 * Calculate days until rotation
 * @param {string} nextRotation - ISO date string of next rotation
 * @returns {number} Days until rotation (negative if overdue)
 */
export function daysUntilRotation(nextRotation) {
  if (!nextRotation) return null
  const now = new Date()
  const rotationDate = new Date(nextRotation)
  const diffTime = rotationDate - now
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Get severity color for rotation status
 * @param {number} daysUntil - Days until rotation
 * @returns {string} Color name (success, warning, danger)
 */
export function getRotationSeverity(daysUntil) {
  if (daysUntil === null) return 'secondary'
  if (daysUntil < 0) return 'danger'
  if (daysUntil <= 7) return 'danger'
  if (daysUntil <= 14) return 'warning'
  return 'success'
}

export default {
  listSecrets,
  getSecret,
  createSecret,
  updateSecret,
  rotateSecret,
  deleteSecret,
  getSecretsNeedingRotation,
  getStatistics,
  getAuditLogs,
  detectLeaks,
  getSecretTypes,
  getRotationPolicies,
  generateSecurePassword,
  generateApiKey,
  formatDate,
  daysUntilRotation,
  getRotationSeverity
}
