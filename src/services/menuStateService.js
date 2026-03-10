/**
 * Service for managing sidebar menu state (collapsed/expanded groups)
 * and database integration for menu CRUD operations
 *
 * Database Structure (explored via MCP - Issue #3803):
 * - menu_dash table (Type ID: 195629):
 *   - Requisite 195630: path - Route path
 *   - Requisite 195631: Иконка - Icon class (PrimeIcons)
 *   - Requisite 197038: Группа меню - Reference to group (type 197036)
 *
 * - Группа меню table (Type ID: 197036):
 *   - Requisite 197133: Иконка - Group icon
 *   - Objects: Администратор(197039), Агенты(197040), Страницы(197041), etc.
 */

import integramApiClient from './integramApiClient'
import { logger } from '@/utils/logger'

// Database constants discovered via MCP exploration
const MENU_TYPE_ID = 195629        // menu_dash table
const GROUP_TYPE_ID = 197036       // Группа меню table
const REQ_PATH = '195630'          // path requisite ID
const REQ_ICON = '195631'          // Иконка requisite ID
const REQ_GROUP = '197038'         // Группа меню requisite ID (reference)

// Group IDs for reference
const GROUP_IDS = {
  'Администратор': '197039',
  'Агенты': '197040',
  'Страницы': '197041',
  'Организация': '197147',
  'Документы': '197149'
}

const COLLAPSED_GROUPS_KEY = 'sidebar_collapsed_groups'

/**
 * Get collapsed groups from localStorage
 * @returns {Set<string>} Set of collapsed group labels
 */
export function getCollapsedGroups() {
  try {
    const stored = localStorage.getItem(COLLAPSED_GROUPS_KEY)
    if (stored) {
      return new Set(JSON.parse(stored))
    }
  } catch (error) {
    logger.error('Error loading collapsed groups:', error)
  }
  return new Set()
}

/**
 * Save collapsed groups to localStorage
 * @param {Set<string>} collapsedGroups Set of collapsed group labels
 */
export function saveCollapsedGroups(collapsedGroups) {
  try {
    localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(Array.from(collapsedGroups)))
  } catch (error) {
    logger.error('Error saving collapsed groups:', error)
  }
}

/**
 * Toggle group collapsed state
 * @param {string} groupLabel Group label to toggle
 * @returns {boolean} New collapsed state (true = collapsed, false = expanded)
 */
export function toggleGroupCollapsed(groupLabel) {
  const collapsedGroups = getCollapsedGroups()

  if (collapsedGroups.has(groupLabel)) {
    collapsedGroups.delete(groupLabel)
    saveCollapsedGroups(collapsedGroups)
    return false
  } else {
    collapsedGroups.add(groupLabel)
    saveCollapsedGroups(collapsedGroups)
    return true
  }
}

/**
 * Check if group is collapsed
 * @param {string} groupLabel Group label to check
 * @returns {boolean} True if collapsed
 */
export function isGroupCollapsed(groupLabel) {
  const collapsedGroups = getCollapsedGroups()
  return collapsedGroups.has(groupLabel)
}

/**
 * Database integration functions for menu CRUD operations
 * These functions interact with the app_menu report in the 'my' database
 */

/**
 * Get authentication context
 * @returns {Promise<{serverUrl: string, database: string, token: string, xsrf: string}>}
 */
async function getAuthContext() {
  const rawApiBase = localStorage.getItem('apiBase') || 'api.ai2o.ru'  // api.ai2o.ru (punycode)
  const apiBase = rawApiBase.replace(/^https?:\/\//, '')  // strip protocol if accidentally included
  const serverUrl = `https://${apiBase}`

  // Get token from integram_session or fallback
  const integramSessionStr = localStorage.getItem('integram_session')
  let token = null
  let xsrf = null

  if (integramSessionStr) {
    try {
      const session = JSON.parse(integramSessionStr)
      token = session.token
      xsrf = session.xsrfToken
    } catch (e) {
      logger.warn('Failed to parse integram_session:', e)
    }
  }

  if (!token) {
    token = localStorage.getItem('token')
    xsrf = localStorage.getItem('_xsrf')
  }

  if (!token) {
    throw new Error('No authentication token available')
  }

  return {
    serverUrl,
    database: 'my',
    token,
    xsrf,
    authDatabase: 'my'  // Issue #3811: Explicitly specify authDatabase for header selection
  }
}

/**
 * Load menu items from database (app_menu report)
 * @returns {Promise<Array>} Array of menu sections
 */
export async function loadMenuFromDatabase() {
  try {
    const { serverUrl, database, token, xsrf, authDatabase } = await getAuthContext()

    integramApiClient.setServer(serverUrl)
    integramApiClient.setCredentials(database, token, xsrf, authDatabase)

    const response = await integramApiClient.get('report/app_menu', { JSON_KV: true })

    if (response && Array.isArray(response) && response.length > 0) {
      // Group items by "Группа меню" field
      const groupsMap = new Map()
      const groupOrder = []

      for (const row of response) {
        const название = row['Название'] || row['название'] || ''
        const маршрут = row['path'] || row['Path'] || row['Маршрут'] || row['маршрут'] || '/'
        const иконка = row['Иконка'] || row['иконка'] || row['icon'] || row['Icon'] || 'pi pi-fw pi-file'
        const группа = row['Группа меню'] || row['группа меню'] || row['Группа'] || row['группа'] || 'Прочее'

        // Clean HTML tags
        const cleanНазвание = String(название).replace(/<[^>]*>/g, '').trim()
        const cleanМаршрут = String(маршрут).replace(/<[^>]*>/g, '').trim()
        const cleanИконка = String(иконка).replace(/<[^>]*>/g, '').trim()
        const cleanГруппа = String(группа).replace(/<[^>]*>/g, '').trim()

        if (cleanНазвание && cleanНазвание !== 'null' && cleanНазвание !== '') {
          const menuItem = {
            label: cleanНазвание,
            icon: cleanИконка,
            to: cleanМаршрут.startsWith('/') ? cleanМаршрут : `/${cleanМаршрут}`
          }

          if (!groupsMap.has(cleanГруппа)) {
            groupsMap.set(cleanГруппа, [])
            groupOrder.push(cleanГруппа)
          }
          groupsMap.get(cleanГруппа).push(menuItem)
        }
      }

      // Transform groups into menu sections
      const menuSections = []
      for (const groupName of groupOrder) {
        const items = groupsMap.get(groupName)
        const groupIcon = items.length > 0 ? items[0].icon : 'pi pi-fw pi-folder'

        menuSections.push({
          label: groupName,
          icon: groupIcon,
          items: items,
          fromAppMenu: true
        })
      }

      logger.debug('Loaded menu from database:', {
        groupCount: menuSections.length,
        totalItems: response.length
      })

      return menuSections
    }

    return []
  } catch (error) {
    logger.error('Error loading menu from database:', error)
    throw error
  }
}

/**
 * Get or create group by name
 * @param {string} groupName Group name
 * @returns {Promise<string>} Group object ID
 */
async function getOrCreateGroupId(groupName) {
  // Check known groups first
  if (GROUP_IDS[groupName]) {
    return GROUP_IDS[groupName]
  }

  // Try to find existing group by name
  try {
    const response = await integramApiClient.get(`_m_list/${GROUP_TYPE_ID}`, { JSON_KV: true })

    if (response && response.object) {
      const existingGroup = response.object.find(obj =>
        obj.val === groupName || obj.value === groupName
      )
      if (existingGroup) {
        GROUP_IDS[groupName] = existingGroup.id
        return existingGroup.id
      }
    }

    // Create new group if not found
    logger.info(`Creating new menu group: ${groupName}`)
    const createResult = await integramApiClient.post('_m_new', {
      typ: GROUP_TYPE_ID,
      val: groupName,
      up: 1  // Independent object
    })

    if (createResult && createResult.id) {
      GROUP_IDS[groupName] = createResult.id
      return createResult.id
    }

    throw new Error(`Failed to create group: ${groupName}`)
  } catch (error) {
    logger.error('Error getting/creating group:', error)
    throw error
  }
}

/**
 * Create new menu item in database
 * Uses menu_dash table (type 195629) with requisites:
 * - path (195630), Иконка (195631), Группа меню (197038)
 *
 * @param {Object} menuItem Menu item to create
 * @param {string} menuItem.label Item label/name
 * @param {string} menuItem.path Route path
 * @param {string} menuItem.icon Icon class (PrimeIcons, e.g., "pi pi-fw pi-home")
 * @param {string} menuItem.group Group/category name
 * @returns {Promise<Object>} Created menu item with id
 */
export async function createMenuItem(menuItem) {
  try {
    const { serverUrl, database, token, xsrf, authDatabase } = await getAuthContext()

    integramApiClient.setServer(serverUrl)
    integramApiClient.setCredentials(database, token, xsrf, authDatabase)

    const { label, path, icon, group } = menuItem

    // Get or create the group
    const groupId = await getOrCreateGroupId(group || 'Страницы')

    logger.info('Creating menu item in database:', { label, path, icon, group, groupId })

    // Create the menu item object
    // Using _m_new endpoint with requisites
    const createResult = await integramApiClient.post('_m_new', {
      typ: MENU_TYPE_ID,
      val: label,
      up: 1  // Independent object
    })

    if (!createResult || !createResult.id) {
      throw new Error('Failed to create menu item object')
    }

    const newItemId = createResult.id
    logger.info(`Menu item object created with ID: ${newItemId}`)

    // Set requisites for the new object
    const requisites = {
      [REQ_PATH]: path || '/',
      [REQ_ICON]: icon || 'pi pi-fw pi-file',
      [REQ_GROUP]: groupId  // Reference to group object
    }

    // Update requisites using _m_save endpoint
    const saveResult = await integramApiClient.post(`_m_save/${newItemId}`, {
      typ: MENU_TYPE_ID,
      val: label,
      ...requisites
    })

    logger.info('Menu item created successfully:', {
      id: newItemId,
      label,
      path,
      icon,
      group,
      groupId
    })

    return {
      id: newItemId,
      label,
      path,
      icon,
      group,
      groupId
    }
  } catch (error) {
    logger.error('Error creating menu item:', error)
    throw error
  }
}

/**
 * Update existing menu item in database
 * Uses _m_save endpoint to update object value and requisites
 *
 * @param {string|number} itemId Item ID
 * @param {Object} updates Fields to update
 * @param {string} [updates.label] New label/name
 * @param {string} [updates.path] New route path
 * @param {string} [updates.icon] New icon class
 * @param {string} [updates.group] New group name
 * @returns {Promise<Object>} Updated menu item
 */
export async function updateMenuItem(itemId, updates) {
  try {
    const { serverUrl, database, token, xsrf, authDatabase } = await getAuthContext()

    integramApiClient.setServer(serverUrl)
    integramApiClient.setCredentials(database, token, xsrf, authDatabase)

    logger.info('Updating menu item in database:', { itemId, updates })

    // Build update payload
    const payload = {
      typ: MENU_TYPE_ID
    }

    // Add label/value if provided
    if (updates.label) {
      payload.val = updates.label
    }

    // Add requisites if provided
    if (updates.path) {
      payload[REQ_PATH] = updates.path
    }
    if (updates.icon) {
      payload[REQ_ICON] = updates.icon
    }
    if (updates.group) {
      const groupId = await getOrCreateGroupId(updates.group)
      payload[REQ_GROUP] = groupId
    }

    // Update using _m_save endpoint
    const result = await integramApiClient.post(`_m_save/${itemId}`, payload)

    logger.info('Menu item updated successfully:', { itemId, updates })

    return {
      id: itemId,
      ...updates,
      success: true
    }
  } catch (error) {
    logger.error('Error updating menu item:', error)
    throw error
  }
}

/**
 * Delete menu item from database
 * Uses _m_del endpoint to remove the object
 *
 * @param {string|number} itemId Item ID to delete
 * @returns {Promise<{success: boolean, id: string|number}>}
 */
export async function deleteMenuItem(itemId) {
  try {
    const { serverUrl, database, token, xsrf, authDatabase } = await getAuthContext()

    integramApiClient.setServer(serverUrl)
    integramApiClient.setCredentials(database, token, xsrf, authDatabase)

    logger.info('Deleting menu item from database:', itemId)

    // Delete using _m_del endpoint
    const result = await integramApiClient.post(`_m_del/${itemId}`, {})

    logger.info('Menu item deleted successfully:', itemId)

    return {
      success: true,
      id: itemId
    }
  } catch (error) {
    logger.error('Error deleting menu item:', error)
    throw error
  }
}

/**
 * Get all menu groups from database
 * @returns {Promise<Array<{id: string, name: string}>>} List of menu groups
 */
export async function getMenuGroups() {
  try {
    const { serverUrl, database, token, xsrf, authDatabase } = await getAuthContext()

    integramApiClient.setServer(serverUrl)
    integramApiClient.setCredentials(database, token, xsrf, authDatabase)

    const response = await integramApiClient.get(`_m_list/${GROUP_TYPE_ID}`, { JSON_KV: true })

    if (response && response.object) {
      return response.object.map(obj => ({
        id: obj.id,
        name: obj.val || obj.value
      }))
    }

    return []
  } catch (error) {
    logger.error('Error getting menu groups:', error)
    throw error
  }
}

/**
 * Get all menu items from database (raw data)
 * @returns {Promise<Array>} List of menu items with requisite values
 */
export async function getMenuItems() {
  try {
    const { serverUrl, database, token, xsrf, authDatabase } = await getAuthContext()

    integramApiClient.setServer(serverUrl)
    integramApiClient.setCredentials(database, token, xsrf, authDatabase)

    const response = await integramApiClient.get(`_m_list/${MENU_TYPE_ID}`, { JSON_KV: true })

    if (response && response.object) {
      return response.object.map(obj => {
        const reqs = response.reqs?.[obj.id] || {}
        return {
          id: obj.id,
          label: obj.val || obj.value,
          path: reqs[REQ_PATH] || '/',
          icon: reqs[REQ_ICON] || 'pi pi-fw pi-file',
          group: reqs[REQ_GROUP] || '',
          groupRef: reqs[`ref_${REQ_GROUP}`] || ''
        }
      })
    }

    return []
  } catch (error) {
    logger.error('Error getting menu items:', error)
    throw error
  }
}

export default {
  getCollapsedGroups,
  saveCollapsedGroups,
  toggleGroupCollapsed,
  isGroupCollapsed,
  loadMenuFromDatabase,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMenuGroups,
  getMenuItems
}
