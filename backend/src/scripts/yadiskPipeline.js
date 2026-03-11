/**
 * yadiskPipeline.js — Palantir-style document intelligence pipeline
 *
 * Яндекс.Диск → classify by filename → download high-value docs →
 * extract text → DeepSeek → events in type 2451 + profile update type 1155
 *
 * Run: node src/scripts/yadiskPipeline.js [--dry-run] [--project "Антей"]
 */

import fetch from 'node-fetch'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { readFile, writeFile, unlink } from 'fs/promises'
import { join, extname, basename } from 'path'
import { pipeline } from 'stream/promises'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

// ── Config ─────────────────────────────────────────────────────────────────

const YADISK_PUBLIC = 'https://disk.yandex.ru/d/VTw8mbVspwiFPw'
const YADISK_API    = 'https://cloud-api.yandex.net/v1/disk/public/resources'

const INTEGRAM_URL  = process.env.INTEGRAM_SERVER_URL || 'https://api.ai2o.ru'
const INTEGRAM_DB   = 'fst'
const INTEGRAM_USER = process.env.INTEGRAM_SYSTEM_USERNAME
const INTEGRAM_PASS = process.env.INTEGRAM_SYSTEM_PASSWORD

const DEEPSEEK_KEY  = process.env.DEEPSEEK_API_KEY
const AI_BASE       = process.env.BACKEND_URL || `http://localhost:${process.env.FST_API_PORT || 8084}`

const TMP_DIR       = '/tmp/yadisk-pipeline'
const DRY_RUN       = process.argv.includes('--dry-run')
const RERUN         = process.argv.includes('--rerun')   // delete actor events before processing
const COLLECT_ONLY  = process.argv.includes('--collect-only') // download+AI but skip Integram writes
const PROJECT_FILTER= (() => {
  const idx = process.argv.indexOf('--project')
  return idx >= 0 ? process.argv[idx + 1] : null
})()
const MAX_FILE_SIZE = 30 * 1024 * 1024  // 30MB — skip larger files
const MIN_SCORE     = 3                  // skip docs with score < this

// Integram type IDs
const TYPE_EVENTS   = 2451
const TYPE_PROJECTS = 1155
const TYPE_ACTORS   = 2406

// Event type IDs in type 3042 (confirmed via get_object_edit_data add_obj_ref_reqs)
const EVTYPE = {
  'Регуляторное':    3049,
  'Рыночное':        3050,
  'Технологическое': 3051,
  'Финансовое':      3052,
}

// Company-specific actor IDs (type 2406); confirmed via get_object_edit_data for event 60060
// These exist in Integram but don't appear in object/2406 listing (pagination quirk)
const COMPANY_ACTOR_MAP = {
  'эколибри':       64418,
  'экстрасинема':   64420,
  '3д исследован':  64422,
  'эрааэро':        64424,
  'инэсис':         64426,
}

function matchActorByFolder(folderName) {
  const fn = folderName.toLowerCase()
  for (const [kw, id] of Object.entries(COMPANY_ACTOR_MAP)) {
    if (fn.includes(kw)) return id
  }
  return 2484  // fallback: Портфельная компания БПЛА
}

// ── Document classifier (no AI, by filename) ────────────────────────────────

const CLASSIFIERS = [
  { score: 5, type: 'DESCRIPTION',  patterns: ['описание_проекта', 'описание проекта', 'описание_свр', 'описание_свл', 'project description', 'пз_пк'] },
  { score: 5, type: 'DD_REPORT',    patterns: ['отчёт dd', 'отчет dd', 'dd_отчёт', 'отчёт_dd', 'due diligence'] },
  { score: 4, type: 'EXPERT',       patterns: ['экспертиза', 'экспертная оценка', 'expert', 'оценка_долей'] },
  { score: 4, type: 'IC_PROTOCOL',  patterns: ['протокол ик', 'протокол_ик', 'протокол пк', 'протокол_пк', 'выписка_пк', 'выписка пк'] },
  { score: 3, type: 'STATUS',       patterns: ['статус', 'отчёт о ходе', 'отчет о ходе', 'прогресс', 'ход реализации'] },
  { score: 3, type: 'ZAPROS',       patterns: ['запрос на изменение', 'запрос на корр'] },
  { score: 2, type: 'PAYMENT',      patterns: ['пп №', 'пп№', 'банк.ордер', 'банковский ордер', 'платёж', 'платежное'] },
  { score: 2, type: 'AGREEMENT',    patterns: ['договор', 'соглашение', 'корпоративный_договор', 'уведомление о вкладе'] },
  { score: 1, type: 'SKIP',         patterns: ['debug.log', '.tmp', 'thumb', 'icon', '.ds_store'] },
]

function classifyDoc(filename) {
  const lower = filename.toLowerCase()
  const ext   = extname(lower)

  if (['.xls', '.xlsx'].includes(ext)) return { score: 4, type: 'FINMODEL' }
  if (['.pptx', '.ppt'].includes(ext)) return { score: 4, type: 'PITCH' }
  if (!['.pdf', '.docx', '.doc'].includes(ext)) return { score: 0, type: 'SKIP' }

  for (const cls of CLASSIFIERS) {
    if (cls.patterns.some(p => lower.includes(p))) {
      return { score: cls.score, type: cls.type }
    }
  }
  return { score: 3, type: 'UNKNOWN' }  // unknown PDFs — process them, might be useful
}

// ── Yandex.Disk API ─────────────────────────────────────────────────────────

async function yadiskList(path = '/', limit = 200) {
  const url = new URL(YADISK_API)
  url.searchParams.set('public_key', YADISK_PUBLIC)
  url.searchParams.set('path', path)
  url.searchParams.set('limit', limit)
  url.searchParams.set('fields', '_embedded.items.name,_embedded.items.type,_embedded.items.path,_embedded.items.size,_embedded.items.file,_embedded.total')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`yadisk list ${path}: ${res.status}`)
  return res.json()
}

async function yadiskDownloadUrl(path) {
  const url = new URL(`${YADISK_API}/download`)
  url.searchParams.set('public_key', YADISK_PUBLIC)
  url.searchParams.set('path', path)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`yadisk download url ${path}: ${res.status}`)
  const data = await res.json()
  return data.href
}

async function downloadFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${url}: ${res.status}`)
  await pipeline(res.body, createWriteStream(destPath))
}

// ── Recursive file walk ─────────────────────────────────────────────────────

async function walkFolder(path, depth = 0) {
  const data   = await yadiskList(path)
  const items  = data._embedded?.items || []
  const result = []

  for (const item of items) {
    if (item.type === 'dir' && depth < 3) {
      const sub = await walkFolder(item.path, depth + 1)
      result.push(...sub)
    } else if (item.type === 'file') {
      result.push(item)
    }
  }
  return result
}

// ── Text extraction ─────────────────────────────────────────────────────────

async function extractText(filePath) {
  const ext = extname(filePath).toLowerCase()

  if (ext === '.pdf') {
    const { PDFParse } = await import('pdf-parse')
    try {
      const fileUrl = `file://${filePath}`
      const parser = new PDFParse({ url: fileUrl })
      const result = await parser.getText({ maxPageCount: 15 })
      const text = result?.text || (Array.isArray(result) ? result.map(p => p.text || '').join('\n') : '')
      return text.slice(0, 12000)
    } catch (e) {
      process.stderr.write(`pdf-parse error: ${e.message}\n`)
      return ''
    }
  }

  if (['.docx', '.doc'].includes(ext)) {
    try {
      const { default: mammoth } = await import('mammoth')
      const result = await mammoth.extractRawText({ path: filePath })
      return result.value?.slice(0, 12000) || ''
    } catch { return '' }
  }

  if (['.xlsx', '.xls'].includes(ext)) {
    // For Excel — just return file name, AI can't parse binary directly
    return `[Финансовая модель Excel: ${basename(filePath)}]`
  }

  return ''
}

// ── AI calls ────────────────────────────────────────────────────────────────

async function callAI(prompt, systemPrompt) {
  // Use YandexGPT directly (DeepSeek balance exhausted)
  const folderId = process.env.YANDEX_FOLDER_ID
  const apiKey   = process.env.YANDEX_API_KEY
  if (!folderId || !apiKey) throw new Error('YANDEX_FOLDER_ID / YANDEX_API_KEY not set')

  const messages = []
  if (systemPrompt) messages.push({ role: 'system', text: systemPrompt })
  messages.push({ role: 'user', text: prompt })

  const res = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Api-Key ${apiKey}`,
    },
    body: JSON.stringify({
      modelUri:          `gpt://${folderId}/yandexgpt/latest`,
      completionOptions: { stream: false, temperature: 0.2, maxTokens: 4000 },
      messages,
    }),
    signal: AbortSignal.timeout(90000),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`YandexGPT error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.result?.alternatives?.[0]?.message?.text || ''
}

// ── Prompts ─────────────────────────────────────────────────────────────────

const SYSTEM_EXTRACTOR = `Ты — аналитик венчурного фонда ФСТ НТИ. Извлекаешь структурированные данные из документов проектов.
Отвечай ТОЛЬКО валидным JSON. Никакого текста до или после JSON.`

function promptClassify(filename, preview) {
  return `Документ: "${filename}"
Первые 300 символов: ${preview}

Оцени ценность документа для венчурного анализа (1-5) и назови тип.
JSON: {"score": N, "type": "DESCRIPTION|DD_REPORT|IC_PROTOCOL|PAYMENT|FINMODEL|PITCH|STATUS|OTHER", "reason": "..."}`
}

function promptExtractFull(company, docType, text) {
  return `Компания: ${company}
Тип документа: ${docType}
Текст документа:
---
${text}
---

Извлеки данные в формате:

{
  "company_profile": {
    "description": "краткое описание проекта (2-3 предложения)",
    "sector": "отрасль",
    "trl": null,
    "revenue_mln": null,
    "headcount": null,
    "market_size_bln": null,
    "key_customers": [],
    "ip_count": null,
    "runway_months": null,
    "stage": null,
    "strengths": [],
    "risks": []
  },
  "events": [
    {
      "type": "Финансовое|Технологическое|Рыночное|Регуляторное",
      "date": "YYYY-MM-DD или YYYY-MM или YYYY (или null если не указана)",
      "description": "краткое описание события (1 предложение)",
      "amount_mln": null,
      "delta_trl": null,
      "probability": 0.9,
      "magnitude": 5,
      "source": "${docType}"
    }
  ]
}

Правила:
- events: только реальные события (не планы, не прогнозы). Если не найдено — пустой массив.
- probability: уверенность в факте события (0.5–1.0)
- magnitude: важность события для компании (1–10)
- delta_trl: изменение TRL (например, 1 если TRL вырос на 1 уровень), иначе null
- amount_mln: сумма в млн руб если финансовое событие, иначе null
- company_profile: заполни только то, что явно указано в тексте. null = не найдено.`
}

function promptExtractPayment(company, text) {
  return `Компания: ${company}
Платёжный документ:
---
${text.slice(0, 3000)}
---

Извлеки:
{
  "events": [
    {
      "type": "Финансовое",
      "date": "YYYY-MM-DD",
      "description": "краткое описание платежа",
      "amount_mln": null,
      "probability": 0.99,
      "magnitude": 6,
      "source": "PAYMENT"
    }
  ]
}`
}

// ── Parse AI JSON response ───────────────────────────────────────────────────

function parseJSON(text) {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}

// ── Integram helpers ─────────────────────────────────────────────────────────

async function fetchAllObjects(typeId) {
  const all = []; const allReqs = {}; const seen = new Set()
  let offset = 0; let total = Infinity
  while (offset < total) {
    const res = await fetch(
      `${INTEGRAM_URL}/${INTEGRAM_DB}/object/${typeId}?JSON_KV&l=20&s=${offset}`,
      { headers: { 'X-Authorization': _token } }
    )
    if (!res.ok) throw new Error(`fetchAll ${typeId}: ${res.status}`)
    const data = await res.json()
    const items = data.object || []
    if (data.total !== undefined) total = Number(data.total)
    if (items.length === 0) break
    let newCount = 0
    for (const item of items) {
      if (seen.has(item.id)) continue
      seen.add(item.id); all.push(item); newCount++
    }
    Object.assign(allReqs, data.reqs || {})
    if (newCount === 0) break  // all items already seen — stop pagination
    offset += items.length
  }
  return { objects: all, reqs: allReqs }
}

// ── Integram auth ───────────────────────────────────────────────────────────

let _token = null
let _xsrf  = null

async function authenticate() {
  const res = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/auth`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ login: INTEGRAM_USER, pwd: INTEGRAM_PASS })
  })
  const cookie = res.headers.get('set-cookie') || ''
  const m = cookie.match(new RegExp(`${INTEGRAM_DB}=([^;]+)`))
  if (!m) throw new Error('Integram auth: no token in Set-Cookie')
  _token = m[1]

  const xr = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/xsrf`, {
    headers: { 'X-Authorization': _token }
  })
  const xd = await xr.json()
  _xsrf = xd._xsrf
}

async function integramPost(path, body) {
  body.set('_xsrf', _xsrf)
  const res = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/${path}?JSON_KV`, {
    method: 'POST',
    headers: { 'X-Authorization': _token },
    body
  })
  return res.json()
}

async function integramDelete(id) {
  const body = new URLSearchParams({ _xsrf, del: '1' })
  const res = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/_m_del/${id}?JSON_KV`, {
    method: 'POST',
    headers: { 'X-Authorization': _token },
    body
  })
  return res.json()
}

// ── Write to Integram ────────────────────────────────────────────────────────

async function createEvent(actorId, ev) {
  const body = new URLSearchParams()
  body.set(`t${TYPE_EVENTS}`, ev.description || 'Событие')
  if (ev.date)        body.set('t2458', ev.date)
  if (ev.description) body.set('t2460', ev.description)
  if (ev.source)      body.set('t2461', ev.source)
  // Quantitative fields
  if (ev.probability != null) body.set('t61928', String(ev.probability))
  if (ev.delta_trl   != null) body.set('t61929', String(ev.delta_trl))
  if (ev.amount_mln  != null) body.set('t61930', String(ev.amount_mln))
  if (ev.magnitude   != null) body.set('t61931', String(ev.magnitude))
  // Type and actor — use r* (reference) params so Integram creates proper ref links
  // t* would store the ID as plain text, which doesn't appear in JSON_KV ref_* fields
  const evTypeId = EVTYPE[ev.type]
  if (evTypeId)  body.set('r3044', String(evTypeId))
  if (actorId)   body.set('r3007', String(actorId))
  body.set('up', '1')

  return integramPost(`_m_new/${TYPE_EVENTS}`, body)
}

async function updateProjectProfile(projectId, profile, existingDesc) {
  // Merge new profile into existing FST_FULL_APPLICATION JSON blob
  let fullApp = {}
  const m = (existingDesc || '').match(/<!--FST_FULL_APPLICATION:([\s\S]*?)-->/)
  if (m) try { fullApp = JSON.parse(m[1]) } catch {}

  // Merge non-null values
  for (const [k, v] of Object.entries(profile)) {
    if (v !== null && v !== undefined && v !== '') fullApp[k] = v
  }

  // Reconstruct description
  let newDesc = (existingDesc || '').replace(/<!--FST_FULL_APPLICATION:[\s\S]*?-->/, '')
  newDesc += `\n<!--FST_FULL_APPLICATION:${JSON.stringify(fullApp)}-->`

  const body = new URLSearchParams()
  body.set('t1158', newDesc)
  return integramPost(`_m_set/${projectId}`, body)
}

// ── Project matching ─────────────────────────────────────────────────────────

function matchProject(folderName, projects) {
  const fn = folderName.toLowerCase()
  let best = null
  let bestScore = 0

  for (const p of projects) {
    const pn = (p.name || '').toLowerCase()
    // Extract keywords from folder name
    const folderWords = fn.split(/[\s_\-\.]+/).filter(w => w.length > 3)
    const nameWords   = pn.split(/[\s_\-\.]+/).filter(w => w.length > 3)
    const hits = folderWords.filter(w => nameWords.some(nw => nw.includes(w) || w.includes(nw))).length
    if (hits > bestScore) { bestScore = hits; best = p }
  }
  return bestScore >= 1 ? best : null
}

// ── Main pipeline ────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })

  console.log('=== Yadisk Pipeline ===')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : COLLECT_ONLY ? 'COLLECT ONLY (no Integram writes)' : 'LIVE'}`)
  if (PROJECT_FILTER) console.log(`Filter: ${PROJECT_FILTER}`)

  // 1. Auth Integram
  console.log('\n[1] Authenticating with Integram...')
  await authenticate()
  console.log('    ✓ token acquired')

  // 2. Load projects from type 1155
  console.log('[2] Loading projects from type 1155...')
  const projRes = await fetch(
    `${INTEGRAM_URL}/${INTEGRAM_DB}/object/${TYPE_PROJECTS}?JSON_KV&l=200`,
    { headers: { 'X-Authorization': _token } }
  )
  const projData = await projRes.json()
  const projects = (projData.object || []).map(o => ({
    id: o.id, name: o.val, desc: (projData.reqs?.[o.id] || {})['1158'] || ''
  }))
  console.log(`    ✓ ${projects.length} projects loaded`)

  // 3. Load actors from type 2406
  console.log('[3] Loading actors...')
  const { objects: actorObjs } = await fetchAllObjects(TYPE_ACTORS)
  const actors = actorObjs.map(o => ({ id: o.id, name: o.val }))
  console.log(`    ✓ ${actors.length} actors loaded`)

  // 4. List folders on Yandex.Disk
  console.log('[4] Listing Yandex.Disk folders...')
  const root = await yadiskList('/')
  const folders = (root._embedded?.items || []).filter(i => i.type === 'dir')
  console.log(`    ✓ ${folders.length} project folders`)

  // 5. Load existing events for deduplication (and --rerun cleanup)
  console.log('[5] Loading existing events...')
  const { objects: existingEvObjs, reqs: existingEvReqs } = await fetchAllObjects(TYPE_EVENTS)
  console.log(`    ✓ ${existingEvObjs.length} events loaded`)

  if (RERUN && !DRY_RUN) {
    // Loop: fetch 20 events → delete broken ones → repeat until none left.
    // Workaround for Integram's broken pagination (s= param is ignored; same 20 always returned).
    // "Broken" = no type info at all (pre-fix events with wrong EVTYPE IDs or missing refs).
    console.log('[--rerun] Purging broken events (loop until clean)...')
    let totalDeleted = 0
    for (let round = 1; round <= 30; round++) {
      const { objects, reqs } = await fetchAllObjects(TYPE_EVENTS)
      const toDelete = objects.filter(ev => {
        const r = reqs[ev.id] || {}
        return !r.ref_3044 && !r['3044']  // no type in any form → broken
      })
      if (toDelete.length === 0) { console.log(`    ✓ Round ${round}: no broken events left`); break }
      console.log(`    Round ${round}: deleting ${toDelete.length} broken events...`)
      for (const ev of toDelete) {
        try { await integramDelete(ev.id); totalDeleted++ }
        catch (e) { console.log(`    ⚠ Delete ${ev.id} failed: ${e.message}`) }
      }
    }
    console.log(`    ✓ Total purged: ${totalDeleted} broken events`)
  }

  // Build dedup index: actorId → Set<`type:date:descPrefix`>
  // Supports both ref_* format (original UI events) and plain r['*'] (pipeline events)
  const dedupIndex = {}
  for (const ev of existingEvObjs) {
    const r = existingEvReqs[ev.id] || {}
    const actorStr = r.ref_3007
      ? String(r.ref_3007).split(':').pop().split(',')[0]
      : r['3007'] ? String(r['3007']) : null
    const typeStr  = r.ref_3044
      ? String(r.ref_3044).split(':').pop()
      : r['3044']  ? String(r['3044'])  : null
    if (!actorStr || !typeStr) continue
    if (!dedupIndex[actorStr]) dedupIndex[actorStr] = new Set()
    const date = r['2458'] || ''
    const desc = (r['2460'] || ev.val || '').slice(0, 40)
    dedupIndex[actorStr].add(`${typeStr}:${date}:${desc}`)
  }
  console.log(`    ✓ dedup index built`)

  // 6. Process each folder
  const stats = { folders: 0, docs: 0, skipped: 0, events: 0, dupes: 0, errors: 0, profiles: 0 }
  const results = []

  for (const folder of folders) {
    if (PROJECT_FILTER && !folder.name.toLowerCase().includes(PROJECT_FILTER.toLowerCase())) continue

    console.log(`\n[Folder] ${folder.name}`)

    // Match to project
    const project = matchProject(folder.name, projects)

    if (!project) {
      console.log(`    ⚠ No matching project found — skip`)
      continue
    }
    console.log(`    → Project: ${project.name} (id=${project.id})`)

    // Match to company-specific actor (uses COMPANY_ACTOR_MAP, fallback=2484)
    const actorId = matchActorByFolder(folder.name)
    console.log(`    → Actor id=${actorId}`)

    // Walk all files in folder
    const files = await walkFolder(folder.path)
    console.log(`    Found ${files.length} files`)

    const folderProfile = {}
    const folderEvents  = []

    for (const file of files) {
      const cls = classifyDoc(file.name)
      const sizeKb = (file.size || 0) / 1024

      if (cls.score < MIN_SCORE) {
        console.log(`    [skip ${cls.score}⭐] ${file.name}`)
        stats.skipped++
        continue
      }
      if ((file.size || 0) > MAX_FILE_SIZE) {
        console.log(`    [skip too large ${Math.round(sizeKb)}KB] ${file.name}`)
        stats.skipped++
        continue
      }

      console.log(`    [${cls.score}⭐ ${cls.type}] ${file.name} (${Math.round(sizeKb)}KB)`)
      stats.docs++

      if (DRY_RUN) continue
      // COLLECT_ONLY: process everything but don't skip downloads/AI

      // Download file
      const destPath = join(TMP_DIR, `${Date.now()}_${file.name.replace(/[^\w.]/g, '_')}`)
      let text = ''
      try {
        const dlUrl = file.file || await yadiskDownloadUrl(file.path)
        await downloadFile(dlUrl, destPath)
        text = await extractText(destPath)
        await unlink(destPath).catch(() => {})
      } catch (e) {
        console.log(`      ⚠ Download/extract error: ${e.message}`)
        stats.errors++
        continue
      }

      if (!text || text.length < 100) {
        console.log(`      ⚠ No text extracted (${text.length} chars)`)
        continue
      }
      console.log(`      ✓ ${text.length} chars extracted`)

      // AI extraction
      try {
        let aiResp
        const companyName = project.name || folder.name

        if (cls.type === 'PAYMENT') {
          aiResp = parseJSON(await callAI(promptExtractPayment(companyName, text), SYSTEM_EXTRACTOR))
        } else {
          aiResp = parseJSON(await callAI(promptExtractFull(companyName, cls.type, text), SYSTEM_EXTRACTOR))
        }

        if (!aiResp) { console.log('      ⚠ AI returned invalid JSON'); continue }

        // Collect profile
        if (aiResp.company_profile) {
          Object.assign(folderProfile, Object.fromEntries(
            Object.entries(aiResp.company_profile).filter(([, v]) => v !== null && v !== '')
          ))
        }

        // Collect events
        if (aiResp.events?.length) {
          console.log(`      ✓ ${aiResp.events.length} events extracted`)
          folderEvents.push(...aiResp.events)
        }
      } catch (e) {
        console.log(`      ⚠ AI error: ${e.message}`)
        stats.errors++
      }
    }

    stats.folders++
    // Enrich events with typeId for backtest consumption
    const enrichedEvents = folderEvents.map(ev => ({ ...ev, typeId: EVTYPE[ev.type] || null }))
    results.push({ folder: folder.name, project, actorId, profile: folderProfile, events: enrichedEvents })

    if (!DRY_RUN && !COLLECT_ONLY) {
      // Write events to Integram (with dedup check)
      const actorKey = String(actorId)
      for (const ev of folderEvents) {
        try {
          // Dedup check
          if (dedupIndex[actorKey]) {
            const evTypeId = EVTYPE[ev.type] || ''
            const date     = ev.date || ''
            const desc     = (ev.description || '').slice(0, 40)
            const key      = `${evTypeId}:${date}:${desc}`
            if (dedupIndex[actorKey].has(key)) {
              console.log(`    [skip dupe] ${ev.type} ${ev.date}`)
              stats.dupes++
              continue
            }
          }
          const r = await createEvent(actorId, ev)
          const newId = r?.obj || r?.id
          if (newId) {
            console.log(`    ✓ Event created: ${ev.type} "${ev.description?.slice(0, 50)}"`)
            stats.events++
            // Add to dedup index
            if (actorKey) {
              if (!dedupIndex[actorKey]) dedupIndex[actorKey] = new Set()
              const evTypeId = EVTYPE[ev.type] || ''
              dedupIndex[actorKey].add(`${evTypeId}:${ev.date || ''}:${(ev.description || '').slice(0, 40)}`)
            }
          } else {
            console.log(`    ⚠ Event create failed:`, JSON.stringify(r).slice(0, 100))
          }
        } catch (e) {
          console.log(`    ⚠ Event write error: ${e.message}`)
          stats.errors++
        }
      }

      // Update project profile
      if (Object.keys(folderProfile).length > 0) {
        try {
          await updateProjectProfile(project.id, folderProfile, project.desc)
          console.log(`    ✓ Profile updated: ${Object.keys(folderProfile).join(', ')}`)
          stats.profiles++
        } catch (e) {
          console.log(`    ⚠ Profile update error: ${e.message}`)
        }
      }
    }
  }

  // Summary
  console.log('\n=== ИТОГИ ===')
  console.log(`Папок обработано:  ${stats.folders}`)
  console.log(`Документов прочитано: ${stats.docs}`)
  console.log(`Пропущено:         ${stats.skipped}`)
  console.log(`Событий создано:   ${stats.events}`)
  console.log(`Дубликатов пропущено: ${stats.dupes}`)
  console.log(`Профилей обновлено: ${stats.profiles}`)
  console.log(`Ошибок:            ${stats.errors}`)

  // Save results for inspection
  const outPath = join(dirname(__dirname), '../../yadisk-pipeline-result.json')
  await writeFile(outPath, JSON.stringify({ stats, results }, null, 2))
  console.log(`\nРезультат сохранён: ${outPath}`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
