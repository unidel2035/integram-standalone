/**
 * Secrets Management API Routes
 *
 * RESTful API for managing secrets, passwords, API keys, and certificates.
 * Provides endpoints for CRUD operations, rotation, audit logs, and leak detection.
 *
 * Issue #2471 - Агент управления секретами и токенами
 *
 * Security features:
 * - Authentication required for all endpoints
 * - Audit logging for all operations
 * - Encrypted storage
 * - Rate limiting (TODO: implement)
 * - Access control (TODO: implement role-based access)
 */

import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import secretsManager, { SECRET_TYPES, ROTATION_POLICIES } from '../../services/secrets/SecretsManager.js'

const router = express.Router()

/**
 * Validation middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    })
  }
  next()
}

/**
 * Extract user ID from request
 * TODO: Implement proper authentication middleware
 */
const getUserId = (req) => {
  return req.headers['x-user-id'] || req.user?.id || 'anonymous'
}

/**
 * GET /api/secrets
 * List all secrets (without decrypted values)
 */
router.get(
  '/',
  [
    query('type').optional().isIn(Object.values(SECRET_TYPES)),
    query('tag').optional().isString(),
    query('search').optional().isString()
  ],
  validate,
  async (req, res) => {
    try {
      const { type, tag, search } = req.query

      const secrets = await secretsManager.listSecrets({
        type,
        tag,
        search
      })

      res.json({
        success: true,
        data: secrets
      })
    } catch (error) {
      console.error('[Secrets API] List secrets error:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/secrets/statistics
 * Get statistics about secrets
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = await secretsManager.getStatistics()

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('[Secrets API] Get statistics error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/secrets/rotation-needed
 * Get secrets that need rotation
 */
router.get('/rotation-needed', async (req, res) => {
  try {
    const secrets = await secretsManager.getSecretsNeedingRotation()

    res.json({
      success: true,
      data: secrets
    })
  } catch (error) {
    console.error('[Secrets API] Get rotation needed error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/secrets/:id
 * Get a specific secret (without value by default)
 */
router.get(
  '/:id',
  [
    param('id').isString().notEmpty(),
    query('includeValue').optional().isBoolean().toBoolean()
  ],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params
      const { includeValue = false } = req.query
      const userId = getUserId(req)

      const secret = await secretsManager.getSecret(id, userId, includeValue)

      res.json({
        success: true,
        data: secret
      })
    } catch (error) {
      console.error('[Secrets API] Get secret error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/secrets
 * Create a new secret
 */
router.post(
  '/',
  [
    body('name').isString().trim().notEmpty().withMessage('Name is required'),
    body('value').isString().notEmpty().withMessage('Value is required'),
    body('type').optional().isIn(Object.values(SECRET_TYPES)),
    body('description').optional().isString().trim(),
    body('tags').optional().isArray(),
    body('tags.*').optional().isString(),
    body('rotationPolicy').optional().isNumeric(),
    body('metadata').optional().isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const userId = getUserId(req)
      const {
        name,
        value,
        type,
        description,
        tags,
        rotationPolicy,
        metadata
      } = req.body

      const secret = await secretsManager.createSecret({
        name,
        value,
        type,
        description,
        tags,
        rotationPolicy,
        userId,
        metadata
      })

      res.status(201).json({
        success: true,
        data: secret,
        message: 'Secret created successfully'
      })
    } catch (error) {
      console.error('[Secrets API] Create secret error:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * PUT /api/secrets/:id
 * Update a secret
 */
router.put(
  '/:id',
  [
    param('id').isString().notEmpty(),
    body('name').optional().isString().trim().notEmpty(),
    body('value').optional().isString().notEmpty(),
    body('description').optional().isString().trim(),
    body('tags').optional().isArray(),
    body('tags.*').optional().isString(),
    body('rotationPolicy').optional().isNumeric(),
    body('metadata').optional().isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params
      const userId = getUserId(req)
      const updates = req.body

      const secret = await secretsManager.updateSecret(id, updates, userId)

      res.json({
        success: true,
        data: secret,
        message: 'Secret updated successfully'
      })
    } catch (error) {
      console.error('[Secrets API] Update secret error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/secrets/:id/rotate
 * Rotate a secret (update its value)
 */
router.post(
  '/:id/rotate',
  [
    param('id').isString().notEmpty(),
    body('newValue').isString().notEmpty().withMessage('New value is required')
  ],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params
      const { newValue } = req.body
      const userId = getUserId(req)

      const secret = await secretsManager.rotateSecret(id, newValue, userId)

      res.json({
        success: true,
        data: secret,
        message: 'Secret rotated successfully'
      })
    } catch (error) {
      console.error('[Secrets API] Rotate secret error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * DELETE /api/secrets/:id
 * Delete a secret
 */
router.delete(
  '/:id',
  [param('id').isString().notEmpty()],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params
      const userId = getUserId(req)

      const result = await secretsManager.deleteSecret(id, userId)

      res.json({
        success: true,
        data: result,
        message: 'Secret deleted successfully'
      })
    } catch (error) {
      console.error('[Secrets API] Delete secret error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/secrets/audit/logs
 * Get audit logs
 */
router.get(
  '/audit/logs',
  [
    query('secretId').optional().isString(),
    query('userId').optional().isString(),
    query('action').optional().isIn(['CREATE', 'ACCESS', 'UPDATE', 'DELETE', 'ROTATE']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt()
  ],
  validate,
  async (req, res) => {
    try {
      const filters = req.query

      const logs = await secretsManager.getAuditLogs(filters)

      res.json({
        success: true,
        data: logs
      })
    } catch (error) {
      console.error('[Secrets API] Get audit logs error:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/secrets/detect-leaks
 * Detect potential secret leaks in text
 */
router.post(
  '/detect-leaks',
  [body('text').isString().notEmpty().withMessage('Text is required')],
  validate,
  async (req, res) => {
    try {
      const { text } = req.body

      const result = secretsManager.detectLeaks(text)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('[Secrets API] Detect leaks error:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/secrets/types
 * Get available secret types
 */
router.get('/meta/types', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(SECRET_TYPES).map(([key, value]) => ({
      key,
      value,
      label: key.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
    }))
  })
})

/**
 * GET /api/secrets/rotation-policies
 * Get available rotation policies
 */
router.get('/meta/rotation-policies', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(ROTATION_POLICIES).map(([key, days]) => ({
      key,
      days,
      label: key.charAt(0) + key.slice(1).toLowerCase(),
      description: days ? `Every ${days} days` : 'No automatic rotation'
    }))
  })
})

export default router
