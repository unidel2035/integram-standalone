/**
 * useFstData.js — Composable for loading FST data from Integram
 *
 * Issue #83: Remove hardcoded data from FstHub and FstCommittee
 *
 * Provides reactive data loading with:
 * - Automatic caching
 * - Loading states
 * - Error handling
 * - Fallback to hardcoded data for demo mode
 */

import { ref, computed } from 'vue'
import { getEnrichedProjects, getSubfunds, getSubfundsObject, getStats } from '@/services/fstExtendedApi.js'

// Import hardcoded fallbacks
import { PROJECTS_POOL, SUBFUNDS } from '@/components/fst-committee/FstCommitteeConfig.js'

// ── State ─────────────────────────────────────────────────────────

const projects = ref([])
const subfunds = ref({})
const stats = ref(null)

const projectsLoading = ref(false)
const subfundsLoading = ref(false)
const statsLoading = ref(false)

const projectsError = ref(null)
const subfundsError = ref(null)
const statsError = ref(null)

const useApiData = ref(true) // Toggle between API and hardcoded data

// Cache timestamps
let projectsCacheTime = 0
let subfundsCacheTime = 0
let statsCacheTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ── Composable ────────────────────────────────────────────────────

export function useFstData() {
  /**
   * Load enriched projects from API or fallback to hardcoded
   */
  async function loadProjects(force = false) {
    // Check cache
    if (!force && projects.value.length > 0 && Date.now() - projectsCacheTime < CACHE_TTL) {
      return projects.value
    }

    if (!useApiData.value) {
      // Use hardcoded data
      projects.value = PROJECTS_POOL
      return projects.value
    }

    projectsLoading.value = true
    projectsError.value = null

    try {
      const data = await getEnrichedProjects()
      projects.value = data.length > 0 ? data : PROJECTS_POOL // Fallback if empty
      projectsCacheTime = Date.now()
    } catch (error) {
      console.warn('[useFstData] Failed to load projects from API, using hardcoded data:', error)
      projectsError.value = error
      projects.value = PROJECTS_POOL // Fallback on error
    } finally {
      projectsLoading.value = false
    }

    return projects.value
  }

  /**
   * Load subfunds metadata
   */
  async function loadSubfunds(force = false) {
    // Check cache
    if (!force && Object.keys(subfunds.value).length > 0 && Date.now() - subfundsCacheTime < CACHE_TTL) {
      return subfunds.value
    }

    if (!useApiData.value) {
      // Use hardcoded data
      subfunds.value = SUBFUNDS
      return subfunds.value
    }

    subfundsLoading.value = true
    subfundsError.value = null

    try {
      const data = getSubfundsObject() // This is currently hardcoded metadata
      subfunds.value = data
      subfundsCacheTime = Date.now()
    } catch (error) {
      console.warn('[useFstData] Failed to load subfunds, using hardcoded data:', error)
      subfundsError.value = error
      subfunds.value = SUBFUNDS
    } finally {
      subfundsLoading.value = false
    }

    return subfunds.value
  }

  /**
   * Load aggregate stats for FstHub
   */
  async function loadStats(force = false) {
    // Check cache
    if (!force && stats.value && Date.now() - statsCacheTime < CACHE_TTL) {
      return stats.value
    }

    if (!useApiData.value) {
      // Calculate from hardcoded data
      stats.value = {
        aum: 6_400_000_000,
        portfolioCount: 7,
        subfundCount: 3,
        avgIRR: 0.38,
        projects: PROJECTS_POOL,
        subfunds: Object.values(SUBFUNDS)
      }
      return stats.value
    }

    statsLoading.value = true
    statsError.value = null

    try {
      const data = await getStats()
      stats.value = data
      statsCacheTime = Date.now()
    } catch (error) {
      console.warn('[useFstData] Failed to load stats from API, using calculated hardcoded data:', error)
      statsError.value = error
      stats.value = {
        aum: 6_400_000_000,
        portfolioCount: 7,
        subfundCount: 3,
        avgIRR: 0.38,
        projects: PROJECTS_POOL,
        subfunds: Object.values(SUBFUNDS)
      }
    } finally {
      statsLoading.value = false
    }

    return stats.value
  }

  /**
   * Load all data at once
   */
  async function loadAll(force = false) {
    await Promise.all([
      loadProjects(force),
      loadSubfunds(force),
      loadStats(force)
    ])
  }

  /**
   * Refresh all cached data
   */
  async function refresh() {
    return loadAll(true)
  }

  /**
   * Toggle between API and hardcoded data
   */
  function toggleDataSource() {
    useApiData.value = !useApiData.value
    // Clear cache to force reload
    projectsCacheTime = 0
    subfundsCacheTime = 0
    statsCacheTime = 0
  }

  // Computed states
  const isLoading = computed(() =>
    projectsLoading.value || subfundsLoading.value || statsLoading.value
  )

  const hasError = computed(() =>
    projectsError.value || subfundsError.value || statsError.value
  )

  return {
    // Data
    projects: computed(() => projects.value),
    subfunds: computed(() => subfunds.value),
    stats: computed(() => stats.value),

    // Loading states
    projectsLoading: computed(() => projectsLoading.value),
    subfundsLoading: computed(() => subfundsLoading.value),
    statsLoading: computed(() => statsLoading.value),
    isLoading,

    // Error states
    projectsError: computed(() => projectsError.value),
    subfundsError: computed(() => subfundsError.value),
    statsError: computed(() => statsError.value),
    hasError,

    // Data source
    useApiData: computed(() => useApiData.value),

    // Methods
    loadProjects,
    loadSubfunds,
    loadStats,
    loadAll,
    refresh,
    toggleDataSource
  }
}
