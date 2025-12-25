/**
 * Tests for Integram Session Service
 * Issue #5137: Session creation after email verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSession, updateSessionActivity } from '../integramSessionService.js';
import { createIntegramClient } from '../../../utils/IntegramClient.js';

// Mock IntegramClient
vi.mock('../../../utils/IntegramClient.js');

describe('InteggramSessionService', () => {
  let mockClient;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock client
    mockClient = {
      authenticate: vi.fn().mockResolvedValue(true),
      makeRequest: vi.fn().mockResolvedValue({
        success: true,
        id: '208750'
      }),
      xsrfToken: 'mock_xsrf_token'
    };

    createIntegramClient.mockReturnValue(mockClient);

    // Mock environment variables
    process.env.INTEGRAM_SYSTEM_USERNAME = 'd';
    process.env.INTEGRAM_SYSTEM_PASSWORD = 'd';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSession', () => {
    it('should create a session successfully', async () => {
      const result = await createSession({
        userId: 208630,
        database: 'my',
        sessionType: 'email_registration'
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).toMatch(/^session_\d+_[a-f0-9]+_u208630$/);
      expect(result.userId).toBe(208630);
      expect(result.database).toBe('my');
      expect(result.sessionType).toBe('email_registration');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should authenticate with Integram before creating session', async () => {
      await createSession({
        userId: 208630,
        database: 'my'
      });

      expect(mockClient.authenticate).toHaveBeenCalledWith('d', 'd');
      expect(mockClient.authenticate).toHaveBeenCalledTimes(1);
    });

    it('should call makeRequest with correct parameters', async () => {
      await createSession({
        userId: 208630,
        database: 'my',
        sessionType: 'email_registration'
      });

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        'POST',
        '/my/object/205909/_new',
        expect.objectContaining({
          _parent_: 208630,
          _xsrf: 'mock_xsrf_token',
          val: expect.stringContaining('Сессия email_registration'),
          205921: expect.stringMatching(/^session_\d+_[a-f0-9]+_u208630$/),
          205911: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          205928: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
        })
      );
    });

    it('should return error when userId is missing', async () => {
      const result = await createSession({
        database: 'my'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('userId is required');
    });

    it('should handle authentication failure gracefully', async () => {
      mockClient.authenticate.mockRejectedValue(new Error('Authentication failed'));

      const result = await createSession({
        userId: 208630,
        database: 'my'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });

    it('should handle Integram API errors gracefully', async () => {
      mockClient.makeRequest.mockRejectedValue(new Error('API error'));

      const result = await createSession({
        userId: 208630,
        database: 'my'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API error');
    });

    it('should use default database "my" if not specified', async () => {
      await createSession({
        userId: 208630
      });

      expect(createIntegramClient).toHaveBeenCalledWith('my');
      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        'POST',
        '/my/object/205909/_new',
        expect.any(Object)
      );
    });

    it('should use default sessionType "email_registration" if not specified', async () => {
      const result = await createSession({
        userId: 208630,
        database: 'my'
      });

      expect(result.sessionType).toBe('email_registration');
      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        'POST',
        '/my/object/205909/_new',
        expect.objectContaining({
          val: expect.stringContaining('Сессия email_registration')
        })
      );
    });

    it('should generate unique session IDs for different users', async () => {
      const result1 = await createSession({
        userId: 208630,
        database: 'my'
      });

      const result2 = await createSession({
        userId: 208631,
        database: 'my'
      });

      expect(result1.sessionId).not.toBe(result2.sessionId);
      expect(result1.sessionId).toMatch(/_u208630$/);
      expect(result2.sessionId).toMatch(/_u208631$/);
    });
  });

  describe('updateSessionActivity', () => {
    it('should update session activity successfully', async () => {
      const result = await updateSessionActivity({
        sessionId: 'session_1234567890_abcdef_u208630',
        database: 'my'
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session_1234567890_abcdef_u208630');
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should return error when sessionId is missing', async () => {
      const result = await updateSessionActivity({
        database: 'my'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('sessionId is required');
    });

    it('should use default database "my" if not specified', async () => {
      const result = await updateSessionActivity({
        sessionId: 'session_1234567890_abcdef_u208630'
      });

      expect(result.success).toBe(true);
      expect(createIntegramClient).toHaveBeenCalledWith('my');
    });
  });
});
