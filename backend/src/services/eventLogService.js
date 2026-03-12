/**
 * EventLog Service — персистентность событийного лога в Integram
 *
 * Таблица EventLog (typeId: 7847) в БД fst:
 *   eventId    (7849) — уникальный ID события
 *   entityType (7851) — project | company | deal | session | fund
 *   entityId   (7853) — ID сущности
 *   eventType  (7855) — тип события (DEAL_CLOSED, KPI_UPDATED, ...)
 *   data       (7857) — JSON-строка с данными события
 *   ts         (7859) — unix timestamp (ms)
 *
 * Integram API notes:
 *   - Auth:  POST /{db}/auth → 302 + Set-Cookie: {db}=<token>
 *   - Read:  GET  /{db}/object/{typeId}?JSON_KV&LIMIT=N&pg=1
 *            + headers: X-Authorization + Cookie: token=<token>
 *   - Write: POST /{db}/_m_new/{typeId}?full=1&JSON_KV
 *            + body: _xsrf=<xsrf>&t{typeId}=<name>&t{reqId}=<val>&up=1
 *   - Delete: POST /{db}/_m_del/{intId}?JSON_KV
 */

import { authenticateIntegram } from '../api/middleware/auth.js'

const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const INTEGRAM_DB = 'fst'

const EVENT_LOG_TYPE = 7847
const REQ = {
  eventId:    7849,
  entityType: 7851,
  entityId:   7853,
  eventType:  7855,
  data:       7857,
  ts:         7859,
}

// ─── Cache ────────────────────────────────────────────────────────────────────
// Все запросы идут через fetchAllRows() который грузит таблицу целиком.
// Кэшируем результат на TTL_MS — при 100+ событиях экономит 90% времени.

const CACHE_TTL_MS = 30_000
let _cache = null
let _cacheTs = 0

function invalidateCache() {
  _cache = null
  _cacheTs = 0
}

// ─── Хелперы ──────────────────────────────────────────────────────────────────

async function getAuth() {
  const auth = await authenticateIntegram()
  return {
    headers: {
      'X-Authorization': auth.token,
      'Cookie': `token=${auth.token}`,
    },
    xsrf: auth.xsrf,
    token: auth.token,
  }
}

function parseRow(row) {
  // После слияния с reqs ключи — числовые строки "7849", "7851" и т.д.
  return {
    id:         row[REQ.eventId]    || row.val || '',
    entityType: row[REQ.entityType] || '',
    entityId:   row[REQ.entityId]   || '',
    type:       row[REQ.eventType]  || '',
    data:       safeJson(row[REQ.data]),
    ts:         Number(row[REQ.ts]) || 0,
    _intId:     row.id,
  }
}

function safeJson(str) {
  if (!str) return {}
  try { return JSON.parse(str) } catch { return {} }
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Добавить событие
 */
export async function appendEvent(event) {
  invalidateCache() // новое событие = кэш устарел
  const { headers, xsrf, token } = await getAuth()

  // Формат Integram: t{typeId}=name, t{reqId}=val, _xsrf в теле
  const params = new URLSearchParams({
    _xsrf:                    xsrf,
    [`t${EVENT_LOG_TYPE}`]:   event.id,        // название объекта = eventId
    [`t${REQ.eventId}`]:      event.id,
    [`t${REQ.entityType}`]:   event.entityType,
    [`t${REQ.entityId}`]:     event.entityId,
    [`t${REQ.eventType}`]:    event.type,
    [`t${REQ.data}`]:         JSON.stringify(event.data || {}),
    [`t${REQ.ts}`]:           String(event.ts || Date.now()),
    up:                       '1',
  })

  const res = await fetch(
    `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_new/${EVENT_LOG_TYPE}?full=1&JSON_KV`,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    }
  )

  const text = await res.text()
  if (!res.ok) throw new Error(`EventLog append failed: ${res.status} ${text.substring(0, 200)}`)

  try { return JSON.parse(text) } catch { return { ok: true } }
}

/**
 * Получить все события (постранично) и отфильтровать по entityType/entityId
 */
const MAX_PAGES = 5 // cap at 2500 events to prevent OOM

async function fetchAllRows() {
  if (_cache && Date.now() - _cacheTs < CACHE_TTL_MS) return _cache

  const { headers } = await getAuth()
  const rows = []
  let page = 1

  while (page <= MAX_PAGES) {
    const res = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/object/${EVENT_LOG_TYPE}?JSON_KV&LIMIT=500&pg=${page}`,
      { headers, signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) throw new Error(`EventLog fetch failed: ${res.status}`)

    const data = await res.json()
    const pageObjs = data.object || []
    if (!Array.isArray(pageObjs) || pageObjs.length === 0) break

    // Объединяем базовые поля объекта с реквизитами из data.reqs
    for (const obj of pageObjs) {
      const reqData = (data.reqs && data.reqs[obj.id]) || {}
      rows.push({ ...obj, ...reqData })
    }

    if (pageObjs.length < 500) break
    page++
  }

  _cache = rows
  _cacheTs = Date.now()
  return rows
}

/**
 * Получить ленту событий для конкретной сущности
 */
export async function getTimeline(entityType, entityId) {
  const rows = await fetchAllRows()
  return rows
    .map(parseRow)
    .filter(e => e.entityType === entityType && e.entityId === entityId)
    .sort((a, b) => a.ts - b.ts)
}

/**
 * Получить все события по entityType (для сводки)
 */
export async function getTimelinesByType(entityType) {
  const rows = await fetchAllRows()
  return rows
    .map(parseRow)
    .filter(e => e.entityType === entityType)
    .sort((a, b) => a.ts - b.ts)
}

/**
 * Удалить событие по Integram ID
 */
export async function deleteEvent(intId) {
  const { headers, xsrf } = await getAuth()

  const res = await fetch(
    `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_del/${intId}?JSON_KV`,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _xsrf: xsrf }),
    }
  )

  if (!res.ok) throw new Error(`EventLog delete failed: ${res.status}`)
}
