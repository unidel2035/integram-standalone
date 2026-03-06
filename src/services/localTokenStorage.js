/**
 * Local Token Storage Service
 *
 * Provides secure local storage for AI access tokens for any user.
 * Tokens are stored in browser localStorage with encryption for security.
 *
 * Issue #2816 - Store tokens locally for any user
 *
 * Features:
 * - Store tokens locally in browser storage
 * - Encrypt tokens before storage
 * - Support multiple users
 * - Token expiration handling
 * - Secure token retrieval
 * - Token validation
 *
 * Storage Structure:
 * {
 *   version: '1.0',
 *   users: {
 *     'user-id': {
 *       tokens: [
 *         {
 *           id: 'token-id',
 *           name: 'Token name',
 *           tokenValue: 'encrypted-token',
 *           provider: 'deepseek|openai|etc',
 *           model: 'model-name',
 *           createdAt: 'ISO date',
 *           expiresAt: 'ISO date',
 *           balance: 1000000,
 *           dailyLimit: 100000,
 *           monthlyLimit: 1000000,
 *           isDefault: false
 *         }
 *       ]
 *     }
 *   }
 * }
 */

const STORAGE_KEY = 'drondoc_local_tokens'
const STORAGE_VERSION = '1.0'

/**
 * Simple encryption for token values
 * Note: This is basic obfuscation, not cryptographic security
 * For production, consider using Web Crypto API or a proper encryption library
 *
 * @param {string} value - Value to encrypt
 * @param {string} salt - Salt for encryption
 * @returns {string} Encrypted value
 */
function encrypt(value, salt = 'drondoc-2816') {
  if (!value) return ''

  // Base64 encode with simple XOR cipher
  const saltChars = salt.split('')
  const encrypted = value
    .split('')
    .map((char, i) => {
      const saltChar = saltChars[i % saltChars.length]
      return String.fromCharCode(char.charCodeAt(0) ^ saltChar.charCodeAt(0))
    })
    .join('')

  return btoa(encrypted)
}

/**
 * Simple decryption for token values
 *
 * @param {string} encrypted - Encrypted value
 * @param {string} salt - Salt used for encryption
 * @returns {string} Decrypted value
 */
function decrypt(encrypted, salt = 'drondoc-2816') {
  if (!encrypted) return ''

  try {
    const decoded = atob(encrypted)
    const saltChars = salt.split('')

    return decoded
      .split('')
      .map((char, i) => {
        const saltChar = saltChars[i % saltChars.length]
        return String.fromCharCode(char.charCodeAt(0) ^ saltChar.charCodeAt(0))
      })
      .join('')
  } catch (error) {
    console.error('Failed to decrypt token:', error)
    return ''
  }
}

/**
 * Get storage data from localStorage
 *
 * @returns {Object} Storage data structure
 */
function getStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) {
      return {
        version: STORAGE_VERSION,
        users: {}
      }
    }

    const parsed = JSON.parse(data)

    // Validate version
    if (parsed.version !== STORAGE_VERSION) {
      console.warn('Token storage version mismatch, reinitializing')
      return {
        version: STORAGE_VERSION,
        users: {}
      }
    }

    return parsed
  } catch (error) {
    console.error('Failed to read token storage:', error)
    return {
      version: STORAGE_VERSION,
      users: {}
    }
  }
}

/**
 * Save storage data to localStorage
 *
 * @param {Object} data - Storage data structure
 */
function saveStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save token storage:', error)
    throw new Error('Failed to save tokens to local storage')
  }
}

/**
 * Generate unique token ID
 *
 * @returns {string} Unique token ID
 */
function generateTokenId() {
  return `dd_local_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Get all tokens for a specific user
 *
 * @param {string} userId - User identifier
 * @returns {Array} List of user's tokens (with decrypted values)
 */
export function getUserTokens(userId) {
  if (!userId) {
    throw new Error('User ID is required')
  }

  const storage = getStorage()
  const userTokens = storage.users[userId]?.tokens || []

  // Return tokens with decrypted values
  return userTokens.map(token => ({
    ...token,
    tokenValue: decrypt(token.tokenValue)
  }))
}

/**
 * Get a specific token by ID
 *
 * @param {string} userId - User identifier
 * @param {string} tokenId - Token ID
 * @returns {Object|null} Token object or null if not found
 */
export function getToken(userId, tokenId) {
  if (!userId || !tokenId) {
    throw new Error('User ID and Token ID are required')
  }

  const tokens = getUserTokens(userId)
  return tokens.find(t => t.id === tokenId) || null
}

/**
 * Get default token for a user
 *
 * @param {string} userId - User identifier
 * @returns {Object|null} Default token or null if not found
 */
export function getDefaultToken(userId) {
  const tokens = getUserTokens(userId)
  return tokens.find(t => t.isDefault) || tokens[0] || null
}

/**
 * Save a new token for a user
 *
 * @param {string} userId - User identifier
 * @param {Object} tokenData - Token data
 * @param {string} tokenData.name - Token name
 * @param {string} tokenData.tokenValue - Actual token value
 * @param {string} tokenData.provider - Provider name (deepseek, openai, etc.)
 * @param {string} tokenData.model - Model name
 * @param {number} [tokenData.balance] - Initial balance
 * @param {number} [tokenData.dailyLimit] - Daily limit
 * @param {number} [tokenData.monthlyLimit] - Monthly limit
 * @param {Date|string} [tokenData.expiresAt] - Expiration date
 * @param {boolean} [tokenData.isDefault] - Whether this is the default token
 * @returns {Object} Created token
 */
export function saveToken(userId, tokenData) {
  if (!userId) {
    throw new Error('User ID is required')
  }

  if (!tokenData.tokenValue) {
    throw new Error('Token value is required')
  }

  if (!tokenData.provider) {
    throw new Error('Provider is required')
  }

  const storage = getStorage()

  // Initialize user storage if needed
  if (!storage.users[userId]) {
    storage.users[userId] = {
      tokens: []
    }
  }

  // Create token object
  const token = {
    id: generateTokenId(),
    name: tokenData.name || `Token ${storage.users[userId].tokens.length + 1}`,
    tokenValue: encrypt(tokenData.tokenValue),
    provider: tokenData.provider,
    model: tokenData.model || 'default',
    createdAt: new Date().toISOString(),
    expiresAt: tokenData.expiresAt || null,
    balance: tokenData.balance || 1000000,
    dailyLimit: tokenData.dailyLimit || 100000,
    monthlyLimit: tokenData.monthlyLimit || 1000000,
    isDefault: tokenData.isDefault || false,
    metadata: tokenData.metadata || {}
  }

  // If this is set as default, unset other defaults
  if (token.isDefault) {
    storage.users[userId].tokens.forEach(t => {
      t.isDefault = false
    })
  }

  // Add token to user's collection
  storage.users[userId].tokens.push(token)

  // Save to localStorage
  saveStorage(storage)

  // Return token with decrypted value
  return {
    ...token,
    tokenValue: decrypt(token.tokenValue)
  }
}

/**
 * Update an existing token
 *
 * @param {string} userId - User identifier
 * @param {string} tokenId - Token ID
 * @param {Object} updates - Token updates
 * @returns {Object} Updated token
 */
export function updateToken(userId, tokenId, updates) {
  if (!userId || !tokenId) {
    throw new Error('User ID and Token ID are required')
  }

  const storage = getStorage()
  const userTokens = storage.users[userId]?.tokens

  if (!userTokens) {
    throw new Error('User not found')
  }

  const tokenIndex = userTokens.findIndex(t => t.id === tokenId)

  if (tokenIndex === -1) {
    throw new Error('Token not found')
  }

  // Update token fields
  const updatedToken = {
    ...userTokens[tokenIndex],
    ...updates,
    // Prevent changing ID and createdAt
    id: userTokens[tokenIndex].id,
    createdAt: userTokens[tokenIndex].createdAt
  }

  // If tokenValue is being updated, encrypt it
  if (updates.tokenValue) {
    updatedToken.tokenValue = encrypt(updates.tokenValue)
  }

  // If setting as default, unset other defaults
  if (updates.isDefault) {
    userTokens.forEach((t, i) => {
      if (i !== tokenIndex) {
        t.isDefault = false
      }
    })
  }

  // Update in storage
  userTokens[tokenIndex] = updatedToken

  // Save to localStorage
  saveStorage(storage)

  // Return token with decrypted value
  return {
    ...updatedToken,
    tokenValue: decrypt(updatedToken.tokenValue)
  }
}

/**
 * Delete a token
 *
 * @param {string} userId - User identifier
 * @param {string} tokenId - Token ID
 * @returns {boolean} true if deleted successfully
 */
export function deleteToken(userId, tokenId) {
  if (!userId || !tokenId) {
    throw new Error('User ID and Token ID are required')
  }

  const storage = getStorage()
  const userTokens = storage.users[userId]?.tokens

  if (!userTokens) {
    return false
  }

  const tokenIndex = userTokens.findIndex(t => t.id === tokenId)

  if (tokenIndex === -1) {
    return false
  }

  // Remove token
  userTokens.splice(tokenIndex, 1)

  // If no tokens left, remove user from storage
  if (userTokens.length === 0) {
    delete storage.users[userId]
  } else {
    // If deleted token was default, make first token default
    const hasDefault = userTokens.some(t => t.isDefault)
    if (!hasDefault && userTokens.length > 0) {
      userTokens[0].isDefault = true
    }
  }

  // Save to localStorage
  saveStorage(storage)

  return true
}

/**
 * Set a token as default for a user
 *
 * @param {string} userId - User identifier
 * @param {string} tokenId - Token ID
 * @returns {Object} Updated token
 */
export function setDefaultToken(userId, tokenId) {
  return updateToken(userId, tokenId, { isDefault: true })
}

/**
 * Check if a token is expired
 *
 * @param {Object} token - Token object
 * @returns {boolean} true if expired
 */
export function isTokenExpired(token) {
  if (!token.expiresAt) {
    return false
  }

  const expirationDate = new Date(token.expiresAt)
  return expirationDate < new Date()
}

/**
 * Get all active (non-expired) tokens for a user
 *
 * @param {string} userId - User identifier
 * @returns {Array} List of active tokens
 */
export function getActiveTokens(userId) {
  const tokens = getUserTokens(userId)
  return tokens.filter(token => !isTokenExpired(token))
}

/**
 * Clear all tokens for a user
 *
 * @param {string} userId - User identifier
 * @returns {boolean} true if cleared successfully
 */
export function clearUserTokens(userId) {
  if (!userId) {
    throw new Error('User ID is required')
  }

  const storage = getStorage()
  delete storage.users[userId]

  saveStorage(storage)
  return true
}

/**
 * Clear all tokens for all users (use with caution!)
 *
 * @returns {boolean} true if cleared successfully
 */
export function clearAllTokens() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch (error) {
    console.error('Failed to clear all tokens:', error)
    return false
  }
}

/**
 * Export tokens for backup
 *
 * @param {string} userId - User identifier
 * @returns {string} JSON string of user's tokens
 */
export function exportTokens(userId) {
  const tokens = getUserTokens(userId)
  return JSON.stringify(tokens, null, 2)
}

/**
 * Import tokens from backup
 *
 * @param {string} userId - User identifier
 * @param {string} tokensJson - JSON string of tokens
 * @returns {number} Number of tokens imported
 */
export function importTokens(userId, tokensJson) {
  if (!userId) {
    throw new Error('User ID is required')
  }

  try {
    const tokens = JSON.parse(tokensJson)

    if (!Array.isArray(tokens)) {
      throw new Error('Invalid tokens data')
    }

    let importedCount = 0

    tokens.forEach(tokenData => {
      try {
        saveToken(userId, tokenData)
        importedCount++
      } catch (error) {
        console.error('Failed to import token:', error)
      }
    })

    return importedCount
  } catch (error) {
    console.error('Failed to import tokens:', error)
    throw new Error('Failed to import tokens: Invalid JSON format')
  }
}

/**
 * Get storage statistics
 *
 * @returns {Object} Storage statistics
 */
export function getStorageStats() {
  const storage = getStorage()
  const userIds = Object.keys(storage.users)

  const stats = {
    totalUsers: userIds.length,
    totalTokens: 0,
    activeTokens: 0,
    expiredTokens: 0,
    byProvider: {}
  }

  userIds.forEach(userId => {
    const tokens = getUserTokens(userId)
    stats.totalTokens += tokens.length

    tokens.forEach(token => {
      if (isTokenExpired(token)) {
        stats.expiredTokens++
      } else {
        stats.activeTokens++
      }

      stats.byProvider[token.provider] = (stats.byProvider[token.provider] || 0) + 1
    })
  })

  return stats
}

export default {
  getUserTokens,
  getToken,
  getDefaultToken,
  saveToken,
  updateToken,
  deleteToken,
  setDefaultToken,
  isTokenExpired,
  getActiveTokens,
  clearUserTokens,
  clearAllTokens,
  exportTokens,
  importTokens,
  getStorageStats
}
