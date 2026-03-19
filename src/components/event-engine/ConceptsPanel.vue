<template>
  <div class="concepts-panel">
    <div class="panel-toolbar">
      <h3>Концепты</h3>
      <div class="search-bar">
        <InputText v-model="searchQuery" placeholder="Поиск концептов..." class="search-input"
          @keydown.enter="doSearch" />
        <div class="search-mode">
          <label class="search-toggle">
            <input type="checkbox" v-model="useKagSearch" />
            <span>KAG (семантический)</span>
          </label>
        </div>
        <Button icon="pi pi-search" size="small" @click="doSearch" :loading="searching" />
      </div>
      <Button label="Создать" icon="pi pi-plus" size="small" @click="showCreate = true" />
    </div>

    <div v-if="kagResults.length > 0" class="kag-results">
      <div class="kag-header">
        <span>Результаты KAG ({{ kagResults.length }})</span>
        <Button icon="pi pi-times" text size="small" @click="kagResults = []" />
      </div>
      <div v-for="r in kagResults" :key="r.id" class="kag-item">
        <strong>{{ r.name }}</strong>
        <span v-if="r.score" class="kag-score">{{ (r.score * 100).toFixed(0) }}%</span>
        <div v-if="r.observations?.length" class="kag-obs">{{ r.observations[0] }}</div>
      </div>
    </div>

    <DataTable :value="filteredConcepts" :loading="loading" stripedRows size="small" dataKey="id">
      <Column field="val" header="Имя" sortable />
      <Column header="Описание">
        <template #body="{ data }">
          {{ (data.reqs?.['Описание']?.value || '').substring(0, 100) }}
        </template>
      </Column>
      <Column header="Онтология БПЛА" style="width: 220px">
        <template #body="{ data }">
          <div v-if="getOntologyName(data)" class="ontology-link">
            <i class="pi pi-link" style="font-size: 0.75rem; color: var(--primary-500)" />
            <span>{{ getOntologyName(data) }}</span>
          </div>
          <Button v-else label="Привязать" icon="pi pi-link" size="small" text severity="secondary"
            @click="openLinkDialog(data)" />
        </template>
      </Column>
      <Column header="Модели" style="width: 200px">
        <template #body="{ data }">
          <div class="model-links">
            <Button v-for="m in getModels(data.id)" :key="m.id"
              :label="m.val" size="small" text @click="openModelEditor(m.id)" />
            <span v-if="getModels(data.id).length === 0" class="text-muted">—</span>
          </div>
        </template>
      </Column>
      <Column header="Индивиды" style="width: 120px">
        <template #body="{ data }">
          <Button :label="String(getIndividualCount(data.id))" size="small" text
            @click="openIndividualForm(data.id)" />
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="showCreate" header="Создать концепт" modal :style="{ width: '500px' }">
      <div class="form-grid">
        <label>Имя</label>
        <InputText v-model="form.name" class="w-full" />
        <label>Описание</label>
        <Textarea v-model="form.description" rows="3" class="w-full" />
        <label>Онтология</label>
        <Select v-model="form.ontologyElementId" :options="ontologyElements" optionLabel="val" optionValue="id"
          placeholder="Привязать к элементу онтологии" class="w-full" filter showClear />
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="showCreate = false" />
        <Button label="Создать" @click="create" :loading="saving" />
      </template>
    </Dialog>

    <!-- Диалог привязки к онтологии -->
    <Dialog v-model:visible="showLink" header="Привязать к Онтологии БПЛА" modal :style="{ width: '500px' }">
      <p class="mb-3">Концепт: <strong>{{ linkTarget?.val }}</strong></p>
      <Select v-model="linkElementId" :options="ontologyElements" optionLabel="val" optionValue="id"
        placeholder="Выберите элемент онтологии" class="w-full" filter>
        <template #option="{ option }">
          <div>
            <strong>{{ option.val }}</strong>
            <span v-if="option.reqs?.['prefLabel_en']?.value" class="text-muted ml-2">({{ option.reqs['prefLabel_en'].value }})</span>
          </div>
        </template>
      </Select>
      <div v-if="linkElementId && getElementDetails(linkElementId)" class="ontology-details mt-3">
        <div v-if="getElementDetails(linkElementId)?.reqs?.['Определение']?.value">
          <strong>Определение:</strong> {{ getElementDetails(linkElementId).reqs['Определение'].value.substring(0, 200) }}
        </div>
        <div v-if="getElementDetails(linkElementId)?.reqs?.['prefLabel_en']?.value">
          <strong>EN:</strong> {{ getElementDetails(linkElementId).reqs['prefLabel_en'].value }}
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="showLink = false" />
        <Button label="Привязать" @click="linkToOntology" :loading="saving" :disabled="!linkElementId" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue'
import axios from 'axios'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'

const API = inject('eventEngineAPI')
const openModelEditor = inject('openModelEditor')
const openIndividualForm = inject('openIndividualForm')
const selectedApplicationId = inject('selectedApplicationId', ref(null))

const concepts = ref([])
const models = ref([])
const individuals = ref([])
const ontologyElements = ref([])
const ontologyMap = ref({})
const loading = ref(false)
const saving = ref(false)
const searching = ref(false)
const showCreate = ref(false)
const showLink = ref(false)
const linkTarget = ref(null)
const linkElementId = ref(null)
const form = ref({ name: '', description: '', ontologyElementId: null })
const searchQuery = ref('')
const useKagSearch = ref(false)
const kagResults = ref([])

const filteredConcepts = computed(() => {
  if (!searchQuery.value || useKagSearch.value) return concepts.value
  const q = searchQuery.value.toLowerCase()
  return concepts.value.filter(c => {
    const val = (c.val || '').toLowerCase()
    if (val.includes(q)) return true
    const reqs = c.reqs || {}
    for (const r of Object.values(reqs)) {
      if ((r.value || '').toString().toLowerCase().includes(q)) return true
    }
    return false
  })
})

async function doSearch() {
  if (!searchQuery.value.trim()) {
    kagResults.value = []
    return
  }
  if (!useKagSearch.value) {
    kagResults.value = []
    return
  }
  searching.value = true
  try {
    const { data } = await axios.get(`${API}/ontology/search`, { params: { q: searchQuery.value, limit: 20 } })
    if (data.success) {
      kagResults.value = data.data
    }
  } catch (e) {
    console.error('KAG search failed:', e)
    kagResults.value = []
  }
  searching.value = false
}

function getModels(conceptId) {
  return models.value.filter(m => String(m.reqs?.['Концепт']?.value) === String(conceptId))
}

function getIndividualCount(conceptId) {
  return individuals.value.filter(i => String(i.reqs?.['Концепт']?.value) === String(conceptId)).length
}

function getOntologyName(concept) {
  const ref = concept.reqs?.['Элемент онтологии']
  if (!ref?.value) return null
  return ontologyMap.value[ref.value]?.val || ref.displayValue || null
}

function getElementDetails(elementId) {
  return ontologyMap.value[elementId] || null
}

function openLinkDialog(concept) {
  linkTarget.value = concept
  linkElementId.value = null
  showLink.value = true
}

function buildUrl(path) {
  const appId = selectedApplicationId.value
  if (!appId) return `${API}${path}`
  const sep = path.includes('?') ? '&' : '?'
  return `${API}${path}${sep}applicationId=${appId}`
}

async function load() {
  loading.value = true
  try {
    const [cRes, mRes, iRes, oRes] = await Promise.all([
      axios.get(buildUrl('/concepts')),
      axios.get(buildUrl('/models')),
      axios.get(buildUrl('/individuals')),
      axios.get(`${API}/ontology-elements`),
    ])
    if (cRes.data.success) concepts.value = cRes.data.data
    if (mRes.data.success) models.value = mRes.data.data
    if (iRes.data.success) individuals.value = iRes.data.data
    if (oRes.data.success) {
      ontologyElements.value = oRes.data.data
      const map = {}
      for (const el of oRes.data.data) map[el.id] = el
      ontologyMap.value = map
    }
  } catch (e) { console.error(e) }
  loading.value = false
}

async function create() {
  saving.value = true
  try {
    await axios.post(`${API}/concepts`, form.value)
    showCreate.value = false
    form.value = { name: '', description: '', ontologyElementId: null }
    await load()
  } catch (e) { console.error(e) }
  saving.value = false
}

async function linkToOntology() {
  if (!linkTarget.value || !linkElementId.value) return
  saving.value = true
  try {
    await axios.put(`${API}/concepts/${linkTarget.value.id}/ontology-link`, {
      ontologyElementId: linkElementId.value
    })
    showLink.value = false
    await load()
  } catch (e) { console.error(e) }
  saving.value = false
}

watch(selectedApplicationId, () => load())
onMounted(load)
</script>

<style scoped>
.concepts-panel { max-width: 1000px; }
.panel-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.panel-toolbar h3 { margin: 0; }
.search-bar { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px; }
.search-input { flex: 1; min-width: 150px; }
.search-mode { display: flex; align-items: center; white-space: nowrap; }
.search-toggle { display: flex; align-items: center; gap: 4px; font-size: 0.82rem; cursor: pointer; color: var(--p-text-muted-color); }
.search-toggle input { cursor: pointer; }
.kag-results { background: var(--p-surface-card); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 10px; margin-bottom: 12px; }
.kag-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; color: var(--p-primary-color); }
.kag-item { padding: 6px 8px; border-bottom: 1px solid var(--p-surface-border); font-size: 0.85rem; }
.kag-item:last-child { border-bottom: none; }
.kag-score { margin-left: 8px; color: var(--p-text-muted-color); font-size: 0.75rem; }
.kag-obs { color: var(--p-text-muted-color); font-size: 0.78rem; margin-top: 2px; }
.form-grid { display: grid; grid-template-columns: 100px 1fr; gap: 10px; align-items: center; }
.model-links { display: flex; flex-wrap: wrap; gap: 4px; }
.text-muted { color: var(--p-text-muted-color); font-size: 0.85rem; }
.ontology-link { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--primary-700); }
.ontology-details { background: var(--p-surface-card); padding: 0.75rem; border-radius: 0.5rem; font-size: 0.85rem; }
.ontology-details div + div { margin-top: 0.5rem; }
.ml-2 { margin-left: 0.5rem; }
.mb-3 { margin-bottom: 0.75rem; }
.mt-3 { margin-top: 0.75rem; }
</style>
