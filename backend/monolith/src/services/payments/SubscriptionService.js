import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Subscription Management Service
 * Handles subscription lifecycle: creation, renewal, cancellation, upgrades/downgrades
 */
export class SubscriptionService {
  constructor(db, paymentService) {
    this.db = db;
    this.paymentService = paymentService;
  }

  /**
   * Get all subscription plans
   * @returns {Promise<Array>} List of subscription plans
   */
  async getPlans() {
    try {
      const result = await this.db.query(
        'SELECT * FROM subscription_plans WHERE is_active = true ORDER BY sort_order, price_monthly ASC'
      );

      return result.rows;
    } catch (error) {
      logger.error('[SubscriptionService] Get plans error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get subscription plan by slug
   * @param {string} slug - Plan slug
   * @returns {Promise<Object>} Subscription plan
   */
  async getPlanBySlug(slug) {
    try {
      const result = await this.db.query(
        'SELECT * FROM subscription_plans WHERE slug = $1 AND is_active = true',
        [slug]
      );

      if (result.rows.length === 0) {
        throw new Error('Subscription plan not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('[SubscriptionService] Get plan by slug error', { slug, error: error.message });
      throw error;
    }
  }

  /**
   * Create or update user subscription
   * @param {Object} params - Subscription parameters
   * @returns {Promise<Object>} Subscription object
   */
  async createSubscription(params) {
    const {
      userId,
      planSlug,
      billingCycle = 'monthly',
      paymentMethod = 'card',
      trialDays = 0,
      autoRenew = true
    } = params;

    try {
      // Get plan details
      const plan = await this.getPlanBySlug(planSlug);

      // Check if user already has active subscription to this plan
      const existingResult = await this.db.query(
        'SELECT * FROM user_subscriptions WHERE user_id = $1 AND plan_id = $2 AND status IN ($3, $4)',
        [userId, plan.id, 'active', 'trialing']
      );

      if (existingResult.rows.length > 0) {
        throw new Error('User already has an active subscription to this plan');
      }

      // Calculate period dates
      const now = new Date();
      let periodEnd = new Date(now);

      if (trialDays > 0) {
        periodEnd.setDate(periodEnd.getDate() + trialDays);
      } else if (billingCycle === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else if (billingCycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }

      // Determine price based on billing cycle
      const price = billingCycle === 'yearly' && plan.price_yearly
        ? plan.price_yearly
        : plan.price_monthly;

      // Create subscription record
      const subscription = await this.db.query(`
        INSERT INTO user_subscriptions (
          id, user_id, plan_id, status, billing_cycle,
          current_period_start, current_period_end,
          trial_start, trial_end,
          cancel_at_period_end, payment_method,
          next_payment_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        uuidv4(),
        userId,
        plan.id,
        trialDays > 0 ? 'trialing' : 'active',
        billingCycle,
        now,
        periodEnd,
        trialDays > 0 ? now : null,
        trialDays > 0 ? periodEnd : null,
        !autoRenew,
        paymentMethod,
        trialDays > 0 ? periodEnd : periodEnd
      ]);

      // If not in trial, create initial payment
      if (trialDays === 0 && price > 0) {
        await this.paymentService.createPayment({
          userId,
          amount: price,
          currency: plan.currency,
          description: `Подписка ${plan.name} (${billingCycle === 'monthly' ? 'месяц' : 'год'})`,
          provider: plan.currency === 'RUB' ? 'yookassa' : 'stripe',
          subscriptionId: subscription.rows[0].id,
          metadata: {
            plan_slug: planSlug,
            billing_cycle: billingCycle
          }
        });
      }

      logger.info('[SubscriptionService] Subscription created', {
        subscriptionId: subscription.rows[0].id,
        userId,
        planSlug
      });

      return {
        success: true,
        subscription: subscription.rows[0],
        plan
      };
    } catch (error) {
      logger.error('[SubscriptionService] Create subscription error', {
        userId,
        planSlug,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user's active subscriptions
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of subscriptions with plan details
   */
  async getUserSubscriptions(userId) {
    try {
      const result = await this.db.query(`
        SELECT
          s.*,
          p.name as plan_name,
          p.slug as plan_slug,
          p.price_monthly,
          p.price_yearly,
          p.features,
          p.limits
        FROM user_subscriptions s
        JOIN subscription_plans p ON s.plan_id = p.id
        WHERE s.user_id = $1
        ORDER BY s.created_at DESC
      `, [userId]);

      return result.rows;
    } catch (error) {
      logger.error('[SubscriptionService] Get user subscriptions error', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user's active subscription
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Active subscription or null
   */
  async getActiveSubscription(userId) {
    try {
      const result = await this.db.query(`
        SELECT
          s.*,
          p.name as plan_name,
          p.slug as plan_slug,
          p.price_monthly,
          p.price_yearly,
          p.features,
          p.limits
        FROM user_subscriptions s
        JOIN subscription_plans p ON s.plan_id = p.id
        WHERE s.user_id = $1 AND s.status IN ($2, $3)
        ORDER BY s.created_at DESC
        LIMIT 1
      `, [userId, 'active', 'trialing']);

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error('[SubscriptionService] Get active subscription error', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Cancel subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {boolean} immediate - Cancel immediately or at period end
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Updated subscription
   */
  async cancelSubscription(subscriptionId, immediate = false, reason = null) {
    try {
      if (immediate) {
        // Cancel immediately
        await this.db.query(`
          UPDATE user_subscriptions
          SET status = 'canceled',
              canceled_at = CURRENT_TIMESTAMP,
              cancellation_reason = $1,
              current_period_end = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [reason, subscriptionId]);
      } else {
        // Cancel at period end
        await this.db.query(`
          UPDATE user_subscriptions
          SET cancel_at_period_end = true,
              canceled_at = CURRENT_TIMESTAMP,
              cancellation_reason = $1
          WHERE id = $2
        `, [reason, subscriptionId]);
      }

      logger.info('[SubscriptionService] Subscription canceled', {
        subscriptionId,
        immediate
      });

      const result = await this.db.query(
        'SELECT * FROM user_subscriptions WHERE id = $1',
        [subscriptionId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('[SubscriptionService] Cancel subscription error', {
        subscriptionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Reactivate canceled subscription
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} Updated subscription
   */
  async reactivateSubscription(subscriptionId) {
    try {
      await this.db.query(`
        UPDATE user_subscriptions
        SET cancel_at_period_end = false,
            canceled_at = NULL,
            cancellation_reason = NULL
        WHERE id = $1 AND status IN ($2, $3)
      `, [subscriptionId, 'active', 'trialing']);

      logger.info('[SubscriptionService] Subscription reactivated', { subscriptionId });

      const result = await this.db.query(
        'SELECT * FROM user_subscriptions WHERE id = $1',
        [subscriptionId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('[SubscriptionService] Reactivate subscription error', {
        subscriptionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Upgrade/downgrade subscription
   * @param {string} subscriptionId - Current subscription ID
   * @param {string} newPlanSlug - New plan slug
   * @param {boolean} immediate - Apply change immediately
   * @returns {Promise<Object>} Updated subscription
   */
  async changeSubscriptionPlan(subscriptionId, newPlanSlug, immediate = true) {
    try {
      // Get current subscription
      const currentResult = await this.db.query(
        'SELECT * FROM user_subscriptions WHERE id = $1',
        [subscriptionId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      const currentSubscription = currentResult.rows[0];

      // Get new plan
      const newPlan = await this.getPlanBySlug(newPlanSlug);

      if (immediate) {
        // Change plan immediately
        await this.db.query(`
          UPDATE user_subscriptions
          SET plan_id = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [newPlan.id, subscriptionId]);

        // Calculate prorated amount if upgrading mid-period
        // (Simplified - in production, implement proper proration logic)

        logger.info('[SubscriptionService] Subscription plan changed', {
          subscriptionId,
          newPlanSlug,
          immediate: true
        });
      } else {
        // Schedule plan change for next period
        // (Would need additional field in schema to track scheduled changes)
        logger.info('[SubscriptionService] Subscription plan change scheduled', {
          subscriptionId,
          newPlanSlug,
          immediate: false
        });
      }

      const result = await this.db.query(
        'SELECT * FROM user_subscriptions WHERE id = $1',
        [subscriptionId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('[SubscriptionService] Change subscription plan error', {
        subscriptionId,
        newPlanSlug,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Renew subscription (called by cron job or webhook)
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} Renewal result
   */
  async renewSubscription(subscriptionId) {
    try {
      // Get subscription details
      const result = await this.db.query(`
        SELECT s.*, p.*
        FROM user_subscriptions s
        JOIN subscription_plans p ON s.plan_id = p.id
        WHERE s.id = $1
      `, [subscriptionId]);

      if (result.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      const subscription = result.rows[0];

      // Check if subscription should be renewed
      if (subscription.cancel_at_period_end) {
        await this.db.query(
          'UPDATE user_subscriptions SET status = $1 WHERE id = $2',
          ['canceled', subscriptionId]
        );
        return { renewed: false, reason: 'Subscription scheduled for cancellation' };
      }

      // Calculate new period dates
      const newPeriodStart = new Date(subscription.current_period_end);
      const newPeriodEnd = new Date(newPeriodStart);

      if (subscription.billing_cycle === 'monthly') {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      } else if (subscription.billing_cycle === 'yearly') {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      }

      // Determine price
      const price = subscription.billing_cycle === 'yearly' && subscription.price_yearly
        ? subscription.price_yearly
        : subscription.price_monthly;

      // Create renewal payment
      const payment = await this.paymentService.createPayment({
        userId: subscription.user_id,
        amount: price,
        currency: subscription.currency,
        description: `Продление подписки ${subscription.name}`,
        provider: subscription.currency === 'RUB' ? 'yookassa' : 'stripe',
        subscriptionId,
        metadata: {
          renewal: true,
          period_start: newPeriodStart.toISOString(),
          period_end: newPeriodEnd.toISOString()
        }
      });

      // Update subscription dates
      await this.db.query(`
        UPDATE user_subscriptions
        SET current_period_start = $1,
            current_period_end = $2,
            next_payment_date = $2,
            last_payment_date = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [newPeriodStart, newPeriodEnd, subscriptionId]);

      logger.info('[SubscriptionService] Subscription renewed', {
        subscriptionId,
        paymentId: payment.paymentId
      });

      return {
        renewed: true,
        payment,
        newPeriodStart,
        newPeriodEnd
      };
    } catch (error) {
      logger.error('[SubscriptionService] Renew subscription error', {
        subscriptionId,
        error: error.message
      });

      // Mark subscription as past_due
      await this.db.query(
        'UPDATE user_subscriptions SET status = $1 WHERE id = $2',
        ['past_due', subscriptionId]
      );

      throw error;
    }
  }

  /**
   * Check and process subscriptions due for renewal
   * Should be called by a cron job
   * @returns {Promise<Object>} Processing summary
   */
  async processSubscriptionRenewals() {
    try {
      // Find subscriptions due for renewal (next payment date is today or earlier)
      const result = await this.db.query(`
        SELECT id
        FROM user_subscriptions
        WHERE status = 'active'
          AND cancel_at_period_end = false
          AND next_payment_date <= CURRENT_TIMESTAMP
      `);

      const renewals = {
        total: result.rows.length,
        successful: 0,
        failed: 0,
        errors: []
      };

      for (const row of result.rows) {
        try {
          await this.renewSubscription(row.id);
          renewals.successful++;
        } catch (error) {
          renewals.failed++;
          renewals.errors.push({
            subscriptionId: row.id,
            error: error.message
          });
        }
      }

      logger.info('[SubscriptionService] Processed subscription renewals', renewals);

      return renewals;
    } catch (error) {
      logger.error('[SubscriptionService] Process renewals error', { error: error.message });
      throw error;
    }
  }
}

export default SubscriptionService;
