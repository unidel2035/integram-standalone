/**
 * Webhook Storage
 *
 * Handles persistent storage of webhooks and logs using local files
 * (Can be replaced with database implementation later)
 *
 * Issue: #2494
 */

import fs from 'fs/promises'
import path from 'path'
import logger from '../../utils/logger.js'

export class WebhookStorage {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'webhooks')
    this.webhooksFile = path.join(this.dataDir, 'webhooks.json')
    this.logsFile = path.join(this.dataDir, 'webhook-logs.json')
    this.receiptsFile = path.join(this.dataDir, 'webhook-receipts.json')

    this._ensureDataDir()

    logger.info('WebhookStorage initialized', { dataDir: this.dataDir })
  }

  /**
   * Save webhook configuration
   *
   * @param {Object} webhook - Webhook object
   */
  async saveWebhook(webhook) {
    const webhooks = await this._loadWebhooks()
    const index = webhooks.findIndex(w => w.id === webhook.id)

    if (index >= 0) {
      webhooks[index] = webhook
    } else {
      webhooks.push(webhook)
    }

    await this._saveWebhooks(webhooks)

    logger.debug('Webhook saved', { webhookId: webhook.id })
  }

  /**
   * Get webhook by ID
   *
   * @param {string} webhookId - Webhook ID
   * @returns {Promise<Object|null>} Webhook object or null
   */
  async getWebhook(webhookId) {
    const webhooks = await this._loadWebhooks()
    return webhooks.find(w => w.id === webhookId) || null
  }

  /**
   * Delete webhook
   *
   * @param {string} webhookId - Webhook ID
   */
  async deleteWebhook(webhookId) {
    const webhooks = await this._loadWebhooks()
    const filtered = webhooks.filter(w => w.id !== webhookId)

    await this._saveWebhooks(filtered)

    logger.debug('Webhook deleted', { webhookId })
  }

  /**
   * List webhooks by user
   *
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>} List of webhooks
   */
  async listWebhooksByUser(userId) {
    const webhooks = await this._loadWebhooks()
    return webhooks.filter(w => w.userId === userId)
  }

  /**
   * List webhooks listening to a specific event
   *
   * @param {string} eventType - Event type
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Array<Object>>} List of webhooks
   */
  async listWebhooksByEvent(eventType, userId = null) {
    const webhooks = await this._loadWebhooks()

    return webhooks.filter(w => {
      const matchesEvent = w.events.includes(eventType)
      const matchesUser = userId ? w.userId === userId : true
      const isActive = w.status === 'active'

      return matchesEvent && matchesUser && isActive
    })
  }

  /**
   * Save webhook delivery log
   *
   * @param {Object} logEntry - Log entry
   */
  async saveWebhookLog(logEntry) {
    const logs = await this._loadLogs()
    logs.unshift(logEntry) // Add to beginning

    // Keep only last 10000 logs
    if (logs.length > 10000) {
      logs.splice(10000)
    }

    await this._saveLogs(logs)

    logger.debug('Webhook log saved', {
      webhookId: logEntry.webhookId,
      status: logEntry.status
    })
  }

  /**
   * Get webhook logs
   *
   * @param {string} webhookId - Webhook ID
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} Log entries
   */
  async getWebhookLogs(webhookId, options = {}) {
    const { limit = 100, offset = 0, status = null } = options

    const logs = await this._loadLogs()

    let filtered = logs.filter(log => log.webhookId === webhookId)

    if (status) {
      filtered = filtered.filter(log => log.status === status)
    }

    return filtered.slice(offset, offset + limit)
  }

  /**
   * Get single webhook log entry
   *
   * @param {string} logId - Log ID
   * @returns {Promise<Object|null>} Log entry or null
   */
  async getWebhookLog(logId) {
    const logs = await this._loadLogs()
    return logs.find(log => log.id === logId) || null
  }

  /**
   * Log incoming webhook receipt
   *
   * @param {Object} receipt - Receipt data
   */
  async logWebhookReceipt(receipt) {
    const receipts = await this._loadReceipts()
    receipts.unshift(receipt)

    // Keep only last 5000 receipts
    if (receipts.length > 5000) {
      receipts.splice(5000)
    }

    await this._saveReceipts(receipts)

    logger.debug('Webhook receipt logged', {
      provider: receipt.provider
    })
  }

  /**
   * Get webhook receipts
   *
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} Receipt entries
   */
  async getWebhookReceipts(options = {}) {
    const { limit = 100, offset = 0, provider = null } = options

    const receipts = await this._loadReceipts()

    let filtered = receipts

    if (provider) {
      filtered = filtered.filter(r => r.provider === provider)
    }

    return filtered.slice(offset, offset + limit)
  }

  /**
   * Ensure data directory exists
   *
   * @private
   */
  async _ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true })
    } catch (error) {
      logger.error('Failed to create data directory', {
        dataDir: this.dataDir,
        error: error.message
      })
    }
  }

  /**
   * Load webhooks from file
   *
   * @private
   * @returns {Promise<Array<Object>>} Webhooks array
   */
  async _loadWebhooks() {
    try {
      const data = await fs.readFile(this.webhooksFile, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  /**
   * Save webhooks to file
   *
   * @private
   * @param {Array<Object>} webhooks - Webhooks array
   */
  async _saveWebhooks(webhooks) {
    await fs.writeFile(
      this.webhooksFile,
      JSON.stringify(webhooks, null, 2),
      'utf-8'
    )
  }

  /**
   * Load logs from file
   *
   * @private
   * @returns {Promise<Array<Object>>} Logs array
   */
  async _loadLogs() {
    try {
      const data = await fs.readFile(this.logsFile, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  /**
   * Save logs to file
   *
   * @private
   * @param {Array<Object>} logs - Logs array
   */
  async _saveLogs(logs) {
    await fs.writeFile(
      this.logsFile,
      JSON.stringify(logs, null, 2),
      'utf-8'
    )
  }

  /**
   * Load receipts from file
   *
   * @private
   * @returns {Promise<Array<Object>>} Receipts array
   */
  async _loadReceipts() {
    try {
      const data = await fs.readFile(this.receiptsFile, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  /**
   * Save receipts to file
   *
   * @private
   * @param {Array<Object>} receipts - Receipts array
   */
  async _saveReceipts(receipts) {
    await fs.writeFile(
      this.receiptsFile,
      JSON.stringify(receipts, null, 2),
      'utf-8'
    )
  }
}

export default WebhookStorage
