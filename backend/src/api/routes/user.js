/**
 * /api/user/me — профиль текущего пользователя из Integram
 *
 * Источник правды: поле 115 (Роль) в таблице 18 (Пользователи) базы fst.
 * Роли в type 42: admin(145), user(164), investor(52536),
 *                  expert(52559), director(52560), analyst(52561), startup(52562)
 */

import express from 'express'

const router = express.Router()

const FST_API  = 'https://api.ai2o.ru'
const FST_DB   = 'fst'

// Системный токен — кеш (читает таблицу пользователей с полными правами)
let _sysToken    = null
let _sysTokenExp = 0

async function getSysToken() {
  if (_sysToken && Date.now() < _sysTokenExp) return _sysToken
  const resp = await fetch(`${FST_API}/${FST_DB}/auth?JSON_KV`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      login: process.env.INTEGRAM_SYSTEM_USERNAME,
      pwd:   process.env.INTEGRAM_SYSTEM_PASSWORD
    })
  })
  const data = await resp.json()
  const items = Array.isArray(data) ? data : [data]
  const tok = items[0]?.token
  if (!tok) throw new Error('System auth failed')
  _sysToken    = tok
  _sysTokenExp = Date.now() + 55 * 60 * 1000  // 55 мин
  return _sysToken
}

// Прогрев токена при загрузке модуля (чтобы первый запрос /user/me был быстрым)
getSysToken().catch(() => {})

// GET /api/user/me
// Header: X-Integram-Token: <token>  (выставляется фронтом после логина)
router.get('/me', async (req, res) => {
  const token  = req.headers['x-integram-token'] || req.headers['authorization']?.replace('Bearer ', '')
  const userId = req.headers['x-integram-userid']

  if (!token || !userId) {
    return res.status(401).json({ error: 'token and userId required' })
  }

  try {
    // Читаем роли через системный токен — у обычных пользователей нет прав читать всю таблицу 18
    const sysToken = await getSysToken()
    const result   = await readUserViaTable(sysToken, userId)
    return res.json(result)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

// Динамически получаем маппинг ID → имя из Integram type 42
// Кеш на 5 минут — не долбём базу каждым запросом
let _roleMapCache = null
let _roleMapCachedAt = 0
const ROLE_MAP_TTL = 5 * 60 * 1000

async function fetchDynamicRoleMap(token) {
  const now = Date.now()
  if (_roleMapCache && now - _roleMapCachedAt < ROLE_MAP_TTL) return _roleMapCache

  try {
    const resp = await fetch(`${FST_API}/${FST_DB}/object/42?JSON_KV`, {
      headers: { 'X-Authorization': token }
    })
    if (!resp.ok) return ROLE_ID_MAP  // fallback к хардкоду

    const data = await resp.json()
    const map = { ...ROLE_ID_MAP }  // начинаем с известных

    // data.objects или data.list — список объектов type 42
    const objects = data.objects || data.list || data.items || []
    for (const obj of objects) {
      const id = String(obj.id || obj._id || '')
      const name = (obj.name || obj.label || obj.title || '').trim().toLowerCase()
      if (id && name && !map[id]) {
        // Нормализуем имя: "Презентация" → "present", "Аналитик" → "analyst"
        const normalized = ROLE_NAME_MAP[name] || name.replace(/[^a-z]/g, '') || null
        if (normalized) map[id] = normalized
      }
    }

    // Также проверяем reqs — Integram возвращает имена через reqs
    const reqs = data.reqs || {}
    for (const [id, attrs] of Object.entries(reqs)) {
      if (map[id]) continue  // уже знаем
      const name = (attrs['1'] || attrs['name'] || attrs['33'] || '').trim().toLowerCase()
      if (name) {
        const normalized = ROLE_NAME_MAP[name] || (name.match(/^[a-z]+$/) ? name : null)
        if (normalized) map[id] = normalized
      }
    }

    _roleMapCache = map
    _roleMapCachedAt = now
    return map
  } catch {
    return ROLE_ID_MAP
  }
}

// Читаем роли и имя из таблицы пользователей (object/18)
async function readUserViaTable(token, userId) {
  const resp = await fetch(`${FST_API}/${FST_DB}/object/18?JSON_KV`, {
    headers: { 'X-Authorization': token }
  })
  if (!resp.ok) throw new Error(`Integram ${resp.status}`)
  const data = await resp.json()

  const userReqs = data.reqs?.[userId] || {}

  // Имя из поля 33
  const displayName = userReqs['33'] || userReqs['name'] || ''

  // Роли: ref_115 = "42:52536,52559,145" ИЛИ 115 = "investor,expert,admin"
  let roles = []
  const refStr = userReqs['ref_115'] || ''
  if (refStr) {
    const dynamicMap = await fetchDynamicRoleMap(token)
    const ids = refStr.replace(/^\d+:/, '').split(',')
    roles = ids.map(id => dynamicMap[id.trim()]).filter(Boolean)
  }
  if (!roles.length) {
    const nameStr = userReqs['115'] || ''
    roles = nameStr.split(',').map(r => ROLE_NAME_MAP[r.trim().toLowerCase()]).filter(Boolean)
  }

  return { roles, displayName, userId }
}

// Парсим имя из HTML edit-формы
function parseDisplayName(html) {
  const m = html.match(/name="r33"[^>]*value="([^"]+)"/)
  return m ? m[1] : ''
}

// Парсим роли из HTML edit-формы
function parseRoles(html) {
  const roles = []
  // Integram multiselect: выбранные роли как ссылки class="ms-link"
  const re = /class="ms-link"[^>]*>([^<]+)<\/A>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const name = m[1].trim()
    const mapped = ROLE_NAME_MAP[name.toLowerCase()] || ROLE_NAME_MAP[name]
    if (mapped && !roles.includes(mapped)) roles.push(mapped)
  }
  // Fallback: multiselect выбранные объекты часто рендерятся как name="F_{id}"
  // <input ... name="F_52536" checked> — парсим id напрямую
  const reId = /name="F_(\d+)"/g
  while ((m = reId.exec(html)) !== null) {
    const mapped = ROLE_ID_MAP[m[1]]
    if (mapped && !roles.includes(mapped)) roles.push(mapped)
  }
  return roles
}

// Альтернативный метод — через object/userId?JSON_KV
async function readUserViaReqs(token, userId) {
  const resp = await fetch(`${FST_API}/${FST_DB}/object/${userId}?JSON_KV`, {
    headers: { 'X-Authorization': token }
  })
  if (!resp.ok) throw new Error(`Integram ${resp.status}`)
  const pd = await resp.json()

  const reqType  = pd?.req_type  || {}
  const reqAttrs = pd?.req_attrs || {}

  // Ищем поле "Имя"
  let displayName = ''
  for (const [id, typeName] of Object.entries(reqType)) {
    if (typeName === 'Имя' && reqAttrs[id]) {
      displayName = reqAttrs[id]
      break
    }
  }

  // Роли из ref_type с base_typ=42 — reqAttrs[id] = ID объекта роли
  const roles = []
  const refType = pd?.ref_type || {}
  for (const [id, refTypeId] of Object.entries(refType)) {
    if (refTypeId === '42' && reqAttrs[id]) {
      // reqAttrs[id] может быть ID объекта ("52536") или русским именем
      const val = String(reqAttrs[id])
      const byId   = ROLE_ID_MAP[val]
      const byName = ROLE_NAME_MAP[val.toLowerCase()]
      const mapped = byId || byName
      if (mapped && !roles.includes(mapped)) roles.push(mapped)
    }
  }

  return { roles, displayName, userId }
}

// Маппинг ID объектов ролей type 42 → английский идентификатор
const ROLE_ID_MAP = {
  '145':   'admin',
  '164':   'admin',    // user → admin fallback
  '52536': 'investor',
  '52559': 'expert',
  '52560': 'director',
  '52561': 'analyst',
  '52562': 'startup',
  '72159': 'present',
}

// Маппинг русских/английских названий ролей → идентификатор
const ROLE_NAME_MAP = {
  'admin':          'admin',
  'администратор':  'admin',
  'investor':       'investor',
  'инвестор':       'investor',
  'expert':         'expert',
  'эксперт':        'expert',
  'director':       'director',
  'директор':       'director',
  'analyst':        'analyst',
  'аналитик':       'analyst',
  'startup':        'startup',
  'стартап':        'startup',
  'present':        'present',
  'презентация':    'present',
  'presentation':   'present',
}

const VALID_ROLES = ['investor', 'expert', 'director', 'analyst', 'startup', 'admin', 'present']

export default router
