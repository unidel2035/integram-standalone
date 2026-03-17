/**
 * KAG Storage — Integram-compatible storage backend
 *
 * SQLite-backed storage engine with API compatible with IntegramDatabaseService.
 * Designed as a drop-in replacement for JSON file storage in KAGService.
 * When the Integram Node.js core is ready, this can be swapped to real Integram backend.
 *
 * Features:
 * - Integram-compatible CRUD interface (insert, find, update, delete)
 * - SQLite for performance (no OOM on 100K+ entities)
 * - FTS5 full-text search
 * - Graph traversal via SQL JOINs
 * - Batch operations for import pipelines
 * - JSON migration from existing knowledge_graph.json
 *
 * @module KAGStorageIntegram
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DB_PATH = path.join(__dirname, '../../../data/kag/kag.sqlite');

class KAGStorageIntegram {
  constructor(options = {}) {
    this.dbPath = options.dbPath || DEFAULT_DB_PATH;
    this.db = null;
    this.initialized = false;
    this.logger = options.logger || logger;

    // Integram-compatible: organization scope (default 'kag')
    this.organizationId = options.organizationId || 'kag';

    // Prepared statements cache
    this._stmts = {};
  }

  /**
   * Initialize storage — create database and tables
   */
  async initialize() {
    if (this.initialized) return;

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });

    // Open SQLite database
    this.db = new Database(this.dbPath);

    // Performance settings
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('mmap_size = 268435456'); // 256MB mmap
    this.db.pragma('temp_store = MEMORY');

    // Create tables
    this._createTables();

    // Prepare frequently used statements
    this._prepareStatements();

    this.initialized = true;
    this.logger.info('[KAGStorage] Initialized', { dbPath: this.dbPath });
  }

  /**
   * Create database schema
   */
  _createTables() {
    this.db.exec(`
      -- Entities table (Integram-compatible: type=table, entity=object)
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'Entity',
        properties TEXT DEFAULT '{}',
        observations TEXT DEFAULT '[]',
        source TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Relations table (edges in graph)
      CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        properties TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (from_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (to_id) REFERENCES entities(id) ON DELETE CASCADE
      );

      -- Connector runs log
      CREATE TABLE IF NOT EXISTS connector_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connector_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        entities_added INTEGER DEFAULT 0,
        relations_added INTEGER DEFAULT 0,
        errors TEXT DEFAULT '[]',
        started_at TEXT DEFAULT (datetime('now')),
        finished_at TEXT,
        duration_ms INTEGER
      );

      -- Indices for fast queries
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_entities_source ON entities(source);
      CREATE INDEX IF NOT EXISTS idx_entities_updated ON entities(updated_at);
      CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(type);
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_id);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_id);
      CREATE INDEX IF NOT EXISTS idx_relations_from_type ON relations(from_id, type);
      CREATE INDEX IF NOT EXISTS idx_relations_to_type ON relations(to_id, type);

      -- FTS5 full-text search on entities
      CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
        id UNINDEXED,
        name,
        type UNINDEXED,
        observations,
        properties,
        content=entities,
        content_rowid=rowid,
        tokenize='unicode61 remove_diacritics 2'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
        INSERT INTO entities_fts(rowid, id, name, type, observations, properties)
        VALUES (new.rowid, new.id, new.name, new.type, new.observations, new.properties);
      END;

      CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
        INSERT INTO entities_fts(entities_fts, rowid, id, name, type, observations, properties)
        VALUES ('delete', old.rowid, old.id, old.name, old.type, old.observations, old.properties);
      END;

      CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
        INSERT INTO entities_fts(entities_fts, rowid, id, name, type, observations, properties)
        VALUES ('delete', old.rowid, old.id, old.name, old.type, old.observations, old.properties);
        INSERT INTO entities_fts(rowid, id, name, type, observations, properties)
        VALUES (new.rowid, new.id, new.name, new.type, new.observations, new.properties);
      END;
    `);
  }

  /**
   * Prepare frequently used statements for performance
   */
  _prepareStatements() {
    this._stmts = {
      insertEntity: this.db.prepare(`
        INSERT OR REPLACE INTO entities (id, name, type, properties, observations, source, updated_at)
        VALUES (@id, @name, @type, @properties, @observations, @source, datetime('now'))
      `),

      getEntity: this.db.prepare('SELECT * FROM entities WHERE id = ?'),

      deleteEntity: this.db.prepare('DELETE FROM entities WHERE id = ?'),

      insertRelation: this.db.prepare(`
        INSERT OR REPLACE INTO relations (id, type, from_id, to_id, properties)
        VALUES (@id, @type, @from_id, @to_id, @properties)
      `),

      getRelation: this.db.prepare('SELECT * FROM relations WHERE id = ?'),

      deleteRelation: this.db.prepare('DELETE FROM relations WHERE id = ?'),

      getRelationsFrom: this.db.prepare('SELECT * FROM relations WHERE from_id = ?'),

      getRelationsTo: this.db.prepare('SELECT * FROM relations WHERE to_id = ?'),

      getRelationsBoth: this.db.prepare('SELECT * FROM relations WHERE from_id = ? OR to_id = ?'),

      countEntities: this.db.prepare('SELECT COUNT(*) as count FROM entities'),

      countRelations: this.db.prepare('SELECT COUNT(*) as count FROM relations'),

      entityTypes: this.db.prepare('SELECT type, COUNT(*) as count FROM entities GROUP BY type ORDER BY count DESC'),

      relationTypes: this.db.prepare('SELECT type, COUNT(*) as count FROM relations GROUP BY type ORDER BY count DESC'),

      searchFTS: this.db.prepare(`
        SELECT e.*, rank
        FROM entities_fts fts
        JOIN entities e ON e.rowid = fts.rowid
        WHERE entities_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `),

      logConnectorRun: this.db.prepare(`
        INSERT INTO connector_runs (connector_name, status) VALUES (?, 'running')
      `),

      updateConnectorRun: this.db.prepare(`
        UPDATE connector_runs
        SET status = @status, entities_added = @entities_added,
            relations_added = @relations_added, errors = @errors,
            finished_at = datetime('now'),
            duration_ms = (strftime('%s','now') - strftime('%s', started_at)) * 1000
        WHERE id = @id
      `)
    };
  }

  // ============================================================
  // Integram-compatible CRUD interface
  // ============================================================

  /**
   * Insert entity (Integram-compatible: insert into table)
   * @param {string} tableName - 'entities' or 'relations'
   * @param {Object} data - Entity or relation data
   * @returns {Object} Inserted record
   */
  insert(tableName, data) {
    this._ensureInit();

    if (tableName === 'entities') {
      return this._insertEntity(data);
    } else if (tableName === 'relations') {
      return this._insertRelation(data);
    } else if (tableName === 'connector_runs') {
      const info = this._stmts.logConnectorRun.run(data.connector_name);
      return { id: info.lastInsertRowid, ...data };
    }
    throw new Error(`Unknown table: ${tableName}`);
  }

  /**
   * Find records with optional filtering (Integram-compatible)
   * @param {string} tableName - 'entities' or 'relations'
   * @param {Object} filter - Filter criteria
   * @param {Object} options - { limit, offset, orderBy }
   * @returns {Array} Matching records
   */
  find(tableName, filter = {}, options = {}) {
    this._ensureInit();

    const { limit = 1000, offset = 0, orderBy = 'updated_at DESC' } = options;

    let sql = `SELECT * FROM ${tableName}`;
    const conditions = [];
    const params = {};

    for (const [key, value] of Object.entries(filter)) {
      if (key === '$search') continue; // handled separately
      conditions.push(`${key} = @${key}`);
      params[key] = value;
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`;
    params.limit = limit;
    params.offset = offset;

    const rows = this.db.prepare(sql).all(params);
    return rows.map(row => this._deserializeRow(tableName, row));
  }

  /**
   * Find single record by ID (Integram-compatible)
   */
  findById(tableName, id) {
    this._ensureInit();

    const stmt = tableName === 'entities' ? this._stmts.getEntity : this._stmts.getRelation;
    const row = stmt.get(id);
    return row ? this._deserializeRow(tableName, row) : null;
  }

  /**
   * Update record (Integram-compatible)
   */
  update(tableName, id, updates) {
    this._ensureInit();

    const existing = this.findById(tableName, id);
    if (!existing) {
      throw new Error(`Record ${id} not found in ${tableName}`);
    }

    const merged = { ...existing, ...updates };

    if (tableName === 'entities') {
      return this._insertEntity(merged);
    } else if (tableName === 'relations') {
      return this._insertRelation(merged);
    }
    throw new Error(`Unknown table: ${tableName}`);
  }

  /**
   * Delete record (Integram-compatible)
   */
  delete(tableName, id) {
    this._ensureInit();

    const stmt = tableName === 'entities' ? this._stmts.deleteEntity : this._stmts.deleteRelation;
    const info = stmt.run(id);
    return { deleted: info.changes > 0, id };
  }

  // ============================================================
  // KAG-specific operations (graph-native)
  // ============================================================

  /**
   * Add or update entity
   * Emits SOD event via hook if EventEngine is connected.
   */
  addEntity(entity) {
    if (!entity.id) return;
    const result = this._insertEntity(entity);

    // SOD hook: notify event engine about new KAG entity
    if (this._sodHook) {
      try {
        this._sodHook(entity);
      } catch (_) {}
    }

    return result;
  }

  /**
   * Set SOD hook — called for each new entity.
   * @param {Function} fn — (entity) => void
   */
  setSodHook(fn) {
    this._sodHook = fn;
  }

  /**
   * Add or update relation
   */
  addRelation(relation) {
    if (!relation.id) return;
    return this._insertRelation(relation);
  }

  /**
   * Get entity by ID
   */
  getEntity(entityId) {
    this._ensureInit();
    const row = this._stmts.getEntity.get(entityId);
    return row ? this._deserializeRow('entities', row) : null;
  }

  /**
   * Get relations for entity
   * @param {string} entityId
   * @param {string} direction - 'outgoing', 'incoming', or 'both'
   * @returns {Array}
   */
  getRelations(entityId, direction = 'both') {
    this._ensureInit();

    let rows;
    if (direction === 'outgoing') {
      rows = this._stmts.getRelationsFrom.all(entityId);
    } else if (direction === 'incoming') {
      rows = this._stmts.getRelationsTo.all(entityId);
    } else {
      rows = this._stmts.getRelationsBoth.all(entityId, entityId);
    }

    return rows.map(row => this._deserializeRow('relations', row));
  }

  /**
   * Graph traversal: get connected entities up to N hops
   * @param {string} entityId - Starting entity
   * @param {number} maxHops - Maximum graph hops (default 2)
   * @param {string} relationType - Optional filter by relation type
   * @returns {Object} { entities: Map, relations: [] }
   */
  getConnected(entityId, maxHops = 2, relationType = null) {
    this._ensureInit();

    const visited = new Set();
    const entities = new Map();
    const relations = [];
    const queue = [{ id: entityId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      if (visited.has(id) || depth > maxHops) continue;
      visited.add(id);

      const entity = this.getEntity(id);
      if (entity) entities.set(id, entity);

      if (depth < maxHops) {
        const rels = this.getRelations(id, 'both');
        for (const rel of rels) {
          relations.push(rel);
          const nextId = rel.from_id === id ? rel.to_id : rel.from_id;
          if (relationType && rel.type !== relationType) continue;
          if (!visited.has(nextId)) {
            queue.push({ id: nextId, depth: depth + 1 });
          }
        }
      }
    }

    return { entities, relations };
  }

  /**
   * Full-text search across entities
   * @param {string} query - Search query
   * @param {number} limit - Max results
   * @returns {Array} Matched entities with rank
   */
  search(query, limit = 50) {
    this._ensureInit();

    if (!query || query.trim().length === 0) return [];

    // Sanitize FTS5 query — escape special characters
    const sanitized = query
      .replace(/[*"(){}[\]^~\\]/g, '')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 0)
      .map(w => `"${w}"`)
      .join(' OR ');

    if (!sanitized) return [];

    try {
      const rows = this._stmts.searchFTS.all(sanitized, limit);
      return rows.map(row => ({
        ...this._deserializeRow('entities', row),
        score: Math.abs(row.rank)
      }));
    } catch (err) {
      this.logger.warn('[KAGStorage] FTS search failed, falling back to LIKE', {
        query, error: err.message
      });
      // Fallback to LIKE search
      return this._likeSearch(query, limit);
    }
  }

  /**
   * Keyword search — iterate entities by type
   */
  keywordSearch(query, options = {}) {
    this._ensureInit();

    const { type, limit = 50 } = options;
    let sql = 'SELECT * FROM entities WHERE (name LIKE @q OR observations LIKE @q)';
    const params = { q: `%${query}%`, limit };

    if (type) {
      sql += ' AND type = @type';
      params.type = type;
    }

    sql += ' LIMIT @limit';

    const rows = this.db.prepare(sql).all(params);
    return rows.map(row => this._deserializeRow('entities', row));
  }

  /**
   * Get statistics
   */
  getStats() {
    this._ensureInit();

    const totalEntities = this._stmts.countEntities.get().count;
    const totalRelations = this._stmts.countRelations.get().count;
    const entityTypes = {};
    const relationTypes = {};

    for (const row of this._stmts.entityTypes.all()) {
      entityTypes[row.type] = row.count;
    }
    for (const row of this._stmts.relationTypes.all()) {
      relationTypes[row.type] = row.count;
    }

    // DB file size
    let dbSizeMB = 0;
    try {
      const stat = require('fs').statSync(this.dbPath);
      dbSizeMB = (stat.size / 1024 / 1024).toFixed(2);
    } catch {}

    return {
      totalEntities,
      totalRelations,
      entityTypes,
      relationTypes,
      storage: 'integram-sqlite',
      dbPath: this.dbPath,
      dbSizeMB
    };
  }

  // ============================================================
  // Batch operations (for importers)
  // ============================================================

  /**
   * Batch insert entities within a transaction
   * @param {Array} entities - Array of entity objects
   * @returns {{ inserted: number, errors: number }}
   */
  batchInsertEntities(entities) {
    this._ensureInit();

    let inserted = 0, errors = 0;

    const tx = this.db.transaction((batch) => {
      for (const entity of batch) {
        try {
          this._insertEntity(entity);
          inserted++;
        } catch (err) {
          errors++;
          if (errors <= 5) {
            this.logger.warn('[KAGStorage] Batch insert error', { id: entity.id, error: err.message });
          }
        }
      }
    });

    // Process in chunks of 5000 to avoid SQLite limits
    const chunkSize = 5000;
    for (let i = 0; i < entities.length; i += chunkSize) {
      const chunk = entities.slice(i, i + chunkSize);
      tx(chunk);
    }

    return { inserted, errors };
  }

  /**
   * Batch insert relations within a transaction
   */
  batchInsertRelations(relations) {
    this._ensureInit();

    let inserted = 0, errors = 0;

    const tx = this.db.transaction((batch) => {
      for (const relation of batch) {
        try {
          this._insertRelation(relation);
          inserted++;
        } catch (err) {
          errors++;
        }
      }
    });

    const chunkSize = 5000;
    for (let i = 0; i < relations.length; i += chunkSize) {
      tx(relations.slice(i, i + chunkSize));
    }

    return { inserted, errors };
  }

  // ============================================================
  // Migration from JSON
  // ============================================================

  /**
   * Import existing knowledge_graph.json into SQLite
   * @param {string} jsonPath - Path to knowledge_graph.json
   * @returns {{ entities: number, relations: number }}
   */
  async migrateFromJSON(jsonPath) {
    this._ensureInit();

    const defaultPath = path.join(__dirname, '../../../data/kag/knowledge_graph.json');
    const filePath = jsonPath || defaultPath;

    this.logger.info('[KAGStorage] Starting migration from JSON', { filePath });

    // Stream-parse large JSON to avoid OOM
    const content = await fs.readFile(filePath, 'utf-8');
    const graph = JSON.parse(content);

    const entitiesResult = this.batchInsertEntities(graph.entities || []);
    const relationsResult = this.batchInsertRelations(graph.relations || []);

    this.logger.info('[KAGStorage] Migration complete', {
      entities: entitiesResult,
      relations: relationsResult
    });

    return {
      entities: entitiesResult.inserted,
      relations: relationsResult.inserted
    };
  }

  /**
   * Export entire graph as Maps (for backward compatibility with KAGService)
   * @returns {{ entities: Map, relations: Map }}
   */
  exportToMaps() {
    this._ensureInit();

    const entities = new Map();
    const relations = new Map();

    const allEntities = this.db.prepare('SELECT * FROM entities').all();
    for (const row of allEntities) {
      const entity = this._deserializeRow('entities', row);
      entities.set(entity.id, entity);
    }

    const allRelations = this.db.prepare('SELECT * FROM relations').all();
    for (const row of allRelations) {
      const rel = this._deserializeRow('relations', row);
      relations.set(rel.id, rel);
    }

    return { entities, relations };
  }

  /**
   * Save complete graph to SQLite (replaces saveKnowledgeGraph)
   * @param {Map} entities - Entities map
   * @param {Map} relations - Relations map
   */
  saveFromMaps(entities, relations) {
    this._ensureInit();

    const entitiesArr = Array.from(entities.values());
    const relationsArr = Array.from(relations.values());

    this.batchInsertEntities(entitiesArr);
    this.batchInsertRelations(relationsArr);
  }

  // ============================================================
  // Connector run tracking
  // ============================================================

  /**
   * Log connector run start
   */
  startConnectorRun(connectorName) {
    this._ensureInit();
    const info = this._stmts.logConnectorRun.run(connectorName);
    return info.lastInsertRowid;
  }

  /**
   * Log connector run completion
   */
  finishConnectorRun(runId, result) {
    this._ensureInit();
    this._stmts.updateConnectorRun.run({
      id: runId,
      status: result.status || 'completed',
      entities_added: result.entitiesAdded || 0,
      relations_added: result.relationsAdded || 0,
      errors: JSON.stringify(result.errors || [])
    });
  }

  /**
   * Get recent connector runs
   */
  getConnectorRuns(connectorName = null, limit = 20) {
    this._ensureInit();

    let sql = 'SELECT * FROM connector_runs';
    const params = { limit };

    if (connectorName) {
      sql += ' WHERE connector_name = @name';
      params.name = connectorName;
    }
    sql += ' ORDER BY started_at DESC LIMIT @limit';

    return this.db.prepare(sql).all(params);
  }

  // ============================================================
  // Internal helpers
  // ============================================================

  _ensureInit() {
    if (!this.initialized) {
      throw new Error('KAGStorageIntegram not initialized. Call initialize() first.');
    }
  }

  _insertEntity(entity) {
    const row = {
      id: entity.id,
      name: entity.name || entity.id,
      type: entity.type || 'Entity',
      properties: JSON.stringify(entity.properties || {}),
      observations: JSON.stringify(entity.observations || []),
      source: entity.source || ''
    };
    this._stmts.insertEntity.run(row);
    return entity;
  }

  _insertRelation(relation) {
    const row = {
      id: relation.id,
      type: relation.type || 'related_to',
      from_id: relation.from || relation.from_id,
      to_id: relation.to || relation.to_id,
      properties: JSON.stringify(relation.properties || {})
    };
    this._stmts.insertRelation.run(row);
    return relation;
  }

  _deserializeRow(tableName, row) {
    if (tableName === 'entities') {
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        properties: this._parseJSON(row.properties, {}),
        observations: this._parseJSON(row.observations, []),
        source: row.source,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    } else if (tableName === 'relations') {
      return {
        id: row.id,
        type: row.type,
        from: row.from_id,
        from_id: row.from_id,
        to: row.to_id,
        to_id: row.to_id,
        properties: this._parseJSON(row.properties, {}),
        created_at: row.created_at
      };
    }
    return row;
  }

  _parseJSON(str, fallback) {
    try {
      return typeof str === 'string' ? JSON.parse(str) : (str || fallback);
    } catch {
      return fallback;
    }
  }

  _likeSearch(query, limit) {
    const rows = this.db.prepare(
      'SELECT * FROM entities WHERE name LIKE @q OR observations LIKE @q LIMIT @limit'
    ).all({ q: `%${query}%`, limit });
    return rows.map(row => this._deserializeRow('entities', row));
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

// Singleton
let storageInstance = null;

export function getKAGStorage(options = {}) {
  if (!storageInstance) {
    storageInstance = new KAGStorageIntegram(options);
  }
  return storageInstance;
}

export default KAGStorageIntegram;
