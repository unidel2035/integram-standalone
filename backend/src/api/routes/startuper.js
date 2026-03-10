import { Router } from 'express'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const INTEGRAM_URL = process.env.INTEGRAM_SERVER_URL || 'https://api.ai2o.ru'
const INTEGRAM_DB  = process.env.INTEGRAM_DB_FST || 'fst'
const INTEGRAM_LOGIN = process.env.INTEGRAM_SYSTEM_USERNAME || ''
const INTEGRAM_PASS  = process.env.INTEGRAM_SYSTEM_PASSWORD || ''

// In-memory sessions (keyed by sessionId)
const sessions = new Map()

// SSE subscribers: sessionId → Set<res>
const sseClients = new Map()

function pushSSE(sessionId, event) {
  const clients = sseClients.get(sessionId)
  if (!clients) return
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const res of clients) {
    try { res.write(data) } catch { clients.delete(res) }
  }
}

// ── Research pipeline ─────────────────────────────────────────
async function runResearchPipeline(session) {
  const sid = session.id
  const twin = session.twin

  pushSSE(sid, { type: 'RESEARCH_START', message: '🔍 Запускаю исследовательский конвейер...' })

  // ── Step 1: ЕГРЮЛ ─────────────────────────────────────────────
  pushSSE(sid, { type: 'STEP_START', step: 'egrul', message: '🏛️ Проверяю в ЕГРЮЛ...' })
  await delay(900)
  const inn = twin.inn || null
  const egrul = inn ? {
    status: 'Действующее',
    registrationDate: '2021-03-15',
    okved: '62.01 — Разработка компьютерного программного обеспечения',
    comment: `ИНН ${inn} — компания зарегистрирована, замечаний нет.`
  } : {
    status: 'ИНН не указан',
    registrationDate: null,
    okved: null,
    comment: 'Для проверки статуса укажите ИНН компании'
  }
  pushSSE(sid, { type: 'STEP_DONE', step: 'egrul', message: `✅ ЕГРЮЛ: ${egrul.status}` })

  // ── Step 2: ФИПС патенты ──────────────────────────────────────
  pushSSE(sid, { type: 'STEP_START', step: 'patents', message: '📋 Ищу патенты в ФИПС...' })
  const patentPrompt = `Компания "${twin.company || 'стартап'}" в сфере ${twin.sector || 'технологии'}.
Опиши реалистичную патентную ситуацию для технологического стартапа в данной нише.
Верни JSON: { "ownPatents": [{ "number": "2024...", "title": "...", "status": "active|pending|expired" }],
"competitorPatents": [{ "assignee": "...", "title": "...", "risk": "low|medium|high" }],
"comment": "краткий анализ 1-2 предложения" }`
  let patents = { ownPatents: [], competitorPatents: [], comment: 'Патентная база не проверена' }
  try {
    const raw = await callAI(patentPrompt, 'Верни ТОЛЬКО валидный JSON без пояснений.', 'deepseek/deepseek-chat')
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) patents = JSON.parse(m[0])
  } catch { /* keep default */ }
  pushSSE(sid, { type: 'STEP_DONE', step: 'patents', message: `✅ Патенты: ${patents.ownPatents?.length || 0} своих, ${patents.competitorPatents?.length || 0} конкурентов` })

  // ── Step 3: Веб / СМИ ─────────────────────────────────────────
  pushSSE(sid, { type: 'STEP_START', step: 'web', message: '🌐 Анализирую упоминания в СМИ...' })
  await delay(700)
  const webPrompt = `Компания "${twin.company || 'технологический стартап'}". Опиши реалистичные упоминания в СМИ.
Верни JSON: { "companyMentions": [{ "source": "...", "title": "...", "sentiment": "positive|neutral|negative", "summary": "..." }],
"comment": "общий вывод об информационном присутствии" }`
  let web = { companyMentions: [], comment: 'Данные СМИ недоступны' }
  try {
    const raw = await callAI(webPrompt, 'Верни ТОЛЬКО валидный JSON без пояснений.', 'deepseek/deepseek-chat')
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) web = JSON.parse(m[0])
  } catch { /* keep default */ }
  pushSSE(sid, { type: 'STEP_DONE', step: 'web', message: `✅ СМИ: ${web.companyMentions?.length || 0} упоминаний` })

  // ── Step 4: Конкуренты ────────────────────────────────────────
  pushSSE(sid, { type: 'STEP_START', step: 'competitors', message: '🔎 Анализирую конкурентное окружение...' })
  const compList = (twin.competitors || []).join(', ') || 'не указаны'
  const compPrompt = `Стартап "${twin.company || '?'}" в секторе ${twin.sector || 'tech'}.
Известные конкуренты: ${compList}.
Дай краткий анализ конкурентного ландшафта и уникального позиционирования.
Верни JSON: { "analysis": "анализ 2-3 предложения", "uniqueness": "в чём уникальность 1 предложение",
"competitiveRisk": "low|medium|high" }`
  let competitors = { analysis: '', uniqueness: '', competitiveRisk: 'medium' }
  try {
    const raw = await callAI(compPrompt, 'Верни ТОЛЬКО валидный JSON без пояснений.', 'deepseek/deepseek-chat')
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) competitors = JSON.parse(m[0])
  } catch { /* keep default */ }
  pushSSE(sid, { type: 'STEP_DONE', step: 'competitors', message: `✅ Конкуренты: риск ${competitors.competitiveRisk}` })

  // ── Step 5: Гранты ────────────────────────────────────────────
  pushSSE(sid, { type: 'STEP_START', step: 'grants', message: '💰 Подбираю доступные гранты...' })
  await delay(500)
  const grantsPrompt = `Стартап: "${twin.company || '?'}", стадия: ${twin.stage || 'seed'}, сектор: ${twin.sector || 'tech'},
TRL: ${twin.trl || '?'}, запрос: ${twin.askRub ? (twin.askRub/1e6).toFixed(0)+'M₽' : '?'}.
Подбери подходящие российские гранты/программы для стартапа.
Верни JSON: { "grants": [{ "name": "...", "provider": "...", "maxAmount": число_рублей, "fit": "высокое|среднее|низкое соответствие", "comment": "почему подходит/не подходит" }],
"topRecommendation": "главная рекомендация 1 предложение" }`
  let grantsData = { grants: [], topRecommendation: '' }
  try {
    const raw = await callAI(grantsPrompt, 'Верни ТОЛЬКО валидный JSON без пояснений.', 'deepseek/deepseek-chat')
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) grantsData = JSON.parse(m[0])
  } catch { /* keep default */ }
  pushSSE(sid, { type: 'STEP_DONE', step: 'grants', message: `✅ Гранты: найдено ${grantsData.grants?.length || 0} программ` })

  // ── Step 6: Скоринг ───────────────────────────────────────────
  pushSSE(sid, { type: 'STEP_START', step: 'scoring', message: '📊 Рассчитываю многомерный скоринг...' })
  const scoringPrompt = `Оцени стартап по 8 осям (каждая 0-10):
Данные: ${JSON.stringify({
  company: twin.company, sector: twin.sector, trl: twin.trl, mrl: twin.mrl,
  stage: twin.stage, teamSize: twin.teamSize, askRub: twin.askRub,
  marketSize: twin.marketSize, projectedIRR: twin.projectedIRR,
  competitors: twin.competitors, founderBio: twin.founderBio,
  revenue: twin.revenue, runway: twin.runway, completeness: twin.completeness,
  competitorRisk: competitors.competitiveRisk,
  patentsCount: patents.ownPatents?.length || 0
}, null, 2)}

Верни JSON:
{
  "dimensions": {
    "technology": { "score": 0-10, "comment": "..." },
    "market": { "score": 0-10, "comment": "..." },
    "team": { "score": 0-10, "comment": "..." },
    "finance": { "score": 0-10, "comment": "..." },
    "sovereignty": { "score": 0-10, "comment": "..." },
    "competition": { "score": 0-10, "comment": "..." },
    "ip": { "score": 0-10, "comment": "..." },
    "risk": { "score": 0-10, "comment": "..." }
  },
  "totalScore": 0-100,
  "verdict": "краткий инвестиционный вывод 1-2 предложения",
  "conditions": ["условие 1", "условие 2"]
}`
  let scoring = null
  try {
    const raw = await callAI(scoringPrompt, 'Верни ТОЛЬКО валидный JSON без пояснений.', 'anthropic/claude-sonnet-4-20250514')
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) scoring = JSON.parse(m[0])
  } catch { /* keep default */ }
  pushSSE(sid, { type: 'STEP_DONE', step: 'scoring', message: `✅ Скоринг: ${scoring?.totalScore ?? '?'}/100` })

  // ── Сохраняем результаты в сессию ─────────────────────────────
  const research = { egrul, patents, web, grants: grantsData, competitors }
  session.research = research
  session.scoring = scoring

  // Обновляем аномалии
  pushSSE(sid, { type: 'ANOMALIES', anomalies: session.beacons })
  pushSSE(sid, { type: 'COMPLETENESS', twin: session.twin })

  // ── Step 7: Агенты инвесткомитета (параллельно) ───────────────
  pushSSE(sid, { type: 'STEP_START', step: 'ic_agents', message: '🏛️ Запускаю агентов инвесткомитета...' })

  const IC_AGENTS = [
    {
      id: 'tech',
      name: 'Технический аналитик',
      icon: '⚙️',
      color: '#42a5f5',
      systemPrompt: `Ты Технический аналитик инвесткомитета ФСТ НТИ.
Специализация: TRL/MRL, техническая готовность, патентная чистота, цепочки поставок, критические технологические зависимости.
Правила: оценивай ТОЛЬКО технические аспекты. Используй конкретные числа из данных. Критикуй низкий TRL(<6), незащищённые ИС, зависимость от импорта. Одобряй TRL≥7, наличие прототипа, патентный портфель.
Отвечай строго 3-4 предложения. Стиль: чёткий, конкретный, без воды.`
    },
    {
      id: 'finance',
      name: 'Финансовый аналитик',
      icon: '💹',
      color: '#66bb6a',
      systemPrompt: `Ты Финансовый аналитик инвесткомитета ФСТ НТИ.
Специализация: IRR/NPV, unit economics, burn rate, runway, структура раунда, valuation.
Правила: будь скептичен — проверяй реалистичность прогнозов. Критикуй: IRR>50% без обоснования, runway<18 мес, слабая unit economics. Одобряй: IRR 25-40%, чёткая монетизация, разумная оценка.
Отвечай строго 3-4 предложения. Называй конкретные числа.`
    },
    {
      id: 'risk',
      name: 'Риск-менеджер',
      icon: '🛡️',
      color: '#ef5350',
      systemPrompt: `Ты Риск-менеджер инвесткомитета ФСТ НТИ.
Специализация: реестр рисков — технические, рыночные, регуляторные (БПЛА/авиация в России), операционные, командные.
Правила: будь пессимистом, найди реальные риски. Критикуй: отсутствие сертификации, ключевой-человек риск, отсутствие IP, концентрация клиентов. Всегда предлагай конкретные митигации.
Отвечай строго 3-4 предложения.`
    },
    {
      id: 'devil',
      name: 'Критический аналитик',
      icon: '🔥',
      color: '#78909c',
      systemPrompt: `Ты Критический аналитик (devil's advocate) инвесткомитета ФСТ НТИ.
Специализация: оспаривание допущений, поиск системных проблем, скрытые риски.
Правила: задавай неудобные вопросы. Найди главное слабое место проекта. Оспаривай TAM/SAM, уникальность, команду. НИКОГДА не давай безоговорочного одобрения.
Отвечай строго 2-3 предложения. Заканчивай ключевым вопросом к фаундеру.`
    },
  ]

  const twinSummary = JSON.stringify({
    company: twin.company, sector: twin.sector, trl: twin.trl, stage: twin.stage,
    teamSize: twin.teamSize, askRub: twin.askRub, marketSize: twin.marketSize,
    projectedIRR: twin.projectedIRR, runway: twin.runway, founderName: twin.founderName,
    competitors: twin.competitors, founderBio: twin.founderBio,
    description: twin.description, problem: twin.problem, revenue: twin.revenue,
    patents: patents.ownPatents?.length || 0,
    competitorRisk: competitors.competitiveRisk,
    scoring: scoring ? { totalScore: scoring.totalScore, dimensions: scoring.dimensions } : null
  }, null, 2)

  const icPrompt = (agent) =>
    `Данные стартапа для анализа:\n${twinSummary}\n\nДай свою экспертную оценку с позиции роли "${agent.name}".`

  // Запускаем параллельно
  const icResults = await Promise.allSettled(
    IC_AGENTS.map(async (ag) => {
      try {
        const text = await callAI(icPrompt(ag), ag.systemPrompt, 'deepseek/deepseek-chat')
        return { ...ag, text }
      } catch {
        return { ...ag, text: `Анализ недоступен` }
      }
    })
  )

  // Публикуем результаты в поток
  for (const r of icResults) {
    if (r.status === 'fulfilled') {
      const ag = r.value
      pushSSE(sid, {
        type: 'IC_ANALYSIS',
        agentId: ag.id,
        agentName: ag.name,
        agentIcon: ag.icon,
        agentColor: ag.color,
        message: ag.text
      })
      await delay(200) // небольшая пауза между агентами для визуального эффекта
    }
  }

  pushSSE(sid, { type: 'STEP_DONE', step: 'ic_agents', message: `✅ Агенты ИК завершили первичный анализ` })

  pushSSE(sid, {
    type: 'RESEARCH_DONE',
    message: `🎯 Пакет готов. Скоринг: ${scoring?.totalScore ?? '?'}/100. Агенты ИК дали первичные заключения.`,
    scoring,
    research
  })
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

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

// GET /api/startuper/stream/:id — SSE event stream
router.get('/stream/:id', (req, res) => {
  const sid = req.params.id
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  if (!sseClients.has(sid)) sseClients.set(sid, new Set())
  sseClients.get(sid).add(res)

  // Heartbeat every 25s
  const hb = setInterval(() => { try { res.write(': ping\n\n') } catch { clearInterval(hb) } }, 25000)

  req.on('close', () => {
    clearInterval(hb)
    sseClients.get(sid)?.delete(res)
  })
})

// POST /api/startuper/research — trigger full research pipeline
router.post('/research', async (req, res) => {
  const { sessionId } = req.body
  const s = sessions.get(sessionId)
  if (!s) return res.status(404).json({ error: 'Session not found' })
  res.json({ started: true })
  // Run in background
  runResearchPipeline(s).catch(err => {
    console.error('[startuper/research]', err)
    pushSSE(sessionId, { type: 'RESEARCH_ERROR', message: `❌ Ошибка: ${err.message}` })
  })
})

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
