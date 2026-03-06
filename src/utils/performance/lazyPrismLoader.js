/**
 * Lazy Prism Loader
 *
 * Loads prisms and their hierarchies on-demand to improve performance
 * with large prism collections.
 *
 * @see /CLAUDE.md - Performance optimization requirements
 */

class LazyPrismLoader {
  constructor() {
    this.loadedPrisms = new Map()
    this.loadingPromises = new Map()
    this.prismHierarchy = new Map() // parent -> children mapping
  }

  /**
   * Load a prism by ID
   *
   * @param {string} prismId - Prism ID to load
   * @param {Function} loadFn - Function to load prism data (async)
   * @returns {Promise<Object>} Loaded prism
   */
  async loadPrism(prismId, loadFn) {
    // Return cached if already loaded
    if (this.loadedPrisms.has(prismId)) {
      return this.loadedPrisms.get(prismId)
    }

    // Return existing promise if already loading
    if (this.loadingPromises.has(prismId)) {
      return this.loadingPromises.get(prismId)
    }

    // Start loading
    const loadingPromise = this._loadPrismInternal(prismId, loadFn)
    this.loadingPromises.set(prismId, loadingPromise)

    try {
      const prism = await loadingPromise
      this.loadedPrisms.set(prismId, prism)
      this.loadingPromises.delete(prismId)
      return prism
    } catch (error) {
      this.loadingPromises.delete(prismId)
      throw error
    }
  }

  /**
   * Internal prism loading logic
   * @private
   */
  async _loadPrismInternal(prismId, loadFn) {
    try {
      const prism = await loadFn(prismId)

      // Update hierarchy if prism has parent or children
      if (prism.parentId) {
        if (!this.prismHierarchy.has(prism.parentId)) {
          this.prismHierarchy.set(prism.parentId, [])
        }
        this.prismHierarchy.get(prism.parentId).push(prismId)
      }

      return prism
    } catch (error) {
      console.error(`Failed to load prism ${prismId}:`, error)
      throw error
    }
  }

  /**
   * Load prism hierarchy (parent and all descendants)
   *
   * @param {string} rootPrismId - Root prism ID
   * @param {Function} loadFn - Function to load prism data
   * @returns {Promise<Object[]>} Loaded prisms (flat array)
   */
  async loadPrismHierarchy(rootPrismId, loadFn) {
    const loadedPrisms = []
    const toLoad = [rootPrismId]
    const loaded = new Set()

    while (toLoad.length > 0) {
      const prismId = toLoad.shift()
      if (loaded.has(prismId)) continue

      const prism = await this.loadPrism(prismId, loadFn)
      loadedPrisms.push(prism)
      loaded.add(prismId)

      // Add children to load queue
      const children = this.prismHierarchy.get(prismId) || []
      toLoad.push(...children)
    }

    return loadedPrisms
  }

  /**
   * Prefetch prisms (load in background)
   *
   * @param {string[]} prismIds - Prism IDs to prefetch
   * @param {Function} loadFn - Function to load prism data
   */
  prefetch(prismIds, loadFn) {
    for (const prismId of prismIds) {
      if (!this.loadedPrisms.has(prismId) && !this.loadingPromises.has(prismId)) {
        // Start loading in background (don't await)
        this.loadPrism(prismId, loadFn).catch(error => {
          console.warn(`Prefetch failed for prism ${prismId}:`, error)
        })
      }
    }
  }

  /**
   * Unload prism from cache
   *
   * @param {string} prismId - Prism ID to unload
   */
  unload(prismId) {
    this.loadedPrisms.delete(prismId)
    // Note: Keep hierarchy info for navigation
  }

  /**
   * Check if prism is loaded
   *
   * @param {string} prismId - Prism ID to check
   * @returns {boolean} True if loaded
   */
  isLoaded(prismId) {
    return this.loadedPrisms.has(prismId)
  }

  /**
   * Check if prism is currently loading
   *
   * @param {string} prismId - Prism ID to check
   * @returns {boolean} True if loading
   */
  isLoading(prismId) {
    return this.loadingPromises.has(prismId)
  }

  /**
   * Get children of a prism
   *
   * @param {string} prismId - Parent prism ID
   * @returns {string[]} Child prism IDs
   */
  getChildren(prismId) {
    return this.prismHierarchy.get(prismId) || []
  }

  /**
   * Clear all loaded prisms and hierarchy
   */
  clear() {
    this.loadedPrisms.clear()
    this.loadingPromises.clear()
    this.prismHierarchy.clear()
  }

  /**
   * Get loader statistics
   *
   * @returns {Object} Loader statistics
   */
  getStats() {
    return {
      loadedCount: this.loadedPrisms.size,
      loadingCount: this.loadingPromises.size,
      hierarchySize: this.prismHierarchy.size
    }
  }
}

// Create global loader instance
const lazyPrismLoader = new LazyPrismLoader()

export default lazyPrismLoader
