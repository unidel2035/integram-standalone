<template>
  <div class="lgv-wrap">
    <div class="lgv-toolbar">
      <span class="lgv-title"><i class="pi pi-share-alt" /> Граф связей (LinksPlatform)</span>
      <div class="lgv-legend">
        <span v-for="(info, type) in TYPE_INFO" :key="type" class="lgv-leg-item">
          <span class="lgv-leg-dot" :style="{ background: info.color }" />
          {{ info.label }}
        </span>
      </div>
      <Button icon="pi pi-refresh" size="small" text @click="loadAndLayout" :loading="loading" />
    </div>

    <div v-if="loading" class="lgv-loader">
      <i class="pi pi-spin pi-spinner" /> Загрузка графа...
    </div>

    <svg v-else ref="svgEl" class="lgv-svg" :viewBox="`0 0 ${W} ${H}`"
      @mousedown="onSvgMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseUp">

      <!-- Рёбра -->
      <g class="lgv-edges">
        <g v-for="e in edges" :key="e.id">
          <line
            :x1="nodePos(e.source).x" :y1="nodePos(e.source).y"
            :x2="nodePos(e.target).x" :y2="nodePos(e.target).y"
            :stroke="e.color" stroke-opacity="0.5"
            :stroke-width="Math.max(1, (e.weight || 50) / 40)"
            stroke-dasharray="4,3"
          />
          <!-- Метка ребра -->
          <text
            :x="(nodePos(e.source).x + nodePos(e.target).x) / 2"
            :y="(nodePos(e.source).y + nodePos(e.target).y) / 2 - 4"
            font-size="8" fill="#888" text-anchor="middle"
          >{{ e.label }}</text>
        </g>
      </g>

      <!-- Ноды -->
      <g class="lgv-nodes">
        <g v-for="n in nodes" :key="n.id"
          :transform="`translate(${nodePos(n.id).x},${nodePos(n.id).y})`"
          class="lgv-node"
          @mousedown.stop="startDrag($event, n.id)"
          @click="selectedNode = selectedNode === n.id ? null : n.id">

          <circle
            :r="n.type === 'concept' ? 18 : n.type === 'company' ? 22 : 14"
            :fill="n.color + '33'"
            :stroke="n.color"
            :stroke-width="selectedNode === n.id ? 2.5 : 1.5"
          />
          <text font-size="11" fill="#fff" text-anchor="middle" dominant-baseline="central"
                style="pointer-events:none;user-select:none">
            {{ typeIcon(n.type) }}
          </text>
          <text font-size="8" fill="#ccc" text-anchor="middle" :y="n.type === 'company' ? 30 : 26"
                style="pointer-events:none;user-select:none">
            {{ truncate(n.label, 18) }}
          </text>
        </g>
      </g>
    </svg>

    <!-- Tooltip для выбранной ноды -->
    <div v-if="selectedNode && selectedNodeData" class="lgv-tooltip">
      <div class="lgv-tt-type">{{ TYPE_INFO[selectedNodeData.type]?.label || selectedNodeData.type }}</div>
      <div class="lgv-tt-label">{{ selectedNodeData.label }}</div>
      <div class="lgv-tt-edges">
        Связей: {{ edgesOf(selectedNode).length }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getFullGraph } from '@/services/fstLinksService'

const props = defineProps({
  autoRefresh: { type: Boolean, default: false }
})

const W = 800, H = 520
const svgEl = ref(null)
const loading = ref(true)
const nodes = ref([])
const edges = ref([])
const positions = ref({})    // nodeId → { x, y }
const velocities = ref({})   // nodeId → { vx, vy }
const selectedNode = ref(null)
const dragging = ref(null)
const dragOffset = ref({ x: 0, y: 0 })
let animFrame = null
let tickCount = 0

const TYPE_INFO = {
  company:  { label: 'Компания',  color: '#3b82f6', icon: '🏢' },
  concept:  { label: 'Концепт',   color: '#8b5cf6', icon: '🔷' },
  session:  { label: 'Сессия ИК', color: '#f59e0b', icon: '⚖️' },
  argument: { label: 'Аргумент',  color: '#6b7280', icon: '💬' },
}

function typeIcon(type) {
  return { company: '🏢', concept: '🔷', session: '⚖️', argument: '💬' }[type] || '●'
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n) + '…' : (str || '')
}

function nodePos(id) {
  return positions.value[id] || { x: W / 2, y: H / 2 }
}

const selectedNodeData = computed(() =>
  nodes.value.find(n => n.id === selectedNode.value)
)

function edgesOf(nodeId) {
  return edges.value.filter(e => e.source === nodeId || e.target === nodeId)
}

// ── Force-directed layout ─────────────────────────────────
function initPositions() {
  const pos = {}
  const vel = {}
  nodes.value.forEach((n, i) => {
    const angle = (i / nodes.value.length) * Math.PI * 2
    const r = Math.min(W, H) * 0.35
    pos[n.id] = {
      x: W / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 40,
      y: H / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 40,
    }
    vel[n.id] = { vx: 0, vy: 0 }
  })
  positions.value = pos
  velocities.value = vel
}

function tick() {
  if (tickCount > 300) return  // stop after stabilization
  tickCount++

  const pos = positions.value
  const vel = velocities.value
  const k = 80   // ideal edge length
  const repulsion = 3500

  // Repulsion between all nodes
  const nodeList = nodes.value
  for (let i = 0; i < nodeList.length; i++) {
    for (let j = i + 1; j < nodeList.length; j++) {
      const a = nodeList[i], b = nodeList[j]
      const pa = pos[a.id], pb = pos[b.id]
      const dx = pb.x - pa.x, dy = pb.y - pa.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = repulsion / (dist * dist)
      const fx = (dx / dist) * force, fy = (dy / dist) * force
      vel[a.id].vx -= fx;  vel[a.id].vy -= fy
      vel[b.id].vx += fx;  vel[b.id].vy += fy
    }
  }

  // Attraction along edges
  for (const e of edges.value) {
    const pa = pos[e.source], pb = pos[e.target]
    if (!pa || !pb) continue
    const dx = pb.x - pa.x, dy = pb.y - pa.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const force = (dist - k) * 0.04
    const fx = (dx / dist) * force, fy = (dy / dist) * force
    vel[e.source].vx += fx;  vel[e.source].vy += fy
    vel[e.target].vx -= fx;  vel[e.target].vy -= fy
  }

  // Center gravity
  for (const n of nodeList) {
    const p = pos[n.id], v = vel[n.id]
    if (!p || !v) continue
    v.vx += (W / 2 - p.x) * 0.002
    v.vy += (H / 2 - p.y) * 0.002

    // Damping + update
    if (dragging.value !== n.id) {
      v.vx *= 0.85; v.vy *= 0.85
      p.x = Math.max(24, Math.min(W - 24, p.x + v.vx))
      p.y = Math.max(24, Math.min(H - 24, p.y + v.vy))
    }
  }

  // Trigger reactivity
  positions.value = { ...pos }
  animFrame = requestAnimationFrame(tick)
}

// ── Drag ─────────────────────────────────────────────────
function startDrag(e, nodeId) {
  dragging.value = nodeId
  const svgRect = svgEl.value.getBoundingClientRect()
  const scaleX = W / svgRect.width, scaleY = H / svgRect.height
  const p = positions.value[nodeId]
  dragOffset.value = {
    x: e.clientX * scaleX - svgRect.left * scaleX - p.x,
    y: e.clientY * scaleY - svgRect.top  * scaleY - p.y,
  }
}

function onSvgMouseDown(e) {
  if (e.target.tagName === 'svg') selectedNode.value = null
}

function onMouseMove(e) {
  if (!dragging.value) return
  const svgRect = svgEl.value.getBoundingClientRect()
  const scaleX = W / svgRect.width, scaleY = H / svgRect.height
  const x = e.clientX * scaleX - svgRect.left * scaleX - dragOffset.value.x
  const y = e.clientY * scaleY - svgRect.top  * scaleY - dragOffset.value.y
  positions.value = {
    ...positions.value,
    [dragging.value]: {
      x: Math.max(24, Math.min(W - 24, x)),
      y: Math.max(24, Math.min(H - 24, y)),
    }
  }
}

function onMouseUp() {
  dragging.value = null
}

// ── Data loading ──────────────────────────────────────────
async function loadAndLayout() {
  loading.value = true
  tickCount = 0
  if (animFrame) cancelAnimationFrame(animFrame)
  try {
    const { nodes: n, edges: e } = await getFullGraph()
    nodes.value = n
    edges.value = e
    initPositions()
    animFrame = requestAnimationFrame(tick)
  } finally {
    loading.value = false
  }
}

onMounted(loadAndLayout)
onUnmounted(() => { if (animFrame) cancelAnimationFrame(animFrame) })
</script>

<style scoped>
.lgv-wrap {
  position: relative;
  background: var(--surface-ground);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--surface-border);
}
.lgv-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-card);
}
.lgv-title {
  font-weight: 600;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.lgv-legend {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1;
}
.lgv-leg-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}
.lgv-leg-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.lgv-svg {
  width: 100%;
  height: 520px;
  cursor: grab;
  display: block;
}
.lgv-svg:active { cursor: grabbing; }
.lgv-node { cursor: pointer; }
.lgv-loader {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--p-text-muted-color);
  gap: 8px;
}
.lgv-tooltip {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 10px 14px;
  min-width: 160px;
  pointer-events: none;
}
.lgv-tt-type {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.lgv-tt-label {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 4px 0;
}
.lgv-tt-edges {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}
</style>
