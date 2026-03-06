/**
 * Sales Agent Store
 * Manages state for sales agent operations
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { salesAgentService } from '@/services/salesAgentService'

export const useSalesAgentStore = defineStore('salesAgent', () => {
  // State
  const leads = ref([])
  const funnels = ref([])
  const journeys = ref([])
  const statistics = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Computed
  const hotLeads = computed(() => leads.value.filter(l => l.category === 'hot'))
  const warmLeads = computed(() => leads.value.filter(l => l.category === 'warm'))
  const coldLeads = computed(() => leads.value.filter(l => l.category === 'cold'))

  const totalLeads = computed(() => leads.value.length)
  const averageScore = computed(() => {
    if (leads.value.length === 0) return 0
    const total = leads.value.reduce((sum, lead) => sum + (lead.score || 0), 0)
    return Math.round((total / leads.value.length) * 100) / 100
  })

  // Actions
  async function generateLeads(messages, groupInfo, filters = {}) {
    loading.value = true
    error.value = null

    try {
      const result = await salesAgentService.generateLeads({
        messages,
        groupInfo,
        filters
      })

      if (result.success) {
        // Add new leads to the store
        const newLeads = result.leads || []
        newLeads.forEach(lead => {
          const existingIndex = leads.value.findIndex(l => l.id === lead.id)
          if (existingIndex >= 0) {
            leads.value[existingIndex] = lead
          } else {
            leads.value.push(lead)
          }
        })

        return result
      } else {
        throw new Error(result.error || 'Failed to generate leads')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function scoreLeads(leadIds, criteria) {
    loading.value = true
    error.value = null

    try {
      const result = await salesAgentService.scoreLeads({
        leadIds,
        criteria
      })

      if (result.success) {
        // Update leads with new scores
        const scoredLeads = result.scoredLeads || []
        scoredLeads.forEach(scoredLead => {
          const lead = leads.value.find(l => l.id === scoredLead.id)
          if (lead) {
            lead.score = scoredLead.score
            lead.category = scoredLead.category
          }
        })

        return result
      } else {
        throw new Error(result.error || 'Failed to score leads')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createFunnel(name, leadIds, targetProduct = 'DronDoc Platform') {
    loading.value = true
    error.value = null

    try {
      const result = await salesAgentService.createFunnel({
        name,
        leadIds,
        targetProduct
      })

      if (result.success) {
        // Add funnel to the store
        const funnel = result.funnel
        funnels.value.push(funnel)

        return result
      } else {
        throw new Error(result.error || 'Failed to create funnel')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function generateCommunicationJourney(leadId, funnelId, targetProduct = 'DronDoc Platform') {
    loading.value = true
    error.value = null

    try {
      const result = await salesAgentService.generateCommunicationJourney({
        leadId,
        funnelId,
        targetProduct
      })

      if (result.success) {
        // Add journey to the store
        const journey = result.journey
        journeys.value.push(journey)

        return result
      } else {
        throw new Error(result.error || 'Failed to generate communication journey')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function sendOutreach(journeyId, stepIndex) {
    loading.value = true
    error.value = null

    try {
      const result = await salesAgentService.sendOutreach({
        journeyId,
        stepIndex
      })

      if (result.success) {
        // Update journey in the store
        const journey = journeys.value.find(j => j.id === journeyId)
        if (journey) {
          journey.currentStep = stepIndex + 1
        }

        return result
      } else {
        throw new Error(result.error || 'Failed to send outreach')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateLeadStage(leadId, funnelId, newStage) {
    loading.value = true
    error.value = null

    try {
      const result = await salesAgentService.updateLeadStage({
        leadId,
        funnelId,
        newStage
      })

      if (result.success) {
        // Update lead in the store
        const lead = leads.value.find(l => l.id === leadId)
        if (lead) {
          lead.stage = newStage
        }

        return result
      } else {
        throw new Error(result.error || 'Failed to update lead stage')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function analyzeCampaign(funnelId) {
    loading.value = true
    error.value = null

    try {
      const result = await salesAgentService.analyzeCampaign({
        funnelId
      })

      if (result.success) {
        return result.analysis
      } else {
        throw new Error(result.error || 'Failed to analyze campaign')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchStatistics() {
    loading.value = true
    error.value = null

    try {
      const result = await salesAgentService.getStatistics()

      if (result.success) {
        statistics.value = result.statistics
        return result.statistics
      } else {
        throw new Error(result.error || 'Failed to get statistics')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  function reset() {
    leads.value = []
    funnels.value = []
    journeys.value = []
    statistics.value = null
    error.value = null
    loading.value = false
  }

  return {
    // State
    leads,
    funnels,
    journeys,
    statistics,
    loading,
    error,

    // Computed
    hotLeads,
    warmLeads,
    coldLeads,
    totalLeads,
    averageScore,

    // Actions
    generateLeads,
    scoreLeads,
    createFunnel,
    generateCommunicationJourney,
    sendOutreach,
    updateLeadStage,
    analyzeCampaign,
    fetchStatistics,
    clearError,
    reset
  }
})

export default useSalesAgentStore
