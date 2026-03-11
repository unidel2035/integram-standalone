/**
 * Platform State Service — вычисляет ПОЛНОЕ состояние платформы из eventStore
 *
 * Это мозг Command Center: одна функция `getPlatformState(eventStore)` возвращает
 * всё что происходит в фонде прямо сейчас — без UI, чисто из ленты событий + онтологии.
 */

import { CROSS_ENTITY_LINKS, ENTITY_TYPES } from './crossEntityReactor.js'
import { buildPipelineStages, getPipelineSummary, detectBlockers, SUBPROCESS_DEFS } from './pipelineService.js'
import { REGLAMENT_EVENT_TYPES } from '@/config/eventRegistry.js'

const DAY = 24 * 60 * 60 * 1000

// ─── Типы сущностей и их "линзы" (страницы) ─────────────────────────────────

export const ENTITY_LENSES = {
  deal:    { label: 'Сделка',          icon: 'pi pi-file-edit',      color: 'var(--fst-brand)',  path: '/fst-pipeline', phaseKey: 'pipelinePhase' },
  session: { label: 'ИК-сессия',       icon: 'pi pi-users',          color: 'var(--fst-purple)', path: '/fst-committee', phaseKey: 'phase' },
  company: { label: 'Портфель',        icon: 'pi pi-building',       color: 'var(--fst-cyan)',   path: '/fst-portfolio', phaseKey: 'risk' },
  fund:    { label: 'Фонд',            icon: 'pi pi-wallet',         color: 'var(--fst-green)',  path: '/fst-fund', phaseKey: 'nav' },
  project: { label: 'GR-проект',       icon: 'pi pi-building-columns', color: 'var(--fst-blue)', path: '/fst-gov', phaseKey: 'trl' },
  lead:    { label: 'Заявка стартапа', icon: 'pi pi-rocket',         color: 'var(--fst-purple)', path: '/fst-startuper', phaseKey: 'completeness' },
}

// ─── Вычислить состояние одной сущности ──────────────────────────────────────

function getEntityCard(entityType, entityId, eventStore) {
  const timeline = eventStore.getTimeline(entityType, entityId)
  if (!timeline.length) return null

  const state = eventStore.getState(entityType, entityId)
  const lastEvt = timeline.at(-1)
  const firstEvt = timeline[0]
  const lens = ENTITY_LENSES[entityType] || ENTITY_LENSES.deal

  // SLA / staleness
  const daysSinceLastEvent = Math.floor((Date.now() - lastEvt.ts) / DAY)
  const stale = daysSinceLastEvent >= 14
  const totalDays = Math.floor((Date.now() - firstEvt.ts) / DAY)

  // Alerts
  const alerts = []
  if (stale) alerts.push({ type: 'stale', message: `Нет активности ${daysSinceLastEvent} дней`, severity: 'warn' })

  // Для deal — вычисляем pipeline стадию
  let pipelineStage = null
  let nextActions = []
  if (entityType === 'deal') {
    const stages = buildPipelineStages(entityId, eventStore)
    pipelineStage = stages.find(s => s.status === 'active')
    const blockers = detectBlockers(stages)
    for (const b of blockers) alerts.push({ type: b.type, message: b.description, severity: b.severity })
    nextActions = pipelineStage?.nextPossible?.slice(0, 2) || []
  }

  // Для company — риск
  if (entityType === 'company' && state.risk === 'high') {
    alerts.push({ type: 'risk', message: 'Высокий риск', severity: 'error' })
  }

  // Для session — ожидание решения
  if (entityType === 'session' && state.phase === 'argue') {
    alerts.push({ type: 'pending', message: 'Ожидает решения ИК', severity: 'warn' })
  }

  // Urgency score: 0-100
  let urgency = 0
  if (alerts.some(a => a.severity === 'error')) urgency = 90
  else if (alerts.some(a => a.severity === 'warn')) urgency = 50
  else if (daysSinceLastEvent > 7) urgency = 30

  return {
    entityType,
    entityId,
    lens,
    state,
    lastEvt,
    firstEvt,
    totalDays,
    daysSinceLastEvent,
    stale,
    alerts,
    urgency,
    pipelineStage,
    nextActions,
    eventsCount: timeline.length,
  }
}

// ─── Полное состояние платформы ──────────────────────────────────────────────

/**
 * Главная функция: сканирует весь eventStore и возвращает полную картину.
 *
 * @param {Object} eventStore - useEventStore() instance
 * @returns {{ entities, crossLinks, alerts, summary }}
 */
export function getPlatformState(eventStore) {
  const entityCards = []

  // Собираем все известные (entityType, entityId) пары
  const allIds = {}
  for (const k of Object.keys(eventStore.timelines)) {
    const [type, ...idParts] = k.split(':')
    const id = idParts.join(':')
    if (!allIds[type]) allIds[type] = new Set()
    allIds[type].add(id)
  }

  // Вычисляем карточки для каждой сущности
  for (const [entityType, ids] of Object.entries(allIds)) {
    for (const entityId of ids) {
      const card = getEntityCard(entityType, entityId, eventStore)
      if (card) entityCards.push(card)
    }
  }

  // Сортируем по urgency (самые срочные вверху)
  entityCards.sort((a, b) => b.urgency - a.urgency)

  // Активные cross-entity связи
  const allOccurredTypes = new Set()
  for (const card of entityCards) {
    for (const e of eventStore.getTimeline(card.entityType, card.entityId)) {
      allOccurredTypes.add(e.type)
    }
  }

  const activeCrossLinks = CROSS_ENTITY_LINKS
    .filter(l => allOccurredTypes.has(l.trigger.eventType))
    .map(l => ({
      ...l,
      triggerDone: allOccurredTypes.has(l.trigger.eventType),
      enablesDone: allOccurredTypes.has(l.enables.eventType),
    }))

  // Глобальные алерты
  const globalAlerts = entityCards.flatMap(c => c.alerts.map(a => ({ ...a, card: c })))

  // Сводка
  const summary = {
    totalEntities: entityCards.length,
    criticalCount: globalAlerts.filter(a => a.severity === 'error').length,
    warnCount:     globalAlerts.filter(a => a.severity === 'warn').length,
    staleCount:    entityCards.filter(c => c.stale).length,
    dealsInWork:   entityCards.filter(c => c.entityType === 'deal').length,
    companiesActive: entityCards.filter(c => c.entityType === 'company').length,
    pendingIC:     entityCards.filter(c => c.entityType === 'session' && c.state?.phase !== 'closed').length,
  }

  return { entities: entityCards, crossLinks: activeCrossLinks, alerts: globalAlerts, summary }
}

// ─── AI Промпт для платформы ─────────────────────────────────────────────────

export async function getAIPlatformBriefing(platformState) {
  const ctx = {
    summary: platformState.summary,
    criticals: platformState.alerts.filter(a => a.severity === 'error').slice(0, 5).map(a => a.message),
    warnings: platformState.alerts.filter(a => a.severity === 'warn').slice(0, 5).map(a => a.message),
    activePipelineStage: platformState.entities
      .filter(e => e.entityType === 'deal' && e.pipelineStage)
      .map(e => `${e.entityId}: ${e.pipelineStage?.label} (${e.pipelineStage?.name})`),
  }

  const resp = await fetch('/api/ai-tokens/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId: 'deepseek/deepseek-chat',
      systemPrompt: `Ты — директор венчурного фонда ФСТ НТИ. Смотришь на сводку состояния фонда.
Дай краткий брифинг (3-5 предложений) + 3 приоритетных действия. Без воды, конкретно.`,
      prompt: `Состояние платформы:\n${JSON.stringify(ctx, null, 2)}`,
      application: 'CommandCenter',
    }),
  })
  const { response } = await resp.json()
  return response
}
