import { Router } from 'express'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const INTEGRAM_URL = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const INTEGRAM_DB  = process.env.INTEGRAM_DB_FST || 'fst'
const INTEGRAM_LOGIN = process.env.INTEGRAM_SYSTEM_USERNAME || ''
const INTEGRAM_PASS  = process.env.INTEGRAM_SYSTEM_PASSWORD || ''

// In-memory sessions (keyed by sessionId)
const sessions = new Map()

// ── Auth helper ────────────────────────────────────────────────
async function authIntegram() {
  const form = new URLSearchParams()
  form.append('login', INTEGRAM_LOGIN)
  form.append('pwd', INTEGRAM_PASS)
  const r = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/auth?JSON_KV`, {
    method: 'POST', body: form,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  const d = await r.json()
  return { token: d.token || d.id, xsrf: d._xsrf || d.xsrf || '' }
}

// ── AI call helper ─────────────────────────────────────────────
async function callAI(prompt, systemPrompt, modelId = 'deepseek/deepseek-chat') {
  const apiBase = process.env.BACKEND_URL || 'http://localhost:8082'
  const r = await fetch(`${apiBase}/api/ai-tokens/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, prompt, systemPrompt, application: 'Startuper' }),
    signal: AbortSignal.timeout(45000)
  })
  if (!r.ok) throw new Error(`AI call failed: ${r.status}`)
  const d = await r.json()
  return d.response || d.content || ''
}

// ── DocParser ─────────────────────────────────────────────────
// Extracts text from base64-encoded document, then uses AI to structure it
async function parseDocument(base64Data, mimeType, filename) {
  // For text-based formats, decode directly
  let rawText = ''

  if (mimeType === 'text/plain' || mimeType === 'text/markdown' || filename?.endsWith('.txt') || filename?.endsWith('.md')) {
    rawText = Buffer.from(base64Data, 'base64').toString('utf-8')
  } else if (mimeType === 'application/json' || filename?.endsWith('.json')) {
    rawText = Buffer.from(base64Data, 'base64').toString('utf-8')
  } else {
    // For PDF/DOCX/XLSX/PPTX — use Claude Vision or treat as binary text extraction
    // Send base64 to Claude with vision (anthropic model supports images/docs)
    // For now: try to extract readable text from binary, fallback to asking Claude about structure
    try {
      rawText = Buffer.from(base64Data, 'base64').toString('utf-8')
        .replace(/[^\x20-\x7E\u0400-\u04FF\n\r\t ]/g, ' ')
        .replace(/\s{3,}/g, '\n')
        .slice(0, 8000)
    } catch {
      rawText = '[Бинарный документ — извлечение по структуре невозможно без специального парсера]'
    }
  }

  const systemPrompt = `Ты — парсер документов венчурного фонда.
Из предоставленного текста извлеки структурированные данные стартапа.
Верни ТОЛЬКО валидный JSON без markdown-обёртки.`

  const prompt = `Извлеки из текста следующие поля стартапа:
{
  "company": "название компании",
  "inn": "ИНН если есть",
  "description": "описание продукта (2-3 предложения)",
  "problem": "какую проблему решает",
  "solution": "как решает",
  "trl": число от 1 до 9 или null,
  "mrl": число от 1 до 10 или null,
  "teamSize": число или null,
  "stage": "pre-seed|seed|A|B|none",
  "askRub": число (запрошенная сумма в рублях) или null,
  "marketSize": число (TAM в рублях) или null,
  "projectedIRR": число (0-1) или null,
  "competitors": ["конкурент1", "конкурент2"],
  "founderName": "имя основателя если упоминается",
  "founderBio": "биография основателя если есть",
  "revenue": "текущая выручка (строка) или null",
  "burnRate": число в рублях/месяц или null,
  "runway": число в месяцах или null,
  "website": "URL сайта если есть",
  "contactEmail": "email если есть",
  "sector": "BAS|ROBO|ME|OTHER",
  "confidenceScore": число от 0 до 1 (насколько полны данные)
}

Текст документа:
${rawText.slice(0, 6000)}`

  const raw = await callAI(prompt, systemPrompt, 'deepseek/deepseek-chat')

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : {}
  } catch {
    return { description: rawText.slice(0, 500), confidenceScore: 0.1 }
  }
}

// ── AnomalyDetector ────────────────────────────────────────────
function detectAnomalies(data) {
  const anomalies = []

  if (data.projectedIRR > 0.6) {
    anomalies.push({ type: 'RISK', severity: 'high', dimension: 'finance',
      text: `IRR ${(data.projectedIRR * 100).toFixed(0)}% — нереалистично высокий без детального обоснования`,
      recommendation: 'Запросить DCF-модель с пообъектным обоснованием' })
  }
  if (data.marketSize > 1e12) {
    anomalies.push({ type: 'RISK', severity: 'medium', dimension: 'market',
      text: 'TAM > 1 трлн ₽ — вероятно завышен без источника',
      recommendation: 'Уточнить методологию расчёта TAM + источник данных' })
  }
  if (data.runway !== null && data.runway < 6) {
    anomalies.push({ type: 'RISK', severity: 'high', dimension: 'finance',
      text: `Runway ${data.runway} мес. — критически низкий`,
      recommendation: 'Срочно уточнить план до следующего раунда' })
  }
  if (data.trl !== null && data.trl < 4 && data.askRub > 50e6) {
    anomalies.push({ type: 'RISK', severity: 'high', dimension: 'tech',
      text: `TRL ${data.trl} при запросе ${(data.askRub/1e6).toFixed(0)}M₽ — слишком ранняя стадия для такого объёма`,
      recommendation: 'Обсудить этапность финансирования' })
  }
  if (!data.competitors || data.competitors.length === 0) {
    anomalies.push({ type: 'RISK', severity: 'medium', dimension: 'market',
      text: 'Конкуренты не названы — признак слепого пятна или нулевого рынка',
      recommendation: 'Запросить конкурентный анализ' })
  }
  if (!data.founderName && !data.founderBio) {
    anomalies.push({ type: 'QUESTION', severity: 'medium', dimension: 'team',
      text: 'Нет информации об основателе',
      recommendation: 'Провести интервью с фаундером' })
  }

  return anomalies
}

// ── PsychoProfiler ─────────────────────────────────────────────
async function profileFounder(messages, founderBio = '', pitchText = '') {
  const dialogue = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n')

  if (dialogue.length < 100 && !founderBio && !pitchText) {
    return null // Недостаточно данных
  }

  const systemPrompt = `Ты психологический аналитик инвестиционного фонда.
Анализируй ТОЛЬКО по текстовым сигналам. Не делай диагноз — выявляй паттерны коммуникации.
Верни ТОЛЬКО валидный JSON.`

  const prompt = `Проанализируй коммуникацию фаундера и верни:
{
  "mbti": "тип MBTI (4 буквы) или null",
  "signals": {
    "concreteness": число 0-10,
    "resilience": число 0-10,
    "honesty": число 0-10,
    "expertise": число 0-10,
    "trackRecord": число 0-10
  },
  "redFlags": ["флаг1", "флаг2"],
  "greenSignals": ["сигнал1", "сигнал2"],
  "summary": "краткая характеристика 1-2 предложения",
  "confidence": число 0-1
}

Текст диалога:
${dialogue.slice(0, 2000)}

Биография:
${founderBio.slice(0, 1000)}

Питч:
${pitchText.slice(0, 1000)}`

  const raw = await callAI(prompt, systemPrompt, 'anthropic/claude-sonnet-4-20250514')
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : null
  } catch {
    return null
  }
}

// ── Completeness calculator ────────────────────────────────────
function calcCompleteness(twin) {
  const fields = ['company', 'description', 'trl', 'teamSize', 'stage',
                  'askRub', 'marketSize', 'founderName', 'founderBio', 'sector']
  const filled = fields.filter(f => twin[f] !== null && twin[f] !== undefined && twin[f] !== '').length
  return Math.round((filled / fields.length) * 100)
}

// ── Adaptive questionnaire ─────────────────────────────────────
function getNextQuestion(twin, askedQuestions) {
  const questions = [
    { id: 'product', field: 'description', q: 'Объясните в одном предложении: что вы делаете и для кого?' },
    { id: 'trl', field: 'trl', q: 'Какой у вас текущий TRL (1-9)? Есть ли работающий прототип?' },
    { id: 'customer', field: 'revenue', q: 'Есть ли уже первые клиенты или пилотные договоры?' },
    { id: 'competitors', field: 'competitors', q: 'Назовите 2-3 конкурента и чем вы от них отличаетесь?' },
    { id: 'team', field: 'teamSize', q: 'Кто в команде? Какой опыт у CTO/технического лида?' },
    { id: 'ask', field: 'askRub', q: 'Сколько вам нужно инвестиций и на что конкретно будут потрачены средства?' },
    { id: 'runway', field: 'runway', q: 'Какой у вас текущий runway (сколько месяцев работы без новых инвестиций)?' },
    { id: 'founder', field: 'founderBio', q: 'Расскажите о себе — какой у вас профессиональный путь в этой области?' },
    { id: 'failure', field: 'resilience', q: 'Были ли у вас неудачные проекты? Что вы из них вынесли?' },
    { id: 'market', field: 'marketSize', q: 'Как вы оцениваете объём рынка? Откуда данные?' },
  ]

  for (const q of questions) {
    if (askedQuestions.includes(q.id)) continue
    if (q.field !== 'resilience' && twin[q.field] !== null && twin[q.field] !== undefined && twin[q.field] !== '') continue
    return q
  }
  return null
}

// ── Chat handler ───────────────────────────────────────────────
async function agentReply(session, userMessage) {
  const { twin, messages, askedQuestions } = session

  const systemPrompt = `Ты — Стартапер, дружелюбный AI-агент венчурного фонда ФСТ НТИ.
Твоя задача: помочь фаундеру подготовить заявку для инвесткомитета.
Ты уже знаешь о проекте:
${JSON.stringify(twin, null, 2)}

Правила:
- Будь конкретным и профессиональным
- Задавай только один вопрос за раз
- Если фаундер ответил на вопрос — зафиксируй данные и переходи к следующему
- Не повторяй уже заданные вопросы
- Когда готовность пакета > 80% — предложи передать материалы инвесткомитету`

  // Extract data from user message into twin
  const extractPrompt = `Пользователь написал: "${userMessage}"
Какие поля стартапа можно обновить? Верни JSON с обновлёнными полями (только те, что явно упомянуты):
Доступные поля: company, inn, description, problem, solution, trl (число 1-9), mrl (число 1-10),
teamSize (число), stage, askRub (число), marketSize (число), projectedIRR (число 0-1),
competitors (массив строк), founderName, founderBio, revenue, burnRate (число), runway (число),
website, sector (BAS|ROBO|ME|OTHER)
Верни только JSON или {} если ничего не извлечено.`

  const [extractedRaw, agentText] = await Promise.all([
    callAI(extractPrompt, 'Верни ТОЛЬКО валидный JSON без пояснений.', 'deepseek/deepseek-chat'),
    callAI(
      `История диалога:\n${messages.slice(-6).map(m => `${m.role === 'user' ? 'Фаундер' : 'Агент'}: ${m.content}`).join('\n')}\n\nФаундер: ${userMessage}`,
      systemPrompt,
      'deepseek/deepseek-chat'
    )
  ])

  // Merge extracted data into twin
  try {
    const match = extractedRaw.match(/\{[\s\S]*\}/)
    if (match) {
      const extracted = JSON.parse(match[0])
      Object.assign(twin, extracted)
    }
  } catch { /* ignore parse errors */ }

  // Get next question if agent reply doesn't include one
  const nextQ = getNextQuestion(twin, askedQuestions)
  let finalReply = agentText.trim()

  if (nextQ && !finalReply.includes('?')) {
    finalReply += '\n\n' + nextQ.q
    askedQuestions.push(nextQ.id)
  } else if (nextQ) {
    askedQuestions.push(nextQ.id)
  }

  // Recalculate completeness and anomalies
  twin.completeness = calcCompleteness(twin)
  session.anomalies = detectAnomalies(twin)
  session.beacons = session.anomalies.map(a => ({
    ...a,
    source: 'Стартапер-агент',
    timestamp: new Date().toISOString()
  }))

  // Update psycho profile every 5 user messages
  const userCount = messages.filter(m => m.role === 'user').length
  if (userCount > 0 && userCount % 5 === 0) {
    session.psychoProfile = await profileFounder(messages, twin.founderBio || '', twin.description || '')
  }

  return { reply: finalReply, twin, anomalies: session.anomalies, psychoProfile: session.psychoProfile, beacons: session.beacons }
}

// ══════════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════════

// POST /api/startuper/session — create new session
router.post('/session', (req, res) => {
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  sessions.set(id, {
    id,
    createdAt: Date.now(),
    twin: {
      company: null, inn: null, description: null, problem: null, solution: null,
      trl: null, mrl: null, teamSize: null, stage: null, askRub: null,
      marketSize: null, projectedIRR: null, competitors: [], founderName: null,
      founderBio: null, founderPitchText: null, revenue: null, burnRate: null,
      runway: null, website: null, contactEmail: null, sector: null,
      metricsHistory: null, completeness: 0
    },
    messages: [],
    askedQuestions: [],
    anomalies: [],
    beacons: [],
    psychoProfile: null,
    integramId: null,
    kagSaved: false,
  })
  res.json({ sessionId: id })
})

// GET /api/startuper/session/:id — get session state
router.get('/session/:id', (req, res) => {
  const s = sessions.get(req.params.id)
  if (!s) return res.status(404).json({ error: 'Session not found' })
  res.json({ twin: s.twin, messages: s.messages, anomalies: s.anomalies,
             beacons: s.beacons, psychoProfile: s.psychoProfile, integramId: s.integramId })
})

// POST /api/startuper/parse — parse uploaded document
router.post('/parse', async (req, res) => {
  try {
    const { sessionId, base64Data, mimeType, filename } = req.body
    if (!base64Data) return res.status(400).json({ error: 'No document data' })

    const parsed = await parseDocument(base64Data, mimeType, filename)

    // Merge into session twin if sessionId provided
    if (sessionId && sessions.has(sessionId)) {
      const s = sessions.get(sessionId)
      Object.assign(s.twin, parsed)
      s.twin.completeness = calcCompleteness(s.twin)
      s.anomalies = detectAnomalies(s.twin)
      s.beacons = s.anomalies.map(a => ({ ...a, source: 'DocParser', timestamp: new Date().toISOString() }))

      // Add system message to chat
      s.messages.push({
        role: 'assistant',
        content: `Документ обработан. Извлечено данных: ${Math.round((parsed.confidenceScore || 0.5) * 100)}% полноты.\n` +
          (parsed.company ? `**Компания:** ${parsed.company}\n` : '') +
          (parsed.description ? `**Продукт:** ${parsed.description.slice(0, 150)}...\n` : '') +
          `\nГотовность пакета для ИК: **${s.twin.completeness}%**\n\n` +
          (getNextQuestion(s.twin, s.askedQuestions)?.q || 'Все ключевые данные заполнены! Можем передавать материалы инвесткомитету.'),
        timestamp: Date.now()
      })

      if (getNextQuestion(s.twin, s.askedQuestions)) {
        s.askedQuestions.push(getNextQuestion(s.twin, s.askedQuestions)?.id)
      }

      res.json({ parsed, twin: s.twin, anomalies: s.anomalies, messages: s.messages })
    } else {
      res.json({ parsed })
    }
  } catch (err) {
    console.error('[startuper/parse]', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/startuper/chat — send message
router.post('/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body
    if (!sessionId || !message) return res.status(400).json({ error: 'Missing sessionId or message' })

    let s = sessions.get(sessionId)
    if (!s) {
      // Auto-create session
      const id = sessionId
      sessions.set(id, {
        id, createdAt: Date.now(),
        twin: { company: null, inn: null, description: null, problem: null, solution: null,
          trl: null, mrl: null, teamSize: null, stage: null, askRub: null,
          marketSize: null, projectedIRR: null, competitors: [], founderName: null,
          founderBio: null, founderPitchText: null, revenue: null, burnRate: null,
          runway: null, website: null, contactEmail: null, sector: null,
          metricsHistory: null, completeness: 0 },
        messages: [], askedQuestions: [], anomalies: [], beacons: [], psychoProfile: null,
        integramId: null, kagSaved: false,
      })
      s = sessions.get(id)
    }

    s.messages.push({ role: 'user', content: message, timestamp: Date.now() })

    const result = await agentReply(s, message)

    s.messages.push({ role: 'assistant', content: result.reply, timestamp: Date.now() })

    res.json({
      reply: result.reply,
      twin: result.twin,
      anomalies: result.anomalies,
      psychoProfile: result.psychoProfile,
      beacons: result.beacons,
      messages: s.messages
    })
  } catch (err) {
    console.error('[startuper/chat]', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/startuper/save — save to Integram DB and KAG
router.post('/save', async (req, res) => {
  try {
    const { sessionId } = req.body
    const s = sessions.get(sessionId)
    if (!s) return res.status(404).json({ error: 'Session not found' })

    const { twin, beacons, psychoProfile } = s

    // Save to Integram (type 1155 — Проекты ФСТ)
    const { token, xsrf } = await authIntegram()
    const body = new URLSearchParams()
    body.set('t1156', twin.company || 'Без названия')
    body.set('t1158', [twin.description, twin.problem, twin.solution].filter(Boolean).join('\n\n'))
    if (twin.askRub) body.set('r1157', String(twin.askRub))
    body.set('t1214', JSON.stringify({
      inn: twin.inn, trl: twin.trl, mrl: twin.mrl, teamSize: twin.teamSize,
      stage: twin.stage, marketSize: twin.marketSize, projectedIRR: twin.projectedIRR,
      sector: twin.sector, founderName: twin.founderName, website: twin.website,
      contactEmail: twin.contactEmail, competitors: twin.competitors,
      metricsHistory: twin.metricsHistory,
      beacons, psychoProfile,
      submittedAt: new Date().toISOString(),
      source: 'startuper-agent'
    }))
    body.set('_xsrf', xsrf)
    body.set('up', '1')

    const r = await fetch(`${INTEGRAM_URL}/${INTEGRAM_DB}/_m_new/1155?JSON_KV`, {
      method: 'POST',
      headers: { 'X-Authorization': token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
    const d = await r.json()
    s.integramId = d.id || d.obj

    // Save to KAG
    const apiBase = process.env.BACKEND_URL || 'http://localhost:8082'
    const entities = [
      {
        name: `Стартап: ${twin.company || 'Без названия'}`,
        entityType: 'StartupProfile',
        observations: [
          `Стадия: ${twin.stage || 'не указана'}`,
          `TRL: ${twin.trl || 'не указан'}`,
          `Команда: ${twin.teamSize || '?'} чел`,
          `Запрос: ${twin.askRub ? (twin.askRub/1e6).toFixed(1) + 'M₽' : 'не указан'}`,
          `Сектор: ${twin.sector || 'не указан'}`,
          `Описание: ${(twin.description || '').slice(0, 200)}`,
          `Готовность пакета: ${twin.completeness}%`,
          `Anomalies: ${beacons.length}`,
          ...(psychoProfile ? [`Психотип: ${psychoProfile.mbti || '?'}, доверие: ${(psychoProfile.confidence * 100).toFixed(0)}%`] : []),
        ]
      },
      ...(twin.founderName ? [{
        name: `Фаундер: ${twin.founderName}`,
        entityType: 'FounderProfile',
        observations: [
          `Компания: ${twin.company || '?'}`,
          ...(twin.founderBio ? [`Биография: ${twin.founderBio.slice(0, 300)}`] : []),
          ...(psychoProfile ? [
            `MBTI: ${psychoProfile.mbti || '?'}`,
            `Конкретность: ${psychoProfile.signals?.concreteness}/10`,
            `Честность: ${psychoProfile.signals?.honesty}/10`,
            `Стрессоустойчивость: ${psychoProfile.signals?.resilience}/10`,
            ...(psychoProfile.redFlags || []).map(f => `RedFlag: ${f}`),
            ...(psychoProfile.greenSignals || []).map(g => `GreenSignal: ${g}`),
          ] : []),
        ]
      }] : [])
    ]

    await fetch(`${apiBase}/api/mcp/kag/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: 'kag_create_entities', arguments: { entities } })
    }).catch(() => {}) // KAG save is best-effort

    s.kagSaved = true
    res.json({ success: true, integramId: s.integramId, twin: s.twin })
  } catch (err) {
    console.error('[startuper/save]', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/startuper/finmodel — generate financial model questions and fill template
router.post('/finmodel', async (req, res) => {
  try {
    const { sessionId, question } = req.body
    const s = sessions.get(sessionId)
    if (!s) return res.status(404).json({ error: 'Session not found' })

    const { twin } = s

    const systemPrompt = `Ты финансовый консультант венчурного фонда.
Помогаешь фаундеру заполнить финансовую модель для получения инвестиций.
Данные о стартапе: ${JSON.stringify(twin)}`

    const prompt = question || `На основе данных о стартапе составь базовые финансовые допущения:
1. Начальные инвестиции (capex + opex)
2. Прогноз выручки по годам (3 года)
3. Структура расходов (%)
4. Unit economics (CAC, LTV, маржа)
5. Предварительный IRR и NPV (ставка дисконтирования 20%)
Используй реалистичные числа для стадии ${twin.stage || 'seed'} в секторе ${twin.sector || 'tech'}.`

    const reply = await callAI(prompt, systemPrompt, 'anthropic/claude-sonnet-4-20250514')
    res.json({ reply })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
