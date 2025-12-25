/**
 * Database Token Storage Service
 *
 * Provides persistent storage for database tokens in Integram ddadmin database.
 * Uses Integram MCP for database operations and TokenEncryptionService for encryption.
 * Part of Issue #3631: Database Token Storage System
 *
 * @module DatabaseTokenStorage
 */

const TokenEncryptionService = require('./TokenEncryptionService');
const IntegramMCPClient = require('../mcp/IntegramMCPClient');

/**
 * Storage service for persisting encrypted database tokens in Integram
 */
class DatabaseTokenStorage {
  /**
   * Create a new DatabaseTokenStorage service
   * @param {Object} options - Configuration options
   * @param {string} options.serverURL - Integram server URL (e.g., https://dronedoc.ru)
   * @param {string} options.database - Integram database name (e.g., ddadmin)
   * @param {string} options.adminLogin - Admin login for Integram
   * @param {string} options.adminPassword - Admin password for Integram
   * @param {string} options.encryptionKey - Master encryption key (256-bit hex)
   * @param {number} [options.sessionsTableId=4002] - Type ID for sessions table
   * @param {number} [options.tokenFieldId=4260] - Field ID for token storage
   * @param {number} [options.xsrfFieldId=4259] - Field ID for XSRF token storage
   */
  constructor(options = {}) {
    const {
      serverURL,
      database,
      adminLogin,
      adminPassword,
      encryptionKey,
      sessionsTableId = 4002,
      tokenFieldId = 4260,
      xsrfFieldId = 4259
    } = options;

    // Validate required options
    if (!serverURL || !database || !adminLogin || !adminPassword || !encryptionKey) {
      throw new Error(
        'Missing required configuration: serverURL, database, adminLogin, adminPassword, encryptionKey'
      );
    }

    this.serverURL = serverURL;
    this.database = database;
    this.adminLogin = adminLogin;
    this.adminPassword = adminPassword;
    this.sessionsTableId = sessionsTableId;
    this.tokenFieldId = tokenFieldId;
    this.xsrfFieldId = xsrfFieldId;

    // Initialize encryption service
    this.encryptionService = new TokenEncryptionService({ masterKey: encryptionKey });

    // Initialize MCP client (lazy initialization)
    this.mcpClient = null;
    this.authenticated = false;
  }

  /**
   * Initialize MCP client and authenticate
   * @private
   */
  async _ensureAuthenticated() {
    if (this.authenticated && this.mcpClient) {
      return;
    }

    // Create MCP client if not exists
    if (!this.mcpClient) {
      this.mcpClient = new IntegramMCPClient({
        serverURL: this.serverURL,
        database: this.database
      });
    }

    // Authenticate
    try {
      await this.mcpClient.authenticate(this.adminLogin, this.adminPassword);
      this.authenticated = true;
    } catch (error) {
      throw new Error(`Failed to authenticate with Integram: ${error.message}`);
    }
  }

  /**
   * Save a database session with encrypted tokens
   * @param {Object} sessionData - Session data to save
   * @param {string} sessionData.sessionId - Unique session ID (UUID)
   * @param {string} sessionData.username - Username
   * @param {Date} sessionData.createdAt - Session creation timestamp
   * @param {Date} sessionData.expiresAt - Session expiration timestamp
   * @param {Object} sessionData.databases - Database tokens (key: dbName, value: tokenData)
   * @param {boolean} [sessionData.mfaVerified=false] - MFA verification status
   * @param {string} [sessionData.ssoProvider=null] - SSO provider name
   * @returns {Promise<Object>} Created session object
   */
  async saveSession(sessionData) {
    await this._ensureAuthenticated();

    const {
      sessionId,
      username,
      createdAt,
      expiresAt,
      databases,
      mfaVerified = false,
      ssoProvider = null
    } = sessionData;

    // Validate required fields
    if (!sessionId || !username || !createdAt || !expiresAt || !databases) {
      throw new Error(
        'Missing required session data: sessionId, username, createdAt, expiresAt, databases'
      );
    }

    try {
      // Encrypt all database tokens
      const encryptedDatabases = {};
      for (const [dbName, dbData] of Object.entries(databases)) {
        encryptedDatabases[dbName] = {
          ...dbData,
          token: this.encryptionService.encrypt(dbData.token),
          xsrf: dbData.xsrf ? this.encryptionService.encrypt(dbData.xsrf) : null
        };
      }

      // Create session object in Integram
      // Use sessionId as object value (name)
      const sessionObject = await this.mcpClient.createObject({
        typeId: this.sessionsTableId,
        value: sessionId,
        requisites: {
          // Store encrypted databases as JSON string in token field
          [this.tokenFieldId]: JSON.stringify({
            username,
            createdAt: createdAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            databases: encryptedDatabases,
            mfaVerified,
            ssoProvider
          })
        }
      });

      return {
        sessionId,
        objectId: sessionObject.id,
        createdAt,
        expiresAt
      };
    } catch (error) {
      throw new Error(`Failed to save session: ${error.message}`);
    }
  }

  /**
   * Retrieve a session by session ID
   * @param {string} sessionId - Session ID to retrieve
   * @returns {Promise<Object|null>} Session data or null if not found
   */
  async getSession(sessionId) {
    await this._ensureAuthenticated();

    try {
      // Search for session object by value (sessionId)
      const objects = await this.mcpClient.getObjectList({
        typeId: this.sessionsTableId,
        params: { offset: 0, limit: 1000 }
      });

      // Find session by sessionId (stored in object value)
      const sessionObject = objects.find(obj => obj.value === sessionId);

      if (!sessionObject) {
        return null;
      }

      // Get full object data
      const objectData = await this.mcpClient.getObjectEditData(sessionObject.id);

      // Parse session data from token field
      const sessionDataStr = objectData.requisites[this.tokenFieldId];
      if (!sessionDataStr) {
        return null;
      }

      const sessionData = JSON.parse(sessionDataStr);

      // Decrypt all database tokens
      const decryptedDatabases = {};
      for (const [dbName, dbData] of Object.entries(sessionData.databases)) {
        decryptedDatabases[dbName] = {
          ...dbData,
          token: this.encryptionService.decrypt(dbData.token),
          xsrf: dbData.xsrf ? this.encryptionService.decrypt(dbData.xsrf) : null
        };
      }

      return {
        sessionId,
        objectId: sessionObject.id,
        username: sessionData.username,
        createdAt: new Date(sessionData.createdAt),
        expiresAt: new Date(sessionData.expiresAt),
        databases: decryptedDatabases,
        mfaVerified: sessionData.mfaVerified || false,
        ssoProvider: sessionData.ssoProvider || null
      };
    } catch (error) {
      throw new Error(`Failed to retrieve session: ${error.message}`);
    }
  }

  /**
   * Update a session (refresh expiration, add new databases, etc.)
   * @param {string} sessionId - Session ID to update
   * @param {Object} updates - Updates to apply
   * @param {Date} [updates.expiresAt] - New expiration timestamp
   * @param {Object} [updates.databases] - Additional/updated databases
   * @returns {Promise<Object>} Updated session data
   */
  async updateSession(sessionId, updates) {
    await this._ensureAuthenticated();

    try {
      // Get existing session
      const existingSession = await this.getSession(sessionId);
      if (!existingSession) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Merge updates
      const updatedData = {
        username: existingSession.username,
        createdAt: existingSession.createdAt,
        expiresAt: updates.expiresAt || existingSession.expiresAt,
        databases: {
          ...existingSession.databases,
          ...(updates.databases || {})
        },
        mfaVerified: existingSession.mfaVerified,
        ssoProvider: existingSession.ssoProvider
      };

      // Encrypt all database tokens
      const encryptedDatabases = {};
      for (const [dbName, dbData] of Object.entries(updatedData.databases)) {
        // Check if already encrypted (from existing session)
        const isAlreadyEncrypted = TokenEncryptionService.isValidEncryptedToken(dbData.token);

        encryptedDatabases[dbName] = {
          ...dbData,
          token: isAlreadyEncrypted ? dbData.token : this.encryptionService.encrypt(dbData.token),
          xsrf: dbData.xsrf
            ? isAlreadyEncrypted && TokenEncryptionService.isValidEncryptedToken(dbData.xsrf)
              ? dbData.xsrf
              : this.encryptionService.encrypt(dbData.xsrf)
            : null
        };
      }

      // Update object in Integram
      await this.mcpClient.setObjectRequisites({
        objectId: existingSession.objectId,
        requisites: {
          [this.tokenFieldId]: JSON.stringify({
            username: updatedData.username,
            createdAt: updatedData.createdAt.toISOString(),
            expiresAt: updatedData.expiresAt.toISOString(),
            databases: encryptedDatabases,
            mfaVerified: updatedData.mfaVerified,
            ssoProvider: updatedData.ssoProvider
          })
        }
      });

      return {
        sessionId,
        objectId: existingSession.objectId,
        ...updatedData
      };
    } catch (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session ID to delete
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteSession(sessionId) {
    await this._ensureAuthenticated();

    try {
      // Get session to find object ID
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      // Delete object from Integram
      await this.mcpClient.deleteObject(session.objectId);

      return true;
    } catch (error) {
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} Number of sessions deleted
   */
  async cleanupExpiredSessions() {
    await this._ensureAuthenticated();

    try {
      // Get all sessions
      const objects = await this.mcpClient.getObjectList({
        typeId: this.sessionsTableId,
        params: { offset: 0, limit: 10000 }
      });

      let deletedCount = 0;
      const now = new Date();

      for (const obj of objects) {
        try {
          // Get object data
          const objectData = await this.mcpClient.getObjectEditData(obj.id);
          const sessionDataStr = objectData.requisites[this.tokenFieldId];

          if (!sessionDataStr) continue;

          const sessionData = JSON.parse(sessionDataStr);
          const expiresAt = new Date(sessionData.expiresAt);

          // Delete if expired
          if (expiresAt < now) {
            await this.mcpClient.deleteObject(obj.id);
            deletedCount++;
          }
        } catch (err) {
          // Skip invalid sessions
          console.error(`Error processing session ${obj.id}:`, err.message);
        }
      }

      return deletedCount;
    } catch (error) {
      throw new Error(`Failed to cleanup expired sessions: ${error.message}`);
    }
  }

  /**
   * Get all active sessions for a user
   * @param {string} username - Username to search for
   * @returns {Promise<Array>} Array of active sessions
   */
  async getUserSessions(username) {
    await this._ensureAuthenticated();

    try {
      // Get all sessions
      const objects = await this.mcpClient.getObjectList({
        typeId: this.sessionsTableId,
        params: { offset: 0, limit: 10000 }
      });

      const userSessions = [];
      const now = new Date();

      for (const obj of objects) {
        try {
          // Get object data
          const objectData = await this.mcpClient.getObjectEditData(obj.id);
          const sessionDataStr = objectData.requisites[this.tokenFieldId];

          if (!sessionDataStr) continue;

          const sessionData = JSON.parse(sessionDataStr);

          // Check if matches username and not expired
          if (
            sessionData.username === username &&
            new Date(sessionData.expiresAt) > now
          ) {
            // Decrypt database tokens
            const decryptedDatabases = {};
            for (const [dbName, dbData] of Object.entries(sessionData.databases)) {
              decryptedDatabases[dbName] = {
                ...dbData,
                token: this.encryptionService.decrypt(dbData.token),
                xsrf: dbData.xsrf ? this.encryptionService.decrypt(dbData.xsrf) : null
              };
            }

            userSessions.push({
              sessionId: obj.value,
              objectId: obj.id,
              username: sessionData.username,
              createdAt: new Date(sessionData.createdAt),
              expiresAt: new Date(sessionData.expiresAt),
              databases: decryptedDatabases,
              mfaVerified: sessionData.mfaVerified || false,
              ssoProvider: sessionData.ssoProvider || null
            });
          }
        } catch (err) {
          // Skip invalid sessions
          console.error(`Error processing session ${obj.id}:`, err.message);
        }
      }

      return userSessions;
    } catch (error) {
      throw new Error(`Failed to get user sessions: ${error.message}`);
    }
  }

  /**
   * Get statistics about stored sessions
   * @returns {Promise<Object>} Session statistics
   */
  async getStats() {
    await this._ensureAuthenticated();

    try {
      const objects = await this.mcpClient.getObjectList({
        typeId: this.sessionsTableId,
        params: { offset: 0, limit: 10000 }
      });

      const now = new Date();
      let totalSessions = 0;
      let activeSessions = 0;
      let expiredSessions = 0;

      for (const obj of objects) {
        try {
          const objectData = await this.mcpClient.getObjectEditData(obj.id);
          const sessionDataStr = objectData.requisites[this.tokenFieldId];

          if (!sessionDataStr) continue;

          const sessionData = JSON.parse(sessionDataStr);
          const expiresAt = new Date(sessionData.expiresAt);

          totalSessions++;
          if (expiresAt > now) {
            activeSessions++;
          } else {
            expiredSessions++;
          }
        } catch (err) {
          // Skip invalid sessions
        }
      }

      return {
        totalSessions,
        activeSessions,
        expiredSessions,
        tableId: this.sessionsTableId,
        database: this.database
      };
    } catch (error) {
      throw new Error(`Failed to get session stats: ${error.message}`);
    }
  }
}

module.exports = DatabaseTokenStorage;
