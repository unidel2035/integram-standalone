/**
 * Session Manager Service
 *
 * Manages user sessions with JWT tokens:
 * - Session creation and refresh
 * - Device/IP tracking
 * - Session metadata management
 * - Multi-device session handling
 *
 * Issue #2784 - Phase 2: Token Management
 *
 * Note: This service uses local JSON file storage for session metadata
 * while JWT tokens themselves are stateless.
 */

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateTokenPair, hashToken, calculateExpiration, verifyToken } from '../../utils/auth/jwt.js'
import logger from '../../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Session registry file path
const SESSION_REGISTRY_PATH = path.join(__dirname, '../../../data/session_registry.json')

/**
 * Initialize session registry
 * Creates the file if it doesn't exist
 */
async function initializeRegistry() {
  try {
    await fs.access(SESSION_REGISTRY_PATH)
  } catch (error) {
    // File doesn't exist, create it
    const initialData = {
      sessions: {},
      userSessionMap: {},
    }
    await saveRegistry(initialData)
    logger.info('Session registry initialized')
  }
}

/**
 * Load session registry from file
 * @returns {Promise<Object>} Session registry data
 */
async function loadRegistry() {
  try {
    const data = await fs.readFile(SESSION_REGISTRY_PATH, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to load session registry')
    return { sessions: {}, userSessionMap: {} }
  }
}

/**
 * Save session registry to file
 * @param {Object} data - Registry data to save
 */
async function saveRegistry(data) {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(SESSION_REGISTRY_PATH)
    await fs.mkdir(dataDir, { recursive: true })

    await fs.writeFile(SESSION_REGISTRY_PATH, JSON.stringify(data, null, 2))
    logger.debug('Session registry saved')
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to save session registry')
    throw error
  }
}

/**
 * Generate session ID
 * @returns {string} Session ID
 */
function generateSessionId() {
  return `session_${crypto.randomBytes(16).toString('hex')}`
}

/**
 * Parse User-Agent to extract device info
 * @param {string} userAgent - User agent string
 * @returns {Object} Device information
 */
function parseUserAgent(userAgent) {
  if (!userAgent) {
    return { deviceType: 'unknown', browser: 'unknown' }
  }

  let deviceType = 'desktop'
  if (/mobile/i.test(userAgent)) deviceType = 'mobile'
  else if (/tablet/i.test(userAgent)) deviceType = 'tablet'

  let browser = 'unknown'
  if (/chrome/i.test(userAgent)) browser = 'Chrome'
  else if (/firefox/i.test(userAgent)) browser = 'Firefox'
  else if (/safari/i.test(userAgent)) browser = 'Safari'
  else if (/edge/i.test(userAgent)) browser = 'Edge'

  // Extract version
  const versionMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/)
  if (versionMatch) {
    browser = `${versionMatch[1]} ${versionMatch[2]}`
  }

  return { deviceType, browser }
}

/**
 * Create a new session for user
 *
 * @param {Object} user - User object (must have id, username, email)
 * @param {Object} deviceInfo - Device information
 * @param {string} deviceInfo.ip - IP address
 * @param {string} deviceInfo.userAgent - User agent string
 * @returns {Promise<Object>} Session with tokens
 */
export async function createSession(user, deviceInfo = {}) {
  await initializeRegistry()

  const sessionId = generateSessionId()
  const now = new Date().toISOString()

  // Generate JWT token pair
  const { accessToken, refreshToken, expiresIn } = generateTokenPair(user)

  // Hash tokens for storage (for revocation purposes)
  const accessTokenHash = hashToken(accessToken)
  const refreshTokenHash = hashToken(refreshToken)

  // Calculate expiration dates
  const accessExpires = calculateExpiration(expiresIn)
  const refreshExpires = calculateExpiration(
    process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d'
  )

  // Parse user agent
  const parsedDevice = parseUserAgent(deviceInfo.userAgent)

  const session = {
    id: sessionId,
    userId: user.id,
    accessTokenHash,
    refreshTokenHash,
    deviceInfo: {
      userAgent: deviceInfo.userAgent || 'unknown',
      ip: deviceInfo.ip || 'unknown',
      deviceType: parsedDevice.deviceType,
      browser: parsedDevice.browser,
    },
    createdAt: now,
    expiresAt: accessExpires.toISOString(),
    refreshExpiresAt: refreshExpires.toISOString(),
    lastActivityAt: now,
    status: 'active',
  }

  // Save to registry
  const registry = await loadRegistry()
  registry.sessions[sessionId] = session

  if (!registry.userSessionMap[user.id]) {
    registry.userSessionMap[user.id] = []
  }
  registry.userSessionMap[user.id].push(sessionId)

  await saveRegistry(registry)

  logger.info(
    { userId: user.id, sessionId, ip: deviceInfo.ip },
    'Session created'
  )

  return {
    sessionId,
    accessToken,
    refreshToken,
    expiresIn,
    tokenType: 'Bearer',
  }
}

/**
 * Refresh session tokens
 * Generates new access and refresh tokens
 *
 * @param {string} refreshToken - Current refresh token
 * @returns {Promise<Object>} New tokens
 */
export async function refreshSession(refreshToken) {
  await initializeRegistry()

  // Verify refresh token
  let payload
  try {
    payload = verifyToken(refreshToken)
  } catch (error) {
    throw new Error('Invalid or expired refresh token')
  }

  // Find session by refresh token hash
  const refreshTokenHash = hashToken(refreshToken)
  const registry = await loadRegistry()

  let session = null
  for (const sessionId in registry.sessions) {
    if (registry.sessions[sessionId].refreshTokenHash === refreshTokenHash) {
      session = registry.sessions[sessionId]
      break
    }
  }

  if (!session) {
    throw new Error('Session not found')
  }

  if (session.status !== 'active') {
    throw new Error('Session is not active')
  }

  // Check if refresh token expired
  const now = new Date()
  const refreshExpires = new Date(session.refreshExpiresAt)
  if (now > refreshExpires) {
    throw new Error('Refresh token expired')
  }

  // Generate new token pair
  const user = {
    id: payload.userId,
    username: payload.username,
    email: payload.email,
  }

  const { accessToken, refreshToken: newRefreshToken, expiresIn } = generateTokenPair(user)

  // Update session with new token hashes
  const newAccessTokenHash = hashToken(accessToken)
  const newRefreshTokenHash = hashToken(newRefreshToken)

  const accessExpires = calculateExpiration(expiresIn)
  const newRefreshExpires = calculateExpiration(
    process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '7d'
  )

  session.accessTokenHash = newAccessTokenHash
  session.refreshTokenHash = newRefreshTokenHash
  session.expiresAt = accessExpires.toISOString()
  session.refreshExpiresAt = newRefreshExpires.toISOString()
  session.lastActivityAt = new Date().toISOString()

  await saveRegistry(registry)

  logger.info({ userId: session.userId, sessionId: session.id }, 'Session refreshed')

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn,
    tokenType: 'Bearer',
  }
}

/**
 * Validate session by access token
 *
 * @param {string} accessToken - Access token to validate
 * @returns {Promise<Object>} Session info with user payload
 */
export async function validateSession(accessToken) {
  await initializeRegistry()

  // Verify JWT token
  let payload
  try {
    payload = verifyToken(accessToken)
  } catch (error) {
    throw new Error('Invalid or expired access token')
  }

  // Find session by access token hash
  const accessTokenHash = hashToken(accessToken)
  const registry = await loadRegistry()

  let session = null
  for (const sessionId in registry.sessions) {
    if (registry.sessions[sessionId].accessTokenHash === accessTokenHash) {
      session = registry.sessions[sessionId]
      break
    }
  }

  if (!session) {
    throw new Error('Session not found')
  }

  if (session.status !== 'active') {
    throw new Error('Session is not active')
  }

  // Update last activity
  session.lastActivityAt = new Date().toISOString()
  await saveRegistry(registry)

  return {
    sessionId: session.id,
    userId: session.userId,
    user: {
      id: payload.userId,
      username: payload.username,
      email: payload.email,
    },
    deviceInfo: session.deviceInfo,
  }
}

/**
 * Revoke (invalidate) a session
 *
 * @param {string} sessionId - Session ID to revoke
 * @returns {Promise<Object>} Revoked session
 */
export async function revokeSession(sessionId) {
  await initializeRegistry()

  const registry = await loadRegistry()
  const session = registry.sessions[sessionId]

  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }

  session.status = 'revoked'
  session.revokedAt = new Date().toISOString()

  await saveRegistry(registry)

  logger.info({ sessionId, userId: session.userId }, 'Session revoked')

  return session
}

/**
 * Get all active sessions for a user
 *
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of active sessions
 */
export async function getUserSessions(userId) {
  await initializeRegistry()

  const registry = await loadRegistry()
  const sessionIds = registry.userSessionMap[userId] || []

  const now = new Date()

  const sessions = sessionIds
    .map(sessionId => registry.sessions[sessionId])
    .filter(session => {
      if (!session || session.status !== 'active') return false

      // Check if session expired
      const expiresAt = new Date(session.refreshExpiresAt)
      return now < expiresAt
    })
    .map(session => ({
      id: session.id,
      deviceInfo: session.deviceInfo,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
    }))

  return sessions
}

/**
 * Revoke all sessions for a user (logout everywhere)
 *
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of sessions revoked
 */
export async function revokeAllSessions(userId) {
  await initializeRegistry()

  const registry = await loadRegistry()
  const sessionIds = registry.userSessionMap[userId] || []

  let revokedCount = 0
  const now = new Date().toISOString()

  for (const sessionId of sessionIds) {
    const session = registry.sessions[sessionId]
    if (session && session.status === 'active') {
      session.status = 'revoked'
      session.revokedAt = now
      revokedCount++
    }
  }

  await saveRegistry(registry)

  logger.info({ userId, revokedCount }, 'All user sessions revoked')

  return revokedCount
}

/**
 * Clean up expired sessions (maintenance task)
 * Should be called periodically by a cron job
 *
 * @returns {Promise<number>} Number of sessions cleaned up
 */
export async function cleanupExpiredSessions() {
  await initializeRegistry()

  const registry = await loadRegistry()
  const now = new Date()

  let cleanedCount = 0

  for (const sessionId in registry.sessions) {
    const session = registry.sessions[sessionId]
    const refreshExpires = new Date(session.refreshExpiresAt)

    if (now > refreshExpires) {
      delete registry.sessions[sessionId]

      // Remove from userSessionMap
      if (registry.userSessionMap[session.userId]) {
        registry.userSessionMap[session.userId] = registry.userSessionMap[
          session.userId
        ].filter(id => id !== sessionId)
      }

      cleanedCount++
    }
  }

  await saveRegistry(registry)

  logger.info({ cleanedCount }, 'Expired sessions cleaned up')

  return cleanedCount
}

export default {
  createSession,
  refreshSession,
  validateSession,
  revokeSession,
  getUserSessions,
  revokeAllSessions,
  cleanupExpiredSessions,
}
