/**
 * Measure — концепт меры государственной поддержки
 *
 * Событийная онтология: объект существует через события встречи с субъектом.
 * Мера — не запись в справочнике. Это тип события, которое может произойти
 * между фондом (оператором) и проектом.
 *
 * Концепт знает:
 *   - применим ли он к проекту прямо сейчас (из ленты событий)
 *   - какое событие он порождает при активации
 *   - что становится доступным после него (next)
 *   - где он находится в онтологической цепочке
 */

import { projectState } from '@/services/grEventEngine.js'

const SECTOR_MAP = {
  'БАС':  ['БПЛА / БАС', 'Аэрокосмос', 'Все технологические сектора', 'Все секторы'],
  'РОБО': ['Робототехника', 'Промышленность', 'ИТ / ПО', 'Все технологические сектора', 'Все секторы'],
  'МЭ':   ['Промышленность', 'ИТ / ПО', 'Все технологические сектора', 'Все секторы'],
}

export class Measure {
  constructor(data) {
    Object.assign(this, data)
  }

  // ─── Применимость (вычисляется из ленты событий проекта) ──────────────────

  isApplicable(projectEvents = []) {
    const state = projectState(projectEvents)
    return this._trlOk(state.trl) && this._sectorOk(state.sector) && this.status !== 'closed'
  }

  _trlOk(trl = 1) {
    return trl >= (this.trl_min || 1) && trl <= (this.trl_max || 9)
  }

  _sectorOk(sector = 'БАС') {
    const relevant = SECTOR_MAP[sector] || SECTOR_MAP['БАС']
    return !this.sector?.length || this.sector.some(s => relevant.includes(s))
  }

  // ─── Статус относительно ленты событий ────────────────────────────────────

  /**
   * funded → applied → applicable → soon → blocked
   */
  getStatus(projectEvents = []) {
    const funded  = projectEvents.some(e => e.type === 'MEASURE_FUNDED'   && e.data?.measure === this.id)
    const approved = projectEvents.some(e => e.type === 'MEASURE_APPROVED' && e.data?.measure === this.id)
    const applied = projectEvents.some(e => e.type === 'MEASURE_APPLIED'  && e.data?.measure === this.id)
    const rejected = projectEvents.some(e => e.type === 'MEASURE_REJECTED' && e.data?.measure === this.id)

    if (funded)   return 'funded'
    if (approved) return 'approved'
    if (applied)  return 'applied'
    if (rejected) return 'rejected'

    const state = projectState(projectEvents)
    if (this._trlOk(state.trl) && this._sectorOk(state.sector) && this.status !== 'closed') return 'applicable'

    // Скоро: TRL чуть ниже нижней границы
    if (state.trl >= (this.trl_min || 1) - 2 && this._sectorOk(state.sector)) return 'soon'

    return 'blocked'
  }

  // ─── Событийные методы ────────────────────────────────────────────────────

  /** Какое событие порождает подача заявки */
  applyEvent() {
    return { type: 'MEASURE_APPLIED', data: { measure: this.id, measureName: this.name } }
  }

  /** Какие события порождает получение финансирования */
  fundedEffects() {
    const effects = [{ type: 'TRL_ADVANCED', data: { from: this.trl_min, to: Math.min(this.trl_max + 1, 9) } }]
    if (this.type === 'accelerator') effects.push({ type: 'PILOT_LAUNCHED', data: {} })
    if (this.type === 'status') effects.push({ type: 'CERTIFICATION_OBTAINED', data: { certType: this.id } })
    return effects
  }

  // ─── Онтологическая позиция ───────────────────────────────────────────────

  getChainPosition() {
    return {
      chain_id:   this.chain_id,
      chain_step: this.chain_step,
      triggers:   this.triggers || [],
      next:       this.next || [],
    }
  }

  /** Меры, которые становятся доступными после этой */
  getNextMeasures(allMeasures) {
    return (this.next || []).map(id => allMeasures.find(m => m.id === id)).filter(Boolean)
  }

  // ─── Утилиты ─────────────────────────────────────────────────────────────

  toPlain() {
    const plain = {}
    for (const k of Object.keys(this)) plain[k] = this[k]
    return plain
  }
}

/** Обернуть массив plain-объектов в концепты */
export function asConcepts(measuresArray) {
  return measuresArray.map(m => m instanceof Measure ? m : new Measure(m))
}
