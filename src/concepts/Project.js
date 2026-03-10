/**
 * Project — концепт портфельного проекта / стартапа
 *
 * Проект — не объект с полями. Проект — это лента событий,
 * и всё что мы знаем о проекте — проекция этой ленты.
 *
 * «Проект существует» = «события, связанные с этим ID, произошли».
 */

import { projectState, nextPossibleEvents, timelineStats, counterfactual } from '@/services/grEventEngine.js'

export class Project {
  constructor(id, meta = {}) {
    this.id = id
    this.meta = meta   // название, описание — вне событий (статичные)
  }

  // ─── Состояние = проекция ленты ───────────────────────────────────────────

  getState(events) {
    return projectState(events.filter(e => e.entityId === this.id || !e.entityId))
  }

  getStats(events) {
    return timelineStats(events.filter(e => e.entityId === this.id || !e.entityId))
  }

  // ─── Возможные следующие события ──────────────────────────────────────────

  getPossibilities(events, measures) {
    return nextPossibleEvents(
      events.filter(e => e.entityId === this.id || !e.entityId),
      measures
    )
  }

  // ─── Инициализирующее событие ─────────────────────────────────────────────

  startEvent(params = {}) {
    return {
      type: 'PROJECT_STARTED',
      entityType: 'project',
      entityId: this.id,
      data: {
        trl:     params.trl     || 1,
        sector:  params.sector  || 'БАС',
        stage:   params.stage   || 'Pre-seed',
        name:    params.name    || this.meta.name || this.id,
        ...params,
      },
    }
  }

  // ─── Контрфактичный анализ ────────────────────────────────────────────────

  /**
   * «Что если бы события X не было?»
   * Возвращает diff: trlDelta, fundingDelta, lostPossibilities
   */
  whatIf(events, removeEventId, measures) {
    return counterfactual(
      events.filter(e => e.entityId === this.id || !e.entityId),
      removeEventId,
      measures
    )
  }

  // ─── TRL-маршрут ─────────────────────────────────────────────────────────

  /** Построить маршрут финансирования от текущего TRL к целевому */
  getFundingRoute(events, measures, targetTrl = 9) {
    const state = this.getState(events)
    const applicable = measures.filter(m => m.isApplicable?.(events) || true)

    const stages = []
    for (let trl = state.trl; trl <= targetTrl; trl += 2) {
      const forTrl = applicable.filter(m => trl >= (m.trl_min || 0) && trl <= (m.trl_max || 9))
      if (forTrl.length) stages.push({ trl, measures: forTrl })
    }
    return stages
  }
}
