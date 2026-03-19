/**
 * EmotionalWeight — эмоциональный вес объектов памяти
 *
 * Не все воспоминания равны. Прорыв, ошибка, конфликт —
 * оставляют более глубокий след, чем рутина.
 *
 * Тип JSON_DATA (id=51) хранит вес как дочерний объект:
 *   up = objectId, t = 51, val = JSON{accessCount, lastAccessed, impacts[], weight, decayedAt}
 *
 * Формула важности:
 *   weight = accessCount * recencyFactor * impactMultiplier * connectionBonus
 *
 *   - recencyFactor: экспоненциальный спад, полупериод 14 дней
 *   - impactMultiplier: breakthrough=3x, error=2.5x, decision=2x, conflict=1.5x, routine=1x
 *   - connectionBonus: 1 + (linkCount * 0.1), max 3.0
 *
 * «То, что нас ранит — помним вечно. То, что рутинно — забываем к утру.»
 */

const JSON_DATA_TYPE = 51;
const LINK_TYPE = 52;

/** Полупериод распада в миллисекундах (14 дней) */
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

/** Множители воздействия по типу */
const IMPACT_MULTIPLIERS = {
  breakthrough: 3.0,
  error: 2.5,
  decision: 2.0,
  conflict: 1.5,
  routine: 1.0,
};

const VALID_IMPACTS = Object.keys(IMPACT_MULTIPLIERS);

// ============================================================================
// EmotionalWeight
// ============================================================================

export class EmotionalWeight {
  /**
   * @param {Object} params
   * @param {Object} params.databaseService — сервис БД (execSql)
   * @param {Object} [params.options]
   * @param {Object} [params.options.logger] — логгер (default: console)
   * @param {number} [params.options.halfLifeMs] — полупериод распада (default: 14 дней)
   */
  constructor({ databaseService, options = {} }) {
    this.db = databaseService;
    this.logger = options.logger || console;
    this.halfLifeMs = options.halfLifeMs || HALF_LIFE_MS;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Запись обращений
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Зафиксировать обращение к объекту — инкремент счётчика, обновление lastAccessed
   *
   * @param {string} database — имя БД
   * @param {number} objectId — ID объекта памяти
   * @returns {Promise<{objectId, accessCount, lastAccessed}>}
   */
  async recordAccess(database, objectId) {
    const data = await this._getOrCreateWeightData(database, objectId);
    data.accessCount = (data.accessCount || 0) + 1;
    data.lastAccessed = new Date().toISOString();
    await this._saveWeightData(database, objectId, data);

    this.logger.debug?.(`[EmotionalWeight] recordAccess objectId=${objectId} count=${data.accessCount}`);
    return { objectId, accessCount: data.accessCount, lastAccessed: data.lastAccessed };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Запись эмоционального воздействия
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Зафиксировать эмоциональное воздействие объекта
   *
   * @param {string} database — имя БД
   * @param {number} objectId — ID объекта памяти
   * @param {string} impact — тип: 'breakthrough' | 'error' | 'decision' | 'routine' | 'conflict'
   * @returns {Promise<{objectId, impact, multiplier, totalImpacts}>}
   */
  async recordImpact(database, objectId, impact) {
    if (!VALID_IMPACTS.includes(impact)) {
      throw new Error(`Invalid impact type: "${impact}". Valid: ${VALID_IMPACTS.join(', ')}`);
    }

    const data = await this._getOrCreateWeightData(database, objectId);
    if (!Array.isArray(data.impacts)) {
      data.impacts = [];
    }

    data.impacts.push({
      type: impact,
      multiplier: IMPACT_MULTIPLIERS[impact],
      recordedAt: new Date().toISOString(),
    });

    await this._saveWeightData(database, objectId, data);

    this.logger.debug?.(`[EmotionalWeight] recordImpact objectId=${objectId} impact=${impact} x${IMPACT_MULTIPLIERS[impact]}`);
    return {
      objectId,
      impact,
      multiplier: IMPACT_MULTIPLIERS[impact],
      totalImpacts: data.impacts.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Вычисление веса
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Вычислить вес (важность) объекта памяти
   *
   * weight = accessCount * recencyFactor * impactMultiplier * connectionBonus
   *
   * @param {string} database — имя БД
   * @param {number} objectId — ID объекта памяти
   * @returns {Promise<{objectId, weight, accessCount, recencyFactor, impactMultiplier, connectionBonus}>}
   */
  async getWeight(database, objectId) {
    const data = await this._getOrCreateWeightData(database, objectId);

    const accessCount = Math.max(data.accessCount || 0, 1);
    const recencyFactor = this._calcRecency(data.lastAccessed);
    const impactMultiplier = this._calcImpactMultiplier(data.impacts || []);
    const connectionBonus = await this._calcConnectionBonus(database, objectId);

    const weight = accessCount * recencyFactor * impactMultiplier * connectionBonus;

    return {
      objectId,
      weight: Math.round(weight * 1000) / 1000,
      accessCount,
      recencyFactor: Math.round(recencyFactor * 1000) / 1000,
      impactMultiplier: Math.round(impactMultiplier * 1000) / 1000,
      connectionBonus: Math.round(connectionBonus * 1000) / 1000,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Топ воспоминаний
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Получить самые важные объекты памяти, отсортированные по весу
   *
   * @param {string} database — имя БД
   * @param {number} [limit=20] — макс. количество
   * @returns {Promise<Array<{objectId, weight, accessCount, lastAccessed}>>}
   */
  async getTopMemories(database, limit = 20) {
    const db = this._validateDb(database);

    // Получить все записи веса
    const sql = `SELECT id, up, val FROM \`${db}\` WHERE t = ? ORDER BY id`;
    const result = await this.db.execSql(sql, [JSON_DATA_TYPE], 'EmotionalWeight.getTopMemories');

    const entries = [];
    for (const row of (result.rows || [])) {
      try {
        const data = JSON.parse(row.val);
        const objectId = row.up;
        const accessCount = Math.max(data.accessCount || 0, 1);
        const recencyFactor = this._calcRecency(data.lastAccessed);
        const impactMultiplier = this._calcImpactMultiplier(data.impacts || []);
        const connectionBonus = await this._calcConnectionBonus(database, objectId);
        const weight = accessCount * recencyFactor * impactMultiplier * connectionBonus;

        entries.push({
          objectId,
          weight: Math.round(weight * 1000) / 1000,
          accessCount: data.accessCount || 0,
          lastAccessed: data.lastAccessed || null,
          impactCount: (data.impacts || []).length,
        });
      } catch {
        // Пропускаем битые записи
      }
    }

    // Сортировка по весу (убывание) и ограничение
    entries.sort((a, b) => b.weight - a.weight);
    return entries.slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Периодический распад
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Запустить периодический распад — уменьшить все веса с учётом фактора давности
   *
   * @param {string} database — имя БД
   * @returns {Promise<{processed, decayedAt}>}
   */
  async decay(database) {
    const db = this._validateDb(database);
    const now = new Date().toISOString();

    const sql = `SELECT id, up, val FROM \`${db}\` WHERE t = ?`;
    const result = await this.db.execSql(sql, [JSON_DATA_TYPE], 'EmotionalWeight.decay');

    let processed = 0;

    for (const row of (result.rows || [])) {
      try {
        const data = JSON.parse(row.val);
        const recency = this._calcRecency(data.lastAccessed);

        // Обновляем вычисленный вес в записи
        data.weight = (data.accessCount || 1) * recency * this._calcImpactMultiplier(data.impacts || []);
        data.decayedAt = now;

        const updateSql = `UPDATE \`${db}\` SET val = ? WHERE id = ?`;
        await this.db.execSql(updateSql, [JSON.stringify(data), row.id], 'EmotionalWeight.decayUpdate');
        processed++;
      } catch (err) {
        this.logger.warn?.(`[EmotionalWeight] decay: ошибка для id=${row.id}`, err.message);
      }
    }

    this.logger.info?.(`[EmotionalWeight] decay: обработано ${processed} записей`);
    return { processed, decayedAt: now };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Статистика
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Статистика эмоциональных весов
   *
   * @param {string} database — имя БД
   * @returns {Promise<{totalWeighted, avgWeight, top5}>}
   */
  async getStats(database) {
    const db = this._validateDb(database);

    const sql = `SELECT id, up, val FROM \`${db}\` WHERE t = ?`;
    const result = await this.db.execSql(sql, [JSON_DATA_TYPE], 'EmotionalWeight.getStats');

    const weights = [];
    for (const row of (result.rows || [])) {
      try {
        const data = JSON.parse(row.val);
        const accessCount = Math.max(data.accessCount || 0, 1);
        const recency = this._calcRecency(data.lastAccessed);
        const impactMul = this._calcImpactMultiplier(data.impacts || []);
        const weight = accessCount * recency * impactMul;
        weights.push({ objectId: row.up, weight: Math.round(weight * 1000) / 1000 });
      } catch {
        // Пропускаем битые записи
      }
    }

    weights.sort((a, b) => b.weight - a.weight);

    const totalWeighted = weights.length;
    const avgWeight = totalWeighted > 0
      ? Math.round((weights.reduce((s, w) => s + w.weight, 0) / totalWeighted) * 1000) / 1000
      : 0;
    const top5 = weights.slice(0, 5);

    return { totalWeighted, avgWeight, top5 };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Приватные методы
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Получить или создать запись веса для объекта
   * @private
   */
  async _getOrCreateWeightData(database, objectId) {
    const db = this._validateDb(database);

    const sql = `SELECT id, val FROM \`${db}\` WHERE up = ? AND t = ? LIMIT 1`;
    const result = await this.db.execSql(sql, [objectId, JSON_DATA_TYPE], 'EmotionalWeight.getWeight');

    if (result.rows && result.rows.length > 0) {
      try {
        return JSON.parse(result.rows[0].val);
      } catch {
        return { accessCount: 0, lastAccessed: null, impacts: [], weight: 0, decayedAt: null };
      }
    }

    return { accessCount: 0, lastAccessed: null, impacts: [], weight: 0, decayedAt: null };
  }

  /**
   * Сохранить (INSERT или UPDATE) запись веса
   * @private
   */
  async _saveWeightData(database, objectId, data) {
    const db = this._validateDb(database);
    const val = JSON.stringify(data);

    // Проверяем существование
    const checkSql = `SELECT id FROM \`${db}\` WHERE up = ? AND t = ? LIMIT 1`;
    const existing = await this.db.execSql(checkSql, [objectId, JSON_DATA_TYPE], 'EmotionalWeight.checkExists');

    if (existing.rows && existing.rows.length > 0) {
      const updateSql = `UPDATE \`${db}\` SET val = ? WHERE id = ?`;
      await this.db.execSql(updateSql, [val, existing.rows[0].id], 'EmotionalWeight.update');
    } else {
      const insertSql = `INSERT INTO \`${db}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
      await this.db.execSql(insertSql, [objectId, JSON_DATA_TYPE, val], 'EmotionalWeight.insert');
    }
  }

  /**
   * Фактор давности — экспоненциальный спад с полупериодом
   *
   * recencyFactor = 2^(-age / halfLife)
   * При age=0 → 1.0, при age=14d → 0.5, при age=28d → 0.25
   *
   * @private
   */
  _calcRecency(lastAccessed) {
    if (!lastAccessed) return 0.1; // Давно не обращались — минимальный вес

    const ageMs = Date.now() - new Date(lastAccessed).getTime();
    if (ageMs <= 0) return 1.0;

    return Math.pow(2, -ageMs / this.halfLifeMs);
  }

  /**
   * Множитель воздействия — максимальный из всех записанных воздействий
   *
   * Если несколько воздействий — берём максимальный множитель.
   * Накопление: каждое дополнительное высокое воздействие +10% (до 2x от максимума).
   *
   * @private
   */
  _calcImpactMultiplier(impacts) {
    if (!impacts || impacts.length === 0) return 1.0;

    let maxMul = 1.0;
    let highImpactCount = 0;

    for (const imp of impacts) {
      const mul = IMPACT_MULTIPLIERS[imp.type] || 1.0;
      if (mul > maxMul) maxMul = mul;
      if (mul >= 2.0) highImpactCount++;
    }

    // Накопительный бонус: каждое дополнительное сильное воздействие +10%
    const accumulationBonus = Math.min(highImpactCount * 0.1, maxMul); // До 2x от максимума
    return maxMul + accumulationBonus;
  }

  /**
   * Бонус за связи — больше связей = важнее объект
   *
   * connectionBonus = 1 + (linkCount * 0.1), max 3.0
   *
   * @private
   */
  async _calcConnectionBonus(database, objectId) {
    const db = this._validateDb(database);

    try {
      // Считаем связи (тип LINK, up = objectId ИЛИ target = objectId)
      const sqlOut = `SELECT COUNT(*) as cnt FROM \`${db}\` WHERE up = ? AND t = ?`;
      const outResult = await this.db.execSql(sqlOut, [objectId, LINK_TYPE], 'EmotionalWeight.linksOut');
      const outCount = (outResult.rows && outResult.rows[0]?.cnt) || 0;

      // Входящие связи — target в JSON val
      const sqlIn = `SELECT COUNT(*) as cnt FROM \`${db}\` WHERE t = ? AND val LIKE ?`;
      const inResult = await this.db.execSql(sqlIn, [LINK_TYPE, `%"target":${objectId}%`], 'EmotionalWeight.linksIn');
      const inCount = (inResult.rows && inResult.rows[0]?.cnt) || 0;

      const linkCount = outCount + inCount;
      return Math.min(1 + linkCount * 0.1, 3.0);
    } catch (err) {
      this.logger.warn?.(`[EmotionalWeight] _calcConnectionBonus: ошибка для objectId=${objectId}`, err.message);
      return 1.0;
    }
  }

  /**
   * Валидация имени БД
   * @private
   */
  _validateDb(database) {
    if (!database || typeof database !== 'string') {
      throw new Error('EmotionalWeight: database name required');
    }
    return database.replace(/[^a-zA-Z0-9_-]/g, '');
  }
}

export default EmotionalWeight;
