/**
 * TemporalService — версионирование объектов в Integram
 *
 * Тип TEMPORAL (id=53) хранит версии значений:
 *   up = objectId, t = 53, val = JSON{value, validFrom, validTo, changedBy}
 *
 * При каждом изменении объекта:
 *   1. Текущее значение → TEMPORAL запись (с validTo = now)
 *   2. Новое значение → val объекта (текущая версия)
 *
 * Позволяет:
 *   - Посмотреть состояние объекта на любой момент времени
 *   - Кто и когда менял
 *   - Откатить к предыдущей версии
 *
 * «Анамнесис — память о прошлом как со-присутствие»
 */

const TEMPORAL_TYPE = 53;

export class TemporalService {
  constructor(databaseService, options = {}) {
    this.db = databaseService;
    this.logger = options.logger || console;
  }

  /**
   * Записать версию перед обновлением
   *
   * @param {string} database
   * @param {number} objectId — объект который обновляется
   * @param {string} oldValue — предыдущее значение
   * @param {string} [changedBy] — кто изменил
   */
  async recordVersion(database, objectId, oldValue, changedBy = 'system') {
    const val = JSON.stringify({
      value: oldValue,
      validFrom: null, // TODO: из предыдущей записи
      validTo: new Date().toISOString(),
      changedBy,
      recordedAt: new Date().toISOString(),
    });

    const sql = `INSERT INTO \`${database}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
    await this.db.execSql(sql, [objectId, TEMPORAL_TYPE, val], 'TemporalService.record');
  }

  /**
   * Получить историю версий объекта
   */
  async getHistory(database, objectId, limit = 50) {
    const sql = `SELECT id, val, up FROM \`${database}\` WHERE up = ? AND t = ? ORDER BY id DESC LIMIT ?`;
    const result = await this.db.execSql(sql, [objectId, TEMPORAL_TYPE, limit], 'TemporalService.history');

    const versions = [];
    for (const row of (result.rows || [])) {
      try {
        const parsed = JSON.parse(row.val);
        versions.push({ id: row.id, ...parsed });
      } catch (e) {
        versions.push({ id: row.id, value: row.val, error: 'parse failed' });
      }
    }
    return { objectId, versions, total: versions.length };
  }

  /**
   * Получить значение объекта на определённый момент времени
   */
  async getValueAt(database, objectId, timestamp) {
    const isoTime = new Date(timestamp).toISOString();

    // Ищем последнюю версию у которой validTo > timestamp (или текущую)
    const sql = `SELECT id, val FROM \`${database}\` WHERE up = ? AND t = ? ORDER BY id DESC`;
    const result = await this.db.execSql(sql, [objectId, TEMPORAL_TYPE], 'TemporalService.valueAt');

    for (const row of (result.rows || [])) {
      try {
        const parsed = JSON.parse(row.val);
        if (parsed.validTo && parsed.validTo >= isoTime) {
          return { value: parsed.value, validTo: parsed.validTo, changedBy: parsed.changedBy };
        }
      } catch (e) { continue; }
    }

    // Не нашли в истории — вернуть текущее значение
    const current = await this.db.execSql(
      `SELECT val FROM \`${database}\` WHERE id = ? LIMIT 1`,
      [objectId], 'TemporalService.current'
    );
    const curVal = (current.rows || [])[0]?.val;
    return { value: curVal, validTo: null, changedBy: null, note: 'current' };
  }

  /**
   * Откатить объект к предыдущей версии
   */
  async rollback(database, objectId, versionId) {
    // Получить значение из версии
    const sql = `SELECT val FROM \`${database}\` WHERE id = ? AND up = ? AND t = ? LIMIT 1`;
    const result = await this.db.execSql(sql, [versionId, objectId, TEMPORAL_TYPE], 'TemporalService.rollback.get');
    const row = (result.rows || [])[0];
    if (!row) throw new Error(`Version ${versionId} not found for object ${objectId}`);

    const parsed = JSON.parse(row.val);

    // Сохранить текущее значение как версию
    const current = await this.db.execSql(
      `SELECT val FROM \`${database}\` WHERE id = ? LIMIT 1`,
      [objectId], 'TemporalService.rollback.current'
    );
    const curVal = (current.rows || [])[0]?.val;
    if (curVal) {
      await this.recordVersion(database, objectId, curVal, 'rollback');
    }

    // Установить старое значение
    await this.db.execSql(
      `UPDATE \`${database}\` SET val = ? WHERE id = ?`,
      [parsed.value, objectId], 'TemporalService.rollback.update'
    );

    return { objectId, restoredValue: parsed.value, fromVersion: versionId };
  }

  /**
   * Статистика версий
   */
  async getStats(database) {
    const sql = `SELECT COUNT(*) as cnt FROM \`${database}\` WHERE t = ?`;
    const result = await this.db.execSql(sql, [TEMPORAL_TYPE], 'TemporalService.stats');
    return { totalVersions: (result.rows || [])[0]?.cnt || 0 };
  }
}

export default TemporalService;
