/**
 * Number Formatting Utilities for DataTable (Issue #6867)
 *
 * Provides various number display formats similar to Coda.io:
 * - Number (with thousand separators, decimal places)
 * - Currency (with currency symbols)
 * - Percent (with optional division by 100)
 * - Progress bar (horizontal fill bar)
 * - Ring/circular progress (SVG circle)
 * - Stars rating (★★★☆☆)
 * - Checkbox from number (0/1 → ☐/☑)
 */

/**
 * Parse number format configuration from column attributes
 * Format: :fmt=currency:cur=RUB:dec=2:sep=space:
 *
 * @param {string} attrs - Column attributes string
 * @returns {Object} - Parsed format configuration
 */
export function parseNumberFormat(attrs) {
  if (!attrs) {
    return {
      type: 'number',
      decimals: 0,
      separator: 'space',
      currency: 'RUB',
      currencyPosition: 'before',
      min: 0,
      max: 100,
      color: '#4CAF50',
      maxStars: 5,
      showValue: true,
      divideBy100: false // For percent: whether to divide value by 100 or display as-is
    }
  }

  const config = {
    type: 'number',
    decimals: 0,
    separator: 'space',
    currency: 'RUB',
    currencyPosition: 'before',
    min: 0,
    max: 100,
    color: '#4CAF50',
    maxStars: 5,
    showValue: true,
    divideBy100: false
  }

  // Parse key=value pairs from attrs: :fmt=currency:cur=USD:dec=2:
  const segments = attrs.split(':').filter(s => s.trim())

  for (const segment of segments) {
    if (!segment.includes('=')) continue

    const eqIdx = segment.indexOf('=')
    const key = segment.substring(0, eqIdx).trim()
    const value = segment.substring(eqIdx + 1).trim()

    switch (key) {
      case 'fmt':
        config.type = value
        break
      case 'dec':
        config.decimals = parseInt(value, 10) || 0
        break
      case 'sep':
        config.separator = value
        break
      case 'cur':
        config.currency = value
        break
      case 'curpos':
        config.currencyPosition = value
        break
      case 'min':
        config.min = parseFloat(value) || 0
        break
      case 'max':
        config.max = parseFloat(value) || 100
        break
      case 'color':
        config.color = value
        break
      case 'stars':
        config.maxStars = parseInt(value, 10) || 5
        break
      case 'showval':
        config.showValue = value === '1' || value === 'true'
        break
      case 'div100':
        config.divideBy100 = value === '1' || value === 'true'
        break
    }
  }

  return config
}

/**
 * Build attributes string from number format configuration
 *
 * @param {Object} config - Format configuration
 * @returns {string} - Attributes string
 */
export function buildNumberFormatAttrs(config) {
  const parts = []

  if (config.type && config.type !== 'number') {
    parts.push(`fmt=${config.type}`)
  }
  if (config.decimals !== undefined && config.decimals !== 0) {
    parts.push(`dec=${config.decimals}`)
  }
  if (config.separator && config.separator !== 'space') {
    parts.push(`sep=${config.separator}`)
  }
  if (config.type === 'currency') {
    parts.push(`cur=${config.currency || 'RUB'}`)
    if (config.currencyPosition && config.currencyPosition !== 'before') {
      parts.push(`curpos=${config.currencyPosition}`)
    }
  }
  if (config.type === 'progress' || config.type === 'ring') {
    if (config.min !== undefined && config.min !== 0) {
      parts.push(`min=${config.min}`)
    }
    if (config.max !== undefined && config.max !== 100) {
      parts.push(`max=${config.max}`)
    }
    if (config.color && config.color !== '#4CAF50') {
      parts.push(`color=${config.color}`)
    }
    if (config.showValue === false) {
      parts.push('showval=0')
    }
  }
  if (config.type === 'stars' && config.maxStars && config.maxStars !== 5) {
    parts.push(`stars=${config.maxStars}`)
  }
  if (config.type === 'percent' && config.divideBy100) {
    parts.push('div100=1')
  }

  return parts.length > 0 ? `:${parts.join(':')}:` : ''
}

/**
 * Format number with thousand separators
 *
 * @param {number} num - Number to format
 * @param {string} separator - Separator type ('space', 'comma', 'dot', 'none')
 * @param {number} decimals - Number of decimal places
 * @returns {string} - Formatted number string
 */
export function formatThousands(num, separator = 'space', decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return ''

  const fixed = Number(num).toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')

  let formattedInt
  switch (separator) {
    case 'comma':
      formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      break
    case 'dot':
      formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      break
    case 'space':
      formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
      break
    case 'none':
    default:
      formattedInt = intPart
      break
  }

  return decimals > 0 && decPart ? `${formattedInt}.${decPart}` : formattedInt
}

/**
 * Get currency symbol for a given currency code
 *
 * @param {string} currency - Currency code (RUB, USD, EUR, etc.)
 * @returns {string} - Currency symbol
 */
export function getCurrencySymbol(currency) {
  const symbols = {
    RUB: '₽',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    CHF: '₣',
    INR: '₹',
    KRW: '₩',
    BRL: 'R$',
    CAD: 'C$',
    AUD: 'A$',
    NZD: 'NZ$',
    MXN: 'MX$',
    ZAR: 'R',
    TRY: '₺',
    PLN: 'zł',
    SEK: 'kr',
    NOK: 'kr',
    DKK: 'kr',
    CZK: 'Kč',
    HUF: 'Ft'
  }

  return symbols[currency] || currency
}

/**
 * Format number as currency
 *
 * @param {number} value - Number value
 * @param {Object} config - Format configuration
 * @returns {string} - HTML string with formatted currency
 */
export function formatCurrency(value, config) {
  const num = parseFloat(value)
  if (isNaN(num)) return ''

  const symbol = getCurrencySymbol(config.currency)
  const formatted = formatThousands(num, config.separator, config.decimals)

  const displayValue = config.currencyPosition === 'after'
    ? `${formatted} ${symbol}`
    : `${symbol} ${formatted}`

  return `<span class="cell-number cell-currency">${displayValue}</span>`
}

/**
 * Format number as percentage
 *
 * @param {number} value - Number value
 * @param {Object} config - Format configuration
 * @returns {string} - HTML string with formatted percentage
 */
export function formatPercent(value, config) {
  let num = parseFloat(value)
  if (isNaN(num)) return ''

  // If divideBy100 is true, multiply by 100 (assuming value is 0-1 range)
  // If false, assume value is already in 0-100 range
  if (config.divideBy100) {
    num = num * 100
  }

  const formatted = formatThousands(num, config.separator, config.decimals)

  return `<span class="cell-number cell-percent">${formatted}%</span>`
}

/**
 * Format number as progress bar
 *
 * @param {number} value - Number value
 * @param {Object} config - Format configuration
 * @returns {string} - HTML string with progress bar
 */
export function formatProgressBar(value, config) {
  const num = parseFloat(value)
  if (isNaN(num)) return ''

  const min = config.min || 0
  const max = config.max || 100
  const percent = Math.min(100, Math.max(0, ((num - min) / (max - min)) * 100))

  const displayValue = config.showValue !== false
    ? `<span class="progress-value">${formatThousands(num, 'none', config.decimals || 0)}</span>`
    : ''

  return `<div class="cell-progress-bar">
    <div class="progress-bar-bg">
      <div class="progress-bar-fill" style="width: ${percent}%; background-color: ${config.color || '#4CAF50'}"></div>
    </div>
    ${displayValue}
  </div>`
}

/**
 * Format number as circular progress (ring)
 *
 * @param {number} value - Number value
 * @param {Object} config - Format configuration
 * @returns {string} - HTML string with SVG ring
 */
export function formatRing(value, config) {
  const num = parseFloat(value)
  if (isNaN(num)) return ''

  const min = config.min || 0
  const max = config.max || 100
  const percent = Math.min(100, Math.max(0, ((num - min) / (max - min)) * 100))

  // SVG circle parameters
  const radius = 14
  const stroke = 3
  const normalizedRadius = radius - stroke / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - (percent / 100) * circumference

  const displayValue = config.showValue !== false
    ? `<span class="ring-value">${formatThousands(num, 'none', config.decimals || 0)}</span>`
    : ''

  return `<div class="cell-ring-progress">
    <svg width="32" height="32" class="ring-svg">
      <circle
        stroke="#e0e0e0"
        fill="transparent"
        stroke-width="${stroke}"
        r="${normalizedRadius}"
        cx="16"
        cy="16"
      />
      <circle
        stroke="${config.color || '#4CAF50'}"
        fill="transparent"
        stroke-width="${stroke}"
        stroke-dasharray="${circumference} ${circumference}"
        style="stroke-dashoffset: ${strokeDashoffset}"
        stroke-linecap="round"
        r="${normalizedRadius}"
        cx="16"
        cy="16"
        transform="rotate(-90 16 16)"
      />
    </svg>
    ${displayValue}
  </div>`
}

/**
 * Format number as star rating
 *
 * @param {number} value - Number value (1-5 or 1-10 depending on maxStars)
 * @param {Object} config - Format configuration
 * @returns {string} - HTML string with star rating
 */
export function formatStars(value, config) {
  const num = Math.round(parseFloat(value))
  if (isNaN(num)) return ''

  const maxStars = config.maxStars || 5
  const stars = Math.min(maxStars, Math.max(0, num))

  let html = '<span class="cell-stars">'
  for (let i = 0; i < maxStars; i++) {
    if (i < stars) {
      html += '<i class="pi pi-star-fill star-filled"></i>'
    } else {
      html += '<i class="pi pi-star star-empty"></i>'
    }
  }
  html += '</span>'

  return html
}

/**
 * Format number as checkbox (0 → ☐, 1 → ☑)
 *
 * @param {number} value - Number value (0 or 1)
 * @returns {string} - HTML string with checkbox
 */
export function formatCheckbox(value) {
  const num = parseFloat(value)
  const checked = num === 1 || num > 0

  if (checked) {
    return '<span class="cell-number-checkbox cell-checkbox-checked"><i class="pi pi-check-square"></i></span>'
  } else {
    return '<span class="cell-number-checkbox cell-checkbox-unchecked"><i class="pi pi-stop"></i></span>'
  }
}

/**
 * Main formatting function - routes to appropriate formatter based on config
 *
 * @param {number} value - Number value
 * @param {Object} config - Format configuration
 * @returns {string} - HTML string with formatted number
 */
export function formatNumber(value, config) {
  if (!config || !config.type || config.type === 'number') {
    // Default number formatting with thousand separators
    const num = parseFloat(value)
    if (isNaN(num)) return value

    const formatted = formatThousands(num, config?.separator || 'space', config?.decimals || 0)
    const negativeClass = num < 0 ? ' cell-number-negative' : ''

    return `<span class="cell-number cell-number-formatted${negativeClass}">${formatted}</span>`
  }

  switch (config.type) {
    case 'currency':
      return formatCurrency(value, config)
    case 'percent':
      return formatPercent(value, config)
    case 'progress':
      return formatProgressBar(value, config)
    case 'ring':
      return formatRing(value, config)
    case 'stars':
      return formatStars(value, config)
    case 'checkbox':
      return formatCheckbox(value)
    default:
      return formatThousands(parseFloat(value), config.separator, config.decimals)
  }
}
