/**
 * useThingNodes Composable - Role-Sets for Flow Editor
 *
 * This composable provides a bridge between Flow2.vue's current implementation
 * and the Role-Sets paradigm. It allows gradual migration while demonstrating
 * the correct architecture.
 *
 * Core Concepts:
 * - Nodes are Things (ID only)
 * - Attributes come from RoleBindings in FlowEditor prism
 * - Visual properties (position, style) separate from conceptual model
 * - Multi-prism capability for viewing same Thing in different contexts
 *
 * @see Issue #1992 - Attributes on Nodes Anti-Pattern
 */

import { ref, computed, watch } from 'vue'
import { flowEditorPrismService } from '@/services/flowEditorPrismService'

/**
 * useThingNodes - Composable for Thing-based flow nodes
 *
 * @returns {Object} API for managing Thing-based nodes
 */
export function useThingNodes() {
  // State
  const things = ref([]) // Array of Thing objects (ID only)
  const bindings = ref([]) // Array of RoleBindings (witnesses with attributes)
  const visualProps = ref([]) // Array of visual properties (position, style)
  const prismInfo = ref(null)
  const isInitialized = ref(false)
  const error = ref(null)

  // Current prism (for multi-prism view support)
  const currentPrismId = ref(null)

  /**
   * Initialize the FlowEditor prism
   */
  async function initialize() {
    try {
      error.value = null
      const info = await flowEditorPrismService.initialize()
      prismInfo.value = info
      currentPrismId.value = info.prism.id
      isInitialized.value = true
      return info
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  /**
   * Create a new Thing-based node
   *
   * @param {string} roleName - Role name (TableNode, ColumnNode, etc.)
   * @param {Object} attributes - Node attributes (for witness)
   * @param {Object} visualProperties - Visual properties (position, etc.)
   * @returns {Promise<Object>} Created node info
   */
  async function createThingNode(roleName, attributes, visualProperties = {}) {
    try {
      error.value = null

      const result = await flowEditorPrismService.createNode(
        roleName,
        attributes,
        visualProperties
      )

      // Add to local state
      things.value.push(result.thing)
      bindings.value.push(result.binding)
      visualProps.value.push({
        thingId: result.thing.id,
        ...result.visualProps
      })

      return result
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  /**
   * Get node by Thing ID
   * Returns Thing + attributes from current prism
   */
  async function getNodeById(thingId) {
    try {
      error.value = null
      return await flowEditorPrismService.getNodeByThingId(thingId)
    } catch (err) {
      error.value = err.message
      return null
    }
  }

  /**
   * Update node attributes
   * Updates witness in RoleBinding
   */
  async function updateNodeAttributes(thingId, newAttributes) {
    try {
      error.value = null
      const updatedBinding = await flowEditorPrismService.updateNodeAttributes(
        thingId,
        newAttributes
      )

      // Update local binding
      const index = bindings.value.findIndex(
        b => b.thingId === thingId && b.prismId === currentPrismId.value
      )
      if (index !== -1) {
        bindings.value[index] = updatedBinding
      }

      return updatedBinding
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  /**
   * Update visual properties (position, style)
   * Note: Visual props are NOT part of the conceptual model
   */
  function updateVisualProps(thingId, newProps) {
    const index = visualProps.value.findIndex(v => v.thingId === thingId)
    if (index !== -1) {
      visualProps.value[index] = {
        ...visualProps.value[index],
        ...newProps
      }
    } else {
      visualProps.value.push({ thingId, ...newProps })
    }
  }

  /**
   * Delete node
   */
  async function deleteNode(thingId) {
    try {
      error.value = null
      await flowEditorPrismService.deleteNode(thingId)

      // Remove from local state
      things.value = things.value.filter(t => t.id !== thingId)
      bindings.value = bindings.value.filter(b => b.thingId !== thingId)
      visualProps.value = visualProps.value.filter(v => v.thingId !== thingId)
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  /**
   * Convert legacy node to Thing-based node
   * Bridges from anti-pattern to Role-Sets
   */
  async function convertLegacyNode(legacyNode) {
    try {
      error.value = null
      return await flowEditorPrismService.migrateLegacyNode(legacyNode)
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  /**
   * Bulk convert legacy nodes
   */
  async function bulkConvertLegacyNodes(legacyNodes) {
    try {
      error.value = null
      return await flowEditorPrismService.bulkMigrateLegacyNodes(legacyNodes)
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  /**
   * Get renderable nodes for current prism
   * Combines Things, RoleBindings (attributes), and visual props
   *
   * This is the key method that demonstrates how attributes come from prisms!
   */
  const renderableNodes = computed(() => {
    if (!currentPrismId.value) return []

    return things.value.map(thing => {
      // Find binding for this Thing in current prism
      const binding = bindings.value.find(
        b => b.thingId === thing.id && b.prismId === currentPrismId.value
      )

      // Find visual props
      const visual = visualProps.value.find(v => v.thingId === thing.id) || {}

      // Combine: Thing (ID only) + attributes from prism + visual props
      return {
        id: thing.id, // Thing ID
        // Attributes come from RoleBinding witness (NOT from Thing!)
        data: binding?.proof?.attributes || {},
        // Visual properties (separate from conceptual model)
        position: visual.position || { x: 0, y: 0 },
        type: 'customNode', // Vue Flow node type
        // Metadata
        _thing: thing,
        _binding: binding,
        _prism: currentPrismId.value,
        _role: binding?.roleId
      }
    })
  })

  /**
   * Change current prism (for multi-prism view)
   * This demonstrates how same Thing can have different attributes in different prisms!
   */
  function switchPrism(newPrismId) {
    currentPrismId.value = newPrismId
    // renderableNodes will automatically update to show attributes from new prism
  }

  /**
   * Get available prisms for a Thing
   * Shows all prisms in which this Thing has roles
   */
  async function getPrismsForThing(thingId) {
    try {
      const allBindings = await flowEditorPrismService.roleSetService.getRoleBindingsByThing(
        thingId
      )
      const prismIds = [...new Set(allBindings.map(b => b.prismId))]

      const prisms = await Promise.all(
        prismIds.map(id => flowEditorPrismService.roleSetService.getPrism(id))
      )

      return prisms
    } catch (err) {
      error.value = err.message
      return []
    }
  }

  /**
   * Demonstrate polymorphy: Add same Thing to multiple prisms
   *
   * This shows how a Thing can play different roles in different contexts!
   */
  async function addThingToAnotherPrism(thingId, targetPrismId, targetRoleId, attributes) {
    try {
      error.value = null

      // Create new RoleBinding in target prism
      const newBinding = await flowEditorPrismService.roleSetService.createRoleBinding({
        thingId,
        prismId: targetPrismId,
        roleId: targetRoleId,
        attributes,
        explanation: `Same Thing in different prism: ${targetPrismId}`
      })

      // Add to local bindings
      bindings.value.push(newBinding)

      return newBinding
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  return {
    // State
    things,
    bindings,
    visualProps,
    prismInfo,
    isInitialized,
    error,
    currentPrismId,

    // Computed
    renderableNodes,

    // Actions
    initialize,
    createThingNode,
    getNodeById,
    updateNodeAttributes,
    updateVisualProps,
    deleteNode,
    convertLegacyNode,
    bulkConvertLegacyNodes,
    switchPrism,
    getPrismsForThing,
    addThingToAnotherPrism
  }
}

export default useThingNodes
