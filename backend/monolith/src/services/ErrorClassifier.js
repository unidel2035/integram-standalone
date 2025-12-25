// ErrorClassifier.js - Intelligent error categorization for resilient execution
// Issue #5306 - Robust Error Recovery: Circuit Breaker & Self-Healing
//
// Classifies errors into categories to determine appropriate recovery strategies:
// - Transient: Temporary failures that may succeed on retry (network timeouts, rate limits)
// - Permanent: Failures that won't recover (validation errors, 404s)
// - Resource: Resource exhaustion (ENOMEM, connection pool exhausted)
// - Rate Limit: API rate limiting (429 errors)
// - Unknown: Unclassified errors requiring conservative handling

import logger from '../utils/logger.js'
import metrics from '../utils/metrics.js'

/**
 * Error categories
 */
export const ErrorCategory = {
  TRANSIENT: 'transient',       // Retry immediately with backoff
  PERMANENT: 'permanent',        // Don't retry, use fallback
  RESOURCE: 'resource',          // Wait for resources, then retry
  RATE_LIMIT: 'rate_limit',      // Exponential backoff before retry
  UNKNOWN: 'unknown'             // Conservative retry with logging
}

/**
 * Error classification rules
 */
const CLASSIFICATION_RULES = [
  // Network errors (transient)
  {
    category: ErrorCategory.TRANSIENT,
    patterns: [
      /ECONNREFUSED/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /ENETUNREACH/i,
      /EHOSTUNREACH/i,
      /ENOTFOUND/i,
      /socket hang up/i,
      /network timeout/i,
      /connection timeout/i,
      /ESOCKETTIMEDOUT/i
    ],
    codes: ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH', 'ENOTFOUND'],
    statusCodes: [408, 502, 503, 504, 522, 524] // Request Timeout, Bad Gateway, Service Unavailable, Gateway Timeout, Cloudflare errors
  },

  // Rate limiting (special transient with exponential backoff)
  {
    category: ErrorCategory.RATE_LIMIT,
    patterns: [
      /rate limit/i,
      /too many requests/i,
      /quota exceeded/i,
      /throttled/i
    ],
    statusCodes: [429] // Too Many Requests
  },

  // Resource errors (transient but need resource cleanup)
  {
    category: ErrorCategory.RESOURCE,
    patterns: [
      /ENOMEM/i,
      /out of memory/i,
      /memory limit/i,
      /pool exhausted/i,
      /connection pool/i,
      /max connections/i,
      /EMFILE/i, // Too many open files
      /ENOSPC/i  // No space left on device
    ],
    codes: ['ENOMEM', 'EMFILE', 'ENOSPC']
  },

  // Permanent errors (don't retry)
  {
    category: ErrorCategory.PERMANENT,
    patterns: [
      /validation error/i,
      /invalid.*format/i,
      /malformed/i,
      /parse error/i,
      /syntax error/i,
      /not found/i,
      /forbidden/i,
      /unauthorized/i,
      /authentication failed/i,
      /permission denied/i
    ],
    statusCodes: [400, 401, 403, 404, 405, 406, 410, 422] // Client errors that won't be fixed by retry
  }
]

/**
 * ErrorClassifier - Intelligent error categorization
 *
 * Analyzes errors and classifies them into categories to determine
 * the appropriate recovery strategy:
 * - Retry immediately with backoff (transient)
 * - Wait for resources and retry (resource)
 * - Use exponential backoff (rate limit)
 * - Don't retry, use fallback (permanent)
 * - Conservative retry with logging (unknown)
 */
export class ErrorClassifier {
  constructor() {
    // Statistics
    this.stats = {
      totalClassifications: 0,
      byCategory: {
        [ErrorCategory.TRANSIENT]: 0,
        [ErrorCategory.PERMANENT]: 0,
        [ErrorCategory.RESOURCE]: 0,
        [ErrorCategory.RATE_LIMIT]: 0,
        [ErrorCategory.UNKNOWN]: 0
      },
      topErrors: new Map() // error message -> count
    }

    logger.info('ErrorClassifier initialized')
  }

  /**
   * Classify an error into a category
   *
   * @param {Error} error - Error to classify
   * @param {Object} [context] - Additional context (statusCode, response, etc.)
   * @returns {Object} Classification result with category, confidence, and metadata
   */
  classify(error, context = {}) {
    this.stats.totalClassifications++

    // Extract error details
    const errorMessage = error.message || ''
    const errorCode = error.code || context.code || null
    const statusCode = error.statusCode || error.status || context.statusCode || null

    // Track frequent errors
    const errorKey = `${errorCode || 'NO_CODE'}:${errorMessage.substring(0, 100)}`
    this.stats.topErrors.set(errorKey, (this.stats.topErrors.get(errorKey) || 0) + 1)

    // Try to match against classification rules
    for (const rule of CLASSIFICATION_RULES) {
      let matched = false
      let matchReason = null

      // Check status codes
      if (statusCode && rule.statusCodes && rule.statusCodes.includes(statusCode)) {
        matched = true
        matchReason = `statusCode:${statusCode}`
      }

      // Check error codes
      if (!matched && errorCode && rule.codes && rule.codes.includes(errorCode)) {
        matched = true
        matchReason = `errorCode:${errorCode}`
      }

      // Check patterns
      if (!matched && rule.patterns) {
        for (const pattern of rule.patterns) {
          if (pattern.test(errorMessage) || (error.stack && pattern.test(error.stack))) {
            matched = true
            matchReason = `pattern:${pattern}`
            break
          }
        }
      }

      // If matched, return classification
      if (matched) {
        this.stats.byCategory[rule.category]++

        const classification = {
          category: rule.category,
          confidence: 'high',
          matchReason,
          error: {
            message: errorMessage,
            code: errorCode,
            statusCode
          },
          metadata: {
            isRetriable: rule.category !== ErrorCategory.PERMANENT,
            requiresBackoff: [ErrorCategory.RATE_LIMIT, ErrorCategory.TRANSIENT].includes(rule.category),
            requiresResourceCleanup: rule.category === ErrorCategory.RESOURCE
          }
        }

        logger.debug(
          {
            category: rule.category,
            matchReason,
            errorMessage: errorMessage.substring(0, 200)
          },
          'Error classified'
        )

        metrics.increment('errorClassifier.classified', { category: rule.category })

        return classification
      }
    }

    // No match found - classify as UNKNOWN
    this.stats.byCategory[ErrorCategory.UNKNOWN]++

    logger.warn(
      {
        errorMessage: errorMessage.substring(0, 200),
        errorCode,
        statusCode
      },
      'Error classification failed - marked as UNKNOWN'
    )

    metrics.increment('errorClassifier.classified', { category: ErrorCategory.UNKNOWN })

    return {
      category: ErrorCategory.UNKNOWN,
      confidence: 'low',
      matchReason: null,
      error: {
        message: errorMessage,
        code: errorCode,
        statusCode
      },
      metadata: {
        isRetriable: true, // Conservative: allow retry for unknown errors
        requiresBackoff: true, // Use backoff to avoid overwhelming services
        requiresResourceCleanup: false
      }
    }
  }

  /**
   * Check if error is retriable
   *
   * @param {Error} error - Error to check
   * @param {Object} [context] - Additional context
   * @returns {boolean} True if error should be retried
   */
  isRetriable(error, context = {}) {
    const classification = this.classify(error, context)
    return classification.metadata.isRetriable
  }

  /**
   * Check if error requires exponential backoff
   *
   * @param {Error} error - Error to check
   * @param {Object} [context] - Additional context
   * @returns {boolean} True if exponential backoff is recommended
   */
  requiresBackoff(error, context = {}) {
    const classification = this.classify(error, context)
    return classification.metadata.requiresBackoff
  }

  /**
   * Get recommended retry delay based on error category
   *
   * @param {Error} error - Error that occurred
   * @param {number} attemptNumber - Current retry attempt number (0-indexed)
   * @param {Object} [context] - Additional context
   * @returns {number} Recommended delay in milliseconds
   */
  getRetryDelay(error, attemptNumber, context = {}) {
    const classification = this.classify(error, context)

    switch (classification.category) {
      case ErrorCategory.RATE_LIMIT:
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 60s
        return Math.min(1000 * Math.pow(2, attemptNumber), 60000)

      case ErrorCategory.RESOURCE:
        // Wait longer for resources: 5s, 10s, 20s, 40s, max 60s
        return Math.min(5000 * Math.pow(2, attemptNumber), 60000)

      case ErrorCategory.TRANSIENT:
        // Moderate backoff: 500ms, 1s, 2s, 4s, max 30s
        return Math.min(500 * Math.pow(2, attemptNumber), 30000)

      case ErrorCategory.UNKNOWN:
        // Conservative backoff: 2s, 4s, 8s, 16s, max 60s
        return Math.min(2000 * Math.pow(2, attemptNumber), 60000)

      case ErrorCategory.PERMANENT:
        // Don't retry permanent errors
        return Infinity

      default:
        return 1000 // Default 1 second
    }
  }

  /**
   * Get classification statistics
   *
   * @returns {Object} Statistics
   */
  getStats() {
    // Get top 10 most frequent errors
    const topErrors = Array.from(this.stats.topErrors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }))

    return {
      totalClassifications: this.stats.totalClassifications,
      byCategory: { ...this.stats.byCategory },
      topErrors
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats.totalClassifications = 0
    this.stats.byCategory = {
      [ErrorCategory.TRANSIENT]: 0,
      [ErrorCategory.PERMANENT]: 0,
      [ErrorCategory.RESOURCE]: 0,
      [ErrorCategory.RATE_LIMIT]: 0,
      [ErrorCategory.UNKNOWN]: 0
    }
    this.stats.topErrors.clear()

    logger.info('ErrorClassifier statistics reset')
  }
}

export default ErrorClassifier
