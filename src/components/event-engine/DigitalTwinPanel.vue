<template>
  <div class="dt-panel">
    <div class="dt-toolbar">
      <h3>Цифровой двойник</h3>
      <Select v-model="selectedIndividualId" :options="individuals" optionLabel="val" optionValue="id"
        placeholder="Выберите индивида (двойник)" class="dt-select" filter />
      <Button icon="pi pi-refresh" size="small" severity="secondary" text @click="loadAll" :loading="loading" />
    </div>

    <div class="dt-content" v-if="twin">
      <!-- Twin header -->
      <div class="dt-header-card">
        <div class="dt-avatar">
          <i class="pi pi-box" style="font-size: 2rem;" />
        </div>
        <div class="dt-info">
          <h2>{{ twin.name }}</h2>
          <div class="dt-tags">
            <Tag :value="twin.concept" severity="info" />
            <Tag :value="twin.model || 'Без модели'" severity="secondary" />
            <Tag :value="twin.status" :severity="twin.status === 'active' ? 'success' : 'warn'" />
          </div>
        </div>
        <div class="dt-metrics">
          <div class="dt-metric">
            <span class="dt-metric-value">{{ twin.eventCount }}</span>
            <span class="dt-metric-label">событий</span>
          </div>
          <div class="dt-metric" v-if="currentFsmState">
            <span class="dt-metric-value dt-state">{{ currentFsmState.val || currentFsmState.name }}</span>
            <span class="dt-metric-label">FSM состояние</span>
          </div>
          <div class="dt-metric" v-if="twin.requirements > 0">
            <span class="dt-metric-value">{{ twin.requirementsCovered }}/{{ twin.requirements }}</span>
            <span class="dt-metric-label">верифицировано</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <TabView v-model:activeIndex="activeTab">
        <!-- Tab 1: Live Status -->
        <TabPanel header="Состояние">
          <div class="dt-status-grid">
            <!-- FSM State -->
            <div class="dt-card">
              <h4>Конечный автомат (FSM)</h4>
              <div v-if="currentFsmState" class="dt-fsm-status">
                <div class="dt-fsm-current">
                  <Tag :value="currentFsmState.val || 'N/A'" size="large" severity="info" />
                  <span class="dt-fsm-type">{{ currentFsmState.reqs?.['Тип']?.value || 'normal' }}</span>
                </div>
                <div class="dt-fsm-transitions" v-if="availableTransitions.length">
                  <p>Доступные переходы:</p>
                  <div v-for="t in availableTransitions" :key="t.id" class="dt-fsm-tr">
                    <span>{{ t.reqs?.['Триггер']?.value || t.val }} → {{ t.reqs?.['В']?.displayValue || '?' }}</span>
                    <Button label="Выполнить" size="small" @click="executeFsmStep" :loading="fsmExecuting" />
                  </div>
                </div>
                <p v-else class="dt-muted">Нет доступных переходов из текущего состояния</p>
              </div>
              <p v-else class="dt-muted">FSM не настроен для этой модели. Создайте состояния в редакторе конечных автоматов.</p>
            </div>

            <!-- Properties -->
            <div class="dt-card">
              <h4>Свойства двойника</h4>
              <div class="dt-props">
                <div v-for="(val, key) in twinProperties" :key="key" class="dt-prop-row">
                  <span class="dt-prop-key">{{ key }}</span>
                  <span class="dt-prop-val">{{ val }}</span>
                </div>
                <p v-if="!Object.keys(twinProperties).length" class="dt-muted">Нет свойств</p>
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- Tab 2: Event Timeline -->
        <TabPanel header="Таймлайн">
          <div class="dt-timeline">
            <div v-for="ev in sortedEvents" :key="ev.id" class="dt-event-item"
              :class="{ 'dt-event-fsm': (ev.val || '').startsWith('FSM:') }">
              <div class="dt-event-dot"></div>
              <div class="dt-event-body">
                <div class="dt-event-name">{{ ev.val }}</div>
                <div class="dt-event-meta">
                  <span v-if="ev.reqs?.['Актор']?.displayValue">{{ ev.reqs['Актор'].displayValue }}</span>
                  <span v-if="ev.reqs?.['Значение']?.value">= {{ ev.reqs['Значение'].value }}</span>
                  <span v-if="ev.reqs?.['Дата и время']?.value" class="dt-event-time">{{ ev.reqs['Дата и время'].value }}</span>
                </div>
              </div>
            </div>
            <p v-if="!sortedEvents.length" class="dt-muted">Нет событий для этого двойника</p>
          </div>
        </TabPanel>

        <!-- Tab 3: Requirements & Verification -->
        <TabPanel header="Требования">
          <div class="dt-requirements">
            <div class="dt-req-coverage" v-if="twinRequirements.length">
              <ProgressBar :value="reqCoveragePercent" style="height: 12px;" />
              <span>{{ twinVerified }}/{{ twinRequirements.length }} верифицировано ({{ reqCoveragePercent }}%)</span>
            </div>
            <DataTable :value="twinRequirements" size="small" stripedRows>
              <Column header="Код" style="width: 100px">
                <template #body="{ data }">{{ data.reqs?.['Код']?.value || '-' }}</template>
              </Column>
              <Column field="val" header="Требование" />
              <Column header="Статус" style="width: 120px">
                <template #body="{ data }">
                  <Tag :value="data.reqs?.['Статус']?.value || 'draft'" :severity="reqStatusSeverity(data.reqs?.['Статус']?.value)" />
                </template>
              </Column>
              <Column header="Верификация" style="width: 100px">
                <template #body="{ data }">
                  <span v-if="verificationMap[data.id]" :class="'res-' + verificationMap[data.id]">
                    {{ verificationMap[data.id] === 'pass' ? '\u2714' : verificationMap[data.id] === 'fail' ? '\u2716' : '\u25CB' }}
                  </span>
                  <span v-else class="dt-muted">-</span>
                </template>
              </Column>
            </DataTable>
            <p v-if="!twinRequirements.length" class="dt-muted">Нет требований, привязанных к концепту этого двойника</p>
          </div>
        </TabPanel>

        <!-- Tab 4: SysML diagrams -->
        <TabPanel header="Диаграммы">
          <div class="dt-diagrams">
            <div class="dt-diagram-actions">
              <Button v-for="dt in diagramTypes" :key="dt.key"
                :label="dt.label" size="small"
                :severity="activeDiagram === dt.key ? undefined : 'secondary'"
                @click="loadDiagram(dt.key)" />
            </div>
            <div class="dt-diagram-render" v-html="diagramHtml"></div>
            <p v-if="!diagramHtml" class="dt-muted">Выберите тип диаграммы</p>
          </div>
        </TabPanel>
      </TabView>
    </div>

    <div class="dt-empty" v-else>
      <i class="pi pi-box" style="font-size: 3rem; opacity: 0.3;" />
      <p>Выберите индивида для просмотра его цифрового двойника</p>
      <p class="dt-muted">Цифровой двойник объединяет FSM-состояние, поток событий, требования и SysML-диаграммы</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Tag from 'primevue/tag'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ProgressBar from 'primevue/progressbar'

const api = inject('eventEngineApi')
const injectedIndividualId = inject('selectedIndividualId', ref(null))
const selectedApplicationId = inject('selectedApplicationId', ref(null))

const loading = ref(false)
const fsmExecuting = ref(false)
const individuals = ref([])
const selectedIndividualId = ref(injectedIndividualId.value)
const activeTab = ref(0)
const twin = ref(null)
const events = ref([])
const currentFsmState = ref(null)
const availableTransitions = ref([])
const twinRequirements = ref([])
const verifications = ref([])
const diagramHtml = ref('')
const activeDiagram = ref(null)

let mermaid = null

const diagramTypes = [
  { key: 'bdd', label: 'BDD' },
  { key: 'ibd', label: 'IBD' },
  { key: 'activity', label: 'Activity' },
  { key: 'requirements', label: 'Requirements' },
]

const sortedEvents = computed(() =>
  [...events.value].sort((a, b) => {
    const ta = a.reqs?.['Дата и время']?.value || ''
    const tb = b.reqs?.['Дата и время']?.value || ''
    return tb.localeCompare(ta) // newest first
  })
)

const twinProperties = computed(() => {
  if (!twin.value?.rawReqs) return {}
  const skip = ['Концепт', 'Модель', 'Статус', 'Актор']
  const props = {}
  for (const [key, val] of Object.entries(twin.value.rawReqs)) {
    if (skip.includes(key)) continue
    if (val?.value || val?.displayValue) {
      props[key] = val.displayValue || val.value
    }
  }
  return props
})

const verificationMap = computed(() => {
  const map = {}
  for (const v of verifications.value) {
    const reqId = v.reqs?.['Требование']?.value
    if (reqId) map[reqId] = v.reqs?.['Результат']?.value || 'pending'
  }
  return map
})

const twinVerified = computed(() => twinRequirements.value.filter(r => r.reqs?.['Статус']?.value === 'verified').length)
const reqCoveragePercent = computed(() => {
  const total = twinRequirements.value.length
  return total > 0 ? Math.round((twinVerified.value / total) * 100) : 0
})

function reqStatusSeverity(v) { return v === 'verified' ? 'success' : v === 'implemented' ? 'info' : v === 'approved' ? 'warn' : 'secondary' }

async function loadAll() {
  loading.value = true
  try {
    const resp = await api.get('/individuals')
    individuals.value = resp.data?.data || []
    if (selectedIndividualId.value) await loadTwin()
  } catch (e) { console.error('Failed to load individuals', e) }
  loading.value = false
}

async function loadTwin() {
  if (!selectedIndividualId.value) { twin.value = null; return }
  loading.value = true
  try {
    const ind = individuals.value.find(i => String(i.id) === String(selectedIndividualId.value))
    if (!ind) { twin.value = null; loading.value = false; return }

    const modelId = ind.reqs?.['Модель']?.value
    const conceptId = ind.reqs?.['Концепт']?.value

    // Load events for this individual
    const evResp = await api.get('/subject-events')
    const allEvents = evResp.data?.data || []
    events.value = allEvents.filter(e => String(e.reqs?.['Индивид']?.value) === String(selectedIndividualId.value))

    // Load FSM state if model exists
    currentFsmState.value = null
    availableTransitions.value = []
    if (modelId) {
      try {
        const [statesResp, transResp] = await Promise.all([
          api.get(`/models/${modelId}/states`),
          api.get(`/models/${modelId}/transitions`),
        ])
        const states = statesResp.data?.data || []
        const transitions = transResp.data?.data || []

        // Determine current state from FSM events
        const fsmEvents = events.value.filter(e => (e.val || '').startsWith('FSM:'))
        if (fsmEvents.length > 0) {
          const lastStateId = fsmEvents[fsmEvents.length - 1].val.replace('FSM:', '')
          currentFsmState.value = states.find(s => String(s.id) === lastStateId)
        }
        if (!currentFsmState.value) {
          currentFsmState.value = states.find(s => s.reqs?.['Тип']?.value === 'initial') || states[0] || null
        }

        if (currentFsmState.value) {
          availableTransitions.value = transitions.filter(t => String(t.reqs?.['Из']?.value) === String(currentFsmState.value.id))
        }
      } catch { /* no FSM data */ }
    }

    // Load requirements linked to this concept
    twinRequirements.value = []
    verifications.value = []
    if (conceptId) {
      try {
        const [reqResp, verResp] = await Promise.all([
          api.get('/requirements'),
          api.get('/verifications'),
        ])
        const allReqs = reqResp.data?.data || []
        twinRequirements.value = allReqs.filter(r => String(r.reqs?.['Концепт СОД']?.value) === String(conceptId))
        verifications.value = verResp.data?.data || []
      } catch { /* no MBSE data yet */ }
    }

    // Count concept-linked requirements verified
    const verifiedCount = twinRequirements.value.filter(r => r.reqs?.['Статус']?.value === 'verified').length

    // Build twin object
    twin.value = {
      id: ind.id,
      name: ind.val,
      concept: ind.reqs?.['Концепт']?.displayValue || 'N/A',
      model: ind.reqs?.['Модель']?.displayValue || null,
      modelId,
      status: ind.reqs?.['Статус']?.value || 'active',
      eventCount: events.value.length,
      requirements: twinRequirements.value.length,
      requirementsCovered: verifiedCount,
      rawReqs: ind.reqs || {},
    }
  } catch (e) { console.error('Failed to load twin', e) }
  loading.value = false
}

async function executeFsmStep() {
  if (!twin.value?.modelId) return
  fsmExecuting.value = true
  try {
    const resp = await api.post(`/individuals/${selectedIndividualId.value}/fsm/${twin.value.modelId}`, {})
    const result = resp.data?.data
    if (result?.nextState) {
      await loadTwin() // Reload to reflect new state
    }
  } catch (e) { console.error('FSM execution failed', e) }
  fsmExecuting.value = false
}

async function loadMermaid() {
  if (window.mermaid) { mermaid = window.mermaid; return }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'
    script.async = true
    script.onload = () => {
      mermaid = window.mermaid
      mermaid.initialize({ startOnLoad: false, theme: document.documentElement.classList.contains('p-dark') ? 'dark' : 'default', securityLevel: 'loose' })
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load Mermaid'))
    document.head.appendChild(script)
  })
}

async function loadDiagram(type) {
  if (!twin.value?.modelId) return
  activeDiagram.value = type
  try {
    await loadMermaid()
    const resp = await api.get(`/models/${twin.value.modelId}/diagrams/${type}`)
    const code = resp.data?.data?.mermaid
    if (code && mermaid) {
      const { svg } = await mermaid.render(`dt-${type}-${Date.now()}`, code)
      diagramHtml.value = svg
    }
  } catch (e) {
    diagramHtml.value = `<p style="color: var(--p-text-muted-color)">Ошибка загрузки диаграммы: ${e.message}</p>`
  }
}

watch(selectedIndividualId, () => { if (selectedIndividualId.value) loadTwin(); else twin.value = null })
watch(selectedApplicationId, () => loadAll())

onMounted(loadAll)
</script>

<style scoped>
.dt-panel { display: flex; flex-direction: column; gap: 12px; height: 100%; }
.dt-toolbar { display: flex; align-items: center; gap: 8px; }
.dt-toolbar h3 { margin: 0; white-space: nowrap; }
.dt-select { width: 300px; }
.dt-content { display: flex; flex-direction: column; gap: 16px; }

/* Header card */
.dt-header-card { display: flex; align-items: center; gap: 16px; padding: 16px 20px; background: var(--p-surface-card); border: 1px solid var(--p-surface-border); border-radius: 10px; }
.dt-avatar { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; background: var(--p-primary-color); color: white; border-radius: 12px; opacity: 0.85; }
.dt-info h2 { margin: 0 0 4px; font-size: 1.2rem; }
.dt-tags { display: flex; gap: 6px; }
.dt-metrics { margin-left: auto; display: flex; gap: 24px; }
.dt-metric { display: flex; flex-direction: column; align-items: center; }
.dt-metric-value { font-size: 1.5rem; font-weight: 700; color: var(--p-primary-color); }
.dt-metric-value.dt-state { font-size: 1rem; }
.dt-metric-label { font-size: 0.75rem; color: var(--p-text-muted-color); }

/* Status grid */
.dt-status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.dt-card { padding: 16px; background: var(--p-surface-card); border-radius: 8px; border: 1px solid var(--p-surface-border); }
.dt-card h4 { margin: 0 0 12px; font-size: 0.95rem; }

/* FSM */
.dt-fsm-current { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.dt-fsm-type { font-size: 0.8rem; color: var(--p-text-muted-color); }
.dt-fsm-tr { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; font-size: 0.9rem; }

/* Properties */
.dt-props { display: flex; flex-direction: column; gap: 4px; }
.dt-prop-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--p-surface-border); font-size: 0.85rem; }
.dt-prop-key { font-weight: 600; color: var(--p-text-muted-color); }

/* Timeline */
.dt-timeline { display: flex; flex-direction: column; gap: 0; padding-left: 20px; border-left: 2px solid var(--p-surface-border); }
.dt-event-item { display: flex; gap: 12px; padding: 8px 0; position: relative; }
.dt-event-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--p-primary-color); margin-top: 6px; margin-left: -25px; flex-shrink: 0; }
.dt-event-fsm .dt-event-dot { background: #22c55e; }
.dt-event-name { font-weight: 600; font-size: 0.9rem; }
.dt-event-meta { display: flex; gap: 8px; font-size: 0.8rem; color: var(--p-text-muted-color); }
.dt-event-time { font-style: italic; }

/* Requirements */
.dt-requirements { display: flex; flex-direction: column; gap: 12px; }
.dt-req-coverage { display: flex; align-items: center; gap: 12px; font-size: 0.85rem; }

/* Diagrams */
.dt-diagrams { display: flex; flex-direction: column; gap: 12px; }
.dt-diagram-actions { display: flex; gap: 6px; }
.dt-diagram-render { min-height: 200px; background: var(--p-surface-card); border-radius: 8px; padding: 16px; overflow: auto; }
.dt-diagram-render :deep(svg) { max-width: 100%; }

/* Empty state */
.dt-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 8px; color: var(--p-text-muted-color); text-align: center; }

.dt-muted { color: var(--p-text-muted-color); font-size: 0.85rem; }
.res-pass { color: #22c55e; font-weight: 700; }
.res-fail { color: #ef4444; font-weight: 700; }
.res-pending { color: var(--p-text-muted-color); }

@media (max-width: 768px) {
  .dt-status-grid { grid-template-columns: 1fr; }
  .dt-header-card { flex-direction: column; text-align: center; }
  .dt-metrics { margin-left: 0; }
}
</style>
