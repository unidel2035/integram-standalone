<template>
  <div class="spm">

    <!-- Top toolbar -->
    <div class="spm-toolbar">
      <SelectButton
        v-model="activeTab"
        :options="tabs"
        optionLabel="label"
        optionValue="id"
        :allowEmpty="false"
        size="small"
      />
      <div class="spm-toolbar-right">
        <Button
          v-if="activeTab === 'builder'"
          label="Новая пирамида"
          icon="pi pi-plus"
          size="small"
          @click="showCreatePyramid = true"
        />
        <Button
          v-if="activeTab === 'concepts'"
          label="Добавить концепт"
          icon="pi pi-plus"
          size="small"
          severity="secondary"
          @click="showCreateConcept = true"
        />
      </div>
    </div>

    <!-- ═══ TAB: BUILDER ═══════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'builder'" class="spm-body">

      <!-- Left: pyramid list -->
      <div class="spm-sidebar">
        <div class="spm-sidebar-title">Модели пирамид</div>
        <div v-if="loadingPyramids" class="spm-loading-mini"><ProgressSpinner style="width:20px;height:20px"/></div>
        <div v-else-if="!pyramids.length" class="spm-empty-mini">Нет моделей</div>
        <div
          v-for="p in pyramids" :key="p.id"
          class="spm-pyramid-item"
          :class="{ active: selectedPyramidId === p.id }"
          @click="selectPyramid(p.id)"
        >
          <div class="spm-pi-name">{{ p.name }}</div>
          <div class="spm-pi-meta">v{{ p.version || '1.0' }} · {{ p.layerCount }} слоёв</div>
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            size="small"
            class="spm-pi-del"
            @click.stop="deletePyramid(p.id)"
          />
        </div>
      </div>

      <!-- Right: pyramid editor -->
      <div class="spm-editor" v-if="selectedPyramidId">
        <div class="spm-editor-header">
          <div>
            <div class="spm-editor-title">{{ currentPyramid?.name }}</div>
            <div class="spm-editor-sub">{{ currentPyramid?.description }}</div>
          </div>
          <Button label="Сохранить конфиг" icon="pi pi-save" size="small" @click="saveConfig" :loading="saving" />
        <Button
          label="Смотреть на пирамиде"
          icon="pi pi-eye"
          size="small"
          severity="secondary"
          @click="previewOnPyramid"
        />
        </div>

        <!-- Layers -->
        <div class="spm-layers">
          <div class="spm-section-title">СЛОИ ПИРАМИДЫ (сверху = апекс)</div>

          <div v-for="(layer, li) in editLayers" :key="layer.id" class="spm-layer-card">
            <div class="spm-layer-header">
              <div class="spm-layer-order">{{ li + 1 }}</div>
              <InputText v-model="layer.name" placeholder="Название слоя" size="small" style="flex:1" />
              <Button icon="pi pi-arrow-up"   text size="small" :disabled="li === 0"                    @click="moveLayer(li, -1)" />
              <Button icon="pi pi-arrow-down" text size="small" :disabled="li === editLayers.length - 1" @click="moveLayer(li, +1)" />
              <Button icon="pi pi-trash"      text size="small" severity="danger"                        @click="removeLayer(li)" />
            </div>

            <!-- Concepts in layer -->
            <div class="spm-layer-concepts">
              <div
                v-for="cid in layer.conceptIds"
                :key="cid"
                class="spm-concept-chip"
                :style="{ borderColor: domainColor(getConcept(cid)?.domainSov) }"
              >
                <span class="spm-chip-code">{{ getConcept(cid)?.code || cid }}</span>
                <span class="spm-chip-name">{{ getConcept(cid)?.name || cid }}</span>
                <button class="spm-chip-del" @click="removeConceptFromLayer(li, cid)">×</button>
              </div>
              <button class="spm-add-concept-btn" @click="openConceptPicker(li)">
                <i class="pi pi-plus"></i> добавить концепт
              </button>
            </div>
          </div>

          <Button
            label="Добавить слой"
            icon="pi pi-plus"
            severity="secondary"
            outlined
            size="small"
            class="spm-add-layer-btn"
            @click="addLayer"
          />
        </div>
      </div>

      <div v-else class="spm-editor spm-editor-empty">
        <i class="pi pi-chart-bar" style="font-size: 2rem; opacity: 0.2"></i>
        <span>Выберите модель пирамиды слева</span>
      </div>
    </div>

    <!-- ═══ TAB: CONCEPTS ══════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'concepts'" class="spm-body spm-body-full">
      <div class="spm-concepts-toolbar">
        <InputText v-model="conceptSearch" placeholder="Поиск по названию, коду, домену..." size="small" style="flex:1; max-width:400px" />
        <span class="spm-count">{{ filteredConcepts.length }} концептов</span>
      </div>

      <DataTable
        :value="filteredConcepts"
        :loading="loadingConcepts"
        size="small"
        scrollable
        scroll-height="calc(100vh - 300px)"
        row-hover
        @row-click="editConceptRow($event.data)"
      >
        <Column field="code"      header="Код"             style="width:100px; font-weight:600; color: var(--p-primary-color)" />
        <Column field="name"      header="Концепт"         style="min-width:200px" />
        <Column field="domainSov" header="Домен"           style="width:130px">
          <template #body="{ data }">
            <span class="spm-domain-badge" :style="{ background: domainColor(data.domainSov) + '22', color: domainColor(data.domainSov) }">
              {{ data.domainSov || '—' }}
            </span>
          </template>
        </Column>
        <Column field="scoreSov"  header="Балл сув."       style="width:90px; text-align:right">
          <template #body="{ data }">
            <span :style="{ color: scoreColor(data.scoreSov), fontWeight: 700 }">
              {{ data.scoreSov != null ? data.scoreSov : '—' }}
            </span>
          </template>
        </Column>
        <Column header="Потребности" style="min-width:160px">
          <template #body="{ data }">
            <span class="spm-text-clamp">{{ data.needs || '—' }}</span>
          </template>
        </Column>
        <Column header="Возможности" style="min-width:160px">
          <template #body="{ data }">
            <span class="spm-text-clamp">{{ data.capabilities || '—' }}</span>
          </template>
        </Column>
        <Column style="width:40px">
          <template #body="{ data }">
            <Button icon="pi pi-pencil" text size="small" @click.stop="editConceptRow(data)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- ═══ TAB: COMPATIBILITY ═════════════════════════════════════════════ -->
    <div v-if="activeTab === 'compat'" class="spm-body spm-body-full">
      <div class="spm-compat-header">
        <div class="spm-section-title">ПОИСК СОВМЕСТНОСТИ — потребности ↔ возможности</div>
        <div class="spm-compat-controls">
          <InputText v-model="compatQuery" placeholder="Введите потребность или возможность..." size="small" style="flex:1; max-width:500px" />
          <Button label="Найти совместимые" icon="pi pi-search" size="small" @click="runCompatSearch" :loading="compatLoading" />
        </div>
      </div>

      <div v-if="compatResults.length" class="spm-compat-results">
        <div v-for="r in compatResults" :key="r.id" class="spm-compat-card">
          <div class="spm-compat-card-top">
            <span class="spm-chip-code" :style="{ borderColor: domainColor(r.domainSov) }">{{ r.code }}</span>
            <span class="spm-compat-name">{{ r.name }}</span>
            <span class="spm-domain-badge" :style="{ background: domainColor(r.domainSov) + '22', color: domainColor(r.domainSov) }">
              {{ r.domainSov || 'Общий' }}
            </span>
            <span class="spm-compat-score" :style="{ color: scoreColor(r.matchScore) }">{{ r.matchScore }}%</span>
          </div>
          <div v-if="r.needs" class="spm-compat-needs"><b>Потребности:</b> {{ r.needs }}</div>
          <div v-if="r.capabilities" class="spm-compat-caps"><b>Возможности:</b> {{ r.capabilities }}</div>
        </div>
      </div>
      <div v-else-if="!compatLoading" class="spm-empty-mini" style="padding:40px">
        Введите запрос для поиска совместных технологий
      </div>
    </div>

    <!-- ═══ DIALOGS ════════════════════════════════════════════════════════ -->

    <!-- Create pyramid -->
    <Dialog v-model:visible="showCreatePyramid" header="Новая пирамида суверенности" modal style="width:460px; max-width:95vw">
      <div class="spm-form">
        <div class="spm-form-row">
          <label>Название</label>
          <InputText v-model="newPyramid.name" placeholder="Пирамида суверенности БПЛА" fluid />
        </div>
        <div class="spm-form-row">
          <label>Описание</label>
          <Textarea v-model="newPyramid.description" rows="3" placeholder="Описание модели..." fluid />
        </div>
        <div class="spm-form-row">
          <label>Версия</label>
          <InputText v-model="newPyramid.version" placeholder="1.0" fluid />
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" text @click="showCreatePyramid = false" />
        <Button label="Создать" icon="pi pi-check" :loading="saving" @click="createPyramid" />
      </template>
    </Dialog>

    <!-- Create/edit concept -->
    <Dialog v-model:visible="showCreateConcept" :header="editingConcept?.id ? 'Редактировать концепт' : 'Новый концепт'" modal style="width:560px; max-width:95vw">
      <div class="spm-form">
        <div class="spm-form-row">
          <label>Название</label>
          <InputText v-model="newConcept.name" placeholder="Название технологии/концепта" fluid />
        </div>
        <div class="spm-form-row">
          <label>Код</label>
          <InputText v-model="newConcept.code" placeholder="Напр. КА-01" fluid />
        </div>
        <div class="spm-form-row">
          <label>Домен суверенности</label>
          <Select v-model="newConcept.domainSov" :options="DOMAINS" placeholder="Выберите домен" fluid />
        </div>
        <div class="spm-form-row">
          <label>Балл суверенности (0–10)</label>
          <InputNumber v-model="newConcept.scoreSov" :min="0" :max="10" :showButtons="false" fluid />
        </div>
        <div class="spm-form-row">
          <label>Определение</label>
          <Textarea v-model="newConcept.definition" rows="2" fluid />
        </div>
        <div class="spm-form-row">
          <label>Потребности</label>
          <Textarea v-model="newConcept.needs" rows="2" placeholder="Что требуется для реализации..." fluid />
        </div>
        <div class="spm-form-row">
          <label>Возможности</label>
          <Textarea v-model="newConcept.capabilities" rows="2" placeholder="Что даёт наличие этой технологии..." fluid />
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" text @click="showCreateConcept = false" />
        <Button :label="editingConcept?.id ? 'Сохранить' : 'Создать'" icon="pi pi-check" :loading="saving" @click="saveConcept" />
      </template>
    </Dialog>

    <!-- Concept picker (for adding to layer) -->
    <Dialog v-model:visible="showConceptPicker" header="Добавить концепт в слой" modal style="width:600px; max-width:95vw">
      <div style="margin-bottom:10px">
        <InputText v-model="pickerSearch" placeholder="Поиск концепта..." size="small" fluid autofocus />
      </div>
      <div class="spm-picker-list">
        <div
          v-for="c in pickerFiltered"
          :key="c.id"
          class="spm-picker-item"
          @click="addConceptToLayer(c)"
        >
          <span class="spm-chip-code" style="min-width:60px">{{ c.code }}</span>
          <span class="spm-picker-name">{{ c.name }}</span>
          <span class="spm-domain-badge" :style="{ background: domainColor(c.domainSov) + '22', color: domainColor(c.domainSov) }">
            {{ c.domainSov || '—' }}
          </span>
        </div>
      </div>
      <template #footer>
        <Button label="Закрыть" text @click="showConceptPicker = false" />
      </template>
    </Dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
const emit = defineEmits(['previewPyramid'])
import ProgressSpinner from 'primevue/progressspinner'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

// ── Integram fst ──────────────────────────────────────────────────────────────
const SERVER   = 'https://ai2o.ru'
const DB       = 'fst'
const LOGIN    = 'unidel@yandex.ru'
const PASSWORD = 'Denver2035'

const TYPE_PYRAMID  = 71341
const FIELD_PYR_DESC    = 71343
const FIELD_PYR_CONFIG  = 71345
const FIELD_PYR_VERSION = 71348
const TYPE_CONCEPTS = 2416
const FIELD_CON_DEF   = 2418
const FIELD_CON_EN    = 2423
const FIELD_CON_NEEDS = 71359
const FIELD_CON_CAPS  = 71361
const FIELD_CON_SCORE = 71363
const FIELD_CON_DOM   = 71365

const DOMAINS = ['D1 ПО', 'D2 Железо', 'D3 Данные', 'D4 Связь', 'D5 Кадры', 'D6 Финансы', 'D7 IP', 'D8 Производство', 'D9 Стандарты']
const DOMAIN_COLORS = { 'D1 ПО': '#4361ee', 'D2 Железо': '#c1440e', 'D3 Данные': '#2a9d8f', 'D4 Связь': '#1a8fe3', 'D5 Кадры': '#3bb273', 'D6 Финансы': '#f0a500', 'D7 IP': '#7b2fbe', 'D8 Производство': '#e63946', 'D9 Стандарты': '#d62598' }

let authToken = '', xsrf = ''

const tabs = [
  { id: 'builder', label: 'Конструктор' },
  { id: 'concepts', label: 'Концепты' },
  { id: 'compat', label: 'Совместность' }
]
const activeTab = ref('builder')

// ── State ─────────────────────────────────────────────────────────────────────
const pyramids           = ref([])
const allConcepts        = ref([])
const loadingPyramids    = ref(true)
const loadingConcepts    = ref(true)
const saving             = ref(false)
const selectedPyramidId  = ref(null)
const editLayers         = ref([])
const conceptSearch      = ref('')
const compatQuery        = ref('')
const compatLoading      = ref(false)
const compatResults      = ref([])
const showCreatePyramid  = ref(false)
const showCreateConcept  = ref(false)
const showConceptPicker  = ref(false)
const pickerSearch       = ref('')
const pickerLayerIdx     = ref(null)
const editingConcept     = ref(null)

const newPyramid = ref({ name: '', description: '', version: '1.0' })
const newConcept = ref({ name: '', code: '', definition: '', needs: '', capabilities: '', scoreSov: null, domainSov: null })

// ── Auth + API ────────────────────────────────────────────────────────────────
async function authenticate() {
  const r = await fetch(`${SERVER}/${DB}/auth?JSON_KV`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ login: LOGIN, pwd: PASSWORD })
  })
  const d = JSON.parse(await r.text())
  authToken = d.token || ''; xsrf = d._xsrf || ''
}
async function apiFetch(path) {
  const r = await fetch(`${SERVER}/${DB}${path}`, { headers: authToken ? { 'X-Authorization': authToken } : {} })
  const t = await r.text(); return t.startsWith('{') ? JSON.parse(t) : null
}
async function apiPost(path, body) {
  const r = await fetch(`${SERVER}/${DB}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Authorization': authToken },
    body: new URLSearchParams({ ...body, _xsrf: xsrf })
  })
  const t = await r.text(); return t.startsWith('{') ? JSON.parse(t) : null
}

// ── Load data ─────────────────────────────────────────────────────────────────
async function loadPyramids() {
  loadingPyramids.value = true
  const d = await apiFetch(`/object/${TYPE_PYRAMID}?JSON_KV&full=1&LIMIT=100`)
  pyramids.value = (d?.object || []).map(o => {
    const reqs = d.reqs?.[o.id] || {}
    let cfg = {}
    try {
      const raw = reqs[FIELD_PYR_CONFIG] || '{}'
      const decoded = raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#123;/g, '{').replace(/&#125;/g, '}')
      cfg = JSON.parse(decoded)
    } catch {}
    return {
      id: String(o.id), name: o.val,
      description: reqs[FIELD_PYR_DESC] || '',
      version: reqs[FIELD_PYR_VERSION] || '1.0',
      layerCount: (cfg.layers || []).length,
      config: cfg
    }
  })
  loadingPyramids.value = false
}

async function loadConcepts() {
  loadingConcepts.value = true
  const d = await apiFetch(`/object/${TYPE_CONCEPTS}?JSON_KV&full=1&LIMIT=500`)
  allConcepts.value = (d?.object || []).map(o => {
    const reqs = d.reqs?.[o.id] || {}
    return {
      id: String(o.id), name: o.val,
      code:         reqs[FIELD_CON_EN] || o.val.substring(0,6).toUpperCase(),
      definition:   reqs[FIELD_CON_DEF] || '',
      needs:        reqs[FIELD_CON_NEEDS] || '',
      capabilities: reqs[FIELD_CON_CAPS] || '',
      scoreSov:     reqs[FIELD_CON_SCORE] != null ? Number(reqs[FIELD_CON_SCORE]) : null,
      domainSov:    reqs[FIELD_CON_DOM] || ''
    }
  })
  loadingConcepts.value = false
}

onMounted(async () => {
  await authenticate()
  await Promise.all([loadPyramids(), loadConcepts()])
})

// ── Computed ──────────────────────────────────────────────────────────────────
const currentPyramid    = computed(() => pyramids.value.find(p => p.id === selectedPyramidId.value))
const filteredConcepts  = computed(() => {
  const q = conceptSearch.value.toLowerCase()
  if (!q) return allConcepts.value
  return allConcepts.value.filter(c =>
    c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || (c.domainSov || '').toLowerCase().includes(q)
  )
})
const pickerFiltered = computed(() => {
  const q = pickerSearch.value.toLowerCase()
  const layer = editLayers.value[pickerLayerIdx.value]
  const existing = new Set(layer?.conceptIds || [])
  return allConcepts.value.filter(c =>
    !existing.has(c.id) &&
    (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
  )
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function getConcept(id)        { return allConcepts.value.find(c => c.id === String(id)) }
function domainColor(dom)      { return DOMAIN_COLORS[dom] || '#6b7280' }
function scoreColor(s)         { if (s == null) return 'var(--p-text-muted-color)'; return s >= 7 ? '#22c55e' : s >= 4 ? '#f59e0b' : '#ef4444' }

// ── Pyramid CRUD ──────────────────────────────────────────────────────────────
async function selectPyramid(id) {
  selectedPyramidId.value = id
  const p = currentPyramid.value
  editLayers.value = JSON.parse(JSON.stringify(p?.config?.layers || []))
}

async function createPyramid() {
  if (!newPyramid.value.name) return
  saving.value = true
  const config = JSON.stringify({ layers: [] })
  await apiPost(`/_m_new/${TYPE_PYRAMID}`, {
    [`t${TYPE_PYRAMID}`]:      newPyramid.value.name,
    [`r${FIELD_PYR_DESC}`]:    newPyramid.value.description,
    [`r${FIELD_PYR_CONFIG}`]:  config,
    [`r${FIELD_PYR_VERSION}`]: newPyramid.value.version
  })
  await loadPyramids()
  newPyramid.value = { name: '', description: '', version: '1.0' }
  showCreatePyramid.value = false
  saving.value = false
}

async function deletePyramid(id) {
  if (!confirm('Удалить пирамиду?')) return
  await apiPost(`/_m_del/${id}`, {})
  if (selectedPyramidId.value === id) { selectedPyramidId.value = null; editLayers.value = [] }
  await loadPyramids()
}

async function saveConfig() {
  if (!selectedPyramidId.value) return
  saving.value = true
  const config = JSON.stringify({ layers: editLayers.value.map((l, i) => ({ ...l, order: i + 1 })) })
  await apiPost(`/_m_set/${selectedPyramidId.value}`, { [`r${FIELD_PYR_CONFIG}`]: config })
  await loadPyramids()
  saving.value = false
}

function previewOnPyramid() {
  if (editLayers.value.length && !saving.value) {
    // автосохраняем перед переключением
    saveConfig().then(() => emit('previewPyramid', `fst_${selectedPyramidId.value}`))
  } else {
    emit('previewPyramid', `fst_${selectedPyramidId.value}`)
  }
}

// ── Layer management ──────────────────────────────────────────────────────────
function addLayer() {
  editLayers.value.push({ id: Date.now(), name: `Слой ${editLayers.value.length + 1}`, conceptIds: [], order: editLayers.value.length + 1 })
}
function removeLayer(i) { editLayers.value.splice(i, 1) }
function moveLayer(i, dir) {
  const j = i + dir
  if (j < 0 || j >= editLayers.value.length) return
  ;[editLayers.value[i], editLayers.value[j]] = [editLayers.value[j], editLayers.value[i]]
}
function removeConceptFromLayer(li, cid) {
  editLayers.value[li].conceptIds = editLayers.value[li].conceptIds.filter(x => x !== cid)
}
function openConceptPicker(li) { pickerLayerIdx.value = li; pickerSearch.value = ''; showConceptPicker.value = true }
function addConceptToLayer(c) {
  const layer = editLayers.value[pickerLayerIdx.value]
  if (!layer.conceptIds.includes(c.id)) layer.conceptIds.push(c.id)
  showConceptPicker.value = false
}

// ── Concept CRUD ──────────────────────────────────────────────────────────────
function editConceptRow(c) {
  editingConcept.value = c
  newConcept.value = { name: c.name, code: c.code, definition: c.definition, needs: c.needs, capabilities: c.capabilities, scoreSov: c.scoreSov, domainSov: c.domainSov }
  showCreateConcept.value = true
}

async function saveConcept() {
  if (!newConcept.value.name) return
  saving.value = true
  const body = {
    [`r${FIELD_CON_EN}`]:    newConcept.value.code,
    [`r${FIELD_CON_DEF}`]:   newConcept.value.definition,
    [`r${FIELD_CON_NEEDS}`]: newConcept.value.needs,
    [`r${FIELD_CON_CAPS}`]:  newConcept.value.capabilities,
    [`r${FIELD_CON_DOM}`]:   newConcept.value.domainSov || '',
  }
  if (newConcept.value.scoreSov != null) body[`r${FIELD_CON_SCORE}`] = String(newConcept.value.scoreSov)

  if (editingConcept.value?.id) {
    await apiPost(`/_m_set/${editingConcept.value.id}`, body)
  } else {
    await apiPost(`/_m_new/${TYPE_CONCEPTS}`, { [`t${TYPE_CONCEPTS}`]: newConcept.value.name, ...body })
  }
  await loadConcepts()
  newConcept.value = { name: '', code: '', definition: '', needs: '', capabilities: '', scoreSov: null, domainSov: null }
  editingConcept.value = null
  showCreateConcept.value = false
  saving.value = false
}

// ── Compatibility search ──────────────────────────────────────────────────────
async function runCompatSearch() {
  if (!compatQuery.value.trim()) return
  compatLoading.value = true
  const q = compatQuery.value.toLowerCase()

  // Simple local match: score by how many words from query appear in needs + capabilities
  const words = q.split(/\s+/).filter(w => w.length > 2)
  const results = allConcepts.value.map(c => {
    const text = `${c.needs} ${c.capabilities} ${c.name} ${c.definition}`.toLowerCase()
    let hits = 0
    for (const w of words) if (text.includes(w)) hits++
    const matchScore = words.length ? Math.round((hits / words.length) * 100) : 0
    return { ...c, matchScore }
  })
  .filter(c => c.matchScore > 0 || (c.needs && c.capabilities))
  .sort((a, b) => b.matchScore - a.matchScore)
  .slice(0, 20)

  compatResults.value = results
  compatLoading.value = false
}
</script>

<style scoped>
.spm {
  display: flex; flex-direction: column; gap: 0;
  height: 100%;
}
.spm-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 12px; gap: 12px; flex-wrap: wrap;
}
.spm-toolbar-right { display: flex; gap: 8px; }

.spm-body {
  display: flex; gap: 16px; flex: 1; min-height: 0; overflow: hidden;
}
.spm-body-full { flex-direction: column; overflow: auto; }

/* Sidebar */
.spm-sidebar {
  width: 220px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 4px;
  overflow-y: auto;
  border-right: 1px solid var(--p-content-border-color);
  padding-right: 12px;
}
.spm-sidebar-title {
  font-size: 10px; font-weight: 700; letter-spacing: 0.07em;
  text-transform: uppercase; color: var(--p-text-muted-color);
  margin-bottom: 6px;
}
.spm-pyramid-item {
  padding: 8px 10px; border-radius: 8px; cursor: pointer;
  border: 1px solid transparent;
  position: relative;
  transition: all 0.12s;
}
.spm-pyramid-item:hover { background: var(--p-surface-ground); }
.spm-pyramid-item.active { background: var(--p-surface-ground); border-color: var(--p-primary-color); }
.spm-pi-name { font-size: 13px; font-weight: 600; color: var(--p-text-color); }
.spm-pi-meta { font-size: 11px; color: var(--p-text-muted-color); margin-top: 2px; }
.spm-pi-del  { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); opacity: 0; }
.spm-pyramid-item:hover .spm-pi-del { opacity: 1; }

/* Editor */
.spm-editor {
  flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;
  padding-left: 4px;
}
.spm-editor-empty {
  align-items: center; justify-content: center; color: var(--p-text-muted-color); gap: 10px;
}
.spm-editor-header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
}
.spm-editor-title { font-size: 15px; font-weight: 700; color: var(--p-text-color); }
.spm-editor-sub   { font-size: 12px; color: var(--p-text-muted-color); margin-top: 2px; }

.spm-section-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--p-text-muted-color); margin-bottom: 8px;
}

/* Layer card */
.spm-layers { display: flex; flex-direction: column; gap: 8px; }
.spm-layer-card {
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px; padding: 10px 12px;
}
.spm-layer-header {
  display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
}
.spm-layer-order {
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--p-primary-color); color: white;
  font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.spm-layer-concepts {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
}
.spm-concept-chip {
  display: flex; align-items: center; gap: 4px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-left: 3px solid;
  border-radius: 6px; padding: 3px 6px;
  font-size: 11px;
}
.spm-chip-code {
  font-weight: 700; font-size: 11px; color: var(--p-primary-color);
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  padding: 1px 5px; border-radius: 4px;
}
.spm-chip-name  { color: var(--p-text-color); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.spm-chip-del   { background: none; border: none; cursor: pointer; color: var(--p-text-muted-color); font-size: 14px; line-height: 1; padding: 0 2px; }
.spm-chip-del:hover { color: var(--fst-red); }

.spm-add-concept-btn {
  background: none; border: 1px dashed var(--p-content-border-color);
  border-radius: 6px; padding: 3px 8px; cursor: pointer; font-size: 11px;
  color: var(--p-text-muted-color); display: flex; align-items: center; gap: 4px;
  transition: all 0.12s;
}
.spm-add-concept-btn:hover { border-color: var(--p-primary-color); color: var(--p-primary-color); }
.spm-add-layer-btn { align-self: flex-start; }

/* Concepts table */
.spm-concepts-toolbar {
  display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;
}
.spm-count { font-size: 12px; color: var(--p-text-muted-color); }
.spm-domain-badge {
  font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px;
  white-space: nowrap;
}
.spm-text-clamp { font-size: 11px; color: var(--p-text-muted-color); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* Compatibility */
.spm-compat-header { margin-bottom: 12px; }
.spm-compat-controls { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.spm-compat-results { display: flex; flex-direction: column; gap: 8px; }
.spm-compat-card {
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px; padding: 10px 14px;
}
.spm-compat-card-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.spm-compat-name  { font-size: 13px; font-weight: 600; color: var(--p-text-color); flex: 1; }
.spm-compat-score { font-size: 13px; font-weight: 700; }
.spm-compat-needs, .spm-compat-caps { font-size: 12px; color: var(--p-text-muted-color); margin-top: 4px; }
.spm-compat-needs b, .spm-compat-caps b { color: var(--p-text-color); }

/* Picker */
.spm-picker-list { max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
.spm-picker-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border-radius: 6px; cursor: pointer;
  transition: background 0.1s;
}
.spm-picker-item:hover { background: var(--p-surface-ground); }
.spm-picker-name { flex: 1; font-size: 13px; color: var(--p-text-color); }

/* Form */
.spm-form { display: flex; flex-direction: column; gap: 12px; }
.spm-form-row { display: flex; flex-direction: column; gap: 4px; }
.spm-form-row label { font-size: 11px; font-weight: 600; color: var(--p-text-muted-color); text-transform: uppercase; letter-spacing: 0.05em; }

.spm-loading-mini, .spm-empty-mini {
  font-size: 12px; color: var(--p-text-muted-color);
  display: flex; align-items: center; gap: 8px; padding: 10px 0;
}
</style>
