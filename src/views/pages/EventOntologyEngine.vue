<template>
  <div class="event-engine">
    <div class="ee-header">
      <h2>Движок событийной онтологии</h2>
      <span class="ee-subtitle">событийная онтология</span>
      <div class="ee-header-actions">
        <Select v-model="selectedApplicationId" :options="applications" optionLabel="val" optionValue="id"
          placeholder="Все данные" showClear class="ee-app-select" />
        <Select v-model="currentActorId" :options="actors" optionLabel="val" optionValue="id"
          placeholder="Текущий актор" class="ee-actor-select" />
        <Button icon="pi pi-refresh" severity="secondary" text @click="refresh" :loading="loading" />
      </div>
    </div>

    <div v-if="selectedApplicationId" class="ee-scope-bar">
      <i class="pi pi-filter" />
      <span>{{ selectedAppName }}</span>
      <span v-if="scopeInfo" class="ee-scope-info">{{ scopeInfo }}</span>
      <Button icon="pi pi-times" text size="small" severity="secondary" @click="selectedApplicationId = null" />
    </div>

    <div class="ee-content">
      <KeepAlive>
        <component :is="currentPanel" v-bind="panelProps" />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, provide, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import Button from 'primevue/button'
import Select from 'primevue/select'
// Lazy-load all panels to avoid missing dependency build errors
const DashboardPanel = defineAsyncComponent(() => import('@/components/event-engine/DashboardPanel.vue'))
const ActorsPanel = defineAsyncComponent(() => import('@/components/event-engine/ActorsPanel.vue'))
const ConceptsPanel = defineAsyncComponent(() => import('@/components/event-engine/ConceptsPanel.vue'))
const VocabulariesPanel = defineAsyncComponent(() => import('@/components/event-engine/VocabulariesPanel.vue'))
const ApplicationsPanel = defineAsyncComponent(() => import('@/components/event-engine/ApplicationsPanel.vue'))
const ModelEditor = defineAsyncComponent(() => import('@/components/event-engine/ModelEditor.vue'))
const IndividualForm = defineAsyncComponent(() => import('@/components/event-engine/IndividualForm.vue'))
const EventGraph = defineAsyncComponent(() => import('@/components/event-engine/EventGraph.vue'))
const QueryBuilder = defineAsyncComponent(() => import('@/components/event-engine/QueryBuilder.vue'))
const TutorialPanel = defineAsyncComponent(() => import('@/components/event-engine/TutorialPanel.vue'))
const ScenarioCommandCenter = defineAsyncComponent(() => import('@/components/event-engine/ScenarioCommandCenter.vue'))
const VerificationPanel = defineAsyncComponent(() => import('@/components/event-engine/VerificationPanel.vue'))
const VisualModelEditor = defineAsyncComponent(() => import('@/components/event-engine/VisualModelEditor.vue'))
const RequirementsPanel = defineAsyncComponent(() => import('@/components/event-engine/RequirementsPanel.vue'))
const StateMachineEditor = defineAsyncComponent(() => import('@/components/event-engine/StateMachineEditor.vue'))
const SysMLViewer = defineAsyncComponent(() => import('@/components/event-engine/SysMLViewer.vue'))
const VModelDashboard = defineAsyncComponent(() => import('@/components/event-engine/VModelDashboard.vue'))
const DigitalTwinPanel = defineAsyncComponent(() => import('@/components/event-engine/DigitalTwinPanel.vue'))
const FstCommitteePanel = defineAsyncComponent(() => import('@/components/event-engine/FstCommitteePanel.vue'))
const SovereigntyScanPanel = defineAsyncComponent(() => import('@/components/event-engine/SovereigntyScanPanel.vue'))
const HowItWorksPanel = defineAsyncComponent(() => import('@/components/event-engine/HowItWorksPanel.vue'))
const EventStreamPanel = defineAsyncComponent(() => import('@/components/event-engine/EventStreamPanel.vue'))
const TimelinePanel = defineAsyncComponent(() => import('@/components/event-engine/TimelinePanel.vue'))
const KanbanPanel = defineAsyncComponent(() => import('@/components/event-engine/KanbanPanel.vue'))
import { useEventEngineWebSocket } from '@/composables/useEventEngineWebSocket'
import { useEventEngineUndoRedo } from '@/composables/useEventEngineUndoRedo'

const route = useRoute()
const router = useRouter()
const API = '/api/event-engine'
const loading = ref(false)
const activeSection = ref('dashboard')
const currentActorId = ref(null)
const actors = ref([])

// Application Scope (preset system)
const selectedApplicationId = ref(null)
const applications = ref([])
const scopeData = ref(null)

const selectedAppName = computed(() => {
  const app = applications.value.find(a => String(a.id) === String(selectedApplicationId.value))
  return app?.val || ''
})

const scopeInfo = computed(() => {
  if (!scopeData.value || scopeData.value.unrestricted) return ''
  const parts = []
  if (scopeData.value.modelIds?.length) parts.push(`${scopeData.value.modelIds.length} мод.`)
  if (scopeData.value.conceptIds?.length) parts.push(`${scopeData.value.conceptIds.length} конц.`)
  if (scopeData.value.vocabularyIds?.length) parts.push(`${scopeData.value.vocabularyIds.length} слов.`)
  return parts.join(', ')
})

// Data
const selectedModelId = ref(null)
const selectedConceptId = ref(null)
const selectedIndividualId = ref(null)

// WebSocket real-time updates (Item 4)
const { connected: wsConnected } = useEventEngineWebSocket({
  onEventCreated: () => refresh(),
  onModelExecuted: () => refresh(),
  autoConnect: true,
})

// Undo/Redo (Item 8) — pass axios-based API adapter
const undoRedo = useEventEngineUndoRedo({
  get: (url) => axios.get(`${API}${url}`),
  post: (url, data) => axios.post(`${API}${url}`, data),
  put: (url, data) => axios.put(`${API}${url}`, data),
  delete: (url) => axios.delete(`${API}${url}`),
})

// Scoped API wrapper — auto-appends ?applicationId= to all GET requests
function buildScopedUrl(path) {
  const appId = selectedApplicationId.value
  if (!appId) return `${API}${path}`
  const sep = path.includes('?') ? '&' : '?'
  return `${API}${path}${sep}applicationId=${appId}`
}

// Provide shared state to children
provide('eventEngineAPI', API)
provide('eventEngineApi', {
  get: (url) => axios.get(buildScopedUrl(url)),
  post: (url, data) => axios.post(`${API}${url}`, data),
  put: (url, data) => axios.put(`${API}${url}`, data),
  delete: (url) => axios.delete(`${API}${url}`),
})
provide('selectedApplicationId', selectedApplicationId)
provide('currentActorId', currentActorId)
provide('selectedModelId', selectedModelId)
provide('selectedConceptId', selectedConceptId)
provide('selectedIndividualId', selectedIndividualId)
provide('undoRedo', undoRedo)

const panels = {
  dashboard: DashboardPanel,
  actors: ActorsPanel,
  concepts: ConceptsPanel,
  vocabularies: VocabulariesPanel,
  applications: ApplicationsPanel,
  modelEditor: ModelEditor,
  visualModelEditor: VisualModelEditor,
  stateMachine: StateMachineEditor,
  individualForm: IndividualForm,
  eventGraph: EventGraph,
  queryBuilder: QueryBuilder,
  tutorial: TutorialPanel,
  commandCenter: ScenarioCommandCenter,
  verification: VerificationPanel,
  requirements: RequirementsPanel,
  sysmlViewer: SysMLViewer,
  vmodel: VModelDashboard,
  digitalTwin: DigitalTwinPanel,
  fstCommittee: FstCommitteePanel,
  sovereigntyScan: SovereigntyScanPanel,
  howItWorks: HowItWorksPanel,
  eventStream: EventStreamPanel,
  timeline: TimelinePanel,
  kanban: KanbanPanel,
}

const currentPanel = computed(() => panels[activeSection.value] || DashboardPanel)

const panelProps = computed(() => {
  const props = {}
  if (activeSection.value === 'modelEditor') props.modelId = selectedModelId.value
  if (activeSection.value === 'visualModelEditor') {
    props.modelId = selectedModelId.value
    props.undoRedo = undoRedo
  }
  if (activeSection.value === 'stateMachine') props.modelId = selectedModelId.value
  if (activeSection.value === 'individualForm') {
    props.conceptId = selectedConceptId.value
    props.individualId = selectedIndividualId.value
  }
  return props
})


async function loadActors() {
  try {
    const { data } = await axios.get(`${API}/actors`)
    if (data.success) actors.value = data.data
  } catch (e) { console.error('Failed to load actors', e) }
}

async function loadApplications() {
  try {
    const { data } = await axios.get(`${API}/applications`)
    if (data.success) applications.value = data.data
  } catch (e) { console.error('Failed to load applications', e) }
}

async function loadScope() {
  if (!selectedApplicationId.value) { scopeData.value = null; return }
  try {
    const { data } = await axios.get(`${API}/applications/${selectedApplicationId.value}/scope`)
    if (data.success) scopeData.value = data.data
  } catch (e) { scopeData.value = null }
}

// URL persistence for selected application and section
watch(selectedApplicationId, (id) => {
  router.replace({ query: { ...route.query, app: id || undefined } })
  loadScope()
})

// Sync activeSection with URL query ?section=
watch(activeSection, (section) => {
  const current = route.query.section
  if (section !== current) {
    router.push({ query: { ...route.query, section: section === 'dashboard' ? undefined : section } })
  }
})

async function refresh() {
  loading.value = true
  await Promise.all([loadActors(), loadApplications()])
  loading.value = false
}

// Navigation helpers for child components
function openModelEditor(modelId) {
  selectedModelId.value = modelId
  activeSection.value = 'modelEditor'
}
function openIndividualForm(conceptId, individualId) {
  selectedConceptId.value = conceptId
  selectedIndividualId.value = individualId
  activeSection.value = 'individualForm'
}
provide('openModelEditor', openModelEditor)
provide('openIndividualForm', openIndividualForm)

// Handle navigation from TutorialPanel
function handleTutorialNav(e) {
  if (e.detail?.section && panels[e.detail.section]) {
    activeSection.value = e.detail.section
  }
}

onMounted(async () => {
  await Promise.all([loadActors(), loadApplications()])
  // Restore app selection from URL
  if (route.query.app) {
    selectedApplicationId.value = route.query.app
    loadScope()
  }
  // Restore section from URL
  if (route.query.section && panels[route.query.section]) {
    activeSection.value = route.query.section
  }
  window.addEventListener('ee-navigate', handleTutorialNav)
})

// React to browser back/forward — update activeSection from route query
watch(() => route.query.section, (section) => {
  const target = section && panels[section] ? section : 'dashboard'
  if (activeSection.value !== target) {
    activeSection.value = target
  }
})

onUnmounted(() => {
  window.removeEventListener('ee-navigate', handleTutorialNav)
})
</script>

<style scoped>
.event-engine {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 9rem);
  background: var(--p-surface-ground);
}

.ee-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-surface-border);
}

.ee-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.ee-subtitle {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

.ee-header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  align-items: center;
}

.ee-app-select {
  width: 220px;
}

.ee-actor-select {
  width: 200px;
}

.ee-scope-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 20px;
  background: var(--p-primary-50);
  border-bottom: 1px solid var(--p-primary-200);
  font-size: 0.85rem;
  color: var(--p-primary-700);
}

.ee-scope-bar i {
  font-size: 0.8rem;
}

.ee-scope-info {
  color: var(--p-primary-500);
  font-size: 0.8rem;
}

.ee-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
