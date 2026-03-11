<script setup>
import { ref, watch } from 'vue'
import { analyzePipeline, predictNextEvents, generatePipelineReport } from '@/services/pipelineAIService.js'

const props = defineProps({
  stages:   { type: Array, required: true },
  dealId:   { type: String, required: true },
  dealData: { type: Object, default: () => ({}) },
})

const activeTab = ref('analyze')
const tabs = [
  { id: 'analyze',  label: 'Анализ',  icon: 'pi pi-search' },
  { id: 'predict',  label: 'Прогноз', icon: 'pi pi-chart-line' },
  { id: 'report',   label: 'Отчёт',   icon: 'pi pi-file-pdf' },
]

// ─── Анализ ──────────────────────────────────────────────────────────────────
const analysis = ref(null)
const analysisLoading = ref(false)
const analysisError = ref('')

async function runAnalysis() {
  if (analysis.value) return
  analysisLoading.value = true
  analysisError.value = ''
  try {
    analysis.value = await analyzePipeline(props.stages, props.dealData)
  } catch (e) {
    analysisError.value = e.message
  } finally {
    analysisLoading.value = false
  }
}

// ─── Прогноз ─────────────────────────────────────────────────────────────────
const prediction = ref(null)
const predictLoading = ref(false)
const predictError = ref('')

async function runPredict() {
  if (prediction.value) return
  const activeStage = props.stages.find(s => s.status === 'active')
  if (!activeStage) { prediction.value = { predictions: [], bottleneck: 'Нет активной стадии' }; return }
  predictLoading.value = true
  predictError.value = ''
  try {
    prediction.value = await predictNextEvents(activeStage, props.dealData)
  } catch (e) {
    predictError.value = e.message
  } finally {
    predictLoading.value = false
  }
}

// ─── Отчёт ───────────────────────────────────────────────────────────────────
const report = ref('')
const reportLoading = ref(false)
const reportError = ref('')
const copied = ref(false)

async function runReport() {
  if (report.value) return
  reportLoading.value = true
  reportError.value = ''
  try {
    report.value = await generatePipelineReport(props.stages, props.dealData)
  } catch (e) {
    reportError.value = e.message
  } finally {
    reportLoading.value = false
  }
}

function copyReport() {
  navigator.clipboard.writeText(report.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// Автозапуск при переключении вкладки
watch(activeTab, (tab) => {
  if (tab === 'analyze') runAnalysis()
  if (tab === 'predict') runPredict()
  if (tab === 'report')  runReport()
}, { immediate: true })

function probColor(p) {
  if (p >= 0.7) return 'var(--fst-green)'
  if (p >= 0.4) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}
</script>

<template>
  <div class="paip-panel">
    <!-- Табы -->
    <div class="paip-tabs">
      <SelectButton v-model="activeTab" :options="tabs" optionLabel="label" optionValue="id" :allowEmpty="false" />
    </div>

    <!-- ── Анализ ── -->
    <div v-if="activeTab === 'analyze'" class="paip-body">
      <div v-if="analysisLoading" class="paip-loading">
        <ProgressSpinner style="width: 36px; height: 36px" />
        <span>DeepSeek анализирует конвейер...</span>
      </div>
      <div v-else-if="analysisError" class="paip-error">{{ analysisError }}</div>
      <div v-else-if="analysis">
        <!-- Summary -->
        <div v-if="analysis.summary" class="paip-summary">{{ analysis.summary }}</div>

        <!-- Блокировщики -->
        <div v-if="analysis.blockers?.length" class="paip-section">
          <div class="paip-section-title">
            <i class="pi pi-times-circle" style="color: var(--fst-red)"></i> Блокировщики
          </div>
          <Message v-for="(b, i) in analysis.blockers" :key="i" severity="error" :closable="false" class="paip-msg">
            {{ b }}
          </Message>
        </div>

        <!-- Срочные действия -->
        <div v-if="analysis.urgent?.length" class="paip-section">
          <div class="paip-section-title">
            <i class="pi pi-bolt" style="color: var(--fst-brand)"></i> Срочно
          </div>
          <Message v-for="(u, i) in analysis.urgent" :key="i" severity="warn" :closable="false" class="paip-msg">
            {{ u }}
          </Message>
        </div>

        <!-- Риски -->
        <div v-if="analysis.risks?.length" class="paip-section">
          <div class="paip-section-title">
            <i class="pi pi-exclamation-triangle" style="color: var(--fst-brand)"></i> Риски
          </div>
          <div v-for="(r, i) in analysis.risks" :key="i" class="paip-risk-item">
            <i class="pi pi-circle-fill paip-risk-dot"></i>
            {{ r }}
          </div>
        </div>

        <!-- Уверенность -->
        <div class="paip-confidence">
          Уверенность анализа: {{ Math.round((analysis.confidence || 0) * 100) }}%
        </div>
      </div>
      <div v-else class="paip-empty">Нет данных для анализа</div>
    </div>

    <!-- ── Прогноз ── -->
    <div v-if="activeTab === 'predict'" class="paip-body">
      <div v-if="predictLoading" class="paip-loading">
        <ProgressSpinner style="width: 36px; height: 36px" />
        <span>Claude строит прогноз...</span>
      </div>
      <div v-else-if="predictError" class="paip-error">{{ predictError }}</div>
      <div v-else-if="prediction">
        <div v-if="prediction.bottleneck" class="paip-summary">
          <i class="pi pi-info-circle"></i> {{ prediction.bottleneck }}
        </div>

        <div class="paip-predictions">
          <div v-for="(p, i) in prediction.predictions" :key="i" class="paip-pred-card">
            <div class="paip-pred-header">
              <span class="paip-pred-rank">#{{ i + 1 }}</span>
              <span class="paip-pred-label">{{ p.label }}</span>
              <div class="paip-pred-prob" :style="{ color: probColor(p.probability) }">
                {{ Math.round(p.probability * 100) }}%
              </div>
            </div>
            <div class="paip-pred-bar-track">
              <div class="paip-pred-bar-fill"
                :style="{ width: (p.probability * 100) + '%', background: probColor(p.probability) }">
              </div>
            </div>
            <div class="paip-pred-reason">{{ p.reasoning }}</div>
            <div v-if="p.timeEstimate" class="paip-pred-time">
              <i class="pi pi-clock"></i> {{ p.timeEstimate }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Отчёт ── -->
    <div v-if="activeTab === 'report'" class="paip-body">
      <div v-if="reportLoading" class="paip-loading">
        <ProgressSpinner style="width: 36px; height: 36px" />
        <span>Claude генерирует compliance-отчёт...</span>
      </div>
      <div v-else-if="reportError" class="paip-error">{{ reportError }}</div>
      <div v-else-if="report">
        <div class="paip-report-actions">
          <Button
            :label="copied ? 'Скопировано!' : 'Копировать'"
            :icon="copied ? 'pi pi-check' : 'pi pi-copy'"
            severity="secondary"
            size="small"
            @click="copyReport"
          />
        </div>
        <Textarea :value="report" readonly rows="18" class="paip-report-text" fluid />
      </div>
    </div>
  </div>
</template>

<style scoped>
.paip-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 400px;
}

.paip-tabs {
  padding: 12px 16px;
  border-bottom: 1px solid var(--p-content-border-color);
}

.paip-body {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  max-height: 520px;
}

.paip-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--p-text-muted-color);
  font-size: 13px;
}

.paip-error {
  color: var(--fst-red);
  padding: 12px;
  background: color-mix(in srgb, var(--fst-red) 8%, transparent);
  border-radius: 8px;
  font-size: 13px;
}

.paip-empty {
  text-align: center;
  color: var(--p-text-muted-color);
  padding: 40px;
  font-size: 13px;
}

.paip-summary {
  font-size: 13px;
  line-height: 1.5;
  background: var(--p-surface-ground);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--p-text-muted-color);
}

.paip-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-text-muted-color);
  margin-bottom: 8px;
}

.paip-msg {
  margin: 0;
}

.paip-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.paip-risk-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.4;
  padding: 4px 0;
}

.paip-risk-dot {
  font-size: 7px;
  color: var(--fst-brand);
  margin-top: 5px;
  flex-shrink: 0;
}

.paip-confidence {
  font-size: 11px;
  color: var(--p-text-muted-color);
  text-align: right;
  font-style: italic;
}

/* Прогноз */
.paip-predictions {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.paip-pred-card {
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.paip-pred-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.paip-pred-rank {
  font-size: 10px;
  font-weight: 700;
  background: var(--p-surface-ground);
  border-radius: 4px;
  padding: 1px 5px;
  color: var(--p-text-muted-color);
}

.paip-pred-label {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
}

.paip-pred-prob {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.paip-pred-bar-track {
  height: 4px;
  background: var(--p-surface-ground);
  border-radius: 2px;
  overflow: hidden;
}

.paip-pred-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}

.paip-pred-reason {
  font-size: 12px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

.paip-pred-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--p-text-muted-color);
}

/* Отчёт */
.paip-report-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}

.paip-report-text {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
}
</style>
