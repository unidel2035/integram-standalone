<template>
  <div class="lesson7-container">
    <!-- Header -->
    <div class="lesson-header">
      <div class="header-content">
        <Button
          icon="pi pi-arrow-left"
          text
          rounded
          @click="goBack"
          class="back-btn"
        />
        <div class="header-title">
          <h1>🤖 {{ lessonData.title }}</h1>
          <p>{{ lessonData.subtitle }}</p>
        </div>
      </div>
      <div class="lesson-progress">
        <Tag :value="`Урок 7 - Шаг ${currentStep}/${lessonData.totalSteps}`" severity="info" />
      </div>
    </div>

    <!-- Steps Navigation -->
    <div class="steps-navigation">
      <div class="steps-list">
        <div
          v-for="step in lessonData.steps"
          :key="step.id"
          class="step-item"
          :class="{ 'active': currentStep === step.id, 'completed': completedSteps.includes(step.id) }"
          @click="goToStep(step.id)"
        >
          <div class="step-number">{{ step.id }}</div>
          <div class="step-info">
            <i :class="step.icon"></i>
            <div class="step-title">{{ step.title }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="lesson-content">
      <!-- Step 1: Introduction -->
      <div v-show="currentStep === 1" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>{{ lessonData.steps[0].title }}</h2>
          </template>
          <template #content>
            <p class="story-text">{{ lessonData.steps[0].content.story }}</p>

            <div class="real-needs-section">
              <h3>{{ lessonData.steps[0].content.realNeeds.title }}</h3>
              <ul class="needs-list">
                <li v-for="request in lessonData.steps[0].content.realNeeds.requests" :key="request">
                  {{ request }}
                </li>
              </ul>
            </div>

            <Message severity="info" :closable="false">
              {{ lessonData.steps[0].content.focus }}
            </Message>
          </template>
        </Card>

        <div class="step-actions">
          <Button
            label="Далее: Инструменты ИИ"
            icon="pi pi-arrow-right"
            @click="nextStep"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 2: Available AI Tools -->
      <div v-show="currentStep === 2" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>{{ lessonData.steps[1].title }}</h2>
          </template>
          <template #content>
            <p>{{ lessonData.steps[1].content.intro }}</p>
          </template>
        </Card>

        <div class="tools-categories">
          <Card v-for="category in lessonData.steps[1].content.categories" :key="category.title" class="category-card">
            <template #title>
              <div class="category-header">
                <span class="category-emoji">{{ category.emoji }}</span>
                <h3>{{ category.title }}</h3>
              </div>
            </template>
            <template #content>
              <div class="tools-list">
                <div v-for="tool in category.tools" :key="tool.name" class="tool-item">
                  <div class="tool-header">
                    <i :class="tool.icon" class="tool-icon"></i>
                    <strong>{{ tool.name }}</strong>
                  </div>
                  <p class="tool-use"><strong>Применение:</strong> {{ tool.use }}</p>
                  <p class="tool-example"><strong>Пример:</strong> {{ tool.example }}</p>
                  <Tag :value="tool.availability" severity="success" />
                </div>
              </div>
            </template>
          </Card>
        </div>

        <Card class="practical-tip-card">
          <template #title>
            <h3>{{ lessonData.steps[1].content.practicalTip.title }}</h3>
          </template>
          <template #content>
            <ol>
              <li v-for="step in lessonData.steps[1].content.practicalTip.steps" :key="step">{{ step }}</li>
            </ol>
          </template>
        </Card>

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            label="Далее: Практика 1"
            icon="pi pi-arrow-right"
            @click="nextStep"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 3: Practice 1 - Bibliographic Descriptions -->
      <div v-show="currentStep === 3" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>{{ lessonData.steps[2].title }}</h2>
          </template>
          <template #content>
            <p>{{ lessonData.steps[2].content.explanation }}</p>
          </template>
        </Card>

        <Card class="task-card">
          <template #title>
            <h3>{{ lessonData.steps[2].content.task.title }}</h3>
          </template>
          <template #content>
            <p>{{ lessonData.steps[2].content.task.description }}</p>

            <div class="tools-section">
              <h4>Инструменты для использования:</h4>
              <div class="tool-links">
                <a v-for="tool in lessonData.steps[2].content.task.tools" :key="tool.name" :href="tool.url" target="_blank" class="tool-link">
                  <i :class="tool.icon"></i>
                  {{ tool.name }}
                </a>
              </div>
            </div>

            <div class="prompt-section">
              <h4>Промпт для ИИ:</h4>
              <pre class="prompt-code">{{ lessonData.steps[2].content.task.prompt }}</pre>
            </div>

            <div class="examples-section">
              <h4>Примеры:</h4>
              <div v-for="(example, index) in lessonData.steps[2].content.task.exampleBooks" :key="index" class="example-item">
                <p><strong>Вход:</strong> {{ example.input }}</p>
                <div class="expected-output">
                  <strong>Ожидаемый результат:</strong>
                  <pre>{{ example.expectedOutput }}</pre>
                </div>
              </div>
            </div>

            <div class="steps-section">
              <h4>Шаги выполнения:</h4>
              <ol>
                <li v-for="step in lessonData.steps[2].content.task.steps" :key="step">{{ step }}</li>
              </ol>
            </div>

            <div class="success-criteria">
              <h4>Критерии успеха:</h4>
              <ul>
                <li v-for="criteria in lessonData.steps[2].content.successCriteria" :key="criteria">
                  <i class="pi pi-check"></i> {{ criteria }}
                </li>
              </ul>
            </div>

            <Button
              label="Понятно, попробовал(а)!"
              icon="pi pi-check"
              @click="markTaskComplete(1)"
              :disabled="taskCompleted[1]"
              class="complete-btn"
            />
          </template>
        </Card>

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            label="Далее: Практика 2"
            icon="pi pi-arrow-right"
            @click="nextStep"
            :disabled="!taskCompleted[1]"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 4: Practice 2 - OCR and Digitization -->
      <div v-show="currentStep === 4" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>{{ lessonData.steps[3].title }}</h2>
          </template>
          <template #content>
            <p>{{ lessonData.steps[3].content.explanation }}</p>
          </template>
        </Card>

        <Card class="task-card">
          <template #title>
            <h3>{{ lessonData.steps[3].content.task.title }}</h3>
          </template>
          <template #content>
            <p>{{ lessonData.steps[3].content.task.description }}</p>

            <div class="tools-grid">
              <div v-for="tool in lessonData.steps[3].content.task.tools" :key="tool.name" class="tool-card-item">
                <h4>{{ tool.name }}</h4>
                <p>{{ tool.description }}</p>
                <ul>
                  <li v-for="feature in tool.features" :key="feature">{{ feature }}</li>
                </ul>
                <a :href="tool.url" target="_blank" class="tool-link-btn">
                  <Button label="Перейти к инструменту" icon="pi pi-external-link" outlined size="small" />
                </a>
              </div>
            </div>

            <div class="challenge-images">
              <h4>Типы документов и сложность:</h4>
              <div v-for="challenge in lessonData.steps[3].content.task.challengeImages" :key="challenge.type" class="challenge-item">
                <h5>{{ challenge.type }}</h5>
                <Tag :value="challenge.difficulty" :severity="challenge.difficulty === 'Низкая' ? 'success' : challenge.difficulty === 'Высокая' ? 'warning' : 'danger'" />
                <ul>
                  <li v-for="issue in challenge.issues" :key="issue">{{ issue }}</li>
                </ul>
                <p class="tip"><strong>💡 Совет:</strong> {{ challenge.tip }}</p>
              </div>
            </div>

            <div class="steps-section">
              <h4>Шаги выполнения:</h4>
              <ol>
                <li v-for="step in lessonData.steps[3].content.task.steps" :key="step">{{ step }}</li>
              </ol>
            </div>

            <Card class="case-study-card">
              <template #title>
                <h4>{{ lessonData.steps[3].content.task.practicalExample.title }}</h4>
              </template>
              <template #content>
                <p><strong>Проблема:</strong> {{ lessonData.steps[3].content.task.practicalExample.problem }}</p>
                <p><strong>Решение:</strong> {{ lessonData.steps[3].content.task.practicalExample.solution }}</p>
                <p><strong>Результат:</strong> {{ lessonData.steps[3].content.task.practicalExample.result }}</p>
                <div class="metrics">
                  <Tag :value="`Экономия времени: ${lessonData.steps[3].content.task.practicalExample.metrics.timeSaved}`" severity="success" />
                  <Tag :value="`Точность: ${lessonData.steps[3].content.task.practicalExample.metrics.accuracy}`" />
                  <Tag :value="`Стоимость: ${lessonData.steps[3].content.task.practicalExample.metrics.cost}`" severity="info" />
                </div>
              </template>
            </Card>

            <div class="tips-section">
              <h4>💡 Советы:</h4>
              <ul>
                <li v-for="tip in lessonData.steps[3].content.tips" :key="tip">{{ tip }}</li>
              </ul>
            </div>

            <Button
              label="Понятно, попробовал(а)!"
              icon="pi pi-check"
              @click="markTaskComplete(2)"
              :disabled="taskCompleted[2]"
              class="complete-btn"
            />
          </template>
        </Card>

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            label="Далее: Практика 3"
            icon="pi pi-arrow-right"
            @click="nextStep"
            :disabled="!taskCompleted[2]"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 5: Practice 3 - Reader Request Analysis -->
      <div v-show="currentStep === 5" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>{{ lessonData.steps[4].title }}</h2>
          </template>
          <template #content>
            <p>{{ lessonData.steps[4].content.explanation }}</p>
          </template>
        </Card>

        <Card class="task-card">
          <template #title>
            <h3>{{ lessonData.steps[4].content.task.title }}</h3>
          </template>
          <template #content>
            <p>{{ lessonData.steps[4].content.task.description }}</p>

            <div class="sample-requests">
              <h4>Примеры запросов читателей:</h4>
              <div v-for="request in lessonData.steps[4].content.task.sampleRequests" :key="request.id" class="request-item">
                <p class="request-text">{{ request.text }}</p>
                <Tag :value="request.source" severity="info" />
              </div>
            </div>

            <div class="prompt-section">
              <h4>Промпт для анализа:</h4>
              <pre class="prompt-code">{{ lessonData.steps[4].content.task.aiPrompt }}</pre>
            </div>

            <div class="tools-comparison">
              <h4>Сравнение инструментов:</h4>
              <div class="tools-comparison-grid">
                <div v-for="tool in lessonData.steps[4].content.task.tools" :key="tool.name" class="tool-comparison-item">
                  <i :class="tool.icon"></i>
                  <strong>{{ tool.name }}</strong>
                  <p>{{ tool.best }}</p>
                </div>
              </div>
            </div>

            <Card class="example-analysis-card">
              <template #title>
                <h4>Пример анализа</h4>
              </template>
              <template #content>
                <p><strong>Запрос:</strong> {{ lessonData.steps[4].content.task.exampleAnalysis.request }}</p>
                <div class="ai-response">
                  <pre>{{ lessonData.steps[4].content.task.exampleAnalysis.aiResponse }}</pre>
                </div>
              </template>
            </Card>

            <Card class="mass-analysis-card">
              <template #title>
                <h4>{{ lessonData.steps[4].content.task.massAnalysis.title }}</h4>
              </template>
              <template #content>
                <p><strong>Сценарий:</strong> {{ lessonData.steps[4].content.task.massAnalysis.scenario }}</p>
                <p><strong>Решение:</strong> {{ lessonData.steps[4].content.task.massAnalysis.solution }}</p>
                <div class="result-metrics">
                  <Tag :value="`Время: ${lessonData.steps[4].content.task.massAnalysis.result.time}`" severity="success" />
                </div>
                <h5>Полученные инсайты:</h5>
                <ul>
                  <li v-for="insight in lessonData.steps[4].content.task.massAnalysis.result.insights" :key="insight">
                    {{ insight }}
                  </li>
                </ul>
              </template>
            </Card>

            <div class="real-world-benefits">
              <h4>{{ lessonData.steps[4].content.realWorldBenefit.title }}</h4>
              <div v-for="case_ in lessonData.steps[4].content.realWorldBenefit.cases" :key="case_.librarian" class="benefit-case">
                <p><strong>{{ case_.librarian }}</strong></p>
                <p><strong>Потребность:</strong> {{ case_.need }}</p>
                <p><strong>Решение:</strong> {{ case_.solution }}</p>
                <Tag :value="case_.result" severity="success" />
              </div>
            </div>

            <Button
              label="Понятно, попробовал(а)!"
              icon="pi pi-check"
              @click="markTaskComplete(3)"
              :disabled="taskCompleted[3]"
              class="complete-btn"
            />
          </template>
        </Card>

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            label="Далее: План действий"
            icon="pi pi-arrow-right"
            @click="nextStep"
            :disabled="!taskCompleted[3]"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 6: Action Plan -->
      <div v-show="currentStep === 6" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>{{ lessonData.steps[5].title }}</h2>
          </template>
        </Card>

        <Card class="summary-card">
          <template #title>
            <h3>{{ lessonData.steps[5].content.summary.title }}</h3>
          </template>
          <template #content>
            <ul>
              <li v-for="point in lessonData.steps[5].content.summary.points" :key="point">
                <i class="pi pi-check-circle"></i> {{ point }}
              </li>
            </ul>
          </template>
        </Card>

        <div class="action-plans">
          <Card class="action-plan-card">
            <template #title>
              <h3>{{ lessonData.steps[5].content.actionPlan.title }}</h3>
            </template>
            <template #content>
              <div v-for="action in lessonData.steps[5].content.actionPlan.week1" :key="action.day" class="action-item">
                <h4>{{ action.day }}: {{ action.task }}</h4>
                <p><strong>Действие:</strong> {{ action.action }}</p>
                <div class="action-meta">
                  <Tag :value="`Время: ${action.time}`" />
                  <Tag :value="`Сложность: ${action.difficulty}`" :severity="action.difficulty === 'Легко' ? 'success' : 'info'" />
                </div>
              </div>
            </template>
          </Card>

          <Card class="month-plan-card">
            <template #title>
              <h3>План на месяц</h3>
            </template>
            <template #content>
              <div v-for="goal in lessonData.steps[5].content.actionPlan.month1" :key="goal.goal" class="month-goal">
                <h4>{{ goal.goal }}</h4>
                <ul>
                  <li v-for="action in goal.actions" :key="action">{{ action }}</li>
                </ul>
              </div>
            </template>
          </Card>
        </div>

        <Card class="toolkit-card">
          <template #title>
            <h3>{{ lessonData.steps[5].content.toolkitForYou.title }}</h3>
          </template>
          <template #content>
            <h4>Обязательные инструменты:</h4>
            <div v-for="tool in lessonData.steps[5].content.toolkitForYou.essential" :key="tool.tool" class="essential-tool">
              <div class="tool-header-row">
                <strong>{{ tool.tool }}</strong>
                <Tag :value="tool.priority" :severity="tool.priority === 'ОБЯЗАТЕЛЬНО' ? 'danger' : tool.priority === 'ОЧЕНЬ ВАЖНО' ? 'warning' : 'info'" />
              </div>
              <p><strong>Применение:</strong> {{ tool.use }}</p>
              <p><strong>Стоимость:</strong> {{ tool.cost }}</p>
              <a :href="tool.url" target="_blank" class="tool-url">{{ tool.url }}</a>
            </div>

            <h4 style="margin-top: 2rem;">Дополнительные инструменты:</h4>
            <div v-for="tool in lessonData.steps[5].content.toolkitForYou.advanced" :key="tool.tool" class="advanced-tool">
              <strong>{{ tool.tool }}</strong>
              <p><strong>Применение:</strong> {{ tool.use }}</p>
              <p><strong>Установка:</strong> {{ tool.setup }}</p>
              <a :href="tool.url" target="_blank" class="tool-url">{{ tool.url }}</a>
            </div>
          </template>
        </Card>

        <Card class="metrics-card">
          <template #title>
            <h3>{{ lessonData.steps[5].content.measureSuccess.title }}</h3>
          </template>
          <template #content>
            <div v-for="metric in lessonData.steps[5].content.measureSuccess.metrics" :key="metric.metric" class="metric-item">
              <h4>{{ metric.metric }}</h4>
              <p><strong>Как измерить:</strong> {{ metric.how }}</p>
              <Tag :value="metric.target" severity="success" />
            </div>
          </template>
        </Card>

        <Card class="community-card">
          <template #title>
            <h3>{{ lessonData.steps[5].content.community.title }}</h3>
          </template>
          <template #content>
            <div v-for="resource in lessonData.steps[5].content.community.resources" :key="resource.name" class="resource-item">
              <strong>{{ resource.name }}</strong>
              <p>{{ resource.description }}</p>
              <Tag :value="resource.type" />
            </div>
          </template>
        </Card>

        <Card class="inspiration-card">
          <template #title>
            <h3>{{ lessonData.steps[5].content.realWorldInspirations.title }}</h3>
          </template>
          <template #content>
            <div v-for="case_ in lessonData.steps[5].content.realWorldInspirations.cases" :key="case_.library" class="inspiration-case">
              <h4>{{ case_.library }}</h4>
              <p><strong>Что сделали:</strong> {{ case_.what }}</p>
              <p><strong>Результат:</strong> {{ case_.result }}</p>
              <blockquote>{{ case_.quote }}</blockquote>
            </div>
          </template>
        </Card>

        <Message severity="success" :closable="false" class="final-motivation">
          <h3>{{ lessonData.steps[5].content.finalMotivation.title }}</h3>
          <p>{{ lessonData.steps[5].content.finalMotivation.message }}</p>
          <p class="cta"><strong>{{ lessonData.steps[5].content.finalMotivation.cta }}</strong></p>
        </Message>

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            label="Завершить урок"
            icon="pi pi-check-circle"
            @click="completeLesson"
            severity="success"
            class="next-btn"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import { lesson7Data } from '@/data/tutorial/lesson7Data'

const router = useRouter()
const toast = useToast()

const lessonData = lesson7Data
const currentStep = ref(1)
const completedSteps = ref([])
const taskCompleted = ref({
  1: false,
  2: false,
  3: false
})

const goToStep = (stepId) => {
  if (stepId <= currentStep.value || completedSteps.value.includes(stepId)) {
    currentStep.value = stepId
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    toast.add({
      severity: 'warn',
      summary: 'Внимание',
      detail: 'Сначала завершите текущий шаг',
      life: 3000
    })
  }
}

const nextStep = () => {
  if (!completedSteps.value.includes(currentStep.value)) {
    completedSteps.value.push(currentStep.value)
  }
  if (currentStep.value < lessonData.totalSteps) {
    currentStep.value++
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const goBack = () => {
  router.push('/agents/tutorial/lesson-6')
}

const markTaskComplete = (taskNumber) => {
  taskCompleted.value[taskNumber] = true
  toast.add({
    severity: 'success',
    summary: 'Отлично!',
    detail: 'Задание отмечено как выполненное',
    life: 3000
  })
}

const completeLesson = () => {
  localStorage.setItem('tutorial_lesson7_completed', 'true')
  toast.add({
    severity: 'success',
    summary: 'Поздравляем!',
    detail: 'Вы успешно завершили урок 7!',
    life: 5000
  })
  router.push('/agents/tutorial/lesson-8')
}
</script>

<style scoped lang="scss">
.lesson7-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;

  @media (max-width: 768px) {
    padding: 1rem;
  }

  .lesson-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;

    .header-content {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      flex: 1;

      .back-btn {
        font-size: 1.5rem;
        margin-top: 0.5rem;
      }

      .header-title {
        h1 {
          margin: 0;
          font-size: 2rem;
          font-weight: 700;
          line-height: 1.2;

          @media (max-width: 768px) {
            font-size: 1.5rem;
          }
        }

        p {
          margin: 0.5rem 0 0 0;
          color: var(--text-color-secondary);
          font-size: 1.1rem;

          @media (max-width: 768px) {
            font-size: 0.95rem;
          }
        }
      }
    }

    .lesson-progress {
      font-size: 1rem;
    }
  }

  .steps-navigation {
    margin-bottom: 2rem;
    overflow-x: auto;

    .steps-list {
      display: flex;
      gap: 0.75rem;
      min-width: min-content;
      padding-bottom: 0.5rem;

      .step-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem;
        background: var(--surface-card);
        border: 2px solid var(--surface-border);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 100px;

        &:hover {
          border-color: var(--primary-color);
          transform: translateY(-2px);
        }

        &.active {
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);

          .step-number {
            background: white;
            color: var(--primary-color);
          }
        }

        &.completed {
          border-color: var(--green-500);

          .step-number {
            background: var(--green-500);
            color: white;
          }
        }

        .step-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: var(--surface-ground);
          border-radius: 50%;
          font-weight: 600;
          flex-shrink: 0;
        }

        .step-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;

          i {
            font-size: 1.2rem;
          }

          .step-title {
            font-weight: 500;
            font-size: 0.875rem;
            text-align: center;
            white-space: nowrap;
          }
        }
      }
    }
  }

  .lesson-content {
    .step-content {
      animation: fadeIn 0.3s ease-in;
    }

    .intro-card {
      margin-bottom: 2rem;

      h2 {
        margin: 0;
        font-size: 1.75rem;
      }

      .story-text {
        font-size: 1.1rem;
        line-height: 1.8;
        margin-bottom: 1.5rem;
      }
    }

    .real-needs-section {
      margin: 2rem 0;

      h3 {
        margin-bottom: 1rem;
      }

      .needs-list {
        list-style: none;
        padding-left: 0;

        li {
          padding: 0.75rem;
          margin: 0.5rem 0;
          background: var(--surface-ground);
          border-left: 4px solid var(--primary-color);
          border-radius: 4px;

          &:before {
            content: '✓ ';
            color: var(--primary-color);
            font-weight: 700;
            margin-right: 0.5rem;
          }
        }
      }
    }

    .tools-categories {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      margin-bottom: 2rem;

      .category-card {
        .category-header {
          display: flex;
          align-items: center;
          gap: 1rem;

          .category-emoji {
            font-size: 2.5rem;
          }

          h3 {
            margin: 0;
          }
        }

        .tools-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
          margin-top: 1rem;

          .tool-item {
            padding: 1.5rem;
            background: var(--surface-ground);
            border-radius: 8px;
            border: 1px solid var(--surface-border);

            .tool-header {
              display: flex;
              align-items: center;
              gap: 0.75rem;
              margin-bottom: 1rem;

              .tool-icon {
                font-size: 1.5rem;
                color: var(--primary-color);
              }
            }

            .tool-use,
            .tool-example {
              margin: 0.5rem 0;
              font-size: 0.95rem;
            }
          }
        }
      }
    }

    .practical-tip-card {
      margin-bottom: 2rem;

      ol {
        padding-left: 1.5rem;

        li {
          margin: 0.75rem 0;
          line-height: 1.5;
        }
      }
    }

    .task-card {
      margin-bottom: 2rem;

      .tools-section {
        margin: 1.5rem 0;

        .tool-links {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-top: 1rem;

          .tool-link {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: var(--primary-color);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            transition: all 0.2s;

            &:hover {
              background: var(--primary-600);
              transform: translateY(-2px);
            }
          }
        }
      }

      .prompt-section {
        margin: 1.5rem 0;

        .prompt-code {
          background: var(--surface-ground);
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid var(--surface-border);
          overflow-x: auto;
          font-family: monospace;
          line-height: 1.6;
        }
      }

      .examples-section {
        margin: 1.5rem 0;

        .example-item {
          margin: 1.5rem 0;
          padding: 1.5rem;
          background: var(--surface-ground);
          border-radius: 8px;

          .expected-output {
            margin-top: 1rem;

            pre {
              background: var(--surface-card);
              padding: 1rem;
              border-radius: 4px;
              overflow-x: auto;
              font-family: monospace;
              line-height: 1.6;
            }
          }
        }
      }

      .steps-section {
        margin: 1.5rem 0;

        ol {
          padding-left: 1.5rem;

          li {
            margin: 0.75rem 0;
            line-height: 1.5;
          }
        }
      }

      .success-criteria {
        margin: 1.5rem 0;
        padding: 1.5rem;
        background: var(--green-50);
        border-radius: 8px;

        ul {
          list-style: none;
          padding-left: 0;

          li {
            margin: 0.75rem 0;

            i {
              color: var(--green-500);
              margin-right: 0.5rem;
            }
          }
        }
      }

      .complete-btn {
        margin-top: 1.5rem;
      }
    }

    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin: 1.5rem 0;

      .tool-card-item {
        padding: 1.5rem;
        background: var(--surface-ground);
        border-radius: 8px;
        border: 1px solid var(--surface-border);

        h4 {
          margin-top: 0;
          color: var(--primary-color);
        }

        ul {
          padding-left: 1.5rem;

          li {
            margin: 0.5rem 0;
          }
        }

        .tool-link-btn {
          margin-top: 1rem;
          display: inline-block;
        }
      }
    }

    .challenge-images {
      margin: 1.5rem 0;

      .challenge-item {
        padding: 1.5rem;
        margin: 1rem 0;
        background: var(--surface-ground);
        border-radius: 8px;

        h5 {
          margin-top: 0;
        }

        ul {
          padding-left: 1.5rem;

          li {
            margin: 0.5rem 0;
          }
        }

        .tip {
          margin-top: 1rem;
          padding: 1rem;
          background: var(--yellow-50);
          border-radius: 4px;
          border-left: 4px solid var(--yellow-500);
        }
      }
    }

    .case-study-card {
      margin: 1.5rem 0;

      .metrics {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 1rem;
      }
    }

    .tips-section {
      margin: 1.5rem 0;
      padding: 1.5rem;
      background: var(--blue-50);
      border-radius: 8px;

      ul {
        padding-left: 1.5rem;

        li {
          margin: 0.75rem 0;
          line-height: 1.5;
        }
      }
    }

    .sample-requests {
      margin: 1.5rem 0;

      .request-item {
        padding: 1.5rem;
        margin: 1rem 0;
        background: var(--surface-ground);
        border-radius: 8px;
        border-left: 4px solid var(--primary-color);

        .request-text {
          font-size: 1.05rem;
          margin-bottom: 0.75rem;
        }
      }
    }

    .tools-comparison {
      margin: 1.5rem 0;

      .tools-comparison-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
        margin-top: 1rem;

        .tool-comparison-item {
          padding: 1.5rem;
          background: var(--surface-ground);
          border-radius: 8px;
          text-align: center;

          i {
            font-size: 2rem;
            color: var(--primary-color);
            display: block;
            margin-bottom: 0.75rem;
          }

          strong {
            display: block;
            margin-bottom: 0.5rem;
          }
        }
      }
    }

    .example-analysis-card,
    .mass-analysis-card {
      margin: 1.5rem 0;

      .ai-response {
        margin-top: 1rem;

        pre {
          background: var(--surface-ground);
          padding: 1.5rem;
          border-radius: 8px;
          overflow-x: auto;
          white-space: pre-wrap;
          line-height: 1.6;
        }
      }

      .result-metrics {
        margin: 1rem 0;
      }
    }

    .real-world-benefits {
      margin: 1.5rem 0;

      .benefit-case {
        padding: 1.5rem;
        margin: 1rem 0;
        background: var(--surface-ground);
        border-radius: 8px;
        border-left: 4px solid var(--green-500);

        p {
          margin: 0.5rem 0;
        }
      }
    }

    .summary-card {
      margin-bottom: 2rem;

      ul {
        list-style: none;
        padding-left: 0;

        li {
          padding: 0.75rem;
          margin: 0.5rem 0;
          background: var(--surface-ground);
          border-radius: 4px;

          i {
            color: var(--green-500);
            margin-right: 0.5rem;
          }
        }
      }
    }

    .action-plans {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;

      .action-item {
        padding: 1.5rem;
        margin: 1rem 0;
        background: var(--surface-ground);
        border-radius: 8px;

        h4 {
          margin-top: 0;
          color: var(--primary-color);
        }

        .action-meta {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }
      }

      .month-goal {
        padding: 1.5rem;
        margin: 1rem 0;
        background: var(--surface-ground);
        border-radius: 8px;

        h4 {
          margin-top: 0;
        }

        ul {
          padding-left: 1.5rem;

          li {
            margin: 0.5rem 0;
          }
        }
      }
    }

    .toolkit-card {
      margin-bottom: 2rem;

      .essential-tool,
      .advanced-tool {
        padding: 1.5rem;
        margin: 1rem 0;
        background: var(--surface-ground);
        border-radius: 8px;
        border: 1px solid var(--surface-border);

        .tool-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        p {
          margin: 0.5rem 0;
        }

        .tool-url {
          display: block;
          margin-top: 0.75rem;
          color: var(--primary-color);
          word-break: break-all;
        }
      }
    }

    .metrics-card {
      margin-bottom: 2rem;

      .metric-item {
        padding: 1.5rem;
        margin: 1rem 0;
        background: var(--surface-ground);
        border-radius: 8px;

        h4 {
          margin-top: 0;
        }

        p {
          margin: 0.5rem 0;
        }
      }
    }

    .community-card {
      margin-bottom: 2rem;

      .resource-item {
        padding: 1.5rem;
        margin: 1rem 0;
        background: var(--surface-ground);
        border-radius: 8px;

        strong {
          display: block;
          margin-bottom: 0.5rem;
        }

        p {
          margin: 0.5rem 0;
        }
      }
    }

    .inspiration-card {
      margin-bottom: 2rem;

      .inspiration-case {
        padding: 1.5rem;
        margin: 1rem 0;
        background: var(--surface-ground);
        border-radius: 8px;
        border-left: 4px solid var(--green-500);

        h4 {
          margin-top: 0;
        }

        p {
          margin: 0.5rem 0;
        }

        blockquote {
          margin: 1rem 0;
          padding: 1rem;
          background: var(--surface-card);
          border-left: 4px solid var(--primary-color);
          font-style: italic;
        }
      }
    }

    .final-motivation {
      margin: 2rem 0;
      font-size: 1.05rem;
      line-height: 1.6;

      h3 {
        margin-top: 0;
      }

      .cta {
        margin-top: 1rem;
        padding: 1rem;
        background: var(--yellow-50);
        border-radius: 4px;
        text-align: center;
      }
    }

    .step-actions {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid var(--surface-border);

      .next-btn {
        margin-left: auto;
      }

      @media (max-width: 768px) {
        flex-direction: column;

        .next-btn {
          margin-left: 0;
        }

        button {
          width: 100%;
        }
      }
    }
  }
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
</style>
