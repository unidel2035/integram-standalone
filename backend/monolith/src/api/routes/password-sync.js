/**
 * Password Sync API Routes
 *
 * Provides RESTful API endpoints for password management with Bitwarden integration
 * and synchronization across Integram databases.
 *
 * Endpoints:
 * - POST /api/password-sync/change - Change password with Bitwarden sync
 * - POST /api/password-sync/reset - Reset password (admin)
 * - POST /api/password-sync/sync-from-bitwarden - Sync from Bitwarden to Integram
 * - GET /api/password-sync/list/:userId - List user passwords from Bitwarden
 * - DELETE /api/password-sync/:userId/:database - Delete password from Bitwarden
 * - POST /api/password-sync/verify - Verify password from Bitwarden
 *
 * Issue #4132 - Синхронизация пароль в базе Интеграм с Bitwarden
 */

import express from 'express'
import { body, param, validationResult } from 'express-validator'
import {
  changePasswordWithBitwarden,
  resetPasswordWithBitwarden,
  syncPasswordFromBitwarden,
  listUserPasswordsFromBitwarden,
  deletePasswordFromBitwardenVault,
  verifyPasswordFromBitwarden
} from '../../services/user-sync/enhancedPasswordSyncService.js'
import logger from '../../utils/logger.js'

const router = express.Router()

/**
 * Validation error handler
 */
function handleValidationErrors(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    })
  }
  return null
}

/**
 * POST /api/password-sync/change
 * Change user password with Bitwarden integration
 *
 * Body:
 * - userId: User ID
 * - currentPassword: Current password
 * - newPassword: New password
 * - metadata: Optional metadata (ip, userAgent, etc.)
 */
router.post('/change', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
], async (req, res) => {
  const validationError = handleValidationErrors(req, res)
  if (validationError) return validationError

  const { userId, currentPassword, newPassword, metadata = {} } = req.body

  try {
    logger.info({ userId }, 'API: Change password with Bitwarden')

    const result = await changePasswordWithBitwarden(
      userId,
      currentPassword,
      newPassword,
      {
        ...metadata,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    )

    res.json({
      success: result.success,
      message: result.message,
      data: {
        bitwarden: {
          successCount: result.bitwarden.successCount,
          totalCount: result.bitwarden.totalCount,
          failedDatabases: result.bitwarden.failedDatabases || []
        },
        integram: {
          successCount: result.integram.successCount,
          totalCount: result.integram.totalCount,
          failedDatabases: result.integram.failedDatabases || []
        },
        duration: result.duration
      }
    })
  } catch (error) {
    logger.error({ userId, error: error.message }, 'API: Failed to change password')

    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/password-sync/reset
 * Reset user password (admin operation)
 *
 * Body:
 * - userId: User ID
 * - newPassword: New password
 * - adminId: Admin user ID
 * - reason: Reason for reset
 */
router.post('/reset', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  body('adminId').notEmpty().withMessage('Admin ID is required'),
], async (req, res) => {
  const validationError = handleValidationErrors(req, res)
  if (validationError) return validationError

  const { userId, newPassword, adminId, reason = 'Admin reset' } = req.body

  try {
    logger.info({ userId, adminId }, 'API: Reset password with Bitwarden')

    const result = await resetPasswordWithBitwarden(
      userId,
      newPassword,
      {
        adminId,
        reason,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    )

    res.json({
      success: result.success,
      message: result.message,
      data: {
        bitwarden: {
          successCount: result.bitwarden.successCount,
          totalCount: result.bitwarden.totalCount,
          failedDatabases: result.bitwarden.failedDatabases || []
        },
        integram: {
          successCount: result.integram.successCount,
          totalCount: result.integram.totalCount,
          failedDatabases: result.integram.failedDatabases || []
        },
        duration: result.duration
      }
    })
  } catch (error) {
    logger.error({ userId, adminId, error: error.message }, 'API: Failed to reset password')

    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/password-sync/sync-from-bitwarden
 * Sync password from Bitwarden to Integram databases
 *
 * Body:
 * - userId: User ID
 * - database: Database name
 */
router.post('/sync-from-bitwarden', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('database').notEmpty().withMessage('Database name is required'),
], async (req, res) => {
  const validationError = handleValidationErrors(req, res)
  if (validationError) return validationError

  const { userId, database } = req.body

  try {
    logger.info({ userId, database }, 'API: Sync password from Bitwarden')

    const result = await syncPasswordFromBitwarden(userId, database)

    res.json({
      success: result.success,
      message: result.message,
      data: {
        bitwarden: result.bitwarden,
        integram: result.integram,
        duration: result.duration
      }
    })
  } catch (error) {
    logger.error({ userId, database, error: error.message }, 'API: Failed to sync from Bitwarden')

    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/password-sync/list/:userId
 * List all passwords stored in Bitwarden for a user
 */
router.get('/list/:userId', [
  param('userId').notEmpty().withMessage('User ID is required'),
], async (req, res) => {
  const validationError = handleValidationErrors(req, res)
  if (validationError) return validationError

  const { userId } = req.params

  try {
    logger.info({ userId }, 'API: List user passwords from Bitwarden')

    const result = await listUserPasswordsFromBitwarden(userId)

    res.json({
      success: result.success,
      data: {
        passwords: result.passwords,
        count: result.count
      }
    })
  } catch (error) {
    logger.error({ userId, error: error.message }, 'API: Failed to list passwords')

    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * DELETE /api/password-sync/:userId/:database
 * Delete password from Bitwarden for specific database
 */
router.delete('/:userId/:database', [
  param('userId').notEmpty().withMessage('User ID is required'),
  param('database').notEmpty().withMessage('Database name is required'),
], async (req, res) => {
  const validationError = handleValidationErrors(req, res)
  if (validationError) return validationError

  const { userId, database } = req.params

  try {
    logger.info({ userId, database }, 'API: Delete password from Bitwarden')

    const result = await deletePasswordFromBitwardenVault(userId, database)

    res.json({
      success: result.success,
      message: result.message,
      data: {
        secretId: result.secretId
      }
    })
  } catch (error) {
    logger.error({ userId, database, error: error.message }, 'API: Failed to delete password')

    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/password-sync/verify
 * Verify password from Bitwarden
 *
 * Body:
 * - userId: User ID
 * - database: Database name
 * - password: Plain text password to verify
 */
router.post('/verify', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('database').notEmpty().withMessage('Database name is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const validationError = handleValidationErrors(req, res)
  if (validationError) return validationError

  const { userId, database, password } = req.body

  try {
    logger.info({ userId, database }, 'API: Verify password from Bitwarden')

    const isValid = await verifyPasswordFromBitwarden(userId, database, password)

    res.json({
      success: true,
      data: {
        isValid
      }
    })
  } catch (error) {
    logger.error({ userId, database, error: error.message }, 'API: Failed to verify password')

    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/password-sync/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'password-sync-api',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

export default router
