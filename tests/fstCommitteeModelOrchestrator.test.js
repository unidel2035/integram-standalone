/**
 * Unit tests for fstCommitteeModelOrchestrator.js
 */

import { describe, it, expect } from 'vitest'
import {
  COMMITTEE_MODELS,
  MODEL_MAP,
  SPEED_PROFILES,
  AGENT_MODEL_MATRIX,
  resolveModel,
  buildModelMap,
  getModelSummary,
} from '../src/components/fst-committee/fstCommitteeModelOrchestrator.js'

describe('fstCommitteeModelOrchestrator — COMMITTEE_MODELS', () => {
  it('defines at least 5 models', () => {
    expect(COMMITTEE_MODELS.length).toBeGreaterThanOrEqual(5)
  })

  it('all models have required fields', () => {
    for (const m of COMMITTEE_MODELS) {
      expect(m.id).toBeTruthy()
      expect(m.label).toBeTruthy()
      expect(m.description).toBeTruthy()
      expect(['fast', 'medium', 'slow', 'slowest']).toContain(m.speed)
      expect(['low', 'medium', 'high', 'highest']).toContain(m.quality)
      expect(typeof m.supportsJson).toBe('boolean')
    }
  })
})

describe('fstCommitteeModelOrchestrator — MODEL_MAP', () => {
  it('maps all models by id', () => {
    for (const m of COMMITTEE_MODELS) {
      expect(MODEL_MAP[m.id]).toBe(m)
    }
  })

  it('quick lookup works', () => {
    expect(MODEL_MAP['polza/qwen/qwen-turbo']?.label).toContain('Qwen')
  })
})

describe('fstCommitteeModelOrchestrator — SPEED_PROFILES', () => {
  it('has fast, balanced, and quality profiles', () => {
    expect(SPEED_PROFILES.fast).toBeDefined()
    expect(SPEED_PROFILES.balanced).toBeDefined()
    expect(SPEED_PROFILES.quality).toBeDefined()
  })

  it('each profile has required fields', () => {
    for (const [name, profile] of Object.entries(SPEED_PROFILES)) {
      expect(profile.label, `${name}.label`).toBeTruthy()
      expect(profile.description, `${name}.description`).toBeTruthy()
      expect(profile.default, `${name}.default`).toBeTruthy()
      expect(profile.synthesis, `${name}.synthesis`).toBeTruthy()
      expect(typeof profile.maxIter, `${name}.maxIter`).toBe('number')
      expect(typeof profile.debateRounds, `${name}.debateRounds`).toBe('number')
    }
  })

  it('fast has lower maxIter than quality', () => {
    expect(SPEED_PROFILES.fast.maxIter).toBeLessThan(SPEED_PROFILES.quality.maxIter)
  })

  it('quality uses premium models', () => {
    expect(SPEED_PROFILES.quality.default).toBe('deepseek-chat')
    expect(SPEED_PROFILES.quality.synthesis).toContain('claude')
  })
})

describe('fstCommitteeModelOrchestrator — AGENT_MODEL_MATRIX', () => {
  const EXPECTED_AGENTS = ['tech', 'finance', 'sovereignty', 'risk', 'portfolio', 'devil']

  it('covers all core agents', () => {
    for (const agent of EXPECTED_AGENTS) {
      expect(AGENT_MODEL_MATRIX[agent], `Missing matrix for ${agent}`).toBeDefined()
    }
  })

  it('each agent has OPENING, CHALLENGE, COUNTER, SYNTHESIS, default', () => {
    for (const [agent, matrix] of Object.entries(AGENT_MODEL_MATRIX)) {
      for (const task of ['OPENING', 'CHALLENGE', 'COUNTER', 'SYNTHESIS', 'default']) {
        expect(matrix[task], `${agent} missing ${task}`).toBeDefined()
        expect(matrix[task].fast, `${agent}.${task} missing fast`).toBeTruthy()
        expect(matrix[task].balanced, `${agent}.${task} missing balanced`).toBeTruthy()
        expect(matrix[task].quality, `${agent}.${task} missing quality`).toBeTruthy()
      }
    }
  })
})

describe('fstCommitteeModelOrchestrator — resolveModel', () => {
  it('returns model from matrix for known agent + task + profile', () => {
    const model = resolveModel('tech', 'OPENING', 'fast')
    expect(model).toBe(AGENT_MODEL_MATRIX.tech.OPENING.fast)
  })

  it('uses override when provided', () => {
    const model = resolveModel('tech', 'OPENING', 'fast', { tech: 'custom-model' })
    expect(model).toBe('custom-model')
  })

  it('falls back to agent default when task not in matrix', () => {
    const model = resolveModel('tech', 'UNKNOWN_TASK', 'fast')
    expect(model).toBe(AGENT_MODEL_MATRIX.tech.default.fast)
  })

  it('falls back to profile default for unknown agent', () => {
    const model = resolveModel('unknown_agent', 'OPENING', 'fast')
    expect(model).toBe(SPEED_PROFILES.fast.default)
  })

  it('falls back to qwen-turbo for unknown profile + unknown agent', () => {
    const model = resolveModel('unknown_agent', 'OPENING', 'unknown_profile')
    expect(model).toBe('polza/qwen/qwen-turbo')
  })

  it('devil CHALLENGE in fast mode uses qwen-turbo', () => {
    expect(resolveModel('devil', 'CHALLENGE', 'fast')).toBe('polza/qwen/qwen-turbo')
  })

  it('portfolio SYNTHESIS in quality mode uses claude', () => {
    expect(resolveModel('portfolio', 'SYNTHESIS', 'quality')).toContain('claude')
  })
})

describe('fstCommitteeModelOrchestrator — buildModelMap', () => {
  it('generates map for given agents', () => {
    const map = buildModelMap(['tech', 'finance', 'risk'], 'fast')
    expect(Object.keys(map)).toEqual(['tech', 'finance', 'risk'])
    expect(map.tech).toBeTruthy()
    expect(map.finance).toBeTruthy()
  })

  it('applies overrides', () => {
    const map = buildModelMap(['tech'], 'fast', { tech: 'my-model' })
    expect(map.tech).toBe('my-model')
  })

  it('uses OPENING task type for map generation', () => {
    const map = buildModelMap(['tech'], 'quality')
    expect(map.tech).toBe(AGENT_MODEL_MATRIX.tech.OPENING.quality)
  })
})

describe('fstCommitteeModelOrchestrator — getModelSummary', () => {
  it('summarizes model usage', () => {
    const map = { tech: 'polza/qwen/qwen-turbo', finance: 'polza/qwen/qwen-turbo', risk: 'deepseek-chat' }
    const summary = getModelSummary(map)
    expect(summary).toContain('2')
    expect(summary).toContain('1')
  })

  it('uses label from MODEL_MAP when available', () => {
    const map = { tech: 'polza/qwen/qwen-turbo' }
    expect(getModelSummary(map)).toContain('Qwen Turbo')
  })

  it('uses model id tail for unknown models', () => {
    const map = { tech: 'provider/custom-model-x' }
    expect(getModelSummary(map)).toContain('custom-model-x')
  })

  it('sorts by count descending', () => {
    const map = { a: 'polza/qwen/qwen-turbo', b: 'polza/qwen/qwen-turbo', c: 'polza/qwen/qwen-turbo', d: 'deepseek-chat' }
    const summary = getModelSummary(map)
    const idx3 = summary.indexOf('3')
    const idx1 = summary.indexOf('1')
    expect(idx3).toBeLessThan(idx1)
  })

  it('handles empty map', () => {
    expect(getModelSummary({})).toBe('')
  })
})
