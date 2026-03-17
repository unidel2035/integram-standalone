/**
 * Embedding Service for KAG (Knowledge Augmented Generation)
 *
 * Generates vector embeddings for text using API providers with local fallback.
 * Embeddings are used for semantic search and similarity matching.
 *
 * Features:
 * - Provider-level fallback (polza → local transformers.js)
 * - Batch processing for efficiency
 * - Caching to reduce API calls
 * - Local fallback via @xenova/transformers (all-MiniLM-L6-v2, 384 dims)
 *
 * References:
 * - Issue #5071 - Vector embeddings and semantic search
 *
 * @module EmbeddingService
 */

import OpenAI from 'openai';
import logger from '../../utils/logger.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { withFallback } from '../../core/modelFallback.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Available embedding providers:
 * polza (text-embedding-3-small, 1536 dims) → local (all-MiniLM-L6-v2, 384 dims)
 */
const EMBEDDING_PROVIDERS = [
  { name: 'polza', envKey: 'POLZA_AI_API_KEY', baseURL: 'https://api.polza.ai/api/v1', model: 'openai/text-embedding-3-small', dimensions: 1536, type: 'api' },
];

/**
 * Local embedding provider using @xenova/transformers
 * Used as fallback when all API providers are unavailable
 */
let localPipeline = null;
const LOCAL_MODEL = 'Xenova/all-MiniLM-L6-v2';
const LOCAL_DIMENSIONS = 384;

async function getLocalPipeline() {
  if (localPipeline) return localPipeline;
  try {
    const { pipeline } = await import('@xenova/transformers');
    logger.info('[EmbeddingService] Loading local model...', { model: LOCAL_MODEL });
    localPipeline = await pipeline('feature-extraction', LOCAL_MODEL);
    logger.info('[EmbeddingService] Local model loaded', { model: LOCAL_MODEL, dimensions: LOCAL_DIMENSIONS });
    return localPipeline;
  } catch (err) {
    logger.error('[EmbeddingService] Failed to load local model', { error: err.message });
    throw err;
  }
}

async function localEmbed(text) {
  const extractor = await getLocalPipeline();
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

/**
 * Embedding Service for generating vector embeddings
 */
class EmbeddingService {
  constructor(config = {}) {
    // If explicit apiKey + apiBase provided, use as sole provider (backward compat)
    if (config.apiKey && config.apiBase) {
      this.providers = [{
        name: 'custom',
        apiKey: config.apiKey,
        baseURL: config.apiBase,
        model: config.model || 'text-embedding-3-small',
        dimensions: config.dimensions || 1536,
        type: 'api'
      }];
    } else {
      // Build provider list from available env keys
      this.providers = EMBEDDING_PROVIDERS
        .filter(p => process.env[p.envKey])
        .map(p => ({ ...p, apiKey: process.env[p.envKey] }));
    }

    // Always add local fallback
    this.hasLocalFallback = true;

    if (this.providers.length === 0) {
      logger.warn('[EmbeddingService] No API keys found. Will use local model only.');
    } else {
      logger.info({ providers: [...this.providers.map(p => p.name), 'local'] }, '[EmbeddingService] Available providers');
    }

    this.config = {
      batchSize: config.batchSize || 100,
      cacheDir: config.cacheDir || path.join(__dirname, '../../../data/kag/embeddings-cache'),
      enableCache: config.enableCache !== false,
      dimensions: config.dimensions || 1536
    };

    // Track which provider generated current embeddings
    this.activeProvider = null;
    this.activeDimensions = null;

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
      providers: [...this.providers.map(p => p.name), 'local'],
      cacheEnabled: this.config.enableCache,
      dimensions: this.config.dimensions
    });
  }

  /**
   * Get current embedding dimensions (depends on active provider)
   */
  getDimensions() {
    return this.activeDimensions || this.config.dimensions;
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

    // Check cache BEFORE fallback
    const cacheKey = this._getCacheKey(truncatedText);
    if (this.config.enableCache && this.cache.has(cacheKey)) {
      logger.debug('[EmbeddingService] Cache hit', { textLength: truncatedText.length });
      return this.cache.get(cacheKey);
    }

    let embedding = null;

    // Try API providers first
    if (this.providers.length > 0) {
      try {
        embedding = await withFallback(
          this.providers,
          async (provider) => {
            const client = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL });
            const response = await client.embeddings.create({
              model: provider.model,
              input: truncatedText,
              encoding_format: 'float'
            });
            this.activeProvider = provider.name;
            this.activeDimensions = provider.dimensions;
            return response.data[0].embedding;
          },
          { label: 'Embedding', timeout: 30000 }
        );
      } catch (err) {
        logger.warn('[EmbeddingService] All API providers failed, falling back to local', { error: err.message });
      }
    }

    // Local fallback
    if (!embedding && this.hasLocalFallback) {
      try {
        embedding = await localEmbed(truncatedText);
        this.activeProvider = 'local';
        this.activeDimensions = LOCAL_DIMENSIONS;
        logger.info('[EmbeddingService] Used local model', { dimensions: LOCAL_DIMENSIONS });
      } catch (err) {
        logger.error('[EmbeddingService] Local fallback also failed', { error: err.message });
        throw new Error('All embedding providers failed (API + local)');
      }
    }

    if (!embedding) {
      throw new Error('No embedding providers available');
    }

    // Cache the result
    if (this.config.enableCache) {
      this.cache.set(cacheKey, embedding);
      await this.saveCache();
    }

    logger.debug('[EmbeddingService] Embedding generated', {
      textLength: truncatedText.length,
      dimensions: embedding.length,
      provider: this.activeProvider
    });

    return embedding;
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
      // Dimension mismatch — return 0 instead of throwing
      if (a && b && a.length !== b.length) {
        logger.warn('[EmbeddingService] Dimension mismatch in similarity', { a: a.length, b: b.length });
        return 0;
      }
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
      enabled: this.config.enableCache,
      activeProvider: this.activeProvider,
      activeDimensions: this.activeDimensions
    };
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
