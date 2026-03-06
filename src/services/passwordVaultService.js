/**
 * Password Vault Service
 *
 * Issue #4132: Bitwarden-style password manager for storing user credentials
 * across multiple Integram databases.
 *
 * Architecture:
 * - Master database: 'my' at configured Integram server
 * - User's available databases: Retrieved from /my/object/271/?F_U={userId}
 * - Each database has table 18 (Пользователи) with credentials
 *
 * Features:
 * - Fetch user's available databases
 * - View passwords across all databases
 * - CRUD operations for credentials
 * - Secure password display (show/hide toggle)
 * - Search and filter credentials
 */

import integramApiClient from './integramApiClient'

// Constants
const MASTER_DATABASE = 'my'
const DATABASES_TABLE_ID = 271  // Table with user's available databases
const USERS_TABLE_ID = 18       // Table with users/passwords in each database

class PasswordVaultService {
  constructor() {
    this.cachedDatabases = null
    this.cachedCredentials = new Map()
    // Issue #4203: Direct authentication tokens for write operations
    // Кросс-базовый токен от 'my' работает только для чтения, не для записи
    // Для записи нужна прямая аутентификация в целевую базу
    this.directAuthTokens = new Map() // Map<database, { token, xsrf, expiresAt }>
    this.masterCredentials = null // { login, password } - для прямой аутентификации
  }

  /**
   * Issue #4203: Set master credentials for direct database authentication
   * These credentials are used to authenticate directly to each target database
   * when performing write operations (create, update, delete)
   * @param {string} login - Master login (should work across all databases)
   * @param {string} password - Master password
   */
  setMasterCredentials(login, password) {
    this.masterCredentials = { login, password }
    // Clear cached direct tokens when credentials change
    this.directAuthTokens.clear()
    console.log('[PasswordVault] Master credentials set for direct authentication')
  }

  /**
   * Issue #4203: Clear master credentials
   */
  clearMasterCredentials() {
    this.masterCredentials = null
    this.directAuthTokens.clear()
    console.log('[PasswordVault] Master credentials cleared')
  }

  /**
   * Issue #4203: Check if master credentials are set
   * @returns {boolean} True if master credentials are available
   */
  hasMasterCredentials() {
    return this.masterCredentials !== null &&
           this.masterCredentials.login &&
           this.masterCredentials.password
  }

  /**
   * Issue #4203: Authenticate directly to a target database
   * This is required for write operations because cross-database tokens don't work for writes
   * @param {string} database - Target database name
   * @returns {Promise<Object>} Authentication result with token and xsrf
   */
  async authenticateToDatabase(database) {
    if (!this.hasMasterCredentials()) {
      throw new Error('Master credentials not set. Call setMasterCredentials() first.')
    }

    try {
      // Check if we have a valid cached token
      const cached = this.directAuthTokens.get(database)
      if (cached && cached.expiresAt > Date.now()) {
        console.log(`[PasswordVault] Using cached direct token for database: ${database}`)
        return cached
      }

      console.log(`[PasswordVault] Authenticating directly to database: ${database}`)

      // Authenticate directly to target database
      const result = await integramApiClient.authenticate(
        database,
        this.masterCredentials.login,
        this.masterCredentials.password
      )

      // Cache the token with 30 minute expiry
      const tokenData = {
        token: result.token,
        xsrf: result.xsrf,
        userId: result.userId,
        expiresAt: Date.now() + 30 * 60 * 1000 // 30 minutes
      }

      this.directAuthTokens.set(database, tokenData)
      console.log(`[PasswordVault] Direct authentication successful for database: ${database}`)

      return tokenData
    } catch (error) {
      console.error(`[PasswordVault] Direct authentication failed for database: ${database}`, error)
      throw new Error(`Не удалось аутентифицироваться в базу ${database}: ${error.message}`)
    }
  }

  /**
   * Issue #4203: Get direct auth token for a database, authenticating if needed
   * @param {string} database - Target database name
   * @returns {Promise<Object>} Token data { token, xsrf, userId }
   */
  async getDirectAuthToken(database) {
    // Special case: 'my' database - use stored my_token
    if (database === 'my') {
      const myToken = localStorage.getItem('my_token')
      const myXsrf = localStorage.getItem('my_xsrf')
      if (myToken && myXsrf) {
        return { token: myToken, xsrf: myXsrf }
      }
    }

    return this.authenticateToDatabase(database)
  }

  /**
   * Initialize the service - use any available authentication
   * Issue #4175: Improved authentication token discovery and fallback logic
   * @returns {Promise<boolean>} True if authenticated
   */
  async init() {
    // Try 'my' database token first (preferred for cross-database access)
    let token = localStorage.getItem('my_token')
    let xsrf = localStorage.getItem('my_xsrf')
    let authDatabase = MASTER_DATABASE

    // Fallback to standard auth token
    if (!token || !xsrf) {
      token = localStorage.getItem('token')
      xsrf = localStorage.getItem('_xsrf')
      // Standard tokens may be for 'my' or current database
      const currentDb = localStorage.getItem('db')
      authDatabase = currentDb || MASTER_DATABASE
    }

    // Fallback to integram session
    if (!token || !xsrf) {
      const integramSession = localStorage.getItem('integram_session')
      if (integramSession) {
        try {
          const session = JSON.parse(integramSession)
          token = session.token
          xsrf = session.xsrfToken || session._xsrf
          authDatabase = session.authDatabase || session.database || MASTER_DATABASE
        } catch (e) {
          console.error('[PasswordVault] Invalid integram_session:', e)
        }
      }
    }

    if (!token || !xsrf) {
      console.warn('[PasswordVault] No authentication found. Please log in to access the Password Vault.')
      return false
    }

    // Configure integramApiClient for 'my' database with proper authDatabase tracking
    // This enables cross-database access via kernel routing (Issue #3811)
    integramApiClient.setCredentials(MASTER_DATABASE, token, xsrf, authDatabase)

    console.log(`[PasswordVault] Initialized with auth from database: ${authDatabase}`)
    return true
  }

  /**
   * Get current user ID from localStorage
   * @returns {string|null} User ID
   */
  getCurrentUserId() {
    return localStorage.getItem('my_id') || localStorage.getItem('id')
  }

  /**
   * Get list of databases available to current user
   * Fetches from /my/object/271/?F_U={userId}
   * @param {boolean} forceRefresh - Force refresh from API
   * @returns {Promise<Array>} List of available databases
   */
  async getAvailableDatabases(forceRefresh = false) {
    if (this.cachedDatabases && !forceRefresh) {
      return this.cachedDatabases
    }

    const userId = this.getCurrentUserId()
    if (!userId) {
      throw new Error('User not authenticated')
    }

    try {
      // Ensure we're connected to 'my' database
      await this.init()

      // Fetch databases from object 271 filtered by user
      const response = await integramApiClient.getObjectList(DATABASES_TABLE_ID, {
        F_U: userId
      })

      // Parse response - databases are in the object array
      const databases = []

      if (response && response.object) {
        for (const obj of response.object) {
          databases.push({
            id: obj.id,
            name: obj.val,
            // Additional info from requisites if available
            description: response.reqs?.[obj.id]?.description || '',
            server: response.reqs?.[obj.id]?.server || 'dronedoc.ru'
          })
        }
      }

      this.cachedDatabases = databases
      return databases
    } catch (error) {
      console.error('[PasswordVault] Failed to fetch available databases:', error)
      throw error
    }
  }

  /**
   * Get credentials from a specific database
   * Fetches from /{database}/object/18 (Users table)
   * @param {string} database - Database name
   * @param {boolean} forceRefresh - Force refresh from API
   * @returns {Promise<Array>} List of credentials
   */
  async getCredentialsFromDatabase(database, forceRefresh = false) {
    const cacheKey = database

    if (this.cachedCredentials.has(cacheKey) && !forceRefresh) {
      return this.cachedCredentials.get(cacheKey)
    }

    try {
      // Get token for target database
      const myToken = localStorage.getItem('my_token')
      const myXsrf = localStorage.getItem('my_xsrf')

      if (!myToken || !myXsrf) {
        // Fallback to standard auth tokens if 'my' tokens don't exist
        const fallbackToken = localStorage.getItem('token')
        const fallbackXsrf = localStorage.getItem('_xsrf')

        if (!fallbackToken || !fallbackXsrf) {
          console.warn(`[PasswordVault] No authentication tokens found for database ${database}`)
          // Return empty array instead of throwing - database might not be accessible
          return []
        }

        // Determine which database the token belongs to
        // If user logged into 'my', we need to use 'my' header for cross-database access
        const authDb = localStorage.getItem('db') || MASTER_DATABASE

        // Use fallback tokens with correct authDatabase
        integramApiClient.setCredentials(database, fallbackToken, fallbackXsrf, authDb)
      } else {
        // Configure client for target database with 'my' header
        // Pass 'my' as authDatabase to enable kernel routing (Issue #3811)
        integramApiClient.setCredentials(database, myToken, myXsrf, MASTER_DATABASE)
      }

      // Fetch users from table 18
      const response = await integramApiClient.getObjectList(USERS_TABLE_ID, {
        limit: 1000
      })

      // Parse response
      const credentials = []

      if (response && response.object) {
        for (const obj of response.object) {
          const reqs = response.reqs?.[obj.id] || {}

          credentials.push({
            id: obj.id,
            database: database,
            username: obj.val,
            // Common requisite IDs for password fields
            // These may vary by database - try common patterns
            password: reqs['19'] || reqs['pwd'] || reqs['password'] || '',
            email: reqs['20'] || reqs['email'] || '',
            role: reqs['21'] || reqs['role'] || '',
            lastLogin: reqs['22'] || reqs['last_login'] || '',
            notes: reqs['23'] || reqs['notes'] || '',
            // Raw requisites for inspection
            rawReqs: reqs
          })
        }
      }

      this.cachedCredentials.set(cacheKey, credentials)
      return credentials
    } catch (error) {
      // Expected when user doesn't have session for this database
      // Don't show error, just warn - user may only have access to some databases
      console.warn(`[PasswordVault] Skipping ${database}: ${error.message || 'No access'}`)
      // Return empty array instead of throwing - database might not be accessible
      return []
    }
  }

  /**
   * Get all credentials from all available databases
   * @param {boolean} forceRefresh - Force refresh from API
   * @returns {Promise<Array>} List of all credentials with database info
   */
  async getAllCredentials(forceRefresh = false) {
    const databases = await this.getAvailableDatabases(forceRefresh)
    const allCredentials = []

    for (const db of databases) {
      try {
        const creds = await this.getCredentialsFromDatabase(db.name, forceRefresh)

        // Add database info to each credential
        for (const cred of creds) {
          allCredentials.push({
            ...cred,
            databaseName: db.name,
            databaseDescription: db.description
          })
        }
      } catch (error) {
        console.warn(`[PasswordVault] Skipping database ${db.name}:`, error.message)
      }
    }

    return allCredentials
  }

  /**
   * Search credentials by username or database
   * @param {string} query - Search query
   * @param {Array} credentials - Credentials to search (optional, will fetch all if not provided)
   * @returns {Promise<Array>} Filtered credentials
   */
  async searchCredentials(query, credentials = null) {
    const creds = credentials || await this.getAllCredentials()
    const lowerQuery = query.toLowerCase()

    return creds.filter(cred =>
      cred.username?.toLowerCase().includes(lowerQuery) ||
      cred.database?.toLowerCase().includes(lowerQuery) ||
      cred.email?.toLowerCase().includes(lowerQuery) ||
      cred.notes?.toLowerCase().includes(lowerQuery)
    )
  }

  /**
   * Create new credential in a database
   * Issue #4203: Uses direct authentication to target database for write operations
   * @param {string} database - Target database
   * @param {Object} credentialData - Credential data { username, password, email, notes }
   * @returns {Promise<Object>} Created credential
   */
  async createCredential(database, credentialData) {
    try {
      // Issue #4203: Get direct authentication token for target database
      // This is required because cross-database tokens don't work for writes
      const authToken = await this.getDirectAuthToken(database)

      // Configure client with direct token for target database
      integramApiClient.setCredentials(database, authToken.token, authToken.xsrf, database)

      // Create new user object
      // Note: Requisite IDs for user table (18): 20=Password, 41=Email
      const requisites = {}
      if (credentialData.password) requisites['20'] = credentialData.password
      if (credentialData.email) requisites['41'] = credentialData.email
      if (credentialData.notes) requisites['23'] = credentialData.notes

      const response = await integramApiClient.createObject(
        USERS_TABLE_ID,
        credentialData.username,
        requisites
      )

      // Clear cache for this database
      this.cachedCredentials.delete(database)

      console.log(`[PasswordVault] Created credential for ${credentialData.username} in database ${database}`)
      return {
        success: true,
        id: response.id,
        database: database,
        username: credentialData.username
      }
    } catch (error) {
      console.error('[PasswordVault] Failed to create credential:', error)

      // Provide helpful error message for authentication issues
      if (error.message.includes('Master credentials not set')) {
        throw new Error('Требуются учетные данные для записи. Введите логин и пароль.')
      }

      throw error
    }
  }

  /**
   * Update credential in a database
   * Issue #4203: Uses direct authentication to target database for write operations
   * Cross-database tokens from 'my' only work for reads, not writes (returns 401)
   * @param {string} database - Database name
   * @param {string} objectId - Credential object ID
   * @param {Object} updates - Fields to update { password, email, notes }
   * @returns {Promise<Object>} Update result
   */
  async updateCredential(database, objectId, updates) {
    try {
      // Issue #4203: Get direct authentication token for target database
      // This is required because cross-database tokens don't work for writes
      const authToken = await this.getDirectAuthToken(database)

      // Configure client with direct token for target database
      // Use direct database authentication - this sets authDatabase = database
      // so the token is sent with X-Authorization header, not 'my' header
      integramApiClient.setCredentials(database, authToken.token, authToken.xsrf, database)

      // Build requisites to update
      // Note: Requisite IDs may vary by database, using common IDs for user table
      const requisites = {}
      if (updates.password !== undefined) requisites['20'] = updates.password  // Password field
      if (updates.email !== undefined) requisites['41'] = updates.email        // Email field
      if (updates.notes !== undefined) requisites['23'] = updates.notes

      await integramApiClient.setObjectRequisites(objectId, requisites)

      // Clear cache for this database
      this.cachedCredentials.delete(database)

      console.log(`[PasswordVault] Updated credential ${objectId} in database ${database}`)
      return { success: true, objectId, database }
    } catch (error) {
      console.error('[PasswordVault] Failed to update credential:', error)

      // Provide helpful error message for authentication issues
      if (error.message.includes('Master credentials not set')) {
        throw new Error('Требуются учетные данные для записи. Введите логин и пароль.')
      }

      throw error
    }
  }

  /**
   * Delete credential from a database
   * Issue #4203: Uses direct authentication to target database for write operations
   * @param {string} database - Database name
   * @param {string} objectId - Credential object ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteCredential(database, objectId) {
    try {
      // Issue #4203: Get direct authentication token for target database
      // This is required because cross-database tokens don't work for writes
      const authToken = await this.getDirectAuthToken(database)

      // Configure client with direct token for target database
      integramApiClient.setCredentials(database, authToken.token, authToken.xsrf, database)

      await integramApiClient.deleteObject(objectId)

      // Clear cache for this database
      this.cachedCredentials.delete(database)

      console.log(`[PasswordVault] Deleted credential ${objectId} from database ${database}`)
      return { success: true, objectId, database }
    } catch (error) {
      console.error('[PasswordVault] Failed to delete credential:', error)

      // Provide helpful error message for authentication issues
      if (error.message.includes('Master credentials not set')) {
        throw new Error('Требуются учетные данные для записи. Введите логин и пароль.')
      }

      throw error
    }
  }

  /**
   * Find user across all available databases
   * Issue #4205: Search for a user by username in all databases
   * @param {string} username - Username to search for
   * @param {boolean} forceRefresh - Force refresh from API
   * @returns {Promise<Array>} List of found users with database info
   */
  async findUserAcrossDatabases(username, forceRefresh = false) {
    try {
      const databases = await this.getAvailableDatabases(forceRefresh)
      const foundUsers = []

      for (const db of databases) {
        try {
          const credentials = await this.getCredentialsFromDatabase(db.name, forceRefresh)

          // Find matching users in this database
          const matchingUsers = credentials.filter(
            cred => cred.username.toLowerCase() === username.toLowerCase()
          )

          foundUsers.push(...matchingUsers)
        } catch (error) {
          console.warn(`[PasswordVault] Could not search in database ${db.name}:`, error.message)
        }
      }

      return foundUsers
    } catch (error) {
      console.error('[PasswordVault] Failed to find user across databases:', error)
      throw error
    }
  }

  /**
   * Synchronize password across all databases where user exists
   * Issue #4205: Update password for a user in multiple databases
   * @param {string} username - Username to update
   * @param {string} newPassword - New password to set
   * @param {Array} targetDatabases - Optional array of database names to sync (if null, syncs all)
   * @returns {Promise<Object>} Sync results with status for each database
   */
  async syncPasswordAcrossDatabases(username, newPassword, targetDatabases = null) {
    try {
      // Find all instances of this user
      const foundUsers = await this.findUserAcrossDatabases(username, true)

      if (foundUsers.length === 0) {
        return {
          success: false,
          message: 'User not found in any database',
          results: []
        }
      }

      const results = []
      let successCount = 0
      let failureCount = 0

      // Filter by target databases if specified
      const usersToUpdate = targetDatabases
        ? foundUsers.filter(user => targetDatabases.includes(user.database))
        : foundUsers

      // Update password in each database
      for (const user of usersToUpdate) {
        try {
          await this.updateCredential(user.database, user.id, {
            password: newPassword
          })

          results.push({
            database: user.database,
            objectId: user.id,
            success: true,
            message: 'Password updated successfully'
          })
          successCount++
        } catch (error) {
          results.push({
            database: user.database,
            objectId: user.id,
            success: false,
            message: error.message || 'Failed to update password',
            error: error
          })
          failureCount++
        }
      }

      return {
        success: successCount > 0,
        totalFound: foundUsers.length,
        totalUpdated: successCount,
        totalFailed: failureCount,
        results: results,
        message: `Updated ${successCount} of ${usersToUpdate.length} databases`
      }
    } catch (error) {
      console.error('[PasswordVault] Failed to sync password across databases:', error)
      throw error
    }
  }

  /**
   * Generate a secure random password
   * @param {number} length - Password length (default: 16)
   * @param {Object} options - Options { includeSymbols, includeNumbers, includeUppercase }
   * @returns {string} Generated password
   */
  generatePassword(length = 16, options = {}) {
    const {
      includeSymbols = true,
      includeNumbers = true,
      includeUppercase = true,
      includeLowercase = true
    } = options

    let charset = ''
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz'
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    if (includeNumbers) charset += '0123456789'
    if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?'

    if (!charset) {
      charset = 'abcdefghijklmnopqrstuvwxyz0123456789'
    }

    let password = ''
    const array = new Uint32Array(length)
    crypto.getRandomValues(array)

    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length]
    }

    return password
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} True if successful, false otherwise
   */
  async copyToClipboard(text) {
    if (!text) {
      console.warn('[PasswordVault] Cannot copy empty text to clipboard')
      return false
    }

    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch (error) {
        console.error('[PasswordVault] Failed to copy to clipboard:', error)
        // Continue to fallback method
      }
    }

    // Fallback for older browsers or when clipboard API is not available
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textarea)

      if (!successful) {
        console.error('[PasswordVault] Fallback copy method failed')
        return false
      }

      return true
    } catch (error) {
      console.error('[PasswordVault] Fallback copy method error:', error)
      return false
    }
  }

  /**
   * Generate hash of password for comparison
   * Issue #4207: Used to compare passwords without exposing the actual password
   * @param {string} password - Password to hash
   * @returns {Promise<string>} Password hash
   */
  async hashPassword(password) {
    if (!password) return ''

    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  }

  /**
   * Check password synchronization status across databases for a user
   * Issue #4207: Determines if passwords are synchronized across all databases
   * @param {string} username - Username to check
   * @param {boolean} forceRefresh - Force refresh from API
   * @returns {Promise<Object>} Sync status with details
   */
  async checkPasswordSyncStatus(username, forceRefresh = false) {
    try {
      // Find all instances of this user
      const foundUsers = await this.findUserAcrossDatabases(username, forceRefresh)

      if (foundUsers.length === 0) {
        return {
          status: 'not_found',
          icon: '⚪',
          color: 'gray',
          message: 'Пользователь не найден ни в одной базе',
          databases: [],
          details: []
        }
      }

      if (foundUsers.length === 1) {
        const details = await Promise.all(foundUsers.map(async u => ({
          database: u.database,
          passwordHash: u.password ? await this.hashPassword(u.password) : null,
          hasPassword: !!u.password
        })))
        return {
          status: 'single_database',
          icon: '🟢',
          color: 'green',
          message: 'Пользователь только в одной базе',
          databases: [foundUsers[0].database],
          details
        }
      }

      // Check if all passwords are the same
      const passwordHashes = new Map()
      const details = []

      for (const user of foundUsers) {
        const hash = user.password ? await this.hashPassword(user.password) : null
        passwordHashes.set(user.database, hash)
        details.push({
          database: user.database,
          passwordHash: hash,
          hasPassword: !!user.password,
          objectId: user.id
        })
      }

      // Check for missing passwords
      const usersWithoutPassword = foundUsers.filter(u => !u.password)
      if (usersWithoutPassword.length > 0) {
        return {
          status: 'no_access',
          icon: '🔴',
          color: 'red',
          message: `Нет доступа к ${usersWithoutPassword.length} ${usersWithoutPassword.length === 1 ? 'базе' : 'базам'}`,
          databases: foundUsers.map(u => u.database),
          missingIn: usersWithoutPassword.map(u => u.database),
          details: details
        }
      }

      // Compare all password hashes
      const uniqueHashes = new Set(Array.from(passwordHashes.values()).filter(h => h !== null))

      if (uniqueHashes.size === 1) {
        return {
          status: 'synchronized',
          icon: '🟢',
          color: 'green',
          message: 'Пароли во всех базах одинаковые',
          databases: foundUsers.map(u => u.database),
          details: details
        }
      } else {
        // Find which databases have different passwords
        const hashGroups = new Map()
        for (const [db, hash] of passwordHashes.entries()) {
          if (!hashGroups.has(hash)) {
            hashGroups.set(hash, [])
          }
          hashGroups.get(hash).push(db)
        }

        const differentDatabases = []
        const hashArray = Array.from(hashGroups.entries())
        if (hashArray.length > 1) {
          // Find databases with minority hashes (different from the majority)
          const sortedGroups = hashArray.sort((a, b) => b[1].length - a[1].length)
          for (let i = 1; i < sortedGroups.length; i++) {
            differentDatabases.push(...sortedGroups[i][1])
          }
        }

        return {
          status: 'not_synchronized',
          icon: '🟡',
          color: 'yellow',
          message: 'Пароли различаются',
          databases: foundUsers.map(u => u.database),
          differentIn: differentDatabases,
          details: details
        }
      }
    } catch (error) {
      console.error('[PasswordVault] Failed to check sync status:', error)
      return {
        status: 'error',
        icon: '🔴',
        color: 'red',
        message: 'Ошибка при проверке синхронизации',
        databases: [],
        details: [],
        error: error.message
      }
    }
  }

  /**
   * Get password sync status for all users
   * Issue #4207: Batch check sync status for all unique usernames
   * @param {Array} credentials - List of credentials (optional, will fetch all if not provided)
   * @param {boolean} forceRefresh - Force refresh from API
   * @returns {Promise<Map>} Map of username -> sync status
   */
  async getAllPasswordSyncStatuses(credentials = null, forceRefresh = false) {
    const creds = credentials || await this.getAllCredentials(forceRefresh)

    // Get unique usernames
    const usernames = [...new Set(creds.map(c => c.username))]

    const statuses = new Map()

    for (const username of usernames) {
      try {
        const status = await this.checkPasswordSyncStatus(username, false)
        statuses.set(username, status)
      } catch (error) {
        console.error(`[PasswordVault] Failed to check sync status for ${username}:`, error)
        statuses.set(username, {
          status: 'error',
          icon: '🔴',
          color: 'red',
          message: 'Ошибка',
          databases: [],
          details: []
        })
      }
    }

    return statuses
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cachedDatabases = null
    this.cachedCredentials.clear()
  }

  /**
   * Check if service is ready (user authenticated)
   * Checks multiple auth sources used in the project
   * @returns {boolean} True if ready
   */
  isReady() {
    // Check 'my' database token
    const myToken = localStorage.getItem('my_token')
    const myXsrf = localStorage.getItem('my_xsrf')
    if (myToken && myXsrf) return true

    // Check standard auth token
    const token = localStorage.getItem('token')
    const xsrf = localStorage.getItem('_xsrf')
    if (token && xsrf) return true

    // Check integram session
    const integramSession = localStorage.getItem('integram_session')
    if (integramSession) {
      try {
        const session = JSON.parse(integramSession)
        if (session.token) return true
      } catch (e) {
        // Invalid session
      }
    }

    return false
  }
}

// Export singleton instance
export const passwordVaultService = new PasswordVaultService()

// Export class for testing
export { PasswordVaultService }

export default passwordVaultService
