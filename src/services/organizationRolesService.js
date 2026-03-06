/**
 * Organization Roles Frontend Service
 *
 * Client-side service for managing organization-specific roles.
 * Communicates with backend API at /api/organizations/:orgId/roles
 *
 * Features:
 * - CRUD operations for roles
 * - LocalStorage caching (5-min TTL)
 * - Permission validation
 * - Integram authentication
 *
 * Date: 2026-01-06
 */

import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const CACHE_KEY_PREFIX = 'org_roles_'

/**
 * Get Integram auth headers from cookies/localStorage
 */
function getIntegramHeaders() {
  // Get Integram tokens from localStorage (set by auth flow)
  const token = localStorage.getItem('token') || getCookie('token')
  const xsrf = localStorage.getItem('_xsrf') || getCookie('_xsrf')

  if (!token || !xsrf) {
    console.warn('[OrganizationRolesService] Integram tokens not found', { token: !!token, xsrf: !!xsrf })
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
 * Cache structure
 */
const cache = new Map()

/**
 * Get cache key for organization
 */
function getCacheKey(orgId) {
  return `${CACHE_KEY_PREFIX}${orgId}`
}

/**
 * Check if cache is valid
 */
function isCacheValid(cacheEntry) {
  if (!cacheEntry) return false
  return Date.now() - cacheEntry.timestamp < CACHE_TTL
}

/**
 * Get roles from cache
 */
function getFromCache(orgId) {
  const key = getCacheKey(orgId)
  const entry = cache.get(key)

  if (isCacheValid(entry)) {
    console.log('[OrganizationRolesService] Cache HIT for org:', orgId)
    return entry.data
  }

  console.log('[OrganizationRolesService] Cache MISS for org:', orgId)
  return null
}

/**
 * Save roles to cache
 */
function saveToCache(orgId, data) {
  const key = getCacheKey(orgId)
  cache.set(key, {
    data,
    timestamp: Date.now()
  })
  console.log('[OrganizationRolesService] Cached roles for org:', orgId)
}

/**
 * Clear cache for organization
 */
function clearCache(orgId) {
  if (orgId) {
    const key = getCacheKey(orgId)
    cache.delete(key)
    console.log('[OrganizationRolesService] Cache cleared for org:', orgId)
  } else {
    cache.clear()
    console.log('[OrganizationRolesService] Cache cleared (all)')
  }
}

/**
 * Get all roles for an organization
 * @param {number|string} orgId - Organization ID
 * @param {boolean} bypassCache - Skip cache and fetch fresh data
 * @returns {Promise<Array>} Array of roles
 */
export async function getRolesByOrganization(orgId, bypassCache = false) {
  if (!orgId) {
    throw new Error('Organization ID is required')
  }

  // Check cache first
  if (!bypassCache) {
    const cached = getFromCache(orgId)
    if (cached) return cached
  }

  try {
    const response = await axios.get(`${API_BASE}/organizations/${orgId}/roles`, {
      headers: getIntegramHeaders(),
      withCredentials: true
    })

    if (response.data.success) {
      const roles = response.data.data || []
      saveToCache(orgId, roles)
      return roles
    } else {
      throw new Error(response.data.error || 'Failed to fetch roles')
    }
  } catch (error) {
    console.error('[OrganizationRolesService] Get roles error:', error)
    throw error
  }
}

/**
 * Create default roles for an organization
 * @param {number|string} orgId - Organization ID
 * @returns {Promise<Array>} Created roles
 */
export async function seedDefaultRoles(orgId) {
  if (!orgId) {
    throw new Error('Organization ID is required')
  }

  try {
    const response = await axios.post(`${API_BASE}/organizations/${orgId}/roles/seed`, {}, {
      headers: getIntegramHeaders(),
      withCredentials: true
    })

    if (response.data.success) {
      const roles = response.data.data || []
      saveToCache(orgId, roles)
      return roles
    } else {
      throw new Error(response.data.error || 'Failed to seed roles')
    }
  } catch (error) {
    console.error('[OrganizationRolesService] Seed roles error:', error)
    throw error
  }
}

/**
 * Create a new role
 * @param {number|string} orgId - Organization ID
 * @param {Object} roleData - Role data
 * @returns {Promise<Object>} Created role
 */
export async function createRole(orgId, roleData) {
  if (!orgId) {
    throw new Error('Organization ID is required')
  }

  if (!roleData.name) {
    throw new Error('Role name is required')
  }

  try {
    const response = await axios.post(`${API_BASE}/organizations/${orgId}/roles`, roleData, {
      headers: getIntegramHeaders(),
      withCredentials: true
    })

    if (response.data.success) {
      clearCache(orgId) // Invalidate cache
      return response.data.data
    } else {
      throw new Error(response.data.error || 'Failed to create role')
    }
  } catch (error) {
    console.error('[OrganizationRolesService] Create role error:', error)
    throw error
  }
}

/**
 * Update a role
 * @param {number|string} orgId - Organization ID
 * @param {number|string} roleId - Role ID
 * @param {Object} roleData - Updated role data
 * @returns {Promise<Object>} Updated role
 */
export async function updateRole(orgId, roleId, roleData) {
  if (!orgId || !roleId) {
    throw new Error('Organization ID and Role ID are required')
  }

  try {
    const response = await axios.put(`${API_BASE}/organizations/${orgId}/roles/${roleId}`, roleData, {
      headers: getIntegramHeaders(),
      withCredentials: true
    })

    if (response.data.success) {
      clearCache(orgId) // Invalidate cache
      return response.data.data
    } else {
      throw new Error(response.data.error || 'Failed to update role')
    }
  } catch (error) {
    console.error('[OrganizationRolesService] Update role error:', error)
    throw error
  }
}

/**
 * Delete a role
 * @param {number|string} orgId - Organization ID
 * @param {number|string} roleId - Role ID
 * @returns {Promise<void>}
 */
export async function deleteRole(orgId, roleId) {
  if (!orgId || !roleId) {
    throw new Error('Organization ID and Role ID are required')
  }

  try {
    const response = await axios.delete(`${API_BASE}/organizations/${orgId}/roles/${roleId}`, {
      headers: getIntegramHeaders(),
      withCredentials: true
    })

    if (response.data.success) {
      clearCache(orgId) // Invalidate cache
    } else {
      throw new Error(response.data.error || 'Failed to delete role')
    }
  } catch (error) {
    console.error('[OrganizationRolesService] Delete role error:', error)

    // Check if role is in use
    if (error.response?.data?.error === 'role_in_use') {
      throw new Error('Нельзя удалить роль, которая используется в назначениях или задачах')
    }

    throw error
  }
}

/**
 * Get role usage statistics
 * @param {number|string} orgId - Organization ID
 * @param {number|string} roleId - Role ID
 * @returns {Promise<Object>} Usage statistics
 */
export async function getRoleUsage(orgId, roleId) {
  if (!orgId || !roleId) {
    throw new Error('Organization ID and Role ID are required')
  }

  try {
    const response = await axios.get(`${API_BASE}/organizations/${orgId}/roles/${roleId}/usage`, {
      headers: getIntegramHeaders(),
      withCredentials: true
    })

    if (response.data.success) {
      return response.data.data
    } else {
      throw new Error(response.data.error || 'Failed to get role usage')
    }
  } catch (error) {
    console.error('[OrganizationRolesService] Get role usage error:', error)
    throw error
  }
}

/**
 * Permission helpers
 */

/**
 * Check if role has specific permission
 * @param {Object} role - Role object
 * @param {string} permission - Permission name
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  if (!role || !role.permissions) return false
  return Boolean(role.permissions[permission])
}

/**
 * Get all permissions for a role
 * @param {Object} role - Role object
 * @returns {Array<string>} Array of permission names
 */
export function getPermissions(role) {
  if (!role || !role.permissions) return []
  return Object.keys(role.permissions).filter(key => role.permissions[key])
}

/**
 * Default permissions structure
 */
export const DEFAULT_PERMISSIONS = {
  viewTasks: false,
  createTasks: false,
  editTasks: false,
  deleteTasks: false,
  viewBoards: false,
  createBoards: false,
  editBoards: false,
  deleteBoards: false,
  manageUsers: false,
  manageRoles: false,
  manageSettings: false,
  viewReports: false
}

/**
 * Permission labels (for UI)
 */
export const PERMISSION_LABELS = {
  viewTasks: 'Просмотр задач',
  createTasks: 'Создание задач',
  editTasks: 'Редактирование задач',
  deleteTasks: 'Удаление задач',
  viewBoards: 'Просмотр досок',
  createBoards: 'Создание досок',
  editBoards: 'Редактирование досок',
  deleteBoards: 'Удаление досок',
  manageUsers: 'Управление пользователями',
  manageRoles: 'Управление ролями',
  manageSettings: 'Управление настройками',
  viewReports: 'Просмотр отчетов'
}

/**
 * Permission groups (for organized UI)
 */
export const PERMISSION_GROUPS = {
  tasks: ['viewTasks', 'createTasks', 'editTasks', 'deleteTasks'],
  boards: ['viewBoards', 'createBoards', 'editBoards', 'deleteBoards'],
  management: ['manageUsers', 'manageRoles', 'manageSettings'],
  reports: ['viewReports']
}

export default {
  getRolesByOrganization,
  seedDefaultRoles,
  createRole,
  updateRole,
  deleteRole,
  getRoleUsage,
  hasPermission,
  getPermissions,
  clearCache,
  DEFAULT_PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSION_GROUPS
}
