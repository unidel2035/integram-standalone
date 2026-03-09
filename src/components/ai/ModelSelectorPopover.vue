<template>
  <Popover
    ref="panelRef"
    :dismissable="false"
    :auto-z-index="true"
    :base-z-index="9999"
    append-to="body"
  >
    <div class="model-popover-content" @click.stop @mousedown.stop>
      <div class="popover-header">
        <span class="popover-title">Выбор модели</span>
        <div class="popover-actions">
          <Button
            icon="pi pi-users"
            text
            size="small"
            @click.stop="openAgentsList"
            v-tooltip.top="'Агенты'"
          />
          <Button
            icon="pi pi-cog"
            text
            size="small"
            @click.stop="openSettings"
            v-tooltip.top="'Настройки'"
          />
          <Button
            icon="pi pi-times"
            text
            size="small"
            @click.stop="hide"
          />
        </div>
      </div>
      <ModelSelector
        :model-value="modelValue"
        application="Chat"
        :access-token="accessToken"
        :show-header="false"
        :show-token-info="false"
        :show-settings="false"
        label="AI Модель"
        dropdownAppendTo="body"
        @model-change="handleModelChange"
        @settings-change="handleSettingsChange"
      />
    </div>
  </Popover>
</template>

<script setup>
import { ref } from 'vue'
import ModelSelector from './ModelSelector.vue'

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    default: null
  }
})

const emit = defineEmits([
  'model-change',
  'settings-change',
  'show-agents',
  'show-settings'
])

const panelRef = ref(null)

const toggle = (event) => {
  panelRef.value?.toggle(event)
}

const hide = () => {
  panelRef.value?.hide()
}

const openAgentsList = () => {
  hide()
  emit('show-agents')
}

const openSettings = () => {
  hide()
  emit('show-settings')
}

const handleModelChange = (model) => {
  emit('model-change', model)
}

const handleSettingsChange = (settings) => {
  emit('settings-change', settings)
}

defineExpose({
  toggle,
  hide
})
</script>

<style scoped>
.model-popover-content {
  min-width: 350px;
  padding: 1rem;
  background: var(--surface-card);
}

.popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--surface-border);
}

.popover-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-color);
}

.popover-actions {
  display: flex;
  gap: 0.25rem;
}

.popover-actions :deep(.p-button) {
  width: 2rem;
  height: 2rem;
}
</style>
