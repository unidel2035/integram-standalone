/**
 * portfolioMetricsApi.js — Загрузка метрик портфельных компаний из Integram
 *
 * Таблица "Метрика компании" (type 126255) — subordinate к type 1155 "Проекты ФСТ"
 * Реквизиты:
 *   126257 — Год (NUMBER)
 *   126259 — Значение тыс.руб. (NUMBER)
 *   126262 — Источник (SHORT): "факт" | "план" | "оценка"
 *   126269 — Статья (ref → 125295)
 *
 * Справочник "Статья" (type 125295) — 25 статей с группами:
 *   126189 — группа (revenue, expense, result, investment, cashflow, valuation, deal, operational, tech, scoring)
 *   126191 — порядок
 */

import { authenticate } from './fstApi.js'

const FST_DB = import.meta.env.VITE_FST_DB || 'fst-api'

const METRIC_TYPE   = 126255
const ARTICLE_TYPE  = 125295

// Requisite IDs inside type 126255
const REQ_YEAR    = '126257'
const REQ_VALUE   = '126259'
const REQ_SOURCE  = '126262'
const REQ_ARTICLE = '126269'

// Article ID → name mapping (built once)
const ARTICLE_MAP = {
  '126200': { name: 'Выручка',          group: 'revenue',    key: 'revenue' },
  '126203': { name: 'COGS',             group: 'expense',    key: 'cogs' },
  '126206': { name: 'Валовая прибыль',  group: 'result',     key: 'grossProfit' },
  '126209': { name: 'ФОТ',              group: 'expense',    key: 'payroll' },
  '126212': { name: 'R&D',              group: 'expense',    key: 'rnd' },
  '126215': { name: 'Маркетинг',        group: 'expense',    key: 'marketing' },
  '126218': { name: 'OPEX прочие',      group: 'expense',    key: 'opex' },
  '126221': { name: 'EBITDA',           group: 'result',     key: 'ebitda' },
  '126224': { name: 'Налог на прибыль', group: 'expense',    key: 'tax' },
  '126227': { name: 'Чистая прибыль',   group: 'result',     key: 'netProfit' },
  '126232': { name: 'Инвестиции',       group: 'investment', key: 'investment' },
  '126235': { name: 'Cash Flow',        group: 'cashflow',   key: 'cashflow' },
  '126238': { name: 'NPV',             group: 'valuation',  key: 'npv' },
  '126241': { name: 'Амортизация',      group: 'expense',    key: 'depreciation' },
  '126244': { name: 'Капитальные затраты', group: 'investment', key: 'capex' },
  '136197': { name: 'Оценка pre-money', group: 'valuation',  key: 'preMoneyVal' },
  '136200': { name: 'Оценка post-money', group: 'valuation', key: 'postMoneyVal' },
  '136203': { name: 'Доля фонда %',     group: 'deal',       key: 'fundShare' },
  '136206': { name: 'Штат (чел.)',       group: 'operational', key: 'headcount' },
  '136209': { name: 'Продажи (шт.)',     group: 'operational', key: 'salesUnits' },
  '136212': { name: 'TRL',              group: 'tech',       key: 'trl' },
  '136215': { name: 'MRL',              group: 'tech',       key: 'mrl' },
  '136218': { name: 'IRR %',            group: 'valuation',  key: 'irr' },
  '136221': { name: 'Срок окупаемости (лет)', group: 'valuation', key: 'paybackYears' },
  '136224': { name: 'Оценка ИК (балл)', group: 'scoring',    key: 'icScore' },
}

/**
 * Загрузить метрики для одной компании
 * @param {string|number} companyId — Integram object ID компании (type 1155)
 * @returns {Promise<Array<{year, value, source, articleId, articleName, articleKey, group}>>}
 */
export async function fetchCompanyMetrics(companyId) {
  const { token } = await authenticate()
  const url = `/${FST_DB}/object/${METRIC_TYPE}?JSON_KV&F_U=${companyId}&l=200`

  const res = await fetch(url, {
    headers: { 'X-Authorization': token }
  })
  const data = await res.json()

  const objects = data.object || []
  const reqs = data.reqs || {}

  return objects.map(obj => {
    const r = reqs[obj.id] || {}
    const refArticle = r[`ref_${REQ_ARTICLE}`] || ''
    const articleId = refArticle.split(':')[1] || ''
    const article = ARTICLE_MAP[articleId] || { name: r[REQ_ARTICLE] || '?', group: 'other', key: 'unknown' }

    return {
      id: obj.id,
      year: Number(r[REQ_YEAR]) || 0,
      value: Number(r[REQ_VALUE]) || 0,  // тыс. руб.
      source: r[REQ_SOURCE] || '',
      articleId,
      articleName: article.name,
      articleKey: article.key,
      group: article.group,
    }
  })
}

/**
 * Загрузить метрики для всех компаний параллельно
 * @param {Array<{id}>} companies — массив компаний с id
 * @returns {Promise<Map<string, Array>>} companyId → metrics[]
 */
export async function fetchAllCompanyMetrics(companies) {
  const results = new Map()
  // Batch requests to avoid overwhelming Integram (max 5 concurrent)
  const BATCH_SIZE = 5
  for (let i = 0; i < companies.length; i += BATCH_SIZE) {
    const batch = companies.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(async (c) => {
      try {
        const metrics = await fetchCompanyMetrics(c.id)
        results.set(String(c.id), metrics)
      } catch (err) {
        console.warn(`[portfolioMetrics] Failed to load metrics for ${c.id}:`, err.message)
        results.set(String(c.id), [])
      }
    }))
  }
  return results
}

/**
 * Извлечь сводку по компании из массива метрик
 * @param {Array} metrics — массив метрик из fetchCompanyMetrics
 * @returns {Object} structured summary
 */
export function summarizeMetrics(metrics) {
  if (!metrics || !metrics.length) return null

  const byKey = {}
  for (const m of metrics) {
    if (!byKey[m.articleKey]) byKey[m.articleKey] = []
    byKey[m.articleKey].push(m)
  }

  // Последний год с выручкой > 0
  const revenueRows = (byKey.revenue || []).filter(r => r.value > 0).sort((a, b) => b.year - a.year)
  const latestRevenue = revenueRows[0] || null

  // Суммарные инвестиции
  const totalInvestment = (byKey.investment || []).reduce((s, r) => s + r.value, 0)

  // Доля фонда — берём последнюю
  const shareRows = (byKey.fundShare || []).sort((a, b) => b.year - a.year)
  const fundShare = shareRows[0]?.value || 0

  // Оценка pre-money — последняя
  const preMoneyRows = (byKey.preMoneyVal || []).sort((a, b) => b.year - a.year)
  const preMoney = preMoneyRows[0]?.value || 0

  // Оценка post-money — последняя
  const postMoneyRows = (byKey.postMoneyVal || []).sort((a, b) => b.year - a.year)
  const postMoney = postMoneyRows[0]?.value || 0

  // TRL
  const trlRows = (byKey.trl || []).sort((a, b) => b.year - a.year)
  const trl = trlRows[0]?.value || 0

  // Штат
  const headcountRows = (byKey.headcount || []).sort((a, b) => b.year - a.year)
  const headcount = headcountRows[0]?.value || 0

  // IRR
  const irrRows = (byKey.irr || []).sort((a, b) => b.year - a.year)
  const irr = irrRows[0]?.value || 0

  // NPV
  const npvRows = (byKey.npv || []).sort((a, b) => b.year - a.year)
  const npv = npvRows[0]?.value || 0

  // EBITDA последний
  const ebitdaRows = (byKey.ebitda || []).filter(r => r.value !== 0).sort((a, b) => b.year - a.year)
  const latestEbitda = ebitdaRows[0] || null

  // Продажи (шт.)
  const salesRows = (byKey.salesUnits || []).sort((a, b) => b.year - a.year)
  const salesUnits = salesRows[0]?.value || 0

  // Выручка по годам (для графика)
  const revenueByYear = (byKey.revenue || [])
    .sort((a, b) => a.year - b.year)
    .map(r => ({ year: r.year, value: r.value, source: r.source }))

  // EBITDA по годам
  const ebitdaByYear = (byKey.ebitda || [])
    .sort((a, b) => a.year - b.year)
    .map(r => ({ year: r.year, value: r.value, source: r.source }))

  return {
    revenue: latestRevenue ? latestRevenue.value : 0,
    revenueYear: latestRevenue ? latestRevenue.year : null,
    revenueByYear,
    ebitda: latestEbitda ? latestEbitda.value : 0,
    ebitdaYear: latestEbitda ? latestEbitda.year : null,
    ebitdaByYear,
    totalInvestment,    // тыс. руб.
    fundShare,          // %
    preMoney,           // тыс. руб.
    postMoney,          // тыс. руб.
    trl,
    headcount,
    irr,                // %
    npv,                // тыс. руб.
    salesUnits,
    metrics,            // raw data
    byKey,              // grouped by article key
  }
}

/**
 * Форматирование числа (тыс. руб. → млн ₽)
 */
export function fmtMln(thousRub) {
  if (!thousRub) return '0'
  const mln = thousRub / 1000
  if (Math.abs(mln) >= 1000) return (mln / 1000).toFixed(1) + ' млрд'
  if (Math.abs(mln) >= 1) return mln.toFixed(0) + ' млн'
  return (thousRub).toFixed(0) + ' тыс'
}

/**
 * Форматирование числа кратко
 */
export function fmtNum(val) {
  if (val === null || val === undefined) return '—'
  if (typeof val !== 'number') return String(val)
  if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'М'
  if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(0) + 'К'
  return String(val)
}

export { ARTICLE_MAP }
