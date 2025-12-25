/**
 * Rate Limiter for Webhook Manager
 *
 * Implements rate limiting and DDoS protection using sliding window algorithm
 *
 * Issue: #2494
 */

import logger from '../../utils/logger.js'

export class RateLimiter {
  constructor(options = {}) {
    this.maxRequestsPerMinute = options.maxRequestsPerMinute || 60
    this.maxRequestsPerHour = options.maxRequestsPerHour || 1000
    this.requests = new Map() // clientId -> timestamps array

    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000)

    logger.info('RateLimiter initialized', {
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      maxRequestsPerHour: this.maxRequestsPerHour
    })
  }

  /**
   * Check if request is within rate limits
   *
   * @param {string} clientId - Client identifier (IP, user ID, etc.)
   * @returns {boolean} True if within limits
   */
  checkLimit(clientId) {
    const now = Date.now()
    const oneMinuteAgo = now - 60 * 1000
    const oneHourAgo = now - 60 * 60 * 1000

    // Get or create client request history
    if (!this.requests.has(clientId)) {
      this.requests.set(clientId, [])
    }

    const timestamps = this.requests.get(clientId)

    // Filter out old timestamps
    const recentMinute = timestamps.filter(t => t > oneMinuteAgo)
    const recentHour = timestamps.filter(t => t > oneHourAgo)

    // Check limits
    if (recentMinute.length >= this.maxRequestsPerMinute) {
      logger.warn('Rate limit exceeded (per minute)', {
        clientId,
        requests: recentMinute.length,
        limit: this.maxRequestsPerMinute
      })
      return false
    }

    if (recentHour.length >= this.maxRequestsPerHour) {
      logger.warn('Rate limit exceeded (per hour)', {
        clientId,
        requests: recentHour.length,
        limit: this.maxRequestsPerHour
      })
      return false
    }

    // Record this request
    timestamps.push(now)
    this.requests.set(clientId, timestamps)

    return true
  }

  /**
   * Get current rate limit status for a client
   *
   * @param {string} clientId - Client identifier
   * @returns {Object} Rate limit status
   */
  getStatus(clientId) {
    const now = Date.now()
    const oneMinuteAgo = now - 60 * 1000
    const oneHourAgo = now - 60 * 60 * 1000

    const timestamps = this.requests.get(clientId) || []
    const recentMinute = timestamps.filter(t => t > oneMinuteAgo)
    const recentHour = timestamps.filter(t => t > oneHourAgo)

    return {
      requestsLastMinute: recentMinute.length,
      requestsLastHour: recentHour.length,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      maxRequestsPerHour: this.maxRequestsPerHour,
      remainingMinute: Math.max(0, this.maxRequestsPerMinute - recentMinute.length),
      remainingHour: Math.max(0, this.maxRequestsPerHour - recentHour.length)
    }
  }

  /**
   * Reset rate limits for a client
   *
   * @param {string} clientId - Client identifier
   */
  reset(clientId) {
    this.requests.delete(clientId)
    logger.info('Rate limit reset for client', { clientId })
  }

  /**
   * Cleanup old timestamps
   *
   * @private
   */
  _cleanup() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000

    for (const [clientId, timestamps] of this.requests.entries()) {
      const recent = timestamps.filter(t => t > oneHourAgo)

      if (recent.length === 0) {
        this.requests.delete(clientId)
      } else {
        this.requests.set(clientId, recent)
      }
    }

    logger.debug('Rate limiter cleanup completed', {
      activeClients: this.requests.size
    })
  }

  /**
   * Destroy rate limiter and cleanup
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.requests.clear()
    logger.info('RateLimiter destroyed')
  }
}

export default RateLimiter
