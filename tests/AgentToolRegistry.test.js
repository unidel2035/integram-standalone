/**
 * Unit tests for AgentToolRegistry.js
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
} from '../src/components/fst-committee/AgentToolRegistry.js'

describe('AgentToolRegistry — TOOL_SCHEMAS', () => {
  it('defines all expected tools', () => {
    const expectedTools = [
      'read_room', 'query_data', 'calc_irr', 'calc_npv',
      'calc_monte_carlo', 'calc_power_score', 'calc_bayesian',
      'search_precedents', 'web_search', 'memory_search', 'exec_code',
    ]
    for (const tool of expectedTools) {
      expect(TOOL_SCHEMAS[tool]).toBeDefined()
      expect(TOOL_SCHEMAS[tool].name).toBe(tool)
      expect(TOOL_SCHEMAS[tool].description).toBeTruthy()
      expect(TOOL_SCHEMAS[tool].params).toBeDefined()
    }
  })
})

describe('AgentToolRegistry — AGENT_TOOLS', () => {
  const BASE_TOOLS = ['read_room', 'query_data', 'web_search', 'memory_search', 'exec_code']

  it('all agents have base tools', () => {
    for (const [agentId, tools] of Object.entries(AGENT_TOOLS)) {
      for (const base of BASE_TOOLS) {
        expect(tools, `${agentId} missing ${base}`).toContain(base)
      }
    }
  })

  it('finance agent has calc_irr and calc_npv', () => {
    expect(AGENT_TOOLS.finance).toContain('calc_irr')
    expect(AGENT_TOOLS.finance).toContain('calc_npv')
  })

  it('monte_carlo agent has calc_monte_carlo and calc_irr', () => {
    expect(AGENT_TOOLS.monte_carlo).toContain('calc_monte_carlo')
    expect(AGENT_TOOLS.monte_carlo).toContain('calc_irr')
  })

  it('bayesian agent has calc_bayesian and search_precedents', () => {
    expect(AGENT_TOOLS.bayesian).toContain('calc_bayesian')
    expect(AGENT_TOOLS.bayesian).toContain('search_precedents')
  })

  it('power_score agent has calc_power_score', () => {
    expect(AGENT_TOOLS.power_score).toContain('calc_power_score')
  })

  it('risk agent has search_precedents', () => {
    expect(AGENT_TOOLS.risk).toContain('search_precedents')
  })
})

describe('AgentToolRegistry — getToolsForAgent', () => {
  it('returns tool schema objects for known agent', () => {
    const tools = getToolsForAgent('finance')
    expect(tools.length).toBeGreaterThanOrEqual(5)
    expect(tools.every(t => t.name && t.description)).toBe(true)
    expect(tools.find(t => t.name === 'calc_irr')).toBeDefined()
  })

  it('returns fallback tools for unknown agent', () => {
    const tools = getToolsForAgent('unknown_agent')
    expect(tools).toHaveLength(2)
    expect(tools.map(t => t.name)).toEqual(['read_room', 'query_data'])
  })
})

describe('AgentToolRegistry — formatToolsForPrompt', () => {
  it('formats tools into readable string', () => {
    const tools = getToolsForAgent('tech')
    const formatted = formatToolsForPrompt(tools)
    expect(formatted).toContain('read_room:')
    expect(formatted).toContain('query_data:')
  })

  it('returns empty string for empty array', () => {
    expect(formatToolsForPrompt([])).toBe('')
  })
})

describe('AgentToolRegistry — execCalcIrr', () => {
  it('calculates IRR for simple cashflows', () => {
    const result = execCalcIrr([130], 100)
    expect(result.irr_pct).toBeCloseTo(30, 0)
    expect(result.irr).toBeCloseTo(0.3, 1)
  })

  it('calculates IRR for multi-year cashflows', () => {
    const result = execCalcIrr([50, 50, 50], 100)
    expect(result.irr_pct).toBeGreaterThan(20)
  })

  it('returns negative IRR for unprofitable project', () => {
    const result = execCalcIrr([10, 10, 10], 100)
    expect(result.irr_pct).toBeLessThan(0)
  })

  it('handles zero cashflows', () => {
    const result = execCalcIrr([0, 0, 100], 100)
    expect(typeof result.irr).toBe('number')
  })
})

describe('AgentToolRegistry — execCalcNpv', () => {
  it('calculates NPV correctly', () => {
    const result = execCalcNpv([100], 80, 0.10)
    expect(result.npv).toBeCloseTo(10.91, 1)
    expect(result.pi).toBeGreaterThan(1)
  })

  it('returns negative NPV for bad investment', () => {
    const result = execCalcNpv([10], 100, 0.10)
    expect(result.npv).toBeLessThan(0)
    expect(result.pi).toBeLessThan(1)
  })

  it('handles zero WACC', () => {
    const result = execCalcNpv([50, 50, 50], 100, 0)
    expect(result.npv).toBeCloseTo(50, 0)
  })
})

describe('AgentToolRegistry — execMonteCarlo', () => {
  it('returns expected fields', () => {
    const result = execMonteCarlo(0.30, 0.35, 1000)
    expect(result).toHaveProperty('p_positive_pct')
    expect(result).toHaveProperty('median_irr_pct')
    expect(result).toHaveProperty('var_5pct_irr')
    expect(result).toHaveProperty('p95_irr_pct')
    expect(result).toHaveProperty('mean_irr_pct')
  })

  it('p_positive is between 0 and 100', () => {
    const result = execMonteCarlo(0.30, 0.35, 1000)
    expect(result.p_positive_pct).toBeGreaterThanOrEqual(0)
    expect(result.p_positive_pct).toBeLessThanOrEqual(100)
  })

  it('VaR 5% is less than median', () => {
    const result = execMonteCarlo(0.30, 0.35, 1000)
    expect(result.var_5pct_irr).toBeLessThanOrEqual(result.median_irr_pct)
  })

  it('P95 is greater than median', () => {
    const result = execMonteCarlo(0.30, 0.35, 1000)
    expect(result.p95_irr_pct).toBeGreaterThanOrEqual(result.median_irr_pct)
  })

  it('high base_irr with low volatility gives mostly positive', () => {
    const result = execMonteCarlo(0.50, 0.1, 1000)
    expect(result.p_positive_pct).toBeGreaterThan(90)
  })
})

describe('AgentToolRegistry — execPowerScore', () => {
  it('calculates total from all 7 powers', () => {
    const scores = {
      scale_economies: 8, network_economies: 7, counter_positioning: 6,
      switching_costs: 5, branding: 4, cornered_resource: 3, process_power: 2,
    }
    const result = execPowerScore(scores)
    expect(result.total).toBe(35)
    expect(result.max).toBe(70)
    expect(result.assessment).toContain('Средний моат')
  })

  it('strong moat for total >= 50', () => {
    const scores = {
      scale_economies: 8, network_economies: 9, counter_positioning: 8,
      switching_costs: 7, branding: 6, cornered_resource: 7, process_power: 6,
    }
    const result = execPowerScore(scores)
    expect(result.total).toBe(51)
    expect(result.assessment).toContain('Сильный моат')
  })

  it('weak moat for total < 30', () => {
    const scores = {
      scale_economies: 2, network_economies: 3, counter_positioning: 4,
      switching_costs: 3, branding: 2, cornered_resource: 1, process_power: 2,
    }
    const result = execPowerScore(scores)
    expect(result.total).toBe(17)
    expect(result.assessment).toContain('Слабый моат')
  })

  it('handles missing fields as 0', () => {
    const result = execPowerScore({ scale_economies: 10 })
    expect(result.total).toBe(10)
    expect(result.breakdown.network_economies).toBe(0)
  })

  it('returns breakdown of all powers', () => {
    const result = execPowerScore({ scale_economies: 5, branding: 3 })
    expect(Object.keys(result.breakdown)).toHaveLength(7)
  })
})

describe('AgentToolRegistry — execBayesian', () => {
  it('updates prior with positive evidence', () => {
    const result = execBayesian(0.08, [3, 2], [])
    expect(result.posterior).toBeGreaterThan(0.08)
    expect(result.delta_pct).toBeGreaterThan(0)
  })

  it('updates prior with negative evidence', () => {
    const result = execBayesian(0.5, [], [0.3, 0.5])
    expect(result.posterior).toBeLessThan(0.5)
    expect(result.delta_pct).toBeLessThan(0)
  })

  it('returns posterior between 0.001 and 0.999', () => {
    const result = execBayesian(0.5, [100, 100, 100], [])
    expect(result.posterior).toBeLessThanOrEqual(0.999)
    const result2 = execBayesian(0.5, [], [0.001, 0.001])
    expect(result2.posterior).toBeGreaterThanOrEqual(0.001)
  })

  it('returns correct interpretation', () => {
    expect(execBayesian(0.5, [3], []).interpretation).toBe('Положительный прогноз')
    expect(execBayesian(0.5, [], [0.5]).interpretation).toBe('Сомнительный')
    expect(execBayesian(0.1, [], [0.1, 0.1]).interpretation).toBe('Негативный прогноз')
  })

  it('handles empty evidence arrays', () => {
    const result = execBayesian(0.5, [], [])
    expect(result.posterior).toBeCloseTo(0.5, 2)
    expect(result.delta_pct).toBeCloseTo(0, 1)
  })

  it('returns posterior_pct as percentage', () => {
    const result = execBayesian(0.5, [], [])
    expect(result.posterior_pct).toBeCloseTo(50, 0)
  })
})
