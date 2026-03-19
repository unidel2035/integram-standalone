/**
 * VectorService — Векторный движок для Integram
 *
 * Хранит embeddings как объекты с типом EMBEDDING (id=54).
 * Cosine similarity search в памяти Node.js.
 *
 * Архитектура:
 *   MySQL: (id, up=parentObjectId, t=54, val=JSON{values[384]})
 *   RAM:   Map<id, Float32Array> для быстрого поиска
 *
 * «Всё = объект» — вектор тоже объект в одной таблице Integram.
 */

const EMBEDDING_TYPE = 54;

export class VectorService {
  constructor(databaseService, options = {}) {
    this.db = databaseService;
    this.logger = options.logger || console;
    this._indices = new Map();
    this._initialized = new Map();
  }

  async initialize(database) {
    if (this._initialized.get(database)) return;
    const index = new Map();
    try {
      const sql = `SELECT id, up, val FROM \`${database}\` WHERE t = ? AND val != ''`;
      const result = await this.db.execSql(sql, [EMBEDDING_TYPE], 'VectorService.init');
      for (const row of (result.rows || [])) {
        try {
          const parsed = JSON.parse(row.val);
          const values = parsed.values || parsed;
          if (Array.isArray(values) && values.length > 0) {
            index.set(row.id, { vec: new Float32Array(values), parentId: row.up });
          }
        } catch (e) { /* skip */ }
      }
      this._indices.set(database, index);
      this._initialized.set(database, true);
      this.logger.info(`[VectorService] ${database}: loaded ${index.size} vectors`);
    } catch (e) {
      this.logger.warn(`[VectorService] ${database}: init error: ${e.message}`);
      this._indices.set(database, new Map());
      this._initialized.set(database, true);
    }
  }

  async addVector(database, parentId, values, meta = {}) {
    await this.initialize(database);
    const val = JSON.stringify({
      values, dimensions: values.length,
      model: meta.model || 'unknown',
      createdAt: new Date().toISOString(), ...meta,
    });
    const sql = `INSERT INTO \`${database}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
    const result = await this.db.execSql(sql, [parentId, EMBEDDING_TYPE, val], 'VectorService.add');
    const newId = result.insertId;
    const index = this._indices.get(database);
    if (index) index.set(newId, { vec: new Float32Array(values), parentId });
    return { id: newId, parentId };
  }

  async search(database, queryVector, options = {}) {
    await this.initialize(database);
    const index = this._indices.get(database);
    if (!index || index.size === 0) return { results: [], total: 0, engine: 'vector-cosine' };
    const limit = options.limit || 10;
    const minScore = options.minScore || 0;
    const qVec = new Float32Array(queryVector);
    const scores = [];
    for (const [id, entry] of index) {
      const score = cosine(qVec, entry.vec);
      if (score >= minScore) scores.push({ id, parentId: entry.parentId, score });
    }
    scores.sort((a, b) => b.score - a.score);
    return { results: scores.slice(0, limit), total: index.size, engine: 'vector-cosine' };
  }

  async deleteVector(database, vectorId) {
    const index = this._indices.get(database);
    if (index) index.delete(vectorId);
    const sql = `DELETE FROM \`${database}\` WHERE id = ? AND t = ?`;
    await this.db.execSql(sql, [vectorId, EMBEDDING_TYPE], 'VectorService.delete');
  }

  async getVectorByParent(database, parentId) {
    await this.initialize(database);
    const index = this._indices.get(database);
    if (!index) return null;
    for (const [id, entry] of index) {
      if (entry.parentId === parentId) return { id, parentId, values: Array.from(entry.vec), dimensions: entry.vec.length };
    }
    return null;
  }

  getStats(database) {
    const index = this._indices.get(database);
    return {
      initialized: this._initialized.get(database) || false,
      vectorCount: index ? index.size : 0,
      dimensions: index && index.size > 0 ? index.values().next().value.vec.length : 0,
    };
  }
}

function cosine(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
  const d = Math.sqrt(nA) * Math.sqrt(nB);
  return d === 0 ? 0 : dot / d;
}

export default VectorService;
