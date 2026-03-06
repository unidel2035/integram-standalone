<template>
  <div class="agent-monitor-panel">
    <div class="panel-header">
      <h3>Активные агенты</h3>
    </div>

    <div class="agents-list">
      <div
        v-for="agent in agents"
        :key="agent.id"
        class="agent-item"
        :class="['status-' + agent.status, { highlighted: agent.id === highlightedAgent }]"
        @click="selectAgent(agent)"
      >
        <div class="agent-status-icon">
          <span>{{ getStatusIcon(agent.status) }}</span>
        </div>
        <div class="agent-info">
          <div class="agent-name">{{ agent.name }}</div>
          <div class="agent-type">{{ agent.type }}</div>
        </div>
        <div class="agent-progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :class="'status-' + agent.status"
              :style="{ width: (agent.progress || 0) + '%' }"
            ></div>
          </div>
          <div class="progress-text">{{ agent.progress || 0 }}%</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  agents: {
    type: Array,
    default: () => []
  },
  highlightedAgent: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['agent-selected'])

const getStatusIcon = (status) => {
  const icons = {
    idle: '⚪',
    running: '🟢',
    completed: '✅',
    error: '🔴',
    warning: '🟡',
    stopped: '⚫'
  }
  return icons[status] || '⚪'
}

const selectAgent = (agent) => {
  emit('agent-selected', agent)
}
</script>

<style scoped>
.agent-monitor-panel {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
}

.panel-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1f2937;
}

.agents-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

.agents-list::-webkit-scrollbar {
  width: 6px;
}

.agents-list::-webkit-scrollbar-track {
  background: #f9fafb;
}

.agents-list::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.agent-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.agent-item:hover {
  background: #f3f4f6;
  transform: translateX(4px);
}

.agent-item.highlighted {
  background: #eff6ff;
  border-color: #3b82f6;
}

.agent-item.status-running {
  animation: pulse-border 2s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% {
    border-color: transparent;
  }
  50% {
    border-color: #10b98150;
  }
}

.agent-status-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-type {
  font-size: 0.8125rem;
  color: #6b7280;
}

.agent-progress {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 80px;
}

.progress-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 3px;
}

.progress-fill.status-idle {
  background: #9ca3af;
}

.progress-fill.status-running {
  background: #10b981;
  animation: progress-shimmer 1.5s ease-in-out infinite;
}

.progress-fill.status-completed {
  background: #3b82f6;
}

.progress-fill.status-error {
  background: #ef4444;
}

.progress-fill.status-warning {
  background: #f59e0b;
}

@keyframes progress-shimmer {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.progress-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-align: right;
  font-family: 'Consolas', 'Monaco', monospace;
}

@media (max-width: 768px) {
  .agent-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .agent-progress {
    width: 100%;
  }
}
</style>
