/**
 * SQLite-backed Vector Store
 *
 * Replaces ChromaDB in-memory fallback with persistent SQLite storage.
 * Stores embeddings as BLOB (Float32Array) directly in SQLite.
 * Uses cosine similarity for search — no external dependencies.
 *
 * @module SQLiteVectorStore
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DB_PATH = path.join(__dirname, '../../../data/kag/vectors.sqlite');

class SQLiteVectorStore {
  constructor(config = {}) {
    this.dbPath = config.dbPath || DEFAULT_DB_PATH;
    this.db = null;
    this.initialized = false;
    this.collectionName = config.collectionName || 'kag_embeddings';
    this.mode = 'SQLite';
  }

  async initialize() {
    if (this.initialized) return;

    const dir = path.dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -32000');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL DEFAULT 'kag_embeddings',
        embedding BLOB NOT NULL,
        dimensions INTEGER NOT NULL,
        metadata TEXT DEFAULT '{}',
        document TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_vectors_collection ON vectors(collection);
    `);

    this._stmts = {
      upsert: this.db.prepare(`
        INSERT OR REPLACE INTO vectors (id, collection, embedding, dimensions, metadata, document)
        VALUES (@id, @collection, @embedding, @dimensions, @metadata, @document)
      `),
      get: this.db.prepare('SELECT * FROM vectors WHERE id = ? AND collection = ?'),
      delete: this.db.prepare('DELETE FROM vectors WHERE id = ? AND collection = ?'),
      count: this.db.prepare('SELECT COUNT(*) as n FROM vectors WHERE collection = ?'),
      all: this.db.prepare('SELECT id, embedding, dimensions, metadata, document FROM vectors WHERE collection = ?'),
      clear: this.db.prepare('DELETE FROM vectors WHERE collection = ?'),
    };

    this.initialized = true;
    const n = this._stmts.count.get(this.collectionName).n;
    logger.info('[SQLiteVectorStore] Initialized', { dbPath: this.dbPath, vectors: n });
  }

  _toBlob(embedding) {
    const f32 = new Float32Array(embedding);
    return Buffer.from(f32.buffer);
  }

  _fromBlob(blob, dimensions) {
    const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
    const f32 = new Float32Array(buf.buffer, buf.byteOffset, dimensions);
    return Array.from(f32);
  }

  _cosine(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  async addDocument(id, embedding, metadata = {}, document = '') {
    await this.initialize();
    this._stmts.upsert.run({
      id,
      collection: this.collectionName,
      embedding: this._toBlob(embedding),
      dimensions: embedding.length,
      metadata: JSON.stringify(metadata),
      document: document || '',
    });
    logger.debug('[SQLiteVectorStore] Stored vector', { id, dims: embedding.length });
  }

  async addDocuments(documents) {
    await this.initialize();
    const insert = this.db.transaction((docs) => {
      for (const doc of docs) {
        this._stmts.upsert.run({
          id: doc.id,
          collection: this.collectionName,
          embedding: this._toBlob(doc.embedding),
          dimensions: doc.embedding.length,
          metadata: JSON.stringify(doc.metadata || {}),
          document: doc.document || '',
        });
      }
    });
    insert(documents);
    logger.info('[SQLiteVectorStore] Batch stored', { count: documents.length });
  }

  async search(queryEmbedding, options = {}) {
    await this.initialize();
    const { limit = 10 } = options;

    const rows = this._stmts.all.all(this.collectionName);
    const results = rows.map(row => {
      const emb = this._fromBlob(row.embedding, row.dimensions);
      const score = this._cosine(queryEmbedding, emb);
      return {
        id: row.id,
        score,
        metadata: JSON.parse(row.metadata || '{}'),
        document: row.document,
      };
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async getDocument(id) {
    await this.initialize();
    const row = this._stmts.get.get(id, this.collectionName);
    if (!row) return null;
    return {
      id: row.id,
      embedding: this._fromBlob(row.embedding, row.dimensions),
      metadata: JSON.parse(row.metadata || '{}'),
      document: row.document,
    };
  }

  async updateDocument(id, updates) {
    const existing = await this.getDocument(id);
    if (!existing) return;
    await this.addDocument(
      id,
      updates.embedding || existing.embedding,
      updates.metadata || existing.metadata,
      updates.document || existing.document,
    );
  }

  async deleteDocument(id) {
    await this.initialize();
    this._stmts.delete.run(id, this.collectionName);
  }

  async deleteDocuments(ids) {
    await this.initialize();
    const del = this.db.transaction((list) => {
      for (const id of list) this._stmts.delete.run(id, this.collectionName);
    });
    del(ids);
  }

  async count() {
    await this.initialize();
    return this._stmts.count.get(this.collectionName).n;
  }

  async clear() {
    await this.initialize();
    this._stmts.clear.run(this.collectionName);
  }

  async getStats() {
    await this.initialize();
    return {
      mode: 'SQLite',
      collection: this.collectionName,
      count: this._stmts.count.get(this.collectionName).n,
      dbPath: this.dbPath,
    };
  }
}

let instance = null;

export function getSQLiteVectorStore(config = {}) {
  if (!instance) {
    instance = new SQLiteVectorStore(config);
  }
  return instance;
}

export default SQLiteVectorStore;
