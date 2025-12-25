/**
 * Proxy Manager
 *
 * Manages proxy rotation and selection strategies
 * Supports multiple proxy types and rotation strategies
 */

import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { config } from './config.js';

export const PROXY_TYPES = {
  DATACENTER: 'datacenter',
  RESIDENTIAL: 'residential',
  MOBILE: 'mobile',
  ISP: 'isp',
};

export const ROTATION_STRATEGIES = {
  ROUND_ROBIN: 'round-robin',
  RANDOM: 'random',
  STICKY_SESSION: 'sticky-session',
  GEO_TARGETED: 'geo-targeted',
};

class ProxyManager {
  constructor() {
    this.proxyList = [];
    this.currentIndex = 0;
    this.sessionProxies = new Map(); // For sticky sessions
    this.failedProxies = new Map(); // Track failed proxies with timestamps
    this.proxyStats = new Map(); // Track proxy usage statistics

    this.initialize();
  }

  /**
   * Initialize proxy manager with configuration
   */
  initialize() {
    this.proxyList = config.proxy.list.map(proxyString => {
      const [host, port, username, password] = proxyString.split(':');
      return {
        host,
        port: parseInt(port, 10),
        username,
        password,
        type: config.proxy.type,
        failures: 0,
        lastUsed: null,
        totalRequests: 0,
        successfulRequests: 0,
      };
    });

    console.log(`Proxy Manager initialized with ${this.proxyList.length} proxies`);
  }

  /**
   * Get next proxy based on rotation strategy
   * @param {string} sessionId - Session ID for sticky sessions
   * @returns {Object|null} Proxy configuration or null if no proxies
   */
  getProxy(sessionId = null) {
    if (this.proxyList.length === 0) {
      return null;
    }

    const strategy = config.proxy.rotation;

    switch (strategy) {
      case ROTATION_STRATEGIES.ROUND_ROBIN:
        return this.getRoundRobinProxy();

      case ROTATION_STRATEGIES.RANDOM:
        return this.getRandomProxy();

      case ROTATION_STRATEGIES.STICKY_SESSION:
        return this.getStickySessionProxy(sessionId);

      case ROTATION_STRATEGIES.GEO_TARGETED:
        return this.getGeoTargetedProxy();

      default:
        return this.getRoundRobinProxy();
    }
  }

  /**
   * Round-robin proxy selection
   * @returns {Object} Proxy configuration
   */
  getRoundRobinProxy() {
    const availableProxies = this.getAvailableProxies();
    if (availableProxies.length === 0) {
      // All proxies failed, reset and try again
      this.resetFailedProxies();
      return this.proxyList[0];
    }

    const proxy = availableProxies[this.currentIndex % availableProxies.length];
    this.currentIndex++;

    this.updateProxyStats(proxy);
    return proxy;
  }

  /**
   * Random proxy selection
   * @returns {Object} Proxy configuration
   */
  getRandomProxy() {
    const availableProxies = this.getAvailableProxies();
    if (availableProxies.length === 0) {
      this.resetFailedProxies();
      return this.proxyList[Math.floor(Math.random() * this.proxyList.length)];
    }

    const randomIndex = Math.floor(Math.random() * availableProxies.length);
    const proxy = availableProxies[randomIndex];

    this.updateProxyStats(proxy);
    return proxy;
  }

  /**
   * Sticky session proxy (same proxy for same session)
   * @param {string} sessionId - Session identifier
   * @returns {Object} Proxy configuration
   */
  getStickySessionProxy(sessionId) {
    if (!sessionId) {
      return this.getRoundRobinProxy();
    }

    // Return existing proxy for this session
    if (this.sessionProxies.has(sessionId)) {
      const proxy = this.sessionProxies.get(sessionId);
      if (!this.isProxyFailed(proxy)) {
        this.updateProxyStats(proxy);
        return proxy;
      }
    }

    // Assign new proxy to session
    const proxy = this.getRoundRobinProxy();
    this.sessionProxies.set(sessionId, proxy);
    return proxy;
  }

  /**
   * Geo-targeted proxy selection
   * @param {string} targetCountry - Target country code (optional)
   * @returns {Object} Proxy configuration
   */
  getGeoTargetedProxy(targetCountry = null) {
    // For now, use random selection
    // TODO: Implement geo-targeting based on proxy metadata
    return this.getRandomProxy();
  }

  /**
   * Get list of available (non-failed) proxies
   * @returns {Array<Object>} Available proxies
   */
  getAvailableProxies() {
    const now = Date.now();
    return this.proxyList.filter(proxy => {
      if (!this.failedProxies.has(proxy.host)) {
        return true;
      }

      // Check if enough time has passed to retry failed proxy
      const failedAt = this.failedProxies.get(proxy.host);
      const retryDelay = 5 * 60 * 1000; // 5 minutes
      return now - failedAt > retryDelay;
    });
  }

  /**
   * Check if proxy is marked as failed
   * @param {Object} proxy - Proxy configuration
   * @returns {boolean} True if proxy is failed
   */
  isProxyFailed(proxy) {
    return this.failedProxies.has(proxy.host);
  }

  /**
   * Mark proxy as failed
   * @param {Object} proxy - Proxy configuration
   */
  markProxyFailed(proxy) {
    console.warn(`Marking proxy ${proxy.host}:${proxy.port} as failed`);
    this.failedProxies.set(proxy.host, Date.now());
    proxy.failures++;
  }

  /**
   * Mark proxy as successful
   * @param {Object} proxy - Proxy configuration
   */
  markProxySuccessful(proxy) {
    if (this.failedProxies.has(proxy.host)) {
      console.log(`Proxy ${proxy.host}:${proxy.port} recovered`);
      this.failedProxies.delete(proxy.host);
    }
    proxy.successfulRequests++;
  }

  /**
   * Reset all failed proxies
   */
  resetFailedProxies() {
    console.log('Resetting all failed proxies');
    this.failedProxies.clear();
  }

  /**
   * Update proxy usage statistics
   * @param {Object} proxy - Proxy configuration
   */
  updateProxyStats(proxy) {
    proxy.lastUsed = Date.now();
    proxy.totalRequests++;
  }

  /**
   * Get proxy agent for HTTP/HTTPS requests
   * @param {Object} proxy - Proxy configuration
   * @returns {HttpsProxyAgent|SocksProxyAgent|null} Proxy agent
   */
  getProxyAgent(proxy) {
    if (!proxy) {
      return null;
    }

    const auth = proxy.username && proxy.password
      ? `${proxy.username}:${proxy.password}@`
      : '';

    // Detect proxy protocol
    if (proxy.protocol === 'socks' || proxy.protocol === 'socks5') {
      const proxyUrl = `socks5://${auth}${proxy.host}:${proxy.port}`;
      return new SocksProxyAgent(proxyUrl);
    }

    // Default to HTTP/HTTPS proxy
    const proxyUrl = `http://${auth}${proxy.host}:${proxy.port}`;
    return new HttpsProxyAgent(proxyUrl);
  }

  /**
   * Get Playwright proxy configuration
   * @param {Object} proxy - Proxy configuration
   * @returns {Object|null} Playwright proxy config
   */
  getPlaywrightProxy(proxy) {
    if (!proxy) {
      return null;
    }

    return {
      server: `http://${proxy.host}:${proxy.port}`,
      username: proxy.username,
      password: proxy.password,
    };
  }

  /**
   * Get proxy statistics
   * @returns {Object} Proxy statistics
   */
  getStats() {
    return {
      totalProxies: this.proxyList.length,
      failedProxies: this.failedProxies.size,
      availableProxies: this.getAvailableProxies().length,
      activeSessions: this.sessionProxies.size,
      proxyDetails: this.proxyList.map(proxy => ({
        host: proxy.host,
        port: proxy.port,
        type: proxy.type,
        totalRequests: proxy.totalRequests,
        successfulRequests: proxy.successfulRequests,
        failures: proxy.failures,
        lastUsed: proxy.lastUsed,
        isFailed: this.isProxyFailed(proxy),
      })),
    };
  }

  /**
   * Clear session proxy
   * @param {string} sessionId - Session ID
   */
  clearSession(sessionId) {
    this.sessionProxies.delete(sessionId);
  }
}

// Export singleton instance
export const proxyManager = new ProxyManager();

export default proxyManager;
