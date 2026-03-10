/**
 * GR Event Store — делегирует хранение в универсальный eventStore
 * (который персистит в Integram автоматически)
 *
 * Сохраняет GR-специфичную логику: getPossible, getStats, initProject,
 * applyMeasure, approveMeasure — но данные живут в eventStore под ключом 'project'
 */

import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useEventStore } from './eventStore.js'
import { projectState, nextPossibleEvents, timelineStats } from '@/services/grEventEngine.js'
import { GR_MEASURES } from '@/config/grMeasuresData.js'

export const useGrEventStore = defineStore('grEvents', () => {

  const eventStore = useEventStore()

  // ─── Делегация хранения ───────────────────────────────────────────────────

  function getTimeline(projectId) {
    return eventStore.getTimeline('project', projectId)
  }

  function addEvent(projectId, type, data = {}) {
    return eventStore.add('project', projectId, type, data)
  }

  function removeEvent(projectId, eventId) {
    eventStore.remove('project', projectId, eventId)
  }

  function clearTimeline(projectId) {
    eventStore.clear('project', projectId)
  }

  // ─── GR-логика (derived) ──────────────────────────────────────────────────

  function getState(projectId) {
    return projectState(getTimeline(projectId))
  }

  function getPossible(projectId) {
    return nextPossibleEvents(getTimeline(projectId), GR_MEASURES)
  }

  function getStats(projectId) {
    return timelineStats(getTimeline(projectId))
  }

  // ─── Инициализация проекта ────────────────────────────────────────────────

  function initProject(projectId, params = {}) {
    clearTimeline(projectId)
    addEvent(projectId, 'PROJECT_STARTED', {
      trl:    params.trl    || 1,
      sector: params.sector || 'БАС',
      stage:  params.stage  || 'Pre-seed',
      name:   params.name   || projectId,
    })
    if ((params.trl || 1) <= 5)        addEvent(projectId, 'MARKET_FAILURE_DETECTED', { auto: true })
    if (params.sector === 'БАС') {
      addEvent(projectId, 'TECH_GAP_DETECTED', { auto: true })
      addEvent(projectId, 'REGULATORY_BARRIER_DETECTED', { auto: true })
    }
    if (params.hasInfra)               addEvent(projectId, 'INFRA_GAP_DETECTED', { auto: true })
  }

  // ─── Применение мер ───────────────────────────────────────────────────────

  function applyMeasure(projectId, measureId, opts = {}) {
    addEvent(projectId, 'MEASURE_APPLIED', { measure: measureId, ...opts })
  }

  function approveMeasure(projectId, measureId, amount) {
    addEvent(projectId, 'MEASURE_APPROVED', { measure: measureId })
    addEvent(projectId, 'MEASURE_FUNDED',   { measure: measureId, amount: amount || 0 })
  }

  function rejectMeasure(projectId, measureId, reason) {
    addEvent(projectId, 'MEASURE_REJECTED', { measure: measureId, reason })
  }

  // ─── Загрузка из Integram ─────────────────────────────────────────────────

  async function load(projectId) {
    return eventStore.load('project', projectId)
  }

  // Загрузить все project-ленты из Integram сразу
  async function loadAll() {
    return eventStore.load('project', '_all')
  }

  // ─── Computed ─────────────────────────────────────────────────────────────

  const projectIds = computed(() => eventStore.getIds('project'))
  const timelines  = computed(() => eventStore.grTimelines)

  return {
    timelines,
    getTimeline,
    addEvent,
    removeEvent,
    clearTimeline,
    getState,
    getPossible,
    getStats,
    initProject,
    applyMeasure,
    approveMeasure,
    rejectMeasure,
    projectIds,
    load,
    loadAll,
  }
})
