import { YooKassaProvider } from './YooKassaProvider.js';
import { StripeProvider } from './StripeProvider.js';
import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Payment Service
 * Orchestrates payment operations across multiple providers
 */
export class PaymentService {
  constructor(db) {
    this.db = db;

    // Initialize payment providers
    try {
      this.yookassa = new YooKassaProvider();
      logger.info('[PaymentService] YooKassa provider initialized');
    } catch (error) {
      logger.warn('[PaymentService] YooKassa provider not available:', error.message);
      this.yookassa = null;
    }

    try {
      this.stripe = new StripeProvider();
      logger.info('[PaymentService] Stripe provider initialized');
    } catch (error) {
      logger.warn('[PaymentService] Stripe provider not available:', error.message);
      this.stripe = null;
    }
  }

  /**
   * Get provider by name
   */
  _getProvider(providerName) {
    const providers = {
      yookassa: this.yookassa,
      stripe: this.stripe
    };

    const provider = providers[providerName];
    if (!provider) {
      throw new Error(`Payment provider '${providerName}' is not available`);
    }

    return provider;
  }

  /**
   * Create a payment
   * @param {Object} params - Payment parameters
   * @returns {Promise<Object>} Payment result with confirmation URL
   */
  async createPayment(params) {
    const {
      userId,
      amount,
      currency = 'RUB',
      description,
      provider = 'yookassa', // Default to YooKassa for RUB
      paymentMethod = null,
      subscriptionId = null,
      metadata = {}
    } = params;

    // Validate amount
    if (!amount || amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    // Select provider based on currency if not specified
    const selectedProvider = currency === 'RUB' ? 'yookassa' : provider;
    const paymentProvider = this._getProvider(selectedProvider);

    // Generate order ID
    const orderId = `DRO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    try {
      // Create payment in provider
      const paymentResult = await paymentProvider.createPayment({
        amount,
        currency,
        description: description || `Пополнение счета DronDoc на ${amount} ${currency}`,
        orderId,
        userId,
        paymentMethod,
        metadata: {
          ...metadata,
          subscription_id: subscriptionId
        }
      });

      // Save transaction to database
      const transaction = await this.db.query(`
        INSERT INTO payment_transactions (
          id, user_id, subscription_id, amount, currency, description,
          provider, provider_payment_id, provider_order_id, status,
          payment_method, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        uuidv4(),
        userId,
        subscriptionId,
        amount,
        currency,
        description || `Пополнение счета на ${amount} ${currency}`,
        selectedProvider,
        paymentResult.paymentId,
        orderId,
        'pending',
        paymentMethod,
        JSON.stringify(metadata)
      ]);

      logger.info('[PaymentService] Payment created', {
        transactionId: transaction.rows[0].id,
        provider: selectedProvider,
        amount,
        orderId
      });

      return {
        success: true,
        transactionId: transaction.rows[0].id,
        paymentId: paymentResult.paymentId,
        confirmationUrl: paymentResult.confirmationUrl,
        clientSecret: paymentResult.clientSecret, // For Stripe
        status: 'pending',
        orderId
      };
    } catch (error) {
      logger.error('[PaymentService] Create payment error', {
        error: error.message,
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Check payment status and update database
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Payment status
   */
  async checkPaymentStatus(transactionId) {
    try {
      // Get transaction from database
      const result = await this.db.query(
        'SELECT * FROM payment_transactions WHERE id = $1',
        [transactionId]
      );

      if (result.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const transaction = result.rows[0];
      const provider = this._getProvider(transaction.provider);

      // Check status with provider
      const statusResult = await provider.getPaymentStatus(transaction.provider_payment_id);

      // Update transaction if status changed
      if (statusResult.status !== transaction.status) {
        await this._updateTransactionStatus(transactionId, statusResult);
      }

      return {
        success: true,
        transactionId,
        status: statusResult.status,
        paid: statusResult.paid,
        amount: statusResult.amount,
        currency: statusResult.currency
      };
    } catch (error) {
      logger.error('[PaymentService] Check payment status error', {
        transactionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update transaction status
   * @private
   */
  async _updateTransactionStatus(transactionId, statusResult) {
    const statusMap = {
      succeeded: 'succeeded',
      pending: 'pending',
      waiting_for_capture: 'processing',
      canceled: 'canceled',
      requires_payment_method: 'failed'
    };

    const newStatus = statusMap[statusResult.status] || statusResult.status;

    await this.db.query(`
      UPDATE payment_transactions
      SET status = $1,
          paid_at = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [
      newStatus,
      statusResult.paid ? new Date() : null,
      transactionId
    ]);

    // If payment succeeded, update user balance
    if (newStatus === 'succeeded') {
      await this._creditUserBalance(transactionId);
    }

    logger.info('[PaymentService] Transaction status updated', {
      transactionId,
      newStatus
    });
  }

  /**
   * Credit user balance after successful payment
   * @private
   */
  async _creditUserBalance(transactionId) {
    const transaction = await this.db.query(
      'SELECT * FROM payment_transactions WHERE id = $1',
      [transactionId]
    );

    if (transaction.rows.length === 0) {
      throw new Error('Transaction not found');
    }

    const { user_id, amount, currency } = transaction.rows[0];

    // Get current balance
    const balanceResult = await this.db.query(
      'SELECT balance FROM user_balances WHERE user_id = $1 AND currency = $2',
      [user_id, currency]
    );

    const currentBalance = balanceResult.rows.length > 0
      ? parseFloat(balanceResult.rows[0].balance)
      : 0;

    const newBalance = currentBalance + parseFloat(amount);

    // Update or insert balance
    if (balanceResult.rows.length > 0) {
      await this.db.query(
        'UPDATE user_balances SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND currency = $3',
        [newBalance, user_id, currency]
      );
    } else {
      await this.db.query(
        'INSERT INTO user_balances (user_id, currency, balance) VALUES ($1, $2, $3)',
        [user_id, currency, newBalance]
      );
    }

    // Record balance history
    await this.db.query(`
      INSERT INTO balance_history (id, user_id, transaction_id, amount, balance_before, balance_after, type, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      uuidv4(),
      user_id,
      transactionId,
      amount,
      currentBalance,
      newBalance,
      'deposit',
      `Пополнение счета на ${amount} ${currency}`
    ]);

    logger.info('[PaymentService] User balance credited', {
      userId: user_id,
      amount,
      newBalance
    });
  }

  /**
   * Create refund
   * @param {string} transactionId - Transaction ID
   * @param {number} amount - Refund amount (optional, defaults to full amount)
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Refund result
   */
  async createRefund(transactionId, amount = null, reason = null) {
    try {
      // Get transaction
      const result = await this.db.query(
        'SELECT * FROM payment_transactions WHERE id = $1',
        [transactionId]
      );

      if (result.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const transaction = result.rows[0];

      if (transaction.status !== 'succeeded') {
        throw new Error('Can only refund succeeded transactions');
      }

      const provider = this._getProvider(transaction.provider);
      const refundAmount = amount || parseFloat(transaction.amount);

      // Create refund with provider
      const refundResult = await provider.createRefund(
        transaction.provider_payment_id,
        refundAmount,
        reason
      );

      // Save refund to database
      const refund = await this.db.query(`
        INSERT INTO payment_refunds (
          id, transaction_id, amount, currency, reason,
          provider_refund_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        uuidv4(),
        transactionId,
        refundAmount,
        transaction.currency,
        reason,
        refundResult.refundId,
        'pending'
      ]);

      // Update transaction status
      await this.db.query(
        'UPDATE payment_transactions SET status = $1, refunded_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['refunded', transactionId]
      );

      logger.info('[PaymentService] Refund created', {
        refundId: refund.rows[0].id,
        transactionId,
        amount: refundAmount
      });

      return {
        success: true,
        refundId: refund.rows[0].id,
        status: 'pending',
        amount: refundAmount
      };
    } catch (error) {
      logger.error('[PaymentService] Create refund error', {
        transactionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user transactions
   * @param {string} userId - User ID
   * @param {Object} options - Query options (limit, offset, status)
   * @returns {Promise<Array>} Transaction list
   */
  async getUserTransactions(userId, options = {}) {
    const { limit = 50, offset = 0, status = null } = options;

    try {
      let query = 'SELECT * FROM payment_transactions WHERE user_id = $1';
      const params = [userId];

      if (status) {
        query += ' AND status = $2';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await this.db.query(query, params);

      return result.rows;
    } catch (error) {
      logger.error('[PaymentService] Get user transactions error', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user balance
   * @param {string} userId - User ID
   * @param {string} currency - Currency code
   * @returns {Promise<number>} Balance amount
   */
  async getUserBalance(userId, currency = 'RUB') {
    try {
      const result = await this.db.query(
        'SELECT balance FROM user_balances WHERE user_id = $1 AND currency = $2',
        [userId, currency]
      );

      return result.rows.length > 0 ? parseFloat(result.rows[0].balance) : 0;
    } catch (error) {
      logger.error('[PaymentService] Get user balance error', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process webhook notification
   * @param {string} provider - Provider name
   * @param {Object} payload - Webhook payload
   * @param {string} signature - Webhook signature (optional)
   * @returns {Promise<Object>} Processing result
   */
  async processWebhook(provider, payload, signature = null) {
    try {
      const paymentProvider = this._getProvider(provider);

      // Verify webhook signature
      if (signature && provider === 'stripe') {
        paymentProvider.verifyWebhookSignature(payload, signature);
      }

      // Save webhook event
      await this.db.query(`
        INSERT INTO payment_webhook_events (id, provider, event_type, event_id, payload, processed)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        uuidv4(),
        provider,
        payload.event || payload.type || 'unknown',
        payload.id || uuidv4(),
        JSON.stringify(payload),
        false
      ]);

      // Process webhook based on provider
      if (provider === 'yookassa') {
        await this._processYooKassaWebhook(payload);
      } else if (provider === 'stripe') {
        await this._processStripeWebhook(payload);
      }

      return { success: true };
    } catch (error) {
      logger.error('[PaymentService] Process webhook error', {
        provider,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process YooKassa webhook
   * @private
   */
  async _processYooKassaWebhook(payload) {
    const paymentId = payload.object?.id;
    if (!paymentId) return;

    // Find transaction
    const result = await this.db.query(
      'SELECT id FROM payment_transactions WHERE provider_payment_id = $1',
      [paymentId]
    );

    if (result.rows.length > 0) {
      const transactionId = result.rows[0].id;
      await this.checkPaymentStatus(transactionId);
    }
  }

  /**
   * Process Stripe webhook
   * @private
   */
  async _processStripeWebhook(payload) {
    const paymentIntentId = payload.data?.object?.id;
    if (!paymentIntentId) return;

    // Find transaction
    const result = await this.db.query(
      'SELECT id FROM payment_transactions WHERE provider_payment_id = $1',
      [paymentIntentId]
    );

    if (result.rows.length > 0) {
      const transactionId = result.rows[0].id;
      await this.checkPaymentStatus(transactionId);
    }
  }
}

export default PaymentService;
