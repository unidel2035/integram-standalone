/**
 * Composable for managing Integram session state
 *
 * Provides reactive session management for Integram API interactions.
 * Handles authentication, session persistence, and automatic logout.
 *
 * NOTE: This composable uses integramApiClient directly (no backend proxy)
 *
 * Issue #3778: Added auto-loading from 'my' database token for seamless UX
 * Issue #5100: Added session validation and automatic refresh
 */

import { ref, computed, watch } from 'vue';
import integramApiClient from '@/services/integramApiClient';

const STORAGE_KEY = 'integram_auth';

// Global session state (shared across components)
const session = ref(null);
const isAuthenticated = ref(false);
const lastValidationTime = ref(0);
const SESSION_VALIDATION_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Load session from localStorage on module load
const loadSession = () => {
  try {
    // Issue #5100: First try to restore session from all sources
    if (!integramApiClient.isAuthenticated()) {
      integramApiClient.tryRestoreSession();
    }

    // integramApiClient already loads its own session from localStorage
    // including fallback to 'my' token (Issue #3778)
    // Just sync our state with it
    if (integramApiClient.isAuthenticated()) {
      const authInfo = integramApiClient.getAuthInfo();
      session.value = {
        database: authInfo.database,
        token: authInfo.token,
        xsrf: authInfo.xsrf,
        userId: authInfo.userId,
        userName: authInfo.userName,
        userRole: authInfo.userRole
      };
      isAuthenticated.value = true;
    } else {
      // Issue #3778: Try to reload from my token if not authenticated
      // This handles cases where page navigation resets the client state
      if (integramApiClient.loadSessionFromMyToken && integramApiClient.loadSessionFromMyToken()) {
        const authInfo = integramApiClient.getAuthInfo();
        session.value = {
          database: authInfo.database,
          token: authInfo.token,
          xsrf: authInfo.xsrf,
          userId: authInfo.userId,
          userName: authInfo.userName,
          userRole: authInfo.userRole
        };
        isAuthenticated.value = true;
      }
    }
  } catch (error) {
    console.error('Failed to load session from localStorage:', error);
    localStorage.removeItem(STORAGE_KEY);
  }
};

// Load session on initialization
loadSession();

export function useIntegramSession() {
  /**
   * Authenticate with Integram API
   * @param {string} database - Database name
   * @param {string} login - User login
   * @param {string} password - User password
   * @returns {Promise<Object>} Session data
   */
  const authenticate = async (database, login, password) => {
    // Use integramApiClient directly (no backend proxy)
    const authResult = await integramApiClient.authenticate(database, login, password);

    if (!authResult.success) {
      throw new Error('Authentication failed');
    }

    // Update our reactive state to match integramApiClient state
    const authInfo = integramApiClient.getAuthInfo();
    session.value = {
      database: authInfo.database,
      login,
      token: authInfo.token,
      xsrf: authInfo.xsrf,
      userId: authInfo.userId,
      userName: authInfo.userName,
      userRole: authInfo.userRole
    };
    isAuthenticated.value = true;

    return session.value;
  };

  /**
   * Logout and destroy session
   */
  const logout = async () => {
    // Clear integramApiClient session
    integramApiClient.logout();

    // Clear local session state
    session.value = null;
    isAuthenticated.value = false;
  };

  /**
   * Get current database
   */
  const database = computed(() => integramApiClient.getDatabase() || session.value?.database || null);

  /**
   * Get current login
   */
  const login = computed(() => session.value?.login || null);

  /**
   * Get current session ID (token in integramApiClient)
   */
  const sessionId = computed(() => integramApiClient.getAuthInfo().token || null);

  /**
   * Check if user is authenticated
   */
  const checkAuth = () => {
    if (!integramApiClient.isAuthenticated()) {
      throw new Error('Not authenticated. Please login first.');
    }
    return true;
  };

  /**
   * Issue #5100: Ensure session is valid, validate if needed
   * This helps prevent premature session expiration messages
   * @returns {Promise<boolean>} True if session is valid
   */
  const ensureSessionValid = async () => {
    // First try to restore if not authenticated
    if (!integramApiClient.isAuthenticated()) {
      integramApiClient.tryRestoreSession();

      // Update our state if restored
      if (integramApiClient.isAuthenticated()) {
        const authInfo = integramApiClient.getAuthInfo();
        session.value = {
          database: authInfo.database,
          token: authInfo.token,
          xsrf: authInfo.xsrf,
          userId: authInfo.userId,
          userName: authInfo.userName,
          userRole: authInfo.userRole
        };
        isAuthenticated.value = true;
      }
    }

    // If still not authenticated, return false
    if (!integramApiClient.isAuthenticated()) {
      return false;
    }

    // Check if we need to validate with server (every 5 minutes)
    const now = Date.now();
    if (now - lastValidationTime.value > SESSION_VALIDATION_INTERVAL) {
      const isValid = await integramApiClient.validateSession();
      lastValidationTime.value = now;

      if (isValid) {
        // Update our state with refreshed tokens
        const authInfo = integramApiClient.getAuthInfo();
        session.value = {
          database: authInfo.database,
          token: authInfo.token,
          xsrf: authInfo.xsrf,
          userId: authInfo.userId,
          userName: authInfo.userName,
          userRole: authInfo.userRole
        };
        isAuthenticated.value = true;
      }

      return isValid;
    }

    return true;
  };

  /**
   * Issue #5100: Refresh session - force validation with server
   * @returns {Promise<boolean>} True if session is valid
   */
  const refreshSession = async () => {
    lastValidationTime.value = 0; // Reset timer to force validation
    return ensureSessionValid();
  };

  return {
    // State
    session: computed(() => session.value),
    isAuthenticated: computed(() => integramApiClient.isAuthenticated()),
    database,
    login,
    sessionId,

    // Methods
    authenticate,
    logout,
    checkAuth,
    ensureSessionValid,
    refreshSession
  };
}
