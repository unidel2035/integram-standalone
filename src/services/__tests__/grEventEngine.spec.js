/**
 * Unit Tests — grEventEngine.js
 *
 * Чистые функции: нет зависимостей, нет моков.
 * Тестируем: projectState, nextPossibleEvents, timelineStats, counterfactual, findTemporalGaps
 */
import { describe, it, expect } from 'vitest'
import {
  projectState,
  nextPossibleEvents,
  timelineStats,
  counterfactual,
  findTemporalGaps,
  buildCausalDag,
  eventDensity,
} from '../grEventEngine.js'

// ─── Фикстуры ────────────────────────────────────────────────────────────────

const ts = (offset = 0) => Date.now() - offset * 1000

function makeEvent(type, data = {}, id = null) {
  return { id: id || `evt_${Math.random().toString(36).slice(2)}`, type, data, ts: ts() }
}

const BAS_PROJECT = [
  makeEvent('PROJECT_STARTED', { trl: 3, sector: 'БАС', stage: 'Pre-seed', name: 'TestProject' }),
  makeEvent('MARKET_FAILURE_DETECTED', {}),
  makeEvent('TECH_GAP_DETECTED', {}),
]

const FUNDED_PROJECT = [
  ...BAS_PROJECT,
  makeEvent('MEASURE_APPLIED', { measure: 'fasie-start1' }),
  makeEvent('MEASURE_APPROVED', { measure: 'fasie-start1' }),
  makeEvent('MEASURE_FUNDED',   { measure: 'fasie-start1', amount: 4_000_000 }),
]

// ─── projectState ─────────────────────────────────────────────────────────────

describe('projectState', () => {
  it('пустая лента → дефолтное состояние', () => {
    const s = projectState([])
    expect(s.trl).toBe(1)
    expect(s.sector).toBe('БАС')
    expect(s.totalFunding).toBe(0)
    expect(s.triggers).toEqual([])
  })

  it('PROJECT_STARTED устанавливает trl, sector, stage', () => {
    const s = projectState([makeEvent('PROJECT_STARTED', { trl: 5, sector: 'РОБО', stage: 'Seed' })])
    expect(s.trl).toBe(5)
    expect(s.sector).toBe('РОБО')
    expect(s.stage).toBe('Seed')
  })

  it('TRL_ADVANCED увеличивает trl на 1', () => {
    const events = [
      makeEvent('PROJECT_STARTED', { trl: 4, sector: 'БАС' }),
      makeEvent('TRL_ADVANCED', {}),
    ]
    expect(projectState(events).trl).toBe(5)
  })

  it('TRL_ADVANCED с явным to устанавливает точное значение', () => {
    const events = [
      makeEvent('PROJECT_STARTED', { trl: 3, sector: 'БАС' }),
      makeEvent('TRL_ADVANCED', { to: 7 }),
    ]
    expect(projectState(events).trl).toBe(7)
  })

  it('MEASURE_FUNDED аккумулирует финансирование', () => {
    const s = projectState(FUNDED_PROJECT)
    expect(s.totalFunding).toBe(4_000_000)
  })

  it('несколько MEASURE_FUNDED суммируются', () => {
    const events = [
      ...FUNDED_PROJECT,
      makeEvent('MEASURE_FUNDED', { measure: 'fasie-start2', amount: 6_000_000 }),
    ]
    expect(projectState(events).totalFunding).toBe(10_000_000)
  })

  it('MEASURE_APPLIED добавляет в appliedMeasures', () => {
    const s = projectState([
      makeEvent('PROJECT_STARTED', { trl: 3 }),
      makeEvent('MEASURE_APPLIED', { measure: 'fasie-start1' }),
    ])
    expect(s.appliedMeasures).toContain('fasie-start1')
  })

  it('MARKET_FAILURE_DETECTED добавляет триггер', () => {
    const s = projectState(BAS_PROJECT)
    expect(s.triggers).toContain('market_failure')
  })

  it('все 4 триггера могут быть в одном проекте', () => {
    const events = [
      makeEvent('PROJECT_STARTED', { trl: 3 }),
      makeEvent('MARKET_FAILURE_DETECTED', {}),
      makeEvent('TECH_GAP_DETECTED', {}),
      makeEvent('REGULATORY_BARRIER_DETECTED', {}),
      makeEvent('INFRA_GAP_DETECTED', {}),
    ]
    const s = projectState(events)
    expect(s.triggers.length).toBe(4)
    expect(s.triggers).toContain('market_failure')
    expect(s.triggers).toContain('tech_gap')
    expect(s.triggers).toContain('regulatory_barrier')
    expect(s.triggers).toContain('infrastructure_gap')
  })

  it('PILOT_COMPLETED ставит pilotDone: true', () => {
    const s = projectState([...FUNDED_PROJECT, makeEvent('PILOT_COMPLETED', {})])
    expect(s.pilotDone).toBe(true)
  })

  it('CONTRACT_SIGNED ставит hasContract: true', () => {
    const s = projectState([...FUNDED_PROJECT, makeEvent('CONTRACT_SIGNED', { amount: 10_000_000 })])
    expect(s.hasContract).toBe(true)
  })
})

// ─── nextPossibleEvents ───────────────────────────────────────────────────────

describe('nextPossibleEvents', () => {
  it('пустая лента → пустой список', () => {
    expect(nextPossibleEvents([], [])).toEqual([])
  })

  it('после PROJECT_STARTED → предлагает диагностические события', () => {
    const possible = nextPossibleEvents([makeEvent('PROJECT_STARTED', { trl: 3, sector: 'БАС' })], [])
    const types = possible.map(p => p.type)
    expect(types).toContain('MARKET_FAILURE_DETECTED')
    expect(types).toContain('TECH_GAP_DETECTED')
  })

  it('диагностика не дублируется если уже добавлена', () => {
    const possible = nextPossibleEvents(BAS_PROJECT, [])
    const diagnTypes = possible.filter(p => p.type === 'MARKET_FAILURE_DETECTED')
    expect(diagnTypes.length).toBe(0) // уже есть в BAS_PROJECT
  })

  it('мера с подходящим TRL показывается как доступная', () => {
    const measure = { id: 'test-m', status: 'active', trl_min: 2, trl_max: 5, sector: [] }
    const possible = nextPossibleEvents(BAS_PROJECT, [measure])
    const found = possible.find(p => p.type === 'MEASURE_APPLIED' && p.measure?.id === 'test-m')
    expect(found).toBeDefined()
  })

  it('мера с TRL вне диапазона показывается как заблокированная', () => {
    const measure = { id: 'test-high-trl', status: 'active', trl_min: 7, trl_max: 9, sector: [] }
    const possible = nextPossibleEvents(BAS_PROJECT, [measure])
    const found = possible.find(p => p.measure?.id === 'test-high-trl')
    expect(found?.probability).toBe('blocked')
  })

  it('закрытая мера не предлагается', () => {
    const measure = { id: 'test-closed', status: 'closed', trl_min: 1, trl_max: 9, sector: [] }
    const possible = nextPossibleEvents(BAS_PROJECT, [measure])
    const found = possible.find(p => p.measure?.id === 'test-closed')
    expect(found).toBeUndefined()
  })

  it('применённая мера не предлагается повторно', () => {
    const measure = { id: 'fasie-start1', status: 'active', trl_min: 1, trl_max: 9, sector: [] }
    const possible = nextPossibleEvents(FUNDED_PROJECT, [measure])
    const found = possible.filter(p => p.measure?.id === 'fasie-start1')
    expect(found.length).toBe(0)
  })

  it('после MEASURE_FUNDED предлагает TRL_ADVANCED', () => {
    const possible = nextPossibleEvents(FUNDED_PROJECT, [])
    const types = possible.map(p => p.type)
    expect(types).toContain('TRL_ADVANCED')
  })

  it('порядок: high → medium → low → blocked', () => {
    const measure = { id: 'test-m', status: 'active', trl_min: 2, trl_max: 5, sector: [], triggers: ['market_failure'] }
    const possible = nextPossibleEvents(BAS_PROJECT, [measure])
    const order = { high: 0, medium: 1, low: 2, blocked: 3 }
    for (let i = 1; i < possible.length; i++) {
      const prev = order[possible[i - 1].probability] ?? 2
      const curr = order[possible[i].probability] ?? 2
      expect(prev).toBeLessThanOrEqual(curr)
    }
  })
})

// ─── timelineStats ────────────────────────────────────────────────────────────

describe('timelineStats', () => {
  it('пустая лента → нули', () => {
    const s = timelineStats([])
    expect(s.totalEvents).toBe(0)
    expect(s.totalFunding).toBe(0)
    expect(s.measuresApplied).toBe(0)
  })

  it('подсчитывает меры правильно', () => {
    const s = timelineStats(FUNDED_PROJECT)
    expect(s.measuresApplied).toBe(1)
    expect(s.measuresApproved).toBe(1)
    expect(s.measuresFunded).toBe(1)
    expect(s.measuresRejected).toBe(0)
  })

  it('approvalRate 100% если все поданные одобрены', () => {
    expect(timelineStats(FUNDED_PROJECT).approvalRate).toBe('100%')
  })

  it('approvalRate — если нет поданных', () => {
    expect(timelineStats([]).approvalRate).toBe('—')
  })

  it('triggersFound считает выявленные триггеры', () => {
    expect(timelineStats(BAS_PROJECT).triggersFound).toBe(2)
  })

  it('hasPilot false без PILOT_COMPLETED', () => {
    expect(timelineStats(FUNDED_PROJECT).hasPilot).toBe(false)
  })

  it('hasPilot true с PILOT_COMPLETED', () => {
    const events = [...FUNDED_PROJECT, makeEvent('PILOT_COMPLETED', {})]
    expect(timelineStats(events).hasPilot).toBe(true)
  })
})

// ─── counterfactual ───────────────────────────────────────────────────────────

describe('counterfactual', () => {
  it('убирает событие и пересчитывает состояние', () => {
    const fundEvt = FUNDED_PROJECT.find(e => e.type === 'MEASURE_FUNDED')
    const result = counterfactual(FUNDED_PROJECT, fundEvt.id, [])
    expect(result.alternativeState.totalFunding).toBe(0)
    expect(result.currentState.totalFunding).toBe(4_000_000)
  })

  it('fundingDelta отражает разницу', () => {
    const fundEvt = FUNDED_PROJECT.find(e => e.type === 'MEASURE_FUNDED')
    const result = counterfactual(FUNDED_PROJECT, fundEvt.id, [])
    expect(result.diff.fundingDelta).toBe(4_000_000)
  })

  it('несуществующий id не ломает функцию', () => {
    const result = counterfactual(BAS_PROJECT, 'nonexistent', [])
    expect(result.removedEvent).toBeUndefined()
    expect(result.alternativeState).toBeDefined()
  })
})

// ─── findTemporalGaps ─────────────────────────────────────────────────────────

describe('findTemporalGaps', () => {
  it('нет gaps если мера одобрена быстро', () => {
    const recentFunded = FUNDED_PROJECT.map(e => ({ ...e, ts: Date.now() - 1000 }))
    const gaps = findTemporalGaps(recentFunded)
    expect(gaps.length).toBe(0)
  })

  it('gap появляется если MEASURE_APPLIED без ответа 30+ дней', () => {
    const oldApply = makeEvent('MEASURE_APPLIED', { measure: 'old-m' })
    oldApply.ts = Date.now() - 35 * 24 * 60 * 60 * 1000 // 35 дней назад
    const events = [makeEvent('PROJECT_STARTED', { trl: 3 }), oldApply]
    const gaps = findTemporalGaps(events)
    expect(gaps.length).toBeGreaterThan(0)
    expect(gaps[0].label).toContain('ответа')
  })

  it('gap apply→approve не создаётся если APPROVED получен', () => {
    const applyEvt = makeEvent('MEASURE_APPLIED', { measure: 'm1' })
    applyEvt.ts = Date.now() - 35 * 24 * 60 * 60 * 1000
    const approveEvt = makeEvent('MEASURE_APPROVED', { measure: 'm1' })
    approveEvt.ts = Date.now() - 30 * 24 * 60 * 60 * 1000
    const events = [applyEvt, approveEvt]
    const gaps = findTemporalGaps(events)
    // Gap по apply→approve отсутствует (APPROVED пришёл)
    const approvalGaps = gaps.filter(
      g => g.triggerEvent.type === 'MEASURE_APPLIED' && g.expectedType === 'MEASURE_APPROVED'
    )
    expect(approvalGaps.length).toBe(0)
  })
})

// ─── buildCausalDag ───────────────────────────────────────────────────────────

describe('buildCausalDag', () => {
  it('пустая лента → пустые nodes и edges', () => {
    const dag = buildCausalDag([])
    expect(dag.nodes).toEqual([])
    expect(dag.edges).toEqual([])
  })

  it('FUNDED_PROJECT → nodes содержат все события', () => {
    const dag = buildCausalDag(FUNDED_PROJECT)
    expect(dag.nodes.length).toBe(FUNDED_PROJECT.length)
  })

  it('edges: MEASURE_FUNDED имеет edge от MEASURE_APPROVED', () => {
    const dag = buildCausalDag(FUNDED_PROJECT)
    const approveEvt = FUNDED_PROJECT.find(e => e.type === 'MEASURE_APPROVED')
    const fundEvt    = FUNDED_PROJECT.find(e => e.type === 'MEASURE_FUNDED')
    const edge = dag.edges.find(e => e.from === approveEvt.id && e.to === fundEvt.id)
    expect(edge).toBeDefined()
  })
})

// ─── eventDensity ─────────────────────────────────────────────────────────────

describe('eventDensity', () => {
  it('пустая лента → пустой массив', () => {
    expect(eventDensity([])).toEqual([])
  })

  it('события в одном bucket группируются', () => {
    const now = Date.now()
    // eventDensity требует события отсортированные по ts (от старых к новым)
    const events = [
      { ts: now - 2000, type: 'B' },
      { ts: now - 1000, type: 'A' },
    ]
    const buckets = eventDensity(events, 7)
    const total = buckets.reduce((s, b) => s + b.count, 0)
    expect(total).toBe(2)
  })
})
