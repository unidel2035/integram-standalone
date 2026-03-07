
/**
 * Authentication Store
 *
 * Manages multi-database authentication:
 * - Primary DB authentication (user-selected database)
 * - my DB authentication (automatic, for system/admin features)
 *
 * This store maintains separate tokens and authentication states for:
 * 1. The user's selected database (default: A2025 on dronedoc.ru)
 * 2. The my database (for Tokens.vue and other admin components)
 *
 * Issue #3651: Migrated from ddadmin to my database for unified user account storage
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { getIntegramServerUrl, getIntegramDatabase } from '@/utils/integramConfig'

export const useAuthStore = defineStore('auth', () => {
  // Primary database authentication
  const primaryToken = ref(null)
  const primaryUser = ref(null)
  const primaryUserId = ref(null)
  const primaryXsrf = ref(null)
  const primaryDatabase = ref('A2025') // Default database
  const primaryApiBase = ref('dronedoc.ru') // Default API base

  // my database authentication (Issue #3651: replaced ddadmin with my)
  const myToken = ref(null)
  const myUser = ref(null)
  const myUserId = ref(null)
  const myXsrf = ref(null)

  // Loading states
  const isLoading = ref(false)
  const error = ref(null)

  // Computed properties
  const isAuthenticated = computed(() => !!primaryToken.value)
  const isMyAuthenticated = computed(() => !!myToken.value)

  /**
   * Initialize store from localStorage
   */
  function initFromLocalStorage() {
    // Load primary auth data
    primaryToken.value = localStorage.getItem('token')
    primaryUser.value = localStorage.getItem('user')
    primaryUserId.value = localStorage.getItem('id')
    primaryXsrf.value = localStorage.getItem('_xsrf')
    primaryDatabase.value = localStorage.getItem('db') || 'A2025'
    primaryApiBase.value = localStorage.getItem('apiBase') || 'dronedoc.ru'

    // Load my auth data (Issue #3651: replaced ddadmin with my)
    myToken.value = localStorage.getItem('my_token')
    myUser.value = localStorage.getItem('my_user')
    myUserId.value = localStorage.getItem('my_id')
    myXsrf.value = localStorage.getItem('my_xsrf')

    // Re-check admin status for existing sessions if not yet determined
    if (primaryToken.value && localStorage.getItem('is_admin') === null) {
      const login = primaryUser.value
      const token = primaryToken.value
      const id = primaryUserId.value
      const apiBase = primaryApiBase.value
      const database = primaryDatabase.value
      axios.get(
        `https://${apiBase}/${database}/object/${id}?JSON_KV`,
        { headers: { 'X-Authorization': token } }
      ).then(res => {
        const reqs = res.data?.reqs?.[id] || {}
        const isAdmin = login === 'd' ||
          Object.values(reqs).some(v => v === 'admin' || v === 'Администратор')
        localStorage.setItem('is_admin', isAdmin ? 'true' : 'false')
        window.dispatchEvent(new CustomEvent('admin-status-changed', { detail: isAdmin }))
      }).catch(() => {
        const fallback = login === 'd'
        localStorage.setItem('is_admin', fallback ? 'true' : 'false')
        window.dispatchEvent(new CustomEvent('admin-status-changed', { detail: fallback }))
      })
    }
  }

  /**
   * Perform authentication to a specific database
   */
  async function authenticateToDatabase(login, password, apiBase, database) {
    const formData = new URLSearchParams()
    formData.append('login', login)
    formData.append('pwd', password)

    // Determine the base URL
    let baseURL
    if (apiBase === 'localhost') {
      baseURL = `http://localhost/${database}/`
    } else {
      baseURL = `https://${apiBase}/${database}`
    }

    // Create axios instance for this specific database
    const client = axios.create({
      baseURL,
      timeout: 30000, // 30 seconds (was 5000 seconds - fixed security issue)
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    // Make authentication request
    const response = await client.post('/auth', formData, {
      params: { JSON_KV: true }
    })

    let data = response.data

    // Handle case where API returns array instead of object
    if (Array.isArray(data) && data.length > 0) {
      data = data[0]
    }

    // Check if authentication was successful
    // API returns: { token, _xsrf, id, msg } on success
    // or { error, warning } on failure
    if (!data.token) {
      throw new Error(data.error || data.warning || 'Authentication failed')
    }

    return {
      token: data.token,
      _xsrf: data._xsrf,
      id: data.id,
      user: login
    }
  }

  /**
   * Login to both primary database and my
   * Issue #3651: Changed from ddadmin to my database
   */
  async function login(login, password, apiBase = 'dronedoc.ru', database = 'A2025') {
    isLoading.value = true
    error.value = null

    try {
      // 1. Authenticate to primary database
      const primaryAuth = await authenticateToDatabase(login, password, apiBase, database)

      // Store primary auth data
      primaryToken.value = primaryAuth.token
      primaryUser.value = primaryAuth.user
      primaryUserId.value = primaryAuth.id
      primaryXsrf.value = primaryAuth._xsrf
      primaryDatabase.value = database
      primaryApiBase.value = apiBase

      localStorage.setItem('token', primaryAuth.token)
      localStorage.setItem('user', primaryAuth.user)
      localStorage.setItem('id', primaryAuth.id)
      localStorage.setItem('_xsrf', primaryAuth._xsrf)
      localStorage.setItem('db', database)
      localStorage.setItem('apiBase', apiBase)

      // 2. Authenticate to my database with same credentials
      // Issue #3651: my is the new unified user account database
      // Issue #5405: Migrated from dronedoc.ru to ai2o.ru (ai2o.ru)
      try {
        const myServerUrl = getIntegramServerUrl()
        const myDatabase = getIntegramDatabase()
        const myAuth = await authenticateToDatabase(login, password, myServerUrl, myDatabase)

        // Store my auth data separately
        myToken.value = myAuth.token
        myUser.value = myAuth.user
        myUserId.value = myAuth.id
        myXsrf.value = myAuth._xsrf

        localStorage.setItem('my_token', myAuth.token)
        localStorage.setItem('my_user', myAuth.user)
        localStorage.setItem('my_id', myAuth.id)
        localStorage.setItem('my_xsrf', myAuth._xsrf)

        // console.log('✅ Successfully authenticated to both databases:', {
        //   primary: `${database}@${apiBase}`,
        //   my: `my@dronedoc.ru`
        // })
      } catch (myError) {
        console.warn('⚠️ Failed to authenticate to my database:', myError)
        // Don't fail the entire login if my auth fails
        // Some users might not have access to my database yet
      }

      // 3. Check admin status via Integram user object
      try {
        const adminCheck = await axios.get(
          `https://${apiBase}/${database}/object/${primaryAuth.id}?JSON_KV`,
          { headers: { 'X-Authorization': primaryAuth.token } }
        )
        const reqs = adminCheck.data?.reqs?.[primaryAuth.id] || {}
        const isAdmin = login === 'd' ||
          Object.values(reqs).some(v => v === 'admin' || v === 'Администратор')
        localStorage.setItem('is_admin', isAdmin ? 'true' : 'false')
        window.dispatchEvent(new CustomEvent('admin-status-changed', { detail: isAdmin }))
      } catch {
        const fallback = login === 'd'
        localStorage.setItem('is_admin', fallback ? 'true' : 'false')
        window.dispatchEvent(new CustomEvent('admin-status-changed', { detail: fallback }))
      }

      return { success: true, user: primaryAuth.user }
    } catch (err) {
      error.value = err.message || 'Login failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Logout from all databases
   * Issue #3651: Updated to clear my database auth data instead of ddadmin
   */
  function logout() {
    // Clear primary auth data
    primaryToken.value = null
    primaryUser.value = null
    primaryUserId.value = null
    primaryXsrf.value = null

    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('id')
    localStorage.removeItem('_xsrf')

    // Clear my auth data
    myToken.value = null
    myUser.value = null
    myUserId.value = null
    myXsrf.value = null

    localStorage.removeItem('my_token')
    localStorage.removeItem('my_user')
    localStorage.removeItem('my_id')
    localStorage.removeItem('my_xsrf')
    localStorage.removeItem('is_admin')

    // Keep apiBase and db in localStorage for next login
  }

  /**
   * Get authentication data for my database
   * Issue #3651: Renamed from getDdadminAuth to getMyAuth
   */
  function getMyAuth() {
    return {
      token: myToken.value,
      user: myUser.value,
      id: myUserId.value,
      xsrf: myXsrf.value,
      isAuthenticated: isMyAuthenticated.value
    }
  }

  /**
   * @deprecated Use getMyAuth() instead (Issue #3651)
   */
  function getDdadminAuth() {
    console.warn('getDdadminAuth() is deprecated. Use getMyAuth() instead.')
    return getMyAuth()
  }

  /**
   * Get authentication data for primary database
   */
  function getPrimaryAuth() {
    return {
      token: primaryToken.value,
      user: primaryUser.value,
      id: primaryUserId.value,
      xsrf: primaryXsrf.value,
      database: primaryDatabase.value,
      apiBase: primaryApiBase.value,
      isAuthenticated: isAuthenticated.value
    }
  }

  return {
    // State
    primaryToken,
    primaryUser,
    primaryUserId,
    primaryXsrf,
    primaryDatabase,
    primaryApiBase,
    myToken,
    myUser,
    myUserId,
    myXsrf,
    isLoading,
    error,

    // Computed
    isAuthenticated,
    isMyAuthenticated,

    // Actions
    initFromLocalStorage,
    login,
    logout,
    getMyAuth,
    getDdadminAuth, // Deprecated but kept for backwards compatibility
    getPrimaryAuth,

    // Deprecated (Issue #3651: backwards compatibility)
    ddadminToken: myToken,
    ddadminUser: myUser,
    ddadminUserId: myUserId,
    ddadminXsrf: myXsrf,
    isDdadminAuthenticated: isMyAuthenticated
  }
})