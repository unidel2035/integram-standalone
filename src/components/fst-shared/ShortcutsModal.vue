<template>
  <Dialog
    v-model:visible="visible"
    modal
    :closable="true"
    :dismissable-mask="true"
    :style="{ width: 'min(95vw, 680px)' }"
    class="shortcuts-dialog"
  >
    <template #header>
      <div class="shortcuts-dialog-header">
        <i class="pi pi-desktop shortcuts-header-icon" />
        <span class="shortcuts-header-title">Горячие клавиши</span>
        <span class="shortcuts-header-badge">⌨️</span>
      </div>
    </template>

    <!-- Подсказка дня -->
    <div class="shortcuts-tip">
      <i class="pi pi-lightbulb shortcuts-tip-icon" />
      <span><strong>Подсказка дня:</strong>
        <kbd class="shortcuts-kbd">{{ shortcutOfTheDay.keys }}</kbd>
        — {{ shortcutOfTheDay.label }}
      </span>
    </div>

    <!-- Прогресс: сколько шорткатов использовано -->
    <div class="shortcuts-progress">
      <span class="shortcuts-progress-label">
        Использовано: {{ usedCount }} / {{ totalCount }}
        <span v-if="isNinja" class="shortcuts-ninja">⌨️ Клавиатурный ниндзя!</span>
      </span>
      <div class="shortcuts-progress-bar">
        <div class="shortcuts-progress-fill" :style="{ width: progressPct + '%' }" />
      </div>
    </div>

    <!-- Глобальные шорткаты -->
    <div class="shortcuts-section">
      <div v-for="group in globalGroups" :key="group.name" class="shortcuts-group">
        <div class="shortcuts-group-title">{{ group.name }}</div>
        <div class="shortcuts-list">
          <div
            v-for="s in group.items"
            :key="s.id"
            class="shortcuts-item"
            :class="{ 'shortcuts-item--used': usedSet.has(s.id) }"
          >
            <kbd class="shortcuts-kbd">{{ s.keys }}</kbd>
            <span class="shortcuts-item-label">{{ s.label }}</span>
            <i v-if="usedSet.has(s.id)" class="pi pi-check shortcuts-item-check" />
          </div>
        </div>
      </div>
    </div>

    <!-- Контекстные шорткаты (текущая страница) -->
    <div v-if="contextShortcuts.length" class="shortcuts-section">
      <div class="shortcuts-group">
        <div class="shortcuts-group-title">
          <i class="pi pi-map-marker" style="font-size:0.8rem;margin-right:4px;" />
          Текущая страница
        </div>
        <div class="shortcuts-list">
          <div
            v-for="s in contextShortcuts"
            :key="s.id"
            class="shortcuts-item"
            :class="{ 'shortcuts-item--used': usedSet.has(s.id) }"
          >
            <kbd class="shortcuts-kbd">{{ s.keys }}</kbd>
            <span class="shortcuts-item-label">{{ s.label }}</span>
            <i v-if="usedSet.has(s.id)" class="pi pi-check shortcuts-item-check" />
          </div>
        </div>
      </div>
    </div>

    <!-- Footer hint -->
    <div class="shortcuts-footer">
      Нажмите <kbd class="shortcuts-kbd">?</kbd> чтобы открыть/закрыть эту панель &nbsp;·&nbsp;
      <kbd class="shortcuts-kbd">Esc</kbd> для закрытия
    </div>
  </Dialog>
</template>

<script setup>
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import { useRoute } from 'vue-router'
import {
  GLOBAL_SHORTCUTS,
  CONTEXT_SHORTCUTS,
  shortcutOfTheDay,
  useKeyboardShortcuts,
} from '@/composables/useKeyboardShortcuts'

const route = useRoute()
const { isShortcutsModalOpen, getUsedShortcuts } = useKeyboardShortcuts()

// Two-way bind to composable state
const visible = computed({
  get: () => isShortcutsModalOpen.value,
  set: (v) => { isShortcutsModalOpen.value = v },
})

// Group global shortcuts by group name
const globalGroups = computed(() => {
  const map = {}
  for (const s of GLOBAL_SHORTCUTS) {
    if (!map[s.group]) map[s.group] = { name: s.group, items: [] }
    map[s.group].items.push(s)
  }
  return Object.values(map)
})

// Context-aware shortcuts for current route
const contextShortcuts = computed(() => {
  return CONTEXT_SHORTCUTS[route.path] || []
})

// Progress tracking
const usedSet = computed(() => new Set(getUsedShortcuts()))
const usedCount = computed(() => usedSet.value.size)
const totalCount = computed(() => GLOBAL_SHORTCUTS.length + contextShortcuts.value.length)
const progressPct = computed(() => Math.min(100, Math.round((usedCount.value / totalCount.value) * 100)))
const isNinja = computed(() => usedCount.value >= 10)
</script>

<style scoped>
.shortcuts-dialog-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shortcuts-header-icon {
  font-size: 1.1rem;
  color: var(--p-primary-color);
}

.shortcuts-header-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.shortcuts-header-badge {
  font-size: 1.1rem;
  margin-left: 4px;
}

/* Подсказка дня */
.shortcuts-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
  font-size: 0.88rem;
  color: var(--p-text-color);
}

.shortcuts-tip-icon {
  color: var(--p-primary-color);
  font-size: 1rem;
  flex-shrink: 0;
}

/* Progress bar */
.shortcuts-progress {
  margin-bottom: 16px;
}

.shortcuts-progress-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
}

.shortcuts-ninja {
  color: var(--p-primary-color);
  font-weight: 600;
  font-size: 0.82rem;
}

.shortcuts-progress-bar {
  height: 4px;
  background: var(--p-content-border-color);
  border-radius: 4px;
  overflow: hidden;
}

.shortcuts-progress-fill {
  height: 100%;
  background: var(--p-primary-color);
  border-radius: 4px;
  transition: width 0.4s ease;
}

/* Sections */
.shortcuts-section {
  margin-bottom: 16px;
}

.shortcuts-group {
  margin-bottom: 12px;
}

.shortcuts-group-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 0 6px;
  border-bottom: 1px solid var(--p-content-border-color);
  margin-bottom: 6px;
}

.shortcuts-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 4px;
}

.shortcuts-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}

.shortcuts-item:hover {
  background: var(--p-surface-card);
}

.shortcuts-item--used {
  opacity: 0.75;
}

.shortcuts-item-label {
  flex: 1;
  font-size: 0.85rem;
  color: var(--p-text-color);
}

.shortcuts-item-check {
  font-size: 0.75rem;
  color: var(--p-primary-color);
  flex-shrink: 0;
}

/* Keyboard key badges */
.shortcuts-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 22px;
  padding: 0 6px;
  font-size: 0.78rem;
  font-family: 'ui-monospace', 'SFMono-Regular', 'Consolas', monospace;
  font-weight: 600;
  color: var(--p-text-color);
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-bottom-width: 2px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1;
}

/* Footer */
.shortcuts-footer {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  text-align: center;
  padding-top: 12px;
  border-top: 1px solid var(--p-content-border-color);
  margin-top: 4px;
}

@media (max-width: 600px) {
  .shortcuts-list {
    grid-template-columns: 1fr;
  }
}
</style>
