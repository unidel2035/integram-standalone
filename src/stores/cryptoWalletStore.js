import { reactive, computed } from 'vue'

// Always use empty string for relative URLs to avoid CORS issues
// Development: Vite proxy forwards /api/* to localhost:8081
// Production: Nginx proxy forwards /api/* to https://drondoc.ru
const API_BASE_URL = ''
const DEMO_MODE = import.meta.env.VITE_CRYPTO_DEMO_MODE !== 'false'

// Supported cryptocurrencies
export const CRYPTO_CURRENCIES = {
  BTC: {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    icon: 'pi-bitcoin',
    decimals: 8,
    color: '#F7931A'
  },
  ETH: {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    icon: 'pi-ethereum',
    decimals: 18,
    color: '#627EEA'
  },
  USDT: {
    id: 'tether',
    symbol: 'USDT',
    name: 'Tether',
    icon: 'pi-dollar',
    decimals: 6,
    color: '#26A17B'
  },
  USDC: {
    id: 'usd-coin',
    symbol: 'USDC',
    name: 'USD Coin',
    icon: 'pi-dollar',
    decimals: 6,
    color: '#2775CA'
  },
  BNB: {
    id: 'binance-coin',
    symbol: 'BNB',
    name: 'Binance Coin',
    icon: 'pi-wallet',
    decimals: 18,
    color: '#F3BA2F'
  },
  TON: {
    id: 'the-open-network',
    symbol: 'TON',
    name: 'Toncoin',
    icon: 'pi-send',
    decimals: 9,
    color: '#0088CC'
  }
}

// Transaction statuses
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  CONFIRMING: 'confirming',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

// Demo data for wallets
const generateDemoWallets = () => {
  const userId = localStorage.getItem('user') || 'demo-user'

  return [
    {
      id: 'wallet-btc-001',
      userId,
      currency: 'BTC',
      address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      balance: 0.15234,
      balanceRub: 0.15234 * 6500000, // ~990k руб
      name: 'Основной Bitcoin кошелек',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date(),
      isActive: true
    },
    {
      id: 'wallet-eth-001',
      userId,
      currency: 'ETH',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      balance: 2.5,
      balanceRub: 2.5 * 280000, // ~700k руб
      name: 'Основной Ethereum кошелек',
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date(),
      isActive: true
    },
    {
      id: 'wallet-usdt-001',
      userId,
      currency: 'USDT',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      balance: 50000,
      balanceRub: 50000 * 95, // ~4.75M руб
      name: 'USDT для платежей',
      createdAt: new Date('2024-03-10'),
      updatedAt: new Date(),
      isActive: true
    }
  ]
}

// Demo data for transactions
const generateDemoTransactions = () => {
  const now = new Date()

  return [
    {
      id: 'tx-001',
      walletId: 'wallet-btc-001',
      txHash: '1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z',
      type: 'incoming',
      currency: 'BTC',
      amount: 0.05,
      amountRub: 0.05 * 6500000,
      fee: 0.00015,
      fromAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      toAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      status: TRANSACTION_STATUS.CONFIRMED,
      confirmations: 6,
      blockNumber: 825000,
      createdAt: new Date(now - 3600000 * 2), // 2 hours ago
      confirmedAt: new Date(now - 3600000 * 1.5),
      note: 'Пополнение от биржи'
    },
    {
      id: 'tx-002',
      walletId: 'wallet-eth-001',
      txHash: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
      type: 'outgoing',
      currency: 'ETH',
      amount: 0.5,
      amountRub: 0.5 * 280000,
      fee: 0.002,
      fromAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEc',
      status: TRANSACTION_STATUS.CONFIRMED,
      confirmations: 12,
      blockNumber: 18500000,
      createdAt: new Date(now - 3600000 * 24), // 1 day ago
      confirmedAt: new Date(now - 3600000 * 23.5),
      note: 'Оплата за услуги'
    },
    {
      id: 'tx-003',
      walletId: 'wallet-usdt-001',
      txHash: 'x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6',
      type: 'incoming',
      currency: 'USDT',
      amount: 10000,
      amountRub: 10000 * 95,
      fee: 1.5,
      fromAddress: '0x123456789abcdef123456789abcdef123456789a',
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      status: TRANSACTION_STATUS.CONFIRMED,
      confirmations: 20,
      blockNumber: 18500100,
      createdAt: new Date(now - 3600000 * 48), // 2 days ago
      confirmedAt: new Date(now - 3600000 * 47.8),
      note: 'Поступление от клиента'
    },
    {
      id: 'tx-004',
      walletId: 'wallet-btc-001',
      txHash: '9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k3j2i1h0g9f8e7d6c5b4a',
      type: 'outgoing',
      currency: 'BTC',
      amount: 0.01,
      amountRub: 0.01 * 6500000,
      fee: 0.0001,
      fromAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      toAddress: '3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy',
      status: TRANSACTION_STATUS.CONFIRMING,
      confirmations: 2,
      blockNumber: 825050,
      createdAt: new Date(now - 3600000 * 0.5), // 30 min ago
      confirmedAt: null,
      note: 'Тестовый платеж'
    },
    {
      id: 'tx-005',
      walletId: 'wallet-eth-001',
      txHash: 'p0o9i8u7y6t5r4e3w2q1a0s9d8f7g6h5j4k3l2z1x0c9v8b7n6m5',
      type: 'incoming',
      currency: 'ETH',
      amount: 1.0,
      amountRub: 1.0 * 280000,
      fee: 0.0015,
      fromAddress: '0xabcdef123456789abcdef123456789abcdef1234',
      toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      status: TRANSACTION_STATUS.CONFIRMED,
      confirmations: 25,
      blockNumber: 18499800,
      createdAt: new Date(now - 3600000 * 72), // 3 days ago
      confirmedAt: new Date(now - 3600000 * 71.8),
      note: 'Возврат средств'
    }
  ]
}

// Demo data for address book
const generateDemoAddressBook = () => {
  const userId = localStorage.getItem('user') || 'demo-user'

  return [
    {
      id: 'addr-001',
      userId,
      name: 'Binance Bitcoin',
      address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      currency: 'BTC',
      note: 'Адрес на бирже Binance',
      createdAt: new Date('2024-01-20'),
      lastUsedAt: new Date()
    },
    {
      id: 'addr-002',
      userId,
      name: 'Партнер Иван',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEc',
      currency: 'ETH',
      note: 'Кошелек партнера для регулярных платежей',
      createdAt: new Date('2024-02-05'),
      lastUsedAt: new Date(Date.now() - 3600000 * 24)
    },
    {
      id: 'addr-003',
      userId,
      name: 'Клиент ООО "Рога и Копыта"',
      address: '0x123456789abcdef123456789abcdef123456789a',
      currency: 'USDT',
      note: 'Адрес для получения оплаты',
      createdAt: new Date('2024-03-01'),
      lastUsedAt: new Date(Date.now() - 3600000 * 48)
    },
    {
      id: 'addr-004',
      userId,
      name: 'Холодный кошелек BTC',
      address: '3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy',
      currency: 'BTC',
      note: 'Резервное хранилище',
      createdAt: new Date('2024-01-10'),
      lastUsedAt: null
    },
    {
      id: 'addr-005',
      userId,
      name: 'Биржа Bybit USDT',
      address: '0xabcdef123456789abcdef123456789abcdef1234',
      currency: 'USDT',
      note: 'Вывод на биржу Bybit',
      createdAt: new Date('2024-03-15'),
      lastUsedAt: new Date(Date.now() - 3600000 * 12)
    }
  ]
}

// Exchange rates (RUB per 1 unit of crypto)
const demoExchangeRates = {
  BTC: 6500000,
  ETH: 280000,
  USDT: 95,
  USDC: 95,
  BNB: 55000,
  TON: 350
}

// Create store
export const useCryptoWalletStore = () => {
  const state = reactive({
    wallets: [],
    transactions: [],
    addressBook: [],
    exchangeRates: {},
    selectedWallet: null,
    loading: false,
    error: null,
    settings: {
      defaultCurrency: 'USDT',
      showBalanceInRub: true,
      notifications: {
        incoming: true,
        outgoing: true,
        confirmations: true
      },
      security: {
        requireConfirmation: true,
        minConfirmations: {
          BTC: 6,
          ETH: 12,
          USDT: 12
        }
      }
    }
  })

  // Initialize demo data from localStorage or defaults
  const initDemoData = () => {
    try {
      const storedWallets = localStorage.getItem('CRYPTO_WALLETS')
      const storedTransactions = localStorage.getItem('CRYPTO_TRANSACTIONS')
      const storedAddressBook = localStorage.getItem('CRYPTO_ADDRESS_BOOK')
      const storedSettings = localStorage.getItem('CRYPTO_SETTINGS')

      state.wallets = storedWallets ? JSON.parse(storedWallets) : generateDemoWallets()
      state.transactions = storedTransactions ? JSON.parse(storedTransactions) : generateDemoTransactions()
      state.addressBook = storedAddressBook ? JSON.parse(storedAddressBook) : generateDemoAddressBook()
      state.exchangeRates = demoExchangeRates

      if (storedSettings) {
        state.settings = JSON.parse(storedSettings)
      }

      // Save to localStorage if not exists
      if (!storedWallets) localStorage.setItem('CRYPTO_WALLETS', JSON.stringify(state.wallets))
      if (!storedTransactions) localStorage.setItem('CRYPTO_TRANSACTIONS', JSON.stringify(state.transactions))
      if (!storedAddressBook) localStorage.setItem('CRYPTO_ADDRESS_BOOK', JSON.stringify(state.addressBook))
    } catch (error) {
      console.error('Error initializing crypto wallet data:', error)
      state.error = 'Ошибка загрузки данных кошелька'
    }
  }

  // Save to localStorage
  const saveToLocalStorage = () => {
    try {
      localStorage.setItem('CRYPTO_WALLETS', JSON.stringify(state.wallets))
      localStorage.setItem('CRYPTO_TRANSACTIONS', JSON.stringify(state.transactions))
      localStorage.setItem('CRYPTO_ADDRESS_BOOK', JSON.stringify(state.addressBook))
      localStorage.setItem('CRYPTO_SETTINGS', JSON.stringify(state.settings))
    } catch (error) {
      console.error('Error saving to localStorage:', error)
    }
  }

  // Computed: Total balance in RUB
  const totalBalanceRub = computed(() => {
    return state.wallets.reduce((sum, wallet) => sum + wallet.balanceRub, 0)
  })

  // Computed: Active wallets
  const activeWallets = computed(() => {
    return state.wallets.filter(w => w.isActive)
  })

  // Computed: Recent transactions (last 10)
  const recentTransactions = computed(() => {
    return [...state.transactions]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
  })

  // Computed: Pending transactions
  const pendingTransactions = computed(() => {
    return state.transactions.filter(tx =>
      tx.status === TRANSACTION_STATUS.PENDING ||
      tx.status === TRANSACTION_STATUS.CONFIRMING
    )
  })

  // Get wallets (API or demo)
  const getWallets = async () => {
    state.loading = true
    state.error = null

    try {
      if (DEMO_MODE) {
        initDemoData()
        return state.wallets
      }

      const response = await fetch(`${API_BASE_URL}/api/crypto-wallets`, {
        headers: {
          'Authorization': localStorage.getItem('token')
        }
      })

      if (!response.ok) throw new Error('Failed to fetch wallets')

      const data = await response.json()
      state.wallets = data.wallets || []
      return state.wallets
    } catch (error) {
      state.error = error.message
      console.error('Error fetching wallets:', error)
      return []
    } finally {
      state.loading = false
    }
  }

  // Get transactions for wallet
  const getTransactions = async (walletId) => {
    state.loading = true
    state.error = null

    try {
      if (DEMO_MODE) {
        const filtered = state.transactions.filter(tx =>
          !walletId || tx.walletId === walletId
        )
        return filtered
      }

      const url = walletId
        ? `${API_BASE_URL}/api/crypto-wallets/${walletId}/transactions`
        : `${API_BASE_URL}/api/crypto-transactions`

      const response = await fetch(url, {
        headers: {
          'Authorization': localStorage.getItem('token')
        }
      })

      if (!response.ok) throw new Error('Failed to fetch transactions')

      const data = await response.json()
      state.transactions = data.transactions || []
      return state.transactions
    } catch (error) {
      state.error = error.message
      console.error('Error fetching transactions:', error)
      return []
    } finally {
      state.loading = false
    }
  }

  // Send transaction (demo or API)
  const sendTransaction = async (walletId, toAddress, amount, currency, note = '') => {
    state.loading = true
    state.error = null

    try {
      if (DEMO_MODE) {
        // Simulate transaction in demo mode
        const wallet = state.wallets.find(w => w.id === walletId)
        if (!wallet) throw new Error('Wallet not found')
        if (wallet.balance < amount) throw new Error('Insufficient balance')

        const newTransaction = {
          id: `tx-${Date.now()}`,
          walletId,
          txHash: `demo-${Math.random().toString(36).substring(2, 15)}`,
          type: 'outgoing',
          currency,
          amount,
          amountRub: amount * (state.exchangeRates[currency] || 0),
          fee: amount * 0.001, // 0.1% demo fee
          fromAddress: wallet.address,
          toAddress,
          status: TRANSACTION_STATUS.PENDING,
          confirmations: 0,
          blockNumber: null,
          createdAt: new Date(),
          confirmedAt: null,
          note
        }

        state.transactions.unshift(newTransaction)

        // Update wallet balance
        wallet.balance -= amount
        wallet.balanceRub = wallet.balance * (state.exchangeRates[currency] || 0)

        saveToLocalStorage()

        // Simulate confirmation after 5 seconds
        setTimeout(() => {
          newTransaction.status = TRANSACTION_STATUS.CONFIRMING
          newTransaction.confirmations = 1
          saveToLocalStorage()
        }, 5000)

        return newTransaction
      }

      const response = await fetch(`${API_BASE_URL}/api/crypto-wallets/${walletId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': localStorage.getItem('token'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ toAddress, amount, note })
      })

      if (!response.ok) throw new Error('Failed to send transaction')

      const data = await response.json()
      return data.transaction
    } catch (error) {
      state.error = error.message
      console.error('Error sending transaction:', error)
      throw error
    } finally {
      state.loading = false
    }
  }

  // Get address book
  const getAddressBook = async () => {
    if (DEMO_MODE) {
      return state.addressBook
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/crypto-address-book`, {
        headers: {
          'Authorization': localStorage.getItem('token')
        }
      })

      if (!response.ok) throw new Error('Failed to fetch address book')

      const data = await response.json()
      state.addressBook = data.addresses || []
      return state.addressBook
    } catch (error) {
      state.error = error.message
      console.error('Error fetching address book:', error)
      return []
    }
  }

  // Add address to book
  const addAddress = async (addressData) => {
    try {
      if (DEMO_MODE) {
        const newAddress = {
          id: `addr-${Date.now()}`,
          userId: localStorage.getItem('user') || 'demo-user',
          ...addressData,
          createdAt: new Date(),
          lastUsedAt: null
        }

        state.addressBook.push(newAddress)
        saveToLocalStorage()
        return newAddress
      }

      const response = await fetch(`${API_BASE_URL}/api/crypto-address-book`, {
        method: 'POST',
        headers: {
          'Authorization': localStorage.getItem('token'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(addressData)
      })

      if (!response.ok) throw new Error('Failed to add address')

      const data = await response.json()
      return data.address
    } catch (error) {
      state.error = error.message
      console.error('Error adding address:', error)
      throw error
    }
  }

  // Delete address
  const deleteAddress = async (addressId) => {
    try {
      if (DEMO_MODE) {
        const index = state.addressBook.findIndex(a => a.id === addressId)
        if (index !== -1) {
          state.addressBook.splice(index, 1)
          saveToLocalStorage()
        }
        return true
      }

      const response = await fetch(`${API_BASE_URL}/api/crypto-address-book/${addressId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': localStorage.getItem('token')
        }
      })

      if (!response.ok) throw new Error('Failed to delete address')
      return true
    } catch (error) {
      state.error = error.message
      console.error('Error deleting address:', error)
      throw error
    }
  }

  // Update settings
  const updateSettings = (newSettings) => {
    state.settings = { ...state.settings, ...newSettings }
    saveToLocalStorage()
  }

  // Get exchange rates
  const getExchangeRates = async () => {
    if (DEMO_MODE) {
      // Simulate small variations in demo mode
      Object.keys(state.exchangeRates).forEach(currency => {
        const baseRate = demoExchangeRates[currency]
        const variation = (Math.random() - 0.5) * 0.02 // ±1% variation
        state.exchangeRates[currency] = baseRate * (1 + variation)
      })
      return state.exchangeRates
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/crypto-rates`)
      if (!response.ok) throw new Error('Failed to fetch exchange rates')

      const data = await response.json()
      state.exchangeRates = data.rates || {}
      return state.exchangeRates
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
      return state.exchangeRates
    }
  }

  // Select wallet
  const selectWallet = (walletId) => {
    state.selectedWallet = walletId
  }

  // Initialize
  if (DEMO_MODE) {
    initDemoData()
  }

  return {
    state,
    totalBalanceRub,
    activeWallets,
    recentTransactions,
    pendingTransactions,
    getWallets,
    getTransactions,
    sendTransaction,
    getAddressBook,
    addAddress,
    deleteAddress,
    updateSettings,
    getExchangeRates,
    selectWallet
  }
}
