import { ref, computed } from 'vue'
import { getQuizForModule, hasQuiz } from '@/config/quizData'
import { generateQuizQuestions } from '@/services/quizGenerationService'
import { useGamificationStore } from '@/stores/gamificationStore'
import { useToast } from 'primevue/usetoast'

/**
 * Composable for adding quiz functionality to module pages
 * @param {string} moduleId - Module identifier (e.g., 'fst-committee')
 * @param {string} moduleTitle - Human-readable module title
 */
export function useModuleQuiz(moduleId, moduleTitle) {
  const toast = useToast()
  const gamificationStore = useGamificationStore()

  // State
  const quizVisible = ref(false)
  const quizQuestions = ref([])
  const isGeneratingQuiz = ref(false)

  // Computed
  const hasExistingQuiz = computed(() => hasQuiz(moduleId))

  const previousAttempts = computed(() => {
    return gamificationStore.getModuleQuizHistory(moduleId)
  })

  const bestScore = computed(() => {
    return gamificationStore.getBestModuleScore(moduleId)
  })

  const quizAttemptCount = computed(() => {
    return previousAttempts.value.length
  })

  // Methods
  function openQuiz() {
    const quiz = getQuizForModule(moduleId)
    if (quiz) {
      quizQuestions.value = quiz.questions
      quizVisible.value = true
    } else {
      toast.add({
        severity: 'warn',
        summary: 'Квиз недоступен',
        detail: 'Для этого модуля пока нет квиза. Попробуйте сгенерировать вопросы с помощью AI.',
        life: 5000
      })
    }
  }

  function closeQuiz() {
    quizVisible.value = false
  }

  function handleQuizCompleted(result) {
    console.log('Quiz completed:', result)

    // Show congratulations for high scores
    if (result.score >= 80) {
      toast.add({
        severity: 'success',
        summary: 'Отличная работа!',
        detail: `Вы набрали ${result.score}% и получили ${result.xpEarned} XP!`,
        life: 5000
      })
    } else if (result.score >= 60) {
      toast.add({
        severity: 'info',
        summary: 'Хороший результат',
        detail: `Продолжайте практиковаться! Получено ${result.xpEarned} XP.`,
        life: 4000
      })
    } else {
      toast.add({
        severity: 'warn',
        summary: 'Продолжайте учиться',
        detail: 'Рекомендуем повторить материал модуля и попробовать ещё раз.',
        life: 5000
      })
    }

    // Can emit event or call parent methods here if needed
  }

  async function generateAIQuiz(questionCount = 5) {
    isGeneratingQuiz.value = true
    try {
      const generated = await generateQuizQuestions(moduleId, moduleTitle, questionCount)

      if (generated && generated.length > 0) {
        quizQuestions.value = generated
        quizVisible.value = true

        toast.add({
          severity: 'success',
          summary: 'Квиз сгенерирован',
          detail: `AI создал ${generated.length} вопросов для проверки ваших знаний`,
          life: 4000
        })
      }
    } catch (error) {
      console.error('Error generating quiz:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка генерации',
        detail: error.message || 'Не удалось сгенерировать квиз. Попробуйте позже.',
        life: 5000
      })
    } finally {
      isGeneratingQuiz.value = false
    }
  }

  async function handleGenerateAIQuestions() {
    await generateAIQuiz(5)
  }

  return {
    // State
    quizVisible,
    quizQuestions,
    isGeneratingQuiz,

    // Computed
    hasExistingQuiz,
    previousAttempts,
    bestScore,
    quizAttemptCount,

    // Methods
    openQuiz,
    closeQuiz,
    handleQuizCompleted,
    generateAIQuiz,
    handleGenerateAIQuestions
  }
}
