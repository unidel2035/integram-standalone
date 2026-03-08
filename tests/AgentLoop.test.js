/**
 * Unit tests for AgentLoop.js
 *
 * Tests response parsing, JSON extraction, and module exports.
 * LLM calls are mocked - only pure logic is tested.
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("../src/components/fst-committee/fstCommitteeModelOrchestrator.js", () => ({
  resolveModel: vi.fn(() => "polza/qwen/qwen-turbo"),
  SPEED_PROFILES: {
    fast: { maxIter: 2, default: "polza/qwen/qwen-turbo" },
    balanced: { maxIter: 3, default: "polza/google/gemini-2.5-flash-lite" },
    quality: { maxIter: 5, default: "deepseek-chat" },
  },
}))

vi.mock("../src/services/aiTokenService.js", () => ({
  getCurrentUserId: vi.fn(() => null),
}))

// extractFirstJson - pure function, re-implemented for testing
describe("AgentLoop - extractFirstJson (logic verification)", () => {
  function extractFirstJson(str) {
    let depth = 0, start = -1
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "{") { if (depth++ === 0) start = i }
      else if (str[i] === "}" && --depth === 0 && start !== -1) return str.slice(start, i + 1)
    }
    return null
  }

  it("extracts JSON from plain string", () => {
    const result = extractFirstJson('{"action": "publish", "text": "hello"}')
    expect(JSON.parse(result)).toEqual({ action: "publish", text: "hello" })
  })

  it("extracts JSON surrounded by text", () => {
    const result = extractFirstJson('Before {"action": "tool_call"} after')
    expect(JSON.parse(result)).toEqual({ action: "tool_call" })
  })

  it("handles nested JSON", () => {
    const result = extractFirstJson('{"action": "tool_call", "args": {"n": 5}}')
    expect(JSON.parse(result).args.n).toBe(5)
  })

  it("returns null for no JSON", () => {
    expect(extractFirstJson("no json here")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(extractFirstJson("")).toBeNull()
  })

  it("returns first JSON when multiple exist", () => {
    const result = extractFirstJson('{"a": 1} {"b": 2}')
    expect(JSON.parse(result)).toEqual({ a: 1 })
  })
})

// parseLoopResponse - pure function, re-implemented for testing
describe("AgentLoop - parseLoopResponse (logic verification)", () => {
  function extractFirstJson(str) {
    let depth = 0, start = -1
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "{") { if (depth++ === 0) start = i }
      else if (str[i] === "}" && --depth === 0 && start !== -1) return str.slice(start, i + 1)
    }
    return null
  }

  function parseLoopResponse(raw) {
    if (!raw) return null
    const jsonStr = extractFirstJson(raw)
    if (jsonStr) {
      try {
        const p = JSON.parse(jsonStr)
        if (p.action === "tool_call" && p.tool) return { type: "tool_call", tool: p.tool, args: p.args || {}, reasoning: p.reasoning || "" }
        if (p.action === "publish" && p.text)  return { type: "publish", text: p.text, dimension: p.dimension, confidence: p.confidence, stance: p.stance }
        if (p.text) return { type: "publish", text: p.text, dimension: p.dimension, confidence: p.confidence, stance: p.stance }
      } catch { /* fall through */ }
    }
    const text = raw.replace(/```[\s\S]*?```/g, "").replace(/\{[\s\S]*?\}/g, "").trim()
    if (text.length > 15) return { type: "publish", text, dimension: null, confidence: 0.65, stance: null }
    return null
  }

  it("parses tool_call response", () => {
    const raw = '{"action": "tool_call", "tool": "calc_irr", "args": {"cashflows": [10, 20]}, "reasoning": "testing"}'
    const result = parseLoopResponse(raw)
    expect(result.type).toBe("tool_call")
    expect(result.tool).toBe("calc_irr")
    expect(result.args).toEqual({ cashflows: [10, 20] })
    expect(result.reasoning).toBe("testing")
  })

  it("parses publish response", () => {
    const raw = '{"action": "publish", "text": "IRR is 30%", "dimension": "finance", "confidence": 0.85, "stance": "APPROVE"}'
    const result = parseLoopResponse(raw)
    expect(result.type).toBe("publish")
    expect(result.text).toBe("IRR is 30%")
    expect(result.dimension).toBe("finance")
    expect(result.confidence).toBe(0.85)
    expect(result.stance).toBe("APPROVE")
  })

  it("parses text-only JSON (legacy format)", () => {
    const raw = '{"text": "Some argument here", "dimension": "trl"}'
    const result = parseLoopResponse(raw)
    expect(result.type).toBe("publish")
    expect(result.text).toBe("Some argument here")
  })

  it("falls back to plain text for long non-JSON response", () => {
    const raw = "This is a plain text response that is long enough to be an argument here."
    const result = parseLoopResponse(raw)
    expect(result.type).toBe("publish")
    expect(result.confidence).toBe(0.65)
  })

  it("returns null for null/empty input", () => {
    expect(parseLoopResponse(null)).toBeNull()
    expect(parseLoopResponse("")).toBeNull()
  })

  it("returns null for short plain text", () => {
    expect(parseLoopResponse("too short")).toBeNull()
  })

  it("handles tool_call without args", () => {
    const raw = '{"action": "tool_call", "tool": "read_room"}'
    const result = parseLoopResponse(raw)
    expect(result.type).toBe("tool_call")
    expect(result.args).toEqual({})
  })
})

// Module exports
describe("AgentLoop - exports", () => {
  it("exports runAgentLoop and runParallelAgents", async () => {
    const mod = await import("../src/components/fst-committee/AgentLoop.js")
    expect(typeof mod.runAgentLoop).toBe("function")
    expect(typeof mod.runParallelAgents).toBe("function")
    expect(typeof mod.resetLoopTokenCache).toBe("function")
  })
})

describe("AgentLoop - all 12 agent IDs covered in AGENT_TOOLS", () => {
  const EXPECTED_AGENTS = [
    "tech", "finance", "sovereignty", "risk", "portfolio", "devil",
    "monte_carlo", "real_options", "market_timing", "bayesian", "power_score", "game_theory",
  ]

  it("all 12 agent IDs are defined", async () => {
    const { AGENT_TOOLS } = await import("../src/components/fst-committee/AgentToolRegistry.js")
    for (const id of EXPECTED_AGENTS) {
      expect(AGENT_TOOLS[id], "Missing tools for agent: " + id).toBeDefined()
    }
  })
})
