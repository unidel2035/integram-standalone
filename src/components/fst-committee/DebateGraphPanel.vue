<template>
  <div class="dgp-root">
    <div class="dgp-header">
      <span class="dgp-title">
        <i class="pi pi-sitemap"></i> Граф событий дебатов
      </span>
      <div class="dgp-legend">
        <span v-for="r in RELATION_LEGEND" :key="r.type" class="dgp-leg-item">
          <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5"
            :stroke="r.color" stroke-width="2" :stroke-dasharray="r.dash || 'none'"/></svg>
          {{ r.label }}
        </span>
      </div>
    </div>

    <div class="dgp-scroll-wrap" ref="scrollWrap">
      <svg :width="svgWidth" :height="svgHeight" class="dgp-svg"
        @mousemove="onMouseMove" @mouseleave="hoveredId = null">

        <!-- Agent column headers -->
        <g v-for="(agent, ai) in AGENTS" :key="agent.id">
          <rect :x="colX(agent.id) - COL_W/2" y="0"
            :width="COL_W - 4" height="28" rx="5"
            :fill="agent.color + '22'" :stroke="agent.color + '55'" stroke-width="1"/>
          <text :x="colX(agent.id)" y="18"
            text-anchor="middle" font-size="9" :fill="agent.color" font-weight="600">
            {{ agent.shortName }}
          </text>
          <!-- column guide line -->
          <line :x1="colX(agent.id)" y1="30"
            :x2="colX(agent.id)" :y2="svgHeight - 10"
            :stroke="agent.color + '18'" stroke-width="1"/>
        </g>

        <!-- Edges (relations) -->
        <g v-for="edge in edges" :key="edge.id">
          <path :d="edgePath(edge)"
            :stroke="edge.color" stroke-width="1.5" fill="none"
            :stroke-dasharray="edge.dash"
            :opacity="hoveredId && edge.sourceId !== hoveredId && edge.targetId !== hoveredId ? 0.15 : 0.75"
            marker-end="url(#arrow)"/>
        </g>

        <!-- Arrow marker -->
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#888"/>
          </marker>
          <marker v-for="r in RELATION_LEGEND" :key="'m'+r.type"
            :id="'arrow-'+r.type" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" :fill="r.color"/>
          </marker>
        </defs>

        <!-- Nodes (arguments) -->
        <g v-for="node in nodes" :key="node.id"
          class="dgp-node"
          @mouseenter="hoveredId = node.id"
          @click="selectedNode = selectedNode?.id === node.id ? null : node">
          <!-- glow when hovered/selected -->
          <circle v-if="hoveredId === node.id || selectedNode?.id === node.id"
            :cx="node.x" :cy="node.y" :r="node.r + 5"
            :fill="node.color + '33'" stroke="none"/>
          <!-- main circle -->
          <circle :cx="node.x" :cy="node.y" :r="node.r"
            :fill="node.color + (node.aiGenerated ? 'ee' : '55')"
            :stroke="node.color"
            :stroke-width="selectedNode?.id === node.id ? 2.5 : 1"
            :opacity="hoveredId && hoveredId !== node.id && !isConnected(node.id) ? 0.3 : 1"/>
          <!-- AI bolt -->
          <text v-if="node.aiGenerated" :x="node.x" :y="node.y + 4"
            text-anchor="middle" font-size="8" fill="white" font-weight="700">⚡</text>
          <!-- type label -->
          <text :x="node.x" :y="node.y + node.r + 10"
            text-anchor="middle" font-size="7"
            :fill="node.color" opacity="0.8">{{ node.typeShort }}</text>
        </g>
      </svg>
    </div>

    <!-- Node detail popup -->
    <Transition name="dgp-popup">
      <div v-if="selectedNode" class="dgp-popup" :style="popupStyle">
        <div class="dgp-popup-header">
          <span :style="{ color: selectedNode.color }">{{ selectedNode.agentName }}</span>
          <span class="dgp-popup-type">{{ selectedNode.typeLabel }}</span>
          <span v-if="selectedNode.aiGenerated" class="dgp-popup-ai">⚡ AI</span>
          <button class="dgp-popup-close" @click="selectedNode = null">×</button>
        </div>
        <div class="dgp-popup-text">{{ selectedNode.text }}</div>
        <div class="dgp-popup-meta">
          <span>{{ selectedNode.dimension }}</span>
          <span v-if="selectedNode.stance" :class="'dgp-stance dgp-stance--' + selectedNode.stance.toLowerCase()">
            {{ stanceLabel(selectedNode.stance) }}
          </span>
          <span class="dgp-popup-conf">{{ Math.round(selectedNode.confidence * 100) }}%</span>
        </div>
        <div v-if="selectedNode.relations?.length" class="dgp-popup-rels">
          <span v-for="rel in selectedNode.relations" :key="rel.targetId" class="dgp-popup-rel"
            :style="{ color: relColor(rel.type) }">
            {{ relLabel(rel.type) }} →
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { AGENTS } from './FstCommitteeConfig.js'

const props = defineProps({
  session: { type: Object, default: null },
})

// ── Layout constants ─────────────────────────────────────────────
const COL_W    = 90
const NODE_R   = 10
const ROW_H    = 44
const TOP_PAD  = 36
const SIDE_PAD = 20

const svgWidth  = computed(() => AGENTS.length * COL_W + SIDE_PAD * 2)
const svgHeight = computed(() => {
  const n = props.session?.arguments?.length || 0
  return Math.max(180, n * ROW_H + TOP_PAD + 30)
})

// ── Positioning ──────────────────────────────────────────────────
function colX(agentId) {
  const idx = AGENTS.findIndex(a => a.id === agentId)
  return SIDE_PAD + idx * COL_W + COL_W / 2
}

function rowY(argIdx) {
  return TOP_PAD + argIdx * ROW_H
}

// ── Nodes ────────────────────────────────────────────────────────
const TYPE_SHORTS = {
  OPENING: 'Поз', CHALLENGE: 'Выз', COUNTER: 'Контр',
  SUMMARY: 'Итог', SYNTHESIS: 'Итог', CLOSING: 'Итог',
}
const TYPE_LABELS = {
  OPENING: 'Позиция', CHALLENGE: 'Вызов', COUNTER: 'Контраргумент',
  SUMMARY: 'Итоговая позиция', SYNTHESIS: 'Синтез', CLOSING: 'Заключение',
}

const nodes = computed(() => {
  if (!props.session?.arguments) return []
  return props.session.arguments.map((arg, idx) => {
    const agent = AGENTS.find(a => a.id === arg.agentId)
    return {
      id:          arg.id,
      x:           colX(arg.agentId),
      y:           rowY(idx),
      r:           Math.max(7, Math.round((arg.confidence || arg.strength || 0.7) * NODE_R + 4)),
      color:       agent?.color || '#888',
      agentName:   agent?.name || arg.agentId,
      typeShort:   TYPE_SHORTS[arg.type] || arg.type,
      typeLabel:   TYPE_LABELS[arg.type] || arg.type,
      text:        arg.text,
      aiGenerated: arg.aiGenerated,
      dimension:   arg.dimension,
      stance:      arg.stance,
      confidence:  arg.confidence || arg.strength || 0.7,
      relations:   arg.relations || [],
    }
  })
})

const nodeMap = computed(() => {
  const m = {}
  for (const n of nodes.value) m[n.id] = n
  return m
})

// ── Edges ────────────────────────────────────────────────────────
const RELATION_LEGEND = [
  { type: 'challenges',    color: '#ef5350', label: 'Вызов',     dash: 'none' },
  { type: 'isResponseTo',  color: '#42a5f5', label: 'Ответ',     dash: 'none' },
  { type: 'supports',      color: '#66bb6a', label: 'Поддержка', dash: '4,2' },
  { type: 'contradicts',   color: '#ff7043', label: 'Противор.', dash: '2,2' },
  { type: 'synthesizes',   color: '#ab47bc', label: 'Синтез',    dash: '6,2' },
]

const REL_COLOR = Object.fromEntries(RELATION_LEGEND.map(r => [r.type, r.color]))
const REL_DASH  = Object.fromEntries(RELATION_LEGEND.map(r => [r.type, r.dash]))

function relColor(type) { return REL_COLOR[type] || '#888' }
function relLabel(type) {
  return RELATION_LEGEND.find(r => r.type === type)?.label || type
}

const edges = computed(() => {
  const result = []
  for (const node of nodes.value) {
    for (const rel of node.relations) {
      const target = nodeMap.value[rel.targetId]
      if (!target) continue
      result.push({
        id:       `${node.id}-${rel.type}-${rel.targetId}`,
        sourceId: node.id,
        targetId: rel.targetId,
        sx: node.x, sy: node.y,
        tx: target.x, ty: target.y,
        color: relColor(rel.type),
        dash:  REL_DASH[rel.type] || 'none',
      })
    }
  }
  return result
})

function edgePath(e) {
  const r = 11 // node radius clearance
  // Start/end offset from node centers
  const dx = e.tx - e.sx
  const dy = e.ty - e.sy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const sx = e.sx + (dx / dist) * r
  const sy = e.sy + (dy / dist) * r
  const tx = e.tx - (dx / dist) * (r + 4) // extra for arrow
  const ty = e.ty - (dy / dist) * (r + 4)
  // Bezier control point — curve to the side
  const mx = (sx + tx) / 2 + (dy / dist) * 25
  const my = (sy + ty) / 2 - (dx / dist) * 25
  return `M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}`
}

// ── Interaction ──────────────────────────────────────────────────
const hoveredId    = ref(null)
const selectedNode = ref(null)
const scrollWrap   = ref(null)

const connectedSet = computed(() => {
  if (!hoveredId.value) return new Set()
  const s = new Set([hoveredId.value])
  for (const e of edges.value) {
    if (e.sourceId === hoveredId.value) s.add(e.targetId)
    if (e.targetId === hoveredId.value) s.add(e.sourceId)
  }
  return s
})

function isConnected(id) { return connectedSet.value.has(id) }

function onMouseMove() {}

const popupStyle = computed(() => {
  if (!selectedNode.value) return {}
  const node = selectedNode.value
  const wrap = scrollWrap.value
  const wrapW = wrap?.clientWidth || 500
  const left = Math.min(node.x + 15, wrapW - 280)
  return { left: left + 'px', top: (node.y + 15) + 'px' }
})

function stanceLabel(s) {
  return { APPROVE: 'За', DEFER: 'Отложить', REJECT: 'Против' }[s] || s
}
</script>

<style scoped>
.dgp-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--p-surface-ground);
}

.dgp-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--p-surface-border);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.dgp-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
  display: flex;
  align-items: center;
  gap: 6px;
}

.dgp-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.dgp-leg-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--p-text-muted-color);
}

.dgp-scroll-wrap {
  flex: 1;
  overflow: auto;
  position: relative;
}

.dgp-svg {
  display: block;
  cursor: default;
}

.dgp-node { cursor: pointer; }

/* Popup */
.dgp-popup {
  position: absolute;
  background: var(--p-surface-overlay, #1e2535);
  background-color: var(--p-surface-overlay, #1e2535);
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  padding: 12px 14px;
  width: 280px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);
  z-index: 100;
  pointer-events: all;
  backdrop-filter: none;
  isolation: isolate;
}
/* Force opaque in both light and dark themes */
:root .dgp-popup { background-color: var(--p-content-background, #ffffff); }
.p-dark .dgp-popup, [data-p-theme="dark"] .dgp-popup { background-color: #1a2035; }

.dgp-popup-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 6px;
}

.dgp-popup-type {
  font-size: 10px;
  color: var(--p-text-muted-color);
  font-weight: 400;
}

.dgp-popup-ai {
  font-size: 10px;
  color: #a78bfa;
  font-weight: 600;
  margin-left: auto;
}

.dgp-popup-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--p-text-muted-color);
  font-size: 14px;
  padding: 0 0 0 4px;
  line-height: 1;
}

.dgp-popup-text {
  font-size: 11px;
  line-height: 1.5;
  color: var(--p-text-color);
  margin-bottom: 6px;
  max-height: 90px;
  overflow-y: auto;
}

.dgp-popup-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: var(--p-text-muted-color);
}

.dgp-popup-conf {
  margin-left: auto;
  font-weight: 600;
}

.dgp-stance { font-weight: 600; font-size: 10px; }
.dgp-stance--approve { color: #4caf50; }
.dgp-stance--defer   { color: #ffa726; }
.dgp-stance--reject  { color: #ef5350; }

.dgp-popup-rels {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 10px;
}

.dgp-popup-rel { font-weight: 500; }

/* Transition */
.dgp-popup-enter-active, .dgp-popup-leave-active { transition: opacity 0.15s, transform 0.15s; }
.dgp-popup-enter-from, .dgp-popup-leave-to { opacity: 0; transform: scale(0.9); }
</style>
