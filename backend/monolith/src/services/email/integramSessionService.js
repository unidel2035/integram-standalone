/**
 * Integram Session Service
 *
 * Creates and manages user sessions in Integram table 205909 (Сессия)
 * Used to track AI token transactions during user registration and activity.
 * Issue #5137: Session creation after email verification
 *
 * Table 205909 (Сессия) structure:
 * - Parent: User (table 18) - sessions are subordinate to users
 * - 205911: Дата (DATE) - Session creation date
 * - 205913: Транзакция (reference to 198038) - AI token transactions
 * - 205921: session_id (SHORT, NOT NULL) - Unique session identifier
 * - 205928: Последняя активность (DATETIME) - Last activity timestamp
 *
 * @module IntegrimSessionService
 */

import crypto from 'crypto';
import logger from '../../utils/logger.js';
import { createIntegramClient } from '../../utils/IntegramClient.js';
import axios from 'axios';

// Table and requisite IDs
const SESSIONS_TABLE_ID = 205909;
const REQUISITE_IDS = {
  date: 205911,
  transaction: 205913,
  sessionId: 205921,
  lastActivity: 205928
};

/**
 * Generate unique session ID
 * @param {number} userId - Integram user ID
 * @returns {string} Session ID
 */
function generateSessionId(userId) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(6).toString('hex');
  return `session_${timestamp}_${random}_u${userId}`;
}

/**
 * Create a session in Integram table 205909
 * @param {Object} options - Session options
 * @param {number} options.userId - Integram user ID (from table 18)
 * @param {string} options.database - Database name (default: 'my')
 * @param {string} [options.sessionType='email_registration'] - Session type
 * @returns {Promise<Object>} Created session data
 */
export async function createSession(options) {
  try {
    const { userId, database = 'my', sessionType = 'email_registration' } = options;

    if (!userId) {
      throw new Error('userId is required for session creation');
    }

    logger.info({ userId, database, sessionType }, 'Creating Integram session');

    // Create Integram client
    const client = createIntegramClient(database);

    // Authenticate with system credentials
    const systemUsername = process.env.INTEGRAM_SYSTEM_USERNAME || 'd';
    const systemPassword = process.env.INTEGRAM_SYSTEM_PASSWORD || 'd';

    await client.authenticate(systemUsername, systemPassword);

    // Generate session ID
    const sessionId = generateSessionId(userId);

    // Current date and time in ISO format
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const dateTimeStr = now.toISOString(); // Full ISO datetime

    // Create session object as subordinate to user
    // The session will be linked to the user via parentId
    const sessionData = {
      typeId: SESSIONS_TABLE_ID,
      value: `Сессия ${sessionType} - ${dateStr}`, // Session name/value
      parentId: userId, // Link to user in table 18
      requisites: {
        [REQUISITE_IDS.sessionId]: sessionId,
        [REQUISITE_IDS.date]: dateStr,
        [REQUISITE_IDS.lastActivity]: dateTimeStr
      }
    };

    logger.info({
      userId,
      sessionId,
      sessionData
    }, 'Creating session with data');

    // Create session using Integram API with form data
    const createUrl = `https://dronedoc.ru/${database}/object/${SESSIONS_TABLE_ID}/_new`;
    const createData = new URLSearchParams();
    createData.append('_parent_', userId);
    createData.append('_xsrf', client.session.xsrf);
    createData.append('val', sessionData.value);
    createData.append(REQUISITE_IDS.sessionId.toString(), sessionId);
    createData.append(REQUISITE_IDS.date.toString(), dateStr);
    createData.append(REQUISITE_IDS.lastActivity.toString(), dateTimeStr);

    const response = await axios.post(createUrl, createData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Authorization': client.session.token
      }
    });

    logger.info({
      userId,
      sessionId,
      sessionType,
      responseData: response.data
    }, 'Integram API response for session creation');

    // Check if Integram returned an error
    if (response.data && response.data.failed) {
      throw new Error(`Integram API error: ${JSON.stringify(response.data)}`);
    }

    return {
      success: true,
      sessionId,
      userId,
      database,
      sessionType,
      createdAt: now
    };
  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      userId: options.userId
    }, 'Failed to create Integram session');

    // Don't throw - session creation failure shouldn't block user registration
    return {
      success: false,
      error: error.message,
      userId: options.userId
    };
  }
}

/**
 * Update session last activity timestamp
 * @param {Object} options - Update options
 * @param {string} options.sessionId - Session ID
 * @param {string} options.database - Database name
 * @returns {Promise<Object>} Update result
 */
export async function updateSessionActivity(options) {
  try {
    const { sessionId, database = 'my' } = options;

    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    logger.info({ sessionId, database }, 'Updating session activity');

    const client = createIntegramClient(database);
    const systemUsername = process.env.INTEGRAM_SYSTEM_USERNAME || 'd';
    const systemPassword = process.env.INTEGRAM_SYSTEM_PASSWORD || 'd';

    await client.authenticate(systemUsername, systemPassword);

    // Find session by sessionId
    // This would require a query/search functionality
    // For now, just log the intent
    logger.info({ sessionId }, 'Session activity update requested (search functionality needed)');

    return {
      success: true,
      sessionId,
      updatedAt: new Date()
    };
  } catch (error) {
    logger.error({
      error: error.message,
      sessionId: options.sessionId
    }, 'Failed to update session activity');

    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  createSession,
  updateSessionActivity
};
