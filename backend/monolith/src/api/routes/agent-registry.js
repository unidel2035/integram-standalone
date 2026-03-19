/**
 * Agent Registry API Routes
 *
 * RESTful API for browsing and managing agent templates/definitions.
 *
 * Issue #3112 - Phase 0: Infrastructure preparation
 *
 * Endpoints:
 * - GET /api/agent-registry - List all available agents
 * - GET /api/agent-registry/:agentId - Get agent definition
 * - GET /api/agent-registry/:agentId/template - Get agent code template
 * - GET /api/agent-registry/:agentId/schema - Get agent table schemas
 * - GET /api/agent-registry/:agentId/config-schema - Get configuration schema
 * - GET /api/agent-registry/stats - Get registry statistics
 * - POST /api/agent-registry/reload - Reload agents from filesystem (dev)
 */

import express from 'express'
import { param, query, validationResult } from 'express-validator'
import AgentRegistryService from '../../services/agents/AgentRegistryService.js'

const router = express.Router()
const agentRegistry = new AgentRegistryService()

// Initialize on first use
let initialized = false
async function ensureInitialized() {
  if (!initialized) {
    await agentRegistry.initialize()
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
 * GET /api/agent-registry
 * List all available agents with optional filtering
 */
router.get(
  '/',
  [
    query('category').optional().isString(),
    query('search').optional().isString(),
    query('tags').optional().isString() // Comma-separated
  ],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { category, search, tags } = req.query

      const filters = {}
      if (category) filters.category = category
      if (search) filters.search = search
      if (tags) filters.tags = tags.split(',').map(t => t.trim())

      const agents = await agentRegistry.listAgents(filters)

      res.json({
        success: true,
        data: agents,
        count: agents.length
      })
    } catch (error) {
      console.error('[AgentRegistry API] List error:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/agent-registry/stats
 * Get registry statistics
 */
router.get('/stats', async (req, res) => {
  try {
    await ensureInitialized()

    const stats = await agentRegistry.getRegistryStats()

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('[AgentRegistry API] Stats error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/agent-registry/by-category
 * Get agents grouped by category
 */
router.get('/by-category', async (req, res) => {
  try {
    await ensureInitialized()

    const byCategory = await agentRegistry.getAgentsByCategory()

    res.json({
      success: true,
      data: byCategory
    })
  } catch (error) {
    console.error('[AgentRegistry API] By category error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/agent-registry/reload
 * Reload agents from filesystem (development only)
 */
router.post('/reload', async (req, res) => {
  try {
    await ensureInitialized()

    const result = await agentRegistry.reloadAgents()

    res.json({
      success: true,
      data: result,
      message: `Reloaded ${result.count} agents from filesystem`
    })
  } catch (error) {
    console.error('[AgentRegistry API] Reload error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/agent-registry/:agentId
 * Get detailed agent definition
 */
router.get(
  '/:agentId',
  [param('agentId').isString().notEmpty().withMessage('Agent ID is required')],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { agentId } = req.params

      const agent = await agentRegistry.getAgent(agentId)

      res.json({
        success: true,
        data: agent
      })
    } catch (error) {
      console.error('[AgentRegistry API] Get agent error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/agent-registry/:agentId/template
 * Get agent code template
 */
router.get(
  '/:agentId/template',
  [param('agentId').isString().notEmpty().withMessage('Agent ID is required')],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { agentId } = req.params

      const template = await agentRegistry.getAgentCodeTemplate(agentId)

      res.json({
        success: true,
        data: template
      })
    } catch (error) {
      console.error('[AgentRegistry API] Get template error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/agent-registry/:agentId/schema
 * Get agent table schemas
 */
router.get(
  '/:agentId/schema',
  [param('agentId').isString().notEmpty().withMessage('Agent ID is required')],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { agentId } = req.params

      const schemas = await agentRegistry.getAgentTableSchemas(agentId)

      res.json({
        success: true,
        data: schemas
      })
    } catch (error) {
      console.error('[AgentRegistry API] Get schema error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/agent-registry/:agentId/config-schema
 * Get agent configuration schema
 */
router.get(
  '/:agentId/config-schema',
  [param('agentId').isString().notEmpty().withMessage('Agent ID is required')],
  validate,
  async (req, res) => {
    try {
      await ensureInitialized()

      const { agentId } = req.params

      const configSchema = await agentRegistry.getAgentConfigSchema(agentId)

      res.json({
        success: true,
        data: configSchema
      })
    } catch (error) {
      console.error('[AgentRegistry API] Get config schema error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

export default router
