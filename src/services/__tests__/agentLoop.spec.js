/**
 * Unit Tests for AgentLoop
 *
 * Tests: parseLoopResponse, runAgentLoop flow, DebateRoom integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need to test the internal functions — import the module and extract
// Since AgentLoop uses fetch and localStorage, we mock them

// Mock localStorage
const storage = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn(k => storage[k] || null),
  setItem: vi.fn((k, v) => { storage[k] = v }),
  removeItem: vi.fn(k => { delete storage[k] }),
})

// Mock sessionStorage
vi.stubGlobal('sessionStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
})

// Mock fetch
vi.stubGlobal('fetch', vi.fn())

// We can't easily import private functions, so we test via the public API
import { runAgentLoop, runParallelAgents, resetLoopTokenCache } from '../../components/fst-committee/AgentLoop.js'
import { resolveModel, buildModelMap, getModelSummary, SPEED_PROFILES, COMMITTEE_MODELS } from '../../components/fst-committee/fstCommitteeModelOrchestrator.js'

describe('fstCommitteeModelOrchestrator', () => {

  describe('resolveModel', () => {
    it('should return user override if provided', () => {
      const model = resolveModel('tech', 'OPENING', 'fast', { tech: 'custom-model' })
      expect(model).toBe('custom-model')
    })

    it('should resolve from matrix for known agent+task+profile', () => {
      const model = resolveModel('tech', 'OPENING', 'fast')
      expect(model).toBeTruthy()
      expect(typeof model).toBe('string')
    })

    it('should fallback to profile default for unknown agent', () => {
      const model = resolveModel('unknown', 'OPENING', 'fast')
      expect(model).toBe(SPEED_PROFILES.fast.default)
    })

    it('should fallback to default task row for unknown task type', () => {
      const model = resolveModel('tech', 'UNKNOWN_TASK', 'balanced')
      expect(model).toBeTruthy()
    })

    it('should use qwen-turbo as ultimate fallback', () => {
      const model = resolveModel('unknown', 'UNKNOWN', 'unknown_profile')
      expect(model).toBe('polza/qwen/qwen-turbo')
    })
  })

  describe('buildModelMap', () => {
    it('should build map for all agents', () => {
      const agents = ['tech', 'finance', 'risk', 'devil']
      const map = buildModelMap(agents, 'fast')
      expect(Object.keys(map)).toEqual(agents)
      for (const id of agents) {
        expect(map[id]).toBeTruthy()
      }
    })

    it('should apply overrides', () => {
      const map = buildModelMap(['tech', 'finance'], 'fast', { tech: 'custom' })
      expect(map.tech).toBe('custom')
    })
  })

  describe('getModelSummary', () => {
    it('should summarize model distribution', () => {
      const map = { tech: 'polza/qwen/qwen-turbo', finance: 'polza/qwen/qwen-turbo', risk: 'deepseek-chat' }
      const summary = getModelSummary(map)
      expect(summary).toContain('2×')
      expect(summary).toContain('1×')
    })
  })

  describe('SPEED_PROFILES', () => {
    it('should have all required profiles', () => {
      expect(SPEED_PROFILES.fast).toBeDefined()
      expect(SPEED_PROFILES.balanced).toBeDefined()
      expect(SPEED_PROFILES.quality).toBeDefined()
    })

    it('each profile should have required fields', () => {
      for (const [key, profile] of Object.entries(SPEED_PROFILES)) {
        expect(profile.label, `${key}.label`).toBeTruthy()
        expect(profile.description, `${key}.description`).toBeTruthy()
        expect(profile.default, `${key}.default`).toBeTruthy()
        expect(profile.synthesis, `${key}.synthesis`).toBeTruthy()
        expect(profile.maxIter, `${key}.maxIter`).toBeGreaterThan(0)
        expect(profile.debateRounds, `${key}.debateRounds`).toBeGreaterThan(0)
      }
    })

    it('fast profile should have fewer iterations than quality', () => {
      expect(SPEED_PROFILES.fast.maxIter).toBeLessThan(SPEED_PROFILES.quality.maxIter)
    })
  })

  describe('COMMITTEE_MODELS', () => {
    it('should have at least 4 models', () => {
      expect(COMMITTEE_MODELS.length).toBeGreaterThanOrEqual(4)
    })

    it('each model should have required fields', () => {
      for (const m of COMMITTEE_MODELS) {
        expect(m.id).toBeTruthy()
        expect(m.label).toBeTruthy()
        expect(m.description).toBeTruthy()
        expect(['fast', 'medium', 'slow', 'slowest']).toContain(m.speed)
        expect(['low', 'medium', 'high', 'highest']).toContain(m.quality)
      }
    })
  })
})

describe('AgentLoop', () => {

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    resetLoopTokenCache()
  })

  describe('runAgentLoop', () => {
    it('should return null when LLM returns no response', async () => {
      // Mock fetch to return empty
      fetch.mockResolvedValueOnce({ ok: false }) // getLoopToken
      fetch.mockResolvedValueOnce({ ok: false }) // callLLM

      const agent = { id: 'tech', name: 'Tech', focus: ['trl'] }
      const room = {
        format: vi.fn(() => []),
        logToolCall: vi.fn(),
      }
      const project = { title: 'Test', trl: 7, projectedIRR: 0.25 }

      const result = await runAgentLoop(agent, 'OPENING', room, project)
      expect(result).toBeNull()
    })

    it('should parse publish response and return argument', async () => {
      const publishResponse = JSON.stringify({
        action: 'publish',
        text: 'Проект имеет TRL 7, что достаточно для инвестиций',
        dimension: 'trl',
        confidence: 0.85,
        stance: 'APPROVE',
      })

      // getCurrentUserId() returns null → getLoopToken skips fetch
      // Only need mock for callLLM
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: publishResponse }),
      })

      const agent = { id: 'tech', name: 'Tech', focus: ['trl'] }
      const room = { format: vi.fn(() => []), logToolCall: vi.fn() }
      const project = { title: 'Test', trl: 7, projectedIRR: 0.25 }

      const result = await runAgentLoop(agent, 'OPENING', room, project)

      expect(result).not.toBeNull()
      expect(result.agentId).toBe('tech')
      expect(result.type).toBe('OPENING')
      expect(result.text).toContain('TRL 7')
      expect(result.confidence).toBe(0.85)
      expect(result.stance).toBe('APPROVE')
      expect(result.dimension).toBe('trl')
      expect(result.agentLoop).toBe(true)
      expect(result.aiGenerated).toBe(true)
    })

    it('should handle tool_call then publish sequence', async () => {
      const toolCallResponse = JSON.stringify({
        action: 'tool_call',
        tool: 'query_data',
        args: { fields: ['trl', 'mrl'] },
        reasoning: 'Получаю TRL/MRL проекта',
      })

      const publishResponse = JSON.stringify({
        action: 'publish',
        text: 'TRL=7, MRL=5 — готов к серии',
        dimension: 'trl',
        confidence: 0.80,
        stance: 'APPROVE',
      })

      // getCurrentUserId() returns null → getLoopToken skips fetch
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: toolCallResponse }),
      })
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: publishResponse }),
      })

      const agent = { id: 'tech', name: 'Tech', focus: ['trl'] }
      const room = { format: vi.fn(() => []), logToolCall: vi.fn() }
      const project = { title: 'Test', trl: 7, mrl: 5, projectedIRR: 0.25 }

      const result = await runAgentLoop(agent, 'OPENING', room, project)

      expect(result).not.toBeNull()
      expect(result.toolsUsed).toContain('query_data')
      expect(result.iterCount).toBe(1) // one tool call iteration
    })

    it('should clamp confidence to [0, 1]', async () => {
      const response = JSON.stringify({
        action: 'publish',
        text: 'Test',
        dimension: 'finance',
        confidence: 1.5, // out of range
        stance: 'APPROVE',
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response }),
      })

      const agent = { id: 'finance', name: 'Finance', focus: ['finance'] }
      const room = { format: vi.fn(() => []), logToolCall: vi.fn() }
      const project = { title: 'Test' }

      const result = await runAgentLoop(agent, 'OPENING', room, project)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('should validate stance values', async () => {
      const response = JSON.stringify({
        action: 'publish',
        text: 'Test argument',
        dimension: 'risk',
        confidence: 0.7,
        stance: 'INVALID_STANCE',
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response }),
      })

      const agent = { id: 'risk', name: 'Risk', focus: ['risk'] }
      const room = { format: vi.fn(() => []), logToolCall: vi.fn() }
      const project = { title: 'Test' }

      const result = await runAgentLoop(agent, 'OPENING', room, project)
      expect(result.stance).toBeNull() // invalid stance should be null
    })
  })

  describe('runParallelAgents', () => {
    it('should handle all agents failing gracefully', async () => {
      fetch.mockResolvedValue({ ok: false })

      const agents = [
        { id: 'tech', name: 'Tech', focus: ['trl'] },
        { id: 'finance', name: 'Finance', focus: ['finance'] },
      ]
      const room = { format: vi.fn(() => []), logToolCall: vi.fn() }
      const project = { title: 'Test' }

      const results = await runParallelAgents(agents, 'OPENING', room, project, {})
      expect(results).toEqual([]) // all failed → empty
    })
  })
})
