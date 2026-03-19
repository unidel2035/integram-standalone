/**
 * AutoEmbeddingHook — автоматическое создание embeddings при записи в Integram
 *
 * При создании/обновлении объекта:
 *   1. Собирает текст (val + значения реквизитов)
 *   2. Генерирует embedding через EmbeddingService
 *   3. Сохраняет как дочерний объект с t=EMBEDDING (54)
 *
 * Не блокирует запись — работает через очередь.
 */

const EMBEDDING_TYPE = 54;

// Типы которые НЕ нужно индексировать
const SKIP_TYPES = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
  EMBEDDING_TYPE, 50, 51, 52, 53,
]);

const MIN_TEXT_LENGTH = 5;
const BATCH_SIZE = 10;
const INTERVAL_MS = 5000;

export class AutoEmbeddingHook {
  constructor(options = {}) {
    this.pool = null;
    this.embeddingService = null;
    this.execSql = null;
    this.logger = options.logger || console;
    this._queue = [];
    this._processing = false;
    this._timer = null;
  }

  /**
   * Инициализация — передать MySQL pool и EmbeddingService
   */
  init({ pool, embeddingService, execSql }) {
    this.pool = pool;
    this.embeddingService = embeddingService;
    this.execSql = execSql;

    this._timer = setInterval(() => this._processQueue(), INTERVAL_MS);
    this.logger.info('[AutoEmbedding] Hook initialized');
  }

  /**
   * Hook: объект создан
   */
  onCreated(database, objectId, typeId, value) {
    if (!this.embeddingService || !this.pool) return;
    if (SKIP_TYPES.has(typeId)) return;
    if (!value || String(value).length < MIN_TEXT_LENGTH) return;
    this._queue.push({ database, objectId, typeId, value: String(value), action: 'create' });
  }

  /**
   * Hook: объект обновлён
   */
  onUpdated(database, objectId, typeId, value) {
    if (!this.embeddingService || !this.pool) return;
    if (SKIP_TYPES.has(typeId)) return;
    if (!value || String(value).length < MIN_TEXT_LENGTH) return;
    this._queue.push({ database, objectId, typeId, value: String(value), action: 'update' });
  }

  /**
   * Переиндексировать все объекты типа
   */
  async reindexType(database, typeId, limit = 100) {
    if (!this.execSql || !this.pool) return { error: 'Not initialized' };

    const result = await this.execSql(this.pool,
      `SELECT id, val FROM \`${database}\` WHERE t = ? AND val != '' AND up != 0 LIMIT ?`,
      [typeId, limit], { label: 'AutoEmbedding.reindex' }
    );

    let count = 0;
    for (const row of (result.rows || [])) {
      this._queue.push({ database, objectId: row.id, typeId, value: row.val, action: 'update' });
      count++;
    }
    return { queued: count };
  }

  async _processQueue() {
    if (this._processing || this._queue.length === 0) return;
    this._processing = true;

    const batch = this._queue.splice(0, BATCH_SIZE);
    for (const item of batch) {
      try {
        await this._embedObject(item);
      } catch (e) {
        this.logger.warn(`[AutoEmbedding] ${item.database}/${item.objectId}: ${e.message}`);
      }
    }
    this._processing = false;
  }

  async _embedObject({ database, objectId, typeId, value, action }) {
    // Собираем текст: val + дочерние реквизиты
    let text = value;
    try {
      const result = await this.execSql(this.pool,
        `SELECT val FROM \`${database}\` WHERE up = ? AND t NOT IN (${EMBEDDING_TYPE}, 50, 52, 53) AND val != '' LIMIT 20`,
        [objectId], { label: 'AutoEmbedding.collect' }
      );
      for (const row of (result.rows || [])) {
        if (row.val && row.val.length > 2) text += ' ' + row.val;
      }
    } catch (e) { /* только val */ }

    // Генерируем embedding
    const embedding = await this.embeddingService.embed(text.substring(0, 2000));
    if (!embedding || embedding.length === 0) return;

    const json = JSON.stringify({
      values: Array.from(embedding),
      dimensions: embedding.length,
      model: this.embeddingService.config?.model || 'unknown',
      sourceText: text.substring(0, 200),
      createdAt: new Date().toISOString(),
    });

    if (action === 'update') {
      await this.execSql(this.pool,
        `DELETE FROM \`${database}\` WHERE up = ? AND t = ?`,
        [objectId, EMBEDDING_TYPE], { label: 'AutoEmbedding.deleteOld' }
      ).catch(() => {});
    }

    await this.execSql(this.pool,
      `INSERT INTO \`${database}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`,
      [objectId, EMBEDDING_TYPE, json], { label: 'AutoEmbedding.insert' }
    );

    this.logger.info(`[AutoEmbedding] ${action} ${database}/${objectId} (${embedding.length}d)`);
  }

  getStats() {
    return {
      queueLength: this._queue.length,
      processing: this._processing,
      ready: !!(this.embeddingService && this.pool),
    };
  }

  shutdown() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }
}

export default AutoEmbeddingHook;
