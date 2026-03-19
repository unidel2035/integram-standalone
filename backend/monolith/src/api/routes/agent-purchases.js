import express from 'express';
import logger from '../../utils/logger.js';

/**
 * Agent Purchase API Routes
 * Handles agent purchases and subscriptions
 *
 * Issue #4962 - Integrate payment system with agent purchases
 */
export function createAgentPurchaseRoutes(db) {
  const router = express.Router();

  /**
   * POST /api/agents/purchase
   * Process agent purchase after successful payment
   * Body: { paymentId, agentId, userId }
   */
  router.post('/purchase', async (req, res) => {
    try {
      const { paymentId, agentId, userId } = req.body;

      // Validate required fields
      if (!paymentId || !agentId || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: paymentId, agentId, userId'
        });
      }

      logger.info('[AgentPurchaseAPI] Processing agent purchase', {
        paymentId,
        agentId,
        userId
      });

      // Verify payment was successful
      const payment = await db.get(
        'SELECT * FROM payments WHERE id = ? AND user_id = ? AND status = ?',
        [paymentId, userId, 'completed']
      );

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found or not completed'
        });
      }

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

      // Check if user already purchased this agent
      const existingPurchase = await db.get(
        'SELECT * FROM agent_purchases WHERE user_id = ? AND agent_id = ?',
        [userId, agentId]
      );

      if (existingPurchase) {
        return res.json({
          success: true,
          data: existingPurchase,
          message: 'Agent already purchased'
        });
      }

      // Create agent purchase record
      const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = new Date().toISOString();

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

      const purchase = await db.get(
        'SELECT * FROM agent_purchases WHERE id = ?',
        [purchaseId]
      );

      logger.info('[AgentPurchaseAPI] Agent purchase completed', {
        purchaseId,
        agentId,
        userId
      });

      res.json({
        success: true,
        data: purchase,
        message: 'Agent purchased successfully'
      });
    } catch (error) {
      logger.error('[AgentPurchaseAPI] Purchase error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agents/subscribe
   * Activate agent subscription after successful payment
   * Body: { paymentId, agentId, userId, billingCycle }
   */
  router.post('/subscribe', async (req, res) => {
    try {
      const { paymentId, agentId, userId, billingCycle = 'monthly' } = req.body;

      // Validate required fields
      if (!paymentId || !agentId || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: paymentId, agentId, userId'
        });
      }

      logger.info('[AgentPurchaseAPI] Activating agent subscription', {
        paymentId,
        agentId,
        userId,
        billingCycle
      });

      // Verify payment was successful
      const payment = await db.get(
        'SELECT * FROM payments WHERE id = ? AND user_id = ? AND status = ?',
        [paymentId, userId, 'completed']
      );

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found or not completed'
        });
      }

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

      // Calculate subscription period
      const now = new Date();
      const startDate = now.toISOString();
      const endDate = new Date(now);

      switch (billingCycle) {
        case 'monthly':
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case 'quarterly':
          endDate.setMonth(endDate.getMonth() + 3);
          break;
        case 'yearly':
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
        default:
          endDate.setMonth(endDate.getMonth() + 1);
      }

      // Check for existing active subscription
      const existingSubscription = await db.get(
        'SELECT * FROM agent_subscriptions WHERE user_id = ? AND agent_id = ? AND status = ?',
        [userId, agentId, 'active']
      );

      if (existingSubscription) {
        // Extend existing subscription
        const currentEnd = new Date(existingSubscription.end_date);
        const newEndDate = new Date(currentEnd);

        switch (billingCycle) {
          case 'monthly':
            newEndDate.setMonth(newEndDate.getMonth() + 1);
            break;
          case 'quarterly':
            newEndDate.setMonth(newEndDate.getMonth() + 3);
            break;
          case 'yearly':
            newEndDate.setFullYear(newEndDate.getFullYear() + 1);
            break;
        }

        await db.run(
          'UPDATE agent_subscriptions SET end_date = ?, updated_at = ? WHERE id = ?',
          [newEndDate.toISOString(), now.toISOString(), existingSubscription.id]
        );

        const updated = await db.get(
          'SELECT * FROM agent_subscriptions WHERE id = ?',
          [existingSubscription.id]
        );

        return res.json({
          success: true,
          data: updated,
          message: 'Subscription extended successfully'
        });
      }

      // Create new subscription
      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await db.run(
        `INSERT INTO agent_subscriptions (
          id, user_id, agent_id, payment_id,
          billing_cycle, status, start_date, end_date,
          auto_renew, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          subscriptionId,
          userId,
          agentId,
          paymentId,
          billingCycle,
          'active',
          startDate,
          endDate.toISOString(),
          true,
          now.toISOString(),
          now.toISOString()
        ]
      );

      const subscription = await db.get(
        'SELECT * FROM agent_subscriptions WHERE id = ?',
        [subscriptionId]
      );

      logger.info('[AgentPurchaseAPI] Agent subscription activated', {
        subscriptionId,
        agentId,
        userId,
        billingCycle,
        endDate: endDate.toISOString()
      });

      res.json({
        success: true,
        data: subscription,
        message: 'Subscription activated successfully'
      });
    } catch (error) {
      logger.error('[AgentPurchaseAPI] Subscription error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agents/purchased/:userId
   * Get all purchased agents for a user
   */
  router.get('/purchased/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      logger.info('[AgentPurchaseAPI] Fetching purchased agents', { userId });

      const purchases = await db.all(
        `SELECT
          ap.*,
          a.name as agent_name,
          a.description as agent_description,
          a.icon as agent_icon,
          a.category as agent_category,
          a.price as agent_price
        FROM agent_purchases ap
        JOIN agents a ON ap.agent_id = a.id
        WHERE ap.user_id = ? AND ap.status = ?
        ORDER BY ap.purchased_at DESC`,
        [userId, 'active']
      );

      res.json({
        success: true,
        data: purchases
      });
    } catch (error) {
      logger.error('[AgentPurchaseAPI] Get purchased agents error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agents/subscriptions/:userId
   * Get all agent subscriptions for a user
   */
  router.get('/subscriptions/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      logger.info('[AgentPurchaseAPI] Fetching agent subscriptions', { userId });

      const subscriptions = await db.all(
        `SELECT
          asub.*,
          a.name as agent_name,
          a.description as agent_description,
          a.icon as agent_icon,
          a.category as agent_category
        FROM agent_subscriptions asub
        JOIN agents a ON asub.agent_id = a.id
        WHERE asub.user_id = ?
        ORDER BY asub.created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        data: subscriptions
      });
    } catch (error) {
      logger.error('[AgentPurchaseAPI] Get subscriptions error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agents/subscriptions/:subscriptionId/cancel
   * Cancel an agent subscription
   */
  router.post('/subscriptions/:subscriptionId/cancel', async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const { immediate = false, reason } = req.body;

      logger.info('[AgentPurchaseAPI] Canceling subscription', {
        subscriptionId,
        immediate
      });

      const subscription = await db.get(
        'SELECT * FROM agent_subscriptions WHERE id = ?',
        [subscriptionId]
      );

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: 'Subscription not found'
        });
      }

      const now = new Date().toISOString();

      if (immediate) {
        // Cancel immediately
        await db.run(
          `UPDATE agent_subscriptions
          SET status = ?, end_date = ?, auto_renew = ?, updated_at = ?
          WHERE id = ?`,
          ['canceled', now, false, now, subscriptionId]
        );
      } else {
        // Cancel at end of period
        await db.run(
          `UPDATE agent_subscriptions
          SET auto_renew = ?, updated_at = ?
          WHERE id = ?`,
          [false, now, subscriptionId]
        );
      }

      const updated = await db.get(
        'SELECT * FROM agent_subscriptions WHERE id = ?',
        [subscriptionId]
      );

      logger.info('[AgentPurchaseAPI] Subscription canceled', {
        subscriptionId,
        immediate
      });

      res.json({
        success: true,
        data: updated,
        message: immediate
          ? 'Subscription canceled immediately'
          : 'Subscription will not auto-renew'
      });
    } catch (error) {
      logger.error('[AgentPurchaseAPI] Cancel subscription error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/agents/activate
   * Activate a free agent (idempotent)
   * Body: { agentId }
   * Headers: Authorization: Bearer <token>
   *
   * Issue #5030 - Prevent duplicate free agent activations
   */
  router.post('/activate', async (req, res) => {
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

      logger.info('[AgentPurchaseAPI] Activating free agent', { agentId, userId });

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

      // Check if agent is free (price = 0)
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
        logger.info('[AgentPurchaseAPI] Agent already activated', {
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

      logger.info('[AgentPurchaseAPI] Free agent activated successfully', {
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
      logger.error('[AgentPurchaseAPI] Activation error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agents/:agentId/check-access/:userId
   * Check if user has access to an agent (purchased or subscribed)
   */
  router.get('/:agentId/check-access/:userId', async (req, res) => {
    try {
      const { agentId, userId } = req.params;

      logger.info('[AgentPurchaseAPI] Checking agent access', { agentId, userId });

      // Check for one-time purchase
      const purchase = await db.get(
        'SELECT * FROM agent_purchases WHERE user_id = ? AND agent_id = ? AND status = ?',
        [userId, agentId, 'active']
      );

      if (purchase) {
        return res.json({
          success: true,
          data: {
            hasAccess: true,
            accessType: 'purchase',
            purchase
          }
        });
      }

      // Check for active subscription
      const now = new Date().toISOString();
      const subscription = await db.get(
        `SELECT * FROM agent_subscriptions
        WHERE user_id = ? AND agent_id = ? AND status = ? AND end_date > ?`,
        [userId, agentId, 'active', now]
      );

      if (subscription) {
        return res.json({
          success: true,
          data: {
            hasAccess: true,
            accessType: 'subscription',
            subscription
          }
        });
      }

      // No access
      res.json({
        success: true,
        data: {
          hasAccess: false,
          accessType: null
        }
      });
    } catch (error) {
      logger.error('[AgentPurchaseAPI] Check access error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export default createAgentPurchaseRoutes;
