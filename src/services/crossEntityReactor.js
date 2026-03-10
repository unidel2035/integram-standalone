/**
 * Cross-Entity Reactor — граф связей между сущностями разных типов
 *
 * Проблема: eventRegistry.js описывает что МОЖЕТ произойти внутри одного entityType.
 * Но цепочка платформы пересекает границы:
 *   lead.SENT_TO_IC     → session.SESSION_STARTED
 *   session.DECISION_MADE → deal.TERM_SHEET_PROPOSED
 *   deal.DEAL_CLOSED    → company.COMPANY_ADDED
 *   lead.GRANTS_MATCHED → project.PROJECT_STARTED  (GR-цепочка)
 *
 * Этот файл делает эти связи явными и запрашиваемыми.
 *
 * API:
 *   nextCrossEntityEvents(event)  → какие cross-entity события открываются
 *   fullChain()                   → весь граф в виде { nodes, edges }
 *   getUpstream(entityType, eventType) → что должно произойти ДО
 *   getDownstream(entityType, eventType) → что происходит ПОСЛЕ
 */

// ─── Граф cross-entity связей ─────────────────────────────────────────────────

export const CROSS_ENTITY_LINKS = [
  // Фаза 0: Поиск → Оценка
  {
    id: 'lead→session',
    trigger:      { entityType: 'lead',    eventType: 'SENT_TO_IC' },
    enables:      { entityType: 'session', eventType: 'SESSION_STARTED' },
    label:        'Заявка в ИК → Открытие сессии',
    description:  'После отправки заявки стартапером ИК получает новую сессию',
    cardinality:  '1:1',
    condition:    null,
  },

  // Фаза 0: Поиск → GR-план
  {
    id: 'lead→project',
    trigger:      { entityType: 'lead',    eventType: 'GRANTS_MATCHED' },
    enables:      { entityType: 'project', eventType: 'PROJECT_STARTED' },
    label:        'Гранты подобраны → Запуск GR-проекта',
    description:  'Стартап переходит в GR-трек параллельно с ИК',
    cardinality:  '1:1',
    condition:    null,
  },

  // Фаза 1: Оценка → Структурирование
  {
    id: 'session→deal:approve',
    trigger:      { entityType: 'session', eventType: 'DECISION_MADE' },
    enables:      { entityType: 'deal',    eventType: 'TERM_SHEET_PROPOSED' },
    label:        'Решение ИК → Term Sheet',
    description:  'При APPROVE или CONDITIONAL ИК открывает сделку',
    cardinality:  '1:1',
    condition:    { field: 'verdict', values: ['APPROVE', 'CONDITIONAL'] },
  },

  // Фаза 2: Структурирование → Постинвест
  {
    id: 'deal→company',
    trigger:      { entityType: 'deal',    eventType: 'DEAL_CLOSED' },
    enables:      { entityType: 'company', eventType: 'COMPANY_ADDED' },
    label:        'Сделка закрыта → Компания в портфеле',
    description:  'После закрытия сделки компания появляется в портфельном мониторе',
    cardinality:  '1:1',
    condition:    null,
  },

  // Фаза 3: Транши → KPI
  {
    id: 'deal→company:tranche',
    trigger:      { entityType: 'deal',    eventType: 'TRANCHE_RELEASED' },
    enables:      { entityType: 'company', eventType: 'KPI_UPDATED' },
    label:        'Транш выплачен → Обновление KPI',
    description:  'Получение транша инициирует сверку KPI по условиям сделки',
    cardinality:  '1:N',
    condition:    null,
  },

  // Фаза 3: Постинвест → Фонд
  {
    id: 'deal→fund',
    trigger:      { entityType: 'deal',    eventType: 'DEAL_CLOSED' },
    enables:      { entityType: 'fund',    eventType: 'CAPITAL_CALLED' },
    label:        'Сделка закрыта → Capital Call',
    description:  'Закрытие сделки инициирует drawdown из фонда',
    cardinality:  '1:1',
    condition:    null,
  },

  // Фаза 4: Мониторинг → Выход
  {
    id: 'company→deal:exit',
    trigger:      { entityType: 'company', eventType: 'EXIT_EVENT' },
    enables:      { entityType: 'deal',    eventType: 'CONDITION_FULFILLED' },
    label:        'Выход компании → Условие ИК выполнено',
    description:  'При успешном exit закрываются все условия инвестиционного решения',
    cardinality:  '1:N',
    condition:    null,
  },

  // Фаза 5: NAV → Фонд-индекс
  {
    id: 'company→fund:nav',
    trigger:      { entityType: 'company', eventType: 'ROUND_OPENED' },
    enables:      { entityType: 'fund',    eventType: 'NAV_UPDATED' },
    label:        'Новый раунд компании → Пересчёт NAV фонда',
    description:  'Оценка компании меняется → необходимо обновить NAV субфонда',
    cardinality:  '1:1',
    condition:    null,
  },

  // GR: мера одобрена → TRL проекта растёт → компания улучшается
  {
    id: 'project→company:trl',
    trigger:      { entityType: 'project', eventType: 'MEASURE_FUNDED' },
    enables:      { entityType: 'company', eventType: 'KPI_UPDATED' },
    label:        'GR-мера получена → KPI компании',
    description:  'Грант/субсидия влияет на TRL и финансовые показатели компании',
    cardinality:  '1:1',
    condition:    null,
  },
]

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Для данного события — какие cross-entity события оно открывает?
 *
 * @param {Object} event - { entityType, type, data }
 * @returns {CrossEntityLink[]} — отфильтрованные и обогащённые
 */
export function nextCrossEntityEvents(event) {
  return CROSS_ENTITY_LINKS.filter(link => {
    if (link.trigger.entityType !== event.entityType) return false
    if (link.trigger.eventType  !== event.type)       return false
    if (link.condition) {
      const { field, values } = link.condition
      if (!values.includes(event.data?.[field]))       return false
    }
    return true
  })
}

/**
 * Получить все upstream-связи: что должно произойти ПЕРЕД данным событием
 *
 * @param {string} entityType
 * @param {string} eventType
 * @returns {CrossEntityLink[]}
 */
export function getUpstream(entityType, eventType) {
  return CROSS_ENTITY_LINKS.filter(
    l => l.enables.entityType === entityType && l.enables.eventType === eventType
  )
}

/**
 * Получить все downstream-связи: что ПОСЛЕ данного события
 *
 * @param {string} entityType
 * @param {string} eventType
 * @returns {CrossEntityLink[]}
 */
export function getDownstream(entityType, eventType) {
  return CROSS_ENTITY_LINKS.filter(
    l => l.trigger.entityType === entityType && l.trigger.eventType === eventType
  )
}

/**
 * Полный граф платформы в формате { nodes, edges } для визуализации
 */
export function fullChain() {
  const nodeMap = new Map()

  // Собираем уникальные узлы
  for (const link of CROSS_ENTITY_LINKS) {
    const fromKey = `${link.trigger.entityType}::${link.trigger.eventType}`
    const toKey   = `${link.enables.entityType}::${link.enables.eventType}`

    if (!nodeMap.has(fromKey)) {
      nodeMap.set(fromKey, {
        id:         fromKey,
        entityType: link.trigger.entityType,
        eventType:  link.trigger.eventType,
        label:      `${link.trigger.entityType} / ${link.trigger.eventType}`,
      })
    }
    if (!nodeMap.has(toKey)) {
      nodeMap.set(toKey, {
        id:         toKey,
        entityType: link.enables.entityType,
        eventType:  link.enables.eventType,
        label:      `${link.enables.entityType} / ${link.enables.eventType}`,
      })
    }
  }

  const nodes = [...nodeMap.values()]
  const edges = CROSS_ENTITY_LINKS.map(link => ({
    id:          link.id,
    from:        `${link.trigger.entityType}::${link.trigger.eventType}`,
    to:          `${link.enables.entityType}::${link.enables.eventType}`,
    label:       link.label,
    condition:   link.condition,
    cardinality: link.cardinality,
  }))

  return { nodes, edges }
}

/**
 * Валидация: найти "висячие" связи — где целевой eventType не существует в EVENT_REGISTRY
 */
export function validateLinks(eventRegistry) {
  const problems = []
  for (const link of CROSS_ENTITY_LINKS) {
    if (!eventRegistry[link.trigger.eventType]) {
      problems.push({ link, issue: `trigger event ${link.trigger.eventType} not in registry` })
    }
    if (!eventRegistry[link.enables.eventType]) {
      problems.push({ link, issue: `enables event ${link.enables.eventType} not in registry` })
    }
  }
  return problems
}

// ─── Карта entity-типов платформы ─────────────────────────────────────────────

export const ENTITY_TYPES = {
  lead:    { label: 'Стартапер',    icon: 'pi pi-rocket',         color: '#6366f1', path: '/fst-startuper' },
  session: { label: 'ИК-сессия',   icon: 'pi pi-users',          color: '#a78bfa', path: '/fst-committee' },
  deal:    { label: 'Сделка',      icon: 'pi pi-file-edit',      color: '#fb923c', path: '/fst-deal' },
  company: { label: 'Компания',    icon: 'pi pi-building',       color: '#22d3ee', path: '/fst-portfolio' },
  project: { label: 'GR-проект',   icon: 'pi pi-building-columns', color: '#f59e0b', path: '/fst-gov' },
  fund:    { label: 'Фонд',        icon: 'pi pi-wallet',         color: '#4ade80', path: '/fst-fund' },
  module:  { label: 'Модуль ПО',  icon: 'pi pi-sitemap',        color: '#a855f7', path: '/fst-soft-model' },
}
