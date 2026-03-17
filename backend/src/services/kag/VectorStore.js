/**
 * Vector Store for KAG (Knowledge Augmented Generation)
 *
 * Manages vector embeddings storage using Chroma DB.
 * Provides semantic search capabilities with cosine similarity.
 *
 * Features:
 * - Store and retrieve vector embeddings
 * - Semantic similarity search
 * - Batch operations for efficiency
 * - Collection management
 *
 * References:
 * - Issue #5071 - Vector embeddings and semantic search
 * - Chroma DB: https://www.trychroma.com/
 *
 * @module VectorStore
 */

import { ChromaClient } from 'chromadb';
import logger from '../../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Vector Store for managing embeddings with Chroma DB
 */
class VectorStore {
  constructor(config = {}) {
    this.config = {
      path: config.path || path.join(__dirname, '../../../data/kag/chroma'),
      collectionName: config.collectionName || 'kag_embeddings',
      distanceMetric: config.distanceMetric || 'cosine' // 'cosine', 'l2', 'ip'
    };

    this.client = null;
    this.collection = null;
    this.initialized = false;
  }

  /**
   * Initialize the vector store
   */
  async initialize() {
    if (this.initialized) return;

    console.log('===== [VectorStore] INITIALIZE START =====');
    console.log('[VectorStore] process.env.CHROMA_DISABLED:', process.env.CHROMA_DISABLED);
    console.log('[VectorStore] typeof:', typeof process.env.CHROMA_DISABLED);

    try {
      // Check if ChromaDB is disabled via environment variable
      const chromaDisabled = process.env.CHROMA_DISABLED === 'true';
      console.log('[VectorStore] chromaDisabled check result:', chromaDisabled);

      if (chromaDisabled) {
        console.log('[VectorStore] ChromaDB disabled via CHROMA_DISABLED env var, using in-memory mode');
        logger.info('[VectorStore] ChromaDB disabled, using in-memory fallback');
        this.client = null;
        this.collection = null;
        this.useInMemory = true;
        this.inMemoryStore = new Map();
        this.initialized = true;
        return;
      }

      // Try to initialize ChromaDB client with HTTP server
      // ChromaDB JS client requires HTTP server, not file path
      const chromaURL = process.env.CHROMA_URL || 'http://localhost:8000';

      console.log('[VectorStore] chromaURL:', chromaURL);
      logger.info('[VectorStore] Attempting ChromaDB connection', { chromaURL });

      try {
        this.client = new ChromaClient({
          path: chromaURL
        });

        // Test connection with heartbeat first (fail fast if server not available)
        console.log('[VectorStore] Testing ChromaDB connection with heartbeat...');
        await this.client.heartbeat();
        console.log('[VectorStore] Heartbeat successful');

        // Connection successful, now get or create collection
        this.collection = await this.client.getOrCreateCollection({
          name: this.config.collectionName,
          metadata: {
            'hnsw:space': this.config.distanceMetric
          }
        });

        logger.info('[VectorStore] ChromaDB connected', {
          url: chromaURL,
          collection: this.config.collectionName,
          count: await this.collection.count()
        });

        this.useInMemory = false;
      } catch (error) {
        // Fallback to in-memory store if ChromaDB unavailable
        console.log('[VectorStore] ERROR:', error.message);
        console.log('[VectorStore] Using in-memory fallback');

        logger.error('[VectorStore] ChromaDB unavailable, using in-memory fallback', {
          error: error.message,
          errorType: error.constructor.name,
          errorStack: error.stack,
          chromaURL
        });

        this.client = null;
        this.collection = null;
        this.useInMemory = true;
        this.inMemoryStore = new Map(); // id -> {embedding, metadata, document}
      }

      this.initialized = true;
      console.log('[VectorStore] Initialized - Mode:', this.useInMemory ? 'in-memory' : 'ChromaDB');

      logger.info('[VectorStore] Initialized', {
        mode: this.useInMemory ? 'in-memory' : 'ChromaDB',
        collection: this.config.collectionName
      });
    } catch (error) {
      logger.error('[VectorStore] Initialization failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Add documents with embeddings to the store
   * @param {Array<Object>} documents - Documents to add [{id, embedding, metadata, document}]
   * @returns {Promise<void>}
   */
  async addDocuments(documents) {
    await this.initialize();

    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error('Documents must be a non-empty array');
    }

    try {
      if (this.useInMemory) {
        // In-memory storage
        for (const doc of documents) {
          this.inMemoryStore.set(doc.id, {
            embedding: doc.embedding,
            metadata: doc.metadata || {},
            document: doc.document || ''
          });
        }

        logger.info('[VectorStore] Documents added to in-memory store', {
          count: documents.length
        });
      } else {
        // ChromaDB storage
        const ids = documents.map(doc => doc.id);
        const embeddings = documents.map(doc => doc.embedding);
        const metadatas = documents.map(doc => doc.metadata || {});
        const texts = documents.map(doc => doc.document || '');

        await this.collection.add({
          ids,
          embeddings,
          metadatas,
          documents: texts
        });

        logger.info('[VectorStore] Documents added to ChromaDB', {
          count: documents.length
        });
      }
    } catch (error) {
      logger.error('[VectorStore] Failed to add documents', {
        error: error.message,
        count: documents.length
      });
      throw error;
    }
  }

  /**
   * Add a single document
   * @param {string} id - Document ID
   * @param {Array<number>} embedding - Embedding vector
   * @param {Object} metadata - Metadata
   * @param {string} document - Document text
   * @returns {Promise<void>}
   */
  async addDocument(id, embedding, metadata = {}, document = '') {
    await this.addDocuments([{ id, embedding, metadata, document }]);
  }

  /**
   * Search for similar documents
   * @param {Array<number>} queryEmbedding - Query embedding
   * @param {Object} options - Search options {limit, where, whereDocument}
   * @returns {Promise<Array<Object>>} Search results [{id, score, metadata, document}]
   */
  async search(queryEmbedding, options = {}) {
    await this.initialize();

    const {
      limit = 10,
      where = null,
      whereDocument = null
    } = options;

    try {
      if (this.useInMemory) {
        // In-memory search with cosine similarity
        const results = [];

        for (const [id, data] of this.inMemoryStore.entries()) {
          const score = this._cosineSimilarity(queryEmbedding, data.embedding);
          results.push({
            id,
            score,
            metadata: data.metadata,
            document: data.document
          });
        }

        // Sort by score descending and limit
        results.sort((a, b) => b.score - a.score);
        const limited = results.slice(0, limit);

        logger.debug('[VectorStore] In-memory search completed', {
          totalDocs: this.inMemoryStore.size,
          resultsCount: limited.length
        });

        return limited;
      } else {
        // ChromaDB search
        const results = await this.collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: limit,
          where,
          whereDocument
        });

        // Transform results to our format
        const formatted = [];
        if (results.ids && results.ids[0]) {
          for (let i = 0; i < results.ids[0].length; i++) {
            formatted.push({
              id: results.ids[0][i],
              score: results.distances[0][i],
              metadata: results.metadatas[0][i] || {},
              document: results.documents[0][i] || ''
            });
          }
        }

        logger.debug('[VectorStore] Search completed', {
          results: formatted.length,
          limit
        });

        return formatted;
      }
    } catch (error) {
      logger.error('[VectorStore] Search failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object|null>} Document or null
   */
  async getDocument(id) {
    await this.initialize();

    try {
      const results = await this.collection.get({
        ids: [id],
        include: ['embeddings', 'metadatas', 'documents']
      });

      if (!results.ids || results.ids.length === 0) {
        return null;
      }

      return {
        id: results.ids[0],
        embedding: results.embeddings[0],
        metadata: results.metadatas[0] || {},
        document: results.documents[0] || ''
      };
    } catch (error) {
      logger.error('[VectorStore] Failed to get document', {
        id,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Update document
   * @param {string} id - Document ID
   * @param {Object} updates - Updates {embedding, metadata, document}
   * @returns {Promise<void>}
   */
  async updateDocument(id, updates) {
    await this.initialize();

    try {
      const updateData = { ids: [id] };

      if (updates.embedding) {
        updateData.embeddings = [updates.embedding];
      }
      if (updates.metadata) {
        updateData.metadatas = [updates.metadata];
      }
      if (updates.document) {
        updateData.documents = [updates.document];
      }

      await this.collection.update(updateData);

      logger.debug('[VectorStore] Document updated', { id });
    } catch (error) {
      logger.error('[VectorStore] Failed to update document', {
        id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete documents by IDs
   * @param {Array<string>} ids - Document IDs
   * @returns {Promise<void>}
   */
  async deleteDocuments(ids) {
    await this.initialize();

    try {
      await this.collection.delete({ ids });

      logger.info('[VectorStore] Documents deleted', {
        count: ids.length
      });
    } catch (error) {
      logger.error('[VectorStore] Failed to delete documents', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete a single document
   * @param {string} id - Document ID
   * @returns {Promise<void>}
   */
  async deleteDocument(id) {
    await this.deleteDocuments([id]);
  }

  /**
   * Get collection count
   * @returns {Promise<number>} Number of documents
   */
  async count() {
    await this.initialize();

    try {
      return await this.collection.count();
    } catch (error) {
      logger.error('[VectorStore] Failed to get count', {
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Clear all documents from collection
   * @returns {Promise<void>}
   */
  async clear() {
    await this.initialize();

    try {
      // Get all IDs
      const all = await this.collection.get();
      if (all.ids && all.ids.length > 0) {
        await this.collection.delete({ ids: all.ids });
      }

      logger.info('[VectorStore] Collection cleared');
    } catch (error) {
      logger.error('[VectorStore] Failed to clear collection', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete the entire collection
   * @returns {Promise<void>}
   */
  async deleteCollection() {
    await this.initialize();

    try {
      await this.client.deleteCollection({ name: this.config.collectionName });
      this.collection = null;
      this.initialized = false;

      logger.info('[VectorStore] Collection deleted', {
        name: this.config.collectionName
      });
    } catch (error) {
      logger.error('[VectorStore] Failed to delete collection', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get collection statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStats() {
    await this.initialize();

    try {
      if (this.useInMemory) {
        return {
          name: this.config.collectionName,
          count: this.inMemoryStore.size,
          distanceMetric: this.config.distanceMetric,
          mode: 'in-memory'
        };
      } else {
        const count = await this.collection.count();

        return {
          name: this.config.collectionName,
          count,
          distanceMetric: this.config.distanceMetric,
          mode: 'ChromaDB'
        };
      }
    } catch (error) {
      logger.error('[VectorStore] Failed to get stats', {
        error: error.message
      });
      return {
        name: this.config.collectionName,
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {Array<number>} a - First vector
   * @param {Array<number>} b - Second vector
   * @returns {number} Similarity score (0-1)
   * @private
   */
  _cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Singleton instance - reset on code change (Issue #5097)
let vectorStoreInstance = null;
const CODE_VERSION = 'v5097-fix-2-chroma-disabled';

export function getVectorStore() {
  // Force recreation on code change
  if (!vectorStoreInstance || vectorStoreInstance.codeVersion !== CODE_VERSION) {
    console.log(`[VectorStore] Creating new instance with version ${CODE_VERSION}`);
    vectorStoreInstance = new VectorStore();
    vectorStoreInstance.codeVersion = CODE_VERSION;
  }
  return vectorStoreInstance;
}

export default VectorStore;
