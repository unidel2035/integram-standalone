/**
 * RoleBinding Store - Role-Sets Paradigm State Management
 *
 * Manages RoleBindings (Witnesses) in the application state.
 *
 * This store follows Role-Sets principles:
 * 1. RoleBindings are proofs of Thing membership in Roles
 * 2. Witnesses contain attribute values and validation traces
 * 3. Membership is validated against Role contracts
 *
 * @see /docs/conceptual-framework/role-sets-theory.md
 * @see /docs/conceptual-framework/plain-models-architecture.md
 */

import { reactive, computed } from 'vue'
import {
  createRoleBinding,
  isValidRoleBinding,
  updateRoleBindingAttributes,
  getRoleBindingAttribute,
  getRoleBindingAttributes,
  hasRoleBindingAttribute,
  addDependency,
  invalidateRoleBinding,
  isRoleBindingValid,
  serializeRoleBinding,
  deserializeRoleBinding
} from '@/models/RoleBinding'
import { validateAndCreateRoleBinding } from '@/models/WitnessValidation'

// State
const state = reactive({
  bindings: [], // Array of RoleBinding objects
  bindingsById: {}, // Map of RoleBinding.id -> RoleBinding
  bindingsByThing: {}, // Map of Thing.id -> Array of RoleBinding objects
  bindingsByRole: {}, // Map of Role.id -> Array of RoleBinding objects
  bindingsByPrism: {}, // Map of Prism.id -> Array of RoleBinding objects

  loading: false,
  error: null
})

/**
 * RoleBinding Store composable
 *
 * @returns {Object} Store API
 */
export const useRoleBindingStore = () => {
  // Getters
  const allBindings = computed(() => state.bindings)
  const bindingCount = computed(() => state.bindings.length)
  const validBindings = computed(() => state.bindings.filter(isRoleBindingValid))
  const invalidBindings = computed(() => state.bindings.filter((b) => !isRoleBindingValid(b)))
  const isLoading = computed(() => state.loading)
  const error = computed(() => state.error)

  /**
   * Gets a RoleBinding by ID
   *
   * @param {string} id - RoleBinding ID
   * @returns {import('@/models/RoleBinding').RoleBinding | undefined} The RoleBinding
   */
  const getBindingById = (id) => {
    return state.bindingsById[id]
  }

  /**
   * Gets all RoleBindings for a Thing
   *
   * @param {string} thingId - Thing ID
   * @returns {import('@/models/RoleBinding').RoleBinding[]} Array of RoleBindings
   */
  const getBindingsByThing = (thingId) => {
    return state.bindingsByThing[thingId] || []
  }

  /**
   * Gets all RoleBindings for a Role
   *
   * @param {string} roleId - Role ID
   * @returns {import('@/models/RoleBinding').RoleBinding[]} Array of RoleBindings
   */
  const getBindingsByRole = (roleId) => {
    return state.bindingsByRole[roleId] || []
  }

  /**
   * Gets all RoleBindings for a Prism
   *
   * @param {string} prismId - Prism ID
   * @returns {import('@/models/RoleBinding').RoleBinding[]} Array of RoleBindings
   */
  const getBindingsByPrism = (prismId) => {
    return state.bindingsByPrism[prismId] || []
  }

  /**
   * Gets a RoleBinding for a specific Thing-Role pair
   *
   * @param {string} thingId - Thing ID
   * @param {string} roleId - Role ID
   * @returns {import('@/models/RoleBinding').RoleBinding | undefined} The RoleBinding
   */
  const getBindingByThingAndRole = (thingId, roleId) => {
    const bindings = getBindingsByThing(thingId)
    return bindings.find((b) => b.roleId === roleId)
  }

  /**
   * Checks if a Thing has a specific Role
   *
   * @param {string} thingId - Thing ID
   * @param {string} roleId - Role ID
   * @returns {boolean} True if Thing has Role
   */
  const hasRole = (thingId, roleId) => {
    return getBindingByThingAndRole(thingId, roleId) !== undefined
  }

  /**
   * Checks if a RoleBinding exists
   *
   * @param {string} id - RoleBinding ID
   * @returns {boolean} True if RoleBinding exists
   */
  const hasBinding = (id) => {
    return id in state.bindingsById
  }

  // Actions

  /**
   * Creates a new RoleBinding (without validation)
   *
   * Use createValidatedBinding() for automatic validation.
   *
   * @param {import('@/models/RoleBinding').RoleBindingCreateOptions} options - Creation options
   * @returns {import('@/models/RoleBinding').RoleBinding} The created RoleBinding
   */
  const createNewBinding = (options) => {
    try {
      state.error = null

      // Check for duplicate Thing-Role pair
      const existing = getBindingByThingAndRole(options.thingId, options.roleId)
      if (existing) {
        throw new Error(`Binding already exists for Thing ${options.thingId} and Role ${options.roleId}`)
      }

      const binding = createRoleBinding(options)

      // Add to state
      addBindingToState(binding)

      return binding
    } catch (err) {
      state.error = err.message
      throw err
    }
  }

  /**
   * Creates a validated RoleBinding (with contract validation)
   *
   * This is the recommended way to create RoleBindings.
   *
   * @param {Object} options - Creation options
   * @param {string} options.thingId - Thing ID
   * @param {string} options.prismId - Prism ID
   * @param {string} options.roleId - Role ID
   * @param {import('@/models/Role').Role} options.role - The Role (for validation)
   * @param {Object<string, any>} options.attributes - Attribute values
   * @param {string} [options.explanation] - Explanation
   * @param {string[]} [options.dependencies] - Dependencies
   * @returns {{success: boolean, binding?: import('@/models/RoleBinding').RoleBinding, errors?: string[]}} Result
   */
  const createValidatedBinding = (options) => {
    try {
      state.error = null

      // Check for duplicate Thing-Role pair
      const existing = getBindingByThingAndRole(options.thingId, options.roleId)
      if (existing) {
        return {
          success: false,
          errors: [`Binding already exists for Thing ${options.thingId} and Role ${options.roleId}`]
        }
      }

      // Validate and create
      const result = validateAndCreateRoleBinding(options)

      if (result.success && result.binding) {
        addBindingToState(result.binding)
      } else {
        state.error = result.errors?.join(', ')
      }

      return result
    } catch (err) {
      state.error = err.message
      return {
        success: false,
        errors: [err.message]
      }
    }
  }

  /**
   * Helper to add binding to state indexes
   *
   * @private
   * @param {import('@/models/RoleBinding').RoleBinding} binding - The binding
   */
  const addBindingToState = (binding) => {
    state.bindings.push(binding)
    state.bindingsById[binding.id] = binding

    if (!state.bindingsByThing[binding.thingId]) {
      state.bindingsByThing[binding.thingId] = []
    }
    state.bindingsByThing[binding.thingId].push(binding)

    if (!state.bindingsByRole[binding.roleId]) {
      state.bindingsByRole[binding.roleId] = []
    }
    state.bindingsByRole[binding.roleId].push(binding)

    if (!state.bindingsByPrism[binding.prismId]) {
      state.bindingsByPrism[binding.prismId] = []
    }
    state.bindingsByPrism[binding.prismId].push(binding)
  }

  /**
   * Helper to remove binding from state indexes
   *
   * @private
   * @param {import('@/models/RoleBinding').RoleBinding} binding - The binding
   */
  const removeBindingFromState = (binding) => {
    const index = state.bindings.findIndex((b) => b.id === binding.id)
    if (index !== -1) {
      state.bindings.splice(index, 1)
    }

    delete state.bindingsById[binding.id]

    // Remove from Thing index
    const thingBindings = state.bindingsByThing[binding.thingId]
    if (thingBindings) {
      const idx = thingBindings.findIndex((b) => b.id === binding.id)
      if (idx !== -1) {
        thingBindings.splice(idx, 1)
      }
    }

    // Remove from Role index
    const roleBindings = state.bindingsByRole[binding.roleId]
    if (roleBindings) {
      const idx = roleBindings.findIndex((b) => b.id === binding.id)
      if (idx !== -1) {
        roleBindings.splice(idx, 1)
      }
    }

    // Remove from Prism index
    const prismBindings = state.bindingsByPrism[binding.prismId]
    if (prismBindings) {
      const idx = prismBindings.findIndex((b) => b.id === binding.id)
      if (idx !== -1) {
        prismBindings.splice(idx, 1)
      }
    }
  }

  /**
   * Updates a RoleBinding's attributes
   *
   * @param {string} id - RoleBinding ID
   * @param {Object<string, any>} attributes - New attributes
   * @param {import('@/models/RoleBinding').ValidationTrace[]} [validationTrace] - Validation trace
   * @returns {import('@/models/RoleBinding').RoleBinding | null} Updated RoleBinding
   */
  const updateBindingAttributes = (id, attributes, validationTrace) => {
    try {
      state.error = null

      const binding = state.bindingsById[id]
      if (!binding) {
        throw new Error(`RoleBinding with id ${id} not found`)
      }

      const updated = updateRoleBindingAttributes(binding, attributes, validationTrace)

      // Remove old and add updated
      removeBindingFromState(binding)
      addBindingToState(updated)

      return updated
    } catch (err) {
      state.error = err.message
      return null
    }
  }

  /**
   * Invalidates a RoleBinding
   *
   * @param {string} id - RoleBinding ID
   * @param {string} reason - Reason for invalidation
   * @returns {import('@/models/RoleBinding').RoleBinding | null} Invalidated RoleBinding
   */
  const invalidateBinding = (id, reason) => {
    try {
      state.error = null

      const binding = state.bindingsById[id]
      if (!binding) {
        throw new Error(`RoleBinding with id ${id} not found`)
      }

      const invalidated = invalidateRoleBinding(binding, reason)

      // Remove old and add updated
      removeBindingFromState(binding)
      addBindingToState(invalidated)

      return invalidated
    } catch (err) {
      state.error = err.message
      return null
    }
  }

  /**
   * Deletes a RoleBinding
   *
   * @param {string} id - RoleBinding ID
   * @returns {boolean} True if deleted
   */
  const deleteBinding = (id) => {
    try {
      state.error = null

      const binding = state.bindingsById[id]
      if (!binding) {
        throw new Error(`RoleBinding with id ${id} not found`)
      }

      removeBindingFromState(binding)

      return true
    } catch (err) {
      state.error = err.message
      return false
    }
  }

  /**
   * Deletes all RoleBindings for a Thing
   *
   * @param {string} thingId - Thing ID
   * @returns {number} Number of bindings deleted
   */
  const deleteBindingsForThing = (thingId) => {
    const bindings = getBindingsByThing(thingId)
    let count = 0

    for (const binding of bindings) {
      if (deleteBinding(binding.id)) {
        count++
      }
    }

    return count
  }

  /**
   * Deletes all RoleBindings for a Role
   *
   * @param {string} roleId - Role ID
   * @returns {number} Number of bindings deleted
   */
  const deleteBindingsForRole = (roleId) => {
    const bindings = getBindingsByRole(roleId)
    let count = 0

    for (const binding of bindings) {
      if (deleteBinding(binding.id)) {
        count++
      }
    }

    return count
  }

  /**
   * Clears all RoleBindings
   */
  const clearBindings = () => {
    state.bindings = []
    state.bindingsById = {}
    state.bindingsByThing = {}
    state.bindingsByRole = {}
    state.bindingsByPrism = {}
    state.error = null
  }

  /**
   * Exports all RoleBindings to JSON
   *
   * @returns {Object[]} JSON array
   */
  const exportBindings = () => {
    return state.bindings.map(serializeRoleBinding)
  }

  /**
   * Imports RoleBindings from JSON
   *
   * @param {Object[]} json - JSON array
   */
  const importBindings = (json) => {
    try {
      state.loading = true
      state.error = null

      clearBindings()

      for (const bindingJson of json) {
        const binding = deserializeRoleBinding(bindingJson)
        addBindingToState(binding)
      }

      state.loading = false
    } catch (err) {
      state.error = err.message
      state.loading = false
      throw err
    }
  }

  /**
   * Finds RoleBindings by predicate
   *
   * @param {(binding: import('@/models/RoleBinding').RoleBinding) => boolean} predicate - Filter function
   * @returns {import('@/models/RoleBinding').RoleBinding[]} Matching bindings
   */
  const findBindings = (predicate) => {
    return state.bindings.filter(predicate)
  }

  /**
   * Gets attribute value from a Thing's RoleBinding
   *
   * @param {string} thingId - Thing ID
   * @param {string} roleId - Role ID
   * @param {string} attributeName - Attribute name
   * @returns {any} Attribute value
   */
  const getThingAttribute = (thingId, roleId, attributeName) => {
    const binding = getBindingByThingAndRole(thingId, roleId)
    if (!binding) {
      return undefined
    }
    return getRoleBindingAttribute(binding, attributeName)
  }

  /**
   * Gets all attributes from a Thing's RoleBinding
   *
   * @param {string} thingId - Thing ID
   * @param {string} roleId - Role ID
   * @returns {Object<string, any> | undefined} All attributes
   */
  const getThingAttributes = (thingId, roleId) => {
    const binding = getBindingByThingAndRole(thingId, roleId)
    if (!binding) {
      return undefined
    }
    return getRoleBindingAttributes(binding)
  }

  return {
    // State (getters)
    allBindings,
    bindingCount,
    validBindings,
    invalidBindings,
    isLoading,
    error,

    // Getters
    getBindingById,
    getBindingsByThing,
    getBindingsByRole,
    getBindingsByPrism,
    getBindingByThingAndRole,
    hasRole,
    hasBinding,

    // Actions
    createNewBinding,
    createValidatedBinding,
    updateBindingAttributes,
    invalidateBinding,
    deleteBinding,
    deleteBindingsForThing,
    deleteBindingsForRole,
    clearBindings,
    exportBindings,
    importBindings,
    findBindings,
    getThingAttribute,
    getThingAttributes
  }
}

// Export default for easier imports
export default useRoleBindingStore
