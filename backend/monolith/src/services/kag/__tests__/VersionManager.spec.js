/**
 * VersionManager Tests
 *
 * Tests for KAG version control functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VersionManager } from '../VersionManager.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('VersionManager', () => {
  let versionManager;
  let testDataDir;

  beforeEach(async () => {
    // Create test data directory
    testDataDir = path.join(__dirname, '../../../../data/kag-test-versions');
    versionManager = new VersionManager({
      dataDir: testDataDir,
      maxSnapshots: 5
    });
    await versionManager.initialize();
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Snapshot Creation', () => {
    it('should create a snapshot', async () => {
      const testKG = {
        entities: [
          { id: 'e1', type: 'Issue', name: 'Test Issue' },
          { id: 'e2', type: 'PR', name: 'Test PR' }
        ],
        relations: [
          { id: 'r1', from: 'e1', to: 'e2', type: 'references' }
        ]
      };

      const snapshot = await versionManager.createSnapshot(testKG, {
        source: 'test'
      });

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBeDefined();
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.metadata.entitiesCount).toBe(2);
      expect(snapshot.metadata.relationsCount).toBe(1);
    });

    it('should list snapshots', async () => {
      const testKG = {
        entities: [{ id: 'e1', type: 'Test' }],
        relations: []
      };

      await versionManager.createSnapshot(testKG);
      await versionManager.createSnapshot(testKG);

      const snapshots = versionManager.listSnapshots();
      expect(snapshots.length).toBe(2);
    });

    it('should get snapshot by ID', async () => {
      const testKG = {
        entities: [{ id: 'e1', type: 'Test', name: 'Entity 1' }],
        relations: []
      };

      const created = await versionManager.createSnapshot(testKG);
      const retrieved = await versionManager.getSnapshot(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.data.entities[0].name).toBe('Entity 1');
    });
  });

  describe('Snapshot Pruning', () => {
    it('should prune old snapshots when exceeding maxSnapshots', async () => {
      const testKG = {
        entities: [{ id: 'e1', type: 'Test' }],
        relations: []
      };

      // Create 7 snapshots (max is 5)
      for (let i = 0; i < 7; i++) {
        await versionManager.createSnapshot(testKG);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const snapshots = versionManager.listSnapshots();
      expect(snapshots.length).toBe(5);
    });

    it('should keep most recent snapshots', async () => {
      const testKG = {
        entities: [{ id: 'e1', type: 'Test' }],
        relations: []
      };

      const snapshotIds = [];
      for (let i = 0; i < 7; i++) {
        const snapshot = await versionManager.createSnapshot(testKG);
        snapshotIds.push(snapshot.id);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const remaining = versionManager.listSnapshots();
      const remainingIds = remaining.map(s => s.id);

      // Should keep last 5 snapshots
      expect(remainingIds).toContain(snapshotIds[6]); // Latest
      expect(remainingIds).toContain(snapshotIds[5]);
      expect(remainingIds).toContain(snapshotIds[4]);
      expect(remainingIds).not.toContain(snapshotIds[0]); // Oldest
      expect(remainingIds).not.toContain(snapshotIds[1]);
    });
  });

  describe('Diff Computation', () => {
    it('should compute diff for added entities', async () => {
      const kg1 = {
        entities: [{ id: 'e1', type: 'Issue', name: 'Issue 1' }],
        relations: []
      };

      const kg2 = {
        entities: [
          { id: 'e1', type: 'Issue', name: 'Issue 1' },
          { id: 'e2', type: 'PR', name: 'PR 1' }
        ],
        relations: []
      };

      const snapshot1 = await versionManager.createSnapshot(kg1);
      await new Promise(resolve => setTimeout(resolve, 10));
      const snapshot2 = await versionManager.createSnapshot(kg2);

      const diff = await versionManager.computeDiff(snapshot1.id, snapshot2.id);

      expect(diff.summary.entitiesAdded).toBe(1);
      expect(diff.summary.entitiesRemoved).toBe(0);
      expect(diff.entities.added.length).toBe(1);
      expect(diff.entities.added[0].id).toBe('e2');
    });

    it('should compute diff for removed entities', async () => {
      const kg1 = {
        entities: [
          { id: 'e1', type: 'Issue', name: 'Issue 1' },
          { id: 'e2', type: 'PR', name: 'PR 1' }
        ],
        relations: []
      };

      const kg2 = {
        entities: [{ id: 'e1', type: 'Issue', name: 'Issue 1' }],
        relations: []
      };

      const snapshot1 = await versionManager.createSnapshot(kg1);
      await new Promise(resolve => setTimeout(resolve, 10));
      const snapshot2 = await versionManager.createSnapshot(kg2);

      const diff = await versionManager.computeDiff(snapshot1.id, snapshot2.id);

      expect(diff.summary.entitiesRemoved).toBe(1);
      expect(diff.entities.removed.length).toBe(1);
      expect(diff.entities.removed[0].id).toBe('e2');
    });

    it('should compute diff for modified entities', async () => {
      const kg1 = {
        entities: [{ id: 'e1', type: 'Issue', name: 'Issue 1', status: 'open' }],
        relations: []
      };

      const kg2 = {
        entities: [{ id: 'e1', type: 'Issue', name: 'Issue 1', status: 'closed' }],
        relations: []
      };

      const snapshot1 = await versionManager.createSnapshot(kg1);
      await new Promise(resolve => setTimeout(resolve, 10));
      const snapshot2 = await versionManager.createSnapshot(kg2);

      const diff = await versionManager.computeDiff(snapshot1.id, snapshot2.id);

      expect(diff.summary.entitiesModified).toBe(1);
      expect(diff.entities.modified.length).toBe(1);
      expect(diff.entities.modified[0].changes.status).toBeDefined();
      expect(diff.entities.modified[0].changes.status.old).toBe('open');
      expect(diff.entities.modified[0].changes.status.new).toBe('closed');
    });

    it('should compute diff for relation changes', async () => {
      const kg1 = {
        entities: [
          { id: 'e1', type: 'Issue' },
          { id: 'e2', type: 'PR' }
        ],
        relations: [{ id: 'r1', from: 'e1', to: 'e2', type: 'references' }]
      };

      const kg2 = {
        entities: [
          { id: 'e1', type: 'Issue' },
          { id: 'e2', type: 'PR' }
        ],
        relations: [
          { id: 'r1', from: 'e1', to: 'e2', type: 'references' },
          { id: 'r2', from: 'e2', to: 'e1', type: 'fixes' }
        ]
      };

      const snapshot1 = await versionManager.createSnapshot(kg1);
      await new Promise(resolve => setTimeout(resolve, 10));
      const snapshot2 = await versionManager.createSnapshot(kg2);

      const diff = await versionManager.computeDiff(snapshot1.id, snapshot2.id);

      expect(diff.summary.relationsAdded).toBe(1);
      expect(diff.relations.added.length).toBe(1);
      expect(diff.relations.added[0].id).toBe('r2');
    });
  });

  describe('Rollback', () => {
    it('should rollback to previous snapshot', async () => {
      const kg1 = {
        entities: [{ id: 'e1', type: 'Issue', name: 'Original' }],
        relations: []
      };

      const kg2 = {
        entities: [{ id: 'e1', type: 'Issue', name: 'Modified' }],
        relations: []
      };

      const snapshot1 = await versionManager.createSnapshot(kg1);
      await new Promise(resolve => setTimeout(resolve, 10));
      await versionManager.createSnapshot(kg2);

      const restored = await versionManager.rollback(snapshot1.id);

      expect(restored.entities[0].name).toBe('Original');
      expect(versionManager.getCurrentVersion()).toBe(snapshot1.id);
    });

    it('should perform selective rollback', async () => {
      const kg1 = {
        entities: [
          { id: 'e1', type: 'Issue', name: 'Issue Old' },
          { id: 'e2', type: 'PR', name: 'PR Old' }
        ],
        relations: []
      };

      const kg2 = {
        entities: [
          { id: 'e1', type: 'Issue', name: 'Issue New' },
          { id: 'e2', type: 'PR', name: 'PR New' }
        ],
        relations: []
      };

      const snapshot1 = await versionManager.createSnapshot(kg1);
      await new Promise(resolve => setTimeout(resolve, 10));
      await versionManager.createSnapshot(kg2);

      // Rollback only Issues, keep PRs
      const restored = await versionManager.selectiveRollback(snapshot1.id, {
        entityTypes: ['Issue'],
        keepOther: true
      });

      expect(restored.entities.length).toBe(2);
      const issue = restored.entities.find(e => e.type === 'Issue');
      const pr = restored.entities.find(e => e.type === 'PR');

      expect(issue.name).toBe('Issue Old'); // Rolled back
      expect(pr.name).toBe('PR New'); // Kept from current
    });

    it('should perform selective rollback without keeping other types', async () => {
      const kg1 = {
        entities: [
          { id: 'e1', type: 'Issue', name: 'Issue Old' },
          { id: 'e2', type: 'PR', name: 'PR Old' }
        ],
        relations: []
      };

      const kg2 = {
        entities: [
          { id: 'e1', type: 'Issue', name: 'Issue New' },
          { id: 'e2', type: 'PR', name: 'PR New' }
        ],
        relations: []
      };

      const snapshot1 = await versionManager.createSnapshot(kg1);
      await new Promise(resolve => setTimeout(resolve, 10));
      await versionManager.createSnapshot(kg2);

      // Restore only Issues, discard everything else
      const restored = await versionManager.selectiveRollback(snapshot1.id, {
        entityTypes: ['Issue'],
        keepOther: false
      });

      expect(restored.entities.length).toBe(1);
      expect(restored.entities[0].type).toBe('Issue');
      expect(restored.entities[0].name).toBe('Issue Old');
    });
  });

  describe('Snapshot Deletion', () => {
    it('should delete a specific snapshot', async () => {
      const testKG = {
        entities: [{ id: 'e1', type: 'Test' }],
        relations: []
      };

      const snapshot1 = await versionManager.createSnapshot(testKG);
      await new Promise(resolve => setTimeout(resolve, 10));
      await versionManager.createSnapshot(testKG);

      await versionManager.deleteSnapshot(snapshot1.id);

      const snapshots = versionManager.listSnapshots();
      expect(snapshots.length).toBe(1);
      expect(snapshots[0].id).not.toBe(snapshot1.id);
    });

    it('should update current version when deleting current snapshot', async () => {
      const testKG = {
        entities: [{ id: 'e1', type: 'Test' }],
        relations: []
      };

      const snapshot1 = await versionManager.createSnapshot(testKG);
      await new Promise(resolve => setTimeout(resolve, 10));
      const snapshot2 = await versionManager.createSnapshot(testKG);

      expect(versionManager.getCurrentVersion()).toBe(snapshot2.id);

      await versionManager.deleteSnapshot(snapshot2.id);

      expect(versionManager.getCurrentVersion()).toBe(snapshot1.id);
    });
  });

  describe('Error Handling', () => {
    it('should return null for non-existent snapshot', async () => {
      const snapshot = await versionManager.getSnapshot('non-existent-id');
      expect(snapshot).toBeNull();
    });

    it('should throw error when computing diff with non-existent snapshot', async () => {
      const testKG = {
        entities: [{ id: 'e1', type: 'Test' }],
        relations: []
      };

      const snapshot1 = await versionManager.createSnapshot(testKG);

      await expect(
        versionManager.computeDiff(snapshot1.id, 'non-existent')
      ).rejects.toThrow('Snapshot not found');
    });

    it('should throw error when rolling back to non-existent snapshot', async () => {
      await expect(
        versionManager.rollback('non-existent-id')
      ).rejects.toThrow('Snapshot not found');
    });
  });
});
