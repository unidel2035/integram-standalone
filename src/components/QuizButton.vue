<template>
  <div class="quiz-button-container">
    <!-- Main Quiz Button -->
    <Button
      :label="buttonLabel"
      :icon="buttonIcon"
      :severity="buttonSeverity"
      :outlined="outlined"
      @click="handleClick"
      :badge="hasPreviousAttempts ? bestScoreDisplay : null"
      :badgeClass="scoreBadgeClass"
      v-tooltip.left="tooltipText"
    />

    <!-- Quiz Modal -->
    <QuizModal
      v-model:visible="quizVisible"
      :moduleId="moduleId"
      :questions="quizQuestions"
      :showAIGenerate="true"
      @quiz-completed="handleQuizCompleted"
      @generate-ai-questions="handleGenerateAI"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Button from 'primevue/button'
import QuizModal from './QuizModal.vue'
import { useModuleQuiz } from '@/composables/useModuleQuiz'

const props = defineProps({
  moduleId: {
    type: String,
    required: true
  },
  moduleTitle: {
    type: String,
    required: true
  },
  label: {
    type: String,
    default: 'Пройти квиз'
  },
  outlined: {
    type: Boolean,
    default: false
  },
  showBadge: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['quiz-completed'])

// Use composable
const {
  quizVisible,
  quizQuestions,
  hasExistingQuiz,
  previousAttempts,
  bestScore,
  quizAttemptCount,
  openQuiz,
  handleQuizCompleted: handleQuizCompletedComposable,
  handleGenerateAIQuestions
} = useModuleQuiz(props.moduleId, props.moduleTitle)

// Computed
const hasPreviousAttempts = computed(() => quizAttemptCount.value > 0)

const bestScoreDisplay = computed(() => {
  if (!hasPreviousAttempts.value || !bestScore.value) return null
  return `${bestScore.value}%`
})

const scoreBadgeClass = computed(() => {
  if (!hasPreviousAttempts.value || !bestScore.value) return ''
  if (bestScore.value === 100) return 'quiz-badge-perfect'
  if (bestScore.value >= 80) return 'quiz-badge-great'
  if (bestScore.value >= 60) return 'quiz-badge-good'
  return 'quiz-badge-retry'
})

const buttonLabel = computed(() => {
  if (hasPreviousAttempts.value) {
    return 'Пройти заново'
  }
  return props.label
})

const buttonIcon = computed(() => {
  if (hasPreviousAttempts.value && bestScore.value === 100) {
    return 'pi pi-trophy'
  }
  return 'pi pi-check-circle'
})

const buttonSeverity = computed(() => {
  if (!hasPreviousAttempts.value) return 'info'
  if (bestScore.value === 100) return 'success'
  if (bestScore.value >= 60) return 'warning'
  return 'secondary'
})

const tooltipText = computed(() => {
  if (!hasExistingQuiz.value) {
    return 'Квиз будет сгенерирован с помощью AI'
  }
  if (hasPreviousAttempts.value) {
    return `Лучший результат: ${bestScoreDisplay.value}. Попыток: ${quizAttemptCount.value}`
  }
  return 'Проверьте свои знания по этому модулю'
})

// Methods
function handleClick() {
  openQuiz()
}

function handleQuizCompleted(result) {
  handleQuizCompletedComposable(result)
  emit('quiz-completed', result)
}

function handleGenerateAI() {
  handleGenerateAIQuestions()
}
</script>

<style scoped>
.quiz-button-container {
  display: inline-block;
}

:deep(.quiz-badge-perfect) {
  background: var(--p-green-500);
  color: white;
}

:deep(.quiz-badge-great) {
  background: var(--p-blue-500);
  color: white;
}

:deep(.quiz-badge-good) {
  background: var(--p-yellow-500);
  color: white;
}

:deep(.quiz-badge-retry) {
  background: var(--p-orange-500);
  color: white;
}
</style>
