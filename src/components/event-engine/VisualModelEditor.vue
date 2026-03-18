<template>
  <div class="visual-model-editor" @keydown="undoRedo?.handleKeydown">
    <!-- Toolbar -->
    <div class="vme-toolbar">
      <Select v-model="currentModelId" :options="models" optionLabel="val" optionValue="id"
        placeholder="Выберите модель" class="vme-model-select" @change="onModelSelected" />
      <Button icon="pi pi-plus" label="Свойство" size="small" @click="addProperty" :disabled="!currentModelId" />
      <Button icon="pi pi-arrows-alt" label="Авто-лейаут" size="small" severity="secondary" @click="autoLayout" :disabled="!nodes.length" />
      <Button icon="pi pi-search-plus" label="Все узлы" size="small" severity="secondary" @click="fitView" :disabled="!nodes.length" />
      <div class="vme-toolbar-spacer" />
      <Button v-if="undoRedo?.canUndo?.value" icon="pi pi-undo" size="small" severity="secondary" @click="undoRedo.undo()" v-tooltip="'Ctrl+Z'" />
      <Button v-if="undoRedo?.canRedo?.value" icon="pi pi-refresh" size="small" severity="secondary" @click="undoRedo.redo()" v-tooltip="'Ctrl+Shift+Z'" />
      <span class="vme-version-badge" v-if="modelVersion">{{ modelVersion }}</span>
      <Button icon="pi pi-clone" label="Клонировать" size="small" severity="info" @click="cloneModel" v-tooltip="'Создать версию модели'" :disabled="!currentModelId" />
      <div class="vme-separator" />
      <!-- Execution controls -->
      <Select v-model="selectedIndividualId" :options="individuals" optionLabel="val" optionValue="id"
        :placeholder="currentConceptId ? `Индивид (${individuals.length})` : 'Индивид (все)'"
        class="vme-individual-select" :disabled="!currentModelId" filter />
      <Select v-model="selectedActorId" :options="actors" optionLabel="val" optionValue="id"
        placeholder="Актор" class="vme-actor-select" :disabled="!currentModelId" filter />
      <Button icon="pi pi-play" label="Запустить" size="small" severity="success"
        @click="executeModel" :disabled="!currentModelId || !selectedIndividualId" :loading="executing"
        v-tooltip="'Исполнить модель для индивида'" />
      <Button v-if="executionResults.length" icon="pi pi-eye-slash" size="small" severity="secondary"
        @click="clearExecution" v-tooltip="'Сбросить результат'" />
    </div>

    <!-- Empty state -->
    <div v-if="!currentModelId" class="vme-empty">
      <i class="pi pi-objects-column" style="font-size: 3rem; color: var(--p-text-muted-color)"></i>
      <p>Выберите модель для визуального редактирования</p>
    </div>

    <!-- VueFlow Canvas -->
    <div class="vme-canvas" v-if="currentModelId">
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :default-viewport="{ zoom: 0.8, x: 50, y: 50 }"
        :min-zoom="0.2"
        :max-zoom="3"
        :snap-to-grid="true"
        :snap-grid="[15, 15]"
        fit-view-on-init
        @node-click="onNodeClick"
        @node-double-click="onNodeDoubleClick"
        @edge-click="onEdgeClick"
        @connect="onConnect"
        @nodes-change="onNodesChange"
      >
        <Background :gap="20" />
        <Controls />
        <MiniMap />

        <!-- Custom node template -->
        <template #node-eventNode="{ data }">
          <div class="vme-node" :class="[
            { 'vme-node-selected': data.selected, 'vme-node-root': !data.parentId },
            data.execStatus ? `vme-exec-${data.execStatus}` : ''
          ]">
            <div class="vme-node-header">
              <span class="vme-node-type-badge" :class="`vme-type-${data.propertyType || 'attribute'}`">
                {{ data.propertyType === 'relation' ? 'R' : data.propertyType === 'role' ? 'P' : 'A' }}
              </span>
              <span class="vme-node-name">{{ data.label }}</span>
              <span v-if="data.execStatus === 'ok'" class="vme-exec-icon" title="Выполнено">&#x2714;</span>
              <span v-else-if="data.execStatus === 'error'" class="vme-exec-icon vme-exec-icon-err" title="Ошибка">&#x2716;</span>
              <span v-else-if="data.execStatus === 'skipped'" class="vme-exec-icon vme-exec-icon-skip" title="Пропущен">&#x2212;</span>
            </div>
            <div class="vme-node-value" v-if="data.execValue">
              {{ data.execValue }}
            </div>
            <div class="vme-node-constraints" v-if="data.constraintIcons?.length && !data.execValue">
              <span v-for="icon in data.constraintIcons" :key="icon" class="vme-constraint-icon" :title="icon">
                {{ icon === 'required' ? '!' : icon === 'immutable' ? '🔒' : icon === 'unique' ? '🆔' : icon === 'condition' ? '?' : '⚙' }}
              </span>
            </div>
          </div>
        </template>
      </VueFlow>
    </div>

    <!-- Side Panel (constraint editor) -->
    <div class="vme-side-panel" v-if="selectedNode">
      <div class="vme-panel-header">
        <h4>{{ selectedNode.data?.label }}</h4>
        <Button icon="pi pi-times" size="small" text @click="selectedNode = null" />
      </div>
      <div class="vme-panel-body">
        <div class="field">
          <label>Имя</label>
          <InputText v-model="editName" size="small" @change="saveNodeName" />
        </div>
        <div class="field">
          <label>Ограничения (JSON)</label>
          <Textarea v-model="editConstraints" rows="4" autoResize @change="saveConstraints" />
        </div>
        <div class="field">
          <label>Порядок</label>
          <InputNumber v-model="editOrder" size="small" @update:modelValue="saveOrder" />
        </div>
        <Button icon="pi pi-trash" label="Удалить" size="small" severity="danger" @click="deleteNode" class="mt-2" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, inject, onMounted } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'

const props = defineProps({
  modelId: { type: String, default: null },
  undoRedo: { type: Object, default: null },
})

const emit = defineEmits(['node-selected', 'model-cloned'])

const api = inject('eventEngineApi')
const injectedModelId = inject('selectedModelId', ref(null))
const models = ref([])
const currentModelId = ref(props.modelId || injectedModelId.value)
const nodes = ref([])
const edges = ref([])
const selectedNode = ref(null)
const editName = ref('')
const editConstraints = ref('{}')
const editOrder = ref(0)
const modelVersion = ref(null)

// Execution state
const individuals = ref([])
const actors = ref([])
const selectedIndividualId = ref(null)
const selectedActorId = ref(null)
const executing = ref(false)
const executionResults = ref([])
const currentConceptId = ref(null)

async function loadModels() {
  if (!api) return
  try {
    const res = await api.get('/models')
    if (res.data?.success) models.value = res.data.data.filter(m => !m.val.startsWith('__test'))
  } catch (e) { console.error(e) }
}

async function loadIndividuals(conceptId = null) {
  if (!api) return
  try {
    const url = conceptId ? `/individuals?conceptId=${conceptId}` : '/individuals'
    const res = await api.get(url)
    if (res.data?.success) individuals.value = (res.data.data || []).filter(i => !i.val.startsWith('__test'))
  } catch (e) { console.error(e) }
}

async function loadActors() {
  if (!api) return
  try {
    const res = await api.get('/actors')
    if (res.data?.success) actors.value = res.data.data || []
  } catch (e) { console.error(e) }
}

async function onModelSelected() {
  selectedNode.value = null
  selectedIndividualId.value = null
  selectedActorId.value = null

  // Extract concept from the selected model and filter individuals
  const model = models.value.find(m => String(m.id) === String(currentModelId.value))
  const conceptId = model?.reqs?.['Концепт']?.value || null
  currentConceptId.value = conceptId

  await Promise.all([
    loadTree(),
    loadIndividuals(conceptId),
  ])
}

async function loadTree() {
  if (!currentModelId.value || !api) return
  try {
    const res = await api.get(`/models/${currentModelId.value}/tree`)
    const tree = res.data?.data || []

    // Also get model version
    const modelsRes = await api.get('/models')
    const model = (modelsRes.data?.data || []).find(m => String(m.id) === String(currentModelId.value))
    modelVersion.value = model?.reqs?.['Версия']?.value || null

    // Convert tree to VueFlow nodes + edges
    const newNodes = []
    const newEdges = []
    let yOffset = 0

    const processNode = (node, depth = 0, parentId = null) => {
      let constraints = {}
      try { constraints = JSON.parse(node.reqs?.['Ограничения']?.value || '{}') } catch { /**/ }
      const constraintIcons = []
      if (constraints.required) constraintIcons.push('required')
      if (constraints.immutable) constraintIcons.push('immutable')
      if (constraints.unique) constraintIcons.push('unique')
      if (constraints.condition) constraintIcons.push('condition')

      const nodeId = String(node.id)
      newNodes.push({
        id: nodeId,
        type: 'eventNode',
        position: { x: depth * 250, y: yOffset },
        data: {
          label: node.val,
          propertyType: node.reqs?.['Тип свойства']?.value || 'attribute',
          constraintIcons,
          constraints,
          parentId: parentId,
          order: Number(node.reqs?.['Порядок']?.value || 0),
          modelEventId: node.id,
        },
      })
      yOffset += 80

      if (parentId) {
        newEdges.push({
          id: `e-${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          animated: false,
          style: { stroke: '#64748b' },
        })
      }

      for (const child of (node.children || [])) {
        processNode(child, depth + 1, nodeId)
      }
    }

    for (const root of tree) {
      processNode(root)
    }

    nodes.value = newNodes
    edges.value = newEdges
  } catch (err) {
    console.error('[VisualModelEditor] Load error:', err)
  }
}

function onNodeClick({ node }) {
  selectedNode.value = node
  editName.value = node.data?.label || ''
  editConstraints.value = JSON.stringify(node.data?.constraints || {}, null, 2)
  editOrder.value = node.data?.order || 0
  emit('node-selected', node)
}

function onNodeDoubleClick({ node }) {
  // Inline edit name (select text in side panel)
  onNodeClick({ node })
}

function onEdgeClick({ edge }) {
  // Could show edge details
}

async function onConnect({ source, target }) {
  // Create parent-child relationship
  if (!api) return
  try {
    await api.put(`/model-events/${target}`, { 'Родитель': source })
    await loadTree()
  } catch (err) {
    console.error('[VisualModelEditor] Connect error:', err)
  }
}

function onNodesChange(changes) {
  // Handle node position changes (for manual layout)
}

async function saveNodeName() {
  if (!selectedNode.value || !api) return
  const nodeId = selectedNode.value.id
  await api.put(`/model-events/${nodeId}`, { val: editName.value })
  await loadTree()
}

async function saveConstraints() {
  if (!selectedNode.value || !api) return
  try {
    const parsed = JSON.parse(editConstraints.value)
    const nodeId = selectedNode.value.id
    if (props.undoRedo) {
      const cmd = props.undoRedo.updateConstraintCommand(nodeId, selectedNode.value.data?.constraints, parsed)
      await props.undoRedo.executeCommand(cmd)
    } else {
      await api.put(`/model-events/${nodeId}`, { 'Ограничения': JSON.stringify(parsed) })
    }
    await loadTree()
  } catch { /* invalid JSON */ }
}

async function saveOrder() {
  if (!selectedNode.value || !api) return
  await api.put(`/model-events/${selectedNode.value.id}`, { 'Порядок': String(editOrder.value) })
  await loadTree()
}

async function addProperty() {
  if (!currentModelId.value || !api) return
  const name = prompt('Имя свойства:')
  if (!name) return
  if (props.undoRedo) {
    const cmd = props.undoRedo.createModelEventCommand({ name, modelId: currentModelId.value })
    await props.undoRedo.executeCommand(cmd)
  } else {
    await api.post(`/models/${currentModelId.value}/events`, { name })
  }
  await loadTree()
}

async function deleteNode() {
  if (!selectedNode.value || !api) return
  if (!confirm(`Удалить "${selectedNode.value.data?.label}"?`)) return
  await api.delete(`/model-events/${selectedNode.value.id}`)
  selectedNode.value = null
  await loadTree()
}

function autoLayout() {
  // Simple dagre-like layout
  let y = 0
  const layerWidth = 250
  const nodeHeight = 80

  const assignPositions = (nodeList, depth = 0) => {
    for (const n of nodeList) {
      const node = nodes.value.find(nd => nd.id === n.id)
      if (node) {
        node.position = { x: depth * layerWidth, y }
        y += nodeHeight
      }
      const children = edges.value
        .filter(e => e.source === n.id)
        .map(e => nodes.value.find(nd => nd.id === e.target))
        .filter(Boolean)
      if (children.length) assignPositions(children, depth + 1)
    }
  }

  // Find roots (no incoming edges)
  const targets = new Set(edges.value.map(e => e.target))
  const roots = nodes.value.filter(n => !targets.has(n.id))
  assignPositions(roots)
  nodes.value = [...nodes.value] // trigger reactivity
}

function fitView() {
  // VueFlow auto-handles this via ref if needed
}

async function executeModel() {
  if (!currentModelId.value || !selectedIndividualId.value || !api) return
  executing.value = true
  executionResults.value = []
  try {
    // First try to get existing subject events for this individual
    const eventsRes = await api.get(`/individuals/${selectedIndividualId.value}/events`)
    const existingEvents = eventsRes.data?.data || []

    // Map modelEventId → subject event value
    const eventMap = {}
    for (const ev of existingEvents) {
      const meId = ev.reqs?.['Модельное событие']?.value
      if (meId) {
        eventMap[meId] = {
          value: ev.reqs?.['Значение']?.value || ev.val,
          status: ev.reqs?.['Статус']?.value
        }
      }
    }

    // If no events exist, execute the model to create them
    if (existingEvents.length === 0) {
      const execRes = await api.post(`/individuals/${selectedIndividualId.value}/execute`, {
        modelId: currentModelId.value,
        actorId: selectedActorId.value || null,
        values: {}
      })
      const results = execRes.data?.data || []
      for (const r of results) {
        eventMap[r.nodeId] = { value: r.value, status: 'created' }
      }
      executionResults.value = results
    } else {
      executionResults.value = existingEvents
    }

    // Update node visuals
    nodes.value = nodes.value.map(n => {
      const ev = eventMap[n.id]
      return {
        ...n,
        data: {
          ...n.data,
          execStatus: ev ? 'ok' : (Object.keys(eventMap).length > 0 ? 'skipped' : null),
          execValue: ev?.value || null,
        }
      }
    })
  } catch (err) {
    console.error('[VisualModelEditor] Execute error:', err)
    // Mark all nodes as error
    nodes.value = nodes.value.map(n => ({
      ...n,
      data: { ...n.data, execStatus: 'error', execValue: err.response?.data?.error || err.message }
    }))
  } finally {
    executing.value = false
  }
}

function clearExecution() {
  executionResults.value = []
  nodes.value = nodes.value.map(n => ({
    ...n,
    data: { ...n.data, execStatus: null, execValue: null }
  }))
}

async function cloneModel() {
  if (!currentModelId.value || !api) return
  const version = prompt('Версия (например, v2.0):')
  if (!version) return
  try {
    const res = await api.post(`/models/${currentModelId.value}/clone`, { version })
    emit('model-cloned', res.data?.data)
    alert(`Модель клонирована: ${res.data?.data?.name}`)
  } catch (err) {
    alert(`Ошибка: ${err.message}`)
  }
}

watch(() => props.modelId, (val) => {
  if (val) { currentModelId.value = val; loadTree() }
})

onMounted(async () => {
  await Promise.all([loadModels(), loadIndividuals(), loadActors()])
  if (currentModelId.value) loadTree()
})
</script>

<style scoped>
.visual-model-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}
.vme-toolbar {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--surface-border, #e2e8f0);
  align-items: center;
  flex-wrap: wrap;
}
.vme-toolbar-spacer { flex: 1; }
.vme-model-select { width: 280px; }
.vme-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 0; }
.vme-empty p { color: var(--p-text-muted-color); }
.vme-version-badge {
  background: var(--primary-100, #dbeafe);
  color: var(--primary-700, #1d4ed8);
  padding: 0.15rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.vme-canvas {
  flex: 1;
  min-height: 400px;
}
.vme-side-panel {
  position: absolute;
  right: 0;
  top: 48px;
  width: 280px;
  background: var(--surface-card, #fff);
  border-left: 1px solid var(--surface-border, #e2e8f0);
  box-shadow: -2px 0 8px rgba(0,0,0,0.1);
  z-index: 10;
  max-height: calc(100% - 48px);
  overflow-y: auto;
}
.vme-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid var(--surface-border, #e2e8f0);
}
.vme-panel-header h4 { margin: 0; font-size: 0.875rem; }
.vme-panel-body {
  padding: 0.5rem;
}
.vme-panel-body .field {
  margin-bottom: 0.5rem;
}
.vme-panel-body .field label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-color-secondary, #64748b);
  margin-bottom: 0.25rem;
}
/* Node styles */
.vme-node {
  background: var(--surface-card, #fff);
  border: 2px solid var(--surface-border, #cbd5e1);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  min-width: 140px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.vme-node:hover { border-color: var(--primary-400, #60a5fa); }
.vme-node-selected { border-color: var(--primary-500, #3b82f6); box-shadow: 0 0 0 2px rgba(59,130,246,0.3); }
.vme-node-root { border-width: 3px; }
.vme-node-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}
.vme-node-type-badge {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  font-weight: 700;
  color: white;
}
.vme-type-attribute { background: #3b82f6; }
.vme-type-relation { background: #f59e0b; }
.vme-type-role { background: #8b5cf6; }
.vme-node-name {
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}
.vme-node-constraints {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.25rem;
}
.vme-constraint-icon { font-size: 0.7rem; }
/* Execution styles */
.vme-separator { width: 1px; height: 24px; background: var(--surface-border, #e2e8f0); margin: 0 0.25rem; }
.vme-individual-select { width: 200px; }
.vme-actor-select { width: 160px; }
.vme-exec-ok { border-color: #22c55e; background: #f0fdf4; }
.vme-exec-error { border-color: #ef4444; background: #fef2f2; }
.vme-exec-skipped { border-color: #94a3b8; background: #f8fafc; opacity: 0.7; }
.vme-exec-icon { font-size: 0.75rem; color: #22c55e; margin-left: auto; }
.vme-exec-icon-err { color: #ef4444; }
.vme-exec-icon-skip { color: #94a3b8; }
.vme-node-value {
  font-size: 0.7rem;
  color: var(--primary-700, #1d4ed8);
  background: var(--primary-50, #eff6ff);
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  margin-top: 0.25rem;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
