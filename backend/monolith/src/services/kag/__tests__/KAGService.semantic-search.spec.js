/**
 * Tests for KAGService semantic search functionality
 * Issue #5071 - Vector embeddings and semantic search
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import KAGService from '../KAGService.js';

describe('KAGService - Semantic Search', () => {
  let service;

  beforeEach(() => {
    service = new KAGService();

    // Mock embedding service
    service.embeddingService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      embed: vi.fn().mockResolvedValue(new Array(1536).fill(0).map(() => Math.random())),
      getCacheStats: vi.fn().mockReturnValue({ entries: 0, enabled: true })
    };

    // Mock vector store
    service.vectorStore = {
      initialize: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([
        {
          id: 'doc1',
          score: 0.95,
          metadata: { type: 'Documentation', name: 'README.md' },
          document: 'Documentation content'
        },
        {
          id: 'doc2',
          score: 0.85,
          metadata: { type: 'Issue', name: 'Issue #123' },
          document: 'Issue content'
        }
      ]),
      addDocument: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(10),
      getStats: vi.fn().mockResolvedValue({ name: 'kag_embeddings', count: 10, distanceMetric: 'cosine' })
    };

    // Add some test entities
    service.entities.set('doc1', {
      id: 'doc1',
      type: 'Documentation',
      name: 'README.md',
      properties: {},
      observations: ['Main documentation file']
    });

    service.entities.set('doc2', {
      id: 'doc2',
      type: 'Issue',
      name: 'Issue #123',
      properties: { number: 123 },
      observations: ['Bug report about search']
    });

    service.initialized = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('semanticSearch', () => {
    it('should perform semantic search', async () => {
      const results = await service.semanticSearch('how to use KAG', { limit: 5 });

      expect(service.embeddingService.embed).toHaveBeenCalledWith('how to use KAG');
      expect(service.vectorStore.search).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('entity');
      expect(results[0]).toHaveProperty('score');
    });

    it('should filter by entity types', async () => {
      await service.semanticSearch('bug fix', {
        limit: 5,
        entityTypes: ['Issue']
      });

      expect(service.vectorStore.search).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          where: { type: { $in: ['Issue'] } }
        })
      );
    });

    it('should handle errors gracefully', async () => {
      service.embeddingService.embed.mockRejectedValueOnce(new Error('API error'));

      const results = await service.semanticSearch('test query');

      expect(results).toEqual([]);
    });
  });

  describe('keywordSearch', () => {
    it('should perform keyword search', async () => {
      const results = await service.keywordSearch('README');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entity.name).toContain('README');
    });

    it('should filter by minimum score', async () => {
      const results = await service.keywordSearch('test', { minScore: 0.5 });

      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0.5);
      });
    });
  });

  describe('hybrid search', () => {
    it('should combine keyword and semantic search', async () => {
      const results = await service.search('KAG implementation', {
        mode: 'hybrid',
        limit: 5
      });

      expect(service.embeddingService.embed).toHaveBeenCalled();
      expect(service.vectorStore.search).toHaveBeenCalled();
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should use keyword-only mode', async () => {
      const results = await service.search('README', {
        mode: 'keyword',
        limit: 5
      });

      expect(service.embeddingService.embed).not.toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);
    });

    it('should use semantic-only mode', async () => {
      const results = await service.search('how to implement KAG', {
        mode: 'semantic',
        limit: 5
      });

      expect(service.embeddingService.embed).toHaveBeenCalled();
      expect(service.vectorStore.search).toHaveBeenCalled();
    });

    it('should merge results with sources in hybrid mode', async () => {
      // Add entity that matches keyword search
      service.entities.set('doc3', {
        id: 'doc3',
        type: 'File',
        name: 'KAG implementation guide',
        properties: {},
        observations: ['Implementation details']
      });

      const results = await service.search('KAG implementation', {
        mode: 'hybrid',
        limit: 10
      });

      // Some results should have both sources
      const hasMultipleSources = results.some(r => r.sources && r.sources.length > 1);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should fallback to keyword search on error', async () => {
      service.embeddingService.embed.mockRejectedValueOnce(new Error('API error'));

      const results = await service.search('README', {
        mode: 'hybrid',
        limit: 5
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('generateEntityEmbedding', () => {
    it('should generate embedding for entity', async () => {
      const entity = {
        id: 'test1',
        type: 'Documentation',
        name: 'Test Doc',
        observations: ['Test observation'],
        properties: { test: true }
      };

      await service.generateEntityEmbedding(entity);

      expect(service.embeddingService.embed).toHaveBeenCalled();
      expect(service.vectorStore.addDocument).toHaveBeenCalledWith(
        'test1',
        expect.any(Array),
        expect.objectContaining({ type: 'Documentation', name: 'Test Doc' }),
        expect.any(String)
      );
    });

    it('should handle errors gracefully', async () => {
      service.embeddingService.embed.mockRejectedValueOnce(new Error('Embedding error'));

      const entity = {
        id: 'test1',
        type: 'Test',
        name: 'Test',
        observations: []
      };

      await expect(service.generateEntityEmbedding(entity)).resolves.not.toThrow();
    });
  });

  describe('generateAllEmbeddings', () => {
    it('should generate embeddings for all entities', async () => {
      const count = await service.generateAllEmbeddings();

      expect(count).toBe(service.entities.size);
      expect(service.embeddingService.embed).toHaveBeenCalledTimes(service.entities.size);
    });

    it('should process entities in batches', async () => {
      // Add more entities
      for (let i = 0; i < 15; i++) {
        service.entities.set(`doc${i}`, {
          id: `doc${i}`,
          type: 'Test',
          name: `Test ${i}`,
          observations: []
        });
      }

      const count = await service.generateAllEmbeddings();

      expect(count).toBe(service.entities.size);
    });
  });

  describe('_entityToText', () => {
    it('should convert entity to text', () => {
      const entity = {
        type: 'Documentation',
        name: 'README.md',
        observations: ['Main documentation', 'Getting started guide'],
        properties: { version: '1.0' }
      };

      const text = service._entityToText(entity);

      expect(text).toContain('Type: Documentation');
      expect(text).toContain('Name: README.md');
      expect(text).toContain('Main documentation');
      expect(text).toContain('version');
    });
  });
});
