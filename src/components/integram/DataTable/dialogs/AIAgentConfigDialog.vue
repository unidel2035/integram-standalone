<template>
  <Dialog
    :visible="visible"
    header="⚙️ Настройка AI Агента"
    :style="{ width: '650px' }"
    :modal="true"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="ai-agent-config">
      <!-- Model Selection -->
      <div class="field mb-4">
        <label class="block mb-2 font-semibold text-sm">
          <i class="pi pi-android mr-2"></i>Модель AI
        </label>
        <Dropdown
          v-model="localConfig.model"
          :options="availableModels"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите модель"
          class="w-full"
        />
        <small class="text-color-secondary mt-1 block">
          По умолчанию: Kodacode/KodaAgent
        </small>
      </div>

      <!-- Prompt Template -->
      <div class="field mb-4">
        <label class="block mb-2 font-semibold text-sm">
          <i class="pi pi-comment mr-2"></i>Промпт
        </label>
        <Textarea
          v-model="localConfig.prompt"
          rows="6"
          placeholder="Введите промпт для AI. Используйте плейсхолдеры для подстановки данных строки."
          class="w-full font-mono"
          autoResize
        />

        <!-- Available Placeholders -->
        <div class="placeholders-section mt-2">
          <div class="placeholders-label mb-2">
            <i class="pi pi-tags"></i>
            <span>Доступные плейсхолдеры:</span>
          </div>
          <div class="placeholders-list">
            <Tag
              v-for="ph in availablePlaceholders"
              :key="ph.value"
              :value="ph.value"
              severity="secondary"
              class="placeholder-tag cursor-pointer"
              @click="insertPlaceholder(ph.value)"
              v-tooltip.top="ph.label"
            />
          </div>
        </div>
      </div>

      <!-- Output Field -->
      <div class="field mb-4">
        <label class="block mb-2 font-semibold text-sm">
          <i class="pi pi-pencil mr-2"></i>Записать результат в поле
        </label>
        <Dropdown
          v-model="localConfig.outputField"
          :options="outputFieldOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите поле (опционально)"
          class="w-full"
          showClear
        />
        <small class="text-color-secondary mt-1 block">
          Если не выбрано, результат будет показан в уведомлении
        </small>
      </div>

      <!-- Web Search Toggle (Issue #6607) -->
      <div class="field mb-4">
        <div class="web-search-toggle-section p-3">
          <div class="flex align-items-center justify-content-between">
            <div class="flex align-items-center gap-2">
              <i class="pi pi-globe text-blue-500"></i>
              <div>
                <label class="font-semibold text-sm block">Веб-поиск (Tavily)</label>
                <small class="text-color-secondary">
                  AI сможет искать актуальную информацию в интернете
                </small>
              </div>
            </div>
            <InputSwitch v-model="localConfig.useWebSearch" />
          </div>
          <div v-if="localConfig.useWebSearch" class="web-search-info mt-3">
            <Message severity="info" :closable="false">
              <template #default>
                <div class="text-sm">
                  <strong>Веб-поиск позволяет:</strong>
                  <ul class="mt-2 mb-0 pl-4">
                    <li>Получать актуальные данные из интернета</li>
                    <li>Искать информацию по запросам</li>
                    <li>Использовать Tavily Search API</li>
                  </ul>
                </div>
              </template>
            </Message>
          </div>
        </div>
      </div>

      <!-- MCP Mode Toggle (Issue #6547) -->
      <div class="field mb-4">
        <div class="mcp-toggle-section p-3">
          <div class="flex align-items-center justify-content-between">
            <div class="flex align-items-center gap-2">
              <i class="pi pi-database text-primary"></i>
              <div>
                <label class="font-semibold text-sm block">Доступ к Integram MCP</label>
                <small class="text-color-secondary">
                  AI сможет работать с другими таблицами и строками
                </small>
              </div>
            </div>
            <InputSwitch v-model="localConfig.useMCP" />
          </div>
          <div v-if="localConfig.useMCP" class="mcp-info mt-3">
            <Message severity="info" :closable="false">
              <template #default>
                <div class="text-sm">
                  <strong>Доступные возможности:</strong>
                  <ul class="mt-2 mb-0 pl-4">
                    <li>Чтение данных из любых таблиц</li>
                    <li>Создание/обновление записей в других таблицах</li>
                    <li>Поиск и фильтрация по всей базе данных</li>
                    <li>Выполнение отчётов</li>
                  </ul>
                </div>
              </template>
            </Message>
          </div>
        </div>
      </div>

      <!-- Preview Section -->
      <div v-if="localConfig.prompt" class="preview-section mt-4 p-3">
        <div class="preview-label mb-2">
          <i class="pi pi-eye"></i>
          <span>Предпросмотр промпта:</span>
        </div>
        <div class="preview-prompt">{{ previewPrompt }}</div>
      </div>
    </div>

    <template #footer>
      <Button label="Отмена" icon="pi pi-times" @click="$emit('cancel')" text />
      <Button
        label="Сохранить"
        icon="pi pi-save"
        @click="saveConfig"
        :disabled="!isValid"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputSwitch from 'primevue/inputswitch'
import Message from 'primevue/message'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  config: {
    type: Object,
    default: () => ({})
  },
  headers: {
    type: Array,
    default: () => []
  },
  rowData: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:visible', 'save', 'cancel'])

// Local config state
const localConfig = ref({
  model: 'Kodacode/KodaAgent',
  prompt: '',
  outputField: null,
  useWebSearch: false, // Issue #6607: Enable Tavily web search
  useMCP: false // Issue #6547: Enable MCP tools for cross-table operations
})

// Available AI models
const availableModels = [
  { label: 'KodaAgent (по умолчанию)', value: 'Kodacode/KodaAgent' },
  { label: 'DeepSeek Chat', value: 'deepseek/deepseek-chat' },
  { label: 'Claude Sonnet 4', value: 'anthropic/claude-sonnet-4-20250514' },
  { label: 'GPT-4o', value: 'openai/gpt-4o' },
  { label: 'GPT-4o Mini', value: 'openai/gpt-4o-mini' }
]

// Available placeholders based on headers
const availablePlaceholders = computed(() => {
  const placeholders = [
    { value: '[ID]', label: 'ID строки' },
    { value: '[VAL]', label: 'Главное значение' }
  ]

  // Add column placeholders
  props.headers.forEach(h => {
    if (h.type !== 7) { // Skip BUTTON columns
      const name = h.alias || h.value || h.val || h.id
      if (name && !placeholders.find(p => p.value === `[${name}]`)) {
        placeholders.push({
          value: `[${name}]`,
          label: name
        })
      }
    }
  })

  return placeholders
})

// Output field options - store termId as value, show alias as label
const outputFieldOptions = computed(() => {
  const options = []

  props.headers.forEach(h => {
    // Only text-like columns can be output targets
    // Types: 2=HTML, 3=SHORT, 8=LONG/CHARS, 12=MEMO
    if ([2, 3, 8, 12].includes(h.type)) {
      const label = h.alias || h.value || h.val || h.id
      // Use termId (numeric ID) as value for reliable storage
      const value = h.termId || h.id?.replace?.(/^req_/, '') || h.id
      options.push({
        value: String(value),
        label: label
      })
    }
  })

  return options
})

// Preview prompt with example values
const previewPrompt = computed(() => {
  let preview = localConfig.value.prompt || ''

  // Replace placeholders with example values
  preview = preview.replace(/\[ID\]/g, '12345')
  preview = preview.replace(/\[VAL\]/g, 'Пример значения')

  // Replace column placeholders
  props.headers.forEach(h => {
    const name = h.alias || h.value || h.val || h.id
    if (name) {
      const regex = new RegExp(`\\[${name}\\]`, 'g')
      preview = preview.replace(regex, `«${name}»`)
    }
  })

  return preview
})

// Insert placeholder at cursor
function insertPlaceholder(placeholder) {
  localConfig.value.prompt = (localConfig.value.prompt || '') + ' ' + placeholder
}

// Validation
const isValid = computed(() => {
  return localConfig.value.prompt && localConfig.value.prompt.trim().length > 0
})

// Save configuration
function saveConfig() {
  emit('save', {
    model: localConfig.value.model,
    prompt: localConfig.value.prompt,
    outputField: localConfig.value.outputField,
    useWebSearch: localConfig.value.useWebSearch, // Issue #6607: Include web search toggle in config
    useMCP: localConfig.value.useMCP // Issue #6547: Include MCP toggle in config
  })
}

// Watch for config prop changes
watch(() => props.config, (newConfig) => {
  console.log('[AIAgentConfigDialog] Config changed:', newConfig)
  console.log('[AIAgentConfigDialog] outputFieldOptions:', outputFieldOptions.value)
  localConfig.value = {
    model: newConfig?.model || 'Kodacode/KodaAgent',
    prompt: newConfig?.prompt || '',
    outputField: newConfig?.outputField || null,
    useWebSearch: newConfig?.useWebSearch || false, // Issue #6607
    useMCP: newConfig?.useMCP || false // Issue #6547
  }
  console.log('[AIAgentConfigDialog] localConfig set to:', localConfig.value)
}, { immediate: true, deep: true })

// Reset when dialog opens
watch(() => props.visible, (isVisible) => {
  if (isVisible && props.config) {
    console.log('[AIAgentConfigDialog] Dialog opened, config:', props.config)
    console.log('[AIAgentConfigDialog] outputFieldOptions:', outputFieldOptions.value)
    localConfig.value = {
      model: props.config?.model || 'Kodacode/KodaAgent',
      prompt: props.config?.prompt || '',
      outputField: props.config?.outputField || null,
      useWebSearch: props.config?.useWebSearch || false, // Issue #6607
      useMCP: props.config?.useMCP || false // Issue #6547
    }
    console.log('[AIAgentConfigDialog] localConfig set to:', localConfig.value)
  }
})
</script>

<style scoped>
.ai-agent-config {
  display: flex;
  flex-direction: column;
}

.field {
  display: flex;
  flex-direction: column;
}

.placeholders-section {
  background: var(--p-content-background);
  border: 1px solid var(--surface-border);
  border-radius: var(--p-border-radius);
  padding: 0.75rem;
}

.placeholders-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.placeholders-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.placeholder-tag {
  font-family: 'SF Mono', 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.placeholder-tag:hover {
  transform: scale(1.05);
  background: var(--p-primary-color) !important;
  color: var(--p-primary-contrast-color) !important;
}

.preview-section {
  background: var(--p-content-background);
  border: 1px solid var(--surface-border);
  border-radius: var(--p-border-radius);
}

.preview-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

.preview-prompt {
  font-family: 'SF Mono', 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  color: var(--p-green-400);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 150px;
  overflow-y: auto;
}

.font-mono {
  font-family: 'SF Mono', 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
}

/* Web Search Toggle Section (Issue #6607) */
.web-search-toggle-section {
  background: var(--p-content-background);
  border: 1px solid var(--surface-border);
  border-radius: var(--p-border-radius);
}

.web-search-info {
  border-top: 1px solid var(--surface-border);
  padding-top: 0.75rem;
}

.web-search-info ul {
  list-style-type: disc;
  line-height: 1.6;
}

/* MCP Toggle Section (Issue #6547) */
.mcp-toggle-section {
  background: var(--p-content-background);
  border: 1px solid var(--surface-border);
  border-radius: var(--p-border-radius);
}

.mcp-info {
  border-top: 1px solid var(--surface-border);
  padding-top: 0.75rem;
}

.mcp-info ul {
  list-style-type: disc;
  line-height: 1.6;
}
</style>
