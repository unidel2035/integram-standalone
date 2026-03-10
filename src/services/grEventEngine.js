/**
 * GR Event Engine — движок событийной онтологии
 *
 * проект существует как лента событий.
 * Состояние = проекция ленты. Будущее = возможные следующие события.
 *
 * API:
 *   projectState(events)              → текущее состояние проекта
 *   nextPossibleEvents(events, measures) → что может произойти дальше
 *   counterfactual(events, removeId)  → «что если бы события X не было?»
 *   causeChain(events, eventId)       → почему это событие стало возможным
 */

import { GR_EVENT_TYPES } from '@/config/grEventTypes.js'

// ─── Проекция: из ленты событий → текущее состояние ──────────────────────────

export function projectState(events = []) {
  return events.reduce((state, evt) => {
    switch (evt.type) {
      case 'PROJECT_STARTED':
        return {
          ...state,
          trl: evt.data?.trl || 1,
          sector: evt.data?.sector || 'БАС',
          stage: evt.data?.stage || 'Pre-seed',
          started: evt.ts,
        }

      case 'TRL_ADVANCED':
        return { ...state, trl: evt.data?.to ?? (state.trl + 1) }

      case 'MEASURE_FUNDED':
        return {
          ...state,
          totalFunding: (state.totalFunding || 0) + (evt.data?.amount || 0),
          fundedMeasures: [...(state.fundedMeasures || []), evt.data?.measure],
        }

      case 'MEASURE_APPLIED':
        return {
          ...state,
          appliedMeasures: [...(state.appliedMeasures || []), evt.data?.measure],
        }

      case 'MEASURE_APPROVED':
        return {
          ...state,
          approvedMeasures: [...(state.approvedMeasures || []), evt.data?.measure],
        }

      case 'CERTIFICATION_OBTAINED':
        return { ...state, certified: true, certType: evt.data?.certType }

      case 'CONTRACT_SIGNED':
        return { ...state, hasContract: true, contractAmount: evt.data?.amount }

      case 'PILOT_COMPLETED':
        return { ...state, pilotDone: true }

      case 'SCALE_READY':
        return { ...state, scaleReady: true }

      case 'MARKET_FAILURE_DETECTED':
        return { ...state, triggers: [...(state.triggers || []), 'market_failure'] }

      case 'TECH_GAP_DETECTED':
        return { ...state, triggers: [...(state.triggers || []), 'tech_gap'] }

      case 'REGULATORY_BARRIER_DETECTED':
        return { ...state, triggers: [...(state.triggers || []), 'regulatory_barrier'] }

      case 'INFRA_GAP_DETECTED':
        return { ...state, triggers: [...(state.triggers || []), 'infrastructure_gap'] }

      default:
        return state
    }
  }, { trl: 1, sector: 'БАС', totalFunding: 0, fundedMeasures: [], appliedMeasures: [], approvedMeasures: [], triggers: [] })
}

// ─── Возможные следующие события ─────────────────────────────────────────────

/**
 * Вычислить следующие возможные события для проекта
 *
 * @param {Event[]} events - лента событий проекта
 * @param {Measure[]} measures - каталог мер (из grMeasuresData.js)
 * @returns {PossibleEvent[]}
 *
 * PossibleEvent = {
 *   type: string,              // тип события
 *   eventDef: EventType,       // определение из GR_EVENT_TYPES
 *   measure?: Measure,         // если это MEASURE_APPLIED
 *   probability: 'high'|'medium'|'low',
 *   reason: string,            // почему это событие возможно
 *   blockedBy?: string[],      // что мешает (если partially-blocked)
 * }
 */
export function nextPossibleEvents(events = [], measures = []) {
  const state = projectState(events)
  const eventTypes = new Set(events.map(e => e.type))
  const possible = []

  // 1. Диагностические события (можно выявить провалы)
  const diagnostics = ['MARKET_FAILURE_DETECTED', 'TECH_GAP_DETECTED', 'REGULATORY_BARRIER_DETECTED', 'INFRA_GAP_DETECTED']
  for (const diagId of diagnostics) {
    if (!eventTypes.has(diagId) && eventTypes.has('PROJECT_STARTED')) {
      const def = GR_EVENT_TYPES[diagId]
      possible.push({
        type: diagId,
        eventDef: def,
        probability: _diagProbability(diagId, state),
        reason: def.description,
      })
    }
  }

  // 2. Меры — можно подать заявку если:
  //    - ещё не подана
  //    - TRL в диапазоне
  //    - сектор совпадает
  //    - выявлен нужный триггер
  const applied = new Set(events.filter(e => e.type === 'MEASURE_APPLIED').map(e => e.data?.measure))

  for (const m of measures) {
    if (m.status === 'closed') continue
    if (applied.has(m.id)) continue

    const trlOk = state.trl >= (m.trl_min || 1) && state.trl <= (m.trl_max || 9)
    const sectorOk = _sectorOk(m, state.sector)
    const triggerMatch = m.triggers?.some(t => (state.triggers || []).includes(t))

    if (trlOk && sectorOk) {
      possible.push({
        type: 'MEASURE_APPLIED',
        eventDef: GR_EVENT_TYPES.MEASURE_APPLIED,
        measure: m,
        probability: triggerMatch ? 'high' : (state.triggers?.length ? 'medium' : 'low'),
        reason: triggerMatch
          ? `TRL ${state.trl} ∈ [${m.trl_min}–${m.trl_max}] + выявленный триггер`
          : `TRL ${state.trl} ∈ [${m.trl_min}–${m.trl_max}]`,
      })
    } else if (!trlOk && sectorOk) {
      // Заблокировано TRL — показываем как "скоро"
      const gap = state.trl < (m.trl_min || 1)
        ? `нужен TRL ${m.trl_min} (сейчас ${state.trl})`
        : `TRL уже выше ${m.trl_max}`
      possible.push({
        type: 'MEASURE_APPLIED',
        eventDef: GR_EVENT_TYPES.MEASURE_APPLIED,
        measure: m,
        probability: 'blocked',
        reason: gap,
        blockedBy: ['TRL_ADVANCED'],
      })
    }
  }

  // 3. Результирующие события
  const funded = events.some(e => e.type === 'MEASURE_FUNDED')
  const pilotDone = eventTypes.has('PILOT_COMPLETED')
  const trlAdv = eventTypes.has('TRL_ADVANCED')

  if (funded && !trlAdv) {
    possible.push({ type: 'TRL_ADVANCED', eventDef: GR_EVENT_TYPES.TRL_ADVANCED, probability: 'high', reason: 'Есть финансирование' })
  }
  if (funded && !eventTypes.has('PILOT_LAUNCHED')) {
    possible.push({ type: 'PILOT_LAUNCHED', eventDef: GR_EVENT_TYPES.PILOT_LAUNCHED, probability: 'medium', reason: 'Есть финансирование' })
  }
  if (eventTypes.has('PILOT_LAUNCHED') && !pilotDone) {
    possible.push({ type: 'PILOT_COMPLETED', eventDef: GR_EVENT_TYPES.PILOT_COMPLETED, probability: 'medium', reason: 'Пилот запущен' })
  }
  if (pilotDone && !eventTypes.has('CONTRACT_SIGNED')) {
    possible.push({ type: 'CONTRACT_SIGNED', eventDef: GR_EVENT_TYPES.CONTRACT_SIGNED, probability: 'medium', reason: 'Пилот завершён' })
  }
  if (eventTypes.has('CONTRACT_SIGNED') && trlAdv && !eventTypes.has('SCALE_READY')) {
    possible.push({ type: 'SCALE_READY', eventDef: GR_EVENT_TYPES.SCALE_READY, probability: 'high', reason: 'Контракт + TRL рост' })
  }

  // Сортируем: high → medium → low → blocked
  const order = { high: 0, medium: 1, low: 2, blocked: 3 }
  return possible.sort((a, b) => (order[a.probability] ?? 99) - (order[b.probability] ?? 99))
}

// ─── Контрфактичный анализ ────────────────────────────────────────────────────

/**
 * «Что если бы события X не было?»
 * Убираем событие из ленты и пересчитываем состояние и возможности
 */
export function counterfactual(events, removeEventId, measures) {
  const withoutEvent = events.filter(e => e.id !== removeEventId)
  const altState = projectState(withoutEvent)
  const altPossible = nextPossibleEvents(withoutEvent, measures)
  const realState = projectState(events)

  return {
    removedEvent: events.find(e => e.id === removeEventId),
    alternativeState: altState,
    currentState: realState,
    diff: {
      trlDelta: realState.trl - altState.trl,
      fundingDelta: (realState.totalFunding || 0) - (altState.totalFunding || 0),
      newPossibilities: altPossible.filter(p =>
        !nextPossibleEvents(events, measures).find(r => r.type === p.type && r.measure?.id === p.measure?.id)
      ),
      lostPossibilities: nextPossibleEvents(events, measures).filter(p =>
        !altPossible.find(r => r.type === p.type && r.measure?.id === p.measure?.id)
      ),
    },
  }
}

// ─── Цепь причин ─────────────────────────────────────────────────────────────

/**
 * Почему событие стало возможным — цепочка причин
 */
export function causeChain(events, eventId) {
  const evt = events.find(e => e.id === eventId)
  if (!evt) return null

  const def = GR_EVENT_TYPES[evt.type]
  if (!def) return { event: evt, causes: [] }

  const causes = (def.preconditions || [])
    .map(precId => events.findLast(e => e.type === precId))
    .filter(Boolean)
    .map(causeEvt => causeChain(events, causeEvt.id))

  return { event: evt, eventDef: def, causes }
}

// ─── Статистика ленты ─────────────────────────────────────────────────────────

export function timelineStats(events) {
  const state = projectState(events)
  const funded = events.filter(e => e.type === 'MEASURE_FUNDED')
  const approved = events.filter(e => e.type === 'MEASURE_APPROVED')
  const applied = events.filter(e => e.type === 'MEASURE_APPLIED')
  const rejected = events.filter(e => e.type === 'MEASURE_REJECTED')

  return {
    totalEvents: events.length,
    trlProgress: state.trl,
    totalFunding: state.totalFunding || 0,
    measuresApplied: applied.length,
    measuresApproved: approved.length,
    measuresFunded: funded.length,
    measuresRejected: rejected.length,
    approvalRate: applied.length ? ((approved.length / applied.length) * 100).toFixed(0) + '%' : '—',
    triggersFound: (state.triggers || []).length,
    hasPilot: events.some(e => e.type === 'PILOT_COMPLETED'),
    hasContract: state.hasContract || false,
    isScaleReady: state.scaleReady || false,
  }
}

// ─── Субъекты и интерфейсы ────────────────────────────────────────────────────

/**
 * Роли субъектов и какие типы событий они фиксируют
 * Субъект — тот, кто видит событие. Один субъект ≠ один человек.
 */
export const SUBJECT_ROLES = {
  team:      { label: 'Команда',    color: '#3b82f6', icon: 'pi pi-users',    keywords: ['Команда', 'Основатели'] },
  fund:      { label: 'Фонд / AI', color: '#f59e0b', icon: 'pi pi-star',     keywords: ['Фонд', 'Аналитик', 'AI-агент', 'НТИ'] },
  operator:  { label: 'Оператор',   color: '#22c55e', icon: 'pi pi-building', keywords: ['Оператор', 'Банк', 'Росавиация', 'Минпромторг'] },
  regulator: { label: 'Регулятор',  color: '#8b5cf6', icon: 'pi pi-shield',   keywords: ['Минпромторг', 'Минтранс', 'Росавиация', 'Правительство', 'Лаборатория'] },
}

/**
 * Интерфейсы — границы между субъектами, где пересекаются события.
 * Событие всегда пересекает ровно один интерфейс.
 */
export const GR_INTERFACES = [
  {
    id: 'team-operator',
    from: 'team', to: 'operator',
    label: 'Заявка / Решение',
    color: '#3b82f6',
    events: ['MEASURE_APPLIED', 'MEASURE_APPROVED', 'MEASURE_REJECTED', 'MEASURE_FUNDED'],
    description: 'Команда подаёт заявки, оператор принимает решения. Ключевой интерфейс GR.',
  },
  {
    id: 'project-market',
    from: 'team', to: 'regulator',
    label: 'Рынок / Технология',
    color: '#ef4444',
    events: ['MARKET_FAILURE_DETECTED', 'TECH_GAP_DETECTED', 'PILOT_LAUNCHED', 'PILOT_COMPLETED', 'CONTRACT_SIGNED'],
    description: 'Проект взаимодействует с рыночной средой через пилоты и контракты.',
  },
  {
    id: 'project-regulator',
    from: 'operator', to: 'regulator',
    label: 'Регуляторика',
    color: '#8b5cf6',
    events: ['REGULATORY_BARRIER_DETECTED', 'CERTIFICATION_OBTAINED', 'INFRA_GAP_DETECTED'],
    description: 'Пересечение нормативной среды — сертификация, НПА, стандарты.',
  },
  {
    id: 'project-tech',
    from: 'team', to: 'fund',
    label: 'Диагностика / AI-план',
    color: '#f59e0b',
    events: ['PROJECT_STARTED', 'TRL_ADVANCED', 'TEAM_HIRED', 'SCALE_READY', 'AI_PLAN_GENERATED'],
    description: 'Фонд и AI-агент фиксируют состояние проекта и строят план.',
  },
]

/**
 * Определить через какой интерфейс прошло событие
 */
export function getEventInterface(eventType) {
  return GR_INTERFACES.find(i => i.events.includes(eventType)) || null
}

/**
 * Субъектный взгляд: события, видимые субъекту данной роли
 */
export function subjectView(events, role) {
  if (!role || role === 'all') return events
  const roleDef = SUBJECT_ROLES[role]
  if (!roleDef) return events
  const kws = roleDef.keywords

  return events.filter(e => {
    const def = GR_EVENT_TYPES[e.type]
    if (!def) return false
    const subj = def.subject || ''
    const obj = def.object || ''
    return kws.some(k => subj.includes(k) || obj.includes(k))
  })
}

// ─── Каузальный DAG ───────────────────────────────────────────────────────────

/**
 * Построить граф причинно-следственных связей из ленты событий.
 * Возвращает {nodes, edges} для визуализации.
 *
 * node = { id, event, def, phase, col, row }
 * edge = { from, to, label }
 */
export function buildCausalDag(events) {
  const nodes = events.map(e => {
    const def = GR_EVENT_TYPES[e.type] || {}
    return {
      id: e.id,
      event: e,
      def,
      phase: def.phase || 'other',
      label: def.label || e.type,
      color: def.color || '#64748b',
      icon: def.icon || 'pi pi-circle',
    }
  })

  const edges = []
  for (const evt of events) {
    const def = GR_EVENT_TYPES[evt.type]
    if (!def?.preconditions?.length) continue
    for (const precType of def.preconditions) {
      // Ищем ближайшее предшествующее событие этого типа (по ts)
      const precEvt = [...events]
        .filter(e => e.type === precType && e.ts <= evt.ts)
        .sort((a, b) => b.ts - a.ts)[0]
      if (precEvt) {
        edges.push({ from: precEvt.id, to: evt.id })
      }
    }
  }

  return { nodes, edges }
}

/**
 * Топологическая сортировка событий по причинно-следственным связям (Kahn's algorithm).
 * Если в DAG есть циклы — fallback на сортировку по ts.
 */
export function happensBefore(events) {
  if (!events.length) return events

  const { edges } = buildCausalDag(events)
  const inDegree = new Map(events.map(e => [e.id, 0]))
  const adj      = new Map(events.map(e => [e.id, []]))

  for (const edge of edges) {
    if (adj.has(edge.from)) adj.get(edge.from).push(edge.to)
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
  }

  const queue  = events.filter(e => (inDegree.get(e.id) || 0) === 0).sort((a, b) => a.ts - b.ts)
  const result = []
  const byId   = new Map(events.map(e => [e.id, e]))

  while (queue.length) {
    const node = queue.shift()
    result.push(node)
    for (const nextId of (adj.get(node.id) || [])) {
      const deg = (inDegree.get(nextId) || 0) - 1
      inDegree.set(nextId, deg)
      if (deg === 0) {
        const next = byId.get(nextId)
        if (next) queue.push(next)
      }
    }
  }

  return result.length === events.length ? result : [...events].sort((a, b) => a.ts - b.ts)
}

// ─── Вспомогательные ─────────────────────────────────────────────────────────

function _sectorOk(measure, sector) {
  const SECTOR_MAP = {
    'БАС':  ['БПЛА / БАС', 'Аэрокосмос', 'Все технологические сектора', 'Все секторы'],
    'РОБО': ['Робототехника', 'Промышленность', 'ИТ / ПО', 'Все технологические сектора', 'Все секторы'],
    'МЭ':   ['Промышленность', 'ИТ / ПО', 'Все технологические сектора', 'Все секторы'],
  }
  const relevant = SECTOR_MAP[sector] || SECTOR_MAP['БАС']
  return !measure.sector?.length || measure.sector.some(s => relevant.includes(s))
}

function _diagProbability(diagId, state) {
  if (diagId === 'MARKET_FAILURE_DETECTED' && state.trl <= 4) return 'high'
  if (diagId === 'TECH_GAP_DETECTED') return 'high'
  if (diagId === 'REGULATORY_BARRIER_DETECTED' && state.sector === 'БАС') return 'high'
  if (diagId === 'INFRA_GAP_DETECTED' && (state.sector === 'БАС' || state.sector === 'РОБО')) return 'medium'
  return 'low'
}

// ─── Временные разрывы ────────────────────────────────────────────────────────

/**
 * Находит события без ответного события через 30+ дней (или иного порога).
 * Возвращает список разрывов с уровнем критичности.
 */
export function findTemporalGaps(events) {
  const now = Date.now()
  const gaps = []
  const PENDING_PAIRS = [
    { trigger: 'MEASURE_APPLIED', expected: 'MEASURE_APPROVED', label: 'Нет ответа оператора', warnDays: 30 },
    { trigger: 'MEASURE_APPLIED', expected: 'MEASURE_REJECTED', label: 'Нет ответа оператора', warnDays: 30 },
    { trigger: 'MEASURE_APPROVED', expected: 'MEASURE_FUNDED', label: 'Одобрено, но деньги не получены', warnDays: 14 },
    { trigger: 'PILOT_LAUNCHED', expected: 'PILOT_COMPLETED', label: 'Пилот не завершён', warnDays: 90 },
  ]
  for (const pair of PENDING_PAIRS) {
    const triggerEvts = events.filter(e => e.type === pair.trigger)
    for (const triggerEvt of triggerEvts) {
      const measureId = triggerEvt.data?.measure
      const hasResponse = events.some(e =>
        (e.type === pair.expected) &&
        (!measureId || e.data?.measure === measureId) &&
        e.ts > triggerEvt.ts
      )
      if (!hasResponse) {
        const daysPending = Math.floor((now - triggerEvt.ts) / (1000 * 60 * 60 * 24))
        if (daysPending >= pair.warnDays) {
          gaps.push({
            triggerEvent: triggerEvt,
            expectedType: pair.expected,
            label: pair.label,
            daysPending,
            severity: daysPending > pair.warnDays * 2 ? 'critical' : 'warn',
            measureId,
          })
        }
      }
    }
  }
  return gaps
}

// ─── Плотность событий ────────────────────────────────────────────────────────

/**
 * Группирует события по периодам для графика плотности.
 * @param {Event[]} events - лента событий (отсортированная по ts)
 * @param {number} bucketDays - размер корзины в днях (по умолчанию 7)
 */
export function eventDensity(events, bucketDays = 7) {
  if (!events.length) return []
  const bucketMs = bucketDays * 24 * 60 * 60 * 1000
  const minTs = events[0].ts
  const maxTs = events[events.length - 1].ts + 1
  const buckets = []
  for (let t = minTs; t < maxTs; t += bucketMs) {
    const inBucket = events.filter(e => e.ts >= t && e.ts < t + bucketMs)
    buckets.push({
      ts: t,
      label: new Date(t).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      count: inBucket.length,
      events: inBucket,
      types: [...new Set(inBucket.map(e => e.type))],
    })
  }
  return buckets
}

// ─── Сравнение проектов ───────────────────────────────────────────────────────

/**
 * Сравнивает паттерны событий нескольких проектов.
 * @param {{ [projectId: string]: Event[] }} projectTimelines
 */
export function compareProjects(projectTimelines) {
  // projectTimelines = { [projectId]: Event[] }
  return Object.entries(projectTimelines).map(([id, events]) => {
    const state = projectState(events)
    const stats = timelineStats(events)
    const phases = [...new Set(events.map(e => {
      const def = GR_EVENT_TYPES[e.type]
      return def?.phase || 'other'
    }))]
    const measureIds = events.filter(e => e.type === 'MEASURE_APPLIED').map(e => e.data?.measure).filter(Boolean)
    const gaps = findTemporalGaps(events)
    return {
      id,
      trl: state.trl,
      totalFunding: state.totalFunding,
      measuresApplied: stats.measuresApplied,
      measuresApproved: stats.measuresApproved,
      phases,
      measureIds,
      gaps: gaps.length,
      criticalGaps: gaps.filter(g => g.severity === 'critical').length,
      eventCount: events.length,
      lastActivity: events.at(-1)?.ts || 0,
    }
  }).sort((a, b) => b.trl - a.trl)
}
