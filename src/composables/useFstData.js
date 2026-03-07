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
import { SUBFUNDS } from '@/components/fst-committee/FstCommitteeConfig.js'

// Порядок сортировки статусов: «На рассмотрении ИК» → «Новый» → остальные
const STATUS_SORT = { '1117': 0, '1115': 1 }

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

    projectsLoading.value = true
    projectsError.value = null

    try {
      const data = await getEnrichedProjects()
      // Сортировка: «На рассмотрении ИК» → «Новый» → остальные
      data.sort((a, b) => {
        const ai = STATUS_SORT[String(a.statusId)] ?? 9
        const bi = STATUS_SORT[String(b.statusId)] ?? 9
        return ai - bi
      })
      projects.value = data
      projectsCacheTime = Date.now()
    } catch (error) {
      console.warn('[useFstData] Failed to load projects from API:', error)
      projectsError.value = error
      projects.value = []
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

    subfundsLoading.value = true
    subfundsError.value = null

    try {
      const data = getSubfundsObject()
      subfunds.value = Object.keys(data).length > 0 ? data : SUBFUNDS
      subfundsCacheTime = Date.now()
    } catch (error) {
      console.warn('[useFstData] Failed to load subfunds:', error)
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

    statsLoading.value = true
    statsError.value = null

    try {
      const data = await getStats()
      // Дополняем реальными данными из презентации ФСТ НТИ март 2025
      stats.value = {
        ...data,
        subfundCount: Math.max(data.subfundCount ?? 0, 6),
        dealsCount: data.dealsCount ?? 9,
      }
      statsCacheTime = Date.now()
    } catch (error) {
      console.warn('[useFstData] Failed to load stats from API:', error)
      statsError.value = error
      stats.value = {
        aum: 9_500_000_000,
        portfolioCount: 6,
        subfundCount: 6,
        dealsCount: 9,
        avgIRR: 0.31,
        projects: [],
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

    // Methods
    loadProjects,
    loadSubfunds,
    loadStats,
    loadAll,
    refresh,
  }
}
