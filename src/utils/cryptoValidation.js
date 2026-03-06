/**
 * Crypto Address Validation Utilities
 *
 * NOTE: These are BASIC client-side validations.
 * ALWAYS perform additional server-side validation with specialized libraries!
 *
 * Recommended backend libraries:
 * - Bitcoin: bitcoinjs-lib
 * - Ethereum: web3.js, ethers.js
 * - Multi-chain: multicoin-address-validator
 */

/**
 * Validate Bitcoin address
 */
export function validateBitcoinAddress(address) {
  if (!address || typeof address !== 'string') return false

  // Legacy P2PKH (starts with 1)
  const p2pkhRegex = /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/

  // P2SH (starts with 3)
  const p2shRegex = /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/

  // Bech32 (Native SegWit, starts with bc1)
  const bech32Regex = /^bc1[a-z0-9]{39,59}$/

  return p2pkhRegex.test(address) || p2shRegex.test(address) || bech32Regex.test(address)
}

/**
 * Validate Ethereum address
 */
export function validateEthereumAddress(address) {
  if (!address || typeof address !== 'string') return false

  // Must start with 0x and be 42 characters total (0x + 40 hex chars)
  const ethRegex = /^0x[a-fA-F0-9]{40}$/

  return ethRegex.test(address)
}

/**
 * Validate Tether (USDT) address
 * USDT can be on multiple chains (ERC-20, TRC-20, BEP-20)
 */
export function validateUSDTAddress(address, chain = 'ERC20') {
  if (!address || typeof address !== 'string') return false

  switch (chain.toUpperCase()) {
    case 'ERC20':
      return validateEthereumAddress(address)

    case 'TRC20':
      // TRON addresses start with T
      return /^T[a-zA-Z0-9]{33}$/.test(address)

    case 'BEP20':
      // Binance Smart Chain (similar to Ethereum)
      return validateEthereumAddress(address)

    default:
      // Default to ERC-20
      return validateEthereumAddress(address)
  }
}

/**
 * Validate TON address
 */
export function validateTONAddress(address) {
  if (!address || typeof address !== 'string') return false

  // TON addresses typically start with EQ or UQ
  // Format: [EU]Q + 46 base64url characters
  const tonRegex = /^[EU]Q[a-zA-Z0-9_-]{46}$/

  return tonRegex.test(address)
}

/**
 * Validate Binance Coin (BNB) address
 * BNB on BSC uses Ethereum-like addresses
 * BNB on Binance Chain uses different format
 */
export function validateBNBAddress(address, chain = 'BSC') {
  if (!address || typeof address !== 'string') return false

  if (chain.toUpperCase() === 'BSC') {
    return validateEthereumAddress(address)
  }

  // Binance Chain addresses start with bnb
  return /^bnb1[a-z0-9]{38}$/.test(address)
}

/**
 * Universal validator - detects currency and validates
 */
export function validateCryptoAddress(address, currency) {
  if (!address || !currency) return false

  const validators = {
    BTC: validateBitcoinAddress,
    ETH: validateEthereumAddress,
    USDT: validateUSDTAddress,
    USDC: validateEthereumAddress,
    BNB: validateBNBAddress,
    TON: validateTONAddress
  }

  const validator = validators[currency.toUpperCase()]
  return validator ? validator(address) : false
}

/**
 * Detect cryptocurrency type from address format
 */
export function detectCurrency(address) {
  if (!address || typeof address !== 'string') return null

  if (validateBitcoinAddress(address)) return 'BTC'
  if (validateEthereumAddress(address)) return 'ETH' // Could also be USDT, USDC, BNB on BSC
  if (validateTONAddress(address)) return 'TON'
  if (/^T[a-zA-Z0-9]{33}$/.test(address)) return 'USDT' // TRC-20
  if (/^bnb1[a-z0-9]{38}$/.test(address)) return 'BNB' // Binance Chain

  return null
}

/**
 * Validate transaction amount
 */
export function validateAmount(amount, currency) {
  if (amount === null || amount === undefined || amount === '') return false

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(numAmount) || numAmount <= 0) return false

  // Check minimum amounts (dust limits)
  const minimums = {
    BTC: 0.00001, // 1000 satoshis
    ETH: 0.000001,
    USDT: 0.01,
    USDC: 0.01,
    BNB: 0.00001,
    TON: 0.001
  }

  const minimum = minimums[currency.toUpperCase()] || 0
  if (numAmount < minimum) return false

  // Check decimal places
  const decimals = {
    BTC: 8,
    ETH: 18,
    USDT: 6,
    USDC: 6,
    BNB: 18,
    TON: 9
  }

  const maxDecimals = decimals[currency.toUpperCase()] || 8
  const amountStr = numAmount.toString()
  if (amountStr.includes('.')) {
    const decimalPlaces = amountStr.split('.')[1].length
    if (decimalPlaces > maxDecimals) return false
  }

  return true
}

/**
 * Validate transaction note
 */
export function validateNote(note) {
  if (!note) return true // Note is optional

  if (typeof note !== 'string') return false
  if (note.length > 500) return false // Max 500 characters

  // Check for potentially dangerous content
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i
  ]

  return !dangerousPatterns.some(pattern => pattern.test(note))
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input

  return input
    .replace(/<script.*?>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
}

/**
 * Validate wallet name
 */
export function validateWalletName(name) {
  if (!name || typeof name !== 'string') return false
  if (name.length < 3 || name.length > 50) return false

  // Allow alphanumeric, spaces, and some special characters
  return /^[a-zA-Zа-яА-Я0-9\s\-_()]+$/.test(name)
}

/**
 * Check if address is a contract (requires backend check)
 * This is a placeholder - actual check must be done on backend
 */
export function isContractAddress(address) {
  // TODO: Implement backend check
  // For now, just check format
  return validateEthereumAddress(address)
}

export default {
  validateBitcoinAddress,
  validateEthereumAddress,
  validateUSDTAddress,
  validateTONAddress,
  validateBNBAddress,
  validateCryptoAddress,
  detectCurrency,
  validateAmount,
  validateNote,
  validateWalletName,
  sanitizeInput,
  isContractAddress
}
