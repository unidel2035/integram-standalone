/**
 * Role-Sets Service - Frontend API Client
 *
 * Connects frontend flow editor to backend Role-Sets API.
 * Provides convenient methods for Thing, Prism, Role, RoleBinding, and PQ operations.
 *
 * Usage:
 * import { roleSetService } from '@/services/roleSetService'
 *
 * const thing = await roleSetService.createThing()
 * const prism = await roleSetService.createPrism({ name: 'Commerce', ... })
 * const result = await roleSetService.executePQ('FROM Commerce.Product WHERE price > 1000')
 *
 * @see /backend/monolith/src/api/routes/role-sets.js - Backend API
 * @see /docs/conceptual-framework/role-sets-theory.md
 */

import axios from 'axios'

// API base URL from environment (defaults to orchestrator URL)
// Note: VITE_ORCHESTRATOR_URL should be the base server URL (e.g., https://dev.drondoc.ru)
// We append '/api' to construct the full API path
const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL
const API_BASE_URL = ORCHESTRATOR_URL ? `${ORCHESTRATOR_URL}/api` : '/api'
const ROLE_SETS_BASE = `${API_BASE_URL}/role-sets`

/**
 * API Error class
 */
export class RoleSetAPIError extends Error {
  constructor(message, response) {
    super(message)
    this.name = 'RoleSetAPIError'
    this.response = response
    this.details = response?.data?.details
  }
}

/**
 * Handle API errors
 */
function handleError(error, operation) {
  console.error(`RoleSetService error in ${operation}:`, error)

  if (error.response) {
    // API returned error response
    const status = error.response.status
    const message = error.response.data?.error || error.message

    // Provide more helpful error messages for common status codes
    if (status === 404) {
      throw new RoleSetAPIError(
        `${operation} failed: Backend endpoint not found. Please ensure the backend server is running.`,
        error.response
      )
    } else if (status === 500) {
      throw new RoleSetAPIError(
        `${operation} failed: Internal server error. Check backend logs.`,
        error.response
      )
    } else {
      throw new RoleSetAPIError(
        `${operation} failed: ${message}`,
        error.response
      )
    }
  } else if (error.request) {
    // Request made but no response
    throw new RoleSetAPIError(
      `${operation} failed: Cannot connect to backend server. Please check if the backend is running on ${ROLE_SETS_BASE}`,
      { data: { error: 'Network error' } }
    )
  } else {
    // Error setting up request
    throw error
  }
}

/**
 * Role-Sets Service
 */
class RoleSetService {
  // ========================================
  // Thing Operations
  // ========================================

  /**
   * Get all Things
   */
  async getAllThings(options = {}) {
    try {
      const { limit, offset } = options
      const params = {}
      if (limit) params.limit = limit
      if (offset) params.offset = offset

      const response = await axios.get(`${ROLE_SETS_BASE}/things`, { params })
      return response.data.data
    } catch (error) {
      handleError(error, 'getAllThings')
    }
  }

  /**
   * Get Thing by ID
   */
  async getThing(id) {
    try {
      const response = await axios.get(`${ROLE_SETS_BASE}/things/${id}`)
      return response.data.data
    } catch (error) {
      handleError(error, 'getThing')
    }
  }

  /**
   * Create new Thing
   */
  async createThing(options = {}) {
    try {
      const response = await axios.post(`${ROLE_SETS_BASE}/things`, options)
      return response.data.data
    } catch (error) {
      handleError(error, 'createThing')
    }
  }

  /**
   * Delete Thing
   */
  async deleteThing(id) {
    try {
      const response = await axios.delete(`${ROLE_SETS_BASE}/things/${id}`)
      return response.data
    } catch (error) {
      handleError(error, 'deleteThing')
    }
  }

  // ========================================
  // Prism Operations
  // ========================================

  /**
   * Get all Prisms
   */
  async getAllPrisms() {
    try {
      const response = await axios.get(`${ROLE_SETS_BASE}/prisms`)
      return response.data.data
    } catch (error) {
      handleError(error, 'getAllPrisms')
    }
  }

  /**
   * Get Prism by ID
   */
  async getPrism(id) {
    try {
      const response = await axios.get(`${ROLE_SETS_BASE}/prisms/${id}`)
      return response.data.data
    } catch (error) {
      handleError(error, 'getPrism')
    }
  }

  /**
   * Create new Prism
   */
  async createPrism(options) {
    try {
      const response = await axios.post(`${ROLE_SETS_BASE}/prisms`, options)
      return response.data.data
    } catch (error) {
      handleError(error, 'createPrism')
    }
  }

  /**
   * Update Prism
   */
  async updatePrism(id, updates) {
    try {
      const response = await axios.put(`${ROLE_SETS_BASE}/prisms/${id}`, updates)
      return response.data.data
    } catch (error) {
      handleError(error, 'updatePrism')
    }
  }

  /**
   * Delete Prism
   */
  async deletePrism(id) {
    try {
      const response = await axios.delete(`${ROLE_SETS_BASE}/prisms/${id}`)
      return response.data
    } catch (error) {
      handleError(error, 'deletePrism')
    }
  }

  // ========================================
  // Role Operations
  // ========================================

  /**
   * Get all Roles in a Prism
   */
  async getRolesByPrism(prismId) {
    try {
      const response = await axios.get(`${ROLE_SETS_BASE}/prisms/${prismId}/roles`)
      return response.data.data
    } catch (error) {
      handleError(error, 'getRolesByPrism')
    }
  }

  /**
   * Get Role by ID
   */
  async getRole(id) {
    try {
      const response = await axios.get(`${ROLE_SETS_BASE}/roles/${id}`)
      return response.data.data
    } catch (error) {
      handleError(error, 'getRole')
    }
  }

  /**
   * Create new Role in Prism
   */
  async createRole(prismId, options) {
    try {
      const response = await axios.post(
        `${ROLE_SETS_BASE}/prisms/${prismId}/roles`,
        options
      )
      return response.data.data
    } catch (error) {
      handleError(error, 'createRole')
    }
  }

  /**
   * Update Role
   */
  async updateRole(id, updates) {
    try {
      const response = await axios.put(`${ROLE_SETS_BASE}/roles/${id}`, updates)
      return response.data.data
    } catch (error) {
      handleError(error, 'updateRole')
    }
  }

  /**
   * Delete Role
   */
  async deleteRole(id) {
    try {
      const response = await axios.delete(`${ROLE_SETS_BASE}/roles/${id}`)
      return response.data
    } catch (error) {
      handleError(error, 'deleteRole')
    }
  }

  // ========================================
  // RoleBinding Operations (Witnesses)
  // ========================================

  /**
   * Get all RoleBindings (with optional filters)
   */
  async getAllRoleBindings(filters = {}) {
    try {
      const response = await axios.get(`${ROLE_SETS_BASE}/role-bindings`, {
        params: filters
      })
      return response.data.data
    } catch (error) {
      handleError(error, 'getAllRoleBindings')
    }
  }

  /**
   * Get RoleBinding by ID
   */
  async getRoleBinding(id) {
    try {
      const response = await axios.get(`${ROLE_SETS_BASE}/role-bindings/${id}`)
      return response.data.data
    } catch (error) {
      handleError(error, 'getRoleBinding')
    }
  }

  /**
   * Get all RoleBindings for a Thing
   */
  async getRoleBindingsByThing(thingId) {
    try {
      const response = await axios.get(
        `${ROLE_SETS_BASE}/things/${thingId}/role-bindings`
      )
      return response.data.data
    } catch (error) {
      handleError(error, 'getRoleBindingsByThing')
    }
  }

  /**
   * Create new RoleBinding (with witness validation)
   */
  async createRoleBinding(options) {
    try {
      const response = await axios.post(`${ROLE_SETS_BASE}/role-bindings`, options)
      return response.data.data
    } catch (error) {
      handleError(error, 'createRoleBinding')
    }
  }

  /**
   * Update RoleBinding (re-validates witness)
   */
  async updateRoleBinding(id, updates) {
    try {
      const response = await axios.put(
        `${ROLE_SETS_BASE}/role-bindings/${id}`,
        updates
      )
      return response.data.data
    } catch (error) {
      handleError(error, 'updateRoleBinding')
    }
  }

  /**
   * Delete RoleBinding
   */
  async deleteRoleBinding(id) {
    try {
      const response = await axios.delete(`${ROLE_SETS_BASE}/role-bindings/${id}`)
      return response.data
    } catch (error) {
      handleError(error, 'deleteRoleBinding')
    }
  }

  // ========================================
  // PQ Program Operations
  // ========================================

  /**
   * Execute PQ program
   *
   * @param {string} pq - PQ program string
   * @param {Object} options - Execution options
   * @returns {Object} Execution result with thingIds, witnesses, and trace
   */
  async executePQ(pq, options = {}) {
    try {
      const response = await axios.post(`${ROLE_SETS_BASE}/pq/execute`, {
        pq,
        options
      })
      return response.data.data
    } catch (error) {
      handleError(error, 'executePQ')
    }
  }

  /**
   * Explain PQ program (get execution plan without executing)
   *
   * @param {string} pq - PQ program string
   * @returns {Object} Explanation with AST and execution plan
   */
  async explainPQ(pq) {
    try {
      const response = await axios.post(`${ROLE_SETS_BASE}/pq/explain`, { pq })
      return response.data.data
    } catch (error) {
      handleError(error, 'explainPQ')
    }
  }

  /**
   * Validate PQ program syntax
   *
   * @param {string} pq - PQ program string
   * @returns {Object} Validation result
   */
  async validatePQ(pq) {
    try {
      const response = await axios.post(`${ROLE_SETS_BASE}/pq/validate`, { pq })
      return response.data.data
    } catch (error) {
      handleError(error, 'validatePQ')
    }
  }

  // ========================================
  // Bulk Operations
  // ========================================

  /**
   * Bulk import Things, Prisms, Roles, and RoleBindings
   */
  async bulkImport(data) {
    try {
      const response = await axios.post(`${ROLE_SETS_BASE}/bulk/import`, data)
      return response.data.data
    } catch (error) {
      handleError(error, 'bulkImport')
    }
  }

  /**
   * Bulk export all data
   */
  async bulkExport() {
    try {
      const response = await axios.get(`${ROLE_SETS_BASE}/bulk/export`)
      return response.data.data
    } catch (error) {
      handleError(error, 'bulkExport')
    }
  }

  // ========================================
  // System Info
  // ========================================

  /**
   * Get system information and statistics
   */
  async getSystemInfo() {
    try {
      const response = await axios.get(`${ROLE_SETS_BASE}/info`)
      return response.data.data
    } catch (error) {
      handleError(error, 'getSystemInfo')
    }
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Get Thing with all its role bindings (multi-prism view)
   */
  async getThingWithRoles(thingId) {
    try {
      const [thing, roleBindings] = await Promise.all([
        this.getThing(thingId),
        this.getRoleBindingsByThing(thingId)
      ])

      // Group bindings by prism
      const prismViews = {}

      for (const binding of roleBindings) {
        const prismId = binding.prismId
        if (!prismViews[prismId]) {
          const prism = await this.getPrism(prismId)
          prismViews[prismId] = {
            prism,
            roles: []
          }
        }

        const role = await this.getRole(binding.roleId)
        prismViews[prismId].roles.push({
          role,
          binding,
          attributes: binding.proof.attributes
        })
      }

      return {
        thing,
        prismViews
      }
    } catch (error) {
      handleError(error, 'getThingWithRoles')
    }
  }

  /**
   * Create Thing and bind it to a role in one operation
   */
  async createThingWithRole(prismId, roleId, attributes, explanation) {
    try {
      // Create Thing
      const thing = await this.createThing()

      // Create RoleBinding
      const binding = await this.createRoleBinding({
        thingId: thing.id,
        prismId,
        roleId,
        attributes,
        explanation
      })

      return {
        thing,
        binding
      }
    } catch (error) {
      // Cleanup: delete thing if binding creation failed
      if (error.name === 'RoleSetAPIError' && error.response?.status === 400) {
        try {
          // Only delete if Thing was created (check if thing exists)
          // This is best-effort cleanup
        } catch {
          // Ignore cleanup errors
        }
      }

      handleError(error, 'createThingWithRole')
    }
  }
}

// Export singleton instance
export const roleSetService = new RoleSetService()

// Also export class for testing
export { RoleSetService }

export default roleSetService
