/**
 * FST KAG Memory MCP HTTP API Routes
 *
 * Dedicated clean KAG instance for the FST (Venture Fund) project.
 * Uses a separate SQLite database at /data/kag-fst/kag.sqlite
 * so it's not polluted by the main DronDoc project data.
 *
 * Endpoints:
 * - GET /api/mcp/kag-fst/tools
 * - POST /api/mcp/kag-fst/execute
 */

import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';
import KAGStorageIntegram from '../../services/kag/KAGStorageIntegram.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FST_DB_PATH = path.join(__dirname, '../../../data/kag/kag.sqlite');

let fstStorage = null;
async function getFstStorage() {
  if (!fstStorage) {
    fstStorage = new KAGStorageIntegram({ dbPath: FST_DB_PATH });
    await fstStorage.initialize();
  }
  return fstStorage;
}

function genId(prefix = 'e') {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

const FST_TOOLS = [
  { name: 'kag_search', description: 'Search FST knowledge base', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] } },
  { name: 'kag_ask', description: 'Ask question against FST knowledge base', inputSchema: { type: 'object', properties: { question: { type: 'string' }, limit: { type: 'number' } }, required: ['question'] } },
  { name: 'kag_get_entity', description: 'Get entity by ID', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'kag_create_entities', description: 'Create entities in FST KAG', inputSchema: { type: 'object', properties: { entities: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, entityType: { type: 'string' }, observations: { type: 'array', items: { type: 'string' } } }, required: ['name', 'entityType'] } } }, required: ['entities'] } },
  { name: 'kag_create_relations', description: 'Create relations between entities', inputSchema: { type: 'object', properties: { relations: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, relationType: { type: 'string' } }, required: ['from', 'to', 'relationType'] } } }, required: ['relations'] } },
  { name: 'kag_add_observations', description: 'Add observations to entities', inputSchema: { type: 'object', properties: { observations: { type: 'array', items: { type: 'object', properties: { entityName: { type: 'string' }, contents: { type: 'array', items: { type: 'string' } } }, required: ['entityName', 'contents'] } } }, required: ['observations'] } },
  { name: 'kag_delete_entities', description: 'Delete entities by name', inputSchema: { type: 'object', properties: { entityNames: { type: 'array', items: { type: 'string' } } }, required: ['entityNames'] } },
  { name: 'kag_delete_relations', description: 'Delete relations', inputSchema: { type: 'object', properties: { relations: { type: 'array' } }, required: ['relations'] } },
  { name: 'kag_read_graph', description: 'Read FST knowledge graph', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'kag_stats', description: 'Get FST KAG statistics', inputSchema: { type: 'object', properties: {} } },
];

export function createKAGFstMCPRoutes() {
  const router = express.Router();

  router.get('/tools', (req, res) => res.json({ tools: FST_TOOLS }));

  router.post('/execute', async (req, res) => {
    const { toolName, arguments: args = {} } = req.body;
    if (!toolName) return res.status(400).json({ success: false, error: 'Missing toolName' });

    try {
      const s = await getFstStorage();
      let result;

      switch (toolName) {
        case 'kag_search': {
          const rows = s.search(args.query, args.limit || 10);
          result = { content: [{ type: 'text', text: JSON.stringify({ query: args.query, results: rows, count: rows.length }, null, 2) }] };
          break;
        }

        case 'kag_ask': {
          const rows = s.search(args.question, args.limit || 5);
          const context = rows.map(e => `${e.name} (${e.type}): ${(e.observations || []).slice(0, 3).join('; ')}`).join('\n');
          result = { content: [{ type: 'text', text: JSON.stringify({ question: args.question, context, entities: rows }, null, 2) }] };
          break;
        }

        case 'kag_get_entity': {
          const entity = s.getEntity(args.id);
          if (!entity) throw new Error(`Entity not found: ${args.id}`);
          result = { content: [{ type: 'text', text: JSON.stringify(entity, null, 2) }] };
          break;
        }

        case 'kag_create_entities': {
          const created = [];
          for (const e of (args.entities || [])) {
            const id = genId('e');
            s.addEntity({ id, name: e.name, type: e.entityType, observations: e.observations || [], properties: e.properties || {} });
            created.push({ id, name: e.name, type: e.entityType });
          }
          result = { content: [{ type: 'text', text: JSON.stringify({ created, count: created.length }, null, 2) }] };
          break;
        }

        case 'kag_create_relations': {
          const created = [];
          for (const r of (args.relations || [])) {
            // find entity IDs by name
            const fromResults = s.search(r.from, 1);
            const toResults = s.search(r.to, 1);
            const fromId = fromResults[0]?.id || r.from;
            const toId = toResults[0]?.id || r.to;
            const id = genId('r');
            s.addRelation({ id, from: fromId, to: toId, from_id: fromId, to_id: toId, type: r.relationType, properties: {} });
            created.push({ id, from: r.from, to: r.to, type: r.relationType });
          }
          result = { content: [{ type: 'text', text: JSON.stringify({ created, count: created.length }, null, 2) }] };
          break;
        }

        case 'kag_add_observations': {
          const updated = [];
          for (const obs of (args.observations || [])) {
            const found = s.find('entities', {}, { limit: 1000 }).find(e => e.name === obs.entityName);
            if (found) {
              const newObs = [...(found.observations || []), ...(obs.contents || [])];
              s.update('entities', found.id, { observations: newObs });
              updated.push(obs.entityName);
            }
          }
          result = { content: [{ type: 'text', text: JSON.stringify({ updated, count: updated.length }, null, 2) }] };
          break;
        }

        case 'kag_delete_entities': {
          const deleted = [];
          for (const name of (args.entityNames || [])) {
            const found = s.find('entities', {}, { limit: 1000 }).find(e => e.name === name);
            if (found) { s.delete('entities', found.id); deleted.push(name); }
          }
          result = { content: [{ type: 'text', text: JSON.stringify({ deleted, count: deleted.length }, null, 2) }] };
          break;
        }

        case 'kag_delete_relations': {
          const deleted = [];
          for (const r of (args.relations || [])) {
            const found = s.find('relations', {}, { limit: 1000 }).find(rel =>
              (rel.from_id === r.from || rel.from === r.from) &&
              (rel.to_id === r.to || rel.to === r.to) &&
              rel.type === r.relationType
            );
            if (found) { s.delete('relations', found.id); deleted.push(r); }
          }
          result = { content: [{ type: 'text', text: JSON.stringify({ deleted, count: deleted.length }, null, 2) }] };
          break;
        }

        case 'kag_read_graph': {
          const limit = args.limit || 100;
          const entities = s.find('entities', {}, { limit });
          const relations = s.find('relations', {}, { limit });
          result = { content: [{ type: 'text', text: JSON.stringify({ entities, relations, entityCount: entities.length, relationCount: relations.length }, null, 2) }] };
          break;
        }

        case 'kag_stats': {
          const stats = s.getStats ? s.getStats() : {};
          result = { content: [{ type: 'text', text: JSON.stringify({ project: 'FST Venture Fund', dbPath: FST_DB_PATH, ...stats }, null, 2) }] };
          break;
        }

        default:
          return res.status(400).json({ success: false, error: `Unknown tool: ${toolName}` });
      }

      res.json({ success: true, result });
    } catch (error) {
      logger.error(`[KAG-FST] ${toolName} failed`, { error: error.message });
      res.status(500).json({ success: false, error: error.message, tool: toolName });
    }
  });

  return router;
}
