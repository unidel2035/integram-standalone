// ClaudeProxyService.spec.js - Unit tests for ClaudeProxyService
// Issue #2697: Tests for HTTP header conflict fix

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';

// Mock axios before importing the service
vi.mock('axios');

// Set environment before importing service (singleton pattern)
process.env.CLAUDE_PROXY_ENABLED = 'true';
process.env.CLAUDE_PROXY_SERVER_URL = 'http://test-server:3002';
process.env.CLAUDE_PROXY_TIMEOUT = '60000';

// Now import the service with mocked environment
const { default: ClaudeProxyService } = await import('../ClaudeProxyService.js');

describe('ClaudeProxyService', () => {
  beforeEach(() => {
    // Clear axios mock calls
    vi.clearAllMocks();
  });

  describe('Service Configuration', () => {
    it('should initialize with correct configuration', () => {
      const status = ClaudeProxyService.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.intermediateServerUrl).toBe('http://test-server:3002');
      expect(status.timeout).toBe(60000);
    });

    it('should return enabled status', () => {
      expect(ClaudeProxyService.isEnabled()).toBe(true);
    });
  });

  describe('forwardChatRequest', () => {
    it('should configure axios to avoid Content-Length + Transfer-Encoding conflict', async () => {
      // Mock successful streaming response
      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            // Simulate some data chunks
            setTimeout(() => callback(Buffer.from('test chunk 1')), 10);
            setTimeout(() => callback(Buffer.from('test chunk 2')), 20);
          }
          if (event === 'end') {
            setTimeout(callback, 30);
          }
          return mockStream;
        })
      };

      axios.mockResolvedValue({
        data: mockStream,
        status: 200
      });

      const payload = {
        message: 'test message',
        conversationHistory: [],
        model: 'claude-sonnet-4-20250514',
        temperature: 0.7,
        maxTokens: 4096
      };

      const chunks = [];
      const onChunk = (chunk) => chunks.push(chunk);

      await ClaudeProxyService.forwardChatRequest(payload, onChunk);

      // Verify axios was called with correct configuration
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'http://test-server:3002/api/claude',
          data: payload,
          responseType: 'stream',
          timeout: 60000,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'text/plain',
            'X-Forwarded-By': 'DronDoc-Monolith'
          }),
          // Critical fix for issue #2697: these options prevent Content-Length header
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          decompress: false
        })
      );

      // Verify HTTP agents are configured
      const axiosConfig = axios.mock.calls[0][0];
      expect(axiosConfig.httpAgent).toBeDefined();
      expect(axiosConfig.httpsAgent).toBeDefined();
    });

    it('should handle Content-Length error gracefully', async () => {
      const contentLengthError = new Error('Parse Error: Content-Length can\'t be present with Transfer-Encoding');
      axios.mockRejectedValue(contentLengthError);

      const payload = {
        message: 'test message',
        model: 'claude-sonnet-4-20250514'
      };

      await expect(
        ClaudeProxyService.forwardChatRequest(payload, () => {})
      ).rejects.toThrow(/HTTP protocol error.*Content-Length and Transfer-Encoding/);
    });

    // Note: Testing disabled state would require separate test file
    // with different environment configuration due to singleton pattern

    it('should stream response chunks correctly', async () => {
      const testChunks = ['chunk1', 'chunk2', 'chunk3'];
      let dataCallback;
      let endCallback;

      const mockStream = {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            dataCallback = callback;
          }
          if (event === 'end') {
            endCallback = callback;
          }
          return mockStream;
        })
      };

      axios.mockResolvedValue({
        data: mockStream,
        status: 200
      });

      const payload = {
        message: 'test message',
        model: 'claude-sonnet-4-20250514'
      };

      const receivedChunks = [];
      const onChunk = (chunk) => receivedChunks.push(chunk);

      const requestPromise = ClaudeProxyService.forwardChatRequest(payload, onChunk);

      // Simulate streaming
      await new Promise(resolve => setTimeout(resolve, 10));
      testChunks.forEach(chunk => {
        dataCallback(Buffer.from(chunk));
      });
      endCallback();

      await requestPromise;

      expect(receivedChunks).toEqual(testChunks);
    });
  });

  describe('forwardChatRequestSync', () => {
    it('should handle non-streaming requests', async () => {
      const mockResponse = {
        data: {
          success: true,
          response: 'Test response from Claude'
        },
        status: 200
      };

      axios.post = vi.fn().mockResolvedValue(mockResponse);

      const payload = {
        message: 'test message',
        model: 'claude-sonnet-4-20250514'
      };

      const result = await ClaudeProxyService.forwardChatRequestSync(payload);

      expect(result).toEqual(mockResponse.data);
      expect(axios.post).toHaveBeenCalledWith(
        'http://test-server:3002/api/claude',
        payload,
        expect.objectContaining({
          timeout: 60000,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Forwarded-By': 'DronDoc-Monolith'
          })
        })
      );
    });
  });

  describe('checkIntermediateServerHealth', () => {
    it('should check intermediate server health', async () => {
      const mockHealthResponse = {
        data: { status: 'ok', service: 'claude-proxy-intermediate' },
        status: 200
      };

      axios.get = vi.fn().mockResolvedValue(mockHealthResponse);

      const health = await ClaudeProxyService.checkIntermediateServerHealth();

      expect(health.healthy).toBe(true);
      expect(health.status).toEqual(mockHealthResponse.data);
      expect(axios.get).toHaveBeenCalledWith(
        'http://test-server:3002/health',
        { timeout: 5000 }
      );
    });

    it('should handle health check failure', async () => {
      axios.get = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const health = await ClaudeProxyService.checkIntermediateServerHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Connection refused');
    });
  });

  describe('Error Handling', () => {
    it('should provide detailed error for Content-Length conflict', async () => {
      const error = new Error('Parse Error: Content-Length can\'t be present with Transfer-Encoding');
      axios.mockRejectedValue(error);

      const payload = { message: 'test' };

      try {
        await ClaudeProxyService.forwardChatRequest(payload, () => {});
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect(err.message).toContain('HTTP protocol error');
        expect(err.message).toContain('Content-Length and Transfer-Encoding headers');
        expect(err.message).toContain('http://test-server:3002');
      }
    });

    it('should handle generic network errors', async () => {
      const error = new Error('ECONNREFUSED');
      error.code = 'ECONNREFUSED';
      axios.mockRejectedValue(error);

      const payload = { message: 'test' };

      await expect(
        ClaudeProxyService.forwardChatRequest(payload, () => {})
      ).rejects.toThrow('Proxy error: ECONNREFUSED');
    });
  });
});
