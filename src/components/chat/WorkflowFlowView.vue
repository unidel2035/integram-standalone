<template>
  <div class="workflow-flow-view" :class="{ 'compact': compact, 'fullscreen': isFullscreen }">
    <!-- Header -->
    <div class="flow-header">
      <div class="flow-title">
        <i class="pi pi-sitemap"></i>
        <span>{{ title || 'Agent Workflow' }}</span>
        <Tag
          v-if="status === 'running'"
          severity="info"
          value="Running"
          class="status-tag pulse"
        />
        <Tag
          v-else-if="status === 'completed'"
          severity="success"
          value="Completed"
          class="status-tag"
        />
        <Tag
          v-else-if="status === 'error'"
          severity="danger"
          value="Error"
          class="status-tag"
        />
      </div>
      <div class="flow-actions">
        <Button
          v-if="!compact"
          icon="pi pi-arrows-alt"
          text
          rounded
          size="small"
          @click="toggleFullscreen"
          v-tooltip.left="'Toggle fullscreen'"
        />
        <Button
          icon="pi pi-refresh"
          text
          rounded
          size="small"
          @click="resetView"
          v-tooltip.left="'Reset view'"
        />
      </div>
    </div>

    <!-- Flow Canvas -->
    <div
      ref="canvasContainer"
      class="flow-canvas"
      @wheel.prevent="handleZoom"
      @mousedown="startPan"
      @mousemove="pan"
      @mouseup="endPan"
      @mouseleave="endPan"
    >
      <svg
        ref="svgCanvas"
        :width="canvasWidth"
        :height="canvasHeight"
        :viewBox="viewBox"
        class="flow-svg"
      >
        <!-- Background grid -->
        <defs>
          <pattern
            id="grid"
            :width="gridSize"
            :height="gridSize"
            patternUnits="userSpaceOnUse"
          >
            <path
              :d="`M ${gridSize} 0 L 0 0 0 ${gridSize}`"
              fill="none"
              stroke="var(--surface-border, #e5e7eb)"
              stroke-width="0.5"
            />
          </pattern>
          <!-- Arrow marker for edges -->
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="var(--p-surface-400, #9ca3af)"
            />
          </marker>
          <marker
            id="arrowhead-active"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="var(--p-primary-color, #3b82f6)"
            />
          </marker>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid)" />

        <!-- Edges -->
        <g class="edges">
          <path
            v-for="edge in computedEdges"
            :key="edge.id"
            :d="edge.path"
            :class="['edge', edge.status, { 'animated': edge.animated }]"
            :marker-end="edge.status === 'active' ? 'url(#arrowhead-active)' : 'url(#arrowhead)'"
          />
        </g>

        <!-- Nodes -->
        <g class="nodes">
          <g
            v-for="node in computedNodes"
            :key="node.id"
            :transform="`translate(${node.x}, ${node.y})`"
            :class="['node', node.type, node.status]"
            @click="selectNode(node)"
          >
            <!-- Node background -->
            <rect
              :width="nodeWidth"
              :height="nodeHeight"
              :rx="8"
              :ry="8"
              class="node-bg"
            />

            <!-- Node icon -->
            <foreignObject
              :x="12"
              :y="(nodeHeight - 32) / 2"
              width="32"
              height="32"
            >
              <div class="node-icon">{{ node.icon || getNodeIcon(node.type) }}</div>
            </foreignObject>

            <!-- Node content -->
            <text
              :x="52"
              :y="nodeHeight / 2 - 4"
              class="node-title"
            >
              {{ truncate(node.label, 20) }}
            </text>
            <text
              :x="52"
              :y="nodeHeight / 2 + 12"
              class="node-subtitle"
            >
              {{ node.status === 'running' ? 'Processing...' : node.subtitle || '' }}
            </text>

            <!-- Status indicator -->
            <circle
              v-if="node.status"
              :cx="nodeWidth - 12"
              :cy="12"
              r="6"
              :class="['status-dot', node.status]"
            />

            <!-- Progress ring for running nodes -->
            <circle
              v-if="node.status === 'running'"
              :cx="nodeWidth - 12"
              :cy="12"
              r="8"
              class="progress-ring"
              fill="none"
              stroke-width="2"
            />
          </g>
        </g>
      </svg>

      <!-- Zoom controls -->
      <div class="zoom-controls">
        <Button
          icon="pi pi-plus"
          text
          rounded
          size="small"
          @click="zoomIn"
        />
        <span class="zoom-level">{{ Math.round(zoom * 100) }}%</span>
        <Button
          icon="pi pi-minus"
          text
          rounded
          size="small"
          @click="zoomOut"
        />
      </div>
    </div>

    <!-- Node details panel -->
    <Transition name="slide-up">
      <div v-if="selectedNode" class="node-details">
        <div class="details-header">
          <span class="node-icon-large">{{ selectedNode.icon || getNodeIcon(selectedNode.type) }}</span>
          <div class="details-info">
            <h4>{{ selectedNode.label }}</h4>
            <Tag :value="selectedNode.type" severity="secondary" />
          </div>
          <Button
            icon="pi pi-times"
            text
            rounded
            size="small"
            @click="selectedNode = null"
          />
        </div>

        <div class="details-content">
          <div v-if="selectedNode.description" class="detail-row">
            <span class="detail-label">Description</span>
            <span class="detail-value">{{ selectedNode.description }}</span>
          </div>
          <div v-if="selectedNode.duration" class="detail-row">
            <span class="detail-label">Duration</span>
            <span class="detail-value">{{ formatDuration(selectedNode.duration) }}</span>
          </div>
          <div v-if="selectedNode.status" class="detail-row">
            <span class="detail-label">Status</span>
            <Tag
              :value="selectedNode.status"
              :severity="getStatusSeverity(selectedNode.status)"
            />
          </div>
          <div v-if="selectedNode.output" class="detail-row">
            <span class="detail-label">Output</span>
            <pre class="detail-code">{{ formatOutput(selectedNode.output) }}</pre>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Legend -->
    <div v-if="showLegend && !compact" class="flow-legend">
      <div class="legend-item">
        <span class="legend-dot pending"></span>
        <span>Pending</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot running"></span>
        <span>Running</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot completed"></span>
        <span>Completed</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot error"></span>
        <span>Error</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
    // Each node: { id, label, type, icon?, status?, x?, y?, description?, duration?, output? }
  },
  edges: {
    type: Array,
    default: () => []
    // Each edge: { id, source, target, status?, animated? }
  },
  title: {
    type: String,
    default: 'Agent Workflow'
  },
  status: {
    type: String,
    default: 'idle' // idle, running, completed, error
  },
  compact: {
    type: Boolean,
    default: false
  },
  showLegend: {
    type: Boolean,
    default: true
  },
  autoLayout: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['node-click', 'node-select'])

// Refs
const canvasContainer = ref(null)
const svgCanvas = ref(null)
const selectedNode = ref(null)
const isFullscreen = ref(false)

// Canvas state
const canvasWidth = ref(600)
const canvasHeight = ref(400)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const lastPanPoint = ref({ x: 0, y: 0 })

// Constants
const nodeWidth = 200
const nodeHeight = 60
const gridSize = 20
const nodePadding = 40

// Computed
const viewBox = computed(() => {
  const x = -panX.value / zoom.value
  const y = -panY.value / zoom.value
  const w = canvasWidth.value / zoom.value
  const h = canvasHeight.value / zoom.value
  return `${x} ${y} ${w} ${h}`
})

const computedNodes = computed(() => {
  if (!props.autoLayout || props.nodes.some(n => n.x !== undefined)) {
    return props.nodes
  }
  // Simple auto-layout: arrange in rows
  return autoLayoutNodes(props.nodes, props.edges)
})

const computedEdges = computed(() => {
  return props.edges.map(edge => {
    const sourceNode = computedNodes.value.find(n => n.id === edge.source)
    const targetNode = computedNodes.value.find(n => n.id === edge.target)

    if (!sourceNode || !targetNode) {
      return { ...edge, path: '' }
    }

    // Calculate edge path (bezier curve)
    const sx = sourceNode.x + nodeWidth
    const sy = sourceNode.y + nodeHeight / 2
    const tx = targetNode.x
    const ty = targetNode.y + nodeHeight / 2

    const midX = (sx + tx) / 2
    const path = `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`

    return {
      ...edge,
      path
    }
  })
})

// Methods
const autoLayoutNodes = (nodes, edges) => {
  if (nodes.length === 0) return []

  // Build adjacency list
  const adj = {}
  const inDegree = {}
  nodes.forEach(n => {
    adj[n.id] = []
    inDegree[n.id] = 0
  })
  edges.forEach(e => {
    if (adj[e.source]) {
      adj[e.source].push(e.target)
    }
    if (inDegree[e.target] !== undefined) {
      inDegree[e.target]++
    }
  })

  // Topological sort to get levels
  const levels = []
  const queue = Object.keys(inDegree).filter(id => inDegree[id] === 0)
  const visited = new Set()

  while (queue.length > 0) {
    const levelNodes = [...queue]
    levels.push(levelNodes)
    queue.length = 0

    levelNodes.forEach(nodeId => {
      visited.add(nodeId)
      adj[nodeId]?.forEach(targetId => {
        inDegree[targetId]--
        if (inDegree[targetId] === 0 && !visited.has(targetId)) {
          queue.push(targetId)
        }
      })
    })
  }

  // Position nodes based on levels
  const positioned = []
  levels.forEach((level, levelIndex) => {
    level.forEach((nodeId, nodeIndex) => {
      const node = nodes.find(n => n.id === nodeId)
      if (node) {
        positioned.push({
          ...node,
          x: levelIndex * (nodeWidth + nodePadding * 2) + nodePadding,
          y: nodeIndex * (nodeHeight + nodePadding) + nodePadding
        })
      }
    })
  })

  // Add any remaining nodes not in the graph
  nodes.forEach(n => {
    if (!positioned.find(p => p.id === n.id)) {
      positioned.push({
        ...n,
        x: nodePadding,
        y: positioned.length * (nodeHeight + nodePadding) + nodePadding
      })
    }
  })

  return positioned
}

const getNodeIcon = (type) => {
  const icons = {
    start: '▶️',
    end: '🏁',
    agent: '🤖',
    ai: '🧠',
    tool: '🔧',
    decision: '❓',
    parallel: '⚡',
    merge: '🔀',
    human: '👤',
    api: '🌐',
    database: '🗄️',
    file: '📄',
    email: '📧',
    notification: '🔔',
    default: '📦'
  }
  return icons[type] || icons.default
}

const getStatusSeverity = (status) => {
  const severities = {
    pending: 'secondary',
    running: 'info',
    completed: 'success',
    error: 'danger',
    skipped: 'warn'
  }
  return severities[status] || 'secondary'
}

const truncate = (text, maxLength) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

const formatDuration = (ms) => {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const formatOutput = (output) => {
  if (typeof output === 'string') return output
  try {
    return JSON.stringify(output, null, 2)
  } catch {
    return String(output)
  }
}

const selectNode = (node) => {
  selectedNode.value = node
  emit('node-select', node)
  emit('node-click', node)
}

// Pan & Zoom
const handleZoom = (event) => {
  const delta = event.deltaY > 0 ? -0.1 : 0.1
  zoom.value = Math.max(0.25, Math.min(2, zoom.value + delta))
}

const zoomIn = () => {
  zoom.value = Math.min(2, zoom.value + 0.1)
}

const zoomOut = () => {
  zoom.value = Math.max(0.25, zoom.value - 0.1)
}

const startPan = (event) => {
  if (event.target === svgCanvas.value || event.target.closest('.flow-svg')) {
    isPanning.value = true
    lastPanPoint.value = { x: event.clientX, y: event.clientY }
  }
}

const pan = (event) => {
  if (!isPanning.value) return
  const dx = event.clientX - lastPanPoint.value.x
  const dy = event.clientY - lastPanPoint.value.y
  panX.value += dx
  panY.value += dy
  lastPanPoint.value = { x: event.clientX, y: event.clientY }
}

const endPan = () => {
  isPanning.value = false
}

const resetView = () => {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
}

// Resize observer
let resizeObserver = null

onMounted(() => {
  if (canvasContainer.value) {
    canvasWidth.value = canvasContainer.value.clientWidth
    canvasHeight.value = canvasContainer.value.clientHeight

    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvasWidth.value = entry.contentRect.width
        canvasHeight.value = entry.contentRect.height
      }
    })
    resizeObserver.observe(canvasContainer.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})
</script>

<style scoped>
.workflow-flow-view {
  background: var(--surface-card, #f7f7f5);
  border: 1px solid var(--surface-border, var(--surface-border));
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 300px;
  position: relative;
}

.workflow-flow-view.compact {
  min-height: 200px;
}

.workflow-flow-view.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  border-radius: 0;
}

.flow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--surface-border, var(--surface-border));
  background: var(--p-surface-card);
}

.flow-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--p-text-color, var(--text-color));
}

.flow-title i {
  color: var(--p-primary-color, var(--primary-color));
}

.status-tag.pulse {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.flow-actions {
  display: flex;
  gap: 0.25rem;
}

.flow-canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
  cursor: grab;
}

.flow-canvas:active {
  cursor: grabbing;
}

.flow-svg {
  width: 100%;
  height: 100%;
}

/* Edges */
.edge {
  fill: none;
  stroke: var(--p-surface-400, #9ca3af);
  stroke-width: 2;
  transition: stroke 0.3s;
}

.edge.active {
  stroke: var(--p-primary-color, #3b82f6);
  stroke-width: 3;
}

.edge.completed {
  stroke: var(--p-green-500, #22c55e);
}

.edge.error {
  stroke: var(--p-red-500, #ef4444);
}

.edge.animated {
  stroke-dasharray: 10, 5;
  animation: dash 1s linear infinite;
}

@keyframes dash {
  to {
    stroke-dashoffset: -15;
  }
}

/* Nodes */
.node {
  cursor: pointer;
  transition: transform 0.2s;
}

.node:hover {
  transform: scale(1.02);
}

.node-bg {
  fill: var(--surface-card, #f7f7f5);
  stroke: var(--surface-border, #e5e7eb);
  stroke-width: 2;
  transition: all 0.3s;
}

.node.running .node-bg {
  stroke: var(--p-primary-color, #3b82f6);
  stroke-width: 3;
  filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.3));
}

.node.completed .node-bg {
  stroke: var(--p-green-500, #22c55e);
}

.node.error .node-bg {
  stroke: var(--p-red-500, #ef4444);
}

.node-icon {
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.node-title {
  font-size: 0.875rem;
  font-weight: 600;
  fill: var(--p-text-color, #111827);
}

.node-subtitle {
  font-size: 0.75rem;
  fill: var(--p-text-color-secondary, #6b7280);
}

.status-dot {
  transition: fill 0.3s;
}

.status-dot.pending {
  fill: var(--p-surface-400, #9ca3af);
}

.status-dot.running {
  fill: var(--p-primary-color, #3b82f6);
  animation: pulse-dot 1s infinite;
}

.status-dot.completed {
  fill: var(--p-green-500, #22c55e);
}

.status-dot.error {
  fill: var(--p-red-500, #ef4444);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; r: 6; }
  50% { opacity: 0.6; r: 8; }
}

.progress-ring {
  stroke: var(--p-primary-color, #3b82f6);
  stroke-dasharray: 50;
  stroke-dashoffset: 50;
  animation: progress 2s linear infinite;
}

@keyframes progress {
  to {
    stroke-dashoffset: 0;
  }
}

/* Zoom controls */
.zoom-controls {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--surface-card, #f7f7f5);
  border: 1px solid var(--surface-border, #e5e7eb);
  border-radius: 6px;
  padding: 0.25rem;
}

.zoom-level {
  font-size: 0.75rem;
  min-width: 3rem;
  text-align: center;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
}

/* Node details panel */
.node-details {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface-card, #f7f7f5);
  border-top: 1px solid var(--surface-border, #e5e7eb);
  padding: 1rem;
  max-height: 40%;
  overflow-y: auto;
}

.details-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.node-icon-large {
  font-size: 2rem;
}

.details-info {
  flex: 1;
}

.details-info h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--p-text-color, var(--text-color));
}

.details-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
  text-transform: uppercase;
}

.detail-value {
  font-size: 0.875rem;
  color: var(--p-text-color, var(--text-color));
}

.detail-code {
  background: var(--p-surface-card);
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  overflow-x: auto;
  margin: 0;
}

/* Legend */
.flow-legend {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--surface-border, var(--surface-border));
  background: var(--p-surface-card);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--p-text-color-secondary, var(--text-color-secondary));
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-dot.pending {
  background: var(--p-surface-400, #9ca3af);
}

.legend-dot.running {
  background: var(--p-primary-color, #3b82f6);
}

.legend-dot.completed {
  background: var(--p-green-500, #22c55e);
}

.legend-dot.error {
  background: var(--p-red-500, #ef4444);
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
