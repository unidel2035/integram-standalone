// ClaudeProxyService.js - Service for proxying Claude requests through an intermediate server
// Issue #2607: Implement proxy layer for Claude AI requests
// Issue #2697: Fix Content-Length + Transfer-Encoding conflict

import axios from 'axios';
import http from 'http';
import https from 'https';
import logger from '../utils/logger.js';

/**
 * ClaudeProxyService
 * Forwards Claude API requests to an intermediate server, which then forwards to Claude
 * Architecture: Chat.vue → Monolith API → Intermediate Server → Claude API
 */
class ClaudeProxyService {
  constructor() {
    // Intermediate server configuration from environment variables
    this.intermediateServerUrl = process.env.CLAUDE_PROXY_SERVER_URL || 'http://localhost:3002';
    this.enabled = process.env.CLAUDE_PROXY_ENABLED === 'true';
    this.timeout = parseInt(process.env.CLAUDE_PROXY_TIMEOUT) || 120000; // 2 minutes default

    logger.info({
      enabled: this.enabled,
      intermediateServerUrl: this.intermediateServerUrl,
      timeout: this.timeout
    }, 'ClaudeProxyService initialized');
  }

  /**
   * Check if proxy service is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get proxy service status
   * @returns {object}
   */
  getStatus() {
    return {
      enabled: this.enabled,
      intermediateServerUrl: this.intermediateServerUrl,
      timeout: this.timeout
    };
  }

  /**
   * Forward chat request to intermediate server
   * The intermediate server will then forward to Claude API
   *
   * @param {object} payload - Request payload containing message, model, etc.
   * @param {function} onChunk - Callback for streaming chunks
   * @returns {Promise<void>}
   */
  async forwardChatRequest(payload, onChunk) {
    if (!this.enabled) {
      throw new Error('Claude proxy service is not enabled. Set CLAUDE_PROXY_ENABLED=true');
    }

    try {
      // Log full payload for debugging (without sensitive data)
      logger.info({
        intermediateServerUrl: this.intermediateServerUrl,
        model: payload.model,
        messageLength: payload.message?.length,
        hasConversationHistory: !!payload.conversationHistory,
        conversationHistoryLength: payload.conversationHistory?.length || 0,
        temperature: payload.temperature,
        maxTokens: payload.maxTokens,
        hasSystemPrompt: !!payload.systemPrompt
      }, 'Forwarding chat request to intermediate server');

      // Forward request to intermediate server with streaming support
      // Fix for issue #2697, #2709: Avoid Content-Length + Transfer-Encoding conflict
      const response = await axios({
        method: 'POST',
        url: `${this.intermediateServerUrl}/api/claude`,
        data: payload,
        responseType: 'stream',
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain',
          // Forward original headers if needed
          'X-Forwarded-By': 'DronDoc-Monolith',
          // Explicitly request chunked transfer encoding
          'Transfer-Encoding': 'chunked'
        },
        // Explicitly disable automatic Content-Length header
        // to avoid conflict with Transfer-Encoding: chunked
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        // Disable automatic decompression to avoid header manipulation
        decompress: false,
        // Validate status to handle response properly
        validateStatus: (status) => status >= 200 && status < 300,
        // Handle response transformation to avoid header conflicts
        transformResponse: [(data) => data],
        // Use HTTP/1.1 agent with keepalive
        httpAgent: new http.Agent({
          keepAlive: true,
          keepAliveMsecs: 1000
        }),
        httpsAgent: new https.Agent({
          keepAlive: true,
          keepAliveMsecs: 1000,
          rejectUnauthorized: false // For dev environments with self-signed certs
        })
      });

      // Issue #2709: Strip Content-Length from response if Transfer-Encoding is present
      // This prevents HTTP/1.1 protocol violation
      if (response.headers['transfer-encoding'] && response.headers['content-length']) {
        logger.warn('Removing Content-Length header to avoid conflict with Transfer-Encoding');
        delete response.headers['content-length'];
      }

      // Stream response chunks
      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const text = chunk.toString('utf-8');
          onChunk(text);
        });

        response.data.on('end', () => {
          logger.info('Intermediate server stream completed');
          resolve();
        });

        response.data.on('error', (error) => {
          logger.error({ error: error.message }, 'Intermediate server stream error');
          reject(error);
        });
      });

    } catch (error) {
      // Enhanced error logging with full response details for debugging
      const errorLogDetails = {
        error: error.message,
        intermediateServerUrl: this.intermediateServerUrl,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseHeaders: error.response?.headers,
        responseData: error.response?.data,
        requestPayload: {
          model: payload.model,
          messageLength: payload.message?.length,
          historyLength: payload.conversationHistory?.length,
          temperature: payload.temperature,
          maxTokens: payload.maxTokens
        }
      };

      // Log different levels based on error type
      if (error.response?.status >= 500) {
        logger.error(errorLogDetails, 'Intermediate server error (5xx)');
      } else if (error.response?.status === 400) {
        logger.warn(errorLogDetails, 'Bad request to intermediate server (400) - check payload format');
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        logger.error(errorLogDetails, 'Authentication error with intermediate server');
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logger.error(errorLogDetails, 'Network error connecting to intermediate server');
      } else {
        logger.error(errorLogDetails, 'Failed to forward request to intermediate server');
      }

      // Provide specific guidance for common errors
      let errorMessage = error.message;

      // Check if error response contains detailed error information
      if (error.response?.data) {
        const responseData = error.response.data;

        // Handle authentication errors (401)
        if (error.response.status === 401) {
          errorMessage = `⚠️ Authentication Error: The ANTHROPIC_API_KEY configured on the intermediate server (${this.intermediateServerUrl}) is invalid or expired.\n\n` +
                        `Details: ${responseData.message || responseData.error || 'Invalid API key'}\n\n` +
                        `📋 Action Required:\n` +
                        `1. Access the intermediate server at ${this.intermediateServerUrl}\n` +
                        `2. Update the ANTHROPIC_API_KEY environment variable with a valid key\n` +
                        `3. Get a valid API key from: https://console.anthropic.com/\n` +
                        `4. Restart the intermediate server after updating the key`;
        }
        // Handle configuration errors (503)
        else if (error.response.status === 503) {
          errorMessage = `⚠️ Configuration Error: ANTHROPIC_API_KEY is not set on the intermediate server (${this.intermediateServerUrl}).\n\n` +
                        `Details: ${responseData.message || responseData.error || 'API key not configured'}\n\n` +
                        `📋 Action Required:\n` +
                        `1. Access the intermediate server at ${this.intermediateServerUrl}\n` +
                        `2. Set the ANTHROPIC_API_KEY environment variable\n` +
                        `3. Get an API key from: https://console.anthropic.com/\n` +
                        `4. Restart the intermediate server after setting the key`;
        }
        // Handle bad request errors (400)
        else if (error.response.status === 400) {
          // Try to extract more specific error details
          const errorDetail = responseData.message || responseData.error || 'Invalid request format';
          const errorType = responseData.type || 'unknown';

          errorMessage = `⚠️ Bad Request (400): ${errorDetail}\n\n`;

          // Add diagnostic information
          errorMessage += `📊 Request Details:\n`;
          errorMessage += `- Model: ${payload.model}\n`;
          errorMessage += `- Message length: ${payload.message?.length || 0} characters\n`;
          errorMessage += `- Conversation history: ${payload.conversationHistory?.length || 0} messages\n`;
          errorMessage += `- Temperature: ${payload.temperature}\n`;
          errorMessage += `- Max tokens: ${payload.maxTokens}\n`;
          errorMessage += `\n`;

          // Provide actionable suggestions based on error type
          if (errorDetail.includes('model') || errorDetail.includes('Model')) {
            errorMessage += `💡 Possible Issue: Invalid model specified\n`;
            errorMessage += `- Check if model "${payload.model}" is supported by the intermediate server\n`;
            errorMessage += `- Try using a different model (e.g., claude-sonnet-3-5-20241022)\n`;
          } else if (errorDetail.includes('message') || errorDetail.includes('content')) {
            errorMessage += `💡 Possible Issue: Invalid message format\n`;
            errorMessage += `- The message or conversation history format may not match the expected schema\n`;
            errorMessage += `- Check that conversation history has 'role' and 'content' fields\n`;
          } else if (errorDetail.includes('token')) {
            errorMessage += `💡 Possible Issue: Token limit exceeded\n`;
            errorMessage += `- Try reducing the message length or conversation history\n`;
            errorMessage += `- Current max tokens: ${payload.maxTokens}\n`;
          } else {
            errorMessage += `💡 Suggested Actions:\n`;
            errorMessage += `1. Check intermediate server logs at ${this.intermediateServerUrl}\n`;
            errorMessage += `2. Verify the request payload format matches Claude API requirements\n`;
            errorMessage += `3. Try with a simpler message to isolate the issue\n`;
          }

          errorMessage += `\n🔗 Intermediate Server: ${this.intermediateServerUrl}`;
        }
        // Handle other HTTP errors with response data
        else if (responseData.message || responseData.error) {
          errorMessage = `Error from intermediate server: ${responseData.message || responseData.error}`;
        }
      }
      // Handle network/connection errors
      else if (error.code === 'ECONNREFUSED') {
        errorMessage = `⚠️ Connection Error: Cannot connect to intermediate server at ${this.intermediateServerUrl}.\n\n` +
                      `The intermediate server might be down or unreachable.\n\n` +
                      `📋 Action Required:\n` +
                      `1. Check if the intermediate server is running\n` +
                      `2. Verify the server URL in CLAUDE_PROXY_SERVER_URL environment variable\n` +
                      `3. Check network connectivity to ${this.intermediateServerUrl}`;
      }
      else if (error.code === 'ETIMEDOUT') {
        errorMessage = `⚠️ Timeout Error: Request to intermediate server at ${this.intermediateServerUrl} timed out.\n\n` +
                      `The server is taking too long to respond.\n\n` +
                      `📋 Possible Causes:\n` +
                      `1. Server is overloaded\n` +
                      `2. Network latency issues\n` +
                      `3. Claude API is slow to respond`;
      }
      // Handle HTTP protocol errors
      else if (error.message && error.message.includes('Content-Length')) {
        errorMessage = `⚠️ HTTP Protocol Error: The intermediate server is sending both Content-Length and Transfer-Encoding headers.\n\n` +
                      `This violates HTTP/1.1 specification.\n\n` +
                      `📋 Action Required:\n` +
                      `Check the intermediate server configuration at ${this.intermediateServerUrl}`;
      }
      // Handle authentication errors in error message
      else if (error.message && (error.message.includes('authentication_error') || error.message.includes('invalid x-api-key'))) {
        errorMessage = `⚠️ Authentication Error: Invalid ANTHROPIC_API_KEY on intermediate server.\n\n` +
                      `Server: ${this.intermediateServerUrl}\n\n` +
                      `📋 Action Required:\n` +
                      `1. Update ANTHROPIC_API_KEY with a valid key from https://console.anthropic.com/\n` +
                      `2. Restart the intermediate server`;
      }

      throw new Error(`${errorMessage}`);
    }
  }

  /**
   * Forward non-streaming chat request to intermediate server
   *
   * @param {object} payload - Request payload
   * @returns {Promise<object>} Response from intermediate server
   */
  async forwardChatRequestSync(payload) {
    if (!this.enabled) {
      throw new Error('Claude proxy service is not enabled. Set CLAUDE_PROXY_ENABLED=true');
    }

    try {
      logger.info({
        intermediateServerUrl: this.intermediateServerUrl,
        model: payload.model
      }, 'Forwarding sync chat request to intermediate server');

      const response = await axios.post(
        `${this.intermediateServerUrl}/api/claude`,
        payload,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-By': 'DronDoc-Monolith'
          }
        }
      );

      logger.info('Intermediate server responded successfully');
      return response.data;

    } catch (error) {
      logger.error({
        error: error.message,
        intermediateServerUrl: this.intermediateServerUrl
      }, 'Failed to forward sync request to intermediate server');

      throw new Error(`Proxy error: ${error.message}`);
    }
  }

  /**
   * Health check for intermediate server
   * @returns {Promise<object>}
   */
  async checkIntermediateServerHealth() {
    try {
      const response = await axios.get(`${this.intermediateServerUrl}/health`, {
        timeout: 5000
      });

      return {
        healthy: response.status === 200,
        status: response.data
      };
    } catch (error) {
      logger.warn({
        error: error.message,
        intermediateServerUrl: this.intermediateServerUrl
      }, 'Intermediate server health check failed');

      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new ClaudeProxyService();
