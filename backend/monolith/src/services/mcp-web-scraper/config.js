/**
 * Configuration for MCP Web Scraper
 *
 * Environment variables:
 * - API_TOKEN: Authentication token for API access
 * - PROXY_LIST: Comma-separated list of proxies (ip:port:user:pass)
 * - PROXY_TYPE: Type of proxy (datacenter, residential, mobile, isp)
 * - PROXY_ROTATION: Rotation strategy (round-robin, random, sticky-session, geo-targeted)
 * - PROXY_TIMEOUT: Timeout for proxy connections in ms
 * - PROXY_RETRY_COUNT: Number of retries for failed requests
 * - RATE_LIMIT: Rate limit format (e.g., "100/1h", "1000/1d", "10/1m")
 * - MAX_CONCURRENT_BROWSERS: Maximum number of concurrent browser instances
 * - REQUEST_TIMEOUT: Request timeout in ms
 * - PRO_MODE: Enable pro features
 * - DEBUG: Enable debug logging
 * - LOG_LEVEL: Log level (debug, info, warn, error)
 * - ANTICAPTCHA_KEY: AntiCaptcha API key (optional)
 * - TWOCAPTCHA_KEY: 2Captcha API key (optional)
 */

export const config = {
  // API Configuration
  apiToken: process.env.API_TOKEN || null,

  // Proxy Configuration
  proxy: {
    list: process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [],
    type: process.env.PROXY_TYPE || 'datacenter',
    rotation: process.env.PROXY_ROTATION || 'round-robin',
    timeout: parseInt(process.env.PROXY_TIMEOUT || '30000', 10),
    retryCount: parseInt(process.env.PROXY_RETRY_COUNT || '3', 10),
  },

  // Rate Limiting
  rateLimit: {
    format: process.env.RATE_LIMIT || '1000/1d',
    enabled: !!process.env.RATE_LIMIT,
  },

  // Browser Configuration
  browser: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_BROWSERS || '5', 10),
    headless: process.env.BROWSER_HEADLESS !== 'false',
    timeout: parseInt(process.env.BROWSER_TIMEOUT || '60000', 10),
  },

  // Request Configuration
  request: {
    timeout: parseInt(process.env.REQUEST_TIMEOUT || '60000', 10),
    userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },

  // Features
  proMode: process.env.PRO_MODE === 'true',
  debug: process.env.DEBUG === 'true',
  logLevel: process.env.LOG_LEVEL || 'info',

  // CAPTCHA Solvers (optional)
  captcha: {
    anticaptchaKey: process.env.ANTICAPTCHA_KEY || null,
    twocaptchaKey: process.env.TWOCAPTCHA_KEY || null,
  },
};

/**
 * Parse rate limit string (e.g., "100/1h") into rate limit configuration
 * @param {string} rateLimitStr - Rate limit string
 * @returns {{requests: number, window: number}} Rate limit config
 */
export function parseRateLimit(rateLimitStr) {
  const match = rateLimitStr.match(/^(\d+)\/(\d+)([mhd])$/);
  if (!match) {
    throw new Error(`Invalid rate limit format: ${rateLimitStr}`);
  }

  const [, requests, duration, unit] = match;
  const requestCount = parseInt(requests, 10);
  const durationValue = parseInt(duration, 10);

  const unitMultipliers = {
    m: 60 * 1000, // minutes
    h: 60 * 60 * 1000, // hours
    d: 24 * 60 * 60 * 1000, // days
  };

  const windowMs = durationValue * unitMultipliers[unit];

  return {
    requests: requestCount,
    window: windowMs,
  };
}

/**
 * Validate configuration
 * @throws {Error} If configuration is invalid
 */
export function validateConfig() {
  if (config.proxy.list.length > 0) {
    // Validate proxy format (ip:port:user:pass)
    for (const proxy of config.proxy.list) {
      const parts = proxy.split(':');
      if (parts.length !== 4) {
        throw new Error(`Invalid proxy format: ${proxy}. Expected format: ip:port:user:pass`);
      }
    }
  }

  if (config.rateLimit.enabled) {
    try {
      parseRateLimit(config.rateLimit.format);
    } catch (error) {
      throw new Error(`Invalid rate limit format: ${error.message}`);
    }
  }

  return true;
}

export default config;
