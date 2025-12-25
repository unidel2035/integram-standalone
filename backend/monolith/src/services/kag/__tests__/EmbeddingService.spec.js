/**
 * Tests for EmbeddingService
 * Issue #5071 - Vector embeddings and semantic search
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EmbeddingService from '../EmbeddingService.js';
import fs from 'fs/promises';

describe('EmbeddingService', () => {
  let service;

  beforeEach(() => {
    // Mock OpenAI client
    vi.mock('openai', () => {
      return {
        default: vi.fn().mockImplementation(() => ({
          embeddings: {
            create: vi.fn().mockResolvedValue({
              data: [{
                embedding: new Array(1536).fill(0).map((_, i) => Math.random())
              }]
            })
          }
        }))
      };
    });

    service = new EmbeddingService({
      apiKey: 'test-key',
      enableCache: false // Disable cache for testing
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('embed', () => {
    it('should generate embedding for text', async () => {
      const text = 'This is a test document about KAG implementation';
      const embedding = await service.embed(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536);
    });

    it('should truncate long text', async () => {
      const longText = 'x'.repeat(50000);
      const embedding = await service.embed(longText);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should throw error for invalid input', async () => {
      await expect(service.embed(null)).rejects.toThrow('Text must be a non-empty string');
      await expect(service.embed('')).rejects.toThrow('Text must be a non-empty string');
      await expect(service.embed(123)).rejects.toThrow('Text must be a non-empty string');
    });
  });

  describe('embedBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = [
        'First document',
        'Second document',
        'Third document'
      ];

      const embeddings = await service.embedBatch(texts);

      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(3);
      embeddings.forEach(embedding => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(1536);
      });
    });

    it('should handle empty array', async () => {
      await expect(service.embedBatch([])).rejects.toThrow('Texts must be a non-empty array');
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate similarity between identical vectors', () => {
      const vector = [1, 2, 3, 4, 5];
      const similarity = service.cosineSimilarity(vector, vector);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate similarity between different vectors', () => {
      const vectorA = [1, 0, 0];
      const vectorB = [0, 1, 0];
      const similarity = service.cosineSimilarity(vectorA, vectorB);

      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should handle similar vectors', () => {
      const vectorA = [1, 2, 3];
      const vectorB = [1, 2, 3.1];
      const similarity = service.cosineSimilarity(vectorA, vectorB);

      expect(similarity).toBeGreaterThan(0.99);
    });

    it('should throw error for invalid vectors', () => {
      expect(() => service.cosineSimilarity(null, [1, 2, 3])).toThrow();
      expect(() => service.cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
    });
  });

  describe('findSimilar', () => {
    it('should find most similar documents', () => {
      const queryEmbedding = [1, 0, 0];
      const documents = [
        { id: 'doc1', embedding: [1, 0, 0], name: 'Document 1' },
        { id: 'doc2', embedding: [0, 1, 0], name: 'Document 2' },
        { id: 'doc3', embedding: [0.9, 0.1, 0], name: 'Document 3' }
      ];

      const results = service.findSimilar(queryEmbedding, documents, { limit: 2 });

      expect(results.length).toBe(2);
      expect(results[0].id).toBe('doc1');
      expect(results[0].score).toBeCloseTo(1.0, 5);
      expect(results[1].id).toBe('doc3');
    });

    it('should filter by minimum score', () => {
      const queryEmbedding = [1, 0, 0];
      const documents = [
        { id: 'doc1', embedding: [1, 0, 0] },
        { id: 'doc2', embedding: [0, 1, 0] },
        { id: 'doc3', embedding: [0.5, 0.5, 0] }
      ];

      const results = service.findSimilar(queryEmbedding, documents, {
        limit: 10,
        minScore: 0.5
      });

      expect(results.length).toBeLessThan(documents.length);
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0.5);
      });
    });
  });

  describe('cache', () => {
    it('should cache embeddings when enabled', async () => {
      const serviceWithCache = new EmbeddingService({
        apiKey: 'test-key',
        enableCache: true
      });

      const text = 'Test caching';
      const embedding1 = await serviceWithCache.embed(text);
      const embedding2 = await serviceWithCache.embed(text);

      expect(embedding1).toEqual(embedding2);
      expect(serviceWithCache.cache.size).toBe(1);

      await serviceWithCache.clearCache();
    });

    it('should return cache statistics', async () => {
      const stats = service.getCacheStats();

      expect(stats).toHaveProperty('entries');
      expect(stats).toHaveProperty('enabled');
      expect(typeof stats.entries).toBe('number');
      expect(typeof stats.enabled).toBe('boolean');
    });
  });
});
