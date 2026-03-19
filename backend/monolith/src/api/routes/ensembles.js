/**
 * Ensemble Deployment API Routes
 *
 * Endpoints for managing and deploying agent ensembles to organizations.
 *
 * Routes:
 * - GET /api/ensembles - Get all available ensemble templates
 * - GET /api/ensembles/:id - Get specific ensemble template
 * - POST /api/ensembles/deploy - Deploy an ensemble to organization
 * - GET /api/ensembles/deployments/:organizationId - Get deployment history
 * - GET /api/ensembles/deployed/:organizationId - Get deployed ensembles
 * - GET /api/ensembles/status/:deploymentId - Get deployment status
 *
 * @module api/routes/ensembles
 * Fixes: #3519 – implement GET endpoints via EnsembleService
 */

import express from 'express'
import EnsembleService from '../../services/ensembles/EnsembleService.js'

const router = express.Router()

// Lazy-initialized singleton for EnsembleService
let ensembleService
function getEnsembleService() {
  if (!ensembleService) {
    ensembleService = new EnsembleService({ logger: console })
  }
  return ensembleService
}

/**
 * GET /api/ensembles
 * Get all available ensemble templates
 */
router.get('/ensembles', async (req, res) => {
  try {
    const service = getEnsembleService()
    const ensembles = await service.getAllEnsembles()

    res.json({
      success: true,
      data: ensembles,
      meta: {
        total: ensembles.length,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error fetching ensembles:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ensemble templates',
      message: error.message
    })
  }
})

/**
 * GET /api/ensembles/:id
 * Get specific ensemble template by ID
 */
router.get('/ensembles/:id', async (req, res) => {
  try {
    const { id } = req.params
    const service = getEnsembleService()
    const ensemble = await service.getEnsemble(id)

    res.json({
      success: true,
      data: ensemble
    })
  } catch (error) {
    if (String(error.message || '').includes('Ensemble not found')) {
      return res.status(404).json({
        success: false,
        error: 'Ensemble not found',
        message: `Ensemble with ID "${req.params.id}" does not exist`
      })
    }
    console.error('Error fetching ensemble:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ensemble',
      message: error.message
    })
  }
})

/**
 * POST /api/ensembles/deploy
 * Deploy an ensemble to an organization
 *
 * Request body:
 * {
 *   "organizationId": "org-123",
 *   "ensembleId": "business-automation-suite",
 *   "options": {
 *     "autoStart": true
 *   }
 * }
 */
router.post('/ensembles/deploy', async (req, res) => {
  try {
    const { organizationId, ensembleId, options } = req.body

    // Validation
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'organizationId is required'
      })
    }

    if (!ensembleId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'ensembleId is required'
      })
    }

    // TODO: Initialize and use ensembleService
    const result = { deployment: {} } // Placeholder

    res.json({
      success: true,
      data: result.deployment,
      message: 'Ensemble deployment completed successfully'
    })
  } catch (error) {
    console.error('Error deploying ensemble:', error)

    // Determine appropriate status code
    const statusCode = error.message.includes('not found')
      ? 404
      : error.message.includes('Invalid')
      ? 400
      : 500

    res.status(statusCode).json({
      success: false,
      error: 'Deployment failed',
      message: error.message
    })
  }
})

/**
 * GET /api/ensembles/deployments/:organizationId
 * Get deployment history for an organization
 */
router.get('/ensembles/deployments/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params
    // TODO: Initialize and use ensembleService
    const history = [] // Placeholder

    res.json({
      success: true,
      data: history,
      meta: {
        total: history.length,
        organizationId
      }
    })
  } catch (error) {
    console.error('Error fetching deployment history:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deployment history',
      message: error.message
    })
  }
})

/**
 * GET /api/ensembles/deployed/:organizationId
 * Get currently deployed ensembles for an organization
 */
router.get('/ensembles/deployed/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params
    // TODO: Initialize and use ensembleService
    const deployed = [] // Placeholder

    res.json({
      success: true,
      data: deployed,
      meta: {
        total: deployed.length,
        organizationId
      }
    })
  } catch (error) {
    console.error('Error fetching deployed ensembles:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deployed ensembles',
      message: error.message
    })
  }
})

/**
 * GET /api/ensembles/status/:deploymentId
 * Get real-time status of an active deployment
 */
router.get('/ensembles/status/:deploymentId', async (req, res) => {
  try {
    const { deploymentId } = req.params
    // TODO: Initialize and use ensembleService
    const status = null // Placeholder

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found',
        message: `No active deployment found with ID "${deploymentId}"`
      })
    }

    res.json({
      success: true,
      data: {
        id: status.id,
        ensembleId: status.ensembleId,
        ensembleName: status.ensemble.name,
        status: status.status,
        deployedAgents: status.deployedAgents,
        errors: status.errors,
        steps: status.steps,
        startedAt: status.startedAt,
        completedAt: status.completedAt
      }
    })
  } catch (error) {
    console.error('Error fetching deployment status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deployment status',
      message: error.message
    })
  }
})

export default router
