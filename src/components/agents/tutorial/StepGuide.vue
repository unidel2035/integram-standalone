<template>
  <div v-if="currentStep" class="step-guide">
    <!-- Progress bar -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
    </div>

    <!-- Step indicator -->
    <div class="step-indicator">
      Шаг {{ stepIndex + 1 }} из {{ totalSteps }}
    </div>

    <!-- Guide card -->
    <Card class="guide-card" :class="{ 'pulse': isPulsing }">
      <template #header>
        <div class="guide-header">
          <i :class="getStepIcon()" class="step-icon"></i>
          <h3>{{ currentStep.title }}</h3>
        </div>
      </template>

      <template #content>
        <div class="guide-content">
          <p class="description">{{ currentStep.description }}</p>

          <!-- Analogy section (for step 1) -->
          <div v-if="currentStep.analogy" class="analogy-box">
            <i class="pi pi-lightbulb"></i>
            <p>{{ currentStep.analogy }}</p>
          </div>

          <!-- Substep progress -->
          <div v-if="currentStep.substeps && currentSubstepIndex !== null" class="substep-progress">
            <div class="substep-indicator">
              Подшаг {{ currentSubstepIndex + 1 }} из {{ currentStep.substeps.length }}
            </div>
            <p class="substep-description">
              <i class="pi pi-arrow-right"></i>
              {{ currentStep.substeps[currentSubstepIndex].description }}
            </p>
          </div>

          <!-- Achievements (for final step) -->
          <div v-if="currentStep.achievements" class="achievements-list">
            <h4>Твои достижения:</h4>
            <ul>
              <li v-for="achievement in currentStep.achievements" :key="achievement">
                <i class="pi pi-check-circle"></i>
                {{ achievement }}
              </li>
            </ul>
          </div>

          <!-- Badge display (for final step) -->
          <div v-if="currentStep.badge" class="badge-display">
            <div class="badge-icon">
              <i :class="'pi ' + currentStep.badge.icon"></i>
            </div>
            <div class="badge-info">
              <div class="badge-name">{{ currentStep.badge.name }}</div>
              <div class="badge-level">Уровень {{ currentStep.badge.level }}</div>
            </div>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="guide-actions">
          <Button
            v-if="stepIndex > 0 && !isExecuting"
            label="Назад"
            icon="pi pi-arrow-left"
            outlined
            @click="$emit('prev-step')"
            class="mr-2"
          />
          <Button
            v-if="canProceed && !isLastStep"
            label="Далее"
            icon="pi pi-arrow-right"
            iconPos="right"
            @click="$emit('next-step')"
          />
          <Button
            v-if="isLastStep && canProceed"
            label="Завершить урок"
            icon="pi pi-check"
            severity="success"
            @click="$emit('complete-lesson')"
          />
          <Button
            v-if="currentStep.action === 'execute' && !isExecuting && !executionComplete"
            label="Запустить Workflow"
            icon="pi pi-play"
            severity="success"
            @click="$emit('execute-workflow')"
            class="pulse-button"
          />
        </div>
      </template>
    </Card>

    <!-- Success message toast -->
    <div v-if="showSuccessMessage" class="success-toast" :class="{ 'show': showSuccessMessage }">
      <i class="pi pi-check-circle"></i>
      <span>{{ successMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, watch, ref } from 'vue'

const props = defineProps({
  currentStep: {
    type: Object,
    required: true
  },
  stepIndex: {
    type: Number,
    required: true
  },
  totalSteps: {
    type: Number,
    required: true
  },
  currentSubstepIndex: {
    type: Number,
    default: null
  },
  canProceed: {
    type: Boolean,
    default: true
  },
  isExecuting: {
    type: Boolean,
    default: false
  },
  executionComplete: {
    type: Boolean,
    default: false
  },
  successMessage: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['next-step', 'prev-step', 'complete-lesson', 'execute-workflow'])

const isPulsing = ref(false)
const showSuccessMessage = ref(false)

const progressPercentage = computed(() => {
  return ((props.stepIndex + 1) / props.totalSteps) * 100
})

const isLastStep = computed(() => {
  return props.stepIndex === props.totalSteps - 1
})

const getStepIcon = () => {
  const icons = {
    1: 'pi pi-question-circle',
    2: 'pi pi-eye',
    3: 'pi pi-cog',
    4: 'pi pi-sliders-h',
    5: 'pi pi-play-circle',
    6: 'pi pi-trophy'
  }
  return icons[props.currentStep.id] || 'pi pi-info-circle'
}

// Watch for success messages
watch(() => props.successMessage, (newMessage) => {
  if (newMessage) {
    showSuccessMessage.value = true
    isPulsing.value = true

    setTimeout(() => {
      showSuccessMessage.value = false
      isPulsing.value = false
    }, 3000)
  }
})
</script>

<style scoped lang="scss">
.step-guide {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 400px;
  z-index: 1000;
  pointer-events: auto;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3B82F6, #10B981);
  border-radius: 10px;
  transition: width 0.5s ease;
}

.step-indicator {
  text-align: center;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary-color);
  margin-bottom: 10px;
  padding: 6px 12px;
  background: var(--surface-card);
  border-radius: 20px;
  display: inline-block;
  width: 100%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.guide-card {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border: 2px solid var(--primary-color);

  &.pulse {
    animation: pulse 0.5s ease;
  }
}

.guide-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 1rem;

  .step-icon {
    font-size: 2rem;
    color: var(--primary-color);
  }

  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color);
  }
}

.guide-content {
  .description {
    font-size: 1rem;
    line-height: 1.6;
    color: var(--text-color);
    margin-bottom: 1rem;
  }

  .analogy-box {
    display: flex;
    gap: 12px;
    padding: 1rem;
    background: linear-gradient(135deg, #FEF3C7, #FDE68A);
    border-radius: var(--content-border-radius);
    border-left: 4px solid #F59E0B;
    margin-bottom: 1rem;

    i {
      font-size: 1.5rem;
      color: #F59E0B;
      flex-shrink: 0;
    }

    p {
      margin: 0;
      font-style: italic;
      color: #78350F;
    }
  }

  .substep-progress {
    padding: 1rem;
    background: var(--surface-50);
    border-radius: var(--content-border-radius);
    border-left: 4px solid var(--primary-color);
    margin-top: 1rem;

    .substep-indicator {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--primary-color);
      margin-bottom: 0.5rem;
    }

    .substep-description {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-weight: 500;

      i {
        color: var(--primary-color);
      }
    }
  }

  .achievements-list {
    margin-top: 1rem;

    h4 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: var(--text-color);
    }

    ul {
      list-style: none;
      padding: 0;
      margin: 0;

      li {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0.5rem 0;
        font-size: 0.95rem;

        i {
          color: #10B981;
          font-size: 1.1rem;
        }
      }
    }
  }

  .badge-display {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, #FEF3C7, #FCD34D);
    border-radius: var(--content-border-radius);
    margin-top: 1rem;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);

    .badge-icon {
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #F59E0B, #D97706);
      border-radius: 50%;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);

      i {
        font-size: 2rem;
        color: white;
      }
    }

    .badge-info {
      flex: 1;

      .badge-name {
        font-size: 1.25rem;
        font-weight: 700;
        color: #78350F;
        margin-bottom: 0.25rem;
      }

      .badge-level {
        font-size: 0.875rem;
        color: #92400E;
        font-weight: 500;
      }
    }
  }
}

.guide-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;

  .pulse-button {
    animation: pulse-button 2s infinite;
  }
}

.success-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #10B981, #059669);
  color: white;
  border-radius: var(--content-border-radius);
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
  font-weight: 600;
  transform: translateY(-120px);
  opacity: 0;
  transition: all 0.4s ease;
  z-index: 2000;

  &.show {
    transform: translateY(0);
    opacity: 1;
  }

  i {
    font-size: 1.5rem;
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}

@keyframes pulse-button {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
  }
}

@media (max-width: 768px) {
  .step-guide {
    position: static;
    width: 100%;
    margin-bottom: 1rem;
  }
}
</style>
