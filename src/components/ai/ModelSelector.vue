<template>
  <div class="model-selector-compact">
    <!-- Header -->
    <div class="selector-header" v-if="showHeader">
      <label class="selector-label">
        <i class="pi pi-sparkles"></i>
        {{ label }}
        <span v-if="isCollapsed && selectedModel" class="selected-info">
          ({{ getProviderLabel(selectedProvider) }} - {{ getModelDisplayName(selectedModel) }})
        </span>
      </label>
      <div class="header-actions">
        <Button
          v-if="showSettings"
          icon="pi pi-cog"
          text
          size="small"
          @click="showSettingsDialog = true"
          v-tooltip.top="'Настройки'"
        />
        <Button
          :icon="isCollapsed ? 'pi pi-angle-down' : 'pi pi-angle-up'"
          text
          size="small"
          @click="isCollapsed = !isCollapsed"
          v-tooltip.top="isCollapsed ? 'Показать' : 'Скрыть'"
        />
      </div>
    </div>

    <!-- Selectors (collapsible) -->
    <div v-show="!isCollapsed" class="selectors-container">
      <!-- Provider Dropdown -->
      <div class="selector-row">
      <label class="field-label">Провайдер</label>
      <Dropdown
        v-model="selectedProvider"
        :options="allProviders"
        optionLabel="label"
        optionValue="value"
        placeholder="Выберите провайдера"
        :loading="loading"
        :disabled="disabled"
        class="w-full"
        :appendTo="dropdownAppendTo"
        @change="onProviderChange"
      >
        <template #value="slotProps">
          <div v-if="slotProps.value" class="provider-value">
            <span>{{ getProviderLabel(slotProps.value) }}</span>
            <Badge v-if="getProviderModelCount(slotProps.value)" :value="getProviderModelCount(slotProps.value)" size="small" />
          </div>
        </template>
        <template #option="slotProps">
          <div class="provider-option">
            <span>{{ slotProps.option.label }}</span>
            <Badge :value="slotProps.option.modelCount" severity="secondary" size="small" />
          </div>
        </template>
      </Dropdown>
    </div>

    <!-- Model Dropdown -->
    <div class="selector-row">
      <label class="field-label">Модель</label>
      <Dropdown
        v-model="selectedModel"
        :options="filteredModels"
        optionLabel="display_name"
        optionValue="id"
        placeholder="Выберите модель"
        :loading="loading"
        :disabled="disabled || !selectedProvider"
        class="w-full"
        :appendTo="dropdownAppendTo"
        @change="onModelChange"
      >
        <template #value="slotProps">
          <div v-if="slotProps.value" class="model-value">
            <i class="pi pi-sparkles"></i>
            <span>{{ getModelDisplayName(slotProps.value) }}</span>
          </div>
        </template>
        <template #option="slotProps">
          <div class="model-option-item">
            <div class="model-option-main">
              <span class="model-option-name">{{ slotProps.option.display_name }}</span>
              <div class="model-option-badges">
                <Badge v-if="slotProps.option.context_window" :value="`${formatNumber(slotProps.option.context_window)} ctx`" severity="info" size="small" />
              </div>
            </div>
          </div>
        </template>
      </Dropdown>
    </div>

      <!-- Reset to defaults -->
      <div class="selector-row reset-row">
        <Button
          label="По умолчанию"
          icon="pi pi-undo"
          text
          size="small"
          :disabled="selectedModel === DEFAULT_AI_MODEL"
          @click="resetToDefault"
          v-tooltip.top="'Сбросить на DeepSeek (deepseek-chat / deepseek-reasoner)'"
          class="reset-btn"
        />
      </div>

      <div v-if="showTokenInfo && currentAccessToken" class="token-info">
        <div class="token-balance">
          <i class="pi pi-wallet"></i>
          <span>Баланс: {{ formatNumber(currentAccessToken.tokenBalance) }} токенов</span>
        </div>
        <div v-if="currentAccessToken.dailyLimit" class="token-limits">
          <small>
            Использовано сегодня: {{ formatNumber(currentAccessToken.dailyUsage) }} / {{ formatNumber(currentAccessToken.dailyLimit) }}
          </small>
          <ProgressBar
            :value="(currentAccessToken.dailyUsage / currentAccessToken.dailyLimit) * 100"
            :showValue="false"
            class="limit-bar"
          />
        </div>
      </div>
    </div>

    <!-- Model Settings Dialog -->
    <Dialog
      v-model:visible="showSettingsDialog"
      header="Настройки модели"
      :modal="true"
      :style="{ width: '600px' }"
    >
      <div class="settings-content">
        <div class="setting-group">
          <label for="temperature">Температура (креативность)</label>
          <div class="setting-input">
            <Slider
              id="temperature"
              v-model="modelSettings.temperature"
              :min="0"
              :max="2"
              :step="0.1"
            />
            <InputNumber
              v-model="modelSettings.temperature"
              :min="0"
              :max="2"
              :minFractionDigits="1"
              :maxFractionDigits="1"
              class="temp-input"
            />
          </div>
          <small class="setting-help">
            Более высокие значения делают вывод более креативным, но менее предсказуемым
          </small>
        </div>

        <div class="setting-group">
          <label for="max-tokens">Максимум токенов</label>
          <InputNumber
            id="max-tokens"
            v-model="modelSettings.maxTokens"
            :min="100"
            :max="currentModelMaxTokens"
            :step="100"
            showButtons
          />
          <small class="setting-help">
            Максимальное количество токенов в ответе ({{ formatNumber(currentModelMaxTokens) }} макс.)
          </small>
        </div>

        <div class="setting-group" v-if="advancedSettings">
          <label for="top-p">Top P</label>
          <div class="setting-input">
            <Slider
              id="top-p"
              v-model="modelSettings.topP"
              :min="0"
              :max="1"
              :step="0.05"
            />
            <InputNumber
              v-model="modelSettings.topP"
              :min="0"
              :max="1"
              :minFractionDigits="2"
              :maxFractionDigits="2"
              class="temp-input"
            />
          </div>
          <small class="setting-help">
            Ядерное сэмплирование - альтернативный способ контроля случайности
          </small>
        </div>

        <div class="setting-group">
          <Button
            label="Сбросить к значениям по умолчанию"
            icon="pi pi-refresh"
            text
            @click="resetSettings"
          />
        </div>
      </div>

      <template #footer>
        <Button
          label="Отмена"
          icon="pi pi-times"
          text
          @click="showSettingsDialog = false"
        />
        <Button
          label="Сохранить"
          icon="pi pi-check"
          @click="saveSettings"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import axios from '@/orchestratorAxios'
import { DEFAULT_AI_MODEL, DEFAULT_AI_PROVIDER, MODEL_FALLBACK_CHAIN } from '@/config/aiDefaults.js'
import { logger } from '@/utils/logger'

const props = defineProps({
  modelValue: {
    type: String,
    default: null
  },
  label: {
    type: String,
    default: 'AI Модель'
  },
  placeholder: {
    type: String,
    default: 'Выберите AI модель'
  },
  application: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    default: null
  },
  disabled: {
    type: Boolean,
    default: false
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  showSettings: {
    type: Boolean,
    default: true
  },
  showTokenInfo: {
    type: Boolean,
    default: true
  },
  advancedSettings: {
    type: Boolean,
    default: false
  },
  dropdownAppendTo: {
    type: String,
    default: 'body'
  }
})

const emit = defineEmits(['update:modelValue', 'model-change', 'settings-change'])

const toast = useToast()

// State
const loading = ref(false)
const allModels = ref([])
const selectedProvider = ref(null)
const selectedModel = ref(props.modelValue)
const showSettingsDialog = ref(false)
const currentAccessToken = ref(null)
// Load collapsed state from localStorage (persists user preference)
const isCollapsed = ref(localStorage.getItem('modelSelectorCollapsed') === 'true')

// Settings
const defaultSettings = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1.0
}

const modelSettings = ref({ ...defaultSettings })

// Computed
const inputId = computed(() => `model-selector-${Math.random().toString(36).substr(2, 9)}`)

// All providers with model counts - ALWAYS include Polza and Kodacode
const allProviders = computed(() => {
  // Mandatory providers that must always be shown
  const mandatoryProviders = {
    'claude-sub': { value: 'claude-sub', label: 'Claude (подписка)', modelCount: 1 },
    'polza': { value: 'polza', label: 'Polza.ai', modelCount: 0 },
    'kodacode': { value: 'kodacode', label: 'Kodacode', modelCount: 0 },
    'deepseek': { value: 'deepseek', label: 'DeepSeek', modelCount: 0 },
    'anthropic': { value: 'anthropic', label: 'Anthropic', modelCount: 0 },
    'openai': { value: 'openai', label: 'OpenAI', modelCount: 0 }
  }

  // Count models for each provider
  allModels.value.forEach(model => {
    const provider = model.provider_name
    const displayName = model.provider_display_name || capitalizeProvider(provider)

    if (mandatoryProviders[provider]) {
      mandatoryProviders[provider].modelCount++
    } else {
      if (!mandatoryProviders[provider]) {
        mandatoryProviders[provider] = {
          value: provider,
          label: displayName,
          modelCount: 1
        }
      } else {
        mandatoryProviders[provider].modelCount++
      }
    }
  })

  // Sort: mandatory first, then alphabetically
  const mandatory = ['claude-sub', 'polza', 'kodacode', 'deepseek', 'anthropic', 'openai']
  const providers = Object.values(mandatoryProviders)

  return providers.sort((a, b) => {
    const aIsMandatory = mandatory.includes(a.value)
    const bIsMandatory = mandatory.includes(b.value)

    if (aIsMandatory && !bIsMandatory) return -1
    if (!aIsMandatory && bIsMandatory) return 1

    if (aIsMandatory && bIsMandatory) {
      return mandatory.indexOf(a.value) - mandatory.indexOf(b.value)
    }

    return a.label.localeCompare(b.label)
  })
})

// Filtered models based on selected provider
const filteredModels = computed(() => {
  if (!selectedProvider.value || !allModels.value.length) return []

  return allModels.value.filter(model => model.provider_name === selectedProvider.value)
})

const currentModel = computed(() => {
  return allModels.value.find(m => m.id === selectedModel.value)
})

const currentModelProvider = computed(() => {
  return currentModel.value?.provider_display_name || currentModel.value?.provider_name
})

const currentModelMaxTokens = computed(() => {
  return currentModel.value?.max_output_tokens || 4096
})

// Methods
async function loadModels() {
  loading.value = true
  try {
    // Check localStorage cache first (1h TTL) to avoid 5s+ API call on every mount
    const CACHE_KEY = 'external_models_cache'
    const CACHE_TTL = 60 * 60 * 1000 // 1 hour
    let data = null
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        data = cached.data
        logger.debug('[ModelSelector] Using cached models:', data.length)
      }
    } catch(e) {}

    if (!data) {
      const response = await axios.get('/api/ai-tokens/external-models')
      if (response.data.success) {
        data = response.data.data
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })) } catch(e) {}
      }
    }

    if (data) {
      // Transform external models to match internal model structure
      allModels.value = data.map(model => ({
        id: model.value, // Use original model value (e.g., "anthropic/claude-sonnet-4.5")
        model_id: model.value,
        display_name: model.name,
        provider_name: model.provider,
        provider_display_name: capitalizeProvider(model.provider),
        context_window: model.context_length,
        max_output_tokens: Math.min(model.context_length, 4096), // Default max output
        cost_per_1k_input: '0.00', // Cost handled by DronDoc token system
        cost_per_1k_output: '0.00',
        description: `${model.name} от ${capitalizeProvider(model.provider)}`,
        is_visible: true,
        is_active: true
      }))

      // Add Claude Subscription model (uses local claude CLI, free via Max subscription)
      allModels.value.unshift({
        id: 'claude-sub/claude-opus-4-6',
        model_id: 'claude-opus-4-6',
        display_name: 'Claude Opus 4.6 (подписка)',
        provider_name: 'claude-sub',
        provider_display_name: 'Claude (подписка)',
        context_window: 200000,
        max_output_tokens: 64000,
        cost_per_1k_input: '0.00',
        cost_per_1k_output: '0.00',
        description: 'Claude Opus 4.6 через Max подписку — бесплатно, с MCP tools',
        is_visible: true,
        is_active: true
      })

      logger.debug('[ModelSelector] Models loaded:', allModels.value.length)

      // FIRST: Check localStorage for saved preference (includes provider)
      const storageKey = `modelPreference_${props.application}`
      const savedPref = localStorage.getItem(storageKey)
      let prefLoaded = false

      if (savedPref) {
        try {
          const pref = JSON.parse(savedPref)
          if (pref.preferredModelId && pref.preferredProvider) {
            // Verify the model exists
            const prefModel = allModels.value.find(m => m.id === pref.preferredModelId)
            if (prefModel) {
              selectedProvider.value = pref.preferredProvider
              selectedModel.value = pref.preferredModelId
              prefLoaded = true
              logger.debug('[ModelSelector] Restored from localStorage:', {
                provider: pref.preferredProvider,
                model: pref.preferredModelId
              })
              emit('update:modelValue', selectedModel.value)
              emit('model-change', { modelId: selectedModel.value, model: prefModel })
            }
          }
        } catch (e) {
          console.warn('[ModelSelector] Failed to parse localStorage preference:', e)
        }
      }

      // If no preference loaded, and modelValue is set from parent, set the provider
      if (!prefLoaded && props.modelValue && !selectedProvider.value) {
        const model = allModels.value.find(m => m.id === props.modelValue)
        if (model) {
          selectedProvider.value = model.provider_name
          selectedModel.value = model.id
          logger.debug('[ModelSelector] Provider set from parent modelValue:', {
            provider: model.provider_name,
            model: model.id
          })
        }
      }

      // Load user preference / select default if nothing loaded
      if (!prefLoaded) {
        await loadUserPreference()
      }
    }
  } catch (error) {
    console.error('Error loading models:', error)
    toast.add({
      severity: 'error',
      summary: 'Ошибка',
      detail: 'Не удалось загрузить список моделей',
      life: 3000
    })

    // Even if loading fails, try to select a default if models were previously loaded
    selectDefaultModel()
  } finally {
    loading.value = false
  }
}

function capitalizeProvider(provider) {
  const providerNames = {
    // Primary providers (unified architecture)
    'polza': 'Polza.ai',
    'kodacode': 'Kodacode',
    'deepseek': 'DeepSeek',
    'anthropic': 'Anthropic',
    'openai': 'OpenAI',

    // Additional providers
    'yandex': 'Яндекс',
    'minimax': 'MiniMax',
    'google': 'Google',
    'z-ai': 'Z-AI',
    'qwen': 'Qwen',
    'moonshotai': 'Moonshot AI',
    'amazon': 'Amazon',
    'openrouter': 'OpenRouter',
    'meta': 'Meta',
    'alibaba': 'Alibaba'
  }
  if (!provider) return 'Unknown'
  return providerNames[provider] || provider.charAt(0).toUpperCase() + provider.slice(1)
}

async function loadUserPreference() {
  try {
    // Use localStorage instead of API (Issue #5112)
    const storageKey = `modelPreference_${props.application}`
    const saved = localStorage.getItem(storageKey)

    logger.debug('[ModelSelector] Loading preference from localStorage:', {
      application: props.application,
      storageKey,
      saved
    })

    if (saved) {
      try {
        const preference = JSON.parse(saved)
        logger.debug('[ModelSelector] Found preference:', preference)

        // Only use saved preference if we have both provider and model, and model exists
        if (preference.preferredModelId && preference.preferredProvider && !props.modelValue) {
          const preferredModel = allModels.value.find(m => m.id === preference.preferredModelId)

          if (preferredModel) {
            selectedModel.value = preference.preferredModelId
            selectedProvider.value = preference.preferredProvider
            emit('update:modelValue', selectedModel.value)

            logger.debug('[ModelSelector] Restored preference:', {
              modelId: selectedModel.value,
              provider: selectedProvider.value
            })

            emit('model-change', {
              modelId: selectedModel.value,
              model: preferredModel
            })

            // Load settings
            if (preference.settings) {
              modelSettings.value = {
                ...defaultSettings,
                ...preference.settings
              }
            }
            return // Successfully restored, exit early
          } else {
            console.warn('[ModelSelector] Preferred model not found in allModels:', preference.preferredModelId)
            // Clear invalid preference
            localStorage.removeItem(storageKey)
          }
        }

        // If we got here, preference was incomplete or invalid
        logger.debug('[ModelSelector] Preference incomplete or invalid, selecting default')
        selectDefaultModel()
      } catch (e) {
        console.error('[ModelSelector] Error parsing saved preference:', e)
        localStorage.removeItem(storageKey)
        selectDefaultModel()
      }
    } else {
      logger.debug('[ModelSelector] No preference found, selecting default')
      selectDefaultModel()
    }
  } catch (error) {
    console.error('[ModelSelector] Error loading user preference:', error)
    selectDefaultModel()
  }
}

function selectDefaultModel() {
  // Only auto-select if no model is currently selected
  if ((!selectedModel.value && !props.modelValue && allModels.value.length > 0) ||
      (selectedProvider.value && !selectedModel.value && allModels.value.length > 0)) {

    logger.debug('[ModelSelector] Selecting default model from aiDefaults.js. Models available:', allModels.value.length)

    // Walk the fallback chain from config/aiDefaults.js
    let found = null
    for (const rule of MODEL_FALLBACK_CHAIN) {
      found = allModels.value.find(m =>
        (!rule.provider || m.provider_name === rule.provider) && rule.match(m.id)
      )
      if (found) {
        logger.debug('[ModelSelector] Matched fallback rule:', found.id, found.provider_name)
        break
      }
    }

    if (found) {
      selectedModel.value = found.id
      selectedProvider.value = found.provider_name
      emit('update:modelValue', selectedModel.value)

      logger.debug('[ModelSelector] Default selected:', {
        modelId: selectedModel.value,
        provider: selectedProvider.value
      })

      emit('model-change', {
        modelId: selectedModel.value,
        model: found
      })

      saveUserPreference()
    }
  }
}

async function saveUserPreference() {
  if (!selectedModel.value) return

  try {
    // Use localStorage instead of API (Issue #5112)
    const storageKey = `modelPreference_${props.application}`
    const preference = {
      preferredModelId: selectedModel.value,
      preferredProvider: selectedProvider.value,
      settings: modelSettings.value
    }

    logger.debug('[ModelSelector] Saving preference to localStorage:', {
      application: props.application,
      storageKey,
      preference
    })

    localStorage.setItem(storageKey, JSON.stringify(preference))
    logger.debug('[ModelSelector] Preference saved successfully')
  } catch (error) {
    console.error('[ModelSelector] Error saving preference:', error)
  }
}

async function validateAccessToken() {
  if (!props.accessToken) return

  try {
    const response = await axios.post('/api/ai-tokens/tokens/validate', {
      token: props.accessToken
    })

    if (response.data.success) {
      currentAccessToken.value = response.data.data
    }
  } catch (error) {
    console.error('Error validating token:', error)
    toast.add({
      severity: 'warn',
      summary: 'Предупреждение',
      detail: 'Токен доступа недействителен',
      life: 3000
    })
  }
}

function onProviderChange() {
  // Clear model selection when provider changes
  selectedModel.value = null
  emit('update:modelValue', null)

  // Auto-select first model of the provider if available
  if (filteredModels.value.length > 0) {
    selectModel(filteredModels.value[0])
  }
}

function selectModel(model) {
  selectedModel.value = model.id
  emit('update:modelValue', model.id)
  emit('model-change', {
    modelId: model.id,
    model: model
  })
  saveUserPreference()
}

function onModelChange() {
  emit('update:modelValue', selectedModel.value)
  emit('model-change', {
    modelId: selectedModel.value,
    model: currentModel.value
  })

  saveUserPreference()
}

function resetToDefault() {
  selectedProvider.value = DEFAULT_AI_PROVIDER
  selectedModel.value = DEFAULT_AI_MODEL
  emit('update:modelValue', DEFAULT_AI_MODEL)
  emit('model-change', { modelId: DEFAULT_AI_MODEL, model: currentModel.value })
  saveUserPreference()
}

function getProviderLabel(providerValue) {
  const provider = allProviders.value.find(p => p.value === providerValue)
  return provider ? provider.label : capitalizeProvider(providerValue)
}

function getProviderModelCount(providerValue) {
  const provider = allProviders.value.find(p => p.value === providerValue)
  return provider ? provider.modelCount : 0
}

function saveSettings() {
  emit('settings-change', modelSettings.value)
  saveUserPreference()
  showSettingsDialog.value = false

  toast.add({
    severity: 'success',
    summary: 'Успешно',
    detail: 'Настройки модели сохранены',
    life: 3000
  })
}

function resetSettings() {
  modelSettings.value = { ...defaultSettings }
}

function getModelDisplayName(modelId) {
  const model = allModels.value.find(m => m.id === modelId)
  return model?.display_name || ''
}

function getProviderIcon(providerName) {
  // Provider icons (can add actual icon URLs in /public/icons/)
  const icons = {
    // Primary providers (unified architecture)
    'Polza.ai': '/icons/polza.svg',
    'Kodacode': '/icons/kodacode.svg',
    'DeepSeek': '/icons/deepseek.svg',
    'Anthropic': '/icons/anthropic.svg',
    'OpenAI': '/icons/openai.svg',

    // Additional providers
    'Google': '/icons/google.svg',
    'Google AI': '/icons/google.svg',
    'Meta AI': '/icons/meta.svg',
    'MiniMax': '/icons/minimax.svg',
    'Qwen': '/icons/qwen.svg',
    'Moonshot AI': '/icons/moonshot.svg'
  }
  return icons[providerName] || null
}

function getProviderSeverity(provider) {
  const severities = {
    // Primary providers - distinct colors
    'Polza.ai': 'info',         // Blue
    'Kodacode': 'success',      // Green
    'DeepSeek': 'contrast',     // Dark
    'Anthropic': 'warning',     // Orange
    'OpenAI': 'success',        // Green

    // Additional providers
    'Google': 'danger',
    'Google AI': 'danger',
    'Meta AI': 'secondary',
    'MiniMax': 'info',
    'Qwen': 'secondary'
  }
  return severities[provider] || 'secondary'
}

function formatNumber(num) {
  if (!num) return '0'
  return new Intl.NumberFormat('ru-RU').format(num)
}

// Watchers
watch(() => props.modelValue, (newValue) => {
  if (newValue !== selectedModel.value) {
    selectedModel.value = newValue
    // Also update provider when model changes from parent
    if (newValue && allModels.value.length > 0) {
      const model = allModels.value.find(m => m.id === newValue)
      if (model && model.provider_name !== selectedProvider.value) {
        selectedProvider.value = model.provider_name
        logger.debug('[ModelSelector] Provider auto-set from modelValue:', model.provider_name)
      }
    }
  }
})

watch(() => props.accessToken, () => {
  validateAccessToken()
})

// Save collapsed state to localStorage when it changes
watch(isCollapsed, (newValue) => {
  localStorage.setItem('modelSelectorCollapsed', newValue.toString())
})

// Lifecycle
onMounted(() => {
  loadModels()
  if (props.accessToken) {
    validateAccessToken()
  }
})

// Expose methods for parent component
defineExpose({
  selectedModel,
  currentModel,
  modelSettings,
  refreshModels: loadModels
})
</script>

<style scoped>
.model-selector-compact {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.selector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.25rem;
}

.selector-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--text-color);
  font-size: 0.95rem;
}

.selector-label i {
  color: var(--primary-color);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.selected-info {
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--text-color-secondary);
  margin-left: 0.5rem;
}

.selectors-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.selector-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-color-secondary);
}

.reset-row {
  align-items: flex-start;
}

.reset-btn {
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  color: var(--p-text-color-secondary);
}

.provider-value,
.model-value,
.provider-option,
.model-option-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.model-value i {
  color: var(--primary-color);
}

.model-option-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 0.5rem;
}

.model-option-name {
  flex: 1;
}

.model-option-badges {
  display: flex;
  gap: 0.25rem;
}

.token-info {
  padding: 0.75rem;
  background: var(--surface-50);
  border-radius: var(--border-radius);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.token-balance {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--text-color);
  font-size: 0.9rem;
}

.token-balance i {
  color: var(--primary-color);
}

.token-limits {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.token-limits small {
  color: var(--text-color-secondary);
  font-size: 0.85rem;
}

.limit-bar {
  height: 4px;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-group label {
  font-weight: 600;
  color: var(--text-color);
}

.setting-input {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.setting-input :deep(.p-slider) {
  flex: 1;
}

.temp-input {
  width: 100px;
}

.setting-help {
  color: var(--text-color-secondary);
  font-size: 0.85rem;
  line-height: 1.4;
}
</style>
