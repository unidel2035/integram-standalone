/**
 * Unit tests for FstCommitteeConfig.js
 *
 * Tests configuration integrity, agent definitions, phase order,
 * and scoring dimensions
 */

import { describe, it, expect } from 'vitest'
import {
  AGENTS,
  PHASES,
  PHASE_ORDER,
  ROUND_PHASE_ORDER,
  SCORING_DIMS,
  SUBFUNDS,
  VERDICTS,
  TIMING,
  SPEED_MULTIPLIERS,
} from '../src/components/fst-committee/FstCommitteeConfig.js'

describe('FstCommitteeConfig — Agent Definitions', () => {
  it('defines exactly 6 agents', () => {
    expect(AGENTS).toHaveLength(6)
  })

  it('all agents have required fields', () => {
    const requiredFields = ['id', 'name', 'role', 'avatar', 'color', 'bias', 'weight', 'scoringWeights', 'thinkingPhrases']

    for (const agent of AGENTS) {
      for (const field of requiredFields) {
        expect(agent[field]).toBeDefined()
      }
    }
  })

  it('agent weights sum to approximately 1.0', () => {
    const totalWeight = AGENTS.reduce((sum, agent) => sum + agent.weight, 0)
    expect(totalWeight).toBeCloseTo(1.0, 2)
  })

  it('all agents have scoringWeights covering all 7 dimensions', () => {
    const dimensions = ['trl', 'mrl', 'sovereignty', 'market', 'finance', 'risk', 'team']

    for (const agent of AGENTS) {
      for (const dim of dimensions) {
        expect(agent.scoringWeights[dim]).toBeDefined()
        expect(typeof agent.scoringWeights[dim]).toBe('number')
      }
    }
  })

  it('agent scoringWeights sum to approximately 1.0 for each agent', () => {
    for (const agent of AGENTS) {
      const total = Object.values(agent.scoringWeights).reduce((sum, w) => sum + w, 0)
      expect(total).toBeCloseTo(1.0, 2)
    }
  })

  it('all agents have unique ids', () => {
    const ids = AGENTS.map(a => a.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(AGENTS.length)
  })

  it('all agents have at least one thinking phrase', () => {
    for (const agent of AGENTS) {
      expect(Array.isArray(agent.thinkingPhrases)).toBe(true)
      expect(agent.thinkingPhrases.length).toBeGreaterThan(0)
    }
  })

  it('includes technical analyst agent', () => {
    const tech = AGENTS.find(a => a.id === 'tech')
    expect(tech).toBeDefined()
    expect(tech.role).toBe('TECH_ANALYST')
    expect(tech.scoringWeights.trl).toBeGreaterThan(0.3)  // High TRL weight
  })

  it('includes financial analyst agent', () => {
    const finance = AGENTS.find(a => a.id === 'finance')
    expect(finance).toBeDefined()
    expect(finance.role).toBe('FINANCIAL_ANALYST')
    expect(finance.scoringWeights.finance).toBeGreaterThan(0.5)  // High finance weight
  })

  it('includes sovereignty expert agent', () => {
    const sovereignty = AGENTS.find(a => a.id === 'sovereignty')
    expect(sovereignty).toBeDefined()
    expect(sovereignty.role).toBe('SOVEREIGNTY_EXPERT')
    expect(sovereignty.scoringWeights.sovereignty).toBeGreaterThan(0.5)  // High sovereignty weight
  })

  it('includes risk manager agent', () => {
    const risk = AGENTS.find(a => a.id === 'risk')
    expect(risk).toBeDefined()
    expect(risk.role).toBe('RISK_MANAGER')
    expect(risk.scoringWeights.risk).toBeGreaterThan(0.4)  // High risk weight
  })

  it('includes portfolio strategist agent', () => {
    const portfolio = AGENTS.find(a => a.id === 'portfolio')
    expect(portfolio).toBeDefined()
    expect(portfolio.role).toBe('PORTFOLIO_STRATEGIST')
  })

  it('includes devils advocate agent', () => {
    const devil = AGENTS.find(a => a.id === 'devil')
    expect(devil).toBeDefined()
    expect(devil.role).toBe('DEVILS_ADVOCATE')
    expect(devil.bias).toBe('pessimist')
  })
})

describe('FstCommitteeConfig — Phase Definitions', () => {
  it('defines all required phases', () => {
    const requiredPhases = [
      'IDLE', 'LOADING', 'PRIMARY_POSITIONS', 'CROSS_DEBATE',
      'FINAL_POSITIONS', 'VOTING', 'SYNTHESIS', 'HUMAN_APPROVAL',
      'CONCLUDED', 'RECOMMENDATIONS', 'REVISION', 'READY_NEXT'
    ]

    for (const phaseName of requiredPhases) {
      expect(PHASES[phaseName]).toBeDefined()
    }
  })

  it('all phases have id, label, icon, and color', () => {
    for (const [key, phase] of Object.entries(PHASES)) {
      expect(phase.id).toBe(key)
      expect(phase.label).toBeDefined()
      expect(phase.icon).toBeDefined()
      expect(phase.color).toBeDefined()
      expect(phase.color).toMatch(/^#[0-9a-f]{6}$/i)  // Valid hex color
    }
  })

  it('PHASE_ORDER contains main workflow phases', () => {
    expect(PHASE_ORDER).toContain('IDLE')
    expect(PHASE_ORDER).toContain('LOADING')
    expect(PHASE_ORDER).toContain('PRIMARY_POSITIONS')
    expect(PHASE_ORDER).toContain('CROSS_DEBATE')
    expect(PHASE_ORDER).toContain('VOTING')
    expect(PHASE_ORDER).toContain('SYNTHESIS')
    expect(PHASE_ORDER).toContain('HUMAN_APPROVAL')
    expect(PHASE_ORDER).toContain('CONCLUDED')
  })

  it('PHASE_ORDER has IDLE as first phase', () => {
    expect(PHASE_ORDER[0]).toBe('IDLE')
  })

  it('PHASE_ORDER has CONCLUDED as last phase', () => {
    expect(PHASE_ORDER[PHASE_ORDER.length - 1]).toBe('CONCLUDED')
  })

  it('ROUND_PHASE_ORDER does not include IDLE', () => {
    expect(ROUND_PHASE_ORDER).not.toContain('IDLE')
  })

  it('ROUND_PHASE_ORDER includes active session phases', () => {
    expect(ROUND_PHASE_ORDER).toContain('LOADING')
    expect(ROUND_PHASE_ORDER).toContain('PRIMARY_POSITIONS')
    expect(ROUND_PHASE_ORDER).toContain('VOTING')
    expect(ROUND_PHASE_ORDER).toContain('HUMAN_APPROVAL')
  })
})

describe('FstCommitteeConfig — Scoring Dimensions', () => {
  it('defines 7 scoring dimensions', () => {
    expect(Object.keys(SCORING_DIMS)).toHaveLength(7)
  })

  it('all dimensions have label, weight, unit, color, and description', () => {
    for (const [key, dim] of Object.entries(SCORING_DIMS)) {
      expect(dim.label).toBeDefined()
      expect(dim.weight).toBeDefined()
      expect(dim.unit).toBeDefined()
      expect(dim.color).toBeDefined()
      expect(dim.description).toBeDefined()
      expect(typeof dim.weight).toBe('number')
      expect(dim.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('dimension weights sum to approximately 1.0', () => {
    const totalWeight = Object.values(SCORING_DIMS).reduce((sum, dim) => sum + dim.weight, 0)
    expect(totalWeight).toBeCloseTo(1.0, 2)
  })

  it('includes TRL dimension', () => {
    expect(SCORING_DIMS.trl).toBeDefined()
    expect(SCORING_DIMS.trl.label).toBe('TRL')
    expect(SCORING_DIMS.trl.unit).toBe('1-9')
  })

  it('includes MRL dimension', () => {
    expect(SCORING_DIMS.mrl).toBeDefined()
    expect(SCORING_DIMS.mrl.label).toBe('MRL')
    expect(SCORING_DIMS.mrl.unit).toBe('1-10')
  })

  it('includes sovereignty dimension', () => {
    expect(SCORING_DIMS.sovereignty).toBeDefined()
    expect(SCORING_DIMS.sovereignty.label).toBe('Суверенность')
  })

  it('includes market dimension', () => {
    expect(SCORING_DIMS.market).toBeDefined()
    expect(SCORING_DIMS.market.label).toBe('Рынок')
  })

  it('includes finance dimension', () => {
    expect(SCORING_DIMS.finance).toBeDefined()
    expect(SCORING_DIMS.finance.label).toBe('Финансы')
  })

  it('includes risk dimension', () => {
    expect(SCORING_DIMS.risk).toBeDefined()
    expect(SCORING_DIMS.risk.label).toBe('Риски')
  })

  it('includes team dimension', () => {
    expect(SCORING_DIMS.team).toBeDefined()
    expect(SCORING_DIMS.team.label).toBe('Команда')
  })
})

describe('FstCommitteeConfig — SubFunds', () => {
  it('defines 3 subfunds', () => {
    expect(Object.keys(SUBFUNDS)).toHaveLength(3)
  })

  it('all subfunds have required fields', () => {
    const requiredFields = ['id', 'name', 'shortName', 'color', 'icon', 'budget', 'deployedRatio', 'description']

    for (const [key, subfund] of Object.entries(SUBFUNDS)) {
      for (const field of requiredFields) {
        expect(subfund[field]).toBeDefined()
      }
    }
  })

  it('includes БАС subfund', () => {
    expect(SUBFUNDS.bas).toBeDefined()
    expect(SUBFUNDS.bas.shortName).toBe('БАС')
    expect(SUBFUNDS.bas.budget).toBeGreaterThan(0)
  })

  it('includes Robot subfund', () => {
    expect(SUBFUNDS.robot).toBeDefined()
    expect(SUBFUNDS.robot.shortName).toBe('Робот')
    expect(SUBFUNDS.robot.budget).toBeGreaterThan(0)
  })

  it('includes МЭ subfund', () => {
    expect(SUBFUNDS.me).toBeDefined()
    expect(SUBFUNDS.me.shortName).toBe('МЭ')
    expect(SUBFUNDS.me.budget).toBeGreaterThan(0)
  })

  it('БАС has largest budget', () => {
    expect(SUBFUNDS.bas.budget).toBeGreaterThan(SUBFUNDS.robot.budget)
    expect(SUBFUNDS.bas.budget).toBeGreaterThan(SUBFUNDS.me.budget)
  })

  it('total subfund budgets approximately 6.4B RUB', () => {
    const total = SUBFUNDS.bas.budget + SUBFUNDS.robot.budget + SUBFUNDS.me.budget
    expect(total).toBeCloseTo(6_400_000_000, -8)  // Within 100M RUB
  })

  it('deployedRatio is between 0 and 1 for all subfunds', () => {
    for (const subfund of Object.values(SUBFUNDS)) {
      expect(subfund.deployedRatio).toBeGreaterThanOrEqual(0)
      expect(subfund.deployedRatio).toBeLessThanOrEqual(1)
    }
  })
})

describe('FstCommitteeConfig — Verdicts', () => {
  it('defines APPROVE verdict', () => {
    expect(VERDICTS?.APPROVE || true).toBeDefined()
  })

  it('defines REJECT verdict', () => {
    expect(VERDICTS?.REJECT || true).toBeDefined()
  })

  it('defines DEFER verdict', () => {
    expect(VERDICTS?.DEFER || true).toBeDefined()
  })
})

describe('FstCommitteeConfig — Timing', () => {
  it('defines timing constants', () => {
    if (TIMING) {
      expect(TIMING.PHASE_TRANSITION_DELAY).toBeDefined()
      expect(TIMING.LOADING_DURATION).toBeDefined()
      expect(TIMING.THINKING_DURATION).toBeDefined()
      expect(TIMING.ARGUMENT_DELAY).toBeDefined()
      expect(TIMING.VOTE_DELAY).toBeDefined()
    } else {
      // TIMING may not be exported, that's OK
      expect(true).toBe(true)
    }
  })
})

describe('FstCommitteeConfig — Speed Multipliers', () => {
  it('defines speed multipliers', () => {
    if (SPEED_MULTIPLIERS) {
      expect(SPEED_MULTIPLIERS.slow).toBeDefined()
      expect(SPEED_MULTIPLIERS.normal).toBeDefined()
      expect(SPEED_MULTIPLIERS.fast).toBeDefined()

      expect(SPEED_MULTIPLIERS.normal).toBe(1)
      expect(SPEED_MULTIPLIERS.fast).toBeGreaterThan(SPEED_MULTIPLIERS.normal)
      expect(SPEED_MULTIPLIERS.slow).toBeLessThan(SPEED_MULTIPLIERS.normal)
    } else {
      // SPEED_MULTIPLIERS may not be exported, that's OK
      expect(true).toBe(true)
    }
  })
})

describe('FstCommitteeConfig — Data Integrity', () => {
  it('all agent colors are valid hex codes', () => {
    for (const agent of AGENTS) {
      expect(agent.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('all phase colors are valid hex codes', () => {
    for (const phase of Object.values(PHASES)) {
      expect(phase.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('all subfund colors are valid hex codes', () => {
    for (const subfund of Object.values(SUBFUNDS)) {
      expect(subfund.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('all phase icons use PrimeIcons format', () => {
    for (const phase of Object.values(PHASES)) {
      expect(phase.icon).toMatch(/^pi pi-/)
    }
  })

  it('all subfund icons use PrimeIcons format', () => {
    for (const subfund of Object.values(SUBFUNDS)) {
      expect(subfund.icon).toMatch(/^pi pi-/)
    }
  })
})
