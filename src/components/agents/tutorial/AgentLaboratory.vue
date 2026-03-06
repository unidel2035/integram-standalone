<template>
  <div class="agent-laboratory">
    <div class="lab-grid">
      <!-- Settings Panel (Left) -->
      <div class="lab-column settings-column">
        <SettingsPanel :title="settingsTitle" :description="settingsDescription">
          <slot name="settings"></slot>
        </SettingsPanel>
      </div>

      <!-- Data Panel (Center) -->
      <div v-if="showDataPanel" class="lab-column data-column">
        <div class="data-panel">
          <div class="panel-header">
            <h3>{{ dataTitle }}</h3>
          </div>
          <div class="panel-body">
            <slot name="data"></slot>
          </div>
        </div>
      </div>

      <!-- Live Preview Panel (Right) -->
      <div class="lab-column preview-column">
        <LivePreview :is-updating="isUpdating" :execution-time="executionTime">
          <slot name="preview"></slot>
        </LivePreview>
      </div>
    </div>
  </div>
</template>

<script setup>
import SettingsPanel from './TutorialSettingsPanel.vue'
import LivePreview from './LivePreview.vue'

defineProps({
  settingsTitle: {
    type: String,
    default: 'Настройки'
  },
  settingsDescription: {
    type: String,
    default: ''
  },
  dataTitle: {
    type: String,
    default: 'Данные'
  },
  showDataPanel: {
    type: Boolean,
    default: true
  },
  isUpdating: {
    type: Boolean,
    default: false
  },
  executionTime: {
    type: Number,
    default: null
  }
})
</script>

<style scoped>
.agent-laboratory {
  width: 100%;
  padding: 24px;
  background: #f9fafb;
  border-radius: 12px;
}

.lab-grid {
  display: grid;
  grid-template-columns: 300px 1fr 1fr;
  gap: 20px;
  align-items: start;
}

.lab-grid.no-data {
  grid-template-columns: 350px 1fr;
}

.data-panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  height: fit-content;
}

.data-panel .panel-header {
  background-color: #f9fafb;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.data-panel .panel-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.data-panel .panel-body {
  padding: 16px;
}

@media (max-width: 1280px) {
  .lab-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .agent-laboratory {
    padding: 16px;
  }

  .lab-grid {
    gap: 16px;
  }
}
</style>
