/**
 * /api/user/me — профиль текущего пользователя из Integram
 *
 * Источник правды: поле 115 (Роль) в таблице 18 (Пользователи) базы fst.
 * Роли в type 42: admin(145), user(164), investor(52536),
 *                  expert(52559), director(52560), analyst(52561), startup(52562)
 */

import express from 'express'

const router = express.Router()

const FST_API = 'https://api.ai2o.ru'
const FST_DB  = 'fst'

// GET /api/user/me
// Header: X-Integram-Token: <token>  (выставляется фронтом после логина)
router.get('/me', async (req, res) => {
  const token  = req.headers['x-integram-token'] || req.headers['authorization']?.replace('Bearer ', '')
  const userId = req.headers['x-integram-userid']

  if (!token || !userId) {
    return res.status(401).json({ error: 'token and userId required' })
  }

  try {
    // Читаем роли из таблицы пользователей (object/18) — самый надёжный способ
    // Формат: reqs[userId]['115'] = "investor,expert,admin"
    //         reqs[userId]['ref_115'] = "42:52536,52559,145"
    const result = await readUserViaTable(token, userId)
    return res.json(result)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
})

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
    const ids = refStr.replace(/^\d+:/, '').split(',')
    roles = ids.map(id => ROLE_ID_MAP[id.trim()]).filter(Boolean)
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
}

const VALID_ROLES = ['investor', 'expert', 'director', 'analyst', 'startup', 'admin']

export default router
