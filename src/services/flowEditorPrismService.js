/**
 * Flow Editor Prism Service - Role-Sets Implementation
 *
 * This service implements the Role-Sets paradigm for Flow Editor nodes.
 * It ensures that nodes are represented as Things (ID only), with all
 * attributes coming from RoleBindings within the FlowEditor prism.
 *
 * Core Principles:
 * 1. Nodes are Things with ID only
 * 2. Attributes belong to prisms (via RoleBindings), not objects
 * 3. Same Thing can be viewed through multiple prisms
 * 4. Evolution without schema migrations
 *
 * @see Issue #1992 - [CRITICAL] Attributes on Nodes (Anti-Pattern)
 * @see /CLAUDE.md - Flow Editor Development Guidelines
 */

import { roleSetService } from '@/services/roleSetService'
import { v4 as uuidv4 } from '@/utils/uuid'
import { logger } from '@/utils/logger'

/**
 * FlowEditor Prism Definition
 * Represents the visual flow editing context with its roles
 */
export const FLOW_EDITOR_PRISM = {
  name: 'FlowEditor',
  description: 'Visual flow editing context for data transformation pipelines',
  metadata: {
    dsl: 'Visual flow language for data pipelines',
    invariants: [
      'All nodes must have valid IDs',
      'Connected nodes must exist',
      'No circular dependencies in flow'
    ],
    operations: ['addNode', 'removeNode', 'connectNodes', 'disconnectNodes', 'arrangeLayout']
  }
}

/**
 * FlowEditor Role Definitions
 * Each role defines a contract for different types of nodes
 */
export const FLOW_EDITOR_ROLES = {
  TableNode: {
    name: 'TableNode',
    description: 'Represents a data table/source in the flow',
    contract: {
      attributes: {
        label: { type: 'string', required: true },
        type: { type: 'string', required: true },
        tableId: { type: 'string', required: true },
        name: { type: 'string', required: true }
      },
      invariants: ['label.length > 0', 'type === "table"'],
      operations: {}
    }
  },

  ColumnNode: {
    name: 'ColumnNode',
    description: 'Represents a column within a table',
    contract: {
      attributes: {
        label: { type: 'string', required: true },
        type: { type: 'string', required: true },
        tableId: { type: 'string', required: true },
        field: { type: 'string', required: true }
      },
      invariants: ['label.length > 0', 'type === "column"'],
      operations: {}
    }
  },

  FilterNode: {
    name: 'FilterNode',
    description: 'Represents a filter/predicate in the flow',
    contract: {
      attributes: {
        label: { type: 'string', required: true },
        type: { type: 'string', required: true },
        filterId: { type: 'string', required: true },
        connectedColumnId: { type: 'string', required: false }
      },
      invariants: ['label.length > 0', 'type === "filter"'],
      operations: {}
    }
  },

  TransformationNode: {
    name: 'TransformationNode',
    description: 'Represents a data transformation operation',
    contract: {
      attributes: {
        label: { type: 'string', required: true },
        type: { type: 'string', required: true },
        transformationId: { type: 'string', required: true },
        transformationType: { type: 'string', required: true }
      },
      invariants: ['label.length > 0', 'type === "transformation"'],
      operations: {}
    }
  },

  FinalNode: {
    name: 'FinalNode',
    description: 'Represents the final output/result node',
    contract: {
      attributes: {
        label: { type: 'string', required: true },
        type: { type: 'string', required: true },
        finalBlockId: { type: 'string', required: true }
      },
      invariants: ['label.length > 0', 'type === "final"'],
      operations: {}
    }
  }
}

/**
 * FlowEditor Prism Service Class
 * Manages Thing-based nodes with RoleBindings
 */
class FlowEditorPrismService {
  constructor() {
    this.prism = null
    this.roles = {}
    this.initialized = false
  }

  /**
   * Initialize FlowEditor prism and roles
   * Creates prism and roles if they don't exist
   *
   * @returns {Promise<{prism: Object, roles: Object}>}
   */
  async initialize() {
    if (this.initialized) {
      return { prism: this.prism, roles: this.roles }
    }

    try {
      // Get or create FlowEditor prism
      const allPrisms = await roleSetService.getAllPrisms()
      let prism = allPrisms.find(p => p.name === FLOW_EDITOR_PRISM.name)

      if (!prism) {
        logger.info('Creating FlowEditor prism...')
        prism = await roleSetService.createPrism(FLOW_EDITOR_PRISM)
      }

      this.prism = prism

      // Get or create roles
      const existingRoles = await roleSetService.getRolesByPrism(prism.id)

      for (const [roleName, roleDefinition] of Object.entries(FLOW_EDITOR_ROLES)) {
        let role = existingRoles.find(r => r.name === roleName)

        if (!role) {
          logger.info(`Creating role: ${roleName}`)
          role = await roleSetService.createRole(prism.id, roleDefinition)
        }

        this.roles[roleName] = role
      }

      this.initialized = true
      logger.info('FlowEditor prism initialized', { prism, roles: this.roles })

      return { prism: this.prism, roles: this.roles }
    } catch (error) {
      console.error('Failed to initialize FlowEditor prism:', error)
      throw error
    }
  }

  /**
   * Create a Thing-based node with RoleBinding
   *
   * @param {string} roleName - Name of the role (TableNode, ColumnNode, etc.)
   * @param {Object} attributes - Attributes for the witness
   * @param {Object} visualProps - Visual properties (position, etc.) - NOT part of witness
   * @returns {Promise<{thing: Object, binding: Object, visualProps: Object}>}
   */
  async createNode(roleName, attributes, visualProps = {}) {
    if (!this.initialized) {
      await this.initialize()
    }

    const role = this.roles[roleName]
    if (!role) {
      throw new Error(`Role ${roleName} not found in FlowEditor prism`)
    }

    try {
      // Create Thing (ID only)
      const thing = await roleSetService.createThing()

      // Create RoleBinding with witness (attributes)
      const binding = await roleSetService.createRoleBinding({
        thingId: thing.id,
        prismId: this.prism.id,
        roleId: role.id,
        attributes,
        explanation: `${roleName} in FlowEditor: ${attributes.label || 'unnamed'}`
      })

      return {
        thing,
        binding,
        visualProps // Position, style, etc. - separate from conceptual model
      }
    } catch (error) {
      console.error(`Failed to create ${roleName} node:`, error)
      throw error
    }
  }

  /**
   * Get node data by Thing ID
   * Retrieves Thing and all its RoleBindings in FlowEditor prism
   *
   * @param {string} thingId - Thing ID
   * @returns {Promise<{thing: Object, bindings: Object[], attributes: Object}>}
   */
  async getNodeByThingId(thingId) {
    if (!this.initialized) {
      await this.initialize()
    }

    try {
      const thing = await roleSetService.getThing(thingId)
      const allBindings = await roleSetService.getRoleBindingsByThing(thingId)

      // Filter for FlowEditor prism bindings
      const flowEditorBindings = allBindings.filter(b => b.prismId === this.prism.id)

      // Extract attributes from first binding (nodes typically have one role)
      const primaryBinding = flowEditorBindings[0]
      const attributes = primaryBinding?.proof?.attributes || {}

      return {
        thing,
        bindings: flowEditorBindings,
        attributes,
        binding: primaryBinding
      }
    } catch (error) {
      console.error(`Failed to get node for Thing ${thingId}:`, error)
      throw error
    }
  }

  /**
   * Update node attributes (updates RoleBinding witness)
   *
   * @param {string} thingId - Thing ID
   * @param {Object} newAttributes - New attributes (partial update)
   * @returns {Promise<Object>} Updated binding
   */
  async updateNodeAttributes(thingId, newAttributes) {
    if (!this.initialized) {
      await this.initialize()
    }

    try {
      const { binding } = await this.getNodeByThingId(thingId)

      if (!binding) {
        throw new Error(`No binding found for Thing ${thingId} in FlowEditor prism`)
      }

      // Merge existing attributes with new ones
      const updatedAttributes = {
        ...binding.proof.attributes,
        ...newAttributes
      }

      const updatedBinding = await roleSetService.updateRoleBinding(binding.id, {
        attributes: updatedAttributes
      })

      return updatedBinding
    } catch (error) {
      console.error(`Failed to update attributes for Thing ${thingId}:`, error)
      throw error
    }
  }

  /**
   * Delete node (deletes Thing and all its RoleBindings)
   *
   * @param {string} thingId - Thing ID
   * @returns {Promise<void>}
   */
  async deleteNode(thingId) {
    if (!this.initialized) {
      await this.initialize()
    }

    try {
      // Get all bindings for this Thing
      const allBindings = await roleSetService.getRoleBindingsByThing(thingId)

      // Delete all bindings
      for (const binding of allBindings) {
        await roleSetService.deleteRoleBinding(binding.id)
      }

      // Delete Thing
      await roleSetService.deleteThing(thingId)
    } catch (error) {
      console.error(`Failed to delete Thing ${thingId}:`, error)
      throw error
    }
  }

  /**
   * Convert legacy node to Thing-based node
   * Migrates from anti-pattern (attributes on node) to Role-Sets paradigm
   *
   * @param {Object} legacyNode - Legacy node with attributes directly on it
   * @returns {Promise<{thing: Object, binding: Object}>}
   */
  async migrateLegacyNode(legacyNode) {
    if (!this.initialized) {
      await this.initialize()
    }

    // Determine role based on node type
    const typeToRole = {
      table: 'TableNode',
      column: 'ColumnNode',
      filter: 'FilterNode',
      transformation: 'TransformationNode',
      final: 'FinalNode'
    }

    const roleName = typeToRole[legacyNode.data?.type]
    if (!roleName) {
      throw new Error(`Unknown node type: ${legacyNode.data?.type}`)
    }

    // Extract attributes from legacy node.data
    const { type, label, ...otherAttributes } = legacyNode.data || {}
    const attributes = { type, label, ...otherAttributes }

    // Extract visual properties (position, etc.)
    const visualProps = {
      position: legacyNode.position,
      id: legacyNode.id // Keep original ID for reference
    }

    return await this.createNode(roleName, attributes, visualProps)
  }

  /**
   * Bulk migrate legacy nodes
   *
   * @param {Array<Object>} legacyNodes - Array of legacy nodes
   * @returns {Promise<Array<{thing, binding, visualProps, legacyId}>>}
   */
  async bulkMigrateLegacyNodes(legacyNodes) {
    const results = []
    const idMapping = new Map() // legacyId -> thingId

    for (const legacyNode of legacyNodes) {
      try {
        const result = await this.migrateLegacyNode(legacyNode)
        idMapping.set(legacyNode.id, result.thing.id)
        results.push({
          ...result,
          legacyId: legacyNode.id
        })
      } catch (error) {
        console.error(`Failed to migrate node ${legacyNode.id}:`, error)
        // Continue with other nodes
      }
    }

    return {
      migratedNodes: results,
      idMapping
    }
  }

  /**
   * Get prism information
   */
  getPrismInfo() {
    return {
      prism: this.prism,
      roles: this.roles,
      initialized: this.initialized
    }
  }
}

// Export singleton instance
export const flowEditorPrismService = new FlowEditorPrismService()

// Also export class for testing
export { FlowEditorPrismService }

export default flowEditorPrismService
