/**
 * Unified Authentication Service Tests
 *
 * Issue #3554: Single authentication point for all databases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { UnifiedAuthService } from '../UnifiedAuthService.js';

// Mock axios
vi.mock('axios');

describe('UnifiedAuthService', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    // Initialize service with mock logger
    service = new UnifiedAuthService({ logger: mockLogger });

    // Reset axios mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear sessions
    service.sessions.clear();
  });

  describe('buildUrl', () => {
    it('should build correct URL with database and endpoint', () => {
      const url = service.buildUrl('ddadmin', 'auth');
      expect(url).toContain('/ddadmin/auth');
      expect(url).toContain('JSON_KV');
    });

    it('should build URL with query parameters', () => {
      const url = service.buildUrl('a2025', 'report/4064', { filter: 'test' });
      expect(url).toContain('/a2025/report/4064');
      expect(url).toContain('JSON_KV');
      expect(url).toContain('filter=test');
    });
  });

  describe('authenticateInDatabase', () => {
    it('should successfully authenticate in a database', async () => {
      // Mock successful auth response
      axios.post.mockResolvedValueOnce({
        data: {
          failed: false,
          token: 'test-token'
        }
      });

      // Mock session info response
      axios.get.mockResolvedValueOnce({
        data: {
          token: 'test-token',
          _xsrf: 'test-xsrf',
          id: 'user-123',
          user: 'testuser',
          role: 'admin'
        }
      });

      const result = await service.authenticateInDatabase('ddadmin', 'testuser', 'password');

      expect(result.success).toBe(true);
      expect(result.database).toBe('ddadmin');
      expect(result.token).toBe('test-token');
      expect(result.xsrf).toBe('test-xsrf');
      expect(result.userId).toBe('user-123');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle failed authentication', async () => {
      // Mock failed auth response
      axios.post.mockResolvedValueOnce({
        data: {
          failed: true
        }
      });

      const result = await service.authenticateInDatabase('ddadmin', 'testuser', 'wrongpass');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      // Mock network error
      axios.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.authenticateInDatabase('ddadmin', 'testuser', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('getUserOrganizationData', () => {
    it('should retrieve organization data for user', async () => {
      const mockOrgData = [
        { username: 'testuser', organization: 'TestOrg', email: 'test@example.com' },
        { username: 'otheruser', organization: 'OtherOrg', email: 'other@example.com' }
      ];

      axios.get.mockResolvedValueOnce({
        data: mockOrgData
      });

      const result = await service.getUserOrganizationData('test-token', 'testuser');

      expect(result).toEqual(mockOrgData[0]);
      expect(result.organization).toBe('TestOrg');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should return null if user not found', async () => {
      axios.get.mockResolvedValueOnce({
        data: [
          { username: 'otheruser', organization: 'OtherOrg' }
        ]
      });

      const result = await service.getUserOrganizationData('test-token', 'testuser');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      axios.get.mockRejectedValueOnce(new Error('API error'));

      const result = await service.getUserOrganizationData('test-token', 'testuser');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('authenticateUnified', () => {
    it('should authenticate in multiple databases successfully', async () => {
      // Mock ddadmin auth
      axios.post.mockResolvedValueOnce({
        data: { failed: false, token: 'ddadmin-token' }
      });
      axios.get.mockResolvedValueOnce({
        data: {
          token: 'ddadmin-token',
          _xsrf: 'ddadmin-xsrf',
          id: 'user-123',
          user: 'testuser',
          role: 'admin'
        }
      });

      // Mock org data
      axios.get.mockResolvedValueOnce({
        data: [{ username: 'testuser', organization: 'TestOrg' }]
      });

      // Mock a2025 auth
      axios.post.mockResolvedValueOnce({
        data: { failed: false, token: 'a2025-token' }
      });
      axios.get.mockResolvedValueOnce({
        data: {
          token: 'a2025-token',
          _xsrf: 'a2025-xsrf',
          id: 'user-456',
          user: 'testuser',
          role: 'user'
        }
      });

      const result = await service.authenticateUnified('testuser', 'password');

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session.sessionId).toBeDefined();
      expect(result.session.username).toBe('testuser');
      expect(result.session.organization).toBe('TestOrg');
      expect(result.session.databases).toHaveLength(2);
      expect(result.session.metadata.successfulAuths).toBe(2);
      expect(service.sessions.has(result.session.sessionId)).toBe(true);
    });

    it('should handle partial authentication failures', async () => {
      // Mock ddadmin auth (success)
      axios.post.mockResolvedValueOnce({
        data: { failed: false, token: 'ddadmin-token' }
      });
      axios.get.mockResolvedValueOnce({
        data: {
          token: 'ddadmin-token',
          _xsrf: 'ddadmin-xsrf',
          id: 'user-123',
          user: 'testuser',
          role: 'admin'
        }
      });

      // Mock org data
      axios.get.mockResolvedValueOnce({
        data: [{ username: 'testuser', organization: 'TestOrg' }]
      });

      // Mock a2025 auth (failure)
      axios.post.mockResolvedValueOnce({
        data: { failed: true }
      });

      const result = await service.authenticateUnified('testuser', 'password');

      expect(result.success).toBe(true);
      expect(result.session.databases).toHaveLength(1);
      expect(result.session.failedDatabases).toHaveLength(1);
      expect(result.session.metadata.successfulAuths).toBe(1);
      expect(result.session.metadata.failedAuths).toBe(1);
    });

    it('should fail if ddadmin authentication fails', async () => {
      // Mock ddadmin auth failure
      axios.post.mockResolvedValueOnce({
        data: { failed: true }
      });

      const result = await service.authenticateUnified('testuser', 'wrongpass');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(service.sessions.size).toBe(0);
    });
  });

  describe('getSession', () => {
    it('should retrieve existing session', () => {
      const sessionId = 'test-session-id';
      const mockSession = {
        sessionId,
        username: 'testuser',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        databases: []
      };

      service.sessions.set(sessionId, mockSession);

      const result = service.getSession(sessionId);

      expect(result).toEqual(mockSession);
    });

    it('should return null for non-existent session', () => {
      const result = service.getSession('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return null and delete expired session', () => {
      const sessionId = 'expired-session';
      const expiredSession = {
        sessionId,
        username: 'testuser',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
        databases: []
      };

      service.sessions.set(sessionId, expiredSession);

      const result = service.getSession(sessionId);

      expect(result).toBeNull();
      expect(service.sessions.has(sessionId)).toBe(false);
    });
  });

  describe('getTokenForDatabase', () => {
    it('should retrieve token for specific database', () => {
      const sessionId = 'test-session';
      const mockSession = {
        sessionId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        databases: [
          { database: 'ddadmin', token: 'ddadmin-token', userId: 'user-1' },
          { database: 'a2025', token: 'a2025-token', userId: 'user-2' }
        ]
      };

      service.sessions.set(sessionId, mockSession);

      const result = service.getTokenForDatabase(sessionId, 'a2025');

      expect(result).toBeDefined();
      expect(result.database).toBe('a2025');
      expect(result.token).toBe('a2025-token');
    });

    it('should return null if database not found in session', () => {
      const sessionId = 'test-session';
      const mockSession = {
        sessionId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        databases: [
          { database: 'ddadmin', token: 'ddadmin-token' }
        ]
      };

      service.sessions.set(sessionId, mockSession);

      const result = service.getTokenForDatabase(sessionId, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getAllTokens', () => {
    it('should retrieve all tokens from session', () => {
      const sessionId = 'test-session';
      const mockSession = {
        sessionId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        databases: [
          { database: 'ddadmin', token: 'ddadmin-token', xsrf: 'xsrf-1', userId: 'user-1' },
          { database: 'a2025', token: 'a2025-token', xsrf: 'xsrf-2', userId: 'user-2' }
        ]
      };

      service.sessions.set(sessionId, mockSession);

      const result = service.getAllTokens(sessionId);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result.ddadmin.token).toBe('ddadmin-token');
      expect(result.a2025.token).toBe('a2025-token');
    });

    it('should return empty object for non-existent session', () => {
      const result = service.getAllTokens('non-existent');

      expect(result).toEqual({});
    });
  });

  describe('invalidateSession', () => {
    it('should delete session from cache', () => {
      const sessionId = 'test-session';
      service.sessions.set(sessionId, { sessionId });

      service.invalidateSession(sessionId);

      expect(service.sessions.has(sessionId)).toBe(false);
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', () => {
      const activeSession = {
        sessionId: 'active',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      const expiredSession = {
        sessionId: 'expired',
        expiresAt: new Date(Date.now() - 1000).toISOString()
      };

      service.sessions.set('active', activeSession);
      service.sessions.set('expired', expiredSession);

      const cleaned = service.cleanupExpiredSessions();

      expect(cleaned).toBe(1);
      expect(service.sessions.has('active')).toBe(true);
      expect(service.sessions.has('expired')).toBe(false);
    });

    it('should not log if no sessions were cleaned', () => {
      const cleaned = service.cleanupExpiredSessions();

      expect(cleaned).toBe(0);
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('getActiveSessionCount', () => {
    it('should return correct number of active sessions', () => {
      service.sessions.set('session1', { sessionId: 'session1' });
      service.sessions.set('session2', { sessionId: 'session2' });

      const count = service.getActiveSessionCount();

      expect(count).toBe(2);
    });
  });
});
