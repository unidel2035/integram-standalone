/**
 * Demo data for sandbox mode
 * Realistic fund data for training and demonstrations
 */

export const demoCompanies = [
  {
    id: 'demo-1',
    name: 'AgroTech Solutions',
    sector: 'AgriTech',
    stage: 'Seed',
    description: 'AI-платформа для точного земледелия с использованием БПЛА',
    requestedAmount: 15000000,
    valuation: 75000000,
    traction: 'MVP запущен, 12 пилотных хозяйств, 450 га под управлением',
    team: [
      { name: 'Иванов А.С.', role: 'CEO', experience: 'Ex-Yandex, 10 лет в AgriTech' },
      { name: 'Петрова М.В.', role: 'CTO', experience: 'Ex-Google, PhD Computer Vision' }
    ],
    metrics: {
      mrr: 250000,
      growth: 35,
      customers: 12,
      churn: 5
    },
    status: 'committee_review',
    submittedAt: '2026-02-15T10:30:00Z'
  },
  {
    id: 'demo-2',
    name: 'DroneLogistics',
    sector: 'Logistics',
    stage: 'Series A',
    description: 'Автоматизированная доставка грузов до 5 кг городскими БПЛА',
    requestedAmount: 50000000,
    valuation: 350000000,
    traction: '2500 доставок/месяц, работаем в 3 городах',
    team: [
      { name: 'Сидоров П.К.', role: 'CEO', experience: 'Ex-Сбер, основатель LogiTech' },
      { name: 'Козлова Е.А.', role: 'COO', experience: 'Ex-Wildberries, 8 лет в logistics' }
    ],
    metrics: {
      mrr: 3500000,
      growth: 25,
      customers: 45,
      churn: 8
    },
    status: 'due_diligence',
    submittedAt: '2026-01-20T14:15:00Z'
  },
  {
    id: 'demo-3',
    name: 'InspectionAI',
    sector: 'Industrial',
    stage: 'Seed',
    description: 'Автоматическая инспекция инфраструктуры с помощью БПЛА и компьютерного зрения',
    requestedAmount: 20000000,
    valuation: 100000000,
    traction: 'Контракты с 2 нефтегазовыми компаниями, проверено 850 км трубопроводов',
    team: [
      { name: 'Новиков Д.В.', role: 'CEO', experience: 'Ex-Газпром, 12 лет в промышленности' },
      { name: 'Морозова А.И.', role: 'CTO', experience: 'PhD Robotics, публикации в Nature' }
    ],
    metrics: {
      mrr: 1200000,
      growth: 45,
      customers: 8,
      churn: 0
    },
    status: 'term_sheet',
    submittedAt: '2026-02-01T09:00:00Z'
  },
  {
    id: 'demo-4',
    name: 'SafetyDrone',
    sector: 'Security',
    stage: 'Pre-seed',
    description: 'Система безопасности для крупных объектов на базе патрульных БПЛА',
    requestedAmount: 8000000,
    valuation: 40000000,
    traction: 'Прототип готов, тестирование на 2 складских комплексах',
    team: [
      { name: 'Федоров И.С.', role: 'CEO', experience: 'Ex-охранное агентство, 15 лет опыта' },
      { name: 'Кузнецов В.П.', role: 'CTO', experience: 'Ex-военная авиация, инженер БПЛА' }
    ],
    metrics: {
      mrr: 0,
      growth: 0,
      customers: 2,
      churn: 0
    },
    status: 'application_review',
    submittedAt: '2026-02-28T16:45:00Z'
  },
  {
    id: 'demo-5',
    name: 'EcoMonitor',
    sector: 'Environmental',
    stage: 'Seed',
    description: 'Мониторинг экологического состояния лесов и водоемов с помощью БПЛА',
    requestedAmount: 12000000,
    valuation: 60000000,
    traction: 'Пилоты в 5 регионах, мониторинг 120 тыс. га',
    team: [
      { name: 'Лебедева О.Н.', role: 'CEO', experience: 'Ex-Минприроды, эколог' },
      { name: 'Соколов М.А.', role: 'CTO', experience: 'Ex-Skoltech, researcher' }
    ],
    metrics: {
      mrr: 450000,
      growth: 30,
      customers: 7,
      churn: 10
    },
    status: 'rejected',
    submittedAt: '2026-01-10T11:20:00Z',
    rejectionReason: 'Слабая монетизация, неясная unit-экономика'
  }
]

export const demoDeals = [
  {
    id: 'deal-1',
    companyId: 'demo-2',
    companyName: 'DroneLogistics',
    dealType: 'Series A',
    investmentAmount: 45000000,
    preMoneyValuation: 305000000,
    postMoneyValuation: 350000000,
    ownership: 12.86,
    leadInvestor: 'ФСТ НТИ',
    coInvestors: ['RVC', 'Skolkovo Ventures'],
    status: 'active',
    closedAt: '2025-08-15T00:00:00Z',
    tranches: [
      { amount: 30000000, date: '2025-08-15', status: 'disbursed', milestone: 'Закрытие раунда' },
      { amount: 15000000, date: '2026-02-15', status: 'disbursed', milestone: 'Выход в 2 новых города' }
    ],
    kpis: {
      revenue: { plan: 45000000, fact: 42000000, progress: 93 },
      customers: { plan: 60, fact: 45, progress: 75 },
      cities: { plan: 5, fact: 3, progress: 60 }
    },
    documents: {
      termSheet: true,
      spa: true,
      sha: true,
      subscription: true
    }
  },
  {
    id: 'deal-2',
    companyId: 'demo-portfolio-1',
    companyName: 'AeroVision',
    dealType: 'Seed',
    investmentAmount: 18000000,
    preMoneyValuation: 72000000,
    postMoneyValuation: 90000000,
    ownership: 20,
    leadInvestor: 'ФСТ НТИ',
    coInvestors: ['ФРИИ'],
    status: 'active',
    closedAt: '2024-11-20T00:00:00Z',
    tranches: [
      { amount: 18000000, date: '2024-11-20', status: 'disbursed', milestone: 'Закрытие раунда' }
    ],
    kpis: {
      revenue: { plan: 8400000, fact: 9200000, progress: 110 },
      customers: { plan: 25, fact: 28, progress: 112 },
      mrr: { plan: 700000, fact: 780000, progress: 111 }
    },
    currentValuation: 135000000,
    moic: 1.5,
    irr: 42,
    documents: {
      termSheet: true,
      spa: true,
      sha: true,
      subscription: true
    }
  },
  {
    id: 'deal-3',
    companyId: 'demo-portfolio-2',
    companyName: 'CargoSky',
    dealType: 'Series A',
    investmentAmount: 35000000,
    preMoneyValuation: 165000000,
    postMoneyValuation: 200000000,
    ownership: 17.5,
    leadInvestor: 'Skolkovo Ventures',
    coInvestors: ['ФСТ НТИ', 'AFK Sistema'],
    status: 'exited',
    closedAt: '2023-05-10T00:00:00Z',
    exitedAt: '2026-01-15T00:00:00Z',
    exitType: 'acquisition',
    exitValuation: 450000000,
    exitReturn: 78750000,
    moic: 2.25,
    irr: 56,
    tranches: [
      { amount: 35000000, date: '2023-05-10', status: 'disbursed', milestone: 'Закрытие раунда' }
    ],
    documents: {
      termSheet: true,
      spa: true,
      sha: true,
      subscription: true,
      exitAgreement: true
    }
  }
]

export const demoPortfolio = [
  {
    id: 'demo-portfolio-1',
    name: 'AeroVision',
    sector: 'Computer Vision',
    stage: 'Seed',
    investedAmount: 18000000,
    currentValuation: 135000000,
    ownership: 20,
    investedAt: '2024-11-20T00:00:00Z',
    status: 'green',
    moic: 1.5,
    irr: 42,
    health: {
      revenue: 'green',
      burn: 'green',
      runway: 'yellow',
      kpi: 'green'
    },
    metrics: {
      mrr: 780000,
      growth: 15,
      customers: 28,
      runway: 14
    },
    signals: [
      { type: 'positive', text: 'Перевыполнение плана по выручке на 10%', date: '2026-02-28' },
      { type: 'positive', text: 'Подписан контракт с крупным клиентом (+2М ARR)', date: '2026-02-15' }
    ]
  },
  {
    id: 'demo-portfolio-2',
    name: 'CargoSky',
    sector: 'Logistics',
    stage: 'Series A',
    investedAmount: 35000000,
    currentValuation: 450000000,
    ownership: 17.5,
    investedAt: '2023-05-10T00:00:00Z',
    exitedAt: '2026-01-15T00:00:00Z',
    status: 'exited',
    moic: 2.25,
    irr: 56,
    exitType: 'acquisition',
    acquirer: 'Ozon',
    exitReturn: 78750000
  }
]

export const demoCommitteeEvents = [
  {
    id: 'ic-1',
    companyId: 'demo-1',
    companyName: 'AgroTech Solutions',
    date: '2026-02-20T15:00:00Z',
    status: 'scheduled',
    type: 'initial_review',
    participants: [
      'Управляющий партнёр',
      'Инвестиционный директор',
      'Технический директор'
    ],
    agenda: [
      'Презентация команды',
      'Демонстрация продукта',
      'Обсуждение финансовой модели',
      'Q&A'
    ],
    agentAnalysis: {
      tech: { score: 8.5, verdict: 'approve', concerns: [] },
      market: { score: 7.8, verdict: 'approve', concerns: ['Конкуренция с JD.com'] },
      team: { score: 9.0, verdict: 'approve', concerns: [] },
      financial: { score: 7.2, verdict: 'conditional', concerns: ['Высокий burn rate'] },
      legal: { score: 8.0, verdict: 'approve', concerns: [] },
      risk: { score: 7.5, verdict: 'approve', concerns: ['Регуляторные риски БПЛА'] }
    },
    recommendation: 'approve',
    termSheetReady: false
  },
  {
    id: 'ic-2',
    companyId: 'demo-3',
    companyName: 'InspectionAI',
    date: '2026-02-10T14:00:00Z',
    status: 'completed',
    type: 'term_sheet_approval',
    decision: 'approved',
    votingResults: {
      approve: 5,
      reject: 0,
      abstain: 1
    },
    termSheet: {
      investment: 20000000,
      valuation: 100000000,
      tranches: 2,
      milestones: [
        'Контракт с 3-м крупным клиентом',
        'Выручка 30М годовых'
      ]
    }
  }
]

export const demoPracticeScenarios = [
  {
    id: 'scenario-1',
    title: 'Проведи инвесткомитет для AgroTech',
    description: 'Познакомься с заявкой стартапа AgroTech Solutions и проведи полноценное заседание инвесткомитета',
    difficulty: 'beginner',
    estimatedTime: '15-20 минут',
    steps: [
      {
        step: 1,
        title: 'Изучи заявку компании',
        instruction: 'Перейди в /fst и найди заявку AgroTech Solutions. Внимательно изучи команду, продукт и метрики.',
        checkpoints: ['Открыта карточка компании', 'Просмотрены все разделы'],
        tips: 'Обрати внимание на темпы роста MRR и опыт команды'
      },
      {
        step: 2,
        title: 'Запусти AI-анализ',
        instruction: 'Открой /fst-committee и запусти анализ 6 AI-агентов для AgroTech',
        checkpoints: ['Запущен AI-анализ', 'Получены оценки от всех агентов'],
        tips: 'Каждый агент оценивает компанию со своей стороны: технологии, рынок, команда, финансы, юридика, риски'
      },
      {
        step: 3,
        title: 'Проанализируй рекомендации',
        instruction: 'Изучи оценки агентов и их concerns. Обрати внимание на красные флаги.',
        checkpoints: ['Прочитаны все вердикты', 'Выявлены ключевые риски'],
        tips: 'Агент "Риски" предупреждает о регуляторных ограничениях для БПЛА'
      },
      {
        step: 4,
        title: 'Прими решение',
        instruction: 'На основе анализа прими решение: одобрить, отклонить или запросить доработки',
        checkpoints: ['Решение принято', 'Обоснование записано'],
        tips: 'Если одобряешь — переходи к следующему сценарию для оформления сделки'
      }
    ],
    learningGoals: [
      'Понимание процесса инвесткомитета',
      'Работа с AI-агентами',
      'Оценка инвестиционных рисков',
      'Принятие инвестиционных решений'
    ],
    successCriteria: 'Решение принято с полным обоснованием на основе анализа агентов'
  },
  {
    id: 'scenario-2',
    title: 'Оформи сделку с траншами',
    description: 'Создай структуру инвестиции в InspectionAI с двумя траншами и привязкой к KPI',
    difficulty: 'intermediate',
    estimatedTime: '20-25 минут',
    steps: [
      {
        step: 1,
        title: 'Открой модуль сделки',
        instruction: 'Перейди в /fst-deal и выбери InspectionAI из одобренных компаний',
        checkpoints: ['Открыт модуль сделки', 'Выбрана компания'],
        tips: 'Инвесткомитет уже одобрил эту сделку — можно сразу оформлять'
      },
      {
        step: 2,
        title: 'Заполни параметры сделки',
        instruction: 'Укажи сумму инвестиции (20М), пре-мани (100М), долю (20%)',
        checkpoints: ['Заполнены все поля', 'Рассчитана доля'],
        tips: 'Post-money = Pre-money + Investment. Доля = Investment / Post-money'
      },
      {
        step: 3,
        title: 'Настрой траншевание',
        instruction: 'Раздели инвестицию на 2 транша: 12М (сразу) и 8М (после milestone)',
        checkpoints: ['Созданы траншы', 'Указаны условия выплаты'],
        tips: 'Второй транш привяжи к milestone: "Контракт с 3-м крупным клиентом"'
      },
      {
        step: 4,
        title: 'Задай KPI для мониторинга',
        instruction: 'Добавь 3 ключевых KPI: выручка, количество клиентов, MRR',
        checkpoints: ['Добавлены KPI', 'Установлены целевые значения'],
        tips: 'KPI нужны для светофора в портфеле — будут отслеживаться автоматически'
      },
      {
        step: 5,
        title: 'Сгенерируй Term Sheet',
        instruction: 'Используй AI для генерации проекта Term Sheet на основе введённых данных',
        checkpoints: ['Term Sheet сгенерирован', 'Документ проверен'],
        tips: 'AI использует стандартный шаблон фонда, адаптируя его под сделку'
      }
    ],
    learningGoals: [
      'Структурирование инвестиции',
      'Работа с траншами',
      'Настройка KPI',
      'Генерация документов'
    ],
    successCriteria: 'Сделка оформлена с траншами, KPI и готовым Term Sheet'
  },
  {
    id: 'scenario-3',
    title: 'Создай отчёт для LP',
    description: 'Подготовь квартальный отчёт для инвесторов фонда с анализом портфеля и финансовыми метриками',
    difficulty: 'advanced',
    estimatedTime: '25-30 минут',
    steps: [
      {
        step: 1,
        title: 'Проанализируй портфель',
        instruction: 'Открой /fst-portfolio и изучи состояние всех активных инвестиций',
        checkpoints: ['Проверен статус компаний', 'Выявлены проблемные активы'],
        tips: 'Обрати внимание на светофоры — красный и жёлтый требуют комментариев в отчёте'
      },
      {
        step: 2,
        title: 'Собери финансовые метрики',
        instruction: 'Рассчитай совокупный IRR, MOIC, TVPI для всего портфеля',
        checkpoints: ['Метрики рассчитаны', 'Динамика проанализирована'],
        tips: 'Используй данные из сделок и текущих оценок компаний'
      },
      {
        step: 3,
        title: 'Запроси AI-аналитику',
        instruction: 'Используй AI-агента "Портфельный аналитик" для генерации инсайтов',
        checkpoints: ['AI-анализ получен', 'Ключевые тренды выявлены'],
        tips: 'Агент автоматически найдёт позитивные и негативные сигналы по портфелю'
      },
      {
        step: 4,
        title: 'Оформи отчёт',
        instruction: 'Создай структурированный LP Report с разделами: Executive Summary, Portfolio Overview, Financial Performance, Key Events',
        checkpoints: ['Отчёт составлен', 'Все разделы заполнены'],
        tips: 'Используй шаблон ILPA для соответствия стандартам индустрии'
      },
      {
        step: 5,
        title: 'Добавь визуализацию',
        instruction: 'Включи в отчёт графики: распределение портфеля, динамика NAV, водопад доходности',
        checkpoints: ['Графики добавлены', 'Данные визуализированы'],
        tips: 'AI может сгенерировать готовые Chart.js конфигурации для отчёта'
      }
    ],
    learningGoals: [
      'Анализ венчурного портфеля',
      'Расчёт фондовых метрик',
      'Работа с LP-отчётностью',
      'Использование AI-аналитики'
    ],
    successCriteria: 'Полный LP Report с метриками, анализом и визуализацией готов к отправке'
  }
]

// Helper to get data based on sandbox mode
export function getDemoDataFor(entity) {
  const dataMap = {
    companies: demoCompanies,
    deals: demoDeals,
    portfolio: demoPortfolio,
    committeeEvents: demoCommitteeEvents,
    scenarios: demoPracticeScenarios
  }

  return dataMap[entity] || []
}

export default {
  demoCompanies,
  demoDeals,
  demoPortfolio,
  demoCommitteeEvents,
  demoPracticeScenarios,
  getDemoDataFor
}
