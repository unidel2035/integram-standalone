<template>
  <div class="vocabularies-panel">
    <div class="panel-toolbar">
      <h3>Словари</h3>
      <Button label="Создать словарь" icon="pi pi-plus" size="small" @click="showCreateVocab = true" />
    </div>

    <div class="vocabs-layout">
      <div class="vocabs-list">
        <DataTable :value="vocabularies" :loading="loading" stripedRows size="small"
          selectionMode="single" v-model:selection="selectedVocab" dataKey="id"
          @row-select="onVocabSelect">
          <Column field="val" header="Словарь" sortable />
          <Column header="Описание">
            <template #body="{ data }">
              {{ (data.reqs?.['Описание']?.value || '').substring(0, 60) }}
            </template>
          </Column>
        </DataTable>
      </div>

      <div class="vocabs-properties" v-if="selectedVocab">
        <div class="panel-toolbar">
          <h4>Свойства: {{ selectedVocab.val }}</h4>
          <Button label="Добавить" icon="pi pi-plus" size="small" @click="showCreateProp = true" />
        </div>

        <DataTable :value="properties" :loading="propsLoading" stripedRows size="small" dataKey="id">
          <Column field="val" header="Имя" sortable />
          <Column header="Тип свойства">
            <template #body="{ data }">
              <Tag :value="data.reqs?.['Тип свойства']?.value || '—'" />
            </template>
          </Column>
          <Column header="Тип данных">
            <template #body="{ data }">
              <Tag :value="data.reqs?.['Тип данных']?.value || '—'" severity="info" />
            </template>
          </Column>
          <Column header="Допустимые значения">
            <template #body="{ data }">
              {{ formatAllowed(data.reqs?.['Допустимые значения']?.value) }}
            </template>
          </Column>
        </DataTable>
      </div>
    </div>

    <Dialog v-model:visible="showCreateVocab" header="Создать словарь" modal :style="{ width: '400px' }">
      <div class="form-grid">
        <label>Имя</label>
        <InputText v-model="vocabForm.name" class="w-full" />
        <label>Описание</label>
        <Textarea v-model="vocabForm.description" rows="2" class="w-full" />
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="showCreateVocab = false" />
        <Button label="Создать" @click="createVocab" :loading="saving" />
      </template>
    </Dialog>

    <Dialog v-model:visible="showCreateProp" header="Добавить свойство" modal :style="{ width: '500px' }">
      <div class="form-grid">
        <label>Имя</label>
        <InputText v-model="propForm.name" class="w-full" />
        <label>Тип свойства</label>
        <Select v-model="propForm.propertyType" :options="propertyTypes" class="w-full" />
        <label>Тип данных</label>
        <Select v-model="propForm.dataType" :options="dataTypes" class="w-full" />
        <template v-if="propForm.dataType === 'EnumType'">
          <label>Значения</label>
          <Chips v-model="propForm.allowedValues" class="w-full" />
        </template>
        <template v-if="propForm.propertyType === 'relation'">
          <label>Range</label>
          <Select v-model="propForm.rangeConceptId" :options="concepts" optionLabel="val" optionValue="id" class="w-full" />
        </template>
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="showCreateProp = false" />
        <Button label="Добавить" @click="createProp" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, inject } from 'vue'
import axios from 'axios'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Chips from 'primevue/chips'

const API = inject('eventEngineAPI')
const selectedApplicationId = inject('selectedApplicationId', ref(null))

function buildUrl(path) {
  const appId = selectedApplicationId.value
  if (!appId) return `${API}${path}`
  const sep = path.includes('?') ? '&' : '?'
  return `${API}${path}${sep}applicationId=${appId}`
}
const vocabularies = ref([])
const properties = ref([])
const concepts = ref([])
const selectedVocab = ref(null)
const loading = ref(false)
const propsLoading = ref(false)
const saving = ref(false)
const showCreateVocab = ref(false)
const showCreateProp = ref(false)
const vocabForm = ref({ name: '', description: '' })
const propForm = ref({ name: '', propertyType: 'attribute', dataType: 'Text', allowedValues: [], rangeConceptId: null })
const propertyTypes = ['attribute', 'relation', 'role']
const dataTypes = ['BasicType', 'EnumType', 'Text', 'Numeric', 'Date', 'Boolean']

function formatAllowed(val) {
  if (!val) return '—'
  try { return JSON.parse(val).join(', ') } catch { return val }
}

async function load() {
  loading.value = true
  try {
    const [vRes, cRes] = await Promise.all([
      axios.get(buildUrl('/vocabularies')),
      axios.get(buildUrl('/concepts')),
    ])
    if (vRes.data.success) vocabularies.value = vRes.data.data
    if (cRes.data.success) concepts.value = cRes.data.data
  } catch (e) { console.error(e) }
  loading.value = false
}

async function onVocabSelect(event) {
  if (!event.data) return
  propsLoading.value = true
  try {
    const { data } = await axios.get(`${API}/vocabularies/${event.data.id}/properties`)
    if (data.success) properties.value = data.data
  } catch (e) { console.error(e) }
  propsLoading.value = false
}

async function createVocab() {
  saving.value = true
  try {
    await axios.post(`${API}/vocabularies`, vocabForm.value)
    showCreateVocab.value = false
    vocabForm.value = { name: '', description: '' }
    await load()
  } catch (e) { console.error(e) }
  saving.value = false
}

async function createProp() {
  if (!selectedVocab.value) return
  saving.value = true
  try {
    await axios.post(`${API}/vocabularies/${selectedVocab.value.id}/properties`, propForm.value)
    showCreateProp.value = false
    propForm.value = { name: '', propertyType: 'attribute', dataType: 'Text', allowedValues: [], rangeConceptId: null }
    await onVocabSelect({ data: selectedVocab.value })
  } catch (e) { console.error(e) }
  saving.value = false
}

watch(selectedApplicationId, () => load())
onMounted(load)
</script>

<style scoped>
.vocabularies-panel { max-width: 1200px; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.panel-toolbar h3, .panel-toolbar h4 { margin: 0; }
.vocabs-layout { display: flex; gap: 16px; }
.vocabs-list { flex: 1; min-width: 300px; }
.vocabs-properties { flex: 2; }
.form-grid { display: grid; grid-template-columns: 120px 1fr; gap: 10px; align-items: center; }
</style>
