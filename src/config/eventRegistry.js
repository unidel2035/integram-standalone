/**
 * Event Registry — единый каталог всех типов событий платформы VentureOS
 *
 * Каждый модуль регистрирует свои типы здесь.
 * Событие = единица изменения состояния любой сущности.
 *
 * Сущности (entityType):
 *   project   — проект/стартап (GR, TRL, финансирование)
 *   company   — портфельная компания (KPI, раунды, контракты)
 *   deal      — сделка (Term Sheet → Closing → Транши)
 *   session   — сессия инвесткомитета (аргументы, голоса, решение)
 *   fund      — фонд (NAV, новый LP, Drawdown)
 */

import { GR_EVENT_TYPES } from './grEventTypes.js'
import { SOFT_EVENT_TYPES } from './softEventTypes.js'

// ─── Portfolio / Company events ───────────────────────────────────────────────

export const PORTFOLIO_EVENT_TYPES = {
  COMPANY_ADDED: {
    id: 'COMPANY_ADDED', label: 'Компания добавлена в портфель',
    icon: 'pi pi-plus-circle', color: '#22c55e',
    subject: 'Фонд', object: 'Компания',
    entityType: 'company', phase: 'init',
  },
  KPI_UPDATED: {
    id: 'KPI_UPDATED', label: 'KPI обновлён',
    icon: 'pi pi-chart-bar', color: '#3b82f6',
    subject: 'Команда / Портал', object: 'KPI',
    entityType: 'company', phase: 'monitor',
  },
  REVENUE_MILESTONE: {
    id: 'REVENUE_MILESTONE', label: 'Выручка: milestone',
    icon: 'pi pi-dollar', color: '#10b981',
    subject: 'Компания', object: 'Выручка',
    entityType: 'company', phase: 'milestone',
    enables: ['NEXT_TRANCHE_RELEASED'],
  },
  PRODUCT_LAUNCH: {
    id: 'PRODUCT_LAUNCH', label: 'Продукт запущен',
    icon: 'pi pi-rocket', color: '#f97316',
    subject: 'Команда', object: 'Продукт',
    entityType: 'company', phase: 'milestone',
  },
  TEAM_CHANGE: {
    id: 'TEAM_CHANGE', label: 'Изменение команды',
    icon: 'pi pi-users', color: '#8b5cf6',
    subject: 'Компания', object: 'Команда',
    entityType: 'company', phase: 'monitor',
  },
  RISK_ELEVATED: {
    id: 'RISK_ELEVATED', label: 'Риск повышен',
    icon: 'pi pi-exclamation-triangle', color: '#ef4444',
    subject: 'Мониторинг', object: 'Риск-профиль',
    entityType: 'company', phase: 'alert',
  },
  ROUND_OPENED: {
    id: 'ROUND_OPENED', label: 'Открыт новый раунд',
    icon: 'pi pi-money-bill', color: '#6366f1',
    subject: 'Компания', object: 'Инвесторы',
    entityType: 'company', phase: 'growth',
  },
  EXIT_EVENT: {
    id: 'EXIT_EVENT', label: 'Выход (Exit)',
    icon: 'pi pi-sign-out', color: '#0ea5e9',
    subject: 'Фонд + Покупатель', object: 'Доля',
    entityType: 'company', phase: 'exit',
  },
}

// ─── Deal events ──────────────────────────────────────────────────────────────

export const DEAL_EVENT_TYPES = {
  DEAL_SOURCED: {
    id: 'DEAL_SOURCED', label: 'Сделка в воронке',
    icon: 'pi pi-filter', color: '#64748b',
    subject: 'Sourcing-агент', object: 'Стартап',
    entityType: 'deal', phase: 'source',
  },
  TERM_SHEET_PROPOSED: {
    id: 'TERM_SHEET_PROPOSED', label: 'Term Sheet предложен',
    icon: 'pi pi-file', color: '#f59e0b',
    subject: 'Фонд', object: 'Стартап',
    entityType: 'deal', phase: 'negotiate',
    enables: ['TERM_SHEET_SIGNED', 'TERM_SHEET_REJECTED'],
  },
  TERM_SHEET_SIGNED: {
    id: 'TERM_SHEET_SIGNED', label: 'Term Sheet подписан',
    icon: 'pi pi-file-edit', color: '#22c55e',
    subject: 'Фонд + Стартап', object: 'Term Sheet',
    entityType: 'deal', phase: 'negotiate',
    enables: ['DUE_DILIGENCE_STARTED'],
  },
  TERM_SHEET_REJECTED: {
    id: 'TERM_SHEET_REJECTED', label: 'Term Sheet отклонён',
    icon: 'pi pi-times', color: '#ef4444',
    subject: 'Стартап', object: 'Term Sheet',
    entityType: 'deal', phase: 'negotiate',
    enables: ['TERM_SHEET_PROPOSED'],
  },
  DUE_DILIGENCE_STARTED: {
    id: 'DUE_DILIGENCE_STARTED', label: 'Due Diligence начат',
    icon: 'pi pi-search', color: '#3b82f6',
    subject: 'Фонд (юрист, аналитик)', object: 'Компания',
    entityType: 'deal', phase: 'dd',
    enables: ['DD_COMPLETED', 'DD_FAILED'],
  },
  DD_COMPLETED: {
    id: 'DD_COMPLETED', label: 'DD завершён',
    icon: 'pi pi-check-circle', color: '#22c55e',
    subject: 'Фонд', object: 'Заключение DD',
    entityType: 'deal', phase: 'dd',
    enables: ['DEAL_CLOSED'],
  },
  DD_FAILED: {
    id: 'DD_FAILED', label: 'DD провален',
    icon: 'pi pi-times-circle', color: '#ef4444',
    subject: 'Фонд', object: 'Заключение DD',
    entityType: 'deal', phase: 'dd',
  },
  DEAL_CLOSED: {
    id: 'DEAL_CLOSED', label: 'Сделка закрыта',
    icon: 'pi pi-lock', color: '#10b981',
    subject: 'Фонд + Стартап', object: 'Договор',
    entityType: 'deal', phase: 'close',
    enables: ['TRANCHE_RELEASED', 'COMPANY_ADDED'],
  },
  TRANCHE_RELEASED: {
    id: 'TRANCHE_RELEASED', label: 'Транш выплачен',
    icon: 'pi pi-wallet', color: '#6366f1',
    subject: 'Фонд', object: 'Компания (счёт)',
    entityType: 'deal', phase: 'post-close',
    enables: ['MILESTONE_ACHIEVED', 'NEXT_TRANCHE_RELEASED'],
  },
  MILESTONE_ACHIEVED: {
    id: 'MILESTONE_ACHIEVED', label: 'Milestone достигнут',
    icon: 'pi pi-flag', color: '#f97316',
    subject: 'Компания', object: 'KPI / Условие',
    entityType: 'deal', phase: 'post-close',
    enables: ['TRANCHE_RELEASED'],
  },
  CONDITION_FULFILLED: {
    id: 'CONDITION_FULFILLED', label: 'Условие ИК выполнено',
    icon: 'pi pi-verified', color: '#84cc16',
    subject: 'Компания', object: 'Условие из протокола',
    entityType: 'deal', phase: 'post-close',
  },
}

// ─── Committee / Session events ───────────────────────────────────────────────

export const COMMITTEE_EVENT_TYPES = {
  SESSION_STARTED: {
    id: 'SESSION_STARTED', label: 'Сессия ИК начата',
    icon: 'pi pi-users', color: '#3b82f6',
    subject: 'Председатель', object: 'Проект',
    entityType: 'session', phase: 'open',
    enables: ['ARGUMENT_RAISED'],
  },
  ARGUMENT_RAISED: {
    id: 'ARGUMENT_RAISED', label: 'Аргумент выдвинут',
    icon: 'pi pi-comment', color: '#8b5cf6',
    subject: 'Агент ИК', object: 'Тезис',
    entityType: 'session', phase: 'argue',
    enables: ['ARGUMENT_CHALLENGED', 'ARGUMENT_SUPPORTED', 'ARGUMENT_SYNTHESIZED'],
  },
  ARGUMENT_CHALLENGED: {
    id: 'ARGUMENT_CHALLENGED', label: 'Аргумент оспорен',
    icon: 'pi pi-bolt', color: '#ef4444',
    subject: 'Агент ИК', object: 'Аргумент',
    entityType: 'session', phase: 'argue',
    causes: 'ARGUMENT_RAISED',
    enables: ['CONTRADICTION_FOUND', 'ARGUMENT_RAISED'],
  },
  ARGUMENT_SUPPORTED: {
    id: 'ARGUMENT_SUPPORTED', label: 'Аргумент поддержан',
    icon: 'pi pi-thumbs-up', color: '#22c55e',
    subject: 'Агент ИК', object: 'Аргумент',
    entityType: 'session', phase: 'argue',
    causes: 'ARGUMENT_RAISED',
  },
  ARGUMENT_SYNTHESIZED: {
    id: 'ARGUMENT_SYNTHESIZED', label: 'Синтез аргументов',
    icon: 'pi pi-sitemap', color: '#f59e0b',
    subject: 'Председатель', object: 'Тезис + Антитезис',
    entityType: 'session', phase: 'argue',
    enables: ['CONDITION_PROPOSED'],
  },
  CONTRADICTION_FOUND: {
    id: 'CONTRADICTION_FOUND', label: 'Противоречие найдено',
    icon: 'pi pi-exclamation-triangle', color: '#f97316',
    subject: 'Система (автоматически)', object: 'Пара аргументов',
    entityType: 'session', phase: 'argue',
    enables: ['CONDITION_PROPOSED'],
  },
  CONDITION_PROPOSED: {
    id: 'CONDITION_PROPOSED', label: 'Условие предложено',
    icon: 'pi pi-list-check', color: '#6366f1',
    subject: 'Агент ИК', object: 'Противоречие',
    entityType: 'session', phase: 'negotiate',
    causes: 'CONTRADICTION_FOUND',
    enables: ['VOTE_CAST'],
  },
  VOTE_CAST: {
    id: 'VOTE_CAST', label: 'Голос подан',
    icon: 'pi pi-check', color: '#22c55e',
    subject: 'Агент ИК', object: 'Решение',
    entityType: 'session', phase: 'vote',
    enables: ['DECISION_MADE'],
  },
  DECISION_MADE: {
    id: 'DECISION_MADE', label: 'Решение принято',
    icon: 'pi pi-verified', color: '#10b981',
    subject: 'Комитет', object: 'Сделка',
    entityType: 'session', phase: 'close',
    enables: ['TERM_SHEET_PROPOSED', 'DEAL_SOURCED'],
  },
}

// ─── Fund events ──────────────────────────────────────────────────────────────

export const FUND_EVENT_TYPES = {
  FUND_LAUNCHED: {
    id: 'FUND_LAUNCHED', label: 'Фонд создан',
    icon: 'pi pi-flag', color: '#64748b',
    subject: 'GP', object: 'Фонд',
    entityType: 'fund', phase: 'init',
  },
  LP_COMMITTED: {
    id: 'LP_COMMITTED', label: 'LP подписал commitment',
    icon: 'pi pi-handshake', color: '#22c55e',
    subject: 'LP', object: 'Фонд',
    entityType: 'fund', phase: 'fundraise',
  },
  CAPITAL_CALLED: {
    id: 'CAPITAL_CALLED', label: 'Capital Call',
    icon: 'pi pi-arrow-down-left', color: '#3b82f6',
    subject: 'GP', object: 'LP (счёт)',
    entityType: 'fund', phase: 'deploy',
  },
  NAV_UPDATED: {
    id: 'NAV_UPDATED', label: 'NAV обновлён',
    icon: 'pi pi-chart-line', color: '#6366f1',
    subject: 'Оценщик / Система', object: 'Портфель',
    entityType: 'fund', phase: 'monitor',
  },
  DISTRIBUTION_MADE: {
    id: 'DISTRIBUTION_MADE', label: 'Распределение LP',
    icon: 'pi pi-arrow-up-right', color: '#f97316',
    subject: 'GP', object: 'LP',
    entityType: 'fund', phase: 'return',
  },
}

// ─── Startuper / Lead events ──────────────────────────────────────────────────
// Сущность: lead (entityType = 'lead', entityId = sessionId)
// Жизненный цикл: intake → research → scoring → IC-ready → submitted

export const STARTUPER_EVENT_TYPES = {
  LEAD_STARTED: {
    id: 'LEAD_STARTED', label: 'Лид зарегистрирован',
    icon: 'pi pi-rocket', color: '#6366f1',
    subject: 'Стартапер', object: 'Платформа ФСТ',
    entityType: 'lead', phase: 'intake',
    description: 'Стартап начал сессию первого касания с AI-агентом ФСТ НТИ',
    enables: ['MESSAGE_SENT', 'DOC_UPLOADED'],
  },
  MESSAGE_SENT: {
    id: 'MESSAGE_SENT', label: 'Сообщение отправлено',
    icon: 'pi pi-comment', color: '#8b5cf6',
    subject: 'Стартапер', object: 'Навигатор',
    entityType: 'lead', phase: 'intake',
    enables: ['TWIN_UPDATED'],
  },
  DOC_UPLOADED: {
    id: 'DOC_UPLOADED', label: 'Документ загружен',
    icon: 'pi pi-paperclip', color: '#3b82f6',
    subject: 'Стартапер', object: 'AI-парсер',
    entityType: 'lead', phase: 'intake',
    description: 'Загружен pitch-deck, описание, финмодель или фото прототипа',
    enables: ['DOC_PARSED'],
  },
  DOC_PARSED: {
    id: 'DOC_PARSED', label: 'Документ разобран',
    icon: 'pi pi-file-import', color: '#a855f7',
    subject: 'AI-парсер', object: 'Цифровой двойник',
    entityType: 'lead', phase: 'intake',
    enables: ['TWIN_UPDATED', 'RESEARCH_STARTED'],
  },
  TWIN_UPDATED: {
    id: 'TWIN_UPDATED', label: 'Двойник обновлён',
    icon: 'pi pi-sync', color: '#06b6d4',
    subject: 'AI-агент', object: 'Профиль проекта',
    entityType: 'lead', phase: 'intake',
  },
  TWIN_THRESHOLD_30: {
    id: 'TWIN_THRESHOLD_30', label: 'Профиль заполнен на 30%',
    icon: 'pi pi-chart-pie', color: '#f59e0b',
    subject: 'Платформа', object: 'Профиль проекта',
    entityType: 'lead', phase: 'intake',
    enables: ['RESEARCH_STARTED'],
  },
  TWIN_THRESHOLD_80: {
    id: 'TWIN_THRESHOLD_80', label: 'Профиль готов на 80% — можно в ИК',
    icon: 'pi pi-check-circle', color: '#22c55e',
    subject: 'Платформа', object: 'Профиль проекта',
    entityType: 'lead', phase: 'research',
    enables: ['SENT_TO_IC'],
  },
  RESEARCH_STARTED: {
    id: 'RESEARCH_STARTED', label: 'Исследовательский конвейер запущен',
    icon: 'pi pi-search', color: '#f59e0b',
    subject: 'AI-аналитик', object: 'Компания / Рынок',
    entityType: 'lead', phase: 'research',
    enables: ['EGRUL_CHECKED', 'PATENTS_FOUND', 'COMPETITORS_ANALYZED', 'GRANTS_MATCHED', 'SCORING_DONE'],
  },
  EGRUL_CHECKED: {
    id: 'EGRUL_CHECKED', label: 'ЕГРЮЛ проверен',
    icon: 'pi pi-building', color: '#64748b',
    subject: 'AI-аналитик', object: 'ФНС ЕГРЮЛ',
    entityType: 'lead', phase: 'research',
    description: 'Компания верифицирована по ИНН/ОГРН через ЕГРЮЛ',
  },
  PATENTS_FOUND: {
    id: 'PATENTS_FOUND', label: 'Патенты найдены',
    icon: 'pi pi-shield', color: '#8b5cf6',
    subject: 'AI-аналитик', object: 'ФИПС',
    entityType: 'lead', phase: 'research',
  },
  COMPETITORS_ANALYZED: {
    id: 'COMPETITORS_ANALYZED', label: 'Конкуренты проанализированы',
    icon: 'pi pi-chart-bar', color: '#f97316',
    subject: 'AI-аналитик', object: 'Рынок',
    entityType: 'lead', phase: 'research',
  },
  GRANTS_MATCHED: {
    id: 'GRANTS_MATCHED', label: 'Гранты подобраны',
    icon: 'pi pi-money-bill', color: '#10b981',
    subject: 'Грантовед', object: 'GR-меры',
    entityType: 'lead', phase: 'research',
    enables: ['PROJECT_STARTED'],  // → инициализирует GR-проект
  },
  SCORING_DONE: {
    id: 'SCORING_DONE', label: 'Скоринг завершён',
    icon: 'pi pi-star', color: '#f59e0b',
    subject: 'Скорер', object: 'Проект',
    entityType: 'lead', phase: 'scoring',
    description: 'Скоринг по 8 осям: технологии, рынок, команда, финансы, суверенность, конкуренция, IP, риски',
  },
  IC_PRELIM_DONE: {
    id: 'IC_PRELIM_DONE', label: 'Первичный анализ ИК завершён',
    icon: 'pi pi-users', color: '#3b82f6',
    subject: 'Агенты ИК', object: 'Проект',
    entityType: 'lead', phase: 'scoring',
    enables: ['APPLY_STARTED', 'SENT_TO_IC'],
  },
  APPLY_STARTED: {
    id: 'APPLY_STARTED', label: 'Стартап перешёл к заявке',
    icon: 'pi pi-file-edit', color: '#6366f1',
    subject: 'Стартапер', object: 'Форма заявки',
    entityType: 'lead', phase: 'submit',
    enables: ['SENT_TO_IC'],
  },
  SENT_TO_IC: {
    id: 'SENT_TO_IC', label: 'Заявка отправлена в инвесткомитет',
    icon: 'pi pi-send', color: '#22c55e',
    subject: 'Стартапер', object: 'ИК ФСТ НТИ',
    entityType: 'lead', phase: 'submit',
    description: 'Проект прошёл первичный фильтр и передан на рассмотрение инвесткомитета',
    enables: ['SESSION_STARTED'],  // → цепочка в committee
  },
}

// ─── Единый реестр ────────────────────────────────────────────────────────────

// Добавляем entityType к SOFT_EVENT_TYPES (они описывают модули платформы)
const SOFT_EVENT_TYPES_TAGGED = Object.fromEntries(
  Object.entries(SOFT_EVENT_TYPES).map(([k, v]) => [k, { ...v, entityType: 'module' }])
)

export const EVENT_REGISTRY = {
  ...GR_EVENT_TYPES,
  ...PORTFOLIO_EVENT_TYPES,
  ...DEAL_EVENT_TYPES,
  ...COMMITTEE_EVENT_TYPES,
  ...FUND_EVENT_TYPES,
  ...STARTUPER_EVENT_TYPES,
  ...SOFT_EVENT_TYPES_TAGGED,
}

/**
 * Получить определение события по типу
 */
export function getEventDef(type) {
  return EVENT_REGISTRY[type] || null
}

/**
 * Получить все типы для конкретной сущности
 */
export function getEventTypesFor(entityType) {
  return Object.values(EVENT_REGISTRY).filter(e => e.entityType === entityType)
}

/**
 * Фазы — визуальный порядок в UI
 */
export const PHASES = {
  project: ['init', 'diagnose', 'apply', 'approve', 'fund', 'outcome', 'scale'],
  company: ['init', 'monitor', 'milestone', 'alert', 'growth', 'exit'],
  deal:    ['source', 'negotiate', 'dd', 'close', 'post-close'],
  session: ['open', 'argue', 'negotiate', 'vote', 'close'],
  fund:    ['init', 'fundraise', 'deploy', 'monitor', 'return'],
  lead:    ['intake', 'research', 'scoring', 'submit'],
  module:  ['init', 'develop', 'test', 'fix', 'deploy', 'diagnose', 'maintain'],
}
