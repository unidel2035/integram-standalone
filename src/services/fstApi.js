/**
 * fstApi.js — Integram API клиент для базы данных ai2o.ru/fst
 *
 * Таблицы:
 *   Проекты ФСТ       typeId: 1155
 *   Решения ИК        typeId: 1160
 *   Сделки ФСТ        typeId: 1164
 *   Портфельные       typeId: 1169
 *   Транши            typeId: 1173
 */

const FST_SERVER = import.meta.env.VITE_FST_SERVER || 'https://ai2o.ru'
const FST_DB = import.meta.env.VITE_FST_DB || 'fst'

let _token = null
let _xsrf = null

// ── Auth ──────────────────────────────────────────────────────────────────

export async function authenticate() {
  if (_token) return { token: _token, xsrf: _xsrf }

  const login = import.meta.env.VITE_FST_LOGIN || 'd'
  const password = import.meta.env.VITE_FST_PASSWORD || 'd'

  const res = await fetch(`${FST_SERVER}/${FST_DB}/auth?JSON_KV`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `login=${encodeURIComponent(login)}&pwd=${encodeURIComponent(password)}`
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)

  _token = data.token
  _xsrf = data._xsrf
  return { token: _token, xsrf: _xsrf }
}

async function api(path, options = {}) {
  const { token, xsrf } = await authenticate()
  const url = `${FST_SERVER}/${FST_DB}/${path}`

  const headers = {
    'X-Authorization': token,
    ...(options.headers || {})
  }

  if (options.body instanceof URLSearchParams) {
    options.body.set('_xsrf', xsrf)
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  }

  const res = await fetch(url, { ...options, headers })
  return res.json()
}

// ── Projects ──────────────────────────────────────────────────────────────

export const TYPE_PROJECTS = 1155

export async function getProjects() {
  return api(`_m_list/${TYPE_PROJECTS}?JSON_KV`)
}

export async function getProject(id) {
  return api(`object/${id}?JSON_KV`)
}

export async function createProject(data) {
  const body = new URLSearchParams({
    [`t${TYPE_PROJECTS}`]: data.name,
    t1156: data.companyName || '',
    t1157: data.trl || 0,
    t1159: new Date().toISOString()
  })
  return api(`_m_new/${TYPE_PROJECTS}?JSON_KV`, { method: 'POST', body })
}

export async function updateProject(id, data) {
  const body = new URLSearchParams(data)
  return api(`_m_set/${id}?JSON_KV`, { method: 'POST', body })
}

// ── IC Decisions ──────────────────────────────────────────────────────────

export const TYPE_IC_DECISIONS = 1160

export async function getDecisions(projectId) {
  return api(`_m_list/${TYPE_IC_DECISIONS}?JSON_KV${projectId ? `&ref_1186=${projectId}` : ''}`)
}

export async function saveDecision(data) {
  const body = new URLSearchParams({
    [`t${TYPE_IC_DECISIONS}`]: data.name || `ИК ${new Date().toLocaleDateString('ru')}`,
    t1161: data.score || 0,
    t1162: JSON.stringify(data.protocol || {}),
    t1163: new Date().toISOString()
  })
  return api(`_m_new/${TYPE_IC_DECISIONS}?JSON_KV`, { method: 'POST', body })
}

// ── Deals ─────────────────────────────────────────────────────────────────

export const TYPE_DEALS = 1164

export async function getDeals(projectId) {
  return api(`_m_list/${TYPE_DEALS}?JSON_KV${projectId ? `&ref_1189=${projectId}` : ''}`)
}

export async function saveDeal(data) {
  const body = new URLSearchParams({
    [`t${TYPE_DEALS}`]: data.name || `Сделка ${data.companyName}`,
    t1165: data.amount || 0,
    t1166: data.spvName || '',
    t1167: data.termSheet || '',
    t1168: data.signDate || new Date().toISOString()
  })
  return api(`_m_new/${TYPE_DEALS}?JSON_KV`, { method: 'POST', body })
}

// ── Portfolio ─────────────────────────────────────────────────────────────

export const TYPE_PORTFOLIO = 1169

export async function getPortfolio() {
  return api(`_m_list/${TYPE_PORTFOLIO}?JSON_KV`)
}

export async function updatePortfolioCompany(id, data) {
  const body = new URLSearchParams(data)
  return api(`_m_set/${id}?JSON_KV`, { method: 'POST', body })
}

// ── Tranches ──────────────────────────────────────────────────────────────

export const TYPE_TRANCHES = 1173

export async function getTranches(dealId) {
  return api(`_m_list/${TYPE_TRANCHES}?JSON_KV${dealId ? `&ref_1199=${dealId}` : ''}`)
}

export async function createTranche(data) {
  const body = new URLSearchParams({
    [`t${TYPE_TRANCHES}`]: `Транш #${data.number}`,
    t1174: data.amount || 0,
    t1175: data.kpiTrigger || '',
    t1176: data.payDate || ''
  })
  return api(`_m_new/${TYPE_TRANCHES}?JSON_KV`, { method: 'POST', body })
}
