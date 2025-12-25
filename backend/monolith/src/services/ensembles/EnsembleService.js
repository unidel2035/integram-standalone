/**
 * Ensemble Service
 *
 * Manages ready-to-use solution ensembles - pre-configured sets of agents
 * that work together to solve specific business problems.
 *
 * Issue #3114 - Phase 2: Ensemble Deployment
 *
 * Features:
 * - Get available ensembles
 * - Deploy complete ensemble (multiple agents at once)
 * - Configure agent dependencies within ensemble
 * - Track deployment progress
 * - Handle rollback on failure
 *
 * Ensemble Structure:
 * {
 *   id: 'it-companies',
 *   name: 'IT Companies Solution',
 *   description: '...',
 *   icon: '💻',
 *   category: 'it',
 *   agents: [
 *     { agentId: 'support-agent', config: {...}, order: 1 },
 *     { agentId: 'requirements-collector', config: {...}, order: 2 },
 *     ...
 *   ],
 *   onboardingSteps: [...]
 * }
 */

import { v4 as uuidv4 } from 'uuid'
import AgentInstanceService from '../agents/AgentInstanceService.js'
import IntegramDatabaseService from '../integram/IntegramDatabaseService.js'

// Import ensemble definitions
import itCompaniesEnsemble from './definitions/it-companies.js'
import ecommerceEnsemble from './definitions/ecommerce.js'
import telecomEnsemble from './definitions/telecom.js'
import hrEnsemble from './definitions/hr.js'

/**
 * Deployment status constants
 */
export const DEPLOYMENT_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back'
}

/**
 * Ensemble Service
 */
class EnsembleService {
  constructor({ logger } = {}) {
    this.logger = logger || console
    this.initialized = false
    this.agentInstanceService = new AgentInstanceService({ logger })
    this.integramService = new IntegramDatabaseService({ logger })

    // Register all ensemble definitions
    this.ensembles = new Map([
      ['it-companies', itCompaniesEnsemble],
      ['ecommerce', ecommerceEnsemble],
      ['telecom', telecomEnsemble],
      ['hr', hrEnsemble]
    ])
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.initialized) return

    try {
      await this.agentInstanceService.initialize()
      await this.integramService.initialize()

      this.initialized = true
      this.logger.info('[EnsembleService] Initialized successfully')
    } catch (error) {
      this.logger.error('[EnsembleService] Initialization failed:', error)
      throw new Error(`Failed to initialize EnsembleService: ${error.message}`)
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
   * Get all available ensembles
   */
  async getAllEnsembles() {
    await this.ensureInitialized()

    return Array.from(this.ensembles.values()).map(ensemble => ({
      id: ensemble.id,
      name: ensemble.name,
      description: ensemble.description,
      icon: ensemble.icon,
      category: ensemble.category,
      agentCount: ensemble.agents.length,
      estimatedSetupTime: ensemble.estimatedSetupTime || '5-10 minutes'
    }))
  }

  /**
   * Get ensemble by ID
   */
  async getEnsemble(ensembleId) {
    await this.ensureInitialized()

    const ensemble = this.ensembles.get(ensembleId)
    if (!ensemble) {
      throw new Error(`Ensemble not found: ${ensembleId}`)
    }

    return ensemble
  }

  /**
   * Deploy complete ensemble to organization
   *
   * @param {string} organizationId - Organization UUID
   * @param {string} ensembleId - Ensemble identifier
   * @param {string} deployedBy - User who triggered deployment
   * @param {Object} options - Deployment options
   * @returns {Promise<Object>} Deployment result with instance IDs
   */
  async deployEnsemble(organizationId, ensembleId, deployedBy, options = {}) {
    await this.ensureInitialized()

    // Get ensemble definition
    const ensemble = await this.getEnsemble(ensembleId)

    // Validate organization exists
    const dbExists = await this.integramService.databaseExists(organizationId)
    if (!dbExists) {
      throw new Error(`Organization database not found: ${organizationId}`)
    }

    // Create deployment record
    const deploymentId = uuidv4()
    const deployment = {
      id: deploymentId,
      ensemble_id: ensembleId,
      status: DEPLOYMENT_STATUS.IN_PROGRESS,
      started_at: new Date().toISOString(),
      deployed_by: deployedBy,
      total_agents: ensemble.agents.length,
      completed_agents: 0,
      failed_agents: 0
    }

    const deployedInstances = []
    const errors = []

    try {
      this.logger.info(`[EnsembleService] Starting deployment of ${ensembleId} for org ${organizationId}`)

      // Sort agents by deployment order
      const sortedAgents = [...ensemble.agents].sort((a, b) => a.order - b.order)

      // Deploy each agent in order
      for (const agentConfig of sortedAgents) {
        try {
          this.logger.info(`[EnsembleService] Deploying agent ${agentConfig.agentId} (${agentConfig.order}/${ensemble.agents.length})`)

          // Create agent instance
          const instance = await this.agentInstanceService.createInstance({
            organizationId,
            agentId: agentConfig.agentId,
            instanceName: agentConfig.instanceName || undefined,
            config: agentConfig.config || {},
            createdBy: deployedBy,
            autoStart: agentConfig.autoStart !== false // Default to true
          })

          deployedInstances.push({
            agentId: agentConfig.agentId,
            instanceId: instance.id,
            instanceName: instance.instance_name || instance.instanceName,
            status: 'deployed'
          })

          deployment.completed_agents++

          this.logger.info(`[EnsembleService] Successfully deployed ${agentConfig.agentId}`)

        } catch (error) {
          this.logger.error(`[EnsembleService] Failed to deploy ${agentConfig.agentId}:`, error)

          deployment.failed_agents++
          errors.push({
            agentId: agentConfig.agentId,
            error: error.message
          })

          // Decide whether to continue or rollback
          if (options.stopOnError) {
            throw new Error(`Deployment failed at agent ${agentConfig.agentId}: ${error.message}`)
          }
        }
      }

      // Update deployment status
      deployment.status = errors.length === 0
        ? DEPLOYMENT_STATUS.COMPLETED
        : deployment.completed_agents > 0
          ? DEPLOYMENT_STATUS.COMPLETED // Partial success
          : DEPLOYMENT_STATUS.FAILED

      deployment.completed_at = new Date().toISOString()
      deployment.duration_seconds = Math.floor(
        (new Date(deployment.completed_at) - new Date(deployment.started_at)) / 1000
      )

      this.logger.info(
        `[EnsembleService] Deployment ${deployment.status}: ` +
        `${deployment.completed_agents}/${ensemble.agents.length} agents deployed`
      )

      return {
        success: errors.length === 0,
        deploymentId,
        ensembleId,
        ensembleName: ensemble.name,
        status: deployment.status,
        totalAgents: ensemble.agents.length,
        deployedAgents: deployment.completed_agents,
        failedAgents: deployment.failed_agents,
        instances: deployedInstances,
        errors: errors.length > 0 ? errors : undefined,
        onboardingSteps: ensemble.onboardingSteps || [],
        startedAt: deployment.started_at,
        completedAt: deployment.completed_at,
        durationSeconds: deployment.duration_seconds
      }

    } catch (error) {
      this.logger.error('[EnsembleService] Deployment failed:', error)

      // Rollback deployed instances if requested
      if (options.rollbackOnError && deployedInstances.length > 0) {
        this.logger.info('[EnsembleService] Rolling back deployed instances...')
        await this.rollbackDeployment(organizationId, deployedInstances)
        deployment.status = DEPLOYMENT_STATUS.ROLLED_BACK
      } else {
        deployment.status = DEPLOYMENT_STATUS.FAILED
      }

      deployment.completed_at = new Date().toISOString()
      deployment.error = error.message

      throw new Error(`Ensemble deployment failed: ${error.message}`)
    }
  }

  /**
   * Rollback deployment by deleting deployed instances
   *
   * @param {string} organizationId - Organization UUID
   * @param {Array} deployedInstances - Array of deployed instance records
   */
  async rollbackDeployment(organizationId, deployedInstances) {
    this.logger.info(`[EnsembleService] Rolling back ${deployedInstances.length} instances`)

    for (const instance of deployedInstances) {
      try {
        await this.agentInstanceService.deleteInstance(instance.instanceId)
        this.logger.info(`[EnsembleService] Rolled back instance ${instance.instanceId}`)
      } catch (error) {
        this.logger.error(`[EnsembleService] Failed to rollback instance ${instance.instanceId}:`, error)
      }
    }
  }

  /**
   * Get ensembles by category
   */
  async getEnsemblesByCategory(category) {
    await this.ensureInitialized()

    const allEnsembles = await this.getAllEnsembles()
    return allEnsembles.filter(e => e.category === category)
  }

  /**
   * Check if an ensemble is already deployed in an organization
   */
  async isEnsembleDeployed(organizationId, ensembleId) {
    await this.ensureInitialized()

    const ensemble = await this.getEnsemble(ensembleId)

    // Check if all agents from the ensemble exist in the organization
    const instances = await this.agentInstanceService.getOrganizationInstances(organizationId)

    const ensembleAgentIds = ensemble.agents.map(a => a.agentId)
    const deployedAgentIds = instances.map(i => i.agent_id)

    // Check if all ensemble agents are present
    const allDeployed = ensembleAgentIds.every(agentId =>
      deployedAgentIds.includes(agentId)
    )

    return {
      isDeployed: allDeployed,
      deployedAgents: ensembleAgentIds.filter(id => deployedAgentIds.includes(id)),
      missingAgents: ensembleAgentIds.filter(id => !deployedAgentIds.includes(id))
    }
  }
}

export default EnsembleService
