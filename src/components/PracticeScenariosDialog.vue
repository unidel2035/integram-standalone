<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Сценарии для практики"
    :style="{ width: '900px', maxWidth: '95vw' }"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="scenarios-container">
      <div class="scenarios-intro">
        <p>Пройдите готовые сценарии, чтобы освоить работу с платформой VentureOS.</p>
        <p class="intro-note">Все действия выполняются на демо-данных и не влияют на реальный фонд.</p>
      </div>

      <div class="scenarios-grid">
        <div
          v-for="scenario in scenarios"
          :key="scenario.id"
          class="scenario-card"
          :class="{
            'scenario-active': isActive(scenario.id),
            'scenario-completed': isCompleted(scenario.id)
          }"
          @click="selectScenario(scenario)"
        >
          <!-- Header -->
          <div class="scenario-header">
            <div class="scenario-badge" :class="`badge-${scenario.difficulty}`">
              {{ difficultyLabel(scenario.difficulty) }}
            </div>
            <div v-if="isCompleted(scenario.id)" class="scenario-status completed">
              <i class="pi pi-check-circle"></i> Пройден
            </div>
            <div v-else-if="isActive(scenario.id)" class="scenario-status active">
              <i class="pi pi-play-circle"></i> В процессе
            </div>
          </div>

          <!-- Title -->
          <h3 class="scenario-title">{{ scenario.title }}</h3>
          <p class="scenario-description">{{ scenario.description }}</p>

          <!-- Meta -->
          <div class="scenario-meta">
            <span class="meta-item">
              <i class="pi pi-clock"></i>
              {{ scenario.estimatedTime }}
            </span>
            <span class="meta-item">
              <i class="pi pi-list"></i>
              {{ scenario.steps.length }} шагов
            </span>
          </div>

          <!-- Progress -->
          <div v-if="getProgress(scenario.id)" class="scenario-progress">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${getProgressPercent(scenario.id)}%` }"
              ></div>
            </div>
            <span class="progress-text">
              {{ getProgress(scenario.id).completed.length }} / {{ scenario.steps.length }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Scenario Detail Dialog -->
    <Dialog
      v-model:visible="showDetail"
      modal
      :header="selectedScenario?.title"
      :style="{ width: '800px', maxWidth: '95vw' }"
    >
      <div v-if="selectedScenario" class="scenario-detail">
        <!-- Info -->
        <div class="detail-info">
          <div class="info-row">
            <span class="info-label">Сложность:</span>
            <span class="info-value badge" :class="`badge-${selectedScenario.difficulty}`">
              {{ difficultyLabel(selectedScenario.difficulty) }}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Время:</span>
            <span class="info-value">{{ selectedScenario.estimatedTime }}</span>
          </div>
        </div>

        <Divider />

        <!-- Description -->
        <div class="detail-section">
          <h4>Описание</h4>
          <p>{{ selectedScenario.description }}</p>
        </div>

        <!-- Learning Goals -->
        <div class="detail-section">
          <h4>Чему научитесь</h4>
          <ul class="goals-list">
            <li v-for="goal in selectedScenario.learningGoals" :key="goal">
              <i class="pi pi-check"></i>
              {{ goal }}
            </li>
          </ul>
        </div>

        <!-- Steps -->
        <div class="detail-section">
          <h4>Шаги сценария</h4>
          <div class="steps-list">
            <div
              v-for="(step, idx) in selectedScenario.steps"
              :key="idx"
              class="step-item"
              :class="{ 'step-completed': isStepCompleted(selectedScenario.id, idx) }"
            >
              <div class="step-number">{{ step.step }}</div>
              <div class="step-content">
                <h5>{{ step.title }}</h5>
                <p>{{ step.instruction }}</p>
                <div v-if="step.tips" class="step-tip">
                  <i class="pi pi-lightbulb"></i>
                  {{ step.tips }}
                </div>
              </div>
              <div v-if="isStepCompleted(selectedScenario.id, idx)" class="step-check">
                <i class="pi pi-check-circle"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- Success Criteria -->
        <div class="detail-section success-criteria">
          <i class="pi pi-trophy"></i>
          <div>
            <strong>Критерий успеха:</strong>
            {{ selectedScenario.successCriteria }}
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          label="Закрыть"
          severity="secondary"
          outlined
          @click="showDetail = false"
        />
        <Button
          v-if="!isCompleted(selectedScenario?.id)"
          :label="isActive(selectedScenario?.id) ? 'Продолжить' : 'Начать практику'"
          icon="pi pi-play"
          @click="startScenario"
        />
        <Button
          v-else
          label="Пройти заново"
          icon="pi pi-refresh"
          severity="secondary"
          @click="startScenario"
        />
      </template>
    </Dialog>
  </Dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSandboxStore } from '@/stores/sandboxStore'
import { demoPracticeScenarios } from '@/data/demoData'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Divider from 'primevue/divider'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

defineEmits(['update:visible'])

const sandboxStore = useSandboxStore()
const scenarios = ref(demoPracticeScenarios)
const selectedScenario = ref(null)
const showDetail = ref(false)

function difficultyLabel(difficulty) {
  const labels = {
    beginner: 'Начинающий',
    intermediate: 'Средний',
    advanced: 'Продвинутый'
  }
  return labels[difficulty] || difficulty
}

function isActive(scenarioId) {
  return sandboxStore.activeScenario === scenarioId
}

function isCompleted(scenarioId) {
  const progress = sandboxStore.scenarioProgress[scenarioId]
  return progress && progress.completedAt
}

function isStepCompleted(scenarioId, stepIndex) {
  const progress = sandboxStore.scenarioProgress[scenarioId]
  return progress && progress.completed.includes(stepIndex)
}

function getProgress(scenarioId) {
  return sandboxStore.scenarioProgress[scenarioId]
}

function getProgressPercent(scenarioId) {
  const scenario = scenarios.value.find(s => s.id === scenarioId)
  const progress = getProgress(scenarioId)
  if (!scenario || !progress) return 0
  return Math.round((progress.completed.length / scenario.steps.length) * 100)
}

function selectScenario(scenario) {
  selectedScenario.value = scenario
  showDetail.value = true
}

function startScenario() {
  if (selectedScenario.value) {
    sandboxStore.startScenario(selectedScenario.value.id)
    showDetail.value = false
    // Navigate to appropriate page based on scenario
    const routeMap = {
      'scenario-1': '/fst-committee',
      'scenario-2': '/fst-deal',
      'scenario-3': '/fst-portfolio'
    }
    const route = routeMap[selectedScenario.value.id]
    if (route && window.$router) {
      window.$router.push(route)
    }
  }
}
</script>

<style scoped>
.scenarios-container {
  padding: 1rem 0;
}

.scenarios-intro {
  margin-bottom: 1.5rem;
}

.scenarios-intro p {
  margin: 0.5rem 0;
  line-height: 1.6;
}

.intro-note {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}

.scenarios-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.scenario-card {
  padding: 1.25rem;
  border: 2px solid var(--p-surface-border);
  border-radius: 12px;
  background: var(--p-surface-card);
  cursor: pointer;
  transition: all 0.2s;
}

.scenario-card:hover {
  border-color: var(--p-primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.scenario-card.scenario-active {
  border-color: var(--p-blue-500);
  background: rgba(59, 130, 246, 0.05);
}

.scenario-card.scenario-completed {
  border-color: var(--p-green-500);
  background: rgba(34, 197, 94, 0.05);
}

.scenario-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.scenario-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-beginner {
  background: var(--p-green-100);
  color: var(--p-green-700);
}

.badge-intermediate {
  background: var(--p-orange-100);
  color: var(--p-orange-700);
}

.badge-advanced {
  background: var(--p-red-100);
  color: var(--p-red-700);
}

.scenario-status {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.scenario-status.active {
  color: var(--p-blue-600);
}

.scenario-status.completed {
  color: var(--p-green-600);
}

.scenario-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.scenario-description {
  margin: 0 0 1rem 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--p-text-muted-color);
}

.scenario-meta {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.scenario-progress {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--p-surface-border);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--p-primary-color), var(--p-primary-600));
  transition: width 0.3s;
}

.progress-text {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

/* Scenario Detail */
.scenario-detail {
  padding: 0.5rem 0;
}

.detail-info {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-label {
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.info-value {
  color: var(--p-text-color);
}

.detail-section {
  margin: 1.5rem 0;
}

.detail-section h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.detail-section p {
  margin: 0;
  line-height: 1.6;
  color: var(--p-text-muted-color);
}

.goals-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.goals-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  color: var(--p-text-color);
}

.goals-list li i {
  color: var(--p-green-600);
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.step-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-50);
}

.step-item.step-completed {
  border-color: var(--p-green-500);
  background: rgba(34, 197, 94, 0.05);
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--p-primary-color);
  color: white;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
}

.step-content h5 {
  margin: 0 0 0.5rem 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.step-content p {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--p-text-muted-color);
}

.step-tip {
  display: flex;
  align-items: start;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--p-blue-50);
  border-left: 3px solid var(--p-blue-500);
  border-radius: 4px;
  font-size: 0.85rem;
  color: var(--p-blue-700);
  margin-top: 0.5rem;
}

.step-tip i {
  margin-top: 0.15rem;
  flex-shrink: 0;
}

.step-check {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--p-green-600);
  flex-shrink: 0;
}

.success-criteria {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--p-yellow-50);
  border-left: 4px solid var(--p-yellow-500);
  border-radius: 4px;
}

.success-criteria i {
  font-size: 1.5rem;
  color: var(--p-yellow-600);
  flex-shrink: 0;
}

.success-criteria div {
  color: var(--p-yellow-900);
  line-height: 1.5;
}
</style>
