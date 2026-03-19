/**
 * DoubletStore — ассоциативный слой связей между сущностями из разных систем.
 *
 * Вдохновлён LinksPlatform (Konard) — дублет = (id, source, target, kind, data).
 * Материализует связи, которые теряются при дедупликации в FederatedSearch:
 *   "БПЛА" из kval-ontology-1024 == same_as ==> "UAV" из kag-sqlite-e4f2c91
 *
 * Хранение: SQLite таблица doublets в KAGStorageIntegram.
 * Совместимость: export/import в links-client формат (id: source target).
 *
 * @module DoubletStore
 */

import { randomUUID } from 'crypto';
import logger from '../../utils/logger.js';

const VALID_KINDS = ['same_as', 'similar_to', 'part_of', 'derived_from'];

export class DoubletStore {
  /**
   * @param {import('better-sqlite3').Database} db — better-sqlite3 instance
   */
  constructor(db) {
    this.db = db;
    this._stmts = {};
    this._ensureTable();
    this._prepareStatements();
  }

  /**
   * Создать таблицу doublets (idempotent).
   */
  _ensureTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS doublets (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'same_as',
        data TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(source, target, kind)
      );
      CREATE INDEX IF NOT EXISTS idx_doublets_source ON doublets(source);
      CREATE INDEX IF NOT EXISTS idx_doublets_target ON doublets(target);
      CREATE INDEX IF NOT EXISTS idx_doublets_kind ON doublets(kind);
    `);
  }

  /**
   * Подготовить statements.
   */
  _prepareStatements() {
    this._stmts = {
      insert: this.db.prepare(`
        INSERT OR IGNORE INTO doublets (id, source, target, kind, data)
        VALUES (@id, @source, @target, @kind, @data)
      `),

      getByEntity: this.db.prepare(`
        SELECT * FROM doublets WHERE source = ? OR target = ?
      `),

      getBySource: this.db.prepare('SELECT * FROM doublets WHERE source = ?'),
      getByTarget: this.db.prepare('SELECT * FROM doublets WHERE target = ?'),

      getById: this.db.prepare('SELECT * FROM doublets WHERE id = ?'),

      findByKind: this.db.prepare('SELECT * FROM doublets WHERE kind = ? LIMIT ?'),

      remove: this.db.prepare('DELETE FROM doublets WHERE id = ?'),

      countAll: this.db.prepare('SELECT COUNT(*) as count FROM doublets'),

      countByKind: this.db.prepare(
        'SELECT kind, COUNT(*) as count FROM doublets GROUP BY kind ORDER BY count DESC'
      ),

      getAll: this.db.prepare('SELECT * FROM doublets ORDER BY created_at DESC'),

      getAllLimited: this.db.prepare('SELECT * FROM doublets ORDER BY created_at DESC LIMIT ?'),
    };
  }

  /**
   * Создать дублет.
   * @param {string} source — ID сущности-источника
   * @param {string} target — ID связанной сущности
   * @param {string} kind — тип: same_as | similar_to | part_of | derived_from
   * @param {object} data — метаданные (confidence, createdBy, etc.)
   * @returns {string} ID созданного дублета
   */
  createDoublet(source, target, kind = 'same_as', data = {}) {
    if (!source || !target) {
      throw new Error('DoubletStore: source and target are required');
    }
    if (!VALID_KINDS.includes(kind)) {
      throw new Error(`DoubletStore: invalid kind "${kind}", valid: ${VALID_KINDS.join(', ')}`);
    }

    const id = `dbl-${randomUUID().slice(0, 8)}`;
    this._stmts.insert.run({
      id,
      source,
      target,
      kind,
      data: JSON.stringify(data),
    });

    return id;
  }

  /**
   * Получить все дублеты для сущности (как source или target).
   * @param {string} entityId
   * @returns {Array<object>}
   */
  getDoublets(entityId) {
    if (!entityId) return [];
    const rows = this._stmts.getByEntity.all(entityId, entityId);
    return rows.map(r => this._deserialize(r));
  }

  /**
   * Разрешить все alias-ID через транзитивные same_as.
   * Пример: A ==same_as==> B, B ==same_as==> C => resolveAliases(A) = [A, B, C]
   * @param {string} entityId
   * @returns {string[]}
   */
  resolveAliases(entityId) {
    if (!entityId) return [];

    const visited = new Set();
    const queue = [entityId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);

      // Только same_as для транзитивного разрешения
      const doublets = this.getDoublets(current);
      for (const d of doublets) {
        if (d.kind !== 'same_as') continue;
        const other = d.source === current ? d.target : d.source;
        if (!visited.has(other)) {
          queue.push(other);
        }
      }
    }

    return Array.from(visited);
  }

  /**
   * Найти дублеты по типу.
   * @param {string} kind
   * @param {number} limit
   * @returns {Array<object>}
   */
  findByKind(kind, limit = 100) {
    const rows = this._stmts.findByKind.all(kind, limit);
    return rows.map(r => this._deserialize(r));
  }

  /**
   * Удалить дублет.
   * @param {string} id
   * @returns {boolean}
   */
  removeDoublet(id) {
    const info = this._stmts.remove.run(id);
    return info.changes > 0;
  }

  /**
   * Статистика.
   * @returns {{ total: number, byKind: object }}
   */
  getStats() {
    const total = this._stmts.countAll.get().count;
    const byKind = {};
    for (const row of this._stmts.countByKind.all()) {
      byKind[row.kind] = row.count;
    }
    return { total, byKind };
  }

  /**
   * Экспортировать все дублеты.
   * @param {number} limit — 0 = все
   * @returns {Array<object>}
   */
  exportAll(limit = 0) {
    const rows = limit > 0
      ? this._stmts.getAllLimited.all(limit)
      : this._stmts.getAll.all();
    return rows.map(r => this._deserialize(r));
  }

  // ========================================
  // Совместимость с links-client
  // ========================================

  /**
   * Конвертировать в links-client формат: [{id, source, target}]
   * @returns {Array<{id: string, source: string, target: string}>}
   */
  toLinkFormat() {
    const all = this.exportAll();
    return all.map(d => ({
      id: d.id,
      source: d.source,
      target: d.target,
    }));
  }

  /**
   * Импорт из links-client формата.
   * @param {Array<{id?: string, source: string, target: string}>} links
   * @param {string} defaultKind
   * @returns {{ imported: number }}
   */
  fromLinkFormat(links, defaultKind = 'same_as') {
    if (!Array.isArray(links)) return { imported: 0 };

    let imported = 0;
    const tx = this.db.transaction((batch) => {
      for (const link of batch) {
        try {
          this.createDoublet(link.source, link.target, defaultKind, {
            importedFrom: 'links-client',
          });
          imported++;
        } catch {
          // UNIQUE constraint — skip duplicates
        }
      }
    });

    tx(links);
    return { imported };
  }

  /**
   * Десериализация строки из SQLite.
   */
  _deserialize(row) {
    let data = {};
    try {
      data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
    } catch {
      data = {};
    }

    return {
      id: row.id,
      source: row.source,
      target: row.target,
      kind: row.kind,
      data,
      created_at: row.created_at,
    };
  }
}

export default DoubletStore;
