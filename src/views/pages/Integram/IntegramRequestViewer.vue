<template>
  <div class="integram-request-viewer-container" :class="`row-density-${rowDensity}`">
    <!-- Breadcrumb -->
    <IntegramBreadcrumb :items="breadcrumbItems" />

    <Card>
      <template #title>
        <div class="table-header-row">
          <!-- Left: Title + Badge -->
          <div class="flex align-items-start gap-2">
            <span class="table-title">{{ reportTitle || 'Загрузка...' }}</span>
            <Badge
              v-if="reportData && reportData.rows"
              :value="reportData.rows.length"
              class="records-badge"
            />
          </div>

          <!-- Right: Toolbar buttons + Search -->
          <div class="table-header-toolbar">
            <!-- Toolbar buttons -->
            <div class="flex gap-1">
              <Button
                icon="pi pi-refresh"
                size="small"
                text
                rounded
                @click="executeReport"
                v-tooltip.bottom="'Обновить'"
                :loading="loading"
                data-testid="execute-report-button"
              />
              <Button
                icon="pi pi-pencil"
                size="small"
                text
                rounded
                @click="toggleInlineEdit"
                :class="{ 'p-button-primary': inlineEditEnabled }"
                v-tooltip.bottom="'Редактировать ячейки'"
              />
              <Button
                :icon="hasActiveFilters ? 'pi pi-filter-fill' : 'pi pi-filter'"
                size="small"
                text
                rounded
                @click="showFilters = !showFilters"
                v-tooltip.bottom="'Фильтры'"
              />
              <Button
                icon="pi pi-check-square"
                size="small"
                text
                rounded
                :class="{ 'p-button-primary': isSelectionModeActive }"
                @click="toggleSelectionMode"
                v-tooltip.bottom="'Выделение строк'"
              />
              <Button
                icon="pi pi-calculator"
                size="small"
                text
                rounded
                :class="{ 'p-button-primary': isFooterActive }"
                @click="toggleFooter"
                v-tooltip.bottom="'Футер с агрегациями'"
              />
              <Button
                icon="pi pi-eye-slash"
                size="small"
                text
                rounded
                @click="showColumnDialog = true"
                v-tooltip.bottom="'Колонки'"
              />
              <Button
                icon="pi pi-print"
                size="small"
                text
                rounded
                @click="printReport"
                v-tooltip.bottom="'Печать'"
              />
              <Button
                icon="pi pi-file-excel"
                size="small"
                text
                rounded
                @click="exportToExcel"
                v-tooltip.bottom="'Excel'"
              />
              <Button
                icon="pi pi-file-pdf"
                size="small"
                text
                rounded
                @click="exportToPDF"
                v-tooltip.bottom="'PDF'"
              />
              <Button
                icon="pi pi-link"
                size="small"
                text
                rounded
                @click="copyReportLink"
                v-tooltip.bottom="'Скопировать ссылку на отчёт'"
              />
              <Button
                :icon="getRowDensityIcon()"
                size="small"
                text
                rounded
                @click="cycleRowDensity"
                v-tooltip.bottom="`Плотность строк: ${getRowDensityLabel()}`"
              />
              <Button
                icon="pi pi-sliders-h"
                size="small"
                text
                rounded
                @click="showConfiguratorDialog = true"
                v-tooltip.bottom="'Конфигуратор отчета'"
              />
              <Button
                icon="pi pi-cog"
                size="small"
                text
                rounded
                @click="showSettingsDialog = true"
                v-tooltip.bottom="'Настройки'"
              />
              <Button
                icon="pi pi-question-circle"
                size="small"
                text
                rounded
                @click="showHelpDialog = true"
                v-tooltip.bottom="'Справка'"
              />
            </div>

            <!-- Search field with navigation -->
            <div class="search-with-navigation">
              <IconField iconPosition="left" class="header-search">
                <InputIcon class="pi pi-search" />
                <InputText
                  v-model="searchQuery"
                  placeholder="Поиск..."
                  @input="onSearchInput"
                />
              </IconField>
              <div v-if="searchMatches.length > 0" class="search-navigation-controls">
                <span class="search-counter">
                  {{ currentMatchIndex + 1 }} / {{ searchMatches.length }}
                </span>
                <Button
                  icon="pi pi-chevron-up"
                  size="small"
                  text
                  rounded
                  @click="prevSearchMatch"
                  v-tooltip.bottom="'Предыдущий (Shift+F3)'"
                />
                <Button
                  icon="pi pi-chevron-down"
                  size="small"
                  text
                  rounded
                  @click="nextSearchMatch"
                  v-tooltip.bottom="'Следующий (F3)'"
                />
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #content>
        <!-- SQL Editor Panel -->
        <div v-if="showSQLEditor" class="sql-editor-panel mb-3 p-3 surface-50 border-round">
          <label class="block mb-2 font-semibold">SQL Query</label>
          <Textarea
            v-model="sqlQuery"
            rows="5"
            class="w-full mb-2"
            placeholder="SELECT ..."
          />
          <Button
            label="Выполнить"
            icon="pi pi-play"
            @click="executeSQLQuery"
            size="small"
            :loading="executingSQL"
          />
        </div>

        <div v-if="loading && !reportData" class="text-center py-5">
          <ProgressSpinner />
        </div>

        <div v-else-if="error" class="text-center py-5">
          <Message severity="error" :closable="false">{{ error }}</Message>
        </div>

        <div v-else-if="reportData" ref="tableWrapperRef" class="table-wrapper">
          <!-- Filter row -->
          <div v-if="showFilters && columns.length > 0" class="filter-panel mb-3 p-3 border-round surface-50">
            <div class="grid">
              <div class="col-12 md:col-3" v-for="col in visibleColumns" :key="col.field">
                <label class="text-sm mb-2 block">{{ col.header }}</label>
                <InputText
                  v-model="filters[col.field]"
                  :placeholder="`Фильтр по ${col.header}`"
                  class="w-full"
                  size="small"
                />
              </div>
            </div>
          </div>

          <!-- Data Table (Custom Integram Component) -->
          <DataTable
            ref="dataTableRef"
            :headers="headers"
            :rows="filteredRows"
            :is-loading="loading"
            :disable-editing="!inlineEditEnabled"
            :report="true"
            :database="database"
            :server-url="'https://ai2o.ru'"
            :edit-mode="'double-click'"
            :date-style="'relative'"
            @cell-update="handleCellUpdate"
            @row-update="handleRowUpdate"
            @add-row="handleAddRow"
            @add-column="handleAddColumn"
            @delete-row="handleRowDelete"
            @header-action="handleHeaderAction"
            @bulk-delete="handleBulkDelete"
            @load-directory-list="handleLoadDirectoryList"
            @load-dir-row="handleLoadDirRow"
            data-testid="report-data-table"
          />

          <!-- Summary -->
          <div class="mt-3 text-color-secondary text-sm">
            Показано {{ filteredRows.length }} строк
            <span v-if="hasActiveFilters"> (фильтры применены)</span>
          </div>
        </div>
      </template>
    </Card>

    <!-- Column Visibility Dialog -->
    <Dialog
      v-model:visible="showColumnDialog"
      header="Управление колонками"
      :style="{ width: '30rem' }"
      :modal="true"
    >
      <div class="column-visibility-list">
        <div v-for="col in columns" :key="col.field" class="field-checkbox mb-2">
          <Checkbox
            :inputId="'col_' + col.field"
            v-model="col.visible"
            :binary="true"
          />
          <label :for="'col_' + col.field" class="ml-2">{{ col.header }}</label>
        </div>
      </div>
    </Dialog>

    <!-- Parameters Dialog -->
    <Dialog
      v-model:visible="showParametersDialog"
      header="Параметры отчёта"
      :style="{ width: '40rem' }"
      :modal="true"
    >
      <div class="parameters-form">
        <div v-for="(param, index) in reportParameters" :key="index" class="field mb-3">
          <label :for="'param_' + index" class="block mb-2">{{ param.name }}</label>
          <InputText
            :id="'param_' + index"
            v-model="param.value"
            class="w-full"
            :placeholder="param.name"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" text @click="showParametersDialog = false" />
        <Button label="Применить" @click="applyParameters" />
      </template>
    </Dialog>

    <!-- Settings Dialog -->
    <Dialog
      v-model:visible="showSettingsDialog"
      header="Настройки отчёта"
      :style="{ width: '40rem' }"
      :modal="true"
    >
      <div class="flex flex-column gap-3">
        <div class="field-checkbox">
          <Checkbox
            inputId="autoRefresh"
            v-model="infiniteScrollEnabled"
            :binary="true"
          />
          <label for="autoRefresh" class="ml-2">Автоматическая прокрутка</label>
        </div>
        <p class="text-color-secondary text-sm">Дополнительные настройки в разработке</p>
      </div>
      <template #footer>
        <Button label="Закрыть" text @click="showSettingsDialog = false" />
      </template>
    </Dialog>

    <!-- Help Dialog -->
    <Dialog
      v-model:visible="showHelpDialog"
      header="Справка"
      :style="{ width: '40rem' }"
      :modal="true"
    >
      <div class="flex flex-column gap-3">
        <h4>Горячие клавиши</h4>
        <ul class="list-none p-0 m-0">
          <li class="mb-2"><strong>F3</strong> - Следующий результат поиска</li>
          <li class="mb-2"><strong>Shift+F3</strong> - Предыдущий результат поиска</li>
          <li class="mb-2"><strong>Ctrl+P</strong> - Печать</li>
        </ul>
        <h4>Функции</h4>
        <p class="text-sm text-color-secondary">
          Используйте панель инструментов для управления отображением данных,
          экспорта в различные форматы и настройки плотности строк.
        </p>
      </div>
      <template #footer>
        <Button label="Закрыть" text @click="showHelpDialog = false" />
      </template>
    </Dialog>

    <!-- Report Configurator Dialog -->
    <Dialog
      v-model:visible="showConfiguratorDialog"
      header="Конфигуратор умного отчета"
      :style="{ width: '70rem' }"
      :modal="true"
      maximizable
    >
      <TabView>
        <!-- Basic Settings -->
        <TabPanel header="Основные">
          <div class="flex flex-column gap-3">
            <div class="form-group">
              <label for="reportName" class="block mb-2 font-medium">Название отчета</label>
              <InputText
                id="reportName"
                v-model="reportConfig.name"
                class="w-full"
                placeholder="Введите название"
              />
            </div>

            <div class="form-group">
              <label for="reportDescription" class="block mb-2 font-medium">Описание</label>
              <Textarea
                id="reportDescription"
                v-model="reportConfig.description"
                rows="3"
                class="w-full"
                placeholder="Краткое описание отчета"
              />
            </div>

            <div class="form-group">
              <label class="block mb-2 font-medium">Категория</label>
              <Dropdown
                v-model="reportConfig.category"
                :options="reportCategories"
                optionLabel="label"
                optionValue="value"
                placeholder="Выберите категорию"
                class="w-full"
              />
            </div>

            <Divider />

            <div class="flex gap-3">
              <div class="field-checkbox">
                <Checkbox
                  inputId="isPublic"
                  v-model="reportConfig.isPublic"
                  :binary="true"
                />
                <label for="isPublic" class="ml-2">Общий доступ</label>
              </div>
              <div class="field-checkbox">
                <Checkbox
                  inputId="isTemplate"
                  v-model="reportConfig.isTemplate"
                  :binary="true"
                />
                <label for="isTemplate" class="ml-2">Шаблон</label>
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- Display Settings -->
        <TabPanel header="Отображение">
          <div class="flex flex-column gap-3">
            <div class="form-group">
              <label class="block mb-2 font-medium">Плотность строк</label>
              <SelectButton
                v-model="reportConfig.rowDensity"
                :options="rowDensityOptions"
                optionLabel="label"
                optionValue="value"
              />
            </div>

            <Divider />

            <div class="form-group">
              <label class="block mb-2 font-medium">Включить функции</label>
              <div class="flex flex-column gap-2">
                <div class="field-checkbox">
                  <Checkbox
                    inputId="enableInlineEdit"
                    v-model="reportConfig.features.inlineEdit"
                    :binary="true"
                  />
                  <label for="enableInlineEdit" class="ml-2">Inline редактирование</label>
                </div>
                <div class="field-checkbox">
                  <Checkbox
                    inputId="enableExport"
                    v-model="reportConfig.features.export"
                    :binary="true"
                  />
                  <label for="enableExport" class="ml-2">Экспорт (CSV, Excel, PDF)</label>
                </div>
                <div class="field-checkbox">
                  <Checkbox
                    inputId="enableFilters"
                    v-model="reportConfig.features.filters"
                    :binary="true"
                  />
                  <label for="enableFilters" class="ml-2">Фильтры колонок</label>
                </div>
                <div class="field-checkbox">
                  <Checkbox
                    inputId="enableSelection"
                    v-model="reportConfig.features.selection"
                    :binary="true"
                  />
                  <label for="enableSelection" class="ml-2">Выделение строк</label>
                </div>
              </div>
            </div>

            <Divider />

            <div class="form-group">
              <label class="block mb-2 font-medium">Размер страницы по умолчанию</label>
              <InputNumber
                v-model="reportConfig.defaultPageSize"
                :min="10"
                :max="1000"
                :step="10"
                class="w-full"
              />
            </div>
          </div>
        </TabPanel>

        <!-- Columns Configuration -->
        <TabPanel header="Колонки">
          <div class="flex justify-content-end mb-3">
            <Button
              label="Автоопределение"
              icon="pi pi-sync"
              size="small"
              outlined
              @click="autoDetectColumns"
            />
          </div>

          <DataTable
            :value="reportConfig.columns"
            :reorderableColumns="true"
            @row-reorder="onColumnReorder"
          >
            <Column rowReorder headerStyle="width: 3rem" />
            <Column field="name" header="Название">
              <template #body="{ data }">
                <InputText
                  v-model="data.name"
                  class="w-full"
                />
              </template>
            </Column>
            <Column field="type" header="Тип">
              <template #body="{ data }">
                <Dropdown
                  v-model="data.type"
                  :options="columnTypes"
                  optionLabel="label"
                  optionValue="value"
                  class="w-full"
                />
              </template>
            </Column>
            <Column field="visible" header="Видимость">
              <template #body="{ data }">
                <Checkbox
                  v-model="data.visible"
                  :binary="true"
                />
              </template>
            </Column>
            <Column headerStyle="width: 4rem">
              <template #body="{ data, index }">
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  size="small"
                  @click="removeColumn(index)"
                />
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- Templates -->
        <TabPanel header="Шаблоны">
          <div class="templates-grid">
            <Card
              v-for="template in configTemplates"
              :key="template.id"
              class="template-card cursor-pointer"
              @click="applyTemplate(template)"
            >
              <template #header>
                <div class="text-center p-3">
                  <i :class="template.icon" class="text-4xl text-primary"></i>
                </div>
              </template>
              <template #title>
                <div class="text-center">{{ template.name }}</div>
              </template>
              <template #content>
                <p class="text-sm text-center">{{ template.description }}</p>
              </template>
              <template #footer>
                <div class="flex justify-content-center">
                  <Button
                    label="Применить"
                    icon="pi pi-check"
                    size="small"
                    @click.stop="applyTemplate(template)"
                  />
                </div>
              </template>
            </Card>
          </div>
        </TabPanel>
      </TabView>

      <template #footer>
        <div class="flex justify-content-between">
          <Button
            label="Отменить"
            icon="pi pi-times"
            text
            @click="showConfiguratorDialog = false"
          />
          <Button
            label="Сохранить конфигурацию"
            icon="pi pi-save"
            @click="saveReportConfiguration"
          />
        </div>
      </template>
    </Dialog>

    <!-- Context Menu -->
    <ContextMenu ref="rowContextMenu" :model="rowContextMenuItems" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import integramService from '@/services/integramApiClient'
import apiClient from '@/axios2.js'
import IntegramBreadcrumb from '@/components/integram/IntegramBreadcrumb.vue'
import DataTable from '@/components/integram/DataTable.vue'
import DOMPurify from 'dompurify'
import { logger } from '@/utils/logger'

const route = useRoute()
const router = useRouter()
const toast = useToast()

// Props from route
const requestId = ref(route.params.request_id)
const database = computed(() => route.params.database || 'A2025')

// State
const loading = ref(false)
const error = ref(null)
const showFilters = ref(false)
const showExtraControls = ref(false)
const inlineEditEnabled = ref(true) // Enable inline editing by default
const showSQLEditor = ref(false)
const showColumnDialog = ref(false)
const showParametersDialog = ref(false)
const showSettingsDialog = ref(false)
const showHelpDialog = ref(false)
const showConfiguratorDialog = ref(false)
const executingSQL = ref(false)
const isSelectionModeActive = ref(false)
const isFooterActive = ref(false)

// Search state
const searchQuery = ref('')
const searchMatches = ref([])
const currentMatchIndex = ref(-1)

// Report data
const reportData = ref(null)
const reportTitle = ref('')
const reportParameters = ref([])
const sqlQuery = ref('')

// Columns
const columns = ref([])

// Report Configuration
const reportConfig = ref({
  name: '',
  description: '',
  category: 'other',
  isPublic: false,
  isTemplate: false,
  rowDensity: 'normal',
  features: {
    inlineEdit: true,
    export: true,
    filters: true,
    selection: false
  },
  defaultPageSize: 50,
  columns: []
})

// Configuration Options
const reportCategories = [
  { label: 'Аналитика', value: 'analytics' },
  { label: 'Финансы', value: 'finance' },
  { label: 'Продажи', value: 'sales' },
  { label: 'HR', value: 'hr' },
  { label: 'Операции', value: 'operations' },
  { label: 'Другое', value: 'other' }
]

const rowDensityOptions = [
  { label: 'Компактный', value: 'compact' },
  { label: 'Обычный', value: 'normal' },
  { label: 'Комфортный', value: 'comfortable' }
]

const columnTypes = [
  { label: 'Текст', value: 'text' },
  { label: 'Число', value: 'number' },
  { label: 'Дата', value: 'date' },
  { label: 'Булево', value: 'boolean' },
  { label: 'Ссылка', value: 'reference' }
]

const configTemplates = [
  {
    id: 1,
    name: 'Простой список',
    description: 'Базовая таблица с фильтрами и сортировкой',
    icon: 'pi pi-list',
    config: {
      rowDensity: 'normal',
      features: {
        inlineEdit: false,
        export: true,
        filters: true,
        selection: false
      }
    }
  },
  {
    id: 2,
    name: 'Редактируемая таблица',
    description: 'Таблица с возможностью редактирования',
    icon: 'pi pi-pencil',
    config: {
      rowDensity: 'normal',
      features: {
        inlineEdit: true,
        export: true,
        filters: true,
        selection: true
      }
    }
  },
  {
    id: 3,
    name: 'Аналитический отчет',
    description: 'Отчет с агрегациями',
    icon: 'pi pi-chart-bar',
    config: {
      rowDensity: 'compact',
      features: {
        inlineEdit: false,
        export: true,
        filters: true,
        selection: false
      }
    }
  }
]

// Convert simple report columns to DataTable headers format
const headers = computed(() => {
  return columns.value.map((col, index) => ({
    id: col.headerId !== undefined ? col.headerId : col.field, // Use headerId for array/legacy, field for Integram
    value: col.header, // Display name
    alias: col.header, // Alias same as header for reports
    type: col.type || 3, // Use column type or default to SHORT text
    visible: col.visible !== false,
    isHTML: col.isHTML || false,
    ref: col.ref || null,
    multy: col.multy || false,
    notNull: col.notNull || false,
    isMain: col.isMain !== undefined ? col.isMain : (index === 0),
    isNested: false, // No nested tables in reports
    width: col.width || null
  }))
})

// Row density (from IntegramDataTableWrapper)
const rowDensity = ref('comfortable') // 'compact' | 'comfortable' | 'spacious'

function cycleRowDensity() {
  const densities = ['compact', 'comfortable', 'spacious']
  const currentIndex = densities.indexOf(rowDensity.value)
  rowDensity.value = densities[(currentIndex + 1) % densities.length]
}

function getRowDensityIcon() {
  switch (rowDensity.value) {
    case 'compact': return 'pi pi-bars'
    case 'comfortable': return 'pi pi-th-large'
    case 'spacious': return 'pi pi-stop'
    default: return 'pi pi-th-large'
  }
}

function getRowDensityLabel() {
  switch (rowDensity.value) {
    case 'compact': return 'Компактный'
    case 'comfortable': return 'Удобный'
    case 'spacious': return 'Просторный'
    default: return 'Удобный'
  }
}

// Infinite scroll state
const infiniteScrollEnabled = ref(false)
const loadingMore = ref(false)
const hasMoreData = ref(true)
const tableWrapperRef = ref(null)

// DataTable ref for resizers
const dataTableRef = ref(null)

// Column resizer state
const isResizing = ref(false)
const resizingColumn = ref(null)
const startX = ref(0)
const startWidth = ref(0)

// Row resizer state
const isRowResizing = ref(false)
const rowResizeData = ref(null)
const rowHeights = ref({})
const MIN_ROW_HEIGHT = 36

// Filters
const filters = ref({})

// Editing state
const editingCell = ref(null)
const editingValue = ref(null)

// Context menu
const rowContextMenu = ref(null)
const selectedRow = ref(null)

// Computed
const breadcrumbItems = computed(() => {
  const requestsPath = `/integram/${database.value}/requests`
  return [
    { label: 'Отчёты', to: requestsPath, icon: 'pi pi-chart-bar' },
    { label: reportTitle.value || 'Отчёт', icon: 'pi pi-file' }
  ]
})

const visibleColumns = computed(() => {
  return columns.value.filter(col => col.visible !== false)
})

const hasActiveFilters = computed(() => {
  return Object.values(filters.value).some(v => v && v.length > 0)
})

const filteredRows = computed(() => {
  if (!reportData.value || !reportData.value.rows) return []

  // Ensure all rows have required structure for DataTable
  const ensureValidRows = (rows) => {
    return rows.map(row => {
      // If row has values array, it's Integram format - keep it
      if (row.values && Array.isArray(row.values)) {
        return row
      }
      // If row is flat format, convert to Integram format with empty values
      // This shouldn't happen, but defensive programming
      return {
        id: row.id || row.ID,
        values: []
      }
    })
  }

  if (!hasActiveFilters.value) {
    return ensureValidRows(reportData.value.rows)
  }

  const filtered = reportData.value.rows.filter(row => {
    for (const key in filters.value) {
      if (filters.value[key]) {
        // Handle both flat format (row[key]) and Integram format (row.values)
        let cellValue = ''

        if (row[key] !== undefined) {
          // Flat format (for array/legacy responses)
          cellValue = String(row[key] || '').toLowerCase()
        } else if (row.values && Array.isArray(row.values)) {
          // Integram format with row.values
          const column = columns.value.find(col => col.field === key)
          if (column && column.headerId) {
            // Find the cell by matching headerId
            const cell = row.values.find(v => v.headerId === column.headerId)
            cellValue = String(cell?.value || '').toLowerCase()
          }
        }

        const filterValue = String(filters.value[key]).toLowerCase()
        if (!cellValue.includes(filterValue)) {
          return false
        }
      }
    }
    return true
  })

  return ensureValidRows(filtered)
})

const rowContextMenuItems = computed(() => [
  {
    label: 'Копировать строку',
    icon: 'pi pi-copy',
    command: () => copyRow()
  }
])

// Methods
async function executeReport() {
  console.log('[IntegramRequestViewer] executeReport CALLED', { requestId: requestId.value })

  if (!requestId.value) {
    console.log('[IntegramRequestViewer] No requestId, showing warning')
    toast.add({
      severity: 'warn',
      summary: 'Предупреждение',
      detail: 'ID отчёта не указан',
      life: 3000
    })
    return
  }

  loading.value = true
  error.value = null
  reportData.value = null // Clear old data

  const startTime = performance.now()

  try {
    console.log(`[IntegramRequestViewer] Executing report ${requestId.value}...`)
    logger.info(`Executing report ${requestId.value}...`)
    // Execute report via Integram API
    const response = await integramService.executeReport(requestId.value, {})

    const endTime = performance.now()
    const executionTimeMs = endTime - startTime

    if (response) {
      console.log('[IntegramRequestViewer] Report response received:', response)
      logger.info('Report response:', response)

      let columnsArray = []
      let rows = []
      let isIntegramFormat = false // Flag to skip common processing

      // Check if response is an array (direct JSON data)
      if (Array.isArray(response)) {
        console.log('[IntegramRequestViewer] Array format detected')
        // Response is an array of objects
        if (response.length > 0) {
          columnsArray = Object.keys(response[0])

          // Convert flat array format to Integram format with row.values
          // DataTable expects: { id, values: [{headerId, value}, ...] }
          rows = response.map((item, index) => {
            const values = columnsArray.map((col, colIndex) => ({
              headerId: colIndex, // Use column index as headerId
              value: item[col]
            }))
            return {
              id: item.id || item.ID || index,
              values: values
            }
          })

          console.log('[IntegramRequestViewer] Converted array to Integram format:', {
            originalLength: response.length,
            convertedLength: rows.length,
            sampleRow: rows[0]
          })
        }
        logger.info(`Direct array response detected. Rows: ${rows.length}, Columns: ${columnsArray.join(', ')}`)
      } else if (response.response && response.response.rows && response.response.headers) {
        console.log('[IntegramRequestViewer] Integram format detected!')
        // New Integram format with response.response.rows and headers
        // DataTable expects this format directly - don't convert!
        const responseHeaders = response.response.headers
        const responseRows = response.response.rows

        console.log('[IntegramRequestViewer] Processing Integram format:', {
          headersCount: responseHeaders.length,
          rowsCount: responseRows.length,
          firstRow: responseRows[0]
        })
        logger.info('Processing Integram format:', {
          headersCount: responseHeaders.length,
          rowsCount: responseRows.length,
          firstRowSample: responseRows[0]
        })

        columnsArray = responseHeaders.map(h => h.alias || h.value || h.id)

        // Keep original Integram format for DataTable (row.values structure)
        // Ensure all rows have a values array
        rows = responseRows.map(row => {
          if (!row.values || !Array.isArray(row.values)) {
            logger.warn('Row missing values array, creating empty:', row)
            return { ...row, values: [] }
          }
          return row
        })
        isIntegramFormat = true

        // For Integram format, set columns with header metadata
        // Use original header data to preserve all properties
        columns.value = responseHeaders.map((h, index) => ({
          field: h.alias || h.value || String(h.id),
          header: h.alias || h.value || String(h.id),
          visible: true,
          isHTML: h.isHTML || false,
          type: h.type || 3, // Preserve original type or default to SHORT text
          ref: h.ref || null,
          multy: h.multy || false,
          notNull: h.notNull || false,
          isMain: h.isMain || index === 0,
          width: h.width || null,
          headerId: h.id // Store header ID for filtering
        }))

        // Initialize filters
        columnsArray.forEach(col => {
          filters.value[col] = ''
        })

        // Verify all rows have values array
        const invalidRows = rows.filter(r => !r.values || !Array.isArray(r.values))
        if (invalidRows.length > 0) {
          logger.error(`Found ${invalidRows.length} rows without values array:`, invalidRows.slice(0, 3))
        }

        // Store header mapping for filtering (field name -> header id)
        reportData.value = {
          report_name: response.report_name || `Отчёт #${requestId.value}`,
          columns: columnsArray,
          rows: rows,
          headers: responseHeaders, // Store original headers for filtering
          total_rows: rows.length,
          execution_time_ms: response.execution_time_ms || executionTimeMs
        }

        reportTitle.value = reportData.value.report_name

        logger.info(`Integram format with headers detected. Rows: ${rows.length}, Columns: ${columnsArray.join(', ')}`, {
          sampleRow: rows[0],
          hasValues: rows[0]?.values !== undefined,
          valuesLength: rows[0]?.values?.length
        })
      } else if (response.columns && response.data) {
        console.log('[IntegramRequestViewer] Legacy format detected')
        // Legacy format with columns array and data as 2D array
        columnsArray = response.columns
        const data = response.data

        // Convert legacy format to Integram format with row.values
        rows = data.map((row, rowIndex) => {
          const values = columnsArray.map((col, colIndex) => ({
            headerId: colIndex,
            value: row[colIndex]
          }))
          return {
            id: rowIndex,
            values: values
          }
        })

        console.log('[IntegramRequestViewer] Converted legacy to Integram format:', {
          originalLength: data.length,
          convertedLength: rows.length,
          sampleRow: rows[0]
        })
        logger.info(`Legacy format detected. Rows: ${rows.length}, Columns: ${columnsArray.join(', ')}`)
      } else {
        // Log full response structure for debugging
        logger.error('Unexpected report response format. Response structure:', {
          isArray: Array.isArray(response),
          hasResponse: !!response.response,
          hasColumns: !!response.columns,
          hasData: !!response.data,
          keys: Object.keys(response || {}),
          sample: JSON.stringify(response).substring(0, 500)
        })
        throw new Error('Неподдерживаемый формат ответа от сервера')
      }

      // Initialize columns with HTML detection (skip for Integram format, already done)
      if (!isIntegramFormat) {
        columns.value = columnsArray.map((col, index) => {
          // Check if this column contains HTML by sampling the first few rows
          const hasHTML = rows.slice(0, Math.min(10, rows.length)).some(row => {
            // For Integram format with row.values, find the cell by headerId
            if (row.values && Array.isArray(row.values)) {
              const cell = row.values.find(v => v.headerId === index)
              const value = cell?.value
              if (typeof value === 'string') {
                return /<[a-z][\s\S]*>/i.test(value)
              }
            }
            return false
          })

          return {
            field: col,
            header: col,
            visible: true,
            isHTML: hasHTML,
            headerId: index // Store index as headerId for filtering
          }
        })
      }

      // Initialize filters
      columnsArray.forEach(col => {
        filters.value[col] = ''
      })

      reportData.value = {
        report_name: response.report_name || `Отчёт #${requestId.value}`,
        columns: columnsArray,
        rows: rows,
        total_rows: rows.length,
        execution_time_ms: response.execution_time_ms || executionTimeMs
      }

      reportTitle.value = reportData.value.report_name

      logger.info(`Report ${requestId.value} executed successfully`, reportData.value)

      toast.add({
        severity: 'success',
        summary: 'Успех',
        detail: `Отчёт выполнен. Получено строк: ${rows.length}`,
        life: 3000
      })
    } else {
      throw new Error('Пустой ответ от сервера')
    }
  } catch (err) {
    logger.error(`Failed to execute report ${requestId.value}:`, err)
    error.value = err.message || 'Не удалось выполнить отчёт'

    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось загрузить отчёт: ' + err.message,
      life: 5000
    })
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  filters.value = {}
}

function toggleInlineEdit() {
  inlineEditEnabled.value = !inlineEditEnabled.value
  if (!inlineEditEnabled.value) {
    cancelEdit()
  }
}

function toggleExtraControls() {
  showExtraControls.value = !showExtraControls.value
}

function toggleSelectionMode() {
  isSelectionModeActive.value = !isSelectionModeActive.value
  toast.add({
    severity: 'info',
    summary: isSelectionModeActive.value ? 'Режим выделения включён' : 'Режим выделения выключен',
    life: 2000
  })
}

function toggleFooter() {
  isFooterActive.value = !isFooterActive.value
  toast.add({
    severity: 'info',
    summary: isFooterActive.value ? 'Футер включён' : 'Футер выключен',
    life: 2000
  })
}

function exportToPDF() {
  toast.add({
    severity: 'info',
    summary: 'PDF экспорт',
    detail: 'Функция в разработке',
    life: 3000
  })
}

// Search functions
function onSearchInput() {
  if (!searchQuery.value) {
    searchMatches.value = []
    currentMatchIndex.value = -1
    return
  }

  // Simple search implementation - can be enhanced later
  const query = searchQuery.value.toLowerCase()
  const matches = []

  filteredRows.value.forEach((row, rowIndex) => {
    visibleColumns.value.forEach(col => {
      const cellValue = String(row[col.field] || '').toLowerCase()
      if (cellValue.includes(query)) {
        matches.push({ rowIndex, field: col.field })
      }
    })
  })

  searchMatches.value = matches
  currentMatchIndex.value = matches.length > 0 ? 0 : -1
}

function nextSearchMatch() {
  if (searchMatches.value.length === 0) return
  currentMatchIndex.value = (currentMatchIndex.value + 1) % searchMatches.value.length
}

function prevSearchMatch() {
  if (searchMatches.value.length === 0) return
  currentMatchIndex.value = currentMatchIndex.value === 0
    ? searchMatches.value.length - 1
    : currentMatchIndex.value - 1
}

function toggleInfiniteScroll() {
  infiniteScrollEnabled.value = !infiniteScrollEnabled.value

  if (infiniteScrollEnabled.value) {
    hasMoreData.value = true
    window.addEventListener('scroll', handleWindowScroll)
  } else {
    window.removeEventListener('scroll', handleWindowScroll)
  }
}

function handleWindowScroll() {
  if (!infiniteScrollEnabled.value || loadingMore.value || !hasMoreData.value) {
    return
  }

  const threshold = 200
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const windowHeight = window.innerHeight
  const documentHeight = document.documentElement.scrollHeight

  if (documentHeight - scrollTop - windowHeight < threshold) {
    loadMoreData()
  }
}

function loadMoreData() {
  if (loadingMore.value || !hasMoreData.value) return

  loadingMore.value = true

  setTimeout(() => {
    hasMoreData.value = false
    loadingMore.value = false
  }, 300)
}

function handleCellClick(rowData, rowIndex, field, value) {
  if (!inlineEditEnabled.value) return

  editingCell.value = {
    rowIndex: rowIndex,
    field: field
  }

  editingValue.value = value || ''
}

function cancelEdit() {
  editingCell.value = null
  editingValue.value = null
}

function saveEdit(rowData, rowIndex) {
  if (!editingCell.value) return

  // Update local data
  const field = editingCell.value.field
  reportData.value.rows[rowIndex][field] = editingValue.value

  toast.add({
    severity: 'success',
    summary: 'Изменено',
    detail: `Ячейка обновлена`,
    life: 2000
  })

  cancelEdit()
}

function onRowClick(event) {
  // Row click handling if needed
}

function onRowContextMenu(event) {
  selectedRow.value = event.data
  rowContextMenu.value.show(event.originalEvent)
}

function copyRow() {
  if (!selectedRow.value) return

  const rowText = Object.values(selectedRow.value).join('\t')
  navigator.clipboard.writeText(rowText)

  toast.add({
    severity: 'success',
    summary: 'Скопировано',
    detail: 'Строка скопирована в буфер',
    life: 2000
  })
}

function exportToExcel() {
  if (!window.XLSX) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Библиотека XLSX не загружена',
      life: 3000
    })
    return
  }

  try {
    const exportData = reportData.value.rows
    const ws = window.XLSX.utils.json_to_sheet(exportData)
    const wb = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(wb, ws, 'Report')

    const filename = `report_${requestId.value}_${new Date().toISOString().split('T')[0]}.xlsx`
    window.XLSX.writeFile(wb, filename)

    toast.add({
      severity: 'success',
      summary: 'Экспорт',
      detail: 'Отчёт экспортирован в Excel',
      life: 3000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось экспортировать: ' + error.message,
      life: 5000
    })
  }
}

function exportToCSV() {
  if (!reportData.value || !reportData.value.rows || reportData.value.rows.length === 0) {
    toast.add({
      severity: 'warn',
      summary: 'Предупреждение',
      detail: 'Нет данных для экспорта',
      life: 3000
    })
    return
  }

  try {
    const columns = visibleColumns.value.map(col => col.header)
    const rows = reportData.value.rows

    let csv = columns.join(',') + '\n'

    rows.forEach(row => {
      const values = visibleColumns.value.map(col => {
        const value = row[col.field]
        const stringValue = String(value || '')
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      })
      csv += values.join(',') + '\n'
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report_${requestId.value}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.add({
      severity: 'success',
      summary: 'Экспорт',
      detail: 'Отчёт экспортирован в CSV',
      life: 3000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось экспортировать: ' + error.message,
      life: 5000
    })
  }
}

function exportToHTML() {
  if (!reportData.value || !reportData.value.rows || reportData.value.rows.length === 0) {
    toast.add({
      severity: 'warn',
      summary: 'Предупреждение',
      detail: 'Нет данных для экспорта',
      life: 3000
    })
    return
  }

  try {
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${reportTitle.value}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  <h1>${reportTitle.value}</h1>
  <table>
    <thead><tr>`

    visibleColumns.value.forEach(col => {
      html += `<th>${col.header}</th>`
    })

    html += `</tr></thead><tbody>`

    reportData.value.rows.forEach(row => {
      html += '<tr>'
      visibleColumns.value.forEach(col => {
        const value = row[col.field]
        const escaped = String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        html += `<td>${escaped}</td>`
      })
      html += '</tr>'
    })

    html += '</tbody></table></body></html>'

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report_${requestId.value}_${Date.now()}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.add({
      severity: 'success',
      summary: 'Экспорт',
      detail: 'Отчёт экспортирован в HTML',
      life: 3000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось экспортировать: ' + error.message,
      life: 5000
    })
  }
}

function printReport() {
  window.print()
}

/**
 * Copy report link to clipboard (SmartQ feature)
 */
function copyReportLink() {
  const url = `${window.location.origin}/integram/${database.value}/requests/${requestId.value}`

  navigator.clipboard.writeText(url).then(() => {
    toast.add({
      severity: 'success',
      summary: 'Скопировано',
      detail: 'Ссылка на отчёт скопирована в буфер обмена',
      life: 2000
    })
  }).catch(error => {
    logger.error('Failed to copy link:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось скопировать ссылку',
      life: 3000
    })
  })
}

function applyParameters() {
  showParametersDialog.value = false
  executeReport()
  toast.add({
    severity: 'success',
    summary: 'Параметры применены',
    detail: 'Отчёт обновлен с новыми параметрами',
    life: 3000
  })
}

function executeSQLQuery() {
  executingSQL.value = true

  setTimeout(() => {
    executingSQL.value = false
    toast.add({
      severity: 'info',
      summary: 'SQL',
      detail: 'Выполнение SQL запроса будет реализовано в следующей версии',
      life: 3000
    })
  }, 500)
}

function cloneReport() {
  toast.add({
    severity: 'info',
    summary: 'Клонирование',
    detail: 'Клонирование отчёта будет реализовано в следующей версии',
    life: 3000
  })
}

async function deleteReport() {
  if (!confirm(`Удалить отчёт "${reportTitle.value}" (ID: ${requestId.value})?`)) return

  try {
    await integramService.deleteObject(requestId.value)
    toast.add({
      severity: 'success',
      summary: 'Удалено',
      detail: `Отчёт #${requestId.value} удалён`,
      life: 3000
    })
    goBack()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось удалить отчёт: ' + error.message,
      life: 5000
    })
  }
}

function goBack() {
  router.push(`/integram/${database.value}/requests`)
}

function formatCellValue(value) {
  if (value === null || value === undefined) return ''
  return value
}

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'a', 'button', 'table', 'tr', 'td', 'th', 'img', 'span', 'div', 'b', 'i', 'strong', 'em'],
    ALLOWED_ATTR: ['href', 'data-action', 'data-params', 'class', 'style', 'src', 'alt'],
    ALLOW_DATA_ATTR: true
  })
}

// Column Resizer Functions
function setupColumnResizers() {
  if (!dataTableRef.value) return

  // Wait for next tick to ensure DOM is updated
  setTimeout(() => {
    const table = dataTableRef.value?.$el
    if (!table) return

    const headers = table.querySelectorAll('thead th')

    headers.forEach((th, index) => {
      // Remove existing resizers first
      const existingResizer = th.querySelector('.column-resizer')
      if (existingResizer) {
        existingResizer.remove()
      }

      // Don't add resizer to last column
      if (index === headers.length - 1) return

      // Create resizer element
      const resizer = document.createElement('div')
      resizer.className = 'column-resizer'
      resizer.setAttribute('data-column-index', index)
      resizer.title = 'Двойной клик — автоподбор ширины'

      resizer.addEventListener('mousedown', startColumnResize)
      resizer.addEventListener('dblclick', autoFitColumn)

      th.style.position = 'relative'
      th.title = 'Двойной клик — автоподбор ширины'
      th.appendChild(resizer)
    })
  }, 100)
}

function startColumnResize(event) {
  event.preventDefault()
  event.stopPropagation()

  const resizer = event.target
  const columnIndex = parseInt(resizer.getAttribute('data-column-index'))
  const th = resizer.parentElement

  isResizing.value = true
  resizingColumn.value = columnIndex
  startX.value = event.pageX
  startWidth.value = th.offsetWidth

  document.addEventListener('mousemove', doColumnResize)
  document.addEventListener('mouseup', stopColumnResize)

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function doColumnResize(event) {
  if (!isResizing.value) return

  const table = dataTableRef.value?.$el
  if (!table) return

  const headers = table.querySelectorAll('thead th')
  const th = headers[resizingColumn.value]

  if (!th) return

  const diff = event.pageX - startX.value
  const newWidth = Math.max(50, startWidth.value + diff)

  th.style.width = newWidth + 'px'
  th.style.minWidth = newWidth + 'px'
}

function stopColumnResize() {
  isResizing.value = false
  resizingColumn.value = null

  document.removeEventListener('mousemove', doColumnResize)
  document.removeEventListener('mouseup', stopColumnResize)

  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function autoFitColumn(event) {
  event.preventDefault()
  event.stopPropagation()

  const resizer = event.target
  const columnIndex = parseInt(resizer.getAttribute('data-column-index'))
  const table = dataTableRef.value?.$el
  if (!table) return

  const headers = table.querySelectorAll('thead th')
  const th = headers[columnIndex]

  if (!th) return

  // Reset width to auto to measure content
  th.style.width = 'auto'
  th.style.minWidth = 'auto'

  setTimeout(() => {
    const contentWidth = th.scrollWidth
    th.style.width = (contentWidth + 20) + 'px'
    th.style.minWidth = (contentWidth + 20) + 'px'
  }, 10)
}

// Row Resizer Functions
function setupRowResizers() {
  if (!dataTableRef.value) return

  setTimeout(() => {
    const table = dataTableRef.value?.$el
    if (!table) return

    const rows = table.querySelectorAll('tbody tr')

    rows.forEach((tr, index) => {
      // Remove existing row resizer first
      const existingResizer = tr.querySelector('.row-resizer')
      if (existingResizer) {
        existingResizer.remove()
      }

      // Create row resizer element
      const rowResizer = document.createElement('div')
      rowResizer.className = 'row-resizer'
      rowResizer.setAttribute('data-row-index', index)

      rowResizer.addEventListener('mousedown', startRowResize)
      rowResizer.addEventListener('dblclick', resetRowHeight)

      // Find first cell and append resizer to it
      const firstCell = tr.querySelector('td')
      if (firstCell) {
        firstCell.style.position = 'relative'
        firstCell.appendChild(rowResizer)
      }
    })
  }, 100)
}

function startRowResize(event) {
  event.preventDefault()
  event.stopPropagation()

  const resizer = event.target
  const rowIndex = parseInt(resizer.getAttribute('data-row-index'))
  const tr = resizer.closest('tr')
  if (!tr) return

  isRowResizing.value = true
  rowResizeData.value = {
    rowIndex,
    startY: event.clientY,
    startHeight: tr.offsetHeight,
    currentTr: tr
  }

  tr.classList.add('row-resizing')
  document.addEventListener('mousemove', handleRowResize)
  document.addEventListener('mouseup', stopRowResize)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

function handleRowResize(event) {
  if (!isRowResizing.value) return
  event.preventDefault()

  const { rowIndex, startY, startHeight, currentTr } = rowResizeData.value
  const deltaY = event.clientY - startY
  let newHeight = startHeight + deltaY

  if (newHeight < MIN_ROW_HEIGHT) newHeight = MIN_ROW_HEIGHT

  // Update row height
  rowHeights.value[rowIndex] = newHeight

  // Apply height to the row
  if (currentTr) {
    currentTr.style.height = `${newHeight}px`
    currentTr.querySelectorAll('td').forEach(td => {
      td.style.height = `${newHeight}px`
    })
  }
}

function stopRowResize() {
  if (!isRowResizing.value) return

  const { currentTr } = rowResizeData.value
  if (currentTr) {
    currentTr.classList.remove('row-resizing')
  }

  isRowResizing.value = false
  rowResizeData.value = null

  document.removeEventListener('mousemove', handleRowResize)
  document.removeEventListener('mouseup', stopRowResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function resetRowHeight(event) {
  event.preventDefault()
  event.stopPropagation()

  const resizer = event.target
  const rowIndex = parseInt(resizer.getAttribute('data-row-index'))
  const tr = resizer.closest('tr')

  if (!tr) return

  // Reset to auto height
  delete rowHeights.value[rowIndex]
  tr.style.height = 'auto'
  tr.querySelectorAll('td').forEach(td => {
    td.style.height = 'auto'
  })
}

// Watch for data changes to re-setup resizers
watch(() => reportData.value, () => {
  setTimeout(() => {
    setupColumnResizers()
    setupRowResizers()
  }, 200)
}, { deep: true })

//=============================================================================
// Helper Functions (from ReportViewer.vue)
//=============================================================================

/**
 * Get database name from route or default
 */
const getDatabaseName = () => {
  let dbName = database.value || route.params.database || localStorage.getItem('db') || 'my'
  dbName = dbName.toLowerCase()
  return dbName
}

/**
 * Add targetDatabase to axios config for database-specific requests
 */
const withTargetDb = (config = {}) => {
  const dbName = getDatabaseName()

  if (!dbName || dbName === 'undefined' || dbName === 'null') {
    throw new Error(`Invalid database name: ${dbName}. Cannot perform operation without valid database.`)
  }

  return {
    ...config,
    targetDatabase: dbName
  }
}

/**
 * Get actual row ID from virtual row ID (for reports with ID column)
 * Reports may have virtual IDs, but we need actual IDs for API calls
 */
const getActualRowId = (rowId) => {
  if (!reportData.value) return rowId

  // Try to find ID column in data
  const row = reportData.value.rows.find(r => r.id === rowId || r.ID === rowId)
  if (!row) return rowId

  // Check if row has explicit ID field
  if (row.ID) return row.ID
  if (row.id) return row.id

  return rowId
}

/**
 * Get internal authentication token (xsrf)
 */
const getInternalAuth = () => {
  return {
    xsrf: localStorage.getItem('xsrf_token') || ''
  }
}

/**
 * Get object ID from row data
 * Report rows may have ID in different formats:
 * - row.values[0].value (Integram format, first column is usually ID)
 * - row.id or row.ID (direct property)
 * - row._objectId (metadata)
 */
const getObjectIdFromRow = (row) => {
  if (!row) {
    logger.warn('getObjectIdFromRow: row is null or undefined')
    return null
  }

  // Try _objectId first (metadata)
  if (row._objectId) {
    return row._objectId
  }

  // Try direct properties
  if (row.id) return row.id
  if (row.ID) return row.ID

  // Try first column in values array (Integram format)
  if (row.values && Array.isArray(row.values) && row.values.length > 0) {
    const firstCell = row.values[0]
    if (firstCell && firstCell.value !== null && firstCell.value !== undefined) {
      // First column often contains object ID
      return firstCell.value
    }
  }

  logger.warn('getObjectIdFromRow: could not determine object ID from row:', row)
  return null
}

/**
 * Get requisite ID from header/column
 * Headers have different ID formats depending on data source:
 * - header.id (for Integram format, this is requisiteId)
 * - numeric index (for array/legacy formats)
 */
const getRequisiteIdFromHeader = (headerId) => {
  if (!headerId && headerId !== 0) {
    logger.warn('getRequisiteIdFromHeader: headerId is null or undefined')
    return null
  }

  // For Integram format, header.id is requisiteId
  const header = headers.value.find(h => h.id === headerId)
  if (!header) {
    logger.warn('getRequisiteIdFromHeader: header not found for headerId:', headerId)
    return headerId // Return headerId itself as fallback
  }

  // If header has explicit requisiteId, use it
  if (header.requisiteId) {
    return header.requisiteId
  }

  // Otherwise use header.id (which may be requisiteId for Integram format)
  return header.id
}

/**
 * Check if column is editable
 * - Must have requisiteId (not computed)
 * - Cannot edit object ID column (if it stores actual objectId)
 */
const isColumnEditable = (headerId) => {
  const header = headers.value.find(h => h.id === headerId)
  if (!header) return false

  // Computed columns without requisiteId are not editable
  const requisiteId = getRequisiteIdFromHeader(headerId)
  if (!requisiteId && requisiteId !== 0) return false

  // Check if this is the objectId column (usually numeric IDs in first column)
  // Allow editing if it's a text/name field (val), but block if it's pure numeric ID
  if (header.isMain === true && reportData.value?.rows?.length > 0) {
    // Sample first few rows to detect if this is ID column
    const sampleSize = Math.min(5, reportData.value.rows.length)
    const samples = reportData.value.rows.slice(0, sampleSize)

    // Check if all values are numbers (likely ID column)
    const allNumbers = samples.every(row => {
      let value = null
      if (row.values && Array.isArray(row.values)) {
        const cell = row.values.find(v => v.headerId === headerId)
        value = cell?.value
      } else {
        value = row[header.field]
      }
      return typeof value === 'number' || !isNaN(Number(value))
    })

    // If all values are numbers AND column is first - likely ID, block editing
    if (allNumbers) {
      logger.info('[isColumnEditable] First column appears to be numeric ID, blocking edit')
      return false
    }
  }

  return true
}

/**
 * Abort controller for API requests
 */
let abortController = new AbortController()

//=============================================================================
// Event Handlers for DataTable (Phase 2: API Persistence)
//=============================================================================

/**
 * Handle cell update from DataTable
 * Uses SmartQ approach: integramService.setRequisites(objectId, { requisiteId: value })
 */
const handleCellUpdate = async ({ rowId, headerId, value, type }) => {
  try {
    logger.info('[handleCellUpdate] Called:', { rowId, headerId, value, type })

    // Find the row in reportData
    if (!reportData.value || !reportData.value.rows) {
      throw new Error('Report data not loaded')
    }

    const row = reportData.value.rows.find(r => r.id === rowId || r.ID === rowId)
    if (!row) {
      throw new Error(`Row with ID ${rowId} not found`)
    }

    // Get object ID from row
    const objectId = getObjectIdFromRow(row)
    if (!objectId) {
      throw new Error('Cannot edit: Object ID not found in this row. This row may be read-only.')
    }

    // Check if column is editable
    if (!isColumnEditable(headerId)) {
      logger.warn('[handleCellUpdate] Column is not editable:', headerId)
      toast.add({
        severity: 'warn',
        summary: 'Колонка не редактируется',
        detail: 'Эта колонка не может быть изменена',
        life: 3000
      })
      return
    }

    // Get requisite ID from header
    const requisiteId = getRequisiteIdFromHeader(headerId)
    if (!requisiteId && requisiteId !== 0) {
      throw new Error('Cannot edit: Requisite ID not found for this column')
    }

    logger.info('[handleCellUpdate] Saving:', {
      objectId,
      requisiteId,
      value,
      database: database.value
    })

    // Save via integramService (SmartQ approach)
    await integramService.setRequisites(objectId, {
      [requisiteId]: value
    })

    logger.info('[handleCellUpdate] Saved successfully')

    // Update local data
    if (row.values && Array.isArray(row.values)) {
      // Integram format: update in row.values
      const cell = row.values.find(v => v.headerId === headerId)
      if (cell) {
        cell.value = value
      }
    } else {
      // Flat format: update directly
      row[headerId] = value
    }

    toast.add({
      severity: 'success',
      summary: 'Ячейка обновлена',
      detail: 'Изменения сохранены',
      life: 2000
    })
  } catch (error) {
    logger.error('[handleCellUpdate] Failed:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка сохранения',
      detail: error.message,
      life: 5000
    })
  }
}

/**
 * Handle row update from DataTable
 * Updates multiple requisites in one object (batch update)
 * Uses SmartQ approach: integramService.setRequisites(objectId, { requisiteId1: value1, requisiteId2: value2, ... })
 */
const handleRowUpdate = async ({ rowId, values }) => {
  try {
    logger.info('[handleRowUpdate] Called:', { rowId, values })

    // Find the row in reportData
    if (!reportData.value || !reportData.value.rows) {
      throw new Error('Report data not loaded')
    }

    const row = reportData.value.rows.find(r => r.id === rowId || r.ID === rowId)
    if (!row) {
      throw new Error(`Row with ID ${rowId} not found`)
    }

    // Get object ID from row
    const objectId = getObjectIdFromRow(row)
    if (!objectId) {
      throw new Error('Cannot edit: Object ID not found in this row. This row may be read-only.')
    }

    // Build requisites object: { requisiteId: value, ... }
    const requisites = {}
    let editableCount = 0

    Object.keys(values).forEach(headerId => {
      // Skip non-editable columns
      if (!isColumnEditable(headerId)) {
        logger.warn('[handleRowUpdate] Skipping non-editable column:', headerId)
        return
      }

      const requisiteId = getRequisiteIdFromHeader(headerId)
      if (requisiteId || requisiteId === 0) {
        requisites[requisiteId] = values[headerId]
        editableCount++
      }
    })

    if (editableCount === 0) {
      logger.warn('[handleRowUpdate] No editable columns in update')
      toast.add({
        severity: 'warn',
        summary: 'Нечего сохранять',
        detail: 'Все колонки только для чтения',
        life: 3000
      })
      return
    }

    logger.info('[handleRowUpdate] Saving batch update:', {
      objectId,
      requisites,
      editableCount,
      database: database.value
    })

    // Save via integramService (SmartQ approach with batch update)
    await integramService.setRequisites(objectId, requisites)

    logger.info('[handleRowUpdate] Saved successfully')

    // Update local data
    if (row.values && Array.isArray(row.values)) {
      // Integram format: update in row.values
      Object.keys(values).forEach(headerId => {
        const cell = row.values.find(v => v.headerId === headerId)
        if (cell) {
          cell.value = values[headerId]
        }
      })
    } else {
      // Flat format: update directly
      Object.assign(row, values)
    }

    toast.add({
      severity: 'success',
      summary: 'Строка обновлена',
      detail: `Сохранено ${editableCount} полей`,
      life: 2000
    })
  } catch (error) {
    logger.error('[handleRowUpdate] Failed:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка сохранения',
      detail: error.message,
      life: 5000
    })
  }
}

/**
 * Handle add row from DataTable
 * Creates new row in backend and adds to local data
 */
const handleAddRow = async () => {
  try {
    logger.info('handleAddRow called')

    const response = await apiClient.post(`/report/${requestId.value}/rows`, null, withTargetDb({
      signal: abortController.signal
    }))

    if (abortController.signal.aborted) return

    const newRow = response.data

    // Add new row to local data
    if (reportData.value && reportData.value.rows) {
      reportData.value.rows.unshift(newRow)
    }

    toast.add({
      severity: 'success',
      summary: 'Строка успешно добавлена',
      life: 3000
    })

    // Refresh report to get updated data
    await executeReport()
  } catch (error) {
    if (error.name !== 'AbortError') {
      logger.error('Row creation failed:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка при создании строки',
        detail: error.message,
        life: 5000
      })
    }
  }
}

/**
 * Handle add column from DataTable
 * Creates new column in backend
 */
const handleAddColumn = async () => {
  try {
    logger.info('handleAddColumn called')

    const response = await apiClient.post(`/report/${requestId.value}/columns`, null, withTargetDb({
      signal: abortController.signal
    }))

    if (abortController.signal.aborted) return

    toast.add({
      severity: 'success',
      summary: 'Колонка успешно добавлена',
      life: 3000
    })

    // Refresh report to get updated structure
    await executeReport()
  } catch (error) {
    if (error.name !== 'AbortError') {
      logger.error('Column creation failed:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка при создании колонки',
        detail: error.message,
        life: 5000
      })
    }
  }
}

/**
 * Handle load directory list from DataTable
 * Loads dropdown options from reference table (справочник)
 */
const handleLoadDirectoryList = async ({ dirTableId, callback }) => {
  try {
    logger.info('handleLoadDirectoryList called:', { dirTableId })

    const response = await apiClient.get(`/tables/${dirTableId}`, withTargetDb({
      signal: abortController.signal
    }))

    if (abortController.signal.aborted) return

    const data = response.data
    const mainHeader = data.response?.headers?.find(h => h.isMain) || data.response?.headers?.[0]

    if (!mainHeader) {
      callback([])
      return
    }

    const list = data.response.rows.map(row => {
      // Handle case where row.values might not exist
      if (row.values && Array.isArray(row.values)) {
        const value = row.values.find(v => v.headerId === mainHeader.id)?.value || `Элемент ${row.id}`
        return { id: row.id, value }
      } else {
        // If no values array, use the main header key directly
        const key = mainHeader.alias || mainHeader.value || mainHeader.id
        return { id: row.id, value: row[key] || `Элемент ${row.id}` }
      }
    })

    callback(list)
  } catch (error) {
    if (error.name !== 'AbortError') {
      logger.error('Error loading directory list:', error)
      callback([])
    }
  }
}

/**
 * Handle load directory row from DataTable
 * Loads full details of a directory row for preview popover
 */
const handleLoadDirRow = async ({ dirTableId, dirRowId, callback }) => {
  try {
    logger.info('handleLoadDirRow called:', { dirTableId, dirRowId })

    const actualRowId = dirTableId === requestId.value ? getActualRowId(dirRowId) : dirRowId

    const response = await apiClient.get(`/tables/${dirTableId}/rows/${actualRowId}`, withTargetDb({
      signal: abortController.signal
    }))

    if (abortController.signal.aborted) return

    const data = response.data
    callback(data.response)
  } catch (error) {
    if (error.name !== 'AbortError') {
      logger.error('Error loading directory row:', error)
      callback(null)
    }
  }
}

/**
 * Handle row delete from DataTable
 * Deletes row from backend and removes from local data
 */
const handleRowDelete = async (rowId) => {
  try {
    logger.info('[handleRowDelete] Called:', { rowId })

    if (!reportData.value || !reportData.value.rows) {
      throw new Error('Report data not loaded')
    }

    const row = reportData.value.rows.find(r => r.id === rowId || r.ID === rowId)
    if (!row) {
      throw new Error(`Row with ID ${rowId} not found`)
    }

    // Get object ID for Integram API
    const objectId = getObjectIdFromRow(row)
    if (!objectId) {
      throw new Error('Cannot delete: Object ID not found in this row')
    }

    logger.info('[handleRowDelete] Deleting object:', {
      objectId,
      database: database.value
    })

    // Delete via integramService
    await integramService.deleteObject(objectId)

    logger.info('[handleRowDelete] Deleted successfully')

    // Remove from local data
    const rowIndex = reportData.value.rows.findIndex(r => r.id === rowId || r.ID === rowId)
    if (rowIndex !== -1) {
      reportData.value.rows.splice(rowIndex, 1)
    }

    toast.add({
      severity: 'success',
      summary: 'Строка удалена',
      detail: 'Запись успешно удалена',
      life: 2000
    })
  } catch (error) {
    logger.error('[handleRowDelete] Failed:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка удаления',
      detail: error.message,
      life: 5000
    })
  }
}

/**
 * Handle bulk delete from DataTable
 * Deletes multiple selected rows
 */
const handleBulkDelete = async (rowIds) => {
  try {
    logger.info('[handleBulkDelete] Called:', { rowIds, count: rowIds.length })

    if (!reportData.value || !reportData.value.rows) {
      throw new Error('Report data not loaded')
    }

    if (!rowIds || rowIds.length === 0) {
      throw new Error('No rows selected for deletion')
    }

    // Collect object IDs
    const objectIds = []
    for (const rowId of rowIds) {
      const row = reportData.value.rows.find(r => r.id === rowId || r.ID === rowId)
      if (row) {
        const objectId = getObjectIdFromRow(row)
        if (objectId) {
          objectIds.push(objectId)
        }
      }
    }

    if (objectIds.length === 0) {
      throw new Error('No valid objects found for deletion')
    }

    logger.info('[handleBulkDelete] Deleting objects:', {
      objectIds,
      count: objectIds.length,
      database: database.value
    })

    // Delete each object (Integram doesn't support bulk delete in one call)
    const results = await Promise.allSettled(
      objectIds.map(objectId => integramService.deleteObject(objectId))
    )

    // Count successes and failures
    const successes = results.filter(r => r.status === 'fulfilled').length
    const failures = results.filter(r => r.status === 'rejected').length

    logger.info('[handleBulkDelete] Results:', { successes, failures })

    // Remove successfully deleted rows from local data
    if (successes > 0) {
      reportData.value.rows = reportData.value.rows.filter(row => {
        const rowId = row.id || row.ID
        return !rowIds.includes(rowId)
      })
    }

    // Show result toast
    if (failures === 0) {
      toast.add({
        severity: 'success',
        summary: 'Строки удалены',
        detail: `Успешно удалено: ${successes}`,
        life: 3000
      })
    } else {
      toast.add({
        severity: 'warn',
        summary: 'Удаление завершено с ошибками',
        detail: `Удалено: ${successes}, Ошибок: ${failures}`,
        life: 5000
      })
    }
  } catch (error) {
    logger.error('[handleBulkDelete] Failed:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка группового удаления',
      detail: error.message,
      life: 5000
    })
  }
}

/**
 * Handle header action from DataTable
 * Handles column rename, delete, and type change
 */
const handleHeaderAction = async ({ action, headerId, newName, newType }) => {
  try {
    logger.info('[handleHeaderAction] Called:', { action, headerId, newName, newType })

    if (!headerId && headerId !== 0) {
      throw new Error('Header ID is required')
    }

    const header = headers.value.find(h => h.id === headerId)
    if (!header) {
      throw new Error(`Header with ID ${headerId} not found`)
    }

    switch (action) {
      case 'rename':
        if (!newName) {
          throw new Error('New name is required for rename action')
        }

        logger.info('[handleHeaderAction] Renaming column:', {
          headerId,
          oldName: header.value,
          newName,
          database: database.value
        })

        // Rename via integramService
        await integramService.renameRequisite(headerId, newName)

        // Update local header
        header.value = newName
        header.alias = newName

        toast.add({
          severity: 'success',
          summary: 'Колонка переименована',
          detail: `"${header.value}" → "${newName}"`,
          life: 2000
        })
        break

      case 'delete':
        logger.info('[handleHeaderAction] Deleting column:', {
          headerId,
          name: header.value,
          database: database.value
        })

        // Delete via integramService
        await integramService.deleteRequisite(headerId)

        // Remove from local headers
        const headerIndex = headers.value.findIndex(h => h.id === headerId)
        if (headerIndex !== -1) {
          headers.value.splice(headerIndex, 1)
        }

        // Remove from columns
        const colIndex = columns.value.findIndex(c => c.field === headerId)
        if (colIndex !== -1) {
          columns.value.splice(colIndex, 1)
        }

        toast.add({
          severity: 'success',
          summary: 'Колонка удалена',
          detail: `Колонка "${header.value}" удалена`,
          life: 2000
        })
        break

      case 'change-type':
        if (!newType && newType !== 0) {
          throw new Error('New type is required for change-type action')
        }

        logger.info('[handleHeaderAction] Changing column type:', {
          headerId,
          name: header.value,
          oldType: header.type,
          newType,
          database: database.value
        })

        // Change type via integramService
        await integramService.changeRequisiteType(headerId, newType, header.value)

        // Update local header
        header.type = newType

        toast.add({
          severity: 'success',
          summary: 'Тип колонки изменён',
          detail: `Колонка "${header.value}" теперь имеет тип ${newType}`,
          life: 2000
        })
        break

      default:
        throw new Error(`Unknown header action: ${action}`)
    }

    // Refresh report to get updated structure
    await executeReport()
  } catch (error) {
    logger.error('[handleHeaderAction] Failed:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка операции с колонкой',
      detail: error.message,
      life: 5000
    })
  }
}

// ========================================
// Report Configurator Methods
// ========================================

/**
 * Auto-detect columns from current report data
 */
function autoDetectColumns() {
  if (reportData.value && reportData.value.headers) {
    reportConfig.value.columns = reportData.value.headers.map(header => ({
      name: header.value || header.alias,
      type: detectColumnType(header.type),
      visible: true
    }))

    toast.add({
      severity: 'success',
      summary: 'Колонки определены',
      detail: `Определено ${reportConfig.value.columns.length} колонок`,
      life: 2000
    })
  } else {
    toast.add({
      severity: 'warn',
      summary: 'Нет данных',
      detail: 'Сначала загрузите отчет',
      life: 3000
    })
  }
}

/**
 * Detect column type from Integram type ID
 */
function detectColumnType(typeId) {
  const typeMap = {
    2: 'text',    // LONG
    3: 'text',    // SHORT
    4: 'datetime', // DATETIME
    7: 'boolean', // BOOL
    8: 'reference', // REFERENCE
    13: 'number'  // NUMBER
  }
  return typeMap[typeId] || 'text'
}

/**
 * Remove column from configuration
 */
function removeColumn(index) {
  reportConfig.value.columns.splice(index, 1)
}

/**
 * Handle column reorder
 */
function onColumnReorder(event) {
  // Column order is automatically updated by PrimeVue DataTable
  logger.info('Columns reordered')
}

/**
 * Apply configuration template
 */
function applyTemplate(template) {
  Object.assign(reportConfig.value, template.config)

  toast.add({
    severity: 'success',
    summary: 'Шаблон применен',
    detail: `Применен шаблон "${template.name}"`,
    life: 2000
  })
}

/**
 * Save report configuration to Integram
 */
async function saveReportConfiguration() {
  try {
    logger.info('[saveReportConfiguration] Saving config:', reportConfig.value)

    // Save configuration to report metadata
    await integramService.setObjectRequisites(requestId.value, {
      name: reportConfig.value.name,
      description: reportConfig.value.description,
      category: reportConfig.value.category,
      isPublic: reportConfig.value.isPublic,
      isTemplate: reportConfig.value.isTemplate,
      displaySettings: JSON.stringify({
        rowDensity: reportConfig.value.rowDensity,
        features: reportConfig.value.features,
        defaultPageSize: reportConfig.value.defaultPageSize,
        columns: reportConfig.value.columns
      })
    })

    toast.add({
      severity: 'success',
      summary: 'Конфигурация сохранена',
      detail: 'Настройки отчета успешно сохранены',
      life: 3000
    })

    showConfiguratorDialog.value = false

    // Reload report to apply new settings
    await executeReport()
  } catch (error) {
    logger.error('[saveReportConfiguration] Failed:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка сохранения',
      detail: error.message || 'Не удалось сохранить конфигурацию',
      life: 5000
    })
  }
}

// Lifecycle
onMounted(async () => {
  // Load XLSX library if not loaded
  if (!window.XLSX) {
    const script = document.createElement('script')
    script.src = '/js/xlsx.full.min.js'
    script.type = 'text/javascript'
    document.body.appendChild(script)
  }

  // Check for autorun query parameter (for E2E tests and direct execution)
  if (route.query.autorun === '1') {
    console.log('[IntegramRequestViewer] autorun=1 detected, executing report automatically')
    await executeReport()
    console.log('[IntegramRequestViewer] Report execution completed')
  } else {
    console.log('[IntegramRequestViewer] No autorun parameter, waiting for manual execution')
  }

  // Setup column and row resizers after initial load
  setTimeout(() => {
    setupColumnResizers()
    setupRowResizers()
  }, 500)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleWindowScroll)
})
</script>

<style scoped>
.integram-request-viewer-container {
  /* No extra padding - IntegramMain .content provides 1rem */
}

.button-on {
  background-color: var(--surface-hover) !important;
}

.table-wrapper {
  overflow-x: auto;
}

/* Header layout (from IntegramDataTableWrapper) */
.table-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  overflow: hidden;
}

.table-header-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
}

.table-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color);
}

.records-badge {
  background-color: var(--surface-hover);
  color: var(--text-color-secondary);
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  vertical-align: super;
  margin-top: -0.5rem;
}

/* Search field (from IntegramDataTableWrapper) */
.search-with-navigation {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-search {
  width: 180px;
  min-width: 120px;
  max-width: 180px;
  flex-shrink: 1;
}

.header-search :deep(.p-inputtext) {
  width: 100% !important;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  font-size: 0.875rem;
}

.search-navigation-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0 0.5rem;
  background: var(--surface-50);
  border-radius: 6px;
  border: 1px solid var(--surface-border);
}

.search-counter {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  white-space: nowrap;
  padding: 0 0.5rem;
}

.toolbar-separator {
  width: 1px;
  height: 20px;
  background: var(--surface-border);
  margin: 0 4px;
}

/* Responsive header */
@media screen and (max-width: 768px) {
  .header-search {
    width: 150px;
  }

  .table-title {
    font-size: 1rem;
  }
}

@media screen and (max-width: 576px) {
  .header-search {
    display: none;
  }
}

/* Row Density Styles (from IntegramDataTableWrapper) */
.row-density-compact :deep(tr) {
  height: 24px !important;
}

.row-density-compact :deep(td),
.row-density-compact :deep(th) {
  padding: 2px 8px !important;
  font-size: 0.875rem;
}

.row-density-comfortable :deep(tr) {
  height: 32px !important;
}

.row-density-comfortable :deep(td),
.row-density-comfortable :deep(th) {
  padding: 4px 12px !important;
}

.row-density-spacious :deep(tr) {
  height: 48px !important;
}

.row-density-spacious :deep(td),
.row-density-spacious :deep(th) {
  padding: 8px 16px !important;
  font-size: 1rem;
}

.editable-cell {
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.editable-cell:hover {
  background-color: var(--surface-50);
}

.editable-cell.editing {
  padding: 0;
  background-color: var(--highlight-bg);
}

.inline-edit {
  border: 1px solid var(--surface-300) !important;
  padding: 0.5rem !important;
  font-size: inherit;
}

.inline-edit:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: -2px;
}

.filter-panel {
  border: 1px solid var(--surface-300);
}

.column-visibility-list {
  max-height: 400px;
  overflow-y: auto;
}

.parameters-form {
  max-height: 500px;
  overflow-y: auto;
}

/* DataTable styling to match custom DataTable */
.integram-table {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.integram-table :deep(.p-datatable-wrapper) {
  border-radius: 8px;
}

.integram-table :deep(.p-datatable-thead > tr > th) {
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--surface-ground);
  font-weight: 500;
  color: var(--text-color);
  user-select: none;
  border-right: none;
  border-bottom: 1px solid var(--surface-border);
  padding: 12px 16px;
  position: relative;
}

.integram-table :deep(.p-datatable-thead > tr > th:last-child) {
  border-right: none;
}

.integram-table :deep(.p-datatable-tbody > tr > td) {
  border-right: none;
  border-bottom: 1px solid var(--surface-border);
  padding: 12px 16px;
  background: var(--surface-a);
}

.integram-table :deep(.p-datatable-tbody > tr > td:last-child) {
  border-right: none;
}

.integram-table :deep(.p-datatable-tbody > tr:hover) {
  background-color: var(--surface-hover);
}

/* Custom column resizer - visible draggable handle */
.integram-table :deep(.column-resizer) {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: col-resize;
  z-index: 10;
  background: transparent;
  transition: background-color 0.2s;
  user-select: none;
}

.integram-table :deep(.column-resizer:hover),
.integram-table :deep(.column-resizer:active) {
  background-color: var(--primary-color);
}

.integram-table :deep(th) {
  position: relative;
}

/* Row resizer - drag handle at bottom of each row */
.integram-table :deep(.row-resizer) {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  cursor: row-resize;
  background: transparent;
  z-index: 10;
  transition: background-color 0.15s ease;
}

.integram-table :deep(.row-resizer:hover),
.integram-table :deep(.row-resizer:active),
.integram-table :deep(tr.row-resizing .row-resizer) {
  background-color: var(--primary-color);
}

.integram-table :deep(tr.row-resizing) {
  user-select: none;
}

.integram-table :deep(tbody tr td) {
  position: relative;
}

/* Print styles */
@media print {
  .extra-controls-panel,
  .sql-editor-panel {
    display: none !important;
  }
}

/* Report Configurator Styles */
.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.template-card {
  transition: all 0.2s ease;
  border: 1px solid var(--surface-border);
}

.template-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: var(--primary-color);
}

.form-group {
  margin-bottom: 1rem;
}
</style>
