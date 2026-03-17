#!/usr/bin/env node

/**
 * KAG Memory MCP Server
 *
 * Model Context Protocol (MCP) server that provides fast context retrieval
 * for AI agents using the KAG (Knowledge Augmented Generation) knowledge base.
 *
 * This server bridges the KAG service to provide memory capabilities compatible
 * with the standard MCP memory protocol while leveraging KAG's superior
 * knowledge graph and semantic search capabilities.
 *
 * Features:
 * - Fast semantic search across project knowledge
 * - Entity and relation management via knowledge graph
 * - RAG-based question answering
 * - Multi-repository support
 * - Vector search with embeddings
 *
 * Based on:
 * - https://dev.drondoc.ru/kag (KAG Knowledge Base UI)
 * - backend/monolith/src/services/kag/KAGService.js
 * - Issue #5126
 *
 * Tools provided:
 * - kag_search - Semantic search across knowledge base
 * - kag_ask - RAG-based question answering
 * - kag_get_entity - Get entity details
 * - kag_create_entities - Create new knowledge entities
 * - kag_create_relations - Create relations between entities
 * - kag_add_observations - Add observations to entities
 * - kag_delete_entities - Delete entities
 * - kag_delete_relations - Delete relations
 * - kag_read_graph - Read entire knowledge graph
 * - kag_index - Trigger repository indexing
 * - kag_stats - Get knowledge base statistics
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getKAGService } from '../kag/KAGService.js';
import { getTokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js';
import logger from '../../utils/logger.js';

/**
 * KAG Memory MCP Server
 */
class KAGMemoryServer {
  constructor() {
    this.server = new Server(
      {
        name: 'kag-memory',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.kagService = null;
    this.setupHandlers();
  }

  /**
   * Initialize KAG service
   */
  async initializeKAG() {
    if (!this.kagService) {
      this.kagService = getKAGService();
      await this.kagService.initialize();
      logger.info('[KAG MCP] Service initialized', {
        entities: this.kagService.entities.size,
        relations: this.kagService.relations.size
      });
    }
  }

  /**
   * Setup MCP request handlers
   */
  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'kag_search',
            description: 'Search the knowledge base for entities matching a query. Returns ranked results with relevance scores.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query (keywords, phrases, or questions)',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 10)',
                  default: 10,
                },
                minScore: {
                  type: 'number',
                  description: 'Minimum relevance score (0-1, default: 0.3)',
                  default: 0.3,
                },
                entityTypes: {
                  type: 'array',
                  description: 'Filter by entity types (Issue, PullRequest, File, Documentation, etc.)',
                  items: { type: 'string' },
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'kag_ask',
            description: 'Ask a question about the project using RAG (Retrieval Augmented Generation). Returns AI-generated answer with source attribution.',
            inputSchema: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description: 'Question to ask about the project',
                },
                maxSources: {
                  type: 'number',
                  description: 'Maximum number of sources to retrieve (default: 5)',
                  default: 5,
                },
                minScore: {
                  type: 'number',
                  description: 'Minimum relevance score for sources (default: 0.3)',
                  default: 0.3,
                },
                temperature: {
                  type: 'number',
                  description: 'AI temperature for answer generation (0-1, default: 0.2)',
                  default: 0.2,
                },
                conversationHistory: {
                  type: 'array',
                  description: 'Previous conversation messages for context',
                  items: {
                    type: 'object',
                    properties: {
                      role: { type: 'string', enum: ['user', 'assistant'] },
                      content: { type: 'string' },
                    },
                  },
                },
                entityTypes: {
                  type: 'array',
                  description: 'Filter sources by entity types (e.g., ["ontology_concept"] for БПЛА ontology)',
                  items: { type: 'string' },
                },
              },
              required: ['question'],
            },
          },
          {
            name: 'kag_get_entity',
            description: 'Get detailed information about a specific entity in the knowledge graph.',
            inputSchema: {
              type: 'object',
              properties: {
                entityId: {
                  type: 'string',
                  description: 'Entity ID (e.g., "issue_123", "pr_456")',
                },
              },
              required: ['entityId'],
            },
          },
          {
            name: 'kag_create_entities',
            description: 'Create new entities in the knowledge graph.',
            inputSchema: {
              type: 'object',
              properties: {
                entities: {
                  type: 'array',
                  description: 'Array of entities to create',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Entity name' },
                      entityType: { type: 'string', description: 'Entity type (e.g., Concept, Feature, Task)' },
                      observations: {
                        type: 'array',
                        description: 'Array of observations/notes about this entity',
                        items: { type: 'string' },
                      },
                    },
                    required: ['name', 'entityType', 'observations'],
                  },
                },
              },
              required: ['entities'],
            },
          },
          {
            name: 'kag_create_relations',
            description: 'Create relations between entities in the knowledge graph.',
            inputSchema: {
              type: 'object',
              properties: {
                relations: {
                  type: 'array',
                  description: 'Array of relations to create',
                  items: {
                    type: 'object',
                    properties: {
                      from: { type: 'string', description: 'Source entity name' },
                      to: { type: 'string', description: 'Target entity name' },
                      relationType: { type: 'string', description: 'Relation type (e.g., implements, uses, fixes)' },
                    },
                    required: ['from', 'to', 'relationType'],
                  },
                },
              },
              required: ['relations'],
            },
          },
          {
            name: 'kag_add_observations',
            description: 'Add observations to existing entities.',
            inputSchema: {
              type: 'object',
              properties: {
                observations: {
                  type: 'array',
                  description: 'Array of observations to add',
                  items: {
                    type: 'object',
                    properties: {
                      entityName: { type: 'string', description: 'Entity name' },
                      contents: {
                        type: 'array',
                        description: 'Array of observation strings',
                        items: { type: 'string' },
                      },
                    },
                    required: ['entityName', 'contents'],
                  },
                },
              },
              required: ['observations'],
            },
          },
          {
            name: 'kag_delete_entities',
            description: 'Delete entities from the knowledge graph.',
            inputSchema: {
              type: 'object',
              properties: {
                entityNames: {
                  type: 'array',
                  description: 'Array of entity names to delete',
                  items: { type: 'string' },
                },
              },
              required: ['entityNames'],
            },
          },
          {
            name: 'kag_delete_relations',
            description: 'Delete relations from the knowledge graph.',
            inputSchema: {
              type: 'object',
              properties: {
                relations: {
                  type: 'array',
                  description: 'Array of relations to delete',
                  items: {
                    type: 'object',
                    properties: {
                      from: { type: 'string' },
                      to: { type: 'string' },
                      relationType: { type: 'string' },
                    },
                    required: ['from', 'to', 'relationType'],
                  },
                },
              },
              required: ['relations'],
            },
          },
          {
            name: 'kag_read_graph',
            description: 'Read the entire knowledge graph. Returns all entities and relations.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'kag_index',
            description: 'Trigger indexing of repository content to update the knowledge base.',
            inputSchema: {
              type: 'object',
              properties: {
                includeIssues: { type: 'boolean', description: 'Include GitHub issues', default: true },
                includePRs: { type: 'boolean', description: 'Include pull requests', default: true },
                includeCode: { type: 'boolean', description: 'Include code files', default: false },
                includeDocs: { type: 'boolean', description: 'Include documentation', default: true },
                maxIssues: { type: 'number', description: 'Maximum issues to index', default: 100 },
                maxPRs: { type: 'number', description: 'Maximum PRs to index', default: 100 },
              },
            },
          },
          {
            name: 'kag_stats',
            description: 'Get statistics about the knowledge base.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // Execute tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        await this.initializeKAG();

        switch (name) {
          case 'kag_search':
            return await this.handleSearch(args);
          case 'kag_ask':
            return await this.handleAsk(args);
          case 'kag_get_entity':
            return await this.handleGetEntity(args);
          case 'kag_create_entities':
            return await this.handleCreateEntities(args);
          case 'kag_create_relations':
            return await this.handleCreateRelations(args);
          case 'kag_add_observations':
            return await this.handleAddObservations(args);
          case 'kag_delete_entities':
            return await this.handleDeleteEntities(args);
          case 'kag_delete_relations':
            return await this.handleDeleteRelations(args);
          case 'kag_read_graph':
            return await this.handleReadGraph(args);
          case 'kag_index':
            return await this.handleIndex(args);
          case 'kag_stats':
            return await this.handleStats(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`[KAG MCP] Error executing ${name}`, {
          error: error.message,
          stack: error.stack,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: error.message,
                  tool: name,
                  arguments: args,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Handle kag_search tool
   */
  async handleSearch(args) {
    const { query, limit = 10, minScore = 0.3, entityTypes } = args;

    const results = await this.kagService.search(query, {
      limit,
      minScore,
      entityTypes,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              query,
              results: results.map((r) => ({
                id: r.id,
                type: r.type,
                name: r.name,
                score: r.score,
                properties: r.properties,
                observations: r.observations?.slice(0, 3), // First 3 observations
              })),
              count: results.length,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Handle kag_ask tool (RAG)
   */
  async handleAsk(args) {
    const {
      question,
      maxSources = 5,
      minScore = 0.3,
      temperature = 0.2,
      conversationHistory = [],
      entityTypes = null,
    } = args;

    // Get LLM coordinator (works without DB — uses virtual token with free KodaAgent)
    const llmCoordinator = getTokenBasedLLMCoordinator();

    // Use KAG service's answerQuestion method
    const result = await this.kagService.answerQuestion(question, {
      llmCoordinator,
      accessToken: 'system_mcp',
      modelId: null, // auto-detect: KodaAgent → OpenCode fallback
      maxSources,
      minScore,
      temperature,
      maxTokens: 2000,
      conversationHistory,
      entityTypes,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              question,
              answer: result.answer,
              sources: result.sources.map((s) => ({
                id: s.id,
                type: s.type,
                name: s.name,
                score: s.score,
                url: s.properties?.url,
              })),
              usage: result.usage,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Handle kag_get_entity tool
   */
  async handleGetEntity(args) {
    const { entityId } = args;

    const entity = this.kagService.entities.get(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    // Get relations
    const allRelations = this.kagService.getRelations(entityId);
    const relations = {
      outgoing: allRelations.filter(r => r.from === entityId),
      incoming: allRelations.filter(r => r.to === entityId),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              entity: {
                id: entity.id,
                type: entity.type,
                name: entity.name,
                properties: entity.properties,
                observations: entity.observations,
              },
              relations,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Handle kag_create_entities tool
   */
  async handleCreateEntities(args) {
    const { entities } = args;

    const created = [];
    for (const entityData of entities) {
      const entityId = `${entityData.entityType.toLowerCase()}_${entityData.name.replace(/\s+/g, '_').substring(0, 50)}`;
      const entity = {
        id: entityId,
        name: entityData.name,
        type: entityData.entityType,
        observations: entityData.observations || [],
        properties: {},
      };
      this.kagService.addEntity(entity);
      created.push(entity);
      // Trigger embedding via backend HTTP API (persistent SQLiteVectorStore)
      const _port = process.env.PORT || 8082;
      fetch(`http://localhost:${_port}/api/kag/embed-entity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: entity.id })
      }).catch(() => {});
    }

    await this.kagService.saveKnowledgeGraph();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              created: created.map((e) => ({ id: e.id, name: e.name, type: e.type })),
              count: created.length,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Handle kag_create_relations tool
   */
  async handleCreateRelations(args) {
    const { relations } = args;

    const created = [];
    for (const relationData of relations) {
      const relation = {
        from: relationData.from,
        to: relationData.to,
        type: relationData.relationType,
      };
      this.kagService.addRelation(relation);
      created.push({
        id: `${relation.from}_${relation.type}_${relation.to}`,
        ...relation,
      });
    }

    await this.kagService.saveKnowledgeGraph();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              created: created.map((r) => ({
                id: r.id,
                from: r.from,
                to: r.to,
                type: r.type,
              })),
              count: created.length,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Handle kag_add_observations tool
   */
  async handleAddObservations(args) {
    const { observations } = args;

    const updated = [];
    for (const obs of observations) {
      // Find entity by name
      let entity = null;
      for (const e of this.kagService.entities.values()) {
        if (e.name === obs.entityName) {
          entity = e;
          break;
        }
      }
      if (!entity) {
        throw new Error(`Entity "${obs.entityName}" not found`);
      }
      entity.observations = [...new Set([...(entity.observations || []), ...obs.contents])];
      updated.push(entity);
      // Re-embed via backend HTTP API
      const _port2 = process.env.PORT || 8082;
      fetch(`http://localhost:${_port2}/api/kag/embed-entity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: entity.id })
      }).catch(() => {});
    }

    await this.kagService.saveKnowledgeGraph();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              updated: updated.map((e) => ({ id: e.id, name: e.name })),
              count: updated.length,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Handle kag_delete_entities tool
   */
  async handleDeleteEntities(args) {
    const { entityNames } = args;

    const deleted = [];
    for (const name of entityNames) {
      // Find entity by name and remove
      let entityId = null;
      for (const [id, e] of this.kagService.entities) {
        if (e.name === name) {
          entityId = id;
          break;
        }
      }
      if (entityId) {
        this.kagService.entities.delete(entityId);
        // Remove related relations
        for (const [relId, rel] of this.kagService.relations) {
          if (rel.from === entityId || rel.to === entityId) {
            this.kagService.relations.delete(relId);
          }
        }
        // Remove from vector store
        try { await this.kagService.vectorStore.deleteDocument(entityId); } catch(e) { /* ignore */ }
        deleted.push(name);
      }
    }

    await this.kagService.saveKnowledgeGraph();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              deleted,
              count: deleted.length,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Handle kag_delete_relations tool
   */
  async handleDeleteRelations(args) {
    const { relations } = args;

    const deleted = [];
    for (const relationData of relations) {
      const relId = `${relationData.from}_${relationData.relationType}_${relationData.to}`;
      if (this.kagService.relations.has(relId)) {
        this.kagService.relations.delete(relId);
        deleted.push(relationData);
      }
    }

    await this.kagService.saveKnowledgeGraph();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              deleted,
              count: deleted.length,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Handle kag_read_graph tool
   */
  async handleReadGraph(args) {
    const entities = Array.from(this.kagService.entities.values()).map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      properties: e.properties,
      observations: e.observations,
    }));

    const relations = Array.from(this.kagService.relations.values()).map((r) => ({
      id: r.id,
      from: r.from,
      to: r.to,
      type: r.type,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              entities,
              relations,
              stats: {
                totalEntities: entities.length,
                totalRelations: relations.length,
                entityTypes: [...new Set(entities.map((e) => e.type))],
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Handle kag_index tool
   */
  async handleIndex(args) {
    const {
      includeIssues = true,
      includePRs = true,
      includeCode = false,
      includeDocs = true,
      maxIssues = 100,
      maxPRs = 100,
    } = args;

    const results = await this.kagService.indexRepository({
      includeIssues,
      includePRs,
      includeCode,
      includeDocs,
      maxIssues,
      maxPRs,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              results,
              timestamp: new Date().toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Handle kag_stats tool
   */
  async handleStats(args) {
    const stats = this.kagService.getStats();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  /**
   * Start the MCP server
   */
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('[KAG MCP] Server started on stdio');
  }
}

/**
 * Main entry point
 */
async function main() {
  const server = new KAGMemoryServer();
  await server.start();
}

main().catch((error) => {
  console.error('Fatal error in KAG Memory MCP server:', error);
  process.exit(1);
});
