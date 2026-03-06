/**
 * Crypto Formatting Utilities
 * Functions for formatting cryptocurrency values, addresses, and dates
 */

/**
 * Format crypto amount with proper decimals
 */
export function formatCryptoAmount(amount, currency, options = {}) {
  const {
    showSymbol = true,
    locale = 'ru-RU',
    maximumFractionDigits = null
  } = options

  if (amount === null || amount === undefined) return '0'

  const decimals = {
    BTC: 8,
    ETH: 6, // Show 6 decimals for display (actual is 18)
    USDT: 2,
    USDC: 2,
    BNB: 4,
    TON: 2
  }

  const defaultDecimals = decimals[currency] || 8
  const fractionDigits = maximumFractionDigits !== null ? maximumFractionDigits : defaultDecimals

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: fractionDigits
  }).format(amount)

  return showSymbol ? `${formatted} ${currency}` : formatted
}

/**
 * Format fiat amount (RUB)
 */
export function formatFiatAmount(amount, currency = 'RUB', options = {}) {
  const {
    showSymbol = true,
    locale = 'ru-RU'
  } = options

  if (amount === null || amount === undefined) return '0'

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)

  const symbols = {
    RUB: '₽',
    USD: '$',
    EUR: '€'
  }

  const symbol = symbols[currency] || currency
  return showSymbol ? `${formatted} ${symbol}` : formatted
}

/**
 * Format crypto address (shorten for display)
 */
export function formatAddress(address, options = {}) {
  const {
    startLength = 8,
    endLength = 6,
    separator = '...'
  } = options

  if (!address || typeof address !== 'string') return ''

  if (address.length <= startLength + endLength) return address

  const start = address.substring(0, startLength)
  const end = address.substring(address.length - endLength)

  return `${start}${separator}${end}`
}

/**
 * Format transaction hash
 */
export function formatTxHash(txHash, options = {}) {
  // Use same formatting as address
  return formatAddress(txHash, {
    startLength: 10,
    endLength: 8,
    ...options
  })
}

/**
 * Format date and time
 */
export function formatDateTime(date, options = {}) {
  const {
    locale = 'ru-RU',
    showTime = true,
    showSeconds = false
  } = options

  if (!date) return ''

  const dateObj = date instanceof Date ? date : new Date(date)

  if (isNaN(dateObj.getTime())) return 'Неверная дата'

  const dateOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }

  if (showTime) {
    dateOptions.hour = '2-digit'
    dateOptions.minute = '2-digit'
    if (showSeconds) {
      dateOptions.second = '2-digit'
    }
  }

  return new Intl.DateTimeFormat(locale, dateOptions).format(dateObj)
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date) {
  if (!date) return ''

  const dateObj = date instanceof Date ? date : new Date(date)
  if (isNaN(dateObj.getTime())) return 'Неверная дата'

  const now = new Date()
  const diffMs = now - dateObj
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSec < 60) return 'только что'
  if (diffMin < 60) return `${diffMin} мин назад`
  if (diffHours < 24) return `${diffHours} ч назад`
  if (diffDays < 7) return `${diffDays} дн назад`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед назад`

  return formatDateTime(dateObj, { showTime: false })
}

/**
 * Format percentage
 */
export function formatPercentage(value, options = {}) {
  const {
    decimals = 2,
    showSign = false
  } = options

  if (value === null || value === undefined) return '0%'

  const formatted = value.toFixed(decimals)
  const sign = showSign && value > 0 ? '+' : ''

  return `${sign}${formatted}%`
}

/**
 * Format number with compact notation (K, M, B)
 */
export function formatCompactNumber(number, options = {}) {
  const {
    decimals = 1
  } = options

  if (number === null || number === undefined) return '0'

  const absNumber = Math.abs(number)

  if (absNumber < 1000) {
    return number.toFixed(decimals)
  }

  const suffixes = ['', 'K', 'M', 'B', 'T']
  const magnitude = Math.floor(Math.log10(absNumber) / 3)
  const scaled = number / Math.pow(1000, magnitude)

  return `${scaled.toFixed(decimals)}${suffixes[magnitude]}`
}

/**
 * Get currency icon class for PrimeIcons
 */
export function getCurrencyIcon(currency) {
  const icons = {
    BTC: 'pi-bitcoin',
    ETH: 'pi-ethereum',
    USDT: 'pi-dollar',
    USDC: 'pi-dollar',
    BNB: 'pi-wallet',
    TON: 'pi-send',
    RUB: 'pi-ruble'
  }

  return icons[currency] || 'pi-circle'
}

/**
 * Get currency color
 */
export function getCurrencyColor(currency) {
  const colors = {
    BTC: '#F7931A',
    ETH: '#627EEA',
    USDT: '#26A17B',
    USDC: '#2775CA',
    BNB: '#F3BA2F',
    TON: '#0088CC'
  }

  return colors[currency] || '#666666'
}

/**
 * Get transaction status badge info
 */
export function getTransactionStatusBadge(status) {
  const badges = {
    pending: {
      severity: 'warning',
      icon: 'pi-clock',
      label: 'Ожидание'
    },
    confirming: {
      severity: 'info',
      icon: 'pi-spin pi-spinner',
      label: 'Подтверждается'
    },
    confirmed: {
      severity: 'success',
      icon: 'pi-check-circle',
      label: 'Подтверждена'
    },
    failed: {
      severity: 'danger',
      icon: 'pi-times-circle',
      label: 'Неудачная'
    },
    cancelled: {
      severity: 'secondary',
      icon: 'pi-ban',
      label: 'Отменена'
    }
  }

  return badges[status] || badges.pending
}

/**
 * Get transaction type icon
 */
export function getTransactionTypeIcon(type) {
  const icons = {
    incoming: 'pi-arrow-down',
    outgoing: 'pi-arrow-up'
  }

  return icons[type] || 'pi-arrows-h'
}

/**
 * Get transaction type color
 */
export function getTransactionTypeColor(type) {
  const colors = {
    incoming: 'green',
    outgoing: 'orange'
  }

  return colors[type] || 'gray'
}

/**
 * Format confirmations text
 */
export function formatConfirmations(confirmations, required = 6) {
  if (confirmations >= required) {
    return `${confirmations}+ подтверждений`
  }

  return `${confirmations}/${required} подтверждений`
}

/**
 * Calculate confirmation percentage
 */
export function getConfirmationPercentage(confirmations, required = 6) {
  if (confirmations >= required) return 100

  return Math.round((confirmations / required) * 100)
}

/**
 * Format blockchain explorer URL
 */
export function getExplorerUrl(currency, txHashOrAddress, type = 'tx') {
  const explorers = {
    BTC: {
      tx: `https://blockchair.com/bitcoin/transaction/${txHashOrAddress}`,
      address: `https://blockchair.com/bitcoin/address/${txHashOrAddress}`
    },
    ETH: {
      tx: `https://etherscan.io/tx/${txHashOrAddress}`,
      address: `https://etherscan.io/address/${txHashOrAddress}`
    },
    USDT: {
      tx: `https://etherscan.io/tx/${txHashOrAddress}`,
      address: `https://etherscan.io/address/${txHashOrAddress}`
    },
    USDC: {
      tx: `https://etherscan.io/tx/${txHashOrAddress}`,
      address: `https://etherscan.io/address/${txHashOrAddress}`
    },
    BNB: {
      tx: `https://bscscan.com/tx/${txHashOrAddress}`,
      address: `https://bscscan.com/address/${txHashOrAddress}`
    },
    TON: {
      tx: `https://tonscan.org/tx/${txHashOrAddress}`,
      address: `https://tonscan.org/address/${txHashOrAddress}`
    }
  }

  return explorers[currency]?.[type] || '#'
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      return success
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

export default {
  formatCryptoAmount,
  formatFiatAmount,
  formatAddress,
  formatTxHash,
  formatDateTime,
  formatRelativeTime,
  formatPercentage,
  formatCompactNumber,
  getCurrencyIcon,
  getCurrencyColor,
  getTransactionStatusBadge,
  getTransactionTypeIcon,
  getTransactionTypeColor,
  formatConfirmations,
  getConfirmationPercentage,
  getExplorerUrl,
  copyToClipboard
}
