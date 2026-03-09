import { ref, computed } from 'vue'

const STORAGE_KEY = 'hints_seen'

/**
 * Composable for feature discovery hints.
 * Stores seen hint IDs in localStorage so hints are shown only once.
 */
export function useFeatureHints() {
  // Read initial state from localStorage
  const _getSeen = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  }

  const seenIds = ref(_getSeen())

  /**
   * Returns true if the hint with given id has NOT been seen yet
   * (i.e. the hint should be shown).
   */
  const isSeen = (id) => seenIds.value.includes(id)

  /**
   * Mark a hint as seen and persist to localStorage.
   */
  const markSeen = (id) => {
    if (!seenIds.value.includes(id)) {
      seenIds.value = [...seenIds.value, id]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seenIds.value))
      } catch {
        // ignore storage errors (private mode, quota exceeded)
      }
    }
  }

  /**
   * Reset all hints — they will all appear again.
   */
  const resetAllHints = () => {
    seenIds.value = []
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  /** Total number of seen hints */
  const seenCount = computed(() => seenIds.value.length)

  return {
    isSeen,
    markSeen,
    resetAllHints,
    seenCount,
    seenIds,
  }
}
