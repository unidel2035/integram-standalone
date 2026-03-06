<template>
  <div class="knowledge-base-selector">
    <div class="selector-header">
      <h3><i class="pi pi-database"></i> Knowledge Base Configuration</h3>
      <p class="selector-subtitle">Connect your agent to Integram data sources for RAG-enhanced responses</p>
    </div>

    <!-- Enable Knowledge Base Toggle -->
    <div class="enable-section">
      <div class="enable-toggle">
        <label class="toggle-label">
          <i class="pi pi-power-off"></i>
          Enable Knowledge Base (RAG)
        </label>
        <InputSwitch v-model="enabled" @change="onToggle" />
      </div>
      <p v-if="enabled" class="hint-text">
        <i class="pi pi-info-circle"></i>
        Agent will retrieve relevant information from selected Integram tables to enhance responses
      </p>
    </div>

    <!-- Configuration Panel (shown when enabled) -->
    <div v-if="enabled" class="config-panel">
      <!-- Project Selection -->
      <div class="form-group">
        <label class="form-label">
          <i class="pi pi-table"></i>
          Select Integram Tables (Projects)
          <span class="required">*</span>
        </label>
        <MultiSelect
          v-model="selectedProjects"
          :options="availableProjects"
          optionLabel="name"
          optionValue="id"
          placeholder="Choose knowledge base tables"
          :loading="loadingProjects"
          :filter="true"
          :showToggleAll="true"
          class="w-full"
          @change="onProjectsChange"
        >
          <template #option="slotProps">
            <div class="project-option">
              <div class="project-info">
                <span class="project-name">{{ slotProps.option.name }}</span>
                <span class="project-id">ID: {{ slotProps.option.id }}</span>
              </div>
              <div v-if="slotProps.option.documentCount !== undefined" class="project-stats">
                <Tag :value="`${slotProps.option.documentCount} docs`" severity="info" />
              </div>
            </div>
          </template>
        </MultiSelect>
        <small class="form-hint">
          Select one or more Integram tables that contain knowledge for your agent
        </small>
      </div>

      <!-- RAG Settings -->
      <div class="rag-settings">
        <Accordion :activeIndex="0">
          <AccordionTab header="RAG Settings">
            <div class="settings-grid">
              <!-- Search Limit -->
              <div class="setting-item">
                <label class="setting-label">
                  <i class="pi pi-list"></i>
                  Max Results per Query
                </label>
                <InputNumber
                  v-model="searchLimit"
                  :min="1"
                  :max="20"
                  showButtons
                  @input="onSettingsChange"
                />
                <small class="setting-hint">Number of relevant documents to retrieve (1-20)</small>
              </div>

              <!-- Similarity Threshold -->
              <div class="setting-item">
                <label class="setting-label">
                  <i class="pi pi-percentage"></i>
                  Similarity Threshold
                </label>
                <div class="slider-container">
                  <Slider
                    v-model="similarityThreshold"
                    :min="0"
                    :max="100"
                    @change="onSettingsChange"
                  />
                  <span class="slider-value">{{ similarityThreshold }}%</span>
                </div>
                <small class="setting-hint">Minimum similarity score for document relevance</small>
              </div>

              <!-- Auto-Index -->
              <div class="setting-item">
                <label class="setting-label">
                  <i class="pi pi-sync"></i>
                  Auto-Index on Deployment
                </label>
                <InputSwitch v-model="autoIndex" @change="onSettingsChange" />
                <small class="setting-hint">Automatically index knowledge base when agent is deployed</small>
              </div>
            </div>
          </AccordionTab>
        </Accordion>
      </div>

      <!-- Indexing Status & Actions -->
      <div class="indexing-section">
        <div class="section-header">
          <h4><i class="pi pi-chart-bar"></i> Knowledge Base Status</h4>
          <Button
            label="Refresh"
            icon="pi pi-refresh"
            size="small"
            text
            @click="loadKnowledgeBaseStats"
            :loading="loadingStats"
          />
        </div>

        <!-- Stats Display -->
        <div v-if="stats" class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon"><i class="pi pi-database"></i></div>
            <div class="stat-content">
              <span class="stat-value">{{ stats.documentCount || 0 }}</span>
              <span class="stat-label">Documents Indexed</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><i class="pi pi-clock"></i></div>
            <div class="stat-content">
              <span class="stat-value">{{ formatTimestamp(stats.lastIndexed) }}</span>
              <span class="stat-label">Last Indexed</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon"><i class="pi pi-check-circle"></i></div>
            <div class="stat-content">
              <span class="stat-value">{{ stats.status || 'Not Indexed' }}</span>
              <span class="stat-label">Status</span>
            </div>
          </div>
        </div>

        <!-- Indexing Actions -->
        <div class="indexing-actions">
          <Button
            label="Index Now"
            icon="pi pi-play"
            @click="indexNow"
            :loading="isIndexing"
            :disabled="!selectedProjects.length || isIndexing"
          />
          <Button
            label="Clear Index"
            icon="pi pi-trash"
            severity="danger"
            outlined
            @click="confirmClearIndex"
            :disabled="!stats?.documentCount || isIndexing"
          />
        </div>

        <!-- Indexing Progress -->
        <div v-if="isIndexing" class="indexing-progress">
          <ProgressBar :value="indexingProgress" :showValue="true" />
          <p class="progress-text">{{ indexingStatus }}</p>
        </div>
      </div>

      <!-- Preview Data -->
      <div v-if="selectedProjects.length > 0" class="preview-section">
        <Button
          :label="showPreview ? 'Hide Preview' : 'Preview Data'"
          icon="pi pi-eye"
          severity="secondary"
          outlined
          @click="togglePreview"
        />

        <div v-if="showPreview" class="preview-content">
          <DataTable
            :value="previewData"
            :loading="loadingPreview"
            paginator
            :rows="5"
            stripedRows
            class="preview-table"
          >
            <Column field="id" header="ID" />
            <Column field="title" header="Title" />
            <Column field="preview" header="Content Preview">
              <template #body="slotProps">
                <span class="text-truncate">{{ slotProps.data.preview }}</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
    </div>

    <!-- Clear Confirmation Dialog -->
    <Dialog
      v-model:visible="showClearDialog"
      header="Clear Knowledge Base Index"
      :modal="true"
      :closable="true"
    >
      <p>Are you sure you want to clear the knowledge base index? This action cannot be undone.</p>
      <p class="warning-text">
        <i class="pi pi-exclamation-triangle"></i>
        You will need to re-index the data before the agent can use it.
      </p>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="showClearDialog = false" />
        <Button label="Clear Index" severity="danger" @click="clearIndex" :loading="isClearing" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import apiClient from '@/axios2.js'
import { logger } from '@/utils/logger'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      enabled: false,
      projectIds: [],
      searchLimit: 5,
      similarityThreshold: 70,
      autoIndex: true
    })
  },
  agentId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'indexed', 'cleared'])
const toast = useToast()

// Form state
const enabled = ref(props.modelValue?.enabled || false)
const selectedProjects = ref(props.modelValue?.projectIds || [])
const searchLimit = ref(props.modelValue?.searchLimit || 5)
const similarityThreshold = ref(props.modelValue?.similarityThreshold || 70)
const autoIndex = ref(props.modelValue?.autoIndex !== false)

// Available projects (from Integram)
const availableProjects = ref([])
const loadingProjects = ref(false)

// Stats
const stats = ref(null)
const loadingStats = ref(false)

// Indexing
const isIndexing = ref(false)
const indexingProgress = ref(0)
const indexingStatus = ref('')

// Clear
const showClearDialog = ref(false)
const isClearing = ref(false)

// Preview
const showPreview = ref(false)
const previewData = ref([])
const loadingPreview = ref(false)

// Configuration object
const config = computed(() => ({
  enabled: enabled.value,
  projectIds: selectedProjects.value,
  searchLimit: searchLimit.value,
  similarityThreshold: similarityThreshold.value / 100, // Convert to 0-1
  autoIndex: autoIndex.value
}))

// Watch for changes and emit
watch(config, (newConfig) => {
  emit('update:modelValue', newConfig)
}, { deep: true })

// Methods
const onToggle = () => {
  if (enabled.value && availableProjects.value.length === 0) {
    loadAvailableProjects()
  }
}

const onProjectsChange = () => {
  if (selectedProjects.value.length > 0) {
    loadKnowledgeBaseStats()
    if (showPreview.value) {
      loadPreviewData()
    }
  }
}

const onSettingsChange = () => {
  // Emit change event (already handled by watch)
}

const loadAvailableProjects = async () => {
  loadingProjects.value = true
  try {
    // Fetch available Integram tables (projects)
    const response = await apiClient.get('/api/integram/tables')
    availableProjects.value = response.data.tables || []

    logger.info('[KnowledgeBaseSelector] Loaded available projects', {
      count: availableProjects.value.length
    })
  } catch (error) {
    logger.error('[KnowledgeBaseSelector] Failed to load projects', error)
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load available projects',
      life: 3000
    })
  } finally {
    loadingProjects.value = false
  }
}

const loadKnowledgeBaseStats = async () => {
  if (!selectedProjects.value.length) return

  loadingStats.value = true
  try {
    const response = await apiClient.post('/api/agents/knowledge-base/stats', {
      projectIds: selectedProjects.value
    })
    stats.value = response.data

    logger.info('[KnowledgeBaseSelector] Loaded knowledge base stats', stats.value)
  } catch (error) {
    logger.error('[KnowledgeBaseSelector] Failed to load stats', error)
  } finally {
    loadingStats.value = false
  }
}

const indexNow = async () => {
  if (!selectedProjects.value.length) {
    toast.add({
      severity: 'warn',
      summary: 'No Projects Selected',
      detail: 'Please select at least one project to index',
      life: 3000
    })
    return
  }

  isIndexing.value = true
  indexingProgress.value = 0
  indexingStatus.value = 'Starting indexing...'

  try {
    // Call backend to index knowledge base
    const response = await apiClient.post('/api/agents/knowledge-base/index', {
      projectIds: selectedProjects.value,
      agentId: props.agentId
    })

    // Simulate progress (in real implementation, use WebSocket or polling)
    const progressInterval = setInterval(() => {
      if (indexingProgress.value < 90) {
        indexingProgress.value += 10
        indexingStatus.value = `Indexing... ${indexingProgress.value}%`
      }
    }, 500)

    // Wait for response
    await new Promise((resolve) => {
      // Simulate async indexing
      setTimeout(resolve, 3000)
    })

    clearInterval(progressInterval)
    indexingProgress.value = 100
    indexingStatus.value = 'Indexing complete!'

    toast.add({
      severity: 'success',
      summary: 'Indexing Complete',
      detail: `Indexed ${response.data?.documentsProcessed || 0} documents`,
      life: 5000
    })

    // Reload stats
    await loadKnowledgeBaseStats()

    emit('indexed', response.data)
  } catch (error) {
    logger.error('[KnowledgeBaseSelector] Indexing failed', error)
    toast.add({
      severity: 'error',
      summary: 'Indexing Failed',
      detail: error.response?.data?.error || 'Failed to index knowledge base',
      life: 5000
    })
  } finally {
    isIndexing.value = false
    indexingProgress.value = 0
    indexingStatus.value = ''
  }
}

const confirmClearIndex = () => {
  showClearDialog.value = true
}

const clearIndex = async () => {
  isClearing.value = true
  try {
    await apiClient.post('/api/agents/knowledge-base/clear', {
      projectIds: selectedProjects.value
    })

    toast.add({
      severity: 'success',
      summary: 'Index Cleared',
      detail: 'Knowledge base index has been cleared',
      life: 3000
    })

    stats.value = null
    showClearDialog.value = false

    emit('cleared')
  } catch (error) {
    logger.error('[KnowledgeBaseSelector] Failed to clear index', error)
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to clear knowledge base index',
      life: 3000
    })
  } finally {
    isClearing.value = false
  }
}

const togglePreview = async () => {
  showPreview.value = !showPreview.value
  if (showPreview.value && previewData.value.length === 0) {
    await loadPreviewData()
  }
}

const loadPreviewData = async () => {
  loadingPreview.value = true
  try {
    const response = await apiClient.post('/api/integram/preview', {
      typeIds: selectedProjects.value,
      limit: 10
    })
    previewData.value = (response.data.objects || []).map(obj => ({
      id: obj.id,
      title: obj.value || obj.name,
      preview: obj.preview || (obj.text || '').substring(0, 100) + '...'
    }))
  } catch (error) {
    logger.error('[KnowledgeBaseSelector] Failed to load preview', error)
  } finally {
    loadingPreview.value = false
  }
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'Never'
  const date = new Date(timestamp)
  return date.toLocaleString()
}

// Initialize
onMounted(() => {
  if (enabled.value) {
    loadAvailableProjects()
    if (selectedProjects.value.length > 0) {
      loadKnowledgeBaseStats()
    }
  }
})
</script>

<style scoped>
.knowledge-base-selector {
  padding: 1.5rem;
  background: var(--surface-ground);
  border-radius: 8px;
}

.selector-header {
  margin-bottom: 1.5rem;
}

.selector-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.selector-subtitle {
  color: var(--text-color-secondary);
  margin: 0;
  font-size: 0.875rem;
}

.enable-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--surface-card);
  border-radius: 6px;
}

.enable-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.toggle-label {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hint-text {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
  margin: 0.5rem 0 0 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.config-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.required {
  color: var(--red-500);
}

.form-hint {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.project-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.project-info {
  display: flex;
  flex-direction: column;
}

.project-name {
  font-weight: 500;
}

.project-id {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.rag-settings {
  margin-top: 1rem;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  padding: 1rem 0;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-label {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.slider-value {
  min-width: 3rem;
  font-weight: 600;
  color: var(--primary-color);
}

.setting-hint {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.indexing-section {
  padding: 1rem;
  background: var(--surface-card);
  border-radius: 6px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-ground);
  border-radius: 6px;
}

.stat-icon {
  font-size: 2rem;
  color: var(--primary-color);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.indexing-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.indexing-progress {
  margin-top: 1rem;
}

.progress-text {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  text-align: center;
}

.preview-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-content {
  margin-top: 1rem;
}

.text-truncate {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.warning-text {
  color: var(--orange-500);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
