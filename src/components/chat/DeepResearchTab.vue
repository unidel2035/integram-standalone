<template>
  <div class="deep-research-tab">
    <!-- Research Input Section -->
    <div class="research-input-section" v-if="!isResearching && !result">
      <div class="templates-grid">
        <div class="template-card"
             v-for="template in templates"
             :key="template.id"
             :class="{ selected: selectedTemplate === template.id }"
             @click="selectTemplate(template.id)">
          <i :class="`pi ${template.icon}`" class="template-icon"></i>
          <div class="template-content">
            <div class="template-name">{{ template.name }}</div>
            <div class="template-desc">{{ template.description }}</div>
          </div>
          <i v-if="selectedTemplate === template.id" class="pi pi-check selected-check"></i>
        </div>
      </div>

      <div class="input-section">
        <Textarea
          v-model="query"
          placeholder="Опишите что нужно исследовать... Например: 'Проанализируй компанию ООО Ромашка - финансы, судебные дела, контрагенты'"
          :autoResize="true"
          rows="3"
          class="research-input"
        />

        <div class="input-actions">
          <div class="model-selector">
            <ModelSelector
              v-model="selectedModel"
              application="DeepResearch"
              :access-token="accessToken"
              :show-header="false"
              :show-token-info="false"
              @model-change="handleModelChange"
            />
          </div>

          <Button
            label="Начать исследование"
            icon="pi pi-search"
            :loading="isStarting"
            :disabled="!query.trim()"
            @click="startResearch"
          />
        </div>
      </div>
    </div>

    <!-- Research Progress -->
    <div class="research-progress-section" v-if="isResearching">
      <ResearchProgress
        :title="query.substring(0, 50) + (query.length > 50 ? '...' : '')"
        :events="events"
        :iteration="currentIteration"
        :max-iterations="5"
        :duration="duration"
        :status="sessionStatus"
        @cancel="cancelResearch"
      />
    </div>

    <!-- Research Result -->
    <div class="research-result-section" v-if="result">
      <div class="result-header">
        <div class="result-info">
          <h3><i class="pi pi-check-circle"></i> Исследование завершено</h3>
          <span class="result-stats">
            {{ result.iterations }} итераций • {{ formatDuration(result.duration) }}
          </span>
        </div>
        <Button
          label="Новое исследование"
          icon="pi pi-plus"
          outlined
          @click="resetResearch"
        />
      </div>

      <div class="result-content">
        <MarkdownRender :content="result.answer" />
      </div>

      <div class="result-metadata" v-if="result.entities?.length > 0">
        <h4>Найденные сущности</h4>
        <div class="entities-list">
          <Tag
            v-for="entity in result.entities"
            :key="entity.name"
            :value="entity.name"
            :severity="getEntitySeverity(entity.type)"
          />
        </div>
      </div>

      <div class="result-sources" v-if="result.taskResults?.length > 0">
        <h4>Источники ({{ result.taskResults.length }})</h4>
        <Accordion>
          <AccordionTab
            v-for="task in result.taskResults.filter(t => t.status === 'completed')"
            :key="task.taskId"
            :header="task.tool + ': ' + task.description"
          >
            <pre class="source-content">{{ task.result }}</pre>
          </AccordionTab>
        </Accordion>
      </div>
    </div>

    <!-- Error State -->
    <div class="research-error" v-if="error">
      <Message severity="error" :closable="true" @close="error = null">
        {{ error }}
      </Message>
      <Button
        label="Попробовать снова"
        icon="pi pi-refresh"
        @click="resetResearch"
        class="mt-3"
      />
    </div>

    <!-- Research History -->
    <div class="research-history" v-if="!isResearching && !result && sessions.length > 0">
      <h4><i class="pi pi-history"></i> История исследований</h4>
      <div class="history-list">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="history-item"
          @click="loadSession(session)"
        >
          <div class="history-content">
            <div class="history-query">{{ session.query.substring(0, 80) }}...</div>
            <div class="history-meta">
              <Tag :value="session.status" :severity="getStatusSeverity(session.status)" size="small" />
              <span class="history-date">{{ formatDate(session.createdAt) }}</span>
            </div>
          </div>
          <i class="pi pi-chevron-right"></i>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import deepResearchService from '@/services/deepResearchService'
import ResearchProgress from './ResearchProgress.vue'
import MarkdownRender from '@/components/MarkdownRender.vue'
import ModelSelector from '@/components/ai/ModelSelector.vue'

const props = defineProps({
  accessToken: {
    type: String,
    default: null
  }
})

// State
const query = ref('')
const selectedTemplate = ref(null)
const selectedModel = ref(null)
const templates = ref([])
const sessions = ref([])

const isStarting = ref(false)
const isResearching = ref(false)
const sessionId = ref(null)
const sessionStatus = ref('running')
const events = ref([])
const currentIteration = ref(0)
const startTime = ref(0)
const duration = ref(0)
const result = ref(null)
const error = ref(null)

let durationTimer = null

// Load templates on mount
onMounted(async () => {
  try {
    templates.value = await deepResearchService.getTemplates()
    sessions.value = await deepResearchService.listSessions({ limit: 5 })
  } catch (err) {
    console.error('Failed to load templates:', err)
  }
})

onUnmounted(() => {
  deepResearchService.unsubscribe()
  if (durationTimer) clearInterval(durationTimer)
})

// Methods
const selectTemplate = (templateId) => {
  selectedTemplate.value = selectedTemplate.value === templateId ? null : templateId
}

const handleModelChange = ({ modelId }) => {
  selectedModel.value = modelId
}

const startResearch = async () => {
  if (!query.value.trim()) return

  isStarting.value = true
  error.value = null
  events.value = []
  result.value = null

  try {
    const session = await deepResearchService.startResearch(query.value, {
      template: selectedTemplate.value,
      modelId: selectedModel.value,
      accessToken: props.accessToken
    })

    sessionId.value = session.sessionId
    isResearching.value = true
    sessionStatus.value = 'running'
    startTime.value = Date.now()

    // Start duration timer
    durationTimer = setInterval(() => {
      duration.value = Date.now() - startTime.value
    }, 100)

    // Subscribe to events
    deepResearchService.subscribeToSession(session.sessionId, {
      onPhase: handlePhaseEvent,
      onTask: handleTaskEvent,
      onComplete: handleComplete,
      onError: handleError,
      onStatus: handleStatus
    })

  } catch (err) {
    error.value = err.message || 'Не удалось начать исследование'
    isResearching.value = false
  } finally {
    isStarting.value = false
  }
}

const handlePhaseEvent = (event) => {
  events.value.push(event)
  if (event.iteration) {
    currentIteration.value = event.iteration
  }
}

const handleTaskEvent = (event) => {
  events.value.push(event)
}

const handleComplete = async (event) => {
  isResearching.value = false
  sessionStatus.value = 'completed'
  if (durationTimer) clearInterval(durationTimer)

  // Fetch full result
  try {
    const fullResult = await deepResearchService.getSessionResult(sessionId.value)
    result.value = fullResult.result || event
  } catch (err) {
    result.value = event
  }
}

const handleError = (event) => {
  isResearching.value = false
  sessionStatus.value = 'failed'
  error.value = event.error || 'Исследование завершилось с ошибкой'
  if (durationTimer) clearInterval(durationTimer)
}

const handleStatus = (event) => {
  sessionStatus.value = event.status
}

const cancelResearch = async () => {
  if (sessionId.value) {
    await deepResearchService.cancelSession(sessionId.value)
    isResearching.value = false
    sessionStatus.value = 'cancelled'
    if (durationTimer) clearInterval(durationTimer)
  }
}

const resetResearch = () => {
  query.value = ''
  selectedTemplate.value = null
  result.value = null
  error.value = null
  events.value = []
  sessionId.value = null
  currentIteration.value = 0
  duration.value = 0
}

const loadSession = async (session) => {
  try {
    const sessionResult = await deepResearchService.getSessionResult(session.id)
    if (sessionResult.success && sessionResult.result) {
      query.value = session.query
      result.value = sessionResult.result
    } else {
      error.value = 'Результат недоступен'
    }
  } catch (err) {
    error.value = 'Не удалось загрузить результат'
  }
}

// Helpers
const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}

const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getEntitySeverity = (type) => {
  const map = {
    company: 'info',
    person: 'success',
    topic: 'warning',
    date: 'secondary',
    location: 'contrast'
  }
  return map[type] || 'secondary'
}

const getStatusSeverity = (status) => {
  const map = {
    completed: 'success',
    running: 'info',
    failed: 'danger',
    cancelled: 'warning'
  }
  return map[status] || 'secondary'
}
</script>

<style scoped>
.deep-research-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem;
  overflow-y: auto;
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.template-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-card);
  border: 2px solid var(--surface-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.template-card:hover {
  border-color: var(--primary-300);
  transform: translateY(-2px);
}

.template-card.selected {
  border-color: var(--primary-color);
  background: var(--primary-50);
}

.template-icon {
  font-size: 1.5rem;
  color: var(--primary-color);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-ground);
  border-radius: 10px;
}

.template-content {
  flex: 1;
}

.template-name {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.25rem;
}

.template-desc {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

.selected-check {
  color: var(--primary-color);
  font-size: 1.25rem;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.research-input {
  width: 100%;
  font-size: 1rem;
}

.input-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.model-selector {
  flex: 1;
  max-width: 300px;
}

.research-progress-section {
  flex: 1;
}

.research-result-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--surface-border);
}

.result-info h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.25rem 0;
  color: var(--green-600);
}

.result-stats {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.result-content {
  background: var(--surface-card);
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: var(--shadow-1);
}

.result-metadata h4,
.result-sources h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.entities-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.source-content {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
  background: var(--surface-ground);
  padding: 1rem;
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.research-history h4 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-card);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-item:hover {
  background: var(--surface-hover);
}

.history-content {
  flex: 1;
}

.history-query {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8rem;
}

.history-date {
  color: var(--text-color-secondary);
}

.research-error {
  text-align: center;
  padding: 2rem;
}
</style>
