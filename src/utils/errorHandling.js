/**
 * Error handling utilities and constants
 * Comprehensive error handling system for production-ready applications
 */

// Error codes for different categories
export const ERROR_CODES = {
  // Authentication errors
  AUTH_001: 'INVALID_CREDENTIALS',
  AUTH_002: 'SESSION_EXPIRED',
  AUTH_003: 'UNAUTHORIZED',
  AUTH_004: 'FORBIDDEN',

  // Validation errors
  VAL_001: 'INVALID_EMAIL',
  VAL_002: 'PASSWORD_TOO_WEAK',
  VAL_003: 'REQUIRED_FIELD',
  VAL_004: 'INVALID_FORMAT',

  // Network errors
  NET_001: 'CONNECTION_TIMEOUT',
  NET_002: 'NETWORK_ERROR',
  NET_003: 'NO_INTERNET',
  NET_004: 'REQUEST_FAILED',

  // Server errors
  SRV_001: 'INTERNAL_SERVER_ERROR',
  SRV_002: 'SERVICE_UNAVAILABLE',
  SRV_003: 'BAD_GATEWAY',
  SRV_004: 'GATEWAY_TIMEOUT',

  // Client errors
  CLI_001: 'BAD_REQUEST',
  CLI_002: 'NOT_FOUND',
  CLI_003: 'UNPROCESSABLE_ENTITY',
  CLI_004: 'TOO_MANY_REQUESTS',

  // Business logic errors
  BIZ_001: 'BUSINESS_RULE_VIOLATION',
  BIZ_002: 'INSUFFICIENT_PERMISSIONS',
  BIZ_003: 'RESOURCE_CONFLICT',
  BIZ_004: 'OPERATION_FAILED',
}

// Error categories for UI handling
export const ERROR_CATEGORIES = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  SERVER: 'server',
  CLIENT: 'client',
  BUSINESS: 'business',
  UNKNOWN: 'unknown',
}

// Error severity levels
export const ERROR_SEVERITY = {
  INFO: 'info',
  WARNING: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical',
}

/**
 * Get error category based on HTTP status code or error type
 */
export function getErrorCategory(error) {
  const status = error?.response?.status || error?.status

  if (!status) {
    if (error?.code === 'ECONNABORTED' || error?.code === 'ERR_NETWORK') {
      return ERROR_CATEGORIES.NETWORK
    }
    return ERROR_CATEGORIES.UNKNOWN
  }

  if (status === 401 || status === 403) return ERROR_CATEGORIES.AUTHENTICATION
  if (status >= 400 && status < 500) return ERROR_CATEGORIES.CLIENT
  if (status >= 500) return ERROR_CATEGORIES.SERVER

  return ERROR_CATEGORIES.UNKNOWN
}

/**
 * Get error severity based on category and status
 */
export function getErrorSeverity(error) {
  const status = error?.response?.status || error?.status
  const category = getErrorCategory(error)

  if (status >= 500) return ERROR_SEVERITY.CRITICAL
  if (category === ERROR_CATEGORIES.AUTHENTICATION) return ERROR_SEVERITY.ERROR
  if (category === ERROR_CATEGORIES.VALIDATION) return ERROR_SEVERITY.WARNING

  return ERROR_SEVERITY.ERROR
}

/**
 * Get user-friendly error message based on error
 */
export function getUserFriendlyMessage(error, t = (key) => key) {
  const status = error?.response?.status || error?.status
  const category = getErrorCategory(error)

  // Check if error has a custom message from backend
  const backendMessage = error?.response?.data?.error?.message || error?.response?.data?.message
  if (backendMessage && typeof backendMessage === 'string') {
    return backendMessage
  }

  // Network errors
  if (category === ERROR_CATEGORIES.NETWORK) {
    if (error?.code === 'ECONNABORTED') {
      return t('errors.network.timeout')
    }
    if (error?.code === 'ERR_NETWORK' || !navigator.onLine) {
      return t('errors.network.offline')
    }
    return t('errors.network.generic')
  }

  // HTTP status-based messages
  switch (status) {
    case 400:
      return t('errors.client.badRequest')
    case 401:
      return t('errors.auth.sessionExpired')
    case 403:
      return t('errors.auth.forbidden')
    case 404:
      return t('errors.client.notFound')
    case 408:
      return t('errors.network.timeout')
    case 409:
      return t('errors.client.conflict')
    case 422:
      return t('errors.validation.generic')
    case 429:
      return t('errors.client.tooManyRequests')
    case 500:
      return t('errors.server.internal')
    case 502:
      return t('errors.server.badGateway')
    case 503:
      return t('errors.server.unavailable')
    case 504:
      return t('errors.server.gatewayTimeout')
    default:
      return t('errors.unknown')
  }
}

/**
 * Get actionable suggestion for the error
 */
export function getErrorSuggestion(error, t = (key) => key) {
  const status = error?.response?.status || error?.status
  const category = getErrorCategory(error)

  if (category === ERROR_CATEGORIES.NETWORK) {
    return t('errors.suggestions.checkConnection')
  }

  switch (status) {
    case 401:
      return t('errors.suggestions.loginAgain')
    case 403:
      return t('errors.suggestions.contactSupport')
    case 404:
      return t('errors.suggestions.checkUrl')
    case 429:
      return t('errors.suggestions.waitAndRetry')
    case 500:
    case 502:
    case 503:
    case 504:
      return t('errors.suggestions.tryLater')
    default:
      return t('errors.suggestions.refresh')
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error) {
  const status = error?.response?.status || error?.status
  const retryableStatuses = [408, 429, 500, 502, 503, 504]
  const retryableCodes = ['ECONNABORTED', 'ERR_NETWORK']

  return (
    retryableStatuses.includes(status) ||
    retryableCodes.includes(error?.code)
  )
}

/**
 * Format validation errors from backend
 */
export function formatValidationErrors(error) {
  const errors = error?.response?.data?.error?.details ||
                 error?.response?.data?.errors ||
                 []

  if (Array.isArray(errors)) {
    return errors.map(err => ({
      field: err.field || err.param,
      message: err.message || err.msg,
    }))
  }

  if (typeof errors === 'object') {
    return Object.entries(errors).map(([field, message]) => ({
      field,
      message: Array.isArray(message) ? message[0] : message,
    }))
  }

  return []
}

/**
 * Create structured error log for debugging
 */
export function createErrorLog(error, context = {}) {
  return {
    timestamp: new Date().toISOString(),
    message: error?.message || 'Unknown error',
    stack: error?.stack,
    status: error?.response?.status || error?.status,
    statusText: error?.response?.statusText,
    url: error?.config?.url || error?.request?.url,
    method: error?.config?.method,
    category: getErrorCategory(error),
    severity: getErrorSeverity(error),
    context,
    data: error?.response?.data,
    code: error?.code,
    browser: {
      userAgent: navigator.userAgent,
      onLine: navigator.onLine,
      language: navigator.language,
    },
  }
}

/**
 * Should show error to user (vs just logging it)
 */
export function shouldShowToUser(error) {
  const status = error?.response?.status || error?.status

  // Don't show 401 in toast (handled by redirect to login)
  if (status === 401) return false

  // Don't show cancelled requests
  if (error?.code === 'ERR_CANCELED') return false

  return true
}

/**
 * Default error messages in Russian (fallback if i18n not available)
 */
export const DEFAULT_ERROR_MESSAGES = {
  'errors.network.timeout': 'Превышено время ожидания. Пожалуйста, попробуйте снова.',
  'errors.network.offline': 'Нет подключения к интернету. Проверьте ваше соединение.',
  'errors.network.generic': 'Ошибка подключения. Пожалуйста, попробуйте позже.',
  'errors.auth.sessionExpired': 'Ваша сессия истекла. Пожалуйста, войдите снова.',
  'errors.auth.forbidden': 'У вас нет доступа к этому ресурсу.',
  'errors.client.badRequest': 'Некорректный запрос. Пожалуйста, проверьте введенные данные.',
  'errors.client.notFound': 'Запрашиваемый ресурс не найден.',
  'errors.client.conflict': 'Конфликт данных. Возможно, ресурс уже существует.',
  'errors.client.tooManyRequests': 'Слишком много запросов. Пожалуйста, подождите немного.',
  'errors.validation.generic': 'Ошибка валидации данных.',
  'errors.server.internal': 'Внутренняя ошибка сервера. Мы уже работаем над исправлением.',
  'errors.server.badGateway': 'Ошибка шлюза. Пожалуйста, попробуйте позже.',
  'errors.server.unavailable': 'Сервис временно недоступен. Пожалуйста, попробуйте позже.',
  'errors.server.gatewayTimeout': 'Превышено время ожидания ответа от сервера.',
  'errors.unknown': 'Произошла неизвестная ошибка. Пожалуйста, попробуйте снова.',
  'errors.suggestions.checkConnection': 'Проверьте подключение к интернету',
  'errors.suggestions.loginAgain': 'Пожалуйста, войдите в систему снова',
  'errors.suggestions.contactSupport': 'Обратитесь в службу поддержки',
  'errors.suggestions.checkUrl': 'Проверьте правильность адреса',
  'errors.suggestions.waitAndRetry': 'Подождите немного и попробуйте снова',
  'errors.suggestions.tryLater': 'Попробуйте позже',
  'errors.suggestions.refresh': 'Обновите страницу',
}

/**
 * Get translated message or fallback to default
 */
export function getTranslatedMessage(key, t) {
  if (!t || typeof t !== 'function') {
    return DEFAULT_ERROR_MESSAGES[key] || key
  }

  const translated = t(key)
  // If translation returns the same key, use default message
  if (translated === key) {
    return DEFAULT_ERROR_MESSAGES[key] || key
  }

  return translated
}
