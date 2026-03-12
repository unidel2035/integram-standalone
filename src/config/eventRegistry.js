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

// ─── Expert Digital Twin events ───────────────────────────────────────────────
// entityType: 'expert'
// entityId:   expertId ('gordin', 'medvedev', ...)
// Жизненный цикл решения: observe → question → argue → evaluate → decide

export const EXPERT_EVENT_TYPES = {
  EXPERT_SESSION_STARTED: {
    id: 'EXPERT_SESSION_STARTED', label: 'Сессия эксперта начата',
    icon: 'pi pi-user', color: 'var(--fst-purple)',
    subject: 'Пользователь', object: 'Эксперт',
    entityType: 'expert', phase: 'observe',
    enables: ['EXPERT_QUESTION_ASKED', 'EXPERT_EVALUATED'],
  },
  EXPERT_CONTEXT_LOADED: {
    id: 'EXPERT_CONTEXT_LOADED', label: 'Контекст сделки загружен',
    icon: 'pi pi-download', color: 'var(--fst-blue)',
    subject: 'Система', object: 'Эксперт',
    entityType: 'expert', phase: 'observe',
    description: 'Эксперт получил event-timeline сделки как контекст',
    enables: ['EXPERT_PATTERN_FIRED'],
  },
  EXPERT_PATTERN_FIRED: {
    id: 'EXPERT_PATTERN_FIRED', label: 'Паттерн сработал',
    icon: 'pi pi-bolt', color: 'var(--fst-brand)',
    subject: 'Когнитивная модель', object: 'Шаблон решения',
    entityType: 'expert', phase: 'observe',
    description: 'Один из выученных паттернов совпал с состоянием сделки',
  },
  EXPERT_QUESTION_ASKED: {
    id: 'EXPERT_QUESTION_ASKED', label: 'Эксперт задал вопрос',
    icon: 'pi pi-question-circle', color: 'var(--fst-cyan)',
    subject: 'Эксперт', object: 'Стартап / Команда',
    entityType: 'expert', phase: 'question',
    causes: 'EXPERT_SESSION_STARTED',
    enables: ['EXPERT_ARGUMENT_RAISED'],
  },
  EXPERT_ARGUMENT_RAISED: {
    id: 'EXPERT_ARGUMENT_RAISED', label: 'Тезис сформирован',
    icon: 'pi pi-comment', color: 'var(--fst-purple)',
    subject: 'Эксперт', object: 'Аргумент',
    entityType: 'expert', phase: 'argue',
    enables: ['EXPERT_EVALUATED', 'EXPERT_CONDITION_PROPOSED'],
  },
  EXPERT_CONDITION_PROPOSED: {
    id: 'EXPERT_CONDITION_PROPOSED', label: 'Условие предложено экспертом',
    icon: 'pi pi-list-check', color: 'var(--fst-blue)',
    subject: 'Эксперт', object: 'Сделка',
    entityType: 'expert', phase: 'argue',
    enables: ['EXPERT_EVALUATED'],
    // cross-entity: → CONDITION_PROPOSED в session
    crossEnables: [{ entityType: 'session', eventType: 'CONDITION_PROPOSED' }],
  },
  EXPERT_EVALUATED: {
    id: 'EXPERT_EVALUATED', label: 'Эксперт дал вердикт',
    icon: 'pi pi-verified', color: 'var(--fst-green)',
    subject: 'Эксперт', object: 'Сделка',
    entityType: 'expert', phase: 'decide',
    description: 'Итоговый вердикт: ОДОБРИТЬ / ОТЛОЖИТЬ / ОТКЛОНИТЬ с confidence score',
    // cross-entity: → VOTE_CAST в session
    crossEnables: [{ entityType: 'session', eventType: 'VOTE_CAST' }],
  },
  EXPERT_PATTERN_LEARNED: {
    id: 'EXPERT_PATTERN_LEARNED', label: 'Новый паттерн извлечён',
    icon: 'pi pi-brain', color: 'var(--fst-purple)',
    subject: 'Система обучения', object: 'Когнитивная модель',
    entityType: 'expert', phase: 'learn',
    description: 'AI извлёк новый поведенческий паттерн из истории решений эксперта',
  },
  EXPERT_PREDICTION_GENERATED: {
    id: 'EXPERT_PREDICTION_GENERATED', label: 'Прогноз решения сгенерирован',
    icon: 'pi pi-chart-bar', color: 'var(--fst-cyan)',
    subject: 'Предиктивная модель', object: 'Сделка',
    entityType: 'expert', phase: 'predict',
    description: 'Система предсказала вероятность одобрения по паттернам',
  },
}

// ─── Factor Model events ───────────────────────────────────────────────────────
// entityType: 'deal' (факторы — атрибут сделки, не отдельной сущности)
// Жизненный цикл: score → validate → portfolio_impact → stress → compliance

export const FACTOR_EVENT_TYPES = {
  // ── Scoring ──────────────────────────────────────────────────────────────────
  FACTOR_SCORED: {
    id: 'FACTOR_SCORED', label: 'Факторная оценка рассчитана',
    icon: 'pi pi-chart-bar', color: 'var(--fst-blue)',
    subject: 'Factor Engine', object: 'Сделка',
    entityType: 'deal', phase: 'dd',
    description: 'Вычислен 5-факторный вектор T·S·M·G·E для сделки',
    enables: ['FACTOR_VALIDATED', 'PORTFOLIO_IMPACT_COMPUTED', 'STRESS_TEST_RUN'],
    factorMeta: {
      factors: ['T', 'S', 'M', 'G', 'E'],
      weights: { T: 0.25, S: 0.35, M: 0.20, G: 0.10, E: 0.10 },
    },
  },
  FACTOR_T_UPDATED: {
    id: 'FACTOR_T_UPDATED', label: 'TRL Momentum обновлён',
    icon: 'pi pi-arrow-up-right', color: 'var(--fst-blue)',
    subject: 'Компания / Система', object: 'T-фактор',
    entityType: 'deal', phase: 'monitor',
    description: 'Изменился уровень TRL или его динамика — T-фактор пересчитан',
    causes: 'FACTOR_SCORED',
    enables: ['FACTOR_SCORED'],  // trigger rescore
  },
  FACTOR_S_UPDATED: {
    id: 'FACTOR_S_UPDATED', label: 'Sovereign Score обновлён',
    icon: 'pi pi-shield', color: 'var(--fst-purple)',
    subject: 'Компания / Аудит', object: 'S-фактор',
    entityType: 'deal', phase: 'monitor',
    description: 'Изменился % российских компонентов — S-фактор пересчитан',
    causes: 'FACTOR_SCORED',
    enables: ['FACTOR_SCORED'],
  },
  FACTOR_M_UPDATED: {
    id: 'FACTOR_M_UPDATED', label: 'Multiplier Score обновлён',
    icon: 'pi pi-percentage', color: 'var(--fst-green)',
    subject: 'Со-инвесторы / Round', object: 'M-фактор',
    entityType: 'deal', phase: 'negotiate',
    description: 'Изменился состав или объём со-инвесторов — M-фактор пересчитан',
    causes: 'FACTOR_SCORED',
    enables: ['FACTOR_SCORED'],
  },
  FACTOR_G_UPDATED: {
    id: 'FACTOR_G_UPDATED', label: 'GR Coverage обновлён',
    icon: 'pi pi-sitemap', color: 'var(--fst-cyan)',
    subject: 'GR-аналитик / Система', object: 'G-фактор',
    entityType: 'deal', phase: 'monitor',
    description: 'Добавлена новая GR-мера или шаг цепочки покрыт — G-фактор пересчитан',
    causes: 'FACTOR_SCORED',
    enables: ['FACTOR_SCORED'],
  },
  FACTOR_E_UPDATED: {
    id: 'FACTOR_E_UPDATED', label: 'Export Readiness обновлён',
    icon: 'pi pi-globe', color: 'var(--fst-brand)',
    subject: 'Компания / Аналитик', object: 'E-фактор',
    entityType: 'deal', phase: 'monitor',
    description: 'Изменился экспортный потенциал (БРИКС+) — E-фактор пересчитан',
    causes: 'FACTOR_SCORED',
    enables: ['FACTOR_SCORED'],
  },

  // ── Validation ──────────────────────────────────────────────────────────────
  FACTOR_VALIDATED: {
    id: 'FACTOR_VALIDATED', label: 'Факторы верифицированы',
    icon: 'pi pi-verified', color: 'var(--fst-green)',
    subject: 'Эксперт / Аналитик', object: 'Factor Vector',
    entityType: 'deal', phase: 'dd',
    description: 'Эксперт подтвердил значения факторов после due diligence',
    causes: 'FACTOR_SCORED',
    enables: ['PORTFOLIO_IMPACT_COMPUTED', 'COMPLIANCE_CHECKED'],
  },
  FACTOR_DISPUTED: {
    id: 'FACTOR_DISPUTED', label: 'Фактор оспорен',
    icon: 'pi pi-exclamation-circle', color: 'var(--fst-red)',
    subject: 'Эксперт', object: 'Конкретный фактор',
    entityType: 'deal', phase: 'dd',
    description: 'Эксперт не согласен с автоматически рассчитанным значением фактора',
    causes: 'FACTOR_SCORED',
    enables: ['FACTOR_SCORED'],  // → rescore with manual override
  },

  // ── Portfolio analytics ──────────────────────────────────────────────────────
  PORTFOLIO_IMPACT_COMPUTED: {
    id: 'PORTFOLIO_IMPACT_COMPUTED', label: 'Портфельный эффект рассчитан',
    icon: 'pi pi-chart-pie', color: 'var(--fst-blue)',
    subject: 'Factor Engine', object: 'Портфель',
    entityType: 'fund', phase: 'deploy',
    description: 'Рассчитан эффект добавления новой сделки на факторный профиль портфеля',
    causes: 'FACTOR_VALIDATED',
    enables: ['COMPLIANCE_CHECKED', 'STRESS_TEST_RUN'],
  },
  CONCENTRATION_WARNING: {
    id: 'CONCENTRATION_WARNING', label: 'Концентрация превышена',
    icon: 'pi pi-exclamation-triangle', color: 'var(--fst-brand)',
    subject: 'Factor Engine', object: 'Портфель',
    entityType: 'fund', phase: 'deploy',
    description: 'Добавление сделки приводит к превышению лимита концентрации по сектору или фактору',
    causes: 'PORTFOLIO_IMPACT_COMPUTED',
    enables: ['COMPLIANCE_CHECKED'],
  },

  // ── Stress testing ───────────────────────────────────────────────────────────
  STRESS_TEST_RUN: {
    id: 'STRESS_TEST_RUN', label: 'Стресс-тест запущен',
    icon: 'pi pi-bolt', color: 'var(--fst-purple)',
    subject: 'Risk Engine', object: 'Сделка / Портфель',
    entityType: 'deal', phase: 'dd',
    description: 'Запущены FST-сценарии: санкции, снижение ГОЗ, регуляторика БАС, конкурент, LP-выход',
    enables: ['STRESS_TEST_COMPLETED'],
  },
  STRESS_TEST_COMPLETED: {
    id: 'STRESS_TEST_COMPLETED', label: 'Стресс-тест завершён',
    icon: 'pi pi-check-circle', color: 'var(--fst-green)',
    subject: 'Risk Engine', object: 'Результаты',
    entityType: 'deal', phase: 'dd',
    causes: 'STRESS_TEST_RUN',
    enables: ['COMPLIANCE_CHECKED', 'FACTOR_VALIDATED'],
  },
  STRESS_CRITICAL_FOUND: {
    id: 'STRESS_CRITICAL_FOUND', label: 'Критическая уязвимость выявлена',
    icon: 'pi pi-times-circle', color: 'var(--fst-red)',
    subject: 'Risk Engine', object: 'Сценарий',
    entityType: 'deal', phase: 'dd',
    description: 'В одном из сценариев composite score падает ниже 4 (grade D)',
    causes: 'STRESS_TEST_COMPLETED',
    enables: ['FACTOR_DISPUTED', 'CONDITION_PROPOSED'],
  },

  // ── Compliance ───────────────────────────────────────────────────────────────
  COMPLIANCE_CHECKED: {
    id: 'COMPLIANCE_CHECKED', label: 'Мандатный контроль пройден',
    icon: 'pi pi-list-check', color: 'var(--fst-blue)',
    subject: 'Compliance Engine', object: 'Инвестиционный мандат',
    entityType: 'deal', phase: 'dd',
    description: 'Сделка проверена на соответствие инвестиционному мандату ФСТ НТИ',
    causes: 'FACTOR_VALIDATED',
    enables: ['COMPLIANCE_PASSED', 'COMPLIANCE_VIOLATION'],
  },
  COMPLIANCE_PASSED: {
    id: 'COMPLIANCE_PASSED', label: 'Мандат соблюдён',
    icon: 'pi pi-verified', color: 'var(--fst-green)',
    subject: 'Compliance Engine', object: 'Мандат',
    entityType: 'deal', phase: 'dd',
    causes: 'COMPLIANCE_CHECKED',
    enables: ['VOTE_CAST'],  // → cross-entity: можно голосовать
  },
  COMPLIANCE_VIOLATION: {
    id: 'COMPLIANCE_VIOLATION', label: 'Нарушение мандата',
    icon: 'pi pi-ban', color: 'var(--fst-red)',
    subject: 'Compliance Engine', object: 'Правило мандата',
    entityType: 'deal', phase: 'dd',
    description: 'Сделка нарушает одно или несколько правил инвестиционного мандата',
    causes: 'COMPLIANCE_CHECKED',
    enables: ['CONDITION_PROPOSED'],  // → эксперт должен поставить условие
  },

  // ── Factor momentum (portfolio monitoring) ───────────────────────────────────
  FACTOR_POSITIVE_TREND: {
    id: 'FACTOR_POSITIVE_TREND', label: 'Факторный вектор улучшается',
    icon: 'pi pi-arrow-up', color: 'var(--fst-green)',
    subject: 'Monitoring Engine', object: 'Портфельная компания',
    entityType: 'company', phase: 'monitor',
    description: 'Composite score портфельной компании вырос на 10%+ за квартал',
    enables: ['MILESTONE_ACHIEVED'],
  },
  FACTOR_NEGATIVE_TREND: {
    id: 'FACTOR_NEGATIVE_TREND', label: 'Факторный вектор деградирует',
    icon: 'pi pi-arrow-down', color: 'var(--fst-red)',
    subject: 'Monitoring Engine', object: 'Портфельная компания',
    entityType: 'company', phase: 'alert',
    description: 'Composite score портфельной компании упал на 10%+ за квартал',
    enables: ['RISK_ELEVATED'],
  },
}

// ─── Регламент ФСТ НТИ — события по 6 подпроцессам ────────────────────────────
// Верифицировано по: Регламент инвестиционной деятельности ИТ «Фонд суверенных технологий НТИ»
// Утверждён Протокол № 2/23 от 23.03.2023. Объект Integram: 70509
//
// ПП-1: Рассмотрение Проектной инициативы (≤10 р.д.)
// ПП-2: Предварительный анализ (≤20 р.д.)
// ПП-3: ИК-1 первичное рассмотрение (≤45 р.д.)
// ПП-4: ИК-2 + экспертизы (≤45 р.д., +45 при статусе «Проект НТИ»)
// ПП-5: Закрытие сделки (по юр.документам)
// ПП-6: Контроль хода реализации (постоянно, до Выхода)

export const REGLAMENT_EVENT_TYPES = {

  // ── ПП-1: Рассмотрение Проектной инициативы ─────────────────────────────────
  PI_REGISTERED: {
    id: 'PI_REGISTERED', label: 'ПИ зарегистрирована в реестре УТ',
    icon: 'pi pi-file-plus', color: 'var(--fst-blue)',
    subject: 'УТ', object: 'Реестр ПИ',
    entityType: 'deal', phase: 'source',
    description: 'Проектная инициатива зарегистрирована, назначен ответственный сотрудник УТ. Срок рассмотрения: 10 р.д.',
    enables: ['PI_COMPLIANCE_CHECK'],
    reglamentRef: '3.1.1 пп.1',
  },
  PI_COMPLIANCE_CHECK: {
    id: 'PI_COMPLIANCE_CHECK', label: 'ПИ проверена на соответствие инвест-декларации',
    icon: 'pi pi-list-check', color: 'var(--fst-blue)',
    subject: 'УТ', object: 'Инвестиционная декларация',
    entityType: 'deal', phase: 'source',
    description: 'Проверка на соответствие: отрасль НТИ, ВНД ≥35%, рентабельность ≥1, рынок ≥500 млн ₽/год, темп роста ≥5%',
    causes: 'PI_REGISTERED',
    enables: ['PI_ACCEPTED', 'PI_REJECTED'],
    reglamentRef: '3.1.1 пп.2-5',
  },
  PI_ACCEPTED: {
    id: 'PI_ACCEPTED', label: 'Решение УТ: ПИ принята, открыты работы',
    icon: 'pi pi-check-circle', color: 'var(--fst-green)',
    subject: 'УТ (единоличный исполнительный орган)', object: 'Проект',
    entityType: 'deal', phase: 'source',
    description: 'УТ принял решение об открытии работ и назначении руководителя проекта (РП)',
    causes: 'PI_COMPLIANCE_CHECK',
    enables: ['RP_ASSIGNED'],
    reglamentRef: '3.1.1 пп.6',
  },
  PI_REJECTED: {
    id: 'PI_REJECTED', label: 'Решение УТ: ПИ отклонена',
    icon: 'pi pi-times-circle', color: 'var(--fst-red)',
    subject: 'УТ', object: 'Инициатор проекта',
    entityType: 'deal', phase: 'source',
    description: 'УТ отправил мотивированный письменный отказ с рекомендациями. Срок: 3 р.д. с решения.',
    causes: 'PI_COMPLIANCE_CHECK',
    enables: ['PI_REGISTERED'],
    reglamentRef: '3.1.1 п.2 ДД',
  },

  // ── ПП-2: Предварительный анализ ────────────────────────────────────────────
  RP_ASSIGNED: {
    id: 'RP_ASSIGNED', label: 'Назначен руководитель проекта (РП)',
    icon: 'pi pi-user-plus', color: 'var(--fst-blue)',
    subject: 'УТ', object: 'РП',
    entityType: 'deal', phase: 'negotiate',
    description: 'РП уведомляет Инициатора об открытии работ. Срок перехода: 3 р.д. с решения ПП-1.',
    causes: 'PI_ACCEPTED',
    enables: ['NDA_SIGNED'],
    reglamentRef: '3.2.1 пп.1',
  },
  NDA_SIGNED: {
    id: 'NDA_SIGNED', label: 'NDA подписан с Инициатором',
    icon: 'pi pi-lock', color: 'var(--fst-purple)',
    subject: 'РП + УТ', object: 'Инициатор',
    entityType: 'deal', phase: 'negotiate',
    description: 'Соглашение о неразглашении конфиденциальной информации подписано',
    causes: 'RP_ASSIGNED',
    enables: ['PRELIM_ANALYSIS_STARTED'],
    reglamentRef: '3.2.1 пп.2',
  },
  PRELIM_ANALYSIS_STARTED: {
    id: 'PRELIM_ANALYSIS_STARTED', label: 'Предварительный анализ начат',
    icon: 'pi pi-search', color: 'var(--fst-brand)',
    subject: 'РП + консультанты', object: 'Проект / Компания',
    entityType: 'deal', phase: 'negotiate',
    description: 'РП запросил доп. документы: финмодель, бизнес-план, маркетинг. Анализ на предмет выгодных условий Сделки.',
    causes: 'NDA_SIGNED',
    enables: ['OUS_FORMED'],
    reglamentRef: '3.2.1 пп.3-4',
  },
  OUS_FORMED: {
    id: 'OUS_FORMED', label: 'Сформирован проект ОУС',
    icon: 'pi pi-file-edit', color: 'var(--fst-brand)',
    subject: 'РП', object: 'Соглашение об основных условиях Сделки',
    entityType: 'deal', phase: 'negotiate',
    description: 'РП сформировал Заключение о целесообразности и проект Соглашения об ОУС. Срок ПП-2: 20 р.д.',
    causes: 'PRELIM_ANALYSIS_STARTED',
    enables: ['PRELIM_ANALYSIS_DONE'],
    reglamentRef: '3.2.1 пп.5',
  },
  PRELIM_ANALYSIS_DONE: {
    id: 'PRELIM_ANALYSIS_DONE', label: 'Предварительный анализ завершён',
    icon: 'pi pi-check-circle', color: 'var(--fst-green)',
    subject: 'УТ', object: 'Заключение о целесообразности',
    entityType: 'deal', phase: 'negotiate',
    description: 'УТ принял решение о переходе к ПП-3 или прекращении работ',
    causes: 'OUS_FORMED',
    enables: ['OUS_SIGNED', 'DEAL_SOURCED'],
    reglamentRef: '3.2.1 пп.6',
  },

  // ── ПП-3: ИК-1 (первичное рассмотрение) ─────────────────────────────────────
  OUS_SIGNED: {
    id: 'OUS_SIGNED', label: 'Соглашение об ОУС подписано',
    icon: 'pi pi-file-edit', color: 'var(--fst-green)',
    subject: 'УТ + контрагенты', object: 'ОУС',
    entityType: 'deal', phase: 'negotiate',
    description: 'Носит не обязывающий характер. Фиксирует эксклюзивность и порядок информационного обмена.',
    causes: 'PRELIM_ANALYSIS_DONE',
    enables: ['IC1_CONVENED'],
    reglamentRef: '3.3.1 пп.3-4',
  },
  IC1_CONVENED: {
    id: 'IC1_CONVENED', label: 'Созвано заседание ИК-1',
    icon: 'pi pi-users', color: 'var(--fst-purple)',
    subject: 'УТ', object: 'ИК',
    entityType: 'session', phase: 'open',
    description: 'УТ уведомил членов ИК и выносит на рассмотрение: финмодель, бизнес-план, ОУС, статус «Проект НТИ». Срок ПП-3: 45 р.д.',
    causes: 'OUS_SIGNED',
    enables: ['SESSION_STARTED', 'IC1_DECISION_APPROVED', 'IC1_DECISION_REVISION', 'IC1_DECISION_REJECTED'],
    reglamentRef: '3.3.1 пп.5',
  },
  IC1_DECISION_APPROVED: {
    id: 'IC1_DECISION_APPROVED', label: 'Решение ИК-1: одобрено, переход к ПП-4',
    icon: 'pi pi-verified', color: 'var(--fst-green)',
    subject: 'ИК', object: 'Проект',
    entityType: 'session', phase: 'close',
    description: 'ИК-1 одобрил Соглашение об ОУС. УТ переходит к ПП-4 в течение 3 р.д.',
    causes: 'IC1_CONVENED',
    enables: ['EXPERT_ASSESSMENT_ORDERED'],
    reglamentRef: '3.3.1 пп.6-8 ДД.1',
  },
  IC1_DECISION_REVISION: {
    id: 'IC1_DECISION_REVISION', label: 'Решение ИК-1: доработка документов',
    icon: 'pi pi-refresh', color: 'var(--fst-brand)',
    subject: 'ИК', object: 'Документы Проекта',
    entityType: 'session', phase: 'close',
    description: 'ИК-1 потребовал доработки. Срок: 20 р.д. для внесения изменений.',
    causes: 'IC1_CONVENED',
    enables: ['IC1_CONVENED'],
    reglamentRef: '3.3.1 пп.8 ДД.2',
  },
  IC1_DECISION_REJECTED: {
    id: 'IC1_DECISION_REJECTED', label: 'Решение ИК-1: проект отклонён',
    icon: 'pi pi-times-circle', color: 'var(--fst-red)',
    subject: 'ИК / УТ', object: 'Инициатор',
    entityType: 'session', phase: 'close',
    description: 'Прекращение работ. УТ направляет мотивированный отказ в 3 р.д.',
    causes: 'IC1_CONVENED',
    reglamentRef: '3.3.1 пп.8 ДД.3',
  },

  // ── ПП-4: ИК-2 + специализированные экспертизы ──────────────────────────────
  EXPERT_ASSESSMENT_ORDERED: {
    id: 'EXPERT_ASSESSMENT_ORDERED', label: 'Заказаны специализированные экспертизы',
    icon: 'pi pi-search-plus', color: 'var(--fst-purple)',
    subject: 'УТ / РП', object: 'Независимые эксперты',
    entityType: 'deal', phase: 'dd',
    description: 'Заказаны: финансово-экономическая, правовая, технологическая (TRL) экспертизы. Конкурентный отбор консультантов.',
    causes: 'IC1_DECISION_APPROVED',
    enables: ['DUE_DILIGENCE_STARTED', 'INDEPENDENT_VALUATION_ORDERED'],
    reglamentRef: '3.4.1 пп.1',
  },
  INDEPENDENT_VALUATION_ORDERED: {
    id: 'INDEPENDENT_VALUATION_ORDERED', label: 'Независимая оценка заказана',
    icon: 'pi pi-chart-bar', color: 'var(--fst-blue)',
    subject: 'УТ', object: 'Оценщик',
    entityType: 'deal', phase: 'dd',
    description: 'Конкурентный отбор независимого оценщика для оценки Инвестиционного актива',
    causes: 'EXPERT_ASSESSMENT_ORDERED',
    enables: ['INDEPENDENT_VALUATION_DONE'],
    reglamentRef: '3.4.1 пп.1',
  },
  INDEPENDENT_VALUATION_DONE: {
    id: 'INDEPENDENT_VALUATION_DONE', label: 'Независимая оценка завершена',
    icon: 'pi pi-chart-line', color: 'var(--fst-green)',
    subject: 'Оценщик', object: 'Инвестиционный актив',
    entityType: 'deal', phase: 'dd',
    description: 'Получено заключение независимого оценщика о стоимости актива',
    causes: 'INDEPENDENT_VALUATION_ORDERED',
    enables: ['IC2_CONVENED'],
    reglamentRef: '3.4.1 пп.4',
  },
  LEGAL_DOCS_PREPARED: {
    id: 'LEGAL_DOCS_PREPARED', label: 'Подготовлены юридически-обязывающие документы',
    icon: 'pi pi-file-edit', color: 'var(--fst-purple)',
    subject: 'РП + юрист', object: 'Договорная документация',
    entityType: 'deal', phase: 'dd',
    description: 'Проекты договоров (инвестирования, корпоративный, залога и др.) согласованы с контрагентами',
    causes: 'DD_COMPLETED',
    enables: ['IC2_CONVENED'],
    reglamentRef: '3.4.1 пп.5-6',
  },
  NTI_STATUS_CONFIRMED: {
    id: 'NTI_STATUS_CONFIRMED', label: 'Присвоен статус «Проект НТИ»',
    icon: 'pi pi-star-fill', color: 'var(--fst-brand)',
    subject: 'Проектный комитет НТИ', object: 'Проект',
    entityType: 'deal', phase: 'dd',
    description: 'Подтверждение статуса «Проект НТИ» обязательно до ИК-2. При отсутствии — прекращение работ.',
    enables: ['IC2_CONVENED'],
    reglamentRef: '3.4.1 пп.2-4',
  },
  IC2_CONVENED: {
    id: 'IC2_CONVENED', label: 'Созвано заседание ИК-2',
    icon: 'pi pi-users', color: 'var(--fst-purple)',
    subject: 'УТ', object: 'ИК',
    entityType: 'session', phase: 'open',
    description: 'УТ выносит на ИК-2: юр. документы, экспертизы, оценщика, финмодель, статус НТИ. Срок ПП-4: 45 р.д.',
    causes: 'LEGAL_DOCS_PREPARED',
    enables: ['IC2_DECISION_APPROVED', 'IC2_DECISION_REVISION', 'IC2_DECISION_REJECTED'],
    reglamentRef: '3.4.1 пп.7',
  },
  IC2_DECISION_APPROVED: {
    id: 'IC2_DECISION_APPROVED', label: 'Решение ИК-2: сделка одобрена',
    icon: 'pi pi-verified', color: 'var(--fst-green)',
    subject: 'ИК', object: 'Сделка',
    entityType: 'session', phase: 'close',
    description: 'ИК-2 принял решение о закрытии Сделки. УТ переходит к ПП-5 в течение 3 р.д.',
    causes: 'IC2_CONVENED',
    enables: ['LEGAL_CLOSING'],
    reglamentRef: '3.4.1 пп.10 ДД.1',
  },
  IC2_DECISION_REVISION: {
    id: 'IC2_DECISION_REVISION', label: 'Решение ИК-2: доработка документов',
    icon: 'pi pi-refresh', color: 'var(--fst-brand)',
    subject: 'ИК', object: 'Юридические документы',
    entityType: 'session', phase: 'close',
    description: 'ИК-2 потребовал доработки. Срок: 20 р.д., затем повторное рассмотрение ИК-2.',
    causes: 'IC2_CONVENED',
    enables: ['IC2_CONVENED'],
    reglamentRef: '3.4.1 пп.10 ДД.2',
  },
  IC2_DECISION_REJECTED: {
    id: 'IC2_DECISION_REJECTED', label: 'Решение ИК-2: сделка отклонена',
    icon: 'pi pi-times-circle', color: 'var(--fst-red)',
    subject: 'ИК / УТ', object: 'Инициатор',
    entityType: 'session', phase: 'close',
    description: 'Прекращение работ по Проекту. Мотивированный отказ в 3 р.д.',
    causes: 'IC2_CONVENED',
    reglamentRef: '3.4.1 пп.10 ДД.3',
  },

  // ── ПП-5: Закрытие Сделки ────────────────────────────────────────────────────
  LEGAL_CLOSING: {
    id: 'LEGAL_CLOSING', label: 'Юридическое закрытие Сделки',
    icon: 'pi pi-file-check', color: 'var(--fst-green)',
    subject: 'УТ + контрагенты', object: 'Договоры',
    entityType: 'deal', phase: 'close',
    description: 'Подписание и нотариальное заверение всех юридически-обязывающих документов по Сделке',
    causes: 'IC2_DECISION_APPROVED',
    enables: ['PRECEDENT_CONDITIONS_FULFILLED'],
    reglamentRef: '3.5.1 пп.1',
  },
  PRECEDENT_CONDITIONS_FULFILLED: {
    id: 'PRECEDENT_CONDITIONS_FULFILLED', label: 'Отлагательные условия выполнены',
    icon: 'pi pi-list-check', color: 'var(--fst-green)',
    subject: 'УТ', object: 'Условия Сделки',
    entityType: 'deal', phase: 'close',
    description: 'УТ подтвердил выполнение всех отлагательных условий, предшествующих финансированию',
    causes: 'LEGAL_CLOSING',
    enables: ['CAPITAL_CALL_NOTICE'],
    reglamentRef: '3.5.1 пп.4',
  },
  CAPITAL_CALL_NOTICE: {
    id: 'CAPITAL_CALL_NOTICE', label: 'Уведомление о внесении вклада Товарищам',
    icon: 'pi pi-bell', color: 'var(--fst-blue)',
    subject: 'УТ', object: 'Товарищи-вкладчики',
    entityType: 'fund', phase: 'deploy',
    description: 'УТ разослал Уведомления о внесении Вклада в соответствии с Договором',
    causes: 'PRECEDENT_CONDITIONS_FULFILLED',
    enables: ['FINANCIAL_CLOSING'],
    reglamentRef: '3.5.1 пп.6',
  },
  FINANCIAL_CLOSING: {
    id: 'FINANCIAL_CLOSING', label: 'Финансовое закрытие Сделки',
    icon: 'pi pi-wallet', color: 'var(--fst-green)',
    subject: 'УТ', object: 'Портфельная компания',
    entityType: 'deal', phase: 'close',
    description: 'Перевод денежных средств на счёт Портфельной компании. Сделка закрыта.',
    causes: 'CAPITAL_CALL_NOTICE',
    enables: ['DEAL_CLOSED', 'BOARD_REPRESENTATIVE_APPOINTED'],
    reglamentRef: '3.5.1 пп.7',
  },
  BOARD_REPRESENTATIVE_APPOINTED: {
    id: 'BOARD_REPRESENTATIVE_APPOINTED', label: 'Представитель УТ назначен в органы компании',
    icon: 'pi pi-user-edit', color: 'var(--fst-cyan)',
    subject: 'УТ', object: 'Совет директоров / Набсовет',
    entityType: 'deal', phase: 'close',
    description: 'УТ провёл корпоративные действия по выдвижению кандидатов в органы управления Портфельной компании',
    causes: 'FINANCIAL_CLOSING',
    enables: ['QUARTERLY_REPORT'],
    reglamentRef: '3.5.1 пп.3',
  },

  // ── ПП-6: Контроль хода реализации ───────────────────────────────────────────
  QUARTERLY_REPORT: {
    id: 'QUARTERLY_REPORT', label: 'Ежеквартальный отчёт о KPI',
    icon: 'pi pi-chart-pie', color: 'var(--fst-blue)',
    subject: 'Портфельная компания', object: 'УТ / ИК',
    entityType: 'company', phase: 'monitor',
    description: 'Фактические KPI: выручка, клиенты, чистая прибыль, юнит-экономика. Фактическое исполнение бюджета.',
    causes: 'BOARD_REPRESENTATIVE_APPOINTED',
    enables: ['IC3_CONVENED'],
    reglamentRef: '3.6.1 пп.1',
  },
  ANNUAL_AUDIT: {
    id: 'ANNUAL_AUDIT', label: 'Ежегодный аудит Портфельной компании',
    icon: 'pi pi-book', color: 'var(--fst-purple)',
    subject: 'УТ / Ревизионная комиссия', object: 'Портфельная компания',
    entityType: 'company', phase: 'monitor',
    description: 'Инициативный аудит в соответствии с юридически-обязывающими документами Сделки',
    enables: ['IC3_CONVENED'],
    reglamentRef: '3.6.1 пп.2',
  },
  IC3_CONVENED: {
    id: 'IC3_CONVENED', label: 'Созвано плановое заседание ИК-3',
    icon: 'pi pi-calendar', color: 'var(--fst-purple)',
    subject: 'УТ', object: 'ИК',
    entityType: 'session', phase: 'open',
    description: 'УТ выносит на ИК-3: бизнес-план, финмодель, аудит, факт. KPI, допусловия сделки',
    causes: 'QUARTERLY_REPORT',
    enables: ['IC3_DECISION_CONTINUE', 'IC3_DECISION_INTERVENE', 'IC3_DECISION_EXIT'],
    reglamentRef: '3.6.1 пп.3',
  },
  IC3_DECISION_CONTINUE: {
    id: 'IC3_DECISION_CONTINUE', label: 'Решение ИК-3: продолжение реализации',
    icon: 'pi pi-play', color: 'var(--fst-green)',
    subject: 'ИК', object: 'Проект',
    entityType: 'session', phase: 'close',
    description: 'ИК-3 одобрил план реализации. УТ продолжает мониторинг.',
    causes: 'IC3_CONVENED',
    enables: ['QUARTERLY_REPORT'],
    reglamentRef: '3.6.1 пп.6 ДД',
  },
  IC3_DECISION_INTERVENE: {
    id: 'IC3_DECISION_INTERVENE', label: 'Решение ИК-3: корректирующее воздействие',
    icon: 'pi pi-exclamation-triangle', color: 'var(--fst-brand)',
    subject: 'ИК', object: 'Условия Сделки',
    entityType: 'session', phase: 'close',
    description: 'ИК-3 принял решение об изменении условий Сделки. Переход к ПП-3, ПП-4 или ПП-5.',
    causes: 'IC3_CONVENED',
    enables: ['OUS_FORMED', 'EXPERT_ASSESSMENT_ORDERED', 'LEGAL_CLOSING'],
    reglamentRef: '3.6.1 пп.6 ДД, пп.7',
  },
  IC3_DECISION_EXIT: {
    id: 'IC3_DECISION_EXIT', label: 'Решение ИК-3: начало Выхода из инвестиций',
    icon: 'pi pi-sign-out', color: 'var(--fst-cyan)',
    subject: 'ИК / УТ', object: 'Доля в Портфельной компании',
    entityType: 'session', phase: 'close',
    description: 'ИК-3 принял решение об инициации Выхода. Переход к ПП-5 для продажи доли.',
    causes: 'IC3_CONVENED',
    enables: ['EXIT_INITIATED'],
    reglamentRef: '3.6.1 пп.6 ДД',
  },
  EXIT_INITIATED: {
    id: 'EXIT_INITIATED', label: 'Выход из инвестиций инициирован',
    icon: 'pi pi-arrow-right-arrow-left', color: 'var(--fst-cyan)',
    subject: 'УТ', object: 'Покупатель доли',
    entityType: 'deal', phase: 'exit',
    description: 'УТ начал переговоры о продаже доли Товарищества. Документация по Выходу.',
    causes: 'IC3_DECISION_EXIT',
    enables: ['EXIT_LEGAL_CLOSING'],
    reglamentRef: '3.5 / 3.6.1 ДД',
  },
  EXIT_LEGAL_CLOSING: {
    id: 'EXIT_LEGAL_CLOSING', label: 'Юридическое закрытие Выхода',
    icon: 'pi pi-file-check', color: 'var(--fst-green)',
    subject: 'УТ + покупатель', object: 'Договор купли-продажи доли',
    entityType: 'deal', phase: 'exit',
    description: 'Подписаны договоры о передаче прав на долю Товарищества',
    causes: 'EXIT_INITIATED',
    enables: ['EXIT_FINANCIAL_CLOSING'],
    reglamentRef: '3.6.1 ДД',
  },
  EXIT_FINANCIAL_CLOSING: {
    id: 'EXIT_FINANCIAL_CLOSING', label: 'Финансовое закрытие Выхода (деньги получены)',
    icon: 'pi pi-money-bill', color: 'var(--fst-green)',
    subject: 'УТ', object: 'Товарищи-вкладчики',
    entityType: 'fund', phase: 'return',
    description: 'УТ получил денежные средства от продажи доли. Событие «Выход из инвестиций» — завершение ПП-6.',
    causes: 'EXIT_LEGAL_CLOSING',
    enables: ['DISTRIBUTION_MADE', 'EXIT_EVENT'],
    reglamentRef: '3.6.1 завершение',
  },
}

// ─── Единый реестр ────────────────────────────────────────────────────────────

// Добавляем entityType к SOFT_EVENT_TYPES (они описывают модули платформы)
const SOFT_EVENT_TYPES_TAGGED = Object.fromEntries(
  Object.entries(SOFT_EVENT_TYPES).map(([k, v]) => [k, { ...v, entityType: 'module' }])
)

// ─── Presentation / Live Demo events ─────────────────────────────────────────

export const PRESENT_EVENT_TYPES = {
  PRESENT_STEP: {
    id: 'PRESENT_STEP',
    label: 'Шаг презентации',
    icon: 'pi pi-play-circle',
    color: '#a78bfa',
    subject: 'Горин',
    object: 'Экран Пескова',
    entityType: 'session',
    phase: 'present',
  },
  PRESENT_STARTED: {
    id: 'PRESENT_STARTED',
    label: 'Презентация запущена',
    icon: 'pi pi-play',
    color: '#a78bfa',
    subject: 'Горин',
    object: 'Сессия',
    entityType: 'session',
    phase: 'present',
  },
  PRESENT_STOPPED: {
    id: 'PRESENT_STOPPED',
    label: 'Презентация завершена',
    icon: 'pi pi-stop',
    color: '#a78bfa',
    subject: 'Горин',
    object: 'Сессия',
    entityType: 'session',
    phase: 'present',
  },
}

// ─── Auth / Session events ────────────────────────────────────────────────────
export const AUTH_EVENT_TYPES = {
  USER_LOGGED_IN: {
    id: 'USER_LOGGED_IN', label: 'Вход в систему',
    icon: 'pi pi-sign-in', color: '#22c55e',
    subject: 'Пользователь', object: 'Сессия',
    entityType: 'session', phase: 'auth',
  },
  USER_LOGGED_OUT: {
    id: 'USER_LOGGED_OUT', label: 'Выход из системы',
    icon: 'pi pi-sign-out', color: '#f97316',
    subject: 'Пользователь', object: 'Сессия',
    entityType: 'session', phase: 'auth',
  },
  SESSION_EXPIRED: {
    id: 'SESSION_EXPIRED', label: 'Сессия истекла',
    icon: 'pi pi-clock', color: '#ef4444',
    subject: 'Система', object: 'Сессия',
    entityType: 'session', phase: 'auth',
  },
  SESSION_LOCKED: {
    id: 'SESSION_LOCKED', label: 'Экран заблокирован',
    icon: 'pi pi-lock', color: '#8b5cf6',
    subject: 'Система', object: 'Экран',
    entityType: 'session', phase: 'auth',
  },
}

export const EVENT_REGISTRY = {
  ...GR_EVENT_TYPES,
  ...PORTFOLIO_EVENT_TYPES,
  ...DEAL_EVENT_TYPES,
  ...COMMITTEE_EVENT_TYPES,
  ...FUND_EVENT_TYPES,
  ...STARTUPER_EVENT_TYPES,
  ...SOFT_EVENT_TYPES_TAGGED,
  ...EXPERT_EVENT_TYPES,
  ...FACTOR_EVENT_TYPES,
  ...REGLAMENT_EVENT_TYPES,
  ...PRESENT_EVENT_TYPES,
  ...AUTH_EVENT_TYPES,
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
  deal:    ['source', 'negotiate', 'dd', 'close', 'post-close', 'exit'],
  session: ['open', 'argue', 'negotiate', 'vote', 'close'],
  fund:    ['init', 'fundraise', 'deploy', 'monitor', 'return'],
  expert:  ['observe', 'question', 'argue', 'decide', 'learn', 'predict'],
  factor:  ['score', 'validate', 'impact', 'stress', 'compliance', 'monitor'],
  lead:    ['intake', 'research', 'scoring', 'submit'],
  module:  ['init', 'develop', 'test', 'fix', 'deploy', 'diagnose', 'maintain'],
}
