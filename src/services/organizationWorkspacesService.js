/**
 * Organization Workspaces Service
 *
 * Frontend API client for managing organization-specific workspaces.
 * Provides caching and helper functions for workspace management.
 * Integram authentication required.
 *
 * Date: 2026-01-06
 */

import axios from 'axios'

const API_BASE = '/api/organizations'

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const cache = new Map()

/**
 * Get Integram auth headers from cookies/localStorage
 */
function getIntegramHeaders() {
  const token = localStorage.getItem('token') || getCookie('token')
  const xsrf = localStorage.getItem('_xsrf') || getCookie('_xsrf')

  if (!token || !xsrf) {
    console.warn('[OrganizationWorkspaces] Integram tokens not found', { token: !!token, xsrf: !!xsrf })
    return {}
  }

  return {
    'X-Integram-Token': token,
    'X-Integram-XSRF': xsrf
  }
}

/**
 * Get cookie value by name
 */
function getCookie(name) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop().split(';').shift()
  return null
}

/**
 * Workspace type definitions
 */
export const WORKSPACE_TYPES = {
  DEFAULT: 'default',
  DEVELOPMENT: 'development',
  TESTING: 'testing',
  PRODUCTION: 'production',
  STAGING: 'staging'
}

/**
 * Workspace type labels (Russian)
 */
export const WORKSPACE_TYPE_LABELS = {
  default: 'Основное',
  development: 'Разработка',
  testing: 'Тестирование',
  production: 'Продакшн',
  staging: 'Staging'
}

/**
 * Default workspace icons
 */
export const WORKSPACE_TYPE_ICONS = {
  default: 'pi-folder',
  development: 'pi-code',
  testing: 'pi-check-circle',
  production: 'pi-server',
  staging: 'pi-cloud'
}

/**
 * Cache helper functions
 */
function getCacheKey(orgId, suffix = '') {
  return `org-${orgId}-workspaces${suffix ? '-' + suffix : ''}`
}

function getFromCache(key) {
  const cached = cache.get(key)
  if (!cached) return null

  const isExpired = Date.now() - cached.timestamp > CACHE_TTL
  if (isExpired) {
    cache.delete(key)
    return null
  }

  return cached.data
}

function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  })
}

function clearCache(orgId) {
  // Clear all cache entries for this organization
  const prefix = `org-${orgId}-`
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
}

/**
 * Get all workspaces for an organization
 */
export async function getWorkspacesByOrganization(orgId, bypassCache = false) {
  if (!orgId) {
    throw new Error('Organization ID is required')
  }

  const cacheKey = getCacheKey(orgId)

  if (!bypassCache) {
    const cached = getFromCache(cacheKey)
    if (cached) {
      console.log('[OrganizationWorkspaces] Cache hit for org:', orgId)
      return cached
    }
  }

  try {
    const response = await axios.get(`${API_BASE}/${orgId}/workspaces`, {
      headers: getIntegramHeaders(),
      withCredentials: true
    })
    const workspaces = response.data.data || []

    setCache(cacheKey, workspaces)
    console.log('[OrganizationWorkspaces] Loaded workspaces for org:', orgId, '- Count:', workspaces.length)

    return workspaces
  } catch (error) {
    console.error('[OrganizationWorkspaces] Failed to load workspaces:', error)
    throw error
  }
}

/**
 * Get a specific workspace by ID
 */
export async function getWorkspaceById(orgId, workspaceId) {
  if (!orgId || !workspaceId) {
    throw new Error('Organization ID and Workspace ID are required')
  }

  try {
    const response = await axios.get(`${API_BASE}/${orgId}/workspaces/${workspaceId}`, {
      headers: getIntegramHeaders(),
      withCredentials: true
    })
    return response.data.data
  } catch (error) {
    console.error('[OrganizationWorkspaces] Failed to load workspace:', error)
    throw error
  }
}

/**
 * Create a new workspace
 */
export async function createWorkspace(orgId, workspaceData) {
  if (!orgId) {
    throw new Error('Organization ID is required')
  }

  if (!workspaceData.name) {
    throw new Error('Workspace name is required')
  }

  try {
    const response = await axios.post(`${API_BASE}/${orgId}/workspaces`, {
      name: workspaceData.name,
      description: workspaceData.description || '',
      path: workspaceData.path || '',
      type: workspaceData.type || WORKSPACE_TYPES.DEFAULT,
      icon: workspaceData.icon || WORKSPACE_TYPE_ICONS[workspaceData.type || WORKSPACE_TYPES.DEFAULT],
      active: workspaceData.active !== false
    }, {
      headers: getIntegramHeaders(),
      withCredentials: true
    })

    clearCache(orgId)
    console.log('[OrganizationWorkspaces] Created workspace:', response.data.data.name)

    return response.data.data
  } catch (error) {
    console.error('[OrganizationWorkspaces] Failed to create workspace:', error)
    throw error
  }
}

/**
 * Update a workspace
 */
export async function updateWorkspace(orgId, workspaceId, workspaceData) {
  if (!orgId || !workspaceId) {
    throw new Error('Organization ID and Workspace ID are required')
  }

  try {
    const response = await axios.put(
      `${API_BASE}/${orgId}/workspaces/${workspaceId}`,
      workspaceData,
      {
        headers: getIntegramHeaders(),
        withCredentials: true
      }
    )

    clearCache(orgId)
    console.log('[OrganizationWorkspaces] Updated workspace:', workspaceId)

    return response.data.data
  } catch (error) {
    console.error('[OrganizationWorkspaces] Failed to update workspace:', error)
    throw error
  }
}

/**
 * Delete a workspace
 */
export async function deleteWorkspace(orgId, workspaceId) {
  if (!orgId || !workspaceId) {
    throw new Error('Organization ID and Workspace ID are required')
  }

  try {
    await axios.delete(`${API_BASE}/${orgId}/workspaces/${workspaceId}`, {
      headers: getIntegramHeaders(),
      withCredentials: true
    })

    clearCache(orgId)
    console.log('[OrganizationWorkspaces] Deleted workspace:', workspaceId)
  } catch (error) {
    console.error('[OrganizationWorkspaces] Failed to delete workspace:', error)
    throw error
  }
}

/**
 * Helper: Get workspace type label
 */
export function getWorkspaceTypeLabel(type) {
  return WORKSPACE_TYPE_LABELS[type] || type
}

/**
 * Helper: Get workspace type icon
 */
export function getWorkspaceTypeIcon(type) {
  return WORKSPACE_TYPE_ICONS[type] || 'pi-folder'
}

/**
 * Helper: Get active workspaces only
 */
export function getActiveWorkspaces(workspaces) {
  return workspaces.filter(ws => ws.active)
}

/**
 * Helper: Get workspaces by type
 */
export function getWorkspacesByType(workspaces, type) {
  return workspaces.filter(ws => ws.type === type)
}

/**
 * Helper: Get default workspace
 */
export function getDefaultWorkspace(workspaces) {
  return workspaces.find(ws => ws.type === WORKSPACE_TYPES.DEFAULT && ws.active)
    || workspaces.find(ws => ws.active)
    || workspaces[0]
}

/**
 * Helper: Validate workspace data
 */
export function validateWorkspaceData(data) {
  const errors = []

  if (!data.name || data.name.trim() === '') {
    errors.push('Название workspace обязательно')
  }

  if (data.name && data.name.length > 100) {
    errors.push('Название workspace не должно превышать 100 символов')
  }

  if (data.path && !/^\/[\w-\/]*$/.test(data.path)) {
    errors.push('Путь должен начинаться с / и содержать только буквы, цифры, дефисы и слеши')
  }

  if (data.type && !Object.values(WORKSPACE_TYPES).includes(data.type)) {
    errors.push('Некорректный тип workspace')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export default {
  getWorkspacesByOrganization,
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceTypeLabel,
  getWorkspaceTypeIcon,
  getActiveWorkspaces,
  getWorkspacesByType,
  getDefaultWorkspace,
  validateWorkspaceData,
  WORKSPACE_TYPES,
  WORKSPACE_TYPE_LABELS,
  WORKSPACE_TYPE_ICONS
}
