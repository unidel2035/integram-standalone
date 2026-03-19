/**
 * CRM Integration API Routes
 *
 * Handles CRM connection, authentication, and data synchronization for Lead Qualification Agent.
 * Supports: HubSpot, Salesforce, Pipedrive
 *
 * Issue #3041 - Lead Qualification Agent CRM Integration
 */

import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import logger from '../../utils/logger.js'
import HubSpotCRMProvider from '../../services/integrations/providers/HubSpotCRMProvider.js'
import * as integrationsService from '../../services/externalIntegrationsService.js'

const router = express.Router()

// CRM provider instances (lazy loaded)
const crmProviders = {
  hubspot: null,
  // salesforce: null, // TODO: Phase 2
  // pipedrive: null   // TODO: Phase 3
}

/**
 * Get CRM provider instance
 * @param {string} provider - Provider name (hubspot, salesforce, pipedrive)
 * @returns {Object} CRM provider instance
 */
function getCRMProvider(provider) {
  if (!crmProviders[provider]) {
    switch (provider) {
      case 'hubspot':
        crmProviders.hubspot = new HubSpotCRMProvider({})
        break
      // TODO: Add Salesforce and Pipedrive in future phases
      default:
        throw new Error(`Unsupported CRM provider: ${provider}`)
    }
  }

  return crmProviders[provider]
}

// Temporary in-memory storage for CRM connections (use DronDoc API in production)
const crmConnections = new Map()

// Temporary storage for sync queue (retry failed syncs)
const syncQueue = []

/**
 * GET /api/crm/providers
 * Get list of supported CRM providers
 */
router.get('/providers', (req, res) => {
  try {
    const providers = [
      {
        id: 'hubspot',
        name: 'HubSpot',
        description: 'Popular CRM for inbound marketing and sales',
        status: 'available',
        requiresOAuth: true,
        features: ['contacts', 'deals', 'webhooks', 'custom_properties']
      },
      {
        id: 'salesforce',
        name: 'Salesforce',
        description: 'Enterprise CRM platform',
        status: 'coming_soon',
        requiresOAuth: true,
        features: ['leads', 'contacts', 'opportunities', 'workflows']
      },
      {
        id: 'pipedrive',
        name: 'Pipedrive',
        description: 'Sales-focused CRM for SMBs',
        status: 'coming_soon',
        requiresOAuth: true,
        features: ['persons', 'deals', 'pipelines']
      }
    ]

    res.json({
      success: true,
      providers
    })
  } catch (error) {
    logger.error('Failed to get CRM providers', { error: error.message })
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/crm/connect/:provider
 * Initiate OAuth flow for CRM connection
 *
 * Request body:
 * {
 *   userId: string - User ID
 *   redirectUri: string - OAuth callback URL
 * }
 */
router.post('/connect/:provider', async (req, res) => {
  try {
    const { provider } = req.params
    const { userId, redirectUri } = req.body

    if (!userId || !redirectUri) {
      return res.status(400).json({
        success: false,
        error: 'userId and redirectUri are required'
      })
    }

    logger.info('Initiating CRM OAuth flow', { provider, userId })

    // Build OAuth authorization URL
    const { authUrl, state } = integrationsService.buildAuthorizationUrl(provider, redirectUri)

    // Store state for verification
    crmConnections.set(state, {
      provider,
      userId,
      redirectUri,
      createdAt: Date.now()
    })

    res.json({
      success: true,
      authUrl,
      state
    })
  } catch (error) {
    logger.error('Failed to initiate CRM OAuth', { error: error.message, provider: req.params.provider })
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/crm/callback/:provider
 * Handle OAuth callback and exchange code for token
 *
 * Request body:
 * {
 *   code: string - OAuth authorization code
 *   state: string - OAuth state for CSRF protection
 * }
 */
router.post('/callback/:provider', async (req, res) => {
  try {
    const { provider } = req.params
    const { code, state } = req.body

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: 'code and state are required'
      })
    }

    // Verify state
    const connectionData = crmConnections.get(state)
    if (!connectionData || connectionData.provider !== provider) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired OAuth state'
      })
    }

    logger.info('Processing CRM OAuth callback', { provider, userId: connectionData.userId })

    // Get CRM provider
    const crmProvider = getCRMProvider(provider)

    // Exchange code for token
    const tokenData = await crmProvider.exchangeCodeForToken(code, connectionData.redirectUri)

    // Store connection with tokens (TODO: Encrypt tokens in production)
    const connectionId = uuidv4()
    const connection = {
      id: connectionId,
      provider,
      userId: connectionData.userId,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiresAt: Date.now() + (tokenData.expiresIn * 1000),
      connectedAt: new Date().toISOString(),
      status: 'active'
    }

    crmConnections.set(connectionId, connection)
    crmConnections.delete(state) // Clean up OAuth state

    logger.info('CRM connection established', { provider, userId: connectionData.userId, connectionId })

    res.json({
      success: true,
      connection: {
        id: connectionId,
        provider,
        connectedAt: connection.connectedAt,
        status: connection.status
      }
    })
  } catch (error) {
    logger.error('Failed to complete CRM OAuth', { error: error.message, provider: req.params.provider })
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/crm/connections/:userId
 * Get user's CRM connections
 */
router.get('/connections/:userId', (req, res) => {
  try {
    const { userId } = req.params

    const userConnections = Array.from(crmConnections.values())
      .filter(conn => conn.userId === userId && conn.status === 'active')
      .map(conn => ({
        id: conn.id,
        provider: conn.provider,
        connectedAt: conn.connectedAt,
        status: conn.status
      }))

    res.json({
      success: true,
      connections: userConnections
    })
  } catch (error) {
    logger.error('Failed to get CRM connections', { error: error.message, userId: req.params.userId })
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * DELETE /api/crm/connections/:connectionId
 * Disconnect CRM
 */
router.delete('/connections/:connectionId', (req, res) => {
  try {
    const { connectionId } = req.params

    const connection = crmConnections.get(connectionId)
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      })
    }

    logger.info('Disconnecting CRM', { connectionId, provider: connection.provider })

    connection.status = 'disconnected'
    connection.disconnectedAt = new Date().toISOString()

    res.json({
      success: true,
      message: 'CRM disconnected successfully'
    })
  } catch (error) {
    logger.error('Failed to disconnect CRM', { error: error.message, connectionId: req.params.connectionId })
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/crm/sync/lead
 * Sync lead to CRM
 *
 * Request body:
 * {
 *   leadId: string - Lead UUID
 *   connectionId: string - CRM connection ID
 *   leadData: Object - Lead information to sync
 * }
 */
router.post('/sync/lead', async (req, res) => {
  try {
    const { leadId, connectionId, leadData } = req.body

    if (!leadId || !connectionId || !leadData) {
      return res.status(400).json({
        success: false,
        error: 'leadId, connectionId, and leadData are required'
      })
    }

    // Get CRM connection
    const connection = crmConnections.get(connectionId)
    if (!connection || connection.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'CRM connection not found or inactive'
      })
    }

    // Check if token is expired and refresh if needed
    if (Date.now() >= connection.tokenExpiresAt) {
      logger.info('Refreshing expired CRM token', { connectionId, provider: connection.provider })

      const crmProvider = getCRMProvider(connection.provider)
      const newTokenData = await crmProvider.refreshAccessToken(connection.refreshToken)

      connection.accessToken = newTokenData.accessToken
      connection.refreshToken = newTokenData.refreshToken
      connection.tokenExpiresAt = Date.now() + (newTokenData.expiresIn * 1000)
    }

    logger.info('Syncing lead to CRM', { leadId, provider: connection.provider })

    // Get CRM provider and sync lead
    const crmProvider = getCRMProvider(connection.provider)
    const crmLead = await crmProvider.syncLeadToCRM(connection.accessToken, leadData)

    // Record sync result
    const syncRecord = {
      id: uuidv4(),
      leadId,
      connectionId,
      provider: connection.provider,
      crmLeadId: crmLead.id,
      syncedAt: new Date().toISOString(),
      status: 'success'
    }

    logger.info('Lead synced to CRM successfully', { leadId, crmLeadId: crmLead.id, provider: connection.provider })

    res.json({
      success: true,
      syncRecord,
      crmLead
    })
  } catch (error) {
    logger.error('Failed to sync lead to CRM', { error: error.message, leadId: req.body.leadId })

    // Add to retry queue
    syncQueue.push({
      leadId: req.body.leadId,
      connectionId: req.body.connectionId,
      leadData: req.body.leadData,
      failedAt: new Date().toISOString(),
      error: error.message,
      retries: 0
    })

    res.status(500).json({
      success: false,
      error: error.message,
      queued: true // Indicates sync was queued for retry
    })
  }
})

/**
 * GET /api/crm/fetch/lead/:crmLeadId
 * Fetch lead from CRM
 *
 * Query params:
 * - connectionId: CRM connection ID
 */
router.get('/fetch/lead/:crmLeadId', async (req, res) => {
  try {
    const { crmLeadId } = req.params
    const { connectionId } = req.query

    if (!connectionId) {
      return res.status(400).json({
        success: false,
        error: 'connectionId query parameter is required'
      })
    }

    // Get CRM connection
    const connection = crmConnections.get(connectionId)
    if (!connection || connection.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'CRM connection not found or inactive'
      })
    }

    logger.info('Fetching lead from CRM', { crmLeadId, provider: connection.provider })

    // Get CRM provider and fetch lead
    const crmProvider = getCRMProvider(connection.provider)
    const leadData = await crmProvider.fetchLeadFromCRM(connection.accessToken, crmLeadId)

    res.json({
      success: true,
      leadData
    })
  } catch (error) {
    logger.error('Failed to fetch lead from CRM', { error: error.message, crmLeadId: req.params.crmLeadId })
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * PATCH /api/crm/update/lead/:crmLeadId
 * Update lead in CRM
 *
 * Request body:
 * {
 *   connectionId: string - CRM connection ID
 *   updates: Object - Fields to update
 * }
 */
router.patch('/update/lead/:crmLeadId', async (req, res) => {
  try {
    const { crmLeadId } = req.params
    const { connectionId, updates } = req.body

    if (!connectionId || !updates) {
      return res.status(400).json({
        success: false,
        error: 'connectionId and updates are required'
      })
    }

    // Get CRM connection
    const connection = crmConnections.get(connectionId)
    if (!connection || connection.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'CRM connection not found or inactive'
      })
    }

    logger.info('Updating lead in CRM', { crmLeadId, provider: connection.provider })

    // Get CRM provider and update lead
    const crmProvider = getCRMProvider(connection.provider)
    const updatedLead = await crmProvider.updateLeadInCRM(connection.accessToken, crmLeadId, updates)

    res.json({
      success: true,
      updatedLead
    })
  } catch (error) {
    logger.error('Failed to update lead in CRM', { error: error.message, crmLeadId: req.params.crmLeadId })
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/crm/field-mappings/:provider
 * Get field mappings for CRM provider
 */
router.get('/field-mappings/:provider', (req, res) => {
  try {
    const { provider } = req.params

    const crmProvider = getCRMProvider(provider)
    const fieldMappings = crmProvider.getFieldMappings()

    res.json({
      success: true,
      provider,
      fieldMappings
    })
  } catch (error) {
    logger.error('Failed to get field mappings', { error: error.message, provider: req.params.provider })
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/crm/sync-queue
 * Get failed syncs in retry queue
 */
router.get('/sync-queue', (req, res) => {
  try {
    res.json({
      success: true,
      queue: syncQueue.map(item => ({
        ...item,
        accessToken: undefined, // Don't expose tokens
        refreshToken: undefined
      }))
    })
  } catch (error) {
    logger.error('Failed to get sync queue', { error: error.message })
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/crm/webhooks/:provider
 * Handle CRM webhooks
 */
router.post('/webhooks/:provider', async (req, res) => {
  try {
    const { provider } = req.params

    // Get CRM provider
    const crmProvider = getCRMProvider(provider)

    // Verify webhook signature
    if (!crmProvider.verifyWebhookSignature(req)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature'
      })
    }

    logger.info('Received CRM webhook', { provider, event: req.body.event || 'unknown' })

    // TODO: Process webhook events (contact updated, deal closed, etc.)
    // This would trigger bidirectional sync

    res.json({
      success: true,
      message: 'Webhook received'
    })
  } catch (error) {
    logger.error('Failed to process CRM webhook', { error: error.message, provider: req.params.provider })
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/crm/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'CRM Integration API',
    timestamp: new Date().toISOString(),
    stats: {
      activeConnections: Array.from(crmConnections.values()).filter(c => c.status === 'active').length,
      queuedSyncs: syncQueue.length
    }
  })
})

export default router
