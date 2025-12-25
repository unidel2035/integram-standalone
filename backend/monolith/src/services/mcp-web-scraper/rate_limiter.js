/**
 * Rate Limiter
 *
 * Controls request frequency per tool/endpoint
 * Supports configurable rate limits (e.g., "100/1h", "1000/1d")
 */

import { config, parseRateLimit } from './config.js';

class RateLimiter {
  constructor() {
    this.requests = new Map(); // tool -> array of timestamps
    this.limits = new Map(); // tool -> {requests, window}
    this.globalLimit = null;

    this.initialize();
  }

  /**
   * Initialize rate limiter with configuration
   */
  initialize() {
    if (config.rateLimit.enabled) {
      try {
        this.globalLimit = parseRateLimit(config.rateLimit.format);
        console.log(`Rate limiter initialized: ${config.rateLimit.format}`);
      } catch (error) {
        console.error('Failed to parse rate limit:', error.message);
      }
    }
  }

  /**
   * Set rate limit for specific tool
   * @param {string} tool - Tool name
   * @param {string} limitStr - Rate limit string (e.g., "10/1m")
   */
  setToolLimit(tool, limitStr) {
    try {
      const limit = parseRateLimit(limitStr);
      this.limits.set(tool, limit);
      console.log(`Set rate limit for ${tool}: ${limitStr}`);
    } catch (error) {
      console.error(`Failed to set rate limit for ${tool}:`, error.message);
    }
  }

  /**
   * Check if request is allowed
   * @param {string} tool - Tool name
   * @returns {boolean} True if request is allowed
   */
  async checkLimit(tool) {
    const now = Date.now();

    // Check tool-specific limit
    if (this.limits.has(tool)) {
      const limit = this.limits.get(tool);
      if (!this.isAllowed(tool, now, limit)) {
        return false;
      }
    }

    // Check global limit
    if (this.globalLimit) {
      if (!this.isAllowed('_global', now, this.globalLimit)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Record request
   * @param {string} tool - Tool name
   */
  async recordRequest(tool) {
    const now = Date.now();

    // Record for tool
    if (!this.requests.has(tool)) {
      this.requests.set(tool, []);
    }
    this.requests.get(tool).push(now);

    // Record for global
    if (!this.requests.has('_global')) {
      this.requests.set('_global', []);
    }
    this.requests.get('_global').push(now);

    // Clean up old timestamps
    this.cleanup(tool);
    this.cleanup('_global');
  }

  /**
   * Check if request is allowed under limit
   * @param {string} key - Tool key or '_global'
   * @param {number} now - Current timestamp
   * @param {Object} limit - Rate limit configuration
   * @returns {boolean} True if allowed
   */
  isAllowed(key, now, limit) {
    const { requests: maxRequests, window } = limit;

    if (!this.requests.has(key)) {
      return true;
    }

    const timestamps = this.requests.get(key);
    const windowStart = now - window;

    // Count requests within window
    const recentRequests = timestamps.filter(ts => ts > windowStart);

    return recentRequests.length < maxRequests;
  }

  /**
   * Clean up old request timestamps
   * @param {string} key - Tool key
   */
  cleanup(key) {
    if (!this.requests.has(key)) {
      return;
    }

    const limit = this.limits.get(key) || this.globalLimit;
    if (!limit) {
      return;
    }

    const now = Date.now();
    const windowStart = now - limit.window;
    const timestamps = this.requests.get(key);

    // Keep only recent timestamps
    const recent = timestamps.filter(ts => ts > windowStart);
    this.requests.set(key, recent);
  }

  /**
   * Get remaining requests for tool
   * @param {string} tool - Tool name
   * @returns {number} Remaining requests in current window
   */
  getRemainingRequests(tool) {
    const limit = this.limits.get(tool) || this.globalLimit;
    if (!limit) {
      return Infinity;
    }

    const now = Date.now();
    const windowStart = now - limit.window;

    if (!this.requests.has(tool)) {
      return limit.requests;
    }

    const timestamps = this.requests.get(tool);
    const recentRequests = timestamps.filter(ts => ts > windowStart);

    return Math.max(0, limit.requests - recentRequests.length);
  }

  /**
   * Get time until next request is allowed
   * @param {string} tool - Tool name
   * @returns {number} Milliseconds until next request allowed (0 if allowed now)
   */
  getTimeUntilNextRequest(tool) {
    const limit = this.limits.get(tool) || this.globalLimit;
    if (!limit) {
      return 0;
    }

    const now = Date.now();

    if (!this.requests.has(tool)) {
      return 0;
    }

    const timestamps = this.requests.get(tool);
    const windowStart = now - limit.window;
    const recentRequests = timestamps.filter(ts => ts > windowStart);

    if (recentRequests.length < limit.requests) {
      return 0;
    }

    // Find oldest request in window
    const oldestRequest = Math.min(...recentRequests);
    const timeUntilExpire = (oldestRequest + limit.window) - now;

    return Math.max(0, timeUntilExpire);
  }

  /**
   * Get rate limit status for tool
   * @param {string} tool - Tool name
   * @returns {Object} Rate limit status
   */
  getStatus(tool) {
    const limit = this.limits.get(tool) || this.globalLimit;

    if (!limit) {
      return {
        limited: false,
        remaining: Infinity,
        resetIn: 0,
      };
    }

    const remaining = this.getRemainingRequests(tool);
    const resetIn = this.getTimeUntilNextRequest(tool);

    return {
      limited: remaining === 0,
      remaining,
      resetIn,
      limit: limit.requests,
      window: limit.window,
    };
  }

  /**
   * Wait until request is allowed
   * @param {string} tool - Tool name
   * @returns {Promise<void>} Resolves when request is allowed
   */
  async waitForSlot(tool) {
    const waitTime = this.getTimeUntilNextRequest(tool);

    if (waitTime > 0) {
      console.log(`Rate limit reached for ${tool}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Reset rate limiter for tool
   * @param {string} tool - Tool name
   */
  reset(tool) {
    this.requests.delete(tool);
    console.log(`Rate limiter reset for ${tool}`);
  }

  /**
   * Reset all rate limiters
   */
  resetAll() {
    this.requests.clear();
    console.log('All rate limiters reset');
  }

  /**
   * Get statistics
   * @returns {Object} Rate limiter statistics
   */
  getStats() {
    const stats = {
      globalLimit: this.globalLimit,
      toolLimits: Object.fromEntries(this.limits),
      tools: {},
    };

    for (const [tool, timestamps] of this.requests.entries()) {
      if (tool === '_global') continue;

      stats.tools[tool] = {
        totalRequests: timestamps.length,
        status: this.getStatus(tool),
      };
    }

    return stats;
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

export default rateLimiter;
