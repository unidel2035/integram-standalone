<template>
  <Transition name="slide-up">
    <div class="agent-status-bar" v-if="isVisible" role="status" aria-live="polite">
      <div class="status-content">
        <!-- Status icon -->
        <div class="status-icon" :class="statusClass">
          <i :class="currentIcon"></i>
        </div>

        <!-- Status message -->
        <div class="status-message">
          <span class="phase-label" v-if="phase">{{ phaseLabel }}</span>
          <span class="message-text">{{ message }}</span>
        </div>

        <!-- Progress bar (if available) -->
        <div class="status-progress" v-if="progress !== null">
          <ProgressBar
            :value="progress"
            :showValue="false"
            class="mini-progress"
          />
          <span class="progress-text">{{ progress }}%</span>
        </div>

        <!-- Cancel button (optional) -->
        <Button
          v-if="showCancel"
          icon="pi pi-times"
          text
          rounded
          size="small"
          severity="secondary"
          class="cancel-btn"
          @click="$emit('cancel')"
          v-tooltip.bottom="'Отменить'"
        />
      </div>

      <!-- Sources preview (for web research) -->
      <div class="sources-preview" v-if="sources && sources.length > 0">
        <span class="sources-label">
          <i class="pi pi-link"></i>
          {{ sources.length }} источников найдено
        </span>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  phase: {
    type: String,
    default: '' // 'scout', 'search', 'table', 'generate', 'write', 'verify'
  },
  message: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '' // Custom icon override
  },
  progress: {
    type: Number,
    default: null // 0-100, null if indeterminate
  },
  sources: {
    type: Array,
    default: () => []
  },
  showCancel: {
    type: Boolean,
    default: false
  }
})

defineEmits(['cancel'])

// Phase icon mapping
const phaseIcons = {
  scout: 'pi pi-search',
  search: 'pi pi-globe',
  table: 'pi pi-table',
  generate: 'pi pi-pencil',
  write: 'pi pi-save',
  verify: 'pi pi-check-circle',
  thinking: 'pi pi-lightbulb',
  planning: 'pi pi-sitemap',
  executing: 'pi pi-cog',
  default: 'pi pi-spin pi-spinner'
}

// Phase labels in Russian
const phaseLabels = {
  scout: 'Анализ',
  search: 'Поиск',
  table: 'Таблица',
  generate: 'Генерация',
  write: 'Запись',
  verify: 'Проверка',
  thinking: 'Размышление',
  planning: 'Планирование',
  executing: 'Выполнение'
}

const currentIcon = computed(() => {
  if (props.icon) return props.icon
  return phaseIcons[props.phase] || phaseIcons.default
})

const phaseLabel = computed(() => {
  return phaseLabels[props.phase] || props.phase
})

const statusClass = computed(() => {
  return {
    [`phase-${props.phase}`]: props.phase,
    'spinning': !props.phase || props.phase === 'executing'
  }
})
</script>

<style scoped>
.agent-status-bar {
  background: linear-gradient(135deg,
    rgba(168, 85, 247, 0.08) 0%,
    rgba(139, 92, 246, 0.12) 100%
  );
  border-top: 1px solid rgba(168, 85, 247, 0.2);
  padding: 0.625rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--p-purple-500, #a855f7);
  color: white;
  font-size: 0.875rem;
  flex-shrink: 0;
  transition: background 0.3s ease;
}

.status-icon.spinning i {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Phase-specific colors */
.status-icon.phase-scout {
  background: var(--p-blue-500, #3b82f6);
}

.status-icon.phase-search {
  background: var(--p-orange-500, #f97316);
}

.status-icon.phase-table {
  background: var(--p-green-500, #22c55e);
}

.status-icon.phase-generate {
  background: var(--p-purple-500, #a855f7);
}

.status-icon.phase-write {
  background: var(--p-teal-500, #14b8a6);
}

.status-icon.phase-verify {
  background: var(--p-emerald-500, #10b981);
}

.status-icon.phase-thinking {
  background: var(--p-amber-500, #f59e0b);
}

.status-icon.phase-planning {
  background: var(--p-indigo-500, #6366f1);
}

.status-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.phase-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.125rem 0.5rem;
  background: rgba(168, 85, 247, 0.15);
  color: var(--p-purple-600, #9333ea);
  border-radius: 12px;
  flex-shrink: 0;
}

:root.dark .phase-label,
.p-dark .phase-label {
  color: var(--p-purple-300, #c4b5fd);
}

.message-text {
  font-size: 0.8125rem;
  color: var(--p-text-color, var(--text-color));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.mini-progress {
  width: 60px;
  height: 6px;
}

.mini-progress :deep(.p-progressbar-value) {
  background: linear-gradient(90deg, var(--p-purple-500, #a855f7), var(--p-violet-500, #8b5cf6));
}

.progress-text {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--p-purple-600, #9333ea);
  min-width: 32px;
  text-align: right;
}

:root.dark .progress-text,
.p-dark .progress-text {
  color: var(--p-purple-300, #c4b5fd);
}

.cancel-btn {
  flex-shrink: 0;
  width: 1.75rem !important;
  height: 1.75rem !important;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
}

.cancel-btn:hover {
  color: var(--p-red-500, #ef4444);
  background: rgba(239, 68, 68, 0.1);
}

.sources-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.375rem;
  border-top: 1px dashed rgba(168, 85, 247, 0.2);
}

.sources-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
}

.sources-label i {
  color: var(--p-purple-500, #a855f7);
}

/* Slide up transition */
.slide-up-enter-active {
  transition: all 0.3s ease-out;
}

.slide-up-leave-active {
  transition: all 0.2s ease-in;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>
