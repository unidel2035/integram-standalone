/**
 * Subscription Service
 *
 * Provides API integration for managing user agent subscriptions
 * Handles purchased agents, subscription management, usage tracking, and billing history
 *
 * Issue #4964 - "Мои агенты" page implementation
 */

import axios from 'axios'
import { logger } from '@/utils/logger'
import { getApiUrl } from '@/utils/apiConfig'

const API_BASE = getApiUrl('/api')

/**
 * Get all user's purchased/subscribed agents
 *
 * @param {string} accessToken - User's access token (JWT)
 * @returns {Promise<Array>} List of purchased agents with subscription details
 */
export async function getUserAgents(accessToken) {
  try {
    logger.info('Fetching user agents')

    const response = await axios.get(
      `${API_BASE}/subscriptions/my-agents`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch user agents')
    }

    const agents = response.data.data || []

    logger.info('User agents fetched', {
      count: agents.length
    })

    return agents
  } catch (error) {
    // If endpoint doesn't exist yet (404), return mock data for development
    if (error.response?.status === 404) {
      logger.warn('Subscriptions API not available, using mock data')
      return getMockUserAgents()
    }

    logger.error('Failed to fetch user agents', {
      error: error.message
    })
    throw new Error(error.response?.data?.error || error.message || 'Failed to fetch user agents')
  }
}

/**
 * Get single agent subscription details
 *
 * @param {string} agentId - Agent ID
 * @param {string} accessToken - User's access token (JWT)
 * @returns {Promise<Object>} Agent subscription details
 */
export async function getAgentSubscription(agentId, accessToken) {
  try {
    logger.info('Fetching agent subscription', { agentId })

    const response = await axios.get(
      `${API_BASE}/subscriptions/agents/${agentId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch agent subscription')
    }

    return response.data.data
  } catch (error) {
    logger.error('Failed to fetch agent subscription', {
      error: error.message,
      agentId
    })
    throw new Error(error.response?.data?.error || error.message || 'Failed to fetch agent subscription')
  }
}

/**
 * Cancel agent subscription
 *
 * @param {string} subscriptionId - Subscription ID
 * @param {string} accessToken - User's access token (JWT)
 * @param {Object} options - Cancellation options
 * @param {boolean} options.immediate - Cancel immediately or at period end
 * @param {string} options.reason - Reason for cancellation
 * @returns {Promise<Object>} Cancellation result
 */
export async function cancelSubscription(subscriptionId, accessToken, options = {}) {
  try {
    logger.info('Cancelling subscription', {
      subscriptionId,
      immediate: options.immediate
    })

    const response = await axios.post(
      `${API_BASE}/subscriptions/${subscriptionId}/cancel`,
      {
        immediate: options.immediate || false,
        reason: options.reason
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to cancel subscription')
    }

    logger.info('Subscription cancelled', { subscriptionId })

    return response.data.data
  } catch (error) {
    logger.error('Failed to cancel subscription', {
      error: error.message,
      subscriptionId
    })
    throw new Error(error.response?.data?.error || error.message || 'Failed to cancel subscription')
  }
}

/**
 * Renew/reactivate cancelled subscription
 *
 * @param {string} subscriptionId - Subscription ID
 * @param {string} accessToken - User's access token (JWT)
 * @returns {Promise<Object>} Renewal result
 */
export async function renewSubscription(subscriptionId, accessToken) {
  try {
    logger.info('Renewing subscription', { subscriptionId })

    const response = await axios.post(
      `${API_BASE}/subscriptions/${subscriptionId}/renew`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to renew subscription')
    }

    logger.info('Subscription renewed', { subscriptionId })

    return response.data.data
  } catch (error) {
    logger.error('Failed to renew subscription', {
      error: error.message,
      subscriptionId
    })
    throw new Error(error.response?.data?.error || error.message || 'Failed to renew subscription')
  }
}

/**
 * Get agent usage statistics
 *
 * @param {string} agentId - Agent ID
 * @param {string} accessToken - User's access token (JWT)
 * @param {Object} options - Query options
 * @param {string} options.period - Time period (day, week, month, all)
 * @param {string} options.startDate - Start date (ISO format)
 * @param {string} options.endDate - End date (ISO format)
 * @returns {Promise<Object>} Usage statistics
 */
export async function getAgentUsageStats(agentId, accessToken, options = {}) {
  try {
    logger.info('Fetching agent usage stats', { agentId })

    const params = new URLSearchParams()
    if (options.period) params.append('period', options.period)
    if (options.startDate) params.append('startDate', options.startDate)
    if (options.endDate) params.append('endDate', options.endDate)

    const response = await axios.get(
      `${API_BASE}/subscriptions/agents/${agentId}/usage?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch usage stats')
    }

    return response.data.data
  } catch (error) {
    logger.error('Failed to fetch agent usage stats', {
      error: error.message,
      agentId
    })
    throw new Error(error.response?.data?.error || error.message || 'Failed to fetch usage stats')
  }
}

/**
 * Get billing history for user's subscriptions
 *
 * @param {string} accessToken - User's access token (JWT)
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of records to fetch
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Object>} Billing history with invoices
 */
export async function getBillingHistory(accessToken, options = {}) {
  try {
    logger.info('Fetching billing history')

    const params = new URLSearchParams()
    if (options.limit) params.append('limit', options.limit)
    if (options.offset) params.append('offset', options.offset)

    const response = await axios.get(
      `${API_BASE}/subscriptions/billing-history?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch billing history')
    }

    return response.data.data
  } catch (error) {
    // Return mock data if endpoint not available
    if (error.response?.status === 404) {
      logger.warn('Billing history API not available, using mock data')
      return getMockBillingHistory()
    }

    logger.error('Failed to fetch billing history', {
      error: error.message
    })
    throw new Error(error.response?.data?.error || error.message || 'Failed to fetch billing history')
  }
}

/**
 * Download invoice PDF
 *
 * @param {string} invoiceId - Invoice ID
 * @param {string} accessToken - User's access token (JWT)
 * @returns {Promise<Blob>} Invoice PDF blob
 */
export async function downloadInvoice(invoiceId, accessToken) {
  try {
    logger.info('Downloading invoice', { invoiceId })

    const response = await axios.get(
      `${API_BASE}/subscriptions/invoices/${invoiceId}/pdf`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        responseType: 'blob'
      }
    )

    logger.info('Invoice downloaded', { invoiceId })

    return response.data
  } catch (error) {
    logger.error('Failed to download invoice', {
      error: error.message,
      invoiceId
    })
    throw new Error(error.response?.data?.error || error.message || 'Failed to download invoice')
  }
}

/**
 * Update payment method for subscription
 *
 * @param {string} subscriptionId - Subscription ID
 * @param {string} paymentMethodId - New payment method ID
 * @param {string} accessToken - User's access token (JWT)
 * @returns {Promise<Object>} Update result
 */
export async function updatePaymentMethod(subscriptionId, paymentMethodId, accessToken) {
  try {
    logger.info('Updating payment method', { subscriptionId })

    const response = await axios.put(
      `${API_BASE}/subscriptions/${subscriptionId}/payment-method`,
      {
        paymentMethodId
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update payment method')
    }

    logger.info('Payment method updated', { subscriptionId })

    return response.data.data
  } catch (error) {
    logger.error('Failed to update payment method', {
      error: error.message,
      subscriptionId
    })
    throw new Error(error.response?.data?.error || error.message || 'Failed to update payment method')
  }
}

/**
 * Mock data for development (when backend API is not ready)
 */
function getMockUserAgents() {
  return [
    {
      id: 'agent-1',
      name: 'Агент лидов',
      description: 'Квалификация и приоритизация потенциальных клиентов',
      icon: '🎯',
      category: 'sales',
      status: 'active',
      pricingModel: 'subscription',
      price: 29,
      activatedAt: '2025-01-01T10:00:00Z',
      nextBillingDate: '2025-02-01T10:00:00Z',
      subscriptionId: 'sub-1',
      usage: {
        totalExecutions: 156,
        lastUsed: '2025-01-14T15:30:00Z',
        avgExecutionTime: 2.3
      }
    },
    {
      id: 'agent-2',
      name: 'Агент биллинга',
      description: 'Автоматизация выставления счетов и отслеживание платежей',
      icon: '💳',
      category: 'business',
      status: 'active',
      pricingModel: 'subscription',
      price: 49,
      activatedAt: '2024-12-15T12:00:00Z',
      nextBillingDate: '2025-01-15T12:00:00Z',
      subscriptionId: 'sub-2',
      usage: {
        totalExecutions: 284,
        lastUsed: '2025-01-15T09:15:00Z',
        avgExecutionTime: 1.8
      }
    },
    {
      id: 'agent-3',
      name: 'Агент мониторинга',
      description: 'Отслеживание показателей и уведомления о проблемах',
      icon: '📊',
      category: 'analytics',
      status: 'trial',
      pricingModel: 'subscription',
      price: 19,
      activatedAt: '2025-01-10T14:00:00Z',
      trialEndsAt: '2025-01-25T14:00:00Z',
      subscriptionId: 'sub-3',
      usage: {
        totalExecutions: 42,
        lastUsed: '2025-01-15T10:45:00Z',
        avgExecutionTime: 0.5
      }
    }
  ]
}

function getMockBillingHistory() {
  return {
    invoices: [
      {
        id: 'inv-1',
        date: '2025-01-01T10:00:00Z',
        amount: 78,
        currency: 'USD',
        status: 'paid',
        description: 'Monthly subscription - Агент лидов, Агент биллинга',
        paidAt: '2025-01-01T10:05:00Z'
      },
      {
        id: 'inv-2',
        date: '2024-12-01T10:00:00Z',
        amount: 78,
        currency: 'USD',
        status: 'paid',
        description: 'Monthly subscription - Агент лидов, Агент биллинга',
        paidAt: '2024-12-01T10:03:00Z'
      },
      {
        id: 'inv-3',
        date: '2024-11-01T10:00:00Z',
        amount: 29,
        currency: 'USD',
        status: 'paid',
        description: 'Monthly subscription - Агент лидов',
        paidAt: '2024-11-01T10:07:00Z'
      }
    ],
    total: 3,
    totalPaid: 185,
    currency: 'USD'
  }
}

export default {
  getUserAgents,
  getAgentSubscription,
  cancelSubscription,
  renewSubscription,
  getAgentUsageStats,
  getBillingHistory,
  downloadInvoice,
  updatePaymentMethod
}
