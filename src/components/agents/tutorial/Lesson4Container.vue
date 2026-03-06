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
      <!-- Step 1: Why Monitor Agents -->
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
                <p><strong>Аналогия:</strong> {{ currentStepData.content.analogy }}</p>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Step 2: Monitor Panel Tour -->
      <div v-if="currentStep === 2" class="step-section" key="step-2">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card">
          <template #content>
            <p class="section-intro">{{ currentStepData.content.explanation }}</p>

            <div class="panel-sections-grid">
              <div
                v-for="section in currentStepData.content.sections"
                :key="section.id"
                class="section-card"
              >
                <div class="section-icon">
                  <i :class="section.icon"></i>
                </div>
                <h4>{{ section.title }}</h4>
                <p>{{ section.description }}</p>
                <Tag :value="section.position" severity="info" />
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Step 3: Watch Agents Work -->
      <div v-if="currentStep === 3" class="step-section" key="step-3">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card mb-4">
          <template #content>
            <p>{{ currentStepData.content.explanation }}</p>
          </template>
        </Card>

        <div class="monitoring-demo">
          <div class="demo-controls">
            <Button
              label="Запустить workflow"
              icon="pi pi-play"
              @click="startSuccessWorkflow"
              :disabled="simulator && simulator.isRunning"
              severity="success"
            />
            <Button
              label="Остановить"
              icon="pi pi-stop"
              @click="stopWorkflow"
              :disabled="!simulator || !simulator.isRunning"
              severity="danger"
            />
            <Button label="Сбросить" icon="pi pi-refresh" @click="resetWorkflow" outlined />
          </div>

          <div class="monitor-layout">
            <div class="monitor-main">
              <AgentTimeline
                :agents="timelineAgents"
                :current-time="currentTime"
                :total-duration="totalDuration"
              />
              <LogViewer :logs="logs" @logs-cleared="logs = []" />
            </div>
            <div class="monitor-sidebar">
              <AgentMonitorPanel :agents="agentsList" />
            </div>
          </div>
        </div>
      </div>

      <!-- Step 4: Handle Errors -->
      <div v-if="currentStep === 4" class="step-section" key="step-4">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card mb-4">
          <template #content>
            <p>{{ currentStepData.content.explanation }}</p>
          </template>
        </Card>

        <div class="monitoring-demo">
          <div class="demo-controls">
            <Button
              label="Запустить workflow с ошибкой"
              icon="pi pi-play"
              @click="startErrorWorkflow"
              :disabled="simulator && simulator.isRunning"
              severity="warning"
            />
            <Button label="Сбросить" icon="pi pi-refresh" @click="resetWorkflow" outlined />
          </div>

          <div class="monitor-layout with-errors">
            <div class="monitor-main">
              <AgentTimeline
                :agents="timelineAgents"
                :current-time="currentTime"
                :total-duration="totalDuration"
              />
              <LogViewer :logs="logs" @logs-cleared="logs = []" />
            </div>
            <div class="monitor-sidebar">
              <ErrorPanel
                :errors="errors"
                @fix-error="fixError"
                @ignore-error="ignoreError"
                @clear-all="errors = []"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Step 5: Performance Metrics -->
      <div v-if="currentStep === 5" class="step-section" key="step-5">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card mb-4">
          <template #content>
            <p>{{ currentStepData.content.explanation }}</p>
          </template>
        </Card>

        <MetricsDashboard
          :agents="agentsList"
          :metrics="metrics"
          :queue-stats="queueStats"
          :max-memory="512"
        />
      </div>

      <!-- Step 6: Debug Game -->
      <div v-if="currentStep === 6" class="step-section" key="step-6">
        <div class="step-header">
          <div class="step-icon">
            <i :class="currentStepData.icon"></i>
          </div>
          <h2>{{ currentStepData.title }}</h2>
        </div>

        <Card class="content-card mb-4">
          <template #content>
            <p>{{ currentStepData.content.explanation }}</p>
          </template>
        </Card>

        <DebugGame
          ref="debugGameRef"
          :total-errors="currentStepData.content.errorCount"
          :hints="currentStepData.content.hints"
          :reward="currentStepData.content.reward"
          @workflow-start="startDebugGameWorkflow"
          @workflow-stop="stopWorkflow"
          @reset="resetWorkflow"
          @completed="onDebugGameCompleted"
        />

        <div class="monitoring-demo mt-4">
          <div class="monitor-layout">
            <div class="monitor-main">
              <AgentTimeline
                :agents="timelineAgents"
                :current-time="currentTime"
                :total-duration="totalDuration"
              />
              <LogViewer :logs="logs" @logs-cleared="logs = []" />
            </div>
            <div class="monitor-sidebar">
              <ErrorPanel
                :errors="errors"
                @fix-error="fixErrorInGame"
                @ignore-error="ignoreError"
              />
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
import { logger } from '@/utils/logger'
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'

import ProgressBar from './ProgressBar.vue'
import AgentMonitorPanel from './AgentMonitorPanel.vue'
import LogViewer from './LogViewer.vue'
import AgentTimeline from './AgentTimeline.vue'
import ErrorPanel from './ErrorPanel.vue'
import MetricsDashboard from './MetricsDashboard.vue'
import DebugGame from './DebugGame.vue'
import { lesson4Data, successScenario, errorScenario, debugGameScenario } from '@/data/tutorial/lesson4Data'
import { WorkflowSimulator } from '@/utils/tutorial/workflowSimulator'

const router = useRouter()
const currentStep = ref(1)
const lessonData = lesson4Data

const simulator = ref(null)
const logs = ref([])
const errors = ref([])
const metrics = ref({})
const agentsList = ref([])
const timelineAgents = ref([])
const currentTime = ref(0)
const totalDuration = ref(10000)
const queueStats = ref({ pending: 0, running: 0, completed: 0, errors: 0 })
const debugGameRef = ref(null)

const stepLabels = computed(() => lessonData.steps.map((step) => step.title))
const currentStepData = computed(() => lessonData.steps[currentStep.value - 1])

// Start success workflow
const startSuccessWorkflow = () => {
  resetWorkflow()
  simulator.value = new WorkflowSimulator(successScenario, { speed: 2 })
  setupSimulator()
  simulator.value.start()
}

// Start error workflow
const startErrorWorkflow = () => {
  resetWorkflow()
  simulator.value = new WorkflowSimulator(errorScenario, { speed: 2 })
  setupSimulator()
  simulator.value.start()
}

// Start debug game workflow
const startDebugGameWorkflow = () => {
  resetWorkflow()
  simulator.value = new WorkflowSimulator(debugGameScenario, { speed: 1.5 })
  setupSimulator()
  simulator.value.start()
}

// Cleanup simulator event listeners
const cleanupSimulator = () => {
  if (!simulator.value) return

  simulator.value.removeEventListener('workflow:start', handleWorkflowStart)
  simulator.value.removeEventListener('log', handleLog)
  simulator.value.removeEventListener('node:start', handleNodeStart)
  simulator.value.removeEventListener('node:progress', handleNodeProgress)
  simulator.value.removeEventListener('node:complete', handleNodeComplete)
  simulator.value.removeEventListener('workflow:error', handleWorkflowError)
  simulator.value.removeEventListener('workflow:complete', handleWorkflowComplete)
  simulator.value.removeEventListener('metrics:update', handleMetricsUpdate)
}

// Setup simulator event listeners
const setupSimulator = () => {
  if (!simulator.value) return

  // Remove old listeners if they exist
  cleanupSimulator()

  simulator.value.addEventListener('workflow:start', handleWorkflowStart)
  simulator.value.addEventListener('log', handleLog)
  simulator.value.addEventListener('node:start', handleNodeStart)
  simulator.value.addEventListener('node:progress', handleNodeProgress)
  simulator.value.addEventListener('node:complete', handleNodeComplete)
  simulator.value.addEventListener('workflow:error', handleWorkflowError)
  simulator.value.addEventListener('workflow:complete', handleWorkflowComplete)
  simulator.value.addEventListener('metrics:update', handleMetricsUpdate)

  // Initialize agents list
  agentsList.value = simulator.value.workflow.nodes.map((node) => ({
    id: node.id,
    name: node.agentName,
    type: node.agentType,
    status: 'idle',
    progress: 0
  }))

  // Initialize timeline
  timelineAgents.value = simulator.value.workflow.nodes.map((node, index) => ({
    id: node.id,
    name: node.agentName,
    type: node.agentType,
    icon: 'pi pi-android',
    color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][index % 5],
    activities: []
  }))

  totalDuration.value = simulator.value.workflow.duration || 10000
}

const handleWorkflowStart = (e) => {
  currentTime.value = 0
  queueStats.value = { pending: agentsList.value.length, running: 0, completed: 0, errors: 0 }
}

const handleLog = (e) => {
  logs.value.push(e.detail)
}

const handleNodeStart = (e) => {
  const { node } = e.detail
  const agent = agentsList.value.find((a) => a.id === node.id)
  if (agent) {
    agent.status = 'running'
    agent.progress = 0
  }

  const timelineAgent = timelineAgents.value.find((a) => a.id === node.id)
  if (timelineAgent) {
    timelineAgent.activities.push({
      id: Date.now(),
      label: node.agentName,
      startTime: Date.now() - simulator.value.startTime,
      endTime: Date.now() - simulator.value.startTime + node.duration,
      status: 'running',
      progress: 0
    })
  }

  queueStats.value.pending--
  queueStats.value.running++
}

const handleNodeProgress = (e) => {
  const { node, progress } = e.detail
  const agent = agentsList.value.find((a) => a.id === node.id)
  if (agent) {
    agent.progress = progress
  }

  const timelineAgent = timelineAgents.value.find((a) => a.id === node.id)
  if (timelineAgent && timelineAgent.activities.length > 0) {
    const activity = timelineAgent.activities[timelineAgent.activities.length - 1]
    activity.progress = progress
  }

  currentTime.value = Date.now() - simulator.value.startTime
}

const handleNodeComplete = (e) => {
  const { node } = e.detail
  const agent = agentsList.value.find((a) => a.id === node.id)
  if (agent) {
    agent.status = 'completed'
    agent.progress = 100
  }

  const timelineAgent = timelineAgents.value.find((a) => a.id === node.id)
  if (timelineAgent && timelineAgent.activities.length > 0) {
    const activity = timelineAgent.activities[timelineAgent.activities.length - 1]
    activity.status = 'completed'
    activity.progress = 100
  }

  queueStats.value.running--
  queueStats.value.completed++
}

const handleWorkflowError = (e) => {
  const { error, node } = e.detail
  const agent = agentsList.value.find((a) => a.id === node.id)
  if (agent) {
    agent.status = 'error'
  }

  errors.value.push(error)
  queueStats.value.errors++

  if (debugGameRef.value) {
    debugGameRef.value.errorFound(error.id)
  }
}

const handleWorkflowComplete = (e) => {
  currentTime.value = totalDuration.value
}

const handleMetricsUpdate = (e) => {
  const { nodeId, metrics: nodeMetrics } = e.detail
  metrics.value[nodeId] = nodeMetrics
}

// Fix error
const fixError = (error) => {
  if (simulator.value) {
    simulator.value.fixErrorAndContinue(error.id, error.fix)
  }
}

// Fix error in game
const fixErrorInGame = (error) => {
  if (simulator.value) {
    simulator.value.fixErrorAndContinue(error.id, error.fix)
  }
  if (debugGameRef.value) {
    debugGameRef.value.errorFixed(error.id)
  }
}

// Ignore error
const ignoreError = (error) => {
  const index = errors.value.findIndex((e) => e.id === error.id)
  if (index !== -1) {
    errors.value.splice(index, 1)
  }
}

// Stop workflow
const stopWorkflow = () => {
  if (simulator.value) {
    simulator.value.stop()
  }
}

// Reset workflow
const resetWorkflow = () => {
  if (simulator.value) {
    simulator.value.reset()
  }
  logs.value = []
  errors.value = []
  metrics.value = {}
  agentsList.value = []
  timelineAgents.value = []
  currentTime.value = 0
  queueStats.value = { pending: 0, running: 0, completed: 0, errors: 0 }
}

// Debug game completed
const onDebugGameCompleted = (result) => {
  logger.info('Debug game completed:', result)
  // Could save progress here
}

// Navigation
const nextStep = () => {
  if (currentStep.value < lessonData.totalSteps) {
    currentStep.value++
    resetWorkflow()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const previousStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
    resetWorkflow()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const goToStep = (step) => {
  currentStep.value = step
  resetWorkflow()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const completeLesson = () => {
  localStorage.setItem('tutorial_lesson4_completed', 'true')
  // Navigate to lesson 5
  router.push('/agents/tutorial/lesson-5')
}

onBeforeUnmount(() => {
  if (simulator.value) {
    simulator.value.stop()
    cleanupSimulator()
  }
})
</script>

<style scoped>
.lesson-container {
  max-width: 1400px;
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
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
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

.mb-4 {
  margin-bottom: 1.5rem;
}

.mt-4 {
  margin-top: 1.5rem;
}

.explanation-block {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.quote-box,
.analogy-box {
  padding: 1.5rem;
  border-radius: 12px;
  border-left: 4px solid;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.quote-box {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-left-color: #3b82f6;
}

.analogy-box {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-left-color: #f59e0b;
}

.quote-icon,
.analogy-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.quote-icon {
  color: #3b82f6;
}

.analogy-icon {
  color: #f59e0b;
}

.quote-box p,
.analogy-box p {
  font-size: 1.1rem;
  line-height: 1.6;
  margin: 0;
}

.section-intro {
  text-align: center;
  font-size: 1.1rem;
  color: #6b7280;
  margin-bottom: 2rem;
}

.panel-sections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.section-card {
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 12px;
  border: 2px solid #e5e7eb;
  transition: all 0.3s ease;
}

.section-card:hover {
  border-color: #3b82f6;
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.15);
}

.section-icon {
  width: 48px;
  height: 48px;
  background: white;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: #3b82f6;
  margin-bottom: 1rem;
}

.section-card h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: #1f2937;
}

.section-card p {
  margin: 0 0 0.75rem 0;
  font-size: 0.9375rem;
  color: #6b7280;
  line-height: 1.5;
}

.monitoring-demo {
  margin-top: 1.5rem;
}

.demo-controls {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.monitor-layout {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 1.5rem;
  min-height: 600px;
}

.monitor-layout.with-errors {
  grid-template-columns: 1fr 400px;
}

.monitor-main {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.monitor-sidebar {
  display: flex;
  flex-direction: column;
}

.navigation-buttons {
  display: flex;
  gap: 1rem;
  padding: 2rem 0;
  border-top: 2px solid #e5e7eb;
}

.spacer {
  flex: 1;
}

@media (max-width: 1200px) {
  .monitor-layout,
  .monitor-layout.with-errors {
    grid-template-columns: 1fr;
  }

  .monitor-sidebar {
    max-height: 400px;
  }
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

  .navigation-buttons {
    flex-direction: column;
  }

  .spacer {
    display: none;
  }
}
</style>
