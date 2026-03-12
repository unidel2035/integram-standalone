/**
 * Expert Digital Twin API
 *
 * Эксперт — агент в событийной онтологии:
 *   1. Читает event-timeline сделки как контекст (не JSON-снапшот)
 *   2. Каждое решение записывается в EventStore (entityType='expert')
 *   3. Паттерны обучаются из его event-лога
 *   4. Prediction score считается по паттернам до вопроса
 */

import { Router } from 'express'
import fetch from 'node-fetch'
import { getConfig } from '../../services/fstConfigService.js'

const router = Router()

// ── AI call helper ─────────────────────────────────────────────
async function callAI(prompt, systemPrompt, modelId = 'deepseek/deepseek-chat') {
  const port = process.env.FST_API_PORT || process.env.BACKEND_PORT || '8084'
  const apiBase = process.env.BACKEND_URL || `http://localhost:${port}`
  const r = await fetch(`${apiBase}/api/ai-tokens/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, prompt, systemPrompt, application: 'ExpertDigitalTwin' }),
    signal: AbortSignal.timeout(60000)
  })
  if (!r.ok) throw new Error(`AI call failed: ${r.status}`)
  const d = await r.json()
  return d.response || d.content || ''
}

// ── EventStore writer ──────────────────────────────────────────
async function emitExpertEvent(expertId, eventType, data = {}, apiBase) {
  try {
    const EXPERT_EVENT_META = {
      EXPERT_SESSION_STARTED:      { label: 'Сессия начата',          icon: 'pi pi-user',         color: '#8b5cf6' },
      EXPERT_CONTEXT_LOADED:       { label: 'Контекст загружен',       icon: 'pi pi-download',     color: '#3b82f6' },
      EXPERT_PATTERN_FIRED:        { label: 'Паттерн сработал',        icon: 'pi pi-bolt',         color: '#f97316' },
      EXPERT_QUESTION_ASKED:       { label: 'Вопрос задан',            icon: 'pi pi-question-circle', color: '#06b6d4' },
      EXPERT_ARGUMENT_RAISED:      { label: 'Тезис сформирован',       icon: 'pi pi-comment',      color: '#8b5cf6' },
      EXPERT_CONDITION_PROPOSED:   { label: 'Условие предложено',      icon: 'pi pi-list-check',   color: '#3b82f6' },
      EXPERT_EVALUATED:            { label: 'Вердикт дан',             icon: 'pi pi-verified',     color: '#22c55e' },
      EXPERT_PATTERN_LEARNED:      { label: 'Паттерн извлечён',        icon: 'pi pi-sitemap',      color: '#8b5cf6' },
      EXPERT_PREDICTION_GENERATED: { label: 'Прогноз сгенерирован',    icon: 'pi pi-chart-bar',    color: '#06b6d4' },
    }
    const meta = EXPERT_EVENT_META[eventType] || { label: eventType, icon: 'pi pi-circle', color: '#888' }
    await fetch(`${apiBase}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'expert',
        entityId:   expertId,
        type:       eventType,
        label:      meta.label,
        icon:       meta.icon,
        color:      meta.color,
        subject:    `expert:${expertId}`,
        data,
        ts:         Date.now(),
      })
    })
  } catch (e) {
    console.warn('[expert] emitEvent failed:', e.message)
  }
}

// ── Load deal timeline from EventStore ───────────────────────
async function loadDealTimeline(dealId, apiBase) {
  if (!dealId) return []
  try {
    const r = await fetch(`${apiBase}/api/events/deal/${dealId}`)
    if (!r.ok) return []
    return await r.json()
  } catch { return [] }
}

// ── Load expert's own decision history ───────────────────────
async function loadExpertTimeline(expertId, apiBase) {
  try {
    const r = await fetch(`${apiBase}/api/events/expert/${expertId}`, {
      signal: AbortSignal.timeout(5000)
    })
    if (!r.ok) return []
    return await r.json()
  } catch { return [] }
}

// ── Build deal context from event timeline (text for prompt) ─
function buildDealTimelineContext(timeline) {
  if (!timeline.length) return ''

  // Phase labels
  const PHASE_ORDER = ['source', 'negotiate', 'dd', 'close', 'post-close']
  const events = timeline.map(e => {
    const daysAgo = Math.floor((Date.now() - e.ts) / 86400000)
    const when = daysAgo === 0 ? 'сегодня' : daysAgo === 1 ? '1 день назад' : `${daysAgo} дн. назад`
    return `  • ${e.label || e.type} (${when})${e.data?.note ? ' — ' + e.data.note : ''}`
  })

  // Current phase = last event's phase
  const lastEvt = timeline[timeline.length - 1]
  const currentPhase = lastEvt?.phase || '?'

  // Risk signals
  const risks = timeline.filter(e => ['RISK_ELEVATED', 'DD_FAILED', 'TEAM_CHANGE'].includes(e.type))
  const positives = timeline.filter(e => ['MILESTONE_ACHIEVED', 'REVENUE_MILESTONE', 'DD_COMPLETED'].includes(e.type))

  let ctx = `ИСТОРИЯ СДЕЛКИ (${timeline.length} событий, текущая фаза: ${currentPhase}):\n`
  ctx += events.join('\n')

  if (risks.length) {
    ctx += `\n\nСИГНАЛЫ РИСКА:\n${risks.map(e => `  ⚠️ ${e.label || e.type}`).join('\n')}`
  }
  if (positives.length) {
    ctx += `\n\nПОЗИТИВНЫЕ СОБЫТИЯ:\n${positives.map(e => `  ✓ ${e.label || e.type}`).join('\n')}`
  }

  return ctx
}

// ── Build expert's behavioral memory from his own event log ──
function buildExpertMemoryContext(expertTimeline, expertName) {
  const verdicts = expertTimeline.filter(e => e.type === 'EXPERT_EVALUATED')
  if (!verdicts.length) return ''

  const stats = { ОДОБРИТЬ: 0, ОТЛОЖИТЬ: 0, ОТКЛОНИТЬ: 0 }
  const patterns = []
  for (const v of verdicts) {
    const d = v.data?.decision
    if (d && stats[d] !== undefined) stats[d]++
    if (v.data?.conditions?.length) {
      patterns.push(`${expertName} поставил условия: ${v.data.conditions.slice(0, 2).join('; ')}`)
    }
  }

  const total = verdicts.length
  const learnedPatterns = expertTimeline
    .filter(e => e.type === 'EXPERT_PATTERN_LEARNED')
    .flatMap(e => e.data?.patterns || [])
    .slice(-10)

  let ctx = `\nПОВЕДЕНЧЕСКАЯ ПАМЯТЬ ${expertName.toUpperCase()} (${total} решений):\n`
  ctx += `  Одобрено: ${stats['ОДОБРИТЬ']} | Отложено: ${stats['ОТЛОЖИТЬ']} | Отклонено: ${stats['ОТКЛОНИТЬ']}\n`
  if (learnedPatterns.length) {
    ctx += `\nИЗВЛЕЧЁННЫЕ ПАТТЕРНЫ:\n${learnedPatterns.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}`
  }
  if (patterns.length) {
    ctx += `\nТИПИЧНЫЕ УСЛОВИЯ:\n${[...new Set(patterns)].slice(0, 5).map(p => `  - ${p}`).join('\n')}`
  }

  return ctx
}

// ── Expert registry ─────────────────────────────────────────────────────────
const EXPERTS = {
  gordin: {
    id: 'gordin',
    name: 'Дионис Гордин',
    title: 'Инвестиционный директор, Фонд НТИ / ФСТ НТИ',
    avatar: '👔',
    color: 'var(--fst-purple)',
    bio: `Дионис Сергеевич Гордин (р. 1974) — инвестиционный директор Фонда поддержки проектов НТИ и директор по технологическому суверенитету АНО «Платформа НТИ».

Образование: Восточный университет при ИВ РАН (экономист-востоковед, красный диплом, 2000), аспирантура ИВ РАН (2000–2003), Институт фондового рынка и управления (2006).

Карьера: Альфа Групп / венчурный фонд «Русские технологии» (2002–2005), соучредитель Национальной сети бизнес-ангелов «Частный капитал» (2006), РОСНАНО — управляющий директор по инвестициям (2008–2010), ММВБ рынок ИРК (2010–2011), «Аврора Капитал» (2011–2017).

С 2022 — Фонд НТИ / ФСТ НТИ. Ключевые события: ПМЭФ 2022 — меморандум с ГТЛК о создании ООО «БАС»; апрель 2023 — запуск ФСТ НТИ (инвестиционное товарищество, 1,7 млрд руб.); август 2023 — оценил рынок БПЛА в России в 1 трлн рублей; 2024 — анонс субфондов ФСТ на 18 млрд руб.; ведёт переговоры с суверенными фондами БРИКС+ (Саудовская Аравия, Бахрейн, Оман).`,
    investmentPrinciples: [
      'Суверенность как базовый фильтр: только проекты с базовыми российскими технологиями',
      'Мультипликатор частного капитала: на 1 руб. ФСТ — минимум 3 руб. частных инвестиций',
      'Приоритеты: БПЛА/авиалогистика, микроэлектроника, робототехника, ИИ, беспроводная связь, биотех, аэрокосмос',
      'Экосистемный подход: не навязывает деньги, если проект нашёл других инвесторов',
      'Ориентация на серийное производство, а не только на R&D',
      'Экспортный потенциал на рынки БРИКС+ приветствуется',
    ],
    redFlags: [
      'Нет российской технологической базы (иностранные компоненты, зависимость от импорта)',
      'Проект вне приоритетных отраслей ФСТ',
      'Нет потенциала привлечения со-инвесторов',
      'TRL < 4 при крупном запросе',
      'Только R&D без пути к серийному производству',
    ],
    // Cognitive style for pattern recognition
    cognitiveStyle: {
      primaryFocus:   ['sovereignty', 'multiplier', 'production_readiness'],
      decisionWeight: { trl: 0.25, market: 0.20, team: 0.20, sovereignty: 0.35 },
      riskTolerance:  'medium',
      typicalQuestions: [
        'Какова доля российских компонентов в критических узлах?',
        'Кто со-инвесторы? Есть ли частные деньги?',
        'Дорожная карта от прототипа до серии?',
        'TRL сейчас и через 18 месяцев?',
        'Есть ли потенциал для рынков БРИКС+?',
      ],
    },
    systemPrompt: `Ты — цифровой аватар Диониса Сергеевича Гордина, инвестиционного директора Фонда НТИ / ФСТ НТИ.

БИОГРАФИЯ:
- р. 1974, образование: экономист-востоковед (Восточный ун-т при ИВ РАН, красный диплом), аспирантура ИВ РАН, фондовый рынок (ИФРУ)
- 20+ лет в венчурных инвестициях: Альфа Групп, РОСНАНО (управляющий директор), ММВБ, Фонд НТИ
- Ключевая зона: ФСТ НТИ — инвестиционное товарищество для финансирования суверенных технологий
- Активность: ПМЭФ, Технопром, переговоры с фондами БРИКС+

СТИЛЬ ОБЩЕНИЯ:
- Профессиональный, конкретный, не многословный
- Называет конкретные цифры (рынок БПЛА — 1 трлн ₽, мультипликатор 1:3+)
- Не давит и не навязывает деньги — партнёрская позиция
- Экосистемное мышление, долгосрочная перспектива
- Привык работать на форумах, в системе госинститутов развития

ИНВЕСТИЦИОННЫЕ ФИЛЬТРЫ (обязательные):
1. СУВЕРЕННОСТЬ: базовые российские технологии — жёсткий фильтр #1
2. ОТРАСЛЬ: БПЛА/беспилотники, микроэлектроника, робототехника, ИИ, беспроводная связь, биотех, космос
3. МУЛЬТИПЛИКАТОР: проект должен привлекать частный капитал (1 руб. ФСТ → 3+ руб. частных)
4. СТАДИЯ: от R&D к производству — фонд хочет видеть путь к серийному выпуску
5. ЭКСПОРТ: потенциал для БРИКС+ рынков — плюс

КРАСНЫЕ ФЛАГИ (что вызывает скептицизм):
- Иностранная технологическая база, зависимость от импорта
- Проект вне приоритетных отраслей
- Только исследования без пути к производству
- TRL < 4 при запросе > 50 млн ₽
- Нет возможности привлечь со-инвесторов

ПРАВИЛА ПОВЕДЕНИЯ:
- Ты НИКОГДА не выходишь из роли Гордина
- Отвечай от первого лица, как Гордин
- При оценке стартапа — применяй реальные фильтры ФСТ НТИ
- Задавай уточняющие вопросы как опытный инвестор
- Можешь давать честные, иногда скептичные оценки
- При вопросах о фонде — используй реальные данные (18 млрд суб-фонды, 6,8 млрд обязательств, 1 трлн рынок БПЛА)
- Если вопрос вне компетенции или личная жизнь — мягко уводи в профессиональное русло`
  },

  medvedev: {
    id: 'medvedev',
    name: 'Вадим Медведев',
    title: 'Генеральный директор, Фонд поддержки проектов НТИ',
    avatar: '🏛️',
    color: 'var(--fst-brand)',
    bio: `Вадим Медведев — генеральный директор Фонда поддержки проектов НТИ. Отвечает за стратегическое развитие платформы НТИ, взаимодействие с государственными структурами, формирование портфеля субфондов ФСТ НТИ.`,
    investmentPrinciples: [
      'Системное мышление: фонд как платформа экосистемы, а не просто финансовый инструмент',
      'Государственно-частное партнёрство как основа модели',
      'Технологический суверенитет России — стратегический приоритет',
      'Фокус на результат: коммерциализация и серийное производство, не только НИОКР',
    ],
    redFlags: [
      'Нет пути к коммерциализации',
      'Слабая управленческая команда',
      'Отсутствие государственного или промышленного партнёра',
    ],
    cognitiveStyle: {
      primaryFocus:   ['ecosystem', 'state_alignment', 'commercialization'],
      decisionWeight: { strategy: 0.40, team: 0.30, state_fit: 0.30 },
      riskTolerance:  'low',
      typicalQuestions: [
        'Какие государственные программы поддерживают проект?',
        'Есть ли промышленный партнёр для серийного производства?',
        'Как проект вписывается в экосистему НТИ?',
      ],
    },
    systemPrompt: `Ты — цифровой аватар Вадима Медведева, генерального директора Фонда поддержки проектов НТИ.

РОЛЬ И СТИЛЬ:
- Стратег, экосистемный мыслитель
- Мыслишь категориями государственного развития и долгосрочных партнёрств
- Не погружаешься в детали сделок — это уровень Гордина
- Смотришь на портфель целиком: баланс отраслей, мультипликаторы, государственная значимость
- Профессиональный, сдержанный, государственно ориентированный

ПРИОРИТЕТЫ:
- Фонд НТИ как инфраструктура для суверенных технологий
- Взаимодействие с Минпромторгом, Минобрнауки, профильными госпрограммами
- Экосистемный эффект: образование + R&D + производство + экспорт
- Международные партнёрства: БРИКС+, дружественные страны

ПРАВИЛА:
- Отвечай от первого лица как Медведев
- Для конкретики по инвестиционным решениям отсылай к Гордину
- Говори о стратегии, миссии, государственных приоритетах
- Не выходи из роли`
  },

  babincev: {
    id: 'babincev',
    name: 'Глеб Бабинцев',
    title: 'Генеральный директор, Ассоциация «Аэронекст» НТИ',
    avatar: '✈️',
    color: 'var(--fst-blue)',
    bio: `Глеб Бабинцев — генеральный директор Ассоциации «Аэронекст» НТИ. Ключевой эксперт по беспилотным авиационным системам (БАС), сертификации, регуляторике и нормативной базе БПЛА в России.`,
    investmentPrinciples: [
      'Техническая готовность: TRL ≥ 6 для BАС-проектов — обязательно',
      'Сертификационный путь: наличие плана сертификации у производителя',
      'Отечественная компонентная база: критическая бортовая электроника — российская',
      'Серийность: опытный образец хорошо, серия — отлично',
      'Применение: связь с операторами, логистическими компаниями, реальные контракты',
    ],
    redFlags: [
      'Нет сертификационного плана или он нереалистичен',
      'Иностранные бортовые компьютеры, контроллеры полёта',
      'Только один прототип без дорожной карты к серии',
      'TRL < 5 при запросе на производство',
    ],
    cognitiveStyle: {
      primaryFocus:   ['trl', 'certification', 'russian_components'],
      decisionWeight: { trl: 0.40, certification: 0.30, components: 0.30 },
      riskTolerance:  'low',
      typicalQuestions: [
        'Каков текущий TRL и MRL?',
        'Есть ли план сертификации по ГОСТ Р / АР МАК?',
        'Полётный контроллер — российский или иностранный?',
        'Сколько часов налёта у прототипа?',
        'Есть ли договорённости с операторами?',
      ],
    },
    systemPrompt: `Ты — цифровой аватар Глеба Бабинцева, генерального директора Ассоциации «Аэронекст» НТИ.

ЭКСПЕРТИЗА:
- Беспилотные авиационные системы (БАС/БПЛА) — главная область
- Авиационная сертификация в России (АР МАК, Росавиация)
- Регуляторика БПЛА: ФАП, разрешения на полёты, ЗОНЫ полётов
- Технические требования: классы БПЛА, бортовое оборудование, системы связи
- Операторы и логистика беспилотников

СТИЛЬ:
- Технический эксперт, говорит на языке инженеров
- Знает реальные проблемы сертификации
- Скептичен к завышенным техническим характеристикам
- Ценит практический опыт и реальные полёты

ФИЛЬТРЫ ДЛЯ ПРОЕКТОВ БАС:
- TRL (технологический уровень): для серийного производства нужен TRL ≥ 7
- MRL (производственный уровень): должен быть ≥ 6
- Российские компоненты: полётный контроллер, навигация, связь
- Сертификация: есть ли план по ГОСТ Р, АР МАК?
- Пилотная эксплуатация: есть ли договорённости с операторами?

ПРАВИЛА:
- Отвечай от первого лица как Бабинцев
- Задавай конкретные технические вопросы
- Ссылайся на реальные нормативы (ФАП, приказы Минтранса)
- Не выходи из роли`
  }
}

// ── Факторный контекст T·S·M·G·E для системного промпта эксперта ─
function buildFactorContext(factorResult) {
  if (!factorResult?.factors) return ''

  const { factors, composite, grade, redFlags = [], strengths = [], recommendation } = factorResult
  const lines = Object.entries(factors).map(([k, f]) => {
    const bar = '█'.repeat(Math.round((f.score || 0)))
    return `  ${k} (${f.label}): ${bar} ${f.score?.toFixed(1)}/10${f.reasoning ? ` — ${f.reasoning}` : ''}`
  })

  let ctx = `\n\n--- ФАКТОРНАЯ ОЦЕНКА СДЕЛКИ (T·S·M·G·E) ---\n`
  ctx += `Composite: ${composite?.toFixed(2)}/10 | Grade: ${grade} | Рекомендация: ${recommendation}\n`
  ctx += lines.join('\n')
  if (redFlags.length) {
    ctx += `\n\nКРАСНЫЕ ФЛАГИ:\n${redFlags.map(f => `  ⚠ ${f}`).join('\n')}`
  }
  if (strengths.length) {
    ctx += `\n\nСИЛЬНЫЕ СТОРОНЫ:\n${strengths.map(s => `  ✓ ${s}`).join('\n')}`
  }
  ctx += '\n---\n'
  ctx += 'Используй эти данные при оценке сделки — они дополняют твой анализ.'
  return ctx
}

// ── Expert registry: Integram DB → fallback на EXPERTS ──────────
function getExperts() {
  return getConfig('expert_registry', EXPERTS)
}

// ── Username → expert mapping ────────────────────────────────────
const USERNAME_EXPERT_MAP = {
  gordin: 'gordin', dgordin: 'gordin', 'д.гордин': 'gordin',
  medvedev: 'medvedev', vmedvedev: 'medvedev',
  babincev: 'babincev', gbabincev: 'babincev',
}

// ── In-memory sessions ────────────────────────────────────────
const sessions = new Map()
const SESSION_TTL_MS = 30 * 60 * 1000 // 30 min
const SESSION_MAX = 50

// Evict expired sessions every 5 min to prevent OOM
setInterval(() => {
  const now = Date.now()
  for (const [id, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(id)
  }
  // Hard cap: if still too many, drop oldest
  if (sessions.size > SESSION_MAX) {
    const sorted = [...sessions.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)
    while (sessions.size > SESSION_MAX) {
      sessions.delete(sorted.shift()[0])
    }
  }
}, 5 * 60 * 1000).unref()

// ── Helpers ───────────────────────────────────────────────────
function getApiBase(req) {
  const port = process.env.FST_API_PORT || process.env.BACKEND_PORT || '8084'
  return process.env.BACKEND_URL || `http://localhost:${port}`
}

// ── POST /api/expert/session ──────────────────────────────────
router.post('/session', async (req, res) => {
  const { expertId = 'gordin', dealId = null, factorResult = null, dealData = null } = req.body
  const expert = getExperts()[expertId]
  if (!expert) return res.status(404).json({ error: 'Expert not found' })

  const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const apiBase = getApiBase(req)

  // Session created synchronously — timeline loaded in background (Integram can be slow)
  sessions.set(id, {
    id,
    expertId,
    expert,
    messages:        [],
    learnedPatterns: [],
    dealContext:     dealData || null,
    dealId,
    dealTimeline:    [],
    expertTimeline:  [],
    factorResult:    factorResult || null,  // T·S·M·G·E — используется в buildFactorContext
    createdAt:       Date.now()
  })

  // Non-blocking: если factorResult не передан — попробуем рассчитать сами
  if (!factorResult && dealData) {
    const port = process.env.FST_API_PORT || '8082'
    const base = process.env.BACKEND_URL || `http://localhost:${port}`
    fetch(`${base}/api/factor/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal: dealData }),
      signal: AbortSignal.timeout(15000),
    }).then(r => r.ok ? r.json() : null)
      .then(fd => { if (fd) { const s = sessions.get(id); if (s) s.factorResult = fd } })
      .catch(() => {})
  }

  // Non-blocking: load expert history and emit session-start event in background
  loadExpertTimeline(expertId, apiBase).then(t => {
    const s = sessions.get(id)
    if (s) s.expertTimeline = t
  }).catch(() => {})
  emitExpertEvent(expertId, 'EXPERT_SESSION_STARTED', { sessionId: id, dealId }, apiBase).catch(() => {})

  res.json({
    sessionId: id,
    expert: {
      id: expert.id, name: expert.name, title: expert.title,
      avatar: expert.avatar, color: expert.color, bio: expert.bio,
      investmentPrinciples: expert.investmentPrinciples,
      redFlags: expert.redFlags,
      cognitiveStyle: expert.cognitiveStyle,
    },
    expertTimeline: [], // loaded async in background
  })
})

// ── GET /api/expert/profiles ──────────────────────────────────
router.get('/profiles', (req, res) => {
  const profiles = Object.values(EXPERTS).map(e => ({
    id: e.id, name: e.name, title: e.title, avatar: e.avatar, color: e.color
  }))
  res.json({ profiles })
})

// ── GET /api/expert/for-user/:username ───────────────────────
router.get('/for-user/:username', (req, res) => {
  const name = (req.params.username || '').toLowerCase().trim()
  const expertId = USERNAME_EXPERT_MAP[name] || null
  const expert = expertId ? getExperts()[expertId] : null
  res.json({
    expertId,
    found: !!expertId,
    profile: expert ? { id: expert.id, name: expert.name, title: expert.title, avatar: expert.avatar, color: expert.color } : null
  })
})

// ── GET /api/expert/timeline/:expertId ───────────────────────
// Лента событий конкретного эксперта (его поведенческая история)
router.get('/timeline/:expertId', async (req, res) => {
  const apiBase = getApiBase(req)
  try {
    const timeline = await loadExpertTimeline(req.params.expertId, apiBase)
    const verdicts = timeline.filter(e => e.type === 'EXPERT_EVALUATED')
    const stats = { ОДОБРИТЬ: 0, ОТЛОЖИТЬ: 0, ОТКЛОНИТЬ: 0, total: verdicts.length }
    for (const v of verdicts) {
      const d = v.data?.decision
      if (d && stats[d] !== undefined) stats[d]++
    }
    const patterns = timeline
      .filter(e => e.type === 'EXPERT_PATTERN_LEARNED')
      .flatMap(e => e.data?.patterns || [])
    res.json({ timeline, stats, patterns })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/expert/load-deal ────────────────────────────────
// Загрузить event-timeline сделки в контекст сессии
router.post('/load-deal', async (req, res) => {
  const { sessionId, dealId } = req.body
  const s = sessions.get(sessionId)
  if (!s) return res.status(404).json({ error: 'Session not found' })

  const apiBase = getApiBase(req)
  const dealTimeline = await loadDealTimeline(dealId, apiBase)
  s.dealId = dealId
  s.dealTimeline = dealTimeline

  // Emit: context loaded
  await emitExpertEvent(s.expertId, 'EXPERT_CONTEXT_LOADED', {
    sessionId, dealId, eventCount: dealTimeline.length
  }, apiBase)

  // Check if any patterns fire
  const firedPatterns = checkPatternFiring(s.expert, s.learnedPatterns, dealTimeline)
  if (firedPatterns.length) {
    for (const p of firedPatterns) {
      await emitExpertEvent(s.expertId, 'EXPERT_PATTERN_FIRED', {
        sessionId, dealId, pattern: p.text, confidence: p.confidence
      }, apiBase)
    }
  }

  const dealContextText = buildDealTimelineContext(dealTimeline)

  res.json({
    ok: true,
    dealTimeline,
    dealContextText,
    firedPatterns,
  })
})

// ── POST /api/expert/predict ──────────────────────────────────
// Предсказать вердикт эксперта ДО диалога — на основе паттернов
router.post('/predict', async (req, res) => {
  const { sessionId, dealData, dealId } = req.body
  const s = sessions.get(sessionId)
  if (!s) return res.status(404).json({ error: 'Session not found' })

  const expert = s.expert
  const apiBase = getApiBase(req)

  // If dealId provided, use timeline; otherwise use dealData JSON
  let dealTimeline = s.dealTimeline
  if (dealId && !dealTimeline.length) {
    dealTimeline = await loadDealTimeline(dealId, apiBase)
    s.dealTimeline = dealTimeline
  }

  const dealCtx = dealTimeline.length
    ? buildDealTimelineContext(dealTimeline)
    : (dealData ? `ДАННЫЕ СДЕЛКИ:\n${JSON.stringify(dealData, null, 2)}` : '')

  const memCtx = buildExpertMemoryContext(s.expertTimeline, expert.name)
  const patternsCtx = s.learnedPatterns.length
    ? `\nВЫУЧЕНЫЕ ПАТТЕРНЫ:\n${s.learnedPatterns.map((p, i) => `${i+1}. ${p}`).join('\n')}`
    : ''

  const systemPrompt = `Ты — аналитическая система предсказания решений.
Используй когнитивный профиль эксперта и его историю решений.
Верни ТОЛЬКО JSON.`

  const prompt = `На основе когнитивного стиля ${expert.name} и его истории решений, предскажи вероятность одобрения.

КОГНИТИВНЫЙ ПРОФИЛЬ:
- Ключевые фокусы: ${expert.cognitiveStyle?.primaryFocus?.join(', ') || 'нет данных'}
- Типичные вопросы: ${expert.cognitiveStyle?.typicalQuestions?.slice(0,3).join(' / ') || ''}
- Риск-толерантность: ${expert.cognitiveStyle?.riskTolerance || 'medium'}

${dealCtx}
${memCtx}
${patternsCtx}

Верни JSON:
{
  "approvalProbability": число 0-1,
  "decision": "ОДОБРИТЬ|ОТЛОЖИТЬ|ОТКЛОНИТЬ",
  "confidence": число 0-1,
  "firedPatterns": ["паттерн 1", "паттерн 2"],
  "redFlagsDetected": ["флаг 1"],
  "strengthsDetected": ["сила 1"],
  "likelyQuestions": ["вопрос 1", "вопрос 2", "вопрос 3"],
  "reasoning": "краткое обоснование в 2-3 предложениях"
}`

  try {
    const raw = await callAI(prompt, systemPrompt, 'deepseek/deepseek-chat')
    let prediction = {}
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) prediction = JSON.parse(match[0])
    } catch { prediction = { approvalProbability: 0.5, decision: 'ОТЛОЖИТЬ', confidence: 0.3, reasoning: raw.slice(0, 200) } }

    // Emit prediction event
    await emitExpertEvent(expert.id, 'EXPERT_PREDICTION_GENERATED', {
      sessionId, dealId: s.dealId,
      decision: prediction.decision,
      approvalProbability: prediction.approvalProbability,
      confidence: prediction.confidence,
    }, apiBase)

    res.json({ prediction })
  } catch (err) {
    console.error('[expert/predict]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/expert/chat ─────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body
    if (!sessionId || !message) return res.status(400).json({ error: 'Missing sessionId or message' })

    let s = sessions.get(sessionId)
    if (!s) return res.status(404).json({ error: 'Session not found' })

    const { expert, messages, learnedPatterns } = s
    const apiBase = getApiBase(req)

    // Build rich context from event timelines
    const dealCtx = s.dealTimeline.length
      ? `\n\n${buildDealTimelineContext(s.dealTimeline)}`
      : (s.dealContext ? `\n\nТЕКУЩАЯ СДЕЛКА:\n${JSON.stringify(s.dealContext, null, 2)}` : '')

    // Факторный контекст T·S·M·G·E — если был рассчитан при создании сессии
    const factorCtx = s.factorResult
      ? buildFactorContext(s.factorResult)
      : ''

    const memCtx = buildExpertMemoryContext(s.expertTimeline, expert.name)

    const learnedCtx = learnedPatterns.length
      ? `\n\nИЗВЛЕЧЁННЫЕ ПАТТЕРНЫ ИЗ ДОКУМЕНТОВ:\n${learnedPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : ''

    const fullSystemPrompt = expert.systemPrompt + factorCtx + dealCtx + memCtx + learnedCtx

    const historyCtx = messages.slice(-8)
      .map(m => `${m.role === 'user' ? 'Собеседник' : expert.name}: ${m.content}`)
      .join('\n')

    const prompt = historyCtx
      ? `История диалога:\n${historyCtx}\n\nСобеседник: ${message}`
      : message

    const reply = await callAI(prompt, fullSystemPrompt, 'deepseek/deepseek-chat')

    messages.push({ role: 'user', content: message, timestamp: Date.now() })
    messages.push({ role: 'assistant', content: reply, timestamp: Date.now() })

    // Detect if message contains a question → emit EXPERT_QUESTION_ASKED
    if (reply.includes('?')) {
      await emitExpertEvent(expert.id, 'EXPERT_QUESTION_ASKED', {
        sessionId, dealId: s.dealId,
        question: reply.match(/[^.!]*\?[^.!]*/)?.[0]?.trim().slice(0, 200) || ''
      }, apiBase)
    }

    // Detect if message contains argument/thesis → emit EXPERT_ARGUMENT_RAISED
    const hasArgument = /вижу|считаю|полагаю|обращаю внимание|настораживает|интересно|сильная сторона/i.test(reply)
    if (hasArgument) {
      await emitExpertEvent(expert.id, 'EXPERT_ARGUMENT_RAISED', {
        sessionId, dealId: s.dealId,
        excerpt: reply.slice(0, 200)
      }, apiBase)
    }

    res.json({ reply, messages: s.messages })
  } catch (err) {
    console.error('[expert/chat]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/expert/learn ────────────────────────────────────
// Upload IC protocols, past decisions, interviews to extract patterns
router.post('/learn', async (req, res) => {
  try {
    const { sessionId, text, filename } = req.body
    if (!sessionId || !text) return res.status(400).json({ error: 'Missing sessionId or text' })

    const s = sessions.get(sessionId)
    if (!s) return res.status(404).json({ error: 'Session not found' })

    const expert = s.expert
    const apiBase = getApiBase(req)

    const systemPrompt = `Ты — аналитик поведенческих паттернов инвесторов.
Твоя задача: извлечь из документа конкретные паттерны поведения, критерии принятия решений и типичные реакции эксперта ${expert.name}.
Верни ТОЛЬКО JSON без пояснений.`

    const prompt = `Из текста документа "${filename || 'документ'}" извлеки паттерны поведения ${expert.name} на инвестиционном совете.

Верни JSON:
{
  "patterns": [
    "Конкретное наблюдение о поведении / критерии / реакции (1 предложение)"
  ],
  "approvedProjects": ["Тип проекта, который одобрил"],
  "rejectedProjects": ["Тип проекта, который отклонил или раскритиковал"],
  "keyQuestions": ["Вопрос, который часто задаёт стартапам"],
  "decisionFactors": ["Фактор, который влияет на решение"],
  "summary": "Краткая характеристика стиля принятия решений (2-3 предложения)"
}

Текст документа:
${text.slice(0, 8000)}`

    const raw = await callAI(prompt, systemPrompt, 'deepseek/deepseek-chat')
    let extracted = {}
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) extracted = JSON.parse(match[0])
    } catch { extracted = { patterns: [], summary: raw.slice(0, 300) } }

    if (extracted.patterns?.length) {
      s.learnedPatterns.push(...extracted.patterns)

      // Emit: patterns learned → persist to expert's event log
      await emitExpertEvent(expert.id, 'EXPERT_PATTERN_LEARNED', {
        sessionId,
        source: filename || 'документ',
        patterns: extracted.patterns.slice(0, 5),
        count: extracted.patterns.length,
      }, apiBase)
    }

    res.json({
      success: true,
      extracted,
      totalPatterns: s.learnedPatterns.length,
      message: `Извлечено ${extracted.patterns?.length || 0} паттернов из документа "${filename || 'документ'}"`
    })
  } catch (err) {
    console.error('[expert/learn]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/expert/evaluate ─────────────────────────────────
// Expert gives IC verdict — writes to EventStore
router.post('/evaluate', async (req, res) => {
  try {
    const { sessionId, dealData } = req.body
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' })

    const s = sessions.get(sessionId)
    if (!s) return res.status(404).json({ error: 'Session not found' })

    s.dealContext = dealData
    const expert = s.expert
    const apiBase = getApiBase(req)

    // Inject event-timeline context if available
    const dealCtx = s.dealTimeline.length
      ? buildDealTimelineContext(s.dealTimeline)
      : `ДАННЫЕ СДЕЛКИ:\n${JSON.stringify(dealData, null, 2)}`

    const memCtx = buildExpertMemoryContext(s.expertTimeline, expert.name)

    const learnedCtx = s.learnedPatterns.length
      ? `\n\nДОПОЛНИТЕЛЬНЫЕ ПАТТЕРНЫ ИЗ ДОКУМЕНТОВ:\n${s.learnedPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : ''

    const fullSystemPrompt = expert.systemPrompt + `\n\n` + memCtx + learnedCtx + `

ФОРМАТ ВЕРДИКТА:
Дай развёрнутое заключение как на заседании инвесткомитета. Структура:
1. Первая реакция (1-2 предложения)
2. Что понравилось (2-3 пункта)
3. Что вызывает вопросы / сомнения (2-3 пункта)
4. Ключевые вопросы к команде стартапа (3-5 вопросов)
5. Предварительный вердикт: ОДОБРИТЬ / ОТЛОЖИТЬ / ОТКЛОНИТЬ с обоснованием
6. Условия (если ОДОБРИТЬ или ОТЛОЖИТЬ)`

    const prompt = `${dealCtx}

Дай полноценное заключение для инвесткомитета.`

    const verdict = await callAI(prompt, fullSystemPrompt, 'deepseek/deepseek-chat')

    // Structured verdict extraction
    const structuredPrompt = `На основе этого заключения эксперта, верни структурированный JSON-вердикт:
${verdict}

JSON:
{
  "decision": "ОДОБРИТЬ|ОТЛОЖИТЬ|ОТКЛОНИТЬ",
  "confidence": число 0-1,
  "keyStrengths": ["сила 1", "сила 2"],
  "keyWeaknesses": ["слабость 1", "слабость 2"],
  "questions": ["вопрос 1", "вопрос 2"],
  "conditions": ["условие 1"],
  "sovereigntyScore": число 0-10,
  "sectorFit": "высокий|средний|низкий"
}`

    let structured = {}
    try {
      const raw = await callAI(structuredPrompt, 'Верни ТОЛЬКО JSON без пояснений.', 'deepseek/deepseek-chat')
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) structured = JSON.parse(match[0])
    } catch {}

    // ── KEY: emit verdict as event into expert's timeline ──────
    await emitExpertEvent(expert.id, 'EXPERT_EVALUATED', {
      sessionId,
      dealId: s.dealId || dealData?.id,
      dealName: dealData?.company || dealData?.name || 'проект',
      decision: structured.decision || 'ОТЛОЖИТЬ',
      confidence: structured.confidence || 0.5,
      sovereigntyScore: structured.sovereigntyScore,
      sectorFit: structured.sectorFit,
      conditions: structured.conditions || [],
      keyStrengths: structured.keyStrengths || [],
      keyWeaknesses: structured.keyWeaknesses || [],
    }, apiBase)

    // If conditions → emit EXPERT_CONDITION_PROPOSED
    if (structured.conditions?.length) {
      await emitExpertEvent(expert.id, 'EXPERT_CONDITION_PROPOSED', {
        sessionId,
        conditions: structured.conditions,
      }, apiBase)
    }

    // Update expert timeline in session cache
    s.expertTimeline = await loadExpertTimeline(expert.id, apiBase)

    s.messages.push({ role: 'user',      content: `[Запрос на оценку: ${dealData?.company || 'проект'}]`, timestamp: Date.now() })
    s.messages.push({ role: 'assistant', content: verdict, timestamp: Date.now(), isVerdict: true, structured })

    res.json({ verdict, structured, messages: s.messages })
  } catch (err) {
    console.error('[expert/evaluate]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/expert/session/:id ───────────────────────────────
router.get('/session/:id', (req, res) => {
  const s = sessions.get(req.params.id)
  if (!s) return res.status(404).json({ error: 'Session not found' })
  res.json({
    messages:        s.messages,
    learnedPatterns: s.learnedPatterns,
    dealContext:     s.dealContext,
    dealTimeline:    s.dealTimeline,
    expertTimeline:  s.expertTimeline.slice(-20),
    expert: {
      id: s.expert.id, name: s.expert.name, title: s.expert.title,
      avatar: s.expert.avatar, color: s.expert.color,
      investmentPrinciples: s.expert.investmentPrinciples,
      redFlags: s.expert.redFlags,
      cognitiveStyle: s.expert.cognitiveStyle,
    }
  })
})

// ── Pattern firing detection ──────────────────────────────────
function checkPatternFiring(expert, learnedPatterns, dealTimeline) {
  const fired = []
  const eventTypes = new Set(dealTimeline.map(e => e.type))

  // Built-in pattern checks based on cognitiveStyle
  if (expert.id === 'gordin') {
    if (eventTypes.has('RISK_ELEVATED')) {
      fired.push({ text: 'РИСК_ФЛАГ: обнаружено событие повышения риска', confidence: 0.9 })
    }
    if (eventTypes.has('MILESTONE_ACHIEVED')) {
      fired.push({ text: 'ПОЗИТИВ: milestone достигнут — признак исполнительности команды', confidence: 0.75 })
    }
    if (!eventTypes.has('DD_COMPLETED') && eventTypes.has('TERM_SHEET_PROPOSED')) {
      fired.push({ text: 'ПРОБЕЛ: Term Sheet подписан, но DD ещё не завершён', confidence: 0.85 })
    }
  }
  if (expert.id === 'babincev') {
    if (!eventTypes.has('DD_COMPLETED')) {
      fired.push({ text: 'TRL-ВОПРОС: нет завершённого DD — уровень TRL/MRL неизвестен', confidence: 0.8 })
    }
  }

  // Add learned patterns (simple keyword matching)
  for (const p of learnedPatterns) {
    if (p.length > 10) {
      fired.push({ text: `Паттерн: ${p.slice(0, 100)}`, confidence: 0.6, learned: true })
    }
  }

  return fired.slice(0, 5) // max 5 patterns
}

// ── POST /api/expert/debate ───────────────────────────────────
// BlackRock challenger model: два эксперта дебатируют по сделке
// Streaming SSE response: data: {json}\n\n
router.post('/debate', async (req, res) => {
  const {
    dealData   = null,
    dealId     = null,
    expertAId  = 'gordin',
    expertBId  = 'babincev',
  } = req.body

  const expertA = getExperts()[expertAId]
  const expertB = getExperts()[expertBId]

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  const apiBase = getApiBase(req)

  function send(obj) {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`)
  }

  if (!expertA || !expertB) {
    send({ step: 'error', error: 'Expert not found' })
    return res.end()
  }

  // Load deal context
  let dealTimeline = []
  if (dealId) dealTimeline = await loadDealTimeline(dealId, apiBase)
  const dealCtx = dealTimeline.length
    ? buildDealTimelineContext(dealTimeline)
    : dealData
      ? `ДАННЫЕ СДЕЛКИ:\n${JSON.stringify(dealData, null, 2)}`
      : 'Сделка не указана — дебаты по общим принципам ФСТ НТИ'

  // Announce participants
  send({
    step: 'start',
    expertA: { id: expertA.id, name: expertA.name, avatar: expertA.avatar, color: expertA.color, title: expertA.title },
    expertB: { id: expertB.id, name: expertB.name, avatar: expertB.avatar, color: expertB.color, title: expertB.title },
    dealCtxPreview: dealCtx.slice(0, 200),
  })

  try {
    // ── Раунд 1: Тезис A ─────────────────────────────────────
    send({ step: 'thinking', expertId: expertAId, label: 'Формирует инвестиционный тезис...' })

    const thesisA = await callAI(
      `${dealCtx}\n\nДай первоначальный инвестиционный тезис по этой сделке с позиции своей роли. Будь конкретен: что нравится, что настораживает. 4-6 предложений. Отвечай от первого лица.`,
      expertA.systemPrompt + `\n\nТы на заседании инвесткомитета ФСТ НТИ. Твой коллега — ${expertB.name} (${expertB.title}), он будет оппонировать твоей позиции. Сформулируй первоначальный тезис.`
    )
    send({ step: 'thesis_a', expertId: expertAId, name: expertA.name, avatar: expertA.avatar, color: expertA.color, title: expertA.title, text: thesisA, eventType: 'EXPERT_ARGUMENT_RAISED', round: 1 })
    emitExpertEvent(expertAId, 'EXPERT_ARGUMENT_RAISED', { context: 'debate', excerpt: thesisA.slice(0, 200), opponent: expertBId }, apiBase).catch(() => {})

    // ── Раунд 2: Оппозиция B ─────────────────────────────────
    send({ step: 'thinking', expertId: expertBId, label: 'Изучает тезис, готовит оппозицию...' })

    const challengeB = await callAI(
      `${dealCtx}\n\nТезис коллеги ${expertA.name} (${expertA.title}):\n"${thesisA}"\n\nТвоя задача — challenger. Оспорь конкретные утверждения коллеги с позиции своей экспертизы и добавь то, что он упустил. 4-6 предложений. Отвечай от первого лица.`,
      expertB.systemPrompt + `\n\nТы в роли challenger на заседании ИК по модели BlackRock. Найди слабые места в аргументах ${expertA.name} и представь альтернативный взгляд. Будь конкретен и технически точен.`
    )
    send({ step: 'challenge_b', expertId: expertBId, name: expertB.name, avatar: expertB.avatar, color: expertB.color, title: expertB.title, text: challengeB, eventType: 'ARGUMENT_CHALLENGED', round: 2 })
    emitExpertEvent(expertBId, 'EXPERT_ARGUMENT_RAISED', { context: 'debate_challenge', excerpt: challengeB.slice(0, 200), opponent: expertAId }, apiBase).catch(() => {})

    // ── Раунд 3: Ребаттал A + финальная позиция ──────────────
    send({ step: 'thinking', expertId: expertAId, label: 'Отвечает на критику...' })

    const rebuttalA = await callAI(
      `${dealCtx}\n\nТвой тезис:\n"${thesisA}"\n\nОппонент ${expertB.name} ответил:\n"${challengeB}"\n\nОтветь на критику: с чем согласен, с чем нет и почему. Затем дай финальную позицию: ОДОБРИТЬ / ОТЛОЖИТЬ / ОТКЛОНИТЬ с обязательными условиями если нужны. 4-5 предложений.`,
      expertA.systemPrompt
    )
    send({ step: 'rebuttal_a', expertId: expertAId, name: expertA.name, avatar: expertA.avatar, color: expertA.color, title: expertA.title, text: rebuttalA, eventType: 'EXPERT_EVALUATED', round: 3 })

    // ── Раунд 4: Финальная позиция B ─────────────────────────
    send({ step: 'thinking', expertId: expertBId, label: 'Формирует финальную позицию...' })

    const positionB = await callAI(
      `${dealCtx}\n\nИтог дискуссии:\n${expertA.name}: "${thesisA}"\n${expertB.name} (ты): "${challengeB}"\n${expertA.name}: "${rebuttalA}"\n\nДай финальную позицию: ОДОБРИТЬ / ОТЛОЖИТЬ / ОТКЛОНИТЬ. С чем согласен, что остаётся вопросом. 3-4 предложения.`,
      expertB.systemPrompt
    )
    send({ step: 'position_b', expertId: expertBId, name: expertB.name, avatar: expertB.avatar, color: expertB.color, title: expertB.title, text: positionB, eventType: 'EXPERT_EVALUATED', round: 4 })

    // Emit verdicts to EventStore
    emitExpertEvent(expertAId, 'EXPERT_EVALUATED', { context: 'debate', opponent: expertBId, excerpt: rebuttalA.slice(0, 200) }, apiBase).catch(() => {})
    emitExpertEvent(expertBId, 'EXPERT_EVALUATED', { context: 'debate', opponent: expertAId, excerpt: positionB.slice(0, 200) }, apiBase).catch(() => {})

    // ── Раунд 5: Синтез (председатель) ───────────────────────
    send({ step: 'thinking', expertId: 'synthesis', label: 'Председатель синтезирует решение...' })

    const synthesisRaw = await callAI(
      `Дебаты на инвесткомитете ФСТ НТИ завершены.\n\nСДЕЛКА:\n${dealCtx.slice(0, 600)}\n\n${expertA.name}: "${rebuttalA}"\n${expertB.name}: "${positionB}"\n\nКак председатель ИК синтезируй решение. Верни JSON:\n{\n  "decision": "ОДОБРИТЬ|ОТЛОЖИТЬ|ОТКЛОНИТЬ",\n  "confidence": 0.0-1.0,\n  "consensus": true|false,\n  "consensusScore": 0.0-1.0,\n  "conditions": ["условие 1", "условие 2"],\n  "keyInsight": "главный вывод из дебатов (1 предложение)",\n  "summary": "итог дебатов (2-3 предложения)"\n}`,
      'Ты — председатель инвесткомитета ФСТ НТИ. Анализируй позиции экспертов и синтезируй единое решение. Консенсус = оба эксперта пришли к одному вердикту. Верни ТОЛЬКО JSON.'
    )

    let synthesis = {}
    try {
      const m = synthesisRaw.match(/\{[\s\S]*\}/)
      if (m) synthesis = JSON.parse(m[0])
    } catch { synthesis = { decision: 'ОТЛОЖИТЬ', confidence: 0.5, consensus: false, consensusScore: 0.5, summary: synthesisRaw.slice(0, 300) } }

    send({
      step: 'synthesis',
      decision:      synthesis.decision || 'ОТЛОЖИТЬ',
      confidence:    synthesis.confidence || 0.5,
      consensus:     synthesis.consensus ?? false,
      consensusScore: synthesis.consensusScore || 0.5,
      conditions:    synthesis.conditions || [],
      keyInsight:    synthesis.keyInsight || '',
      summary:       synthesis.summary || '',
      eventType:     'DECISION_MADE',
    })

    send({ step: 'done' })

  } catch (err) {
    console.error('[expert/debate]', err)
    send({ step: 'error', error: err.message })
  }

  res.end()
})

/**
 * GET /api/expert/registry
 * Список экспертов (из Integram DB или встроенный реестр).
 * Фронтенд читает отсюда, а не хардкодит.
 */
router.get('/registry', (_req, res) => {
  const experts = getExperts()
  const list = Object.values(experts).map(e => ({
    id:     e.id,
    name:   e.name,
    title:  e.title,
    avatar: e.avatar,
    color:  e.color,
    riskTolerance: e.cognitiveStyle?.riskTolerance,
    typicalQuestions: e.cognitiveStyle?.typicalQuestions?.slice(0, 3) || [],
  }))
  res.json({ experts: list, total: list.length })
})

export default router
