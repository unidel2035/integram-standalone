/**
 * Integram V2 API Client — клиент для нового AI Data Layer API
 *
 * Использует REST V2 эндпоинты на api.ai2o.ru:
 * - Schema: GET /api/v2/databases/:db/schema
 * - Search: POST /api/v2/databases/:db/search
 * - Batch: POST /api/v2/databases/:db/batch
 * - Transactions: GET /api/v2/databases/:db/transactions
 * - Audit: GET /api/v2/databases/:db/audit
 * - Ontology: GET /api/v2/databases/:db/ontology
 * - Events: GET /api/v2/databases/:db/events (SSE)
 */

import axios from 'axios'
import { getIntegramV2DatabaseUrl, getIntegramServerUrl, getIntegramSystemCredentials } from '../../utils/integramConfig.js'
import { autoBackup as _autoBackup, readBackup as _readBackup } from './auto-backup.js'

// ── Caches (shared across instances per database) ────────────────────────
const _schemaCache = new Map()  // db → { data, ts }
const _relCache = new Map()     // db → { data, ts }
const _statsCache = new Map()   // db → { data, ts }
const SCHEMA_TTL = 300_000      // 5 minutes (schema changes rarely)
const REL_TTL = 300_000         // 5 minutes
const STATS_TTL = 120_000       // 2 minutes (stats can change more often)

/** Clear all caches for a database (call after schema changes) */
export function clearCache(database) {
  if (database) {
    _schemaCache.delete(database)
    _relCache.delete(database)
    _statsCache.delete(database)
  } else {
    _schemaCache.clear()
    _relCache.clear()
    _statsCache.clear()
  }
}

/** Retry wrapper with exponential backoff */
async function withRetry(fn, { retries = 2, baseDelay = 1000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isRetryable = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' ||
        err.response?.status === 502 || err.response?.status === 503 || err.response?.status === 504
      if (attempt >= retries || !isRetryable) throw err
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

export class IntegramV2Client {
  /**
   * @param {string} [database] — имя базы данных
   * @param {Object} [options] — { baseUrl }
   */
  constructor(database, options = {}) {
    this.database = database || 'kval'
    this.baseUrl = options.baseUrl || getIntegramV2DatabaseUrl(this.database)
    this.axios = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    })

    // V1 auth state (lazy-init)
    this._v1Token = null
    this._v1Xsrf = null
    this._v1AuthPromise = null
    const server = getIntegramServerUrl()
    this._v1BaseUrl = server.includes('localhost')
      ? `http://${server}`
      : `https://${server}`
  }


  // ── V1 Fallback (auth + CRUD + objects with requisites) ────────────────

  /** Build V1 API URL with JSON_KV suffix */
  _v1Url(endpoint) {
    return `${this._v1BaseUrl}/${this.database}/${endpoint}?JSON_KV`
  }

  /** Log V1 fallback usage */
  _logFallback(method, reason) {
    const ts = new Date().toISOString().slice(11, 19)
    console.error(`[V2→V1 ${ts}] ${method}: ${reason}`)
  }

  /** Authenticate via V1 API (lazy, cached) */
  async _ensureV1Auth() {
    if (this._v1Token) return
    if (this._v1AuthPromise) return this._v1AuthPromise

    this._v1AuthPromise = (async () => {
      const creds = getIntegramSystemCredentials()
      const formData = new URLSearchParams()
      formData.append('login', creds.username)
      formData.append('pwd', creds.password)

      const resp = await axios.post(this._v1Url('auth'), formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })

      if (resp.data.failed) throw new Error('V1 auth failed')
      this._v1Token = resp.data.token
      this._v1Xsrf = resp.data._xsrf

      // Refresh XSRF
      try {
        const xsrfResp = await axios.get(this._v1Url('xsrf'), {
          headers: { 'X-Authorization': this._v1Token }
        })
        this._v1Xsrf = xsrfResp.data._xsrf || this._v1Xsrf
      } catch (_) {}
    })()

    try {
      await this._v1AuthPromise
    } finally {
      this._v1AuthPromise = null
    }
  }

  /** V1 POST helper (with XSRF) */
  async _v1Post(endpoint, data = {}) {
    await this._ensureV1Auth()
    const postData = new URLSearchParams()
    if (this._v1Xsrf) postData.append('_xsrf', this._v1Xsrf)
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) postData.append(key, value)
    }
    const resp = await axios.post(this._v1Url(endpoint), postData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Authorization': this._v1Token
      }
    })
    return resp.data
  }

  async _v1Get(endpoint) {
    await this._ensureV1Auth()
    const resp = await axios.get(this._v1Url(endpoint), {
      headers: { 'X-Authorization': this._v1Token }
    })
    return resp.data
  }

  /**
   * Get ALL objects with requisites via V1 API (with pagination)
   * Returns { objects: [...], reqs: {...}, reqAliases: {reqId: name}, total }
   */
  async _getObjectsV1(typeId, { maxRecords = 2000 } = {}) {
    await this._ensureV1Auth()
    const pageSize = 200
    const maxPages = Math.ceil(maxRecords / pageSize)
    const allObjects = []
    const allReqs = {}
    let reqAliases = {}
    let refTypes = {} // {reqId: targetTypeId} — which columns are references
    let total = 0

    for (let page = 1; page <= maxPages; page++) {
      const resp = await axios.get(this._v1Url(`object/${typeId}`), {
        params: { pg: page, LIMIT: pageSize, F_U: 1, f_show_all: 1 },
        headers: { 'X-Authorization': this._v1Token }
      })

      const objects = resp.data?.object || []
      total = resp.data?.cnt || total
      if (objects.length === 0) break

      // Build aliases + detect reference columns
      if (page === 1) {
        refTypes = resp.data?.ref_type || {} // {reqId: targetTypeId}
        const attrs = resp.data?.req_attrs || {}
        const types = resp.data?.req_type || {}
        for (const reqId of Object.keys({ ...types, ...attrs })) {
          const attr = (attrs[reqId] || '').trim()
          const aliasMatch = attr.match(/:ALIAS=([^:]+):/)
          if (aliasMatch) {
            reqAliases[reqId] = aliasMatch[1]
          } else if (attr && attr !== '') {
            reqAliases[reqId] = attr  // raw alias from _d_alias
          } else {
            reqAliases[reqId] = types[reqId] || reqId
          }
        }
      }

      allObjects.push(...objects)
      Object.assign(allReqs, resp.data?.reqs || {})

      if (objects.length < pageSize) break  // last page
      if (allObjects.length >= maxRecords) break
    }

    return { objects: allObjects, reqs: allReqs, reqAliases, refTypes, total }
  }

  // ── V1 CRUD (create/update/delete) ─────────────────────────────────────

  /** Create object via V1 (_m_new/{typeId}) */
  async _createObjectV1(typeId, value, requisites = {}) {
    this._logFallback('createObject', `typeId=${typeId}`)
    const data = { [`t${typeId}`]: value, up: 1 }
    // Add requisites with t prefix
    for (const [reqId, val] of Object.entries(requisites)) {
      if (val !== null && val !== undefined) data[`t${reqId}`] = val
    }
    const result = await this._v1Post(`_m_new/${typeId}`, data)
    const objId = result?.obj || result?.id
    if (!objId) throw new Error(`V1 _m_new returned no ID: ${JSON.stringify(result).slice(0, 200)}`)

    // Set requisites via _m_set for reliability (references, multi-value)
    for (const [reqId, val] of Object.entries(requisites)) {
      try {
        await this._v1Post('_m_set', { obj: objId, req: reqId, value: val })
      } catch (_) {} // best-effort
    }
    return { id: objId, value, requisites }
  }

  /** Update object value via V1 (_m_save) */
  async _updateObjectV1(objectId, value) {
    this._logFallback('updateObject', `objectId=${objectId}`)
    return this._v1Post('_m_save', { obj: objectId, val: value })
  }

  /** Set requisite value via V1 (_m_set) */
  async _setRequisiteV1(objectId, reqId, value) {
    return this._v1Post('_m_set', { obj: objectId, req: reqId, value })
  }

  /** Delete object via V1 (_m_del) */
  async _deleteObjectV1(objectId) {
    this._logFallback('deleteObject', `objectId=${objectId}`)
    return this._v1Post('_m_del', { obj: objectId })
  }

  // ── Public CRUD API (V2-first, V1 fallback inside) ──────────────────────

  /**
   * Получить все объекты типа с их значениями
   * @returns {Array<{id, val, reqs: {alias: {id, value, displayValue}}}>}
   */
  async getObjects(typeId, { limit = 2000, withReqs = true, resolveRefs = false } = {}) {
    // V2 /types/{id}/objects returns only {id, val, up, t, ord} — no requisites
    // For simple lookups (справочники with just val), V2 is enough
    // For tables with columns, need V1 which returns full reqs

    if (!withReqs) {
      // Fast path: V2 only, no reqs needed (e.g., reading справочник values)
      try {
        const { data } = await this.axios.get(`/types/${typeId}/objects`, { params: { limit } })
        return (data.data || []).map(obj => ({
          id: obj.id, val: obj.val || obj.value || '', reqs: {}
        }))
      } catch (_) {}
    }

    // Full path: V1 with requisites (V2 doesn't support reqs yet)
    const v1 = await this._getObjectsV1(typeId, { maxRecords: limit })
    const reqAliases = v1.reqAliases || {}

    // Auto-resolve reference IDs → display values
    const refLookup = new Map() // targetTypeId → Map(objId → val)
    if (resolveRefs && Object.keys(v1.refTypes).length > 0) {
      for (const [, targetTypeId] of Object.entries(v1.refTypes)) {
        if (refLookup.has(targetTypeId)) continue
        try {
          const refObjs = await this.getObjects(String(targetTypeId), { limit: 2000, withReqs: false })
          const m = new Map()
          refObjs.forEach(o => m.set(String(o.id), o.val))
          refLookup.set(targetTypeId, m)
        } catch (_) { refLookup.set(targetTypeId, new Map()) }
      }
    }

    return v1.objects.map(obj => {
      const reqs = {}
      for (const [reqId, rawVal] of Object.entries(v1.reqs[obj.id] || {})) {
        if (reqId.startsWith('ref_')) continue
        const val = typeof rawVal === 'string' ? rawVal : rawVal?.value || String(rawVal || '')
        const alias = reqAliases[reqId] || reqId
        // Resolve reference display value
        let displayValue = val
        const targetTypeId = v1.refTypes[reqId]
        if (resolveRefs && targetTypeId && refLookup.has(targetTypeId)) {
          displayValue = refLookup.get(targetTypeId).get(String(val)) || val
        }
        reqs[reqId] = { id: reqId, value: val, displayValue, alias }
      }
      return { id: obj.id, val: obj.val || '', reqs }
    })
  }

  /**
   * Создать тип (таблицу-справочник). baseType=3 → SHORT
   * @returns {string} новый typeId
   */
  async createType(name, baseType = 3) {
    // V1 only: _d_new creates types
    await this._ensureV1Auth()
    const result = await this._v1Post('_d_new', { val: name, t: String(baseType) })
    const typeId = result?.obj || result?.id
    if (!typeId || typeId === '') throw new Error(`createType failed: ${JSON.stringify(result).slice(0, 200)}`)
    this.clearCache() // schema changed
    return String(typeId)
  }

  /**
   * Создать объект (запись) в таблице
   * @returns {{id: string, value: string}}
   */
  async createObject(typeId, value, requisites = {}) {
    return this._createObjectV1(typeId, value, requisites)
  }

  /**
   * Добавить reference-колонку к типу
   * @returns {{reqId: string, alreadyExists: boolean}}
   */
  async addRequisite(typeId, refTypeId) {
    await this._ensureV1Auth()
    // Resolve base types (3=SHORT, 5=MEMO, 7=DATE, 8=FILE, 13=NUMBER, etc.) to concrete types
    const BASE_TYPE_IDS = new Set([2,3,4,5,7,8,9,10,11,12,13,14,15,16,17])
    let resolvedTypeId = refTypeId
    if (BASE_TYPE_IDS.has(Number(refTypeId))) {
      resolvedTypeId = await this._resolveBaseType(Number(refTypeId))
    }
    const result = await this._v1Post(`_d_req/${typeId}`, { t: String(resolvedTypeId) })
    // _d_req returns: {id: newReqId, obj: parentTypeId, warnings: "..."}
    const reqId = result?.id
    const alreadyExists = (result?.warnings || '').includes('уже существует')
    if (!reqId || reqId === '') throw new Error(`addRequisite failed: ${JSON.stringify(result).slice(0, 200)}`)
    return { reqId: String(reqId), alreadyExists }
  }

  async _resolveBaseType(baseTypeId) {
    await this._ensureV1Auth()
    const resp = await this._v1Get('edit_types')
    const et = resp?.edit_types || resp || {}
    const ids = et.id || et['0'] || []
    const baseTypes = et.t || et['1'] || []
    const seen = new Set()
    for (let i = 0; i < ids.length; i++) {
      const id = parseInt(ids[i])
      const bt = parseInt(baseTypes[i])
      if (bt === baseTypeId && !seen.has(id)) return id
      seen.add(id)
    }
    throw new Error(`Некорректный тип ${baseTypeId} - это базовый тип`)
  }

  /**
   * Задать alias для колонки
   * V1 _d_alias stores the alias string in req_attrs
   */
  async setAlias(reqId, alias) {
    await this._ensureV1Auth()
    return this._v1Post(`_d_alias/${reqId}`, { alias })
  }

  /**
   * Установить значение реквизита (reference или текст)
   */
  async setRequisiteValue(objectId, reqId, value) {
    await this._ensureV1Auth()
    return this._v1Post(`_m_set/${objectId}`, { [`t${reqId}`]: String(value) })
  }

  /**
   * Удалить колонку (реквизит) — с автобэкапом
   */
  async deleteRequisite(reqId) {
    await _autoBackup('deleteRequisite', { id: reqId, database: this.database }, { reqId })
    await this._ensureV1Auth()
    const result = await this._v1Post(`_d_req_del/${reqId}`, {})
    this.clearCache() // schema changed
    return result
  }

  /**
   * Удалить объект — с автобэкапом
   */
  async deleteObject(objectId) {
    await _autoBackup('deleteObject', { id: objectId, database: this.database }, { objectId })
    return this._deleteObjectV1(objectId)
  }

  /**
   * Удалить тип (таблицу) — с автобэкапом. Сохраняет все объекты перед удалением.
   */
  async deleteType(typeId) {
    // Backup all objects before deleting
    let backupData = { typeId, database: this.database }
    try {
      const objects = await this.getObjects(typeId, { limit: 5000, withReqs: false })
      backupData.objects = objects
      backupData.objectCount = objects.length
    } catch (_) {}
    await _autoBackup('deleteType', { id: typeId, database: this.database }, backupData)

    await this._ensureV1Auth()
    const result = await this._v1Post(`_d_del/${typeId}`, {})
    this.clearCache() // schema changed
    return result
  }

  /**
   * Переименовать тип (таблицу)
   */
  async renameType(typeId, newName, baseTypeId = 3) {
    await this._ensureV1Auth()
    return this._v1Post(`_d_save/${typeId}`, { [`t${baseTypeId}`]: newName })
  }

  /**
   * Get column aliases for a type: {reqId: "Column Name"}
   * Uses req_attrs (:ALIAS=Name:) with req_type as fallback
   */
  async getReqAliases(typeId) {
    await this._ensureV1Auth()
    const resp = await axios.get(this._v1Url(`object/${typeId}`), {
      params: { pg: 1, LIMIT: 1, F_U: 1, f_show_all: 1 },
      headers: { 'X-Authorization': this._v1Token }
    })
    const attrs = resp.data?.req_attrs || {}
    const types = resp.data?.req_type || {}
    const result = {}
    for (const reqId of Object.keys({ ...types, ...attrs })) {
      const attr = (attrs[reqId] || '').trim()
      const aliasMatch = attr.match(/:ALIAS=([^:]+):/)
      if (aliasMatch) {
        result[reqId] = aliasMatch[1]
      } else if (attr && attr !== '') {
        result[reqId] = attr
      } else {
        result[reqId] = types[reqId] || reqId
      }
    }
    return result
  }

  // ── Поиск таблиц по имени ────────────────────────────────────────────────

  /**
   * Найти таблицы по имени (pattern match, case-insensitive)
   * @param {string} pattern — подстрока или regex для поиска
   * @returns {Array<{id, name, count, fieldCount}>}
   */
  async findTypeByName(pattern) {
    const schema = await this.getSchemaFull()
    const types = schema?.types || []
    const lower = pattern.toLowerCase()
    return types
      .filter(t => (t.name || '').toLowerCase().includes(lower))
      .map(t => ({
        id: t.id,
        name: t.name || `type_${t.id}`,
        count: t.count || 0,
        fieldCount: (t.requisites || []).length
      }))
      .sort((a, b) => b.count - a.count)
  }

  /**
   * Обновить основное значение объекта (val)
   */
  async updateObjectValue(objectId, newValue) {
    return this._updateObjectV1(objectId, newValue)
  }

  /**
   * Пакетное создание объектов
   * @param {string} typeId — ID таблицы
   * @param {Array<{value: string, requisites?: Object}>} items — массив записей
   * @returns {Array<{id, value}>}
   */
  async bulkCreateObjects(typeId, items) {
    const results = []
    for (const item of items) {
      try {
        const created = await this.createObject(typeId, item.value, item.requisites || {})
        results.push({ ...created, success: true })
      } catch (e) {
        results.push({ value: item.value, success: false, error: e.message })
      }
    }
    return results
  }

  /**
   * Восстановить данные из бэкапа
   * @param {string} filename — имя файла бэкапа
   * @returns {{restored: number, operation: string, details: Object}}
   */
  async restoreFromBackup(filename) {
    const backup = await _readBackup(filename)
    if (!backup) throw new Error(`Бэкап не найден: ${filename}`)

    const operation = backup.operation
    let restored = 0

    if (operation === 'deleteType') {
      // Восстановить тип: создать таблицу + объекты
      const data = backup.data || backup
      const objects = data.objects || []
      // Can't restore type with same ID — create new
      // Just restore objects if typeId still exists, or warn
      return {
        restored: 0,
        operation,
        warning: 'Восстановление типов требует ручного создания. Данные бэкапа:',
        typeId: data.typeId || backup.id,
        objectCount: objects.length,
        objects: objects.slice(0, 10)
      }
    } else if (operation === 'deleteObject') {
      // Object backups contain minimal data — can't fully restore
      return {
        restored: 0,
        operation,
        data: backup.data,
        hint: 'Для восстановления объекта используйте createObject с данными из бэкапа'
      }
    }

    return { restored, operation, backup }
  }

  /**
   * Массовое обновление объектов
   * @param {Array<{objectId: string, value?: string, requisites?: Object}>} updates
   * @returns {{updated: number, failed: number, results: Array}}
   */
  async bulkUpdateObjects(updates) {
    const results = []
    for (const { objectId, value, requisites } of updates) {
      try {
        if (value !== undefined) {
          await this.updateObjectValue(String(objectId), value)
        }
        if (requisites) {
          for (const [reqId, val] of Object.entries(requisites)) {
            await this.setRequisiteValue(String(objectId), reqId, val)
          }
        }
        results.push({ objectId, success: true })
      } catch (e) {
        results.push({ objectId, success: false, error: e.message })
      }
    }
    return results
  }

  /**
   * Массовое удаление объектов — с автобэкапом каждого
   * @param {string[]} objectIds
   * @returns {{deleted: number, failed: number, results: Array}}
   */
  async bulkDeleteObjects(objectIds) {
    const results = []
    for (const id of objectIds) {
      try {
        await this.deleteObject(String(id))
        results.push({ objectId: id, success: true })
      } catch (e) {
        results.push({ objectId: id, success: false, error: e.message })
      }
    }
    return results
  }

  // ── Reports (Отчёты Integram) ─────────────────────────────────────────────

  /**
   * Получить список отчётов
   * @returns {Array<{id, name, description}>}
   */
  async getReports() {
    await this._ensureV1Auth()
    // Try V1 reports endpoint
    try {
      const resp = await axios.get(this._v1Url('reports'), {
        headers: { 'X-Authorization': this._v1Token }
      })
      const raw = resp.data
      // V1 may return different formats
      if (Array.isArray(raw)) {
        return raw.map(r => ({
          id: r.id || r.ID,
          name: r.name || r.val || r.NAME || `report_${r.id}`,
          description: r.description || r.desc || ''
        }))
      }
      const list = raw?.reports || raw?.object || raw?.data || []
      if (Array.isArray(list) && list.length > 0) {
        return list.map(r => ({
          id: r.id || r.ID,
          name: r.name || r.val || `report_${r.id}`,
          description: r.description || ''
        }))
      }
      // If raw is object with IDs as keys
      if (typeof raw === 'object' && !Array.isArray(raw)) {
        return Object.entries(raw)
          .filter(([k]) => !['error', 'token', '_xsrf'].includes(k))
          .map(([id, val]) => ({
            id,
            name: typeof val === 'string' ? val : (val?.name || val?.val || `report_${id}`),
            description: ''
          }))
      }
      return []
    } catch (e) {
      // Fallback: look for report-type tables in schema
      const schema = await this.getSchemaFull()
      const reportTables = (schema?.types || [])
        .filter(t => (t.name || '').toLowerCase().includes('отчёт') || (t.name || '').toLowerCase().includes('отчет') || (t.name || '').toLowerCase().includes('report'))
        .map(t => ({ id: t.id, name: t.name, objectCount: t.count || 0 }))
      return reportTables
    }
  }

  /**
   * Выполнить отчёт — вернуть данные
   * @param {string} reportId
   * @param {Object} [params] — параметры отчёта (фильтры)
   * @returns {{columns: Array, rows: Array, totalRows: number}}
   */
  async executeReport(reportId, params = {}) {
    await this._ensureV1Auth()
    const resp = await axios.get(this._v1Url(`report/${reportId}`), {
      params: { ...params, LIMIT: params.limit || 500, pg: params.page || 1 },
      headers: { 'X-Authorization': this._v1Token }
    })
    const raw = resp.data
    // Parse V1 report format
    const objects = raw?.object || []
    const reqAttrs = raw?.req_attrs || {}
    const reqType = raw?.req_type || {}
    const reqs = raw?.reqs || {}

    // Build column names
    const columns = Object.keys({ ...reqAttrs, ...reqType }).map(reqId => {
      const attr = (reqAttrs[reqId] || '').trim()
      const aliasMatch = attr.match(/:ALIAS=([^:]+):/)
      return {
        id: reqId,
        name: aliasMatch ? aliasMatch[1] : (attr || reqType[reqId] || reqId)
      }
    })

    // Build rows
    const rows = objects.map(obj => {
      const row = { id: obj.id, val: obj.val || '' }
      for (const col of columns) {
        const objReqs = reqs[obj.id] || {}
        row[col.name] = objReqs[col.id] || ''
      }
      return row
    })

    return {
      reportId,
      columns: columns.map(c => c.name),
      rows,
      totalRows: raw?.cnt || rows.length
    }
  }

  /**
   * Создать cross-table сводку — агентская альтернатива отчётам
   * Собирает данные из нескольких связанных таблиц
   * @param {Object} config
   * @param {string} config.mainTypeId — основная таблица
   * @param {Array<{typeId, joinField, selectFields}>} config.joins — связанные таблицы
   * @param {number} [config.limit=100]
   * @returns {{columns: string[], rows: Array, stats: Object}}
   */
  async crossTableQuery(config) {
    const { mainTypeId, joins = [], limit = 100 } = config

    // 1. Load main table
    const mainObjects = await this.getObjects(mainTypeId, { limit, withReqs: true })

    // 2. Load join tables
    const joinData = {}
    for (const join of joins) {
      const objects = await this.getObjects(join.typeId, { limit: 2000, withReqs: true })
      joinData[join.typeId] = objects
    }

    // Helper: flatten reqs {reqId: {alias, value}} → {alias: value}
    const flattenReqs = (reqs) => {
      const flat = {}
      for (const [, r] of Object.entries(reqs || {})) {
        const key = r.alias || r.id
        flat[key] = r.displayValue || r.value || ''
      }
      return flat
    }

    // 3. Build joined rows
    const rows = mainObjects.map(obj => {
      const flat = flattenReqs(obj.reqs)
      const row = { id: obj.id, val: obj.val || '', ...flat }

      // Join other tables
      for (const join of joins) {
        const joinField = join.joinField
        const joinObjects = joinData[join.typeId] || []
        const matchValue = row[joinField] || obj.val

        const matched = joinObjects.find(jo => {
          if (jo.val === matchValue) return true
          const joFlat = flattenReqs(jo.reqs)
          return Object.values(joFlat).includes(matchValue)
        })

        if (matched && join.selectFields) {
          const matchedFlat = flattenReqs(matched.reqs)
          for (const field of join.selectFields) {
            row[field] = matchedFlat[field] || ''
          }
        }
      }
      return row
    })

    // 4. Compute stats
    const numericFields = {}
    for (const row of rows) {
      for (const [k, v] of Object.entries(row)) {
        if (k === 'id') continue
        const num = parseFloat(v)
        if (!isNaN(num)) {
          if (!numericFields[k]) numericFields[k] = { sum: 0, count: 0, min: Infinity, max: -Infinity }
          numericFields[k].sum += num
          numericFields[k].count++
          numericFields[k].min = Math.min(numericFields[k].min, num)
          numericFields[k].max = Math.max(numericFields[k].max, num)
        }
      }
    }
    const stats = {}
    for (const [k, v] of Object.entries(numericFields)) {
      stats[k] = { sum: v.sum, avg: +(v.sum / v.count).toFixed(2), min: v.min, max: v.max, count: v.count }
    }

    return {
      mainTypeId,
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      rows: rows.slice(0, limit),
      totalRows: rows.length,
      stats
    }
  }

  // ── Дополнительные CRUD ──────────────────────────────────────────────────

  /**
   * Переименовать колонку (установить alias)
   * @param {string} reqId — ID колонки
   * @param {string} newName — новое имя
   */
  async renameColumn(reqId, newName) {
    await this.setAlias(reqId, newName)
    this.clearCache()
    return { reqId, alias: newName }
  }

  /**
   * Получить один объект по ID с реквизитами
   * @param {string} objectId
   * @returns {{id, val, requisites}}
   */
  async getObject(objectId) {
    await this._ensureV1Auth()
    const resp = await axios.get(this._v1Url(`edit/${objectId}`), {
      headers: { 'X-Authorization': this._v1Token }
    })
    const data = resp.data || {}
    return {
      id: objectId,
      val: data.val || data.value || '',
      requisites: data.reqs || data.requisites || {},
      raw: data
    }
  }

  /**
   * Переместить объект к другому родителю
   * @param {string} objectId — ID объекта
   * @param {string} newParentId — ID нового родителя (таблицы)
   */
  async moveObject(objectId, newParentId) {
    await this._ensureV1Auth()
    return this._v1Post('_m_move', { obj: objectId, to: String(newParentId) })
  }

  /**
   * Клонировать структуру таблицы (без данных)
   * @param {string} sourceTypeId — ID исходной таблицы
   * @param {string} newName — имя новой таблицы
   * @returns {{newTypeId, columns}}
   */
  async cloneTableStructure(sourceTypeId, newName) {
    // 1. Get source schema
    const aliases = await this.getReqAliases(sourceTypeId)

    // 2. Create new type
    const newTypeId = await this.createType(newName)

    // 3. Copy columns (requisites)
    const columns = []
    for (const [reqId, alias] of Object.entries(aliases)) {
      try {
        // Get original requisite's reference type
        const schema = await this.getSchemaFull()
        const sourceType = (schema?.types || []).find(t => String(t.id) === String(sourceTypeId))
        const req = (sourceType?.requisites || []).find(r => String(r.id) === String(reqId))
        const refTypeId = req?.refTypeId || req?.type || 3 // default SHORT

        const { reqId: newReqId } = await this.addRequisite(newTypeId, String(refTypeId))
        await this.setAlias(newReqId, alias)
        columns.push({ reqId: newReqId, alias, sourceReqId: reqId })
      } catch (e) {
        columns.push({ sourceReqId: reqId, alias, error: e.message })
      }
    }

    return { newTypeId, name: newName, columns }
  }

  // ── Анализ значений колонки ──────────────────────────────────────────────

  /**
   * Анализ уникальных значений колонки (для миграции в справочник)
   * @param {number} typeId — ID таблицы
   * @param {number} reqId — ID колонки (реквизита)
   * @returns {{ uniqueValues: string[], totalRecords: number, distribution: Object }}
   */
  async analyzeColumnValues(typeId, reqId) {
    this._logFallback('analyzeColumnValues', `typeId=${typeId}, reqId=${reqId}`)
    const { objects, reqs, total } = await this._getObjectsV1(typeId, { maxRecords: 2000 })

    const valueCounts = {}
    for (const obj of objects) {
      const objReqs = reqs[obj.id] || {}
      const vals = objReqs[reqId]
      const value = typeof vals === 'string'
        ? vals
        : (Array.isArray(vals) ? (vals[0]?.value || '') : (vals?.value || ''))
      if (value && value.trim()) {
        const v = value.trim()
        valueCounts[v] = (valueCounts[v] || 0) + 1
      }
    }

    const sorted = Object.entries(valueCounts)
      .sort((a, b) => b[1] - a[1])

    return {
      totalRecords: total,
      analyzedRecords: objects.length,
      uniqueValues: sorted.map(([v]) => v),
      distribution: Object.fromEntries(sorted.slice(0, 30)),
      maxLength: sorted.reduce((max, [v]) => Math.max(max, v.length), 0),
      lookupCandidate: sorted.length <= 20 ? 'ideal' : sorted.length <= 100 ? 'possible' : 'unlikely'
    }
  }

  // ── Schema ────────────────────────────────────────────────────────────────

  /** Полная схема БД (внутреннее использование — кэшируется 5min) */
  async getSchemaFull() {
    const cached = _schemaCache.get(this.database)
    if (cached && Date.now() - cached.ts < SCHEMA_TTL) return cached.data

    const { data } = await withRetry(() => this.axios.get('/schema'))
    const result = data.data
    _schemaCache.set(this.database, { data: result, ts: Date.now() })
    return result
  }

  /** Компактная схема БД — только непустые таблицы без requisites */
  async getSchema() {
    const raw = await this.getSchemaFull()
    const types = raw?.types || []
    const nonEmpty = types
      .filter(t => (t.count || 0) > 0)
      .map(t => ({
        id: t.id,
        name: t.name || `type_${t.id}`,
        count: t.count || 0,
        fieldCount: (t.requisites || []).length
      }))
      .sort((a, b) => b.count - a.count)
    const emptyTypes = types.length - nonEmpty.length
    // Show top-100 by record count to keep response compact
    const top = nonEmpty.slice(0, 100)
    const hiddenTypes = nonEmpty.length - top.length
    return {
      database: this.database,
      typeCount: types.length,
      nonEmptyCount: nonEmpty.length,
      types: top,
      ...(hiddenTypes > 0 ? { hiddenTypes } : {}),
      emptyTypes
    }
  }

  /** Схема одного типа */
  async getTypeSchema(typeId) {
    const { data } = await this.axios.get(`/schema/types/${typeId}`)
    return data.data
  }

  /** Граф связей между таблицами — compact, cached */
  async getRelationships() {
    const cached = _relCache.get(this.database)
    if (cached && (Date.now() - cached.ts) < REL_TTL) return cached.data

    const { data } = await this.axios.get('/schema/relationships')
    const raw = data.data
    if (!Array.isArray(raw)) return raw
    const all = raw.map(r => ({
      from: r.fromType,
      fromName: r.fromName || `type_${r.fromType}`,
      to: r.toType,
      toName: r.toName || `type_${r.toType}`,
      field: r.alias || r.fieldName || null
    }))
    // Deduplicate by from→to pair
    const seen = new Set()
    const unique = all.filter(r => {
      const key = `${r.from}->${r.to}:${r.field}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const result = { totalRelationships: unique.length }
    if (unique.length > 200) {
      result.relationships = unique.slice(0, 200)
      result._truncated = unique.length - 200
    } else {
      result.relationships = unique
    }
    _relCache.set(this.database, { data: result, ts: Date.now() })
    return result
  }

  /** Статистика БД — compact summary + top15, cached 2min */
  async getStats() {
    const cached = _statsCache.get(this.database)
    if (cached && Date.now() - cached.ts < STATS_TTL) return cached.data

    const { data } = await withRetry(() => this.axios.get('/schema/stats'))
    const raw = data.data
    const byType = raw?.byType || []
    const sorted = [...byType].sort((a, b) => (b.objectCount || 0) - (a.objectCount || 0))
    const totalRecords = byType.reduce((s, t) => s + (t.objectCount || 0), 0)
    const totalRequisites = byType.reduce((s, t) => s + (t.requisiteCount || 0), 0)
    const emptyTables = byType.filter(t => (t.objectCount || 0) === 0).length
    const top15 = sorted.slice(0, 15).map(t => ({
      id: t.id,
      name: t.name || `type_${t.id}`,
      records: t.objectCount || 0,
      fields: t.requisiteCount || 0
    }))
    const topNames = top15.slice(0, 5).map(t => `${t.name}(${t.records})`).join(', ')
    const statsResult = {
      database: this.database,
      tableCount: byType.length,
      totalRecords,
      totalRequisites,
      top15,
      emptyTables,
      summary: `${byType.length} таблиц, ${totalRecords.toLocaleString()} записей. Крупнейшие: ${topNames}`
    }
    _statsCache.set(this.database, { data: statsResult, ts: Date.now() })
    return statsResult
  }

  // ── Report Constructor ──────────────────────────────────────────────────

  // Integram system type IDs for report constructor
  static REPORT_TYPE_ID = 22       // Запрос (Query)
  static COLUMN_TYPE_ID = 28       // Колонки запроса
  static FROM_TYPE_ID = 44         // FROM tables

  /**
   * Create a report via V1 constructor API
   * @param {Object} config
   * @param {string} config.name — report name
   * @param {Array} config.fromTables — [{typeId, alias?, joinOn?}]
   * @param {Array} config.columns — [{nameInReport, formula?, functionId?, alias?, set?, format?, hide?, sort?, total?, valueFrom?, valueTo?}]
   * @param {string} config.where — WHERE clause
   * @param {string} config.having — HAVING clause
   * @param {string} config.orderBy — ORDER BY
   * @param {number} config.limit — LIMIT
   * @param {boolean} config.execute — EXECUTE flag (default true)
   * @param {boolean} config.interactive — Интерактивный flag (enables inline editing/buttons)
   * @param {string} config.url — URL for CURL/API reports
   * @param {string} config.urlPost — URL_POST body
   * @param {string} config.urlHeader — URL_HEADER
   * @param {string} config.urlMethod — URL_METHOD (GET/POST/PUT)
   * @param {string} config.ifEmpty — Если пусто, вернуть
   * @returns {{reportId, name, fromTables, columns}}
   */
  async createReport({ name, fromTables = [], columns = [], where, having, orderBy, limit, execute = true, interactive = false, url, urlPost, urlHeader, urlMethod, ifEmpty }) {
    await this._ensureV1Auth()

    // 1. Create report object (type 22)
    const reportObj = await this._createObjectV1(IntegramV2Client.REPORT_TYPE_ID, name)
    const reportId = reportObj.id  // extract numeric ID

    // 2. Set report parameters
    const params = {}
    if (where) params.t262 = where
    if (having) params.t263 = having
    if (orderBy) params.t264 = orderBy
    if (limit) params.t134 = String(limit)
    if (execute) params.t228 = '1'           // EXECUTE
    if (interactive) params.t95 = '1'         // Интерактивный
    if (url) params.t97 = url                 // URL (for CURL reports)
    if (urlPost) params.t283 = urlPost        // URL_POST
    if (urlHeader) params.t284 = urlHeader    // URL_HEADER
    if (urlMethod) params.t37469 = urlMethod  // URL_METHOD
    if (ifEmpty) params.t113 = ifEmpty        // Если пусто, вернуть

    if (Object.keys(params).length) {
      await this._v1Post(`_m_set/${reportId}`, params)
    }

    // 3. Add FROM tables — create directly under report (up=reportId)
    const addedFroms = []
    for (const from of fromTables) {
      try {
        const fromData = {
          [`t${IntegramV2Client.FROM_TYPE_ID}`]: String(from.typeId),
          up: reportId
        }
        const result = await this._v1Post(`_m_new/${IntegramV2Client.FROM_TYPE_ID}`, fromData)
        const fromId = result?.obj || result?.id
        if (!fromId) throw new Error(`_m_new FROM returned no ID: ${JSON.stringify(result).slice(0, 200)}`)
        // Set alias and joinOn via _m_set
        if (from.alias) {
          try { await this._v1Post('_m_set', { obj: fromId, req: '265', value: from.alias }) } catch (_) {}
        }
        if (from.joinOn) {
          try { await this._v1Post('_m_set', { obj: fromId, req: '266', value: from.joinOn }) } catch (_) {}
        }
        addedFroms.push({ id: fromId, typeId: from.typeId, alias: from.alias })
      } catch (e) {
        addedFroms.push({ typeId: from.typeId, error: e.message })
      }
    }

    // 4. Add columns — kval validates val as SQL identifier on _m_new/28
    //    V1 approach: val = fieldId (numeric requisite ID) or "0" for computed columns
    //    Then set all display/formula reqs via _m_set individually
    const addedCols = []
    const reportObjId = reportId
    for (const col of columns) {
      try {
        // Step A: _m_new with fieldId as val (V1-compatible, always works)
        // fieldId = numeric req ID from the FROM table, or 0 for computed/formula columns
        const fieldVal = col.fieldId ? String(col.fieldId) : '0'
        const colData = { up: reportObjId }
        colData[`t${IntegramV2Client.COLUMN_TYPE_ID}`] = fieldVal

        const result = await this._v1Post(`_m_new/${IntegramV2Client.COLUMN_TYPE_ID}`, colData)
        const colId = result?.obj || result?.id
        if (!colId) throw new Error(`_m_new column returned no ID: ${JSON.stringify(result).slice(0, 200)}`)

        // Step B: set all requisites via _m_set/{colId} with {tReqId: value} format
        const colReqs = {}
        if (col.nameInReport) colReqs.t100 = col.nameInReport
        if (col.formula) colReqs.t101 = col.formula
        if (col.functionId != null) colReqs.t104 = String(col.functionId)
        if (col.alias) colReqs.t58 = col.alias
        if (col.set) colReqs.t132 = col.set
        if (col.format != null) colReqs.t84 = String(col.format)
        if (col.hide) colReqs.t107 = '1'
        if (col.sort != null) colReqs.t109 = String(col.sort)
        if (col.total != null) colReqs.t72 = String(col.total)
        if (col.valueFrom) colReqs.t102 = col.valueFrom
        if (col.valueTo) colReqs.t103 = col.valueTo
        if (col.width) colReqs.t110775 = col.width
        if (Object.keys(colReqs).length) {
          await this._v1Post(`_m_set/${colId}`, colReqs)
        }

        addedCols.push({ id: colId, ...col })
      } catch (e) {
        addedCols.push({ ...col, error: e.message })
      }
    }

    return { reportId, name, fromTables: addedFroms, columns: addedCols, where, having, orderBy, limit, interactive, url }
  }

  /**
   * Get report structure (columns, FROM tables, conditions)
   * @param {number|string} reportId
   * @returns {{name, columns, fromTables, where, orderBy, limit}}
   */
  async getReportStructure(reportId) {
    await this._ensureV1Auth()

    // Get report object with children
    const obj = await this.getObject(reportId)
    if (!obj) return { error: `Report ${reportId} not found` }

    // Get children (columns and FROM tables)
    const { objects: children = [], reqs = {} } = await this._getObjectsV1(IntegramV2Client.COLUMN_TYPE_ID, { parentId: reportId })

    // Get FROM children
    let fromChildren = []
    try {
      const fromData = await this._getObjectsV1(IntegramV2Client.FROM_TYPE_ID, { parentId: reportId })
      fromChildren = fromData.objects || []
    } catch (_) {}

    // Parse report reqs
    const reportReqs = obj.reqs || obj.requisites || {}
    const getReq = (id) => {
      const r = reportReqs[id]
      return typeof r === 'object' ? (r.value || r) : r
    }

    const cols = children.map(c => {
      const r = reqs[c.id] || {}
      const col = {
        id: c.id,
        val: c.val,
        nameInReport: r['100'] || r.t100,
        formula: r['101'] || r.t101,
        functionId: r['104'] || r.t104,
        alias: r['58'] || r.t58,
        sort: r['109'] || r.t109,
        total: r['72'] || r.t72
      }
      // Extended fields: SET, format, hide, valueFrom/To, width
      const set = r['132'] || r.t132
      const format = r['84'] || r.t84
      const hide = r['107'] || r.t107
      const valueFrom = r['102'] || r.t102
      const valueTo = r['103'] || r.t103
      const width = r['110775'] || r.t110775
      if (set) col.set = set
      if (format) col.format = format
      if (hide) col.hide = hide
      if (valueFrom) col.valueFrom = valueFrom
      if (valueTo) col.valueTo = valueTo
      if (width) col.width = width
      return col
    })

    return {
      reportId,
      name: obj.val || obj.value,
      execute: !!(getReq('228') || getReq('t228')),
      interactive: !!(getReq('95') || getReq('t95')),
      url: getReq('97') || getReq('t97'),
      urlPost: getReq('283') || getReq('t283'),
      urlHeader: getReq('284') || getReq('t284'),
      urlMethod: getReq('37469') || getReq('t37469'),
      ifEmpty: getReq('113') || getReq('t113'),
      where: getReq('262') || getReq('t262'),
      having: getReq('263') || getReq('t263'),
      orderBy: getReq('264') || getReq('t264'),
      limit: getReq('134') || getReq('t134'),
      columns: cols,
      fromTables: fromChildren.map(f => ({
        id: f.id,
        val: f.val,
        alias: (reqs[f.id] || {})['265'],
        joinOn: (reqs[f.id] || {})['266']
      })),
      totalColumns: cols.length,
      totalFromTables: fromChildren.length
    }
  }

  /**
   * Generate HTML button formula for interactive reports.
   * Creates a CONCAT expression that renders a clickable button calling another report.
   * @param {Object} config
   * @param {number} config.targetReportId — report to call on click
   * @param {string} config.paramName — parameter name (e.g. 'КаналID', 'd')
   * @param {string} config.paramAlias — column alias holding the row ID
   * @param {string} config.label — button text (or {active, inactive} for conditional)
   * @param {string} config.conditionAlias — alias to check for conditional label
   * @param {string} config.refreshMode — 'refreshLine' (default) or 'applyFilters'
   * @param {string} config.disableCondition — expression for disabling (e.g. 'field1 && field2')
   * @param {string} config.btnClass — CSS class (default 'btn btn-primary')
   * @returns {string} CONCAT formula for use as column formula with format=HTML
   */
  static buildButtonFormula({ targetReportId, paramName = 'd', paramAlias, label, conditionAlias, refreshMode = 'refreshLine', disableCondition, btnClass = 'btn btn-primary' }) {
    const esc = (s) => s.replace(/'/g, "\\'")
    const refresh = esc(refreshMode)
    const apiCall = `newApi(\\'POST\\',\\'report/${targetReportId}?JSON&confirmed=1&FR_${paramName}=',${paramAlias},'\\',\\'${refresh}\\',\\'\\',this)`

    let labelExpr
    if (typeof label === 'object' && label.active && label.inactive) {
      labelExpr = `IF(${conditionAlias}>0,'${esc(label.active)}','${esc(label.inactive)}')`
    } else {
      labelExpr = `'${esc(String(label))}'`
    }

    let disableExpr = ''
    if (disableCondition) {
      disableExpr = `IF(${disableCondition}, NULL, 'disabled'),' '`
    }

    const parts = [`CONCAT('<a `]
    if (disableCondition) {
      parts[0] += `',${disableExpr},'`
    }
    parts[0] += `onclick="$(this).addClass(\\'disabled\\');${apiCall}" class="${esc(btnClass)}">',${labelExpr},'</a>')`

    return parts[0]
  }

  /**
   * Generate navigation link formula for linking to another smartq report.
   * @param {number} reportId — target smartq report ID
   * @param {string} paramName — filter parameter name
   * @param {string} paramAlias — column alias holding the value
   * @param {string} linkText — visible link text
   * @param {string} database — database name (default '_global_.z')
   * @returns {string} CONCAT formula
   */
  static buildNavLinkFormula(reportId, paramName, paramAlias, linkText, database = '_global_.z') {
    return `CONCAT('<a href="/${database}/smartq/${reportId}/?FR_${paramName}=',${paramAlias},'\">${linkText}</a>')`
  }

  /**
   * Create an API/CURL report that calls an external URL and maps JSON response to table columns.
   * @param {Object} config
   * @param {string} config.name — report name
   * @param {string} config.url — API URL with [Alias] placeholders
   * @param {string} config.method — HTTP method (GET/POST/PUT)
   * @param {string} config.postBody — POST body template
   * @param {string} config.headers — HTTP headers
   * @param {Array} config.columns — [{nameInReport, formula?, curlField?, set?, functionId?, alias?, hide?}]
   *   curlField maps to CURL.fieldname in formula
   * @param {number} config.limit — default 1
   * @returns {{reportId, name, columns}}
   */
  async createCurlReport({ name, url, method = 'GET', postBody, headers, columns = [], limit = 1 }) {
    // Map curlField shorthand to formula
    const mappedColumns = columns.map(col => {
      if (col.curlField && !col.formula) {
        return { ...col, formula: `CURL.${col.curlField}` }
      }
      return col
    })

    return this.createReport({
      name,
      url,
      urlMethod: method,
      urlPost: postBody,
      urlHeader: headers,
      execute: true,
      limit,
      columns: mappedColumns
    })
  }

  /**
   * Create a report chain: interactive report A with button columns that call report B.
   * @param {Object} config
   * @param {string} config.name — main report name
   * @param {Array} config.dataColumns — regular data columns [{nameInReport, formula?, alias?, ...}]
   * @param {Array} config.buttonColumns — [{label, targetReportId, paramAlias, paramName?, conditionAlias?, refreshMode?}]
   * @param {Object} config.reportOptions — additional createReport options (where, orderBy, limit, interactive)
   * @returns {{reportId, name, columns}}
   */
  async createInteractiveReport({ name, fromTables = [], dataColumns = [], buttonColumns = [], reportOptions = {} }) {
    const allColumns = [...dataColumns]

    for (const btn of buttonColumns) {
      allColumns.push({
        nameInReport: btn.nameInReport || btn.label,
        fieldAlias: btn.fieldAlias || btn.nameInReport || btn.label,
        formula: IntegramV2Client.buildButtonFormula({
          targetReportId: btn.targetReportId,
          paramName: btn.paramName || 'd',
          paramAlias: btn.paramAlias,
          label: btn.label,
          conditionAlias: btn.conditionAlias,
          refreshMode: btn.refreshMode,
          disableCondition: btn.disableCondition,
          btnClass: btn.btnClass
        }),
        format: '34', // HTML format ID
        hide: btn.hide
      })
    }

    return this.createReport({
      name,
      fromTables,
      interactive: true,
      execute: true,
      ...reportOptions,
      columns: allColumns
    })
  }

  /** Сбросить кэш (вызывать после изменения схемы) */
  clearCache() {
    clearCache(this.database)
  }

  /** Экспорт JSON Schema */
  async exportJsonSchema() {
    const { data } = await this.axios.get('/schema/export/json-schema')
    return data.data || data
  }

  /** Экспорт OpenAPI */
  async exportOpenAPI() {
    const { data } = await this.axios.get('/schema/export/openapi')
    return data.data || data
  }

  // ── Search ────────────────────────────────────────────────────────────────

  /** Полнотекстовый поиск — compact results */
  async search({ query, limit = 20, typeId } = {}) {
    if (!query) return { query: '', totalFound: 0, results: [], searchedTypes: 0 }

    const searchTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 1)
    const rawResults = []
    let searchedTypes = 0

    if (typeId) {
      searchedTypes = 1
      const { data } = await this.axios.get(`/types/${typeId}/objects`, { params: { limit: limit * 2 } })
      const objects = data?.data || []
      for (const obj of objects) {
        const val = (obj.val || obj.value || '').toLowerCase()
        if (searchTerms.some(term => val.includes(term))) {
          rawResults.push({ ...obj, _typeId: typeId })
          if (rawResults.length >= limit) break
        }
      }
    } else {
      const schema = await this.getSchemaFull()
      const types = schema?.types || []

      const matchingTypes = types.filter(t => {
        const name = (t.name || '').toLowerCase()
        return searchTerms.some(term => name.includes(term))
      }).slice(0, 10)

      // Parallel search across matching types
      const typeResults = await Promise.allSettled(
        matchingTypes.map(type =>
          this.axios.get(`/types/${type.id}/objects`, { params: { limit: 5 } })
            .then(({ data }) => (data?.data || []).map(obj => ({
              ...obj, _typeName: type.name, _typeId: type.id
            })))
        )
      )
      searchedTypes = matchingTypes.length
      for (const r of typeResults) {
        if (r.status === 'fulfilled') rawResults.push(...r.value)
        if (rawResults.length >= limit) break
      }

      if (matchingTypes.length === 0) {
        const topTypes = types.filter(t => (t.count || 0) > 5)
          .sort((a, b) => (b.count || 0) - (a.count || 0))
          .slice(0, 15)

        // Parallel full-text search across top types
        const topResults = await Promise.allSettled(
          topTypes.map(type =>
            this.axios.get(`/types/${type.id}/objects`, { params: { limit: 100 } })
              .then(({ data }) => (data?.data || [])
                .filter(obj => {
                  const val = (obj.val || obj.value || '').toLowerCase()
                  return searchTerms.some(term => val.includes(term))
                })
                .slice(0, 5)
                .map(obj => ({ ...obj, _typeName: type.name, _typeId: type.id }))
              )
          )
        )
        searchedTypes += topTypes.length
        for (const r of topResults) {
          if (r.status === 'fulfilled') rawResults.push(...r.value)
          if (rawResults.length >= limit) break
        }

        if (rawResults.length === 0) {
          const fuzzyTypes = types.filter(t => {
            const name = (t.name || '').toLowerCase()
            return searchTerms.some(term => name.split(/[_\s-]/).some(part => part.startsWith(term.slice(0, 3))))
          }).slice(0, 20)
          return {
            query, totalFound: 0, searchedTypes,
            results: [],
            suggestedTypes: fuzzyTypes.map(t => ({ id: t.id, name: t.name, count: t.count || 0 })),
          }
        }
      }
    }

    const compactResults = rawResults.slice(0, limit).map(obj => ({
      id: obj.id,
      type: obj._typeName || null,
      typeId: obj._typeId || null,
      title: obj.val || obj.value || `#${obj.id}`,
      snippet: (obj.val || obj.value || '').slice(0, 120)
    }))

    return {
      query,
      totalFound: compactResults.length,
      results: compactResults,
      searchedTypes
    }
  }

  /** Фильтрация по реквизитам — compact results, getObjects fallback */
  async filter(typeId, conditions) {
    try {
      const { data } = await this.axios.post(`/search/filter/${typeId}`, conditions)
      return data.data
    } catch (e) {
      const limit = conditions.limit || 50
      const _filterVersion = 'v3-getObjects'

      // Get schema for field mapping
      const { data: sd } = await this.axios.get(`/schema/types/${typeId}`)
      const schema = sd?.data
      const typeName = schema?.name || `type_${typeId}`

      // Build requisite alias→id map and id→alias map
      const aliasMap = {}
      const idToAlias = {}
      if (schema?.requisites) {
        for (const r of schema.requisites) {
          if (r.alias) {
            aliasMap[r.alias.toLowerCase()] = String(r.id)
            idToAlias[String(r.id)] = r.alias
          }
          if (r.name) aliasMap[r.name.toLowerCase()] = String(r.id)
          aliasMap[String(r.id)] = String(r.id)
        }
      }

      // Filter condition keys (without meta keys)
      const conditionKeys = Object.keys(conditions).filter(k => k !== 'limit' && k !== 'offset')

      // Get objects using getObjects() (same as search/export — handles auth internally)
      let objects = []
      let dataSource = 'getObjects'
      let fetchedCount = 0
      try {
        const objs = await this.getObjects(String(typeId), { limit: 2000, withReqs: true })
        objects = objs.map(obj => ({
          id: obj.id,
          val: obj.val || '',
          requisites: obj.reqs || {}
        }))
        fetchedCount = objects.length
      } catch (objErr) {
        // Last resort: use schema sample
        if (schema?.sample?.length) {
          objects = schema.sample.map(obj => ({
            id: obj.id,
            val: obj.value || obj.val || '',
            requisites: obj.requisites || {}
          }))
          fetchedCount = objects.length
          dataSource = 'sample'
        }
      }

      const filtered = objects.filter(obj => {
        const reqs = obj.requisites
        for (const field of conditionKeys) {
          const condition = conditions[field]
          // Support filtering by 'val' (record name) — not a requisite
          if (field === 'val' || field === 'name' || field === 'value') {
            const objName = obj.val || ''
            if (typeof condition === 'object' && condition !== null) {
              if (condition.$like) {
                const pattern = condition.$like.replace(/%/g, '.*')
                if (!new RegExp(pattern, 'i').test(objName)) return false
              } else if (condition.$gt || condition.$lt) {
                const num = parseFloat(objName)
                if (condition.$gt && !(num > parseFloat(condition.$gt))) return false
                if (condition.$lt && !(num < parseFloat(condition.$lt))) return false
              }
            } else {
              if (objName.toLowerCase() !== String(condition).toLowerCase()) return false
            }
            continue
          }
          const reqId = aliasMap[field.toLowerCase()] || field
          const vals = reqs[reqId] || []
          const objVal = typeof vals === 'string' ? vals : (Array.isArray(vals) ? (vals[0]?.value || '') : (vals?.value || ''))

          if (typeof condition === 'object' && condition !== null) {
            if (condition.$gt && !(parseFloat(objVal) > parseFloat(condition.$gt))) return false
            if (condition.$lt && !(parseFloat(objVal) < parseFloat(condition.$lt))) return false
            if (condition.$like) {
              const pattern = condition.$like.replace(/%/g, '.*')
              if (!new RegExp(pattern, 'i').test(objVal)) return false
            }
          } else {
            if (String(objVal).toLowerCase() !== String(condition).toLowerCase()) return false
          }
        }
        return true
      })

      // Compact results: only matched fields
      const compactResults = filtered.slice(0, limit).map(obj => {
        const matchedFields = {}
        const reqs = obj.requisites
        for (const field of conditionKeys) {
          const reqId = aliasMap[field.toLowerCase()] || field
          const alias = idToAlias[reqId] || field
          const vals = reqs[reqId] || []
          matchedFields[alias] = typeof vals === 'string' ? vals : (Array.isArray(vals) ? (vals[0]?.value || '') : (vals?.value || ''))
        }
        return {
          id: obj.id,
          title: obj.val || `#${obj.id}`,
          matchedFields
        }
      })

      return {
        typeId,
        typeName,
        totalInTable: schema?.count || 0,
        matchCount: compactResults.length,
        results: compactResults,
        dataSource,
        fetchedCount,
        _version: _filterVersion
      }
    }
  }

  /** Агрегация данных — V1 fallback для полных данных */
  async aggregate(typeId, options) {
    try {
      const { data } = await this.axios.post(`/search/aggregate/${typeId}`, options)
      return data.data
    } catch (e) {
      // Get schema for field mapping + count
      const { data: sd } = await this.axios.get(`/schema/types/${typeId}`)
      const schema = sd?.data

      // Get objects using getObjects() (handles auth internally)
      let objects = []
      let dataSource = 'getObjects'
      try {
        const objs = await this.getObjects(String(typeId), { limit: 2000, withReqs: true })
        objects = objs.map(obj => ({
          id: obj.id,
          requisites: obj.reqs || {}
        }))
      } catch (objErr) {
        // Last resort: schema sample
        if (schema?.sample?.length) {
          objects = schema.sample.map(obj => ({
            id: obj.id,
            requisites: obj.requisites || {}
          }))
          dataSource = 'sample'
        }
      }

      const result = { total: schema?.count || 0, dataSize: objects.length }

      // Helper: extract requisite value from object
      const getReqVal = (obj, reqId) => {
        const vals = obj.requisites[reqId] || []
        return typeof vals === 'string' ? vals : (Array.isArray(vals) ? (vals[0]?.value || '') : (vals?.value || ''))
      }

      if (options?.groupBy && schema?.requisites) {
        const req = schema.requisites.find(r =>
          String(r.id) === String(options.groupBy) || (r.alias || '').toLowerCase() === options.groupBy.toLowerCase()
        )
        if (req) {
          const groups = {}
          for (const obj of objects) {
            const key = getReqVal(obj, req.id) || 'unknown'
            groups[key] = (groups[key] || 0) + 1
          }
          result.groups = groups
          result._groupField = req.alias || req.id
        }
      }

      if (options?.metrics && schema?.requisites) {
        result.metrics = {}
        for (const m of options.metrics) {
          if (m.fn === 'count') {
            result.metrics['count'] = schema?.count || objects.length
            continue
          }
          if (m.field === '*') continue
          const fieldLower = (m.field || '').toLowerCase()
          const req = schema.requisites.find(r => {
            if (String(r.id) === String(m.field)) return true
            const alias = (r.alias || '').toLowerCase()
            if (alias === fieldLower) return true
            // Fuzzy match: "mass_kg" matches "Масса, кг", "max_speed_kmh" matches "Макс. скорость, км/ч"
            if (alias.includes(fieldLower) || fieldLower.includes(alias)) return true
            // Name match (r.name often = field alias)
            if ((r.name || '').toLowerCase() === fieldLower) return true
            return false
          })
          if (!req) continue
          const nums = objects.map(obj => parseFloat(getReqVal(obj, req.id))).filter(n => !isNaN(n))
          if (m.fn === 'sum') result.metrics[`sum_${req.alias || m.field}`] = nums.reduce((a, b) => a + b, 0)
          if (m.fn === 'avg') result.metrics[`avg_${req.alias || m.field}`] = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
          if (m.fn === 'min') result.metrics[`min_${req.alias || m.field}`] = Math.min(...nums)
          if (m.fn === 'max') result.metrics[`max_${req.alias || m.field}`] = Math.max(...nums)
        }
      }

      result.dataSource = dataSource
      result.analyzedCount = objects.length
      result.totalCount = schema?.count || null
      return result
    }
  }

  /** Связанные объекты — compact */
  async findRelated(objectId, depth = 1) {
    try {
      const { data } = await this.axios.get(`/search/related/${objectId}`, { params: { depth } })
      const raw = data.data
      // Compact if raw contains full objects
      if (Array.isArray(raw)) {
        return {
          objectId,
          related: raw.map(r => ({
            id: r.id, type: r.typeName || r._typeName || null,
            title: r.val || r.value || `#${r.id}`, relation: r.reqId || r.relation || null
          }))
        }
      }
      return raw
    } catch (e) {
      const { data } = await this.axios.get(`/objects/${objectId}`)
      const obj = data?.data
      if (!obj) return { objectId, related: [] }

      const related = []
      if (obj.requisites && depth >= 1) {
        for (const [reqId, vals] of Object.entries(obj.requisites || {})) {
          for (const v of vals) {
            if (v.value && /^\d+$/.test(v.value) && parseInt(v.value) > 1000) {
              try {
                const { data: relData } = await this.axios.get(`/objects/${v.value}`)
                if (relData?.data) {
                  const r = relData.data
                  related.push({
                    id: r.id, type: r.typeName || null,
                    title: r.val || r.value || `#${r.id}`, relation: reqId
                  })
                }
              } catch (_) {}
            }
          }
        }
      }
      return { objectId, related }
    }
  }

  /** Natural language запрос (fallback to search) */
  async nlSearch(query) {
    try {
      const { data } = await this.axios.post('/search/nl', { query })
      return data.data
    } catch (e) {
      return this.search({ query, limit: 20 })
    }
  }

  // ── Batch ─────────────────────────────────────────────────────────────────

  /** Пакетные операции (V1 fallback для CRUD) */
  async batch(operations, options = {}) {
    try {
      const { data } = await this.axios.post('/batch', { operations, ...options })
      // V2 returns 200 even on failure — check inner success
      if (data?.data?.success === 0 || data?.data?.failed > 0) throw new Error('V2 batch partial failure')
      return data.data
    } catch (e) {
      this._logFallback('batch', `V2 batch failed: ${e.message}, executing ${operations.length} ops via V1`)
      const results = []
      for (const op of operations) {
        try {
          let result
          if (op.op === 'create') {
            result = await this._createObjectV1(op.typeId, op.data?.value || '', op.data?.requisites || {})
          } else if (op.op === 'update') {
            result = await this._updateObjectV1(op.objectId, op.data?.value || '')
            if (op.data?.requisites) {
              for (const [reqId, val] of Object.entries(op.data.requisites)) {
                await this._setRequisiteV1(op.objectId, reqId, val)
              }
            }
          } else if (op.op === 'delete') {
            result = await this._deleteObjectV1(op.objectId)
          }
          results.push({ op: op.op, success: true, result })
        } catch (opErr) {
          results.push({ op: op.op, success: false, error: opErr.message })
          if (options.atomic) {
            return { success: false, results, _note: 'Atomic batch aborted on error (V1 fallback)' }
          }
        }
      }
      return { success: true, results, _note: `Batch via V1 (${results.length} ops)` }
    }
  }

  /** Массовый импорт (V1 fallback) */
  async importRecords(typeId, records, options = {}) {
    try {
      const { data } = await this.axios.post(`/batch/import/${typeId}`, { records, ...options })
      return data.data
    } catch (e) {
      this._logFallback('importRecords', `V2 import failed: ${e.message}, importing ${records.length} records via V1`)
      const results = []
      for (const record of records) {
        try {
          const value = record.value || record.name || record.val || ''
          const reqs = { ...record }
          delete reqs.value; delete reqs.name; delete reqs.val
          const result = await this._createObjectV1(typeId, value, reqs)
          results.push({ success: true, id: result.id })
        } catch (recErr) {
          results.push({ success: false, error: recErr.message })
        }
      }
      const created = results.filter(r => r.success).length
      return { imported: created, failed: results.length - created, results, _note: `Import via V1` }
    }
  }

  /** Массовый экспорт (V1 fallback с реквизитами) */
  async exportRecords(typeId, options = {}) {
    try {
      const { data } = await this.axios.get(`/batch/export/${typeId}`, { params: options })
      return data.data
    } catch (e) {
      this._logFallback('exportRecords', `V2 export failed, using V1`)
      try {
        const v1Data = await this._getObjectsV1(typeId, { maxRecords: 5000 })
        return v1Data.objects.map(obj => ({
          id: obj.id,
          value: obj.val || obj.value || '',
          requisites: v1Data.reqs[obj.id] || {}
        }))
      } catch (v1Err) {
        // Last resort: V2 objects without requisites
        const { data } = await this.axios.get(`/types/${typeId}/objects`, { params: { limit: 10000 } })
        return data?.data || []
      }
    }
  }

  // ── Transactions ──────────────────────────────────────────────────────────

  /** История версий объекта */
  async getHistory(objectId) {
    const { data } = await this.axios.get(`/transactions/objects/${objectId}/history`)
    return data.data
  }

  /** Diff между версиями */
  async diffVersions(objectId, v1, v2) {
    const { data } = await this.axios.get(`/transactions/objects/${objectId}/diff`, { params: { v1, v2 } })
    return data.data
  }

  /** Откат транзакции */
  async rollback(transactionId) {
    const { data } = await this.axios.post(`/transactions/${transactionId}/rollback`)
    return data.data
  }

  // ── Audit ─────────────────────────────────────────────────────────────────

  /** Лог аудита */
  async getAuditLog(filters = {}) {
    const { data } = await this.axios.get('/audit', { params: filters })
    return data.data
  }

  /** Аудит объекта */
  async getObjectAudit(objectId) {
    const { data } = await this.axios.get(`/audit/object/${objectId}`)
    return data.data
  }

  /** Compliance отчёт */
  async getComplianceReport(dateRange = {}) {
    const { data } = await this.axios.get('/audit/report', { params: dateRange })
    return data.data
  }

  // ── Ontology ──────────────────────────────────────────────────────────────

  /** Онтология БД — compact summary */
  async getOntology() {
    const { data } = await this.axios.get('/ontology')
    const raw = data.data
    if (!raw || typeof raw !== 'object') return raw

    const classes = raw.classes || raw.types || []
    const properties = raw.properties || []
    const relations = raw.relations || raw.relationships || []

    return {
      classCount: classes.length,
      propertyCount: properties.length,
      relationCount: relations.length,
      topClasses: classes.slice(0, 20).map(c => ({
        id: c.id || c.uri, name: c.name || c.label
      }))
    }
  }

  /** JSON-LD экспорт */
  async exportJsonLd() {
    try {
      const { data } = await this.axios.get('/ontology/export/jsonld')
      return data.data || data
    } catch (e) {
      const { data } = await this.axios.get('/ontology/jsonld')
      return data.data || data
    }
  }

  /** OWL экспорт */
  async exportOwl() {
    const { data } = await this.axios.get('/ontology/export/owl')
    return data.data || data
  }

  /** SPARQL запрос (локальный движок на основе schema-триплов) */
  async sparql(query) {
    // Build triple store from schema
    const triples = await this._buildTripleStore()

    // Parse and execute SPARQL SELECT
    return this._executeSparql(query, triples)
  }

  // ── Events (SSE) ──────────────────────────────────────────────────────────

  /** Лог событий */
  async getEventLog(options = {}) {
    const { data } = await this.axios.get('/events/log', { params: options })
    return data.data
  }

  /** Подписка на webhook */
  async subscribeWebhook(url, filter = {}, secret = null) {
    const { data } = await this.axios.post('/events/subscribe', { url, filter, secret })
    return data.data
  }

  /** URL для SSE стрима */
  getSSEUrl(params = {}) {
    const qs = new URLSearchParams(params).toString()
    return `${this.baseUrl}/events${qs ? '?' + qs : ''}`
  }

  // ── SPARQL Engine ────────────────────────────────────────────────────────

  /**
   * Построить трипл-стор из schema + stats
   * Каждый тип → owl:Class, каждый реквизит → owl:ObjectProperty/DatatypeProperty
   * Связи между типами → rdfs:subClassOf, owl:ObjectProperty
   */
  async _buildTripleStore() {
    const IGR = 'https://integram.rf/ontology#'
    const triples = []

    const add = (s, p, o) => triples.push({ s, p, o })

    // Fetch full schema + stats (stats has proper names)
    const schema = await this.getSchemaFull() || {}
    const types = schema.types || []

    // Fetch stats — contains proper type names
    let statsByType = {}
    try {
      const { data: statsData } = await this.axios.get('/schema/stats')
      const stats = statsData?.data || {}
      for (const t of (stats.byType || [])) {
        statsByType[t.id] = t
      }
    } catch (_) {}

    // Enrich types with names from stats
    for (const t of types) {
      if (!t.name && statsByType[t.id]) {
        t.name = statsByType[t.id].name
      }
      if (t.count === undefined && statsByType[t.id]) {
        t.count = statsByType[t.id].objectCount
      }
    }

    // Fetch relationships
    let relationships = []
    try {
      const { data: relData } = await this.axios.get('/schema/relationships')
      relationships = relData?.data || []
    } catch (_) {}

    // Types → Classes
    for (const t of types) {
      const name = t.name || `type_${t.id}`
      const uri = IGR + this._toUri(name)

      add(uri, 'rdf:type', 'owl:Class')
      add(uri, 'rdfs:label', name)
      add(uri, 'igr:typeId', String(t.id))
      if (t.count !== undefined) add(uri, 'igr:recordCount', String(t.count))
      if (t.baseType) add(uri, 'igr:baseType', String(t.baseType))

      // Requisites → Properties
      if (t.requisites) {
        for (const r of t.requisites) {
          const reqName = r.alias || r.name || `req_${r.id}`
          const propUri = IGR + this._toUri(name) + '_' + this._toUri(reqName)

          add(propUri, 'rdf:type', r.refType ? 'owl:ObjectProperty' : 'owl:DatatypeProperty')
          add(propUri, 'rdfs:label', reqName)
          add(propUri, 'rdfs:domain', uri)
          add(propUri, 'igr:requisiteId', String(r.id))

          if (r.refType) {
            const targetType = types.find(tt => tt.id === r.refType)
            const targetName = targetType?.name || `type_${r.refType}`
            add(propUri, 'rdfs:range', IGR + this._toUri(targetName))
          } else {
            add(propUri, 'rdfs:range', 'xsd:string')
          }

          if (r.required) add(propUri, 'igr:required', 'true')
          if (r.multi) add(propUri, 'igr:multi', 'true')
        }
      }
    }

    // Relationships → ObjectProperties
    for (const rel of relationships) {
      if (!rel.fromName && !rel.toName) continue
      const fromUri = IGR + this._toUri(rel.fromName || `type_${rel.fromType}`)
      const toUri = IGR + this._toUri(rel.toName || `type_${rel.toType}`)
      const propUri = IGR + 'rel_' + (rel.alias ? this._toUri(rel.alias) : `${rel.fromType}_${rel.toType}`)

      add(propUri, 'rdf:type', 'owl:ObjectProperty')
      add(propUri, 'rdfs:label', rel.alias || `${rel.fromName} → ${rel.toName}`)
      add(propUri, 'rdfs:domain', fromUri)
      add(propUri, 'rdfs:range', toUri)
    }

    // Stats
    // Database-level stats
    const typeCount = types.length
    const objCount = Object.values(statsByType).reduce((s, t) => s + (t.objectCount || 0), 0)
    if (typeCount) add(IGR + 'database', 'igr:totalTypes', String(typeCount))
    if (objCount) add(IGR + 'database', 'igr:totalObjects', String(objCount))

    return triples
  }

  /** Конвертация имени в URI-safe строку */
  _toUri(name) {
    return (name || 'unknown')
      .replace(/[^\w\u0400-\u04FF]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase()
  }

  /**
   * Выполнить SPARQL SELECT по триплам
   * Поддерживает: SELECT, WHERE { ?s ?p ?o }, FILTER, LIMIT, OPTIONAL, ORDER BY
   */
  _executeSparql(query, triples) {
    const q = query.trim()

    // Parse SELECT variables
    const selectMatch = q.match(/SELECT\s+(DISTINCT\s+)?([\s\S]*?)\s+WHERE/i)
    if (!selectMatch) {
      return { error: 'Only SELECT queries supported', query: q }
    }
    const distinct = !!selectMatch[1]
    const selectVarsRaw = selectMatch[2].trim()
    const selectAll = selectVarsRaw === '*'
    const selectVars = selectAll ? [] : selectVarsRaw.split(/\s+/).map(v => v.replace('?', ''))

    // Parse WHERE patterns
    const whereMatch = q.match(/WHERE\s*\{([\s\S]*?)\}/i)
    if (!whereMatch) return { error: 'No WHERE clause found', query: q }

    const whereBody = whereMatch[1].trim()
    const patterns = []
    const filters = []
    const optionals = []

    // Parse OPTIONAL blocks
    const optRegex = /OPTIONAL\s*\{([^}]+)\}/gi
    let optMatch
    while ((optMatch = optRegex.exec(whereBody)) !== null) {
      const optPatterns = this._parsePatterns(optMatch[1])
      optionals.push(optPatterns)
    }

    // Remove OPTIONAL blocks and FILTER from main patterns
    let mainBody = whereBody.replace(/OPTIONAL\s*\{[^}]+\}/gi, '')

    // Extract FILTER with balanced parentheses
    const filterRegex = /FILTER\s*\(/gi
    let fMatch
    while ((fMatch = filterRegex.exec(mainBody)) !== null) {
      let depth = 1, i = fMatch.index + fMatch[0].length
      while (i < mainBody.length && depth > 0) {
        if (mainBody[i] === '(') depth++
        else if (mainBody[i] === ')') depth--
        i++
      }
      const filterExpr = mainBody.slice(fMatch.index, i)
      filters.push(filterExpr)
      mainBody = mainBody.slice(0, fMatch.index) + mainBody.slice(i)
      filterRegex.lastIndex = fMatch.index
    }
    mainBody = mainBody.trim()

    patterns.push(...this._parsePatterns(mainBody))

    // Parse LIMIT
    const limitMatch = q.match(/LIMIT\s+(\d+)/i)
    const limit = limitMatch ? parseInt(limitMatch[1]) : 100

    // Parse ORDER BY
    const orderMatch = q.match(/ORDER\s+BY\s+(\??\w+)/i)
    const orderVar = orderMatch ? orderMatch[1].replace('?', '') : null

    // Execute query — find all bindings that match patterns
    let bindings = [{}]

    for (const pattern of patterns) {
      bindings = this._matchPattern(pattern, triples, bindings)
    }

    // Apply OPTIONAL
    for (const optPats of optionals) {
      const newBindings = []
      for (const binding of bindings) {
        let matched = [binding]
        for (const pat of optPats) {
          matched = this._matchPattern(pat, triples, matched)
        }
        if (matched.length > 0) {
          newBindings.push(...matched)
        } else {
          newBindings.push(binding) // OPTIONAL — keep original if no match
        }
      }
      bindings = newBindings
    }

    // Apply FILTERs
    for (const f of filters) {
      const filterInner = f.match(/FILTER\s*\((.+)\)/i)?.[1]
      if (!filterInner) continue
      bindings = bindings.filter(b => this._evalFilter(filterInner, b))
    }

    // Select variables
    const vars = selectAll
      ? [...new Set(bindings.flatMap(b => Object.keys(b)))]
      : selectVars

    // Project results
    let results = bindings.map(b => {
      const row = {}
      for (const v of vars) {
        row[v] = b[v] || null
      }
      return row
    })

    // DISTINCT
    if (distinct) {
      const seen = new Set()
      results = results.filter(r => {
        const key = JSON.stringify(r)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    // ORDER BY
    if (orderVar) {
      results.sort((a, b) => String(a[orderVar] || '').localeCompare(String(b[orderVar] || '')))
    }

    // LIMIT
    results = results.slice(0, limit)

    return {
      variables: vars,
      results,
      totalTriples: triples.length,
      totalResults: results.length
    }
  }

  /** Парсинг троек из SPARQL WHERE */
  _parsePatterns(body) {
    const patterns = []

    // Tokenize respecting <URIs> and "strings" as atomic units
    const tokens = []
    let i = 0, current = ''
    while (i < body.length) {
      const ch = body[i]
      if (ch === '<') {
        // URI — read until >
        if (current.trim()) tokens.push(current.trim())
        current = ''
        let uri = '<'
        i++
        while (i < body.length && body[i] !== '>') { uri += body[i]; i++ }
        if (i < body.length) { uri += '>'; i++ }
        tokens.push(uri)
        continue
      }
      if (ch === '"' || ch === "'") {
        // String literal
        if (current.trim()) tokens.push(current.trim())
        current = ''
        const quote = ch
        let str = quote
        i++
        while (i < body.length && body[i] !== quote) { str += body[i]; i++ }
        if (i < body.length) { str += quote; i++ }
        tokens.push(str)
        continue
      }
      if (ch === '.') {
        // Statement separator — but only if followed by whitespace or end
        if (current.trim()) tokens.push(current.trim())
        current = ''
        tokens.push('.')
        i++
        continue
      }
      if (/\s/.test(ch)) {
        if (current.trim()) tokens.push(current.trim())
        current = ''
        i++
        continue
      }
      current += ch
      i++
    }
    if (current.trim()) tokens.push(current.trim())

    // Group tokens into triples (separated by '.')
    let triple = []
    for (const tok of tokens) {
      if (tok === '.') {
        if (triple.length >= 3) {
          patterns.push({ s: triple[0], p: triple[1], o: triple.slice(2).join(' ') })
        }
        triple = []
      } else {
        triple.push(tok)
      }
    }
    // Last triple (no trailing dot)
    if (triple.length >= 3) {
      patterns.push({ s: triple[0], p: triple[1], o: triple.slice(2).join(' ') })
    }

    return patterns
  }

  /** Сопоставление паттерна с триплами */
  _matchPattern(pattern, triples, bindings) {
    const results = []

    for (const binding of bindings) {
      const s = this._resolve(pattern.s, binding)
      const p = this._resolve(pattern.p, binding)
      const o = this._resolve(pattern.o, binding)

      for (const triple of triples) {
        const newBinding = { ...binding }
        let match = true

        if (s === null) { newBinding[pattern.s.replace('?', '')] = triple.s }
        else if (s !== triple.s && !triple.s.endsWith('#' + s) && s !== 'a') match = false

        if (match) {
          const pNorm = p === 'a' ? 'rdf:type' : p
          if (pNorm === null) { newBinding[pattern.p.replace('?', '')] = triple.p }
          else if (pNorm !== triple.p && !triple.p.endsWith(pNorm)) match = false
        }

        if (match) {
          if (o === null) { newBinding[pattern.o.replace('?', '')] = triple.o }
          else {
            const oClean = o.replace(/^["']|["']$/g, '')
            if (oClean !== triple.o && !triple.o.endsWith('#' + oClean) && oClean !== triple.o) match = false
          }
        }

        if (match) results.push(newBinding)
      }
    }

    return results
  }

  /** Разрешить значение (переменная vs литерал) */
  _resolve(term, binding) {
    if (!term) return null
    if (term.startsWith('?')) {
      const varName = term.replace('?', '')
      return binding[varName] || null
    }
    // Strip angle brackets from URIs: <http://...> → http://...
    if (term.startsWith('<') && term.endsWith('>')) {
      return term.slice(1, -1)
    }
    // Strip quotes from strings: "text" → text
    if ((term.startsWith('"') && term.endsWith('"')) || (term.startsWith("'") && term.endsWith("'"))) {
      return term.slice(1, -1)
    }
    return term
  }

  /** Вычислить FILTER выражение */
  _evalFilter(expr, binding) {
    try {
      // Simple filters: regex, bound, comparison
      const regexMatch = expr.match(/regex\s*\(\s*\?(\w+)\s*,\s*["']([^"']+)["']\s*(?:,\s*["']([^"']+)["'])?\)/i)
      if (regexMatch) {
        const val = binding[regexMatch[1]] || ''
        const flags = regexMatch[3] || ''
        return new RegExp(regexMatch[2], flags).test(val)
      }

      const boundMatch = expr.match(/bound\s*\(\s*\?(\w+)\s*\)/i)
      if (boundMatch) return binding[boundMatch[1]] !== undefined && binding[boundMatch[1]] !== null

      const notBoundMatch = expr.match(/!\s*bound\s*\(\s*\?(\w+)\s*\)/i)
      if (notBoundMatch) return !binding[notBoundMatch[1]]

      const compMatch = expr.match(/\?(\w+)\s*([><=!]+)\s*["']?(\S+?)["']?$/)
      if (compMatch) {
        const val = binding[compMatch[1]]
        const op = compMatch[2]
        const cmp = compMatch[3]
        if (op === '=' || op === '==') return val === cmp
        if (op === '!=') return val !== cmp
        if (op === '>') return parseFloat(val) > parseFloat(cmp)
        if (op === '<') return parseFloat(val) < parseFloat(cmp)
        if (op === '>=') return parseFloat(val) >= parseFloat(cmp)
        if (op === '<=') return parseFloat(val) <= parseFloat(cmp)
      }

      // Contains/str functions
      const containsMatch = expr.match(/contains\s*\(\s*(?:str\s*\(\s*)?\?(\w+)\)?\s*,\s*["']([^"']+)["']\s*\)/i)
      if (containsMatch) {
        return (binding[containsMatch[1]] || '').toLowerCase().includes(containsMatch[2].toLowerCase())
      }

      return true // unknown filter — pass through
    } catch (e) {
      return true
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Computed Columns — виртуальные колонки с формулами
// ══════════════════════════════════════════════════════════════════════════

const _computedColumns = new Map() // typeId → [{name, formula, type}]

export const ComputedColumns = {
  /**
   * Определить вычисляемую колонку
   * @param {string} typeId
   * @param {string} name — имя виртуальной колонки
   * @param {string} formula — JS-выражение: "row.Цена * row.Количество" или "row.val.length"
   * @param {string} [type='number'] — тип результата
   */
  define(typeId, name, formula, type = 'auto') {
    const key = String(typeId)
    if (!_computedColumns.has(key)) _computedColumns.set(key, [])
    const cols = _computedColumns.get(key)
    const existing = cols.findIndex(c => c.name === name)
    if (existing >= 0) cols[existing] = { name, formula, type }
    else cols.push({ name, formula, type })
    return { typeId: key, column: name, formula }
  },

  /** Удалить вычисляемую колонку */
  remove(typeId, name) {
    const key = String(typeId)
    const cols = _computedColumns.get(key) || []
    const idx = cols.findIndex(c => c.name === name)
    if (idx >= 0) cols.splice(idx, 1)
    return { removed: idx >= 0 }
  },

  /** Список вычисляемых колонок для типа */
  list(typeId) {
    return _computedColumns.get(String(typeId)) || []
  },

  /** Все определения */
  listAll() {
    const result = {}
    for (const [typeId, cols] of _computedColumns) {
      result[typeId] = cols
    }
    return result
  },

  /**
   * Применить вычисляемые колонки к массиву объектов
   * @param {string} typeId
   * @param {Array} objects — [{id, val, reqs: {alias: value}}]
   * @returns {Array} — объекты с добавленными computed полями
   */
  apply(typeId, objects) {
    const cols = _computedColumns.get(String(typeId))
    if (!cols || cols.length === 0) return objects

    return objects.map(obj => {
      const row = { val: obj.val || obj.value || '', id: obj.id, ...obj.reqs, ...obj.requisites }
      const computed = {}
      for (const col of cols) {
        try {
          const fn = new Function('row', `return (${col.formula})`)
          computed[col.name] = fn(row)
        } catch (e) {
          computed[col.name] = `#ERR: ${e.message}`
        }
      }
      return { ...obj, _computed: computed }
    })
  }
}

// ══════════════════════════════════════════════════════════════════════════
// DB Triggers — автодействия при CRUD операциях
// ══════════════════════════════════════════════════════════════════════════

const _dbTriggers = [] // [{id, event, typeId, condition, action, priority, enabled}]
let _triggerIdSeq = 1

export const DBTriggers = {
  /**
   * Зарегистрировать триггер
   * @param {Object} trigger
   * @param {string} trigger.event — 'create'|'update'|'delete'|'any'
   * @param {string} [trigger.typeId] — ID таблицы (null = все таблицы)
   * @param {string} [trigger.condition] — JS-выражение: "row.val.includes('URGENT')"
   * @param {string} trigger.action — тип действия: 'log'|'webhook'|'copy'|'set_field'|'create_event'|'custom'
   * @param {Object} [trigger.actionParams] — параметры действия
   * @param {number} [trigger.priority=10]
   * @param {string} [trigger.name]
   */
  register(trigger) {
    const t = {
      id: _triggerIdSeq++,
      name: trigger.name || `trigger_${_triggerIdSeq - 1}`,
      event: trigger.event || 'any',
      typeId: trigger.typeId ? String(trigger.typeId) : null,
      condition: trigger.condition || null,
      action: trigger.action || 'log',
      actionParams: trigger.actionParams || {},
      priority: trigger.priority || 10,
      enabled: true,
      firedCount: 0,
      lastFired: null
    }
    _dbTriggers.push(t)
    _dbTriggers.sort((a, b) => a.priority - b.priority)
    return t
  },

  /** Удалить триггер по ID */
  remove(triggerId) {
    const idx = _dbTriggers.findIndex(t => t.id === triggerId)
    if (idx >= 0) { _dbTriggers.splice(idx, 1); return { removed: true } }
    return { removed: false }
  },

  /** Включить/выключить */
  toggle(triggerId, enabled) {
    const t = _dbTriggers.find(t => t.id === triggerId)
    if (t) { t.enabled = enabled; return t }
    return null
  },

  /** Список всех триггеров */
  list() {
    return _dbTriggers.map(t => ({ ...t }))
  },

  /**
   * Выполнить триггеры для события
   * @param {string} event — 'create'|'update'|'delete'
   * @param {string} typeId
   * @param {Object} data — {objectId, value, requisites, ...}
   * @returns {Array} — результаты выполнения
   */
  async fire(event, typeId, data) {
    const applicable = _dbTriggers.filter(t =>
      t.enabled &&
      (t.event === event || t.event === 'any') &&
      (!t.typeId || t.typeId === String(typeId))
    )

    const results = []
    for (const trigger of applicable) {
      try {
        // Check condition
        if (trigger.condition) {
          const row = { val: data.value || '', id: data.objectId, ...data }
          const fn = new Function('row', `return !!(${trigger.condition})`)
          if (!fn(row)) continue
        }

        // Execute action
        let actionResult
        switch (trigger.action) {
          case 'log':
            console.log(`[TRIGGER ${trigger.name}] ${event} on type ${typeId}:`, data.objectId || data.value || '')
            actionResult = { logged: true }
            break
          case 'webhook': {
            const url = trigger.actionParams.url
            if (url) {
              try {
                await axios.post(url, { event, typeId, trigger: trigger.name, data }, { timeout: 5000 })
                actionResult = { webhook: url, sent: true }
              } catch (e) { actionResult = { webhook: url, error: e.message } }
            }
            break
          }
          case 'set_field': {
            const { reqId, value } = trigger.actionParams
            if (reqId && data.objectId) {
              const client = new IntegramV2Client()
              await client.setRequisiteValue(String(data.objectId), reqId, value)
              actionResult = { set: reqId, value }
            }
            break
          }
          case 'create_event': {
            const { eventType, title } = trigger.actionParams
            actionResult = { eventType, title: title || `Trigger: ${trigger.name}`, queued: true }
            break
          }
          default:
            actionResult = { action: trigger.action, note: 'custom action — not executed' }
        }

        trigger.firedCount++
        trigger.lastFired = new Date().toISOString()
        results.push({ triggerId: trigger.id, name: trigger.name, action: trigger.action, result: actionResult })
      } catch (e) {
        results.push({ triggerId: trigger.id, name: trigger.name, error: e.message })
      }
    }
    return results
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Table Permissions — разграничение доступа по таблицам
// ══════════════════════════════════════════════════════════════════════════

const _tablePermissions = new Map() // typeId → {role → ['read','write','delete','admin']}
const _defaultPermissions = ['read', 'write', 'delete', 'admin'] // default: full access

export const TablePermissions = {
  /**
   * Установить права для роли на таблицу
   * @param {string} typeId
   * @param {string} role — 'admin'|'editor'|'viewer'|'agent'|custom
   * @param {string[]} permissions — ['read','write','delete','admin']
   */
  grant(typeId, role, permissions) {
    const key = String(typeId)
    if (!_tablePermissions.has(key)) _tablePermissions.set(key, {})
    _tablePermissions.get(key)[role] = [...permissions]
    return { typeId: key, role, permissions }
  },

  /** Отозвать все права роли на таблицу */
  revoke(typeId, role) {
    const key = String(typeId)
    const perms = _tablePermissions.get(key)
    if (perms && perms[role]) {
      delete perms[role]
      return { revoked: true }
    }
    return { revoked: false }
  },

  /**
   * Проверить право
   * @param {string} typeId
   * @param {string} role
   * @param {string} permission — 'read'|'write'|'delete'|'admin'
   * @returns {boolean}
   */
  check(typeId, role, permission) {
    if (role === 'admin') return true // admin всегда может всё
    const perms = _tablePermissions.get(String(typeId))
    if (!perms) return true // нет ограничений = всё разрешено
    if (!perms[role]) return false // роль не указана = запрет
    return perms[role].includes(permission)
  },

  /** Список прав для таблицы */
  getForTable(typeId) {
    return _tablePermissions.get(String(typeId)) || {}
  },

  /** Все правила */
  listAll() {
    const result = {}
    for (const [typeId, perms] of _tablePermissions) {
      result[typeId] = perms
    }
    return result
  },

  /** Сбросить все права (вернуть full access) */
  reset(typeId) {
    if (typeId) {
      _tablePermissions.delete(String(typeId))
    } else {
      _tablePermissions.clear()
    }
    return { reset: true }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Rate Limiter — ограничение частоты запросов per client/IP
// ══════════════════════════════════════════════════════════════════════════

const _rateLimits = new Map()    // key → { maxPerMin, window: [{ts}] }
const _rateLimitRules = new Map() // name → { key, maxPerMin }

export const RateLimiter = {
  /**
   * Создать правило лимита
   * @param {string} name — имя правила
   * @param {string} key — по чему лимитировать: 'ip', 'role', 'agent', или конкретное значение
   * @param {number} maxPerMin — макс запросов в минуту
   */
  defineRule(name, key, maxPerMin) {
    _rateLimitRules.set(name, { key, maxPerMin })
    return { name, key, maxPerMin }
  },

  /** Удалить правило */
  removeRule(name) {
    _rateLimitRules.delete(name)
    return { removed: true }
  },

  /** Список правил */
  listRules() {
    const rules = []
    for (const [name, rule] of _rateLimitRules) rules.push({ name, ...rule })
    return rules
  },

  /**
   * Проверить и зарегистрировать запрос
   * @param {string} clientKey — IP, role, agentId
   * @returns {{allowed: boolean, remaining: number, resetIn: number}}
   */
  check(clientKey) {
    // Find matching rule
    let maxPerMin = 60 // default
    for (const [, rule] of _rateLimitRules) {
      if (rule.key === clientKey || rule.key === '*') {
        maxPerMin = rule.maxPerMin
        break
      }
    }

    const now = Date.now()
    const windowMs = 60_000
    if (!_rateLimits.has(clientKey)) _rateLimits.set(clientKey, [])
    const window = _rateLimits.get(clientKey)

    // Remove expired entries
    while (window.length > 0 && now - window[0] > windowMs) window.shift()

    if (window.length >= maxPerMin) {
      const resetIn = Math.ceil((window[0] + windowMs - now) / 1000)
      return { allowed: false, remaining: 0, resetIn, limit: maxPerMin }
    }

    window.push(now)
    return { allowed: true, remaining: maxPerMin - window.length, resetIn: 0, limit: maxPerMin }
  },

  /** Текущая статистика по всем клиентам */
  stats() {
    const now = Date.now()
    const result = {}
    for (const [key, window] of _rateLimits) {
      const active = window.filter(ts => now - ts < 60_000)
      if (active.length > 0) result[key] = { requestsLastMin: active.length }
    }
    return result
  },

  /** Сбросить лимиты */
  reset(clientKey) {
    if (clientKey) _rateLimits.delete(clientKey)
    else _rateLimits.clear()
    return { reset: true }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Request Metrics — логирование и метрики запросов
// ══════════════════════════════════════════════════════════════════════════

const _metrics = {
  totalRequests: 0,
  totalErrors: 0,
  byTool: {},        // toolName → { count, errors, totalMs, avgMs }
  byDatabase: {},    // db → { count }
  recentRequests: [] // last 100: [{tool, db, ms, ts, error?}]
}
const MAX_RECENT = 100

export const RequestMetrics = {
  /**
   * Записать запрос
   * @param {string} tool — имя инструмента
   * @param {string} database
   * @param {number} durationMs
   * @param {string|null} error
   */
  record(tool, database, durationMs, error = null) {
    _metrics.totalRequests++
    if (error) _metrics.totalErrors++

    // By tool
    if (!_metrics.byTool[tool]) _metrics.byTool[tool] = { count: 0, errors: 0, totalMs: 0 }
    const t = _metrics.byTool[tool]
    t.count++
    if (error) t.errors++
    t.totalMs += durationMs
    t.avgMs = Math.round(t.totalMs / t.count)

    // By database
    if (!_metrics.byDatabase[database]) _metrics.byDatabase[database] = { count: 0 }
    _metrics.byDatabase[database].count++

    // Recent
    _metrics.recentRequests.push({
      tool, database, ms: durationMs, ts: new Date().toISOString(),
      ...(error ? { error } : {})
    })
    if (_metrics.recentRequests.length > MAX_RECENT) {
      _metrics.recentRequests = _metrics.recentRequests.slice(-MAX_RECENT)
    }
  },

  /** Получить метрики */
  get() {
    const topSlowest = Object.entries(_metrics.byTool)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 10)

    const topUsed = Object.entries(_metrics.byTool)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalRequests: _metrics.totalRequests,
      totalErrors: _metrics.totalErrors,
      errorRate: _metrics.totalRequests > 0
        ? `${((_metrics.totalErrors / _metrics.totalRequests) * 100).toFixed(1)}%`
        : '0%',
      topSlowest,
      topUsed,
      byDatabase: _metrics.byDatabase
    }
  },

  /** Последние N запросов */
  recent(limit = 20) {
    return _metrics.recentRequests.slice(-limit).reverse()
  },

  /** Сбросить метрики */
  reset() {
    _metrics.totalRequests = 0
    _metrics.totalErrors = 0
    _metrics.byTool = {}
    _metrics.byDatabase = {}
    _metrics.recentRequests = []
    return { reset: true }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Data Validation Rules — правила валидации данных per column
// ══════════════════════════════════════════════════════════════════════════

const _validationRules = new Map() // typeId → [{reqAlias, rule, message}]

export const DataValidation = {
  /**
   * Добавить правило валидации
   * @param {string} typeId
   * @param {string} field — alias колонки или 'val' для основного значения
   * @param {string} rule — тип: 'required'|'minLength'|'maxLength'|'pattern'|'range'|'enum'|'custom'
   * @param {*} param — параметр правила (число, regex, массив, JS-выражение)
   * @param {string} [message] — сообщение об ошибке
   */
  addRule(typeId, field, rule, param, message) {
    const key = String(typeId)
    if (!_validationRules.has(key)) _validationRules.set(key, [])
    _validationRules.get(key).push({
      field,
      rule,
      param,
      message: message || `Validation failed: ${field} — ${rule}`
    })
    return { typeId: key, field, rule, param }
  },

  /** Удалить все правила для поля */
  removeRules(typeId, field) {
    const key = String(typeId)
    const rules = _validationRules.get(key) || []
    const before = rules.length
    const filtered = rules.filter(r => r.field !== field)
    _validationRules.set(key, filtered)
    return { removed: before - filtered.length }
  },

  /** Список правил */
  list(typeId) {
    if (typeId) return _validationRules.get(String(typeId)) || []
    const result = {}
    for (const [k, v] of _validationRules) result[k] = v
    return result
  },

  /**
   * Валидировать данные перед записью
   * @param {string} typeId
   * @param {Object} data — { val: 'value', requisites: { alias: value } }
   * @returns {{valid: boolean, errors: Array}}
   */
  validate(typeId, data) {
    const rules = _validationRules.get(String(typeId))
    if (!rules || rules.length === 0) return { valid: true, errors: [] }

    const errors = []
    const allFields = { val: data.value || data.val || '', ...(data.requisites || {}) }

    for (const { field, rule, param, message } of rules) {
      const value = allFields[field]

      switch (rule) {
        case 'required':
          if (!value || String(value).trim() === '') errors.push({ field, rule, message })
          break
        case 'minLength':
          if (String(value || '').length < param) errors.push({ field, rule, message, expected: param, got: String(value || '').length })
          break
        case 'maxLength':
          if (String(value || '').length > param) errors.push({ field, rule, message, expected: param, got: String(value || '').length })
          break
        case 'pattern':
          if (!new RegExp(param).test(String(value || ''))) errors.push({ field, rule, message, pattern: param })
          break
        case 'range': {
          const num = parseFloat(value)
          const [min, max] = Array.isArray(param) ? param : [0, param]
          if (isNaN(num) || num < min || num > max) errors.push({ field, rule, message, range: [min, max], got: value })
          break
        }
        case 'enum':
          if (!Array.isArray(param) || !param.includes(String(value))) errors.push({ field, rule, message, allowed: param, got: value })
          break
        case 'custom':
          try {
            const fn = new Function('value', 'data', `return !!(${param})`)
            if (!fn(value, allFields)) errors.push({ field, rule, message })
          } catch (e) {
            errors.push({ field, rule, message: `Custom validation error: ${e.message}` })
          }
          break
      }
    }

    return { valid: errors.length === 0, errors }
  }
}

// ── Change Polling ──────────────────────────────────────────────────────────

const _changeListeners = new Map() // database → [{typeId, callback, lastCheck}]
const _changeSnapshots = new Map() // "db:typeId" → {objectCount, checksum, ts}

/**
 * Polling-based change detection.
 * Compares object counts + newest object IDs to detect inserts/deletes.
 */
export const ChangeWatcher = {
  /**
   * Check a table for changes since last check
   * @param {string} database
   * @param {number|string} typeId
   * @returns {{changed: boolean, details: Object}}
   */
  async check(database, typeId) {
    const client = new IntegramV2Client(database)
    const key = `${database}:${typeId}`
    const prev = _changeSnapshots.get(key)

    try {
      const objects = await client.getObjects(typeId, { limit: 5, withReqs: false })
      const current = {
        objectCount: objects.length,
        newestIds: objects.slice(0, 5).map(o => o.id).sort().join(','),
        ts: Date.now()
      }

      // Also get total count from stats if possible
      let totalCount = objects.length
      try {
        const stats = await client.getStats()
        const typeStat = stats.byType?.find(t => String(t.id) === String(typeId))
        if (typeStat) totalCount = typeStat.objectCount
        current.objectCount = totalCount
      } catch (_) {}

      _changeSnapshots.set(key, current)

      if (!prev) {
        return { changed: false, firstCheck: true, snapshot: current }
      }

      const countChanged = current.objectCount !== prev.objectCount
      const idsChanged = current.newestIds !== prev.newestIds

      return {
        changed: countChanged || idsChanged,
        details: {
          countDelta: current.objectCount - prev.objectCount,
          countChanged,
          idsChanged,
          prevCheck: new Date(prev.ts).toISOString(),
          currentCheck: new Date(current.ts).toISOString(),
          elapsedMs: current.ts - prev.ts
        },
        snapshot: current
      }
    } catch (e) {
      return { changed: false, error: e.message }
    }
  },

  /**
   * Check multiple tables at once
   * @param {string} database
   * @param {Array<number|string>} typeIds — if empty, checks top-20 tables
   * @returns {Object} — { changes: [{typeId, name, ...}], unchanged: number }
   */
  async checkMultiple(database, typeIds = []) {
    const client = new IntegramV2Client(database)

    if (!typeIds.length) {
      const stats = await client.getStats()
      typeIds = (stats.byType || [])
        .filter(t => t.objectCount > 0)
        .sort((a, b) => b.objectCount - a.objectCount)
        .slice(0, 20)
        .map(t => t.id)
    }

    const results = await Promise.allSettled(
      typeIds.map(id => this.check(database, id).then(r => ({ typeId: id, ...r })))
    )

    const changes = []
    let unchanged = 0

    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value.changed) changes.push(r.value)
        else unchanged++
      }
    }

    return { changes, unchanged, checkedTables: typeIds.length }
  },

  /** Clear stored snapshots */
  reset(database) {
    if (database) {
      for (const key of _changeSnapshots.keys()) {
        if (key.startsWith(`${database}:`)) _changeSnapshots.delete(key)
      }
    } else {
      _changeSnapshots.clear()
    }
  }
}

// ── Data Snapshots & Diff ──────────────────────────────────────────────────

const _snapshots = new Map() // "db:typeId:label" → {ts, objects}

export const DataSnapshot = {
  /**
   * Take a snapshot of a table's data
   * @param {string} database
   * @param {number|string} typeId
   * @param {string} label — snapshot name (e.g. "before-migration")
   * @returns {{label, typeId, objectCount, ts}}
   */
  async take(database, typeId, label = 'auto') {
    const client = new IntegramV2Client(database)
    const objects = await client.getObjects(typeId, { limit: 5000, withReqs: true })
    const key = `${database}:${typeId}:${label}`
    const snapshot = {
      ts: Date.now(),
      label,
      typeId: String(typeId),
      database,
      objects
    }
    _snapshots.set(key, snapshot)
    return { label, typeId, objectCount: objects.length, ts: new Date().toISOString() }
  },

  /**
   * Diff two snapshots (or current state vs snapshot)
   * @param {string} database
   * @param {number|string} typeId
   * @param {string} labelA — first snapshot label
   * @param {string} labelB — second snapshot label, or "current" for live data
   * @returns {{added, removed, modified, unchanged}}
   */
  async diff(database, typeId, labelA, labelB = 'current') {
    const keyA = `${database}:${typeId}:${labelA}`
    const snapA = _snapshots.get(keyA)
    if (!snapA) return { error: `Snapshot "${labelA}" not found. Available: ${this.list(database, typeId).map(s => s.label).join(', ')}` }

    let objectsB
    if (labelB === 'current') {
      const client = new IntegramV2Client(database)
      objectsB = await client.getObjects(typeId, { limit: 5000, withReqs: true })
    } else {
      const keyB = `${database}:${typeId}:${labelB}`
      const snapB = _snapshots.get(keyB)
      if (!snapB) return { error: `Snapshot "${labelB}" not found` }
      objectsB = snapB.objects
    }

    const mapA = new Map(snapA.objects.map(o => [String(o.id), o]))
    const mapB = new Map(objectsB.map(o => [String(o.id), o]))

    const added = []
    const removed = []
    const modified = []
    let unchanged = 0

    // Find added and modified
    for (const [id, objB] of mapB) {
      const objA = mapA.get(id)
      if (!objA) {
        added.push({ id, val: objB.val || objB.value })
      } else {
        const valA = JSON.stringify(objA)
        const valB = JSON.stringify(objB)
        if (valA !== valB) {
          modified.push({ id, val: objB.val || objB.value, before: objA.val, after: objB.val })
        } else {
          unchanged++
        }
      }
    }

    // Find removed
    for (const [id, objA] of mapA) {
      if (!mapB.has(id)) {
        removed.push({ id, val: objA.val || objA.value })
      }
    }

    return {
      snapshotA: { label: labelA, ts: new Date(snapA.ts).toISOString(), count: snapA.objects.length },
      snapshotB: { label: labelB, ts: new Date().toISOString(), count: objectsB.length },
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      unchanged,
      details: {
        added: added.slice(0, 50),
        removed: removed.slice(0, 50),
        modified: modified.slice(0, 50)
      }
    }
  },

  /** List available snapshots */
  list(database, typeId) {
    const prefix = typeId ? `${database}:${typeId}:` : `${database}:`
    const result = []
    for (const [key, snap] of _snapshots) {
      if (key.startsWith(prefix)) {
        result.push({ label: snap.label, typeId: snap.typeId, objectCount: snap.objects.length, ts: new Date(snap.ts).toISOString() })
      }
    }
    return result
  },

  /** Delete a snapshot */
  delete(database, typeId, label) {
    return _snapshots.delete(`${database}:${typeId}:${label}`)
  }
}

// ── Graph Traversal ────────────────────────────────────────────────────────

export const GraphTraversal = {
  /**
   * Traverse reference chains: Дрон → Производитель → Страна
   * @param {string} database
   * @param {number|string} startObjectId — starting object ID
   * @param {number} maxDepth — max hops (default 3)
   * @returns {{root, nodes, edges, depth}}
   */
  async traverse(database, startObjectId, maxDepth = 3) {
    const client = new IntegramV2Client(database)
    const visited = new Set()
    const nodes = []
    const edges = []

    async function walk(objectId, depth) {
      if (depth > maxDepth || visited.has(String(objectId))) return
      visited.add(String(objectId))

      try {
        const obj = await client.getObject(objectId)
        if (!obj) return

        const node = {
          id: String(objectId),
          val: obj.val || obj.value,
          typeId: obj.typeId,
          typeName: obj.typeName,
          depth
        }
        nodes.push(node)

        // Find reference fields (values that look like object IDs pointing to other types)
        const reqs = obj.reqs || obj.requisites || {}
        for (const [reqId, reqData] of Object.entries(reqs)) {
          const refId = typeof reqData === 'object' ? (reqData.ref || reqData.value) : reqData
          if (refId && /^\d+$/.test(String(refId)) && parseInt(refId) > 1000) {
            try {
              const refObj = await client.getObject(refId)
              if (refObj) {
                edges.push({
                  from: String(objectId),
                  to: String(refId),
                  field: reqData?.alias || reqId,
                  refVal: refObj.val || refObj.value
                })
                await walk(refId, depth + 1)
              }
            } catch (_) {}
          }
        }

        // Check children
        if (obj.children?.length) {
          for (const child of obj.children.slice(0, 10)) {
            edges.push({ from: String(objectId), to: String(child.id), relation: 'child' })
            await walk(child.id, depth + 1)
          }
        }
      } catch (e) {
        nodes.push({ id: String(objectId), error: e.message, depth })
      }
    }

    await walk(startObjectId, 0)

    return {
      root: String(startObjectId),
      nodes,
      edges,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      maxDepthReached: Math.max(...nodes.map(n => n.depth), 0)
    }
  },

  /**
   * Find all reference paths between two tables
   * @param {string} database
   * @param {number|string} fromTypeId
   * @param {number|string} toTypeId
   * @returns {{paths: Array, direct: boolean}}
   */
  async findPaths(database, fromTypeId, toTypeId) {
    const client = new IntegramV2Client(database)
    const rels = await client.getRelationships()
    const relationships = rels.relationships || rels || []

    // BFS to find paths
    const queue = [[String(fromTypeId)]]
    const visited = new Set([String(fromTypeId)])
    const paths = []

    while (queue.length > 0 && paths.length < 5) {
      const path = queue.shift()
      const current = path[path.length - 1]

      if (path.length > 5) continue // max 5 hops

      for (const rel of relationships) {
        const src = String(rel.sourceTypeId || rel.from)
        const tgt = String(rel.targetTypeId || rel.to)

        let next = null
        if (src === current && !visited.has(tgt)) next = tgt
        if (tgt === current && !visited.has(src)) next = src

        if (next) {
          const newPath = [...path, next]
          if (next === String(toTypeId)) {
            paths.push(newPath)
          } else {
            visited.add(next)
            queue.push(newPath)
          }
        }
      }
    }

    return {
      from: String(fromTypeId),
      to: String(toTypeId),
      paths,
      direct: paths.some(p => p.length === 2),
      shortestHops: paths.length > 0 ? Math.min(...paths.map(p => p.length - 1)) : null
    }
  }
}

export default IntegramV2Client
