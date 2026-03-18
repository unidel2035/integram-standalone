<template>
  <div class="event-stream-panel">
    <div class="panel-toolbar">
      <h3><i class="pi pi-bolt"></i> Event Stream</h3>
      <div class="stream-controls">
        <Select v-model="domainFilter" :options="domainOptions" placeholder="Все домены"
          showClear class="domain-select" />
        <SelectButton v-model="viewMode" :options="viewModes" optionLabel="label" optionValue="value" />
        <Button :icon="paused ? 'pi pi-play' : 'pi pi-pause'" :severity="paused ? 'success' : 'secondary'"
          text @click="paused = !paused" v-tooltip="paused ? 'Resume' : 'Pause'" />
        <Button icon="pi pi-refresh" severity="secondary" text @click="loadEvents" :loading="loading" />
      </div>
    </div>

    <!-- Predictions bar -->
    <div v-if="predictions" class="predictions-bar">
      <div class="pred-item" v-for="p in predictions.predictions?.slice(0, 3)" :key="p.type">
        <span class="pred-prob">{{ (p.probability * 100).toFixed(0) }}%</span>
        <span class="pred-type">{{ p.type }}</span>
      </div>
      <div v-if="predictions.avgTimeToNext" class="pred-eta">
        <i class="pi pi-clock"></i> ~{{ predictions.avgTimeToNext }}
      </div>
    </div>

    <!-- Stream view -->
    <div v-if="viewMode === 'stream'" class="event-stream" ref="streamEl">
      <TransitionGroup name="event">
        <div v-for="ev in filteredEvents" :key="ev.id" class="event-row"
          :class="['severity-' + getSeverity(ev), { selected: selectedEvent?.id === ev.id }]"
          @click="selectEvent(ev)">
          <span class="ev-time">{{ formatTime(ev.timestamp) }}</span>
          <span class="ev-domain" :style="{ background: getDomainColor(ev.domain) }">{{ ev.domain }}</span>
          <span class="ev-type">{{ ev.shortType }}</span>
          <span class="ev-value" v-if="ev.title">{{ ev.title }}</span>
          <span class="ev-individual" v-if="ev.individualId">#{{ ev.individualId }}</span>
        </div>
      </TransitionGroup>
      <div v-if="filteredEvents.length === 0" class="empty-state">
        <i class="pi pi-inbox"></i>
        <p>Нет событий{{ domainFilter ? ' в домене ' + domainFilter : '' }}</p>
      </div>
    </div>

    <!-- Table view -->
    <div v-if="viewMode === 'table'" class="event-table">
      <DataTable :value="filteredEvents" scrollable scrollHeight="calc(100vh - 20rem)"
        :rows="50" paginator stripedRows size="small"
        selectionMode="single" v-model:selection="selectedEvent">
        <Column field="timestamp" header="Время" :sortable="true" style="width: 140px">
          <template #body="{ data }">{{ formatTime(data.timestamp) }}</template>
        </Column>
        <Column field="domain" header="Домен" :sortable="true" style="width: 100px">
          <template #body="{ data }">
            <Tag :value="data.domain" :style="{ background: getDomainColor(data.domain) }" />
          </template>
        </Column>
        <Column field="type" header="Событие" :sortable="true" />
        <Column field="title" header="Описание" />
        <Column field="individualId" header="Индивид" style="width: 90px" />
      </DataTable>
    </div>

    <!-- Event detail panel -->
    <div v-if="selectedEvent" class="event-detail">
      <div class="detail-header">
        <h4>{{ selectedEvent.type }}</h4>
        <Button icon="pi pi-times" text size="small" @click="selectedEvent = null" />
      </div>
      <div class="detail-body">
        <div class="detail-row"><span>ID:</span> <code>{{ selectedEvent.id }}</code></div>
        <div class="detail-row"><span>Время:</span> {{ selectedEvent.timestamp }}</div>
        <div class="detail-row"><span>Домен:</span> {{ selectedEvent.domain }}</div>
        <div class="detail-row" v-if="selectedEvent.individualId"><span>Индивид:</span> #{{ selectedEvent.individualId }}</div>
        <div class="detail-row" v-if="selectedEvent.title"><span>Значение:</span> {{ selectedEvent.title }}</div>
        <div class="detail-row" v-if="selectedEvent.causes?.length">
          <span>Причины:</span> {{ selectedEvent.causes.join(', ') }}
        </div>
        <!-- Predict next -->
        <div v-if="eventPrediction" class="detail-prediction">
          <h5>Что дальше?</h5>
          <div v-for="p in eventPrediction.predictions?.slice(0, 5)" :key="p.type" class="pred-row">
            <div class="pred-bar" :style="{ width: (p.probability * 100) + '%' }"></div>
            <span>{{ p.type }} — {{ (p.probability * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, inject } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'

const api = inject('eventEngineApi')
const loading = ref(false)
const paused = ref(false)
const domainFilter = ref(null)
const viewMode = ref('stream')
const selectedEvent = ref(null)
const events = ref([])
const predictions = ref(null)
const eventPrediction = ref(null)

const viewModes = [
  { label: 'Stream', value: 'stream' },
  { label: 'Table', value: 'table' },
]

const DOMAIN_COLORS = {
  dev: '#3b82f6', ops: '#10b981', infra: '#f59e0b', twin: '#8b5cf6',
  reg: '#ef4444', risk: '#f97316', market: '#06b6d4', swarm: '#ec4899',
  train: '#84cc16', strategy: '#6366f1', session: '#94a3b8', content: '#78716c',
  prediction: '#a855f7',
}

const domainOptions = computed(() => {
  const domains = new Set(events.value.map(e => e.domain))
  return [...domains].sort().map(d => ({ label: d, value: d }))
})

const filteredEvents = computed(() => {
  let evs = events.value
  if (domainFilter.value) evs = evs.filter(e => e.domain === domainFilter.value)
  return evs
})

function parseEvent(raw) {
  const type = raw.val || ''
  const domain = type.includes('.') ? type.split('.')[0] : 'other'
  const shortType = type.includes('.') ? type.split('.').slice(1).join('.') : type
  const value = raw.reqs?.['Значение']?.value || ''
  const title = value.split('\n')[0].substring(0, 120)
  const tsRaw = raw.reqs?.['Временная метка']?.value || ''
  const individualId = raw.reqs?.['Индивид']?.value || null
  let causes = []
  try {
    const c = JSON.parse(raw.reqs?.['Причины']?.value || '[]')
    causes = Array.isArray(c) ? c : c.c || []
  } catch {}

  return { id: raw.id, type, domain, shortType, title, timestamp: tsRaw, individualId, causes, raw }
}

function getSeverity(ev) {
  if (ev.type.includes('failed') || ev.type.includes('blocked') || ev.type.includes('violation')) return 'error'
  if (ev.type.includes('warning') || ev.type.includes('anomaly')) return 'warn'
  if (ev.type.includes('succeeded') || ev.type.includes('completed') || ev.type.includes('deployed')) return 'success'
  return 'info'
}

function getDomainColor(domain) {
  return DOMAIN_COLORS[domain] || '#64748b'
}

function formatTime(ts) {
  if (!ts) return ''
  // Handle "14.03.2026 13:28:47" format
  if (ts.includes('.') && ts.includes(':')) {
    const parts = ts.split(' ')
    return parts[1] || ts
  }
  return ts
}

async function loadEvents() {
  loading.value = true
  try {
    const { data } = await api.get('/events?limit=200')
    if (data.success) {
      events.value = (data.data || []).map(parseEvent).sort((a, b) => {
        return (b.timestamp || '').localeCompare(a.timestamp || '')
      })
    }
  } catch (e) { console.error('Failed to load events', e) }
  loading.value = false
}

async function loadPredictions() {
  try {
    const lastType = events.value[0]?.type
    if (!lastType) return
    const { data } = await api.get(`/predictions/next/${encodeURIComponent(lastType)}`)
    if (data.success) predictions.value = data.data
  } catch {}
}

watch(selectedEvent, async (ev) => {
  if (!ev) { eventPrediction.value = null; return }
  try {
    const { data } = await api.get(`/predictions/next/${encodeURIComponent(ev.type)}`)
    if (data.success) eventPrediction.value = data.data
  } catch { eventPrediction.value = null }
})

function selectEvent(ev) {
  selectedEvent.value = selectedEvent.value?.id === ev.id ? null : ev
}

// WebSocket live updates
let wsInterval = null
onMounted(async () => {
  await loadEvents()
  await loadPredictions()
  // Poll every 10s for new events (WebSocket handled at parent level)
  wsInterval = setInterval(() => {
    if (!paused.value) loadEvents()
  }, 10000)
})

onUnmounted(() => {
  if (wsInterval) clearInterval(wsInterval)
})
</script>

<style scoped>
.event-stream-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 8px;
}

.panel-toolbar h3 {
  margin: 0;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.stream-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.domain-select { width: 160px; }

/* Predictions bar */
.predictions-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  background: var(--p-surface-50);
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 0.8rem;
}

.pred-item {
  display: flex;
  gap: 4px;
  align-items: center;
}

.pred-prob {
  font-weight: 700;
  color: var(--p-primary-color);
}

.pred-type { color: var(--p-text-muted-color); }

.pred-eta {
  margin-left: auto;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Stream view */
.event-stream {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-card);
}

.event-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--p-surface-100);
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.15s;
}

.event-row:hover { background: var(--p-surface-50); }
.event-row.selected { background: var(--p-primary-50); }

.event-row.severity-error { border-left: 3px solid #ef4444; }
.event-row.severity-warn { border-left: 3px solid #f59e0b; }
.event-row.severity-success { border-left: 3px solid #10b981; }
.event-row.severity-info { border-left: 3px solid transparent; }

.ev-time {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  min-width: 60px;
}

.ev-domain {
  padding: 1px 6px;
  border-radius: 4px;
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  min-width: 50px;
  text-align: center;
}

.ev-type {
  font-weight: 500;
  min-width: 120px;
}

.ev-value {
  flex: 1;
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ev-individual {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

/* Event detail */
.event-detail {
  margin-top: 8px;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-card);
  max-height: 300px;
  overflow-y: auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--p-surface-100);
}

.detail-header h4 { margin: 0; font-size: 0.95rem; }

.detail-body { padding: 8px 12px; }

.detail-row {
  display: flex;
  gap: 8px;
  padding: 3px 0;
  font-size: 0.85rem;
}

.detail-row span:first-child {
  font-weight: 600;
  min-width: 80px;
  color: var(--p-text-muted-color);
}

.detail-prediction {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--p-surface-100);
}

.detail-prediction h5 {
  margin: 0 0 4px;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.pred-row {
  position: relative;
  padding: 3px 8px;
  font-size: 0.8rem;
  margin: 2px 0;
}

.pred-bar {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  background: var(--p-primary-50);
  border-radius: 4px;
  z-index: 0;
}

.pred-row span { position: relative; z-index: 1; }

/* Table view */
.event-table { flex: 1; }

/* Animation */
.event-enter-active { transition: all 0.3s ease; }
.event-enter-from { opacity: 0; transform: translateY(-10px); }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: var(--p-text-muted-color);
}

.empty-state i { font-size: 2rem; margin-bottom: 8px; }
</style>
