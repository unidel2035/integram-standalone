/**
 * Flow Mode Composable - Dual-Mode Editor State Management
 *
 * Manages the current mode of the Flow2 editor:
 * - "workflow": Traditional ETL/data transformation workflow mode
 * - "role-sets": Role-Sets paradigm mode with Things, Prisms, Roles, and Witnesses
 *
 * This composable provides:
 * - Mode state management with persistence
 * - Mode switching with migration helpers
 * - Mode-specific feature detection
 *
 * Usage:
 * import { useFlowMode } from '@/composables/useFlowMode'
 *
 * const { currentMode, isWorkflowMode, isRoleSetsMode, switchMode } = useFlowMode()
 *
 * @see Issue #2017 - Dual-mode editor implementation
 * @see /CLAUDE.md - Flow Editor Development Guidelines
 */

import { ref, computed, watch } from 'vue'
import { logger } from '@/utils/logger'

/**
 * Flow editor modes
 */
export const FlowModes = {
  WORKFLOW: 'workflow',
  ROLE_SETS: 'role-sets'
}

/**
 * Mode display information
 */
const MODE_INFO = {
  [FlowModes.WORKFLOW]: {
    name: 'Workflow',
    displayName: 'Режим Workflow',
    description: 'Традиционный режим ETL-потоков и трансформаций данных',
    icon: 'pi pi-sitemap',
    features: [
      'Таблицы и колонки',
      'Фильтры и трансформации',
      'SQL-подобные операции',
      'Визуализации результатов'
    ]
  },
  [FlowModes.ROLE_SETS]: {
    name: 'Role-Sets',
    displayName: 'Режим Role-Sets',
    description: 'Концептуальное моделирование с Prisms, Roles и Witnesses',
    icon: 'pi pi-objects-column',
    features: [
      'Things (объекты с ID)',
      'Prisms (контексты/перспективы)',
      'Roles (контракты)',
      'Witnesses (доказательства)',
      'PQ-программы (декларативные запросы)'
    ]
  }
}

// Persistent state (survives across component remounts)
let persistentMode = ref(FlowModes.WORKFLOW)

// Load mode from localStorage on module load
const STORAGE_KEY = 'flow2-editor-mode'
const savedMode = localStorage.getItem(STORAGE_KEY)
if (savedMode && Object.values(FlowModes).includes(savedMode)) {
  persistentMode.value = savedMode
}

/**
 * Flow Mode Composable
 *
 * @returns {Object} Mode management API
 */
export function useFlowMode() {
  // Current mode state
  const currentMode = persistentMode

  // Computed mode checks
  const isWorkflowMode = computed(() => currentMode.value === FlowModes.WORKFLOW)
  const isRoleSetsMode = computed(() => currentMode.value === FlowModes.ROLE_SETS)

  // Get mode information
  const getCurrentModeInfo = computed(() => MODE_INFO[currentMode.value])

  const getModeInfo = (mode) => MODE_INFO[mode]

  /**
   * Switch to a different mode
   *
   * @param {string} newMode - Target mode (FlowModes.WORKFLOW or FlowModes.ROLE_SETS)
   * @param {Object} options - Migration options
   * @returns {Promise<Object>} Migration result
   */
  const switchMode = async (newMode, options = {}) => {
    if (!Object.values(FlowModes).includes(newMode)) {
      throw new Error(`Invalid mode: ${newMode}. Must be one of ${Object.values(FlowModes).join(', ')}`)
    }

    if (currentMode.value === newMode) {
      return {
        success: true,
        migrated: false,
        message: 'Already in target mode'
      }
    }

    const oldMode = currentMode.value

    try {
      // Migration logic
      let migrationResult = { success: true, migrated: false }

      // Workflow → Role-Sets migration
      if (oldMode === FlowModes.WORKFLOW && newMode === FlowModes.ROLE_SETS) {
        if (options.migrate) {
          migrationResult = await migrateWorkflowToRoleSets(options.data)
        } else {
          console.warn('[useFlowMode] Switching to Role-Sets mode without migration. Use options.migrate=true to migrate data.')
        }
      }

      // Role-Sets → Workflow migration
      if (oldMode === FlowModes.ROLE_SETS && newMode === FlowModes.WORKFLOW) {
        if (options.migrate) {
          migrationResult = await migrateRoleSetsToWorkflow(options.data)
        } else {
          console.warn('[useFlowMode] Switching to Workflow mode without migration. Use options.migrate=true to migrate data.')
        }
      }

      // Switch mode
      currentMode.value = newMode
      localStorage.setItem(STORAGE_KEY, newMode)

      return {
        success: true,
        oldMode,
        newMode,
        ...migrationResult
      }
    } catch (error) {
      console.error('[useFlowMode] Mode switch failed:', error)
      throw error
    }
  }

  /**
   * Reset mode to default (Workflow)
   */
  const resetMode = () => {
    currentMode.value = FlowModes.WORKFLOW
    localStorage.setItem(STORAGE_KEY, FlowModes.WORKFLOW)
  }

  /**
   * Get all available modes
   */
  const getAllModes = () => Object.values(FlowModes)

  /**
   * Get mode information for all modes
   */
  const getAllModesInfo = () => MODE_INFO

  // Watch mode changes and emit events
  watch(currentMode, (newMode, oldMode) => {
    if (newMode !== oldMode) {
      logger.info(`[useFlowMode] Mode changed: ${oldMode} → ${newMode}`)

      // Dispatch custom event for other components to listen
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flow-mode-changed', {
          detail: { oldMode, newMode }
        }))
      }
    }
  })

  return {
    // State
    currentMode,

    // Computed
    isWorkflowMode,
    isRoleSetsMode,
    getCurrentModeInfo,

    // Methods
    switchMode,
    resetMode,
    getModeInfo,
    getAllModes,
    getAllModesInfo,

    // Constants
    FlowModes
  }
}

/**
 * Migrate Workflow data to Role-Sets paradigm
 *
 * @param {Object} workflowData - Workflow nodes and edges
 * @returns {Promise<Object>} Migration result
 */
async function migrateWorkflowToRoleSets(workflowData) {
  try {
    // Lazy load migration service
    const { WorkflowToRoleSetsMigrator } = await import('@/services/migration/WorkflowToRoleSetsMigrator')

    const migrator = new WorkflowToRoleSetsMigrator()
    const result = await migrator.migrate(workflowData)

    return {
      success: true,
      migrated: true,
      data: result,
      message: `Migrated ${result.things?.length || 0} Things, ${result.prisms?.length || 0} Prisms, ${result.roleBindings?.length || 0} RoleBindings`
    }
  } catch (error) {
    console.error('[useFlowMode] Workflow → Role-Sets migration failed:', error)
    return {
      success: false,
      migrated: false,
      error: error.message
    }
  }
}

/**
 * Migrate Role-Sets data to Workflow paradigm
 *
 * @param {Object} roleSetsData - Things, Prisms, Roles, RoleBindings
 * @returns {Promise<Object>} Migration result
 */
async function migrateRoleSetsToWorkflow(roleSetsData) {
  try {
    // This is a lossy conversion - Role-Sets is more expressive than Workflow
    // We'll create workflow nodes from RoleBindings

    const nodes = []
    const edges = []

    // Convert Things with RoleBindings to workflow nodes
    if (roleSetsData.things && roleSetsData.roleBindings) {
      for (const thing of roleSetsData.things) {
        const bindings = roleSetsData.roleBindings.filter(b => b.thingId === thing.id)

        for (const binding of bindings) {
          // Create a node for each role binding
          nodes.push({
            id: `${thing.id}-${binding.roleId}`,
            type: 'customNode',
            position: { x: Math.random() * 500, y: Math.random() * 500 },
            data: {
              label: `Thing ${thing.id}`,
              type: 'table',
              roleBinding: binding,
              attributes: binding.proof?.attributes || {}
            }
          })
        }
      }
    }

    return {
      success: true,
      migrated: true,
      data: { nodes, edges },
      warning: 'Role-Sets → Workflow migration is lossy. Some information may be lost.',
      message: `Created ${nodes.length} workflow nodes from Role-Sets data`
    }
  } catch (error) {
    console.error('[useFlowMode] Role-Sets → Workflow migration failed:', error)
    return {
      success: false,
      migrated: false,
      error: error.message
    }
  }
}

/**
 * Default export
 */
export default useFlowMode
