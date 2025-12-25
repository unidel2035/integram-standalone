// KnowledgeManager.integration.spec.js - Integration tests for KnowledgeManager
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { KnowledgeManager } from '../KnowledgeManager.js'
import { MessageBus } from '../MessageBus.js'
import { BaseAgent } from '../../agents/BaseAgent.js'

// Mock OpenAI
vi.mock('openai', () => {
  return {
    OpenAI: vi.fn().mockImplementation(() => {
      return {
        embeddings: {
          create: vi.fn().mockImplementation(({ input }) => {
            // Generate different embeddings based on input content
            // This simulates semantic similarity
            const hash = input.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
            const baseValue = (hash % 100) / 100

            return Promise.resolve({
              data: [
                {
                  embedding: Array(1536)
                    .fill(0)
                    .map((_, i) => baseValue + i * 0.001),
                },
              ],
            })
          }),
        },
      }
    }),
  }
})

describe('KnowledgeManager Integration Tests', () => {
  let knowledgeManager
  let messageBus
  let agents

  beforeEach(async () => {
    // Initialize KnowledgeManager
    knowledgeManager = new KnowledgeManager({
      vectorDbType: 'memory',
      openaiApiKey: 'test-key',
      cleanupInterval: 100000,
    })
    await knowledgeManager.initialize()

    // Initialize MessageBus for agent communication
    messageBus = new MessageBus()

    // Create test agents
    agents = {
      anomalyDetection: new BaseAgent({
        id: 'anomaly-detection',
        name: 'Anomaly Detection Agent',
        capabilities: ['anomaly_detection', 'pattern_recognition'],
      }),
      incidentManagement: new BaseAgent({
        id: 'incident-management',
        name: 'Incident Management Agent',
        capabilities: ['incident_handling', 'escalation'],
      }),
      securityMonitor: new BaseAgent({
        id: 'security-monitor',
        name: 'Security Monitor Agent',
        capabilities: ['security_monitoring', 'threat_detection'],
      }),
    }
  })

  afterEach(async () => {
    if (knowledgeManager) {
      await knowledgeManager.shutdown()
    }
    if (messageBus) {
      await messageBus.shutdown()
    }
  })

  describe('Multi-agent knowledge sharing workflow', () => {
    it('should enable agents to discover and share patterns', async () => {
      // Scenario: Anomaly Detection Agent discovers a new attack pattern

      // Step 1: Subscribe security agents to relevant topics
      await knowledgeManager.subscribe(agents.incidentManagement.id, [
        'security_patterns',
        'anomaly',
      ])
      await knowledgeManager.subscribe(agents.securityMonitor.id, [
        'security_patterns',
        'threat_detection',
      ])

      // Track notifications
      const notifications = []
      knowledgeManager.on('knowledge:notification', notification => {
        notifications.push(notification)
      })

      // Step 2: Anomaly Detection Agent publishes discovered pattern
      const pattern = {
        type: 'ddos',
        characteristics: {
          requestRate: 10000,
          sourceIPs: ['multiple'],
          userAgents: ['bot-pattern'],
        },
        confidence: 0.92,
      }

      const publishedKnowledge = await knowledgeManager.publishKnowledge(
        agents.anomalyDetection.id,
        {
          title: `New anomaly pattern: ${pattern.type}`,
          content: `Detected DDoS pattern with characteristics: ${JSON.stringify(pattern.characteristics)}. Confidence: ${pattern.confidence}`,
          category: 'security_patterns',
          tags: ['anomaly', 'ddos', 'security', 'threat_detection'],
          confidence: pattern.confidence,
          metadata: {
            patternType: pattern.type,
            detectedAt: new Date().toISOString(),
          },
        },
      )

      expect(publishedKnowledge).toBeDefined()
      expect(publishedKnowledge.id).toBeDefined()

      // Wait for notifications to be sent
      await new Promise(resolve => setTimeout(resolve, 100))

      // Step 3: Verify that subscribed agents received notifications
      expect(notifications.length).toBe(2) // incident-management and security-monitor

      const notifiedAgents = notifications.map(n => n.agentId)
      expect(notifiedAgents).toContain(agents.incidentManagement.id)
      expect(notifiedAgents).toContain(agents.securityMonitor.id)
      expect(notifiedAgents).not.toContain(agents.anomalyDetection.id) // Author not notified

      // Step 4: Incident Management Agent searches for relevant knowledge
      const relevantKnowledge = await knowledgeManager.getRelevantKnowledge(
        agents.incidentManagement.id,
        {
          query: 'handling DDoS attack',
          category: 'security_patterns',
          minConfidence: 0.7,
        },
      )

      expect(relevantKnowledge).toBeDefined()
      expect(relevantKnowledge.length).toBeGreaterThan(0)
      expect(relevantKnowledge[0].title).toContain('ddos')
    })

    it('should support knowledge evolution through versioning', async () => {
      // Scenario: API integration knowledge gets updated with new insights

      // Step 1: Initial knowledge published
      const initialKnowledge = await knowledgeManager.publishKnowledge('agent-1', {
        title: 'API X Rate Limit Handling',
        content: 'When API X returns 429, wait for X-RateLimit-Reset header',
        category: 'api_integration',
        tags: ['api', 'rate_limiting'],
        confidence: 0.8,
      })

      // Step 2: Agent discovers better approach
      const improvedKnowledge = await knowledgeManager.versionKnowledge(
        initialKnowledge.id,
        {
          content:
            'When API X returns 429, wait for X-RateLimit-Reset header and implement exponential backoff starting at 1s',
          confidence: 0.95,
        },
      )

      expect(improvedKnowledge.version).toBe(2)
      expect(improvedKnowledge.previousVersionId).toBe(initialKnowledge.id)
      expect(improvedKnowledge.confidence).toBe(0.95)

      // Step 3: Search finds the latest version
      const searchResults = await knowledgeManager.searchKnowledge('API rate limit', {
        minConfidence: 0.9,
      })

      const foundImproved = searchResults.find(k => k.id === improvedKnowledge.id)
      expect(foundImproved).toBeDefined()
    })

    it('should track knowledge usefulness based on feedback', async () => {
      // Scenario: Knowledge gets rated by agents using it

      const knowledge = await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Error Recovery Pattern',
        content: 'Use circuit breaker pattern for external service calls',
        category: 'reliability',
        tags: ['error_handling', 'patterns'],
        confidence: 0.85,
      })

      expect(knowledge.usefulness).toBe(0)
      expect(knowledge.timesUsed).toBe(0)

      // Agent 2 uses it and finds it helpful
      await knowledgeManager.updateUsefulness(knowledge.id, 0.9)

      let updated = knowledgeManager.knowledgeStore.get(knowledge.id)
      expect(updated.usefulness).toBeCloseTo(0.9)
      expect(updated.timesUsed).toBe(1)

      // Agent 3 uses it and finds it very helpful
      await knowledgeManager.updateUsefulness(knowledge.id, 1.0)

      updated = knowledgeManager.knowledgeStore.get(knowledge.id)
      expect(updated.usefulness).toBeCloseTo(0.95)
      expect(updated.timesUsed).toBe(2)

      // Agent 4 finds it less helpful
      await knowledgeManager.updateUsefulness(knowledge.id, 0.6)

      updated = knowledgeManager.knowledgeStore.get(knowledge.id)
      expect(updated.usefulness).toBeCloseTo(0.83, 1)
      expect(updated.timesUsed).toBe(3)
    })

    it('should enable semantic search across knowledge base', async () => {
      // Scenario: Build knowledge base and test semantic search

      // Publish diverse knowledge
      await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Database Connection Pooling',
        content:
          'Use connection pooling to reduce overhead of creating new database connections',
        category: 'database',
        tags: ['database', 'performance', 'optimization'],
        confidence: 0.9,
      })

      await knowledgeManager.publishKnowledge('agent-2', {
        title: 'API Response Caching',
        content: 'Cache API responses to reduce latency and improve performance',
        category: 'api',
        tags: ['api', 'caching', 'performance'],
        confidence: 0.85,
      })

      await knowledgeManager.publishKnowledge('agent-3', {
        title: 'Query Optimization',
        content: 'Add indexes on frequently queried columns to speed up database queries',
        category: 'database',
        tags: ['database', 'query', 'performance'],
        confidence: 0.92,
      })

      // Test semantic search for "improving performance"
      const performanceResults = await knowledgeManager.searchKnowledge(
        'improving application performance',
        { limit: 5 },
      )

      expect(performanceResults.length).toBeGreaterThan(0)
      // All results should have 'performance' tag or be about performance
      expect(
        performanceResults.every(
          r => r.tags.includes('performance') || r.content.includes('performance'),
        ),
      ).toBe(true)

      // Test semantic search for "database efficiency"
      const databaseResults = await knowledgeManager.searchKnowledge('database efficiency', {
        limit: 5,
      })

      expect(databaseResults.length).toBeGreaterThan(0)
      // Should find database-related knowledge
      expect(databaseResults.some(r => r.category === 'database')).toBe(true)
    })

    it('should support complex filtering and search', async () => {
      // Publish varied knowledge
      const knowledge1 = await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Security Best Practices',
        content: 'Always validate user input and sanitize data',
        category: 'security',
        tags: ['security', 'validation', 'best_practices'],
        confidence: 0.95,
      })

      const knowledge2 = await knowledgeManager.publishKnowledge('agent-2', {
        title: 'Input Validation Techniques',
        content: 'Use whitelist validation for user inputs',
        category: 'security',
        tags: ['security', 'validation', 'input'],
        confidence: 0.88,
      })

      const knowledge3 = await knowledgeManager.publishKnowledge('agent-3', {
        title: 'API Security',
        content: 'Implement rate limiting and authentication for APIs',
        category: 'security',
        tags: ['security', 'api', 'authentication'],
        confidence: 0.82,
      })

      // Search with multiple filters
      const results = await knowledgeManager.searchKnowledge('security validation', {
        category: 'security',
        tags: ['validation'],
        minConfidence: 0.85,
        limit: 10,
      })

      expect(results.length).toBeGreaterThan(0)
      results.forEach(r => {
        expect(r.category).toBe('security')
        expect(r.tags).toContain('validation')
        expect(r.confidence).toBeGreaterThanOrEqual(0.85)
      })
    })

    it('should handle high-volume knowledge sharing', async () => {
      // Scenario: Multiple agents publishing knowledge concurrently

      const publishPromises = []

      // 10 agents each publishing 5 pieces of knowledge
      for (let agentNum = 1; agentNum <= 10; agentNum++) {
        for (let knowledgeNum = 1; knowledgeNum <= 5; knowledgeNum++) {
          publishPromises.push(
            knowledgeManager.publishKnowledge(`agent-${agentNum}`, {
              title: `Knowledge ${knowledgeNum} from Agent ${agentNum}`,
              content: `This is knowledge item ${knowledgeNum} discovered by agent ${agentNum}`,
              category: `category-${knowledgeNum % 3}`,
              tags: [`tag-${knowledgeNum}`, `agent-${agentNum}`],
              confidence: 0.7 + Math.random() * 0.3,
            }),
          )
        }
      }

      const publishedKnowledge = await Promise.all(publishPromises)

      expect(publishedKnowledge.length).toBe(50)
      expect(knowledgeManager.knowledgeStore.size).toBe(50)

      // Test search performance with large knowledge base
      const searchResults = await knowledgeManager.searchKnowledge('knowledge discovered', {
        limit: 10,
      })

      expect(searchResults.length).toBe(10)
      expect(searchResults[0].similarity).toBeDefined()
    })
  })

  describe('Integration with MessageBus', () => {
    it('should coordinate with MessageBus for notifications', async () => {
      // Scenario: Knowledge notifications trigger MessageBus messages

      const messagesSent = []
      knowledgeManager.on('knowledge:notification', async notification => {
        // Simulate sending message via MessageBus
        messagesSent.push({
          to: notification.agentId,
          type: 'knowledge_notification',
          knowledge: notification.knowledge,
        })
      })

      // Subscribe agents
      await knowledgeManager.subscribe('agent-1', ['api'])
      await knowledgeManager.subscribe('agent-2', ['api'])

      // Publish knowledge
      await knowledgeManager.publishKnowledge('agent-3', {
        title: 'API Knowledge',
        content: 'API best practices',
        category: 'api',
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(messagesSent.length).toBe(2)
      expect(messagesSent.map(m => m.to)).toContain('agent-1')
      expect(messagesSent.map(m => m.to)).toContain('agent-2')
    })
  })

  describe('Knowledge lifecycle management', () => {
    it('should handle knowledge expiration', async () => {
      // Publish knowledge with short TTL
      const shortLivedKnowledge = await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Temporary Insight',
        content: 'This insight is only valid for a short time',
        category: 'temporary',
        ttl: 100, // 100ms
      })

      expect(knowledgeManager.knowledgeStore.has(shortLivedKnowledge.id)).toBe(true)

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150))

      // Trigger cleanup
      await knowledgeManager._cleanupExpiredKnowledge()

      expect(knowledgeManager.knowledgeStore.has(shortLivedKnowledge.id)).toBe(false)
    })

    it('should preserve long-lived knowledge', async () => {
      const longLivedKnowledge = await knowledgeManager.publishKnowledge('agent-1', {
        title: 'Fundamental Principle',
        content: 'This knowledge remains valid for a long time',
        category: 'fundamentals',
        ttl: 24 * 60 * 60 * 1000, // 24 hours
      })

      expect(knowledgeManager.knowledgeStore.has(longLivedKnowledge.id)).toBe(true)

      // Cleanup should not remove it
      await knowledgeManager._cleanupExpiredKnowledge()

      expect(knowledgeManager.knowledgeStore.has(longLivedKnowledge.id)).toBe(true)
    })
  })
})
