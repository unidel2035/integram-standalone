/**
 * AgentSandbox — изолированная аналитическая среда для агентов
 *
 * Идея: DuckDB как "песочница" агента.
 * Агент может свободно исследовать данные: агрегации, JOIN-ы, аномалии —
 * без риска для основного хранилища (MySQL/Integram).
 *
 * Почему DuckDB:
 * - Встраиваемая, без сервера
 * - Колоночное хранение → быстрые аналитические запросы
 * - Читает Parquet, CSV, JSON, Arrow напрямую
 * - In-memory режим = идеальная изолированная среда
 *
 * Источники вдохновения:
 * - cube.js + ClickHouse: semantic layer → SQL → data
 * - DuckDB как agent sandbox: агент экспериментирует, не ломает прод
 * - Polars для сложных агрегаций: аномалии, регрессии, прогрессии
 *
 * Установка: npm install duckdb-async
 */

import logger from '../utils/logger.js';
import { EventEmitter } from 'events';

// DuckDB — опциональная зависимость (graceful degradation)
let DuckDB = null;
try {
  const mod = await import('duckdb-async');
  DuckDB = mod.default || mod.Database;
} catch (_) {
  logger.warn('[AgentSandbox] duckdb-async not installed. Run: npm install duckdb-async');
}

// ── Схемы сообщений (TypedMessageSchema) ──────────────────────

/**
 * Валидация структуры запроса к песочнице.
 * Вдохновлено PydanticAI: строгие типы на входе агента.
 */
export function validateSandboxQuery(query) {
  const errors = [];

  if (!query || typeof query !== 'object') {
    errors.push('query must be an object');
    return { valid: false, errors };
  }

  if (!query.sql || typeof query.sql !== 'string') {
    errors.push('sql: required string');
  }

  if (query.sql && query.sql.trim().toUpperCase().match(/^(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|ATTACH)/)) {
    errors.push('sql: only SELECT queries allowed in sandbox');
  }

  if (query.maxRows !== undefined && (typeof query.maxRows !== 'number' || query.maxRows < 1)) {
    errors.push('maxRows: must be positive number');
  }

  return { valid: errors.length === 0, errors };
}

// ── AgentSandbox ───────────────────────────────────────────────

export class AgentSandbox extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {string} [opts.agentId] — ID агента (для изоляции)
   * @param {boolean} [opts.inMemory=true] — in-memory или файловая БД
   * @param {string} [opts.dbPath] — путь к файлу (если !inMemory)
   * @param {number} [opts.maxRows=10000] — лимит строк по умолчанию
   * @param {number} [opts.timeoutMs=30000] — таймаут запроса
   */
  constructor(opts = {}) {
    super();
    this.agentId = opts.agentId || 'anon';
    this.inMemory = opts.inMemory !== false;
    this.dbPath = opts.dbPath || ':memory:';
    this.maxRows = opts.maxRows || 10000;
    this.timeoutMs = opts.timeoutMs || 30000;

    this._db = null;
    this._ready = false;
    this._queryCount = 0;
  }

  // ── Инициализация ──────────────────────────────────────────

  async initialize() {
    if (this._ready) return;

    if (!DuckDB) {
      logger.warn(`[AgentSandbox:${this.agentId}] DuckDB unavailable — sandbox disabled`);
      this._ready = false;
      return;
    }

    try {
      this._db = await DuckDB.create(this.inMemory ? ':memory:' : this.dbPath);
      this._ready = true;

      // Расширения: JSON, httpfs, parquet
      await this._exec("INSTALL json; LOAD json;").catch(() => {});
      await this._exec("INSTALL parquet; LOAD parquet;").catch(() => {});

      logger.info(`[AgentSandbox:${this.agentId}] Ready`, {
        mode: this.inMemory ? 'in-memory' : this.dbPath,
      });
    } catch (e) {
      logger.error(`[AgentSandbox:${this.agentId}] Init failed`, { error: e.message });
      this._ready = false;
    }
  }

  get available() { return this._ready && DuckDB !== null; }

  // ── Загрузка данных ────────────────────────────────────────

  /**
   * Загрузить массив объектов как таблицу в песочницу.
   * Типичный сценарий: выгрузить данные из Integram → анализировать в DuckDB.
   *
   * @param {string} tableName
   * @param {Object[]} rows
   */
  async loadTable(tableName, rows) {
    if (!this.available) throw new Error('Sandbox not available');
    if (!Array.isArray(rows) || rows.length === 0) return 0;

    // Определить схему из первой строки
    const sample = rows[0];
    const cols = Object.keys(sample).map(k => {
      const v = sample[k];
      if (typeof v === 'number') return `"${k}" DOUBLE`;
      if (typeof v === 'boolean') return `"${k}" BOOLEAN`;
      return `"${k}" VARCHAR`;
    });

    await this._exec(`DROP TABLE IF EXISTS "${tableName}"`);
    await this._exec(`CREATE TABLE "${tableName}" (${cols.join(', ')})`);

    // Batch insert
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const values = batch.map(row =>
        '(' + Object.keys(sample).map(k => {
          const v = row[k];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return v;
          if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ') + ')'
      ).join(', ');
      await this._exec(`INSERT INTO "${tableName}" VALUES ${values}`);
    }

    logger.info(`[AgentSandbox:${this.agentId}] Loaded ${rows.length} rows → ${tableName}`);
    return rows.length;
  }

  /**
   * Загрузить CSV/Parquet/JSON напрямую по URL или пути.
   * DuckDB читает эти форматы без промежуточной конвертации.
   *
   * @param {string} tableName
   * @param {string} source — путь или URL
   * @param {'csv'|'parquet'|'json'} [format='csv']
   */
  async loadFile(tableName, source, format = 'csv') {
    if (!this.available) throw new Error('Sandbox not available');

    const readers = {
      csv: `read_csv_auto('${source}')`,
      parquet: `read_parquet('${source}')`,
      json: `read_json_auto('${source}')`,
    };

    const reader = readers[format];
    if (!reader) throw new Error(`Unknown format: ${format}`);

    await this._exec(`CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM ${reader}`);
    const count = await this._queryOne(`SELECT COUNT(*) as n FROM "${tableName}"`);
    logger.info(`[AgentSandbox:${this.agentId}] Loaded ${count?.n} rows from ${source}`);
    return count?.n || 0;
  }

  // ── Запросы ────────────────────────────────────────────────

  /**
   * Выполнить SQL SELECT в песочнице.
   * Только чтение. Таймаут. Лимит строк.
   *
   * @param {string} sql
   * @param {Object} [opts]
   * @param {number} [opts.maxRows]
   * @returns {Object[]}
   */
  async query(sql, opts = {}) {
    if (!this.available) {
      return { error: 'Sandbox not available (DuckDB not installed)', rows: [] };
    }

    const validation = validateSandboxQuery({ sql });
    if (!validation.valid) {
      return { error: validation.errors.join('; '), rows: [] };
    }

    const maxRows = opts.maxRows || this.maxRows;
    const wrappedSql = `SELECT * FROM (${sql}) __q LIMIT ${maxRows}`;

    try {
      const start = Date.now();
      const rows = await this._queryAll(wrappedSql);
      const ms = Date.now() - start;
      this._queryCount++;

      this.emit('query', { agentId: this.agentId, sql, rows: rows.length, ms });
      logger.info(`[AgentSandbox:${this.agentId}] Query #${this._queryCount}`, { rows: rows.length, ms });

      return { rows, ms, truncated: rows.length >= maxRows };
    } catch (e) {
      return { error: e.message, rows: [] };
    }
  }

  /**
   * Аномалии: найти строки, где значение отклоняется > N сигм от среднего.
   * Это то, для чего нужен Polars в их стеке — здесь делаем через DuckDB SQL.
   *
   * @param {string} table
   * @param {string} column
   * @param {number} [sigmas=2]
   */
  async detectAnomalies(table, column, sigmas = 2) {
    const sql = `
      WITH stats AS (
        SELECT AVG("${column}") as mean, STDDEV("${column}") as std
        FROM "${table}"
        WHERE "${column}" IS NOT NULL
      )
      SELECT t.*,
        ABS(t."${column}" - s.mean) / NULLIF(s.std, 0) as z_score
      FROM "${table}" t, stats s
      WHERE ABS(t."${column}" - s.mean) / NULLIF(s.std, 0) > ${sigmas}
      ORDER BY z_score DESC
    `;
    return this.query(sql);
  }

  /**
   * Скользящее среднее — простая аналитика временных рядов.
   *
   * @param {string} table
   * @param {string} valueCol
   * @param {string} timeCol
   * @param {number} [window=7]
   */
  async movingAverage(table, valueCol, timeCol, window = 7) {
    const sql = `
      SELECT "${timeCol}", "${valueCol}",
        AVG("${valueCol}") OVER (
          ORDER BY "${timeCol}"
          ROWS BETWEEN ${window - 1} PRECEDING AND CURRENT ROW
        ) as moving_avg_${window}
      FROM "${table}"
      ORDER BY "${timeCol}"
    `;
    return this.query(sql);
  }

  // ── Листинг ────────────────────────────────────────────────

  async tables() {
    if (!this.available) return [];
    const rows = await this._queryAll("SHOW TABLES");
    return rows.map(r => r.name || Object.values(r)[0]);
  }

  async describe(table) {
    if (!this.available) return [];
    return this._queryAll(`DESCRIBE "${table}"`);
  }

  async stats() {
    return {
      available: this.available,
      agentId: this.agentId,
      mode: this.inMemory ? 'in-memory' : this.dbPath,
      queryCount: this._queryCount,
      tables: await this.tables(),
    };
  }

  // ── Cleanup ────────────────────────────────────────────────

  async destroy() {
    if (this._db) {
      await this._db.close().catch(() => {});
      this._db = null;
    }
    this._ready = false;
    logger.info(`[AgentSandbox:${this.agentId}] Destroyed`);
  }

  // ── Внутренние методы ─────────────────────────────────────

  async _exec(sql) {
    return new Promise((resolve, reject) => {
      this._db.exec(sql, (err) => err ? reject(err) : resolve());
    });
  }

  async _queryAll(sql) {
    return new Promise((resolve, reject) => {
      this._db.all(sql, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  async _queryOne(sql) {
    const rows = await this._queryAll(sql);
    return rows[0] || null;
  }
}

// ── Фабрика — один sandbox на агента ─────────────────────────

const sandboxes = new Map();

export function getAgentSandbox(agentId, opts = {}) {
  if (!sandboxes.has(agentId)) {
    sandboxes.set(agentId, new AgentSandbox({ agentId, ...opts }));
  }
  return sandboxes.get(agentId);
}

export async function destroyAgentSandbox(agentId) {
  if (sandboxes.has(agentId)) {
    await sandboxes.get(agentId).destroy();
    sandboxes.delete(agentId);
  }
}

export default AgentSandbox;
