/**
 * fstApi.js — Integram API клиент для базы данных ai2o.ru/fst
 *
 * Таблицы и реквизиты (подтверждены через integram_get_type_metadata):
 *
 * fst/1155 "Проекты ФСТ v2":
 *   t1155 = название компании (main)
 *   t1156 = ОГРН (SHORT)
 *   t1157 = Запрашиваемая сумма, руб (NUMBER)
 *   t1158 = Описание проекта (HTML)
 *   t1159 = Дата подачи (DATETIME)
 *   t1177 = Субфонд (ref→1082)
 *   t1179 = Стадия (ref→1084)
 *   t1181 = Тип финансирования (ref→1086)
 *   t1183 = Статус проекта (ref→1088)
 *
 * fst/1160 "Решения ИК":
 *   t1160 = название (main)
 *   t1161 = Голосов ПРОТИВ (NUMBER)
 *   t1162 = Условия одобрения (HTML)
 *   t1163 = Дата заседания (DATETIME)
 *   t1185 = Проект (ref→1155)
 *   t1187 = Решение ИК (ref→1090)
 *
 * fst/1164 "Сделки ФСТ":
 *   t1164 = название (main)
 *   t1165 = Доля, % (NUMBER)
 *   t1166 = SPV название (SHORT)
 *   t1167 = Term Sheet (HTML)
 *   t1168 = Дата подписания (DATETIME)
 *   t1185 = Проект (ref→1155)
 *   t1190 = Решение ИК (ref→1160)
 *   t1181 = Тип финансирования (ref→1086)
 *   t1193 = Статус сделки (ref→1092)
 *
 * fst/1169 "Портфельные компании":
 *   t1169 = название (main)
 *   t1170 = KPI прогресс, % (NUMBER)
 *   t1171 = AI отчёт (HTML)
 *   t1172 = Дата обновления (DATETIME)
 *   t1183 = Риск-статус (ref→1088)
 *   t1185 = Проект (ref→1155)
 *   t1196 = Сделка (ref→1164)
 *
 * Справочники:
 *   Субфонды (1082): БАС=1096, РОБО=1098, МЭ=1100
 *   Стадии (1084): Pre-seed=1102, Seed=1103, Round A=1104, Round B=1105, Round C=1106
 *   Статусы проектов (1088): Новый=1115, На рассмотрении ИК=1117, Одобрен=1119, В работе=1125, Закрыт=1127
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

// ── Справочники ───────────────────────────────────────────────────────────

export const SUBFUNDS = { БАС: 1096, РОБО: 1098, МЭ: 1100 }
export const STAGES   = { 'Pre-seed': 1102, Seed: 1103, 'Round A': 1104, 'Round B': 1105, 'Round C': 1106 }
export const STATUSES = { Новый: 1115, 'На рассмотрении ИК': 1117, Одобрен: 1119, 'На доработке': 1123, 'В работе': 1125, Закрыт: 1127 }

// ── Projects ──────────────────────────────────────────────────────────────

export const TYPE_PROJECTS = 1155

/**
 * Возвращает нормализованный массив проектов.
 */
export async function getProjects() {
  const data = await api(`_m_list/${TYPE_PROJECTS}?JSON_KV`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}
  return objects.map(obj => ({
    id:          obj.id,
    name:        obj.val,
    ogrn:        reqs[obj.id]?.['1156'] || '',
    amount:      Number(reqs[obj.id]?.['1157'] || 0),
    description: reqs[obj.id]?.['1158'] || '',
    submittedAt: reqs[obj.id]?.['1159'] || null,
    subfundId:   reqs[obj.id]?.['1177'] || null,
    stageId:     reqs[obj.id]?.['1179'] || null,
    statusId:    reqs[obj.id]?.['1183'] || null
  }))
}

export async function getProject(id) {
  return api(`object/${id}?JSON_KV`)
}

export async function createProject(data) {
  const body = new URLSearchParams({
    [`t${TYPE_PROJECTS}`]: data.name,
    t1156: data.ogrn || '',
    t1157: data.amount || 0,
    t1158: data.description || '',
    t1159: data.submittedAt || new Date().toISOString(),
    ...(data.subfundId ? { t1177: data.subfundId } : {}),
    ...(data.stageId   ? { t1179: data.stageId   } : {}),
    ...(data.statusId  ? { t1183: data.statusId  } : {})
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
    t1161: data.votesAgainst || 0,
    t1162: data.conditions || '',
    t1163: data.meetingDate || new Date().toISOString(),
    ...(data.projectId  ? { t1185: data.projectId  } : {}),
    ...(data.decisionId ? { t1187: data.decisionId } : {})
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
    t1165: data.sharePercent || 0,
    t1166: data.spvName || '',
    t1167: data.termSheet || '',
    t1168: data.signDate || new Date().toISOString(),
    ...(data.projectId  ? { t1185: data.projectId  } : {}),
    ...(data.decisionId ? { t1190: data.decisionId } : {}),
    ...(data.finTypeId  ? { t1181: data.finTypeId  } : {}),
    ...(data.statusId   ? { t1193: data.statusId   } : {})
  })
  return api(`_m_new/${TYPE_DEALS}?JSON_KV`, { method: 'POST', body })
}

// ── Portfolio ─────────────────────────────────────────────────────────────

export const TYPE_PORTFOLIO = 1169

/**
 * Возвращает нормализованный массив портфельных компаний.
 * Каждый объект содержит: id, name, kpi, aiReport, updatedAt, projectId, dealId, riskStatusId
 */
export async function getPortfolio() {
  const data = await api(`_m_list/${TYPE_PORTFOLIO}?JSON_KV`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}
  return objects.map(obj => ({
    id:          obj.id,
    name:        obj.val,
    kpi:         Number(reqs[obj.id]?.['1170'] || 0),
    aiReport:    reqs[obj.id]?.['1171'] || '',
    updatedAt:   reqs[obj.id]?.['1172'] || null,
    riskStatusId: reqs[obj.id]?.['1183'] || null,
    projectId:   reqs[obj.id]?.['1185'] || null,
    dealId:      reqs[obj.id]?.['1196'] || null
  }))
}

export async function updatePortfolioCompany(id, { kpi, aiReport }) {
  const body = new URLSearchParams()
  if (kpi      !== undefined) body.set('t1170', kpi)
  if (aiReport !== undefined) body.set('t1171', aiReport)
  body.set('t1172', new Date().toISOString())
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
