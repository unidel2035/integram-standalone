<template>
  <div class="agent-flow-builder">
    <div class="flow-header">
      <h3><i class="pi pi-sitemap"></i> Visual Agent Builder</h3>
      <div class="header-actions">
        <Button icon="pi pi-undo" severity="secondary" text title="Undo" :disabled="!canUndo" @click="undo" />
        <Button icon="pi pi-refresh" severity="secondary" text title="Reset" @click="resetFlow" />
        <Button icon="pi pi-save" severity="secondary" text title="Save Draft" @click="saveDraft" />
      </div>
    </div>

    <div class="flow-container">
      <!-- Node Palette -->
      <div class="node-palette">
        <h4>Blocks</h4>
        <div
          v-for="nodeType in nodeTypes"
          :key="nodeType.type"
          class="palette-item"
          draggable="true"
          @dragstart="onDragStart($event, nodeType)"
        >
          <span class="node-icon">{{ nodeType.icon }}</span>
          <span class="node-label">{{ nodeType.label }}</span>
        </div>
      </div>

      <!-- Canvas Area -->
      <div
        class="flow-canvas"
        @drop="onDrop"
        @dragover.prevent
        @dragenter.prevent
      >
        <div v-if="nodes.length === 0" class="canvas-placeholder">
          <i class="pi pi-arrow-down"></i>
          <p>Drag blocks here to build your agent flow</p>
        </div>

        <!-- Flow Nodes -->
        <div
          v-for="(node, index) in nodes"
          :key="node.id"
          class="flow-node"
          :class="[`node-${node.type}`, { 'selected': selectedNode === node.id }]"
          :style="{ top: node.y + 'px', left: node.x + 'px' }"
          draggable="true"
          @click="selectNode(node.id)"
          @dragstart="onNodeDragStart($event, node)"
          @dragend="onNodeDragEnd"
        >
          <div class="node-header">
            <span class="node-icon">{{ getNodeIcon(node.type) }}</span>
            <span class="node-title">{{ node.label || getNodeLabel(node.type) }}</span>
            <Button icon="pi pi-times" severity="danger" text rounded size="small" @click.stop="removeNode(node.id)" />
          </div>
          <div class="node-content">
            <template v-if="node.type === 'input'">
              <Dropdown v-model="node.config.inputType" :options="inputTypes" optionLabel="label" optionValue="value" placeholder="Input Type" class="w-full" />
            </template>
            <template v-else-if="node.type === 'llm'">
              <InputText v-model="node.config.promptTemplate" placeholder="Prompt template..." class="w-full" />
            </template>
            <template v-else-if="node.type === 'tool'">
              <Dropdown v-model="node.config.tool" :options="availableTools" optionLabel="label" optionValue="value" placeholder="Select Tool" class="w-full" />
            </template>
            <template v-else-if="node.type === 'condition'">
              <InputText v-model="node.config.condition" placeholder="if condition..." class="w-full" />
            </template>
            <template v-else-if="node.type === 'output'">
              <Dropdown v-model="node.config.format" :options="outputFormats" optionLabel="label" optionValue="value" placeholder="Output Format" class="w-full" />
            </template>
          </div>

          <!-- Connection Points -->
          <div v-if="node.type !== 'output'" class="connection-point output" @click.stop="startConnection(node.id)"></div>
          <div v-if="node.type !== 'input'" class="connection-point input"></div>
        </div>

        <!-- Connection Lines (SVG) -->
        <svg class="connections-layer" :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`">
          <path
            v-for="conn in connections"
            :key="`${conn.from}-${conn.to}`"
            :d="getConnectionPath(conn)"
            class="connection-line"
            :class="{ 'selected': selectedConnection === `${conn.from}-${conn.to}` }"
            @click="selectConnection(conn)"
          />
        </svg>
      </div>

      <!-- Properties Panel -->
      <div class="properties-panel" v-if="selectedNode">
        <h4>Properties</h4>
        <div class="property-group" v-if="selectedNodeData">
          <label>Label</label>
          <InputText v-model="selectedNodeData.label" placeholder="Node label" class="w-full" />
        </div>
        <div class="property-group" v-if="selectedNodeData?.type === 'llm'">
          <label>Model</label>
          <Dropdown
            v-model="selectedNodeData.config.model"
            :options="llmModels"
            optionLabel="label"
            optionValue="value"
            placeholder="Select Model"
            class="w-full"
          />
          <label>Temperature</label>
          <Slider v-model="selectedNodeData.config.temperature" :min="0" :max="1" :step="0.1" class="w-full" />
        </div>
        <Button label="Delete Node" icon="pi pi-trash" severity="danger" outlined class="mt-3" @click="removeNode(selectedNode)" />
      </div>
    </div>

    <!-- Footer Actions -->
    <div class="flow-footer">
      <div class="flow-info">
        <Tag :value="`${nodes.length} blocks`" />
        <Tag :value="`${connections.length} connections`" severity="info" />
      </div>
      <div class="footer-actions">
        <Button label="Preview Schema" icon="pi pi-eye" severity="secondary" outlined @click="previewSchema" />
        <Button label="Generate Agent" icon="pi pi-sparkles" @click="generateAgent" :disabled="nodes.length < 2" />
      </div>
    </div>

    <!-- Schema Preview Dialog -->
    <Dialog v-model:visible="showSchemaPreview" header="Generated SGR Schema" :modal="true" :style="{ width: '600px' }">
      <pre class="schema-preview">{{ generatedSchemaJson }}</pre>
      <template #footer>
        <Button label="Copy" icon="pi pi-copy" @click="copySchema" />
        <Button label="Close" severity="secondary" @click="showSchemaPreview = false" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'

const toast = useToast()

const emit = defineEmits(['generate', 'save'])

// Canvas dimensions
const canvasWidth = ref(800)
const canvasHeight = ref(600)

// Nodes and connections
const nodes = ref([])
const connections = ref([])
const selectedNode = ref(null)
const selectedConnection = ref(null)
const history = ref([])

// UI state
const showSchemaPreview = ref(false)
const generatedSchemaJson = ref('')

// Node types
const nodeTypes = [
  { type: 'input', label: 'Input', icon: '📥', description: 'Receive input data' },
  { type: 'llm', label: 'LLM Call', icon: '🧠', description: 'AI model inference' },
  { type: 'tool', label: 'Tool', icon: '🔧', description: 'Execute external tool' },
  { type: 'condition', label: 'Condition', icon: '🔀', description: 'Conditional branching' },
  { type: 'loop', label: 'Loop', icon: '🔄', description: 'Repeat until condition' },
  { type: 'output', label: 'Output', icon: '📤', description: 'Return result' }
]

// Configuration options
const inputTypes = [
  { label: 'Text', value: 'text' },
  { label: 'File Upload', value: 'file' },
  { label: 'Structured JSON', value: 'json' },
  { label: 'Voice', value: 'voice' }
]

const availableTools = [
  { label: 'Web Search', value: 'web_search' },
  { label: 'Code Execution', value: 'code_execution' },
  { label: 'Integram Database', value: 'integram_mcp' },
  { label: 'Document Parser', value: 'document_parser' },
  { label: 'Data Analysis', value: 'data_analysis' },
  { label: 'Email Sender', value: 'email_sender' }
]

const outputFormats = [
  { label: 'Plain Text', value: 'text' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'JSON', value: 'json' },
  { label: 'HTML', value: 'html' }
]

const llmModels = [
  { label: 'DeepSeek Chat', value: 'deepseek-chat' },
  { label: 'Claude Sonnet', value: 'claude-sonnet-4.5' },
  { label: 'GPT-4o', value: 'gpt-4o' }
]

// Computed
const selectedNodeData = computed(() => {
  return nodes.value.find(n => n.id === selectedNode.value)
})

const canUndo = computed(() => history.value.length > 0)

// Helper functions
function getNodeIcon(type) {
  const nodeType = nodeTypes.find(n => n.type === type)
  return nodeType?.icon || '📦'
}

function getNodeLabel(type) {
  const nodeType = nodeTypes.find(n => n.type === type)
  return nodeType?.label || type
}

function generateNodeId() {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Drag and drop handlers
function onDragStart(event, nodeType) {
  event.dataTransfer.setData('nodeType', JSON.stringify(nodeType))
  event.dataTransfer.effectAllowed = 'copy'
}

function onDrop(event) {
  const nodeTypeData = event.dataTransfer.getData('nodeType')
  if (!nodeTypeData) return

  const nodeType = JSON.parse(nodeTypeData)
  const rect = event.target.getBoundingClientRect()
  const x = event.clientX - rect.left - 75 // Center the node
  const y = event.clientY - rect.top - 25

  saveHistory()

  const newNode = {
    id: generateNodeId(),
    type: nodeType.type,
    label: nodeType.label,
    x: Math.max(0, x),
    y: Math.max(0, y),
    config: getDefaultConfig(nodeType.type)
  }

  nodes.value.push(newNode)
  selectNode(newNode.id)
}

function getDefaultConfig(type) {
  switch (type) {
    case 'input':
      return { inputType: 'text' }
    case 'llm':
      return { model: 'deepseek-chat', promptTemplate: '', temperature: 0.7 }
    case 'tool':
      return { tool: '' }
    case 'condition':
      return { condition: '' }
    case 'loop':
      return { maxIterations: 10, condition: '' }
    case 'output':
      return { format: 'text' }
    default:
      return {}
  }
}

let draggedNode = null
let dragOffset = { x: 0, y: 0 }

function onNodeDragStart(event, node) {
  draggedNode = node
  const rect = event.target.getBoundingClientRect()
  dragOffset = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
  event.dataTransfer.effectAllowed = 'move'
}

function onNodeDragEnd(event) {
  if (!draggedNode) return

  const canvas = document.querySelector('.flow-canvas')
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left - dragOffset.x
  const y = event.clientY - rect.top - dragOffset.y

  draggedNode.x = Math.max(0, Math.min(x, canvasWidth.value - 150))
  draggedNode.y = Math.max(0, Math.min(y, canvasHeight.value - 60))
  draggedNode = null
}

// Node operations
function selectNode(nodeId) {
  selectedNode.value = nodeId
  selectedConnection.value = null
}

function removeNode(nodeId) {
  saveHistory()
  nodes.value = nodes.value.filter(n => n.id !== nodeId)
  connections.value = connections.value.filter(c => c.from !== nodeId && c.to !== nodeId)
  if (selectedNode.value === nodeId) {
    selectedNode.value = null
  }
}

// Connection handling
let connectionSource = null

function startConnection(nodeId) {
  connectionSource = nodeId
}

function endConnection(nodeId) {
  if (connectionSource && connectionSource !== nodeId) {
    // Check if connection already exists
    const exists = connections.value.some(c => c.from === connectionSource && c.to === nodeId)
    if (!exists) {
      saveHistory()
      connections.value.push({
        from: connectionSource,
        to: nodeId
      })
    }
  }
  connectionSource = null
}

function selectConnection(conn) {
  selectedConnection.value = `${conn.from}-${conn.to}`
  selectedNode.value = null
}

function getConnectionPath(conn) {
  const fromNode = nodes.value.find(n => n.id === conn.from)
  const toNode = nodes.value.find(n => n.id === conn.to)
  if (!fromNode || !toNode) return ''

  const startX = fromNode.x + 75
  const startY = fromNode.y + 60
  const endX = toNode.x + 75
  const endY = toNode.y

  // Bezier curve
  const midY = (startY + endY) / 2
  return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`
}

// History management
function saveHistory() {
  history.value.push({
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    connections: JSON.parse(JSON.stringify(connections.value))
  })
  if (history.value.length > 20) {
    history.value.shift()
  }
}

function undo() {
  if (history.value.length > 0) {
    const prev = history.value.pop()
    nodes.value = prev.nodes
    connections.value = prev.connections
  }
}

function resetFlow() {
  saveHistory()
  nodes.value = []
  connections.value = []
  selectedNode.value = null
}

// Schema generation
function generateSchema() {
  const steps = nodes.value.map((node, index) => ({
    id: node.id,
    type: node.type,
    label: node.label,
    config: node.config,
    order: index
  }))

  // Determine schema type based on node types
  let schemaType = 'cascade'
  if (nodes.value.some(n => n.type === 'condition')) {
    schemaType = 'routing'
  } else if (nodes.value.some(n => n.type === 'loop')) {
    schemaType = 'cycle'
  }

  return {
    name: 'flow_generated_schema',
    version: '1.0',
    type: schemaType,
    steps,
    connections: connections.value,
    createdAt: new Date().toISOString()
  }
}

function previewSchema() {
  const schema = generateSchema()
  generatedSchemaJson.value = JSON.stringify(schema, null, 2)
  showSchemaPreview.value = true
}

function copySchema() {
  navigator.clipboard.writeText(generatedSchemaJson.value)
  toast.add({
    severity: 'success',
    summary: 'Copied',
    detail: 'Schema copied to clipboard',
    life: 2000
  })
}

function generateAgent() {
  const schema = generateSchema()
  emit('generate', {
    schema,
    nodes: nodes.value,
    connections: connections.value
  })
}

function saveDraft() {
  const draft = {
    nodes: nodes.value,
    connections: connections.value,
    savedAt: new Date().toISOString()
  }
  localStorage.setItem('agentFlowDraft', JSON.stringify(draft))
  emit('save', draft)
  toast.add({
    severity: 'success',
    summary: 'Draft Saved',
    detail: 'Your flow has been saved locally',
    life: 2000
  })
}
</script>

<style scoped>
.agent-flow-builder {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-ground);
}

.flow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
}

.flow-header h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.flow-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Node Palette */
.node-palette {
  width: 180px;
  padding: 1rem;
  background: var(--surface-card);
  border-right: 1px solid var(--surface-border);
  overflow-y: auto;
}

.node-palette h4 {
  margin: 0 0 1rem 0;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
  text-transform: uppercase;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  cursor: grab;
  transition: all 0.2s;
}

.palette-item:hover {
  border-color: var(--primary-color);
  background: var(--surface-hover);
}

.palette-item:active {
  cursor: grabbing;
}

.node-icon {
  font-size: 1.25rem;
}

.node-label {
  font-size: 0.875rem;
}

/* Canvas */
.flow-canvas {
  flex: 1;
  position: relative;
  background: var(--surface-ground);
  background-image: radial-gradient(circle, var(--surface-border) 1px, transparent 1px);
  background-size: 20px 20px;
  overflow: hidden;
}

.canvas-placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--text-color-secondary);
}

.canvas-placeholder i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

/* Flow Nodes */
.flow-node {
  position: absolute;
  min-width: 150px;
  background: var(--surface-card);
  border: 2px solid var(--surface-border);
  border-radius: 8px;
  cursor: move;
  transition: box-shadow 0.2s;
  z-index: 10;
}

.flow-node:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.flow-node.selected {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.2);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--surface-ground);
  border-radius: 6px 6px 0 0;
}

.node-title {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 600;
}

.node-content {
  padding: 0.5rem;
}

/* Node type colors */
.node-input .node-header { background: rgba(76, 175, 80, 0.15); }
.node-llm .node-header { background: rgba(156, 39, 176, 0.15); }
.node-tool .node-header { background: rgba(255, 152, 0, 0.15); }
.node-condition .node-header { background: rgba(33, 150, 243, 0.15); }
.node-loop .node-header { background: rgba(0, 188, 212, 0.15); }
.node-output .node-header { background: rgba(244, 67, 54, 0.15); }

/* Connection Points */
.connection-point {
  position: absolute;
  width: 12px;
  height: 12px;
  background: var(--primary-color);
  border: 2px solid white;
  border-radius: 50%;
  cursor: crosshair;
  z-index: 20;
}

.connection-point.input {
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
}

.connection-point.output {
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
}

/* Connections SVG */
.connections-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.connection-line {
  fill: none;
  stroke: var(--primary-color);
  stroke-width: 2;
  pointer-events: stroke;
  cursor: pointer;
}

.connection-line.selected {
  stroke: var(--red-500);
  stroke-width: 3;
}

/* Properties Panel */
.properties-panel {
  width: 250px;
  padding: 1rem;
  background: var(--surface-card);
  border-left: 1px solid var(--surface-border);
  overflow-y: auto;
}

.properties-panel h4 {
  margin: 0 0 1rem 0;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
  text-transform: uppercase;
}

.property-group {
  margin-bottom: 1rem;
}

.property-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

/* Footer */
.flow-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--surface-card);
  border-top: 1px solid var(--surface-border);
}

.flow-info {
  display: flex;
  gap: 0.5rem;
}

.footer-actions {
  display: flex;
  gap: 0.5rem;
}

/* Schema Preview */
.schema-preview {
  background: var(--surface-ground);
  padding: 1rem;
  border-radius: 8px;
  font-family: monospace;
  font-size: 0.875rem;
  max-height: 400px;
  overflow: auto;
}
</style>
