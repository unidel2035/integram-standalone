import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * SmartQ Store - State management for SmartQ reports
 * Based on legacy smartq.js implementation
 */
export const useSmartQStore = defineStore('smartq', () => {
  // State
  const reports = ref(new Map()) // Map of report ID to report data
  const activeReportId = ref(null)

  // Base type mapping (from legacy bt object)
  const baseTypes = {
    3: 'SHORT',
    8: 'CHARS',
    9: 'DATE',
    13: 'NUMBER',
    14: 'SIGNED',
    11: 'BOOLEAN',
    12: 'MEMO',
    4: 'DATETIME',
    10: 'FILE',
    2: 'HTML',
    7: 'BUTTON',
    6: 'PWD',
    5: 'GRANT',
    15: 'CALCULATABLE',
    16: 'REPORT_COLUMN',
    17: 'PATH'
  }

  // Getters
  const activeReport = computed(() => {
    if (!activeReportId.value) return null
    return reports.value.get(activeReportId.value)
  })

  const getReport = computed(() => (id) => {
    return reports.value.get(id)
  })

  // Actions
  function createReport(id, config = {}) {
    const report = {
      id,
      tableId: config.tableId || 0,
      page: 1,
      total: undefined,
      limit: config.limit || 20,
      defaultLimit: 20,
      order: 0,
      totalsOn: false,
      columns: {},
      ids: {},
      arrs: {},
      metas: {},
      uniq: {},
      baseType: [],
      ddList: {},
      ddLimit: 50,
      lastHead: undefined,
      filters: {},
      sortColumn: null,
      sortDirection: 'asc',
      data: [],
      loading: false,
      error: null,
      subTotals: {
        active: false,
        sum: 0,
        count: 0,
        avg: 0,
        min: 0,
        max: 0,
        cells: []
      }
    }

    reports.value.set(id, report)
    activeReportId.value = id

    return report
  }

  function updateReport(id, updates) {
    const report = reports.value.get(id)
    if (!report) return

    Object.assign(report, updates)
    reports.value.set(id, report)
  }

  function setReportData(id, jsonData) {
    const report = reports.value.get(id)
    if (!report) return

    // Process columns
    const columns = {}
    const ids = {}
    const arrs = {}
    const metas = {}
    const baseType = []

    jsonData.columns.forEach((col, index) => {
      const name = col.name
      const type = col.type

      columns[name] = {
        type,
        col: index,
        id: col.id,
        format: col.format,
        name,
        ref: col.ref
      }

      baseType[index] = col.format

      // Process ID columns
      if (col.id && name.endsWith('ID') && columns[name.substring(0, name.length - 2)]) {
        ids[index] = 0 // ID column
      } else if (col.id && columns[name + 'ID']) {
        ids[index] = 1 // Has paired ID column
      }

      // Check for subtables
      if (col.arrId) {
        arrs[col.arrId] = col.id
      }

      // Store metadata
      if (col.metadata) {
        metas[index] = col.metadata
      }
    })

    // Check if first column has totals
    const totalsOn = jsonData.columns[0] && 'totals' in jsonData.columns[0]

    updateReport(id, {
      columns,
      ids,
      arrs,
      metas,
      baseType,
      totalsOn,
      data: jsonData.data || [],
      lastHead: jsonData.columns.map(c => c.name + c.col).join('')
    })
  }

  function setFilters(id, filters) {
    const report = reports.value.get(id)
    if (!report) return

    report.filters = { ...filters }
  }

  function setSorting(id, column, direction) {
    const report = reports.value.get(id)
    if (!report) return

    report.sortColumn = column
    report.sortDirection = direction
  }

  function setPage(id, page) {
    const report = reports.value.get(id)
    if (!report) return

    report.page = Math.max(1, page)
  }

  function nextPage(id) {
    const report = reports.value.get(id)
    if (!report) return

    setPage(id, report.page + 1)
  }

  function prevPage(id) {
    const report = reports.value.get(id)
    if (!report) return

    setPage(id, report.page - 1)
  }

  function firstPage(id) {
    setPage(id, 1)
  }

  function lastPage(id) {
    const report = reports.value.get(id)
    if (!report || !report.total) return

    const totalPages = Math.ceil(report.total / report.limit)
    setPage(id, totalPages)
  }

  function setLoading(id, loading) {
    const report = reports.value.get(id)
    if (!report) return

    report.loading = loading
  }

  function setError(id, error) {
    const report = reports.value.get(id)
    if (!report) return

    report.error = error
  }

  function clearSubTotals(id) {
    const report = reports.value.get(id)
    if (!report) return

    report.subTotals = {
      active: false,
      sum: 0,
      count: 0,
      avg: 0,
      min: 0,
      max: 0,
      cells: []
    }
  }

  function updateSubTotals(id, cells) {
    const report = reports.value.get(id)
    if (!report) return

    const values = cells.map(cell => {
      const val = parseFloat(cell.value)
      return isNaN(val) ? 0 : val
    }).filter(v => v !== 0)

    if (values.length === 0) {
      clearSubTotals(id)
      return
    }

    const sum = values.reduce((acc, val) => acc + val, 0)
    const count = values.length
    const avg = sum / count
    const min = Math.min(...values)
    const max = Math.max(...values)

    report.subTotals = {
      active: true,
      sum,
      count,
      avg,
      min,
      max,
      cells
    }
  }

  function deleteReport(id) {
    reports.value.delete(id)
    if (activeReportId.value === id) {
      activeReportId.value = null
    }
  }

  function resetReport(id) {
    const report = reports.value.get(id)
    if (!report) return

    const config = {
      tableId: report.tableId,
      limit: report.defaultLimit
    }

    deleteReport(id)
    createReport(id, config)
  }

  return {
    // State
    reports,
    activeReportId,
    baseTypes,

    // Getters
    activeReport,
    getReport,

    // Actions
    createReport,
    updateReport,
    setReportData,
    setFilters,
    setSorting,
    setPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    setLoading,
    setError,
    clearSubTotals,
    updateSubTotals,
    deleteReport,
    resetReport
  }
})
