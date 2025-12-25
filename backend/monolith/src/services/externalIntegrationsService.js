/**
 * External Integrations Service
 *
 * Manages integrations with external applications and services:
 * - Slack, Microsoft Teams, Google Workspace
 * - Trello, Asana, Miro, Figma
 * - Cloud storage (Yandex.Disk, Google Drive, OneDrive)
 * - CRM systems (Salesforce, HubSpot)
 * - Automation platforms (Zapier, Make)
 *
 * Handles OAuth2 flows, API keys, webhooks, and integration configurations.
 */

import crypto from 'crypto'
import logger from '../utils/logger.js'

// In-memory storage for OAuth states (use Redis in production)
const oauthStates = new Map()

// In-memory storage for integration configurations (use database in production)
const integrationConfigs = new Map()

/**
 * Provider configurations for external integrations
 */
const PROVIDER_CONFIGS = {
  slack: {
    name: 'Slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['chat:write', 'commands', 'channels:read', 'users:read', 'im:write'],
    requiresOAuth: true,
    requiresWebhook: true
  },
  'microsoft-teams': {
    name: 'Microsoft Teams',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['User.Read', 'Calendars.ReadWrite', 'Files.ReadWrite.All', 'OnlineMeetings.ReadWrite'],
    requiresOAuth: true,
    requiresWebhook: true
  },
  'google-workspace': {
    name: 'Google Workspace',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/drive'],
    requiresOAuth: true,
    requiresWebhook: false
  },
  trello: {
    name: 'Trello',
    authUrl: 'https://trello.com/1/authorize',
    tokenUrl: 'https://api.trello.com/1/OAuthGetAccessToken',
    scopes: ['read', 'write'],
    requiresOAuth: true,
    requiresApiKey: true,
    requiresWebhook: true
  },
  asana: {
    name: 'Asana',
    authUrl: 'https://app.asana.com/-/oauth_authorize',
    tokenUrl: 'https://app.asana.com/-/oauth_token',
    scopes: [],
    requiresOAuth: true,
    requiresWebhook: true
  },
  miro: {
    name: 'Miro',
    authUrl: 'https://miro.com/oauth/authorize',
    tokenUrl: 'https://api.miro.com/v1/oauth/token',
    scopes: ['boards:read', 'boards:write'],
    requiresOAuth: true,
    requiresWebhook: false
  },
  figma: {
    name: 'Figma',
    authUrl: 'https://www.figma.com/oauth',
    tokenUrl: 'https://www.figma.com/api/oauth/token',
    scopes: ['file_read'],
    requiresOAuth: true,
    requiresWebhook: false
  },
  'yandex-disk': {
    name: 'Яндекс.Диск',
    authUrl: 'https://oauth.yandex.ru/authorize',
    tokenUrl: 'https://oauth.yandex.ru/token',
    scopes: ['cloud_api:disk.read', 'cloud_api:disk.write'],
    requiresOAuth: true,
    requiresWebhook: false
  },
  'google-drive': {
    name: 'Google Drive',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    requiresOAuth: true,
    requiresWebhook: false
  },
  onedrive: {
    name: 'OneDrive',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['Files.ReadWrite', 'Files.ReadWrite.All'],
    requiresOAuth: true,
    requiresWebhook: false
  },
  salesforce: {
    name: 'Salesforce',
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    scopes: ['api', 'refresh_token'],
    requiresOAuth: true,
    requiresWebhook: true
  },
  hubspot: {
    name: 'HubSpot',
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    scopes: ['contacts', 'crm.objects.contacts.read', 'crm.objects.contacts.write'],
    requiresOAuth: true,
    requiresApiKey: true,
    requiresWebhook: true
  },
  zapier: {
    name: 'Zapier',
    requiresOAuth: false,
    requiresApiKey: true,
    requiresWebhook: true
  },
  make: {
    name: 'Make',
    requiresOAuth: false,
    requiresApiKey: true,
    requiresWebhook: true
  }
}

/**
 * Generate OAuth state for CSRF protection
 * @returns {string} Random state string
 */
export function generateOAuthState() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Build OAuth authorization URL
 * @param {string} provider - Provider ID (slack, microsoft-teams, etc.)
 * @param {string} redirectUri - Callback URL
 * @returns {Object} { authUrl, state }
 */
export function buildAuthorizationUrl(provider, redirectUri) {
  const config = PROVIDER_CONFIGS[provider]

  if (!config) {
    throw new Error(`Unknown provider: ${provider}`)
  }

  if (!config.requiresOAuth) {
    throw new Error(`Provider ${provider} does not support OAuth`)
  }

  const state = generateOAuthState()
  const stateData = {
    provider,
    redirectUri,
    createdAt: Date.now()
  }

  oauthStates.set(state, stateData)

  // Clean up old states (older than 10 minutes)
  const tenMinutesAgo = Date.now() - 600000
  for (const [key, value] of oauthStates.entries()) {
    if (value.createdAt < tenMinutesAgo) {
      oauthStates.delete(key)
    }
  }

  // Get client ID from environment
  const clientIdKey = `${provider.toUpperCase().replace(/-/g, '_')}_CLIENT_ID`
  const clientId = process.env[clientIdKey]

  if (!clientId) {
    throw new Error(`Missing client ID for provider ${provider}: ${clientIdKey}`)
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: state
  })

  if (config.scopes && config.scopes.length > 0) {
    params.append('scope', config.scopes.join(' '))
  }

  const authUrl = `${config.authUrl}?${params.toString()}`

  logger.info(`Built OAuth URL for ${provider}`, { provider, state })

  return { authUrl, state }
}

/**
 * Verify OAuth state
 * @param {string} state - State parameter from callback
 * @returns {Object|null} State data or null if invalid
 */
export function verifyOAuthState(state) {
  const stateData = oauthStates.get(state)

  if (!stateData) {
    return null
  }

  // Check if state is not too old (10 minutes)
  const tenMinutesAgo = Date.now() - 600000
  if (stateData.createdAt < tenMinutesAgo) {
    oauthStates.delete(state)
    return null
  }

  // Remove state after verification (one-time use)
  oauthStates.delete(state)

  return stateData
}

/**
 * Exchange OAuth code for access token
 * @param {string} provider - Provider ID
 * @param {string} code - Authorization code
 * @param {string} redirectUri - Callback URL
 * @returns {Promise<Object>} Token data
 */
export async function exchangeCodeForToken(provider, code, redirectUri) {
  const config = PROVIDER_CONFIGS[provider]

  if (!config || !config.requiresOAuth) {
    throw new Error(`Invalid OAuth provider: ${provider}`)
  }

  const clientIdKey = `${provider.toUpperCase().replace(/-/g, '_')}_CLIENT_ID`
  const clientSecretKey = `${provider.toUpperCase().replace(/-/g, '_')}_CLIENT_SECRET`

  const clientId = process.env[clientIdKey]
  const clientSecret = process.env[clientSecretKey]

  if (!clientId || !clientSecret) {
    throw new Error(`Missing credentials for provider ${provider}`)
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret
  })

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token exchange failed: ${error}`)
    }

    const data = await response.json()

    logger.info(`Successfully exchanged code for token`, { provider })

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope
    }
  } catch (error) {
    logger.error(`Failed to exchange code for token`, { provider, error: error.message })
    throw error
  }
}

/**
 * Save integration configuration
 * @param {string} userId - User ID
 * @param {string} provider - Provider ID
 * @param {Object} config - Configuration data
 * @returns {Promise<Object>} Saved configuration
 */
export async function saveIntegrationConfig(userId, provider, config) {
  const key = `${userId}:${provider}`

  const integrationData = {
    userId,
    provider,
    config,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  integrationConfigs.set(key, integrationData)

  logger.info(`Saved integration config`, { userId, provider })

  // TODO: Save to database instead of in-memory storage
  // const result = await query(
  //   'INSERT INTO integration_configs (user_id, provider, config, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
  //   [userId, provider, JSON.stringify(config)]
  // )

  return integrationData
}

/**
 * Get integration configuration
 * @param {string} userId - User ID
 * @param {string} provider - Provider ID
 * @returns {Promise<Object|null>} Configuration or null
 */
export async function getIntegrationConfig(userId, provider) {
  const key = `${userId}:${provider}`

  const config = integrationConfigs.get(key)

  if (!config) {
    logger.debug(`Integration config not found`, { userId, provider })
    return null
  }

  logger.debug(`Retrieved integration config`, { userId, provider })

  // TODO: Retrieve from database instead of in-memory storage
  // const result = await query(
  //   'SELECT * FROM integration_configs WHERE user_id = $1 AND provider = $2',
  //   [userId, provider]
  // )

  return config
}

/**
 * Delete integration configuration
 * @param {string} userId - User ID
 * @param {string} provider - Provider ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteIntegrationConfig(userId, provider) {
  const key = `${userId}:${provider}`

  const existed = integrationConfigs.has(key)
  integrationConfigs.delete(key)

  logger.info(`Deleted integration config`, { userId, provider, existed })

  // TODO: Delete from database instead of in-memory storage
  // const result = await query(
  //   'DELETE FROM integration_configs WHERE user_id = $1 AND provider = $2',
  //   [userId, provider]
  // )

  return existed
}

/**
 * Get all user integrations
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of integrations
 */
export async function getUserIntegrations(userId) {
  const userIntegrations = []

  for (const [key, config] of integrationConfigs.entries()) {
    if (config.userId === userId) {
      userIntegrations.push(config)
    }
  }

  logger.debug(`Retrieved user integrations`, { userId, count: userIntegrations.length })

  // TODO: Retrieve from database instead of in-memory storage
  // const result = await query(
  //   'SELECT * FROM integration_configs WHERE user_id = $1',
  //   [userId]
  // )

  return userIntegrations
}

/**
 * Generate webhook URL for integration
 * @param {string} provider - Provider ID
 * @param {string} userId - User ID (optional)
 * @returns {string} Webhook URL
 */
export function generateWebhookUrl(provider, userId = null) {
  const baseUrl = process.env.API_BASE_URL || 'https://drondoc.ru'

  if (userId) {
    return `${baseUrl}/api/webhooks/${provider}/${userId}`
  }

  return `${baseUrl}/api/webhooks/${provider}`
}

/**
 * Validate API key format
 * @param {string} apiKey - API key to validate
 * @returns {boolean} Valid or not
 */
export function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false
  }

  // Basic validation: at least 16 characters
  return apiKey.length >= 16
}

/**
 * Get provider configuration
 * @param {string} provider - Provider ID
 * @returns {Object|null} Provider config
 */
export function getProviderConfig(provider) {
  return PROVIDER_CONFIGS[provider] || null
}

/**
 * Get all available providers
 * @returns {Array} List of provider IDs
 */
export function getAvailableProviders() {
  return Object.keys(PROVIDER_CONFIGS)
}

export default {
  generateOAuthState,
  buildAuthorizationUrl,
  verifyOAuthState,
  exchangeCodeForToken,
  saveIntegrationConfig,
  getIntegrationConfig,
  deleteIntegrationConfig,
  getUserIntegrations,
  generateWebhookUrl,
  validateApiKey,
  getProviderConfig,
  getAvailableProviders
}
