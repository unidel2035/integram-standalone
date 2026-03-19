// claude-chat.js - Direct Claude Sonnet 4.5 Chat API
// Issue #2276: Chat integration with Claude Sonnet 4.5 (bypassing MCP)
// Issue #2293: Use unified token system instead of separate ENV file
// Issue #2309: Use file-based AIProviderKeysService + SSH Proxy support
// Issue #4873: AI usage statistics logging to Integram
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import logger from '../../utils/logger.js';
import aiProviderKeysService from '../../services/ai-provider-keys/AIProviderKeysService.js';
import claudeSSHProxyService from '../../services/ClaudeSSHProxyService.js';
import tokenConsumptionLogger from '../../services/ai/tokenConsumptionLogger.js';

/**
 * Get Anthropic API key from unified token storage (file-based)
 * @returns {Promise<string|null>} Anthropic API key or null if not found
 */
async function getAnthropicApiKey() {
  try {
    // Check environment variable as fallback
    if (process.env.ANTHROPIC_API_KEY) {
      logger.debug('Using Anthropic API key from environment variable');
      return process.env.ANTHROPIC_API_KEY;
    }

    // Get from unified token storage (file-based, Issue #2309)
    // This replaces database storage with file system storage
    const apiKey = await aiProviderKeysService.getProviderKey('anthropic');

    if (!apiKey) {
      logger.warn('Anthropic API key not found in unified storage or environment variable. Use the setup script: npm run setup-anthropic-key');
      return null;
    }

    logger.debug('Using Anthropic API key from unified token storage (file-based)');
    return apiKey;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to retrieve Anthropic API key from unified storage');
    return null;
  }
}

/**
 * Create Claude Chat routes
 * Provides direct chat functionality using Claude Sonnet 4.5
 * Uses unified token system (Issue #2293)
 */
export function createClaudeChatRoutes() {
  const router = express.Router();

  // Default model: Claude Sonnet 4.5
  const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

  /**
   * POST /api/claude-chat
   * Chat with Claude Sonnet 4.5
   * Supports both Anthropic API and SSH Proxy (Issue #2309)
   */
  router.post('/', async (req, res) => {
    try {
      const {
        message,
        conversationHistory = [],
        model = DEFAULT_MODEL,
        temperature = 0.7,
        maxTokens = 4096,
        systemPrompt
      } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      // Check if SSH proxy is enabled
      if (claudeSSHProxyService.isEnabled()) {
        logger.info('Using Claude via SSH proxy');

        // Set response headers for streaming
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Build full prompt with conversation history and system prompt
        let fullPrompt = '';
        if (systemPrompt) {
          fullPrompt += `System: ${systemPrompt}\n\n`;
        }
        if (conversationHistory.length > 0) {
          conversationHistory.forEach(msg => {
            fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
          });
        }
        fullPrompt += `User: ${message}\n`;

        // Stream response via SSH
        await claudeSSHProxyService.streamClaudeResponse(
          fullPrompt,
          (chunk) => res.write(chunk),
          { streamDelay: 50 } // 50ms delay between chunks for smooth streaming
        );

        res.end();
        logger.info('Claude SSH proxy stream completed');
        return;
      }

      // Otherwise, use direct Anthropic API
      logger.info('Using Claude via Anthropic API');

      // Get API key from unified token storage
      const apiKey = await getAnthropicApiKey();

      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: 'Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable or configure SSH proxy (CLAUDE_SSH_HOST).'
        });
      }

      // Initialize Anthropic client with the API key from unified storage
      const anthropic = new Anthropic({ apiKey });

      // Prepare messages array
      const messages = [
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user',
          content: message
        }
      ];

      // Set response headers for streaming
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      logger.info({
        model,
        messagesCount: messages.length,
        temperature,
        maxTokens
      }, 'Starting Claude chat stream');

      // Stream response from Claude
      const stream = await anthropic.messages.stream({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt || 'Ты - полезный ассистент DronDoc. Отвечаешь кратко и по существу.',
        messages
      });

      // Handle streaming chunks
      stream.on('text', (text) => {
        res.write(text);
      });

      stream.on('error', (error) => {
        logger.error({ error: error.message }, 'Claude stream error');
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Stream error',
            message: error.message
          });
        }
      });

      stream.on('end', async () => {
        res.end();
        logger.info('Claude chat stream completed');

        // Issue #4873: Log token consumption to Integram
        try {
          const finalMessage = await stream.finalMessage();
          if (finalMessage.usage) {
            // Extract userId from request body or default
            const userId = req.body.userId || 'unknown';

            await tokenConsumptionLogger.logConsumption({
              userId: userId,
              model: finalMessage.model || model,
              promptTokens: finalMessage.usage.input_tokens || 0,
              completionTokens: finalMessage.usage.output_tokens || 0
            }).catch(err => {
              logger.error('[Claude Chat] Failed to log token consumption:', err.message);
            });
          }
        } catch (err) {
          logger.warn('[Claude Chat] Could not access final message for usage tracking:', err.message);
        }
      });

    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Claude chat failed');

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Claude chat failed',
          message: error.message
        });
      }
    }
  });

  /**
   * GET /api/claude-chat/health
   * Health check for Claude chat service
   * Checks both Anthropic API and SSH Proxy (Issue #2309)
   * Issue #2316: Always return 200 OK, even if API key is not configured
   */
  router.get('/health', async (req, res) => {
    try {
      const sshProxyStatus = claudeSSHProxyService.getStatus();
      const apiKey = await getAnthropicApiKey();
      const isConfigured = !!apiKey || sshProxyStatus.enabled;

      res.json({
        status: isConfigured ? 'ok' : 'not_configured',
        service: 'claude-chat',
        model: DEFAULT_MODEL,
        // Anthropic API status
        apiKeyConfigured: !!apiKey,
        apiKeySource: process.env.ANTHROPIC_API_KEY ? 'environment' : (apiKey ? 'unified_storage' : 'none'),
        // SSH Proxy status
        sshProxyEnabled: sshProxyStatus.enabled,
        sshProxyHost: sshProxyStatus.sshHost,
        sshProxyUser: sshProxyStatus.sshUser,
        // Active backend
        activeBackend: sshProxyStatus.enabled ? 'ssh-proxy' : (apiKey ? 'anthropic-api' : 'none'),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Issue #2316: Health check should not fail with 500 error
      // Return 200 OK with error details instead
      logger.error({ error: error.message }, 'Health check encountered error retrieving API key');
      res.json({
        status: 'error',
        service: 'claude-chat',
        apiKeyConfigured: false,
        apiKeySource: 'none',
        // SSH Proxy status even on error
        sshProxyEnabled: false,
        sshProxyHost: null,
        sshProxyUser: null,
        activeBackend: 'none',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * GET /api/claude-chat/models
   * List available Claude models
   */
  router.get('/models', (req, res) => {
    res.json({
      success: true,
      models: [
        {
          id: 'claude-sonnet-4-20250514',
          name: 'Claude Sonnet 4.5',
          description: 'Most capable Claude model for complex tasks',
          contextWindow: 200000,
          maxOutput: 8192
        },
        {
          id: 'claude-sonnet-3-5-20241022',
          name: 'Claude Sonnet 3.5',
          description: 'Balanced performance and speed',
          contextWindow: 200000,
          maxOutput: 8192
        },
        {
          id: 'claude-opus-3-20240229',
          name: 'Claude Opus 3',
          description: 'Most powerful Claude model',
          contextWindow: 200000,
          maxOutput: 4096
        }
      ],
      defaultModel: DEFAULT_MODEL
    });
  });

  return router;
}
