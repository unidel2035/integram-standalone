/**
 * Prism Store - Role-Sets Paradigm State Management
 *
 * Manages Prisms and Roles in the application state.
 *
 * This store follows Role-Sets principles:
 * 1. Prisms are first-class contexts with their own vocabulary
 * 2. Roles belong to Prisms and define contracts
 * 3. Prisms and Roles evolve by versioning, not schema migrations
 *
 * @see /docs/conceptual-framework/role-sets-theory.md
 * @see /docs/conceptual-framework/plain-models-architecture.md
 */

import { reactive, computed } from 'vue'
import {
  createPrism,
  isValidPrism,
  updatePrism,
  versionPrism,
  addInvariant as addPrismInvariant,
  addOperation as addPrismOperation,
  serializePrism,
  deserializePrism
} from '@/models/Prism'
import {
  createRole,
  isValidRole,
  updateRole,
  versionRole,
  addAttribute,
  addInvariant as addRoleInvariant,
  addOperation as addRoleOperation,
  serializeRole,
  deserializeRole
} from '@/models/Role'

// State
const state = reactive({
  prisms: [], // Array of Prism objects
  prismsById: {}, // Map of Prism.id -> Prism
  prismsByName: {}, // Map of Prism.name -> Prism (for unique names)

  roles: [], // Array of Role objects
  rolesById: {}, // Map of Role.id -> Role
  rolesByPrism: {}, // Map of Prism.id -> Array of Role objects

  loading: false,
  error: null
})

/**
 * Prism Store composable
 *
 * @returns {Object} Store API
 */
export const usePrismStore = () => {
  // Getters - Prisms
  const allPrisms = computed(() => state.prisms)
  const prismCount = computed(() => state.prisms.length)
  const isLoading = computed(() => state.loading)
  const error = computed(() => state.error)

  /**
   * Gets a Prism by ID
   *
   * @param {string} id - Prism ID
   * @returns {import('@/models/Prism').Prism | undefined} The Prism
   */
  const getPrismById = (id) => {
    return state.prismsById[id]
  }

  /**
   * Gets a Prism by name
   *
   * @param {string} name - Prism name
   * @returns {import('@/models/Prism').Prism | undefined} The Prism
   */
  const getPrismByName = (name) => {
    return state.prismsByName[name]
  }

  /**
   * Checks if a Prism exists
   *
   * @param {string} id - Prism ID
   * @returns {boolean} True if Prism exists
   */
  const hasPrism = (id) => {
    return id in state.prismsById
  }

  // Getters - Roles
  const allRoles = computed(() => state.roles)
  const roleCount = computed(() => state.roles.length)

  /**
   * Gets a Role by ID
   *
   * @param {string} id - Role ID
   * @returns {import('@/models/Role').Role | undefined} The Role
   */
  const getRoleById = (id) => {
    return state.rolesById[id]
  }

  /**
   * Gets all Roles for a Prism
   *
   * @param {string} prismId - Prism ID
   * @returns {import('@/models/Role').Role[]} Array of Roles
   */
  const getRolesByPrism = (prismId) => {
    return state.rolesByPrism[prismId] || []
  }

  /**
   * Gets a Role by Prism and Role name
   *
   * @param {string} prismId - Prism ID
   * @param {string} roleName - Role name
   * @returns {import('@/models/Role').Role | undefined} The Role
   */
  const getRoleByName = (prismId, roleName) => {
    const roles = getRolesByPrism(prismId)
    return roles.find((r) => r.name === roleName)
  }

  /**
   * Checks if a Role exists
   *
   * @param {string} id - Role ID
   * @returns {boolean} True if Role exists
   */
  const hasRole = (id) => {
    return id in state.rolesById
  }

  // Actions - Prisms

  /**
   * Creates a new Prism
   *
   * @param {import('@/models/Prism').PrismCreateOptions} options - Creation options
   * @returns {import('@/models/Prism').Prism} The created Prism
   */
  const createNewPrism = (options) => {
    try {
      state.error = null

      // Check for duplicate name
      if (options.name && state.prismsByName[options.name]) {
        throw new Error(`Prism with name '${options.name}' already exists`)
      }

      const prism = createPrism(options)

      // Add to state
      state.prisms.push(prism)
      state.prismsById[prism.id] = prism
      state.prismsByName[prism.name] = prism
      state.rolesByPrism[prism.id] = []

      return prism
    } catch (err) {
      state.error = err.message
      throw err
    }
  }

  /**
   * Updates a Prism
   *
   * @param {string} id - Prism ID
   * @param {Partial<import('@/models/Prism').PrismCreateOptions>} updates - Updates
   * @returns {import('@/models/Prism').Prism | null} Updated Prism
   */
  const updatePrismData = (id, updates) => {
    try {
      state.error = null

      const prism = state.prismsById[id]
      if (!prism) {
        throw new Error(`Prism with id ${id} not found`)
      }

      // Check for name conflict if name is being changed
      if (updates.name && updates.name !== prism.name && state.prismsByName[updates.name]) {
        throw new Error(`Prism with name '${updates.name}' already exists`)
      }

      const updated = updatePrism(prism, updates)

      // Update in state
      const index = state.prisms.findIndex((p) => p.id === id)
      if (index !== -1) {
        state.prisms[index] = updated
      }
      state.prismsById[id] = updated

      // Update name index if name changed
      if (updates.name && updates.name !== prism.name) {
        delete state.prismsByName[prism.name]
        state.prismsByName[updated.name] = updated
      }

      return updated
    } catch (err) {
      state.error = err.message
      return null
    }
  }

  /**
   * Creates a new version of a Prism
   *
   * @param {string} id - Prism ID
   * @param {Partial<import('@/models/Prism').PrismCreateOptions>} changes - Changes
   * @returns {import('@/models/Prism').Prism | null} New Prism version
   */
  const createPrismVersion = (id, changes = {}) => {
    try {
      state.error = null

      const prism = state.prismsById[id]
      if (!prism) {
        throw new Error(`Prism with id ${id} not found`)
      }

      const newVersion = versionPrism(prism, changes)

      // Add new version to state
      state.prisms.push(newVersion)
      state.prismsById[newVersion.id] = newVersion
      // Note: Name index points to latest version
      state.prismsByName[newVersion.name] = newVersion
      state.rolesByPrism[newVersion.id] = []

      return newVersion
    } catch (err) {
      state.error = err.message
      return null
    }
  }

  /**
   * Deletes a Prism and all its Roles
   *
   * @param {string} id - Prism ID
   * @returns {boolean} True if deleted
   */
  const deletePrism = (id) => {
    try {
      state.error = null

      const prism = state.prismsById[id]
      if (!prism) {
        throw new Error(`Prism with id ${id} not found`)
      }

      // Delete all roles for this prism
      const roles = state.rolesByPrism[id] || []
      for (const role of roles) {
        deleteRole(role.id)
      }

      // Remove from state
      const index = state.prisms.findIndex((p) => p.id === id)
      if (index !== -1) {
        state.prisms.splice(index, 1)
      }

      delete state.prismsById[id]
      delete state.prismsByName[prism.name]
      delete state.rolesByPrism[id]

      return true
    } catch (err) {
      state.error = err.message
      return false
    }
  }

  // Actions - Roles

  /**
   * Creates a new Role
   *
   * @param {import('@/models/Role').RoleCreateOptions} options - Creation options
   * @returns {import('@/models/Role').Role} The created Role
   */
  const createNewRole = (options) => {
    try {
      state.error = null

      // Verify prism exists
      if (!hasPrism(options.prismId)) {
        throw new Error(`Prism with id ${options.prismId} not found`)
      }

      // Check for duplicate name within prism
      const existing = getRoleByName(options.prismId, options.name)
      if (existing) {
        throw new Error(`Role '${options.name}' already exists in prism ${options.prismId}`)
      }

      const role = createRole(options)

      // Add to state
      state.roles.push(role)
      state.rolesById[role.id] = role

      if (!state.rolesByPrism[role.prismId]) {
        state.rolesByPrism[role.prismId] = []
      }
      state.rolesByPrism[role.prismId].push(role)

      return role
    } catch (err) {
      state.error = err.message
      throw err
    }
  }

  /**
   * Updates a Role
   *
   * @param {string} id - Role ID
   * @param {Partial<import('@/models/Role').RoleCreateOptions>} updates - Updates
   * @returns {import('@/models/Role').Role | null} Updated Role
   */
  const updateRoleData = (id, updates) => {
    try {
      state.error = null

      const role = state.rolesById[id]
      if (!role) {
        throw new Error(`Role with id ${id} not found`)
      }

      const updated = updateRole(role, updates)

      // Update in state
      const index = state.roles.findIndex((r) => r.id === id)
      if (index !== -1) {
        state.roles[index] = updated
      }
      state.rolesById[id] = updated

      // Update in prism's role list
      const prismRoles = state.rolesByPrism[role.prismId]
      if (prismRoles) {
        const roleIndex = prismRoles.findIndex((r) => r.id === id)
        if (roleIndex !== -1) {
          prismRoles[roleIndex] = updated
        }
      }

      return updated
    } catch (err) {
      state.error = err.message
      return null
    }
  }

  /**
   * Creates a new version of a Role
   *
   * @param {string} id - Role ID
   * @param {Partial<import('@/models/Role').RoleCreateOptions>} changes - Changes
   * @returns {import('@/models/Role').Role | null} New Role version
   */
  const createRoleVersion = (id, changes = {}) => {
    try {
      state.error = null

      const role = state.rolesById[id]
      if (!role) {
        throw new Error(`Role with id ${id} not found`)
      }

      const newVersion = versionRole(role, changes)

      // Add new version to state
      state.roles.push(newVersion)
      state.rolesById[newVersion.id] = newVersion

      if (!state.rolesByPrism[newVersion.prismId]) {
        state.rolesByPrism[newVersion.prismId] = []
      }
      state.rolesByPrism[newVersion.prismId].push(newVersion)

      return newVersion
    } catch (err) {
      state.error = err.message
      return null
    }
  }

  /**
   * Deletes a Role
   *
   * @param {string} id - Role ID
   * @returns {boolean} True if deleted
   */
  const deleteRole = (id) => {
    try {
      state.error = null

      const role = state.rolesById[id]
      if (!role) {
        throw new Error(`Role with id ${id} not found`)
      }

      // Remove from state
      const index = state.roles.findIndex((r) => r.id === id)
      if (index !== -1) {
        state.roles.splice(index, 1)
      }

      delete state.rolesById[id]

      // Remove from prism's role list
      const prismRoles = state.rolesByPrism[role.prismId]
      if (prismRoles) {
        const roleIndex = prismRoles.findIndex((r) => r.id === id)
        if (roleIndex !== -1) {
          prismRoles.splice(roleIndex, 1)
        }
      }

      return true
    } catch (err) {
      state.error = err.message
      return false
    }
  }

  // Utility Actions

  /**
   * Clears all Prisms and Roles
   */
  const clearAll = () => {
    state.prisms = []
    state.prismsById = {}
    state.prismsByName = {}
    state.roles = []
    state.rolesById = {}
    state.rolesByPrism = {}
    state.error = null
  }

  /**
   * Exports all Prisms and Roles to JSON
   *
   * @returns {{prisms: Object[], roles: Object[]}} JSON data
   */
  const exportAll = () => {
    return {
      prisms: state.prisms.map(serializePrism),
      roles: state.roles.map(serializeRole)
    }
  }

  /**
   * Imports Prisms and Roles from JSON
   *
   * @param {{prisms: Object[], roles: Object[]}} data - JSON data
   */
  const importAll = (data) => {
    try {
      state.loading = true
      state.error = null

      clearAll()

      // Import prisms first
      for (const prismJson of data.prisms || []) {
        const prism = deserializePrism(prismJson)
        state.prisms.push(prism)
        state.prismsById[prism.id] = prism
        state.prismsByName[prism.name] = prism
        state.rolesByPrism[prism.id] = []
      }

      // Then import roles
      for (const roleJson of data.roles || []) {
        const role = deserializeRole(roleJson)
        state.roles.push(role)
        state.rolesById[role.id] = role

        if (state.rolesByPrism[role.prismId]) {
          state.rolesByPrism[role.prismId].push(role)
        }
      }

      state.loading = false
    } catch (err) {
      state.error = err.message
      state.loading = false
      throw err
    }
  }

  return {
    // State (getters)
    allPrisms,
    prismCount,
    allRoles,
    roleCount,
    isLoading,
    error,

    // Getters - Prisms
    getPrismById,
    getPrismByName,
    hasPrism,

    // Getters - Roles
    getRoleById,
    getRolesByPrism,
    getRoleByName,
    hasRole,

    // Actions - Prisms
    createNewPrism,
    updatePrismData,
    createPrismVersion,
    deletePrism,

    // Actions - Roles
    createNewRole,
    updateRoleData,
    createRoleVersion,
    deleteRole,

    // Utility Actions
    clearAll,
    exportAll,
    importAll
  }
}

// Export default for easier imports
export default usePrismStore
