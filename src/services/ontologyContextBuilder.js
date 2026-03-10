/**
 * Ontology Context Builder — строит богатый контекст онтологии для AI-агентов
 *
 * Чистые функции, без импорта store'ов.
 * Предназначен для формирования system-prompt-ready контекстов
 * по состоянию любой сущности платформы VentureOS.
 *
 * Issue #184
 */

import { getEventDef, EVENT_REGISTRY } from '@/config/eventRegistry.js'
import { nextCrossEntityEvents, getUpstream, ENTITY_TYPES } from '@/services/crossEntityReactor.js'

// ─── Утилиты ──────────────────────────────────────────────────────────────────

/**
 * Вычислить количество дней между датой события и сейчас
 */
function daysSince(ts) {
  if (!ts) return null
  const ms = Date.now() - new Date(ts).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/**
 * Форматировать число дней в читаемую строку
 */
function formatDays(n) {
  if (n === null || n === undefined) return '?'
  if (n === 0) return 'сегодня'
  if (n === 1) return '1 день назад'
  if (n < 5) return `${n} дня назад`
  return `${n} дней назад`
}

// ─── Основные экспорты ────────────────────────────────────────────────────────

/**
 * Построить контекст сущности для передачи AI-агенту
 *
 * @param {string} entityType        — тип сущности (lead, session, deal, company, project, fund)
 * @param {string|number} entityId   — идентификатор сущности
 * @param {Array} timeline           — массив событий этой сущности [{ type, ts, data }]
 * @param {Object} allTimelines      — карта { entityType: { entityId: timeline } } всех сущностей
 * @param {Object} reducerState      — текущее состояние (из eventStore/reducer)
 * @returns {Object}
 */
export function buildEntityContext(entityType, entityId, timeline = [], allTimelines = {}, reducerState = null) {
  const entityMeta = ENTITY_TYPES[entityType] || { label: entityType, icon: '', color: '#888' }

  // Последние 10 событий с мета-данными из реестра
  const recentEvents = [...timeline]
    .slice(-10)
    .map(evt => {
      const def = getEventDef(evt.type)
      return {
        ...evt,
        label: def?.label ?? evt.type,
        icon:  def?.icon  ?? 'pi pi-circle',
        color: def?.color ?? '#888',
        daysAgo: daysSince(evt.ts),
      }
    })

  const lastEventRaw = timeline[timeline.length - 1] ?? null
  const lastEvent    = lastEventRaw ? getEventDef(lastEventRaw.type) : null

  // Следующие возможные события внутри той же сущности (из поля enables)
  const nextPossible = lastEvent?.enables
    ? lastEvent.enables
        .map(type => getEventDef(type))
        .filter(Boolean)
    : []

  // Cross-entity связи: что открывается в других сущностях
  const crossLinks = lastEventRaw
    ? nextCrossEntityEvents({ entityType, type: lastEventRaw.type, data: lastEventRaw.data ?? {} })
    : []

  // Upstream-цепочка: что должно произойти ДО первого события таймлайна
  const firstEventType = timeline[0]?.type ?? null
  const upstreamChain  = firstEventType
    ? getUpstream(entityType, firstEventType)
    : []

  const totalEvents      = timeline.length
  const daysSinceLastEvt = lastEventRaw ? daysSince(lastEventRaw.ts) : null

  return {
    entityType,
    entityId,
    entityLabel:        entityMeta.label,
    currentState:       reducerState,
    recentEvents,
    lastEvent,
    nextPossible,
    crossLinks,
    upstreamChain,
    totalEvents,
    daysSinceLastEvent: daysSinceLastEvt,
    phase:              reducerState?.phase ?? lastEvent?.phase ?? null,
  }
}

/**
 * Форматировать контекст сущности в строку для system-prompt AI-агента (рус.)
 *
 * @param {Object} ctx — результат buildEntityContext()
 * @returns {string}
 */
export function buildContextPrompt(ctx) {
  const {
    entityLabel, entityType, entityId,
    phase, lastEvent, daysSinceLastEvent,
    totalEvents, recentEvents,
    nextPossible, crossLinks, currentState,
  } = ctx

  const lines = []

  lines.push(`Сущность: ${entityLabel} (${entityType}:${entityId})`)
  lines.push(`Фаза: ${phase ?? 'неизвестна'}`)

  if (lastEvent) {
    lines.push(`Последнее событие: ${lastEvent.label} (${formatDays(daysSinceLastEvent)})`)
  } else {
    lines.push('Последнее событие: нет данных')
  }

  lines.push('')
  lines.push(`История (${totalEvents} событий):`)
  if (recentEvents.length === 0) {
    lines.push('  — нет событий')
  } else {
    for (const evt of recentEvents) {
      lines.push(`  - ${evt.label} (${formatDays(evt.daysAgo)})`)
    }
  }

  if (nextPossible.length > 0) {
    lines.push('')
    lines.push('Следующие шаги внутри:')
    for (const evt of nextPossible) {
      const subj = evt.subject ? `${evt.subject} → ${evt.object}` : evt.id
      lines.push(`  - ${evt.label} (${subj})`)
    }
  }

  if (crossLinks.length > 0) {
    lines.push('')
    lines.push('Это затронет:')
    for (const link of crossLinks) {
      const targetMeta = ENTITY_TYPES[link.enables.entityType]
      const entityName = targetMeta?.label ?? link.enables.entityType
      const enablesDef = getEventDef(link.enables.eventType)
      const evtLabel   = enablesDef?.label ?? link.enables.eventType
      lines.push(`  - ${entityName}: ${evtLabel} (${link.cardinality ?? '1:1'})`)
    }
  }

  if (currentState && Object.keys(currentState).length > 0) {
    lines.push('')
    lines.push('Текущее состояние:')
    lines.push(JSON.stringify(currentState, null, 2))
  }

  return lines.join('\n')
}

/**
 * Построить портфельный контекст для AI-запросов уровня всего портфеля
 *
 * @param {Array} companiesData — [{ entityType, entityId, timeline, state }]
 * @returns {string}
 */
export function buildPortfolioContext(companiesData = []) {
  if (companiesData.length === 0) {
    return 'Портфель: нет данных о компаниях.'
  }

  const lines = []
  lines.push(`Портфель фонда: ${companiesData.length} компаний\n`)

  for (const item of companiesData) {
    const ctx = buildEntityContext(
      item.entityType,
      item.entityId,
      item.timeline  ?? [],
      {},
      item.state     ?? null,
    )

    const lastEvtLabel = ctx.lastEvent?.label ?? 'нет событий'
    const phaseStr     = ctx.phase ? ` | фаза: ${ctx.phase}` : ''
    const daysStr      = ctx.daysSinceLastEvent !== null
      ? ` | посл. событие: ${formatDays(ctx.daysSinceLastEvent)}`
      : ''

    lines.push(
      `[${ctx.entityLabel} #${ctx.entityId}]${phaseStr}${daysStr}` +
      ` | ${ctx.totalEvents} событий | последнее: ${lastEvtLabel}`
    )

    if (ctx.crossLinks.length > 0) {
      for (const link of ctx.crossLinks) {
        const targetMeta = ENTITY_TYPES[link.enables.entityType]
        const targetName = targetMeta?.label ?? link.enables.entityType
        const enablesDef = getEventDef(link.enables.eventType)
        const evtLabel   = enablesDef?.label ?? link.enables.eventType
        lines.push(`  → ожидается: ${targetName} / ${evtLabel}`)
      }
    }
  }

  return lines.join('\n')
}
