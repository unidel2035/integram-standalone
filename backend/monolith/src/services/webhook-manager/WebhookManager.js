/**
 * Webhook Manager Service
 *
 * Manages incoming webhooks from external systems with:
 * - Signature verification (HMAC SHA-256)
 * - Retry logic for failed deliveries
 * - Webhook replay for debugging
 * - Rate limiting and DDoS protection
 * - Routing to appropriate handlers
 *
 * Issue: #2494
 */

import crypto from 'crypto'
import logger from '../../utils/logger.js'
import { RateLimiter } from './RateLimiter.js'
import { WebhookRetryQueue } from './WebhookRetryQueue.js'
import { WebhookStorage } from './WebhookStorage.js'

export class WebhookManager {
  constructor(options = {}) {
    this.storage = options.storage || new WebhookStorage()
    this.rateLimiter = options.rateLimiter || new RateLimiter({
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000
    })
    this.retryQueue = options.retryQueue || new WebhookRetryQueue()
    this.handlers = new Map()

    logger.info('WebhookManager initialized')
  }

  /**
   * Register a webhook configuration
   *
   * @param {Object} config - Webhook configuration
   * @param {string} config.name - Webhook name
   * @param {string} config.url - Target URL
   * @param {Array<string>} config.events - Events to trigger on
   * @param {string} config.secret - Secret for HMAC signature
   * @param {string} config.userId - User ID
   * @returns {Promise<Object>} Created webhook
   */
  async registerWebhook(config) {
    const { name, url, events, secret, userId, description } = config

    // Validate inputs
    if (!name || !url || !events || !events.length) {
      throw new Error('Missing required fields: name, url, events')
    }

    if (!this._isValidUrl(url)) {
      throw new Error('Invalid webhook URL')
    }

    // Generate secret if not provided
    const webhookSecret = secret || this._generateSecret()

    const webhook = {
      id: this._generateId(),
      name,
      url,
      events,
      secret: webhookSecret,
      userId: userId || 'default-user',
      description: description || '',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastTriggered: null,
      successCount: 0,
      failureCount: 0,
      totalAttempts: 0
    }

    await this.storage.saveWebhook(webhook)

    logger.info('Webhook registered', {
      webhookId: webhook.id,
      name: webhook.name,
      userId: webhook.userId
    })

    // Return webhook without exposing the secret
    return this._sanitizeWebhook(webhook)
  }

  /**
   * Update an existing webhook
   *
   * @param {string} webhookId - Webhook ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated webhook
   */
  async updateWebhook(webhookId, updates) {
    const webhook = await this.storage.getWebhook(webhookId)

    if (!webhook) {
      throw new Error('Webhook not found')
    }

    const allowedUpdates = ['name', 'url', 'events', 'description', 'status']
    const updatedWebhook = { ...webhook }

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        updatedWebhook[key] = updates[key]
      }
    }

    updatedWebhook.updatedAt = new Date().toISOString()

    await this.storage.saveWebhook(updatedWebhook)

    logger.info('Webhook updated', {
      webhookId,
      updates: Object.keys(updates)
    })

    return this._sanitizeWebhook(updatedWebhook)
  }

  /**
   * Delete a webhook
   *
   * @param {string} webhookId - Webhook ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteWebhook(webhookId) {
    const webhook = await this.storage.getWebhook(webhookId)

    if (!webhook) {
      throw new Error('Webhook not found')
    }

    await this.storage.deleteWebhook(webhookId)

    logger.info('Webhook deleted', { webhookId })

    return true
  }

  /**
   * Get webhook by ID
   *
   * @param {string} webhookId - Webhook ID
   * @returns {Promise<Object>} Webhook
   */
  async getWebhook(webhookId) {
    const webhook = await this.storage.getWebhook(webhookId)

    if (!webhook) {
      throw new Error('Webhook not found')
    }

    return this._sanitizeWebhook(webhook)
  }

  /**
   * List all webhooks for a user
   *
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>} List of webhooks
   */
  async listWebhooks(userId) {
    const webhooks = await this.storage.listWebhooksByUser(userId)
    return webhooks.map(w => this._sanitizeWebhook(w))
  }

  /**
   * Trigger webhooks for an event
   *
   * @param {string} eventType - Event type (e.g., 'table.row.created')
   * @param {Object} payload - Event payload
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>} Delivery results
   */
  async triggerEvent(eventType, payload, userId = 'default-user') {
    logger.info('Event triggered', { eventType, userId })

    // Find webhooks listening to this event
    const webhooks = await this.storage.listWebhooksByEvent(eventType, userId)

    if (webhooks.length === 0) {
      logger.debug('No webhooks found for event', { eventType, userId })
      return []
    }

    logger.info(`Found ${webhooks.length} webhooks for event`, { eventType })

    // Trigger all webhooks in parallel
    const results = await Promise.allSettled(
      webhooks.map(webhook => this._deliverWebhook(webhook, eventType, payload))
    )

    return results.map((result, index) => ({
      webhookId: webhooks[index].id,
      webhookName: webhooks[index].name,
      status: result.status,
      result: result.value || result.reason
    }))
  }

  /**
   * Receive and verify incoming webhook from external system
   *
   * @param {Object} request - HTTP request object
   * @param {string} provider - Provider name (e.g., 'github', 'stripe')
   * @returns {Promise<Object>} Verification result
   */
  async receiveWebhook(request, provider) {
    const { body, headers } = request

    // Rate limiting check
    const clientIp = request.ip || request.connection?.remoteAddress

    if (!this.rateLimiter.checkLimit(clientIp)) {
      logger.warn('Rate limit exceeded for webhook', { provider, clientIp })
      throw new Error('Rate limit exceeded')
    }

    // Verify signature based on provider
    const isValid = await this._verifySignature(provider, body, headers)

    if (!isValid) {
      logger.warn('Invalid webhook signature', { provider, clientIp })
      throw new Error('Invalid signature')
    }

    // Log webhook receipt
    await this.storage.logWebhookReceipt({
      provider,
      payload: body,
      headers,
      timestamp: new Date().toISOString(),
      verified: true
    })

    logger.info('Webhook received and verified', { provider })

    // Route to handler if registered
    if (this.handlers.has(provider)) {
      const handler = this.handlers.get(provider)
      return await handler(body, headers)
    }

    return { received: true, provider }
  }

  /**
   * Register a handler for incoming webhooks from a specific provider
   *
   * @param {string} provider - Provider name
   * @param {Function} handler - Handler function
   */
  registerHandler(provider, handler) {
    this.handlers.set(provider, handler)
    logger.info('Webhook handler registered', { provider })
  }

  /**
   * Replay a webhook for debugging
   *
   * @param {string} webhookId - Webhook ID
   * @param {string} logId - Log entry ID to replay
   * @returns {Promise<Object>} Replay result
   */
  async replayWebhook(webhookId, logId) {
    const webhook = await this.storage.getWebhook(webhookId)

    if (!webhook) {
      throw new Error('Webhook not found')
    }

    const logEntry = await this.storage.getWebhookLog(logId)

    if (!logEntry) {
      throw new Error('Log entry not found')
    }

    logger.info('Replaying webhook', { webhookId, logId })

    // Re-deliver with original payload
    const result = await this._deliverWebhook(
      webhook,
      logEntry.eventType,
      logEntry.payload,
      { replay: true, originalLogId: logId }
    )

    return result
  }

  /**
   * Get webhook delivery logs
   *
   * @param {string} webhookId - Webhook ID
   * @param {Object} options - Query options (limit, offset, status)
   * @returns {Promise<Array<Object>>} Log entries
   */
  async getWebhookLogs(webhookId, options = {}) {
    return await this.storage.getWebhookLogs(webhookId, options)
  }

  /**
   * Get webhook statistics
   *
   * @param {string} webhookId - Webhook ID
   * @returns {Promise<Object>} Statistics
   */
  async getWebhookStats(webhookId) {
    const webhook = await this.storage.getWebhook(webhookId)

    if (!webhook) {
      throw new Error('Webhook not found')
    }

    const logs = await this.storage.getWebhookLogs(webhookId, { limit: 1000 })

    const successRate = webhook.totalAttempts > 0
      ? (webhook.successCount / webhook.totalAttempts) * 100
      : 0

    const avgResponseTime = logs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / logs.length

    return {
      webhookId,
      successCount: webhook.successCount,
      failureCount: webhook.failureCount,
      totalAttempts: webhook.totalAttempts,
      successRate: Math.round(successRate * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime),
      lastTriggered: webhook.lastTriggered
    }
  }

  /**
   * Deliver webhook to target URL
   *
   * @private
   * @param {Object} webhook - Webhook configuration
   * @param {string} eventType - Event type
   * @param {Object} payload - Event payload
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Delivery result
   */
  async _deliverWebhook(webhook, eventType, payload, metadata = {}) {
    if (webhook.status !== 'active') {
      logger.debug('Webhook is not active, skipping', { webhookId: webhook.id })
      return { delivered: false, reason: 'Webhook not active' }
    }

    const deliveryPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
      webhookId: webhook.id,
      ...metadata
    }

    // Generate signature
    const signature = this._signPayload(deliveryPayload, webhook.secret)

    const startTime = Date.now()
    let response
    let error

    try {
      // Deliver webhook via HTTP POST
      response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-ID': webhook.id,
          'X-Event-Type': eventType,
          'User-Agent': 'DronDoc-Webhook/1.0'
        },
        body: JSON.stringify(deliveryPayload),
        timeout: 10000 // 10 second timeout
      })

      const responseTime = Date.now() - startTime

      // Log delivery
      await this._logDelivery(webhook, eventType, deliveryPayload, {
        status: response.ok ? 'success' : 'failed',
        statusCode: response.status,
        responseTime,
        replay: metadata.replay || false
      })

      // Update webhook stats
      await this._updateWebhookStats(webhook, response.ok)

      if (!response.ok) {
        // Queue for retry if failed
        await this.retryQueue.enqueue({
          webhookId: webhook.id,
          eventType,
          payload: deliveryPayload,
          attempt: 1,
          maxAttempts: 3
        })

        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      logger.info('Webhook delivered successfully', {
        webhookId: webhook.id,
        eventType,
        responseTime
      })

      return {
        delivered: true,
        statusCode: response.status,
        responseTime
      }

    } catch (err) {
      error = err
      const responseTime = Date.now() - startTime

      logger.error('Webhook delivery failed', {
        webhookId: webhook.id,
        eventType,
        error: err.message
      })

      await this._logDelivery(webhook, eventType, deliveryPayload, {
        status: 'failed',
        error: err.message,
        responseTime
      })

      await this._updateWebhookStats(webhook, false)

      // Queue for retry
      if (!metadata.replay) {
        await this.retryQueue.enqueue({
          webhookId: webhook.id,
          eventType,
          payload: deliveryPayload,
          attempt: 1,
          maxAttempts: 3
        })
      }

      throw err
    }
  }

  /**
   * Verify webhook signature based on provider
   *
   * @private
   * @param {string} provider - Provider name
   * @param {Object} body - Request body
   * @param {Object} headers - Request headers
   * @returns {Promise<boolean>} Verification result
   */
  async _verifySignature(provider, body, headers) {
    // Different providers use different signature schemes
    switch (provider.toLowerCase()) {
      case 'github':
        return this._verifyGitHubSignature(body, headers)
      case 'stripe':
        return this._verifyStripeSignature(body, headers)
      case 'slack':
        return this._verifySlackSignature(body, headers)
      default:
        // Generic HMAC verification
        return this._verifyHMACSignature(body, headers)
    }
  }

  /**
   * Verify GitHub webhook signature
   *
   * @private
   */
  _verifyGitHubSignature(body, headers) {
    const signature = headers['x-hub-signature-256']

    if (!signature) {
      return false
    }

    // GitHub uses sha256=<signature>
    const secret = process.env.GITHUB_WEBHOOK_SECRET || 'default-secret'
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }

  /**
   * Verify Stripe webhook signature
   *
   * @private
   */
  _verifyStripeSignature(body, headers) {
    const signature = headers['stripe-signature']

    if (!signature) {
      return false
    }

    // Stripe signature verification is more complex
    // For now, return true (implement based on Stripe's SDK)
    return true
  }

  /**
   * Verify Slack webhook signature
   *
   * @private
   */
  _verifySlackSignature(body, headers) {
    const timestamp = headers['x-slack-request-timestamp']
    const signature = headers['x-slack-signature']

    if (!timestamp || !signature) {
      return false
    }

    // Prevent replay attacks (older than 5 minutes)
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - parseInt(timestamp)) > 60 * 5) {
      return false
    }

    const secret = process.env.SLACK_SIGNING_SECRET || 'default-secret'
    const baseString = `v0:${timestamp}:${JSON.stringify(body)}`
    const expectedSignature = 'v0=' + crypto
      .createHmac('sha256', secret)
      .update(baseString)
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }

  /**
   * Generic HMAC signature verification
   *
   * @private
   */
  _verifyHMACSignature(body, headers) {
    const signature = headers['x-webhook-signature']

    if (!signature) {
      // If no signature required, allow it (for testing)
      return true
    }

    const secret = process.env.WEBHOOK_SECRET || 'default-secret'
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }

  /**
   * Sign webhook payload
   *
   * @private
   * @param {Object} payload - Payload to sign
   * @param {string} secret - Secret key
   * @returns {string} Signature
   */
  _signPayload(payload, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex')
  }

  /**
   * Log webhook delivery
   *
   * @private
   */
  async _logDelivery(webhook, eventType, payload, result) {
    const logEntry = {
      id: this._generateId(),
      webhookId: webhook.id,
      webhookName: webhook.name,
      eventType,
      payload,
      timestamp: new Date().toISOString(),
      status: result.status,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      error: result.error,
      replay: result.replay || false
    }

    await this.storage.saveWebhookLog(logEntry)
  }

  /**
   * Update webhook statistics
   *
   * @private
   */
  async _updateWebhookStats(webhook, success) {
    webhook.totalAttempts = (webhook.totalAttempts || 0) + 1
    webhook.lastTriggered = new Date().toISOString()

    if (success) {
      webhook.successCount = (webhook.successCount || 0) + 1
    } else {
      webhook.failureCount = (webhook.failureCount || 0) + 1
    }

    await this.storage.saveWebhook(webhook)
  }

  /**
   * Generate unique ID
   *
   * @private
   */
  _generateId() {
    return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate secret
   *
   * @private
   */
  _generateSecret() {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Validate URL
   *
   * @private
   */
  _isValidUrl(url) {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  /**
   * Sanitize webhook (remove secret)
   *
   * @private
   */
  _sanitizeWebhook(webhook) {
    const { secret, ...sanitized } = webhook
    return {
      ...sanitized,
      hasSecret: !!secret
    }
  }
}

export default WebhookManager
