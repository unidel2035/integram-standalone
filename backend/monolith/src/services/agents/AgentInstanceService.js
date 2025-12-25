/**
 * Agent Instance Service
 *
 * Manages agent instances within organizations.
 * Handles creation, configuration, lifecycle, code customization, and table deployment.
 *
 * Issue #3112 - Phase 0: Infrastructure preparation
 *
 * Features:
 * - Create/delete agent instances
 * - Deploy agent tables to organization's Integram DB
 * - Manage custom code (override templates)
 * - Instance lifecycle (start/stop/pause)
 * - Configuration management
 * - Error tracking
 *
 * Instance Lifecycle:
 * 1. Create instance record → agent_instances table
 * 2. Deploy tables to Integram → agent_{agent_id}_*
 * 3. Copy code template → custom_code (optional)
 * 4. Initialize data (if seeds exist)
 * 5. Activate/start instance
 */

import { v4 as uuidv4 } from 'uuid'
import AgentRegistryService from './AgentRegistryService.js'
import IntegramDatabaseService from '../integram/IntegramDatabaseService.js'
import AgentCodeStorageService from './AgentCodeStorageService.js'
import AgentSandboxService from './AgentSandboxService.js'

// Valid instance statuses
export const INSTANCE_STATUS = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  ERROR: 'error',
  PAUSED: 'paused'
}

/**
 * Agent Instance Service
 */
class AgentInstanceService {
  constructor({ logger } = {}) {
    this.logger = logger || console
    this.initialized = false
    this.agentRegistry = new AgentRegistryService({ logger })
    this.integramService = new IntegramDatabaseService({ logger })
    this.codeStorageService = new AgentCodeStorageService({ logger })
    this.sandboxService = new AgentSandboxService({ logger })
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.initialized) return

    try {
      await this.agentRegistry.initialize()
      await this.integramService.initialize()
      await this.codeStorageService.initialize()

      this.initialized = true
      this.logger.info('[AgentInstanceService] Initialized successfully')
    } catch (error) {
      this.logger.error('[AgentInstanceService] Initialization failed:', error)
      throw new Error(`Failed to initialize AgentInstanceService: ${error.message}`)
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
   * Create a new agent instance
   */
  async createInstance({ organizationId, agentId, instanceName, config = {}, createdBy, autoStart = false }) {
    await this.ensureInitialized()

    // Validate organization exists
    const dbExists = await this.integramService.databaseExists(organizationId)
    if (!dbExists) {
      throw new Error(`Organization database not found: ${organizationId}`)
    }

    // Validate agent exists
    const agentExists = await this.agentRegistry.agentExists(agentId)
    if (!agentExists) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    // Get agent definition
    const agentDef = await this.agentRegistry.getAgent(agentId)

    // Check dependencies
    if (agentDef.dependencies && agentDef.dependencies.length > 0) {
      await this.validateDependencies(organizationId, agentDef.dependencies)
    }

    // Generate instance ID
    const instanceId = uuidv4()
    const now = new Date().toISOString()

    // Generate instance name if not provided
    const finalInstanceName = instanceName || `${agentDef.name} #${Date.now().toString().slice(-4)}`

    // Create instance record
    const instanceData = {
      id: instanceId,
      organization_id: organizationId,
      agent_id: agentId,
      instance_name: finalInstanceName,
      status: autoStart ? INSTANCE_STATUS.ACTIVE : INSTANCE_STATUS.INACTIVE,
      config: config,
      custom_code: null, // No custom code initially
      last_run_at: null,
      last_error: null,
      created_at: now,
      created_by: createdBy
    }

    // Save instance to agent_instances table
    await this.integramService.insert(organizationId, 'agent_instances', instanceData)

    this.logger.info(`[AgentInstanceService] Created instance ${instanceId} for agent ${agentId}`)

    // Deploy agent tables
    try {
      await this.deployAgentTables(organizationId, agentId, instanceId, agentDef.tableSchemas)
      this.logger.info(`[AgentInstanceService] Deployed tables for instance ${instanceId}`)
    } catch (error) {
      this.logger.error(`[AgentInstanceService] Failed to deploy tables:`, error)
      // Mark instance as error
      await this.integramService.update(organizationId, 'agent_instances', instanceId, {
        status: INSTANCE_STATUS.ERROR,
        last_error: `Table deployment failed: ${error.message}`
      })
      throw new Error(`Failed to deploy agent tables: ${error.message}`)
    }

    // TODO Phase 1: Initialize agent data if seeds exist
    // TODO Phase 1: Start agent if autoStart is true

    return {
      ...instanceData,
      agentName: agentDef.name,
      agentIcon: agentDef.icon,
      tablesDeployed: agentDef.tableSchemas.length
    }
  }

  /**
   * Deploy agent tables to organization's database
   */
  async deployAgentTables(organizationId, agentId, instanceId, tableSchemas) {
    const deployedTables = []

    for (const tableSchema of tableSchemas) {
      // Table name: agent_{agentId}_{tableName}_{instanceId}
      // This allows multiple instances of same agent to have separate tables
      const tableName = `agent_${agentId}_${tableSchema.name}_${instanceId}`

      try {
        await this.integramService.createTable(organizationId, tableName, tableSchema.schema || {})
        deployedTables.push(tableName)
      } catch (error) {
        this.logger.error(`[AgentInstanceService] Failed to create table ${tableName}:`, error)
        // Rollback: delete already created tables
        for (const deployedTable of deployedTables) {
          try {
            // Note: We don't have a deleteTable method yet, but we should implement it
            this.logger.warn(`[AgentInstanceService] Should rollback table: ${deployedTable}`)
          } catch (rollbackError) {
            this.logger.error(`[AgentInstanceService] Rollback failed:`, rollbackError)
          }
        }
        throw error
      }
    }

    return deployedTables
  }

  /**
   * Get agent instance by ID
   */
  async getInstance(organizationId, instanceId) {
    await this.ensureInitialized()

    const instance = await this.integramService.findById(organizationId, 'agent_instances', instanceId)

    if (!instance) {
      throw new Error(`Agent instance not found: ${instanceId}`)
    }

    // Enrich with agent definition
    try {
      const agentDef = await this.agentRegistry.getAgent(instance.agent_id)
      instance.agentName = agentDef.name
      instance.agentIcon = agentDef.icon
      instance.agentCategory = agentDef.category
    } catch (error) {
      this.logger.warn(`[AgentInstanceService] Could not load agent def for ${instance.agent_id}`)
    }

    return instance
  }

  /**
   * List all instances for an organization
   */
  async listInstances(organizationId, filters = {}) {
    await this.ensureInitialized()

    const allInstances = await this.integramService.find(organizationId, 'agent_instances', {})

    let instances = allInstances

    // Filter by agent ID
    if (filters.agentId) {
      instances = instances.filter(inst => inst.agent_id === filters.agentId)
    }

    // Filter by status
    if (filters.status) {
      instances = instances.filter(inst => inst.status === filters.status)
    }

    // Enrich with agent definitions
    const enriched = await Promise.all(
      instances.map(async (instance) => {
        try {
          const agentDef = await this.agentRegistry.getAgent(instance.agent_id)
          return {
            ...instance,
            agentName: agentDef.name,
            agentIcon: agentDef.icon,
            agentCategory: agentDef.category
          }
        } catch (error) {
          return instance
        }
      })
    )

    return enriched
  }

  /**
   * Update instance configuration
   */
  async updateInstanceConfig(organizationId, instanceId, config) {
    await this.ensureInitialized()

    const instance = await this.getInstance(organizationId, instanceId)

    // Merge config
    const updatedConfig = {
      ...instance.config,
      ...config
    }

    await this.integramService.update(organizationId, 'agent_instances', instanceId, {
      config: updatedConfig
    })

    this.logger.info(`[AgentInstanceService] Updated config for instance ${instanceId}`)

    return await this.getInstance(organizationId, instanceId)
  }

  /**
   * Get instance custom code
   */
  async getInstanceCode(organizationId, instanceId) {
    await this.ensureInitialized()

    const instance = await this.getInstance(organizationId, instanceId)

    // If custom code exists, return it
    if (instance.custom_code) {
      return {
        instanceId,
        customCode: instance.custom_code,
        isCustomized: true
      }
    }

    // Otherwise, return template from agent definition
    const agentDef = await this.agentRegistry.getAgent(instance.agent_id)

    return {
      instanceId,
      customCode: agentDef.codeTemplate,
      isCustomized: false
    }
  }

  /**
   * Update instance custom code
   * Creates a new version in version history
   */
  async updateInstanceCode(organizationId, instanceId, code, options = {}) {
    await this.ensureInitialized()

    const { authorId, commitMessage = 'Code updated' } = options

    // Get instance to retrieve current config
    const instance = await this.getInstance(organizationId, instanceId)

    // Create new version in version history
    const version = await this.codeStorageService.createVersion({
      organizationId,
      instanceId,
      code,
      config: instance.config,
      authorId,
      commitMessage
    })

    // Update instance with new custom code
    await this.integramService.update(organizationId, 'agent_instances', instanceId, {
      custom_code: code,
      current_version: version.version
    })

    this.logger.info(`[AgentInstanceService] Updated custom code for instance ${instanceId} (version ${version.version})`)

    return {
      instanceId,
      customCode: code,
      isCustomized: true,
      version: version.version,
      commitMessage: version.commit_message,
      updatedAt: new Date().toISOString()
    }
  }

  /**
   * Reset instance code to template
   */
  async resetInstanceCode(organizationId, instanceId) {
    await this.ensureInitialized()

    await this.integramService.update(organizationId, 'agent_instances', instanceId, {
      custom_code: null
    })

    this.logger.info(`[AgentInstanceService] Reset code to template for instance ${instanceId}`)

    return await this.getInstanceCode(organizationId, instanceId)
  }

  /**
   * Start an instance
   */
  async startInstance(organizationId, instanceId) {
    await this.ensureInitialized()

    const instance = await this.getInstance(organizationId, instanceId)

    if (instance.status === INSTANCE_STATUS.ACTIVE) {
      return { message: 'Instance is already active' }
    }

    await this.integramService.update(organizationId, 'agent_instances', instanceId, {
      status: INSTANCE_STATUS.ACTIVE,
      last_error: null
    })

    this.logger.info(`[AgentInstanceService] Started instance ${instanceId}`)

    // TODO Phase 1: Actually start the agent execution

    return {
      instanceId,
      status: INSTANCE_STATUS.ACTIVE,
      message: 'Instance started successfully'
    }
  }

  /**
   * Stop an instance
   */
  async stopInstance(organizationId, instanceId) {
    await this.ensureInitialized()

    const instance = await this.getInstance(organizationId, instanceId)

    if (instance.status === INSTANCE_STATUS.INACTIVE) {
      return { message: 'Instance is already inactive' }
    }

    await this.integramService.update(organizationId, 'agent_instances', instanceId, {
      status: INSTANCE_STATUS.INACTIVE
    })

    this.logger.info(`[AgentInstanceService] Stopped instance ${instanceId}`)

    // TODO Phase 1: Actually stop the agent execution

    return {
      instanceId,
      status: INSTANCE_STATUS.INACTIVE,
      message: 'Instance stopped successfully'
    }
  }

  /**
   * Pause an instance
   */
  async pauseInstance(organizationId, instanceId) {
    await this.ensureInitialized()

    await this.integramService.update(organizationId, 'agent_instances', instanceId, {
      status: INSTANCE_STATUS.PAUSED
    })

    this.logger.info(`[AgentInstanceService] Paused instance ${instanceId}`)

    return {
      instanceId,
      status: INSTANCE_STATUS.PAUSED,
      message: 'Instance paused successfully'
    }
  }

  /**
   * Delete an instance
   */
  async deleteInstance(organizationId, instanceId) {
    await this.ensureInitialized()

    const instance = await this.getInstance(organizationId, instanceId)

    // TODO: Delete associated tables
    // TODO: Clean up any running processes

    await this.integramService.delete(organizationId, 'agent_instances', instanceId)

    this.logger.info(`[AgentInstanceService] Deleted instance ${instanceId}`)

    return {
      deleted: true,
      instanceId
    }
  }

  /**
   * Validate agent dependencies
   */
  async validateDependencies(organizationId, dependencies) {
    const instances = await this.listInstances(organizationId)

    const installedAgentIds = new Set(instances.map(inst => inst.agent_id))

    const missingDeps = dependencies.filter(depId => !installedAgentIds.has(depId))

    if (missingDeps.length > 0) {
      throw new Error(`Missing required agent dependencies: ${missingDeps.join(', ')}`)
    }

    return true
  }

  /**
   * Get instance statistics
   */
  async getInstanceStats(organizationId, instanceId) {
    await this.ensureInitialized()

    const instance = await this.getInstance(organizationId, instanceId)

    // Get version stats
    const versionStats = await this.codeStorageService.getVersionStats(organizationId, instanceId)

    return {
      instanceId,
      status: instance.status,
      created: instance.created_at,
      lastRun: instance.last_run_at,
      hasCustomCode: !!instance.custom_code,
      hasError: !!instance.last_error,
      versions: versionStats
    }
  }

  /**
   * Get version history for an instance
   */
  async getVersionHistory(organizationId, instanceId, options = {}) {
    await this.ensureInitialized()

    return await this.codeStorageService.getVersionHistory(organizationId, instanceId, options)
  }

  /**
   * Get a specific version
   */
  async getVersion(organizationId, instanceId, versionNumber) {
    await this.ensureInitialized()

    return await this.codeStorageService.getVersion(organizationId, instanceId, versionNumber)
  }

  /**
   * Get diff between two versions
   */
  async getVersionDiff(organizationId, instanceId, fromVersion, toVersion) {
    await this.ensureInitialized()

    return await this.codeStorageService.getDiff(organizationId, instanceId, fromVersion, toVersion)
  }

  /**
   * Rollback to a specific version
   */
  async rollbackToVersion(organizationId, instanceId, versionNumber, options = {}) {
    await this.ensureInitialized()

    const { authorId, commitMessage } = options

    // Get the version to rollback to
    const version = await this.codeStorageService.getVersion(organizationId, instanceId, versionNumber)

    // Create a new version with the old code (this is a rollback, not deletion)
    const rollbackCommitMessage = commitMessage || `Rollback to version ${versionNumber}`

    const newVersion = await this.updateInstanceCode(
      organizationId,
      instanceId,
      version.code,
      {
        authorId,
        commitMessage: rollbackCommitMessage
      }
    )

    this.logger.info(`[AgentInstanceService] Rolled back instance ${instanceId} to version ${versionNumber}`)

    return {
      rolledBackTo: versionNumber,
      newVersion: newVersion.version,
      commitMessage: rollbackCommitMessage
    }
  }

  /**
   * Deploy a specific version
   */
  async deployVersion(organizationId, instanceId, versionNumber) {
    await this.ensureInitialized()

    // Get the version
    const version = await this.codeStorageService.getVersion(organizationId, instanceId, versionNumber)

    // Update instance with this version's code
    await this.integramService.update(organizationId, 'agent_instances', instanceId, {
      custom_code: version.code,
      current_version: versionNumber
    })

    this.logger.info(`[AgentInstanceService] Deployed version ${versionNumber} for instance ${instanceId}`)

    return {
      instanceId,
      deployedVersion: versionNumber,
      code: version.code,
      commitMessage: version.commit_message
    }
  }

  /**
   * Test instance code in sandbox
   */
  async testInstanceCode(organizationId, instanceId, options = {}) {
    await this.ensureInitialized()

    const { testData = {}, testCases = [], timeout } = options

    // Get current instance code
    const codeData = await this.getInstanceCode(organizationId, instanceId)

    // Validate code first
    const validation = this.sandboxService.validateCode(codeData.customCode)
    if (!validation.valid) {
      return {
        success: false,
        error: 'Code validation failed',
        validationErrors: validation.errors
      }
    }

    // Run tests if test cases provided
    if (testCases.length > 0) {
      const testResults = await this.sandboxService.testCode(codeData.customCode, testCases)
      return {
        success: true,
        type: 'test',
        ...testResults
      }
    }

    // Otherwise execute code with provided test data
    const result = await this.sandboxService.executeCode(codeData.customCode, {
      mockData: testData,
      timeout
    })

    return {
      success: result.success,
      type: 'execution',
      ...result
    }
  }
}

export default AgentInstanceService
