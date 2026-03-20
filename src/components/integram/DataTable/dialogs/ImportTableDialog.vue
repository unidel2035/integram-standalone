<template>
  <Dialog
    :visible="visible"
    header="Импорт данных"
    :style="{ width: '800px' }"
    :modal="true"
    :breakpoints="{ '960px': '95vw', '640px': '100vw' }"
    @update:visible="$emit('update:visible', $event)"
    @hide="onDialogHide"
  >
    <div class="import-table-dialog">

      <!-- Step 1: File/Text Input -->
      <div v-if="step === 'input'" class="import-step">
        <div class="step-header mb-4">
          <div class="step-badge">1</div>
          <span class="step-title">Загрузка данных</span>
        </div>

        <!-- Drop zone -->
        <div
          class="drop-zone"
          :class="{ 'drop-zone--active': isDragging }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onFileDrop"
          @click="triggerFileInput"
        >
          <i class="pi pi-upload drop-zone__icon"></i>
          <div class="drop-zone__text">
            Перетащите файл сюда или нажмите для выбора
          </div>
          <div class="drop-zone__hint">
            Поддерживаются: CSV, JSON, XLSX, TXT
          </div>
          <input
            ref="fileInputRef"
            type="file"
            accept=".csv,.json,.xlsx,.xls,.txt"
            style="display: none"
            @change="onFileSelected"
          />
        </div>

        <Divider align="center">
          <span class="text-color-secondary text-sm">или вставьте текст</span>
        </Divider>

        <!-- Manual text input -->
        <Textarea
          v-model="rawText"
          rows="8"
          placeholder="Вставьте данные из буфера обмена (CSV, TSV, JSON)..."
          class="w-full font-mono text-sm"
          style="resize: vertical"
        />

        <!-- Parse settings -->
        <div class="parse-settings mt-3">
          <div class="settings-row">
            <div class="field">
              <label class="block mb-1 text-sm font-semibold">Разделитель</label>
              <Dropdown
                v-model="delimiter"
                :options="delimiterOptions"
                optionLabel="label"
                optionValue="value"
                class="w-full"
                @change="onDelimiterChange"
              />
            </div>
            <div class="field">
              <label class="block mb-1 text-sm font-semibold">Кодировка</label>
              <Dropdown
                v-model="encoding"
                :options="encodingOptions"
                optionLabel="label"
                optionValue="value"
                class="w-full"
              />
            </div>
            <div class="field field--checkbox">
              <Checkbox v-model="hasHeader" inputId="hasHeader" :binary="true" />
              <label for="hasHeader" class="ml-2 text-sm">Первая строка — заголовки</label>
            </div>
            <div class="field field--checkbox">
              <Checkbox v-model="trimSpaces" inputId="trimSpaces" :binary="true" />
              <label for="trimSpaces" class="ml-2 text-sm">Обрезать пробелы</label>
            </div>
          </div>
        </div>

        <!-- File info -->
        <div v-if="fileName" class="file-info mt-2">
          <i class="pi pi-file mr-2"></i>
          <span class="font-semibold">{{ fileName }}</span>
          <Button
            icon="pi pi-times"
            text
            rounded
            size="small"
            class="ml-2"
            @click="clearFile"
            v-tooltip="'Убрать файл'"
          />
        </div>
      </div>

      <!-- Step 2: Preview & Column Mapping -->
      <div v-if="step === 'mapping'" class="import-step">
        <div class="step-header mb-3">
          <div class="step-badge">2</div>
          <span class="step-title">Маппинг колонок</span>
          <Badge :value="parsedRows.length + ' строк'" severity="secondary" class="ml-2" />
        </div>

        <!-- Preview table -->
        <div v-if="previewRows.length > 0" class="preview-table-wrapper mb-4">
          <div class="preview-label mb-2">
            <i class="pi pi-eye mr-1"></i>
            <span class="text-sm text-color-secondary">Предпросмотр (первые 5 строк)</span>
          </div>
          <div class="preview-table-scroll">
            <table class="preview-table">
              <thead>
                <tr>
                  <th v-for="(col, idx) in parsedColumns" :key="idx">
                    {{ hasHeader ? col : ('Колонка ' + (idx + 1)) }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rIdx) in previewRows" :key="rIdx">
                  <td v-for="(cell, cIdx) in row" :key="cIdx">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Column mapping -->
        <div class="mapping-section">
          <div class="mapping-header mb-2">
            <span class="text-sm font-semibold">Сопоставьте колонки файла с реквизитами таблицы</span>
          </div>

          <div class="mapping-rows">
            <div v-for="(col, idx) in parsedColumns" :key="idx" class="mapping-row">
              <div class="mapping-source">
                <span class="source-label">{{ hasHeader ? col : ('Колонка ' + (idx + 1)) }}</span>
                <span class="source-sample text-color-secondary">{{ getSampleValue(idx) }}</span>
              </div>
              <div class="mapping-arrow">
                <i class="pi pi-arrow-right"></i>
              </div>
              <div class="mapping-target">
                <Dropdown
                  v-model="columnMapping[idx]"
                  :options="mappingOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="— пропустить —"
                  class="w-full mapping-dropdown"
                  showClear
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: Import progress -->
      <div v-if="step === 'importing'" class="import-step">
        <div class="step-header mb-4">
          <div class="step-badge">3</div>
          <span class="step-title">Импорт данных</span>
        </div>

        <div class="import-progress">
          <div class="progress-stats mb-3">
            <span class="stats-text">{{ importedCount }} / {{ parsedRows.length }} записей</span>
            <span v-if="errorCount > 0" class="stats-errors ml-3 text-red-500">
              <i class="pi pi-exclamation-circle mr-1"></i>{{ errorCount }} ошибок
            </span>
          </div>
          <ProgressBar :value="importProgress" class="mb-3" />
          <div v-if="currentBatch > 0" class="text-sm text-color-secondary">
            Пакет {{ currentBatch }} / {{ totalBatches }}...
          </div>
        </div>

        <!-- Error log -->
        <div v-if="importErrors.length > 0" class="error-log mt-3">
          <div class="error-log-header">
            <i class="pi pi-exclamation-triangle mr-1"></i>
            <span class="font-semibold text-sm">Ошибки импорта</span>
          </div>
          <div class="error-log-body">
            <div v-for="(err, idx) in importErrors.slice(0, 20)" :key="idx" class="error-log-item">
              <span class="error-row">Строка {{ err.row }}</span>
              <span class="error-msg">{{ err.message }}</span>
            </div>
            <div v-if="importErrors.length > 20" class="text-color-secondary text-sm mt-1">
              ...ещё {{ importErrors.length - 20 }} ошибок
            </div>
          </div>
        </div>
      </div>

      <!-- Step 4: Done -->
      <div v-if="step === 'done'" class="import-step import-step--done">
        <div class="done-icon">
          <i class="pi" :class="errorCount > 0 ? 'pi-exclamation-triangle' : 'pi-check-circle'"></i>
        </div>
        <div class="done-text">
          <div class="done-title">
            {{ errorCount > 0 ? 'Импорт завершён с ошибками' : 'Импорт успешно завершён' }}
          </div>
          <div class="done-stats text-color-secondary">
            Загружено: {{ importedCount }} из {{ parsedRows.length }}
            <span v-if="errorCount > 0"> ({{ errorCount }} ошибок)</span>
          </div>
        </div>

        <!-- Error log on done step -->
        <div v-if="importErrors.length > 0" class="error-log mt-3 w-full">
          <div class="error-log-header">
            <i class="pi pi-exclamation-triangle mr-1"></i>
            <span class="font-semibold text-sm">Ошибки</span>
          </div>
          <div class="error-log-body">
            <div v-for="(err, idx) in importErrors.slice(0, 10)" :key="idx" class="error-log-item">
              <span class="error-row">Строка {{ err.row }}</span>
              <span class="error-msg">{{ err.message }}</span>
            </div>
            <div v-if="importErrors.length > 10" class="text-color-secondary text-sm mt-1">
              ...ещё {{ importErrors.length - 10 }} ошибок
            </div>
          </div>
        </div>
      </div>

    </div>

    <template #footer>
      <!-- Input step -->
      <template v-if="step === 'input'">
        <Button label="Отмена" text @click="close" />
        <Button
          label="Далее"
          icon="pi pi-arrow-right"
          iconPos="right"
          :disabled="!hasData"
          @click="parseData"
        />
      </template>

      <!-- Mapping step -->
      <template v-if="step === 'mapping'">
        <Button label="Назад" icon="pi pi-arrow-left" text @click="step = 'input'" />
        <Button label="Отмена" text @click="close" />
        <Button
          label="Начать импорт"
          icon="pi pi-upload"
          :disabled="!hasMappedColumns"
          @click="startImport"
        />
      </template>

      <!-- Importing step -->
      <template v-if="step === 'importing'">
        <Button
          label="Отмена"
          icon="pi pi-times"
          severity="danger"
          text
          :disabled="!importCancellable"
          @click="cancelImport"
        />
      </template>

      <!-- Done step -->
      <template v-if="step === 'done'">
        <Button label="Закрыть" @click="close" />
        <Button
          v-if="importedCount > 0"
          label="Обновить таблицу"
          icon="pi pi-refresh"
          @click="onRefreshAndClose"
        />
      </template>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import integramApiClient from '@/services/integramApiClient'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  typeId: {
    type: [String, Number],
    required: true
  },
  tableName: {
    type: String,
    default: ''
  },
  // Table headers/requisites from parent DataTableWrapper
  tableHeaders: {
    type: Array,
    default: () => []
  },
  database: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:visible', 'import-complete'])

// ── Step management ──────────────────────────────────────────────────────────
const step = ref('input') // 'input' | 'mapping' | 'importing' | 'done'

// ── File / text input state ──────────────────────────────────────────────────
const fileInputRef = ref(null)
const isDragging = ref(false)
const fileName = ref('')
const rawText = ref('')
const delimiter = ref('auto')
const encoding = ref('utf-8')
const hasHeader = ref(true)
const trimSpaces = ref(true)

const delimiterOptions = [
  { label: 'Авто', value: 'auto' },
  { label: 'Запятая (,)', value: ',' },
  { label: 'Точка с запятой (;)', value: ';' },
  { label: 'Табуляция (TAB)', value: '\t' },
  { label: 'Вертикальная черта (|)', value: '|' }
]

const encodingOptions = [
  { label: 'UTF-8', value: 'utf-8' },
  { label: 'Windows-1251', value: 'windows-1251' }
]

// ── Parsed data state ────────────────────────────────────────────────────────
const parsedColumns = ref([]) // Column names (from header row or auto-generated)
const parsedRows = ref([])    // Array of arrays (each row is array of values)

// ── Column mapping ───────────────────────────────────────────────────────────
// columnMapping[fileColumnIndex] = requisiteId (or null to skip)
const columnMapping = ref({})

// ── Import state ─────────────────────────────────────────────────────────────
const importedCount = ref(0)
const errorCount = ref(0)
const importErrors = ref([])
const currentBatch = ref(0)
const totalBatches = ref(0)
const importCancellable = ref(true)
let cancelFlag = false

// ── Computed ─────────────────────────────────────────────────────────────────
const hasData = computed(() => rawText.value.trim().length > 0)

const previewRows = computed(() => parsedRows.value.slice(0, 5))

const importProgress = computed(() => {
  if (parsedRows.value.length === 0) return 0
  return Math.round((importedCount.value / parsedRows.value.length) * 100)
})

const hasMappedColumns = computed(() => {
  return Object.values(columnMapping.value).some(v => v !== null && v !== undefined && v !== '')
})

// Build mapping options from table headers
const mappingOptions = computed(() => {
  const opts = [{ label: '— главное значение (val) —', value: '__val__' }]
  for (const h of props.tableHeaders) {
    if (h.id && h.value && !h.isSystem) {
      opts.push({ label: h.value, value: String(h.id) })
    }
  }
  return opts
})

// ── File handling ─────────────────────────────────────────────────────────────
function triggerFileInput() {
  fileInputRef.value?.click()
}

function onFileDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) loadFile(file)
}

function onFileSelected(e) {
  const file = e.target.files?.[0]
  if (file) loadFile(file)
}

function clearFile() {
  fileName.value = ''
  rawText.value = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function loadFile(file) {
  fileName.value = file.name
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'xlsx' || ext === 'xls') {
    await loadExcel(file)
  } else {
    const text = await readFileText(file)
    rawText.value = text
  }
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file, encoding.value)
  })
}

async function loadExcel(file) {
  // Dynamically load XLSX (already in package.json)
  const XLSX = await import('xlsx')
  const data = await file.arrayBuffer()
  const wb = XLSX.read(data, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  // Convert to CSV for unified processing
  rawText.value = XLSX.utils.sheet_to_csv(ws)
}

function onDelimiterChange() {
  // Re-parse when delimiter changes (if on mapping step)
  if (step.value === 'mapping') {
    parseData()
  }
}

// ── Parsing ───────────────────────────────────────────────────────────────────
function parseData() {
  const text = rawText.value.trim()
  if (!text) return

  let rows = []

  // Try JSON first
  if (text.startsWith('[') || text.startsWith('{')) {
    rows = parseJSON(text)
  } else {
    rows = parseCSV(text)
  }

  if (rows.length === 0) return

  // Extract column names from first row if hasHeader
  if (hasHeader.value && rows.length > 0) {
    parsedColumns.value = rows[0].map(c => trimSpaces.value ? String(c).trim() : String(c))
    parsedRows.value = rows.slice(1)
  } else {
    const colCount = rows[0]?.length || 0
    parsedColumns.value = Array.from({ length: colCount }, (_, i) => `Колонка ${i + 1}`)
    parsedRows.value = rows
  }

  // Trim all cells if needed
  if (trimSpaces.value) {
    parsedRows.value = parsedRows.value.map(row => row.map(c => String(c ?? '').trim()))
  }

  // Auto-map columns by name to matching table headers
  autoMapColumns()

  step.value = 'mapping'
}

function detectDelimiter(text) {
  const line = text.split('\n')[0]
  const counts = {
    '\t': (line.match(/\t/g) || []).length,
    ';': (line.match(/;/g) || []).length,
    ',': (line.match(/,/g) || []).length,
    '|': (line.match(/\|/g) || []).length
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

function parseCSV(text) {
  const sep = delimiter.value === 'auto' ? detectDelimiter(text) : delimiter.value

  const rows = []
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim()) continue
    rows.push(splitCSVLine(line, sep))
  }
  return rows
}

function splitCSVLine(line, sep) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === sep && !inQuotes) {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells
}

function parseJSON(text) {
  try {
    let data = JSON.parse(text)
    if (!Array.isArray(data)) data = [data]
    if (data.length === 0) return []

    const allKeys = [...new Set(data.flatMap(obj => Object.keys(obj)))]
    const rows = []

    // Header row
    rows.push(allKeys)

    // Data rows
    for (const obj of data) {
      rows.push(allKeys.map(k => {
        const v = obj[k]
        return v === null || v === undefined ? '' : String(v)
      }))
    }

    return rows
  } catch {
    return []
  }
}

function autoMapColumns() {
  const mapping = {}
  const opts = mappingOptions.value

  for (let i = 0; i < parsedColumns.value.length; i++) {
    const colName = parsedColumns.value[i].toLowerCase()

    // Try to match by header value (case-insensitive)
    const match = opts.find(o => o.label.toLowerCase() === colName)
    if (match) {
      mapping[i] = match.value
    } else {
      mapping[i] = null
    }
  }

  columnMapping.value = mapping
}

function getSampleValue(colIdx) {
  const row = previewRows.value[0]
  if (!row) return ''
  const val = row[colIdx]
  if (val === undefined || val === null || val === '') return '(пусто)'
  return String(val).substring(0, 30)
}

// ── Import ────────────────────────────────────────────────────────────────────
const BATCH_SIZE = 200

async function startImport() {
  step.value = 'importing'
  importedCount.value = 0
  errorCount.value = 0
  importErrors.value = []
  cancelFlag = false
  importCancellable.value = true

  const rows = parsedRows.value
  totalBatches.value = Math.ceil(rows.length / BATCH_SIZE)

  // Ensure database is set
  if (props.database) {
    integramApiClient.setDatabase(props.database)
  }

  for (let batchIdx = 0; batchIdx < totalBatches.value; batchIdx++) {
    if (cancelFlag) break

    currentBatch.value = batchIdx + 1
    const batchRows = rows.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE)

    await importBatch(batchRows, batchIdx * BATCH_SIZE)
  }

  importCancellable.value = false
  step.value = 'done'
}

async function importBatch(batchRows, rowOffset) {
  // We create records one by one (createObject approach used throughout codebase)
  // This is more reliable than the bki_file bulk approach, and works with the
  // existing integramApiClient.createObject which handles auth headers correctly.
  for (let i = 0; i < batchRows.length; i++) {
    if (cancelFlag) break

    const row = batchRows[i]
    const globalRowNum = rowOffset + i + 1

    try {
      await importRow(row, globalRowNum)
      importedCount.value++
    } catch (err) {
      errorCount.value++
      importErrors.value.push({
        row: globalRowNum,
        message: err?.message || String(err)
      })
    }
  }
}

async function importRow(row, rowNum) {
  let mainValue = ''
  const requisites = {}

  for (const [colIdxStr, targetField] of Object.entries(columnMapping.value)) {
    const colIdx = Number(colIdxStr)
    const cellValue = row[colIdx] ?? ''
    if (!targetField) continue // skip unmapped

    if (targetField === '__val__') {
      mainValue = cellValue
    } else {
      requisites[targetField] = cellValue
    }
  }

  // Use main value or first mapped column as fallback
  if (!mainValue) {
    mainValue = ' ' // Integram requires non-empty value
  }

  await integramApiClient.createObject(props.typeId, mainValue, requisites)
}

function cancelImport() {
  cancelFlag = true
  importCancellable.value = false
}

// ── Dialog control ────────────────────────────────────────────────────────────
function close() {
  emit('update:visible', false)
}

function onRefreshAndClose() {
  emit('import-complete', { count: importedCount.value })
  emit('update:visible', false)
}

function onDialogHide() {
  if (step.value === 'done' && importedCount.value > 0) {
    emit('import-complete', { count: importedCount.value })
  }
}

// Reset state when dialog opens
watch(() => props.visible, (val) => {
  if (val) {
    step.value = 'input'
    rawText.value = ''
    fileName.value = ''
    parsedColumns.value = []
    parsedRows.value = []
    columnMapping.value = {}
    importedCount.value = 0
    errorCount.value = 0
    importErrors.value = []
    currentBatch.value = 0
    totalBatches.value = 0
    cancelFlag = false
    delimiter.value = 'auto'
    hasHeader.value = true
    trimSpaces.value = true
  }
})
</script>

<style scoped>
.import-table-dialog {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 300px;
}

.import-step {
  width: 100%;
}

/* Step header */
.step-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary-color, #6366f1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.step-title {
  font-weight: 600;
  font-size: 15px;
}

/* Drop zone */
.drop-zone {
  border: 2px dashed var(--surface-border, #dee2e6);
  border-radius: 10px;
  padding: 32px 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.drop-zone:hover,
.drop-zone--active {
  border-color: var(--primary-color, #6366f1);
  background: var(--highlight-bg, #f0f0ff);
}

.drop-zone__icon {
  font-size: 2rem;
  color: var(--primary-color, #6366f1);
  display: block;
  margin-bottom: 10px;
}

.drop-zone__text {
  font-weight: 500;
  margin-bottom: 4px;
}

.drop-zone__hint {
  font-size: 12px;
  color: var(--text-color-secondary, #888);
}

/* Parse settings */
.parse-settings .settings-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.parse-settings .field {
  flex: 1;
  min-width: 140px;
}

.parse-settings .field--checkbox {
  display: flex;
  align-items: center;
  min-width: auto;
  padding-bottom: 6px;
}

/* File info */
.file-info {
  display: flex;
  align-items: center;
  color: var(--text-color-secondary);
  font-size: 13px;
}

/* Preview table */
.preview-table-wrapper {
  overflow: hidden;
}

.preview-table-scroll {
  overflow-x: auto;
  border: 1px solid var(--surface-border, #dee2e6);
  border-radius: 6px;
  max-height: 180px;
}

.preview-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12px;
}

.preview-table th {
  background: var(--surface-ground, #f8f9fa);
  padding: 6px 10px;
  border-bottom: 1px solid var(--surface-border, #dee2e6);
  white-space: nowrap;
  font-weight: 600;
  position: sticky;
  top: 0;
  text-align: left;
}

.preview-table td {
  padding: 5px 10px;
  border-bottom: 1px solid var(--surface-border, #dee2e6);
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Column mapping */
.mapping-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
}

.mapping-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px;
  align-items: center;
  padding: 6px 10px;
  background: var(--surface-hover, #f8f9fa);
  border-radius: 6px;
}

.mapping-source {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.source-label {
  font-weight: 500;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-sample {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mapping-arrow {
  color: var(--text-color-secondary);
  font-size: 14px;
}

/* Import progress */
.import-progress {
  padding: 12px;
  background: var(--surface-hover, #f8f9fa);
  border-radius: 8px;
}

.progress-stats {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 500;
}

/* Error log */
.error-log {
  border: 1px solid var(--red-200, #fca5a5);
  border-radius: 6px;
  overflow: hidden;
}

.error-log-header {
  background: var(--red-50, #fef2f2);
  padding: 6px 12px;
  font-size: 13px;
  border-bottom: 1px solid var(--red-200, #fca5a5);
}

.error-log-body {
  max-height: 160px;
  overflow-y: auto;
  padding: 6px 0;
}

.error-log-item {
  display: flex;
  gap: 8px;
  padding: 3px 12px;
  font-size: 12px;
}

.error-row {
  color: var(--red-600, #dc2626);
  font-weight: 500;
  white-space: nowrap;
}

.error-msg {
  color: var(--text-color-secondary);
}

/* Done step */
.import-step--done {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  gap: 12px;
}

.done-icon {
  font-size: 3.5rem;
  color: var(--green-500, #22c55e);
}

.done-icon .pi-exclamation-triangle {
  color: var(--orange-500, #f97316);
}

.done-text {
  text-align: center;
}

.done-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.done-stats {
  font-size: 14px;
}

.mapping-dropdown {
  font-size: 13px;
}
</style>
