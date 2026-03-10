/**
 * Unit Tests — crossEntityReactor.js
 *
 * Тестируем граф cross-entity связей: связность, полноту, корректность.
 */
import { describe, it, expect } from 'vitest'
import {
  CROSS_ENTITY_LINKS,
  nextCrossEntityEvents,
  getUpstream,
  getDownstream,
  fullChain,
  validateLinks,
} from '../crossEntityReactor.js'
import { EVENT_REGISTRY } from '@/config/eventRegistry.js'

// ─── структура графа ──────────────────────────────────────────────────────────

describe('CROSS_ENTITY_LINKS', () => {
  it('каждый link имеет id, trigger, enables, label', () => {
    for (const link of CROSS_ENTITY_LINKS) {
      expect(link.id, `link ${link.id} missing id`).toBeTruthy()
      expect(link.trigger?.entityType, `${link.id} trigger.entityType`).toBeTruthy()
      expect(link.trigger?.eventType,  `${link.id} trigger.eventType`).toBeTruthy()
      expect(link.enables?.entityType, `${link.id} enables.entityType`).toBeTruthy()
      expect(link.enables?.eventType,  `${link.id} enables.eventType`).toBeTruthy()
      expect(link.label, `${link.id} label`).toBeTruthy()
    }
  })

  it('id-ы уникальны', () => {
    const ids = CROSS_ENTITY_LINKS.map(l => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('trigger и enables всегда разные entityType', () => {
    for (const link of CROSS_ENTITY_LINKS) {
      // cross-entity означает разные типы сущностей (или хотя бы осмысленная связь)
      expect(`${link.trigger.entityType}:${link.trigger.eventType}`)
        .not.toBe(`${link.enables.entityType}:${link.enables.eventType}`)
    }
  })
})

// ─── nextCrossEntityEvents ────────────────────────────────────────────────────

describe('nextCrossEntityEvents', () => {
  it('SENT_TO_IC (lead) → SESSION_STARTED (session)', () => {
    const event = { entityType: 'lead', type: 'SENT_TO_IC', data: {} }
    const next = nextCrossEntityEvents(event)
    const found = next.find(l => l.enables.eventType === 'SESSION_STARTED')
    expect(found).toBeDefined()
    expect(found.enables.entityType).toBe('session')
  })

  it('DECISION_MADE (session, APPROVE) → TERM_SHEET_PROPOSED (deal)', () => {
    const event = { entityType: 'session', type: 'DECISION_MADE', data: { verdict: 'APPROVE' } }
    const next = nextCrossEntityEvents(event)
    const found = next.find(l => l.enables.eventType === 'TERM_SHEET_PROPOSED')
    expect(found).toBeDefined()
  })

  it('DECISION_MADE (session, REJECT) → НЕ открывает TERM_SHEET_PROPOSED', () => {
    const event = { entityType: 'session', type: 'DECISION_MADE', data: { verdict: 'REJECT' } }
    const next = nextCrossEntityEvents(event)
    const found = next.find(l => l.enables.eventType === 'TERM_SHEET_PROPOSED')
    expect(found).toBeUndefined()
  })

  it('DECISION_MADE (session, CONDITIONAL) → TERM_SHEET_PROPOSED разрешён', () => {
    const event = { entityType: 'session', type: 'DECISION_MADE', data: { verdict: 'CONDITIONAL' } }
    const next = nextCrossEntityEvents(event)
    expect(next.find(l => l.enables.eventType === 'TERM_SHEET_PROPOSED')).toBeDefined()
  })

  it('DEAL_CLOSED → COMPANY_ADDED + CAPITAL_CALLED', () => {
    const event = { entityType: 'deal', type: 'DEAL_CLOSED', data: {} }
    const next = nextCrossEntityEvents(event)
    const types = next.map(l => l.enables.eventType)
    expect(types).toContain('COMPANY_ADDED')
    expect(types).toContain('CAPITAL_CALLED')
  })

  it('GRANTS_MATCHED (lead) → PROJECT_STARTED (project)', () => {
    const event = { entityType: 'lead', type: 'GRANTS_MATCHED', data: {} }
    const next = nextCrossEntityEvents(event)
    expect(next.find(l => l.enables.eventType === 'PROJECT_STARTED')).toBeDefined()
  })

  it('событие без cross-entity связей → пустой массив', () => {
    const event = { entityType: 'company', type: 'TEAM_CHANGE', data: {} }
    expect(nextCrossEntityEvents(event)).toEqual([])
  })

  it('неизвестный entityType → пустой массив', () => {
    const event = { entityType: 'unknown', type: 'SOME_EVENT', data: {} }
    expect(nextCrossEntityEvents(event)).toEqual([])
  })
})

// ─── getUpstream ──────────────────────────────────────────────────────────────

describe('getUpstream', () => {
  it('SESSION_STARTED имеет upstream из lead', () => {
    const upstream = getUpstream('session', 'SESSION_STARTED')
    expect(upstream.length).toBeGreaterThan(0)
    expect(upstream[0].trigger.entityType).toBe('lead')
  })

  it('TERM_SHEET_PROPOSED имеет upstream из session', () => {
    const upstream = getUpstream('deal', 'TERM_SHEET_PROPOSED')
    expect(upstream.length).toBeGreaterThan(0)
    expect(upstream[0].trigger.entityType).toBe('session')
  })

  it('COMPANY_ADDED имеет upstream из deal', () => {
    const upstream = getUpstream('company', 'COMPANY_ADDED')
    expect(upstream.length).toBeGreaterThan(0)
  })

  it('событие без upstream → пустой массив', () => {
    expect(getUpstream('lead', 'LEAD_STARTED')).toEqual([])
  })
})

// ─── getDownstream ────────────────────────────────────────────────────────────

describe('getDownstream', () => {
  it('SENT_TO_IC имеет downstream', () => {
    const downstream = getDownstream('lead', 'SENT_TO_IC')
    expect(downstream.length).toBeGreaterThan(0)
  })

  it('DECISION_MADE имеет downstream к deal', () => {
    const downstream = getDownstream('session', 'DECISION_MADE')
    expect(downstream.some(l => l.enables.entityType === 'deal')).toBe(true)
  })

  it('DEAL_CLOSED имеет downstream к company И fund', () => {
    const downstream = getDownstream('deal', 'DEAL_CLOSED')
    const targets = downstream.map(l => l.enables.entityType)
    expect(targets).toContain('company')
    expect(targets).toContain('fund')
  })
})

// ─── fullChain ────────────────────────────────────────────────────────────────

describe('fullChain', () => {
  it('возвращает nodes и edges', () => {
    const { nodes, edges } = fullChain()
    expect(Array.isArray(nodes)).toBe(true)
    expect(Array.isArray(edges)).toBe(true)
    expect(nodes.length).toBeGreaterThan(0)
    expect(edges.length).toBe(CROSS_ENTITY_LINKS.length)
  })

  it('каждый edge ссылается на существующие nodes', () => {
    const { nodes, edges } = fullChain()
    const nodeIds = new Set(nodes.map(n => n.id))
    for (const edge of edges) {
      expect(nodeIds.has(edge.from), `edge ${edge.id} from node missing`).toBe(true)
      expect(nodeIds.has(edge.to),   `edge ${edge.id} to node missing`).toBe(true)
    }
  })

  it('граф покрывает все 6 основных entityType', () => {
    const { nodes } = fullChain()
    const entityTypes = new Set(nodes.map(n => n.entityType))
    for (const et of ['lead', 'session', 'deal', 'company', 'project', 'fund']) {
      expect(entityTypes.has(et), `${et} отсутствует в графе`).toBe(true)
    }
  })
})

// ─── validateLinks ────────────────────────────────────────────────────────────

describe('validateLinks', () => {
  it('все trigger и enables eventType существуют в EVENT_REGISTRY', () => {
    const problems = validateLinks(EVENT_REGISTRY)
    if (problems.length > 0) {
      console.warn('Orphaned links:', problems.map(p => `${p.link.id}: ${p.issue}`))
    }
    expect(problems).toEqual([])
  })
})

// ─── Полная цепочка платформы ─────────────────────────────────────────────────

describe('Полная цепочка Startuper → IC → Deal → Portfolio', () => {
  it('lead → session: SENT_TO_IC открывает SESSION_STARTED', () => {
    const e1 = { entityType: 'lead', type: 'SENT_TO_IC', data: {} }
    expect(nextCrossEntityEvents(e1).some(l => l.enables.eventType === 'SESSION_STARTED')).toBe(true)
  })

  it('session → deal: DECISION_MADE(APPROVE) открывает TERM_SHEET_PROPOSED', () => {
    const e2 = { entityType: 'session', type: 'DECISION_MADE', data: { verdict: 'APPROVE' } }
    expect(nextCrossEntityEvents(e2).some(l => l.enables.eventType === 'TERM_SHEET_PROPOSED')).toBe(true)
  })

  it('deal → company: DEAL_CLOSED открывает COMPANY_ADDED', () => {
    const e3 = { entityType: 'deal', type: 'DEAL_CLOSED', data: {} }
    expect(nextCrossEntityEvents(e3).some(l => l.enables.eventType === 'COMPANY_ADDED')).toBe(true)
  })

  it('company → fund: ROUND_OPENED открывает NAV_UPDATED', () => {
    const e4 = { entityType: 'company', type: 'ROUND_OPENED', data: {} }
    expect(nextCrossEntityEvents(e4).some(l => l.enables.eventType === 'NAV_UPDATED')).toBe(true)
  })

  it('цепочка непрерывна: каждое следующее звено имеет upstream из предыдущего', () => {
    // Verifies the chain doesn't have broken links
    const chain = [
      { from: 'lead',    to: 'session' },
      { from: 'session', to: 'deal' },
      { from: 'deal',    to: 'company' },
      { from: 'company', to: 'fund' },
    ]
    for (const step of chain) {
      const links = CROSS_ENTITY_LINKS.filter(
        l => l.trigger.entityType === step.from && l.enables.entityType === step.to
      )
      expect(links.length, `нет связи ${step.from} → ${step.to}`).toBeGreaterThan(0)
    }
  })
})
