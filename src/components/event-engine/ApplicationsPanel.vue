<template>
  <div class="applications-panel">
    <div class="panel-toolbar">
      <h3>Приложения</h3>
      <Button label="Создать" icon="pi pi-plus" size="small" @click="showCreate = true" />
    </div>

    <DataTable :value="applications" :loading="loading" stripedRows size="small"
      selectionMode="single" v-model:selection="selectedApp" dataKey="id"
      @row-select="onSelect" :rowClass="rowClass">
      <Column field="val" header="Имя" sortable>
        <template #body="{ data }">
          <span :class="{ 'active-app': isActiveScope(data) }">
            <i v-if="isActiveScope(data)" class="pi pi-filter" style="font-size: 0.7rem; margin-right: 4px;" />
            {{ data.val }}
          </span>
        </template>
      </Column>
      <Column header="Описание">
        <template #body="{ data }">
          {{ (data.reqs?.['Описание']?.value || '').substring(0, 80) }}
        </template>
      </Column>
      <Column header="" style="width: 130px">
        <template #body="{ data }">
          <Button v-if="!isActiveScope(data)" label="Пресет" icon="pi pi-filter" size="small" text
            @click.stop="setAsScope(data)" />
          <Button v-else label="Сбросить" icon="pi pi-times" size="small" text severity="secondary"
            @click.stop="clearScope()" />
        </template>
      </Column>
    </DataTable>

    <div v-if="selectedApp" class="app-details">
      <h4>
        {{ selectedApp.val }}
        <Button v-if="!isActiveScope(selectedApp)" label="Использовать как пресет" icon="pi pi-filter"
          size="small" severity="info" outlined class="ml-2" @click="setAsScope(selectedApp)" />
        <Tag v-else value="Активный пресет" severity="success" class="ml-2" />
      </h4>

      <div class="detail-section">
        <div class="detail-header">
          <span>Модели</span>
          <Button icon="pi pi-plus" size="small" text @click="showAttachModel = true" />
        </div>
        <div class="detail-tags">
          <Tag v-for="m in attachedModels" :key="m.id" :value="m.val" class="cursor-pointer"
            @click="openModelEditor(m.id)" />
          <span v-if="attachedModels.length === 0" class="text-muted">Нет моделей</span>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-header">
          <span>Словари</span>
          <Button icon="pi pi-plus" size="small" text @click="showAttachVocab = true" />
        </div>
        <div class="detail-tags">
          <Tag v-for="v in attachedVocabs" :key="v.id" :value="v.val" severity="info" />
          <span v-if="attachedVocabs.length === 0" class="text-muted">Нет словарей</span>
        </div>
      </div>

      <ApplicationScopeSchema v-if="selectedApp" :applicationId="selectedApp.id" />
    </div>

    <!-- Create App Dialog -->
    <Dialog v-model:visible="showCreate" header="Создать приложение" modal :style="{ width: '400px' }">
      <div class="form-grid">
        <label>Имя</label>
        <InputText v-model="form.name" class="w-full" />
        <label>Описание</label>
        <Textarea v-model="form.description" rows="2" class="w-full" />
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="showCreate = false" />
        <Button label="Создать" @click="create" :loading="saving" />
      </template>
    </Dialog>

    <!-- Attach Model Dialog -->
    <Dialog v-model:visible="showAttachModel" header="Присоединить модель" modal :style="{ width: '400px' }">
      <Select v-model="attachModelId" :options="allModels" optionLabel="val" optionValue="id"
        placeholder="Выберите модель" class="w-full" />
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="showAttachModel = false" />
        <Button label="Присоединить" @click="attachModel" :loading="saving" />
      </template>
    </Dialog>

    <!-- Attach Vocab Dialog -->
    <Dialog v-model:visible="showAttachVocab" header="Присоединить словарь" modal :style="{ width: '400px' }">
      <Select v-model="attachVocabId" :options="allVocabs" optionLabel="val" optionValue="id"
        placeholder="Выберите словарь" class="w-full" />
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="showAttachVocab = false" />
        <Button label="Присоединить" @click="attachVocab" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import axios from 'axios'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import ApplicationScopeSchema from './ApplicationScopeSchema.vue'

const API = inject('eventEngineAPI')
const openModelEditor = inject('openModelEditor')
const selectedApplicationId = inject('selectedApplicationId', ref(null))

function isActiveScope(app) {
  return app && String(app.id) === String(selectedApplicationId.value)
}

function setAsScope(app) {
  selectedApplicationId.value = String(app.id)
}

function clearScope() {
  selectedApplicationId.value = null
}

function rowClass(data) {
  return isActiveScope(data) ? 'active-scope-row' : ''
}

const applications = ref([])
const allModels = ref([])
const allVocabs = ref([])
const selectedApp = ref(null)
const loading = ref(false)
const saving = ref(false)
const showCreate = ref(false)
const showAttachModel = ref(false)
const showAttachVocab = ref(false)
const form = ref({ name: '', description: '' })
const attachModelId = ref(null)
const attachVocabId = ref(null)

// For MULTI refs, we track by reading app's reqs
const attachedModels = computed(() => {
  if (!selectedApp.value) return []
  const modelsReq = selectedApp.value.reqs?.['Модели']
  if (!modelsReq?.value) return []
  const ids = String(modelsReq.value).split(',').map(s => s.trim())
  return allModels.value.filter(m => ids.includes(String(m.id)))
})

const attachedVocabs = computed(() => {
  if (!selectedApp.value) return []
  const vocabsReq = selectedApp.value.reqs?.['Словари']
  if (!vocabsReq?.value) return []
  const ids = String(vocabsReq.value).split(',').map(s => s.trim())
  return allVocabs.value.filter(v => ids.includes(String(v.id)))
})

async function load() {
  loading.value = true
  try {
    const [aRes, mRes, vRes] = await Promise.all([
      axios.get(`${API}/applications`),
      axios.get(`${API}/models`),
      axios.get(`${API}/vocabularies`),
    ])
    if (aRes.data.success) applications.value = aRes.data.data
    if (mRes.data.success) allModels.value = mRes.data.data
    if (vRes.data.success) allVocabs.value = vRes.data.data
  } catch (e) { console.error(e) }
  loading.value = false
}

function onSelect(event) {
  // selectedApp already set via v-model
}

async function create() {
  saving.value = true
  try {
    await axios.post(`${API}/applications`, form.value)
    showCreate.value = false
    form.value = { name: '', description: '' }
    await load()
  } catch (e) { console.error(e) }
  saving.value = false
}

async function attachModel() {
  if (!selectedApp.value || !attachModelId.value) return
  saving.value = true
  try {
    await axios.put(`${API}/applications/${selectedApp.value.id}/models`, { modelId: attachModelId.value })
    showAttachModel.value = false
    await load()
  } catch (e) { console.error(e) }
  saving.value = false
}

async function attachVocab() {
  if (!selectedApp.value || !attachVocabId.value) return
  saving.value = true
  try {
    await axios.put(`${API}/applications/${selectedApp.value.id}/vocabularies`, { vocabularyId: attachVocabId.value })
    showAttachVocab.value = false
    await load()
  } catch (e) { console.error(e) }
  saving.value = false
}

onMounted(load)
</script>

<style scoped>
.applications-panel { max-width: 1000px; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.panel-toolbar h3 { margin: 0; }
.form-grid { display: grid; grid-template-columns: 100px 1fr; gap: 10px; align-items: center; }
.app-details { margin-top: 16px; padding: 16px; background: var(--p-surface-card); border-radius: 8px; border: 1px solid var(--p-surface-border); }
.app-details h4 { margin: 0 0 12px 0; }
.detail-section { margin-bottom: 12px; }
.detail-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-weight: 600; }
.detail-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.text-muted { color: var(--p-text-muted-color); font-size: 0.85rem; }
.cursor-pointer { cursor: pointer; }
.active-app { color: var(--p-primary-color); font-weight: 600; }
.ml-2 { margin-left: 8px; }
:deep(.active-scope-row) { background: var(--p-primary-50) !important; }
</style>
