/**
 * GR Ontology Graph — граф знаний для логического вывода по мерам поддержки
 *
 * Заменяет ручной CHAIN_STEP_MEASURES и простые if/else фильтры.
 * Обходит граф: Триггер → ЦепочкаСобытий → Шаг → Меры → Следующие меры
 *
 * API:
 *   graph.infer(project)      → структурированный вывод по всем цепочкам
 *   graph.findGaps(project)   → шаги без мер (пробелы в поддержке)
 *   graph.nextSteps(id)       → меры, к которым переходят после данной
 *   graph.byTriggerAndTrl(t, trl) → меры по триггеру и TRL
 */

const SECTOR_MAP = {
  'БАС':  ['БПЛА / БАС', 'Аэрокосмос', 'Все технологические сектора', 'Все секторы'],
  'РОБО': ['Робототехника', 'Промышленность', 'ИТ / ПО', 'Все технологические сектора', 'Все секторы'],
  'МЭ':   ['Промышленность', 'ИТ / ПО', 'Все технологические сектора', 'Все секторы'],
}

class OntologyGraph {
  constructor(measures, chains) {
    this.measures = measures
    this.chains = chains
    this._byTrigger = {}      // triggerId → [measure]
    this._byChainStep = {}    // "chainId:step" → [measure]
    this._nextOf = {}         // measureId → [measureId]
    this._byId = {}           // measureId → measure
    this._buildIndices()
  }

  _buildIndices() {
    for (const m of this.measures) {
      this._byId[m.id] = m
      this._nextOf[m.id] = m.next || []

      for (const t of (m.triggers || [])) {
        if (!this._byTrigger[t]) this._byTrigger[t] = []
        this._byTrigger[t].push(m)
      }

      if (m.chain_id && m.chain_step) {
        const key = `${m.chain_id}:${m.chain_step}`
        if (!this._byChainStep[key]) this._byChainStep[key] = []
        this._byChainStep[key].push(m)
      }
    }
  }

  // ─── Применимость меры к проекту ────────────────────────────────────────────

  _isApplicable(measure, project) {
    const { trl = 4, sector = 'БАС' } = project
    const relevantSectors = SECTOR_MAP[sector] || SECTOR_MAP['БАС']
    const trlOk = trl >= (measure.trl_min || 1) && trl <= (measure.trl_max || 9)
    const sectorOk = !measure.sector?.length || measure.sector.some(s => relevantSectors.includes(s))
    return trlOk && sectorOk && measure.status !== 'closed'
  }

  // ─── Автоопределение триггеров по профилю проекта ───────────────────────────

  _detectTriggers(project) {
    const { trl = 4, sector = 'БАС', hasCertification, hasInfra } = project
    const triggers = new Set()

    // Рыночный провал — ранняя стадия
    if (trl <= 5) triggers.add('market_failure')

    // Технологический разрыв — всегда актуален для deep tech
    triggers.add('tech_gap')

    // Регуляторный барьер — БПЛА, сертификация, новые технологии
    if (hasCertification || sector === 'БАС') triggers.add('regulatory_barrier')

    // Инфраструктурный пробел — производство, испытания
    if (hasInfra || sector === 'БАС' || sector === 'РОБО') triggers.add('infrastructure_gap')

    return [...triggers]
  }

  // ─── Основной метод: логический вывод ───────────────────────────────────────

  /**
   * Вывести применимые меры по профилю проекта с разбивкой по цепочкам
   *
   * @param {object} project - { trl, sector, triggers?, hasCertification?, hasInfra? }
   * @returns {{ chains: ChainResult[], allMeasures: Measure[], gaps: GapInfo[] }}
   *
   * ChainResult = { chain_id, trigger, color, icon, steps: StepResult[] }
   * StepResult  = { step, label, detail, measures: Measure[], gap: boolean }
   * GapInfo     = { chain_id, trigger, step, label }
   */
  infer(project) {
    const activeTriggers = project.triggers || this._detectTriggers(project)
    const seen = new Set()
    const result = { chains: [], allMeasures: [], gaps: [] }

    for (const triggerId of activeTriggers) {
      const chainDef = this.chains.find(c => c.id === triggerId)
      if (!chainDef) continue

      const chainResult = {
        chain_id: triggerId,
        trigger: chainDef.trigger,
        description: chainDef.description,
        color: chainDef.color,
        icon: chainDef.icon,
        steps: [],
      }

      for (const ev of (chainDef.chain || [])) {
        const key = `${triggerId}:${ev.step}`
        const stepMeasures = (this._byChainStep[key] || [])
          .filter(m => this._isApplicable(m, project))

        const stepResult = {
          step: ev.step,
          label: ev.label,
          detail: ev.detail,
          measures: stepMeasures,
          gap: stepMeasures.length === 0 && ['Концепция', 'Пилот', 'НПА', 'Мера'].includes(ev.step),
        }

        chainResult.steps.push(stepResult)

        for (const m of stepMeasures) {
          if (!seen.has(m.id)) {
            seen.add(m.id)
            result.allMeasures.push(m)
          }
        }

        if (stepResult.gap) {
          result.gaps.push({ chain_id: triggerId, trigger: chainDef.trigger, step: ev.step, label: ev.label })
        }
      }

      result.chains.push(chainResult)
    }

    return result
  }

  // ─── Пробелы ─────────────────────────────────────────────────────────────────

  findGaps(project) {
    return this.infer(project).gaps
  }

  // ─── Навигация по графу ──────────────────────────────────────────────────────

  nextSteps(measureId) {
    return (this._nextOf[measureId] || [])
      .map(id => this._byId[id])
      .filter(Boolean)
  }

  byTriggerAndTrl(triggerId, trl) {
    return (this._byTrigger[triggerId] || [])
      .filter(m => trl >= (m.trl_min || 1) && trl <= (m.trl_max || 9) && m.status !== 'closed')
  }

  getById(id) {
    return this._byId[id] || null
  }

  // ─── Маршрут финансирования ──────────────────────────────────────────────────

  /**
   * Построить оптимальный маршрут: от текущего TRL к целевому
   * BFS по графу next-рёбер с фильтром по сектору
   */
  buildRoute(project, targetTrl = 9) {
    const { trl = 1, sector = 'БАС' } = project
    const { allMeasures } = this.infer(project)

    // Сортируем по trl_min — идём снизу вверх
    const sorted = [...allMeasures].sort((a, b) => (a.trl_min || 0) - (b.trl_min || 0))

    // Группируем по trl-диапазонам
    const stages = []
    for (let t = trl; t <= targetTrl; ) {
      const forThisTrl = sorted.filter(m => t >= (m.trl_min || 0) && t <= (m.trl_max || 9))
      if (forThisTrl.length) stages.push({ trl: t, measures: forThisTrl })
      t += 2
    }

    return stages
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _instance = null

export function createOntologyGraph(measures, chains) {
  return new OntologyGraph(measures, chains)
}

export function getOntologyGraph(measures, chains) {
  if (!_instance && measures && chains) {
    _instance = new OntologyGraph(measures, chains)
  }
  return _instance
}
