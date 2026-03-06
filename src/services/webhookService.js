/**
 * Webhook Service
 *
 * Client-side service for interacting with Webhook Manager API
 *
 * Issue: #2494
 */

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

/**
 * Create a new webhook
 *
 * @param {Object} webhook - Webhook configuration
 * @param {string} webhook.name - Webhook name
 * @param {string} webhook.url - Target URL
 * @param {Array<string>} webhook.events - Events to trigger on
 * @param {string} webhook.description - Description
 * @param {string} webhook.secret - Optional secret key
 * @returns {Promise<Object>} Created webhook
 */
export async function createWebhook(webhook) {
  const response = await fetch(`${API_BASE_URL}/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(webhook)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create webhook')
  }

  const result = await response.json()
  return result.data
}

/**
 * Get all webhooks for current user
 *
 * @returns {Promise<Array<Object>>} List of webhooks
 */
export async function listWebhooks() {
  const response = await fetch(`${API_BASE_URL}/webhooks`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch webhooks')
  }

  const result = await response.json()
  return result.data
}

/**
 * Get a specific webhook
 *
 * @param {string} webhookId - Webhook ID
 * @returns {Promise<Object>} Webhook
 */
export async function getWebhook(webhookId) {
  const response = await fetch(`${API_BASE_URL}/webhooks/${webhookId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error('Webhook not found')
  }

  const result = await response.json()
  return result.data
}

/**
 * Update a webhook
 *
 * @param {string} webhookId - Webhook ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated webhook
 */
export async function updateWebhook(webhookId, updates) {
  const response = await fetch(`${API_BASE_URL}/webhooks/${webhookId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update webhook')
  }

  const result = await response.json()
  return result.data
}

/**
 * Delete a webhook
 *
 * @param {string} webhookId - Webhook ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteWebhook(webhookId) {
  const response = await fetch(`${API_BASE_URL}/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to delete webhook')
  }

  return true
}

/**
 * Test a webhook
 *
 * @param {string} webhookId - Webhook ID
 * @param {string} eventType - Event type to test with
 * @returns {Promise<Object>} Test result
 */
export async function testWebhook(webhookId, eventType) {
  const response = await fetch(`${API_BASE_URL}/webhooks/${webhookId}/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ eventType })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to test webhook')
  }

  const result = await response.json()
  return result.data
}

/**
 * Trigger an event
 *
 * @param {string} eventType - Event type
 * @param {Object} payload - Event payload
 * @returns {Promise<Object>} Trigger result
 */
export async function triggerEvent(eventType, payload) {
  const response = await fetch(`${API_BASE_URL}/webhooks/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ eventType, payload })
  })

  if (!response.ok) {
    throw new Error('Failed to trigger event')
  }

  const result = await response.json()
  return result.data
}

/**
 * Get webhook delivery logs
 *
 * @param {string} webhookId - Webhook ID
 * @param {Object} options - Query options
 * @returns {Promise<Array<Object>>} Log entries
 */
export async function getWebhookLogs(webhookId, options = {}) {
  const { limit = 100, offset = 0, status } = options

  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString()
  })

  if (status) {
    params.append('status', status)
  }

  const response = await fetch(
    `${API_BASE_URL}/webhooks/${webhookId}/logs?${params}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    throw new Error('Failed to fetch webhook logs')
  }

  const result = await response.json()
  return result.data
}

/**
 * Get webhook statistics
 *
 * @param {string} webhookId - Webhook ID
 * @returns {Promise<Object>} Statistics
 */
export async function getWebhookStats(webhookId) {
  const response = await fetch(`${API_BASE_URL}/webhooks/${webhookId}/stats`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch webhook statistics')
  }

  const result = await response.json()
  return result.data
}

/**
 * Replay a webhook delivery
 *
 * @param {string} webhookId - Webhook ID
 * @param {string} logId - Log entry ID
 * @returns {Promise<Object>} Replay result
 */
export async function replayWebhook(webhookId, logId) {
  const response = await fetch(`${API_BASE_URL}/webhooks/${webhookId}/replay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ logId })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to replay webhook')
  }

  const result = await response.json()
  return result.data
}

export default {
  createWebhook,
  listWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  triggerEvent,
  getWebhookLogs,
  getWebhookStats,
  replayWebhook
}
