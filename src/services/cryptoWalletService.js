import apiClient from '@/axios2'

// Always use relative URL to avoid CORS issues
// Development: Vite proxy forwards to localhost:8081
// Production: Nginx proxy forwards to https://drondoc.ru
const API_BASE_URL = '/api'

/**
 * Crypto Wallet Service
 * Service layer for crypto wallet operations
 *
 * NOTE: This is a placeholder service for backend integration.
 * Current implementation uses demo mode with localStorage.
 * When backend is ready, uncomment API calls and remove demo logic.
 */

class CryptoWalletService {
  /**
   * Get all wallets for current user
   */
  async getWallets() {
    try {
      // TODO: Connect to unified backend storage system
      const response = await apiClient.get(`${API_BASE_URL}/crypto-wallets`)
      return response.data
    } catch (error) {
      console.error('Error fetching wallets:', error)
      throw error
    }
  }

  /**
   * Create a new wallet
   */
  async createWallet(walletData) {
    try {
      // TODO: Connect to unified backend storage system
      const response = await apiClient.post(`${API_BASE_URL}/crypto-wallets`, walletData)
      return response.data
    } catch (error) {
      console.error('Error creating wallet:', error)
      throw error
    }
  }

  /**
   * Get wallet by ID
   */
  async getWallet(walletId) {
    try {
      // TODO: Connect to unified backend storage system
      const response = await apiClient.get(`${API_BASE_URL}/crypto-wallets/${walletId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching wallet:', error)
      throw error
    }
  }

  /**
   * Update wallet
   */
  async updateWallet(walletId, updates) {
    try {
      // TODO: Connect to unified backend storage system
      const response = await apiClient.put(`${API_BASE_URL}/crypto-wallets/${walletId}`, updates)
      return response.data
    } catch (error) {
      console.error('Error updating wallet:', error)
      throw error
    }
  }

  /**
   * Delete wallet
   */
  async deleteWallet(walletId) {
    try {
      // TODO: Connect to unified backend storage system
      const response = await apiClient.delete(`${API_BASE_URL}/crypto-wallets/${walletId}`)
      return response.data
    } catch (error) {
      console.error('Error deleting wallet:', error)
      throw error
    }
  }

  /**
   * Get current balance for wallet
   */
  async getBalance(walletId) {
    try {
      // TODO: Connect to blockchain API through backend
      const response = await apiClient.get(`${API_BASE_URL}/crypto-wallets/${walletId}/balance`)
      return response.data
    } catch (error) {
      console.error('Error fetching balance:', error)
      throw error
    }
  }

  /**
   * Get transactions for wallet
   */
  async getTransactions(walletId, params = {}) {
    try {
      // TODO: Connect to unified backend storage system
      const response = await apiClient.get(
        `${API_BASE_URL}/crypto-wallets/${walletId}/transactions`,
        { params }
      )
      return response.data
    } catch (error) {
      console.error('Error fetching transactions:', error)
      throw error
    }
  }

  /**
   * Send transaction
   */
  async sendTransaction(walletId, transactionData) {
    try {
      // TODO: Connect to backend for transaction signing and broadcasting
      // Backend should:
      // 1. Validate transaction data
      // 2. Check user has sufficient balance
      // 3. Sign transaction with encrypted private key
      // 4. Broadcast to blockchain network
      // 5. Return transaction hash
      const response = await apiClient.post(
        `${API_BASE_URL}/crypto-wallets/${walletId}/send`,
        transactionData
      )
      return response.data
    } catch (error) {
      console.error('Error sending transaction:', error)
      throw error
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash) {
    try {
      // TODO: Connect to blockchain API through backend
      const response = await apiClient.get(`${API_BASE_URL}/crypto-transactions/${txHash}`)
      return response.data
    } catch (error) {
      console.error('Error fetching transaction status:', error)
      throw error
    }
  }

  /**
   * Get address book
   */
  async getAddressBook() {
    try {
      // TODO: Connect to unified backend storage system
      const response = await apiClient.get(`${API_BASE_URL}/crypto-address-book`)
      return response.data
    } catch (error) {
      console.error('Error fetching address book:', error)
      throw error
    }
  }

  /**
   * Add address to book
   */
  async addAddress(addressData) {
    try {
      // TODO: Connect to unified backend storage system
      const response = await apiClient.post(`${API_BASE_URL}/crypto-address-book`, addressData)
      return response.data
    } catch (error) {
      console.error('Error adding address:', error)
      throw error
    }
  }

  /**
   * Update address in book
   */
  async updateAddress(addressId, updates) {
    try {
      // TODO: Connect to unified backend storage system
      const response = await apiClient.put(`${API_BASE_URL}/crypto-address-book/${addressId}`, updates)
      return response.data
    } catch (error) {
      console.error('Error updating address:', error)
      throw error
    }
  }

  /**
   * Delete address from book
   */
  async deleteAddress(addressId) {
    try {
      // TODO: Connect to unified backend storage system
      const response = await apiClient.delete(`${API_BASE_URL}/crypto-address-book/${addressId}`)
      return response.data
    } catch (error) {
      console.error('Error deleting address:', error)
      throw error
    }
  }

  /**
   * Get current exchange rates (crypto to RUB)
   */
  async getExchangeRates() {
    try {
      // TODO: Connect to exchange rate API through backend
      // Backend should fetch from CoinGecko, Binance, or similar
      const response = await apiClient.get(`${API_BASE_URL}/crypto-rates`)
      return response.data
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
      throw error
    }
  }

  /**
   * Validate crypto address
   *
   * @param {string} address - Address to validate
   * @param {string} currency - Currency symbol (BTC, ETH, etc.)
   * @returns {Promise<boolean>} - True if valid
   */
  async validateAddress(address, currency) {
    try {
      // TODO: Connect to backend validation service
      // Backend should use specialized libraries for each blockchain
      const response = await apiClient.post(`${API_BASE_URL}/crypto-validate-address`, {
        address,
        currency
      })
      return response.data.isValid
    } catch (error) {
      console.error('Error validating address:', error)
      // Fallback to client-side validation
      return this.validateAddressClient(address, currency)
    }
  }

  /**
   * Client-side address validation (basic)
   * NOTE: This is NOT sufficient for production. Always validate on backend!
   */
  validateAddressClient(address, currency) {
    if (!address || typeof address !== 'string') return false

    switch (currency) {
      case 'BTC':
        // Bitcoin: Legacy (1...), SegWit (3...), or Native SegWit (bc1...)
        return /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address)

      case 'ETH':
      case 'USDT':
      case 'USDC':
      case 'BNB':
        // Ethereum and ERC-20 tokens: 0x followed by 40 hex characters
        return /^0x[a-fA-F0-9]{40}$/.test(address)

      case 'TON':
        // TON: Typically starts with EQ or UQ, 48 characters base64
        return /^[EU]Q[a-zA-Z0-9_-]{46}$/.test(address)

      default:
        return false
    }
  }

  /**
   * Estimate transaction fee
   */
  async estimateFee(currency, amount, priority = 'medium') {
    try {
      // TODO: Connect to blockchain API through backend
      const response = await apiClient.post(`${API_BASE_URL}/crypto-estimate-fee`, {
        currency,
        amount,
        priority
      })
      return response.data
    } catch (error) {
      console.error('Error estimating fee:', error)
      // Fallback to estimated fees
      return this.getFallbackFee(currency, amount, priority)
    }
  }

  /**
   * Fallback fee estimation
   */
  getFallbackFee(currency, amount, priority) {
    const feeRates = {
      BTC: { low: 0.00001, medium: 0.00015, high: 0.0003 },
      ETH: { low: 0.001, medium: 0.002, high: 0.004 },
      USDT: { low: 1, medium: 2, high: 5 },
      USDC: { low: 1, medium: 2, high: 5 },
      BNB: { low: 0.0001, medium: 0.0002, high: 0.0004 },
      TON: { low: 0.01, medium: 0.02, high: 0.05 }
    }

    const rate = feeRates[currency]?.[priority] || 0
    return {
      currency,
      amount: rate,
      priority,
      estimatedTime: priority === 'low' ? '30-60 min' : priority === 'medium' ? '10-20 min' : '5-10 min'
    }
  }
}

export default new CryptoWalletService()
