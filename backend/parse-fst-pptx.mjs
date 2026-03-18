/**
 * parse-fst-pptx.mjs
 *
 * Парсит презентацию ФСТ НТИ (PPTX) → создаёт/обновляет компании и метрики в Integram.
 *
 * Использование:
 *   node backend/parse-fst-pptx.mjs                          # full run
 *   node backend/parse-fst-pptx.mjs --dry-run                # только показать что создаст
 *   node backend/parse-fst-pptx.mjs --file /path/to/file.pptx  # конкретный файл
 */

import dotenv from 'dotenv'
import { fileURLToPath as ftu } from 'url'
dotenv.config({ path: new URL('./.env', import.meta.url).pathname })
import { createWriteStream, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const DB = 'fst'
// Use local token router (DeepSeek direct key may be out of funds)
const AI_ROUTER_URL = process.env.AI_ROUTER_URL || 'http://localhost:5174/api/ai-tokens/chat'
const AI_MODEL = 'deepseek/deepseek-chat'

// ── Type IDs ──────────────────────────────────────────────────────
const COMPANY_TYPE = 1155
const METRIC_TYPE  = 126255

// Company requisites
const REQ_OGRN        = '2237'
const REQ_AMOUNT      = '2238'  // Запрашиваемая сумма, руб
const REQ_DESCRIPTION = '1158'  // Описание проекта (HTML)
const REQ_SUBFUND     = '1178'  // ref→1082
const REQ_STAGE       = '1180'  // ref→1084
const REQ_STATUS      = '1184'  // ref→1088

// Metric requisites
const REQ_YEAR    = '126257'
const REQ_VALUE   = '126259'
const REQ_SOURCE  = '126262'
const REQ_ARTICLE = '126269'  // ref→125295

// ── Reference values ──────────────────────────────────────────────
const SUBFUND = { 'БАС': 1096, 'РОБО': 1098, 'МЭ': 1100 }
const STAGE = {
  'Pre-seed': 1102, 'Предпосевная': 1102,
  'Seed': 1103, 'Посевная': 1103,
  'Round A': 1104, 'Ранняя': 1104, 'Рост': 1104,
  'Round B': 1105,
  'Round C': 1106,
}
const STATUS = {
  'Новый': 1115,
  'На рассмотрении ИК': 1117, 'На рассмотрении': 1117,
  'Одобрен': 1119,
  'В работе': 1125, 'реализация': 1125,
}
const ARTICLES = {
  revenue:    '126200',
  ebitda:     '126221',
  netProfit:  '126227',
  investment: '126232',
  preMoney:   '136197',
  postMoney:  '136200',
  fundShare:  '136203',
  headcount:  '136206',
  trl:        '136212',
  irr:        '136218',
  npv:        '126238',
}

// ── Auth ──────────────────────────────────────────────────────────
let _token = null
let _xsrf = null

async function authenticate() {
  // JSON auth (no redirect)
  const res = await fetch(`${INTEGRAM_SERVER}/${DB}/auth?JSON_KV`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      login: process.env.INTEGRAM_SYSTEM_USERNAME,
      pwd: process.env.INTEGRAM_SYSTEM_PASSWORD
    })
  })
  const data = await res.json()
  if (data.failed) throw new Error('Auth failed: ' + JSON.stringify(data))
  _token = data.token
  if (!_token) throw new Error('No token in auth response')

  // Get XSRF
  const xRes = await fetch(`${INTEGRAM_SERVER}/${DB}/xsrf?JSON_KV`, {
    headers: { 'X-Authorization': _token }
  })
  if (xRes.ok) {
    const d = await xRes.json()
    _xsrf = d._xsrf || ''
  }
  console.log('[Auth] OK, token:', _token.slice(0, 10) + '...')
}

// ── Integram helpers ──────────────────────────────────────────────

async function fetchExistingCompanies() {
  const url = `${INTEGRAM_SERVER}/${DB}/object/${COMPANY_TYPE}?JSON_KV&l=200&s=0`
  const res = await fetch(url, { headers: { 'X-Authorization': _token } })
  if (!res.ok) throw new Error(`fetchCompanies: ${res.status}`)
  const data = await res.json()
  const objects = data.object || []
  const reqs = data.reqs || {}

  return objects.map(obj => ({
    id: Number(obj.id),
    name: (obj.val || '').trim(),
    reqs: reqs[obj.id] || {}
  }))
}

async function createCompany(name, description, amount, subfundId, stageId, statusId) {
  const params = new URLSearchParams({
    _xsrf: _xsrf,
    [`t${COMPANY_TYPE}`]: name,
    up: '1',
  })
  if (description) params.set(`t${REQ_DESCRIPTION}`, description)
  if (amount) params.set(`t${REQ_AMOUNT}`, String(amount))
  if (subfundId) params.set(`t${REQ_SUBFUND}`, String(subfundId))
  if (stageId) params.set(`t${REQ_STAGE}`, String(stageId))
  if (statusId) params.set(`t${REQ_STATUS}`, String(statusId))

  const res = await fetch(
    `${INTEGRAM_SERVER}/${DB}/_m_new/${COMPANY_TYPE}?full=1&JSON_KV`,
    {
      method: 'POST',
      headers: {
        'X-Authorization': _token,
        Cookie: `${DB}=${_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    }
  )
  const text = await res.text()
  if (!res.ok) {
    console.error(`  ✗ Create company "${name}" failed: ${res.status}`, text.slice(0, 200))
    return null
  }
  try {
    const data = JSON.parse(text)
    return data.id || data.obj || data.object?.[0]?.id
  } catch {
    const m = text.match(/"id"\s*:\s*(\d+)/)
    return m ? Number(m[1]) : null
  }
}

async function updateCompanyReqs(companyId, reqs) {
  for (const [reqId, value] of Object.entries(reqs)) {
    if (value === null || value === undefined) continue
    const params = new URLSearchParams({
      _xsrf: _xsrf,
      obj: String(companyId),
      req: reqId,
      value: String(value),
    })
    await fetch(`${INTEGRAM_SERVER}/${DB}/_m_set?JSON_KV`, {
      method: 'POST',
      headers: {
        'X-Authorization': _token,
        Cookie: `${DB}=${_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })
  }
}

async function createMetric(parentId, year, value, source, articleId) {
  // Step 1: Create the metric object
  const params = new URLSearchParams({
    _xsrf: _xsrf,
    [`t${METRIC_TYPE}`]: `Metric ${year}`,
    [`t${REQ_YEAR}`]: String(year),
    [`t${REQ_VALUE}`]: String(value),
    [`t${REQ_SOURCE}`]: source,
    up: String(parentId),
  })
  const res = await fetch(
    `${INTEGRAM_SERVER}/${DB}/_m_new/${METRIC_TYPE}?full=1&JSON_KV`,
    {
      method: 'POST',
      headers: {
        'X-Authorization': _token,
        Cookie: `${DB}=${_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    }
  )
  if (!res.ok) {
    console.error(`  ✗ Create metric for parent ${parentId} failed: ${res.status}`)
    return false
  }

  // Step 2: Set reference field "Статья" via _m_save (reference fields need _m_save, not _m_new)
  const data = await res.json().catch(() => ({}))
  const metricId = data.id || data.obj || data.object?.[0]?.id
  if (metricId && articleId) {
    const refParams = new URLSearchParams({
      _xsrf: _xsrf,
      [`t${REQ_ARTICLE}`]: String(articleId),
    })
    await fetch(`${INTEGRAM_SERVER}/${DB}/_m_save/${metricId}?JSON_KV`, {
      method: 'POST',
      headers: {
        'X-Authorization': _token,
        Cookie: `${DB}=${_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: refParams,
    })
  }
  return true
}

// ── Dedup: fetch existing metrics for a company ───────────────────
async function fetchExistingMetrics(parentId) {
  const url = `${INTEGRAM_SERVER}/${DB}/object/${METRIC_TYPE}?JSON_KV&F_U=${parentId}&l=200`
  const res = await fetch(url, { headers: { 'X-Authorization': _token } })
  if (!res.ok) return []
  const data = await res.json()
  const objs = data.object || []
  const reqs = data.reqs || {}
  return objs.map(o => {
    const r = reqs[o.id] || {}
    return {
      id: o.id,
      year: r[REQ_YEAR] || '',
      value: r[REQ_VALUE] || '',
      source: r[REQ_SOURCE] || '',
      article: r[REQ_ARTICLE] || r[`ref_${REQ_ARTICLE}`] || '',
    }
  })
}

function metricExists(existing, year, articleId) {
  return existing.some(m =>
    String(m.year) === String(year) &&
    (m.article.includes(String(articleId)) || String(m.article) === String(articleId))
  )
}

// ── PPTX extraction ───────────────────────────────────────────────

async function extractPptxText(filePath) {
  const { default: unzipper } = await import('unzipper')
  const zip = await unzipper.Open.file(filePath)

  const slides = []
  // Sort slides by number
  const slideFiles = zip.files
    .filter(f => f.path.match(/ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const na = Number(a.path.match(/slide(\d+)/)[1])
      const nb = Number(b.path.match(/slide(\d+)/)[1])
      return na - nb
    })

  for (const entry of slideFiles) {
    const content = await entry.buffer()
    const xml = content.toString('utf8')
    const matches = xml.match(/<a:t>([^<]+)<\/a:t>/g) || []
    const text = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ')
    const slideNum = Number(entry.path.match(/slide(\d+)/)[1])
    slides.push({ slideNum, text })
  }
  return slides
}

// ── AI extraction ─────────────────────────────────────────────────

const EXTRACTION_PROMPT = `Ты — аналитик венчурного фонда ФСТ НТИ.
Из текста слайдов презентации извлеки данные о портфельных компаниях и проектах.

Для каждой компании/проекта верни JSON:
{
  "name": "Короткое название (как заголовок слайда)",
  "fullName": "ООО «...» — юрлицо из текста",
  "description": "Описание проекта (2-3 предложения, HTML)",
  "amountFst": числоВРублях (сумма от ФСТ в рублях, НЕ тысячах),
  "budgetTotal": числоВРублях (общий бюджет в рублях),
  "subfund": "БАС" | "РОБО" | "МЭ" | null,
  "stage": "Pre-seed" | "Seed" | "Round A" | "Round B" | null,
  "status": "реализация" | "На рассмотрении" | "Новый",
  "metrics": [
    {"year": 2024, "key": "revenue", "value": числоВТысячахРуб, "source": "факт"|"план"|"оценка"},
    {"year": 2025, "key": "ebitda", "value": числоВТысячахРуб, "source": "план"},
    {"year": 2025, "key": "trl", "value": числоУГТ, "source": "факт"},
    {"year": 2025, "key": "irr", "value": числоПроцентов, "source": "оценка"},
    {"year": 2025, "key": "investment", "value": числоВТысячахРуб, "source": "факт"},
    {"year": 2025, "key": "headcount", "value": числоЧеловек, "source": "факт"}
  ]
}

Правила:
- amountFst и budgetTotal в РУБЛЯХ (не тысячах, не миллионах): 40 млн = 40000000
- metrics.value для revenue/ebitda/investment в ТЫСЯЧАХ РУБЛЕЙ: 28.2 млн = 28200, 1.7 млрд = 1700000
- metrics.value для trl/irr/headcount — прямое число (TRL 5 = 5, IRR 88% = 88, 15 сотрудников = 15)
- Определи субфонд: если БПЛА/дрон/конвертоплан → БАС; если робот → РОБО; если не подходит → МЭ или null
- Определи стадию по тексту (Посевная → Seed, Ранняя/Рост → Round A, Предпосевная → Pre-seed)
- Если статус "реализация" или фактически работают — status: "реализация"
- Если "На рассмотрении" — status: "На рассмотрении"
- Извлеки ВСЕ числовые метрики которые видишь (выручка, EBITDA, IRR, NPV, TRL/УГТ, штат)
- Доступные ключи метрик: revenue, ebitda, netProfit, investment, preMoney, postMoney, fundShare, headcount, trl, irr, npv

Верни JSON массив. Если на слайде нет компании — верни [].`

async function extractCompaniesFromSlides(slides) {
  // Group slides: 2-3 slides per request to stay within limits
  const allCompanies = []
  const batchSize = 4

  for (let i = 0; i < slides.length; i += batchSize) {
    const batch = slides.slice(i, i + batchSize)
    const text = batch.map(s => `--- СЛАЙД ${s.slideNum} ---\n${s.text}`).join('\n\n')

    if (text.length < 100) continue

    console.log(`[AI] Processing slides ${batch[0].slideNum}-${batch[batch.length - 1].slideNum}...`)

    try {
      const res = await fetch(AI_ROUTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: AI_MODEL,
          prompt: text,
          systemPrompt: EXTRACTION_PROMPT,
          application: 'pptx-parser',
          temperature: 0.1,
          maxTokens: 4000
        })
      })

      if (!res.ok) {
        console.warn(`[AI] Router error: ${res.status}`)
        continue
      }

      const data = await res.json()
      const content = data.response || '[]'

      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const companies = JSON.parse(jsonMatch[0])
        allCompanies.push(...companies)
        console.log(`[AI] Found ${companies.length} companies in batch`)
      }
    } catch (err) {
      console.warn(`[AI] Extraction error: ${err.message}`)
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 1000))
  }

  return allCompanies
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const fileIdx = args.indexOf('--file')
  const pptxUrl = 'https://ai2o.ru/download/fst/183e0603ae3/845784e9667.pptx'

  let filePath
  if (fileIdx >= 0) {
    filePath = args[fileIdx + 1]
  } else {
    // Download from Integram
    const tmpDir = join(__dirname, '.tmp-pptx')
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })
    filePath = join(tmpDir, 'fst_nti_march2025.pptx')

    if (!existsSync(filePath)) {
      console.log('[Download] Fetching PPTX from Integram...')
      const res = await fetch(pptxUrl)
      if (!res.ok) throw new Error(`Download failed: ${res.status}`)
      const buffer = Buffer.from(await res.arrayBuffer())
      const { writeFileSync } = await import('fs')
      writeFileSync(filePath, buffer)
      console.log('[Download] OK')
    }
  }

  // Extract slides
  console.log('[PPTX] Extracting text...')
  const slides = await extractPptxText(filePath)
  console.log(`[PPTX] Found ${slides.length} slides`)

  // AI extraction
  console.log('[AI] Extracting companies and metrics...')
  const companies = await extractCompaniesFromSlides(slides)
  console.log(`\n[Result] Found ${companies.length} companies total\n`)

  // Dedup by name
  const seen = new Set()
  const unique = companies.filter(c => {
    const key = (c.name || c.fullName || '').toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  console.log(`[Result] ${unique.length} unique companies after dedup\n`)

  // Projects from slides 17+ are "На рассмотрении ИК" (new pipeline)
  // Known portfolio companies (slides 5-16)
  const portfolioNames = [
    'р-75', 'эколибри', 'экстра синема', 'воронеж', 'рн-слк', 'эра', 'конвертоплан эра',
    'акб', 'инэсис', 'redfab', '3d-печат', 'пак 3d', 'labadvance', 'лабадванс',
    'am.tech', 'ай 3д', 'лазерный модуль', 'смарт фотоникс',
    'кремниевые пластины', 'brainphone', 'брейнфон'
  ]
  for (const c of unique) {
    const nameL = (c.name || '').toLowerCase()
    const isPortfolio = portfolioNames.some(p => nameL.includes(p))
    if (!isPortfolio) {
      c.status = 'На рассмотрении'
      console.log(`  [Override] "${c.name}" → На рассмотрении ИК`)
    }
  }

  if (dryRun) {
    for (const c of unique) {
      console.log(`  📦 ${c.name} (${c.fullName || '?'})`)
      console.log(`     Stage: ${c.stage || '?'}, Status: ${c.status || '?'}, Subfund: ${c.subfund || '?'}`)
      console.log(`     FST: ${c.amountFst ? (c.amountFst / 1e6).toFixed(0) + ' млн' : '?'}, Budget: ${c.budgetTotal ? (c.budgetTotal / 1e6).toFixed(0) + ' млн' : '?'}`)
      if (c.metrics?.length) {
        for (const m of c.metrics) {
          console.log(`     ${m.key} ${m.year}: ${m.value} (${m.source})`)
        }
      }
      console.log()
    }
    console.log('[DRY RUN] No changes made.')
    return
  }

  // Authenticate
  await authenticate()

  // Fetch existing companies to avoid duplicates
  const existing = await fetchExistingCompanies()
  console.log(`[Integram] ${existing.length} existing companies in type ${COMPANY_TYPE}`)

  let created = 0, updated = 0, metricsCreated = 0

  for (const company of unique) {
    const name = company.name || company.fullName || 'Unknown'
    console.log(`\n  → ${name}`)

    // Check if exists
    const match = existing.find(e =>
      e.name.toLowerCase().includes(name.toLowerCase().slice(0, 15)) ||
      name.toLowerCase().includes(e.name.toLowerCase().slice(0, 15))
    )

    let companyId
    if (match) {
      companyId = match.id
      console.log(`    Found existing: #${companyId} "${match.name}"`)

      // Update description and amount if needed
      const updates = {}
      if (company.description) updates[REQ_DESCRIPTION] = company.description
      if (company.amountFst) updates[REQ_AMOUNT] = company.amountFst
      if (company.subfund && SUBFUND[company.subfund]) updates[REQ_SUBFUND] = SUBFUND[company.subfund]
      if (company.stage) {
        const stageId = STAGE[company.stage]
        if (stageId) updates[REQ_STAGE] = stageId
      }
      if (company.status) {
        const statusId = STATUS[company.status]
        if (statusId) updates[REQ_STATUS] = statusId
      }
      if (Object.keys(updates).length > 0) {
        await updateCompanyReqs(companyId, updates)
        console.log(`    Updated ${Object.keys(updates).length} fields`)
        updated++
      }
    } else {
      // Create new company
      const subfundId = company.subfund ? SUBFUND[company.subfund] : null
      const stageId = company.stage ? STAGE[company.stage] : null
      const statusId = company.status ? STATUS[company.status] : STATUS['В работе']

      companyId = await createCompany(
        name,
        company.description || '',
        company.amountFst || 0,
        subfundId,
        stageId,
        statusId
      )

      if (companyId) {
        console.log(`    Created: #${companyId}`)
        created++
      } else {
        console.error(`    ✗ Failed to create "${name}"`)
        continue
      }
    }

    // Create metrics (with dedup check)
    if (company.metrics?.length && companyId) {
      const existingMetrics = await fetchExistingMetrics(companyId)
      for (const m of company.metrics) {
        if (!m.year) continue // skip metrics without year
        const articleId = ARTICLES[m.key]
        if (!articleId) {
          console.warn(`    ? Unknown metric key: ${m.key}`)
          continue
        }
        // Check for duplicate
        if (metricExists(existingMetrics, m.year, articleId)) {
          console.log(`    ~ ${m.key} ${m.year}: already exists, skip`)
          continue
        }
        // Fix NPV values that came in rubles instead of thousands
        let value = m.value
        if (m.key === 'npv' && value > 100000) {
          value = Math.round(value / 1000) // convert from rubles to thousands
        }
        const ok = await createMetric(companyId, m.year, value, m.source || 'оценка', articleId)
        if (ok) {
          metricsCreated++
          console.log(`    + ${m.key} ${m.year}: ${m.value} (${m.source})`)
        }
        await new Promise(r => setTimeout(r, 200)) // rate limit
      }
    }

    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n[Done] Created: ${created}, Updated: ${updated}, Metrics: ${metricsCreated}`)
}

main().catch(err => {
  console.error('[Fatal]', err)
  process.exit(1)
})
