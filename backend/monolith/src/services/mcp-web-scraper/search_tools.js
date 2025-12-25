/**
 * Search Tools (SERP)
 *
 * Search engine results page (SERP) scraping
 * Supports multiple search engines
 */

import axios from 'axios';
import { chromium } from 'playwright';
import { JSDOM } from 'jsdom';
import { config } from './config.js';
import { proxyManager } from './proxy_manager.js';
import { rateLimiter } from './rate_limiter.js';

const SEARCH_ENGINES = {
  GOOGLE: 'google',
  YANDEX: 'yandex',
  BING: 'bing',
  DUCKDUCKGO: 'duckduckgo',
};

/**
 * Search using search engine
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {string} options.engine - Search engine (google, yandex, bing, duckduckgo)
 * @param {number} options.numResults - Number of results (default: 10)
 * @param {string} options.country - Country code (RU, US, etc.)
 * @param {string} options.language - Language code
 * @returns {Promise<Object>} Search results
 */
export async function searchEngine(query, options = {}) {
  const {
    engine = 'google',
    numResults = 10,
    country = null,
    language = null,
  } = options;

  // Check rate limit
  await rateLimiter.waitForSlot('search_engine');
  await rateLimiter.recordRequest('search_engine');

  switch (engine.toLowerCase()) {
    case SEARCH_ENGINES.GOOGLE:
      return await searchGoogle(query, { numResults, country, language });

    case SEARCH_ENGINES.YANDEX:
      return await searchYandex(query, { numResults, country, language });

    case SEARCH_ENGINES.BING:
      return await searchBing(query, { numResults, country, language });

    case SEARCH_ENGINES.DUCKDUCKGO:
      return await searchDuckDuckGo(query, { numResults });

    default:
      throw new Error(`Unsupported search engine: ${engine}`);
  }
}

/**
 * Google search
 * @param {string} query - Search query
 * @param {Object} options - Options
 * @returns {Promise<Object>} Google search results
 */
async function searchGoogle(query, options) {
  const { numResults, country, language } = options;

  try {
    const proxy = proxyManager.getProxy();
    const browser = await chromium.launch({
      headless: config.browser.headless,
      proxy: proxyManager.getPlaywrightProxy(proxy),
    });

    const context = await browser.newContext({
      userAgent: config.request.userAgent,
      locale: language || 'en-US',
    });

    const page = await context.newPage();

    // Build Google search URL
    const params = new URLSearchParams({
      q: query,
      num: numResults,
      ...(country && { gl: country }),
      ...(language && { hl: language }),
    });

    const url = `https://www.google.com/search?${params}`;

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Extract search results
    const results = await page.evaluate(() => {
      const items = [];
      const resultElements = document.querySelectorAll('.g');

      resultElements.forEach((element, index) => {
        const titleEl = element.querySelector('h3');
        const linkEl = element.querySelector('a');
        const snippetEl = element.querySelector('.VwiC3b, .IsZvec');

        if (titleEl && linkEl) {
          items.push({
            position: index + 1,
            title: titleEl.textContent,
            url: linkEl.href,
            snippet: snippetEl ? snippetEl.textContent : '',
          });
        }
      });

      return items;
    });

    await browser.close();

    if (proxy) {
      proxyManager.markProxySuccessful(proxy);
    }

    return {
      success: true,
      engine: 'google',
      query,
      results,
      totalResults: results.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Google search error:', error.message);
    throw new Error(`Google search failed: ${error.message}`);
  }
}

/**
 * Yandex search
 * @param {string} query - Search query
 * @param {Object} options - Options
 * @returns {Promise<Object>} Yandex search results
 */
async function searchYandex(query, options) {
  const { numResults } = options;

  try {
    const proxy = proxyManager.getProxy();
    const browser = await chromium.launch({
      headless: config.browser.headless,
      proxy: proxyManager.getPlaywrightProxy(proxy),
    });

    const context = await browser.newContext({
      userAgent: config.request.userAgent,
    });

    const page = await context.newPage();

    const url = `https://yandex.ru/search/?text=${encodeURIComponent(query)}`;

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Extract search results
    const results = await page.evaluate(() => {
      const items = [];
      const resultElements = document.querySelectorAll('.serp-item');

      resultElements.forEach((element, index) => {
        const titleEl = element.querySelector('h2 a, .Organic-Title a');
        const snippetEl = element.querySelector('.Organic-Text, .Text');

        if (titleEl) {
          items.push({
            position: index + 1,
            title: titleEl.textContent.trim(),
            url: titleEl.href,
            snippet: snippetEl ? snippetEl.textContent.trim() : '',
          });
        }
      });

      return items;
    });

    await browser.close();

    if (proxy) {
      proxyManager.markProxySuccessful(proxy);
    }

    return {
      success: true,
      engine: 'yandex',
      query,
      results: results.slice(0, numResults),
      totalResults: results.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Yandex search error:', error.message);
    throw new Error(`Yandex search failed: ${error.message}`);
  }
}

/**
 * Bing search
 * @param {string} query - Search query
 * @param {Object} options - Options
 * @returns {Promise<Object>} Bing search results
 */
async function searchBing(query, options) {
  const { numResults } = options;

  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': config.request.userAgent,
      },
    });

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    const results = [];
    const resultElements = document.querySelectorAll('.b_algo');

    resultElements.forEach((element, index) => {
      const titleEl = element.querySelector('h2 a');
      const snippetEl = element.querySelector('.b_caption p');

      if (titleEl) {
        results.push({
          position: index + 1,
          title: titleEl.textContent.trim(),
          url: titleEl.href,
          snippet: snippetEl ? snippetEl.textContent.trim() : '',
        });
      }
    });

    return {
      success: true,
      engine: 'bing',
      query,
      results: results.slice(0, numResults),
      totalResults: results.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Bing search error:', error.message);
    throw new Error(`Bing search failed: ${error.message}`);
  }
}

/**
 * DuckDuckGo search
 * @param {string} query - Search query
 * @param {Object} options - Options
 * @returns {Promise<Object>} DuckDuckGo search results
 */
async function searchDuckDuckGo(query, options) {
  const { numResults } = options;

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': config.request.userAgent,
      },
    });

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    const results = [];
    const resultElements = document.querySelectorAll('.result');

    resultElements.forEach((element, index) => {
      const titleEl = element.querySelector('.result__title a');
      const snippetEl = element.querySelector('.result__snippet');
      const urlEl = element.querySelector('.result__url');

      if (titleEl) {
        results.push({
          position: index + 1,
          title: titleEl.textContent.trim(),
          url: titleEl.href,
          snippet: snippetEl ? snippetEl.textContent.trim() : '',
        });
      }
    });

    return {
      success: true,
      engine: 'duckduckgo',
      query,
      results: results.slice(0, numResults),
      totalResults: results.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('DuckDuckGo search error:', error.message);
    throw new Error(`DuckDuckGo search failed: ${error.message}`);
  }
}

/**
 * Batch search multiple queries
 * @param {Array<string>} queries - Search queries (max 5)
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Batch search results
 */
export async function searchEngineBatch(queries, options = {}) {
  if (queries.length > 5) {
    throw new Error('Maximum 5 queries allowed for batch search');
  }

  // Check rate limit
  await rateLimiter.waitForSlot('search_engine_batch');
  await rateLimiter.recordRequest('search_engine_batch');

  const results = [];

  // Process queries sequentially to avoid rate limits
  for (const query of queries) {
    try {
      const result = await searchEngine(query, options);
      results.push({ query, success: true, data: result });
    } catch (error) {
      results.push({ query, success: false, error: error.message });
    }
  }

  return {
    success: true,
    total: queries.length,
    results,
    timestamp: new Date().toISOString(),
  };
}

export default {
  searchEngine,
  searchEngineBatch,
  SEARCH_ENGINES,
};
