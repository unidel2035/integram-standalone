/**
 * Unified Authentication Composable
 *
 * Issue #3554: Single authentication point for all databases
 *
 * This composable provides reactive state and methods for unified authentication
 * in Vue 3 components.
 *
 * Features:
 * - Reactive authentication state
 * - Easy-to-use methods for login, logout, token retrieval
 * - Automatic session management
 * - Error handling
 *
 * Usage:
 * ```vue
 * <script setup>
 * import { useUnifiedAuth } from '@/composables/useUnifiedAuth'
 *
 * const {
 *   isAuthenticated,
 *   session,
 *   login,
 *   logout,
 *   getTokenForDatabase,
 *   loading,
 *   error
 * } = useUnifiedAuth()
 *
 * const handleLogin = async () => {
 *   await login('username', 'password')
 * }
 * </script>
 * ```
 */

import { ref, computed } from 'vue';
import { unifiedAuthService } from '@/services/unifiedAuthService';

// Global reactive state
const session = ref(null);
const loading = ref(false);
const error = ref(null);

export function useUnifiedAuth() {
  /**
   * Check if user is authenticated
   */
  const isAuthenticated = computed(() => {
    return unifiedAuthService.isAuthenticated() && session.value !== null;
  });

  /**
   * Get current username from session
   */
  const username = computed(() => {
    return session.value?.username || null;
  });

  /**
   * Get list of available databases
   */
  const availableDatabases = computed(() => {
    if (!session.value) {
      return [];
    }
    return session.value.databases.map(db => db.database);
  });

  /**
   * Get organization name from session
   */
  const organization = computed(() => {
    return session.value?.organization || null;
  });

  /**
   * Load session from service
   * @param {boolean} refresh - Force refresh from API
   */
  const loadSession = async (refresh = false) => {
    try {
      loading.value = true;
      error.value = null;

      const sessionData = await unifiedAuthService.getSession(refresh);
      session.value = sessionData;

      return sessionData;
    } catch (err) {
      error.value = err.message;
      console.error('[useUnifiedAuth] Failed to load session:', err);
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Login with unified authentication
   * @param {string} username - Username/login
   * @param {string} password - Password
   * @param {Array<string>} databases - Optional list of databases
   * @returns {Promise<Object>} Login result
   */
  const login = async (username, password, databases = null) => {
    try {
      loading.value = true;
      error.value = null;

      const result = await unifiedAuthService.login(username, password, databases);

      if (result.success) {
        session.value = result.session;
      } else {
        error.value = result.error;
      }

      return result;
    } catch (err) {
      error.value = err.message;
      console.error('[useUnifiedAuth] Login failed:', err);

      return {
        success: false,
        error: err.message
      };
    } finally {
      loading.value = false;
    }
  };

  /**
   * Logout and clear session
   * @returns {Promise<void>}
   */
  const logout = async () => {
    try {
      loading.value = true;
      error.value = null;

      await unifiedAuthService.logout();
      session.value = null;
    } catch (err) {
      error.value = err.message;
      console.error('[useUnifiedAuth] Logout failed:', err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * Get token for specific database
   * @param {string} database - Database name
   * @returns {Promise<Object|null>} Token data or null
   */
  const getTokenForDatabase = async (database) => {
    try {
      loading.value = true;
      error.value = null;

      return await unifiedAuthService.getTokenForDatabase(database);
    } catch (err) {
      error.value = err.message;
      console.error('[useUnifiedAuth] Failed to get token:', err);
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Get all tokens from session
   * @returns {Promise<Object>} Map of database → token data
   */
  const getAllTokens = async () => {
    try {
      loading.value = true;
      error.value = null;

      return await unifiedAuthService.getAllTokens();
    } catch (err) {
      error.value = err.message;
      console.error('[useUnifiedAuth] Failed to get all tokens:', err);
      return {};
    } finally {
      loading.value = false;
    }
  };

  /**
   * Refresh authentication for a specific database
   * @param {string} database - Database name
   * @param {string} password - User's password
   * @returns {Promise<Object>} Refresh result
   */
  const refreshDatabaseAuth = async (database, password) => {
    try {
      loading.value = true;
      error.value = null;

      const result = await unifiedAuthService.refreshDatabaseAuth(database, password);

      // Reload session to get updated tokens
      if (result.success) {
        await loadSession(true);
      }

      return result;
    } catch (err) {
      error.value = err.message;
      console.error('[useUnifiedAuth] Failed to refresh token:', err);

      return {
        success: false,
        error: err.message
      };
    } finally {
      loading.value = false;
    }
  };

  /**
   * Get Integram client config for a database
   * @param {string} database - Database name
   * @returns {Promise<Object>} Client config
   */
  const getIntegramClientConfig = async (database) => {
    try {
      loading.value = true;
      error.value = null;

      return await unifiedAuthService.getIntegramClientConfig(database);
    } catch (err) {
      error.value = err.message;
      console.error('[useUnifiedAuth] Failed to get client config:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Check if a specific database is available
   * @param {string} database - Database name
   * @returns {Promise<boolean>} True if available
   */
  const isDatabaseAvailable = async (database) => {
    try {
      return await unifiedAuthService.isDatabaseAvailable(database);
    } catch (err) {
      console.error('[useUnifiedAuth] Failed to check database availability:', err);
      return false;
    }
  };

  /**
   * Clear error message
   */
  const clearError = () => {
    error.value = null;
  };

  /**
   * Initialize composable (load session if exists)
   */
  const initialize = async () => {
    if (unifiedAuthService.isAuthenticated()) {
      await loadSession();
    }
  };

  return {
    // State
    session,
    loading,
    error,

    // Computed
    isAuthenticated,
    username,
    availableDatabases,
    organization,

    // Methods
    login,
    logout,
    loadSession,
    getTokenForDatabase,
    getAllTokens,
    refreshDatabaseAuth,
    getIntegramClientConfig,
    isDatabaseAvailable,
    clearError,
    initialize
  };
}

export default useUnifiedAuth;
