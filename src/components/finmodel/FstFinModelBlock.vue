<template>
  <div class="fst-fin-model-block">

    <!-- Config panel — ввод ID модели -->
    <div v-if="configOpen" class="fst-fm-config">
      <div class="fst-fm-config-row">
        <label>ID модели (api.ai2o.ru/fm)</label>
        <input v-model="editModelId" type="text" placeholder="например: 17446" class="fst-fm-config-input" />
      </div>
      <div class="fst-fm-config-actions">
        <button class="fst-fm-btn fst-fm-btn--primary" @click="applyConfig">Подключить</button>
        <button class="fst-fm-btn" @click="configOpen = false">Отмена</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="fst-fm-state">
      <i class="pi pi-spin pi-spinner" style="font-size:1.4rem"></i>
      <span>Загрузка финансовой модели…</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="fst-fm-state fst-fm-state--error">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ error }}</span>
      <button class="fst-fm-btn" @click="loadModel">Повторить</button>
    </div>

    <!-- Empty — нет modelId -->
    <div v-else-if="!currentModelId" class="fst-fm-state">
      <i class="pi pi-wallet" style="font-size:2rem;opacity:0.3"></i>
      <p>Финансовая модель не подключена</p>
      <button class="fst-fm-btn fst-fm-btn--primary" @click="openConfig">
        <i class="pi pi-link"></i> Подключить модель из api.ai2o.ru/fm
      </button>
    </div>

    <!-- FinParser — основной рендер модели -->
    <div v-else-if="modelData.length > 0">
      <div class="fst-fm-toolbar">
        <span class="fst-fm-model-id">fm/{{ currentModelId }}</span>
        <button class="fst-fm-btn-icon" title="Обновить" @click="loadModel">
          <i class="pi pi-refresh"></i>
        </button>
        <button class="fst-fm-btn-icon" title="Настроить" @click="openConfig">
          <i class="pi pi-cog"></i>
        </button>
      </div>
      <FinParser
        :modelData="modelData"
        :yearPeriods="yearPeriods"
        :quarterPeriods="quarterPeriods"
        :monthPeriods="monthPeriods"
        :valuesData="valuesData"
        :sourceReports="sourceReports"
      />
    </div>

    <!-- Loaded but empty structure -->
    <div v-else class="fst-fm-state">
      <i class="pi pi-inbox" style="opacity:0.3"></i>
      <span>Модель {{ currentModelId }} пуста</span>
      <button class="fst-fm-btn" @click="openConfig">Другая модель</button>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import FinParser from './FinParser.vue'

const props = defineProps({
  modelId: { type: [String, Number], default: '' },
  database: { type: String, default: 'fm' },
  server: { type: String, default: 'api.ai2o.ru' }
})

const emit = defineEmits(['update:modelId'])

// UI state
const configOpen = ref(false)
const loading = ref(false)
const error = ref('')
const editModelId = ref(String(props.modelId || ''))
const currentModelId = ref(String(props.modelId || ''))

// Model data
const modelData = ref([])
const yearPeriods = ref([])
const quarterPeriods = ref([])
const monthPeriods = ref([])
const sourceReports = ref({})
const valuesData = ref([])
const authToken = ref('')

// ─── Auth ────────────────────────────────────────────────────────────────────

async function authenticate() {
  const url = `https://${props.server}/${props.database}/auth?JSON_KV`
  const body = new URLSearchParams({ login: 'admin', pwd: 'admin' })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  if (!res.ok) throw new Error(`Auth failed: HTTP ${res.status}`)
  const data = await res.json()
  if (!data?.token) throw new Error('Auth: no token')
  return data.token
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchModelStructure(token) {
  const url = `https://${props.server}/${props.database}/report/4905?JSON_KV&FR_modelID=${currentModelId.value}`
  const res = await fetch(url, { headers: { 'X-Authorization': token } })
  if (!res.ok) throw new Error(`Ошибка загрузки структуры: HTTP ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data?.rows || [])
}

async function fetchModelValues(token, fromDate, toDate) {
  const fr = (fromDate || '01.01.2020').split('.').reverse().join('')
  const to = (toDate || '31.12.2030').split('.').reverse().join('')
  const url = `https://${props.server}/${props.database}/report/6431?JSON_KV&Fr=${fr}&To=${to}`
  const res = await fetch(url, { headers: { 'X-Authorization': token } })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : (data?.rows || [])
}

async function fetchPeriods(token, periodType, fromDate, toDate) {
  let objectId, fromParam, toParam
  if (periodType === 'Квартал') {
    objectId = 449
    fromParam = `FR_5769=>=${fromDate}`
    toParam = `FR_5770=<=${toDate}`
  } else if (periodType === 'Месяц') {
    objectId = 526
    fromParam = `FR_5599=>=${fromDate}`
    toParam = `FR_5197=<=${toDate}`
  } else {
    objectId = 794
    fromParam = `FR_5597=>=${fromDate}`
    toParam = `FR_5598=<=${toDate}`
  }
  const url = `https://${props.server}/${props.database}/object/${objectId}?JSON_KV&JSON_DATA&LIMIT=10000&${fromParam}&${toParam}`
  const res = await fetch(url, { headers: { 'X-Authorization': token } })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

// ─── Fallback period builders ─────────────────────────────────────────────────

function buildFallbackYearPeriods(fromDate, toDate) {
  const fromYear = parseInt((fromDate || '01.01.2025').split('.')[2]) || 2025
  const toYear = parseInt((toDate || '31.12.2029').split('.')[2]) || 2029
  const result = []
  for (let y = fromYear; y <= toYear; y++) {
    result.push({ r: [String(y), `01.01.${y}`, `31.12.${y}`] })
  }
  return result
}

function buildFallbackQuarterPeriods(fromDate, toDate) {
  const fromYear = parseInt((fromDate || '01.01.2025').split('.')[2]) || 2025
  const toYear = parseInt((toDate || '31.12.2029').split('.')[2]) || 2029
  const result = []
  for (let y = fromYear; y <= toYear; y++) {
    for (const [name, from, to] of [
      [`1 кв. ${y}`, `01.01.${y}`, `31.03.${y}`],
      [`2 кв. ${y}`, `01.04.${y}`, `30.06.${y}`],
      [`3 кв. ${y}`, `01.07.${y}`, `30.09.${y}`],
      [`4 кв. ${y}`, `01.10.${y}`, `31.12.${y}`]
    ]) {
      result.push({ r: [name, from, to] })
    }
  }
  return result
}

// ─── Main load ────────────────────────────────────────────────────────────────

async function loadModel() {
  if (!currentModelId.value) return
  loading.value = true
  error.value = ''
  modelData.value = []
  yearPeriods.value = []
  quarterPeriods.value = []
  monthPeriods.value = []
  valuesData.value = []
  sourceReports.value = {}

  try {
    if (!authToken.value) {
      authToken.value = await authenticate()
    }

    const structureRows = await fetchModelStructure(authToken.value)
    if (!structureRows.length) {
      error.value = `Модель ${currentModelId.value} не найдена или пуста`
      return
    }

    // Extract date range
    const allFrom = structureRows.map(r => r.periodFrom || r.period_from || '').filter(Boolean)
    const allTo = structureRows.map(r => r.periodTo || r.period_to || '').filter(Boolean)
    const fromDate = allFrom.length ? allFrom.reduce((a, b) => a < b ? a : b) : '01.01.2025'
    const toDate = allTo.length ? allTo.reduce((a, b) => a > b ? a : b) : '31.12.2029'

    // Fetch values
    const valueRows = await fetchModelValues(authToken.value, fromDate, toDate)
    valuesData.value = valueRows

    // Collect period types
    const periodTypes = new Set(
      structureRows.map(r => r.period || r.PeriodType || r.period_type || '').filter(Boolean)
    )

    // Fetch periods
    const periodFetches = [...periodTypes].map(pt =>
      fetchPeriods(authToken.value, pt, fromDate, toDate).then(p => ({ type: pt, periods: p }))
    )
    const periodResults = await Promise.all(periodFetches)

    for (const { type, periods } of periodResults) {
      if (type === 'Год') yearPeriods.value = periods
      else if (type === 'Квартал') quarterPeriods.value = periods
      else if (type === 'Месяц') monthPeriods.value = periods
    }

    // Fallbacks
    if (yearPeriods.value.length === 0 && (periodTypes.has('Год') || periodTypes.size === 0)) {
      yearPeriods.value = buildFallbackYearPeriods(fromDate, toDate)
    }
    if (quarterPeriods.value.length === 0 && periodTypes.has('Квартал')) {
      quarterPeriods.value = buildFallbackQuarterPeriods(fromDate, toDate)
    }

    modelData.value = structureRows
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки финансовой модели'
    authToken.value = '' // reset so next try re-auths
  } finally {
    loading.value = false
  }
}

function openConfig() {
  editModelId.value = currentModelId.value
  configOpen.value = true
}

function applyConfig() {
  const id = editModelId.value.trim()
  currentModelId.value = id
  authToken.value = '' // reset auth when model changes
  configOpen.value = false
  emit('update:modelId', id)
  if (id) loadModel()
}

watch(() => props.modelId, (val) => {
  const s = String(val || '')
  if (s !== currentModelId.value) {
    currentModelId.value = s
    editModelId.value = s
    authToken.value = ''
    if (s) loadModel()
  }
})

onMounted(() => {
  if (currentModelId.value) loadModel()
})
</script>

<style scoped>
.fst-fin-model-block {
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--p-surface-card);
}

.fst-fm-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
}

.fst-fm-model-id {
  flex: 1;
  font-size: 11px;
  color: var(--p-text-muted-color);
  font-family: monospace;
}

.fst-fm-btn-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  color: var(--p-text-muted-color);
  font-size: 13px;
}
.fst-fm-btn-icon:hover {
  background: var(--p-content-hover-background, rgba(0,0,0,0.05));
  color: var(--p-text-color);
}

.fst-fm-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  gap: 10px;
  color: var(--p-text-muted-color);
  font-size: 13px;
  padding: 20px;
}

.fst-fm-state--error {
  color: var(--p-red-500, #ef4444);
}

.fst-fm-config {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-bottom: 1px solid var(--p-content-border-color);
}

.fst-fm-config-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fst-fm-config-row label {
  width: 190px;
  font-size: 12px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

.fst-fm-config-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  font-size: 13px;
  background: var(--p-surface-card);
  color: var(--p-text-color);
}

.fst-fm-config-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.fst-fm-btn {
  padding: 6px 14px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: var(--p-surface-card);
  color: var(--p-text-color);
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-fm-btn:hover { background: var(--p-content-hover-background, rgba(0,0,0,0.05)); }

.fst-fm-btn--primary {
  background: var(--p-primary-color);
  color: #fff;
  border-color: var(--p-primary-color);
}
.fst-fm-btn--primary:hover { opacity: 0.9; }
</style>
