/**
 * Ролевые пути обучения для VentureOS
 * Каждый путь содержит последовательность шагов для конкретной роли
 */

export const USER_ROLES = {
  LP_INVESTOR: 'LP_INVESTOR',
  FUND_ANALYST: 'FUND_ANALYST',
  GP_DIRECTOR: 'GP_DIRECTOR',
  STARTUP: 'STARTUP',
}

export const ROLE_METADATA = {
  [USER_ROLES.LP_INVESTOR]: {
    id: USER_ROLES.LP_INVESTOR,
    icon: '🏦',
    title: 'LP-инвестор',
    subtitle: 'Limited Partner',
    description: 'Вы инвестируете в венчурные фонды и хотите понять, как работает фонд изнутри, как читать отчёты и контролировать доходность.',
    color: '#3b82f6',
  },
  [USER_ROLES.FUND_ANALYST]: {
    id: USER_ROLES.FUND_ANALYST,
    icon: '📊',
    title: 'Аналитик фонда',
    subtitle: 'Fund Analyst',
    description: 'Вы работаете в венчурном фонде и занимаетесь анализом сделок, due diligence и мониторингом портфеля.',
    color: '#10b981',
  },
  [USER_ROLES.GP_DIRECTOR]: {
    id: USER_ROLES.GP_DIRECTOR,
    icon: '🎯',
    title: 'Управляющий директор',
    subtitle: 'General Partner',
    description: 'Вы управляете венчурным фондом и принимаете стратегические решения о сделках, портфеле и развитии фонда.',
    color: '#8b5cf6',
  },
  [USER_ROLES.STARTUP]: {
    id: USER_ROLES.STARTUP,
    icon: '🚀',
    title: 'Стартап',
    subtitle: 'Founder / CEO',
    description: 'Вы ищете инвестиции для своего стартапа и хотите понять, как работает процесс привлечения венчурного капитала.',
    color: '#f59e0b',
  },
}

export const LEARNING_PATHS = {
  [USER_ROLES.LP_INVESTOR]: {
    roleId: USER_ROLES.LP_INVESTOR,
    title: 'Путь LP-инвестора',
    description: 'Узнайте, как работает венчурный фонд и как контролировать свои инвестиции',
    steps: [
      {
        id: 'lp-1',
        title: 'Что такое венчурный фонд',
        description: 'Основы венчурного инвестирования, структура фонда, роли GP и LP',
        route: '/fst-hub',
        estimatedTime: '10 мин',
        type: 'overview',
      },
      {
        id: 'lp-2',
        title: 'NAV и IRR',
        description: 'Ключевые метрики доходности: Net Asset Value и Internal Rate of Return',
        route: '/fst-fund',
        estimatedTime: '15 мин',
        type: 'metrics',
      },
      {
        id: 'lp-3',
        title: 'Как читать LP-отчёт',
        description: 'Разбор структуры квартального отчёта для Limited Partners',
        route: '/fst-lp',
        estimatedTime: '20 мин',
        type: 'reporting',
      },
      {
        id: 'lp-4',
        title: 'Cap Table',
        description: 'Таблица капитализации: кто владеет долями и как распределяется стоимость',
        route: '/fst-captable',
        estimatedTime: '15 мин',
        type: 'structure',
      },
      {
        id: 'lp-5',
        title: 'Waterfall & Carried Interest',
        description: 'Механизм распределения прибыли между GP и LP',
        route: '/fst-waterfall',
        estimatedTime: '25 мин',
        type: 'economics',
      },
      {
        id: 'lp-6',
        title: 'Права LP',
        description: 'Юридические права Limited Partners и защита интересов',
        route: '/fst-legal',
        estimatedTime: '15 мин',
        type: 'legal',
      },
      {
        id: 'lp-7',
        title: 'ILPA стандарты',
        description: 'Международные стандарты отчётности и прозрачности фондов',
        route: '/fst-ilpa',
        estimatedTime: '20 мин',
        type: 'compliance',
      },
    ],
  },
  [USER_ROLES.FUND_ANALYST]: {
    roleId: USER_ROLES.FUND_ANALYST,
    title: 'Путь аналитика фонда',
    description: 'Освойте полный цикл работы с сделками — от заявки до exit',
    steps: [
      {
        id: 'analyst-1',
        title: 'Воронка заявок',
        description: 'Deal flow: откуда берутся сделки и как их фильтровать',
        route: '/fst-dealflow',
        estimatedTime: '15 мин',
        type: 'sourcing',
      },
      {
        id: 'analyst-2',
        title: 'AI Deal Sourcing',
        description: 'Автоматический поиск и скоринг потенциальных сделок',
        route: '/fst-sourcing',
        estimatedTime: '20 мин',
        type: 'ai',
      },
      {
        id: 'analyst-3',
        title: 'Due Diligence',
        description: 'Комплексная проверка стартапа перед инвестицией',
        route: '/fst-duediligence',
        estimatedTime: '30 мин',
        type: 'analysis',
      },
      {
        id: 'analyst-4',
        title: 'AI-инвесткомитет',
        description: 'Как работает коллегиальное принятие решений с помощью AI',
        route: '/fst-committee',
        estimatedTime: '25 мин',
        type: 'decision',
      },
      {
        id: 'analyst-5',
        title: 'Финансовая модель',
        description: 'Построение и анализ финмоделей для оценки перспектив стартапа',
        route: '/fst-deal',
        estimatedTime: '35 мин',
        type: 'modeling',
      },
      {
        id: 'analyst-6',
        title: 'Мониторинг портфеля',
        description: 'Трекинг метрик портфельных компаний и раннее выявление рисков',
        route: '/fst-portfolio',
        estimatedTime: '25 мин',
        type: 'monitoring',
      },
      {
        id: 'analyst-7',
        title: 'Portfolio Intelligence',
        description: 'AI-аналитика портфеля: тренды, корреляции, прогнозы',
        route: '/fst-intelligence',
        estimatedTime: '20 мин',
        type: 'analytics',
      },
    ],
  },
  [USER_ROLES.GP_DIRECTOR]: {
    roleId: USER_ROLES.GP_DIRECTOR,
    title: 'Путь управляющего директора',
    description: 'Стратегическое управление фондом от формирования до выхода',
    steps: [
      {
        id: 'gp-1',
        title: 'Обзор платформы',
        description: 'VentureOS — полный цикл управления венчурным фондом',
        route: '/fst-hub',
        estimatedTime: '15 мин',
        type: 'overview',
      },
      {
        id: 'gp-2',
        title: 'Стратегия фонда',
        description: 'Формирование инвестиционной стратегии и тезиса',
        route: '/fst-fund',
        estimatedTime: '30 мин',
        type: 'strategy',
      },
      {
        id: 'gp-3',
        title: 'Digital Twin фонда',
        description: 'Цифровой двойник для симуляции различных сценариев развития',
        route: '/fst-fund',
        estimatedTime: '25 мин',
        type: 'simulation',
      },
      {
        id: 'gp-4',
        title: 'GR-панель',
        description: 'Government Relations: взаимодействие с госструктурами и регуляторами',
        route: '/fst-gov',
        estimatedTime: '20 мин',
        type: 'government',
      },
      {
        id: 'gp-5',
        title: 'ILPA-отчётность',
        description: 'Подготовка отчётов для LP согласно международным стандартам',
        route: '/fst-ilpa',
        estimatedTime: '25 мин',
        type: 'reporting',
      },
      {
        id: 'gp-6',
        title: 'Exit-стратегии',
        description: 'Планирование и реализация выходов из инвестиций',
        route: '/fst-exit',
        estimatedTime: '30 мин',
        type: 'exit',
      },
      {
        id: 'gp-7',
        title: 'Со-инвестирование',
        description: 'Syndication: привлечение со-инвесторов и управление консорциумами',
        route: '/fst-syndication',
        estimatedTime: '25 мин',
        type: 'syndication',
      },
      {
        id: 'gp-8',
        title: 'Бэк-офис фонда',
        description: 'Административные процессы, документооборот, compliance',
        route: '/fst-administration',
        estimatedTime: '20 мин',
        type: 'operations',
      },
    ],
  },
  [USER_ROLES.STARTUP]: {
    roleId: USER_ROLES.STARTUP,
    title: 'Путь стартапа',
    description: 'Привлечение венчурного капитала: от заявки до подписания Term Sheet',
    steps: [
      {
        id: 'startup-1',
        title: 'Как подать заявку',
        description: 'Что нужно для подачи заявки в венчурный фонд',
        route: '/fst-apply',
        estimatedTime: '15 мин',
        type: 'application',
      },
      {
        id: 'startup-2',
        title: 'Что проверяет инвесткомитет',
        description: 'Критерии оценки и процесс принятия решения о финансировании',
        route: '/fst-committee',
        estimatedTime: '20 мин',
        type: 'evaluation',
      },
      {
        id: 'startup-3',
        title: 'Due Diligence',
        description: 'К чему готовиться: юридическая, финансовая и техническая проверка',
        route: '/fst-duediligence',
        estimatedTime: '25 мин',
        type: 'diligence',
      },
      {
        id: 'startup-4',
        title: 'Term Sheet',
        description: 'Основные условия инвестиции: оценка, доля, права сторон',
        route: '/fst-deal',
        estimatedTime: '30 мин',
        type: 'terms',
      },
      {
        id: 'startup-5',
        title: 'SPV и Cap Table',
        description: 'Структура сделки: Special Purpose Vehicle и таблица капитализации',
        route: '/fst-captable',
        estimatedTime: '25 мин',
        type: 'structure',
      },
      {
        id: 'startup-6',
        title: 'Работа с фондом после инвестиции',
        description: 'Отчётность, мониторинг показателей, поддержка от фонда',
        route: '/fst-portfolio',
        estimatedTime: '20 мин',
        type: 'collaboration',
      },
    ],
  },
}

/**
 * Утилиты для работы с localStorage
 */
export const STORAGE_KEYS = {
  USER_ROLE: 'ventureOS_userRole',
  COMPLETED_STEPS: 'ventureOS_completedSteps',
  ROLE_SELECTED: 'ventureOS_roleSelected',
}

export function getUserRole() {
  return localStorage.getItem(STORAGE_KEYS.USER_ROLE) || null
}

export function setUserRole(roleId) {
  localStorage.setItem(STORAGE_KEYS.USER_ROLE, roleId)
  localStorage.setItem(STORAGE_KEYS.ROLE_SELECTED, 'true')
}

export function isRoleSelected() {
  return localStorage.getItem(STORAGE_KEYS.ROLE_SELECTED) === 'true'
}

export function getCompletedSteps() {
  const stored = localStorage.getItem(STORAGE_KEYS.COMPLETED_STEPS)
  return stored ? JSON.parse(stored) : []
}

export function markStepCompleted(stepId) {
  const completed = getCompletedSteps()
  if (!completed.includes(stepId)) {
    completed.push(stepId)
    localStorage.setItem(STORAGE_KEYS.COMPLETED_STEPS, JSON.stringify(completed))
  }
}

export function getLearningProgress(roleId) {
  const path = LEARNING_PATHS[roleId]
  if (!path) return { total: 0, completed: 0, percentage: 0 }

  const completedSteps = getCompletedSteps()
  const total = path.steps.length
  const completed = path.steps.filter(step => completedSteps.includes(step.id)).length
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  return { total, completed, percentage }
}

export function resetUserProgress() {
  localStorage.removeItem(STORAGE_KEYS.USER_ROLE)
  localStorage.removeItem(STORAGE_KEYS.COMPLETED_STEPS)
  localStorage.removeItem(STORAGE_KEYS.ROLE_SELECTED)
}
