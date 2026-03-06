/**
 * Billing and Payment Agent Store
 *
 * Manages billing state including invoices, payments, and financial data
 */

import { defineStore } from 'pinia'
import billingService from '@/services/billingService'

export const useBillingStore = defineStore('billing', {
  state: () => ({
    invoices: [],
    payments: [],
    financialStats: null,
    agingReport: null,
    revenueForecast: null,
    gateways: [],
    loading: false,
    error: null
  }),

  getters: {
    /**
     * Get invoices by status
     */
    invoicesByStatus: (state) => (status) => {
      return state.invoices.filter(inv => inv.status === status)
    },

    /**
     * Get pending invoices (sent but not paid)
     */
    pendingInvoices: (state) => {
      return state.invoices.filter(inv => inv.status === 'sent')
    },

    /**
     * Get overdue invoices
     */
    overdueInvoices: (state) => {
      return state.invoices.filter(inv => inv.status === 'overdue')
    },

    /**
     * Get paid invoices
     */
    paidInvoices: (state) => {
      return state.invoices.filter(inv => inv.status === 'paid')
    },

    /**
     * Calculate total revenue
     */
    totalRevenue: (state) => {
      return state.invoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + (inv.total || 0), 0)
    },

    /**
     * Calculate outstanding amount (unpaid invoices)
     */
    outstandingAmount: (state) => {
      return state.invoices
        .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
        .reduce((sum, inv) => sum + (inv.total || 0), 0)
    },

    /**
     * Get payment success rate
     */
    paymentSuccessRate: (state) => {
      const total = state.payments.length
      if (total === 0) return 0
      const successful = state.payments.filter(p => p.status === 'completed').length
      return Math.round((successful / total) * 100)
    },

    /**
     * Get average invoice value
     */
    averageInvoiceValue: (state) => {
      if (state.invoices.length === 0) return 0
      const total = state.invoices.reduce((sum, inv) => sum + (inv.total || 0), 0)
      return Math.round(total / state.invoices.length)
    },

    /**
     * Get invoices count by status
     */
    invoicesCountByStatus: (state) => {
      const counts = {}
      state.invoices.forEach(inv => {
        counts[inv.status] = (counts[inv.status] || 0) + 1
      })
      return counts
    }
  },

  actions: {
    /**
     * Fetch all invoices
     */
    async fetchInvoices(filters = {}) {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.getInvoices(filters)
        this.invoices = result.invoices || []
        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Create new invoice
     */
    async createInvoice(invoiceData) {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.createInvoice(invoiceData)
        if (result.invoice) {
          this.invoices.push(result.invoice)
        }
        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Update invoice
     */
    async updateInvoice(invoiceId, updates) {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.updateInvoice(invoiceId, updates)

        if (result.invoice) {
          const index = this.invoices.findIndex(inv => inv.id === invoiceId)
          if (index !== -1) {
            this.invoices[index] = result.invoice
          }
        }

        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Send invoice to customer
     */
    async sendInvoice(invoiceId, options = {}) {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.sendInvoice(invoiceId, options)

        // Update invoice status to 'sent'
        const index = this.invoices.findIndex(inv => inv.id === invoiceId)
        if (index !== -1) {
          this.invoices[index].status = 'sent'
          this.invoices[index].sentAt = new Date().toISOString()
        }

        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Process payment
     */
    async processPayment(paymentData) {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.processPayment(paymentData)

        if (result.payment) {
          this.payments.push(result.payment)

          // Update invoice status to 'paid' if fully paid
          const index = this.invoices.findIndex(inv => inv.id === paymentData.invoiceId)
          if (index !== -1 && result.invoice) {
            this.invoices[index] = result.invoice
          }
        }

        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Fetch payment history
     */
    async fetchPayments(filters = {}) {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.getPayments(filters)
        this.payments = result.payments || []
        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Process refund
     */
    async processRefund(refundData) {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.processRefund(refundData)

        if (result.refund) {
          // Update payment status
          const paymentIndex = this.payments.findIndex(p => p.id === refundData.paymentId)
          if (paymentIndex !== -1) {
            this.payments[paymentIndex].status = 'refunded'
            this.payments[paymentIndex].refundedAt = new Date().toISOString()
          }
        }

        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Fetch financial statistics
     */
    async fetchFinancialStats(params = {}) {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.getFinancialStats(params)
        this.financialStats = result.stats || null
        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Fetch aging report
     */
    async fetchAgingReport() {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.getAgingReport()
        this.agingReport = result.report || null
        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Fetch revenue forecast
     */
    async fetchRevenueForecast(params = {}) {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.getRevenueForecast(params)
        this.revenueForecast = result.forecast || null
        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Fetch payment gateways
     */
    async fetchGateways() {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.getGateways()
        this.gateways = result.gateways || []
        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Configure payment gateway
     */
    async configureGateway(gatewayData) {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.configureGateway(gatewayData)

        // Update or add gateway in list
        const index = this.gateways.findIndex(g => g.name === gatewayData.gateway)
        if (index !== -1) {
          this.gateways[index] = result.gateway
        } else {
          this.gateways.push(result.gateway)
        }

        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Create payment plan
     */
    async createPaymentPlan(planData) {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.createPaymentPlan(planData)

        // Update invoice with payment plan
        const index = this.invoices.findIndex(inv => inv.id === planData.invoiceId)
        if (index !== -1 && result.invoice) {
          this.invoices[index] = result.invoice
        }

        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Send payment reminder
     */
    async sendPaymentReminder(invoiceId, options = {}) {
      this.loading = true
      this.error = null

      try {
        const result = await billingService.sendPaymentReminder(invoiceId, options)

        // Update invoice last reminder date
        const index = this.invoices.findIndex(inv => inv.id === invoiceId)
        if (index !== -1) {
          this.invoices[index].lastReminderAt = new Date().toISOString()
        }

        return result
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Clear store data
     */
    clearData() {
      this.invoices = []
      this.payments = []
      this.financialStats = null
      this.agingReport = null
      this.revenueForecast = null
      this.gateways = []
      this.loading = false
      this.error = null
    }
  }
})
