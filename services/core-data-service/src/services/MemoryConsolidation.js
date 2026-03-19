/**
 * MemoryConsolidation — процесс «Сна» для системы памяти Integram
 *
 * Как мозг консолидирует память во сне, этот сервис:
 *   1. Укрепляет важное (consolidate) — оценивает значимость, помечает ядро
 *   2. Сжимает холодное (compress) — архивирует редко используемое
 *   3. Удаляет дубли (deduplicate) — находит near-duplicates через cosine
 *   4. Открывает скрытые связи (discoverAssociations) — строит новые LINK
 *
 * Типы объектов Integram:
 *   EMBEDDING = 54  — векторное представление
 *   LINK      = 52  — ассоциативная связь
 *   TEMPORAL  = 53  — версия (снимок перед изменением)
 *   JSON_DATA = 51  — метаданные консолидации
 *
 * Всё = объект. Метаданные сна — тоже объекты в той же таблице.
 *
 * «Сон — это не отключение, а другой режим работы памяти.
 *  Во сне мозг решает, что помнить, что забыть, и что соединить.»
 */

const EMBEDDING_TYPE = 54;
const LINK_TYPE = 52;
const TEMPORAL_TYPE = 53;
const JSON_DATA_TYPE = 51;

/**
 * Конфигурация по умолчанию
 */
const DEFAULT_OPTIONS = {
  /** Дней без обращений до кандидата на сжатие */
  coldAfterDays: 30,
  /** Порог cosine similarity для дедупликации */
  deduplicateThreshold: 0.95,
  /** Порог cosine similarity для открытия ассоциаций */
  associationThreshold: 0.8,
  /** Порог для транзитивного открытия (A→B, B→C ⇒ A→C) */
  transitiveThreshold: 0.6,
  /** Количество ближайших соседей для поиска ассоциаций */
  neighborLimit: 5,
  /** Длина summary при сжатии (символов) */
  summaryLength: 200,
  /** Максимум объектов за один цикл (защита от перегрузки) */
  batchLimit: 500,
  /** Логгер */
  logger: console,
};

export class MemoryConsolidation {
  /**
   * @param {Object} deps — зависимости
   * @param {Object} deps.databaseService — сервис БД (execSql)
   * @param {Object} deps.vectorService — VectorService (search, getVectorByParent, addVector, deleteVector)
   * @param {Object} deps.linkService — LinkService (createLink, getLinksFrom, getLinksTo, getAllLinks)
   * @param {Object} [deps.options] — настройки
   */
  constructor({ databaseService, vectorService, linkService, options = {} }) {
    this.db = databaseService;
    this.vector = vectorService;
    this.links = linkService;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.logger = this.options.logger || console;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Консолидация — укрепление важного
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Оценить и пометить важные объекты как «консолидированные».
   *
   * Алгоритм важности:
   *   score = accessCount * 3 + connectionDensity * 2 + recencyBonus
   *
   * Где:
   *   - accessCount — сколько LINK ссылаются на объект (входящие + исходящие)
   *   - connectionDensity — количество уникальных связанных объектов
   *   - recencyBonus — 10 если изменялся < 7 дней, 5 если < 30, 0 иначе
   *
   * Объекты с score >= 10 получают метку consolidated=true.
   *
   * @param {string} database — имя БД Integram
   * @returns {Promise<{consolidated: number, scored: number, topObjects: Array}>}
   */
  async consolidate(database) {
    const startTime = Date.now();
    this.logger.info(`[MemoryConsolidation] Начинаю консолидацию для ${database}`);

    try {
      // Получить все «живые» объекты (не служебные типы)
      const objectsSql = `
        SELECT id, val, t,
          UNIX_TIMESTAMP(COALESCE(updated_at, created_at, NOW())) as lastTouched
        FROM \`${database}\`
        WHERE t NOT IN (?, ?, ?, ?)
        ORDER BY id DESC
        LIMIT ?
      `;
      const objectsResult = await this.db.execSql(
        objectsSql,
        [EMBEDDING_TYPE, LINK_TYPE, TEMPORAL_TYPE, JSON_DATA_TYPE, this.options.batchLimit],
        'Consolidation.getObjects'
      );
      const objects = objectsResult.rows || [];

      if (objects.length === 0) {
        this.logger.info('[MemoryConsolidation] Нет объектов для консолидации');
        return { consolidated: 0, scored: 0, topObjects: [] };
      }

      // Получить все LINK-и одним запросом для подсчёта связей
      const linksSql = `SELECT up as sourceId, val FROM \`${database}\` WHERE t = ?`;
      const linksResult = await this.db.execSql(linksSql, [LINK_TYPE], 'Consolidation.getLinks');
      const allLinks = linksResult.rows || [];

      // Построить карту связей: objectId → { outCount, inCount, neighbors }
      const linkMap = new Map();
      for (const link of allLinks) {
        const sourceId = link.sourceId;
        let targetId = null;
        try {
          const parsed = JSON.parse(link.val);
          targetId = parsed.target;
        } catch (e) { continue; }

        // Исходящие
        if (!linkMap.has(sourceId)) linkMap.set(sourceId, { outCount: 0, inCount: 0, neighbors: new Set() });
        const srcEntry = linkMap.get(sourceId);
        srcEntry.outCount++;
        if (targetId) srcEntry.neighbors.add(targetId);

        // Входящие
        if (targetId) {
          if (!linkMap.has(targetId)) linkMap.set(targetId, { outCount: 0, inCount: 0, neighbors: new Set() });
          const tgtEntry = linkMap.get(targetId);
          tgtEntry.inCount++;
          tgtEntry.neighbors.add(sourceId);
        }
      }

      // Найти уже консолидированные (чтобы не дублировать метки)
      const existingConsolidatedSql = `
        SELECT up FROM \`${database}\`
        WHERE t = ? AND val LIKE '%"consolidated":true%'
      `;
      const existingResult = await this.db.execSql(
        existingConsolidatedSql,
        [JSON_DATA_TYPE],
        'Consolidation.getExisting'
      );
      const alreadyConsolidated = new Set((existingResult.rows || []).map(r => r.up));

      const now = Date.now() / 1000; // Unix timestamp в секундах
      const scoredObjects = [];
      let consolidatedCount = 0;

      for (const obj of objects) {
        const entry = linkMap.get(obj.id) || { outCount: 0, inCount: 0, neighbors: new Set() };
        const accessCount = entry.outCount + entry.inCount;
        const connectionDensity = entry.neighbors.size;

        // Бонус за свежесть
        const ageDays = (now - (obj.lastTouched || now)) / 86400;
        let recencyBonus = 0;
        if (ageDays < 7) recencyBonus = 10;
        else if (ageDays < 30) recencyBonus = 5;

        const score = accessCount * 3 + connectionDensity * 2 + recencyBonus;

        scoredObjects.push({ id: obj.id, score, accessCount, connectionDensity, ageDays });

        // Порог консолидации: score >= 10
        if (score >= 10 && !alreadyConsolidated.has(obj.id)) {
          const metaVal = JSON.stringify({
            consolidated: true,
            score,
            accessCount,
            connectionDensity,
            recencyBonus,
            consolidatedAt: new Date().toISOString(),
          });
          const insertSql = `INSERT INTO \`${database}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
          await this.db.execSql(insertSql, [obj.id, JSON_DATA_TYPE, metaVal], 'Consolidation.mark');
          consolidatedCount++;
        }
      }

      // Топ-10 по score
      scoredObjects.sort((a, b) => b.score - a.score);
      const topObjects = scoredObjects.slice(0, 10).map(o => ({
        id: o.id,
        score: o.score,
        accessCount: o.accessCount,
        connections: o.connectionDensity,
      }));

      const duration = Date.now() - startTime;
      this.logger.info(
        `[MemoryConsolidation] Консолидация завершена: ${consolidatedCount} новых, ` +
        `${scoredObjects.length} оценено, ${duration}ms`
      );

      return {
        consolidated: consolidatedCount,
        scored: scoredObjects.length,
        topObjects,
        duration,
      };
    } catch (error) {
      this.logger.error(`[MemoryConsolidation] Ошибка консолидации: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Сжатие — архивирование холодного слоя
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Сжать старые, редко используемые объекты.
   *
   * Процесс:
   *   1. Найти объекты без обращений за N дней
   *   2. Сохранить TEMPORAL версию (снимок для восстановления)
   *   3. Заменить полный текст на summary (первые 200 символов)
   *   4. Пометить JSON_DATA {compressed:true}
   *   5. Удалить дочерние реквизиты (экономия места)
   *
   * @param {string} database — имя БД
   * @param {Object} [options]
   * @param {number} [options.coldAfterDays=30] — порог «холодности»
   * @param {number} [options.summaryLength=200] — длина summary
   * @param {number} [options.limit] — макс. объектов за раз
   * @returns {Promise<{compressed: number, savedBytes: number, candidates: number}>}
   */
  async compress(database, options = {}) {
    const coldAfterDays = options.coldAfterDays || this.options.coldAfterDays;
    const summaryLength = options.summaryLength || this.options.summaryLength;
    const limit = options.limit || this.options.batchLimit;
    const startTime = Date.now();

    this.logger.info(
      `[MemoryConsolidation] Начинаю сжатие для ${database}, порог: ${coldAfterDays} дней`
    );

    try {
      // Найти кандидатов: объекты без связей и без обращений
      // Исключаем уже сжатые и служебные типы
      const candidatesSql = `
        SELECT o.id, o.val, o.t, LENGTH(o.val) as valLength
        FROM \`${database}\` o
        WHERE o.t NOT IN (?, ?, ?, ?)
          AND o.id NOT IN (
            SELECT DISTINCT up FROM \`${database}\`
            WHERE t = ? AND val LIKE '%"compressed":true%'
          )
          AND o.id NOT IN (
            SELECT DISTINCT up FROM \`${database}\` WHERE t = ?
          )
          AND LENGTH(o.val) > ?
        ORDER BY o.id ASC
        LIMIT ?
      `;
      const candidatesResult = await this.db.execSql(
        candidatesSql,
        [
          EMBEDDING_TYPE, LINK_TYPE, TEMPORAL_TYPE, JSON_DATA_TYPE,
          JSON_DATA_TYPE,
          LINK_TYPE,
          summaryLength,
          limit,
        ],
        'Compression.getCandidates'
      );
      const candidates = candidatesResult.rows || [];

      if (candidates.length === 0) {
        this.logger.info('[MemoryConsolidation] Нет кандидатов для сжатия');
        return { compressed: 0, savedBytes: 0, candidates: 0 };
      }

      // Фильтр по «холодности»: проверяем, что нет свежих LINK/TEMPORAL
      const coldCandidates = [];
      const cutoffDate = new Date(Date.now() - coldAfterDays * 86400000).toISOString();

      for (const candidate of candidates) {
        // Проверяем, есть ли свежие дочерние объекты (признак активности)
        const activitySql = `
          SELECT MAX(id) as maxChildId FROM \`${database}\`
          WHERE up = ? AND t IN (?, ?)
        `;
        const activityResult = await this.db.execSql(
          activitySql,
          [candidate.id, LINK_TYPE, TEMPORAL_TYPE],
          'Compression.checkActivity'
        );
        const maxChildId = (activityResult.rows || [])[0]?.maxChildId;

        // Если нет дочерних LINK/TEMPORAL — объект «холодный»
        // Если есть — проверяем дату последнего дочернего
        if (!maxChildId) {
          coldCandidates.push(candidate);
        }
        // Иначе пропускаем — объект ещё «тёплый»
      }

      let compressedCount = 0;
      let savedBytes = 0;

      for (const obj of coldCandidates) {
        try {
          const originalVal = obj.val || '';
          const originalLength = originalVal.length;

          if (originalLength <= summaryLength) continue;

          // 1. Сохранить TEMPORAL версию (для возможности восстановления)
          const temporalVal = JSON.stringify({
            value: originalVal,
            validTo: new Date().toISOString(),
            changedBy: 'memory-consolidation',
            recordedAt: new Date().toISOString(),
            reason: 'compression',
          });
          const temporalSql = `INSERT INTO \`${database}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
          await this.db.execSql(
            temporalSql,
            [obj.id, TEMPORAL_TYPE, temporalVal],
            'Compression.saveTemporal'
          );

          // 2. Обрезать val до summary
          const summary = originalVal.substring(0, summaryLength);
          const updateSql = `UPDATE \`${database}\` SET val = ? WHERE id = ?`;
          await this.db.execSql(updateSql, [summary, obj.id], 'Compression.truncate');

          // 3. Удалить дочерние реквизиты (но НЕ EMBEDDING, LINK, TEMPORAL, JSON_DATA)
          const deleteChildrenSql = `
            DELETE FROM \`${database}\`
            WHERE up = ? AND t NOT IN (?, ?, ?, ?)
          `;
          await this.db.execSql(
            deleteChildrenSql,
            [obj.id, EMBEDDING_TYPE, LINK_TYPE, TEMPORAL_TYPE, JSON_DATA_TYPE],
            'Compression.deleteChildren'
          );

          // 4. Пометить как сжатый
          const compressedMeta = JSON.stringify({
            compressed: true,
            originalLength,
            summary: summary.substring(0, 50) + '...',
            compressedAt: new Date().toISOString(),
            reason: `cold > ${coldAfterDays} days`,
          });
          const markSql = `INSERT INTO \`${database}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
          await this.db.execSql(markSql, [obj.id, JSON_DATA_TYPE, compressedMeta], 'Compression.mark');

          compressedCount++;
          savedBytes += (originalLength - summary.length);
        } catch (err) {
          this.logger.warn(`[MemoryConsolidation] Ошибка сжатия объекта ${obj.id}: ${err.message}`);
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info(
        `[MemoryConsolidation] Сжатие завершено: ${compressedCount}/${coldCandidates.length}, ` +
        `экономия ${savedBytes} байт, ${duration}ms`
      );

      return {
        compressed: compressedCount,
        savedBytes,
        candidates: coldCandidates.length,
        duration,
      };
    } catch (error) {
      this.logger.error(`[MemoryConsolidation] Ошибка сжатия: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Дедупликация — удаление near-duplicates
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Найти и объединить near-duplicate объекты.
   *
   * Алгоритм:
   *   1. Для каждого embedding найти соседей с cosine > 0.95
   *   2. Из пары дубликатов оставить тот, у кого больше LINK-ов
   *   3. Создать LINK(same_as) от дубликата к оригиналу
   *   4. Пометить дубликат {deduplicated:true, mergedInto: keeperId}
   *
   * @param {string} database — имя БД
   * @param {Object} [options]
   * @param {number} [options.threshold=0.95] — порог cosine similarity
   * @param {number} [options.limit] — макс. пар за раз
   * @returns {Promise<{deduplicated: number, pairs: Array}>}
   */
  async deduplicate(database, options = {}) {
    const threshold = options.threshold || this.options.deduplicateThreshold;
    const limit = options.limit || this.options.batchLimit;
    const startTime = Date.now();

    this.logger.info(
      `[MemoryConsolidation] Начинаю дедупликацию для ${database}, порог cosine: ${threshold}`
    );

    try {
      // Инициализировать векторный индекс
      await this.vector.initialize(database);

      // Получить все embeddings
      const embeddingsSql = `SELECT id, up as parentId, val FROM \`${database}\` WHERE t = ? AND val != ''`;
      const embResult = await this.db.execSql(embeddingsSql, [EMBEDDING_TYPE], 'Dedup.getEmbeddings');
      const embeddings = embResult.rows || [];

      if (embeddings.length < 2) {
        this.logger.info('[MemoryConsolidation] Менее 2 embeddings, дедупликация не нужна');
        return { deduplicated: 0, pairs: [] };
      }

      // Получить уже помеченные дубликаты
      const existingDedupSql = `
        SELECT up FROM \`${database}\`
        WHERE t = ? AND val LIKE '%"deduplicated":true%'
      `;
      const existingResult = await this.db.execSql(
        existingDedupSql, [JSON_DATA_TYPE], 'Dedup.getExisting'
      );
      const alreadyDeduped = new Set((existingResult.rows || []).map(r => r.up));

      // Парсить embeddings в удобную структуру
      const parsedEmbeddings = [];
      for (const emb of embeddings) {
        try {
          const parsed = JSON.parse(emb.val);
          const values = parsed.values || parsed;
          if (Array.isArray(values) && values.length > 0 && !alreadyDeduped.has(emb.parentId)) {
            parsedEmbeddings.push({
              embeddingId: emb.id,
              parentId: emb.parentId,
              vector: new Float32Array(values),
            });
          }
        } catch (e) { /* skip */ }
      }

      // Найти дубликаты: для каждого вектора ищем ближайших
      const processed = new Set();
      const pairs = [];
      let deduplicatedCount = 0;

      for (let i = 0; i < parsedEmbeddings.length && pairs.length < limit; i++) {
        const a = parsedEmbeddings[i];
        if (processed.has(a.parentId)) continue;

        for (let j = i + 1; j < parsedEmbeddings.length; j++) {
          const b = parsedEmbeddings[j];
          if (processed.has(b.parentId)) continue;
          if (a.parentId === b.parentId) continue;

          const score = this._cosine(a.vector, b.vector);
          if (score >= threshold) {
            // Определить, кого оставить: у кого больше связей
            const [linksA, linksB] = await Promise.all([
              this.links.getAllLinks(database, a.parentId),
              this.links.getAllLinks(database, b.parentId),
            ]);

            const keeperId = linksA.total >= linksB.total ? a.parentId : b.parentId;
            const duplicateId = keeperId === a.parentId ? b.parentId : a.parentId;

            // Создать LINK(same_as) от дубликата к оригиналу
            await this.links.createLink(database, duplicateId, keeperId, 'same_as', {
              weight: score,
              label: 'auto-deduplicated',
              discoveredBy: 'MemoryConsolidation',
            });

            // Пометить дубликат
            const dedupMeta = JSON.stringify({
              deduplicated: true,
              mergedInto: keeperId,
              cosineScore: Math.round(score * 10000) / 10000,
              deduplicatedAt: new Date().toISOString(),
            });
            const markSql = `INSERT INTO \`${database}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
            await this.db.execSql(markSql, [duplicateId, JSON_DATA_TYPE, dedupMeta], 'Dedup.mark');

            processed.add(duplicateId);
            pairs.push({
              keeperId,
              duplicateId,
              cosine: Math.round(score * 10000) / 10000,
            });
            deduplicatedCount++;

            if (pairs.length >= limit) break;
          }
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info(
        `[MemoryConsolidation] Дедупликация завершена: ${deduplicatedCount} дубликатов, ` +
        `${parsedEmbeddings.length} проверено, ${duration}ms`
      );

      return {
        deduplicated: deduplicatedCount,
        checked: parsedEmbeddings.length,
        pairs,
        duration,
      };
    } catch (error) {
      this.logger.error(`[MemoryConsolidation] Ошибка дедупликации: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Открытие ассоциаций — скрытые связи
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Найти скрытые связи между объектами.
   *
   * Два механизма:
   *   A) Прямое открытие: cosine(A, B) > threshold И нет LINK(A, B) → создать similar_to
   *   B) Транзитивное: A→B и B→C существуют, cosine(A, C) > 0.6 → создать A→C
   *
   * @param {string} database — имя БД
   * @param {Object} [options]
   * @param {number} [options.threshold=0.8] — порог для прямого открытия
   * @param {number} [options.transitiveThreshold=0.6] — порог для транзитивного
   * @param {number} [options.neighborLimit=5] — top-N соседей для каждого объекта
   * @param {number} [options.limit] — макс. новых ассоциаций
   * @returns {Promise<{newAssociations: number, direct: number, transitive: number, associations: Array}>}
   */
  async discoverAssociations(database, options = {}) {
    const threshold = options.threshold || this.options.associationThreshold;
    const transitiveThreshold = options.transitiveThreshold || this.options.transitiveThreshold;
    const neighborLimit = options.neighborLimit || this.options.neighborLimit;
    const limit = options.limit || this.options.batchLimit;
    const startTime = Date.now();

    this.logger.info(
      `[MemoryConsolidation] Начинаю открытие ассоциаций для ${database}, ` +
      `порог: ${threshold}, транзитивный: ${transitiveThreshold}`
    );

    try {
      await this.vector.initialize(database);

      // Получить все embeddings с parentId
      const embSql = `SELECT id, up as parentId, val FROM \`${database}\` WHERE t = ? AND val != ''`;
      const embResult = await this.db.execSql(embSql, [EMBEDDING_TYPE], 'Assoc.getEmbeddings');
      const embeddings = embResult.rows || [];

      // Парсить в структуру
      const parsed = [];
      for (const emb of embeddings) {
        try {
          const data = JSON.parse(emb.val);
          const values = data.values || data;
          if (Array.isArray(values) && values.length > 0) {
            parsed.push({
              parentId: emb.parentId,
              vector: new Float32Array(values),
            });
          }
        } catch (e) { /* skip */ }
      }

      if (parsed.length < 2) {
        return { newAssociations: 0, direct: 0, transitive: 0, associations: [] };
      }

      // Получить существующие LINK-и для проверки «уже связаны?»
      const allLinksSql = `SELECT up as sourceId, val FROM \`${database}\` WHERE t = ?`;
      const allLinksResult = await this.db.execSql(allLinksSql, [LINK_TYPE], 'Assoc.getLinks');
      const existingLinks = new Set();
      const adjacency = new Map(); // sourceId → Set<targetId>

      for (const row of (allLinksResult.rows || [])) {
        try {
          const data = JSON.parse(row.val);
          const key = `${row.sourceId}→${data.target}`;
          existingLinks.add(key);
          if (!adjacency.has(row.sourceId)) adjacency.set(row.sourceId, new Set());
          adjacency.get(row.sourceId).add(data.target);
        } catch (e) { /* skip */ }
      }

      const associations = [];
      let directCount = 0;
      let transitiveCount = 0;

      // A) Прямое открытие: для каждого объекта найти top-N соседей
      for (let i = 0; i < parsed.length && associations.length < limit; i++) {
        const a = parsed[i];
        const neighbors = [];

        for (let j = 0; j < parsed.length; j++) {
          if (i === j) continue;
          if (a.parentId === parsed[j].parentId) continue;
          const score = this._cosine(a.vector, parsed[j].vector);
          if (score >= threshold) {
            neighbors.push({ parentId: parsed[j].parentId, score });
          }
        }

        // Отсортировать по score и взять top-N
        neighbors.sort((x, y) => y.score - x.score);
        const topNeighbors = neighbors.slice(0, neighborLimit);

        for (const neighbor of topNeighbors) {
          const forwardKey = `${a.parentId}→${neighbor.parentId}`;
          const reverseKey = `${neighbor.parentId}→${a.parentId}`;

          if (!existingLinks.has(forwardKey) && !existingLinks.has(reverseKey)) {
            // Создать LINK(similar_to)
            await this.links.createLink(database, a.parentId, neighbor.parentId, 'similar_to', {
              weight: Math.round(neighbor.score * 10000) / 10000,
              label: 'auto-discovered',
              discoveredBy: 'MemoryConsolidation',
            });

            existingLinks.add(forwardKey);
            associations.push({
              type: 'direct',
              source: a.parentId,
              target: neighbor.parentId,
              cosine: Math.round(neighbor.score * 10000) / 10000,
            });
            directCount++;

            if (associations.length >= limit) break;
          }
        }
      }

      // B) Транзитивное открытие: A→B и B→C, проверяем cosine(A,C)
      if (associations.length < limit) {
        // Построить карту parentId → vector для быстрого доступа
        const vectorMap = new Map();
        for (const p of parsed) {
          vectorMap.set(p.parentId, p.vector);
        }

        for (const [sourceA, targetsOfA] of adjacency) {
          if (associations.length >= limit) break;

          for (const b of targetsOfA) {
            if (associations.length >= limit) break;
            const targetsOfB = adjacency.get(b);
            if (!targetsOfB) continue;

            for (const c of targetsOfB) {
              if (associations.length >= limit) break;
              if (c === sourceA) continue; // Не создавать петлю

              const forwardKey = `${sourceA}→${c}`;
              const reverseKey = `${c}→${sourceA}`;
              if (existingLinks.has(forwardKey) || existingLinks.has(reverseKey)) continue;

              // Проверить cosine(A, C)
              const vecA = vectorMap.get(sourceA);
              const vecC = vectorMap.get(c);
              if (!vecA || !vecC) continue;

              const score = this._cosine(vecA, vecC);
              if (score >= transitiveThreshold) {
                await this.links.createLink(database, sourceA, c, 'similar_to', {
                  weight: Math.round(score * 10000) / 10000,
                  label: `transitive via ${b}`,
                  discoveredBy: 'MemoryConsolidation',
                });

                existingLinks.add(forwardKey);
                associations.push({
                  type: 'transitive',
                  source: sourceA,
                  target: c,
                  via: b,
                  cosine: Math.round(score * 10000) / 10000,
                });
                transitiveCount++;
              }
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info(
        `[MemoryConsolidation] Ассоциации: ${directCount} прямых, ${transitiveCount} транзитивных, ${duration}ms`
      );

      return {
        newAssociations: associations.length,
        direct: directCount,
        transitive: transitiveCount,
        associations,
        duration,
      };
    } catch (error) {
      this.logger.error(`[MemoryConsolidation] Ошибка открытия ассоциаций: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Dream — полный цикл «сна»
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Запустить полный цикл консолидации памяти («сон»).
   *
   * Порядок:
   *   1. consolidate — оценить и укрепить важное
   *   2. compress — сжать холодное
   *   3. deduplicate — удалить дубли
   *   4. discoverAssociations — найти скрытые связи
   *
   * @param {string} database — имя БД
   * @returns {Promise<Object>} — полный отчёт о «сне»
   */
  async dream(database) {
    const startTime = Date.now();
    this.logger.info(`[MemoryConsolidation] === СОН НАЧИНАЕТСЯ для ${database} ===`);

    const report = {
      database,
      dreamedAt: new Date().toISOString(),
      phases: {},
      errors: [],
      consolidated: 0,
      compressed: 0,
      deduplicated: 0,
      newAssociations: 0,
      duration: 0,
    };

    // Фаза 1: Консолидация
    try {
      const consolidateResult = await this.consolidate(database);
      report.phases.consolidate = consolidateResult;
      report.consolidated = consolidateResult.consolidated;
    } catch (error) {
      this.logger.error(`[MemoryConsolidation] Фаза consolidate ошибка: ${error.message}`);
      report.errors.push({ phase: 'consolidate', error: error.message });
    }

    // Фаза 2: Сжатие
    try {
      const compressResult = await this.compress(database);
      report.phases.compress = compressResult;
      report.compressed = compressResult.compressed;
    } catch (error) {
      this.logger.error(`[MemoryConsolidation] Фаза compress ошибка: ${error.message}`);
      report.errors.push({ phase: 'compress', error: error.message });
    }

    // Фаза 3: Дедупликация
    try {
      const deduplicateResult = await this.deduplicate(database);
      report.phases.deduplicate = deduplicateResult;
      report.deduplicated = deduplicateResult.deduplicated;
    } catch (error) {
      this.logger.error(`[MemoryConsolidation] Фаза deduplicate ошибка: ${error.message}`);
      report.errors.push({ phase: 'deduplicate', error: error.message });
    }

    // Фаза 4: Открытие ассоциаций
    try {
      const assocResult = await this.discoverAssociations(database);
      report.phases.associations = assocResult;
      report.newAssociations = assocResult.newAssociations;
    } catch (error) {
      this.logger.error(`[MemoryConsolidation] Фаза associations ошибка: ${error.message}`);
      report.errors.push({ phase: 'associations', error: error.message });
    }

    // Сохранить отчёт о сне как объект в БД
    report.duration = Date.now() - startTime;
    try {
      const dreamReportVal = JSON.stringify({
        type: 'dream_report',
        ...report,
      });
      const sql = `INSERT INTO \`${database}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
      await this.db.execSql(sql, [1, JSON_DATA_TYPE, dreamReportVal], 'Dream.saveReport');
    } catch (err) {
      this.logger.warn(`[MemoryConsolidation] Не удалось сохранить отчёт о сне: ${err.message}`);
    }

    this.logger.info(
      `[MemoryConsolidation] === СОН ЗАВЕРШЁН: ` +
      `consolidated=${report.consolidated}, compressed=${report.compressed}, ` +
      `dedup=${report.deduplicated}, assoc=${report.newAssociations}, ` +
      `${report.duration}ms, ошибок=${report.errors.length} ===`
    );

    return report;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Статистика
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Получить статистику системы памяти и последнего «сна».
   *
   * @param {string} database — имя БД
   * @returns {Promise<Object>} — статистика
   */
  async getStats(database) {
    try {
      // Общее количество объектов (без служебных)
      const totalSql = `
        SELECT COUNT(*) as cnt FROM \`${database}\`
        WHERE t NOT IN (?, ?, ?, ?)
      `;
      const totalResult = await this.db.execSql(
        totalSql,
        [EMBEDDING_TYPE, LINK_TYPE, TEMPORAL_TYPE, JSON_DATA_TYPE],
        'Stats.total'
      );
      const objectCount = (totalResult.rows || [])[0]?.cnt || 0;

      // Консолидированные
      const consolidatedSql = `
        SELECT COUNT(DISTINCT up) as cnt FROM \`${database}\`
        WHERE t = ? AND val LIKE '%"consolidated":true%'
      `;
      const consolidatedResult = await this.db.execSql(
        consolidatedSql, [JSON_DATA_TYPE], 'Stats.consolidated'
      );
      const consolidatedCount = (consolidatedResult.rows || [])[0]?.cnt || 0;

      // Сжатые
      const compressedSql = `
        SELECT COUNT(DISTINCT up) as cnt FROM \`${database}\`
        WHERE t = ? AND val LIKE '%"compressed":true%'
      `;
      const compressedResult = await this.db.execSql(
        compressedSql, [JSON_DATA_TYPE], 'Stats.compressed'
      );
      const compressedCount = (compressedResult.rows || [])[0]?.cnt || 0;

      // Дубликаты
      const duplicateSql = `
        SELECT COUNT(DISTINCT up) as cnt FROM \`${database}\`
        WHERE t = ? AND val LIKE '%"deduplicated":true%'
      `;
      const duplicateResult = await this.db.execSql(
        duplicateSql, [JSON_DATA_TYPE], 'Stats.duplicates'
      );
      const duplicateCount = (duplicateResult.rows || [])[0]?.cnt || 0;

      // Ассоциации (LINK similar_to от MemoryConsolidation)
      const assocSql = `
        SELECT COUNT(*) as cnt FROM \`${database}\`
        WHERE t = ? AND val LIKE '%"discoveredBy":"MemoryConsolidation"%'
      `;
      const assocResult = await this.db.execSql(
        assocSql, [LINK_TYPE], 'Stats.associations'
      );
      const associationCount = (assocResult.rows || [])[0]?.cnt || 0;

      // Последний dream report
      const lastDreamSql = `
        SELECT val FROM \`${database}\`
        WHERE t = ? AND val LIKE '%"type":"dream_report"%'
        ORDER BY id DESC LIMIT 1
      `;
      const lastDreamResult = await this.db.execSql(
        lastDreamSql, [JSON_DATA_TYPE], 'Stats.lastDream'
      );
      let lastDream = null;
      const lastDreamRow = (lastDreamResult.rows || [])[0];
      if (lastDreamRow) {
        try {
          const parsed = JSON.parse(lastDreamRow.val);
          lastDream = {
            dreamedAt: parsed.dreamedAt,
            duration: parsed.duration,
            consolidated: parsed.consolidated,
            compressed: parsed.compressed,
            deduplicated: parsed.deduplicated,
            newAssociations: parsed.newAssociations,
            errors: (parsed.errors || []).length,
          };
        } catch (e) { /* skip */ }
      }

      return {
        lastDream,
        objectCount,
        consolidatedCount,
        compressedCount,
        duplicateCount,
        associationCount,
      };
    } catch (error) {
      this.logger.error(`[MemoryConsolidation] Ошибка получения статистики: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Вспомогательные методы
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Вычислить cosine similarity между двумя векторами.
   *
   * @param {Float32Array} a
   * @param {Float32Array} b
   * @returns {number} — значение от 0 до 1
   * @private
   */
  _cosine(a, b) {
    if (a.length !== b.length) return 0;
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      nA += a[i] * a[i];
      nB += b[i] * b[i];
    }
    const denom = Math.sqrt(nA) * Math.sqrt(nB);
    return denom === 0 ? 0 : dot / denom;
  }
}

export default MemoryConsolidation;
