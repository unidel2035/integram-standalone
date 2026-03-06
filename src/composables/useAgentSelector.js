/**
 * useAgentSelector.js — Reusable composable for AI agent selection
 *
 * Loads agents from /api/drondoc-agents, auto-generates systemPrompt
 * when missing, persists selection to localStorage, supports categories & search.
 *
 * Used by: Chat.vue, ChatPage.vue, AIChatTab.vue, WorkspaceAIChat.vue
 */

import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { logger } from '@/utils/logger'

const API_URL = import.meta.env.VITE_API_URL || ''
const STORAGE_KEY = 'selectedChatAgent'
const AGENTS_CACHE_KEY = 'cachedAgents'
const AGENTS_CACHE_TTL = 5 * 60 * 1000 // 5 min

const RECENT_KEY = 'recentAgents'
const USAGE_KEY = 'agentUsageStats'

// Shared state across all instances (singleton pattern)
const sharedAgents = ref([])
const sharedLoading = ref(false)
const sharedLoaded = ref(false)
let loadPromise = null

/**
 * Generate a system prompt from agent metadata when none is provided
 */
function generateSystemPrompt(agent) {
  const name = agent.name || 'AI Agent'
  const desc = agent.description || ''
  const category = agent.category || ''
  const triggers = parseTriggers(agent.triggers)

  let prompt = `You are "${name}"`
  if (category && category !== 'other') {
    prompt += `, a specialized ${category} agent`
  }
  prompt += '.'

  if (desc) {
    prompt += ` ${desc}`
    if (!desc.endsWith('.')) prompt += '.'
  }

  if (triggers.length > 0) {
    prompt += ` Your areas of expertise: ${triggers.join(', ')}.`
  }

  prompt += ' Respond helpfully and stay within your area of specialization when possible.'
  return prompt
}

function parseTriggers(triggers) {
  if (!triggers) return []
  if (Array.isArray(triggers)) return triggers
  try {
    const parsed = JSON.parse(triggers)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseCapabilities(capabilities) {
  if (!capabilities) return []
  if (Array.isArray(capabilities)) return capabilities
  try {
    const parsed = JSON.parse(capabilities)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Enrich agent with auto-generated systemPrompt and parsed fields
 */
function enrichAgent(agent) {
  return {
    ...agent,
    systemPrompt: agent.systemPrompt || generateSystemPrompt(agent),
    hasCustomPrompt: !!agent.systemPrompt,
    triggers: parseTriggers(agent.triggers),
    capabilities: parseCapabilities(agent.capabilities),
    icon: agent.icon || getCategoryIcon(agent.category)
  }
}

function getCategoryIcon(category) {
  const icons = {
    ai: '🤖', analytics: '📊', automation: '⚙️', business: '💼',
    development: '💻', devops: '🔧', data: '📈', text: '📝',
    content: '✍️', marketing: '📢', sales: '💰', hr: '👥',
    finance: '💳', security: '🔒', testing: '🧪', support: '🎧',
    communication: '💬', media: '🎬', ecommerce: '🛒', it: '🖥️',
    monitoring: '📡', compliance: '📋', utility: '🔨'
  }
  return icons[category] || '🤖'
}

/**
 * Load agents from API with caching
 */
async function fetchAgents() {
  // Check localStorage cache
  try {
    const cached = localStorage.getItem(AGENTS_CACHE_KEY)
    if (cached) {
      const { agents, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < AGENTS_CACHE_TTL && agents.length > 0) {
        return agents.map(enrichAgent)
      }
    }
  } catch { /* ignore cache errors */ }

  const response = await axios.get(`${API_URL}/drondoc-agents`)
  const raw = response.data.agents || []

  // Cache
  try {
    localStorage.setItem(AGENTS_CACHE_KEY, JSON.stringify({
      agents: raw,
      timestamp: Date.now()
    }))
  } catch { /* storage full — ignore */ }

  return raw.map(enrichAgent)
}

/**
 * Main composable
 */
export function useAgentSelector() {
  const selectedAgent = ref(null)
  const searchQuery = ref('')
  const selectedCategory = ref('all')
  const error = ref(null)

  // Categories extracted from loaded agents + static ones
  const categories = computed(() => {
    const cats = new Set()
    for (const agent of sharedAgents.value) {
      if (agent.category) cats.add(agent.category)
    }
    const sorted = [...cats].sort()
    return [
      { label: 'All', value: 'all', icon: '🌐' },
      ...sorted.map(c => ({
        label: c.charAt(0).toUpperCase() + c.slice(1),
        value: c,
        icon: getCategoryIcon(c)
      }))
    ]
  })

  // Filtered agents by category + search
  const filteredAgents = computed(() => {
    let result = sharedAgents.value

    if (selectedCategory.value !== 'all') {
      result = result.filter(a => a.category === selectedCategory.value)
    }

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(a =>
        a.name?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.triggers?.some(t => t.toLowerCase().includes(q))
      )
    }

    // Sort: agents with custom prompts first, then alphabetically
    return result.sort((a, b) => {
      if (a.hasCustomPrompt !== b.hasCustomPrompt) return a.hasCustomPrompt ? -1 : 1
      return (a.name || '').localeCompare(b.name || '')
    })
  })

  // Agent count by category
  const categoryCounts = computed(() => {
    const counts = { all: sharedAgents.value.length }
    for (const agent of sharedAgents.value) {
      const cat = agent.category || 'other'
      counts[cat] = (counts[cat] || 0) + 1
    }
    return counts
  })

  /**
   * Load agents (shared across all instances)
   */
  async function loadAgents(force = false) {
    if (sharedLoaded.value && !force) return
    if (loadPromise) return loadPromise

    sharedLoading.value = true
    error.value = null

    loadPromise = fetchAgents()
      .then(agents => {
        sharedAgents.value = agents
        sharedLoaded.value = true
        logger.info(`[useAgentSelector] Loaded ${agents.length} agents`)
      })
      .catch(err => {
        logger.error('[useAgentSelector] Failed to load agents:', err)
        error.value = err.message
        // Use fallback agents
        sharedAgents.value = getDefaultAgents().map(enrichAgent)
      })
      .finally(() => {
        sharedLoading.value = false
        loadPromise = null
      })

    return loadPromise
  }

  /**
   * Select an agent
   */
  // Recent agents (inspired by MemGPT/AgentGPT history pattern)
  const recentAgents = computed(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (!raw) return []
      const ids = JSON.parse(raw)
      return ids
        .map(id => sharedAgents.value.find(a => a.id === id))
        .filter(Boolean)
        .slice(0, 5)
    } catch { return [] }
  })

  // Usage stats (inspired by Arize-Phoenix observability pattern)
  const agentUsageStats = computed(() => {
    try {
      const raw = localStorage.getItem(USAGE_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })

  /**
   * Select an agent
   */
  function selectAgent(agent) {
    selectedAgent.value = agent
    if (agent) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          id: agent.id,
          name: agent.name,
          icon: agent.icon,
          category: agent.category,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          hasCustomPrompt: agent.hasCustomPrompt,
          triggers: agent.triggers
        }))
      } catch { /* ignore */ }
      // Track in recent agents
      trackRecent(agent.id)
      // Track usage
      trackUsage(agent.id)
      logger.info(`[useAgentSelector] Selected: ${agent.name} (${agent.id})`)
    } else {
      localStorage.removeItem(STORAGE_KEY)
      logger.info('[useAgentSelector] Cleared agent selection')
    }
  }

  function clearAgent() {
    selectAgent(null)
  }

  /**
   * Suggest agents based on message text (Swarm/orchestrator trigger-matching pattern)
   * Returns top-3 agents whose triggers match the input
   */
  function suggestAgents(message) {
    if (!message || message.length < 3) return []
    const q = message.toLowerCase()
    const scored = sharedAgents.value
      .map(agent => {
        let score = 0
        if (agent.triggers?.length) {
          for (const trigger of agent.triggers) {
            if (q.includes(trigger.toLowerCase())) score += 3
          }
        }
        if (agent.name && q.includes(agent.name.toLowerCase())) score += 2
        if (agent.category && q.includes(agent.category.toLowerCase())) score += 1
        return { agent, score }
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
    return scored.slice(0, 3).map(s => s.agent)
  }

  /**
   * Restore selection from localStorage
   */
  function restoreSelection() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Find full agent from loaded list or use saved data
        const full = sharedAgents.value.find(a => a.id === parsed.id)
        selectedAgent.value = full || enrichAgent(parsed)
      }
    } catch { /* ignore */ }
  }

  /**
   * Refresh agents from API (bypass cache)
   */
  async function refreshAgents() {
    localStorage.removeItem(AGENTS_CACHE_KEY)
    sharedLoaded.value = false
    await loadAgents(true)
    restoreSelection()
  }

  // Initialize on mount
  onMounted(async () => {
    await loadAgents()
    restoreSelection()
  })

  return {
    // State
    agents: sharedAgents,
    loading: sharedLoading,
    selectedAgent,
    searchQuery,
    selectedCategory,
    error,

    // Computed
    filteredAgents,
    categories,
    categoryCounts,
    recentAgents,
    agentUsageStats,

    // Actions
    selectAgent,
    clearAgent,
    loadAgents,
    refreshAgents,
    restoreSelection,
    suggestAgents
  }
}

function trackRecent(agentId) {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    let ids = raw ? JSON.parse(raw) : []
    ids = ids.filter(id => id !== agentId)
    ids.unshift(agentId)
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, 10)))
  } catch { /* ignore */ }
}

function trackUsage(agentId) {
  try {
    const raw = localStorage.getItem(USAGE_KEY)
    const stats = raw ? JSON.parse(raw) : {}
    if (!stats[agentId]) stats[agentId] = { count: 0, lastUsed: null }
    stats[agentId].count++
    stats[agentId].lastUsed = Date.now()
    localStorage.setItem(USAGE_KEY, JSON.stringify(stats))
  } catch { /* ignore */ }
}

function getDefaultAgents() {
  return [
    {
      id: 'default-assistant',
      name: 'Default Assistant',
      description: 'General-purpose AI assistant for any task',
      icon: '🤖',
      category: 'ai',
      status: 'active',
      systemPrompt: ''
    },
    {
      id: 'code-reviewer',
      name: 'Code Reviewer',
      description: 'Reviews code quality, finds bugs, suggests improvements',
      icon: '💻',
      category: 'development',
      status: 'active',
      systemPrompt: ''
    },
    {
      id: 'data-analyst',
      name: 'Data Analyst',
      description: 'Analyzes data, creates insights and visualizations',
      icon: '📊',
      category: 'analytics',
      status: 'active',
      systemPrompt: ''
    },
    {
      id: 'content-writer',
      name: 'Content Writer',
      description: 'Creates marketing copy, articles, and content',
      icon: '✍️',
      category: 'content',
      status: 'active',
      systemPrompt: ''
    },
    {
      id: 'task-automator',
      name: 'Task Automator',
      description: 'Automates repetitive workflows and processes',
      icon: '⚙️',
      category: 'automation',
      status: 'active',
      systemPrompt: ''
    }
  ]
}

export { generateSystemPrompt, enrichAgent, getCategoryIcon }
