<template>
  <div class="fst-quiz-demo">
    <div class="demo-header">
      <h1>🎯 Система интерактивных квизов</h1>
      <p class="subtitle">
        Интерактивные мини-квизы с геймификацией для проверки знаний после изучения модулей
      </p>
    </div>

    <!-- Gamification Panel -->
    <GamificationPanel />

    <Divider />

    <!-- Features Overview -->
    <Card>
      <template #title>
        <h2>Возможности системы</h2>
      </template>
      <template #content>
        <div class="features-grid">
          <div class="feature-card">
            <i class="pi pi-question-circle feature-icon"></i>
            <h3>5 типов вопросов</h3>
            <p>Multiple choice, True/False, Fill in the blank, Drag & Drop, Scenario</p>
          </div>
          <div class="feature-card">
            <i class="pi pi-star feature-icon"></i>
            <h3>XP и уровни</h3>
            <p>Получайте 10 XP за правильный ответ, растите в уровнях</p>
          </div>
          <div class="feature-card">
            <i class="pi pi-trophy feature-icon"></i>
            <h3>Бейджи</h3>
            <p>Разблокируйте достижения за идеальные результаты и серии</p>
          </div>
          <div class="feature-card">
            <i class="pi pi-fire feature-icon"></i>
            <h3>Серии</h3>
            <p>Занимайтесь каждый день, чтобы поддерживать streak</p>
          </div>
          <div class="feature-card">
            <i class="pi pi-sparkles feature-icon"></i>
            <h3>AI-генерация</h3>
            <p>Создавайте новые вопросы с помощью искусственного интеллекта</p>
          </div>
          <div class="feature-card">
            <i class="pi pi-chart-line feature-icon"></i>
            <h3>Статистика</h3>
            <p>Отслеживайте свой прогресс и средние баллы</p>
          </div>
        </div>
      </template>
    </Card>

    <Divider />

    <!-- Available Quizzes -->
    <Card>
      <template #title>
        <h2>Доступные квизы</h2>
      </template>
      <template #content>
        <div class="quiz-list">
          <div
            v-for="module in availableQuizzes"
            :key="module.id"
            class="quiz-item"
          >
            <div class="quiz-info">
              <h3>{{ module.title }}</h3>
              <p>{{ module.questionCount }} вопросов</p>
              <div v-if="module.bestScore !== null" class="quiz-stats">
                <Tag
                  :value="`Лучший результат: ${module.bestScore}%`"
                  :severity="getScoreSeverity(module.bestScore)"
                />
                <span class="attempt-count">Попыток: {{ module.attempts }}</span>
              </div>
            </div>
            <div class="quiz-actions">
              <QuizButton
                :moduleId="module.id"
                :moduleTitle="module.title"
                :label="module.bestScore !== null ? 'Пройти заново' : 'Начать квиз'"
              />
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Divider />

    <!-- How to Integrate -->
    <Card>
      <template #title>
        <h2>Как добавить квиз на страницу модуля</h2>
      </template>
      <template #content>
        <TabView>
          <TabPanel header="Простой способ">
            <p>Используйте компонент <code>QuizButton</code>:</p>
            <pre><code>&lt;template&gt;
  &lt;div class="module-page"&gt;
    &lt;!-- Your module content --&gt;

    &lt;QuizButton
      moduleId="fst-committee"
      moduleTitle="AI-инвесткомитет"
      label="Пройти квиз"
    /&gt;
  &lt;/div&gt;
&lt;/template&gt;

&lt;script setup&gt;
import QuizButton from '@/components/QuizButton.vue'
&lt;/script&gt;</code></pre>
          </TabPanel>

          <TabPanel header="С композицией">
            <p>Используйте composable <code>useModuleQuiz</code> для больше контроля:</p>
            <pre><code>&lt;script setup&gt;
import { useModuleQuiz } from '@/composables/useModuleQuiz'
import QuizModal from '@/components/QuizModal.vue'

const {
  quizVisible,
  quizQuestions,
  openQuiz,
  handleQuizCompleted,
  handleGenerateAIQuestions
} = useModuleQuiz('fst-committee', 'AI-инвесткомитет')

function onQuizComplete(result) {
  console.log('Quiz result:', result)
  // Custom handling
}
&lt;/script&gt;

&lt;template&gt;
  &lt;Button @click="openQuiz"&gt;Пройти квиз&lt;/Button&gt;

  &lt;QuizModal
    v-model:visible="quizVisible"
    moduleId="fst-committee"
    :questions="quizQuestions"
    @quiz-completed="onQuizComplete"
    @generate-ai-questions="handleGenerateAIQuestions"
  /&gt;
&lt;/template&gt;</code></pre>
          </TabPanel>

          <TabPanel header="Создание вопросов">
            <p>Добавьте вопросы в <code>src/config/quizData.js</code>:</p>
            <pre><code>export const QUIZ_DATA = {
  'your-module-id': {
    title: 'Название модуля',
    questions: [
      {
        id: 'q1',
        question: 'Ваш вопрос?',
        type: 'multiple-choice',
        options: ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4'],
        correctAnswer: 0,
        explanation: 'Объяснение правильного ответа'
      },
      {
        id: 'q2',
        question: 'Утверждение для проверки',
        type: 'true-false',
        correctAnswer: true,
        explanation: 'Объяснение'
      },
      {
        id: 'q3',
        question: 'Пропуск: значение равно ___',
        type: 'fill-blank',
        correctAnswer: ['правильный ответ', 'альтернатива'],
        explanation: 'Объяснение'
      }
    ]
  }
}</code></pre>
          </TabPanel>
        </TabView>
      </template>
    </Card>

    <Divider />

    <!-- Example Quiz Section -->
    <Card>
      <template #title>
        <h2>Попробуйте демо-квиз</h2>
      </template>
      <template #content>
        <p>Проверьте, как работает система квизов:</p>
        <div class="demo-actions">
          <Button
            label="Демо: AI-инвесткомитет"
            icon="pi pi-play"
            @click="openDemoQuiz('fst-committee')"
            size="large"
          />
          <Button
            label="Демо: Структура сделки"
            icon="pi pi-play"
            @click="openDemoQuiz('fst-deal')"
            outlined
            size="large"
          />
          <Button
            label="Демо: Мониторинг портфеля"
            icon="pi pi-play"
            @click="openDemoQuiz('fst-portfolio')"
            outlined
            size="large"
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Tag from 'primevue/tag'
import GamificationPanel from '@/components/GamificationPanel.vue'
import QuizButton from '@/components/QuizButton.vue'
import { QUIZ_DATA, getAvailableQuizModules } from '@/config/quizData'
import { useGamificationStore } from '@/stores/gamificationStore'

const router = useRouter()
const gamificationStore = useGamificationStore()

// Computed
const availableQuizzes = computed(() => {
  const moduleIds = getAvailableQuizModules()
  return moduleIds.map(id => {
    const quiz = QUIZ_DATA[id]
    const history = gamificationStore.getModuleQuizHistory(id)
    const bestScore = gamificationStore.getBestModuleScore(id)

    return {
      id,
      title: quiz.title,
      questionCount: quiz.questions.length,
      bestScore,
      attempts: history.length
    }
  })
})

// Methods
function getScoreSeverity(score) {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'danger'
}

function openDemoQuiz(moduleId) {
  // Navigate to the actual module page where quiz is integrated
  const routeMap = {
    'fst-committee': '/fst-committee',
    'fst-deal': '/fst-deal',
    'fst-portfolio': '/fst-portfolio'
  }

  const route = routeMap[moduleId]
  if (route) {
    router.push(route)
  }
}
</script>

<style scoped>
.fst-quiz-demo {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.demo-header {
  text-align: center;
  margin-bottom: 2rem;
}

.demo-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  font-size: 1.1rem;
  color: var(--p-text-secondary-color);
  margin: 0;
  line-height: 1.6;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.feature-card {
  text-align: center;
  padding: 1.5rem;
  border: 2px solid var(--p-surface-border);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.feature-card:hover {
  border-color: var(--p-primary-color);
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.feature-icon {
  font-size: 2.5rem;
  color: var(--p-primary-color);
  margin-bottom: 1rem;
}

.feature-card h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.feature-card p {
  margin: 0;
  color: var(--p-text-secondary-color);
  font-size: 0.95rem;
  line-height: 1.5;
}

.quiz-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.quiz-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border: 2px solid var(--p-surface-border);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.quiz-item:hover {
  border-color: var(--p-primary-color);
  background: var(--p-surface-hover);
}

.quiz-info h3 {
  margin: 0 0 0.25rem 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.quiz-info p {
  margin: 0 0 0.5rem 0;
  color: var(--p-text-secondary-color);
  font-size: 0.9rem;
}

.quiz-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.attempt-count {
  font-size: 0.85rem;
  color: var(--p-text-secondary-color);
}

.quiz-actions {
  flex-shrink: 0;
}

pre {
  background: var(--p-surface-ground);
  padding: 1.5rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0;
}

code {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
}

.demo-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .fst-quiz-demo {
    padding: 1rem;
  }

  .demo-header h1 {
    font-size: 2rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .quiz-item {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .quiz-actions {
    width: 100%;
  }

  .demo-actions {
    flex-direction: column;
  }

  .demo-actions button {
    width: 100%;
  }
}
</style>
