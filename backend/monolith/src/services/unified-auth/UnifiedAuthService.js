/**
 * Unified Authentication Service
 *
 * Issue #3554: Single authentication point for all databases
 * Issue #3556: Enhanced authentication with auto-renewal, SSO, MFA, and monitoring
 *
 * This service provides unified authentication across multiple Integram databases.
 * When a user authenticates with one set of credentials (from ddadmin), the service
 * automatically authenticates them in all other databases where they have a User record (table 18).
 *
 * Features:
 * - Authenticate once, get tokens for all databases
 * - Centralized session management
 * - Token refresh and expiration handling
 * - Organization-based database discovery
 * - Automatic sync of credentials across databases
 * - Automatic token renewal before expiration (Issue #3556)
 * - Extended database discovery capabilities (Issue #3556)
 * - Single Sign-On (SSO) integration (Issue #3556)
 * - Multi-Factor Authentication (MFA) support (Issue #3556)
 * - Real-time session monitoring (Issue #3556)
 *
 * Architecture:
 * 1. User logs in with ddadmin credentials (with optional MFA)
 * 2. System retrieves user's organization data from report 4064
 * 3. System identifies all databases where user exists (table 18)
 * 4. System authenticates in each database sequentially
 * 5. Returns unified session with all tokens
 * 6. Automatically renews tokens before expiration
 * 7. Monitors session activity in real-time
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import logger from '../../utils/logger.js';

const INTEGRAM_BASE_URL = process.env.INTEGRAM_API_URL || 'https://dronedoc.ru';
const PRIMARY_DATABASE = 'my'; // Default database - unified auth entry point (issue #3691)
const DDADMIN_DATABASE = 'ddadmin'; // Legacy database reference
const USERS_TABLE_ID = '18'; // Table ID for Users in all databases
const ORG_REPORT_ID = '4064'; // Report ID for organization databases (Issue #3554)
const TOKEN_RENEWAL_THRESHOLD = 2 * 60 * 60 * 1000; // Renew tokens 2 hours before expiration
const SESSION_ACTIVITY_INTERVAL = 60 * 1000; // Log session activity every minute

/**
 * Unified Authentication Service
 */
export class UnifiedAuthService {
  constructor({ logger: customLogger } = {}) {
    this.logger = customLogger || logger;
    this.baseUrl = INTEGRAM_BASE_URL;

    // Cache for active sessions
    // In production, use Redis or database
    this.sessions = new Map();

    // Primary database for authentication (always required)
    // All other databases are discovered dynamically from report 4064
    // Issue #3691: Changed from ddadmin to my as unified auth entry point
    this.primaryDatabase = PRIMARY_DATABASE;

    // MFA challenges storage (temporary, before session creation)
    this.mfaChallenges = new Map();

    // SSO provider configurations
    this.ssoProviders = new Map();

    // Session activity tracking
    this.sessionActivity = new Map();

    // Auto-renewal timer references
    this.renewalTimers = new Map();

    // Start periodic cleanup and monitoring
    this.startPeriodicTasks();
  }

  /**
   * Build Integram API URL
   * @param {string} database - Database name
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {string} Complete URL
   */
  buildUrl(database, endpoint, params = {}) {
    let url = `${this.baseUrl}/${database}/${endpoint}`;

    // Add JSON_KV for JSON API mode
    const queryParams = new URLSearchParams({ JSON_KV: '', ...params });
    url += `?${queryParams.toString()}`;

    return url;
  }

  /**
   * Authenticate in a single database
   * @param {string} database - Database name
   * @param {string} username - Username/login
   * @param {string} password - Password
   * @returns {Promise<Object>} Authentication result with token
   */
  async authenticateInDatabase(database, username, password) {
    try {
      const url = this.buildUrl(database, 'auth');

      this.logger.info({ database, username }, 'Authenticating in database');

      const formData = new URLSearchParams();
      formData.append('login', username);
      formData.append('pwd', password);

      const response = await axios.post(url, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (response.data.failed) {
        throw new Error('Invalid credentials');
      }

      // Get session info with XSRF token
      const xsrfUrl = this.buildUrl(database, 'xsrf');
      const sessionResponse = await axios.get(xsrfUrl, {
        headers: { 'X-Authorization': response.data.token }
      });

      const authData = {
        database,
        token: sessionResponse.data.token,
        xsrf: sessionResponse.data._xsrf,
        userId: sessionResponse.data.id,
        userName: sessionResponse.data.user,
        userRole: sessionResponse.data.role,
        authenticatedAt: new Date().toISOString()
      };

      this.logger.info({ database, userId: authData.userId }, 'Successfully authenticated in database');

      return {
        success: true,
        ...authData
      };
    } catch (error) {
      this.logger.error({ database, error: error.message }, 'Failed to authenticate in database');

      return {
        success: false,
        database,
        error: error.message
      };
    }
  }

  /**
   * Get user's organization data from report 4064
   * @param {string} token - Authenticated token for primary database
   * @param {string} username - Username to filter by
   * @returns {Promise<Object>} Organization data
   */
  async getUserOrganizationData(token, username) {
    try {
      const url = this.buildUrl(this.primaryDatabase, `report/${ORG_REPORT_ID}`);

      this.logger.info({ username }, 'Fetching organization data');

      const response = await axios.get(url, {
        headers: { 'X-Authorization': token }
      });

      let reportData = response.data;

      // Handle MCP response format: { content: [{ type: "text", text: "JSON string" }] }
      // Issue #3558 audit: Report 4064 returns MCP-formatted response when accessed via MCP bridge
      if (reportData && reportData.content && Array.isArray(reportData.content) && reportData.content.length > 0) {
        try {
          const textContent = reportData.content[0].text;
          reportData = JSON.parse(textContent);
          this.logger.debug('Parsed MCP-formatted report 4064 response');
        } catch (parseError) {
          this.logger.warn({ error: parseError.message }, 'Failed to parse MCP-formatted response, falling back to direct data');
        }
      }

      // Filter data by username
      const userData = Array.isArray(reportData) ? reportData.find(row => row['Пользователь в базе ddadmin'] === username) : null;

      if (!userData) {
        this.logger.warn({ username }, 'User not found in organization data');
        return null;
      }

      this.logger.info({ username, organization: userData['Организация'] }, 'Organization data retrieved');

      return userData;
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to fetch organization data');
      return null;
    }
  }

  /**
   * Discover all databases from report 4064 dynamically
   * Report 4064 contains all organizations and databases where user has access
   * @param {string} token - Authenticated primary database token
   * @returns {Promise<Array<Object>>} List of database configurations with full metadata
   */
  async discoverDatabasesFromReport4064(token) {
    try {
      const url = this.buildUrl(this.primaryDatabase, `report/${ORG_REPORT_ID}`);

      this.logger.info('Fetching databases from report 4064');

      const response = await axios.get(url, {
        headers: { 'X-Authorization': token }
      });

      const databasesMap = new Map(); // Use Map to deduplicate by database name

      // Parse report 4064 response
      // Fields: Организация, ОрганизацияID, Участник организации, Хранилище данных организации,
      //         Имя базы организации, Домен, Пользователь в базе ddadmin, ПользовательID

      let reportData = response.data;

      // Handle MCP response format: { content: [{ type: "text", text: "JSON string" }] }
      // Issue #3558 audit: Report 4064 returns MCP-formatted response when accessed via MCP bridge
      if (reportData && reportData.content && Array.isArray(reportData.content) && reportData.content.length > 0) {
        try {
          const textContent = reportData.content[0].text;
          reportData = JSON.parse(textContent);
          this.logger.debug('Parsed MCP-formatted report 4064 response');
        } catch (parseError) {
          this.logger.warn({ error: parseError.message }, 'Failed to parse MCP-formatted response, falling back to direct data');
        }
      }

      if (reportData && Array.isArray(reportData)) {
        for (const row of reportData) {
          const dbName = row['Имя базы организации'];
          const domain = row['Домен'];

          // Skip empty database names or empty domains
          if (!dbName || !domain) {
            continue;
          }

          // Deduplicate by database name, keep first occurrence
          if (!databasesMap.has(dbName)) {
            databasesMap.set(dbName, {
              name: dbName,
              domain: domain,
              organization: row['Организация'],
              organizationId: row['ОрганизацияID'],
              storage: row['Хранилище данных организации'],
              userId: row['ПользовательID в базе ddadmin']
            });
          }
        }
      }

      const databases = Array.from(databasesMap.values());
      this.logger.info({
        count: databases.length,
        databases: databases.map(d => d.name)
      }, 'Discovered databases from report 4064');

      return databases;
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to discover databases from report 4064');
      return [];
    }
  }

  /**
   * Unified authentication across all databases
   * Dynamically discovers databases from report 4064 and authenticates in all of them
   *
   * Flow:
   * 1. Authenticate in primary database (unified auth entry point)
   * 2. Fetch report 4064 from primary database to get all databases where user has access
   * 3. Authenticate in each database from the report
   * 4. Return unified session with all tokens for immediate use
   *
   * @param {string} username - Username/login
   * @param {string} password - Password
   * @param {Object} options - Authentication options
   * @param {string} options.mfaCode - MFA verification code (if MFA is enabled)
   * @param {string} options.ssoProvider - SSO provider name (if using SSO)
   * @param {string} options.ssoToken - SSO access token (if using SSO)
   * @param {Array<string>} options.databases - Override: specific databases to authenticate (optional)
   * @returns {Promise<Object>} Unified session with all tokens
   */
  async authenticateUnified(username, password, options = {}) {
    const sessionId = uuidv4();
    const startTime = Date.now();

    try {
      this.logger.info({ username, sessionId, sso: !!options.ssoProvider, mfa: !!options.mfaCode }, 'Starting unified authentication');

      // SSO authentication path (Issue #3556)
      if (options.ssoProvider && options.ssoToken) {
        return await this.authenticateWithSSO(sessionId, options.ssoProvider, options.ssoToken, options);
      }

      // Step 1: Authenticate in primary database (unified auth entry point) - ALWAYS REQUIRED
      this.logger.info({ username, database: this.primaryDatabase }, 'Step 1: Authenticating in primary database');
      const primaryAuth = await this.authenticateInDatabase(this.primaryDatabase, username, password);

      if (!primaryAuth.success) {
        throw new Error(`Authentication failed in ${this.primaryDatabase}: ${primaryAuth.error}`);
      }

      // Step 1.5: MFA verification (Issue #3556)
      const mfaEnabled = await this.isMFAEnabled(username, primaryAuth.token);
      if (mfaEnabled) {
        if (!options.mfaCode) {
          const challenge = await this.generateMFAChallenge(username, sessionId);
          return {
            success: false,
            requiresMFA: true,
            challengeId: challenge.id,
            message: 'MFA verification required. Check your authenticator app or email.'
          };
        }

        const mfaValid = await this.verifyMFACode(username, options.mfaCode);
        if (!mfaValid) {
          throw new Error('Invalid MFA code');
        }

        this.logger.info({ username, sessionId }, 'MFA verification successful');
      }

      // Step 2: Discover ALL databases from report 4064 dynamically
      this.logger.info({ username }, 'Step 2: Discovering databases from report 4064');
      let databaseConfigs = [];

      if (options.databases) {
        // Manual override: use specified databases
        databaseConfigs = options.databases.map(name => ({ name, domain: this.baseUrl }));
      } else {
        // Dynamic discovery from report 4064
        databaseConfigs = await this.discoverDatabasesFromReport4064(primaryAuth.token);
      }

      // Step 3: Authenticate in ALL discovered databases
      this.logger.info({
        username,
        databaseCount: databaseConfigs.length,
        databases: databaseConfigs.map(d => d.name)
      }, 'Step 3: Authenticating in all discovered databases');

      const authResults = [primaryAuth]; // Primary database is already authenticated

      for (const dbConfig of databaseConfigs) {
        // Skip primary database as we already authenticated
        if (dbConfig.name === this.primaryDatabase) {
          continue;
        }

        this.logger.debug({ database: dbConfig.name, domain: dbConfig.domain }, 'Authenticating in database');

        // TODO: Support different domains per database (currently using base URL)
        const result = await this.authenticateInDatabase(dbConfig.name, username, password);
        authResults.push({
          ...result,
          domain: dbConfig.domain,
          organization: dbConfig.organization,
          storage: dbConfig.storage
        });
      }

      // Step 4: Separate successful and failed authentications
      const successfulAuths = authResults.filter(r => r.success);
      const failedAuths = authResults.filter(r => !r.success);

      // Step 5: Create unified session with all tokens
      const session = {
        sessionId,
        username,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        mfaVerified: mfaEnabled,
        ssoProvider: options.ssoProvider || null,

        // All authenticated databases with their tokens
        databases: successfulAuths.map(auth => ({
          database: auth.database,
          domain: auth.domain || this.baseUrl,
          organization: auth.organization || null,
          storage: auth.storage || null,
          token: auth.token,
          xsrf: auth.xsrf,
          userId: auth.userId,
          userName: auth.userName,
          userRole: auth.userRole,
          authenticatedAt: auth.authenticatedAt,
          tokenExpiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString()
        })),

        // Failed databases (for debugging/retry)
        failedDatabases: failedAuths.map(auth => ({
          database: auth.database,
          error: auth.error
        })),

        // Metadata
        metadata: {
          totalDiscovered: databaseConfigs.length,
          totalAuthenticated: successfulAuths.length,
          totalFailed: failedAuths.length,
          authTimeMs: Date.now() - startTime,
          discoverySource: options.databases ? 'manual' : 'report_4064'
        }
      };

      // Store session in cache
      this.sessions.set(sessionId, session);

      // Start automatic token renewal (Issue #3556)
      this.scheduleTokenRenewal(sessionId, username, password);

      // Initialize session activity tracking (Issue #3556)
      this.initializeSessionMonitoring(sessionId);

      this.logger.info({
        sessionId,
        username,
        databases: session.databases.map(d => d.database),
        successfulAuths: successfulAuths.length,
        failedAuths: failedAuths.length,
        authTimeMs: session.metadata.authTimeMs,
        mfaVerified: mfaEnabled
      }, 'Unified authentication completed - all databases authenticated');

      return {
        success: true,
        session
      };
    } catch (error) {
      this.logger.error({ error: error.message, username }, 'Unified authentication failed');

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Session data or null
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Get token for specific database from session
   * @param {string} sessionId - Session identifier
   * @param {string} database - Database name
   * @returns {Promise<Object|null>} Database auth data or null
   */
  async getTokenForDatabase(sessionId, database) {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const dbAuth = session.databases.find(db => db.database === database);
    return dbAuth || null;
  }

  /**
   * Get 'my' database token from session (Issue #3811)
   * This token can be used for cross-database access via 'my:' header
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object|null>} My database auth data or null
   */
  async getMyDatabaseToken(sessionId) {
    const session = await this.getSession(sessionId);

    if (!session) {
      this.logger.warn({ sessionId }, 'Session not found when getting my database token');
      return null;
    }

    // Find 'my' database token in session
    const myDbAuth = session.databases.find(db => db.database === 'my');

    if (!myDbAuth) {
      this.logger.warn({ sessionId }, 'My database token not found in session');
      return null;
    }

    this.logger.info({ sessionId, userId: myDbAuth.userId }, 'Retrieved my database token');

    return {
      token: myDbAuth.token,
      xsrf: myDbAuth.xsrf,
      userId: myDbAuth.userId,
      userName: myDbAuth.userName,
      userRole: myDbAuth.userRole,
      authenticatedAt: myDbAuth.authenticatedAt,
      database: 'my'
    };
  }

  /**
   * Get all tokens from session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} Map of database → token
   */
  async getAllTokens(sessionId) {
    const session = await this.getSession(sessionId);

    if (!session) {
      return {};
    }

    const tokens = {};
    for (const dbAuth of session.databases) {
      tokens[dbAuth.database] = {
        token: dbAuth.token,
        xsrf: dbAuth.xsrf,
        userId: dbAuth.userId
      };
    }

    return tokens;
  }

  /**
   * Refresh authentication for a specific database
   * @param {string} sessionId - Session identifier
   * @param {string} database - Database to refresh
   * @param {string} password - User's password
   * @returns {Promise<Object>} Refresh result
   */
  async refreshDatabaseAuth(sessionId, database, password) {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new Error('Session not found or expired');
    }

    this.logger.info({ sessionId, database }, 'Refreshing database authentication');

    const result = await this.authenticateInDatabase(database, session.username, password);

    if (result.success) {
      // Update session with new token
      const dbIndex = session.databases.findIndex(db => db.database === database);

      if (dbIndex >= 0) {
        session.databases[dbIndex] = {
          database: result.database,
          token: result.token,
          xsrf: result.xsrf,
          userId: result.userId,
          userName: result.userName,
          userRole: result.userRole,
          authenticatedAt: result.authenticatedAt
        };
      } else {
        session.databases.push({
          database: result.database,
          token: result.token,
          xsrf: result.xsrf,
          userId: result.userId,
          userName: result.userName,
          userRole: result.userRole,
          authenticatedAt: result.authenticatedAt
        });
      }

      this.logger.info({ sessionId, database }, 'Database authentication refreshed');
    }

    return result;
  }

  /**
   * Invalidate session (logout)
   * @param {string} sessionId - Session identifier
   */
  invalidateSession(sessionId) {
    this.sessions.delete(sessionId);
    this.logger.info({ sessionId }, 'Session invalidated');
  }

  /**
   * Get active session count
   * @returns {number} Number of active sessions
   */
  getActiveSessionCount() {
    return this.sessions.size;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = new Date();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (new Date(session.expiresAt) < now) {
        this.sessions.delete(sessionId);
        this.cancelTokenRenewal(sessionId);
        this.stopSessionMonitoring(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.info({ cleaned }, 'Cleaned up expired sessions');
    }

    return cleaned;
  }

  // ========== Issue #3556: Automatic Token Renewal ==========

  /**
   * Schedule automatic token renewal before expiration (Issue #3556)
   * @param {string} sessionId - Session identifier
   * @param {string} username - Username for re-authentication
   * @param {string} password - Password for re-authentication
   */
  async scheduleTokenRenewal(sessionId, username, password) {
    const session = await this.getSession(sessionId);
    if (!session) return;

    // Calculate when to renew (2 hours before expiration)
    const renewAt = new Date(session.expiresAt).getTime() - TOKEN_RENEWAL_THRESHOLD;
    const now = Date.now();
    const delay = renewAt - now;

    if (delay > 0) {
      const timer = setTimeout(async () => {
        try {
          this.logger.info({ sessionId }, 'Auto-renewing tokens before expiration');
          await this.renewAllTokens(sessionId, username, password);
        } catch (error) {
          this.logger.error({ sessionId, error: error.message }, 'Failed to auto-renew tokens');
        }
      }, delay);

      this.renewalTimers.set(sessionId, timer);
      this.logger.info({ sessionId, renewAt: new Date(renewAt).toISOString() }, 'Token renewal scheduled');
    }
  }

  /**
   * Cancel token renewal timer
   * @param {string} sessionId - Session identifier
   */
  cancelTokenRenewal(sessionId) {
    const timer = this.renewalTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.renewalTimers.delete(sessionId);
      this.logger.debug({ sessionId }, 'Token renewal timer cancelled');
    }
  }

  /**
   * Renew all tokens in a session (Issue #3556)
   * @param {string} sessionId - Session identifier
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<Object>} Renewal result
   */
  async renewAllTokens(sessionId, username, password) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    this.logger.info({ sessionId }, 'Renewing all tokens in session');

    const renewalResults = [];
    let successCount = 0;
    let failureCount = 0;

    for (const dbAuth of session.databases) {
      try {
        const result = await this.authenticateInDatabase(dbAuth.database, username, password);

        if (result.success) {
          // Update token in session
          dbAuth.token = result.token;
          dbAuth.xsrf = result.xsrf;
          dbAuth.authenticatedAt = result.authenticatedAt;
          dbAuth.tokenExpiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
          successCount++;
        } else {
          failureCount++;
        }

        renewalResults.push({
          database: dbAuth.database,
          success: result.success,
          error: result.error || null
        });
      } catch (error) {
        failureCount++;
        renewalResults.push({
          database: dbAuth.database,
          success: false,
          error: error.message
        });
      }
    }

    // Extend session expiration
    session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Reschedule next renewal
    this.scheduleTokenRenewal(sessionId, username, password);

    this.logger.info({
      sessionId,
      successCount,
      failureCount,
      total: session.databases.length
    }, 'Token renewal completed');

    return {
      success: true,
      renewalResults,
      successCount,
      failureCount
    };
  }

  // ========== Issue #3556: Multi-Factor Authentication ==========

  /**
   * Check if MFA is enabled for user (Issue #3556)
   * @param {string} username - Username
   * @param {string} token - Authenticated token
   * @returns {Promise<boolean>} True if MFA is enabled
   */
  async isMFAEnabled(username, token) {
    try {
      // Query user settings to check if MFA is enabled
      // This would query a user preferences table or similar
      // For now, return false as a placeholder
      return false;
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to check MFA status');
      return false;
    }
  }

  /**
   * Generate MFA challenge (Issue #3556)
   * @param {string} username - Username
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object>} MFA challenge
   */
  async generateMFAChallenge(username, sessionId) {
    const challengeId = uuidv4();
    const code = crypto.randomInt(100000, 999999).toString(); // 6-digit code

    const challenge = {
      id: challengeId,
      username,
      sessionId,
      code,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      attempts: 0,
      maxAttempts: 3
    };

    this.mfaChallenges.set(challengeId, challenge);

    // TODO: Send code via email or SMS
    this.logger.info({ username, challengeId, code }, 'MFA challenge generated');

    return challenge;
  }

  /**
   * Verify MFA code (Issue #3556)
   * @param {string} username - Username
   * @param {string} code - MFA code
   * @returns {Promise<boolean>} True if code is valid
   */
  async verifyMFACode(username, code) {
    // Find challenge for this user
    for (const [challengeId, challenge] of this.mfaChallenges.entries()) {
      if (challenge.username === username && challenge.code === code) {
        // Check if expired
        if (new Date(challenge.expiresAt) < new Date()) {
          this.mfaChallenges.delete(challengeId);
          return false;
        }

        // Check attempts
        if (challenge.attempts >= challenge.maxAttempts) {
          this.mfaChallenges.delete(challengeId);
          return false;
        }

        // Valid code
        this.mfaChallenges.delete(challengeId);
        this.logger.info({ username, challengeId }, 'MFA code verified');
        return true;
      }
    }

    // Increment attempts for failed verification
    for (const challenge of this.mfaChallenges.values()) {
      if (challenge.username === username) {
        challenge.attempts++;
      }
    }

    return false;
  }

  // ========== Issue #3556: Single Sign-On (SSO) ==========

  /**
   * Configure SSO provider (Issue #3556)
   * @param {string} providerName - Provider name (e.g., 'google', 'github', 'microsoft')
   * @param {Object} config - Provider configuration
   */
  configureSSOProvider(providerName, config) {
    this.ssoProviders.set(providerName, {
      name: providerName,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      authorizationUrl: config.authorizationUrl,
      tokenUrl: config.tokenUrl,
      userInfoUrl: config.userInfoUrl,
      scopes: config.scopes || ['openid', 'profile', 'email']
    });

    this.logger.info({ providerName }, 'SSO provider configured');
  }

  /**
   * Authenticate with SSO provider (Issue #3556)
   * @param {string} sessionId - Session identifier
   * @param {string} providerName - SSO provider name
   * @param {string} ssoToken - SSO access token
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Authentication result
   */
  async authenticateWithSSO(sessionId, providerName, ssoToken, options = {}) {
    const provider = this.ssoProviders.get(providerName);
    if (!provider) {
      throw new Error(`SSO provider '${providerName}' not configured`);
    }

    try {
      // Get user info from SSO provider
      const userInfoResponse = await axios.get(provider.userInfoUrl, {
        headers: { 'Authorization': `Bearer ${ssoToken}` }
      });

      const userInfo = userInfoResponse.data;
      const username = userInfo.email || userInfo.username;

      this.logger.info({ username, providerName, sessionId }, 'SSO authentication successful');

      // Create unified session (without password authentication)
      // This assumes the user exists in Integram with the same email
      const session = {
        sessionId,
        username,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        organization: userInfo.organization || null,
        mfaVerified: false,
        ssoProvider: providerName,
        ssoUserInfo: {
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture
        },
        databases: [], // Will be populated via separate database authentication
        failedDatabases: [],
        metadata: {
          totalDatabases: 0,
          successfulAuths: 0,
          failedAuths: 0,
          authTime: 0
        }
      };

      this.sessions.set(sessionId, session);

      this.logger.info({ sessionId, username, providerName }, 'SSO session created');

      return {
        success: true,
        session,
        message: 'SSO authentication successful. Database tokens must be obtained separately.'
      };
    } catch (error) {
      this.logger.error({ error: error.message, providerName }, 'SSO authentication failed');

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get SSO authorization URL (Issue #3556)
   * @param {string} providerName - SSO provider name
   * @param {string} state - CSRF state token
   * @returns {string} Authorization URL
   */
  getSSOAuthorizationUrl(providerName, state) {
    const provider = this.ssoProviders.get(providerName);
    if (!provider) {
      throw new Error(`SSO provider '${providerName}' not configured`);
    }

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: provider.scopes.join(' '),
      state
    });

    return `${provider.authorizationUrl}?${params.toString()}`;
  }

  // ========== Issue #3556: Real-time Session Monitoring ==========

  /**
   * Initialize session activity monitoring (Issue #3556)
   * @param {string} sessionId - Session identifier
   */
  initializeSessionMonitoring(sessionId) {
    const activity = {
      sessionId,
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      requestCount: 0,
      apiCalls: [],
      errors: []
    };

    this.sessionActivity.set(sessionId, activity);
    this.logger.info({ sessionId }, 'Session monitoring initialized');
  }

  /**
   * Track session activity (Issue #3556)
   * @param {string} sessionId - Session identifier
   * @param {string} activityType - Type of activity (e.g., 'api_call', 'error')
   * @param {Object} details - Activity details
   */
  trackSessionActivity(sessionId, activityType, details = {}) {
    const activity = this.sessionActivity.get(sessionId);
    if (!activity) {
      this.logger.warn({ sessionId }, 'Session activity tracking not initialized');
      return;
    }

    activity.lastActivity = new Date().toISOString();
    activity.requestCount++;

    if (activityType === 'api_call') {
      activity.apiCalls.push({
        timestamp: new Date().toISOString(),
        database: details.database,
        endpoint: details.endpoint,
        duration: details.duration
      });

      // Keep only last 100 API calls
      if (activity.apiCalls.length > 100) {
        activity.apiCalls.shift();
      }
    }

    if (activityType === 'error') {
      activity.errors.push({
        timestamp: new Date().toISOString(),
        error: details.error,
        context: details.context
      });

      // Keep only last 50 errors
      if (activity.errors.length > 50) {
        activity.errors.shift();
      }
    }
  }

  /**
   * Get session activity statistics (Issue #3556)
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Session activity data
   */
  getSessionActivity(sessionId) {
    const activity = this.sessionActivity.get(sessionId);
    if (!activity) {
      return null;
    }

    return {
      ...activity,
      duration: new Date().getTime() - new Date(activity.startedAt).getTime(),
      apiCallRate: activity.apiCalls.length / ((new Date().getTime() - new Date(activity.startedAt).getTime()) / 60000), // calls per minute
      errorRate: activity.errors.length / activity.requestCount
    };
  }

  /**
   * Stop session monitoring (Issue #3556)
   * @param {string} sessionId - Session identifier
   */
  stopSessionMonitoring(sessionId) {
    this.sessionActivity.delete(sessionId);
    this.logger.debug({ sessionId }, 'Session monitoring stopped');
  }

  /**
   * Get all active session activities (Issue #3556)
   * @returns {Array<Object>} List of session activities
   */
  getAllSessionActivities() {
    const activities = [];

    for (const [sessionId, activity] of this.sessionActivity.entries()) {
      activities.push(this.getSessionActivity(sessionId));
    }

    return activities;
  }

  // ========== Periodic Tasks ==========

  /**
   * Start periodic cleanup and monitoring tasks
   */
  startPeriodicTasks() {
    // Clean up expired sessions every hour
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
      this.cleanupExpiredMFAChallenges();
    }, 60 * 60 * 1000);

    // Log session statistics every 5 minutes
    this.statsTimer = setInterval(() => {
      this.logSessionStatistics();
    }, 5 * 60 * 1000);

    this.logger.info('Periodic tasks started');
  }

  /**
   * Clean up expired MFA challenges
   */
  cleanupExpiredMFAChallenges() {
    const now = new Date();
    let cleaned = 0;

    for (const [challengeId, challenge] of this.mfaChallenges.entries()) {
      if (new Date(challenge.expiresAt) < now) {
        this.mfaChallenges.delete(challengeId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.info({ cleaned }, 'Cleaned up expired MFA challenges');
    }
  }

  /**
   * Log session statistics
   */
  logSessionStatistics() {
    const stats = {
      activeSessions: this.sessions.size,
      totalApiCalls: 0,
      totalErrors: 0,
      averageSessionDuration: 0
    };

    const activities = this.getAllSessionActivities();
    stats.totalApiCalls = activities.reduce((sum, a) => sum + a.requestCount, 0);
    stats.totalErrors = activities.reduce((sum, a) => sum + a.errors.length, 0);
    stats.averageSessionDuration = activities.length > 0
      ? activities.reduce((sum, a) => sum + a.duration, 0) / activities.length
      : 0;

    this.logger.info(stats, 'Session statistics');
  }

  /**
   * Shutdown service and clean up resources
   */
  shutdown() {
    // Cancel all renewal timers
    for (const timer of this.renewalTimers.values()) {
      clearTimeout(timer);
    }
    this.renewalTimers.clear();

    // Stop periodic tasks
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
    }

    this.logger.info('Unified auth service shut down');
  }
}

export default UnifiedAuthService;
