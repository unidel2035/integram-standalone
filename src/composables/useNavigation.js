import { ref, computed, watch } from 'vue'

/**
 * Composable for managing navigation between linked diagrams in Flow Editor
 * Handles navigation stack, viewport persistence, and breadcrumb generation
 */
export function useNavigation() {
  // Navigation stack stores history of visited diagrams
  const navigationStack = ref([])

  // Current diagram being viewed
  const currentDiagramId = ref(null)

  // Store viewports for each diagram
  const viewportCache = ref(new Map())

  /**
   * Initialize navigation with a root diagram
   * @param {string} diagramId - ID of the root diagram
   * @param {string} diagramName - Name of the root diagram
   * @param {Object} viewport - Current viewport {x, y, zoom}
   */
  const initNavigation = (
    diagramId,
    diagramName,
    viewport = { x: 0, y: 0, zoom: 1 },
  ) => {
    navigationStack.value = [
      {
        diagramId,
        diagramName,
        nodeId: null,
        nodeName: null,
        viewport: { ...viewport },
      },
    ]
    currentDiagramId.value = diagramId
    saveViewport(diagramId, viewport)
  }

  /**
   * Save viewport state for a diagram
   * @param {string} diagramId - Diagram ID
   * @param {Object} viewport - Viewport state {x, y, zoom}
   */
  const saveViewport = (diagramId, viewport) => {
    if (!diagramId || !viewport) return
    viewportCache.value.set(diagramId, { ...viewport })

    // Also persist to localStorage for long-term storage
    try {
      const stored = JSON.parse(
        localStorage.getItem('flow-editor-viewports') || '{}',
      )
      stored[diagramId] = viewport
      localStorage.setItem('flow-editor-viewports', JSON.stringify(stored))
    } catch (e) {
      console.error('Failed to save viewport to localStorage:', e)
    }
  }

  /**
   * Get saved viewport for a diagram
   * @param {string} diagramId - Diagram ID
   * @returns {Object|null} Viewport state or null
   */
  const getViewport = diagramId => {
    if (!diagramId) return null

    // Try memory cache first
    if (viewportCache.value.has(diagramId)) {
      return viewportCache.value.get(diagramId)
    }

    // Fall back to localStorage
    try {
      const stored = JSON.parse(
        localStorage.getItem('flow-editor-viewports') || '{}',
      )
      if (stored[diagramId]) {
        viewportCache.value.set(diagramId, stored[diagramId])
        return stored[diagramId]
      }
    } catch (e) {
      console.error('Failed to load viewport from localStorage:', e)
    }

    return null
  }

  /**
   * Navigate to a linked diagram (drill down)
   * @param {string} diagramId - Target diagram ID
   * @param {string} diagramName - Target diagram name
   * @param {string} fromNodeId - Source node ID (optional)
   * @param {string} fromNodeName - Source node name (optional)
   * @param {Object} currentViewport - Current viewport to save
   * @returns {Object} Navigation result {success, viewport}
   */
  const navigateTo = (
    diagramId,
    diagramName,
    fromNodeId = null,
    fromNodeName = null,
    currentViewport = null,
  ) => {
    // Save current viewport if provided
    if (currentDiagramId.value && currentViewport) {
      saveViewport(currentDiagramId.value, currentViewport)

      // Update viewport in navigation stack for current position
      const current = navigationStack.value[navigationStack.value.length - 1]
      if (current) {
        current.viewport = { ...currentViewport }
      }
    }

    // Add new entry to navigation stack
    navigationStack.value.push({
      diagramId,
      diagramName,
      nodeId: fromNodeId,
      nodeName: fromNodeName,
      viewport: getViewport(diagramId) || { x: 0, y: 0, zoom: 1 },
    })

    currentDiagramId.value = diagramId

    return {
      success: true,
      viewport: getViewport(diagramId) || { x: 0, y: 0, zoom: 1 },
    }
  }

  /**
   * Navigate back to previous diagram
   * @param {Object} currentViewport - Current viewport to save before going back
   * @returns {Object|null} Previous navigation entry or null
   */
  const navigateBack = (currentViewport = null) => {
    if (navigationStack.value.length <= 1) {
      return null // Already at root
    }

    // Save current viewport
    if (currentDiagramId.value && currentViewport) {
      saveViewport(currentDiagramId.value, currentViewport)
    }

    // Remove current position
    navigationStack.value.pop()

    // Get previous position
    const previous = navigationStack.value[navigationStack.value.length - 1]
    if (previous) {
      currentDiagramId.value = previous.diagramId
      return {
        ...previous,
        viewport: getViewport(previous.diagramId) || previous.viewport,
      }
    }

    return null
  }

  /**
   * Navigate to a specific position in breadcrumbs (can go back multiple levels)
   * @param {number} index - Index in navigation stack
   * @param {Object} currentViewport - Current viewport to save
   * @returns {Object|null} Target navigation entry or null
   */
  const navigateToBreadcrumb = (index, currentViewport = null) => {
    if (index < 0 || index >= navigationStack.value.length) {
      return null
    }

    // Save current viewport
    if (currentDiagramId.value && currentViewport) {
      saveViewport(currentDiagramId.value, currentViewport)
    }

    // Remove items after the target index
    navigationStack.value.splice(index + 1)

    // Get target position
    const target = navigationStack.value[index]
    if (target) {
      currentDiagramId.value = target.diagramId
      return {
        ...target,
        viewport: getViewport(target.diagramId) || target.viewport,
      }
    }

    return null
  }

  /**
   * Navigate forward (if available in history)
   * Currently not implemented as we don't maintain forward history
   * Would require separate forward stack
   */
  const navigateForward = () => {
    // TODO: Implement forward navigation if needed
    console.warn('Forward navigation not yet implemented')
    return null
  }

  /**
   * Generate breadcrumb items from navigation stack
   * @returns {Array} Breadcrumb items
   */
  const breadcrumbItems = computed(() => {
    return navigationStack.value.map((item, index) => {
      if (index === 0) {
        // Root diagram
        return {
          index,
          icon: '🏠',
          label: item.diagramName,
          isRoot: true,
          isActive: index === navigationStack.value.length - 1,
        }
      } else {
        // Linked diagram with parent node context
        return {
          index,
          icon: '📊',
          label: `${item.nodeName} (${item.diagramName})`,
          nodeName: item.nodeName,
          diagramName: item.diagramName,
          isRoot: false,
          isActive: index === navigationStack.value.length - 1,
        }
      }
    })
  })

  /**
   * Check if back navigation is available
   */
  const canGoBack = computed(() => {
    return navigationStack.value.length > 1
  })

  /**
   * Check if forward navigation is available
   */
  const canGoForward = computed(() => {
    return false // Not implemented yet
  })

  /**
   * Get current navigation depth (0 = root)
   */
  const navigationDepth = computed(() => {
    return navigationStack.value.length - 1
  })

  /**
   * Clear navigation history and reset to initial state
   */
  const clearNavigation = () => {
    navigationStack.value = []
    currentDiagramId.value = null
    viewportCache.value.clear()
  }

  /**
   * Get the full navigation path as a string
   */
  const navigationPath = computed(() => {
    return navigationStack.value
      .map((item, index) => {
        if (index === 0) return item.diagramName
        return `${item.nodeName} → ${item.diagramName}`
      })
      .join(' / ')
  })

  return {
    // State
    navigationStack,
    currentDiagramId,
    breadcrumbItems,

    // Computed
    canGoBack,
    canGoForward,
    navigationDepth,
    navigationPath,

    // Methods
    initNavigation,
    navigateTo,
    navigateBack,
    navigateToBreadcrumb,
    navigateForward,
    saveViewport,
    getViewport,
    clearNavigation,
  }
}
