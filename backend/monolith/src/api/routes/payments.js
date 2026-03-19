import express from 'express';
import { PaymentService } from '../../services/payments/PaymentService.js';
import { SubscriptionService } from '../../services/payments/SubscriptionService.js';
import UsageTrackingService from '../../services/user-sync/usageTrackingService.js';
import BillingService from '../../services/user-sync/billingService.js';
import PaymentProviderService from '../../services/user-sync/paymentProviderService.js';
import logger from '../../utils/logger.js';

/**
 * Payment API Routes
 * Handles payment processing, subscriptions, and billing
 */
export function createPaymentRoutes(db) {
  const router = express.Router();
  const paymentService = new PaymentService(db);
  const subscriptionService = new SubscriptionService(db, paymentService);

  // Phase 3: AI Token Usage Tracking and Billing Services
  const usageTrackingService = new UsageTrackingService({ db });
  const paymentProvider = new PaymentProviderService({
    provider: 'stripe',
    apiKey: process.env.STRIPE_API_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  });
  const billingService = new BillingService({
    db,
    usageTrackingService,
    paymentProvider
  });

  /**
   * GET /api/payments/plans
   * Get all subscription plans
   */
  router.get('/plans', async (req, res) => {
    try {
      const plans = await subscriptionService.getPlans();
      res.json({ success: true, data: plans });
    } catch (error) {
      logger.error('[PaymentAPI] Get plans error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/payments/plans/:slug
   * Get subscription plan by slug
   */
  router.get('/plans/:slug', async (req, res) => {
    try {
      const plan = await subscriptionService.getPlanBySlug(req.params.slug);
      res.json({ success: true, data: plan });
    } catch (error) {
      logger.error('[PaymentAPI] Get plan error', { slug: req.params.slug, error: error.message });
      res.status(404).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/payments/create
   * Create a new payment
   * Body: {
   *   userId, amount, currency, description,
   *   provider, paymentMethod, subscriptionId, metadata
   * }
   */
  router.post('/create', async (req, res) => {
    try {
      const {
        userId,
        amount,
        currency = 'RUB',
        description,
        provider,
        paymentMethod,
        subscriptionId,
        metadata = {}
      } = req.body;

      // Validate required fields
      if (!userId || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, amount'
        });
      }

      const payment = await paymentService.createPayment({
        userId,
        amount: parseFloat(amount),
        currency,
        description,
        provider,
        paymentMethod,
        subscriptionId,
        metadata: {
          ...metadata,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }
      });

      res.json({ success: true, data: payment });
    } catch (error) {
      logger.error('[PaymentAPI] Create payment error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/payments/status/:transactionId
   * Check payment status
   */
  router.get('/status/:transactionId', async (req, res) => {
    try {
      const status = await paymentService.checkPaymentStatus(req.params.transactionId);
      res.json({ success: true, data: status });
    } catch (error) {
      logger.error('[PaymentAPI] Check status error', {
        transactionId: req.params.transactionId,
        error: error.message
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/payments/user/:userId/transactions
   * Get user's payment transactions
   * Query params: limit, offset, status
   */
  router.get('/user/:userId/transactions', async (req, res) => {
    try {
      const { limit, offset, status } = req.query;
      const transactions = await paymentService.getUserTransactions(
        req.params.userId,
        {
          limit: parseInt(limit) || 50,
          offset: parseInt(offset) || 0,
          status
        }
      );

      res.json({ success: true, data: transactions });
    } catch (error) {
      logger.error('[PaymentAPI] Get transactions error', {
        userId: req.params.userId,
        error: error.message
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/payments/user/:userId/balance
   * Get user's balance
   * Query param: currency (default: RUB)
   */
  router.get('/user/:userId/balance', async (req, res) => {
    try {
      const currency = req.query.currency || 'RUB';
      const balance = await paymentService.getUserBalance(req.params.userId, currency);

      res.json({ success: true, data: { balance, currency } });
    } catch (error) {
      logger.error('[PaymentAPI] Get balance error', {
        userId: req.params.userId,
        error: error.message
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/payments/refund
   * Create a refund
   * Body: { transactionId, amount, reason }
   */
  router.post('/refund', async (req, res) => {
    try {
      const { transactionId, amount, reason } = req.body;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: transactionId'
        });
      }

      const refund = await paymentService.createRefund(
        transactionId,
        amount ? parseFloat(amount) : null,
        reason
      );

      res.json({ success: true, data: refund });
    } catch (error) {
      logger.error('[PaymentAPI] Create refund error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/payments/webhooks/:provider
   * Handle payment provider webhooks
   */
  router.post('/webhooks/:provider', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const provider = req.params.provider;
      const signature = req.headers['stripe-signature'] || req.headers['x-yookassa-signature'];

      await paymentService.processWebhook(provider, req.body, signature);

      res.json({ success: true });
    } catch (error) {
      logger.error('[PaymentAPI] Webhook error', {
        provider: req.params.provider,
        error: error.message
      });
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // ========== Subscription Routes ==========

  /**
   * POST /api/payments/subscriptions/create
   * Create a subscription
   * Body: { userId, planSlug, billingCycle, paymentMethod, trialDays, autoRenew }
   */
  router.post('/subscriptions/create', async (req, res) => {
    try {
      const {
        userId,
        planSlug,
        billingCycle = 'monthly',
        paymentMethod = 'card',
        trialDays = 0,
        autoRenew = true
      } = req.body;

      if (!userId || !planSlug) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, planSlug'
        });
      }

      const subscription = await subscriptionService.createSubscription({
        userId,
        planSlug,
        billingCycle,
        paymentMethod,
        trialDays: parseInt(trialDays),
        autoRenew
      });

      res.json({ success: true, data: subscription });
    } catch (error) {
      logger.error('[PaymentAPI] Create subscription error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/payments/subscriptions/user/:userId
   * Get user's subscriptions
   */
  router.get('/subscriptions/user/:userId', async (req, res) => {
    try {
      const subscriptions = await subscriptionService.getUserSubscriptions(req.params.userId);
      res.json({ success: true, data: subscriptions });
    } catch (error) {
      logger.error('[PaymentAPI] Get subscriptions error', {
        userId: req.params.userId,
        error: error.message
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/payments/subscriptions/user/:userId/active
   * Get user's active subscription
   */
  router.get('/subscriptions/user/:userId/active', async (req, res) => {
    try {
      const subscription = await subscriptionService.getActiveSubscription(req.params.userId);
      res.json({ success: true, data: subscription });
    } catch (error) {
      logger.error('[PaymentAPI] Get active subscription error', {
        userId: req.params.userId,
        error: error.message
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/payments/subscriptions/:subscriptionId/cancel
   * Cancel a subscription
   * Body: { immediate, reason }
   */
  router.post('/subscriptions/:subscriptionId/cancel', async (req, res) => {
    try {
      const { immediate = false, reason } = req.body;

      const subscription = await subscriptionService.cancelSubscription(
        req.params.subscriptionId,
        immediate,
        reason
      );

      res.json({ success: true, data: subscription });
    } catch (error) {
      logger.error('[PaymentAPI] Cancel subscription error', {
        subscriptionId: req.params.subscriptionId,
        error: error.message
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/payments/subscriptions/:subscriptionId/reactivate
   * Reactivate a canceled subscription
   */
  router.post('/subscriptions/:subscriptionId/reactivate', async (req, res) => {
    try {
      const subscription = await subscriptionService.reactivateSubscription(
        req.params.subscriptionId
      );

      res.json({ success: true, data: subscription });
    } catch (error) {
      logger.error('[PaymentAPI] Reactivate subscription error', {
        subscriptionId: req.params.subscriptionId,
        error: error.message
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/payments/subscriptions/:subscriptionId/change-plan
   * Change subscription plan
   * Body: { newPlanSlug, immediate }
   */
  router.post('/subscriptions/:subscriptionId/change-plan', async (req, res) => {
    try {
      const { newPlanSlug, immediate = true } = req.body;

      if (!newPlanSlug) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: newPlanSlug'
        });
      }

      const subscription = await subscriptionService.changeSubscriptionPlan(
        req.params.subscriptionId,
        newPlanSlug,
        immediate
      );

      res.json({ success: true, data: subscription });
    } catch (error) {
      logger.error('[PaymentAPI] Change plan error', {
        subscriptionId: req.params.subscriptionId,
        error: error.message
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/payments/subscriptions/process-renewals
   * Process subscription renewals (called by cron job)
   * Protected endpoint - should require admin authentication
   */
  router.post('/subscriptions/process-renewals', async (req, res) => {
    try {
      const result = await subscriptionService.processSubscriptionRenewals();
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('[PaymentAPI] Process renewals error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== Phase 3: AI Token Usage Tracking Routes ==========

  /**
   * GET /api/payments/usage-stats
   * Get usage statistics for current user
   * Query params: period (day/week/month), startDate, endDate
   */
  router.get('/usage-stats', async (req, res) => {
    try {
      const userId = req.user?.id || req.query.userId;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      const { period = 'day' } = req.query;
      const stats = await usageTrackingService.getUserUsageStats(userId, period);

      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('[PaymentAPI] Get usage stats error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/payments/usage-stats/:tokenId
   * Get usage statistics for a specific token
   * Query params: period (day/week/month)
   */
  router.get('/usage-stats/:tokenId', async (req, res) => {
    try {
      const { tokenId } = req.params;
      const { period = 'day' } = req.query;

      const stats = await usageTrackingService.getTokenUsageStats(tokenId, period);

      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('[PaymentAPI] Get token usage stats error', {
        tokenId: req.params.tokenId,
        error: error.message
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/payments/usage-logs
   * Get recent usage logs for current user
   * Query params: limit (default: 100)
   */
  router.get('/usage-logs', async (req, res) => {
    try {
      const userId = req.user?.id || req.query.userId;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      const { limit = 100 } = req.query;
      const logs = await usageTrackingService.getRecentUsage(userId, parseInt(limit));

      res.json({ success: true, data: logs });
    } catch (error) {
      logger.error('[PaymentAPI] Get usage logs error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ========== Phase 3: Invoice Management Routes ==========

  /**
   * GET /api/payments/invoices
   * Get all invoices for current user
   * Query params: status, limit, offset
   */
  router.get('/invoices', async (req, res) => {
    try {
      const userId = req.user?.id || req.query.userId;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      const { status, limit, offset } = req.query;
      const invoices = await billingService.getInvoicesByUser(userId, {
        status,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : 0
      });

      res.json({ success: true, data: invoices });
    } catch (error) {
      logger.error('[PaymentAPI] Get invoices error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/payments/invoices/:invoiceId
   * Get specific invoice by ID
   */
  router.get('/invoices/:invoiceId', async (req, res) => {
    try {
      const invoice = await billingService.getInvoiceById(req.params.invoiceId);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
      }

      res.json({ success: true, data: invoice });
    } catch (error) {
      logger.error('[PaymentAPI] Get invoice error', {
        invoiceId: req.params.invoiceId,
        error: error.message
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/payments/invoices/generate
   * Generate invoice for a period
   * Body: { userId, period (YYYY-MM), taxRate }
   */
  router.post('/invoices/generate', async (req, res) => {
    try {
      const { userId, period, taxRate } = req.body;

      if (!userId || !period) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, period'
        });
      }

      const invoice = await billingService.generateInvoice(userId, period, {
        taxRate: taxRate ? parseFloat(taxRate) : undefined
      });

      res.json({ success: true, data: invoice });
    } catch (error) {
      logger.error('[PaymentAPI] Generate invoice error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/payments/process-payment
   * Process payment for an invoice
   * Body: { invoiceId, paymentMethod, paymentDetails }
   */
  router.post('/process-payment', async (req, res) => {
    try {
      const { invoiceId, paymentMethod, paymentDetails } = req.body;

      if (!invoiceId || !paymentMethod) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: invoiceId, paymentMethod'
        });
      }

      const result = await billingService.processPayment(
        invoiceId,
        paymentMethod,
        paymentDetails || {}
      );

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('[PaymentAPI] Process payment error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/payments/payment-history
   * Get payment history for current user
   * Query params: status, limit, offset
   */
  router.get('/payment-history', async (req, res) => {
    try {
      const userId = req.user?.id || req.query.userId;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      const { status, limit, offset } = req.query;
      const payments = await billingService.getPaymentHistory(userId, {
        status,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : 0
      });

      res.json({ success: true, data: payments });
    } catch (error) {
      logger.error('[PaymentAPI] Get payment history error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/payments/add-payment-method
   * Add payment method for user
   * Body: { userId, type, details }
   */
  router.post('/add-payment-method', async (req, res) => {
    try {
      const { userId, type, details } = req.body;

      if (!userId || !type) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, type'
        });
      }

      const paymentMethod = await billingService.addPaymentMethod(userId, type, details || {});

      res.json({ success: true, data: paymentMethod });
    } catch (error) {
      logger.error('[PaymentAPI] Add payment method error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/payments/payment-methods
   * Get payment methods for current user
   */
  router.get('/payment-methods', async (req, res) => {
    try {
      const userId = req.user?.id || req.query.userId;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      const methods = await billingService.getPaymentMethods(userId);

      res.json({ success: true, data: methods });
    } catch (error) {
      logger.error('[PaymentAPI] Get payment methods error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/payments/payment-methods/:methodId
   * Delete a payment method
   */
  router.delete('/payment-methods/:methodId', async (req, res) => {
    try {
      await billingService.deletePaymentMethod(req.params.methodId);

      res.json({ success: true });
    } catch (error) {
      logger.error('[PaymentAPI] Delete payment method error', {
        methodId: req.params.methodId,
        error: error.message
      });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/payments/webhooks/payment-completed
   * Webhook for payment completion notifications
   * (From external payment provider)
   */
  router.post('/webhooks/payment-completed', async (req, res) => {
    try {
      const signature = req.headers['stripe-signature'] || req.headers['x-webhook-signature'];
      const event = req.body;

      const result = await paymentProvider.handleWebhook(event, signature);

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('[PaymentAPI] Payment webhook error', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // ========== Agent Activation and Purchase Routes (Issue #5030, #5045) ==========

  /**
   * POST /api/payments/agents/purchase
   * Purchase a paid agent
   * Body: { agentId, price, paymentMethod }
   * Headers: Authorization: Bearer <token>
   *
   * Issue #5045 - Implement agent purchase endpoint
   */
  router.post('/agents/purchase', async (req, res) => {
    try {
      const { agentId, price, paymentMethod = 'card' } = req.body;

      // Get userId from JWT token (assuming auth middleware sets req.user)
      // For now, we'll accept userId from request if auth is not implemented
      const userId = req.user?.id || req.body.userId;

      if (!agentId || price === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: agentId, price'
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      logger.info('[PaymentAPI] Processing agent purchase', { agentId, userId, price, paymentMethod });

      // Check if agent exists
      const agent = await db.get(
        'SELECT * FROM agents WHERE id = ?',
        [agentId]
      );

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }

      // Verify agent is a paid agent (price > 0)
      if (agent.price <= 0) {
        return res.status(400).json({
          success: false,
          error: 'This is a free agent. Please use /agents/activate endpoint instead.'
        });
      }

      // Verify the price matches the agent's price
      if (parseFloat(price) !== parseFloat(agent.price)) {
        logger.warn('[PaymentAPI] Price mismatch', {
          expectedPrice: agent.price,
          providedPrice: price,
          agentId
        });
        return res.status(400).json({
          success: false,
          error: `Price mismatch. Expected ${agent.price}, got ${price}`
        });
      }

      // Check if user already purchased this agent
      const existingPurchase = await db.get(
        'SELECT * FROM agent_purchases WHERE user_id = ? AND agent_id = ? AND status = ?',
        [userId, agentId, 'active']
      );

      if (existingPurchase) {
        logger.info('[PaymentAPI] Agent already purchased', {
          agentId,
          userId,
          purchaseId: existingPurchase.id
        });

        return res.json({
          success: true,
          data: existingPurchase,
          message: 'Agent already purchased',
          alreadyPurchased: true
        });
      }

      // Create payment transaction
      const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = new Date().toISOString();

      // For now, we'll create a completed payment record
      // In a real system, this would integrate with payment providers
      await db.run(
        `INSERT INTO payments (
          id, user_id, amount, currency, description,
          provider, payment_method, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId,
          userId,
          price,
          'RUB',
          `Purchase of agent: ${agent.name}`,
          paymentMethod,
          paymentMethod,
          'completed', // Mark as completed for now
          now,
          now
        ]
      );

      // Create agent purchase record
      await db.run(
        `INSERT INTO agent_purchases (
          id, user_id, agent_id, payment_id,
          purchase_type, status, purchased_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseId,
          userId,
          agentId,
          paymentId,
          'one_time',
          'active',
          now,
          now
        ]
      );

      // Fetch the created purchase with agent details
      const purchase = await db.get(
        `SELECT
          ap.*,
          a.id as agent_id,
          a.name as agent_name,
          a.description as agent_description,
          a.icon as agent_icon,
          a.category as agent_category,
          a.price as agent_price
        FROM agent_purchases ap
        LEFT JOIN agents a ON ap.agent_id = a.id
        WHERE ap.id = ?`,
        [purchaseId]
      );

      logger.info('[PaymentAPI] Agent purchased successfully', {
        purchaseId,
        paymentId,
        agentId,
        userId,
        price
      });

      res.json({
        success: true,
        data: {
          ...purchase,
          purchaseId: purchase.id,
          transaction: {
            id: paymentId,
            amount: price,
            currency: 'RUB',
            status: 'completed'
          }
        },
        message: 'Agent purchased successfully',
        alreadyPurchased: false
      });
    } catch (error) {
      logger.error('[PaymentAPI] Purchase error', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/payments/agents/activate
   * Activate a free agent (idempotent)
   * Body: { agentId }
   * Headers: Authorization: Bearer <token>
   *
   * Issue #5030 - Prevent duplicate free agent activations
   */
  router.post('/agents/activate', async (req, res) => {
    try {
      const { agentId } = req.body;

      // Get userId from JWT token (assuming auth middleware sets req.user)
      // For now, we'll accept userId from request if auth is not implemented
      const userId = req.user?.id || req.body.userId;

      if (!agentId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: agentId'
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      logger.info('[PaymentAPI] Activating free agent', { agentId, userId });

      // Check if agent exists
      const agent = await db.get(
        'SELECT * FROM agents WHERE id = ?',
        [agentId]
      );

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }

      // Check if agent is free (price = 0 or null)
      if (agent.price > 0) {
        return res.status(400).json({
          success: false,
          error: 'Agent is not free. Please use purchase endpoint instead.'
        });
      }

      // IDEMPOTENCY CHECK: Check if user already activated this agent
      const existingActivation = await db.get(
        'SELECT * FROM agent_purchases WHERE user_id = ? AND agent_id = ? AND status = ?',
        [userId, agentId, 'active']
      );

      if (existingActivation) {
        logger.info('[PaymentAPI] Agent already activated', {
          agentId,
          userId,
          purchaseId: existingActivation.id
        });

        return res.json({
          success: true,
          data: existingActivation,
          message: 'Agent already activated',
          alreadyActivated: true
        });
      }

      // Create activation record (free agent purchase)
      const activationId = `activation_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = new Date().toISOString();

      await db.run(
        `INSERT INTO agent_purchases (
          id, user_id, agent_id, payment_id,
          purchase_type, status, purchased_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          activationId,
          userId,
          agentId,
          null, // No payment for free agents
          'free',
          'active',
          now,
          now
        ]
      );

      const activation = await db.get(
        'SELECT * FROM agent_purchases WHERE id = ?',
        [activationId]
      );

      logger.info('[PaymentAPI] Free agent activated successfully', {
        activationId,
        agentId,
        userId
      });

      res.json({
        success: true,
        data: activation,
        message: 'Free agent activated successfully',
        alreadyActivated: false
      });
    } catch (error) {
      logger.error('[PaymentAPI] Activation error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/payments/agents/purchased
   * Get all purchased/activated agents for the authenticated user
   * Headers: Authorization: Bearer <token>
   */
  router.get('/agents/purchased', async (req, res) => {
    try {
      // Get userId from JWT token
      const userId = req.user?.id || req.query.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
      }

      logger.info('[PaymentAPI] Fetching purchased agents', { userId });

      const purchases = await db.all(
        `SELECT
          ap.*,
          a.id as agent_id,
          a.name as agent_name,
          a.description as agent_description,
          a.icon as agent_icon,
          a.category as agent_category,
          a.price as agent_price
        FROM agent_purchases ap
        LEFT JOIN agents a ON ap.agent_id = a.id
        WHERE ap.user_id = ? AND ap.status = ?
        ORDER BY ap.purchased_at DESC`,
        [userId, 'active']
      );

      res.json({
        success: true,
        data: purchases
      });
    } catch (error) {
      logger.error('[PaymentAPI] Get purchased agents error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export default createPaymentRoutes;
