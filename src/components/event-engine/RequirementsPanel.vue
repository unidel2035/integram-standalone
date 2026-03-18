<template>
  <div class="req-panel">
    <div class="req-toolbar">
      <h3>Требования MBSE</h3>
      <div class="req-filters">
        <Select v-model="filterType" :options="typeOptions" optionLabel="label" optionValue="value"
          placeholder="Тип" showClear class="req-filter" />
        <Select v-model="filterPriority" :options="priorityOptions" optionLabel="label" optionValue="value"
          placeholder="Приоритет" showClear class="req-filter" />
        <Select v-model="filterStatus" :options="statusOptions" optionLabel="label" optionValue="value"
          placeholder="Статус" showClear class="req-filter" />
      </div>
      <div class="req-actions">
        <Button icon="pi pi-plus" label="Требование" size="small" @click="openCreate" />
        <Button icon="pi pi-table" label="Матрица" size="small" severity="secondary" @click="showMatrix = true" />
        <Button icon="pi pi-refresh" icon-pos="right" size="small" severity="secondary" text @click="load" :loading="loading" />
      </div>
    </div>

    <!-- Coverage bar -->
    <div class="req-coverage" v-if="coverage">
      <span>Покрытие: {{ coverage.verified }}/{{ coverage.total }} ({{ coverage.coverage }}%)</span>
      <ProgressBar :value="coverage.coverage" :showValue="false" style="height: 8px; flex: 1;" />
    </div>

    <!-- Requirements table -->
    <DataTable :value="filteredRequirements" :loading="loading" stripedRows size="small"
      selectionMode="single" v-model:selection="selectedReq" @row-dblclick="onRowDblClick"
      scrollable scrollHeight="flex" class="req-table">
      <Column field="code" header="Код" style="width: 100px">
        <template #body="{ data }">{{ data.reqs['Код']?.value || '-' }}</template>
      </Column>
      <Column field="val" header="Название" style="min-width: 200px">
        <template #body="{ data }">{{ data.val }}</template>
      </Column>
      <Column field="type" header="Тип" style="width: 120px">
        <template #body="{ data }">
          <Tag :value="typeLabel(data.reqs['Тип']?.value)" :severity="typeSeverity(data.reqs['Тип']?.value)" />
        </template>
      </Column>
      <Column field="priority" header="Приоритет" style="width: 110px">
        <template #body="{ data }">
          <Tag :value="priorityLabel(data.reqs['Приоритет']?.value)" :severity="prioritySeverity(data.reqs['Приоритет']?.value)" />
        </template>
      </Column>
      <Column field="status" header="Статус" style="width: 120px">
        <template #body="{ data }">
          <Tag :value="statusLabel(data.reqs['Статус']?.value)" :severity="statusSeverity(data.reqs['Статус']?.value)" />
        </template>
      </Column>
      <Column field="concept" header="Концепт" style="width: 150px">
        <template #body="{ data }">{{ data.reqs['Концепт СОД']?.displayValue || '-' }}</template>
      </Column>
      <Column header="" style="width: 80px">
        <template #body="{ data }">
          <Button icon="pi pi-pencil" size="small" text @click="openEdit(data)" />
          <Button icon="pi pi-trash" size="small" text severity="danger" @click="confirmDelete(data)" />
        </template>
      </Column>
    </DataTable>

    <!-- Create/Edit Dialog -->
    <Dialog v-model:visible="dialogVisible" :header="editMode ? 'Редактировать требование' : 'Новое требование'" modal style="width: 600px">
      <div class="req-form">
        <div class="field">
          <label>Код</label>
          <InputText v-model="form.code" placeholder="REQ-001" />
        </div>
        <div class="field">
          <label>Название *</label>
          <InputText v-model="form.name" placeholder="Название требования" />
        </div>
        <div class="field">
          <label>Описание</label>
          <Textarea v-model="form.description" rows="3" autoResize />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Тип</label>
            <Select v-model="form.type" :options="typeOptions" optionLabel="label" optionValue="value" placeholder="Выберите тип" />
          </div>
          <div class="field">
            <label>Приоритет</label>
            <Select v-model="form.priority" :options="priorityOptions" optionLabel="label" optionValue="value" placeholder="Приоритет" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Статус</label>
            <Select v-model="form.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Статус" />
          </div>
          <div class="field">
            <label>Концепт СОД</label>
            <Select v-model="form.conceptId" :options="concepts" optionLabel="val" optionValue="id"
              placeholder="Привязка к концепту" showClear filter />
          </div>
        </div>
        <div class="field">
          <label>Источник</label>
          <InputText v-model="form.source" placeholder="ГОСТ, ТЗ, стейкхолдер..." />
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="dialogVisible = false" />
        <Button :label="editMode ? 'Сохранить' : 'Создать'" @click="save" :loading="saving" />
      </template>
    </Dialog>

    <!-- Traceability Matrix Dialog -->
    <Dialog v-model:visible="showMatrix" header="Матрица трассировки" modal maximizable style="width: 90vw; max-width: 1200px">
      <TraceabilityMatrix :requirements="requirements" @refresh="load" />
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'
import { useConfirm } from 'primevue/useconfirm'
import TraceabilityMatrix from './TraceabilityMatrix.vue'

const api = inject('eventEngineApi')
const confirm = useConfirm()

const loading = ref(false)
const saving = ref(false)
const requirements = ref([])
const concepts = ref([])
const coverage = ref(null)
const selectedReq = ref(null)
const dialogVisible = ref(false)
const showMatrix = ref(false)
const editMode = ref(false)
const editId = ref(null)

const filterType = ref(null)
const filterPriority = ref(null)
const filterStatus = ref(null)

const form = ref({ code: '', name: '', description: '', type: 'functional', priority: 'should', status: 'draft', source: '', conceptId: null })

const typeOptions = [
  { label: 'Функциональное', value: 'functional' },
  { label: 'Производительность', value: 'performance' },
  { label: 'Интерфейс', value: 'interface' },
  { label: 'Ограничение', value: 'constraint' },
]

const priorityOptions = [
  { label: 'Must', value: 'must' },
  { label: 'Should', value: 'should' },
  { label: 'Could', value: 'could' },
  { label: "Won't", value: 'wont' },
]

const statusOptions = [
  { label: 'Черновик', value: 'draft' },
  { label: 'Утверждено', value: 'approved' },
  { label: 'Реализовано', value: 'implemented' },
  { label: 'Верифицировано', value: 'verified' },
]

const filteredRequirements = computed(() => {
  let result = requirements.value
  if (filterType.value) result = result.filter(r => r.reqs['Тип']?.value === filterType.value)
  if (filterPriority.value) result = result.filter(r => r.reqs['Приоритет']?.value === filterPriority.value)
  if (filterStatus.value) result = result.filter(r => r.reqs['Статус']?.value === filterStatus.value)
  return result
})

function typeLabel(v) { return typeOptions.find(o => o.value === v)?.label || v || '-' }
function typeSeverity(v) { return v === 'functional' ? 'info' : v === 'performance' ? 'warn' : v === 'interface' ? 'success' : 'secondary' }
function priorityLabel(v) { return priorityOptions.find(o => o.value === v)?.label || v || '-' }
function prioritySeverity(v) { return v === 'must' ? 'danger' : v === 'should' ? 'warn' : v === 'could' ? 'info' : 'secondary' }
function statusLabel(v) { return statusOptions.find(o => o.value === v)?.label || v || '-' }
function statusSeverity(v) { return v === 'verified' ? 'success' : v === 'implemented' ? 'info' : v === 'approved' ? 'warn' : 'secondary' }

async function load() {
  loading.value = true
  try {
    const [reqResp, covResp, conResp] = await Promise.all([
      api.get('/requirements'),
      api.get('/requirement-coverage'),
      api.get('/concepts'),
    ])
    requirements.value = reqResp.data?.data || []
    coverage.value = covResp.data?.data || null
    concepts.value = conResp.data?.data || []
  } catch (e) { console.error('Failed to load requirements', e) }
  loading.value = false
}

function openCreate() {
  editMode.value = false
  editId.value = null
  form.value = { code: '', name: '', description: '', type: 'functional', priority: 'should', status: 'draft', source: '', conceptId: null }
  dialogVisible.value = true
}

function openEdit(row) {
  editMode.value = true
  editId.value = row.id
  form.value = {
    code: row.reqs['Код']?.value || '',
    name: row.val || '',
    description: row.reqs['Описание']?.value || '',
    type: row.reqs['Тип']?.value || 'functional',
    priority: row.reqs['Приоритет']?.value || 'should',
    status: row.reqs['Статус']?.value || 'draft',
    source: row.reqs['Источник']?.value || '',
    conceptId: row.reqs['Концепт СОД']?.value || null,
  }
  dialogVisible.value = true
}

function onRowDblClick(e) { openEdit(e.data) }

async function save() {
  saving.value = true
  try {
    if (editMode.value) {
      const update = {}
      if (form.value.code) update['Код'] = form.value.code
      if (form.value.description) update['Описание'] = form.value.description
      if (form.value.type) update['Тип'] = form.value.type
      if (form.value.priority) update['Приоритет'] = form.value.priority
      if (form.value.status) update['Статус'] = form.value.status
      if (form.value.source) update['Источник'] = form.value.source
      if (form.value.conceptId) update['Концепт СОД'] = form.value.conceptId
      await api.put(`/requirements/${editId.value}`, update)
    } else {
      await api.post('/requirements', form.value)
    }
    dialogVisible.value = false
    await load()
  } catch (e) { console.error('Failed to save requirement', e) }
  saving.value = false
}

function confirmDelete(row) {
  if (window.confirm(`Удалить требование "${row.val}"?`)) {
    api.delete(`/requirements/${row.id}`).then(() => load())
  }
}

onMounted(load)
</script>

<style scoped>
.req-panel { display: flex; flex-direction: column; gap: 12px; height: 100%; }
.req-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.req-toolbar h3 { margin: 0; white-space: nowrap; }
.req-filters { display: flex; gap: 8px; flex: 1; }
.req-filter { width: 140px; }
.req-actions { display: flex; gap: 4px; margin-left: auto; }
.req-coverage { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--p-surface-card); border-radius: 6px; font-size: 0.85rem; }
.req-table { flex: 1; }
.req-form { display: flex; flex-direction: column; gap: 12px; }
.req-form .field { display: flex; flex-direction: column; gap: 4px; }
.req-form .field label { font-weight: 600; font-size: 0.85rem; }
.field-row { display: flex; gap: 12px; }
.field-row .field { flex: 1; }
</style>
