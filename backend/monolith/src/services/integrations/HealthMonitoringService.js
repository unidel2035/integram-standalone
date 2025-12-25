/**
 * Integration Health Monitoring Service
 *
 * Monitors the health and performance of external integrations:
 * - Active integrations count
 * - Failed integrations tracking
 * - API call rate limits
 * - Last successful sync times
 * - Error rates per provider
 */

import logger from '../../utils/logger.js'
import * as integrationsService from '../externalIntegrationsService.js'

export class HealthMonitoringService {
  constructor(config = {}) {
    this.monitoringInterval = config.monitoringInterval || 300000 // 5 minutes
    this.isRunning = false
    this.intervalId = null
    this.metrics = {
      providers: {},
      overall: {
        totalIntegrations: 0,
        activeIntegrations: 0,
        failedIntegrations: 0,
        lastUpdated: null
      }
    }
  }

  /**
   * Start the health monitoring service
   */
  start() {
    if (this.isRunning) {
      logger.warn('Health monitoring service is already running')
      return
    }

    this.isRunning = true
    logger.info('Starting integration health monitoring service', { monitoringInterval: this.monitoringInterval })

    // Run immediately on start
    this.collectMetrics().catch(error => {
      logger.error('Initial metrics collection failed', { error: error.message })
    })

    // Schedule periodic monitoring
    this.intervalId = setInterval(() => {
      this.collectMetrics().catch(error => {
        logger.error('Scheduled metrics collection failed', { error: error.message })
      })
    }, this.monitoringInterval)
  }

  /**
   * Stop the health monitoring service
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Health monitoring service is not running')
      return
    }

    this.isRunning = false

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    logger.info('Stopped integration health monitoring service')
  }

  /**
   * Collect metrics for all integrations
   * @returns {Promise<Object>} Collected metrics
   */
  async collectMetrics() {
    try {
      logger.info('Collecting integration health metrics')

      const allIntegrations = await this.getAllIntegrations()

      const metrics = {
        providers: {},
        overall: {
          totalIntegrations: allIntegrations.length,
          activeIntegrations: 0,
          failedIntegrations: 0,
          lastUpdated: new Date().toISOString()
        }
      }

      // Group by provider
      const byProvider = {}
      for (const integration of allIntegrations) {
        const provider = integration.provider

        if (!byProvider[provider]) {
          byProvider[provider] = []
        }

        byProvider[provider].push(integration)
      }

      // Calculate metrics per provider
      for (const [provider, integrations] of Object.entries(byProvider)) {
        const providerMetrics = this.calculateProviderMetrics(provider, integrations)
        metrics.providers[provider] = providerMetrics

        metrics.overall.activeIntegrations += providerMetrics.activeCount
        metrics.overall.failedIntegrations += providerMetrics.failedCount
      }

      this.metrics = metrics

      logger.info('Integration health metrics collected', {
        totalIntegrations: metrics.overall.totalIntegrations,
        activeIntegrations: metrics.overall.activeIntegrations,
        failedIntegrations: metrics.overall.failedIntegrations
      })

      return metrics
    } catch (error) {
      logger.error('Failed to collect health metrics', { error: error.message })
      throw error
    }
  }

  /**
   * Calculate metrics for a specific provider
   * @param {string} provider - Provider ID
   * @param {Array} integrations - List of integrations for this provider
   * @returns {Object} Provider metrics
   */
  calculateProviderMetrics(provider, integrations) {
    const metrics = {
      provider,
      totalCount: integrations.length,
      activeCount: 0,
      failedCount: 0,
      expiringCount: 0,
      lastSync: null,
      errorRate: 0,
      avgResponseTime: null
    }

    const now = Math.floor(Date.now() / 1000)
    const expirationThreshold = now + 86400 // 24 hours

    for (const integration of integrations) {
      const config = integration.config

      // Count by status
      if (config.status === 'failed') {
        metrics.failedCount++
      } else {
        metrics.activeCount++
      }

      // Check for expiring tokens
      if (config.expiresAt && config.expiresAt < expirationThreshold) {
        metrics.expiringCount++
      }

      // Track last sync time
      if (config.lastSyncedAt) {
        const syncTime = new Date(config.lastSyncedAt)
        if (!metrics.lastSync || syncTime > new Date(metrics.lastSync)) {
          metrics.lastSync = config.lastSyncedAt
        }
      }
    }

    // Calculate error rate (failed / total)
    metrics.errorRate = metrics.totalCount > 0
      ? (metrics.failedCount / metrics.totalCount * 100).toFixed(2)
      : 0

    return metrics
  }

  /**
   * Get all integrations
   * @returns {Promise<Array>} List of all integrations
   */
  async getAllIntegrations() {
    try {
      // TODO: Query database for all integrations
      // For now, return empty array (placeholder)

      // Example query:
      // const integrations = await db.query(`
      //   SELECT * FROM integration_configs
      // `)

      return []
    } catch (error) {
      logger.error('Failed to get all integrations', { error: error.message })
      throw error
    }
  }

  /**
   * Get current health metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return this.metrics
  }

  /**
   * Get health status for a specific provider
   * @param {string} provider - Provider ID
   * @returns {Object|null} Provider health status
   */
  getProviderHealth(provider) {
    return this.metrics.providers[provider] || null
  }

  /**
   * Get overall health status
   * @returns {Object} Overall health status
   */
  getOverallHealth() {
    const { overall } = this.metrics

    let status = 'healthy'
    let message = 'All integrations are functioning normally'

    if (overall.failedIntegrations > 0) {
      const failureRate = (overall.failedIntegrations / overall.totalIntegrations * 100).toFixed(2)

      if (failureRate > 50) {
        status = 'critical'
        message = `${overall.failedIntegrations} integrations have failed (${failureRate}%)`
      } else if (failureRate > 20) {
        status = 'warning'
        message = `${overall.failedIntegrations} integrations have issues (${failureRate}%)`
      } else {
        status = 'degraded'
        message = `${overall.failedIntegrations} integrations have minor issues`
      }
    }

    return {
      status,
      message,
      ...overall
    }
  }

  /**
   * Get integrations that need attention
   * @returns {Array} List of problematic integrations
   */
  getProblematicIntegrations() {
    const problems = []

    for (const [provider, metrics] of Object.entries(this.metrics.providers)) {
      if (metrics.failedCount > 0) {
        problems.push({
          provider,
          issue: 'failed_integrations',
          count: metrics.failedCount,
          severity: 'high'
        })
      }

      if (metrics.expiringCount > 0) {
        problems.push({
          provider,
          issue: 'expiring_tokens',
          count: metrics.expiringCount,
          severity: 'medium'
        })
      }

      if (parseFloat(metrics.errorRate) > 50) {
        problems.push({
          provider,
          issue: 'high_error_rate',
          errorRate: metrics.errorRate,
          severity: 'high'
        })
      }
    }

    return problems
  }

  /**
   * Check rate limit status for provider
   * @param {string} provider - Provider ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Rate limit status
   */
  async checkRateLimit(provider, userId) {
    try {
      // TODO: Implement rate limit checking
      // This would query a rate limit tracking system (Redis, memory, etc.)

      // Example rate limits by provider
      const rateLimits = {
        slack: { limit: 1, window: 1000 }, // 1 req/sec
        'microsoft-teams': { limit: 100, window: 600000 }, // 100 req/10min
        'google-drive': { limit: 10, window: 1000 } // 10 req/sec
      }

      const limit = rateLimits[provider] || { limit: 60, window: 60000 } // Default: 60 req/min

      // Check current usage
      // const usage = await redis.get(`ratelimit:${provider}:${userId}`)

      return {
        provider,
        limit: limit.limit,
        window: limit.window,
        remaining: limit.limit, // Placeholder
        resetAt: Date.now() + limit.window
      }
    } catch (error) {
      logger.error('Failed to check rate limit', { error: error.message, provider, userId })
      throw error
    }
  }

  /**
   * Record API call for rate limiting
   * @param {string} provider - Provider ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async recordApiCall(provider, userId) {
    try {
      // TODO: Implement API call recording for rate limiting
      // This would increment a counter in Redis with TTL

      // Example:
      // const key = `ratelimit:${provider}:${userId}`
      // await redis.incr(key)
      // await redis.expire(key, windowInSeconds)

      logger.debug('Recorded API call', { provider, userId })
    } catch (error) {
      logger.error('Failed to record API call', { error: error.message, provider, userId })
    }
  }
}

// Create singleton instance
let healthMonitoringServiceInstance = null

/**
 * Get health monitoring service instance
 * @param {Object} config - Configuration options
 * @returns {HealthMonitoringService} Service instance
 */
export function getHealthMonitoringService(config) {
  if (!healthMonitoringServiceInstance) {
    healthMonitoringServiceInstance = new HealthMonitoringService(config)
  }
  return healthMonitoringServiceInstance
}

export default HealthMonitoringService
