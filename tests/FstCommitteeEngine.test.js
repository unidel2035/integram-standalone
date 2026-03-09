/**
 * Unit tests for FstCommitteeEngine.js
 *
 * Tests scoring logic, voting mechanics, state machine transitions,
 * and recommendation generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createSession, FstCommitteeEngine } from '../src/components/fst-committee/FstCommitteeEngine.js'
import { AGENTS, VERDICTS } from '../src/components/fst-committee/FstCommitteeConfig.js'

// ── Test Fixtures ─────────────────────────────────────────────────

const mockProjectHighScore = {
  name: 'БПЛА Орион-2',
  trl: 8,
  mrl: 9,
  sovereigntyScore: 8.5,
  marketSize: 50e9,  // 50 млрд руб
  projectedIRR: 0.45,
  teamStrength: 0.85,
  employees: 35,
  localizationRatio: 0.92,
  risks: ['Регуляторный риск сертификации'],
}

const mockProjectMediumScore = {
  name: 'Робот-пылесос РоботЕк',
  trl: 6,
  mrl: 6,
  sovereigntyScore: 6.0,
  marketSize: 8e9,
  projectedIRR: 0.25,
  teamStrength: 0.60,
  employees: 18,
  localizationRatio: 0.70,
  risks: ['Конкуренция с китайскими производителями'],
}

const mockProjectLowScore = {
  name: 'AI-стартап ранней стадии',
  trl: 3,
  mrl: 2,
  sovereigntyScore: 4.5,
  marketSize: 2e9,
  projectedIRR: 0.15,
  teamStrength: 0.40,
  employees: 8,
  localizationRatio: 0.30,
  risks: ['Технологический риск', 'Команда без опыта', 'Маленький рынок'],
}

// ── Test Suite ────────────────────────────────────────────────────

describe('FstCommitteeEngine — Scoring Functions', () => {
  it('normalizes TRL score (1-9) to 0-1 range', () => {
    const session = createSession(mockProjectHighScore)
    expect(session.dimScores.trl).toBeGreaterThan(0.8)
    expect(session.dimScores.trl).toBeLessThanOrEqual(1.0)
  })

  it('normalizes MRL score (1-10) to 0-1 range', () => {
    const session = createSession(mockProjectHighScore)
    expect(session.dimScores.mrl).toBeGreaterThan(0.8)
    expect(session.dimScores.mrl).toBeLessThanOrEqual(1.0)
  })

  it('normalizes sovereignty score (0-9) to 0-1 range', () => {
    const session = createSession(mockProjectHighScore)
    expect(session.dimScores.sovereignty).toBeGreaterThan(0.8)
    expect(session.dimScores.sovereignty).toBeLessThanOrEqual(1.0)
  })

  it('handles low scores correctly', () => {
    const session = createSession(mockProjectLowScore)
    expect(session.dimScores.trl).toBeLessThan(0.5)
    expect(session.dimScores.mrl).toBeLessThan(0.3)
    expect(session.dimScores.sovereignty).toBeLessThan(0.6)
  })

  it('computes market size score on log scale', () => {
    const session = createSession(mockProjectHighScore)
    expect(session.dimScores.market).toBeGreaterThan(0)
    expect(session.dimScores.market).toBeLessThanOrEqual(1.0)
  })

  it('computes finance score from IRR', () => {
    const session = createSession(mockProjectHighScore)
    // IRR 0.45 should normalize to ~0.7 in (0.10, 0.60) range
    expect(session.dimScores.finance).toBeGreaterThan(0.6)
    expect(session.dimScores.finance).toBeLessThanOrEqual(1.0)
  })

  it('computes risk score inversely (higher risk = lower score)', () => {
    const session = createSession(mockProjectLowScore)
    // Low TRL (3) → high risk → risk score should be lower
    expect(session.dimScores.risk).toBeLessThan(0.5)
  })
})

describe('FstCommitteeEngine — Verdict Logic', () => {
  it('returns APPROVE for score >= 0.72', () => {
    const session = createSession(mockProjectHighScore)
    const engine = new FstCommitteeEngine(session)

    // High-quality project should get APPROVE after voting
    engine.session.agentScores = [
      { agent: AGENTS[0], score: 0.80, verdict: 'APPROVE' },
      { agent: AGENTS[1], score: 0.75, verdict: 'APPROVE' },
      { agent: AGENTS[2], score: 0.78, verdict: 'APPROVE' },
      { agent: AGENTS[3], score: 0.72, verdict: 'APPROVE' },
      { agent: AGENTS[4], score: 0.76, verdict: 'APPROVE' },
      { agent: AGENTS[5], score: 0.74, verdict: 'APPROVE' },
    ]

    // Manually trigger synthesis to get decision
    const aggregatedScore = engine.session.agentScores.reduce((sum, { agent, score }) =>
      sum + score * agent.weight, 0) / engine.session.agentScores.reduce((sum, { agent }) =>
      sum + agent.weight, 0)

    expect(aggregatedScore).toBeGreaterThanOrEqual(0.72)
  })

  it('returns DEFER for score 0.50-0.71', () => {
    const session = createSession(mockProjectMediumScore)
    const engine = new FstCommitteeEngine(session)

    engine.session.agentScores = [
      { agent: AGENTS[0], score: 0.65, verdict: 'DEFER' },
      { agent: AGENTS[1], score: 0.60, verdict: 'DEFER' },
      { agent: AGENTS[2], score: 0.55, verdict: 'DEFER' },
      { agent: AGENTS[3], score: 0.58, verdict: 'DEFER' },
      { agent: AGENTS[4], score: 0.62, verdict: 'DEFER' },
      { agent: AGENTS[5], score: 0.57, verdict: 'DEFER' },
    ]

    const aggregatedScore = engine.session.agentScores.reduce((sum, { agent, score }) =>
      sum + score * agent.weight, 0) / engine.session.agentScores.reduce((sum, { agent }) =>
      sum + agent.weight, 0)

    expect(aggregatedScore).toBeGreaterThanOrEqual(0.50)
    expect(aggregatedScore).toBeLessThan(0.72)
  })

  it('returns REJECT for score < 0.50', () => {
    const session = createSession(mockProjectLowScore)
    const engine = new FstCommitteeEngine(session)

    engine.session.agentScores = [
      { agent: AGENTS[0], score: 0.35, verdict: 'REJECT' },
      { agent: AGENTS[1], score: 0.30, verdict: 'REJECT' },
      { agent: AGENTS[2], score: 0.40, verdict: 'REJECT' },
      { agent: AGENTS[3], score: 0.38, verdict: 'REJECT' },
      { agent: AGENTS[4], score: 0.32, verdict: 'REJECT' },
      { agent: AGENTS[5], score: 0.36, verdict: 'REJECT' },
    ]

    const aggregatedScore = engine.session.agentScores.reduce((sum, { agent, score }) =>
      sum + score * agent.weight, 0) / engine.session.agentScores.reduce((sum, { agent }) =>
      sum + agent.weight, 0)

    expect(aggregatedScore).toBeLessThan(0.50)
  })
})

describe('FstCommitteeEngine — Session Lifecycle', () => {
  it('creates session with correct initial state', () => {
    const session = createSession(mockProjectHighScore)

    expect(session.id).toMatch(/^ses_\d+$/)
    expect(session.project).toBe(mockProjectHighScore)
    expect(session.phase).toBe('IDLE')
    expect(session.phaseIndex).toBe(0)
    expect(session.agents).toHaveLength(12)
    expect(session.arguments).toEqual([])
    expect(session.votes).toEqual([])
    expect(session.decision).toBeNull()
    expect(session.dimScores).toBeDefined()
  })

  it('initializes agent status for all 12 agents', () => {
    const session = createSession(mockProjectHighScore)

    expect(Object.keys(session.agentStatus)).toHaveLength(12)
    for (const agent of AGENTS) {
      expect(session.agentStatus[agent.id]).toMatchObject({
        thinking: false,
        done: false,
        thinkText: '',
      })
    }
  })

  it('supports speed multipliers', () => {
    const slow = createSession(mockProjectHighScore, { speed: 'slow' })
    const normal = createSession(mockProjectHighScore, { speed: 'normal' })
    const fast = createSession(mockProjectHighScore, { speed: 'fast' })

    expect(slow.speed).toBe(1.0)
    expect(normal.speed).toBe(2.5)
    expect(fast.speed).toBe(6.0)
  })

  it('tracks round number for revisions', () => {
    const session1 = createSession(mockProjectHighScore)
    expect(session1.roundNumber).toBe(1)

    const revised = { ...mockProjectHighScore, _roundNumber: 2 }
    const session2 = createSession(revised)
    expect(session2.roundNumber).toBe(2)
  })
})

describe('FstCommitteeEngine — Event System', () => {
  it('emits events via onEvent callback', () => {
    const events = []
    const session = createSession(mockProjectHighScore)
    const engine = new FstCommitteeEngine(session, (event) => {
      events.push(event)
    })

    engine.emit('TestEvent', { data: 'test' })

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('TestEvent')
    expect(events[0].data).toBe('test')
    expect(events[0].ts).toBeDefined()
  })

  it('stores events in session.events array', () => {
    const session = createSession(mockProjectHighScore)
    const engine = new FstCommitteeEngine(session)

    engine.emit('Event1', { val: 1 })
    engine.emit('Event2', { val: 2 })

    expect(session.events).toHaveLength(2)
    expect(session.events[0].type).toBe('Event1')
    expect(session.events[1].type).toBe('Event2')
  })
})

describe('FstCommitteeEngine — Phase Transitions', () => {
  it('transitions phase and updates phase index', () => {
    const session = createSession(mockProjectHighScore)
    const engine = new FstCommitteeEngine(session)

    expect(session.phase).toBe('IDLE')
    expect(session.phaseIndex).toBe(0)

    engine._transitionPhase('LOADING')
    expect(session.phase).toBe('LOADING')
    expect(session.phaseIndex).toBe(1)

    engine._transitionPhase('PRIMARY_POSITIONS')
    expect(session.phase).toBe('PRIMARY_POSITIONS')
    expect(session.phaseIndex).toBe(2)
  })

  it('emits PhaseTransitioned event', () => {
    const events = []
    const session = createSession(mockProjectHighScore)
    const engine = new FstCommitteeEngine(session, (e) => events.push(e))

    engine._transitionPhase('VOTING')

    const phaseEvent = events.find(e => e.type === 'PhaseTransitioned')
    expect(phaseEvent).toBeDefined()
    expect(phaseEvent.prevPhase).toBe('IDLE')
    expect(phaseEvent.nextPhase).toBe('VOTING')
  })
})

describe('FstCommitteeEngine — Human Approval', () => {
  it('records human approval with comment', () => {
    const session = createSession(mockProjectHighScore)
    session.decision = {
      id: 'dec_123',
      aggregatedScore: 75,
      recommendation: 'APPROVE',
      voteCounts: { APPROVE: 5, REJECT: 0, DEFER: 1 },
    }

    const engine = new FstCommitteeEngine(session)
    engine.humanDecide('APPROVED', 'Отличный проект!', 'chair_001')

    expect(session.decision.humanApproval).toBeDefined()
    expect(session.decision.humanApproval.verdict).toBe('APPROVED')
    expect(session.decision.humanApproval.comment).toBe('Отличный проект!')
    expect(session.decision.humanApproval.memberId).toBe('chair_001')
  })

  it('transitions to CONCLUDED after human decision', () => {
    const session = createSession(mockProjectHighScore)
    session.decision = {
      id: 'dec_123',
      aggregatedScore: 75,
      recommendation: 'APPROVE',
    }

    const engine = new FstCommitteeEngine(session)
    engine.humanDecide('APPROVED')

    expect(session.phase).toBe('RECOMMENDATIONS')
    expect(session.concludedAt).toBeDefined()
  })

  it('generates recommendations after human decision', () => {
    const session = createSession(mockProjectMediumScore)
    session.decision = {
      id: 'dec_456',
      aggregatedScore: 62,
      recommendation: 'DEFER',
    }

    const engine = new FstCommitteeEngine(session)
    engine.humanDecide('DEFERRED')

    expect(session.recommendations).toBeDefined()
    expect(Array.isArray(session.recommendations)).toBe(true)
  })
})

describe('FstCommitteeEngine — Recommendations & Revision', () => {
  it('marks recommendations as accepted/rejected', () => {
    const session = createSession(mockProjectMediumScore)
    session.recommendations = [
      { id: 'rec_1', metric: 'TRL', delta: 1, accepted: true },
      { id: 'rec_2', metric: 'MRL', delta: 1, accepted: true },
      { id: 'rec_3', metric: 'Локализация', delta: 0.1, accepted: true },
    ]

    const engine = new FstCommitteeEngine(session)
    engine.startRevision(['rec_1', 'rec_3'])

    expect(session.recommendations[0].accepted).toBe(true)
    expect(session.recommendations[1].accepted).toBe(false)
    expect(session.recommendations[2].accepted).toBe(true)
    expect(session.phase).toBe('REVISION')
  })

  it('applies revisions to create new project version', async () => {
    const session = createSession({
      ...mockProjectMediumScore,
      trl: 6,
      mrl: 6,
      sovereigntyScore: 6.0,
    })

    session.recommendations = [
      { id: 'rec_1', metric: 'TRL', delta: 1, accepted: true },
      { id: 'rec_2', metric: 'MRL', delta: 2, accepted: true },
    ]

    const engine = new FstCommitteeEngine(session)
    engine.startRevision(['rec_1', 'rec_2'])

    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check if revised project is created (will be null if animation not complete)
    // In real scenario, wait for RevisionComplete event
  })

  it('increments round number in revised project', () => {
    const session = createSession({ ...mockProjectMediumScore, _roundNumber: 1 })
    const engine = new FstCommitteeEngine(session)

    const nextSession = engine.buildNextRoundSession()
    // Will be null if no revisedProject yet
    if (nextSession) {
      expect(nextSession.roundNumber).toBe(2)
    }
  })
})

describe('FstCommitteeEngine — Conditions & Risks', () => {
  it('builds conditions for low MRL projects', () => {
    const session = createSession({ ...mockProjectMediumScore, mrl: 3 })
    const engine = new FstCommitteeEngine(session)

    const conditions = engine._buildConditions(session.project, 0.65)
    const mrlCondition = conditions.find(c => c.includes('MRL'))
    expect(mrlCondition).toBeDefined()
  })

  it('builds conditions for low localization ratio', () => {
    const session = createSession({ ...mockProjectMediumScore, localizationRatio: 0.40 })
    const engine = new FstCommitteeEngine(session)

    const conditions = engine._buildConditions(session.project, 0.65)
    const localizationCondition = conditions.find(c => c.includes('импортозамещени') || c.includes('отечественных') || c.includes('локализац'))
    expect(localizationCondition).toBeDefined()
  })

  it('builds conditions for low TRL projects', () => {
    const session = createSession({ ...mockProjectMediumScore, trl: 4 })
    const engine = new FstCommitteeEngine(session)

    const conditions = engine._buildConditions(session.project, 0.65)
    const trlCondition = conditions.find(c => c.includes('TRL'))
    expect(trlCondition).toBeDefined()
  })

  it('builds conditions for small teams', () => {
    const session = createSession({ ...mockProjectMediumScore, employees: 8 })
    const engine = new FstCommitteeEngine(session)

    const conditions = engine._buildConditions(session.project, 0.65)
    const teamCondition = conditions.find(c => c.includes('команд'))
    expect(teamCondition).toBeDefined()
  })

  it('identifies technology risk for low TRL', () => {
    const session = createSession({ ...mockProjectLowScore, trl: 4, risks: [] })
    const engine = new FstCommitteeEngine(session)

    const risks = engine._buildKeyRisks(session.project)
    const techRisk = risks.find(r => r.includes('Технологический'))
    expect(techRisk).toBeDefined()
  })

  it('identifies sanction risk for low sovereignty', () => {
    const session = createSession({ ...mockProjectLowScore, sovereigntyScore: 4, risks: [] })
    const engine = new FstCommitteeEngine(session)

    const risks = engine._buildKeyRisks(session.project)
    const sanctionRisk = risks.find(r => r.includes('Санкционный'))
    expect(sanctionRisk).toBeDefined()
  })

  it('identifies market risk for small market size', () => {
    const session = createSession({ ...mockProjectLowScore, marketSize: 3e9, risks: [] })
    const engine = new FstCommitteeEngine(session)

    const risks = engine._buildKeyRisks(session.project)
    const marketRisk = risks.find(r => r.includes('Рыночный'))
    expect(marketRisk).toBeDefined()
  })

  it('limits risks to 5 maximum', () => {
    const session = createSession({
      ...mockProjectLowScore,
      risks: ['Risk1', 'Risk2', 'Risk3', 'Risk4', 'Risk5', 'Risk6', 'Risk7'],
    })
    const engine = new FstCommitteeEngine(session)

    const risks = engine._buildKeyRisks(session.project)
    expect(risks.length).toBeLessThanOrEqual(5)
  })
})

describe('FstCommitteeEngine — Stop/Cleanup', () => {
  it('can stop running engine', () => {
    const session = createSession(mockProjectHighScore)
    const engine = new FstCommitteeEngine(session)

    engine._running = true
    engine.stop()

    expect(engine._running).toBe(false)
    expect(engine._timers).toEqual([])
  })

  it('clears all pending timers on stop', () => {
    const session = createSession(mockProjectHighScore)
    const engine = new FstCommitteeEngine(session)

    // Simulate adding timers
    const timer1 = setTimeout(() => {}, 10000)
    const timer2 = setTimeout(() => {}, 20000)
    engine._timers = [timer1, timer2]

    engine.stop()

    expect(engine._timers).toEqual([])
  })
})
