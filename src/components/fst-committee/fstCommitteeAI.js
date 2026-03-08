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

import { getCurrentUserId } from '@/services/aiTokenService.js'
import { resolveModel } from './fstCommitteeModelOrchestrator.js'

const API_BASE = ''  // всегда относительный URL → Vite proxy → порт 8082
const COMMITTEE_MODEL = 'polza/qwen/qwen-turbo' // дефолт: самый быстрый (~1.5с)
const CONTEXT_ARGS = 6                          // аргументов в контексте
const TIMEOUT_MS   = 30_000                     // таймаут (qwen-turbo быстрый)

// ── KAG: поиск прошлых решений ИК ─────────────────────────────────────────────

// Issue #162: TTL-кеш KAG-контекста (60 с) — автоматически инвалидируется
const KAG_CACHE_TTL = 60_000
const _kagCache = new Map()   // key → { value, ts }

function _cacheGet(key) {
  const entry = _kagCache.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.ts > KAG_CACHE_TTL) { _kagCache.delete(key); return undefined }
  return entry.value
}
function _cacheSet(key, value) {
  _kagCache.set(key, { value, ts: Date.now() })
}

export async function fetchKagContext(project) {
  const key = project.title || project.company || 'unknown'
  const cached = _cacheGet(key)
  if (cached !== undefined) return cached
  try {
    const res = await fetch(`${API_BASE}/api/kag/search`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  AbortSignal.timeout(5000),
      body: JSON.stringify({
        query:       `инвесткомитет ФСТ ${project.subFund || ''} ${project.trl ? 'TRL ' + project.trl : ''}`,
        limit:       4,
        entityTypes: ['CommitteeSession'],
        minScore:    0.25,
      }),
    })
    if (!res.ok) { _cacheSet(key, ''); return '' }
    const data = await res.json()
    const hits = (data.results || [])
      .filter(r => r.entity?.observations?.length)
      .slice(0, 3)
    if (!hits.length) { _cacheSet(key, ''); return '' }
    const text = hits
      .map(r => r.entity.observations.slice(0, 4).join(' | '))
      .join('\n')
    const result = `Прошлые решения ИК по схожим проектам:\n${text}`
    _cacheSet(key, result)
    return result
  } catch {
    _cacheSet(key, '')
    return ''
  }
}

export function clearKagCache() { _kagCache.clear() }

// ── KAG: онтология БПЛА (Issue #162) ──────────────────────────────────────────

let _ontologyCache = null   // { text, ts }

/**
 * Загружает топ-50 концептов БПЛА-онтологии из KAG.
 * Используется для инициализации сессии ИК знаниями о предметной области.
 */
export async function fetchOntologyContext() {
  if (_ontologyCache && Date.now() - _ontologyCache.ts < KAG_CACHE_TTL * 5) {
    return _ontologyCache.text
  }
  try {
    const res = await fetch(`${API_BASE}/api/kag/search`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  AbortSignal.timeout(5000),
      body: JSON.stringify({
        query:       'БПЛА беспилотные авиационные системы компоненты технологии',
        limit:       50,
        entityTypes: ['UavConcept', 'Technology', 'Component'],
        minScore:    0.15,
      }),
    })
    if (!res.ok) { _ontologyCache = { text: '', ts: Date.now() }; return '' }
    const data = await res.json()
    const hits = (data.results || []).filter(r => r.entity?.name).slice(0, 50)
    if (!hits.length) { _ontologyCache = { text: '', ts: Date.now() }; return '' }
    const concepts = hits.map(r => {
      const e = r.entity
      const obs = (e.observations || []).slice(0, 2).join('; ')
      return obs ? `${e.name}: ${obs}` : e.name
    })
    const text = `Онтология БПЛА (${concepts.length} концептов):\n${concepts.join('\n')}`
    _ontologyCache = { text, ts: Date.now() }
    return text
  } catch {
    _ontologyCache = { text: '', ts: Date.now() }
    return ''
  }
}

export function clearOntologyCache() { _ontologyCache = null }

// ── KAG: сохранение сессии ────────────────────────────────────────────────────

export async function saveSessionToKag(session) {
  const { exportToKagEntities } = await import('./fstCommitteeOntology.js')
  const entities = exportToKagEntities(session)
  if (!entities.length) return { saved: 0 }
  try {
    const res = await fetch(`${API_BASE}/api/mcp/kag/execute`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: 'kag_create_entities', arguments: { entities } }),
    })
    if (!res.ok) return { saved: 0, error: res.statusText }
    const data = await res.json()
    const count = data.result?.content?.[0]?.text
      ? JSON.parse(data.result.content[0].text)?.count || entities.length
      : entities.length
    return { saved: count }
  } catch (e) {
    return { saved: 0, error: e.message }
  }
}

// Кеш токена на время сессии
let _cachedToken = null
async function getToken() {
  if (_cachedToken) return _cachedToken
  try {
    const userId = getCurrentUserId()
    if (!userId) return null
    // Используем относительный URL (через Vite proxy → 127.0.0.1:8082)
    // а не getDefaultToken() из aiTokenService (он берёт полный URL drondoc.ru → CORS)
    const res = await fetch(`${API_BASE}/api/ai-tokens/default-token/${userId}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    _cachedToken = data?.data?.token?.id || data?.data?.id || null
    return _cachedToken
  } catch {
    return null
  }
}

function getLocalAuthToken() {
  // FST app stores token as 'token', main dronedoc app as 'auth_token'
  return localStorage.getItem('auth_token') ||
         localStorage.getItem('token') ||
         sessionStorage.getItem('auth_token') || ''
}

// ── Системные промпты агентов ─────────────────────────────────────────────────

export const AGENT_SYSTEM_PROMPTS = {
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

  monte_carlo: `Ты Квантовый риск-аналитик инвесткомитета ФСТ НТИ.

Специализация: метод Монте-Карло, стохастическое моделирование, теория вероятностей применительно к венчурным инвестициям.

Твой фреймворк:
— P(NPV>0) = вероятность положительного исхода при σ_CF ≈ 30-50% (типичная волатильность стартапа)
— VaR(95%) = максимальная потеря в 95% сценариев
— Медианный MOIC vs E[MOIC] — различай среднее и медиану (power law скошен вправо)
— P(полной потери капитала) — ключевая метрика для венчурного фонда

Правила:
— Говори числами: "P(успех) = X%, медианный MOIC = Y.Zx, VaR = N млн"
— Всегда указывай допущения о волатильности (σ_CF, σ_IRR)
— Критикуй точечные оценки: "NPV = 42 млн" — это иллюзия точности
— Требуй сценарного анализа: base, bear, bull с вероятностями
— Отвечай кратко (2-3 предложения), используй цифры из заявки`,

  real_options: `Ты Аналитик реальных опционов инвесткомитета ФСТ НТИ.

Специализация: Real Options Valuation (ROV), биномиальное дерево решений, Black-Scholes для непубличных активов, стейдж-гейт структуры инвестирования.

Твой фреймворк (теория реальных опционов):
— Каждый транш = колл-опцион: право (не обязательство) инвестировать следующий транш при достижении вехи
— ROV = DCF + Flexibility Premium (ценность возможности выйти/масштабироваться)
— Высокая волатильность σ → высокая ценность опциона (отличие от DCF!)
— Опцион на масштабирование: если рынок вырастет 10x, мы можем удвоить инвестицию
— Опцион на отказ: если TRL не достигнут — не вкладываем Транш B (защита downside)

Правила:
— Оценивай "опционную премию" к стандартному DCF (обычно 10-25%)
— Критикуй слишком большой первый транш — он "убивает" опциональность
— Предлагай конкретные KPI-триггеры для перехода между траншами
— Отвечай кратко (2-3 предложения), с акцентом на гибкость и staged financing`,

  market_timing: `Ты Аналитик рыночного цикла инвесткомитета ФСТ НТИ.

Специализация: теория рыночных циклов Говарда Маркса, "Why Now?" анализ, конкурентные окна возможностей, зрелость рынка.

Твой фреймворк:
— Шкала Маркса (1-10): 1-3 зарождение, 4-6 ранний рост, 7-8 пик, 9-10 поздний цикл
— "Почему именно сейчас?" — три сигнала: регуляторный сдвиг + технологическая зрелость + рыночный спрос
— Конкурентное окно: сколько месяцев до появления сильного конкурента?
— Timing риск: слишком ранний (рынок не созрел) vs слишком поздний (рынок перегрет)
— Паттерны: GPS (2003-2006), LiDAR (2015-2018), БПЛА-рынок РФ (2022-?)

Правила:
— Отвечай на вопрос "Почему сейчас, а не год назад или через год?"
— Называй конкретные катализаторы: регуляторные изменения, гос.программы, технологические прорывы
— Оценивай, есть ли "доминирующий игрок" в рынке уже или нет
— Отвечай кратко (2-3 предложения), конкретно с датами и событиями`,

  bayesian: `Ты Байесовский аналитик инвесткомитета ФСТ НТИ.

Специализация: теорема Байеса применительно к венчурным инвестициям, Reference Class Forecasting, калибровка вероятностей, борьба с planning fallacy.

Твой фреймворк:
— P(успех|данные) = P(данные|успех) × P(успех) / P(данные) — теорема Байеса
— Априорная (Prior): базовая ставка исторических данных (% проектов в данном секторе и стадии с позитивным исходом)
— Обновление по доказательствам: каждый сигнал (LOI, патент, трек-рекорд) сдвигает вероятность
— Planning Fallacy: люди систематически переоценивают свой проект — корректируй на 30-50%
— Reference Class: выбирай ВНЕШНЮЮ статистику, не слушай фаундера

База данных базовых ставок (ориентиры):
— Seed стартап → Series A: 25-35%
— Series A → прибыльность: 40-50%
— Стартап БПЛА TRL<5 → положительный exit: 5-8%
— Стартап БПЛА TRL>7 → положительный exit: 18-28%
— Команда с предыдущим exitом: базовая ставка ×2.5

Правила:
— ВСЕГДА начинай с базовой ставки Reference Class, потом обновляй
— Называй конкретные цифры: "P(успех) было 12%, стало 28% после апдейта"
— Критикуй planning fallacy в прогнозах IRR/TAM команды
— Отвечай кратко (2-3 предложения), с числами вероятности`,

  power_score: `Ты Аналитик стратегического моата инвесткомитета ФСТ НТИ.

Специализация: 7 Powers (Hamilton Helmer), Power Law инвестирование, потенциал единорогов, конкурентные барьеры входа.

7 Powers (каждый оценивай 0-10):
1. Scale Economies — удельные затраты падают с ростом производства
2. Network Economies — ценность продукта растёт с числом пользователей/узлов
3. Counter-Positioning — лидер рынка НЕ МОЖЕТ скопировать без ущерба своему бизнесу
4. Switching Costs — клиент теряет много при переходе к конкуренту (данные, интеграции, обучение)
5. Branding — ценовая премия через устойчивую репутацию
6. Cornered Resource — эксклюзивный доступ к ресурсу (патент, данные, человек, локация)
7. Process Power — операционное совершенство, которое сложно скопировать даже зная как

Power Law тест:
— Может ли эта инвестиция дать 50x за 7 лет?
— Какой % рынка нужно захватить для MOIC=50x?
— Есть ли "winner takes all" динамика в этом секторе?

Правила:
— Называй конкретные баллы по каждому из 7 Powers
— Итоговый Power Score = сумма (max 70)
— Если Power Score < 25 — бизнес без реального моата, не венчурная инвестиция
— Отвечай кратко (2-3 предложения), называй конкретные Powers`,

  game_theory: `Ты Теоретик игр инвесткомитета ФСТ НТИ — мета-агент.

Специализация: теория игр как фреймворк для оценки инвестиций. Ты НЕ оцениваешь технологию или финансы напрямую. Ты оцениваешь СТРУКТУРУ ИГРЫ: кто в ней игроки, каковы их стимулы, устойчиво ли итоговое решение.

КЛЮЧЕВЫЕ ИНСТРУМЕНТЫ:

1. Nash Equilibrium — устойчиво ли решение ИК?
   — Если ни один агент не хочет изменить свою позицию → Nash Equilibrium достигнут
   — При расколе позиций → равновесие неустойчиво, нужен ещё раунд дебатов

2. Shapley Value — справедливый вклад каждого участника:
   — Стартап: φ(основатель) vs φ(фонд) vs φ(рынок)
   — В коалиции [фонд+стартап]: кто приносит больше маргинальной пользы?
   — Используй для оценки справедливости cap table

3. Механизм стимулов — Revelation Principle:
   — Структура milestone/транш принуждает стартап к честному раскрытию информации
   — KPI = механизм правдивых стимулов (truthful mechanism)
   — Milestone achievement → следующий транш = dominantная стратегия честности

4. Повторяющаяся игра (Repeated Game):
   — Каждый раунд инвестиций = шаг в бесконечной игре
   — Folk Theorem: в повторяющихся играх возможна кооперация без принуждения
   — Репутация фонда = стимул к честным действиям
   — Tit-for-Tat: агенты с точными прогнозами → больший вес в следующем раунде

5. Коалиционная динамика:
   — Какие коалиции агентов естественно образуются? (tech+sovereignty, finance+risk)
   — Стабильна ли коалиция поддержки проекта?

6. Аукцион и сигнализирование:
   — Оценка стартапа = аукцион: кто дал более высокую оценку и почему?
   — Founders signaling: высокая оценка → сигнал уверенности или hubris?

Правила:
— Анализируй ПОЗИЦИИ других агентов через призму их Nash-стратегий
— Оцени устойчивость консенсуса (Nash или нет?)
— Предложи Shapley-справедливое распределение выгод между фондом и стартапом
— Отвечай кратко (3-4 предложения) с конкретными числами`,
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

// Случайные аспекты фокуса — делают каждую дискуссию уникальной
const AGENT_FOCUS_VARIANTS = {
  tech: [
    'особое внимание — производственной масштабируемости',
    'особое внимание — патентной защите и IP',
    'особое внимание — цепочке поставок компонентов',
    'особое внимание — независимым испытаниям и сертификации',
    'особое внимание — критическим технологическим зависимостям',
  ],
  finance: [
    'особое внимание — unit economics и CAC/LTV',
    'особое внимание — runway и burn rate',
    'особое внимание — обоснованности TAM и прогноза доли рынка',
    'особое внимание — структуре раунда и cap table',
    'особое внимание — сценарному анализу (базовый vs пессимистичный)',
  ],
  sovereignty: [
    'особое внимание — конкретным критическим импортным компонентам',
    'особое внимание — программному обеспечению и облачным зависимостям',
    'особое внимание — кадровому суверенитету и утечке технологий',
    'особое внимание — дорожной карте импортозамещения',
    'особое внимание — рискам экспортного контроля',
  ],
  risk: [
    'особое внимание — регуляторным рискам (Росавиация, ФСБ, ФАВТ)',
    'особое внимание — ключевому-человек риску и команде',
    'особое внимание — концентрации клиентской базы',
    'особое внимание — рискам масштабирования операций',
    'особое внимание — киберрискам и защите данных',
  ],
  portfolio: [
    'особое внимание — синергиям с конкретными портфельными компаниями',
    'особое внимание — уникальности ниши и дифференциации',
    'особое внимание — соответствию стратегии НТИ 2030',
    'особое внимание — кросс-субфондовым возможностям',
    'особое внимание — конкурентной разведке внутри портфеля',
  ],
  monte_carlo: [
    'особое внимание — хвостовым рискам (tail risk) и VaR',
    'особое внимание — разнице между E[MOIC] и медианным MOIC',
    'особое внимание — вероятности полной потери капитала',
    'особое внимание — чувствительности NPV к волатильности CF',
    'особое внимание — корреляции рисков в сценариях',
  ],
  real_options: [
    'особое внимание — структуре и размеру траншей',
    'особое внимание — KPI-триггерам перехода между траншами',
    'особое внимание — опциону масштабирования в смежные рынки',
    'особое внимание — ценности опциона отказа (downside protection)',
    'особое внимание — влиянию волатильности рынка на ROV',
  ],
  market_timing: [
    'особое внимание — позиции рынка на шкале Маркса (1-10)',
    'особое внимание — конкурентному окну (сколько месяцев до доминанта)',
    'особое внимание — трём катализаторам "Почему сейчас?"',
    'особое внимание — регуляторным изменениям как рыночному триггеру',
    'особое внимание — историческим аналогиям (GPS, LiDAR, БПЛА)',
  ],
  bayesian: [
    'особое внимание — выбору правильного референсного класса',
    'особое внимание — planning fallacy в прогнозах команды',
    'особое внимание — сигналам, которые меняют P(успех) сильнее всего',
    'особое внимание — базовым ставкам по сектору и стадии',
    'особое внимание — калибровке вероятностей (не 70% = "скорее да")',
  ],
  power_score: [
    'особое внимание — Counter-Positioning (что лидер не может скопировать)',
    'особое внимание — Cornered Resource (уникальный актив, недоступный конкурентам)',
    'особое внимание — Network Effects как главному венчурному моату',
    'особое внимание — Power Law потенциалу (50x за 7 лет — реально?)',
    'особое внимание — winner-takes-all динамике в секторе',
  ],
  devil: [
    'особое внимание — слабым местам в команде основателей',
    'особое внимание — скрытым конкурентам которых "нет"',
    'особое внимание — нереалистичным допущениям в прогнозах',
    'особое внимание — системным рискам всего рынка',
    'особое внимание — тому, чего нет в заявке, но должно быть',
  ],
  game_theory: [
    'особое внимание — Nash Equilibrium текущих позиций агентов ИК',
    'особое внимание — Shapley Value: справедливое распределение выгод фонд/стартап',
    'особое внимание — milestone как механизм правдивых стимулов (Revelation Principle)',
    'особое внимание — Tit-for-Tat: репутационные стимулы для честного поведения',
    'особое внимание — коалиционной устойчивости: стабильно ли большинство?',
  ],
}

function pickFocus(agentId) {
  const variants = AGENT_FOCUS_VARIANTS[agentId] || []
  if (!variants.length) return ''
  return variants[Math.floor(Math.random() * variants.length)]
}

// ── Промпты по типам аргументов ───────────────────────────────────────────────

function buildUserPrompt(agent, type, project, prevArgs, targetArg, kagContext = '') {
  const projectInfo = formatProject(project)
  const history = formatDebateHistory(prevArgs, AGENT_SHORT_NAMES)
  const focus = pickFocus(agent.id)

  const responseFormat = `
Ответь СТРОГО только JSON (без markdown, без пояснений):
{"text": "твой аргумент", "dimension": "trl|mrl|sovereignty|market|finance|risk|team", "confidence": 0.0-1.0, "stance": "APPROVE|DEFER|REJECT"}`

  if (type === 'OPENING') {
    return `${projectInfo}
${kagContext ? '\n' + kagContext + '\n' : ''}
Фаза: ПЕРВИЧНЫЕ ПОЗИЦИИ
Твоя задача: представь свою первичную позицию по проекту (2-3 конкретных предложения).
Используй данные из заявки. Назови 1 сильную сторону и 1 ключевой риск/вопрос.
Сегодня: ${focus}.
${responseFormat}`
  }

  if (type === 'CHALLENGE') {
    return `${projectInfo}

Фаза: ПЕРЕКРЁСТНЫЕ ДЕБАТЫ
История дебатов:
${history}

Твоя задача: выдвини ВЫЗОВ — атакуй конкретное уязвимое место проекта (1-2 предложения).
Будь конкретен, используй числа. Можешь ответить на позицию другого агента.
Сегодня: ${focus}.
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

  if (type === 'SYNTHESIS' || type === 'CLOSING' || type === 'SUMMARY') {
    return `${projectInfo}

Фаза: ФИНАЛЬНЫЕ ПОЗИЦИИ
Все аргументы из дебатов:
${history}

Твоя задача: дай ИТОГОВУЮ ПОЗИЦИЮ (2-3 предложения).
Учти аргументы других агентов. Вынеси окончательный вердикт с обоснованием.
${responseFormat}`
  }

  return `${projectInfo}\n\nИстория: ${history}\n\nДай аргумент по проекту (2 предложения).${responseFormat}`
}

// ── Парсинг ответа LLM ────────────────────────────────────────────────────────

/** Извлекает первый сбалансированный JSON-объект из строки */
function extractFirstJson(str) {
  let depth = 0, start = -1
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') {
      if (depth === 0) start = i
      depth++
    } else if (str[i] === '}') {
      if (--depth === 0 && start !== -1) return str.slice(start, i + 1)
    }
  }
  return null
}

function parseAgentResponse(rawText) {
  if (!rawText) return null

  const VALID_DIMS = ['trl','mrl','sovereignty','market','finance','risk','team']
  const VALID_STANCES = ['APPROVE','DEFER','REJECT']

  // 1. Извлекаем ПЕРВЫЙ полный JSON-объект (балансирующий обход скобок)
  const jsonStr = extractFirstJson(rawText)
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr)
      if (parsed.text && typeof parsed.text === 'string') {
        return {
          text:       parsed.text.trim(),
          dimension:  VALID_DIMS.includes(parsed.dimension) ? parsed.dimension : null,
          confidence: typeof parsed.confidence === 'number'
                        ? Math.max(0, Math.min(1, parsed.confidence))
                        : 0.7,
          stance:     VALID_STANCES.includes(parsed.stance) ? parsed.stance : null,
        }
      }
    } catch { /* fall through to plain-text fallback */ }
  }

  // 2. Модель ответила не JSON — убираем мусор и используем как текст
  const text = rawText
    .replace(/```[\s\S]*?```/g, '')   // убрать markdown code blocks
    .replace(/^\s*(json|JSON)\s*/i, '') // убрать случайное слово json
    .replace(/\{[\s\S]*?\}/g, '')      // убрать JSON-обломки
    .trim()

  if (text.length < 10) return null  // слишком короткий — скорее всего мусор

  return {
    text:       text,
    dimension:  null,
    confidence: 0.7,
    stance:     null,
  }
}

// ── Основная функция генерации ────────────────────────────────────────────────

/**
 * @param {Object} opts.modelOverrides  — { [agentId]: modelId } пользовательские переопределения
 * @param {string} opts.speedProfile    — 'fast' | 'balanced' | 'quality'
 */
export async function generateArgumentAI(agent, type, project, prevArgs = [], targetArgId = null, kagContext = '', opts = {}) {
  const targetArg = targetArgId ? prevArgs.find(a => a.id === targetArgId) : null
  const systemPrompt = AGENT_SYSTEM_PROMPTS[agent.id]

  if (!systemPrompt) return null

  const userPrompt = buildUserPrompt(agent, type, project, prevArgs, targetArg, kagContext)

  // Оркестратор выбирает оптимальную модель для агента + задачи
  const modelId = resolveModel(
    agent.id,
    type,
    opts.speedProfile || 'fast',
    opts.modelOverrides || {}
  )

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  // Получаем токен авторизации
  const ddToken   = await getToken()
  const authToken = ddToken || getLocalAuthToken()

  try {
    const response = await fetch(`${API_BASE}/api/ai-tokens/chat`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
      signal:  controller.signal,
      body: JSON.stringify({
        modelId,
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
      model:       modelId,  // какая модель сгенерировала аргумент
    }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name !== 'AbortError') console.warn('[FstCommitteeAI] error:', err.message)
    return null
  }
}

// ── Параллельная генерация (для PRIMARY_POSITIONS) ────────────────────────────

export async function generateAllOpenings(agents, project, opts = {}) {
  return Promise.all(
    agents.map(agent => generateArgumentAI(agent, 'OPENING', project, [], null, '', opts))
  )
}


// ── AI: предложение параметров нод контракта ─────────────────────────────────

const NODE_PROPOSAL_SYSTEM = `Ты — аналитик венчурного фонда ФСТ НТИ. Твоя задача: предложить финансовые параметры для трёх нод смарт-контракта (консервативный/базовый/оптимистичный сценарии сделки).
Каждая нода = уникальная комбинация инвестиций, риска и ожидаемых денежных потоков.
Ответ СТРОГО JSON, без markdown.`

/**
 * Агент предлагает параметры трёх нод смарт-контракта
 */
export async function generateNodeProposalAI(agent, project, existingProposals = [], round = 1) {
  const ic = Math.round((project.askRub || 100_000_000) / 1_000_000)
  const irr = project.projectedIRR || 0.30

  const otherProposals = existingProposals.filter(p => p.agentId !== agent.id)
  const othersStr = otherProposals.length
    ? otherProposals.map(p =>
        `[${AGENT_SHORT_NAMES[p.agentId] || p.agentId}]: IC base=${p.nodes?.base?.ic ?? '?'}, WACC base=${p.nodes?.base?.wacc ?? '?'}, IRR≈${p.nodes?.base?.expectedIrr ?? '?'}%`
      ).join('\n')
    : '(ты первый)'

  const biasHint = agent.bias === 'optimist'
    ? 'Ты оптимист: предлагай более смелые CF, ниже WACC.'
    : agent.bias === 'pessimist'
    ? 'Ты пессимист: предлагай консервативные CF, выше риск-премию в WACC.'
    : 'Нейтральная позиция — сбалансированные параметры.'

  const prompt = `Проект: ${project.title || 'Венчурный проект'}
Запрашиваемые инвестиции: ${ic} млн ₽
Отрасль: ${project.industry || 'БПЛА/Беспилотники'}
TRL: ${project.trl || '?'}, MRL: ${project.mrl || '?'}
Прогнозный IRR заявителя: ${Math.round((irr || 0.3) * 100)}%
Раунд согласования: ${round}

Позиции других агентов (раунд ${round}):
${othersStr}

${biasHint}

Предложи параметры трёх нод (5-летний горизонт, млн ₽):
Ответь ТОЛЬКО JSON:
{
  "pessimistic": {"ic": N, "wacc": N, "cf": [N,N,N,N,N], "expectedIrr": N, "rationale": "кратко"},
  "base":        {"ic": N, "wacc": N, "cf": [N,N,N,N,N], "expectedIrr": N, "rationale": "кратко"},
  "optimistic":  {"ic": N, "wacc": N, "cf": [N,N,N,N,N], "expectedIrr": N, "rationale": "кратко"}
}`

  const ddToken   = await getToken()
  const authToken = ddToken || getLocalAuthToken()

  try {
    const res = await fetch(`${API_BASE}/api/ai-tokens/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        modelId:      'polza/qwen/qwen-turbo',
        prompt,
        systemPrompt: NODE_PROPOSAL_SYSTEM,
        application:  'FstCommitteeNodeNegotiation',
        maxTokens:    400,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const raw  = data.response || data.text || ''
    const jsonStr = extractFirstJson(raw)
    if (!jsonStr) return null
    const parsed = JSON.parse(jsonStr)
    // Валидируем структуру
    for (const key of ['pessimistic', 'base', 'optimistic']) {
      if (!parsed[key]?.cf?.length) return null
    }
    return { agentId: agent.id, round, nodes: parsed }
  } catch {
    return null
  }
}

/**
 * Агент голосует за финальные ноды (ACCEPT / REJECT)
 */
export async function generateNodeVoteAI(agent, nodes, project) {
  const nodesSummary = nodes.map((n, i) =>
    `Нода ${i + 1} (${n.scenario}): IC=${n.ic}млн, WACC=${n.wacc}%, NPV=${n.npv?.toFixed(1)}млн, IRR=${n.irr != null ? (n.irr * 100).toFixed(1) : '?'}%`
  ).join('\n')

  const biasHint = agent.bias === 'optimist'
    ? 'Ты склонен принимать риск, если потенциал высок.'
    : agent.bias === 'pessimist'
    ? 'Ты осторожен — обращай внимание на реалистичность CF.'
    : 'Нейтральная позиция.'

  const prompt = `Проект: ${project.title || 'Венчурный проект'}. ${biasHint}

Три ноды смарт-контракта для голосования:
${nodesSummary}

Проголосуй: ACCEPT если ноды реалистичны и сбалансированы, REJECT если есть существенные проблемы.
Ответь ТОЛЬКО JSON (без markdown):
{"verdict": "ACCEPT" | "REJECT", "comment": "1 предложение"}`

  const ddToken   = await getToken()
  const authToken = ddToken || getLocalAuthToken()

  try {
    const res = await fetch(`${API_BASE}/api/ai-tokens/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        modelId:      'polza/qwen/qwen-turbo',
        prompt,
        systemPrompt: NODE_PROPOSAL_SYSTEM,
        application:  'FstCommitteeNodeVoting',
        maxTokens:    120,
      }),
    })
    if (!res.ok) return { agentId: agent.id, verdict: 'ACCEPT', comment: '' }
    const data = await res.json()
    const raw  = data.response || data.text || ''
    const jsonStr = extractFirstJson(raw)
    if (!jsonStr) return { agentId: agent.id, verdict: 'ACCEPT', comment: raw.slice(0, 100) }
    const parsed = JSON.parse(jsonStr)
    return {
      agentId: agent.id,
      verdict: parsed.verdict === 'REJECT' ? 'REJECT' : 'ACCEPT',
      comment: parsed.comment || '',
    }
  } catch {
    return { agentId: agent.id, verdict: 'ACCEPT', comment: '' }
  }
}

// ── Сохранение сессии в СОД (Предметные события) ─────────────────────────────

const FST_SERVER_AI   = ''
const FST_DB_AI       = import.meta.env?.VITE_FST_DB     || 'fst-api'
const TYPE_SOD_EVENTS = 2451   // СОД Предметные события
const REQ_SOD_DATE    = 2458   // Дата
const REQ_SOD_EFFECT  = 2460   // Эффект
const REQ_SOD_SOURCE  = 2461   // Источник
const REQ_SOD_ACTORS  = 3007   // Акторы (MULTI ref → 2406)
const ACTOR_IK_MAIN   = 2527   // "ИИ-инвесткомитет" (общий актор ИК)

/**
 * Сохраняет результат заседания ИК как Предметное событие в СОД.
 * Каждый участвовавший агент → его sodActorId привязывается к событию.
 * Замыкает цикл: Агент ИК (3674) → СОД Актор (2406) → Предметное событие (2451).
 */
export async function saveSessionToIntegram(session) {
  try {
    const { authenticate } = await import('@/services/fstApi.js')
    const { loadAgents }   = await import('@/services/fstAgentsService.js')

    const { token, xsrf } = await authenticate()
    const agents = await loadAgents()

    // Словарь sodActorId по id агента
    const actorMap = {}
    if (agents) {
      for (const a of agents) {
        if (a.sodActorId) actorMap[a.id] = a.sodActorId
      }
    }

    const decision = session.decision || {}
    const project  = session.project  || {}
    const rec      = decision.recommendation || 'DEFER'
    const score    = decision.aggregatedScore != null ? Number(decision.aggregatedScore).toFixed(2) : '—'
    const now      = new Date().toISOString()
    const title    = `ИК ФСТ: ${project.title || session.projectId} — ${new Date().toLocaleDateString('ru')}`

    const effect = [
      `Решение: ${rec}`,
      `Балл: ${score}`,
      decision.conditions?.length ? `Условия: ${decision.conditions.slice(0, 2).join('; ')}` : '',
      decision.risks?.length      ? `Риски: ${decision.risks.slice(0, 2).join('; ')}`         : '',
    ].filter(Boolean).join('\n')

    // Собираем ID акторов: главный "ИИ-инвесткомитет" + конкретные агенты
    const participantIds = [String(ACTOR_IK_MAIN)]
    const participantAgentIds = [...new Set(
      (session.arguments || []).map(a => a.agentId).filter(Boolean)
    )]
    for (const agId of participantAgentIds) {
      if (actorMap[agId]) participantIds.push(String(actorMap[agId]))
    }

    // Создаём Предметное событие
    const body = new URLSearchParams()
    body.set(`t${TYPE_SOD_EVENTS}`, title)
    body.set(`t${REQ_SOD_DATE}`,    now)
    body.set(`t${REQ_SOD_EFFECT}`,  effect)
    body.set(`t${REQ_SOD_SOURCE}`,  'ИИ-инвесткомитет FST')
    for (const actorId of participantIds) {
      body.append(`t${REQ_SOD_ACTORS}`, actorId)
    }
    body.set('_xsrf', xsrf)

    const res = await fetch(`${FST_SERVER_AI}/${FST_DB_AI}/_m_new/${TYPE_SOD_EVENTS}?JSON_KV`, {
      method:  'POST',
      headers: { 'X-Authorization': token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = await res.json()
    if (data.error) return { error: data.error }

    const eventId = data.obj || data.id
    return { eventId, actorCount: participantIds.length }
  } catch (e) {
    console.warn('[saveSessionToIntegram]', e.message)
    return { error: e.message }
  }
}
