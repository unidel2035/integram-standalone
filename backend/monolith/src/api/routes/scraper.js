// scraper.js - Web scraper API routes for fetching and parsing real website data
import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../../utils/logger.js';

/**
 * Create web scraper routes
 * This endpoint allows the frontend to fetch and parse real website data
 */
export function createScraperRoutes() {
  const router = express.Router();

  /**
   * POST /api/scraper/fetch
   * Fetch and parse a website URL
   *
   * Request body:
   * {
   *   url: string - The URL to fetch
   *   options?: {
   *     timeout?: number - Request timeout in ms (default: 30000)
   *     userAgent?: string - Custom user agent
   *     followRedirects?: boolean - Follow redirects (default: true)
   *   }
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   url: string - The fetched URL
   *   title: string - Page title
   *   html: string - Full HTML content
   *   metadata?: {
   *     statusCode: number
   *     contentType: string
   *     redirected: boolean
   *     finalUrl: string
   *   }
   * }
   */
  router.post('/fetch', async (req, res) => {
    try {
      const { url, options = {} } = req.body;

      // Validate URL
      if (!url || typeof url !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'URL is required and must be a string'
        });
      }

      // Validate URL format
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error('Only HTTP and HTTPS protocols are supported');
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL format',
          message: error.message
        });
      }

      // Default options
      const timeout = options.timeout || 30000;
      const userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const followRedirects = options.followRedirects !== false;

      logger.info({ url, timeout, userAgent }, 'Fetching website');

      // Make HTTP request
      const response = await axios.get(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout,
        maxRedirects: followRedirects ? 5 : 0,
        validateStatus: (status) => status >= 200 && status < 400
      });

      // Parse HTML with cheerio to extract title
      const $ = cheerio.load(response.data);
      const title = $('title').text() || $('h1').first().text() || 'Без названия';

      // Get metadata
      const finalUrl = response.request?.res?.responseUrl || url;
      const redirected = finalUrl !== url;

      logger.info({
        url,
        finalUrl,
        statusCode: response.status,
        contentType: response.headers['content-type'],
        redirected,
        titleLength: title.length,
        htmlLength: response.data.length
      }, 'Website fetched successfully');

      res.json({
        success: true,
        url: finalUrl,
        title: title.trim(),
        html: response.data,
        metadata: {
          statusCode: response.status,
          contentType: response.headers['content-type'],
          redirected,
          finalUrl,
          originalUrl: url
        }
      });
    } catch (error) {
      logger.error({
        error: error.message,
        url: req.body?.url,
        code: error.code,
        status: error.response?.status
      }, 'Web scraping error');

      // Handle different types of errors
      if (error.response) {
        // HTTP error (4xx, 5xx)
        return res.status(error.response.status).json({
          success: false,
          error: `HTTP ${error.response.status}: ${error.response.statusText}`,
          message: 'The server returned an error response',
          statusCode: error.response.status
        });
      } else if (error.request) {
        // Network error (no response)
        return res.status(503).json({
          success: false,
          error: 'Network error',
          message: 'Could not reach the website. Please check the URL and your network connection.',
          code: error.code
        });
      } else if (error.code === 'ECONNABORTED') {
        // Timeout error
        return res.status(504).json({
          success: false,
          error: 'Request timeout',
          message: 'The website took too long to respond'
        });
      } else {
        // Other errors
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch website',
          message: error.message
        });
      }
    }
  });

  /**
   * POST /api/scraper/parse
   * Parse already-fetched HTML content with custom selectors
   *
   * Request body:
   * {
   *   html: string - The HTML content to parse
   *   selectors: {
   *     [fieldName]: {
   *       selector: string - CSS selector
   *       attribute?: string - Attribute to extract (default: text content)
   *       multiple?: boolean - Extract all matches (default: false)
   *     }
   *   }
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   data: object - Parsed data based on selectors
   * }
   */
  router.post('/parse', async (req, res) => {
    try {
      const { html, selectors } = req.body;

      if (!html || typeof html !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'HTML content is required and must be a string'
        });
      }

      if (!selectors || typeof selectors !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Selectors are required and must be an object'
        });
      }

      const $ = cheerio.load(html);
      const result = {};

      // Parse each selector
      for (const [fieldName, config] of Object.entries(selectors)) {
        const { selector, attribute, multiple = false } = config;

        if (!selector) {
          continue;
        }

        if (multiple) {
          // Extract all matches
          const elements = $(selector);
          result[fieldName] = elements.map((i, el) => {
            if (attribute) {
              return $(el).attr(attribute);
            }
            return $(el).text().trim();
          }).get();
        } else {
          // Extract first match
          const element = $(selector).first();
          if (attribute) {
            result[fieldName] = element.attr(attribute) || null;
          } else {
            result[fieldName] = element.text().trim() || null;
          }
        }
      }

      logger.info({ fieldCount: Object.keys(result).length }, 'HTML parsed successfully');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'HTML parsing error');

      res.status(500).json({
        success: false,
        error: 'Failed to parse HTML',
        message: error.message
      });
    }
  });

  /**
   * GET /api/scraper/health
   * Health check endpoint
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'web-scraper',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
