/**
 * EnsembleDeploymentService
 *
 * Service for deploying agent ensembles to organizations.
 * Handles one-click deployment of pre-configured agent sets (ready-made solutions).
 *
 * Features:
 * - Deploy multiple agents as a single ensemble
 * - Configure agent interactions and dependencies
 * - Validate organization readiness
 * - Track deployment status
 * - Handle rollback on failures
 *
 * @module services/EnsembleDeploymentService
 */

const fs = require('fs').promises
const path = require('path')
const EventEmitter = require('events')

class EnsembleDeploymentService extends EventEmitter {
  constructor(options = {}) {
    super()

    this.dataDir = options.dataDir || path.join(__dirname, '../../data/ensembles')
    this.agentManager = options.agentManager // AgentManager instance
    this.logger = options.logger || console

    // Deployment state tracking
    this.activeDeployments = new Map()

    // Ensure data directory exists
    this.initializeDataDir()
  }

  async initializeDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true })
      this.logger.info('EnsembleDeploymentService: Data directory initialized')
    } catch (error) {
      this.logger.error('EnsembleDeploymentService: Failed to initialize data directory', error)
    }
  }

  /**
   * Get all available ensemble templates
   * @returns {Promise<Array>} List of ensemble templates
   */
  async getAvailableEnsembles() {
    return [
      {
        id: 'business-automation-suite',
        name: 'Полная автоматизация бизнеса',
        description: 'Комплексное решение для автоматизации ключевых бизнес-процессов',
        category: 'business',
        agentIds: [
          'api-integration-agent',
          'health-monitor-dashboard',
          'customer-support',
          'social-analytics'
        ],
        requiredIntegrations: ['database', 'email', 'telegram'],
        configuration: {
          autoStart: true,
          monitoringEnabled: true,
          alertsEnabled: true
        }
      },
      {
        id: 'marketing-sales-suite',
        name: 'Маркетинг и продажи',
        description: 'Набор агентов для автоматизации маркетинга и продаж',
        category: 'marketing',
        agentIds: [
          'social-analytics',
          'api-integration-agent',
          'appointment-booking'
        ],
        requiredIntegrations: ['google-calendar', 'zoom', 'crm-api'],
        configuration: {
          autoStart: true,
          monitoringEnabled: true
        }
      },
      {
        id: 'hr-recruitment-suite',
        name: 'HR и рекрутинг',
        description: 'Решение для автоматизации HR-процессов',
        category: 'hr',
        agentIds: [
          'api-integration-agent',
          'customer-support',
          'appointment-booking'
        ],
        requiredIntegrations: ['email', 'calendar', 'hr-system-api'],
        configuration: {
          autoStart: true
        }
      },
      {
        id: 'customer-support-suite',
        name: 'Комплексная поддержка клиентов',
        description: 'Все инструменты для превосходной поддержки клиентов',
        category: 'support',
        agentIds: [
          'customer-support',
          'health-monitor-dashboard',
          'social-analytics'
        ],
        requiredIntegrations: ['telegram', 'email', 'slack'],
        configuration: {
          autoStart: true,
          monitoringEnabled: true,
          alertsEnabled: true
        }
      },
      {
        id: 'analytics-monitoring-suite',
        name: 'Аналитика и мониторинг',
        description: 'Централизованная система для мониторинга всех аспектов бизнеса',
        category: 'analytics',
        agentIds: [
          'health-monitor-dashboard',
          'social-analytics',
          'api-integration-agent'
        ],
        requiredIntegrations: ['database', 'analytics-api', 'monitoring-tools'],
        configuration: {
          autoStart: true,
          monitoringEnabled: true,
          alertsEnabled: true,
          retentionDays: 90
        }
      }
    ]
  }

  /**
   * Get ensemble template by ID
   * @param {string} ensembleId - Ensemble template ID
   * @returns {Promise<Object|null>} Ensemble template or null
   */
  async getEnsembleById(ensembleId) {
    const ensembles = await this.getAvailableEnsembles()
    return ensembles.find(e => e.id === ensembleId) || null
  }

  /**
   * Deploy an ensemble to an organization
   * @param {string} organizationId - Organization ID
   * @param {string} ensembleId - Ensemble template ID
   * @param {Object} options - Deployment options
   * @returns {Promise<Object>} Deployment result
   */
  async deployEnsemble(organizationId, ensembleId, options = {}) {
    const deploymentId = `${organizationId}-${ensembleId}-${Date.now()}`

    try {
      this.logger.info(`Starting ensemble deployment: ${deploymentId}`)

      // Get ensemble template
      const ensemble = await this.getEnsembleById(ensembleId)
      if (!ensemble) {
        throw new Error(`Ensemble not found: ${ensembleId}`)
      }

      // Initialize deployment tracking
      const deployment = {
        id: deploymentId,
        organizationId,
        ensembleId,
        ensemble,
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        steps: [],
        deployedAgents: [],
        errors: []
      }

      this.activeDeployments.set(deploymentId, deployment)
      this.emit('deployment:started', deployment)

      // Step 1: Validate organization
      this.addStep(deployment, 'validate', 'Validating organization')
      await this.validateOrganization(organizationId)
      this.completeStep(deployment, 'validate', 'Organization validated')

      // Step 2: Deploy agents
      this.addStep(deployment, 'deploy_agents', 'Deploying agents')
      for (const agentId of ensemble.agentIds) {
        try {
          await this.deployAgent(organizationId, agentId, ensemble.configuration)
          deployment.deployedAgents.push(agentId)
          this.logger.info(`Deployed agent: ${agentId}`)
        } catch (error) {
          this.logger.error(`Failed to deploy agent ${agentId}:`, error)
          deployment.errors.push({
            agentId,
            error: error.message
          })
          // Continue with other agents instead of failing completely
        }
      }
      this.completeStep(deployment, 'deploy_agents', `Deployed ${deployment.deployedAgents.length} agents`)

      // Step 3: Configure ensemble
      this.addStep(deployment, 'configure', 'Configuring ensemble')
      await this.configureEnsemble(organizationId, ensemble, deployment.deployedAgents)
      this.completeStep(deployment, 'configure', 'Ensemble configured')

      // Step 4: Save deployment record
      this.addStep(deployment, 'save', 'Saving deployment record')
      await this.saveDeploymentRecord(deployment)
      this.completeStep(deployment, 'save', 'Deployment record saved')

      // Mark as completed
      deployment.status = deployment.errors.length > 0 ? 'completed_with_errors' : 'completed'
      deployment.completedAt = new Date().toISOString()

      this.emit('deployment:completed', deployment)
      this.logger.info(`Ensemble deployment completed: ${deploymentId}`)

      return {
        success: true,
        deployment: {
          id: deploymentId,
          status: deployment.status,
          deployedAgents: deployment.deployedAgents,
          errors: deployment.errors,
          startedAt: deployment.startedAt,
          completedAt: deployment.completedAt
        }
      }

    } catch (error) {
      this.logger.error(`Ensemble deployment failed: ${deploymentId}`, error)

      const deployment = this.activeDeployments.get(deploymentId)
      if (deployment) {
        deployment.status = 'failed'
        deployment.error = error.message
        deployment.completedAt = new Date().toISOString()

        // Attempt rollback
        try {
          await this.rollbackDeployment(deployment)
        } catch (rollbackError) {
          this.logger.error('Rollback failed:', rollbackError)
        }
      }

      this.emit('deployment:failed', { deploymentId, error: error.message })

      throw new Error(`Deployment failed: ${error.message}`)
    } finally {
      // Clean up active deployment tracking after some time
      setTimeout(() => {
        this.activeDeployments.delete(deploymentId)
      }, 300000) // 5 minutes
    }
  }

  /**
   * Validate organization readiness for deployment
   * @param {string} organizationId - Organization ID
   */
  async validateOrganization(organizationId) {
    // In production, this would check:
    // - Organization exists
    // - User has permissions
    // - Organization has required resources
    // - No conflicting deployments

    if (!organizationId) {
      throw new Error('Invalid organization ID')
    }

    // Simulate validation
    await this.sleep(500)
    return true
  }

  /**
   * Deploy a single agent
   * @param {string} organizationId - Organization ID
   * @param {string} agentId - Agent ID
   * @param {Object} configuration - Agent configuration
   */
  async deployAgent(organizationId, agentId, configuration = {}) {
    // In production, this would:
    // - Create agent instance
    // - Configure agent
    // - Start agent if autoStart is true
    // - Register agent with organization

    // Simulate deployment time
    await this.sleep(1000 + Math.random() * 1000)

    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error(`Failed to deploy agent: ${agentId}`)
    }

    return {
      agentId,
      instanceId: `${agentId}-${organizationId}-${Date.now()}`,
      status: configuration.autoStart ? 'running' : 'stopped'
    }
  }

  /**
   * Configure ensemble (setup agent interactions)
   * @param {string} organizationId - Organization ID
   * @param {Object} ensemble - Ensemble template
   * @param {Array} deployedAgents - List of successfully deployed agent IDs
   */
  async configureEnsemble(organizationId, ensemble, deployedAgents) {
    // In production, this would:
    // - Configure agent interactions
    // - Set up data flows between agents
    // - Configure shared resources
    // - Set up monitoring and alerts

    await this.sleep(1500)

    return {
      organizationId,
      ensembleId: ensemble.id,
      agentsConfigured: deployedAgents.length,
      configuration: ensemble.configuration
    }
  }

  /**
   * Save deployment record to persistent storage
   * @param {Object} deployment - Deployment object
   */
  async saveDeploymentRecord(deployment) {
    const filePath = path.join(this.dataDir, `${deployment.id}.json`)

    const record = {
      id: deployment.id,
      organizationId: deployment.organizationId,
      ensembleId: deployment.ensembleId,
      ensembleName: deployment.ensemble.name,
      status: deployment.status,
      deployedAgents: deployment.deployedAgents,
      errors: deployment.errors,
      startedAt: deployment.startedAt,
      completedAt: deployment.completedAt,
      steps: deployment.steps
    }

    await fs.writeFile(filePath, JSON.stringify(record, null, 2))
    return record
  }

  /**
   * Get deployment history for an organization
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Array>} Deployment history
   */
  async getDeploymentHistory(organizationId) {
    try {
      const files = await fs.readdir(this.dataDir)
      const deployments = []

      for (const file of files) {
        if (file.endsWith('.json') && file.startsWith(organizationId)) {
          const content = await fs.readFile(path.join(this.dataDir, file), 'utf-8')
          deployments.push(JSON.parse(content))
        }
      }

      return deployments.sort((a, b) =>
        new Date(b.startedAt) - new Date(a.startedAt)
      )
    } catch (error) {
      this.logger.error('Failed to get deployment history:', error)
      return []
    }
  }

  /**
   * Get deployed ensembles for an organization
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Array>} Deployed ensembles
   */
  async getDeployedEnsembles(organizationId) {
    const history = await this.getDeploymentHistory(organizationId)

    // Get only successful deployments
    return history.filter(d =>
      d.status === 'completed' || d.status === 'completed_with_errors'
    )
  }

  /**
   * Rollback a failed deployment
   * @param {Object} deployment - Deployment object
   */
  async rollbackDeployment(deployment) {
    this.logger.warn(`Rolling back deployment: ${deployment.id}`)

    // Remove deployed agents
    for (const agentId of deployment.deployedAgents) {
      try {
        // In production, this would actually remove the agent
        this.logger.info(`Removing agent: ${agentId}`)
        await this.sleep(500)
      } catch (error) {
        this.logger.error(`Failed to remove agent ${agentId}:`, error)
      }
    }

    this.logger.info(`Rollback completed for: ${deployment.id}`)
  }

  /**
   * Get active deployment status
   * @param {string} deploymentId - Deployment ID
   * @returns {Object|null} Deployment status or null
   */
  getDeploymentStatus(deploymentId) {
    return this.activeDeployments.get(deploymentId) || null
  }

  // Helper methods

  addStep(deployment, stepId, description) {
    deployment.steps.push({
      id: stepId,
      description,
      status: 'in_progress',
      startedAt: new Date().toISOString()
    })
  }

  completeStep(deployment, stepId, message) {
    const step = deployment.steps.find(s => s.id === stepId)
    if (step) {
      step.status = 'completed'
      step.message = message
      step.completedAt = new Date().toISOString()
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

module.exports = EnsembleDeploymentService
