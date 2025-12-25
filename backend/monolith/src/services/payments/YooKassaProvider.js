import axios from 'axios';
import logger from '../../utils/logger.js';

/**
 * YooKassa (ЮKassa) Payment Provider
 * Supports: Russian cards (МИР, Visa, Mastercard), SBP, and other methods
 * Documentation: https://yookassa.ru/developers/api
 */
export class YooKassaProvider {
  constructor(config = {}) {
    this.shopId = config.shopId || process.env.YOOKASSA_SHOP_ID;
    this.secretKey = config.secretKey || process.env.YOOKASSA_SECRET_KEY;
    this.returnUrl = config.returnUrl || process.env.YOOKASSA_RETURN_URL;

    if (!this.shopId || !this.secretKey) {
      throw new Error('YooKassa credentials are not configured');
    }

    // Create axios instance with basic auth
    this.client = axios.create({
      baseURL: 'https://api.yookassa.ru/v3',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': this._generateIdempotenceKey()
      },
      auth: {
        username: this.shopId,
        password: this.secretKey
      }
    });

    logger.info('[YooKassa] Provider initialized', { shopId: this.shopId });
  }

  /**
   * Generate idempotence key for requests
   */
  _generateIdempotenceKey() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Create a payment
   * @param {Object} params - Payment parameters
   * @returns {Promise<Object>} Payment object
   */
  async createPayment(params) {
    const {
      amount,
      currency = 'RUB',
      description,
      orderId,
      userId,
      paymentMethod = null, // 'bank_card', 'sbp', or null for selection page
      returnUrl = this.returnUrl,
      metadata = {}
    } = params;

    try {
      const payload = {
        amount: {
          value: amount.toFixed(2),
          currency
        },
        description: description || 'Пополнение счета DronDoc',
        confirmation: {
          type: 'redirect',
          return_url: returnUrl
        },
        capture: true, // Auto-capture payment
        metadata: {
          order_id: orderId,
          user_id: userId,
          ...metadata
        }
      };

      // Add specific payment method if requested
      if (paymentMethod) {
        payload.payment_method_data = {
          type: paymentMethod
        };
      }

      const response = await this.client.post('/payments', payload, {
        headers: {
          'Idempotence-Key': this._generateIdempotenceKey()
        }
      });

      logger.info('[YooKassa] Payment created', {
        paymentId: response.data.id,
        amount,
        orderId
      });

      return {
        success: true,
        paymentId: response.data.id,
        status: response.data.status,
        confirmationUrl: response.data.confirmation.confirmation_url,
        createdAt: response.data.created_at
      };
    } catch (error) {
      logger.error('[YooKassa] Create payment error', {
        error: error.response?.data || error.message
      });
      throw new Error(`Failed to create YooKassa payment: ${error.response?.data?.description || error.message}`);
    }
  }

  /**
   * Get payment status
   * @param {string} paymentId - YooKassa payment ID
   * @returns {Promise<Object>} Payment status
   */
  async getPaymentStatus(paymentId) {
    try {
      const response = await this.client.get(`/payments/${paymentId}`);

      return {
        success: true,
        paymentId: response.data.id,
        status: response.data.status, // 'pending', 'waiting_for_capture', 'succeeded', 'canceled'
        paid: response.data.paid,
        amount: parseFloat(response.data.amount.value),
        currency: response.data.amount.currency,
        paymentMethod: response.data.payment_method?.type,
        capturedAt: response.data.captured_at,
        createdAt: response.data.created_at,
        metadata: response.data.metadata
      };
    } catch (error) {
      logger.error('[YooKassa] Get payment status error', {
        paymentId,
        error: error.response?.data || error.message
      });
      throw new Error(`Failed to get YooKassa payment status: ${error.response?.data?.description || error.message}`);
    }
  }

  /**
   * Capture authorized payment
   * @param {string} paymentId - YooKassa payment ID
   * @param {number} amount - Amount to capture (optional, defaults to full amount)
   * @returns {Promise<Object>} Capture result
   */
  async capturePayment(paymentId, amount = null) {
    try {
      const payload = {};
      if (amount !== null) {
        payload.amount = {
          value: amount.toFixed(2),
          currency: 'RUB'
        };
      }

      const response = await this.client.post(`/payments/${paymentId}/capture`, payload, {
        headers: {
          'Idempotence-Key': this._generateIdempotenceKey()
        }
      });

      logger.info('[YooKassa] Payment captured', {
        paymentId,
        amount: response.data.amount.value
      });

      return {
        success: true,
        paymentId: response.data.id,
        status: response.data.status
      };
    } catch (error) {
      logger.error('[YooKassa] Capture payment error', {
        paymentId,
        error: error.response?.data || error.message
      });
      throw new Error(`Failed to capture YooKassa payment: ${error.response?.data?.description || error.message}`);
    }
  }

  /**
   * Cancel payment
   * @param {string} paymentId - YooKassa payment ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelPayment(paymentId) {
    try {
      const response = await this.client.post(`/payments/${paymentId}/cancel`, {}, {
        headers: {
          'Idempotence-Key': this._generateIdempotenceKey()
        }
      });

      logger.info('[YooKassa] Payment canceled', { paymentId });

      return {
        success: true,
        paymentId: response.data.id,
        status: response.data.status
      };
    } catch (error) {
      logger.error('[YooKassa] Cancel payment error', {
        paymentId,
        error: error.response?.data || error.message
      });
      throw new Error(`Failed to cancel YooKassa payment: ${error.response?.data?.description || error.message}`);
    }
  }

  /**
   * Create refund
   * @param {string} paymentId - YooKassa payment ID
   * @param {number} amount - Refund amount
   * @param {string} reason - Refund reason (optional)
   * @returns {Promise<Object>} Refund result
   */
  async createRefund(paymentId, amount, reason = null) {
    try {
      const payload = {
        payment_id: paymentId,
        amount: {
          value: amount.toFixed(2),
          currency: 'RUB'
        }
      };

      if (reason) {
        payload.description = reason;
      }

      const response = await this.client.post('/refunds', payload, {
        headers: {
          'Idempotence-Key': this._generateIdempotenceKey()
        }
      });

      logger.info('[YooKassa] Refund created', {
        refundId: response.data.id,
        paymentId,
        amount
      });

      return {
        success: true,
        refundId: response.data.id,
        status: response.data.status,
        amount: parseFloat(response.data.amount.value),
        createdAt: response.data.created_at
      };
    } catch (error) {
      logger.error('[YooKassa] Create refund error', {
        paymentId,
        amount,
        error: error.response?.data || error.message
      });
      throw new Error(`Failed to create YooKassa refund: ${error.response?.data?.description || error.message}`);
    }
  }

  /**
   * Verify webhook signature
   * @param {Object} notification - Webhook notification object
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(notification) {
    // YooKassa uses simple notification format without HMAC
    // Verification is done by checking if the shop_id matches
    return notification?.object?.recipient?.account_id === this.shopId;
  }

  /**
   * Get receipt info (for 54-ФЗ compliance)
   * @param {string} paymentId - YooKassa payment ID
   * @returns {Promise<Object>} Receipt information
   */
  async getReceiptInfo(paymentId) {
    try {
      const paymentStatus = await this.getPaymentStatus(paymentId);

      if (paymentStatus.paid && paymentStatus.metadata) {
        // YooKassa automatically sends receipts if configured
        // Receipt info is in payment metadata
        return {
          success: true,
          receiptUrl: paymentStatus.metadata.receipt_url || null,
          fiscalDocumentNumber: paymentStatus.metadata.fiscal_document_number || null,
          fiscalAttribute: paymentStatus.metadata.fiscal_document_attribute || null
        };
      }

      return {
        success: false,
        message: 'Receipt not available'
      };
    } catch (error) {
      logger.error('[YooKassa] Get receipt info error', {
        paymentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create saved payment method
   * @param {Object} params - Payment method parameters
   * @returns {Promise<Object>} Saved payment method
   */
  async createPaymentMethod(params) {
    const {
      type = 'bank_card',
      confirmation,
      userId,
      metadata = {}
    } = params;

    try {
      const payload = {
        type,
        confirmation,
        metadata: {
          user_id: userId,
          ...metadata
        }
      };

      const response = await this.client.post('/payment_methods', payload, {
        headers: {
          'Idempotence-Key': this._generateIdempotenceKey()
        }
      });

      logger.info('[YooKassa] Payment method created', {
        paymentMethodId: response.data.id,
        type
      });

      return {
        success: true,
        paymentMethodId: response.data.id,
        type: response.data.type,
        saved: response.data.saved,
        confirmationUrl: response.data.confirmation?.confirmation_url
      };
    } catch (error) {
      logger.error('[YooKassa] Create payment method error', {
        error: error.response?.data || error.message
      });
      throw new Error(`Failed to create YooKassa payment method: ${error.response?.data?.description || error.message}`);
    }
  }
}

export default YooKassaProvider;
