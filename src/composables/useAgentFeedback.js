/**
 * useAgentFeedback.js — Agent Feedback & Auto-Improvement (Agentic Context Engine pattern)
 *
 * Features:
 *   - Thumbs up/down per agent response
 *   - Track success rate per agent
 *   - Auto-rank agents based on feedback (better agents appear first)
 *   - Context learning: track which topics/keywords each agent handles best
 *   - Generate improved system prompts from feedback patterns
 *
 * Stored in localStorage. Integrated into useAgentSelector sorting.
 */

import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'

const FEEDBACK_KEY = 'agentFeedback'
const CONTEXT_KEY = 'agentContextLearning'

// { agentId: { thumbsUp: N, thumbsDown: N, total: N, responses: [{messagePreview, feedback, timestamp}] } }
const feedbackData = ref({})
// { agentId: { topics: { keyword: { success: N, fail: N } } } }
const contextData = ref({})
let loaded = false

function load() {
  if (loaded) return
  try {
    const fb = localStorage.getItem(FEEDBACK_KEY)
    feedbackData.value = fb ? JSON.parse(fb) : {}
    const ctx = localStorage.getItem(CONTEXT_KEY)
    contextData.value = ctx ? JSON.parse(ctx) : {}
  } catch {
    feedbackData.value = {}
    contextData.value = {}
  }
  loaded = true
}

function save() {
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbackData.value))
    localStorage.setItem(CONTEXT_KEY, JSON.stringify(contextData.value))
  } catch { /* ignore */ }
}

export function useAgentFeedback() {
  load()

  /**
   * Record feedback for an agent response
   * @param {string} agentId
   * @param {'up'|'down'} feedback
   * @param {string} userMessage - the original user message (for context learning)
   * @param {string} agentResponse - preview of agent response
   */
  function recordFeedback(agentId, feedback, userMessage = '', agentResponse = '') {
    if (!feedbackData.value[agentId]) {
      feedbackData.value[agentId] = { thumbsUp: 0, thumbsDown: 0, total: 0, responses: [] }
    }

    const data = feedbackData.value[agentId]
    if (feedback === 'up') data.thumbsUp++
    else data.thumbsDown++
    data.total++

    // Keep last 20 feedback entries per agent
    data.responses.push({
      messagePreview: userMessage.substring(0, 100),
      responsePreview: agentResponse.substring(0, 100),
      feedback,
      timestamp: Date.now()
    })
    if (data.responses.length > 20) {
      data.responses = data.responses.slice(-20)
    }

    // Context learning: extract keywords from message
    if (userMessage) {
      learnContext(agentId, userMessage, feedback === 'up')
    }

    save()
    logger.info(`[AgentFeedback] ${agentId}: ${feedback} (${data.thumbsUp}/${data.total})`)
  }

  /**
   * Get success rate for an agent (0-1)
   */
  function getSuccessRate(agentId) {
    const data = feedbackData.value[agentId]
    if (!data || data.total === 0) return null
    return {
      rate: data.thumbsUp / data.total,
      thumbsUp: data.thumbsUp,
      thumbsDown: data.thumbsDown,
      total: data.total
    }
  }

  /**
   * Get agent quality score (for sorting)
   * Combines success rate with sample size (Wilson score interval lower bound)
   */
  function getQualityScore(agentId) {
    const data = feedbackData.value[agentId]
    if (!data || data.total === 0) return 0.5 // neutral for unrated

    // Wilson score lower bound (95% confidence)
    const n = data.total
    const p = data.thumbsUp / n
    const z = 1.96 // 95% confidence
    const denominator = 1 + z * z / n
    const center = p + z * z / (2 * n)
    const spread = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)

    return (center - spread) / denominator
  }

  /**
   * Rank agents by feedback quality
   * @param {Array} agents
   * @returns {Array} sorted agents with qualityScore
   */
  function rankAgentsByFeedback(agents) {
    return agents.map(a => ({
      ...a,
      qualityScore: getQualityScore(a.id),
      successRate: getSuccessRate(a.id)
    })).sort((a, b) => b.qualityScore - a.qualityScore)
  }

  /**
   * Context learning: track which keywords/topics an agent handles well
   */
  function learnContext(agentId, message, isSuccess) {
    if (!contextData.value[agentId]) {
      contextData.value[agentId] = { topics: {} }
    }

    const keywords = extractKeywords(message)
    for (const kw of keywords) {
      if (!contextData.value[agentId].topics[kw]) {
        contextData.value[agentId].topics[kw] = { success: 0, fail: 0 }
      }
      if (isSuccess) {
        contextData.value[agentId].topics[kw].success++
      } else {
        contextData.value[agentId].topics[kw].fail++
      }
    }
    // Prune: keep only top 50 keywords per agent
    const topics = contextData.value[agentId].topics
    const entries = Object.entries(topics)
    if (entries.length > 50) {
      entries.sort((a, b) => (b[1].success + b[1].fail) - (a[1].success + a[1].fail))
      contextData.value[agentId].topics = Object.fromEntries(entries.slice(0, 50))
    }

    save()
  }

  /**
   * Get best agent for a given message based on learned context
   * @param {string} message
   * @param {Array} agents
   * @returns {Array<{agent, contextScore}>} top matches
   */
  function getBestAgentForMessage(message, agents) {
    const keywords = extractKeywords(message)
    if (keywords.length === 0) return []

    const scored = agents.map(agent => {
      const ctx = contextData.value[agent.id]
      if (!ctx) return { agent, contextScore: 0 }

      let score = 0
      for (const kw of keywords) {
        const topic = ctx.topics[kw]
        if (topic) {
          const total = topic.success + topic.fail
          if (total > 0) {
            score += (topic.success / total) * Math.min(total, 5) // weight by sample size, cap at 5
          }
        }
      }
      return { agent, contextScore: Math.round(score * 100) / 100 }
    })

    return scored
      .filter(s => s.contextScore > 0)
      .sort((a, b) => b.contextScore - a.contextScore)
      .slice(0, 5)
  }

  /**
   * Generate improvement hints for an agent based on feedback
   */
  function getImprovementHints(agentId) {
    const data = feedbackData.value[agentId]
    const ctx = contextData.value[agentId]
    const hints = []

    if (data) {
      if (data.total >= 5 && data.thumbsUp / data.total < 0.5) {
        hints.push('Low satisfaction rate. Consider adjusting the system prompt.')
      }
      // Find common patterns in failed responses
      const failedMessages = data.responses
        .filter(r => r.feedback === 'down')
        .map(r => r.messagePreview)
      if (failedMessages.length >= 3) {
        hints.push(`Agent struggles with messages like: "${failedMessages[0]}"`)
      }
    }

    if (ctx) {
      const weakTopics = Object.entries(ctx.topics)
        .filter(([, v]) => v.fail > v.success && (v.success + v.fail) >= 2)
        .map(([kw]) => kw)
      if (weakTopics.length > 0) {
        hints.push(`Weak areas: ${weakTopics.slice(0, 5).join(', ')}`)
      }

      const strongTopics = Object.entries(ctx.topics)
        .filter(([, v]) => v.success > v.fail && v.success >= 2)
        .map(([kw]) => kw)
      if (strongTopics.length > 0) {
        hints.push(`Strong areas: ${strongTopics.slice(0, 5).join(', ')}`)
      }
    }

    return hints
  }

  /**
   * Get overall feedback stats
   */
  function getOverallStats() {
    const agents = Object.keys(feedbackData.value)
    let totalUp = 0, totalDown = 0
    for (const data of Object.values(feedbackData.value)) {
      totalUp += data.thumbsUp
      totalDown += data.thumbsDown
    }
    return {
      agentsRated: agents.length,
      totalFeedback: totalUp + totalDown,
      overallSatisfaction: (totalUp + totalDown) > 0
        ? Math.round(totalUp / (totalUp + totalDown) * 100)
        : null
    }
  }

  /**
   * Reset feedback for an agent
   */
  function resetFeedback(agentId) {
    delete feedbackData.value[agentId]
    delete contextData.value[agentId]
    save()
  }

  return {
    feedbackData,
    contextData,
    recordFeedback,
    getSuccessRate,
    getQualityScore,
    rankAgentsByFeedback,
    getBestAgentForMessage,
    getImprovementHints,
    getOverallStats,
    resetFeedback
  }
}

// --- Helpers ---

function extractKeywords(message) {
  if (!message) return []
  // Extract meaningful words (3+ chars, not common stop words)
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'has', 'have', 'with', 'this', 'that',
    'from', 'they', 'been', 'will', 'each', 'make', 'like', 'just', 'than',
    'them', 'into', 'some', 'could', 'other', 'then', 'what', 'about', 'which',
    'when', 'their', 'there', 'would', 'your', 'how', 'its', 'more',
    'что', 'как', 'это', 'для', 'при', 'все', 'его', 'мне', 'мой',
    'она', 'они', 'нет', 'вот', 'был', 'еще', 'уже', 'так', 'или'
  ])

  return message
    .toLowerCase()
    .replace(/[^\w\sа-яё]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))
    .slice(0, 10) // max 10 keywords per message
}
