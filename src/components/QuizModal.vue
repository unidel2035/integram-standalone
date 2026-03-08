<template>
  <Dialog
    v-model:visible="localVisible"
    :header="quizTitle"
    :modal="true"
    :closable="!quizInProgress"
    :style="{ width: '800px', maxWidth: '95vw' }"
    @hide="handleClose"
  >
    <!-- Quiz Intro -->
    <div v-if="!quizStarted" class="quiz-intro">
      <div class="intro-icon">🎯</div>
      <h3>Готовы проверить свои знания?</h3>
      <p class="intro-description">
        Пройдите короткий квиз из {{ totalQuestions }} вопросов, чтобы закрепить полученные знания.
        За правильные ответы вы получите XP-очки и сможете открыть бейджи!
      </p>
      <div class="intro-stats">
        <div class="stat-item">
          <i class="pi pi-question-circle"></i>
          <span>{{ totalQuestions }} вопросов</span>
        </div>
        <div class="stat-item">
          <i class="pi pi-clock"></i>
          <span>~5 минут</span>
        </div>
        <div class="stat-item">
          <i class="pi pi-star"></i>
          <span>До {{ maxXP }} XP</span>
        </div>
      </div>
      <Button
        label="Начать квиз"
        icon="pi pi-play"
        @click="startQuiz"
        size="large"
        class="start-button"
      />
    </div>

    <!-- Quiz Question -->
    <div v-else-if="!showResults" class="quiz-question">
      <div class="question-header">
        <ProgressBar
          :value="progressPercentage"
          :showValue="false"
          class="quiz-progress"
        />
        <div class="question-counter">
          Вопрос {{ currentQuestionIndex + 1 }} из {{ totalQuestions }}
        </div>
      </div>

      <div class="question-content">
        <h3 class="question-text">{{ currentQuestion.question }}</h3>

        <!-- Multiple Choice -->
        <div v-if="currentQuestion.type === 'multiple-choice'" class="answer-options">
          <div
            v-for="(option, index) in currentQuestion.options"
            :key="index"
            class="option-card"
            :class="{
              selected: selectedAnswer === index,
              disabled: answerSubmitted
            }"
            @click="!answerSubmitted && selectAnswer(index)"
          >
            <div class="option-letter">{{ String.fromCharCode(65 + index) }}</div>
            <div class="option-text">{{ option }}</div>
            <i
              v-if="answerSubmitted && index === currentQuestion.correctAnswer"
              class="pi pi-check-circle correct-indicator"
            ></i>
            <i
              v-if="answerSubmitted && index === selectedAnswer && index !== currentQuestion.correctAnswer"
              class="pi pi-times-circle incorrect-indicator"
            ></i>
          </div>
        </div>

        <!-- True/False -->
        <div v-if="currentQuestion.type === 'true-false'" class="answer-options tf-options">
          <div
            v-for="option in [true, false]"
            :key="option"
            class="option-card tf-card"
            :class="{
              selected: selectedAnswer === option,
              disabled: answerSubmitted
            }"
            @click="!answerSubmitted && selectAnswer(option)"
          >
            <i :class="option ? 'pi pi-check' : 'pi pi-times'" class="tf-icon"></i>
            <div class="option-text">{{ option ? 'Верно' : 'Неверно' }}</div>
            <i
              v-if="answerSubmitted && option === currentQuestion.correctAnswer"
              class="pi pi-check-circle correct-indicator"
            ></i>
            <i
              v-if="answerSubmitted && option === selectedAnswer && option !== currentQuestion.correctAnswer"
              class="pi pi-times-circle incorrect-indicator"
            ></i>
          </div>
        </div>

        <!-- Fill in the Blank -->
        <div v-if="currentQuestion.type === 'fill-blank'" class="fill-blank-input">
          <InputText
            v-model="fillBlankAnswer"
            :disabled="answerSubmitted"
            placeholder="Введите ваш ответ..."
            class="w-full"
            @keyup.enter="!answerSubmitted && submitAnswer()"
          />
        </div>

        <!-- Explanation (shown after answer) -->
        <div v-if="answerSubmitted" class="answer-explanation">
          <div v-if="isCurrentAnswerCorrect" class="explanation-box correct">
            <i class="pi pi-check-circle"></i>
            <div>
              <strong>Правильно! 🎉</strong>
              <p>{{ currentQuestion.explanation }}</p>
            </div>
          </div>
          <div v-else class="explanation-box incorrect">
            <i class="pi pi-times-circle"></i>
            <div>
              <strong>Неправильно</strong>
              <p>{{ currentQuestion.explanation }}</p>
              <p v-if="currentQuestion.type === 'fill-blank'" class="correct-answer-hint">
                Правильный ответ: <strong>{{ currentQuestion.correctAnswer }}</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="question-actions">
        <Button
          v-if="!answerSubmitted"
          label="Проверить"
          icon="pi pi-check"
          @click="submitAnswer"
          :disabled="selectedAnswer === null && !fillBlankAnswer"
        />
        <Button
          v-else
          :label="isLastQuestion ? 'Показать результаты' : 'Следующий вопрос'"
          :icon="isLastQuestion ? 'pi pi-trophy' : 'pi pi-arrow-right'"
          @click="nextQuestion"
        />
      </div>
    </div>

    <!-- Quiz Results -->
    <div v-else class="quiz-results">
      <div class="results-icon">{{ resultEmoji }}</div>
      <h2>{{ resultTitle }}</h2>
      <div class="score-display">
        <div class="score-circle">
          <svg width="150" height="150">
            <circle
              cx="75"
              cy="75"
              r="65"
              stroke="var(--surface-border)"
              stroke-width="10"
              fill="none"
            />
            <circle
              cx="75"
              cy="75"
              r="65"
              :stroke="scoreColor"
              stroke-width="10"
              fill="none"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="scoreDashOffset"
              stroke-linecap="round"
              transform="rotate(-90 75 75)"
            />
          </svg>
          <div class="score-text">
            <div class="score-percentage">{{ scorePercentage }}%</div>
            <div class="score-label">{{ correctAnswers }} / {{ totalQuestions }}</div>
          </div>
        </div>
      </div>

      <div class="results-stats">
        <div class="result-stat">
          <i class="pi pi-check" style="color: var(--p-green-500);"></i>
          <span>Правильно: {{ correctAnswers }}</span>
        </div>
        <div class="result-stat">
          <i class="pi pi-times" style="color: var(--p-red-500);"></i>
          <span>Неправильно: {{ totalQuestions - correctAnswers }}</span>
        </div>
        <div class="result-stat">
          <i class="pi pi-star" style="color: var(--p-yellow-500);"></i>
          <span>Получено XP: {{ earnedXP }}</span>
        </div>
      </div>

      <!-- Badge Unlocked -->
      <div v-if="badgeUnlocked" class="badge-unlocked">
        <div class="badge-animation">
          <div class="badge-icon">{{ badgeUnlocked.icon }}</div>
        </div>
        <h3>Бейдж разблокирован!</h3>
        <p class="badge-name">{{ badgeUnlocked.name }}</p>
        <p class="badge-description">{{ badgeUnlocked.description }}</p>
      </div>

      <!-- Review Answers -->
      <div class="review-section">
        <h4>Обзор ответов</h4>
        <div
          v-for="(question, index) in questions"
          :key="index"
          class="review-item"
          :class="{ correct: userAnswers[index].correct, incorrect: !userAnswers[index].correct }"
        >
          <div class="review-header">
            <span class="review-number">{{ index + 1 }}.</span>
            <i
              :class="userAnswers[index].correct ? 'pi pi-check-circle' : 'pi pi-times-circle'"
              :style="{ color: userAnswers[index].correct ? 'var(--p-green-500)' : 'var(--p-red-500)' }"
            ></i>
            <span class="review-question">{{ question.question }}</span>
          </div>
        </div>
      </div>

      <div class="results-actions">
        <Button
          label="Повторить слабые места"
          icon="pi pi-replay"
          outlined
          @click="retakeWrongQuestions"
          v-if="correctAnswers < totalQuestions"
        />
        <Button
          label="Пройти заново"
          icon="pi pi-refresh"
          outlined
          @click="restartQuiz"
        />
        <Button
          label="Закрыть"
          icon="pi pi-check"
          @click="closeQuiz"
        />
      </div>
    </div>

    <!-- AI Generate Button (bottom right corner when not in quiz) -->
    <template #footer v-if="!quizStarted && showAIGenerate">
      <Button
        label="Сгенерировать новые вопросы"
        icon="pi pi-sparkles"
        outlined
        severity="secondary"
        @click="generateAIQuestions"
        :loading="generatingQuestions"
        size="small"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import InputText from 'primevue/inputtext'
import { useGamificationStore } from '@/stores/gamificationStore'
import { useToast } from 'primevue/usetoast'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  moduleId: {
    type: String,
    required: true
  },
  questions: {
    type: Array,
    required: true
  },
  showAIGenerate: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:visible', 'quiz-completed', 'generate-ai-questions'])

const toast = useToast()
const gamificationStore = useGamificationStore()

// Local ref for v-model:visible (can't bind prop directly)
const localVisible = ref(props.visible)
watch(() => props.visible, (val) => { localVisible.value = val })
watch(localVisible, (val) => { emit('update:visible', val) })

// State
const quizStarted = ref(false)
const showResults = ref(false)
const currentQuestionIndex = ref(0)
const selectedAnswer = ref(null)
const fillBlankAnswer = ref('')
const answerSubmitted = ref(false)
const userAnswers = ref([])
const correctAnswers = ref(0)
const badgeUnlocked = ref(null)
const generatingQuestions = ref(false)

// Computed
const quizTitle = computed(() => {
  if (!quizStarted.value) return 'Мини-квиз'
  if (showResults.value) return 'Результаты квиза'
  return 'Мини-квиз'
})

const totalQuestions = computed(() => props.questions.length)

const maxXP = computed(() => totalQuestions.value * 10)

const currentQuestion = computed(() => props.questions[currentQuestionIndex.value])

const progressPercentage = computed(() => {
  return Math.round(((currentQuestionIndex.value + 1) / totalQuestions.value) * 100)
})

const isLastQuestion = computed(() => {
  return currentQuestionIndex.value === totalQuestions.value - 1
})

const quizInProgress = computed(() => {
  return quizStarted.value && !showResults.value
})

const isCurrentAnswerCorrect = ref(false)

const scorePercentage = computed(() => {
  return Math.round((correctAnswers.value / totalQuestions.value) * 100)
})

const scoreColor = computed(() => {
  const percentage = scorePercentage.value
  if (percentage >= 80) return 'var(--p-green-500)'
  if (percentage >= 60) return 'var(--p-yellow-500)'
  return 'var(--p-red-500)'
})

const circumference = 2 * Math.PI * 65
const scoreDashOffset = computed(() => {
  return circumference - (scorePercentage.value / 100) * circumference
})

const resultEmoji = computed(() => {
  const percentage = scorePercentage.value
  if (percentage === 100) return '🏆'
  if (percentage >= 80) return '🎉'
  if (percentage >= 60) return '👍'
  return '💪'
})

const resultTitle = computed(() => {
  const percentage = scorePercentage.value
  if (percentage === 100) return 'Отлично! Идеальный результат!'
  if (percentage >= 80) return 'Отличная работа!'
  if (percentage >= 60) return 'Хороший результат!'
  return 'Есть куда расти!'
})

const earnedXP = computed(() => {
  return correctAnswers.value * 10
})

// Methods
function startQuiz() {
  quizStarted.value = true
  currentQuestionIndex.value = 0
  userAnswers.value = []
  correctAnswers.value = 0
  selectedAnswer.value = null
  fillBlankAnswer.value = ''
  answerSubmitted.value = false
  showResults.value = false
}

function selectAnswer(answer) {
  selectedAnswer.value = answer
}

function submitAnswer() {
  let answer = selectedAnswer.value
  let correct = false

  if (currentQuestion.value.type === 'fill-blank') {
    answer = fillBlankAnswer.value.trim()
    // Normalize and compare
    const correctAnswers = Array.isArray(currentQuestion.value.correctAnswer)
      ? currentQuestion.value.correctAnswer
      : [currentQuestion.value.correctAnswer]

    correct = correctAnswers.some(ca =>
      answer.toLowerCase() === ca.toLowerCase()
    )
  } else {
    correct = answer === currentQuestion.value.correctAnswer
  }

  isCurrentAnswerCorrect.value = correct
  answerSubmitted.value = true

  userAnswers.value.push({
    questionIndex: currentQuestionIndex.value,
    userAnswer: answer,
    correct: correct
  })

  if (correct) {
    correctAnswers.value++
  }
}

function nextQuestion() {
  if (isLastQuestion.value) {
    finishQuiz()
  } else {
    currentQuestionIndex.value++
    selectedAnswer.value = null
    fillBlankAnswer.value = ''
    answerSubmitted.value = false
  }
}

async function finishQuiz() {
  showResults.value = true

  // Award XP and check for badges
  const xpAwarded = earnedXP.value
  gamificationStore.addXP(xpAwarded, `quiz-${props.moduleId}`)

  // Check for perfect score badge
  if (scorePercentage.value === 100) {
    const badge = gamificationStore.unlockBadge(`perfect-${props.moduleId}`)
    if (badge) {
      badgeUnlocked.value = badge
    }
  }

  // Record quiz completion
  gamificationStore.recordQuizCompletion(props.moduleId, {
    score: scorePercentage.value,
    correctAnswers: correctAnswers.value,
    totalQuestions: totalQuestions.value,
    xpEarned: xpAwarded
  })

  emit('quiz-completed', {
    score: scorePercentage.value,
    correctAnswers: correctAnswers.value,
    totalQuestions: totalQuestions.value,
    xpEarned: xpAwarded
  })

  toast.add({
    severity: 'success',
    summary: 'Квиз завершён!',
    detail: `Вы набрали ${xpAwarded} XP`,
    life: 3000
  })
}

function restartQuiz() {
  startQuiz()
}

function retakeWrongQuestions() {
  // Filter to only wrong questions and restart
  const wrongQuestions = userAnswers.value
    .filter(a => !a.correct)
    .map(a => props.questions[a.questionIndex])

  if (wrongQuestions.length > 0) {
    // TODO: Implement filtering questions
    toast.add({
      severity: 'info',
      summary: 'Повтор вопросов',
      detail: 'Функция повтора неправильных вопросов будет добавлена в следующей версии',
      life: 3000
    })
  }
}

function closeQuiz() {
  emit('update:visible', false)
}

function handleClose() {
  if (!quizInProgress.value) {
    closeQuiz()
  }
}

async function generateAIQuestions() {
  generatingQuestions.value = true
  try {
    emit('generate-ai-questions', props.moduleId)
  } catch (error) {
    console.error('Error generating questions:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось сгенерировать вопросы',
      life: 3000
    })
  } finally {
    generatingQuestions.value = false
  }
}

// Watch for prop changes
watch(() => props.visible, (newVal) => {
  if (!newVal) {
    // Reset when closed
    setTimeout(() => {
      quizStarted.value = false
      showResults.value = false
      badgeUnlocked.value = null
    }, 300)
  }
})
</script>

<style scoped>
.quiz-intro {
  text-align: center;
  padding: 2rem 1rem;
}

.intro-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.quiz-intro h3 {
  margin: 0 0 1rem 0;
  font-size: 1.75rem;
  font-weight: 600;
}

.intro-description {
  color: var(--p-text-secondary-color);
  line-height: 1.6;
  margin-bottom: 2rem;
}

.intro-stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--p-text-secondary-color);
  font-size: 0.95rem;
}

.start-button {
  width: 100%;
  max-width: 300px;
}

.quiz-question {
  padding: 1rem;
}

.question-header {
  margin-bottom: 2rem;
}

.quiz-progress {
  margin-bottom: 0.5rem;
}

.question-counter {
  text-align: right;
  font-size: 0.9rem;
  color: var(--p-text-secondary-color);
}

.question-content {
  margin-bottom: 2rem;
}

.question-text {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
}

.answer-options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tf-options {
  flex-direction: row;
  gap: 1rem;
}

.option-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border: 2px solid var(--surface-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--surface-card);
  position: relative;
}

.option-card:hover:not(.disabled) {
  border-color: var(--p-primary-color);
  background: var(--p-primary-50);
  transform: translateX(4px);
}

.option-card.selected {
  border-color: var(--p-primary-color);
  background: var(--p-primary-50);
}

.option-card.disabled {
  cursor: default;
}

.tf-card {
  flex: 1;
  justify-content: center;
  flex-direction: column;
  text-align: center;
}

.option-letter {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface-ground);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--p-text-color);
  flex-shrink: 0;
}

.option-card.selected .option-letter {
  background: var(--p-primary-color);
  color: white;
}

.tf-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.option-text {
  flex: 1;
  font-size: 1rem;
}

.correct-indicator,
.incorrect-indicator {
  font-size: 1.5rem;
  position: absolute;
  right: 1rem;
}

.correct-indicator {
  color: var(--p-green-500);
}

.incorrect-indicator {
  color: var(--p-red-500);
}

.fill-blank-input {
  margin-top: 1rem;
}

.answer-explanation {
  margin-top: 1.5rem;
}

.explanation-box {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid;
}

.explanation-box.correct {
  background: var(--p-green-50);
  border-color: var(--p-green-500);
}

.explanation-box.incorrect {
  background: var(--p-red-50);
  border-color: var(--p-red-500);
}

.explanation-box i {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.explanation-box.correct i {
  color: var(--p-green-500);
}

.explanation-box.incorrect i {
  color: var(--p-red-500);
}

.explanation-box strong {
  display: block;
  margin-bottom: 0.5rem;
}

.explanation-box p {
  margin: 0.5rem 0 0 0;
  line-height: 1.5;
}

.correct-answer-hint {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--surface-border);
}

.question-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.quiz-results {
  text-align: center;
  padding: 2rem 1rem;
}

.results-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.quiz-results h2 {
  margin: 0 0 2rem 0;
  font-size: 1.75rem;
  font-weight: 600;
}

.score-display {
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
}

.score-circle {
  position: relative;
  width: 150px;
  height: 150px;
}

.score-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.score-percentage {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.score-label {
  font-size: 1rem;
  color: var(--p-text-secondary-color);
}

.results-stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.result-stat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
}

.badge-unlocked {
  background: linear-gradient(135deg, var(--p-yellow-50) 0%, var(--p-orange-50) 100%);
  border: 2px solid var(--p-yellow-500);
  border-radius: 12px;
  padding: 1.5rem;
  margin: 2rem 0;
}

.badge-animation {
  animation: bounce 1s infinite;
}

.badge-icon {
  font-size: 4rem;
  margin-bottom: 0.5rem;
}

.badge-unlocked h3 {
  margin: 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.badge-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--p-primary-color);
  margin: 0.5rem 0;
}

.badge-description {
  color: var(--p-text-secondary-color);
  margin: 0;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.review-section {
  margin: 2rem 0;
  text-align: left;
}

.review-section h4 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.review-item {
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.review-item.correct {
  background: var(--p-green-50);
}

.review-item.incorrect {
  background: var(--p-red-50);
}

.review-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.review-number {
  font-weight: 600;
  min-width: 2rem;
}

.review-question {
  flex: 1;
}

.results-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .intro-stats {
    flex-direction: column;
    gap: 1rem;
  }

  .tf-options {
    flex-direction: column;
  }

  .results-stats {
    flex-direction: column;
    gap: 1rem;
  }

  .results-actions {
    flex-direction: column;
  }

  .results-actions button {
    width: 100%;
  }
}
</style>
