// KnowledgeManager.spec.js - Unit tests for KnowledgeManager
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { KnowledgeManager } from '../KnowledgeManager.js'

// Mock OpenAI
vi.mock('openai', () => {
  return {
    OpenAI: vi.fn().mockImplementation(() => {
      return {
        embeddings: {
          create: vi.fn().mockResolvedValue({
            data: [
              {
                embedding: Array(1536).fill(0.1), // Mock embedding vector
              },
            ],
          }),
        },
      }
    }),
  }
})

describe('KnowledgeManager', () => {
  let knowledgeManager

  beforeEach(async () => {
    knowledgeManager = new KnowledgeManager({
      vectorDbType: 'memory', // Use in-memory for tests
      openaiApiKey: 'test-key',
      cleanupInterval: 100000, // Long interval to avoid cleanup during tests
    })

    await knowledgeManager.initialize()
  })

  afterEach(async () => {
    if (knowledgeManager) {
      await knowledgeManager.shutdown()
    }
  })

  describe('initialization', () => {
    it('should initialize with default options', async () => {
      const km = new KnowledgeManager()
      await km.initialize()

      expect(km.vectorDbType).toBe('memory')
      expect(km.collectionName).toBe('agent_knowledge')
      expect(km.embeddingModel).toBe('text-embedding-ada-002')

      await km.shutdown()
    })

    it('should initialize with custom options', async () => {
      const km = new KnowledgeManager({
        vectorDbType: 'qdrant',
        collectionName: 'custom_collection',
        embeddingModel: 'custom-model',
      })

      expect(km.vectorDbType).toBe('qdrant')
      expect(km.collectionName).toBe('custom_collection')
      expect(km.embeddingModel).toBe('custom-model')

      await km.shutdown()
    })

    it('should emit initialized event', async () => {
      const km = new KnowledgeManager()
      const initSpy = vi.fn()
      km.on('initialized', initSpy)

      await km.initialize()

      expect(initSpy).toHaveBeenCalled()

      await km.shutdown()
    })
  })

  describe('publishKnowledge', () => {
    it('should publish knowledge successfully', async () => {
      const knowledge = {
        title: 'How to handle API rate limits',
        content: 'When hitting rate limits, implement exponential backoff...',
        category: 'api_integration',
        tags: ['api', 'rate_limiting', 'best_practices'],
        confidence: 0.9,
      }

      const published = await knowledgeManager.publishKnowledge('agent-1', knowledge)

      expect(published).toBeDefined()
      expect(published.id).toBeDefined()
      expect(published.agentId).toBe('agent-1')
      expect(published.title).toBe(knowledge.title)
      expect(published.content).toBe(knowledge.content)
      expect(published.category).toBe(knowledge.category)
      expect(published.tags).toEqual(knowledge.tags)
      expect(published.confidence).toBe(knowledge.confidence)
      expect(published.version).toBe(1)
      expect(published.usefulness).toBe(0)
      expect(published.timesUsed).toBe(0)
    })

    it('should emit knowledge:published event', async () => {
      const publishSpy = vi.fn()
      knowledgeManager.on('knowledge:published', publishSpy)

      await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Test Knowledge',
        content: 'Test content',
      })

      expect(publishSpy).toHaveBeenCalled()
      expect(publishSpy.mock.calls[0][0]).toMatchObject({
        title: 'Test Knowledge',
        content: 'Test content',
      })
    })

    it('should store knowledge in memory', async () => {
      const published = await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Test Knowledge',
        content: 'Test content',
      })

      const stored = knowledgeManager.knowledgeStore.get(published.id)
      expect(stored).toBeDefined()
      expect(stored.title).toBe('Test Knowledge')
    })

    it('should generate embedding for knowledge', async () => {
      const published = await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Test Knowledge',
        content: 'Test content',
      })

      const embedding = knowledgeManager.embeddings.get(published.id)
      expect(embedding).toBeDefined()
      expect(Array.isArray(embedding)).toBe(true)
      expect(embedding.length).toBe(1536) // ada-002 dimension
    })

    it('should throw error if title is missing', async () => {
      await expect(
        knowledgeManager.publishKnowledge('agent-1', {
          content: 'Test content',
        }),
      ).rejects.toThrow('Knowledge must have title and content')
    })

    it('should throw error if content is missing', async () => {
      await expect(
        knowledgeManager.publishKnowledge('agent-1', {
          title: 'Test Title',
        }),
      ).rejects.toThrow('Knowledge must have title and content')
    })

    it('should set default category if not provided', async () => {
      const published = await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Test Knowledge',
        content: 'Test content',
      })

      expect(published.category).toBe('general')
    })

    it('should set default confidence if not provided', async () => {
      const published = await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Test Knowledge',
        content: 'Test content',
      })

      expect(published.confidence).toBe(0.8)
    })

    it('should set expiration time', async () => {
      const published = await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Test Knowledge',
        content: 'Test content',
      })

      expect(published.expiresAt).toBeGreaterThan(Date.now())
    })
  })

  describe('searchKnowledge', () => {
    beforeEach(async () => {
      // Publish some test knowledge
      await knowledgeManager.publishKnowledge('agent-1', {
        title: 'API Rate Limiting',
        content: 'How to handle API rate limits with exponential backoff',
        category: 'api_integration',
        tags: ['api', 'rate_limiting'],
        confidence: 0.9,
      })

      await knowledgeManager.publishKnowledge('agent-2', {
        title: 'Database Optimization',
        content: 'Techniques for optimizing database queries',
        category: 'database',
        tags: ['database', 'performance'],
        confidence: 0.85,
      })

      await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Error Handling',
        content: 'Best practices for error handling in distributed systems',
        category: 'error_handling',
        tags: ['errors', 'best_practices'],
        confidence: 0.75,
      })
    })

    it('should search knowledge by query', async () => {
      const results = await knowledgeManager.searchKnowledge('API rate limiting')

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toHaveProperty('similarity')
    })

    it('should return results sorted by similarity', async () => {
      const results = await knowledgeManager.searchKnowledge('API')

      expect(results.length).toBeGreaterThan(0)

      // Check that results are sorted in descending order of similarity
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity)
      }
    })

    it('should filter by category', async () => {
      const results = await knowledgeManager.searchKnowledge('optimization', {
        category: 'database',
      })

      expect(results.length).toBeGreaterThan(0)
      results.forEach(result => {
        expect(result.category).toBe('database')
      })
    })

    it('should filter by minimum confidence', async () => {
      const results = await knowledgeManager.searchKnowledge('practices', {
        minConfidence: 0.8,
      })

      results.forEach(result => {
        expect(result.confidence).toBeGreaterThanOrEqual(0.8)
      })
    })

    it('should exclude agent knowledge', async () => {
      const results = await knowledgeManager.searchKnowledge('API', {
        excludeAgent: 'agent-1',
      })

      results.forEach(result => {
        expect(result.agentId).not.toBe('agent-1')
      })
    })

    it('should filter by tags', async () => {
      const results = await knowledgeManager.searchKnowledge('something', {
        tags: ['database'],
      })

      results.forEach(result => {
        expect(result.tags).toContain('database')
      })
    })

    it('should limit results', async () => {
      const results = await knowledgeManager.searchKnowledge('practices', {
        limit: 1,
      })

      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('should return empty array if no matches', async () => {
      const results = await knowledgeManager.searchKnowledge('nonexistent topic xyz', {
        minConfidence: 0.99,
      })

      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('subscribe and notifications', () => {
    it('should subscribe agent to topics', async () => {
      await knowledgeManager.subscribe('agent-1', ['api_integration', 'security'])

      const topics = knowledgeManager.subscriptions.get('agent-1')
      expect(topics).toBeDefined()
      expect(topics.has('api_integration')).toBe(true)
      expect(topics.has('security')).toBe(true)
    })

    it('should emit subscription:added event', async () => {
      const subSpy = vi.fn()
      knowledgeManager.on('subscription:added', subSpy)

      await knowledgeManager.subscribe('agent-1', ['api_integration'])

      expect(subSpy).toHaveBeenCalled()
      expect(subSpy.mock.calls[0][0]).toEqual({
        agentId: 'agent-1',
        topics: ['api_integration'],
      })
    })

    it('should notify subscribers when knowledge is published', async () => {
      const notificationSpy = vi.fn()
      knowledgeManager.on('knowledge:notification', notificationSpy)

      // Subscribe agent-2 to api_integration
      await knowledgeManager.subscribe('agent-2', ['api_integration'])

      // Agent-1 publishes knowledge in api_integration category
      await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Test Knowledge',
        content: 'Test content',
        category: 'api_integration',
      })

      expect(notificationSpy).toHaveBeenCalled()
      expect(notificationSpy.mock.calls[0][0].agentId).toBe('agent-2')
    })

    it('should not notify author agent', async () => {
      const notificationSpy = vi.fn()
      knowledgeManager.on('knowledge:notification', notificationSpy)

      // Agent-1 subscribes to api_integration
      await knowledgeManager.subscribe('agent-1', ['api_integration'])

      // Agent-1 publishes knowledge in api_integration category
      await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Test Knowledge',
        content: 'Test content',
        category: 'api_integration',
      })

      // Should not notify agent-1 (the author)
      expect(notificationSpy).not.toHaveBeenCalled()
    })

    it('should notify subscribers based on tags', async () => {
      const notificationSpy = vi.fn()
      knowledgeManager.on('knowledge:notification', notificationSpy)

      // Subscribe to tag
      await knowledgeManager.subscribe('agent-2', ['security'])

      // Publish with tag
      await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Test Knowledge',
        content: 'Test content',
        category: 'general',
        tags: ['security', 'best_practices'],
      })

      expect(notificationSpy).toHaveBeenCalled()
    })

    it('should unsubscribe from specific topics', async () => {
      await knowledgeManager.subscribe('agent-1', ['api', 'database', 'security'])

      await knowledgeManager.unsubscribe('agent-1', ['database'])

      const topics = knowledgeManager.subscriptions.get('agent-1')
      expect(topics.has('api')).toBe(true)
      expect(topics.has('database')).toBe(false)
      expect(topics.has('security')).toBe(true)
    })

    it('should unsubscribe from all topics', async () => {
      await knowledgeManager.subscribe('agent-1', ['api', 'database'])

      await knowledgeManager.unsubscribe('agent-1')

      expect(knowledgeManager.subscriptions.has('agent-1')).toBe(false)
    })

    it('should emit subscription:removed event', async () => {
      const unsubSpy = vi.fn()
      knowledgeManager.on('subscription:removed', unsubSpy)

      await knowledgeManager.subscribe('agent-1', ['api'])
      await knowledgeManager.unsubscribe('agent-1', ['api'])

      expect(unsubSpy).toHaveBeenCalled()
    })
  })

  describe('getRelevantKnowledge', () => {
    beforeEach(async () => {
      await knowledgeManager.publishKnowledge('agent-1', {
        title: 'API Best Practices',
        content: 'Best practices for REST API design',
        category: 'api_integration',
        tags: ['api', 'best_practices'],
        confidence: 0.9,
      })

      await knowledgeManager.publishKnowledge('agent-2', {
        title: 'Security Guidelines',
        content: 'Security guidelines for web applications',
        category: 'security',
        tags: ['security', 'web'],
        confidence: 0.85,
      })
    })

    it('should get relevant knowledge based on context', async () => {
      const relevant = await knowledgeManager.getRelevantKnowledge('agent-3', {
        query: 'API design',
        category: 'api_integration',
      })

      expect(relevant).toBeDefined()
      expect(Array.isArray(relevant)).toBe(true)
    })

    it('should exclude requesting agent knowledge', async () => {
      const relevant = await knowledgeManager.getRelevantKnowledge('agent-1', {
        query: 'API',
      })

      relevant.forEach(knowledge => {
        expect(knowledge.agentId).not.toBe('agent-1')
      })
    })

    it('should filter by minimum confidence', async () => {
      const relevant = await knowledgeManager.getRelevantKnowledge('agent-3', {
        query: 'practices',
        minConfidence: 0.88,
      })

      relevant.forEach(knowledge => {
        expect(knowledge.confidence).toBeGreaterThanOrEqual(0.88)
      })
    })

    it('should limit results', async () => {
      const relevant = await knowledgeManager.getRelevantKnowledge('agent-3', {
        query: 'practices',
        limit: 1,
      })

      expect(relevant.length).toBeLessThanOrEqual(1)
    })
  })

  describe('versionKnowledge', () => {
    let originalKnowledge

    beforeEach(async () => {
      originalKnowledge = await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Original Title',
        content: 'Original content',
        category: 'test',
        confidence: 0.8,
      })
    })

    it('should create new version of knowledge', async () => {
      const newVersion = await knowledgeManager.versionKnowledge(originalKnowledge.id, {
        content: 'Updated content',
      })

      expect(newVersion).toBeDefined()
      expect(newVersion.id).not.toBe(originalKnowledge.id)
      expect(newVersion.version).toBe(2)
      expect(newVersion.previousVersionId).toBe(originalKnowledge.id)
      expect(newVersion.content).toBe('Updated content')
    })

    it('should preserve unchanged fields', async () => {
      const newVersion = await knowledgeManager.versionKnowledge(originalKnowledge.id, {
        content: 'Updated content',
      })

      expect(newVersion.title).toBe(originalKnowledge.title)
      expect(newVersion.category).toBe(originalKnowledge.category)
      expect(newVersion.agentId).toBe(originalKnowledge.agentId)
    })

    it('should emit knowledge:versioned event', async () => {
      const versionSpy = vi.fn()
      knowledgeManager.on('knowledge:versioned', versionSpy)

      await knowledgeManager.versionKnowledge(originalKnowledge.id, {
        content: 'Updated',
      })

      expect(versionSpy).toHaveBeenCalled()
      expect(versionSpy.mock.calls[0][0].oldId).toBe(originalKnowledge.id)
    })

    it('should throw error if knowledge not found', async () => {
      await expect(
        knowledgeManager.versionKnowledge('nonexistent-id', { content: 'test' }),
      ).rejects.toThrow('Knowledge nonexistent-id not found')
    })
  })

  describe('updateUsefulness', () => {
    let knowledge

    beforeEach(async () => {
      knowledge = await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Test Knowledge',
        content: 'Test content',
      })
    })

    it('should update usefulness score', async () => {
      await knowledgeManager.updateUsefulness(knowledge.id, 0.8)

      const updated = knowledgeManager.knowledgeStore.get(knowledge.id)
      expect(updated.usefulness).toBeCloseTo(0.8)
      expect(updated.timesUsed).toBe(1)
    })

    it('should calculate weighted average', async () => {
      await knowledgeManager.updateUsefulness(knowledge.id, 0.8)
      await knowledgeManager.updateUsefulness(knowledge.id, 0.6)

      const updated = knowledgeManager.knowledgeStore.get(knowledge.id)
      expect(updated.usefulness).toBeCloseTo(0.7)
      expect(updated.timesUsed).toBe(2)
    })

    it('should emit usefulness:updated event', async () => {
      const usefulnessSpy = vi.fn()
      knowledgeManager.on('knowledge:usefulness:updated', usefulnessSpy)

      await knowledgeManager.updateUsefulness(knowledge.id, 0.8)

      expect(usefulnessSpy).toHaveBeenCalled()
      expect(usefulnessSpy.mock.calls[0][0].knowledgeId).toBe(knowledge.id)
    })

    it('should throw error if knowledge not found', async () => {
      await expect(
        knowledgeManager.updateUsefulness('nonexistent-id', 0.8),
      ).rejects.toThrow('Knowledge nonexistent-id not found')
    })
  })

  describe('getStats', () => {
    it('should return statistics', async () => {
      await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Test 1',
        content: 'Content 1',
      })

      await knowledgeManager.publishKnowledge('agent-2', {
        title: 'Test 2',
        content: 'Content 2',
      })

      await knowledgeManager.subscribe('agent-1', ['api'])

      const stats = knowledgeManager.getStats()

      expect(stats).toBeDefined()
      expect(stats.totalKnowledge).toBe(2)
      expect(stats.totalSubscriptions).toBe(1)
      expect(stats.vectorDbType).toBe('memory')
      expect(stats.collectionName).toBe('agent_knowledge')
      expect(stats.embeddingModel).toBe('text-embedding-ada-002')
    })
  })

  describe('cleanup', () => {
    it('should cleanup expired knowledge', async () => {
      // Create knowledge with short TTL
      const shortTTL = 100 // 100ms
      await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Short-lived Knowledge',
        content: 'This will expire soon',
        ttl: shortTTL,
      })

      expect(knowledgeManager.knowledgeStore.size).toBe(1)

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, shortTTL + 50))

      // Trigger cleanup
      await knowledgeManager._cleanupExpiredKnowledge()

      expect(knowledgeManager.knowledgeStore.size).toBe(0)
    })

    it('should emit cleanup event', async () => {
      const cleanupSpy = vi.fn()
      knowledgeManager.on('knowledge:cleanup', cleanupSpy)

      // Create expired knowledge
      await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Expired',
        content: 'Content',
        ttl: 1,
      })

      await new Promise(resolve => setTimeout(resolve, 50))
      await knowledgeManager._cleanupExpiredKnowledge()

      expect(cleanupSpy).toHaveBeenCalled()
      expect(cleanupSpy.mock.calls[0][0].removedCount).toBeGreaterThan(0)
    })
  })

  describe('shutdown', () => {
    it('should shutdown cleanly', async () => {
      const shutdownSpy = vi.fn()
      knowledgeManager.on('shutdown', shutdownSpy)

      await knowledgeManager.shutdown()

      expect(shutdownSpy).toHaveBeenCalled()
      expect(knowledgeManager.knowledgeStore.size).toBe(0)
      expect(knowledgeManager.embeddings.size).toBe(0)
      expect(knowledgeManager.subscriptions.size).toBe(0)
    })
  })
})
