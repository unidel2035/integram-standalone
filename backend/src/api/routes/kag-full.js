/**
 * KAG (Knowledge Augmented Generation) API Routes
 *
 * Provides endpoints for the project knowledge base:
 * - Repository indexing
 * - Knowledge graph queries
 * - RAG-based question answering
 * - Statistics and management
 *
 * Issue #5005
 */

import express from 'express';
import logger from '../../utils/logger.js';
import { getKAGService } from '../../services/kag/KAGService.js';

/**
 * Lazy initialization middleware
 * Ensures KAG service is initialized only when routes are accessed
 */
async function ensureKAGInitialized(req, res, next) {
  try {
    const kagService = getKAGService();
    await kagService.initialize();
    req.kagService = kagService;
    next();
  } catch (error) {
    logger.error('Failed to initialize KAG service', {
      error: error.message,
      stack: error.stack,
      code: error.code
    });

    // Provide helpful error messages based on error type
    let userMessage = error.message;
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      userMessage = `Missing dependency: ${error.message}. Please run 'npm install' in backend/monolith directory.`;
    } else if (error.message.includes('ENOENT')) {
      userMessage = `File or directory not found: ${error.message}. Check KAG data directory configuration.`;
    } else if (error.message.includes('API key')) {
      userMessage = `API configuration error: ${error.message}. Check DEEPSEEK_API_KEY, OPENAI_API_KEY, or POLZA_AI_API_KEY environment variable.`;
    }

    res.status(503).json({
      success: false,
      error: 'KAG service initialization failed',
      message: userMessage,
      details: process.env.NODE_ENV === 'development' ? {
        originalError: error.message,
        code: error.code,
        stack: error.stack
      } : undefined
    });
  }
}

/**
 * Create KAG routes
 */
export function createKAGRoutes() {
  const router = express.Router();

  /**
   * GET /api/kag/health
   * Health check endpoint (doesn't require initialization)
   *
   * Response:
   * {
   *   success: boolean
   *   status: 'healthy' | 'unhealthy'
   *   checks: {
   *     dependencies: boolean
   *     config: boolean
   *     initialization: boolean
   *   }
   *   message?: string
   * }
   */
  router.get('/health', async (req, res) => {
    const checks = {
      dependencies: false,
      config: false,
      initialization: false
    };
    const issues = [];

    try {
      // Check 1: Dependencies
      try {
        await import('@octokit/rest');
        checks.dependencies = true;
      } catch (error) {
        issues.push(`Missing dependency: ${error.message}`);
      }

      // Check 2: Configuration (Issue #5097: Added POLZA_AI_API_KEY support)
      const hasApiKey = !!(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.POLZA_AI_API_KEY);
      const hasGithubToken = !!process.env.GITHUB_TOKEN;
      checks.config = hasApiKey; // GitHub token is optional
      if (!hasApiKey) {
        issues.push('No AI API key configured (DEEPSEEK_API_KEY, OPENAI_API_KEY, or POLZA_AI_API_KEY)');
      }
      if (!hasGithubToken) {
        issues.push('No GitHub token configured (GITHUB_TOKEN) - API rate limits will apply');
      }

      // Check 3: Initialization
      try {
        console.log('[KAG Health] Getting KAG service...');
        const kagService = getKAGService();
        console.log('[KAG Health] Calling initialize...');
        await kagService.initialize();
        console.log('[KAG Health] Initialize completed successfully');
        checks.initialization = true;
      } catch (error) {
        console.log('[KAG Health] Initialize FAILED:', error.message);
        console.log('[KAG Health] Error stack:', error.stack);
        issues.push(`Initialization failed: ${error.message}`);
      }

      const allHealthy = Object.values(checks).every(check => check);

      res.json({
        success: allHealthy,
        status: allHealthy ? 'healthy' : 'unhealthy',
        checks,
        issues: issues.length > 0 ? issues : undefined,
        message: allHealthy
          ? 'KAG service is operational'
          : 'KAG service has issues. See "issues" array for details.',
        debug: {
          timestamp: new Date().toISOString(),
          codeVersion: 'v5097-test-1'
        }
      });
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        checks,
        message: 'Health check encountered an error',
        error: error.message
      });
    }
  });

  /**
   * POST /api/kag/web-search
   * Lightweight Tavily web search for agent tools (no KAG init required).
   */
  router.post('/web-search', async (req, res) => {
    const { query, n = 4 } = req.body
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'query required' })
    }
    try {
      const { tavilyKeyRotator } = await import('../../services/TavilyKeyRotator.js')
      const data = await tavilyKeyRotator.search({
        query,
        max_results: Math.min(parseInt(n) || 4, 8),
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
      }, 15_000)
      const results = (data.results || []).map(r => ({
        title:   r.title,
        url:     r.url,
        snippet: (r.content || r.snippet || '').slice(0, 400),
        score:   r.score,
      }))
      res.json({ success: true, results, query })
    } catch (err) {
      logger.warn({ err: err.message }, '[web-search] Tavily error')
      res.status(500).json({ success: false, error: err.message })
    }
  })

  /**
   * POST /api/kag/drone-research
   * DroneResearch agent — independent of KAG initialization middleware.
   * Runs before ensureKAGInitialized so it works even without AI keys.
   */
  router.post('/drone-research', async (req, res) => {
    const { query, accessToken, modelId, tableId, database, maxResults, enrich } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, error: 'query is required' });
    }
    try {
      const { DroneResearchService } = await import('../../services/DroneResearchService.js');
      const service = new DroneResearchService();
      const result = await service.research(query, {
        accessToken: accessToken || '',
        modelId: modelId || 'kodacode/KodaAgent',
        tableId: tableId || null,
        database: database || 'kval',
        maxResults: Math.min(parseInt(maxResults) || 5, 20),
        enrich: enrich !== false,
      });
      res.json(result);
    } catch (err) {
      logger.error('DroneResearch failed', { error: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/kag/embeddings
   * Generate embeddings for arbitrary texts (used by frontend semantic cache/ontology)
   * Placed BEFORE ensureKAGInitialized — uses EmbeddingService directly
   */
  router.post('/embeddings', async (req, res) => {
    try {
      const { texts } = req.body;
      if (!Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({ error: 'texts array required' });
      }
      const { getEmbeddingService } = await import('../../services/kag/EmbeddingService.js');
      const embService = getEmbeddingService();
      const embeddings = await embService.embedBatch(texts.slice(0, 20));
      res.json({ embeddings });
    } catch (error) {
      logger.error('Failed to generate text embeddings', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // Apply lazy initialization middleware to all other routes
  router.use(ensureKAGInitialized);

  /**
   * POST /api/kag/index
   * Start repository indexing
   *
   * Request body:
   * {
   *   includeIssues?: boolean (default: true)
   *   includePRs?: boolean (default: true)
   *   includeCode?: boolean (default: true)
   *   includeDocs?: boolean (default: true)
   *   maxIssues?: number (default: 100)
   *   maxPRs?: number (default: 100)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   results: {
   *     issues: number
   *     prs: number
   *     files: number
   *     entities: number
   *     relations: number
   *     errors: Array<string>
   *   }
   * }
   */
  router.post('/index', async (req, res) => {
    const kagService = req.kagService;
    try {
      logger.info('Starting KAG indexing', { options: req.body });

      const results = await kagService.indexRepository(req.body);

      res.json({
        success: true,
        results
      });
    } catch (error) {
      logger.error('KAG indexing failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to index repository',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/search
   * Search the knowledge base
   *
   * Request body:
   * {
   *   query: string - Search query
   *   limit?: number (default: 10)
   *   entityTypes?: Array<string> - Filter by entity types
   *   minScore?: number (default: 0.3)
   *   mode?: 'hybrid' | 'keyword' | 'semantic' (default: 'hybrid')
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   results: Array<{
   *     entity: Object
   *     score: number
   *     id: string
   *     sources?: Array<'keyword' | 'semantic'> (in hybrid mode)
   *   }>
   *   mode: string
   * }
   */
  router.post('/search', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { query, ...options } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Query is required and must be a string'
        });
      }

      // Validate mode if provided
      const mode = options.mode || 'hybrid';
      if (!['hybrid', 'keyword', 'semantic'].includes(mode)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid search mode. Must be one of: hybrid, keyword, semantic'
        });
      }

      logger.info('KAG search', { query, mode, options });

      const results = await kagService.search(query, { ...options, mode });

      res.json({
        success: true,
        results,
        mode
      });
    } catch (error) {
      logger.error('KAG search failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/entity/:entityId
   * Get entity by ID
   *
   * Response:
   * {
   *   success: boolean
   *   entity: Object | null
   *   relations: Array<Object>
   * }
   */
  router.get('/entity/:entityId', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { entityId } = req.params;

      const entity = kagService.getEntity(entityId);

      if (!entity) {
        return res.status(404).json({
          success: false,
          error: 'Entity not found'
        });
      }

      const relations = kagService.getRelations(entityId);

      res.json({
        success: true,
        entity,
        relations
      });
    } catch (error) {
      logger.error('Failed to get entity', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get entity',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/filter-options
   * Get available filter options (authors, labels, states)
   *
   * Response:
   * {
   *   success: boolean
   *   options: {
   *     authors: Array<string>
   *     labels: Array<string>
   *     states: Array<string>
   *   }
   * }
   */
  router.get('/filter-options', async (req, res) => {
    try {
      await kagService.initialize();

      const options = kagService.getFilterOptions();

      res.json({
        success: true,
        options
      });
    } catch (error) {
      logger.error('Failed to get filter options', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get filter options',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/stats
   * Get knowledge graph statistics
   *
   * Response:
   * {
   *   success: boolean
   *   stats: {
   *     totalEntities: number
   *     totalRelations: number
   *     entityTypes: Object
   *     relationTypes: Object
   *   }
   * }
   */
  router.get('/stats', async (req, res) => {
    const kagService = req.kagService;
    logger.info('[KAG ROUTE] /stats endpoint called');
    try {
      const stats = kagService.getStats();
      logger.info('[KAG ROUTE] Got stats', { stats });

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('[KAG ROUTE] Error', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/graph
   * Get graph data for visualization (nodes + links).
   * Supports pagination and filtering by type.
   *
   * Query params:
   *   - type: filter by entity type (e.g. 'UAV', 'Manufacturer')
   *   - limit: max nodes (default 500, max 2000)
   *   - offset: pagination offset
   *   - search: text search in entity names
   *   - includeRelations: 'true' (default) to include relations
   */
  router.get('/graph', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { type, limit: limitStr, offset: offsetStr, search, includeRelations } = req.query;
      const limit = Math.min(Number(limitStr) || 500, 2000);
      const offset = Number(offsetStr) || 0;
      const withRelations = includeRelations !== 'false';

      const storage = kagService.storage;
      let entities;
      let links = [];

      if (storage && storage.initialized && storage.db) {
        const db = storage.db;

        if (search) {
          entities = storage.searchFTS(search, limit + offset);
          entities = entities.slice(offset, offset + limit);
        } else if (type) {
          entities = storage.find('entities', { type }, { limit, offset });
        } else {
          // ===== BFS Snowball Sampling =====
          // Pick seeds (most connected), then expand via relations for a DENSE subgraph
          const seedCount = Math.min(Math.ceil(limit * 0.15), 75); // 15% seeds

          // Step 1: Pick seeds — most connected entities, balanced across types
          const typeRows = db.prepare(`
            SELECT type, COUNT(*) as cnt FROM entities GROUP BY type ORDER BY cnt DESC
          `).all();
          const totalTypes = typeRows.length || 1;
          const seedPerType = Math.max(2, Math.ceil(seedCount / totalTypes));

          const seedIds = new Set();
          for (const row of typeRows) {
            if (seedIds.size >= seedCount) break;
            const budget = Math.min(seedPerType, row.cnt, seedCount - seedIds.size);
            const rows = db.prepare(`
              SELECT e.id FROM entities e
              LEFT JOIN (
                SELECT from_id as eid, COUNT(*) as rc FROM relations GROUP BY from_id
                UNION ALL
                SELECT to_id as eid, COUNT(*) as rc FROM relations GROUP BY to_id
              ) rc ON rc.eid = e.id
              WHERE e.type = ?
              ORDER BY COALESCE(rc.rc, 0) DESC
              LIMIT ?
            `).all(row.type, budget);
            for (const r of rows) seedIds.add(r.id);
          }

          // Step 2: BFS expansion — follow relations from seeds
          // Cap per type: allow up to 30% of limit for any single type
          const maxPerType = Math.max(20, Math.ceil(limit * 0.3));
          const typeCap = {};
          for (const id of seedIds) {
            // Count seed types
            const row = db.prepare('SELECT type FROM entities WHERE id = ?').get(id);
            if (row) typeCap[row.type] = (typeCap[row.type] || 0) + 1;
          }

          db.exec('CREATE TEMP TABLE IF NOT EXISTS _bfs_ids (id TEXT PRIMARY KEY)');
          db.exec('DELETE FROM _bfs_ids');
          const insertId = db.prepare('INSERT OR IGNORE INTO _bfs_ids VALUES (?)');
          const insertMany = db.transaction((ids) => { for (const id of ids) insertId.run(id); });
          insertMany(Array.from(seedIds));

          let bfsCollected = seedIds.size;

          // BFS rounds (up to 3 hops)
          for (let hop = 0; hop < 3 && bfsCollected < limit; hop++) {
            const candidates = db.prepare(`
              SELECT e.id, e.type FROM entities e
              WHERE e.id NOT IN (SELECT id FROM _bfs_ids)
                AND e.id IN (
                  SELECT r.to_id FROM relations r INNER JOIN _bfs_ids b ON r.from_id = b.id
                  UNION
                  SELECT r.from_id FROM relations r INNER JOIN _bfs_ids b ON r.to_id = b.id
                )
              LIMIT ?
            `).all((limit - bfsCollected) * 3); // fetch extra for type filtering

            const accepted = [];
            for (const c of candidates) {
              if (bfsCollected >= limit) break;
              const currentCount = typeCap[c.type] || 0;
              if (currentCount >= maxPerType) continue; // skip over-represented types
              typeCap[c.type] = currentCount + 1;
              accepted.push(c.id);
              bfsCollected++;
            }
            if (accepted.length > 0) {
              insertMany(accepted);
            } else {
              break; // no more candidates pass the type filter
            }
          }

          // Step 2.5: Fallback — if BFS didn't fill the limit, add entities respecting type cap
          const bfsCount = db.prepare('SELECT COUNT(*) as cnt FROM _bfs_ids').get()?.cnt || 0;
          if (bfsCount < limit) {
            const fillRows = db.prepare(`
              SELECT e.id, e.type FROM entities e
              WHERE e.id NOT IN (SELECT id FROM _bfs_ids)
              ORDER BY (SELECT COUNT(*) FROM relations r WHERE r.from_id = e.id OR r.to_id = e.id) DESC
              LIMIT ?
            `).all((limit - bfsCount) * 3);
            const accepted = [];
            for (const r of fillRows) {
              if (accepted.length >= limit - bfsCount) break;
              const cnt = typeCap[r.type] || 0;
              if (cnt >= maxPerType) continue;
              typeCap[r.type] = cnt + 1;
              accepted.push(r.id);
            }
            if (accepted.length > 0) insertMany(accepted);

            // If STILL under limit, do uncapped fill
            const afterCapped = db.prepare('SELECT COUNT(*) as cnt FROM _bfs_ids').get()?.cnt || 0;
            if (afterCapped < limit) {
              const uncapped = db.prepare(`
                SELECT e.id FROM entities e
                WHERE e.id NOT IN (SELECT id FROM _bfs_ids)
                ORDER BY (SELECT COUNT(*) FROM relations r WHERE r.from_id = e.id OR r.to_id = e.id) DESC
                LIMIT ?
              `).all(limit - afterCapped);
              if (uncapped.length > 0) insertMany(uncapped.map(r => r.id));
            }
          }

          // Step 3: Fetch full entity rows for all BFS nodes
          const allRows = db.prepare(`
            SELECT e.*,
              (SELECT COUNT(*) FROM relations r WHERE r.from_id = e.id OR r.to_id = e.id) as rel_count
            FROM entities e
            INNER JOIN _bfs_ids b ON e.id = b.id
          `).all();

          entities = allRows.map(row => {
            const relCount = row.rel_count || 0;
            const e = storage._deserializeRow('entities', row);
            e.rel_count = relCount;
            return e;
          });

          // Step 4: Get ALL relations between selected nodes (dense subgraph)
          if (withRelations) {
            const relRows = db.prepare(`
              SELECT r.* FROM relations r
              INNER JOIN _bfs_ids s ON r.from_id = s.id
              INNER JOIN _bfs_ids t ON r.to_id = t.id
              LIMIT 20000
            `).all();
            links = relRows.map(r => ({
              source: r.from_id,
              target: r.to_id,
              type: r.type || 'related',
              id: r.id,
            }));
          }

          db.exec('DROP TABLE IF EXISTS _bfs_ids');
        }

        // For search/type modes, still need to deserialize + find links
        if (search || type) {
          if (!Array.isArray(entities)) entities = [];
          entities = entities.map(row => {
            if (row.rel_count !== undefined) {
              const relCount = row.rel_count || 0;
              const e = storage._deserializeRow ? storage._deserializeRow('entities', row) : row;
              e.rel_count = relCount;
              return e;
            }
            return row;
          });

          if (withRelations && links.length === 0) {
            const nodeIds = new Set(entities.map(e => e.id));
            const idList = Array.from(nodeIds);
            db.exec('CREATE TEMP TABLE IF NOT EXISTS _graph_ids (id TEXT PRIMARY KEY)');
            db.exec('DELETE FROM _graph_ids');
            const ins = db.prepare('INSERT OR IGNORE INTO _graph_ids VALUES (?)');
            const insTx = db.transaction((ids) => { for (const id of ids) ins.run(id); });
            insTx(idList);

            const relRows = db.prepare(`
              SELECT r.* FROM relations r
              INNER JOIN _graph_ids s ON r.from_id = s.id
              INNER JOIN _graph_ids t ON r.to_id = t.id
              LIMIT 10000
            `).all();
            links = relRows.map(r => ({
              source: r.from_id,
              target: r.to_id,
              type: r.type || 'related',
              id: r.id,
            }));
            db.exec('DROP TABLE IF EXISTS _graph_ids');
          }
        }
      } else {
        // Fallback to in-memory
        let arr = Array.from(kagService.entities.values());
        if (type) arr = arr.filter(e => e.type === type);
        if (search) {
          const q = search.toLowerCase();
          arr = arr.filter(e => e.name && e.name.toLowerCase().includes(q));
        }
        entities = arr.slice(offset, offset + limit);
      }

      if (!Array.isArray(entities)) entities = [];

      // Build nodes
      const nodeIds = new Set(entities.map(e => e.id));
      const nodes = entities.map(e => ({
        id: e.id,
        label: e.name || e.id,
        type: e.type || 'unknown',
        description: (e.observations || []).slice(0, 2).join('; ').substring(0, 200),
        properties: e.properties || {},
        source: e.source || e.properties?.source || '',
        relCount: e.rel_count || 0,
      }));

      // In-memory fallback for relations
      if (withRelations && links.length === 0 && !(storage && storage.initialized && storage.db)) {
        const relations = Array.from(kagService.relations.values());
        links = relations
          .filter(r => nodeIds.has(r.from || r.from_id) && nodeIds.has(r.to || r.to_id))
          .map(r => ({
            source: r.from || r.from_id,
            target: r.to || r.to_id,
            type: r.type || 'related',
            id: r.id,
          }));
      }

      // Type summary
      const typeCounts = {};
      for (const n of nodes) {
        typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
      }

      // Relation type summary
      const relationTypeCounts = {};
      for (const l of links) {
        relationTypeCounts[l.type] = (relationTypeCounts[l.type] || 0) + 1;
      }

      // Get total counts from storage
      const dbTotalEntities = storage?.initialized
        ? (storage.db.prepare('SELECT COUNT(*) as cnt FROM entities').get()?.cnt || 0)
        : kagService.entities.size;
      const dbTotalRelations = storage?.initialized
        ? (storage.db.prepare('SELECT COUNT(*) as cnt FROM relations').get()?.cnt || 0)
        : kagService.relations.size;

      res.json({
        success: true,
        data: {
          nodes,
          links,
          totalEntities: dbTotalEntities,
          totalRelations: dbTotalRelations,
          displayedEntities: nodes.length,
          displayedRelations: links.length,
          typeCounts,
          relationTypeCounts,
          limit,
          offset,
        },
      });
    } catch (error) {
      logger.error('[KAG Graph] Error', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/kag/export/mcp
   * Export knowledge graph to MCP Memory format
   *
   * Response:
   * {
   *   success: boolean
   *   data: {
   *     entities: Array
   *     relations: Array
   *   }
   * }
   */
  router.post('/export/mcp', async (req, res) => {
    const kagService = req.kagService;
    try {
      const data = kagService.exportToMCPMemory();

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error('Failed to export to MCP', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to export',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/embeddings/generate
   * Generate embeddings for all entities
   *
   * Response:
   * {
   *   success: boolean
   *   count: number - Number of embeddings generated
   * }
   */
  router.post('/embeddings/generate', async (req, res) => {
    const kagService = req.kagService;
    try {
      logger.info('Generating embeddings for all entities');

      const count = await kagService.generateAllEmbeddings();

      res.json({
        success: true,
        count
      });
    } catch (error) {
      logger.error('Failed to generate embeddings', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to generate embeddings',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/embeddings/stats
   * Get embedding and vector store statistics
   *
   * Response:
   * {
   *   success: boolean
   *   stats: {
   *     vectorStore: Object
   *     embeddingCache: Object
   *   }
   * }
   */

  /**
   * POST /api/kag/reindex-vectors
   * Generate embeddings for all entities that don't have one yet.
   * Run this once after switching to SQLiteVectorStore.
   */
  /**
   * POST /api/kag/embed-entity
   * Generate and store embedding for a specific entity by ID.
   * Used by MCP server to index entities added via stdio transport.
   */
  router.post('/embed-entity', async (req, res) => {
    const kagService = req.kagService;
    const { entityId } = req.body || {};
    if (!entityId) return res.status(400).json({ success: false, error: 'entityId required' });
    try {
      await kagService.initialize();
      // Look up entity: first in-memory Map, then SQLite storage
      let entity = kagService.entities.get(entityId);
      if (!entity && kagService.storage && kagService.storage.initialized) {
        entity = kagService.storage.getEntity(entityId);
        if (entity) {
          // Sync into in-memory map
          kagService.entities.set(entityId, entity);
        }
      }
      if (!entity) return res.status(404).json({ success: false, error: 'Entity not found: ' + entityId });
      await kagService.generateEntityEmbedding(entity);
      const count = await kagService.vectorStore.count();
      res.json({ success: true, entityId, vectorCount: count });
    } catch (error) {
      logger.error('embed-entity failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/reindex-vectors', async (req, res) => {
    const kagService = req.kagService;
    try {
      await kagService.initialize();
      const { force = false, source = null, limit = 5000, types = null } = req.body || {};
      let allEntities = Array.from(kagService.entities.values());
      // Filter by source/type if requested
      if (source) allEntities = allEntities.filter(e => e.source === source);
      if (types && Array.isArray(types)) allEntities = allEntities.filter(e => types.includes(e.type));
      const entities = allEntities.slice(0, limit);
      let indexed = 0;
      let skipped = 0;
      let errors = 0;
      for (const entity of entities) {
        try {
          const existing = await kagService.vectorStore.getDocument(entity.id);
          if (existing && !force) { skipped++; continue; }
          await kagService.generateEntityEmbedding(entity);
          indexed++;
        } catch (e) {
          errors++;
        }
      }
      const stats = await kagService.vectorStore.getStats();
      res.json({ success: true, indexed, skipped, errors, total: entities.length, vectorStore: stats });
    } catch (error) {
      logger.error('reindex-vectors failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });
  router.get('/embeddings/stats', async (req, res) => {
    const kagService = req.kagService;
    try {
      const vectorStoreStats = await kagService.vectorStore.getStats();
      const cacheStats = kagService.embeddingService.getCacheStats();

      res.json({
        success: true,
        stats: {
          vectorStore: vectorStoreStats,
          embeddingCache: cacheStats
        }
      });
    } catch (error) {
      logger.error('Failed to get embedding stats', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
        message: error.message
      });
    }
  });

  /**
   * DELETE /api/kag/embeddings/clear
   * Clear embedding cache and vector store
   *
   * Response:
   * {
   *   success: boolean
   *   message: string
   * }
   */
  router.delete('/embeddings/clear', async (req, res) => {
    const kagService = req.kagService;
    try {
      logger.info('Clearing embeddings and vector store');

      await kagService.embeddingService.clearCache();
      await kagService.vectorStore.clear();

      res.json({
        success: true,
        message: 'Embeddings and vector store cleared successfully'
      });
    } catch (error) {
      logger.error('Failed to clear embeddings', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to clear embeddings',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/answer
   * RAG-based question answering
   *
   * Request body:
   * {
   *   question: string - The question to answer
   *   accessToken: string - AI access token
   *   modelId: string - AI model ID
   *   maxSources?: number (default: 5) - Max number of sources to retrieve
   *   minScore?: number (default: 0.3) - Minimum relevance score
   *   temperature?: number (default: 0.2) - LLM temperature
   *   maxTokens?: number (default: 2000) - Max tokens in response
   *   conversationHistory?: Array<{role, content}> - Previous messages
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   answer: string
   *   sources: Array<{id, type, name, score, url}>
   *   usage: Object - Token usage stats
   *   metadata: Object - RAG metadata
   * }
   */
  router.post('/answer', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { question, accessToken, modelId, learn, ...options } = req.body;

      if (!question || typeof question !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Question is required and must be a string'
        });
      }

      if (!accessToken || !modelId) {
        return res.status(400).json({
          success: false,
          error: 'Access token and model ID are required'
        });
      }

      logger.info('KAG RAG answer request', { question, modelId, learn, options });

      // Get LLM coordinator
      const { getTokenBasedLLMCoordinator } = await import('../../core/TokenBasedLLMCoordinator.js');
      const llmCoordinator = getTokenBasedLLMCoordinator();

      // Call RAG pipeline
      const result = await kagService.answerQuestion(question, {
        llmCoordinator,
        accessToken,
        modelId,
        ...options
      });

      // Auto-learn: extract knowledge from Q+A (Issue #7043)
      if (learn && result.success && result.answer) {
        try {
          const learnText = `Вопрос: ${question}\nОтвет: ${result.answer}`;
          const extracted = await kagService.extractKnowledge(learnText, {
            llmCoordinator, accessToken, modelId, source: 'rag_chat'
          });
          result.learned = {
            entities: extracted.entities.length,
            relations: extracted.relations.length
          };
        } catch (learnErr) {
          logger.warn('[KAG RAG] Auto-learn failed (non-critical)', { error: learnErr.message });
          result.learned = { error: learnErr.message };
        }
      }

      res.json(result);
    } catch (error) {
      logger.error('KAG RAG answer failed', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: 'Failed to answer question',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/history/file/:filePath
   * Get commit history for a specific file
   *
   * Response:
   * {
   *   success: boolean
   *   history: Array<{
   *     commit: Object
   *     date: string
   *     author: string
   *     message: string
   *     changes: Object
   *   }>
   * }
   */

  /**
   * POST /api/kag/learn
   * Extract knowledge from text using LLM and save to KAG (Issue #7043)
   *
   * Request body:
   * {
   *   text: string - Text to extract knowledge from
   *   accessToken: string - AI access token
   *   modelId: string - AI model ID
   *   source?: string - Source label (default: 'extraction')
   * }
   */
  router.post('/learn', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { text, accessToken, modelId, source } = req.body;

      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Text is required and must be a string'
        });
      }

      if (!accessToken || !modelId) {
        return res.status(400).json({
          success: false,
          error: 'Access token and model ID are required'
        });
      }

      const { getTokenBasedLLMCoordinator } = await import('../../core/TokenBasedLLMCoordinator.js');
      const llmCoordinator = getTokenBasedLLMCoordinator();

      const result = await kagService.extractKnowledge(text, {
        llmCoordinator,
        accessToken,
        modelId,
        source: source || 'extraction'
      });

      res.json({
        success: true,
        entities: result.entities,
        relations: result.relations,
        usage: result.usage
      });
    } catch (error) {
      logger.error('[KAG Learn] Extraction failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Knowledge extraction failed',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/ingest-url
   * Load a URL into KAG with optional LLM enrichment (Issue #7043)
   *
   * Request body:
   * {
   *   url: string - URL to ingest
   *   accessToken?: string - AI token (for LLM enrichment)
   *   modelId?: string - AI model ID (for LLM enrichment)
   *   enrich?: boolean - Enable LLM-based deep extraction (default: false)
   * }
   */
  router.post('/ingest-url', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { url, accessToken, modelId, enrich } = req.body;

      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return res.status(400).json({
          success: false,
          error: 'A valid URL starting with http/https is required'
        });
      }

      // Use URLConnector to fetch and parse
      const { URLConnector } = await import('../../parsers/connectors/URLConnector.js');
      const connector = new URLConnector();
      const result = await connector.run(url);

      // LLM enrichment if requested
      let enrichment = null;
      if (enrich && accessToken && modelId) {
        try {
          const { getTokenBasedLLMCoordinator } = await import('../../core/TokenBasedLLMCoordinator.js');
          const llmCoordinator = getTokenBasedLLMCoordinator();

          // Get the parsed content for LLM extraction
          const parsed = await connector.parse(url);
          enrichment = await kagService.extractKnowledge(parsed.content, {
            llmCoordinator,
            accessToken,
            modelId,
            source: 'url_enrichment'
          });
        } catch (enrichErr) {
          logger.warn('[KAG Ingest] LLM enrichment failed (non-critical)', { error: enrichErr.message });
          enrichment = { error: enrichErr.message };
        }
      }

      res.json({
        success: true,
        ingested: {
          url,
          discovered: result.discovered,
          parsed: result.parsed,
          entitiesAdded: result.entitiesAdded,
          relationsAdded: result.relationsAdded,
          errors: result.errors
        },
        enrichment: enrichment ? {
          entities: enrichment.entities?.length || 0,
          relations: enrichment.relations?.length || 0,
          usage: enrichment.usage
        } : null
      });
    } catch (error) {
      logger.error('[KAG Ingest] URL ingestion failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'URL ingestion failed',
        message: error.message
      });
    }
  });

  router.get('/history/file/*filePath', async (req, res) => {
    const kagService = req.kagService;
    try {
      // Extract file path from wildcard parameter
      const filePath = req.params.filePath;

      if (!filePath) {
        return res.status(400).json({
          success: false,
          error: 'File path is required'
        });
      }

      const history = kagService.getFileHistory(filePath);

      res.json({
        success: true,
        filePath,
        history
      });
    } catch (error) {
      logger.error('Failed to get file history', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get file history',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/history/modifier/:entityId
   * Get last modifier for an entity
   *
   * Response:
   * {
   *   success: boolean
   *   modifier: Object | null
   * }
   */
  router.get('/history/modifier/:entityId', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { entityId } = req.params;

      const modifier = kagService.getLastModifier(entityId);

      if (!modifier) {
        return res.status(404).json({
          success: false,
          error: 'No modification history found'
        });
      }

      res.json({
        success: true,
        entityId,
        modifier
      });
    } catch (error) {
      logger.error('Failed to get last modifier', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get last modifier',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/history/changes
   * Get file changes with filters
   *
   * Request body:
   * {
   *   filePath: string
   *   since?: string (ISO date)
   *   until?: string (ISO date)
   *   author?: string
   *   limit?: number
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   changes: Array
   * }
   */
  router.post('/history/changes', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { filePath, ...options } = req.body;

      if (!filePath) {
        return res.status(400).json({
          success: false,
          error: 'File path is required'
        });
      }

      const changes = kagService.getFileChanges(filePath, options);

      res.json({
        success: true,
        filePath,
        options,
        changes
      });
    } catch (error) {
      logger.error('Failed to get file changes', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get file changes',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/history/issue/:issueNumber
   * Get commits that fixed/referenced an issue
   *
   * Response:
   * {
   *   success: boolean
   *   commits: Array
   * }
   */
  router.get('/history/issue/:issueNumber', async (req, res) => {
    const kagService = req.kagService;
    try {
      const issueNumber = parseInt(req.params.issueNumber);

      if (isNaN(issueNumber)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid issue number'
        });
      }

      const commits = kagService.getCommitsForIssue(issueNumber);

      res.json({
        success: true,
        issueNumber,
        commits
      });
    } catch (error) {
      logger.error('Failed to get commits for issue', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get commits for issue',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/history/feature/:keyword
   * Track feature development history by keyword
   *
   * Response:
   * {
   *   success: boolean
   *   commits: Array
   * }
   */
  router.get('/history/feature/:keyword', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { keyword } = req.params;

      if (!keyword) {
        return res.status(400).json({
          success: false,
          error: 'Keyword is required'
        });
      }

      const commits = kagService.getFeatureDevelopmentHistory(keyword);

      res.json({
        success: true,
        keyword,
        commits
      });
    } catch (error) {
      logger.error('Failed to get feature development history', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feature development history',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/history/user/:userIdentifier
   * Get commit statistics for a user
   *
   * Response:
   * {
   *   success: boolean
   *   stats: Object
   * }
   */
  router.get('/history/user/:userIdentifier', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { userIdentifier } = req.params;

      if (!userIdentifier) {
        return res.status(400).json({
          success: false,
          error: 'User identifier is required'
        });
      }

      const stats = kagService.getUserCommitStats(userIdentifier);

      res.json({
        success: true,
        userIdentifier,
        stats
      });
    } catch (error) {
      logger.error('Failed to get user commit stats', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get user commit stats',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/webhook
   * GitHub webhook endpoint for auto-indexing
   *
   * Headers:
   * - X-GitHub-Event: Event type (push, pull_request, issues, issue_comment)
   * - X-Hub-Signature-256: HMAC SHA-256 signature
   * - X-GitHub-Delivery: Delivery ID
   *
   * Response:
   * {
   *   success: boolean
   *   queued?: boolean
   *   jobId?: string
   *   event?: string
   * }
   */
  router.post('/webhook', async (req, res) => {
    try {
      // Import webhook service
      const { getWebhookService } = await import('../../services/kag/WebhookService.js');
      const webhookService = getWebhookService();

      // Get GitHub headers
      const event = req.headers['x-github-event'];
      const signature = req.headers['x-hub-signature-256'];
      const deliveryId = req.headers['x-github-delivery'];

      if (!event) {
        return res.status(400).json({
          success: false,
          error: 'Missing X-GitHub-Event header'
        });
      }

      // Verify webhook signature
      const payload = JSON.stringify(req.body);
      const isValid = webhookService.verifySignature(payload, signature);

      if (!isValid) {
        logger.warn('[KAG Webhook] Invalid signature', { event, deliveryId });
        return res.status(401).json({
          success: false,
          error: 'Invalid webhook signature'
        });
      }

      // Handle webhook
      const result = await webhookService.handleWebhook(event, req.body, deliveryId);

      res.json(result);
    } catch (error) {
      logger.error('[KAG Webhook] Webhook handling failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/webhook/stats
   * Get webhook processing statistics
   *
   * Response:
   * {
   *   success: boolean
   *   stats: Object
   * }
   */
  router.get('/webhook/stats', async (req, res) => {
    try {
      const { getWebhookService } = await import('../../services/kag/WebhookService.js');
      const webhookService = getWebhookService();

      const stats = await webhookService.getStats();

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      logger.error('[KAG Webhook] Failed to get webhook stats', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/webhook/retry/:jobId
   * Retry a failed webhook job
   *
   * Response:
   * {
   *   success: boolean
   *   jobId: string
   * }
   */
  router.post('/webhook/retry/:jobId', async (req, res) => {
    try {
      const { getWebhookQueue } = await import('../../services/kag/WebhookQueue.js');
      const webhookQueue = getWebhookQueue();

      const { jobId } = req.params;
      await webhookQueue.retryJob(jobId);

      res.json({
        success: true,
        jobId,
        message: 'Job retry queued'
      });
    } catch (error) {
      logger.error('[KAG Webhook] Failed to retry job', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retry job',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/export/json
   * Export knowledge graph to JSON format
   *
   * Query parameters:
   * - includeMetadata: boolean (default: true)
   * - includeEmbeddings: boolean (default: false)
   *
   * Response: JSON file download
   */
  router.get('/export/json', async (req, res) => {
    try {
      await kagService.initialize();

      const options = {
        includeMetadata: req.query.includeMetadata !== 'false',
        includeEmbeddings: req.query.includeEmbeddings === 'true'
      };

      const data = kagService.exportToJSON(options);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="kag-export-${Date.now()}.json"`);

      res.json(data);
    } catch (error) {
      logger.error('[KAG Export] JSON export failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to export to JSON',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/export/csv
   * Export knowledge graph to CSV format (entities and relations)
   *
   * Response: ZIP file with entities.csv and relations.csv
   */
  router.get('/export/csv', async (req, res) => {
    try {
      await kagService.initialize();

      const data = kagService.exportToCSV();

      // Return as JSON with both CSV files
      // Frontend can download them separately or create a ZIP
      res.json({
        success: true,
        data: {
          entities: data.entities,
          relations: data.relations,
          metadata: data.metadata
        }
      });
    } catch (error) {
      logger.error('[KAG Export] CSV export failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to export to CSV',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/export/graphml
   * Export knowledge graph to GraphML format
   *
   * Response: GraphML XML file download
   */
  router.get('/export/graphml', async (req, res) => {
    try {
      await kagService.initialize();

      const graphml = kagService.exportToGraphML();

      // Set headers for file download
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="kag-export-${Date.now()}.graphml"`);

      res.send(graphml);
    } catch (error) {
      logger.error('[KAG Export] GraphML export failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to export to GraphML',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/import/json
   * Import knowledge graph from JSON format
   *
   * Request body:
   * {
   *   data: Object - JSON data to import
   *   mode?: 'merge' | 'replace' (default: 'merge')
   *   validate?: boolean (default: true)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   stats: Object - Import statistics
   *   metadata?: Object - Original metadata
   * }
   */
  router.post('/import/json', async (req, res) => {
    try {
      const { data, mode = 'merge', validate = true } = req.body;

      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Data is required'
        });
      }

      logger.info('[KAG Import] Starting JSON import', { mode, validate });

      const result = await kagService.importFromJSON(data, { mode, validate });

      res.json(result);
    } catch (error) {
      logger.error('[KAG Import] JSON import failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to import from JSON',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/import/csv
   * Import knowledge graph from CSV format
   *
   * Request body:
   * {
   *   entities: string - Entities CSV content
   *   relations: string - Relations CSV content
   *   mode?: 'merge' | 'replace' (default: 'merge')
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   stats: Object - Import statistics
   * }
   */
  router.post('/import/csv', async (req, res) => {
    try {
      const { entities, relations, mode = 'merge' } = req.body;

      if (!entities && !relations) {
        return res.status(400).json({
          success: false,
          error: 'At least one of entities or relations CSV is required'
        });
      }

      logger.info('[KAG Import] Starting CSV import', { mode });

      const result = await kagService.importFromCSV({ entities, relations }, { mode });

      res.json(result);
    } catch (error) {
      logger.error('[KAG Import] CSV import failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to import from CSV',
        message: error.message
      });
    }
  });

  // Test endpoint for VectorStore debugging
  router.get('/test-vector', async (req, res) => {
    try {
      const { getVectorStore } = await import('../../services/kag/VectorStore.js');
      const vs = getVectorStore();
      await vs.initialize();
      const stats = await vs.getStats();
      res.json({
        success: true,
        stats,
        useInMemory: vs.useInMemory,
        initialized: vs.initialized
      });
    } catch (error) {
      res.json({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  });

  // Health endpoint removed - using detailed health check at line 79 instead

  /**
   * GET /api/kag/versions
   * List all knowledge graph snapshots
   *
   * Response:
   * {
   *   success: boolean
   *   snapshots: Array<{id, timestamp, metadata}>
   *   current: string
   * }
   */
  router.get('/versions', async (req, res) => {
    try {
      await kagService.initialize();

      const snapshots = kagService.versionManager.listSnapshots();
      const current = kagService.versionManager.getCurrentVersion();

      res.json({
        success: true,
        snapshots,
        current
      });
    } catch (error) {
      logger.error('Failed to list versions', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to list versions',
        message: error.message
      });
    }
  });

  /**
   * GET /api/kag/versions/:snapshotId
   * Get a specific snapshot
   *
   * Response:
   * {
   *   success: boolean
   *   snapshot: Object
   * }
   */
  router.get('/versions/:snapshotId', async (req, res) => {
    try {
      await kagService.initialize();

      const { snapshotId } = req.params;
      const snapshot = await kagService.versionManager.getSnapshot(snapshotId);

      if (!snapshot) {
        return res.status(404).json({
          success: false,
          error: 'Snapshot not found'
        });
      }

      res.json({
        success: true,
        snapshot
      });
    } catch (error) {
      logger.error('Failed to get snapshot', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get snapshot',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/versions/diff
   * Compute diff between two snapshots
   *
   * Request body:
   * {
   *   from: string - Source snapshot ID
   *   to: string - Target snapshot ID
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   diff: Object
   * }
   */
  router.post('/versions/diff', async (req, res) => {
    try {
      await kagService.initialize();

      const { from, to } = req.body;

      if (!from || !to) {
        return res.status(400).json({
          success: false,
          error: 'Both "from" and "to" snapshot IDs are required'
        });
      }

      const diff = await kagService.versionManager.computeDiff(from, to);

      res.json({
        success: true,
        diff
      });
    } catch (error) {
      logger.error('Failed to compute diff', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to compute diff',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/versions/:snapshotId/rollback
   * Rollback knowledge graph to a specific snapshot
   *
   * Request body:
   * {
   *   selective?: boolean (default: false)
   *   entityTypes?: Array<string> (required if selective=true)
   *   keepOther?: boolean (default: true, only with selective=true)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   snapshotId: string
   *   restoredData: Object
   * }
   */
  router.post('/versions/:snapshotId/rollback', async (req, res) => {
    try {
      await kagService.initialize();

      const { snapshotId } = req.params;
      const { selective = false, entityTypes = [], keepOther = true } = req.body;

      let restoredData;

      if (selective) {
        if (!entityTypes || entityTypes.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'entityTypes array is required for selective rollback'
          });
        }

        restoredData = await kagService.versionManager.selectiveRollback(
          snapshotId,
          { entityTypes, keepOther }
        );
      } else {
        restoredData = await kagService.versionManager.rollback(snapshotId);
      }

      // Apply restored data to current KG
      kagService.entities.clear();
      for (const entity of restoredData.entities) {
        kagService.entities.set(entity.id, entity);
      }

      kagService.relations.clear();
      for (const relation of restoredData.relations) {
        kagService.relations.set(relation.id, relation);
      }

      // Save the restored state
      await kagService.saveKnowledgeGraph();

      res.json({
        success: true,
        snapshotId,
        restoredData: {
          entitiesCount: restoredData.entities.length,
          relationsCount: restoredData.relations.length
        }
      });
    } catch (error) {
      logger.error('Failed to rollback', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to rollback',
        message: error.message
      });
    }
  });

  /**
   * DELETE /api/kag/versions/:snapshotId
   * Delete a specific snapshot
   *
   * Response:
   * {
   *   success: boolean
   *   snapshotId: string
   * }
   */
  router.delete('/versions/:snapshotId', async (req, res) => {
    try {
      await kagService.initialize();

      const { snapshotId } = req.params;
      await kagService.versionManager.deleteSnapshot(snapshotId);

      res.json({
        success: true,
        snapshotId
      });
    } catch (error) {
      logger.error('Failed to delete snapshot', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to delete snapshot',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/versions/create
   * Manually create a snapshot
   *
   * Request body:
   * {
   *   metadata?: Object - Additional metadata
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   snapshot: Object
   * }
   */
  router.post('/versions/create', async (req, res) => {
    try {
      await kagService.initialize();

      const { metadata = {} } = req.body;

      const data = {
        entities: Array.from(kagService.entities.values()),
        relations: Array.from(kagService.relations.values())
      };

      const snapshot = await kagService.versionManager.createSnapshot(data, {
        ...metadata,
        source: 'manual',
        stats: kagService.getStats()
      });

      res.json({
        success: true,
        snapshot
      });
    } catch (error) {
      logger.error('Failed to create snapshot', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to create snapshot',
        message: error.message
      });
    }
  });

  /**
   * POST /api/kag/observations
   * Add observations to existing entities (batch)
   *
   * Body: { observations: [{ entityName: "...", contents: ["obs1", "obs2"] }] }
   */
  router.post('/observations', async (req, res) => {
    const kagService = req.kagService;
    try {
      const { observations } = req.body;
      if (!observations || !Array.isArray(observations)) {
        return res.status(400).json({ success: false, error: 'observations array is required' });
      }

      const results = [];
      for (const { entityName, contents } of observations) {
        // Find entity by exact name or partial match
        let found = null;
        for (const [id, entity] of kagService.entities) {
          if (entity.name === entityName) { found = entity; break; }
        }
        // Fallback: partial match for ontology concepts
        if (!found) {
          for (const [id, entity] of kagService.entities) {
            if (entity.type === 'ontology_concept' && entity.name && entity.name.includes(entityName)) {
              found = entity; break;
            }
          }
        }
        if (!found) {
          results.push({ entityName, success: false, error: 'not found' });
          continue;
        }
        if (!found.observations) found.observations = [];
        found.observations.push(...(contents || []));
        results.push({ entityName, success: true, added: contents.length, matched: found.name });
      }

      res.json({ success: true, results, updated: results.filter(r => r.success).length });
    } catch (error) {
      logger.error('Failed to add observations', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ============================================================
  // DoubletStore + LinoFormat endpoints
  // ============================================================

  /**
   * GET /api/kag/doublets/:entityId
   * Дублеты для сущности (все связи через DoubletStore).
   */
  router.get('/doublets/:entityId', async (req, res) => {
    try {
      const kagService = req.kagService;
      if (!kagService.doubletStore) {
        return res.json({ success: true, doublets: [], message: 'DoubletStore not initialized' });
      }
      const doublets = kagService.doubletStore.getDoublets(req.params.entityId);
      const aliases = kagService.doubletStore.resolveAliases(req.params.entityId);
      res.json({ success: true, doublets, aliases });
    } catch (error) {
      logger.error('Failed to get doublets', { entityId: req.params.entityId, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/kag/doublets
   * Создать дублет.
   * Body: { source, target, kind?, data? }
   */
  router.post('/doublets', async (req, res) => {
    try {
      const kagService = req.kagService;
      if (!kagService.doubletStore) {
        return res.status(503).json({ success: false, error: 'DoubletStore not initialized' });
      }
      const { source, target, kind = 'same_as', data = {} } = req.body;
      if (!source || !target) {
        return res.status(400).json({ success: false, error: 'source and target are required' });
      }
      const id = kagService.doubletStore.createDoublet(source, target, kind, data);
      res.json({ success: true, id, source, target, kind });
    } catch (error) {
      logger.error('Failed to create doublet', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /api/kag/doublets/:id
   * Удалить дублет.
   */
  router.delete('/doublets/:id', async (req, res) => {
    try {
      const kagService = req.kagService;
      if (!kagService.doubletStore) {
        return res.status(503).json({ success: false, error: 'DoubletStore not initialized' });
      }
      const removed = kagService.doubletStore.removeDoublet(req.params.id);
      res.json({ success: true, removed });
    } catch (error) {
      logger.error('Failed to delete doublet', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/kag/export/lino
   * Экспорт в LinoFormat.
   * Query params: mode (extended | pure-lino), limit
   */
  router.get('/export/lino', async (req, res) => {
    try {
      const kagService = req.kagService;
      const mode = req.query.mode || 'extended';
      const limit = parseInt(req.query.limit) || 0;
      const text = kagService.exportToLino({ mode, limit });
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(text);
    } catch (error) {
      logger.error('Failed to export LinoFormat', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/kag/import/lino
   * Импорт из LinoFormat.
   * Body: { text } или raw text (Content-Type: text/plain)
   */
  router.post('/import/lino', async (req, res) => {
    try {
      const kagService = req.kagService;
      let text = '';
      if (typeof req.body === 'string') {
        text = req.body;
      } else if (req.body?.text) {
        text = req.body.text;
      }
      if (!text) {
        return res.status(400).json({ success: false, error: 'text is required' });
      }
      const result = await kagService.importFromLino(text);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Failed to import LinoFormat', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });


  /**
   * POST /api/kag/wikidata-import
   * Import UAV/drone models from Wikidata into Integram kval table.
   * Issue #7193: Wikidata Drone Import
   *
   * Body: { limit?: number, dryRun?: boolean }
   * - limit   (default 500): max records to fetch from Wikidata
   * - dryRun  (default false): if true, only report what would be imported
   *
   * Response: { total, toImport, sample } for dryRun=true
   *           { success, total, imported, skipped, tableId, tableUrl } for dryRun=false
   */
  router.post('/wikidata-import', async (req, res) => {
    const { limit = 500, dryRun = false } = req.body || {};
    try {
      const { WikidataDroneImporter } = await import('../../services/WikidataDroneImporter.js');
      const importer = new WikidataDroneImporter();
      const result = await importer.run({ limit: Number(limit), dryRun: Boolean(dryRun) });
      res.json(result);
    } catch (err) {
      logger.error('Wikidata import failed', { error: err.message, stack: err.stack });
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}


/**
 * Background job: auto-index entities in SQLite that have no embedding yet.
 * Runs every 2 minutes. Handles entities created via MCP stdio transport.
 */
export function startVectorAutoIndexJob(kagService, intervalMs = 120_000) {
  async function runOnce() {
    try {
      if (!kagService.initialized) return;
      const vectorStore = kagService.vectorStore;
      const storage = kagService.storage;
      if (!storage || !storage.initialized) return;

      // Get all entities from SQLite storage (not just in-memory map)
      const allEntities = storage.find('entities', {}, { limit: 50000 });
      let indexed = 0;
      for (const entity of allEntities) {
        const existing = await vectorStore.getDocument(entity.id);
        if (!existing) {
          try {
            await kagService.generateEntityEmbedding(entity);
            indexed++;
          } catch (e) { /* skip */ }
        }
      }
      if (indexed > 0) {
        logger.info('[VectorAutoIndex] Indexed new entities', { count: indexed });
      }
    } catch (e) {
      logger.error('[VectorAutoIndex] Error', { error: e.message });
    }
  }

  // Run immediately, then every intervalMs
  setTimeout(runOnce, 30_000); // 30s delay after startup
  setInterval(runOnce, intervalMs);
  logger.info('[VectorAutoIndex] Background indexer started', { intervalMs });
}
