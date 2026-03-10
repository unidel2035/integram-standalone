/**
 * Unit Tests — eventStore.js
 *
 * Тестируем ядро: append-only лог событий, state projection, персистентность.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Мок fetch — изолируем от бэкенда
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve([]),
})))

// Мок eventRegistry — избегаем сайд-эффектов
vi.mock('@/config/eventRegistry.js', () => ({
  getEventDef: () => null,
}))

import { useEventStore } from '../eventStore.js'

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

// ─── add / getTimeline ────────────────────────────────────────────────────────

describe('add + getTimeline', () => {
  it('добавляет событие в ленту', () => {
    const store = useEventStore()
    store.add('company', 'c1', 'KPI_UPDATED', { irr: 18 })
    const tl = store.getTimeline('company', 'c1')
    expect(tl.length).toBe(1)
    expect(tl[0].type).toBe('KPI_UPDATED')
    expect(tl[0].data.irr).toBe(18)
  })

  it('событие имеет обязательные поля', () => {
    const store = useEventStore()
    const evt = store.add('deal', 'd1', 'DEAL_SOURCED', { name: 'TestDeal' })
    expect(evt.id).toBeDefined()
    expect(evt.entityType).toBe('deal')
    expect(evt.entityId).toBe('d1')
    expect(evt.ts).toBeDefined()
    expect(typeof evt.ts).toBe('number')
  })

  it('несколько событий одной сущности сохраняются в порядке добавления', () => {
    const store = useEventStore()
    store.add('project', 'p1', 'PROJECT_STARTED', { trl: 3 })
    store.add('project', 'p1', 'MEASURE_APPLIED', { measure: 'x' })
    store.add('project', 'p1', 'MEASURE_APPROVED', { measure: 'x' })
    const tl = store.getTimeline('project', 'p1')
    expect(tl.length).toBe(3)
    expect(tl[0].type).toBe('PROJECT_STARTED')
    expect(tl[2].type).toBe('MEASURE_APPROVED')
  })

  it('разные сущности не смешиваются', () => {
    const store = useEventStore()
    store.add('company', 'c1', 'KPI_UPDATED', {})
    store.add('company', 'c2', 'KPI_UPDATED', {})
    store.add('deal',    'd1', 'DEAL_SOURCED', {})
    expect(store.getTimeline('company', 'c1').length).toBe(1)
    expect(store.getTimeline('company', 'c2').length).toBe(1)
    expect(store.getTimeline('deal', 'd1').length).toBe(1)
  })

  it('add вызывает fetch для персистентности', () => {
    const store = useEventStore()
    store.add('fund', 'f1', 'NAV_UPDATED', { nav: 1_000_000 })
    expect(fetch).toHaveBeenCalled()
  })

  it('getTimeline несуществующей сущности → пустой массив', () => {
    const store = useEventStore()
    expect(store.getTimeline('deal', 'nonexistent')).toEqual([])
  })
})

// ─── remove ───────────────────────────────────────────────────────────────────

describe('remove', () => {
  it('удаляет событие по id', () => {
    const store = useEventStore()
    store.add('session', 's1', 'SESSION_STARTED', {})
    const evt = store.add('session', 's1', 'ARGUMENT_RAISED', { text: 'abc' })
    store.remove('session', 's1', evt.id)
    const tl = store.getTimeline('session', 's1')
    expect(tl.length).toBe(1)
    expect(tl.find(e => e.id === evt.id)).toBeUndefined()
  })

  it('удаление несуществующего id не ломает ленту', () => {
    const store = useEventStore()
    store.add('session', 's2', 'SESSION_STARTED', {})
    store.remove('session', 's2', 'bad-id')
    expect(store.getTimeline('session', 's2').length).toBe(1)
  })
})

// ─── clear ────────────────────────────────────────────────────────────────────

describe('clear', () => {
  it('очищает всю ленту сущности', () => {
    const store = useEventStore()
    store.add('lead', 'l1', 'LEAD_STARTED', {})
    store.add('lead', 'l1', 'MESSAGE_SENT', {})
    store.clear('lead', 'l1')
    expect(store.getTimeline('lead', 'l1').length).toBe(0)
  })

  it('clear одной сущности не трогает другую', () => {
    const store = useEventStore()
    store.add('lead', 'l1', 'LEAD_STARTED', {})
    store.add('lead', 'l2', 'LEAD_STARTED', {})
    store.clear('lead', 'l1')
    expect(store.getTimeline('lead', 'l2').length).toBe(1)
  })
})

// ─── getIds ───────────────────────────────────────────────────────────────────

describe('getIds', () => {
  it('возвращает все id сущностей данного типа', () => {
    const store = useEventStore()
    store.add('project', 'p1', 'PROJECT_STARTED', {})
    store.add('project', 'p2', 'PROJECT_STARTED', {})
    store.add('company', 'c1', 'COMPANY_ADDED', {})
    const ids = store.getIds('project')
    expect(ids).toContain('p1')
    expect(ids).toContain('p2')
    expect(ids).not.toContain('c1')
  })

  it('нет сущностей → пустой массив', () => {
    const store = useEventStore()
    expect(store.getIds('fund')).toEqual([])
  })
})

// ─── getState ─────────────────────────────────────────────────────────────────

describe('getState', () => {
  it('project: PROJECT_STARTED → trl из события', () => {
    const store = useEventStore()
    store.add('project', 'p1', 'PROJECT_STARTED', { trl: 5, sector: 'БАС' })
    const s = store.getState('project', 'p1')
    expect(s.trl).toBe(5)
    expect(s.sector).toBe('БАС')
  })

  it('company: KPI_UPDATED → kpi слияние', () => {
    const store = useEventStore()
    store.add('company', 'c1', 'KPI_UPDATED', { irr: 18 })
    store.add('company', 'c1', 'KPI_UPDATED', { runway: 12 })
    const s = store.getState('company', 'c1')
    expect(s.kpi.irr).toBe(18)
    expect(s.kpi.runway).toBe(12)
  })

  it('deal: фаза переходит по событиям', () => {
    const store = useEventStore()
    store.add('deal', 'd1', 'DEAL_SOURCED', {})
    expect(store.getState('deal', 'd1').phase).toBe('source')
    store.add('deal', 'd1', 'TERM_SHEET_SIGNED', {})
    expect(store.getState('deal', 'd1').phase).toBe('dd')
    store.add('deal', 'd1', 'DD_COMPLETED', {})
    expect(store.getState('deal', 'd1').phase).toBe('close')
    store.add('deal', 'd1', 'DEAL_CLOSED', { amount: 5_000_000 })
    expect(store.getState('deal', 'd1').phase).toBe('post-close')
  })

  it('session: DECISION_MADE завершает сессию с вердиктом', () => {
    const store = useEventStore()
    store.add('session', 's1', 'SESSION_STARTED', { projectId: 'p1', projectName: 'Test' })
    store.add('session', 's1', 'VOTE_CAST', { agent: 'analyst', vote: 'yes' })
    store.add('session', 's1', 'DECISION_MADE', { verdict: 'APPROVE', score: 85 })
    const s = store.getState('session', 's1')
    expect(s.phase).toBe('closed')
    expect(s.decision).toBe('APPROVE')
    expect(s.score).toBe(85)
  })

  it('fund: LP_COMMITTED аккумулирует totalCommitted', () => {
    const store = useEventStore()
    store.add('fund', 'f1', 'LP_COMMITTED', { amount: 100_000_000 })
    store.add('fund', 'f1', 'LP_COMMITTED', { amount: 200_000_000 })
    expect(store.getState('fund', 'f1').totalCommitted).toBe(300_000_000)
  })

  it('lead: фаза прогрессирует через события', () => {
    const store = useEventStore()
    store.add('lead', 'l1', 'LEAD_STARTED', {})
    expect(store.getState('lead', 'l1').phase).toBe('intake')
    store.add('lead', 'l1', 'TWIN_THRESHOLD_30', {})
    expect(store.getState('lead', 'l1').phase).toBe('research')
    store.add('lead', 'l1', 'SENT_TO_IC', { sessionId: 'sess-1' })
    expect(store.getState('lead', 'l1').phase).toBe('submit')
  })

  it('неизвестный entityType → пустой объект', () => {
    const store = useEventStore()
    expect(store.getState('unknown_type', 'id1')).toEqual({})
  })
})

// ─── getLastEvent ─────────────────────────────────────────────────────────────

describe('getLastEvent', () => {
  it('возвращает последнее событие', () => {
    const store = useEventStore()
    store.add('company', 'c1', 'KPI_UPDATED', { irr: 10 })
    store.add('company', 'c1', 'KPI_UPDATED', { irr: 20 })
    const last = store.getLastEvent('company', 'c1')
    expect(last.data.irr).toBe(20)
  })

  it('фильтр по типу', () => {
    const store = useEventStore()
    store.add('company', 'c1', 'KPI_UPDATED', { irr: 10 })
    store.add('company', 'c1', 'RISK_ELEVATED', { level: 'high' })
    store.add('company', 'c1', 'KPI_UPDATED', { irr: 15 })
    const last = store.getLastEvent('company', 'c1', 'RISK_ELEVATED')
    expect(last.type).toBe('RISK_ELEVATED')
  })

  it('нет событий → null', () => {
    const store = useEventStore()
    expect(store.getLastEvent('deal', 'd99')).toBeNull()
  })
})

// ─── getStats ─────────────────────────────────────────────────────────────────

describe('getStats', () => {
  it('total и byType считаются правильно', () => {
    const store = useEventStore()
    store.add('project', 'p1', 'PROJECT_STARTED', {})
    store.add('project', 'p1', 'MEASURE_APPLIED', {})
    store.add('project', 'p1', 'MEASURE_APPLIED', {})
    const stats = store.getStats('project', 'p1')
    expect(stats.total).toBe(3)
    expect(stats.byType['PROJECT_STARTED']).toBe(1)
    expect(stats.byType['MEASURE_APPLIED']).toBe(2)
  })

  it('state включён в stats', () => {
    const store = useEventStore()
    store.add('project', 'p1', 'PROJECT_STARTED', { trl: 4, sector: 'РОБО' })
    const stats = store.getStats('project', 'p1')
    expect(stats.state.trl).toBe(4)
    expect(stats.state.sector).toBe('РОБО')
  })
})

// ─── grTimelines computed ─────────────────────────────────────────────────────

describe('grTimelines', () => {
  it('возвращает только project-ленты', () => {
    const store = useEventStore()
    store.add('project', 'proj-1', 'PROJECT_STARTED', {})
    store.add('company', 'comp-1', 'COMPANY_ADDED', {})
    const gt = store.grTimelines
    expect(gt['proj-1']).toBeDefined()
    expect(gt['comp-1']).toBeUndefined()
  })
})

// ─── load ─────────────────────────────────────────────────────────────────────

describe('load', () => {
  it('load() вызывает fetch с правильным URL', async () => {
    const store = useEventStore()
    await store.load('project', 'p1')
    expect(fetch).toHaveBeenCalledWith('/api/events/project/p1')
  })

  it('load(_all) вызывает fetch по типу сущности', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ timelines: {} }),
    })))
    const store = useEventStore()
    await store.load('session', '_all')
    expect(fetch).toHaveBeenCalledWith('/api/events/session')
  })

  it('load() не ломается при ошибке сети', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network error'))))
    const store = useEventStore()
    await expect(store.load('deal', 'd1')).resolves.toBeUndefined()
  })

  it('load() мержит remote с локально новыми событиями', async () => {
    const remoteEvts = [
      { id: 'r1', entityType: 'company', entityId: 'c1', type: 'KPI_UPDATED', ts: 1000, data: {} },
    ]
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(remoteEvts),
    })))
    const store = useEventStore()
    // Локальное событие с ts > remote.last
    const localEvt = store.add('company', 'c1', 'RISK_ELEVATED', {})
    await store.load('company', 'c1')
    const tl = store.getTimeline('company', 'c1')
    // Remote (ts=1000) + local (ts > 1000) должны быть в ленте
    expect(tl.find(e => e.id === 'r1')).toBeDefined()
    expect(tl.find(e => e.id === localEvt.id)).toBeDefined()
  })
})

// ─── shortcuts ────────────────────────────────────────────────────────────────

describe('shortcuts', () => {
  it('addProjectEvent пишет в project entity', () => {
    const store = useEventStore()
    store.addProjectEvent('p1', 'PROJECT_STARTED', { trl: 3 })
    expect(store.getTimeline('project', 'p1').length).toBe(1)
  })

  it('addDealEvent пишет в deal entity', () => {
    const store = useEventStore()
    store.addDealEvent('d1', 'DEAL_SOURCED', {})
    expect(store.getTimeline('deal', 'd1').length).toBe(1)
  })

  it('addLeadEvent пишет в lead entity', () => {
    const store = useEventStore()
    store.addLeadEvent('l1', 'LEAD_STARTED', {})
    expect(store.getTimeline('lead', 'l1').length).toBe(1)
  })
})
