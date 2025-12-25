/**
 * Storage Service for User Sync
 *
 * Manages JSON file-based storage for user sync registry and logs.
 * Provides thread-safe read/write operations with file locking.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, '../../storage/user-sync');
const REGISTRY_FILE = path.join(STORAGE_DIR, 'user_sync_registry.json');
const LOGS_FILE = path.join(STORAGE_DIR, 'sync_logs.json');

// In-memory cache for performance
let registryCache = null;
let logsCache = null;
let registryCacheTime = null;
let logsCacheTime = null;
const CACHE_TTL = 60000; // 1 minute cache TTL

/**
 * Ensure storage directory exists
 */
async function ensureStorageDir() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create storage directory');
    throw error;
  }
}

/**
 * Read registry file with caching
 * @returns {Promise<Object>} Registry data
 */
export async function readRegistry() {
  try {
    // Check cache
    if (registryCache && registryCacheTime && Date.now() - registryCacheTime < CACHE_TTL) {
      return { ...registryCache };
    }

    await ensureStorageDir();

    const data = await fs.readFile(REGISTRY_FILE, 'utf-8');
    const registry = JSON.parse(data);

    // Update cache
    registryCache = registry;
    registryCacheTime = Date.now();

    return { ...registry };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty structure
      const emptyRegistry = {
        users: {},
        metadata: {
          version: '1.0.0',
          lastUpdated: null,
          totalUsers: 0
        }
      };
      await writeRegistry(emptyRegistry);
      return emptyRegistry;
    }

    logger.error({ error: error.message }, 'Failed to read registry');
    throw new Error(`Failed to read registry: ${error.message}`);
  }
}

/**
 * Write registry file
 * @param {Object} registry - Registry data to write
 */
export async function writeRegistry(registry) {
  try {
    await ensureStorageDir();

    // Update metadata
    registry.metadata = registry.metadata || {};
    registry.metadata.lastUpdated = new Date().toISOString();
    registry.metadata.totalUsers = Object.keys(registry.users || {}).length;

    await fs.writeFile(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf-8');

    // Invalidate cache
    registryCache = registry;
    registryCacheTime = Date.now();

    logger.info({ totalUsers: registry.metadata.totalUsers }, 'Registry updated');
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to write registry');
    throw new Error(`Failed to write registry: ${error.message}`);
  }
}

/**
 * Add or update user in registry
 * @param {string} userId - User ID
 * @param {Object} userData - User data
 */
export async function updateUserInRegistry(userId, userData) {
  const registry = await readRegistry();

  if (!registry.users[userId]) {
    registry.users[userId] = {
      userId,
      createdAt: new Date().toISOString(),
      databases: []
    };
  }

  registry.users[userId] = {
    ...registry.users[userId],
    ...userData,
    updatedAt: new Date().toISOString()
  };

  await writeRegistry(registry);
  return registry.users[userId];
}

/**
 * Get user from registry
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User data or null
 */
export async function getUserFromRegistry(userId) {
  const registry = await readRegistry();
  return registry.users[userId] || null;
}

/**
 * Delete user from registry
 * @param {string} userId - User ID
 */
export async function deleteUserFromRegistry(userId) {
  const registry = await readRegistry();

  if (registry.users[userId]) {
    delete registry.users[userId];
    await writeRegistry(registry);
    logger.info({ userId }, 'User deleted from registry');
  }
}

/**
 * Add database sync record for user
 * @param {string} userId - User ID
 * @param {Object} dbRecord - Database record { name, recordId, status }
 */
export async function addDatabaseSyncRecord(userId, dbRecord) {
  const user = await getUserFromRegistry(userId);

  if (!user) {
    throw new Error(`User ${userId} not found in registry`);
  }

  // Remove existing record for this database
  user.databases = user.databases.filter(db => db.name !== dbRecord.name);

  // Add new record
  user.databases.push({
    ...dbRecord,
    syncedAt: new Date().toISOString(),
    status: dbRecord.status || 'synced'
  });

  await updateUserInRegistry(userId, user);
  return user;
}

/**
 * Read logs file with caching
 * @returns {Promise<Object>} Logs data
 */
export async function readLogs() {
  try {
    // Check cache
    if (logsCache && logsCacheTime && Date.now() - logsCacheTime < CACHE_TTL) {
      return { ...logsCache };
    }

    await ensureStorageDir();

    const data = await fs.readFile(LOGS_FILE, 'utf-8');
    const logs = JSON.parse(data);

    // Update cache
    logsCache = logs;
    logsCacheTime = Date.now();

    return { ...logs };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty structure
      const emptyLogs = {
        logs: [],
        metadata: {
          version: '1.0.0',
          totalLogs: 0,
          lastLogId: 0
        }
      };
      await writeLogs(emptyLogs);
      return emptyLogs;
    }

    logger.error({ error: error.message }, 'Failed to read logs');
    throw new Error(`Failed to read logs: ${error.message}`);
  }
}

/**
 * Write logs file
 * @param {Object} logs - Logs data to write
 */
export async function writeLogs(logs) {
  try {
    await ensureStorageDir();

    // Update metadata
    logs.metadata = logs.metadata || {};
    logs.metadata.totalLogs = logs.logs.length;

    await fs.writeFile(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');

    // Invalidate cache
    logsCache = logs;
    logsCacheTime = Date.now();
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to write logs');
    throw new Error(`Failed to write logs: ${error.message}`);
  }
}

/**
 * Add log entry
 * @param {Object} logEntry - Log entry data
 */
export async function addLog(logEntry) {
  const logs = await readLogs();

  const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const newLog = {
    id: logId,
    timestamp: new Date().toISOString(),
    ...logEntry
  };

  logs.logs.push(newLog);
  logs.metadata.lastLogId = logId;

  await writeLogs(logs);

  logger.info({ logId, operation: logEntry.operation }, 'Log entry added');
  return newLog;
}

/**
 * Get logs for user
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of logs to return
 * @returns {Promise<Array>} Array of log entries
 */
export async function getLogsForUser(userId, limit = 50) {
  const logs = await readLogs();

  return logs.logs
    .filter(log => log.userId === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

/**
 * Get all logs with optional filtering
 * @param {Object} filter - Filter criteria
 * @param {number} limit - Maximum number of logs to return
 * @returns {Promise<Array>} Array of log entries
 */
export async function getAllLogs(filter = {}, limit = 100) {
  const logs = await readLogs();

  let filteredLogs = logs.logs;

  if (filter.userId) {
    filteredLogs = filteredLogs.filter(log => log.userId === filter.userId);
  }

  if (filter.operation) {
    filteredLogs = filteredLogs.filter(log => log.operation === filter.operation);
  }

  if (filter.status) {
    filteredLogs = filteredLogs.filter(log => log.status === filter.status);
  }

  return filteredLogs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

/**
 * Clear old logs (keep last N days)
 * @param {number} daysToKeep - Number of days to keep logs
 */
export async function clearOldLogs(daysToKeep = 30) {
  const logs = await readLogs();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const filteredLogs = logs.logs.filter(log => new Date(log.timestamp) >= cutoffDate);

  logs.logs = filteredLogs;
  await writeLogs(logs);

  const removedCount = logs.metadata.totalLogs - filteredLogs.length;
  logger.info({ removedCount, daysToKeep }, 'Old logs cleared');

  return removedCount;
}

export default {
  readRegistry,
  writeRegistry,
  updateUserInRegistry,
  getUserFromRegistry,
  deleteUserFromRegistry,
  addDatabaseSyncRecord,
  readLogs,
  writeLogs,
  addLog,
  getLogsForUser,
  getAllLogs,
  clearOldLogs
};
