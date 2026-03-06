<template>
  <div class="interactive-demo">
    <div class="demo-header">
      <h3>
        <i class="pi pi-bolt"></i>
        Интерактивная демонстрация
      </h3>
      <p>Нажми кнопку, чтобы запустить анализ таблицы с помощью AI-агента!</p>
    </div>

    <div class="demo-content">
      <!-- Data Table -->
      <div class="demo-table-container">
        <DataTable
          :value="tableData"
          :loading="isRunning"
          showGridlines
          class="demo-table"
        >
          <Column
            v-for="(header, index) in headers"
            :key="index"
            :field="`col${index}`"
            :header="header"
          />
        </DataTable>
      </div>

      <!-- Agent Animation -->
      <div v-if="showAgent" class="agent-animation">
        <div class="agent-icon-moving" :class="{ analyzing: isRunning }">
          <i class="pi pi-search"></i>
          <span class="agent-name">TableAnalyzerAgent</span>
        </div>
        <div class="thinking-dots" v-if="isRunning">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      <!-- Run Button -->
      <div class="demo-controls">
        <Button
          :label="isRunning ? 'Анализирую...' : completed ? 'Запустить снова' : 'Запустить анализ'"
          :icon="isRunning ? 'pi pi-spin pi-spinner' : 'pi pi-play'"
          @click="runDemo"
          :disabled="isRunning"
          size="large"
          severity="success"
          raised
        />
      </div>

      <!-- Results -->
      <div v-if="result" class="demo-results">
        <div class="results-header">
          <i class="pi pi-chart-bar"></i>
          <h4>Результаты анализа</h4>
        </div>
        <div class="results-grid">
          <div class="result-card">
            <div class="result-icon" style="background: #EFF6FF; color: #3B82F6">
              <i class="pi pi-list"></i>
            </div>
            <div class="result-content">
              <span class="result-label">Всего позиций</span>
              <span class="result-value">{{ result.items }}</span>
            </div>
          </div>
          <div class="result-card">
            <div class="result-icon" style="background: #ECFDF5; color: #10B981">
              <i class="pi pi-dollar"></i>
            </div>
            <div class="result-content">
              <span class="result-label">Средняя цена</span>
              <span class="result-value">{{ result.avgPrice }} ₽</span>
            </div>
          </div>
          <div class="result-card">
            <div class="result-icon" style="background: #FEF3C7; color: #F59E0B">
              <i class="pi pi-box"></i>
            </div>
            <div class="result-content">
              <span class="result-label">Общее количество</span>
              <span class="result-value">{{ result.totalQuantity }}</span>
            </div>
          </div>
          <div class="result-card">
            <div class="result-icon" style="background: #FDF2F8; color: #EC4899">
              <i class="pi pi-star"></i>
            </div>
            <div class="result-content">
              <span class="result-label">Самый дорогой</span>
              <span class="result-value">{{ result.mostExpensive }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Completion Message -->
      <div v-if="completed" class="completion-message">
        <div class="celebration-icon">
          <i class="pi pi-check-circle"></i>
        </div>
        <h3>Поздравляем!</h3>
        <p>Ты запустил своего первого агента! Видишь, как быстро он проанализировал данные?</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineProps } from 'vue'

const props = defineProps({
  demoData: {
    type: Object,
    required: true
  },
  expectedResult: {
    type: Object,
    required: true
  }
})

const isRunning = ref(false)
const showAgent = ref(false)
const result = ref(null)
const completed = ref(false)

const headers = computed(() => props.demoData.headers)

const tableData = computed(() => {
  return props.demoData.rows.map((row) => {
    const obj = {}
    row.forEach((cell, index) => {
      obj[`col${index}`] = cell
    })
    return obj
  })
})

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const runDemo = async () => {
  isRunning.value = true
  showAgent.value = true
  result.value = null
  completed.value = false

  // Simulate agent thinking
  await delay(2000)

  // Show results
  result.value = props.expectedResult
  isRunning.value = false

  await delay(500)
  completed.value = true

  // Save progress to localStorage
  localStorage.setItem('tutorial_lesson1_completed', 'true')
}
</script>

<style scoped>
.interactive-demo {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin: 2rem 0;
}

.demo-header {
  text-align: center;
  margin-bottom: 2rem;
}

.demo-header h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.demo-header h3 i {
  color: #F59E0B;
}

.demo-header p {
  color: #6B7280;
  font-size: 1rem;
  margin: 0;
}

.demo-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.demo-table-container {
  width: 100%;
  overflow-x: auto;
}

.demo-table {
  border-radius: 8px;
  overflow: hidden;
}

.agent-animation {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
  border-radius: 12px;
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.agent-icon-moving {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.agent-icon-moving i {
  font-size: 2.5rem;
  color: #3B82F6;
}

.agent-icon-moving.analyzing i {
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.agent-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #3B82F6;
}

.thinking-dots {
  display: flex;
  gap: 0.5rem;
}

.thinking-dots span {
  width: 8px;
  height: 8px;
  background: #3B82F6;
  border-radius: 50%;
  animation: think 1.4s ease-in-out infinite;
}

.thinking-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes think {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1.2);
  }
}

.demo-controls {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

.demo-results {
  animation: slideUp 0.5s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.results-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.results-header i {
  color: #3B82F6;
  font-size: 1.5rem;
}

.results-header h4 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.result-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #E5E7EB;
  transition: all 0.3s ease;
}

.result-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.result-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.result-label {
  font-size: 0.85rem;
  color: #6B7280;
}

.result-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
}

.completion-message {
  text-align: center;
  padding: 2rem;
  background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
  border-radius: 12px;
  animation: celebrate 0.6s ease;
}

@keyframes celebrate {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.celebration-icon {
  margin-bottom: 1rem;
}

.celebration-icon i {
  font-size: 4rem;
  color: #10B981;
  animation: checkPulse 1.5s ease-in-out infinite;
}

@keyframes checkPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.completion-message h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #065F46;
  margin: 0 0 0.5rem 0;
}

.completion-message p {
  color: #047857;
  font-size: 1rem;
  margin: 0;
}

@media (max-width: 768px) {
  .interactive-demo {
    padding: 1.5rem;
  }

  .results-grid {
    grid-template-columns: 1fr;
  }

  .demo-header h3 {
    font-size: 1.25rem;
  }

  .agent-icon-moving i {
    font-size: 2rem;
  }
}
</style>
