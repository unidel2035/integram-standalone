<template>
  <!-- Issue #4987: Comparison bar for selected agents -->
  <div v-if="selectedAgents.length > 0" class="agent-compare-bar">
    <div class="compare-bar-content">
      <div class="selected-count">
        <i class="pi pi-check-circle" />
        <span>{{ $t('agentCompare.selected', { count: selectedAgents.length }) }}</span>
      </div>

      <div class="selected-agents-preview">
        <div
          v-for="agent in selectedAgents.slice(0, 3)"
          :key="agent.id"
          class="agent-chip"
        >
          <span class="agent-icon">{{ agent.icon }}</span>
          <span class="agent-name">{{ agent.name }}</span>
          <Button
            icon="pi pi-times"
            class="p-button-rounded p-button-text p-button-sm"
            @click="$emit('remove', agent)"
          />
        </div>
        <div v-if="selectedAgents.length > 3" class="more-agents">
          +{{ selectedAgents.length - 3 }} {{ $t('agentCompare.more') }}
        </div>
      </div>

      <div class="compare-actions">
        <Button
          :label="$t('agentCompare.clear')"
          icon="pi pi-trash"
          class="p-button-text p-button-sm"
          @click="$emit('clear')"
        />
        <Button
          :label="$t('agentCompare.compare')"
          icon="pi pi-chart-bar"
          class="p-button-primary p-button-sm"
          :disabled="selectedAgents.length < 2"
          @click="$emit('compare')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  selectedAgents: {
    type: Array,
    required: true,
    default: () => []
  }
})

const emit = defineEmits(['remove', 'clear', 'compare'])
</script>

<style scoped>
.agent-compare-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface-card);
  border-top: 2px solid var(--primary-color);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.compare-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
  gap: 1rem;
  flex-wrap: wrap;
}

.selected-count {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--primary-color);
}

.selected-count i {
  font-size: 1.2rem;
}

.selected-agents-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  overflow-x: auto;
  padding: 0.25rem 0;
}

.agent-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--surface-100);
  border: 1px solid var(--surface-border);
  border-radius: 20px;
  padding: 0.5rem 0.75rem;
  white-space: nowrap;
}

.agent-chip .agent-icon {
  font-size: 1.2rem;
}

.agent-chip .agent-name {
  font-size: 0.875rem;
  font-weight: 500;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-agents {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  padding: 0.5rem;
}

.compare-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

@media (max-width: 768px) {
  .compare-bar-content {
    flex-direction: column;
    align-items: stretch;
    padding: 1rem;
  }

  .selected-agents-preview {
    order: 2;
  }

  .compare-actions {
    order: 3;
    justify-content: flex-end;
  }
}
</style>
