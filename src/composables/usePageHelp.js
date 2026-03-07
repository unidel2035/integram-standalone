/**
 * usePageHelp.js - Composable for Page Help Drawer
 * Issue #115: Контекстная панель помощи — «What's on this page?» sidebar
 *
 * Provides help panel functionality for each page module
 */

import { ref, computed } from 'vue'
import { getPageHelp } from '@/config/pageHelp'

/**
 * Page Help Composable
 * @param {string} pageId - Page identifier (e.g., 'fst-committee')
 * @returns {Object} Help panel state and methods
 */
export function usePageHelp(pageId) {
  // ==================== State ====================
  const isOpen = ref(false)

  // ==================== Computed ====================
  const pageHelp = computed(() => getPageHelp(pageId))

  // ==================== Methods ====================

  /**
   * Open help panel
   */
  function openHelp() {
    isOpen.value = true
  }

  /**
   * Close help panel
   */
  function closeHelp() {
    isOpen.value = false
  }

  /**
   * Toggle help panel
   */
  function toggleHelp() {
    isOpen.value = !isOpen.value
  }

  // ==================== Return API ====================
  return {
    // State
    isOpen,
    pageHelp,

    // Methods
    openHelp,
    closeHelp,
    toggleHelp
  }
}
