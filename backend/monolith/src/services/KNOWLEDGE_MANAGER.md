# Knowledge Management System

## Overview

The Knowledge Management System enables agents to share knowledge, insights, and learnings with each other, creating a collective intelligence across the multi-agent network.

**Issue**: #2713 - Phase 5.1: Knowledge Management System

## Features

- **Publish Knowledge**: Agents can publish insights, patterns, and best practices
- **Semantic Search**: Find relevant knowledge using vector similarity search
- **Topic Subscriptions**: Subscribe to knowledge categories and receive automatic notifications
- **Knowledge Versioning**: Track evolution of knowledge over time
- **Confidence Scoring**: Rate knowledge based on confidence and usefulness
- **Automatic Expiration**: Remove outdated knowledge based on TTL

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Knowledge Manager                         │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐    ┌─────────────┐ │
│  │  Publishing  │      │   Search     │    │ Subscribers │ │
│  │   Engine     │─────▶│   Engine     │    │   Manager   │ │
│  └──────────────┘      └──────────────┘    └─────────────┘ │
│         │                      │                    │        │
│         ▼                      ▼                    ▼        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Vector Database (Qdrant/Memory)           │   │
│  │  - Embeddings (1536-dim vectors via OpenAI)          │   │
│  │  - Metadata (category, tags, confidence)             │   │
│  │  - Cosine similarity search                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                      │                    │
         ▼                      ▼                    ▼
   [Agent 1]              [Agent 2]              [Agent 3]
```

## Usage

### Initialization

```javascript
import { KnowledgeManager } from './services/KnowledgeManager.js'

const knowledgeManager = new KnowledgeManager({
  vectorDbType: 'qdrant', // 'qdrant' | 'weaviate' | 'pinecone' | 'memory'
  vectorDbUrl: 'http://localhost:6333',
  collectionName: 'agent_knowledge',
  openaiApiKey: process.env.OPENAI_API_KEY,
  embeddingModel: 'text-embedding-ada-002',
  defaultTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
})

await knowledgeManager.initialize()
```

### Publishing Knowledge

```javascript
// Agent discovers a new pattern
const anomalyAgent = getAgent('anomaly-detection')

anomalyAgent.on('pattern:discovered', async pattern => {
  const knowledge = await knowledgeManager.publishKnowledge(anomalyAgent.id, {
    title: `New anomaly pattern: ${pattern.type}`,
    content: `Detected ${pattern.type} with characteristics: ${JSON.stringify(pattern)}`,
    category: 'security_patterns',
    tags: ['anomaly', 'security', pattern.type],
    confidence: pattern.confidence,
    metadata: {
      detectedAt: new Date().toISOString(),
      severity: pattern.severity,
    },
  })

  console.log('Knowledge published:', knowledge.id)
})
```

### Subscribing to Topics

```javascript
// Subscribe to relevant knowledge topics
await knowledgeManager.subscribe('incident-management-agent', [
  'security_patterns',
  'anomaly',
  'threat_detection',
])

await knowledgeManager.subscribe('api-gateway-agent', ['api_integration', 'rate_limiting'])

// Handle notifications
knowledgeManager.on('knowledge:notification', async ({ agentId, knowledge }) => {
  console.log(`Agent ${agentId} notified of new knowledge:`, knowledge.title)

  // Agent can react to new knowledge
  const agent = getAgent(agentId)
  await agent.processNewKnowledge(knowledge)
})
```

### Searching Knowledge

```javascript
// Simple search
const results = await knowledgeManager.searchKnowledge('API rate limiting best practices', {
  limit: 5,
})

console.log('Search results:', results.map(r => r.title))

// Advanced search with filters
const filteredResults = await knowledgeManager.searchKnowledge('database optimization', {
  category: 'database',
  tags: ['performance'],
  minConfidence: 0.8,
  excludeAgent: 'my-agent-id', // Don't return my own knowledge
  limit: 10,
})
```

### Getting Relevant Knowledge

```javascript
// Get relevant knowledge for a specific context
const relevantKnowledge = await knowledgeManager.getRelevantKnowledge('api-gateway-agent', {
  query: 'handling sudden traffic spike',
  category: 'scalability',
  tags: ['load_balancing', 'auto_scaling'],
  minConfidence: 0.7,
  limit: 5,
})

// Use the knowledge
for (const knowledge of relevantKnowledge) {
  console.log(`Applying knowledge: ${knowledge.title}`)
  console.log(`Confidence: ${knowledge.confidence}`)
  console.log(`Similarity: ${knowledge.similarity}`)
}
```

### Knowledge Versioning

```javascript
// Create improved version of existing knowledge
const improvedKnowledge = await knowledgeManager.versionKnowledge(originalKnowledgeId, {
  content:
    'Updated approach: Use exponential backoff with jitter for better distribution...',
  confidence: 0.95, // Increased confidence
})

console.log('New version:', improvedKnowledge.version)
console.log('Previous version:', improvedKnowledge.previousVersionId)
```

### Updating Usefulness

```javascript
// Agent uses knowledge and provides feedback
const knowledge = searchResults[0]

// Try applying the knowledge
const result = await applyKnowledge(knowledge)

if (result.success) {
  // Knowledge was helpful
  await knowledgeManager.updateUsefulness(knowledge.id, 0.9)
} else {
  // Knowledge was not helpful
  await knowledgeManager.updateUsefulness(knowledge.id, 0.3)
}
```

## Complete Example: Security Pattern Sharing

```javascript
import { KnowledgeManager } from './services/KnowledgeManager.js'

// Initialize
const km = new KnowledgeManager({
  vectorDbType: 'memory',
  openaiApiKey: process.env.OPENAI_API_KEY,
})
await km.initialize()

// ============================================
// Step 1: Agents subscribe to topics
// ============================================
await km.subscribe('incident-management', ['security_patterns', 'ddos'])
await km.subscribe('security-monitor', ['security_patterns', 'threat_detection'])
await km.subscribe('api-gateway', ['rate_limiting', 'ddos'])

// ============================================
// Step 2: Anomaly Detection Agent discovers pattern
// ============================================
const pattern = {
  type: 'ddos',
  characteristics: {
    requestRate: 10000,
    sourceIPs: ['multiple'],
    targetEndpoint: '/api/public',
  },
  confidence: 0.92,
}

const knowledge = await km.publishKnowledge('anomaly-detection', {
  title: `DDoS attack pattern detected`,
  content: `
    Detected coordinated DDoS attack:
    - Request rate: 10,000 req/s
    - Source: Multiple IPs (botnet suspected)
    - Target: /api/public endpoint
    - Mitigation: Apply rate limiting + IP blocking
  `,
  category: 'security_patterns',
  tags: ['ddos', 'attack', 'rate_limiting', 'threat_detection'],
  confidence: 0.92,
  metadata: {
    severity: 'high',
    detectedAt: new Date().toISOString(),
    affectedEndpoint: '/api/public',
  },
})

console.log('Knowledge published:', knowledge.id)

// ============================================
// Step 3: Subscribed agents are notified
// ============================================
km.on('knowledge:notification', async ({ agentId, knowledge }) => {
  console.log(`✉️  ${agentId} notified: ${knowledge.title}`)

  if (agentId === 'api-gateway') {
    // API Gateway applies rate limiting based on the knowledge
    console.log('🛡️  API Gateway: Applying rate limiting to /api/public')
  }

  if (agentId === 'incident-management') {
    // Incident Management creates incident ticket
    console.log('🎫 Incident Management: Creating incident ticket')
  }
})

// ============================================
// Step 4: Other agents search for related knowledge
// ============================================
setTimeout(async () => {
  const relatedKnowledge = await km.searchKnowledge('prevent DDoS attacks', {
    category: 'security_patterns',
    minConfidence: 0.8,
    limit: 3,
  })

  console.log('\n🔍 Search results:')
  relatedKnowledge.forEach(k => {
    console.log(
      `  - ${k.title} (confidence: ${k.confidence}, similarity: ${k.similarity.toFixed(3)})`,
    )
  })

  // ============================================
  // Step 5: Agents provide feedback on usefulness
  // ============================================
  const usedKnowledge = relatedKnowledge[0]
  console.log(`\n✅ Applying knowledge: ${usedKnowledge.title}`)

  // Simulate successful mitigation
  await km.updateUsefulness(usedKnowledge.id, 0.95)
  console.log('👍 Knowledge rated as highly useful')

  // Check updated stats
  const stats = km.getStats()
  console.log('\n📊 Knowledge Manager Stats:', stats)

  // Cleanup
  await km.shutdown()
}, 1000)
```

## API Reference

### Constructor

```typescript
new KnowledgeManager(options?: {
  vectorDbType?: 'qdrant' | 'weaviate' | 'pinecone' | 'memory'
  vectorDbUrl?: string
  collectionName?: string
  openaiApiKey?: string
  embeddingModel?: string
  embeddingDimension?: number
  defaultTTL?: number
  cleanupInterval?: number
})
```

### Methods

#### `initialize(): Promise<void>`

Initialize vector database connection.

#### `publishKnowledge(agentId, knowledge): Promise<Knowledge>`

Publish new knowledge to the knowledge base.

**Parameters:**

- `agentId` (string): ID of the publishing agent
- `knowledge` (object):
  - `title` (string): Knowledge title
  - `content` (string): Knowledge content
  - `category` (string): Category/topic
  - `tags` (string[]): Tags for categorization
  - `confidence` (number): Confidence score (0-1)
  - `metadata` (object): Additional metadata
  - `ttl` (number): Time-to-live in milliseconds

**Returns:** Published knowledge entry

#### `searchKnowledge(query, options): Promise<Knowledge[]>`

Search knowledge using semantic similarity.

**Parameters:**

- `query` (string): Search query
- `options` (object):
  - `limit` (number): Max results (default: 10)
  - `category` (string): Filter by category
  - `tags` (string[]): Filter by tags
  - `minConfidence` (number): Minimum confidence score
  - `excludeAgent` (string): Exclude knowledge from this agent

**Returns:** Array of knowledge entries with similarity scores

#### `subscribe(agentId, topics): Promise<void>`

Subscribe agent to knowledge topics.

**Parameters:**

- `agentId` (string): ID of subscribing agent
- `topics` (string[]): Topics to subscribe to

#### `unsubscribe(agentId, topics?): Promise<void>`

Unsubscribe from topics.

**Parameters:**

- `agentId` (string): ID of agent
- `topics` (string[]): Topics to unsubscribe from (optional, all if not provided)

#### `getRelevantKnowledge(agentId, context): Promise<Knowledge[]>`

Get relevant knowledge for an agent based on context.

**Parameters:**

- `agentId` (string): ID of requesting agent
- `context` (object):
  - `query` (string): Context description
  - `category` (string): Relevant category
  - `tags` (string[]): Relevant tags
  - `minConfidence` (number): Minimum confidence
  - `limit` (number): Max results

**Returns:** Array of relevant knowledge entries

#### `versionKnowledge(knowledgeId, updates): Promise<Knowledge>`

Create new version of existing knowledge.

**Parameters:**

- `knowledgeId` (string): ID of knowledge to version
- `updates` (object): Updates to apply

**Returns:** New version of knowledge

#### `updateUsefulness(knowledgeId, rating): Promise<void>`

Update knowledge usefulness based on feedback.

**Parameters:**

- `knowledgeId` (string): ID of knowledge
- `rating` (number): Usefulness rating (-1 to 1)

#### `getStats(): Object`

Get statistics about knowledge base.

**Returns:**

```javascript
{
  totalKnowledge: number,
  totalSubscriptions: number,
  vectorDbType: string,
  collectionName: string,
  embeddingModel: string
}
```

#### `shutdown(): Promise<void>`

Shutdown the knowledge manager.

### Events

#### `knowledge:published`

Emitted when knowledge is published.

```javascript
km.on('knowledge:published', knowledge => {
  console.log('New knowledge:', knowledge.title)
})
```

#### `knowledge:notification`

Emitted when subscriber is notified of new knowledge.

```javascript
km.on('knowledge:notification', ({ agentId, knowledge }) => {
  console.log(`Agent ${agentId} notified:`, knowledge.title)
})
```

#### `knowledge:versioned`

Emitted when knowledge is versioned.

```javascript
km.on('knowledge:versioned', ({ oldId, newKnowledge }) => {
  console.log(`Knowledge ${oldId} updated to version ${newKnowledge.version}`)
})
```

#### `knowledge:usefulness:updated`

Emitted when knowledge usefulness is updated.

```javascript
km.on('knowledge:usefulness:updated', ({ knowledgeId, usefulness }) => {
  console.log(`Knowledge ${knowledgeId} usefulness: ${usefulness}`)
})
```

#### `subscription:added`

Emitted when agent subscribes to topics.

```javascript
km.on('subscription:added', ({ agentId, topics }) => {
  console.log(`Agent ${agentId} subscribed to:`, topics)
})
```

#### `subscription:removed`

Emitted when agent unsubscribes.

```javascript
km.on('subscription:removed', ({ agentId, topics }) => {
  console.log(`Agent ${agentId} unsubscribed from:`, topics)
})
```

## Vector Database Setup

### Qdrant (Recommended for self-hosted)

```bash
docker run -p 6333:6333 qdrant/qdrant
```

Then configure:

```javascript
const km = new KnowledgeManager({
  vectorDbType: 'qdrant',
  vectorDbUrl: 'http://localhost:6333',
})
```

### In-Memory (Default for development)

```javascript
const km = new KnowledgeManager({
  vectorDbType: 'memory', // No external DB required
})
```

## Environment Variables

```bash
# OpenAI API key for embeddings
OPENAI_API_KEY=sk-...

# Qdrant URL (if using Qdrant)
QDRANT_URL=http://localhost:6333
```

## Best Practices

### 1. Publish Meaningful Knowledge

```javascript
// ✅ Good: Specific, actionable knowledge
await km.publishKnowledge(agentId, {
  title: 'Retry strategy for service X timeout',
  content: 'When service X times out, retry with exponential backoff: 1s, 2s, 4s, max 3 attempts',
  category: 'reliability',
  confidence: 0.9,
})

// ❌ Bad: Vague, not actionable
await km.publishKnowledge(agentId, {
  title: 'Something about retries',
  content: 'Retries are good',
  category: 'general',
  confidence: 0.5,
})
```

### 2. Subscribe to Relevant Topics Only

```javascript
// ✅ Good: Focused subscriptions
await km.subscribe('api-gateway-agent', ['api_integration', 'rate_limiting', 'caching'])

// ❌ Bad: Too broad, will get irrelevant notifications
await km.subscribe('api-gateway-agent', ['*', 'all', 'everything'])
```

### 3. Provide Confidence Scores

```javascript
// ✅ Good: Confidence reflects certainty
await km.publishKnowledge(agentId, {
  title: 'Verified solution for bug X',
  content: 'Tested and confirmed: ...',
  confidence: 0.95, // High confidence, verified
})

await km.publishKnowledge(agentId, {
  title: 'Potential workaround for issue Y',
  content: 'Untested hypothesis: ...',
  confidence: 0.6, // Lower confidence, hypothesis
})
```

### 4. Update Usefulness

```javascript
// Always provide feedback after using knowledge
const knowledge = await km.getRelevantKnowledge(agentId, context)

for (const k of knowledge) {
  const result = await tryApplyKnowledge(k)

  if (result.success) {
    await km.updateUsefulness(k.id, 0.9)
  } else {
    await km.updateUsefulness(k.id, 0.3)
  }
}
```

### 5. Version Evolving Knowledge

```javascript
// When knowledge improves, create new version
const improvedKnowledge = await km.versionKnowledge(originalId, {
  content: 'Updated with new insights: ...',
  confidence: 0.95,
})
```

## Testing

```bash
# Run unit tests
npm run test src/services/__tests__/KnowledgeManager.spec.js

# Run integration tests
npm run test src/services/__tests__/KnowledgeManager.integration.spec.js
```

## Performance Considerations

- **Embedding Generation**: OpenAI API calls add latency (~200-500ms per request)
- **Vector Search**: In-memory search is fast for <10K entries, use Qdrant for larger datasets
- **Subscriptions**: O(n) notification check, optimize for <1000 active subscriptions
- **Cleanup**: Runs periodically (default: 1 hour), adjust `cleanupInterval` as needed

## Troubleshooting

### OpenAI API Errors

```javascript
// Check API key
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Missing')

// Handle rate limits
try {
  await km.publishKnowledge(...)
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 60000))
    await km.publishKnowledge(...)
  }
}
```

### Vector DB Connection Issues

```javascript
// Test connection
try {
  await km.initialize()
  console.log('✅ Connected to vector DB')
} catch (error) {
  console.error('❌ Vector DB connection failed:', error.message)
  console.log('Falling back to in-memory storage')
}
```

## References

- Issue #2713: Phase 5.1 - Knowledge Management System
- Issue #2700: Phase 1.2 - Multi-Agent Orchestrator
- Issue #2459: Phase 2 - Communication Protocol
- `/docs/MULTI_AGENT_ORGANISM_AUDIT.md` - Section 3.2, 4.5
