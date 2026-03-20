<template>
  <div class="smartq-viewer" @mousedown.stop @click.stop @dblclick.stop @keydown.stop @keyup.stop @input.stop @compositionstart.stop @compositionend.stop>
    <!-- Issue #6677: ConfirmDialog required for delete row functionality in Block Editor -->
    <ConfirmDialog />
    <!-- Loading State -->
    <div v-if="loading" class="smartq-state">
      <ProgressSpinner />
      <p class="mt-3">{{ $t('smartq.loading') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="smartq-state">
      <Message severity="error" :closable="false">
        <div class="flex flex-column gap-2">
          <strong>{{ $t('smartq.errors.loadFailed') }}</strong>
          <p class="m-0">{{ error }}</p>
          <div class="flex gap-2 mt-2">
            <Button
              :label="$t('smartq.retry')"
              icon="pi pi-refresh"
              size="small"
              @click="loadReportData"
            />
            <Button
              v-if="rawResponse"
              :label="$t('smartq.viewRawResponse')"
              icon="pi pi-eye"
              severity="secondary"
              size="small"
              outlined
              @click="showRawResponse = !showRawResponse"
            />
          </div>
          <div v-if="showRawResponse && rawResponse" class="raw-response mt-2">
            <pre>{{ JSON.stringify(rawResponse, null, 2) }}</pre>
          </div>
        </div>
      </Message>
    </div>

    <!-- Table Content -->
    <div v-else-if="reportData" class="table-content">
      <!-- Report Header -->
      <div class="report-header mb-3">
        <div class="flex justify-content-between align-items-center flex-wrap gap-2">
          <h3 class="m-0">
            <i class="pi pi-table mr-2"></i>
            {{ reportData.title }}
          </h3>
          <!-- Issues #6958, #7100: Hide action buttons (refresh, export CSV/Excel) when embedded in block editor -->
          <div v-if="!embedded" class="flex gap-2 flex-wrap">
            <Button
              v-if="isEditable"
              icon="pi pi-plus"
              :label="$t('smartq.addRow')"
              severity="success"
              size="small"
              @click="addNewRow"
            />
            <Button
              icon="pi pi-refresh"
              :label="$t('smartq.refresh')"
              size="small"
              outlined
              @click="loadReportData"
            />
            <Button
              icon="pi pi-file"
              :label="$t('smartq.exportCSV')"
              severity="secondary"
              size="small"
              outlined
              @click="exportToCSV"
            />
            <Button
              icon="pi pi-file-excel"
              :label="$t('smartq.exportExcel')"
              severity="success"
              size="small"
              outlined
              @click="exportToExcel"
            />
          </div>
        </div>
      </div>

      <!-- Sub-Totals Bar (shown when cells are selected) -->
      <div v-if="selectedCells.length > 0" class="subtotals-bar mb-2">
        <div class="flex gap-3 align-items-center flex-wrap">
          <span class="text-sm font-medium">{{ $t('smartq.subTotals.selected', { n: selectedCells.length }) }}:</span>
          <span class="text-sm">{{ $t('smartq.subTotals.count') }}: <strong>{{ subTotals.count }}</strong></span>
          <span class="text-sm">{{ $t('smartq.subTotals.sum') }}: <strong>{{ subTotals.sum }}</strong></span>
          <span class="text-sm">{{ $t('smartq.subTotals.average') }}: <strong>{{ subTotals.avg }}</strong></span>
          <span class="text-sm">{{ $t('smartq.subTotals.minMax') }}: <strong>{{ subTotals.min }} / {{ subTotals.max }}</strong></span>
          <Button
            icon="pi pi-times"
            :label="$t('smartq.subTotals.clear')"
            text
            size="small"
            @click="clearCellSelection"
          />
        </div>
      </div>

      <!-- Native Table (Coda-style) -->
      <div class="coda-style-datatable" :class="{ 'text-wrap-enabled': textWrapEnabled, 'text-wrap-disabled': !textWrapEnabled }">
        <div class="table-container">
          <table>
            <!-- Table Header -->
            <thead>
              <tr>
                <!-- Row Counter Header -->
                <th class="row-counter-header" style="width: 50px; min-width: 50px; max-width: 50px;">
                  <div class="header-content"></div>
                </th>

                <!-- Data Headers -->
                <th
                  v-for="column in tableColumns"
                  :key="column.field"
                  :style="getColumnStyle(column)"
                  class="data-header"
                >
                  <div class="header-content">
                    {{ column.header }}
                  </div>
                </th>

                <!-- Actions Column Header (if editable) -->
                <th v-if="isEditable" style="width: 120px; min-width: 120px;" class="actions-header">
                  <div class="header-content">{{ $t('smartq.actions') }}</div>
                </th>
              </tr>
            </thead>

            <!-- Table Body -->
            <tbody>
              <tr
                v-for="(row, rowIndex) in displayedRows"
                :key="row._objectId || rowIndex"
                class="data-row"
                :class="{ 'new-row': row._isNew, 'row-is-selected': false }"
              >
                <!-- Row Counter Cell -->
                <td class="row-counter-cell">
                  <div class="cell-content row-counter-unified">
                    <!-- Row number (default visible) -->
                    <span class="row-number-coda">{{ (currentPage - 1) * pageSize + rowIndex + 1 }}</span>

                    <!-- Grip button (hidden, shows on hover) -->
                    <button class="row-grip-btn" type="button" @mousedown.stop>
                      <span class="grip-dots-icon"></span>
                    </button>

                    <!-- Expand button (hidden, shows on hover) -->
                    <button class="row-expand-btn" type="button" @click.stop>
                      <i class="pi pi-angle-right"></i>
                    </button>

                    <!-- Inline add button (on bottom border) -->
                    <button
                      v-if="isEditable"
                      class="row-add-inline-btn"
                      type="button"
                      @click.stop="addRowAfter(rowIndex)"
                    >
                      <i class="pi pi-plus"></i>
                    </button>
                  </div>
                </td>

                <!-- Data Cells -->
                <td
                  v-for="column in tableColumns"
                  :key="column.field"
                  :class="['data-cell', getCellClass(column), {
                    'editing-cell': isEditing(rowIndex, column.field),
                    'selected-cell': isCellSelected(rowIndex, column.field),
                    'cell-saving': isCellSaving(rowIndex, column.field)
                  }]"
                  :style="getColumnStyle(column)"
                  @click="handleCellClick(rowIndex, column, row, $event)"
                >
                  <!-- Read-only cell -->
                  <div v-if="!isCellEditable(row, column)" class="cell-content cell-readonly">
                    <template v-if="isReferenceColumn(column)">
                      <template v-if="isMultiColumn(column)">
                        <span v-for="item in getMultiItems(column, row._objectId)" :key="item.msId" class="dir-tag no-edit">
                          {{ item.label }}
                        </span>
                        <span v-if="!getMultiItems(column, row._objectId).length" class="cell-ref-text">{{ row[column.field] || '' }}</span>
                      </template>
                      <span v-else-if="row[column.field]" class="dir-single-tag no-edit">{{ row[column.field] }}</span>
                    </template>
                    <span v-else class="cell-content" v-html="formatCellValue(row[column.field], column)" />
                  </div>

                  <!-- Editable cell - not editing -->
                  <div
                    v-else-if="!isEditing(rowIndex, column.field)"
                    class="cell-content"
                  >
                    <span v-if="isCellSaving(rowIndex, column.field)" class="saving-indicator">
                      <i class="pi pi-spin pi-spinner" />
                    </span>

                    <!-- Reference field: chips with hover X and arrow -->
                    <template v-if="isReferenceColumn(column)">
                      <!-- MULTI: chips with X button -->
                      <template v-if="isMultiColumn(column)">
                        <span
                          v-for="item in getMultiItems(column, row._objectId)"
                          :key="item.msId"
                          class="dir-tag"
                        >
                          {{ item.label }}
                          <i class="pi pi-times dir-tag-remove" @mousedown.stop @click.stop="removeMultiItem(column, row, item.msId)" />
                        </span>
                        <span v-if="!getMultiItems(column, row._objectId).length" class="cell-ref-text">{{ row[column.field] || '' }}</span>
                      </template>
                      <!-- Single ref: chip with X button -->
                      <template v-else>
                        <span v-if="row[column.field]" class="dir-single-tag">
                          {{ row[column.field] }}
                          <i class="pi pi-times dir-single-clear" @mousedown.stop @click.stop="clearRefValue(column, row)" />
                        </span>
                        <span v-else class="cell-empty-placeholder" />
                      </template>

                      <!-- Dropdown arrow (shows on hover) -->
                      <i class="pi pi-chevron-down select-arrow-icon" @click.stop="startEdit(rowIndex, column.field, row, column)" />
                    </template>

                    <!-- Non-reference field -->
                    <span v-else v-html="formatCellValue(row[column.field], column)" />
                  </div>

                  <!-- Editing cell: seamless editor -->
                  <div v-else class="cell-editor seamless-editor">
                    <!-- REFERENCE field: must be checked BEFORE format checks because
                         ref columns often have format SHORT/CHARS but need a Select, not InputText -->
                    <div v-if="isReferenceColumn(column)" class="ref-editor-wrap">
                      <!-- MULTI: current chips with X inside editor -->
                      <div v-if="isMultiColumn(column)" class="ref-chips-row">
                        <span
                          v-for="item in getMultiItems(column, row._objectId)"
                          :key="item.msId"
                          class="dir-tag"
                        >
                          {{ item.label }}
                          <i class="pi pi-times dir-tag-remove" @mousedown.stop @click.stop="removeMultiItem(column, row, item.msId)" />
                        </span>
                      </div>
                      <!-- Dropdown to add/set value -->
                      <Select
                        v-model="editingCell.value.value"
                        :options="refOptions[String(column.type)] || []"
                        optionLabel="text"
                        optionValue="id"
                        :filter="true"
                        :showClear="!isMultiColumn(column)"
                        :loading="loadingRefOptions[String(column.type)]"
                        class="seamless-dropdown"
                        :placeholder="loadingRefOptions[String(column.type)] ? 'Загрузка...' : 'Выберите...'"
                        appendTo="body"
                        autofocus
                        @show="loadRefOpts(column.type, row._objectId)"
                        @change="isMultiColumn(column)
                          ? addMultiItem(column, row, editingCell.value.value)
                          : saveEdit(rowIndex, column.field, row)"
                        @blur="!isMultiColumn(column) && saveEdit(rowIndex, column.field, row)"
                        @keydown.stop
                        @keydown.escape="cancelEdit"
                      />
                    </div>

                    <!-- MEMO -->
                    <Textarea
                      v-else-if="column.format === 'MEMO'"
                      v-model="editingCell.value.value"
                      rows="3"
                      class="seamless-textarea"
                      autofocus
                      @blur="saveEdit(rowIndex, column.field, row)"
                      @keydown.stop
                      @keyup.stop
                      @keypress.stop
                      @keydown.escape.stop="cancelEdit"
                    />

                    <!-- NUMBER / SIGNED -->
                    <InputNumber
                      v-else-if="column.format === 'NUMBER' || column.format === 'SIGNED'"
                      v-model="editingCell.value.value"
                      class="seamless-input"
                      autofocus
                      @blur="saveEdit(rowIndex, column.field, row)"
                      @keydown.stop
                      @keyup.stop
                      @keypress.stop
                      @keydown.enter.stop="handleEnterKey(rowIndex, column.field, row, $event)"
                      @keydown.escape.stop="cancelEdit"
                      @keydown.tab.stop="handleTabKey(rowIndex, column.field, row, $event)"
                    />

                    <!-- DATE / DATETIME -->
                    <DatePicker
                      v-else-if="column.format === 'DATE' || column.format === 'DATETIME'"
                      v-model="editingCell.value.value"
                      :showTime="column.format === 'DATETIME'"
                      class="seamless-datepicker"
                      autofocus
                      @date-select="saveEdit(rowIndex, column.field, row)"
                      @blur="saveEdit(rowIndex, column.field, row)"
                      @keydown.stop
                      @keydown.escape.stop="cancelEdit"
                    />

                    <!-- BOOLEAN -->
                    <Checkbox
                      v-else-if="column.format === 'BOOLEAN'"
                      v-model="editingCell.value.value"
                      binary
                      autofocus
                      @change="saveEdit(rowIndex, column.field, row)"
                    />

                    <!-- SHORT / CHARS / Default -->
                    <InputText
                      v-else
                      v-model="editingCell.value.value"
                      class="seamless-input"
                      autofocus
                      @blur="saveEdit(rowIndex, column.field, row)"
                      @keydown.stop
                      @keyup.stop
                      @keypress.stop
                      @keydown.enter.stop="handleEnterKey(rowIndex, column.field, row, $event)"
                      @keydown.escape.stop="cancelEdit"
                      @keydown.tab.stop="handleTabKey(rowIndex, column.field, row, $event)"
                      @keydown.arrow-down.stop="navigateCell(rowIndex + 1, column.field)"
                      @keydown.arrow-up.stop="navigateCell(rowIndex - 1, column.field)"
                    />
                  </div>
                </td>

                <!-- Actions Column (only when editable) -->
                <td v-if="isEditable" class="actions-cell">
                  <div class="flex gap-1">
                    <!-- Save button for new (unsaved) rows -->
                    <Button
                      v-if="row._isNew"
                      icon="pi pi-check"
                      v-tooltip.top="$t('smartq.saveRow')"
                      text
                      rounded
                      size="small"
                      severity="success"
                      :loading="row._saving"
                      @click="saveNewRow(rowIndex, row)"
                    />
                    <Button
                      v-if="!row._isNew"
                      icon="pi pi-copy"
                      v-tooltip.top="$t('smartq.duplicate')"
                      text
                      rounded
                      size="small"
                      severity="secondary"
                      @click="duplicateRow(rowIndex, row)"
                    />
                    <Button
                      icon="pi pi-trash"
                      v-tooltip.top="$t('smartq.delete')"
                      text
                      rounded
                      size="small"
                      severity="danger"
                      @click="deleteRow(rowIndex, row)"
                    />
                  </div>
                </td>
              </tr>

              <!-- Empty state (when no rows in current page) -->
              <tr v-if="displayedRows.length === 0">
                <td :colspan="tableColumns.length + (isEditable ? 2 : 1)" class="empty-state-cell">
                  <div class="smartq-state py-5">
                    <i class="pi pi-inbox text-6xl text-color-secondary mb-3" />
                    <p class="text-xl text-color-secondary">{{ $t('smartq.noData') }}</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pagination Controls -->
      <div v-if="totalPages > 1" class="pagination-controls mt-3">
        <div class="flex justify-content-between align-items-center flex-wrap gap-2">
          <div class="pagination-info text-sm text-color-secondary">
            {{ $t('smartq.showingRows', {
              start: (currentPage - 1) * pageSize + 1,
              end: Math.min(currentPage * pageSize, totalRecords),
              total: totalRecords
            }) }}
          </div>
          <div class="flex gap-1">
            <Button
              icon="pi pi-angle-double-left"
              text
              size="small"
              :disabled="currentPage === 1"
              @click="goToPage(1)"
            />
            <Button
              icon="pi pi-angle-left"
              text
              size="small"
              :disabled="currentPage === 1"
              @click="goToPage(currentPage - 1)"
            />
            <span class="px-3 py-2 text-sm">{{ currentPage }} / {{ totalPages }}</span>
            <Button
              icon="pi pi-angle-right"
              text
              size="small"
              :disabled="currentPage === totalPages"
              @click="goToPage(currentPage + 1)"
            />
            <Button
              icon="pi pi-angle-double-right"
              text
              size="small"
              :disabled="currentPage === totalPages"
              @click="goToPage(totalPages)"
            />
          </div>
          <Select
            v-model="pageSize"
            :options="[10, 20, 50, 100]"
            placeholder="Page size"
            class="w-auto"
            size="small"
            @change="goToPage(1)"
          />
        </div>
      </div>
    </div>

    <!-- Nothing loaded yet -->
    <div v-else class="smartq-state py-8">
      <i class="pi pi-table text-6xl text-color-secondary mb-3" />
      <p class="text-xl text-color-secondary">{{ $t('smartq.noReportLoaded') }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import ConfirmDialog from 'primevue/confirmdialog'
import { useConfirm } from 'primevue/useconfirm'

import integramService from '@/services/integramApiClient'
import { useSmartQStore } from '@/stores/smartqStore'
import { logger } from '@/utils/logger'

// ─── Props ────────────────────────────────────────────────────────────────────

const props = defineProps({
  /** Integram report ID (object of type 22) */
  reportId: {
    type: Number,
    required: true
  },
  /** Integram database name (e.g. 'kval', 'my'). If provided, the API client
   *  will switch to this database before fetching the report. */
  database: {
    type: String,
    default: null
  },
  /**
   * Override editability. When undefined the component reads `sq-granted`
   * from the report metadata returned by the API.
   */
  editable: {
    type: Boolean,
    default: undefined
  },
  /** Enable drag-and-drop row reordering */
  dragEnabled: {
    type: Boolean,
    default: true
  },
  /**
   * Issues #6958, #7100: When true (embedded in block editor), hides action buttons
   * (Add row, Refresh, Export CSV/Excel) for a cleaner read-only appearance.
   * BlockDocumentEditor always passes embedded=true when mounting reports.
   */
  embedded: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['error', 'loaded'])

// ─── Composables ──────────────────────────────────────────────────────────────

const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const store = useSmartQStore()

// ─── Component state ──────────────────────────────────────────────────────────

const loading = ref(false)
const error = ref(null)
const rawResponse = ref(null)
const showRawResponse = ref(false)
const reportData = ref(null)
const tableColumns = ref([])
const tableRows = ref([])
const totalRecords = ref(0)
const pageSize = ref(20)
const currentPage = ref(1)
const textWrapEnabled = ref(false)

/** Whether the report was served with sq-granted="1" (or editable prop override) */
const sqGranted = ref(false)

/** The Integram type ID of rows in this report (needed for createObject) */
const reportTypeId = ref(null)

const isEditable = computed(() => {
  if (props.editable !== undefined) return props.editable
  return sqGranted.value
})

// Inline editing
const editingCell = ref({ rowIndex: null, field: null, value: null, originalValue: null })
const savingCells = ref(new Set())

// Cell selection for sub-totals
const selectedCells = ref([])
const selectedCell = ref({ rowIndex: null, field: null })

// Reference field: options cache { [reqId]: [{id, text}] }
const refOptions = ref({})
const loadingRefOptions = ref({})
// Multi items per row-column { [`${reqId}-${objectId}`]: [{msId, refId, label}] }
const multiItems = ref({})
// Columns detected as MULTI { [reqId]: boolean }
const multiColumns = ref({})

// ─── Computed ─────────────────────────────────────────────────────────────────

const displayedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return tableRows.value.slice(start, end)
})

const totalPages = computed(() => Math.ceil(tableRows.value.length / pageSize.value))

const subTotals = computed(() => {
  if (!selectedCells.value.length) return { count: 0, sum: 0, avg: 0, min: 0, max: 0 }

  const values = selectedCells.value
    .map(c => parseFloat(c.value))
    .filter(v => !isNaN(v))

  if (!values.length) return { count: selectedCells.value.length, sum: 0, avg: 0, min: 0, max: 0 }

  const sum = values.reduce((a, b) => a + b, 0)
  return {
    count: values.length,
    sum: sum.toFixed(2),
    avg: (sum / values.length).toFixed(2),
    min: Math.min(...values).toFixed(2),
    max: Math.max(...values).toFixed(2)
  }
})

// ─── Column helpers ───────────────────────────────────────────────────────────

function getCellClass(column) {
  if (column.format === 'NUMBER' || column.format === 'SIGNED') return 'text-right'
  if (column.format === 'BOOLEAN') return 'text-center'
  return ''
}

function getColumnStyle(column) {
  switch (column.format) {
    case 'BOOLEAN': return 'width: 80px; min-width: 80px'
    case 'NUMBER':
    case 'SIGNED': return 'width: 120px; min-width: 120px'
    case 'MEMO': return 'width: 240px; min-width: 240px'
    default: return 'width: 160px; min-width: 160px'
  }
}

/**
 * A cell is editable when:
 *  - the overall report is editable (sq-granted OR prop override), AND
 *  - the column is not a computed/formula column (CALCULATABLE / REPORT_COLUMN), AND
 *  - the row does not carry an explicit sq-granted="0" override
 */
function isCellEditable(rowData, column) {
  if (!isEditable.value) return false
  if (column.format === 'CALCULATABLE' || column.format === 'REPORT_COLUMN') return false
  // Row-level override: rowData._sqGranted === false means read-only row
  if (rowData._sqGranted === false) return false
  return true
}

// ─── Cell value formatting ─────────────────────────────────────────────────────

function formatCellValue(value, column) {
  if (value === null || value === undefined || value === '') return ''

  try {
    switch (column.format) {
      case 'NUMBER':
      case 'SIGNED': {
        const n = parseFloat(value)
        return isNaN(n) ? escapeHtml(String(value)) : n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      }
      case 'DATE': {
        const d = new Date(value)
        return isNaN(d.getTime()) ? escapeHtml(String(value)) : d.toLocaleDateString('ru-RU')
      }
      case 'DATETIME': {
        const d = new Date(value)
        return isNaN(d.getTime()) ? escapeHtml(String(value)) : d.toLocaleString('ru-RU')
      }
      case 'BOOLEAN':
        return value ? '&#10003;' : '&#10007;'
      default:
        return escapeHtml(String(value))
    }
  } catch (err) {
    logger.warn('[SmartQViewer] formatCellValue error:', err)
    return String(value)
  }
}

function escapeHtml(text) {
  const d = document.createElement('div')
  d.textContent = text
  return d.innerHTML
}

// ─── Reference fields ─────────────────────────────────────────────────────────

function isReferenceColumn(column) {
  // col.ref > 0 means resolved reference type; col.ref === 1 means unresolved but IS a ref
  return column.ref !== null && column.ref !== undefined && column.ref >= 1
}

function isMultiColumn(column) {
  return multiColumns.value[String(column.type)] === true
}

function getMultiItems(column, objectId) {
  if (!objectId) return []
  return multiItems.value[`${column.type}-${objectId}`] || []
}

/** Load reference options via _ref_reqs/{reqId}?id={objectId} (same as DataTable) */
async function loadRefOpts(reqId, objectId) {
  const key = String(reqId)
  // Empty array [] is truthy — only skip if we have actual options or are loading
  if ((refOptions.value[key]?.length > 0) || loadingRefOptions.value[key]) return
  loadingRefOptions.value[key] = true
  try {
    const result = await integramService.getReferenceOptions(reqId, objectId)
    // result is { id1: "name1", id2: "name2", ... }
    refOptions.value[key] = Object.entries(result || {})
      .filter(([id]) => id && id !== 'failed')
      .map(([id, text]) => ({ id: parseInt(id), text: String(text) }))
  } catch (err) {
    logger.error(`[SmartQViewer] loadRefOpts failed reqId=${reqId}:`, err)
    refOptions.value[key] = []
  } finally {
    loadingRefOptions.value[key] = false
  }
}

/** Load multiselect items for a specific row via edit_obj */
async function loadMultiItems(column, objectId) {
  if (!objectId) return
  const key = `${column.type}-${objectId}`
  if (multiItems.value[key]) return
  try {
    const objData = await integramService.getObjectEditData(objectId)
    const reqData = objData?.reqs?.[String(column.type)]
    const ms = reqData?.multiselect
    if (ms) {
      multiItems.value[key] = (ms.id || []).map((msId, i) => ({
        msId: String(msId),
        refId: String(ms.val?.[i] || ''),
        label: String(ms.ref_val?.[i] || ms.val?.[i] || msId)
      }))
    } else {
      multiItems.value[key] = []
    }
  } catch (err) {
    logger.warn(`[SmartQViewer] loadMultiItems failed:`, err)
    multiItems.value[key] = []
  }
}

/** Add item to MULTI ref field */
async function addMultiItem(column, rowData, selectedId) {
  const objectId = rowData._objectId
  if (!objectId || selectedId == null) return
  try {
    await integramService.addMultiselectItem(objectId, column.type, selectedId)
    // Invalidate cache and reload
    delete multiItems.value[`${column.type}-${objectId}`]
    await loadMultiItems(column, objectId)
    const items = getMultiItems(column, objectId)
    rowData[column.field] = items.map(i => i.label).join(', ')
    editingCell.value.value = null
    toast.add({ severity: 'success', summary: t('smartq.saved'), life: 2000 })
  } catch (err) {
    logger.error('[SmartQViewer] addMultiItem failed:', err)
    toast.add({ severity: 'error', summary: t('smartq.errors.saveFailed'), detail: err.message, life: 5000 })
  }
}

/** Remove chip from MULTI ref field */
async function removeMultiItem(column, rowData, msId) {
  const objectId = rowData._objectId
  if (!objectId) return
  try {
    await integramService.removeMultiselectItem(msId)
    delete multiItems.value[`${column.type}-${objectId}`]
    await loadMultiItems(column, objectId)
    const items = getMultiItems(column, objectId)
    rowData[column.field] = items.map(i => i.label).join(', ')
    toast.add({ severity: 'success', summary: t('smartq.saved'), life: 2000 })
  } catch (err) {
    logger.error('[SmartQViewer] removeMultiItem failed:', err)
    toast.add({ severity: 'error', summary: t('smartq.errors.saveFailed'), detail: err.message, life: 5000 })
  }
}

/** Clear single ref field value */
async function clearRefValue(column, rowData) {
  const objectId = rowData._objectId
  if (!objectId) return
  try {
    await integramService.setRequisites(objectId, { [column.type]: '' })
    rowData[column.field] = null
    toast.add({ severity: 'success', summary: t('smartq.saved'), life: 2000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: t('smartq.errors.saveFailed'), detail: err.message, life: 5000 })
  }
}

// ─── Cell selection ───────────────────────────────────────────────────────────

function isCellSelected(rowIndex, field) {
  return selectedCell.value.rowIndex === rowIndex && selectedCell.value.field === field
}

function handleCellClick(rowIndex, column, rowData, event) {
  // If cell is not editable, just select it (for sub-totals)
  if (!isCellEditable(rowData, column)) {
    toggleCellSelection(rowIndex, column.field, rowData[column.field], event)
    return
  }

  // Select cell
  selectedCell.value = { rowIndex, field: column.field }

  // Start editing (unless already editing)
  if (!isEditing(rowIndex, column.field)) {
    startEdit(rowIndex, column.field, rowData, column)
  }
}

function toggleCellSelection(rowIndex, field, value, event) {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  const cellId = `${rowIndex}-${field}`
  const idx = selectedCells.value.findIndex(c => c.id === cellId)
  if (idx >= 0) {
    selectedCells.value.splice(idx, 1)
  } else {
    selectedCells.value.push({ id: cellId, rowIndex, field, value })
    // Also sync to store
    store.updateSubTotals(props.reportId, selectedCells.value)
  }
}

function clearCellSelection() {
  selectedCells.value = []
  store.clearSubTotals(props.reportId)
}

// ─── Inline editing ───────────────────────────────────────────────────────────

function isEditing(rowIndex, field) {
  return editingCell.value.rowIndex === rowIndex && editingCell.value.field === field
}

function startEdit(rowIndex, field, rowData, column) {
  let value = rowData[field]
  if ((column.format === 'DATE' || column.format === 'DATETIME') && value && typeof value === 'string') {
    value = new Date(value)
  } else if ((column.format === 'NUMBER' || column.format === 'SIGNED') && value !== null && value !== undefined) {
    value = parseFloat(value)
  } else if (column.format === 'BOOLEAN') {
    value = !!value
  }
  editingCell.value = { rowIndex, field, value, originalValue: value }

  // Load ref options and multi items when opening a reference cell
  if (isReferenceColumn(column)) {
    loadRefOpts(column.type, rowData._objectId)
    if (isMultiColumn(column)) {
      loadMultiItems(column, rowData._objectId)
    }
  }
}

function cancelEdit() {
  editingCell.value = { rowIndex: null, field: null, value: null, originalValue: null }
}

async function saveEdit(rowIndex, field, rowData) {
  if (editingCell.value.value === editingCell.value.originalValue) {
    cancelEdit()
    return
  }

  // Capture before cancelEdit() resets the reactive object
  const newValue = editingCell.value.value
  const originalValue = editingCell.value.originalValue

  const column = tableColumns.value.find(c => c.field === field)
  if (!column) {
    logger.error(`[SmartQViewer] Column not found: ${field}`)
    cancelEdit()
    return
  }

  // For reference fields: update display text in the row, not the ID
  // The display shows row[field] as text, but the API needs the ID
  if (isReferenceColumn(column)) {
    const opt = refOptions.value[String(column.type)]?.find(o => o.id === newValue)
    rowData[field] = opt?.text ?? newValue
  } else {
    rowData[field] = newValue
  }

  cancelEdit()

  // New (unsaved) row — just update locally, user must click Save (✓) to commit
  if (rowData._isNew) {
    return
  }

  const cellId = `${rowIndex}-${field}`
  savingCells.value.add(cellId)

  try {
    const objectId = rowData._objectId || rowData.id
    if (!objectId) throw new Error('Cannot save: object ID not found')

    // column.type is the requisite ID on the data object (e.g. "1165209" for Организация).
    // column.id is the report column spec ID — NOT the requisite key for _m_set.
    await integramService.setRequisites(objectId, { [column.type]: newValue })
    toast.add({ severity: 'success', summary: t('smartq.saved'), detail: t('smartq.cellUpdatedSuccess'), life: 2000 })
    logger.info(`[SmartQViewer] Saved cell ${field} on object ${objectId}`)
  } catch (err) {
    logger.error('[SmartQViewer] Save failed:', err)
    rowData[field] = originalValue
    toast.add({ severity: 'error', summary: t('smartq.errors.saveFailed'), detail: err.message, life: 5000 })
  } finally {
    savingCells.value.delete(cellId)
  }
}

function isCellSaving(rowIndex, field) {
  return savingCells.value.has(`${rowIndex}-${field}`)
}

function navigateCell(toRowIndex, toField) {
  if (toRowIndex < 0 || toRowIndex >= displayedRows.value.length) return
  const colIdx = tableColumns.value.findIndex(c => c.field === toField)
  if (colIdx === -1) return

  if (editingCell.value.rowIndex !== null) {
    saveEdit(editingCell.value.rowIndex, editingCell.value.field, displayedRows.value[editingCell.value.rowIndex])
  }
  startEdit(toRowIndex, toField, displayedRows.value[toRowIndex], tableColumns.value[colIdx])
}

function handleEnterKey(rowIndex, field, data, event) {
  event.preventDefault()
  saveEdit(rowIndex, field, data)
  navigateCell(rowIndex + 1, field)
}

function handleTabKey(rowIndex, field, data, event) {
  event.preventDefault()
  const colIdx = tableColumns.value.findIndex(c => c.field === field)
  if (event.shiftKey) {
    if (colIdx > 0) navigateCell(rowIndex, tableColumns.value[colIdx - 1].field)
    else if (rowIndex > 0) navigateCell(rowIndex - 1, tableColumns.value[tableColumns.value.length - 1].field)
  } else {
    if (colIdx < tableColumns.value.length - 1) navigateCell(rowIndex, tableColumns.value[colIdx + 1].field)
    else if (rowIndex < displayedRows.value.length - 1) navigateCell(rowIndex + 1, tableColumns.value[0].field)
  }
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function goToPage(page) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  // Cancel any active edit when changing pages
  cancelEdit()
}

// ─── Row operations ───────────────────────────────────────────────────────────

function addNewRow() {
  const newRow = { _isNew: true, _saving: false }
  tableColumns.value.forEach(col => { newRow[col.field] = null })
  tableRows.value.unshift(newRow)
  goToPage(1) // Jump to first page to see the new row
  totalRecords.value++
  // Start editing the first editable cell immediately
  const firstEditableCol = tableColumns.value.find(col =>
    col.format !== 'CALCULATABLE' && col.format !== 'REPORT_COLUMN'
  )
  if (firstEditableCol) {
    startEdit(0, firstEditableCol.field, newRow, firstEditableCol)
  }
}

function addRowAfter(rowIndex) {
  const actualIndex = (currentPage.value - 1) * pageSize.value + rowIndex
  const newRow = { _isNew: true, _saving: false }
  tableColumns.value.forEach(col => { newRow[col.field] = null })
  tableRows.value.splice(actualIndex + 1, 0, newRow)
  totalRecords.value++
  // Stay on current page if the new row is visible
}

async function saveNewRow(rowIndex, rowData) {
  if (!reportTypeId.value) {
    toast.add({ severity: 'warn', summary: t('smartq.errors.noTypeId'), detail: t('smartq.errors.noTypeIdDetail'), life: 5000 })
    return
  }

  rowData._saving = true
  try {
    // Collect all non-null field values as requisites
    const requisites = {}
    let mainValue = ''
    tableColumns.value.forEach((col, i) => {
      const val = rowData[col.field]
      if (val !== null && val !== undefined && val !== '') {
        if (i === 0) {
          mainValue = String(val)
        } else {
          requisites[col.id] = val
        }
      }
    })

    const result = await integramService.createObject(reportTypeId.value, mainValue, requisites)
    const newId = result?.id || result?.object?.id || result

    // Update the row to be a real (saved) row
    rowData._isNew = false
    rowData._saving = false
    if (newId) {
      rowData._objectId = newId
    }

    toast.add({ severity: 'success', summary: t('smartq.rowSaved'), detail: t('smartq.rowSavedDetail'), life: 3000 })
    logger.info(`[SmartQViewer] New row saved with typeId ${reportTypeId.value}, objectId: ${newId}`)
  } catch (err) {
    rowData._saving = false
    logger.error('[SmartQViewer] saveNewRow failed:', err)
    toast.add({ severity: 'error', summary: t('smartq.errors.saveFailed'), detail: err.message, life: 5000 })
  }
}

async function duplicateRow(rowIndex, rowData) {
  const actualIndex = (currentPage.value - 1) * pageSize.value + rowIndex
  const newRow = { _isNew: true }
  tableColumns.value.forEach(col => { newRow[col.field] = rowData[col.field] })
  delete newRow.id
  delete newRow._objectId
  tableRows.value.splice(actualIndex + 1, 0, newRow)
  totalRecords.value++
  toast.add({ severity: 'success', summary: t('smartq.rowDuplicated'), detail: t('smartq.editAndSave'), life: 3000 })
}

async function deleteRow(rowIndex, rowData) {
  const actualIndex = (currentPage.value - 1) * pageSize.value + rowIndex

  if (rowData._isNew) {
    tableRows.value.splice(actualIndex, 1)
    totalRecords.value--
    toast.add({ severity: 'info', summary: t('smartq.rowRemoved'), detail: t('smartq.unsavedRowRemoved'), life: 2000 })
    return
  }

  confirm.require({
    message: t('smartq.confirmDelete'),
    header: t('smartq.deleteRow'),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('smartq.delete'),
    rejectLabel: t('smartq.cancel'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const objectId = rowData._objectId || rowData.id
        if (!objectId) throw new Error('Cannot delete: object ID not found')
        await integramService.deleteObject(objectId)
        tableRows.value.splice(actualIndex, 1)
        totalRecords.value--
        toast.add({ severity: 'success', summary: t('smartq.deleted'), detail: t('smartq.rowDeletedSuccess'), life: 3000 })
      } catch (err) {
        logger.error('[SmartQViewer] Delete failed:', err)
        toast.add({ severity: 'error', summary: t('smartq.errors.deleteFailed'), detail: err.message, life: 5000 })
      }
    }
  })
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportToCSV() {
  if (!tableRows.value.length) {
    toast.add({ severity: 'warn', summary: t('smartq.export.noData'), detail: t('smartq.export.noDataDetail'), life: 3000 })
    return
  }
  const headers = tableColumns.value.map(c => c.header)
  const rows = tableRows.value.map(row =>
    tableColumns.value.map(col => {
      const v = String(row[col.field] ?? '')
      return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v
    })
  )
  const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  downloadBlob(csv, 'text/csv;charset=utf-8;', `${reportData.value?.title || 'report'}_${today()}.csv`)
  toast.add({ severity: 'success', summary: t('smartq.export.success'), detail: t('smartq.export.csvDownloaded'), life: 3000 })
}

function exportToExcel() {
  if (!tableRows.value.length) {
    toast.add({ severity: 'warn', summary: t('smartq.export.noData'), detail: t('smartq.export.noDataDetail'), life: 3000 })
    return
  }
  const XLSX = window.XLSX
  if (!XLSX) {
    toast.add({ severity: 'error', summary: t('smartq.export.xlsxNotLoaded'), detail: t('smartq.export.xlsxNotLoadedDetail'), life: 5000 })
    return
  }
  const data = tableRows.value.map(row => {
    const obj = {}
    tableColumns.value.forEach(col => { obj[col.header] = row[col.field] ?? '' })
    return obj
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  XLSX.writeFile(wb, `${reportData.value?.title || 'report'}_${today()}.xlsx`)
  toast.add({ severity: 'success', summary: t('smartq.export.success'), detail: t('smartq.export.excelDownloaded'), life: 3000 })
}

function downloadBlob(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

function today() {
  return new Date().toISOString().split('T')[0]
}

// ─── Object ID resolution ──────────────────────────────────────────────────────

/**
 * When report rows lack _objectId (the report API only returns display values,
 * not underlying object IDs), try to resolve IDs by fetching the object list of
 * the first column's type and matching by displayed value.
 *
 * Example: first column is type 18 (Users), values are login names ("admin", "d").
 * We fetch objects of type 18, get {id: 1000, val: "admin"}, {id: 1003, val: "d"},
 * then set each row._objectId from the match.
 */
async function resolveObjectIds(columns, rows) {
  const rowsWithoutId = rows.filter(r => !r._objectId)
  if (!rowsWithoutId.length) return

  const firstCol = columns[0]
  if (!firstCol) return

  const typeId = parseInt(String(firstCol.type))
  if (!typeId || isNaN(typeId)) return

  try {
    const result = await integramService.getObjectList(typeId, { LIMIT: 2000 })
    const objects = result?.object || []
    if (!objects.length) return

    // Build val → id map (value is the object's main name field)
    const valToId = {}
    objects.forEach(obj => {
      if (obj.val != null && obj.id != null) {
        valToId[String(obj.val)] = parseInt(String(obj.id))
      }
    })

    let resolved = 0
    rows.forEach(row => {
      if (!row._objectId) {
        const displayVal = row[firstCol.field]
        if (displayVal != null) {
          const id = valToId[String(displayVal)]
          if (id && id > 0) {
            row._objectId = id
            resolved++
          }
        }
      }
    })

    if (resolved > 0) {
      logger.info(`[SmartQViewer] resolveObjectIds: resolved ${resolved}/${rowsWithoutId.length} rows via type ${typeId} lookup`)
    }
  } catch (err) {
    logger.warn('[SmartQViewer] resolveObjectIds failed:', err.message)
  }

  // Last resort: if any rows still lack _objectId, use the session user's ID.
  // This is accurate for reports that show only the current user's single row.
  const sessionUserId = parseInt(
    integramService.databases?.[props.database || 'kval']?.userId ||
    integramService.userId ||
    '0'
  )
  if (sessionUserId > 0) {
    rows.forEach(row => {
      if (!row._objectId) {
        row._objectId = sessionUserId
        logger.warn(`[SmartQViewer] resolveObjectIds: fallback to session userId ${sessionUserId} for row "${row[columns[0]?.field]}"`)
      }
    })
  }
}

// ─── Reference type resolution ─────────────────────────────────────────────────

async function resolveRefTypes(columns, rows) {
  const refCols = columns.filter(c => c.ref === 1 && c.type)
  if (!refCols.length) return

  // Process each row to detect MULTI and load multiItems
  const rowsWithId = rows.filter(r => r._objectId)
  if (!rowsWithId.length) {
    logger.warn('[SmartQViewer] resolveRefTypes: no row with _objectId')
    return
  }

  try {
    // Use first row to resolve ref types and detect MULTI
    const firstRow = rowsWithId[0]
    const objData = await integramService.getObjectEditData(firstRow._objectId)
    const reqs = objData?.reqs || {}

    refCols.forEach(col => {
      const reqMeta = reqs[String(col.type)]
      if (reqMeta?.ref_type) {
        col.ref = parseInt(reqMeta.ref_type)
        logger.info(`[SmartQViewer] ref "${col.field}": type ${col.type} → ref_type ${col.ref}`)
      }
      // Detect MULTI flag from attrs
      const isMulti = reqMeta?.attrs?.includes(':MULTI:') || !!reqMeta?.multiselect
      multiColumns.value[String(col.type)] = isMulti
    })

    // Load multiItems for ALL rows with object IDs
    await Promise.all(
      rowsWithId.flatMap(row =>
        refCols
          .filter(col => isMultiColumn(col))
          .map(col => loadMultiItems(col, row._objectId))
      )
    )
  } catch (err) {
    logger.warn('[SmartQViewer] resolveRefTypes failed:', err.message)
  }
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadReportData() {
  loading.value = true
  error.value = null
  rawResponse.value = null
  reportTypeId.value = null

  // Ensure the store has a record for this report
  if (!store.getReport(props.reportId)) {
    store.createReport(props.reportId)
  }
  store.setLoading(props.reportId, true)

  try {
    // Switch to the correct database before fetching if specified
    if (props.database && integramService.database !== props.database) {
      logger.info(`[SmartQViewer] Switching database to ${props.database}`)
      await integramService.switchDatabase(props.database)
    }

    logger.info(`[SmartQViewer] Loading report ${props.reportId}`)
    // Use ?JSON (not ?JSON_KV) to get column-first format with ref metadata.
    const [response, nameResp] = await Promise.allSettled([
      integramService.executeReport(props.reportId, { LIMIT: 1000, JSON_KV: undefined, JSON: '' }),
      integramService.getObjectEditData(props.reportId)
    ])
    const reportResponse = response.status === 'fulfilled' ? response.value : (() => { throw response.reason })()
    rawResponse.value = reportResponse
    const reportName = nameResp.status === 'fulfilled' ? (nameResp.value?.obj?.val || nameResp.value?.val || null) : null

    const parsed = parseIntegramResponse(reportResponse)
    if (reportName) parsed.title = reportName

    // If rows are missing _objectId (report API doesn't expose row IDs),
    // try to resolve them by fetching the first column's type object list and
    // matching by displayed value. Must run BEFORE resolveRefTypes which needs IDs.
    const rowsMissingId = parsed.rows.filter(r => !r._objectId)
    if (rowsMissingId.length > 0 && parsed.columns.length > 0) {
      await resolveObjectIds(parsed.columns, parsed.rows)
    }

    // Resolve ref:1 flags to actual referenced table type IDs.
    const refColumns = parsed.columns.filter(c => c.ref === 1)
    if (refColumns.length > 0) {
      await resolveRefTypes(parsed.columns, parsed.rows)
    }

    // Detect sq-granted from response metadata
    if (reportResponse && typeof reportResponse === 'object') {
      const granted = reportResponse['sq-granted'] ?? reportResponse.sqGranted ?? reportResponse.obj?.granted
      const anyColGranted = Array.isArray(reportResponse.columns) &&
        reportResponse.columns.some(c => c.granted === 1 || c.granted === '1')
      sqGranted.value = granted === 1 || granted === '1' || granted === true || anyColGranted

      // Also try to extract typeId from top-level response
      const tid = reportResponse.type_id || reportResponse.typeId || reportResponse.obj?.type || reportResponse.obj?.arr_type
      if (tid && !reportTypeId.value) {
        reportTypeId.value = tid
      }
    }

    reportData.value = { title: parsed.title }
    tableColumns.value = parsed.columns
    tableRows.value = parsed.rows
    totalRecords.value = parsed.totalRecords
    currentPage.value = 1 // Reset to first page

    store.setReportData(props.reportId, {
      columns: parsed.columns.map(c => ({ name: c.field, type: c.type, id: c.id, format: c.format, ref: c.ref, col: c.colIndex })),
      data: parsed.rows
    })
    store.setLoading(props.reportId, false)

    logger.info(`[SmartQViewer] Loaded ${parsed.rows.length} rows, ${parsed.columns.length} cols`)
    emit('loaded', parsed)
  } catch (err) {
    logger.error('[SmartQViewer] Load error:', err)
    error.value = err.message || t('smartq.errors.loadFailed')
    store.setError(props.reportId, error.value)
    store.setLoading(props.reportId, false)
    emit('error', error.value)
  } finally {
    loading.value = false
  }
}

// ─── Response parsing ─────────────────────────────────────────────────────────

function parseIntegramResponse(response) {
  if (!response) throw new Error('Empty response')
  if (Array.isArray(response)) return parseRowFirstFormat(response)
  if (typeof response !== 'object') throw new Error('Invalid response type')
  if (!response.columns || !Array.isArray(response.columns) || response.columns.length === 0) {
    throw new Error('Missing or empty "columns" array')
  }
  return parseColumnFirstFormat(response)
}

function parseRowFirstFormat(arr) {
  if (!arr.length) return { title: String(props.reportId), columns: [], rows: [], totalRecords: 0 }
  const names = Object.keys(arr[0])
  const columns = names.map((name, i) => {
    const format = detectFormat(arr, name)
    let distinctValues = null
    if (format === 'CHARS') {
      const values = arr.map(r => r[name]).filter(v => v !== null && v !== undefined && v !== '')
      const unique = [...new Set(values.map(v => String(v)))]
      if (unique.length > 0 && unique.length <= 30 && unique.length < arr.length * 0.5) {
        distinctValues = unique.sort()
      }
    }
    return { field: name, header: name, format, type: 'string', id: i, ref: null, colIndex: i, distinctValues }
  })
  return { title: String(props.reportId), columns, rows: arr, totalRecords: arr.length }
}

function parseColumnFirstFormat(response) {
  const title = response.obj?.val || response.title || String(props.reportId)

  const detectedTypeId = response.type_id || response.typeId || response.obj?.type || response.obj?.arr_type || null
  if (detectedTypeId) {
    reportTypeId.value = detectedTypeId
  }

  const columns = response.columns.map((col, i) => ({
    field: col.name || `col_${i}`,
    header: col.name || `Column ${i + 1}`,
    format: col.format || 'CHARS',
    type: col.type || 'string',
    id: col.id || i,
    ref: col.ref || null,
    colIndex: col.col !== undefined ? col.col : i,
    distinctValues: null
  }))

  const firstColType = columns[0]?.type
  const idColumn = columns.find((col, i) =>
    i > 0 &&
    col.format === 'NUMBER' &&
    (col.type === firstColType ||
     col.field.toUpperCase().endsWith('ID'))
  )

  let rows = []
  if (response.data && Array.isArray(response.data) && response.data.length > 0) {
    const numRows = response.data[0]?.length ?? 0
    for (let r = 0; r < numRows; r++) {
      const row = {}
      for (let c = 0; c < response.data.length; c++) {
        row[columns[c].field] = response.data[c]?.[r] ?? null
      }
      const firstVal = row[columns[0]?.field]
      if (typeof firstVal === 'number') {
        row._objectId = firstVal
        if (!reportTypeId.value && response.columns[0]?.ref) {
          reportTypeId.value = response.columns[0].ref
        }
      } else if (idColumn) {
        const idVal = row[idColumn.field]
        if (idVal !== null && idVal !== undefined) {
          row._objectId = parseInt(String(idVal))
        }
      }
      rows.push(row)
    }
  }

  return { title, columns, rows, totalRecords: rows.length }
}

function detectFormat(arr, name) {
  const samples = arr.slice(0, 10).map(r => r[name]).filter(v => v !== null && v !== undefined && v !== '')
  if (!samples.length) return 'CHARS'
  if (samples.every(v => !isNaN(parseFloat(v)) && isFinite(v))) return 'NUMBER'
  if (samples.every(v => !isNaN(new Date(v).getTime()))) return 'DATE'
  return 'CHARS'
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => loadReportData())

watch(() => props.reportId, () => {
  clearCellSelection()
  loadReportData()
})
</script>

<style scoped>
.smartq-viewer {
  width: 100%;
}

.smartq-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
}

.report-header {
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--surface-border);
}

.subtotals-bar {
  background: var(--p-content-background);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 0.5rem 1rem;
}

.pagination-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
}

.pagination-info {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.raw-response pre {
  background: var(--p-content-background);
  color: var(--text-color);
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  overflow: auto;
  max-height: 400px;
}

/* ========================================
   CODA-STYLE DATATABLE
   ======================================== */

.coda-style-datatable {
  --header-bg: var(--surface-ground);
  --row-hover: var(--surface-hover);
  --border-color: var(--surface-border);
  --text-color: var(--text-color-primary);
  --counter-color: var(--text-color-secondary);
  --cell-padding: 12px 16px;
  --font-size: 14px;
  --line-height: 20px;

  display: block !important;
  position: relative;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.table-container {
  overflow-x: auto;
  overflow-y: auto;
  border-radius: 8px;
  background: var(--surface-a);
  position: relative;
  scrollbar-color: var(--text-color-secondary) transparent;
  max-height: 70vh;
}

table {
  width: max-content;
  border-collapse: collapse;
  font-size: var(--font-size);
  line-height: var(--line-height);
  table-layout: auto;
  position: relative;
}

th,
td {
  text-align: left;
  padding: var(--cell-padding);
  border: none;
  border-bottom: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
}

th {
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--header-bg);
  font-weight: 500;
  color: var(--text-color);
  user-select: none;
  max-height: calc(2 * 1.3em + 20px);
  overflow: hidden;
}

td {
  background: var(--surface-a);
  color: var(--text-color);
  max-width: 0;
  overflow: hidden;
}

tr:hover td {
  background: var(--row-hover);
}

/* Row Counter */
.row-counter-header {
  z-index: 4;
  position: sticky;
  left: 0;
}

.row-counter-cell {
  z-index: 2;
  color: var(--counter-color);
  border-right: none;
  position: sticky;
  left: 0;
  overflow: visible;
}

.cell-content {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-content.row-counter-unified {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 24px;
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
}

.row-number-coda {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  color: var(--text-color-secondary);
  cursor: pointer;
  user-select: none;
  line-height: 1;
}

.row-grip-btn,
.row-expand-btn {
  display: none;
  position: absolute;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--text-color-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.row-grip-btn {
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
}

.row-expand-btn {
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}

.row-grip-btn:hover,
.row-expand-btn:hover {
  background: var(--surface-c, #e9ecef);
  color: var(--text-color);
}

.grip-dots-icon {
  display: inline-block;
  width: 10px;
  height: 16px;
  background-image:
    radial-gradient(circle, currentColor 1.5px, transparent 1.5px),
    radial-gradient(circle, currentColor 1.5px, transparent 1.5px);
  background-size: 5px 5px;
  background-position: 0 1px, 5px 1px;
  background-repeat: repeat-y;
}

tr.data-row:hover .row-counter-unified .row-expand-btn,
tr.data-row:hover .row-counter-unified .row-grip-btn {
  display: flex;
}

tr.data-row:hover .row-counter-unified .row-number-coda {
  display: none;
}

.row-add-inline-btn {
  display: inline-flex;
  position: absolute;
  bottom: 0;
  transform: translateY(50%);
  right: 7px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--surface-border, #e2e8f0);
  background: var(--surface-a);
  color: var(--text-color-secondary);
  cursor: pointer;
  font-size: 8px;
  align-items: center;
  justify-content: center;
  z-index: 6;
  padding: 0;
  transition: background 0.1s ease, color 0.1s ease, border-color 0.1s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
}

.row-add-inline-btn .pi {
  font-size: 8px;
}

.row-add-inline-btn:hover {
  background: var(--primary-color, #6366f1);
  color: white;
  border-color: var(--primary-color, #6366f1);
}

/* Cell Selection */
.selected-cell {
  position: relative;
  z-index: 2;
}

.selected-cell::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid var(--primary-color);
  pointer-events: none;
  z-index: 1;
}

/* Editing Cell */
.editing-cell {
  position: relative;
}

.editing-cell::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid var(--primary-color);
  pointer-events: none;
  z-index: 1;
}

.cell-editor.seamless-editor {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  padding: var(--cell-padding);
}

.seamless-input,
.seamless-textarea,
.seamless-datepicker,
.seamless-dropdown {
  width: 100%;
  height: 100%;
  border: none !important;
  background: transparent !important;
  padding: 0 !important;
  font-size: inherit;
  font-family: inherit;
  color: inherit;
  outline: none !important;
  box-shadow: none !important;
}

:deep(.seamless-input .p-inputtext),
:deep(.seamless-dropdown .p-select),
:deep(.seamless-datepicker .p-datepicker-input) {
  border: none !important;
  background: transparent !important;
  padding: 0 !important;
  font-size: inherit;
  font-family: inherit;
  color: inherit;
  outline: none !important;
  box-shadow: none !important;
}

/* Reference field chips */
.dir-tag,
.dir-single-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  color: var(--text-color);
  margin: 1px 2px;
  cursor: pointer;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.15s ease;
}

.dir-tag:hover,
.dir-single-tag:hover {
  background: var(--surface-hover);
  border-color: var(--surface-border);
}

.dir-tag.no-edit,
.dir-single-tag.no-edit {
  cursor: default;
}

.dir-tag-remove,
.dir-single-clear {
  font-size: 0.65rem;
  cursor: pointer;
  opacity: 0;
  flex-shrink: 0;
  transition: opacity 0.15s ease;
}

.dir-tag:hover .dir-tag-remove,
.dir-single-tag:hover .dir-single-clear {
  opacity: 1;
}

.select-arrow-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.7rem;
  color: var(--text-color-secondary);
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: auto;
  cursor: pointer;
}

.data-cell:hover .select-arrow-icon {
  opacity: 1;
}

.cell-empty-placeholder {
  display: inline-block;
  min-width: 1rem;
  min-height: 1rem;
}

.cell-ref-text {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.ref-editor-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
}

.ref-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  min-height: 1.5rem;
}

.cell-readonly {
  cursor: default;
  color: var(--text-color-secondary);
}

.cell-saving {
  opacity: 0.6;
}

.saving-indicator {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--primary-color);
  font-size: 0.75rem;
}

.new-row {
  background-color: color-mix(in srgb, var(--green-500) 15%, transparent) !important;
}

.empty-state-cell {
  text-align: center;
}

/* Text Alignment */
.text-right { text-align: right; }
.text-center { text-align: center; }

/* Text Wrap Mode */
.text-wrap-enabled .cell-content {
  white-space: normal;
  word-break: normal;
  overflow-wrap: break-word;
}

.text-wrap-enabled tbody tr {
  height: auto !important;
}

.text-wrap-enabled td {
  vertical-align: top;
}

.text-wrap-disabled .cell-content {
  max-height: 1.4em;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.text-wrap-disabled .cell-content:has(.dir-tag),
.text-wrap-disabled .cell-content:has(.dir-single-tag) {
  max-height: none;
  overflow: visible;
}

.text-wrap-disabled tbody td {
  overflow: hidden;
}

/* Dark Mode */
.app-dark .coda-style-datatable {
  --header-bg: var(--surface-800);
  --row-hover: var(--surface-700);
  --border-color: var(--surface-600);
}

.app-dark .row-counter-cell {
  border-right: none;
}

.app-dark .dir-tag,
.app-dark .dir-single-tag {
  background: var(--surface-700);
  border-color: var(--surface-500);
}

.app-dark .dir-tag:hover,
.app-dark .dir-single-tag:hover {
  background: var(--surface-600);
  border-color: var(--surface-400);
}
</style>
