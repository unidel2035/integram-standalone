<template>
  <div class="ecg-root" :style="{ height: layout.totalH + 'px', minWidth: layout.totalW + 'px' }">

    <!-- Временные полосы (заголовки колонок) -->
    <div class="ecg-band-row">
      <div v-for="band in layout.activeBands" :key="band.col"
        class="ecg-band-header"
        :style="{ left: band.labelX + 'px', width: COL_W + 'px' }">
        <span class="ecg-band-label">{{ band.label }}</span>
      </div>
    </div>

    <!-- Разделители колонок -->
    <div v-for="band in layout.activeBands.slice(1)" :key="'sep' + band.col"
      class="ecg-band-sep"
      :style="{ left: band.sepX + 'px' }">
    </div>

    <!-- SVG слой: рёбра графа -->
    <svg class="ecg-svg"
      :width="layout.totalW"
      :height="layout.totalH"
      :viewBox="`0 0 ${layout.totalW} ${layout.totalH}`">
      <path v-for="edge in layout.edges" :key="edge.id"
        :d="edge.d"
        :style="{ stroke: edge.color, opacity: edgeOpacity(edge) }"
        fill="none"
        stroke-width="1.5"
        stroke-linecap="round"
        class="ecg-edge" />
      <!-- Стрелки (маленькие треугольники на конце рёбер) -->
      <polygon v-for="edge in layout.edges" :key="'arr' + edge.id"
        :points="arrowPoints(edge)"
        :style="{ fill: edge.color, opacity: edgeOpacity(edge) }" />
    </svg>

    <!-- HTML-слой: ноды -->
    <div v-for="node in layout.nodes" :key="node.id"
      :class="['ecg-node', { selected: selectedId === node.id, dimmed: isDimmed(node) }]"
      :style="{
        left: node.x + 'px',
        top: node.y + 'px',
        width: NODE_W + 'px',
        height: NODE_H + 'px',
        borderLeftColor: pathColor(node.path),
      }"
      @click="$emit('select', node)">

      <div class="ecg-node-top">
        <i :class="node.icon || 'pi pi-circle'"
          class="ecg-node-icon"
          :style="{ color: pathColor(node.path) }"></i>
        <span v-if="node.chain" class="ecg-chain-badge"
          :style="{
            background: `color-mix(in srgb, ${chainColor(node.chain)} 13%, transparent)`,
            color: chainColor(node.chain),
          }">
          {{ chainLabel(node.chain) }}
        </span>
        <span class="ecg-prob" :style="{ color: probColor(node.probability) }">
          {{ node.probability }}%
        </span>
      </div>

      <div class="ecg-node-label">{{ node.label }}</div>

      <div class="ecg-node-bottom">
        <span class="ecg-horizon">~{{ node.horizonMonths }}м</span>
        <span v-if="node.agentVotes?.length" class="ecg-voted">
          <i class="pi pi-comments"></i> {{ node.agentVotes.length }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { CHAIN_META } from '@/composables/useEventChain.js'

// ── Props / Emits ──────────────────────────────────────────────────────────────
const props = defineProps({
  nodes:      { type: Array,  default: () => [] },
  selectedId: { type: String, default: null },
  activePath: { type: String, default: 'all' },
})
defineEmits(['select'])

// ── Константы ──────────────────────────────────────────────────────────────────
const NODE_W   = 134
const NODE_H   = 64
const COL_W    = 178  // ширина колонки (включая gap)
const ROW_H    = 84   // высота строки (включая gap)
const HEADER_H = 32   // высота полосы-заголовка
const PAD_X    = 20   // левый отступ первой колонки
const PAD_Y    = 10   // отступ под заголовком

// Временны́е полосы
const BANDS_DEF = [
  { min: 0,  max: 3,        label: '0–3 мес' },
  { min: 4,  max: 9,        label: '4–9 мес' },
  { min: 10, max: 18,       label: '10–18 мес' },
  { min: 19, max: 30,       label: '19–30 мес' },
  { min: 31, max: Infinity, label: '31+ мес' },
]

const PATH_COLORS = {
  all:         'var(--p-text-muted-color)',
  optimistic:  'var(--fst-green)',
  base:        'var(--fst-blue)',
  pessimistic: 'var(--fst-red)',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function pathColor(pid) { return PATH_COLORS[pid] || 'var(--p-text-muted-color)' }
function probColor(p)   {
  if (p >= 70) return 'var(--fst-green)'
  if (p >= 40) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}
function chainColor(c) { return CHAIN_META[c]?.color || 'var(--p-text-muted-color)' }
function chainLabel(c) { return CHAIN_META[c]?.label || c }

function isDimmed(node) {
  if (props.activePath === 'all') return false
  return node.path !== props.activePath && node.path !== 'all'
}
function edgeOpacity(edge) {
  if (props.activePath === 'all') return 0.5
  return (edge.pathId === props.activePath || edge.pathId === 'all') ? 0.7 : 0.1
}

// ── Layout computation ─────────────────────────────────────────────────────────
const layout = computed(() => {
  const nodes = props.nodes
  if (!nodes.length) return { nodes: [], edges: [], activeBands: [], totalW: 400, totalH: 200 }

  // 1. Назначаем каждой ноде индекс полосы (band index)
  function getBandIdx(months) {
    const idx = BANDS_DEF.findIndex(b => months >= b.min && months <= b.max)
    return idx >= 0 ? idx : BANDS_DEF.length - 1
  }

  // 2. Группируем по полосам
  const bandGroups = {}
  for (const node of nodes) {
    const bi = getBandIdx(node.horizonMonths)
    if (!bandGroups[bi]) bandGroups[bi] = []
    bandGroups[bi].push(node)
  }

  // 3. Сжимаем: только занятые полосы → свои колонки
  const usedBandIndices = Object.keys(bandGroups).map(Number).sort((a, b) => a - b)
  const bandToCol = {}
  usedBandIndices.forEach((bi, ci) => { bandToCol[bi] = ci })

  // 4. Вычисляем позиции нод
  const layoutNodes = nodes.map(node => {
    const bi  = getBandIdx(node.horizonMonths)
    const col = bandToCol[bi]
    const row = bandGroups[bi].indexOf(node)
    return {
      ...node,
      x: PAD_X + col * COL_W,
      y: HEADER_H + PAD_Y + row * ROW_H,
      col,
      row,
    }
  })

  // 5. Вычисляем рёбра из preconditions
  const byTypeId = {}
  for (const n of layoutNodes) {
    if (n.eventTypeId) byTypeId[n.eventTypeId] = n
  }

  const edges = []
  for (const node of layoutNodes) {
    for (const preType of (node.preconditions || [])) {
      const src = byTypeId[preType]
      if (!src) continue

      const x1 = src.x + NODE_W
      const y1 = src.y + NODE_H / 2
      const x2 = node.x
      const y2 = node.y + NODE_H / 2
      const dx = (x2 - x1) * 0.45

      edges.push({
        id:     `${src.id}→${node.id}`,
        pathId: node.path,
        color:  pathColor(node.path),
        x1, y1, x2, y2,
        d: `M ${x1},${y1} C ${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`,
      })
    }
  }

  // 6. Размеры canvas
  const cols    = usedBandIndices.length
  const maxRows = Math.max(...Object.values(bandGroups).map(g => g.length))
  const totalW  = PAD_X * 2 + cols * COL_W
  const totalH  = HEADER_H + PAD_Y + maxRows * ROW_H + 16

  // 7. Мета полос для заголовков
  const activeBands = usedBandIndices.map((bi, ci) => ({
    col:    ci,
    label:  BANDS_DEF[bi]?.label || '…',
    labelX: PAD_X + ci * COL_W,
    sepX:   PAD_X + ci * COL_W - 1,
  }))

  return { nodes: layoutNodes, edges, activeBands, totalW, totalH }
})

// ── Стрелочки на концах рёбер ─────────────────────────────────────────────────
function arrowPoints(edge) {
  const { x2, y2 } = edge
  const size = 5
  return `${x2},${y2} ${x2 - size * 1.8},${y2 - size} ${x2 - size * 1.8},${y2 + size}`
}
</script>

<style scoped>
.ecg-root {
  position: relative;
  overflow-x: auto;
  overflow-y: visible;
}

/* Полоса заголовков */
.ecg-band-row {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 32px;
  pointer-events: none;
}
.ecg-band-header {
  position: absolute;
  top: 0;
  height: 32px;
  display: flex;
  align-items: center;
  padding-left: 8px;
}
.ecg-band-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-text-muted-color);
}

/* Разделители */
.ecg-band-sep {
  position: absolute;
  top: 0; bottom: 0;
  width: 1px;
  background: var(--p-content-border-color);
  pointer-events: none;
}

/* SVG */
.ecg-svg {
  position: absolute;
  top: 0; left: 0;
  pointer-events: none;
}
.ecg-edge { transition: opacity 0.2s; }

/* Ноды */
.ecg-node {
  position: absolute;
  background: var(--p-surface-card);
  border: 1.5px solid var(--p-content-border-color);
  border-left-width: 3px;
  border-radius: 9px;
  padding: 8px 9px 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.15s;
  box-sizing: border-box;
}
.ecg-node:hover { background: var(--p-surface-ground); }
.ecg-node.selected {
  box-shadow: 0 0 0 2px var(--p-primary-color);
  z-index: 2;
}
.ecg-node.dimmed { opacity: 0.25; }

.ecg-node-top {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ecg-node-icon { font-size: 0.8rem; flex-shrink: 0; }
.ecg-chain-badge {
  font-size: 0.55rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 3px;
  padding: 1px 4px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ecg-prob {
  font-size: 0.68rem;
  font-weight: 700;
  flex-shrink: 0;
  margin-left: auto;
}

.ecg-node-label {
  font-size: 0.71rem;
  font-weight: 600;
  color: var(--p-text-color);
  line-height: 1.3;
}

.ecg-node-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.ecg-horizon {
  font-size: 0.6rem;
  color: var(--p-text-muted-color);
}
.ecg-voted {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.6rem;
  color: var(--p-primary-color);
}
.ecg-voted i { font-size: 0.6rem; }
</style>
