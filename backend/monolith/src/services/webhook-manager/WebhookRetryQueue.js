/**
 * Webhook Retry Queue
 *
 * Implements retry logic with exponential backoff for failed webhook deliveries
 *
 * Issue: #2494
 */

import logger from '../../utils/logger.js'

export class WebhookRetryQueue {
  constructor(options = {}) {
    this.queue = []
    this.processing = false
    this.maxAttempts = options.maxAttempts || 3
    this.baseDelay = options.baseDelay || 60000 // 1 minute
    this.maxDelay = options.maxDelay || 3600000 // 1 hour
    this.processingInterval = null // Store interval ID for cleanup

    // Start processing queue
    this._startProcessing()

    logger.info('WebhookRetryQueue initialized', {
      maxAttempts: this.maxAttempts,
      baseDelay: this.baseDelay
    })
  }

  /**
   * Add webhook delivery to retry queue
   *
   * @param {Object} item - Retry item
   * @param {string} item.webhookId - Webhook ID
   * @param {string} item.eventType - Event type
   * @param {Object} item.payload - Event payload
   * @param {number} item.attempt - Current attempt number
   * @param {number} item.maxAttempts - Maximum retry attempts
   */
  async enqueue(item) {
    const retryItem = {
      ...item,
      id: this._generateId(),
      enqueuedAt: new Date().toISOString(),
      nextRetry: this._calculateNextRetry(item.attempt)
    }

    this.queue.push(retryItem)

    logger.info('Item added to retry queue', {
      webhookId: item.webhookId,
      attempt: item.attempt,
      nextRetry: retryItem.nextRetry
    })
  }

  /**
   * Get queue status
   *
   * @returns {Object} Queue statistics
   */
  getStatus() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      items: this.queue.map(item => ({
        webhookId: item.webhookId,
        attempt: item.attempt,
        nextRetry: item.nextRetry
      }))
    }
  }

  /**
   * Clear the retry queue
   */
  clear() {
    const count = this.queue.length
    this.queue = []
    logger.info('Retry queue cleared', { clearedItems: count })
  }

  /**
   * Cleanup and stop the retry queue
   * Clears the interval and empties the queue
   */
  cleanup() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
      logger.info('WebhookRetryQueue processing interval stopped')
    }
    this.clear()
  }

  /**
   * Start processing retry queue
   *
   * @private
   */
  _startProcessing() {
    this.processingInterval = setInterval(async () => {
      if (this.processing || this.queue.length === 0) {
        return
      }

      this.processing = true

      try {
        await this._processQueue()
      } catch (error) {
        logger.error('Error processing retry queue', { error: error.message })
      } finally {
        this.processing = false
      }
    }, 10000) // Check every 10 seconds
  }

  /**
   * Process items in retry queue
   *
   * @private
   */
  async _processQueue() {
    const now = new Date()
    const itemsToRetry = []
    const remainingItems = []

    for (const item of this.queue) {
      const nextRetry = new Date(item.nextRetry)

      if (now >= nextRetry) {
        itemsToRetry.push(item)
      } else {
        remainingItems.push(item)
      }
    }

    if (itemsToRetry.length === 0) {
      return
    }

    logger.info('Processing retry queue', {
      itemsToRetry: itemsToRetry.length,
      remainingItems: remainingItems.length
    })

    // Process each item
    for (const item of itemsToRetry) {
      try {
        await this._retryWebhook(item)
      } catch (error) {
        logger.error('Retry failed', {
          webhookId: item.webhookId,
          attempt: item.attempt,
          error: error.message
        })

        // Re-queue if under max attempts
        if (item.attempt < (item.maxAttempts || this.maxAttempts)) {
          remainingItems.push({
            ...item,
            attempt: item.attempt + 1,
            nextRetry: this._calculateNextRetry(item.attempt + 1)
          })
        } else {
          logger.warn('Max retry attempts reached, dropping item', {
            webhookId: item.webhookId,
            attempts: item.attempt
          })
        }
      }
    }

    this.queue = remainingItems
  }

  /**
   * Retry webhook delivery
   *
   * @private
   * @param {Object} item - Retry item
   */
  async _retryWebhook(item) {
    const { webhookId, eventType, payload } = item

    logger.info('Retrying webhook delivery', {
      webhookId,
      attempt: item.attempt
    })

    // Note: This would normally call the WebhookManager._deliverWebhook method
    // For now, we'll simulate the retry
    // In production, inject WebhookManager instance

    const response = await fetch(item.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Retry-Attempt': item.attempt.toString()
      },
      body: JSON.stringify(payload),
      timeout: 10000
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    logger.info('Webhook retry successful', {
      webhookId,
      attempt: item.attempt
    })
  }

  /**
   * Calculate next retry time with exponential backoff
   *
   * @private
   * @param {number} attempt - Attempt number
   * @returns {string} ISO timestamp for next retry
   */
  _calculateNextRetry(attempt) {
    // Exponential backoff: delay = baseDelay * (2 ^ (attempt - 1))
    const delay = Math.min(
      this.baseDelay * Math.pow(2, attempt - 1),
      this.maxDelay
    )

    const nextRetry = new Date(Date.now() + delay)
    return nextRetry.toISOString()
  }

  /**
   * Generate unique ID
   *
   * @private
   */
  _generateId() {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export default WebhookRetryQueue
