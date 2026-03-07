/**
 * AI Token Service
 *
 * Service for managing DronDoc AI access tokens and default DeepSeek integration
 * Issue #1211 - Default DeepSeek token for all users and modules
 * Issue #1475 - Sync tokens with Integram API (table 298 - AI token)
 *
 * This service provides a unified interface for:
 * - Getting default DronDoc tokens for users
 * - Accessing system AI configuration
 * - Managing provider API keys (admin only)
 * - Retrieving AI model information
 * - Syncing tokens with Integram database
 */

import apiService from './apiService'
import { getApiUrl } from '../utils/apiConfig'

// Use direct API URL to the monolith backend
// Issue #1504: Connect directly to monolith API without proxy
const API_BASE_URL = getApiUrl('/api')

// Integram table IDs for token management
// INTEGRAM_USER_TABLE_ID = 18 (User table - referenced in getUserTokensFromIntegram)
const INTEGRAM_AI_TOKEN_TABLE_ID = 833 // AI token array table (referenced by table 298)

/**
 * Get or create default DronDoc token for a user
 * This automatically creates a token with DeepSeek access on first call
 *
 * Issue #1542: Added graceful error handling when backend is unavailable
 *
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} { token, defaultModel }
 * @throws {Error} With detailed error message if backend is unavailable or misconfigured
 */
export async function getDefaultToken(userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/ai-tokens/default-token/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: 'Failed to get default token'
      }))

      // Provide helpful error messages based on status code
      if (response.status === 404) {
        throw new Error('AI_BACKEND_NOT_FOUND: Endpoint not found. Backend may not be running or route not configured.')
      } else if (response.status === 500) {
        throw new Error('AI_BACKEND_ERROR: Server error. Database may not be configured or migration not run. See backend logs for details.')
      } else if (response.status === 503) {
        throw new Error('AI_SERVICE_UNAVAILABLE: Backend service is not responding. Please ensure the monolith server is running or try again later.')
      } else if (response.status === 502) {
        throw new Error('AI_GATEWAY_ERROR: Gateway error. The backend proxy may be misconfigured or the service is temporarily unavailable.')
      }

      throw new Error(error.error || error.message || 'Failed to get default token')
    }

    const result = await response.json()
    return result.data
  } catch (error) {
    // Network errors (backend down, CORS, etc.)
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('AI_NETWORK_ERROR: Cannot connect to backend. Please check your network connection and ensure the server is running.')
    }
    // Already structured error - re-throw
    if (error.message && (
      error.message.startsWith('AI_') ||
      error.message.includes('BACKEND') ||
      error.message.includes('SERVICE')
    )) {
      throw error
    }
    // Wrap unknown errors
    throw new Error(`AI_UNKNOWN_ERROR: ${error.message || 'An unexpected error occurred'}`)
  }
}

/**
 * Get system AI configuration
 * Returns information about default AI provider and models
 *
 * @returns {Promise<Object>} { systemConfig, defaultModel, hasDefaultKey }
 */
export async function getSystemAIConfig() {
  const response = await fetch(`${API_BASE_URL}/ai-tokens/system-config`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Failed to get system config'
    }))
    throw new Error(error.error || error.message || 'Failed to get system configuration')
  }

  const result = await response.json()
  return result.data
}

/**
 * Get all available AI providers
 *
 * @returns {Promise<Array>} List of AI providers
 */
export async function getAIProviders() {
  const response = await fetch(`${API_BASE_URL}/ai-tokens/providers`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Failed to get providers'
    }))
    throw new Error(error.error || error.message || 'Failed to get AI providers')
  }

  const result = await response.json()
  return result.data
}

/**
 * Get all available AI models
 * Optionally filter by provider
 *
 * @param {string} [provider] - Provider name to filter by (e.g., 'deepseek', 'openai')
 * @returns {Promise<Array>} List of AI models
 */
export async function getAIModels(provider = null) {
  const url = provider
    ? `${API_BASE_URL}/ai-tokens/models?provider=${encodeURIComponent(provider)}`
    : `${API_BASE_URL}/ai-tokens/models`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Failed to get models'
    }))
    throw new Error(error.error || error.message || 'Failed to get AI models')
  }

  const result = await response.json()
  return result.data
}

/**
 * Get user's AI access tokens from orchestrator
 *
 * @param {string} userId - User identifier
 * @returns {Promise<Array>} List of user's tokens
 */
async function getUserTokensFromOrchestrator(userId) {
  const response = await fetch(`${API_BASE_URL}/ai-tokens/tokens?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Failed to get tokens'
    }))
    throw new Error(error.error || error.message || 'Failed to get user tokens')
  }

  const result = await response.json()
  return result.data
}

/**
 * Authenticate with Integram API (my database)
 * Issue #2748 - Connect to Integram database
 *
 * @returns {Promise<Object>} Session information { sessionId, token, xsrf }
 */
async function authenticateIntegram() {
  try {
    const response = await fetch(`${API_BASE_URL}/integram-test/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        database: 'my',
        login: import.meta.env.VITE_INTEGRAM_LOGIN || '',
        password: import.meta.env.VITE_INTEGRAM_PASSWORD || ''
      })
    })

    if (!response.ok) {
      throw new Error('Failed to authenticate with Integram')
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Authentication failed')
    }

    return {
      sessionId: result.sessionId,
      token: result.token,
      xsrf: result.xsrf
    }
  } catch (error) {
    console.error('Error authenticating with Integram:', error)
    throw error
  }
}

/**
 * Get user's AI access tokens from Integram API (table 298)
 * Issue #1475 - Read tokens from Integram database
 * Issue #2748 - Connect to my database, table 18 (users), table 298 (tokens)
 *
 * @param {string} userId - User identifier (row ID in table 18) - optional
 * @returns {Promise<Array>} List of tokens from Integram
 */
async function getUserTokensFromIntegram(userId) {
  try {
    // First, authenticate with Integram
    const session = await authenticateIntegram()

    // Get metadata for table 18 to understand the structure
    const metadataResponse = await fetch(
      `${API_BASE_URL}/integram-test/metadata/${session.sessionId}/18`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    if (metadataResponse.ok) {
      const metadata = await metadataResponse.json()
      // Metadata retrieved successfully
    }

    // Get all users from table 18
    const usersResponse = await fetch(
      `${API_BASE_URL}/integram-test/object/${session.sessionId}/18`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    if (!usersResponse.ok) {
      throw new Error('Failed to fetch users from Integram')
    }

    const usersData = await usersResponse.json()

    if (!usersData.success || !usersData.data || !usersData.data.rows) {
      return []
    }

    // Find tokens in table 298 field for users
    const tokens = []

    for (const user of usersData.data.rows) {
      // Look for field 298 (AI tokens) in user record
      const tokenField = user.values?.find(v => v.headerId === 298)

      if (tokenField) {
        // If tokenField.value is an ID, fetch nested data from table 298
        if (tokenField.value && tokenField.headRef) {
          // This is a reference to a nested table, fetch the actual data
          try {
            const nestedResponse = await fetch(
              `${API_BASE_URL}/integram-test/object/${session.sessionId}/${tokenField.headRef}?up=${user.id}`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json'
                }
              }
            )

            if (nestedResponse.ok) {
              const nestedData = await nestedResponse.json()

              if (nestedData.success && nestedData.data && nestedData.data.rows) {
                // Map each nested row to a token
                for (const tokenRow of nestedData.data.rows) {
                  const tokenInfo = {}

                  tokenRow.values?.forEach(v => {
                    // Extract token properties based on field IDs
                    // You may need to adjust these field IDs based on actual structure
                    if (v.headerId === 298) {
                      tokenInfo.name = v.value
                    } else if (v.headerId === 125) {
                      tokenInfo.token_value = v.value
                    }
                  })

                  tokens.push({
                    id: `integram-${user.id}-${tokenRow.id}`,
                    name: tokenInfo.name || `Token ${tokenRow.id}`,
                    token_prefix: tokenInfo.token_value
                      ? String(tokenInfo.token_value).substring(0, 15) + '...'
                      : 'N/A',
                    token_balance: 1000000, // Default balance
                    is_active: true,
                    source: 'integram',
                    userId: user.id,
                    created_at: new Date().toISOString(),
                    last_used_at: null
                  })
                }
              }
            }
          } catch (nestedError) {
            console.error('[Integram] Error fetching nested token data:', nestedError)
          }
        } else if (tokenField.value) {
          // Direct value, not a reference
          tokens.push({
            id: `integram-${user.id}-direct`,
            name: `Token for user ${user.id}`,
            token_prefix: String(tokenField.value).substring(0, 15) + '...',
            token_balance: 1000000,
            is_active: true,
            source: 'integram',
            userId: user.id,
            created_at: new Date().toISOString(),
            last_used_at: null
          })
        }
      }
    }

    return tokens
  } catch (error) {
    console.error('Error fetching tokens from Integram:', error)
    // Return empty array on error to not block the main flow
    return []
  }
}

/**
 * Get user's AI access tokens (merged from both orchestrator and Integram)
 * Issue #1475 - Unified token retrieval
 *
 * @param {string} userId - User identifier
 * @returns {Promise<Array>} List of user's tokens from both sources
 */
export async function getUserTokens(userId) {
  try {
    // Fetch from both sources in parallel
    const [orchestratorTokens, integramTokens] = await Promise.all([
      getUserTokensFromOrchestrator(userId).catch(() => []),
      getUserTokensFromIntegram(userId).catch(() => [])
    ])

    // Merge tokens, preferring orchestrator data for duplicates
    const tokenMap = new Map()

    // Add Integram tokens first
    integramTokens.forEach(token => {
      tokenMap.set(token.name || token.id, token)
    })

    // Orchestrator tokens override Integram tokens with same name
    orchestratorTokens.forEach(token => {
      tokenMap.set(token.name || token.id, { ...token, source: 'orchestrator' })
    })

    return Array.from(tokenMap.values())
  } catch (error) {
    console.error('Error getting user tokens:', error)
    throw error
  }
}

/**
 * Save token to Integram API (table 833)
 * Issue #1475 - Write tokens to Integram database
 *
 * @param {string} userId - User ID in Integram (table 18 row ID)
 * @param {Object} tokenData - Token data to save
 * @returns {Promise<Object>} Created token record in Integram
 */
async function saveTokenToIntegram(userId, tokenData) {
  try {
    // Create a new row in table 833 (AI token array table)
    // The row will be linked to the user via table 298 field
    const integramData = {
      // Map token data to Integram field IDs
      // Field 298: Token name
      298: tokenData.name || tokenData.tokenName,
      // Field 125: Token value (only save prefix for security)
      125: tokenData.token_prefix || (tokenData.token ? tokenData.token.substring(0, 15) : ''),
      // Add more field mappings as needed
    }

    const result = await apiService.createRow(INTEGRAM_AI_TOKEN_TABLE_ID, integramData)

    // Link the token to the user if needed
    // This depends on the exact structure of how table 298 relates to table 18
    // May need to update the user record to add this token to the array field

    return result
  } catch (error) {
    console.error('Error saving token to Integram:', error)
    // Don't throw - allow orchestrator save to succeed even if Integram fails
    return null
  }
}

/**
 * Create a new AI access token
 * Issue #1475 - Save to both orchestrator and Integram
 *
 * @param {Object} tokenData - Token creation data
 * @param {string} tokenData.userId - User identifier
 * @param {string} tokenData.tokenName - Name for the token
 * @param {number} tokenData.tokenBalance - Initial token balance
 * @param {number} tokenData.dailyLimit - Daily usage limit
 * @param {number} tokenData.monthlyLimit - Monthly usage limit
 * @param {Date} [tokenData.expiresAt] - Optional expiration date
 * @returns {Promise<Object>} Created token
 */
export async function createToken(tokenData) {
  // Create token in orchestrator (primary source)
  const response = await fetch(`${API_BASE_URL}/ai-tokens/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(tokenData)
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Failed to create token'
    }))
    throw new Error(error.error || error.message || 'Failed to create token')
  }

  const result = await response.json()
  const createdToken = result.data

  // Also save to Integram for unified storage
  try {
    await saveTokenToIntegram(tokenData.userId, createdToken)
  } catch (error) {
    console.warn('Token created in orchestrator but failed to sync to Integram:', error)
    // Continue - don't fail the operation if Integram sync fails
  }

  return createdToken
}

/**
 * Delete token from Integram API
 * Issue #1475 - Delete from Integram database
 *
 * @param {string} tokenId - Token ID (row ID in table 833)
 * @returns {Promise<Object>} Deletion result
 */
async function deleteTokenFromIntegram(tokenId) {
  try {
    const result = await apiService.deleteRow(tokenId)
    return result
  } catch (error) {
    console.error('Error deleting token from Integram:', error)
    return null
  }
}

/**
 * Delete an AI access token
 * Issue #1475 - Delete from both orchestrator and Integram
 *
 * @param {string} tokenId - Token ID to delete
 * @param {string} [source] - Source of the token ('orchestrator' or 'integram')
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteToken(tokenId, source = 'orchestrator') {
  // Delete from orchestrator if it's an orchestrator token
  if (source === 'orchestrator') {
    const response = await fetch(`${API_BASE_URL}/ai-tokens/tokens/${tokenId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: 'Failed to delete token'
      }))
      throw new Error(error.error || error.message || 'Failed to delete token')
    }

    const result = await response.json()
    return result.data
  }

  // Delete from Integram if it's an Integram token
  if (source === 'integram') {
    return await deleteTokenFromIntegram(tokenId)
  }

  throw new Error(`Unknown token source: ${source}`)
}

/**
 * Get token usage statistics
 *
 * @param {string} userId - User identifier
 * @param {Object} options - Query options (startDate, endDate)
 * @returns {Promise<Array>} Usage statistics
 */
export async function getTokenUsageStats(userId, options = {}) {
  const params = new URLSearchParams({ userId })
  if (options.startDate) params.append('startDate', options.startDate)
  if (options.endDate) params.append('endDate', options.endDate)

  const response = await fetch(`${API_BASE_URL}/ai-tokens/usage?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Failed to get usage stats'
    }))
    throw new Error(error.error || error.message || 'Failed to get token usage statistics')
  }

  const result = await response.json()
  return result.data
}

/**
 * Get user's model preferences
 *
 * @param {string} userId - User identifier
 * @param {string} [application] - Application name to filter by
 * @returns {Promise<Array>} Model preferences
 */
export async function getUserPreferences(userId, application = null) {
  const url = application
    ? `${API_BASE_URL}/ai-tokens/preferences/${userId}?application=${encodeURIComponent(application)}`
    : `${API_BASE_URL}/ai-tokens/preferences/${userId}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Failed to get preferences'
    }))
    throw new Error(error.error || error.message || 'Failed to get user preferences')
  }

  const result = await response.json()
  return result.data
}

/**
 * Update user's model preference for an application
 *
 * @param {string} userId - User identifier
 * @param {string} application - Application name
 * @param {string} preferredModelId - UUID of preferred model
 * @param {Object} options - Additional options (accessTokenId, settings)
 * @returns {Promise<Object>} Updated preference
 */
export async function updateUserPreference(userId, application, preferredModelId, options = {}) {
  const response = await fetch(`${API_BASE_URL}/ai-tokens/preferences/${userId}/${application}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      preferredModelId,
      ...options
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Failed to update preference'
    }))
    throw new Error(error.error || error.message || 'Failed to update user preference')
  }

  const result = await response.json()
  return result.data
}

/**
 * Set provider API key (admin only)
 *
 * @param {string} providerName - Provider name (e.g., 'deepseek')
 * @param {string} apiKey - Provider API key
 * @param {Object} options - Additional options (keyName, isDefault)
 * @returns {Promise<Object>} Created/updated key info
 */
export async function setProviderApiKey(providerName, apiKey, options = {}) {
  const response = await fetch(`${API_BASE_URL}/ai-tokens/provider-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      providerName,
      apiKey,
      keyName: options.keyName || 'default',
      isDefault: options.isDefault !== false
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Failed to set provider key'
    }))
    throw new Error(error.error || error.message || 'Failed to set provider API key')
  }

  const result = await response.json()
  return result.data
}

/**
 * Get provider API key information
 * Note: Does not return the actual key, only metadata
 *
 * @param {string} providerName - Provider name
 * @returns {Promise<Array>} Provider key information
 */
export async function getProviderKeyInfo(providerName) {
  const response = await fetch(`${API_BASE_URL}/ai-tokens/provider-keys/${providerName}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Failed to get provider key info'
    }))
    throw new Error(error.error || error.message || 'Failed to get provider key information')
  }

  const result = await response.json()
  return result.data
}

/**
 * Get current user ID from authentication system
 * Enhanced version that finds the correct user ID for ddadmin database
 * @returns {string|null} Current user ID or null if not found
 */
export function getCurrentUserId() {
  // Попробуем получить ID из различных источников
  
  // 1. Специально ищем ID для базы ddadmin
  const ddadminIds = [
    localStorage.getItem('ddadmin_user_id'),
    localStorage.getItem('a2025_user_id'),
    localStorage.getItem('user_id_ddadmin'),
    localStorage.getItem('user_id_a2025'),
    localStorage.getItem('ddadminId'),
    localStorage.getItem('a2025Id')
  ].filter(id => id && id !== 'null' && id !== 'undefined' && id !== '1153') // исключаем проблемный ID
  
  if (ddadminIds.length > 0) {
    console.warn('✅ Found ddadmin user ID:', ddadminIds[0])
    return ddadminIds[0]
  }
  
  // 2. Из localStorage (наиболее надежный источник)
  const localStorageId = localStorage.getItem('user_id') || 
                        localStorage.getItem('id') ||
                        localStorage.getItem('userId') ||
                        localStorage.getItem('user') // иногда user объект
                        
  if (localStorageId && localStorageId !== 'null' && localStorageId !== 'undefined' && localStorageId !== '1153') {
    console.warn('User ID from localStorage:', localStorageId)
    return localStorageId
  }
  
  // 3. Из sessionStorage
  const sessionStorageId = sessionStorage.getItem('user_id') || 
                          sessionStorage.getItem('id') ||
                          sessionStorage.getItem('userId')
  
  if (sessionStorageId && sessionStorageId !== 'null' && sessionStorageId !== 'undefined' && sessionStorageId !== '1153') {
    console.warn('User ID from sessionStorage:', sessionStorageId)
    return sessionStorageId
  }
  
  // 4. Из cookies
  const cookies = document.cookie.split(';')
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if ((name === 'user_id' || name === 'id' || name === 'userId') && value && value !== 'null' && value !== '1153') {
      console.warn('User ID from cookies:', value)
      return value
    }
  }
  
  // 5. Из URL параметров
  const urlParams = new URLSearchParams(window.location.search)
  const urlUserId = urlParams.get('user_id') || urlParams.get('id') || urlParams.get('userId')
  
  if (urlUserId && urlUserId !== '1153') {
    console.warn('User ID from URL params:', urlUserId)
    return urlUserId
  }
  
  // 6. Из объекта user если он сохранен как JSON
  try {
    const userJson = localStorage.getItem('user')
    if (userJson) {
      const userObj = JSON.parse(userJson)
      const userId = userObj.id || userObj.userId || userObj.user_id
      if (userId && userId.toString() !== '1153') {
        console.warn('User ID from user JSON:', userId)
        return userId.toString()
      }
    }
  } catch (error) {
    console.warn('Error parsing user JSON:', error)
  }
  
  // Если ничего не найдено, возвращаем null (не 'anonymous')
  console.warn('⚠️ No valid user ID found - user may not be logged in or using wrong database')
  return null
}

/**
 * Get correct user ID for ddadmin database operations
 * This function specifically looks for user IDs that exist in the ddadmin database
 * @returns {Promise<string|null>} Correct user ID for ddadmin database
 */
export async function getDdadminUserId() {
  try {
    // First try to get from localStorage
    const ddadminIds = [
      localStorage.getItem('ddadmin_user_id'),
      localStorage.getItem('a2025_user_id'),
      localStorage.getItem('user_id_ddadmin'),
      localStorage.getItem('user_id_a2025'),
      localStorage.getItem('ddadminId'),
      localStorage.getItem('a2025Id')
    ].filter(id => id && id !== 'null' && id !== 'undefined' && id !== '1153')
    
    if (ddadminIds.length > 0) {
      console.warn('✅ Found ddadmin user ID in localStorage:', ddadminIds[0])
      return ddadminIds[0]
    }
    
    // If not found in localStorage, try to get from ddadmin database
    console.warn('⚠️ No ddadmin user ID in localStorage, trying to find in database...')
    
    const ddadminToken = localStorage.getItem('ddadmin_token')
    if (!ddadminToken) {
      console.warn('❌ No ddadmin token available')
      return null
    }
    
    // Import ddadminClient dynamically to avoid circular dependencies
    const { default: ddadminClient } = await import('@/ddadminAxios')
    
    // Get users from ddadmin database
    const usersResponse = await ddadminClient.get('/object/18')
    if (usersResponse.data?.response?.rows) {
      const users = usersResponse.data.response.rows
      console.warn('📋 Found users in ddadmin database:', users.length)
      
      // Try to match current user by email
      const currentUserEmail = localStorage.getItem('user_email') || 
                             localStorage.getItem('email') ||
                             localStorage.getItem('userEmail')
      
      if (currentUserEmail) {
        console.warn('🔍 Looking for user with email:', currentUserEmail)
        
        // Create headers map to find email field
        const headersMap = {}
        if (usersResponse.data.response.headers) {
          usersResponse.data.response.headers.forEach(header => {
            headersMap[header.id] = header.value
          })
        }
        
        const matchedUser = users.find(user => {
          const emailField = user.values?.find(v => {
            const headerName = headersMap[v.headerId]
            return headerName && (
              headerName.toLowerCase().includes('email') ||
              headerName.toLowerCase().includes('почта') ||
              headerName.toLowerCase().includes('mail')
            )
          })
          return emailField && emailField.value === currentUserEmail
        })
        
        if (matchedUser) {
          console.warn('✅ Matched user by email:', matchedUser.id)
          return matchedUser.id.toString()
        }
      }
      
      // If no email match, return first available user (but not 1153)
      const validUser = users.find(user => user.id.toString() !== '1153')
      if (validUser) {
        console.warn('⚠️ Using first valid user (not 1153):', validUser.id)
        return validUser.id.toString()
      }
    }
    
    console.warn('❌ No valid user found in ddadmin database')
    return null
    
  } catch (error) {
    console.error('❌ Error getting ddadmin user ID:', error)
    return null
  }
}

/**
 * Helper function to format token balance for display
 *
 * @param {number} balance - Token balance
 * @returns {string} Formatted balance
 */
export function formatTokenBalance(balance) {
  if (balance >= 1000000) {
    return `${(balance / 1000000).toFixed(2)}M`
  } else if (balance >= 1000) {
    return `${(balance / 1000).toFixed(1)}K`
  }
  return balance.toString()
}

/**
 * Helper function to estimate cost for a text
 * Rough estimation: ~1 token per 4 characters for most languages
 *
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
export function estimateTokenCount(text) {
  return Math.ceil(text.length / 4)
}

/**
 * Helper function to calculate cost based on model pricing
 *
 * @param {number} promptTokens - Input tokens
 * @param {number} completionTokens - Output tokens
 * @param {Object} model - Model object with pricing info
 * @returns {number} Estimated cost in USD
 */
export function calculateCost(promptTokens, completionTokens, model) {
  if (!model || !model.cost_per_1k_input || !model.cost_per_1k_output) {
    return 0
  }

  const inputCost = (promptTokens / 1000) * parseFloat(model.cost_per_1k_input)
  const outputCost = (completionTokens / 1000) * parseFloat(model.cost_per_1k_output)

  return inputCost + outputCost
}

export default {
  getDefaultToken,
  getSystemAIConfig,
  getAIProviders,
  getAIModels,
  getUserTokens,
  createToken,
  deleteToken,
  getTokenUsageStats,
  getUserPreferences,
  updateUserPreference,
  setProviderApiKey,
  getProviderKeyInfo,
  getCurrentUserId,
  formatTokenBalance,
  estimateTokenCount,
  calculateCost
}
