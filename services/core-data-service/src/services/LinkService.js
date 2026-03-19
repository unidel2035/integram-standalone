/**
 * LinkService — Ассоциативные связи для Integram
 *
 * Реализация концепции LinksPlatform (Konard) через тип LINK (id=52).
 * Doublet = (source, target, kind) хранится как объект Integram:
 *   up = sourceId, t = 52, val = JSON{target, kind, weight, label}
 *
 * Виды связей (kinds):
 *   same_as     — тот же объект в другой системе
 *   similar_to  — похожий объект
 *   part_of     — часть целого (иерархия)
 *   derived_from — производный (причина→следствие)
 *   references  — ссылается на
 *   gift_to     — дар (онтология дара)
 *
 * «Всё = объект» — связь тоже объект в одной таблице.
 */

import { BASIC_TYPE_IDS } from '@integram/common';

const LINK_TYPE = BASIC_TYPE_IDS.LINK || 52;

const VALID_KINDS = [
  'same_as', 'similar_to', 'part_of', 'derived_from',
  'references', 'gift_to', 'belongs_to', 'causes',
];

export class LinkService {
  constructor(databaseService, options = {}) {
    this.db = databaseService;
    this.logger = options.logger || console;
  }

  /**
   * Создать связь (doublet)
   *
   * @param {string} database
   * @param {number} sourceId — объект-источник
   * @param {number} targetId — объект-цель
   * @param {string} kind — тип связи
   * @param {Object} [meta] — доп. данные (weight, label)
   * @returns {Promise<{id, sourceId, targetId, kind}>}
   */
  async createLink(database, sourceId, targetId, kind = 'references', meta = {}) {
    const db = this._validateDb(database);
    if (!VALID_KINDS.includes(kind)) {
      throw new Error(`Invalid link kind: ${kind}. Valid: ${VALID_KINDS.join(', ')}`);
    }

    // Проверка дубликата
    const existing = await this._findLink(db, sourceId, targetId, kind);
    if (existing) return existing;

    const val = JSON.stringify({
      target: targetId,
      kind,
      weight: meta.weight || 1.0,
      label: meta.label || '',
      createdAt: new Date().toISOString(),
      ...meta,
    });

    const sql = `INSERT INTO \`${db}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
    const result = await this.db.execSql(sql, [sourceId, LINK_TYPE, val], 'LinkService.create');

    return { id: result.insertId, sourceId, targetId, kind };
  }

  /**
   * Создать двустороннюю связь (source↔target)
   */
  async createBidirectionalLink(database, sourceId, targetId, kind = 'similar_to', meta = {}) {
    const forward = await this.createLink(database, sourceId, targetId, kind, meta);
    const reverse = await this.createLink(database, targetId, sourceId, kind, meta);
    return { forward, reverse };
  }

  /**
   * Получить все связи объекта (исходящие)
   */
  async getLinksFrom(database, sourceId, kind = null) {
    const db = this._validateDb(database);
    let sql = `SELECT id, up as sourceId, val FROM \`${db}\` WHERE up = ? AND t = ?`;
    const params = [sourceId, LINK_TYPE];

    const result = await this.db.execSql(sql, params, 'LinkService.from');
    return this._parseRows(result.rows || [], kind);
  }

  /**
   * Получить все связи НА объект (входящие)
   */
  async getLinksTo(database, targetId, kind = null) {
    const db = this._validateDb(database);
    // Ищем все LINK объекты где val содержит target=targetId
    const sql = `SELECT id, up as sourceId, val FROM \`${db}\` WHERE t = ? AND val LIKE ?`;
    const params = [LINK_TYPE, `%"target":${targetId}%`];

    const result = await this.db.execSql(sql, params, 'LinkService.to');
    return this._parseRows(result.rows || [], kind);
  }

  /**
   * Получить все связи объекта (входящие + исходящие)
   */
  async getAllLinks(database, objectId, kind = null) {
    const [from, to] = await Promise.all([
      this.getLinksFrom(database, objectId, kind),
      this.getLinksTo(database, objectId, kind),
    ]);
    return { outgoing: from, incoming: to, total: from.length + to.length };
  }

  /**
   * Обход графа связей (BFS) — найти все связанные объекты до глубины N
   */
  async traverse(database, startId, options = {}) {
    const maxDepth = Math.min(options.depth || 2, 5);
    const kind = options.kind || null;
    const visited = new Set([startId]);
    const nodes = [{ id: startId, depth: 0 }];
    const edges = [];

    let frontier = [startId];
    for (let d = 0; d < maxDepth && frontier.length > 0; d++) {
      const nextFrontier = [];
      for (const nodeId of frontier) {
        const links = await this.getLinksFrom(database, nodeId, kind);
        for (const link of links) {
          edges.push({ from: nodeId, to: link.targetId, kind: link.kind, weight: link.weight });
          if (!visited.has(link.targetId)) {
            visited.add(link.targetId);
            nodes.push({ id: link.targetId, depth: d + 1 });
            nextFrontier.push(link.targetId);
          }
        }
      }
      frontier = nextFrontier;
    }

    return { nodes, edges, depth: maxDepth };
  }

  /**
   * Удалить связь
   */
  async deleteLink(database, linkId) {
    const db = this._validateDb(database);
    const sql = `DELETE FROM \`${db}\` WHERE id = ? AND t = ?`;
    await this.db.execSql(sql, [linkId, LINK_TYPE], 'LinkService.delete');
  }

  /**
   * Удалить все связи объекта
   */
  async deleteAllLinks(database, objectId) {
    const db = this._validateDb(database);
    // Исходящие
    const sql1 = `DELETE FROM \`${db}\` WHERE up = ? AND t = ?`;
    await this.db.execSql(sql1, [objectId, LINK_TYPE], 'LinkService.deleteAll.out');
    // Входящие
    const sql2 = `DELETE FROM \`${db}\` WHERE t = ? AND val LIKE ?`;
    await this.db.execSql(sql2, [LINK_TYPE, `%"target":${objectId}%`], 'LinkService.deleteAll.in');
  }

  /**
   * Найти кратчайший путь между двумя объектами (BFS)
   */
  async findPath(database, fromId, toId, maxDepth = 5) {
    const visited = new Map(); // id -> parentId
    visited.set(fromId, null);
    let frontier = [fromId];

    for (let d = 0; d < maxDepth && frontier.length > 0; d++) {
      const nextFrontier = [];
      for (const nodeId of frontier) {
        const links = await this.getLinksFrom(database, nodeId);
        for (const link of links) {
          if (!visited.has(link.targetId)) {
            visited.set(link.targetId, nodeId);
            if (link.targetId === toId) {
              // Восстановить путь
              const path = [toId];
              let cur = toId;
              while (visited.get(cur) !== null) {
                cur = visited.get(cur);
                path.unshift(cur);
              }
              return { found: true, path, depth: path.length - 1 };
            }
            nextFrontier.push(link.targetId);
          }
        }
      }
      frontier = nextFrontier;
    }

    return { found: false, path: [], depth: maxDepth };
  }

  /**
   * Статистика
   */
  async getStats(database) {
    const db = this._validateDb(database);
    const sql = `SELECT COUNT(*) as cnt FROM \`${db}\` WHERE t = ?`;
    const result = await this.db.execSql(sql, [LINK_TYPE], 'LinkService.stats');
    const total = (result.rows || [])[0]?.cnt || 0;

    // Подсчёт по видам
    const sql2 = `SELECT val FROM \`${db}\` WHERE t = ?`;
    const all = await this.db.execSql(sql2, [LINK_TYPE], 'LinkService.stats.kinds');
    const byKind = {};
    for (const row of (all.rows || [])) {
      try {
        const parsed = JSON.parse(row.val);
        const k = parsed.kind || 'unknown';
        byKind[k] = (byKind[k] || 0) + 1;
      } catch (e) { /* skip */ }
    }

    return { total, byKind };
  }

  // ── Вспомогательные ──────────────────────────────────────────────────────

  _validateDb(database) {
    if (!database || typeof database !== 'string') throw new Error('Database name required');
    return database;
  }

  async _findLink(db, sourceId, targetId, kind) {
    const sql = `SELECT id, up as sourceId, val FROM \`${db}\` WHERE up = ? AND t = ? AND val LIKE ?`;
    const result = await this.db.execSql(sql, [sourceId, LINK_TYPE, `%"target":${targetId}%"kind":"${kind}"%`], 'LinkService.find');
    const rows = this._parseRows(result.rows || []);
    return rows[0] || null;
  }

  _parseRows(rows, filterKind = null) {
    const links = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.val);
        if (filterKind && parsed.kind !== filterKind) continue;
        links.push({
          id: row.id,
          sourceId: row.sourceId,
          targetId: parsed.target,
          kind: parsed.kind,
          weight: parsed.weight || 1.0,
          label: parsed.label || '',
        });
      } catch (e) { /* skip */ }
    }
    return links;
  }
}

export default LinkService;
