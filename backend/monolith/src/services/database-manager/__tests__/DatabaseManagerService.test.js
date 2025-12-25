/**
 * Database Manager Service Tests
 *
 * Issue #1802: Database Architecture Selection System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseManagerService } from '../DatabaseManagerService.js';

describe('DatabaseManagerService', () => {
  let service;

  beforeEach(() => {
    service = new DatabaseManagerService({
      db: null,
      logger: console
    });
  });

  describe('Database Types', () => {
    it('should initialize with 7 database types', async () => {
      const result = await service.listDatabaseTypes();
      expect(result.types).toHaveLength(7);
    });

    it('should include PostgreSQL as available', async () => {
      const result = await service.listDatabaseTypes();
      const postgresql = result.types.find(t => t.id === 'postgresql');

      expect(postgresql).toBeDefined();
      expect(postgresql.status).toBe('available');
      expect(postgresql.category).toBe('relational');
    });

    it('should include Neo4j as available', async () => {
      const result = await service.listDatabaseTypes();
      const neo4j = result.types.find(t => t.id === 'neo4j');

      expect(neo4j).toBeDefined();
      expect(neo4j.status).toBe('available');
      expect(neo4j.category).toBe('graph');
    });

    it('should include Integram as available', async () => {
      const result = await service.listDatabaseTypes();
      const integram = result.types.find(t => t.id === 'integram');

      expect(integram).toBeDefined();
      expect(integram.status).toBe('available');
      expect(integram.category).toBe('document');
    });

    it('should filter by category', async () => {
      const result = await service.listDatabaseTypes({ category: 'ai' });
      const types = result.types;

      expect(types.length).toBeGreaterThan(0);
      types.forEach(type => {
        expect(type.category).toBe('ai');
      });
    });

    it('should filter by status', async () => {
      const result = await service.listDatabaseTypes({ status: 'available' });
      const types = result.types;

      expect(types.length).toBeGreaterThan(0);
      types.forEach(type => {
        expect(type.status).toBe('available');
      });
    });

    it('should return categories list', async () => {
      const result = await service.listDatabaseTypes();
      expect(result.categories).toContain('relational');
      expect(result.categories).toContain('graph');
      expect(result.categories).toContain('ai');
    });
  });

  describe('Get Database Type', () => {
    it('should get specific database type', async () => {
      const type = await service.getDatabaseType('postgresql');
      expect(type.id).toBe('postgresql');
      expect(type.name).toBe('PostgreSQL');
    });

    it('should throw error for unknown type', async () => {
      await expect(service.getDatabaseType('unknown')).rejects.toThrow('not found');
    });
  });

  describe('Deploy Database', () => {
    it('should deploy PostgreSQL instance', async () => {
      const result = await service.deployDatabase({
        type: 'postgresql',
        name: 'test-db',
        config: {
          memory: '2GB',
          storage: '10GB'
        },
        userId: 'test-user'
      });

      expect(result.instanceId).toBeDefined();
      expect(result.status).toBe('deploying');
      expect(result.connection).toBeDefined();
      expect(result.connection.password).toBeDefined();
    });

    it('should reject invalid database type', async () => {
      await expect(service.deployDatabase({
        type: 'unknown',
        name: 'test-db',
        userId: 'test-user'
      })).rejects.toThrow('not found');
    });

    it('should reject planned database types', async () => {
      await expect(service.deployDatabase({
        type: 'blockchain', // planned, not available
        name: 'test-db',
        userId: 'test-user'
      })).rejects.toThrow('not available');
    });

    it('should reject short names', async () => {
      await expect(service.deployDatabase({
        type: 'postgresql',
        name: 'ab', // too short
        userId: 'test-user'
      })).rejects.toThrow('at least 3 characters');
    });

    it('should generate secure credentials', async () => {
      const result = await service.deployDatabase({
        type: 'postgresql',
        name: 'test-db',
        userId: 'test-user'
      });

      expect(result.connection.username).toMatch(/^db_[a-f0-9]{8}$/);
      expect(result.connection.password).toBeTruthy();
      expect(result.connection.password.length).toBeGreaterThan(0);
    });
  });

  describe('Instance Management', () => {
    let instanceId;

    beforeEach(async () => {
      const result = await service.deployDatabase({
        type: 'postgresql',
        name: 'test-db',
        userId: 'test-user'
      });
      instanceId = result.instanceId;
    });

    it('should get instance status', async () => {
      const status = await service.getInstanceStatus(instanceId);
      expect(status.instanceId).toBe(instanceId);
      expect(status.name).toBe('test-db');
      expect(status.type).toBe('postgresql');
    });

    it('should list user instances', async () => {
      const instances = await service.listInstances({ userId: 'test-user' });
      expect(instances.length).toBeGreaterThan(0);

      const instance = instances.find(i => i.id === instanceId);
      expect(instance).toBeDefined();
    });

    it('should test connection', async () => {
      // Wait a bit for deployment to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await service.testConnection(instanceId);
      expect(result.success).toBe(true);
      expect(result.latency).toBeDefined();
    });

    it('should stop instance', async () => {
      // Wait for deployment
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await service.stopInstance(instanceId);
      expect(result.success).toBe(true);

      const status = await service.getInstanceStatus(instanceId);
      expect(status.status).toBe('stopped');
    });

    it('should start stopped instance', async () => {
      await service.stopInstance(instanceId);

      const result = await service.startInstance(instanceId);
      expect(result.success).toBe(true);

      const status = await service.getInstanceStatus(instanceId);
      expect(status.status).toBe('running');
    });

    it('should delete instance', async () => {
      const result = await service.deleteInstance(instanceId);
      expect(result.success).toBe(true);

      await expect(service.getInstanceStatus(instanceId)).rejects.toThrow('not found');
    });
  });

  describe('Credential Generation', () => {
    it('should generate unique credentials', () => {
      const creds1 = service.generateCredentials();
      const creds2 = service.generateCredentials();

      expect(creds1.username).not.toBe(creds2.username);
      expect(creds1.password).not.toBe(creds2.password);
    });

    it('should generate valid usernames', () => {
      const creds = service.generateCredentials();
      expect(creds.username).toMatch(/^db_[a-f0-9]{8}$/);
    });

    it('should generate strong passwords', () => {
      const creds = service.generateCredentials();
      expect(creds.password.length).toBeGreaterThan(16);
    });

    it('should hash passwords', () => {
      const password = 'test123';
      const hash = service.hashPassword(password);

      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
      expect(hash.length).toBe(64); // SHA-256 hex string
    });
  });
});
