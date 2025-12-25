/**
 * User Sync Service
 *
 * Manages user registration in Integram database.
 * Provides functionality for user registration, updates, and synchronization.
 *
 * Key features:
 * - Register user in 'my' database (table 18)
 * - Create user in specified databases
 * - Maintain sync registry
 * - Validate user data
 * - Rollback on failure
 * - Comprehensive logging
 */

import { v4 as uuidv4 } from 'uuid';
import { createIntegramClient } from '../../utils/IntegramClient.js';
import { hashPassword } from './passwordSyncService.js';
import {
  updateUserInRegistry,
  getUserFromRegistry,
  deleteUserFromRegistry,
  addDatabaseSyncRecord,
  addLog
} from './storageService.js';
import logger from '../../utils/logger.js';

const DEFAULT_DATABASES = ['my']; // Default database to sync (only 'my' for user registration)
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Validate user data
 * @param {Object} userData - User data to validate
 * @throws {Error} If validation fails
 */
function validateUserData(userData) {
  const errors = [];

  if (!userData.email || !userData.email.includes('@')) {
    errors.push('Valid email is required');
  }

  if (!userData.password || userData.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (userData.username && userData.username.length < 3) {
    errors.push('Username must be at least 3 characters');
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
}

/**
 * Create user in a single database with retry logic
 * @param {string} database - Database name
 * @param {Object} userData - User data
 * @param {number} attempt - Current attempt number
 * @returns {Promise<Object>} Creation result
 */
async function createUserInDatabase(database, userData, attempt = 1) {
  try {
    const client = createIntegramClient(database);

    // Use registration credentials for MY database, system credentials for others
    const systemUsername = database === 'my'
      ? (process.env.INTEGRAM_REGISTRATION_USERNAME || process.env.INTEGRAM_SYSTEM_USERNAME)
      : process.env.INTEGRAM_SYSTEM_USERNAME;
    const systemPassword = database === 'my'
      ? (process.env.INTEGRAM_REGISTRATION_PASSWORD || process.env.INTEGRAM_SYSTEM_PASSWORD)
      : process.env.INTEGRAM_SYSTEM_PASSWORD;

    logger.info({
      database,
      systemUsername,
      hasRegistrationUsername: !!process.env.INTEGRAM_REGISTRATION_USERNAME,
      hasRegistrationPassword: !!process.env.INTEGRAM_REGISTRATION_PASSWORD,
      hasSystemUsername: !!process.env.INTEGRAM_SYSTEM_USERNAME,
      hasSystemPassword: !!process.env.INTEGRAM_SYSTEM_PASSWORD
    }, 'Credentials check');

    if (!systemUsername || !systemPassword) {
      throw new Error('System credentials not configured');
    }

    logger.info({ database, systemUsername }, 'Attempting authentication');
    await client.authenticate(systemUsername, systemPassword);
    logger.info({ database }, 'Authentication successful');

    // Create user
    logger.info({ database, userData }, 'Attempting to create user');
    const result = await client.createUser(userData);

    logger.info({ database, userId: result.id, email: userData.email }, 'User created in database');

    return {
      success: true,
      database,
      recordId: result.id,
      data: result
    };
  } catch (error) {
    if (attempt < MAX_RETRY_ATTEMPTS) {
      logger.warn({ database, attempt, error: error.message }, 'Retrying user creation');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      return createUserInDatabase(database, userData, attempt + 1);
    }

    logger.error({ database, attempt, error: error.message }, 'Failed to create user in database');

    return {
      success: false,
      database,
      error: error.message
    };
  }
}

/**
 * Delete user from database (rollback operation)
 * @param {string} database - Database name
 * @param {string} recordId - Record ID to delete
 */
async function deleteUserFromDatabase(database, recordId) {
  try {
    const client = createIntegramClient(database);

    const systemUsername = process.env.INTEGRAM_SYSTEM_USERNAME;
    const systemPassword = process.env.INTEGRAM_SYSTEM_PASSWORD;

    await client.authenticate(systemUsername, systemPassword);
    await client.deleteUser(recordId);

    logger.info({ database, recordId }, 'User deleted from database (rollback)');
  } catch (error) {
    logger.error({ database, recordId, error: error.message }, 'Failed to rollback user creation');
  }
}

/**
 * Register a new user with synchronization
 * @param {Object} userData - User registration data
 * @param {Array<string>} databases - Databases to sync (default: ['my'])
 * @returns {Promise<Object>} Registration result
 */
export async function registerUser(userData, databases = DEFAULT_DATABASES) {
  const startTime = Date.now();
  const userId = uuidv4();
  const createdRecords = [];
  let rollbackNeeded = false;

  try {
    // Validate user data
    validateUserData(userData);

    logger.info({ userId, email: userData.email, databases }, 'Starting user registration');

    // DEBUG: Log what we received
    logger.info({
      hasPassword: !!userData.password,
      passwordLength: userData.password?.length,
      username: userData.username
    }, 'DEBUG: registerUser received data');

    // IMPORTANT: Do NOT hash password here!
    // Integram handles password hashing internally when we pass plain password to t20
    // If we hash it here, the password gets double-hashed and login fails

    // Prepare user data for Integram
    const integramUserData = {
      user_id: userId,
      email: userData.email,
      username: userData.username || null,
      display_name: userData.displayName || null,
      password: userData.password, // Send plain password - Integram hashes it
      referral_code: userData.referralCode || null, // Referral code from inviter (column 209326) - Issue #5112
      is_active: true,
      is_verified: false,
      created_at: new Date().toISOString()
    };

    // Create user in all databases
    const createPromises = databases.map(db => createUserInDatabase(db, integramUserData));
    const results = await Promise.all(createPromises);

    // Check for failures
    const failedCreations = results.filter(r => !r.success);

    if (failedCreations.length > 0) {
      rollbackNeeded = true;
      const failureDetails = failedCreations.map(f => `${f.database}: ${f.error}`).join('; ');
      logger.error({ userId, failedCreations, failureDetails }, 'User creation failed in some databases');

      // Rollback successful creations
      const successfulCreations = results.filter(r => r.success);
      for (const record of successfulCreations) {
        await deleteUserFromDatabase(record.database, record.recordId);
      }

      throw new Error(
        `Failed to create user in databases: ${failedCreations.map(f => f.database).join(', ')}. Errors: ${failureDetails}`
      );
    }

    // Store successful creations
    createdRecords.push(...results);

    // Update registry
    const registryData = {
      userId,
      email: userData.email,
      username: userData.username,
      displayName: userData.displayName,
      databases: results.map(r => ({
        name: r.database,
        recordId: r.recordId,
        status: 'synced',
        syncedAt: new Date().toISOString()
      })),
      createdAt: new Date().toISOString()
    };

    await updateUserInRegistry(userId, registryData);

    const duration = Date.now() - startTime;

    // Log successful registration
    await addLog({
      userId,
      operation: 'user_registration',
      status: 'success',
      databases: databases,
      email: userData.email,
      duration
    });

    logger.info({ userId, email: userData.email, duration }, 'User registered successfully');

    return {
      success: true,
      userId,
      email: userData.email,
      databases: createdRecords.map(r => ({
        database: r.database,
        recordId: r.recordId
      })),
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error({ userId, error: error.message, duration }, 'User registration failed');

    // Log failure
    await addLog({
      userId,
      operation: 'user_registration',
      status: 'error',
      error: error.message,
      rollbackPerformed: rollbackNeeded,
      duration
    });

    // Clean up registry if it was created
    try {
      await deleteUserFromRegistry(userId);
    } catch (cleanupError) {
      logger.error({ userId, error: cleanupError.message }, 'Failed to clean up registry');
    }

    throw new Error(`User registration failed: ${error.message}`);
  }
}

/**
 * Sync existing user to additional database
 * @param {string} userId - User ID
 * @param {string} database - Database to sync to
 * @returns {Promise<Object>} Sync result
 */
export async function syncUserToDatabase(userId, database) {
  try {
    logger.info({ userId, database }, 'Syncing user to additional database');

    // Get user from registry
    const user = await getUserFromRegistry(userId);
    if (!user) {
      throw new Error(`User ${userId} not found in registry`);
    }

    // Check if user is already synced to this database
    const existingSync = user.databases.find(db => db.name === database);
    if (existingSync) {
      logger.info({ userId, database }, 'User already synced to this database');
      return {
        success: true,
        message: 'User already synced to this database',
        recordId: existingSync.recordId
      };
    }

    // Get user data from ddadmin
    const ddadminRecord = user.databases.find(db => db.name === 'ddadmin');
    if (!ddadminRecord) {
      throw new Error('User not found in ddadmin');
    }

    const ddadminClient = createIntegramClient('ddadmin');
    const systemUsername = process.env.INTEGRAM_SYSTEM_USERNAME;
    const systemPassword = process.env.INTEGRAM_SYSTEM_PASSWORD;

    await ddadminClient.authenticate(systemUsername, systemPassword);
    const ddadminUser = await ddadminClient.getUser(ddadminRecord.recordId);

    // Create user in target database
    const result = await createUserInDatabase(database, ddadminUser);

    if (!result.success) {
      throw new Error(`Failed to sync user to ${database}: ${result.error}`);
    }

    // Update registry
    await addDatabaseSyncRecord(userId, {
      name: database,
      recordId: result.recordId,
      status: 'synced'
    });

    // Log sync operation
    await addLog({
      userId,
      operation: 'user_sync',
      status: 'success',
      database,
      recordId: result.recordId
    });

    logger.info({ userId, database, recordId: result.recordId }, 'User synced to database successfully');

    return {
      success: true,
      message: 'User synced to database successfully',
      database,
      recordId: result.recordId
    };
  } catch (error) {
    logger.error({ userId, database, error: error.message }, 'Failed to sync user to database');

    await addLog({
      userId,
      operation: 'user_sync',
      status: 'error',
      database,
      error: error.message
    });

    throw error;
  }
}

/**
 * Update user information in all databases
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Update result
 */
export async function updateUserInAllDatabases(userId, updates) {
  try {
    logger.info({ userId, updates: Object.keys(updates) }, 'Updating user in all databases');

    // Get user from registry
    const user = await getUserFromRegistry(userId);
    if (!user) {
      throw new Error(`User ${userId} not found in registry`);
    }

    // Prepare update data
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const updateResults = [];
    const failedUpdates = [];

    // Update user in each database
    for (const dbRecord of user.databases) {
      try {
        const client = createIntegramClient(dbRecord.name);

        const systemUsername = process.env.INTEGRAM_SYSTEM_USERNAME;
        const systemPassword = process.env.INTEGRAM_SYSTEM_PASSWORD;

        await client.authenticate(systemUsername, systemPassword);

        const result = await client.updateUser(dbRecord.recordId, updateData);

        updateResults.push({
          database: dbRecord.name,
          recordId: dbRecord.recordId,
          success: true
        });

        logger.info({ userId, database: dbRecord.name }, 'User updated in database');
      } catch (error) {
        logger.error({ userId, database: dbRecord.name, error: error.message }, 'Failed to update user');

        updateResults.push({
          database: dbRecord.name,
          recordId: dbRecord.recordId,
          success: false,
          error: error.message
        });

        failedUpdates.push({
          database: dbRecord.name,
          error: error.message
        });
      }
    }

    // Update registry
    await updateUserInRegistry(userId, {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString()
    });

    // Log update operation
    await addLog({
      userId,
      operation: 'user_update',
      status: failedUpdates.length === 0 ? 'success' : 'partial_failure',
      updates: Object.keys(updates),
      failedDatabases: failedUpdates
    });

    if (failedUpdates.length > 0) {
      logger.warn({ userId, failedUpdates }, 'User update completed with failures');

      return {
        success: false,
        message: 'User update completed with failures',
        results: updateResults,
        failedDatabases: failedUpdates
      };
    }

    logger.info({ userId }, 'User updated in all databases successfully');

    return {
      success: true,
      message: 'User updated in all databases',
      results: updateResults
    };
  } catch (error) {
    logger.error({ userId, error: error.message }, 'User update failed');

    await addLog({
      userId,
      operation: 'user_update',
      status: 'error',
      error: error.message
    });

    throw error;
  }
}

/**
 * Delete user from all databases
 * @param {string} userId - User ID
 * @param {boolean} archive - Whether to archive data before deletion
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteUser(userId, archive = true) {
  try {
    logger.info({ userId, archive }, 'Deleting user from all databases');

    // Get user from registry
    const user = await getUserFromRegistry(userId);
    if (!user) {
      throw new Error(`User ${userId} not found in registry`);
    }

    let archivedData = null;

    // Archive user data if requested
    if (archive) {
      archivedData = { ...user };

      await addLog({
        userId,
        operation: 'user_archive',
        status: 'success',
        archivedData
      });

      logger.info({ userId }, 'User data archived');
    }

    const deleteResults = [];
    const failedDeletions = [];

    // Delete user from each database
    for (const dbRecord of user.databases) {
      try {
        const client = createIntegramClient(dbRecord.name);

        const systemUsername = process.env.INTEGRAM_SYSTEM_USERNAME;
        const systemPassword = process.env.INTEGRAM_SYSTEM_PASSWORD;

        await client.authenticate(systemUsername, systemPassword);
        await client.deleteUser(dbRecord.recordId);

        deleteResults.push({
          database: dbRecord.name,
          recordId: dbRecord.recordId,
          success: true
        });

        logger.info({ userId, database: dbRecord.name }, 'User deleted from database');
      } catch (error) {
        logger.error({ userId, database: dbRecord.name, error: error.message }, 'Failed to delete user');

        deleteResults.push({
          database: dbRecord.name,
          recordId: dbRecord.recordId,
          success: false,
          error: error.message
        });

        failedDeletions.push({
          database: dbRecord.name,
          error: error.message
        });
      }
    }

    // Delete from registry
    await deleteUserFromRegistry(userId);

    // Log deletion operation
    await addLog({
      userId,
      operation: 'user_deletion',
      status: failedDeletions.length === 0 ? 'success' : 'partial_failure',
      failedDatabases: failedDeletions,
      archived: archive
    });

    if (failedDeletions.length > 0) {
      logger.warn({ userId, failedDeletions }, 'User deletion completed with failures');

      return {
        success: false,
        message: 'User deletion completed with failures',
        results: deleteResults,
        failedDatabases: failedDeletions,
        archivedData
      };
    }

    logger.info({ userId }, 'User deleted from all databases successfully');

    return {
      success: true,
      message: 'User deleted from all databases',
      results: deleteResults,
      archivedData
    };
  } catch (error) {
    logger.error({ userId, error: error.message }, 'User deletion failed');

    await addLog({
      userId,
      operation: 'user_deletion',
      status: 'error',
      error: error.message
    });

    throw error;
  }
}

/**
 * Get user profile from all databases
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Unified user profile
 */
export async function getUserProfile(userId) {
  try {
    // Get user from registry
    const user = await getUserFromRegistry(userId);
    if (!user) {
      throw new Error(`User ${userId} not found in registry`);
    }

    const profiles = {};

    // Get user data from each database
    for (const dbRecord of user.databases) {
      try {
        const client = createIntegramClient(dbRecord.name);

        const systemUsername = process.env.INTEGRAM_SYSTEM_USERNAME;
        const systemPassword = process.env.INTEGRAM_SYSTEM_PASSWORD;

        await client.authenticate(systemUsername, systemPassword);

        const profile = await client.getUser(dbRecord.recordId);
        profiles[dbRecord.name] = profile;
      } catch (error) {
        logger.error({ userId, database: dbRecord.name, error: error.message }, 'Failed to get user profile');
        profiles[dbRecord.name] = { error: error.message };
      }
    }

    return {
      userId,
      registry: user,
      profiles
    };
  } catch (error) {
    logger.error({ userId, error: error.message }, 'Failed to get user profile');
    throw error;
  }
}

export default {
  registerUser,
  syncUserToDatabase,
  updateUserInAllDatabases,
  deleteUser,
  getUserProfile
};
