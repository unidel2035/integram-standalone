<!-- GrCausalDag — каузальный DAG событий (граф happens-before) -->
<template>
  <div class="gr-dag" ref="container">

    <!-- Легенда фаз -->
    <div class="gr-dag-legend">
      <span v-for="ph in PHASES" :key="ph.id" class="gr-dag-legend-item">
        <span class="gr-dag-legend-dot" :style="{ background: ph.color }" />
        {{ ph.label }}
      </span>
    </div>

    <!-- Пусто -->
    <div v-if="!events.length" class="gr-dag-empty">
      <i class="pi pi-share-alt" style="font-size:2rem;opacity:0.2" />
      <div>Лента пуста — нет событий для построения графа</div>
    </div>

    <!-- SVG граф -->
    <div v-else class="gr-dag-scroll">
      <svg :width="svgW" :height="svgH" class="gr-dag-svg">
        <!-- Фоновые полосы фаз -->
        <rect v-for="col in columns" :key="col.phase"
              :x="col.x - COL_W/2 + GAP/2" y="0"
              :width="COL_W - GAP" :height="svgH"
              :fill="phaseColor(col.phase) + '0A'" rx="8" />

        <!-- Заголовки фаз -->
        <text v-for="col in columns" :key="col.phase + 'lbl'"
              :x="col.x" y="20"
              text-anchor="middle" class="gr-dag-phase-lbl"
              :fill="phaseColor(col.phase)">
          {{ phaseLabel(col.phase) }}
        </text>

        <!-- Рёбра -->
        <g v-for="edge in edges" :key="(edge.from || '') + (edge.to || '')">
          <path :d="edgePath(edge)"
                class="gr-dag-edge"
                :stroke="edgeColor(edge)"
                fill="none" stroke-width="1.5"
                marker-end="url(#arrow)" />
        </g>

        <!-- Стрелка-маркер -->
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="var(--p-text-muted-color)" opacity="0.5" />
          </marker>
        </defs>

        <!-- Узлы (события) -->
        <g v-for="node in layoutNodes" :key="node.id"
           class="gr-dag-node-g" :class="{ 'gr-dag-node-g--hover': hoveredId === node.id }"
           @mouseenter="hoveredId = node.id"
           @mouseleave="hoveredId = null"
           style="cursor:pointer">

          <!-- Тень при hover -->
          <circle v-if="hoveredId === node.id"
                  :cx="node.x" :cy="node.y" :r="NODE_R + 4"
                  :fill="node.color + '22'" />

          <!-- Кружок узла -->
          <circle :cx="node.x" :cy="node.y" :r="NODE_R"
                  :fill="node.color + '18'"
                  :stroke="node.color"
                  stroke-width="2" />

          <!-- Иконка (unicode approximation) -->
          <text :x="node.x" :y="node.y + 5"
                text-anchor="middle" font-size="14"
                :fill="node.color">{{ phaseEmoji(node.phase) }}</text>

          <!-- Метка под кружком -->
          <foreignObject :x="node.x - 48" :y="node.y + NODE_R + 4" width="96" height="44">
            <div xmlns="http://www.w3.org/1999/xhtml" class="gr-dag-node-label"
                 :style="{ color: node.color }">
              {{ node.label }}
            </div>
          </foreignObject>

          <!-- Подсказка при hover -->
          <g v-if="hoveredId === node.id">
            <rect :x="node.x + NODE_R + 4" :y="node.y - 28" width="160" height="54"
                  rx="6" fill="var(--p-surface-card)"
                  stroke="var(--p-content-border-color)" stroke-width="1" />
            <foreignObject :x="node.x + NODE_R + 8" :y="node.y - 24" width="152" height="46">
              <div xmlns="http://www.w3.org/1999/xhtml" class="gr-dag-tooltip">
                <div class="gr-dag-tt-type">{{ node.event.type }}</div>
                <div class="gr-dag-tt-subj">{{ node.def.subject }} → {{ node.def.object }}</div>
                <div class="gr-dag-tt-time">{{ formatDate(node.event.ts) }}</div>
              </div>
            </foreignObject>
          </g>
        </g>
      </svg>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { buildCausalDag } from '@/services/grEventEngine.js'
import { GR_EVENT_TYPES } from '@/config/grEventTypes.js'
import { EVENT_PHASES } from '@/config/grEventTypes.js'

const props = defineProps({
  events: { type: Array, default: () => [] },
})

const hoveredId = ref(null)
const container = ref(null)

const COL_W = 160
const NODE_R = 22
const ROW_H = 100
const GAP   = 16
const TOP_OFFSET = 40

// Порядок фаз (слева направо)
const PHASE_ORDER = ['init', 'diagnose', 'apply', 'approve', 'fund', 'outcome', 'scale', 'other']
const PHASES = EVENT_PHASES

function phaseLabel(id) {
  return EVENT_PHASES.find(p => p.id === id)?.label || id
}
function phaseColor(id) {
  return EVENT_PHASES.find(p => p.id === id)?.color || '#64748b'
}
function phaseEmoji(id) {
  const map = { init: '⚑', diagnose: '⬤', apply: '▶', approve: '◉', fund: '✦', outcome: '★', scale: '⬆', other: '●' }
  return map[id] || '●'
}

// Единый реактивный DAG
const dag = computed(() => buildCausalDag(props.events))
const edges = computed(() => dag.value.edges)

const layoutNodes = computed(() => {
  const dag = buildCausalDag(props.events)
  const phaseGroups = {}

  for (const node of dag.nodes) {
    if (!phaseGroups[node.phase]) phaseGroups[node.phase] = []
    phaseGroups[node.phase].push(node)
  }

  const phases = PHASE_ORDER.filter(p => phaseGroups[p]?.length)
  const placed = []
  let colIdx = 0

  for (const phase of phases) {
    const grp = phaseGroups[phase] || []
    const x = COL_W / 2 + colIdx * COL_W + GAP
    grp.forEach((node, row) => {
      placed.push({
        ...node,
        x,
        y: TOP_OFFSET + NODE_R + row * ROW_H + ROW_H / 2,
      })
    })
    colIdx++
  }

  return placed
})

const columns = computed(() => {
  const phases = [...new Set(layoutNodes.value.map(n => n.phase))]
  return phases.map((phase, i) => ({
    phase,
    x: COL_W / 2 + i * COL_W + GAP,
  }))
})

const svgW = computed(() => Math.max(400, columns.value.length * COL_W + GAP * 2))
const svgH = computed(() => {
  const maxRows = Math.max(...(columns.value.map(col =>
    layoutNodes.value.filter(n => n.phase === col.phase).length
  )), 1)
  return TOP_OFFSET + maxRows * ROW_H + ROW_H
})

function edgePath(edge) {
  const from = layoutNodes.value.find(n => n.id === edge.from)
  const to   = layoutNodes.value.find(n => n.id === edge.to)
  if (!from || !to) return ''

  const x1 = from.x + NODE_R
  const y1 = from.y
  const x2 = to.x - NODE_R - 6
  const y2 = to.y
  const cx = (x1 + x2) / 2

  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
}

function edgeColor(edge) {
  const from = layoutNodes.value.find(n => n.id === edge.from)
  return from?.color || 'var(--p-text-muted-color)'
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.gr-dag { display: flex; flex-direction: column; gap: 12px; }

.gr-dag-legend {
  display: flex; flex-wrap: wrap; gap: 10px; font-size: 11px; color: var(--p-text-muted-color);
}
.gr-dag-legend-item { display: flex; align-items: center; gap: 4px; }
.gr-dag-legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

.gr-dag-empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px;
  color: var(--p-text-muted-color); font-size: 13px;
}

.gr-dag-scroll { overflow-x: auto; overflow-y: visible; padding-bottom: 8px; }

.gr-dag-svg { display: block; }

.gr-dag-phase-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }

.gr-dag-edge { opacity: 0.4; transition: opacity 0.2s; }
.gr-dag-node-g:hover ~ .gr-dag-edge { opacity: 0.8; }

.gr-dag-node-label {
  font-size: 9px; font-weight: 600; text-align: center; line-height: 1.3;
  word-break: break-word; overflow: hidden;
}

.gr-dag-tooltip { padding: 2px; }
.gr-dag-tt-type { font-size: 8px; font-weight: 700; color: var(--p-text-muted-color); text-transform: uppercase; }
.gr-dag-tt-subj { font-size: 10px; color: var(--p-text-color); line-height: 1.3; }
.gr-dag-tt-time { font-size: 9px; color: var(--p-text-muted-color); margin-top: 2px; }
</style>
