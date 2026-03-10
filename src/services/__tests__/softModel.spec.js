/**
 * Unit Tests — softModel.js
 *
 * Тестируем событийную онтологию самого ПО VentureOS.
 * Чистые функции: нет зависимостей, нет моков.
 */
import { describe, it, expect } from 'vitest'
import {
  moduleState,
  moduleHealth,
  healthColor,
  findModuleGaps,
  nextPossibleActions,
  platformStats,
  counterfactual,
} from '../softModel.js'

// ─── Фикстуры ─────────────────────────────────────────────────────────────────

function makeEvt(type, data = {}) {
  return { id: `e_${Math.random().toString(36).slice(2)}`, type, data, ts: Date.now() }
}

const BORN_MODULE = [
  makeEvt('MODULE_BORN', { name: 'TestModule', path: '/test', phase: 'Разработка' }),
]

const HEALTHY_MODULE = [
  makeEvt('MODULE_BORN', { name: 'HealthyModule' }),
  makeEvt('FEATURE_ADDED', { auto: true }),
  makeEvt('FEATURE_ADDED', { auto: true }),
  makeEvt('EVENT_CONNECTED', {}),
  makeEvt('AI_CONNECTED', {}),
  makeEvt('TEST_ADDED', { name: 'basic.spec.js' }),
  makeEvt('TEST_PASSED', { name: 'basic.spec.js' }),
  makeEvt('DEPLOYED', { env: 'production' }),
]

const BROKEN_MODULE = [
  makeEvt('MODULE_BORN', { name: 'BrokenModule' }),
  makeEvt('FEATURE_ADDED', {}),
  makeEvt('BUG_FOUND', { description: 'crash on load' }),
  makeEvt('BUG_FOUND', { description: 'null pointer' }),
]

// ─── moduleState ──────────────────────────────────────────────────────────────

describe('moduleState', () => {
  it('пустая лента → дефолтное состояние', () => {
    const s = moduleState([])
    expect(s.featureCount).toBe(0)
    expect(s.testCount).toBe(0)
    expect(s.openBugs).toBe(0)
    expect(s.hasEventStore).toBe(false)
    expect(s.hasAI).toBe(false)
    expect(s.isDeployed).toBe(false)
  })

  it('MODULE_BORN устанавливает name, path, phase', () => {
    const s = moduleState(BORN_MODULE)
    expect(s.name).toBe('TestModule')
    expect(s.path).toBe('/test')
    expect(s.phase).toBe('Разработка')
  })

  it('FEATURE_ADDED инкрементирует featureCount', () => {
    const events = [
      ...BORN_MODULE,
      makeEvt('FEATURE_ADDED', {}),
      makeEvt('FEATURE_ADDED', {}),
      makeEvt('FEATURE_ADDED', {}),
    ]
    expect(moduleState(events).featureCount).toBe(3)
  })

  it('EVENT_CONNECTED ставит hasEventStore: true', () => {
    const s = moduleState([...BORN_MODULE, makeEvt('EVENT_CONNECTED', {})])
    expect(s.hasEventStore).toBe(true)
  })

  it('AI_CONNECTED ставит hasAI: true', () => {
    const s = moduleState([...BORN_MODULE, makeEvt('AI_CONNECTED', {})])
    expect(s.hasAI).toBe(true)
  })

  it('STORE_CONNECTED ставит hasStore: true', () => {
    const s = moduleState([...BORN_MODULE, makeEvt('STORE_CONNECTED', {})])
    expect(s.hasStore).toBe(true)
  })

  it('TEST_ADDED инкрементирует testCount', () => {
    const events = [...BORN_MODULE, makeEvt('TEST_ADDED', {}), makeEvt('TEST_ADDED', {})]
    expect(moduleState(events).testCount).toBe(2)
  })

  it('BUG_FOUND инкрементирует openBugs', () => {
    const s = moduleState(BROKEN_MODULE)
    expect(s.openBugs).toBe(2)
  })

  it('BUG_FIXED декрементирует openBugs', () => {
    const events = [
      ...BROKEN_MODULE,
      makeEvt('BUG_FIXED', {}),
    ]
    expect(moduleState(events).openBugs).toBe(1)
  })

  it('BUG_FIXED не уходит ниже 0', () => {
    const events = [
      ...BORN_MODULE,
      makeEvt('BUG_FIXED', {}), // нет BUG_FOUND
    ]
    expect(moduleState(events).openBugs).toBe(0)
  })

  it('DEPLOYED ставит isDeployed: true и сохраняет ts', () => {
    const s = moduleState([...BORN_MODULE, makeEvt('DEPLOYED', { env: 'production' })])
    expect(s.isDeployed).toBe(true)
    expect(s.lastDeploy).toBeDefined()
  })

  it('INTEGRATION_ADDED добавляет в массив integrations', () => {
    const events = [
      ...BORN_MODULE,
      makeEvt('EVENT_CONNECTED', {}),
      makeEvt('INTEGRATION_ADDED', { with: 'grEventStore' }),
      makeEvt('INTEGRATION_ADDED', { with: 'eventStore' }),
    ]
    const s = moduleState(events)
    expect(s.integrations).toContain('grEventStore')
    expect(s.integrations).toContain('eventStore')
    expect(s.integrations.length).toBe(2)
  })

  it('COVERAGE_GAP добавляет в detectedGaps (без дублей)', () => {
    const events = [
      ...BORN_MODULE,
      makeEvt('COVERAGE_GAP', { gap: 'no_tests' }),
      makeEvt('COVERAGE_GAP', { gap: 'no_tests' }), // дубль
    ]
    const s = moduleState(events)
    expect(s.detectedGaps).toContain('no_tests')
    expect(s.detectedGaps.filter(g => g === 'no_tests').length).toBe(1)
  })

  it('GAP_CLOSED убирает из detectedGaps', () => {
    const events = [
      ...BORN_MODULE,
      makeEvt('COVERAGE_GAP', { gap: 'no_tests' }),
      makeEvt('GAP_CLOSED', { gap: 'no_tests' }),
    ]
    const s = moduleState(events)
    expect(s.detectedGaps).not.toContain('no_tests')
  })

  it('REFACTOR_DONE инкрементирует refactorCount', () => {
    const events = [...BORN_MODULE, makeEvt('FEATURE_ADDED', {}), makeEvt('REFACTOR_DONE', {})]
    expect(moduleState(events).refactorCount).toBe(1)
  })
})

// ─── moduleHealth ─────────────────────────────────────────────────────────────

describe('moduleHealth', () => {
  it('пустая лента → базовый score (20)', () => {
    expect(moduleHealth([])).toBe(20)
  })

  it('здоровый модуль → высокий score (≥80)', () => {
    expect(moduleHealth(HEALTHY_MODULE)).toBeGreaterThanOrEqual(80)
  })

  it('HEALTHY > BORN > BROKEN', () => {
    const h1 = moduleHealth(HEALTHY_MODULE)
    const h2 = moduleHealth(BORN_MODULE)
    const h3 = moduleHealth(BROKEN_MODULE)
    expect(h1).toBeGreaterThan(h2)
    expect(h2).toBeGreaterThan(h3)
  })

  it('каждый BUG_FOUND снижает health на 15', () => {
    const base = moduleHealth(BORN_MODULE)
    const withBug = moduleHealth([...BORN_MODULE, makeEvt('BUG_FOUND', {})])
    expect(base - withBug).toBe(15)
  })

  it('результат всегда в диапазоне [0, 100]', () => {
    const extremeEvents = [
      ...BORN_MODULE,
      ...Array(10).fill(null).map(() => makeEvt('BUG_FOUND', {})),
    ]
    const h = moduleHealth(extremeEvents)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThanOrEqual(100)
  })
})

// ─── healthColor ──────────────────────────────────────────────────────────────

describe('healthColor', () => {
  it('≥80 → зелёный', () => expect(healthColor(80)).toBe('#4caf50'))
  it('60-79 → светло-зелёный', () => expect(healthColor(65)).toBe('#8bc34a'))
  it('40-59 → жёлтый', () => expect(healthColor(50)).toBe('#ffc107'))
  it('20-39 → оранжевый', () => expect(healthColor(30)).toBe('#ff9800'))
  it('<20 → красный', () => expect(healthColor(10)).toBe('#f44336'))
})

// ─── findModuleGaps ───────────────────────────────────────────────────────────

describe('findModuleGaps', () => {
  it('новый модуль без eventStore → gap no_event_store', () => {
    const gaps = findModuleGaps(BORN_MODULE)
    expect(gaps.find(g => g.id === 'no_event_store')).toBeDefined()
  })

  it('модуль с eventStore → нет gap no_event_store', () => {
    const events = [...BORN_MODULE, makeEvt('EVENT_CONNECTED', {})]
    const gaps = findModuleGaps(events)
    expect(gaps.find(g => g.id === 'no_event_store')).toBeUndefined()
  })

  it('фичи без тестов → gap no_tests', () => {
    const events = [...BORN_MODULE, makeEvt('FEATURE_ADDED', {})]
    const gaps = findModuleGaps(events)
    expect(gaps.find(g => g.id === 'no_tests')).toBeDefined()
  })

  it('фичи с тестами → нет gap no_tests', () => {
    const events = [
      ...BORN_MODULE,
      makeEvt('FEATURE_ADDED', {}),
      makeEvt('TEST_ADDED', {}),
    ]
    expect(findModuleGaps(events).find(g => g.id === 'no_tests')).toBeUndefined()
  })

  it('без AI → gap no_ai', () => {
    const gaps = findModuleGaps(BORN_MODULE)
    expect(gaps.find(g => g.id === 'no_ai')).toBeDefined()
  })

  it('с AI → нет gap no_ai', () => {
    const events = [...BORN_MODULE, makeEvt('AI_CONNECTED', {})]
    expect(findModuleGaps(events).find(g => g.id === 'no_ai')).toBeUndefined()
  })

  it('открытые баги → gap open_bugs', () => {
    const gaps = findModuleGaps(BROKEN_MODULE)
    const bugGap = gaps.find(g => g.id === 'open_bugs')
    expect(bugGap).toBeDefined()
    expect(bugGap.count).toBe(2)
  })

  it('здоровый модуль → нет critical gaps', () => {
    const gaps = findModuleGaps(HEALTHY_MODULE)
    const critical = gaps.filter(g => g.severity === 'critical')
    expect(critical.length).toBe(0)
  })
})

// ─── nextPossibleActions ──────────────────────────────────────────────────────

describe('nextPossibleActions', () => {
  it('нет MODULE_BORN → нет предложений', () => {
    expect(nextPossibleActions([])).toEqual([])
  })

  it('без eventStore → рекомендует EVENT_CONNECTED с приоритетом critical', () => {
    const next = nextPossibleActions(BORN_MODULE)
    const action = next.find(a => a.type === 'EVENT_CONNECTED')
    expect(action).toBeDefined()
    expect(action.priority).toBe('critical')
  })

  it('с eventStore → не рекомендует EVENT_CONNECTED', () => {
    const events = [...BORN_MODULE, makeEvt('EVENT_CONNECTED', {}), makeEvt('FEATURE_ADDED', {})]
    const next = nextPossibleActions(events)
    expect(next.find(a => a.type === 'EVENT_CONNECTED')).toBeUndefined()
  })

  it('фичи без тестов → рекомендует TEST_ADDED', () => {
    const events = [...BORN_MODULE, makeEvt('FEATURE_ADDED', {})]
    const next = nextPossibleActions(events)
    expect(next.find(a => a.type === 'TEST_ADDED')).toBeDefined()
  })

  it('баги → рекомендует BUG_FIXED с критическим приоритетом', () => {
    const next = nextPossibleActions(BROKEN_MODULE)
    const action = next.find(a => a.type === 'BUG_FIXED')
    expect(action).toBeDefined()
    expect(action.priority).toBe('critical')
  })

  it('порядок: critical сначала', () => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    const next = nextPossibleActions([...BROKEN_MODULE, makeEvt('FEATURE_ADDED', {})])
    for (let i = 1; i < next.length; i++) {
      const a = order[next[i - 1].priority] ?? 2
      const b = order[next[i].priority] ?? 2
      expect(a).toBeLessThanOrEqual(b)
    }
  })
})

// ─── platformStats ────────────────────────────────────────────────────────────

describe('platformStats', () => {
  it('нет модулей → total: 0', () => {
    const s = platformStats({})
    expect(s.total).toBe(0)
  })

  it('подсчитывает модули с eventStore', () => {
    const timelines = {
      healthy: HEALTHY_MODULE,
      born:    BORN_MODULE,
    }
    const s = platformStats(timelines)
    expect(s.total).toBe(2)
    expect(s.withEventStore).toBe(1)
  })

  it('avgHealth — среднее по всем модулям', () => {
    const timelines = { m1: HEALTHY_MODULE, m2: BORN_MODULE }
    const s = platformStats(timelines)
    const expected = Math.round((moduleHealth(HEALTHY_MODULE) + moduleHealth(BORN_MODULE)) / 2)
    expect(s.avgHealth).toBe(expected)
  })

  it('coverage.eventStore — процент модулей с eventStore', () => {
    const timelines = {
      healthy: HEALTHY_MODULE,       // has eventStore
      born:    BORN_MODULE,          // no eventStore
      broken:  BROKEN_MODULE,        // no eventStore
    }
    const s = platformStats(timelines)
    expect(s.coverage.eventStore).toBe(Math.round(1 / 3 * 100))
  })

  it('criticalModules — модули с health < 40', () => {
    const timelines = {
      healthy: HEALTHY_MODULE,
      broken:  BROKEN_MODULE,
    }
    const s = platformStats(timelines)
    const brokenHealth = moduleHealth(BROKEN_MODULE)
    if (brokenHealth < 40) {
      expect(s.criticalModules).toContain('broken')
    }
    expect(s.criticalModules).not.toContain('healthy')
  })
})

// ─── counterfactual ───────────────────────────────────────────────────────────

describe('counterfactual (softModel)', () => {
  it('убираем EVENT_CONNECTED — hasEventStore: false в alternatState', () => {
    const result = counterfactual(HEALTHY_MODULE, 'EVENT_CONNECTED')
    expect(result.stateBefore.hasEventStore).toBe(false)
    expect(result.stateAfter.hasEventStore).toBe(true)
  })

  it('healthDelta отражает потерю очков', () => {
    const result = counterfactual(HEALTHY_MODULE, 'EVENT_CONNECTED')
    expect(result.healthDelta).toBeGreaterThan(0)
  })

  it('убираем несуществующий тип — состояние не изменяется', () => {
    const result = counterfactual(BORN_MODULE, 'NONEXISTENT')
    expect(result.removedCount).toBe(0)
    expect(result.healthDelta).toBe(0)
  })
})
