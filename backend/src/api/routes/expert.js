import { Router } from 'express'
import fetch from 'node-fetch'

const router = Router()

// ── AI call helper ─────────────────────────────────────────────
async function callAI(prompt, systemPrompt, modelId = 'deepseek/deepseek-chat') {
  const apiBase = process.env.BACKEND_URL || 'http://localhost:8082'
  const r = await fetch(`${apiBase}/api/ai-tokens/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, prompt, systemPrompt, application: 'ExpertAvatar' }),
    signal: AbortSignal.timeout(60000)
  })
  if (!r.ok) throw new Error(`AI call failed: ${r.status}`)
  const d = await r.json()
  return d.response || d.content || ''
}

// ── Expert registry ─────────────────────────────────────────────
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

// ── Username → expert mapping ────────────────────────────────────
const USERNAME_EXPERT_MAP = {
  gordin: 'gordin', dgordin: 'gordin', 'д.гордин': 'gordin',
  medvedev: 'medvedev', vmedvedev: 'medvedev',
  babincev: 'babincev', gbabincev: 'babincev',
}

// ── In-memory sessions
const sessions = new Map()

// ── POST /api/expert/session ────────────────────────────────────
router.post('/session', (req, res) => {
  const { expertId = 'gordin' } = req.body
  const expert = EXPERTS[expertId]
  if (!expert) return res.status(404).json({ error: 'Expert not found' })

  const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  sessions.set(id, {
    id,
    expertId,
    expert,
    messages: [],
    learnedPatterns: [],
    dealContext: null,
    createdAt: Date.now()
  })
  res.json({ sessionId: id, expert: { id: expert.id, name: expert.name, title: expert.title, avatar: expert.avatar, color: expert.color, bio: expert.bio, investmentPrinciples: expert.investmentPrinciples, redFlags: expert.redFlags } })
})

// ── GET /api/expert/profiles ─────────────────────────────────────
router.get('/profiles', (req, res) => {
  const profiles = Object.values(EXPERTS).map(e => ({
    id: e.id, name: e.name, title: e.title, avatar: e.avatar, color: e.color
  }))
  res.json({ profiles })
})

// ── GET /api/expert/for-user/:username ──────────────────────────
// Возвращает expertId по имени пользователя из Integram
router.get('/for-user/:username', (req, res) => {
  const name = (req.params.username || '').toLowerCase().trim()
  const expertId = USERNAME_EXPERT_MAP[name] || null
  const expert = expertId ? EXPERTS[expertId] : null
  res.json({
    expertId,
    found: !!expertId,
    profile: expert ? { id: expert.id, name: expert.name, title: expert.title, avatar: expert.avatar, color: expert.color } : null
  })
})

// ── POST /api/expert/chat ───────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body
    if (!sessionId || !message) return res.status(400).json({ error: 'Missing sessionId or message' })

    let s = sessions.get(sessionId)
    if (!s) return res.status(404).json({ error: 'Session not found' })

    const { expert, messages, learnedPatterns, dealContext } = s

    // Build context for the avatar
    const learnedCtx = learnedPatterns.length > 0
      ? `\nИЗВЛЕЧЁННЫЕ ПАТТЕРНЫ ИЗ ЗАГРУЖЕННЫХ ДОКУМЕНТОВ:\n${learnedPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : ''

    const dealCtx = dealContext
      ? `\nТЕКУЩАЯ СДЕЛКА НА РАССМОТРЕНИИ:\n${JSON.stringify(dealContext, null, 2)}`
      : ''

    const fullSystemPrompt = expert.systemPrompt + learnedCtx + dealCtx

    const historyCtx = messages.slice(-8)
      .map(m => `${m.role === 'user' ? 'Собеседник' : expert.name}: ${m.content}`)
      .join('\n')

    const prompt = historyCtx
      ? `История диалога:\n${historyCtx}\n\nСобеседник: ${message}`
      : message

    const reply = await callAI(prompt, fullSystemPrompt, 'anthropic/claude-sonnet-4-20250514')

    messages.push({ role: 'user', content: message, timestamp: Date.now() })
    messages.push({ role: 'assistant', content: reply, timestamp: Date.now() })

    res.json({ reply, messages: s.messages })
  } catch (err) {
    console.error('[expert/chat]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/expert/learn ──────────────────────────────────────
// Upload IC protocols, past decisions, interviews to extract patterns
router.post('/learn', async (req, res) => {
  try {
    const { sessionId, text, filename } = req.body
    if (!sessionId || !text) return res.status(400).json({ error: 'Missing sessionId or text' })

    const s = sessions.get(sessionId)
    if (!s) return res.status(404).json({ error: 'Session not found' })

    const expert = s.expert

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

    const raw = await callAI(prompt, systemPrompt, 'anthropic/claude-sonnet-4-20250514')
    let extracted = {}
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) extracted = JSON.parse(match[0])
    } catch { extracted = { patterns: [], summary: raw.slice(0, 300) } }

    // Merge patterns into session
    if (extracted.patterns?.length) {
      s.learnedPatterns.push(...extracted.patterns)
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

// ── POST /api/expert/evaluate ───────────────────────────────────
// Expert gives IC verdict on a startup
router.post('/evaluate', async (req, res) => {
  try {
    const { sessionId, dealData } = req.body
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' })

    const s = sessions.get(sessionId)
    if (!s) return res.status(404).json({ error: 'Session not found' })

    s.dealContext = dealData

    const expert = s.expert
    const learnedCtx = s.learnedPatterns.length > 0
      ? `\nДОПОЛНИТЕЛЬНЫЕ ПАТТЕРНЫ ИЗ ДОКУМЕНТОВ:\n${s.learnedPatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : ''

    const fullSystemPrompt = expert.systemPrompt + learnedCtx + `

ФОРМАТ ВЕРДИКТА:
Дай развёрнутое заключение как на заседании инвесткомитета. Структура:
1. Первая реакция (1-2 предложения)
2. Что понравилось (2-3 пункта)
3. Что вызывает вопросы / сомнения (2-3 пункта)
4. Ключевые вопросы к команде стартапа (3-5 вопросов)
5. Предварительный вердикт: ОДОБРИТЬ / ОТЛОЖИТЬ / ОТКЛОНИТЬ с обоснованием
6. Условия (если ОДОБРИТЬ или ОТЛОЖИТЬ)`

    const prompt = `Оцени следующий стартап с позиции инвестиционного директора ФСТ НТИ:

${JSON.stringify(dealData, null, 2)}

Дай полноценное заключение для инвесткомитета.`

    const verdict = await callAI(prompt, fullSystemPrompt, 'anthropic/claude-sonnet-4-20250514')

    // Also extract structured verdict
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

    // Add to chat history
    s.messages.push({
      role: 'user',
      content: `[Запрос на оценку стартапа: ${dealData?.company || 'проект'}]`,
      timestamp: Date.now()
    })
    s.messages.push({
      role: 'assistant',
      content: verdict,
      timestamp: Date.now(),
      isVerdict: true,
      structured
    })

    res.json({ verdict, structured, messages: s.messages })
  } catch (err) {
    console.error('[expert/evaluate]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/expert/session/:id ─────────────────────────────────
router.get('/session/:id', (req, res) => {
  const s = sessions.get(req.params.id)
  if (!s) return res.status(404).json({ error: 'Session not found' })
  res.json({
    messages: s.messages,
    learnedPatterns: s.learnedPatterns,
    dealContext: s.dealContext,
    expert: {
      id: s.expert.id, name: s.expert.name, title: s.expert.title,
      avatar: s.expert.avatar, color: s.expert.color,
      investmentPrinciples: s.expert.investmentPrinciples,
      redFlags: s.expert.redFlags
    }
  })
})

export default router
