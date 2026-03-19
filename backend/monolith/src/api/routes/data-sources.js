/**
 * Data Sources API Routes
 *
 * RESTful API for managing organization data sources (API, database, file, webhook connections)
 *
 * Issue #3194 - Data source connection and management
 *
 * Security:
 * - Authentication required
 * - Role-based access control (owner, admin, member)
 * - Integration with organization secrets for credentials
 * - Comprehensive audit logging
 */

import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import dataSourcesManager, {
  SOURCE_TYPES,
  DATABASE_TYPES,
  AUTH_TYPES,
  SOURCE_STATUS,
  SYNC_STRATEGIES
} from '../../services/data-sources/DataSourcesManager.js'

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
 * POST /api/data-sources
 * Create a new data source
 */
router.post(
  '/',
  [
    body('organizationId')
      .isUUID()
      .withMessage('Invalid organization ID'),
    body('name')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 1, max: 255 }),
    body('type')
      .isIn(Object.values(SOURCE_TYPES))
      .withMessage('Invalid source type'),
    body('description')
      .optional()
      .isString()
      .trim(),
    body('secretId')
      .optional()
      .isUUID()
      .withMessage('Invalid secret ID'),
    body('configuration')
      .optional()
      .isObject()
      .withMessage('Configuration must be an object')
  ],
  validate,
  async (req, res) => {
    try {
      const userId = getUserId(req)
      const {
        organizationId,
        name,
        type,
        description,
        secretId,
        configuration
      } = req.body

      const dataSource = await dataSourcesManager.createDataSource({
        organizationId,
        name,
        type,
        description,
        secretId,
        configuration: configuration || {},
        createdBy: userId
      })

      res.status(201).json({
        success: true,
        data: dataSource,
        message: 'Data source created successfully'
      })
    } catch (error) {
      console.error('[Data Sources API] Create error:', error)
      const status = error.message.includes('permission') ? 403 :
                     error.message.includes('not found') ? 404 :
                     error.message.includes('Invalid') ? 400 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/data-sources
 * List data sources for an organization
 */
router.get(
  '/',
  [
    query('organizationId')
      .isUUID()
      .withMessage('Invalid organization ID'),
    query('type')
      .optional()
      .isIn(Object.values(SOURCE_TYPES))
      .withMessage('Invalid source type'),
    query('status')
      .optional()
      .isIn(Object.values(SOURCE_STATUS))
      .withMessage('Invalid status')
  ],
  validate,
  async (req, res) => {
    try {
      const userId = getUserId(req)
      const { organizationId, type, status } = req.query

      const filters = {}
      if (type) filters.type = type
      if (status) filters.status = status

      const dataSources = await dataSourcesManager.listDataSources(
        organizationId,
        userId,
        filters
      )

      res.json({
        success: true,
        data: dataSources,
        count: dataSources.length
      })
    } catch (error) {
      console.error('[Data Sources API] List error:', error)
      const status = error.message.includes('access') ? 403 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/data-sources/:id
 * Get a specific data source
 */
router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid data source ID')
  ],
  validate,
  async (req, res) => {
    try {
      const userId = getUserId(req)
      const { id } = req.params

      const dataSource = await dataSourcesManager.getDataSource(id, userId)

      if (!dataSource) {
        return res.status(404).json({
          success: false,
          error: 'Data source not found'
        })
      }

      res.json({
        success: true,
        data: dataSource
      })
    } catch (error) {
      console.error('[Data Sources API] Get error:', error)
      const status = error.message.includes('access') ? 403 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * PUT /api/data-sources/:id
 * Update a data source
 */
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid data source ID'),
    body('name')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 }),
    body('description')
      .optional()
      .isString()
      .trim(),
    body('secretId')
      .optional()
      .isUUID()
      .withMessage('Invalid secret ID'),
    body('configuration')
      .optional()
      .isObject(),
    body('status')
      .optional()
      .isIn(Object.values(SOURCE_STATUS))
      .withMessage('Invalid status'),
    body('metadata')
      .optional()
      .isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const userId = getUserId(req)
      const { id } = req.params
      const updates = req.body

      const dataSource = await dataSourcesManager.updateDataSource(
        id,
        updates,
        userId
      )

      res.json({
        success: true,
        data: dataSource,
        message: 'Data source updated successfully'
      })
    } catch (error) {
      console.error('[Data Sources API] Update error:', error)
      const status = error.message.includes('permission') ? 403 :
                     error.message.includes('not found') ? 404 :
                     error.message.includes('Invalid') ? 400 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * DELETE /api/data-sources/:id
 * Delete a data source
 */
router.delete(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid data source ID')
  ],
  validate,
  async (req, res) => {
    try {
      const userId = getUserId(req)
      const { id } = req.params

      await dataSourcesManager.deleteDataSource(id, userId)

      res.json({
        success: true,
        message: 'Data source deleted successfully'
      })
    } catch (error) {
      console.error('[Data Sources API] Delete error:', error)
      const status = error.message.includes('permission') ? 403 :
                     error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/data-sources/:id/test
 * Test data source connection
 */
router.post(
  '/:id/test',
  [
    param('id').isUUID().withMessage('Invalid data source ID')
  ],
  validate,
  async (req, res) => {
    try {
      const userId = getUserId(req)
      const { id } = req.params

      const testResult = await dataSourcesManager.testConnection(id, userId)

      res.json({
        success: true,
        data: testResult,
        message: testResult.success ? 'Connection test successful' : 'Connection test failed'
      })
    } catch (error) {
      console.error('[Data Sources API] Test error:', error)
      const status = error.message.includes('not found') ? 404 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * POST /api/data-sources/:id/sync
 * Trigger data synchronization
 */
router.post(
  '/:id/sync',
  [
    param('id').isUUID().withMessage('Invalid data source ID')
  ],
  validate,
  async (req, res) => {
    try {
      const userId = getUserId(req)
      const { id } = req.params

      const syncResult = await dataSourcesManager.triggerSync(id, userId)

      res.json({
        success: true,
        data: syncResult,
        message: 'Data synchronization completed'
      })
    } catch (error) {
      console.error('[Data Sources API] Sync error:', error)
      const status = error.message.includes('not found') ? 404 :
                     error.message.includes('must be active') ? 400 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/data-sources/stats/:organizationId
 * Get data source statistics for an organization
 */
router.get(
  '/stats/:organizationId',
  [
    param('organizationId').isUUID().withMessage('Invalid organization ID')
  ],
  validate,
  async (req, res) => {
    try {
      const userId = getUserId(req)
      const { organizationId } = req.params

      const stats = await dataSourcesManager.getStatistics(organizationId, userId)

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('[Data Sources API] Stats error:', error)
      const status = error.message.includes('access') ? 403 : 500
      res.status(status).json({
        success: false,
        error: error.message
      })
    }
  }
)

/**
 * GET /api/data-sources/meta/types
 * Get available data source types and their configurations
 */
router.get('/meta/types', (req, res) => {
  res.json({
    success: true,
    data: {
      sourceTypes: Object.entries(SOURCE_TYPES).map(([key, value]) => ({
        key,
        value,
        label: key.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
      })),
      databaseTypes: Object.entries(DATABASE_TYPES).map(([key, value]) => ({
        key,
        value,
        label: key.charAt(0) + key.slice(1).toLowerCase()
      })),
      authTypes: Object.entries(AUTH_TYPES).map(([key, value]) => ({
        key,
        value,
        label: key.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
      })),
      syncStrategies: Object.entries(SYNC_STRATEGIES).map(([key, value]) => ({
        key,
        value,
        label: key.charAt(0) + key.slice(1).toLowerCase()
      }))
    }
  })
})

/**
 * GET /api/data-sources/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    await dataSourcesManager.ensureInitialized()
    res.json({
      success: true,
      status: 'healthy',
      service: 'data-sources',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      service: 'data-sources',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

export default router
