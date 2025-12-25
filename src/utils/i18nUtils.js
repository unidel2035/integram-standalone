/**
 * Internationalization utilities for date, time, and number formatting
 */

import { getCurrentLocale } from '@/i18n'

/**
 * Format a date according to the current locale
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date
 */
export function formatDate(date, options = {}) {
  const locale = getCurrentLocale()
  const dateObj = date instanceof Date ? date : new Date(date)

  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  }

  return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj)
}

/**
 * Format a date in short format (DD.MM.YYYY or MM/DD/YYYY)
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date
 */
export function formatDateShort(date) {
  const locale = getCurrentLocale()
  const dateObj = date instanceof Date ? date : new Date(date)

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(dateObj)
}

/**
 * Format a time according to the current locale
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted time
 */
export function formatTime(date, options = {}) {
  const locale = getCurrentLocale()
  const dateObj = date instanceof Date ? date : new Date(date)

  const defaultOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...options
  }

  return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj)
}

/**
 * Format a date and time according to the current locale
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date and time
 */
export function formatDateTime(date, options = {}) {
  const locale = getCurrentLocale()
  const dateObj = date instanceof Date ? date : new Date(date)

  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  }

  return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj)
}

/**
 * Format a relative time (e.g., "2 hours ago")
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted relative time
 */
export function formatRelativeTime(date) {
  const locale = getCurrentLocale()
  const dateObj = date instanceof Date ? date : new Date(date)
  const now = new Date()
  const diffInSeconds = Math.floor((now - dateObj) / 1000)

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, 'second')
  } else if (diffInSeconds < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), 'minute')
  } else if (diffInSeconds < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour')
  } else if (diffInSeconds < 2592000) {
    return rtf.format(-Math.floor(diffInSeconds / 86400), 'day')
  } else if (diffInSeconds < 31536000) {
    return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month')
  } else {
    return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year')
  }
}

/**
 * Format a number according to the current locale
 * @param {number} number - Number to format
 * @param {Object} options - Intl.NumberFormat options
 * @returns {string} Formatted number
 */
export function formatNumber(number, options = {}) {
  const locale = getCurrentLocale()
  return new Intl.NumberFormat(locale, options).format(number)
}

/**
 * Format a currency value according to the current locale
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (e.g., 'USD', 'RUB', 'EUR')
 * @param {Object} options - Additional Intl.NumberFormat options
 * @returns {string} Formatted currency
 */
export function formatCurrency(amount, currency = 'RUB', options = {}) {
  const locale = getCurrentLocale()

  const defaultOptions = {
    style: 'currency',
    currency,
    ...options
  }

  return new Intl.NumberFormat(locale, defaultOptions).format(amount)
}

/**
 * Format a percentage according to the current locale
 * @param {number} value - Value to format (0.15 for 15%)
 * @param {Object} options - Additional Intl.NumberFormat options
 * @returns {string} Formatted percentage
 */
export function formatPercent(value, options = {}) {
  const locale = getCurrentLocale()

  const defaultOptions = {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options
  }

  return new Intl.NumberFormat(locale, defaultOptions).format(value)
}

/**
 * Format a file size in a human-readable format
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes, decimals = 2) {
  const locale = getCurrentLocale()

  if (bytes === 0) {
    return '0 Bytes'
  }

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = locale === 'en'
    ? ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
    : ['Байт', 'КБ', 'МБ', 'ГБ', 'ТБ', 'ПБ']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Parse a localized number string to a number
 * @param {string} str - Localized number string
 * @returns {number} Parsed number
 */
export function parseLocalizedNumber(str) {
  const locale = getCurrentLocale()

  // Get the decimal and thousand separators for the locale
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5)
  const decimalSeparator = parts.find(p => p.type === 'decimal')?.value || '.'
  const thousandSeparator = parts.find(p => p.type === 'group')?.value || ','

  // Remove thousand separators and replace decimal separator with '.'
  const normalized = str
    .replace(new RegExp(`\\${thousandSeparator}`, 'g'), '')
    .replace(decimalSeparator, '.')

  return parseFloat(normalized)
}

/**
 * Get the first day of the week for the current locale
 * @returns {number} 0 for Sunday, 1 for Monday, etc.
 */
export function getFirstDayOfWeek() {
  const locale = getCurrentLocale()
  // Most locales start the week on Monday (1), except some like US (0)
  return locale === 'en' ? 0 : 1
}

/**
 * Get localized day names
 * @param {string} format - 'long', 'short', or 'narrow'
 * @returns {string[]} Array of day names
 */
export function getDayNames(format = 'long') {
  const locale = getCurrentLocale()
  const formatter = new Intl.DateTimeFormat(locale, { weekday: format })
  const days = []

  // Create dates for each day of the week (starting from Monday)
  for (let i = 1; i <= 7; i++) {
    const date = new Date(2024, 0, i) // January 2024 starts on Monday
    days.push(formatter.format(date))
  }

  return days
}

/**
 * Get localized month names
 * @param {string} format - 'long', 'short', or 'narrow'
 * @returns {string[]} Array of month names
 */
export function getMonthNames(format = 'long') {
  const locale = getCurrentLocale()
  const formatter = new Intl.DateTimeFormat(locale, { month: format })
  const months = []

  for (let i = 0; i < 12; i++) {
    const date = new Date(2024, i, 1)
    months.push(formatter.format(date))
  }

  return months
}

export default {
  formatDate,
  formatDateShort,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatFileSize,
  parseLocalizedNumber,
  getFirstDayOfWeek,
  getDayNames,
  getMonthNames
}
