import { logger } from '@/utils/logger'
/**
 * Orthodox Knowledge Graph Agent Store
 *
 * State management for the Orthodox Knowledge Graph Agent
 * that collects and organizes knowledge about Holy Fathers and God's will
 *
 * Issue #1281
 * Issue #1484 - Redesigned to use orchestrator pattern (server-side token management)
 */

import { reactive, computed } from 'vue'

const state = reactive({
  // Agent state
  isRunning: false,
  isPaused: false,
  progress: 0,
  currentUrl: '',
  status: 'idle', // idle, crawling, analyzing, paused, completed, error

  // Knowledge graph data
  nodes: [], // { id, type, title, url, content, metadata }
  edges: [], // { source, target, relationship }
  visitedUrls: new Set(),
  queuedUrls: [],
  errorUrls: [],

  // Search configuration
  seedUrls: [
    'https://azbyka.ru',
    'https://pravoslavie.ru',
    'https://predanie.ru',
    'https://azbyka.ru/otechnik/',
  ],
  searchKeywords: [
    'воля божья',
    'воля божия',
    'святые отцы',
    'святоотеческое учение',
    'промысл божий',
  ],
  maxDepth: 3,
  maxPages: 100,

  // AI model preferences (stored locally, but API keys managed server-side)
  selectedModelId: null,
  selectedModel: null,
})

export const useOrthodoxKnowledgeStore = () => {
  // Statistics
  const stats = computed(() => ({
    totalNodes: state.nodes.length,
    totalEdges: state.edges.length,
    visitedPages: state.visitedUrls.size,
    queuedPages: state.queuedUrls.length,
    errorPages: state.errorUrls.length,
    progress: state.progress,
    holyFathers: state.nodes.filter(n => n.type === 'holy_father').length,
    texts: state.nodes.filter(n => n.type === 'text').length,
    topics: state.nodes.filter(n => n.type === 'topic').length,
  }))

  // Actions
  function addNode(node) {
    // Check if node already exists
    const existingIndex = state.nodes.findIndex(n => n.id === node.id)
    if (existingIndex >= 0) {
      // Update existing node
      state.nodes[existingIndex] = { ...state.nodes[existingIndex], ...node }
    } else {
      // Add new node
      state.nodes.push({
        id: node.id || `node_${Date.now()}_${Math.random()}`,
        type: node.type || 'text',
        title: node.title || 'Untitled',
        url: node.url || '',
        content: node.content || '',
        excerpt: node.excerpt || '',
        metadata: node.metadata || {},
        createdAt: new Date().toISOString(),
        ...node
      })
    }
    // Save to localStorage
    saveToLocalStorage()
  }

  function addEdge(edge) {
    // Check if edge already exists
    const exists = state.edges.some(
      e => e.source === edge.source && e.target === edge.target && e.relationship === edge.relationship
    )
    if (!exists) {
      state.edges.push({
        source: edge.source,
        target: edge.target,
        relationship: edge.relationship || 'related_to',
        weight: edge.weight || 1,
        metadata: edge.metadata || {},
        createdAt: new Date().toISOString()
      })
      saveToLocalStorage()
    }
  }

  function addToQueue(url, depth = 0) {
    if (!state.visitedUrls.has(url) && !state.queuedUrls.find(item => item.url === url)) {
      state.queuedUrls.push({ url, depth })
      saveToLocalStorage()
    }
  }

  function markAsVisited(url) {
    state.visitedUrls.add(url)
    state.queuedUrls = state.queuedUrls.filter(item => item.url !== url)
    saveToLocalStorage()
  }

  function addError(url, error) {
    state.errorUrls.push({
      url,
      error: error.message || String(error),
      timestamp: new Date().toISOString()
    })
    saveToLocalStorage()
  }

  function updateProgress(value) {
    state.progress = Math.min(100, Math.max(0, value))
  }

  function setStatus(newStatus) {
    state.status = newStatus
  }

  function setCurrentUrl(url) {
    state.currentUrl = url
  }

  function startAgent() {
    state.isRunning = true
    state.isPaused = false
    setStatus('crawling')
  }

  function pauseAgent() {
    state.isPaused = true
    setStatus('paused')
  }

  function resumeAgent() {
    state.isPaused = false
    setStatus('crawling')
  }

  function stopAgent() {
    state.isRunning = false
    state.isPaused = false
    setStatus('idle')
  }

  function completeAgent() {
    state.isRunning = false
    state.isPaused = false
    setStatus('completed')
    state.progress = 100
  }

  // Model preference management (following YouTube Analytics pattern)
  function setSelectedModel(modelId, model) {
    state.selectedModelId = modelId
    state.selectedModel = model

    // Save to localStorage
    try {
      localStorage.setItem('orthodox_agent_model_id', modelId)
      if (model) {
        localStorage.setItem('orthodox_agent_model', JSON.stringify(model))
      }
      logger.debug('AI model preference saved:', modelId)
    } catch (error) {
      console.error('Failed to save model preference:', error)
    }
  }

  function getSelectedModelId() {
    if (!state.selectedModelId) {
      try {
        const savedModelId = localStorage.getItem('orthodox_agent_model_id')
        if (savedModelId) {
          state.selectedModelId = savedModelId
          const savedModel = localStorage.getItem('orthodox_agent_model')
          if (savedModel) {
            state.selectedModel = JSON.parse(savedModel)
          }
        }
      } catch (error) {
        console.error('Failed to load model preference:', error)
      }
    }
    return state.selectedModelId
  }

  function clearModelPreference() {
    state.selectedModelId = null
    state.selectedModel = null
    try {
      localStorage.removeItem('orthodox_agent_model_id')
      localStorage.removeItem('orthodox_agent_model')
    } catch (error) {
      console.error('Failed to clear model preference:', error)
    }
  }

  function reset() {
    state.nodes = []
    state.edges = []
    state.visitedUrls = new Set()
    state.queuedUrls = []
    state.errorUrls = []
    state.progress = 0
    state.currentUrl = ''
    state.status = 'idle'
    state.isRunning = false
    state.isPaused = false
    saveToLocalStorage()
  }

  function clearGraph() {
    state.nodes = []
    state.edges = []
    state.visitedUrls = new Set()
    saveToLocalStorage()
  }

  // Persistence
  function saveToLocalStorage() {
    try {
      const data = {
        nodes: state.nodes,
        edges: state.edges,
        visitedUrls: Array.from(state.visitedUrls),
        queuedUrls: state.queuedUrls,
        errorUrls: state.errorUrls,
        progress: state.progress,
        status: state.status,
        savedAt: new Date().toISOString()
      }
      localStorage.setItem('orthodox_knowledge_graph', JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }
  }

  function loadFromLocalStorage() {
    try {
      const data = localStorage.getItem('orthodox_knowledge_graph')
      if (data) {
        const parsed = JSON.parse(data)
        state.nodes = parsed.nodes || []
        state.edges = parsed.edges || []
        state.visitedUrls = new Set(parsed.visitedUrls || [])
        state.queuedUrls = parsed.queuedUrls || []
        state.errorUrls = parsed.errorUrls || []
        state.progress = parsed.progress || 0
        state.status = parsed.status || 'idle'
        return true
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
    }
    return false
  }

  function exportData() {
    return {
      nodes: state.nodes,
      edges: state.edges,
      stats: stats.value,
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        source: 'Orthodox Knowledge Graph Agent'
      }
    }
  }

  function importData(data) {
    if (data.nodes) state.nodes = data.nodes
    if (data.edges) state.edges = data.edges
    saveToLocalStorage()
  }

  // Initialize from localStorage on creation
  loadFromLocalStorage()

  return {
    // State
    isRunning: computed(() => state.isRunning),
    isPaused: computed(() => state.isPaused),
    progress: computed(() => state.progress),
    currentUrl: computed(() => state.currentUrl),
    status: computed(() => state.status),
    nodes: computed(() => state.nodes),
    edges: computed(() => state.edges),
    visitedUrls: computed(() => state.visitedUrls),
    queuedUrls: computed(() => state.queuedUrls),
    errorUrls: computed(() => state.errorUrls),
    // Make these writable for v-model binding
    seedUrls: computed({
      get: () => state.seedUrls,
      set: (value) => { state.seedUrls = value }
    }),
    searchKeywords: computed({
      get: () => state.searchKeywords,
      set: (value) => { state.searchKeywords = value }
    }),
    maxDepth: computed({
      get: () => state.maxDepth,
      set: (value) => { state.maxDepth = value }
    }),
    maxPages: computed({
      get: () => state.maxPages,
      set: (value) => { state.maxPages = value }
    }),
    stats,

    // Model preferences
    selectedModelId: computed(() => state.selectedModelId),
    selectedModel: computed(() => state.selectedModel),

    // Actions
    addNode,
    addEdge,
    addToQueue,
    markAsVisited,
    addError,
    updateProgress,
    setStatus,
    setCurrentUrl,
    startAgent,
    pauseAgent,
    resumeAgent,
    stopAgent,
    completeAgent,
    reset,
    clearGraph,
    saveToLocalStorage,
    loadFromLocalStorage,
    exportData,
    importData,

    // Model management actions
    setSelectedModel,
    getSelectedModelId,
    clearModelPreference
  }
}
