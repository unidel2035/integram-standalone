<template>
  <Dialog
    :visible="visible"
    header="AI-Заполнение таблицы"
    :style="{ width: '700px' }"
    :modal="true"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="ai-fill-table-dialog">
      <!-- Status Info -->
      <div class="status-info mb-4 p-3">
        <div class="flex align-items-center gap-2 mb-2">
          <i class="pi pi-table text-primary"></i>
          <span class="font-semibold">{{ tableName || 'Подчинённая таблица' }}</span>
          <Badge :value="tableStructure.length + ' колонок'" severity="secondary" />
        </div>
        <div v-if="tableStructure.length > 0" class="table-structure-preview">
          <span class="text-color-secondary text-sm">Структура: </span>
          <span
            v-for="(col, idx) in tableStructure.slice(0, 5)"
            :key="col.id"
            class="structure-col"
          >
            {{ col.alias || col.val || col.id }}<span v-if="idx < Math.min(tableStructure.length, 5) - 1">, </span>
          </span>
          <span v-if="tableStructure.length > 5" class="text-color-secondary">
            +{{ tableStructure.length - 5 }} ещё
          </span>
        </div>
      </div>

      <!-- Prompt Input -->
      <div class="field mb-4">
        <label class="block mb-2 font-semibold text-sm">
          <i class="pi pi-comment mr-2"></i>Промпт (что заполнить)
        </label>
        <Textarea
          v-model="localPrompt"
          rows="5"
          :placeholder="promptPlaceholder"
          class="w-full"
          autoResize
        />
        <small class="text-color-secondary mt-1 block">
          Опишите, какие данные нужно сгенерировать для заполнения таблицы.
        </small>
      </div>

      <!-- Quick Examples -->
      <div class="field mb-4">
        <label class="block mb-2 font-semibold text-sm">
          <i class="pi pi-bolt mr-2"></i>Быстрые примеры
        </label>
        <div class="quick-examples">
          <Tag
            v-for="example in quickExamples"
            :key="example.label"
            :value="example.label"
            severity="secondary"
            class="quick-example-tag cursor-pointer mr-2 mb-2"
            @click="applyExample(example)"
            v-tooltip.top="example.prompt"
          />
        </div>
      </div>

      <!-- AI Model Selection -->
      <div class="field mb-4">
        <label class="block mb-2 font-semibold text-sm">
          <i class="pi pi-android mr-2"></i>Модель AI
        </label>
        <Dropdown
          v-model="selectedModel"
          :options="availableModels"
          optionLabel="label"
          optionValue="value"
          placeholder="Выберите модель"
          class="w-full"
        />
      </div>

      <!-- Row Count -->
      <div class="field mb-4">
        <label class="block mb-2 font-semibold text-sm">
          <i class="pi pi-list mr-2"></i>Количество строк для генерации
        </label>
        <div class="flex align-items-center gap-3">
          <InputNumber
            v-model="rowCount"
            :min="1"
            :max="50"
            showButtons
            buttonLayout="horizontal"
            :step="1"
            class="row-count-input"
          />
          <small class="text-color-secondary">(максимум 50)</small>
        </div>
      </div>

      <!-- Execution Status -->
      <div v-if="isExecuting" class="execution-status p-3 mb-4">
        <div class="flex align-items-center gap-3">
          <ProgressSpinner style="width: 24px; height: 24px" />
          <div class="flex-1">
            <div class="font-semibold">{{ executionStatus }}</div>
            <small class="text-color-secondary">{{ executionDetail }}</small>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <Message v-if="errorMessage" severity="error" :closable="true" @close="errorMessage = ''">
        {{ errorMessage }}
      </Message>

      <!-- Success Message -->
      <Message v-if="successMessage" severity="success" :closable="true" @close="successMessage = ''">
        {{ successMessage }}
      </Message>
    </div>

    <template #footer>
      <Button label="Отмена" icon="pi pi-times" @click="$emit('update:visible', false)" text :disabled="isExecuting" />
      <Button
        label="Заполнить таблицу"
        icon="pi pi-play"
        @click="executeAIFill"
        :disabled="!isValid || isExecuting"
        :loading="isExecuting"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { getApiUrl } from '@/utils/apiConfig'
import { getCurrentUserId, getDefaultToken } from '@/services/aiTokenService'
import integramApiClient from '@/services/integramApiClient'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import Dropdown from 'primevue/dropdown'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Badge from 'primevue/badge'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  tableId: {
    type: [String, Number],
    required: true
  },
  tableName: {
    type: String,
    default: ''
  },
  tableStructure: {
    type: Array,
    default: () => []
  },
  parentRowId: {
    type: [String, Number],
    default: null
  },
  database: {
    type: String,
    default: ''
  },
  serverURL: {
    type: String,
    default: ''
  },
  token: {
    type: String,
    default: ''
  },
  xsrfToken: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:visible', 'fill-complete', 'fill-error'])

// State
const localPrompt = ref('')
const selectedModel = ref('deepseek/deepseek-chat')
const rowCount = ref(5)
const isExecuting = ref(false)
const executionStatus = ref('')
const executionDetail = ref('')
const errorMessage = ref('')
const successMessage = ref('')

// Available AI models
const availableModels = [
  { label: 'DeepSeek Chat (рекомендуется)', value: 'deepseek/deepseek-chat' },
  { label: 'KodaAgent', value: 'Kodacode/KodaAgent' },
  { label: 'Claude Sonnet 4', value: 'anthropic/claude-sonnet-4-20250514' },
  { label: 'GPT-4o', value: 'openai/gpt-4o' },
  { label: 'GPT-4o Mini', value: 'openai/gpt-4o-mini' }
]

// Quick examples
const quickExamples = computed(() => [
  {
    label: 'Тестовые данные',
    prompt: `Создай ${rowCount.value} тестовых записей для таблицы "${props.tableName}". Данные должны быть реалистичными и разнообразными.`
  },
  {
    label: 'Примеры',
    prompt: `Сгенерируй ${rowCount.value} примеров записей для демонстрации возможностей таблицы "${props.tableName}".`
  },
  {
    label: 'Случайные',
    prompt: `Заполни таблицу ${rowCount.value} случайными, но осмысленными записями.`
  }
])

// Placeholder text
const promptPlaceholder = computed(() => {
  if (props.tableStructure.length > 0) {
    const colNames = props.tableStructure.slice(0, 3).map(c => c.alias || c.val || c.id).join(', ')
    return `Например: "Создай 5 записей о клиентах с полями ${colNames}..."`
  }
  return 'Опишите, какие данные нужно сгенерировать...'
})

// Validation
const isValid = computed(() => {
  return localPrompt.value.trim().length > 5 && rowCount.value > 0 && rowCount.value <= 50
})

// Apply quick example
function applyExample(example) {
  localPrompt.value = example.prompt
}

/**
 * Parse JSON array from AI response text.
 * AI may wrap JSON in markdown code blocks — strip those first.
 */
function parseJsonRecords(text) {
  // Strip markdown code fences if present
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  // Find the first '[' and last ']' to extract JSON array
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI не вернул JSON-массив записей. Попробуйте ещё раз.')
  }

  return JSON.parse(cleaned.slice(start, end + 1))
}

// Execute AI fill — same approach as AI Button (type 7)
async function executeAIFill() {
  if (!isValid.value) return

  isExecuting.value = true
  executionStatus.value = 'Подготовка запроса...'
  executionDetail.value = 'Формирование промпта для AI'
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // Get user ID and default token — same as AI Button approach
    const userId = getCurrentUserId()
    if (!userId) {
      throw new Error('Не удалось определить пользователя. Войдите в систему.')
    }

    const tokenData = await getDefaultToken(userId)
    const { token, defaultModel } = tokenData
    const aiModel = selectedModel.value || defaultModel?.model_id || 'deepseek/deepseek-chat'

    // Build table structure description for the prompt
    const typeMap = {
      3: 'текст (короткий)',
      2: 'HTML текст',
      8: 'текст (длинный)',
      13: 'число',
      4: 'дата и время',
      5: 'дата',
      6: 'время',
      11: 'да/нет (boolean)',
      12: 'memo (многострочный текст)'
    }

    const tableStructureDescription = props.tableStructure.map(col => {
      const typeLabel = typeMap[col.type] || `тип ${col.type}`
      return `  - ID: ${col.id}, Название: "${col.alias || col.val || col.id}", Тип: ${typeLabel}`
    }).join('\n')

    // Build prompt asking AI to return JSON array of records
    const fullPrompt = `Ты помощник для заполнения таблицы в базе данных Integram.

ТАБЛИЦА:
- ID: ${props.tableId}
- Название: ${props.tableName || 'Подчинённая таблица'}
- База данных: ${props.database}
${props.parentRowId ? `- ID родительской записи: ${props.parentRowId}` : ''}

КОЛОНКИ ТАБЛИЦЫ:
${tableStructureDescription}

ЗАДАНИЕ: ${localPrompt.value}

Сгенерируй РОВНО ${rowCount.value} записей.

Верни ТОЛЬКО JSON-массив объектов, без пояснений. Каждый объект должен содержать поля:
- "value": главное значение записи (строка)
- "requisites": объект с ключами = числовыми ID колонок и значениями = данные

Пример формата:
[
  {
    "value": "Название записи",
    "requisites": {
      "123": "значение колонки 123",
      "456": "значение колонки 456"
    }
  }
]

Используй реалистичные данные, соответствующие типам колонок.`

    executionStatus.value = 'Запрос к AI...'
    executionDetail.value = `Модель: ${aiModel}`

    const apiBaseUrl = getApiUrl('/api')

    // Call /api/ai-tokens/chat — same as AI Button (type 7)
    const response = await fetch(`${apiBaseUrl}/ai-tokens/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.id}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId: aiModel,
        prompt: fullPrompt,
        application: 'IntegramAIFill',
        operation: 'ai-fill-table',
        temperature: 0.7,
        maxTokens: 4000
      })
    })

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '')
      let errorData = {}
      try { errorData = JSON.parse(bodyText) } catch {}
      throw new Error(errorData.error || errorData.message || `AI request failed (${response.status})`)
    }

    const result = await response.json()
    const aiText = result.content || result.response || ''

    console.log('[AIFillTableDialog] AI response received, length:', aiText.length)

    executionStatus.value = 'Разбор ответа AI...'
    executionDetail.value = 'Парсинг JSON из ответа'

    // Parse JSON records from AI response
    const records = parseJsonRecords(aiText)

    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('AI вернул пустой список записей')
    }

    console.log('[AIFillTableDialog] Parsed records:', records.length)

    // Ensure integramApiClient is configured with correct database and server
    if (props.database) {
      integramApiClient.setDatabase(props.database)
    }

    // Create records in Integram using the same client as the rest of the app
    let createdCount = 0
    for (let i = 0; i < records.length; i++) {
      const rec = records[i]

      executionStatus.value = `Создание записей... (${i + 1}/${records.length})`
      executionDetail.value = rec.value || `Запись ${i + 1}`

      try {
        await integramApiClient.createObject(
          props.tableId,
          rec.value || '',
          rec.requisites || {},
          props.parentRowId || null
        )
        createdCount++
      } catch (createErr) {
        console.error(`[AIFillTableDialog] Failed to create record ${i + 1}:`, createErr)
        // Continue with remaining records even if one fails
      }
    }

    successMessage.value = `AI создал ${createdCount} из ${records.length} записей в таблице.`
    emit('fill-complete', {
      createdCount,
      totalCount: records.length
    })

  } catch (err) {
    console.error('[AIFillTableDialog] Error:', err)
    errorMessage.value = `Ошибка: ${err.message}`
    emit('fill-error', err)
  } finally {
    isExecuting.value = false
    executionStatus.value = ''
    executionDetail.value = ''
  }
}

// Reset state when dialog opens
watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    errorMessage.value = ''
    successMessage.value = ''
    executionStatus.value = ''
    executionDetail.value = ''
    // Keep prompt if user wants to retry
  }
})
</script>

<style scoped>
.ai-fill-table-dialog {
  display: flex;
  flex-direction: column;
}

.status-info {
  background: var(--p-content-background);
  border: 1px solid var(--surface-border);
  border-radius: var(--p-border-radius);
}

.table-structure-preview {
  font-size: 0.85rem;
}

.structure-col {
  color: var(--p-primary-color);
  font-weight: 500;
}

.field {
  display: flex;
  flex-direction: column;
}

.quick-examples {
  display: flex;
  flex-wrap: wrap;
}

.quick-example-tag {
  transition: all 0.2s;
}

.quick-example-tag:hover {
  transform: scale(1.05);
  background: var(--p-primary-color) !important;
  color: var(--p-primary-contrast-color) !important;
}

.row-count-input {
  width: 120px;
}

.row-count-input :deep(.p-inputnumber-input) {
  width: 60px;
  text-align: center;
}

.execution-status {
  background: var(--p-highlight-background);
  border: 1px solid var(--p-primary-color);
  border-radius: var(--p-border-radius);
}
</style>
