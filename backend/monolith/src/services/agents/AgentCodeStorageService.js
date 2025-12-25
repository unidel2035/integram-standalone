/**
 * Agent Code Storage Service
 *
 * Manages code versioning for agent instances with git-like functionality.
 * Implements versioning, diffing, and history tracking for custom agent code.
 *
 * Issue #3195 - Agent Instances with Code Editing
 *
 * Features:
 * - Code versioning (git-like)
 * - Diff between versions
 * - Version history with metadata
 * - Rollback to previous versions
 * - Commit messages for changes
 *
 * Storage:
 * - agent_instance_versions table in Integram DB
 * - Each version includes: code, config, author, timestamp, commit message
 */

import { v4 as uuidv4 } from 'uuid'
import IntegramDatabaseService from '../integram/IntegramDatabaseService.js'

/**
 * Agent Code Storage Service
 */
class AgentCodeStorageService {
  constructor({ logger } = {}) {
    this.logger = logger || console
    this.initialized = false
    this.integramService = new IntegramDatabaseService({ logger })
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.initialized) return

    try {
      await this.integramService.initialize()
      this.initialized = true
      this.logger.info('[AgentCodeStorageService] Initialized successfully')
    } catch (error) {
      this.logger.error('[AgentCodeStorageService] Initialization failed:', error)
      throw new Error(`Failed to initialize AgentCodeStorageService: ${error.message}`)
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
   * Create a new code version
   */
  async createVersion({
    organizationId,
    instanceId,
    code,
    config = {},
    authorId,
    commitMessage = 'Code updated'
  }) {
    await this.ensureInitialized()

    // Get current version number
    const currentVersion = await this.getLatestVersionNumber(organizationId, instanceId)
    const newVersionNumber = currentVersion + 1

    const versionId = uuidv4()
    const now = new Date().toISOString()

    const versionData = {
      id: versionId,
      instance_id: instanceId,
      version: newVersionNumber,
      code: code,
      config: config,
      author_id: authorId,
      commit_message: commitMessage,
      created_at: now
    }

    // Save version to agent_instance_versions table
    await this.integramService.insert(organizationId, 'agent_instance_versions', versionData)

    this.logger.info(`[AgentCodeStorageService] Created version ${newVersionNumber} for instance ${instanceId}`)

    return {
      ...versionData,
      versionNumber: newVersionNumber
    }
  }

  /**
   * Get latest version number for an instance
   */
  async getLatestVersionNumber(organizationId, instanceId) {
    await this.ensureInitialized()

    const versions = await this.integramService.find(
      organizationId,
      'agent_instance_versions',
      { instance_id: instanceId }
    )

    if (versions.length === 0) {
      return 0
    }

    const maxVersion = Math.max(...versions.map(v => v.version))
    return maxVersion
  }

  /**
   * Get a specific version by version number
   */
  async getVersion(organizationId, instanceId, versionNumber) {
    await this.ensureInitialized()

    const versions = await this.integramService.find(
      organizationId,
      'agent_instance_versions',
      {
        instance_id: instanceId,
        version: versionNumber
      }
    )

    if (versions.length === 0) {
      throw new Error(`Version ${versionNumber} not found for instance ${instanceId}`)
    }

    return versions[0]
  }

  /**
   * Get latest version
   */
  async getLatestVersion(organizationId, instanceId) {
    await this.ensureInitialized()

    const latestVersionNumber = await this.getLatestVersionNumber(organizationId, instanceId)

    if (latestVersionNumber === 0) {
      return null
    }

    return await this.getVersion(organizationId, instanceId, latestVersionNumber)
  }

  /**
   * Get all versions for an instance
   */
  async getVersionHistory(organizationId, instanceId, options = {}) {
    await this.ensureInitialized()

    const { limit = 50, offset = 0 } = options

    const allVersions = await this.integramService.find(
      organizationId,
      'agent_instance_versions',
      { instance_id: instanceId }
    )

    // Sort by version descending (latest first)
    const sortedVersions = allVersions.sort((a, b) => b.version - a.version)

    // Apply pagination
    const paginatedVersions = sortedVersions.slice(offset, offset + limit)

    return {
      versions: paginatedVersions,
      total: allVersions.length,
      offset,
      limit
    }
  }

  /**
   * Calculate diff between two versions
   * Returns a simple line-by-line diff
   */
  async getDiff(organizationId, instanceId, fromVersion, toVersion) {
    await this.ensureInitialized()

    const fromVersionData = await this.getVersion(organizationId, instanceId, fromVersion)
    const toVersionData = await this.getVersion(organizationId, instanceId, toVersion)

    const diff = this.calculateDiff(fromVersionData.code, toVersionData.code)

    return {
      fromVersion: fromVersion,
      toVersion: toVersion,
      fromCommitMessage: fromVersionData.commit_message,
      toCommitMessage: toVersionData.commit_message,
      diff: diff
    }
  }

  /**
   * Simple diff calculation (line-by-line)
   * Returns added, removed, and unchanged lines
   */
  calculateDiff(oldCode, newCode) {
    const oldLines = oldCode.split('\n')
    const newLines = newCode.split('\n')

    const diff = []

    // Simple implementation: compare line by line
    const maxLength = Math.max(oldLines.length, newLines.length)

    for (let i = 0; i < maxLength; i++) {
      const oldLine = oldLines[i]
      const newLine = newLines[i]

      if (oldLine === undefined) {
        // Line added
        diff.push({ type: 'added', lineNumber: i + 1, content: newLine })
      } else if (newLine === undefined) {
        // Line removed
        diff.push({ type: 'removed', lineNumber: i + 1, content: oldLine })
      } else if (oldLine !== newLine) {
        // Line modified
        diff.push({ type: 'removed', lineNumber: i + 1, content: oldLine })
        diff.push({ type: 'added', lineNumber: i + 1, content: newLine })
      } else {
        // Line unchanged
        diff.push({ type: 'unchanged', lineNumber: i + 1, content: oldLine })
      }
    }

    return diff
  }

  /**
   * Delete a specific version
   * Warning: This is destructive and should be used carefully
   */
  async deleteVersion(organizationId, instanceId, versionNumber) {
    await this.ensureInitialized()

    const version = await this.getVersion(organizationId, instanceId, versionNumber)

    await this.integramService.delete(organizationId, 'agent_instance_versions', version.id)

    this.logger.info(`[AgentCodeStorageService] Deleted version ${versionNumber} for instance ${instanceId}`)

    return {
      deleted: true,
      versionNumber
    }
  }

  /**
   * Delete all versions for an instance
   * Used when deleting an instance
   */
  async deleteAllVersions(organizationId, instanceId) {
    await this.ensureInitialized()

    const versions = await this.integramService.find(
      organizationId,
      'agent_instance_versions',
      { instance_id: instanceId }
    )

    for (const version of versions) {
      await this.integramService.delete(organizationId, 'agent_instance_versions', version.id)
    }

    this.logger.info(`[AgentCodeStorageService] Deleted all versions for instance ${instanceId}`)

    return {
      deleted: versions.length
    }
  }

  /**
   * Get version statistics
   */
  async getVersionStats(organizationId, instanceId) {
    await this.ensureInitialized()

    const versions = await this.integramService.find(
      organizationId,
      'agent_instance_versions',
      { instance_id: instanceId }
    )

    const latestVersion = versions.length > 0
      ? versions.reduce((max, v) => v.version > max.version ? v : max)
      : null

    return {
      totalVersions: versions.length,
      latestVersion: latestVersion ? latestVersion.version : 0,
      latestCommitMessage: latestVersion ? latestVersion.commit_message : null,
      latestCommitDate: latestVersion ? latestVersion.created_at : null,
      latestCommitAuthor: latestVersion ? latestVersion.author_id : null
    }
  }
}

export default AgentCodeStorageService
