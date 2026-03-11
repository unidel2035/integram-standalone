/**
 * Pipeline Service — движок регуляторного конвейера ФСТ НТИ
 *
 * Вычисляет состояние ПП-1→ПП-6 из ленты событий deal-сущности.
 * Чистые функции, без Vue-зависимостей — тестируемо отдельно.
 */

import { REGLAMENT_EVENT_TYPES } from '@/config/eventRegistry.js'

// ─── Определение 6 подпроцессов ───────────────────────────────────────────────

export const SUBPROCESS_DEFS = [
  {
    id: 'pp1',
    label: 'ПП-1',
    name: 'Рассмотрение проектной инициативы',
    icon: 'pi pi-file-plus',
    color: 'var(--fst-blue)',
    slaDays: 10,
    events: ['PI_REGISTERED', 'PI_COMPLIANCE_CHECK', 'PI_ACCEPTED', 'PI_REJECTED'],
    completedBy: ['PI_ACCEPTED'],
    blockedBy: ['PI_REJECTED'],
    reglamentRef: '3.1',
    description: 'Регистрация ПИ в реестре УТ и проверка соответствия инвестиционной декларации',
    actors: ['УТ'],
  },
  {
    id: 'pp2',
    label: 'ПП-2',
    name: 'Предварительный анализ',
    icon: 'pi pi-search',
    color: 'var(--fst-brand)',
    slaDays: 20,
    events: ['RP_ASSIGNED', 'NDA_SIGNED', 'PRELIM_ANALYSIS_STARTED', 'OUS_FORMED', 'PRELIM_ANALYSIS_DONE'],
    completedBy: ['PRELIM_ANALYSIS_DONE'],
    blockedBy: [],
    reglamentRef: '3.2',
    description: 'Назначение РП, подписание НДА, предварительный анализ, формирование ОУС',
    actors: ['УТ', 'РП', 'Инициатор'],
  },
  {
    id: 'pp3',
    label: 'ПП-3',
    name: 'Заседание ИК-1',
    icon: 'pi pi-users',
    color: 'var(--fst-purple)',
    slaDays: 45,
    events: ['OUS_SIGNED', 'IC1_CONVENED', 'IC1_DECISION_APPROVED', 'IC1_DECISION_REVISION', 'IC1_DECISION_REJECTED'],
    completedBy: ['IC1_DECISION_APPROVED'],
    blockedBy: ['IC1_DECISION_REJECTED'],
    reglamentRef: '3.3',
    description: 'Подписание ОУС (необязывающее), первичное рассмотрение проекта инвесткомитетом',
    actors: ['УТ', 'ИК', 'Инициатор'],
  },
  {
    id: 'pp4',
    label: 'ПП-4',
    name: 'Экспертизы и ИК-2',
    icon: 'pi pi-search-plus',
    color: 'var(--fst-purple)',
    slaDays: 45,
    events: ['EXPERT_ASSESSMENT_ORDERED', 'INDEPENDENT_VALUATION_ORDERED', 'INDEPENDENT_VALUATION_DONE', 'NTI_STATUS_CONFIRMED', 'LEGAL_DOCS_PREPARED', 'IC2_CONVENED', 'IC2_DECISION_APPROVED', 'IC2_DECISION_REVISION', 'IC2_DECISION_REJECTED'],
    completedBy: ['IC2_DECISION_APPROVED'],
    blockedBy: ['IC2_DECISION_REJECTED'],
    reglamentRef: '3.4',
    description: 'Специализированные экспертизы, независимая оценка, подготовка юр. документов, ИК-2',
    actors: ['УТ', 'РП', 'ИК', 'Эксперты', 'Оценщик'],
  },
  {
    id: 'pp5',
    label: 'ПП-5',
    name: 'Закрытие сделки',
    icon: 'pi pi-file-check',
    color: 'var(--fst-green)',
    slaDays: null,
    events: ['LEGAL_CLOSING', 'PRECEDENT_CONDITIONS_FULFILLED', 'CAPITAL_CALL_NOTICE', 'FINANCIAL_CLOSING', 'BOARD_REPRESENTATIVE_APPOINTED'],
    completedBy: ['FINANCIAL_CLOSING'],
    blockedBy: [],
    reglamentRef: '3.5',
    description: 'Юридическое и финансовое закрытие сделки, Capital Call, назначение представителя УТ',
    actors: ['УТ', 'Товарищи', 'Нотариус'],
  },
  {
    id: 'pp6',
    label: 'ПП-6',
    name: 'Мониторинг и выход',
    icon: 'pi pi-chart-line',
    color: 'var(--fst-cyan)',
    slaDays: null,
    events: ['QUARTERLY_REPORT', 'ANNUAL_AUDIT', 'IC3_CONVENED', 'IC3_DECISION_CONTINUE', 'IC3_DECISION_INTERVENE', 'IC3_DECISION_EXIT', 'EXIT_INITIATED', 'EXIT_LEGAL_CLOSING', 'EXIT_FINANCIAL_CLOSING'],
    completedBy: ['EXIT_FINANCIAL_CLOSING'],
    blockedBy: [],
    reglamentRef: '3.6',
    description: 'Ежеквартальный мониторинг KPI, ежегодный аудит, ИК-3, управление выходом',
    actors: ['УТ', 'ИК', 'Портфельная компания'],
  },
]

// ─── Порядок ключевых переходов между подпроцессами ──────────────────────────

const SUBPROCESS_ORDER = ['pp1', 'pp2', 'pp3', 'pp4', 'pp5', 'pp6']

// ─── Вычисление SLA ──────────────────────────────────────────────────────────

function parseSlaDays(str) {
  if (!str) return null
  const m = str.match(/(\d+)\s*р\.д\./)
  return m ? parseInt(m[1]) : null
}

function workdaysToMs(days) {
  return days * 24 * 60 * 60 * 1000 * (7 / 5) // грубо: 7/5 = перевод рабочих → календарных дней
}

function computeSLA(firstEventTs, slaDays) {
  if (!slaDays || !firstEventTs) return { deadline: null, exceeded: false, remaining: null }
  const deadline = firstEventTs + workdaysToMs(slaDays)
  const now = Date.now()
  const exceeded = now > deadline
  const remaining = Math.ceil((deadline - now) / (24 * 60 * 60 * 1000))
  return { deadline, exceeded, remaining }
}

// ─── Основная функция: buildPipelineStages ───────────────────────────────────

/**
 * Строит массив стадий конвейера из ленты событий сделки.
 *
 * @param {string} dealId - ID сущности deal
 * @param {Object} eventStore - useEventStore() instance
 * @returns {PipelineStage[]}
 */
export function buildPipelineStages(dealId, eventStore) {
  const timeline = eventStore.getTimeline('deal', dealId)
  const sessionTimeline = eventStore.getTimeline('session', dealId)

  // Объединяем deal + session события для анализа (session события тоже часть регламента)
  const allTimeline = [...timeline, ...sessionTimeline].sort((a, b) => a.ts - b.ts)

  // Множество фактически произошедших событий
  const occurred = new Set(allTimeline.map(e => e.type))
  // Карта: тип события → последнее событие этого типа
  const eventByType = {}
  for (const e of allTimeline) {
    eventByType[e.type] = e
  }

  const stages = []
  let foundActive = false

  for (const def of SUBPROCESS_DEFS) {
    // Какие события этого подпроцесса уже произошли?
    const occurredEvents = def.events
      .filter(t => occurred.has(t))
      .map(t => eventByType[t])
      .sort((a, b) => a.ts - b.ts)

    const isCompleted = def.completedBy.some(t => occurred.has(t))
    const isBlocked   = def.blockedBy.some(t => occurred.has(t))

    // Статус стадии
    let status
    if (isCompleted) {
      status = 'done'
    } else if (isBlocked) {
      status = 'blocked'
    } else if (occurredEvents.length > 0 || (!foundActive && stages.every(s => s.status === 'done'))) {
      if (!foundActive) {
        status = 'active'
        foundActive = true
      } else {
        status = 'pending'
      }
    } else {
      status = 'pending'
    }

    // Следующие возможные события
    const nextPossible = computeNextPossible(def, occurred, isCompleted, isBlocked)

    // SLA
    const firstEventTs = occurredEvents[0]?.ts || null
    const sla = computeSLA(firstEventTs, def.slaDays)

    // Участники
    const lastEvent = occurredEvents.at(-1) || null
    const elapsedDays = firstEventTs
      ? Math.ceil((Date.now() - firstEventTs) / (24 * 60 * 60 * 1000))
      : null

    stages.push({
      id:          def.id,
      label:       def.label,
      name:        def.name,
      icon:        def.icon,
      color:       def.color,
      status,
      events:      occurredEvents,
      nextPossible,
      sla,
      slaDays:     def.slaDays,
      reglamentRef: def.reglamentRef,
      description: def.description,
      actors:      def.actors,
      elapsedDays,
      lastEvent,
      completedBy: def.completedBy,
      allEventTypes: def.events,
    })
  }

  return stages
}

// ─── Следующие возможные события ────────────────────────────────────────────

function computeNextPossible(subprocessDef, occurred, isCompleted, isBlocked) {
  if (isCompleted || isBlocked) return []

  const possible = []

  for (const eventType of subprocessDef.events) {
    if (occurred.has(eventType)) continue
    const def = REGLAMENT_EVENT_TYPES[eventType]
    if (!def) continue

    // Проверяем, что причина (causes) уже произошла или причины нет
    const causeSatisfied = !def.causes || occurred.has(def.causes)
    if (!causeSatisfied) continue

    possible.push({
      type: eventType,
      label: def.label,
      icon: def.icon,
      color: def.color,
      description: def.description,
      reglamentRef: def.reglamentRef,
      subject: def.subject,
      entityType: def.entityType,
      phase: def.phase,
    })
  }

  return possible
}

// ─── getPipelineSummary ──────────────────────────────────────────────────────

/**
 * Агрегированные метрики конвейера.
 *
 * @param {PipelineStage[]} stages
 * @returns {{ currentPhase, completionPct, blockerCount, slaExceeded, totalDays, nextAction }}
 */
export function getPipelineSummary(stages) {
  const activeStage  = stages.find(s => s.status === 'active')
  const blockers     = stages.filter(s => s.status === 'blocked')
  const done         = stages.filter(s => s.status === 'done')
  const slaExceeded  = stages.filter(s => s.status === 'active' && s.sla.exceeded)

  const completionPct = Math.round((done.length / stages.length) * 100)

  const firstEventTs  = stages.flatMap(s => s.events).sort((a, b) => a.ts - b.ts)[0]?.ts
  const totalDays     = firstEventTs
    ? Math.ceil((Date.now() - firstEventTs) / (24 * 60 * 60 * 1000))
    : 0

  const nextAction = activeStage?.nextPossible?.[0]?.label || null

  return {
    currentPhase:   activeStage ? `${activeStage.label}: ${activeStage.name}` : (done.length === stages.length ? 'Завершён' : 'Не начат'),
    completionPct,
    blockerCount:   blockers.length,
    slaExceeded:    slaExceeded.length,
    totalDays,
    nextAction,
    doneCount:      done.length,
    totalCount:     stages.length,
  }
}

// ─── detectBlockers ──────────────────────────────────────────────────────────

/**
 * Находит стадии с блокирующими событиями и превышением SLA.
 *
 * @param {PipelineStage[]} stages
 * @returns {Array<{ stage, type: 'blocked'|'sla', description }>}
 */
export function detectBlockers(stages) {
  const result = []

  for (const stage of stages) {
    if (stage.status === 'blocked') {
      const blockerEvent = stage.events.findLast(e => stage.completedBy.includes(e.type) === false)
      result.push({
        stage,
        type: 'blocked',
        description: `${stage.label} заблокирован: ${blockerEvent?.label || 'отклонение'}. Требуется решение УТ.`,
        severity: 'error',
      })
    }
    if (stage.status === 'active' && stage.sla.exceeded) {
      result.push({
        stage,
        type: 'sla',
        description: `${stage.label} просрочен на ${Math.abs(stage.sla.remaining)} дн. (лимит: ${stage.slaDays} р.д.)`,
        severity: 'warn',
      })
    }
    if (stage.status === 'active' && stage.sla.remaining !== null && stage.sla.remaining <= 5 && stage.sla.remaining > 0) {
      result.push({
        stage,
        type: 'sla_warn',
        description: `${stage.label}: до дедлайна ${stage.sla.remaining} дн.`,
        severity: 'warn',
      })
    }
  }

  return result
}

// ─── Вспомогательное: все регламентные типы событий (Set) ────────────────────

export const REGLAMENT_EVENT_TYPE_SET = new Set(Object.keys(REGLAMENT_EVENT_TYPES))

/**
 * Фильтрует ленту событий — только регламентные события.
 */
export function filterReglamentEvents(timeline) {
  return timeline.filter(e => REGLAMENT_EVENT_TYPE_SET.has(e.type))
}
