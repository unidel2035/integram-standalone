/**
 * KAG Memory MCP HTTP API Routes
 *
 * Provides HTTP endpoints for the KAG Memory MCP server,
 * allowing remote access to KAG knowledge base via HTTP instead of stdio.
 *
 * Endpoints:
 * - GET /api/mcp/kag/tools - List available MCP tools
 * - POST /api/mcp/kag/execute - Execute an MCP tool
 *
 * Issue #5126
 */

import express from 'express';
import logger from '../../utils/logger.js';
import { getKAGService } from '../../services/kag/KAGService.js';

/**
 * Create KAG Memory MCP HTTP routes
 */
export function createKAGMCPRoutes() {
  const router = express.Router();

  /**
   * GET /api/mcp/kag/tools
   * List all available MCP tools
   */
  router.get('/tools', async (req, res) => {
    try {
      const tools = [
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
      ];

      res.json({
        success: true,
        tools,
      });
    } catch (error) {
      logger.error('[KAG MCP HTTP] Error listing tools', {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to list tools',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/mcp/kag/execute
   * Execute an MCP tool
   */
  router.post('/execute', async (req, res) => {
    const { toolName, arguments: args } = req.body;

    if (!toolName) {
      return res.status(400).json({
        success: false,
        error: 'Missing toolName parameter',
      });
    }

    try {
      const kagService = getKAGService();
      await kagService.initialize();

      let result;

      switch (toolName) {
        case 'kag_search':
          result = await handleSearch(kagService, args);
          break;
        case 'kag_ask':
          result = await handleAsk(kagService, args);
          break;
        case 'kag_get_entity':
          result = await handleGetEntity(kagService, args);
          break;
        case 'kag_create_entities':
          result = await handleCreateEntities(kagService, args);
          break;
        case 'kag_create_relations':
          result = await handleCreateRelations(kagService, args);
          break;
        case 'kag_add_observations':
          result = await handleAddObservations(kagService, args);
          break;
        case 'kag_delete_entities':
          result = await handleDeleteEntities(kagService, args);
          break;
        case 'kag_delete_relations':
          result = await handleDeleteRelations(kagService, args);
          break;
        case 'kag_read_graph':
          result = await handleReadGraph(kagService, args);
          break;
        case 'kag_index':
          result = await handleIndex(kagService, args);
          break;
        case 'kag_stats':
          result = await handleStats(kagService, args);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: `Unknown tool: ${toolName}`,
          });
      }

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      logger.error(`[KAG MCP HTTP] Error executing ${toolName}`, {
        error: error.message,
        stack: error.stack,
        args,
      });

      res.status(500).json({
        success: false,
        error: 'Tool execution failed',
        message: error.message,
        tool: toolName,
      });
    }
  });

  return router;
}

/**
 * Tool handlers (same logic as in kag-memory-server.js)
 */

async function handleSearch(kagService, args) {
  const { query, limit = 10, minScore = 0.3, entityTypes } = args;

  const results = await kagService.search(query, {
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
              observations: r.observations?.slice(0, 3),
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

async function handleAsk(kagService, args) {
  const {
    question,
    maxSources = 5,
    minScore = 0.3,
    temperature = 0.2,
    conversationHistory = [],
  } = args;

  const result = await kagService.answerQuestion(question, {
    accessToken: 'system_default',
    modelId: 'system_default',
    maxSources,
    minScore,
    temperature,
    maxTokens: 2000,
    conversationHistory,
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

async function handleGetEntity(kagService, args) {
  const { entityId } = args;

  const entity = kagService.entities.get(entityId);
  if (!entity) {
    throw new Error(`Entity not found: ${entityId}`);
  }

  const relations = kagService.getEntityRelations(entityId);

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
            relations: {
              outgoing: relations.outgoing,
              incoming: relations.incoming,
            },
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleCreateEntities(kagService, args) {
  const { entities } = args;

  const created = [];
  for (const entityData of entities) {
    const entity = await kagService.createEntity(
      entityData.name,
      entityData.entityType,
      entityData.observations
    );
    created.push(entity);
  }

  await kagService.saveKnowledgeGraph();

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

async function handleCreateRelations(kagService, args) {
  const { relations } = args;

  const created = [];
  for (const relationData of relations) {
    const relation = await kagService.createRelation(
      relationData.from,
      relationData.to,
      relationData.relationType
    );
    created.push(relation);
  }

  await kagService.saveKnowledgeGraph();

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

async function handleAddObservations(kagService, args) {
  const { observations } = args;

  const updated = [];
  for (const obs of observations) {
    const entity = await kagService.addObservations(obs.entityName, obs.contents);
    updated.push(entity);
  }

  await kagService.saveKnowledgeGraph();

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

async function handleDeleteEntities(kagService, args) {
  const { entityNames } = args;

  const deleted = [];
  for (const name of entityNames) {
    await kagService.deleteEntity(name);
    deleted.push(name);
  }

  await kagService.saveKnowledgeGraph();

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

async function handleDeleteRelations(kagService, args) {
  const { relations } = args;

  const deleted = [];
  for (const relationData of relations) {
    await kagService.deleteRelation(
      relationData.from,
      relationData.to,
      relationData.relationType
    );
    deleted.push(relationData);
  }

  await kagService.saveKnowledgeGraph();

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

async function handleReadGraph(kagService, args) {
  const entities = Array.from(kagService.entities.values()).map((e) => ({
    id: e.id,
    type: e.type,
    name: e.name,
    properties: e.properties,
    observations: e.observations,
  }));

  const relations = Array.from(kagService.relations.values()).map((r) => ({
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

async function handleIndex(kagService, args) {
  const {
    includeIssues = true,
    includePRs = true,
    includeCode = false,
    includeDocs = true,
    maxIssues = 100,
    maxPRs = 100,
  } = args;

  const results = await kagService.indexRepository({
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

async function handleStats(kagService, args) {
  const stats = await kagService.getStatistics();

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(stats, null, 2),
      },
    ],
  };
}
