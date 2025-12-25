/**
 * Incremental Indexing Tests
 *
 * Tests for the incremental indexing feature in KAGService
 * Issue #5074
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KAGService } from '../KAGService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('KAG Incremental Indexing', () => {
  let kagService;
  let testDataDir;

  beforeEach(async () => {
    // Create test data directory
    testDataDir = path.join(__dirname, '../../../../data/kag-test-incremental');
    await fs.mkdir(testDataDir, { recursive: true });

    // Mock KAGService with test data directory
    kagService = new KAGService();
    kagService.dataDir = testDataDir;
    kagService.cacheDir = path.join(testDataDir, 'cache');
    kagService.embeddingsDir = path.join(testDataDir, 'embeddings');

    await fs.mkdir(kagService.cacheDir, { recursive: true });
    await fs.mkdir(kagService.embeddingsDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Index Metadata', () => {
    it('should save and load index metadata', async () => {
      const metadata = {
        lastIndexedAt: new Date().toISOString(),
        lastIssuesIndexedAt: new Date().toISOString(),
        lastPRsIndexedAt: new Date().toISOString(),
        lastCommitsIndexedAt: new Date().toISOString(),
        lastDocsIndexedAt: new Date().toISOString(),
        lastTreeSha: 'abc123def456',
        stats: {
          issues: 10,
          prs: 5,
          commits: 20
        }
      };

      await kagService.saveIndexMetadata(metadata);
      const loaded = await kagService.loadIndexMetadata();

      expect(loaded.lastIndexedAt).toBe(metadata.lastIndexedAt);
      expect(loaded.lastIssuesIndexedAt).toBe(metadata.lastIssuesIndexedAt);
      expect(loaded.lastTreeSha).toBe(metadata.lastTreeSha);
      expect(loaded.stats).toEqual(metadata.stats);
    });

    it('should return default metadata when file does not exist', async () => {
      const metadata = await kagService.loadIndexMetadata();

      expect(metadata.lastIndexedAt).toBeNull();
      expect(metadata.lastIssuesIndexedAt).toBeNull();
      expect(metadata.lastPRsIndexedAt).toBeNull();
      expect(metadata.lastCommitsIndexedAt).toBeNull();
      expect(metadata.lastDocsIndexedAt).toBeNull();
      expect(metadata.lastTreeSha).toBeNull();
      expect(metadata.stats).toEqual({});
    });
  });

  describe('ETag Cache', () => {
    it('should save and load ETag cache', async () => {
      const cache = new Map([
        ['issues_page_1', { etag: 'W/"abc123"', data: { id: 1 }, timestamp: new Date().toISOString() }],
        ['prs_page_1', { etag: 'W/"def456"', data: { id: 2 }, timestamp: new Date().toISOString() }]
      ]);

      await kagService.saveETagCache(cache);
      const loaded = await kagService.loadETagCache();

      expect(loaded.size).toBe(2);
      expect(loaded.get('issues_page_1')).toEqual(cache.get('issues_page_1'));
      expect(loaded.get('prs_page_1')).toEqual(cache.get('prs_page_1'));
    });

    it('should return empty Map when cache file does not exist', async () => {
      const cache = await kagService.loadETagCache();

      expect(cache).toBeInstanceOf(Map);
      expect(cache.size).toBe(0);
    });
  });

  describe('Entity Update', () => {
    it('should add new entity', () => {
      const entity = {
        id: 'issue_123',
        type: 'Issue',
        name: 'Test Issue',
        properties: { number: 123 },
        observations: ['Test observation']
      };

      kagService.addOrUpdateEntity(entity);

      expect(kagService.entities.has('issue_123')).toBe(true);
      expect(kagService.entities.get('issue_123')).toEqual(entity);
    });

    it('should update existing entity', () => {
      const entity1 = {
        id: 'issue_123',
        type: 'Issue',
        name: 'Test Issue',
        properties: { number: 123, state: 'open' },
        observations: ['First observation']
      };

      const entity2 = {
        id: 'issue_123',
        type: 'Issue',
        name: 'Test Issue Updated',
        properties: { number: 123, state: 'closed' },
        observations: ['Second observation']
      };

      kagService.addOrUpdateEntity(entity1);
      kagService.addOrUpdateEntity(entity2);

      const updated = kagService.entities.get('issue_123');
      expect(updated.properties.state).toBe('closed');
      expect(updated.observations).toContain('First observation');
      expect(updated.observations).toContain('Second observation');
    });
  });

  describe('Incremental Mode Detection', () => {
    it('should use incremental mode by default', async () => {
      // Mock the GitHub API calls
      kagService.octokit = {
        rest: {
          issues: {
            listForRepo: vi.fn().mockResolvedValue({ data: [] })
          },
          pulls: {
            list: vi.fn().mockResolvedValue({ data: [] })
          },
          git: {
            getRef: vi.fn().mockResolvedValue({
              data: { object: { sha: 'abc123' } }
            }),
            getTree: vi.fn().mockResolvedValue({
              data: { tree: [] }
            })
          },
          repos: {
            listCommits: vi.fn().mockResolvedValue({ data: [] }),
            getContent: vi.fn().mockResolvedValue({ data: { type: 'dir' } })
          }
        }
      };

      // Mock embedding and vector store
      kagService.embeddingService = {
        initialize: vi.fn(),
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
      };
      kagService.vectorStore = {
        initialize: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        addDocument: vi.fn()
      };

      const results = await kagService.indexRepository({
        incremental: true,
        includeCommits: false,
        includeDocs: false
      });

      expect(results.mode).toBe('incremental');
    });

    it('should use full mode when incremental is disabled', async () => {
      // Mock the GitHub API calls
      kagService.octokit = {
        rest: {
          issues: {
            listForRepo: vi.fn().mockResolvedValue({ data: [] })
          },
          pulls: {
            list: vi.fn().mockResolvedValue({ data: [] })
          },
          git: {
            getRef: vi.fn().mockResolvedValue({
              data: { object: { sha: 'abc123' } }
            }),
            getTree: vi.fn().mockResolvedValue({
              data: { tree: [] }
            })
          },
          repos: {
            listCommits: vi.fn().mockResolvedValue({ data: [] }),
            getContent: vi.fn().mockResolvedValue({ data: { type: 'dir' } })
          }
        }
      };

      // Mock embedding and vector store
      kagService.embeddingService = {
        initialize: vi.fn(),
        embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
      };
      kagService.vectorStore = {
        initialize: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        addDocument: vi.fn()
      };

      const results = await kagService.indexRepository({
        incremental: false,
        includeCommits: false,
        includeDocs: false
      });

      expect(results.mode).toBe('full');
    });
  });

  describe('API Call Optimization', () => {
    it('should track API calls saved in incremental mode', async () => {
      // Set up previous index metadata
      const previousMetadata = {
        lastIndexedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        lastIssuesIndexedAt: new Date(Date.now() - 3600000).toISOString(),
        lastPRsIndexedAt: new Date(Date.now() - 3600000).toISOString(),
        lastTreeSha: 'abc123',
        stats: {}
      };
      await kagService.saveIndexMetadata(previousMetadata);

      // Mock GitHub API
      kagService.octokit = {
        rest: {
          issues: {
            listForRepo: vi.fn().mockResolvedValue({
              data: [] // No new issues
            })
          },
          pulls: {
            list: vi.fn().mockResolvedValue({
              data: [] // No new PRs
            })
          },
          git: {
            getRef: vi.fn().mockResolvedValue({
              data: { object: { sha: 'abc123' } } // Same tree SHA
            })
          },
          repos: {
            listCommits: vi.fn().mockResolvedValue({ data: [] }),
            getContent: vi.fn().mockResolvedValue({ data: { type: 'dir' } })
          }
        }
      };

      // Mock embedding and vector store
      kagService.embeddingService = {
        initialize: vi.fn(),
        embed: vi.fn()
      };
      kagService.vectorStore = {
        initialize: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        addDocument: vi.fn()
      };

      const results = await kagService.indexRepository({
        incremental: true,
        includeCommits: false,
        includeDocs: false
      });

      // Should have saved API calls
      expect(results.apiCallsSaved).toBeGreaterThan(0);
    });
  });
});
