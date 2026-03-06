/**
 * Unified Authentication Service (Frontend)
 *
 * Issue #3554: Single authentication point for all databases
 *
 * This service provides a frontend interface for unified authentication
 * across multiple Integram databases. It communicates with the backend
 * unified authentication API.
 *
 * Features:
 * - Login with single credentials, get tokens for all databases
 * - Store session ID in localStorage
 * - Retrieve tokens for specific databases on demand
 * - Refresh tokens when needed
 * - Logout and session cleanup
 *
 * Usage:
 * ```javascript
 * import { unifiedAuthService } from '@/services/unifiedAuthService'
 *
 * // Login
 * const result = await unifiedAuthService.login('username', 'password')
 * if (result.success) {
 *   console.log('Session ID:', result.session.sessionId)
 *   console.log('Available databases:', result.session.databases.map(db => db.database))
 * }
 *
 * // Get token for specific database
 * const myToken = await unifiedAuthService.getTokenForDatabase('my')
 *
 * // Get all tokens
 * const allTokens = await unifiedAuthService.getAllTokens()
 *
 * // Logout
 * await unifiedAuthService.logout()
 * ```
 */

import axios from 'axios';

// Issue #3656: Fix URL construction - API_BASE_URL should be the base server URL
// and /api prefix should be added in request paths
const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '';
const SESSION_KEY = 'unified_auth_session_id';

class UnifiedAuthService {
  constructor() {
    this.sessionId = this.loadSessionId();
    this.sessionCache = null;
  }

  /**
   * Load session ID from localStorage
   * @returns {string|null} Session ID or null
   */
  loadSessionId() {
    try {
      return localStorage.getItem(SESSION_KEY);
    } catch (error) {
      console.error('Failed to load session ID:', error);
      return null;
    }
  }

  /**
   * Save session ID to localStorage
   * @param {string} sessionId - Session ID to save
   */
  saveSessionId(sessionId) {
    try {
      localStorage.setItem(SESSION_KEY, sessionId);
      this.sessionId = sessionId;
    } catch (error) {
      console.error('Failed to save session ID:', error);
    }
  }

  /**
   * Clear session ID from localStorage
   */
  clearSessionId() {
    try {
      localStorage.removeItem(SESSION_KEY);
      this.sessionId = null;
      this.sessionCache = null;
    } catch (error) {
      console.error('Failed to clear session ID:', error);
    }
  }

  /**
   * Login with unified authentication
   * @param {string} username - Username/login
   * @param {string} password - Password
   * @param {Array<string>} databases - Optional list of specific databases
   * @returns {Promise<Object>} Login result with session
   */
  async login(username, password, databases = null) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/unified-auth/login`, {
        username,
        password,
        databases
      });

      if (response.data.success) {
        this.saveSessionId(response.data.session.sessionId);
        this.sessionCache = response.data.session;

        console.log('[UnifiedAuth] Login successful:', {
          sessionId: response.data.session.sessionId,
          username: response.data.session.username,
          databases: response.data.session.databases.length,
          failedDatabases: response.data.session.failedDatabases.length
        });
      }

      return response.data;
    } catch (error) {
      console.error('[UnifiedAuth] Login failed:', error);

      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} True if session exists
   */
  isAuthenticated() {
    return !!this.sessionId;
  }

  /**
   * Get current session details
   * @param {boolean} refresh - Force refresh from API
   * @returns {Promise<Object|null>} Session object or null
   */
  async getSession(refresh = false) {
    if (!this.sessionId) {
      return null;
    }

    // Return cached session if available and not forcing refresh
    if (this.sessionCache && !refresh) {
      return this.sessionCache;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/unified-auth/session/${this.sessionId}`);

      if (response.data.success) {
        this.sessionCache = response.data.session;
        return this.sessionCache;
      }

      return null;
    } catch (error) {
      console.error('[UnifiedAuth] Failed to get session:', error);

      // Session might be expired, clear it
      if (error.response?.status === 404) {
        this.clearSessionId();
      }

      return null;
    }
  }

  /**
   * Get token for a specific database
   * @param {string} database - Database name
   * @returns {Promise<Object|null>} Token data or null
   */
  async getTokenForDatabase(database) {
    if (!this.sessionId) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/unified-auth/token/${this.sessionId}/${database}`
      );

      if (response.data.success) {
        console.log(`[UnifiedAuth] Retrieved token for database: ${database}`);
        return response.data;
      }

      return null;
    } catch (error) {
      console.error(`[UnifiedAuth] Failed to get token for ${database}:`, error);

      // Session might be expired
      if (error.response?.status === 404) {
        this.clearSessionId();
      }

      throw error;
    }
  }

  /**
   * Get all tokens from session
   * @returns {Promise<Object>} Map of database → token data
   */
  async getAllTokens() {
    if (!this.sessionId) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/unified-auth/tokens/${this.sessionId}`);

      if (response.data.success) {
        console.log('[UnifiedAuth] Retrieved all tokens:', Object.keys(response.data.tokens));
        return response.data.tokens;
      }

      return {};
    } catch (error) {
      console.error('[UnifiedAuth] Failed to get all tokens:', error);

      // Session might be expired
      if (error.response?.status === 404) {
        this.clearSessionId();
      }

      throw error;
    }
  }

  /**
   * Refresh authentication for a specific database
   * @param {string} database - Database name
   * @param {string} password - User's password
   * @returns {Promise<Object>} Refresh result
   */
  async refreshDatabaseAuth(database, password) {
    if (!this.sessionId) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/unified-auth/refresh`, {
        sessionId: this.sessionId,
        database,
        password
      });

      if (response.data.success) {
        console.log(`[UnifiedAuth] Refreshed token for database: ${database}`);

        // Invalidate session cache to force refresh on next getSession()
        this.sessionCache = null;
      }

      return response.data;
    } catch (error) {
      console.error(`[UnifiedAuth] Failed to refresh token for ${database}:`, error);
      throw error;
    }
  }

  /**
   * Logout and invalidate session
   * @returns {Promise<void>}
   */
  async logout() {
    if (!this.sessionId) {
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/api/unified-auth/logout`, {
        sessionId: this.sessionId
      });

      console.log('[UnifiedAuth] Logout successful');
    } catch (error) {
      console.error('[UnifiedAuth] Logout failed:', error);
    } finally {
      this.clearSessionId();
    }
  }

  /**
   * Get authentication statistics
   * @returns {Promise<Object>} Stats object
   */
  async getStats() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/unified-auth/stats`);

      if (response.data.success) {
        return response.data.stats;
      }

      return null;
    } catch (error) {
      console.error('[UnifiedAuth] Failed to get stats:', error);
      return null;
    }
  }

  /**
   * Helper: Get Integram API client config for a specific database
   * This can be used to initialize integramApiClient with the correct tokens
   * @param {string} database - Database name
   * @returns {Promise<Object>} Client config with baseURL, database, token, xsrf
   */
  async getIntegramClientConfig(database) {
    const tokenData = await this.getTokenForDatabase(database);

    if (!tokenData) {
      throw new Error(`No token found for database: ${database}`);
    }

    return {
      baseURL: import.meta.env.VITE_INTEGRAM_API_URL || 'https://ai2o.ru',
      database: tokenData.database,
      token: tokenData.token,
      xsrf: tokenData.xsrf,
      userId: tokenData.userId,
      userName: tokenData.userName,
      userRole: tokenData.userRole
    };
  }

  /**
   * Helper: Get list of available databases from current session
   * @returns {Promise<Array<string>>} List of database names
   */
  async getAvailableDatabases() {
    const session = await this.getSession();

    if (!session) {
      return [];
    }

    return session.databases.map(db => db.database);
  }

  /**
   * Helper: Check if a specific database is available in session
   * @param {string} database - Database name
   * @returns {Promise<boolean>} True if database is available
   */
  async isDatabaseAvailable(database) {
    const databases = await this.getAvailableDatabases();
    return databases.includes(database);
  }
}

// Export singleton instance
export const unifiedAuthService = new UnifiedAuthService();

// Export class for testing
export { UnifiedAuthService };

export default unifiedAuthService;
