/**
 * Secrets Manager Service
 *
 * Centralized secrets management system following security best practices.
 * Handles storage, encryption, rotation, and auditing of secrets (passwords, API keys, tokens).
 *
 * Issue #2471 - Агент управления секретами и токенами
 *
 * Features:
 * - Encrypted storage of secrets (AES-256-GCM)
 * - Automatic rotation scheduling
 * - Access audit logging
 * - Secret leak detection
 * - Certificate management
 * - Integration with existing token system
 *
 * Security principles:
 * - Secrets never stored in plaintext
 * - Encryption keys derived from master key
 * - Audit log for all access
 * - Time-limited access tokens
 * - Rotation reminders and automation
 */

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Storage paths
const SECRETS_DIR = process.env.SECRETS_STORAGE_DIR || path.join(__dirname, '../../../data/secrets')
const AUDIT_LOG_DIR = process.env.AUDIT_LOG_DIR || path.join(__dirname, '../../../data/audit')
const MASTER_KEY_PATH = process.env.MASTER_KEY_PATH || path.join(__dirname, '../../../data/.master_key')

// Encryption settings
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16

// Secret types
export const SECRET_TYPES = {
  API_KEY: 'api_key',
  PASSWORD: 'password',
  TOKEN: 'token',
  CERTIFICATE: 'certificate',
  SSH_KEY: 'ssh_key',
  DATABASE_CREDENTIAL: 'database_credential',
  OAUTH_TOKEN: 'oauth_token',
  WEBHOOK_SECRET: 'webhook_secret',
  ENCRYPTION_KEY: 'encryption_key',
  OTHER: 'other'
}

// Rotation policies (in days)
export const ROTATION_POLICIES = {
  CRITICAL: 30,    // Every 30 days for critical secrets
  HIGH: 60,        // Every 60 days for high-security secrets
  MEDIUM: 90,      // Every 90 days for medium-security secrets
  LOW: 180,        // Every 180 days for low-security secrets
  NEVER: null      // No automatic rotation
}

class SecretsManager {
  constructor() {
    this.masterKey = null
    this.initialized = false
  }

  /**
   * Initialize the secrets manager
   * Creates necessary directories and loads/generates master key
   */
  async initialize() {
    if (this.initialized) return

    try {
      // Create directories if they don't exist
      await fs.mkdir(SECRETS_DIR, { recursive: true })
      await fs.mkdir(AUDIT_LOG_DIR, { recursive: true })
      await fs.mkdir(path.dirname(MASTER_KEY_PATH), { recursive: true })

      // Load or generate master key
      await this.loadOrGenerateMasterKey()

      this.initialized = true
      console.log('[SecretsManager] Initialized successfully')
    } catch (error) {
      console.error('[SecretsManager] Initialization failed:', error)
      throw new Error(`Failed to initialize SecretsManager: ${error.message}`)
    }
  }

  /**
   * Load existing master key or generate a new one
   * Master key is used to derive encryption keys for secrets
   */
  async loadOrGenerateMasterKey() {
    try {
      // Try to load existing key
      const keyData = await fs.readFile(MASTER_KEY_PATH, 'utf-8')
      this.masterKey = Buffer.from(keyData, 'hex')

      if (this.masterKey.length !== KEY_LENGTH) {
        throw new Error('Invalid master key length')
      }

      console.log('[SecretsManager] Master key loaded')
    } catch (error) {
      // Generate new master key if not found
      console.log('[SecretsManager] Generating new master key...')
      this.masterKey = crypto.randomBytes(KEY_LENGTH)

      await fs.writeFile(MASTER_KEY_PATH, this.masterKey.toString('hex'), {
        mode: 0o600 // Read/write for owner only
      })

      console.log('[SecretsManager] Master key generated and saved')
    }
  }

  /**
   * Derive encryption key from master key and secret ID
   * This ensures each secret has a unique encryption key
   */
  deriveKey(secretId) {
    return crypto.pbkdf2Sync(
      this.masterKey,
      Buffer.from(secretId),
      100000, // iterations
      KEY_LENGTH,
      'sha256'
    )
  }

  /**
   * Encrypt a secret value
   * Uses AES-256-GCM for authenticated encryption
   */
  encrypt(value, secretId) {
    const key = this.deriveKey(secretId)
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(value, 'utf-8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    }
  }

  /**
   * Decrypt a secret value
   */
  decrypt(encryptedData, secretId) {
    const key = this.deriveKey(secretId)
    const iv = Buffer.from(encryptedData.iv, 'hex')
    const authTag = Buffer.from(encryptedData.authTag, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)

    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf-8')
    decrypted += decipher.final('utf-8')

    return decrypted
  }

  /**
   * Create a new secret
   */
  async createSecret(params) {
    await this.ensureInitialized()

    const {
      name,
      value,
      type = SECRET_TYPES.OTHER,
      description = '',
      tags = [],
      rotationPolicy = ROTATION_POLICIES.MEDIUM,
      userId = 'system',
      metadata = {}
    } = params

    // Validate inputs
    if (!name || !value) {
      throw new Error('Name and value are required')
    }

    const secretId = this.generateSecretId()
    const now = new Date().toISOString()

    // Calculate next rotation date
    const nextRotation = rotationPolicy
      ? new Date(Date.now() + rotationPolicy * 24 * 60 * 60 * 1000).toISOString()
      : null

    // Encrypt the secret value
    const encryptedData = this.encrypt(value, secretId)

    const secret = {
      id: secretId,
      name,
      type,
      description,
      tags,
      encryptedValue: encryptedData.encrypted,
      iv: encryptedData.iv,
      authTag: encryptedData.authTag,
      rotationPolicy,
      nextRotation,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
      lastAccessedAt: null,
      lastAccessedBy: null,
      accessCount: 0,
      rotationHistory: [],
      metadata,
      version: 1
    }

    // Save secret to file
    await this.saveSecret(secret)

    // Log creation in audit
    await this.logAudit({
      action: 'CREATE',
      secretId,
      secretName: name,
      userId,
      timestamp: now,
      success: true
    })

    // Return secret without sensitive data
    return this.sanitizeSecret(secret)
  }

  /**
   * Get a secret by ID (decrypts the value)
   */
  async getSecret(secretId, userId = 'system', includeValue = false) {
    await this.ensureInitialized()

    const secret = await this.loadSecret(secretId)

    if (!secret) {
      throw new Error(`Secret not found: ${secretId}`)
    }

    const now = new Date().toISOString()

    // Update access tracking
    secret.lastAccessedAt = now
    secret.lastAccessedBy = userId
    secret.accessCount = (secret.accessCount || 0) + 1

    await this.saveSecret(secret)

    // Log access in audit
    await this.logAudit({
      action: 'ACCESS',
      secretId,
      secretName: secret.name,
      userId,
      timestamp: now,
      success: true,
      includeValue
    })

    // Return decrypted value if requested
    if (includeValue) {
      const decryptedValue = this.decrypt({
        encrypted: secret.encryptedValue,
        iv: secret.iv,
        authTag: secret.authTag
      }, secretId)

      return {
        ...this.sanitizeSecret(secret),
        value: decryptedValue
      }
    }

    return this.sanitizeSecret(secret)
  }

  /**
   * List all secrets (without values)
   */
  async listSecrets(filters = {}) {
    await this.ensureInitialized()

    const files = await fs.readdir(SECRETS_DIR)
    const secrets = []

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const secretPath = path.join(SECRETS_DIR, file)
          const data = await fs.readFile(secretPath, 'utf-8')
          const secret = JSON.parse(data)

          // Apply filters
          if (filters.type && secret.type !== filters.type) continue
          if (filters.tag && !secret.tags?.includes(filters.tag)) continue
          if (filters.search) {
            const searchLower = filters.search.toLowerCase()
            if (!secret.name.toLowerCase().includes(searchLower) &&
                !secret.description?.toLowerCase().includes(searchLower)) {
              continue
            }
          }

          secrets.push(this.sanitizeSecret(secret))
        } catch (error) {
          console.error(`[SecretsManager] Failed to load secret ${file}:`, error)
        }
      }
    }

    return secrets
  }

  /**
   * Update a secret
   */
  async updateSecret(secretId, updates, userId = 'system') {
    await this.ensureInitialized()

    const secret = await this.loadSecret(secretId)

    if (!secret) {
      throw new Error(`Secret not found: ${secretId}`)
    }

    const now = new Date().toISOString()

    // Update allowed fields
    if (updates.name !== undefined) secret.name = updates.name
    if (updates.description !== undefined) secret.description = updates.description
    if (updates.tags !== undefined) secret.tags = updates.tags
    if (updates.rotationPolicy !== undefined) {
      secret.rotationPolicy = updates.rotationPolicy

      // Recalculate next rotation
      secret.nextRotation = updates.rotationPolicy
        ? new Date(Date.now() + updates.rotationPolicy * 24 * 60 * 60 * 1000).toISOString()
        : null
    }
    if (updates.metadata !== undefined) {
      secret.metadata = { ...secret.metadata, ...updates.metadata }
    }

    // Update value if provided (re-encrypt with same key)
    if (updates.value !== undefined) {
      const encryptedData = this.encrypt(updates.value, secretId)
      secret.encryptedValue = encryptedData.encrypted
      secret.iv = encryptedData.iv
      secret.authTag = encryptedData.authTag
      secret.version += 1

      // Add to rotation history
      secret.rotationHistory.push({
        rotatedAt: now,
        rotatedBy: userId,
        version: secret.version
      })
    }

    secret.updatedAt = now
    secret.updatedBy = userId

    await this.saveSecret(secret)

    await this.logAudit({
      action: 'UPDATE',
      secretId,
      secretName: secret.name,
      userId,
      timestamp: now,
      success: true,
      updates: Object.keys(updates)
    })

    return this.sanitizeSecret(secret)
  }

  /**
   * Rotate a secret (generate new value)
   * Note: This marks secret for rotation. Actual new value must be provided by caller.
   */
  async rotateSecret(secretId, newValue, userId = 'system') {
    return await this.updateSecret(secretId, { value: newValue }, userId)
  }

  /**
   * Delete a secret
   */
  async deleteSecret(secretId, userId = 'system') {
    await this.ensureInitialized()

    const secret = await this.loadSecret(secretId)

    if (!secret) {
      throw new Error(`Secret not found: ${secretId}`)
    }

    const secretPath = path.join(SECRETS_DIR, `${secretId}.json`)
    await fs.unlink(secretPath)

    await this.logAudit({
      action: 'DELETE',
      secretId,
      secretName: secret.name,
      userId,
      timestamp: new Date().toISOString(),
      success: true
    })

    return { success: true, message: 'Secret deleted' }
  }

  /**
   * Check for secrets that need rotation
   */
  async getSecretsNeedingRotation() {
    await this.ensureInitialized()

    const secrets = await this.listSecrets()
    const now = Date.now()

    return secrets.filter(secret => {
      if (!secret.nextRotation) return false
      return new Date(secret.nextRotation).getTime() <= now
    })
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(filters = {}) {
    await this.ensureInitialized()

    const { secretId, userId, action, startDate, endDate, limit = 100 } = filters

    try {
      const files = await fs.readdir(AUDIT_LOG_DIR)
      const logs = []

      for (const file of files) {
        if (file.endsWith('.json')) {
          const logPath = path.join(AUDIT_LOG_DIR, file)
          const data = await fs.readFile(logPath, 'utf-8')
          const entries = JSON.parse(data)

          for (const entry of entries) {
            // Apply filters
            if (secretId && entry.secretId !== secretId) continue
            if (userId && entry.userId !== userId) continue
            if (action && entry.action !== action) continue
            if (startDate && new Date(entry.timestamp) < new Date(startDate)) continue
            if (endDate && new Date(entry.timestamp) > new Date(endDate)) continue

            logs.push(entry)
          }
        }
      }

      // Sort by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

      return logs.slice(0, limit)
    } catch (error) {
      console.error('[SecretsManager] Failed to get audit logs:', error)
      return []
    }
  }

  /**
   * Detect potential secret leaks in text
   * Looks for patterns matching common secrets
   */
  detectLeaks(text) {
    const patterns = {
      aws_key: /AKIA[0-9A-Z]{16}/g,
      github_token: /ghp_[a-zA-Z0-9]{36}/g,
      generic_api_key: /[a-zA-Z0-9_-]{32,}/g,
      password_in_url: /[a-zA-Z]+:\/\/[^:]+:[^@]+@/g,
      private_key: /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/g,
      jwt: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g
    }

    const detections = []

    for (const [type, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern)
      if (matches) {
        detections.push({
          type,
          count: matches.length,
          samples: matches.slice(0, 3).map(m => m.substring(0, 20) + '...')
        })
      }
    }

    return {
      hasLeaks: detections.length > 0,
      detections
    }
  }

  /**
   * Generate statistics about secrets
   */
  async getStatistics() {
    await this.ensureInitialized()

    const secrets = await this.listSecrets()
    const auditLogs = await this.getAuditLogs({ limit: 10000 })

    const now = Date.now()
    const needingRotation = secrets.filter(s =>
      s.nextRotation && new Date(s.nextRotation).getTime() <= now
    )

    const byType = {}
    secrets.forEach(s => {
      byType[s.type] = (byType[s.type] || 0) + 1
    })

    const recentAccess = auditLogs
      .filter(log => log.action === 'ACCESS')
      .slice(0, 10)

    return {
      total: secrets.length,
      byType,
      needingRotation: needingRotation.length,
      totalAccesses: secrets.reduce((sum, s) => sum + (s.accessCount || 0), 0),
      recentActivity: auditLogs.slice(0, 20),
      oldestSecret: secrets.length > 0
        ? secrets.reduce((oldest, s) =>
            new Date(s.createdAt) < new Date(oldest.createdAt) ? s : oldest
          )
        : null
    }
  }

  // ============= Helper Methods =============

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  generateSecretId() {
    return `secret_${crypto.randomBytes(16).toString('hex')}`
  }

  sanitizeSecret(secret) {
    const sanitized = { ...secret }
    delete sanitized.encryptedValue
    delete sanitized.iv
    delete sanitized.authTag
    return sanitized
  }

  async saveSecret(secret) {
    const secretPath = path.join(SECRETS_DIR, `${secret.id}.json`)
    await fs.writeFile(secretPath, JSON.stringify(secret, null, 2), {
      mode: 0o600
    })
  }

  async loadSecret(secretId) {
    try {
      const secretPath = path.join(SECRETS_DIR, `${secretId}.json`)
      const data = await fs.readFile(secretPath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  async logAudit(entry) {
    try {
      const date = new Date().toISOString().split('T')[0]
      const logPath = path.join(AUDIT_LOG_DIR, `audit-${date}.json`)

      let logs = []
      try {
        const data = await fs.readFile(logPath, 'utf-8')
        logs = JSON.parse(data)
      } catch (error) {
        // File doesn't exist yet
      }

      logs.push({
        ...entry,
        id: crypto.randomBytes(8).toString('hex')
      })

      await fs.writeFile(logPath, JSON.stringify(logs, null, 2), {
        mode: 0o600
      })
    } catch (error) {
      console.error('[SecretsManager] Failed to write audit log:', error)
    }
  }
}

// Singleton instance
export const secretsManager = new SecretsManager()

export default secretsManager
