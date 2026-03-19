/**
 * Token Management API Routes
 *
 * Unified token management endpoints:
 * - AI tokens (create, get, recharge, revoke)
 * - Sessions (get active, refresh, logout)
 * - Multi-device session management
 *
 * Issue #2784 - Phase 2: Token Management
 */

import express from 'express'
import { body, param, validationResult } from 'express-validator'
import * as tokenManager from '../../services/user-sync/tokenManagerService.js'
import * as sessionManager from '../../services/user-sync/sessionManagerService.js'
import * as integramProxy from '../../services/user-sync/integramProxyService.js'
import { verifyToken } from '../../utils/auth/jwt.js'
import logger from '../../utils/logger.js'

const router = express.Router()

/**
 * Middleware to extract user from JWT token
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'No authorization token provided',
    })
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  try {
    const payload = verifyToken(token)
    req.user = {
      id: payload.userId,
      username: payload.username,
      email: payload.email,
    }
    next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    })
  }
}

/**
 * Validation middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    })
  }
  next()
}

// ========================
// AI Token Endpoints
// ========================

/**
 * GET /api/tokens/my-tokens
 * Get all tokens (AI tokens + session info) for current user
 */
router.get('/my-tokens', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id

    // Get AI tokens
    const aiTokens = await tokenManager.getTokensByUser(userId)

    // Get active sessions
    const sessions = await sessionManager.getUserSessions(userId)

    res.json({
      success: true,
      data: {
        aiTokens,
        sessions,
        summary: {
          totalAITokens: aiTokens.length,
          totalSessions: sessions.length,
          totalBalance: aiTokens.reduce((sum, t) => sum + t.balance, 0),
        },
      },
    })
  } catch (error) {
    logger.error({ error: error.message, userId: req.user.id }, 'Failed to get user tokens')

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tokens',
    })
  }
})

/**
 * POST /api/tokens/create-token
 * Create new AI token for current user
 */
router.post(
  '/create-token',
  authenticateJWT,
  [
    body('type').optional().isIn(['default', 'custom', 'premium']),
    body('provider').optional().isString(),
    body('modelId').optional().isString(),
    body('balance').optional().isInt({ min: 0 }),
    body('dailyLimit').optional().isInt({ min: 0 }),
    body('monthlyLimit').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    try {
      const userId = req.user.id
      const { type, provider, modelId, balance, dailyLimit, monthlyLimit } = req.body

      let token

      if (type === 'default' || !type) {
        // Create default token (DeepSeek, 1M tokens)
        token = await tokenManager.createDefaultToken(userId, modelId)
      } else {
        // Create custom token with specified options
        token = await tokenManager.createCustomToken(userId, {
          type,
          provider,
          modelId,
          balance,
          dailyLimit,
          monthlyLimit,
        })
      }

      logger.info({ userId, tokenId: token.id, type: token.type }, 'AI token created')

      res.status(201).json({
        success: true,
        data: token,
      })
    } catch (error) {
      logger.error({ error: error.message, userId: req.user.id }, 'Failed to create token')

      res.status(500).json({
        success: false,
        error: 'Failed to create token',
      })
    }
  }
)

/**
 * PUT /api/tokens/:tokenId/recharge
 * Recharge (add balance to) an AI token
 */
router.put(
  '/:tokenId/recharge',
  authenticateJWT,
  [
    param('tokenId').isString(),
    body('amount').isInt({ min: 1 }).withMessage('Amount must be positive'),
  ],
  validate,
  async (req, res) => {
    try {
      const { tokenId } = req.params
      const { amount } = req.body
      const userId = req.user.id

      // Get token to verify ownership
      const token = await tokenManager.getTokenById(tokenId)

      if (!token) {
        return res.status(404).json({
          success: false,
          error: 'Token not found',
        })
      }

      if (token.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You do not own this token',
        })
      }

      // Update balance
      const updatedToken = await tokenManager.updateTokenBalance(tokenId, amount)

      logger.info({ userId, tokenId, amount }, 'Token recharged')

      res.json({
        success: true,
        data: updatedToken,
      })
    } catch (error) {
      logger.error({ error: error.message, userId: req.user.id }, 'Failed to recharge token')

      res.status(500).json({
        success: false,
        error: 'Failed to recharge token',
      })
    }
  }
)

/**
 * DELETE /api/tokens/:tokenId
 * Revoke (deactivate) an AI token
 */
router.delete(
  '/:tokenId',
  authenticateJWT,
  [param('tokenId').isString()],
  validate,
  async (req, res) => {
    try {
      const { tokenId } = req.params
      const userId = req.user.id

      // Get token to verify ownership
      const token = await tokenManager.getTokenById(tokenId)

      if (!token) {
        return res.status(404).json({
          success: false,
          error: 'Token not found',
        })
      }

      if (token.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You do not own this token',
        })
      }

      // Revoke token
      const revokedToken = await tokenManager.revokeToken(tokenId)

      logger.info({ userId, tokenId }, 'Token revoked')

      res.json({
        success: true,
        data: revokedToken,
      })
    } catch (error) {
      logger.error({ error: error.message, userId: req.user.id }, 'Failed to revoke token')

      res.status(500).json({
        success: false,
        error: 'Failed to revoke token',
      })
    }
  }
)

// ========================
// Session Endpoints
// ========================

/**
 * GET /api/sessions/active
 * Get all active sessions for current user
 */
router.get('/sessions/active', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id

    const sessions = await sessionManager.getUserSessions(userId)

    res.json({
      success: true,
      data: sessions,
    })
  } catch (error) {
    logger.error({ error: error.message, userId: req.user.id }, 'Failed to get active sessions')

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active sessions',
    })
  }
})

/**
 * POST /api/sessions/refresh
 * Refresh access token using refresh token
 */
router.post(
  '/sessions/refresh',
  [body('refreshToken').isString().withMessage('Refresh token is required')],
  validate,
  async (req, res) => {
    try {
      const { refreshToken } = req.body

      const tokens = await sessionManager.refreshSession(refreshToken)

      logger.info('Session refreshed')

      res.json({
        success: true,
        data: tokens,
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to refresh session')

      res.status(401).json({
        success: false,
        error: error.message || 'Failed to refresh session',
      })
    }
  }
)

/**
 * DELETE /api/sessions/:sessionId
 * Revoke (end) a specific session
 */
router.delete(
  '/sessions/:sessionId',
  authenticateJWT,
  [param('sessionId').isString()],
  validate,
  async (req, res) => {
    try {
      const { sessionId } = req.params
      const userId = req.user.id

      // Revoke session
      const revokedSession = await sessionManager.revokeSession(sessionId)

      // Verify ownership (check if session belongs to user)
      if (revokedSession.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You do not own this session',
        })
      }

      logger.info({ userId, sessionId }, 'Session revoked')

      res.json({
        success: true,
        message: 'Session revoked successfully',
      })
    } catch (error) {
      logger.error({ error: error.message, userId: req.user.id }, 'Failed to revoke session')

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to revoke session',
      })
    }
  }
)

/**
 * DELETE /api/sessions/logout-all
 * Revoke all sessions for current user (logout everywhere)
 */
router.delete('/sessions/logout-all', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id

    const revokedCount = await sessionManager.revokeAllSessions(userId)

    logger.info({ userId, revokedCount }, 'All sessions revoked')

    res.json({
      success: true,
      message: `Successfully logged out from ${revokedCount} device(s)`,
      data: { revokedCount },
    })
  } catch (error) {
    logger.error({ error: error.message, userId: req.user.id }, 'Failed to revoke all sessions')

    res.status(500).json({
      success: false,
      error: 'Failed to logout from all devices',
    })
  }
})

// ========================
// Integram Proxy Endpoints
// ========================

/**
 * POST /api/tokens/integram/authenticate
 * Authenticate with Integram and cache token
 */
router.post(
  '/integram/authenticate',
  authenticateJWT,
  [
    body('username').isString().withMessage('Username is required'),
    body('password').isString().withMessage('Password is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const userId = req.user.id
      const { username, password } = req.body

      const result = await integramProxy.authenticateUser(userId, username, password)

      if (result.success) {
        logger.info({ userId, username }, 'Integram authentication successful')

        res.json({
          success: true,
          data: {
            token: result.token,
            expiresAt: result.expiresAt,
          },
        })
      } else {
        res.status(401).json({
          success: false,
          error: result.error || 'Integram authentication failed',
        })
      }
    } catch (error) {
      logger.error({ error: error.message, userId: req.user.id }, 'Integram authentication error')

      res.status(500).json({
        success: false,
        error: 'Integram authentication error',
      })
    }
  }
)

/**
 * GET /api/tokens/integram/cache-stats
 * Get Integram token cache statistics (admin only)
 */
router.get('/integram/cache-stats', authenticateJWT, async (req, res) => {
  try {
    const stats = integramProxy.getCacheStats()

    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get cache stats')

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cache statistics',
    })
  }
})

/**
 * DELETE /api/tokens/integram/clear-cache
 * Clear cached Integram token for current user
 */
router.delete('/integram/clear-cache', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id

    integramProxy.clearCache(userId)

    logger.info({ userId }, 'Integram cache cleared')

    res.json({
      success: true,
      message: 'Cache cleared successfully',
    })
  } catch (error) {
    logger.error({ error: error.message, userId: req.user.id }, 'Failed to clear cache')

    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
    })
  }
})

export default router
