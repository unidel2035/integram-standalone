/**
 * Unit Tests for AgentToolRegistry
 *
 * Tests: tool schemas, agent tool sets, calculation engines
 */

import { describe, it, expect } from 'vitest'
import {
  TOOL_SCHEMAS,
  AGENT_TOOLS,
  getToolsForAgent,
  formatToolsForPrompt,
  execCalcIrr,
  execCalcNpv,
  execMonteCarlo,
  execPowerScore,
  execBayesian,
} from '../../components/fst-committee/AgentToolRegistry.js'

describe('AgentToolRegistry', () => {

  // ── Tool Schemas ──────────────────────────────────────────────────────────

  describe('TOOL_SCHEMAS', () => {
    it('should have all required tool schemas', () => {
      const expected = [
        'read_room', 'query_data', 'calc_irr', 'calc_npv',
        'calc_monte_carlo', 'calc_power_score', 'calc_bayesian',
        'search_precedents', 'web_search', 'memory_search', 'exec_code',
      ]
      for (const name of expected) {
        expect(TOOL_SCHEMAS[name]).toBeDefined()
        expect(TOOL_SCHEMAS[name].name).toBe(name)
        expect(TOOL_SCHEMAS[name].description).toBeTruthy()
        expect(TOOL_SCHEMAS[name].params).toBeDefined()
      }
    })
  })

  // ── Agent Tool Sets ───────────────────────────────────────────────────────

  describe('AGENT_TOOLS', () => {
    const BASE_TOOLS = ['read_room', 'query_data', 'web_search', 'memory_search', 'exec_code']

    it('all agents should have base tools', () => {
      for (const [agentId, tools] of Object.entries(AGENT_TOOLS)) {
        for (const baseTool of BASE_TOOLS) {
          expect(tools, `${agentId} missing ${baseTool}`).toContain(baseTool)
        }
      }
    })

    it('finance agent should have calc_irr and calc_npv', () => {
      expect(AGENT_TOOLS.finance).toContain('calc_irr')
      expect(AGENT_TOOLS.finance).toContain('calc_npv')
    })

    it('monte_carlo agent should have calc_monte_carlo', () => {
      expect(AGENT_TOOLS.monte_carlo).toContain('calc_monte_carlo')
    })

    it('bayesian agent should have calc_bayesian', () => {
      expect(AGENT_TOOLS.bayesian).toContain('calc_bayesian')
    })

    it('power_score agent should have calc_power_score', () => {
      expect(AGENT_TOOLS.power_score).toContain('calc_power_score')
    })

    it('risk agent should have search_precedents', () => {
      expect(AGENT_TOOLS.risk).toContain('search_precedents')
    })
  })

  // ── getToolsForAgent ──────────────────────────────────────────────────────

  describe('getToolsForAgent', () => {
    it('should return tool schema objects for known agent', () => {
      const tools = getToolsForAgent('finance')
      expect(tools.length).toBeGreaterThanOrEqual(5)
      expect(tools.every(t => t.name && t.description)).toBe(true)
    })

    it('should return fallback tools for unknown agent', () => {
      const tools = getToolsForAgent('unknown_agent')
      expect(tools.length).toBe(2) // read_room, query_data
      expect(tools.map(t => t.name)).toContain('read_room')
      expect(tools.map(t => t.name)).toContain('query_data')
    })
  })

  // ── formatToolsForPrompt ──────────────────────────────────────────────────

  describe('formatToolsForPrompt', () => {
    it('should format tools as readable string', () => {
      const tools = getToolsForAgent('tech')
      const formatted = formatToolsForPrompt(tools)
      expect(formatted).toContain('read_room')
      expect(formatted).toContain('query_data')
      expect(formatted).toContain('Параметры')
    })

    it('should handle empty tools array', () => {
      expect(formatToolsForPrompt([])).toBe('')
    })
  })

  // ── Calculation Engines ───────────────────────────────────────────────────

  describe('execCalcIrr', () => {
    it('should calculate IRR for simple cashflows', () => {
      // Invest 100, get 50 per year for 3 years => ~23.4% IRR
      const result = execCalcIrr([50, 50, 50], 100)
      expect(result.irr_pct).toBeGreaterThan(20)
      expect(result.irr_pct).toBeLessThan(30)
      expect(result.irr).toBeGreaterThan(0)
    })

    it('should calculate IRR for break-even cashflows', () => {
      // Invest 100, get 100 back in year 1 => 0% IRR
      const result = execCalcIrr([100], 100)
      expect(Math.abs(result.irr_pct)).toBeLessThan(1)
    })

    it('should handle high-return cashflows', () => {
      // Invest 10, get 100 in year 1 => 900% IRR
      const result = execCalcIrr([100], 10)
      expect(result.irr_pct).toBeGreaterThan(500)
    })
  })

  describe('execCalcNpv', () => {
    it('should calculate NPV correctly', () => {
      // Invest 100, get 60 per year for 3 years, WACC 10%
      const result = execCalcNpv([60, 60, 60], 100, 0.10)
      expect(result.npv).toBeGreaterThan(0) // Should be positive
      expect(result.pi).toBeGreaterThan(1)  // Profitable
    })

    it('should return negative NPV for bad investment', () => {
      // Invest 100, get 10 per year for 2 years, WACC 20%
      const result = execCalcNpv([10, 10], 100, 0.20)
      expect(result.npv).toBeLessThan(0)
      expect(result.pi).toBeLessThan(1)
    })

    it('should handle zero WACC', () => {
      const result = execCalcNpv([50, 50], 100, 0)
      expect(result.npv).toBe(0)
    })
  })

  describe('execMonteCarlo', () => {
    it('should return valid simulation results', () => {
      const result = execMonteCarlo(0.30, 0.35, 1000)
      expect(result.p_positive_pct).toBeGreaterThan(0)
      expect(result.p_positive_pct).toBeLessThanOrEqual(100)
      expect(result.median_irr_pct).toBeDefined()
      expect(result.var_5pct_irr).toBeDefined()
      expect(result.p95_irr_pct).toBeDefined()
      expect(result.mean_irr_pct).toBeDefined()
    })

    it('should respect base_irr direction', () => {
      const highIrr = execMonteCarlo(0.80, 0.10, 1000)
      const lowIrr = execMonteCarlo(0.05, 0.10, 1000)
      expect(highIrr.median_irr_pct).toBeGreaterThan(lowIrr.median_irr_pct)
    })

    it('VaR should be less than median', () => {
      const result = execMonteCarlo(0.30, 0.35, 1000)
      expect(result.var_5pct_irr).toBeLessThanOrEqual(result.median_irr_pct)
    })
  })

  describe('execPowerScore', () => {
    it('should calculate total power score', () => {
      const result = execPowerScore({
        scale_economies: 8,
        network_economies: 7,
        counter_positioning: 6,
        switching_costs: 5,
        branding: 4,
        cornered_resource: 9,
        process_power: 3,
      })
      expect(result.total).toBe(42)
      expect(result.max).toBe(70)
      expect(result.assessment).toContain('Средний')
    })

    it('should assess strong moat for high scores', () => {
      const result = execPowerScore({
        scale_economies: 9, network_economies: 8,
        counter_positioning: 8, switching_costs: 7,
        branding: 7, cornered_resource: 8, process_power: 6,
      })
      expect(result.total).toBeGreaterThanOrEqual(50)
      expect(result.assessment).toContain('Сильный')
    })

    it('should assess weak moat for low scores', () => {
      const result = execPowerScore({
        scale_economies: 2, network_economies: 1,
        counter_positioning: 3, switching_costs: 2,
        branding: 1, cornered_resource: 1, process_power: 1,
      })
      expect(result.total).toBeLessThan(30)
      expect(result.assessment).toContain('Слабый')
    })

    it('should handle missing fields as zero', () => {
      const result = execPowerScore({})
      expect(result.total).toBe(0)
    })
  })

  describe('execBayesian', () => {
    it('should increase posterior with positive evidence', () => {
      const result = execBayesian(0.08, [3, 2], [])
      expect(result.posterior).toBeGreaterThan(0.08)
      expect(result.delta_pct).toBeGreaterThan(0)
    })

    it('should decrease posterior with negative evidence', () => {
      const result = execBayesian(0.50, [], [0.3, 0.5])
      expect(result.posterior).toBeLessThan(0.50)
      expect(result.delta_pct).toBeLessThan(0)
    })

    it('should clamp posterior between 0.001 and 0.999', () => {
      const result = execBayesian(0.99, [100, 100], [])
      expect(result.posterior).toBeLessThanOrEqual(0.999)

      const result2 = execBayesian(0.01, [], [0.001, 0.001])
      expect(result2.posterior).toBeGreaterThanOrEqual(0.001)
    })

    it('should return correct interpretation', () => {
      const positive = execBayesian(0.5, [3], [])
      expect(positive.interpretation).toBe('Положительный прогноз')

      const doubtful = execBayesian(0.3, [], [])
      expect(doubtful.interpretation).toBe('Сомнительный')

      const negative = execBayesian(0.08, [], [0.5])
      expect(negative.interpretation).toBe('Негативный прогноз')
    })
  })
})
