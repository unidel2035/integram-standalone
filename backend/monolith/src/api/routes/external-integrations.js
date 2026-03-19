/**
 * External Integrations API Routes
 *
 * Handles API endpoints for managing integrations with external applications:
 * - OAuth2 authorization flows
 * - Integration configuration management
 * - Webhook endpoints
 * - API key management
 */

import express from 'express'
import * as integrationsService from '../../services/externalIntegrationsService.js'
import logger from '../../utils/logger.js'

const router = express.Router()

/**
 * Get all available providers
 * GET /api/integrations/providers
 */
router.get('/providers', async (req, res) => {
  try {
    const providers = integrationsService.getAvailableProviders()

    const providersWithConfig = providers.map(providerId => ({
      id: providerId,
      config: integrationsService.getProviderConfig(providerId)
    }))

    res.json({
      success: true,
      data: providersWithConfig
    })
  } catch (error) {
    logger.error('Failed to get providers', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve providers'
    })
  }
})

/**
 * Initiate OAuth authorization flow
 * POST /api/integrations/oauth/authorize
 *
 * Body: { provider, redirectUri }
 * Returns: { authUrl, state }
 */
router.post('/oauth/authorize', async (req, res) => {
  try {
    const { provider, redirectUri } = req.body

    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider is required'
      })
    }

    if (!redirectUri) {
      return res.status(400).json({
        success: false,
        error: 'Redirect URI is required'
      })
    }

    const result = integrationsService.buildAuthorizationUrl(provider, redirectUri)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('OAuth authorization failed', { error: error.message })
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate OAuth flow'
    })
  }
})

/**
 * Handle OAuth callback
 * POST /api/integrations/oauth/callback
 *
 * Body: { code, state }
 * Returns: { provider, tokenData }
 */
router.post('/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.body

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: 'Code and state are required'
      })
    }

    // Verify state
    const stateData = integrationsService.verifyOAuthState(state)

    if (!stateData) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired state'
      })
    }

    // Exchange code for token
    const tokenData = await integrationsService.exchangeCodeForToken(
      stateData.provider,
      code,
      stateData.redirectUri
    )

    // Get user ID from session (or use a default user for now)
    const userId = req.session?.userId || 'default-user'

    // Save integration configuration
    await integrationsService.saveIntegrationConfig(userId, stateData.provider, {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresIn: tokenData.expiresIn,
      connectedAt: new Date()
    })

    res.json({
      success: true,
      data: {
        provider: stateData.provider,
        tokenData
      }
    })
  } catch (error) {
    logger.error('OAuth callback failed', { error: error.message })
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete OAuth flow'
    })
  }
})

/**
 * Save integration configuration
 * POST /api/integrations/:provider/config
 *
 * Body: { apiKey?, webhookUrl?, customConfig? }
 */
router.post('/:provider/config', async (req, res) => {
  try {
    const { provider } = req.params
    const { apiKey, webhookUrl, customConfig } = req.body

    // Get user ID from session
    const userId = req.session?.userId || 'default-user'

    const config = {}

    if (apiKey) {
      if (!integrationsService.validateApiKey(apiKey)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid API key format'
        })
      }
      config.apiKey = apiKey
    }

    if (webhookUrl) {
      config.webhookUrl = webhookUrl
    }

    if (customConfig) {
      try {
        config.customConfig = typeof customConfig === 'string'
          ? JSON.parse(customConfig)
          : customConfig
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid custom configuration JSON'
        })
      }
    }

    config.connectedAt = new Date()

    await integrationsService.saveIntegrationConfig(userId, provider, config)

    res.json({
      success: true,
      data: {
        provider,
        config
      }
    })
  } catch (error) {
    logger.error('Failed to save integration config', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to save configuration'
    })
  }
})

/**
 * Get integration configuration
 * GET /api/integrations/:provider/config
 */
router.get('/:provider/config', async (req, res) => {
  try {
    const { provider } = req.params
    const userId = req.session?.userId || 'default-user'

    const config = await integrationsService.getIntegrationConfig(userId, provider)

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      })
    }

    res.json({
      success: true,
      data: config
    })
  } catch (error) {
    logger.error('Failed to get integration config', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve configuration'
    })
  }
})

/**
 * Delete integration
 * DELETE /api/integrations/:provider
 */
router.delete('/:provider', async (req, res) => {
  try {
    const { provider } = req.params
    const userId = req.session?.userId || 'default-user'

    const deleted = await integrationsService.deleteIntegrationConfig(userId, provider)

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      })
    }

    res.json({
      success: true,
      data: {
        provider,
        deleted: true
      }
    })
  } catch (error) {
    logger.error('Failed to delete integration', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to delete integration'
    })
  }
})

/**
 * Get all user integrations
 * GET /api/integrations
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.session?.userId || 'default-user'

    const integrations = await integrationsService.getUserIntegrations(userId)

    res.json({
      success: true,
      data: integrations
    })
  } catch (error) {
    logger.error('Failed to get user integrations', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve integrations'
    })
  }
})

/**
 * Generate webhook URL
 * GET /api/integrations/:provider/webhook-url
 */
router.get('/:provider/webhook-url', async (req, res) => {
  try {
    const { provider } = req.params
    const userId = req.session?.userId || 'default-user'

    const webhookUrl = integrationsService.generateWebhookUrl(provider, userId)

    res.json({
      success: true,
      data: {
        provider,
        webhookUrl
      }
    })
  } catch (error) {
    logger.error('Failed to generate webhook URL', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to generate webhook URL'
    })
  }
})

/**
 * Webhook endpoint for receiving events from external services
 * POST /api/webhooks/:provider
 * POST /api/webhooks/:provider/:userId
 *
 * This endpoint receives webhook events from integrated services
 */
router.post('/webhooks/:provider/:userId?', async (req, res) => {
  try {
    const { provider, userId } = req.params
    const payload = req.body

    logger.info('Received webhook', {
      provider,
      userId,
      headers: req.headers,
      payload: JSON.stringify(payload).substring(0, 200)
    })

    // TODO: Process webhook based on provider
    // Different providers have different webhook formats and signatures
    // - Slack: verify signing secret
    // - Microsoft Teams: verify token
    // - Trello: verify webhook signature
    // - etc.

    // For now, just acknowledge receipt
    res.json({
      success: true,
      data: {
        provider,
        userId,
        received: true
      }
    })
  } catch (error) {
    logger.error('Webhook processing failed', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook'
    })
  }
})

export default router
