/**
 * HealthCheckService
 *
 * Centralized service for managing health checks, incidents, SLA metrics,
 * and alerting for organization agents.
 *
 * Issue #3196 - Automated Health Check Agents and Extended Monitoring
 *
 * Features:
 * - Add/remove health checks for organization agents
 * - Configure health check rules (thresholds, severity)
 * - Trigger alerts when thresholds are violated
 * - Track incidents (open, acknowledged, resolved)
 * - Calculate SLA metrics (uptime%, avg response time, error rate)
 * - Alert channels: email, telegram, webhook
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import logger from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Storage paths
const HEALTH_CHECKS_DIR = process.env.HEALTH_CHECKS_DIR || path.join(__dirname, '../../data/health_checks')
const INCIDENTS_DIR = process.env.INCIDENTS_DIR || path.join(__dirname, '../../data/incidents')
const SLA_METRICS_DIR = process.env.SLA_METRICS_DIR || path.join(__dirname, '../../data/sla_metrics')

// Default health check agents for new organizations
const DEFAULT_HEALTH_CHECK_AGENTS = [
  {
    agentId: 'external-api-monitor',
    agentName: 'ExternalApiMonitorAgent',
    description: 'Monitors external API availability and performance',
    enabled: true
  },
  {
    agentId: 'synthetic-monitoring',
    agentName: 'SyntheticMonitoringAgent',
    description: 'Performs synthetic transactions to test critical workflows',
    enabled: true
  },
  {
    agentId: 'logging-audit',
    agentName: 'LoggingAuditAgent',
    description: 'Centralized logging, audit trails, and compliance',
    enabled: true
  }
]

/**
 * Severity levels for alerts
 */
export const SEVERITY_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
}

/**
 * Incident status
 */
export const INCIDENT_STATUS = {
  OPEN: 'open',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved'
}

/**
 * Alert channels
 */
export const ALERT_CHANNELS = {
  EMAIL: 'email',
  TELEGRAM: 'telegram',
  WEBHOOK: 'webhook'
}

class HealthCheckService {
  constructor() {
    this.initialized = false
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.initialized) return

    try {
      await fs.mkdir(HEALTH_CHECKS_DIR, { recursive: true })
      await fs.mkdir(INCIDENTS_DIR, { recursive: true })
      await fs.mkdir(SLA_METRICS_DIR, { recursive: true })

      this.initialized = true
      logger.info('[HealthCheckService] Initialized successfully')
    } catch (error) {
      logger.error({ error: error.message }, '[HealthCheckService] Initialization failed')
      throw new Error(`Failed to initialize HealthCheckService: ${error.message}`)
    }
  }

  /**
   * Ensure service is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * Add health check agents automatically when organization is created
   */
  async addDefaultHealthCheckAgents(organizationId) {
    await this.ensureInitialized()

    logger.info({ organizationId }, '[HealthCheckService] Adding default health check agents')

    const addedAgents = []

    for (const agentConfig of DEFAULT_HEALTH_CHECK_AGENTS) {
      try {
        const healthCheck = await this.addHealthCheck(organizationId, {
          agentId: agentConfig.agentId,
          agentName: agentConfig.agentName,
          description: agentConfig.description,
          enabled: agentConfig.enabled,
          rules: this.getDefaultRulesForAgent(agentConfig.agentId),
          alertChannels: [ALERT_CHANNELS.EMAIL] // Default to email
        })

        addedAgents.push(healthCheck)
      } catch (error) {
        logger.error(
          { organizationId, agentId: agentConfig.agentId, error: error.message },
          '[HealthCheckService] Failed to add default health check agent'
        )
      }
    }

    logger.info(
      { organizationId, count: addedAgents.length },
      '[HealthCheckService] Added default health check agents'
    )

    return addedAgents
  }

  /**
   * Get default rules for a specific agent type
   */
  getDefaultRulesForAgent(agentId) {
    const defaultRules = {
      'external-api-monitor': [
        {
          metric: 'responseTime',
          operator: '>',
          threshold: 3000, // ms
          severity: SEVERITY_LEVELS.WARNING,
          message: 'Response time exceeded 3 seconds'
        },
        {
          metric: 'errorRate',
          operator: '>',
          threshold: 5, // %
          severity: SEVERITY_LEVELS.CRITICAL,
          message: 'Error rate exceeded 5%'
        },
        {
          metric: 'availability',
          operator: '<',
          threshold: 99, // %
          severity: SEVERITY_LEVELS.CRITICAL,
          message: 'Availability dropped below 99%'
        }
      ],
      'synthetic-monitoring': [
        {
          metric: 'responseTime',
          operator: '>',
          threshold: 5000, // ms
          severity: SEVERITY_LEVELS.WARNING,
          message: 'Synthetic transaction exceeded 5 seconds'
        },
        {
          metric: 'successRate',
          operator: '<',
          threshold: 95, // %
          severity: SEVERITY_LEVELS.CRITICAL,
          message: 'Synthetic transaction success rate below 95%'
        }
      ],
      'logging-audit': [
        {
          metric: 'errorLogRate',
          operator: '>',
          threshold: 10, // %
          severity: SEVERITY_LEVELS.WARNING,
          message: 'Error log rate exceeded 10%'
        },
        {
          metric: 'collectionRate',
          operator: '<',
          threshold: 99, // %
          severity: SEVERITY_LEVELS.CRITICAL,
          message: 'Log collection rate dropped below 99%'
        }
      ]
    }

    return defaultRules[agentId] || []
  }

  /**
   * Add a health check for an organization
   */
  async addHealthCheck(organizationId, config) {
    await this.ensureInitialized()

    if (!organizationId || !config.agentId) {
      throw new Error('Organization ID and agent ID are required')
    }

    const healthCheckId = uuidv4()
    const now = new Date().toISOString()

    const healthCheck = {
      id: healthCheckId,
      organizationId,
      agentId: config.agentId,
      agentName: config.agentName || config.agentId,
      description: config.description || '',
      enabled: config.enabled !== false,
      rules: config.rules || [],
      alertChannels: config.alertChannels || [ALERT_CHANNELS.EMAIL],
      createdAt: now,
      updatedAt: now,
      lastCheckAt: null,
      status: 'unknown', // unknown, healthy, degraded, unhealthy
      metadata: config.metadata || {}
    }

    // Load existing health checks for organization
    const healthChecks = await this.getOrganizationHealthChecks(organizationId)

    // Check if health check for this agent already exists
    const existingIndex = healthChecks.findIndex(hc => hc.agentId === config.agentId)
    if (existingIndex >= 0) {
      // Update existing
      healthChecks[existingIndex] = {
        ...healthChecks[existingIndex],
        ...healthCheck,
        id: healthChecks[existingIndex].id, // Keep original ID
        createdAt: healthChecks[existingIndex].createdAt // Keep original creation date
      }
    } else {
      // Add new
      healthChecks.push(healthCheck)
    }

    await this.saveOrganizationHealthChecks(organizationId, healthChecks)

    logger.info(
      { organizationId, healthCheckId, agentId: config.agentId },
      '[HealthCheckService] Health check added'
    )

    return healthCheck
  }

  /**
   * Configure health check rules
   */
  async configureHealthCheckRules(healthCheckId, rules) {
    await this.ensureInitialized()

    // Find health check across all organizations
    const { organizationId, healthCheck } = await this.findHealthCheck(healthCheckId)

    if (!healthCheck) {
      throw new Error(`Health check not found: ${healthCheckId}`)
    }

    // Validate rules
    if (!Array.isArray(rules)) {
      throw new Error('Rules must be an array')
    }

    for (const rule of rules) {
      if (!rule.metric || !rule.operator || rule.threshold === undefined || !rule.severity) {
        throw new Error('Each rule must have: metric, operator, threshold, severity')
      }

      if (!Object.values(SEVERITY_LEVELS).includes(rule.severity)) {
        throw new Error(`Invalid severity: ${rule.severity}`)
      }
    }

    // Update rules
    healthCheck.rules = rules
    healthCheck.updatedAt = new Date().toISOString()

    // Save back
    const healthChecks = await this.getOrganizationHealthChecks(organizationId)
    const index = healthChecks.findIndex(hc => hc.id === healthCheckId)
    if (index >= 0) {
      healthChecks[index] = healthCheck
      await this.saveOrganizationHealthChecks(organizationId, healthChecks)
    }

    logger.info(
      { healthCheckId, rulesCount: rules.length },
      '[HealthCheckService] Health check rules configured'
    )

    return healthCheck
  }

  /**
   * Trigger an alert when a health check rule is violated
   */
  async triggerAlert(healthCheckId, alertData) {
    await this.ensureInitialized()

    const { organizationId, healthCheck } = await this.findHealthCheck(healthCheckId)

    if (!healthCheck) {
      throw new Error(`Health check not found: ${healthCheckId}`)
    }

    const alertId = uuidv4()
    const now = new Date().toISOString()

    const alert = {
      id: alertId,
      healthCheckId,
      organizationId,
      agentId: healthCheck.agentId,
      agentName: healthCheck.agentName,
      severity: alertData.severity || SEVERITY_LEVELS.WARNING,
      message: alertData.message || 'Health check threshold violated',
      details: alertData.details || {},
      triggeredAt: now,
      acknowledgedAt: null,
      resolvedAt: null,
      status: 'active' // active, acknowledged, resolved
    }

    // Create incident
    const incident = await this.createIncident(organizationId, {
      healthCheckId,
      agentId: healthCheck.agentId,
      agentName: healthCheck.agentName,
      severity: alert.severity,
      message: alert.message,
      details: alert.details,
      triggeredBy: 'health-check'
    })

    // Send alerts to configured channels
    await this.sendAlerts(healthCheck.alertChannels, alert, incident)

    logger.warn(
      { alertId, healthCheckId, severity: alert.severity },
      '[HealthCheckService] Alert triggered'
    )

    return { alert, incident }
  }

  /**
   * Send alerts to configured channels
   */
  async sendAlerts(channels, alert, incident) {
    for (const channel of channels) {
      try {
        switch (channel) {
          case ALERT_CHANNELS.EMAIL:
            await this.sendEmailAlert(alert, incident)
            break
          case ALERT_CHANNELS.TELEGRAM:
            await this.sendTelegramAlert(alert, incident)
            break
          case ALERT_CHANNELS.WEBHOOK:
            await this.sendWebhookAlert(alert, incident)
            break
          default:
            logger.warn({ channel }, '[HealthCheckService] Unknown alert channel')
        }
      } catch (error) {
        logger.error(
          { channel, error: error.message },
          '[HealthCheckService] Failed to send alert'
        )
      }
    }
  }

  /**
   * Send email alert (placeholder - integrate with NotificationAgent)
   */
  async sendEmailAlert(alert, incident) {
    // TODO: Integrate with NotificationAgent
    logger.info(
      { alertId: alert.id, incidentId: incident.id },
      '[HealthCheckService] Email alert (not implemented yet)'
    )
  }

  /**
   * Send Telegram alert (placeholder)
   */
  async sendTelegramAlert(alert, incident) {
    // TODO: Integrate with Telegram bot
    logger.info(
      { alertId: alert.id, incidentId: incident.id },
      '[HealthCheckService] Telegram alert (not implemented yet)'
    )
  }

  /**
   * Send webhook alert (placeholder)
   */
  async sendWebhookAlert(alert, incident) {
    // TODO: Implement webhook integration
    logger.info(
      { alertId: alert.id, incidentId: incident.id },
      '[HealthCheckService] Webhook alert (not implemented yet)'
    )
  }

  /**
   * Create an incident
   */
  async createIncident(organizationId, incidentData) {
    await this.ensureInitialized()

    const incidentId = uuidv4()
    const now = new Date().toISOString()

    const incident = {
      id: incidentId,
      organizationId,
      healthCheckId: incidentData.healthCheckId || null,
      agentId: incidentData.agentId,
      agentName: incidentData.agentName || incidentData.agentId,
      severity: incidentData.severity || SEVERITY_LEVELS.WARNING,
      status: INCIDENT_STATUS.OPEN,
      message: incidentData.message || 'Incident detected',
      description: incidentData.description || '',
      details: incidentData.details || {},
      triggeredBy: incidentData.triggeredBy || 'manual',
      createdAt: now,
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      resolutionNotes: null,
      notes: []
    }

    // Load existing incidents
    const incidents = await this.getIncidentHistory(organizationId)
    incidents.push(incident)
    await this.saveIncidents(organizationId, incidents)

    logger.info(
      { incidentId, organizationId, severity: incident.severity },
      '[HealthCheckService] Incident created'
    )

    return incident
  }

  /**
   * Acknowledge an incident
   */
  async acknowledgeIncident(incidentId, userId) {
    await this.ensureInitialized()

    const { organizationId, incident } = await this.findIncident(incidentId)

    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`)
    }

    if (incident.status !== INCIDENT_STATUS.OPEN) {
      throw new Error(`Incident ${incidentId} is already ${incident.status}`)
    }

    incident.status = INCIDENT_STATUS.ACKNOWLEDGED
    incident.acknowledgedAt = new Date().toISOString()
    incident.acknowledgedBy = userId

    await this.updateIncident(organizationId, incident)

    logger.info(
      { incidentId, userId },
      '[HealthCheckService] Incident acknowledged'
    )

    return incident
  }

  /**
   * Resolve an incident
   */
  async resolveIncident(incidentId, userId, resolutionNotes) {
    await this.ensureInitialized()

    const { organizationId, incident } = await this.findIncident(incidentId)

    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`)
    }

    if (incident.status === INCIDENT_STATUS.RESOLVED) {
      throw new Error(`Incident ${incidentId} is already resolved`)
    }

    incident.status = INCIDENT_STATUS.RESOLVED
    incident.resolvedAt = new Date().toISOString()
    incident.resolvedBy = userId
    incident.resolutionNotes = resolutionNotes || ''

    await this.updateIncident(organizationId, incident)

    logger.info(
      { incidentId, userId },
      '[HealthCheckService] Incident resolved'
    )

    return incident
  }

  /**
   * Add note to incident
   */
  async addIncidentNote(incidentId, userId, note) {
    await this.ensureInitialized()

    const { organizationId, incident } = await this.findIncident(incidentId)

    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`)
    }

    const noteEntry = {
      id: uuidv4(),
      userId,
      text: note,
      createdAt: new Date().toISOString()
    }

    incident.notes.push(noteEntry)

    await this.updateIncident(organizationId, incident)

    logger.info(
      { incidentId, userId },
      '[HealthCheckService] Note added to incident'
    )

    return incident
  }

  /**
   * Get incident history for organization
   */
  async getIncidentHistory(organizationId, filters = {}) {
    await this.ensureInitialized()

    try {
      const filePath = path.join(INCIDENTS_DIR, `${organizationId}.json`)
      const data = await fs.readFile(filePath, 'utf-8')
      let incidents = JSON.parse(data)

      // Apply filters
      if (filters.status) {
        incidents = incidents.filter(i => i.status === filters.status)
      }

      if (filters.severity) {
        incidents = incidents.filter(i => i.severity === filters.severity)
      }

      if (filters.agentId) {
        incidents = incidents.filter(i => i.agentId === filters.agentId)
      }

      if (filters.startDate) {
        incidents = incidents.filter(i => new Date(i.createdAt) >= new Date(filters.startDate))
      }

      if (filters.endDate) {
        incidents = incidents.filter(i => new Date(i.createdAt) <= new Date(filters.endDate))
      }

      // Sort by creation date (newest first)
      incidents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      return incidents
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  /**
   * Get SLA metrics for organization
   */
  async getSLAMetrics(organizationId, timeRange = '30d') {
    await this.ensureInitialized()

    const healthChecks = await this.getOrganizationHealthChecks(organizationId)
    const incidents = await this.getIncidentHistory(organizationId)

    // Calculate time range
    const now = new Date()
    const startDate = this.calculateStartDate(now, timeRange)

    // Filter incidents within time range
    const recentIncidents = incidents.filter(
      i => new Date(i.createdAt) >= startDate
    )

    const slaMetrics = {
      organizationId,
      timeRange,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      agents: []
    }

    for (const healthCheck of healthChecks) {
      const agentIncidents = recentIncidents.filter(i => i.agentId === healthCheck.agentId)

      // Calculate uptime percentage
      const totalTimeMs = now - startDate
      const downtimeMs = this.calculateDowntimeMs(agentIncidents)
      const uptimePercent = ((totalTimeMs - downtimeMs) / totalTimeMs) * 100

      // Calculate MTTR (Mean Time To Resolution)
      const resolvedIncidents = agentIncidents.filter(i => i.status === INCIDENT_STATUS.RESOLVED)
      const mttr = this.calculateMTTR(resolvedIncidents)

      // Calculate error rate
      const totalIncidents = agentIncidents.length
      const criticalIncidents = agentIncidents.filter(i => i.severity === SEVERITY_LEVELS.CRITICAL).length

      const agentMetrics = {
        agentId: healthCheck.agentId,
        agentName: healthCheck.agentName,
        uptime: uptimePercent.toFixed(2),
        availability: uptimePercent >= 99 ? 'healthy' : uptimePercent >= 95 ? 'degraded' : 'unhealthy',
        totalIncidents,
        criticalIncidents,
        warningIncidents: agentIncidents.filter(i => i.severity === SEVERITY_LEVELS.WARNING).length,
        openIncidents: agentIncidents.filter(i => i.status === INCIDENT_STATUS.OPEN).length,
        mttr: mttr, // in minutes
        slaViolations: this.calculateSLAViolations(healthCheck, agentIncidents)
      }

      slaMetrics.agents.push(agentMetrics)
    }

    // Calculate overall metrics
    slaMetrics.overall = {
      avgUptime: (slaMetrics.agents.reduce((sum, a) => sum + parseFloat(a.uptime), 0) / slaMetrics.agents.length).toFixed(2),
      totalIncidents: slaMetrics.agents.reduce((sum, a) => sum + a.totalIncidents, 0),
      criticalIncidents: slaMetrics.agents.reduce((sum, a) => sum + a.criticalIncidents, 0),
      openIncidents: slaMetrics.agents.reduce((sum, a) => sum + a.openIncidents, 0),
      avgMTTR: (slaMetrics.agents.reduce((sum, a) => sum + a.mttr, 0) / slaMetrics.agents.length).toFixed(2)
    }

    return slaMetrics
  }

  /**
   * Calculate start date based on time range
   */
  calculateStartDate(now, timeRange) {
    const date = new Date(now)

    if (timeRange.endsWith('h')) {
      const hours = parseInt(timeRange)
      date.setHours(date.getHours() - hours)
    } else if (timeRange.endsWith('d')) {
      const days = parseInt(timeRange)
      date.setDate(date.getDate() - days)
    } else if (timeRange.endsWith('m')) {
      const months = parseInt(timeRange)
      date.setMonth(date.getMonth() - months)
    }

    return date
  }

  /**
   * Calculate total downtime in milliseconds
   */
  calculateDowntimeMs(incidents) {
    let totalDowntimeMs = 0

    for (const incident of incidents) {
      const start = new Date(incident.createdAt)
      const end = incident.resolvedAt ? new Date(incident.resolvedAt) : new Date()
      const duration = end - start

      // Only count critical incidents as downtime
      if (incident.severity === SEVERITY_LEVELS.CRITICAL) {
        totalDowntimeMs += duration
      }
    }

    return totalDowntimeMs
  }

  /**
   * Calculate Mean Time To Resolution (MTTR) in minutes
   */
  calculateMTTR(resolvedIncidents) {
    if (resolvedIncidents.length === 0) return 0

    let totalResolutionTimeMs = 0

    for (const incident of resolvedIncidents) {
      const start = new Date(incident.createdAt)
      const end = new Date(incident.resolvedAt)
      totalResolutionTimeMs += (end - start)
    }

    const avgResolutionTimeMs = totalResolutionTimeMs / resolvedIncidents.length
    return Math.round(avgResolutionTimeMs / (1000 * 60)) // Convert to minutes
  }

  /**
   * Calculate SLA violations
   */
  calculateSLAViolations(healthCheck, incidents) {
    const violations = []

    // Check availability SLA (99% uptime)
    const criticalIncidents = incidents.filter(i => i.severity === SEVERITY_LEVELS.CRITICAL)
    if (criticalIncidents.length > 0) {
      violations.push({
        type: 'availability',
        message: `${criticalIncidents.length} critical incidents detected`,
        severity: SEVERITY_LEVELS.CRITICAL
      })
    }

    // Add more SLA violation checks based on rules
    for (const rule of healthCheck.rules) {
      // This would need actual metric data to evaluate
      // Placeholder for now
    }

    return violations
  }

  /**
   * Get organization health checks
   */
  async getOrganizationHealthChecks(organizationId) {
    await this.ensureInitialized()

    try {
      const filePath = path.join(HEALTH_CHECKS_DIR, `${organizationId}.json`)
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  /**
   * Save organization health checks
   */
  async saveOrganizationHealthChecks(organizationId, healthChecks) {
    const filePath = path.join(HEALTH_CHECKS_DIR, `${organizationId}.json`)
    await fs.writeFile(filePath, JSON.stringify(healthChecks, null, 2), 'utf-8')
  }

  /**
   * Save incidents
   */
  async saveIncidents(organizationId, incidents) {
    const filePath = path.join(INCIDENTS_DIR, `${organizationId}.json`)
    await fs.writeFile(filePath, JSON.stringify(incidents, null, 2), 'utf-8')
  }

  /**
   * Find health check by ID across all organizations
   */
  async findHealthCheck(healthCheckId) {
    try {
      const files = await fs.readdir(HEALTH_CHECKS_DIR)

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        const organizationId = file.replace('.json', '')
        const healthChecks = await this.getOrganizationHealthChecks(organizationId)

        const healthCheck = healthChecks.find(hc => hc.id === healthCheckId)
        if (healthCheck) {
          return { organizationId, healthCheck }
        }
      }
    } catch (error) {
      logger.error({ error: error.message }, '[HealthCheckService] Error finding health check')
    }

    return { organizationId: null, healthCheck: null }
  }

  /**
   * Find incident by ID across all organizations
   */
  async findIncident(incidentId) {
    try {
      const files = await fs.readdir(INCIDENTS_DIR)

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        const organizationId = file.replace('.json', '')
        const incidents = await this.getIncidentHistory(organizationId)

        const incident = incidents.find(i => i.id === incidentId)
        if (incident) {
          return { organizationId, incident }
        }
      }
    } catch (error) {
      logger.error({ error: error.message }, '[HealthCheckService] Error finding incident')
    }

    return { organizationId: null, incident: null }
  }

  /**
   * Update incident
   */
  async updateIncident(organizationId, updatedIncident) {
    const incidents = await this.getIncidentHistory(organizationId)
    const index = incidents.findIndex(i => i.id === updatedIncident.id)

    if (index >= 0) {
      incidents[index] = updatedIncident
      await this.saveIncidents(organizationId, incidents)
    }
  }
}

// Export singleton instance
const healthCheckService = new HealthCheckService()
export default healthCheckService

