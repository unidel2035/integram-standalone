/**
 * KAG Version Manager
 *
 * Provides version control for knowledge graphs:
 * - Snapshot creation on each index
 * - Diff computation between versions
 * - Rollback functionality
 * - Snapshot pruning
 *
 * Issue #5081
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../../utils/logger.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Version Manager for KAG snapshots
 */
class VersionManager {
  constructor(options = {}) {
    const {
      dataDir = path.join(__dirname, '../../../data/kag'),
      maxSnapshots = 10  // Keep last N snapshots
    } = options;

    this.dataDir = dataDir;
    this.versionsDir = path.join(dataDir, 'versions');
    this.metadataFile = path.join(this.versionsDir, 'versions.json');
    this.maxSnapshots = maxSnapshots;

    // In-memory metadata cache
    this.metadata = {
      snapshots: [],
      currentVersion: null
    };
  }

  /**
   * Initialize version manager
   */
  async initialize() {
    // Create versions directory
    await fs.mkdir(this.versionsDir, { recursive: true });

    // Load metadata
    await this.loadMetadata();

    logger.info('[VersionManager] Initialized', {
      versionsDir: this.versionsDir,
      snapshotsCount: this.metadata.snapshots.length,
      maxSnapshots: this.maxSnapshots
    });
  }

  /**
   * Create a new snapshot
   * @param {Object} knowledgeGraph - KG data (entities, relations)
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Snapshot info
   */
  async createSnapshot(knowledgeGraph, metadata = {}) {
    const timestamp = new Date().toISOString();
    const snapshotId = `snapshot-${Date.now()}`;
    const filename = `${snapshotId}.json`;
    const filepath = path.join(this.versionsDir, filename);

    const snapshot = {
      id: snapshotId,
      timestamp,
      filename,
      metadata: {
        ...metadata,
        entitiesCount: knowledgeGraph.entities?.length || 0,
        relationsCount: knowledgeGraph.relations?.length || 0
      },
      data: knowledgeGraph
    };

    // Save snapshot file
    await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2));

    // Update metadata
    this.metadata.snapshots.push({
      id: snapshotId,
      timestamp,
      filename,
      metadata: snapshot.metadata
    });
    this.metadata.currentVersion = snapshotId;

    await this.saveMetadata();

    // Prune old snapshots if needed
    await this.pruneSnapshots();

    logger.info('[VersionManager] Snapshot created', {
      id: snapshotId,
      timestamp,
      entities: snapshot.metadata.entitiesCount,
      relations: snapshot.metadata.relationsCount
    });

    return {
      id: snapshotId,
      timestamp,
      metadata: snapshot.metadata
    };
  }

  /**
   * Get snapshot by ID
   * @param {string} snapshotId - Snapshot ID
   * @returns {Promise<Object|null>} Snapshot data
   */
  async getSnapshot(snapshotId) {
    const snapshotMeta = this.metadata.snapshots.find(s => s.id === snapshotId);
    if (!snapshotMeta) {
      logger.warn('[VersionManager] Snapshot not found', { snapshotId });
      return null;
    }

    const filepath = path.join(this.versionsDir, snapshotMeta.filename);

    try {
      const data = await fs.readFile(filepath, 'utf-8');
      const snapshot = JSON.parse(data);
      return snapshot;
    } catch (error) {
      logger.error('[VersionManager] Failed to load snapshot', {
        snapshotId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * List all snapshots
   * @returns {Array<Object>} Snapshot metadata list
   */
  listSnapshots() {
    return this.metadata.snapshots.map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      metadata: s.metadata
    }));
  }

  /**
   * Get current version
   * @returns {string|null} Current snapshot ID
   */
  getCurrentVersion() {
    return this.metadata.currentVersion;
  }

  /**
   * Compute diff between two snapshots
   * @param {string} fromId - Source snapshot ID
   * @param {string} toId - Target snapshot ID
   * @returns {Promise<Object>} Diff result
   */
  async computeDiff(fromId, toId) {
    const fromSnapshot = await this.getSnapshot(fromId);
    const toSnapshot = await this.getSnapshot(toId);

    if (!fromSnapshot || !toSnapshot) {
      throw new Error(`Snapshot not found: ${!fromSnapshot ? fromId : toId}`);
    }

    const fromEntities = new Map(
      (fromSnapshot.data.entities || []).map(e => [e.id, e])
    );
    const toEntities = new Map(
      (toSnapshot.data.entities || []).map(e => [e.id, e])
    );

    const fromRelations = new Map(
      (fromSnapshot.data.relations || []).map(r => [r.id, r])
    );
    const toRelations = new Map(
      (toSnapshot.data.relations || []).map(r => [r.id, r])
    );

    // Compute entity changes
    const addedEntities = [];
    const removedEntities = [];
    const modifiedEntities = [];

    // Find added and modified entities
    for (const [id, entity] of toEntities) {
      if (!fromEntities.has(id)) {
        addedEntities.push(entity);
      } else {
        const oldEntity = fromEntities.get(id);
        if (JSON.stringify(oldEntity) !== JSON.stringify(entity)) {
          modifiedEntities.push({
            id,
            old: oldEntity,
            new: entity,
            changes: this._computeEntityChanges(oldEntity, entity)
          });
        }
      }
    }

    // Find removed entities
    for (const [id, entity] of fromEntities) {
      if (!toEntities.has(id)) {
        removedEntities.push(entity);
      }
    }

    // Compute relation changes
    const addedRelations = [];
    const removedRelations = [];

    for (const [id, relation] of toRelations) {
      if (!fromRelations.has(id)) {
        addedRelations.push(relation);
      }
    }

    for (const [id, relation] of fromRelations) {
      if (!toRelations.has(id)) {
        removedRelations.push(relation);
      }
    }

    const diff = {
      from: {
        id: fromId,
        timestamp: fromSnapshot.timestamp
      },
      to: {
        id: toId,
        timestamp: toSnapshot.timestamp
      },
      entities: {
        added: addedEntities,
        removed: removedEntities,
        modified: modifiedEntities,
        unchanged: toEntities.size - addedEntities.length - modifiedEntities.length
      },
      relations: {
        added: addedRelations,
        removed: removedRelations,
        unchanged: toRelations.size - addedRelations.length
      },
      summary: {
        entitiesAdded: addedEntities.length,
        entitiesRemoved: removedEntities.length,
        entitiesModified: modifiedEntities.length,
        relationsAdded: addedRelations.length,
        relationsRemoved: removedRelations.length
      }
    };

    logger.info('[VersionManager] Diff computed', {
      from: fromId,
      to: toId,
      summary: diff.summary
    });

    return diff;
  }

  /**
   * Rollback to a specific snapshot
   * @param {string} snapshotId - Target snapshot ID
   * @returns {Promise<Object>} Restored knowledge graph
   */
  async rollback(snapshotId) {
    const snapshot = await this.getSnapshot(snapshotId);

    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    // Update current version
    this.metadata.currentVersion = snapshotId;
    await this.saveMetadata();

    logger.info('[VersionManager] Rolled back to snapshot', {
      snapshotId,
      timestamp: snapshot.timestamp
    });

    return snapshot.data;
  }

  /**
   * Selective rollback (e.g., only PRs, only issues)
   * @param {string} snapshotId - Target snapshot ID
   * @param {Object} options - Rollback options
   * @returns {Promise<Object>} Partially restored KG
   */
  async selectiveRollback(snapshotId, options = {}) {
    const {
      entityTypes = [],  // e.g., ['PR', 'Issue']
      keepOther = true   // Keep other entity types from current state
    } = options;

    const targetSnapshot = await this.getSnapshot(snapshotId);
    const currentSnapshotId = this.getCurrentVersion();
    const currentSnapshot = currentSnapshotId ? await this.getSnapshot(currentSnapshotId) : null;

    if (!targetSnapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    // Filter entities by type
    const targetEntities = (targetSnapshot.data.entities || [])
      .filter(e => entityTypes.includes(e.type));

    const targetRelations = (targetSnapshot.data.relations || [])
      .filter(r => {
        const fromEntity = targetSnapshot.data.entities.find(e => e.id === r.from);
        const toEntity = targetSnapshot.data.entities.find(e => e.id === r.to);
        return entityTypes.includes(fromEntity?.type) || entityTypes.includes(toEntity?.type);
      });

    let restoredData;

    if (keepOther && currentSnapshot) {
      // Keep other entity types from current state
      const otherEntities = (currentSnapshot.data.entities || [])
        .filter(e => !entityTypes.includes(e.type));

      const otherRelations = (currentSnapshot.data.relations || [])
        .filter(r => {
          const fromEntity = currentSnapshot.data.entities.find(e => e.id === r.from);
          const toEntity = currentSnapshot.data.entities.find(e => e.id === r.to);
          return !entityTypes.includes(fromEntity?.type) && !entityTypes.includes(toEntity?.type);
        });

      restoredData = {
        entities: [...targetEntities, ...otherEntities],
        relations: [...targetRelations, ...otherRelations]
      };
    } else {
      // Only restore selected entity types
      restoredData = {
        entities: targetEntities,
        relations: targetRelations
      };
    }

    logger.info('[VersionManager] Selective rollback completed', {
      snapshotId,
      entityTypes,
      restoredEntities: targetEntities.length,
      restoredRelations: targetRelations.length
    });

    return restoredData;
  }

  /**
   * Prune old snapshots (keep last N)
   */
  async pruneSnapshots() {
    if (this.metadata.snapshots.length <= this.maxSnapshots) {
      return;
    }

    // Sort by timestamp (oldest first)
    const sorted = [...this.metadata.snapshots].sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    const toRemove = sorted.slice(0, sorted.length - this.maxSnapshots);

    for (const snapshot of toRemove) {
      const filepath = path.join(this.versionsDir, snapshot.filename);

      try {
        await fs.unlink(filepath);
        logger.info('[VersionManager] Pruned old snapshot', { id: snapshot.id });
      } catch (error) {
        logger.error('[VersionManager] Failed to prune snapshot', {
          id: snapshot.id,
          error: error.message
        });
      }
    }

    // Update metadata
    this.metadata.snapshots = sorted.slice(-this.maxSnapshots);
    await this.saveMetadata();

    logger.info('[VersionManager] Pruning completed', {
      removed: toRemove.length,
      remaining: this.metadata.snapshots.length
    });
  }

  /**
   * Delete a specific snapshot
   * @param {string} snapshotId - Snapshot ID to delete
   */
  async deleteSnapshot(snapshotId) {
    const snapshotMeta = this.metadata.snapshots.find(s => s.id === snapshotId);

    if (!snapshotMeta) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const filepath = path.join(this.versionsDir, snapshotMeta.filename);
    await fs.unlink(filepath);

    // Update metadata
    this.metadata.snapshots = this.metadata.snapshots.filter(s => s.id !== snapshotId);

    if (this.metadata.currentVersion === snapshotId) {
      // Set current to latest remaining snapshot
      const latest = this.metadata.snapshots.sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
      )[0];
      this.metadata.currentVersion = latest?.id || null;
    }

    await this.saveMetadata();

    logger.info('[VersionManager] Snapshot deleted', { snapshotId });
  }

  /**
   * Load metadata from disk
   */
  async loadMetadata() {
    try {
      const data = await fs.readFile(this.metadataFile, 'utf-8');
      this.metadata = JSON.parse(data);
      logger.info('[VersionManager] Metadata loaded', {
        snapshots: this.metadata.snapshots.length
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('[VersionManager] No metadata file found, starting fresh');
        this.metadata = {
          snapshots: [],
          currentVersion: null
        };
      } else {
        logger.error('[VersionManager] Failed to load metadata', {
          error: error.message
        });
        throw error;
      }
    }
  }

  /**
   * Save metadata to disk
   */
  async saveMetadata() {
    await fs.writeFile(
      this.metadataFile,
      JSON.stringify(this.metadata, null, 2)
    );
  }

  /**
   * Compute changes between two entities
   * @private
   */
  _computeEntityChanges(oldEntity, newEntity) {
    const changes = {};

    // Compare properties
    const allKeys = new Set([
      ...Object.keys(oldEntity),
      ...Object.keys(newEntity)
    ]);

    for (const key of allKeys) {
      if (JSON.stringify(oldEntity[key]) !== JSON.stringify(newEntity[key])) {
        changes[key] = {
          old: oldEntity[key],
          new: newEntity[key]
        };
      }
    }

    return changes;
  }
}

// Singleton instance
let versionManagerInstance = null;

/**
 * Get VersionManager singleton
 * @param {Object} options - Configuration options
 * @returns {VersionManager}
 */
export function getVersionManager(options = {}) {
  if (!versionManagerInstance) {
    versionManagerInstance = new VersionManager(options);
  }
  return versionManagerInstance;
}

export { VersionManager };
