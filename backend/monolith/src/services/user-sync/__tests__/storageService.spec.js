/**
 * Tests for Storage Service
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  readRegistry,
  writeRegistry,
  updateUserInRegistry,
  getUserFromRegistry,
  deleteUserFromRegistry,
  addDatabaseSyncRecord,
  readLogs,
  writeLogs,
  addLog,
  getLogsForUser,
  getAllLogs,
  clearOldLogs
} from '../storageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_STORAGE_DIR = path.join(__dirname, '../../../storage/user-sync-test');
const TEST_REGISTRY_FILE = path.join(TEST_STORAGE_DIR, 'user_sync_registry.json');
const TEST_LOGS_FILE = path.join(TEST_STORAGE_DIR, 'sync_logs.json');

// Mock the storage paths
vi.mock('../storageService.js', async (importOriginal) => {
  const actual = await importOriginal();
  // We'll use the actual implementation but with test file paths
  return actual;
});

describe('Storage Service - Registry Operations', () => {
  beforeEach(async () => {
    // Clean up test storage before each test
    try {
      await fs.rm(TEST_STORAGE_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test storage after each test
    try {
      await fs.rm(TEST_STORAGE_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('readRegistry', () => {
    it('should return empty registry if file does not exist', async () => {
      const registry = await readRegistry();

      expect(registry).toBeDefined();
      expect(registry.users).toEqual({});
      expect(registry.metadata).toBeDefined();
      expect(registry.metadata.version).toBe('1.0.0');
      expect(registry.metadata.totalUsers).toBe(0);
    });

    it('should read existing registry file', async () => {
      const testRegistry = {
        users: {
          'user-123': {
            userId: 'user-123',
            email: 'test@example.com',
            databases: []
          }
        },
        metadata: {
          version: '1.0.0',
          totalUsers: 1
        }
      };

      await writeRegistry(testRegistry);
      const registry = await readRegistry();

      expect(registry.users['user-123']).toBeDefined();
      expect(registry.users['user-123'].email).toBe('test@example.com');
    });
  });

  describe('writeRegistry', () => {
    it('should write registry to file', async () => {
      const testRegistry = {
        users: {
          'user-456': {
            userId: 'user-456',
            email: 'write@example.com'
          }
        }
      };

      await writeRegistry(testRegistry);

      const registry = await readRegistry();
      expect(registry.users['user-456']).toBeDefined();
      expect(registry.users['user-456'].email).toBe('write@example.com');
    });

    it('should update metadata when writing registry', async () => {
      const testRegistry = {
        users: {
          'user-1': { userId: 'user-1', email: 'user1@example.com' },
          'user-2': { userId: 'user-2', email: 'user2@example.com' }
        }
      };

      await writeRegistry(testRegistry);
      const registry = await readRegistry();

      expect(registry.metadata.totalUsers).toBe(2);
      expect(registry.metadata.lastUpdated).toBeDefined();
    });
  });

  describe('updateUserInRegistry', () => {
    it('should create new user if not exists', async () => {
      const userData = {
        userId: 'new-user',
        email: 'new@example.com',
        username: 'newuser'
      };

      const user = await updateUserInRegistry('new-user', userData);

      expect(user.userId).toBe('new-user');
      expect(user.email).toBe('new@example.com');
      expect(user.createdAt).toBeDefined();
      expect(user.databases).toEqual([]);
    });

    it('should update existing user', async () => {
      const initialData = {
        userId: 'existing-user',
        email: 'initial@example.com'
      };

      await updateUserInRegistry('existing-user', initialData);

      const updatedData = {
        email: 'updated@example.com',
        username: 'updated'
      };

      const user = await updateUserInRegistry('existing-user', updatedData);

      expect(user.email).toBe('updated@example.com');
      expect(user.username).toBe('updated');
      expect(user.updatedAt).toBeDefined();
    });
  });

  describe('getUserFromRegistry', () => {
    it('should return null for non-existent user', async () => {
      const user = await getUserFromRegistry('non-existent');
      expect(user).toBeNull();
    });

    it('should return user data for existing user', async () => {
      const userData = {
        userId: 'test-user',
        email: 'test@example.com'
      };

      await updateUserInRegistry('test-user', userData);
      const user = await getUserFromRegistry('test-user');

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
    });
  });

  describe('deleteUserFromRegistry', () => {
    it('should delete user from registry', async () => {
      const userData = {
        userId: 'delete-me',
        email: 'delete@example.com'
      };

      await updateUserInRegistry('delete-me', userData);
      let user = await getUserFromRegistry('delete-me');
      expect(user).toBeDefined();

      await deleteUserFromRegistry('delete-me');
      user = await getUserFromRegistry('delete-me');
      expect(user).toBeNull();
    });

    it('should not throw error when deleting non-existent user', async () => {
      await expect(deleteUserFromRegistry('non-existent')).resolves.not.toThrow();
    });
  });

  describe('addDatabaseSyncRecord', () => {
    it('should add database sync record to user', async () => {
      const userData = {
        userId: 'sync-user',
        email: 'sync@example.com',
        databases: []
      };

      await updateUserInRegistry('sync-user', userData);

      const dbRecord = {
        name: 'ddadmin',
        recordId: 'rec_123'
      };

      const user = await addDatabaseSyncRecord('sync-user', dbRecord);

      expect(user.databases).toHaveLength(1);
      expect(user.databases[0].name).toBe('ddadmin');
      expect(user.databases[0].recordId).toBe('rec_123');
      expect(user.databases[0].status).toBe('synced');
      expect(user.databases