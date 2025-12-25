/**
 * Torgi Proxy Pool
 *
 * Пул бесплатных SOCKS5 прокси для доступа к torgi.gov.ru
 * С автоматической ротацией при сбоях
 *
 * Issue #4594: Решение проблемы блокировки IP
 */

import { SocksProxyAgent } from 'socks-proxy-agent'

// Пул бесплатных российских SOCKS5 прокси
// Проверены на torgi.gov.ru 10.12.2025
const FREE_PROXY_POOL = [
  '5.183.70.46:1080',
  '5.149.203.190:1080',
  '31.129.147.102:1080',
  '77.41.167.137:1080',
  '89.148.196.156:1080',
]

export class TorgiProxyPool {
  constructor(options = {}) {
    this.proxies = options.proxies || [...FREE_PROXY_POOL]
    this.currentIndex = 0
    this.failedProxies = new Set()
    this.lastRotation = Date.now()
    this.rotationCooldown = options.rotationCooldown || 5000 // 5 sec cooldown
    this.maxRetries = options.maxRetries || 3

    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rotations: 0
    }
  }

  /**
   * Get current proxy URL
   */
  getCurrentProxy() {
    if (this.proxies.length === 0) return null
    return `socks5://${this.proxies[this.currentIndex]}`
  }

  /**
   * Get current proxy agent for axios/fetch
   */
  getProxyAgent() {
    const proxyUrl = this.getCurrentProxy()
    if (!proxyUrl) return null

    try {
      return new SocksProxyAgent(proxyUrl)
    } catch (error) {
      console.error(`[ProxyPool] Failed to create agent: ${error.message}`)
      return null
    }
  }

  /**
   * Rotate to next proxy
   */
  rotate() {
    if (this.proxies.length <= 1) return

    const now = Date.now()
    if (now - this.lastRotation < this.rotationCooldown) {
      return // Too soon to rotate
    }

    this.currentIndex = (this.currentIndex + 1) % this.proxies.length
    this.lastRotation = now
    this.stats.rotations++

    console.log(`[ProxyPool] Rotated to proxy: ${this.proxies[this.currentIndex]}`)
  }

  /**
   * Mark current proxy as failed and rotate
   */
  markFailed() {
    const failedProxy = this.proxies[this.currentIndex]
    this.failedProxies.add(failedProxy)
    this.stats.failedRequests++

    console.log(`[ProxyPool] Marked as failed: ${failedProxy}`)
    this.rotate()
  }

  /**
   * Mark request as successful
   */
  markSuccess() {
    this.stats.successfulRequests++
    this.stats.totalRequests++
  }

  /**
   * Execute request with automatic retry and rotation
   */
  async executeWithRetry(requestFn, maxRetries = null) {
    const retries = maxRetries || this.maxRetries
    let lastError = null

    for (let attempt = 0; attempt < retries; attempt++) {
      const agent = this.getProxyAgent()
      const proxy = this.getCurrentProxy()

      if (!agent) {
        console.error('[ProxyPool] No proxy available')
        throw new Error('No proxy available in pool')
      }

      try {
        console.log(`[ProxyPool] Attempt ${attempt + 1}/${retries} via ${proxy}`)
        const result = await requestFn(agent)
        this.markSuccess()
        return result
      } catch (error) {
        lastError = error
        console.error(`[ProxyPool] Request failed: ${error.message}`)
        this.markFailed()

        if (attempt < retries - 1) {
          await new Promise(r => setTimeout(r, 500)) // Brief pause before retry
        }
      }
    }

    throw lastError || new Error('All proxy retries exhausted')
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalProxies: this.proxies.length,
      failedProxies: this.failedProxies.size,
      currentProxy: this.getCurrentProxy(),
      healthyProxies: this.proxies.length - this.failedProxies.size
    }
  }

  /**
   * Reset failed proxies (useful for periodic refresh)
   */
  resetFailed() {
    this.failedProxies.clear()
    console.log('[ProxyPool] Reset failed proxies list')
  }

  /**
   * Add new proxy to pool
   */
  addProxy(proxy) {
    if (!this.proxies.includes(proxy)) {
      this.proxies.push(proxy)
      console.log(`[ProxyPool] Added proxy: ${proxy}`)
    }
  }

  /**
   * Remove proxy from pool
   */
  removeProxy(proxy) {
    const index = this.proxies.indexOf(proxy)
    if (index > -1) {
      this.proxies.splice(index, 1)
      if (this.currentIndex >= this.proxies.length) {
        this.currentIndex = 0
      }
      console.log(`[ProxyPool] Removed proxy: ${proxy}`)
    }
  }
}

// Export default pool instance
export const defaultProxyPool = new TorgiProxyPool()

export default TorgiProxyPool
