<template>
  <FstPageLayout
    title="Обучение"
    subtitle="Интерактивные модули освоения платформы VentureOS"
  >
    <!-- Header -->
    <template #header>
      <div class="header-content">
        <div class="title-section">
          <i class="pi pi-brain" style="font-size: 2rem; color: var(--p-primary-color);"></i>
          <div>
            <h1>🧠 Нейрокогнитивное ядро ИК</h1>
            <p class="subtitle">Самообучающаяся модель инвесткомитета на исторических данных</p>
          </div>
        </div>
        <Button
          label="Добавить обучающий пример"
          icon="pi pi-plus"
          @click="showAddExampleDialog = true"
          severity="success"
        />
      </div>
    </template>

    <!-- Stats Overview -->
    <div class="stats-grid">
      <Card class="stat-card">
        <template #title>
          <div class="stat-title">
            <i class="pi pi-check-circle"></i>
            <span>Точность ИК</span>
          </div>
        </template>
        <template #content>
          <div class="stat-value">{{ accuracyMetrics.overallAccuracy || '—' }}</div>
          <div class="stat-label">всего решений: {{ accuracyMetrics.totalDecisions || 0 }}</div>
        </template>
      </Card>

      <Card class="stat-card">
        <template #title>
          <div class="stat-title">
            <i class="pi pi-database"></i>
            <span>Обучающих примеров</span>
          </div>
        </template>
        <template #content>
          <div class="stat-value">{{ trainingDataCount }}</div>
          <div class="stat-label">
            использовано: {{ trainingDataUsed }}
          </div>
        </template>
      </Card>

      <Card class="stat-card">
        <template #title>
          <div class="stat-title">
            <i class="pi pi-trophy"></i>
            <span>Лучший агент</span>
          </div>
        </template>
        <template #content>
          <div class="stat-value">
            {{ bestAgent?.agentAvatar || '—' }} {{ bestAgent?.agentName?.slice(0, 15) || '—' }}
          </div>
          <div class="stat-label">
            точность: {{ bestAgent ? (bestAgent.accuracy * 100).toFixed(1) + '%' : '—' }}
          </div>
        </template>
      </Card>

      <Card class="stat-card">
        <template #title>
          <div class="stat-title">
            <i class="pi pi-cog"></i>
            <span>Калибровка весов</span>
          </div>
        </template>
        <template #content>
          <Button
            label="Запустить калибровку"
            icon="pi pi-play"
            @click="runCalibration"
            :loading="isCalibrating"
            :disabled="trainingDataCount < 10"
            class="w-full"
          />
          <div class="stat-label mt-2" v-if="trainingDataCount < 10">
            нужно минимум 10 примеров
          </div>
        </template>
      </Card>
    </div>

    <!-- Main Content Tabs -->
    <Tabs value="0" class="mt-4">
      <TabList>
        <Tab value="0">Анализ точности</Tab>
        <Tab value="1">Обучающий датасет</Tab>
        <Tab value="2">Калибровка весов</Tab>
      </TabList>
      <TabPanels>
      <!-- Tab 1: Accuracy Analysis -->
      <TabPanel value="0">
        <div class="analysis-grid">
          <!-- Predicted vs Actual Chart -->
          <Card>
            <template #title>Прогноз vs Факт</template>
            <template #content>
              <Chart
                type="scatter"
                :data="predictedVsActualChartData"
                :options="scatterChartOptions"
                class="chart-container"
              />
            </template>
          </Card>

          <!-- Accuracy by Year -->
          <Card>
            <template #title>Точность по годам</template>
            <template #content>
              <Chart
                type="line"
                :data="accuracyByYearChartData"
                :options="lineChartOptions"
                class="chart-container"
              />
            </template>
          </Card>

          <!-- Accuracy by Outcome -->
          <Card>
            <template #title>Точность по типу исхода</template>
            <template #content>
              <Chart
                type="bar"
                :data="accuracyByOutcomeChartData"
                :options="barChartOptions"
                class="chart-container"
              />
            </template>
          </Card>

          <!-- Agent Performance Table -->
          <Card class="full-width">
            <template #title>Производительность агентов</template>
            <template #content>
              <DataTable
                :value="accuracyMetrics.byAgent || []"
                :rows="6"
                responsiveLayout="scroll"
                stripedRows
              >
                <Column field="agentAvatar" header="" style="width: 50px;">
                  <template #body="slotProps">
                    <span style="font-size: 1rem;">{{ slotProps.data.agentAvatar }}</span>
                  </template>
                </Column>
                <Column field="agentName" header="Агент" sortable></Column>
                <Column field="totalDecisions" header="Всего решений" sortable></Column>
                <Column field="correctPredictions" header="Верных" sortable></Column>
                <Column field="accuracy" header="Точность" sortable>
                  <template #body="slotProps">
                    <Tag
                      :value="(slotProps.data.accuracy * 100).toFixed(1) + '%'"
                      :severity="slotProps.data.accuracy >= 0.8 ? 'success' : slotProps.data.accuracy >= 0.6 ? 'warning' : 'danger'"
                    />
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </div>
      </TabPanel>

      <!-- Tab 2: Training Dataset -->
      <TabPanel value="1">
        <Card>
          <template #content>
            <DataTable
              :value="trainingData"
              :rows="10"
              :paginator="true"
              responsiveLayout="scroll"
              stripedRows
              :loading="loadingTrainingData"
            >
              <Column field="id" header="ID" style="width: 80px;"></Column>
              <Column field="val" header="Название" sortable></Column>
              <Column field="outcome" header="Исход" sortable>
                <template #body="slotProps">
                  <Tag
                    :value="slotProps.data.outcome"
                    :severity="slotProps.data.outcome === 'EXIT' ? 'success' : slotProps.data.outcome === 'ALIVE' ? 'warning' : 'danger'"
                  />
                </template>
              </Column>
              <Column field="predictedIRR" header="IRR прогноз" sortable>
                <template #body="slotProps">
                  {{ (slotProps.data.predictedIRR * 100).toFixed(1) }}%
                </template>
              </Column>
              <Column field="actualIRR" header="IRR факт" sortable>
                <template #body="slotProps">
                  {{ (slotProps.data.actualIRR * 100).toFixed(1) }}%
                </template>
              </Column>
              <Column field="outcomeDate" header="Дата исхода" sortable></Column>
              <Column field="usedInTraining" header="Использован">
                <template #body="slotProps">
                  <i
                    :class="slotProps.data.usedInTraining ? 'pi pi-check-circle' : 'pi pi-circle'"
                    :style="{ color: slotProps.data.usedInTraining ? 'var(--p-green-500)' : 'var(--p-gray-400)' }"
                  ></i>
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </TabPanel>

      <!-- Tab 3: Weight Calibration -->
      <TabPanel value="2">
        <div class="calibration-grid">
          <Card>
            <template #title>Параметры обучения</template>
            <template #content>
              <div class="p-fluid">
                <div class="field">
                  <label>Количество эпох</label>
                  <InputNumber v-model="calibrationParams.epochs" :min="10" :max="1000" :step="10" />
                </div>
                <div class="field">
                  <label>Learning Rate</label>
                  <InputNumber v-model="calibrationParams.learningRate" :min="0.001" :max="0.1" :step="0.001" mode="decimal" :minFractionDigits="3" />
                </div>
                <div class="field">
                  <label>Validation Split</label>
                  <InputNumber v-model="calibrationParams.validationSplit" :min="0.1" :max="0.5" :step="0.05" mode="decimal" :minFractionDigits="2" />
                </div>
                <div class="field">
                  <label>Минимум примеров</label>
                  <InputNumber v-model="calibrationParams.minExamples" :min="5" :max="100" :step="5" />
                </div>
                <Button
                  label="Запустить калибровку"
                  icon="pi pi-play"
                  @click="runCalibration"
                  :loading="isCalibrating"
                  :disabled="trainingDataCount < calibrationParams.minExamples"
                  class="mt-3"
                />
              </div>
            </template>
          </Card>

          <Card v-if="calibrationResults">
            <template #title>Результаты калибровки</template>
            <template #content>
              <div class="calibration-results">
                <div class="result-row">
                  <span>Обучающих примеров:</span>
                  <strong>{{ calibrationResults.trainingExamples }}</strong>
                </div>
                <div class="result-row">
                  <span>Валидационных примеров:</span>
                  <strong>{{ calibrationResults.validationExamples }}</strong>
                </div>
                <div class="result-row">
                  <span>Эпох:</span>
                  <strong>{{ calibrationResults.epochs }}</strong>
                </div>
                <div class="result-row">
                  <span>Final Loss:</span>
                  <strong>{{ calibrationResults.finalLoss }}</strong>
                </div>
                <div class="result-row">
                  <span>Точность (валидация):</span>
                  <Tag :value="calibrationResults.validationAccuracy" severity="success" />
                </div>
                <div class="result-row mt-3">
                  <span>Улучшение точности:</span>
                  <Tag :value="calibrationResults.improvementMetrics.improvement" severity="info" />
                </div>
                <div class="result-row">
                  <span>Снижение loss:</span>
                  <Tag :value="calibrationResults.improvementMetrics.lossReduction" severity="info" />
                </div>

                <Divider />

                <h4>Новые веса агентов</h4>
                <DataTable :value="calibrationResults.newWeights.agents" responsiveLayout="scroll" class="mt-2">
                  <Column field="name" header="Агент"></Column>
                  <Column field="oldWeight" header="Старый вес">
                    <template #body="slotProps">
                      {{ slotProps.data.oldWeight.toFixed(2) }}
                    </template>
                  </Column>
                  <Column field="newWeight" header="Новый вес">
                    <template #body="slotProps">
                      {{ slotProps.data.newWeight.toFixed(2) }}
                    </template>
                  </Column>
                  <Column field="weightChange" header="Изменение">
                    <template #body="slotProps">
                      <Tag
                        :value="slotProps.data.weightChange"
                        :severity="parseFloat(slotProps.data.weightChange) > 0 ? 'success' : 'danger'"
                      />
                    </template>
                  </Column>
                </DataTable>

                <div class="mt-3 flex gap-2">
                  <Button
                    label="Экспортировать код"
                    icon="pi pi-download"
                    @click="exportWeightsCode"
                    outlined
                  />
                  <Button
                    label="Применить веса"
                    icon="pi pi-check"
                    @click="applyWeights"
                    severity="success"
                    outlined
                  />
                </div>
              </div>
            </template>
          </Card>
        </div>
      </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- Add Training Example Dialog -->
    <Dialog
      v-model:visible="showAddExampleDialog"
      header="Добавить обучающий пример"
      :modal="true"
      :style="{ width: '600px' }"
    >
      <div class="p-fluid">
        <div class="field">
          <label>ID проекта (Integram)</label>
          <InputText v-model="newExample.projectId" placeholder="1202" />
        </div>
        <div class="field">
          <label>ID решения ИК (Integram)</label>
          <InputText v-model="newExample.icDecisionId" placeholder="1300" />
        </div>
        <div class="field">
          <label>Исход</label>
          <Dropdown v-model="newExample.outcome" :options="outcomeOptions" optionLabel="label" optionValue="value" placeholder="Выберите исход" />
        </div>
        <div class="field">
          <label>Фактический IRR (%)</label>
          <InputNumber v-model="newExample.actualIRR" :min="0" :max="200" :step="1" suffix="%" />
        </div>
        <div class="field">
          <label>Дата исхода</label>
          <Calendar v-model="newExample.outcomeDate" dateFormat="yy-mm-dd" showIcon />
        </div>
        <div class="field">
          <label>Причина исхода</label>
          <Textarea v-model="newExample.reasonForOutcome" rows="3" placeholder="Описание причины..." />
        </div>
      </div>

      <template #footer>
        <Button label="Отмена" icon="pi pi-times" @click="showAddExampleDialog = false" text />
        <Button label="Добавить" icon="pi pi-check" @click="addTrainingExample" :loading="addingExample" />
      </template>
    </Dialog>

    <!-- Export Code Dialog -->
    <Dialog
      v-model:visible="showExportCodeDialog"
      header="Экспортированный код весов"
      :modal="true"
      :style="{ width: '800px' }"
    >
      <div class="export-code-container">
        <pre><code>{{ exportedCode }}</code></pre>
        <Button
          label="Скопировать в буфер"
          icon="pi pi-copy"
          @click="copyExportedCode"
          class="mt-3"
          outlined
        />
      </div>
    </Dialog>
  </FstPageLayout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { useToast } from 'primevue/usetoast'
import fstLearningService from '@/services/fstLearningService'

const toast = useToast()

// State
const trainingData = ref([])
const loadingTrainingData = ref(false)
const accuracyMetrics = ref({})
const calibrationResults = ref(null)
const isCalibrating = ref(false)
const showAddExampleDialog = ref(false)
const showExportCodeDialog = ref(false)
const exportedCode = ref('')
const addingExample = ref(false)

// Calibration parameters
const calibrationParams = ref({
  minExamples: 10,
  epochs: 100,
  learningRate: 0.01,
  validationSplit: 0.2,
})

// New training example form
const newExample = ref({
  projectId: '',
  icDecisionId: '',
  outcome: 'ALIVE',
  actualIRR: 0,
  outcomeDate: new Date(),
  reasonForOutcome: '',
})

const outcomeOptions = computed(() => {
  return Object.values(fstLearningService.OUTCOMES).map(o => ({
    label: o.label,
    value: o.value,
  }))
})

// Computed
const trainingDataCount = computed(() => trainingData.value.length)
const trainingDataUsed = computed(() => trainingData.value.filter(d => d.usedInTraining).length)
const bestAgent = computed(() => {
  if (!accuracyMetrics.value.byAgent || accuracyMetrics.value.byAgent.length === 0) return null
  return accuracyMetrics.value.byAgent[0]  // Already sorted by accuracy desc
})

// Chart data
const predictedVsActualChartData = computed(() => {
  const data = trainingData.value.map(d => ({
    x: d.predictedIRR * 100,
    y: d.actualIRR * 100,
  }))

  return {
    datasets: [
      {
        label: 'Прогноз vs Факт (IRR %)',
        data,
        backgroundColor: 'rgba(66, 165, 245, 0.6)',
        borderColor: 'rgba(66, 165, 245, 1)',
      },
      {
        label: 'Идеальная линия',
        data: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
        type: 'line',
        borderColor: 'rgba(255, 99, 132, 0.5)',
        borderDash: [5, 5],
        pointRadius: 0,
      },
    ],
  }
})

const accuracyByYearChartData = computed(() => {
  const byYear = accuracyMetrics.value.byYear || []
  return {
    labels: byYear.map(d => d.year),
    datasets: [
      {
        label: 'Точность ИК',
        data: byYear.map(d => (d.accuracy * 100).toFixed(1)),
        borderColor: 'rgba(102, 187, 106, 1)',
        backgroundColor: 'rgba(102, 187, 106, 0.2)',
        tension: 0.4,
      },
    ],
  }
})

const accuracyByOutcomeChartData = computed(() => {
  const byOutcome = accuracyMetrics.value.byOutcome || {}
  const labels = Object.keys(byOutcome)
  const accuracies = labels.map(outcome => (byOutcome[outcome].accuracy * 100).toFixed(1))

  return {
    labels: labels.map(o => fstLearningService.OUTCOMES[o]?.label || o),
    datasets: [
      {
        label: 'Точность по исходу (%)',
        data: accuracies,
        backgroundColor: labels.map(o => fstLearningService.OUTCOMES[o]?.color || '#ccc'),
      },
    ],
  }
})

const scatterChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { title: { display: true, text: 'Прогнозный IRR (%)' } },
    y: { title: { display: true, text: 'Фактический IRR (%)' } },
  },
}

const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: { min: 0, max: 100, title: { display: true, text: 'Точность (%)' } },
  },
}

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: { min: 0, max: 100, title: { display: true, text: 'Точность (%)' } },
  },
}

// Methods
async function loadData() {
  try {
    loadingTrainingData.value = true
    trainingData.value = await fstLearningService.getTrainingData()
    accuracyMetrics.value = await fstLearningService.getAccuracyMetrics()
  } catch (error) {
    console.error('Error loading data:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось загрузить данные: ' + error.message,
      life: 5000,
    })
  } finally {
    loadingTrainingData.value = false
  }
}

async function runCalibration() {
  try {
    isCalibrating.value = true
    const result = await fstLearningService.calibrateWeights(calibrationParams.value)
    calibrationResults.value = result.calibrationResults

    toast.add({
      severity: 'success',
      summary: 'Калибровка завершена',
      detail: `Точность: ${result.calibrationResults.validationAccuracy}`,
      life: 5000,
    })
  } catch (error) {
    console.error('Error calibrating:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка калибровки',
      detail: error.message,
      life: 5000,
    })
  } finally {
    isCalibrating.value = false
  }
}

async function addTrainingExample() {
  try {
    addingExample.value = true

    const data = {
      projectId: newExample.value.projectId,
      icDecisionId: newExample.value.icDecisionId,
      outcome: newExample.value.outcome,
      actualIRR: newExample.value.actualIRR / 100,  // Convert % to decimal
      outcomeDate: newExample.value.outcomeDate.toISOString().split('T')[0],
      reasonForOutcome: newExample.value.reasonForOutcome,
    }

    await fstLearningService.addTrainingExample(data)

    toast.add({
      severity: 'success',
      summary: 'Успешно',
      detail: 'Обучающий пример добавлен',
      life: 3000,
    })

    showAddExampleDialog.value = false
    loadData()  // Reload data
  } catch (error) {
    console.error('Error adding example:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: error.message,
      life: 5000,
    })
  } finally {
    addingExample.value = false
  }
}

function exportWeightsCode() {
  if (!calibrationResults.value) return
  exportedCode.value = fstLearningService.exportWeightsAsCode(calibrationResults.value)
  showExportCodeDialog.value = true
}

function copyExportedCode() {
  navigator.clipboard.writeText(exportedCode.value)
  toast.add({
    severity: 'success',
    summary: 'Скопировано',
    detail: 'Код скопирован в буфер обмена',
    life: 3000,
  })
}

function applyWeights() {
  toast.add({
    severity: 'info',
    summary: 'Применение весов',
    detail: 'Скопируйте код и вставьте в FstCommitteeConfig.js вручную',
    life: 5000,
  })
  exportWeightsCode()
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.fst-learning-page {
  padding: 2rem;
  max-width: 1600px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.title-section h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 600;
}

.subtitle {
  margin: 0.25rem 0 0 0;
  color: var(--p-text-secondary-color);
  font-size: 0.95rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--surface-card);
}

.stat-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-weight: 500;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--p-primary-color);
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--p-text-secondary-color);
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.analysis-grid .full-width {
  grid-column: 1 / -1;
}

.chart-container {
  min-height: 300px;
}

.calibration-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1.5rem;
}

.calibration-results {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.export-code-container {
  background: var(--p-surface-card);
  padding: 1rem;
  border-radius: 6px;
  max-height: 500px;
  overflow: auto;
}

.export-code-container pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
}

@media (max-width: 1024px) {
  .calibration-grid {
    grid-template-columns: 1fr;
  }

  .analysis-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .p-card { max-width: 100% !important; overflow: hidden; }
}
</style>
