/**
 * Platform Page Manifests
 *
 * Machine-readable metadata for all FST platform pages.
 * Used by AI agents (via MCP or direct call) to understand the platform:
 * what each page does, what data is available, what actions are possible.
 *
 * Format per page:
 *  - id: unique route identifier (matches Vue Router path)
 *  - title: human-readable page title
 *  - description: what this page does
 *  - capabilities: list of actions agents can trigger
 *  - dataFields: data exposed/consumed by this page
 *  - relatedPages: pages that are contextually linked
 */

export const pageManifests = {
  'fst-hub': {
    id: 'fst-hub',
    title: 'Хаб модулей фонда',
    description: 'Центральная точка входа в платформу ФСТ НТИ. Показывает все доступные модули фонда с быстрым переходом к каждому.',
    capabilities: [
      { id: 'navigate-module', label: 'Перейти к модулю', trigger: 'a[data-action="navigate-module"]', params: ['moduleId'] }
    ],
    dataFields: [
      { id: 'module-list', label: 'Список модулей', type: 'array' }
    ],
    relatedPages: ['fst-committee', 'fst-dealflow', 'fst-portfolio']
  },

  'fst-committee': {
    id: 'fst-committee',
    title: 'AI-инвесткомитет',
    description: 'Запуск голосования 6 AI-агентов по инвестиционной заявке. Агенты анализируют заявку с разных ролей (Аналитик, Юрист, Технолог, ESG, Рынок, Председатель) и выносят решение.',
    capabilities: [
      { id: 'run-committee', label: 'Запустить ИК', trigger: 'button[data-action="run-investment-committee"]', params: ['companyId'], agentHint: 'Требует выбранную компанию. Ждать 30–60 сек до получения результата.' },
      { id: 'view-protocol', label: 'Просмотр протокола', trigger: 'button[data-action="view-protocol"]' },
      { id: 'export-pdf', label: 'Экспорт в PDF', trigger: 'button[data-action="export-pdf"]' },
      { id: 'select-company', label: 'Выбор компании', trigger: 'select[data-action="select-company"]', params: ['companyId'] }
    ],
    dataFields: [
      { id: 'company-name', label: 'Название компании', type: 'string' },
      { id: 'vote-result', label: 'Результат голосования', type: 'enum', values: ['approved', 'rejected', 'conditional', 'pending'] },
      { id: 'aggregated-score', label: 'Итоговый балл', type: 'number', range: [0, 100] },
      { id: 'agent-votes', label: 'Голоса агентов', type: 'array' },
      { id: 'conditions', label: 'Условия одобрения', type: 'array' }
    ],
    relatedPages: ['fst-dealflow', 'fst-deal', 'fst-protocol']
  },

  'fst-protocol': {
    id: 'fst-protocol',
    title: 'Протоколы инвесткомитета',
    description: 'Хранилище и просмотр протоколов заседаний инвестиционного комитета. Поиск по компании, дате, решению.',
    capabilities: [
      { id: 'search-protocol', label: 'Поиск протокола', trigger: 'input[data-action="search-protocol"]', params: ['query'] },
      { id: 'view-protocol', label: 'Просмотр протокола', trigger: 'button[data-action="view-protocol"]', params: ['protocolId'] },
      { id: 'export-pdf', label: 'Экспорт в PDF', trigger: 'button[data-action="export-pdf"]', params: ['protocolId'] }
    ],
    dataFields: [
      { id: 'protocol-list', label: 'Список протоколов', type: 'array' },
      { id: 'company-name', label: 'Название компании', type: 'string' },
      { id: 'decision', label: 'Решение ИК', type: 'enum', values: ['approved', 'rejected', 'conditional'] },
      { id: 'date', label: 'Дата заседания', type: 'date' }
    ],
    relatedPages: ['fst-committee', 'fst-deal']
  },

  'fst-dealflow': {
    id: 'fst-dealflow',
    title: 'Воронка сделок',
    description: 'Канбан-доска сделок по этапам: входящие заявки → скрининг → due diligence → ИК → закрытие. Управление воронкой входящих заявок.',
    capabilities: [
      { id: 'add-deal', label: 'Добавить сделку', trigger: 'button[data-action="add-deal"]' },
      { id: 'move-stage', label: 'Переместить по этапам', trigger: 'div[data-action="move-stage"]', params: ['dealId', 'stage'] },
      { id: 'run-committee', label: 'Отправить на ИК', trigger: 'button[data-action="run-committee"]', params: ['dealId'] },
      { id: 'filter-deals', label: 'Фильтр сделок', trigger: 'select[data-action="filter-deals"]', params: ['stage', 'sector'] }
    ],
    dataFields: [
      { id: 'deals', label: 'Список сделок', type: 'array' },
      { id: 'stage', label: 'Этап воронки', type: 'enum', values: ['incoming', 'screening', 'due-diligence', 'committee', 'closing'] },
      { id: 'sector', label: 'Сектор', type: 'string' },
      { id: 'score', label: 'AI-оценка', type: 'number', range: [0, 100] }
    ],
    relatedPages: ['fst-committee', 'fst-deal', 'fst-sourcing']
  },

  'fst-deal': {
    id: 'fst-deal',
    title: 'Доведение сделки',
    description: 'Управление сделкой: SPV-структура, транши, Term Sheet, финансовая модель. Весь жизненный цикл от заключения до закрытия.',
    capabilities: [
      { id: 'create-spv', label: 'Создать SPV', trigger: 'button[data-action="create-spv"]' },
      { id: 'add-tranche', label: 'Добавить транш', trigger: 'button[data-action="add-tranche"]', params: ['amount', 'date', 'conditions'] },
      { id: 'generate-termsheet', label: 'Сгенерировать Term Sheet', trigger: 'button[data-action="generate-termsheet"]', agentHint: 'AI генерирует Term Sheet на основе параметров сделки' },
      { id: 'open-finmodel', label: 'Открыть финмодель', trigger: 'button[data-action="open-finmodel"]' }
    ],
    dataFields: [
      { id: 'company-name', label: 'Название компании', type: 'string' },
      { id: 'investment-amount', label: 'Сумма инвестиций', type: 'number' },
      { id: 'valuation', label: 'Оценка компании', type: 'number' },
      { id: 'equity-stake', label: 'Доля фонда', type: 'number' },
      { id: 'tranches', label: 'Транши', type: 'array' },
      { id: 'spv-status', label: 'Статус SPV', type: 'enum', values: ['not-created', 'pending', 'active'] }
    ],
    relatedPages: ['fst-committee', 'fst-captable', 'fst-portfolio']
  },

  'fst-portfolio': {
    id: 'fst-portfolio',
    title: 'Портфельный монитор',
    description: 'Мониторинг портфеля: светофор здоровья компаний, датчики KPI, AI-отчёты. Риск-мониторинг и аналитика по всем портфельным компаниям.',
    capabilities: [
      { id: 'generate-report', label: 'Сгенерировать AI-отчёт', trigger: 'button[data-action="generate-ai-report"]', params: ['companyId'], agentHint: 'AI анализирует метрики и генерирует текстовый отчёт' },
      { id: 'filter-companies', label: 'Фильтр компаний', trigger: 'select[data-action="filter-companies"]', params: ['status', 'sector'] },
      { id: 'view-company', label: 'Просмотр компании', trigger: 'button[data-action="view-company"]', params: ['companyId'] }
    ],
    dataFields: [
      { id: 'companies', label: 'Портфельные компании', type: 'array' },
      { id: 'health-status', label: 'Статус здоровья', type: 'enum', values: ['green', 'yellow', 'red'] },
      { id: 'kpi-sensors', label: 'KPI датчики', type: 'array' },
      { id: 'nav', label: 'NAV фонда', type: 'number' },
      { id: 'irr', label: 'IRR портфеля', type: 'number' }
    ],
    relatedPages: ['fst-execution', 'fst-fund', 'fst-intelligence']
  },

  'fst-execution': {
    id: 'fst-execution',
    title: 'Исполнение сделок',
    description: 'Kanban-доска задач и KPI по портфельным компаниям. Управление действиями фонда: milestones, контроль условий транша.',
    capabilities: [
      { id: 'add-task', label: 'Добавить задачу', trigger: 'button[data-action="add-task"]', params: ['companyId', 'title', 'dueDate'] },
      { id: 'move-task', label: 'Переместить задачу', trigger: 'div[data-action="move-task"]', params: ['taskId', 'column'] },
      { id: 'update-kpi', label: 'Обновить KPI', trigger: 'button[data-action="update-kpi"]', params: ['companyId', 'kpiId', 'value'] }
    ],
    dataFields: [
      { id: 'tasks', label: 'Задачи', type: 'array' },
      { id: 'kpis', label: 'KPI', type: 'array' },
      { id: 'company-filter', label: 'Фильтр компании', type: 'string' }
    ],
    relatedPages: ['fst-portfolio', 'fst-board', 'fst-founders']
  },

  'fst-twin': {
    id: 'fst-twin',
    title: 'Цифровой двойник компании',
    description: 'Симуляция компании через tick-engine. Прогноз финансовых метрик, моделирование сценариев (оптимистический/базовый/пессимистический).',
    capabilities: [
      { id: 'run-simulation', label: 'Запустить симуляцию', trigger: 'button[data-action="run-simulation"]', params: ['companyId', 'scenario'] },
      { id: 'change-scenario', label: 'Сменить сценарий', trigger: 'select[data-action="change-scenario"]', params: ['scenario'] }
    ],
    dataFields: [
      { id: 'company-id', label: 'ID компании', type: 'string' },
      { id: 'scenario', label: 'Сценарий', type: 'enum', values: ['optimistic', 'base', 'pessimistic'] },
      { id: 'simulation-ticks', label: 'Шаги симуляции', type: 'number' },
      { id: 'projected-metrics', label: 'Прогнозные метрики', type: 'object' }
    ],
    relatedPages: ['fst-fund', 'fst-portfolio', 'fst-deal']
  },

  'fst-fund': {
    id: 'fst-fund',
    title: 'Цифровой двойник фонда',
    description: 'Финансовая модель фонда: NAV, IRR, TVPI, DPI. Управление субфондами, LP-отчётность, J-curve.',
    capabilities: [
      { id: 'recalculate-nav', label: 'Пересчитать NAV', trigger: 'button[data-action="recalculate-nav"]' },
      { id: 'generate-lp-report', label: 'Отчёт для LP', trigger: 'button[data-action="generate-lp-report"]' }
    ],
    dataFields: [
      { id: 'nav', label: 'NAV фонда', type: 'number' },
      { id: 'irr', label: 'IRR', type: 'number' },
      { id: 'tvpi', label: 'TVPI', type: 'number' },
      { id: 'dpi', label: 'DPI', type: 'number' },
      { id: 'sub-funds', label: 'Субфонды', type: 'array' }
    ],
    relatedPages: ['fst-twin', 'fst-lp', 'fst-ilpa']
  },

  'fst-sourcing': {
    id: 'fst-sourcing',
    title: 'AI Deal Sourcing',
    description: 'Автоматический мониторинг открытых источников для поиска перспективных стартапов в секторах БАС/РОБО/МЭ. Telegram, HH.ru, ЕГРЮЛ, ФИПС, Сколково, GitHub.',
    capabilities: [
      { id: 'refresh-feed', label: 'Обновить ленту', trigger: 'button[data-action="refresh-feed"]' },
      { id: 'add-to-funnel', label: 'Добавить в воронку', trigger: 'button[data-action="add-to-funnel"]', params: ['companyId'], agentHint: 'Создаёт заявку в /fst-dealflow' },
      { id: 'filter-source', label: 'Фильтр источника', trigger: 'select[data-action="filter-source"]', params: ['source'] }
    ],
    dataFields: [
      { id: 'candidates', label: 'Кандидаты', type: 'array' },
      { id: 'ai-score', label: 'AI-скоринг', type: 'number', range: [0, 100] },
      { id: 'source', label: 'Источник', type: 'enum', values: ['telegram', 'hh', 'egrul', 'fips', 'skolkovo', 'github'] }
    ],
    relatedPages: ['fst-dealflow', 'fst-apply']
  },

  'fst-apply': {
    id: 'fst-apply',
    title: 'Подача заявки в ФСТ НТИ',
    description: 'Публичная форма подачи инвестиционной заявки в фонд. Стартапы заполняют анкету, которая попадает в воронку.',
    capabilities: [
      { id: 'submit-application', label: 'Подать заявку', trigger: 'button[data-action="submit-application"]', params: ['companyName', 'sector', 'stage', 'amount'] }
    ],
    dataFields: [
      { id: 'company-name', label: 'Название компании', type: 'string' },
      { id: 'sector', label: 'Сектор', type: 'string' },
      { id: 'stage', label: 'Стадия', type: 'enum', values: ['pre-seed', 'seed', 'series-a', 'series-b'] },
      { id: 'requested-amount', label: 'Запрашиваемая сумма', type: 'number' },
      { id: 'description', label: 'Описание проекта', type: 'string' }
    ],
    relatedPages: ['fst-dealflow', 'fst-sourcing']
  },

  'fst-intelligence': {
    id: 'fst-intelligence',
    title: 'Portfolio Intelligence',
    description: 'AI-аналитика портфеля: тренды, сравнение с бенчмарками, предиктивный анализ рисков, рекомендации.',
    capabilities: [
      { id: 'generate-insight', label: 'Сгенерировать инсайт', trigger: 'button[data-action="generate-insight"]', params: ['topic'] },
      { id: 'compare-benchmark', label: 'Сравнить с бенчмарком', trigger: 'button[data-action="compare-benchmark"]', params: ['metric'] }
    ],
    dataFields: [
      { id: 'insights', label: 'Инсайты', type: 'array' },
      { id: 'risk-predictions', label: 'Прогнозы рисков', type: 'array' },
      { id: 'benchmark-data', label: 'Бенчмарк данные', type: 'object' }
    ],
    relatedPages: ['fst-portfolio', 'fst-benchmark', 'fst-esg']
  },

  'fst-founders': {
    id: 'fst-founders',
    title: 'Founders CRM & Mentors',
    description: 'CRM для управления отношениями с основателями портфельных компаний и база менторов фонда. AI-подбор ментора при рисках.',
    capabilities: [
      { id: 'add-founder', label: 'Добавить основателя', trigger: 'button[data-action="add-founder"]' },
      { id: 'match-mentor', label: 'Подобрать ментора', trigger: 'button[data-action="match-mentor"]', params: ['founderId'], agentHint: 'AI подбирает ментора по компетенциям и доступности' },
      { id: 'log-interaction', label: 'Записать взаимодействие', trigger: 'button[data-action="log-interaction"]', params: ['founderId', 'type', 'note'] }
    ],
    dataFields: [
      { id: 'founders', label: 'Основатели', type: 'array' },
      { id: 'mentors', label: 'Менторы', type: 'array' },
      { id: 'interactions', label: 'История взаимодействий', type: 'array' }
    ],
    relatedPages: ['fst-execution', 'fst-portfolio']
  },

  'fst-board': {
    id: 'fst-board',
    title: 'Совет директоров',
    description: 'Управление советами директоров портфельных компаний: расписание заседаний, повестка, Board Pack, права наблюдателя.',
    capabilities: [
      { id: 'schedule-meeting', label: 'Запланировать заседание', trigger: 'button[data-action="schedule-meeting"]', params: ['companyId', 'date'] },
      { id: 'generate-board-pack', label: 'Сгенерировать Board Pack', trigger: 'button[data-action="generate-board-pack"]', params: ['companyId'], agentHint: 'AI автогенерирует материалы из данных платформы' },
      { id: 'record-vote', label: 'Записать голосование', trigger: 'button[data-action="record-vote"]', params: ['meetingId', 'question', 'decision'] }
    ],
    dataFields: [
      { id: 'meetings', label: 'Заседания', type: 'array' },
      { id: 'board-materials', label: 'Материалы совета', type: 'array' },
      { id: 'votes', label: 'Голосования', type: 'array' }
    ],
    relatedPages: ['fst-execution', 'fst-deal']
  },

  'fst-transparency': {
    id: 'fst-transparency',
    title: 'Публичная витрина фонда',
    description: 'Публичная страница фонда: портфель, метрики, отчёты для LP и внешних стейкхолдеров. Прозрачность инвестиционной деятельности.',
    capabilities: [
      { id: 'view-portfolio', label: 'Просмотр портфеля', trigger: 'button[data-action="view-portfolio"]' }
    ],
    dataFields: [
      { id: 'public-portfolio', label: 'Публичный портфель', type: 'array' },
      { id: 'fund-metrics', label: 'Метрики фонда', type: 'object' }
    ],
    relatedPages: ['fst-lp', 'fst-ilpa']
  },

  'fst-administration': {
    id: 'fst-administration',
    title: 'Бэк-офис фонда',
    description: 'Административное управление фондом: юридические документы, платёжный календарь, управление командой, комплаенс.',
    capabilities: [
      { id: 'generate-doc', label: 'Сгенерировать документ', trigger: 'button[data-action="generate-doc"]', params: ['docType'] },
      { id: 'add-team-member', label: 'Добавить члена команды', trigger: 'button[data-action="add-team-member"]' }
    ],
    dataFields: [
      { id: 'documents', label: 'Документы', type: 'array' },
      { id: 'team', label: 'Команда фонда', type: 'array' },
      { id: 'payment-schedule', label: 'Платёжный календарь', type: 'array' }
    ],
    relatedPages: ['fst-legal', 'fst-compliance']
  },

  'fst-lp': {
    id: 'fst-lp',
    title: 'LP Dashboard',
    description: 'Личный кабинет LP (ограниченного партнёра): портфель, доходность, отчёты, графики J-curve.',
    capabilities: [
      { id: 'download-report', label: 'Скачать отчёт', trigger: 'button[data-action="download-report"]', params: ['period'] },
      { id: 'request-distribution', label: 'Запросить выплату', trigger: 'button[data-action="request-distribution"]' }
    ],
    dataFields: [
      { id: 'lp-stake', label: 'Доля LP', type: 'number' },
      { id: 'invested-amount', label: 'Инвестированная сумма', type: 'number' },
      { id: 'current-value', label: 'Текущая стоимость', type: 'number' },
      { id: 'distributions', label: 'Выплаты', type: 'array' }
    ],
    relatedPages: ['fst-fund', 'fst-transparency']
  },

  'fst-captable': {
    id: 'fst-captable',
    title: 'Cap Table',
    description: 'Таблица капитализации: акционеры, доли, опционные пулы, конвертации, dilution-анализ.',
    capabilities: [
      { id: 'add-shareholder', label: 'Добавить акционера', trigger: 'button[data-action="add-shareholder"]', params: ['name', 'shares', 'type'] },
      { id: 'simulate-round', label: 'Симулировать раунд', trigger: 'button[data-action="simulate-round"]', params: ['preMoneyVal', 'investAmount'] }
    ],
    dataFields: [
      { id: 'shareholders', label: 'Акционеры', type: 'array' },
      { id: 'total-shares', label: 'Всего акций', type: 'number' },
      { id: 'option-pool', label: 'Опционный пул', type: 'number' }
    ],
    relatedPages: ['fst-deal', 'fst-waterfall', 'fst-syndication']
  },

  'fst-waterfall': {
    id: 'fst-waterfall',
    title: 'Waterfall Калькулятор',
    description: 'Расчёт распределения выручки при выходе: hurdle rate, carried interest, распределение между LP/GP.',
    capabilities: [
      { id: 'calculate-waterfall', label: 'Рассчитать waterfall', trigger: 'button[data-action="calculate-waterfall"]', params: ['exitAmount', 'hurdleRate', 'carry'] }
    ],
    dataFields: [
      { id: 'exit-amount', label: 'Сумма выхода', type: 'number' },
      { id: 'hurdle-rate', label: 'Hurdle rate', type: 'number' },
      { id: 'carry', label: 'Carried interest', type: 'number' },
      { id: 'distributions', label: 'Распределение', type: 'object' }
    ],
    relatedPages: ['fst-captable', 'fst-exit']
  },

  'fst-exit': {
    id: 'fst-exit',
    title: 'Сценарии выхода',
    description: 'Планирование и симуляция стратегий выхода из портфельных компаний: M&A, IPO, вторичные продажи.',
    capabilities: [
      { id: 'model-exit', label: 'Смоделировать выход', trigger: 'button[data-action="model-exit"]', params: ['companyId', 'strategy', 'valuation'] },
      { id: 'compare-scenarios', label: 'Сравнить сценарии', trigger: 'button[data-action="compare-scenarios"]' }
    ],
    dataFields: [
      { id: 'exit-scenarios', label: 'Сценарии выхода', type: 'array' },
      { id: 'strategy', label: 'Стратегия', type: 'enum', values: ['ma', 'ipo', 'secondary', 'buyback'] },
      { id: 'target-valuation', label: 'Целевая оценка', type: 'number' }
    ],
    relatedPages: ['fst-portfolio', 'fst-waterfall', 'fst-secondary']
  },

  'fst-secondary': {
    id: 'fst-secondary',
    title: 'Secondary Market',
    description: 'Вторичный рынок: продажа долей LP на вторичном рынке, оценка вторичных транзакций.',
    capabilities: [
      { id: 'list-stake', label: 'Выставить долю', trigger: 'button[data-action="list-stake"]', params: ['companyId', 'stakePercent', 'askPrice'] },
      { id: 'make-offer', label: 'Сделать предложение', trigger: 'button[data-action="make-offer"]', params: ['listingId', 'offerPrice'] }
    ],
    dataFields: [
      { id: 'listings', label: 'Листинги', type: 'array' },
      { id: 'offers', label: 'Предложения', type: 'array' }
    ],
    relatedPages: ['fst-captable', 'fst-exit']
  },

  'fst-syndication': {
    id: 'fst-syndication',
    title: 'Со-инвестирование',
    description: 'База со-инвесторов и управление синдицированными сделками. Граф сети партнёров, тепловая карта активности.',
    capabilities: [
      { id: 'invite-coinvestor', label: 'Пригласить со-инвестора', trigger: 'button[data-action="invite-coinvestor"]', params: ['investorId', 'dealId', 'stake'] },
      { id: 'view-network', label: 'Граф сети', trigger: 'button[data-action="view-network"]' }
    ],
    dataFields: [
      { id: 'co-investors', label: 'Со-инвесторы', type: 'array' },
      { id: 'syndications', label: 'Синдикации', type: 'array' }
    ],
    relatedPages: ['fst-deal', 'fst-captable']
  },

  'fst-duediligence': {
    id: 'fst-duediligence',
    title: 'AI Due Diligence',
    description: 'Автоматизированный анализ due diligence: финансовый, юридический, технологический, ESG. AI генерирует отчёт DD.',
    capabilities: [
      { id: 'run-dd', label: 'Запустить DD', trigger: 'button[data-action="run-due-diligence"]', params: ['companyId', 'ddType'], agentHint: 'AI анализирует все доступные данные о компании' },
      { id: 'export-dd-report', label: 'Экспорт отчёта DD', trigger: 'button[data-action="export-dd-report"]', params: ['companyId'] }
    ],
    dataFields: [
      { id: 'dd-reports', label: 'Отчёты DD', type: 'array' },
      { id: 'dd-type', label: 'Тип DD', type: 'enum', values: ['financial', 'legal', 'tech', 'esg', 'full'] },
      { id: 'risk-flags', label: 'Флаги рисков', type: 'array' }
    ],
    relatedPages: ['fst-committee', 'fst-dealflow', 'fst-legal']
  },

  'fst-legal': {
    id: 'fst-legal',
    title: 'Юридические документы',
    description: 'Генерация и хранение юридических документов: инвестиционные соглашения, SHA, SPA, NDA, Term Sheet.',
    capabilities: [
      { id: 'generate-doc', label: 'Сгенерировать документ', trigger: 'button[data-action="generate-doc"]', params: ['docType', 'companyId'] },
      { id: 'sign-doc', label: 'Подписать документ', trigger: 'button[data-action="sign-doc"]', params: ['docId'] }
    ],
    dataFields: [
      { id: 'documents', label: 'Документы', type: 'array' },
      { id: 'doc-type', label: 'Тип документа', type: 'enum', values: ['sha', 'spa', 'nda', 'termsheet', 'loan', 'convertible'] },
      { id: 'status', label: 'Статус', type: 'enum', values: ['draft', 'pending-sign', 'signed', 'archived'] }
    ],
    relatedPages: ['fst-deal', 'fst-administration', 'fst-compliance']
  },

  'fst-compliance': {
    id: 'fst-compliance',
    title: 'AML/KYC Комплаенс',
    description: 'Проверка контрагентов: AML/KYC скрининг, санкционные списки, комплаенс-отчёты. Автоматическая проверка по открытым реестрам.',
    capabilities: [
      { id: 'run-aml-check', label: 'Запустить AML-проверку', trigger: 'button[data-action="run-aml-check"]', params: ['entityId', 'entityType'] },
      { id: 'generate-compliance-report', label: 'Отчёт комплаенс', trigger: 'button[data-action="generate-compliance-report"]' }
    ],
    dataFields: [
      { id: 'aml-results', label: 'Результаты AML', type: 'array' },
      { id: 'risk-level', label: 'Уровень риска', type: 'enum', values: ['low', 'medium', 'high', 'critical'] }
    ],
    relatedPages: ['fst-legal', 'fst-administration']
  },

  'fst-esg': {
    id: 'fst-esg',
    title: 'ESG-скоринг портфеля',
    description: 'Оценка ESG-показателей портфельных компаний: экологические (E), социальные (S), управленческие (G) метрики.',
    capabilities: [
      { id: 'run-esg-audit', label: 'ESG-аудит', trigger: 'button[data-action="run-esg-audit"]', params: ['companyId'] },
      { id: 'generate-esg-report', label: 'Отчёт ESG', trigger: 'button[data-action="generate-esg-report"]', params: ['companyId'] }
    ],
    dataFields: [
      { id: 'esg-scores', label: 'ESG-оценки', type: 'array' },
      { id: 'e-score', label: 'Экологический балл', type: 'number', range: [0, 100] },
      { id: 's-score', label: 'Социальный балл', type: 'number', range: [0, 100] },
      { id: 'g-score', label: 'Управленческий балл', type: 'number', range: [0, 100] }
    ],
    relatedPages: ['fst-portfolio', 'fst-intelligence']
  },

  'fst-gov': {
    id: 'fst-gov',
    title: 'GR-Панель',
    description: 'Government Relations: отслеживание нормативной базы, взаимодействие с госорганами, трекер субсидий и грантов.',
    capabilities: [
      { id: 'track-regulation', label: 'Отслеживать НПА', trigger: 'button[data-action="track-regulation"]', params: ['topic'] }
    ],
    dataFields: [
      { id: 'regulations', label: 'НПА', type: 'array' },
      { id: 'gr-contacts', label: 'Контакты ГР', type: 'array' }
    ],
    relatedPages: ['fst-grants', 'fst-natproject']
  },

  'fst-grants': {
    id: 'fst-grants',
    title: 'Трекер грантов',
    description: 'Мониторинг и трекинг грантов для портфельных компаний: Сколково, Фонд Бортника, ФРП, нацпроекты.',
    capabilities: [
      { id: 'apply-grant', label: 'Подать на грант', trigger: 'button[data-action="apply-grant"]', params: ['grantId', 'companyId'] },
      { id: 'track-grant', label: 'Отследить статус', trigger: 'button[data-action="track-grant"]', params: ['applicationId'] }
    ],
    dataFields: [
      { id: 'grants', label: 'Гранты', type: 'array' },
      { id: 'applications', label: 'Заявки', type: 'array' },
      { id: 'grant-status', label: 'Статус', type: 'enum', values: ['open', 'applied', 'approved', 'rejected', 'closed'] }
    ],
    relatedPages: ['fst-gov', 'fst-natproject']
  },

  'fst-natproject': {
    id: 'fst-natproject',
    title: 'Нацпроект БАС 2024–2030',
    description: 'Трекер исполнения Национального проекта по беспилотным авиационным системам. KPI, milestone, бюджет.',
    capabilities: [
      { id: 'update-milestone', label: 'Обновить milestone', trigger: 'button[data-action="update-milestone"]', params: ['milestoneId', 'progress'] }
    ],
    dataFields: [
      { id: 'milestones', label: 'Milestones нацпроекта', type: 'array' },
      { id: 'budget-spent', label: 'Исполнение бюджета', type: 'number' }
    ],
    relatedPages: ['fst-gov', 'fst-grants']
  },

  'fst-ilpa': {
    id: 'fst-ilpa',
    title: 'ILPA Отчётность',
    description: 'Формирование отчётности по стандартам ILPA (Institutional Limited Partners Association): Capital Account Statements, Fee & Expense Reports.',
    capabilities: [
      { id: 'generate-ilpa-report', label: 'Сгенерировать ILPA-отчёт', trigger: 'button[data-action="generate-ilpa-report"]', params: ['period', 'reportType'] }
    ],
    dataFields: [
      { id: 'ilpa-reports', label: 'ILPA отчёты', type: 'array' },
      { id: 'report-type', label: 'Тип отчёта', type: 'enum', values: ['capital-account', 'fee-expense', 'portfolio-company'] }
    ],
    relatedPages: ['fst-lp', 'fst-fund']
  },

  'fst-benchmark': {
    id: 'fst-benchmark',
    title: 'Бенчмаркинг портфеля',
    description: 'Сравнение портфельных компаний с рыночными бенчмарками: отраслевые мультипликаторы, сравнение с аналогами.',
    capabilities: [
      { id: 'compare-company', label: 'Сравнить компанию', trigger: 'button[data-action="compare-company"]', params: ['companyId', 'benchmarkType'] }
    ],
    dataFields: [
      { id: 'benchmark-metrics', label: 'Бенчмарк метрики', type: 'object' },
      { id: 'peer-companies', label: 'Аналоги', type: 'array' }
    ],
    relatedPages: ['fst-portfolio', 'fst-intelligence']
  },

  'fst-allocation': {
    id: 'fst-allocation',
    title: 'Оптимизация аллокации',
    description: 'AI-оптимизация распределения капитала фонда: портфельная теория, risk-return, рекомендации по аллокации.',
    capabilities: [
      { id: 'optimize-allocation', label: 'Оптимизировать', trigger: 'button[data-action="optimize-allocation"]', params: ['constraints'] }
    ],
    dataFields: [
      { id: 'allocation-plan', label: 'План аллокации', type: 'object' },
      { id: 'risk-budget', label: 'Бюджет риска', type: 'number' }
    ],
    relatedPages: ['fst-fund', 'fst-portfolio']
  },

  'fst-memo': {
    id: 'fst-memo',
    title: 'AI Инвест-меморандум',
    description: 'Автогенерация инвестиционного меморандума (IM) по компании с помощью AI. Структурированный документ для ИК.',
    capabilities: [
      { id: 'generate-memo', label: 'Сгенерировать IM', trigger: 'button[data-action="generate-memo"]', params: ['companyId'], agentHint: 'AI создаёт полный инвест-меморандум по шаблону ФСТ' },
      { id: 'export-memo', label: 'Экспорт IM', trigger: 'button[data-action="export-memo"]', params: ['companyId', 'format'] }
    ],
    dataFields: [
      { id: 'memo-content', label: 'Содержание IM', type: 'object' },
      { id: 'sections', label: 'Разделы', type: 'array' }
    ],
    relatedPages: ['fst-committee', 'fst-duediligence', 'fst-deal']
  },

  'fst-sovereignty': {
    id: 'fst-sovereignty',
    title: 'Аудит суверенности 9D',
    description: 'Аудит технологической суверенности компаний по 9 измерениям: компоненты, ПО, данные, кадры и др.',
    capabilities: [
      { id: 'run-audit', label: 'Запустить аудит', trigger: 'button[data-action="run-sovereignty-audit"]', params: ['companyId'] }
    ],
    dataFields: [
      { id: 'sovereignty-score', label: 'Балл суверенности', type: 'number', range: [0, 100] },
      { id: 'dimensions', label: 'Измерения', type: 'array' }
    ],
    relatedPages: ['fst-portfolio', 'fst-intelligence']
  },

  'fst-registry': {
    id: 'fst-registry',
    title: 'Реестр производителей БПЛА',
    description: 'Реестр российских производителей беспилотных авиационных систем: характеристики, сертификаты, продукция.',
    capabilities: [
      { id: 'search-manufacturer', label: 'Поиск производителя', trigger: 'input[data-action="search-manufacturer"]', params: ['query'] }
    ],
    dataFields: [
      { id: 'manufacturers', label: 'Производители', type: 'array' },
      { id: 'product-category', label: 'Категория продукции', type: 'string' }
    ],
    relatedPages: ['fst-sourcing', 'fst-intelligence']
  },

  'fst-glossary': {
    id: 'fst-glossary',
    title: 'Глоссарий венчурных терминов',
    description: 'Справочник терминов: венчурное инвестирование, финансовые метрики, юридические понятия, авиационная отрасль.',
    capabilities: [
      { id: 'search-term', label: 'Поиск термина', trigger: 'input[data-action="search-term"]', params: ['query'] }
    ],
    dataFields: [
      { id: 'terms', label: 'Термины', type: 'array' },
      { id: 'category', label: 'Категория', type: 'string' }
    ],
    relatedPages: ['fst-school', 'fst-dev-guide']
  },

  'fst-school': {
    id: 'fst-school',
    title: 'Школа агентов ИК',
    description: 'Обучение AI-агентов инвестиционного комитета: промпты, сценарии, калибровка ролей. Тренировка на кейсах.',
    capabilities: [
      { id: 'train-agent', label: 'Тренировать агента', trigger: 'button[data-action="train-agent"]', params: ['agentRole', 'caseId'] },
      { id: 'run-scenario', label: 'Запустить сценарий', trigger: 'button[data-action="run-scenario"]', params: ['scenarioId'] }
    ],
    dataFields: [
      { id: 'agent-roles', label: 'Роли агентов', type: 'array' },
      { id: 'training-cases', label: 'Обучающие кейсы', type: 'array' }
    ],
    relatedPages: ['fst-committee', 'fst-learning']
  },

  'fst-learning': {
    id: 'fst-learning',
    title: 'Нейрокогнитивное ядро',
    description: 'База знаний платформы: онтология БПЛА (~1140 концептов), документы, прецеденты. KAG (Knowledge-Augmented Generation).',
    capabilities: [
      { id: 'search-knowledge', label: 'Поиск в базе знаний', trigger: 'input[data-action="search-knowledge"]', params: ['query'] },
      { id: 'add-document', label: 'Добавить документ', trigger: 'button[data-action="add-document"]' }
    ],
    dataFields: [
      { id: 'concepts', label: 'Концепты онтологии', type: 'array' },
      { id: 'documents', label: 'Документы', type: 'array' }
    ],
    relatedPages: ['fst-school', 'fst-intelligence']
  },

  'fst-dev-guide': {
    id: 'fst-dev-guide',
    title: 'Путь обучения VentureOS',
    description: 'Интерактивный путь обучения разработчиков и аналитиков фонда. Модули, квизы, практические задания.',
    capabilities: [
      { id: 'start-module', label: 'Начать модуль', trigger: 'button[data-action="start-module"]', params: ['moduleId'] }
    ],
    dataFields: [
      { id: 'modules', label: 'Модули обучения', type: 'array' },
      { id: 'progress', label: 'Прогресс', type: 'number', range: [0, 100] }
    ],
    relatedPages: ['fst-school', 'fst-glossary']
  },

  'fst-terminal': {
    id: 'fst-terminal',
    title: 'Claude Code CLI',
    description: 'Веб-терминал с доступом к Claude Code (WebSocket TTY). Прямое управление платформой через AI-агента.',
    capabilities: [
      { id: 'run-command', label: 'Выполнить команду', trigger: 'input[data-action="terminal-input"]', params: ['command'], agentHint: 'Прямой CLI-доступ к Claude Code агенту' }
    ],
    dataFields: [
      { id: 'session-output', label: 'Вывод сессии', type: 'string' }
    ],
    relatedPages: ['fst-school', 'fst-dev-guide']
  },

  'fst-network': {
    id: 'fst-network',
    title: 'Сеть контактов',
    description: 'CRM контактов экосистемы: инвесторы, эксперты, корпорации, госорганы. Граф связей.',
    capabilities: [
      { id: 'add-contact', label: 'Добавить контакт', trigger: 'button[data-action="add-contact"]' },
      { id: 'view-graph', label: 'Граф связей', trigger: 'button[data-action="view-graph"]' }
    ],
    dataFields: [
      { id: 'contacts', label: 'Контакты', type: 'array' },
      { id: 'contact-type', label: 'Тип контакта', type: 'enum', values: ['investor', 'expert', 'corporate', 'government', 'startup'] }
    ],
    relatedPages: ['fst-founders', 'fst-syndication']
  }
}

/**
 * Get all page manifests as flat array
 */
export function getAllPageManifests() {
  return Object.values(pageManifests)
}

/**
 * Get manifest for a specific page
 * @param {string} pageId - page route id (e.g. 'fst-committee')
 */
export function getPageManifest(pageId) {
  return pageManifests[pageId] || null
}

/**
 * Get available actions for a specific page
 * @param {string} pageId
 */
export function getAvailableActions(pageId) {
  const manifest = pageManifests[pageId]
  return manifest?.capabilities || []
}

/**
 * Full platform manifest for /api/platform/manifest endpoint
 */
export function getPlatformManifest() {
  const pages = getAllPageManifests()

  // Aggregate all unique actions across pages
  const actions = pages.flatMap(p =>
    p.capabilities.map(c => ({ ...c, pageId: p.id, pageTitle: p.title }))
  )

  // Aggregate all data schemas
  const dataSchemas = {}
  for (const page of pages) {
    dataSchemas[page.id] = page.dataFields
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    platform: 'VentureOS / ФСТ НТИ',
    pages,
    actions,
    dataSchemas,
    workflows: [
      {
        id: 'full-deal-flow',
        title: 'Полный цикл инвестиционной сделки',
        description: 'От подачи заявки до закрытия сделки и мониторинга',
        steps: ['fst-apply', 'fst-dealflow', 'fst-duediligence', 'fst-memo', 'fst-committee', 'fst-deal', 'fst-portfolio']
      },
      {
        id: 'sourcing-to-committee',
        title: 'От сорсинга до инвесткомитета',
        description: 'Автоматизированный поиск и первичный скрининг',
        steps: ['fst-sourcing', 'fst-dealflow', 'fst-committee']
      },
      {
        id: 'deal-to-exit',
        title: 'От сделки до выхода',
        description: 'Сопровождение инвестиции: исполнение → мониторинг → выход',
        steps: ['fst-deal', 'fst-execution', 'fst-portfolio', 'fst-exit', 'fst-waterfall']
      },
      {
        id: 'lp-reporting',
        title: 'LP Отчётность',
        description: 'Полный цикл отчётности для ограниченных партнёров',
        steps: ['fst-fund', 'fst-lp', 'fst-ilpa', 'fst-transparency']
      }
    ]
  }
}
