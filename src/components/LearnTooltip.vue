<script setup>
import { computed } from 'vue'
import { useLearnModeStore } from '@/stores/learnModeStore'

const props = defineProps({
  // Basic tooltip (always shown)
  label: {
    type: String,
    required: true
  },
  // Educational mode properties
  what: {
    type: String,
    default: ''
  },
  when: {
    type: String,
    default: ''
  },
  terms: {
    type: Array,
    default: () => []
  },
  hotkey: {
    type: String,
    default: ''
  },
  // Manual position override
  position: {
    type: String,
    default: 'top',
    validator: (value) => ['top', 'bottom', 'left', 'right'].includes(value)
  }
})

const learnStore = useLearnModeStore()

const tooltipContent = computed(() => {
  // Basic mode: just show label
  if (!learnStore.isLearningMode) {
    return props.label
  }

  // Educational mode: show detailed info
  let content = `<div class="learn-tooltip-content">`

  if (props.label) {
    content += `<div class="learn-tooltip-title">${props.label}</div>`
  }

  if (props.what) {
    content += `<div class="learn-tooltip-section">
      <strong>Что делает:</strong> ${props.what}
    </div>`
  }

  if (props.when) {
    content += `<div class="learn-tooltip-section">
      <strong>Когда использовать:</strong> ${props.when}
    </div>`
  }

  if (props.terms && props.terms.length > 0) {
    content += `<div class="learn-tooltip-section">
      <strong>Связанные термины:</strong> ${props.terms.join(', ')}
    </div>`
  }

  if (props.hotkey) {
    content += `<div class="learn-tooltip-hotkey">
      <i class="pi pi-bolt"></i> ${props.hotkey}
    </div>`
  }

  content += `</div>`

  return content
})

const tooltipOptions = computed(() => {
  return {
    escape: false,
    value: tooltipContent.value
  }
})
</script>

<template>
  <div
    v-tooltip.[position]="tooltipOptions"
    class="learn-tooltip-wrapper"
  >
    <slot></slot>
  </div>
</template>

<style scoped>
.learn-tooltip-wrapper {
  display: inline-block;
}
</style>

<style>
/* Global styles for tooltip content (not scoped) */
.learn-tooltip-content {
  text-align: left;
  max-width: 320px;
}

.learn-tooltip-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--p-text-color);
}

.learn-tooltip-section {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.learn-tooltip-section strong {
  display: block;
  color: var(--p-primary-500);
  margin-bottom: 2px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.learn-tooltip-hotkey {
  margin-top: 8px;
  padding: 4px 8px;
  background: var(--p-surface-100);
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Courier New', monospace;
  color: var(--p-text-color);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.learn-tooltip-hotkey i {
  color: var(--p-yellow-500);
}

/* Dark mode adjustments */
:root.dark .learn-tooltip-hotkey {
  background: var(--p-surface-700);
}
</style>
