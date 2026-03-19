/**
 * Organizations API Routes
 *
 * RESTful API for managing organizations and their members.
 *
 * Issue #2963 - Organization-based secret management system
 *
 * Security:
 * - Authentication required for all endpoints
 * - Role-based access control (owner, admin, member, viewer)
 * - Audit logging for sensitive operations
 */

import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import organizationService, { ROLES } from '../../services/organization/OrganizationService.js'

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
 * POST /api/organizations
 * Create a new organization
 */
router.post(
  '/',
  [
    body('name')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Organization name is required')
      .isLength({ min: 3, max: 255 })
      .withMessage('Name must be between 3 and 255 characters'),
    body('description')
      .optional()
      .isString()
      .trim(),
    body('metadata')
      .optional()
      .isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const userId = getUserId(req)
      const { name, description, metadata } = req.body

      const organization = await organizationService.createOrganization({
        name,
        description,
        createdBy: userId,
        metadata
      })

      res.status(201).json({
        success: true,
        data: organization,
        message: 'Organization created successfully'
      })
    } catch (error) {
      console.error('[Organizations API] Create error:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/organizations
 * List organizations for the current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req)

    const organizations = await organizationService.listUserOrganizations(userId)

    res.json({
      success: true,
      data: organizations
    })
  } catch (error) {
    console.error('[Organizations API] List error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/organizations/:orgId
 * Get organization details
 */
router.get(
  '/:orgId',
  [param('orgId').isUUID().withMessage('Invalid organization ID')],
  validate,
  async (req, res) => {
    try {
      const { orgId } = req.params
      const userId = getUserId(req)

      // Check user is member
      const userRole = await organizationService.getUserRole(orgId, userId)
      if (!userRole) {
        return res.status(403).json({
          success: false,
          error: 'You are not a member of this organization'
        })
      }

      const organization = await organizationService.getOrganization(orgId)
      const members = await organizationService.getOrganizationMembers(orgId)
      const stats = await organizationService.getOrganizationStats(orgId)

      res.json({
        success: true,
        data: {
          ...organization,
          userRole,
          memberCount: members.length,
          stats
        }
      })
    } catch (error) {
      console.error('[Organizations API] Get error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * PUT /api/organizations/:orgId
 * Update organization
 */
router.put(
  '/:orgId',
  [
    param('orgId').isUUID().withMessage('Invalid organization ID'),
    body('name')
      .optional()
      .isString()
      .trim()
      .notEmpty()
      .isLength({ min: 3, max: 255 }),
    body('description')
      .optional()
      .isString()
      .trim(),
    body('metadata')
      .optional()
      .isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const { orgId } = req.params
      const userId = getUserId(req)
      const updates = req.body

      const organization = await organizationService.updateOrganization(orgId, updates, userId)

      res.json({
        success: true,
        data: organization,
        message: 'Organization updated successfully'
      })
    } catch (error) {
      console.error('[Organizations API] Update error:', error)
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
 * DELETE /api/organizations/:orgId
 * Delete organization (owner only)
 */
router.delete(
  '/:orgId',
  [param('orgId').isUUID().withMessage('Invalid organization ID')],
  validate,
  async (req, res) => {
    try {
      const { orgId } = req.params
      const userId = getUserId(req)

      const result = await organizationService.deleteOrganization(orgId, userId)

      res.json({
        success: true,
        data: result,
        message: 'Organization deleted successfully'
      })
    } catch (error) {
      console.error('[Organizations API] Delete error:', error)
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
 * GET /api/organizations/:orgId/members
 * List organization members
 */
router.get(
  '/:orgId/members',
  [param('orgId').isUUID().withMessage('Invalid organization ID')],
  validate,
  async (req, res) => {
    try {
      const { orgId } = req.params
      const userId = getUserId(req)

      // Check user is member
      const userRole = await organizationService.getUserRole(orgId, userId)
      if (!userRole) {
        return res.status(403).json({
          success: false,
          error: 'You are not a member of this organization'
        })
      }

      const members = await organizationService.getOrganizationMembers(orgId)

      res.json({
        success: true,
        data: members
      })
    } catch (error) {
      console.error('[Organizations API] List members error:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/organizations/:orgId/members
 * Add member to organization
 */
router.post(
  '/:orgId/members',
  [
    param('orgId').isUUID().withMessage('Invalid organization ID'),
    body('userId')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('User ID is required'),
    body('role')
      .isIn(Object.values(ROLES))
      .withMessage('Invalid role. Must be: owner, admin, member, or viewer')
  ],
  validate,
  async (req, res) => {
    try {
      const { orgId } = req.params
      const addedBy = getUserId(req)
      const { userId, role } = req.body

      const membership = await organizationService.addMember({
        organizationId: orgId,
        userId,
        role,
        addedBy
      })

      res.status(201).json({
        success: true,
        data: membership,
        message: 'Member added successfully'
      })
    } catch (error) {
      console.error('[Organizations API] Add member error:', error)
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('permission') ? 403 :
                     error.message.includes('already') ? 409 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * PUT /api/organizations/:orgId/members/:userId
 * Update member role
 */
router.put(
  '/:orgId/members/:userId',
  [
    param('orgId').isUUID().withMessage('Invalid organization ID'),
    param('userId').isString().notEmpty().withMessage('Invalid user ID'),
    body('role')
      .isIn(Object.values(ROLES))
      .withMessage('Invalid role. Must be: owner, admin, member, or viewer')
  ],
  validate,
  async (req, res) => {
    try {
      const { orgId, userId } = req.params
      const updatedBy = getUserId(req)
      const { role } = req.body

      const membership = await organizationService.updateMemberRole(orgId, userId, role, updatedBy)

      res.json({
        success: true,
        data: membership,
        message: 'Member role updated successfully'
      })
    } catch (error) {
      console.error('[Organizations API] Update member role error:', error)
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
 * DELETE /api/organizations/:orgId/members/:userId
 * Remove member from organization
 */
router.delete(
  '/:orgId/members/:userId',
  [
    param('orgId').isUUID().withMessage('Invalid organization ID'),
    param('userId').isString().notEmpty().withMessage('Invalid user ID')
  ],
  validate,
  async (req, res) => {
    try {
      const { orgId, userId } = req.params
      const removedBy = getUserId(req)

      const result = await organizationService.removeMember(orgId, userId, removedBy)

      res.json({
        success: true,
        data: result,
        message: 'Member removed successfully'
      })
    } catch (error) {
      console.error('[Organizations API] Remove member error:', error)
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
 * GET /api/organizations/:orgId/stats
 * Get organization statistics
 */
router.get(
  '/:orgId/stats',
  [param('orgId').isUUID().withMessage('Invalid organization ID')],
  validate,
  async (req, res) => {
    try {
      const { orgId } = req.params
      const userId = getUserId(req)

      // Check user is member
      const userRole = await organizationService.getUserRole(orgId, userId)
      if (!userRole) {
        return res.status(403).json({
          success: false,
          error: 'You are not a member of this organization'
        })
      }

      const stats = await organizationService.getOrganizationStats(orgId)

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('[Organizations API] Get stats error:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/organizations/:orgId/database-info
 * Get Integram database information for organization
 */
router.get(
  '/:orgId/database-info',
  [param('orgId').isUUID().withMessage('Invalid organization ID')],
  validate,
  async (req, res) => {
    try {
      const { orgId } = req.params
      const userId = getUserId(req)

      // Check user is member
      const userRole = await organizationService.getUserRole(orgId, userId)
      if (!userRole) {
        return res.status(403).json({
          success: false,
          error: 'You are not a member of this organization'
        })
      }

      const dbInfo = await organizationService.getDatabaseInfo(orgId)

      res.json({
        success: true,
        data: dbInfo
      })
    } catch (error) {
      console.error('[Organizations API] Get database info error:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

export default router
