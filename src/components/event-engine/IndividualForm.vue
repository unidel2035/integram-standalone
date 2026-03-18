<template>
  <div class="individual-form">
    <div class="panel-toolbar">
      <h3>Индивиды</h3>
      <div class="toolbar-actions">
        <Select v-model="selectedConceptId" :options="concepts" optionLabel="val" optionValue="id"
          placeholder="Все концепты" class="concept-select" @change="loadIndividuals" showClear />
        <Button label="Создать" icon="pi pi-plus" size="small" @click="showCreate = true"
          :disabled="!selectedConceptId" />
      </div>
    </div>

    <!-- Individuals list -->
    <DataTable :value="individuals" :loading="loading" stripedRows size="small"
      selectionMode="single" v-model:selection="selectedIndividual" dataKey="id"
      @row-select="onSelect" class="mb-3">
      <Column field="val" header="Имя" sortable />
      <Column header="Концепт">
        <template #body="{ data }">
          {{ getConceptName(data.reqs?.['Концепт']?.value) }}
        </template>
      </Column>
      <Column header="Статус">
        <template #body="{ data }">
          <Tag :value="data.reqs?.['Статус']?.value || 'active'"
            :severity="data.reqs?.['Статус']?.value === 'archived' ? 'warn' : 'success'" />
        </template>
      </Column>
      <Column header="Модель">
        <template #body="{ data }">
          {{ getModelName(data.reqs?.['Модель']?.value) }}
        </template>
      </Column>
      <Column header="События" style="width: 100px">
        <template #body="{ data }">
          <Tag :value="String(eventCounts[data.id] || 0)" size="small" severity="info" />
        </template>
      </Column>
    </DataTable>

    <!-- Selected individual detail -->
    <div v-if="selectedIndividual && modelTree.length > 0" class="individual-detail">
      <div class="detail-header">
        <h4>{{ selectedIndividual.val }}</h4>
        <div class="detail-meta">
          <Tag :value="getModelName(selectedIndividual.reqs?.['Модель']?.value)" severity="info" />
          <Tag :value="selectedIndividual.reqs?.['Статус']?.value || 'active'" severity="success" />
          <Tag :value="subjectEvents.length + ' событий'" severity="secondary" />
        </div>
      </div>

      <!-- Validation errors -->
      <Message v-for="err in validationErrors" :key="err" severity="error" :closable="false" class="mb-2">
        {{ err }}
      </Message>

      <!-- Tabs: Form / Timeline / Execute -->
      <div class="detail-tabs">
        <Button :label="'Форма (' + flattenTree(modelTree).length + ')'" size="small"
          :severity="activeTab === 'form' ? undefined : 'secondary'"
          :text="activeTab !== 'form'" @click="activeTab = 'form'" />
        <Button :label="'Таймлайн (' + subjectEvents.length + ')'" size="small"
          :severity="activeTab === 'timeline' ? undefined : 'secondary'"
          :text="activeTab !== 'timeline'" @click="activeTab = 'timeline'; loadTimeline()" />
        <Button label="Исполнить модель" size="small" icon="pi pi-play"
          :severity="activeTab === 'execute' ? undefined : 'secondary'"
          :text="activeTab !== 'execute'" @click="activeTab = 'execute'" />
      </div>

      <!-- TAB: Form -->
      <div v-if="activeTab === 'form'" class="tab-content">
        <div class="model-form">
          <div v-for="node in flattenTree(modelTree)" :key="node.id" class="form-field"
            :style="{ marginLeft: (node.depth * 20) + 'px' }">
            <label :class="{ required: getConstraint(node, 'required') }">
              {{ node.val }}
              <Tag v-if="node.reqs?.['Тип данных']?.value" :value="node.reqs['Тип данных'].value" size="small" severity="info" />
              <Tag v-if="getConstraint(node, 'immutable')" value="immutable" size="small" severity="warn" />
              <Tag v-if="getConstraint(node, 'unique')" value="unique" size="small" severity="contrast" />
            </label>

            <!-- BasicType / Text -->
            <InputText v-if="isTextType(node)" v-model="formValues[node.id]"
              :disabled="isDisabled(node)" class="w-full"
              :placeholder="getConstraint(node, 'default') ? 'По умолчанию: ' + getConstraint(node, 'default') : ''" />

            <!-- Numeric -->
            <InputNumber v-else-if="isNumericType(node)" v-model="formValues[node.id]"
              :disabled="isDisabled(node)" class="w-full" />

            <!-- Date -->
            <DatePicker v-else-if="isDateType(node)" v-model="formValues[node.id]"
              :disabled="isDisabled(node)" class="w-full" dateFormat="yy-mm-dd" />

            <!-- Boolean -->
            <Checkbox v-else-if="isBooleanType(node)" v-model="formValues[node.id]"
              :binary="true" :disabled="isDisabled(node)" />

            <!-- EnumType -->
            <Select v-else-if="isEnumType(node)" v-model="formValues[node.id]"
              :options="getEnumOptions(node)" :disabled="isDisabled(node)" class="w-full" />

            <!-- Relation -->
            <Select v-else-if="isRelationType(node)" v-model="formValues[node.id]"
              :options="rangeIndividuals" optionLabel="val" optionValue="id"
              :disabled="isDisabled(node)" placeholder="Выберите индивид" class="w-full" />

            <!-- Default: text -->
            <InputText v-else v-model="formValues[node.id]"
              :disabled="isDisabled(node)" class="w-full" />

            <small v-if="getConstraint(node, 'setValue')" class="computed-hint">
              Автовычисление: {{ getConstraint(node, 'setValue') }}
            </small>
            <small v-if="getConstraint(node, 'default') && !formValues[node.id]" class="default-hint">
              По умолчанию: {{ getConstraint(node, 'default') }}
            </small>
          </div>
        </div>

        <!-- Cause selection -->
        <div v-if="subjectEvents.length > 0" class="cause-selector">
          <label>Причинные события (что вызвало эти изменения):</label>
          <div class="cause-chips">
            <Tag v-for="ev in subjectEvents" :key="ev.id"
              :value="ev.val + ': ' + (ev.reqs?.['Значение']?.value || '').substring(0, 20)"
              size="small"
              :severity="selectedCauses.includes(ev.id) ? 'success' : 'secondary'"
              class="cause-chip"
              @click="toggleCause(ev.id)" />
          </div>
        </div>

        <div class="form-actions">
          <Button label="Сохранить (с валидацией)" icon="pi pi-check" @click="saveValidated" :loading="saving" />
          <Button label="Сохранить (без валидации)" icon="pi pi-save" severity="secondary" text
            @click="saveEvents" :loading="saving" />
        </div>
      </div>

      <!-- TAB: Timeline -->
      <div v-if="activeTab === 'timeline'" class="tab-content">
        <div v-if="timeline.length === 0" class="empty-hint">Нет событий</div>
        <div class="event-timeline">
          <div v-for="(ev, idx) in timeline" :key="ev.id" class="timeline-event">
            <div class="timeline-connector">
              <div class="timeline-dot" :class="{ 'first': idx === 0 }"></div>
              <div v-if="idx < timeline.length - 1" class="timeline-line"></div>
            </div>
            <div class="timeline-body">
              <div class="timeline-event-header">
                <strong>{{ ev.property }}</strong>
                <Tag :value="ev.actorName" size="small"
                  :severity="ev.actorType === 'human' ? 'info' : ev.actorType === 'sensor' ? 'success' : 'warn'" />
                <span class="timeline-ts">{{ formatTime(ev.timestamp) }}</span>
              </div>
              <div class="timeline-value">{{ ev.value }}</div>
              <div v-if="ev.causedBy > 0" class="timeline-causes">
                <i class="pi pi-link"></i> {{ ev.causedBy }} причин
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB: Execute -->
      <div v-if="activeTab === 'execute'" class="tab-content">
        <Message severity="info" :closable="false">
          Исполнение модели проверяет ВСЕ ограничения (required, immutable, unique, condition, setValue)
          и создаёт предметные события с причинными связями одним пакетом.
        </Message>

        <div class="model-form">
          <div v-for="node in flattenTree(modelTree)" :key="node.id" class="form-field"
            :style="{ marginLeft: (node.depth * 20) + 'px' }">
            <label :class="{ required: getConstraint(node, 'required') }">
              {{ node.val }}
              <Tag v-if="getConstraint(node, 'required')" value="required" size="small" severity="danger" />
              <Tag v-if="getConstraint(node, 'setValue')" value="auto" size="small" severity="success" />
            </label>
            <InputText v-model="executeValues[node.id]" class="w-full"
              :disabled="!!getConstraint(node, 'setValue')"
              :placeholder="getConstraint(node, 'default') || ''" />
          </div>
        </div>

        <div class="form-actions">
          <Button label="Исполнить модель" icon="pi pi-play" severity="success" @click="executeModel" :loading="executing" />
        </div>

        <div v-if="executeResult" class="execute-result">
          <Message v-if="executeResult.success" severity="success" :closable="false">
            Создано {{ executeResult.results?.length || 0 }} событий
          </Message>
          <Message v-for="err in (executeResult.errors || [])" :key="err.property" severity="error" :closable="false">
            {{ err.property }}: {{ err.error }}
          </Message>
          <DataTable v-if="executeResult.results?.length" :value="executeResult.results" size="small" stripedRows>
            <Column field="property" header="Свойство" />
            <Column field="value" header="Значение" />
            <Column header="Ограничения">
              <template #body="{ data }">
                <Tag v-for="c in data.constraints" :key="c" :value="c" size="small" severity="secondary" class="mr-1" />
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
    </div>

    <!-- Create Individual Dialog -->
    <Dialog v-model:visible="showCreate" header="Создать индивид" modal :style="{ width: '400px' }">
      <div class="form-grid">
        <label>Имя</label>
        <InputText v-model="createForm.name" class="w-full" />
        <label>Модель</label>
        <Select v-model="createForm.modelId" :options="models" optionLabel="val" optionValue="id"
          class="w-full" placeholder="Выберите модель" />
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="showCreate = false" />
        <Button label="Создать" @click="create" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, inject } from 'vue'
import axios from 'axios'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import DatePicker from 'primevue/datepicker'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'

const props = defineProps({
  conceptId: { type: [String, Number], default: null },
  individualId: { type: [String, Number], default: null },
})

const API = inject('eventEngineAPI')
const currentActorId = inject('currentActorId', ref(null))
const selectedApplicationId = inject('selectedApplicationId', ref(null))

function buildUrl(path) {
  const appId = selectedApplicationId.value
  if (!appId) return `${API}${path}`
  const sep = path.includes('?') ? '&' : '?'
  return `${API}${path}${sep}applicationId=${appId}`
}

const concepts = ref([])
const models = ref([])
const individuals = ref([])
const modelTree = ref([])
const subjectEvents = ref([])
const rangeIndividuals = ref([])
const timeline = ref([])
const selectedConceptId = ref(props.conceptId)
const selectedIndividual = ref(null)
const formValues = ref({})
const executeValues = ref({})
const selectedCauses = ref([])
const validationErrors = ref([])
const eventCounts = ref({})
const loading = ref(false)
const saving = ref(false)
const executing = ref(false)
const showCreate = ref(false)
const createForm = ref({ name: '', modelId: null })
const activeTab = ref('form')
const executeResult = ref(null)

function getModelName(modelId) {
  return models.value.find(m => String(m.id) === String(modelId))?.val || '—'
}

function getConceptName(conceptId) {
  return concepts.value.find(c => String(c.id) === String(conceptId))?.val || '—'
}

function flattenTree(nodes, depth = 0) {
  const result = []
  for (const node of nodes) {
    result.push({ ...node, depth })
    if (node.children) result.push(...flattenTree(node.children, depth + 1))
  }
  return result
}

function getConstraint(node, key) {
  try {
    const c = JSON.parse(node.reqs?.['Ограничения']?.value || '{}')
    return c[key]
  } catch { return null }
}

function isTextType(node) {
  const dt = node.reqs?.['Тип данных']?.value
  return dt === 'BasicType' || dt === 'Text' || !dt
}
function isNumericType(node) { return node.reqs?.['Тип данных']?.value === 'Numeric' }
function isDateType(node) { return node.reqs?.['Тип данных']?.value === 'Date' }
function isBooleanType(node) { return node.reqs?.['Тип данных']?.value === 'Boolean' }
function isEnumType(node) { return node.reqs?.['Тип данных']?.value === 'EnumType' }
function isRelationType(node) { return node.reqs?.['Тип свойства']?.value === 'relation' }

function isDisabled(node) {
  return !!getConstraint(node, 'immutable') && !!formValues.value[node.id]
}

function getEnumOptions(node) {
  try {
    return JSON.parse(node.reqs?.['Допустимые значения']?.value || '[]')
  } catch { return [] }
}

function toggleCause(eventId) {
  const idx = selectedCauses.value.indexOf(eventId)
  if (idx >= 0) selectedCauses.value.splice(idx, 1)
  else selectedCauses.value.push(eventId)
}

function formatTime(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return ts }
}

async function load() {
  loading.value = true
  try {
    const [cRes, mRes, iRes] = await Promise.all([
      axios.get(buildUrl('/concepts')),
      axios.get(buildUrl('/models')),
      axios.get(buildUrl('/individuals')),
    ])
    if (cRes.data.success) concepts.value = cRes.data.data
    if (mRes.data.success) models.value = mRes.data.data
    // Показать всех индивидов сразу (без фильтра по концепту)
    if (iRes.data.success) individuals.value = iRes.data.data.filter(i => !i.val.startsWith('__test'))
    if (selectedConceptId.value) await loadIndividuals()
  } catch (e) { console.error(e) }
  loading.value = false
}

async function loadIndividuals() {
  try {
    const basePath = selectedConceptId.value
      ? `/individuals?conceptId=${selectedConceptId.value}`
      : `/individuals`
    const url = buildUrl(basePath)
    const { data } = await axios.get(url)
    if (data.success) {
      individuals.value = data.data.filter(i => !i.val.startsWith('__test') && !i.val.startsWith('__vp_'))
      // Load event counts per individual
      const counts = {}
      for (const ind of data.data) {
        try {
          const evRes = await axios.get(`${API}/individuals/${ind.id}/events`)
          if (evRes.data.success) counts[ind.id] = evRes.data.data.length
        } catch { counts[ind.id] = 0 }
      }
      eventCounts.value = counts
    }
  } catch (e) { console.error(e) }
}

async function onSelect(event) {
  if (!event.data) return
  const ind = event.data
  formValues.value = {}
  selectedCauses.value = []
  validationErrors.value = []
  executeResult.value = null

  const modelId = ind.reqs?.['Модель']?.value
  if (modelId) {
    try {
      const { data } = await axios.get(`${API}/models/${modelId}/tree`)
      if (data.success) modelTree.value = data.data
    } catch (e) { console.error(e) }
  }
  // Load existing subject events
  try {
    const { data } = await axios.get(`${API}/individuals/${ind.id}/events`)
    if (data.success) {
      subjectEvents.value = data.data
      for (const ev of data.data) {
        const meId = ev.reqs?.['Модельное событие']?.value
        if (meId) formValues.value[meId] = ev.reqs?.['Значение']?.value
      }
    }
  } catch (e) { console.error(e) }
  // Load range individuals
  try {
    const { data } = await axios.get(`${API}/individuals`)
    if (data.success) rangeIndividuals.value = data.data
  } catch (e) { console.error(e) }
}

async function loadTimeline() {
  if (!selectedIndividual.value) return
  try {
    const { data } = await axios.get(`${API}/individuals/${selectedIndividual.value.id}/timeline`)
    if (data.success) timeline.value = data.data
  } catch (e) {
    console.error(e)
    timeline.value = []
  }
}

async function create() {
  saving.value = true
  try {
    await axios.post(`${API}/individuals`, {
      name: createForm.value.name,
      conceptId: selectedConceptId.value,
      modelId: createForm.value.modelId,
      actorId: currentActorId.value,
    })
    showCreate.value = false
    createForm.value = { name: '', modelId: null }
    await loadIndividuals()
  } catch (e) { console.error(e) }
  saving.value = false
}

async function saveValidated() {
  if (!selectedIndividual.value) return
  saving.value = true
  validationErrors.value = []
  try {
    let prevEventId = null
    const allFlat = flattenTree(modelTree.value)
    for (const node of allFlat) {
      const value = formValues.value[node.id]
      if (value === undefined || value === null || value === '') continue
      try {
        const causes = [...selectedCauses.value]
        if (prevEventId) causes.push(prevEventId)
        const { data } = await axios.post(`${API}/individuals/${selectedIndividual.value.id}/validated-event`, {
          name: node.val,
          modelEventId: node.id,
          value: String(value),
          actorId: currentActorId.value,
          causes,
        })
        if (data.success && data.data) {
          prevEventId = data.data.id || data.data.obj
        }
      } catch (e) {
        validationErrors.value.push(e.response?.data?.error || e.message)
      }
    }
    await onSelect({ data: selectedIndividual.value })
  } catch (e) { console.error(e) }
  saving.value = false
}

async function saveEvents() {
  if (!selectedIndividual.value) return
  saving.value = true
  try {
    let prevEventId = null
    for (const [modelEventId, value] of Object.entries(formValues.value)) {
      if (value === undefined || value === null || value === '') continue
      const causes = [...selectedCauses.value]
      if (prevEventId) causes.push(prevEventId)
      const allFlat = flattenTree(modelTree.value)
      const node = allFlat.find(n => String(n.id) === String(modelEventId))
      const { data } = await axios.post(`${API}/individuals/${selectedIndividual.value.id}/events`, {
        name: node?.val || 'event',
        modelEventId,
        value: String(value),
        actorId: currentActorId.value,
        causes,
      })
      if (data.success && data.data) {
        prevEventId = data.data.id || data.data.obj
      }
    }
    await onSelect({ data: selectedIndividual.value })
  } catch (e) { console.error(e) }
  saving.value = false
}

async function executeModel() {
  if (!selectedIndividual.value) return
  executing.value = true
  executeResult.value = null
  try {
    const modelId = selectedIndividual.value.reqs?.['Модель']?.value
    const { data } = await axios.post(`${API}/individuals/${selectedIndividual.value.id}/execute`, {
      modelId,
      actorId: currentActorId.value,
      values: executeValues.value,
    })
    if (data.success) {
      executeResult.value = data.data
      await onSelect({ data: selectedIndividual.value })
    }
  } catch (e) {
    executeResult.value = { success: false, errors: [{ property: 'execution', error: e.response?.data?.error || e.message }] }
  }
  executing.value = false
}

watch(() => props.conceptId, (val) => {
  if (val) { selectedConceptId.value = val; loadIndividuals() }
})
watch(selectedApplicationId, () => load())

onMounted(load)
</script>

<style scoped>
.individual-form { max-width: 1100px; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.panel-toolbar h3 { margin: 0; }
.toolbar-actions { display: flex; gap: 8px; align-items: center; }
.concept-select { width: 200px; }
.mb-3 { margin-bottom: 16px; }
.mb-2 { margin-bottom: 8px; }
.mr-1 { margin-right: 4px; }

.individual-detail {
  margin-top: 16px; padding: 16px;
  background: var(--p-surface-card); border-radius: 8px;
  border: 1px solid var(--p-surface-border);
}
.detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.detail-header h4 { margin: 0; }
.detail-meta { display: flex; gap: 6px; }

.detail-tabs { display: flex; gap: 4px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--p-surface-border); }
.tab-content { }

.model-form { display: flex; flex-direction: column; gap: 12px; }
.form-field { display: flex; flex-direction: column; gap: 4px; }
.form-field label { font-weight: 500; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; }
.form-field label.required::after { content: '*'; color: var(--p-red-500); }
.computed-hint { color: var(--p-text-muted-color); font-style: italic; }
.default-hint { color: var(--p-primary-color); font-size: 0.8rem; }
.form-actions { margin-top: 16px; display: flex; gap: 8px; }

/* Cause selector */
.cause-selector { margin-top: 16px; padding: 12px; background: var(--p-surface-50); border-radius: 6px; }
.cause-selector label { font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; display: block; }
.cause-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.cause-chip { cursor: pointer; transition: opacity 0.2s; }
.cause-chip:hover { opacity: 0.8; }

/* Timeline */
.event-timeline { display: flex; flex-direction: column; }
.timeline-event { display: flex; gap: 12px; }
.timeline-connector { display: flex; flex-direction: column; align-items: center; width: 20px; }
.timeline-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--p-primary-color); border: 2px solid var(--p-surface-card); flex-shrink: 0; }
.timeline-dot.first { background: var(--p-green-500); width: 14px; height: 14px; }
.timeline-line { width: 2px; flex: 1; background: var(--p-surface-300); min-height: 20px; }
.timeline-body { flex: 1; padding-bottom: 16px; }
.timeline-event-header { display: flex; align-items: center; gap: 8px; }
.timeline-event-header strong { font-size: 0.9rem; }
.timeline-ts { font-size: 0.8rem; color: var(--p-text-muted-color); margin-left: auto; }
.timeline-value { font-size: 0.95rem; margin-top: 4px; padding: 4px 8px; background: var(--p-surface-100); border-radius: 4px; }
.timeline-causes { font-size: 0.8rem; color: var(--p-text-muted-color); margin-top: 4px; display: flex; align-items: center; gap: 4px; }

/* Execute result */
.execute-result { margin-top: 16px; }

.empty-hint { color: var(--p-text-muted-color); text-align: center; padding: 20px; }

.form-grid { display: grid; grid-template-columns: 80px 1fr; gap: 10px; align-items: center; }
</style>
