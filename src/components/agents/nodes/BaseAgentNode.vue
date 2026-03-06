<template>
  <div :class="nodeClasses" :style="nodeStyles">
    <Handle v-if="showTargetHandle" type="target" :position="Position.Top" />
    <div class="agent-node-content">
      <div class="agent-node-header">
        <i :class="icon" class="agent-icon" />
        <span class="agent-type">{{ label }}</span>
        <div class="agent-status" :class="`status-${status}`" v-if="status">
          <i :class="statusIcon" />
        </div>
      </div>
      <div class="agent-node-body">
        <div class="agent-description" v-if="description">{{ description }}</div>
        <slot name="config"></slot>
      </div>
    </div>
    <Handle v-if="showSourceHandle" type="source" :position="Position.Bottom" />
  </div>
</template>

<script setup>
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  label: {
    type: String,
    default: 'Agent'
  },
  icon: {
    type: String,
    default: 'pi pi-android'
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    default: null // 'running', 'idle', 'error', 'stopped'
  },
  showSourceHandle: {
    type: Boolean,
    default: true
  },
  showTargetHandle: {
    type: Boolean,
    default: true
  },
  color: {
    type: String,
    default: '#6366f1'
  }
})

const nodeClasses = computed(() => [
  'base-agent-node',
  props.data.selected ? 'selected' : '',
  props.status ? `status-${props.status}` : ''
])

const nodeStyles = computed(() => ({
  borderColor: props.color,
  '--agent-color': props.color
}))

const statusIcon = computed(() => {
  switch (props.status) {
    case 'running':
      return 'pi pi-spin pi-spinner'
    case 'error':
      return 'pi pi-exclamation-circle'
    case 'stopped':
      return 'pi pi-stop-circle'
    default:
      return 'pi pi-circle'
  }
})
</script>

<style scoped lang="scss">
.base-agent-node {
  background: var(--surface-card);
  border: 2px solid;
  border-radius: var(--content-border-radius);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-width: 200px;
  max-width: 300px;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }

  &.selected {
    border-width: 3px;
    box-shadow: 0 0 0 3px rgba(var(--agent-color), 0.2);
  }
}

.agent-node-content {
  padding: 12px;
}

.agent-node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--text-color);
}

.agent-icon {
  font-size: 1.2rem;
  color: var(--agent-color);
}

.agent-type {
  font-weight: 600;
  font-size: 0.9rem;
  flex: 1;
}

.agent-status {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.7rem;

  &.status-running {
    color: var(--green-500);
    background: var(--green-50);
  }

  &.status-error {
    color: var(--red-500);
    background: var(--red-50);
  }

  &.status-stopped {
    color: var(--gray-500);
    background: var(--gray-50);
  }

  &.status-idle {
    color: var(--blue-500);
    background: var(--blue-50);
  }
}

.agent-node-body {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.agent-description {
  margin-bottom: 8px;
  font-size: 0.8rem;
  line-height: 1.4;
}
</style>
