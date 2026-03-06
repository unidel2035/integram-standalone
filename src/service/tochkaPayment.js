import axios from 'axios'

/**
 * Tochka Bank Payment Gateway Client
 * Documentation: https://developers.tochka.com/docs/pay-gateway/
 */
class TochkaPaymentClient {
  constructor(options = {}) {
    this.clientId = options.clientId || import.meta.env.VITE_TOCHKA_CLIENT_ID
    this.clientSecret = options.clientSecret || import.meta.env.VITE_TOCHKA_CLIENT_SECRET
    this.useSandbox = options.useSandbox !== false // Default to sandbox mode

    // Base URL depends on sandbox mode
    this.baseURL = this.useSandbox
      ? 'https://enter.tochka.com/sandbox/v2/uapi/pay/v1.0'
      : 'https://enter.tochka.com/uapi/pay/v1.0'

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    // Setup interceptors
    this._setupInterceptors()
  }

  /**
   * Setup request/response interceptors
   */
  _setupInterceptors() {
    // Request interceptor - add authorization token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.getAccessToken()
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        console.error('[Tochka API] Request error:', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[Tochka API] Response error:', error.response?.data || error.message)

        // Handle specific error cases
        if (error.response) {
          const { status, data } = error.response

          if (status === 401) {
            // Token expired or invalid
            this._clearAccessToken()
            return Promise.reject(new Error('Authentication failed. Please check your credentials.'))
          }

          if (status === 400) {
            return Promise.reject(new Error(data.message || 'Invalid request data'))
          }
        }

        return Promise.reject(error)
      }
    )
  }

  /**
   * Get access token (using sandbox token in sandbox mode)
   */
  async getAccessToken() {
    // In sandbox mode, use the static sandbox token
    if (this.useSandbox) {
      return 'sandbox.jwt.token'
    }

    // In production mode, check for cached token
    const cachedToken = sessionStorage.getItem('tochka_access_token')
    const tokenExpiry = sessionStorage.getItem('tochka_token_expiry')

    if (cachedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
      return cachedToken
    }

    // Request new token via OAuth2
    try {
      const response = await axios.post('https://enter.tochka.com/connect/token', {
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'payments'
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      const { access_token, expires_in } = response.data

      // Cache token
      sessionStorage.setItem('tochka_access_token', access_token)
      sessionStorage.setItem('tochka_token_expiry', (Date.now() + (expires_in * 1000)).toString())

      return access_token
    } catch (error) {
      console.error('[Tochka API] Token request failed:', error)
      throw new Error('Failed to obtain access token')
    }
  }

  /**
   * Clear cached access token
   */
  _clearAccessToken() {
    sessionStorage.removeItem('tochka_access_token')
    sessionStorage.removeItem('tochka_token_expiry')
  }

  /**
   * Create a new payment
   * @param {Object} paymentData - Payment data
   * @param {number} paymentData.amount - Payment amount in rubles
   * @param {string} paymentData.description - Payment description
   * @param {string} paymentData.orderId - Unique order ID
   * @param {Object} paymentData.customer - Customer information
   * @returns {Promise<Object>} Payment response with payment URL
   */
  async createPayment(paymentData) {
    try {
      const { amount, description, orderId, customer = {} } = paymentData

      const payload = {
        amount: amount * 100, // Convert to kopecks
        currency: 'RUB',
        description: description || 'Пополнение счета',
        orderId: orderId || `ORDER-${Date.now()}`,
        customer: {
          email: customer.email,
          phone: customer.phone,
          name: customer.name
        },
        returnUrl: customer.returnUrl || `${window.location.origin}/payment/callback`,
        failUrl: customer.failUrl || `${window.location.origin}/payment/callback`,
        metadata: {
          source: 'dronedoc',
          timestamp: new Date().toISOString()
        }
      }

      const response = await this.client.post('/sites/default/payments', payload)

      return {
        success: true,
        paymentId: response.data.paymentId,
        status: response.data.status,
        paymentUrl: response.data.paymentUrl,
        orderId: response.data.orderId
      }
    } catch (error) {
      console.error('[Tochka API] Create payment error:', error)
      throw error
    }
  }

  /**
   * Get payment status
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Payment status
   */
  async getPaymentStatus(paymentId) {
    try {
      const response = await this.client.get(`/sites/default/payments/${paymentId}`)

      return {
        success: true,
        paymentId: response.data.paymentId,
        status: response.data.status,
        amount: response.data.amount / 100, // Convert from kopecks
        currency: response.data.currency,
        createdAt: response.data.createdAt,
        updatedAt: response.data.updatedAt
      }
    } catch (error) {
      console.error('[Tochka API] Get payment status error:', error)
      throw error
    }
  }

  /**
   * Complete 3DS authentication
   * @param {string} paymentId - Payment ID
   * @param {string} paRes - 3DS response
   * @returns {Promise<Object>} Payment completion result
   */
  async complete3DSPayment(paymentId, paRes) {
    try {
      const response = await this.client.post(
        `/sites/default/payments/${paymentId}/complete`,
        {
          Data: {
            type: 'THREE_DS',
            paRes: paRes
          }
        }
      )

      return {
        success: true,
        paymentId: response.data.paymentId,
        status: response.data.status,
        message: response.data.message
      }
    } catch (error) {
      console.error('[Tochka API] Complete 3DS payment error:', error)
      throw error
    }
  }

  /**
   * Cancel payment
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelPayment(paymentId) {
    try {
      const response = await this.client.post(`/sites/default/payments/${paymentId}/cancel`)

      return {
        success: true,
        paymentId: response.data.paymentId,
        status: response.data.status
      }
    } catch (error) {
      console.error('[Tochka API] Cancel payment error:', error)
      throw error
    }
  }

  /**
   * Create refund
   * @param {string} paymentId - Payment ID
   * @param {number} amount - Refund amount (optional, defaults to full amount)
   * @returns {Promise<Object>} Refund result
   */
  async createRefund(paymentId, amount = null) {
    try {
      const payload = {}
      if (amount !== null) {
        payload.amount = amount * 100 // Convert to kopecks
      }

      const response = await this.client.post(`/sites/default/payments/${paymentId}/refunds`, payload)

      return {
        success: true,
        refundId: response.data.refundId,
        paymentId: response.data.paymentId,
        status: response.data.status,
        amount: response.data.amount / 100 // Convert from kopecks
      }
    } catch (error) {
      console.error('[Tochka API] Create refund error:', error)
      throw error
    }
  }
}

// Create and export singleton instance
const tochkaPaymentClient = new TochkaPaymentClient()

export default tochkaPaymentClient
export { TochkaPaymentClient }
