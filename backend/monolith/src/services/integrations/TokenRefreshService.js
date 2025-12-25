/**
 * OAuth Token Auto-Refresh Service
 *
 * Automatically refreshes expired OAuth tokens for integrated services.
 * Runs as a background service (cron job) to ensure integrations remain active.
 */

import logger from '../../utils/logger.js'
import * as integrationsService from '../externalIntegrationsService.js'

export class TokenRefreshService {
  constructor(config = {}) {
    this.refreshInterval = config.refreshInterval || 3600000 // 1 hour in ms
    this.expirationThreshold = config.expirationThreshold || 300 // 5 minutes in seconds
    this.isRunning = false
    this.intervalId = null
  }

  /**
   * Start the token refresh service
   */
  start() {
    if (this.isRunning) {
      logger.warn('Token refresh service is already running')
      return
    }

    this.isRunning = true
    logger.info('Starting OAuth token refresh service', { refreshInterval: this.refreshInterval })

    // Run immediately on start
    this.refreshExpiredTokens().catch(error => {
      logger.error('Initial token refresh failed', { error: error.message })
    })

    // Schedule periodic refresh
    this.intervalId = setInterval(() => {
      this.refreshExpiredTokens().catch(error => {
        logger.error('Scheduled token refresh failed', { error: error.message })
      })
    }, this.refreshInterval)
  }

  /**
   * Stop the token refresh service
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Token refresh service is not running')
      return
    }

    this.isRunning = false

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    logger.info('Stopped OAuth token refresh service')
  }

  /**
   * Refresh all expired or expiring tokens
   * @returns {Promise<Object>} Refresh results
   */
  async refreshExpiredTokens() {
    try {
      logger.info('Starting token refresh cycle')

      const integrations = await this.getIntegrationsNeedingRefresh()

      logger.info('Found integrations needing token refresh', { count: integrations.length })

      const results = {
        total: integrations.length,
        success: 0,
        failed: 0,
        errors: []
      }

      for (const integration of integrations) {
        try {
          await this.refreshIntegrationToken(integration)
          results.success++
          logger.info('Successfully refreshed token', {
            userId: integration.userId,
            provider: integration.provider
          })
        } catch (error) {
          results.failed++
          results.errors.push({
            userId: integration.userId,
            provider: integration.provider,
            error: error.message
          })
          logger.error('Failed to refresh token', {
            userId: integration.userId,
            provider: integration.provider,
            error: error.message
          })

          // Mark integration as failed
          await this.markIntegrationAsFailed(integration, error)
        }
      }

      logger.info('Token refresh cycle completed', results)

      return results
    } catch (error) {
      logger.error('Token refresh cycle failed', { error: error.message })
      throw error
    }
  }

  /**
   * Get integrations that need token refresh
   * @returns {Promise<Array>} List of integrations
   */
  async getIntegrationsNeedingRefresh() {
    try {
      // TODO: Query database for integrations with expiring tokens
      // For now, return empty array (placeholder)

      // Example query logic:
      // const now = Math.floor(Date.now() / 1000)
      // const threshold = now + this.expirationThreshold
      //
      // const integrations = await db.query(`
      //   SELECT * FROM integration_configs
      //   WHERE config->>'refreshToken' IS NOT NULL
      //   AND (
      //     config->>'expiresAt' IS NULL
      //     OR CAST(config->>'expiresAt' AS INTEGER) < $1
      //   )
      //   AND status != 'failed'
      // `, [threshold])

      return []
    } catch (error) {
      logger.error('Failed to get integrations needing refresh', { error: error.message })
      throw error
    }
  }

  /**
   * Refresh token for a specific integration
   * @param {Object} integration - Integration config
   * @returns {Promise<Object>} New token data
   */
  async refreshIntegrationToken(integration) {
    const { userId, provider, config } = integration

    if (!config.refreshToken) {
      throw new Error('No refresh token available')
    }

    const providerConfig = integrationsService.getProviderConfig(provider)

    if (!providerConfig || !providerConfig.tokenUrl) {
      throw new Error(`Provider ${provider} does not support token refresh`)
    }

    // Get client credentials
    const clientIdKey = `${provider.toUpperCase().replace(/-/g, '_')}_CLIENT_ID`
    const clientSecretKey = `${provider.toUpperCase().replace(/-/g, '_')}_CLIENT_SECRET`

    const clientId = process.env[clientIdKey]
    const clientSecret = process.env[clientSecretKey]

    if (!clientId || !clientSecret) {
      throw new Error(`Missing credentials for provider ${provider}`)
    }

    // Refresh the token
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })

    const response = await fetch(providerConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token refresh failed: ${error}`)
    }

    const data = await response.json()

    // Update integration config with new token
    const newConfig = {
      ...config,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || config.refreshToken, // Some providers don't return new refresh token
      expiresIn: data.expires_in,
      expiresAt: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : null,
      lastRefreshedAt: new Date().toISOString(),
      status: 'active'
    }

    await integrationsService.saveIntegrationConfig(userId, provider, newConfig)

    logger.info('Token refreshed successfully', { userId, provider })

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in
    }
  }

  /**
   * Mark integration as failed
   * @param {Object} integration - Integration config
   * @param {Error} error - Error that caused failure
   * @returns {Promise<void>}
   */
  async markIntegrationAsFailed(integration, error) {
    try {
      const { userId, provider, config } = integration

      const updatedConfig = {
        ...config,
        status: 'failed',
        lastError: error.message,
        failedAt: new Date().toISOString()
      }

      await integrationsService.saveIntegrationConfig(userId, provider, updatedConfig)

      logger.info('Marked integration as failed', { userId, provider, error: error.message })
    } catch (err) {
      logger.error('Failed to mark integration as failed', { error: err.message })
    }
  }

  /**
   * Manually refresh a specific integration
   * @param {string} userId - User ID
   * @param {string} provider - Provider ID
   * @returns {Promise<Object>} Refresh result
   */
  async refreshIntegration(userId, provider) {
    try {
      const integration = await integrationsService.getIntegrationConfig(userId, provider)

      if (!integration) {
        throw new Error('Integration not found')
      }

      const tokenData = await this.refreshIntegrationToken(integration)

      logger.info('Manual token refresh successful', { userId, provider })

      return {
        success: true,
        tokenData
      }
    } catch (error) {
      logger.error('Manual token refresh failed', { userId, provider, error: error.message })
      throw error
    }
  }
}

// Create singleton instance
let tokenRefreshServiceInstance = null

/**
 * Get token refresh service instance
 * @param {Object} config - Configuration options
 * @returns {TokenRefreshService} Service instance
 */
export function getTokenRefreshService(config) {
  if (!tokenRefreshServiceInstance) {
    tokenRefreshServiceInstance = new TokenRefreshService(config)
  }
  return tokenRefreshServiceInstance
}

export default TokenRefreshService
