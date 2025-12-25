/**
 * HealthCheckService Tests
 *
 * Issue #3196 - Automated Health Check Agents and Extended Monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import healthCheckService, {
  SEVERITY_LEVELS,
  INCIDENT_STATUS,
  ALERT_CHANNELS,
  DEFAULT_HEALTH_CHECK_AGENTS
} from '../HealthCheckService.js'

// Test data directory
const TEST_DATA_DIR = path.join(process.cwd(), 'data_test', 'health_checks_test')
const TEST_HEALTH_CHECKS_DIR = path.join(TEST_DATA_DIR, 'health_checks')
const TEST_INCIDENTS_DIR = path.join(TEST_DATA_DIR, 'incidents')

describe('HealthCheckService', () => {
  const testOrg = 'test-org-123'

  beforeEach(async () => {
    // Override storage paths for testing
    process.env.HEALTH_CHECKS_DIR = TEST_HEALTH_CHECKS_DIR
    process.env.INCIDENTS_DIR = TEST_INCIDENTS_DIR

    // Create test directories
    await fs.mkdir(TEST_HEALTH_CHECKS_DIR, { recursive: true })
    await fs.mkdir(TEST_INCIDENTS_DIR, { recursive: true })

    // Reset initialization
    healthCheckService.initialized = false
    await healthCheckService.initialize()
  })

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Service Initialization', () => {
    it('should initialize successfully', async () => {
      expect(healthCheckService.initialized).toBe(true)
    })

    it('should create storage directories', async () => {
      const healthChecksExists = await fs.access(TEST_HEALTH_CHECKS_DIR).then(() => true).catch(() => false)
      const incidentsExists = await fs.access(TEST_INCIDENTS_DIR).then(() => true).catch(() => false)

      expect(healthChecksExists).toBe(true)
      expect(incidentsExists).toBe(true)
    })
  })

  describe('Default Health Check Agents', () => {
    it('should add default health check agents for new organization', async () => {
      const agents = await healthCheckService.addDefaultHealthCheckAgents(testOrg)

      expect(agents).toHaveLength(3)
      expect(agents[0].agentId).toBe('external-api-monitor')
      expect(agents[1].agentId).toBe('synthetic-monitoring')
      expect(agents[2].agentId).toBe('logging-audit')
    })

    it('should configure default rules for each agent type', async () => {
      const agents = await healthCheckService.addDefaultHealthCheckAgents(testOrg)

      // External API Monitor should have response time and error rate rules
      const apiMonitor = agents.find(a => a.agentId === 'external-api-monitor')
      expect(apiMonitor.rules.length).toBeGreaterThan(0)
      expect(apiMonitor.rules.some(r => r.metric === 'responseTime')).toBe(true)
      expect(apiMonitor.rules.some(r => r.metric === 'errorRate')).toBe(true)

      // Synthetic Monitoring should have response time and success rate rules
      const syntheticMonitor = agents.find(a => a.agentId === 'synthetic-monitoring')
      expect(syntheticMonitor.rules.length).toBeGreaterThan(0)

      // Logging Audit should have error log rate rules
      const loggingAudit = agents.find(a => a.agentId === 'logging-audit')
      expect(loggingAudit.rules.length).toBeGreaterThan(0)
    })
  })

  describe('Health Check Management', () => {
    it('should add a health check for organization', async () => {
      const healthCheck = await healthCheckService.addHealthCheck(testOrg, {
        agentId: 'test-agent',
        agentName: 'Test Agent',
        description: 'Test health check',
        enabled: true,
        rules: [
          {
            metric: 'responseTime',
            operator: '>',
            threshold: 1000,
            severity: SEVERITY_LEVELS.WARNING,
            message: 'Response time too high'
          }
        ],
        alertChannels: [ALERT_CHANNELS.EMAIL]
      })

      expect(healthCheck.id).toBeDefined()
      expect(healthCheck.organizationId).toBe(testOrg)
      expect(healthCheck.agentId).toBe('test-agent')
      expect(healthCheck.enabled).toBe(true)
      expect(healthCheck.rules).toHaveLength(1)
    })

    it('should retrieve health checks for organization', async () => {
      await healthCheckService.addHealthCheck(testOrg, {
        agentId: 'agent-1',
        agentName: 'Agent 1'
      })

      await healthCheckService.addHealthCheck(testOrg, {
        agentId: 'agent-2',
        agentName: 'Agent 2'
      })

      const healthChecks = await healthCheckService.getOrganizationHealthChecks(testOrg)
      expect(healthChecks).toHaveLength(2)
    })

    it('should configure health check rules', async () => {
      const healthCheck = await healthCheckService.addHealthCheck(testOrg, {
        agentId: 'test-agent',
        agentName: 'Test Agent',
        rules: []
      })

      const newRules = [
        {
          metric: 'errorRate',
          operator: '>',
          threshold: 5,
          severity: SEVERITY_LEVELS.CRITICAL,
          message: 'Error rate exceeded'
        }
      ]

      const updated = await healthCheckService.configureHealthCheckRules(healthCheck.id, newRules)

      expect(updated.rules).toHaveLength(1)
      expect(updated.rules[0].metric).toBe('errorRate')
      expect(updated.rules[0].threshold).toBe(5)
    })

    it('should validate rules format', async () => {
      const healthCheck = await healthCheckService.addHealthCheck(testOrg, {
        agentId: 'test-agent',
        agentName: 'Test Agent'
      })

      const invalidRules = [
        {
          metric: 'errorRate'
          // Missing required fields
        }
      ]

      await expect(
        healthCheckService.configureHealthCheckRules(healthCheck.id, invalidRules)
      ).rejects.toThrow()
    })
  })

  describe('Incident Management', () => {
    it('should create an incident', async () => {
      const incident = await healthCheckService.createIncident(testOrg, {
        agentId: 'test-agent',
        agentName: 'Test Agent',
        severity: SEVERITY_LEVELS.WARNING,
        message: 'Test incident',
        description: 'This is a test incident',
        details: { test: true }
      })

      expect(incident.id).toBeDefined()
      expect(incident.organizationId).toBe(testOrg)
      expect(incident.status).toBe(INCIDENT_STATUS.OPEN)
      expect(incident.severity).toBe(SEVERITY_LEVELS.WARNING)
    })

    it('should acknowledge an incident', async () => {
      const incident = await healthCheckService.createIncident(testOrg, {
        agentId: 'test-agent',
        agentName: 'Test Agent',
        severity: SEVERITY_LEVELS.CRITICAL,
        message: 'Critical incident'
      })

      const acknowledged = await healthCheckService.acknowledgeIncident(incident.id, 'user-123')

      expect(acknowledged.status).toBe(INCIDENT_STATUS.ACKNOWLEDGED)
      expect(acknowledged.acknowledgedBy).toBe('user-123')
      expect(acknowledged.acknowledgedAt).toBeDefined()
    })

    it('should resolve an incident', async () => {
      const incident = await healthCheckService.createIncident(testOrg, {
        agentId: 'test-agent',
        agentName: 'Test Agent',
        severity: SEVERITY_LEVELS.WARNING,
        message: 'Warning incident'
      })

      const resolved = await healthCheckService.resolveIncident(
        incident.id,
        'user-123',
        'Issue was fixed by restarting the service'
      )

      expect(resolved.status).toBe(INCIDENT_STATUS.RESOLVED)
      expect(resolved.resolvedBy).toBe('user-123')
      expect(resolved.resolvedAt).toBeDefined()
      expect(resolved.resolutionNotes).toBe('Issue was fixed by restarting the service')
    })

    it('should add notes to an incident', async () => {
      const incident = await healthCheckService.createIncident(testOrg, {
        agentId: 'test-agent',
        agentName: 'Test Agent',
        severity: SEVERITY_LEVELS.INFO,
        message: 'Info incident'
      })

      const updated = await healthCheckService.addIncidentNote(
        incident.id,
        'user-123',
        'Investigating the issue'
      )

      expect(updated.notes).toHaveLength(1)
      expect(updated.notes[0].userId).toBe('user-123')
      expect(updated.notes[0].text).toBe('Investigating the issue')
      expect(updated.notes[0].createdAt).toBeDefined()
    })

    it('should retrieve incident history with filters', async () => {
      // Create multiple incidents
      await healthCheckService.createIncident(testOrg, {
        agentId: 'agent-1',
        severity: SEVERITY_LEVELS.CRITICAL,
        message: 'Critical incident'
      })

      await healthCheckService.createIncident(testOrg, {
        agentId: 'agent-2',
        severity: SEVERITY_LEVELS.WARNING,
        message: 'Warning incident'
      })

      // Filter by severity
      const criticalIncidents = await healthCheckService.getIncidentHistory(testOrg, {
        severity: SEVERITY_LEVELS.CRITICAL
      })

      expect(criticalIncidents).toHaveLength(1)
      expect(criticalIncidents[0].severity).toBe(SEVERITY_LEVELS.CRITICAL)

      // Filter by agent
      const agent1Incidents = await healthCheckService.getIncidentHistory(testOrg, {
        agentId: 'agent-1'
      })

      expect(agent1Incidents).toHaveLength(1)
      expect(agent1Incidents[0].agentId).toBe('agent-1')
    })
  })

  describe('Alerting', () => {
    it('should trigger an alert and create incident', async () => {
      const healthCheck = await healthCheckService.addHealthCheck(testOrg, {
        agentId: 'test-agent',
        agentName: 'Test Agent',
        alertChannels: [ALERT_CHANNELS.EMAIL]
      })

      const result = await healthCheckService.triggerAlert(healthCheck.id, {
        severity: SEVERITY_LEVELS.CRITICAL,
        message: 'Service is down',
        details: { errorCode: 500 }
      })

      expect(result.alert).toBeDefined()
      expect(result.alert.severity).toBe(SEVERITY_LEVELS.CRITICAL)
      expect(result.incident).toBeDefined()
      expect(result.incident.status).toBe(INCIDENT_STATUS.OPEN)
    })
  })

  describe('SLA Metrics', () => {
    it('should calculate SLA metrics for organization', async () => {
      // Add health checks
      await healthCheckService.addDefaultHealthCheckAgents(testOrg)

      // Create some incidents
      const incident1 = await healthCheckService.createIncident(testOrg, {
        agentId: 'external-api-monitor',
        severity: SEVERITY_LEVELS.CRITICAL,
        message: 'API down'
      })

      // Resolve an incident
      await healthCheckService.resolveIncident(incident1.id, 'user-123', 'Fixed')

      // Get SLA metrics
      const slaMetrics = await healthCheckService.getSLAMetrics(testOrg, '30d')

      expect(slaMetrics.organizationId).toBe(testOrg)
      expect(slaMetrics.agents).toBeDefined()
      expect(slaMetrics.agents.length).toBeGreaterThan(0)
      expect(slaMetrics.overall).toBeDefined()
      expect(slaMetrics.overall.avgUptime).toBeDefined()
      expect(slaMetrics.overall.totalIncidents).toBeGreaterThan(0)
    })

    it('should calculate uptime percentage correctly', async () => {
      await healthCheckService.addDefaultHealthCheckAgents(testOrg)

      const slaMetrics = await healthCheckService.getSLAMetrics(testOrg, '7d')

      expect(slaMetrics.agents).toBeDefined()
      slaMetrics.agents.forEach(agent => {
        expect(parseFloat(agent.uptime)).toBeGreaterThanOrEqual(0)
        expect(parseFloat(agent.uptime)).toBeLessThanOrEqual(100)
      })
    })

    it('should calculate MTTR (Mean Time To Resolution)', async () => {
      await healthCheckService.addDefaultHealthCheckAgents(testOrg)

      // Create and resolve an incident
      const incident = await healthCheckService.createIncident(testOrg, {
        agentId: 'external-api-monitor',
        severity: SEVERITY_LEVELS.CRITICAL,
        message: 'Test incident'
      })

      // Wait a bit before resolving
      await new Promise(resolve => setTimeout(resolve, 100))

      await healthCheckService.resolveIncident(incident.id, 'user-123', 'Fixed')

      const slaMetrics = await healthCheckService.getSLAMetrics(testOrg, '7d')

      const apiMonitorMetrics = slaMetrics.agents.find(a => a.agentId === 'external-api-monitor')
      expect(apiMonitorMetrics.mttr).toBeGreaterThan(0)
    })
  })

  describe('Utility Functions', () => {
    it('should calculate start date correctly for different time ranges', () => {
      const now = new Date('2025-11-13T12:00:00Z')

      const oneHourAgo = healthCheckService.calculateStartDate(now, '1h')
      expect(oneHourAgo.getTime()).toBe(now.getTime() - 60 * 60 * 1000)

      const oneDayAgo = healthCheckService.calculateStartDate(now, '1d')
      expect(oneDayAgo.getTime()).toBe(now.getTime() - 24 * 60 * 60 * 1000)

      const sevenDaysAgo = healthCheckService.calculateStartDate(now, '7d')
      expect(sevenDaysAgo.getTime()).toBe(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    })

    it('should calculate downtime correctly', () => {
      const incidents = [
        {
          severity: SEVERITY_LEVELS.CRITICAL,
          createdAt: '2025-11-13T10:00:00Z',
          resolvedAt: '2025-11-13T10:05:00Z'
        },
        {
          severity: SEVERITY_LEVELS.WARNING,
          createdAt: '2025-11-13T11:00:00Z',
          resolvedAt: '2025-11-13T11:02:00Z'
        },
        {
          severity: SEVERITY_LEVELS.CRITICAL,
          createdAt: '2025-11-13T12:00:00Z',
          resolvedAt: '2025-11-13T12:10:00Z'
        }
      ]

      const downtimeMs = healthCheckService.calculateDowntimeMs(incidents)

      // Only critical incidents count as downtime: 5 min + 10 min = 15 min
      const expectedDowntimeMs = (5 + 10) * 60 * 1000
      expect(downtimeMs).toBe(expectedDowntimeMs)
    })

    it('should calculate MTTR correctly', () => {
      const resolvedIncidents = [
        {
          createdAt: '2025-11-13T10:00:00Z',
          resolvedAt: '2025-11-13T10:05:00Z' // 5 minutes
        },
        {
          createdAt: '2025-11-13T11:00:00Z',
          resolvedAt: '2025-11-13T11:15:00Z' // 15 minutes
        }
      ]

      const mttr = healthCheckService.calculateMTTR(resolvedIncidents)

      // Average: (5 + 15) / 2 = 10 minutes
      expect(mttr).toBe(10)
    })
  })

  describe('Error Handling', () => {
    it('should throw error when adding health check without organization ID', async () => {
      await expect(
        healthCheckService.addHealthCheck(null, {
          agentId: 'test-agent'
        })
      ).rejects.toThrow('Organization ID and agent ID are required')
    })

    it('should throw error when acknowledging non-existent incident', async () => {
      await expect(
        healthCheckService.acknowledgeIncident('non-existent-id', 'user-123')
      ).rejects.toThrow('Incident not found')
    })

    it('should throw error when resolving already resolved incident', async () => {
      const incident = await healthCheckService.createIncident(testOrg, {
        agentId: 'test-agent',
        severity: SEVERITY_LEVELS.INFO,
        message: 'Test'
      })

      await healthCheckService.resolveIncident(incident.id, 'user-123', 'Fixed')

      await expect(
        healthCheckService.resolveIncident(incident.id, 'user-123', 'Fixed again')
      ).rejects.toThrow('already resolved')
    })
  })
})
