/**
 * fstApi.js — Integram API клиент для базы данных ai2o.ru/fst
 *
 * Таблицы и реквизиты (подтверждены через integram_get_type_metadata):
 *
 * fst/1155 "Проекты ФСТ v2":
 *   t1155 = название компании (main)
 *   t2237 = ОГРН (SHORT)
 *   t2238 = Запрашиваемая сумма, руб (NUMBER)
 *   t1158 = Описание проекта (HTML)
 *   t1159 = Дата подачи (DATETIME)
 *   t1178 = Субфонд (ref→1082)
 *   t1180 = Стадия (ref→1084)
 *   t1182 = Тип финансирования (ref→1086)
 *   t1184 = Статус проекта (ref→1088)
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

// Пустая строка → использует Vite proxy /fst → https://ai2o.ru/fst
const FST_SERVER = ''
const FST_DB = import.meta.env.VITE_FST_DB || 'fst-api'

let _token = null
let _xsrf = null
let _authPromise = null

// ── Auth ──────────────────────────────────────────────────────────────────

export async function authenticate() {
  if (_token) return { token: _token, xsrf: _xsrf }
  if (_authPromise) return _authPromise

  _authPromise = (async () => {
    const login = import.meta.env.VITE_FST_LOGIN || import.meta.env.VITE_INTEGRAM_LOGIN || ''
    const password = import.meta.env.VITE_FST_PASSWORD || import.meta.env.VITE_INTEGRAM_PASSWORD || ''

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
  })()

  try {
    return await _authPromise
  } finally {
    _authPromise = null
  }
}

async function api(path, options = {}) {
  const { token, xsrf } = await authenticate()
  const method = options.method || 'GET'

  // For GET requests do NOT append _xsrf — server returns 403 CSRF error for GET+_xsrf in URL
  let url = `${FST_SERVER}/${FST_DB}/${path}`

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


/**
 * Estimate projected IRR from application data (issue #151)
 * Uses stage, TAM, TRL and requested amount to produce a per-project estimate
 * instead of the old hardcoded 0.25.
 */
export function estimateIRR(app) {
  // Base IRR by investment stage — earlier stage = higher target return
  const stageIRR = {
    'Pre-Seed': 0.55,
    'Seed':     0.40,
    'A':        0.30,
    'B':        0.22,
    'C':        0.18,
  }
  let base = 0.30 // default if stage unknown
  const stage = app.stage || ''
  for (const [key, val] of Object.entries(stageIRR)) {
    if (stage.includes(key)) { base = val; break }
  }

  // Market size adjustment: larger TAM → slightly higher IRR potential
  const tamB = (app.tam || 10) // TAM in billions
  if (tamB >= 50) base += 0.05
  else if (tamB >= 20) base += 0.03
  else if (tamB < 5) base -= 0.03

  // TRL adjustment: higher TRL → lower risk → slightly lower IRR
  const trl = app.trl || 5
  if (trl >= 7) base -= 0.04
  else if (trl <= 3) base += 0.05

  // Clamp to reasonable venture range [0.12, 0.65]
  return Math.round(Math.min(0.65, Math.max(0.12, base)) * 100) / 100
}

// ── Projects ──────────────────────────────────────────────────────────────

export const TYPE_PROJECTS = 1155

/**
 * Возвращает нормализованный массив проектов.
 */
export async function getProjects() {
  // Use object/{typeId} endpoint (GET, no _xsrf needed)
  const data = await api(`object/${TYPE_PROJECTS}?JSON_KV`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}

  // Helper: parse ref value "typeId:objectId" → objectId string
  const refId = (r, refKey) => {
    const raw = r?.[`ref_${refKey}`]
    if (!raw) return r?.[refKey] || null
    const parts = String(raw).split(':')
    return parts.length === 2 ? parts[1] : raw
  }

  return objects.map(obj => {
    const r = reqs[obj.id] || {}
    return {
      id:          obj.id,
      name:        obj.val,
      ogrn:        r['2237'] || '',              // SHORT
      amount:      Number(r['2238'] || 0),       // NUMBER
      description: r['1158'] || '',
      submittedAt: r['1159'] || null,
      subfundId:   refId(r, '1178'),             // ref→1082
      stageId:     refId(r, '1180'),             // ref→1084
      statusId:    refId(r, '1184'),             // ref→1088
      // Issue #157: dedicated numeric fields
      trl:              Number(r['6155'] || 0),   // 1-9
      mrl:              Number(r['6157'] || 0),   // 1-10
      sovereigntyScore: Number(r['6159'] || 0),   // 0-9
      projectedIRR:     Number(r['6161'] || 0),   // % (e.g. 45)
      marketSizeMln:    Number(r['6163'] || 0),   // млн руб
      teamStrength:     Number(r['6165'] || 0),   // 0-10
      employees:        Number(r['6167'] || 0),
      patents:          Number(r['6169'] || 0),
      foundedYear:      Number(r['6171'] || 0),
    }
  })
}

export async function getProject(id) {
  return api(`object/${id}?JSON_KV`)
}

export async function createProject(data) {
  const body = new URLSearchParams({
    [`t${TYPE_PROJECTS}`]: data.name,
    up: 1, // Required for independent (top-level) objects in Integram
    t2237: data.ogrn || '',
    t2238: data.amount || 0,
    t1158: data.description || '',
    t1159: data.submittedAt || new Date().toISOString(),
    ...(data.subfundId ? { t1178: data.subfundId } : {}),
    ...(data.stageId   ? { t1180: data.stageId   } : {}),
    ...(data.statusId  ? { t1184: data.statusId  } : {}),
    // Issue #157: dedicated numeric fields
    ...(data.trl              != null ? { t6155: data.trl }              : {}),
    ...(data.mrl              != null ? { t6157: data.mrl }              : {}),
    ...(data.sovereigntyScore != null ? { t6159: data.sovereigntyScore } : {}),
    ...(data.projectedIRR     != null ? { t6161: data.projectedIRR }     : {}),
    ...(data.marketSizeMln    != null ? { t6163: data.marketSizeMln }    : {}),
    ...(data.teamStrength     != null ? { t6165: data.teamStrength }     : {}),
    ...(data.employees        != null ? { t6167: data.employees }        : {}),
    ...(data.patents          != null ? { t6169: data.patents }          : {}),
    ...(data.foundedYear      != null ? { t6171: data.foundedYear }      : {}),
  })
  const result = await api(`_m_new/${TYPE_PROJECTS}?JSON_KV`, { method: 'POST', body })
  // Integram returns array with error object on failure
  if (Array.isArray(result) && result[0]?.error) {
    throw new Error(result[0].error)
  }
  return result
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
    projectedIRR: estimateIRR(application),
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
    up: 1, // Required for independent (top-level) objects in Integram
    t2237: application.inn || '',
    t2238: (application.amount || 0) * 1_000_000,
    t1158: descriptionWithExtended,
    t1159: new Date().toISOString(),
    ...(subfundId ? { t1178: subfundId } : {}),
    ...(stageId   ? { t1180: stageId   } : {}),
    t1184: STATUSES['Новый'],
    // Issue #157: write to dedicated numeric fields
    t6155: extended.trl || 0,
    t6157: extended.mrl || 0,
    t6159: extended.sovereigntyScore || 0,
    t6161: Math.round((extended.projectedIRR || 0) * 100),  // 0-1 → %
    t6163: Math.round((extended.marketSize || 0) / 1_000_000),  // руб → млн
    t6165: Math.round((extended.teamStrength || 0) * 10),  // 0-1 → 0-10
    t6167: extended.employees || 0,
    t6169: extended.patents || 0,
    t6171: extended.founded || 0,
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
  return api(`object/${TYPE_IC_DECISIONS}?JSON_KV&l=100${projectId ? `&ref_1186=${projectId}` : ''}`)
}

export async function saveDecision(data) {
  const body = new URLSearchParams({
    [`t${TYPE_IC_DECISIONS}`]: data.name || `ИК ${new Date().toLocaleDateString('ru')}`,
    up: 1,
    t2239: data.votesAgainst || 0,
    t3503: data.conditions || '',
    t3504: data.meetingDate || new Date().toISOString(),
    ...(data.projectId  ? { ref_1186: data.projectId  } : {}),
    ...(data.decisionId ? { ref_1188: data.decisionId } : {})
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
    dimScores: session.dimScores || {},

    // Issue #159: LLM model configuration used in this session
    modelConfig: {
      speedProfile: session.speedProfile || 'fast',
      votingMode: session.votingMode || 'hybrid',
      modelOverrides: session.modelOverrides || {}
    },

    // Issue #160: agent diagnostics for quality analysis
    agentStats: session.agentStats || {}
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
    up: 1,
    t2239: votesAgainst,
    t3503: JSON.stringify(protocol, null, 2), // Полный JSON протокола
    t3504: new Date().toISOString(),
    ...(projectId ? { [`ref_1186`]: projectId } : {}),
    ...(decisionId ? { [`ref_1188`]: decisionId } : {})
  })

  return api(`_m_new/${TYPE_IC_DECISIONS}?JSON_KV`, { method: 'POST', body })
}

/**
 * Получить все протоколы ИК (с парсингом JSON)
 */
export async function getCommitteeSessions() {
  const data = await api(`object/${TYPE_IC_DECISIONS}?JSON_KV&l=100`)
  const objects = data.object || []
  const reqs = data.reqs || {}

  return objects.map(obj => {
    const r = reqs[obj.id] || {}
    let protocol = null
    const rawProto = r['3503']
    if (rawProto) {
      try {
        protocol = JSON.parse(rawProto)
      } catch (e) {
        console.warn(`Failed to parse protocol for decision ${obj.id}:`, e)
      }
    }

    // Map DB decision text to recommendation enum
    const decisionText = r['1188'] || ''
    const dbRecommendation = decisionText.includes('условиями') ? 'APPROVE_CONDITIONAL'
      : decisionText.includes('Одобрен') ? 'APPROVE'
      : decisionText.includes('Отклон') ? 'REJECT'
      : decisionText.includes('доработ') ? 'DEFER'
      : null

    return {
      id:             obj.id,
      name:           obj.val,
      votesAgainst:   Number(r['2239'] || 0),
      protocol:       protocol,
      date:           r['3504'] || null,
      meetingDate:    r['3504'] || null,
      projectId:      r['ref_1186']?.split(':')?.[1] || r['1186'] || null,
      decisionId:     r['ref_1188']?.split(':')?.[1] || r['1188'] || null,
      // Вынесено наверх для удобства
      projectName:    protocol?.project?.title || r['1186'] || obj.val,
      recommendation: protocol?.decision?.recommendation || dbRecommendation,
      aggregatedScore: protocol?.decision?.aggregatedScore || null,
    }
  })
}

// ── Deals ─────────────────────────────────────────────────────────────────

export const TYPE_DEALS = 1164

export async function getDeals(projectId) {
  return api(`object/${TYPE_DEALS}?JSON_KV&l=100${projectId ? `&ref_1189=${projectId}` : ''}`)
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
  const data = await api(`object/${TYPE_PORTFOLIO}?JSON_KV&l=100`)
  const objects = data.object || []
  const reqs    = data.reqs   || {}
  // Дедупликация: если есть несколько записей для одного имени, берём с наибольшим ID (самая свежая)
  const seen = new Map()
  for (const obj of objects) {
    const existing = seen.get(obj.val)
    if (!existing || Number(obj.id) > Number(existing.id)) seen.set(obj.val, obj)
  }
  const deduped = Array.from(seen.values())

  return deduped.map(obj => {
    const r = reqs[obj.id] || {}

    // Метрики JSON (реквизит 3521)
    let metrics = {}
    try { metrics = JSON.parse(r['3521'] || '{}') } catch {}

    const subfundRaw = refId(r['3524'])
    const stageRaw   = refId(r['3525'])

    return {
      id:          obj.id,
      name:        obj.val,
      kpi:          Number(r['2242'] || 0),     // KPI прогресс, %
      aiReport:     r['3507'] || '',             // AI отчёт портфельной компании
      updatedAt:    r['3508'] || null,           // Дата обновления
      riskStatusId: refId(r['1198']) || null,   // Риск-статус (ref→1088)
      projectId:    refId(r['1195']) || null,   // Проект (ref→1155)
      dealId:       refId(r['1197']) || null,   // Сделка (ref→1164)
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
  return api(`object/${TYPE_TRANCHES}?JSON_KV&l=100${dealId ? `&ref_1199=${dealId}` : ''}`)
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

// ── Weekly Intelligence Reports ──────────────────────────────────────────────

export const TYPE_WEEKLY_REPORTS = 1200

/**
 * Получить все еженедельные AI-отчёты
 */
export async function getWeeklyReports() {
  const data = await api(`object/${TYPE_WEEKLY_REPORTS}?JSON_KV&l=100`)
  const objects = data.object || []
  const reqs = data.reqs || {}

  return objects.map(obj => {
    let reportData = null
    try {
      const jsonStr = reqs[obj.id]?.['1201'] || '{}'
      reportData = JSON.parse(jsonStr)
    } catch (e) {
      console.warn(`Failed to parse report ${obj.id}:`, e)
    }

    return {
      id: obj.id,
      title: obj.val,
      createdAt: reqs[obj.id]?.['1202'] || null,
      ...reportData
    }
  })
}

/**
 * Сохранить еженедельный AI-отчёт
 * @param {Object} report - Объект отчёта из fstIntelligenceService
 */
export async function saveWeeklyReport(report) {
  // Формируем JSON отчёта без метаданных
  const reportData = {
    executiveDigest: report.executiveDigest,
    topPositives: report.topPositives,
    topRisks: report.topRisks,
    actionItems: report.actionItems,
    riskCompanies: report.riskCompanies,
    marketNews: report.marketNews,
    competitorActivity: report.competitorActivity,
    regulatoryChanges: report.regulatoryChanges,
    expectedKPIs: report.expectedKPIs,
    upcomingTranches: report.upcomingTranches,
    upcomingMeetings: report.upcomingMeetings,
    risksCount: report.risksCount,
    actionsCount: report.actionsCount
  }

  const body = new URLSearchParams({
    [`t${TYPE_WEEKLY_REPORTS}`]: report.title,
    t1201: JSON.stringify(reportData, null, 2), // JSON отчёта
    t1202: report.createdAt || new Date().toISOString()
  })

  return api(`_m_new/${TYPE_WEEKLY_REPORTS}?JSON_KV`, { method: 'POST', body })
}

// ── Applications / Заявки (type 1956) ────────────────────────────────────

export const TYPE_APPLICATIONS = 1956

/**
 * Создать заявку в таблице Заявки (1956) с полями НТИ-анкеты
 */
export async function createApplication(application) {
  const body = new URLSearchParams({
    [`t${TYPE_APPLICATIONS}`]: application.companyName || 'Новая заявка',
    up: 1,
    // --- Базовые поля ---
    ...(application.description  ? { t1158: application.description }         : {}),
    ...(application.inn          ? { t2237: application.inn }                 : {}),
    ...(application.email        ? { t2240: application.email }               : {}),
    // --- Новые поля НТИ ---
    ...(application.projectGoals     ? { t7698: application.projectGoals }     : {}),
    ...(application.techResult       ? { t7700: application.techResult }       : {}),
    ...(application.commercialResult ? { t7702: application.commercialResult } : {}),
    ...(application.dualUse          ? { t7704: application.dualUse }          : {}),
    ...(application.rdBacklog        ? { t7706: application.rdBacklog }        : {}),
    ...(application.trl != null      ? { t7708: application.trl }              : {}),
    ...(application.timeline         ? { t7710: application.timeline }         : {}),
    ...(application.projectCost != null ? { t7712: application.projectCost }   : {}),
    ...(application.potentialCustomers ? { t7714: application.potentialCustomers } : {}),
    ...(application.monetizationModel  ? { t7716: application.monetizationModel }  : {}),
    ...(application.rid              ? { t7718: application.rid }              : {}),
    ...(application.teamDesc         ? { t7720: application.teamDesc }         : {}),
    ...(application.revenue3y        ? { t7722: application.revenue3y }        : {}),
    ...(application.devInstitutions  ? { t7724: application.devInstitutions }  : {}),
    ...(application.govFunding       ? { t7726: application.govFunding }       : {}),
    ...(application.exportMarkets    ? { t7728: application.exportMarkets }    : {}),
    ...(application.tamSamSomRf      ? { t7730: application.tamSamSomRf }      : {}),
    ...(application.tamSamSomAbroad  ? { t7732: application.tamSamSomAbroad }  : {}),
    ...(application.competitiveAnalysis ? { t7734: application.competitiveAnalysis } : {}),
    ...(application.irrForecast != null ? { t7736: application.irrForecast }   : {}),
    ...(application.exitStrategy     ? { t7738: application.exitStrategy }     : {}),
    ...(application.contacts         ? { t7740: application.contacts }         : {}),
  })
  return api(`_m_new/${TYPE_APPLICATIONS}?JSON_KV`, { method: 'POST', body })
}

// ── Smart Contracts (types 3995, 3996, 3999) ─────────────────────────────

const TYPE_CONTRACTS = 3995
const TYPE_CONTRACT_NODES = 3996
const TYPE_CONDITIONS = 3999

/**
 * Загрузить смарт контракт по ID
 */
export async function loadContract(contractId) {
  const data = await api(`object/${TYPE_CONTRACTS}?JSON_KV&l=50`)
  const obj = (data?.object || []).find(o => String(o.id) === String(contractId))
  if (!obj) return null
  return {
    id: obj.id,
    name: obj.val,
    createdAt: obj.created,
  }
}

/**
 * Загрузить ноды (сценарии) контракта
 */
export async function loadContractNodes(contractId) {
  const data = await api(`object/${TYPE_CONTRACT_NODES}?JSON_KV&l=50`)
  const objects = data?.object || []
  const reqs = data?.reqs || {}

  return objects
    .filter(obj => String(obj.up) === String(contractId))
    .map(obj => {
      const r = reqs[obj.id] || {}
      return {
        id: obj.id,
        name: obj.val,
        scenario: r['4008'] || obj.val,
        ic: parseFloat(r['4010']) || 0,
        wacc: parseFloat(r['4012']) || 0,
        horizon: parseInt(r['4014']) || 5,
        cashflows: [
          parseFloat(r['4016']) || 0,
          parseFloat(r['4018']) || 0,
          parseFloat(r['4020']) || 0,
          parseFloat(r['4022']) || 0,
          parseFloat(r['4024']) || 0,
        ],
        npv: parseFloat(r['4026']) || 0,
        irr: parseFloat(r['4028']) || 0,
        roi: parseFloat(r['4030']) || 0,
        dpp: parseFloat(r['4032']) || 0,
        pi: parseFloat(r['4034']) || 0,
        probability: parseFloat(r['4036']) || 0,
        status: r['4038'] || 'unknown',
      }
    })
}

/**
 * Загрузить условия (conditions) для ноды контракта
 */
export async function loadConditions(nodeId) {
  const data = await api(`object/${TYPE_CONDITIONS}?JSON_KV&l=100`)
  const objects = data?.object || []
  const reqs = data?.reqs || {}

  return objects
    .filter(obj => String(obj.up) === String(nodeId))
    .map(obj => {
      const r = reqs[obj.id] || {}
      return {
        id: obj.id,
        text: obj.val || r['3999'] || '',
        value: r['4002'] || '',
        threshold: r['4040'] || '',
        deadline: r['4042'] || '',
        priority: r['4044'] || 'MEDIUM',
        status: r['4046'] || 'PROPOSED',
        agent: r['4048'] || '',
      }
    })
}

// ── Committee Config Presets (type 6298) ──────────────────────────────────
// Issue #159: save/load LLM model config presets

const TYPE_IC_CONFIG = 6298

/**
 * Load all committee config presets
 */
export async function loadCommitteeConfigs() {
  const data = await api(`object/${TYPE_IC_CONFIG}?JSON_KV&l=50`)
  const objects = data?.object || []
  const reqs = data?.reqs || {}

  return objects.map(obj => {
    const r = reqs[obj.id] || {}
    let modelMap = {}
    try { modelMap = JSON.parse(r['6300'] || '{}') } catch {}
    return {
      id: obj.id,
      name: obj.val,
      modelMap,
      speedProfile: r['6302'] || 'fast',
      votingMode: r['6304'] || 'hybrid',
      active: r['6306'] === '1' || r['6306'] === 'true',
    }
  })
}

/**
 * Save a committee config preset
 */
export async function saveCommitteeConfig(config) {
  const body = new URLSearchParams({
    [`t${TYPE_IC_CONFIG}`]: config.name,
    t6300: JSON.stringify(config.modelMap || {}),
    t6302: config.speedProfile || 'fast',
    t6304: config.votingMode || 'hybrid',
    t6306: '1',
  })
  return api(`_m_new/${TYPE_IC_CONFIG}?JSON_KV`, { method: 'POST', body })
}

/**
 * Delete a committee config preset
 */
export async function deleteCommitteeConfig(configId) {
  return api(`_m_del/${configId}?JSON_KV`, { method: 'POST' })
}

// ── Issue #161: Committee decision thresholds ─────────────────────────────

const TYPE_IC_PARAMS = 6331

/** Default thresholds (used when DB unavailable) */
export const IC_PARAMS_DEFAULTS = {
  approveThreshold: 72,
  deferThreshold:   50,
  maxIter:          5,
  consensusPressure:85,
  quorum:           7,
  votingMode:       'hybrid',
  subfundId:        0,
}

/**
 * Load committee params from Integram. Optionally filter by subfundId.
 * Falls back to defaults on error.
 */
export async function loadCommitteeParams(subfundId = 0) {
  try {
    const data = await api(`object/${TYPE_IC_PARAMS}?JSON_KV&l=50`)
    const objects = data?.object || []
    const reqs = data?.reqs || {}

    const parsed = objects.map(obj => {
      const r = reqs[obj.id] || {}
      return {
        id:                obj.id,
        name:              obj.val,
        approveThreshold:  Number(r['6333'] || 72),
        deferThreshold:    Number(r['6335'] || 50),
        maxIter:           Number(r['6337'] || 5),
        consensusPressure: Number(r['6339'] || 85),
        quorum:            Number(r['6341'] || 7),
        votingMode:        r['6342'] || 'hybrid',
        subfundId:         Number(r['6344'] || 0),
      }
    })

    // Find subfund-specific config, fallback to default (subfundId=0)
    if (subfundId) {
      const specific = parsed.find(p => p.subfundId === subfundId)
      if (specific) return specific
    }
    return parsed.find(p => p.subfundId === 0) || { ...IC_PARAMS_DEFAULTS }
  } catch (err) {
    console.warn('[fstApi] loadCommitteeParams failed, using defaults:', err.message)
    return { ...IC_PARAMS_DEFAULTS }
  }
}

/**
 * Save committee params to Integram (update existing or create new)
 */
export async function saveCommitteeParams(params) {
  if (params.id) {
    // Update existing
    const body = new URLSearchParams({
      t6333: String(params.approveThreshold || 72),
      t6335: String(params.deferThreshold || 50),
      t6337: String(params.maxIter || 5),
      t6339: String(params.consensusPressure || 85),
      t6341: String(params.quorum || 7),
      t6342: params.votingMode || 'hybrid',
      t6344: String(params.subfundId || 0),
    })
    return api(`_m_set/${params.id}?JSON_KV`, { method: 'POST', body })
  }
  // Create new
  const body = new URLSearchParams({
    [`t${TYPE_IC_PARAMS}`]: params.name || 'Параметры ИК',
    t6333: String(params.approveThreshold || 72),
    t6335: String(params.deferThreshold || 50),
    t6337: String(params.maxIter || 5),
    t6339: String(params.consensusPressure || 85),
    t6341: String(params.quorum || 7),
    t6342: params.votingMode || 'hybrid',
    t6344: String(params.subfundId || 0),
  })
  return api(`_m_new/${TYPE_IC_PARAMS}?JSON_KV`, { method: 'POST', body })
}

// ── Сессии чата (Issue #162 → fst/6377) ──────────────────────────────────────

const TYPE_CHAT_SESSION = 6377

/**
 * Загрузить последнюю сессию чата пользователя из fst
 */
export async function loadChatSession(userId) {
  try {
    const data = await api(`object/${TYPE_CHAT_SESSION}?JSON_KV&l=1&s=6385&d=1`)
    const objects = data?.objects || data?.object || []
    if (!objects.length) return null
    // Ищем сессию этого пользователя
    const session = objects.find(o => {
      const user = o.reqs?.['6388']?.value || o['6388']
      return user === userId || user === String(userId)
    }) || objects[0]
    const messagesRaw = session.reqs?.['6381']?.value || session['6381'] || ''
    if (!messagesRaw) return null
    return {
      id: session.id,
      sessionId: session.reqs?.['6379']?.value || session['6379'] || '',
      messages: JSON.parse(messagesRaw),
      model: session.reqs?.['6383']?.value || session['6383'] || '',
    }
  } catch (err) {
    console.warn('[fstApi] loadChatSession error:', err.message)
    return null
  }
}

/**
 * Сохранить/обновить сессию чата в fst
 */
export async function saveChatSession({ id, sessionId, messages, model, userId }) {
  const messagesJson = JSON.stringify(messages)
  const now = new Date().toISOString()
  if (id) {
    // Обновить существующую
    const body = new URLSearchParams({
      t6381: messagesJson,
      t6383: model || '',
      t6385: now,
      t6387: String(messages.length),
    })
    return api(`_m_set/${id}?JSON_KV`, { method: 'POST', body })
  }
  // Создать новую
  const body = new URLSearchParams({
    [`t${TYPE_CHAT_SESSION}`]: sessionId || `chat_${Date.now()}`,
    t6379: sessionId || `chat_${Date.now()}`,
    t6381: messagesJson,
    t6383: model || '',
    t6385: now,
    t6387: String(messages.length),
    t6388: userId || '',
  })
  return api(`_m_new/${TYPE_CHAT_SESSION}?JSON_KV`, { method: 'POST', body })
}
