/**
 * Thing Store - Role-Sets Paradigm State Management
 *
 * Manages Things (identity-only entities) in the application state.
 *
 * This store follows Role-Sets principles:
 * 1. Things have ONLY identity (id, timestamps)
 * 2. No attributes beyond identity
 * 3. Things are referenced by RoleBindings to gain roles
 *
 * @see /docs/conceptual-framework/role-sets-theory.md
 * @see /docs/conceptual-framework/plain-models-architecture.md
 */

import { reactive, computed } from 'vue'
import {
  createThing,
  isValidThing,
  getThingIdentity,
  areThingsSame,
  touchThing,
  serializeThing,
  deserializeThing
} from '@/models/Thing'

// State
const state = reactive({
  things: [], // Array of Thing objects
  thingsById: {}, // Map of Thing.id -> Thing for fast lookup
  loading: false,
  error: null
})

/**
 * Thing Store composable
 *
 * @returns {Object} Store API
 */
export const useThingStore = () => {
  // Getters
  const allThings = computed(() => state.things)
  const thingCount = computed(() => state.things.length)
  const isLoading = computed(() => state.loading)
  const error = computed(() => state.error)

  /**
   * Gets a Thing by ID
   *
   * @param {string} id - Thing ID
   * @returns {import('@/models/Thing').Thing | undefined} The Thing
   */
  const getThingById = (id) => {
    return state.thingsById[id]
  }

  /**
   * Checks if a Thing exists
   *
   * @param {string} id - Thing ID
   * @returns {boolean} True if Thing exists
   */
  const hasThing = (id) => {
    return id in state.thingsById
  }

  /**
   * Gets multiple Things by IDs
   *
   * @param {string[]} ids - Array of Thing IDs
   * @returns {import('@/models/Thing').Thing[]} Array of Things
   */
  const getThingsByIds = (ids) => {
    return ids.map((id) => state.thingsById[id]).filter(Boolean)
  }

  // Actions

  /**
   * Creates a new Thing
   *
   * @param {import('@/models/Thing').ThingCreateOptions} [options={}] - Creation options
   * @returns {import('@/models/Thing').Thing} The created Thing
   *
   * @example
   * const thing = createNewThing()
   * // Thing with generated UUID
   *
   * @example
   * const thing = createNewThing({ id: 'custom-id' })
   * // Thing with custom ID
   */
  const createNewThing = (options = {}) => {
    try {
      state.error = null
      const thing = createThing(options)

      // Add to state
      state.things.push(thing)
      state.thingsById[thing.id] = thing

      return thing
    } catch (err) {
      state.error = err.message
      throw err
    }
  }

  /**
   * Adds an existing Thing to the store
   *
   * @param {import('@/models/Thing').Thing} thing - The Thing to add
   * @returns {import('@/models/Thing').Thing} The added Thing
   */
  const addThing = (thing) => {
    try {
      state.error = null

      if (!isValidThing(thing)) {
        throw new Error('Invalid Thing')
      }

      if (hasThing(thing.id)) {
        throw new Error(`Thing with id ${thing.id} already exists`)
      }

      state.things.push(thing)
      state.thingsById[thing.id] = thing

      return thing
    } catch (err) {
      state.error = err.message
      throw err
    }
  }

  /**
   * Updates a Thing's metadata (timestamp)
   *
   * @param {string} id - Thing ID
   * @returns {import('@/models/Thing').Thing | null} Updated Thing
   */
  const updateThingMetadata = (id) => {
    try {
      state.error = null

      const thing = state.thingsById[id]
      if (!thing) {
        throw new Error(`Thing with id ${id} not found`)
      }

      const updated = touchThing(thing)

      // Update in state
      const index = state.things.findIndex((t) => t.id === id)
      if (index !== -1) {
        state.things[index] = updated
      }
      state.thingsById[id] = updated

      return updated
    } catch (err) {
      state.error = err.message
      return null
    }
  }

  /**
   * Deletes a Thing
   *
   * Note: This should only be done if no RoleBindings reference this Thing!
   * Consider adding a check for dependent RoleBindings before deletion.
   *
   * @param {string} id - Thing ID
   * @returns {boolean} True if deleted
   */
  const deleteThing = (id) => {
    try {
      state.error = null

      if (!hasThing(id)) {
        throw new Error(`Thing with id ${id} not found`)
      }

      // Remove from array
      const index = state.things.findIndex((t) => t.id === id)
      if (index !== -1) {
        state.things.splice(index, 1)
      }

      // Remove from map
      delete state.thingsById[id]

      return true
    } catch (err) {
      state.error = err.message
      return false
    }
  }

  /**
   * Deletes multiple Things
   *
   * @param {string[]} ids - Array of Thing IDs
   * @returns {{deleted: string[], failed: string[]}} Result
   */
  const deleteThings = (ids) => {
    const deleted = []
    const failed = []

    for (const id of ids) {
      try {
        if (deleteThing(id)) {
          deleted.push(id)
        } else {
          failed.push(id)
        }
      } catch {
        failed.push(id)
      }
    }

    return { deleted, failed }
  }

  /**
   * Clears all Things
   */
  const clearThings = () => {
    state.things = []
    state.thingsById = {}
    state.error = null
  }

  /**
   * Loads Things from array
   *
   * @param {import('@/models/Thing').Thing[]} things - Array of Things
   */
  const loadThings = (things) => {
    try {
      state.loading = true
      state.error = null

      clearThings()

      for (const thing of things) {
        if (isValidThing(thing)) {
          state.things.push(thing)
          state.thingsById[thing.id] = thing
        }
      }

      state.loading = false
    } catch (err) {
      state.error = err.message
      state.loading = false
      throw err
    }
  }

  /**
   * Exports all Things to JSON-compatible array
   *
   * @returns {Object[]} JSON-compatible array
   */
  const exportThings = () => {
    return state.things.map(serializeThing)
  }

  /**
   * Imports Things from JSON-compatible array
   *
   * @param {Object[]} json - JSON-compatible array
   */
  const importThings = (json) => {
    try {
      state.loading = true
      state.error = null

      const things = json.map(deserializeThing)
      loadThings(things)

      state.loading = false
    } catch (err) {
      state.error = err.message
      state.loading = false
      throw err
    }
  }

  /**
   * Finds Things by predicate
   *
   * @param {(thing: import('@/models/Thing').Thing) => boolean} predicate - Filter function
   * @returns {import('@/models/Thing').Thing[]} Matching Things
   */
  const findThings = (predicate) => {
    return state.things.filter(predicate)
  }

  /**
   * Gets Things created after a specific date
   *
   * @param {Date} date - The date
   * @returns {import('@/models/Thing').Thing[]} Matching Things
   */
  const getThingsCreatedAfter = (date) => {
    return state.things.filter((thing) => thing.createdAt > date)
  }

  /**
   * Gets Things created before a specific date
   *
   * @param {Date} date - The date
   * @returns {import('@/models/Thing').Thing[]} Matching Things
   */
  const getThingsCreatedBefore = (date) => {
    return state.things.filter((thing) => thing.createdAt < date)
  }

  return {
    // State (getters)
    allThings,
    thingCount,
    isLoading,
    error,

    // Getters
    getThingById,
    hasThing,
    getThingsByIds,

    // Actions
    createNewThing,
    addThing,
    updateThingMetadata,
    deleteThing,
    deleteThings,
    clearThings,
    loadThings,
    exportThings,
    importThings,
    findThings,
    getThingsCreatedAfter,
    getThingsCreatedBefore
  }
}

// Export default for easier imports
export default useThingStore
