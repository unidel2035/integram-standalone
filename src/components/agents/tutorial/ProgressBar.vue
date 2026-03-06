<template>
  <div class="tutorial-progress">
    <div class="progress-header">
      <h2 class="lesson-title">{{ title }}</h2>
      <div class="progress-info">
        <span class="step-counter">Шаг {{ currentStep }} из {{ totalSteps }}</span>
      </div>
    </div>

    <div class="progress-bar-container">
      <div class="progress-bar-track">
        <div
          class="progress-bar-fill"
          :style="{ width: `${progressPercentage}%` }"
        ></div>
      </div>
      <div class="progress-steps">
        <div
          v-for="step in totalSteps"
          :key="step"
          class="progress-step"
          :class="{
            completed: step < currentStep,
            active: step === currentStep,
            pending: step > currentStep
          }"
          @click="$emit('step-click', step)"
        >
          <div class="step-circle">
            <i class="pi pi-check" v-if="step < currentStep"></i>
            <span v-else>{{ step }}</span>
          </div>
          <span class="step-label">{{ getStepLabel(step) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps, defineEmits } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  currentStep: {
    type: Number,
    required: true
  },
  totalSteps: {
    type: Number,
    required: true
  },
  stepLabels: {
    type: Array,
    default: () => []
  }
})

defineEmits(['step-click'])

const progressPercentage = computed(() => {
  return ((props.currentStep - 1) / (props.totalSteps - 1)) * 100
})

const getStepLabel = (step) => {
  return props.stepLabels[step - 1] || `Шаг ${step}`
}
</script>

<style scoped>
.tutorial-progress {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.lesson-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  flex: 1;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.step-counter {
  font-size: 0.95rem;
  font-weight: 600;
  color: #3B82F6;
  padding: 0.5rem 1rem;
  background: #EFF6FF;
  border-radius: 20px;
}

.progress-bar-container {
  margin-top: 1rem;
}

.progress-bar-track {
  width: 100%;
  height: 8px;
  background: #E5E7EB;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.progress-step:hover {
  transform: scale(1.05);
}

.step-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  transition: all 0.3s ease;
  border: 3px solid #E5E7EB;
  background: white;
  color: #9CA3AF;
}

.progress-step.completed .step-circle {
  background: #10B981;
  border-color: #10B981;
  color: white;
}

.progress-step.active .step-circle {
  background: #3B82F6;
  border-color: #3B82F6;
  color: white;
  animation: pulse 2s ease-in-out infinite;
}

.progress-step.pending .step-circle {
  background: white;
  border-color: #E5E7EB;
  color: #9CA3AF;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
  }
}

.step-label {
  font-size: 0.75rem;
  text-align: center;
  color: #6B7280;
  max-width: 100px;
  line-height: 1.3;
}

.progress-step.active .step-label {
  color: #3B82F6;
  font-weight: 600;
}

.progress-step.completed .step-label {
  color: #10B981;
  font-weight: 500;
}

@media (max-width: 768px) {
  .tutorial-progress {
    padding: 1rem;
  }

  .progress-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .lesson-title {
    font-size: 1.25rem;
  }

  .progress-steps {
    gap: 0.5rem;
  }

  .step-circle {
    width: 32px;
    height: 32px;
    font-size: 0.9rem;
  }

  .step-label {
    font-size: 0.7rem;
    max-width: 80px;
  }
}

@media (max-width: 480px) {
  .step-label {
    display: none;
  }
}
</style>
