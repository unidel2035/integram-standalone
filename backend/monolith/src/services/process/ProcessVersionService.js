/**
 * ProcessVersionService - Process Definition Version Management
 *
 * Manages process definition versions including:
 * - Version creation and activation
 * - Version comparison (diff)
 * - Migration between versions
 * - Rollback to previous versions
 *
 * @see Issue #2463 - Phase 6: Advanced Features
 */

import EventEmitter from 'events'
import logger from '../../utils/logger.js'

/**
 * Version status
 */
export const VersionStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
  ARCHIVED: 'archived'
}

/**
 * ProcessVersionService Class
 */
export class ProcessVersionService extends EventEmitter {
  constructor(options = {}) {
    super()

    this.storage = options.storage

    logger.info('ProcessVersionService initialized')
  }

  /**
   * Create new version of a process definition
   *
   * @param {string} processId - Process ID
   * @param {Object} definition - Process definition
   * @param {Array} changelog - List of changes
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} New version
   */
  async createNewVersion(processId, definition, changelog = [], metadata = {}) {
    try {
      // Get current latest version
      const versions = await this.getVersions(processId)
      const currentVersion = versions.length > 0
        ? versions[versions.length - 1]
        : null

      // Calculate new version number
      const newVersionNumber = this.incrementVersion(
        currentVersion?.version || '0.0.0',
        metadata.incrementType || 'minor'
      )

      // Create version object
      const version = {
        processId,
        version: newVersionNumber,
        definition,
        status: VersionStatus.DRAFT,
        createdAt: new Date().toISOString(),
        createdBy: metadata.createdBy || 'system',
        changelog,
        metadata: {
          ...metadata,
          previousVersion: currentVersion?.version || null
        }
      }

      // Store version
      const versionId = await this.storeVersion(version)

      logger.info('New process version created', {
        processId,
        version: newVersionNumber,
        versionId
      })

      this.emit('version:created', {
        processId,
        version: newVersionNumber,
        versionId
      })

      return {
        versionId,
        ...version
      }
    } catch (error) {
      logger.error('Failed to create new version:', error, { processId })
      throw error
    }
  }

  /**
   * Activate a version (making it the current active version)
   *
   * @param {string} processId - Process ID
   * @param {string} version - Version to activate
   * @returns {Promise<void>}
   */
  async activateVersion(processId, version) {
    try {
      const versions = await this.getVersions(processId)

      // Deactivate all other versions
      for (const v of versions) {
        if (v.status === VersionStatus.ACTIVE) {
          await this.updateVersionStatus(processId, v.version, VersionStatus.DEPRECATED)
        }
      }

      // Activate target version
      await this.updateVersionStatus(processId, version, VersionStatus.ACTIVE)

      logger.info('Version activated', { processId, version })

      this.emit('version:activated', { processId, version })
    } catch (error) {
      logger.error('Failed to activate version:', error, { processId, version })
      throw error
    }
  }

  /**
   * Compare two versions (diff)
   *
   * @param {string} processId - Process ID
   * @param {string} version1 - First version
   * @param {string} version2 - Second version
   * @returns {Promise<Object>} Diff result
   */
  async compareVersions(processId, version1, version2) {
    try {
      const v1Data = await this.getVersion(processId, version1)
      const v2Data = await this.getVersion(processId, version2)

      if (!v1Data || !v2Data) {
        throw new Error('One or both versions not found')
      }

      const diff = {
        processId,
        version1,
        version2,
        addedNodes: this.findAddedNodes(v1Data.definition, v2Data.definition),
        removedNodes: this.findRemovedNodes(v1Data.definition, v2Data.definition),
        modifiedNodes: this.findModifiedNodes(v1Data.definition, v2Data.definition),
        addedEdges: this.findAddedEdges(v1Data.definition, v2Data.definition),
        removedEdges: this.findRemovedEdges(v1Data.definition, v2Data.definition),
        modifiedEdges: this.findModifiedEdges(v1Data.definition, v2Data.definition)
      }

      logger.debug('Version comparison completed', {
        processId,
        version1,
        version2,
        changes: {
          nodes: diff.addedNodes.length + diff.removedNodes.length + diff.modifiedNodes.length,
          edges: diff.addedEdges.length + diff.removedEdges.length + diff.modifiedEdges.length
        }
      })

      return diff
    } catch (error) {
      logger.error('Failed to compare versions:', error, { processId, version1, version2 })
      throw error
    }
  }

  /**
   * Migrate active instances to new version
   *
   * @param {string} processId - Process ID
   * @param {string} fromVersion - Source version
   * @param {string} toVersion - Target version
   * @param {Object} options - Migration options
   * @returns {Promise<Object>} Migration result
   */
  async migrateInstances(processId, fromVersion, toVersion, options = {}) {
    try {
      logger.info('Starting instance migration', {
        processId,
        fromVersion,
        toVersion
      })

      // Get all active instances of old version
      const instances = await this.getActiveInstances(processId, fromVersion)

      const results = {
        total: instances.length,
        migrated: 0,
        failed: 0,
        errors: []
      }

      for (const instance of instances) {
        try {
          await this.migrateInstance(instance.id, toVersion, options)
          results.migrated++
        } catch (error) {
          logger.error('Instance migration failed:', error, {
            instanceId: instance.id
          })
          results.failed++
          results.errors.push({
            instanceId: instance.id,
            error: error.message
          })
        }
      }

      logger.info('Instance migration completed', results)

      this.emit('migration:completed', {
        processId,
        fromVersion,
        toVersion,
        results
      })

      return results
    } catch (error) {
      logger.error('Migration failed:', error, { processId })
      throw error
    }
  }

  /**
   * Migrate single instance to new version
   */
  async migrateInstance(instanceId, toVersion, options) {
    // This is a simplified migration
    // Real implementation would need to:
    // 1. Map current execution state to new definition
    // 2. Update current nodes to new node IDs
    // 3. Handle structural changes (added/removed nodes)
    // 4. Preserve variable state

    logger.info('Migrating instance', { instanceId, toVersion })

    // TODO: Implement actual migration logic
    // For now, just update metadata
  }

  /**
   * Rollback to previous version
   *
   * @param {string} processId - Process ID
   * @param {string} targetVersion - Version to rollback to
   * @returns {Promise<void>}
   */
  async rollbackToVersion(processId, targetVersion) {
    try {
      logger.info('Rolling back to version', { processId, targetVersion })

      // Verify target version exists
      const version = await this.getVersion(processId, targetVersion)
      if (!version) {
        throw new Error(`Version not found: ${targetVersion}`)
      }

      // Activate target version
      await this.activateVersion(processId, targetVersion)

      this.emit('version:rolledback', {
        processId,
        targetVersion
      })
    } catch (error) {
      logger.error('Rollback failed:', error, { processId, targetVersion })
      throw error
    }
  }

  /**
   * Get all versions for a process
   *
   * @param {string} processId - Process ID
   * @returns {Promise<Array>} List of versions
   */
  async getVersions(processId) {
    // TODO: Implement storage retrieval
    // For now, return empty array
    return []
  }

  /**
   * Get specific version
   *
   * @param {string} processId - Process ID
   * @param {string} version - Version number
   * @returns {Promise<Object>} Version data
   */
  async getVersion(processId, version) {
    const versions = await this.getVersions(processId)
    return versions.find(v => v.version === version)
  }

  /**
   * Get active version
   *
   * @param {string} processId - Process ID
   * @returns {Promise<Object>} Active version
   */
  async getActiveVersion(processId) {
    const versions = await this.getVersions(processId)
    return versions.find(v => v.status === VersionStatus.ACTIVE)
  }

  /**
   * Store version
   */
  async storeVersion(version) {
    // TODO: Implement actual storage
    // For now, just return a mock ID
    return `version-${Date.now()}`
  }

  /**
   * Update version status
   */
  async updateVersionStatus(processId, version, status) {
    // TODO: Implement actual update
    logger.debug('Updating version status', { processId, version, status })
  }

  /**
   * Get active instances for a version
   */
  async getActiveInstances(processId, version) {
    // TODO: Query active instances from ProcessOrchestrator
    return []
  }

  /**
   * Increment version number
   *
   * @param {string} currentVersion - Current version (e.g., "1.2.3")
   * @param {string} type - Increment type: major, minor, patch
   * @returns {string} New version
   */
  incrementVersion(currentVersion, type = 'minor') {
    const [major, minor, patch] = currentVersion.split('.').map(Number)

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`
      case 'minor':
        return `${major}.${minor + 1}.0`
      case 'patch':
        return `${major}.${minor}.${patch + 1}`
      default:
        return `${major}.${minor + 1}.0`
    }
  }

  /**
   * Find added nodes between versions
   */
  findAddedNodes(oldDef, newDef) {
    const oldIds = new Set((oldDef.nodes || []).map(n => n.id))
    return (newDef.nodes || []).filter(n => !oldIds.has(n.id))
  }

  /**
   * Find removed nodes between versions
   */
  findRemovedNodes(oldDef, newDef) {
    const newIds = new Set((newDef.nodes || []).map(n => n.id))
    return (oldDef.nodes || []).filter(n => !newIds.has(n.id))
  }

  /**
   * Find modified nodes between versions
   */
  findModifiedNodes(oldDef, newDef) {
    const oldNodesMap = new Map((oldDef.nodes || []).map(n => [n.id, n]))
    const modifiedNodes = []

    for (const newNode of newDef.nodes || []) {
      const oldNode = oldNodesMap.get(newNode.id)
      if (oldNode && JSON.stringify(oldNode) !== JSON.stringify(newNode)) {
        modifiedNodes.push({
          nodeId: newNode.id,
          old: oldNode,
          new: newNode
        })
      }
    }

    return modifiedNodes
  }

  /**
   * Find added edges between versions
   */
  findAddedEdges(oldDef, newDef) {
    const oldIds = new Set((oldDef.edges || []).map(e => e.id))
    return (newDef.edges || []).filter(e => !oldIds.has(e.id))
  }

  /**
   * Find removed edges between versions
   */
  findRemovedEdges(oldDef, newDef) {
    const newIds = new Set((newDef.edges || []).map(e => e.id))
    return (oldDef.edges || []).filter(e => !newIds.has(e.id))
  }

  /**
   * Find modified edges between versions
   */
  findModifiedEdges(oldDef, newDef) {
    const oldEdgesMap = new Map((oldDef.edges || []).map(e => [e.id, e]))
    const modifiedEdges = []

    for (const newEdge of newDef.edges || []) {
      const oldEdge = oldEdgesMap.get(newEdge.id)
      if (oldEdge && JSON.stringify(oldEdge) !== JSON.stringify(newEdge)) {
        modifiedEdges.push({
          edgeId: newEdge.id,
          old: oldEdge,
          new: newEdge
        })
      }
    }

    return modifiedEdges
  }
}

export default ProcessVersionService
