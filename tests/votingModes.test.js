import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createSession, FstCommitteeEngine } from '../src/components/fst-committee/FstCommitteeEngine.js'

// ── Mock projects ────────────────────────────────────────────────

const mockProjectHigh = {
  id: 'test-high',
  title: 'БПЛА Орион-Тест',
  company: 'Кронштадт',
  subFund: 'drones',
  trl: 8, mrl: 9,
  sovereigntyScore: 8.5,
  localizationRatio: 0.85,
  projectedIRR: 0.42,
  marketSize: 50e9,
  requestedAmount: 200e6,
  teamStrength: 0.85,
  teamSize: 45,
  askRub: 200e6,
}

const mockProjectLow = {
  id: 'test-low',
  title: 'AI Startup',
  company: 'NoName',
  subFund: 'ai',
  trl: 3, mrl: 2,
  sovereigntyScore: 3,
  localizationRatio: 0.3,
  projectedIRR: 0.12,
  marketSize: 1e9,
  requestedAmount: 50e6,
  teamStrength: 0.4,
  teamSize: 5,
  askRub: 50e6,
}

// ── Voting Mode Tests ────────────────────────────────────────────

describe('Voting Modes', () => {

  describe('votingMode in session', () => {
    it('defaults to hybrid', () => {
      const session = createSession(mockProjectHigh)
      expect(session.votingMode).toBe('hybrid')
    })

    it('accepts formula mode', () => {
      const session = createSession(mockProjectHigh, { votingMode: 'formula' })
      expect(session.votingMode).toBe('formula')
    })

    it('accepts llm mode', () => {
      const session = createSession(mockProjectHigh, { votingMode: 'llm' })
      expect(session.votingMode).toBe('llm')
    })

    it('accepts hybrid mode', () => {
      const session = createSession(mockProjectHigh, { votingMode: 'hybrid' })
      expect(session.votingMode).toBe('hybrid')
    })
  })

  describe('formula mode — pure algorithmic scoring', () => {
    let session, engine, events

    beforeEach(() => {
      events = []
      session = createSession(mockProjectHigh, {
        speed: 'instant',
        useAI: false,
        useAgentLoop: false,
        votingMode: 'formula',
      })
      engine = new FstCommitteeEngine(session, (e) => events.push(e))
    })

    it('all votes use formula, fromDebate=false', async () => {
      // Directly run voting phase (skip debate)
      engine._running = true
      session.phase = 'FINAL_POSITIONS'
      await engine._phaseVoting()

      expect(session.votes.length).toBeGreaterThanOrEqual(6)
      for (const vote of session.votes) {
        expect(vote.fromDebate).toBe(false)
        expect(vote.votingMode).toBe('formula')
        expect(vote.verdict).toMatch(/^(APPROVE|DEFER|REJECT)$/)
        expect(vote.score).toBeGreaterThanOrEqual(0)
        expect(vote.score).toBeLessThanOrEqual(100)
        expect(vote.confidence).toBeGreaterThanOrEqual(0.4)
        expect(vote.confidence).toBeLessThanOrEqual(1.0)
      }
    })

    it('ignores SUMMARY stances in formula mode', async () => {
      engine._running = true
      session.phase = 'FINAL_POSITIONS'
      // Add fake SUMMARY with explicit stance
      session.arguments.push({
        id: 'arg_test_1', agentId: 'tech', type: 'SUMMARY',
        stance: 'REJECT', confidence: 0.95, text: 'Test reject'
      })
      await engine._phaseVoting()

      const techVote = session.votes.find(v => v.agentId === 'tech')
      expect(techVote).toBeTruthy()
      expect(techVote.fromDebate).toBe(false)
      // Formula for high-score project should NOT be REJECT
      // (tech agent with high TRL should score high)
    })

    it('high-score project tends toward APPROVE', async () => {
      engine._running = true
      session.phase = 'FINAL_POSITIONS'
      await engine._phaseVoting()

      const approves = session.votes.filter(v => v.verdict === 'APPROVE').length
      expect(approves).toBeGreaterThanOrEqual(2) // at least some approve
    })

    it('low-score project tends toward REJECT/DEFER', async () => {
      const lowSession = createSession(mockProjectLow, {
        speed: 'instant', useAI: false, votingMode: 'formula'
      })
      const lowEngine = new FstCommitteeEngine(lowSession, () => {})
      lowEngine._running = true
      lowSession.phase = 'FINAL_POSITIONS'
      await lowEngine._phaseVoting()

      const rejects = lowSession.votes.filter(v => v.verdict === 'REJECT').length
      const defers = lowSession.votes.filter(v => v.verdict === 'DEFER').length
      expect(rejects + defers).toBeGreaterThanOrEqual(3) // mostly skeptical
    })
  })

  describe('llm mode — pure LLM-driven voting', () => {
    let session, engine

    beforeEach(() => {
      session = createSession(mockProjectHigh, {
        speed: 'instant', useAI: false, votingMode: 'llm'
      })
      engine = new FstCommitteeEngine(session, () => {})
    })

    it('uses SUMMARY stance when available', async () => {
      engine._running = true
      session.phase = 'FINAL_POSITIONS'

      // Inject SUMMARY stances for all agents
      const agents = session.agents
      for (const agent of agents) {
        session.arguments.push({
          id: `arg_${agent.id}`, agentId: agent.id, type: 'SUMMARY',
          stance: 'APPROVE', confidence: 0.85, text: `Agent ${agent.id} approves`
        })
      }

      await engine._phaseVoting()

      for (const vote of session.votes) {
        expect(vote.verdict).toBe('APPROVE')
        expect(vote.fromDebate).toBe(true)
        expect(vote.votingMode).toBe('llm')
      }
    })

    it('RESCORE overrides SUMMARY', async () => {
      engine._running = true
      session.phase = 'FINAL_POSITIONS'

      session.arguments.push({
        id: 'sum_tech', agentId: 'tech', type: 'SUMMARY',
        stance: 'APPROVE', confidence: 0.9, text: 'Initially approve'
      })
      session.arguments.push({
        id: 'res_tech', agentId: 'tech', type: 'RESCORE',
        stance: 'REJECT', confidence: 0.8, text: 'Changed mind after debate'
      })

      await engine._phaseVoting()

      const techVote = session.votes.find(v => v.agentId === 'tech')
      expect(techVote.verdict).toBe('REJECT')
      expect(techVote.fromDebate).toBe(true)
    })

    it('uses LLM confidence directly', async () => {
      engine._running = true
      session.phase = 'FINAL_POSITIONS'

      session.arguments.push({
        id: 'sum_finance', agentId: 'finance', type: 'SUMMARY',
        stance: 'DEFER', confidence: 0.42, text: 'Uncertain'
      })

      await engine._phaseVoting()

      const finVote = session.votes.find(v => v.agentId === 'finance')
      expect(finVote.confidence).toBeCloseTo(0.42, 1)
    })

    it('no consensus pressure in llm mode', async () => {
      engine._running = true
      session.phase = 'FINAL_POSITIONS'

      // 5 agents APPROVE, 1 agent (devil) REJECT with low confidence
      const agents = session.agents
      for (const agent of agents) {
        const isDevil = agent.id === 'devil'
        session.arguments.push({
          id: `sum_${agent.id}`, agentId: agent.id, type: 'SUMMARY',
          stance: isDevil ? 'REJECT' : 'APPROVE',
          confidence: isDevil ? 0.3 : 0.9,
          text: isDevil ? 'I reject' : 'I approve'
        })
      }

      await engine._phaseVoting()

      const devilVote = session.votes.find(v => v.agentId === 'devil')
      // In LLM mode, devil should NOT be flipped by consensus pressure
      expect(devilVote.verdict).toBe('REJECT')
    })

    it('falls back to formula when no SUMMARY exists', async () => {
      engine._running = true
      session.phase = 'FINAL_POSITIONS'
      // No arguments added — fallback

      await engine._phaseVoting()

      for (const vote of session.votes) {
        expect(vote.fromDebate).toBe(false)
        expect(vote.verdict).toMatch(/^(APPROVE|DEFER|REJECT)$/)
      }
    })
  })

  describe('hybrid mode — LLM + consensus pressure', () => {
    let session, engine

    beforeEach(() => {
      session = createSession(mockProjectHigh, {
        speed: 'instant', useAI: false, votingMode: 'hybrid'
      })
      engine = new FstCommitteeEngine(session, () => {})
    })

    it('uses SUMMARY stance with consensus pressure', async () => {
      engine._running = true
      session.phase = 'FINAL_POSITIONS'

      // 5 APPROVE (>70%), 1 weak REJECT (confidence 0.3)
      const agents = session.agents
      for (const agent of agents) {
        const isDevil = agent.id === 'devil'
        session.arguments.push({
          id: `sum_${agent.id}`, agentId: agent.id, type: 'SUMMARY',
          stance: isDevil ? 'REJECT' : 'APPROVE',
          confidence: isDevil ? 0.3 : 0.85,
          text: isDevil ? 'Reject weakly' : 'Approve strongly'
        })
      }

      await engine._phaseVoting()

      const devilVote = session.votes.find(v => v.agentId === 'devil')
      // In hybrid mode, devil with confidence 0.3 should flip to APPROVE (consensus pressure)
      expect(devilVote.verdict).toBe('APPROVE')
    })

    it('strong dissent resists consensus pressure', async () => {
      engine._running = true
      session.phase = 'FINAL_POSITIONS'

      const agents = session.agents
      for (const agent of agents) {
        const isDevil = agent.id === 'devil'
        session.arguments.push({
          id: `sum_${agent.id}`, agentId: agent.id, type: 'SUMMARY',
          stance: isDevil ? 'REJECT' : 'APPROVE',
          confidence: isDevil ? 0.85 : 0.9, // devil has HIGH confidence
          text: isDevil ? 'Strong reject' : 'Approve'
        })
      }

      await engine._phaseVoting()

      const devilVote = session.votes.find(v => v.agentId === 'devil')
      // High confidence (0.85 >= 0.6) — should resist pressure
      expect(devilVote.verdict).toBe('REJECT')
    })

    it('fromDebate=true when SUMMARY stance exists', async () => {
      engine._running = true
      session.phase = 'FINAL_POSITIONS'

      session.arguments.push({
        id: 'sum_tech', agentId: 'tech', type: 'SUMMARY',
        stance: 'DEFER', confidence: 0.7, text: 'Defer'
      })

      await engine._phaseVoting()

      const techVote = session.votes.find(v => v.agentId === 'tech')
      expect(techVote.fromDebate).toBe(true)

      // Other agents without SUMMARY → fromDebate=false
      const otherVote = session.votes.find(v => v.agentId !== 'tech')
      expect(otherVote.fromDebate).toBe(false)
    })
  })

  describe('RESCORE integration across all modes', () => {
    it('RESCORE takes priority over SUMMARY in hybrid', async () => {
      const session = createSession(mockProjectHigh, { speed: 'instant', useAI: false, votingMode: 'hybrid' })
      const engine = new FstCommitteeEngine(session, () => {})
      engine._running = true
      session.phase = 'FINAL_POSITIONS'

      session.arguments.push({ id: 's1', agentId: 'risk', type: 'SUMMARY', stance: 'APPROVE', confidence: 0.9, text: 'Approve initially' })
      session.arguments.push({ id: 'r1', agentId: 'risk', type: 'RESCORE', stance: 'DEFER', confidence: 0.6, text: 'Changed to defer' })

      await engine._phaseVoting()
      const riskVote = session.votes.find(v => v.agentId === 'risk')
      expect(riskVote.verdict).toBe('DEFER')
    })

    it('RESCORE takes priority over SUMMARY in formula mode (ignored)', async () => {
      const session = createSession(mockProjectHigh, { speed: 'instant', useAI: false, votingMode: 'formula' })
      const engine = new FstCommitteeEngine(session, () => {})
      engine._running = true
      session.phase = 'FINAL_POSITIONS'

      session.arguments.push({ id: 'r1', agentId: 'risk', type: 'RESCORE', stance: 'REJECT', confidence: 0.95, text: 'Strong reject' })

      await engine._phaseVoting()
      const riskVote = session.votes.find(v => v.agentId === 'risk')
      // Formula mode ignores RESCORE/SUMMARY entirely
      expect(riskVote.fromDebate).toBe(false)
    })
  })
})

describe('Parallel Agent Execution', () => {
  it('session supports useAgentLoop flag', () => {
    const session = createSession(mockProjectHigh, { useAgentLoop: true })
    expect(session.useAgentLoop).toBe(true)
  })

  it('session supports useOrchestrator flag', () => {
    const session = createSession(mockProjectHigh, { useOrchestrator: true })
    expect(session.useOrchestrator).toBe(true)
  })

  it('agents array has at least 6 agents', () => {
    const session = createSession(mockProjectHigh)
    expect(session.agents.length).toBeGreaterThanOrEqual(6)
  })

  it('each agent has required fields for parallel execution', () => {
    const session = createSession(mockProjectHigh)
    for (const agent of session.agents) {
      expect(agent.id).toBeTruthy()
      expect(agent.name).toBeTruthy()
      expect(agent.scoringWeights).toBeTruthy()
      expect(typeof agent.weight).toBe('number')
    }
  })
})
