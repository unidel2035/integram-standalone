import express from 'express'
import logger from '../../utils/logger.js'

const router = express.Router()

// Test admin users (Issue #3158)
// In production, this should be replaced with database lookup
const TEST_ADMIN_USERS = [
  {
    id: 'test-admin-1',
    email: 'd@drondoc.ru',
    username: 'd',
    password: 'd', // In production, use bcrypt
    role: 'super_admin',
    displayName: 'Test Admin'
  }
]

/**
 * Admin login endpoint
 * POST /api/admin/login
 *
 * @param {string} email - Admin email
 * @param {string} password - Admin password
 * @param {string} [totp_code] - Optional 2FA code
 *
 * @returns {object} { success, user, role, token }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, totp_code } = req.body

    logger.info('Admin login attempt', { email, hasTotp: !!totp_code })

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      })
    }

    // Find user by email or username
    const user = TEST_ADMIN_USERS.find(
      u => u.email === email || u.username === email
    )

    if (!user) {
      logger.warn('Admin login failed: user not found', { email })
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      })
    }

    // Check password (in production, use bcrypt.compare)
    if (user.password !== password) {
      logger.warn('Admin login failed: wrong password', { email })
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      })
    }

    // For test user, 2FA is optional (Issue #3158)
    // In production, enforce 2FA for admin accounts

    // Generate session token (in production, use JWT or secure session)
    const token = `admin_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('Admin login successful', {
      userId: user.id,
      email: user.email,
      role: user.role
    })

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName
      },
      role: user.role,
      token
    })
  } catch (error) {
    logger.error('Admin login error', { error: error.message, stack: error.stack })
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * Verify admin session
 * GET /api/admin/verify
 *
 * @header {string} Authorization - Bearer token
 * @returns {object} { isAdmin, user, role, token }
 */
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        isAdmin: false,
        error: 'No authorization token provided'
      })
    }

    const token = authHeader.substring(7)

    // In production, verify JWT or check session in database
    // For now, check if token matches pattern
    if (!token.startsWith('admin_')) {
      return res.status(401).json({
        success: false,
        isAdmin: false,
        error: 'Invalid token'
      })
    }

    // Extract user ID from token (simplified for testing)
    const userId = token.split('_')[1]
    const user = TEST_ADMIN_USERS.find(u => u.id === userId)

    if (!user) {
      return res.status(401).json({
        success: false,
        isAdmin: false,
        error: 'User not found'
      })
    }

    return res.json({
      success: true,
      isAdmin: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName
      },
      role: user.role,
      token
    })
  } catch (error) {
    logger.error('Admin verify error', { error: error.message })
    return res.status(500).json({
      success: false,
      isAdmin: false,
      error: 'Internal server error'
    })
  }
})

/**
 * Admin logout
 * POST /api/admin/logout
 *
 * @header {string} Authorization - Bearer token
 * @returns {object} { success }
 */
router.post('/logout', async (req, res) => {
  try {
    // In production, invalidate token/session in database
    logger.info('Admin logout')

    return res.json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    logger.error('Admin logout error', { error: error.message })
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

export default router
