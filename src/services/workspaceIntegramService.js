/**
 * Workspace Integram Service - Frontend
 * Issue #4465: Workspace Management with Integram Integration
 *
 * This service manages workspaces stored in Integram 'my' database.
 * Features:
 * - Auto-creates Workspaces table if it doesn't exist
 * - Uses user token from localStorage (via integramService)
 * - CRUD operations for workspace metadata
 * - {id}_{server} directory naming pattern
 */

import integramService from '@/services/integramApiClient'
import { logger } from '@/utils/logger'

// Workspace table and requisite IDs (will be set after table creation)
let WORKSPACE_TYPE_ID = null
let WORKSPACE_REQUISITES = {
  НАЗВАНИЕ: null,
  USER_ID: null,
  REPOSITORY_URL: null,
  ВЕТКА: null,
  INTEGRAM_SERVER: null,
  WORKSPACE_PATH: null,
  ДАТА_СОЗДАНИЯ: null,
  ПОСЛЕДНЯЯ_АКТИВНОСТЬ: null,
  СТАТУС: null,
  ТИП: null // Issue #4465: local or github
}

// Table creation state
let tableInitialized = false
let tableCreationPromise = null

/**
 * Requisite type IDs for Integram
 */
const REQUISITE_TYPES = {
  SHORT: 3,    // Short text field
  NUMBER: 13,  // Numeric field
  DATETIME: 4  // Date/time field
}

/**
 * Extract server name from URL
 */
function extractServerName(url) {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch (error) {
    console.error('Failed to extract server name:', error)
    return 'unknown'
  }
}

/**
 * Initialize workspace table - creates it if it doesn't exist
 * This function is idempotent and can be called multiple times safely
 */
async function ensureWorkspaceTable() {
  // Return cached promise if table is being initialized
  if (tableCreationPromise) {
    return tableCreationPromise
  }

  // Return immediately if already initialized
  if (tableInitialized && WORKSPACE_TYPE_ID) {
    return true
  }

  // Create new initialization promise
  tableCreationPromise = (async () => {
    try {
      logger.info('Ensuring Workspaces table exists in Integram')

      // Switch to 'my' database
      const originalDb = integramService.getDatabase()
      integramService.setDatabase('my')

      // Check if table already exists by looking for "Workspaces" type
      try {
        const dictionary = await integramService.getDictionary()
        const existingWorkspaceType = dictionary.types?.find(
          t => t.name === 'Workspaces' || t.name === 'Рабочие пространства'
        )

        if (existingWorkspaceType) {
          logger.info(`Found existing Workspaces table: ${existingWorkspaceType.id}`)
          WORKSPACE_TYPE_ID = existingWorkspaceType.id

          // Get requisite IDs from existing table
          const metadata = await integramService.getTypeMetadata(WORKSPACE_TYPE_ID)
          const requisites = metadata.requisites || []

          // Map requisite names to IDs
          const reqMap = {}
          requisites.forEach(req => {
            if (req.alias) {
              reqMap[req.alias] = req.id
            }
          })

          WORKSPACE_REQUISITES.НАЗВАНИЕ = reqMap['Название'] || null
          WORKSPACE_REQUISITES.USER_ID = reqMap['User ID'] || null
          WORKSPACE_REQUISITES.REPOSITORY_URL = reqMap['Repository URL'] || null
          WORKSPACE_REQUISITES.ВЕТКА = reqMap['Ветка'] || null
          WORKSPACE_REQUISITES.INTEGRAM_SERVER = reqMap['Integram Server'] || null
          WORKSPACE_REQUISITES.WORKSPACE_PATH = reqMap['Workspace Path'] || null
          WORKSPACE_REQUISITES.ДАТА_СОЗДАНИЯ = reqMap['Дата создания'] || null
          WORKSPACE_REQUISITES.ПОСЛЕДНЯЯ_АКТИВНОСТЬ = reqMap['Последняя активность'] || null
          WORKSPACE_REQUISITES.СТАТУС = reqMap['Статус'] || null
          WORKSPACE_REQUISITES.ТИП = reqMap['Тип'] || null

          tableInitialized = true
          integramService.setDatabase(originalDb)
          return true
        }
      } catch (error) {
        logger.warn('Could not check for existing Workspaces table:', error.message)
      }

      // Table doesn't exist - create it
      logger.info('Creating Workspaces table in Integram')

      // Step 1: Create the Workspaces type
      const newType = await integramService.createType({
        name: 'Workspaces',
        baseTypeId: 1, // Independent type
        unique: false
      })

      WORKSPACE_TYPE_ID = newType.id
      logger.info(`Created Workspaces type with ID: ${WORKSPACE_TYPE_ID}`)

      // Step 2: Add requisites (columns) one by one
      const requisiteDefinitions = [
        { name: 'Название', type: REQUISITE_TYPES.SHORT },
        { name: 'User ID', type: REQUISITE_TYPES.SHORT },
        { name: 'Repository URL', type: REQUISITE_TYPES.SHORT },
        { name: 'Ветка', type: REQUISITE_TYPES.SHORT },
        { name: 'Integram Server', type: REQUISITE_TYPES.SHORT },
        { name: 'Workspace Path', type: REQUISITE_TYPES.SHORT },
        { name: 'Дата создания', type: REQUISITE_TYPES.DATETIME },
        { name: 'Последняя активность', type: REQUISITE_TYPES.DATETIME },
        { name: 'Статус', type: REQUISITE_TYPES.SHORT },
        { name: 'Тип', type: REQUISITE_TYPES.SHORT } // Issue #4465: local or github
      ]

      const createdRequisites = []

      for (const reqDef of requisiteDefinitions) {
        try {
          const req = await integramService.addRequisite({
            typeId: WORKSPACE_TYPE_ID,
            requisiteTypeId: reqDef.type
          })

          createdRequisites.push({ id: req.id, name: reqDef.name })
          logger.info(`Added requisite: ${reqDef.name} (ID: ${req.id})`)
        } catch (error) {
          logger.error(`Failed to add requisite ${reqDef.name}:`, error.message)
          throw error
        }
      }

      // Step 3: Set requisite aliases (Russian names)
      for (const req of createdRequisites) {
        try {
          await integramService.saveRequisiteAlias({
            requisiteId: req.id,
            alias: req.name
          })
          logger.info(`Set alias for requisite ${req.id}: ${req.name}`)
        } catch (error) {
          logger.error(`Failed to set alias for ${req.name}:`, error.message)
          // Continue - aliases are not critical
        }
      }

      // Step 4: Save requisite IDs for future use
      WORKSPACE_REQUISITES.НАЗВАНИЕ = createdRequisites[0]?.id || null
      WORKSPACE_REQUISITES.USER_ID = createdRequisites[1]?.id || null
      WORKSPACE_REQUISITES.REPOSITORY_URL = createdRequisites[2]?.id || null
      WORKSPACE_REQUISITES.ВЕТКА = createdRequisites[3]?.id || null
      WORKSPACE_REQUISITES.INTEGRAM_SERVER = createdRequisites[4]?.id || null
      WORKSPACE_REQUISITES.WORKSPACE_PATH = createdRequisites[5]?.id || null
      WORKSPACE_REQUISITES.ДАТА_СОЗДАНИЯ = createdRequisites[6]?.id || null
      WORKSPACE_REQUISITES.ПОСЛЕДНЯЯ_АКТИВНОСТЬ = createdRequisites[7]?.id || null
      WORKSPACE_REQUISITES.СТАТУС = createdRequisites[8]?.id || null
      WORKSPACE_REQUISITES.ТИП = createdRequisites[9]?.id || null

      logger.info('Workspaces table created successfully', {
        typeId: WORKSPACE_TYPE_ID,
        requisites: WORKSPACE_REQUISITES
      })

      tableInitialized = true
      integramService.setDatabase(originalDb)
      return true

    } catch (error) {
      logger.error('Failed to ensure Workspaces table:', error)
      throw new Error(`Failed to initialize Workspaces table: ${error.message}`)
    } finally {
      tableCreationPromise = null
    }
  })()

  return tableCreationPromise
}

/**
 * Create a new workspace
 * @param {Object} data - Workspace data
 * @param {string} data.name - Workspace name
 * @param {string} data.userId - User identifier
 * @param {string} [data.repositoryUrl] - Git repository URL
 * @param {string} [data.branch] - Git branch name
 * @param {string} [data.workspacePath] - Physical path on disk
 * @param {string} [data.type] - Workspace type: 'local' or 'github' (Issue #4465)
 * @returns {Promise<Object>} Created workspace
 */
export async function createWorkspace(data) {
  // Ensure table exists
  await ensureWorkspaceTable()

  if (!WORKSPACE_TYPE_ID) {
    throw new Error('Workspaces table not initialized')
  }

  const {
    name,
    userId,
    repositoryUrl = '',
    branch = '',
    workspacePath = '',
    type = 'local' // Issue #4465: Default to local
  } = data

  // Switch to 'my' database
  const originalDb = integramService.getDatabase()
  integramService.setDatabase('my')

  try {
    const serverName = extractServerName(integramService.getServer())
    const now = new Date().toISOString()

    logger.info('Creating workspace:', { name, userId, repositoryUrl })

    // Create workspace object
    const workspace = await integramService.createObject({
      typeId: WORKSPACE_TYPE_ID,
      value: name,
      requisites: {
        [WORKSPACE_REQUISITES.НАЗВАНИЕ]: name,
        [WORKSPACE_REQUISITES.USER_ID]: userId,
        [WORKSPACE_REQUISITES.REPOSITORY_URL]: repositoryUrl,
        [WORKSPACE_REQUISITES.ВЕТКА]: branch,
        [WORKSPACE_REQUISITES.INTEGRAM_SERVER]: serverName,
        [WORKSPACE_REQUISITES.WORKSPACE_PATH]: workspacePath,
        [WORKSPACE_REQUISITES.ДАТА_СОЗДАНИЯ]: now,
        [WORKSPACE_REQUISITES.ПОСЛЕДНЯЯ_АКТИВНОСТЬ]: now,
        [WORKSPACE_REQUISITES.СТАТУС]: 'active',
        [WORKSPACE_REQUISITES.ТИП]: type // Issue #4465: local or github
      }
    })

    logger.info(`Workspace created with ID: ${workspace.id}, type: ${type}`)

    return {
      id: workspace.id,
      name,
      userId,
      repositoryUrl,
      branch,
      serverName,
      workspacePath,
      createdAt: now,
      lastActivity: now,
      status: 'active',
      type // Issue #4465: Include type in return
    }
  } catch (error) {
    logger.error('Failed to create workspace:', error)
    throw error
  } finally {
    integramService.setDatabase(originalDb)
  }
}

/**
 * Get all workspaces for current user
 * @returns {Promise<Array>} Array of workspace objects
 */
export async function getUserWorkspaces() {
  // Ensure table exists
  await ensureWorkspaceTable()

  if (!WORKSPACE_TYPE_ID) {
    logger.warn('Workspaces table not initialized')
    return []
  }

  const originalDb = integramService.getDatabase()
  integramService.setDatabase('my')

  try {
    // Get current user ID
    const session = await integramService.getSession()
    const userId = session.id || session.userId

    if (!userId) {
      logger.warn('No user ID found in session')
      return []
    }

    // Get all workspaces
    const response = await integramService.getObjects(WORKSPACE_TYPE_ID, { LIMIT: 100 })
    const workspaces = response.object || []
    const reqs = response.reqs || {}

    // Filter workspaces for current user with active status
    const userWorkspaces = workspaces
      .filter(ws => {
        const wsReqs = reqs[ws.id] || {}
        const wsUserId = wsReqs[WORKSPACE_REQUISITES.USER_ID]
        const wsStatus = wsReqs[WORKSPACE_REQUISITES.СТАТУС]

        return wsUserId === String(userId) && wsStatus === 'active'
      })
      .map(ws => {
        const wsReqs = reqs[ws.id] || {}

        return {
          id: ws.id,
          name: ws.val,
          userId: wsReqs[WORKSPACE_REQUISITES.USER_ID] || '',
          repositoryUrl: wsReqs[WORKSPACE_REQUISITES.REPOSITORY_URL] || '',
          branch: wsReqs[WORKSPACE_REQUISITES.ВЕТКА] || '',
          serverName: wsReqs[WORKSPACE_REQUISITES.INTEGRAM_SERVER] || '',
          workspacePath: wsReqs[WORKSPACE_REQUISITES.WORKSPACE_PATH] || '',
          createdAt: wsReqs[WORKSPACE_REQUISITES.ДАТА_СОЗДАНИЯ] || '',
          lastActivity: wsReqs[WORKSPACE_REQUISITES.ПОСЛЕДНЯЯ_АКТИВНОСТЬ] || '',
          status: wsReqs[WORKSPACE_REQUISITES.СТАТУС] || 'unknown',
          type: wsReqs[WORKSPACE_REQUISITES.ТИП] || 'local' // Issue #4465
        }
      })

    logger.info(`Found ${userWorkspaces.length} workspaces for user ${userId}`)
    return userWorkspaces

  } catch (error) {
    logger.error('Failed to get user workspaces:', error)
    return []
  } finally {
    integramService.setDatabase(originalDb)
  }
}

/**
 * Get workspace by ID
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<Object|null>} Workspace object or null
 */
export async function getWorkspace(workspaceId) {
  await ensureWorkspaceTable()

  if (!WORKSPACE_TYPE_ID) {
    return null
  }

  const originalDb = integramService.getDatabase()
  integramService.setDatabase('my')

  try {
    const workspace = await integramService.getEditObject(workspaceId)
    const reqs = workspace.reqs || {}

    return {
      id: workspace.obj.id,
      name: workspace.obj.val,
      userId: reqs[WORKSPACE_REQUISITES.USER_ID]?.value || '',
      repositoryUrl: reqs[WORKSPACE_REQUISITES.REPOSITORY_URL]?.value || '',
      branch: reqs[WORKSPACE_REQUISITES.ВЕТКА]?.value || '',
      serverName: reqs[WORKSPACE_REQUISITES.INTEGRAM_SERVER]?.value || '',
      workspacePath: reqs[WORKSPACE_REQUISITES.WORKSPACE_PATH]?.value || '',
      createdAt: reqs[WORKSPACE_REQUISITES.ДАТА_СОЗДАНИЯ]?.value || '',
      lastActivity: reqs[WORKSPACE_REQUISITES.ПОСЛЕДНЯЯ_АКТИВНОСТЬ]?.value || '',
      status: reqs[WORKSPACE_REQUISITES.СТАТУС]?.value || 'unknown',
      type: reqs[WORKSPACE_REQUISITES.ТИП]?.value || 'local' // Issue #4465
    }
  } catch (error) {
    logger.error(`Failed to get workspace ${workspaceId}:`, error)
    return null
  } finally {
    integramService.setDatabase(originalDb)
  }
}

/**
 * Update workspace path
 * @param {string} workspaceId - Workspace ID
 * @param {string} workspacePath - New workspace path
 */
export async function updateWorkspacePath(workspaceId, workspacePath) {
  await ensureWorkspaceTable()

  if (!WORKSPACE_TYPE_ID) {
    return
  }

  const originalDb = integramService.getDatabase()
  integramService.setDatabase('my')

  try {
    await integramService.setRequisites(workspaceId, {
      [WORKSPACE_REQUISITES.WORKSPACE_PATH]: workspacePath,
      [WORKSPACE_REQUISITES.ПОСЛЕДНЯЯ_АКТИВНОСТЬ]: new Date().toISOString()
    })

    logger.info(`Updated workspace ${workspaceId} path to: ${workspacePath}`)
  } catch (error) {
    logger.error(`Failed to update workspace path:`, error)
  } finally {
    integramService.setDatabase(originalDb)
  }
}

/**
 * Update workspace last activity timestamp
 * @param {string} workspaceId - Workspace ID
 */
export async function updateWorkspaceActivity(workspaceId) {
  await ensureWorkspaceTable()

  if (!WORKSPACE_TYPE_ID) {
    return
  }

  const originalDb = integramService.getDatabase()
  integramService.setDatabase('my')

  try {
    await integramService.setRequisites(workspaceId, {
      [WORKSPACE_REQUISITES.ПОСЛЕДНЯЯ_АКТИВНОСТЬ]: new Date().toISOString()
    })
  } catch (error) {
    logger.error(`Failed to update workspace activity:`, error)
  } finally {
    integramService.setDatabase(originalDb)
  }
}

/**
 * Delete workspace (soft delete - mark as deleted)
 * @param {string} workspaceId - Workspace ID
 */
export async function deleteWorkspace(workspaceId) {
  await ensureWorkspaceTable()

  if (!WORKSPACE_TYPE_ID) {
    throw new Error('Workspaces table not initialized')
  }

  const originalDb = integramService.getDatabase()
  integramService.setDatabase('my')

  try {
    await integramService.setRequisites(workspaceId, {
      [WORKSPACE_REQUISITES.СТАТУС]: 'deleted',
      [WORKSPACE_REQUISITES.ПОСЛЕДНЯЯ_АКТИВНОСТЬ]: new Date().toISOString()
    })

    logger.info(`Workspace ${workspaceId} marked as deleted`)
  } catch (error) {
    logger.error(`Failed to delete workspace:`, error)
    throw error
  } finally {
    integramService.setDatabase(originalDb)
  }
}

/**
 * Generate workspace directory name using {id}_{server} pattern
 * @param {string} workspaceId - Workspace ID from Integram
 * @param {string} serverName - Server hostname (e.g., 'dronedoc.ru')
 * @returns {string} Directory name (e.g., '197500_dronedoc.ru')
 */
export function generateWorkspaceDirectoryName(workspaceId, serverName) {
  return `${workspaceId}_${serverName}`
}

// Default export as object for easier importing
export default {
  createWorkspace,
  getUserWorkspaces,
  getWorkspace,
  updateWorkspacePath,
  updateWorkspaceActivity,
  deleteWorkspace,
  generateWorkspaceDirectoryName,
  ensureWorkspaceTable
}
