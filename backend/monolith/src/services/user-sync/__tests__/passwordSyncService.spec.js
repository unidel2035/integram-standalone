/**
 * Unit Tests for Password Sync Service
 *
 * Tests password hashing, verification, and synchronization across databases.
 * Target: >= 70% code coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as passwordSyncService from '../passwordSyncService.js';
import * as storageService from '../storageService.js';

// Mock dependencies
vi.mock('../../utils/IntegramClient.js', () => ({
  createIntegramClient: vi.fn(() => ({
    authenticate: vi.fn().mockResolvedValue({}),
    updateUser: vi.fn().mockResolvedValue({ id: 'rec_123' }),
    getUser: vi.fn().mockResolvedValue({
      id: 'rec_123',
      password_hash: '$2b$10$test.hash.here'
    }),
    isAuthenticated: vi.fn().mockReturnValue(true)
  }))
}));

vi.mock('../storageService.js', () => ({
  getUserFromRegistry: vi.fn(),
  addLog: vi.fn().mockResolvedValue({}),
  readRegistry: vi.fn().mockResolvedValue({
    users: {},
    metadata: { totalUsers: 0 }
  })
}));

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Set environment variables for tests
process.env.INTEGRAM_SYSTEM_USERNAME = 'test_admin';
process.env.INTEGRAM_SYSTEM_PASSWORD = 'test_password';

describe('passwordSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash a valid password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await passwordSyncService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).toContain('$2b$'); // bcrypt hash prefix
    });

    it('should throw error for short password', async () => {
      const password = 'short';

      await expect(passwordSyncService.hashPassword(password)).rejects.toThrow(
        'Password must be at least 8 characters'
      );
    });

    it('should throw error for empty password', async () => {
      await expect(passwordSyncService.hashPassword('')).rejects.toThrow(
        'Password must be at least 8 characters'
      );
    });

    it('should produce different hashes for same password (salt)', async () => {
      const password = 'MySecurePassword123!';
      const hash1 = await passwordSyncService.hashPassword(password);
      const hash2 = await passwordSyncService.hashPassword(password);

      expect(hash1).not.toBe(hash2); // Different salts
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await passwordSyncService.hashPassword(password);

      const isValid = await passwordSyncService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'MySecurePassword123!';
      const wrongPassword = 'WrongPassword456!';
      const hash = await passwordSyncService.hashPassword(password);

      const isValid = await passwordSyncService.verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should handle invalid hash gracefully', async () => {
      const password = 'MySecurePassword123!';
      const invalidHash = 'not-a-valid-hash';

      const isValid = await passwordSyncService.verifyPassword(password, invalidHash);
      expect(isValid).toBe(false);
    });
  });

  describe('updatePasswordInAllDatabases', () => {
    it('should sync password to all user databases', async () => {
      const userId = 'user-123';
      const hashedPassword = '$2b$10$test.hash.here';

      // Mock user with multiple databases
      vi.mocked(storageService.getUserFromRegistry).mockResolvedValue({
        userId,
        email: 'test@example.com',
        databases: [
          { name: 'ddadmin', recordId: 'rec_1', status: 'synced' },
          { name: 'a2025', recordId: 'rec_2', status: 'synced' }
        ]
      });

      const result = await passwordSyncService.updatePasswordInAllDatabases(userId, hashedPassword);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(2);
      expect(result.totalCount).toBe(2);
      expect(storageService.addLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          operation: 'password_sync',
          status: 'success'
        })
      );
    });

    it('should handle user with no databases', async () => {
      const userId = 'user-123';
      const hashedPassword = '$2b$10$test.hash.here';

      vi.mocked(storageService.getUserFromRegistry).mockResolvedValue({
        userId,
        email: 'test@example.com',
        databases: []
      });

      await expect(
        passwordSyncService.updatePasswordInAllDatabases(userId, hashedPassword)
      ).rejects.toThrow('has no synchronized databases');
    });

    it('should handle user not found', async () => {
      const userId = 'nonexistent-user';
      const hashedPassword = '$2b$10$test.hash.here';

      vi.mocked(storageService.getUserFromRegistry).mockResolvedValue(null);

      await expect(
        passwordSyncService.updatePasswordInAllDatabases(userId, hashedPassword)
      ).rejects.toThrow('has no synchronized databases');
    });

    it('should report partial failure when some databases fail', async () => {
      const userId = 'user-123';
      const hashedPassword = '$2b$10$test.hash.here';

      vi.mocked(storageService.getUserFromRegistry).mockResolvedValue({
        userId,
        email: 'test@example.com',
        databases: [
          { name: 'ddadmin', recordId: 'rec_1', status: 'synced' },
          { name: 'a2025', recordId: 'rec_2', status: 'synced' }
        ]
      });

      // Mock one database update to fail
      const { createIntegramClient } = await import('../../utils/IntegramClient.js');
      let callCount = 0;
      vi.mocked(createIntegramClient).mockImplementation(() => ({
        authenticate: vi.fn().mockResolvedValue({}),
        updateUser: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Database connection failed');
          }
          return Promise.resolve({ id: `rec_${callCount}` });
        }),
        isAuthenticated: vi.fn().mockReturnValue(true)
      }));

      const result = await passwordSyncService.updatePasswordInAllDatabases(userId, hashedPassword);

      expect(result.success).toBe(false);
      expect(result.failedDatabases).toHaveLength(1);
      expect(storageService.addLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          operation: 'password_sync',
          status: 'partial_failure'
        })
      );
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const userId = 'user-123';
      const currentPassword = 'OldPassword123!';
      const newPassword = 'NewPassword456!';

      // Mock user data
      vi.mocked(storageService.getUserFromRegistry).mockResolvedValue({
        userId,
        email: 'test@example.com',
        databases: [
          { name: 'ddadmin', recordId: 'rec_1', status: 'synced' },
          { name: 'a2025', recordId: 'rec_2', status: 'synced' }
        ]
      });

      // Mock Integram client
      const { createIntegramClient } = await import('../../utils/IntegramClient.js');
      const hashedCurrentPassword = await passwordSyncService.hashPassword(currentPassword);

      vi.mocked(createIntegramClient).mockImplementation(() => ({
        authenticate: vi.fn().mockResolvedValue({}),
        getUser: vi.fn().mockResolvedValue({
          id: 'rec_1',
          password_hash: hashedCurrentPassword
        }),
        updateUser: vi.fn().mockResolvedValue({ id: 'rec_1' }),
        isAuthenticated: vi.fn().mockReturnValue(true)
      }));

      const result = await passwordSyncService.changePassword(
        userId,
        currentPassword,
        newPassword,
        { ipAddress: '127.0.0.1' }
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password changed successfully');
      expect(storageService.addLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          operation: 'password_change',
          status: 'success'
        })
      );
    });

    it('should reject invalid current password', async () => {
      const userId = 'user-123';
      const currentPassword = 'WrongPassword123!';
      const newPassword = 'NewPassword456!';

      vi.mocked(storageService.getUserFromRegistry).mockResolvedValue({
        userId,
        email: 'test@example.com',
        databases: [{ name: 'ddadmin', recordId: 'rec_1', status: 'synced' }]
      });

      const { createIntegramClient } = await import('../../utils/IntegramClient.js');
      const correctHash = await passwordSyncService.hashPassword('CorrectPassword123!');

      vi.mocked(createIntegramClient).mockImplementation(() => ({
        authenticate: vi.fn().mockResolvedValue({}),
        getUser: vi.fn().mockResolvedValue({
          id: 'rec_1',
          password_hash: correctHash
        }),
        isAuthenticated: vi.fn().mockReturnValue(true)
      }));

      await expect(
        passwordSyncService.changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow('Current password is incorrect');

      expect(storageService.addLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          operation: 'password_change',
          status: 'failed',
          reason: 'invalid_current_password'
        })
      );
    });

    it('should reject short new password', async () => {
      const userId = 'user-123';
      const currentPassword = 'OldPassword123!';
      const newPassword = 'short';

      vi.mocked(storageService.getUserFromRegistry).mockResolvedValue({
        userId,
        email: 'test@example.com',
        databases: [{ name: 'ddadmin', recordId: 'rec_1', status: 'synced' }]
      });

      await expect(
        passwordSyncService.changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow('New password must be at least 8 characters');
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully (admin operation)', async () => {
      const userId = 'user-123';
      const newPassword = 'NewPassword456!';
      const adminId = 'admin-456';

      vi.mocked(storageService.getUserFromRegistry).mockResolvedValue({
        userId,
        email: 'test@example.com',
        databases: [
          { name: 'ddadmin', recordId: 'rec_1', status: 'synced' },
          { name: 'a2025', recordId: 'rec_2', status: 'synced' }
        ]
      });

      const result = await passwordSyncService.resetPassword(userId, newPassword, { adminId });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password reset successfully');
      expect(storageService.addLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          operation: 'password_reset',
          status: 'success',
          adminId
        })
      );
    });

    it('should reject short password in reset', async () => {
      const userId = 'user-123';
      const newPassword = 'short';

      await expect(passwordSyncService.resetPassword(userId, newPassword)).rejects.toThrow(
        'New password must be at least 8 characters'
      );
    });
  });
});
