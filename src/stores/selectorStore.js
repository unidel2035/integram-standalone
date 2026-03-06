/**
 * Selector Store
 *
 * Issue #6769: Global store for page-level filters (Selector blocks)
 *
 * Manages named filter values that synchronize filtering across all
 * components on a page (tables, cards, maps, charts).
 *
 * Usage:
 * - Selector blocks set values: setSelector('region', 'Москва')
 * - Data components read filters: const filters = selectorStore.selectors
 * - Components apply filters when loading/rendering data
 *
 * Features:
 * - Multiple named selectors: { region: 'Москва', status: 'Активный' }
 * - null value = filter disabled (show all)
 * - AND logic when combining multiple selectors
 * - URL sync support (optional)
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { setGlobalSelector } from './selectorState'

export const useSelectorStore = defineStore('selector', () => {
  const route = useRoute()
  const router = useRouter()

  // State: { selectorName: selectedValue | null }
  // null means "All" / filter disabled
  const selectors = ref({})

  // Enable/disable URL synchronization
  const urlSyncEnabled = ref(false)

  /**
   * Set a selector value
   * @param {string} name - Selector name (e.g., 'region', 'status')
   * @param {string|number|null} value - Selected value or null for "All"
   */
  function setSelector(name, value) {
    if (value === null || value === '' || value === undefined) {
      // Remove filter (show all)
      delete selectors.value[name]
    } else {
      selectors.value[name] = value
    }

    // Trigger reactivity
    selectors.value = { ...selectors.value }

    // Sync to module-level shared state (for sub-app consumers like DataTable embeds)
    setGlobalSelector(name, value)

    // Sync to URL if enabled
    if (urlSyncEnabled.value) {
      syncToUrl()
    }
  }

  /**
   * Get a selector value
   * @param {string} name - Selector name
   * @returns {string|number|null} Current value or null
   */
  function getSelector(name) {
    return selectors.value[name] || null
  }

  /**
   * Clear a specific selector
   * @param {string} name - Selector name
   */
  function clearSelector(name) {
    setSelector(name, null)
  }

  /**
   * Clear all selectors
   */
  function clearAll() {
    selectors.value = {}
    if (urlSyncEnabled.value) {
      syncToUrl()
    }
  }

  /**
   * Get active filters (non-null selectors)
   * @returns {Object} Active filters only
   */
  const activeFilters = computed(() => {
    const active = {}
    for (const [name, value] of Object.entries(selectors.value)) {
      if (value !== null && value !== undefined && value !== '') {
        active[name] = value
      }
    }
    return active
  })

  /**
   * Count of active filters
   */
  const activeCount = computed(() => {
    return Object.keys(activeFilters.value).length
  })

  /**
   * Check if a specific selector is active
   * @param {string} name - Selector name
   * @returns {boolean}
   */
  function isActive(name) {
    const value = selectors.value[name]
    return value !== null && value !== undefined && value !== ''
  }

  /**
   * Apply filters to a dataset (client-side filtering)
   * @param {Array} data - Array of objects to filter
   * @param {Object} fieldMapping - Map selector names to data field names
   *   Example: { region: 'region_name', status: 'status_field' }
   * @returns {Array} Filtered data
   */
  function applyFilters(data, fieldMapping) {
    if (!data || !Array.isArray(data)) return data
    if (activeCount.value === 0) return data

    return data.filter(item => {
      for (const [selectorName, filterValue] of Object.entries(activeFilters.value)) {
        const fieldName = fieldMapping[selectorName] || selectorName
        const itemValue = item[fieldName]

        // Strict equality check
        if (itemValue !== filterValue) {
          return false
        }
      }
      return true
    })
  }

  /**
   * Build query params for API requests (server-side filtering)
   * @param {Object} fieldMapping - Map selector names to API param names
   * @returns {Object} Query parameters
   */
  function buildApiParams(fieldMapping = {}) {
    const params = {}
    for (const [selectorName, filterValue] of Object.entries(activeFilters.value)) {
      const paramName = fieldMapping[selectorName] || selectorName
      params[paramName] = filterValue
    }
    return params
  }

  /**
   * Sync selectors to URL query params
   */
  function syncToUrl() {
    if (!router) return

    const query = { ...route.query }

    // Remove old selector params
    for (const key in query) {
      if (key.startsWith('selector_')) {
        delete query[key]
      }
    }

    // Add active selectors with 'selector_' prefix
    for (const [name, value] of Object.entries(activeFilters.value)) {
      query[`selector_${name}`] = String(value)
    }

    // Update URL without navigation
    router.replace({ query }).catch(() => {})
  }

  /**
   * Load selectors from URL query params
   */
  function loadFromUrl() {
    if (!route) return

    const loaded = {}
    for (const [key, value] of Object.entries(route.query)) {
      if (key.startsWith('selector_')) {
        const name = key.replace('selector_', '')
        loaded[name] = value
      }
    }

    if (Object.keys(loaded).length > 0) {
      selectors.value = loaded
    }
  }

  /**
   * Enable URL synchronization and load from URL
   */
  function enableUrlSync() {
    urlSyncEnabled.value = true
    loadFromUrl()
  }

  /**
   * Disable URL synchronization
   */
  function disableUrlSync() {
    urlSyncEnabled.value = false
  }

  return {
    // State
    selectors,
    activeFilters,
    activeCount,
    urlSyncEnabled,

    // Actions
    setSelector,
    getSelector,
    clearSelector,
    clearAll,
    isActive,
    applyFilters,
    buildApiParams,
    enableUrlSync,
    disableUrlSync,
    syncToUrl,
    loadFromUrl
  }
})
