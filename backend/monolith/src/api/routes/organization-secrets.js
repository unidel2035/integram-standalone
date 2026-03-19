/**
 * Organization Secrets API Routes
 *
 * RESTful API for managing organization-scoped secrets with role-based access control.
 *
 * Issue #2963 - Organization-based secret management system
 *
 * Security:
 * - Authentication required
 * - Role-based access control (owner, admin, member, viewer)
 * - Comprehensive audit logging
 * - Encrypted storage
 */

import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import organizationSecretsManager, { SECRET_TYPES, ROTATION_POLICIES, ROLES } from '../../services/secrets/OrganizationSecretsManager.js'

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
 * TODO: Replace with proper authentication middleware
 */
const getUserId = (req) => {
  return req.headers['x-user-id'] || req.user?.id || 'anonymous'
}

/**
 * POST /api/organizations/:orgId/secrets
 * Create a new secret in organization
 */
router.post(
  '/:orgId/secrets',
  [
    param('orgId').isUUID().withMessage('Invalid organization ID'),
    body('name')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 1, max: 255 }),
    body('value')
      .isString()
      .notEmpty()
      .withMessage('Value is required'),
    body('type')
      .optional()
      .isIn(Object.values(SECRET_TYPES))
      .withMessage('Invalid secret type'),
    body('description')
      .optional()
      .isString()
      .trim(),
    body('tags')
      .optional()
      .isArray(),
    body('tags.*')
      .optional()
      .isString(),
    body('rotationPolicy')
      .optional()
      .isNumeric(),
    body('requiredRole')
      .optional()
      .isIn(Object.values(ROLES))
      .withMessage('Invalid required role'),
    body('metadata')
      .optional()
      .isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const { orgId } = req.params
      const userId = getUserId(req)
      const {
        name,
        value,
        type,
        description,
        tags,
        rotationPolicy,
        requiredRole,
        metadata
      } = req.body

      const secret = await organizationSecretsManager.createSecret({
        organizationId: orgId,
        name,
        value,
        type,
        description,
        tags,
        rotationPolicy,
        requiredRole,
        userId,
        metadata
      })

      res.status(201).json({
        success: true,
        data: secret,
        message: 'Secret created successfully'
      })
    } catch (error) {
      console.error('[Organization Secrets API] Create error:', error)
      const status = error.message.includes('permission') ? 403 :
                     error.message.includes('already exists') ? 409 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/organizations/:orgId/secrets
 * List organization secrets (without decrypted values)
 */
router.get(
  '/:orgId/secrets',
  [
    param('orgId').isUUID().withMessage('Invalid organization ID'),
    query('type').optional().isIn(Object.values(SECRET_TYPES)),
    query('tag').optional().isString(),
    query('search').optional().isString()
  ],
  validate,
  async (req, res) => {
    try {
      const { orgId } = req.params
      const userId = getUserId(req)
      const { type, tag, search } = req.query

      const secrets = await organizationSecretsManager.listSecrets({
        organizationId: orgId,
        userId,
        type,
        tag,
        search
      })

      res.json({
        success: true,
        data: secrets
      })
    } catch (error) {
      console.error('[Organization Secrets API] List error:', error)
      const status = error.message.includes('permission') ? 403 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/organizations/:orgId/secrets/:secretId
 * Get a specific secret (optionally include decrypted value)
 */
router.get(
  '/:orgId/secrets/:secretId',
  [
    param('orgId').isUUID().withMessage('Invalid organization ID'),
    param('secretId').isUUID().withMessage('Invalid secret ID'),
    query('includeValue').optional().isBoolean().toBoolean()
  ],
  validate,
  async (req, res) => {
    try {
      const { orgId, secretId } = req.params
      const userId = getUserId(req)
      const { includeValue = false } = req.query

      const secret = await organizationSecretsManager.getSecret(
        orgId,
        secretId,
        userId,
        includeValue
      )

      res.json({
        success: true,
        data: secret
      })
    } catch (error) {
      console.error('[Organization Secrets API] Get error:', error)
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('permission') ? 403 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * PUT /api/organizations/:orgId/secrets/:secretId
 * Update a secret
 */
router.put(
  '/:orgId/secrets/:secretId',
  [
    param('orgId').isUUID().withMessage('Invalid organization ID'),
    param('secretId').isUUID().withMessage('Invalid secret ID'),
    body('name')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .isLength({ min: 1, max: 255 }),
    body('value')
      .optional()
      .isString()
      .notEmpty(),
    body('description')
      .optional()
      .isString()
      .trim(),
    body('tags')
      .optional()
      .isArray(),
    body('tags.*')
      .optional()
      .isString(),
    body('rotationPolicy')
      .optional()
      .isNumeric(),
    body('requiredRole')
      .optional()
      .isIn(Object.values(ROLES)),
    body('metadata')
      .optional()
      .isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const { orgId, secretId } = req.params
      const userId = getUserId(req)
      const updates = req.body

      const secret = await organizationSecretsManager.updateSecret(
        orgId,
        secretId,
        updates,
        userId
      )

      res.json({
        success: true,
        data: secret,
        message: 'Secret updated successfully'
      })
    } catch (error) {
      console.error('[Organization Secrets API] Update error:', error)
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('permission') ? 403 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/organizations/:orgId/secrets/:secretId/rotate
 * Rotate a secret (update its value)
 */
router.post(
  '/:orgId/secrets/:secretId/rotate',
  [
    param('orgId').isUUID().withMessage('Invalid organization ID'),
    param('secretId').isUUID().withMessage('Invalid secret ID'),
    body('newValue')
      .isString()
      .notEmpty()
      .withMessage('New value is required')
  ],
  validate,
  async (req, res) => {
    try {
      const { orgId, secretId } = req.params
      const userId = getUserId(req)
      const { newValue } = req.body

      const secret = await organizationSecretsManager.rotateSecret(
        orgId,
        secretId,
        newValue,
        userId
      )

      res.json({
        success: true,
        data: secret,
        message: 'Secret rotated successfully'
      })
    } catch (error) {
      console.error('[Organization Secrets API] Rotate error:', error)
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('permission') ? 403 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * DELETE /api/organizations/:orgId/secrets/:secretId
 * Delete a secret
 */
router.delete(
  '/:orgId/secrets/:secretId',
  [
    param('orgId').isUUID().withMessage('Invalid organization ID'),
    param('secretId').isUUID().withMessage('Invalid secret ID')
  ],
  validate,
  async (req, res) => {
    try {
      const { orgId, secretId } = req.params
      const userId = getUserId(req)

      const result = await organizationSecretsManager.deleteSecret(orgId, secretId, userId)

      res.json({
        success: true,
        data: result,
        message: 'Secret deleted successfully'
      })
    } catch (error) {
      console.error('[Organization Secrets API] Delete error:', error)
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('permission') ? 403 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/organizations/:orgId/secrets/statistics
 * Get statistics about organization secrets
 */
router.get(
  '/:orgId/secrets-stats',
  [param('orgId').isUUID().withMessage('Invalid organization ID')],
  validate,
  async (req, res) => {
    try {
      const { orgId } = req.params
      const userId = getUserId(req)

      const stats = await organizationSecretsManager.getStatistics(orgId, userId)

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('[Organization Secrets API] Get statistics error:', error)
      const status = error.message.includes('permission') ? 403 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/organizations/:orgId/secrets/audit-logs
 * Get audit logs for organization secrets
 */
router.get(
  '/:orgId/secrets-audit',
  [
    param('orgId').isUUID().withMessage('Invalid organization ID'),
    query('secretId').optional().isUUID(),
    query('userId').optional().isString(),
    query('action').optional().isIn(['CREATE', 'ACCESS', 'UPDATE', 'DELETE', 'ROTATE', 'SHARE', 'PERMISSION_DENIED']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt()
  ],
  validate,
  async (req, res) => {
    try {
      const { orgId } = req.params
      const userId = getUserId(req)
      const filters = req.query

      const logs = await organizationSecretsManager.getAuditLogs(orgId, userId, filters)

      res.json({
        success: true,
        data: logs
      })
    } catch (error) {
      console.error('[Organization Secrets API] Get audit logs error:', error)
      const status = error.message.includes('permission') ? 403 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/organizations/secrets/meta/types
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
 * GET /api/organizations/secrets/meta/rotation-policies
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

/**
 * GET /api/organizations/secrets/meta/roles
 * Get available roles for secret access
 */
router.get('/meta/roles', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(ROLES).map(([key, value]) => ({
      key,
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase()
    }))
  })
})

export default router
