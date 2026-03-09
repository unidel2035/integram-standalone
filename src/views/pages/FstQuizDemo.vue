<template>
  <FstPageLayout title="🎯 Система интерактивных квизов" subtitle="Интерактивные мини-квизы с геймификацией для проверки знаний после изучения модулей">

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
        <Tabs value="0">
          <TabList>
            <Tab value="0">Простой способ</Tab>
            <Tab value="1">С композицией</Tab>
            <Tab value="2">Создание вопросов</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="0">
              <p>Используйте компонент <code>QuizButton</code>:</p>
              <pre class="code-block"><code v-html="highlightedCode.simple"></code></pre>
            </TabPanel>
            <TabPanel value="1">
              <p>Используйте composable <code>useModuleQuiz</code> для больше контроля:</p>
              <pre class="code-block"><code v-html="highlightedCode.composable"></code></pre>
            </TabPanel>
            <TabPanel value="2">
              <p>Добавьте вопросы в <code>src/config/quizData.js</code>:</p>
              <pre class="code-block"><code v-html="highlightedCode.quizData"></code></pre>
            </TabPanel>
          </TabPanels>
        </Tabs>
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
  </FstPageLayout>
</template>

<script setup>
import { computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Tag from 'primevue/tag'
import GamificationPanel from '@/components/GamificationPanel.vue'
import QuizButton from '@/components/QuizButton.vue'
import { QUIZ_DATA, getAvailableQuizModules } from '@/config/quizData'
import { useGamificationStore } from '@/stores/gamificationStore'
import { highlightCode } from '@/utils/lazyLoadPrismJS'

const router = useRouter()
const gamificationStore = useGamificationStore()

// Code snippets for syntax highlighting
const CODE_SIMPLE = `<template>
  <div class="module-page">
    <!-- Your module content -->

    <QuizButton
      moduleId="fst-committee"
      moduleTitle="AI-инвесткомитет"
      label="Пройти квиз"
    />
  </div>
</template>

<script setup>
import QuizButton from '@/components/QuizButton.vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
<\/script>`

const CODE_COMPOSABLE = `<script setup>
import { useModuleQuiz } from '@/composables/useModuleQuiz'
import QuizModal from '@/components/QuizModal.vue'
import { logger } from '@/utils/logger'

const {
  quizVisible,
  quizQuestions,
  openQuiz,
  handleQuizCompleted,
  handleGenerateAIQuestions
} = useModuleQuiz('fst-committee', 'AI-инвесткомитет')

function onQuizComplete(result) {
  logger.debug('Quiz result:', result)
  // Custom handling
}
<\/script>

<template>
  <Button @click="openQuiz">Пройти квиз</Button>

  <QuizModal
    v-model:visible="quizVisible"
    moduleId="fst-committee"
    :questions="quizQuestions"
    @quiz-completed="onQuizComplete"
    @generate-ai-questions="handleGenerateAIQuestions"
  />
</template>`

const CODE_QUIZ_DATA = `export const QUIZ_DATA = {
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
}`

// Highlighted code (reactive, populated on mount)
const highlightedCode = reactive({
  simple: '',
  composable: '',
  quizData: '',
})

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

onMounted(async () => {
  // Highlight all code blocks in parallel
  const [simple, composable, quizData] = await Promise.all([
    highlightCode(CODE_SIMPLE, 'markup').catch(() => escapeHtml(CODE_SIMPLE)),
    highlightCode(CODE_COMPOSABLE, 'markup').catch(() => escapeHtml(CODE_COMPOSABLE)),
    highlightCode(CODE_QUIZ_DATA, 'javascript').catch(() => escapeHtml(CODE_QUIZ_DATA)),
  ])
  highlightedCode.simple = simple
  highlightedCode.composable = composable
  highlightedCode.quizData = quizData
})

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
/* Light theme token colors (default) */
pre.code-block {
  --code-bg: var(--p-surface-100, #f8f9fa);
  --code-text: var(--p-text-color, #1e293b);
  --code-comment: #6a737d;
  --code-punctuation: #6e7781;
  --code-tag: #b5314a;
  --code-attr-name: #8a5700;
  --code-string: #0a6640;
  --code-keyword: #7c3aed;
  --code-function: #0550ae;
  --code-number: #8a5700;
  --code-operator: #0969da;
  --code-property: #b5314a;
  --code-class: #8a5700;
}

/* Dark theme token colors */
:root.app-dark pre.code-block {
  --code-bg: var(--p-surface-900, #1e1e2e);
  --code-text: var(--p-text-color, #e2e8f0);
  --code-comment: #6b7280;
  --code-punctuation: #9ca3af;
  --code-tag: #e06c75;
  --code-attr-name: #d19a66;
  --code-string: #98c379;
  --code-keyword: #c678dd;
  --code-function: #61afef;
  --code-number: #d19a66;
  --code-operator: #56b6c2;
  --code-property: #e06c75;
  --code-class: #e5c07b;
}

pre.code-block {
  background: var(--code-bg);
  padding: 1.5rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0;
  border: 1px solid var(--p-surface-200, var(--surface-border));
}

:root.app-dark pre.code-block {
  border-color: var(--p-surface-700, var(--surface-border));
}

pre.code-block code {
  font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--code-text);
}

/* Prism token styles — adaptive light/dark via CSS custom properties */
pre.code-block :deep(.token.comment),
pre.code-block :deep(.token.prolog),
pre.code-block :deep(.token.doctype),
pre.code-block :deep(.token.cdata) {
  color: var(--code-comment);
  font-style: italic;
}

pre.code-block :deep(.token.punctuation) {
  color: var(--code-punctuation);
}

pre.code-block :deep(.token.tag),
pre.code-block :deep(.token.tag .punctuation) {
  color: var(--code-tag);
}

pre.code-block :deep(.token.attr-name) {
  color: var(--code-attr-name);
}

pre.code-block :deep(.token.attr-value),
pre.code-block :deep(.token.attr-value .punctuation),
pre.code-block :deep(.token.string) {
  color: var(--code-string);
}

pre.code-block :deep(.token.keyword) {
  color: var(--code-keyword);
}

pre.code-block :deep(.token.function) {
  color: var(--code-function);
}

pre.code-block :deep(.token.number),
pre.code-block :deep(.token.boolean) {
  color: var(--code-number);
}

pre.code-block :deep(.token.operator) {
  color: var(--code-operator);
}

pre.code-block :deep(.token.property) {
  color: var(--code-property);
}

pre.code-block :deep(.token.class-name),
pre.code-block :deep(.token.builtin) {
  color: var(--code-class);
}

pre.code-block :deep(.token.script),
pre.code-block :deep(.token.language-javascript) {
  color: var(--code-text);
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
  border: 2px solid var(--surface-border);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.feature-card:hover {
  border-color: var(--p-primary-color);
  transform: translateY(-4px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--p-text-color) 10%, transparent);
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
  border: 2px solid var(--surface-border);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.quiz-item:hover {
  border-color: var(--p-primary-color);
  background: var(--surface-hover);
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

.demo-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

@media (max-width: 768px) {
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
