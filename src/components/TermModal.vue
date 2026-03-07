<script setup>
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import { getTermById } from '@/data/glossary'
import { getApiUrl } from '@/utils/apiConfig'
import FinancialCalculators from '@/components/FinancialCalculators.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  termId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:visible', 'navigate'])

const loading = ref(false)
const aiExplanation = ref('')
const showAIExplanation = ref(false)

const term = computed(() => {
  if (!props.termId) return null
  return getTermById(props.termId)
})

const categoryLabel = computed(() => {
  const categories = {
    financial: 'Финансовые метрики',
    venture: 'Венчурные термины',
    ai: 'AI & Технологии',
    regulation: 'Регулирование',
    platform: 'Платформа'
  }
  return categories[term.value?.category] || ''
})

const categoryIcon = computed(() => {
  const icons = {
    financial: 'pi-chart-line',
    venture: 'pi-briefcase',
    ai: 'pi-sparkles',
    regulation: 'pi-shield',
    platform: 'pi-cog'
  }
  return icons[term.value?.category] || 'pi-book'
})

watch(() => props.termId, () => {
  // Reset AI explanation when term changes
  aiExplanation.value = ''
  showAIExplanation.value = false
})

const handleClose = () => {
  emit('update:visible', false)
}

const handleNavigate = (termId) => {
  emit('navigate', termId)
}

const hasCalculator = (termId) => {
  const calculatorTerms = ['irr', 'moic', 'dpi', 'tvpi', 'burn-rate', 'runway', 'unit-economics', 'ltv', 'cac', 'dilution']
  return calculatorTerms.includes(termId)
}

const explainWithAI = async () => {
  if (!term.value) return

  loading.value = true
  showAIExplanation.value = true

  try {
    const API_BASE_URL = getApiUrl('/api')
    const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: `Объясни термин "${term.value.title}" простыми словами для начинающего венчурного инвестора. 2-3 предложения, без жаргона. Используй аналогии и примеры из жизни.`,
        systemPrompt: 'Ты — опытный венчурный инвестор, который умеет объяснять сложные финансовые концепции простым языком.',
        application: 'Glossary'
      })
    })

    if (!response.ok) {
      throw new Error('Failed to get AI explanation')
    }

    const data = await response.json()
    aiExplanation.value = data.response || 'Не удалось получить объяснение'
  } catch (error) {
    console.error('Error getting AI explanation:', error)
    aiExplanation.value = 'Ошибка при получении объяснения. Попробуйте позже.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog
    v-if="term"
    :visible="visible"
    :header="term.title"
    :modal="true"
    :closable="true"
    :dismissableMask="true"
    :style="{ width: '50rem' }"
    :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
    @update:visible="handleClose"
  >
    <!-- Category badge -->
    <div class="mb-4">
      <Chip :label="categoryLabel" :icon="`pi ${categoryIcon}`" />
    </div>

    <!-- Definition section -->
    <div class="term-section">
      <div class="section-header">
        <i class="pi pi-book"></i>
        <span>Определение</span>
      </div>
      <p class="section-content">{{ term.definition }}</p>
    </div>

    <!-- Formula/Example section -->
    <div v-if="term.formula" class="term-section">
      <div class="section-header">
        <i class="pi pi-calculator"></i>
        <span>Формула / Расчёт</span>
      </div>
      <div class="formula-box">
        <pre>{{ term.formula }}</pre>
      </div>
      <!-- Interactive Calculator -->
      <FinancialCalculators
        v-if="hasCalculator(term.id)"
        :termId="term.id"
      />
    </div>

    <!-- Example section -->
    <div v-if="term.example" class="term-section">
      <div class="section-header">
        <i class="pi pi-lightbulb"></i>
        <span>Пример</span>
      </div>
      <p class="section-content example-text">{{ term.example }}</p>
    </div>

    <!-- Context section -->
    <div v-if="term.context" class="term-section">
      <div class="section-header">
        <i class="pi pi-info-circle"></i>
        <span>Контекст ФСТ НТИ</span>
      </div>
      <p class="section-content context-text">{{ term.context }}</p>
    </div>

    <!-- AI Explanation section -->
    <div class="term-section ai-section">
      <div class="section-header">
        <i class="pi pi-sparkles"></i>
        <span>AI-объяснение</span>
      </div>
      <div v-if="!showAIExplanation">
        <Button
          label="Объяснить проще"
          icon="pi pi-sparkles"
          :loading="loading"
          @click="explainWithAI"
          outlined
          severity="secondary"
        />
      </div>
      <div v-else class="ai-explanation-box">
        <div v-if="loading" class="flex align-items-center gap-2">
          <i class="pi pi-spin pi-spinner"></i>
          <span>AI думает...</span>
        </div>
        <p v-else class="section-content">{{ aiExplanation }}</p>
      </div>
    </div>

    <!-- Related terms -->
    <div v-if="term.relatedTerms && term.relatedTerms.length > 0" class="term-section">
      <div class="section-header">
        <i class="pi pi-link"></i>
        <span>Связанные термины</span>
      </div>
      <div class="related-terms-grid">
        <Button
          v-for="relatedId in term.relatedTerms"
          :key="relatedId"
          :label="getTermById(relatedId)?.title.split('—')[0].trim() || relatedId.toUpperCase()"
          icon="pi pi-arrow-right"
          @click="handleNavigate(relatedId)"
          text
          size="small"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <span class="text-sm text-muted-color">
          <i class="pi pi-book mr-1"></i>
          Глоссарий ФСТ НТИ
        </span>
        <Button
          label="Закрыть"
          icon="pi pi-times"
          @click="handleClose"
          text
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.term-section {
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--p-primary-color);
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-header i {
  font-size: 1.1rem;
}

.section-content {
  color: var(--p-text-color);
  line-height: 1.6;
  margin: 0;
}

.formula-box {
  background: var(--p-surface-100);
  border-left: 3px solid var(--p-primary-color);
  padding: 1rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  overflow-x: auto;
}

.formula-box pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--p-text-color);
}

.example-text {
  background: var(--p-blue-50);
  border-left: 3px solid var(--p-blue-500);
  padding: 1rem;
  border-radius: 4px;
  font-style: italic;
}

.context-text {
  background: var(--p-purple-50);
  border-left: 3px solid var(--p-purple-500);
  padding: 1rem;
  border-radius: 4px;
}

.ai-section {
  background: linear-gradient(135deg, var(--p-surface-50) 0%, var(--p-surface-100) 100%);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--p-surface-200);
}

.ai-explanation-box {
  margin-top: 0.75rem;
}

.related-terms-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Dark mode adjustments */
:root.dark .formula-box {
  background: var(--p-surface-700);
}

:root.dark .example-text {
  background: var(--p-surface-700);
  border-left-color: var(--p-blue-400);
}

:root.dark .context-text {
  background: var(--p-surface-700);
  border-left-color: var(--p-purple-400);
}

:root.dark .ai-section {
  background: linear-gradient(135deg, var(--p-surface-800) 0%, var(--p-surface-700) 100%);
  border-color: var(--p-surface-600);
}
</style>
