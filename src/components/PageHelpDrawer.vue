<script setup>
import { computed } from 'vue'
import Drawer from 'primevue/drawer'
import Button from 'primevue/button'
import Chip from 'primevue/chip'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  pageHelp: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:visible'])

const isOpen = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

function navigateTo(path) {
  window.location.href = path
}
</script>

<template>
  <Drawer
    v-model:visible="isOpen"
    position="right"
    :style="{ width: '360px' }"
    :dismissable="true"
    :modal="true"
    class="page-help-drawer"
  >
    <template #header>
      <div class="page-help-header">
        <i v-if="pageHelp?.icon" :class="['pi', pageHelp.icon]" style="font-size: 1.5rem; color: var(--p-primary-500);"></i>
        <span class="page-help-title">{{ pageHelp?.title || 'Помощь' }}</span>
      </div>
    </template>

    <div v-if="pageHelp" class="page-help-content">
      <!-- Что это -->
      <div class="page-help-section">
        <div class="page-help-section-title">
          <i class="pi pi-info-circle"></i>
          <span>Что это</span>
        </div>
        <p class="page-help-text">{{ pageHelp.description }}</p>
      </div>

      <!-- Как начать -->
      <div v-if="pageHelp.howToStart?.length" class="page-help-section">
        <div class="page-help-section-title">
          <i class="pi pi-play"></i>
          <span>Как начать</span>
        </div>
        <ol class="page-help-list">
          <li v-for="(step, index) in pageHelp.howToStart" :key="index">
            {{ step }}
          </li>
        </ol>
      </div>

      <!-- Типичные сценарии -->
      <div v-if="pageHelp.scenarios?.length" class="page-help-section">
        <div class="page-help-section-title">
          <i class="pi pi-bolt"></i>
          <span>Типичные сценарии</span>
        </div>
        <div class="page-help-scenarios">
          <div
            v-for="(scenario, index) in pageHelp.scenarios"
            :key="index"
            class="page-help-scenario"
          >
            <div class="page-help-scenario-name">{{ scenario.name }}</div>
            <div class="page-help-scenario-desc">{{ scenario.description }}</div>
          </div>
        </div>
      </div>

      <!-- Связанные модули -->
      <div v-if="pageHelp.relatedModules?.length" class="page-help-section">
        <div class="page-help-section-title">
          <i class="pi pi-link"></i>
          <span>Связанные модули</span>
        </div>
        <div class="page-help-modules">
          <Chip
            v-for="(module, index) in pageHelp.relatedModules"
            :key="index"
            :label="module.name"
            class="page-help-module-chip"
            @click="navigateTo(module.path)"
          >
            <template #icon>
              <i class="pi pi-arrow-right" style="font-size: 0.875rem;"></i>
            </template>
          </Chip>
        </div>
        <div class="page-help-flow">
          <span class="page-help-flow-text">
            {{ pageHelp.relatedModules.map(m => m.name).join(' → ') }}
          </span>
        </div>
      </div>
    </div>

    <div v-else class="page-help-empty">
      <i class="pi pi-question-circle" style="font-size: 3rem; color: var(--p-text-muted-color);"></i>
      <p>Справка для этой страницы пока не доступна</p>
    </div>
  </Drawer>
</template>

<style scoped>
.page-help-drawer {
  font-family: var(--p-font-family);
}

.page-help-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.page-help-title {
  font-size: 1.25rem;
  font-weight: 600;
}

.page-help-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 8px 0;
}

.page-help-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-help-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--p-primary-500);
}

.page-help-section-title i {
  font-size: 1rem;
}

.page-help-text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--p-text-color);
}

.page-help-list {
  margin: 0;
  padding-left: 20px;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--p-text-color);
}

.page-help-list li {
  margin-bottom: 8px;
}

.page-help-list li:last-child {
  margin-bottom: 0;
}

.page-help-scenarios {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-help-scenario {
  padding: 12px;
  background: var(--p-surface-50);
  border-radius: 6px;
  border-left: 3px solid var(--p-primary-500);
}

:root.dark .page-help-scenario {
  background: var(--p-surface-800);
}

.page-help-scenario-name {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--p-text-color);
}

.page-help-scenario-desc {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--p-text-muted-color);
}

.page-help-modules {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.page-help-module-chip {
  cursor: pointer;
  transition: all 0.2s;
}

.page-help-module-chip:hover {
  background: var(--p-primary-500);
  color: white;
}

.page-help-flow {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--p-surface-100);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  text-align: center;
}

:root.dark .page-help-flow {
  background: var(--p-surface-700);
}

.page-help-flow-text {
  font-family: 'Courier New', monospace;
}

.page-help-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 24px;
  text-align: center;
  color: var(--p-text-muted-color);
}

.page-help-empty p {
  margin: 0;
  font-size: 0.9375rem;
}
</style>
