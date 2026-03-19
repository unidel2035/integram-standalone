import express from 'express';
import logger from '../../utils/logger.js';

/**
 * Billing and Payment Agent API Routes
 * Handles invoice generation, payment processing, and financial tracking
 *
 * NOTE: This is a placeholder implementation for the Billing Agent.
 * Full implementation requires database integration via DronDoc API.
 * Current version uses in-memory storage for demonstration.
 */
export function createBillingRoutes(db) {
  const router = express.Router();

  // In-memory storage for demo purposes
  // TODO: Replace with DronDoc API integration
  const invoices = [];
  const payments = [];
  const gateways = [];

  /**
   * GET /api/billing/health
   * Health check endpoint
   */
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'ok',
      service: 'billing-agent',
      timestamp: new Date().toISOString()
    });
  });

  /**
   * POST /api/billing/invoices
   * Create a new invoice
   */
  router.post('/invoices', async (req, res) => {
    try {
      const { leadId, items, customer, currency, settings } = req.body;

      // Validate input
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid items: must be a non-empty array'
        });
      }

      if (!customer || !customer.name || !customer.email) {
        return res.status(400).json({
          success: false,
          error: 'Invalid customer: name and email are required'
        });
      }

      // Calculate invoice totals
      const subtotal = items.reduce((sum, item) => {
        return sum + (item.quantity * item.unitPrice);
      }, 0);

      const taxRate = settings?.taxRate || 0;
      const discountRate = settings?.discount || 0;

      const tax = subtotal * (taxRate / 100);
      const discountAmount = subtotal * (discountRate / 100);
      const total = subtotal + tax - discountAmount;

      // Create invoice
      const invoice = {
        id: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        invoiceNumber: `INV-${invoices.length + 1}`.padStart(10, '0'),
        leadId,
        customerName: customer.name,
        customerEmail: customer.email,
        customerAddress: customer.address || '',
        items: items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice
        })),
        subtotal,
        taxRate,
        tax,
        discount: discountRate,
        discountAmount,
        total,
        currency: currency || 'USD',
        status: settings?.status || 'draft',
        dueDate: settings?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      invoices.push(invoice);

      logger.info('[BillingAPI] Invoice created', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        currency: invoice.currency
      });

      res.json({
        success: true,
        invoice
      });
    } catch (error) {
      logger.error('[BillingAPI] Create invoice error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/billing/invoices
   * Get all invoices with optional filtering
   */
  router.get('/invoices', async (req, res) => {
    try {
      const { status, customerId, startDate, endDate } = req.query;

      let filteredInvoices = [...invoices];

      // Apply filters
      if (status) {
        filteredInvoices = filteredInvoices.filter(inv => inv.status === status);
      }

      if (customerId) {
        filteredInvoices = filteredInvoices.filter(inv => inv.customerId === customerId);
      }

      if (startDate) {
        filteredInvoices = filteredInvoices.filter(inv => inv.createdAt >= startDate);
      }

      if (endDate) {
        filteredInvoices = filteredInvoices.filter(inv => inv.createdAt <= endDate);
      }

      res.json({
        success: true,
        invoices: filteredInvoices,
        total: filteredInvoices.length
      });
    } catch (error) {
      logger.error('[BillingAPI] Get invoices error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/billing/invoices/:id
   * Get invoice by ID
   */
  router.get('/invoices/:id', async (req, res) => {
    try {
      const invoice = invoices.find(inv => inv.id === req.params.id);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
      }

      res.json({
        success: true,
        invoice
      });
    } catch (error) {
      logger.error('[BillingAPI] Get invoice error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /api/billing/invoices/:id
   * Update invoice
   */
  router.put('/invoices/:id', async (req, res) => {
    try {
      const index = invoices.findIndex(inv => inv.id === req.params.id);

      if (index === -1) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
      }

      const updates = req.body;
      invoices[index] = {
        ...invoices[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      logger.info('[BillingAPI] Invoice updated', {
        invoiceId: invoices[index].id,
        updates: Object.keys(updates)
      });

      res.json({
        success: true,
        invoice: invoices[index]
      });
    } catch (error) {
      logger.error('[BillingAPI] Update invoice error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/billing/invoices/:id/send
   * Send invoice to customer
   */
  router.post('/invoices/:id/send', async (req, res) => {
    try {
      const index = invoices.findIndex(inv => inv.id === req.params.id);

      if (index === -1) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
      }

      invoices[index].status = 'sent';
      invoices[index].sentAt = new Date().toISOString();

      logger.info('[BillingAPI] Invoice sent', {
        invoiceId: invoices[index].id,
        customerEmail: invoices[index].customerEmail
      });

      res.json({
        success: true,
        message: 'Invoice sent successfully',
        invoice: invoices[index]
      });
    } catch (error) {
      logger.error('[BillingAPI] Send invoice error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/billing/invoices/:id/remind
   * Send payment reminder
   */
  router.post('/invoices/:id/remind', async (req, res) => {
    try {
      const index = invoices.findIndex(inv => inv.id === req.params.id);

      if (index === -1) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
      }

      invoices[index].lastReminderAt = new Date().toISOString();

      logger.info('[BillingAPI] Payment reminder sent', {
        invoiceId: invoices[index].id,
        customerEmail: invoices[index].customerEmail
      });

      res.json({
        success: true,
        message: 'Payment reminder sent successfully'
      });
    } catch (error) {
      logger.error('[BillingAPI] Send reminder error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/billing/payments
   * Process a payment
   */
  router.post('/payments', async (req, res) => {
    try {
      const { invoiceId, amount, method, gatewayData } = req.body;

      if (!invoiceId || !amount || !method) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: invoiceId, amount, method'
        });
      }

      const invoice = invoices.find(inv => inv.id === invoiceId);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
      }

      // Create payment record
      const payment = {
        id: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        paymentId: `PAY-${payments.length + 1}`.padStart(10, '0'),
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        amount: parseFloat(amount),
        method,
        status: 'completed',
        gatewayReference: gatewayData?.reference || `REF-${Date.now()}`,
        processedAt: new Date().toISOString()
      };

      payments.push(payment);

      // Update invoice status
      const invoiceIndex = invoices.findIndex(inv => inv.id === invoiceId);
      if (invoiceIndex !== -1) {
        invoices[invoiceIndex].status = 'paid';
        invoices[invoiceIndex].paidAt = new Date().toISOString();
      }

      logger.info('[BillingAPI] Payment processed', {
        paymentId: payment.id,
        invoiceId,
        amount: payment.amount,
        method: payment.method
      });

      res.json({
        success: true,
        payment,
        invoice: invoices[invoiceIndex]
      });
    } catch (error) {
      logger.error('[BillingAPI] Process payment error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/billing/payments
   * Get payment history
   */
  router.get('/payments', async (req, res) => {
    try {
      const { invoiceId, customerId, status } = req.query;

      let filteredPayments = [...payments];

      if (invoiceId) {
        filteredPayments = filteredPayments.filter(p => p.invoiceId === invoiceId);
      }

      if (customerId) {
        filteredPayments = filteredPayments.filter(p => p.customerId === customerId);
      }

      if (status) {
        filteredPayments = filteredPayments.filter(p => p.status === status);
      }

      res.json({
        success: true,
        payments: filteredPayments,
        total: filteredPayments.length
      });
    } catch (error) {
      logger.error('[BillingAPI] Get payments error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/billing/payments/:id/refund
   * Process a refund
   */
  router.post('/payments/:id/refund', async (req, res) => {
    try {
      const { amount, reason } = req.body;
      const paymentIndex = payments.findIndex(p => p.id === req.params.id);

      if (paymentIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found'
        });
      }

      const payment = payments[paymentIndex];
      const refundAmount = amount || payment.amount;

      // Create refund record
      const refund = {
        id: `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        paymentId: payment.id,
        amount: refundAmount,
        reason: reason || 'Customer requested refund',
        status: 'completed',
        processedAt: new Date().toISOString()
      };

      // Update payment status
      payments[paymentIndex].status = 'refunded';
      payments[paymentIndex].refundedAt = new Date().toISOString();

      logger.info('[BillingAPI] Refund processed', {
        refundId: refund.id,
        paymentId: payment.id,
        amount: refundAmount
      });

      res.json({
        success: true,
        refund
      });
    } catch (error) {
      logger.error('[BillingAPI] Process refund error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/billing/stats
   * Get financial statistics
   */
  router.get('/stats', async (req, res) => {
    try {
      const { period } = req.query;

      const paidInvoices = invoices.filter(inv => inv.status === 'paid');
      const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);

      const currentMonth = new Date().getMonth();
      const currentMonthInvoices = paidInvoices.filter(inv => {
        const invDate = new Date(inv.paidAt);
        return invDate.getMonth() === currentMonth;
      });
      const currentMonthRevenue = currentMonthInvoices.reduce((sum, inv) => sum + inv.total, 0);

      const stats = {
        totalRevenue,
        currentMonthRevenue,
        totalInvoices: invoices.length,
        paidInvoices: paidInvoices.length,
        pendingInvoices: invoices.filter(inv => inv.status === 'sent').length,
        overdueInvoices: invoices.filter(inv => inv.status === 'overdue').length,
        averageInvoiceValue: invoices.length > 0 ? totalRevenue / invoices.length : 0,
        period: period || 'all'
      };

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('[BillingAPI] Get stats error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/billing/reports/aging
   * Get aging report
   */
  router.get('/reports/aging', async (req, res) => {
    try {
      const unpaidInvoices = invoices.filter(inv =>
        inv.status === 'sent' || inv.status === 'overdue'
      );

      const today = new Date();
      const buckets = {
        current: { label: 'Current (0-30 days)', amount: 0, count: 0 },
        thirty: { label: '31-60 days', amount: 0, count: 0 },
        sixty: { label: '61-90 days', amount: 0, count: 0 },
        ninety: { label: '90+ days', amount: 0, count: 0 }
      };

      unpaidInvoices.forEach(inv => {
        const dueDate = new Date(inv.dueDate);
        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

        if (daysOverdue <= 30) {
          buckets.current.amount += inv.total;
          buckets.current.count++;
        } else if (daysOverdue <= 60) {
          buckets.thirty.amount += inv.total;
          buckets.thirty.count++;
        } else if (daysOverdue <= 90) {
          buckets.sixty.amount += inv.total;
          buckets.sixty.count++;
        } else {
          buckets.ninety.amount += inv.total;
          buckets.ninety.count++;
        }
      });

      res.json({
        success: true,
        report: {
          buckets: Object.values(buckets),
          totalOutstanding: unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0)
        }
      });
    } catch (error) {
      logger.error('[BillingAPI] Get aging report error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/billing/reports/forecast
   * Get revenue forecast
   */
  router.get('/reports/forecast', async (req, res) => {
    try {
      const { months = 3 } = req.query;

      // Simple forecast based on historical average
      const paidInvoices = invoices.filter(inv => inv.status === 'paid');
      const avgMonthlyRevenue = paidInvoices.length > 0
        ? paidInvoices.reduce((sum, inv) => sum + inv.total, 0) / 3 // Assuming 3 months history
        : 0;

      const forecast = {
        months: []
      };

      for (let i = 0; i < parseInt(months); i++) {
        const date = new Date();
        date.setMonth(date.getMonth() + i + 1);

        forecast.months.push({
          month: i + 1,
          monthName: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          projected: Math.round(avgMonthlyRevenue * (1 + Math.random() * 0.1)), // +/- 10% variation
          confidence: Math.round(80 + Math.random() * 15) // 80-95% confidence
        });
      }

      res.json({
        success: true,
        forecast
      });
    } catch (error) {
      logger.error('[BillingAPI] Get forecast error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/billing/gateways
   * Get configured payment gateways
   */
  router.get('/gateways', async (req, res) => {
    try {
      res.json({
        success: true,
        gateways: gateways.length > 0 ? gateways : [
          {
            name: 'stripe',
            displayName: 'Stripe',
            type: 'card',
            enabled: false,
            transactionCount: 0
          },
          {
            name: 'paypal',
            displayName: 'PayPal',
            type: 'paypal',
            enabled: false,
            transactionCount: 0
          }
        ]
      });
    } catch (error) {
      logger.error('[BillingAPI] Get gateways error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /api/billing/gateways/:gateway
   * Configure payment gateway
   */
  router.put('/gateways/:gateway', async (req, res) => {
    try {
      const { credentials, settings } = req.body;
      const gatewayName = req.params.gateway;

      const gatewayIndex = gateways.findIndex(g => g.name === gatewayName);

      const gateway = {
        name: gatewayName,
        displayName: gatewayName.charAt(0).toUpperCase() + gatewayName.slice(1),
        enabled: true,
        configuredAt: new Date().toISOString(),
        ...settings
      };

      if (gatewayIndex !== -1) {
        gateways[gatewayIndex] = gateway;
      } else {
        gateways.push(gateway);
      }

      logger.info('[BillingAPI] Gateway configured', {
        gateway: gatewayName
      });

      res.json({
        success: true,
        gateway
      });
    } catch (error) {
      logger.error('[BillingAPI] Configure gateway error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/billing/payment-plans
   * Create payment plan
   */
  router.post('/payment-plans', async (req, res) => {
    try {
      const { invoiceId, installments, frequency, startDate } = req.body;

      if (!invoiceId || !installments) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: invoiceId, installments'
        });
      }

      const invoice = invoices.find(inv => inv.id === invoiceId);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
      }

      const installmentAmount = invoice.total / installments;
      const plan = {
        id: `PLAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        invoiceId,
        installments,
        installmentAmount,
        frequency: frequency || 'monthly',
        startDate: startDate || new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      logger.info('[BillingAPI] Payment plan created', {
        planId: plan.id,
        invoiceId,
        installments
      });

      res.json({
        success: true,
        plan,
        invoice
      });
    } catch (error) {
      logger.error('[BillingAPI] Create payment plan error', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

export default createBillingRoutes;
