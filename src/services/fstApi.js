/**
 * fstApi.js — Integram API клиент для базы данных ai2o.ru/fst
 *
 * Таблицы и реквизиты (подтверждены через integram_get_type_metadata):
 *
 * fst/1155 "Проекты ФСТ v2":
 *   t1155 = название компании (main)
 *   t2237 = ОГРН (SHORT/31)
 *   t2238 = Запрашиваемая сумма, руб (NUMBER/108)
 *   t1158 = Описание проекта (HTML)
 *   t1159 = Дата подачи (DATETIME)
 *   t1178 = Субфонд (ref→1082)
 *   t1180 = Стадия (ref→1084)
 *   t1182 = Тип финансирования (ref→1086)
 *   t1184 = Статус проекта (ref→1088)
 *
 * fst/1160 "Решения ИК":
 *   t1160 = название (main)
 *   t2239 = Голосов ПРОТИВ (NUMBER/108)
 *   t1162 = Условия одобрения (HTML)
 *   t1163 = Дата заседания (DATETIME)
 *   t1186 = Проект (ref→1155)
 *   t1188 = Решение ИК (ref→1090)
 *
 * fst/1164 "Сделки ФСТ":
 *   t1164 = название (main)
 *   t2241 = Доля, % (NUMBER/108)
 *   t2240 = SPV название (SHORT/31)
 *   t1167 = Term Sheet (HTML)
 *   t1168 = Дата подписания (DATETIME)
 *   t1189 = Проект (ref→1155)
 *   t1191 = Решение ИК (ref→1160)
 *   t1192 = Тип финансирования (ref→1086)
 *   t1194 = Статус сделки (ref→1092)
 *
 * fst/1169 "Портфельные компании":
 *   t1169 = название (main)
 *   t2242 = KPI прогресс, % (NUMBER/108)
 *   t1171 = AI отчёт (HTML)
 *   t1172 = Дата обновления (DATETIME)
 *   t1198 = Риск-статус (ref→1088)
 *   t1195 = Проект (ref→1155)
 *   t1197 = Сделка (ref→1164)
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

  // Логинимся напрямую в fst — токен и xsrf в одном ответе
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
  const data = await api(`object/${TYPE_PROJECTS}?JSON_KV`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}
  return objects.map(obj => ({
    id:          obj.id,
    name:        obj.val,
    ogrn:        reqs[obj.id]?.['2237'] || '',
    amount:      Number(reqs[obj.id]?.['2238'] || 0),
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
    t2237: data.ogrn || '',
    t2238: data.amount || 0,
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
  return api(`object/${TYPE_IC_DECISIONS}?JSON_KV${projectId ? `&ref_1186=${projectId}` : ''}`)
}

export async function saveDecision(data) {
  const body = new URLSearchParams({
    [`t${TYPE_IC_DECISIONS}`]: data.name || `ИК ${new Date().toLocaleDateString('ru')}`,
    t2239: data.votesAgainst || 0,
    t1162: data.conditions || '',
    t1163: data.meetingDate || new Date().toISOString(),
    ...(data.projectId  ? { t1186: data.projectId  } : {}),
    ...(data.decisionId ? { t1188: data.decisionId } : {})
  })
  return api(`_m_new/${TYPE_IC_DECISIONS}?JSON_KV`, { method: 'POST', body })
}

// ── Deals ─────────────────────────────────────────────────────────────────

export const TYPE_DEALS = 1164

export async function getDeals(projectId) {
  return api(`object/${TYPE_DEALS}?JSON_KV${projectId ? `&ref_1189=${projectId}` : ''}`)
}

export async function saveDeal(data) {
  const body = new URLSearchParams({
    [`t${TYPE_DEALS}`]: data.name || `Сделка ${data.companyName}`,
    t2241: data.sharePercent || 0,
    t2240: data.spvName || '',
    t1167: data.termSheet || '',
    t1168: data.signDate || new Date().toISOString(),
    ...(data.projectId  ? { t1189: data.projectId  } : {}),
    ...(data.decisionId ? { t1191: data.decisionId } : {}),
    ...(data.finTypeId  ? { t1192: data.finTypeId  } : {}),
    ...(data.statusId   ? { t1194: data.statusId   } : {})
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
  const data = await api(`object/${TYPE_PORTFOLIO}?JSON_KV`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}
  return objects.map(obj => ({
    id:          obj.id,
    name:        obj.val,
    kpi:         Number(reqs[obj.id]?.['2242'] || 0),
    aiReport:    reqs[obj.id]?.['1171'] || '',
    updatedAt:   reqs[obj.id]?.['1172'] || null,
    riskStatusId: reqs[obj.id]?.['1198'] || null,
    projectId:   reqs[obj.id]?.['1195'] || null,
    dealId:      reqs[obj.id]?.['1197'] || null
  }))
}

export async function updatePortfolioCompany(id, { kpi, aiReport }) {
  const body = new URLSearchParams()
  if (kpi      !== undefined) body.set('t2242', kpi)
  if (aiReport !== undefined) body.set('t1171', aiReport)
  body.set('t1172', new Date().toISOString())
  return api(`_m_set/${id}?JSON_KV`, { method: 'POST', body })
}

// ── Tranches ──────────────────────────────────────────────────────────────

export const TYPE_TRANCHES = 1173

export async function getTranches(dealId) {
  return api(`object/${TYPE_TRANCHES}?JSON_KV${dealId ? `&ref_1199=${dealId}` : ''}`)
}

export async function createTranche(data) {
  const body = new URLSearchParams({
    [`t${TYPE_TRANCHES}`]: `Транш #${data.number}`,
    t2243: data.amount || 0,
    t1175: data.kpiTrigger || '',
    t1176: data.payDate || ''
  })
  return api(`_m_new/${TYPE_TRANCHES}?JSON_KV`, { method: 'POST', body })
}

// ── DD проверки (1955) ────────────────────────────────────────────────────
// Реквизиты: 1968=Проект, 2011=Тип DD, 2244=Прогресс%(108), 2225=Статус DD,
//            2042=Дата запуска, 2061=AI сводка, 2067=Вердикт

export const TYPE_DD = 1955

export async function getDDChecks(projectId) {
  const filter = projectId ? `&ref_1968=${projectId}` : ''
  const data = await api(`object/${TYPE_DD}?JSON_KV${filter}`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}
  return objects.map(obj => ({
    id:         obj.id,
    name:       obj.val,
    projectId:  reqs[obj.id]?.['1968'] || null,
    ddType:     reqs[obj.id]?.['2011'] || '',
    progress:   Number(reqs[obj.id]?.['2244'] || 0),
    statusId:   reqs[obj.id]?.['2225'] || null,
    startedAt:  reqs[obj.id]?.['2042'] || null,
    aiSummary:  reqs[obj.id]?.['2061'] || '',
    verdict:    reqs[obj.id]?.['2067'] || ''
  }))
}

export async function createDDCheck(data) {
  const body = new URLSearchParams({
    [`t${TYPE_DD}`]: data.name || `DD ${new Date().toLocaleDateString('ru')}`,
    t2011: data.ddType || '',
    t2244: data.progress || 0,
    t2042: data.startedAt || new Date().toISOString(),
    ...(data.projectId ? { t1968: data.projectId } : {}),
    ...(data.statusId  ? { t2225: data.statusId  } : {})
  })
  return api(`_m_new/${TYPE_DD}?JSON_KV`, { method: 'POST', body })
}

export async function updateDDCheck(id, { progress, aiSummary, verdict, statusId }) {
  const body = new URLSearchParams()
  if (progress  !== undefined) body.set('t2244', progress)
  if (aiSummary !== undefined) body.set('t2061', aiSummary)
  if (verdict   !== undefined) body.set('t2067', verdict)
  if (statusId  !== undefined) body.set('t2225', statusId)
  return api(`_m_set/${id}?JSON_KV`, { method: 'POST', body })
}

// ── Заявки (1956) ─────────────────────────────────────────────────────────
// Реквизиты: 2003=ИНН, 2029=Email, 2036=Субфонд, 2226=Стадия,
//            2227=Тип финансирования, 2245=Сумма запроса(108), 2229=Статус,
//            2070=Описание, 2071=Дата подачи

export const TYPE_APPLICATIONS = 1956

export async function getApplications() {
  const data = await api(`object/${TYPE_APPLICATIONS}?JSON_KV`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}
  return objects.map(obj => ({
    id:          obj.id,
    name:        obj.val,
    inn:         reqs[obj.id]?.['2003'] || '',
    email:       reqs[obj.id]?.['2029'] || '',
    subfundId:   reqs[obj.id]?.['2036'] || null,
    stageId:     reqs[obj.id]?.['2226'] || null,
    finTypeId:   reqs[obj.id]?.['2227'] || null,
    amount:      Number(reqs[obj.id]?.['2245'] || 0),
    statusId:    reqs[obj.id]?.['2229'] || null,
    description: reqs[obj.id]?.['2070'] || '',
    submittedAt: reqs[obj.id]?.['2071'] || null
  }))
}

export async function createApplication(data) {
  const body = new URLSearchParams({
    [`t${TYPE_APPLICATIONS}`]: data.name || data.inn || 'Новая заявка',
    t2003: data.inn || '',
    t2029: data.email || '',
    t2245: data.amount || 0,
    t2070: data.description || '',
    t2071: data.submittedAt || new Date().toISOString(),
    ...(data.subfundId ? { t2036: data.subfundId } : {}),
    ...(data.stageId   ? { t2226: data.stageId   } : {}),
    ...(data.finTypeId ? { t2227: data.finTypeId } : {}),
    ...(data.statusId  ? { t2229: data.statusId  } : {})
  })
  return api(`_m_new/${TYPE_APPLICATIONS}?JSON_KV`, { method: 'POST', body })
}

// ── Гранты (1957) ─────────────────────────────────────────────────────────
// Реквизиты: 1969=Проект, 2012=Источник, 2030=Программа,
//            2246=Сумма гранта(108), 2231=Статус гранта, 2063=Дедлайн

export const TYPE_GRANTS = 1957

export async function getGrants(projectId) {
  const filter = projectId ? `&ref_1969=${projectId}` : ''
  const data = await api(`object/${TYPE_GRANTS}?JSON_KV${filter}`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}
  return objects.map(obj => ({
    id:        obj.id,
    name:      obj.val,
    projectId: reqs[obj.id]?.['1969'] || null,
    source:    reqs[obj.id]?.['2012'] || '',
    program:   reqs[obj.id]?.['2030'] || '',
    amount:    Number(reqs[obj.id]?.['2246'] || 0),
    statusId:  reqs[obj.id]?.['2231'] || null,
    deadline:  reqs[obj.id]?.['2063'] || null
  }))
}

export async function createGrant(data) {
  const body = new URLSearchParams({
    [`t${TYPE_GRANTS}`]: data.name || data.program || 'Новый грант',
    t2012: data.source || '',
    t2030: data.program || '',
    t2246: data.amount || 0,
    t2063: data.deadline || '',
    ...(data.projectId ? { t1969: data.projectId } : {}),
    ...(data.statusId  ? { t2231: data.statusId  } : {})
  })
  return api(`_m_new/${TYPE_GRANTS}?JSON_KV`, { method: 'POST', body })
}

// ── LP партнёры (1958) ────────────────────────────────────────────────────
// Реквизиты: 2004=Организация, 2031=Контакт, 2233=Тип LP,
//            2247=Обязательства(183), 2064=Выплачено(108), 2072=Дата вступления

export const TYPE_LP = 1958

export async function getLPPartners() {
  const data = await api(`object/${TYPE_LP}?JSON_KV`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}
  return objects.map(obj => ({
    id:           obj.id,
    name:         obj.val,
    organization: reqs[obj.id]?.['2004'] || '',
    contact:      reqs[obj.id]?.['2031'] || '',
    typeId:       reqs[obj.id]?.['2233'] || null,
    commitment:   Number(reqs[obj.id]?.['2247'] || 0),
    paid:         Number(reqs[obj.id]?.['2064'] || 0),
    joinedAt:     reqs[obj.id]?.['2072'] || null
  }))
}

export async function createLPPartner(data) {
  const body = new URLSearchParams({
    [`t${TYPE_LP}`]: data.name || data.organization,
    t2004: data.organization || '',
    t2031: data.contact || '',
    t2247: data.commitment || 0,
    t2064: data.paid || 0,
    t2072: data.joinedAt || new Date().toISOString(),
    ...(data.typeId ? { t2233: data.typeId } : {})
  })
  return api(`_m_new/${TYPE_LP}?JSON_KV`, { method: 'POST', body })
}

// ── ESG оценки (1959) ─────────────────────────────────────────────────────
// Реквизиты: 1976=Проект, 2248=E-score(1019), 2032=S-score(108), 2039=G-score(183),
//            2065=Комментарий, 2073=Дата оценки. total вычисляется в JS.

export const TYPE_ESG = 1959

export async function getESGScores(projectId) {
  const filter = projectId ? `&ref_1976=${projectId}` : ''
  const data = await api(`object/${TYPE_ESG}?JSON_KV${filter}`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}
  return objects.map(obj => ({
    id:        obj.id,
    name:      obj.val,
    projectId: reqs[obj.id]?.['1976'] || null,
    eScore:    Number(reqs[obj.id]?.['2248'] || 0),
    sScore:    Number(reqs[obj.id]?.['2032'] || 0),
    gScore:    Number(reqs[obj.id]?.['2039'] || 0),
    comment:   reqs[obj.id]?.['2065'] || '',
    scoredAt:  reqs[obj.id]?.['2073'] || null
  }))
}

export async function createESGScore(data) {
  const body = new URLSearchParams({
    [`t${TYPE_ESG}`]: data.name || `ESG ${new Date().toLocaleDateString('ru')}`,
    t2248: data.eScore || 0,
    t2032: data.sScore || 0,
    t2039: data.gScore || 0,
    t2065: data.comment || '',
    t2073: data.scoredAt || new Date().toISOString(),
    ...(data.projectId ? { t1976: data.projectId } : {})
  })
  return api(`_m_new/${TYPE_ESG}?JSON_KV`, { method: 'POST', body })
}

// ── Аудит суверенности (1960) ─────────────────────────────────────────────
// Реквизиты: 1977=Проект, 2249=Стек(1019), 2033=Данные(108), 2040=Команда(183),
//            2066=Прочие баллы (HTML), 2074=Дата аудита. ИС убран.

export const TYPE_SOVEREIGNTY = 1960

export async function getSovereigntyAudits(projectId) {
  const filter = projectId ? `&ref_1977=${projectId}` : ''
  const data = await api(`object/${TYPE_SOVEREIGNTY}?JSON_KV${filter}`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}
  return objects.map(obj => ({
    id:        obj.id,
    name:      obj.val,
    projectId: reqs[obj.id]?.['1977'] || null,
    stack:     Number(reqs[obj.id]?.['2249'] || 0),
    data_:     Number(reqs[obj.id]?.['2033'] || 0),
    team:      Number(reqs[obj.id]?.['2040'] || 0),
    other:     reqs[obj.id]?.['2066'] || '',
    auditedAt: reqs[obj.id]?.['2074'] || null
  }))
}

export async function createSovereigntyAudit(data) {
  const body = new URLSearchParams({
    [`t${TYPE_SOVEREIGNTY}`]: data.name || `Аудит ${new Date().toLocaleDateString('ru')}`,
    t2249: data.stack  || 0,
    t2033: data.data_  || 0,
    t2040: data.team   || 0,
    t2066: data.other  || '',
    t2074: data.auditedAt || new Date().toISOString(),
    ...(data.projectId ? { t1977: data.projectId } : {})
  })
  return api(`_m_new/${TYPE_SOVEREIGNTY}?JSON_KV`, { method: 'POST', body })
}

// ── Комплаенс (1961) ──────────────────────────────────────────────────────
// Реквизиты: 1978=Проект, 2235=AML статус, 2034=KYC статус,
//            2041=Дата проверки, 2054=Комментарий

export const TYPE_COMPLIANCE = 1961

export async function getCompliance(projectId) {
  const filter = projectId ? `&ref_1978=${projectId}` : ''
  const data = await api(`object/${TYPE_COMPLIANCE}?JSON_KV${filter}`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}
  return objects.map(obj => ({
    id:          obj.id,
    name:        obj.val,
    projectId:   reqs[obj.id]?.['1978'] || null,
    amlStatusId: reqs[obj.id]?.['2235'] || null,
    kycStatus:   reqs[obj.id]?.['2034'] || '',
    checkedAt:   reqs[obj.id]?.['2041'] || null,
    comment:     reqs[obj.id]?.['2054'] || ''
  }))
}

export async function createCompliance(data) {
  const body = new URLSearchParams({
    [`t${TYPE_COMPLIANCE}`]: data.name || `Комплаенс ${new Date().toLocaleDateString('ru')}`,
    t2034: data.kycStatus || '',
    t2041: data.checkedAt || new Date().toISOString(),
    t2054: data.comment || '',
    ...(data.projectId   ? { t1978: data.projectId   } : {}),
    ...(data.amlStatusId ? { t2235: data.amlStatusId } : {})
  })
  return api(`_m_new/${TYPE_COMPLIANCE}?JSON_KV`, { method: 'POST', body })
}
