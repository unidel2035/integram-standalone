/**
 * Health Checks API Routes
 *
 * Issue #3196 - Automated Health Check Agents and Extended Monitoring
 *
 * Endpoints:
 * - POST /api/health-checks - Add health check
 * - GET /api/organizations/:id/health-checks - List health checks for organization
 * - PUT /api/health-checks/:id/rules - Update health check rules
 * - GET /api/organizations/:id/incidents - Get incident history
 * - POST /api/incidents/:id/acknowledge - Acknowledge incident
 * - POST /api/incidents/:id/resolve - Resolve incident
 * - POST /api/incidents/:id/notes - Add note to incident
 * - GET /api/organizations/:id/sla-metrics - Get SLA metrics
 */

import { Router } from 'express'
import healthCheckService from '../../services/HealthCheckService.js'
import logger from '../../utils/logger.js'

const router = Router()

/**
 * POST /api/health-checks
 * Add a health check for an organization
 */
router.post('/health-checks', async (req, res) => {
  try {
    const { organizationId, agentId, agentName, description, enabled, rules, alertChannels } = req.body

    if (!organizationId || !agentId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID and agent ID are required'
      })
    }

    const healthCheck = await healthCheckService.addHealthCheck(organizationId, {
      agentId,
      agentName,
      description,
      enabled,
      rules,
      alertChannels
    })

    res.status(201).json({
      success: true,
      data: healthCheck
    })
  } catch (error) {
    logger.error({ error: error.message }, '[HealthChecksAPI] Failed to add health check')
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/organizations/:id/health-checks
 * Get all health checks for an organization
 */
router.get('/organizations/:id/health-checks', async (req, res) => {
  try {
    const { id: organizationId } = req.params

    const healthChecks = await healthCheckService.getOrganizationHealthChecks(organizationId)

    res.json({
      success: true,
      data: healthChecks
    })
  } catch (error) {
    logger.error({ error: error.message }, '[HealthChecksAPI] Failed to get health checks')
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * PUT /api/health-checks/:id/rules
 * Update health check rules
 */
router.put('/health-checks/:id/rules', async (req, res) => {
  try {
    const { id: healthCheckId } = req.params
    const { rules } = req.body

    if (!Array.isArray(rules)) {
      return res.status(400).json({
        success: false,
        error: 'Rules must be an array'
      })
    }

    const healthCheck = await healthCheckService.configureHealthCheckRules(healthCheckId, rules)

    res.json({
      success: true,
      data: healthCheck
    })
  } catch (error) {
    logger.error({ error: error.message }, '[HealthChecksAPI] Failed to configure health check rules')
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/health-checks/:id/alert
 * Trigger an alert for a health check
 */
router.post('/health-checks/:id/alert', async (req, res) => {
  try {
    const { id: healthCheckId } = req.params
    const { severity, message, details } = req.body

    const result = await healthCheckService.triggerAlert(healthCheckId, {
      severity,
      message,
      details
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error({ error: error.message }, '[HealthChecksAPI] Failed to trigger alert')
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/organizations/:id/incidents
 * Get incident history for organization
 */
router.get('/organizations/:id/incidents', async (req, res) => {
  try {
    const { id: organizationId } = req.params
    const { status, severity, agentId, startDate, endDate } = req.query

    const incidents = await healthCheckService.getIncidentHistory(organizationId, {
      status,
      severity,
      agentId,
      startDate,
      endDate
    })

    res.json({
      success: true,
      data: incidents
    })
  } catch (error) {
    logger.error({ error: error.message }, '[HealthChecksAPI] Failed to get incident history')
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/incidents
 * Create a new incident manually
 */
router.post('/incidents', async (req, res) => {
  try {
    const { organizationId, agentId, agentName, severity, message, description, details } = req.body

    if (!organizationId || !agentId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID and agent ID are required'
      })
    }

    const incident = await healthCheckService.createIncident(organizationId, {
      agentId,
      agentName,
      severity,
      message,
      description,
      details,
      triggeredBy: 'manual'
    })

    res.status(201).json({
      success: true,
      data: incident
    })
  } catch (error) {
    logger.error({ error: error.message }, '[HealthChecksAPI] Failed to create incident')
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/incidents/:id/acknowledge
 * Acknowledge an incident
 */
router.post('/incidents/:id/acknowledge', async (req, res) => {
  try {
    const { id: incidentId } = req.params
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      })
    }

    const incident = await healthCheckService.acknowledgeIncident(incidentId, userId)

    res.json({
      success: true,
      data: incident
    })
  } catch (error) {
    logger.error({ error: error.message }, '[HealthChecksAPI] Failed to acknowledge incident')
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/incidents/:id/resolve
 * Resolve an incident
 */
router.post('/incidents/:id/resolve', async (req, res) => {
  try {
    const { id: incidentId } = req.params
    const { userId, resolutionNotes } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      })
    }

    const incident = await healthCheckService.resolveIncident(incidentId, userId, resolutionNotes)

    res.json({
      success: true,
      data: incident
    })
  } catch (error) {
    logger.error({ error: error.message }, '[HealthChecksAPI] Failed to resolve incident')
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/incidents/:id/notes
 * Add a note to an incident
 */
router.post('/incidents/:id/notes', async (req, res) => {
  try {
    const { id: incidentId } = req.params
    const { userId, note } = req.body

    if (!userId || !note) {
      return res.status(400).json({
        success: false,
        error: 'User ID and note are required'
      })
    }

    const incident = await healthCheckService.addIncidentNote(incidentId, userId, note)

    res.json({
      success: true,
      data: incident
    })
  } catch (error) {
    logger.error({ error: error.message }, '[HealthChecksAPI] Failed to add incident note')
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/organizations/:id/sla-metrics
 * Get SLA metrics for organization
 */
router.get('/organizations/:id/sla-metrics', async (req, res) => {
  try {
    const { id: organizationId } = req.params
    const { timeRange } = req.query

    const slaMetrics = await healthCheckService.getSLAMetrics(
      organizationId,
      timeRange || '30d'
    )

    res.json({
      success: true,
      data: slaMetrics
    })
  } catch (error) {
    logger.error({ error: error.message }, '[HealthChecksAPI] Failed to get SLA metrics')
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/incidents/:id
 * Get incident details by ID
 */
router.get('/incidents/:id', async (req, res) => {
  try {
    const { id: incidentId } = req.params

    const { incident } = await healthCheckService.findIncident(incidentId)

    if (!incident) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found'
      })
    }

    res.json({
      success: true,
      data: incident
    })
  } catch (error) {
    logger.error({ error: error.message }, '[HealthChecksAPI] Failed to get incident')
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
