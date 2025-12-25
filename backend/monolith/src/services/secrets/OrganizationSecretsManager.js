/**
 * Organization Secrets Manager
 *
 * Extends the base SecretsManager to add organization-scoped secrets
 * with role-based access control.
 *
 * Issue #2963 - Organization-based secret management system
 *
 * Features:
 * - Organization-scoped secrets
 * - Role-based access control (owner, admin, member, viewer)
 * - Per-secret required role configuration
 * - Comprehensive audit logging
 * - Integration with OrganizationService
 */

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import organizationService, { ROLES } from '../organization/OrganizationService.js'
import { SECRET_TYPES, ROTATION_POLICIES } from './SecretsManager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Storage paths
const ORG_SECRETS_DIR = process.env.ORG_SECRETS_DIR || path.join(__dirname, '../../../data/organization_secrets')
const ORG_AUDIT_LOG_DIR = process.env.ORG_AUDIT_LOG_DIR || path.join(__dirname, '../../../data/organization_audit')
const MASTER_KEY_PATH = process.env.MASTER_KEY_PATH || path.join(__dirname, '../../../data/.master_key')

// Encryption settings (same as SecretsManager)
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16

/**
 * Organization Secrets Manager
 */
class OrganizationSecretsManager {
  constructor() {
    this.masterKey = null
    this.initialized = false
  }

  /**
   * Initialize the organization secrets manager
   */
  async initialize() {
    if (this.initialized) return

    try {
      await fs.mkdir(ORG_SECRETS_DIR, { recursive: true })
      await fs.mkdir(ORG_AUDIT_LOG_DIR, { recursive: true })

      await this.loadMasterKey()
      await organizationService.ensureInitialized()

      this.initialized = true
      console.log('[OrganizationSecretsManager] Initialized successfully')
    } catch (error) {
      console.error('[OrganizationSecretsManager] Initialization failed:', error)
      throw new Error(`Failed to initialize OrganizationSecretsManager: ${error.message}`)
    }
  }

  /**
   * Ensure service is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * Load master encryption key
   */
  async loadMasterKey() {
    try {
      const keyData = await fs.readFile(MASTER_KEY_PATH, 'utf-8')
      this.masterKey = Buffer.from(keyData, 'hex')

      if (this.masterKey.length !== KEY_LENGTH) {
        throw new Error('Invalid master key length')
      }
    } catch (error) {
      throw new Error(`Failed to load master key: ${error.message}`)
    }
  }

  /**
   * Derive encryption key from master key and secret ID
   */
  deriveKey(secretId, organizationId) {
    return crypto.pbkdf2Sync(
      this.masterKey,
      Buffer.from(`${organizationId}:${secretId}`),
      100000,
      KEY_LENGTH,
      'sha256'
    )
  }

  /**
   * Encrypt a secret value
   */
  encrypt(value, secretId, organizationId) {
    const key = this.deriveKey(secretId, organizationId)
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
  decrypt(encryptedData, secretId, organizationId) {
    const key = this.deriveKey(secretId, organizationId)
    const iv = Buffer.from(encryptedData.iv, 'hex')
    const authTag = Buffer.from(encryptedData.authTag, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)

    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf-8')
    decrypted += decipher.final('utf-8')

    return decrypted
  }

  /**
   * Create an organization secret
   */
  async createSecret(params) {
    await this.ensureInitialized()

    const {
      organizationId,
      name,
      value,
      type = SECRET_TYPES.OTHER,
      description = '',
      tags = [],
      rotationPolicy = ROTATION_POLICIES.MEDIUM,
      requiredRole = ROLES.MEMBER,
      userId,
      metadata = {}
    } = params

    // Validate inputs
    if (!organizationId) {
      throw new Error('Organization ID is required')
    }
    if (!name || !value) {
      throw new Error('Name and value are required')
    }
    if (!userId) {
      throw new Error('User ID is required')
    }

    // Check user has permission to create secrets
    await organizationService.requireRole(organizationId, userId, ROLES.MEMBER)

    // Check if organization exists
    await organizationService.getOrganization(organizationId)

    // Check for duplicate name in organization
    const existingSecrets = await this.listSecrets({ organizationId })
    if (existingSecrets.find(s => s.name === name)) {
      throw new Error(`Secret with name "${name}" already exists in organization`)
    }

    const secretId = uuidv4()
    const now = new Date().toISOString()

    // Encrypt the value
    const encryptedData = this.encrypt(value, secretId, organizationId)

    // Calculate next rotation date
    let nextRotation = null
    if (rotationPolicy) {
      const rotationDate = new Date()
      rotationDate.setDate(rotationDate.getDate() + rotationPolicy)
      nextRotation = rotationDate.toISOString()
    }

    const secret = {
      id: secretId,
      organizationId,
      name: name.trim(),
      type,
      encryptedValue: encryptedData.encrypted,
      iv: encryptedData.iv,
      authTag: encryptedData.authTag,
      description: description.trim(),
      tags: tags.map(t => t.trim()),
      rotationPolicy,
      nextRotation,
      requiredRole,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
      lastAccessedAt: null,
      lastAccessedBy: null,
      accessCount: 0,
      metadata
    }

    await this.saveSecret(secret)

    // Log audit event
    await this.logAudit({
      organizationId,
      secretId,
      secretName: name,
      userId,
      action: 'CREATE',
      success: true
    })

    console.log(`[OrganizationSecretsManager] Created secret: ${secretId} in org ${organizationId}`)

    // Return secret without decrypted value
    const { encryptedValue, iv, authTag, ...secretWithoutValue } = secret
    return secretWithoutValue
  }

  /**
   * Get a secret (optionally include decrypted value)
   */
  async getSecret(organizationId, secretId, userId, includeValue = false) {
    await this.ensureInitialized()

    const secret = await this.loadSecret(organizationId, secretId)

    if (!secret) {
      throw new Error(`Secret not found: ${secretId}`)
    }

    // Check user has permission to access this secret
    const hasAccess = await organizationService.hasRole(
      organizationId,
      userId,
      secret.requiredRole
    )

    if (!hasAccess) {
      await this.logAudit({
        organizationId,
        secretId,
        secretName: secret.name,
        userId,
        action: 'PERMISSION_DENIED',
        success: false,
        errorMessage: `User does not have required role: ${secret.requiredRole}`
      })
      throw new Error('Insufficient permissions to access this secret')
    }

    let result = { ...secret }

    if (includeValue) {
      // Decrypt the value
      const encryptedData = {
        encrypted: secret.encryptedValue,
        iv: secret.iv,
        authTag: secret.authTag
      }
      result.value = this.decrypt(encryptedData, secretId, organizationId)

      // Update access tracking
      secret.lastAccessedAt = new Date().toISOString()
      secret.lastAccessedBy = userId
      secret.accessCount = (secret.accessCount || 0) + 1
      await this.saveSecret(secret)

      // Log audit event
      await this.logAudit({
        organizationId,
        secretId,
        secretName: secret.name,
        userId,
        action: 'ACCESS',
        success: true
      })
    }

    // Remove encrypted data from response
    delete result.encryptedValue
    delete result.iv
    delete result.authTag

    return result
  }

  /**
   * List secrets in an organization
   */
  async listSecrets({ organizationId, userId, type, tag, search }) {
    await this.ensureInitialized()

    // Check user is member of organization
    await organizationService.requireRole(organizationId, userId, ROLES.VIEWER)

    const secrets = await this.loadOrganizationSecrets(organizationId)

    // Get user's role to filter secrets by required role
    const userRole = await organizationService.getUserRole(organizationId, userId)

    let filtered = secrets.filter(s => {
      // Filter by required role
      const hasAccess = organizationService.hasRole(organizationId, userId, s.requiredRole)
      if (!hasAccess) return false

      // Filter by type
      if (type && s.type !== type) return false

      // Filter by tag
      if (tag && (!s.tags || !s.tags.includes(tag))) return false

      // Filter by search
      if (search) {
        const searchLower = search.toLowerCase()
        const matchName = s.name.toLowerCase().includes(searchLower)
        const matchDesc = s.description && s.description.toLowerCase().includes(searchLower)
        if (!matchName && !matchDesc) return false
      }

      return true
    })

    // Remove encrypted data from results
    return filtered.map(s => {
      const { encryptedValue, iv, authTag, ...secretWithoutValue } = s
      return secretWithoutValue
    })
  }

  /**
   * Update a secret
   */
  async updateSecret(organizationId, secretId, updates, userId) {
    await this.ensureInitialized()

    const secret = await this.loadSecret(organizationId, secretId)

    if (!secret) {
      throw new Error(`Secret not found: ${secretId}`)
    }

    // Check permissions: user must be admin or the creator
    const userRole = await organizationService.getUserRole(organizationId, userId)
    const isAdminOrOwner = userRole === ROLES.ADMIN || userRole === ROLES.OWNER
    const isCreator = secret.createdBy === userId

    if (!isAdminOrOwner && !isCreator) {
      throw new Error('Insufficient permissions to update this secret')
    }

    // Update fields
    if (updates.name !== undefined) {
      secret.name = updates.name.trim()
    }
    if (updates.description !== undefined) {
      secret.description = updates.description.trim()
    }
    if (updates.tags !== undefined) {
      secret.tags = updates.tags.map(t => t.trim())
    }
    if (updates.rotationPolicy !== undefined) {
      secret.rotationPolicy = updates.rotationPolicy
      if (updates.rotationPolicy) {
        const rotationDate = new Date()
        rotationDate.setDate(rotationDate.getDate() + updates.rotationPolicy)
        secret.nextRotation = rotationDate.toISOString()
      } else {
        secret.nextRotation = null
      }
    }
    if (updates.requiredRole !== undefined && isAdminOrOwner) {
      secret.requiredRole = updates.requiredRole
    }
    if (updates.metadata !== undefined) {
      secret.metadata = { ...secret.metadata, ...updates.metadata }
    }

    // Update value if provided
    if (updates.value) {
      const encryptedData = this.encrypt(updates.value, secretId, organizationId)
      secret.encryptedValue = encryptedData.encrypted
      secret.iv = encryptedData.iv
      secret.authTag = encryptedData.authTag
    }

    secret.updatedAt = new Date().toISOString()
    secret.updatedBy = userId

    await this.saveSecret(secret)

    // Log audit event
    await this.logAudit({
      organizationId,
      secretId,
      secretName: secret.name,
      userId,
      action: 'UPDATE',
      success: true
    })

    console.log(`[OrganizationSecretsManager] Updated secret: ${secretId}`)

    const { encryptedValue, iv, authTag, ...secretWithoutValue } = secret
    return secretWithoutValue
  }

  /**
   * Rotate a secret (update its value)
   */
  async rotateSecret(organizationId, secretId, newValue, userId) {
    await this.ensureInitialized()

    const secret = await this.loadSecret(organizationId, secretId)

    if (!secret) {
      throw new Error(`Secret not found: ${secretId}`)
    }

    // Check permissions
    await organizationService.requireRole(organizationId, userId, secret.requiredRole)

    // Encrypt new value
    const encryptedData = this.encrypt(newValue, secretId, organizationId)
    secret.encryptedValue = encryptedData.encrypted
    secret.iv = encryptedData.iv
    secret.authTag = encryptedData.authTag

    // Update rotation date
    if (secret.rotationPolicy) {
      const rotationDate = new Date()
      rotationDate.setDate(rotationDate.getDate() + secret.rotationPolicy)
      secret.nextRotation = rotationDate.toISOString()
    }

    secret.updatedAt = new Date().toISOString()
    secret.updatedBy = userId

    await this.saveSecret(secret)

    // Log audit event
    await this.logAudit({
      organizationId,
      secretId,
      secretName: secret.name,
      userId,
      action: 'ROTATE',
      success: true
    })

    console.log(`[OrganizationSecretsManager] Rotated secret: ${secretId}`)

    const { encryptedValue, iv, authTag, ...secretWithoutValue } = secret
    return secretWithoutValue
  }

  /**
   * Delete a secret
   */
  async deleteSecret(organizationId, secretId, userId) {
    await this.ensureInitialized()

    const secret = await this.loadSecret(organizationId, secretId)

    if (!secret) {
      throw new Error(`Secret not found: ${secretId}`)
    }

    // Check permissions: admin/owner or creator
    const userRole = await organizationService.getUserRole(organizationId, userId)
    const isAdminOrOwner = userRole === ROLES.ADMIN || userRole === ROLES.OWNER
    const isCreator = secret.createdBy === userId

    if (!isAdminOrOwner && !isCreator) {
      throw new Error('Insufficient permissions to delete this secret')
    }

    // Delete file
    const filePath = path.join(ORG_SECRETS_DIR, organizationId, `${secretId}.json`)
    await fs.unlink(filePath)

    // Log audit event
    await this.logAudit({
      organizationId,
      secretId,
      secretName: secret.name,
      userId,
      action: 'DELETE',
      success: true
    })

    console.log(`[OrganizationSecretsManager] Deleted secret: ${secretId}`)

    return { deleted: true, secretId }
  }

  /**
   * Get statistics for organization secrets
   */
  async getStatistics(organizationId, userId) {
    await this.ensureInitialized()

    await organizationService.requireRole(organizationId, userId, ROLES.VIEWER)

    const secrets = await this.loadOrganizationSecrets(organizationId)

    const now = new Date()
    const needingRotation = secrets.filter(s => {
      if (!s.nextRotation) return false
      return new Date(s.nextRotation) <= now
    })

    const totalAccesses = secrets.reduce((sum, s) => sum + (s.accessCount || 0), 0)

    return {
      total: secrets.length,
      byType: this.groupByType(secrets),
      needingRotation: needingRotation.length,
      totalAccesses
    }
  }

  /**
   * Get audit logs for organization
   */
  async getAuditLogs(organizationId, userId, filters = {}) {
    await this.ensureInitialized()

    // Only admins/owners can view audit logs
    await organizationService.requireRole(organizationId, userId, ROLES.ADMIN)

    const logs = await this.loadAuditLogs(organizationId)

    let filtered = logs

    if (filters.secretId) {
      filtered = filtered.filter(log => log.secretId === filters.secretId)
    }
    if (filters.userId) {
      filtered = filtered.filter(log => log.userId === filters.userId)
    }
    if (filters.action) {
      filtered = filtered.filter(log => log.action === filters.action)
    }
    if (filters.startDate) {
      filtered = filtered.filter(log => log.timestamp >= filters.startDate)
    }
    if (filters.endDate) {
      filtered = filtered.filter(log => log.timestamp <= filters.endDate)
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    // Limit results
    if (filters.limit) {
      filtered = filtered.slice(0, parseInt(filters.limit))
    }

    return filtered
  }

  /**
   * Log audit event
   */
  async logAudit(params) {
    const {
      organizationId,
      secretId,
      secretName,
      userId,
      action,
      success,
      errorMessage = null,
      ipAddress = null,
      userAgent = null,
      metadata = {}
    } = params

    const auditEntry = {
      id: uuidv4(),
      organizationId,
      secretId,
      secretName,
      userId,
      action,
      success,
      errorMessage,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
      metadata
    }

    const orgAuditDir = path.join(ORG_AUDIT_LOG_DIR, organizationId)
    await fs.mkdir(orgAuditDir, { recursive: true })

    const auditFile = path.join(orgAuditDir, 'audit.log.json')

    let logs = []
    try {
      const data = await fs.readFile(auditFile, 'utf-8')
      logs = JSON.parse(data)
    } catch (error) {
      // File doesn't exist or is empty, start fresh
    }

    logs.push(auditEntry)

    // Keep only last 10000 entries
    if (logs.length > 10000) {
      logs = logs.slice(-10000)
    }

    await fs.writeFile(auditFile, JSON.stringify(logs, null, 2), 'utf-8')
  }

  /**
   * Save secret to file
   */
  async saveSecret(secret) {
    const orgDir = path.join(ORG_SECRETS_DIR, secret.organizationId)
    await fs.mkdir(orgDir, { recursive: true })

    const filePath = path.join(orgDir, `${secret.id}.json`)
    await fs.writeFile(filePath, JSON.stringify(secret, null, 2), 'utf-8')
  }

  /**
   * Load secret from file
   */
  async loadSecret(organizationId, secretId) {
    try {
      const filePath = path.join(ORG_SECRETS_DIR, organizationId, `${secretId}.json`)
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  /**
   * Load all secrets for an organization
   */
  async loadOrganizationSecrets(organizationId) {
    const orgDir = path.join(ORG_SECRETS_DIR, organizationId)

    try {
      await fs.mkdir(orgDir, { recursive: true })
      const files = await fs.readdir(orgDir)

      const secrets = []
      for (const file of files) {
        if (!file.endsWith('.json')) continue

        try {
          const filePath = path.join(orgDir, file)
          const data = await fs.readFile(filePath, 'utf-8')
          secrets.push(JSON.parse(data))
        } catch (error) {
          console.error(`[OrganizationSecretsManager] Error loading secret ${file}:`, error)
        }
      }

      return secrets
    } catch (error) {
      console.error('[OrganizationSecretsManager] Error loading organization secrets:', error)
      return []
    }
  }

  /**
   * Load audit logs for organization
   */
  async loadAuditLogs(organizationId) {
    try {
      const auditFile = path.join(ORG_AUDIT_LOG_DIR, organizationId, 'audit.log.json')
      const data = await fs.readFile(auditFile, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  /**
   * Group secrets by type
   */
  groupByType(secrets) {
    const byType = {}
    for (const secret of secrets) {
      byType[secret.type] = (byType[secret.type] || 0) + 1
    }
    return byType
  }
}

// Export singleton instance
const organizationSecretsManager = new OrganizationSecretsManager()
export default organizationSecretsManager

export { SECRET_TYPES, ROTATION_POLICIES, ROLES }
