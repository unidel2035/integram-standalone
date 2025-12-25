/**
 * Database Token Storage Service Tests
 *
 * Tests for Integram-based token storage service
 * Part of Issue #3631: Database Token Storage System
 */

const DatabaseTokenStorage = require('../DatabaseTokenStorage');
const TokenEncryptionService = require('../TokenEncryptionService');

// Mock IntegramMCPClient
jest.mock('../../../services/mcp/IntegramMCPClient');
const IntegramMCPClient = require('../../../services/mcp/IntegramMCPClient');

describe('DatabaseTokenStorage', () => {
  let storage;
  let mockMCPClient;
  const config = {
    serverURL: 'https://dronedoc.ru',
    database: 'ddadmin',
    adminLogin: 'd',
    adminPassword: 'd',
    encryptionKey: 'a'.repeat(64), // 256-bit key
    sessionsTableId: 4002,
    tokenFieldId: 4260,
    xsrfFieldId: 4259
  };

  const testSession = {
    sessionId: 'test-session-uuid',
    username: 'testuser',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    expiresAt: new Date('2025-01-02T00:00:00Z'),
    databases: {
      db1: {
        token: 'token1',
        xsrf: 'xsrf1',
        userId: 'user1',
        role: 'admin',
        authenticatedAt: new Date('2025-01-01T00:00:00Z')
      },
      db2: {
        token: 'token2',
        xsrf: 'xsrf2',
        userId: 'user2',
        role: 'user',
        authenticatedAt: new Date('2025-01-01T00:00:00Z')
      }
    },
    mfaVerified: true,
    ssoProvider: 'google'
  };

  beforeEach(() => {
    // Reset mock
    IntegramMCPClient.mockClear();

    // Create mock instance
    mockMCPClient = {
      authenticate: jest.fn().mockResolvedValue(true),
      createObject: jest.fn(),
      getObjectList: jest.fn(),
      getObjectEditData: jest.fn(),
      setObjectRequisites: jest.fn(),
      deleteObject: jest.fn()
    };

    // Mock constructor
    IntegramMCPClient.mockImplementation(() => mockMCPClient);

    // Create storage instance
    storage = new DatabaseTokenStorage(config);
  });

  describe('Constructor', () => {
    it('should create storage with valid config', () => {
      expect(storage).toBeInstanceOf(DatabaseTokenStorage);
      expect(storage.serverURL).toBe(config.serverURL);
      expect(storage.database).toBe(config.database);
      expect(storage.sessionsTableId).toBe(config.sessionsTableId);
    });

    it('should throw error if required config is missing', () => {
      expect(() => new DatabaseTokenStorage({})).toThrow(
        'Missing required configuration'
      );

      expect(() => new DatabaseTokenStorage({ serverURL: 'test' })).toThrow(
        'Missing required configuration'
      );
    });

    it('should initialize encryption service', () => {
      expect(storage.encryptionService).toBeInstanceOf(TokenEncryptionService);
    });

    it('should use default table and field IDs', () => {
      const defaultStorage = new DatabaseTokenStorage({
        serverURL: 'test',
        database: 'test',
        adminLogin: 'test',
        adminPassword: 'test',
        encryptionKey: 'a'.repeat(64)
      });

      expect(defaultStorage.sessionsTableId).toBe(4002);
      expect(defaultStorage.tokenFieldId).toBe(4260);
      expect(defaultStorage.xsrfFieldId).toBe(4259);
    });
  });

  describe('saveSession()', () => {
    it('should save a session with encrypted tokens', async () => {
      // Mock MCP responses
      mockMCPClient.createObject.mockResolvedValue({
        id: 'object-123',
        value: testSession.sessionId
      });

      const result = await storage.saveSession(testSession);

      expect(result.sessionId).toBe(testSession.sessionId);
      expect(result.objectId).toBe('object-123');
      expect(result.createdAt).toEqual(testSession.createdAt);
      expect(result.expiresAt).toEqual(testSession.expiresAt);

      // Verify MCP client was called
      expect(mockMCPClient.authenticate).toHaveBeenCalledWith(
        config.adminLogin,
        config.adminPassword
      );
      expect(mockMCPClient.createObject).toHaveBeenCalled();

      // Verify tokens were encrypted
      const createCall = mockMCPClient.createObject.mock.calls[0][0];
      const savedData = JSON.parse(createCall.requisites[config.tokenFieldId]);

      expect(savedData.databases.db1.token).not.toBe('token1');
      expect(savedData.databases.db1.xsrf).not.toBe('xsrf1');
      expect(savedData.databases.db2.token).not.toBe('token2');
    });

    it('should throw error if required session data is missing', async () => {
      await expect(storage.saveSession({})).rejects.toThrow(
        'Missing required session data'
      );

      await expect(
        storage.saveSession({ sessionId: 'test' })
      ).rejects.toThrow('Missing required session data');
    });

    it('should handle MCP errors gracefully', async () => {
      mockMCPClient.createObject.mockRejectedValue(new Error('MCP error'));

      await expect(storage.saveSession(testSession)).rejects.toThrow(
        'Failed to save session'
      );
    });

    it('should save session with optional fields as defaults', async () => {
      mockMCPClient.createObject.mockResolvedValue({
        id: 'object-123',
        value: testSession.sessionId
      });

      const minimalSession = {
        sessionId: testSession.sessionId,
        username: testSession.username,
        createdAt: testSession.createdAt,
        expiresAt: testSession.expiresAt,
        databases: testSession.databases
      };

      await storage.saveSession(minimalSession);

      const createCall = mockMCPClient.createObject.mock.calls[0][0];
      const savedData = JSON.parse(createCall.requisites[config.tokenFieldId]);

      expect(savedData.mfaVerified).toBe(false);
      expect(savedData.ssoProvider).toBeNull();
    });
  });

  describe('getSession()', () => {
    it('should retrieve and decrypt a session', async () => {
      // Encrypt tokens for mock data
      const encryptedDb1Token = storage.encryptionService.encrypt('token1');
      const encryptedDb1Xsrf = storage.encryptionService.encrypt('xsrf1');
      const encryptedDb2Token = storage.encryptionService.encrypt('token2');
      const encryptedDb2Xsrf = storage.encryptionService.encrypt('xsrf2');

      const mockSessionData = {
        username: testSession.username,
        createdAt: testSession.createdAt.toISOString(),
        expiresAt: testSession.expiresAt.toISOString(),
        databases: {
          db1: {
            token: encryptedDb1Token,
            xsrf: encryptedDb1Xsrf,
            userId: 'user1',
            role: 'admin',
            authenticatedAt: testSession.databases.db1.authenticatedAt
          },
          db2: {
            token: encryptedDb2Token,
            xsrf: encryptedDb2Xsrf,
            userId: 'user2',
            role: 'user',
            authenticatedAt: testSession.databases.db2.authenticatedAt
          }
        },
        mfaVerified: true,
        ssoProvider: 'google'
      };

      // Mock MCP responses
      mockMCPClient.getObjectList.mockResolvedValue([
        { id: 'object-123', value: testSession.sessionId }
      ]);

      mockMCPClient.getObjectEditData.mockResolvedValue({
        id: 'object-123',
        requisites: {
          [config.tokenFieldId]: JSON.stringify(mockSessionData)
        }
      });

      const result = await storage.getSession(testSession.sessionId);

      expect(result.sessionId).toBe(testSession.sessionId);
      expect(result.username).toBe(testSession.username);
      expect(result.databases.db1.token).toBe('token1');
      expect(result.databases.db1.xsrf).toBe('xsrf1');
      expect(result.databases.db2.token).toBe('token2');
      expect(result.databases.db2.xsrf).toBe('xsrf2');
      expect(result.mfaVerified).toBe(true);
      expect(result.ssoProvider).toBe('google');
    });

    it('should return null if session not found', async () => {
      mockMCPClient.getObjectList.mockResolvedValue([]);

      const result = await storage.getSession('nonexistent-session');

      expect(result).toBeNull();
    });

    it('should handle MCP errors gracefully', async () => {
      mockMCPClient.getObjectList.mockRejectedValue(new Error('MCP error'));

      await expect(storage.getSession(testSession.sessionId)).rejects.toThrow(
        'Failed to retrieve session'
      );
    });
  });

  describe('updateSession()', () => {
    it('should update session expiration', async () => {
      // Setup existing session
      const encryptedToken = storage.encryptionService.encrypt('token1');
      const encryptedXsrf = storage.encryptionService.encrypt('xsrf1');

      mockMCPClient.getObjectList.mockResolvedValue([
        { id: 'object-123', value: testSession.sessionId }
      ]);

      mockMCPClient.getObjectEditData.mockResolvedValue({
        id: 'object-123',
        requisites: {
          [config.tokenFieldId]: JSON.stringify({
            username: testSession.username,
            createdAt: testSession.createdAt.toISOString(),
            expiresAt: testSession.expiresAt.toISOString(),
            databases: {
              db1: {
                token: encryptedToken,
                xsrf: encryptedXsrf,
                userId: 'user1',
                role: 'admin'
              }
            },
            mfaVerified: false,
            ssoProvider: null
          })
        }
      });

      mockMCPClient.setObjectRequisites.mockResolvedValue(true);

      const newExpiresAt = new Date('2025-01-03T00:00:00Z');
      const result = await storage.updateSession(testSession.sessionId, {
        expiresAt: newExpiresAt
      });

      expect(result.expiresAt).toEqual(newExpiresAt);
      expect(mockMCPClient.setObjectRequisites).toHaveBeenCalled();
    });

    it('should throw error if session not found', async () => {
      mockMCPClient.getObjectList.mockResolvedValue([]);

      await expect(
        storage.updateSession('nonexistent', { expiresAt: new Date() })
      ).rejects.toThrow('Session not found');
    });
  });

  describe('deleteSession()', () => {
    it('should delete a session', async () => {
      // Setup existing session
      mockMCPClient.getObjectList.mockResolvedValue([
        { id: 'object-123', value: testSession.sessionId }
      ]);

      mockMCPClient.getObjectEditData.mockResolvedValue({
        id: 'object-123',
        requisites: {
          [config.tokenFieldId]: JSON.stringify({
            username: 'test',
            createdAt: new Date().toISOString(),
            expiresAt: new Date().toISOString(),
            databases: {},
            mfaVerified: false,
            ssoProvider: null
          })
        }
      });

      mockMCPClient.deleteObject.mockResolvedValue(true);

      const result = await storage.deleteSession(testSession.sessionId);

      expect(result).toBe(true);
      expect(mockMCPClient.deleteObject).toHaveBeenCalledWith('object-123');
    });

    it('should return false if session not found', async () => {
      mockMCPClient.getObjectList.mockResolvedValue([]);

      const result = await storage.deleteSession('nonexistent');

      expect(result).toBe(false);
      expect(mockMCPClient.deleteObject).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredSessions()', () => {
    it('should delete expired sessions', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day future

      // Mock 3 sessions: 2 expired, 1 active
      mockMCPClient.getObjectList.mockResolvedValue([
        { id: 'obj-1', value: 'session-1' },
        { id: 'obj-2', value: 'session-2' },
        { id: 'obj-3', value: 'session-3' }
      ]);

      mockMCPClient.getObjectEditData
        .mockResolvedValueOnce({
          id: 'obj-1',
          requisites: {
            [config.tokenFieldId]: JSON.stringify({
              expiresAt: past.toISOString(),
              username: 'user1',
              createdAt: past.toISOString(),
              databases: {}
            })
          }
        })
        .mockResolvedValueOnce({
          id: 'obj-2',
          requisites: {
            [config.tokenFieldId]: JSON.stringify({
              expiresAt: future.toISOString(),
              username: 'user2',
              createdAt: now.toISOString(),
              databases: {}
            })
          }
        })
        .mockResolvedValueOnce({
          id: 'obj-3',
          requisites: {
            [config.tokenFieldId]: JSON.stringify({
              expiresAt: past.toISOString(),
              username: 'user3',
              createdAt: past.toISOString(),
              databases: {}
            })
          }
        });

      mockMCPClient.deleteObject.mockResolvedValue(true);

      const deletedCount = await storage.cleanupExpiredSessions();

      expect(deletedCount).toBe(2);
      expect(mockMCPClient.deleteObject).toHaveBeenCalledTimes(2);
      expect(mockMCPClient.deleteObject).toHaveBeenCalledWith('obj-1');
      expect(mockMCPClient.deleteObject).toHaveBeenCalledWith('obj-3');
    });

    it('should handle cleanup errors gracefully', async () => {
      mockMCPClient.getObjectList.mockResolvedValue([
        { id: 'obj-1', value: 'session-1' }
      ]);

      mockMCPClient.getObjectEditData.mockRejectedValue(new Error('MCP error'));

      // Should not throw, just log errors
      const deletedCount = await storage.cleanupExpiredSessions();

      expect(deletedCount).toBe(0);
    });
  });

  describe('getUserSessions()', () => {
    it('should retrieve all active sessions for a user', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const encryptedToken = storage.encryptionService.encrypt('token1');
      const encryptedXsrf = storage.encryptionService.encrypt('xsrf1');

      mockMCPClient.getObjectList.mockResolvedValue([
        { id: 'obj-1', value: 'session-1' },
        { id: 'obj-2', value: 'session-2' },
        { id: 'obj-3', value: 'session-3' }
      ]);

      mockMCPClient.getObjectEditData
        .mockResolvedValueOnce({
          id: 'obj-1',
          requisites: {
            [config.tokenFieldId]: JSON.stringify({
              username: 'testuser',
              expiresAt: future.toISOString(),
              createdAt: now.toISOString(),
              databases: {
                db1: {
                  token: encryptedToken,
                  xsrf: encryptedXsrf
                }
              },
              mfaVerified: false,
              ssoProvider: null
            })
          }
        })
        .mockResolvedValueOnce({
          id: 'obj-2',
          requisites: {
            [config.tokenFieldId]: JSON.stringify({
              username: 'otheruser',
              expiresAt: future.toISOString(),
              createdAt: now.toISOString(),
              databases: {},
              mfaVerified: false,
              ssoProvider: null
            })
          }
        })
        .mockResolvedValueOnce({
          id: 'obj-3',
          requisites: {
            [config.tokenFieldId]: JSON.stringify({
              username: 'testuser',
              expiresAt: past.toISOString(), // Expired
              createdAt: past.toISOString(),
              databases: {},
              mfaVerified: false,
              ssoProvider: null
            })
          }
        });

      const sessions = await storage.getUserSessions('testuser');

      expect(sessions.length).toBe(1);
      expect(sessions[0].username).toBe('testuser');
      expect(sessions[0].databases.db1.token).toBe('token1');
      expect(sessions[0].databases.db1.xsrf).toBe('xsrf1');
    });

    it('should return empty array if user has no sessions', async () => {
      mockMCPClient.getObjectList.mockResolvedValue([]);

      const sessions = await storage.getUserSessions('nouser');

      expect(sessions).toEqual([]);
    });
  });

  describe('getStats()', () => {
    it('should return session statistics', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      mockMCPClient.getObjectList.mockResolvedValue([
        { id: 'obj-1', value: 'session-1' },
        { id: 'obj-2', value: 'session-2' },
        { id: 'obj-3', value: 'session-3' }
      ]);

      mockMCPClient.getObjectEditData
        .mockResolvedValueOnce({
          id: 'obj-1',
          requisites: {
            [config.tokenFieldId]: JSON.stringify({
              username: 'user1',
              expiresAt: future.toISOString(),
              createdAt: now.toISOString(),
              databases: {}
            })
          }
        })
        .mockResolvedValueOnce({
          id: 'obj-2',
          requisites: {
            [config.tokenFieldId]: JSON.stringify({
              username: 'user2',
              expiresAt: past.toISOString(),
              createdAt: past.toISOString(),
              databases: {}
            })
          }
        })
        .mockResolvedValueOnce({
          id: 'obj-3',
          requisites: {
            [config.tokenFieldId]: JSON.stringify({
              username: 'user3',
              expiresAt: future.toISOString(),
              createdAt: now.toISOString(),
              databases: {}
            })
          }
        });

      const stats = await storage.getStats();

      expect(stats.totalSessions).toBe(3);
      expect(stats.activeSessions).toBe(2);
      expect(stats.expiredSessions).toBe(1);
      expect(stats.tableId).toBe(config.sessionsTableId);
      expect(stats.database).toBe(config.database);
    });
  });
});
