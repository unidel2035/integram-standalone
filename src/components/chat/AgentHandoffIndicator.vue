<template>
  <div class="agent-handoff-indicator" :class="{ 'compact': compact, 'animated': animated }">
    <!-- Main handoff display -->
    <div class="handoff-content">
      <!-- From agent -->
      <div class="agent-card from-agent" :class="{ 'fading': animated }">
        <div class="agent-avatar">
          {{ fromAgent?.icon || '🤖' }}
        </div>
        <div class="agent-info">
          <span class="agent-name">{{ fromAgent?.name || 'Agent' }}</span>
          <span v-if="!compact" class="agent-role">{{ fromAgent?.role || 'AI Assistant' }}</span>
        </div>
      </div>

      <!-- Handoff animation -->
      <div class="handoff-arrow">
        <div class="arrow-line">
          <div v-if="animated" class="arrow-pulse"></div>
        </div>
        <i class="pi pi-arrow-right arrow-icon"></i>
      </div>

      <!-- To agent -->
      <div class="agent-card to-agent" :class="{ 'entering': animated }">
        <div class="agent-avatar">
          {{ toAgent?.icon || '🤖' }}
        </div>
        <div class="agent-info">
          <span class="agent-name">{{ toAgent?.name || 'Agent' }}</span>
          <span v-if="!compact" class="agent-role">{{ toAgent?.role || 'AI Assistant' }}</span>
        </div>
      </div>
    </div>

    <!-- Reason for handoff -->
    <div v-if="reason && !compact" class="handoff-reason">
      <i class="pi pi-info-circle"></i>
      <span>{{ reason }}</span>
    </div>

    <!-- Context being passed -->
    <div v-if="context && showContext && !compact" class="handoff-context">
      <Button
        :label="contextExpanded ? 'Hide context' : 'Show context'"
        :icon="contextExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
        text
        size="small"
        @click="contextExpanded = !contextExpanded"
      />
      <Transition name="slide">
        <div v-if="contextExpanded" class="context-content">
          <div v-for="(item, index) in contextItems" :key="index" class="context-item">
            <span class="context-key">{{ item.key }}:</span>
            <span class="context-value">{{ item.value }}</span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Timestamp -->
    <div v-if="timestamp" class="handoff-timestamp">
      <i class="pi pi-clock"></i>
      {{ formatTime(timestamp) }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Button from 'primevue/button'

const props = defineProps({
  fromAgent: {
    type: Object,
    default: () => ({ name: 'Agent', icon: '🤖' })
    // { id, name, icon, role }
  },
  toAgent: {
    type: Object,
    default: () => ({ name: 'Agent', icon: '🤖' })
  },
  reason: {
    type: String,
    default: ''
  },
  context: {
    type: Object,
    default: null
    // { key: value, ... } - context being passed
  },
  timestamp: {
    type: [Number, Date, String],
    default: null
  },
  animated: {
    type: Boolean,
    default: true
  },
  compact: {
    type: Boolean,
    default: false
  },
  showContext: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['click'])

const contextExpanded = ref(false)

// Computed
const contextItems = computed(() => {
  if (!props.context) return []
  return Object.entries(props.context).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value)
  }))
})

// Methods
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>

<style scoped>
.agent-handoff-indicator {
  background: linear-gradient(135deg,
    rgba(249, 115, 22, 0.05) 0%,
    rgba(234, 88, 12, 0.08) 100%
  );
  border: 1px solid rgba(249, 115, 22, 0.2);
  border-left: 3px solid var(--p-orange-500, #f97316);
  border-radius: 8px;
  padding: 1rem;
  margin: 0.5rem 0;
}

.agent-handoff-indicator.compact {
  padding: 0.5rem 0.75rem;
}

.handoff-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.agent-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface-card, #f7f7f5);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-width: 120px;
}

.compact .agent-card {
  padding: 0.25rem 0.5rem;
  min-width: auto;
}

.agent-avatar {
  font-size: 1.5rem;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-ground, var(--surface-ground));
  border-radius: 50%;
}

.compact .agent-avatar {
  width: 28px;
  height: 28px;
  font-size: 1.125rem;
}

.agent-info {
  display: flex;
  flex-direction: column;
}

.agent-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--p-text-color, var(--text-color));
}

.agent-role {
  font-size: 0.75rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
}

.handoff-arrow {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
  min-width: 60px;
}

.arrow-line {
  flex: 1;
  height: 2px;
  background: var(--p-orange-300, #fdba74);
  position: relative;
  overflow: hidden;
}

.arrow-pulse {
  position: absolute;
  top: -2px;
  left: -20px;
  width: 20px;
  height: 6px;
  background: linear-gradient(90deg,
    transparent,
    var(--p-orange-500, #f97316),
    transparent
  );
  animation: pulse-move 1.5s ease-in-out infinite;
}

@keyframes pulse-move {
  0% { left: -20px; }
  100% { left: 100%; }
}

.arrow-icon {
  color: var(--p-orange-500, #f97316);
  font-size: 1.25rem;
}

/* Animation states */
.agent-card.fading {
  animation: fade-out 0.5s ease-out forwards;
}

.agent-card.entering {
  animation: fade-in 0.5s ease-out forwards;
}

@keyframes fade-out {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.95); }
  100% { opacity: 0.7; transform: scale(1); }
}

@keyframes fade-in {
  0% { opacity: 0.5; transform: scale(0.95) translateX(-10px); }
  100% { opacity: 1; transform: scale(1) translateX(0); }
}

.handoff-reason {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed rgba(249, 115, 22, 0.2);
  font-size: 0.875rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  font-style: italic;
}

.handoff-reason i {
  color: var(--p-orange-500, #f97316);
}

.handoff-context {
  margin-top: 0.5rem;
}

.context-content {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: var(--surface-ground, var(--surface-ground));
  border-radius: 6px;
}

.context-item {
  display: flex;
  gap: 0.5rem;
  margin: 0.25rem 0;
  font-size: 0.8125rem;
}

.context-key {
  font-weight: 500;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
}

.context-value {
  color: var(--p-text-color, var(--text-color));
  word-break: break-word;
}

.handoff-timestamp {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
}

/* Transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}

/* Dark mode */
:root.dark .agent-handoff-indicator,
.p-dark .agent-handoff-indicator {
  background: linear-gradient(135deg,
    rgba(249, 115, 22, 0.1) 0%,
    rgba(234, 88, 12, 0.15) 100%
  );
}

:root.dark .agent-card,
.p-dark .agent-card {
  background: var(--surface-ground, var(--surface-ground));
}
</style>
