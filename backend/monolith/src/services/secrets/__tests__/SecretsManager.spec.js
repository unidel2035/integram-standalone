/**
 * Unit tests for SecretsManager service
 * Issue #2471 - Агент управления секретами и токенами
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { secretsManager, SECRET_TYPES, ROTATION_POLICIES } from '../SecretsManager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test directories
const TEST_SECRETS_DIR = path.join(__dirname, '../../../data/secrets-test')
const TEST_AUDIT_DIR = path.join(__dirname, '../../../data/audit-test')
const TEST_MASTER_KEY_PATH = path.join(__dirname, '../../../data/.master_key_test')

describe('SecretsManager', () => {
  beforeEach(async () => {
    // Override environment variables for testing
    process.env.SECRETS_STORAGE_DIR = TEST_SECRETS_DIR
    process.env.AUDIT_LOG_DIR = TEST_AUDIT_DIR
    process.env.MASTER_KEY_PATH = TEST_MASTER_KEY_PATH

    // Reset the secrets manager
    secretsManager.initialized = false
    secretsManager.masterKey = null

    // Clean up test directories
    await cleanupTestDirs()

    // Initialize
    await secretsManager.initialize()
  })

  afterEach(async () => {
    await cleanupTestDirs()
  })

  async function cleanupTestDirs() {
    try {
      await fs.rm(TEST_SECRETS_DIR, { recursive: true, force: true })
      await fs.rm(TEST_AUDIT_DIR, { recursive: true, force: true })
      await fs.unlink(TEST_MASTER_KEY_PATH).catch(() => {})
    } catch (error) {
      // Ignore errors
    }
  }

  describe('Initialization', () => {
    it('should initialize directories and master key', async () => {
      expect(secretsManager.initialized).toBe(true)
      expect(secretsManager.masterKey).toBeTruthy()
      expect(secretsManager.masterKey.length).toBe(32)

      // Check directories exist
      const secretsDirStat = await fs.stat(TEST_SECRETS_DIR)
      expect(secretsDirStat.isDirectory()).toBe(true)

      const auditDirStat = await fs.stat(TEST_AUDIT_DIR)
      expect(auditDirStat.isDirectory()).toBe(true)

      // Check master key file exists
      const masterKeyStat = await fs.stat(TEST_MASTER_KEY_PATH)
      expect(masterKeyStat.isFile()).toBe(true)
    })

    it('should load existing master key', async () => {
      const firstKey = Buffer.from(secretsManager.masterKey)

      // Reinitialize
      secretsManager.initialized = false
      secretsManager.masterKey = null
      await secretsManager.initialize()

      const secondKey = Buffer.from(secretsManager.masterKey)

      expect(firstKey.equals(secondKey)).toBe(true)
    })
  })

  describe('Encryption and Decryption', () => {
    it('should encrypt and decrypt a value', () => {
      const secretId = 'test-secret-id'
      const value = 'my-super-secret-password'

      const encrypted = secretsManager.encrypt(value, secretId)

      expect(encrypted.encrypted).toBeTruthy()
      expect(encrypted.iv).toBeTruthy()
      expect(encrypted.authTag).toBeTruthy()

      const decrypted = secretsManager.decrypt(encrypted, secretId)
      expect(decrypted).toBe(value)
    })

    it('should produce different encrypted values for the same plaintext', () => {
      const secretId = 'test-secret-id'
      const value = 'my-secret'

      const encrypted1 = secretsManager.encrypt(value, secretId)
      const encrypted2 = secretsManager.encrypt(value, secretId)

      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted)
      expect(encrypted1.iv).not.toBe(encrypted2.iv)
    })

    it('should fail to decrypt with wrong secret ID', () => {
      const secretId = 'test-secret-id'
      const wrongId = 'wrong-id'
      const value = 'my-secret'

      const encrypted = secretsManager.encrypt(value, secretId)

      expect(() => {
        secretsManager.decrypt(encrypted, wrongId)
      }).toThrow()
    })
  })

  describe('Create Secret', () => {
    it('should create a new secret', async () => {
      const secretData = {
        name: 'GitHub API Token',
        value: 'ghp_1234567890abcdef',
        type: SECRET_TYPES.API_KEY,
        description: 'Token for GitHub API',
        tags: ['github', 'api'],
        rotationPolicy: ROTATION_POLICIES.MEDIUM,
        userId: 'test-user'
      }

      const secret = await secretsManager.createSecret(secretData)

      expect(secret.id).toBeTruthy()
      expect(secret.name).toBe(secretData.name)
      expect(secret.type).toBe(secretData.type)
      expect(secret.description).toBe(secretData.description)
      expect(secret.tags).toEqual(secretData.tags)
      expect(secret.rotationPolicy).toBe(secretData.rotationPolicy)
      expect(secret.createdBy).toBe('test-user')
      expect(secret.nextRotation).toBeTruthy()

      // Should not contain encrypted value in response
      expect(secret.value).toBeUndefined()
      expect(secret.encryptedValue).toBeUndefined()
    })

    it('should reject secret without name', async () => {
      await expect(async () => {
        await secretsManager.createSecret({
          value: 'test-value'
        })
      }).rejects.toThrow('Name and value are required')
    })

    it('should reject secret without value', async () => {
      await expect(async () => {
        await secretsManager.createSecret({
          name: 'Test Secret'
        })
      }).rejects.toThrow('Name and value are required')
    })
  })

  describe('Get Secret', () => {
    it('should get secret without value by default', async () => {
      const created = await secretsManager.createSecret({
        name: 'Test Secret',
        value: 'secret-value',
        userId: 'test-user'
      })

      const retrieved = await secretsManager.getSecret(created.id, 'test-user', false)

      expect(retrieved.id).toBe(created.id)
      expect(retrieved.name).toBe('Test Secret')
      expect(retrieved.value).toBeUndefined()
    })

    it('should get secret with decrypted value when requested', async () => {
      const created = await secretsManager.createSecret({
        name: 'Test Secret',
        value: 'secret-value',
        userId: 'test-user'
      })

      const retrieved = await secretsManager.getSecret(created.id, 'test-user', true)

      expect(retrieved.id).toBe(created.id)
      expect(retrieved.value).toBe('secret-value')
    })

    it('should track access count', async () => {
      const created = await secretsManager.createSecret({
        name: 'Test Secret',
        value: 'secret-value',
        userId: 'test-user'
      })

      await secretsManager.getSecret(created.id, 'test-user', false)
      await secretsManager.getSecret(created.id, 'test-user', false)

      const retrieved = await secretsManager.getSecret(created.id, 'test-user', false)

      expect(retrieved.accessCount).toBe(3)
      expect(retrieved.lastAccessedBy).toBe('test-user')
      expect(retrieved.lastAccessedAt).toBeTruthy()
    })

    it('should throw error for non-existent secret', async () => {
      await expect(async () => {
        await secretsManager.getSecret('non-existent-id', 'test-user')
      }).rejects.toThrow('Secret not found')
    })
  })

  describe('List Secrets', () => {
    beforeEach(async () => {
      // Create test secrets
      await secretsManager.createSecret({
        name: 'API Key 1',
        value: 'key1',
        type: SECRET_TYPES.API_KEY,
        tags: ['api', 'production'],
        userId: 'test-user'
      })

      await secretsManager.createSecret({
        name: 'Password 1',
        value: 'pass1',
        type: SECRET_TYPES.PASSWORD,
        tags: ['password', 'database'],
        userId: 'test-user'
      })

      await secretsManager.createSecret({
        name: 'API Key 2',
        value: 'key2',
        type: SECRET_TYPES.API_KEY,
        tags: ['api', 'staging'],
        userId: 'test-user'
      })
    })

    it('should list all secrets', async () => {
      const secrets = await secretsManager.listSecrets()
      expect(secrets.length).toBe(3)
    })

    it('should filter by type', async () => {
      const apiKeys = await secretsManager.listSecrets({ type: SECRET_TYPES.API_KEY })
      expect(apiKeys.length).toBe(2)

      const passwords = await secretsManager.listSecrets({ type: SECRET_TYPES.PASSWORD })
      expect(passwords.length).toBe(1)
    })

    it('should filter by tag', async () => {
      const apiSecrets = await secretsManager.listSecrets({ tag: 'api' })
      expect(apiSecrets.length).toBe(2)

      const prodSecrets = await secretsManager.listSecrets({ tag: 'production' })
      expect(prodSecrets.length).toBe(1)
    })

    it('should search by name', async () => {
      const results = await secretsManager.listSecrets({ search: 'API Key' })
      expect(results.length).toBe(2)

      const results2 = await secretsManager.listSecrets({ search: 'Password' })
      expect(results2.length).toBe(1)
    })
  })

  describe('Update Secret', () => {
    it('should update secret metadata', async () => {
      const created = await secretsManager.createSecret({
        name: 'Test Secret',
        value: 'original-value',
        description: 'Original description',
        userId: 'test-user'
      })

      const updated = await secretsManager.updateSecret(
        created.id,
        {
          name: 'Updated Secret',
          description: 'Updated description',
          tags: ['new', 'tags']
        },
        'test-user'
      )

      expect(updated.name).toBe('Updated Secret')
      expect(updated.description).toBe('Updated description')
      expect(updated.tags).toEqual(['new', 'tags'])
      expect(updated.updatedBy).toBe('test-user')
    })

    it('should update secret value and increment version', async () => {
      const created = await secretsManager.createSecret({
        name: 'Test Secret',
        value: 'original-value',
        userId: 'test-user'
      })

      expect(created.version).toBe(1)

      const updated = await secretsManager.updateSecret(
        created.id,
        { value: 'new-value' },
        'test-user'
      )

      expect(updated.version).toBe(2)
      expect(updated.rotationHistory.length).toBe(1)
      expect(updated.rotationHistory[0].rotatedBy).toBe('test-user')

      // Verify new value is correct
      const retrieved = await secretsManager.getSecret(created.id, 'test-user', true)
      expect(retrieved.value).toBe('new-value')
    })
  })

  describe('Rotate Secret', () => {
    it('should rotate secret', async () => {
      const created = await secretsManager.createSecret({
        name: 'Test Secret',
        value: 'original-value',
        userId: 'test-user'
      })

      const rotated = await secretsManager.rotateSecret(
        created.id,
        'rotated-value',
        'test-user'
      )

      expect(rotated.version).toBe(2)

      const retrieved = await secretsManager.getSecret(created.id, 'test-user', true)
      expect(retrieved.value).toBe('rotated-value')
    })
  })

  describe('Delete Secret', () => {
    it('should delete secret', async () => {
      const created = await secretsManager.createSecret({
        name: 'Test Secret',
        value: 'value',
        userId: 'test-user'
      })

      const result = await secretsManager.deleteSecret(created.id, 'test-user')
      expect(result.success).toBe(true)

      await expect(async () => {
        await secretsManager.getSecret(created.id, 'test-user')
      }).rejects.toThrow('Secret not found')
    })
  })

  describe('Rotation Needed', () => {
    it('should identify secrets needing rotation', async () => {
      // Create secret with short rotation period (1 day in the past)
      const created = await secretsManager.createSecret({
        name: 'Old Secret',
        value: 'value',
        rotationPolicy: 1,
        userId: 'test-user'
      })

      // Manually set next rotation to the past
      const secret = await secretsManager.loadSecret(created.id)
      secret.nextRotation = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      await secretsManager.saveSecret(secret)

      const needingRotation = await secretsManager.getSecretsNeedingRotation()
      expect(needingRotation.length).toBeGreaterThan(0)
      expect(needingRotation.some(s => s.id === created.id)).toBe(true)
    })
  })

  describe('Audit Logs', () => {
    it('should log secret creation', async () => {
      await secretsManager.createSecret({
        name: 'Test Secret',
        value: 'value',
        userId: 'test-user'
      })

      const logs = await secretsManager.getAuditLogs()
      const createLog = logs.find(log => log.action === 'CREATE')

      expect(createLog).toBeTruthy()
      expect(createLog.userId).toBe('test-user')
      expect(createLog.success).toBe(true)
    })

    it('should log secret access', async () => {
      const created = await secretsManager.createSecret({
        name: 'Test Secret',
        value: 'value',
        userId: 'test-user'
      })

      await secretsManager.getSecret(created.id, 'test-user', true)

      const logs = await secretsManager.getAuditLogs()
      const accessLog = logs.find(
        log => log.action === 'ACCESS' && log.secretId === created.id
      )

      expect(accessLog).toBeTruthy()
      expect(accessLog.includeValue).toBe(true)
    })

    it('should filter audit logs by action', async () => {
      await secretsManager.createSecret({
        name: 'Test Secret',
        value: 'value',
        userId: 'test-user'
      })

      const createLogs = await secretsManager.getAuditLogs({ action: 'CREATE' })
      expect(createLogs.every(log => log.action === 'CREATE')).toBe(true)
    })
  })

  describe('Leak Detection', () => {
    it('should detect AWS keys', () => {
      const text = 'Here is an AWS key: AKIAIOSFODNN7EXAMPLE'
      const result = secretsManager.detectLeaks(text)

      expect(result.hasLeaks).toBe(true)
      expect(result.detections.some(d => d.type === 'aws_key')).toBe(true)
    })

    it('should detect GitHub tokens', () => {
      const text = 'ghp_1234567890abcdefghijklmnopqrstuvwxy'
      const result = secretsManager.detectLeaks(text)

      expect(result.hasLeaks).toBe(true)
      expect(result.detections.some(d => d.type === 'github_token')).toBe(true)
    })

    it('should detect private keys', () => {
      const text = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...'
      const result = secretsManager.detectLeaks(text)

      expect(result.hasLeaks).toBe(true)
      expect(result.detections.some(d => d.type === 'private_key')).toBe(true)
    })

    it('should detect JWTs', () => {
      const text = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      const result = secretsManager.detectLeaks(text)

      expect(result.hasLeaks).toBe(true)
      expect(result.detections.some(d => d.type === 'jwt')).toBe(true)
    })

    it('should not detect leaks in clean text', () => {
      const text = 'This is a normal text without any secrets'
      const result = secretsManager.detectLeaks(text)

      expect(result.hasLeaks).toBe(false)
      expect(result.detections.length).toBe(0)
    })
  })

  describe('Statistics', () => {
    beforeEach(async () => {
      await secretsManager.createSecret({
        name: 'Secret 1',
        value: 'value1',
        type: SECRET_TYPES.API_KEY,
        userId: 'test-user'
      })

      await secretsManager.createSecret({
        name: 'Secret 2',
        value: 'value2',
        type: SECRET_TYPES.PASSWORD,
        userId: 'test-user'
      })
    })

    it('should calculate statistics', async () => {
      const stats = await secretsManager.getStatistics()

      expect(stats.total).toBe(2)
      expect(stats.byType[SECRET_TYPES.API_KEY]).toBe(1)
      expect(stats.byType[SECRET_TYPES.PASSWORD]).toBe(1)
      expect(stats.recentActivity).toBeTruthy()
    })
  })
})
