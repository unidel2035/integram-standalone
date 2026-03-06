/**
 * useMultiAgent.js — Multi-Agent Orchestration (AutoGen/MetaGPT/Swarm pattern)
 *
 * Modes:
 *   - bestOfN:   Run N agents, pick the best response (by length, confidence, user vote)
 *   - consensus:  Run N agents, synthesize a combined answer
 *   - debate:     Agents critique each other's answers, refine iteratively
 *   - delegate:   Primary agent decides which specialist to call
 *
 * Integrates with useAgentSelector for agent pool.
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'

const MULTI_AGENT_KEY = 'multiAgentConfig'

export function useMultiAgent() {
  const config = reactive({
    enabled: false,
    mode: 'bestOfN', // bestOfN | consensus | debate | delegate
    agentIds: [],     // selected agent IDs for multi-agent
    maxRounds: 2,     // for debate mode
    autoSelect: false  // auto-pick agents based on triggers
  })

  const lastExecution = ref(null)
  const isRunning = ref(false)

  // Load config
  try {
    const saved = localStorage.getItem(MULTI_AGENT_KEY)
    if (saved) Object.assign(config, JSON.parse(saved))
  } catch { /* ignore */ }

  function saveConfig() {
    try {
      localStorage.setItem(MULTI_AGENT_KEY, JSON.stringify(config))
    } catch { /* ignore */ }
  }

  /**
   * Enable multi-agent mode
   */
  function enable(mode = 'bestOfN', agentIds = []) {
    config.enabled = true
    config.mode = mode
    config.agentIds = agentIds
    saveConfig()
  }

  function disable() {
    config.enabled = false
    saveConfig()
  }

  function setAgents(agentIds) {
    config.agentIds = agentIds
    saveConfig()
  }

  /**
   * Execute in bestOfN mode — run all agents, return all responses ranked
   * @param {string} message
   * @param {Array} agents - array of agent objects
   * @param {Function} sendFn - async (message, systemPrompt, agentContext) => response
   * @returns {Array<{agent, response, score}>}
   */
  async function executeBestOfN(message, agents, sendFn) {
    isRunning.value = true
    const results = []

    try {
      const promises = agents.map(async (agent) => {
        const startTime = Date.now()
        const response = await sendFn(message, agent.systemPrompt, {
          id: agent.id,
          name: agent.name
        })
        const elapsed = Date.now() - startTime
        return {
          agent,
          response,
          elapsed,
          score: scoreResponse(response, message)
        }
      })

      const resolved = await Promise.allSettled(promises)
      for (const r of resolved) {
        if (r.status === 'fulfilled') results.push(r.value)
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score)
      logger.info(`[MultiAgent] bestOfN: ${results.length} responses, best: ${results[0]?.agent.name}`)
    } finally {
      isRunning.value = false
    }

    lastExecution.value = { mode: 'bestOfN', results, timestamp: Date.now() }
    return results
  }

  /**
   * Execute in consensus mode — run all agents, then synthesize
   * @param {string} message
   * @param {Array} agents
   * @param {Function} sendFn
   * @returns {{ responses: Array, synthesis: string }}
   */
  async function executeConsensus(message, agents, sendFn) {
    isRunning.value = true

    try {
      // Phase 1: Get all responses
      const promises = agents.map(async (agent) => {
        const response = await sendFn(message, agent.systemPrompt, {
          id: agent.id,
          name: agent.name
        })
        return { agent, response }
      })

      const resolved = await Promise.allSettled(promises)
      const responses = resolved
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)

      // Phase 2: Synthesize
      const synthesisPrompt = buildConsensusPrompt(message, responses)
      const synthesis = await sendFn(synthesisPrompt,
        'You are a synthesis agent. Analyze multiple expert responses and create a comprehensive, balanced answer that combines the best insights from each. Note areas of agreement and disagreement.',
        { id: 'synthesis', name: 'Synthesis Agent' }
      )

      logger.info(`[MultiAgent] consensus: ${responses.length} responses synthesized`)
      lastExecution.value = { mode: 'consensus', responses, synthesis, timestamp: Date.now() }

      return { responses, synthesis }
    } finally {
      isRunning.value = false
    }
  }

  /**
   * Execute in debate mode — agents critique and refine
   * @param {string} message
   * @param {Array} agents - exactly 2 agents
   * @param {Function} sendFn
   * @returns {{ rounds: Array, finalAnswer: string }}
   */
  async function executeDebate(message, agents, sendFn) {
    if (agents.length < 2) throw new Error('Debate requires at least 2 agents')
    isRunning.value = true

    const debaters = agents.slice(0, 2)
    const rounds = []

    try {
      // Initial responses
      const initial = await Promise.all(debaters.map(async (agent) => {
        const response = await sendFn(message, agent.systemPrompt, {
          id: agent.id, name: agent.name
        })
        return { agent, response }
      }))
      rounds.push({ type: 'initial', responses: initial })

      // Debate rounds
      for (let r = 0; r < config.maxRounds; r++) {
        const lastRound = rounds[rounds.length - 1].responses
        const critiques = []

        for (let i = 0; i < 2; i++) {
          const otherResponse = lastRound[1 - i].response
          const critiquePrompt = `The user asked: "${message}"\n\nAnother expert responded:\n"${otherResponse}"\n\nPlease analyze this response: identify strengths, weaknesses, and provide your improved answer.`

          const response = await sendFn(critiquePrompt, debaters[i].systemPrompt, {
            id: debaters[i].id, name: debaters[i].name
          })
          critiques.push({ agent: debaters[i], response })
        }
        rounds.push({ type: 'critique', round: r + 1, responses: critiques })
      }

      // Final synthesis
      const allResponses = rounds.flatMap(r => r.responses)
      const synthesisPrompt = buildConsensusPrompt(message, allResponses)
      const finalAnswer = await sendFn(synthesisPrompt,
        'You are a judge. After reviewing a debate between experts, provide the definitive answer combining the strongest arguments from both sides.',
        { id: 'judge', name: 'Judge Agent' }
      )

      logger.info(`[MultiAgent] debate: ${rounds.length} rounds completed`)
      lastExecution.value = { mode: 'debate', rounds, finalAnswer, timestamp: Date.now() }

      return { rounds, finalAnswer }
    } finally {
      isRunning.value = false
    }
  }

  /**
   * Execute in delegate mode — primary agent decides which specialist to call
   * @param {string} message
   * @param {Object} primaryAgent
   * @param {Array} specialists
   * @param {Function} sendFn
   */
  async function executeDelegate(message, primaryAgent, specialists, sendFn) {
    isRunning.value = true

    try {
      // Ask primary agent to classify and route
      const specialistList = specialists.map(a => `- ${a.name}: ${a.description || a.category}`).join('\n')
      const routingPrompt = `User message: "${message}"\n\nAvailable specialists:\n${specialistList}\n\nWhich specialist should handle this? Reply with ONLY the specialist name.`

      const decision = await sendFn(routingPrompt, primaryAgent.systemPrompt, {
        id: primaryAgent.id, name: primaryAgent.name
      })

      // Find the chosen specialist
      const chosen = specialists.find(a =>
        decision.toLowerCase().includes(a.name.toLowerCase())
      ) || specialists[0]

      // Execute with chosen specialist
      const response = await sendFn(message, chosen.systemPrompt, {
        id: chosen.id, name: chosen.name
      })

      logger.info(`[MultiAgent] delegate: routed to ${chosen.name}`)
      lastExecution.value = {
        mode: 'delegate',
        decision,
        chosenAgent: chosen,
        response,
        timestamp: Date.now()
      }

      return { decision, chosenAgent: chosen, response }
    } finally {
      isRunning.value = false
    }
  }

  return {
    config,
    lastExecution,
    isRunning,
    enable,
    disable,
    setAgents,
    executeBestOfN,
    executeConsensus,
    executeDebate,
    executeDelegate
  }
}

// --- Helper functions ---

function scoreResponse(response, originalMessage) {
  if (!response) return 0
  let score = 0
  // Length (not too short, not too long)
  const len = response.length
  if (len > 50) score += 2
  if (len > 200) score += 2
  if (len > 1000) score += 1
  if (len > 5000) score -= 1 // penalize overly verbose
  // Contains code blocks (technical detail)
  if (response.includes('```')) score += 2
  // Contains lists/structure
  if (response.includes('\n- ') || response.includes('\n1.')) score += 1
  // References the question keywords
  const keywords = originalMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  for (const kw of keywords) {
    if (response.toLowerCase().includes(kw)) score += 0.5
  }
  return Math.round(score * 10) / 10
}

function buildConsensusPrompt(originalMessage, responses) {
  const parts = responses.map((r, i) =>
    `Expert ${i + 1} (${r.agent.name}):\n${r.response}`
  ).join('\n\n---\n\n')

  return `Original question: "${originalMessage}"\n\nHere are responses from ${responses.length} experts:\n\n${parts}\n\nPlease synthesize these into one comprehensive answer.`
}
