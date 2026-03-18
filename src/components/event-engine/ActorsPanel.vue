<template>
  <div class="actors-panel">
    <div class="panel-toolbar">
      <h3>Акторы</h3>
      <Button label="Создать" icon="pi pi-plus" size="small" @click="showCreate = true" />
    </div>

    <DataTable :value="actors" :loading="loading" stripedRows size="small"
      selectionMode="single" v-model:selection="selected" dataKey="id">
      <Column field="val" header="Имя" sortable />
      <Column header="Тип">
        <template #body="{ data }">
          <Tag :value="data.reqs?.['Тип']?.value || '—'" :severity="typeSeverity(data.reqs?.['Тип']?.value)" />
        </template>
      </Column>
      <Column header="Статус">
        <template #body="{ data }">
          <Tag :value="data.reqs?.['Статус']?.value || 'active'"
            :severity="data.reqs?.['Статус']?.value === 'inactive' ? 'danger' : 'success'" />
        </template>
      </Column>
      <Column header="Описание">
        <template #body="{ data }">
          {{ (data.reqs?.['Описание']?.value || '').substring(0, 80) }}
        </template>
      </Column>
      <Column header="" style="width: 80px">
        <template #body="{ data }">
          <Button icon="pi pi-trash" severity="danger" text size="small" @click="remove(data.id)" />
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="showCreate" header="Создать актора" modal :style="{ width: '450px' }">
      <div class="form-grid">
        <label>Имя</label>
        <InputText v-model="form.name" class="w-full" />
        <label>Тип</label>
        <Select v-model="form.type" :options="typeOptions" class="w-full" />
        <label>Описание</label>
        <Textarea v-model="form.description" rows="3" class="w-full" />
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="showCreate = false" />
        <Button label="Создать" @click="create" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue'
import axios from 'axios'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

const API = inject('eventEngineAPI')
const actors = ref([])
const selected = ref(null)
const loading = ref(false)
const saving = ref(false)
const showCreate = ref(false)
const form = ref({ name: '', type: 'human', description: '' })
const typeOptions = ['human', 'sensor', 'agent']

function typeSeverity(type) {
  if (type === 'human') return 'info'
  if (type === 'sensor') return 'warn'
  if (type === 'agent') return 'success'
  return 'secondary'
}

async function load() {
  loading.value = true
  try {
    const { data } = await axios.get(`${API}/actors`)
    if (data.success) actors.value = data.data
  } catch (e) { console.error(e) }
  loading.value = false
}

async function create() {
  saving.value = true
  try {
    await axios.post(`${API}/actors`, form.value)
    showCreate.value = false
    form.value = { name: '', type: 'human', description: '' }
    await load()
  } catch (e) { console.error(e) }
  saving.value = false
}

async function remove(id) {
  try {
    await axios.delete(`${API}/actors/${id}`)
    await load()
  } catch (e) { console.error(e) }
}

onMounted(load)
</script>

<style scoped>
.actors-panel { max-width: 1000px; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.panel-toolbar h3 { margin: 0; }
.form-grid { display: grid; grid-template-columns: 100px 1fr; gap: 10px; align-items: center; }
</style>
