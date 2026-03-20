<template>
  <Dialog
    v-model:visible="visible"
    header="Настройка диаграммы Integram"
    :modal="true"
    :closable="true"
    :style="{ width: '800px', maxHeight: '90vh' }"
    @update:visible="onClose"
  >
    <template #header>
      <div class="dialog-header">
        <div class="block-icon-small" style="background-color: var(--primary-color);">
          <i class="pi pi-chart-bar"></i>
        </div>
        <div>
          <h3>📊 Настройка диаграммы Integram</h3>
          <small>Выберите таблицу и настройте параметры отображения</small>
        </div>
      </div>
    </template>

    <div class="chart-config-form">
      <!-- Database Selection -->
      <div class="p-field">
        <label for="database">База данных</label>
        <Dropdown
          id="database"
          v-model="localConfig.database"
          :options="databases"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите базу данных"
          class="w-full"
          @change="onDatabaseChange"
        />
      </div>

      <!-- Table Selection -->
      <div class="p-field">
        <label for="table">Таблица <span class="required">*</span></label>
        <Dropdown
          id="table"
          v-model="localConfig.typeId"
          :options="tables"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите таблицу..."
          class="w-full"
          :filter="true"
          filterPlaceholder="Поиск таблицы..."
          :loading="loadingTables"
          @change="onTableChange"
        />
        <small v-if="localConfig.typeId" class="text-muted">
          Выбрана таблица ID: {{ localConfig.typeId }}
        </small>
      </div>

      <Divider />

      <!-- Chart Type -->
      <div class="p-field">
        <label for="chartType">Тип диаграммы <span class="required">*</span></label>
        <div class="chart-type-grid">
          <div
            v-for="type in chartTypes"
            :key="type.value"
            class="chart-type-card"
            :class="{ selected: localConfig.chartType === type.value }"
            @click="localConfig.chartType = type.value"
          >
            <i :class="['pi', type.icon]"></i>
            <span>{{ type.label }}</span>
          </div>
        </div>
      </div>

      <Divider />

      <!-- Field Selection -->
      <div class="fields-row">
        <div class="p-field flex-1">
          <label for="labelField">Поле для подписей (X / Labels) <span class="required">*</span></label>
          <Dropdown
            id="labelField"
            v-model="localConfig.labelField"
            :options="availableFields"
            optionLabel="label"
            optionValue="value"
            placeholder="Выберите поле..."
            class="w-full"
            :disabled="!localConfig.typeId || loadingFields"
            :loading="loadingFields"
          />
          <small class="text-muted">Текстовое поле для названий элементов</small>
        </div>

        <div class="p-field flex-1">
          <label for="valueField">Поле для значений (Y / Data) <span class="required">*</span></label>
          <Dropdown
            id="valueField"
            v-model="localConfig.valueField"
            :options="numericFields"
            optionLabel="label"
            optionValue="value"
            placeholder="Выберите поле..."
            class="w-full"
            :disabled="!localConfig.typeId || loadingFields"
            :loading="loadingFields"
          />
          <small class="text-muted">Числовое поле для значений</small>
        </div>
      </div>

      <Divider />

      <!-- Display Settings -->
      <div class="p-field">
        <label for="title">Заголовок графика</label>
        <InputText
          id="title"
          v-model="localConfig.title"
          placeholder="Введите заголовок..."
          class="w-full"
        />
      </div>

      <div class="fields-row">
        <div class="p-field flex-1">
          <label for="height">Высота (px)</label>
          <InputNumber
            id="height"
            v-model="localConfig.height"
            :min="200"
            :max="800"
            :step="50"
            class="w-full"
          />
        </div>

        <div class="p-field flex-1">
          <label for="colorScheme">Цветовая схема</label>
          <Dropdown
            id="colorScheme"
            v-model="localConfig.colorScheme"
            :options="colorSchemes"
            optionLabel="label"
            optionValue="value"
            placeholder="Выберите схему..."
            class="w-full"
          />
        </div>
      </div>

      <!-- Preview Section -->
      <div v-if="showPreview && previewConfig" class="preview-section">
        <Divider />
        <div class="preview-header">
          <h4>Предпросмотр графика</h4>
          <Button
            icon="pi pi-refresh"
            size="small"
            outlined
            @click="loadPreview"
            :loading="loadingPreview"
            label="Обновить"
          />
        </div>
        <div v-if="loadingPreview" class="preview-loading">
          <ProgressSpinner style="width: 50px; height: 50px" />
          <p>Загрузка данных...</p>
        </div>
        <div v-else-if="previewError" class="preview-error">
          <Message severity="error" :closable="false">
            {{ previewError }}
          </Message>
        </div>
        <div v-else-if="previewChartData" class="preview-canvas-wrapper">
          <canvas ref="previewCanvas" :height="localConfig.height || 400"></canvas>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button
          label="Отмена"
          icon="pi pi-times"
          severity="secondary"
          outlined
          @click="onClose"
        />
        <Button
          v-if="canPreview"
          label="Предпросмотр"
          icon="pi pi-eye"
          severity="info"
          @click="loadPreview"
          :loading="loadingPreview"
        />
        <Button
          label="Вставить"
          icon="pi pi-check"
          severity="success"
          @click="onSave"
          :disabled="!isValid"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import Chart from 'chart.js/auto'
import * as docBlocksApi from '@/services/docBlocksApiService'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  config: {
    type: Object,
    default: () => ({})
  },
  sessionId: {
    type: String,
    default: ''
  },
  database: {
    type: String,
    default: 'kval'
  }
})

const emit = defineEmits(['update:modelValue', 'save'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// Configuration
const localConfig = ref({
  database: props.database,
  typeId: '',
  typeName: '',
  chartType: 'bar',
  labelField: '',
  valueField: '',
  title: 'Диаграмма Integram',
  height: 400,
  colorScheme: 'default',
  ...props.config
})

// Database options — показываем текущую БД документа
const databases = ref([
  { label: localConfig.value.database, value: localConfig.value.database }
])

// Chart types
const chartTypes = ref([
  { value: 'bar', label: 'Столбцы', icon: 'pi-chart-bar' },
  { value: 'line', label: 'Линия', icon: 'pi-chart-line' },
  { value: 'pie', label: 'Круг', icon: 'pi-chart-pie' },
  { value: 'doughnut', label: 'Кольцо', icon: 'pi-circle' },
  { value: 'radar', label: 'Радар', icon: 'pi-directions' },
  { value: 'polarArea', label: 'Полярная', icon: 'pi-sun' }
])

// Color schemes
const colorSchemes = ref([
  { label: 'По умолчанию', value: 'default' },
  { label: 'Синяя', value: 'blue' },
  { label: 'Зелёная', value: 'green' },
  { label: 'Красная', value: 'red' },
  { label: 'Радужная', value: 'rainbow' }
])

// Tables and fields
const tables = ref([])
const loadingTables = ref(false)
const availableFields = ref([])
const numericFields = ref([])
const loadingFields = ref(false)

// Preview
const showPreview = ref(false)
const loadingPreview = ref(false)
const previewError = ref(null)
const previewChartData = ref(null)
const previewCanvas = ref(null)
const previewChart = ref(null)
const previewConfig = computed(() => localConfig.value.typeId && localConfig.value.labelField && localConfig.value.valueField)

// Validation
const isValid = computed(() => {
  return localConfig.value.typeId &&
    localConfig.value.chartType &&
    localConfig.value.labelField &&
    localConfig.value.valueField
})

const canPreview = computed(() => isValid.value && !loadingPreview.value)

// Load tables via backend proxy
async function loadTables() {
  loadingTables.value = true
  try {
    const response = await docBlocksApi.getTables(localConfig.value.database)
    // Backend returns { success, tables: { typeId: typeName, ... } }
    const dict = response.tables || {}
    if (dict && typeof dict === 'object') {
      tables.value = Object.entries(dict)
        .filter(([id]) => parseInt(id) > 0)
        .map(([id, val]) => ({
          label: `${val} (ID: ${id})`,
          value: id,
          name: val
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
    }
  } catch (error) {
    console.error('Error loading tables:', error)
  } finally {
    loadingTables.value = false
  }
}

// Load table metadata (requisites/fields) via backend proxy
async function loadTableFields(typeId) {
  if (!typeId) return

  loadingFields.value = true
  availableFields.value = []
  numericFields.value = []

  try {
    const response = await docBlocksApi.getTypeMetadata(typeId, localConfig.value.database)
    // Backend returns { success, metadata: { type: {...}, reqs: [...] } }
    const meta = response.metadata || response
    const reqs = meta.reqs || meta.requisites || []

    if (Array.isArray(reqs)) {
      // All fields for labels
      availableFields.value = reqs.map(r => ({
        label: r.val || r.alias || r.name || `Реквизит ${r.id}`,
        value: String(r.id),
        type: r.type
      }))

      // Numeric fields only for values (type 13 = NUMBER)
      numericFields.value = reqs
        .filter(r => String(r.type) === '13')
        .map(r => ({
          label: r.val || r.alias || r.name || `Реквизит ${r.id}`,
          value: String(r.id),
          type: r.type
        }))

      // If no strictly numeric fields found, show all as potential value fields
      if (numericFields.value.length === 0) {
        numericFields.value = [...availableFields.value]
      }
    }
  } catch (error) {
    console.error('Error loading table fields:', error)
  } finally {
    loadingFields.value = false
  }
}

// Load preview data via backend proxy
async function loadPreview() {
  if (!isValid.value) return

  loadingPreview.value = true
  previewError.value = null
  showPreview.value = true

  try {
    // Get data via backend proxy
    const data = await docBlocksApi.getObjectsByType(localConfig.value.typeId, { LIMIT: 100 }, localConfig.value.database)

    // Transform data for chart — kval proxy returns { reqs: { objId: { reqId: value } } }
    const labels = []
    const values = []
    const reqs = data.reqs || {}

    Object.values(reqs).forEach(req => {
      const labelVal = req[localConfig.value.labelField]
      const valueVal = req[localConfig.value.valueField]
      if (labelVal && valueVal) {
        labels.push(String(labelVal))
        values.push(parseFloat(valueVal) || 0)
      }
    })

    if (labels.length === 0) {
      throw new Error('Нет данных для выбранных полей')
    }

    previewChartData.value = {
      labels,
      datasets: [{
        label: localConfig.value.title || 'Данные',
        data: values,
        backgroundColor: getColorScheme(localConfig.value.colorScheme),
        borderColor: getColorScheme(localConfig.value.colorScheme, true),
        borderWidth: 1
      }]
    }

    // Render chart after data is loaded
    await nextTick()
    renderPreviewChart()
  } catch (error) {
    console.error('Preview error:', error)
    previewError.value = error.message
  } finally {
    loadingPreview.value = false
  }
}

// Render preview chart
function renderPreviewChart() {
  if (!previewCanvas.value || !previewChartData.value) return

  // Destroy previous chart instance
  if (previewChart.value) {
    previewChart.value.destroy()
  }

  const ctx = previewCanvas.value.getContext('2d')
  previewChart.value = new Chart(ctx, {
    type: localConfig.value.chartType,
    data: previewChartData.value,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: ['pie', 'doughnut', 'polarArea'].includes(localConfig.value.chartType)
        },
        title: {
          display: !!localConfig.value.title,
          text: localConfig.value.title
        }
      },
      scales: ['bar', 'line'].includes(localConfig.value.chartType) ? {
        y: {
          beginAtZero: true
        }
      } : undefined
    }
  })
}

// Get color scheme
function getColorScheme(scheme, border = false) {
  const schemes = {
    default: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'],
    blue: ['#1E40AF', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE', '#EFF6FF'],
    green: ['#065F46', '#047857', '#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'],
    red: ['#991B1B', '#B91C1C', '#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2'],
    rainbow: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6']
  }

  const colors = schemes[scheme] || schemes.default
  if (border) {
    return colors.map(c => c.replace('F6', 'CC')) // Slightly darker for borders
  }
  return colors
}

// Event handlers
function onDatabaseChange() {
  localConfig.value.typeId = ''
  localConfig.value.typeName = ''
  localConfig.value.labelField = ''
  localConfig.value.valueField = ''
  tables.value = []
  availableFields.value = []
  numericFields.value = []
  loadTables()
}

function onTableChange() {
  const selected = tables.value.find(t => t.value === localConfig.value.typeId)
  if (selected) {
    localConfig.value.typeName = selected.name
  }
  localConfig.value.labelField = ''
  localConfig.value.valueField = ''
  loadTableFields(localConfig.value.typeId)
}

function onSave() {
  if (!isValid.value) return
  emit('save', { ...localConfig.value })
  onClose()
}

function onClose() {
  visible.value = false
  showPreview.value = false
  previewError.value = null
  if (previewChart.value) {
    previewChart.value.destroy()
    previewChart.value = null
  }
}

// Watch for changes
watch(() => props.config, (newConfig) => {
  if (newConfig) {
    localConfig.value = { ...localConfig.value, ...newConfig }
  }
}, { deep: true })

watch(() => props.database, (db) => {
  if (db && db !== localConfig.value.database) {
    localConfig.value.database = db
    databases.value = [{ label: db, value: db }]
    // Сбрасываем выбор таблицы при смене БД
    localConfig.value.typeId = ''
    localConfig.value.typeName = ''
    localConfig.value.labelField = ''
    localConfig.value.valueField = ''
    tables.value = []
  }
})

// Load tables when dialog becomes visible
watch(visible, (isVisible) => {
  if (isVisible && tables.value.length === 0) {
    loadTables()
    if (localConfig.value.typeId) {
      loadTableFields(localConfig.value.typeId)
    }
  }
})
</script>

<style scoped>
.dialog-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.block-icon-small {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
}

.chart-config-form {
  padding: 0.5rem 0;
}

.p-field {
  margin-bottom: 1.5rem;
}

.p-field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text-color);
}

.required {
  color: var(--red-500);
}

.text-muted {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.chart-type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.chart-type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 2px solid var(--surface-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.chart-type-card:hover {
  border-color: var(--primary-color);
  background: var(--surface-hover);
}

.chart-type-card.selected {
  border-color: var(--primary-color);
  background: var(--primary-50);
  color: var(--primary-color);
}

.chart-type-card i {
  font-size: 1.5rem;
}

.fields-row {
  display: flex;
  gap: 1rem;
}

.flex-1 {
  flex: 1;
}

.preview-section {
  margin-top: 1.5rem;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.preview-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.preview-loading,
.preview-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  gap: 1rem;
}

.preview-canvas-wrapper {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 1rem;
  background: var(--surface-0);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
