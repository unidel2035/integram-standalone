<template>
  <div class="lesson3-container">
    <!-- Header -->
    <div class="lesson-header">
      <div class="header-content">
        <h1>🎛️ Урок 3: Настройка агентов и параметры</h1>
        <p class="subtitle">
          Интерактивная лаборатория - экспериментируй с настройками и смотри результат в реальном времени!
        </p>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
      </div>
    </div>

    <!-- Steps Navigation -->
    <div class="steps-nav">
      <button
        v-for="step in steps"
        :key="step.id"
        class="step-button"
        :class="{ active: currentStep === step.id, completed: step.id < currentStep }"
        @click="goToStep(step.id)"
      >
        <span class="step-number">{{ step.id }}</span>
        <span class="step-title">{{ step.title }}</span>
      </button>
    </div>

    <!-- Step Content -->
    <div class="step-content">
      <!-- Step 1: Introduction -->
      <div v-if="currentStep === 1" class="step-section">
        <div class="intro-section">
          <div class="intro-icon">🎛️</div>
          <h2>Зачем нужны настройки?</h2>
          <div class="intro-text">
            <p>
              Каждый агент можно настроить под твою задачу! Например, TableAnalyzer может искать разные вещи:
              ошибки, статистику или тренды. Это как настройки в игре - ты выбираешь уровень сложности и что хочешь увидеть!
            </p>
            <div class="analogy-box">
              <div class="analogy-icon">🎸</div>
              <div>
                <strong>Аналогия:</strong>
                <p>
                  Представь агента как музыкальный инструмент: одна и та же гитара звучит по-разному
                  в зависимости от того, как ты её настроишь!
                </p>
              </div>
            </div>
          </div>
          <button class="btn-primary large" @click="nextStep">
            Начать эксперименты →
          </button>
        </div>
      </div>

      <!-- Step 2: TableAnalyzer Lab -->
      <div v-if="currentStep === 2" class="step-section">
        <h2>📊 Изучаем TableAnalyzerAgent</h2>
        <p class="step-description">
          Экспериментируй с настройками и наблюдай как меняется результат!
        </p>

        <AgentLaboratory
          settings-title="Настройки анализа"
          settings-description="Измени параметры и посмотри как изменится результат"
          data-title="Тестовая таблица"
          :is-updating="isAnalyzing"
          :execution-time="analysisTime"
        >
          <template #settings>
            <div class="settings-group">
              <label class="setting-label">Тип анализа</label>
              <div class="radio-group">
                <label
                  v-for="type in agentConfigs.tableAnalyzer.analysisTypes"
                  :key="type.id"
                  class="radio-option"
                >
                  <input
                    type="radio"
                    :value="type.id"
                    v-model="tableSettings.analysisType"
                  />
                  <span class="radio-icon">{{ type.icon }}</span>
                  <div class="radio-text">
                    <div class="radio-label">{{ type.label }}</div>
                    <div class="radio-desc">{{ type.description }}</div>
                  </div>
                </label>
              </div>
            </div>

            <div class="settings-group">
              <label class="setting-label">
                Детализация
                <span class="setting-value">Уровень {{ tableSettings.detailLevel }}</span>
              </label>
              <input
                type="range"
                :min="agentConfigs.tableAnalyzer.detailLevels.min"
                :max="agentConfigs.tableAnalyzer.detailLevels.max"
                v-model.number="tableSettings.detailLevel"
                class="slider"
              />
              <div class="slider-labels">
                <span>Быстрый обзор</span>
                <span>Глубокий анализ</span>
              </div>
            </div>

            <div v-if="tableSettings.analysisType === 'anomalies'" class="settings-group">
              <label class="setting-label">
                Порог аномалий
                <span class="setting-value">{{ getThresholdLabel(tableSettings.anomalyThreshold) }}</span>
              </label>
              <input
                type="range"
                :min="agentConfigs.tableAnalyzer.anomalyThresholds.min"
                :max="agentConfigs.tableAnalyzer.anomalyThresholds.max"
                v-model.number="tableSettings.anomalyThreshold"
                class="slider"
              />
              <div class="slider-labels">
                <span>Строгий</span>
                <span>Мягкий</span>
              </div>
              <div v-if="analysisResult && analysisResult.data.count !== undefined" class="info-badge">
                Найдено аномалий: {{ analysisResult.data.count }}
              </div>
            </div>
          </template>

          <template #data>
            <TableHighlighter
              :data="sampleDatasets.products"
              :highlights="tableHighlights"
              highlight-type="anomaly"
            />
          </template>

          <template #preview>
            <div v-if="analysisResult" class="analysis-result">
              <div v-if="tableSettings.analysisType === 'statistical'" class="result-content">
                <h4>📊 Статистический анализ:</h4>
                <div v-for="(stats, column) in analysisResult.data" :key="column" class="stat-group">
                  <div class="stat-title">{{ column }}:</div>
                  <ul class="stat-list">
                    <li>Среднее: {{ stats.mean }}</li>
                    <li>Медиана: {{ stats.median }}</li>
                    <li v-if="stats.stdDev">Стандартное отклонение: {{ stats.stdDev }}</li>
                    <li>Мин: {{ stats.min }}, Макс: {{ stats.max }}</li>
                  </ul>
                </div>
              </div>

              <div v-else-if="tableSettings.analysisType === 'anomalies'" class="result-content">
                <h4>🔍 Аномалии (порог: {{ getThresholdLabel(tableSettings.anomalyThreshold) }}):</h4>
                <div v-if="analysisResult.data.anomalies.length > 0">
                  <div v-for="(anomaly, idx) in analysisResult.data.anomalies" :key="idx" class="anomaly-item">
                    <strong>{{ sampleDatasets.products[anomaly.row].Продукт }}:</strong>
                    {{ anomaly.column }} = {{ anomaly.value }}
                    (ожидалось ~{{ anomaly.expected }})
                  </div>
                  <div class="recommendation">
                    <strong>💡 Рекомендации:</strong>
                    <p>Проверьте цену апельсинов - возможна ошибка ввода</p>
                  </div>
                </div>
                <div v-else class="no-results">
                  Аномалий не найдено. Попробуйте изменить порог!
                </div>
              </div>

              <div v-else-if="tableSettings.analysisType === 'trends'" class="result-content">
                <h4>📈 Анализ трендов:</h4>
                <div v-for="(trend, column) in analysisResult.data" :key="column" class="trend-group">
                  <div class="trend-title">{{ column }}:</div>
                  <div class="trend-info">
                    Тренд: <strong>{{ trend.trend }}</strong>
                    (изменение: {{ trend.avgChange }} в среднем)
                  </div>
                </div>
              </div>

              <div v-else-if="tableSettings.analysisType === 'relationships'" class="result-content">
                <h4>🔗 Связи между колонками:</h4>
                <div v-if="analysisResult.data.relationships.length > 0">
                  <div
                    v-for="(rel, idx) in analysisResult.data.relationships"
                    :key="idx"
                    class="relationship-item"
                  >
                    <strong>{{ rel.col1 }}</strong> ↔ <strong>{{ rel.col2 }}</strong>:
                    корреляция {{ rel.correlation }} ({{ rel.strength }})
                  </div>
                </div>
                <div v-else class="no-results">
                  Сильных связей не обнаружено
                </div>
              </div>
            </div>
          </template>
        </AgentLaboratory>

        <div class="step-navigation">
          <button class="btn-secondary" @click="prevStep">← Назад</button>
          <button class="btn-primary" @click="nextStep">Далее →</button>
        </div>
      </div>

      <!-- Step 3: Validator Lab -->
      <div v-if="currentStep === 3" class="step-section">
        <h2>✅ Изучаем ValidatorAgent</h2>
        <p class="step-description">
          Настрой правила валидации и смотри какие ошибки будут найдены!
        </p>

        <AgentLaboratory
          settings-title="Правила валидации"
          settings-description="Включи или выключи правила проверки"
          data-title="Таблица контактов"
          :is-updating="isValidating"
          :execution-time="validationTime"
        >
          <template #settings>
            <div class="settings-group">
              <div
                v-for="rule in agentConfigs.validator.rules"
                :key="rule.id"
                class="checkbox-option"
              >
                <label>
                  <input
                    type="checkbox"
                    :checked="validatorRules[rule.id]"
                    @change="toggleRule(rule.id)"
                  />
                  <span class="checkbox-label">{{ rule.label }}</span>
                </label>
                <p class="checkbox-desc">{{ rule.description }}</p>
              </div>
            </div>
          </template>

          <template #data>
            <TableHighlighter
              :data="sampleDatasets.contacts"
              :highlights="validationHighlights"
              highlight-type="error"
            />
          </template>

          <template #preview>
            <div v-if="validationResult" class="validation-result">
              <div v-if="validationResult.errors.length > 0">
                <h4>❌ Найдены ошибки:</h4>
                <div
                  v-for="(error, idx) in validationResult.errors"
                  :key="idx"
                  class="error-item"
                >
                  <strong>Строка {{ error.row + 1 }} ({{ error.name }}):</strong>
                  <ul>
                    <li v-for="(err, errIdx) in error.errors" :key="errIdx">
                      {{ err }}
                    </li>
                  </ul>
                </div>
              </div>

              <div v-if="validationResult.warnings.length > 0" class="warnings-section">
                <h4>⚠️ Общие проблемы:</h4>
                <ul>
                  <li v-for="(warning, idx) in validationResult.warnings" :key="idx">
                    {{ warning }}
                  </li>
                </ul>
              </div>

              <div class="validation-summary">
                <div class="summary-badge success">
                  ✅ Валидных строк: {{ validationResult.validCount }} из {{ validationResult.totalCount }}
                  ({{ validationResult.validPercent }}%)
                </div>
              </div>
            </div>
          </template>
        </AgentLaboratory>

        <div class="step-navigation">
          <button class="btn-secondary" @click="prevStep">← Назад</button>
          <button class="btn-primary" @click="nextStep">Далее →</button>
        </div>
      </div>

      <!-- Step 4: DataTransform Lab -->
      <div v-if="currentStep === 4" class="step-section">
        <h2>🔄 Изучаем DataTransformAgent</h2>
        <p class="step-description">
          Включи трансформации и наблюдай как меняются данные!
        </p>

        <div class="transform-section">
          <SettingsPanel
            title="Доступные трансформации"
            description="Включи нужные трансформации и смотри результат"
          >
            <div class="settings-group">
              <div
                v-for="op in agentConfigs.dataTransform.operations"
                :key="op.id"
                class="toggle-option"
              >
                <label>
                  <input
                    type="checkbox"
                    :checked="transformOperations[op.id]"
                    @change="toggleOperation(op.id)"
                  />
                  <span class="toggle-icon">{{ op.icon }}</span>
                  <span class="toggle-label">{{ op.label }}</span>
                </label>
                <p class="toggle-desc">{{ op.description }}</p>
              </div>
            </div>
          </SettingsPanel>

          <div class="transform-preview">
            <TransformComparison
              :before-data="sampleDatasets.orders"
              :after-data="transformedData"
              :show-changes="true"
            />
          </div>
        </div>

        <div class="step-navigation">
          <button class="btn-secondary" @click="prevStep">← Назад</button>
          <button class="btn-primary" @click="nextStep">Далее →</button>
        </div>
      </div>

      <!-- Step 5: Final Task -->
      <div v-if="currentStep === 5" class="step-section">
        <h2>🎯 Комбинируем настройки</h2>
        <p class="step-description">
          Финальное задание: настрой все агенты для обработки таблицы заказов!
        </p>

        <div class="final-task">
          <div class="task-description">
            <h3>Задача:</h3>
            <p>
              У нас есть таблица заказов. Нужно проверить email клиентов, очистить данные
              и создать PDF-отчёт с графиком продаж по дням.
            </p>
            <h4>Что нужно сделать:</h4>
            <ol>
              <li>Настроить DataTransformAgent - очистить форматы дат и цен</li>
              <li>Настроить ValidatorAgent - проверить email адреса</li>
              <li>Настроить ReportGeneratorAgent - создать PDF отчёт</li>
            </ol>
          </div>

          <div class="task-checklist">
            <h4>Прогресс:</h4>
            <div class="checklist">
              <label class="checklist-item" :class="{ completed: finalTask.transformConfigured }">
                <input type="checkbox" v-model="finalTask.transformConfigured" />
                <span>DataTransform настроен (даты и цены)</span>
              </label>
              <label class="checklist-item" :class="{ completed: finalTask.validatorConfigured }">
                <input type="checkbox" v-model="finalTask.validatorConfigured" />
                <span>Validator настроен (проверка email)</span>
              </label>
              <label class="checklist-item" :class="{ completed: finalTask.reportConfigured }">
                <input type="checkbox" v-model="finalTask.reportConfigured" />
                <span>ReportGenerator настроен (PDF с графиками)</span>
              </label>
              <label class="checklist-item" :class="{ completed: finalTask.workflowTested }">
                <input type="checkbox" v-model="finalTask.workflowTested" />
                <span>Workflow протестирован</span>
              </label>
            </div>

            <button
              class="btn-primary large"
              :disabled="!isTaskCompleted"
              @click="completeLesson"
            >
              {{ isTaskCompleted ? '🏆 Завершить урок' : '⏳ Выполни все задания' }}
            </button>
          </div>
        </div>

        <div class="step-navigation">
          <button class="btn-secondary" @click="prevStep">← Назад</button>
        </div>
      </div>

      <!-- Completion -->
      <div v-if="currentStep === 6" class="step-section">
        <div class="completion-section">
          <div class="completion-icon">🏆</div>
          <h2>Поздравляем!</h2>
          <p class="completion-text">
            Ты завершил Урок 3 и получил бейдж "Мастер настроек - уровень 2"!
          </p>
          <div class="badge-display">
            <img src="/badges/settings-master.svg" alt="Мастер настроек" onerror="this.style.display='none'" />
            <div class="badge-name">⚙️ Мастер настроек</div>
          </div>
          <div class="completion-actions">
            <button class="btn-secondary" @click="goToStep(1)">🔄 Повторить урок</button>
            <router-link to="/agents/tutorial/lesson-4" class="btn-primary">
              Перейти к уроку 4 →
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Lesson Navigation -->
    <div class="lesson-nav">
      <router-link to="/agents/tutorial/lesson-2" class="nav-link prev">
        ← Урок 2: Создание Workflow
      </router-link>
      <router-link to="/agents/tutorial/lesson-4" class="nav-link next">
        Урок 4: Мониторинг →
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import AgentLaboratory from './AgentLaboratory.vue'
import SettingsPanel from './TutorialSettingsPanel.vue'
import LivePreview from './LivePreview.vue'
import TableHighlighter from './TableHighlighter.vue'
import TransformComparison from './TransformComparison.vue'
import {
  sampleDatasets,
  agentConfigs,
  analyzeTable,
  validateData,
  transformData
} from '@/data/tutorial/lesson3Data.js'

const router = useRouter()

// Steps configuration
const steps = [
  { id: 1, title: 'Введение' },
  { id: 2, title: 'TableAnalyzer' },
  { id: 3, title: 'Validator' },
  { id: 4, title: 'DataTransform' },
  { id: 5, title: 'Финал' }
]

const currentStep = ref(1)
const progress = computed(() => (currentStep.value / steps.length) * 100)

// TableAnalyzer state
const tableSettings = ref({
  analysisType: 'statistical',
  detailLevel: 3,
  anomalyThreshold: 2
})
const isAnalyzing = ref(false)
const analysisTime = ref(null)
const analysisResult = ref(null)

// Validator state
const validatorRules = ref({
  email_format: true,
  email_required: false,
  phone_format: true,
  age_range: true,
  phone_unique: false,
  name_strict: false
})
const isValidating = ref(false)
const validationTime = ref(null)
const validationResult = ref(null)

// DataTransform state
const transformOperations = ref({
  normalize_case: true,
  format_dates: true,
  remove_currency: true,
  comma_to_dot: true,
  normalize_text: true
})
const transformedData = ref([])

// Final task state
const finalTask = ref({
  transformConfigured: false,
  validatorConfigured: false,
  reportConfigured: false,
  workflowTested: false
})

const isTaskCompleted = computed(() => {
  return Object.values(finalTask.value).every(v => v === true)
})

// Computed highlights
const tableHighlights = computed(() => {
  if (!analysisResult.value || tableSettings.value.analysisType !== 'anomalies') {
    return []
  }
  return analysisResult.value.data.anomalies.map(a => ({
    row: a.row,
    column: a.column
  }))
})

const validationHighlights = computed(() => {
  if (!validationResult.value) return []

  const highlights = []
  validationResult.value.errors.forEach(error => {
    // Highlight all cells in error rows
    Object.keys(sampleDatasets.contacts[0]).forEach(column => {
      highlights.push({
        row: error.row,
        column: column
      })
    })
  })
  return highlights
})

// Watchers for live updates
let analysisTimeout = null
watch(tableSettings, () => {
  isAnalyzing.value = true
  clearTimeout(analysisTimeout)
  analysisTimeout = setTimeout(() => {
    const result = analyzeTable(sampleDatasets.products, tableSettings.value)
    analysisResult.value = result
    analysisTime.value = result.executionTime
    isAnalyzing.value = false
  }, 300)
}, { deep: true })

let validationTimeout = null
watch(validatorRules, () => {
  isValidating.value = true
  clearTimeout(validationTimeout)
  validationTimeout = setTimeout(() => {
    const startTime = Date.now()
    const result = validateData(sampleDatasets.contacts, validatorRules.value)
    validationResult.value = result
    validationTime.value = Date.now() - startTime
    isValidating.value = false
  }, 300)
}, { deep: true })

watch(transformOperations, () => {
  transformedData.value = transformData(sampleDatasets.orders, transformOperations.value)
}, { deep: true, immediate: true })

// Methods
function nextStep() {
  if (currentStep.value < steps.length + 1) {
    currentStep.value++
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function goToStep(stepId) {
  currentStep.value = stepId
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function getThresholdLabel(threshold) {
  const labels = agentConfigs.tableAnalyzer.anomalyThresholds.labels
  return labels[threshold - 1] || 'Средний'
}

function toggleRule(ruleId) {
  validatorRules.value[ruleId] = !validatorRules.value[ruleId]
}

function toggleOperation(opId) {
  transformOperations.value[opId] = !transformOperations.value[opId]
}

function completeLesson() {
  // Save progress
  localStorage.setItem('lesson3_completed', 'true')
  // Navigate to lesson 4
  router.push('/agents/tutorial/lesson-4')
}

// Initialize
analysisResult.value = analyzeTable(sampleDatasets.products, tableSettings.value)
validationResult.value = validateData(sampleDatasets.contacts, validatorRules.value)
</script>

<style scoped>
.lesson3-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.lesson-header {
  margin-bottom: 32px;
}

.header-content h1 {
  font-size: 32px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px 0;
}

.subtitle {
  font-size: 18px;
  color: #6b7280;
  margin: 0;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  margin-top: 16px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  transition: width 0.3s ease;
}

.steps-nav {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
  overflow-x: auto;
}

.step-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.step-button:hover {
  border-color: #3b82f6;
}

.step-button.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.step-button.completed {
  border-color: #10b981;
}

.step-number {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border-radius: 50%;
  font-weight: 600;
  font-size: 14px;
}

.step-button.active .step-number {
  background: white;
  color: #3b82f6;
}

.step-button.completed .step-number::after {
  content: '✓';
}

.step-content {
  min-height: 600px;
}

.step-section {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-section h2 {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px 0;
}

.step-description {
  font-size: 16px;
  color: #6b7280;
  margin: 0 0 24px 0;
}

/* Introduction */
.intro-section {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
  padding: 48px 24px;
}

.intro-icon {
  font-size: 80px;
  margin-bottom: 24px;
}

.intro-text {
  text-align: left;
  margin: 32px 0;
}

.intro-text p {
  font-size: 18px;
  line-height: 1.8;
  color: #374151;
  margin-bottom: 24px;
}

.analogy-box {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  border-radius: 8px;
  margin: 24px 0;
}

.analogy-icon {
  font-size: 40px;
}

.analogy-box strong {
  display: block;
  margin-bottom: 8px;
  color: #92400e;
}

.analogy-box p {
  margin: 0;
  color: #78350f;
}

/* Settings */
.settings-group {
  margin-bottom: 24px;
}

.setting-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
}

.setting-value {
  font-size: 14px;
  color: #3b82f6;
  font-weight: 600;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radio-option {
  display: flex;
  align-items: start;
  gap: 12px;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-option:hover {
  border-color: #3b82f6;
  background: #eff6ff;
}

.radio-option input[type="radio"] {
  margin-top: 4px;
}

.radio-option input[type="radio"]:checked + .radio-icon + .radio-text {
  color: #3b82f6;
}

.radio-icon {
  font-size: 24px;
}

.radio-text {
  flex: 1;
}

.radio-label {
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}

.radio-desc {
  font-size: 13px;
  color: #6b7280;
}

.slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  outline: none;
  -webkit-appearance: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #6b7280;
  margin-top: 8px;
}

.info-badge {
  margin-top: 12px;
  padding: 8px 12px;
  background: #dbeafe;
  border-radius: 6px;
  font-size: 14px;
  color: #1e40af;
  font-weight: 500;
}

.checkbox-option,
.toggle-option {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin-bottom: 8px;
}

.checkbox-option label,
.toggle-option label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label,
.toggle-label {
  font-weight: 500;
  color: #374151;
}

.toggle-icon {
  font-size: 20px;
}

.checkbox-desc,
.toggle-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 4px 0 0 28px;
}

/* Results */
.analysis-result,
.validation-result {
  font-size: 14px;
}

.result-content h4 {
  margin: 0 0 16px 0;
  color: #111827;
  font-size: 16px;
}

.stat-group,
.trend-group {
  margin-bottom: 16px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
}

.stat-title,
.trend-title {
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.stat-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.stat-list li {
  padding: 4px 0;
  color: #6b7280;
}

.anomaly-item,
.error-item {
  padding: 12px;
  background: #fef2f2;
  border-left: 3px solid #ef4444;
  border-radius: 6px;
  margin-bottom: 12px;
}

.error-item ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.error-item li {
  color: #dc2626;
  margin: 4px 0;
}

.recommendation {
  margin-top: 16px;
  padding: 12px;
  background: #ecfdf5;
  border-left: 3px solid #10b981;
  border-radius: 6px;
}

.no-results {
  padding: 24px;
  text-align: center;
  color: #6b7280;
}

.validation-summary {
  margin-top: 16px;
}

.summary-badge {
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 600;
}

.summary-badge.success {
  background: #d1fae5;
  color: #065f46;
}

/* Transform section */
.transform-section {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 24px;
  align-items: start;
}

/* Final task */
.final-task {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  margin-top: 24px;
}

.task-description {
  padding: 24px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.task-description h3 {
  margin: 0 0 12px 0;
  color: #111827;
}

.task-description h4 {
  margin: 24px 0 12px 0;
  color: #374151;
}

.task-description ol {
  padding-left: 20px;
}

.task-description li {
  margin: 8px 0;
  line-height: 1.6;
}

.task-checklist {
  padding: 24px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.task-checklist h4 {
  margin: 0 0 16px 0;
  color: #111827;
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.checklist-item:hover {
  border-color: #3b82f6;
}

.checklist-item.completed {
  border-color: #10b981;
  background: #f0fdf4;
}

.checklist-item input[type="checkbox"] {
  width: 20px;
  height: 20px;
}

/* Completion */
.completion-section {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
  padding: 48px 24px;
}

.completion-icon {
  font-size: 100px;
  margin-bottom: 24px;
}

.completion-text {
  font-size: 18px;
  color: #374151;
  margin: 16px 0 32px;
}

.badge-display {
  margin: 32px 0;
}

.badge-display img {
  width: 120px;
  height: 120px;
  margin-bottom: 16px;
}

.badge-name {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.completion-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

/* Navigation */
.step-navigation {
  display: flex;
  justify-content: space-between;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

.lesson-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 2px solid #e5e7eb;
}

.nav-link {
  padding: 12px 24px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  text-decoration: none;
  color: #374151;
  font-weight: 600;
  transition: all 0.2s;
}

.nav-link:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

/* Buttons */
.btn-primary,
.btn-secondary {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  text-decoration: none;
  display: inline-block;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-primary.large {
  padding: 16px 32px;
  font-size: 18px;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 2px solid #e5e7eb;
}

.btn-secondary:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

@media (max-width: 1280px) {
  .transform-section,
  .final-task {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .lesson3-container {
    padding: 16px;
  }

  .header-content h1 {
    font-size: 24px;
  }

  .steps-nav {
    overflow-x: auto;
  }

  .completion-actions {
    flex-direction: column;
  }
}
</style>
