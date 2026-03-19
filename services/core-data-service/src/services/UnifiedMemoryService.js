/**
 * UnifiedMemoryService — единый API памяти на основе Integram
 *
 * Объединяет 3 ранее разрозненных системы:
 *   1. Claude Memory (КлодПамять) — записи агентов
 *   2. KAG (Knowledge Graph) — сущности и связи
 *   3. Gift Ontology — дары, лица, граф благодарности
 *
 * Всё хранится в Integram:
 *   - Текст → val объекта
 *   - Семантика → EMBEDDING дочерний (автоэмбеддинг)
 *   - Связи → LINK дочерний
 *   - Версии → TEMPORAL дочерний
 *
 * API:
 *   save(text, meta) → id
 *   search(query, options) → [results] (vector + text)
 *   remember(question) → narrative (LLM summary)
 *   link(sourceId, targetId, kind) → linkId
 *   history(objectId) → [versions]
 *
 * «Integram = единая микросхема памяти для всех агентов»
 */

export class UnifiedMemoryService {
  constructor({ vectorService, linkService, temporalService, searchService, databaseService, embeddingService, options = {} }) {
    this.vector = vectorService;
    this.links = linkService;
    this.temporal = temporalService;
    this.search = searchService;
    this.db = databaseService;
    this.embedding = embeddingService;
    this.logger = options.logger || console;
    this.defaultDatabase = options.database || 'my';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // save — сохранить запись в память
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * @param {string} database
   * @param {number} typeId — тип записи (КлодПамять, ЛичностиДара и т.д.)
   * @param {string} value — текст записи
   * @param {Object} [meta] — доп. реквизиты
   * @param {Object} [options] — { autoEmbed: true, linkTo: [ids] }
   */
  async save(database, typeId, value, meta = {}, options = {}) {
    const db = database || this.defaultDatabase;

    // 1. Создать объект в Integram
    const sql = `INSERT INTO \`${db}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
    const result = await this.db.execSql(sql, [meta.parentId || 1, typeId, value], 'Memory.save');
    const objectId = result.insertId;

    // 2. Сохранить доп. реквизиты
    if (meta.requisites) {
      for (const [reqTypeId, reqValue] of Object.entries(meta.requisites)) {
        await this.db.execSql(
          `INSERT INTO \`${db}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`,
          [objectId, parseInt(reqTypeId), String(reqValue)],
          'Memory.save.req'
        );
      }
    }

    // 3. Автоэмбеддинг
    if (options.autoEmbed !== false && this.embedding) {
      try {
        const emb = await this.embedding.embed(value.substring(0, 2000));
        if (emb && emb.length > 0) {
          await this.vector.addVector(db, objectId, Array.from(emb), {
            model: this.embedding.config?.model,
          });
        }
      } catch (e) {
        this.logger.warn(`[Memory] Auto-embed failed: ${e.message}`);
      }
    }

    // 4. Создать связи
    if (options.linkTo && Array.isArray(options.linkTo)) {
      for (const target of options.linkTo) {
        const targetId = typeof target === 'object' ? target.id : target;
        const kind = typeof target === 'object' ? target.kind : 'references';
        await this.links.createLink(db, objectId, targetId, kind);
      }
    }

    return { id: objectId, database: db, typeId, value };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // search — семантический + текстовый поиск
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * @param {string} database
   * @param {string} query — текст запроса
   * @param {Object} [options] — { types, limit, minScore, mode: 'vector'|'text'|'hybrid' }
   */
  async find(database, query, options = {}) {
    const db = database || this.defaultDatabase;
    const mode = options.mode || 'hybrid';
    const limit = options.limit || 10;

    let vectorResults = [];
    let textResults = [];

    // Векторный поиск
    if (mode !== 'text' && this.embedding) {
      try {
        const emb = await this.embedding.embed(query);
        if (emb && emb.length > 0) {
          const vr = await this.vector.search(db, Array.from(emb), { limit: limit * 2, ...options });
          vectorResults = vr.results || [];
        }
      } catch (e) {
        this.logger.warn(`[Memory] Vector search failed: ${e.message}`);
      }
    }

    // Текстовый поиск
    if (mode !== 'vector') {
      try {
        const tr = await this.search.semanticSearch(db, query, { limit: limit * 2, ...options });
        textResults = tr.results || [];
      } catch (e) {
        this.logger.warn(`[Memory] Text search failed: ${e.message}`);
      }
    }

    // Гибридное объединение (RRF — Reciprocal Rank Fusion)
    if (mode === 'hybrid' && vectorResults.length > 0 && textResults.length > 0) {
      return this._rrfMerge(vectorResults, textResults, limit);
    }

    // Один из режимов
    const results = vectorResults.length > 0 ? vectorResults : textResults;
    return {
      results: results.slice(0, limit),
      mode: vectorResults.length > 0 ? 'vector' : 'text',
      total: results.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // remember — связный ответ (для LLM)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Собрать контекст из памяти для ответа на вопрос
   */
  async remember(database, question, options = {}) {
    const results = await this.find(database, question, { limit: 10, ...options });

    // Собираем контекст
    const fragments = [];
    for (const r of results.results) {
      const value = r.value || r.val || '';
      if (value) fragments.push(value);
    }

    return {
      question,
      fragments,
      context: fragments.join('\n\n---\n\n'),
      resultCount: fragments.length,
      mode: results.mode,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // link — создать связь между объектами
  // ═══════════════════════════════════════════════════════════════════════════

  async link(database, sourceId, targetId, kind = 'references', meta = {}) {
    return this.links.createLink(database || this.defaultDatabase, sourceId, targetId, kind, meta);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // history — версии объекта
  // ═══════════════════════════════════════════════════════════════════════════

  async history(database, objectId, limit = 50) {
    return this.temporal.getHistory(database || this.defaultDatabase, objectId, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // graph — граф связей объекта
  // ═══════════════════════════════════════════════════════════════════════════

  async graph(database, objectId, depth = 2) {
    return this.links.traverse(database || this.defaultDatabase, objectId, { depth });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // stats — общая статистика
  // ═══════════════════════════════════════════════════════════════════════════

  async stats(database) {
    const db = database || this.defaultDatabase;
    const [vectorStats, linkStats, temporalStats] = await Promise.all([
      Promise.resolve(this.vector.getStats(db)),
      this.links.getStats(db).catch(() => ({ total: 0 })),
      this.temporal.getStats(db).catch(() => ({ totalVersions: 0 })),
    ]);

    return {
      database: db,
      vectors: vectorStats,
      links: linkStats,
      temporal: temporalStats,
      services: ['vector', 'link', 'temporal', 'search', 'autoEmbed'],
    };
  }

  // ── Reciprocal Rank Fusion ─────────────────────────────────────────────────

  _rrfMerge(vectorResults, textResults, limit) {
    const k = 60; // RRF constant
    const scores = new Map();

    for (let i = 0; i < vectorResults.length; i++) {
      const id = vectorResults[i].id || vectorResults[i].parentId;
      const rrf = 1 / (k + i + 1);
      scores.set(id, (scores.get(id) || 0) + rrf);
    }

    for (let i = 0; i < textResults.length; i++) {
      const id = textResults[i].id || textResults[i].parentId;
      const rrf = 1 / (k + i + 1);
      scores.set(id, (scores.get(id) || 0) + rrf);
    }

    // Собрать результаты с RRF score
    const allResults = new Map();
    for (const r of [...vectorResults, ...textResults]) {
      const id = r.id || r.parentId;
      if (!allResults.has(id)) allResults.set(id, r);
    }

    const merged = [...allResults.entries()]
      .map(([id, r]) => ({ ...r, rrfScore: scores.get(id) || 0 }))
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, limit);

    return { results: merged, mode: 'hybrid', total: merged.length };
  }
}

export default UnifiedMemoryService;
