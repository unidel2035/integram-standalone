<template>
  <div class="lesson6-2-container">
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
          <h1>🚀 {{ lessonData.title }}</h1>
          <p>{{ lessonData.subtitle }}</p>
          <small>Лектор: {{ lessonData.lecturer }}</small>
        </div>
      </div>
      <div class="lesson-progress">
        <Tag :value="`Урок 6.2 - Шаг ${currentStep}/${lessonData.totalSteps}`" severity="info" />
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
      <!-- Dynamic step rendering based on lessonData -->
      <div v-for="step in lessonData.steps" :key="step.id" v-show="currentStep === step.id" class="step-content">
        <Card class="step-card">
          <template #title>
            <h2><i :class="step.icon"></i> {{ step.title }}</h2>
          </template>
          <template #content>
            <!-- Generic content renderer -->
            <div v-html="renderStepContent(step.content)" class="step-html-content"></div>
          </template>
        </Card>

        <div class="step-actions">
          <Button
            v-if="currentStep > 1"
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="prevStep"
          />
          <Button
            v-if="currentStep < lessonData.totalSteps"
            label="Далее"
            icon="pi pi-arrow-right"
            @click="nextStep"
            class="next-btn"
          />
          <Button
            v-else
            label="Завершить урок"
            icon="pi pi-check-circle"
            @click="completeLesson"
            severity="success"
          />
        </div>
      </div>
    </div>

    <!-- Completion Message -->
    <Card v-if="lessonCompleted" class="completion-card">
      <template #title>
        <h2>🎓 Поздравляем!</h2>
      </template>
      <template #content>
        <p>Вы успешно завершили урок "{{ lessonData.title }}"!</p>
        <Message severity="success" :closable="false">
          Вы освоили основы прототипирования систем с помощью искусственного интеллекта!
        </Message>
        <div class="completion-actions">
          <Button
            label="Вернуться к урокам"
            icon="pi pi-list"
            @click="goToLessons"
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { logger } from '@/utils/logger'
import { ref, onErrorCaptured, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import lessonData from '@/data/tutorial/lesson6_2Data'

const router = useRouter()
const toast = useToast()

// State
const currentStep = ref(1)
const completedSteps = ref([])
const lessonCompleted = ref(false)

// Error boundary
onErrorCaptured((err, instance, info) => {
  console.error('[Lesson6_2Container] Captured error:', err, info)
  toast.add({
    severity: 'error',
    summary: 'Произошла ошибка',
    detail: 'Пожалуйста, обновите страницу или вернитесь назад',
    life: 5000
  })
  return false
})

// Validate lesson data on mount
onMounted(() => {
  try {
    if (!lessonData || !lessonData.steps || !Array.isArray(lessonData.steps)) {
      throw new Error('Invalid lessonData structure')
    }
    logger.info('[Lesson6_2Container] Lesson data validated successfully')
  } catch (err) {
    console.error('[Lesson6_2Container] Failed to validate lesson data:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка загрузки урока',
      detail: 'Не удалось загрузить данные урока',
      life: 5000
    })
  }
})

// Helper function to render step content
const renderStepContent = (content) => {
  try {
    // Simple HTML rendering for demo purposes
    // In production, you'd want a more sophisticated content renderer
    return JSON.stringify(content, null, 2)
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
  } catch (err) {
    console.error('[Lesson6_2Container] Error rendering content:', err)
    return '<p>Ошибка отображения содержимого</p>'
  }
}

// Navigation functions
const goToStep = (stepId) => {
  try {
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
  } catch (err) {
    console.error('[Lesson6_2Container] Error in goToStep:', err)
  }
}

const nextStep = () => {
  try {
    if (!completedSteps.value.includes(currentStep.value)) {
      completedSteps.value.push(currentStep.value)
    }

    if (currentStep.value < lessonData.totalSteps) {
      currentStep.value++
      window.scrollTo({ top: 0, behavior: 'smooth' })
      toast.add({
        severity: 'success',
        summary: 'Переход к следующему шагу',
        detail: `Вы перешли к шагу ${currentStep.value}`,
        life: 2000
      })
    }
  } catch (err) {
    console.error('[Lesson6_2Container] Error in nextStep:', err)
  }
}

const prevStep = () => {
  try {
    if (currentStep.value > 1) {
      currentStep.value--
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  } catch (err) {
    console.error('[Lesson6_2Container] Error in prevStep:', err)
  }
}

const goBack = () => {
  try {
    router.push('/agents/tutorial/lesson-6')
  } catch (err) {
    console.error('[Lesson6_2Container] Error in goBack:', err)
  }
}

const goToLessons = () => {
  try {
    router.push('/agents/workflow-builder')
  } catch (err) {
    console.error('[Lesson6_2Container] Error in goToLessons:', err)
  }
}

const completeLesson = () => {
  try {
    lessonCompleted.value = true
    toast.add({
      severity: 'success',
      summary: 'Поздравляем!',
      detail: 'Вы успешно завершили урок!',
      life: 5000
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (err) {
    console.error('[Lesson6_2Container] Error in completeLesson:', err)
  }
}
</script>

<style scoped lang="scss">
.lesson6-2-container {
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
          margin: 0.5rem 0 0.25rem 0;
          color: var(--text-color-secondary);
          font-size: 1.1rem;

          @media (max-width: 768px) {
            font-size: 0.95rem;
          }
        }

        small {
          color: var(--text-color-secondary);
          font-style: italic;
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

      .step-card {
        margin-bottom: 2rem;

        h2 {
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;

          i {
            font-size: 1.5rem;
          }
        }

        .step-html-content {
          font-family: monospace;
          background: var(--surface-ground);
          padding: 1.5rem;
          border-radius: 8px;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-word;
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

  .completion-card {
    margin-top: 2rem;
    border: 4px solid var(--green-500);

    .completion-actions {
      margin-top: 2rem;
      display: flex;
      justify-content: center;
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
