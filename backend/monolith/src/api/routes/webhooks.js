/**
 * Webhook Manager API Routes
 *
 * Provides API endpoints for webhook management:
 * - CRUD operations for webhooks
 * - Webhook delivery and triggering
 * - Receiving webhooks from external systems
 * - Replay functionality
 * - Statistics and logs
 *
 * Issue: #2494
 */

import express from 'express'
import WebhookManager from '../../services/webhook-manager/WebhookManager.js'
import logger from '../../utils/logger.js'

const router = express.Router()

// Initialize webhook manager (singleton)
let webhookManager

function getWebhookManager() {
  if (!webhookManager) {
    webhookManager = new WebhookManager()
    logger.info('WebhookManager instance created')
  }
  return webhookManager
}

/**
 * Create a new webhook
 * POST /api/webhooks
 *
 * Body: { name, url, events, description, secret? }
 */
router.post('/', async (req, res) => {
  try {
    const { name, url, events, description, secret } = req.body
    const userId = req.session?.userId || 'default-user'

    if (!name || !url || !events || !events.length) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, url, events'
      })
    }

    const manager = getWebhookManager()
    const webhook = await manager.registerWebhook({
      name,
      url,
      events,
      description,
      secret,
      userId
    })

    res.status(201).json({
      success: true,
      data: webhook
    })
  } catch (error) {
    logger.error('Failed to create webhook', { error: error.message })
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create webhook'
    })
  }
})

/**
 * Get all webhooks for current user
 * GET /api/webhooks
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.session?.userId || 'default-user'

    const manager = getWebhookManager()
    const webhooks = await manager.listWebhooks(userId)

    res.json({
      success: true,
      data: webhooks
    })
  } catch (error) {
    logger.error('Failed to list webhooks', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve webhooks'
    })
  }
})

/**
 * Get a specific webhook
 * GET /api/webhooks/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const manager = getWebhookManager()
    const webhook = await manager.getWebhook(id)

    res.json({
      success: true,
      data: webhook
    })
  } catch (error) {
    logger.error('Failed to get webhook', { error: error.message })
    res.status(404).json({
      success: false,
      error: error.message || 'Webhook not found'
    })
  }
})

/**
 * Update a webhook
 * PUT /api/webhooks/:id
 *
 * Body: { name?, url?, events?, description?, status? }
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const manager = getWebhookManager()
    const webhook = await manager.updateWebhook(id, updates)

    res.json({
      success: true,
      data: webhook
    })
  } catch (error) {
    logger.error('Failed to update webhook', { error: error.message })
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update webhook'
    })
  }
})

/**
 * Delete a webhook
 * DELETE /api/webhooks/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const manager = getWebhookManager()
    await manager.deleteWebhook(id)

    res.json({
      success: true,
      data: {
        id,
        deleted: true
      }
    })
  } catch (error) {
    logger.error('Failed to delete webhook', { error: error.message })
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete webhook'
    })
  }
})

/**
 * Trigger an event (send to all matching webhooks)
 * POST /api/webhooks/trigger
 *
 * Body: { eventType, payload }
 */
router.post('/trigger', async (req, res) => {
  try {
    const { eventType, payload } = req.body
    const userId = req.session?.userId || 'default-user'

    if (!eventType) {
      return res.status(400).json({
        success: false,
        error: 'eventType is required'
      })
    }

    const manager = getWebhookManager()
    const results = await manager.triggerEvent(eventType, payload, userId)

    res.json({
      success: true,
      data: {
        eventType,
        deliveries: results.length,
        results
      }
    })
  } catch (error) {
    logger.error('Failed to trigger event', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to trigger event'
    })
  }
})

/**
 * Test a webhook by sending a test event
 * POST /api/webhooks/:id/test
 *
 * Body: { eventType }
 */
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params
    const { eventType } = req.body

    const manager = getWebhookManager()
    const webhook = await manager.getWebhook(id)

    if (!webhook.events.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: 'Webhook does not listen to this event type'
      })
    }

    const testPayload = {
      test: true,
      message: 'This is a test webhook event',
      timestamp: new Date().toISOString()
    }

    const results = await manager.triggerEvent(eventType, testPayload, webhook.userId)

    res.json({
      success: true,
      data: {
        tested: true,
        eventType,
        results
      }
    })
  } catch (error) {
    logger.error('Failed to test webhook', { error: error.message })
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test webhook'
    })
  }
})

/**
 * Get webhook delivery logs
 * GET /api/webhooks/:id/logs
 *
 * Query params: limit, offset, status
 */
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params
    const { limit = 100, offset = 0, status } = req.query

    const manager = getWebhookManager()
    const logs = await manager.getWebhookLogs(id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      status
    })

    res.json({
      success: true,
      data: logs
    })
  } catch (error) {
    logger.error('Failed to get webhook logs', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logs'
    })
  }
})

/**
 * Get webhook statistics
 * GET /api/webhooks/:id/stats
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params

    const manager = getWebhookManager()
    const stats = await manager.getWebhookStats(id)

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('Failed to get webhook stats', { error: error.message })
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve statistics'
    })
  }
})

/**
 * Replay a webhook delivery
 * POST /api/webhooks/:id/replay
 *
 * Body: { logId }
 */
router.post('/:id/replay', async (req, res) => {
  try {
    const { id } = req.params
    const { logId } = req.body

    if (!logId) {
      return res.status(400).json({
        success: false,
        error: 'logId is required'
      })
    }

    const manager = getWebhookManager()
    const result = await manager.replayWebhook(id, logId)

    res.json({
      success: true,
      data: {
        replayed: true,
        logId,
        result
      }
    })
  } catch (error) {
    logger.error('Failed to replay webhook', { error: error.message })
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to replay webhook'
    })
  }
})

/**
 * Receive webhook from external system
 * POST /api/webhooks/receive/:provider
 *
 * This endpoint receives webhooks from external services (GitHub, Stripe, etc.)
 */
router.post('/receive/:provider', async (req, res) => {
  try {
    const { provider } = req.params

    const manager = getWebhookManager()
    const result = await manager.receiveWebhook({
      body: req.body,
      headers: req.headers,
      ip: req.ip
    }, provider)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('Webhook receive failed', {
      provider: req.params.provider,
      error: error.message
    })

    if (error.message === 'Rate limit exceeded') {
      return res.status(429).json({
        success: false,
        error: 'Too many requests'
      })
    }

    if (error.message === 'Invalid signature') {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      })
    }

    res.status(500).json({
      success: false,
      error: 'Failed to process webhook'
    })
  }
})

/**
 * Register a webhook handler for incoming webhooks
 * POST /api/webhooks/handlers/:provider
 *
 * Body: { handlerUrl }
 * This is an admin endpoint to configure handlers
 */
router.post('/handlers/:provider', async (req, res) => {
  try {
    const { provider } = req.params
    const { handlerUrl } = req.body

    // In production, this would be protected by admin auth
    // For now, just acknowledge

    res.json({
      success: true,
      data: {
        provider,
        handlerUrl,
        registered: true
      }
    })
  } catch (error) {
    logger.error('Failed to register handler', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to register handler'
    })
  }
})

export default router
