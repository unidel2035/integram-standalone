/**
 * EventChain — концепт событийной цепочки
 *
 * Цепочка — это не массив шагов. Это живой граф причин:
 * Триггер → Диагностика → Концепция → Пилот → НПА → Мера
 *
 * Концепт знает:
 *   - где сейчас находится проект в этой цепочке
 *   - какие шаги закрыты (есть мера), какие открыты (пробел)
 *   - какой следующий шаг возможен
 */

export class EventChain {
  constructor(chainDef) {
    Object.assign(this, chainDef)
  }

  // ─── Позиция проекта в цепочке ────────────────────────────────────────────

  /**
   * Для каждого шага: есть ли покрывающая мера у данного проекта
   * @param {Event[]} projectEvents - лента событий проекта
   * @param {Measure[]} measures - концепты мер
   * @returns {StepStatus[]}
   */
  getProgress(projectEvents, measures) {
    const fundedMeasureIds = projectEvents
      .filter(e => e.type === 'MEASURE_FUNDED')
      .map(e => e.data?.measure)

    return (this.chain || []).map(step => {
      const stepMeasures = measures.filter(m =>
        m.chain_id === this.id && m.chain_step === step.step
      )
      const activeMeasures = stepMeasures.filter(m => fundedMeasureIds.includes(m.id))
      const applicableMeasures = stepMeasures.filter(m => m.isApplicable?.(projectEvents))

      return {
        step:      step.step,
        label:     step.label,
        detail:    step.detail,
        measures:  stepMeasures,
        active:    activeMeasures,     // уже получены
        available: applicableMeasures, // можно подать сейчас
        covered:   activeMeasures.length > 0,
        gap:       stepMeasures.length === 0,
        phase:     this._stepPhase(step.step),
      }
    })
  }

  // ─── Текущий активный шаг ─────────────────────────────────────────────────

  getCurrentStep(projectEvents, measures) {
    const progress = this.getProgress(projectEvents, measures)
    // Первый шаг без покрытия (не пробел, а просто ещё не дошли)
    return progress.find(s => !s.covered && !s.gap) || progress.at(-1)
  }

  // ─── Пробелы в цепочке ────────────────────────────────────────────────────

  getGaps(measures) {
    return (this.chain || []).filter(step => {
      const stepMeasures = measures.filter(m =>
        m.chain_id === this.id && m.chain_step === step.step
      )
      return stepMeasures.length === 0 && ['Концепция', 'Пилот', 'НПА', 'Мера'].includes(step.step)
    })
  }

  // ─── Триггерное событие ───────────────────────────────────────────────────

  getTriggerEventType() {
    const map = {
      market_failure:      'MARKET_FAILURE_DETECTED',
      tech_gap:            'TECH_GAP_DETECTED',
      regulatory_barrier:  'REGULATORY_BARRIER_DETECTED',
      infrastructure_gap:  'INFRA_GAP_DETECTED',
    }
    return map[this.id] || null
  }

  isTriggered(projectEvents) {
    const evtType = this.getTriggerEventType()
    return evtType ? projectEvents.some(e => e.type === evtType) : false
  }

  // ─── Утилиты ──────────────────────────────────────────────────────────────

  _stepPhase(step) {
    const phases = {
      'Триггер':      'diagnose',
      'Диагностика':  'diagnose',
      'Рабочая группа': 'organize',
      'Концепция':    'design',
      'Пилот':        'pilot',
      'НПА':          'legal',
      'Мера':         'fund',
    }
    return phases[step] || 'other'
  }
}

/** Обернуть EVENT_CHAINS в концепты */
export function asChains(chainsArray) {
  return chainsArray.map(c => c instanceof EventChain ? c : new EventChain(c))
}
