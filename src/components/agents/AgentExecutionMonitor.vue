<template>
  <div class="agent-execution-monitor" :class="{ 'is-executing': isExecuting, 'collapsed': isCollapsed }">
    <!-- Header -->
    <div class="monitor-header" @click="toggleCollapse">
      <div class="header-left">
        <span class="agent-icon">{{ agent?.icon || '🤖' }}</span>
        <span class="agent-name">{{ agent?.name || 'Agent' }}</span>
        <Tag
          :value="statusLabel"
          :severity="statusSeverity"
          size="small"
        />
      </div>
      <div class="header-right">
        <span v-if="duration" class="duration">{{ formatDuration(duration) }}</span>
        <i :class="isCollapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'"></i>
      </div>
    </div>

    <!-- Content (collapsible) -->
    <transition name="slide">
      <div v-show="!isCollapsed" class="monitor-content">
        <!-- Progress Bar -->
        <div class="progress-section">
          <ProgressBar
            :value="progress"
            :showValue="false"
            :style="{ height: '6px' }"
            :class="{ 'indeterminate': isIndeterminate }"
          />
          <span class="progress-text">{{ progressText }}</span>
        </div>

        <!-- Steps Timeline -->
        <div class="steps-timeline" v-if="steps.length > 0">
          <div
            v-for="(step, index) in steps"
            :key="step.id"
            class="step-item"
            :class="{
              'completed': step.status === 'completed',
              'in-progress': step.status === 'in-progress',
              'pending': step.status === 'pending',
              'error': step.status === 'error'
            }"
          >
            <div class="step-indicator">
              <i v-if="step.status === 'completed'" class="pi pi-check"></i>
              <i v-else-if="step.status === 'error'" class="pi pi-times"></i>
              <ProgressSpinner
                v-else-if="step.status === 'in-progress'"
                style="width: 16px; height: 16px"
              />
              <span v-else class="step-number">{{ index + 1 }}</span>
            </div>
            <div class="step-content">
              <div class="step-title">{{ step.action }}</div>
              <div v-if="step.result" class="step-result">{{ step.result }}</div>
              <div v-if="step.timestamp" class="step-timestamp">
                {{ formatTimestamp(step.timestamp) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Tool Calls -->
        <div class="tool-calls" v-if="toolCalls.length > 0">
          <div class="section-title">
            <i class="pi pi-wrench"></i>
            Tool Calls ({{ toolCalls.length }})
          </div>
          <div class="tool-list">
            <div
              v-for="tool in toolCalls"
              :key="tool.id"
              class="tool-item"
              :class="{ 'success': tool.success, 'error': !tool.success }"
            >
              <div class="tool-name">
                <i :class="tool.success ? 'pi pi-check-circle' : 'pi pi-times-circle'"></i>
                {{ tool.name }}
              </div>
              <div v-if="tool.duration" class="tool-duration">
                {{ tool.duration }}ms
              </div>
            </div>
          </div>
        </div>

        <!-- SGR Validation Status -->
        <div v-if="sgrStatus" class="sgr-section">
          <div class="section-title">
            <i class="pi pi-shield"></i>
            SGR Validation
          </div>
          <div class="sgr-status">
            <Tag
              :value="sgrStatus.status"
              :severity="getSGRSeverity(sgrStatus.status)"
            />
            <span v-if="sgrStatus.fixes?.length" class="fixes-count">
              {{ sgrStatus.fixes.length }} auto-fixes applied
            </span>
          </div>
        </div>

        <!-- Final Result -->
        <div v-if="finalResult" class="final-result">
          <div class="section-title">
            <i class="pi pi-check-square"></i>
            Result
          </div>
          <div class="result-content">
            <div v-if="finalResult.confidence !== undefined" class="confidence">
              <span>Confidence:</span>
              <ProgressBar
                :value="finalResult.confidence * 100"
                style="width: 100px; height: 8px"
              />
              <span>{{ Math.round(finalResult.confidence * 100) }}%</span>
            </div>
            <p v-if="finalResult.summary" class="summary">{{ finalResult.summary }}</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="monitor-actions">
          <Button
            v-if="isExecuting"
            label="Cancel"
            icon="pi pi-times"
            severity="danger"
            size="small"
            outlined
            @click="cancelExecution"
          />
          <Button
            v-else-if="status === 'completed'"
            label="Run Again"
            icon="pi pi-refresh"
            severity="secondary"
            size="small"
            outlined
            @click="rerun"
          />
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'

const props = defineProps({
  agent: {
    type: Object,
    default: null
  },
  executionId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    default: 'idle', // idle, running, completed, error, cancelled
    validator: (v) => ['idle', 'running', 'completed', 'error', 'cancelled'].includes(v)
  },
  progress: {
    type: Number,
    default: 0
  },
  steps: {
    type: Array,
    default: () => []
  },
  toolCalls: {
    type: Array,
    default: () => []
  },
  sgrStatus: {
    type: Object,
    default: null
  },
  finalResult: {
    type: Object,
    default: null
  },
  startTime: {
    type: [Date, String, Number],
    default: null
  }
})

const emit = defineEmits(['cancel', 'rerun', 'collapse'])

const isCollapsed = ref(false)
const duration = ref(0)
let durationInterval = null

const isExecuting = computed(() => props.status === 'running')

const isIndeterminate = computed(() =>
  props.status === 'running' && props.progress === 0
)

const statusLabel = computed(() => {
  const labels = {
    idle: 'Idle',
    running: 'Running',
    completed: 'Completed',
    error: 'Error',
    cancelled: 'Cancelled'
  }
  return labels[props.status] || 'Unknown'
})

const statusSeverity = computed(() => {
  const severities = {
    idle: 'secondary',
    running: 'info',
    completed: 'success',
    error: 'danger',
    cancelled: 'warning'
  }
  return severities[props.status] || 'secondary'
})

const progressText = computed(() => {
  if (props.status === 'completed') return '100%'
  if (props.status === 'error') return 'Failed'
  if (props.status === 'cancelled') return 'Cancelled'
  if (props.progress > 0) return `${props.progress}%`
  return 'Processing...'
})

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
  emit('collapse', isCollapsed.value)
}

const cancelExecution = () => {
  emit('cancel', props.executionId)
}

const rerun = () => {
  emit('rerun', props.executionId)
}

const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const getSGRSeverity = (status) => {
  const severities = {
    valid: 'success',
    fixed: 'warning',
    invalid: 'danger',
    error: 'danger'
  }
  return severities[status] || 'secondary'
}

const updateDuration = () => {
  if (props.startTime && props.status === 'running') {
    const start = new Date(props.startTime).getTime()
    duration.value = Date.now() - start
  }
}

watch(() => props.status, (newStatus) => {
  if (newStatus === 'running') {
    durationInterval = setInterval(updateDuration, 100)
  } else {
    if (durationInterval) {
      clearInterval(durationInterval)
      durationInterval = null
    }
  }
})

onMounted(() => {
  if (props.status === 'running' && props.startTime) {
    durationInterval = setInterval(updateDuration, 100)
  }
})

onUnmounted(() => {
  if (durationInterval) {
    clearInterval(durationInterval)
  }
})
</script>

<style scoped>
.agent-execution-monitor {
  background: var(--surface-card, #f7f7f5);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s;
}

.agent-execution-monitor.is-executing {
  border-color: var(--p-primary-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--p-primary-color) 20%, transparent);
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  cursor: pointer;
  background: var(--surface-ground);
  border-bottom: 1px solid var(--surface-border);
}

.agent-execution-monitor.collapsed .monitor-header {
  border-bottom: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.agent-icon {
  font-size: 1.25rem;
}

.agent-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--p-text-muted-color);
}

.duration {
  font-size: 0.75rem;
  font-family: monospace;
}

.monitor-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.progress-text {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  text-align: right;
}

:deep(.indeterminate .p-progressbar-value) {
  animation: indeterminate 1.5s infinite ease-in-out;
}

@keyframes indeterminate {
  0% { transform: translateX(-100%); width: 50%; }
  50% { width: 30%; }
  100% { transform: translateX(200%); width: 50%; }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
}

.steps-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.step-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 8px;
  background: var(--surface-ground);
  transition: all 0.2s;
}

.step-item.in-progress {
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  border-left: 3px solid var(--p-primary-color);
}

.step-item.completed {
  border-left: 3px solid var(--p-green-500);
}

.step-item.error {
  background: color-mix(in srgb, var(--p-red-500) 10%, transparent);
  border-left: 3px solid var(--p-red-500);
}

.step-indicator {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--surface-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.step-item.completed .step-indicator {
  background: var(--p-green-500);
  color: white;
}

.step-item.error .step-indicator {
  background: var(--p-red-500);
  color: white;
}

.step-number {
  font-weight: 600;
}

.step-content {
  flex: 1;
  min-width: 0;
}

.step-title {
  font-size: 0.875rem;
  font-weight: 500;
}

.step-result {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  margin-top: 0.25rem;
}

.step-timestamp {
  font-size: 0.625rem;
  color: var(--p-text-muted-color);
  margin-top: 0.25rem;
  font-family: monospace;
}

.tool-calls {
  background: var(--surface-ground);
  border-radius: 8px;
  padding: 0.75rem;
}

.tool-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: var(--surface-card, #f7f7f5);
  border-radius: 4px;
  font-size: 0.75rem;
}

.tool-item.success .pi {
  color: var(--p-green-500);
}

.tool-item.error .pi {
  color: var(--p-red-500);
}

.tool-duration {
  color: var(--p-text-muted-color);
  font-family: monospace;
}

.sgr-section {
  background: var(--surface-ground);
  border-radius: 8px;
  padding: 0.75rem;
}

.sgr-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.fixes-count {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.final-result {
  background: color-mix(in srgb, var(--p-green-500) 10%, transparent);
  border-radius: 8px;
  padding: 0.75rem;
  border-left: 3px solid var(--p-green-500);
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.confidence {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.summary {
  margin: 0;
  font-size: 0.875rem;
}

.monitor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--surface-border);
}

/* Transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
