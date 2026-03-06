<template>
  <div v-if="status && status !== 'skipped'" class="sgr-status-badge" :class="statusClass">
    <span class="sgr-icon" v-tooltip.top="tooltipText">
      <i :class="iconClass"></i>
      <span v-if="showLabel" class="sgr-label">{{ statusLabel }}</span>
    </span>

    <!-- Fixes popup on hover -->
    <div v-if="fixes && fixes.length > 0" class="sgr-fixes-popup">
      <div class="sgr-fixes-header">
        <i class="pi pi-wrench"></i>
        Auto-fixes applied:
      </div>
      <ul class="sgr-fixes-list">
        <li v-for="(fix, index) in fixes" :key="index">{{ fix }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    default: null,
    validator: (value) => ['valid', 'fixed', 'invalid', 'error', 'skipped', null].includes(value)
  },
  fixes: {
    type: Array,
    default: () => []
  },
  showLabel: {
    type: Boolean,
    default: false
  }
})

const statusClass = computed(() => {
  switch (props.status) {
    case 'valid':
      return 'sgr-valid'
    case 'fixed':
      return 'sgr-fixed'
    case 'invalid':
      return 'sgr-invalid'
    case 'error':
      return 'sgr-error'
    default:
      return ''
  }
})

const iconClass = computed(() => {
  switch (props.status) {
    case 'valid':
      return 'pi pi-check-circle'
    case 'fixed':
      return 'pi pi-wrench'
    case 'invalid':
      return 'pi pi-times-circle'
    case 'error':
      return 'pi pi-exclamation-triangle'
    default:
      return ''
  }
})

const statusLabel = computed(() => {
  switch (props.status) {
    case 'valid':
      return 'Validated'
    case 'fixed':
      return 'Auto-fixed'
    case 'invalid':
      return 'Invalid'
    case 'error':
      return 'Error'
    default:
      return ''
  }
})

const tooltipText = computed(() => {
  switch (props.status) {
    case 'valid':
      return 'SGR: Response validated successfully'
    case 'fixed':
      return `SGR: Response auto-fixed (${props.fixes?.length || 0} fixes applied)`
    case 'invalid':
      return 'SGR: Response validation failed'
    case 'error':
      return 'SGR: Validation error occurred'
    default:
      return ''
  }
})
</script>

<style scoped>
.sgr-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  position: relative;
}

.sgr-icon {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sgr-label {
  font-weight: 500;
}

/* Status colors */
.sgr-valid {
  background-color: rgba(76, 175, 80, 0.15);
  color: #4caf50;
}

.sgr-fixed {
  background-color: rgba(255, 152, 0, 0.15);
  color: #ff9800;
}

.sgr-invalid {
  background-color: rgba(244, 67, 54, 0.15);
  color: #f44336;
}

.sgr-error {
  background-color: rgba(156, 39, 176, 0.15);
  color: #9c27b0;
}

/* Fixes popup */
.sgr-fixes-popup {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 0;
  min-width: 250px;
  max-width: 400px;
  background: var(--surface-card, #1e1e1e);
  border: 1px solid var(--surface-border, #333);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  margin-bottom: 8px;
}

.sgr-fixed:hover .sgr-fixes-popup {
  display: block;
}

.sgr-fixes-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #ff9800;
}

.sgr-fixes-list {
  margin: 0;
  padding-left: 20px;
  font-size: 0.85rem;
  color: var(--text-color-secondary, #888);
}

.sgr-fixes-list li {
  margin-bottom: 4px;
}
</style>
