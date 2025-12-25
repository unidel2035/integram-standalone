/**
 * Unified Authentication Service with Database Persistence
 *
 * Issue #3631: Database Token Storage System
 *
 * This is an enhanced version of UnifiedAuthService that adds persistent storage
 * for session tokens in the Integram ddadmin database. It extends the existing
 * UnifiedAuthService and adds database persistence on top of in-memory caching.
 *
 * Key Features:
 * - All features from UnifiedAuthService (auto-renewal, SSO, MFA, monitoring)
 * - Persistent token storage in Integram database (encrypted)
 * - Dual-layer architecture: in-memory cache + database persistence
 * - Automatic synchronization between cache and database
 * - Session recovery after server restart
 * - Cross-service token sharing via database
 *
 * Architecture:
 * ┌─────────────────┐
 * │  Client Request │
 * └────────┬────────┘
 *          │
 * ┌────────▼──────────────────────┐
 * │ UnifiedAuthServiceWithPersistence │
 * └──┬──────────────────────┬─────┘
 *    │ In-Memory Cache     │ Database Storage
 *    │ (Fast Access)       │ (Durability)
 *    ↓                     ↓
 * ┌──────────┐    ┌──────────────────┐
 * │ Sessions │◀──▶│ DatabaseTokenStorage│
 * │   Map    │    │   (Integram DB)    │
 * └──────────┘    └──────────────────┘
 */

const TokenEncryptionService = require('./TokenEncryptionService');
const DatabaseTokenStorage = require('./DatabaseTokenStorage');

/**
 * Environment variable configuration
 */
const DB_TOKEN_STORAGE_ENABLED = process.env.ENABLE_DB_TOKEN_STORAGE === 'true';
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
const INTEGRAM_BASE_URL = process.env.INTEGRAM_API_URL || 'https://dronedoc.ru';
const DDADMIN_DATABASE = 'ddadmin';
const DDADMIN_ADMIN_LOGIN = process.env.DDADMIN_ADMIN_LOGIN || 'd';
const DDADMIN_ADMIN_PASSWORD = process.env.DDADMIN_ADMIN_PASSWORD || 'd';
const DB_SESSIONS_TABLE_ID = parseInt(process.env.DB_SESSIONS_TABLE_ID || '4002');
const DB_TOKEN_FIELD_ID = parseInt(process.env.DB_TOKEN_FIELD_ID || '4260');
const DB_XSRF_FIELD_ID = parseInt(process.env.DB_XSRF_FIELD_ID || '4259');

/**
 * Enhanced Unified Authentication Service with Database Persistence
 *
 * This class wraps UnifiedAuthService and adds database persistence for sessions.
 * It can work in two modes:
 * 1. With persistence enabled: Sessions are saved to database
 * 2. With persistence disabled: Falls back to in-memory only (like original)
 */
class UnifiedAuthServiceWithPersistence {
  /**
   * Create enhanced auth service
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   * @param {Object} options.baseAuthService - Base UnifiedAuthService instance (injected)
   * @param {boolean} [options.enablePersistence=true] - Enable database persistence
   */
  constructor(options = {}) {
    const {
      logger,
      baseAuthService,
      enablePersistence = DB_TOKEN_STORAGE_ENABLED
    } = options;

    if (!baseAuthService) {
      throw new Error('baseAuthService is required');
    }

    this.logger = logger || console;
    this.baseAuthService = baseAuthService;
    this.enablePersistence = enablePersistence;

    // Initialize database storage if persistence is enabled
    if (this.enablePersistence) {
      this._initializeDatabaseStorage();
    } else {
      this.logger.info('Database token storage disabled (in-memory only)');
      this.storage = null;
    }

    // Reference to base service's sessions Map for cache sync
    this.sessions = baseAuthService.sessions;
  }

  /**
   * Initialize database token storage
   * @private
   */
  _initializeDatabaseStorage() {
    try {
      if (!TOKEN_ENCRYPTION_KEY) {
        throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required for persistence');
      }

      this.storage = new DatabaseTokenStorage({
        serverURL: INTEGRAM_BASE_URL,
        database: DDADMIN_DATABASE,
        adminLogin: DDADMIN_ADMIN_LOGIN,
        adminPassword: DDADMIN_ADMIN_PASSWORD,
        encryptionKey: TOKEN_ENCRYPTION_KEY,
        sessionsTableId: DB_SESSIONS_TABLE_ID,
        tokenFieldId: DB_TOKEN_FIELD_ID,
        xsrfFieldId: DB_XSRF_FIELD_ID
      });

      this.logger.info({
        database: DDADMIN_DATABASE,
        tableId: DB_SESSIONS_TABLE_ID
      }, 'Database token storage initialized');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to initialize database token storage');
      this.enablePersistence = false;
      this.storage = null;
      throw error;
    }
  }

  /**
   * Authenticate and create session (with persistence)
   * Delegates to base service for authentication, then saves to database
   *
   * @param {string} username - Username
   * @param {string} password - Password
   * @param {Object} options - Authentication options (see UnifiedAuthService)
   * @returns {Promise<Object>} Session object
   */
  async authenticateUnified(username, password, options = {}) {
    try {
      // Step 1: Authenticate using base service (in-memory)
      this.logger.info({ username, persistence: this.enablePersistence }, 'Authenticating with persistence support');

      const session = await this.baseAuthService.authenticateUnified(username, password, options);

      // Step 2: If persistence enabled, save to database
      if (this.enablePersistence && this.storage && session.success) {
        try {
          await this._persistSession(session);
          this.logger.info({ sessionId: session.sessionId }, 'Session persisted to database');
        } catch (persistError) {
          this.logger.error({
            sessionId: session.sessionId,
            error: persistError.message
          }, 'Failed to persist session to database (in-memory session still valid)');
          // Don't fail the authentication if persistence fails
          // The in-memory session is still valid
        }
      }

      return session;
    } catch (error) {
      this.logger.error({ username, error: error.message }, 'Authentication failed');
      throw error;
    }
  }

  /**
   * Persist a session to database
   * @param {Object} session - Session object from base auth service
   * @private
   */
  async _persistSession(session) {
    const sessionData = {
      sessionId: session.sessionId,
      username: session.username,
      createdAt: new Date(session.createdAt),
      expiresAt: new Date(session.expiresAt),
      databases: session.databases,
      mfaVerified: session.mfaVerified || false,
      ssoProvider: session.ssoProvider || null
    };

    await this.storage.saveSession(sessionData);
  }

  /**
   * Get session (from cache or database)
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session object or null
   */
  async getSession(sessionId) {
    // Step 1: Try in-memory cache (fast path)
    const cachedSession = this.sessions.get(sessionId);
    if (cachedSession) {
      this.logger.debug({ sessionId }, 'Session found in cache');
      return cachedSession;
    }

    // Step 2: If not in cache and persistence enabled, try database
    if (this.enablePersistence && this.storage) {
      try {
        this.logger.debug({ sessionId }, 'Session not in cache, checking database');
        const dbSession = await this.storage.getSession(sessionId);

        if (dbSession) {
          // Restore session to cache
          this.sessions.set(sessionId, {
            sessionId: dbSession.sessionId,
            username: dbSession.username,
            createdAt: dbSession.createdAt.toISOString(),
            expiresAt: dbSession.expiresAt.toISOString(),
            databases: dbSession.databases,
            mfaVerified: dbSession.mfaVerified,
            ssoProvider: dbSession.ssoProvider
          });

          this.logger.info({ sessionId }, 'Session restored from database to cache');
          return this.sessions.get(sessionId);
        }
      } catch (error) {
        this.logger.error({
          sessionId,
          error: error.message
        }, 'Failed to retrieve session from database');
      }
    }

    return null;
  }

  /**
   * Refresh tokens for a session
   * Delegates to base service and updates database
   *
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Updated session
   */
  async refreshTokens(sessionId) {
    try {
      // Step 1: Refresh using base service
      const updatedSession = await this.baseAuthService.refreshTokens(sessionId);

      // Step 2: Update database if persistence enabled
      if (this.enablePersistence && this.storage && updatedSession) {
        try {
          await this.storage.updateSession(sessionId, {
            expiresAt: new Date(updatedSession.expiresAt),
            databases: updatedSession.databases
          });

          this.logger.info({ sessionId }, 'Session tokens refreshed and persisted');
        } catch (persistError) {
          this.logger.error({
            sessionId,
            error: persistError.message
          }, 'Failed to persist refreshed session');
        }
      }

      return updatedSession;
    } catch (error) {
      this.logger.error({ sessionId, error: error.message }, 'Failed to refresh tokens');
      throw error;
    }
  }

  /**
   * Invalidate a session
   * Removes from cache and database
   *
   * @param {string} sessionId - Session ID to invalidate
   * @returns {Promise<boolean>} True if session was invalidated
   */
  async invalidateSession(sessionId) {
    try {
      // Step 1: Remove from base service (in-memory)
      const removed = this.baseAuthService.invalidateSession(sessionId);

      // Step 2: Remove from database if persistence enabled
      if (this.enablePersistence && this.storage) {
        try {
          await this.storage.deleteSession(sessionId);
          this.logger.info({ sessionId }, 'Session invalidated from database');
        } catch (dbError) {
          this.logger.error({
            sessionId,
            error: dbError.message
          }, 'Failed to delete session from database');
        }
      }

      return removed;
    } catch (error) {
      this.logger.error({ sessionId, error: error.message }, 'Failed to invalidate session');
      throw error;
    }
  }

  /**
   * Clean up expired sessions (from cache and database)
   * @returns {Promise<number>} Number of sessions cleaned up
   */
  async cleanupExpiredSessions() {
    try {
      // Step 1: Cleanup in-memory sessions (base service)
      const cacheCleanedCount = this.baseAuthService.cleanupExpiredSessions();

      // Step 2: Cleanup database sessions if persistence enabled
      let dbCleanedCount = 0;
      if (this.enablePersistence && this.storage) {
        try {
          dbCleanedCount = await this.storage.cleanupExpiredSessions();
          this.logger.info({
            cacheCleanedCount,
            dbCleanedCount
          }, 'Expired sessions cleaned up');
        } catch (dbError) {
          this.logger.error({
            error: dbError.message
          }, 'Failed to cleanup expired sessions from database');
        }
      }

      return cacheCleanedCount + dbCleanedCount;
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to cleanup expired sessions');
      return 0;
    }
  }

  /**
   * Get all sessions for a user (from database)
   * @param {string} username - Username
   * @returns {Promise<Array>} Array of user sessions
   */
  async getUserSessions(username) {
    if (!this.enablePersistence || !this.storage) {
      // Fall back to in-memory sessions
      const sessions = [];
      for (const session of this.sessions.values()) {
        if (session.username === username) {
          sessions.push(session);
        }
      }
      return sessions;
    }

    try {
      return await this.storage.getUserSessions(username);
    } catch (error) {
      this.logger.error({ username, error: error.message }, 'Failed to get user sessions');
      return [];
    }
  }

  /**
   * Get session statistics
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStats() {
    const stats = {
      cacheSessions: this.sessions.size,
      dbSessions: 0,
      persistenceEnabled: this.enablePersistence
    };

    if (this.enablePersistence && this.storage) {
      try {
        const dbStats = await this.storage.getStats();
        stats.dbSessions = dbStats.activeSessions;
        stats.dbTotalSessions = dbStats.totalSessions;
        stats.dbExpiredSessions = dbStats.expiredSessions;
      } catch (error) {
        this.logger.error({ error: error.message }, 'Failed to get database stats');
      }
    }

    return stats;
  }

  /**
   * Delegate all other methods to base service
   * This allows the enhanced service to be a drop-in replacement
   */

  // SSO methods
  registerSSOProvider(...args) {
    return this.baseAuthService.registerSSOProvider(...args);
  }

  validateSSOToken(...args) {
    return this.baseAuthService.validateSSOToken(...args);
  }

  // MFA methods
  enableMFA(...args) {
    return this.baseAuthService.enableMFA(...args);
  }

  generateMFAChallenge(...args) {
    return this.baseAuthService.generateMFAChallenge(...args);
  }

  verifyMFAChallenge(...args) {
    return this.baseAuthService.verifyMFAChallenge(...args);
  }

  // Monitoring methods
  trackSessionActivity(...args) {
    return this.baseAuthService.trackSessionActivity(...args);
  }

  getSessionActivity(...args) {
    return this.baseAuthService.getSessionActivity(...args);
  }

  getAllSessionActivities(...args) {
    return this.baseAuthService.getAllSessionActivities(...args);
  }

  // Utility methods
  logSessionStatistics(...args) {
    return this.baseAuthService.logSessionStatistics(...args);
  }

  shutdown() {
    this.baseAuthService.shutdown();
    this.logger.info('UnifiedAuthServiceWithPersistence shut down');
  }
}

module.exports = UnifiedAuthServiceWithPersistence;
