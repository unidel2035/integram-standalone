<template>
  <div class="interactive-workflow-builder">
    <!-- Agent Palette -->
    <div class="agent-palette">
      <div class="palette-header">
        <h3>Агенты</h3>
        <i class="pi pi-info-circle" title="'Перетащи агентов на рабочую область'"></i>
      </div>
      <div class="palette-content">
        <div
          v-for="agent in availableAgents"
          :key="agent.type"
          class="agent-item"
          :data-agent="agent.type"
          draggable="true"
          @dragstart="onDragStart($event, agent)"
          @dragend="onDragEnd"
          :class="{ 'disabled': !canAddAgent(agent.type) }"
        >
          <div class="agent-icon" :style="{ background: agent.color }">
            <i :class="'pi ' + agent.icon"></i>
          </div>
          <div class="agent-info">
            <div class="agent-label">{{ agent.label }}</div>
            <div class="agent-description">{{ agent.description }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Workspace -->
    <div
      class="workspace"
      @drop="onDrop"
      @dragover.prevent
      @dragenter.prevent
    >
      <div class="workspace-header control-buttons">
        <Button
          label="Очистить"
          icon="pi pi-trash"
          outlined
          size="small"
          @click="clearWorkspace"
          :disabled="nodes.length === 0"
        />
        <Button
          class="run-button"
          label="Запустить"
          icon="pi pi-play"
          severity="success"
          size="small"
          @click="$emit('execute')"
          :disabled="!canExecute"
          :loading="isExecuting"
        />
      </div>

      <!-- Canvas with nodes and connections -->
      <div class="canvas" ref="canvasRef">
        <svg class="connections-layer" ref="svgRef">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#3B82F6" />
            </marker>
          </defs>
          <path
            v-for="edge in edges"
            :key="edge.id"
            :d="edge.path"
            stroke="#3B82F6"
            stroke-width="2"
            fill="none"
            marker-end="url(#arrowhead)"
            :class="{ 'animated-edge': edge.animated, 'executing': edge.executing }"
          />
          <!-- Temporary connection line while dragging -->
          <path
            v-if="tempConnection"
            :d="tempConnection.path"
            stroke="#3B82F6"
            stroke-width="2"
            stroke-dasharray="5,5"
            fill="none"
          />
        </svg>

        <!-- Nodes -->
        <div
          v-for="node in nodes"
          :key="node.id"
          class="workflow-node"
          :data-type="node.type"
          :data-node-id="node.id"
          :style="{
            left: node.position.x + 'px',
            top: node.position.y + 'px'
          }"
          :class="{
            'selected': selectedNode?.id === node.id,
            'executing': executingNode === node.id
          }"
          @click="selectNode(node)"
        >
          <div class="node-header" :style="{ background: node.data.color }">
            <i :class="'pi ' + node.data.icon"></i>
            <span>{{ node.label }}</span>
          </div>
          <div class="node-body">
            <div class="node-status">
              <i class="pi pi-circle-fill" :class="getNodeStatusClass(node)"></i>
            </div>
          </div>
          <!-- Connection handles -->
          <div
            class="handle handle-left"
            @mouseenter="handleHoverStart(node, 'left')"
            @mouseleave="handleHoverEnd"
          ></div>
          <div
            class="handle handle-right"
            @mousedown="startConnection(node)"
            @mouseenter="handleHoverStart(node, 'right')"
            @mouseleave="handleHoverEnd"
          ></div>
        </div>

        <!-- Empty state -->
        <div v-if="nodes.length === 0" class="empty-state">
          <i class="pi pi-sitemap"></i>
          <p>Перетащи агентов сюда, чтобы начать</p>
        </div>
      </div>
    </div>

    <!-- Properties Panel -->
    <div class="properties-panel">
      <div class="panel-header">
        <h3>{{ selectedNode ? 'Настройки агента' : 'Свойства' }}</h3>
      </div>
      <div class="panel-content">
        <div v-if="selectedNode" class="node-properties">
          <div class="property-group">
            <label>Название</label>
            <InputText v-model="selectedNode.label" class="w-full" />
          </div>

          <div class="property-group">
            <label>Тип</label>
            <div class="property-value">{{ selectedNode.type }}</div>
          </div>

          <!-- Custom properties based on node type -->
          <div v-if="selectedNode.type === 'TableAnalyzerAgent'" class="property-group">
            <label>Таблица</label>
            <Select
              v-model="selectedNode.data.tableName"
              :options="['Продажи 2024', 'Клиенты', 'Заказы']"
              placeholder="Выбери таблицу"
              class="w-full"
            />
          </div>

          <div v-if="selectedNode.type === 'TableAnalyzerAgent'" class="property-group">
            <label>Тип анализа</label>
            <Select
              v-model="selectedNode.data.analysisType"
              :options="['Статистический', 'Детальный', 'Быстрый']"
              placeholder="Выбери тип"
              class="w-full"
            />
          </div>

          <div v-if="selectedNode.type === 'ReportGeneratorAgent'" class="property-group">
            <label>Формат отчёта</label>
            <Select
              v-model="selectedNode.data.format"
              :options="['PDF', 'Excel', 'HTML']"
              placeholder="Выбери формат"
              class="w-full"
            />
          </div>

          <div v-if="selectedNode.type === 'ReportGeneratorAgent'" class="property-group">
            <label>Включить графики</label>
            <Checkbox v-model="selectedNode.data.includeCharts" binary />
          </div>

          <Button
            label="Удалить агент"
            icon="pi pi-trash"
            severity="danger"
            outlined
            class="w-full mt-3"
            @click="deleteNode(selectedNode.id)"
          />
        </div>

        <div v-else class="no-selection">
          <i class="pi pi-hand-pointer"></i>
          <p>Выбери агент для настройки</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'

const props = defineProps({
  availableAgents: {
    type: Array,
    required: true
  },
  isExecuting: {
    type: Boolean,
    default: false
  },
  executingNode: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['node-added', 'node-removed', 'nodes-connected', 'node-selected', 'execute'])

const nodes = ref([])
const edges = ref([])
const selectedNode = ref(null)
const canvasRef = ref(null)
const svgRef = ref(null)

// Drag and drop
const draggedAgent = ref(null)
const onDragStart = (event, agent) => {
  draggedAgent.value = agent
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', agent.type)
}

const onDragEnd = () => {
  draggedAgent.value = null
}

const canAddAgent = (agentType) => {
  // For tutorial, we can check if agent is already added in certain steps
  return true
}

const onDrop = (event) => {
  if (!draggedAgent.value) return

  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left - 75 // half node width
  const y = event.clientY - rect.top - 40 // approximate center

  addNode(draggedAgent.value, { x, y })
  draggedAgent.value = null
}

const addNode = (agent, position) => {
  const node = {
    id: `node-${Date.now()}`,
    type: agent.type,
    label: agent.label,
    position,
    data: {
      ...agent,
      tableName: agent.type === 'TableAnalyzerAgent' ? 'Продажи 2024' : undefined,
      analysisType: agent.type === 'TableAnalyzerAgent' ? 'Статистический' : undefined,
      format: agent.type === 'ReportGeneratorAgent' ? 'PDF' : undefined,
      includeCharts: agent.type === 'ReportGeneratorAgent' ? true : undefined
    }
  }

  nodes.value.push(node)
  emit('node-added', node)

  nextTick(() => {
    updateConnections()
  })
}

const deleteNode = (nodeId) => {
  nodes.value = nodes.value.filter(n => n.id !== nodeId)
  edges.value = edges.value.filter(e => e.source !== nodeId && e.target !== nodeId)
  selectedNode.value = null
  emit('node-removed', nodeId)
  updateConnections()
}

const selectNode = (node) => {
  selectedNode.value = node
  emit('node-selected', node)
}

const clearWorkspace = () => {
  if (confirm('Очистить рабочую область?')) {
    nodes.value = []
    edges.value = []
    selectedNode.value = null
  }
}

// Connection logic
const connectingFrom = ref(null)
const tempConnection = ref(null)

const startConnection = (node) => {
  connectingFrom.value = node

  const handleMouseMove = (e) => {
    if (!connectingFrom.value) return

    const canvas = canvasRef.value
    const rect = canvas.getBoundingClientRect()
    const sourceNode = connectingFrom.value
    const sourcePos = {
      x: sourceNode.position.x + 150, // right handle position
      y: sourceNode.position.y + 40
    }
    const targetPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }

    tempConnection.value = {
      path: createPath(sourcePos, targetPos)
    }
  }

  const handleMouseUp = (e) => {
    // Find if we're over a node
    const targetElement = document.elementFromPoint(e.clientX, e.clientY)
    const nodeElement = targetElement?.closest('.workflow-node')

    if (nodeElement && connectingFrom.value) {
      const targetNodeId = nodeElement.getAttribute('data-node-id')
      const targetNode = nodes.value.find(n => n.id === targetNodeId)

      if (targetNode && targetNode.id !== connectingFrom.value.id) {
        connectNodes(connectingFrom.value.id, targetNode.id)
      }
    }

    connectingFrom.value = null
    tempConnection.value = null

    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const connectNodes = (sourceId, targetId) => {
  // Check if connection already exists
  const exists = edges.value.some(e => e.source === sourceId && e.target === targetId)
  if (exists) return

  const edge = {
    id: `edge-${Date.now()}`,
    source: sourceId,
    target: targetId,
    animated: true,
    executing: false
  }

  edges.value.push(edge)
  emit('nodes-connected', { source: sourceId, target: targetId })

  nextTick(() => {
    updateConnections()
  })
}

const createPath = (source, target) => {
  const midX = (source.x + target.x) / 2
  return `M ${source.x} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x} ${target.y}`
}

const updateConnections = () => {
  edges.value.forEach(edge => {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    const targetNode = nodes.value.find(n => n.id === edge.target)

    if (sourceNode && targetNode) {
      const sourcePos = {
        x: sourceNode.position.x + 150,
        y: sourceNode.position.y + 40
      }
      const targetPos = {
        x: targetNode.position.x,
        y: targetNode.position.y + 40
      }

      edge.path = createPath(sourcePos, targetPos)
    }
  })
}

const handleHoverStart = (node, side) => {
  // Visual feedback for connection points
}

const handleHoverEnd = () => {
  // Remove visual feedback
}

const getNodeStatusClass = (node) => {
  if (props.executingNode === node.id) {
    return 'status-running'
  }
  return 'status-idle'
}

const canExecute = computed(() => {
  return nodes.value.length >= 3 && edges.value.length >= 2
})

// Expose methods for parent component
defineExpose({
  nodes,
  edges,
  clearWorkspace,
  updateConnections
})

onMounted(() => {
  // Any initialization
})
</script>

<style scoped lang="scss">
.interactive-workflow-builder {
  display: flex;
  height: calc(100vh - 120px);
  gap: 0;
  background: var(--surface-ground);
}

.agent-palette {
  width: 280px;
  background: var(--surface-card);
  border-right: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;

  .palette-header {
    padding: 1rem;
    border-bottom: 1px solid var(--surface-border);
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    i {
      color: var(--text-color-secondary);
      cursor: help;
    }
  }

  .palette-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .agent-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0.75rem;
    background: var(--surface-50);
    border: 2px solid var(--surface-border);
    border-radius: var(--content-border-radius);
    cursor: move;
    transition: all 0.2s ease;
    user-select: none;
    -webkit-user-drag: element;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;

    &:hover:not(.disabled) {
      border-color: var(--primary-color);
      transform: translateX(4px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      -webkit-user-drag: none;
    }

    .agent-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      color: white;
      font-size: 1.25rem;
      flex-shrink: 0;
      pointer-events: none;
    }

    .agent-info {
      flex: 1;
      min-width: 0;
      pointer-events: none;

      .agent-label {
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--text-color);
        margin-bottom: 2px;
      }

      .agent-description {
        font-size: 0.75rem;
        color: var(--text-color-secondary);
        line-height: 1.3;
      }
    }
  }
}

.workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--surface-50);
  position: relative;

  .workspace-header {
    padding: 1rem;
    background: var(--surface-card);
    border-bottom: 1px solid var(--surface-border);
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .canvas {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .connections-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;

    path {
      transition: stroke 0.2s ease;

      &.animated-edge {
        animation: dash 20s linear infinite;
        stroke-dasharray: 10, 5;
      }

      &.executing {
        stroke: #10B981;
        stroke-width: 3;
        animation: flow 1s linear infinite;
      }
    }
  }

  .workflow-node {
    position: absolute;
    width: 150px;
    background: var(--surface-card);
    border: 2px solid var(--surface-border);
    border-radius: var(--content-border-radius);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    &.selected {
      border-color: var(--primary-color);
      box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
    }

    &.executing {
      border-color: #10B981;
      animation: node-pulse 1s infinite;
    }

    .node-header {
      padding: 0.75rem;
      color: white;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      border-radius: var(--content-border-radius) var(--content-border-radius) 0 0;

      i {
        font-size: 1rem;
      }

      span {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .node-body {
      padding: 0.5rem;
      display: flex;
      justify-content: center;

      .node-status {
        i {
          font-size: 0.5rem;

          &.status-idle {
            color: var(--text-color-secondary);
          }

          &.status-running {
            color: #10B981;
            animation: blink 1s infinite;
          }
        }
      }
    }

    .handle {
      position: absolute;
      width: 12px;
      height: 12px;
      background: var(--primary-color);
      border: 2px solid white;
      border-radius: 50%;
      cursor: pointer;
      top: 50%;
      transform: translateY(-50%);
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-50%) scale(1.3);
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
      }

      &.handle-left {
        left: -6px;
      }

      &.handle-right {
        right: -6px;
      }
    }
  }

  .empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--text-color-secondary);

    i {
      font-size: 4rem;
      margin-bottom: 1rem;
      opacity: 0.3;
    }

    p {
      font-size: 1.1rem;
      margin: 0;
    }
  }
}

.properties-panel {
  width: 320px;
  background: var(--surface-card);
  border-left: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;

  .panel-header {
    padding: 1rem;
    border-bottom: 1px solid var(--surface-border);

    h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;

    .node-properties {
      .property-group {
        margin-bottom: 1.25rem;

        label {
          display: block;
          font-weight: 600;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
          color: var(--text-color);
        }

        .property-value {
          padding: 0.5rem 0.75rem;
          background: var(--surface-50);
          border-radius: var(--content-border-radius);
          font-size: 0.875rem;
          color: var(--text-color-secondary);
        }
      }
    }

    .no-selection {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: var(--text-color-secondary);

      i {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.3;
      }

      p {
        margin: 0;
        font-size: 0.95rem;
      }
    }
  }
}

@keyframes dash {
  to {
    stroke-dashoffset: -100;
  }
}

@keyframes flow {
  0% {
    stroke-dasharray: 10, 20;
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: -30;
  }
}

@keyframes node-pulse {
  0%, 100% {
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
  }
  50% {
    box-shadow: 0 4px 24px rgba(16, 185, 129, 0.6);
  }
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

@media (max-width: 1200px) {
  .agent-palette {
    width: 240px;
  }

  .properties-panel {
    width: 280px;
  }
}

@media (max-width: 768px) {
  .interactive-workflow-builder {
    flex-direction: column;
    height: auto;
  }

  .agent-palette,
  .properties-panel {
    width: 100%;
    height: auto;
    max-height: 200px;
  }

  .workspace {
    height: 400px;
  }
}
</style>
