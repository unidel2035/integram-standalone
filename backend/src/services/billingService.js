/**
 * Billing Service — Integram CRUD for subscription plans, user subscriptions, AI usage log
 *
 * Integram types (fst database):
 *   77308 — Тарифный план         (SubscriptionPlan)
 *   77322 — Подписка пользователя (UserSubscription)
 *   77338 — AI Usage Log
 *   77512 — Баланс токенов        (TokenBalance)
 *   77522 — Транзакция токенов    (TokenTransaction)
 *
 * Requisite IDs:
 *   Plan:  77310=code, 77312=price, 77314=limit, 77316=models, 77318=apiKeysLimit, 77319=features, 77321=active
 *   Sub:   77324=userId, 77326=planCode, 77327=status, 77329=start, 77331=expires, 77333=callsUsed, 77335=resetDate, 77337=costRub
 *   Usage: 77339=userId, 77341=modelId, 77343=provider, 77345=app, 77347=promptTokens, 77349=completionTokens, 77351=costRub, 77353=ts
 *   Balance: 77513=userId, 77515=balance, 77517=welcomeBonus, 77519=createdAt, 77521=updatedAt
 *   Tx:    77523=userId, 77525=type, 77527=amount, 77529=balanceAfter, 77531=description, 77533=relatedUsageId, 77535=ts
 */

const INTEGRAM_URL = 'https://ai2o.ru'
const DB = 'fst'

const TYPE = {
  plan: 77308,
  subscription: 77322,
  usage: 77338,
  balance: 77512,
  transaction: 77522,
}

const REQ = {
  plan: { code: 77310, price: 77312, limit: 77314, models: 77316, apiKeys: 77318, features: 77319, active: 77321 },
  sub:  { userId: 77324, planCode: 77326, status: 77327, start: 77329, expires: 77331, callsUsed: 77333, resetDate: 77335, costRub: 77337 },
  log:  { userId: 77339, modelId: 77341, provider: 77343, app: 77345, promptTokens: 77347, completionTokens: 77349, costRub: 77351, ts: 77353 },
  bal:  { userId: 77513, balance: 77515, welcomeBonus: 77517, createdAt: 77519, updatedAt: 77521 },
  tx:   { userId: 77523, type: 77525, amount: 77527, balanceAfter: 77529, description: 77531, relatedUsageId: 77533, ts: 77535 },
}

const WELCOME_BONUS = 100000  // токенов при регистрации

// ── Auth cache ──────────────────────────────────────────────────────────────────
let _session = null

async function auth() {
  if (_session) return _session
  const login = process.env.INTEGRAM_SYSTEM_USERNAME
  const password = process.env.INTEGRAM_SYSTEM_PASSWORD
  const resp = await fetch(`${INTEGRAM_URL}/${DB}/auth?JSON_KV=`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `login=${encodeURIComponent(login)}&pwd=${encodeURIComponent(password)}`,
  })
  const data = await resp.json()
  const d = Array.isArray(data) ? data[0] : data
  if (!d.token) throw new Error('Integram auth failed')
  _session = { token: d.token, xsrf: d._xsrf }
  return _session
}

/**
 * Fetch all objects of a type with reqs merged into each row
 * Uses GET object/{typeId}?JSON_KV=&LIMIT=500
 * Cookie: {db}={token}; _xsrf={xsrf}
 */
async function iGetObjects(typeId) {
  const s = await auth()
  const resp = await fetch(`${INTEGRAM_URL}/${DB}/object/${typeId}?JSON_KV=&LIMIT=500`, {
    headers: { Cookie: `${DB}=${s.token}; _xsrf=${s.xsrf}` },
  })
  const text = await resp.text()
  let data
  try { data = JSON.parse(text) } catch { return [] }

  // Integram returns { object: [...], reqs: { objId: { reqId: val, ... } } }
  if (data && data.object && data.reqs) {
    return data.object.map(obj => ({
      id: obj.id,
      val: obj.val,
      ...data.reqs[obj.id],
    }))
  }
  if (Array.isArray(data)) return data
  return []
}

async function iPost(path, params = {}) {
  let s = await auth()
  const parts = [`_xsrf=${encodeURIComponent(s.xsrf)}`]
  for (const [k, v] of Object.entries(params)) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  let resp = await fetch(`${INTEGRAM_URL}/${DB}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Authorization': s.token,
      Cookie: `${DB}=${s.token}; _xsrf=${s.xsrf}`,
    },
    body: parts.join('&'),
  })
  let text = await resp.text()
  // Retry with fresh auth if CSRF error
  if (text.includes('CSRF') || text.includes('устаревший')) {
    _session = null
    s = await auth()
    const body = [`_xsrf=${encodeURIComponent(s.xsrf)}`, ...Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)].join('&')
    resp = await fetch(`${INTEGRAM_URL}/${DB}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Authorization': s.token,
        Cookie: `${DB}=${s.token}; _xsrf=${s.xsrf}`,
      },
      body,
    })
    text = await resp.text()
  }
  try { return JSON.parse(text) } catch { return { error: text } }
}

// ── Plans ────────────────────────────────────────────────────────────────────────

export async function getPlans() {
  const rows = await iGetObjects(TYPE.plan)
  return rows.map(r => ({
    id: r.id,
    name: r.val,
    code: r[REQ.plan.code],
    price: Number(r[REQ.plan.price]) || 0,
    aiCallsLimit: Number(r[REQ.plan.limit]) || 0,
    models: r[REQ.plan.models] || '',
    apiKeysLimit: Number(r[REQ.plan.apiKeys]) || 0,
    features: r[REQ.plan.features] || '',
    active: r[REQ.plan.active],
  }))
}

// ── Subscription ────────────────────────────────────────────────────────────────

export async function getSubscription(userId) {
  const rows = await iGetObjects(TYPE.subscription)
  const row = rows.find(r => String(r[REQ.sub.userId]) === String(userId))
  if (!row) return null
  return {
    id: row.id,
    userId: row[REQ.sub.userId],
    planCode: row[REQ.sub.planCode],
    status: row[REQ.sub.status],
    startedAt: row[REQ.sub.start],
    expiresAt: row[REQ.sub.expires],
    callsUsed: Number(row[REQ.sub.callsUsed]) || 0,
    resetDate: row[REQ.sub.resetDate],
    costRub: Number(row[REQ.sub.costRub]) || 0,
  }
}

export async function createSubscription(userId, planCode) {
  const now = new Date().toISOString()
  const expires = new Date(Date.now() + 30 * 86400000).toISOString()
  // Step 1: create object
  const result = await iPost(`_m_new/${TYPE.subscription}?JSON_KV=`, {
    [`t${TYPE.subscription}`]: `sub_${userId}`,
    up: '1',
  })
  const d = Array.isArray(result) ? result[0] : result
  const objId = d?.id || d?.obj
  if (!objId) throw new Error('Failed to create subscription')
  // Step 2: set requisites
  await iPost(`_m_set/${objId}?JSON_KV=`, {
    [`t${REQ.sub.userId}`]: userId,
    [`t${REQ.sub.planCode}`]: planCode,
    [`t${REQ.sub.status}`]: 'active',
    [`t${REQ.sub.start}`]: now,
    [`t${REQ.sub.expires}`]: expires,
    [`t${REQ.sub.callsUsed}`]: '0',
    [`t${REQ.sub.resetDate}`]: now.slice(0, 7),
    [`t${REQ.sub.costRub}`]: '0',
  })
  return objId
}

export async function updateSubscription(subId, fields) {
  const params = {}
  if (fields.planCode !== undefined)  params[`t${REQ.sub.planCode}`]  = fields.planCode
  if (fields.status !== undefined)    params[`t${REQ.sub.status}`]    = fields.status
  if (fields.callsUsed !== undefined) params[`t${REQ.sub.callsUsed}`] = String(fields.callsUsed)
  if (fields.costRub !== undefined)   params[`t${REQ.sub.costRub}`]   = String(fields.costRub)
  if (fields.resetDate !== undefined) params[`t${REQ.sub.resetDate}`] = fields.resetDate
  if (fields.expiresAt !== undefined) params[`t${REQ.sub.expires}`]   = fields.expiresAt
  await iPost(`_m_set/${subId}?JSON_KV=`, params)
}

// ── Usage Log ───────────────────────────────────────────────────────────────────

export async function logUsage({ userId, modelId, provider, application, promptTokens, completionTokens, costRub }) {
  const now = new Date().toISOString()
  // Step 1: create object
  const result = await iPost(`_m_new/${TYPE.usage}?JSON_KV=`, {
    [`t${TYPE.usage}`]: `${modelId}_${now}`,
    up: '1',
  })
  const d = Array.isArray(result) ? result[0] : result
  const objId = d?.id || d?.obj
  if (!objId) {
    console.error('[Billing] logUsage: no object ID returned', result)
    return
  }
  // Step 2: set requisites via _m_set
  await iPost(`_m_set/${objId}?JSON_KV=`, {
    [`t${REQ.log.userId}`]: userId || 'anonymous',
    [`t${REQ.log.modelId}`]: modelId,
    [`t${REQ.log.provider}`]: provider,
    [`t${REQ.log.app}`]: application || 'unknown',
    [`t${REQ.log.promptTokens}`]: String(promptTokens || 0),
    [`t${REQ.log.completionTokens}`]: String(completionTokens || 0),
    [`t${REQ.log.costRub}`]: String(costRub || 0),
    [`t${REQ.log.ts}`]: now,
  })
}

export async function getUsageStats(userId) {
  const rows = await iGetObjects(TYPE.usage)
  const userRows = userId ? rows.filter(r => String(r[REQ.log.userId]) === String(userId)) : rows

  const totalCalls = userRows.length
  const totalCost = userRows.reduce((s, r) => s + (Number(r[REQ.log.costRub]) || 0), 0)
  const totalPromptTokens = userRows.reduce((s, r) => s + (Number(r[REQ.log.promptTokens]) || 0), 0)
  const totalCompletionTokens = userRows.reduce((s, r) => s + (Number(r[REQ.log.completionTokens]) || 0), 0)

  // By model
  const byModel = {}
  for (const r of userRows) {
    const m = r[REQ.log.modelId] || 'unknown'
    if (!byModel[m]) byModel[m] = { calls: 0, cost: 0 }
    byModel[m].calls++
    byModel[m].cost += Number(r[REQ.log.costRub]) || 0
  }

  // By application
  const byApp = {}
  for (const r of userRows) {
    const a = r[REQ.log.app] || 'unknown'
    if (!byApp[a]) byApp[a] = { calls: 0, cost: 0 }
    byApp[a].calls++
    byApp[a].cost += Number(r[REQ.log.costRub]) || 0
  }

  // Daily (last 30 days)
  const daily = {}
  for (const r of userRows) {
    const day = (r[REQ.log.ts] || '').slice(0, 10)
    if (!day) continue
    if (!daily[day]) daily[day] = { calls: 0, cost: 0 }
    daily[day].calls++
    daily[day].cost += Number(r[REQ.log.costRub]) || 0
  }

  return { totalCalls, totalCost, totalPromptTokens, totalCompletionTokens, byModel, byApp, daily }
}

export async function getUsageHistory(userId, limit = 50) {
  const rows = await iGetObjects(TYPE.usage)
  const filtered = userId ? rows.filter(r => String(r[REQ.log.userId]) === String(userId)) : rows
  return filtered.map(r => ({
    id: r.id,
    modelId: r[REQ.log.modelId],
    provider: r[REQ.log.provider],
    application: r[REQ.log.app],
    promptTokens: Number(r[REQ.log.promptTokens]) || 0,
    completionTokens: Number(r[REQ.log.completionTokens]) || 0,
    costRub: Number(r[REQ.log.costRub]) || 0,
    timestamp: r[REQ.log.ts],
  }))
}

// ── Quota check ─────────────────────────────────────────────────────────────────

export async function checkQuota(userId) {
  const sub = await getSubscription(userId)
  if (!sub) return { allowed: true, plan: 'free', callsUsed: 0, limit: 50 } // no sub = free tier defaults

  const plans = await getPlans()
  const plan = plans.find(p => p.code === sub.planCode)
  const limit = plan?.aiCallsLimit ?? 50

  // Lazy monthly reset
  const currentMonth = new Date().toISOString().slice(0, 7)
  if (sub.resetDate !== currentMonth) {
    await updateSubscription(sub.id, { callsUsed: 0, resetDate: currentMonth, costRub: 0 })
    sub.callsUsed = 0
    sub.costRub = 0
  }

  if (limit === -1) return { allowed: true, plan: sub.planCode, callsUsed: sub.callsUsed, limit: -1 }
  if (sub.callsUsed >= limit) return { allowed: false, plan: sub.planCode, callsUsed: sub.callsUsed, limit }
  return { allowed: true, plan: sub.planCode, callsUsed: sub.callsUsed, limit }
}

// ── Increment usage counter ─────────────────────────────────────────────────────

export async function incrementUsage(userId, costRub = 0) {
  const sub = await getSubscription(userId)
  if (!sub) return
  await updateSubscription(sub.id, {
    callsUsed: sub.callsUsed + 1,
    costRub: (sub.costRub || 0) + costRub,
  })
}

// ── Token Balance ───────────────────────────────────────────────────────────────

export async function getBalance(userId) {
  const rows = await iGetObjects(TYPE.balance)
  const row = rows.find(r => String(r[REQ.bal.userId]) === String(userId))
  if (!row) return null
  return {
    id: row.id,
    userId: row[REQ.bal.userId],
    balance: Number(row[REQ.bal.balance]) || 0,
    welcomeBonus: Number(row[REQ.bal.welcomeBonus]) || 0,
    createdAt: row[REQ.bal.createdAt],
    updatedAt: row[REQ.bal.updatedAt],
  }
}

export async function ensureBalance(userId) {
  if (!userId || userId === 'anonymous') return { userId, balance: WELCOME_BONUS, welcomeBonus: WELCOME_BONUS }
  let bal = await getBalance(userId)
  if (bal) return bal

  // Создаём баланс с приветственным бонусом
  const now = new Date().toISOString()
  const result = await iPost(`_m_new/${TYPE.balance}?JSON_KV=`, {
    [`t${TYPE.balance}`]: `balance_${userId}`,
    up: '1',
  })
  const d = Array.isArray(result) ? result[0] : result
  const objId = d?.id || d?.obj
  if (!objId) throw new Error('Failed to create token balance')

  await iPost(`_m_set/${objId}?JSON_KV=`, {
    [`t${REQ.bal.userId}`]: userId,
    [`t${REQ.bal.balance}`]: String(WELCOME_BONUS),
    [`t${REQ.bal.welcomeBonus}`]: String(WELCOME_BONUS),
    [`t${REQ.bal.createdAt}`]: now,
    [`t${REQ.bal.updatedAt}`]: now,
  })

  // Записываем транзакцию приветственного бонуса
  await createTransaction(userId, 'welcome_bonus', WELCOME_BONUS, WELCOME_BONUS, `Приветственный бонус: ${WELCOME_BONUS.toLocaleString('ru')} токенов`)

  return { id: objId, userId, balance: WELCOME_BONUS, welcomeBonus: WELCOME_BONUS, createdAt: now, updatedAt: now }
}

async function createTransaction(userId, type, amount, balanceAfter, description, relatedUsageId) {
  const now = new Date().toISOString()
  const result = await iPost(`_m_new/${TYPE.transaction}?JSON_KV=`, {
    [`t${TYPE.transaction}`]: `${type}_${userId}_${now}`,
    up: '1',
  })
  const d = Array.isArray(result) ? result[0] : result
  const objId = d?.id || d?.obj
  if (!objId) return
  await iPost(`_m_set/${objId}?JSON_KV=`, {
    [`t${REQ.tx.userId}`]: userId,
    [`t${REQ.tx.type}`]: type,
    [`t${REQ.tx.amount}`]: String(amount),
    [`t${REQ.tx.balanceAfter}`]: String(balanceAfter),
    [`t${REQ.tx.description}`]: description || '',
    [`t${REQ.tx.relatedUsageId}`]: relatedUsageId || '',
    [`t${REQ.tx.ts}`]: now,
  })
}

export async function deductTokens(userId, tokenCount, description, relatedUsageId) {
  if (!userId || userId === 'anonymous') return { success: true, newBalance: -1 }
  const bal = await ensureBalance(userId)
  if (bal.balance < tokenCount) {
    return { success: false, balance: bal.balance, error: 'insufficient_tokens' }
  }
  const newBalance = bal.balance - tokenCount
  await iPost(`_m_set/${bal.id}?JSON_KV=`, {
    [`t${REQ.bal.balance}`]: String(newBalance),
    [`t${REQ.bal.updatedAt}`]: new Date().toISOString(),
  })
  await createTransaction(userId, 'deduction', -tokenCount, newBalance, description, relatedUsageId)
  return { success: true, newBalance }
}

export async function depositTokens(userId, tokenCount, description) {
  const bal = await ensureBalance(userId)
  const newBalance = bal.balance + tokenCount
  await iPost(`_m_set/${bal.id}?JSON_KV=`, {
    [`t${REQ.bal.balance}`]: String(newBalance),
    [`t${REQ.bal.updatedAt}`]: new Date().toISOString(),
  })
  await createTransaction(userId, 'deposit', tokenCount, newBalance, description || `Пополнение: +${tokenCount.toLocaleString('ru')} токенов`)
  return { success: true, newBalance }
}

export async function getTransactionHistory(userId, limit = 50) {
  const rows = await iGetObjects(TYPE.transaction)
  const filtered = userId ? rows.filter(r => String(r[REQ.tx.userId]) === String(userId)) : rows
  return filtered
    .map(r => ({
      id: r.id,
      type: r[REQ.tx.type],
      amount: Number(r[REQ.tx.amount]) || 0,
      balanceAfter: Number(r[REQ.tx.balanceAfter]) || 0,
      description: r[REQ.tx.description],
      ts: r[REQ.tx.ts],
    }))
    .sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
    .slice(0, limit)
}

export async function checkTokenQuota(userId) {
  if (!userId || userId === 'anonymous') return { allowed: true, balance: WELCOME_BONUS }
  const bal = await ensureBalance(userId)
  return { allowed: bal.balance > 0, balance: bal.balance, userId }
}
