// billingService.js - Invoice generation and payment processing service
// Phase 3: Payment Integration - Issue #2785
// Handles invoice generation, payment processing, and balance updates

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import UsageTrackingService from './usageTrackingService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Data directory paths
const DATA_DIR = path.join(__dirname, '../../../../data/payments')
const INVOICES_FILE = path.join(DATA_DIR, 'invoices.json')
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json')
const PAYMENT_METHODS_FILE = path.join(DATA_DIR, 'payment_methods.json')

export class BillingService {
  constructor(config = {}) {
    this.db = config.db // PostgreSQL connection
    this.usageTrackingService = config.usageTrackingService || new UsageTrackingService({ db: this.db })
    this.paymentProvider = config.paymentProvider // Payment provider service (Stripe, etc.)
    this.initialized = false
  }

  /**
   * Initialize service - ensure data directory and files exist
   */
  async initialize() {
    if (this.initialized) return

    try {
      await fs.mkdir(DATA_DIR, { recursive: true })

      // Initialize invoices.json if not exists
      try {
        await fs.access(INVOICES_FILE)
      } catch {
        await fs.writeFile(INVOICES_FILE, JSON.stringify({ invoices: {} }, null, 2))
      }

      // Initialize payments.json if not exists
      try {
        await fs.access(PAYMENTS_FILE)
      } catch {
        await fs.writeFile(PAYMENTS_FILE, JSON.stringify({ payments: {} }, null, 2))
      }

      // Initialize payment_methods.json if not exists
      try {
        await fs.access(PAYMENT_METHODS_FILE)
      } catch {
        await fs.writeFile(PAYMENT_METHODS_FILE, JSON.stringify({ methods: {} }, null, 2))
      }

      await this.usageTrackingService.initialize()
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize BillingService:', error)
      throw error
    }
  }

  /**
   * Generate invoice for a user for a specific period
   * @param {string} userId - User ID
   * @param {string} period - Period in format YYYY-MM
   * @param {Object} options - Options (e.g., taxRate)
   * @returns {Promise<Object>} Generated invoice
   */
  async generateInvoice(userId, period, options = {}) {
    await this.initialize()

    const { taxRate = 0.10 } = options // 10% tax by default

    // Get usage data for the period
    const startDate = new Date(`${period}-01T00:00:00Z`)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)
    endDate.setSeconds(endDate.getSeconds() - 1)

    const usageData = await this.usageTrackingService.aggregateUsage(
      userId,
      startDate,
      endDate
    )

    // Build invoice items from usage data
    const items = []
    for (const [provider, data] of Object.entries(usageData.byModel || {})) {
      if (data.tokens > 0) {
        items.push({
          description: `AI Token Usage - ${provider}`,
          tokens: data.tokens,
          cost: data.cost,
          currency: 'USD'
        })
      }
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.cost, 0)
    const tax = subtotal * taxRate
    const total = subtotal + tax

    // Create invoice
    const invoice = {
      id: `inv_${crypto.randomUUID().replace(/-/g, '')}`,
      userId,
      period,
      items,
      subtotal,
      tax,
      total,
      currency: 'USD',
      status: 'pending',
      generatedAt: new Date().toISOString(),
      dueDate: this._calculateDueDate(15) // 15 days from now
    }

    // Save invoice
    await this._saveInvoice(invoice)

    return invoice
  }

  /**
   * Get all invoices for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options (status, limit, offset)
   * @returns {Promise<Array>} User's invoices
   */
  async getInvoicesByUser(userId, options = {}) {
    await this.initialize()

    const { status, limit, offset = 0 } = options
    const invoicesData = await this._readInvoices()

    let invoices = Object.values(invoicesData.invoices)
      .filter(inv => inv.userId === userId)

    if (status) {
      invoices = invoices.filter(inv => inv.status === status)
    }

    // Sort by generated date (most recent first)
    invoices.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))

    if (limit) {
      invoices = invoices.slice(offset, offset + limit)
    }

    return invoices
  }

  /**
   * Get invoice by ID
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object|null>} Invoice or null if not found
   */
  async getInvoiceById(invoiceId) {
    await this.initialize()

    const invoicesData = await this._readInvoices()
    return invoicesData.invoices[invoiceId] || null
  }

  /**
   * Process payment for an invoice
   * @param {string} invoiceId - Invoice ID
   * @param {string} paymentMethod - Payment method (card, crypto, balance)
   * @param {Object} paymentDetails - Payment details
   * @returns {Promise<Object>} Payment result
   */
  async processPayment(invoiceId, paymentMethod, paymentDetails) {
    await this.initialize()

    // Get invoice
    const invoice = await this.getInvoiceById(invoiceId)
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`)
    }

    if (invoice.status !== 'pending') {
      throw new Error(`Invoice is not pending. Current status: ${invoice.status}`)
    }

    // Process payment based on method
    let paymentResult
    try {
      switch (paymentMethod) {
        case 'credit_card':
        case 'card':
          paymentResult = await this._processCreditCardPayment(invoice, paymentDetails)
          break

        case 'crypto':
          paymentResult = await this._processCryptoPayment(invoice, paymentDetails)
          break

        case 'balance':
          paymentResult = await this._processBalancePayment(invoice, paymentDetails)
          break

        default:
          throw new Error(`Unsupported payment method: ${paymentMethod}`)
      }

      // Create payment record
      const payment = {
        id: `pay_${crypto.randomUUID().replace(/-/g, '')}`,
        invoiceId,
        userId: invoice.userId,
        amount: invoice.total,
        currency: invoice.currency,
        method: paymentMethod,
        status: 'completed',
        transactionId: paymentResult.transactionId,
        processedAt: new Date().toISOString(),
        metadata: paymentResult.metadata || {}
      }

      // Save payment
      await this._savePayment(payment)

      // Update invoice status
      invoice.status = 'paid'
      invoice.paidAt = payment.processedAt
      invoice.paymentId = payment.id
      await this._updateInvoice(invoice)

      // Update token balance for user
      await this.updateTokenBalance(invoice.userId, invoice.total * 1000) // Convert USD to tokens

      return {
        success: true,
        payment,
        invoice
      }
    } catch (error) {
      // Create failed payment record
      const payment = {
        id: `pay_${crypto.randomUUID().replace(/-/g, '')}`,
        invoiceId,
        userId: invoice.userId,
        amount: invoice.total,
        currency: invoice.currency,
        method: paymentMethod,
        status: 'failed',
        errorMessage: error.message,
        processedAt: new Date().toISOString(),
        metadata: {}
      }

      await this._savePayment(payment)

      throw error
    }
  }

  /**
   * Update token balance after successful payment
   * @param {string} userId - User ID (or token ID)
   * @param {number} amount - Amount to add to balance
   * @returns {Promise<void>}
   */
  async updateTokenBalance(userId, amount) {
    await this.initialize()

    if (!this.db) {
      console.warn('No database connection. Token balance not updated.')
      return
    }

    try {
      // Update token balance in database
      await this.db.query(`
        UPDATE ai_access_tokens
        SET token_balance = token_balance + $1
        WHERE user_id = $2
      `, [amount, userId])
    } catch (error) {
      console.error('Error updating token balance:', error)
      throw error
    }
  }

  /**
   * Get payment history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Payment history
   */
  async getPaymentHistory(userId, options = {}) {
    await this.initialize()

    const { status, limit, offset = 0 } = options
    const paymentsData = await this._readPayments()

    let payments = Object.values(paymentsData.payments)
      .filter(pay => pay.userId === userId)

    if (status) {
      payments = payments.filter(pay => pay.status === status)
    }

    // Sort by processed date (most recent first)
    payments.sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt))

    if (limit) {
      payments = payments.slice(offset, offset + limit)
    }

    return payments
  }

  /**
   * Refund a payment
   * @param {string} paymentId - Payment ID
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Refund result
   */
  async refundPayment(paymentId, reason = 'Requested by user') {
    await this.initialize()

    const paymentsData = await this._readPayments()
    const payment = paymentsData.payments[paymentId]

    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`)
    }

    if (payment.status !== 'completed') {
      throw new Error(`Payment cannot be refunded. Status: ${payment.status}`)
    }

    // Process refund with payment provider
    if (this.paymentProvider && payment.transactionId) {
      await this.paymentProvider.refund(payment.transactionId, payment.amount)
    }

    // Update payment status
    payment.status = 'refunded'
    payment.refundedAt = new Date().toISOString()
    payment.refundReason = reason

    await this._updatePayment(payment)

    // Update invoice status
    const invoice = await this.getInvoiceById(payment.invoiceId)
    if (invoice) {
      invoice.status = 'refunded'
      invoice.refundedAt = payment.refundedAt
      await this._updateInvoice(invoice)
    }

    // Deduct tokens from balance
    await this.updateTokenBalance(payment.userId, -payment.amount * 1000)

    return {
      success: true,
      payment
    }
  }

  /**
   * Add payment method for a user
   * @param {string} userId - User ID
   * @param {string} type - Payment method type
   * @param {Object} details - Payment method details
   * @returns {Promise<Object>} Payment method
   */
  async addPaymentMethod(userId, type, details) {
    await this.initialize()

    const paymentMethod = {
      id: `pm_${crypto.randomUUID().replace(/-/g, '')}`,
      userId,
      type,
      details: this._sanitizePaymentDetails(details), // Remove sensitive data
      createdAt: new Date().toISOString(),
      isDefault: false
    }

    await this._savePaymentMethod(paymentMethod)

    return paymentMethod
  }

  /**
   * Get payment methods for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Payment methods
   */
  async getPaymentMethods(userId) {
    await this.initialize()

    const methodsData = await this._readPaymentMethods()
    return Object.values(methodsData.methods).filter(pm => pm.userId === userId)
  }

  /**
   * Delete payment method
   * @param {string} methodId - Payment method ID
   * @returns {Promise<void>}
   */
  async deletePaymentMethod(methodId) {
    await this.initialize()

    const methodsData = await this._readPaymentMethods()
    if (methodsData.methods[methodId]) {
      delete methodsData.methods[methodId]
      await this._writePaymentMethods(methodsData)
    }
  }

  // ==================== Private Methods ====================

  /**
   * Process credit card payment
   * @private
   */
  async _processCreditCardPayment(invoice, paymentDetails) {
    if (this.paymentProvider) {
      return await this.paymentProvider.processCardPayment(invoice, paymentDetails)
    }

    // Mock payment processing for development
    return {
      transactionId: `txn_mock_${crypto.randomUUID()}`,
      metadata: {
        last4: paymentDetails.cardNumber?.slice(-4) || '4242',
        brand: 'Visa'
      }
    }
  }

  /**
   * Process cryptocurrency payment
   * @private
   */
  async _processCryptoPayment(invoice, paymentDetails) {
    if (this.paymentProvider) {
      return await this.paymentProvider.processCryptoPayment(invoice, paymentDetails)
    }

    // Mock payment processing
    return {
      transactionId: `crypto_${crypto.randomUUID()}`,
      metadata: {
        currency: paymentDetails.currency || 'BTC',
        walletAddress: paymentDetails.walletAddress
      }
    }
  }

  /**
   * Process account balance payment
   * @private
   */
  async _processBalancePayment(invoice, paymentDetails) {
    // Verify user has sufficient balance
    // This would check against account balance in a real system
    return {
      transactionId: `balance_${crypto.randomUUID()}`,
      metadata: {
        deductedFrom: 'account_balance'
      }
    }
  }

  /**
   * Calculate due date
   * @private
   */
  _calculateDueDate(daysFromNow) {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + daysFromNow)
    return dueDate.toISOString()
  }

  /**
   * Sanitize payment details to remove sensitive information
   * @private
   */
  _sanitizePaymentDetails(details) {
    const sanitized = { ...details }

    // Remove full card numbers, CVV, etc.
    if (sanitized.cardNumber) {
      sanitized.last4 = sanitized.cardNumber.slice(-4)
      delete sanitized.cardNumber
    }
    delete sanitized.cvv
    delete sanitized.pin

    return sanitized
  }

  // ==================== File I/O Methods ====================

  async _readInvoices() {
    try {
      const data = await fs.readFile(INVOICES_FILE, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      console.error('Error reading invoices:', error)
      return { invoices: {} }
    }
  }

  async _writeInvoices(data) {
    await fs.writeFile(INVOICES_FILE, JSON.stringify(data, null, 2))
  }

  async _saveInvoice(invoice) {
    const data = await this._readInvoices()
    data.invoices[invoice.id] = invoice
    await this._writeInvoices(data)
  }

  async _updateInvoice(invoice) {
    await this._saveInvoice(invoice)
  }

  async _readPayments() {
    try {
      const data = await fs.readFile(PAYMENTS_FILE, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      console.error('Error reading payments:', error)
      return { payments: {} }
    }
  }

  async _writePayments(data) {
    await fs.writeFile(PAYMENTS_FILE, JSON.stringify(data, null, 2))
  }

  async _savePayment(payment) {
    const data = await this._readPayments()
    data.payments[payment.id] = payment
    await this._writePayments(data)
  }

  async _updatePayment(payment) {
    await this._savePayment(payment)
  }

  async _readPaymentMethods() {
    try {
      const data = await fs.readFile(PAYMENT_METHODS_FILE, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      console.error('Error reading payment methods:', error)
      return { methods: {} }
    }
  }

  async _writePaymentMethods(data) {
    await fs.writeFile(PAYMENT_METHODS_FILE, JSON.stringify(data, null, 2))
  }

  async _savePaymentMethod(method) {
    const data = await this._readPaymentMethods()
    data.methods[method.id] = method
    await this._writePaymentMethods(data)
  }
}

export default BillingService
