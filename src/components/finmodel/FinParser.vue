<template>
  <div class="fin-parser">
    <!-- Sheet tabs -->
    <div class="fin-parser-tabs">
      <button
        v-for="sheet in sheets"
        :key="sheet.id"
        class="fin-parser-tab"
        :class="{ 'fin-parser-tab--active': activeSheetId === sheet.id }"
        @click="activeSheetId = sheet.id"
      >
        {{ sheet.name }}
      </button>
    </div>

    <!-- Active sheet content -->
    <div v-if="activeSheet" class="fin-parser-content">
      <div
        v-for="panel in activeSheet.panels"
        :key="panel.id"
        class="fin-parser-panel"
      >
        <div v-if="panel.name" class="fin-parser-panel-title">{{ panel.name }}</div>

        <div class="fin-parser-table-wrap">
          <table class="fin-parser-table">
            <thead>
              <tr>
                <th class="fin-parser-col-name">Наименование</th>
                <th
                  v-for="col in panel.columns"
                  :key="col.key"
                  class="fin-parser-col-period"
                >
                  {{ col.name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in panel.rows"
                :key="row.itemID"
                class="fin-parser-row"
              >
                <!-- Row name with indentation by level -->
                <td
                  class="fin-parser-cell-name"
                  :style="{ paddingLeft: levelIndent(row.level) }"
                >
                  {{ row.item }}
                </td>
                <!-- Data cells -->
                <td
                  v-for="col in panel.columns"
                  :key="col.key"
                  class="fin-parser-cell-value"
                  :class="{
                    'fin-parser-cell--formula': row.formulas,
                    'fin-parser-cell--error': isCellError(row.itemID, col.key),
                    'fin-parser-cell--mu': col.type === 'mu'
                  }"
                >
                  {{ getCellDisplay(row.itemID, col) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { evaluateMathExpression } from '@/utils/mathEvaluator'

const props = defineProps({
  modelData: { type: Array, default: () => [] },
  yearPeriods: { type: Array, default: () => [] },
  quarterPeriods: { type: Array, default: () => [] },
  monthPeriods: { type: Array, default: () => [] },
  // Source reports: { [reportId]: { [key]: value } }
  sourceReports: { type: Object, default: () => ({}) },
  // Raw values array from report 6431: [{ item, value, itemID, ... }]
  valuesData: { type: Array, default: () => [] }
})

// Active tab state
const activeSheetId = ref(null)

// Computed sheets list (unique, ordered)
const sheets = computed(() => {
  const seen = new Map()
  for (const row of props.modelData) {
    const id = String(row.sheetID || row.sheet || '')
    const name = row.sheet || ''
    if (id && !seen.has(id)) {
      seen.set(id, { id, name })
    }
  }
  return Array.from(seen.values())
})

// Active sheet object
const activeSheet = computed(() => {
  if (!activeSheetId.value) return null
  const sheetId = activeSheetId.value
  const sheetName = sheets.value.find(s => s.id === sheetId)?.name || ''

  // Collect panels in this sheet
  const panelsMap = new Map()
  for (const row of props.modelData) {
    const sid = String(row.sheetID || row.sheet || '')
    if (sid !== sheetId) continue
    const pid = String(row.panelID || row.panel_id || '')
    if (!panelsMap.has(pid)) {
      panelsMap.set(pid, {
        id: pid,
        name: row.panel || row.Панель || '',
        rows: [],
        periodType: row.period || row.PeriodType || row.period_type || 'Год',
        columns: null // will be built below
      })
    }
    panelsMap.get(pid).rows.push(row)
  }

  // Build columns and deduplicate rows per panel
  const panels = []
  for (const [, panel] of panelsMap) {
    panel.columns = buildPanelColumns(panel)
    // Deduplicate rows by itemID (some rows appear twice for rg/line)
    const seenItems = new Set()
    panel.rows = panel.rows.filter(row => {
      const id = String(row.itemID || row.item_id || row.ID || '')
      if (seenItems.has(id)) return false
      seenItems.add(id)
      return true
    })
    panels.push(panel)
  }

  return { id: sheetId, name: sheetName, panels }
})

/**
 * Build the column definitions for a panel based on RGtype and period type.
 */
function buildPanelColumns(panel) {
  const rows = panel.rows
  const periodType = panel.periodType
  const periods = getPeriodsForType(periodType)
  const columns = []

  // Collect RGtypes present in this panel
  const rgTypes = new Set(rows.map(r => (r.RGtype || r['Тип RG'] || '').toLowerCase()))

  // Add mu column if any row has type 'mu'
  if (rgTypes.has('mu') || rgTypes.has('ед. изм.') || rgTypes.has('ед.изм.')) {
    columns.push({ key: '_mu', name: 'Ед. изм.', type: 'mu' })
  }

  // Add 'value' column if any row has type 'value'
  if (rgTypes.has('value') || rgTypes.has('значение')) {
    columns.push({ key: '_value', name: 'Значение', type: 'value' })
  }

  // Check if there are source report columns (default RGtype)
  const hasSourceCols = rows.some(r => {
    const rgt = (r.RGtype || r['Тип RG'] || '').toLowerCase()
    const srcId = String(r.RGsourceID || r.rgsourceid || '')
    return (!rgt || rgt === 'default') && srcId
  })
  if (hasSourceCols) {
    // Find first RGsourceID
    const srcRow = rows.find(r => {
      const rgt = (r.RGtype || r['Тип RG'] || '').toLowerCase()
      const srcId = String(r.RGsourceID || r.rgsourceid || '')
      return (!rgt || rgt === 'default') && srcId
    })
    if (srcRow) {
      const srcId = String(srcRow.RGsourceID || srcRow.rgsourceid || '')
      const report = props.sourceReports[srcId] || {}
      for (const [colName] of Object.entries(report)) {
        columns.push({ key: `_src_${colName}`, name: colName, type: 'source', srcId })
      }
    }
  }

  // Add period columns for rg and line types
  const hasRgOrLine = rows.some(r => {
    const rgt = (r.RGtype || r['Тип RG'] || '').toLowerCase()
    return rgt === 'rg' || rgt === 'repeating group' || rgt === 'line' || rgt === 'сумма строки' || rgt === ''
  })

  if (hasRgOrLine || columns.length === 0) {
    for (const p of periods) {
      const name = p.r[0]
      const from = p.r[1]
      const to = p.r[2]
      const key = `_p_${from}_${to}`
      columns.push({ key, name, type: 'period', from, to })
    }

    // Add 'line' total column if any row has line type
    const hasLine = rows.some(r => {
      const rgt = (r.RGtype || r['Тип RG'] || '').toLowerCase()
      return rgt === 'line' || rgt === 'сумма строки'
    })
    if (hasLine && periods.length > 0) {
      columns.push({ key: '_line', name: 'Итого', type: 'line' })
    }
  }

  return columns
}

/**
 * Get period array for a given period type string.
 */
function getPeriodsForType(periodType) {
  const pt = (periodType || '').toLowerCase()
  if (pt.includes('квартал') || pt === 'quarter') return props.quarterPeriods
  if (pt.includes('месяц') || pt.includes('мес') || pt === 'month') return props.monthPeriods
  return props.yearPeriods // default: year
}

// ─── Value parsing from report 6431 ───────────────────────────────────────

/**
 * Parse raw valuesData into a lookup: { itemName: [{ date: 'YYYYMMDD', val: number, col: string }] }
 * The 'value' field in each row is a JSON-like string: {"date":"20250203","val":"1000"},{"date":"20250303","val":"1100"}
 * We wrap it in [] to parse as array.
 */
const parsedValues = computed(() => {
  const map = {}
  for (const row of props.valuesData) {
    const itemName = String(row.item || row.Статья || row.item_name || '')
    const itemId = String(row.itemID || row.item_id || row.ID || '')
    const rawVal = row.value || ''
    if (!itemName && !itemId) continue

    let entries = []
    if (rawVal && typeof rawVal === 'string') {
      try {
        // value field looks like: {"date":"20250203","val":"1000"},{"date":"20250303","val":"1100"}
        const jsonStr = rawVal.startsWith('[') ? rawVal : `[${rawVal}]`
        const parsed = JSON.parse(jsonStr)
        entries = Array.isArray(parsed) ? parsed : []
      } catch {
        // Try replacing &quot;
        try {
          const cleaned = rawVal.replace(/&quot;/g, '"')
          const jsonStr = cleaned.startsWith('[') ? cleaned : `[${cleaned}]`
          entries = JSON.parse(jsonStr)
        } catch {
          entries = []
        }
      }
    } else if (Array.isArray(rawVal)) {
      entries = rawVal
    }

    // Normalize entries to { date: YYYYMMDD string, val: number, col: string }
    const normalized = entries.map(e => ({
      date: String(e.date || e.Date || '').replace(/\./g, ''), // already YYYYMMDD or dd.mm.yyyy
      val: Number(e.val || e.value || e.Val || 0),
      col: String(e.col || e.column || '')
    }))

    if (itemName) {
      if (!map[itemName]) map[itemName] = []
      map[itemName].push(...normalized)
    }
    if (itemId && itemId !== itemName) {
      if (!map[itemId]) map[itemId] = []
      map[itemId].push(...normalized)
    }
  }
  return map
})

/**
 * Convert date string to comparable integer.
 * Handles both YYYYMMDD and dd.mm.yyyy formats.
 */
function dateToInt(dateStr) {
  if (!dateStr) return 0
  const s = String(dateStr)
  if (s.includes('.')) {
    const [d, m, y] = s.split('.')
    return parseInt(`${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`)
  }
  // Already YYYYMMDD
  return parseInt(s) || 0
}

/**
 * Get aggregated value for an item within a date range.
 * Sums all val entries where date >= from and date <= to.
 */
function getVal(itemName, from, to) {
  const entries = parsedValues.value[itemName] || []
  if (!entries.length) return null
  const f = dateToInt(from)
  const t = dateToInt(to)
  let sum = 0
  let found = false
  for (const e of entries) {
    const d = dateToInt(e.date)
    if (d >= f && d <= t) {
      sum += e.val
      found = true
    }
  }
  return found ? sum : null
}

/**
 * Get value for an item filtered by column name (for source report columns).
 */
function getColVal(itemName, colName) {
  const entries = parsedValues.value[itemName] || []
  if (!entries.length) return null
  let sum = 0
  let found = false
  for (const e of entries) {
    if (e.col === colName) {
      sum += e.val
      found = true
    }
  }
  return found ? sum : null
}

// ─── Cell value computation ────────────────────────────────────────────────

// Cache of computed cell values: { itemID_colKey: number | null | 'error' }
const cellCache = ref({})
// Set of itemIDs with errors
const errorCells = ref(new Set())

/**
 * Main entry: get display string for a cell.
 */
function getCellDisplay(itemId, col) {
  const val = getCellValue(itemId, col)
  if (val === null || val === undefined) return ''
  if (val === 'error') return '#ОШ'
  if (typeof val === 'string') return val
  return formatNumber(val)
}

function isCellError(itemId, colKey) {
  return errorCells.value.has(`${itemId}_${colKey}`)
}

/**
 * Get computed value for a cell, using cache.
 */
function getCellValue(itemId, col) {
  const key = `${itemId}_${col.key}`
  if (cellCache.value[key] !== undefined) return cellCache.value[key]
  // Not in cache — compute now
  const val = computeCellValue(itemId, col)
  cellCache.value[key] = val
  return val
}

/**
 * Compute value for a cell based on RGtype and formula.
 */
function computeCellValue(itemId, col) {
  // Find the row definition
  const row = props.modelData.find(r => String(r.itemID || r.item_id || r.ID || '') === String(itemId))
  if (!row) return null

  const rgt = (row.RGtype || row['Тип RG'] || '').toLowerCase()
  const formula = row.formulas || row.formula || ''
  const itemName = row.item || row.Статья || row.item_name || ''
  const muVal = row.MU || row.mu || row['Ед.изм.'] || ''

  // mu column: return unit of measurement text
  if (col.type === 'mu') {
    return muVal || null
  }

  // value column: single value from report 6431 (no date range)
  if (col.type === 'value') {
    if (rgt === 'value' || rgt === 'значение') {
      if (formula) return evalFormula(formula, col, row)
      return getVal(itemName, '01.01.1900', '31.12.2100') ?? (row.value !== undefined ? Number(row.value) : null)
    }
    return null
  }

  // source column: value from source report
  if (col.type === 'source') {
    return getColVal(itemName, col.name)
  }

  // period column (rg / line / default)
  if (col.type === 'period') {
    if (rgt === 'line' || rgt === 'сумма строки') {
      // line: same as rg for this period
      return computeRgValue(itemName, itemId, formula, col, row)
    }
    if (rgt === 'rg' || rgt === 'repeating group' || rgt === '' || !rgt) {
      return computeRgValue(itemName, itemId, formula, col, row)
    }
    return null
  }

  // line total column: sum of all period cells
  if (col.type === 'line') {
    // Get panel to find all period columns
    const panelId = String(row.panelID || row.panel_id || '')
    const panel = activeSheet.value?.panels?.find(p => p.id === panelId)
    if (!panel) return null
    const periodCols = panel.columns.filter(c => c.type === 'period')
    let total = 0
    let hasAny = false
    for (const pc of periodCols) {
      const v = getCellValue(itemId, pc)
      if (typeof v === 'number') {
        total += v
        hasAny = true
      }
    }
    return hasAny ? total : null
  }

  return null
}

/**
 * Compute value for an rg/period cell.
 * If formula present — evaluate it; otherwise look up from values data.
 */
function computeRgValue(itemName, itemId, formula, col, row) {
  if (formula && formula.trim()) {
    return evalFormula(formula, col, row)
  }
  // No formula — get from valuesData by item name
  return getVal(itemName, col.from, col.to)
}

/**
 * Evaluate a formula expression for a cell.
 *
 * Supported formula types:
 * - `[]` — use value from report 6431 (same as no formula)
 * - `77` — constant number
 * - `[17452]+[17453]` — sum of other rows by itemId
 * - `[ReportName.Field]` — value from loaded source report
 * - `СУММА([from]:[to])` — not yet supported (TODO)
 */
function evalFormula(formula, col, thisRow) {
  const f = formula.trim()

  // Empty formula or just []
  if (!f || f === '[]') {
    const itemName = thisRow.item || thisRow.Статья || thisRow.item_name || ''
    if (col.type === 'period') return getVal(itemName, col.from, col.to)
    if (col.type === 'value') return getVal(itemName, '01.01.1900', '31.12.2100')
    return null
  }

  // Pure constant
  if (/^-?\d+(\.\d+)?$/.test(f)) {
    return parseFloat(f)
  }

  // Build expression by replacing [itemId] and [Report.Field] references
  let expr = f

  // Replace [Report.Field] references from source reports
  expr = expr.replace(/\[([^\]]+\.[^\]]+)\]/g, (match, ref) => {
    const dotIdx = ref.indexOf('.')
    const reportName = ref.substring(0, dotIdx).trim()
    const fieldName = ref.substring(dotIdx + 1).trim()
    // Search through all source reports
    for (const [, reportData] of Object.entries(props.sourceReports)) {
      if (reportData[reportName] !== undefined) {
        const v = reportData[reportName][fieldName]
        if (v !== undefined) return String(Number(v) || 0)
      }
      // Also check by field name directly
      if (reportData[`${reportName}.${fieldName}`] !== undefined) {
        return String(Number(reportData[`${reportName}.${fieldName}`]) || 0)
      }
    }
    return '0'
  })

  // Replace [itemId] references with cell values
  expr = expr.replace(/\[(\d+)\]/g, (match, refId) => {
    const v = getCellValue(refId, col)
    if (v === null || v === undefined) return '0'
    if (typeof v === 'number') return String(v)
    return '0'
  })

  // Evaluate the resulting math expression
  try {
    expr = expr.replace(/,/g, '.')
    const result = evaluateMathExpression(expr)
    if (typeof result === 'number' && !isNaN(result)) {
      return Math.round(result * 100) / 100
    }
  } catch (e) {
    const thisId = String(thisRow.itemID || thisRow.item_id || thisRow.ID || '')
    console.warn(`FinParser: formula eval error for item ${thisId}, col ${col.key}: ${e.message}`)
    errorCells.value.add(`${thisId}_${col.key}`)
    return 'error'
  }

  return null
}

/**
 * Format a number for display in Russian locale.
 */
function formatNumber(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  return val.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/**
 * Get left indent CSS value based on row level (1-based).
 */
function levelIndent(level) {
  const lvl = parseInt(level) || 1
  if (lvl <= 1) return '4px'
  return `${(lvl - 1) * 1.2 + 0.25}rem`
}

// ─── Watchers ──────────────────────────────────────────────────────────────

watch(
  () => [props.modelData, props.yearPeriods, props.quarterPeriods, props.monthPeriods, props.valuesData, props.sourceReports],
  () => {
    // Clear caches when data changes
    cellCache.value = {}
    errorCells.value = new Set()
    // Set active sheet to first if not set or if sheets changed
    if (sheets.value.length > 0) {
      const ids = sheets.value.map(s => s.id)
      if (!activeSheetId.value || !ids.includes(activeSheetId.value)) {
        activeSheetId.value = ids[0]
      }
    }
  },
  { immediate: true, deep: true }
)
</script>

<style scoped>
.fin-parser {
  font-family: Inter, system-ui, sans-serif;
  font-size: 13px;
  color: var(--p-text-color, #1e293b);
}

/* ── Tabs ── */
.fin-parser-tabs {
  display: flex;
  gap: 2px;
  padding: 8px 12px 0;
  border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
  background: var(--surface-card, #f8fafc);
  flex-wrap: wrap;
}

.fin-parser-tab {
  padding: 6px 14px;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--p-text-color-secondary, #64748b);
  font-family: inherit;
  transition: background 0.15s, color 0.15s;
}

.fin-parser-tab:hover {
  background: var(--surface-hover, #f1f5f9);
  color: var(--p-text-color, #1e293b);
}

.fin-parser-tab--active {
  background: var(--surface-card, #f7f7f5);
  color: var(--p-primary-color, #3b82f6);
  border-color: var(--p-content-border-color, #e2e8f0);
  font-weight: 600;
  position: relative;
  bottom: -1px;
}

/* ── Content ── */
.fin-parser-content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: var(--surface-card, #f7f7f5);
}

/* ── Panel ── */
.fin-parser-panel {
  border: 1px solid var(--p-content-border-color, #e2e8f0);
  border-radius: 6px;
  overflow: hidden;
}

.fin-parser-panel-title {
  padding: 8px 12px;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--surface-card, #f8fafc);
  border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
  color: var(--p-text-color-secondary, #64748b);
}

/* ── Table ── */
.fin-parser-table-wrap {
  overflow-x: auto;
}

.fin-parser-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}

.fin-parser-table thead th {
  padding: 4px 8px;
  text-align: left;
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
  background: var(--surface-ground, #f9fafb);
  border-bottom: 2px solid var(--p-content-border-color, #e2e8f0);
  color: var(--p-text-color-secondary, #64748b);
  position: sticky;
  top: 0;
}

.fin-parser-table thead th.fin-parser-col-period {
  text-align: right;
  min-width: 80px;
}

.fin-parser-table thead th.fin-parser-col-name {
  min-width: 200px;
}

.fin-parser-table tbody tr:hover {
  background: var(--surface-hover, #f8fafc);
}

.fin-parser-table tbody tr:not(:last-child) td {
  border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
}

.fin-parser-cell-name {
  padding: 4px 8px;
  color: var(--p-text-color, #1e293b);
  white-space: nowrap;
}

.fin-parser-cell-value {
  padding: 4px 8px;
  text-align: right;
  white-space: nowrap;
  color: var(--p-text-color, #1e293b);
}

/* Formula cells: italic */
.fin-parser-cell--formula {
  font-style: italic;
  color: var(--p-text-color-secondary, #475569);
}

/* Error cells: red */
.fin-parser-cell--error {
  color: var(--p-red-500, #ef4444) !important;
  font-style: normal !important;
}

/* Unit of measurement cells: text, left align */
.fin-parser-cell--mu {
  text-align: left;
  color: var(--p-text-color-secondary, #64748b);
}
</style>
