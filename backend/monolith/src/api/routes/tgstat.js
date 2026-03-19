// tgstat.js - TGStat API proxy routes
import express from 'express';
import axios from 'axios';
import logger from '../../utils/logger.js';

/**
 * Create TGStat proxy routes
 * This proxy allows the frontend to access TGStat API without CORS issues
 */
export function createTgstatRoutes() {
  const router = express.Router();

  const TGSTAT_BASE_URL = 'https://api.tgstat.ru/api/v1';

  // Middleware to check for API token
  const validateToken = (req, res, next) => {
    const token = req.headers['x-tgstat-token'];
    if (!token) {
      return res.status(401).json({
        error: 'TGStat API token is required',
        message: 'Please provide X-TGStat-Token header'
      });
    }
    req.tgstatToken = token;
    next();
  };

  // Generic proxy handler
  const proxyRequest = async (req, res, endpoint) => {
    try {
      const config = {
        method: req.method.toLowerCase(),
        url: `${TGSTAT_BASE_URL}${endpoint}`,
        headers: {
          'Token': req.tgstatToken,
          'Content-Type': 'application/json'
        },
        params: req.query,
        timeout: 30000
      };

      // Add body for POST/PUT requests
      if (['post', 'put', 'patch'].includes(config.method)) {
        config.data = req.body;
      }

      logger.info({ endpoint, method: req.method, params: req.query }, 'Proxying TGStat API request');

      const response = await axios(config);
      res.json(response.data);
    } catch (error) {
      logger.error({
        error: error.message,
        endpoint,
        status: error.response?.status
      }, 'TGStat API proxy error');

      if (error.response) {
        res.status(error.response.status).json({
          error: error.response.data?.error || 'TGStat API request failed',
          status: error.response.status,
          data: error.response.data
        });
      } else if (error.request) {
        res.status(503).json({
          error: 'No response from TGStat API',
          message: 'The TGStat API server did not respond'
        });
      } else {
        res.status(500).json({
          error: 'Failed to proxy request',
          message: error.message
        });
      }
    }
  };

  // Apply token validation to all routes
  router.use(validateToken);

  /**
   * GET /api/tgstat/channels/get
   * Get channel info by username or ID
   */
  router.get('/channels/get', (req, res) => {
    proxyRequest(req, res, '/channels/get');
  });

  /**
   * GET /api/tgstat/channels/stat
   * Get channel statistics
   */
  router.get('/channels/stat', (req, res) => {
    proxyRequest(req, res, '/channels/stat');
  });

  /**
   * GET /api/tgstat/channels/posts
   * Get channel posts
   */
  router.get('/channels/posts', (req, res) => {
    proxyRequest(req, res, '/channels/posts');
  });

  /**
   * GET /api/tgstat/channels/subscribers
   * Get channel subscribers statistics
   */
  router.get('/channels/subscribers', (req, res) => {
    proxyRequest(req, res, '/channels/subscribers');
  });

  /**
   * GET /api/tgstat/channels/views
   * Get channel views statistics
   */
  router.get('/channels/views', (req, res) => {
    proxyRequest(req, res, '/channels/views');
  });

  /**
   * GET /api/tgstat/channels/avg-posts-reach
   * Get channel average posts reach
   */
  router.get('/channels/avg-posts-reach', (req, res) => {
    proxyRequest(req, res, '/channels/avg-posts-reach');
  });

  /**
   * GET /api/tgstat/posts/search
   * Search posts by keywords
   */
  router.get('/posts/search', (req, res) => {
    proxyRequest(req, res, '/posts/search');
  });

  /**
   * GET /api/tgstat/words/mentions-by-period
   * Get mentions by period
   */
  router.get('/words/mentions-by-period', (req, res) => {
    proxyRequest(req, res, '/words/mentions-by-period');
  });

  /**
   * GET /api/tgstat/posts/stat
   * Get post statistics
   */
  router.get('/posts/stat', (req, res) => {
    proxyRequest(req, res, '/posts/stat');
  });

  /**
   * GET /api/tgstat/channels/search
   * Search channels
   */
  router.get('/channels/search', (req, res) => {
    proxyRequest(req, res, '/channels/search');
  });

  /**
   * GET /api/tgstat/callback/subscriptions
   * Get callback subscriptions
   */
  router.get('/callback/subscriptions', (req, res) => {
    proxyRequest(req, res, '/callback/subscriptions');
  });

  /**
   * POST /api/tgstat/callback/subscribe
   * Subscribe to channel updates via callback
   */
  router.post('/callback/subscribe', (req, res) => {
    proxyRequest(req, res, '/callback/subscribe');
  });

  /**
   * POST /api/tgstat/callback/unsubscribe
   * Unsubscribe from channel updates
   */
  router.post('/callback/unsubscribe', (req, res) => {
    proxyRequest(req, res, '/callback/unsubscribe');
  });

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'tgstat-proxy',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
