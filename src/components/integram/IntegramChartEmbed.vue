<template>
  <div class="integram-chart-embed">
    <!-- Loading State -->
    <div v-if="loading" class="chart-state">
      <ProgressSpinner />
      <p>Загрузка данных графика...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="chart-state">
      <Message severity="error" :closable="false">
        <div class="flex flex-column gap-2">
          <strong>Ошибка загрузки графика</strong>
          <p class="m-0">{{ error }}</p>
          <Button
            label="Повторить"
            icon="pi pi-refresh"
            size="small"
            @click="loadChartData"
          />
        </div>
      </Message>
    </div>

    <!-- Configuration Required State -->
    <div v-else-if="!isConfigured" class="chart-state">
      <div class="chart-empty-state">
        <i class="pi pi-chart-bar"></i>
        <h3>Настройте график</h3>
        <p>Выберите поля для построения графика</p>
        <Button
          label="Настроить график"
          icon="pi pi-cog"
          @click="showConfigDialog = true"
        />
      </div>
    </div>

    <!-- Chart Canvas -->
    <div v-else class="chart-container">
      <div class="chart-header">
        <h3>{{ settings.title || 'График' }}</h3>
        <div class="chart-actions">
          <Button
            icon="pi pi-refresh"
            text
            rounded
            @click="loadChartData"
            title="Обновить данные"
          />
          <Button
            icon="pi pi-cog"
            text
            rounded
            @click="showConfigDialog = true"
            title="Настройки графика"
          />
        </div>
      </div>
      <div class="chart-canvas-wrapper">
        <canvas ref="chartCanvas" :style="{ height: `${settings.height || 400}px` }"></canvas>
      </div>
    </div>

    <!-- Configuration Dialog -->
    <Dialog
      v-model:visible="showConfigDialog"
      header="Настройки графика"
      :modal="true"
      :style="{ width: '600px' }"
    >
      <div class="config-form">
        <!-- Chart Type -->
        <div class="p-field">
          <label>Тип графика</label>
          <div class="chart-type-grid">
            <div
              v-for="type in chartTypes"
              :key="type.value"
              class="chart-type-card"
              :class="{ selected: localSettings.chartType === type.value }"
              @click="localSettings.chartType = type.value"
            >
              <i :class="['pi', type.icon]"></i>
              <span>{{ type.label }}</span>
            </div>
          </div>
        </div>

        <!-- Label Field -->
        <div class="p-field">
          <label>Поле для подписей (X / Labels)</label>
          <Dropdown
            v-model="localSettings.labelField"
            :options="availableFields"
            optionLabel="label"
            optionValue="value"
            placeholder="Выберите поле..."
            class="w-full"
            :loading="loadingFields"
          />
        </div>

        <!-- Value Field -->
        <div class="p-field">
          <label>Поле для значений (Y / Data)</label>
          <Dropdown
            v-model="localSettings.valueField"
            :options="numericFields"
            optionLabel="label"
            optionValue="value"
            placeholder="Выберите поле..."
            class="w-full"
            :loading="loadingFields"
          />
        </div>

        <!-- Title -->
        <div class="p-field">
          <label>Заголовок</label>
          <InputText
            v-model="localSettings.title"
            placeholder="Название графика..."
            class="w-full"
          />
        </div>

        <!-- Height -->
        <div class="p-field">
          <label>Высота (px)</label>
          <InputNumber
            v-model="localSettings.height"
            :min="200"
            :max="800"
            :step="50"
            class="w-full"
          />
        </div>
      </div>

      <template #footer>
        <Button label="Отмена" text @click="showConfigDialog = false" />
        <Button label="Применить" @click="applySettings" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import integramApiClient from '@/services/integramApiClient'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'

const props = defineProps({
  database: {
    type: String,
    required: true
  },
  typeId: {
    type: [String, Number],
    required: true
  },
  initialSettings: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['settings-changed'])

// State
const loading = ref(false)
const error = ref(null)
const showConfigDialog = ref(false)
const chartCanvas = ref(null)
const chartInstance = ref(null)
const chartData = ref(null)
const loadingFields = ref(false)
const availableFields = ref([])
const numericFields = ref([])

// Settings
const settings = ref({
  chartType: 'bar',
  labelField: '',
  valueField: '',
  title: 'График',
  height: 400,
  ...props.initialSettings
})

const localSettings = ref({ ...settings.value })

// Chart types
const chartTypes = [
  { value: 'bar', label: 'Столбцы', icon: 'pi-chart-bar' },
  { value: 'line', label: 'Линия', icon: 'pi-chart-line' },
  { value: 'pie', label: 'Круг', icon: 'pi-chart-pie' },
  { value: 'doughnut', label: 'Кольцо', icon: 'pi-circle' }
]

const isConfigured = computed(() => {
  return settings.value.labelField && settings.value.valueField
})

// Load field metadata
async function loadFields() {
  if (loadingFields.value) return

  loadingFields.value = true
  try {
    const metadata = await integramApiClient.getTypeMetadata(props.typeId)

    if (metadata && metadata.requisites) {
      const fields = Object.entries(metadata.requisites).map(([id, req]) => ({
        value: id,
        label: req.alias || req.name || `Поле ${id}`,
        type: req.type
      }))

      availableFields.value = fields

      // Numeric fields for value axis
      numericFields.value = fields.filter(f =>
        f.type === 13 || // NUMBER
        f.type === 2 ||  // LONG (can contain numbers)
        f.type === 3     // SHORT (can contain numbers)
      )
    }
  } catch (err) {
    console.error('Failed to load fields:', err)
  } finally {
    loadingFields.value = false
  }
}

// Load chart data
async function loadChartData() {
  if (!isConfigured.value) return

  loading.value = true
  error.value = null

  try {
    const response = await integramApiClient.getObjects({
      typeId: props.typeId,
      limit: 100
    })

    if (!response || !response.objects) {
      throw new Error('Не удалось загрузить данные')
    }

    chartData.value = response.objects
    await nextTick()
    renderChart()
  } catch (err) {
    console.error('Failed to load chart data:', err)
    error.value = err.message || 'Ошибка загрузки данных'
  } finally {
    loading.value = false
  }
}

// Render chart
function renderChart() {
  if (!chartCanvas.value || !chartData.value) return

  // Destroy existing chart
  if (chartInstance.value) {
    chartInstance.value.destroy()
    chartInstance.value = null
  }

  // Prepare data
  const labels = []
  const data = []

  for (const obj of chartData.value) {
    const labelValue = obj.reqs?.[settings.value.labelField]?.value || obj.val || `ID ${obj.id}`
    const dataValue = parseFloat(obj.reqs?.[settings.value.valueField]?.value) || 0

    labels.push(String(labelValue))
    data.push(dataValue)
  }

  // Create chart
  const ctx = chartCanvas.value.getContext('2d')
  chartInstance.value = new Chart(ctx, {
    type: settings.value.chartType,
    data: {
      labels,
      datasets: [{
        label: settings.value.title || 'Данные',
        data,
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 99, 132, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)'
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: settings.value.chartType === 'pie' || settings.value.chartType === 'doughnut'
        }
      }
    }
  })
}

// Apply settings
function applySettings() {
  settings.value = { ...localSettings.value }
  emit('settings-changed', settings.value)
  showConfigDialog.value = false
  loadChartData()
}

// Watch for config dialog opening
watch(showConfigDialog, (visible) => {
  if (visible) {
    localSettings.value = { ...settings.value }
    loadFields()
  }
})

// Initialize
onMounted(() => {
  loadFields()
  if (isConfigured.value) {
    loadChartData()
  }
})
</script>

<style scoped>
.integram-chart-embed {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  background: var(--surface-card);
}

.chart-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 400px;
}

.chart-empty-state {
  text-align: center;
}

.chart-empty-state i {
  font-size: 4rem;
  color: var(--primary-color);
  opacity: 0.3;
  margin-bottom: 20px;
}

.chart-empty-state h3 {
  font-size: 1.5rem;
  margin-bottom: 8px;
  color: var(--text-color);
}

.chart-empty-state p {
  color: var(--text-color-secondary);
  margin-bottom: 20px;
}

.chart-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--surface-border);
}

.chart-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text-color);
}

.chart-actions {
  display: flex;
  gap: 4px;
}

.chart-canvas-wrapper {
  flex: 1;
  position: relative;
  min-height: 300px;
}

.chart-canvas-wrapper canvas {
  width: 100% !important;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.p-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.p-field label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color);
}

.chart-type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.chart-type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border: 2px solid var(--surface-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.chart-type-card:hover {
  border-color: var(--primary-color);
  background: var(--surface-hover);
}

.chart-type-card.selected {
  border-color: var(--primary-color);
  background: var(--primary-50);
}

.chart-type-card i {
  font-size: 1.5rem;
  margin-bottom: 4px;
  color: var(--text-color-secondary);
}

.chart-type-card.selected i {
  color: var(--primary-color);
}

.chart-type-card span {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-color);
}
</style>
