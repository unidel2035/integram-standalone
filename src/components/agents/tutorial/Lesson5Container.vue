<template>
  <div class="lesson5-container">
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
          <h1>📚 Урок 5: Выпускной проект</h1>
          <p>Продвинутые Workflow и реальные кейсы</p>
        </div>
      </div>
      <div class="lesson-progress">
        <Tag value="Урок 5/5" severity="info" />
      </div>
    </div>

    <!-- Steps Navigation -->
    <div class="steps-navigation">
      <div class="steps-list">
        <div
          v-for="step in steps"
          :key="step.id"
          class="step-item"
          :class="{ 'active': currentStep === step.id, 'completed': step.id < currentStep }"
          @click="goToStep(step.id)"
        >
          <div class="step-number">{{ step.id }}</div>
          <div class="step-title">{{ step.title }}</div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="lesson-content">
      <!-- Step 1: Progress Summary -->
      <div v-show="currentStep === 1" class="step-content">
        <ProgressSummary
          :progress="progressData"
          title="Что мы уже умеем"
          summary-text="Ты научился создавать агентов, соединять их в workflow, настраивать параметры и следить за выполнением. Теперь время применить все эти знания для решения реальных задач!"
        />
        <div class="step-actions">
          <Button
            label="Далее: Реальные бизнес-кейсы"
            icon="pi pi-arrow-right"
            @click="nextStep"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 2: Business Cases -->
      <div v-show="currentStep === 2" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>Реальные бизнес-кейсы</h2>
          </template>
          <template #content>
            <p class="intro-text">
              Посмотри, как система AI-агентов решает настоящие бизнес-задачи.
              Эти примеры покажут тебе возможности системы и вдохновят на собственные проекты!
            </p>
          </template>
        </Card>

        <div class="business-cases-grid">
          <BusinessCaseCard
            v-for="businessCase in businessCases"
            :key="businessCase.id"
            :business-case="businessCase"
            @try-workflow="handleTryWorkflow"
            @study-settings="handleStudySettings"
          />
        </div>

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            label="Далее: Продвинутые техники"
            icon="pi pi-arrow-right"
            @click="nextStep"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 3: Advanced Techniques -->
      <div v-show="currentStep === 3" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>Продвинутые техники</h2>
          </template>
          <template #content>
            <p class="intro-text">
              Освой продвинутые возможности системы: условные переходы, параллельное выполнение
              и кэширование результатов. Эти техники помогут создавать более эффективные workflow!
            </p>
          </template>
        </Card>

        <AdvancedTechniquesDemo :techniques="advancedTechniques" />

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            label="Далее: Выпускной проект"
            icon="pi pi-arrow-right"
            @click="nextStep"
            class="next-btn"
          />
        </div>
      </div>

      <!-- Step 4: Graduation Project -->
      <div v-show="currentStep === 4" class="step-content">
        <Card class="intro-card">
          <template #title>
            <h2>🎓 Выпускной проект</h2>
          </template>
          <template #content>
            <Message severity="warn" :closable="false">
              <p>
                <strong>Это финальное задание курса!</strong><br>
                Создай workflow для автоматизации обработки резюме кандидатов.
                Используй все знания, полученные в предыдущих уроках.
              </p>
            </Message>
          </template>
        </Card>

        <GraduationProject
          :project="graduationProject"
          @complete="handleProjectComplete"
          @workflow-change="handleWorkflowChange"
        />

        <div class="step-actions">
          <Button
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
        </div>
      </div>

      <!-- Step 5: Certificate & Results -->
      <div v-show="currentStep === 5" class="step-content">
        <div v-if="!projectResult || projectResult.score == null" class="no-result-message">
          <Card>
            <template #content>
              <Message severity="warn" :closable="false">
                <p>
                  <strong>Сначала завершите выпускной проект!</strong><br>
                  Вернитесь к шагу 4 и завершите задание, чтобы получить сертификат.
                </p>
              </Message>
              <div class="step-actions">
                <Button
                  label="Вернуться к проекту"
                  icon="pi pi-arrow-left"
                  @click="currentStep = 4"
                  class="back-to-project-btn"
                />
              </div>
            </template>
          </Card>
        </div>
        <CertificateGenerator
          v-else
          :project-data="projectResult"
          :template="certificateTemplate"
          :unlocked-features="unlockedFeatures"
          :bonuses="bonuses"
          :next-steps="nextSteps"
          :user-name="userName"
        />
      </div>
    </div>

    <!-- Side Info Panel (Optional) -->
    <div v-if="showInfoPanel" class="info-panel">
      <Card>
        <template #title>
          <div class="info-header">
            <h3>💡 Совет</h3>
            <Button
              icon="pi pi-times"
              text
              rounded
              @click="showInfoPanel = false"
            />
          </div>
        </template>
        <template #content>
          <p>{{ currentTip }}</p>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { logger } from '@/utils/logger'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

import { useToast } from 'primevue/usetoast'

import ProgressSummary from './ProgressSummary.vue'
import BusinessCaseCard from './BusinessCaseCard.vue'
import AdvancedTechniquesDemo from './AdvancedTechniquesDemo.vue'
import GraduationProject from './GraduationProject.vue'
import CertificateGenerator from './CertificateGenerator.vue'

import {
  businessCases,
  advancedTechniques,
  graduationProject,
  progressData,
  certificateTemplate,
  unlockedFeatures,
  bonuses,
  nextSteps
} from '@/data/tutorial/lesson5Data'

const router = useRouter()
const toast = useToast()

const currentStep = ref(1)
const showInfoPanel = ref(true)
const projectResult = ref(null)
const userName = ref('Пользователь')

const steps = [
  { id: 1, title: 'Что мы умеем' },
  { id: 2, title: 'Бизнес-кейсы' },
  { id: 3, title: 'Продвинутые техники' },
  { id: 4, title: 'Выпускной проект' },
  { id: 5, title: 'Сертификат' }
]

const tips = {
  1: 'Ты уже прошёл 80% курса! Осталось совсем немного до завершения.',
  2: 'Изучи эти кейсы внимательно - они помогут в выпускном проекте.',
  3: 'Продвинутые техники - это то, что отличает профессионалов!',
  4: 'Не спеши! Внимательно прочитай требования и используй подсказки.',
  5: 'Поздравляем! Ты отлично справился с курсом!'
}

const currentTip = computed(() => tips[currentStep.value])

const goToStep = (stepId) => {
  // Only allow going to previous steps or current step
  if (stepId <= currentStep.value || projectResult.value) {
    currentStep.value = stepId
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
  if (currentStep.value < steps.length) {
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
  router.push('/agents/tutorial/lesson-4')
}

const handleTryWorkflow = (businessCase) => {
  toast.add({
    severity: 'info',
    summary: 'Открываю конструктор',
    detail: `Загружаю workflow: ${businessCase.title}`,
    life: 3000
  })
  // In real implementation, this would open the workflow builder with pre-configured workflow
  router.push('/agents/workflow-builder')
}

const handleStudySettings = (businessCase) => {
  toast.add({
    severity: 'info',
    summary: 'Изучение настроек',
    detail: `Показываю настройки workflow: ${businessCase.title}`,
    life: 3000
  })
}

const handleWorkflowChange = (workflow) => {
  // Handle workflow changes
  logger.debug('Workflow changed:', workflow)
}

const handleProjectComplete = (result) => {
  projectResult.value = result

  toast.add({
    severity: 'success',
    summary: 'Поздравляем!',
    detail: 'Выпускной проект завершён успешно!',
    life: 5000
  })

  // Move to certificate step
  currentStep.value = 5
  window.scrollTo({ top: 0, behavior: 'smooth' })

  // In real implementation, save progress to backend
  saveProgress()
}

const saveProgress = async () => {
  // Save progress to backend only if projectResult exists
  if (!projectResult.value) {
    logger.debug('No project result to save')
    return
  }

  // Additional safety check for score and grade properties
  if (!projectResult.value.score || !projectResult.value.grade) {
    logger.debug('Incomplete project result data', { projectResult: projectResult.value })
    return
  }

  logger.debug('Saving progress...', {
    lessonId: 5,
    completed: true,
    score: projectResult.value.score,
    grade: projectResult.value.grade
  })

  // In real implementation, make API call
  // await api.post('/tutorial/progress', { lessonId: 5, completed: true })
}

// Get user name from localStorage or store
// In real implementation, get from auth store
if (localStorage.getItem('user')) {
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    userName.value = user.name || user.username || 'Пользователь'
  } catch (e) {
    userName.value = 'Пользователь'
  }
}
</script>

<style scoped lang="scss">
.lesson5-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;

  @media (max-width: 768px) {
    padding: 1rem;
  }

  .lesson-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;

    .header-content {
      display: flex;
      align-items: center;
      gap: 1rem;

      .back-btn {
        font-size: 1.5rem;
      }

      .header-title {
        h1 {
          margin: 0;
          font-size: 2rem;
          font-weight: 700;

          @media (max-width: 768px) {
            font-size: 1.5rem;
          }
        }

        p {
          margin: 0.25rem 0 0 0;
          color: var(--text-color-secondary);
          font-size: 1.1rem;

          @media (max-width: 768px) {
            font-size: 0.95rem;
          }
        }
      }
    }

    .lesson-progress {
      font-size: 1.1rem;
    }
  }

  .steps-navigation {
    margin-bottom: 2rem;
    overflow-x: auto;

    .steps-list {
      display: flex;
      gap: 1rem;
      min-width: min-content;
      padding-bottom: 0.5rem;

      .step-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        background: var(--surface-card);
        border: 2px solid var(--surface-border);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 150px;

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

        .step-title {
          font-weight: 500;
          white-space: nowrap;
        }
      }
    }
  }

  .lesson-content {
    margin-bottom: 2rem;

    .step-content {
      animation: fadeIn 0.3s ease-in;
    }

    .intro-card {
      margin-bottom: 2rem;

      h2 {
        margin: 0;
        font-size: 1.75rem;
      }

      .intro-text {
        margin: 0;
        line-height: 1.6;
        font-size: 1.05rem;
      }
    }

    .business-cases-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
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

    .no-result-message {
      .step-actions {
        border-top: none;
        padding-top: 1rem;
        justify-content: center;
      }

      .back-to-project-btn {
        min-width: 200px;
      }
    }
  }

  .info-panel {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 300px;
    z-index: 100;
    animation: slideInRight 0.3s ease-out;

    @media (max-width: 768px) {
      width: calc(100% - 2rem);
      left: 1rem;
      right: 1rem;
      bottom: 1rem;
    }

    .info-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      h3 {
        margin: 0;
        font-size: 1.1rem;
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

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
