import { ref, computed } from 'vue'
import { useCryptoWalletStore, CRYPTO_CURRENCIES, TRANSACTION_STATUS } from '@/stores/cryptoWalletStore'
import { validateCryptoAddress, validateAmount, validateNote } from '@/utils/cryptoValidation'
import { formatCryptoAmount, formatFiatAmount, formatAddress } from '@/utils/cryptoFormatter'
import { useToast } from 'primevue/usetoast'

/**
 * Composable for crypto wallet operations
 * Provides reactive wallet state and methods
 */
export function useCryptoWallet() {
  const store = useCryptoWalletStore()
  const toast = useToast()

  // Reactive state
  const loading = ref(false)
  const error = ref(null)

  // Initialize wallet data
  const initialize = async () => {
    loading.value = true
    error.value = null

    try {
      await Promise.all([
        store.getWallets(),
        store.getTransactions(),
        store.getAddressBook(),
        store.getExchangeRates()
      ])
    } catch (err) {
      error.value = err.message
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: 'Не удалось загрузить данные кошелька',
        life: 5000
      })
    } finally {
      loading.value = false
    }
  }

  // Get wallet by ID
  const getWallet = (walletId) => {
    return store.state.wallets.find(w => w.id === walletId)
  }

  // Get transactions for wallet
  const getWalletTransactions = (walletId) => {
    if (!walletId) return store.state.transactions

    return store.state.transactions.filter(tx => tx.walletId === walletId)
  }

  // Send transaction
  const sendTransaction = async (walletId, toAddress, amount, currency, note = '') => {
    loading.value = true
    error.value = null

    try {
      // Validate inputs
      if (!validateCryptoAddress(toAddress, currency)) {
        throw new Error('Неверный адрес получателя')
      }

      if (!validateAmount(amount, currency)) {
        throw new Error('Неверная сумма')
      }

      if (note && !validateNote(note)) {
        throw new Error('Примечание содержит недопустимые символы')
      }

      // Check balance
      const wallet = getWallet(walletId)
      if (!wallet) {
        throw new Error('Кошелек не найден')
      }

      if (wallet.balance < amount) {
        throw new Error('Недостаточно средств')
      }

      // Send transaction
      const transaction = await store.sendTransaction(walletId, toAddress, amount, currency, note)

      toast.add({
        severity: 'success',
        summary: 'Успешно',
        detail: 'Транзакция отправлена',
        life: 5000
      })

      return transaction
    } catch (err) {
      error.value = err.message
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: err.message,
        life: 5000
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  // Add address to book
  const addAddressToBook = async (addressData) => {
    loading.value = true
    error.value = null

    try {
      // Validate address
      if (!validateCryptoAddress(addressData.address, addressData.currency)) {
        throw new Error('Неверный адрес')
      }

      const newAddress = await store.addAddress(addressData)

      toast.add({
        severity: 'success',
        summary: 'Успешно',
        detail: 'Адрес добавлен в книгу',
        life: 3000
      })

      return newAddress
    } catch (err) {
      error.value = err.message
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: err.message,
        life: 5000
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  // Delete address from book
  const deleteAddressFromBook = async (addressId) => {
    loading.value = true
    error.value = null

    try {
      await store.deleteAddress(addressId)

      toast.add({
        severity: 'success',
        summary: 'Успешно',
        detail: 'Адрес удален',
        life: 3000
      })
    } catch (err) {
      error.value = err.message
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: err.message,
        life: 5000
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update settings
  const updateSettings = (newSettings) => {
    store.updateSettings(newSettings)

    toast.add({
      severity: 'success',
      summary: 'Успешно',
      detail: 'Настройки обновлены',
      life: 3000
    })
  }

  // Refresh exchange rates
  const refreshRates = async () => {
    try {
      await store.getExchangeRates()
    } catch (err) {
      console.error('Error refreshing rates:', err)
    }
  }

  // Get currency info
  const getCurrencyInfo = (currency) => {
    return CRYPTO_CURRENCIES[currency]
  }

  // Computed properties
  const totalBalance = computed(() => store.totalBalanceRub)
  const activeWallets = computed(() => store.activeWallets)
  const recentTransactions = computed(() => store.recentTransactions)
  const pendingTransactions = computed(() => store.pendingTransactions)
  const hasWallets = computed(() => store.state.wallets.length > 0)
  const hasTransactions = computed(() => store.state.transactions.length > 0)

  // Get wallet balance in fiat
  const getWalletBalanceFiat = (walletId) => {
    const wallet = getWallet(walletId)
    if (!wallet) return 0

    const rate = store.state.exchangeRates[wallet.currency] || 0
    return wallet.balance * rate
  }

  // Calculate portfolio distribution
  const portfolioDistribution = computed(() => {
    const total = totalBalance.value
    if (total === 0) return []

    return store.state.wallets.map(wallet => ({
      currency: wallet.currency,
      amount: wallet.balance,
      amountFiat: wallet.balanceRub,
      percentage: (wallet.balanceRub / total) * 100,
      color: CRYPTO_CURRENCIES[wallet.currency]?.color || '#666666'
    }))
  })

  // Transaction statistics
  const transactionStats = computed(() => {
    const transactions = store.state.transactions

    const incoming = transactions.filter(tx => tx.type === 'incoming')
    const outgoing = transactions.filter(tx => tx.type === 'outgoing')

    const incomingTotal = incoming.reduce((sum, tx) => sum + tx.amountRub, 0)
    const outgoingTotal = outgoing.reduce((sum, tx) => sum + tx.amountRub, 0)

    return {
      total: transactions.length,
      incoming: incoming.length,
      outgoing: outgoing.length,
      incomingTotal,
      outgoingTotal,
      netFlow: incomingTotal - outgoingTotal
    }
  })

  return {
    // State
    store,
    loading,
    error,
    totalBalance,
    activeWallets,
    recentTransactions,
    pendingTransactions,
    hasWallets,
    hasTransactions,
    portfolioDistribution,
    transactionStats,

    // Methods
    initialize,
    getWallet,
    getWalletTransactions,
    getWalletBalanceFiat,
    sendTransaction,
    addAddressToBook,
    deleteAddressFromBook,
    updateSettings,
    refreshRates,
    getCurrencyInfo,

    // Utilities
    formatCryptoAmount,
    formatFiatAmount,
    formatAddress,
    validateCryptoAddress,

    // Constants
    CRYPTO_CURRENCIES,
    TRANSACTION_STATUS
  }
}
