/**
 * Tests for VectorStore
 * Issue #5071 - Vector embeddings and semantic search
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import VectorStore from '../VectorStore.js';

describe('VectorStore', () => {
  let store;
  let mockCollection;
  let mockClient;

  beforeEach(async () => {
    // Mock ChromaDB collection
    mockCollection = {
      add: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        ids: [['doc1', 'doc2']],
        distances: [[0.1, 0.3]],
        metadatas: [[{ type: 'test' }, { type: 'test' }]],
        documents: [['Test document 1', 'Test document 2']]
      }),
      get: vi.fn().mockResolvedValue({
        ids: ['doc1'],
        embeddings: [[1, 2, 3]],
        metadatas: [{ type: 'test' }],
        documents: ['Test document']
      }),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(10)
    };

    // Mock ChromaDB client
    mockClient = {
      getOrCreateCollection: vi.fn().mockResolvedValue(mockCollection),
      deleteCollection: vi.fn().mockResolvedValue(undefined)
    };

    // Mock ChromaClient
    vi.mock('chromadb', () => ({
      ChromaClient: vi.fn().mockImplementation(() => mockClient)
    }));

    store = new VectorStore({
      path: '/tmp/test-chroma',
      collectionName: 'test_collection'
    });

    await store.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(store.initialized).toBe(true);
      expect(store.collection).toBeDefined();
    });

    it('should not reinitialize if already initialized', async () => {
      const initSpy = vi.spyOn(mockClient, 'getOrCreateCollection');
      await store.initialize();

      expect(initSpy).not.toHaveBeenCalled();
    });
  });

  describe('addDocuments', () => {
    it('should add documents with embeddings', async () => {
      const documents = [
        {
          id: 'doc1',
          embedding: [1, 2, 3],
          metadata: { type: 'test' },
          document: 'Test document'
        }
      ];

      await store.addDocuments(documents);

      expect(mockCollection.add).toHaveBeenCalledWith({
        ids: ['doc1'],
        embeddings: [[1, 2, 3]],
        metadatas: [{ type: 'test' }],
        documents: ['Test document']
      });
    });

    it('should throw error for empty array', async () => {
      await expect(store.addDocuments([])).rejects.toThrow('Documents must be a non-empty array');
    });
  });

  describe('search', () => {
    it('should search for similar documents', async () => {
      const queryEmbedding = [1, 2, 3];
      const results = await store.search(queryEmbedding, { limit: 5 });

      expect(mockCollection.query).toHaveBeenCalledWith({
        queryEmbeddings: [queryEmbedding],
        nResults: 5,
        where: null,
        whereDocument: null
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('metadata');
      expect(results[0]).toHaveProperty('document');
    });

    it('should support filtering with where clause', async () => {
      const queryEmbedding = [1, 2, 3];
      const where = { type: 'documentation' };

      await store.search(queryEmbedding, { limit: 5, where });

      expect(mockCollection.query).toHaveBeenCalledWith({
        queryEmbeddings: [queryEmbedding],
        nResults: 5,
        where,
        whereDocument: null
      });
    });
  });

  describe('getDocument', () => {
    it('should get document by ID', async () => {
      const doc = await store.getDocument('doc1');

      expect(mockCollection.get).toHaveBeenCalledWith({
        ids: ['doc1'],
        include: ['embeddings', 'metadatas', 'documents']
      });

      expect(doc).toBeDefined();
      expect(doc.id).toBe('doc1');
      expect(doc.embedding).toBeDefined();
    });

    it('should return null for non-existent document', async () => {
      mockCollection.get.mockResolvedValueOnce({ ids: [] });

      const doc = await store.getDocument('nonexistent');

      expect(doc).toBeNull();
    });
  });

  describe('updateDocument', () => {
    it('should update document', async () => {
      await store.updateDocument('doc1', {
        embedding: [4, 5, 6],
        metadata: { type: 'updated' }
      });

      expect(mockCollection.update).toHaveBeenCalledWith({
        ids: ['doc1'],
        embeddings: [[4, 5, 6]],
        metadatas: [{ type: 'updated' }]
      });
    });
  });

  describe('deleteDocuments', () => {
    it('should delete documents', async () => {
      await store.deleteDocuments(['doc1', 'doc2']);

      expect(mockCollection.delete).toHaveBeenCalledWith({
        ids: ['doc1', 'doc2']
      });
    });
  });

  describe('count', () => {
    it('should return document count', async () => {
      const count = await store.count();

      expect(count).toBe(10);
      expect(mockCollection.count).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all documents', async () => {
      mockCollection.get.mockResolvedValueOnce({
        ids: ['doc1', 'doc2', 'doc3']
      });

      await store.clear();

      expect(mockCollection.delete).toHaveBeenCalledWith({
        ids: ['doc1', 'doc2', 'doc3']
      });
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      const stats = await store.getStats();

      expect(stats).toHaveProperty('name');
      expect(stats).toHaveProperty('count');
      expect(stats).toHaveProperty('distanceMetric');
      expect(stats.count).toBe(10);
    });
  });
});
