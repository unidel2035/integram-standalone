import { Router } from 'express'
import fetch from 'node-fetch'

const router = Router()

const INTEGRAM_URL   = process.env.INTEGRAM_SERVER_URL || 'https://api.ai2o.ru'
const INTEGRAM_DB    = process.env.INTEGRAM_DB_FST || 'fst'
const INTEGRAM_LOGIN = process.env.INTEGRAM_SYSTEM_USERNAME || ''
const INTEGRAM_PASS  = process.env.INTEGRAM_SYSTEM_PASSWORD || ''

// ── Integram auth helper ───────────────────────────────────────────
let _cachedToken = null
let _cachedXsrf  = null
let _tokenExpiry = 0

async function getIntegramToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return { token: _cachedToken, xsrf: _cachedXsrf }
  const resp = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ login: INTEGRAM_LOGIN, pwd: INTEGRAM_PASS }),
    redirect: 'manual',
  })
  // Token comes as a cookie: fst={token}
  const cookieHdr = (resp.headers.raw?.()?.['set-cookie'] || [resp.headers.get('set-cookie')].filter(Boolean))
  const tokenMatch = cookieHdr.join(';').match(new RegExp(`${INTEGRAM_DB}=([^;\\s]+)`))
  _cachedToken  = tokenMatch?.[1] || null
  _cachedXsrf   = _cachedToken   // xsrf will be fetched lazily via /xsrf endpoint if needed
  _tokenExpiry  = Date.now() + 25 * 60 * 1000  // 25 min
  if (!_cachedToken) throw new Error('Integram auth failed')
  return { token: _cachedToken, xsrf: _cachedXsrf }
}

async function integramGet(path) {
  const { token } = await getIntegramToken()
  const resp = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}${path}`, {
    headers: { 'X-Authorization': token, 'Cookie': `fst=${token}; token=${token}` },
  })
  return resp.json()
}

async function integramPost(path, body) {
  const { token, xsrf } = await getIntegramToken()
  const params = new URLSearchParams({ ...body, _xsrf: xsrf })
  const resp = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Authorization': token,
      'Cookie': `fst=${token}; token=${token}`,
    },
    body: params,
  })
  return resp.json()
}

// ── Type IDs ──────────────────────────────────────────────────────
const TYPE_CONCEPT   = 2416   // СОД Концепты (онтология)
const TYPE_EVENTLOG  = 7847   // EventLog
const TYPE_ZAYAVKA   = 1956   // Заявки стартапов

// Requisite IDs in СОД Концепты
const REQ_DEF       = 2418   // Определение
const REQ_SUPERCLS  = 2416   // Суперкласс (self-ref, SHORT text in r2416)
const REQ_ALIAS     = 2423   // prefLabel_en (alias/key)
const REQ_SYNONYMS  = 2425   // Синонимы (доп. мета JSON)
const REQ_SOURCE    = 2426   // Источник

// Requisite IDs in EventLog
const REQ_EV_TYPE    = 7848   // eventType
const REQ_EV_ENTITY  = 7849   // entityType
const REQ_EV_ENTID   = 7850   // entityId
const REQ_EV_DATA    = 7851   // data (JSON)
const REQ_EV_TS      = 7852   // ts

// ── GET /api/workspace/concepts?superclass=WorkspacePanel ─────────
router.get('/concepts', async (req, res) => {
  const { superclass } = req.query
  try {
    // Fetch workspace concepts — filter by Синонимы (2425) containing superclass text
    const scFilter = superclass ? `&F_2425=%25${encodeURIComponent(superclass)}%25` : ''
    const data = await integramGet(`/object/${TYPE_CONCEPT}/?JSON_KV&l=200${scFilter}`)

    // Integram JSON_KV format: { object: [{id,val},...], reqs: { "id": { "reqId": "val" } } }
    const rawObjects = data?.object || []
    const reqs = data?.reqs || {}

    let concepts = rawObjects.map(obj => {
      const id = String(obj.id)
      const r = reqs[id] || {}
      const meta = parseMeta(r[REQ_SYNONYMS] || r['2425'] || '')
      return {
        id,
        key:        r[REQ_ALIAS] || r['2423'] || id,
        label:      obj.val || '',
        def:        r[REQ_DEF]  || r['2418'] || '',
        superclass: meta.superclass || '',   // stored in Синонимы JSON
        meta,
        source:     r[REQ_SOURCE] || r['2426'] || '',
      }
    })

    // Filter client-side by superclass (it's in meta JSON)
    if (superclass) {
      concepts = concepts.filter(c => c.superclass === superclass)
    } else {
      // Return only workspace-type concepts (those with known superclasses)
      const WS_SUPERCLASSES = ['WorkspacePanel', 'StartupDocument', 'DealDocument', 'IPDocument', 'WorkspaceEvent']
      concepts = concepts.filter(c => WS_SUPERCLASSES.includes(c.superclass))
    }

    res.json({ ok: true, concepts })
  } catch (err) {
    console.error('[workspace/concepts]', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── GET /api/workspace/company/:id ────────────────────────────────
router.get('/company/:id', async (req, res) => {
  const { id } = req.params
  try {
    const data = await integramGet(`/edit_obj/${id}?JSON_KV`)
    res.json({ ok: true, company: data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── GET /api/workspace/events?entityId=X&limit=N ─────────────────
router.get('/events', async (req, res) => {
  const { entityId, limit = 30 } = req.query
  try {
    const entFilter = entityId ? `&F_${REQ_EV_ENTID}=${encodeURIComponent(entityId)}` : ''
    const data = await integramGet(`/object/${TYPE_EVENTLOG}/?JSON_KV&l=${limit}${entFilter}`)
    const rawEvents = data?.object || []
    const reqs = data?.reqs || {}
    const events = rawEvents.map(e => {
      const id = String(e.id)
      const r = reqs[id] || {}
      return {
        id,
        type:       r[REQ_EV_TYPE]   || 'info',
        entityType: r[REQ_EV_ENTITY] || '',
        entityId:   r[REQ_EV_ENTID]  || '',
        data:       parseMeta(r[REQ_EV_DATA] || ''),
        ts:         r[REQ_EV_TS]     || '',
        text:       e.val || '',
      }
    })
    res.json({ ok: true, events })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── POST /api/workspace/event ─────────────────────────────────────
router.post('/event', async (req, res) => {
  const { type = 'info', entityType = '', entityId = '', data = {}, text = '' } = req.body
  try {
    const ts = new Date().toISOString()
    const result = await integramPost(`/_m_new/${TYPE_EVENTLOG}`, {
      [`t${TYPE_EVENTLOG}`]: text || `${entityType}:${type}`,
      [`r${REQ_EV_TYPE}`]:   type,
      [`r${REQ_EV_ENTITY}`]: entityType,
      [`r${REQ_EV_ENTID}`]:  entityId,
      [`r${REQ_EV_DATA}`]:   JSON.stringify(data),
      [`r${REQ_EV_TS}`]:     ts,
    })
    res.json({ ok: true, id: result?.id || result?.result?.id, ts })
  } catch (err) {
    console.error('[workspace/event]', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── POST /api/workspace/company ───────────────────────────────────
// Upsert company twin data into Заявки (type 1956)
router.post('/company', async (req, res) => {
  const { id, twin } = req.body
  try {
    const body = { [`t${TYPE_ZAYAVKA}`]: twin.company || 'Компания' }
    if (twin.description)   body[`r3511`] = twin.description
    if (twin.trl)           body[`r7708`] = String(twin.trl)
    if (twin.projectedIRR)  body[`r7736`] = String(twin.projectedIRR)
    if (twin.contactEmail)  body[`r7740`] = twin.contactEmail

    let result
    if (id) {
      result = await integramPost(`/_m_set/${id}`, body)
    } else {
      result = await integramPost(`/_m_new/${TYPE_ZAYAVKA}`, body)
    }
    res.json({ ok: true, id: id || result?.id || result?.result?.id })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

function parseMeta(str) {
  if (!str || typeof str !== 'string') return {}
  try { return JSON.parse(str) } catch { return { raw: str } }
}

export default router
