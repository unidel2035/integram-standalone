/**
 * projectDocsParser.js
 *
 * Парсер документов проектов ФСТ из Integram type 53253 (Медиа).
 * Для каждого файла (PDF/PPTX):
 *   1. Скачивает файл из Integram
 *   2. Извлекает текст (pdf-parse / unzipper XML)
 *   3. Отправляет текст в DeepSeek для извлечения событий
 *   4. Создаёт события в type 2451 (СОД Предметные события)
 *
 * Запуск: node src/parsers/projectDocsParser.js
 * Или:   node src/parsers/projectDocsParser.js --project 12345
 */

import fetch from 'node-fetch'
import { createWriteStream, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TMP_DIR = join(__dirname, '../../.tmp-docs')

if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })

// ── Integram config ──────────────────────────────────────────────
const INTEGRAM_URL  = process.env.INTEGRAM_SERVER_URL || 'https://api.ai2o.ru'
const INTEGRAM_DB   = 'fst'
const INTEGRAM_USER = process.env.INTEGRAM_SYSTEM_USERNAME
const INTEGRAM_PASS = process.env.INTEGRAM_SYSTEM_PASSWORD

const TYPE_MEDIA    = 53253  // Медиа (файлы проектов)
const TYPE_EVENTS   = 2451   // СОД Предметные события
const TYPE_ACTORS   = 2406   // СОД Акторы (компании-проекты)
const TYPE_CONCEPTS = 2416   // СОД Концепты

// Event type IDs in type 3042
const EVTYPE_REGULATORY   = 3049
const EVTYPE_MARKET       = 3050
const EVTYPE_TECH         = 3051
const EVTYPE_FINANCIAL    = 3052

// DeepSeek config
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_URL     = 'https://api.deepseek.com/v1/chat/completions'

// ── Auth ─────────────────────────────────────────────────────────

let _token = null
let _xsrf  = null

async function authenticate() {
  // Integram возвращает 302 с токеном в Set-Cookie: fst=<token>
  const res = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/auth`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ login: INTEGRAM_USER, pwd: INTEGRAM_PASS })
  })

  if (res.status !== 302) throw new Error(`Auth failed: ${res.status}`)

  const cookieHeader = res.headers.get('set-cookie') || ''
  const m = cookieHeader.match(new RegExp(`${INTEGRAM_DB}=([^;]+)`))
  if (!m) throw new Error('No token in Set-Cookie')
  const token = m[1]

  // Получаем _xsrf
  const xsrfRes = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/xsrf`, {
    headers: { 'X-Authorization': token }
  })
  const xsrfData = xsrfRes.ok ? await xsrfRes.json() : {}

  _token = token
  _xsrf  = xsrfData._xsrf || ''
  return { token: _token, xsrf: _xsrf }
}

async function getToken() {
  if (!_token) await authenticate()
  return _token
}

// ── Integram queries ─────────────────────────────────────────────

async function fetchAll(typeId) {
  const token = await getToken()
  // Use object/ endpoint (works for base_typ=3 tables); _d_req only works for dict types
  const all = []
  let offset = 0
  const limit = 100
  while (true) {
    const url = `${INTEGRAM_URL}/${INTEGRAM_DB}/object/${typeId}?JSON_KV&l=${limit}&s=${offset}`
    const res = await fetch(url, { headers: { 'X-Authorization': token } })
    if (!res.ok) throw new Error(`fetch type ${typeId}: ${res.status}`)
    const data = await res.json()
    const objects = data.object || []
    const reqs = data.reqs || {}
    for (const obj of objects) {
      const r = reqs[obj.id] || {}
      // Spread req fields directly onto object for field access like media.t53254
      all.push({ id: Number(obj.id), name: obj.val, ...r })
    }
    const total = Number(data.total || 0)
    offset += objects.length
    if (offset >= total || objects.length === 0) break
  }
  return all
}

async function createEvent(fields) {
  const token = await getToken()
  const xsrf  = _xsrf

  // POST /{db}/_m_new/{typeId}
  const body = new URLSearchParams()
  body.set(`t2452`, fields.name || 'Событие')   // название
  body.set(`r2458`, fields.date || '')           // дата
  body.set(`r2460`, fields.effect || '')         // эффект
  body.set(`r2461`, fields.source || '')         // источник
  body.set(`r3044`, fields.eventTypeId || EVTYPE_TECH) // тип события
  if (fields.magnitude)     body.set('r61931', fields.magnitude)
  if (fields.probability)   body.set('r61928', fields.probability)
  if (fields.delta_trl)     body.set('r61929', fields.delta_trl)
  if (fields.delta_funding) body.set('r61930', fields.delta_funding)
  if (xsrf)                 body.set('_xsrf', xsrf)

  const res = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/_m_new/${TYPE_EVENTS}`, {
    method: 'POST',
    headers: {
      'X-Authorization': token,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`createEvent failed: ${res.status} — ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.id || data.objectId
}

async function setMultiRef(eventId, reqId, targetIds) {
  if (!targetIds || targetIds.length === 0) return
  const token = await getToken()
  const xsrf  = _xsrf

  const body = new URLSearchParams()
  body.set('_xsrf', xsrf || '')
  // Integram multi-ref: передаём несколько значений одного реквизита
  for (const tid of targetIds) {
    body.append(`r${reqId}[]`, tid)
  }

  const res = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/_m_set/${eventId}`, {
    method: 'POST',
    headers: {
      'X-Authorization': token,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  })

  if (!res.ok) {
    console.warn(`[Parser] setMultiRef ${eventId} r${reqId} failed: ${res.status}`)
  }
}

// ── File download ─────────────────────────────────────────────────

async function downloadFile(fileUrl, destPath) {
  const token = await getToken()
  const res = await fetch(fileUrl, { headers: { 'X-Authorization': token } })
  if (!res.ok) throw new Error(`download failed: ${res.status} ${fileUrl}`)

  const dest = createWriteStream(destPath)
  await new Promise((resolve, reject) => {
    res.body.pipe(dest)
    res.body.on('error', reject)
    dest.on('finish', resolve)
  })
}

// ── PDF text extraction ───────────────────────────────────────────

async function extractPdfText(filePath) {
  try {
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js')
    const buffer = readFileSync(filePath)
    const data = await pdfParse(buffer)
    return data.text || ''
  } catch (err) {
    console.warn('[Parser] PDF extract error:', err.message)
    return ''
  }
}

// ── PPTX text extraction ──────────────────────────────────────────

async function extractPptxText(filePath) {
  try {
    const { default: unzipper } = await import('unzipper')
    const zip = await unzipper.Open.file(filePath)

    let text = ''
    for (const entry of zip.files) {
      if (entry.path.match(/ppt\/slides\/slide\d+\.xml$/)) {
        const content = await entry.buffer()
        const xml = content.toString('utf8')
        // Извлекаем текст из тегов <a:t>
        const matches = xml.match(/<a:t>([^<]+)<\/a:t>/g) || []
        text += matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ') + '\n'
      }
    }
    return text
  } catch (err) {
    console.warn('[Parser] PPTX extract error:', err.message)
    return ''
  }
}

// ── AI extraction ─────────────────────────────────────────────────

const EVENT_EXTRACTION_PROMPT = `Ты — аналитик венчурного фонда ФСТ НТИ.
Из текста документа технологического стартапа извлеки ключевые бизнес-события.

Для каждого события определи:
- name: короткое название (до 80 символов)
- date: дата в формате YYYY-MM-DD (если указана, иначе null)
- effect: описание эффекта (1-2 предложения)
- eventType: "Регуляторное" | "Рыночное" | "Технологическое" | "Финансовое"
- magnitude: важность 1-5 (5 = поворотное для компании)
- probability: вероятность повторения 0.0-1.0
- delta_trl: изменение TRL-уровня (-3..+3), 0 если нет данных
- delta_funding_mln: изменение финансирования в млн руб (может быть отрицательным)
- concepts: массив подходящих концептов из списка:
  ["Раунд инвестирования", "Регуляторное изменение", "Рыночный сигнал",
   "Milestone компании", "Технологический прорыв", "TRL", "РИД/ОИС", "Гранты"]

Верни JSON массив событий. Максимум 10 событий. Только самые значимые.
Если событий нет — верни [].

Пример:
[
  {
    "name": "Получение патента RU 2789456 на алгоритм навигации",
    "date": "2023-06-15",
    "effect": "Защита ключевой технологии, основа для лицензирования",
    "eventType": "Технологическое",
    "magnitude": 4,
    "probability": 0.3,
    "delta_trl": 1,
    "delta_funding_mln": 0,
    "concepts": ["РИД/ОИС", "Технологический прорыв"]
  }
]`

async function extractEventsFromText(text, projectName) {
  if (!text || text.length < 100) return []

  // Ограничиваем до 8000 символов для API
  const truncated = text.slice(0, 8000)

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: EVENT_EXTRACTION_PROMPT },
          { role: 'user', content: `Проект: ${projectName}\n\nТекст документа:\n${truncated}` }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    })

    if (!res.ok) {
      console.warn('[Parser] DeepSeek error:', res.status)
      return []
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || '[]'

    // Извлекаем JSON из ответа
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    return JSON.parse(jsonMatch[0])
  } catch (err) {
    console.warn('[Parser] AI extraction error:', err.message)
    return []
  }
}

// ── Concept name → ID mapping ─────────────────────────────────────

const CONCEPT_NAME_MAP = {
  'Раунд инвестирования':    2566,
  'Регуляторное изменение':  2599,
  'Рыночный сигнал':         2602,
  'Milestone компании':      2605,
  'Технологический прорыв':  2608,
  'TRL':                     7747,
  'РИД/ОИС':                 7759,
  'Гранты':                  49581,
}

const EVTYPE_MAP = {
  'Регуляторное':   EVTYPE_REGULATORY,
  'Рыночное':       EVTYPE_MARKET,
  'Технологическое': EVTYPE_TECH,
  'Финансовое':     EVTYPE_FINANCIAL,
}

// ── Main pipeline ─────────────────────────────────────────────────

export async function parseProjectDocs({ projectFilter = null, dryRun = false } = {}) {
  console.log('[Parser] Authenticating...')
  await authenticate()

  console.log('[Parser] Fetching media files from type 53253...')
  const mediaFiles = await fetchAll(TYPE_MEDIA)
  console.log(`[Parser] Found ${mediaFiles.length} media entries`)

  // Fetch actors (companies) for cross-referencing
  const actors = await fetchAll(TYPE_ACTORS)
  const actorMap = Object.fromEntries(actors.map(a => [
    (a['2407'] || a.name || '').toLowerCase().trim(),
    a.id
  ]))

  let processed = 0
  let eventsCreated = 0
  let errors = 0

  for (const media of mediaFiles) {
    // media fields: id, name/t53254=название, r53255=проект ref, file URL
    const mediaName = media.t53254 || media.name || `file_${media.id}`

    // Filter by project if specified
    if (projectFilter && media.r53255 !== parseInt(projectFilter)) continue

    // Get file URL — Integram stores files at /_file/{id} or in a field
    const fileField = media.t53256 || media.file || null
    if (!fileField) {
      console.log(`[Parser] Skip ${mediaName} — no file field`)
      continue
    }

    const ext = extname(fileField).toLowerCase()
    if (!['.pdf', '.pptx', '.ppt'].includes(ext)) {
      console.log(`[Parser] Skip ${mediaName} — unsupported type ${ext}`)
      continue
    }

    const fileUrl = fileField.startsWith('http')
      ? fileField
      : `${INTEGRAM_URL}/${INTEGRAM_DB}/_file/${media.id}`

    const destPath = join(TMP_DIR, `${media.id}${ext}`)

    try {
      console.log(`[Parser] Processing ${mediaName} (${ext})...`)

      // Download
      await downloadFile(fileUrl, destPath)

      // Extract text
      let text = ''
      if (ext === '.pdf') {
        text = await extractPdfText(destPath)
      } else {
        text = await extractPptxText(destPath)
      }

      if (!text || text.length < 50) {
        console.log(`[Parser] Skip ${mediaName} — no text extracted`)
        continue
      }

      console.log(`[Parser] Extracted ${text.length} chars from ${mediaName}`)

      // Find project name for context
      const projectName = mediaName.replace(/\.(pdf|pptx|ppt)$/i, '')

      // AI extraction
      const events = await extractEventsFromText(text, projectName)
      console.log(`[Parser] AI extracted ${events.length} events from ${mediaName}`)

      if (dryRun) {
        console.log('[DRY RUN] Events:', JSON.stringify(events, null, 2))
        processed++
        continue
      }

      // Create events in Integram
      for (const evt of events) {
        try {
          const eventId = await createEvent({
            name:         evt.name,
            date:         evt.date || '',
            effect:       evt.effect || '',
            source:       `Документ: ${mediaName}`,
            eventTypeId:  EVTYPE_MAP[evt.eventType] || EVTYPE_TECH,
            magnitude:    evt.magnitude,
            probability:  evt.probability,
            delta_trl:    evt.delta_trl,
            delta_funding: evt.delta_funding_mln,
          })

          // Link concepts
          const conceptIds = (evt.concepts || [])
            .map(name => CONCEPT_NAME_MAP[name])
            .filter(Boolean)

          if (conceptIds.length > 0) {
            await setMultiRef(eventId, 3021, conceptIds)
          }

          // Link actor if found by project name
          const actorKey = projectName.toLowerCase().trim()
          const matchedActor = Object.entries(actorMap).find(([k]) =>
            k.includes(actorKey.slice(0, 10)) || actorKey.includes(k.slice(0, 10))
          )
          if (matchedActor) {
            await setMultiRef(eventId, 3007, [matchedActor[1]])
          }

          // Link project ref (r62313 → type 1155)
          if (media.r53255) {
            await setMultiRef(eventId, 62313, [media.r53255])
          }

          eventsCreated++
          console.log(`[Parser] Created event #${eventId}: ${evt.name}`)

          // Rate limit
          await delay(300)

        } catch (err) {
          console.error(`[Parser] Event creation error: ${err.message}`)
          errors++
        }
      }

      processed++
      // Rate limit between files
      await delay(1000)

    } catch (err) {
      console.error(`[Parser] Error processing ${mediaName}: ${err.message}`)
      errors++
    }
  }

  const result = { processed, eventsCreated, errors, total: mediaFiles.length }
  console.log('[Parser] Done:', result)
  return result
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── CLI entry point ───────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const projectFilter = args.includes('--project') ? args[args.indexOf('--project') + 1] : null
  const dryRun = args.includes('--dry-run')

  console.log(`[Parser] Starting${dryRun ? ' (DRY RUN)' : ''}${projectFilter ? ` for project ${projectFilter}` : ''}`)

  parseProjectDocs({ projectFilter, dryRun })
    .then(r => {
      console.log('[Parser] Complete:', r)
      process.exit(0)
    })
    .catch(err => {
      console.error('[Parser] Fatal:', err)
      process.exit(1)
    })
}
