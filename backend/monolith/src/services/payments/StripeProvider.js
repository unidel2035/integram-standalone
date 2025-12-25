import Stripe from 'stripe';
import logger from '../../utils/logger.js';

/**
 * Stripe Payment Provider
 * For international payments
 * Documentation: https://stripe.com/docs/api
 */
export class StripeProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.STRIPE_API_KEY;
    this.webhookSecret = config.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
    this.returnUrl = config.returnUrl || process.env.STRIPE_RETURN_URL;

    if (!this.apiKey) {
      throw new Error('Stripe API key is not configured');
    }

    this.stripe = new Stripe(this.apiKey, {
      apiVersion: '2023-10-16'
    });

    logger.info('[Stripe] Provider initialized');
  }

  /**
   * Create a payment intent
   * @param {Object} params - Payment parameters
   * @returns {Promise<Object>} Payment intent
   */
  async createPayment(params) {
    const {
      amount,
      currency = 'usd',
      description,
      orderId,
      userId,
      paymentMethod = null,
      returnUrl = this.returnUrl,
      metadata = {}
    } = params;

    try {
      const paymentIntentParams = {
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        description: description || 'DronDoc payment',
        automatic_payment_methods: {
          enabled: true
        },
        metadata: {
          order_id: orderId,
          user_id: userId,
          ...metadata
        }
      };

      // Add specific payment method if provided
      if (paymentMethod) {
        paymentIntentParams.payment_method = paymentMethod;
        paymentIntentParams.confirm = true;
        paymentIntentParams.return_url = returnUrl;
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentParams);

      logger.info('[Stripe] Payment intent created', {
        paymentIntentId: paymentIntent.id,
        amount,
        orderId
      });

      return {
        success: true,
        paymentId: paymentIntent.id,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
        confirmationUrl: paymentIntent.next_action?.redirect_to_url?.url,
        createdAt: new Date(paymentIntent.created * 1000).toISOString()
      };
    } catch (error) {
      logger.error('[Stripe] Create payment error', {
        error: error.message
      });
      throw new Error(`Failed to create Stripe payment: ${error.message}`);
    }
  }

  /**
   * Get payment status
   * @param {string} paymentId - Stripe payment intent ID
   * @returns {Promise<Object>} Payment status
   */
  async getPaymentStatus(paymentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);

      return {
        success: true,
        paymentId: paymentIntent.id,
        status: paymentIntent.status, // 'requires_payment_method', 'succeeded', 'canceled', etc.
        paid: paymentIntent.status === 'succeeded',
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency,
        paymentMethod: paymentIntent.payment_method,
        capturedAt: paymentIntent.status === 'succeeded' ? new Date(paymentIntent.created * 1000).toISOString() : null,
        createdAt: new Date(paymentIntent.created * 1000).toISOString(),
        metadata: paymentIntent.metadata
      };
    } catch (error) {
      logger.error('[Stripe] Get payment status error', {
        paymentId,
        error: error.message
      });
      throw new Error(`Failed to get Stripe payment status: ${error.message}`);
    }
  }

  /**
   * Capture authorized payment
   * @param {string} paymentId - Stripe payment intent ID
   * @param {number} amount - Amount to capture (optional)
   * @returns {Promise<Object>} Capture result
   */
  async capturePayment(paymentId, amount = null) {
    try {
      const captureParams = {};
      if (amount !== null) {
        captureParams.amount_to_capture = Math.round(amount * 100);
      }

      const paymentIntent = await this.stripe.paymentIntents.capture(paymentId, captureParams);

      logger.info('[Stripe] Payment captured', {
        paymentId,
        amount: paymentIntent.amount / 100
      });

      return {
        success: true,
        paymentId: paymentIntent.id,
        status: paymentIntent.status
      };
    } catch (error) {
      logger.error('[Stripe] Capture payment error', {
        paymentId,
        error: error.message
      });
      throw new Error(`Failed to capture Stripe payment: ${error.message}`);
    }
  }

  /**
   * Cancel payment
   * @param {string} paymentId - Stripe payment intent ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelPayment(paymentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentId);

      logger.info('[Stripe] Payment canceled', { paymentId });

      return {
        success: true,
        paymentId: paymentIntent.id,
        status: paymentIntent.status
      };
    } catch (error) {
      logger.error('[Stripe] Cancel payment error', {
        paymentId,
        error: error.message
      });
      throw new Error(`Failed to cancel Stripe payment: ${error.message}`);
    }
  }

  /**
   * Create refund
   * @param {string} paymentId - Stripe payment intent ID
   * @param {number} amount - Refund amount
   * @param {string} reason - Refund reason (optional)
   * @returns {Promise<Object>} Refund result
   */
  async createRefund(paymentId, amount, reason = null) {
    try {
      const refundParams = {
        payment_intent: paymentId,
        amount: Math.round(amount * 100) // Convert to cents
      };

      if (reason) {
        refundParams.reason = reason;
        refundParams.metadata = { description: reason };
      }

      const refund = await this.stripe.refunds.create(refundParams);

      logger.info('[Stripe] Refund created', {
        refundId: refund.id,
        paymentId,
        amount
      });

      return {
        success: true,
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100,
        createdAt: new Date(refund.created * 1000).toISOString()
      };
    } catch (error) {
      logger.error('[Stripe] Create refund error', {
        paymentId,
        amount,
        error: error.message
      });
      throw new Error(`Failed to create Stripe refund: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - Stripe-Signature header
   * @returns {Object} Verified event object
   */
  verifyWebhookSignature(payload, signature) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
      return event;
    } catch (error) {
      logger.error('[Stripe] Webhook signature verification failed', {
        error: error.message
      });
      throw new Error(`Stripe webhook signature verification failed: ${error.message}`);
    }
  }

  /**
   * Create customer
   * @param {Object} params - Customer parameters
   * @returns {Promise<Object>} Customer object
   */
  async createCustomer(params) {
    const { userId, email, name, metadata = {} } = params;

    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          user_id: userId,
          ...metadata
        }
      });

      logger.info('[Stripe] Customer created', {
        customerId: customer.id,
        userId
      });

      return {
        success: true,
        customerId: customer.id,
        email: customer.email,
        createdAt: new Date(customer.created * 1000).toISOString()
      };
    } catch (error) {
      logger.error('[Stripe] Create customer error', {
        error: error.message
      });
      throw new Error(`Failed to create Stripe customer: ${error.message}`);
    }
  }

  /**
   * Create payment method
   * @param {Object} params - Payment method parameters
   * @returns {Promise<Object>} Payment method
   */
  async createPaymentMethod(params) {
    const { type = 'card', card, customerId } = params;

    try {
      const paymentMethodParams = {
        type
      };

      if (type === 'card' && card) {
        paymentMethodParams.card = card;
      }

      const paymentMethod = await this.stripe.paymentMethods.create(paymentMethodParams);

      // Attach to customer if customerId provided
      if (customerId) {
        await this.stripe.paymentMethods.attach(paymentMethod.id, {
          customer: customerId
        });
      }

      logger.info('[Stripe] Payment method created', {
        paymentMethodId: paymentMethod.id,
        type
      });

      return {
        success: true,
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          exp_month: paymentMethod.card.exp_month,
          exp_year: paymentMethod.card.exp_year
        } : null
      };
    } catch (error) {
      logger.error('[Stripe] Create payment method error', {
        error: error.message
      });
      throw new Error(`Failed to create Stripe payment method: ${error.message}`);
    }
  }

  /**
   * Create subscription
   * @param {Object} params - Subscription parameters
   * @returns {Promise<Object>} Subscription object
   */
  async createSubscription(params) {
    const {
      customerId,
      priceId,
      paymentMethod,
      trialDays = 0,
      metadata = {}
    } = params;

    try {
      const subscriptionParams = {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata
      };

      if (trialDays > 0) {
        subscriptionParams.trial_period_days = trialDays;
      }

      if (paymentMethod) {
        subscriptionParams.default_payment_method = paymentMethod;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionParams);

      logger.info('[Stripe] Subscription created', {
        subscriptionId: subscription.id,
        customerId
      });

      return {
        success: true,
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        clientSecret: subscription.latest_invoice?.payment_intent?.client_secret
      };
    } catch (error) {
      logger.error('[Stripe] Create subscription error', {
        error: error.message
      });
      throw new Error(`Failed to create Stripe subscription: ${error.message}`);
    }
  }

  /**
   * Cancel subscription
   * @param {string} subscriptionId - Stripe subscription ID
   * @param {boolean} atPeriodEnd - Cancel at period end (default: false)
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelSubscription(subscriptionId, atPeriodEnd = false) {
    try {
      let subscription;

      if (atPeriodEnd) {
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
      } else {
        subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      }

      logger.info('[Stripe] Subscription canceled', {
        subscriptionId,
        atPeriodEnd
      });

      return {
        success: true,
        subscriptionId: subscription.id,
        status: subscription.status,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null
      };
    } catch (error) {
      logger.error('[Stripe] Cancel subscription error', {
        subscriptionId,
        error: error.message
      });
      throw new Error(`Failed to cancel Stripe subscription: ${error.message}`);
    }
  }
}

export default StripeProvider;
