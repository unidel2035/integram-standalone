/**
 * Scraping Tools
 *
 * Core web scraping functionality for MCP server
 * Provides tools for fetching and extracting web content
 */

import axios from 'axios';
import { chromium } from 'playwright';
import { config } from './config.js';
import { proxyManager } from './proxy_manager.js';
import { rateLimiter } from './rate_limiter.js';
import { htmlToMarkdown } from './utils/html_to_markdown.js';
import { extractData } from './utils/content_extractor.js';

/**
 * Scrape page as Markdown
 * @param {string} url - URL to scrape
 * @param {Object} options - Scraping options
 * @param {string} options.waitFor - CSS selector to wait for
 * @param {number} options.timeout - Request timeout in ms
 * @param {boolean} options.useProxy - Use proxy for request
 * @param {string} options.sessionId - Session ID for sticky proxy
 * @returns {Promise<Object>} Scraped content
 */
export async function scrapeAsMarkdown(url, options = {}) {
  const {
    waitFor = null,
    timeout = config.request.timeout,
    useProxy = proxyManager.proxyList.length > 0,
    sessionId = null,
  } = options;

  // Check rate limit
  await rateLimiter.waitForSlot('scrape_as_markdown');
  await rateLimiter.recordRequest('scrape_as_markdown');

  try {
    // Get proxy if enabled
    const proxy = useProxy ? proxyManager.getProxy(sessionId) : null;

    // Fetch page with browser for JavaScript rendering
    const browser = await chromium.launch({
      headless: config.browser.headless,
      proxy: proxyManager.getPlaywrightProxy(proxy),
    });

    const context = await browser.newContext({
      userAgent: config.request.userAgent,
    });

    const page = await context.newPage();

    // Navigate to URL
    await page.goto(url, {
      timeout,
      waitUntil: 'domcontentloaded',
    });

    // Wait for specific element if requested
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 10000 }).catch(() => {
        console.warn(`Selector "${waitFor}" not found, continuing anyway`);
      });
    }

    // Get HTML content
    const html = await page.content();

    await browser.close();

    // Mark proxy as successful
    if (proxy) {
      proxyManager.markProxySuccessful(proxy);
    }

    // Convert HTML to Markdown
    const markdown = htmlToMarkdown(html, {
      preserveImages: true,
      preserveLinks: true,
      cleanContent: true,
    });

    return {
      success: true,
      url,
      markdown,
      length: markdown.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);

    // Mark proxy as failed if proxy was used
    const proxy = useProxy ? proxyManager.getProxy(sessionId) : null;
    if (proxy && error.message.includes('net::')) {
      proxyManager.markProxyFailed(proxy);
    }

    throw new Error(`Scraping failed: ${error.message}`);
  }
}

/**
 * Scrape page as HTML
 * @param {string} url - URL to scrape
 * @param {Object} options - Scraping options
 * @param {boolean} options.fullPage - Include head and scripts
 * @param {boolean} options.useProxy - Use proxy for request
 * @param {string} options.sessionId - Session ID for sticky proxy
 * @returns {Promise<Object>} HTML content
 */
export async function scrapeAsHtml(url, options = {}) {
  const {
    fullPage = false,
    useProxy = proxyManager.proxyList.length > 0,
    sessionId = null,
  } = options;

  // Check rate limit
  await rateLimiter.waitForSlot('scrape_as_html');
  await rateLimiter.recordRequest('scrape_as_html');

  try {
    const proxy = useProxy ? proxyManager.getProxy(sessionId) : null;

    // Use axios for simple HTML fetch (faster than browser)
    const response = await axios.get(url, {
      timeout: config.request.timeout,
      headers: {
        'User-Agent': config.request.userAgent,
      },
      httpsAgent: proxyManager.getProxyAgent(proxy),
      maxRedirects: 5,
    });

    if (proxy) {
      proxyManager.markProxySuccessful(proxy);
    }

    let html = response.data;

    // Remove head/scripts if not full page
    if (!fullPage) {
      html = html.replace(/<head>[\s\S]*?<\/head>/gi, '');
      html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    }

    return {
      success: true,
      url,
      html,
      length: html.length,
      contentType: response.headers['content-type'],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching HTML from ${url}:`, error.message);

    const proxy = useProxy ? proxyManager.getProxy(sessionId) : null;
    if (proxy && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
      proxyManager.markProxyFailed(proxy);
    }

    throw new Error(`HTML fetch failed: ${error.message}`);
  }
}

/**
 * Extract structured data from URL
 * @param {string} url - URL to scrape
 * @param {Object} schema - JSON Schema for extraction
 * @param {string} instructions - Additional instructions
 * @param {Object} options - Scraping options
 * @returns {Promise<Object>} Extracted data
 */
export async function extract(url, schema, instructions = '', options = {}) {
  const {
    useProxy = proxyManager.proxyList.length > 0,
    sessionId = null,
  } = options;

  // Check rate limit
  await rateLimiter.waitForSlot('extract');
  await rateLimiter.recordRequest('extract');

  try {
    // First get HTML
    const { html } = await scrapeAsHtml(url, { useProxy, sessionId });

    // Extract structured data
    const data = await extractData(html, schema, instructions);

    return {
      success: true,
      url,
      data,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error extracting data from ${url}:`, error.message);
    throw new Error(`Extraction failed: ${error.message}`);
  }
}

/**
 * Batch scrape multiple URLs
 * @param {Array<string>} urls - URLs to scrape (max 10)
 * @param {string} format - Output format ('markdown' or 'html')
 * @param {Object} options - Scraping options
 * @returns {Promise<Object>} Batch scraping results
 */
export async function scrapeBatch(urls, format = 'markdown', options = {}) {
  if (urls.length > 10) {
    throw new Error('Maximum 10 URLs allowed for batch scraping');
  }

  // Check rate limit
  await rateLimiter.waitForSlot('scrape_batch');
  await rateLimiter.recordRequest('scrape_batch');

  const results = [];
  const errors = [];

  // Process URLs in parallel (with concurrency limit)
  const concurrency = 3; // Process 3 at a time
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);

    const promises = batch.map(async (url) => {
      try {
        if (format === 'markdown') {
          const result = await scrapeAsMarkdown(url, options);
          return { url, success: true, content: result.markdown };
        } else {
          const result = await scrapeAsHtml(url, options);
          return { url, success: true, content: result.html };
        }
      } catch (error) {
        errors.push({ url, error: error.message });
        return { url, success: false, error: error.message };
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }

  return {
    success: errors.length === 0,
    total: urls.length,
    successful: results.filter(r => r.success).length,
    failed: errors.length,
    results,
    errors,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if URL is accessible
 * @param {string} url - URL to check
 * @param {Object} options - Options
 * @returns {Promise<Object>} Accessibility status
 */
export async function checkUrl(url, options = {}) {
  try {
    const response = await axios.head(url, {
      timeout: 10000,
      headers: {
        'User-Agent': config.request.userAgent,
      },
      maxRedirects: 5,
    });

    return {
      success: true,
      url,
      statusCode: response.status,
      accessible: true,
      contentType: response.headers['content-type'],
      contentLength: response.headers['content-length'],
    };
  } catch (error) {
    return {
      success: false,
      url,
      accessible: false,
      error: error.message,
      statusCode: error.response?.status || null,
    };
  }
}

export default {
  scrapeAsMarkdown,
  scrapeAsHtml,
  extract,
  scrapeBatch,
  checkUrl,
};
