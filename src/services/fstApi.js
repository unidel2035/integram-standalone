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

/**
 * Создать проект из заявки стартапа (/fst-apply)
 * @param {Object} application - Данные формы заявки
 * @returns {Promise<Object>}
 */
export async function createProjectFromApplication(application) {
  // Определяем субфонд по сфере деятельности
  let subfundId = null
  if (application.sector?.includes('БАС') || application.sector?.includes('БПЛА')) {
    subfundId = SUBFUNDS.БАС
  } else if (application.sector?.includes('робототехни')) {
    subfundId = SUBFUNDS.РОБО
  } else if (application.sector?.includes('энергетик')) {
    subfundId = SUBFUNDS.МЭ
  }

  // Определяем стадию
  let stageId = null
  if (application.stage?.includes('Pre-Seed')) {
    stageId = STAGES['Pre-seed']
  } else if (application.stage?.includes('Seed')) {
    stageId = STAGES.Seed
  } else if (application.stage?.includes('A')) {
    stageId = STAGES['Round A']
  } else if (application.stage?.includes('B')) {
    stageId = STAGES['Round B']
  }

  // Формируем extended data для совместимости с getEnrichedProjects
  const extended = {
    title: `${application.companyName} — ${application.description?.substring(0, 50)}`,
    market: application.sector,
    trl: application.trl || 5,
    mrl: Math.floor(application.trl * 1.1) || 5, // Примерная оценка MRL
    sovereigntyScore: Math.floor(application.sovereignty / 11.11) || 6, // 0-100 → 0-9
    localizationRatio: (application.sovereignty || 60) / 100,
    marketSize: (application.tam || 10) * 1_000_000_000, // млрд → руб
    projectedIRR: 0.25, // Дефолтное значение, будет рассчитано на ИК
    teamStrength: Math.min(1, (application.teamSize || 5) / 20),
    employees: application.teamSize || 5,
    founded: application.foundedYear || new Date().getFullYear(),
    patents: parseInt(application.patents) || 0,
    strengths: application.usp ? [application.usp] : [],
    risks: [],
    documents: [application.pitchFile, application.modelFile].filter(Boolean)
  }

  // Храним полную заявку в JSON
  const fullApplication = {
    companyName: application.companyName,
    inn: application.inn,
    sector: application.sector,
    stage: application.stage,
    foundedYear: application.foundedYear,
    city: application.city,
    description: application.description,
    trl: application.trl,
    patents: application.patents,
    tam: application.tam,
    sam: application.sam,
    competitors: application.competitors,
    usp: application.usp,
    sovereignty: application.sovereignty,
    amount: application.amount,
    equityOffered: application.equityOffered,
    preMoney: application.preMoney,
    arr: application.arr,
    runway: application.runway,
    teamSize: application.teamSize,
    ceoName: application.ceoName,
    achievements: application.achievements,
    email: application.email,
    phone: application.phone,
    telegram: application.telegram,
    website: application.website,
    pitchFile: application.pitchFile,
    modelFile: application.modelFile,
    submittedAt: new Date().toISOString()
  }

  // Формат совместимый с fstExtendedApi.js parseExtendedData
  const descriptionWithExtended = `${application.description || 'Заявка от стартапа'}
<!--FST_EXTENDED_DATA:${JSON.stringify(extended)}-->
<!--FST_FULL_APPLICATION:${JSON.stringify(fullApplication)}-->`

  const body = new URLSearchParams({
    [`t${TYPE_PROJECTS}`]: application.companyName,
    t1156: application.inn || '',
    t1157: (application.amount || 0) * 1_000_000, // Конвертируем млн → руб
    t1158: descriptionWithExtended,
    t1159: new Date().toISOString(),
    ...(subfundId ? { t1177: subfundId } : {}),
    ...(stageId   ? { t1179: stageId   } : {}),
    t1183: STATUSES['Новый'] // Новая заявка всегда со статусом "Новый"
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

/**
 * Сохранить полный протокол заседания инвесткомитета с AI-агентами
 *
 * @param {Object} session - Объект сессии из FstCommitteeEngine
 * @param {string} projectId - ID проекта в fst
 * @returns {Promise<Object>} Созданная запись решения ИК
 */
export async function saveCommitteeSession(session, projectId) {
  // Формируем полный JSON протокола
  const protocol = {
    sessionId: session.id || `session-${Date.now()}`,
    projectId: session.projectId,
    timestamp: new Date().toISOString(),

    // Решение комитета
    decision: {
      recommendation: session.decision?.recommendation || 'DEFER',
      aggregatedScore: session.decision?.aggregatedScore || 0,
      voteCounts: session.decision?.voteCounts || {},
      conditions: session.decision?.conditions || [],
      risks: session.decision?.risks || []
    },

    // Голоса агентов
    votes: (session.votes || []).map(v => ({
      agentId: v.agentId,
      verdict: v.verdict,
      score: v.score,
      confidence: v.confidence,
      reasoning: v.reasoning || ''
    })),

    // Аргументы дебатов
    arguments: (session.arguments || []).map(arg => ({
      id: arg.id,
      agentId: arg.agentId,
      type: arg.type,
      dimension: arg.dimension,
      text: arg.text,
      targetArgId: arg.targetArgId || null,
      timestamp: arg.timestamp || new Date().toISOString()
    })),

    // Параметры политики ФСТ на момент сессии
    policy: session.policy || {},

    // Утверждение человеком
    humanApproval: session.decision?.humanApproval || null,

    // Скоры по измерениям
    dimScores: session.dimScores || {}
  }

  // Определяем итоговое решение ИК
  const finalVerdict = session.decision?.humanApproval?.verdict || session.decision?.recommendation || 'DEFER'
  const decisionIdMap = {
    'APPROVE': 1129,           // Одобрен
    'APPROVE_CONDITIONAL': 1131, // Одобрен с условиями
    'REJECT': 1133,            // Отклонён
    'DEFER': 1135              // На доработку
  }

  const votesAgainst = (session.votes || []).filter(v => v.verdict === 'REJECT').length
  const hasConditions = (session.decision?.conditions || []).length > 0

  // Если APPROVE с условиями, меняем статус
  const decisionId = (finalVerdict === 'APPROVE' && hasConditions)
    ? decisionIdMap['APPROVE_CONDITIONAL']
    : decisionIdMap[finalVerdict]

  // Создаём запись в БД
  const body = new URLSearchParams({
    [`t${TYPE_IC_DECISIONS}`]: `ИК: ${session.project?.title || session.projectId} — ${new Date().toLocaleDateString('ru')}`,
    t1161: votesAgainst,
    t1162: JSON.stringify(protocol, null, 2), // Полный JSON протокола
    t1163: new Date().toISOString(),
    ...(projectId ? { t1185: projectId } : {}),
    ...(decisionId ? { t1187: decisionId } : {})
  })

  return api(`_m_new/${TYPE_IC_DECISIONS}?JSON_KV`, { method: 'POST', body })
}

/**
 * Получить все протоколы ИК (с парсингом JSON)
 */
export async function getCommitteeSessions() {
  const data = await api(`_m_list/${TYPE_IC_DECISIONS}?JSON_KV`)
  const objects = data.object || []
  const reqs = data.reqs || {}

  return objects.map(obj => {
    const r = reqs[obj.id] || {}
    let protocol = null
    try {
      protocol = JSON.parse(r['1162'] || '{}')
    } catch (e) {
      console.warn(`Failed to parse protocol for decision ${obj.id}:`, e)
    }

    return {
      id:             obj.id,
      name:           obj.val,
      votesAgainst:   Number(r['1161'] || 0),
      protocol:       protocol,
      date:           r['1163'] || null,
      meetingDate:    r['1163'] || null,
      projectId:      r['1185'] || null,
      decisionId:     r['1187'] || null,
      // Вынесено наверх для удобства
      projectName:    protocol?.project?.title || protocol?.projectId || obj.val,
      recommendation: protocol?.decision?.recommendation || null,
      aggregatedScore: protocol?.decision?.aggregatedScore || null,
    }
  })
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

const SUBFUND_NAMES = { '1096': 'БАС', '1098': 'РОБО', '1100': 'МЭ' }
const STAGE_NAMES   = { '1102': 'Pre-seed', '1103': 'Seed', '1104': 'Round A', '1105': 'Round B', '1106': 'Round C' }

function refId(val) {
  // Integram REF value: "TypeId:ObjectId" → returns ObjectId string
  if (!val) return null
  return String(val).includes(':') ? String(val).split(':')[1] : String(val)
}

/**
 * Возвращает нормализованный массив портфельных компаний.
 * Включает расширенные поля: invested, nav, метрики JSON, субфонд, стадия.
 */
export async function getPortfolio() {
  const data = await api(`_m_list/${TYPE_PORTFOLIO}?JSON_KV`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}
  return objects.map(obj => {
    const r = reqs[obj.id] || {}

    // Метрики JSON (реквизит 3521)
    let metrics = {}
    try { metrics = JSON.parse(r['3521'] || '{}') } catch {}

    const subfundRaw = refId(r['3524'])
    const stageRaw   = refId(r['3525'])

    return {
      id:          obj.id,
      name:        obj.val,
      kpi:         Number(r['1170'] || 0),
      aiReport:    r['1171'] || '',
      updatedAt:   r['1172'] || null,
      riskStatusId: r['1183'] || null,
      projectId:   r['1185'] || null,
      dealId:      r['1196'] || null,
      // Расширенные поля
      invested:    Number(r['3519'] || 0),
      nav:         Number(r['3520'] || 0),
      subfundId:   subfundRaw,
      subfund:     SUBFUND_NAMES[subfundRaw] || subfundRaw || '',
      stageId:     stageRaw,
      stage:       STAGE_NAMES[stageRaw]   || stageRaw   || '',
      // Из JSON метрик
      health:      metrics.health    || null,
      trl:         metrics.trl       || null,
      runway:      metrics.runway    != null ? Number(metrics.runway) : null,
      headcount:   metrics.headcount || null,
      revenue:     metrics.revenue   || null,
      growth:      metrics.growth    || null,
      fstShare:    metrics.fstShare  || null,
      inn:         metrics.inn       || r['1042'] || '',
      riskLevel:   metrics.riskLevel || null,
    }
  })
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
