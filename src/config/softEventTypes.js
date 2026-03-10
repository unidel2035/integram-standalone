/**
 * Software Event Ontology — VentureOS мониторит само себя
 *
 * Каждый модуль платформы существует как лента событий.
 * Состояние = проекция ленты. Следующие шаги = что нужно сделать дальше.
 *
 * Применяем тот же подход что и grEventTypes.js — но к самому ПО.
 */

export const SOFT_EVENT_TYPES = {

  // ─── Жизненный цикл модуля ────────────────────────────────────────────────

  MODULE_BORN: {
    id: 'MODULE_BORN',
    label: 'Модуль создан',
    icon: 'pi pi-sparkles',
    color: '#64748b',
    subject: 'Разработчик',
    object: 'Модуль',
    description: 'Создан новый модуль платформы — точка отсчёта ленты',
    preconditions: [],
    enables: ['FEATURE_ADDED', 'EVENT_CONNECTED', 'AI_CONNECTED', 'DEPLOYED'],
    phase: 'init',
    gap: null,
  },

  FEATURE_ADDED: {
    id: 'FEATURE_ADDED',
    label: 'Фича добавлена',
    icon: 'pi pi-plus-circle',
    color: '#3b82f6',
    subject: 'Разработчик',
    object: 'Модуль',
    description: 'В модуль добавлена новая функциональность',
    preconditions: ['MODULE_BORN'],
    enables: ['TEST_ADDED', 'BUG_FOUND', 'REFACTOR_DONE'],
    phase: 'develop',
    gap: null,
  },

  // ─── Архитектурные улучшения ──────────────────────────────────────────────

  EVENT_CONNECTED: {
    id: 'EVENT_CONNECTED',
    label: 'EventStore подключён',
    icon: 'pi pi-link',
    color: '#10b981',
    subject: 'Разработчик',
    object: 'eventStore',
    description: 'Модуль записывает события в eventStore — состояние персистентно в Integram',
    preconditions: ['MODULE_BORN'],
    enables: ['INTEGRATION_ADDED', 'GAP_CLOSED'],
    phase: 'develop',
    gap: 'no_event_store',
  },

  AI_CONNECTED: {
    id: 'AI_CONNECTED',
    label: 'AI подключён',
    icon: 'pi pi-microchip-ai',
    color: '#f59e0b',
    subject: 'Разработчик',
    object: '/api/ai-tokens/chat',
    description: 'Модуль вызывает AI через token-router — добавляет интеллект к UX',
    preconditions: ['MODULE_BORN'],
    enables: ['FEATURE_ADDED'],
    phase: 'develop',
    gap: 'no_ai',
  },

  STORE_CONNECTED: {
    id: 'STORE_CONNECTED',
    label: 'Pinia Store подключён',
    icon: 'pi pi-database',
    color: '#6366f1',
    subject: 'Разработчик',
    object: 'Pinia',
    description: 'Модуль использует Pinia store для реактивного состояния',
    preconditions: ['MODULE_BORN'],
    enables: ['INTEGRATION_ADDED'],
    phase: 'develop',
    gap: null,
  },

  INTEGRATION_ADDED: {
    id: 'INTEGRATION_ADDED',
    label: 'Интеграция добавлена',
    icon: 'pi pi-arrows-alt',
    color: '#a855f7',
    subject: 'Разработчик',
    object: 'Модуль → Модуль',
    description: 'Установлена событийная связь между двумя модулями через shared store',
    preconditions: ['EVENT_CONNECTED'],
    enables: ['FEATURE_ADDED'],
    phase: 'develop',
    gap: null,
  },

  // ─── Качество ─────────────────────────────────────────────────────────────

  TEST_ADDED: {
    id: 'TEST_ADDED',
    label: 'Тест написан',
    icon: 'pi pi-check-square',
    color: '#22c55e',
    subject: 'Разработчик',
    object: 'Тест-сьют',
    description: 'Написан автоматический тест для модуля',
    preconditions: ['FEATURE_ADDED'],
    enables: ['TEST_PASSED'],
    phase: 'test',
    gap: 'no_tests',
  },

  TEST_PASSED: {
    id: 'TEST_PASSED',
    label: 'Тест прошёл',
    icon: 'pi pi-verified',
    color: '#4ade80',
    subject: 'CI',
    object: 'Тест',
    description: 'Автотест пройден — модуль надёжен',
    preconditions: ['TEST_ADDED'],
    enables: ['DEPLOYED'],
    phase: 'test',
    gap: null,
  },

  BUG_FOUND: {
    id: 'BUG_FOUND',
    label: 'Баг обнаружен',
    icon: 'pi pi-exclamation-triangle',
    color: '#ef4444',
    subject: 'Тест / Пользователь',
    object: 'Модуль',
    description: 'Обнаружена ошибка в поведении модуля',
    preconditions: ['FEATURE_ADDED'],
    enables: ['BUG_FIXED'],
    phase: 'test',
    gap: 'open_bugs',
  },

  BUG_FIXED: {
    id: 'BUG_FIXED',
    label: 'Баг исправлен',
    icon: 'pi pi-wrench',
    color: '#fb923c',
    subject: 'Разработчик',
    object: 'Модуль',
    description: 'Ошибка исправлена',
    preconditions: ['BUG_FOUND'],
    enables: ['TEST_ADDED'],
    phase: 'fix',
    gap: null,
  },

  REFACTOR_DONE: {
    id: 'REFACTOR_DONE',
    label: 'Рефакторинг',
    icon: 'pi pi-cog',
    color: '#94a3b8',
    subject: 'Разработчик',
    object: 'Модуль',
    description: 'Код модуля упрощён / переработан без изменения поведения',
    preconditions: ['FEATURE_ADDED'],
    enables: ['TEST_ADDED'],
    phase: 'maintain',
    gap: null,
  },

  // ─── Деплой ────────────────────────────────────────────────────────────────

  DEPLOYED: {
    id: 'DEPLOYED',
    label: 'Задеплоено',
    icon: 'pi pi-cloud-upload',
    color: '#0ea5e9',
    subject: 'DevOps',
    object: 'ai2fund.ru',
    description: 'Модуль развёрнут в production-среде',
    preconditions: ['MODULE_BORN'],
    enables: ['FEATURE_ADDED'],
    phase: 'deploy',
    gap: null,
  },

  // ─── Диагностика ──────────────────────────────────────────────────────────

  COVERAGE_GAP: {
    id: 'COVERAGE_GAP',
    label: 'Gap обнаружен',
    icon: 'pi pi-search',
    color: '#fbbf24',
    subject: 'Архитектор',
    object: 'Модуль',
    description: 'Обнаружен пробел в покрытии: нет тестов, eventStore или AI',
    preconditions: ['MODULE_BORN'],
    enables: ['TEST_ADDED', 'EVENT_CONNECTED', 'AI_CONNECTED'],
    phase: 'diagnose',
    gap: null,
  },

  GAP_CLOSED: {
    id: 'GAP_CLOSED',
    label: 'Gap закрыт',
    icon: 'pi pi-check-circle',
    color: '#4ade80',
    subject: 'Разработчик',
    object: 'Gap',
    description: 'Архитектурный пробел устранён',
    preconditions: ['COVERAGE_GAP'],
    enables: ['FEATURE_ADDED'],
    phase: 'fix',
    gap: null,
  },
}

// ─── Типы пробелов ────────────────────────────────────────────────────────────

export const SOFT_GAP_TYPES = {
  no_event_store: {
    id: 'no_event_store',
    label: 'Нет EventStore',
    icon: 'pi pi-link',
    color: '#ef4444',
    severity: 'critical',
    fix: 'EVENT_CONNECTED',
    description: 'Модуль не записывает события — состояние теряется при перезагрузке',
  },
  no_tests: {
    id: 'no_tests',
    label: 'Нет тестов',
    icon: 'pi pi-check-square',
    color: '#fbbf24',
    severity: 'high',
    fix: 'TEST_ADDED',
    description: 'Нет автоматических тестов — регрессии находит только продакшн',
  },
  no_ai: {
    id: 'no_ai',
    label: 'Нет AI',
    icon: 'pi pi-microchip-ai',
    color: '#f59e0b',
    severity: 'medium',
    fix: 'AI_CONNECTED',
    description: 'Модуль не использует AI — упущена ключевая ценность платформы',
  },
  open_bugs: {
    id: 'open_bugs',
    label: 'Открытые баги',
    icon: 'pi pi-exclamation-triangle',
    color: '#ef4444',
    severity: 'critical',
    fix: 'BUG_FIXED',
    description: 'Незакрытые ошибки снижают надёжность и доверие пользователей',
  },
}

// ─── Фазы ─────────────────────────────────────────────────────────────────────

export const SOFT_PHASES = [
  { id: 'init',     label: 'Рождение',     icon: 'pi pi-sparkles',     color: '#64748b' },
  { id: 'develop',  label: 'Разработка',   icon: 'pi pi-code',         color: '#3b82f6' },
  { id: 'test',     label: 'Тестирование', icon: 'pi pi-check-square', color: '#22c55e' },
  { id: 'fix',      label: 'Исправление',  icon: 'pi pi-wrench',       color: '#fb923c' },
  { id: 'deploy',   label: 'Деплой',       icon: 'pi pi-cloud-upload', color: '#0ea5e9' },
  { id: 'diagnose', label: 'Диагностика',  icon: 'pi pi-search',       color: '#fbbf24' },
  { id: 'maintain', label: 'Поддержка',    icon: 'pi pi-cog',          color: '#94a3b8' },
]
