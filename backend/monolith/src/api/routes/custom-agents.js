/**
 * Custom Agents API Routes
 *
 * RESTful API for managing custom agents created by users
 * - Create custom agents with code and UI
 * - Edit agent logic and interface
 * - Deploy agents to organizations
 * - Execute agent instances
 * - Manage agent versions and history
 *
 * Endpoints:
 * - POST /api/custom-agents - Create new custom agent
 * - GET /api/custom-agents - List all custom agents
 * - GET /api/custom-agents/:agentId - Get agent details
 * - PUT /api/custom-agents/:agentId - Update agent metadata
 * - DELETE /api/custom-agents/:agentId - Delete agent
 * - POST /api/custom-agents/:agentId/code - Save agent code
 * - GET /api/custom-agents/:agentId/code - Get agent code
 * - POST /api/custom-agents/:agentId/ui - Save agent UI
 * - GET /api/custom-agents/:agentId/ui - Get agent UI
 * - POST /api/custom-agents/:agentId/config - Save agent config
 * - GET /api/custom-agents/:agentId/config - Get agent config
 * - POST /api/custom-agents/:agentId/instances - Create instance
 * - GET /api/custom-agents/:agentId/instances - List instances
 * - POST /api/custom-agents/:agentId/instances/:instanceId/execute - Execute instance
 * - GET /api/custom-agents/:agentId/instances/:instanceId/logs - Get execution logs
 */

import express from 'express'
import { body, param, validationResult } from 'express-validator'
import CustomAgentService from '../../services/agents/CustomAgentService.js'

const router = express.Router()
let customAgentService = null

/**
 * Ensure service is initialized
 */
async function ensureServiceInitialized(req, res, next) {
  try {
    if (!customAgentService) {
      customAgentService = new CustomAgentService()
      await customAgentService.initialize()
    }
    next()
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `Failed to initialize Custom Agent Service: ${error.message}`
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
      errors: errors.array()
    })
  }
  next()
}

/**
 * Extract organization ID from request
 */
const getOrganizationId = (req) => {
  return req.headers['x-organization-id'] || req.body.organizationId || 'default'
}

/**
 * Extract user ID from request
 */
const getUserId = (req) => {
  return req.headers['x-user-id'] || req.user?.id || 'anonymous'
}

/**
 * POST /api/custom-agents
 * Create new custom agent
 */
router.post(
  '/',
  ensureServiceInitialized,
  [
    body('name')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Agent name is required'),
    body('description')
      .optional()
      .isString()
      .trim(),
    body('category')
      .optional()
      .isString()
      .trim(),
    body('icon')
      .optional()
      .isString(),
    body('tags')
      .optional()
      .isArray()
  ],
  validate,
  async (req, res) => {
    try {
      const { name, description, category, icon, tags } = req.body
      const organizationId = getOrganizationId(req)
      const userId = getUserId(req)

      const agent = await customAgentService.createAgent({
        organizationId,
        name,
        description: description || '',
        category: category || 'custom',
        icon: icon || '🤖',
        tags: tags || [],
        createdBy: userId
      })

      res.status(201).json({
        success: true,
        agent
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/custom-agents
 * List all custom agents
 */
router.get(
  '/',
  ensureServiceInitialized,
  async (req, res) => {
    try {
      const organizationId = getOrganizationId(req)

      const agents = await customAgentService.listAgents({
        organizationId
      })

      res.json({
        success: true,
        agents,
        total: agents.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/custom-agents/:agentId
 * Get agent details
 */
router.get(
  '/:agentId',
  ensureServiceInitialized,
  [param('agentId').notEmpty().withMessage('Agent ID is required')],
  validate,
  async (req, res) => {
    try {
      const { agentId } = req.params
      const organizationId = getOrganizationId(req)

      const agent = await customAgentService.getAgent({
        organizationId,
        agentId
      })

      res.json({
        success: true,
        agent
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/custom-agents/:agentId/code
 * Save agent code
 */
router.post(
  '/:agentId/code',
  ensureServiceInitialized,
  [
    param('agentId').notEmpty().withMessage('Agent ID is required'),
    body('code')
      .isString()
      .notEmpty()
      .withMessage('Code is required'),
    body('language')
      .optional()
      .isString(),
    body('commitMessage')
      .optional()
      .isString()
  ],
  validate,
  async (req, res) => {
    try {
      const { agentId } = req.params
      const { code, language, commitMessage } = req.body
      const organizationId = getOrganizationId(req)
      const userId = getUserId(req)

      const result = await customAgentService.saveAgentCode({
        organizationId,
        agentId,
        code,
        language: language || 'javascript',
        commitMessage: commitMessage || 'Code update',
        authorId: userId
      })

      res.json({
        success: true,
        codeVersion: result
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/custom-agents/:agentId/ui
 * Save agent UI definition
 */
router.post(
  '/:agentId/ui',
  ensureServiceInitialized,
  [
    param('agentId').notEmpty().withMessage('Agent ID is required'),
    body('uiDefinition')
      .isObject()
      .withMessage('UI definition must be an object'),
    body('uiDefinition.template')
      .notEmpty()
      .withMessage('UI template is required'),
    body('componentDependencies')
      .optional()
      .isArray()
  ],
  validate,
  async (req, res) => {
    try {
      const { agentId } = req.params
      const { uiDefinition, componentDependencies } = req.body
      const organizationId = getOrganizationId(req)

      const result = await customAgentService.saveAgentUI({
        organizationId,
        agentId,
        uiDefinition,
        componentDependencies: componentDependencies || []
      })

      res.json({
        success: true,
        uiVersion: result
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/custom-agents/:agentId/config
 * Save agent configuration schema
 */
router.post(
  '/:agentId/config',
  ensureServiceInitialized,
  [
    param('agentId').notEmpty().withMessage('Agent ID is required'),
    body('configSchema')
      .isObject()
      .withMessage('Config schema must be an object'),
    body('defaults')
      .optional()
      .isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const { agentId } = req.params
      const { configSchema, defaults } = req.body
      const organizationId = getOrganizationId(req)

      const result = await customAgentService.saveAgentConfig({
        organizationId,
        agentId,
        configSchema,
        defaults: defaults || {}
      })

      res.json({
        success: true,
        configVersion: result
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/custom-agents/:agentId/instances
 * Create instance of custom agent
 */
router.post(
  '/:agentId/instances',
  ensureServiceInitialized,
  [
    param('agentId').notEmpty().withMessage('Agent ID is required'),
    body('instanceName')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Instance name is required'),
    body('config')
      .optional()
      .isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const { agentId } = req.params
      const { instanceName, config } = req.body
      const organizationId = getOrganizationId(req)

      const instance = await customAgentService.createInstance({
        organizationId,
        agentId,
        instanceName,
        config: config || {},
        status: 'active'
      })

      res.status(201).json({
        success: true,
        instance
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/custom-agents/:agentId/instances/:instanceId/execute
 * Execute custom agent instance
 */
router.post(
  '/:agentId/instances/:instanceId/execute',
  ensureServiceInitialized,
  [
    param('agentId').notEmpty().withMessage('Agent ID is required'),
    param('instanceId').notEmpty().withMessage('Instance ID is required'),
    body('code')
      .isString()
      .notEmpty()
      .withMessage('Code is required'),
    body('inputs')
      .optional()
      .isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const { agentId, instanceId } = req.params
      const { code, inputs } = req.body
      const organizationId = getOrganizationId(req)

      const result = await customAgentService.executeInstance({
        organizationId,
        instanceId,
        agentId,
        code,
        inputs: inputs || {}
      })

      res.json({
        success: result.success,
        result: result.result,
        error: result.error,
        executionTime: result.executionTime,
        logs: result.logs
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

export default router
