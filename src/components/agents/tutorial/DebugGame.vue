<template>
  <div class="debug-game">
    <div class="game-header">
      <div class="header-content">
        <h3>🎮 Финальное задание: Найди и исправь {{ totalErrors }} ошибки</h3>
        <p>Используй панель мониторинга, чтобы найти все ошибки и исправить их!</p>
      </div>
      <div class="game-stats">
        <div class="stat-item">
          <span class="stat-label">Найдено:</span>
          <span class="stat-value">{{ foundErrors.length }} / {{ totalErrors }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Исправлено:</span>
          <span class="stat-value">{{ fixedErrors.length }} / {{ totalErrors }}</span>
        </div>
        <div v-if="hintsUsed > 0" class="stat-item">
          <span class="stat-label">Подсказок:</span>
          <span class="stat-value">{{ hintsUsed }}</span>
        </div>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="game-progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <div class="progress-label">{{ progressPercent }}% выполнено</div>
    </div>

    <!-- Game controls -->
    <div class="game-controls">
      <Button
        label="Запустить workflow"
        icon="pi pi-play"
        @click="startWorkflow"
        :disabled="isRunning || isCompleted"
        severity="success"
      />
      <Button
        label="Остановить"
        icon="pi pi-stop"
        @click="stopWorkflow"
        :disabled="!isRunning"
        severity="danger"
      />
      <Button
        label="Сбросить"
        icon="pi pi-refresh"
        @click="resetGame"
        outlined
      />
      <Button
        label="Подсказка"
        icon="pi pi-lightbulb"
        @click="showNextHint"
        :disabled="!canShowHint"
        outlined
      />
    </div>

    <!-- Hints panel -->
    <div v-if="currentHint" class="hint-panel">
      <div class="hint-icon">
        <i class="pi pi-lightbulb"></i>
      </div>
      <div class="hint-content">
        <strong>Подсказка {{ hintsUsed }}:</strong>
        {{ currentHint }}
      </div>
    </div>

    <!-- Completion message -->
    <div v-if="isCompleted" class="completion-panel">
      <div class="completion-icon">
        <i class="pi pi-trophy"></i>
      </div>
      <div class="completion-content">
        <h3>🎉 Поздравляем!</h3>
        <p>Ты нашёл и исправил все {{ totalErrors }} ошибки!</p>
        <div class="reward-info">
          <div class="reward-item">
            <i class="pi pi-star-fill"></i>
            <span>{{ reward.title }}</span>
          </div>
          <div class="reward-item">
            <i class="pi pi-bolt"></i>
            <span>+{{ reward.xp }} XP</span>
          </div>
          <div class="reward-badge">{{ reward.badge }}</div>
        </div>
        <div class="completion-stats">
          <p>Использовано подсказок: {{ hintsUsed }} / {{ hints.length }}</p>
          <p>Время: {{ formatTime(completionTime) }}</p>
        </div>
        <Button
          label="Продолжить обучение"
          icon="pi pi-arrow-right"
          iconPos="right"
          @click="continueLesson"
          severity="success"
          size="large"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  totalErrors: {
    type: Number,
    default: 3
  },
  hints: {
    type: Array,
    default: () => []
  },
  reward: {
    type: Object,
    default: () => ({
      title: 'Мастер отладки - уровень 3',
      xp: 100,
      badge: '🎖️'
    })
  }
})

const emit = defineEmits(['workflow-start', 'workflow-stop', 'reset', 'hint-requested', 'completed'])

const isRunning = ref(false)
const isCompleted = ref(false)
const foundErrors = ref([])
const fixedErrors = ref([])
const hintsUsed = ref(0)
const currentHint = ref(null)
const startTime = ref(null)
const completionTime = ref(0)

const progressPercent = computed(() => {
  return Math.round((fixedErrors.value.length / props.totalErrors) * 100)
})

const canShowHint = computed(() => {
  return hintsUsed.value < props.hints.length && !isCompleted.value
})

const startWorkflow = () => {
  isRunning.value = true
  if (!startTime.value) {
    startTime.value = Date.now()
  }
  emit('workflow-start')
}

const stopWorkflow = () => {
  isRunning.value = false
  emit('workflow-stop')
}

const resetGame = () => {
  isRunning.value = false
  isCompleted.value = false
  foundErrors.value = []
  fixedErrors.value = []
  hintsUsed.value = 0
  currentHint.value = null
  startTime.value = null
  completionTime.value = 0
  emit('reset')
}

const showNextHint = () => {
  if (canShowHint.value) {
    currentHint.value = props.hints[hintsUsed.value]
    hintsUsed.value++
    emit('hint-requested', hintsUsed.value)
  }
}

const formatTime = (ms) => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

const continueLesson = () => {
  emit('completed')
}

// Methods for external use
const errorFound = (errorId) => {
  if (!foundErrors.value.includes(errorId)) {
    foundErrors.value.push(errorId)
  }
}

const errorFixed = (errorId) => {
  if (!fixedErrors.value.includes(errorId)) {
    fixedErrors.value.push(errorId)
  }

  if (fixedErrors.value.length === props.totalErrors) {
    completeGame()
  }
}

const completeGame = () => {
  isCompleted.value = true
  isRunning.value = false
  completionTime.value = Date.now() - startTime.value
  emit('completed', {
    time: completionTime.value,
    hintsUsed: hintsUsed.value,
    errorsFixed: fixedErrors.value.length
  })
}

// Expose methods for parent component
defineExpose({
  errorFound,
  errorFixed,
  completeGame
})
</script>

<style scoped>
.debug-game {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  gap: 2rem;
}

.header-content h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

.header-content p {
  margin: 0;
  color: #6b7280;
}

.game-stats {
  display: flex;
  gap: 1.5rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #3b82f6;
  font-family: 'Consolas', 'Monaco', monospace;
}

.game-progress {
  margin-bottom: 1.5rem;
}

.progress-bar {
  height: 12px;
  background: #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #10b981 100%);
  transition: width 0.5s ease;
  border-radius: 6px;
}

.progress-label {
  text-align: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
}

.game-controls {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.hint-panel {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border-left: 4px solid #f59e0b;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  animation: slideIn 0.5s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hint-icon {
  font-size: 1.5rem;
  color: #f59e0b;
  flex-shrink: 0;
}

.hint-content {
  flex: 1;
  color: #78350f;
  line-height: 1.6;
}

.completion-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border-radius: 16px;
  padding: 3rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  text-align: center;
  animation: popIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  z-index: 1000;
}

@keyframes popIn {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.5);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.completion-icon {
  font-size: 4rem;
  color: #f59e0b;
  margin-bottom: 1.5rem;
  animation: bounce 1s ease infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.completion-content h3 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
}

.completion-content > p {
  margin: 0 0 1.5rem 0;
  color: #6b7280;
  font-size: 1.125rem;
}

.reward-info {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.reward-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #1f2937;
}

.reward-item i {
  color: #f59e0b;
}

.reward-badge {
  font-size: 3rem;
  margin-top: 0.5rem;
}

.completion-stats {
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.completion-stats p {
  margin: 0.25rem 0;
}

@media (max-width: 768px) {
  .game-header {
    flex-direction: column;
    gap: 1rem;
  }

  .game-stats {
    width: 100%;
    justify-content: space-around;
  }

  .game-controls {
    flex-direction: column;
  }

  .completion-panel {
    padding: 2rem 1.5rem;
  }
}
</style>
