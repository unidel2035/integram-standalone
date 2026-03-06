<template>
  <Dialog
    :visible="visible"
    :header="`${$t('workflow.settings')}: ${agent?.name || $t('workflow.agent')}`"
    :modal="true"
    :closable="true"
    :draggable="false"
    :style="{ width: '95vw', height: '90vh' }"
    class="agent-workflow-modal"
    @hide="onClose"
  >
    <div class="workflow-editor-container">
      <!-- Toolbar -->
      <Toolbar class="workflow-toolbar">
        <template #start>
          <div class="toolbar-info">
            <span class="agent-icon">{{ agent?.icon }}</span>
            <div class="agent-info">
              <h3 class="agent-name">{{ agent?.name }}</h3>
              <span class="workflow-status">
                <Tag :value="workflowStatus" :severity="getStatusSeverity(workflowStatus)" />
              </span>
            </div>
          </div>
        </template>
        <template #center>
          <Button
            :label="isDrawingFrame ? $t('workflow.cancelFrame') : $t('workflow.createFrame')"
            icon="pi pi-table"
            :outlined="!isDrawingFrame"
            :severity="isDrawingFrame ? 'danger' : 'secondary'"
            @click="toggleFrameDrawingMode"
            class="mr-2"
          />
          <Button
            :label="$t('workflow.group')"
            icon="pi pi-objects-column"
            outlined
            @click="groupSelectedNodesIntoFrame"
            :disabled="selectedNodeIds.length < 1"
            class="mr-2"
          />
        </template>
        <template #end>
          <Button :label="$t('workflow.autoLayout')" icon="pi pi-sitemap" outlined @click="autoLayout" class="mr-2" />
          <Button :label="$t('workflow.validate')" icon="pi pi-check" outlined @click="validate" class="mr-2" />
          <Button :label="$t('workflow.save')" icon="pi pi-save" severity="success" @click="saveWorkflow" />
        </template>
      </Toolbar>

      <!-- Main workflow builder layout -->
      <div class="builder-layout">
        <!-- Node Palette (n8n style) -->
        <div class="node-palette n8n-style">
          <div class="palette-header">
            <h3>{{ $t('workflow.nodes') }}</h3>
            <InputText
              v-model="searchNodeQuery"
              :placeholder="$t('workflow.searchNodes')"
              class="p-inputtext-sm"
            >
              <template #prefix>
                <i class="pi pi-search" />
              </template>
            </InputText>
          </div>
          <div class="palette-content">
            <div v-for="category in filteredNodeCategories" :key="category.name" class="node-category">
              <div class="category-header" @click="toggleCategory(category.name)">
                <i :class="categoryExpanded[category.name] ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
                <span>{{ category.name }}</span>
                <span class="category-count">({{ category.types.length }})</span>
              </div>
              <transition name="category-expand">
                <div v-if="categoryExpanded[category.name]" class="category-nodes">
                  <div
                    v-for="nodeType in category.types"
                    :key="nodeType.type"
                    class="node-type-item"
                    @click="addWorkflowNode(nodeType.type)"
                    draggable="true"
                    @dragstart="onDragStart($event, nodeType.type)"
                  >
                    <div class="node-icon-wrapper">
                      <i :class="nodeType.icon"></i>
                    </div>
                    <div class="node-info">
                      <span class="node-label">{{ nodeType.label }}</span>
                      <span class="node-description">{{ nodeType.description }}</span>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </div>

        <!-- Canvas Area -->
        <div
          class="canvas-area n8n-canvas"
          :class="{ 'drawing-frame': isDrawingFrame }"
          @drop="onDrop"
          @dragover.prevent
          @mousedown="onCanvasMouseDown"
          @mousemove="onCanvasMouseMove"
          @mouseup="onCanvasMouseUp"
        >
          <VueFlow
            v-model="elements"
            :node-types="nodeComponentTypes"
            @node-click="onNodeClick"
            @connect="onConnect"
            @nodes-change="onNodesChange"
            @selection-change="onSelectionChange"
            :fit-view-on-init="true"
            :min-zoom="0.1"
            :max-zoom="4"
          >
            <Background pattern-color="#e0e0e0" :gap="20" />
            <Controls />
            <MiniMap node-color="#6366f1" mask-color="rgba(0,0,0,0.1)" />
          </VueFlow>

          <!-- Frame drawing preview -->
          <div
            v-if="frameDrawing.isDrawing"
            class="frame-preview"
            :style="framePreviewStyle"
          />

          <!-- Empty state -->
          <div v-if="nodeCount === 0" class="empty-state">
            <i class="pi pi-sitemap empty-icon"></i>
            <h3>{{ $t('workflow.startCreating') }}</h3>
            <p>Перетащите узлы из палитры слева или кликните на них</p>
          </div>
        </div>

        <!-- Properties Panel -->
        <div class="properties-panel n8n-properties">
          <WorkflowPropertiesPanel
            :workflow-name="workflowName"
            :workflow-description="workflowDescription"
            :workflow-version="workflowVersion"
            :node-count="nodeCount"
            :edge-count="edgeCount"
            :validation-errors="validationErrors"
            @update:workflow-name="workflowName = $event"
            @update:workflow-description="workflowDescription = $event"
            @export-workflow="exportWorkflow"
            @import-workflow="importWorkflow"
            @save-workflow="saveWorkflow"
            @clear-canvas="clearCanvas"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer">
        <div class="footer-info">
          <span class="node-count">Узлов: {{ nodeCount }}</span>
          <span class="edge-count">Связей: {{ edgeCount }}</span>
        </div>
        <div class="footer-actions">
          <Button :label="$t('common.cancel')" icon="pi pi-times" @click="visible = false" text />
          <Button :label="$t('workflow.applyAndSave')" icon="pi pi-check" @click="applyAndSave" severity="success" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'

import { useToast } from 'primevue/usetoast'
import { useWorkflowBuilder } from '@/composables/useWorkflowBuilder'
import { useAgentWorkflowStore } from '@/stores/agentWorkflowStore'
import { getWorkflowTemplate } from '@/utils/workflowTemplates'
import WorkflowPropertiesPanel from '@/components/agents/panels/WorkflowPropertiesPanel.vue'
import StartNode from '@/components/workflow/nodes/StartNode.vue'
import EndNode from '@/components/workflow/nodes/EndNode.vue'
import DataSourceNode from '@/components/workflow/nodes/DataSourceNode.vue'
import FilterNode from '@/components/workflow/nodes/FilterNode.vue'
import AgentNode from '@/components/workflow/nodes/AgentNode.vue'
import OutputNode from '@/components/workflow/nodes/OutputNode.vue'
import FrameNode from '@/components/workflow/nodes/FrameNode.vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  agent: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'save'])

const { t } = useI18n()
const toast = useToast()

// Lazy initialization of store to avoid "no active Pinia" error
// Store will be initialized on first access via getterconst agentWorkflowStore = useAgentWorkflowStore()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Workflow builder composable
const {
  nodes,
  edges,
  selectedNode,
  validationErrors,
  nodeTypes,
  nodeCount,
  edgeCount,
  addWorkflowNode,
  connectNodes,
  updateNodePosition,
  validateWorkflow,
  exportWorkflow: exportWorkflowConfig,
  importWorkflow: importWorkflowConfig,
  clearCanvas,
  autoLayout,
  createFrame,
  groupIntoFrame,
  updateFrameTitle,
  updateFrameColor,
  updateFrameSize
} = useWorkflowBuilder()

// Node component mapping
const nodeComponentTypes = {
  StartNode,
  EndNode,
  DataSourceNode,
  FilterNode,
  AgentNode,
  OutputNode,
  FrameNode
}

// Workflow metadata
const workflowName = ref('')
const workflowDescription = ref('')
const workflowVersion = ref(1)
const workflowStatus = ref('draft')

// Search and filtering
const searchNodeQuery = ref('')
const categoryExpanded = reactive({
  'Control': true,
  'Data': true,
  'Transform': false,
  'Agent': false,
  'Output': false
})

// Categorize nodes for palette
const nodeCategories = computed(() => {
  const categories = {}
  nodeTypes.forEach(type => {
    const categoryName = type.category.charAt(0).toUpperCase() + type.category.slice(1)
    if (!categories[categoryName]) {
      categories[categoryName] = {
        name: categoryName,
        types: []
      }
    }
    categories[categoryName].types.push(type)
  })
  return Object.values(categories)
})

// Filtered node categories based on search
const filteredNodeCategories = computed(() => {
  if (!searchNodeQuery.value) return nodeCategories.value

  const query = searchNodeQuery.value.toLowerCase()
  return nodeCategories.value
    .map(category => ({
      ...category,
      types: category.types.filter(type =>
        type.label.toLowerCase().includes(query) ||
        type.description.toLowerCase().includes(query)
      )
    }))
    .filter(category => category.types.length > 0)
})

// VueFlow elements
const elements = computed({
  get: () => [
    ...nodes.value.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      label: node.label
    })),
    ...edges.value
  ],
  set: (newElements) => {
    nodes.value = newElements.filter(el => !el.source)
    edges.value = newElements.filter(el => el.source)
  }
})

// Drag and drop
const draggedType = ref(null)

const onDragStart = (event, type) => {
  draggedType.value = type
  event.dataTransfer.effectAllowed = 'move'
}

const onDrop = (event) => {
  if (!draggedType.value) return

  const vueFlowBounds = event.currentTarget.getBoundingClientRect()
  const position = {
    x: event.clientX - vueFlowBounds.left - 80,
    y: event.clientY - vueFlowBounds.top - 40
  }

  addWorkflowNode(draggedType.value, position)
  draggedType.value = null
}

const onNodeClick = (event) => {
  selectedNode.value = nodes.value.find(n => n.id === event.node.id)
}

const onConnect = (params) => {
  connectNodes(params.source, params.target)
}

const onNodesChange = (changes) => {
  changes.forEach(change => {
    if (change.type === 'position' && change.position) {
      updateNodePosition(change.id, change.position)
    }
  })
}

// Frame drawing state
const isDrawingFrame = ref(false)
const frameDrawing = ref({
  isDrawing: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0
})
const selectedNodeIds = ref([])

// Frame preview style
const framePreviewStyle = computed(() => {
  if (!frameDrawing.value.isDrawing) return {}

  const x = Math.min(frameDrawing.value.startX, frameDrawing.value.currentX)
  const y = Math.min(frameDrawing.value.startY, frameDrawing.value.currentY)
  const width = Math.abs(frameDrawing.value.currentX - frameDrawing.value.startX)
  const height = Math.abs(frameDrawing.value.currentY - frameDrawing.value.startY)

  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`
  }
})

// Toggle frame drawing mode
const toggleFrameDrawingMode = () => {
  isDrawingFrame.value = !isDrawingFrame.value
  if (!isDrawingFrame.value) {
    frameDrawing.value.isDrawing = false
  }
}

// Canvas mouse handlers for frame drawing
const onCanvasMouseDown = (event) => {
  if (!isDrawingFrame.value) return
  if (event.target.closest('.vue-flow__node')) return

  const canvasRect = event.currentTarget.getBoundingClientRect()
  frameDrawing.value = {
    isDrawing: true,
    startX: event.clientX - canvasRect.left,
    startY: event.clientY - canvasRect.top,
    currentX: event.clientX - canvasRect.left,
    currentY: event.clientY - canvasRect.top
  }
}

const onCanvasMouseMove = (event) => {
  if (!frameDrawing.value.isDrawing) return

  const canvasRect = event.currentTarget.getBoundingClientRect()
  frameDrawing.value.currentX = event.clientX - canvasRect.left
  frameDrawing.value.currentY = event.clientY - canvasRect.top
}

const onCanvasMouseUp = (event) => {
  if (!frameDrawing.value.isDrawing) return

  const width = Math.abs(frameDrawing.value.currentX - frameDrawing.value.startX)
  const height = Math.abs(frameDrawing.value.currentY - frameDrawing.value.startY)

  if (width > 50 && height > 50) {
    const startPos = {
      x: Math.min(frameDrawing.value.startX, frameDrawing.value.currentX),
      y: Math.min(frameDrawing.value.startY, frameDrawing.value.currentY)
    }
    const endPos = {
      x: Math.max(frameDrawing.value.startX, frameDrawing.value.currentX),
      y: Math.max(frameDrawing.value.startY, frameDrawing.value.currentY)
    }

    createFrame(startPos, endPos)
    toast.add({ severity: 'success', summary: 'Рамка создана', life: 2000 })
  }

  frameDrawing.value.isDrawing = false
  isDrawingFrame.value = false
}

// Selection change handler
const onSelectionChange = (params) => {
  selectedNodeIds.value = params.nodes.map(n => n.id)
}

// Group selected nodes into frame
const groupSelectedNodesIntoFrame = () => {
  if (selectedNodeIds.value.length === 0) {
    toast.add({ severity: 'warn', summary: 'Не выбрано узлов', detail: 'Выберите узлы для группировки', life: 3000 })
    return
  }

  const frame = groupIntoFrame(selectedNodeIds.value)
  if (frame) {
    toast.add({ severity: 'success', summary: 'Сгруппировано', detail: `${selectedNodeIds.value.length} узлов сгруппированы в рамку`, life: 3000 })
    selectedNodeIds.value = []
  }
}

// Category toggle
const toggleCategory = (categoryName) => {
  categoryExpanded[categoryName] = !categoryExpanded[categoryName]
}

// Status severity
const getStatusSeverity = (status) => {
  const severityMap = {
    'draft': 'warning',
    'active': 'success',
    'error': 'danger',
    'disabled': 'secondary'
  }
  return severityMap[status] || 'info'
}

// Validate workflow
const validate = () => {
  const isValid = validateWorkflow()
  if (isValid) {
    toast.add({ severity: 'success', summary: 'Валидация успешна', detail: 'Воркфлоу корректен', life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: t('workflow.validationErrors'), detail: t('workflow.fixErrors'), life: 3000 })
  }
}

// Export workflow
const exportWorkflow = () => {
  const config = exportWorkflowConfig()
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.agent.id}-workflow-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ severity: 'success', summary: 'Экспортировано', detail: 'Воркфлоу сохранён в файл', life: 3000 })
}

// Import workflow
const importWorkflow = (config) => {
  importWorkflowConfig(config)
  toast.add({ severity: 'success', summary: 'Импортировано', detail: 'Воркфлоу загружен', life: 3000 })
}

// Save workflow
const saveWorkflow = async () => {
  if (!validateWorkflow()) {
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Исправьте ошибки перед сохранением', life: 3000 })
    return
  }

  try {
    const workflowConfig = {
      nodes: nodes.value,
      edges: edges.value,
      name: workflowName.value || `${props.agent.name} Workflow`,
      description: workflowDescription.value || `Workflow for ${props.agent.name}`,
      version: workflowVersion.value
    }

    await agentWorkflowStore.saveAgentWorkflow(props.agent.id, workflowConfig)
    workflowStatus.value = 'active'
    toast.add({ severity: 'success', summary: t('workflow.saved'), detail: t('workflow.saveSuccess'), life: 3000 })
  } catch (error) {
    console.error('Error saving workflow:', error)
    toast.add({ severity: 'error', summary: 'Ошибка', detail: error.message, life: 3000 })
  }
}

// Apply and save
const applyAndSave = async () => {
  await saveWorkflow()
  if (workflowStatus.value === 'active') {
    emit('save', {
      nodes: nodes.value,
      edges: edges.value,
      name: workflowName.value,
      description: workflowDescription.value
    })
    visible.value = false
  }
}

// Close handler
const onClose = () => {
  // Optionally prompt to save if there are unsaved changes
}

// Load agent workflow on mount
watch(() => props.agent, async (agent) => {
  if (agent && agent.id) {
    const savedWorkflow = await agentWorkflowStore.getAgentWorkflow(agent.id)
    if (savedWorkflow) {
      // Load saved workflow
      nodes.value = savedWorkflow.nodes || []
      edges.value = savedWorkflow.edges || []
      workflowName.value = savedWorkflow.name || `${agent.name} Workflow`
      workflowDescription.value = savedWorkflow.description || ''
      workflowVersion.value = savedWorkflow.version || 1
      workflowStatus.value = savedWorkflow.status || 'draft'
    } else {
      // Load template workflow or create default
      const template = getWorkflowTemplate(agent.id)
      if (template) {
        nodes.value = template.nodes || []
        edges.value = template.edges || []
        workflowName.value = template.name || `${agent.name} Workflow`
        workflowDescription.value = template.description || `Internal workflow for ${agent.name} agent`
      } else {
        // Initialize with empty workflow
        nodes.value = []
        edges.value = []
        workflowName.value = `${agent.name} Workflow`
        workflowDescription.value = `Internal workflow for ${agent.name} agent`
      }
      workflowStatus.value = 'draft'
    }
  }
}, { immediate: true })
</script>

<style scoped lang="scss">
.agent-workflow-modal {
  :deep(.p-dialog-content) {
    padding: 0;
    overflow: hidden;
  }

  :deep(.p-dialog-footer) {
    padding: 1rem 1.5rem;
  }
}

.workflow-editor-container {
  display: flex;
  flex-direction: column;
  height: calc(90vh - 120px);
  background: var(--surface-ground);
}

.workflow-toolbar {
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;

  .toolbar-info {
    display: flex;
    align-items: center;
    gap: 1rem;

    .agent-icon {
      font-size: 2rem;
    }

    .agent-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      .agent-name {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
      }
    }
  }
}

.builder-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* n8n-style Node Palette */
.node-palette.n8n-style {
  width: 300px;
  border-right: 1px solid var(--surface-border);
  background: var(--surface-card);
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
}

.palette-header {
  padding: 1.25rem;
  border-bottom: 1px solid var(--surface-border);

  h3 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-color);
  }
}

.palette-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.node-category {
  margin-bottom: 0.5rem;

  .category-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-color-secondary);
    padding: 0.75rem;
    margin-bottom: 0.25rem;
    cursor: pointer;
    user-select: none;
    border-radius: var(--content-border-radius);
    transition: all 0.2s ease;

    &:hover {
      background: var(--surface-hover);
      color: var(--primary-color);
    }

    i {
      font-size: 0.7rem;
    }

    .category-count {
      margin-left: auto;
      font-size: 0.75rem;
      opacity: 0.7;
    }
  }

  .category-nodes {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-left: 0.5rem;
  }

  .node-type-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--surface-ground);
    border: 1px solid var(--surface-border);
    border-radius: var(--content-border-radius);
    cursor: move;
    font-size: 0.875rem;
    transition: all 0.2s ease;

    &:hover {
      background: var(--primary-50);
      border-color: var(--primary-color);
      transform: translateX(4px);
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
    }

    .node-icon-wrapper {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--primary-color), var(--primary-600));
      color: white;
      border-radius: 6px;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);

      i {
        font-size: 1rem;
      }
    }

    .node-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      flex: 1;
      min-width: 0;

      .node-label {
        font-weight: 600;
        color: var(--text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .node-description {
        font-size: 0.75rem;
        color: var(--text-color-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
}

/* Category expand animation */
.category-expand-enter-active,
.category-expand-leave-active {
  transition: all 0.3s ease;
}

.category-expand-enter-from,
.category-expand-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}

.category-expand-enter-to,
.category-expand-leave-from {
  opacity: 1;
  max-height: 1000px;
}

/* n8n-style Canvas */
.canvas-area.n8n-canvas {
  flex: 1;
  position: relative;
  background: #f5f5f5;

  &.drawing-frame {
    cursor: crosshair;
  }
}

.frame-preview {
  position: absolute;
  border: 2px dashed var(--primary-color);
  background: rgba(99, 102, 241, 0.1);
  pointer-events: none;
  z-index: 1000;
  border-radius: 8px;
}

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--text-color-secondary);
  pointer-events: none;

  .empty-icon {
    font-size: 4rem;
    opacity: 0.3;
    margin-bottom: 1rem;
  }

  h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    opacity: 0.7;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.6;
  }
}

/* n8n-style Properties Panel */
.properties-panel.n8n-properties {
  width: 350px;
  border-left: 1px solid var(--surface-border);
  background: var(--surface-card);
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.05);
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .footer-info {
    display: flex;
    gap: 1rem;
    color: var(--text-color-secondary);
    font-size: 0.875rem;

    span {
      &.node-count,
      &.edge-count {
        font-weight: 500;
      }
    }
  }

  .footer-actions {
    display: flex;
    gap: 0.5rem;
  }
}
</style>
