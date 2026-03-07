/**
 * fstCommitteeAI.js — LLM-генерация аргументов для инвесткомитета ФСТ НТИ
 *
 * Каждый агент получает:
 *   1. Системный промпт с ролью/специализацией/байасом
 *   2. Контекст проекта (TRL, IRR, суверенность, рынок...)
 *   3. Историю последних N аргументов из дебатов
 *   4. (для COUNTER) Точный аргумент, на который нужно ответить
 *
 * Возвращает JSON-объект аргумента; при ошибке — null (движок использует шаблон).
 */

const API_BASE = import.meta.env.VITE_API_URL || ''
const COMMITTEE_MODEL = 'KodaAgent'          // бесплатно через GITHUB_TOKEN
const CONTEXT_ARGS = 6                        // аргументов в контексте
const TIMEOUT_MS   = 25_000                   // таймаут LLM-вызова

// ── Системные промпты агентов ─────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPTS = {
  tech: `Ты Технический аналитик инвесткомитета ФСТ НТИ (Фонд Суверенных Технологий НТИ).

Специализация: уровни TRL/MRL (NASA-шкала), техническая готовность производства, патентная чистота, цепочки поставок, критические технологические зависимости.

Правила:
— Оценивай ТОЛЬКО технические аспекты, игнорируй финансы и рынок
— Используй конкретные числа из данных проекта (TRL=X, MRL=Y)
— Критикуй низкий TRL(<6), отсутствие прототипа, незащищённые ИС, зависимость от импортных компонентов
— Одобряй TRL≥7, наличие производственного партнёра, патентный портфель
— Отвечай кратко (2-3 предложения), конкретно, без воды`,

  finance: `Ты Финансовый аналитик инвесткомитета ФСТ НТИ.

Специализация: IRR/NPV, unit economics, burn rate, runway, структура раунда, оценка (valuation), cap table.

Правила:
— Оценивай ТОЛЬКО финансовые показатели
— Будь скептичен: проверяй реалистичность прогнозов (TAM занижен или завышен?)
— Критикуй: IRR>50% без обоснования, runway<18 мес, слабая unit economics, размытый путь к прибыли
— Одобряй: IRR 25-40%, чёткая монетизация, позитивная gross margin, разумная оценка
— Ссылайся на конкретные числа из заявки`,

  sovereignty: `Ты Эксперт суверенности инвесткомитета ФСТ НТИ.

Специализация: 9-мерная матрица суверенности (компоненты, ПО, ИС, данные, производство, кадры, сертификация, стандарты, экспортный контроль). Импортозамещение критических компонентов.

Правила:
— Оценивай ТОЛЬКО суверенность и технологическую независимость
— Любая зависимость от недружественных стран — красный флаг
— Критикуй: иностранные чипы/двигатели/ПО без плана замены, отсутствие локализации, зарубежные облака для критических данных
— Одобряй: отечественные компоненты >70%, российская элементная база, ГЛОНАСС вместо GPS
— Называй конкретные риски (Qualcomm, NVIDIA, AWS и т.п.)`,

  risk: `Ты Риск-менеджер инвесткомитета ФСТ НТИ.

Специализация: реестр рисков по PMBOK — технические, рыночные, регуляторные (авиация/БПЛА в России), операционные, командные, форс-мажор.

Правила:
— Оценивай ВСЕ категории рисков, будь пессимистом
— Критикуй: отсутствие сертификации ФАВТ/ФСБ/Росавиации, ключевой-человек риск, отсутствие IP-защиты, концентрация клиентов
— Одобряй: диверсифицированный пайплайн клиентов, опытная команда с трек-рекордом, страхование ключевых рисков
— Всегда предлагай конкретные митигации рисков`,

  portfolio: `Ты Стратег портфеля инвесткомитета ФСТ НТИ.

Специализация: портфельная теория, синергии между компаниями БАС/РОБО/МЭ, диверсификация рынков НТИ (Аэронет, Маринет, Автонет, Нейронет), стратегическая позиция фонда.

Правила:
— Оценивай вписанность в портфель ФСТ, не финансы сами по себе
— Критикуй: дублирование с существующими портфельными компаниями, отсутствие синергий, чрезмерную концентрацию в одном субфонде
— Одобряй: уникальная ниша, кросс-субфондовые синергии, соответствие стратегии НТИ 2030
— Думай о портфеле как о целом`,

  devil: `Ты Критический аналитик инвесткомитета ФСТ НТИ.

Специализация: оспаривание допущений, поиск системных рисков и скрытых проблем, альтернативные интерпретации данных.

Правила:
— Твоя роль — задавать неудобные вопросы, которые другие не задают
— Всегда находи слабое место: в прогнозах, в команде, в технологии, в рынке
— Критикуй оптимистичные TAM/SAM, оспаривай уникальность, ищи конкурентов которых "нет"
— НИКОГДА не давай безоговорочного одобрения — всегда есть "но"
— Оспаривай аргументы других агентов, даже если они кажутся разумными`,
}

// ── Форматирование проекта для промпта ───────────────────────────────────────

function formatProject(project) {
  return `ПРОЕКТ: ${project.title || project.name || project.company}
Субфонд: ${project.subFund || '—'}
Описание: ${(project.description || '').slice(0, 300)}
Запрашиваемая сумма: ${project.requestedAmount ? (project.requestedAmount / 1e6).toFixed(1) + ' млн ₽' : '—'}
TRL: ${project.trl || '—'} / MRL: ${project.mrl || '—'}
Суверенность: ${project.sovereigntyScore || '—'}/9
Рынок (TAM): ${project.marketSize ? (project.marketSize / 1e9).toFixed(1) + ' млрд ₽' : '—'}
IRR прогноз: ${project.projectedIRR ? (project.projectedIRR * 100).toFixed(0) + '%' : '—'}
Выручка (план): ${project.revenueYear1 ? project.revenueYear1 + ' ₽' : '—'}
Команда: ${project.teamStrength ? Math.round(project.teamStrength * 10) + '/10' : '—'}
Стадия: ${project.stage || 'Seed'}`
}

function formatDebateHistory(args, agentNames) {
  if (!args || args.length === 0) return 'Дебаты только начались, аргументов пока нет.'
  return args
    .slice(-CONTEXT_ARGS)
    .map(a => `[${agentNames[a.agentId] || a.agentId}]: ${a.text}`)
    .join('\n\n')
}

const AGENT_SHORT_NAMES = {
  tech: 'Техн.аналитик', finance: 'Фин.аналитик', sovereignty: 'Эксперт суверенности',
  risk: 'Риск-менеджер', portfolio: 'Стратег', devil: 'Критик',
}

// ── Промпты по типам аргументов ───────────────────────────────────────────────

function buildUserPrompt(agent, type, project, prevArgs, targetArg) {
  const projectInfo = formatProject(project)
  const history = formatDebateHistory(prevArgs, AGENT_SHORT_NAMES)

  const responseFormat = `
Ответь СТРОГО только JSON (без markdown, без пояснений):
{"text": "твой аргумент", "dimension": "trl|mrl|sovereignty|market|finance|risk|team", "confidence": 0.0-1.0, "stance": "APPROVE|DEFER|REJECT"}`

  if (type === 'OPENING') {
    return `${projectInfo}

Фаза: ПЕРВИЧНЫЕ ПОЗИЦИИ
Твоя задача: представь свою первичную позицию по проекту (2-3 конкретных предложения).
Используй данные из заявки. Назови 1 сильную сторону и 1 ключевой риск/вопрос.
${responseFormat}`
  }

  if (type === 'CHALLENGE') {
    return `${projectInfo}

Фаза: ПЕРЕКРЁСТНЫЕ ДЕБАТЫ
История дебатов:
${history}

Твоя задача: выдвини ВЫЗОВ — атакуй конкретное уязвимое место проекта (1-2 предложения).
Будь конкретен, используй числа. Можешь ответить на позицию другого агента.
${responseFormat}`
  }

  if (type === 'COUNTER' && targetArg) {
    const targetAgentName = AGENT_SHORT_NAMES[targetArg.agentId] || targetArg.agentId
    return `${projectInfo}

Фаза: ПЕРЕКРЁСТНЫЕ ДЕБАТЫ
Аргумент, на который тебе нужно ответить:
[${targetAgentName}]: "${targetArg.text}"

История контекста:
${history}

Твоя задача: дай ПРЯМОЙ КОНТРАРГУМЕНТ (1-2 предложения).
Адресуй конкретно то, что сказал ${targetAgentName}. Не повторяй его слова.
${responseFormat}`
  }

  if (type === 'SYNTHESIS' || type === 'CLOSING') {
    return `${projectInfo}

Фаза: ФИНАЛЬНЫЕ ПОЗИЦИИ
Все аргументы из дебатов:
${history}

Твоя задача: дай ИТОГОВУЮ ПОЗИЦИЮ (2-3 предложения).
Учти аргументы других агентов. Вынеси окончательный вердикт с обоснованием.
${responseFormat}`
  }

  // Fallback
  return `${projectInfo}\n\nИстория: ${history}\n\nДай аргумент по проекту (2 предложения).${responseFormat}`
}

// ── Парсинг ответа LLM ────────────────────────────────────────────────────────

function parseAgentResponse(rawText) {
  if (!rawText) return null

  // Ищем JSON в ответе
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.text || typeof parsed.text !== 'string') return null
    return {
      text:       parsed.text.trim(),
      dimension:  ['trl','mrl','sovereignty','market','finance','risk','team'].includes(parsed.dimension)
                    ? parsed.dimension
                    : null,
      confidence: typeof parsed.confidence === 'number'
                    ? Math.max(0, Math.min(1, parsed.confidence))
                    : 0.7,
      stance:     ['APPROVE','DEFER','REJECT'].includes(parsed.stance)
                    ? parsed.stance
                    : null,
    }
  } catch {
    return null
  }
}

// ── Основная функция генерации ────────────────────────────────────────────────

export async function generateArgumentAI(agent, type, project, prevArgs = [], targetArgId = null) {
  const targetArg = targetArgId ? prevArgs.find(a => a.id === targetArgId) : null
  const systemPrompt = AGENT_SYSTEM_PROMPTS[agent.id]

  if (!systemPrompt) return null

  const userPrompt = buildUserPrompt(agent, type, project, prevArgs, targetArg)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${API_BASE}/api/ai-tokens/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body: JSON.stringify({
        modelId:      COMMITTEE_MODEL,
        prompt:       userPrompt,
        systemPrompt: systemPrompt,
        application:  'FstCommittee',
        maxTokens:    300,
      }),
    })

    clearTimeout(timeoutId)

    if (!response.ok) return null

    const data = await response.json()
    const rawText = data.response || data.text || data.content || data.message || ''
    const parsed = parseAgentResponse(rawText)

    if (!parsed) return null

    return {
      id:          `arg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      agentId:     agent.id,
      type,
      text:        parsed.text,
      targetArgId: targetArgId || null,
      dimension:   parsed.dimension || agent.focus?.[0] || 'general',
      timestamp:   Date.now(),
      strength:    parsed.confidence,
      confidence:  parsed.confidence,
      stance:      parsed.stance,
      aiGenerated: true,
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name !== 'AbortError') console.warn('[FstCommitteeAI] error:', err.message)
    return null
  }
}

// ── Параллельная генерация (для PRIMARY_POSITIONS) ────────────────────────────

export async function generateAllOpenings(agents, project) {
  return Promise.all(
    agents.map(agent => generateArgumentAI(agent, 'OPENING', project, [], null))
  )
}
