// claude-proxy.js - Proxy endpoint for forwarding Claude requests through intermediate server
// Issue #2607: Implement proxy layer for Claude AI requests
// Architecture: Chat.vue → Monolith (this endpoint) → Intermediate Server → Claude API

import express from 'express';
import logger from '../../utils/logger.js';
import claudeProxyService from '../../services/ClaudeProxyService.js';

/**
 * Create Claude Proxy routes
 * This endpoint acts as a proxy layer between the frontend and an intermediate server,
 * which then forwards requests to Claude API.
 */
export function createClaudeProxyRoutes() {
  const router = express.Router();

  /**
   * POST /api/claude-proxy
   * Proxy endpoint for Claude chat requests
   * Forwards requests to intermediate server, which forwards to Claude
   *
   * Request body:
   * - message: string (required)
   * - conversationHistory: array (optional)
   * - model: string (optional, default: claude-sonnet-4-20250514)
   * - temperature: number (optional, default: 0.7)
   * - maxTokens: number (optional, default: 4096)
   * - systemPrompt: string (optional)
   */
  router.post('/', async (req, res) => {
    try {
      const {
        message,
        conversationHistory = [],
        model = 'claude-sonnet-4-20250514',
        temperature = 0.7,
        maxTokens = 4096,
        systemPrompt
      } = req.body;

      // Validate required fields
      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      // Check if proxy service is enabled
      if (!claudeProxyService.isEnabled()) {
        return res.status(503).json({
          success: false,
          error: 'Claude proxy service is not enabled. Set CLAUDE_PROXY_ENABLED=true and configure CLAUDE_PROXY_SERVER_URL'
        });
      }

      logger.info({
        model,
        messageLength: message.length,
        historyLength: conversationHistory.length
      }, 'Received Claude proxy request');

      // Set response headers for streaming
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      // Remove Content-Length if present to avoid conflict with Transfer-Encoding
      res.removeHeader('Content-Length');

      // Prepare payload for intermediate server
      const payload = {
        message,
        conversationHistory,
        model,
        temperature,
        maxTokens,
        systemPrompt: systemPrompt || 'Ты цифровой помощник DronDoc. Отвечаешь кратко и по существу.'
      };

      // Forward request to intermediate server with streaming
      await claudeProxyService.forwardChatRequest(payload, (chunk) => {
        res.write(chunk);
      });

      res.end();
      logger.info('Claude proxy request completed successfully');

    } catch (error) {
      logger.error({
        error: error.message,
        stack: error.stack
      }, 'Claude proxy request failed');

      if (!res.headersSent) {
        // Determine appropriate status code based on error type
        let statusCode = 500;
        if (error.message.includes('Authentication Error')) {
          statusCode = 401;
        } else if (error.message.includes('Configuration Error')) {
          statusCode = 503;
        } else if (error.message.includes('Connection Error')) {
          statusCode = 503;
        } else if (error.message.includes('Bad Request')) {
          statusCode = 400;
        }

        res.status(statusCode).json({
          success: false,
          error: 'Claude proxy request failed',
          message: error.message,
          // Include actionable information for frontend
          actionRequired: error.message.includes('📋 Action Required'),
          timestamp: new Date().toISOString()
        });
      } else {
        // If headers already sent, try to end the stream
        res.end();
      }
    }
  });

  /**
   * GET /api/claude-proxy/health
   * Health check for Claude proxy service
   * Checks both this service and the intermediate server
   */
  router.get('/health', async (req, res) => {
    try {
      const proxyStatus = claudeProxyService.getStatus();

      // Check intermediate server health if proxy is enabled
      let intermediateServerHealth = null;
      if (proxyStatus.enabled) {
        intermediateServerHealth = await claudeProxyService.checkIntermediateServerHealth();
      }

      const overallStatus = proxyStatus.enabled && intermediateServerHealth?.healthy
        ? 'ok'
        : proxyStatus.enabled
          ? 'degraded'
          : 'disabled';

      res.json({
        status: overallStatus,
        service: 'claude-proxy',
        proxyEnabled: proxyStatus.enabled,
        intermediateServerUrl: proxyStatus.intermediateServerUrl,
        intermediateServerHealthy: intermediateServerHealth?.healthy || false,
        intermediateServerStatus: intermediateServerHealth?.status || null,
        timeout: proxyStatus.timeout,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error({
        error: error.message
      }, 'Claude proxy health check failed');

      res.json({
        status: 'error',
        service: 'claude-proxy',
        proxyEnabled: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * GET /api/claude-proxy/config
   * Get proxy configuration (for debugging)
   */
  router.get('/config', (req, res) => {
    const config = claudeProxyService.getStatus();

    res.json({
      success: true,
      config: {
        enabled: config.enabled,
        intermediateServerUrl: config.intermediateServerUrl,
        timeout: config.timeout,
        timeoutFormatted: `${config.timeout / 1000}s`
      }
    });
  });

  /**
   * GET /api/claude-proxy/models
   * Get available Claude models
   * Returns list of models that can be used with the proxy
   */
  router.get('/models', (req, res) => {
    // Return available Claude models
    // These models are supported by Claude API through the intermediate server
    const models = [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4.5',
        description: 'Latest Claude Sonnet 4.5 model with enhanced capabilities',
        contextWindow: 200000,
        maxTokens: 8192
      },
      {
        id: 'claude-sonnet-3-5-20241022',
        name: 'Claude Sonnet 3.5',
        description: 'Claude Sonnet 3.5 with improved performance',
        contextWindow: 200000,
        maxTokens: 8192
      },
      {
        id: 'claude-opus-3-20240229',
        name: 'Claude Opus 3',
        description: 'Most capable Claude model for complex tasks',
        contextWindow: 200000,
        maxTokens: 4096
      }
    ];

    res.json({
      success: true,
      models,
      count: models.length
    });
  });

  /**
   * POST /api/claude-proxy/test
   * Test endpoint to debug request payload
   * Echoes back the request payload for inspection
   */
  router.post('/test', (req, res) => {
    try {
      const {
        message,
        conversationHistory = [],
        model = 'claude-sonnet-4-20250514',
        temperature = 0.7,
        maxTokens = 4096,
        systemPrompt
      } = req.body;

      // Build the payload that would be sent to intermediate server
      const payload = {
        message,
        conversationHistory,
        model,
        temperature,
        maxTokens,
        systemPrompt: systemPrompt || 'Ты цифровой помощник DronDoc. Отвечаешь кратко и по существу.'
      };

      // Return diagnostic information
      res.json({
        success: true,
        debug: {
          receivedPayload: req.body,
          processedPayload: payload,
          payloadAnalysis: {
            hasMessage: !!message,
            messageLength: message?.length || 0,
            messageType: typeof message,
            hasConversationHistory: !!conversationHistory,
            conversationHistoryLength: conversationHistory?.length || 0,
            conversationHistoryIsArray: Array.isArray(conversationHistory),
            model: model,
            temperature: temperature,
            temperatureType: typeof temperature,
            maxTokens: maxTokens,
            maxTokensType: typeof maxTokens,
            hasSystemPrompt: !!systemPrompt,
            systemPromptLength: systemPrompt?.length || 0
          },
          intermediateServerUrl: claudeProxyService.getStatus().intermediateServerUrl,
          wouldBeSentToIntermediateServer: payload
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error({
        error: error.message
      }, 'Claude proxy test endpoint error');

      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}
