/**
 * Agent Trial Store
 * Manages trial periods, demo modes, and user access to agents
 * Issue #4986: Demo режим и trial period для агентов
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAgentTrialStore = defineStore('agentTrial', () => {
  // State: Active trials (agentId -> trial data)
  const activeTrials = ref({})

  // State: Demo mode access (agentId -> demo data)
  const demoAccess = ref({})

  // State: Purchased agents (agentId -> purchase data)
  const purchasedAgents = ref({})

  // Constants
  const TRIAL_DURATION_DAYS = 7
  const DEMO_DAILY_LIMIT = 10

  /**
   * Check if agent has active trial
   */
  const hasActiveTrial = computed(() => (agentId) => {
    const trial = activeTrials.value[agentId]
    if (!trial) return false

    const now = new Date()
    const expiryDate = new Date(trial.expiryDate)
    return now < expiryDate
  })

  /**
   * Check if agent is purchased
   */
  const isPurchased = computed(() => (agentId) => {
    return !!purchasedAgents.value[agentId]
  })

  /**
   * Check if agent has demo access
   */
  const hasDemoAccess = computed(() => (agentId) => {
    const demo = demoAccess.value[agentId]
    if (!demo) return false

    // Check if daily limit reached
    const today = new Date().toDateString()
    if (demo.lastUsed !== today) {
      // Reset daily counter
      demo.usageToday = 0
      demo.lastUsed = today
    }

    return demo.usageToday < DEMO_DAILY_LIMIT
  })

  /**
   * Get trial info for agent
   */
  const getTrialInfo = computed(() => (agentId) => {
    const trial = activeTrials.value[agentId]
    if (!trial) return null

    const now = new Date()
    const expiryDate = new Date(trial.expiryDate)
    const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))

    return {
      ...trial,
      daysLeft,
      isActive: daysLeft > 0
    }
  })

  /**
   * Get demo info for agent
   */
  const getDemoInfo = computed(() => (agentId) => {
    const demo = demoAccess.value[agentId]
    if (!demo) return null

    const today = new Date().toDateString()
    if (demo.lastUsed !== today) {
      demo.usageToday = 0
      demo.lastUsed = today
    }

    return {
      ...demo,
      usageLeft: DEMO_DAILY_LIMIT - demo.usageToday,
      dailyLimit: DEMO_DAILY_LIMIT
    }
  })

  /**
   * Get agent access type: 'purchased', 'trial', 'demo', or null
   */
  const getAccessType = computed(() => (agentId) => {
    if (isPurchased.value(agentId)) return 'purchased'
    if (hasActiveTrial.value(agentId)) return 'trial'
    if (hasDemoAccess.value(agentId)) return 'demo'
    return null
  })

  /**
   * Activate trial for agent
   */
  function activateTrial(agentId, agentName) {
    const startDate = new Date()
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + TRIAL_DURATION_DAYS)

    activeTrials.value[agentId] = {
      agentId,
      agentName,
      startDate: startDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      activated: startDate.toISOString()
    }

    // Save to localStorage
    saveToLocalStorage()

    return activeTrials.value[agentId]
  }

  /**
   * Activate demo mode for agent
   */
  function activateDemo(agentId, agentName) {
    const today = new Date().toDateString()

    demoAccess.value[agentId] = {
      agentId,
      agentName,
      activated: new Date().toISOString(),
      usageToday: 0,
      lastUsed: today
    }

    // Save to localStorage
    saveToLocalStorage()

    return demoAccess.value[agentId]
  }

  /**
   * Record demo usage (increment counter)
   */
  function recordDemoUsage(agentId) {
    const demo = demoAccess.value[agentId]
    if (!demo) return false

    const today = new Date().toDateString()
    if (demo.lastUsed !== today) {
      demo.usageToday = 0
      demo.lastUsed = today
    }

    if (demo.usageToday >= DEMO_DAILY_LIMIT) {
      return false // Limit reached
    }

    demo.usageToday++
    saveToLocalStorage()

    return true
  }

  /**
   * Mark agent as purchased
   */
  function markAsPurchased(agentId, agentName, purchaseData) {
    purchasedAgents.value[agentId] = {
      agentId,
      agentName,
      purchasedAt: new Date().toISOString(),
      ...purchaseData
    }

    // Remove trial and demo if exists
    delete activeTrials.value[agentId]
    delete demoAccess.value[agentId]

    saveToLocalStorage()

    return purchasedAgents.value[agentId]
  }

  /**
   * Cancel trial (convert to purchase or remove)
   */
  function cancelTrial(agentId) {
    delete activeTrials.value[agentId]
    saveToLocalStorage()
  }

  /**
   * Save state to localStorage
   */
  function saveToLocalStorage() {
    try {
      localStorage.setItem('agentTrials', JSON.stringify(activeTrials.value))
      localStorage.setItem('agentDemos', JSON.stringify(demoAccess.value))
      localStorage.setItem('purchasedAgents', JSON.stringify(purchasedAgents.value))
    } catch (error) {
      console.error('Failed to save trial data to localStorage:', error)
    }
  }

  /**
   * Load state from localStorage
   */
  function loadFromLocalStorage() {
    try {
      const trials = localStorage.getItem('agentTrials')
      const demos = localStorage.getItem('agentDemos')
      const purchased = localStorage.getItem('purchasedAgents')

      if (trials) activeTrials.value = JSON.parse(trials)
      if (demos) demoAccess.value = JSON.parse(demos)
      if (purchased) purchasedAgents.value = JSON.parse(purchased)
    } catch (error) {
      console.error('Failed to load trial data from localStorage:', error)
    }
  }

  /**
   * Clear expired trials
   */
  function clearExpiredTrials() {
    const now = new Date()

    Object.keys(activeTrials.value).forEach(agentId => {
      const trial = activeTrials.value[agentId]
      const expiryDate = new Date(trial.expiryDate)

      if (now >= expiryDate) {
        delete activeTrials.value[agentId]
      }
    })

    saveToLocalStorage()
  }

  /**
   * Get all active trials
   */
  const getAllActiveTrials = computed(() => {
    return Object.values(activeTrials.value).filter(trial => {
      const now = new Date()
      const expiryDate = new Date(trial.expiryDate)
      return now < expiryDate
    })
  })

  /**
   * Get all demo access
   */
  const getAllDemoAccess = computed(() => {
    return Object.values(demoAccess.value)
  })

  /**
   * Get all purchased agents
   */
  const getAllPurchased = computed(() => {
    return Object.values(purchasedAgents.value)
  })

  // Initialize store
  loadFromLocalStorage()
  clearExpiredTrials()

  return {
    // State
    activeTrials,
    demoAccess,
    purchasedAgents,

    // Constants
    TRIAL_DURATION_DAYS,
    DEMO_DAILY_LIMIT,

    // Computed
    hasActiveTrial,
    isPurchased,
    hasDemoAccess,
    getTrialInfo,
    getDemoInfo,
    getAccessType,
    getAllActiveTrials,
    getAllDemoAccess,
    getAllPurchased,

    // Actions
    activateTrial,
    activateDemo,
    recordDemoUsage,
    markAsPurchased,
    cancelTrial,
    clearExpiredTrials,
    saveToLocalStorage,
    loadFromLocalStorage
  }
})
