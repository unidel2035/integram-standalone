/**
 * Composable for working with GRANT type (type 5) in Integram
 * GRANT - access control type that allows selecting system objects or types for granting permissions
 *
 * Special values:
 * - 0 → "*** Type editor ***" (TYPE_EDITOR)
 * - 1 → "*** All objects ***" (ALL_OBJECTS)
 * - 10 → "*** Files ***" (FILES)
 * - Table IDs → Access to entire table
 * - Requisite IDs → Access to specific column (formatted as "Table -> Column")
 */

import { ref, onMounted } from 'vue'
import integramApiClient from '@/services/integramApiClient'

export function useGrants() {
  const grantOptions = ref([])
  const loading = ref(false)
  const error = ref(null)

  /**
   * Load grant options from Integram API
   * Matches legacy PHP Grant_List generation logic (index.php lines 4409-4456)
   */
  async function loadGrantOptions() {
    loading.value = true
    error.value = null

    try {
      const options = []
      const existing = new Set() // Track added grant IDs to avoid duplicates

      // Get all tables for object-level grants
      const dict = await integramApiClient.getDictionary()

      // Process each table and its requisites
      // Legacy SQL: SELECT gr.id, gr.val, reqs.id req_id, reqs.t req_t, req_typ.val req_val
      for (const [tableId, tableName] of Object.entries(dict)) {
        // Add table itself as a grant option (if not already added)
        if (!existing.has(tableId)) {
          existing.add(tableId)
          options.push({
            value: tableId,
            label: tableName,
            icon: 'pi pi-table',
            severity: 'info',
            description: `Доступ к таблице ${tableName}`,
            isRequisite: false
          })
        }

        // Get table metadata to fetch requisites (columns)
        try {
          const metadata = await integramApiClient.getTypeMetadata(tableId)

          // Add each requisite as a grant option
          // Legacy format: "Table Name -> Requisite Name" (line 4440)
          if (metadata.requisites && Array.isArray(metadata.requisites)) {
            for (const req of metadata.requisites) {
              if (req.id && req.alias) {
                // Skip if already added (avoid duplicates)
                if (existing.has(req.id.toString())) continue

                existing.add(req.id.toString())

                // Format: "Table Name -> Column Name"
                const label = `${tableName} → ${req.alias}`

                options.push({
                  value: req.id.toString(),
                  label,
                  icon: 'pi pi-key',
                  severity: 'info',
                  description: `Доступ к столбцу "${req.alias}" таблицы "${tableName}"`,
                  isRequisite: true,
                  tableName,
                  requisiteName: req.alias
                })
              }
            }
          }
        } catch (err) {
          // If metadata fetch fails for a table, skip its requisites but keep the table itself
          console.warn(`Failed to load metadata for table ${tableId}:`, err.message)
        }
      }

      // Sort options alphabetically by label
      options.sort((a, b) => a.label.localeCompare(b.label, 'ru'))

      // Add system grants at the END (legacy behavior - lines 4447-4456)
      const systemGrants = [
        {
          value: '0',
          label: '*** Type editor ***',
          icon: 'pi pi-cog',
          severity: 'danger',
          description: 'Полный доступ к редактору структуры таблиц',
          isRequisite: false
        },
        {
          value: '1',
          label: '*** All objects ***',
          icon: 'pi pi-globe',
          severity: 'danger',
          description: 'Полный доступ ко всем объектам системы',
          isRequisite: false
        },
        {
          value: '10',
          label: '*** Files ***',
          icon: 'pi pi-folder',
          severity: 'warning',
          description: 'Доступ к файловой системе',
          isRequisite: false
        }
      ]

      // Final order: Tables & Requisites (sorted) → System Grants (at the end)
      grantOptions.value = [...options, ...systemGrants]

      console.log('Grant options loaded:', grantOptions.value.length,
        `(${options.length} tables/requisites + ${systemGrants.length} system grants)`)
    } catch (err) {
      console.error('Failed to load grant options:', err)
      error.value = err.message || 'Failed to load grant options'
    } finally {
      loading.value = false
    }
  }

  /**
   * Format GRANT value for display
   * @param {string|number} value - Grant value (0, 1, 10, table ID, or requisite ID)
   * @returns {string} Formatted display string
   */
  function formatGrantValue(value) {
    if (!value && value !== 0) return ''

    // Special system grants
    const grantMap = {
      '0': '*** Type editor ***',
      '1': '*** All objects ***',
      '10': '*** Files ***'
    }

    if (grantMap[value.toString()]) {
      return grantMap[value.toString()]
    }

    // Try to find in loaded options
    const option = grantOptions.value.find(opt => opt.value === value.toString())
    if (option) {
      return option.label
    }

    // Fallback to ID
    return `Object #${value}`
  }

  /**
   * Get badge severity based on grant level
   * @param {string|number} value - Grant value
   * @returns {string} PrimeVue badge severity (danger, warning, info, success)
   */
  function getGrantSeverity(value) {
    if (!value && value !== 0) return 'info'

    const valueStr = value.toString()

    // High-level system access - RED
    if (valueStr === '0' || valueStr === '1') {
      return 'danger'
    }

    // File access - ORANGE
    if (valueStr === '10') {
      return 'warning'
    }

    // Object-level access (table or requisite) - BLUE
    return 'info'
  }

  /**
   * Get icon for grant value
   * @param {string|number} value - Grant value
   * @returns {string} PrimeIcons class
   */
  function getGrantIcon(value) {
    if (!value && value !== 0) return 'pi pi-lock'

    const valueStr = value.toString()

    const iconMap = {
      '0': 'pi pi-cog',
      '1': 'pi pi-globe',
      '10': 'pi pi-folder'
    }

    if (iconMap[valueStr]) {
      return iconMap[valueStr]
    }

    // Check if it's a requisite (column) or table
    const option = grantOptions.value.find(opt => opt.value === valueStr)
    if (option?.isRequisite) {
      return 'pi pi-key' // Column-level access
    }

    return 'pi pi-table' // Table-level access
  }

  /**
   * Check if grant value is a system-level grant (high-risk)
   * @param {string|number} value - Grant value
   * @returns {boolean} True if system-level grant
   */
  function isSystemGrant(value) {
    const valueStr = value?.toString()
    return valueStr === '0' || valueStr === '1' || valueStr === '10'
  }

  /**
   * Check if grant value is a requisite (column-level access)
   * @param {string|number} value - Grant value
   * @returns {boolean} True if requisite-level grant
   */
  function isRequisiteGrant(value) {
    const valueStr = value?.toString()
    const option = grantOptions.value.find(opt => opt.value === valueStr)
    return option?.isRequisite || false
  }

  /**
   * Get warning message for high-risk grants
   * @param {string|number} value - Grant value
   * @returns {string|null} Warning message or null
   */
  function getGrantWarning(value) {
    const valueStr = value?.toString()

    if (valueStr === '0') {
      return 'ВНИМАНИЕ: Предоставляет полный доступ к редактору структуры таблиц!'
    }

    if (valueStr === '1') {
      return 'ВНИМАНИЕ: Предоставляет полный доступ ко всем объектам системы!'
    }

    if (valueStr === '10') {
      return 'ВНИМАНИЕ: Предоставляет доступ к файловой системе!'
    }

    return null
  }

  // Removed: Auto-load on mount
  // Grant options are now loaded on-demand (lazy load) when user opens a GRANT field editor
  // This prevents loading 500+ /metadata requests when opening a table that may not have GRANT fields
  // onMounted(() => {
  //   loadGrantOptions()
  // })

  return {
    // Data
    grantOptions,
    loading,
    error,

    // Methods
    loadGrantOptions,
    formatGrantValue,
    getGrantSeverity,
    getGrantIcon,
    isSystemGrant,
    isRequisiteGrant,
    getGrantWarning
  }
}
