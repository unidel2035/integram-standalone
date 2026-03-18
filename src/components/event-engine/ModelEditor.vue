<template>
  <div class="model-editor">
    <div class="panel-toolbar">
      <h3>Редактор модели</h3>
      <div class="toolbar-actions">
        <Select v-model="selectedModelId" :options="models" optionLabel="val" optionValue="id"
          placeholder="Выберите модель" class="model-select" @change="loadTree" />
        <Button icon="pi pi-refresh" severity="secondary" text @click="loadTree" />
      </div>
    </div>

    <div v-if="!selectedModelId" class="empty-state">
      <i class="pi pi-cog" style="font-size: 3rem; color: var(--p-text-muted-color)"></i>
      <p>Выберите модель для редактирования</p>
    </div>

    <div v-else class="editor-layout">
      <!-- Left: Tree of model events -->
      <div class="editor-tree">
        <div class="tree-header">
          <span class="tree-title">Дерево свойств</span>
          <Button label="+ Свойство" size="small" @click="showAddProperty = true" />
        </div>

        <Tree :value="treeNodes" selectionMode="single" v-model:selectionKeys="selectedKeys"
          @node-select="onNodeSelect" class="ee-tree" :loading="treeLoading">
          <template #default="{ node }">
            <div class="tree-node-content">
              <Tag :value="node.data?.dataType || '—'" :severity="dataTypeSeverity(node.data?.dataType)" size="small" />
              <span>{{ node.label }}</span>
              <Button icon="pi pi-plus" text size="small" class="node-action"
                @click.stop="addChildProperty(node)" v-tooltip="'Вложенное свойство'" />
              <Button icon="pi pi-trash" text severity="danger" size="small" class="node-action"
                @click.stop="removeEvent(node.key)" />
            </div>
          </template>
        </Tree>
      </div>

      <!-- Right: Constraints editor -->
      <div class="editor-constraints" v-if="selectedNode">
        <h4>Ограничения: {{ selectedNode.label }}</h4>

        <div class="constraints-form">
          <div class="constraint-row">
            <Checkbox v-model="constraints.required" :binary="true" inputId="c-required" />
            <label for="c-required">Required</label>
          </div>
          <div class="constraint-row">
            <Checkbox v-model="constraints.multiple" :binary="true" inputId="c-multiple" />
            <label for="c-multiple">Multiple</label>
          </div>
          <div class="constraint-row">
            <Checkbox v-model="constraints.immutable" :binary="true" inputId="c-immutable" />
            <label for="c-immutable">Immutable</label>
          </div>
          <div class="constraint-row">
            <Checkbox v-model="constraints.unique" :binary="true" inputId="c-unique" />
            <label for="c-unique">Unique</label>
          </div>
          <div class="constraint-row">
            <Checkbox v-model="constraints.uniqueIdentifier" :binary="true" inputId="c-uid" />
            <label for="c-uid">UniqueIdentifier</label>
          </div>

          <div class="constraint-field">
            <label>Condition (BSL)</label>
            <Textarea v-model="constraints.condition" rows="2" class="w-full" />
          </div>
          <div class="constraint-field">
            <label>ValueCondition</label>
            <Textarea v-model="constraints.valueCondition" rows="2" class="w-full" />
          </div>
          <div class="constraint-field">
            <label>Permission (роль)</label>
            <InputText v-model="constraints.permission" class="w-full" />
          </div>
          <div class="constraint-field">
            <label>SetValue (BSL)</label>
            <Textarea v-model="constraints.setValue" rows="2" class="w-full" />
          </div>
          <div class="constraint-field">
            <label>SetRange (BSL)</label>
            <Textarea v-model="constraints.setRange" rows="2" class="w-full" />
          </div>
          <div class="constraint-field">
            <label>Default</label>
            <InputText v-model="constraints.default" class="w-full" />
          </div>
          <div class="constraint-field">
            <label>Range (концепт)</label>
            <Select v-model="constraints.range" :options="concepts" optionLabel="val" optionValue="id"
              placeholder="Выберите концепт" class="w-full" showClear />
          </div>

          <Button label="Сохранить ограничения" icon="pi pi-save" @click="saveConstraints" :loading="saving" />
        </div>
      </div>
    </div>

    <!-- Add Property Dialog -->
    <Dialog v-model:visible="showAddProperty" header="Добавить свойство" modal :style="{ width: '400px' }">
      <div class="form-grid">
        <label>Свойство</label>
        <Select v-model="addPropForm.propertyId" :options="availableProperties" optionLabel="val" optionValue="id"
          placeholder="Из словаря" class="w-full" />
        <label>Или имя</label>
        <InputText v-model="addPropForm.name" class="w-full" placeholder="Произвольное имя" />
        <label>Порядок</label>
        <InputNumber v-model="addPropForm.order" class="w-full" />
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="showAddProperty = false" />
        <Button label="Добавить" @click="addProperty" :loading="saving" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, inject } from 'vue'
import axios from 'axios'
import Tree from 'primevue/tree'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'

const props = defineProps({
  modelId: { type: [String, Number], default: null }
})

const API = inject('eventEngineAPI')
const injectedModelId = inject('selectedModelId', ref(null))

const models = ref([])
const concepts = ref([])
const availableProperties = ref([])
const treeNodes = ref([])
const treeLoading = ref(false)
const saving = ref(false)
const selectedModelId = ref(props.modelId || injectedModelId.value)
const selectedKeys = ref(null)
const selectedNode = ref(null)
const showAddProperty = ref(false)
const addPropForm = ref({ propertyId: null, name: '', order: 0 })
const parentEventId = ref(null)

const constraints = reactive({
  required: false,
  multiple: false,
  immutable: false,
  unique: false,
  uniqueIdentifier: false,
  condition: null,
  valueCondition: null,
  permission: null,
  setValue: null,
  setRange: null,
  default: null,
  range: null,
})

function dataTypeSeverity(dt) {
  const map = { 'BasicType': 'secondary', 'EnumType': 'warn', 'Text': 'info', 'Numeric': 'success', 'Date': 'contrast', 'Boolean': 'secondary' }
  return map[dt] || 'secondary'
}

function buildTreeNodes(items) {
  return items.map(item => ({
    key: item.id,
    label: item.val,
    data: {
      id: item.id,
      propertyType: item.reqs?.['Тип свойства']?.value,
      dataType: item.reqs?.['Тип данных']?.value,
      constraints: item.reqs?.['Ограничения']?.value,
      propertyId: item.reqs?.['Свойство']?.value,
    },
    children: item.children ? buildTreeNodes(item.children) : [],
  }))
}

async function loadModels() {
  try {
    const [mRes, cRes, pRes] = await Promise.all([
      axios.get(`${API}/models`),
      axios.get(`${API}/concepts`),
      axios.get(`${API}/vocabularies/0/properties`).catch(() => ({ data: { success: true, data: [] } })),
    ])
    if (mRes.data.success) models.value = mRes.data.data
    if (cRes.data.success) concepts.value = cRes.data.data
    // Load all properties for property picker
    const allPropsRes = await axios.get(`${API}/vocabularies/0/properties`).catch(() => null)
    if (allPropsRes?.data?.success) availableProperties.value = allPropsRes.data.data
  } catch (e) { console.error(e) }
}

async function loadTree() {
  if (!selectedModelId.value) return
  treeLoading.value = true
  try {
    const { data } = await axios.get(`${API}/models/${selectedModelId.value}/tree`)
    if (data.success) treeNodes.value = buildTreeNodes(data.data)
  } catch (e) { console.error(e) }
  treeLoading.value = false
}

function onNodeSelect(node) {
  selectedNode.value = node
  // Parse constraints
  try {
    const c = JSON.parse(node.data?.constraints || '{}')
    Object.assign(constraints, {
      required: c.required || false,
      multiple: c.multiple || false,
      immutable: c.immutable || false,
      unique: c.unique || false,
      uniqueIdentifier: c.uniqueIdentifier || false,
      condition: c.condition || null,
      valueCondition: c.valueCondition || null,
      permission: c.permission || null,
      setValue: c.setValue || null,
      setRange: c.setRange || null,
      default: c.default || null,
      range: c.range || null,
    })
  } catch {
    Object.keys(constraints).forEach(k => constraints[k] = k.endsWith('ed') || k === 'multiple' || k === 'unique' || k === 'uniqueIdentifier' ? false : null)
  }
}

async function saveConstraints() {
  if (!selectedNode.value) return
  saving.value = true
  try {
    await axios.put(`${API}/model-events/${selectedNode.value.key}`, {
      'Ограничения': JSON.stringify(constraints),
    })
    await loadTree()
  } catch (e) { console.error(e) }
  saving.value = false
}

function addChildProperty(node) {
  parentEventId.value = node.key
  showAddProperty.value = true
}

async function addProperty() {
  if (!selectedModelId.value) return
  saving.value = true
  try {
    const name = addPropForm.value.name || availableProperties.value.find(p => p.id === addPropForm.value.propertyId)?.val || 'property'
    await axios.post(`${API}/models/${selectedModelId.value}/events`, {
      name,
      propertyId: addPropForm.value.propertyId,
      parentEventId: parentEventId.value,
      order: addPropForm.value.order,
      constraints: {},
    })
    showAddProperty.value = false
    addPropForm.value = { propertyId: null, name: '', order: 0 }
    parentEventId.value = null
    await loadTree()
  } catch (e) { console.error(e) }
  saving.value = false
}

async function removeEvent(eventId) {
  try {
    await axios.delete(`${API}/model-events/${eventId}`)
    selectedNode.value = null
    await loadTree()
  } catch (e) { console.error(e) }
}

watch(() => props.modelId, (val) => {
  if (val) { selectedModelId.value = val; loadTree() }
})

watch(injectedModelId, (val) => {
  if (val && !props.modelId) { selectedModelId.value = val; loadTree() }
})

onMounted(async () => {
  await loadModels()
  if (selectedModelId.value) await loadTree()
})
</script>

<style scoped>
.model-editor { max-width: 1200px; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.panel-toolbar h3 { margin: 0; }
.toolbar-actions { display: flex; gap: 8px; align-items: center; }
.model-select { width: 250px; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 0; }
.empty-state p { color: var(--p-text-muted-color); }

.editor-layout { display: flex; gap: 16px; }
.editor-tree { flex: 1; min-width: 350px; }
.editor-constraints { flex: 1; padding: 16px; background: var(--p-surface-card); border-radius: 8px; border: 1px solid var(--p-surface-border); }
.editor-constraints h4 { margin: 0 0 16px 0; }

.tree-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.tree-title { font-weight: 600; }
.ee-tree { border: 1px solid var(--p-surface-border); border-radius: 8px; }

.tree-node-content { display: flex; align-items: center; gap: 8px; }
.node-action { opacity: 0.4; }
.tree-node-content:hover .node-action { opacity: 1; }

.constraints-form { display: flex; flex-direction: column; gap: 10px; }
.constraint-row { display: flex; align-items: center; gap: 8px; }
.constraint-field { display: flex; flex-direction: column; gap: 4px; }
.constraint-field label { font-size: 0.85rem; font-weight: 500; }

.form-grid { display: grid; grid-template-columns: 100px 1fr; gap: 10px; align-items: center; }
</style>
