/**
 * Directory Cache Composable
 * Handles directory list caching, loading, and management for dropdown/multiselect cells
 */

import { ref, computed } from 'vue'
import { evaluateFilterCondition } from './filterConditionEvaluator.js'

export function useDirectoryCache(localHeaders, emit) {
  // Directory caching state
  const directoryLists = ref({})
  const directoryCache = ref({})
  const loadingDirectories = ref(new Set())

  // Computed: Check if directory is loading
  const isDirectoryLoading = (dirTableId) => {
    return loadingDirectories.value.has(dirTableId)
  }

  /**
   * Get options from directory cache
   * Issue #6839: Support filter condition
   * @param {number} dirTableId - Directory table ID
   * @param {string} filterCondition - Optional filter expression (e.g., "[Статус] = 'Активный'")
   * @param {object} currentRow - Optional current row data for dynamic filters (e.g., [cur.dept])
   * @returns {Array} Filtered directory options
   */
  const getDirectoryOptions = (dirTableId, filterCondition = null, currentRow = null) => {
    const options = directoryCache.value[dirTableId] || []

    if (!filterCondition || filterCondition.trim() === '') {
      return options
    }

    // Issue #6839: Apply filter condition
    try {
      return options.filter(item => evaluateFilterCondition(item, filterCondition, currentRow))
    } catch (err) {
      console.error('[getDirectoryOptions] Filter error:', err)
      return options
    }
  }

  // Check if any header using this dirTableId has a filterCondition referencing field IDs
  // like [123456] (numeric ID in brackets). If so, we need to load full objects with reqs.
  const _needsReqsForDir = (dirTableId) => {
    return localHeaders.value.some(h =>
      String(h.dirTableId) === String(dirTableId) &&
      h.filterCondition &&
      /\[\d+\]/.test(h.filterCondition)
    )
  }

  // Load directory list (with caching)
  const loadDirectoryList = (dirTableId) => {
    if (!directoryCache.value[dirTableId]) {
      loadingDirectories.value.add(dirTableId)
      const withReqs = _needsReqsForDir(dirTableId)
      emit('load-directory-list', {
        dirTableId,
        withReqs,
        callback: list => {
          directoryCache.value[dirTableId] = list
          loadingDirectories.value.delete(dirTableId)
        }
      })
    }
  }

  // Update directory value (single select)
  const updateDirValue = (header) => {
    const dirTableId = header.dirTableId
    const selectedItem = directoryCache.value[dirTableId]?.find(item => item.id === header.dirRowId)
    header.value = selectedItem ? selectedItem.value : ''
  }

  // Update multi-directory value (multi-select)
  const updateMultiDirValue = (header) => {
    const dirTableId = header.dirTableId
    const selectedItems = directoryCache.value[dirTableId]?.filter(item => header.dirValues.includes(item.id))
    header.value = selectedItems.map(item => item.value).join(', ') || ''
  }

  // Preload all directories for current headers
  const preloadAllDirectories = async () => {
    const dirTableIds = [...new Set(
      localHeaders.value
        .map(h => h.dirTableId)
        .filter(Boolean)
    )]

    if (dirTableIds.length === 0) return

    // Load all directories in parallel
    await Promise.all(
      dirTableIds.map(id => new Promise(resolve => {
        if (!directoryCache.value[id]) {
          loadingDirectories.value.add(id)
          const withReqs = _needsReqsForDir(id)
          emit('load-directory-list', {
            dirTableId: id,
            withReqs,
            callback: list => {
              directoryCache.value[id] = list
              directoryLists.value[id] = list
              loadingDirectories.value.delete(id)
              resolve()
            }
          })
        } else {
          resolve()
        }
      }))
    )
  }

  // Load all directories (synchronous, fire-and-forget)
  const loadAllDirectories = () => {
    const dirTableIds = new Set()
    localHeaders.value.forEach(header => {
      if (header.dirTableId) dirTableIds.add(header.dirTableId)
    })
    dirTableIds.forEach(id => loadDirectoryList(id))
  }

  // Refresh directory cache
  const refreshDirectoryCache = () => {
    const dirTableIds = Object.keys(directoryCache.value)

    dirTableIds.forEach(id => {
      loadingDirectories.value.add(id)
      emit('load-directory-list', {
        dirTableId: id,
        callback: list => {
          directoryCache.value[id] = list
          directoryLists.value[id] = list
          loadingDirectories.value.delete(id)
        }
      })
    })
  }

  // Clear directory cache
  const clearDirectoryCache = () => {
    directoryLists.value = {}
    directoryCache.value = {}
    loadingDirectories.value.clear()
  }

  // Invalidate a single directory from the cache so it is reloaded on next access
  // (needed after filterCondition changes: new filter may require withReqs=true)
  const invalidateDirectoryCache = (dirTableId) => {
    if (dirTableId) {
      delete directoryCache.value[dirTableId]
      delete directoryLists.value[dirTableId]
      loadingDirectories.value.delete(dirTableId)
    }
  }

  // Computed: Check if loading any directory
  const isLoadingAnyDirectory = computed(() => {
    return loadingDirectories.value.size > 0
  })

  return {
    // State
    directoryLists,
    directoryCache,
    loadingDirectories,

    // Computed
    isLoadingAnyDirectory,

    // Functions
    isDirectoryLoading,
    getDirectoryOptions,
    loadDirectoryList,
    updateDirValue,
    updateMultiDirValue,
    preloadAllDirectories,
    loadAllDirectories,
    refreshDirectoryCache,
    clearDirectoryCache,
    invalidateDirectoryCache
  }
}
