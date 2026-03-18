<template>
  <div class="trace-matrix">
    <div class="trace-toolbar">
      <Button icon="pi pi-plus" label="Трассировка" size="small" @click="openCreateTrace" />
      <Button icon="pi pi-refresh" size="small" severity="secondary" text @click="load" :loading="loading" />
      <span class="trace-stats" v-if="matrix">{{ matrix.traces?.length || 0 }} связей</span>
    </div>

    <!-- Trace list as table -->
    <DataTable :value="traces" :loading="loading" stripedRows size="small" scrollable scrollHeight="400px">
      <Column header="Источник" style="min-width: 180px">
        <template #body="{ data }">{{ data.sourceDisplay || data.sourceId }}</template>
      </Column>
      <Column header="Тип связи" style="width: 130px">
        <template #body="{ data }">
          <Tag :value="traceLabel(data.traceType)" :severity="traceSeverity(data.traceType)" />
        </template>
      </Column>
      <Column header="Цель" style="min-width: 180px">
        <template #body="{ data }">{{ data.targetDisplay || data.targetId }}</template>
      </Column>
      <Column header="" style="width: 50px">
        <template #body="{ data }">
          <Button icon="pi pi-trash" size="small" text severity="danger" @click="deleteTrace(data.traceId)" />
        </template>
      </Column>
    </DataTable>

    <!-- Heatmap matrix -->
    <div class="trace-heatmap" v-if="heatmapData.length > 0">
      <h4>Матрица трассировки</h4>
      <div class="heatmap-scroll">
        <table class="heatmap-table">
          <thead>
            <tr>
              <th></th>
              <th v-for="col in heatmapCols" :key="col.id" class="heatmap-header">
                <span class="rotated">{{ col.label }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in heatmapData" :key="row.id">
              <td class="heatmap-row-label">{{ row.label }}</td>
              <td v-for="col in heatmapCols" :key="col.id"
                class="heatmap-cell"
                :class="cellClass(row.id, col.id)"
                :title="cellTitle(row.id, col.id)"
                @click="onCellClick(row.id, col.id)">
                {{ cellSymbol(row.id, col.id) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="heatmap-legend">
        <span class="legend-item"><span class="legend-color derives"></span> derives</span>
        <span class="legend-item"><span class="legend-color satisfies"></span> satisfies</span>
        <span class="legend-item"><span class="legend-color verifies"></span> verifies</span>
        <span class="legend-item"><span class="legend-color refines"></span> refines</span>
        <span class="legend-item"><span class="legend-color allocates"></span> allocates</span>
      </div>
    </div>

    <!-- Create Trace Dialog -->
    <Dialog v-model:visible="traceDialog" header="Новая трассировка" modal style="width: 500px">
      <div class="trace-form">
        <div class="field">
          <label>Источник *</label>
          <Select v-model="traceForm.sourceId" :options="props.requirements" optionLabel="val" optionValue="id"
            placeholder="Требование-источник" filter />
        </div>
        <div class="field">
          <label>Цель *</label>
          <Select v-model="traceForm.targetId" :options="props.requirements" optionLabel="val" optionValue="id"
            placeholder="Требование-цель" filter />
        </div>
        <div class="field">
          <label>Тип связи</label>
          <Select v-model="traceForm.traceType" :options="traceTypeOptions" optionLabel="label" optionValue="value" />
        </div>
        <div class="field">
          <label>Комментарий</label>
          <InputText v-model="traceForm.comment" placeholder="Пояснение..." />
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="traceDialog = false" />
        <Button label="Создать" @click="saveTrace" :loading="saving" />
      </template>
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
import Tag from 'primevue/tag'

const props = defineProps({ requirements: { type: Array, default: () => [] } })
const emit = defineEmits(['refresh'])
const api = inject('eventEngineApi')

const loading = ref(false)
const saving = ref(false)
const matrix = ref(null)
const traces = ref([])
const traceDialog = ref(false)
const traceForm = ref({ sourceId: null, targetId: null, traceType: 'derives', comment: '' })

const traceTypeOptions = [
  { label: 'Derives (выводится)', value: 'derives' },
  { label: 'Satisfies (удовлетворяет)', value: 'satisfies' },
  { label: 'Verifies (верифицирует)', value: 'verifies' },
  { label: 'Refines (уточняет)', value: 'refines' },
  { label: 'Allocates (распределяет)', value: 'allocates' },
]

function traceLabel(v) { return traceTypeOptions.find(o => o.value === v)?.label?.split(' ')[0] || v || '-' }
function traceSeverity(v) {
  return v === 'derives' ? 'info' : v === 'satisfies' ? 'success' : v === 'verifies' ? 'warn' : v === 'refines' ? 'secondary' : 'contrast'
}

// Heatmap
const heatmapCols = computed(() => props.requirements.map(r => ({ id: r.id, label: r.reqs?.['Код']?.value || r.val || r.id })))
const heatmapData = computed(() => props.requirements.map(r => ({ id: r.id, label: r.reqs?.['Код']?.value || r.val || r.id })))

const traceMap = computed(() => {
  const map = {}
  for (const t of traces.value) {
    const key = `${t.sourceId}__${t.targetId}`
    map[key] = t.traceType
  }
  return map
})

function cellClass(rowId, colId) {
  const t = traceMap.value[`${rowId}__${colId}`]
  return t ? `cell-${t}` : ''
}
function cellSymbol(rowId, colId) {
  const t = traceMap.value[`${rowId}__${colId}`]
  if (!t) return ''
  return t === 'derives' ? 'D' : t === 'satisfies' ? 'S' : t === 'verifies' ? 'V' : t === 'refines' ? 'R' : 'A'
}
function cellTitle(rowId, colId) { return traceMap.value[`${rowId}__${colId}`] || '' }

function onCellClick(rowId, colId) {
  if (rowId === colId) return
  const existing = traceMap.value[`${rowId}__${colId}`]
  if (!existing) {
    traceForm.value = { sourceId: rowId, targetId: colId, traceType: 'derives', comment: '' }
    traceDialog.value = true
  }
}

async function load() {
  loading.value = true
  try {
    const resp = await api.get('/traceability-matrix')
    matrix.value = resp.data?.data || null
    traces.value = matrix.value?.traces || []
  } catch (e) { console.error('Failed to load matrix', e) }
  loading.value = false
}

function openCreateTrace() {
  traceForm.value = { sourceId: null, targetId: null, traceType: 'derives', comment: '' }
  traceDialog.value = true
}

async function saveTrace() {
  if (!traceForm.value.sourceId || !traceForm.value.targetId) return
  saving.value = true
  try {
    await api.post('/traces', traceForm.value)
    traceDialog.value = false
    await load()
    emit('refresh')
  } catch (e) { console.error('Failed to create trace', e) }
  saving.value = false
}

async function deleteTrace(traceId) {
  if (!window.confirm('Удалить трассировку?')) return
  try {
    await api.delete(`/traces/${traceId}`)
    await load()
    emit('refresh')
  } catch (e) { console.error('Failed to delete trace', e) }
}

onMounted(load)
</script>

<style scoped>
.trace-matrix { display: flex; flex-direction: column; gap: 16px; }
.trace-toolbar { display: flex; align-items: center; gap: 8px; }
.trace-stats { margin-left: auto; font-size: 0.85rem; color: var(--p-text-muted-color); }
.trace-heatmap h4 { margin: 0 0 8px; }
.heatmap-scroll { overflow: auto; max-height: 400px; }
.heatmap-table { border-collapse: collapse; font-size: 0.75rem; }
.heatmap-table th, .heatmap-table td { border: 1px solid var(--p-surface-border); padding: 4px 6px; text-align: center; min-width: 36px; }
.heatmap-header { height: 80px; white-space: nowrap; }
.heatmap-header .rotated { writing-mode: vertical-rl; transform: rotate(180deg); }
.heatmap-row-label { text-align: left; font-weight: 600; white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
.heatmap-cell { cursor: pointer; transition: background 0.15s; }
.heatmap-cell:hover { background: var(--p-surface-hover); }
.cell-derives { background: #3b82f620; color: #3b82f6; font-weight: 700; }
.cell-satisfies { background: #22c55e20; color: #22c55e; font-weight: 700; }
.cell-verifies { background: #f59e0b20; color: #f59e0b; font-weight: 700; }
.cell-refines { background: #8b5cf620; color: #8b5cf6; font-weight: 700; }
.cell-allocates { background: #06b6d420; color: #06b6d4; font-weight: 700; }
.heatmap-legend { display: flex; gap: 16px; margin-top: 8px; font-size: 0.8rem; }
.legend-item { display: flex; align-items: center; gap: 4px; }
.legend-color { width: 14px; height: 14px; border-radius: 3px; }
.legend-color.derives { background: #3b82f640; }
.legend-color.satisfies { background: #22c55e40; }
.legend-color.verifies { background: #f59e0b40; }
.legend-color.refines { background: #8b5cf640; }
.legend-color.allocates { background: #06b6d440; }
.trace-form { display: flex; flex-direction: column; gap: 12px; }
.trace-form .field { display: flex; flex-direction: column; gap: 4px; }
.trace-form .field label { font-weight: 600; font-size: 0.85rem; }
</style>
