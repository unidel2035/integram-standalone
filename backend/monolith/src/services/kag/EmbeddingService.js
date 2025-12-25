/**
 * Embedding Service for KAG (Knowledge Augmented Generation)
 *
 * Generates vector embeddings for text using DeepSeek API or OpenAI API.
 * Embeddings are used for semantic search and similarity matching.
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Batch processing for efficiency
 * - Caching to reduce API calls
 * - Support for multiple embedding models
 *
 * References:
 * - Issue #5071 - Vector embeddings and semantic search
 * - DeepSeek API: https://api.deepseek.com/
 *
 * @module EmbeddingService
 */

import OpenAI from 'openai';
import logger from '../../utils/logger.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Embedding Service for generating vector embeddings
 */
class EmbeddingService {
  constructor(config = {}) {
    // Determine API provider and key (Issue #5097)
    // Priority: explicit config > DEEPSEEK > OPENAI > POLZA (fallback)
    const apiKey = config.apiKey
      || process.env.DEEPSEEK_API_KEY
      || process.env.OPENAI_API_KEY
      || process.env.POLZA_AI_API_KEY;

    // Auto-detect API base URL based on available keys
    let apiBase = config.apiBase;
    let model = config.model;

    if (!apiBase) {
      if (process.env.DEEPSEEK_API_KEY) {
        apiBase = 'https://api.deepseek.com/v1';
        model = model || 'text-embedding-3-small';
      } else if (process.env.OPENAI_API_KEY) {
        apiBase = 'https://api.openai.com/v1';
        model = model || 'text-embedding-3-small';
      } else if (process.env.POLZA_AI_API_KEY) {
        apiBase = 'https://api.polza.ai/api/v1';
        // Polza supports OpenAI models through aggregator
        model = model || 'openai/text-embedding-3-small';
        logger.info('[EmbeddingService] Using Polza.ai as embedding provider (fallback)');
      } else {
        apiBase = 'https://api.deepseek.com/v1'; // Default fallback
        model = model || 'text-embedding-3-small';
      }
    }

    this.config = {
      apiKey,
      apiBase,
      model,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      batchSize: config.batchSize || 100,
      cacheDir: config.cacheDir || path.join(__dirname, '../../../data/kag/embeddings-cache'),
      enableCache: config.enableCache !== false,
      dimensions: config.dimensions || 1536 // Default embedding dimensions
    };

    if (!this.config.apiKey) {
      logger.warn('[EmbeddingService] No API key provided. Service will not be functional.');
    }

    // Initialize OpenAI client (supports DeepSeek, OpenAI, and Polza - all OpenAI-compatible)
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.apiBase
    });

    this.cache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the embedding service
   */
  async initialize() {
    if (this.initialized) return;

    if (this.config.enableCache) {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
      await this.loadCache();
    }

    this.initialized = true;
    logger.info('[EmbeddingService] Initialized', {
      model: this.config.model,
      cacheEnabled: this.config.enableCache,
      dimensions: this.config.dimensions
    });
  }

  /**
   * Generate embedding for a single text
   * @param {string} text - Text to embed
   * @param {Object} options - Options
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async embed(text, options = {}) {
    await this.initialize();

    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string');
    }

    // Truncate text if too long (model limit is typically 8191 tokens, ~32k characters)
    const maxLength = options.maxLength || 30000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    // Check cache
    const cacheKey = this._getCacheKey(truncatedText);
    if (this.config.enableCache && this.cache.has(cacheKey)) {
      logger.debug('[EmbeddingService] Cache hit', { textLength: truncatedText.length });
      return this.cache.get(cacheKey);
    }

    // Generate embedding with retry
    let lastError;
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.client.embeddings.create({
          model: this.config.model,
          input: truncatedText,
          encoding_format: 'float'
        });

        const embedding = response.data[0].embedding;

        // Cache the result
        if (this.config.enableCache) {
          this.cache.set(cacheKey, embedding);
          await this.saveCache();
        }

        logger.debug('[EmbeddingService] Embedding generated', {
          textLength: truncatedText.length,
          dimensions: embedding.length,
          attempt
        });

        return embedding;
      } catch (error) {
        lastError = error;
        logger.warn('[EmbeddingService] Embedding attempt failed', {
          attempt,
          error: error.message
        });

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          await this._sleep(delay);
        }
      }
    }

    throw new Error(`Failed to generate embedding after ${this.config.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   * @param {Array<string>} texts - Texts to embed
   * @param {Object} options - Options
   * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
   */
  async embedBatch(texts, options = {}) {
    await this.initialize();

    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Texts must be a non-empty array');
    }

    const results = [];
    const batchSize = options.batchSize || this.config.batchSize;

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      logger.info('[EmbeddingService] Processing batch', {
        batchIndex: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
        total: texts.length
      });

      // Process each item in the batch
      const batchResults = await Promise.all(
        batch.map(text => this.embed(text, options))
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param {Array<number>} a - First embedding
   * @param {Array<number>} b - Second embedding
   * @returns {number} Similarity score (0-1)
   */
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) {
      throw new Error('Invalid embeddings for similarity calculation');
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

  /**
   * Find most similar embeddings from a collection
   * @param {Array<number>} queryEmbedding - Query embedding
   * @param {Array<Object>} documents - Documents with embeddings [{id, embedding, ...}]
   * @param {Object} options - Options {limit, minScore}
   * @returns {Array<Object>} Sorted results [{id, score, ...}]
   */
  findSimilar(queryEmbedding, documents, options = {}) {
    const { limit = 10, minScore = 0.0 } = options;

    const results = documents
      .map(doc => ({
        ...doc,
        score: this.cosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .filter(doc => doc.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  /**
   * Get cache key for text
   * @param {string} text - Text
   * @returns {string} Cache key
   * @private
   */
  _getCacheKey(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Load cache from disk
   * @private
   */
  async loadCache() {
    const cacheFile = path.join(this.config.cacheDir, 'embeddings.json');

    try {
      const data = await fs.readFile(cacheFile, 'utf-8');
      const cached = JSON.parse(data);

      for (const [key, value] of Object.entries(cached)) {
        this.cache.set(key, value);
      }

      logger.info('[EmbeddingService] Cache loaded', { entries: this.cache.size });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('[EmbeddingService] Failed to load cache', { error: error.message });
      }
    }
  }

  /**
   * Save cache to disk
   * @private
   */
  async saveCache() {
    if (!this.config.enableCache) return;

    const cacheFile = path.join(this.config.cacheDir, 'embeddings.json');

    try {
      const data = Object.fromEntries(this.cache.entries());
      await fs.writeFile(cacheFile, JSON.stringify(data, null, 2));

      logger.debug('[EmbeddingService] Cache saved', { entries: this.cache.size });
    } catch (error) {
      logger.error('[EmbeddingService] Failed to save cache', { error: error.message });
    }
  }

  /**
   * Clear cache
   */
  async clearCache() {
    this.cache.clear();
    await this.saveCache();
    logger.info('[EmbeddingService] Cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      entries: this.cache.size,
      enabled: this.config.enableCache
    };
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let embeddingServiceInstance = null;

export function getEmbeddingService() {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}

export default EmbeddingService;
