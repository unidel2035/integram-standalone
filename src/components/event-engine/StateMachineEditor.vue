<template>
  <div class="fsm-editor">
    <div class="fsm-toolbar">
      <h3>Конечный автомат (FSM)</h3>
      <Select v-model="currentModelId" :options="models" optionLabel="val" optionValue="id"
        placeholder="Выберите модель" class="fsm-model-select" filter />
      <Button icon="pi pi-plus" label="Состояние" size="small" @click="openCreateState" :disabled="!currentModelId" />
      <Button icon="pi pi-download" label="Mermaid" size="small" severity="secondary" @click="exportMermaid" :disabled="!currentModelId" />
      <Button icon="pi pi-play" label="Запуск FSM" size="small" severity="success" @click="openExecute" :disabled="!currentModelId" />
      <Button icon="pi pi-refresh" size="small" severity="secondary" text @click="loadData" :loading="loading" />
    </div>

    <div class="fsm-layout" v-if="currentModelId">
      <!-- VueFlow Canvas -->
      <div class="fsm-canvas">
        <VueFlow
          :nodes="nodes"
          :edges="edges"
          :default-viewport="{ zoom: 0.9, x: 50, y: 50 }"
          :min-zoom="0.2"
          :max-zoom="3"
          :snap-to-grid="true"
          :snap-grid="[20, 20]"
          fit-view-on-init
          @node-click="onNodeClick"
          @connect="onConnect"
        >
          <Background :gap="20" />
          <Controls />
          <MiniMap />

          <template #node-stateNode="{ data }">
            <div class="fsm-node" :class="[
              `fsm-type-${data.stateType || 'normal'}`,
              { 'fsm-current': data.isCurrent }
            ]">
              <div class="fsm-node-label">{{ data.label }}</div>
              <div class="fsm-node-type" v-if="data.stateType !== 'normal'">{{ stateTypeLabel(data.stateType) }}</div>
            </div>
          </template>
        </VueFlow>
      </div>

      <!-- Side Panel -->
      <div class="fsm-side" v-if="selectedState">
        <div class="fsm-panel-header">
          <h4>{{ selectedState.val }}</h4>
          <Button icon="pi pi-times" size="small" text @click="selectedState = null" />
        </div>
        <div class="fsm-panel-body">
          <div class="field">
            <label>Название</label>
            <InputText v-model="editName" size="small" />
          </div>
          <div class="field">
            <label>Тип</label>
            <Select v-model="editType" :options="stateTypeOptions" optionLabel="label" optionValue="value" size="small" />
          </div>
          <div class="field">
            <label>Описание</label>
            <Textarea v-model="editDesc" rows="2" autoResize />
          </div>
          <Button label="Сохранить" size="small" @click="saveState" class="mt-2" />
          <Button label="Удалить" size="small" severity="danger" text @click="deleteSelectedState" class="mt-1" />
        </div>

        <!-- Transitions from this state -->
        <div class="fsm-transitions">
          <h5>Переходы из:</h5>
          <div v-for="t in outTransitions" :key="t.id" class="fsm-transition-item">
            <span>→ {{ t.reqs['В']?.displayValue || '?' }}</span>
            <small>{{ t.reqs['Триггер']?.value || '' }}</small>
            <Button icon="pi pi-trash" size="small" text severity="danger" @click="deleteTransition(t.id)" />
          </div>
        </div>
      </div>
    </div>

    <div class="fsm-empty" v-else>
      <p>Выберите модель для редактирования конечного автомата</p>
    </div>

    <!-- Create State Dialog -->
    <Dialog v-model:visible="stateDialog" header="Новое состояние" modal style="width: 450px">
      <div class="fsm-form">
        <div class="field">
          <label>Название *</label>
          <InputText v-model="stateForm.name" placeholder="Название состояния" />
        </div>
        <div class="field">
          <label>Тип</label>
          <Select v-model="stateForm.type" :options="stateTypeOptions" optionLabel="label" optionValue="value" />
        </div>
        <div class="field">
          <label>Описание</label>
          <Textarea v-model="stateForm.description" rows="2" autoResize />
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="stateDialog = false" />
        <Button label="Создать" @click="createState" :loading="saving" />
      </template>
    </Dialog>

    <!-- Execute FSM Dialog -->
    <Dialog v-model:visible="executeDialog" header="Запуск FSM" modal style="width: 450px">
      <div class="fsm-form">
        <div class="field">
          <label>Индивид</label>
          <Select v-model="executeForm.individualId" :options="individuals" optionLabel="val" optionValue="id"
            placeholder="Выберите индивида" filter />
        </div>
      </div>
      <div class="fsm-exec-result" v-if="execResult">
        <Tag v-if="execResult.nextState" severity="success">
          {{ execResult.currentState?.name }} → {{ execResult.nextState?.name }}
        </Tag>
        <Tag v-else severity="warn">{{ execResult.message }}</Tag>
      </div>
      <template #footer>
        <Button label="Закрыть" severity="secondary" text @click="executeDialog = false" />
        <Button label="Выполнить шаг" @click="executeFSM" :loading="executing" :disabled="!executeForm.individualId" />
      </template>
    </Dialog>

    <!-- Mermaid Export Dialog -->
    <Dialog v-model:visible="mermaidDialog" header="Mermaid-диаграмма" modal style="width: 600px">
      <pre class="mermaid-code">{{ mermaidCode }}</pre>
      <template #footer>
        <Button label="Копировать" icon="pi pi-copy" @click="copyMermaid" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Tag from 'primevue/tag'

const props = defineProps({ modelId: { type: String, default: null } })
const api = inject('eventEngineApi')
const injectedModelId = inject('selectedModelId', ref(null))
const selectedApplicationId = inject('selectedApplicationId', ref(null))

const loading = ref(false)
const saving = ref(false)
const executing = ref(false)
const models = ref([])
const states = ref([])
const transitions = ref([])
const individuals = ref([])
const currentModelId = ref(props.modelId || injectedModelId.value)
const selectedState = ref(null)
const editName = ref('')
const editType = ref('normal')
const editDesc = ref('')
const stateDialog = ref(false)
const executeDialog = ref(false)
const mermaidDialog = ref(false)
const mermaidCode = ref('')
const execResult = ref(null)
const stateForm = ref({ name: '', type: 'normal', description: '' })
const executeForm = ref({ individualId: null })

const stateTypeOptions = [
  { label: 'Начальное', value: 'initial' },
  { label: 'Обычное', value: 'normal' },
  { label: 'Конечное', value: 'final' },
  { label: 'Составное', value: 'composite' },
]

function stateTypeLabel(v) { return stateTypeOptions.find(o => o.value === v)?.label || v }

// Build VueFlow nodes/edges from states/transitions
const nodes = computed(() => {
  const cols = Math.max(3, Math.ceil(Math.sqrt(states.value.length)))
  return states.value.map((s, i) => ({
    id: String(s.id),
    type: 'stateNode',
    position: { x: (i % cols) * 200 + 50, y: Math.floor(i / cols) * 150 + 50 },
    data: {
      label: s.val || 'State',
      stateType: s.reqs['Тип']?.value || 'normal',
      isCurrent: false,
    },
  }))
})

const edges = computed(() => {
  return transitions.value.map(t => {
    const from = String(t.reqs['Из']?.value || '')
    const to = String(t.reqs['В']?.value || '')
    const trigger = t.reqs['Триггер']?.value || ''
    const guard = t.reqs['Охранное условие']?.value
    const action = t.reqs['Действие']?.value
    let label = trigger
    if (guard) label += ` [${guard}]`
    if (action) label += ` / ${action}`
    return {
      id: `e-${t.id}`,
      source: from,
      target: to,
      label: label || t.val,
      animated: true,
      style: { stroke: '#64748b' },
      labelStyle: { fontSize: '11px' },
      markerEnd: { type: 'arrowclosed' },
    }
  })
})

const outTransitions = computed(() => {
  if (!selectedState.value) return []
  return transitions.value.filter(t => String(t.reqs['Из']?.value) === String(selectedState.value.id))
})

watch(currentModelId, (v) => { if (v) loadData() })

function onNodeClick({ node }) {
  const s = states.value.find(st => String(st.id) === node.id)
  if (s) {
    selectedState.value = s
    editName.value = s.val || ''
    editType.value = s.reqs['Тип']?.value || 'normal'
    editDesc.value = s.reqs['Описание']?.value || ''
  }
}

async function onConnect({ source, target }) {
  if (!currentModelId.value) return
  const trigger = prompt('Триггер перехода:')
  if (trigger === null) return
  try {
    await api.post(`/models/${currentModelId.value}/transitions`, {
      fromStateId: source,
      toStateId: target,
      trigger: trigger || '',
    })
    await loadTransitions()
  } catch (e) { console.error('Failed to create transition', e) }
}

async function loadData() {
  loading.value = true
  try {
    const [mResp, iResp] = await Promise.all([
      api.get('/models'),
      api.get('/individuals'),
    ])
    models.value = mResp.data?.data || []
    individuals.value = iResp.data?.data || []
    if (currentModelId.value) {
      await Promise.all([loadStates(), loadTransitions()])
    }
  } catch (e) { console.error('Failed to load FSM data', e) }
  loading.value = false
}

async function loadStates() {
  if (!currentModelId.value) return
  const resp = await api.get(`/models/${currentModelId.value}/states`)
  states.value = resp.data?.data || []
}

async function loadTransitions() {
  if (!currentModelId.value) return
  const resp = await api.get(`/models/${currentModelId.value}/transitions`)
  transitions.value = resp.data?.data || []
}

function openCreateState() {
  stateForm.value = { name: '', type: 'normal', description: '' }
  stateDialog.value = true
}

async function createState() {
  if (!stateForm.value.name) return
  saving.value = true
  try {
    await api.post(`/models/${currentModelId.value}/states`, stateForm.value)
    stateDialog.value = false
    await loadStates()
  } catch (e) { console.error('Failed to create state', e) }
  saving.value = false
}

async function saveState() {
  if (!selectedState.value) return
  try {
    await api.put(`/states/${selectedState.value.id}`, {
      'Название': editName.value,
      'Тип': editType.value,
      'Описание': editDesc.value,
    })
    await loadStates()
    selectedState.value = null
  } catch (e) { console.error('Failed to save state', e) }
}

async function deleteSelectedState() {
  if (!selectedState.value) return
  if (!window.confirm(`Удалить состояние "${selectedState.value.val}"?`)) return
  try {
    await api.delete(`/states/${selectedState.value.id}`)
    selectedState.value = null
    await Promise.all([loadStates(), loadTransitions()])
  } catch (e) { console.error('Failed to delete state', e) }
}

async function deleteTransition(id) {
  try {
    await api.delete(`/transitions/${id}`)
    await loadTransitions()
  } catch (e) { console.error('Failed to delete transition', e) }
}

function openExecute() {
  execResult.value = null
  executeForm.value = { individualId: null }
  executeDialog.value = true
}

async function executeFSM() {
  if (!executeForm.value.individualId) return
  executing.value = true
  try {
    const resp = await api.post(`/individuals/${executeForm.value.individualId}/fsm/${currentModelId.value}`, {})
    execResult.value = resp.data?.data
  } catch (e) { console.error('FSM execution failed', e) }
  executing.value = false
}

async function exportMermaid() {
  try {
    const resp = await api.get(`/models/${currentModelId.value}/state-diagram`)
    mermaidCode.value = resp.data?.data?.mermaid || ''
    mermaidDialog.value = true
  } catch (e) { console.error('Failed to export mermaid', e) }
}

function copyMermaid() {
  navigator.clipboard.writeText(mermaidCode.value).catch(() => {})
}

watch(selectedApplicationId, () => loadData())
onMounted(loadData)
</script>

<style scoped>
.fsm-editor { display: flex; flex-direction: column; gap: 12px; height: 100%; }
.fsm-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.fsm-toolbar h3 { margin: 0; white-space: nowrap; }
.fsm-model-select { width: 200px; }
.fsm-layout { display: flex; flex: 1; gap: 12px; min-height: 400px; }
.fsm-canvas { flex: 1; border: 1px solid var(--p-surface-border); border-radius: 8px; overflow: hidden; }
.fsm-side { width: 280px; background: var(--p-surface-card); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 12px; overflow-y: auto; }
.fsm-panel-header { display: flex; align-items: center; justify-content: space-between; }
.fsm-panel-header h4 { margin: 0; }
.fsm-panel-body { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.fsm-panel-body .field { display: flex; flex-direction: column; gap: 4px; }
.fsm-panel-body .field label { font-weight: 600; font-size: 0.8rem; }
.fsm-transitions { margin-top: 16px; }
.fsm-transitions h5 { margin: 0 0 8px; font-size: 0.85rem; }
.fsm-transition-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 0.85rem; }
.fsm-transition-item small { color: var(--p-text-muted-color); flex: 1; }
.fsm-empty { display: flex; align-items: center; justify-content: center; flex: 1; color: var(--p-text-muted-color); }
.fsm-form { display: flex; flex-direction: column; gap: 12px; }
.fsm-form .field { display: flex; flex-direction: column; gap: 4px; }
.fsm-form .field label { font-weight: 600; font-size: 0.85rem; }
.fsm-exec-result { margin-top: 12px; }
.mermaid-code { background: var(--p-surface-card); padding: 12px; border-radius: 6px; font-size: 0.85rem; white-space: pre-wrap; max-height: 400px; overflow: auto; }

/* State node styles */
.fsm-node { padding: 8px 16px; border-radius: 8px; border: 2px solid #64748b; background: var(--p-surface-card); min-width: 80px; text-align: center; cursor: pointer; transition: all 0.2s; }
.fsm-node:hover { border-color: var(--p-primary-color); }
.fsm-node-label { font-weight: 600; font-size: 0.9rem; }
.fsm-node-type { font-size: 0.7rem; color: var(--p-text-muted-color); margin-top: 2px; }
.fsm-type-initial { border-color: #22c55e; border-style: solid; border-width: 3px; }
.fsm-type-final { border-color: #ef4444; border-style: double; border-width: 4px; }
.fsm-type-composite { border-color: #8b5cf6; border-style: dashed; }
.fsm-current { box-shadow: 0 0 12px rgba(59, 130, 246, 0.5); border-color: #3b82f6; }
</style>
