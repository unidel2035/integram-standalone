/**
 * Bitwarden Service
 *
 * Integrates Bitwarden Secrets Manager for secure password storage and synchronization
 * across multiple Integram databases.
 *
 * Features:
 * - Store passwords securely in Bitwarden vault
 * - Retrieve passwords for database synchronization
 * - Manage password lifecycle (create, update, delete)
 * - Organize passwords by database/user context
 * - Audit logging for password operations
 *
 * Issue #4132 - Synхронизация пароль в базе Интеграм с Bitwarden
 */

import { BitwardenClient, DeviceType, LogLevel } from '@bitwarden/sdk-napi'
import logger from '../../utils/logger.js'
import crypto from 'crypto'

// Bitwarden configuration from environment
const BITWARDEN_API_URL = process.env.BITWARDEN_API_URL || 'https://api.bitwarden.com'
const BITWARDEN_IDENTITY_URL = process.env.BITWARDEN_IDENTITY_URL || 'https://identity.bitwarden.com'
const BITWARDEN_ORGANIZATION_ID = process.env.BITWARDEN_ORGANIZATION_ID
const BITWARDEN_ACCESS_TOKEN = process.env.BITWARDEN_ACCESS_TOKEN

// Cache for Bitwarden client instances
const clientCache = new Map()

/**
 * Initialize Bitwarden client
 *
 * @param {string} organizationId - Bitwarden organization ID
 * @param {string} accessToken - Access token for Secrets Manager
 * @returns {Promise<Object>} Initialized Bitwarden client
 */
async function initializeBitwardenClient(organizationId, accessToken) {
  const cacheKey = `${organizationId}:${accessToken.substring(0, 10)}`

  if (clientCache.has(cacheKey)) {
    logger.debug('Using cached Bitwarden client')
    return clientCache.get(cacheKey)
  }

  try {
    // Create Bitwarden client with SDK
    const client = new BitwardenClient({
      apiUrl: BITWARDEN_API_URL,
      identityUrl: BITWARDEN_IDENTITY_URL,
      deviceType: DeviceType.SDK,
      userAgent: 'DronDoc/1.0 (+https://dronedoc.ru)',
    })

    // Authenticate with access token
    await client.loginWithAccessToken(accessToken)

    logger.info('Bitwarden client initialized successfully')

    // Cache the client
    clientCache.set(cacheKey, client)

    return client
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to initialize Bitwarden client')
    throw new Error(`Bitwarden initialization failed: ${error.message}`)
  }
}

/**
 * Get default Bitwarden client using environment variables
 *
 * @returns {Promise<Object>} Bitwarden client
 */
async function getDefaultClient() {
  if (!BITWARDEN_ORGANIZATION_ID || !BITWARDEN_ACCESS_TOKEN) {
    throw new Error('Bitwarden credentials not configured. Set BITWARDEN_ORGANIZATION_ID and BITWARDEN_ACCESS_TOKEN')
  }

  return await initializeBitwardenClient(BITWARDEN_ORGANIZATION_ID, BITWARDEN_ACCESS_TOKEN)
}

/**
 * Generate secret name for Integram password
 *
 * @param {string} userId - User ID
 * @param {string} database - Database name (e.g., 'my', 'ddadmin')
 * @returns {string} Secret name
 */
function generateSecretName(userId, database) {
  return `integram-password-${database}-${userId}`
}

/**
 * Generate secret key (unique identifier for search)
 *
 * @param {string} userId - User ID
 * @param {string} database - Database name
 * @returns {string} Secret key
 */
function generateSecretKey(userId, database) {
  // Use consistent hash for searchability
  const hash = crypto.createHash('sha256')
    .update(`${userId}:${database}`)
    .digest('hex')
    .substring(0, 16)

  return `IG_${database.toUpperCase()}_${hash}`
}

/**
 * Store password in Bitwarden for specific database
 *
 * @param {string} userId - User ID
 * @param {string} database - Database name (e.g., 'my', 'ddadmin')
 * @param {string} password - Password to store (will be hashed by passwordSyncService)
 * @param {Object} metadata - Additional metadata (username, recordId, etc.)
 * @returns {Promise<Object>} Storage result with secret ID
 */
export async function storePasswordInBitwarden(userId, database, password, metadata = {}) {
  const startTime = Date.now()

  try {
    const client = await getDefaultClient()

    const secretName = generateSecretName(userId, database)
    const secretKey = generateSecretKey(userId, database)

    logger.info({ userId, database, secretKey }, 'Storing password in Bitwarden')

    // Create secret with metadata
    const secretData = {
      organizationId: BITWARDEN_ORGANIZATION_ID,
      key: secretKey,
      value: password,
      note: JSON.stringify({
        userId,
        database,
        recordId: metadata.recordId || null,
        username: metadata.username || null,
        createdAt: new Date().toISOString(),
        source: 'DronDoc-Integram-Sync',
      }),
    }

    // Check if secret already exists
    const existingSecrets = await client.secrets().list(BITWARDEN_ORGANIZATION_ID)
    const existingSecret = existingSecrets.data?.find(s => s.key === secretKey)

    let secret
    if (existingSecret) {
      // Update existing secret
      logger.info({ secretId: existingSecret.id, secretKey }, 'Updating existing Bitwarden secret')
      secret = await client.secrets().update(existingSecret.id, secretData)
    } else {
      // Create new secret
      logger.info({ secretKey }, 'Creating new Bitwarden secret')
      secret = await client.secrets().create(secretData)
    }

    const duration = Date.now() - startTime

    logger.info({
      userId,
      database,
      secretId: secret.id,
      secretKey,
      duration
    }, 'Password stored in Bitwarden successfully')

    return {
      success: true,
      secretId: secret.id,
      secretKey,
      database,
      duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime

    logger.error({
      userId,
      database,
      error: error.message,
      duration
    }, 'Failed to store password in Bitwarden')

    throw new Error(`Bitwarden storage failed: ${error.message}`)
  }
}

/**
 * Retrieve password from Bitwarden for specific database
 *
 * @param {string} userId - User ID
 * @param {string} database - Database name
 * @returns {Promise<Object>} Password and metadata
 */
export async function retrievePasswordFromBitwarden(userId, database) {
  const startTime = Date.now()

  try {
    const client = await getDefaultClient()
    const secretKey = generateSecretKey(userId, database)

    logger.debug({ userId, database, secretKey }, 'Retrieving password from Bitwarden')

    // List secrets and find by key
    const secrets = await client.secrets().list(BITWARDEN_ORGANIZATION_ID)
    const secret = secrets.data?.find(s => s.key === secretKey)

    if (!secret) {
      logger.warn({ userId, database, secretKey }, 'Password not found in Bitwarden')
      return {
        success: false,
        error: 'Password not found',
      }
    }

    // Get full secret details (includes value)
    const fullSecret = await client.secrets().get(secret.id)

    const duration = Date.now() - startTime

    // Parse metadata from note
    let metadata = {}
    try {
      metadata = JSON.parse(fullSecret.note || '{}')
    } catch (err) {
      logger.warn({ secretId: secret.id }, 'Failed to parse secret metadata')
    }

    logger.info({
      userId,
      database,
      secretId: secret.id,
      duration
    }, 'Password retrieved from Bitwarden successfully')

    return {
      success: true,
      password: fullSecret.value,
      secretId: secret.id,
      metadata,
      duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime

    logger.error({
      userId,
      database,
      error: error.message,
      duration
    }, 'Failed to retrieve password from Bitwarden')

    throw new Error(`Bitwarden retrieval failed: ${error.message}`)
  }
}

/**
 * Store passwords for all user's databases in Bitwarden
 *
 * @param {string} userId - User ID
 * @param {Array} databases - Array of database objects with { name, recordId, username }
 * @param {string} password - Password to store (same for all databases)
 * @returns {Promise<Object>} Storage results
 */
export async function storePasswordForAllDatabases(userId, databases, password) {
  const results = []
  const failedDatabases = []

  logger.info({ userId, databaseCount: databases.length }, 'Storing password in Bitwarden for all databases')

  for (const db of databases) {
    try {
      const result = await storePasswordInBitwarden(userId, db.name, password, {
        recordId: db.recordId,
        username: db.username,
      })
      results.push(result)
    } catch (error) {
      logger.error({ database: db.name, error: error.message }, 'Failed to store password in Bitwarden')
      results.push({
        success: false,
        database: db.name,
        error: error.message,
      })
      failedDatabases.push({
        database: db.name,
        error: error.message,
      })
    }
  }

  const successCount = results.filter(r => r.success).length
  const totalCount = results.length

  if (failedDatabases.length > 0) {
    logger.warn({
      userId,
      successCount,
      totalCount,
      failedDatabases
    }, 'Bitwarden storage completed with failures')

    return {
      success: false,
      message: 'Bitwarden storage completed with failures',
      successCount,
      totalCount,
      results,
      failedDatabases,
    }
  }

  logger.info({ userId, successCount }, 'Password stored in Bitwarden for all databases')

  return {
    success: true,
    message: 'Password stored in Bitwarden for all databases',
    successCount,
    totalCount,
    results,
  }
}

/**
 * Delete password from Bitwarden for specific database
 *
 * @param {string} userId - User ID
 * @param {string} database - Database name
 * @returns {Promise<Object>} Deletion result
 */
export async function deletePasswordFromBitwarden(userId, database) {
  try {
    const client = await getDefaultClient()
    const secretKey = generateSecretKey(userId, database)

    logger.info({ userId, database, secretKey }, 'Deleting password from Bitwarden')

    // Find secret by key
    const secrets = await client.secrets().list(BITWARDEN_ORGANIZATION_ID)
    const secret = secrets.data?.find(s => s.key === secretKey)

    if (!secret) {
      logger.warn({ userId, database, secretKey }, 'Password not found in Bitwarden (nothing to delete)')
      return {
        success: true,
        message: 'Password not found (nothing to delete)',
      }
    }

    // Delete secret
    await client.secrets().delete([secret.id])

    logger.info({ userId, database, secretId: secret.id }, 'Password deleted from Bitwarden')

    return {
      success: true,
      message: 'Password deleted from Bitwarden',
      secretId: secret.id,
    }
  } catch (error) {
    logger.error({ userId, database, error: error.message }, 'Failed to delete password from Bitwarden')
    throw new Error(`Bitwarden deletion failed: ${error.message}`)
  }
}

/**
 * List all passwords stored in Bitwarden for a user
 *
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of stored passwords metadata
 */
export async function listUserPasswordsInBitwarden(userId) {
  try {
    const client = await getDefaultClient()

    logger.debug({ userId }, 'Listing user passwords from Bitwarden')

    const secrets = await client.secrets().list(BITWARDEN_ORGANIZATION_ID)

    // Filter secrets for this user
    const userSecrets = secrets.data?.filter(s => {
      return s.key && s.key.includes(userId.substring(0, 8)) // Basic filtering
    }) || []

    const passwordList = userSecrets.map(secret => {
      let metadata = {}
      try {
        metadata = JSON.parse(secret.note || '{}')
      } catch (err) {
        // Ignore parse errors
      }

      return {
        secretId: secret.id,
        secretKey: secret.key,
        database: metadata.database || 'unknown',
        recordId: metadata.recordId,
        username: metadata.username,
        createdAt: metadata.createdAt,
      }
    })

    logger.info({ userId, count: passwordList.length }, 'Listed user passwords from Bitwarden')

    return {
      success: true,
      passwords: passwordList,
      count: passwordList.length,
    }
  } catch (error) {
    logger.error({ userId, error: error.message }, 'Failed to list user passwords from Bitwarden')
    throw new Error(`Bitwarden list failed: ${error.message}`)
  }
}

/**
 * Clear Bitwarden client cache (for maintenance)
 */
export function clearClientCache() {
  const count = clientCache.size
  clientCache.clear()
  logger.info({ count }, 'Bitwarden client cache cleared')
}

export default {
  initializeBitwardenClient,
  storePasswordInBitwarden,
  retrievePasswordFromBitwarden,
  storePasswordForAllDatabases,
  deletePasswordFromBitwarden,
  listUserPasswordsInBitwarden,
  clearClientCache,
}
