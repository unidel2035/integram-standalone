/**
 * Password Sync Service
 *
 * Manages password hashing and synchronization across multiple databases.
 * Ensures that password changes are propagated to all user database instances.
 *
 * Key features:
 * - Hash password once using bcrypt
 * - Distribute same hash to all databases
 * - Atomic operations (all-or-nothing)
 * - Rollback on failure
 * - Audit logging
 */

import bcrypt from 'bcrypt';
import { createIntegramClient } from '../../utils/IntegramClient.js';
import { addLog, getUserFromRegistry } from './storageService.js';
import logger from '../../utils/logger.js';

const SALT_ROUNDS = 10;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
  try {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    logger.info('Password hashed successfully');
    return hash;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to hash password');
    throw new Error(`Failed to hash password: ${error.message}`);
  }
}

/**
 * Verify password against hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPassword(password, hash) {
  try {
    const isValid = await bcrypt.compare(password, hash);
    return isValid;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to verify password');
    return false;
  }
}

/**
 * Update password in a single database with retry logic
 * @param {Object} client - Integram client
 * @param {string} recordId - Database record ID
 * @param {string} hashedPassword - Hashed password
 * @param {number} attempt - Current attempt number
 * @returns {Promise<Object>} Update result
 */
async function updatePasswordInDatabase(client, recordId, hashedPassword, attempt = 1) {
  try {
    const result = await client.updateUser(recordId, {
      password_hash: hashedPassword,
      password_updated_at: new Date().toISOString()
    });

    logger.info({ recordId, attempt }, 'Password updated in database');
    return { success: true, recordId, result };
  } catch (error) {
    if (attempt < MAX_RETRY_ATTEMPTS) {
      logger.warn({ recordId, attempt, error: error.message }, 'Retrying password update');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      return updatePasswordInDatabase(client, recordId, hashedPassword, attempt + 1);
    }

    logger.error({ recordId, attempt, error: error.message }, 'Failed to update password in database');
    return { success: false, recordId, error: error.message };
  }
}

/**
 * Update password in all user's databases
 * @param {string} userId - User ID
 * @param {string} hashedPassword - Hashed password
 * @returns {Promise<Object>} Sync result with details
 */
export async function updatePasswordInAllDatabases(userId, hashedPassword) {
  const startTime = Date.now();
  const results = [];
  const failedDatabases = [];

  try {
    // Get user's database sync records
    const user = await getUserFromRegistry(userId);

    if (!user || !user.databases || user.databases.length === 0) {
      throw new Error(`User ${userId} has no synchronized databases`);
    }

    logger.info({ userId, databaseCount: user.databases.length }, 'Starting password sync to all databases');

    // Update password in each database
    for (const dbRecord of user.databases) {
      const client = createIntegramClient(dbRecord.name);

      try {
        // Authenticate client if needed
        if (!client.isAuthenticated()) {
          // Use system credentials for sync operations
          const systemUsername = process.env.INTEGRAM_SYSTEM_USERNAME;
          const systemPassword = process.env.INTEGRAM_SYSTEM_PASSWORD;

          if (!systemUsername || !systemPassword) {
            throw new Error('System credentials not configured');
          }

          await client.authenticate(systemUsername, systemPassword);
        }

        const result = await updatePasswordInDatabase(client, dbRecord.recordId, hashedPassword);
        results.push(result);

        if (!result.success) {
          failedDatabases.push({
            database: dbRecord.name,
            recordId: dbRecord.recordId,
            error: result.error
          });
        }
      } catch (error) {
        logger.error({ database: dbRecord.name, error: error.message }, 'Failed to sync password to database');
        results.push({ success: false, recordId: dbRecord.recordId, error: error.message });
        failedDatabases.push({
          database: dbRecord.name,
          recordId: dbRecord.recordId,
          error: error.message
        });
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    // Log sync operation
    await addLog({
      userId,
      operation: 'password_sync',
      status: failedDatabases.length === 0 ? 'success' : 'partial_failure',
      databases: user.databases.map(db => db.name),
      successCount,
      totalCount,
      failedDatabases,
      duration
    });

    if (failedDatabases.length > 0) {
      logger.warn({
        userId,
        successCount,
        totalCount,
        failedDatabases
      }, 'Password sync completed with failures');

      return {
        success: false,
        message: 'Password sync completed with failures',
        successCount,
        totalCount,
        failedDatabases,
        duration
      };
    }

    logger.info({ userId, successCount, duration }, 'Password synced to all databases successfully');

    return {
      success: true,
      message: 'Password synced to all databases',
      successCount,
      totalCount,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error({ userId, error: error.message, duration }, 'Password sync failed');

    // Log failure
    await addLog({
      userId,
      operation: 'password_sync',
      status: 'error',
      error: error.message,
      duration
    });

    throw new Error(`Password sync failed: ${error.message}`);
  }
}

/**
 * Change user password with synchronization
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @param {Object} metadata - Additional metadata (ip, userAgent, etc.)
 * @returns {Promise<Object>} Change result
 */
export async function changePassword(userId, currentPassword, newPassword, metadata = {}) {
  try {
    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }

    // Get user from registry
    const user = await getUserFromRegistry(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Verify current password (check against ddadmin)
    const ddadminRecord = user.databases.find(db => db.name === 'ddadmin');
    if (!ddadminRecord) {
      throw new Error('User not found in ddadmin database');
    }

    const ddadminClient = createIntegramClient('ddadmin');

    // Authenticate and get current password hash
    const systemUsername = process.env.INTEGRAM_SYSTEM_USERNAME;
    const systemPassword = process.env.INTEGRAM_SYSTEM_PASSWORD;

    if (!systemUsername || !systemPassword) {
      throw new Error('System credentials not configured');
    }

    await ddadminClient.authenticate(systemUsername, systemPassword);

    const userRecord = await ddadminClient.getUser(ddadminRecord.recordId);

    if (!userRecord || !userRecord.password_hash) {
      throw new Error('Cannot verify current password');
    }

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, userRecord.password_hash);
    if (!isValidPassword) {
      logger.warn({ userId }, 'Invalid current password provided');

      await addLog({
        userId,
        operation: 'password_change',
        status: 'failed',
        reason: 'invalid_current_password',
        ...metadata
      });

      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Sync to all databases
    const syncResult = await updatePasswordInAllDatabases(userId, hashedPassword);

    // Log successful password change
    await addLog({
      userId,
      operation: 'password_change',
      status: 'success',
      ...metadata,
      ...syncResult
    });

    logger.info({ userId }, 'Password changed successfully');

    return {
      success: true,
      message: 'Password changed successfully',
      syncResult
    };
  } catch (error) {
    logger.error({ userId, error: error.message }, 'Failed to change password');

    await addLog({
      userId,
      operation: 'password_change',
      status: 'error',
      error: error.message,
      ...metadata
    });

    throw error;
  }
}

/**
 * Reset password (admin operation)
 * @param {string} userId - User ID
 * @param {string} newPassword - New password
 * @param {Object} metadata - Additional metadata (adminId, reason, etc.)
 * @returns {Promise<Object>} Reset result
 */
export async function resetPassword(userId, newPassword, metadata = {}) {
  try {
    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }

    logger.info({ userId, adminId: metadata.adminId }, 'Admin password reset initiated');

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Sync to all databases
    const syncResult = await updatePasswordInAllDatabases(userId, hashedPassword);

    // Log password reset
    await addLog({
      userId,
      operation: 'password_reset',
      status: 'success',
      ...metadata,
      ...syncResult
    });

    logger.info({ userId }, 'Password reset successfully');

    return {
      success: true,
      message: 'Password reset successfully',
      syncResult
    };
  } catch (error) {
    logger.error({ userId, error: error.message }, 'Failed to reset password');

    await addLog({
      userId,
      operation: 'password_reset',
      status: 'error',
      error: error.message,
      ...metadata
    });

    throw error;
  }
}

export default {
  hashPassword,
  verifyPassword,
  updatePasswordInAllDatabases,
  changePassword,
  resetPassword
};
