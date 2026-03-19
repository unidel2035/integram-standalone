/**
 * DronDoc Agent API - Unified API for Agent Creation and Management
 *
 * Issue #4692 - DronDoc API for agent creation and connection
 *
 * This unified API combines:
 * - Agent Registry (templates/definitions)
 * - Agent Instances (deployed agents)
 * - Integram Integration (database tables)
 * - AI Token System (AI model access)
 * - MCP Tools (standardized tool access)
 *
 * See /docs/DRONDOC_AGENT_API.md for full API specification
 */

import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import AgentRegistryService from '../../services/agents/AgentRegistryService.js'
import AgentInstanceService from '../../services/agents/AgentInstanceService.js'
import { backgroundAgentService, AGENT_EVENTS, AGENT_EXECUTION_STATE } from '../../services/agents/BackgroundAgentService.js'
import { fileWatcherService } from '../../services/FileWatcherService.js'
import logger from '../../utils/logger.js'

const router = express.Router()

// Initialize services
const agentRegistry = new AgentRegistryService({ logger })
const agentInstanceService = new AgentInstanceService({ logger })

// Track initialization
let servicesInitialized = false

/**
 * Ensure services are initialized
 */
async function ensureInitialized() {
  if (!servicesInitialized) {
    await agentRegistry.initialize()
    await agentInstanceService.initialize()
    servicesInitialized = true
    logger.info('[DronDoc Agents API] Services initialized')
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
      error: 'Validation failed',
      errors: errors.array()
    })
  }
  next()
}

/**
 * Error handler middleware
 */
const errorHandler = (handler) => async (req, res, next) => {
  try {
    await ensureInitialized()
    await handler(req, res, next)
  } catch (error) {
    logger.error('[DronDoc Agents API] Error:', error)

    // Determine error code and status
    let status = 500
    let code = 'INTERNAL_ERROR'

    if (error.message.includes('not found')) {
      status = 404
      code = 'NOT_FOUND'
    } else if (error.message.includes('already exists')) {
      status = 409
      code = 'ALREADY_EXISTS'
    } else if (error.message.includes('validation failed') || error.message.includes('invalid')) {
      status = 400
      code = 'VALIDATION_ERROR'
    } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      status = 403
      code = 'INSUFFICIENT_PERMISSIONS'
    }

    res.status(status).json({
      success: false,
      error: error.message,
      code
    })
  }
}

// =============================================================================
// Agent Templates & Discovery
// =============================================================================

/**
 * GET /api/drondoc-agents/templates
 * List all available agent templates
 */
router.get(
  '/templates',
  [
    query('category').optional().isString(),
    query('search').optional().isString(),
    query('tags').optional().isString()
  ],
  validate,
  errorHandler(async (req, res) => {
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
  })
)

/**
 * GET /api/drondoc-agents/templates/:agentId
 * Get detailed agent template
 */
router.get(
  '/templates/:agentId',
  [param('agentId').isString().notEmpty()],
  validate,
  errorHandler(async (req, res) => {
    const { agentId } = req.params
    const agent = await agentRegistry.getAgent(agentId)

    res.json({
      success: true,
      data: agent
    })
  })
)

/**
 * GET /api/drondoc-agents/categories
 * Get all agent categories with counts
 */
router.get(
  '/categories',
  errorHandler(async (req, res) => {
    const byCategory = await agentRegistry.getAgentsByCategory()

    // Transform to counts
    const counts = {}
    for (const [category, agents] of Object.entries(byCategory)) {
      counts[category] = agents.length
    }

    res.json({
      success: true,
      data: counts
    })
  })
)

/**
 * GET /api/drondoc-agents/templates/:agentId/template
 * Get agent code template
 */
router.get(
  '/templates/:agentId/template',
  [param('agentId').isString().notEmpty()],
  validate,
  errorHandler(async (req, res) => {
    const { agentId } = req.params
    const template = await agentRegistry.getAgentCodeTemplate(agentId)

    res.json({
      success: true,
      data: template
    })
  })
)

/**
 * GET /api/drondoc-agents/templates/:agentId/schema
 * Get agent table schemas
 */
router.get(
  '/templates/:agentId/schema',
  [param('agentId').isString().notEmpty()],
  validate,
  errorHandler(async (req, res) => {
    const { agentId } = req.params
    const schemas = await agentRegistry.getAgentTableSchemas(agentId)

    res.json({
      success: true,
      data: schemas
    })
  })
)

/**
 * GET /api/drondoc-agents/templates/:agentId/config-schema
 * Get agent configuration schema
 */
router.get(
  '/templates/:agentId/config-schema',
  [param('agentId').isString().notEmpty()],
  validate,
  errorHandler(async (req, res) => {
    const { agentId } = req.params
    const configSchema = await agentRegistry.getAgentConfigSchema(agentId)

    res.json({
      success: true,
      data: configSchema
    })
  })
)

// =============================================================================
// Agent Creation & Management
// =============================================================================

/**
 * POST /api/drondoc-agents/create
 * Create a new agent instance
 */
router.post(
  '/create',
  [
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required'),
    body('agentId').isString().notEmpty().withMessage('Agent ID is required'),
    body('instanceName').optional().isString(),
    body('config').optional().isObject(),
    body('autoStart').optional().isBoolean(),
    body('customCode').optional().isString(),
    body('createdBy').optional().isString()
  ],
  validate,
  errorHandler(async (req, res) => {
    const { organizationId, agentId, instanceName, config, autoStart, customCode, createdBy } = req.body

    // TODO: Verify user has access to organization
    // const userId = req.user?.id
    // if (!await hasOrgAccess(userId, organizationId)) {
    //   throw new Error('Insufficient permissions to create agents in this organization')
    // }

    const instance = await agentInstanceService.createInstance({
      organizationId,
      agentId,
      instanceName,
      config: config || {},
      createdBy: createdBy || req.user?.id || 'system',
      autoStart: autoStart !== false // Default to true
    })

    // If custom code provided, update it
    if (customCode) {
      await agentInstanceService.updateInstanceCode(
        organizationId,
        instance.id,
        customCode,
        {
          authorId: createdBy || req.user?.id || 'system',
          commitMessage: 'Initial custom code'
        }
      )
    }

    res.status(201).json({
      success: true,
      data: instance,
      message: 'Agent instance created successfully'
    })
  })
)

/**
 * GET /api/drondoc-agents/instances
 * List all agent instances for an organization
 */
router.get(
  '/instances',
  [
    query('organizationId').isString().notEmpty().withMessage('Organization ID is required'),
    query('agentId').optional().isString(),
    query('status').optional().isIn(['active', 'inactive', 'error', 'paused'])
  ],
  validate,
  errorHandler(async (req, res) => {
    const { organizationId, agentId, status } = req.query

    const filters = {}
    if (agentId) filters.agentId = agentId
    if (status) filters.status = status

    const instances = await agentInstanceService.listInstances(organizationId, filters)

    res.json({
      success: true,
      data: instances,
      count: instances.length
    })
  })
)

/**
 * GET /api/drondoc-agents/instances/:instanceId
 * Get agent instance details
 */
router.get(
  '/instances/:instanceId',
  [
    param('instanceId').isString().notEmpty(),
    query('organizationId').isString().notEmpty().withMessage('Organization ID is required')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const { organizationId } = req.query

    const instance = await agentInstanceService.getInstance(organizationId, instanceId)

    res.json({
      success: true,
      data: instance
    })
  })
)

/**
 * PUT /api/drondoc-agents/instances/:instanceId/config
 * Update agent configuration
 */
router.put(
  '/instances/:instanceId/config',
  [
    param('instanceId').isString().notEmpty(),
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required'),
    body('config').isObject().withMessage('Config must be an object')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const { organizationId, config } = req.body

    const updated = await agentInstanceService.updateInstanceConfig(
      organizationId,
      instanceId,
      config
    )

    res.json({
      success: true,
      data: updated,
      message: 'Configuration updated successfully'
    })
  })
)

/**
 * PUT /api/drondoc-agents/instances/:instanceId/code
 * Update agent custom code
 */
router.put(
  '/instances/:instanceId/code',
  [
    param('instanceId').isString().notEmpty(),
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required'),
    body('code').isString().notEmpty().withMessage('Code is required'),
    body('commitMessage').optional().isString(),
    body('authorId').optional().isString()
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const { organizationId, code, commitMessage, authorId } = req.body

    const result = await agentInstanceService.updateInstanceCode(
      organizationId,
      instanceId,
      code,
      {
        authorId: authorId || req.user?.id || 'system',
        commitMessage: commitMessage || 'Code updated'
      }
    )

    res.json({
      success: true,
      data: result,
      message: 'Code updated successfully'
    })
  })
)

/**
 * POST /api/drondoc-agents/instances/:instanceId/code/reset
 * Reset agent code to template
 */
router.post(
  '/instances/:instanceId/code/reset',
  [
    param('instanceId').isString().notEmpty(),
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const { organizationId } = req.body

    const result = await agentInstanceService.resetInstanceCode(organizationId, instanceId)

    res.json({
      success: true,
      data: result,
      message: 'Code reset to template successfully'
    })
  })
)

// =============================================================================
// Agent Lifecycle
// =============================================================================

/**
 * POST /api/drondoc-agents/instances/:instanceId/start
 * Start an agent instance
 */
router.post(
  '/instances/:instanceId/start',
  [
    param('instanceId').isString().notEmpty(),
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const { organizationId } = req.body

    const result = await agentInstanceService.startInstance(organizationId, instanceId)

    res.json({
      success: true,
      data: result
    })
  })
)

/**
 * POST /api/drondoc-agents/instances/:instanceId/stop
 * Stop an agent instance
 */
router.post(
  '/instances/:instanceId/stop',
  [
    param('instanceId').isString().notEmpty(),
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const { organizationId } = req.body

    const result = await agentInstanceService.stopInstance(organizationId, instanceId)

    res.json({
      success: true,
      data: result
    })
  })
)

/**
 * POST /api/drondoc-agents/instances/:instanceId/pause
 * Pause an agent instance
 */
router.post(
  '/instances/:instanceId/pause',
  [
    param('instanceId').isString().notEmpty(),
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const { organizationId } = req.body

    const result = await agentInstanceService.pauseInstance(organizationId, instanceId)

    res.json({
      success: true,
      data: result
    })
  })
)

/**
 * DELETE /api/drondoc-agents/instances/:instanceId
 * Delete an agent instance
 */
router.delete(
  '/instances/:instanceId',
  [
    param('instanceId').isString().notEmpty(),
    query('organizationId').isString().notEmpty().withMessage('Organization ID is required')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const { organizationId } = req.query

    const result = await agentInstanceService.deleteInstance(organizationId, instanceId)

    res.json({
      success: true,
      data: result,
      message: 'Instance deleted successfully'
    })
  })
)

// =============================================================================
// Code Version Management
// =============================================================================

/**
 * GET /api/drondoc-agents/instances/:instanceId/versions
 * Get version history
 */
router.get(
  '/instances/:instanceId/versions',
  [
    param('instanceId').isString().notEmpty(),
    query('organizationId').isString().notEmpty().withMessage('Organization ID is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const { organizationId, limit, offset } = req.query

    const options = {}
    if (limit) options.limit = parseInt(limit)
    if (offset) options.offset = parseInt(offset)

    const history = await agentInstanceService.getVersionHistory(
      organizationId,
      instanceId,
      options
    )

    res.json({
      success: true,
      data: history
    })
  })
)

/**
 * GET /api/drondoc-agents/instances/:instanceId/versions/:version
 * Get specific version
 */
router.get(
  '/instances/:instanceId/versions/:version',
  [
    param('instanceId').isString().notEmpty(),
    param('version').isInt({ min: 1 }),
    query('organizationId').isString().notEmpty().withMessage('Organization ID is required')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId, version } = req.params
    const { organizationId } = req.query

    const versionData = await agentInstanceService.getVersion(
      organizationId,
      instanceId,
      parseInt(version)
    )

    res.json({
      success: true,
      data: versionData
    })
  })
)

/**
 * GET /api/drondoc-agents/instances/:instanceId/versions/diff
 * Get diff between versions
 */
router.get(
  '/instances/:instanceId/versions/diff',
  [
    param('instanceId').isString().notEmpty(),
    query('organizationId').isString().notEmpty().withMessage('Organization ID is required'),
    query('from').isInt({ min: 1 }).withMessage('From version is required'),
    query('to').isInt({ min: 1 }).withMessage('To version is required')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const { organizationId, from, to } = req.query

    const diff = await agentInstanceService.getVersionDiff(
      organizationId,
      instanceId,
      parseInt(from),
      parseInt(to)
    )

    res.json({
      success: true,
      data: diff
    })
  })
)

/**
 * POST /api/drondoc-agents/instances/:instanceId/versions/:version/rollback
 * Rollback to a specific version
 */
router.post(
  '/instances/:instanceId/versions/:version/rollback',
  [
    param('instanceId').isString().notEmpty(),
    param('version').isInt({ min: 1 }),
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required'),
    body('commitMessage').optional().isString(),
    body('authorId').optional().isString()
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId, version } = req.params
    const { organizationId, commitMessage, authorId } = req.body

    const result = await agentInstanceService.rollbackToVersion(
      organizationId,
      instanceId,
      parseInt(version),
      {
        authorId: authorId || req.user?.id || 'system',
        commitMessage
      }
    )

    res.json({
      success: true,
      data: result,
      message: `Rolled back to version ${version}`
    })
  })
)

// =============================================================================
// Testing & Validation
// =============================================================================

/**
 * POST /api/drondoc-agents/instances/:instanceId/test
 * Test agent code in sandbox
 */
router.post(
  '/instances/:instanceId/test',
  [
    param('instanceId').isString().notEmpty(),
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required'),
    body('testData').optional().isObject(),
    body('testCases').optional().isArray(),
    body('timeout').optional().isInt({ min: 1000, max: 300000 })
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const { organizationId, testData, testCases, timeout } = req.body

    const result = await agentInstanceService.testInstanceCode(
      organizationId,
      instanceId,
      {
        testData: testData || {},
        testCases: testCases || [],
        timeout: timeout || 30000
      }
    )

    res.json({
      success: result.success,
      data: result
    })
  })
)

// =============================================================================
// Statistics & Monitoring
// =============================================================================

/**
 * GET /api/drondoc-agents/stats
 * Get overall agent statistics
 */
router.get(
  '/stats',
  errorHandler(async (req, res) => {
    const registryStats = await agentRegistry.getRegistryStats()

    // TODO: Add instance counts across all organizations
    // This would require iterating through all organizations
    // For now, just return registry stats

    res.json({
      success: true,
      data: {
        totalTemplates: registryStats.totalAgents,
        categories: registryStats.categories,
        categoryCount: registryStats.categoryCount,
        totalTags: registryStats.totalTags,
        totalTables: registryStats.totalTables,
        averageTablesPerAgent: registryStats.averageTablesPerAgent
        // TODO: Add instance stats
        // totalInstances: ...,
        // activeInstances: ...,
        // topAgents: ...
      }
    })
  })
)

/**
 * GET /api/drondoc-agents/instances/:instanceId/stats
 * Get instance statistics
 */
router.get(
  '/instances/:instanceId/stats',
  [
    param('instanceId').isString().notEmpty(),
    query('organizationId').isString().notEmpty().withMessage('Organization ID is required')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const { organizationId } = req.query

    const stats = await agentInstanceService.getInstanceStats(organizationId, instanceId)

    res.json({
      success: true,
      data: stats
    })
  })
)

// =============================================================================
// Integration Endpoints
// =============================================================================

/**
 * GET /api/drondoc-agents/integrations/mcp/tools
 * List available MCP tools for agents
 */
router.get(
  '/integrations/mcp/tools',
  errorHandler(async (req, res) => {
    // TODO: Integrate with MCP server to list available tools
    // For now, return a static list of common tools
    const tools = [
      {
        name: 'integram_authenticate',
        description: 'Authenticate with Integram database',
        parameters: {
          serverURL: 'string',
          database: 'string',
          login: 'string',
          password: 'string'
        }
      },
      {
        name: 'integram_get_dictionary',
        description: 'Get list of all types (tables) in database',
        parameters: {}
      },
      {
        name: 'integram_get_type_metadata',
        description: 'Get metadata for a specific type',
        parameters: {
          typeId: 'number'
        }
      },
      {
        name: 'integram_get_object_list',
        description: 'Get list of objects (records) for a type',
        parameters: {
          typeId: 'number',
          params: 'object'
        }
      },
      {
        name: 'integram_create_object',
        description: 'Create a new object (record)',
        parameters: {
          typeId: 'number',
          value: 'string',
          requisites: 'object'
        }
      }
      // TODO: Add all 27 MCP tools
    ]

    res.json({
      success: true,
      data: tools,
      count: tools.length
    })
  })
)

/**
 * GET /api/drondoc-agents/integrations/ai/models
 * List available AI models
 */
router.get(
  '/integrations/ai/models',
  errorHandler(async (req, res) => {
    // TODO: Integrate with AI Token system to list available models
    // For now, return a static list
    const models = [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'deepseek',
        contextWindow: 64000,
        pricing: {
          promptTokens: 0.000001,
          completionTokens: 0.000002
        }
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        contextWindow: 8192,
        pricing: {
          promptTokens: 0.00003,
          completionTokens: 0.00006
        }
      }
    ]

    res.json({
      success: true,
      data: models,
      count: models.length
    })
  })
)

/**
 * POST /api/drondoc-agents/integrations/ai/chat
 * Execute AI chat (uses token system)
 */
router.post(
  '/integrations/ai/chat',
  [
    body('instanceId').isString().notEmpty().withMessage('Instance ID is required'),
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required'),
    body('modelId').isString().notEmpty().withMessage('Model ID is required'),
    body('prompt').isString().notEmpty().withMessage('Prompt is required'),
    body('temperature').optional().isFloat({ min: 0, max: 2 }),
    body('maxTokens').optional().isInt({ min: 1, max: 100000 })
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId, organizationId, modelId, prompt, temperature, maxTokens } = req.body

    // TODO: Integrate with AI Token system
    // For now, return a mock response
    res.json({
      success: true,
      data: {
        response: 'AI chat integration coming soon...',
        tokensUsed: {
          prompt: 0,
          completion: 0,
          total: 0
        },
        cost: 0
      },
      message: 'AI integration endpoint (to be implemented)'
    })
  })
)

// =============================================================================
// Admin/Development Endpoints
// =============================================================================

/**
 * POST /api/drondoc-agents/templates/reload
 * Reload agent templates from filesystem (development only)
 */
router.post(
  '/templates/reload',
  errorHandler(async (req, res) => {
    const result = await agentRegistry.reloadAgents()

    res.json({
      success: true,
      data: result,
      message: `Reloaded ${result.count} agent templates`
    })
  })
)

/**
 * POST /api/drondoc-agents/templates/register
 * Register a new agent template dynamically
 */
router.post(
  '/templates/register',
  [
    body('id').isString().notEmpty().withMessage('Agent ID is required'),
    body('name').isString().notEmpty().withMessage('Agent name is required'),
    body('description').optional().isString(),
    body('icon').optional().isString(),
    body('category').optional().isString(),
    body('codeTemplate').optional().isString(),
    body('tableSchemas').optional().isArray(),
    body('configSchema').optional().isObject(),
    body('dependencies').optional().isArray(),
    body('tags').optional().isArray()
  ],
  validate,
  errorHandler(async (req, res) => {
    const agentDefinition = req.body

    const registered = await agentRegistry.registerAgent(agentDefinition)

    res.status(201).json({
      success: true,
      data: registered,
      message: 'Agent template registered successfully'
    })
  })
)

/**
 * PUT /api/drondoc-agents/templates/:agentId
 * Update an existing agent template
 */
router.put(
  '/templates/:agentId',
  [
    param('agentId').isString().notEmpty(),
    body('name').optional().isString(),
    body('description').optional().isString(),
    body('icon').optional().isString(),
    body('category').optional().isString(),
    body('codeTemplate').optional().isString(),
    body('tableSchemas').optional().isArray(),
    body('configSchema').optional().isObject(),
    body('dependencies').optional().isArray(),
    body('tags').optional().isArray()
  ],
  validate,
  errorHandler(async (req, res) => {
    const { agentId } = req.params
    const updates = req.body

    const updated = await agentRegistry.updateAgent(agentId, updates)

    res.json({
      success: true,
      data: updated,
      message: 'Agent template updated successfully'
    })
  })
)

// =============================================================================
// Background Agent Execution (like workspace agents)
// =============================================================================

/**
 * POST /api/drondoc-agents/background/start
 * Start an agent in background mode
 */
router.post(
  '/background/start',
  [
    body('instanceId').isString().notEmpty().withMessage('Instance ID is required'),
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required'),
    body('config').optional().isObject(),
    body('triggers').optional().isObject()
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId, organizationId, config, triggers } = req.body

    // Get instance info
    const instance = await agentInstanceService.getInstance(organizationId, instanceId)
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found',
        code: 'NOT_FOUND'
      })
    }

    // Get agent template for executor
    const agent = await agentRegistry.getAgent(instance.agentId)

    // Start in background
    const result = await backgroundAgentService.startAgent({
      instanceId,
      organizationId,
      agentId: instance.agentId,
      agentName: instance.instanceName || agent?.name || instance.agentId,
      config: { ...instance.config, ...config },
      triggers: triggers || {},
      // Executor will be set based on agent type
      onTask: async (task, agentData) => {
        logger.info({
          instanceId,
          taskId: task.id,
          type: task.type
        }, '[BackgroundAgent] Processing task')

        // Default task processing - can be overridden per agent type
        return { success: true, processed: true }
      }
    })

    // Update instance status
    await agentInstanceService.startInstance(organizationId, instanceId)

    res.json({
      success: true,
      data: result,
      message: 'Agent started in background'
    })
  })
)

/**
 * POST /api/drondoc-agents/background/stop
 * Stop a background agent
 */
router.post(
  '/background/stop',
  [
    body('instanceId').isString().notEmpty().withMessage('Instance ID is required'),
    body('graceful').optional().isBoolean()
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId, graceful = true } = req.body

    const result = await backgroundAgentService.stopAgent(instanceId, graceful)

    res.json({
      success: result.success,
      data: result,
      message: result.success ? 'Agent stopped' : result.message
    })
  })
)

/**
 * POST /api/drondoc-agents/background/pause
 * Pause a background agent
 */
router.post(
  '/background/pause',
  [
    body('instanceId').isString().notEmpty().withMessage('Instance ID is required')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.body

    const result = backgroundAgentService.pauseAgent(instanceId)

    res.json({
      success: result.success,
      data: result
    })
  })
)

/**
 * POST /api/drondoc-agents/background/resume
 * Resume a paused background agent
 */
router.post(
  '/background/resume',
  [
    body('instanceId').isString().notEmpty().withMessage('Instance ID is required')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.body

    const result = backgroundAgentService.resumeAgent(instanceId)

    res.json({
      success: result.success,
      data: result
    })
  })
)

/**
 * GET /api/drondoc-agents/background/status/:instanceId
 * Get background agent status
 */
router.get(
  '/background/status/:instanceId',
  [param('instanceId').isString().notEmpty()],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params

    const status = backgroundAgentService.getAgentStatus(instanceId)

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Agent not running in background',
        code: 'NOT_FOUND'
      })
    }

    res.json({
      success: true,
      data: status
    })
  })
)

/**
 * GET /api/drondoc-agents/background/list
 * List all background agents
 */
router.get(
  '/background/list',
  [query('organizationId').optional().isString()],
  validate,
  errorHandler(async (req, res) => {
    const { organizationId } = req.query

    let agents
    if (organizationId) {
      agents = backgroundAgentService.getAgentsByOrganization(organizationId)
    } else {
      agents = backgroundAgentService.getAllAgents()
    }

    res.json({
      success: true,
      data: agents,
      count: agents.length
    })
  })
)

/**
 * POST /api/drondoc-agents/background/task
 * Add a task to agent's queue
 */
router.post(
  '/background/task',
  [
    body('instanceId').isString().notEmpty().withMessage('Instance ID is required'),
    body('type').isString().notEmpty().withMessage('Task type is required'),
    body('payload').optional().isObject(),
    body('priority').optional().isInt({ min: 1, max: 10 }),
    body('timeout').optional().isInt({ min: 1000, max: 600000 })
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId, type, payload, priority, timeout } = req.body

    const task = await backgroundAgentService.addTask(instanceId, {
      type,
      payload: payload || {},
      priority: priority || 5,
      timeout
    })

    res.json({
      success: true,
      data: task,
      message: 'Task added to queue'
    })
  })
)

/**
 * GET /api/drondoc-agents/background/events/:instanceId
 * Get event history for agent
 */
router.get(
  '/background/events/:instanceId',
  [
    param('instanceId').isString().notEmpty(),
    query('limit').optional().isInt({ min: 1, max: 200 })
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const limit = parseInt(req.query.limit) || 50

    const events = backgroundAgentService.getEventHistory(instanceId, limit)

    res.json({
      success: true,
      data: events,
      count: events.length
    })
  })
)

/**
 * POST /api/drondoc-agents/background/trigger
 * Trigger agent from external event
 */
router.post(
  '/background/trigger',
  [
    body('instanceId').isString().notEmpty().withMessage('Instance ID is required'),
    body('triggerType').isString().notEmpty().withMessage('Trigger type is required'),
    body('eventData').optional().isObject()
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId, triggerType, eventData } = req.body

    const result = await backgroundAgentService.triggerAgent(
      instanceId,
      triggerType,
      eventData || {}
    )

    res.json({
      success: result.success,
      data: result
    })
  })
)

/**
 * POST /api/drondoc-agents/background/triggers/register
 * Register a trigger for agent
 */
router.post(
  '/background/triggers/register',
  [
    body('instanceId').isString().notEmpty().withMessage('Instance ID is required'),
    body('triggerType').isIn(['file-change', 'schedule', 'webhook', 'event']).withMessage('Invalid trigger type'),
    body('config').isObject().withMessage('Trigger config is required')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId, triggerType, config } = req.body

    // Special handling for file-change trigger
    if (triggerType === 'file-change' && config.workspacePath) {
      // Register with FileWatcherService
      await fileWatcherService.startWatching(instanceId, config.workspacePath, config.options)

      // Forward file change events to agent
      fileWatcherService.on('change', (event) => {
        if (event.workspaceId === instanceId) {
          backgroundAgentService.triggerAgent(instanceId, 'file-change', event)
        }
      })
    }

    const result = backgroundAgentService.registerTrigger(instanceId, triggerType, config)

    res.json({
      success: true,
      data: result,
      message: `Trigger ${triggerType} registered`
    })
  })
)

/**
 * GET /api/drondoc-agents/background/stream/:instanceId
 * Server-Sent Events stream for real-time agent updates
 */
router.get(
  '/background/stream/:instanceId',
  [param('instanceId').isString().notEmpty()],
  validate,
  async (req, res) => {
    const { instanceId } = req.params

    // Check if agent exists
    const status = backgroundAgentService.getAgentStatus(instanceId)
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Agent not running in background'
      })
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    // Send initial status
    res.write(`data: ${JSON.stringify({ type: 'status', data: status })}\n\n`)

    // Event listener
    const eventListener = (event) => {
      if (event.instanceId === instanceId) {
        res.write(`data: ${JSON.stringify({ type: 'event', data: event })}\n\n`)
      }
    }

    // Subscribe to events
    backgroundAgentService.on('event', eventListener)

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`)
    }, 30000)

    // Cleanup on close
    req.on('close', () => {
      clearInterval(heartbeat)
      backgroundAgentService.off('event', eventListener)
      logger.debug({ instanceId }, '[SSE] Client disconnected from agent stream')
    })

    logger.debug({ instanceId }, '[SSE] Client connected to agent stream')
  }
)

/**
 * POST /api/drondoc-agents/background/suggestion
 * Emit a suggestion from agent
 */
router.post(
  '/background/suggestion',
  [
    body('instanceId').isString().notEmpty().withMessage('Instance ID is required'),
    body('type').isString().notEmpty().withMessage('Suggestion type is required'),
    body('title').isString().notEmpty().withMessage('Title is required'),
    body('description').optional().isString(),
    body('file').optional().isString(),
    body('line').optional().isInt(),
    body('fix').optional().isObject()
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId, type, title, description, file, line, fix } = req.body

    const suggestion = backgroundAgentService.emitSuggestion(instanceId, {
      type,
      title,
      description,
      file,
      line,
      fix
    })

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      })
    }

    res.json({
      success: true,
      data: suggestion
    })
  })
)

/**
 * POST /api/drondoc-agents/background/log
 * Add log entry from agent
 */
router.post(
  '/background/log',
  [
    body('instanceId').isString().notEmpty().withMessage('Instance ID is required'),
    body('level').isIn(['debug', 'info', 'warn', 'error']).withMessage('Invalid log level'),
    body('message').isString().notEmpty().withMessage('Message is required'),
    body('data').optional()
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId, level, message, data } = req.body

    backgroundAgentService.agentLog(instanceId, level, message, data)

    res.json({
      success: true,
      message: 'Log entry added'
    })
  })
)

// =============================================================================
// Combined Workspace-like Agent Operations
// =============================================================================

/**
 * POST /api/drondoc-agents/workspace/start
 * Start a complete workspace-like agent with file watching
 */
router.post(
  '/workspace/start',
  [
    body('instanceId').isString().notEmpty().withMessage('Instance ID is required'),
    body('organizationId').isString().notEmpty().withMessage('Organization ID is required'),
    body('workspacePath').isString().notEmpty().withMessage('Workspace path is required'),
    body('analysisType').optional().isIn(['full', 'quick', 'security', 'performance', 'code-review']),
    body('autoAnalyze').optional().isBoolean()
  ],
  validate,
  errorHandler(async (req, res) => {
    const {
      instanceId,
      organizationId,
      workspacePath,
      analysisType = 'quick',
      autoAnalyze = true
    } = req.body

    // Get instance info
    const instance = await agentInstanceService.getInstance(organizationId, instanceId)

    // Start background agent
    await backgroundAgentService.startAgent({
      instanceId,
      organizationId,
      agentId: instance?.agentId || 'workspace-analyzer',
      agentName: instance?.instanceName || 'Workspace Analyzer',
      config: {
        workspacePath,
        analysisType,
        autoAnalyze
      }
    })

    // Start file watcher
    await fileWatcherService.startWatching(instanceId, workspacePath)

    // Register file-change trigger
    backgroundAgentService.registerTrigger(instanceId, 'file-change', {
      workspacePath,
      analysisType
    })

    // Forward file change events
    const fileChangeHandler = (event) => {
      if (event.workspaceId === instanceId && autoAnalyze) {
        backgroundAgentService.addTask(instanceId, {
          type: 'analyze-file',
          payload: {
            file: event.path,
            fullPath: event.fullPath,
            changeType: event.type,
            analysisType
          },
          priority: 6
        })
      }
    }
    fileWatcherService.on('change', fileChangeHandler)

    // Store handler reference for cleanup
    backgroundAgentService.runningAgents.get(instanceId)._fileChangeHandler = fileChangeHandler

    res.json({
      success: true,
      data: {
        instanceId,
        status: 'running',
        workspacePath,
        fileWatcherActive: true,
        autoAnalyze
      },
      message: 'Workspace agent started with file watching'
    })
  })
)

/**
 * POST /api/drondoc-agents/workspace/stop
 * Stop workspace agent and file watcher
 */
router.post(
  '/workspace/stop',
  [
    body('instanceId').isString().notEmpty().withMessage('Instance ID is required')
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.body

    // Get handler reference and remove listener
    const agent = backgroundAgentService.runningAgents.get(instanceId)
    if (agent?._fileChangeHandler) {
      fileWatcherService.off('change', agent._fileChangeHandler)
    }

    // Stop file watcher
    await fileWatcherService.stopWatching(instanceId)

    // Stop background agent
    const result = await backgroundAgentService.stopAgent(instanceId)

    res.json({
      success: result.success,
      data: result,
      message: 'Workspace agent stopped'
    })
  })
)

/**
 * GET /api/drondoc-agents/workspace/changes/:instanceId
 * Get file changes for workspace agent
 */
router.get(
  '/workspace/changes/:instanceId',
  [
    param('instanceId').isString().notEmpty(),
    query('limit').optional().isInt({ min: 1, max: 200 })
  ],
  validate,
  errorHandler(async (req, res) => {
    const { instanceId } = req.params
    const limit = parseInt(req.query.limit) || 50

    const changes = fileWatcherService.getHistory(instanceId, limit)

    res.json({
      success: true,
      data: changes,
      count: changes.length
    })
  })
)

export default router
