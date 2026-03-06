<template>
  <div class="lesson-container">
    <!-- Progress Bar -->
    <ProgressBar
      :title="lessonData.title"
      :current-step="currentStep"
      :total-steps="lessonData.totalSteps"
      :step-labels="stepLabels"
      @step-click="goToStep"
    />

    <!-- Step Content -->
    <div class="step-content">
      <!-- Step 1: What is AI Agent -->
      <div v-if="currentStep === 1" class="step-section" key="step-1">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card">
          <template #content>
            <div class="explanation-block">
              <div class="quote-box">
                <i class="pi pi-comments quote-icon"></i>
                <p>{{ currentStepData.content.explanation }}</p>
              </div>
              <div class="analogy-box">
                <i class="pi pi-sparkles analogy-icon"></i>
                <p><strong>Простая аналогия:</strong> {{ currentStepData.content.analogy }}</p>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Step 2: Meet the Agents -->
      <div v-if="currentStep === 2" class="step-section" key="step-2">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <div class="agents-grid">
          <AgentCard
            v-for="(agent, index) in currentStepData.content.agents"
            :key="agent.id"
            :agent="agent"
            :animated="true"
            :style="{ 'animation-delay': `${index * 0.1}s` }"
          />
        </div>
      </div>

      <!-- Step 3: How Agents Work Together -->
      <div v-if="currentStep === 3" class="step-section" key="step-3">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card">
          <template #content>
            <div class="explanation-block">
              <div class="quote-box">
                <i class="pi pi-comments quote-icon"></i>
                <p>{{ currentStepData.content.explanation }}</p>
              </div>
            </div>

            <div class="workflow-visualization">
              <div
                v-for="(node, index) in currentStepData.content.workflow"
                :key="index"
                class="workflow-item"
              >
                <div
                  class="workflow-node"
                  :style="{ '--node-color': node.color || '#6B7280' }"
                >
                  <i :class="node.icon"></i>
                  <span>{{ node.name }}</span>
                </div>
                <div v-if="index < currentStepData.content.workflow.length - 1" class="workflow-arrow">
                  <i class="pi pi-arrow-right"></i>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Step 4: Try It Yourself -->
      <div v-if="currentStep === 4" class="step-section" key="step-4">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card">
          <template #content>
            <div class="explanation-block">
              <div class="quote-box">
                <i class="pi pi-info-circle quote-icon"></i>
                <p>{{ currentStepData.content.explanation }}</p>
              </div>
            </div>
          </template>
        </Card>

        <InteractiveDemo
          :demo-data="currentStepData.content.demoData"
          :expected-result="currentStepData.content.expectedResult"
        />
      </div>

      <!-- Step 5: What's Next -->
      <div v-if="currentStep === 5" class="step-section" key="step-5">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card">
          <template #content>
            <div class="explanation-block">
              <div class="quote-box success">
                <i class="pi pi-check-circle quote-icon"></i>
                <p>{{ currentStepData.content.explanation }}</p>
              </div>
            </div>
          </template>
        </Card>

        <div class="next-lessons">
          <h3>Следующие уроки</h3>
          <div class="lessons-grid">
            <div
              v-for="lesson in currentStepData.content.nextLessons"
              :key="lesson.id"
              class="lesson-card"
              :class="{ locked: lesson.locked }"
            >
              <div class="lesson-icon">
                <i :class="lesson.icon"></i>
                <div v-if="lesson.locked" class="lock-overlay">
                  <i class="pi pi-lock"></i>
                </div>
              </div>
              <div class="lesson-info">
                <h4>{{ lesson.title }}</h4>
                <p>{{ lesson.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Buttons -->
    <div class="navigation-buttons">
      <Button
        v-if="currentStep > 1"
        label="Назад"
        icon="pi pi-arrow-left"
        @click="previousStep"
        outlined
        size="large"
      />
      <div class="spacer"></div>
      <Button
        v-if="currentStep < lessonData.totalSteps"
        label="Далее"
        icon="pi pi-arrow-right"
        iconPos="right"
        @click="nextStep"
        size="large"
      />
      <Button
        v-else
        label="Завершить урок"
        icon="pi pi-check"
        iconPos="right"
        @click="completeLesson"
        severity="success"
        size="large"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

import ProgressBar from './ProgressBar.vue'
import AgentCard from './AgentCard.vue'
import InteractiveDemo from './InteractiveDemo.vue'
import { lesson1Data } from '@/data/tutorial/lesson1Data'

const router = useRouter()
const currentStep = ref(1)
const lessonData = lesson1Data

const stepLabels = computed(() => {
  return lessonData.steps.map((step) => step.title)
})

const currentStepData = computed(() => {
  return lessonData.steps[currentStep.value - 1]
})

const nextStep = () => {
  if (currentStep.value < lessonData.totalSteps) {
    currentStep.value++
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const previousStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const goToStep = (step) => {
  currentStep.value = step
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const completeLesson = () => {
  localStorage.setItem('tutorial_lesson1_completed', 'true')
  // Navigate to lesson 2
  router.push('/agents/tutorial/lesson-2')
}
</script>

<style scoped>
.lesson-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.step-content {
  margin-bottom: 2rem;
}

.step-section {
  animation: fadeInUp 0.5s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-header {
  text-align: center;
  margin-bottom: 2rem;
}

.step-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1rem;
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
}

.step-icon i {
  font-size: 2.5rem;
  color: white;
}

.step-header h2 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.content-card {
  margin-bottom: 2rem;
}

.explanation-block {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.quote-box {
  padding: 1.5rem;
  background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
  border-radius: 12px;
  border-left: 4px solid #3B82F6;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.quote-box.success {
  background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
  border-left-color: #10B981;
}

.quote-icon {
  font-size: 1.5rem;
  color: #3B82F6;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.quote-box.success .quote-icon {
  color: #10B981;
}

.quote-box p {
  font-size: 1.1rem;
  line-height: 1.6;
  color: #1f2937;
  margin: 0;
}

.analogy-box {
  padding: 1.5rem;
  background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
  border-radius: 12px;
  border-left: 4px solid #F59E0B;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.analogy-icon {
  font-size: 1.5rem;
  color: #F59E0B;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.analogy-box p {
  font-size: 1.1rem;
  line-height: 1.6;
  color: #78350F;
  margin: 0;
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.workflow-visualization {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 2rem 0;
}

.workflow-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.workflow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border: 2px solid var(--node-color);
  border-radius: 12px;
  min-width: 120px;
  transition: all 0.3s ease;
}

.workflow-node:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.workflow-node i {
  font-size: 2rem;
  color: var(--node-color);
}

.workflow-node span {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--node-color);
  text-align: center;
}

.workflow-arrow {
  color: #9CA3AF;
  font-size: 1.5rem;
  animation: slideRight 1.5s ease-in-out infinite;
}

@keyframes slideRight {
  0%, 100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(5px);
  }
}

.next-lessons {
  margin-top: 2rem;
}

.next-lessons h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.lessons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.lesson-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  display: flex;
  gap: 1rem;
  cursor: pointer;
  position: relative;
}

.lesson-card:not(.locked):hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.lesson-card.locked {
  opacity: 0.6;
  cursor: not-allowed;
}

.lesson-icon {
  width: 56px;
  height: 56px;
  background: #EFF6FF;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  color: #3B82F6;
  flex-shrink: 0;
  position: relative;
}

.lock-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
}

.lesson-info {
  flex: 1;
}

.lesson-info h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.lesson-info p {
  font-size: 0.9rem;
  color: #6B7280;
  margin: 0;
}

.navigation-buttons {
  display: flex;
  gap: 1rem;
  padding: 2rem 0;
  border-top: 2px solid #E5E7EB;
}

.spacer {
  flex: 1;
}

@media (max-width: 768px) {
  .lesson-container {
    padding: 1rem;
  }

  .step-header h2 {
    font-size: 1.5rem;
  }

  .step-icon {
    width: 64px;
    height: 64px;
  }

  .step-icon i {
    font-size: 2rem;
  }

  .agents-grid {
    grid-template-columns: 1fr;
  }

  .workflow-visualization {
    flex-direction: column;
  }

  .workflow-arrow {
    transform: rotate(90deg);
  }

  .lessons-grid {
    grid-template-columns: 1fr;
  }

  .navigation-buttons {
    flex-direction: column;
  }

  .spacer {
    display: none;
  }
}
</style>
