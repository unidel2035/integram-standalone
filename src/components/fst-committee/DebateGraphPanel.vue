<template>
  <div :class="['dgp-root', { 'dgp-root--fs': isFullscreen }]" ref="rootEl">

    <!-- Toolbar -->
    <div class="dgp-toolbar">
      <span class="dgp-title">
        <i class="pi pi-sitemap"></i> Граф событий ИК
      </span>

      <!-- Layout -->
      <div class="dgp-btn-group">
        <button v-for="l in LAYOUTS.filter(l => l.label)" :key="l.id"
          :class="['dgp-btn', { 'dgp-btn--active': activeLayout === l.id }]"
          @click="applyLayout(l.id)" :title="l.desc">
          <i :class="l.icon"></i> {{ l.label }}
        </button>
      </div>

      <!-- Filter -->
      <div class="dgp-btn-group">
        <button v-for="f in FILTERS" :key="f.id"
          :class="['dgp-btn', { 'dgp-btn--active': activeFilter === f.id }]"
          @click="setFilter(f.id)" :title="f.desc">
          {{ f.label }}
        </button>
      </div>

      <!-- Themes -->
      <div class="dgp-btn-group dgp-themes">
        <button v-for="th in THEMES" :key="th.id"
          :class="['dgp-btn', 'dgp-theme-btn', { 'dgp-btn--active': activeTheme === th.id }]"
          @click="applyTheme(th.id)" :title="th.label">
          <span class="dgp-theme-dot" :style="{ background: th.bg }"></span>
          {{ th.label }}
        </button>
      </div>

      <button class="dgp-btn" @click="fitGraph" title="Уместить всё">
        <i class="pi pi-expand"></i>
      </button>
      <button class="dgp-btn" @click="exportPng" title="Скачать PNG">
        <i class="pi pi-download"></i>
      </button>
      <button class="dgp-btn" :class="{ 'dgp-btn--active': isFullscreen }"
        @click="toggleFullscreen" :title="isFullscreen ? 'Свернуть (Esc)' : 'На весь экран'">
        <i :class="isFullscreen ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"></i>
        {{ isFullscreen ? 'Свернуть' : 'На весь экран' }}
      </button>
    </div>

    <!-- Legend -->
    <div class="dgp-legend">
      <span v-for="t in NODE_TYPE_LEGEND" :key="t.id" class="dgp-leg-item">
        <span class="dgp-leg-shape" :style="{ background: t.color, borderRadius: t.round ? '50%' : '3px' }"></span>
        {{ t.label }}
      </span>
      <span class="dgp-leg-sep"></span>
      <span v-for="e in EDGE_TYPE_LEGEND" :key="e.id" class="dgp-leg-item">
        <span class="dgp-leg-line" :style="{ background: e.color, opacity: e.dashed ? 0.5 : 1 }"></span>
        {{ e.label }}
      </span>
    </div>

    <!-- Canvas -->
    <div class="dgp-cy" ref="cyEl" :style="{ background: currentTheme.bg }"></div>

    <!-- Hover label (lightweight, follows node) -->
    <div v-if="hoverLabel" class="dgp-hover-label"
      :style="{ left: hoverLabel.x + 'px', top: hoverLabel.y + 'px' }">
      <span class="dgp-hl-dot" :style="{ background: hoverLabel.color }"></span>
      <span class="dgp-hl-name" :style="{ color: hoverLabel.color }">{{ hoverLabel.name }}</span>
      <span class="dgp-hl-type">{{ hoverLabel.typeLabel }}</span>
      <span v-if="hoverLabel.sub" class="dgp-hl-sub">{{ hoverLabel.sub }}</span>
    </div>

    <!-- Modal (left-click on node) -->
    <Dialog v-model:visible="modalVisible" :header="modal?.name || ''" modal
      :style="{ width: '480px', maxWidth: '95vw' }"
      :pt="{ header: { style: { borderBottom: modal ? '3px solid ' + modal.color : 'none', paddingBottom: '10px' } } }">
      <template v-if="modal">
        <div class="dgp-modal-meta">
          <span class="dgp-modal-type">{{ modal.typeLabel }}</span>
          <span v-if="modal.phase" class="dgp-modal-tag" style="background:#42a5f522;color:#42a5f5">{{ modal.phase }}</span>
          <span v-for="tag in modal.tags" :key="tag.text"
            class="dgp-modal-tag" :style="{ background: tag.color + '22', color: tag.color }">
            {{ tag.text }}
          </span>
        </div>
        <p v-if="modal.text" class="dgp-modal-text">{{ modal.text }}</p>
        <p v-else class="dgp-modal-empty">Нет дополнительной информации</p>
      </template>
    </Dialog>

    <!-- Stats -->
    <div class="dgp-stats">
      <span>Узлов: <b>{{ nodeCount }}</b></span>
      <span>Связей: <b>{{ edgeCount }}</b></span>
      <span>Аргументов: <b>{{ argCount }}</b></span>
      <span v-if="props.session?.phase">Фаза: <b>{{ PHASES[props.session.phase]?.label }}</b></span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import Dialog from 'primevue/dialog'
import cytoscape from 'cytoscape'
import dagre from 'cytoscape-dagre'
import fcose from 'cytoscape-fcose'
import cola from 'cytoscape-cola'
import { PHASES, VERDICTS } from './FstCommitteeConfig.js'
import { agents } from './agentProvider.js'

cytoscape.use(dagre)
cytoscape.use(fcose)
cytoscape.use(cola)

const props = defineProps({
  session: { type: Object, default: null },
})

// ── Layout configs ─────────────────────────────────────────────
const LAYOUTS = [
  {
    id: 'dagre', label: 'Поток', icon: 'pi pi-arrow-down', desc: 'Причинный поток сверху вниз',
    options: {
      name: 'dagre', rankDir: 'TB',
      nodeSep: 90, rankSep: 150, edgeSep: 25,
      ranker: 'network-simplex',
      animate: true, animationDuration: 500, padding: 40,
    },
  },
  {
    id: 'dagre-lr', label: 'Временная шкала', icon: 'pi pi-arrow-right', desc: 'Временная ось слева направо',
    options: {
      name: 'dagre', rankDir: 'LR',
      nodeSep: 65, rankSep: 200, edgeSep: 20,
      ranker: 'network-simplex',
      animate: true, animationDuration: 500, padding: 40,
    },
  },
  {
    id: 'fcose', label: 'Силовая', icon: 'pi pi-share-alt', desc: 'Физическая модель — кластеры',
    options: {
      name: 'fcose', animate: true, animationDuration: 800,
      quality: 'proof', randomize: true,
      nodeRepulsion: 22000, idealEdgeLength: 180,
      edgeElasticity: 0.3, numIter: 3000,
      gravity: 0.3, gravityRange: 3.8,
      nodeSeparation: 100, padding: 50,
    },
  },
  {
    id: 'cola', label: 'Cola', icon: 'pi pi-th-large', desc: 'Cola — минимум пересечений',
    options: {
      name: 'cola', animate: true, animationDuration: 600,
      nodeSpacing: 70, edgeLengthVal: 200,
      convergenceThreshold: 0.01,
      avoidOverlap: true, handleDisconnected: true, padding: 50,
    },
  },
  // ── Скрытые layout-пресеты для тем (не показываются в тулбаре) ──
  {
    id: 'metro-cola', label: '', icon: '', desc: '',
    options: {
      // Cola с широким spread — имитирует органичную карту метро
      name: 'cola', animate: true, animationDuration: 800,
      nodeSpacing: 120,      // станции далеко друг от друга
      edgeLengthVal: 300,    // длинные "линии" между станциями
      convergenceThreshold: 0.005,
      avoidOverlap: true, handleDisconnected: true, padding: 60,
      flow: { axis: 'x', minSeparation: 80 }, // предпочитает горизонтальный spread
    },
  },
  {
    id: 'wine-fcose', label: '', icon: '', desc: '',
    options: {
      // fCoSE с мягкими кластерами — органичные группы как в оригинале
      name: 'fcose', animate: true, animationDuration: 1000,
      quality: 'proof', randomize: false,
      nodeRepulsion: 12000,
      idealEdgeLength: 130,
      edgeElasticity: 0.45,
      numIter: 2000,
      gravity: 0.2, gravityRange: 3.5,
      nodeSeparation: 60, padding: 40,
    },
  },
]

// ── Filters ────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all',       label: 'Всё',            desc: 'Все события и связи' },
  { id: 'flow',      label: 'Только поток',   desc: 'Фазы + оркестратор + агенты' },
  { id: 'arguments', label: 'Аргументы',      desc: 'Только дебатные аргументы' },
  { id: 'decisions', label: 'Решения',        desc: 'Голоса и решение' },
]

// ── Visual themes — точные стили из официальных демо Cytoscape.js
const THEMES = [
  {
    id: 'dark',
    label: 'Ночной',
    dot: '#1e293b',
    bg: '#0f1117',
    defaultLayout: 'dagre',
  },
  {
    // Точный стиль fCoSE Gene-Gene: светлый фон, серые узлы с подписями, тонкие цветные рёбра
    id: 'gene',
    label: 'Ген-граф',
    dot: '#e2e8f0',
    bg: '#f1f5f9',
    defaultLayout: 'fcose',
  },
  {
    // Tokyo Railways: тёмный фон, белые точки, толстые цветные линии
    // Layout: cola с органичным spread (имитирует карту метро)
    id: 'metro',
    label: 'Метро',
    dot: '#1a1a2e',
    bg: '#0d0d0d',
    defaultLayout: 'metro-cola',
  },
  {
    // Wine & Cheese: тёплый фон, haystack тонкий, colored nodes
    // Layout: fcose — органичные кластеры как в оригинале
    id: 'wine',
    label: 'Вино',
    dot: '#fdf6e3',
    bg: '#fff8f0',
    defaultLayout: 'wine-fcose',
  },
]

// ── Node type legend ───────────────────────────────────────────
const NODE_TYPE_LEGEND = [
  { id: 'SESSION',    label: 'Сессия',      color: '#ffa726', round: false },
  { id: 'PHASE',      label: 'Фаза',        color: '#42a5f5', round: false },
  { id: 'ORCHESTRATOR', label: 'Оркестратор', color: '#7c3aed', round: false },
  { id: 'AGENT_OP',   label: 'Действие агента', color: '#66bb6a', round: true },
  { id: 'TOOL',       label: 'Инструмент',  color: '#26c6da', round: false },
  { id: 'ARGUMENT',   label: 'Аргумент',    color: '#ef5350', round: true },
  { id: 'VOTE',       label: 'Голос',       color: '#ab47bc', round: true },
  { id: 'DECISION',   label: 'Решение',     color: '#4caf50', round: false },
]

const EDGE_TYPE_LEGEND = [
  { id: 'causal',   label: 'Причинность', color: '#42a5f5', dashed: false },
  { id: 'dispatch', label: 'Диспетч.',    color: '#7c3aed', dashed: false },
  { id: 'response', label: 'Ответ',       color: '#66bb6a', dashed: true },
  { id: 'challenge',label: 'Вызов',       color: '#ef5350', dashed: true },
]

// ── Agent color map ────────────────────────────────────────────
const AGENT_MAP = computed(() => Object.fromEntries(agents.value.map(a => [a.id, a])))

// ── State ──────────────────────────────────────────────────────
const cyEl         = ref(null)
const rootEl       = ref(null)
const isFullscreen = ref(false)
const activeLayout = ref('dagre')
const activeFilter = ref('all')
const activeTheme  = ref('dark')
const hoverLabel   = ref(null)
const detail       = ref(null)   // bottom panel (убираем, оставляем для fallback)
const modal        = ref(null)   // полная информация — левый клик
const modalVisible = ref(false)
const nodeCount    = ref(0)
const edgeCount    = ref(0)
const argCount     = ref(0)

const currentTheme = computed(() => THEMES.find(t => t.id === activeTheme.value) || THEMES[0])

let cy           = null
let expandedNode = null  // узел, увеличенный правым кликом

// ── Build stylesheet from theme ────────────────────────────────
function buildStylesheet(t) {
  // ── TOKYO RAILWAYS (аутентичный стиль) ──────────────────────
  if (t.id === 'metro') {
    return [
      {
        selector: 'node',
        style: {
          'background-color':    '#ffffff',   // белые точки-станции на тёмном фоне
          'border-color':        '#ffffff',
          'border-width':        1,
          'shape':               'ellipse',
          'width':               20, 'height': 20,
          'label':               'data(label)',
          'color':               '#ffffff',
          'font-size':           14,
          'font-weight':         700,
          'text-valign':         'bottom',
          'text-margin-y':       4,
          'text-outline-color':  '#000000',
          'text-outline-width':  3,
          'min-zoomed-font-size': 12,        // подписи только при зуме
          'z-index':             1,
          'transition-property': 'width height border-width',
          'transition-duration': '0.25s',
        },
      },
      {
        selector: 'node[type = "SESSION"], node[type = "DECISION"]',
        style: {
          'width': 36, 'height': 36,
          'background-color': 'data(color)',
          'border-width': 5,
          'font-size': 18,
          'min-zoomed-font-size': 0,
          'color': '#fff',
          'text-outline-color': '#000',
          'text-outline-width': 6,
          'z-index': 999,
        },
      },
      {
        selector: 'node[type = "PHASE"]',
        style: {
          'width': 26, 'height': 26,
          'background-color': 'data(color)',
          'border-width': 3,
          'font-size': 14,
          'min-zoomed-font-size': 10,
          'color': '#fff',
          'text-outline-color': '#00000088',
          'text-outline-width': 3,
        },
      },
      { selector: 'node:selected', style: { 'width': 48, 'height': 48, 'min-zoomed-font-size': 0, 'border-width': 8, 'z-index': 9999 } },
      { selector: 'node.expanded', style: { 'min-zoomed-font-size': 0, 'font-size': 13, 'z-index': 9999, 'border-width': 6, 'border-color': '#ff6600' } },
      { selector: 'node.new-node', style: { 'border-color': '#ff6600', 'border-width': 6 } },
      { selector: 'node.faded',    style: { 'opacity': 0.15 } },
      {
        selector: 'edge',
        style: {
          'curve-style':           'haystack',
          'haystack-radius':       0,
          'width':                 18,
          'line-color':            'data(color)',
          'opacity':               0.5,
          'label':                 'data(label)',
          'font-size':             7,
          'color':                 '#fff',
          'min-zoomed-font-size':  28,        // подписи рёбер только при сильном зуме
          'z-index':               0,
          'overlay-opacity':       0,
        },
      },
      { selector: 'edge[relType = "phase"]',   style: { 'width': 22, 'opacity': 0.7 } },
      { selector: 'edge[relType = "tool_call"]',style: { 'width': 8,  'opacity': 0.3 } },
      { selector: 'edge.faded',    style: { 'opacity': 0.05 } },
      { selector: 'edge:selected', style: { 'opacity': 1, 'z-index': 9999 } },
    ]
  }

  // ── WINE & CHEESE (аутентичный стиль) ───────────────────────
  if (t.id === 'wine') {
    return [
      {
        selector: 'node',
        style: {
          'width':                40, 'height': 40,
          'background-color':     'data(color)',
          'shape':                'ellipse',
          'label':                'data(label)',
          'font-size':            9,
          'font-weight':          'bold',
          'min-zoomed-font-size': 4,
          'text-wrap':            'wrap',
          'text-max-width':       50,
          'text-valign':          'center',
          'text-halign':          'center',
          'color':                '#000',
          'text-outline-width':   2,
          'text-outline-color':   '#ffffff',
          'text-outline-opacity': 1,
          'overlay-color':        '#fff',
          'transition-property':  'width height opacity',
          'transition-duration':  '0.3s',
        },
      },
      { selector: 'node[type = "SESSION"]',   style: { 'width': 60, 'height': 60, 'font-size': 11 } },
      { selector: 'node[type = "DECISION"]',  style: { 'width': 70, 'height': 70, 'font-size': 13, 'text-outline-width': 3 } },
      { selector: 'node[type = "ARGUMENT"]',  style: { 'width': 50, 'height': 50 } },
      { selector: 'node[type = "TOOL"]',      style: { 'background-color': '#FACD37', 'width': 30, 'height': 30, 'opacity': 0.7 } },
      { selector: 'node.highlighted',         style: { 'min-zoomed-font-size': 0, 'z-index': 9999 } },
      { selector: 'node.expanded',            style: { 'min-zoomed-font-size': 0, 'font-size': 11, 'z-index': 9999, 'text-outline-color': '#ff6600', 'text-outline-width': 4 } },
      { selector: 'node.new-node',            style: { 'text-outline-color': '#ff6600', 'text-outline-width': 5 } },
      { selector: 'node.faded',               style: { 'opacity': 0.08 } },
      { selector: 'node:selected',            style: { 'text-outline-width': 4, 'z-index': 9999 } },
      {
        selector: 'edge',
        style: {
          'curve-style':     'haystack',
          'haystack-radius': 0,
          'opacity':         0.333,
          'width':           2,
          'z-index':         0,
          'overlay-opacity': 0,
          'events':          'no',
          'line-color':      'data(color)',
        },
      },
      { selector: 'edge[relType = "dispatches"]', style: { 'line-color': '#FACD37', 'opacity': 0.666, 'z-index': 9, 'width': 4 } },
      { selector: 'edge[relType = "phase"]',      style: { 'width': 3, 'opacity': 0.5 } },
      { selector: 'edge.highlighted',             style: { 'opacity': 0.8, 'width': 4, 'z-index': 9999, 'events': 'yes' } },
      { selector: 'edge.faded',                   style: { 'opacity': 0.06 } },
    ]
  }

  // ── GENE-GENE fCoSE (точный стиль с демо js.cytoscape.org) ──
  // Светлый фон, тёмно-серые узлы с подписями, тонкие полупрозрачные цветные рёбра
  if (t.id === 'gene') {
    return [
      {
        selector: 'node',
        style: {
          'width':               'mapData(size, 20, 60, 30, 60)',
          'height':              'mapData(size, 20, 60, 30, 60)',
          'background-color':    '#4a5568',     // тёмно-серый как в оригинале
          'border-width':        0,
          'shape':               'ellipse',
          'label':               'data(label)',
          'font-size':           11,
          'font-weight':         'bold',
          'color':               '#ffffff',
          'text-valign':         'center',
          'text-halign':         'center',
          'text-wrap':           'wrap',
          'text-max-width':      '70px',
          'min-zoomed-font-size': 5,
          'transition-property': 'width height opacity',
          'transition-duration': '0.35s',
        },
      },
      // Ключевые узлы — крупнее и цветные (как PCNA в оригинале)
      { selector: 'node[type = "SESSION"]',    style: { 'background-color': '#2d3748', 'width': 64, 'height': 64 } },
      { selector: 'node[type = "PHASE"]',      style: { 'background-color': '#4a5568', 'width': 48, 'height': 48 } },
      { selector: 'node[type = "ORCHESTRATOR"]',style: { 'background-color': '#553c9a', 'width': 44, 'height': 44 } },
      { selector: 'node[type = "ARGUMENT"]',   style: { 'background-color': 'data(color)', 'width': 38, 'height': 38 } },
      { selector: 'node[type = "DECISION"]',   style: { 'background-color': 'data(color)', 'width': 70, 'height': 70, 'font-size': 14 } },
      { selector: 'node[type = "TOOL"]',       style: { 'background-color': '#718096', 'width': 28, 'height': 28, 'font-size': 9 } },
      { selector: 'node.expanded',             style: { 'min-zoomed-font-size': 0, 'font-size': 12, 'z-index': 9999, 'border-width': 4, 'border-color': '#553c9a' } },
      { selector: 'node.new-node',             style: { 'background-color': 'data(color)', 'border-width': 3, 'border-color': '#553c9a' } },
      { selector: 'node:selected',             style: { 'border-width': 4, 'border-color': '#553c9a' } },
      { selector: 'node.faded',                style: { 'opacity': 0.12 } },
      {
        selector: 'edge',
        style: {
          'curve-style':     'haystack',
          'haystack-radius': 0,
          'width':           1.5,
          'line-color':      'data(color)',
          'opacity':         0.4,             // полупрозрачные как в оригинале
          'z-index':         0,
          'overlay-opacity': 0,
          'events':          'no',
        },
      },
      { selector: 'edge[relType = "dispatches"]',   style: { 'width': 2.5, 'opacity': 0.65 } },
      { selector: 'edge[relType = "isResponseTo"]', style: { 'width': 2,   'opacity': 0.55 } },
      { selector: 'edge[relType = "challenges"]',   style: { 'width': 2,   'opacity': 0.60 } },
      { selector: 'edge[relType = "phase"]',        style: { 'width': 2,   'opacity': 0.35 } },
      { selector: 'edge.highlighted',               style: { 'opacity': 0.9, 'width': 3, 'events': 'yes' } },
      { selector: 'edge.faded',                     style: { 'opacity': 0.04 } },
    ]
  }

  // ── DARK (default — дуговые связи) ──────────────────────────
  return [
    {
      selector: 'node',
      style: {
        'width':                 'data(size)',
        'height':                'data(size)',
        'background-color':      'data(color)',
        'background-opacity':    0.88,
        'border-color':          'data(color)',
        'border-width':          2,
        'shape':                 'data(shape)',
        'label':                 'data(label)',
        'font-size':             11,
        'font-weight':           700,
        'color':                 '#ffffff',
        'text-valign':           'center',
        'text-halign':           'center',
        'text-wrap':             'wrap',
        'text-max-width':        '80px',
        'min-zoomed-font-size':  10,   // текст исчезает при отдалении
        'transition-property':   'background-opacity, width, height',
        'transition-duration':   '0.25s',
      },
    },
    { selector: 'node[type = "SESSION"]',      style: { 'border-width': 3, 'font-size': 12, 'background-opacity': 1, 'min-zoomed-font-size': 8 } },
    { selector: 'node[type = "PHASE"]',        style: { 'background-opacity': 0.8, 'border-width': 2.5 } },
    { selector: 'node[type = "ORCHESTRATOR"]', style: { 'border-style': 'double', 'border-width': 3 } },
    { selector: 'node[type = "TOOL"]',         style: { 'background-opacity': 0.55, 'border-style': 'dashed', 'border-width': 1.5, 'font-size': 8, 'color': '#cbd5e1' } },
    { selector: 'node[type = "DECISION"]',     style: { 'border-width': 3.5, 'background-opacity': 1, 'font-size': 13, 'min-zoomed-font-size': 6 } },
    { selector: 'node[?aiGenerated]',          style: { 'border-style': 'double', 'border-width': 4 } },
    { selector: 'node.new-node',               style: { 'border-color': '#ffffff', 'border-width': 5, 'background-opacity': 1 } },
    { selector: 'node:selected',               style: { 'border-width': 4, 'border-color': '#ffffff', 'background-opacity': 1 } },
    // Правый клик: узел развёрнут — текст всегда виден
    { selector: 'node.expanded',               style: { 'min-zoomed-font-size': 0, 'font-size': 13, 'z-index': 9999, 'background-opacity': 1, 'border-width': 4, 'border-color': '#ffffff' } },
    { selector: 'node.faded',                  style: { 'opacity': 0.10 } },
    {
      selector: 'edge',
      style: {
        'width':                    1.5,
        'line-color':               'data(color)',
        'target-arrow-color':       'data(color)',
        'target-arrow-shape':       'triangle',
        'curve-style':              'unbundled-bezier',
        'control-point-distances':  'data(cpDist)',
        'control-point-weights':    0.5,
        'arrow-scale':              0.8,
        'opacity':                  0.80,
        'label':                    'data(label)',
        'font-size':                8,
        'color':                    '#64748b',
        'text-background-opacity':  0.85,
        'text-background-color':    '#0f1117',
        'text-background-padding':  '2px',
      },
    },
    { selector: 'edge[?dashed]',                style: { 'line-style': 'dashed', 'line-dash-pattern': [6, 3] } },
    { selector: 'edge[relType = "phase"]',      style: { 'width': 2.5, 'opacity': 0.55 } },
    { selector: 'edge[relType = "dispatches"]', style: { 'width': 2,   'opacity': 0.9 } },
    { selector: 'edge[relType = "tool_call"]',  style: { 'width': 1,   'opacity': 0.5 } },
    { selector: 'edge[relType = "contributes"]',style: { 'width': 1.5, 'opacity': 0.4 } },
    { selector: 'edge.faded',                   style: { 'opacity': 0.04 } },
    { selector: 'edge:selected',                style: { 'width': 3, 'opacity': 1 } },
  ]
}

// ── Fullscreen ─────────────────────────────────────────────────
async function toggleFullscreen() {
  // Try native Fullscreen API first
  if (!isFullscreen.value) {
    try {
      await rootEl.value?.requestFullscreen()
      return  // onFullscreenChange will set isFullscreen
    } catch {
      // API blocked (iframe / browser policy) → CSS fallback
    }
  } else {
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); return } catch {}
    }
  }
  // CSS fallback toggle
  isFullscreen.value = !isFullscreen.value
  nextTick(() => { cy?.resize(); cy?.fit(undefined, 40) })
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
  nextTick(() => { cy?.resize(); cy?.fit(undefined, 40) })
}

function onKeydown(e) {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false
    nextTick(() => { cy?.resize(); cy?.fit(undefined, 40) })
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('keydown', onKeydown)
  cy?.destroy()
})

// ── Build event-driven graph ───────────────────────────────────
function buildElements() {
  if (!props.session) return { nodes: [], edges: [] }

  const session  = props.session
  const events   = session.events   || []
  const args     = session.arguments || []
  const votes    = session.votes    || []
  const decision = session.decision
  const filter   = activeFilter.value

  const nodes = []
  const edges = []
  const seen  = new Set()

  function addNode(id, data) {
    if (seen.has(id)) return
    seen.add(id)
    nodes.push({ data: { id, ...data } })
  }

  // track parallel edge counts for arc offsets
  const pairCount = {}
  function addEdge(source, target, data = {}) {
    if (!seen.has(source) || !seen.has(target)) return
    const pairKey = `${source}|${target}`
    const revKey  = `${target}|${source}`
    pairCount[pairKey] = (pairCount[pairKey] || 0) + 1
    const n = pairCount[pairKey]
    // Alternate arc direction: 1→+50, 2→-50, 3→+90, 4→-90 …
    const sign = n % 2 === 0 ? -1 : 1
    const dist = sign * (50 + Math.floor((n - 1) / 2) * 40)
    // Reverse parallel edges also get offset
    const hasReverse = (pairCount[revKey] || 0) > 0
    const cpDist = hasReverse ? dist + 30 : dist
    const id = `e_${source}__${target}__${data.relType || n}`
    edges.push({ data: { id, source, target, cpDist, ...data } })
  }

  // ── SESSION START ────────────────────────────────────────────
  if (filter !== 'arguments' && filter !== 'decisions') {
    addNode('session_start', {
      label:     'Сессия ИК',
      type:      'SESSION',
      color:     '#ffa726',
      size:      52,
      weight:    100,
      shape:     'roundrectangle',
      project:   session.project?.title || '',
    })
  }

  // ── PHASES ───────────────────────────────────────────────────
  const phaseTransitions = events.filter(e => e.type === 'PhaseTransitioned')
  let prevId = 'session_start'

  for (const ev of phaseTransitions) {
    const phase = ev.nextPhase
    const phaseId = `phase_${phase}`
    const phInfo = PHASES[phase] || { label: phase, color: '#888' }

    if (filter === 'all' || filter === 'flow' || filter === 'decisions' && ['VOTING','SYNTHESIS','HUMAN_APPROVAL','CONCLUDED'].includes(phase)) {
      addNode(phaseId, {
        label:  phInfo.label,
        type:   'PHASE',
        phase,
        color:  phInfo.color,
        size:   42,
        weight: 80,
        shape:  'roundrectangle',
      })
      if (filter !== 'decisions' || phase === 'VOTING') {
        addEdge(prevId, phaseId, { label: 'фаза', color: '#334155', relType: 'phase', dashed: false })
      }
    }
    prevId = phaseId
  }

  // ── ORCHESTRATOR per action-phase ────────────────────────────
  if (filter === 'all' || filter === 'flow') {
    const actionPhases = ['PRIMARY_POSITIONS', 'CROSS_DEBATE', 'FINAL_POSITIONS']
    for (const phase of actionPhases) {
      const phaseId = `phase_${phase}`
      if (!seen.has(phaseId)) continue
      const orchId = `orch_${phase}`
      addNode(orchId, {
        label:  'Орк.',
        type:   'ORCHESTRATOR',
        color:  '#7c3aed',
        size:   36,
        weight: 70,
        shape:  'hexagon',
        phaseLabel: PHASES[phase]?.label || phase,
      })
      addEdge(phaseId, orchId, { label: 'управляет', color: '#7c3aed', relType: 'orchestrates', dashed: false })
    }

    // LOADING: parallel analysis
    if (seen.has('phase_LOADING')) {
      const analysisStarted = events.filter(e => e.type === 'AgentAnalysisStarted')
      for (const ev of analysisStarted) {
        const agent = AGENT_MAP.value[ev.agentId]
        if (!agent) continue
        const nodeId = `analysis_${ev.agentId}`
        addNode(nodeId, {
          label:     '',
          type:      'AGENT_OP',
          agentId:   ev.agentId,
          agentName: agent.name,
          color:     agent.color,
          size:      30,
          weight:    50,
          shape:     'ellipse',
          typeLabel: 'Анализ документов',
        })
        addEdge('phase_LOADING', nodeId, { label: 'анализирует', color: agent.color + 'aa', relType: 'dispatches', dashed: true })
      }

      // Tool calls from loading: KAG context, portfolio overlap
      const hasPortfolio = events.some(e => e.type === 'PortfolioOverlapDetected')
      const hasTagged    = events.some(e => e.type === 'SessionTagged')
      if (hasPortfolio || hasTagged) {
        addNode('tool_portfolio', {
          label:  'Портфель',
          type:   'TOOL',
          color:  '#26c6da',
          size:   28,
          shape:  'roundrectangle',
        })
        addEdge('phase_LOADING', 'tool_portfolio', { label: 'поиск', color: '#26c6da88', relType: 'tool_call', dashed: true })
      }
      if (hasTagged) {
        addNode('tool_kag', {
          label:  'KAG',
          type:   'TOOL',
          color:  '#8b5cf6',
          size:   28,
          shape:  'roundrectangle',
        })
        addEdge('phase_LOADING', 'tool_kag', { label: 'запрос', color: '#8b5cf688', relType: 'tool_call', dashed: true })
      }
    }

    // ── AgentToolsUsed events (agentic loop tool calls) ────────────────────
    if (filter === 'all') {
      const toolUsedEvts = events.filter(e => e.type === 'AgentToolsUsed')
      for (const ev of toolUsedEvts) {
        const agent = AGENT_MAP.value[ev.agentId]
        if (!agent) continue
        for (const toolName of (ev.tools || [])) {
          const tId = `agtool_${ev.agentId}_${toolName}`
          const toolColors = {
            read_room:         '#42a5f5',
            query_data:        '#26c6da',
            calc_irr:          '#66bb6a',
            calc_npv:          '#66bb6a',
            calc_monte_carlo:  '#ab47bc',
            calc_power_score:  '#ffa726',
            calc_bayesian:     '#8b5cf6',
            search_precedents: '#ef5350',
          }
          const tColor = toolColors[toolName] || '#64748b'
          if (!seen.has(tId)) {
            addNode(tId, {
              label: toolName.replace('calc_', '').replace('_', '\n'),
              type: 'TOOL', color: tColor, size: 22, shape: 'roundrectangle',
              typeLabel: `Инструмент: ${toolName}`,
              text: `Вызван агентом ${agent.name} (${ev.iterations || 1} итераций)`,
            })
          }
          // Connect: ищем родителя в порядке приоритета по всем фазам
          const analysisId = `analysis_${ev.agentId}`
          let parentForTool = null
          if (seen.has(analysisId)) {
            parentForTool = analysisId
          } else {
            for (const ph of ['PRIMARY_POSITIONS','CROSS_DEBATE','FINAL_POSITIONS','SYNTHESIS','VOTING']) {
              if (seen.has(`orch_${ph}`))  { parentForTool = `orch_${ph}`; break }
              if (seen.has(`phase_${ph}`)) { parentForTool = `phase_${ph}`; break }
            }
          }
          if (parentForTool) {
            addEdge(parentForTool, tId, { label: '', color: tColor + '88', relType: 'tool_call', dashed: true })
          }
        }
      }
    }

    // Scoring calculator (triggered at VOTING)
    if (seen.has('phase_VOTING')) {
      addNode('tool_scoring', {
        label:  'Скоринг',
        type:   'TOOL',
        color:  '#26c6da',
        size:   28,
        shape:  'roundrectangle',
      })
      addEdge('phase_VOTING', 'tool_scoring', { label: 'считает', color: '#26c6da88', relType: 'tool_call', dashed: true })
    }
  }

  // ── ARGUMENTS ────────────────────────────────────────────────
  if (filter !== 'flow' && filter !== 'decisions') {
    const PHASE_FOR_TYPE = {
      OPENING: 'PRIMARY_POSITIONS', CHALLENGE: 'CROSS_DEBATE',
      COUNTER: 'CROSS_DEBATE', SUMMARY: 'FINAL_POSITIONS',
      SYNTHESIS: 'SYNTHESIS', CLOSING: 'SYNTHESIS',
    }
    const TYPE_SHAPE = {
      OPENING: 'ellipse', CHALLENGE: 'diamond', COUNTER: 'pentagon',
      SUMMARY: 'roundrectangle', SYNTHESIS: 'roundrectangle', CLOSING: 'roundrectangle',
    }
    const TYPE_LABEL = {
      OPENING: 'Позиция', CHALLENGE: 'Вызов', COUNTER: 'Контр.',
      SUMMARY: 'Итог', SYNTHESIS: 'Синтез', CLOSING: 'Заключение',
    }

    // In arguments-only filter: add minimal skeleton so every arg has a causal parent
    if (filter === 'arguments') {
      if (!seen.has('session_start')) {
        addNode('session_start', {
          label: 'Сессия ИК', type: 'SESSION', color: '#ffa726',
          size: 40, shape: 'roundrectangle',
        })
      }
      const neededPhases = new Set(args.map(a => PHASE_FOR_TYPE[a.type] || 'PRIMARY_POSITIONS'))
      for (const ph of neededPhases) {
        const phId = `phase_${ph}`
        if (!seen.has(phId)) {
          const phInfo = PHASES[ph] || { label: ph, color: '#42a5f5' }
          addNode(phId, {
            label: phInfo.label, type: 'PHASE', phase: ph,
            color: phInfo.color, size: 36, shape: 'roundrectangle',
          })
          addEdge('session_start', phId, { label: 'фаза', color: '#33415566', relType: 'phase', dashed: false })
        }
      }
    }

    for (const arg of args) {
      const agent = AGENT_MAP.value[arg.agentId]
      if (!agent) continue
      const conf = arg.confidence || arg.strength || 0.7

      // Orchestrator node for dispatch; fallback to phase node if no orch
      const phase = PHASE_FOR_TYPE[arg.type] || 'PRIMARY_POSITIONS'
      const orchId = `orch_${phase}`
      const phaseNodeId = `phase_${phase}`

      // Determine causal parent: orch > phase node > session root
      let parentForArg = null
      if (seen.has(orchId)) {
        parentForArg = orchId
      } else if (seen.has(phaseNodeId)) {
        parentForArg = phaseNodeId
      } else if (seen.has('session_start')) {
        parentForArg = 'session_start'
      }

      addNode(arg.id, {
        label:       '',
        type:        'ARGUMENT',
        argType:     arg.type,
        agentId:     arg.agentId,
        color:       agent.color,
        size:        Math.max(22, Math.round(conf * 32 + 10)),
        weight:      Math.round(conf * 10),
        shape:       TYPE_SHAPE[arg.type] || 'ellipse',
        typeLabel:   TYPE_LABEL[arg.type] || arg.type,
        text:        arg.text,
        dimension:   arg.dimension || 'general',
        stance:      arg.stance,
        aiGenerated: arg.aiGenerated,
        confidence:  conf,
        model:       arg.model,
      })

      // Causal dispatch edge: parent → argument (always present)
      if (parentForArg) {
        addEdge(parentForArg, arg.id, {
          label: 'слово', color: agent.color + '88',
          relType: 'dispatches', dashed: false,
        })
      }

      // Pipeline tool nodes per argument (integram → llm chain)
      if (filter === 'all' && arg.aiGenerated) {
        const llmId = `llm_${arg.id}`
        addNode(llmId, {
          label:  'LLM',
          type:   'TOOL',
          color:  '#8b5cf6',
          size:   24,
          shape:  'roundrectangle',
        })
        addEdge(seen.has(orchId) ? orchId : `phase_${phase}`, llmId, {
          label: 'вызов LLM', color: '#8b5cf688', relType: 'tool_call', dashed: true,
        })
        addEdge(llmId, arg.id, {
          label: 'ответ', color: '#8b5cf688', relType: 'tool_result', dashed: true,
        })
      }

      // targetArgId reply edge
      if (arg.targetArgId && seen.has(arg.targetArgId)) {
        addEdge(arg.targetArgId, arg.id, {
          label: '↩ ответ', color: '#42a5f5', relType: 'isResponseTo', dashed: true,
        })
      }

      // Relation edges
      for (const rel of (arg.relations || [])) {
        if (seen.has(rel.targetId)) {
          const relColors = {
            challenges: '#ef5350', isResponseTo: '#42a5f5', supports: '#66bb6a',
            contradicts: '#ff7043', synthesizes: '#ab47bc', concedesTo: '#26c6da',
          }
          addEdge(arg.id, rel.targetId, {
            label: relShort(rel.type), color: relColors[rel.type] || '#888',
            relType: rel.type, dashed: true,
          })
        }
      }
    }
  }

  // ── VOTES ────────────────────────────────────────────────────
  if (filter !== 'flow' && filter !== 'arguments') {
    for (const vote of votes) {
      const agent   = AGENT_MAP.value[vote.agentId]
      if (!agent) continue
      const verdict = VERDICTS[vote.verdict]
      const voteId  = `vote_${vote.id}`

      addNode(voteId, {
        label:     '',
        type:      'VOTE',
        verdict:   vote.verdict,
        score:     vote.score,
        agentId:   vote.agentId,
        agentName: agent.name,
        color:     verdict?.color || '#888',
        size:      32,
        shape:     'ellipse',
        rationale: vote.rationale,
      })

      if (seen.has('tool_scoring')) {
        addEdge('tool_scoring', voteId, { label: '', color: '#26c6da44', relType: 'score_to_vote', dashed: true })
      } else if (seen.has('phase_VOTING')) {
        addEdge('phase_VOTING', voteId, { label: 'голос', color: verdict?.color + '88' || '#88888888', relType: 'vote', dashed: false })
      }
    }
  }

  // ── DECISION ─────────────────────────────────────────────────
  if (decision && (filter === 'all' || filter === 'decisions')) {
    addNode('decision', {
      label:          `${decision.aggregatedScore}/100`,
      type:           'DECISION',
      score:          decision.aggregatedScore,
      recommendation: decision.recommendation,
      verdict:        decision.recommendation,
      color:          VERDICTS[decision.recommendation]?.color || '#4caf50',
      size:           58,
      shape:          'roundrectangle',
      conditions:     (decision.conditions || []).slice(0, 2).join('; '),
    })

    // All votes → decision
    for (const vote of votes) {
      addEdge(`vote_${vote.id}`, 'decision', {
        label: '', color: '#ffffff22', relType: 'contributes', dashed: false,
      })
    }

    // Synthesis → decision
    if (seen.has('phase_SYNTHESIS')) {
      addEdge('phase_SYNTHESIS', 'decision', {
        label: 'формирует', color: '#4caf5088', relType: 'synthesizes', dashed: false,
      })
    }
  }

  // ── HUMAN APPROVAL ───────────────────────────────────────────
  if (decision?.humanApproval && (filter === 'all' || filter === 'decisions')) {
    addNode('human_approval', {
      label:  VERDICTS[decision.humanApproval.verdict]?.label || decision.humanApproval.verdict,
      type:   'DECISION',
      color:  '#ffa726',
      size:   42,
      shape:  'roundrectangle',
      typeLabel: 'Решение Председателя',
      text:   decision.humanApproval.comment || '',
    })
    addEdge('decision', 'human_approval', { label: 'утверждает', color: '#ffa72688', relType: 'approval', dashed: false })
  }

  // ── NODE NEGOTIATION ──────────────────────────────────────────
  if (filter === 'all' || filter === 'decisions') {
    const nodeProposedEvts  = events.filter(e => e.type === 'NodeProposed')
    const nodesSynthEvts    = events.filter(e => e.type === 'NodesSynthesized')
    const nodeVoteEvts      = events.filter(e => e.type === 'NodeVoteCast')
    const nodesApprovedEvt  = events.find(e => e.type === 'ContractNodesApproved')

    if (nodeProposedEvts.length > 0 && seen.has('phase_NODE_NEGOTIATION')) {
      // One proposal node per agent (collapsed — many events → one node each)
      const proposersSeen = new Set()
      for (const ev of nodeProposedEvts) {
        const agent = AGENT_MAP.value[ev.agentId]
        if (!agent || proposersSeen.has(ev.agentId)) continue
        proposersSeen.add(ev.agentId)
        const nId = `node_proposal_${ev.agentId}`
        addNode(nId, {
          label: '', type: 'AGENT_OP', agentId: ev.agentId,
          agentName: agent.name,
          color: agent.color, size: 28, shape: 'ellipse',
          typeLabel: 'Предложение нод контракта',
        })
        addEdge('phase_NODE_NEGOTIATION', nId, {
          label: 'предлагает', color: agent.color + '88', relType: 'dispatches', dashed: false,
        })
      }

      // Synthesis of proposals → contract nodes
      if (nodesSynthEvts.length > 0) {
        addNode('nodes_synthesized', {
          label: 'Ноды\nконтракта', type: 'TOOL',
          color: '#26c6da', size: 38, shape: 'roundrectangle',
          typeLabel: 'Синтез нод контракта',
          text: `${(nodesSynthEvts[0]?.nodes || []).length || 3} сценария (кон./баз./опт.)`,
        })
        // All proposals feed into synthesis
        for (const agentId of proposersSeen) {
          addEdge(`node_proposal_${agentId}`, 'nodes_synthesized', {
            label: '', color: '#26c6da44', relType: 'contributes', dashed: true,
          })
        }

        // Node votes (collapsed per round)
        if (nodeVoteEvts.length > 0 && seen.has('phase_NODE_VOTING')) {
          const voteAgentsSeen = new Set()
          for (const ev of nodeVoteEvts) {
            const agent = AGENT_MAP.value[ev.agentId]
            if (!agent || voteAgentsSeen.has(ev.agentId)) continue
            voteAgentsSeen.add(ev.agentId)
            const vId = `node_vote_${ev.agentId}`
            const verdictColor = ev.vote?.verdict === 'ACCEPT' ? '#4caf50' : '#ef5350'
            addNode(vId, {
              label: '', type: 'VOTE', agentId: ev.agentId,
              agentName: agent.name,
              color: verdictColor, size: 26, shape: 'ellipse',
              typeLabel: 'Голос по нодам',
              text: ev.vote?.comment || ev.vote?.verdict || '',
            })
            addEdge('phase_NODE_VOTING', vId, {
              label: '', color: verdictColor + '88', relType: 'vote', dashed: false,
            })
            addEdge('nodes_synthesized', vId, {
              label: '', color: '#26c6da33', relType: 'contributes', dashed: true,
            })
          }
        }

        // Contract approved terminal node
        if (nodesApprovedEvt) {
          const approvedColor = nodesApprovedEvt.unanimous ? '#4caf50' : '#ffa726'
          addNode('contract_approved', {
            label: nodesApprovedEvt.unanimous ? 'Контракт\nединогласно' : 'Контракт\nбольшинством',
            type: 'DECISION', color: approvedColor, size: 52, shape: 'roundrectangle',
            typeLabel: 'Ноды контракта утверждены',
            text: `Раунд ${nodesApprovedEvt.round || 1}, ${nodesApprovedEvt.unanimous ? 'единогласно' : 'большинством голосов'}`,
          })
          addEdge('nodes_synthesized', 'contract_approved', {
            label: 'утверждают', color: approvedColor + '88', relType: 'phase', dashed: false,
          })
          if (seen.has('phase_NODE_VOTING')) {
            addEdge('phase_NODE_VOTING', 'contract_approved', {
              label: 'голосуют', color: approvedColor + '66', relType: 'vote', dashed: false,
            })
          }
        }
      }
    }
  }

  // ── SESSION CONCLUDED ─────────────────────────────────────────
  if (filter === 'all' || filter === 'decisions') {
    const concludedEvt = events.find(e => e.type === 'SessionConcluded')
    if (concludedEvt) {
      const color = VERDICTS[concludedEvt.finalVerdict]?.color || '#4caf50'
      addNode('session_concluded', {
        label: VERDICTS[concludedEvt.finalVerdict]?.label || concludedEvt.finalVerdict || 'Завершено',
        type: 'DECISION', color, size: 60, shape: 'roundrectangle',
        typeLabel: 'Сессия завершена',
        text: `Финальный балл: ${concludedEvt.score}/100`,
      })
      // Connect from the deepest available node in the chain
      const parent = seen.has('contract_approved') ? 'contract_approved'
        : seen.has('human_approval') ? 'human_approval'
        : seen.has('decision') ? 'decision'
        : seen.has('phase_SYNTHESIS') ? 'phase_SYNTHESIS'
        : null
      if (parent) {
        addEdge(parent, 'session_concluded', {
          label: 'завершает', color: color + '88', relType: 'phase', dashed: false,
        })
      }
    }

    // DecisionLinked: external record of decision in knowledge graph
    const linkedEvt = events.find(e => e.type === 'DecisionLinked')
    if (linkedEvt && seen.has('session_concluded')) {
      addNode('decision_linked', {
        label: 'KAG\nRecord', type: 'TOOL', color: '#8b5cf6', size: 28, shape: 'roundrectangle',
        typeLabel: 'Решение сохранено в граф знаний',
        text: `Вердикт: ${linkedEvt.verdict}`,
      })
      addEdge('session_concluded', 'decision_linked', {
        label: 'записывает', color: '#8b5cf688', relType: 'tool_call', dashed: true,
      })
    }
  }

  // ── ГАРАНТИЯ: у каждого узла есть хотя бы одно входящее ребро ──────────────
  // Онтология событий: любое событие имеет причину. Граф всегда DAG.
  {
    const hasIncoming = new Set()
    for (const e of edges) hasIncoming.add(e.data.target)

    // Определяем лучшего "предка по умолчанию" в зависимости от типа узла
    function fallbackParent(nodeData) {
      const t = nodeData.type
      // Инструменты → ищем ближайший оркестратор или фазу
      if (t === 'TOOL') {
        for (const phase of ['PRIMARY_POSITIONS','CROSS_DEBATE','FINAL_POSITIONS','VOTING','SYNTHESIS']) {
          if (seen.has(`orch_${phase}`))  return `orch_${phase}`
          if (seen.has(`phase_${phase}`)) return `phase_${phase}`
        }
      }
      // Аргументы → ищем фазу по типу аргумента
      if (t === 'ARGUMENT') {
        const PHASE_FOR_TYPE = { OPENING:'PRIMARY_POSITIONS', CHALLENGE:'CROSS_DEBATE', COUNTER:'CROSS_DEBATE', SUMMARY:'FINAL_POSITIONS', SYNTHESIS:'SYNTHESIS', CLOSING:'SYNTHESIS' }
        const phase = PHASE_FOR_TYPE[nodeData.argType] || 'PRIMARY_POSITIONS'
        if (seen.has(`orch_${phase}`))  return `orch_${phase}`
        if (seen.has(`phase_${phase}`)) return `phase_${phase}`
      }
      // Голоса → VOTING
      if (t === 'VOTE') {
        if (seen.has('phase_VOTING')) return 'phase_VOTING'
      }
      // AGENT_OP → ближайшая фаза
      if (t === 'AGENT_OP') {
        for (const phase of ['LOADING','PRIMARY_POSITIONS','CROSS_DEBATE','FINAL_POSITIONS']) {
          if (seen.has(`phase_${phase}`)) return `phase_${phase}`
        }
      }
      return seen.has('session_start') ? 'session_start' : null
    }

    for (const node of nodes) {
      const id = node.data.id
      if (id === 'session_start') continue          // корень — без родителя
      if (hasIncoming.has(id)) continue             // уже есть входящее ребро

      const parent = fallbackParent(node.data)
      if (!parent || !seen.has(parent)) continue

      edges.push({ data: {
        id:       `e_fallback_${id}`,
        source:   parent,
        target:   id,
        label:    '←причина',
        color:    '#33415555',
        relType:  'causal_fallback',
        dashed:   true,
        cpDist:   0,
      }})
    }
  }

  argCount.value = args.length
  return { nodes, edges }
}

function relShort(type) {
  const MAP = {
    challenges: 'вызов', isResponseTo: 'ответ', supports: 'поддержка',
    contradicts: 'противоречие', synthesizes: 'синтез', concedesTo: 'признание',
    challengesWarrant: 'атака логики', challengesData: 'атака данных',
  }
  return MAP[type] || type
}


// ── Apply theme (hot-swap styles + suggested layout) ───────────
function applyTheme(id) {
  activeTheme.value = id
  const t = currentTheme.value
  if (!cy) return
  cy.style(buildStylesheet(t)).update()
  // switch to theme's suggested layout automatically
  activeLayout.value = t.defaultLayout
  const opts = LAYOUTS.find(l => l.id === t.defaultLayout)?.options
  if (opts) cy.layout(opts).run()
}

// ── Init Cytoscape ─────────────────────────────────────────────
function initCy() {
  if (!cyEl.value) return
  cy?.destroy()
  hoverLabel.value = null

  const { nodes, edges } = buildElements()

  const layoutOpts = LAYOUTS.find(l => l.id === activeLayout.value)?.options
    || { name: 'dagre', rankDir: 'TB', nodeSep: 90, rankSep: 150 }

  cy = cytoscape({
    container:        cyEl.value,
    elements:         { nodes, edges },
    style:            buildStylesheet(currentTheme.value),
    layout:           layoutOpts,
    minZoom:          0.1,
    maxZoom:          4,
    wheelSensitivity: 0.3,
  })

  nodeCount.value = cy.nodes().length
  edgeCount.value = cy.edges().length

  const AGENT_NAME = { ARGUMENT: 'agentName', VOTE: 'agentName', AGENT_OP: 'agentName' }
  const TYPE_LABEL_MAP = {
    SESSION: 'Сессия', PHASE: 'Фаза', ORCHESTRATOR: 'Оркестратор',
    AGENT_OP: 'Анализ агента', TOOL: 'Инструмент',
    ARGUMENT: 'Аргумент', VOTE: 'Голос', DECISION: 'Решение',
  }
  const STANCE = { APPROVE: 'За', DEFER: 'Отложить', REJECT: 'Против' }

  // Hover → lightweight floating label
  // ── Hover → лёгкий тултип ─────────────────────────────────
  cy.on('mouseover', 'node', e => {
    const node = e.target
    const d    = node.data()
    const pos  = node.renderedPosition()
    const box  = cyEl.value.getBoundingClientRect()

    cy.elements().addClass('faded')
    node.removeClass('faded')
    node.connectedEdges().removeClass('faded')
    node.connectedEdges().connectedNodes().removeClass('faded')

    const name = d.agentName || d.phaseLabel || d.label || d.type
    let sub = null
    if (d.type === 'ARGUMENT') sub = (d.dimension || '') + (d.stance ? ' · ' + STANCE[d.stance] : '')
    if (d.type === 'VOTE')     sub = (d.score ?? '') + '/100'
    if (d.type === 'TOOL')     sub = d.label

    hoverLabel.value = {
      x:         Math.min(pos.x + node.renderedWidth() / 2 + 10, box.width - 190),
      y:         Math.max(pos.y - node.renderedHeight() / 2 - 32, 4),
      color:     d.color,
      name,
      typeLabel: TYPE_LABEL_MAP[d.type] || d.type,
      sub,
    }
  })

  cy.on('mouseout', 'node', () => {
    cy.elements().removeClass('faded')
    hoverLabel.value = null
  })

  // ── Правый клик → узел увеличивается, текст внутри ────────
  cy.on('cxttap', 'node', e => {
    const node = e.target
    const d    = node.data()

    // Свернуть предыдущий
    if (expandedNode && expandedNode.id() !== node.id()) {
      collapseNode(expandedNode)
    }

    if (node.hasClass('expanded')) {
      collapseNode(node)
    } else {
      // Развернуть
      expandedNode = node
      node.addClass('expanded')
      const baseSize  = d.size || 36
      const bigSize   = Math.max(baseSize * 3, 110)
      node.animate(
        { style: { width: bigSize, height: bigSize } },
        { duration: 320, easing: 'spring(200, 15)' }
      )
      // Поднять наверх
      node.style('z-index', 9999)
      // Центрировать экран на узле
      cy.animate({ center: { eles: node } }, { duration: 300 })
    }
  })

  function collapseNode(node) {
    const d = node.data()
    node.removeClass('expanded')
    expandedNode = null
    node.animate(
      { style: { width: d.size || 36, height: d.size || 36 } },
      { duration: 250, easing: 'ease-out-cubic' }
    )
    node.style('z-index', null)
  }

  // ── Левый клик → модальное окно с полной информацией ──────
  cy.on('tap', 'node', e => {
    const d = e.target.data()

    const tags = []
    if (d.aiGenerated)    tags.push({ text: '⚡ AI',          color: '#a78bfa' })
    if (d.dimension)      tags.push({ text: d.dimension,      color: '#64748b' })
    if (d.stance)         tags.push({ text: STANCE[d.stance], color: d.stance === 'APPROVE' ? '#4caf50' : d.stance === 'REJECT' ? '#ef5350' : '#ffa726' })
    if (d.model)          tags.push({ text: d.model.split('/').pop(), color: '#8b5cf6' })
    if (d.score != null)  tags.push({ text: d.score + '/100', color: d.color })
    if (d.verdict)        tags.push({ text: VERDICTS[d.verdict]?.label || d.verdict, color: d.color })
    if (d.confidence)     tags.push({ text: Math.round(d.confidence * 100) + '% уверенность', color: '#94a3b8' })

    modal.value = {
      name:      d.agentName || d.phaseLabel || d.label || d.type,
      typeLabel: TYPE_LABEL_MAP[d.type] || d.type,
      color:     d.color,
      text:      d.text || d.rationale || d.conditions || '',
      tags,
      phase:     d.phase ? (PHASES[d.phase]?.label || d.phase) : null,
      score:     d.score,
      agentId:   d.agentId,
    }
    modalVisible.value = true
    hoverLabel.value   = null
  })

  cy.on('tap', evt => {
    if (evt.target === cy) {
      hoverLabel.value = null
      if (expandedNode) collapseNode(expandedNode)
    }
  })
}

// ── Layout & filter ────────────────────────────────────────────
function applyLayout(id) {
  if (!cy) return
  activeLayout.value = id
  const opts = LAYOUTS.find(l => l.id === id)?.options
  if (opts) cy.layout(opts).run()
}

function setFilter(id) {
  activeFilter.value = id
  detail.value = null
  hoverLabel.value = null
  initCy()
}

function fitGraph() { cy?.fit(undefined, 40) }

function exportPng() {
  if (!cy) return
  const png = cy.png({ scale: 2, bg: '#0f1117', full: true })
  const a = document.createElement('a')
  a.href = png; a.download = 'committee-events.png'; a.click()
}

// ── Incremental update — добавляет только новые узлы/рёбра ────
function updateCy() {
  if (!cy) { initCy(); return }

  const { nodes: allNodes, edges: allEdges } = buildElements()

  const knownNodes = new Set(cy.nodes().map(n => n.id()))
  const knownEdges = new Set(cy.edges().map(e => e.id()))

  const newNodes = allNodes.filter(n => !knownNodes.has(n.data.id))
  const newEdges = allEdges.filter(e => !knownEdges.has(e.data.id))

  if (newNodes.length === 0 && newEdges.length === 0) return

  // Позиционировать новые узлы рядом с родителем
  for (const node of newNodes) {
    const parentEdge = newEdges.find(e => e.data.target === node.data.id)
      || allEdges.find(e => e.data.target === node.data.id)
    const srcId = parentEdge?.data?.source
    if (srcId && cy.getElementById(srcId).length) {
      const p = cy.getElementById(srcId).position()
      node.position = {
        x: p.x + (Math.random() - 0.5) * 100,
        y: p.y + 80 + Math.random() * 40,
      }
    }
  }

  cy.add([...newNodes, ...newEdges])

  // ── Анимация появления новых узлов ──────────────────────────
  const addedEls = cy.collection([
    ...newNodes.map(n => cy.getElementById(n.data.id)),
    ...newEdges.map(e => cy.getElementById(e.data.id)),
  ])

  const addedNodes_cy = addedEls.nodes()
  const theme = currentTheme.value

  if (addedNodes_cy.length) {
    if (theme.id === 'gene') {
      // Нейроны: fade in + pulse
      addedNodes_cy.style({ opacity: 0 })
      addedNodes_cy.animate(
        { style: { opacity: 1 } },
        { duration: 600, easing: 'ease-out-cubic' }
      )
    } else if (theme.id === 'metro') {
      // Станции: появляются маленькими и вырастают
      addedNodes_cy.style({ width: 0, height: 0 })
      addedNodes_cy.animate(
        { style: { width: null, height: null } },  // null = вернуть из stylesheet
        { duration: 400, easing: 'spring(300, 20)' }
      )
    } else {
      // Dark / Wine: fade + scale
      addedNodes_cy.style({ opacity: 0, 'background-opacity': 0 })
      addedNodes_cy.animate(
        { style: { opacity: 1, 'background-opacity': null } },
        { duration: 450, easing: 'ease-out-quart' }
      )
    }

    // Вспышка-хайлайт на новейшем аргументе (самый заметный вау-момент)
    const newestArg = addedNodes_cy.filter('[type = "ARGUMENT"]').last()
    if (newestArg.length) {
      newestArg.addClass('new-node')
      setTimeout(() => newestArg.removeClass('new-node'), 1800)
    } else {
      // Для остальных типов — краткая вспышка на последнем узле
      const lastNode = addedNodes_cy.last()
      lastNode.addClass('new-node')
      setTimeout(() => lastNode.removeClass('new-node'), 1200)
    }
  }

  // Новые рёбра: fade in
  addedEls.edges().style({ opacity: 0 }).animate(
    { style: { opacity: null } },
    { duration: 500, delay: 200, easing: 'ease-out-cubic' }
  )

  // ── Layout с анимацией (для gene — полный пересчёт = граф "живёт") ──
  const baseOpts = LAYOUTS.find(l => l.id === activeLayout.value)?.options || {}
  const layoutOpts = {
    ...baseOpts,
    animate:         true,
    animationDuration: theme.id === 'gene' ? 700 : 400,
    fit:             false,   // сохранить зум/пан
    // fCoSE не принимает fit:false, но randomize:false сохраняет позиции
    ...(theme.id === 'gene' ? { randomize: false, numIter: 1500 } : {}),
  }
  cy.layout(layoutOpts).run()

  nodeCount.value = cy.nodes().length
  edgeCount.value = cy.edges().length
  argCount.value  = cy.nodes('[type = "ARGUMENT"]').length
}

// ── Watch — инкрементально при каждом новом событии ───────────
// _tick гарантированно меняется в handleEvent даже если фаза не изменилась
watch(
  () => props.session?._tick,
  () => nextTick(updateCy),
)
// Fallback: если _tick не используется — следим за длинами массивов
watch([
  () => props.session?.events?.length,
  () => props.session?.arguments?.length,
  () => props.session?.votes?.length,
  () => props.session?.decision,
], () => nextTick(updateCy))

onMounted(() => nextTick(initCy))
</script>

<style scoped>
.dgp-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--p-surface-ground);
  overflow: hidden;
}

.dgp-root:fullscreen,
.dgp-root--fs {
  position: fixed;
  inset: 0;
  z-index: 9999;
  height: 100dvh;
  background: var(--p-surface-ground);
}

/* ── Toolbar ─────────────────────────────────────────────────── */
.dgp-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--p-surface-border);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.dgp-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--p-text-color);
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  margin-right: 4px;
}

.dgp-btn-group {
  display: flex;
  gap: 2px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 6px;
  padding: 2px;
}

.dgp-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  border: none;
  background: none;
  color: var(--p-text-muted-color);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.dgp-btn:hover { background: var(--p-surface-hover); color: var(--p-text-color); }
.dgp-btn--active { background: var(--p-primary-color, #42a5f5); color: #fff; }
.dgp-btn--active:hover { opacity: 0.9; }

/* ── Theme switcher ──────────────────────────────────────────── */
.dgp-themes { gap: 2px; }
.dgp-theme-btn {
  gap: 5px;
  font-size: 11px;
  padding: 3px 10px;
}
.dgp-theme-dot {
  display: inline-block;
  width: 11px; height: 11px;
  border-radius: 50%;
  border: 2px solid var(--p-surface-border);
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2);
}

/* ── Legend ──────────────────────────────────────────────────── */
.dgp-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--p-surface-border);
  flex-shrink: 0;
  flex-wrap: wrap;
  background: var(--p-surface-section, var(--p-surface-card));
}

.dgp-leg-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--p-text-muted-color);
}
.dgp-leg-shape {
  display: inline-block;
  width: 10px; height: 10px;
}
.dgp-leg-line {
  display: inline-block;
  width: 18px; height: 2px;
  border-radius: 1px;
}
.dgp-leg-sep {
  width: 1px; height: 12px;
  background: var(--p-surface-border);
  margin: 0 2px;
}

/* ── Cytoscape ───────────────────────────────────────────────── */
.dgp-cy {
  flex: 1;
  min-height: 0;
}

/* ── Stats ───────────────────────────────────────────────────── */
.dgp-stats {
  display: flex;
  gap: 16px;
  padding: 3px 10px;
  border-top: 1px solid var(--p-surface-border);
  font-size: 10px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}
.dgp-stats b { color: var(--p-text-color); }

/* ── Hover label ─────────────────────────────────────────────── */
.dgp-hover-label {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 6px;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-surface-border);
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  pointer-events: none;
  white-space: nowrap;
  z-index: 100;
  font-size: 11px;
}
.dgp-hl-dot  { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dgp-hl-name { font-weight: 600; }
.dgp-hl-type { color: var(--p-text-muted-color); font-size: 10px; }
.dgp-hl-sub  { color: var(--p-text-muted-color); font-size: 10px; }

/* ── Modal (left-click) ──────────────────────────────────────── */
.dgp-modal-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.dgp-modal-type {
  font-size: 11px;
  color: var(--p-text-muted-color);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.dgp-modal-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}
.dgp-modal-text {
  font-size: 13px;
  line-height: 1.65;
  color: var(--p-text-color);
  margin: 0;
  white-space: pre-wrap;
}
.dgp-modal-empty {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin: 0;
  font-style: italic;
}
</style>
