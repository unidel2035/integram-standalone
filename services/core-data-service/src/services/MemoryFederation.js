/**
 * MemoryFederation — федерация памяти между серверами Integram
 *
 * Синхронизация данных между несколькими экземплярами Integram:
 *   - Двунаправленный sync (push/pull)
 *   - Разрешение конфликтов (keep_local, keep_remote, merge)
 *   - Отслеживание состояния синхронизации
 *   - Per-remote статистика
 *
 * Состояние синхронизации хранится как JSON_DATA (t=51) объекты
 * внутри той же базы Integram — «всё = объект».
 *
 * «Память не заперта в одном сервере. Федерация — это экклесия данных.»
 */

const JSON_DATA_TYPE = 51;
const SYNC_META_MARKER = '__integram_federation_sync__';
const CONFLICT_MARKER = '__integram_federation_conflict__';
const DEFAULT_SYNC_BATCH = 500;

export class MemoryFederation {
  /**
   * @param {Object} params
   * @param {Object} params.localDb — локальный DatabaseService (execSql)
   * @param {Array<{url: string, database: string, token: string}>} params.remoteNodes — удалённые узлы
   * @param {Object} [params.options] — доп. настройки
   * @param {Object} [params.options.logger] — логгер
   * @param {number} [params.options.batchSize] — размер батча синхронизации
   * @param {Function} [params.options.fetch] — кастомный fetch (для тестов)
   */
  constructor({ localDb, remoteNodes = [], options = {} }) {
    this.db = localDb;
    this.remoteNodes = remoteNodes;
    this.logger = options.logger || console;
    this.batchSize = options.batchSize || DEFAULT_SYNC_BATCH;
    this._fetch = options.fetch || globalThis.fetch;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // sync — двунаправленная синхронизация
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Полная двунаправленная синхронизация с каждым удалённым узлом.
   *
   * Алгоритм для каждого remote:
   *   1. Получить remote changes с момента lastSyncId
   *   2. Получить local changes с момента lastSyncId
   *   3. Merge: одинаковые объекты → побеждает новый (по id или timestamp)
   *   4. Push local-only → remote
   *   5. Pull remote-only → local
   *   6. Обновить sync state
   *
   * @param {string} localDatabase — имя локальной базы
   * @returns {Promise<{results: Object[], totalPushed: number, totalPulled: number, conflicts: number}>}
   */
  async sync(localDatabase) {
    const results = [];
    let totalPushed = 0;
    let totalPulled = 0;
    let totalConflicts = 0;

    for (const remote of this.remoteNodes) {
      try {
        const result = await this._syncWithRemote(localDatabase, remote);
        results.push({
          url: remote.url,
          pushed: result.pushed,
          pulled: result.pulled,
          conflicts: result.conflicts,
          status: 'ok',
        });
        totalPushed += result.pushed;
        totalPulled += result.pulled;
        totalConflicts += result.conflicts;
      } catch (error) {
        this.logger.error(`[Federation] Sync with ${remote.url} failed: ${error.message}`);
        results.push({
          url: remote.url,
          pushed: 0,
          pulled: 0,
          conflicts: 0,
          status: 'error',
          error: error.message,
        });
      }
    }

    return { results, totalPushed, totalPulled, conflicts: totalConflicts };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // push — отправить конкретные объекты на remote
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Отправить указанные объекты (с дочерними) на удалённый узел.
   *
   * @param {string} localDatabase — имя локальной базы
   * @param {{url: string, database: string, token: string}} remoteNode — целевой узел
   * @param {number[]} objectIds — массив ID объектов для отправки
   * @returns {Promise<{pushed: number, errors: Object[]}>}
   */
  async push(localDatabase, remoteNode, objectIds) {
    const errors = [];
    let pushed = 0;

    for (const objectId of objectIds) {
      try {
        // Читаем объект со всеми дочерними
        const objectTree = await this._readObjectTree(localDatabase, objectId);
        if (!objectTree) {
          errors.push({ objectId, error: 'Object not found locally' });
          continue;
        }

        // Отправляем на remote
        await this._remoteInsertObjects(remoteNode, objectTree);
        pushed++;
      } catch (error) {
        this.logger.warn(`[Federation] Push object ${objectId} to ${remoteNode.url} failed: ${error.message}`);
        errors.push({ objectId, error: error.message });
      }
    }

    this.logger.info(`[Federation] Push to ${remoteNode.url}: ${pushed} ok, ${errors.length} errors`);
    return { pushed, errors };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // pull — загрузить объекты с remote
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Загрузить объекты определённого типа с удалённого узла.
   *
   * @param {string} localDatabase — имя локальной базы
   * @param {{url: string, database: string, token: string}} remoteNode — источник
   * @param {number} typeId — тип объектов для загрузки
   * @param {number} [limit=100] — максимальное количество
   * @returns {Promise<{pulled: number, errors: Object[]}>}
   */
  async pull(localDatabase, remoteNode, typeId, limit = 100) {
    const errors = [];
    let pulled = 0;

    try {
      // Получаем объекты с remote
      const remoteObjects = await this._remoteQuery(remoteNode, {
        typeId,
        limit,
      });

      for (const obj of remoteObjects) {
        try {
          await this._insertLocalObject(localDatabase, obj);
          pulled++;
        } catch (error) {
          errors.push({ remoteId: obj.id, error: error.message });
        }
      }

      this.logger.info(`[Federation] Pull from ${remoteNode.url}: ${pulled} objects of type ${typeId}`);
    } catch (error) {
      this.logger.error(`[Federation] Pull from ${remoteNode.url} failed: ${error.message}`);
      errors.push({ typeId, error: error.message });
    }

    return { pulled, errors };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // resolveConflict — разрешение конфликтов синхронизации
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Разрешить конфликт синхронизации.
   *
   * @param {string} localDatabase — имя базы
   * @param {number} objectId — ID конфликтного объекта
   * @param {'keep_local'|'keep_remote'|'merge'} resolution — стратегия разрешения
   * @returns {Promise<{resolved: boolean, objectId: number, resolution: string}>}
   */
  async resolveConflict(localDatabase, objectId, resolution) {
    const validResolutions = ['keep_local', 'keep_remote', 'merge'];
    if (!validResolutions.includes(resolution)) {
      throw new Error(`Invalid resolution: ${resolution}. Must be one of: ${validResolutions.join(', ')}`);
    }

    try {
      // Найти конфликт
      const conflict = await this._findConflict(localDatabase, objectId);
      if (!conflict) {
        throw new Error(`No conflict found for object ${objectId}`);
      }

      switch (resolution) {
        case 'keep_local':
          // Ничего не меняем — локальная версия остаётся
          await this._markConflictResolved(localDatabase, conflict.conflictId, 'keep_local');
          break;

        case 'keep_remote':
          // Заменяем локальную версию удалённой
          await this.db.execSql(
            `UPDATE \`${localDatabase}\` SET val = ? WHERE id = ?`,
            [conflict.remoteVal, objectId],
            'Federation.resolveConflict.keepRemote'
          );
          await this._markConflictResolved(localDatabase, conflict.conflictId, 'keep_remote');
          break;

        case 'merge':
          // Конкатенация значений с разделителем
          const merged = `${conflict.localVal}\n---\n${conflict.remoteVal}`;
          await this.db.execSql(
            `UPDATE \`${localDatabase}\` SET val = ? WHERE id = ?`,
            [merged, objectId],
            'Federation.resolveConflict.merge'
          );
          await this._markConflictResolved(localDatabase, conflict.conflictId, 'merge');
          break;
      }

      this.logger.info(`[Federation] Conflict resolved: object=${objectId}, resolution=${resolution}`);
      return { resolved: true, objectId, resolution };
    } catch (error) {
      this.logger.error(`[Federation] resolveConflict failed: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // getLastSync — когда была последняя синхронизация
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Получить информацию о последней синхронизации с указанным remote.
   *
   * @param {string} localDatabase — имя базы
   * @param {string} remoteUrl — URL удалённого узла
   * @returns {Promise<{lastSyncId: number, lastSyncAt: string, remoteUrl: string, conflicts: number}|null>}
   */
  async getLastSync(localDatabase, remoteUrl) {
    try {
      const marker = JSON.stringify(SYNC_META_MARKER);
      const urlPart = JSON.stringify(remoteUrl);

      const sql = `
        SELECT id, val
        FROM \`${localDatabase}\`
        WHERE t = ?
          AND val LIKE ?
          AND val LIKE ?
        ORDER BY id DESC
        LIMIT 1
      `;
      const result = await this.db.execSql(
        sql,
        [JSON_DATA_TYPE, `%${SYNC_META_MARKER}%`, `%${this._escapeLike(remoteUrl)}%`],
        'Federation.getLastSync'
      );

      const rows = result.rows || [];
      if (rows.length === 0) return null;

      try {
        const data = JSON.parse(rows[0].val);
        return {
          lastSyncId: data.lastSyncId || 0,
          lastSyncAt: data.lastSyncAt || null,
          remoteUrl: data.remoteUrl,
          conflicts: data.conflicts || 0,
        };
      } catch {
        return null;
      }
    } catch (error) {
      this.logger.error(`[Federation] getLastSync failed: ${error.message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // getSyncStats — статистика синхронизации по всем remote
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Статистика синхронизации для каждого удалённого узла.
   *
   * @param {string} localDatabase — имя базы
   * @returns {Promise<{remotes: Object[], totalSyncs: number, unresolvedConflicts: number}>}
   */
  async getSyncStats(localDatabase) {
    try {
      // Собрать все sync-записи
      const sql = `
        SELECT id, val
        FROM \`${localDatabase}\`
        WHERE t = ? AND val LIKE ?
        ORDER BY id DESC
      `;
      const result = await this.db.execSql(
        sql,
        [JSON_DATA_TYPE, `%${SYNC_META_MARKER}%`],
        'Federation.getSyncStats'
      );

      const rows = result.rows || [];
      const byRemote = new Map();

      for (const row of rows) {
        try {
          const data = JSON.parse(row.val);
          if (data.marker !== SYNC_META_MARKER) continue;

          const url = data.remoteUrl;
          if (!byRemote.has(url)) {
            byRemote.set(url, {
              url,
              lastSyncId: data.lastSyncId || 0,
              lastSyncAt: data.lastSyncAt || null,
              totalSyncs: 0,
              totalPushed: 0,
              totalPulled: 0,
              conflicts: 0,
            });
          }

          const stats = byRemote.get(url);
          stats.totalSyncs++;
          stats.totalPushed += data.pushed || 0;
          stats.totalPulled += data.pulled || 0;

          // Обновляем lastSync если id больше
          if (data.lastSyncId > stats.lastSyncId) {
            stats.lastSyncId = data.lastSyncId;
            stats.lastSyncAt = data.lastSyncAt;
          }
        } catch {
          // Невалидный JSON — пропускаем
        }
      }

      // Посчитать неразрешённые конфликты
      const conflictSql = `
        SELECT COUNT(*) as cnt
        FROM \`${localDatabase}\`
        WHERE t = ? AND val LIKE ? AND val LIKE ?
      `;
      const conflictResult = await this.db.execSql(
        conflictSql,
        [JSON_DATA_TYPE, `%${CONFLICT_MARKER}%`, '%"resolved":false%'],
        'Federation.getSyncStats.conflicts'
      );
      const unresolvedConflicts = conflictResult.rows?.[0]?.cnt || 0;

      const remotes = Array.from(byRemote.values());
      const totalSyncs = remotes.reduce((sum, r) => sum + r.totalSyncs, 0);

      return { remotes, totalSyncs, unresolvedConflicts };
    } catch (error) {
      this.logger.error(`[Federation] getSyncStats failed: ${error.message}`);
      return { remotes: [], totalSyncs: 0, unresolvedConflicts: 0 };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Приватные методы
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Синхронизация с одним удалённым узлом.
   *
   * @param {string} localDatabase
   * @param {{url: string, database: string, token: string}} remote
   * @returns {Promise<{pushed: number, pulled: number, conflicts: number}>}
   * @private
   */
  async _syncWithRemote(localDatabase, remote) {
    // 1. Получить lastSyncId
    const lastSync = await this.getLastSync(localDatabase, remote.url);
    const lastSyncId = lastSync?.lastSyncId || 0;

    // 2. Получить remote changes
    const remoteChanges = await this._remoteGetChangesSince(remote, lastSyncId);

    // 3. Получить local changes
    const localChanges = await this._getLocalChangesSince(localDatabase, lastSyncId);

    // 4. Определить что куда: local-only, remote-only, конфликты
    const localIds = new Set(localChanges.map(o => o.id));
    const remoteIds = new Set(remoteChanges.map(o => o.id));

    const localOnly = localChanges.filter(o => !remoteIds.has(o.id));
    const remoteOnly = remoteChanges.filter(o => !localIds.has(o.id));
    const conflicting = localChanges.filter(o => remoteIds.has(o.id));

    // 5. Push local-only → remote
    let pushed = 0;
    for (const obj of localOnly) {
      try {
        await this._remoteInsertObjects(remote, [obj]);
        pushed++;
      } catch (error) {
        this.logger.warn(`[Federation] Push ${obj.id} failed: ${error.message}`);
      }
    }

    // 6. Pull remote-only → local
    let pulled = 0;
    for (const obj of remoteOnly) {
      try {
        await this._insertLocalObject(localDatabase, obj);
        pulled++;
      } catch (error) {
        this.logger.warn(`[Federation] Pull remote ${obj.id} failed: ${error.message}`);
      }
    }

    // 7. Конфликты — сохраняем для ручного разрешения
    let conflicts = 0;
    for (const localObj of conflicting) {
      const remoteObj = remoteChanges.find(r => r.id === localObj.id);
      if (remoteObj) {
        // Сравниваем по id (более высокий = более новый в Integram)
        // Если значения одинаковые — не конфликт
        if (localObj.val !== remoteObj.val) {
          await this._recordConflict(localDatabase, localObj, remoteObj, remote.url);
          conflicts++;
        }
      }
    }

    // 8. Обновить sync state
    const maxRemoteId = remoteChanges.length > 0
      ? Math.max(...remoteChanges.map(o => o.id))
      : lastSyncId;
    const maxLocalId = localChanges.length > 0
      ? Math.max(...localChanges.map(o => o.id))
      : lastSyncId;
    const newSyncId = Math.max(maxRemoteId, maxLocalId, lastSyncId);

    await this._saveSyncState(localDatabase, remote.url, {
      lastSyncId: newSyncId,
      pushed,
      pulled,
      conflicts,
    });

    this.logger.info(`[Federation] Sync with ${remote.url}: pushed=${pushed}, pulled=${pulled}, conflicts=${conflicts}`);
    return { pushed, pulled, conflicts };
  }

  /**
   * Получить локальные изменения с момента lastSyncId.
   *
   * @param {string} database
   * @param {number} sinceId
   * @returns {Promise<Object[]>}
   * @private
   */
  async _getLocalChangesSince(database, sinceId) {
    const sql = `
      SELECT id, up, t, val
      FROM \`${database}\`
      WHERE id > ?
      ORDER BY id ASC
      LIMIT ?
    `;
    const result = await this.db.execSql(sql, [sinceId, this.batchSize], 'Federation.localChanges');
    return result.rows || [];
  }

  /**
   * Получить remote changes через REST API.
   *
   * @param {{url: string, database: string, token: string}} remote
   * @param {number} sinceId
   * @returns {Promise<Object[]>}
   * @private
   */
  async _remoteGetChangesSince(remote, sinceId) {
    const url = `${remote.url}/api/v2/query/${remote.database}`;
    const body = {
      sql: `SELECT id, up, t, val FROM \`${remote.database}\` WHERE id > ? ORDER BY id ASC LIMIT ?`,
      params: [sinceId, this.batchSize],
    };

    const response = await this._fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${remote.token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Remote query failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.rows || data.results || data || [];
  }

  /**
   * Отправить объекты на удалённый сервер.
   *
   * @param {{url: string, database: string, token: string}} remote
   * @param {Object[]} objects
   * @private
   */
  async _remoteInsertObjects(remote, objects) {
    const url = `${remote.url}/api/v2/objects/${remote.database}/batch`;
    const body = {
      objects: Array.isArray(objects) ? objects.map(o => ({
        value: o.val,
        typeId: o.t,
        parentId: o.up || 0,
      })) : [{
        value: objects.val,
        typeId: objects.t,
        parentId: objects.up || 0,
      }],
    };

    const response = await this._fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${remote.token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Remote insert failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Получить объекты с remote по типу.
   *
   * @param {{url: string, database: string, token: string}} remote
   * @param {{typeId: number, limit: number}} params
   * @returns {Promise<Object[]>}
   * @private
   */
  async _remoteQuery(remote, { typeId, limit }) {
    const url = `${remote.url}/api/v2/query/${remote.database}`;
    const body = {
      sql: `SELECT id, up, t, val FROM \`${remote.database}\` WHERE t = ? ORDER BY id DESC LIMIT ?`,
      params: [typeId, limit],
    };

    const response = await this._fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${remote.token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Remote query failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.rows || data.results || data || [];
  }

  /**
   * Читать объект со всеми дочерними (дерево).
   *
   * @param {string} database
   * @param {number} objectId
   * @returns {Promise<Object[]|null>}
   * @private
   */
  async _readObjectTree(database, objectId) {
    // Корневой объект
    const rootSql = `SELECT id, up, t, val FROM \`${database}\` WHERE id = ?`;
    const rootResult = await this.db.execSql(rootSql, [objectId], 'Federation.readTree.root');
    const rootRows = rootResult.rows || [];
    if (rootRows.length === 0) return null;

    // Дочерние (один уровень)
    const childSql = `SELECT id, up, t, val FROM \`${database}\` WHERE up = ?`;
    const childResult = await this.db.execSql(childSql, [objectId], 'Federation.readTree.children');
    const childRows = childResult.rows || [];

    return [rootRows[0], ...childRows];
  }

  /**
   * Вставить объект локально.
   *
   * @param {string} database
   * @param {Object} obj — {id, up, t, val}
   * @private
   */
  async _insertLocalObject(database, obj) {
    const sql = `INSERT INTO \`${database}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
    await this.db.execSql(sql, [obj.up || 0, obj.t, obj.val || ''], 'Federation.insertLocal');
  }

  /**
   * Записать конфликт для ручного разрешения.
   *
   * @param {string} database
   * @param {Object} localObj
   * @param {Object} remoteObj
   * @param {string} remoteUrl
   * @private
   */
  async _recordConflict(database, localObj, remoteObj, remoteUrl) {
    const conflict = {
      marker: CONFLICT_MARKER,
      objectId: localObj.id,
      localVal: localObj.val,
      remoteVal: remoteObj.val,
      remoteUrl,
      resolved: false,
      detectedAt: new Date().toISOString(),
    };

    const sql = `INSERT INTO \`${database}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
    await this.db.execSql(
      sql,
      [localObj.id, JSON_DATA_TYPE, JSON.stringify(conflict)],
      'Federation.recordConflict'
    );
  }

  /**
   * Найти конфликт для объекта.
   *
   * @param {string} database
   * @param {number} objectId
   * @returns {Promise<{conflictId: number, localVal: string, remoteVal: string}|null>}
   * @private
   */
  async _findConflict(database, objectId) {
    const sql = `
      SELECT id, val
      FROM \`${database}\`
      WHERE up = ? AND t = ? AND val LIKE ? AND val LIKE ?
      ORDER BY id DESC
      LIMIT 1
    `;
    const result = await this.db.execSql(
      sql,
      [objectId, JSON_DATA_TYPE, `%${CONFLICT_MARKER}%`, '%"resolved":false%'],
      'Federation.findConflict'
    );

    const rows = result.rows || [];
    if (rows.length === 0) return null;

    try {
      const data = JSON.parse(rows[0].val);
      return {
        conflictId: rows[0].id,
        localVal: data.localVal,
        remoteVal: data.remoteVal,
      };
    } catch {
      return null;
    }
  }

  /**
   * Отметить конфликт как разрешённый.
   *
   * @param {string} database
   * @param {number} conflictId
   * @param {string} resolution
   * @private
   */
  async _markConflictResolved(database, conflictId, resolution) {
    // Читаем текущее значение конфликта
    const readSql = `SELECT val FROM \`${database}\` WHERE id = ?`;
    const readResult = await this.db.execSql(readSql, [conflictId], 'Federation.readConflict');
    const rows = readResult.rows || [];
    if (rows.length === 0) return;

    try {
      const data = JSON.parse(rows[0].val);
      data.resolved = true;
      data.resolution = resolution;
      data.resolvedAt = new Date().toISOString();

      const updateSql = `UPDATE \`${database}\` SET val = ? WHERE id = ?`;
      await this.db.execSql(updateSql, [JSON.stringify(data), conflictId], 'Federation.resolveConflict.mark');
    } catch {
      // Если не удалось распарсить — просто удаляем конфликт
      const deleteSql = `DELETE FROM \`${database}\` WHERE id = ?`;
      await this.db.execSql(deleteSql, [conflictId], 'Federation.resolveConflict.delete');
    }
  }

  /**
   * Сохранить состояние синхронизации.
   *
   * @param {string} database
   * @param {string} remoteUrl
   * @param {{lastSyncId: number, pushed: number, pulled: number, conflicts: number}} state
   * @private
   */
  async _saveSyncState(database, remoteUrl, state) {
    const syncRecord = {
      marker: SYNC_META_MARKER,
      remoteUrl,
      lastSyncId: state.lastSyncId,
      lastSyncAt: new Date().toISOString(),
      pushed: state.pushed || 0,
      pulled: state.pulled || 0,
      conflicts: state.conflicts || 0,
    };

    const sql = `INSERT INTO \`${database}\` (up, ord, t, val) VALUES (?, 0, ?, ?)`;
    await this.db.execSql(
      sql,
      [1, JSON_DATA_TYPE, JSON.stringify(syncRecord)],
      'Federation.saveSyncState'
    );
  }

  /**
   * Экранировать спецсимволы SQL LIKE.
   *
   * @param {string} str
   * @returns {string}
   * @private
   */
  _escapeLike(str) {
    if (!str) return '';
    return str.replace(/[%_\\]/g, '\\$&');
  }
}

export default MemoryFederation;
