/**
 * Claude Proxy Layer Routes
 * Issue #3241: Proxy Chat.vue → backend/monolith → claude-proxy-layer → Claude Code
 *
 * This provides HTTP API endpoints that proxy requests to the claude-proxy-layer server.
 * The claude-proxy-layer server provides direct access to Claude Code CLI via OAuth authentication.
 *
 * Architecture:
 * Chat.vue → backend/monolith (/api/claude-proxy-layer/*) → claude-proxy-layer (http://193.239.166.31:3002) → Claude Code (OAuth)
 */

import express from 'express';
import logger from '../../utils/logger.js';

// Claude proxy layer configuration
const CLAUDE_PROXY_LAYER_URL = process.env.CLAUDE_PROXY_LAYER_URL || 'http://193.239.166.31:3002';
const CLAUDE_PROXY_API_BASE = `${CLAUDE_PROXY_LAYER_URL}/api/claude-code`;

export function createClaudeProxyLayerRoutes() {
  const router = express.Router();

  /**
   * POST /api/claude-proxy-layer/chat
   * Send a message to Claude Code via proxy layer (streaming response)
   *
   * Request body:
   * - sessionId: string (required) - Session identifier
   * - message: string (required) - User message
   */
  router.post('/chat', async (req, res) => {
    try {
      const { sessionId, message } = req.body;

      if (!sessionId || !message) {
        return res.status(400).json({
          success: false,
          error: 'sessionId and message are required',
        });
      }

      logger.info(
        { sessionId, messageLength: message.length, proxyUrl: CLAUDE_PROXY_API_BASE },
        'Proxying chat request to claude-proxy-layer'
      );

      // Forward request to claude-proxy-layer
      const response = await fetch(`${CLAUDE_PROXY_API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status} ${response.statusText}`;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // Error response is not JSON, use status text
          errorMessage = errorText || errorMessage;
        }

        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            errorMessage,
            sessionId
          },
          'Claude proxy layer returned error'
        );

        return res.status(response.status).json({
          success: false,
          error: 'Claude proxy layer error',
          message: errorMessage,
        });
      }

      // Stream response from claude-proxy-layer to client
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.removeHeader('Content-Length');

      // Pipe the streaming response
      response.body.on('data', (chunk) => {
        res.write(chunk);
      });

      response.body.on('end', () => {
        res.end();
        logger.info({ sessionId }, 'Claude proxy layer chat completed');
      });

      response.body.on('error', (error) => {
        logger.error({ error: error.message, sessionId }, 'Stream error from claude-proxy-layer');
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Stream error',
            message: error.message,
          });
        } else {
          res.end();
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to proxy chat request to claude-proxy-layer');

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to proxy chat request',
          message: error.message,
        });
      } else {
        res.end();
      }
    }
  });

  /**
   * GET /api/claude-proxy-layer/models
   * Get available Claude models from proxy layer
   */
  router.get('/models', async (req, res) => {
    try {
      logger.debug('Fetching Claude models via proxy layer');

      const response = await fetch(`${CLAUDE_PROXY_API_BASE}/models`, {
        method: 'GET',
      });

      const data = await response.json();

      logger.debug({ modelsCount: data.models?.length }, 'Claude models fetched');

      res.json(data);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to fetch Claude models');
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Claude models',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/claude-proxy-layer/check-token-health
   * Check the health of the Claude OAuth token
   */
  router.post('/check-token-health', async (req, res) => {
    try {
      logger.info('Checking Claude token health via proxy layer');

      const response = await fetch(`${CLAUDE_PROXY_API_BASE}/check-token-health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      logger.info({ tokenHealth: data }, 'Token health check result');

      res.json(data);
    } catch (error) {
      logger.error({ error: error.message }, 'Token health check failed');
      res.status(500).json({
        success: false,
        error: 'Token health check failed',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/claude-proxy-layer/health
   * Health check for claude-proxy-layer service
   */
  router.get('/health', async (req, res) => {
    try {
      logger.debug('Health check for claude-proxy-layer');

      const response = await fetch(`${CLAUDE_PROXY_LAYER_URL}/health`, {
        method: 'GET',
      });

      // Read response as text first to handle incorrect Content-Type
      const responseText = await response.text();

      // Try to parse as JSON
      let healthData;
      try {
        healthData = JSON.parse(responseText);
      } catch (parseError) {
        logger.error(
          {
            contentType: response.headers.get('content-type'),
            responseText: responseText.substring(0, 200),
            error: parseError.message
          },
          'Health response is not valid JSON'
        );
        return res.status(500).json({
          status: 'error',
          service: 'claude-proxy-layer',
          message: 'Health endpoint returned non-JSON response',
          proxyUrl: CLAUDE_PROXY_LAYER_URL,
        });
      }

      res.json({
        ...healthData,
        proxyUrl: CLAUDE_PROXY_LAYER_URL,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Health check failed');
      res.status(500).json({
        status: 'error',
        service: 'claude-proxy-layer',
        error: error.message,
        proxyUrl: CLAUDE_PROXY_LAYER_URL,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/claude-proxy-layer/diagnostic
   * Diagnostic endpoint for claude-proxy-layer
   */
  router.get('/diagnostic', async (req, res) => {
    try {
      const response = await fetch(`${CLAUDE_PROXY_LAYER_URL}/diagnostic`, {
        method: 'GET',
      });

      const data = await response.text();
      res.setHeader('Content-Type', 'text/plain');
      res.send(data);
    } catch (error) {
      logger.error({ error: error.message }, 'Diagnostic check failed');
      res.status(500).send(`Diagnostic failed: ${error.message}`);
    }
  });

  return router;
}
