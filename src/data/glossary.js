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
  roi: {
    id: 'roi',
    title: 'ROI — Рентабельность инвестиций',
    category: 'financial',
    definition: 'Return on Investment — отношение прибыли к затратам. Простейшая метрика эффективности инвестиции.',
    formula: 'ROI = (Доход - Затраты) / Затраты × 100%',
    example: 'Инвестировали ₽10 млн, получили ₽15 млн. ROI = (₽15M - ₽10M) / ₽10M = 50%.',
    relatedTerms: ['irr', 'moic', 'roe'],
    context: 'Простая метрика, не учитывает время. Для венчура лучше использовать IRR.'
  },

  roe: {
    id: 'roe',
    title: 'ROE — Рентабельность собственного капитала',
    category: 'financial',
    definition: 'Return on Equity — отношение чистой прибыли к собственному капиталу. Показывает эффективность использования капитала акционеров.',
    formula: 'ROE = Чистая прибыль / Собственный капитал × 100%',
    example: 'Компания заработала ₽20 млн при капитале ₽100 млн. ROE = 20%.',
    relatedTerms: ['roi', 'roa', 'ebitda'],
    context: 'Важная метрика для оценки операционной эффективности портфельных компаний.'
  },

  ebitda: {
    id: 'ebitda',
    title: 'EBITDA — Прибыль до вычетов',
    category: 'financial',
    definition: 'Earnings Before Interest, Taxes, Depreciation, Amortization — операционная прибыль компании без учёта финансовых и бухгалтерских корректировок.',
    formula: 'EBITDA = Выручка - Операционные расходы (без амортизации)',
    example: 'Выручка ₽100 млн, расходы ₽70 млн, амортизация ₽10 млн. EBITDA = ₽30 млн.',
    relatedTerms: ['revenue', 'burn-rate', 'unit-economics'],
    context: 'Стандартная метрика для оценки компаний. Популярна в венчуре с Series B+.'
  },

  rvpi: {
    id: 'rvpi',
    title: 'RVPI — Остаточная стоимость',
    category: 'financial',
    definition: 'Residual Value to Paid-In — отношение текущей стоимости портфеля к внесённому капиталу.',
    formula: 'RVPI = Остаточная стоимость / Внесённый капитал',
    example: 'LP внёс ₽10 млн, текущая стоимость портфеля ₽12 млн. RVPI = 1.2x.',
    relatedTerms: ['dpi', 'tvpi', 'nav'],
    context: 'Показывает нереализованный потенциал фонда. TVPI = DPI + RVPI.'
  },

  'fair-value': {
    id: 'fair-value',
    title: 'Fair Value — Справедливая стоимость',
    category: 'financial',
    definition: 'Оценочная рыночная стоимость актива по стандартам IPEV/ILPA для расчёта NAV.',
    formula: 'Fair Value = Comparable Companies × Adjustments',
    example: 'Аналоги на рынке торгуются при EV/Revenue 10x. Наша компания: ₽50M revenue → Fair Value = ₽500M.',
    relatedTerms: ['nav', 'valuation', 'mark-to-market'],
    context: 'Квартальная переоценка для отчётности LP. Критично для расчёта TVPI и NAV.'
  },

  // Дополнительные венчурные термины
  valuation: {
    id: 'valuation',
    title: 'Valuation — Оценка компании',
    category: 'venture',
    definition: 'Pre-money (до инвестиции) или post-money (после) стоимость компании. Определяет цену акции и долю инвестора.',
    formula: 'Post-money = Pre-money + Investment. Ownership = Investment / Post-money',
    example: 'Pre-money ₽200M, инвестиция ₽50M → Post-money ₽250M. Доля инвестора = 50/250 = 20%.',
    relatedTerms: ['term-sheet', 'cap-table', 'dilution'],
    context: 'Главный предмет переговоров между основателями и инвесторами.'
  },

  'anti-dilution': {
    id: 'anti-dilution',
    title: 'Anti-dilution — Защита от разводнения',
    category: 'venture',
    definition: 'Механизм защиты ранних инвесторов при down round через корректировку цены конверсии.',
    formula: 'Full Ratchet (жёсткий) или Weighted Average (мягкий)',
    example: 'Series A по ₽1000/акция. Series B по ₽500/акция → Full Ratchet пересчитывает Series A до ₽500/акция.',
    relatedTerms: ['down-round', 'weighted-average', 'full-ratchet'],
    context: 'Стандартное условие для institutional investors. Сильно разводняет основателей при down round.'
  },

  'liquidation-preference': {
    id: 'liquidation-preference',
    title: 'Liquidation Preference — Ликвидационное предпочтение',
    category: 'venture',
    definition: 'Приоритет инвесторов при выходе/ликвидации: сначала инвестор получает 1x-3x вложенного, затем остальные.',
    formula: 'Стандарт: 1x participating или 1x non-participating',
    example: 'Инвестор вложил ₽50M с 1x preference. При выходе за ₽100M получает ₽50M + долю от остатка ₽50M.',
    relatedTerms: ['term-sheet', 'waterfall', 'participating-preferred'],
    context: 'Защита инвестора от неудачного exit. Participating preference может быть агрессивным для основателей.'
  },

  sha: {
    id: 'sha',
    title: 'SHA — Акционерное соглашение',
    category: 'venture',
    definition: 'Shareholders Agreement — юридически обязывающий договор между инвесторами и основателями о правах, управлении, exit.',
    formula: 'SHA = Term Sheet + Legal Details (50-100 страниц)',
    example: 'Пункты: board seats, вето-права, drag-along, tag-along, liquidation preference, anti-dilution.',
    relatedTerms: ['term-sheet', 'drag-along', 'tag-along', 'veto-rights'],
    context: 'Финальный документ после Due Diligence. Определяет все права сторон на годы вперёд.'
  },

  'drag-along': {
    id: 'drag-along',
    title: 'Drag-along — Принудительная продажа',
    category: 'venture',
    definition: 'Право мажоритарных акционеров принудить миноритариев продать свои доли при exit сделке.',
    formula: 'Если 75% акционеров согласны продать → остальные 25% обязаны',
    example: 'Покупатель хочет купить 100% компании. 80% акционеров согласны → drag-along принуждает оставшиеся 20%.',
    relatedTerms: ['tag-along', 'sha', 'exit'],
    context: 'Защита от блокировки выгодных M&A сделок миноритариями.'
  },

  'tag-along': {
    id: 'tag-along',
    title: 'Tag-along — Право продать вместе',
    category: 'venture',
    definition: 'Право миноритарных акционеров продать свои доли на тех же условиях, что и мажоритарии.',
    formula: 'Если крупный акционер продаёт → миноритарии могут присоединиться',
    example: 'Основатель продаёт 50% за ₽500/акцию → миноритарии имеют право продать свои доли по той же цене.',
    relatedTerms: ['drag-along', 'sha', 'co-sale-rights'],
    context: 'Защита миноритариев от ситуации, когда основатели exit-нулись, а они остались с неликвидными акциями.'
  },

  'veto-rights': {
    id: 'veto-rights',
    title: 'Veto Rights — Право вето',
    category: 'venture',
    definition: 'Список решений, требующих одобрения инвесторов: M&A, новые раунды, изменение устава, продажа активов.',
    formula: 'Protective provisions в SHA',
    example: 'Компания не может привлечь новый раунд, взять кредит >₽10M, сменить CEO без одобрения Series A инвесторов.',
    relatedTerms: ['sha', 'board-seat', 'protective-provisions'],
    context: 'Баланс контроля между основателями и инвесторами. Слишком много veto парализует компанию.'
  },

  'board-seat': {
    id: 'board-seat',
    title: 'Board Seat — Место в совете директоров',
    category: 'venture',
    definition: 'Представительство инвестора в совете директоров компании для контроля стратегических решений.',
    formula: 'Типичная структура: 2 основателя + 2 инвестора + 1 независимый',
    example: 'Series A фонд получает 1 board seat при инвестиции ₽50M+. Участвует в найме CEO, одобрении бюджета, M&A.',
    relatedTerms: ['veto-rights', 'sha', 'observer-rights'],
    context: 'Критическое право для крупных инвесторов. Observer rights — промежуточный вариант без права голоса.'
  },

  runway: {
    id: 'runway',
    title: 'Runway — Время до конца денег',
    category: 'venture',
    definition: 'Количество месяцев, на которые хватит текущих денежных средств при текущем burn rate.',
    formula: 'Runway (месяцев) = Cash / Monthly Burn Rate',
    example: 'На счёте ₽30 млн, burn rate ₽5 млн/месяц → Runway = 6 месяцев.',
    relatedTerms: ['burn-rate', 'cash-flow', 'bridge-round'],
    context: 'Критический параметр для планирования следующего раунда. Начинать fundraising при runway < 9 месяцев.'
  },

  'burn-rate': {
    id: 'burn-rate',
    title: 'Burn Rate — Скорость сжигания денег',
    category: 'venture',
    definition: 'Ежемесячные чистые расходы компании (операционные затраты минус выручка).',
    formula: 'Burn Rate = Операционные расходы - Выручка (monthly)',
    example: 'Расходы ₽10 млн/месяц, выручка ₽3 млн/месяц → Net Burn = ₽7 млн/месяц.',
    relatedTerms: ['runway', 'unit-economics', 'cash-flow'],
    context: 'Ключевая метрика для early-stage компаний. Высокий burn требует быстрого роста для оправдания.'
  },

  'unit-economics': {
    id: 'unit-economics',
    title: 'Unit Economics — Экономика на единицу',
    category: 'venture',
    definition: 'Прибыльность бизнес-модели в расчёте на одного клиента: LTV vs CAC.',
    formula: 'Healthy: LTV / CAC > 3, Payback < 12 months',
    example: 'SaaS: CAC ₽10K, MRR ₽3K, Churn 5%/мес → LTV ₽60K. Ratio = 6.0 ✅',
    relatedTerms: ['ltv', 'cac', 'payback-period'],
    context: 'Критично для Series A+. Плохие unit economics убивают любой рост.'
  },

  ltv: {
    id: 'ltv',
    title: 'LTV — Пожизненная ценность клиента',
    category: 'venture',
    definition: 'Lifetime Value — общая прибыль от клиента за всё время сотрудничества.',
    formula: 'LTV = ARPU × Gross Margin / Churn Rate',
    example: 'ARPU ₽5K/мес, Margin 80%, Churn 10%/мес → LTV = ₽5K × 0.8 / 0.1 = ₽40K.',
    relatedTerms: ['cac', 'unit-economics', 'churn'],
    context: 'Основа unit economics. LTV > 3× CAC — индикатор здоровой бизнес-модели.'
  },

  cac: {
    id: 'cac',
    title: 'CAC — Стоимость привлечения клиента',
    category: 'venture',
    definition: 'Customer Acquisition Cost — затраты на маркетинг и продажи для привлечения одного платящего клиента.',
    formula: 'CAC = (Marketing + Sales Costs) / New Customers',
    example: 'Потратили ₽1 млн на рекламу, получили 100 клиентов → CAC = ₽10K.',
    relatedTerms: ['ltv', 'unit-economics', 'payback-period'],
    context: 'Ключевая метрика эффективности роста. Должна снижаться со scale компании.'
  },

  // Регуляторные термины
  aml: {
    id: 'aml',
    title: 'AML — Противодействие отмыванию денег',
    category: 'regulation',
    definition: 'Anti-Money Laundering — комплекс процедур проверки источников капитала инвесторов и портфельных компаний.',
    formula: 'AML = KYC + Transaction Monitoring + Suspicious Activity Reports',
    example: 'Фонд проверяет нового LP: запрашивает источники богатства, скринит по санкционным спискам, проверяет UBO.',
    relatedTerms: ['kyc', 'compliance', 'ubo'],
    context: 'Обязательно для венчурных фондов с институциональными LP. Регулируется ФЗ-115 в России.'
  },

  kyc: {
    id: 'kyc',
    title: 'KYC — Знай своего клиента',
    category: 'regulation',
    definition: 'Know Your Customer — процедура идентификации и проверки инвесторов и контрагентов.',
    formula: 'KYC = Identity Verification + Source of Funds + PEP Screening',
    example: 'Новый LP → запрос паспорта, tax ID, proof of address, банковских выписок, деклараций.',
    relatedTerms: ['aml', 'compliance', 'accredited-investor'],
    context: 'Первый шаг onboarding LP в фонд. Без KYC нельзя принять инвестиции.'
  },

  ilpa: {
    id: 'ilpa',
    title: 'ILPA — Стандарты отчётности LP',
    category: 'regulation',
    definition: 'Institutional Limited Partners Association — глобальные стандарты отчётности венчурных фондов для институциональных LP.',
    formula: 'Quarterly: NAV, IRR, DPI, TVPI, Cash Flows, Portfolio Updates',
    example: 'Фонд отправляет LP ежеквартально: обновление оценок портфеля, cash flow statement, детализацию по каждой сделке.',
    relatedTerms: ['lp', 'nav', 'dpi', 'tvpi'],
    context: 'Стандарт для top-tier фондов. Требуют крупные LP (пенсионные фонды, endowments).'
  },

  esg: {
    id: 'esg',
    title: 'ESG — Экологическая, социальная, корпоративная ответственность',
    category: 'regulation',
    definition: 'Environmental, Social, Governance — критерии оценки компаний по устойчивости и этике.',
    formula: 'Scoring: Carbon Footprint + Diversity + Board Independence + ...',
    example: 'Компания получает ESG score 75/100: отлично по Governance, средне по Social, плохо по Environmental.',
    relatedTerms: ['compliance', 'sustainability', 'impact-investing'],
    context: 'Всё больше LP требуют ESG reporting. Может влиять на valuations публичных компаний.'
  },

  'accredited-investor': {
    id: 'accredited-investor',
    title: 'Accredited Investor — Квалифицированный инвестор',
    category: 'regulation',
    definition: 'Физлицо или компания, соответствующие критериям по доходам/активам для инвестиций в венчурные фонды.',
    formula: 'Россия: ₽6M активов или ₽600K годовой доход. США: $1M net worth или $200K income',
    example: 'Семейный офис с ₽500M активов → квалифицированный инвестор → может быть LP фонда.',
    relatedTerms: ['lp', 'kyc', 'sec'],
    context: 'Регуляторная защита неопытных инвесторов от высокорисковых венчурных инвестиций.'
  },

  // AI/Платформа-специфичные термины
  integram: {
    id: 'integram',
    title: 'Integram — NoSQL база ФСТ НТИ',
    category: 'platform',
    definition: 'Фирменная NoSQL база данных на ai2o.ru для хранения всех данных платформы: сделки, портфель, агенты.',
    formula: 'REST API: POST /_m_new/{typeId}, GET /_d_req/{typeId}',
    example: 'Создание сделки: POST /fst/_m_new/123 → запись в типе "Deals".',
    relatedTerms: ['mcp', 'api', 'nosql'],
    context: 'Замена PostgreSQL/MySQL в архитектуре ФСТ НТИ. 60+ MCP-инструментов для AI-агентов.'
  },

  'token-router': {
    id: 'token-router',
    title: 'Token Router — LLM координатор',
    category: 'platform',
    definition: 'Сервис маршрутизации запросов к разным LLM (Claude, DeepSeek, GPT-4o, YandexGPT) с учётом стоимости и задачи.',
    formula: 'Route = TaskType → ModelSelector → API Call',
    example: 'Быстрый код-анализ → DeepSeek. Стратегический документ → Claude Sonnet 4.',
    relatedTerms: ['deepseek', 'claude', 'llm'],
    context: 'Эндпоинт /api/ai-tokens/chat — единая точка для всех AI-запросов платформы.'
  },

  deepseek: {
    id: 'deepseek',
    title: 'DeepSeek — Быстрая LLM для кода',
    category: 'platform',
    definition: 'Китайская LLM, специализирующаяся на коде и структурированных данных. Default модель ФСТ НТИ.',
    formula: 'Speed: 10× faster than GPT-4, Cost: 10× cheaper',
    example: 'Парсинг финмодели, генерация JSON, code review → DeepSeek справляется за секунды.',
    relatedTerms: ['token-router', 'claude', 'gpt-4o'],
    context: 'Используется для 80% AI-запросов платформы. Экономия ~$50K/месяц vs OpenAI.'
  },

  'hyperformula': {
    id: 'hyperformula',
    title: 'HyperFormula — Excel-движок в браузере',
    category: 'platform',
    definition: 'JavaScript библиотека для расчёта сложных финансовых моделей в браузере без сервера.',
    formula: 'Frontend: Vue + HyperFormula = Instant Recalc',
    example: 'Финмодель с 1000 ячеек и формулами → пересчёт за 10ms при изменении параметра.',
    relatedTerms: ['financial-modeling', 'fst-deal'],
    context: 'Основа для интерактивных финмоделей в /fst-deal. Поддерживает 380+ Excel функций.'
  },

  'tick-engine': {
    id: 'tick-engine',
    title: 'Tick Engine — Симуляционный движок',
    category: 'platform',
    definition: 'Event-driven система для симуляции развития портфельных компаний по событиям (hire, revenue, funding).',
    formula: 'Event → State Update → Metrics Recalc → Dashboard Refresh',
    example: 'Событие "+10 клиентов" → обновление MRR → пересчёт Runway → обновление графика NAV.',
    relatedTerms: ['digital-twin', 'simulation', 'portfolio-monitoring'],
    context: 'Основа цифрового двойника компании в /fst-twin. Позволяет прогнозировать сценарии.'
  },

  rag: {
    id: 'rag',
    title: 'RAG — Retrieval-Augmented Generation',
    category: 'platform',
    definition: 'Архитектура AI: поиск релевантных данных → подстановка в контекст LLM → генерация точного ответа.',
    formula: 'Answer = LLM(Question + Retrieved_Context)',
    example: 'Вопрос "IRR фонда?" → Vector DB находит финансовые отчёты → GPT генерирует ответ "23.5% median IRR".',
    relatedTerms: ['kag', 'vector-db', 'knowledge-graph'],
    context: 'Базовая технология для AI-агентов платформы. KAG — улучшенная версия RAG с графом.'
  },

  'vector-db': {
    id: 'vector-db',
    title: 'Vector Database — Векторная база знаний',
    category: 'platform',
    definition: 'База данных для хранения embeddings (векторных представлений) текстов для семантического поиска.',
    formula: 'Text → Embedding Model → Vector → Similarity Search',
    example: 'Запрос "беспилотники" находит документы про "БПЛА", "дроны", "UAV" через cosine similarity.',
    relatedTerms: ['rag', 'kag', 'embeddings'],
    context: 'Часть KAG-системы ФСТ НТИ. 1140+ концептов БПЛА в векторной базе.'
  },

  // Дополнительные венчурные термины
  seed: {
    id: 'seed',
    title: 'Seed Round — Посевной раунд',
    category: 'venture',
    definition: 'Первый институциональный раунд финансирования стартапа для валидации продукта и первых клиентов.',
    formula: 'Обычно: $500K-$3M при оценке $5M-$15M',
    example: 'Стартап с MVP и 100 пользователей привлёк ₽30M seed при оценке ₽200M pre-money.',
    relatedTerms: ['series-a', 'pre-seed', 'valuation'],
    context: 'Критический раунд для достижения product-market fit. Высокий risk, высокий potential return.'
  },

  'series-a': {
    id: 'series-a',
    title: 'Series A — Раунд масштабирования',
    category: 'venture',
    definition: 'Раунд для компаний с доказанным product-market fit, готовых масштабировать бизнес-модель.',
    formula: 'Обычно: $2M-$15M при revenue >$1M ARR',
    example: 'SaaS с ₽50M ARR и положительными unit economics привлёк ₽300M Series A при ₽1.5B оценке.',
    relatedTerms: ['seed', 'series-b', 'product-market-fit'],
    context: 'Фокус на масштабировании: расширение команды, маркетинг, новые рынки.'
  },

  'product-market-fit': {
    id: 'product-market-fit',
    title: 'Product-Market Fit — Соответствие продукт-рынок',
    category: 'venture',
    definition: 'Момент, когда продукт решает реальную проблему достаточного рынка, клиенты готовы платить и рекомендовать.',
    formula: 'PMF индикаторы: >40% "very disappointed" в survey, NPS >50, LTV/CAC >3',
    example: 'После 3 pivot-ов стартап нашёл PMF: organic рост 20%/месяц, 60% клиентов сказали "very disappointed" без продукта.',
    relatedTerms: ['series-a', 'pivot', 'retention'],
    context: 'Holy grail для стартапов. До PMF — выживание, после PMF — масштабирование.'
  },

  pivot: {
    id: 'pivot',
    title: 'Pivot — Изменение бизнес-модели',
    category: 'venture',
    definition: 'Кардинальное изменение продукта, целевой аудитории или бизнес-модели на основе обратной связи рынка.',
    formula: 'Trigger: плохой retention, высокий CAC, отсутствие PMF',
    example: 'Instagram начинался как Burbn (check-in app), pivot на фото → product-market fit.',
    relatedTerms: ['product-market-fit', 'lean-startup', 'iteration'],
    context: 'Нормальная часть поиска PMF. Большинство успешных стартапов делали 1-3 pivot.'
  },

  'bridge-round': {
    id: 'bridge-round',
    title: 'Bridge Round — Промежуточное финансирование',
    category: 'venture',
    definition: 'Краткосрочный раунд для продления runway до следующего большого раунда. Часто от существующих инвесторов.',
    formula: 'Обычно: конвертируемый заём или SAFE, размер <50% последнего раунда',
    example: 'Series A инвесторы дают ₽20M bridge (convertible note 20% discount) чтобы компания дожила до Series B.',
    relatedTerms: ['runway', 'convertible-note', 'down-round'],
    context: 'Может быть позитивным (подготовка к росту) или негативным (выживание) сигналом.'
  },

  // Регуляторные термины
  'pp-1726': {
    id: 'pp-1726',
    title: 'ПП-1726 — Реестр производителей БПЛА',
    category: 'regulation',
    definition: 'Постановление Правительства РФ №1726 о создании реестра российских производителей беспилотных авиационных систем.',
    formula: 'Требования: российское юрлицо, производство в РФ, сертификация',
    example: 'Компания подаёт заявку в реестр → проверка Минпромторгом → включение в реестр → доступ к госзакупкам.',
    relatedTerms: ['compliance', 'uav', 'certification'],
    context: 'Критично для БПЛА-стартапов в портфеле ФСТ НТИ. Включение в реестр открывает доступ к госконтрактам.'
  },

  'catch-up': {
    id: 'catch-up',
    title: 'Catch-up — Догоняющая выплата GP',
    category: 'financial',
    definition: 'Механизм в waterfall, позволяющий GP быстро получить свой carry после выплаты hurdle rate LP.',
    formula: '100% выплат GP до достижения эффективной ставки carry (обычно 20%)',
    example: 'После возврата капитала и hurdle 8%, GP получает 100% следующих выплат пока не "догонит" до своих 20% от всей прибыли.',
    relatedTerms: ['waterfall', 'carried-interest', 'hurdle-rate'],
    context: 'Ускоряет motivation GP за перформанс. Типичная структура: 1x return → 8% hurdle → catch-up → 80/20 split.'
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
    { id: 'platform', label: 'Платформа', icon: 'pi-desktop' }
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
