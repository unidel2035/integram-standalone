<template>
  <div class="research-progress" :class="{ 'compact': compact }">
    <div class="progress-header">
      <div class="header-content">
        <i class="pi pi-search header-icon"></i>
        <span class="header-title">{{ title || 'Глубокое исследование' }}</span>
      </div>
      <div class="header-actions">
        <span class="iteration-badge" v-if="iteration > 0">
          Итерация {{ iteration }}/{{ maxIterations }}
        </span>
        <Button
          v-if="canCancel"
          icon="pi pi-times"
          class="p-button-text p-button-sm p-button-danger"
          @click="$emit('cancel')"
          title="Отменить"
        />
      </div>
    </div>

    <div class="phases-timeline">
      <div
        v-for="phase in phases"
        :key="phase.id"
        class="phase-item"
        :class="{
          'active': phase.status === 'running',
          'completed': phase.status === 'completed',
          'pending': phase.status === 'pending',
          'failed': phase.status === 'failed'
        }"
      >
        <div class="phase-indicator">
          <i :class="getPhaseIcon(phase)" />
        </div>
        <div class="phase-content">
          <div class="phase-name">{{ phase.label }}</div>
          <div class="phase-status" v-if="phase.status === 'running'">
            <ProgressSpinner style="width: 16px; height: 16px" />
            <span>{{ phase.message || 'Выполняется...' }}</span>
          </div>
          <div class="phase-result" v-else-if="phase.status === 'completed' && phase.resultPreview">
            {{ phase.resultPreview }}
          </div>
        </div>
        <div class="phase-time" v-if="phase.duration">
          {{ formatDuration(phase.duration) }}
        </div>
      </div>
    </div>

    <div class="tasks-section" v-if="tasks.length > 0 && !compact">
      <div class="tasks-header">
        <i class="pi pi-list"></i>
        <span>Задачи ({{ completedTasks }}/{{ tasks.length }})</span>
      </div>
      <div class="tasks-list">
        <div
          v-for="task in tasks"
          :key="task.taskId"
          class="task-item"
          :class="task.status"
        >
          <i :class="getTaskIcon(task)" />
          <span class="task-tool">{{ task.tool }}</span>
          <span class="task-desc">{{ task.description }}</span>
        </div>
      </div>
    </div>

    <div class="progress-footer" v-if="duration > 0">
      <span class="duration">
        <i class="pi pi-clock"></i>
        {{ formatDuration(duration) }}
      </span>
      <span class="status-text">{{ statusText }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: null
  },
  currentPhase: {
    type: String,
    default: 'idle'
  },
  events: {
    type: Array,
    default: () => []
  },
  iteration: {
    type: Number,
    default: 0
  },
  maxIterations: {
    type: Number,
    default: 5
  },
  duration: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    default: 'running'
  },
  compact: {
    type: Boolean,
    default: false
  }
})

defineEmits(['cancel'])

const phaseDefinitions = [
  { id: 'understand', label: 'Анализ запроса', icon: 'pi-eye' },
  { id: 'plan', label: 'Планирование', icon: 'pi-list-check' },
  { id: 'execute', label: 'Выполнение', icon: 'pi-cog' },
  { id: 'reflect', label: 'Оценка', icon: 'pi-check-circle' },
  { id: 'answer', label: 'Ответ', icon: 'pi-comment' }
]

const phases = computed(() => {
  return phaseDefinitions.map(def => {
    const phaseEvents = props.events.filter(e => e.type === 'phase' && e.phase === def.id)
    const lastEvent = phaseEvents[phaseEvents.length - 1]

    return {
      ...def,
      status: lastEvent?.status || 'pending',
      message: lastEvent?.message,
      resultPreview: lastEvent?.resultPreview || lastEvent?.result?.answer?.substring?.(0, 100),
      duration: lastEvent?.duration
    }
  })
})

const tasks = computed(() => {
  return props.events
    .filter(e => e.type === 'task')
    .map(e => ({
      taskId: e.taskId,
      tool: e.tool,
      description: e.description,
      status: e.status
    }))
})

const completedTasks = computed(() => {
  return tasks.value.filter(t => t.status === 'completed').length
})

const canCancel = computed(() => {
  return props.status === 'running'
})

const statusText = computed(() => {
  switch (props.status) {
    case 'running': return 'Исследование выполняется...'
    case 'completed': return 'Исследование завершено'
    case 'failed': return 'Исследование прервано'
    case 'cancelled': return 'Исследование отменено'
    default: return ''
  }
})

const getPhaseIcon = (phase) => {
  if (phase.status === 'running') return 'pi pi-spin pi-spinner'
  if (phase.status === 'completed') return 'pi pi-check'
  if (phase.status === 'failed') return 'pi pi-times'
  return `pi ${phase.icon}`
}

const getTaskIcon = (task) => {
  switch (task.status) {
    case 'running': return 'pi pi-spin pi-spinner'
    case 'completed': return 'pi pi-check'
    case 'failed': return 'pi pi-times'
    case 'skipped': return 'pi pi-minus'
    default: return 'pi pi-circle'
  }
}

const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}
</script>

<style scoped>
.research-progress {
  background: var(--surface-card);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: var(--shadow-2);
}

.research-progress.compact {
  padding: 0.75rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--surface-border);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-icon {
  font-size: 1.25rem;
  color: var(--primary-color);
}

.header-title {
  font-weight: 600;
  font-size: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.iteration-badge {
  background: var(--primary-100);
  color: var(--primary-700);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.phases-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.compact .phases-timeline {
  flex-direction: row;
  gap: 0.25rem;
}

.phase-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.compact .phase-item {
  flex-direction: column;
  align-items: center;
  flex: 1;
  text-align: center;
  padding: 0.5rem 0.25rem;
}

.phase-item.active {
  background: var(--primary-50);
}

.phase-item.completed {
  opacity: 0.8;
}

.phase-item.pending {
  opacity: 0.5;
}

.phase-item.failed {
  background: var(--red-50);
}

.phase-indicator {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-ground);
  flex-shrink: 0;
}

.compact .phase-indicator {
  width: 24px;
  height: 24px;
}

.phase-item.active .phase-indicator {
  background: var(--primary-color);
  color: white;
}

.phase-item.completed .phase-indicator {
  background: var(--green-500);
  color: white;
}

.phase-item.failed .phase-indicator {
  background: var(--red-500);
  color: white;
}

.phase-content {
  flex: 1;
  min-width: 0;
}

.phase-name {
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.compact .phase-name {
  font-size: 0.75rem;
  margin-bottom: 0;
}

.phase-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

.phase-result {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.phase-time {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.tasks-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-border);
}

.tasks-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--surface-ground);
  border-radius: 6px;
  font-size: 0.85rem;
}

.task-item.running {
  background: var(--primary-50);
}

.task-item.completed {
  opacity: 0.7;
}

.task-item.failed {
  background: var(--red-50);
}

.task-tool {
  font-weight: 500;
  color: var(--primary-color);
}

.task-desc {
  color: var(--text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--surface-border);
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.duration {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
</style>
