/**
 * Billing and Payment Agent API Service
 *
 * Service for managing invoices, payments, and financial tracking
 * Integrates with payment gateways and provides billing automation
 */

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'https://drondoc.ru'

export const billingService = {
  /**
   * Create a new invoice
   * @param {Object} params - Invoice parameters
   * @param {string} params.leadId - Associated lead ID
   * @param {Array<Object>} params.items - Invoice line items
   * @param {Object} params.customer - Customer information
   * @param {string} params.currency - Currency code (USD, EUR, RUB, etc.)
   * @param {Object} params.settings - Invoice settings (dueDate, taxRate, etc.)
   * @returns {Promise<Object>} Created invoice
   */
  async createInvoice({ leadId, items, customer, currency = 'USD', settings = {} }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ leadId, items, customer, currency, settings })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to create invoice')
      }

      return response.json()
    } catch (error) {
      console.error('Create invoice error:', error)
      throw error
    }
  },

  /**
   * Get all invoices with optional filtering
   * @param {Object} params - Filter parameters
   * @param {string} params.status - Filter by status (draft, sent, paid, overdue, cancelled)
   * @param {string} params.customerId - Filter by customer
   * @param {string} params.startDate - Filter by date range start
   * @param {string} params.endDate - Filter by date range end
   * @returns {Promise<Object>} List of invoices
   */
  async getInvoices({ status, customerId, startDate, endDate } = {}) {
    try {
      const params = new URLSearchParams()
      if (status) params.append('status', status)
      if (customerId) params.append('customerId', customerId)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`${API_BASE_URL}/api/billing/invoices?${params}`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get invoices')
      }

      return response.json()
    } catch (error) {
      console.error('Get invoices error:', error)
      throw error
    }
  },

  /**
   * Get invoice by ID
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object>} Invoice details
   */
  async getInvoice(invoiceId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/invoices/${invoiceId}`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get invoice')
      }

      return response.json()
    } catch (error) {
      console.error('Get invoice error:', error)
      throw error
    }
  },

  /**
   * Update invoice
   * @param {string} invoiceId - Invoice ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated invoice
   */
  async updateInvoice(invoiceId, updates) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to update invoice')
      }

      return response.json()
    } catch (error) {
      console.error('Update invoice error:', error)
      throw error
    }
  },

  /**
   * Send invoice to customer
   * @param {string} invoiceId - Invoice ID
   * @param {Object} options - Send options (email, reminder, etc.)
   * @returns {Promise<Object>} Send result
   */
  async sendInvoice(invoiceId, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to send invoice')
      }

      return response.json()
    } catch (error) {
      console.error('Send invoice error:', error)
      throw error
    }
  },

  /**
   * Process payment for invoice
   * @param {Object} params - Payment parameters
   * @param {string} params.invoiceId - Invoice ID
   * @param {number} params.amount - Payment amount
   * @param {string} params.method - Payment method (card, bank_transfer, etc.)
   * @param {Object} params.gatewayData - Payment gateway specific data
   * @returns {Promise<Object>} Payment result
   */
  async processPayment({ invoiceId, amount, method, gatewayData = {} }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invoiceId, amount, method, gatewayData })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to process payment')
      }

      return response.json()
    } catch (error) {
      console.error('Process payment error:', error)
      throw error
    }
  },

  /**
   * Get payment history
   * @param {Object} params - Filter parameters
   * @param {string} params.invoiceId - Filter by invoice
   * @param {string} params.customerId - Filter by customer
   * @param {string} params.status - Filter by status
   * @returns {Promise<Object>} Payment history
   */
  async getPayments({ invoiceId, customerId, status } = {}) {
    try {
      const params = new URLSearchParams()
      if (invoiceId) params.append('invoiceId', invoiceId)
      if (customerId) params.append('customerId', customerId)
      if (status) params.append('status', status)

      const response = await fetch(`${API_BASE_URL}/api/billing/payments?${params}`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get payments')
      }

      return response.json()
    } catch (error) {
      console.error('Get payments error:', error)
      throw error
    }
  },

  /**
   * Process refund
   * @param {Object} params - Refund parameters
   * @param {string} params.paymentId - Payment ID
   * @param {number} params.amount - Refund amount (optional, defaults to full)
   * @param {string} params.reason - Refund reason
   * @returns {Promise<Object>} Refund result
   */
  async processRefund({ paymentId, amount, reason }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount, reason })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to process refund')
      }

      return response.json()
    } catch (error) {
      console.error('Process refund error:', error)
      throw error
    }
  },

  /**
   * Get financial dashboard statistics
   * @param {Object} params - Parameters
   * @param {string} params.period - Period (day, week, month, year, custom)
   * @param {string} params.startDate - Custom period start date
   * @param {string} params.endDate - Custom period end date
   * @returns {Promise<Object>} Financial statistics
   */
  async getFinancialStats({ period = 'month', startDate, endDate } = {}) {
    try {
      const params = new URLSearchParams({ period })
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`${API_BASE_URL}/api/billing/stats?${params}`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get financial stats')
      }

      return response.json()
    } catch (error) {
      console.error('Get financial stats error:', error)
      throw error
    }
  },

  /**
   * Get aging report (overdue invoices analysis)
   * @returns {Promise<Object>} Aging report
   */
  async getAgingReport() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/reports/aging`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get aging report')
      }

      return response.json()
    } catch (error) {
      console.error('Get aging report error:', error)
      throw error
    }
  },

  /**
   * Get revenue forecast
   * @param {Object} params - Parameters
   * @param {number} params.months - Number of months to forecast
   * @returns {Promise<Object>} Revenue forecast
   */
  async getRevenueForecast({ months = 3 } = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/reports/forecast?months=${months}`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get revenue forecast')
      }

      return response.json()
    } catch (error) {
      console.error('Get revenue forecast error:', error)
      throw error
    }
  },

  /**
   * Configure payment gateway
   * @param {Object} params - Gateway configuration
   * @param {string} params.gateway - Gateway name (stripe, paypal, square, etc.)
   * @param {Object} params.credentials - Gateway credentials
   * @param {Object} params.settings - Gateway settings
   * @returns {Promise<Object>} Configuration result
   */
  async configureGateway({ gateway, credentials, settings = {} }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/gateways/${gateway}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ credentials, settings })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to configure gateway')
      }

      return response.json()
    } catch (error) {
      console.error('Configure gateway error:', error)
      throw error
    }
  },

  /**
   * Get configured payment gateways
   * @returns {Promise<Object>} List of gateways
   */
  async getGateways() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/gateways`)

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get gateways')
      }

      return response.json()
    } catch (error) {
      console.error('Get gateways error:', error)
      throw error
    }
  },

  /**
   * Create payment plan for invoice
   * @param {Object} params - Payment plan parameters
   * @param {string} params.invoiceId - Invoice ID
   * @param {number} params.installments - Number of installments
   * @param {string} params.frequency - Frequency (weekly, monthly)
   * @param {string} params.startDate - First payment date
   * @returns {Promise<Object>} Payment plan
   */
  async createPaymentPlan({ invoiceId, installments, frequency = 'monthly', startDate }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/payment-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invoiceId, installments, frequency, startDate })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to create payment plan')
      }

      return response.json()
    } catch (error) {
      console.error('Create payment plan error:', error)
      throw error
    }
  },

  /**
   * Send payment reminder
   * @param {string} invoiceId - Invoice ID
   * @param {Object} options - Reminder options
   * @returns {Promise<Object>} Send result
   */
  async sendPaymentReminder(invoiceId, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/invoices/${invoiceId}/remind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to send reminder')
      }

      return response.json()
    } catch (error) {
      console.error('Send reminder error:', error)
      throw error
    }
  },

  /**
   * Health check
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/health`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return response.json()
    } catch (error) {
      console.error('Health check error:', error)
      throw error
    }
  }
}

export default billingService
