/**
 * Grouping Composable
 * Handles row grouping, multi-column grouping, group expansion, and merged cell grouping
 *
 * Grouping Modes:
 * - 'header': Traditional grouping with expandable group header rows (default)
 * - 'merged': Word/Coda.io style - grouped column cells merge vertically using rowspan
 */

import { ref, computed } from 'vue'

export function useGrouping(localHeaders, sortedAndFilteredRows) {
  // Grouping state
  const groupedData = ref(null)
  const currentGroupColumns = ref([])
  const expandedGroups = ref({})
  const currentGroupColumn = ref(null)

  // Grouping mode: 'header' by default (expandable group headers)
  const groupingMode = ref('header')

  // For merged cell mode: calculate rowspan info for each row
  // Returns a Map<rowId, { headerId: rowspan }> for cells that should be rendered
  // Cells that should be hidden (merged into another) are not in the map
  const mergedCellInfo = computed(() => {
    if (groupingMode.value !== 'merged' || !currentGroupColumn.value) {
      return null
    }

    const headerId = currentGroupColumn.value
    const rows = sortedAndFilteredRows.value
    const info = new Map()

    let i = 0
    while (i < rows.length) {
      const row = rows[i]
      const cellValue = row.cells[headerId]?.value
      const normalizedValue = cellValue !== null && cellValue !== undefined ? cellValue : '(Пусто)'

      // Count consecutive rows with the same value
      let spanCount = 1
      let j = i + 1
      while (j < rows.length) {
        const nextRow = rows[j]
        const nextCellValue = nextRow.cells[headerId]?.value
        const nextNormalizedValue = nextCellValue !== null && nextCellValue !== undefined ? nextCellValue : '(Пусто)'

        if (nextNormalizedValue === normalizedValue) {
          spanCount++
          j++
        } else {
          break
        }
      }

      // First row in group gets the rowspan
      info.set(row.id, { rowspan: spanCount, isFirst: true })

      // Other rows in group get rowspan 0 (hidden)
      for (let k = i + 1; k < i + spanCount; k++) {
        info.set(rows[k].id, { rowspan: 0, isFirst: false })
      }

      i = j
    }

    return info
  })

  // For multi-column merged grouping
  const multiMergedCellInfo = computed(() => {
    if (groupingMode.value !== 'merged' || currentGroupColumns.value.length === 0) {
      return null
    }

    const headerIds = currentGroupColumns.value
    const rows = sortedAndFilteredRows.value
    const info = new Map() // Map<rowId, Map<headerId, { rowspan, isFirst }>>

    // For each grouped column, calculate rowspan independently
    headerIds.forEach(headerId => {
      let i = 0
      while (i < rows.length) {
        const row = rows[i]
        const cellValue = row.cells[headerId]?.value
        const normalizedValue = cellValue !== null && cellValue !== undefined ? cellValue : '(Пусто)'

        // Count consecutive rows with the same value
        let spanCount = 1
        let j = i + 1
        while (j < rows.length) {
          const nextRow = rows[j]
          const nextCellValue = nextRow.cells[headerId]?.value
          const nextNormalizedValue = nextCellValue !== null && nextCellValue !== undefined ? nextCellValue : '(Пусто)'

          if (nextNormalizedValue === normalizedValue) {
            spanCount++
            j++
          } else {
            break
          }
        }

        // First row in group gets the rowspan
        if (!info.has(row.id)) info.set(row.id, new Map())
        info.get(row.id).set(headerId, { rowspan: spanCount, isFirst: true })

        // Other rows in group get rowspan 0 (hidden)
        for (let k = i + 1; k < i + spanCount; k++) {
          if (!info.has(rows[k].id)) info.set(rows[k].id, new Map())
          info.get(rows[k].id).set(headerId, { rowspan: 0, isFirst: false })
        }

        i = j
      }
    })

    return info
  })

  // Helper to get rowspan for a cell (used in template)
  const getCellRowspan = (headerId, rowId) => {
    // Single column grouping
    if (mergedCellInfo.value && headerId === currentGroupColumn.value) {
      const info = mergedCellInfo.value.get(rowId)
      return info ? info.rowspan : 1
    }

    // Multi-column grouping
    if (multiMergedCellInfo.value && currentGroupColumns.value.includes(headerId)) {
      const rowInfo = multiMergedCellInfo.value.get(rowId)
      if (rowInfo) {
        const cellInfo = rowInfo.get(headerId)
        return cellInfo ? cellInfo.rowspan : 1
      }
    }

    return 1
  }

  // Helper to check if a cell should be rendered (not hidden by merge)
  const shouldRenderCell = (headerId, rowId) => {
    const rowspan = getCellRowspan(headerId, rowId)
    return rowspan !== 0
  }

  // Flattened rows for virtual scrolling with grouping support
  const flattenedRows = computed(() => {
    // In merged mode, don't add group header rows - just return all rows
    if (groupingMode.value === 'merged') {
      return sortedAndFilteredRows.value.map(row => ({ type: 'row', data: row }))
    }

    if (!groupedData.value) {
      return sortedAndFilteredRows.value.map(row => ({ type: 'row', data: row }))
    }

    const result = []
    for (const [groupKey, group] of Object.entries(groupedData.value.groups)) {
      result.push({ type: 'group', key: groupKey, data: group })
      if (expandedGroups.value[groupKey]) {
        result.push(...group.rows.map(row => ({ type: 'row', data: row })))
      }
    }
    return result
  })

  // Toggle grouping mode
  const toggleGroupingMode = () => {
    groupingMode.value = groupingMode.value === 'header' ? 'merged' : 'header'
  }

  // Set grouping mode
  const setGroupingMode = (mode) => {
    if (mode === 'header' || mode === 'merged') {
      groupingMode.value = mode
    }
  }

  // Toggle multi-column grouping
  const toggleMultiGroupBy = (headerIds, mode = null) => {
    // Optionally set mode when toggling
    if (mode) setGroupingMode(mode)

    const validHeaderIds = headerIds.filter(id =>
      id && localHeaders.value.some(header => header.id === id)
    )

    if (validHeaderIds.length === 0 ||
        (currentGroupColumns.value.length === validHeaderIds.length &&
         currentGroupColumns.value.every(id => validHeaderIds.includes(id)))) {
      groupedData.value = null
      currentGroupColumns.value = []
      expandedGroups.value = {}
    } else {
      currentGroupColumns.value = validHeaderIds
      groupMultiData(validHeaderIds)
    }
  }

  // Group data by multiple columns
  const groupMultiData = (headerIds) => {
    const groups = {}

    sortedAndFilteredRows.value.forEach(row => {
      const groupKey = headerIds.map(headerId => {
        const cell = row.cells[headerId]
        const value = cell?.value
        return value !== null && value !== undefined ? value : '(Пусто)'
      }).join('|')

      if (!groups[groupKey]) groups[groupKey] = { rows: [], count: 0 }
      groups[groupKey].rows.push(row)
      groups[groupKey].count++
    })

    groupedData.value = { columns: headerIds, groups: groups }
    expandedGroups.value = Object.keys(groups).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
  }

  // Toggle single-column grouping
  const toggleGroupBy = (headerId, mode = null) => {
    // Optionally set mode when toggling
    if (mode) setGroupingMode(mode)

    if (currentGroupColumn.value === headerId) {
      groupedData.value = null
      currentGroupColumn.value = null
      expandedGroups.value = {}
    } else {
      currentGroupColumn.value = headerId
      groupData(headerId)
    }
  }

  // Group data by single column
  const groupData = (headerId) => {
    const groups = {}
    sortedAndFilteredRows.value.forEach(row => {
      const cell = row.cells[headerId]
      const groupKey = cell?.value || '(Пусто)'
      if (!groups[groupKey]) groups[groupKey] = { rows: [], count: 0 }
      groups[groupKey].rows.push(row)
      groups[groupKey].count++
    })
    groupedData.value = { column: headerId, groups }
    expandedGroups.value = Object.keys(groups).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
  }

  // Toggle group expansion
  const toggleGroup = (groupKey) => {
    expandedGroups.value[groupKey] = !expandedGroups.value[groupKey]
  }

  // Format multi-group header display
  const formatMultiGroupHeader = (groupKey) => {
    const values = groupKey.split('|')
    return values.map((value, index) => {
      const headerId = currentGroupColumns.value[index]
      const header = localHeaders.value.find(h => h.id === headerId)
      return header ? `${header.value}: ${value}` : value
    }).join('; ')
  }

  // Cleanup
  const cleanup = () => {
    groupedData.value = null
    currentGroupColumns.value = []
    expandedGroups.value = {}
    currentGroupColumn.value = null
    groupingMode.value = 'header' // Reset to default mode
  }

  return {
    // State
    groupedData,
    currentGroupColumns,
    expandedGroups,
    currentGroupColumn,
    flattenedRows,
    groupingMode,
    mergedCellInfo,
    multiMergedCellInfo,

    // Functions
    toggleMultiGroupBy,
    groupMultiData,
    toggleGroupBy,
    groupData,
    toggleGroup,
    formatMultiGroupHeader,
    toggleGroupingMode,
    setGroupingMode,
    getCellRowspan,
    shouldRenderCell,
    cleanup
  }
}
