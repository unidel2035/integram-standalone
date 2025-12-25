/**
 * Token Manager Service
 *
 * Manages unified token system:
 * - AI tokens (via Integram DronDoc API)
 * - Token metadata and lifecycle
 * - User-token relationships
 *
 * Issue #2784 - Phase 2: Token Management
 */

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import logger from '../../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Token registry file path
const TOKEN_REGISTRY_PATH = path.join(__dirname, '../../../data/token_registry.json')

// Default token configuration (Issue #1211 - DeepSeek default)
const DEFAULT_TOKEN_CONFIG = {
  provider: 'deepseek',
  balance: 1000000, // 1M tokens
  dailyLimit: 100000, // 100K tokens per day
  monthlyLimit: 1000000, // 1M tokens per month
  tokenType: 'default',
}

/**
 * Initialize token registry
 * Creates the file if it doesn't exist
 */
async function initializeRegistry() {
  try {
    await fs.access(TOKEN_REGISTRY_PATH)
  } catch (error) {
    // File doesn't exist, create it
    const initialData = {
      tokens: {},
      userTokenMap: {},
    }
    await saveRegistry(initialData)
    logger.info('Token registry initialized')
  }
}

/**
 * Load token registry from file
 * @returns {Promise<Object>} Token registry data
 */
async function loadRegistry() {
  try {
    const data = await fs.readFile(TOKEN_REGISTRY_PATH, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to load token registry')
    return { tokens: {}, userTokenMap: {} }
  }
}

/**
 * Save token registry to file
 * @param {Object} data - Registry data to save
 */
async function saveRegistry(data) {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(TOKEN_REGISTRY_PATH)
    await fs.mkdir(dataDir, { recursive: true })

    await fs.writeFile(TOKEN_REGISTRY_PATH, JSON.stringify(data, null, 2))
    logger.debug('Token registry saved')
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to save token registry')
    throw error
  }
}

/**
 * Generate a new AI token ID
 * @returns {string} Token ID with dd_tok_ prefix
 */
function generateTokenId() {
  const randomBytes = crypto.randomBytes(16)
  return `dd_tok_${randomBytes.toString('hex')}`
}

/**
 * Create default AI token for user
 * Uses DeepSeek as default provider (Issue #1211)
 *
 * @param {string} userId - User ID
 * @param {string} modelId - Model UUID (optional, uses default if not provided)
 * @returns {Promise<Object>} Created token
 */
export async function createDefaultToken(userId, modelId = null) {
  await initializeRegistry()

  const tokenId = generateTokenId()
  const now = new Date().toISOString()

  const token = {
    id: tokenId,
    userId,
    type: 'default',
    provider: DEFAULT_TOKEN_CONFIG.provider,
    modelId: modelId || 'default-deepseek-model', // TODO: Get actual model ID
    balance: DEFAULT_TOKEN_CONFIG.balance,
    dailyLimit: DEFAULT_TOKEN_CONFIG.dailyLimit,
    monthlyLimit: DEFAULT_TOKEN_CONFIG.monthlyLimit,
    usageStats: {
      totalUsed: 0,
      today: 0,
      thisMonth: 0,
      lastResetDate: now,
    },
    integramRecordId: null, // Will be set after Integram API call
    createdAt: now,
    status: 'active',
  }

  // Save to local registry
  const registry = await loadRegistry()
  registry.tokens[tokenId] = token

  if (!registry.userTokenMap[userId]) {
    registry.userTokenMap[userId] = []
  }
  registry.userTokenMap[userId].push(tokenId)

  await saveRegistry(registry)

  logger.info({ userId, tokenId, type: 'default' }, 'Default token created')

  // TODO: Create token in Integram API (table 298)
  // This will be implemented when integramProxyService is ready

  return token
}

/**
 * Create custom AI token with specific configuration
 *
 * @param {string} userId - User ID
 * @param {Object} options - Token options
 * @param {string} options.provider - AI provider (deepseek, openai, etc.)
 * @param {string} options.modelId - Model UUID
 * @param {number} options.balance - Initial token balance
 * @param {number} options.dailyLimit - Daily usage limit
 * @param {number} options.monthlyLimit - Monthly usage limit
 * @param {string} options.type - Token type (custom, premium, etc.)
 * @returns {Promise<Object>} Created token
 */
export async function createCustomToken(userId, options = {}) {
  await initializeRegistry()

  const tokenId = generateTokenId()
  const now = new Date().toISOString()

  const token = {
    id: tokenId,
    userId,
    type: options.type || 'custom',
    provider: options.provider || 'deepseek',
    modelId: options.modelId || null,
    balance: options.balance || DEFAULT_TOKEN_CONFIG.balance,
    dailyLimit: options.dailyLimit || DEFAULT_TOKEN_CONFIG.dailyLimit,
    monthlyLimit: options.monthlyLimit || DEFAULT_TOKEN_CONFIG.monthlyLimit,
    usageStats: {
      totalUsed: 0,
      today: 0,
      thisMonth: 0,
      lastResetDate: now,
    },
    integramRecordId: options.integramRecordId || null,
    createdAt: now,
    status: 'active',
  }

  // Save to local registry
  const registry = await loadRegistry()
  registry.tokens[tokenId] = token

  if (!registry.userTokenMap[userId]) {
    registry.userTokenMap[userId] = []
  }
  registry.userTokenMap[userId].push(tokenId)

  await saveRegistry(registry)

  logger.info({ userId, tokenId, type: token.type }, 'Custom token created')

  return token
}

/**
 * Get all tokens for a user
 *
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of user tokens
 */
export async function getTokensByUser(userId) {
  await initializeRegistry()

  const registry = await loadRegistry()
  const tokenIds = registry.userTokenMap[userId] || []

  const tokens = tokenIds
    .map(tokenId => registry.tokens[tokenId])
    .filter(token => token && token.status === 'active')

  return tokens
}

/**
 * Get token by ID
 *
 * @param {string} tokenId - Token ID
 * @returns {Promise<Object|null>} Token or null if not found
 */
export async function getTokenById(tokenId) {
  await initializeRegistry()

  const registry = await loadRegistry()
  return registry.tokens[tokenId] || null
}

/**
 * Update token balance
 *
 * @param {string} tokenId - Token ID
 * @param {number} amount - Amount to add/subtract (negative to deduct)
 * @returns {Promise<Object>} Updated token
 */
export async function updateTokenBalance(tokenId, amount) {
  await initializeRegistry()

  const registry = await loadRegistry()
  const token = registry.tokens[tokenId]

  if (!token) {
    throw new Error(`Token ${tokenId} not found`)
  }

  token.balance += amount

  // Update usage stats
  if (amount < 0) {
    token.usageStats.totalUsed += Math.abs(amount)
    token.usageStats.today += Math.abs(amount)
    token.usageStats.thisMonth += Math.abs(amount)
  }

  await saveRegistry(registry)

  logger.info({ tokenId, amount, newBalance: token.balance }, 'Token balance updated')

  return token
}

/**
 * Revoke (deactivate) a token
 *
 * @param {string} tokenId - Token ID
 * @returns {Promise<Object>} Revoked token
 */
export async function revokeToken(tokenId) {
  await initializeRegistry()

  const registry = await loadRegistry()
  const token = registry.tokens[tokenId]

  if (!token) {
    throw new Error(`Token ${tokenId} not found`)
  }

  token.status = 'revoked'
  token.revokedAt = new Date().toISOString()

  await saveRegistry(registry)

  logger.info({ tokenId }, 'Token revoked')

  return token
}

/**
 * Link token to user (for existing tokens)
 *
 * @param {string} tokenId - Token ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated token
 */
export async function linkTokenToUser(tokenId, userId) {
  await initializeRegistry()

  const registry = await loadRegistry()
  const token = registry.tokens[tokenId]

  if (!token) {
    throw new Error(`Token ${tokenId} not found`)
  }

  // Update token's userId
  token.userId = userId

  // Add to userTokenMap
  if (!registry.userTokenMap[userId]) {
    registry.userTokenMap[userId] = []
  }

  if (!registry.userTokenMap[userId].includes(tokenId)) {
    registry.userTokenMap[userId].push(tokenId)
  }

  await saveRegistry(registry)

  logger.info({ tokenId, userId }, 'Token linked to user')

  return token
}

/**
 * Reset daily usage stats (called by cron job)
 * Resets 'today' counter for all tokens
 */
export async function resetDailyUsage() {
  await initializeRegistry()

  const registry = await loadRegistry()
  const now = new Date().toISOString()
  let resetCount = 0

  for (const tokenId in registry.tokens) {
    const token = registry.tokens[tokenId]
    if (token.status === 'active') {
      token.usageStats.today = 0
      token.usageStats.lastResetDate = now
      resetCount++
    }
  }

  await saveRegistry(registry)

  logger.info({ resetCount }, 'Daily usage stats reset')

  return resetCount
}

/**
 * Reset monthly usage stats (called by cron job)
 * Resets 'thisMonth' counter for all tokens
 */
export async function resetMonthlyUsage() {
  await initializeRegistry()

  const registry = await loadRegistry()
  const now = new Date().toISOString()
  let resetCount = 0

  for (const tokenId in registry.tokens) {
    const token = registry.tokens[tokenId]
    if (token.status === 'active') {
      token.usageStats.thisMonth = 0
      token.usageStats.lastResetDate = now
      resetCount++
    }
  }

  await saveRegistry(registry)

  logger.info({ resetCount }, 'Monthly usage stats reset')

  return resetCount
}

/**
 * Check if token has sufficient balance and within limits
 *
 * @param {string} tokenId - Token ID
 * @param {number} requestedTokens - Number of tokens requested
 * @returns {Promise<Object>} {allowed: boolean, reason: string}
 */
export async function checkTokenAvailability(tokenId, requestedTokens) {
  const token = await getTokenById(tokenId)

  if (!token) {
    return { allowed: false, reason: 'Token not found' }
  }

  if (token.status !== 'active') {
    return { allowed: false, reason: 'Token is not active' }
  }

  if (token.balance < requestedTokens) {
    return { allowed: false, reason: 'Insufficient balance' }
  }

  if (token.usageStats.today + requestedTokens > token.dailyLimit) {
    return { allowed: false, reason: 'Daily limit exceeded' }
  }

  if (token.usageStats.thisMonth + requestedTokens > token.monthlyLimit) {
    return { allowed: false, reason: 'Monthly limit exceeded' }
  }

  return { allowed: true, reason: 'OK' }
}

export default {
  createDefaultToken,
  createCustomToken,
  getTokensByUser,
  getTokenById,
  updateTokenBalance,
  revokeToken,
  linkTokenToUser,
  resetDailyUsage,
  resetMonthlyUsage,
  checkTokenAvailability,
}
