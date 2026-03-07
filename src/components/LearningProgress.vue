<template>
  <div class="learning-progress">
    <!-- Progress Header -->
    <Card class="progress-header-card">
      <template #content>
        <div class="progress-header">
          <div class="role-info">
            <div class="role-icon">{{ roleMetadata?.icon || '🎓' }}</div>
            <div class="role-text">
              <h3>{{ roleMetadata?.title || 'Ваш путь обучения' }}</h3>
              <p>{{ roleMetadata?.description }}</p>
              <Button
                label="Сменить роль"
                icon="pi pi-refresh"
                text
                size="small"
                @click="changeRole"
              />
            </div>
          </div>
          <div class="progress-stats">
            <div class="stat-circle">
              <svg width="120" height="120">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  stroke="var(--p-surface-border)"
                  stroke-width="8"
                  fill="none"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  :stroke="roleMetadata?.color || 'var(--p-primary-color)'"
                  stroke-width="8"
                  fill="none"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="dashOffset"
                  stroke-linecap="round"
                  style="transition: stroke-dashoffset 0.5s ease;"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div class="stat-text">
                <div class="percentage">{{ progress.percentage }}%</div>
                <div class="label">{{ progress.completed }} / {{ progress.total }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <!-- Learning Path Steps -->
    <div class="steps-container">
      <div
        v-for="(step, index) in learningPath?.steps || []"
        :key="step.id"
        class="step-card"
        :class="{
          completed: isStepCompleted(step.id),
          active: !isStepCompleted(step.id) && areAllPreviousCompleted(index)
        }"
      >
        <div class="step-number">
          <i v-if="isStepCompleted(step.id)" class="pi pi-check"></i>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <div class="step-content">
          <div class="step-header">
            <h4>{{ step.title }}</h4>
            <Tag
              :value="step.type"
              :severity="getStepTypeSeverity(step.type)"
              class="step-type-tag"
            />
          </div>
          <p class="step-description">{{ step.description }}</p>
          <div class="step-meta">
            <span class="time-estimate">
              <i class="pi pi-clock"></i>
              {{ step.estimatedTime }}
            </span>
            <div class="step-actions">
              <Button
                v-if="!isStepCompleted(step.id)"
                :label="areAllPreviousCompleted(index) ? 'Начать' : 'Заблокировано'"
                :icon="areAllPreviousCompleted(index) ? 'pi pi-arrow-right' : 'pi pi-lock'"
                size="small"
                :disabled="!areAllPreviousCompleted(index)"
                @click="goToStep(step)"
              />
              <Button
                v-else
                label="Повторить"
                icon="pi pi-replay"
                size="small"
                outlined
                @click="goToStep(step)"
              />
              <Button
                v-if="!isStepCompleted(step.id) && areAllPreviousCompleted(index)"
                label="Отметить выполненным"
                icon="pi pi-check"
                size="small"
                outlined
                severity="success"
                @click="markCompleted(step.id)"
              />
            </div>
          </div>
        </div>
        <div v-if="index < (learningPath?.steps.length || 0) - 1" class="step-connector"></div>
      </div>
    </div>

    <!-- Completion Message -->
    <Card v-if="progress.percentage === 100" class="completion-card">
      <template #content>
        <div class="completion-content">
          <div class="completion-icon">🎉</div>
          <h2>Поздравляем!</h2>
          <p>Вы завершили путь обучения для роли «{{ roleMetadata?.title }}»</p>
          <div class="completion-actions">
            <Button
              label="Выбрать новую роль"
              icon="pi pi-refresh"
              @click="changeRole"
            />
            <Button
              label="Вернуться к обзору"
              icon="pi pi-home"
              outlined
              @click="$router.push('/fst-hub')"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import {
  getUserRole,
  ROLE_METADATA,
  LEARNING_PATHS,
  getCompletedSteps,
  markStepCompleted,
  getLearningProgress,
  resetUserProgress
} from '@/config/learningPaths'

const router = useRouter()
const emit = defineEmits(['change-role'])

const currentRole = ref(getUserRole())
const completedSteps = ref(getCompletedSteps())

const roleMetadata = computed(() => {
  return currentRole.value ? ROLE_METADATA[currentRole.value] : null
})

const learningPath = computed(() => {
  return currentRole.value ? LEARNING_PATHS[currentRole.value] : null
})

const progress = computed(() => {
  return currentRole.value ? getLearningProgress(currentRole.value) : { total: 0, completed: 0, percentage: 0 }
})

const circumference = 2 * Math.PI * 52
const dashOffset = computed(() => {
  return circumference - (progress.value.percentage / 100) * circumference
})

function isStepCompleted(stepId) {
  return completedSteps.value.includes(stepId)
}

function areAllPreviousCompleted(currentIndex) {
  if (currentIndex === 0) return true
  const steps = learningPath.value?.steps || []
  for (let i = 0; i < currentIndex; i++) {
    if (!isStepCompleted(steps[i].id)) {
      return false
    }
  }
  return true
}

function markCompleted(stepId) {
  markStepCompleted(stepId)
  completedSteps.value = getCompletedSteps()
}

function goToStep(step) {
  router.push(step.route)
  // Auto-mark as visited after a delay (simulating user reading the page)
  setTimeout(() => {
    if (!isStepCompleted(step.id)) {
      // Don't auto-mark, let user do it manually
      // markCompleted(step.id)
    }
  }, 2000)
}

function changeRole() {
  if (confirm('Вы уверены? Прогресс текущей роли будет сохранён.')) {
    emit('change-role')
  }
}

function getStepTypeSeverity(type) {
  const severityMap = {
    overview: 'info',
    metrics: 'success',
    reporting: 'warning',
    structure: 'info',
    economics: 'warning',
    legal: 'danger',
    compliance: 'danger',
    sourcing: 'info',
    ai: 'success',
    analysis: 'warning',
    decision: 'danger',
    modeling: 'warning',
    monitoring: 'info',
    analytics: 'success',
    strategy: 'warning',
    simulation: 'success',
    government: 'info',
    exit: 'success',
    syndication: 'info',
    operations: 'warning',
    application: 'info',
    evaluation: 'warning',
    diligence: 'danger',
    terms: 'danger',
    collaboration: 'success',
  }
  return severityMap[type] || 'info'
}

onMounted(() => {
  if (!currentRole.value) {
    router.push('/fst-hub')
  }
})
</script>

<style scoped>
.learning-progress {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.progress-header-card {
  margin-bottom: 2rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.role-info {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  flex: 1;
}

.role-icon {
  font-size: 4rem;
}

.role-text h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.75rem;
  font-weight: 600;
}

.role-text p {
  margin: 0 0 1rem 0;
  color: var(--p-text-secondary-color);
  line-height: 1.5;
}

.progress-stats {
  flex-shrink: 0;
}

.stat-circle {
  position: relative;
  width: 120px;
  height: 120px;
}

.stat-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.percentage {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.label {
  font-size: 0.85rem;
  color: var(--p-text-secondary-color);
}

.steps-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.step-card {
  position: relative;
  background: var(--p-surface-card);
  border: 2px solid var(--p-surface-border);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  gap: 1.5rem;
  transition: all 0.3s ease;
}

.step-card.completed {
  border-color: var(--p-green-500);
  background: var(--p-green-50);
}

.step-card.active {
  border-color: var(--p-primary-color);
  background: var(--p-primary-50);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.step-number {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--p-surface-ground);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 700;
  flex-shrink: 0;
  color: var(--p-text-color);
}

.step-card.completed .step-number {
  background: var(--p-green-500);
  color: white;
}

.step-card.active .step-number {
  background: var(--p-primary-color);
  color: white;
}

.step-content {
  flex: 1;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.step-header h4 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.step-type-tag {
  flex-shrink: 0;
}

.step-description {
  margin: 0.5rem 0 1rem 0;
  color: var(--p-text-secondary-color);
  line-height: 1.5;
}

.step-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.time-estimate {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-text-secondary-color);
  font-size: 0.9rem;
}

.step-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.step-connector {
  position: absolute;
  left: 40px;
  top: 70px;
  width: 2px;
  height: calc(100% - 20px);
  background: var(--p-surface-border);
}

.completion-card {
  margin-top: 2rem;
  background: linear-gradient(135deg, var(--p-green-50) 0%, var(--p-blue-50) 100%);
}

.completion-content {
  text-align: center;
  padding: 2rem;
}

.completion-icon {
  font-size: 5rem;
  margin-bottom: 1rem;
  animation: bounce 1s infinite;
}

.completion-content h2 {
  margin: 0 0 1rem 0;
  font-size: 2rem;
  font-weight: 600;
}

.completion-content p {
  margin: 0 0 2rem 0;
  font-size: 1.1rem;
  color: var(--p-text-secondary-color);
}

.completion-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .progress-header {
    flex-direction: column;
    text-align: center;
  }

  .role-info {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .step-card {
    flex-direction: column;
  }

  .step-connector {
    display: none;
  }

  .step-actions {
    justify-content: center;
  }
}
</style>
