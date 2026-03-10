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
    // Читаем edit-форму пользователя — там есть multiselect ролей
    const resp = await fetch(`${FST_API}/${FST_DB}/object/${userId}?form&edit&JSON`, {
      headers: { 'X-Authorization': token }
    })

    if (!resp.ok) throw new Error(`Integram ${resp.status}`)
    const html = await resp.text()

    // Парсим роли из multiselect поля 115
    // Integram возвращает: name="F_52536" для каждой выбранной роли
    const roles = parseRoles(html)
    const displayName = parseDisplayName(html)

    return res.json({ roles, displayName, userId })
  } catch (e) {
    // Fallback: читаем через другой эндпоинт
    try {
      const result = await readUserViaReqs(token, userId)
      return res.json(result)
    } catch {
      return res.status(500).json({ error: e.message })
    }
  }
})

// Парсим имя из HTML edit-формы
function parseDisplayName(html) {
  const m = html.match(/name="r33"[^>]*value="([^"]+)"/)
  return m ? m[1] : ''
}

// Парсим роли из HTML edit-формы
function parseRoles(html) {
  const roles = []
  // Integram multiselect role names появляются как ссылки с классом ms-link
  const re = /class="ms-link"[^>]*>([^<]+)<\/A>/g
  let m
  while ((m = re.exec(html)) !== null) {
    const name = m[1].trim().toLowerCase()
    if (VALID_ROLES.includes(name)) roles.push(name)
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

  // Роли из req_type с base_typ=42 — берём val из req_attrs
  const roles = []
  const refType = pd?.ref_type || {}
  for (const [id, refTypeId] of Object.entries(refType)) {
    if (refTypeId === '42' && reqAttrs[id]) {
      const val = String(reqAttrs[id]).toLowerCase()
      if (VALID_ROLES.includes(val)) roles.push(val)
    }
  }

  return { roles, displayName, userId }
}

const VALID_ROLES = ['investor', 'expert', 'director', 'analyst', 'startup', 'admin']

export default router
