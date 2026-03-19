/**
 * Agent Instances API Routes
 *
 * RESTful API for managing agent instances within organizations.
 *
 * Issue #3112 - Phase 0: Infrastructure preparation
 *
 * Endpoints:
 * - POST /api/organizations/:orgId/agents - Create agent instance
 * - GET /api/organizations/:orgId/agents - List organization's agents
 * - GET /api/agent-instances/:instanceId - Get instance details
 * - PUT /api/agent-instances/:instanceId/config - Update configuration
 * - DELETE /api/agent-instances/:instanceId - Delete instance
 * - POST /api/agent-instances/:instanceId/start - Start instance
 * - POST /api/agent-instances/:instanceId/stop - Stop instance
 * - POST /api/agent-instances/:instanceId/pause - Pause instance
 * - GET /api/agent-instances/:instanceId/code - Get instance code
 * - PUT /api/agent-instances/:instanceId/code - Update custom code
 * - POST /api/agent-instances/:instanceId/reset-code - Reset to template
 * - GET /api/agent-instances/:instanceId/stats - Get instance statistics
 */

import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import AgentInstanceService from '../../services/agents/AgentInstanceService.js'

const router = express.Router()
const agentInstanceService = new AgentInstanceService()

// Initialize on first use
let initialized = false
async function ensureInitialized() {
  if (!initialized) {
    await agentInstanceService.initialize()
    initialized = true
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
      errors: errors.array()
    })
  }
  next()
}

/**
 * Extract user ID from request
 */
const getUserId = (req) => {
  return req.headers['x-user-id'] || req.user?.id || 'anonymous'
}

/**
 * POST /api/organizations/:orgId/agents
 * Create a new agent instance
 */
router.post(
  '/organizations/:orgId/agents',
  [
    param('orgId').isUUID().withMessage('Invalid organization ID'),
    body('agentId')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Agent ID is required'),
    body('instanceName')
      .optional()
      .isString()
      .trim(),
    body('config')
      .optional()
      .isObject(),
    body('autoStart')
      .optional()
      .isBoolean()
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { orgId } = req.params
      const { agentId, instanceName, config, autoStart } = req.body
      const createdBy = getUserId(req)

      const instance = await agentInstanceService.createInstance({
        organizationId: orgId,
        agentId,
        instanceName,
        config,
        createdBy,
        autoStart: autoStart || false
      })

      res.status(201).json({
        success: true,
        data: instance,
        message: 'Agent instance created successfully'
      })
    } catch (error) {
      console.error('[AgentInstances API] Create error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/organizations/:orgId/agents
 * List all agent instances for an organization
 */
router.get(
  '/organizations/:orgId/agents',
  [
    param('orgId').isUUID().withMessage('Invalid organization ID'),
    query('agentId').optional().isString(),
    query('status').optional().isString()
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { orgId } = req.params
      const { agentId, status } = req.query

      const filters = {}
      if (agentId) filters.agentId = agentId
      if (status) filters.status = status

      const instances = await agentInstanceService.listInstances(orgId, filters)

      res.json({
        success: true,
        data: instances,
        count: instances.length
      })
    } catch (error) {
      console.error('[AgentInstances API] List error:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/agent-instances/:instanceId
 * Get agent instance details
 */
router.get(
  '/:instanceId',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    query('orgId').isUUID().withMessage('Organization ID required')
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId } = req.params
      const { orgId } = req.query

      const instance = await agentInstanceService.getInstance(orgId, instanceId)

      res.json({
        success: true,
        data: instance
      })
    } catch (error) {
      console.error('[AgentInstances API] Get error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * PUT /api/agent-instances/:instanceId/config
 * Update instance configuration
 */
router.put(
  '/:instanceId/config',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    body('orgId').isUUID().withMessage('Organization ID required'),
    body('config').isObject().withMessage('Configuration object required')
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId } = req.params
      const { orgId, config } = req.body

      const instance = await agentInstanceService.updateInstanceConfig(orgId, instanceId, config)

      res.json({
        success: true,
        data: instance,
        message: 'Configuration updated successfully'
      })
    } catch (error) {
      console.error('[AgentInstances API] Update config error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * DELETE /api/agent-instances/:instanceId
 * Delete agent instance
 */
router.delete(
  '/:instanceId',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    query('orgId').isUUID().withMessage('Organization ID required')
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId } = req.params
      const { orgId } = req.query

      const result = await agentInstanceService.deleteInstance(orgId, instanceId)

      res.json({
        success: true,
        data: result,
        message: 'Agent instance deleted successfully'
      })
    } catch (error) {
      console.error('[AgentInstances API] Delete error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/agent-instances/:instanceId/start
 * Start agent instance
 */
router.post(
  '/:instanceId/start',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    body('orgId').isUUID().withMessage('Organization ID required')
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId } = req.params
      const { orgId } = req.body

      const result = await agentInstanceService.startInstance(orgId, instanceId)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('[AgentInstances API] Start error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/agent-instances/:instanceId/stop
 * Stop agent instance
 */
router.post(
  '/:instanceId/stop',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    body('orgId').isUUID().withMessage('Organization ID required')
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId } = req.params
      const { orgId } = req.body

      const result = await agentInstanceService.stopInstance(orgId, instanceId)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('[AgentInstances API] Stop error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/agent-instances/:instanceId/pause
 * Pause agent instance
 */
router.post(
  '/:instanceId/pause',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    body('orgId').isUUID().withMessage('Organization ID required')
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId } = req.params
      const { orgId } = req.body

      const result = await agentInstanceService.pauseInstance(orgId, instanceId)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('[AgentInstances API] Pause error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/agent-instances/:instanceId/code
 * Get instance code (custom or template)
 */
router.get(
  '/:instanceId/code',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    query('orgId').isUUID().withMessage('Organization ID required')
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId } = req.params
      const { orgId } = req.query

      const code = await agentInstanceService.getInstanceCode(orgId, instanceId)

      res.json({
        success: true,
        data: code
      })
    } catch (error) {
      console.error('[AgentInstances API] Get code error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * PUT /api/agent-instances/:instanceId/code
 * Update instance custom code (creates new version)
 */
router.put(
  '/:instanceId/code',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    body('orgId').isUUID().withMessage('Organization ID required'),
    body('code').isString().withMessage('Code must be a string'),
    body('commitMessage').optional().isString(),
    body('authorId').optional().isString()
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId } = req.params
      const { orgId, code, commitMessage, authorId } = req.body

      const result = await agentInstanceService.updateInstanceCode(orgId, instanceId, code, {
        commitMessage: commitMessage || 'Code updated',
        authorId: authorId || getUserId(req)
      })

      res.json({
        success: true,
        data: result,
        message: 'Custom code updated successfully'
      })
    } catch (error) {
      console.error('[AgentInstances API] Update code error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/agent-instances/:instanceId/reset-code
 * Reset instance code to template
 */
router.post(
  '/:instanceId/reset-code',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    body('orgId').isUUID().withMessage('Organization ID required')
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId } = req.params
      const { orgId } = req.body

      const result = await agentInstanceService.resetInstanceCode(orgId, instanceId)

      res.json({
        success: true,
        data: result,
        message: 'Code reset to template successfully'
      })
    } catch (error) {
      console.error('[AgentInstances API] Reset code error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/agent-instances/:instanceId/stats
 * Get instance statistics
 */
router.get(
  '/:instanceId/stats',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    query('orgId').isUUID().withMessage('Organization ID required')
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId } = req.params
      const { orgId } = req.query

      const stats = await agentInstanceService.getInstanceStats(orgId, instanceId)

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('[AgentInstances API] Get stats error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/agent-instances/:instanceId/versions
 * Get version history for instance
 */
router.get(
  '/:instanceId/versions',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    query('orgId').isUUID().withMessage('Organization ID required'),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId } = req.params
      const { orgId, limit, offset } = req.query

      const options = {}
      if (limit) options.limit = parseInt(limit)
      if (offset) options.offset = parseInt(offset)

      const history = await agentInstanceService.getVersionHistory(orgId, instanceId, options)

      res.json({
        success: true,
        data: history
      })
    } catch (error) {
      console.error('[AgentInstances API] Get version history error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/agent-instances/:instanceId/versions/:versionNumber
 * Get a specific version
 */
router.get(
  '/:instanceId/versions/:versionNumber',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    param('versionNumber').isInt({ min: 1 }).withMessage('Invalid version number'),
    query('orgId').isUUID().withMessage('Organization ID required')
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId, versionNumber } = req.params
      const { orgId } = req.query

      const version = await agentInstanceService.getVersion(orgId, instanceId, parseInt(versionNumber))

      res.json({
        success: true,
        data: version
      })
    } catch (error) {
      console.error('[AgentInstances API] Get version error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/agent-instances/:instanceId/versions/:fromVersion/diff/:toVersion
 * Get diff between two versions
 */
router.get(
  '/:instanceId/versions/:fromVersion/diff/:toVersion',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    param('fromVersion').isInt({ min: 1 }).withMessage('Invalid from version'),
    param('toVersion').isInt({ min: 1 }).withMessage('Invalid to version'),
    query('orgId').isUUID().withMessage('Organization ID required')
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId, fromVersion, toVersion } = req.params
      const { orgId } = req.query

      const diff = await agentInstanceService.getVersionDiff(
        orgId,
        instanceId,
        parseInt(fromVersion),
        parseInt(toVersion)
      )

      res.json({
        success: true,
        data: diff
      })
    } catch (error) {
      console.error('[AgentInstances API] Get diff error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/agent-instances/:instanceId/rollback/:versionNumber
 * Rollback to a specific version
 */
router.post(
  '/:instanceId/rollback/:versionNumber',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    param('versionNumber').isInt({ min: 1 }).withMessage('Invalid version number'),
    body('orgId').isUUID().withMessage('Organization ID required'),
    body('commitMessage').optional().isString(),
    body('authorId').optional().isString()
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId, versionNumber } = req.params
      const { orgId, commitMessage, authorId } = req.body

      const result = await agentInstanceService.rollbackToVersion(
        orgId,
        instanceId,
        parseInt(versionNumber),
        {
          commitMessage,
          authorId: authorId || getUserId(req)
        }
      )

      res.json({
        success: true,
        data: result,
        message: `Rolled back to version ${versionNumber}`
      })
    } catch (error) {
      console.error('[AgentInstances API] Rollback error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/agent-instances/:instanceId/deploy/:versionNumber
 * Deploy a specific version
 */
router.post(
  '/:instanceId/deploy/:versionNumber',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    param('versionNumber').isInt({ min: 1 }).withMessage('Invalid version number'),
    body('orgId').isUUID().withMessage('Organization ID required')
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId, versionNumber } = req.params
      const { orgId } = req.body

      const result = await agentInstanceService.deployVersion(
        orgId,
        instanceId,
        parseInt(versionNumber)
      )

      res.json({
        success: true,
        data: result,
        message: `Deployed version ${versionNumber}`
      })
    } catch (error) {
      console.error('[AgentInstances API] Deploy version error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/agent-instances/:instanceId/test
 * Test instance code in sandbox
 */
router.post(
  '/:instanceId/test',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    body('orgId').isUUID().withMessage('Organization ID required'),
    body('testData').optional().isObject(),
    body('testCases').optional().isArray(),
    body('timeout').optional().isInt({ min: 100, max: 60000 })
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { instanceId } = req.params
      const { orgId, testData, testCases, timeout } = req.body

      const result = await agentInstanceService.testInstanceCode(orgId, instanceId, {
        testData,
        testCases,
        timeout
      })

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('[AgentInstances API] Test code error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

export default router
