<template>
  <div class="agent-timeline">
    <div class="timeline-header">
      <h3>График активности агентов</h3>
      <div class="timeline-controls">
        <span class="current-time">{{ formatDuration(currentTime) }}</span>
      </div>
    </div>

    <div class="timeline-container">
      <!-- Time ruler -->
      <div class="time-ruler">
        <div
          v-for="tick in timeTicks"
          :key="tick"
          class="time-tick"
          :style="{ left: (tick / totalDuration) * 100 + '%' }"
        >
          <span>{{ formatDuration(tick) }}</span>
        </div>
      </div>

      <!-- Agent rows -->
      <div class="timeline-rows">
        <div v-for="agent in agents" :key="agent.id" class="timeline-row">
          <div class="agent-label" :style="{ color: agent.color }">
            <i :class="agent.icon"></i>
            <span>{{ agent.name }}</span>
          </div>
          <div class="timeline-track">
            <!-- Activity bars -->
            <div
              v-for="activity in agent.activities"
              :key="activity.id"
              class="activity-bar"
              :class="[
                'status-' + activity.status,
                { active: isActive(activity), pulse: activity.status === 'running' }
              ]"
              :style="{
                left: (activity.startTime / totalDuration) * 100 + '%',
                width: ((activity.endTime - activity.startTime) / totalDuration) * 100 + '%',
                background: getActivityColor(activity)
              }"
              title="getActivityTooltip(activity)"
              @click="selectActivity(activity, agent)"
            >
              <div class="activity-label">
                {{ activity.label }}
              </div>
              <div v-if="activity.progress !== undefined" class="activity-progress">
                <div class="progress-fill" :style="{ width: activity.progress + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Current time indicator -->
      <div class="current-time-indicator" :style="{ left: (currentTime / totalDuration) * 100 + '%' }">
        <div class="indicator-line"></div>
        <div class="indicator-dot"></div>
      </div>
    </div>

    <!-- Legend -->
    <div class="timeline-legend">
      <div class="legend-item">
        <div class="legend-color status-idle"></div>
        <span>Ожидает</span>
      </div>
      <div class="legend-item">
        <div class="legend-color status-running"></div>
        <span>Работает</span>
      </div>
      <div class="legend-item">
        <div class="legend-color status-completed"></div>
        <span>Завершён</span>
      </div>
      <div class="legend-item">
        <div class="legend-color status-error"></div>
        <span>Ошибка</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  agents: {
    type: Array,
    required: true
  },
  currentTime: {
    type: Number,
    default: 0
  },
  totalDuration: {
    type: Number,
    default: 10000
  },
  autoUpdate: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['activity-selected', 'time-changed'])

const selectedActivity = ref(null)

// Generate time ticks (every 2 seconds)
const timeTicks = computed(() => {
  const ticks = []
  const interval = 2000 // 2 seconds
  for (let i = 0; i <= props.totalDuration; i += interval) {
    ticks.push(i)
  }
  return ticks
})

// Format duration to MM:SS
const formatDuration = (ms) => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// Check if activity is currently active
const isActive = (activity) => {
  return (
    props.currentTime >= activity.startTime &&
    props.currentTime <= activity.endTime &&
    activity.status === 'running'
  )
}

// Get activity color based on status
const getActivityColor = (activity) => {
  const colors = {
    idle: '#9CA3AF',
    running: '#10B981',
    completed: '#3B82F6',
    error: '#EF4444',
    warning: '#F59E0B'
  }
  return colors[activity.status] || colors.idle
}

// Get tooltip for activity
const getActivityTooltip = (activity) => {
  const duration = ((activity.endTime - activity.startTime) / 1000).toFixed(1)
  let text = `${activity.label}\n`
  text += `Старт: ${formatDuration(activity.startTime)}\n`
  text += `Длительность: ${duration}s\n`
  text += `Статус: ${activity.status}`

  if (activity.progress !== undefined) {
    text += `\nПрогресс: ${activity.progress}%`
  }

  return text
}

// Select activity
const selectActivity = (activity, agent) => {
  selectedActivity.value = { ...activity, agent }
  emit('activity-selected', { activity, agent })
}
</script>

<style scoped>
.agent-timeline {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.timeline-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
}

.current-time {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 1.125rem;
  font-weight: 600;
  color: #3B82F6;
}

.timeline-container {
  position: relative;
  margin-bottom: 1.5rem;
}

.time-ruler {
  position: relative;
  height: 30px;
  border-bottom: 2px solid #E5E7EB;
  margin-bottom: 1rem;
}

.time-tick {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.time-tick::before {
  content: '';
  width: 2px;
  height: 10px;
  background: #9CA3AF;
  margin-bottom: 4px;
}

.time-tick span {
  font-size: 0.75rem;
  color: #6B7280;
  font-family: 'Consolas', 'Monaco', monospace;
}

.timeline-rows {
  position: relative;
}

.timeline-row {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 1rem;
  margin-bottom: 0.75rem;
  align-items: center;
}

.agent-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.5rem;
  background: #F9FAFB;
  border-radius: 6px;
}

.agent-label i {
  font-size: 1.125rem;
}

.timeline-track {
  position: relative;
  height: 40px;
  background: #F9FAFB;
  border-radius: 6px;
  overflow: visible;
}

.activity-bar {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.activity-bar:hover {
  transform: translateY(-50%) scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.activity-bar.pulse {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.activity-label {
  position: absolute;
  top: 50%;
  left: 8px;
  transform: translateY(-50%);
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 16px);
}

.activity-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: rgba(0, 0, 0, 0.2);
}

.progress-fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.5);
  transition: width 0.3s ease;
}

.current-time-indicator {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  z-index: 20;
  pointer-events: none;
  transition: left 0.1s linear;
}

.indicator-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  background: #3B82F6;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
}

.indicator-dot {
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background: #3B82F6;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.timeline-legend {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  padding-top: 1rem;
  border-top: 1px solid #E5E7EB;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6B7280;
}

.legend-color {
  width: 20px;
  height: 12px;
  border-radius: 3px;
}

.legend-color.status-idle {
  background: #9CA3AF;
}

.legend-color.status-running {
  background: #10B981;
}

.legend-color.status-completed {
  background: #3B82F6;
}

.legend-color.status-error {
  background: #EF4444;
}

@media (max-width: 768px) {
  .timeline-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .agent-label {
    font-size: 0.8125rem;
  }

  .time-tick span {
    font-size: 0.6875rem;
  }

  .timeline-legend {
    flex-wrap: wrap;
    gap: 1rem;
  }
}
</style>
