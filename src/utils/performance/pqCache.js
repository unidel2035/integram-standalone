/**
 * PQ-Program Execution Cache
 *
 * Caches PQ execution results to improve performance.
 * Uses LRU (Least Recently Used) eviction policy.
 *
 * @see /CLAUDE.md - Performance optimization requirements
 */

class PQCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize
    this.cache = new Map()
    this.accessOrder = []
  }

  /**
   * Generate cache key from PQ-program
   * @private
   */
  _generateKey(pqProgram) {
    // Create deterministic key from PQ structure
    return JSON.stringify({
      from: pqProgram.from,
      where: pqProgram.where,
      select: pqProgram.select,
      transform: pqProgram.transform
    })
  }

  /**
   * Get cached result for PQ-program
   *
   * @param {Object} pqProgram - PQ-program to look up
   * @returns {Object|null} Cached result or null if not found
   */
  get(pqProgram) {
    const key = this._generateKey(pqProgram)
    const cached = this.cache.get(key)

    if (cached) {
      // Update access order (move to end for LRU)
      const index = this.accessOrder.indexOf(key)
      if (index > -1) {
        this.accessOrder.splice(index, 1)
      }
      this.accessOrder.push(key)

      // Check if result is still valid (not expired)
      if (cached.expiresAt && cached.expiresAt < Date.now()) {
        this.cache.delete(key)
        return null
      }

      return cached.result
    }

    return null
  }

  /**
   * Store PQ execution result in cache
   *
   * @param {Object} pqProgram - PQ-program that was executed
   * @param {Object} result - Execution result to cache
   * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
   */
  set(pqProgram, result, ttl = 5 * 60 * 1000) {
    const key = this._generateKey(pqProgram)

    // Evict LRU entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const lruKey = this.accessOrder.shift()
      this.cache.delete(lruKey)
    }

    // Store result with expiration
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + ttl,
      cachedAt: Date.now()
    })

    // Update access order
    this.accessOrder.push(key)
  }

  /**
   * Invalidate cache entry
   *
   * @param {Object} pqProgram - PQ-program to invalidate
   */
  invalidate(pqProgram) {
    const key = this._generateKey(pqProgram)
    this.cache.delete(key)

    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
  }

  /**
   * Invalidate all cache entries for a specific prism
   *
   * @param {string} prismId - Prism ID to invalidate
   */
  invalidatePrism(prismId) {
    const keysToInvalidate = []

    for (const [key, value] of this.cache.entries()) {
      // Parse key to check if it involves this prism
      try {
        const parsed = JSON.parse(key)
        if (parsed.from && parsed.from.includes(prismId)) {
          keysToInvalidate.push(key)
        }
      } catch (error) {
        // Ignore parse errors
      }
    }

    for (const key of keysToInvalidate) {
      this.cache.delete(key)
      const index = this.accessOrder.indexOf(key)
      if (index > -1) {
        this.accessOrder.splice(index, 1)
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear()
    this.accessOrder = []
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize) * 100
    }
  }
}

// Create global cache instance
const pqCache = new PQCache(
  parseInt(import.meta.env.VITE_MAX_CACHE_SIZE) || 100
)

export default pqCache
