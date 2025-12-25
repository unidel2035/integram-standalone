// KnowledgeManager.js - Knowledge Management System for multi-agent knowledge sharing
import EventEmitter from 'events'
import { randomUUID } from 'crypto'
import logger from '../utils/logger.js'
import { OpenAI } from 'openai'

/**
 * KnowledgeManager provides centralized knowledge management with semantic search
 * for agent-to-agent knowledge sharing
 *
 * Issue #2713: Phase 5.1 - Knowledge Management System
 *
 * Features:
 * - Publish knowledge with auto-generated embeddings
 * - Semantic search using vector similarity
 * - Topic-based subscription system
 * - Automatic notifications to subscribers
 * - Knowledge versioning and confidence scoring
 * - Expiration policy for outdated knowledge
 *
 * Vector DB Integration:
 * - Supports Qdrant, Weaviate, Pinecone (configurable)
 * - Falls back to in-memory vector search if no DB available
 * - Uses OpenAI embeddings (ada-002) for semantic vectors
 */
export class KnowledgeManager extends EventEmitter {
  constructor(options = {}) {
    super()

    // Vector DB configuration
    this.vectorDbType = options.vectorDbType || 'memory' // 'qdrant' | 'weaviate' | 'pinecone' | 'memory'
    this.vectorDbUrl = options.vectorDbUrl || 'http://localhost:6333'
    this.collectionName = options.collectionName || 'agent_knowledge'

    // Vector DB client (will be initialized lazily)
    this.vectorDB = null
    this.embeddingModel = options.embeddingModel || 'text-embedding-ada-002'
    this.embeddingDimension = options.embeddingDimension || 1536 // ada-002 dimension

    // OpenAI client for embeddings
    this.openai = new OpenAI({
      apiKey: options.openaiApiKey || process.env.OPENAI_API_KEY,
    })

    // In-memory fallback storage
    this.knowledgeStore = new Map() // knowledgeId -> knowledge entry
    this.embeddings = new Map() // knowledgeId -> embedding vector

    // Subscription management
    this.subscriptions = new Map() // agentId -> Set<topics>

    // Knowledge expiration
    this.defaultTTL = options.defaultTTL || 7 * 24 * 60 * 60 * 1000 // 7 days
    this.cleanupInterval = options.cleanupInterval || 60 * 60 * 1000 // 1 hour

    // Start cleanup timer
    this._startCleanupTimer()

    logger.info('KnowledgeManager initialized', {
      vectorDbType: this.vectorDbType,
      vectorDbUrl: this.vectorDbUrl,
      collectionName: this.collectionName,
      embeddingModel: this.embeddingModel,
    })
  }

  /**
   * Initialize vector database connection
   */
  async initialize() {
    logger.info('Initializing KnowledgeManager...')

    try {
      if (this.vectorDbType === 'qdrant') {
        await this._initializeQdrant()
      } else if (this.vectorDbType === 'weaviate') {
        await this._initializeWeaviate()
      } else if (this.vectorDbType === 'pinecone') {
        await this._initializePinecone()
      } else {
        logger.info('Using in-memory vector storage (no vector DB configured)')
      }

      this.emit('initialized')
      logger.info('KnowledgeManager initialized successfully')
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to initialize vector DB')
      logger.warn('Falling back to in-memory storage')
      this.vectorDbType = 'memory'
    }
  }

  /**
   * Initialize Qdrant vector database
   * @private
   */
  async _initializeQdrant() {
    // Lazy load Qdrant client to avoid dependency if not using Qdrant
    const { QdrantClient } = await import('@qdrant/js-client-rest')

    this.vectorDB = new QdrantClient({
      url: this.vectorDbUrl,
    })

    // Check if collection exists, create if not
    try {
      await this.vectorDB.getCollection(this.collectionName)
      logger.info({ collection: this.collectionName }, 'Qdrant collection exists')
    } catch (error) {
      // Collection doesn't exist, create it
      await this.vectorDB.createCollection(this.collectionName, {
        vectors: {
          size: this.embeddingDimension,
          distance: 'Cosine',
        },
      })
      logger.info({ collection: this.collectionName }, 'Qdrant collection created')
    }
  }

  /**
   * Initialize Weaviate vector database
   * @private
   */
  async _initializeWeaviate() {
    logger.warn('Weaviate integration not yet implemented, using in-memory storage')
    this.vectorDbType = 'memory'
    // TODO: Implement Weaviate client initialization
  }

  /**
   * Initialize Pinecone vector database
   * @private
   */
  async _initializePinecone() {
    logger.warn('Pinecone integration not yet implemented, using in-memory storage')
    this.vectorDbType = 'memory'
    // TODO: Implement Pinecone client initialization
  }

  /**
   * Publish knowledge to the knowledge base
   *
   * @param {string} agentId - ID of the agent publishing knowledge
   * @param {Object} knowledge - Knowledge object
   * @param {string} knowledge.title - Title of the knowledge
   * @param {string} knowledge.content - Content/description of the knowledge
   * @param {string} knowledge.category - Category (topic area)
   * @param {string[]} knowledge.tags - Tags for categorization
   * @param {number} knowledge.confidence - Confidence score (0-1)
   * @param {Object} knowledge.metadata - Additional metadata
   * @returns {Promise<Object>} Published knowledge entry
   */
  async publishKnowledge(agentId, knowledge) {
    logger.info({ agentId, title: knowledge.title }, 'Publishing knowledge')

    try {
      // Validate input
      if (!knowledge.title || !knowledge.content) {
        throw new Error('Knowledge must have title and content')
      }

      // Generate embedding for semantic search
      const embedding = await this.generateEmbedding(knowledge.content)

      // Create knowledge entry
      const knowledgeEntry = {
        id: this.generateKnowledgeId(),
        agentId,
        title: knowledge.title,
        content: knowledge.content,
        category: knowledge.category || 'general',
        tags: knowledge.tags || [],
        confidence: knowledge.confidence || 0.8,
        metadata: knowledge.metadata || {},
        timestamp: Date.now(),
        expiresAt: Date.now() + (knowledge.ttl || this.defaultTTL),
        version: 1,
        usefulness: 0, // Will be updated based on feedback
        timesUsed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Store in vector DB or in-memory
      if (this.vectorDbType === 'qdrant' && this.vectorDB) {
        await this._storeInQdrant(knowledgeEntry, embedding)
      } else {
        // Store in-memory
        this.knowledgeStore.set(knowledgeEntry.id, knowledgeEntry)
        this.embeddings.set(knowledgeEntry.id, embedding)
      }

      logger.info({ knowledgeId: knowledgeEntry.id }, 'Knowledge published successfully')

      // Notify subscribers
      await this.notifySubscribers(knowledgeEntry)

      this.emit('knowledge:published', knowledgeEntry)

      return knowledgeEntry
    } catch (error) {
      logger.error({ agentId, error: error.message }, 'Failed to publish knowledge')
      throw error
    }
  }

  /**
   * Store knowledge in Qdrant
   * @private
   */
  async _storeInQdrant(knowledgeEntry, embedding) {
    await this.vectorDB.upsert(this.collectionName, {
      points: [
        {
          id: knowledgeEntry.id,
          vector: embedding,
          payload: knowledgeEntry,
        },
      ],
    })
  }

  /**
   * Search knowledge using semantic similarity
   *
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {number} options.limit - Max results to return (default: 10)
   * @param {string} options.category - Filter by category
   * @param {string[]} options.tags - Filter by tags
   * @param {number} options.minConfidence - Minimum confidence score
   * @param {string} options.excludeAgent - Exclude knowledge from this agent
   * @returns {Promise<Array>} Search results with similarity scores
   */
  async searchKnowledge(query, options = {}) {
    logger.info({ query, options }, 'Searching knowledge')

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query)

      // Search in vector DB or in-memory
      let results
      if (this.vectorDbType === 'qdrant' && this.vectorDB) {
        results = await this._searchInQdrant(queryEmbedding, options)
      } else {
        results = await this._searchInMemory(queryEmbedding, options)
      }

      logger.info({ query, resultCount: results.length }, 'Search completed')

      return results
    } catch (error) {
      logger.error({ query, error: error.message }, 'Search failed')
      throw error
    }
  }

  /**
   * Search in Qdrant
   * @private
   */
  async _searchInQdrant(queryEmbedding, options) {
    const filter = this._buildQdrantFilter(options)

    const searchResults = await this.vectorDB.search(this.collectionName, {
      vector: queryEmbedding,
      limit: options.limit || 10,
      filter,
    })

    return searchResults.map(result => ({
      ...result.payload,
      similarity: result.score,
    }))
  }

  /**
   * Build Qdrant filter from options
   * @private
   */
  _buildQdrantFilter(options) {
    const conditions = []

    if (options.category) {
      conditions.push({
        key: 'category',
        match: { value: options.category },
      })
    }

    if (options.minConfidence) {
      conditions.push({
        key: 'confidence',
        range: { gte: options.minConfidence },
      })
    }

    if (options.excludeAgent) {
      conditions.push({
        key: 'agentId',
        match: { value: options.excludeAgent },
      })
    }

    if (options.tags && options.tags.length > 0) {
      conditions.push({
        key: 'tags',
        match: { any: options.tags },
      })
    }

    return conditions.length > 0 ? { must: conditions } : undefined
  }

  /**
   * Search in-memory using cosine similarity
   * @private
   */
  async _searchInMemory(queryEmbedding, options) {
    const results = []

    for (const [knowledgeId, knowledge] of this.knowledgeStore) {
      // Apply filters
      if (options.category && knowledge.category !== options.category) {
        continue
      }

      if (options.minConfidence && knowledge.confidence < options.minConfidence) {
        continue
      }

      if (options.excludeAgent && knowledge.agentId === options.excludeAgent) {
        continue
      }

      if (
        options.tags &&
        options.tags.length > 0 &&
        !options.tags.some(tag => knowledge.tags.includes(tag))
      ) {
        continue
      }

      // Calculate cosine similarity
      const embedding = this.embeddings.get(knowledgeId)
      if (!embedding) {
        continue
      }

      const similarity = this._cosineSimilarity(queryEmbedding, embedding)

      results.push({
        ...knowledge,
        similarity,
      })
    }

    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity)
    return results.slice(0, options.limit || 10)
  }

  /**
   * Calculate cosine similarity between two vectors
   * @private
   */
  _cosineSimilarity(vecA, vecB) {
    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Subscribe agent to knowledge topics
   *
   * @param {string} agentId - ID of the subscribing agent
   * @param {string[]} topics - Topics to subscribe to (categories or tags)
   */
  async subscribe(agentId, topics) {
    const existingTopics = this.subscriptions.get(agentId) || new Set()

    for (const topic of topics) {
      existingTopics.add(topic)
    }

    this.subscriptions.set(agentId, existingTopics)

    logger.info({ agentId, topics }, 'Agent subscribed to knowledge topics')

    this.emit('subscription:added', { agentId, topics })
  }

  /**
   * Unsubscribe agent from topics
   *
   * @param {string} agentId - ID of the agent
   * @param {string[]} topics - Topics to unsubscribe from (optional, all if not provided)
   */
  async unsubscribe(agentId, topics = null) {
    if (!topics) {
      // Unsubscribe from all
      this.subscriptions.delete(agentId)
      logger.info({ agentId }, 'Agent unsubscribed from all topics')
    } else {
      const existingTopics = this.subscriptions.get(agentId)
      if (existingTopics) {
        for (const topic of topics) {
          existingTopics.delete(topic)
        }
      }
      logger.info({ agentId, topics }, 'Agent unsubscribed from topics')
    }

    this.emit('subscription:removed', { agentId, topics })
  }

  /**
   * Get relevant knowledge for an agent based on context
   *
   * @param {string} agentId - ID of the requesting agent
   * @param {Object} context - Context object
   * @param {string} context.query - Context description/query
   * @param {string[]} context.tags - Relevant tags
   * @param {string} context.category - Relevant category
   * @returns {Promise<Array>} Relevant knowledge entries
   */
  async getRelevantKnowledge(agentId, context) {
    logger.info({ agentId, context }, 'Getting relevant knowledge')

    try {
      // Build query from context
      const query = this._buildContextQuery(context)

      // Search for relevant knowledge
      const knowledge = await this.searchKnowledge(query, {
        excludeAgent: agentId, // Don't return agent's own knowledge
        minConfidence: context.minConfidence || 0.7,
        limit: context.limit || 5,
        category: context.category,
        tags: context.tags,
      })

      return knowledge
    } catch (error) {
      logger.error({ agentId, error: error.message }, 'Failed to get relevant knowledge')
      throw error
    }
  }

  /**
   * Build query string from context object
   * @private
   */
  _buildContextQuery(context) {
    const parts = []

    if (context.query) {
      parts.push(context.query)
    }

    if (context.category) {
      parts.push(`category: ${context.category}`)
    }

    if (context.tags && context.tags.length > 0) {
      parts.push(`tags: ${context.tags.join(', ')}`)
    }

    return parts.join(' ')
  }

  /**
   * Notify subscribers about new knowledge
   * @private
   */
  async notifySubscribers(knowledgeEntry) {
    const category = knowledgeEntry.category
    const tags = knowledgeEntry.tags

    let notificationCount = 0

    // Find subscribers interested in this knowledge
    for (const [agentId, topics] of this.subscriptions) {
      if (agentId === knowledgeEntry.agentId) {
        continue // Skip author
      }

      const isRelevant = topics.has(category) || tags.some(tag => topics.has(tag))

      if (isRelevant) {
        await this.sendNotification(agentId, knowledgeEntry)
        notificationCount++
      }
    }

    logger.info(
      { knowledgeId: knowledgeEntry.id, notificationCount },
      'Subscribers notified',
    )
  }

  /**
   * Send notification to an agent
   * @private
   */
  async sendNotification(agentId, knowledgeEntry) {
    this.emit('knowledge:notification', {
      agentId,
      knowledge: knowledgeEntry,
    })

    logger.debug({ agentId, knowledgeId: knowledgeEntry.id }, 'Notification sent')
  }

  /**
   * Generate embedding vector for text using OpenAI
   *
   * @param {string} text - Text to generate embedding for
   * @returns {Promise<number[]>} Embedding vector
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
      })

      return response.data[0].embedding
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to generate embedding')
      throw error
    }
  }

  /**
   * Version knowledge (create new version)
   *
   * @param {string} knowledgeId - ID of knowledge to version
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} New version of knowledge
   */
  async versionKnowledge(knowledgeId, updates) {
    logger.info({ knowledgeId }, 'Creating new knowledge version')

    try {
      // Get existing knowledge
      let existingKnowledge
      if (this.vectorDbType === 'qdrant' && this.vectorDB) {
        const results = await this.vectorDB.retrieve(this.collectionName, {
          ids: [knowledgeId],
        })
        if (results.length === 0) {
          throw new Error(`Knowledge ${knowledgeId} not found`)
        }
        existingKnowledge = results[0].payload
      } else {
        existingKnowledge = this.knowledgeStore.get(knowledgeId)
        if (!existingKnowledge) {
          throw new Error(`Knowledge ${knowledgeId} not found`)
        }
      }

      // Create new version
      const newKnowledge = {
        ...existingKnowledge,
        ...updates,
        id: this.generateKnowledgeId(), // New ID for new version
        version: existingKnowledge.version + 1,
        previousVersionId: knowledgeId,
        updatedAt: new Date().toISOString(),
      }

      // Generate new embedding if content changed
      let embedding
      if (updates.content && updates.content !== existingKnowledge.content) {
        embedding = await this.generateEmbedding(newKnowledge.content)
      } else {
        // Reuse existing embedding
        embedding =
          this.vectorDbType === 'qdrant'
            ? (await this.vectorDB.retrieve(this.collectionName, { ids: [knowledgeId] }))[0]
                .vector
            : this.embeddings.get(knowledgeId)
      }

      // Store new version
      if (this.vectorDbType === 'qdrant' && this.vectorDB) {
        await this._storeInQdrant(newKnowledge, embedding)
      } else {
        this.knowledgeStore.set(newKnowledge.id, newKnowledge)
        this.embeddings.set(newKnowledge.id, embedding)
      }

      logger.info({ newKnowledgeId: newKnowledge.id, version: newKnowledge.version },
        'New knowledge version created')

      this.emit('knowledge:versioned', { oldId: knowledgeId, newKnowledge })

      return newKnowledge
    } catch (error) {
      logger.error({ knowledgeId, error: error.message }, 'Failed to version knowledge')
      throw error
    }
  }

  /**
   * Update knowledge usefulness based on feedback
   *
   * @param {string} knowledgeId - ID of knowledge
   * @param {number} rating - Usefulness rating (-1 to 1)
   */
  async updateUsefulness(knowledgeId, rating) {
    try {
      let knowledge
      if (this.vectorDbType === 'qdrant' && this.vectorDB) {
        const results = await this.vectorDB.retrieve(this.collectionName, {
          ids: [knowledgeId],
        })
        if (results.length === 0) {
          throw new Error(`Knowledge ${knowledgeId} not found`)
        }
        knowledge = results[0].payload
      } else {
        knowledge = this.knowledgeStore.get(knowledgeId)
        if (!knowledge) {
          throw new Error(`Knowledge ${knowledgeId} not found`)
        }
      }

      // Update usefulness score (weighted average)
      const timesUsed = knowledge.timesUsed + 1
      const newUsefulness =
        (knowledge.usefulness * knowledge.timesUsed + rating) / timesUsed

      knowledge.usefulness = newUsefulness
      knowledge.timesUsed = timesUsed
      knowledge.updatedAt = new Date().toISOString()

      // Update storage
      if (this.vectorDbType === 'qdrant' && this.vectorDB) {
        const embedding = (
          await this.vectorDB.retrieve(this.collectionName, { ids: [knowledgeId] })
        )[0].vector
        await this._storeInQdrant(knowledge, embedding)
      } else {
        this.knowledgeStore.set(knowledgeId, knowledge)
      }

      logger.info({ knowledgeId, newUsefulness, timesUsed }, 'Knowledge usefulness updated')

      this.emit('knowledge:usefulness:updated', { knowledgeId, usefulness: newUsefulness })
    } catch (error) {
      logger.error({ knowledgeId, error: error.message }, 'Failed to update usefulness')
      throw error
    }
  }

  /**
   * Get statistics about knowledge base
   */
  getStats() {
    return {
      totalKnowledge: this.knowledgeStore.size,
      totalSubscriptions: this.subscriptions.size,
      vectorDbType: this.vectorDbType,
      collectionName: this.collectionName,
      embeddingModel: this.embeddingModel,
    }
  }

  /**
   * Generate unique knowledge ID
   * @private
   */
  generateKnowledgeId() {
    return `knowledge_${Date.now()}_${randomUUID().substring(0, 8)}`
  }

  /**
   * Start cleanup timer for expired knowledge
   * @private
   */
  _startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this._cleanupExpiredKnowledge()
    }, this.cleanupInterval)

    logger.debug('Knowledge cleanup timer started')
  }

  /**
   * Cleanup expired knowledge
   * @private
   */
  async _cleanupExpiredKnowledge() {
    const now = Date.now()
    let removedCount = 0

    for (const [knowledgeId, knowledge] of this.knowledgeStore) {
      if (knowledge.expiresAt && knowledge.expiresAt < now) {
        this.knowledgeStore.delete(knowledgeId)
        this.embeddings.delete(knowledgeId)
        removedCount++

        logger.debug({ knowledgeId }, 'Expired knowledge removed')
      }
    }

    if (removedCount > 0) {
      logger.info({ removedCount }, 'Knowledge cleanup completed')
      this.emit('knowledge:cleanup', { removedCount })
    }
  }

  /**
   * Shutdown the knowledge manager
   */
  async shutdown() {
    logger.info('Shutting down KnowledgeManager')

    // Stop cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // Close vector DB connection if needed
    if (this.vectorDB && this.vectorDB.close) {
      await this.vectorDB.close()
    }

    // Clear in-memory storage
    this.knowledgeStore.clear()
    this.embeddings.clear()
    this.subscriptions.clear()

    this.emit('shutdown')
  }
}

export default KnowledgeManager
