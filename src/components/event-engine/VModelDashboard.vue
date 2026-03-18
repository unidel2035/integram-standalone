<template>
  <div class="vmodel-dashboard">
    <div class="vmodel-toolbar">
      <h3>V-модель верификации</h3>
      <Select v-model="currentModelId" :options="models" optionLabel="val" optionValue="id"
        placeholder="Выберите модель" class="vmodel-select" filter showClear />
      <Button icon="pi pi-plus" label="Верификация" size="small" @click="openCreate" />
      <Button icon="pi pi-refresh" size="small" severity="secondary" text @click="loadAll" :loading="loading" />
    </div>

    <!-- Overall coverage -->
    <div class="vmodel-coverage" v-if="coverageData">
      <div class="coverage-stat">
        <span class="coverage-label">Покрытие</span>
        <span class="coverage-value">{{ coverageData.coverage }}%</span>
        <ProgressBar :value="coverageData.coverage" :showValue="false" style="height: 10px; width: 200px;" />
      </div>
      <div class="coverage-stat">
        <Tag severity="success">{{ vmodelData?.stats?.passed || 0 }} pass</Tag>
        <Tag severity="danger">{{ vmodelData?.stats?.failed || 0 }} fail</Tag>
        <Tag severity="warn">{{ vmodelData?.stats?.pending || 0 }} pending</Tag>
      </div>
    </div>

    <!-- V-diagram (SVG) -->
    <div class="vmodel-v-diagram" v-if="vmodelData">
      <svg viewBox="0 0 800 400" class="v-svg">
        <!-- Left branch (requirements) -->
        <g class="v-left">
          <rect x="10" y="20" width="160" height="40" rx="6" class="v-box v-stakeholder" />
          <text x="90" y="45" text-anchor="middle" class="v-text">Стейкхолдеры ({{ leftCounts.stakeholder }})</text>

          <rect x="60" y="100" width="160" height="40" rx="6" class="v-box v-system" />
          <text x="140" y="125" text-anchor="middle" class="v-text">Системные ({{ leftCounts.system }})</text>

          <rect x="110" y="180" width="160" height="40" rx="6" class="v-box v-subsystem" />
          <text x="190" y="205" text-anchor="middle" class="v-text">Подсистемы ({{ leftCounts.subsystem }})</text>

          <rect x="160" y="260" width="160" height="40" rx="6" class="v-box v-component" />
          <text x="240" y="285" text-anchor="middle" class="v-text">Компоненты ({{ leftCounts.component }})</text>

          <!-- Arrows down-left -->
          <line x1="90" y1="60" x2="140" y2="100" class="v-arrow" />
          <line x1="140" y1="140" x2="190" y2="180" class="v-arrow" />
          <line x1="190" y1="220" x2="240" y2="260" class="v-arrow" />
        </g>

        <!-- Bottom (implementation) -->
        <rect x="300" y="340" width="200" height="40" rx="6" class="v-box v-impl" />
        <text x="400" y="365" text-anchor="middle" class="v-text">Реализация</text>
        <line x1="280" y1="300" x2="350" y2="340" class="v-arrow" />
        <line x1="450" y1="340" x2="520" y2="300" class="v-arrow" />

        <!-- Right branch (verification) -->
        <g class="v-right">
          <rect x="630" y="20" width="160" height="40" rx="6" class="v-box v-acceptance" />
          <text x="710" y="45" text-anchor="middle" class="v-text">Приёмка ({{ rightCounts.acceptance }})</text>

          <rect x="580" y="100" width="160" height="40" rx="6" class="v-box v-sysTest" />
          <text x="660" y="125" text-anchor="middle" class="v-text">Сист. тесты ({{ rightCounts.system_test }})</text>

          <rect x="530" y="180" width="160" height="40" rx="6" class="v-box v-integration" />
          <text x="610" y="205" text-anchor="middle" class="v-text">Интеграция ({{ rightCounts.integration }})</text>

          <rect x="480" y="260" width="160" height="40" rx="6" class="v-box v-unit" />
          <text x="560" y="285" text-anchor="middle" class="v-text">Unit-тесты ({{ rightCounts.unit_test }})</text>

          <!-- Arrows up-right -->
          <line x1="560" y1="260" x2="610" y2="220" class="v-arrow" />
          <line x1="610" y1="180" x2="660" y2="140" class="v-arrow" />
          <line x1="660" y1="100" x2="710" y2="60" class="v-arrow" />
        </g>

        <!-- Horizontal links -->
        <line x1="170" y1="40" x2="630" y2="40" class="v-link" stroke-dasharray="5,5" />
        <line x1="220" y1="120" x2="580" y2="120" class="v-link" stroke-dasharray="5,5" />
        <line x1="270" y1="200" x2="530" y2="200" class="v-link" stroke-dasharray="5,5" />
        <line x1="320" y1="280" x2="480" y2="280" class="v-link" stroke-dasharray="5,5" />
      </svg>
    </div>

    <!-- Coverage Matrix -->
    <div class="vmodel-matrix" v-if="coverageData?.matrix?.length">
      <h4>Матрица покрытия</h4>
      <DataTable :value="coverageData.matrix" stripedRows size="small" scrollable scrollHeight="300px">
        <Column field="code" header="Код" style="width: 100px" />
        <Column field="name" header="Требование" style="min-width: 200px" />
        <Column field="type" header="Тип" style="width: 110px">
          <template #body="{ data }"><Tag :value="data.type || '-'" size="small" /></template>
        </Column>
        <Column header="Test" style="width: 70px">
          <template #body="{ data }">
            <span :class="resultClass(data.methods.test)">{{ resultIcon(data.methods.test) }}</span>
          </template>
        </Column>
        <Column header="Analysis" style="width: 70px">
          <template #body="{ data }">
            <span :class="resultClass(data.methods.analysis)">{{ resultIcon(data.methods.analysis) }}</span>
          </template>
        </Column>
        <Column header="Inspect" style="width: 70px">
          <template #body="{ data }">
            <span :class="resultClass(data.methods.inspection)">{{ resultIcon(data.methods.inspection) }}</span>
          </template>
        </Column>
        <Column header="Demo" style="width: 70px">
          <template #body="{ data }">
            <span :class="resultClass(data.methods.demonstration)">{{ resultIcon(data.methods.demonstration) }}</span>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Create Verification Dialog -->
    <Dialog v-model:visible="dialogVisible" header="Новая верификация" modal style="width: 550px">
      <div class="vmodel-form">
        <div class="field">
          <label>Требование *</label>
          <Select v-model="form.requirementId" :options="requirements" optionLabel="val" optionValue="id"
            placeholder="Выберите требование" filter />
        </div>
        <div class="field-row">
          <div class="field">
            <label>Метод</label>
            <Select v-model="form.method" :options="methodOptions" optionLabel="label" optionValue="value" />
          </div>
          <div class="field">
            <label>Результат</label>
            <Select v-model="form.result" :options="resultOptions" optionLabel="label" optionValue="value" />
          </div>
        </div>
        <div class="field">
          <label>Исполнитель</label>
          <Select v-model="form.actorId" :options="actors" optionLabel="val" optionValue="id"
            placeholder="Исполнитель" showClear filter />
        </div>
        <div class="field">
          <label>Описание</label>
          <Textarea v-model="form.description" rows="2" autoResize />
        </div>
        <div class="field">
          <label>Артефакт (ссылка)</label>
          <InputText v-model="form.artifact" placeholder="URL или путь к файлу" />
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="dialogVisible = false" />
        <Button label="Создать" @click="save" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'

const api = inject('eventEngineApi')
const injectedModelId = inject('selectedModelId', ref(null))
const selectedApplicationId = inject('selectedApplicationId', ref(null))

const loading = ref(false)
const saving = ref(false)
const models = ref([])
const requirements = ref([])
const actors = ref([])
const currentModelId = ref(injectedModelId.value)
const vmodelData = ref(null)
const coverageData = ref(null)
const dialogVisible = ref(false)
const form = ref({ requirementId: null, method: 'test', result: 'pending', actorId: null, description: '', artifact: '' })

const methodOptions = [
  { label: 'Тест', value: 'test' },
  { label: 'Анализ', value: 'analysis' },
  { label: 'Инспекция', value: 'inspection' },
  { label: 'Демонстрация', value: 'demonstration' },
]

const resultOptions = [
  { label: 'Ожидание', value: 'pending' },
  { label: 'Пройдено', value: 'pass' },
  { label: 'Не пройдено', value: 'fail' },
]

const leftCounts = computed(() => {
  const lb = vmodelData.value?.leftBranch || {}
  return {
    stakeholder: lb.stakeholder?.length || 0,
    system: lb.system?.length || 0,
    subsystem: lb.subsystem?.length || 0,
    component: lb.component?.length || 0,
  }
})

const rightCounts = computed(() => {
  const rb = vmodelData.value?.rightBranch || {}
  return {
    acceptance: rb.acceptance?.length || 0,
    system_test: rb.system_test?.length || 0,
    integration: rb.integration?.length || 0,
    unit_test: rb.unit_test?.length || 0,
  }
})

function resultIcon(v) { return v === 'pass' ? '\u2714' : v === 'fail' ? '\u2716' : v === 'pending' ? '\u25CB' : '' }
function resultClass(v) { return v === 'pass' ? 'res-pass' : v === 'fail' ? 'res-fail' : v === 'pending' ? 'res-pending' : '' }

async function loadAll() {
  loading.value = true
  try {
    const [mResp, rResp, aResp, cResp] = await Promise.all([
      api.get('/models'),
      api.get('/requirements'),
      api.get('/actors'),
      api.get('/coverage-matrix'),
    ])
    models.value = mResp.data?.data || []
    requirements.value = rResp.data?.data || []
    actors.value = aResp.data?.data || []
    coverageData.value = cResp.data?.data || null

    if (currentModelId.value) {
      const vResp = await api.get(`/models/${currentModelId.value}/v-model`)
      vmodelData.value = vResp.data?.data || null
    } else {
      // Load V-model without model filter
      vmodelData.value = { leftBranch: {}, rightBranch: {}, horizontalLinks: [], stats: coverageData.value }
    }
  } catch (e) { console.error('Failed to load V-model data', e) }
  loading.value = false
}

function openCreate() {
  form.value = { requirementId: null, method: 'test', result: 'pending', actorId: null, description: '', artifact: '' }
  dialogVisible.value = true
}

async function save() {
  if (!form.value.requirementId) return
  saving.value = true
  try {
    await api.post('/verifications', form.value)
    dialogVisible.value = false
    await loadAll()
  } catch (e) { console.error('Failed to create verification', e) }
  saving.value = false
}

watch(selectedApplicationId, () => loadAll())
onMounted(loadAll)
</script>

<style scoped>
.vmodel-dashboard { display: flex; flex-direction: column; gap: 16px; height: 100%; }
.vmodel-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.vmodel-toolbar h3 { margin: 0; white-space: nowrap; }
.vmodel-select { width: 200px; }
.vmodel-coverage { display: flex; align-items: center; gap: 24px; padding: 12px 16px; background: var(--p-surface-card); border-radius: 8px; }
.coverage-stat { display: flex; align-items: center; gap: 8px; }
.coverage-label { font-weight: 600; font-size: 0.85rem; }
.coverage-value { font-size: 1.5rem; font-weight: 700; color: var(--p-primary-color); }

/* V-diagram SVG */
.vmodel-v-diagram { background: var(--p-surface-card); border-radius: 8px; padding: 16px; color: var(--p-text-color); }
.v-svg { width: 100%; max-height: 420px; }
.v-box { fill: var(--p-surface-card, #fff); stroke: var(--p-surface-border); stroke-width: 2; }
.v-stakeholder { stroke: #ef4444; fill: #ef444415; }
.v-system { stroke: #f59e0b; fill: #f59e0b15; }
.v-subsystem { stroke: #3b82f6; fill: #3b82f615; }
.v-component { stroke: #8b5cf6; fill: #8b5cf615; }
.v-impl { stroke: #22c55e; fill: #22c55e20; }
.v-acceptance { stroke: #ef4444; fill: #ef444415; }
.v-sysTest { stroke: #f59e0b; fill: #f59e0b15; }
.v-integration { stroke: #3b82f6; fill: #3b82f615; }
.v-unit { stroke: #8b5cf6; fill: #8b5cf615; }
.v-text { font-size: 12px; fill: currentColor; font-family: system-ui; }
.v-arrow { stroke: var(--p-text-muted-color, #999); stroke-width: 1.5; marker-end: url(#arrow); }
.v-link { stroke: var(--p-primary-color, #3b82f6); stroke-width: 1; opacity: 0.4; }

/* Coverage matrix results */
.res-pass { color: #22c55e; font-weight: 700; font-size: 1.1rem; }
.res-fail { color: #ef4444; font-weight: 700; font-size: 1.1rem; }
.res-pending { color: var(--p-text-muted-color); font-size: 1.1rem; }

.vmodel-matrix h4 { margin: 0 0 8px; }
.vmodel-form { display: flex; flex-direction: column; gap: 12px; }
.vmodel-form .field { display: flex; flex-direction: column; gap: 4px; }
.vmodel-form .field label { font-weight: 600; font-size: 0.85rem; }
.field-row { display: flex; gap: 12px; }
.field-row .field { flex: 1; }
</style>
