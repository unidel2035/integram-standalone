// SelfHealingManager.js - Automatic agent recovery and resilience management
// Issue #2706 - Phase 3.1: Self-Healing Manager for multi-agent system

import EventEmitter from 'events'
import logger from '../utils/logger.js'
import metrics from '../utils/metrics.js'

/**
 * SelfHealingManager provides automatic agent failure detection and recovery
 *
 * Features:
 * - Automatic agent restart on failure with exponential backoff
 * - Fallback agent discovery for failed critical agents
 * - Graceful degradation for non-critical failures
 * - Restart history tracking and circuit breaking
 * - Integration with orchestrator and discovery service
 * - Critical failure notifications
 *
 * Events:
 * - agent:restarted - When agent successfully restarts
 * - agent:restart-failed - When agent restart fails
 * - agent:critical-failure - When agent fails permanently
 * - graceful-degradation:enabled - When graceful degradation is enabled
 *
 * Reference: /docs/MULTI_AGENT_ORGANISM_AUDIT.md - sections 2.5, 4.3
 */
export class SelfHealingManager extends EventEmitter {
  constructor(options = {}) {
    super()

    // Core dependencies
    this.orchestrator = options.orchestrator
    this.discoveryService = options.discoveryService
    this.notificationHub = options.notificationHub

    // Restart configuration
    this.maxRestartAttempts = options.maxRestartAttempts || 5
    this.baseRestartDelay = options.baseRestartDelay || 5000 // 5 seconds
    this.restartHistory = new Map() // agentId -> [timestamps]

    // Self-healing policies per agent
    this.selfHealingPolicies = new Map() // agentId -> policy config

    // Restart timers
    this.restartTimers = new Map() // agentId -> timeoutId

    logger.info(
      {
        maxRestartAttempts: this.maxRestartAttempts,
        baseRestartDelay: this.baseRestartDelay,
      },
      'SelfHealingManager initialized',
    )
  }

  /**
   * Handle agent failure with automatic recovery
   *
   * @param {string} agentId - Agent ID that failed
   * @param {Error} error - Error that caused the failure
   * @returns {Promise<void>}
   */
  async handleAgentFailure(agentId, error) {
    logger.error(
      { agentId, error: error.message },
      'Agent failure detected - initiating self-healing',
    )

    metrics.increment('selfHealing.failures.detected')

    try {
      // 1. Get agent manifest
      const manifest = this.orchestrator.manifests.get(agentId)

      if (!manifest) {
        logger.warn(
          { agentId },
          'Agent manifest not found - cannot apply self-healing',
        )
        return
      }

      // 2. Check if self-healing is enabled for this agent
      const selfHealingConfig = manifest.selfHealing || {}
      const enabled = selfHealingConfig.enabled !== false // Default: enabled

      if (!enabled) {
        logger.warn(
          { agentId },
          'Self-healing disabled for this agent - no recovery attempted',
        )
        return
      }

      // 3. Check restart history
      const attempts = this.getRestartAttempts(agentId)

      const maxAttempts =
        selfHealingConfig.maxRestartAttempts || this.maxRestartAttempts

      if (attempts >= maxAttempts) {
        logger.error(
          { agentId, attempts, maxAttempts },
          'Max restart attempts exceeded - handling critical failure',
        )
        metrics.increment('selfHealing.failures.maxAttemptsExceeded')
        await this.handleCriticalFailure(agentId, error)
        return
      }

      // 4. Schedule restart with exponential backoff
      const delay = this.calculateBackoff(
        attempts,
        selfHealingConfig.baseRestartDelay || this.baseRestartDelay,
      )

      logger.info(
        { agentId, attempts, delay, maxAttempts },
        'Scheduling agent restart with exponential backoff',
      )

      metrics.increment('selfHealing.restarts.scheduled')

      // Clear any existing restart timer
      if (this.restartTimers.has(agentId)) {
        clearTimeout(this.restartTimers.get(agentId))
      }

      // Schedule restart
      const timerId = setTimeout(async () => {
        try {
          await this.restartAgent(agentId)
        } catch (restartError) {
          logger.error(
            { agentId, error: restartError.message },
            'Scheduled restart failed',
          )
        }
      }, delay)

      this.restartTimers.set(agentId, timerId)
    } catch (handlerError) {
      logger.error(
        { agentId, error: handlerError.message },
        'Error in handleAgentFailure',
      )
      metrics.increment('selfHealing.errors')
    }
  }

  /**
   * Restart an agent
   *
   * @param {string} agentId - Agent ID to restart
   * @returns {Promise<boolean>} True if restart successful
   */
  async restartAgent(agentId) {
    logger.info({ agentId }, 'Restarting agent...')

    try {
      // 1. Record restart attempt
      this.recordRestartAttempt(agentId)

      // 2. Stop agent gracefully
      try {
        await this.orchestrator.stopAgent(agentId)
        logger.debug({ agentId }, 'Agent stopped successfully')
      } catch (stopError) {
        logger.warn(
          { agentId, error: stopError.message },
          'Error stopping agent - continuing with restart',
        )
      }

      // 3. Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 4. Start agent again
      await this.orchestrator.startAgent(agentId)

      // 5. Success - clear restart history
      this.clearRestartHistory(agentId)

      logger.info({ agentId }, 'Agent restarted successfully')
      metrics.increment('selfHealing.restarts.successful')

      this.emit('agent:restarted', { agentId })

      return true
    } catch (error) {
      logger.error(
        { agentId, error: error.message },
        'Failed to restart agent',
      )
      metrics.increment('selfHealing.restarts.failed')

      this.emit('agent:restart-failed', { agentId, error })

      // Try again with increased backoff
      await this.handleAgentFailure(agentId, error)

      return false
    }
  }

  /**
   * Find fallback agent with same capability
   *
   * @param {string} capability - Required capability
   * @returns {Promise<Object|null>} Fallback agent or null
   */
  async findFallback(capability) {
    logger.info({ capability }, 'Searching for fallback agent')

    try {
      // Use discovery service to find agents with capability
      const agents = this.discoveryService.discover(capability)

      // Filter out offline/failed agents
      const healthyAgents = agents.filter(agent => agent.status === 'active')

      if (healthyAgents.length === 0) {
        logger.warn({ capability }, 'No healthy fallback agents found')
        metrics.increment('selfHealing.fallback.notFound')
        return null
      }

      // Return first healthy agent (could be enhanced with load balancing)
      const fallback = healthyAgents[0]

      logger.info(
        { capability, fallbackId: fallback.id, fallbackName: fallback.name },
        'Fallback agent found',
      )
      metrics.increment('selfHealing.fallback.found')

      return fallback
    } catch (error) {
      logger.error(
        { capability, error: error.message },
        'Error finding fallback agent',
      )
      metrics.increment('selfHealing.fallback.error')
      return null
    }
  }

  /**
   * Enable graceful degradation for a feature
   *
   * @param {string} feature - Feature/agent to degrade
   * @returns {Promise<void>}
   */
  async enableGracefulDegradation(feature) {
    logger.warn(
      { feature },
      'Enabling graceful degradation - feature temporarily disabled',
    )

    metrics.increment('selfHealing.gracefulDegradation.enabled')

    // Emit event for subscribers (e.g., API gateway, feature flags)
    this.emit('graceful-degradation:enabled', { feature })

    // Could integrate with feature flags service here
    // Example: await featureFlagsService.disable(feature)
  }

  /**
   * Handle critical agent failure (max retries exceeded)
   *
   * @param {string} agentId - Agent ID that failed
   * @param {Error} error - Error that caused the failure
   * @returns {Promise<void>}
   */
  async handleCriticalFailure(agentId, error) {
    logger.error(
      { agentId, error: error.message },
      'CRITICAL: Agent failed permanently after max retry attempts',
    )

    metrics.increment('selfHealing.failures.critical')

    const manifest = this.orchestrator.manifests.get(agentId)

    if (!manifest) {
      logger.error({ agentId }, 'Cannot handle critical failure - manifest not found')
      return
    }

    const criticality = manifest.criticality || 'medium'

    // 1. Send critical notification
    if (this.notificationHub) {
      try {
        await this.notificationHub.sendCriticalAlert({
          title: 'Critical Agent Failure',
          message: `Agent ${manifest.name} (${agentId}) failed and could not be restarted after multiple attempts`,
          agentId,
          agentName: manifest.name,
          criticality,
          error: error.message,
          timestamp: new Date().toISOString(),
        })

        logger.info({ agentId }, 'Critical failure notification sent')
      } catch (notifError) {
        logger.error(
          { agentId, error: notifError.message },
          'Failed to send critical failure notification',
        )
      }
    } else {
      logger.warn('NotificationHub not configured - cannot send alerts')
    }

    // 2. Handle based on criticality
    if (criticality === 'critical') {
      logger.error(
        { agentId },
        'CRITICAL AGENT DOWN - SYSTEM DEGRADED - requires immediate attention',
      )

      // System cannot function without this agent
      // In production, this might trigger pager duty, escalations, etc.
      metrics.increment('selfHealing.failures.systemDegraded')
    } else {
      // Try to find fallback
      const capabilities = manifest.provides?.capabilities || []

      if (capabilities.length > 0) {
        const primaryCapability = capabilities[0]
        const fallback = await this.findFallback(primaryCapability)

        if (fallback) {
          logger.info(
            { agentId, fallbackId: fallback.id },
            'Fallback agent found - traffic can be redirected',
          )

          // Could automatically redirect traffic here
          // Example: await apiGateway.redirectTraffic(agentId, fallback.id)
        } else {
          logger.warn(
            { agentId },
            'No fallback found - enabling graceful degradation',
          )

          // Enable graceful degradation
          await this.enableGracefulDegradation(agentId)
        }
      } else {
        logger.warn({ agentId }, 'Agent has no capabilities - cannot find fallback')
        await this.enableGracefulDegradation(agentId)
      }
    }

    // 3. Emit critical failure event
    this.emit('agent:critical-failure', { agentId, error, manifest })
  }

  /**
   * Calculate exponential backoff delay
   *
   * @param {number} attempts - Number of restart attempts
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {number} Backoff delay in milliseconds
   */
  calculateBackoff(attempts, baseDelay = this.baseRestartDelay) {
    // Exponential backoff: baseDelay * 2^attempts
    // Example with 5s base: 5s, 10s, 20s, 40s, 80s
    return baseDelay * Math.pow(2, attempts)
  }

  /**
   * Get restart attempts in recent window
   *
   * @param {string} agentId - Agent ID
   * @returns {number} Number of restart attempts in last 5 minutes
   */
  getRestartAttempts(agentId) {
    const history = this.restartHistory.get(agentId) || []

    // Count attempts in last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const recentAttempts = history.filter(
      timestamp => timestamp > fiveMinutesAgo,
    )

    return recentAttempts.length
  }

  /**
   * Record restart attempt
   *
   * @param {string} agentId - Agent ID
   */
  recordRestartAttempt(agentId) {
    const history = this.restartHistory.get(agentId) || []
    history.push(Date.now())
    this.restartHistory.set(agentId, history)

    logger.debug({ agentId, attempts: history.length }, 'Restart attempt recorded')
  }

  /**
   * Clear restart history (after successful restart)
   *
   * @param {string} agentId - Agent ID
   */
  clearRestartHistory(agentId) {
    this.restartHistory.delete(agentId)
    logger.debug({ agentId }, 'Restart history cleared')
  }

  /**
   * Get restart history for an agent
   *
   * @param {string} agentId - Agent ID
   * @returns {Array<number>} Array of restart timestamps
   */
  getRestartHistory(agentId) {
    return this.restartHistory.get(agentId) || []
  }

  /**
   * Get all agents with restart history
   *
   * @returns {Array<Object>} Array of agents with restart info
   */
  getAllRestartHistory() {
    const history = []

    for (const [agentId, timestamps] of this.restartHistory.entries()) {
      history.push({
        agentId,
        totalRestarts: timestamps.length,
        lastRestartAt: new Date(Math.max(...timestamps)),
        recentRestarts: this.getRestartAttempts(agentId),
        timestamps,
      })
    }

    return history
  }

  /**
   * Get self-healing statistics
   *
   * @returns {Object} Statistics
   */
  getStats() {
    const totalAgentsWithHistory = this.restartHistory.size
    const totalRestarts = Array.from(this.restartHistory.values()).reduce(
      (sum, history) => sum + history.length,
      0,
    )

    return {
      totalAgentsWithHistory,
      totalRestarts,
      maxRestartAttempts: this.maxRestartAttempts,
      baseRestartDelay: this.baseRestartDelay,
      activeRestartTimers: this.restartTimers.size,
      restartHistory: this.getAllRestartHistory(),
    }
  }

  /**
   * Register integration with orchestrator events
   *
   * @returns {void}
   */
  registerOrchestratorIntegration() {
    if (!this.orchestrator) {
      logger.warn('Orchestrator not configured - cannot register integration')
      return
    }

    // Listen for agent failures
    this.orchestrator.on('agent:failed', async ({ agentId, error }) => {
      await this.handleAgentFailure(agentId, error)
    })

    logger.info('SelfHealingManager integrated with orchestrator events')
  }

  /**
   * Register integration with agent registry events
   *
   * @param {Object} agentRegistry - AgentRegistry instance
   * @returns {void}
   */
  registerAgentRegistryIntegration(agentRegistry) {
    if (!agentRegistry) {
      logger.warn('AgentRegistry not provided - cannot register integration')
      return
    }

    // Listen for agent offline events
    agentRegistry.on('agent:offline', async ({ agentId }) => {
      await this.handleAgentFailure(
        agentId,
        new Error('Agent went offline'),
      )
    })

    logger.info('SelfHealingManager integrated with AgentRegistry events')
  }

  /**
   * Shutdown self-healing manager
   *
   * @returns {void}
   */
  shutdown() {
    logger.info('Shutting down SelfHealingManager')

    // Clear all restart timers
    for (const timerId of this.restartTimers.values()) {
      clearTimeout(timerId)
    }

    // Clear data
    this.restartHistory.clear()
    this.restartTimers.clear()
    this.selfHealingPolicies.clear()

    // Remove all listeners
    this.removeAllListeners()

    logger.info('SelfHealingManager shut down successfully')
  }
}

export default SelfHealingManager
