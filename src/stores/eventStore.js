/**
 * Universal Event Store — единое хранилище всех лент событий платформы
 *
 * Принцип: append-only лог событий per entity.
 * Состояние любой сущности = проекция её ленты.
 *
 * Сущности (entityType): project | company | deal | session | fund
 *
 * Usage:
 *   const store = useEventStore()
 *   store.add('company', '123', 'KPI_UPDATED', { irr: 18.5 })
 *   store.getTimeline('company', '123')   // Event[]
 *   store.getState('company', '123')      // последнее состояние
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getEventDef } from '@/config/eventRegistry.js'
import { moduleState } from '@/services/softModel.js'
import { processEvent as processAutomation } from '@/services/crossEntityAutomation.js'

// ─── Персистентность через бэкенд ─────────────────────────────────────────────

const API_BASE = '/api/events'

async function persistEvent(evt) {
  try {
    await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evt),
    })
  } catch (e) {
    console.warn('[EventStore] persist failed (offline?):', e.message)
  }
}

async function loadTimeline(entityType, entityId) {
  try {
    const res = await fetch(`${API_BASE}/${entityType}/${entityId}`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

// Загрузить все ленты по типу сущности (GET /api/events/:entityType)
async function loadAllByType(entityType) {
  try {
    const res = await fetch(`${API_BASE}/${entityType}`)
    if (!res.ok) return {}
    const { timelines } = await res.json()
    return timelines || {}
  } catch {
    return {}
  }
}

// ─── Редьюсеры состояния per entity type ─────────────────────────────────────

const REDUCERS = {
  project: (events) => {
    return events.reduce((s, e) => {
      if (e.type === 'PROJECT_STARTED')            return { ...s, ...e.data, started: e.ts }
      if (e.type === 'TRL_ADVANCED')               return { ...s, trl: e.data?.to ?? s.trl + 1 }
      if (e.type === 'MEASURE_FUNDED')             return { ...s, totalFunding: (s.totalFunding||0) + (e.data?.amount||0) }
      if (e.type === 'PILOT_COMPLETED')            return { ...s, pilotDone: true }
      if (e.type === 'CONTRACT_SIGNED')            return { ...s, hasContract: true }
      if (e.type === 'SCALE_READY')                return { ...s, scaleReady: true }
      if (e.type === 'MARKET_FAILURE_DETECTED')    return { ...s, triggers: [...(s.triggers||[]), 'market_failure'] }
      if (e.type === 'TECH_GAP_DETECTED')          return { ...s, triggers: [...(s.triggers||[]), 'tech_gap'] }
      if (e.type === 'REGULATORY_BARRIER_DETECTED') return { ...s, triggers: [...(s.triggers||[]), 'regulatory_barrier'] }
      if (e.type === 'INFRA_GAP_DETECTED')         return { ...s, triggers: [...(s.triggers||[]), 'infrastructure_gap'] }
      return s
    }, { trl: 1, sector: 'БАС', totalFunding: 0, triggers: [] })
  },

  company: (events) => {
    return events.reduce((s, e) => {
      if (e.type === 'COMPANY_ADDED')     return { ...s, ...e.data, added: e.ts }
      if (e.type === 'KPI_UPDATED')       return { ...s, kpi: { ...(s.kpi||{}), ...e.data } }
      if (e.type === 'REVENUE_MILESTONE') return { ...s, lastRevenue: e.data?.amount, lastMilestoneTs: e.ts }
      if (e.type === 'RISK_ELEVATED')     return { ...s, risk: e.data?.level || 'high' }
      if (e.type === 'ROUND_OPENED')      return { ...s, stage: e.data?.round }
      if (e.type === 'EXIT_EVENT')        return { ...s, exited: true, exitTs: e.ts, exitAmount: e.data?.amount }
      return s
    }, { kpi: {}, risk: 'low' })
  },

  deal: (events) => {
    return events.reduce((s, e) => {
      if (e.type === 'DEAL_SOURCED')       return { ...s, phase: 'source', ...e.data }
      if (e.type === 'TERM_SHEET_SIGNED')  return { ...s, phase: 'dd', tsSignedTs: e.ts }
      if (e.type === 'DD_COMPLETED')       return { ...s, phase: 'close', ddDoneTs: e.ts }
      if (e.type === 'DEAL_CLOSED')        return { ...s, phase: 'post-close', closedTs: e.ts, amount: e.data?.amount }
      if (e.type === 'TRANCHE_RELEASED')   return { ...s, tranches: [...(s.tranches||[]), e.data] }
      if (e.type === 'MILESTONE_ACHIEVED') return { ...s, milestones: [...(s.milestones||[]), e.data] }
      if (e.type === 'CONDITION_FULFILLED') return { ...s, conditions: (s.conditions||[]).map(c => c.id === e.data?.id ? {...c, fulfilled: true} : c) }
      return s
    }, { phase: 'new', tranches: [], milestones: [] })
  },

  session: (events) => {
    return events.reduce((s, e) => {
      if (e.type === 'SESSION_STARTED')      return { ...s, phase: 'argue', started: e.ts, projectId: e.data?.projectId, projectName: e.data?.projectName, agents: e.data?.agents }
      if (e.type === 'ARGUMENT_RAISED')      return { ...s, argCount: (s.argCount||0) + 1, args: [...(s.args||[]), e.data] }
      if (e.type === 'ARGUMENT_CHALLENGED')  return { ...s, argCount: (s.argCount||0) + 1, challenged: (s.challenged||0) + 1, args: [...(s.args||[]), e.data] }
      if (e.type === 'ARGUMENT_SUPPORTED')   return { ...s, argCount: (s.argCount||0) + 1, supported: (s.supported||0) + 1 }
      if (e.type === 'ARGUMENT_SYNTHESIZED') return { ...s, phase: 'vote', synthesized: e.ts, synthesis: e.data }
      if (e.type === 'CONTRADICTION_FOUND')  return { ...s, contradictions: [...(s.contradictions||[]), e.data] }
      if (e.type === 'CONDITION_PROPOSED')   return { ...s, conditions: [...(s.conditions||[]), e.data] }
      if (e.type === 'VOTE_CAST')            return { ...s, votes: [...(s.votes||[]), e.data] }
      if (e.type === 'DECISION_MADE')        return { ...s, phase: 'closed', decision: e.data?.verdict, score: e.data?.score, conditions: e.data?.conditions || s.conditions, closedTs: e.ts }
      return s
    }, { phase: 'new', votes: [], conditions: [], contradictions: [], args: [], argCount: 0, challenged: 0, supported: 0 })
  },

  fund: (events) => {
    return events.reduce((s, e) => {
      if (e.type === 'FUND_LAUNCHED')    return { ...s, launched: e.ts, ...e.data }
      if (e.type === 'LP_COMMITTED')     return { ...s, totalCommitted: (s.totalCommitted||0) + (e.data?.amount||0) }
      if (e.type === 'CAPITAL_CALLED')   return { ...s, deployed: (s.deployed||0) + (e.data?.amount||0) }
      if (e.type === 'NAV_UPDATED')      return { ...s, nav: e.data?.nav, navTs: e.ts }
      if (e.type === 'DISTRIBUTION_MADE') return { ...s, distributed: (s.distributed||0) + (e.data?.amount||0) }
      return s
    }, { totalCommitted: 0, deployed: 0, distributed: 0 })
  },

  // Module = модуль платформы (meta-онтология): born → develop → test → deploy
  module: (events) => moduleState(events),

  // Lead = сессия стартапера: intake → research → scoring → submit
  lead: (events) => {
    return events.reduce((s, e) => {
      if (e.type === 'LEAD_STARTED')        return { ...s, phase: 'intake', started: e.ts }
      if (e.type === 'MESSAGE_SENT')        return { ...s, messageCount: (s.messageCount||0) + 1 }
      if (e.type === 'DOC_UPLOADED')        return { ...s, docs: [...(s.docs||[]), e.data?.filename], phase: 'intake' }
      if (e.type === 'DOC_PARSED')          return { ...s, parsed: (s.parsed||0) + 1, trl: e.data?.trl || s.trl }
      if (e.type === 'TWIN_UPDATED')        return { ...s, completeness: e.data?.completeness || s.completeness, twin: { ...(s.twin||{}), ...e.data?.twin } }
      if (e.type === 'TWIN_THRESHOLD_30')   return { ...s, completeness: 30, phase: 'research' }
      if (e.type === 'TWIN_THRESHOLD_80')   return { ...s, completeness: 80, icReady: true }
      if (e.type === 'RESEARCH_STARTED')    return { ...s, phase: 'research', researchTs: e.ts }
      if (e.type === 'EGRUL_CHECKED')       return { ...s, egrulDone: true, company: e.data?.company, inn: e.data?.inn }
      if (e.type === 'PATENTS_FOUND')       return { ...s, patents: e.data?.count || 0 }
      if (e.type === 'COMPETITORS_ANALYZED') return { ...s, competitors: e.data?.count || 0 }
      if (e.type === 'GRANTS_MATCHED')      return { ...s, grantsCount: e.data?.count || 0, grantIds: e.data?.grantIds || [] }
      if (e.type === 'SCORING_DONE')        return { ...s, phase: 'scoring', score: e.data?.totalScore, dimensions: e.data?.dimensions }
      if (e.type === 'IC_PRELIM_DONE')      return { ...s, icPrelimDone: true, icTs: e.ts }
      if (e.type === 'APPLY_STARTED')       return { ...s, phase: 'submit', applyTs: e.ts }
      if (e.type === 'SENT_TO_IC')          return { ...s, phase: 'submit', sentTs: e.ts, committeeSessionId: e.data?.sessionId }
      return s
    }, { phase: 'intake', completeness: 0, docs: [], messageCount: 0, parsed: 0 })
  },
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useEventStore = defineStore('events', () => {

  // "entityType:entityId" → Event[]
  const timelines = ref({})

  // ─── Ключ сущности ────────────────────────────────────────────────────────

  function key(entityType, entityId) {
    return `${entityType}:${entityId}`
  }

  // ─── Получить ленту ───────────────────────────────────────────────────────

  function getTimeline(entityType, entityId) {
    const k = key(entityType, entityId)
    if (!timelines.value[k]) timelines.value[k] = []
    return timelines.value[k]
  }

  // ─── Добавить событие ─────────────────────────────────────────────────────

  function add(entityType, entityId, type, data = {}, meta = {}) {
    const timeline = getTimeline(entityType, entityId)
    const def = getEventDef(type)
    const evt = {
      id:         `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      entityType,
      entityId,
      type,
      label:      def?.label || type,
      icon:       def?.icon,
      color:      def?.color,
      subject:    def?.subject,
      data,
      meta,
      ts:         Date.now(),
    }
    timeline.push(evt)
    persistEvent(evt)   // fire-and-forget
    // Cross-entity automation: fire-and-forget
    if (_automationEmitter) {
      processAutomation(evt, _automationEmitter).catch(() => {})
    }
    return evt
  }

  // ─── Automation emitter (опционально) ────────────────────────────────────
  // Устанавливается через useEventStore().setAutomationEmitter(fn)

  let _automationEmitter = null
  function setAutomationEmitter(fn) { _automationEmitter = fn }

  // ─── Загрузить ленту из Integram ──────────────────────────────────────────

  async function load(entityType, entityId) {
    // Специальный режим '_all' — загружаем все ленты по типу сущности
    if (entityId === '_all') {
      const allTimelines = await loadAllByType(entityType)
      for (const [eid, remote] of Object.entries(allTimelines)) {
        if (!remote.length) continue
        const k = key(entityType, eid)
        const lastRemoteTs = remote.at(-1)?.ts || 0
        const localNew = (timelines.value[k] || []).filter(e => e.ts > lastRemoteTs)
        timelines.value[k] = [...remote, ...localNew]
      }
      return
    }
    const remote = await loadTimeline(entityType, entityId)
    if (!remote.length) return
    const k = key(entityType, entityId)
    // Мержим: remote — источник истины, локальные события (новее last remote ts) добавляем сверху
    const lastRemoteTs = remote.at(-1)?.ts || 0
    const localNew = (timelines.value[k] || []).filter(e => e.ts > lastRemoteTs)
    timelines.value[k] = [...remote, ...localNew]
  }

  // ─── Удалить событие ─────────────────────────────────────────────────────

  function remove(entityType, entityId, eventId) {
    const k = key(entityType, entityId)
    if (timelines.value[k]) {
      timelines.value[k] = timelines.value[k].filter(e => e.id !== eventId)
    }
  }

  // ─── Очистить ленту ───────────────────────────────────────────────────────

  function clear(entityType, entityId) {
    timelines.value[key(entityType, entityId)] = []
  }

  // ─── Проекция состояния ───────────────────────────────────────────────────

  function getState(entityType, entityId) {
    const events = getTimeline(entityType, entityId)
    const reducer = REDUCERS[entityType]
    return reducer ? reducer(events) : {}
  }

  // ─── Проекция на произвольный момент времени (#187 temporal replay) ─────────

  function getStateAt(entityType, entityId, ts) {
    const events = getTimeline(entityType, entityId).filter(e => e.ts <= ts)
    const reducer = REDUCERS[entityType]
    return reducer ? reducer(events) : {}
  }

  // ─── Список сущностей ─────────────────────────────────────────────────────

  function getIds(entityType) {
    return [...new Set(
      Object.keys(timelines.value)
        .filter(k => k.startsWith(entityType + ':'))
        .map(k => k.slice(entityType.length + 1))
    )]
  }

  // ─── Последнее событие ────────────────────────────────────────────────────

  function getLastEvent(entityType, entityId, ofType = null) {
    const events = getTimeline(entityType, entityId)
    const filtered = ofType ? events.filter(e => e.type === ofType) : events
    return filtered.at(-1) || null
  }

  // ─── Статистика ───────────────────────────────────────────────────────────

  function getStats(entityType, entityId) {
    const events = getTimeline(entityType, entityId)
    const byType = {}
    for (const e of events) byType[e.type] = (byType[e.type] || 0) + 1
    return {
      total: events.length,
      byType,
      firstTs: events[0]?.ts || null,
      lastTs:  events.at(-1)?.ts || null,
      state:   getState(entityType, entityId),
    }
  }

  // ─── Экспорт для grEventStore (обратная совместимость) ────────────────────

  // Совместимость с grEventStore.js — делегируем через entity "project"
  const grTimelines = computed(() => {
    const result = {}
    for (const [k, v] of Object.entries(timelines.value)) {
      if (k.startsWith('project:')) {
        result[k.slice('project:'.length)] = v
      }
    }
    return result
  })

  return {
    timelines,
    getTimeline,
    getStateAt,
    add,
    load,
    remove,
    clear,
    getState,
    getIds,
    getLastEvent,
    getStats,
    grTimelines,
    setAutomationEmitter,
    // shortcuts
    addProjectEvent:  (id, type, data) => add('project',  id, type, data),
    addCompanyEvent:  (id, type, data) => add('company',  id, type, data),
    addDealEvent:     (id, type, data) => add('deal',     id, type, data),
    addSessionEvent:  (id, type, data) => add('session',  id, type, data),
    addFundEvent:     (id, type, data) => add('fund',     id, type, data),
    addLeadEvent:     (id, type, data) => add('lead',     id, type, data),
  }
})
