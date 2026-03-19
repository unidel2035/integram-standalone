/**
 * Audit Middleware — иммутабельный журнал аудита для MCP-вызовов
 *
 * Создаёт цепочку хешей (chain-of-custody) для каждого действия агента.
 * Буферизует записи и периодически сбрасывает в Integram (таблица HIVE_AuditLog).
 *
 * @module auditMiddleware
 */

import { randomUUID, createHash } from 'crypto'
import logger from '../utils/logger.js'
import { IntegramClient } from '../services/integram/integram-client.js'
import { getIntegramConfig, getIntegramSystemCredentials } from '../utils/integramConfig.js'

/** Поля, которые необходимо удалять из аргументов */
const SENSITIVE_KEYS = new Set([
  'password', 'token', 'secret', 'apikey', 'api_key',
  'apiKey', 'credentials', 'authorization', 'sessionToken',
  'accessToken', 'refreshToken', 'privateKey', 'private_key'
])

/**
 * Удаляет чувствительные данные из объекта аргументов.
 * Рекурсивно обходит вложенные объекты.
 *
 * @param {object} args — исходный объект аргументов
 * @returns {object} — копия без секретов
 */
function sanitizeArgs(args) {
  if (!args || typeof args !== 'object') return args
  if (Array.isArray(args)) return args.map(item => sanitizeArgs(item))

  const sanitized = {}
  for (const [key, value] of Object.entries(args)) {
    if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]'
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeArgs(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

/**
 * Буфер аудит-записей с цепочкой хешей и периодической выгрузкой в Integram.
 */
class AuditBuffer {
  /**
   * @param {object} options
   * @param {number} options.bufferSize — макс. кол-во записей до автосброса
   * @param {number} options.flushIntervalMs — интервал автосброса (мс)
   * @param {boolean} options.enableChainHash — включить цепочку хешей
   */
  constructor(options = {}) {
    this.bufferSize = options.bufferSize ?? 50
    this.flushIntervalMs = options.flushIntervalMs ?? 30000
    this.enableChainHash = options.enableChainHash ?? true

    /** @type {Array<object>} Текущий буфер записей */
    this.entries = []

    /** @type {string} Последний хеш в цепочке */
    this.lastChainHash = '0'.repeat(64)

    /** @type {number} Общее кол-во обработанных записей */
    this.totalEntries = 0

    /** @type {Map<string, number>} Счётчик вызовов по инструментам */
    this.toolCounts = new Map()

    /** @type {Map<string, number>} Счётчик вызовов по агентам */
    this.agentCounts = new Map()

    /** @type {number} Время создания буфера */
    this.createdAt = Date.now()

    /** @type {boolean} Идёт ли сейчас сброс */
    this._flushing = false

    /** @type {IntegramClient|null} Клиент для сброса */
    this._client = null

    // Запуск периодического сброса
    this._flushTimer = setInterval(() => {
      if (this.entries.length > 0) {
        this.flush().catch(err =>
          logger.error({ err }, '[AuditBuffer] Ошибка автосброса')
        )
      }
    }, this.flushIntervalMs)

    // Не блокируем завершение процесса
    if (this._flushTimer.unref) this._flushTimer.unref()
  }

  /**
   * Вычисляет SHA-256 хеш для цепочки.
   *
   * @param {string} prevHash — предыдущий хеш
   * @param {object} entry — текущая запись
   * @returns {string} — hex-строка SHA-256
   */
  _computeChainHash(prevHash, entry) {
    const payload = prevHash + JSON.stringify(entry)
    return createHash('sha256').update(payload).digest('hex')
  }

  /**
   * Добавляет запись в буфер. При превышении bufferSize — автосброс.
   *
   * @param {object} entry — аудит-запись (без chainHash)
   */
  add(entry) {
    if (this.enableChainHash) {
      entry.chainHash = this._computeChainHash(this.lastChainHash, entry)
      this.lastChainHash = entry.chainHash
    }

    this.entries.push(Object.freeze(entry))
    this.totalEntries++

    // Обновляем статистику
    this.toolCounts.set(entry.toolName, (this.toolCounts.get(entry.toolName) || 0) + 1)
    if (entry.agentId) {
      this.agentCounts.set(entry.agentId, (this.agentCounts.get(entry.agentId) || 0) + 1)
    }

    if (this.entries.length >= this.bufferSize) {
      this.flush().catch(err =>
        logger.error({ err }, '[AuditBuffer] Ошибка сброса по переполнению')
      )
    }
  }

  /**
   * Возвращает последние N записей из памяти.
   *
   * @param {number} n — кол-во записей
   * @returns {Array<object>}
   */
  getRecent(n = 10) {
    return this.entries.slice(-n)
  }

  /**
   * Проверяет целостность цепочки хешей в текущем буфере.
   *
   * @returns {{ valid: boolean, brokenAt: number|null }}
   */
  verifyChain() {
    if (!this.enableChainHash || this.entries.length === 0) {
      return { valid: true, brokenAt: null }
    }

    let prevHash = '0'.repeat(64)

    // Если есть предыдущие записи, которые уже были сброшены,
    // мы проверяем только текущий буфер: первая запись использует
    // тот prevHash, который был на момент добавления
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i]
      const entryWithoutHash = { ...entry }
      delete entryWithoutHash.chainHash

      const expected = this._computeChainHash(prevHash, entryWithoutHash)
      if (entry.chainHash !== expected) {
        return { valid: false, brokenAt: i }
      }
      prevHash = entry.chainHash
    }
    return { valid: true, brokenAt: null }
  }

  /**
   * Получает или создаёт Integram-клиент для записи.
   *
   * @returns {Promise<IntegramClient>}
   */
  async _getClient() {
    if (this._client?.token) return this._client

    const config = getIntegramConfig()
    const creds = getIntegramSystemCredentials()
    const client = new IntegramClient(config.server, config.database)

    await client.login(creds.username, creds.password)
    this._client = client
    return client
  }

  /**
   * Сбрасывает буфер в Integram (таблица HIVE_AuditLog).
   * Записи пакетно создаются через клиент.
   */
  async flush() {
    if (this._flushing || this.entries.length === 0) return
    this._flushing = true

    const batch = [...this.entries]
    this.entries = []

    try {
      const client = await this._getClient()

      for (const entry of batch) {
        await client.createObject('HIVE_AuditLog', {
          auditId: entry.id,
          timestamp: entry.timestamp,
          agentId: entry.agentId || '',
          toolName: entry.toolName || '',
          arguments: JSON.stringify(entry.arguments),
          server: entry.server || '',
          governanceDecision: entry.governanceDecision
            ? JSON.stringify(entry.governanceDecision)
            : '',
          responseStatus: String(entry.responseStatus),
          success: entry.success ? '1' : '0',
          duration: String(entry.duration),
          chainHash: entry.chainHash || ''
        })
      }

      logger.info(
        { count: batch.length },
        '[AuditBuffer] Сброс в HIVE_AuditLog выполнен'
      )
    } catch (err) {
      // Возвращаем записи обратно в начало буфера, чтобы не потерять
      this.entries = [...batch, ...this.entries]
      logger.error({ err }, '[AuditBuffer] Не удалось записать в Integram')
    } finally {
      this._flushing = false
    }
  }

  /**
   * Останавливает таймер автосброса и выполняет финальный сброс.
   */
  async destroy() {
    clearInterval(this._flushTimer)
    await this.flush()
  }
}

/** @type {AuditBuffer|null} Глобальный экземпляр буфера */
let _globalBuffer = null

/**
 * Возвращает глобальный буфер, создавая при необходимости.
 *
 * @param {object} options — параметры буфера
 * @returns {AuditBuffer}
 */
function getBuffer(options) {
  if (!_globalBuffer) {
    _globalBuffer = new AuditBuffer(options)
  }
  return _globalBuffer
}

/**
 * Фабрика middleware для аудит-логирования MCP-вызовов.
 *
 * Перехватывает запрос и ответ, формирует иммутабельную запись
 * с цепочкой хешей и буферизует для последующей записи в Integram.
 *
 * @param {object} [options]
 * @param {number} [options.bufferSize=50] — размер буфера до автосброса
 * @param {number} [options.flushIntervalMs=30000] — интервал автосброса (мс)
 * @param {boolean} [options.enableChainHash=true] — цепочка хешей
 * @returns {Function} Express middleware
 */
function auditMiddleware(options = {}) {
  const buffer = getBuffer({
    bufferSize: options.bufferSize ?? 50,
    flushIntervalMs: options.flushIntervalMs ?? 30000,
    enableChainHash: options.enableChainHash ?? true
  })

  return (req, res, next) => {
    const startTime = Date.now()

    // Захватываем данные из запроса
    const toolName = req.body?.toolName || 'unknown'
    const args = req.body?.arguments || {}
    const server = req.body?.server || ''
    const agentId =
      req.headers['x-agent-id'] ||
      req.body?.agentId ||
      'anonymous'
    const governanceDecision = req.governanceDecision || null

    // Перехватываем res.json(), чтобы зафиксировать ответ
    const originalJson = res.json.bind(res)
    let responseCaptured = false

    res.json = function auditWrappedJson(body) {
      if (!responseCaptured) {
        responseCaptured = true

        const duration = Date.now() - startTime
        const success = res.statusCode >= 200 && res.statusCode < 400

        /** @type {object} Аудит-запись */
        const entry = {
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          agentId,
          toolName,
          arguments: sanitizeArgs(args),
          server,
          governanceDecision,
          responseStatus: res.statusCode,
          success,
          duration
        }

        buffer.add(entry)

        logger.debug(
          { auditId: entry.id, toolName, agentId, duration, success },
          '[Audit] MCP-вызов зарегистрирован'
        )
      }

      return originalJson(body)
    }

    next()
  }
}

/**
 * Возвращает статистику аудит-лога.
 *
 * @returns {{ totalEntries: number, entriesPerMinute: number, topTools: Array, topAgents: Array, chainValid: boolean }}
 */
function getAuditStats() {
  const buffer = getBuffer()
  const uptimeMinutes = (Date.now() - buffer.createdAt) / 60000 || 1

  const topTools = [...buffer.toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tool, count]) => ({ tool, count }))

  const topAgents = [...buffer.agentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([agent, count]) => ({ agent, count }))

  const chainResult = buffer.verifyChain()

  return {
    totalEntries: buffer.totalEntries,
    entriesPerMinute: +(buffer.totalEntries / uptimeMinutes).toFixed(2),
    topTools,
    topAgents,
    chainValid: chainResult.valid
  }
}

/**
 * Поиск записей в in-memory буфере по фильтру.
 *
 * @param {object} filter
 * @param {string} [filter.agentId] — фильтр по агенту
 * @param {string} [filter.toolName] — фильтр по инструменту
 * @param {boolean} [filter.success] — фильтр по успешности
 * @param {string} [filter.dateFrom] — начало периода (ISO)
 * @param {string} [filter.dateTo] — конец периода (ISO)
 * @param {number} [filter.limit=50] — макс. кол-во результатов
 * @returns {Array<object>}
 */
function queryAuditLog(filter = {}) {
  const buffer = getBuffer()
  let results = [...buffer.entries]

  if (filter.agentId) {
    results = results.filter(e => e.agentId === filter.agentId)
  }
  if (filter.toolName) {
    results = results.filter(e => e.toolName === filter.toolName)
  }
  if (typeof filter.success === 'boolean') {
    results = results.filter(e => e.success === filter.success)
  }
  if (filter.dateFrom) {
    const from = new Date(filter.dateFrom).getTime()
    results = results.filter(e => new Date(e.timestamp).getTime() >= from)
  }
  if (filter.dateTo) {
    const to = new Date(filter.dateTo).getTime()
    results = results.filter(e => new Date(e.timestamp).getTime() <= to)
  }

  const limit = filter.limit ?? 50
  return results.slice(-limit)
}

/**
 * Проверяет целостность цепочки хешей аудит-буфера.
 * Экспортирован для использования в MCP tools.
 *
 * @returns {{ valid: boolean, brokenAt: number|null, totalEntries: number }}
 */
function verifyAuditChain() {
  const buffer = getBuffer()
  const chainResult = buffer.verifyChain()
  return {
    ...chainResult,
    totalEntries: buffer.totalEntries,
    entriesInBuffer: buffer.entries.length
  }
}

export { auditMiddleware, AuditBuffer, sanitizeArgs, getAuditStats, queryAuditLog, verifyAuditChain }
