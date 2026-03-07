/**
 * Glossary of Venture Capital Terms
 * Interactive glossary with AI-powered explanations
 * Issue #110 - feat(education): интерактивный глоссарий венчурных терминов с AI-объяснениями
 */

export const glossaryTerms = {
  // Финансовые термины
  irr: {
    id: 'irr',
    title: 'IRR — Внутренняя норма доходности',
    category: 'financial',
    definition: 'Ставка дисконтирования, при которой чистая приведённая стоимость (NPV) инвестиции равна нулю. Показывает эффективность инвестиций в % годовых.',
    formula: 'IRR = 25% означает: ₽1 млн → ₽1.25 млн через год',
    example: 'Фонд инвестировал ₽10 млн в стартап. Через 5 лет фонд получил ₽50 млн. IRR составил 38% годовых, что выше целевого показателя в 25%.',
    relatedTerms: ['moic', 'dpi', 'tvpi', 'nav'],
    context: 'Ключевая метрика для оценки доходности фонда и сравнения с альтернативными инвестициями.'
  },

  moic: {
    id: 'moic',
    title: 'MOIC — Множитель инвестиций',
    category: 'financial',
    definition: 'Отношение общей стоимости (выходы + текущая стоимость) к первоначальным инвестициям. Показывает, во сколько раз увеличился капитал.',
    formula: 'MOIC = (Выходы + Текущая стоимость) / Инвестиции',
    example: 'Инвестиция ₽5 млн, текущая оценка портфеля ₽15 млн. MOIC = 3.0x — капитал утроился.',
    relatedTerms: ['irr', 'dpi', 'tvpi'],
    context: 'Простая метрика для быстрой оценки успешности инвестиции без учёта времени.'
  },

  dpi: {
    id: 'dpi',
    title: 'DPI — Реализованная стоимость',
    category: 'financial',
    definition: 'Distributions to Paid-In — отношение распределённых средств к внесённому капиталу. Показывает реальные денежные возвраты.',
    formula: 'DPI = Распределения / Внесённый капитал',
    example: 'LP внёс ₽10 млн, получил ₽8 млн дивидендов. DPI = 0.8x — возврат 80% капитала при продолжающихся инвестициях.',
    relatedTerms: ['tvpi', 'rvpi', 'irr', 'moic'],
    context: 'Критический показатель для LP — показывает реальные денежные поступления, а не «бумажную» оценку.'
  },

  tvpi: {
    id: 'tvpi',
    title: 'TVPI — Общая стоимость',
    category: 'financial',
    definition: 'Total Value to Paid-In — сумма распределений и остаточной стоимости портфеля к внесённому капиталу.',
    formula: 'TVPI = (Распределения + Остаточная стоимость) / Внесённый капитал',
    example: 'LP внёс ₽10 млн, получил ₽8 млн, остаток портфеля ₽12 млн. TVPI = 2.0x.',
    relatedTerms: ['dpi', 'rvpi', 'irr'],
    context: 'Комбинированный показатель реализованной и нереализованной доходности фонда.'
  },

  nav: {
    id: 'nav',
    title: 'NAV — Чистая стоимость активов',
    category: 'financial',
    definition: 'Net Asset Value — оценочная стоимость всех активов фонда за вычетом обязательств.',
    formula: 'NAV = Активы - Обязательства',
    example: 'Портфель компаний оценён в ₽100 млн, долги фонда ₽5 млн. NAV = ₽95 млн.',
    relatedTerms: ['tvpi', 'fair-value'],
    context: 'Квартальная переоценка портфеля по стандартам IPEV или ILPA для отчётности LP.'
  },

  'carried-interest': {
    id: 'carried-interest',
    title: 'Carried Interest — Доля успеха GP',
    category: 'financial',
    definition: 'Процент от прибыли фонда, который получает управляющая команда (GP) после возврата капитала LP и преодоления hurdle rate.',
    formula: 'Обычно 20% от прибыли сверх 8% hurdle rate',
    example: 'Фонд вернул LP ₽100 млн (100% капитала) + ₽50 млн прибыли. GP получает 20% × ₽50 млн = ₽10 млн carried.',
    relatedTerms: ['waterfall', 'hurdle-rate', 'gp', 'lp'],
    context: 'Основной источник дохода GP, выравнивает интересы управляющих и инвесторов.'
  },

  waterfall: {
    id: 'waterfall',
    title: 'Waterfall — Каскадное распределение',
    category: 'financial',
    definition: 'Порядок распределения доходов фонда между LP и GP: возврат капитала → hurdle rate → carried interest.',
    formula: '1. Return of Capital (100%)\n2. Preferred Return (8%)\n3. Catch-up (до 20%)\n4. Carry Split (80/20)',
    example: 'Выход ₽200 млн: ₽100 млн → LP (возврат), ₽8 млн → LP (hurdle), ₽23 млн → GP (catch-up), ₽69 млн → 80% LP / 20% GP.',
    relatedTerms: ['carried-interest', 'hurdle-rate', 'catch-up'],
    context: 'Определяется в LPA (соглашении с LP) и влияет на экономику фонда.'
  },

  'cap-table': {
    id: 'cap-table',
    title: 'Cap Table — Таблица капитализации',
    category: 'venture',
    definition: 'Структура владения компанией: акционеры, доли, типы акций, конвертируемые инструменты.',
    formula: 'Ownership % = Акции владельца / Fully-Diluted Shares',
    example: 'Основатели 60%, Seed фонд 20%, Series A фонд 15%, опционы сотрудников 5%.',
    relatedTerms: ['dilution', 'option-pool', 'convertible-note', 'safe'],
    context: 'Критический документ для переговоров о финансировании и выходах.'
  },

  spv: {
    id: 'spv',
    title: 'SPV — Целевая инвестиционная компания',
    category: 'venture',
    definition: 'Special Purpose Vehicle — отдельное юрлицо для одной сделки. Изолирует риски и упрощает управление.',
    formula: 'Один SPV = Одна портфельная компания',
    example: 'Фонд создал ООО «SPV Стартап-01» для инвестиции ₽50 млн в AI-компанию.',
    relatedTerms: ['gp', 'lp', 'carried-interest'],
    context: 'Стандартная практика для венчурных фондов в России (требование законодательства).'
  },

  lp: {
    id: 'lp',
    title: 'LP — Ограниченный партнёр',
    category: 'venture',
    definition: 'Limited Partner — инвестор фонда, не участвующий в управлении. Пассивная роль, ограниченная ответственность.',
    formula: 'LP вносит капитал → получает долю в фонде → получает распределения',
    example: 'Пенсионный фонд, семейный офис, корпорация вносят ₽1 млрд в венчурный фонд как LP.',
    relatedTerms: ['gp', 'carried-interest', 'waterfall', 'commitment'],
    context: 'Источник капитала фонда. Отношения регулируются LPA (Limited Partnership Agreement).'
  },

  gp: {
    id: 'gp',
    title: 'GP — Генеральный партнёр',
    category: 'venture',
    definition: 'General Partner — управляющая команда фонда. Принимает инвестиционные решения, получает management fee и carried interest.',
    formula: 'GP = Management Fee (2%) + Carried Interest (20%)',
    example: 'Команда из 5 партнёров управляет фондом ₽5 млрд, получает ₽100 млн/год management fee + 20% прибыли.',
    relatedTerms: ['lp', 'carried-interest', 'management-fee'],
    context: 'Фидуциарная ответственность перед LP — обязан действовать в интересах инвесторов.'
  },

  // Венчурные термины
  'term-sheet': {
    id: 'term-sheet',
    title: 'Term Sheet — Предварительное соглашение',
    category: 'venture',
    definition: 'Необязывающий документ с основными условиями инвестиции: оценка, сумма, права инвесторов.',
    formula: 'Ключевые пункты: Valuation, Investment, Liquidation Preference, Board Seats, Anti-dilution',
    example: 'Pre-money ₽200 млн, инвестиция ₽50 млн, 20% доли, 1 место в совете директоров, 1x ликвидационное предпочтение.',
    relatedTerms: ['valuation', 'liquidation-preference', 'anti-dilution', 'sha'],
    context: 'Первый официальный шаг после одобрения инвесткомитетом. Далее следует Due Diligence и SHA.'
  },

  'due-diligence': {
    id: 'due-diligence',
    title: 'Due Diligence — Комплексная проверка',
    category: 'venture',
    definition: 'Глубокий анализ компании перед инвестицией: финансы, юридическая чистота, технология, команда, рынок.',
    formula: 'DD = Legal + Financial + Technical + Commercial + HR',
    example: 'Фонд проверяет стартап 2 месяца: аудит финансов, анализ кода, интервью клиентов, проверка IP.',
    relatedTerms: ['term-sheet', 'sha', 'vdr'],
    context: 'Обязательный этап между Term Sheet и закрытием сделки. Может привести к пересмотру условий.'
  },

  'down-round': {
    id: 'down-round',
    title: 'Down Round — Раунд по сниженной оценке',
    category: 'venture',
    definition: 'Раунд финансирования с оценкой ниже предыдущего. Сигнал проблем компании, сильно разводняет основателей.',
    formula: 'Previous Valuation > Current Valuation',
    example: 'Series A — ₽1 млрд оценка. Series B — ₽700 млн оценка. Down round 30%.',
    relatedTerms: ['anti-dilution', 'full-ratchet', 'weighted-average'],
    context: 'Активирует anti-dilution защиту ранних инвесторов, что ещё больше разводняет основателей.'
  },

  'pro-rata': {
    id: 'pro-rata',
    title: 'Pro-rata — Право участия',
    category: 'venture',
    definition: 'Право инвестора участвовать в следующих раундах пропорционально своей доле, чтобы избежать разводнения.',
    formula: 'Pro-rata = Текущая доля × Размер нового раунда',
    example: 'Инвестор владеет 15%, новый раунд ₽100 млн. Pro-rata право = ₽15 млн.',
    relatedTerms: ['dilution', 'super-pro-rata', 'preemptive-right'],
    context: 'Стандартное условие для Series A+ инвесторов. Критично для поддержания доли в успешных компаниях.'
  },

  cliff: {
    id: 'cliff',
    title: 'Cliff — Период ожидания',
    category: 'venture',
    definition: 'Минимальный срок работы до начала vesting опционов. Обычно 1 год — защита компании от краткосрочных сотрудников.',
    formula: 'Первый год = 0 опционов. После 12 месяцев — единовременно 25%',
    example: 'Сотрудник получил 100 опционов с 1-year cliff. Уволился через 11 месяцев → 0 опционов. Проработал 13 месяцев → 25 опционов сразу.',
    relatedTerms: ['vesting', 'option-pool', 'strike-price'],
    context: 'Стандарт 1 year cliff + 4 year vesting для стартапов. Защищает от найма "туристов".'
  },

  vesting: {
    id: 'vesting',
    title: 'Vesting — Постепенное получение опционов',
    category: 'venture',
    definition: 'Механизм постепенной передачи акций/опционов сотруднику за выслугу лет. Мотивирует долгосрочную работу.',
    formula: 'Стандарт: 4 года vesting, 1 год cliff, ежемесячное начисление',
    example: '4800 опционов, 4-year vesting → 100 опционов/месяц после 1-year cliff.',
    relatedTerms: ['cliff', 'option-pool', 'strike-price', 'acceleration'],
    context: 'Критический инструмент удержания талантов в стартапах. При увольнении невестнутые опционы сгорают.'
  },

  safe: {
    id: 'safe',
    title: 'SAFE — Простое соглашение о будущем капитале',
    category: 'venture',
    definition: 'Simple Agreement for Future Equity — конвертируемый инструмент без долга и срока погашения. Конвертируется в акции при следующем раунде.',
    formula: 'Конверсия по min(Cap, Discount Price)',
    example: 'SAFE $1M, cap $10M, discount 20%. При Series A $20M → конверсия по $10M cap (50% дисконт к раунду).',
    relatedTerms: ['convertible-note', 'valuation-cap', 'discount'],
    context: 'Популярный инструмент для pre-seed/seed раундов в USA. В России — редко из-за юридических сложностей.'
  },

  'convertible-note': {
    id: 'convertible-note',
    title: 'Convertible Note — Конвертируемый заём',
    category: 'venture',
    definition: 'Краткосрочный заём, который конвертируется в акции при следующем раунде. Имеет процентную ставку и срок погашения.',
    formula: 'Конверсия = (Сумма займа + Проценты) / (Цена раунда × (1 - Discount))',
    example: 'Заём ₽10 млн, 8% годовых, 20% дисконт. Через год Series A по ₽1000/акция → конверсия по ₽800/акция, количество = ₽10.8M / ₽800 = 13500 акций.',
    relatedTerms: ['safe', 'discount', 'valuation-cap', 'interest-rate'],
    context: 'Популярен в России (понятен законодательству). Минус — risk of maturity date если раунд не состоялся.'
  },

  // AI-специфичные термины
  'ai-committee': {
    id: 'ai-committee',
    title: 'AI-Инвесткомитет — Автоматизированное принятие решений',
    category: 'ai',
    definition: 'Система из 6 AI-агентов, моделирующих работу реального инвесткомитета: анализ рынка, финансов, команды, технологии, рисков, синтез решения.',
    formula: 'Финальная оценка = weighted_average(Market, Finance, Team, Tech, Risk, Strategy)',
    example: 'Заявка проходит через 6 агентов → каждый ставит оценку 0-10 → синтез даёт финальный вердикт: "Рекомендуем инвестировать ₽50M в Series A".',
    relatedTerms: ['screening', 'due-diligence', 'investment-memo'],
    context: 'Уникальная возможность ФСТ НТИ — автоматизация рутинного скрининга, фокус партнёров на стратегических решениях.'
  },

  screening: {
    id: 'screening',
    title: 'Скрининг — Первичный отбор заявок',
    category: 'ai',
    definition: 'Автоматизированная фильтрация заявок по базовым критериям: стадия, сектор, команда, метрики.',
    formula: 'Pass Rate = Подходящие заявки / Все заявки × 100%',
    example: 'Из 500 заявок в месяц, 50 проходят screening (10%) → идут в AI-инвесткомитет.',
    relatedTerms: ['ai-committee', 'deal-flow'],
    context: 'Экономит 80% времени партнёров на первичном анализе. Важно настроить критерии под инвестиционный тезис фонда.'
  },

  'digital-twin': {
    id: 'digital-twin',
    title: 'Digital Twin — Цифровой двойник компании',
    category: 'ai',
    definition: 'Симуляционная модель портфельной компании: финансы, операции, рынок. Позволяет прогнозировать сценарии развития.',
    formula: 'Tick Engine: события → обновление метрик → пересчёт оценки → dashboard update',
    example: 'Модель компании симулирует: +10 клиентов/месяц → MRR +₽500K → runway +2 месяца → оценка +₽50M.',
    relatedTerms: ['nav', 'portfolio-monitoring', 'scenario-analysis'],
    context: 'Переход от ретроспективной отчётности к проактивному управлению портфелем.'
  },

  kag: {
    id: 'kag',
    title: 'KAG — Knowledge-Augmented Generation',
    category: 'ai',
    definition: 'Гибридная архитектура: vector search (семантика) + graph traversal (структура) для точного ответа AI на основе базы знаний.',
    formula: 'Answer = LLM(Question + Vector_Context + Graph_Relations)',
    example: 'Вопрос "Какая IRR у наших БПЛА-компаний?" → Vector находит компании БПЛА → Graph связывает с финансовыми метриками → GPT генерирует ответ "25% median IRR по 12 компаниям".',
    relatedTerms: ['rag', 'vector-db', 'knowledge-graph'],
    context: 'Ключевая технология для нейрокогнитивного ядра ФСТ НТИ — 1140 концептов БПЛА в графе.'
  },

  mcp: {
    id: 'mcp',
    title: 'MCP — Model Context Protocol',
    category: 'ai',
    definition: 'Протокол для подключения внешних инструментов к AI-агентам: базы данных, API, файловая система. 60+ инструментов для ФСТ НТИ.',
    formula: 'Agent → MCP Server → Tool Execution → Result → Agent',
    example: 'AI-агент вызывает MCP-инструмент "createDeal" → создаётся запись в Integram → агент получает ID сделки → продолжает работу.',
    relatedTerms: ['tool-calling', 'function-calling', 'integram'],
    context: 'Стандарт от Anthropic для безопасного расширения возможностей AI-агентов.'
  },

  // Дополнительные важные термины
  'hurdle-rate': {
    id: 'hurdle-rate',
    title: 'Hurdle Rate — Минимальная доходность для GP',
    category: 'financial',
    definition: 'Минимальная годовая доходность (обычно 8%), которую LP должны получить до того, как GP начнёт получать carried interest.',
    formula: 'LP сначала получают 100% капитала + 8% годовых, затем GP получает carry',
    example: 'Фонд ₽1 млрд, через 5 лет вернул ₽1.47 млрд (8% годовых). Только прибыль выше этого порога делится 80/20.',
    relatedTerms: ['carried-interest', 'waterfall', 'preferred-return'],
    context: 'Защита LP от чрезмерных выплат GP при посредственной доходности фонда.'
  },

  dilution: {
    id: 'dilution',
    title: 'Dilution — Разводнение доли',
    category: 'venture',
    definition: 'Уменьшение процента владения акционера при выпуске новых акций (новый раунд, опционы).',
    formula: 'Новая доля = Старые акции / (Старые акции + Новые акции)',
    example: 'Основатель владел 60% (600 из 1000 акций). Series A выпустили 500 новых акций → доля = 600/1500 = 40%.',
    relatedTerms: ['anti-dilution', 'pro-rata', 'option-pool'],
    context: 'Неизбежное следствие привлечения капитала. Важно балансировать dilution и потребность в деньгах.'
  },

  'option-pool': {
    id: 'option-pool',
    title: 'Option Pool — Резерв опционов для сотрудников',
    category: 'venture',
    definition: 'Пул акций, зарезервированный для найма ключевых сотрудников. Обычно 10-20% fully-diluted cap table.',
    formula: 'Option Pool = 10-20% post-money капитализации',
    example: 'Pre-money ₽200M, инвестиция ₽50M → post-money ₽250M. Option pool 15% = 37.5M акций.',
    relatedTerms: ['vesting', 'cliff', 'strike-price', 'dilution'],
    context: 'Инвесторы настаивают на создании pool ДО оценки (dilute основателей, не инвесторов). Критический пункт в term sheet.'
  },

  'management-fee': {
    id: 'management-fee',
    title: 'Management Fee — Комиссия за управление',
    category: 'financial',
    definition: 'Ежегодная плата LP управляющей команде (GP) за операционные расходы фонда. Обычно 2% от размера фонда.',
    formula: 'Fee = 2% × Fund Size (на committed capital в первые 5 лет, затем на NAV)',
    example: 'Фонд ₽5 млрд → ₽100 млн/год management fee покрывают зарплаты, офис, due diligence, юристов.',
    relatedTerms: ['gp', 'lp', 'carried-interest', 'economics'],
    context: 'Обеспечивает операционную стабильность GP, но LP следят, чтобы fee не съедали доходность.'
  },

  'investment-memo': {
    id: 'investment-memo',
    title: 'Investment Memo — Инвестиционный меморандум',
    category: 'venture',
    definition: 'Структурированный документ для инвесткомитета: тезис инвестиции, анализ рынка, команды, рисков, финансовая модель, условия сделки.',
    formula: 'Memo = Problem + Solution + Market + Team + Traction + Financials + Terms + Risks',
    example: 'Меморандум на 20 страниц: AI-стартап для агро, рынок ₽50 млрд, команда из Яндекса, 100 клиентов, запрашивают ₽50 млн при ₽500 млн pre-money.',
    relatedTerms: ['ai-committee', 'due-diligence', 'term-sheet'],
    context: 'Ключевой документ для принятия решения инвесткомитетом. В ФСТ НТИ генерируется AI-агентами автоматически.'
  }
}

/**
 * Get term by ID
 */
export function getTermById(termId) {
  return glossaryTerms[termId] || null
}

/**
 * Search terms by keyword
 */
export function searchTerms(query) {
  const lowerQuery = query.toLowerCase()
  return Object.values(glossaryTerms).filter(term =>
    term.title.toLowerCase().includes(lowerQuery) ||
    term.definition.toLowerCase().includes(lowerQuery) ||
    term.category.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Get terms by category
 */
export function getTermsByCategory(category) {
  return Object.values(glossaryTerms).filter(term => term.category === category)
}

/**
 * Get all categories
 */
export function getCategories() {
  return [
    { id: 'financial', label: 'Финансовые метрики', icon: 'pi pi-chart-line' },
    { id: 'venture', label: 'Венчурные термины', icon: 'pi pi-briefcase' },
    { id: 'ai', label: 'AI & Технологии', icon: 'pi pi-sparkles' }
  ]
}

/**
 * Get random terms for discovery
 */
export function getRandomTerms(count = 5) {
  const terms = Object.values(glossaryTerms)
  const shuffled = terms.sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}
