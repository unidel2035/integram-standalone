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
  },

  // Дополнительные финансовые метрики
  rvpi: {
    id: 'rvpi',
    title: 'RVPI — Остаточная стоимость',
    category: 'financial',
    definition: 'Residual Value to Paid-In — отношение текущей стоимости портфеля к внесённому капиталу. Показывает нереализованную стоимость.',
    formula: 'RVPI = Остаточная стоимость портфеля / Внесённый капитал',
    example: 'LP внёс ₽10 млн, текущая оценка портфеля ₽15 млн. RVPI = 1.5x.',
    relatedTerms: ['tvpi', 'dpi', 'nav'],
    context: 'TVPI = DPI + RVPI. Высокий RVPI при низком DPI может указывать на проблемы с ликвидностью.'
  },

  roi: {
    id: 'roi',
    title: 'ROI — Возврат на инвестиции',
    category: 'financial',
    definition: 'Return on Investment — процентная прибыль от инвестиции без учёта времени.',
    formula: 'ROI = (Выручка - Инвестиция) / Инвестиция × 100%',
    example: 'Инвестиция ₽10 млн, выход ₽40 млн. ROI = 300%.',
    relatedTerms: ['irr', 'moic'],
    context: 'Простая метрика, но не учитывает время — IRR более точная для венчура.'
  },

  roe: {
    id: 'roe',
    title: 'ROE — Рентабельность капитала',
    category: 'financial',
    definition: 'Return on Equity — отношение чистой прибыли к собственному капиталу компании.',
    formula: 'ROE = Чистая прибыль / Собственный капитал × 100%',
    example: 'Стартап с капиталом ₽100 млн заработал ₽20 млн прибыли. ROE = 20%.',
    relatedTerms: ['ebitda', 'unit-economics'],
    context: 'Важная метрика для оценки эффективности использования капитала портфельной компанией.'
  },

  ebitda: {
    id: 'ebitda',
    title: 'EBITDA — Операционная прибыль',
    category: 'financial',
    definition: 'Earnings Before Interest, Taxes, Depreciation & Amortization — прибыль до вычета процентов, налогов и амортизации.',
    formula: 'EBITDA = Выручка - Операционные расходы',
    example: 'Выручка ₽500 млн, затраты ₽350 млн. EBITDA = ₽150 млн (маржа 30%).',
    relatedTerms: ['unit-economics', 'burn-rate', 'runway'],
    context: 'Ключевая метрика для оценки компаний на поздних стадиях и при M&A.'
  },

  'burn-rate': {
    id: 'burn-rate',
    title: 'Burn Rate — Скорость сжигания капитала',
    category: 'financial',
    definition: 'Месячный отрицательный денежный поток компании. Показывает, как быстро стартап тратит капитал.',
    formula: 'Monthly Burn = Расходы - Доходы (если отрицательно)',
    example: 'Стартап тратит ₽10 млн/месяц, зарабатывает ₽3 млн. Burn rate = ₽7 млн/месяц.',
    relatedTerms: ['runway', 'unit-economics', 'ebitda'],
    context: 'Критический показатель для принятия решения о bridge-раунде или down-round.'
  },

  runway: {
    id: 'runway',
    title: 'Runway — Взлётная полоса',
    category: 'financial',
    definition: 'Количество месяцев, на которые хватит денег компании при текущем burn rate.',
    formula: 'Runway (месяцы) = Баланс / Monthly Burn Rate',
    example: 'В банке ₽50 млн, burn rate ₽5 млн/месяц. Runway = 10 месяцев.',
    relatedTerms: ['burn-rate', 'bridge-round', 'extension'],
    context: 'Runway < 6 месяцев — критический сигнал для запуска нового раунда.'
  },

  'fair-value': {
    id: 'fair-value',
    title: 'Fair Value — Справедливая стоимость',
    category: 'financial',
    definition: 'Независимая оценка стоимости компании для расчёта NAV фонда по стандартам IPEV/ILPA.',
    formula: 'Fair Value = последний раунд или DCF/Multiple методы',
    example: 'Последний раунд Series B был ₽1 млрд 6 месяцев назад → Fair Value = ₽1 млрд для NAV.',
    relatedTerms: ['nav', 'mark-to-market', 'write-down'],
    context: 'Квартальная переоценка портфеля для отчётности LP. Консервативный подход защищает от завышения NAV.'
  },

  // Дополнительные венчурные термины
  'liquidation-preference': {
    id: 'liquidation-preference',
    title: 'Liquidation Preference — Ликвидационное предпочтение',
    category: 'venture',
    definition: 'Право инвесторов получить возврат капитала в приоритете перед обычными акционерами при выходе или ликвидации.',
    formula: '1x = возврат инвестиции, 2x = удвоенная сумма инвестиции',
    example: 'Инвестор вложил ₽100 млн с 1x preference. При продаже за ₽80 млн инвестор получает всё, основатели — ничего.',
    relatedTerms: ['participating-preferred', 'non-participating', 'down-round'],
    context: 'Защита инвесторов при неудачных выходах. 1x — стандарт, >1x — агрессивные условия.'
  },

  'participating-preferred': {
    id: 'participating-preferred',
    title: 'Participating Preferred — Участвующие привилегированные акции',
    category: 'venture',
    definition: 'Тип привилегированных акций, где инвестор получает preference + долю остатка. "Double dipping".',
    formula: 'Выплата = Preference + (Остаток × Ownership %)',
    example: 'Вложил ₽100М (20%), выход ₽1млрд. Получает ₽100М preference + 20% × ₽900М = ₽280М total.',
    relatedTerms: ['liquidation-preference', 'non-participating', 'cap'],
    context: 'Выгодно инвесторам, невыгодно основателям. В USA всё реже из-за founder-friendly рынка.'
  },

  'anti-dilution': {
    id: 'anti-dilution',
    title: 'Anti-Dilution — Защита от разводнения',
    category: 'venture',
    definition: 'Механизм защиты ранних инвесторов при down round: цена их акций пересчитывается вниз.',
    formula: 'Full Ratchet или Weighted Average',
    example: 'Инвестор купил по ₽1000/акция, down round ₽500/акция → anti-dilution даёт в 2 раза больше акций.',
    relatedTerms: ['down-round', 'full-ratchet', 'weighted-average'],
    context: 'Сильно разводняет основателей при down round. Full ratchet — жёсткий, weighted average — мягкий.'
  },

  'full-ratchet': {
    id: 'full-ratchet',
    title: 'Full Ratchet — Полная защита от разводнения',
    category: 'venture',
    definition: 'Жёсткая anti-dilution защита: цена акций инвестора пересчитывается до цены down round полностью.',
    formula: 'Новая цена = Цена down round (независимо от размера раунда)',
    example: 'Вложил ₽10М по ₽1000/акция (10К акций). Down round ₽200/акция → получает 50К акций.',
    relatedTerms: ['anti-dilution', 'weighted-average', 'down-round'],
    context: 'Крайне невыгодно основателям. Почти не используется в современных term sheets.'
  },

  'weighted-average': {
    id: 'weighted-average',
    title: 'Weighted Average — Взвешенная защита',
    category: 'venture',
    definition: 'Мягкая anti-dilution защита: корректировка цены зависит от размера down round.',
    formula: 'New Price = Old Price × (Old Money + New Money) / (Old Money + Down Round Money)',
    example: 'Down round на ₽10М при ₽100М cap → минимальное разводнение. Down round ₽90М → сильное.',
    relatedTerms: ['anti-dilution', 'full-ratchet', 'broad-based'],
    context: 'Стандартная anti-dilution защита в современных term sheets. Справедливый компромисс.'
  },

  'preemptive-right': {
    id: 'preemptive-right',
    title: 'Preemptive Right — Преимущественное право',
    category: 'venture',
    definition: 'Право акционера приобрести новые акции до их предложения третьим лицам.',
    formula: 'Право на покупку новых акций пропорционально текущей доле',
    example: 'Владелец 10% имеет право купить 10% новых акций перед новыми инвесторами.',
    relatedTerms: ['pro-rata', 'rofr', 'tag-along'],
    context: 'Защита существующих акционеров от размывания и входа нежелательных инвесторов.'
  },

  rofr: {
    id: 'rofr',
    title: 'ROFR — Право первого отказа',
    category: 'venture',
    definition: 'Right of First Refusal — право инвестора купить акции на тех же условиях, что предложены третьим лицам.',
    formula: 'Акционер получает оффер → ROFR holder может перехватить на тех же условиях',
    example: 'Основатель хочет продать 5% за ₽50М → фонд по ROFR может купить на тех же условиях.',
    relatedTerms: ['tag-along', 'drag-along', 'secondary'],
    context: 'Контроль фонда над составом акционеров и возможность увеличить долю.'
  },

  'tag-along': {
    id: 'tag-along',
    title: 'Tag-Along — Право на совместную продажу',
    category: 'venture',
    definition: 'Право миноритарных акционеров присоединиться к продаже мажоритарием на тех же условиях.',
    formula: 'Major продаёт 60% → minority имеет право продать свою долю на тех же условиях',
    example: 'Основатель продаёт 60% за ₽1 млрд → миноритарии могут продать свои доли по той же цене.',
    relatedTerms: ['drag-along', 'rofr', 'exit'],
    context: 'Защита миноритариев от "застревания" в компании после выхода мажоритария.'
  },

  'drag-along': {
    id: 'drag-along',
    title: 'Drag-Along — Право на принудительную продажу',
    category: 'venture',
    definition: 'Право мажоритарных акционеров обязать миноритариев продать акции при M&A сделке.',
    formula: 'Если >50% акционеров согласны продать → все остальные обязаны продать',
    example: 'Оффер на покупку 100% компании за ₽2 млрд. Drag-along заставляет всех акционеров согласиться.',
    relatedTerms: ['tag-along', 'exit', 'm&a'],
    context: 'Критично для покупателя, который хочет 100% контроль. Защищает от блокировки сделки миноритариями.'
  },

  'bridge-round': {
    id: 'bridge-round',
    title: 'Bridge Round — Промежуточный раунд',
    category: 'venture',
    definition: 'Небольшой раунд между основными раундами для продления runway до следующего milestone.',
    formula: 'Обычно конвертируемый заём с дисконтом к следующему раунду',
    example: 'Между Series A и B runway заканчивается → bridge ₽20М на 6 месяцев для достижения revenue target.',
    relatedTerms: ['convertible-note', 'runway', 'extension'],
    context: 'Может быть сигналом проблем (не достигли milestones) или просто плохого timing рынка.'
  },

  extension: {
    id: 'extension',
    title: 'Extension Round — Раунд-расширение',
    category: 'venture',
    definition: 'Дополнительное финансирование на той же стадии и оценке (Series A1, A2, B1...).',
    formula: 'Та же серия, та же оценка, новые инвесторы',
    example: 'Series B на ₽500М, через 6 месяцев Series B1 на ₽200М при той же оценке.',
    relatedTerms: ['bridge-round', 'flat-round', 'insider-round'],
    context: 'Лучше чем down round, но сигнал что компания не показала рост для up round.'
  },

  'flat-round': {
    id: 'flat-round',
    title: 'Flat Round — Раунд без роста оценки',
    category: 'venture',
    definition: 'Раунд финансирования с такой же оценкой, как предыдущий раунд.',
    formula: 'Previous Valuation = Current Valuation',
    example: 'Series A — ₽1 млрд, Series B — ₽1 млрд (flat round).',
    relatedTerms: ['down-round', 'extension', 'insider-round'],
    context: 'Сигнал стагнации роста. Лучше чем down round, но разочаровывает ранних инвесторов.'
  },

  // Регулирование и комплаенс
  aml: {
    id: 'aml',
    title: 'AML — Противодействие отмыванию денег',
    category: 'regulation',
    definition: 'Anti-Money Laundering — комплекс мер по предотвращению использования финансовой системы для легализации преступных доходов.',
    formula: 'KYC + Transaction Monitoring + SAR reporting',
    example: 'Фонд проверяет источник средств LP перед принятием ₽1 млрд инвестиций.',
    relatedTerms: ['kyc', 'compliance', 'due-diligence'],
    context: 'Обязательное требование для фондов. Нарушение — штрафы до ₽500М и уголовная ответственность.'
  },

  kyc: {
    id: 'kyc',
    title: 'KYC — Знай своего клиента',
    category: 'regulation',
    definition: 'Know Your Customer — процесс идентификации и верификации личности клиента/партнёра.',
    formula: 'ID Verification + Beneficial Owner + Source of Funds + PEP screening',
    example: 'LP предоставляет паспорт, выписку из ЕГРЮЛ, документы о происхождении средств.',
    relatedTerms: ['aml', 'due-diligence', 'compliance'],
    context: 'Обязательная процедура при onboarding LP и портфельных компаний.'
  },

  ilpa: {
    id: 'ilpa',
    title: 'ILPA — Ассоциация ограниченных партнёров',
    category: 'regulation',
    definition: 'Institutional Limited Partners Association — глобальная ассоциация институциональных LP, устанавливающая стандарты отчётности.',
    formula: 'Quarterly NAV + Cash Flows + Performance Metrics + Portfolio Details',
    example: 'Фонд отчитывается LP по ILPA Reporting Template: IRR, DPI, TVPI, список всех сделок.',
    relatedTerms: ['lp', 'nav', 'transparency'],
    context: 'ILPA стандарты — требование большинства западных институциональных LP.'
  },

  esg: {
    id: 'esg',
    title: 'ESG — Экологическое, социальное и корпоративное управление',
    category: 'regulation',
    definition: 'Environmental, Social, Governance — критерии оценки устойчивого развития компании.',
    formula: 'ESG Score = E (carbon footprint) + S (diversity, labor) + G (board, ethics)',
    example: 'Портфельная компания: E=7/10 (зелёная энергия), S=6/10 (30% женщин), G=8/10 (независимый совет).',
    relatedTerms: ['impact-investing', 'sri', 'sustainability'],
    context: 'Всё больше LP требуют ESG due diligence. Низкий ESG → risk для репутации фонда.'
  },

  'pp-1726': {
    id: 'pp-1726',
    title: 'ПП-1726 — Реестр производителей БПЛА',
    category: 'regulation',
    definition: 'Постановление Правительства РФ №1726 о создании реестра производителей беспилотных авиационных систем.',
    formula: 'Единый реестр российских производителей БПЛА для гособоронзаказа',
    example: 'Для участия в гособоронзаказе компания должна быть внесена в реестр по ПП-1726.',
    relatedTerms: ['sovereignty', 'natproject', 'compliance'],
    context: 'Критическое требование для портфельных компаний ФСТ НТИ в секторе БПЛА.'
  },

  'fsbu-4': {
    id: 'fsbu-4',
    title: 'ФСБУ 4/2023 — Учёт договоров аренды',
    category: 'regulation',
    definition: 'Федеральный стандарт бухгалтерского учёта для учёта договоров аренды (аналог IFRS 16).',
    formula: 'Арендатор учитывает right-of-use актив и lease liability',
    example: 'Офис в аренду за ₽10 млн/год на 5 лет → актив ₽50М в балансе.',
    relatedTerms: ['accounting', 'back-office', 'compliance'],
    context: 'Важно для корректного расчёта EBITDA и NAV портфельных компаний.'
  },

  // AI и платформа
  'tool-calling': {
    id: 'tool-calling',
    title: 'Tool Calling — Вызов функций AI',
    category: 'ai',
    definition: 'Способность LLM вызывать внешние функции/API на основе анализа запроса пользователя.',
    formula: 'User Query → LLM analyzes → Function call → Execute → Return result',
    example: 'Запрос "Создай сделку для Startup X" → AI вызывает createDeal({name: "Startup X"}) → возвращает ID сделки.',
    relatedTerms: ['mcp', 'function-calling', 'agents'],
    context: 'Основа MCP протокола — AI агенты могут управлять базой данных через tool calling.'
  },

  rag: {
    id: 'rag',
    title: 'RAG — Генерация с дополнением из базы знаний',
    category: 'ai',
    definition: 'Retrieval-Augmented Generation — техника, где LLM сначала находит релевантные документы, затем генерирует ответ.',
    formula: 'Query → Vector Search → Top K docs → LLM(Query + Docs) → Answer',
    example: 'Вопрос "IRR портфеля 2024?" → RAG находит отчёты Q1-Q4 2024 → GPT генерирует "IRR 28%".',
    relatedTerms: ['kag', 'vector-db', 'embedding'],
    context: 'RAG — foundation для точных ответов AI без галлюцинаций. KAG = RAG + Knowledge Graph.'
  },

  'vector-db': {
    id: 'vector-db',
    title: 'Vector Database — Векторная база данных',
    category: 'ai',
    definition: 'База данных, оптимизированная для хранения и поиска embedding векторов по семантической близости.',
    formula: 'Cosine Similarity(Query_Vector, Document_Vectors) → Top K results',
    example: 'Запрос "IRR фонда" → embedding → поиск похожих векторов → документы с метриками IRR.',
    relatedTerms: ['embedding', 'rag', 'kag'],
    context: 'Используется для семантического поиска в 1140 концептах БПЛА онтологии ФСТ НТИ.'
  },

  embedding: {
    id: 'embedding',
    title: 'Embedding — Векторное представление',
    category: 'ai',
    definition: 'Числовой вектор фиксированной длины, представляющий семантический смысл текста/изображения.',
    formula: 'Text → Embedding Model → Vector[1536] (для OpenAI ada-002)',
    example: '"IRR фонда" и "доходность портфеля" имеют близкие embedding векторы (cosine similarity > 0.8).',
    relatedTerms: ['vector-db', 'semantic-search', 'rag'],
    context: 'Foundation для всех modern AI систем поиска и рекомендаций.'
  },

  'knowledge-graph': {
    id: 'knowledge-graph',
    title: 'Knowledge Graph — Граф знаний',
    category: 'ai',
    definition: 'Структурированная база знаний в виде графа: узлы (концепты) и рёбра (связи).',
    formula: 'Nodes (entities) + Edges (relationships) + Properties',
    example: 'Узлы: БПЛА, AI, Фонд. Рёбра: БПЛА →uses→ AI, Фонд →invests_in→ БПЛА.',
    relatedTerms: ['kag', 'ontology', 'semantic-web'],
    context: 'ФСТ НТИ использует граф из 1140 концептов БПЛА для навигации по знаниям.'
  },

  integram: {
    id: 'integram',
    title: 'Integram — NoSQL база данных платформы',
    category: 'platform',
    definition: 'Кастомная NoSQL база данных ФСТ НТИ на ai2o.ru для хранения сделок, портфеля, агентов.',
    formula: 'REST API: POST /{db}/_m_new/{typeId} для создания объектов',
    example: 'POST /fst/_m_new/2001 создаёт новую сделку в базе fst.',
    relatedTerms: ['mcp', 'api', 'database'],
    context: 'Единственная база данных платформы. Никакого PostgreSQL/MySQL — только Integram.'
  },

  'workspace-agent': {
    id: 'workspace-agent',
    title: 'Workspace Agent — Агент рабочего пространства',
    category: 'platform',
    definition: 'AI-агент, привязанный к конкретному workspace (фонду), имеющий доступ к данным только этого workspace.',
    formula: 'User → Workspace → Agents → Tools (filtered by workspace_id)',
    example: 'Агент "Portfolio Analyst" фонда A видит только сделки фонда A, но не фонда B.',
    relatedTerms: ['mcp', 'rbac', 'multi-tenancy'],
    context: 'Обеспечивает изоляцию данных между фондами на одной платформе.'
  },

  'unit-economics': {
    id: 'unit-economics',
    title: 'Unit Economics — Экономика единицы',
    category: 'financial',
    definition: 'Прибыльность одного клиента/транзакции: LTV (lifetime value) vs CAC (customer acquisition cost).',
    formula: 'LTV / CAC > 3 — хорошо, Payback Period < 12 месяцев — отлично',
    example: 'SaaS: CAC ₽10К, LTV ₽50К → LTV/CAC = 5x — отличная unit economics.',
    relatedTerms: ['ltv', 'cac', 'payback-period'],
    context: 'Ключевая метрика для оценки масштабируемости бизнес-модели стартапа.'
  },

  ltv: {
    id: 'ltv',
    title: 'LTV — Пожизненная ценность клиента',
    category: 'financial',
    definition: 'Lifetime Value — совокупный доход от одного клиента за всё время сотрудничества.',
    formula: 'LTV = ARPU × Gross Margin × 1/Churn Rate',
    example: 'SaaS: ₽5К/месяц ARPU, 70% margin, 5% churn → LTV = ₽5K × 0.7 × 20 = ₽70К.',
    relatedTerms: ['cac', 'unit-economics', 'arpu'],
    context: 'Фундаментальная метрика для SaaS и subscription бизнесов.'
  },

  cac: {
    id: 'cac',
    title: 'CAC — Стоимость привлечения клиента',
    category: 'financial',
    definition: 'Customer Acquisition Cost — затраты на маркетинг и продажи для привлечения одного клиента.',
    formula: 'CAC = (Marketing + Sales costs) / New Customers',
    example: 'Потрачено ₽10 млн на маркетинг, привлечено 1000 клиентов → CAC = ₽10К.',
    relatedTerms: ['ltv', 'unit-economics', 'payback-period'],
    context: 'CAC растёт со временем (конкуренция) — важно отслеживать в динамике.'
  },

  arpu: {
    id: 'arpu',
    title: 'ARPU — Средний доход на пользователя',
    category: 'financial',
    definition: 'Average Revenue Per User — средний месячный доход от одного пользователя/клиента.',
    formula: 'ARPU = Total Revenue / Active Users',
    example: 'MRR ₽10 млн, 2000 клиентов → ARPU = ₽5000/месяц.',
    relatedTerms: ['mrr', 'ltv', 'arr'],
    context: 'Ключевая метрика для SaaS. Рост ARPU лучше чем просто рост клиентов.'
  },

  mrr: {
    id: 'mrr',
    title: 'MRR — Месячный регулярный доход',
    category: 'financial',
    definition: 'Monthly Recurring Revenue — предсказуемый регулярный доход от подписок за месяц.',
    formula: 'MRR = Sum of all monthly subscription revenue',
    example: '500 клиентов × ₽10К/месяц = ₽5М MRR.',
    relatedTerms: ['arr', 'arpu', 'churn'],
    context: 'Основная метрика для SaaS стартапов. MRR × 12 ≈ ARR.'
  },

  arr: {
    id: 'arr',
    title: 'ARR — Годовой регулярный доход',
    category: 'financial',
    definition: 'Annual Recurring Revenue — предсказуемый годовой доход от подписок.',
    formula: 'ARR = MRR × 12 или Sum of annual contracts',
    example: 'MRR ₽10М → ARR = ₽120М.',
    relatedTerms: ['mrr', 'revenue-multiple', 'valuation'],
    context: 'Основа для оценки SaaS компаний: Valuation = ARR × Multiple (5-15x).'
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
    { id: 'financial', label: 'Финансовые метрики', icon: 'pi-chart-line' },
    { id: 'venture', label: 'Венчурные термины', icon: 'pi-briefcase' },
    { id: 'ai', label: 'AI & Технологии', icon: 'pi-sparkles' },
    { id: 'regulation', label: 'Регулирование', icon: 'pi-shield' },
    { id: 'platform', label: 'Платформа', icon: 'pi-cog' }
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
