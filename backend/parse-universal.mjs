/**
 * parse-universal.mjs — Универсальный AI-агент парсер файлов
 *
 * Принимает любой файл (PPTX, PDF, XLSX, CSV, DOCX, TXT, JSON, HTML)
 * → извлекает текст → AI находит компании и метрики → сохраняет в Integram.
 *
 * Парсер САМ знает куда грузить: тип 1155 (Компании), тип 126255 (Метрики).
 *
 * Использование:
 *   node backend/parse-universal.mjs --file /path/to/file.xlsx
 *   node backend/parse-universal.mjs --file /path/to/file.pdf --dry-run
 *   node backend/parse-universal.mjs --file /path/to/file.csv --model deepseek/deepseek-chat
 */

import dotenv from 'dotenv'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '.env') })

const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const DB = 'fst'
const AI_ROUTER_URL = process.env.AI_ROUTER_URL || 'http://localhost:5174/api/ai-tokens/chat'
const CLAUDE_SUB_URL = process.env.CLAUDE_SUB_URL || 'http://127.0.0.1:8085/'

// ── CLI args ──────────────────────────────────────────────────────
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const jsonOutput = args.includes('--json')  // machine-readable preview output
const dataIdx = args.indexOf('--data')      // skip AI, use pre-parsed JSON data
const fileIdx = args.indexOf('--file')
const modelIdx = args.indexOf('--model')
const useClaudeSub = args.includes('--claude') || process.env.USE_CLAUDE_SUB === 'true'
const AI_MODEL = modelIdx >= 0 ? args[modelIdx + 1] : 'deepseek/deepseek-chat'

if (fileIdx < 0 || !args[fileIdx + 1]) {
  console.error('Usage: node parse-universal.mjs --file <path> [--dry-run] [--json] [--claude] [--data <json-path>]')
  process.exit(1)
}
const filePath = args[fileIdx + 1]
const fileExt = extname(filePath).toLowerCase().replace('.', '')

// ── Integram Type IDs ─────────────────────────────────────────────
const COMPANY_TYPE = 1155
const METRIC_TYPE  = 126255

// Company requisites
const REQ_DESCRIPTION = '1158'
const REQ_OGRN        = '2237'
const REQ_AMOUNT      = '2238'
const REQ_SUBFUND     = '1178'
const REQ_STAGE       = '1180'
const REQ_STATUS      = '1184'

// Metric requisites
const REQ_YEAR    = '126257'
const REQ_VALUE   = '126259'
const REQ_SOURCE  = '126262'
const REQ_ARTICLE = '126269'

// Reference values
const SUBFUND = { 'БАС': 1096, 'РОБО': 1098, 'МЭ': 1100 }
const STAGE = {
  'Pre-seed': 1102, 'Предпосевная': 1102,
  'Seed': 1103, 'Посевная': 1103,
  'Round A': 1104, 'Ранняя': 1104, 'Рост': 1104,
  'Round B': 1105, 'Round C': 1106,
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

// In JSON mode, all logs go to stderr so stdout is clean JSON
const log = jsonOutput ? (...a) => process.stderr.write(a.join(' ') + '\n') : console.log

// ══════════════════════════════════════════════════════════════════
// STEP 1: Универсальное извлечение текста из файла
// ══════════════════════════════════════════════════════════════════

async function extractText(filePath, ext) {
  const buffer = readFileSync(filePath)
  log(`[Extract] ${filePath} (${ext}, ${(buffer.length / 1024).toFixed(0)} KB)`)

  switch (ext) {
    case 'pptx':
    case 'ppt':
      return await extractPptx(filePath)

    case 'pdf':
      return await extractPdf(buffer)

    case 'xlsx':
    case 'xls':
      return await extractExcel(buffer)

    case 'csv':
      return await extractCsv(buffer)

    case 'docx':
      return await extractDocx(buffer)

    case 'txt':
    case 'md':
    case 'json':
    case 'xml':
    case 'html':
      return buffer.toString('utf8')

    default:
      // Try as plain text
      const text = buffer.toString('utf8')
      if (text.includes('\x00')) throw new Error(`Unsupported binary format: .${ext}`)
      return text
  }
}

async function extractPptx(filePath) {
  const { default: unzipper } = await import('unzipper')
  const zip = await unzipper.Open.file(filePath)
  const slideFiles = zip.files
    .filter(f => f.path.match(/ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const na = Number(a.path.match(/slide(\d+)/)[1])
      const nb = Number(b.path.match(/slide(\d+)/)[1])
      return na - nb
    })

  const parts = []
  for (const entry of slideFiles) {
    const content = await entry.buffer()
    const xml = content.toString('utf8')
    const matches = xml.match(/<a:t>([^<]+)<\/a:t>/g) || []
    const text = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ')
    const slideNum = Number(entry.path.match(/slide(\d+)/)[1])
    parts.push(`[Слайд ${slideNum}] ${text}`)
  }
  log(`[PPTX] Extracted ${parts.length} slides`)
  return parts.join('\n\n')
}

async function extractPdf(buffer) {
  const { createRequire } = await import('module')
  const require = createRequire(import.meta.url)
  const { PDFParse } = require('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  await parser.load()
  const numPages = parser.doc?.numPages || 0
  const parts = []
  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await parser.doc.getPage(i)
      const tc = await page.getTextContent()
      const text = tc.items.map(item => item.str).join(' ')
      if (text.trim()) parts.push(text)
    } catch {}
  }
  const text = parts.join('\n')
  log(`[PDF] Extracted ${numPages} pages, ${text.length} chars`)
  return text
}

async function extractExcel(buffer) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const parts = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    // Convert to array of arrays for structured output
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    if (rows.length === 0) continue

    parts.push(`=== Лист: ${sheetName} ===`)

    // Find header row (first non-empty)
    const headerIdx = rows.findIndex(r => r.some(c => c !== ''))
    if (headerIdx < 0) continue

    const headers = rows[headerIdx].map(h => String(h).trim())
    parts.push(`Колонки: ${headers.join(' | ')}`)

    // Data rows
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i]
      if (row.every(c => c === '' || c === null || c === undefined)) continue
      const cells = row.map((c, j) => `${headers[j] || `Col${j}`}: ${c}`)
      parts.push(cells.join(' | '))
    }
    parts.push('')
  }

  log(`[Excel] Extracted ${workbook.SheetNames.length} sheets`)
  return parts.join('\n')
}

async function extractCsv(buffer) {
  const text = buffer.toString('utf8')
  // Auto-detect delimiter
  const firstLine = text.split('\n')[0] || ''
  const delimiter = firstLine.includes('\t') ? '\t'
    : firstLine.includes(';') ? ';'
    : ','

  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length === 0) return ''

  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''))
  const parts = [`Колонки: ${headers.join(' | ')}`]

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''))
    const row = cells.map((c, j) => `${headers[j] || `Col${j}`}: ${c}`)
    parts.push(row.join(' | '))
  }

  log(`[CSV] Extracted ${lines.length - 1} rows, delimiter="${delimiter}"`)
  return parts.join('\n')
}

async function extractDocx(buffer) {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  log(`[DOCX] Extracted ${result.value.length} chars`)
  return result.value
}

// ══════════════════════════════════════════════════════════════════
// STEP 2: AI извлечение компаний — универсальный промпт
// ══════════════════════════════════════════════════════════════════

const EXTRACTION_PROMPT = `Ты — аналитик венчурного фонда. Твоя задача — извлечь данные о компаниях/проектах/стартапах из любого формата данных (таблица, презентация, текст, отчёт).

Для КАЖДОЙ найденной компании/проекта верни JSON объект:
{
  "name": "Короткое название (как заголовок, без ООО/ЗАО)",
  "fullName": "ООО «...» — юрлицо, если есть в тексте",
  "inn": "ИНН, если есть",
  "description": "Описание проекта (2-3 предложения, plain text)",
  "amountFst": числоВРублях или null,
  "budgetTotal": числоВРублях или null,
  "subfund": "БАС" | "РОБО" | "МЭ" | null,
  "stage": "Pre-seed" | "Seed" | "Round A" | "Round B" | null,
  "status": "реализация" | "На рассмотрении" | "Новый",
  "metrics": [
    {"year": 2024, "key": "revenue", "value": числоВТысячахРуб, "source": "факт"|"план"|"оценка"}
  ]
}

ПРАВИЛА ИЗВЛЕЧЕНИЯ:
1. amountFst, budgetTotal — всегда в РУБЛЯХ: 40 млн = 40000000
2. Метрики revenue/ebitda/netProfit/investment/preMoney/postMoney — в ТЫСЯЧАХ рублей: 28.2 млн = 28200
3. Метрики trl/irr/npv/headcount/fundShare — прямые числа: TRL 5 = 5, IRR 88% = 88
4. Определи субфонд: БПЛА/дрон/конвертоплан → БАС; робот → РОБО; иное → МЭ или null
5. Определи стадию: Посевная → Seed, Ранняя/Рост → Round A, Предпосевная → Pre-seed
6. Извлеки ВСЕ числовые метрики (выручка, EBITDA, IRR, NPV, TRL, штат, инвестиции)
7. Если в таблице есть колонки с годами — каждый год = отдельная метрика
8. Если компания явно действующая — status: "реализация"; если новая заявка — "На рассмотрении"

Доступные ключи метрик: revenue, ebitda, netProfit, investment, preMoney, postMoney, fundShare, headcount, trl, irr, npv

ФОРМАТ ОТВЕТА: JSON массив объектов. Если компаний нет — верни [].
Никакого текста кроме JSON. Без markdown-обрамления.`

// ── AI call via claude-sub-proxy (SSE → collect text) ─────────────
async function callClaudeSub(prompt, systemPrompt) {
  const res = await fetch(CLAUDE_SUB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: prompt,
      systemPrompt,
      model: 'sonnet',
      noMcp: true,
    })
  })
  if (!res.ok) throw new Error(`claude-sub error: ${res.status}`)

  // SSE stream → collect all text chunks
  // claude-sub-proxy format: data: {"type":"content","content":"..."}
  const body = await res.text()
  let fullText = ''
  for (const line of body.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6).trim()
    if (payload === '[DONE]') break
    try {
      const evt = JSON.parse(payload)
      // claude-sub-proxy format
      if (evt.type === 'content' && evt.content) {
        fullText += evt.content
      }
      // Anthropic API format (fallback)
      if (evt.type === 'content_block_delta' && evt.delta?.text) {
        fullText += evt.delta.text
      }
      if (evt.result) fullText = evt.result
    } catch {}
  }
  return fullText
}

// ── AI call via token router (JSON response) ─────────────────────
async function callRouter(prompt, systemPrompt) {
  const res = await fetch(AI_ROUTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId: AI_MODEL,
      prompt,
      systemPrompt,
      application: 'universal-parser',
      temperature: 0.1,
      maxTokens: 4000
    })
  })
  if (!res.ok) throw new Error(`router error: ${res.status}`)
  const data = await res.json()
  return data.response || '[]'
}

async function extractCompaniesWithAI(text) {
  const aiBackend = useClaudeSub ? 'claude-sub' : 'ai-router'
  log(`[AI] Backend: ${aiBackend}`)

  // Split into chunks of ~8000 chars for AI processing
  const maxChunk = useClaudeSub ? 6000 : 8000 // claude-sub via CLI arg — keep short to avoid hanging
  const allCompanies = []

  // Intelligent chunking: try to split on section boundaries
  const chunks = []
  if (text.length <= maxChunk) {
    chunks.push(text)
  } else {
    let remaining = text
    while (remaining.length > 0) {
      if (remaining.length <= maxChunk) {
        chunks.push(remaining)
        break
      }
      let breakAt = maxChunk
      const breakPoints = ['\n\n', '\n===', '\n[Слайд', '\n---']
      for (const bp of breakPoints) {
        const idx = remaining.lastIndexOf(bp, maxChunk)
        if (idx > maxChunk * 0.5) { breakAt = idx; break }
      }
      chunks.push(remaining.slice(0, breakAt))
      remaining = remaining.slice(breakAt)
    }
  }

  log(`[AI] Processing ${chunks.length} chunks (total ${text.length} chars)...`)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    if (chunk.trim().length < 50) continue

    log(`[AI] Chunk ${i + 1}/${chunks.length} (${chunk.length} chars)...`)

    try {
      const content = useClaudeSub
        ? await callClaudeSub(chunk, EXTRACTION_PROMPT)
        : await callRouter(chunk, EXTRACTION_PROMPT)

      // Extract JSON array from response (might have markdown wrapping)
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '')
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const companies = JSON.parse(jsonMatch[0])
        if (Array.isArray(companies)) {
          allCompanies.push(...companies)
          log(`[AI] → ${companies.length} companies found`)
        }
      }
    } catch (err) {
      console.warn(`[AI] Chunk ${i + 1} error: ${err.message}`)
    }

    // Rate limit between chunks
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  return allCompanies
}

// ══════════════════════════════════════════════════════════════════
// STEP 3: Integram — авторизация и CRUD
// ══════════════════════════════════════════════════════════════════

let _token = null
let _xsrf = null

async function authenticate() {
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

  const xRes = await fetch(`${INTEGRAM_SERVER}/${DB}/xsrf?JSON_KV`, {
    headers: { 'X-Authorization': _token }
  })
  if (xRes.ok) {
    const d = await xRes.json()
    _xsrf = d._xsrf || ''
  }
  log('[Auth] OK')
}

async function fetchExistingCompanies() {
  const url = `${INTEGRAM_SERVER}/${DB}/object/${COMPANY_TYPE}?JSON_KV&l=500&s=0`
  const res = await fetch(url, { headers: { 'X-Authorization': _token } })
  if (!res.ok) throw new Error(`fetchCompanies: ${res.status}`)
  const data = await res.json()
  return (data.object || []).map(obj => ({
    id: Number(obj.id),
    name: (obj.val || '').trim(),
    reqs: (data.reqs || {})[obj.id] || {}
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

  const res = await fetch(`${INTEGRAM_SERVER}/${DB}/_m_new/${COMPANY_TYPE}?full=1&JSON_KV`, {
    method: 'POST',
    headers: {
      'X-Authorization': _token,
      Cookie: `${DB}=${_token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`  ✗ Create "${name}" failed: ${res.status}`)
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
  const params = new URLSearchParams({
    _xsrf: _xsrf,
    [`t${METRIC_TYPE}`]: `Metric ${year}`,
    [`t${REQ_YEAR}`]: String(year),
    [`t${REQ_VALUE}`]: String(value),
    [`t${REQ_SOURCE}`]: source,
    up: String(parentId),
  })
  const res = await fetch(`${INTEGRAM_SERVER}/${DB}/_m_new/${METRIC_TYPE}?full=1&JSON_KV`, {
    method: 'POST',
    headers: {
      'X-Authorization': _token,
      Cookie: `${DB}=${_token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  if (!res.ok) {
    console.error(`  ✗ Metric for parent ${parentId} failed: ${res.status}`)
    return false
  }

  // Set article reference via _m_save
  const data = await res.json().catch(() => ({}))
  const metricId = data.id || data.obj || data.object?.[0]?.id
  if (metricId && articleId) {
    await fetch(`${INTEGRAM_SERVER}/${DB}/_m_save/${metricId}?JSON_KV`, {
      method: 'POST',
      headers: {
        'X-Authorization': _token,
        Cookie: `${DB}=${_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ _xsrf: _xsrf, [`t${REQ_ARTICLE}`]: String(articleId) }),
    })
  }
  return true
}

async function fetchExistingMetrics(parentId) {
  const url = `${INTEGRAM_SERVER}/${DB}/object/${METRIC_TYPE}?JSON_KV&F_U=${parentId}&l=200`
  const res = await fetch(url, { headers: { 'X-Authorization': _token } })
  if (!res.ok) return []
  const data = await res.json()
  return (data.object || []).map(o => {
    const r = (data.reqs || {})[o.id] || {}
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

// ══════════════════════════════════════════════════════════════════
// STEP 4: Main — собираем pipeline
// ══════════════════════════════════════════════════════════════════

// ── Validate extracted company data ───────────────────────────────
function validateCompany(c) {
  const warnings = []
  if (!c.name && !c.fullName) warnings.push('Нет названия')
  if (!c.stage) warnings.push('Не определена стадия')
  if (!c.subfund) warnings.push('Не определён субфонд')
  if (!c.amountFst && !c.budgetTotal) warnings.push('Нет суммы финансирования')
  if (c.amountFst && c.amountFst > 10e9) warnings.push('Сумма > 10 млрд — проверьте')
  if (c.amountFst && c.amountFst < 100000) warnings.push('Сумма < 100K — возможно ошибка единиц')
  if (!c.metrics?.length) warnings.push('Нет метрик')
  if (!c.description) warnings.push('Нет описания')
  return warnings
}

async function main() {
  if (!existsSync(filePath)) {
    console.error(`[Error] File not found: ${filePath}`)
    process.exit(1)
  }

  let unique

  // Mode 1: --data <json-path> — skip AI, use pre-parsed data (for confirm step)
  if (dataIdx >= 0 && args[dataIdx + 1]) {
    const dataPath = args[dataIdx + 1]
    unique = JSON.parse(readFileSync(dataPath, 'utf8'))
    if (!jsonOutput) log(`[Data] Loaded ${unique.length} companies from ${dataPath}`)
  } else {
    // Mode 2: Normal — extract text → AI → companies
    if (!jsonOutput) {
      log(`\n${'═'.repeat(60)}`)
      log(`  Universal Parser — ${filePath}`)
      log(`  Format: .${fileExt} | AI: ${useClaudeSub ? 'Claude (subscription)' : AI_MODEL} | Dry-run: ${dryRun}`)
      log(`${'═'.repeat(60)}\n`)
    }

    const rawText = await extractText(filePath, fileExt)
    if (!rawText || rawText.trim().length < 20) {
      if (jsonOutput) { console.log(JSON.stringify({ error: 'No text extracted', companies: [] })); return }
      console.error('[Error] No meaningful text extracted from file')
      process.exit(1)
    }

    const text = rawText.slice(0, 50000)
    if (!jsonOutput) log(`[Text] ${text.length} chars ready for AI\n`)

    // AI extraction
    const companies = await extractCompaniesWithAI(text)
    if (!jsonOutput) log(`\n[Result] Found ${companies.length} companies total`)

    // Dedup by name
    const seen = new Set()
    unique = companies.filter(c => {
      const key = (c.name || c.fullName || '').toLowerCase().trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (!jsonOutput) log(`[Result] ${unique.length} unique after dedup\n`)
  }

  if (!unique || unique.length === 0) {
    if (jsonOutput) { console.log(JSON.stringify({ error: null, companies: [], totalMetrics: 0 })); return }
    console.log('Created: 0\nUpdated: 0\nMetrics: 0\nCompanies: ')
    return
  }

  // Validate each company
  for (const c of unique) {
    c._warnings = validateCompany(c)
    c._metricsCount = c.metrics?.length || 0
    c._status = c._warnings.length === 0 ? 'ok' : (c._warnings.some(w => w.includes('Нет названия')) ? 'error' : 'warning')
  }

  // JSON preview mode — output structured data for frontend
  if (jsonOutput) {
    const preview = unique.map(c => ({
      name: c.name || c.fullName || '?',
      fullName: c.fullName || null,
      inn: c.inn || null,
      description: (c.description || '').slice(0, 200),
      amountFst: c.amountFst || null,
      amountDisplay: c.amountFst ? (c.amountFst / 1e6).toFixed(1) + ' млн' : null,
      budgetTotal: c.budgetTotal || null,
      stage: c.stage || null,
      subfund: c.subfund || null,
      status: c.status || 'На рассмотрении',
      metricsCount: c._metricsCount,
      metrics: c.metrics || [],
      warnings: c._warnings,
      validationStatus: c._status,
    }))
    console.log(JSON.stringify({
      error: null,
      companies: preview,
      totalMetrics: preview.reduce((s, c) => s + c.metricsCount, 0),
      totalWarnings: preview.filter(c => c._status === 'warning').length,
      totalErrors: preview.filter(c => c._status === 'error').length,
    }))
    return
  }

  // Dry-run output (human-readable)
  if (dryRun) {
    for (const c of unique) {
      const icon = c._status === 'ok' ? '✅' : c._status === 'warning' ? '⚠️' : '❌'
      log(`  ${icon} ${c.name} (${c.fullName || '?'})`)
      log(`     Stage: ${c.stage || '?'}, Status: ${c.status || '?'}, Subfund: ${c.subfund || '?'}`)
      log(`     FST: ${c.amountFst ? (c.amountFst / 1e6).toFixed(1) + ' млн' : '?'}, Metrics: ${c._metricsCount}`)
      if (c._warnings.length) log(`     ⚠ ${c._warnings.join('; ')}`)
      log()
    }
    log('[DRY RUN] No changes made.')
    console.log(`Created: 0\nUpdated: 0\nMetrics: 0`)
    console.log(`Companies: ${unique.map(c => c.name).join(', ')}`)
    return
  }

  // Step 3: Save to Integram
  await authenticate()
  const existing = await fetchExistingCompanies()
  log(`[Integram] ${existing.length} existing companies\n`)

  let created = 0, updated = 0, metricsCreated = 0
  const companyNames = []

  for (const company of unique) {
    const name = company.name || company.fullName || 'Unknown'
    companyNames.push(name)
    log(`\n  → ${name}`)

    // Find match (fuzzy by first 15 chars)
    const nameLower = name.toLowerCase()
    const match = existing.find(e => {
      const eName = e.name.toLowerCase()
      return eName.includes(nameLower.slice(0, 15)) || nameLower.includes(eName.slice(0, 15))
    })

    let companyId
    if (match) {
      companyId = match.id
      log(`    Existing: #${companyId} "${match.name}"`)

      const updates = {}
      if (company.description) updates[REQ_DESCRIPTION] = company.description
      if (company.amountFst) updates[REQ_AMOUNT] = company.amountFst
      if (company.subfund && SUBFUND[company.subfund]) updates[REQ_SUBFUND] = SUBFUND[company.subfund]
      if (company.stage && STAGE[company.stage]) updates[REQ_STAGE] = STAGE[company.stage]
      if (company.status && STATUS[company.status]) updates[REQ_STATUS] = STATUS[company.status]

      if (Object.keys(updates).length > 0) {
        await updateCompanyReqs(companyId, updates)
        log(`    Updated ${Object.keys(updates).length} fields`)
        updated++
      }
    } else {
      // Create new
      const subfundId = company.subfund ? SUBFUND[company.subfund] : null
      const stageId = company.stage ? STAGE[company.stage] : null
      const statusId = company.status ? STATUS[company.status] : STATUS['На рассмотрении']

      companyId = await createCompany(
        name,
        company.description || '',
        company.amountFst || 0,
        subfundId, stageId, statusId
      )

      if (companyId) {
        console.log(`    Created: #${companyId}`)
        created++
      } else {
        console.error(`    ✗ Failed to create "${name}"`)
        continue
      }
    }

    // Create metrics (with dedup)
    if (company.metrics?.length && companyId) {
      const existingMetrics = await fetchExistingMetrics(companyId)
      for (const m of company.metrics) {
        if (!m.year || !m.key) continue
        const articleId = ARTICLES[m.key]
        if (!articleId) {
          console.warn(`    ? Unknown metric: ${m.key}`)
          continue
        }
        if (metricExists(existingMetrics, m.year, articleId)) {
          log(`    ~ ${m.key} ${m.year}: exists, skip`)
          continue
        }
        let value = m.value
        if (m.key === 'npv' && value > 100000) value = Math.round(value / 1000)

        const ok = await createMetric(companyId, m.year, value, m.source || 'оценка', articleId)
        if (ok) {
          metricsCreated++
          log(`    + ${m.key} ${m.year}: ${value} (${m.source || 'оценка'})`)
        }
        await new Promise(r => setTimeout(r, 200))
      }
    }

    await new Promise(r => setTimeout(r, 300))
  }

  // Final output (captured by backend)
  log(`\n${'═'.repeat(60)}`)
  console.log(`Created: ${created}`)
  console.log(`Updated: ${updated}`)
  console.log(`Metrics: ${metricsCreated}`)
  console.log(`Companies: ${companyNames.join(', ')}`)
}

main().catch(err => {
  console.error('[Fatal]', err)
  process.exit(1)
})
