<template>
  <FstPageLayout
    title="Событийный граф"
    subtitle="Граф событий · Матрица переходов · Бэктест"
    icon="pi pi-share-alt"
  >
    <template #actions>
      <SelectButton v-model="activeTab" :options="tabs" optionLabel="label" optionValue="id" :allowEmpty="false" size="small" />
      <Button v-if="activeTab === 'backtest'" label="Обновить" icon="pi pi-refresh" size="small" severity="secondary"
        @click="loadBacktest" :loading="loading" style="margin-left: 8px" />
    </template>

    <!-- Metrics strip -->
    <div class="eg-metrics fst-metrics-strip">
      <template v-if="activeTab === 'graph'">
        <div class="fst-metric-item">
          <i class="pi pi-circle fst-metric-item-icon"></i>
          <div class="fst-metric-item-val">{{ graphData ? graphData.nodes.length : '—' }}</div>
          <div class="fst-metric-item-label">Узлов</div>
        </div>
        <div class="fst-metric-item">
          <i class="pi pi-arrow-right fst-metric-item-icon"></i>
          <div class="fst-metric-item-val">{{ graphData ? graphData.edges.length : '—' }}</div>
          <div class="fst-metric-item-label">Рёбер</div>
        </div>
        <div class="fst-metric-item">
          <i class="pi pi-bolt fst-metric-item-icon"></i>
          <div class="fst-metric-item-val">{{ graphData ? graphData.nodes.filter(n=>n.type==='event').length : '—' }}</div>
          <div class="fst-metric-item-label">Событий</div>
        </div>
        <div class="fst-metric-item">
          <i class="pi pi-building fst-metric-item-icon"></i>
          <div class="fst-metric-item-val">{{ graphData ? graphData.nodes.filter(n=>n.type==='actor').length : '—' }}</div>
          <div class="fst-metric-item-label">Акторов</div>
        </div>
        <div class="fst-metric-item">
          <i class="pi pi-tag fst-metric-item-icon"></i>
          <div class="fst-metric-item-val">{{ graphData ? graphData.nodes.filter(n=>n.type==='concept').length : '—' }}</div>
          <div class="fst-metric-item-label">Концептов</div>
        </div>
      </template>
      <template v-else>
        <div class="fst-metric-item">
          <i class="pi pi-building fst-metric-item-icon"></i>
          <div class="fst-metric-item-val">{{ data?.sampleSize ?? '—' }}</div>
          <div class="fst-metric-item-label">Компаний</div>
        </div>
        <div class="fst-metric-item">
          <i class="pi pi-check-circle fst-metric-item-icon"></i>
          <div class="fst-metric-item-val" :style="{ color: acc1Color }">
            {{ data ? pct(data.accuracy.top1) : '—' }}
          </div>
          <div class="fst-metric-item-label">Top-1 Accuracy</div>
        </div>
        <div class="fst-metric-item">
          <i class="pi pi-check-circle fst-metric-item-icon"></i>
          <div class="fst-metric-item-val" :style="{ color: acc2Color }">
            {{ data ? pct(data.accuracy.top2) : '—' }}
          </div>
          <div class="fst-metric-item-label">Top-2 Accuracy</div>
        </div>
        <div class="fst-metric-item">
          <i class="pi pi-sort-amount-up fst-metric-item-icon"></i>
          <div class="fst-metric-item-val">{{ data ? data.accuracy.mrr.toFixed(3) : '—' }}</div>
          <div class="fst-metric-item-label">MRR</div>
        </div>
        <div class="fst-metric-item">
          <i class="pi pi-arrow-up fst-metric-item-icon"></i>
          <div class="fst-metric-item-val" style="color: var(--fst-green)">
            {{ data ? '+' + pct(data.accuracy.top1 - data.baseline) : '—' }}
          </div>
          <div class="fst-metric-item-label">Прирост vs baseline</div>
        </div>
      </template>
    </div>

    <!-- TAB: GRAPH -->
    <div v-if="activeTab === 'graph'" class="eg-graph-wrap">
      <!-- Controls -->
      <div class="eg-graph-controls">
        <div class="eg-legend">
          <span v-for="l in legend" :key="l.label" class="eg-legend-item">
            <span class="eg-legend-dot" :style="{ background: l.color }"></span>
            {{ l.label }}
          </span>
        </div>
        <div class="eg-graph-actions">
          <Select v-model="layoutName" :options="layoutOptions" optionLabel="label" optionValue="value"
            placeholder="Расположение" size="small" style="width: 160px" @change="reLayout" />
          <Button icon="pi pi-search-plus"  size="small" severity="secondary" @click="cyZoom(1.3)" v-tooltip="'Zoom +'" />
          <Button icon="pi pi-search-minus" size="small" severity="secondary" @click="cyZoom(0.77)" v-tooltip="'Zoom -'" />
          <Button icon="pi pi-expand"       size="small" severity="secondary" @click="cyFit"         v-tooltip="'Уместить'" />
        </div>
      </div>

      <div ref="cyContainer" class="eg-cy-container">
        <div v-if="graphLoading" class="eg-cy-overlay">
          <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
          <p>Загружаем граф...</p>
        </div>
        <div v-if="!graphLoading && !graphData" class="eg-cy-overlay">
          <i class="pi pi-exclamation-circle" style="font-size: 2rem; color: var(--p-text-muted-color)"></i>
          <p>Нет данных. Запустите пайплайн событий.</p>
        </div>
      </div>

      <!-- Node detail panel -->
      <div v-if="selectedNode" class="eg-node-panel">
        <div class="eg-node-panel-header">
          <span class="eg-type-badge" :style="{ background: nodeTypeColor(selectedNode.type) + '22', color: nodeTypeColor(selectedNode.type) }">
            {{ nodeTypeLabel(selectedNode.type) }}
          </span>
          <button class="eg-node-close" @click="selectedNode = null">×</button>
        </div>
        <div class="eg-node-name">{{ selectedNode.label }}</div>
        <div v-if="selectedNode.data?.date" class="eg-node-field">
          <span class="eg-node-key">Дата:</span> {{ selectedNode.data.date }}
        </div>
        <div v-if="selectedNode.data?.eventTypeLabel" class="eg-node-field">
          <span class="eg-node-key">Тип:</span>
          <span class="eg-type-badge" :style="{ background: typeColor(selectedNode.data.eventTypeLabel) + '22', color: typeColor(selectedNode.data.eventTypeLabel) }">
            {{ selectedNode.data.eventTypeLabel }}
          </span>
        </div>
        <div v-if="selectedNode.data?.effect" class="eg-node-field">
          <span class="eg-node-key">Эффект:</span> {{ selectedNode.data.effect }}
        </div>
        <div v-if="selectedNode.data?.magnitude" class="eg-node-field">
          <span class="eg-node-key">Magnitude:</span> {{ selectedNode.data.magnitude }}
        </div>
        <div v-if="selectedNode.data?.probability" class="eg-node-field">
          <span class="eg-node-key">Вероятность:</span> {{ selectedNode.data.probability }}
        </div>
      </div>
    </div>

    <!-- TAB: BACKTEST -->
    <div v-else-if="activeTab === 'backtest'" class="eg-body" v-show="data">

      <div class="eg-row">
        <!-- Transition Matrix -->
        <div class="page-card eg-card--matrix">
          <div class="eg-section-title">Матрица переходов типов событий</div>
          <div class="eg-matrix-wrap">
            <table class="eg-matrix">
              <thead>
                <tr>
                  <th class="eg-matrix-corner">Предыдущее ↓ / Следующее →</th>
                  <th v-for="t in EVENT_TYPES" :key="t" class="eg-matrix-colhead">{{ shortType(t) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="from in EVENT_TYPES" :key="from">
                  <td class="eg-matrix-rowhead">{{ shortType(from) }}</td>
                  <td v-for="to in EVENT_TYPES" :key="to" class="eg-matrix-cell" :style="cellStyle(from, to)">
                    <span v-if="cellCount(from, to) > 0">{{ cellCount(from, to) }}x</span>
                    <span v-else class="eg-matrix-empty">·</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- By type + interpretation -->
        <div class="eg-col-right">
          <div class="page-card">
            <div class="eg-section-title">Точность по типу предыдущего события</div>
            <table class="eg-type-table">
              <thead>
                <tr><th>Тип</th><th>n</th><th>Top-1</th><th>Top-2</th></tr>
              </thead>
              <tbody>
                <tr v-for="(stat, type) in data?.byType" :key="type">
                  <td>
                    <span class="eg-type-badge" :style="{ background: typeColor(type) + '22', color: typeColor(type) }">{{ type }}</span>
                  </td>
                  <td>{{ stat.total }}</td>
                  <td :style="{ color: stat.total ? scoreColor(stat.hit1/stat.total) : 'inherit' }">
                    {{ stat.total ? pct(stat.hit1 / stat.total) : '—' }}
                  </td>
                  <td :style="{ color: stat.total ? scoreColor(stat.hit2/stat.total) : 'inherit' }">
                    {{ stat.total ? pct(stat.hit2 / stat.total) : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="page-card">
            <div class="eg-section-title">Интерпретация</div>
            <div class="eg-interp-badge" :class="interpretClass">
              <i :class="interpretIcon"></i>
              {{ interpretText }}
            </div>
            <p class="eg-interp-desc">
              Модель предсказывает следующий тип события с точностью
              <strong>{{ pct(data?.accuracy.top1) }}</strong>, что в
              <strong>{{ data ? (data.accuracy.top1 / data.baseline).toFixed(1) : '—' }}×</strong>
              лучше случайного угадывания ({{ pct(data?.baseline) }}).
            </p>
            <p class="eg-interp-desc eg-interp-date">Последний запуск: {{ fmtDate(data?.timestamp) }}</p>
          </div>
        </div>
      </div>

      <!-- Company breakdown -->
      <div class="page-card">
        <div class="eg-section-title">Детализация по компаниям</div>
        <table class="eg-detail-table">
          <thead>
            <tr>
              <th>Компания</th>
              <th>Предыдущее событие</th>
              <th>Фактическое следующее</th>
              <th>Предсказано</th>
              <th>Уверенность</th>
              <th>Результат</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in data?.details" :key="r.actorId">
              <td class="eg-company-name">{{ r.actorName }}</td>
              <td><span class="eg-type-badge" :style="{ background: typeColor(r.prevType) + '22', color: typeColor(r.prevType) }">{{ r.prevType }}</span></td>
              <td><span class="eg-type-badge" :style="{ background: typeColor(r.actualType) + '22', color: typeColor(r.actualType) }">{{ r.actualType }}</span></td>
              <td>
                <span v-if="r.top1" class="eg-type-badge" :style="{ background: typeColor(r.top1) + '22', color: typeColor(r.top1) }">{{ r.top1 }}</span>
                <span v-else class="eg-empty">—</span>
              </td>
              <td>{{ r.confidence ? pct(r.confidence) : '—' }}</td>
              <td>
                <span class="eg-hit" :class="r.hit1 ? 'eg-hit--ok' : r.hit2 ? 'eg-hit--partial' : 'eg-hit--miss'">
                  {{ r.hit1 ? '✅ Top-1' : r.hit2 ? '🟡 Top-2' : '❌ Промах' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="activeTab === 'backtest' && !data && !loading" class="eg-empty-state">
      <i class="pi pi-exclamation-circle" style="font-size: 2rem; color: var(--p-text-muted-color)"></i>
      <p>Бэктест ещё не запускался.</p>
    </div>

  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'

// ── Tabs ────────────────────────────────────────────────────────────────────
const tabs = [
  { id: 'graph',    label: 'Граф событий' },
  { id: 'backtest', label: 'Бэктест' },
]
const activeTab = ref('graph')

// ── Backtest ─────────────────────────────────────────────────────────────────
const data    = ref(null)
const loading = ref(false)

const EVENT_TYPES = ['Финансовое', 'Технологическое', 'Рыночное', 'Регуляторное']

function pct(v) { return Math.round((v || 0) * 100) + '%' }
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function shortType(t) {
  return { Финансовое: 'Фин', Технологическое: 'Тех', Рыночное: 'Рын', Регуляторное: 'Рег' }[t] || t
}
function typeColor(t) {
  return {
    Финансовое:      'var(--fst-green)',
    Технологическое: 'var(--fst-blue)',
    Рыночное:        'var(--fst-brand)',
    Регуляторное:    'var(--fst-purple)',
  }[t] || 'var(--p-text-muted-color)'
}
function scoreColor(v) {
  if (v >= 0.7) return 'var(--fst-green)'
  if (v >= 0.4) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}
const acc1Color = computed(() => data.value ? scoreColor(data.value.accuracy.top1) : 'inherit')
const acc2Color = computed(() => data.value ? scoreColor(data.value.accuracy.top2) : 'inherit')

function cellCount(from, to) {
  if (!data.value) return 0
  return data.value.confusion?.[`${from}→${to}`] || 0
}
function cellStyle(from, to) {
  const count = cellCount(from, to)
  if (!count) return {}
  const maxCount = Math.max(...Object.values(data.value?.confusion || {}))
  const intensity = count / maxCount
  const isCorrect = from === to
  const color = isCorrect ? 'var(--fst-green)' : 'var(--fst-blue)'
  return {
    background: `color-mix(in srgb, ${color} ${Math.round(intensity * 40 + 8)}%, transparent)`,
    color: intensity > 0.5 ? color : 'var(--p-text-color)',
    fontWeight: count > 0 ? '600' : '400',
  }
}
const interpretClass = computed(() => {
  if (!data.value) return ''
  const a = data.value.accuracy.top1
  if (a >= 0.6) return 'eg-interp--good'
  if (a >= 0.4) return 'eg-interp--ok'
  return 'eg-interp--weak'
})
const interpretIcon = computed(() => {
  const a = data.value?.accuracy.top1
  if (!a) return 'pi pi-circle'
  if (a >= 0.6) return 'pi pi-check-circle'
  if (a >= 0.4) return 'pi pi-exclamation-circle'
  return 'pi pi-times-circle'
})
const interpretText = computed(() => {
  const a = data.value?.accuracy.top1
  if (!a) return ''
  if (a >= 0.6) return 'Высокая предсказательная сила — модель полезна для раннего предупреждения'
  if (a >= 0.4) return 'Умеренная сила — лучше случайного угадывания'
  return 'Слабая сила — нужно больше данных'
})

async function loadBacktest() {
  loading.value = true
  try {
    const r = await fetch('/api/fst/events/backtest')
    if (!r.ok) { data.value = null; return }
    data.value = await r.json()
  } catch { data.value = null }
  finally { loading.value = false }
}

// ── Graph ────────────────────────────────────────────────────────────────────
const cyContainer   = ref(null)
const graphData     = ref(null)
const graphLoading  = ref(false)
const selectedNode  = ref(null)
const layoutName    = ref('fcose')
let   cy            = null

const layoutOptions = [
  { label: 'fCoSE (авто)',   value: 'fcose' },
  { label: 'Dagre (слои)',   value: 'dagre' },
  { label: 'Концентрический', value: 'concentric' },
  { label: 'Круговой',       value: 'circle' },
]

const legend = [
  { label: 'Событие',  color: 'var(--fst-brand)' },
  { label: 'Актор',    color: 'var(--fst-blue)' },
  { label: 'Концепт',  color: 'var(--fst-purple)' },
  { label: 'Проект',   color: 'var(--fst-cyan)' },
  { label: 'Причинная связь', color: 'var(--fst-red)' },
]

function nodeTypeColor(type) {
  return {
    event:   'var(--fst-brand)',
    actor:   'var(--fst-blue)',
    concept: 'var(--fst-purple)',
    project: 'var(--fst-cyan)',
  }[type] || 'var(--p-text-muted-color)'
}
function nodeTypeLabel(type) {
  return { event: 'Событие', actor: 'Актор', concept: 'Концепт', project: 'Проект' }[type] || type
}

// CSS var → hex approximation for Cytoscape (can't read CSS vars)
const NODE_COLORS = {
  event:   '#fb923c',  // --fst-brand
  actor:   '#60a5fa',  // --fst-blue
  concept: '#c084fc',  // --fst-purple
  project: '#22d3ee',  // --fst-cyan
}
const EDGE_COLORS = {
  actor:   '#60a5fa33',
  concept: '#c084fc33',
  causes:  '#ef444466',
  project: '#22d3ee33',
}

async function loadGraph() {
  graphLoading.value = true
  try {
    const r = await fetch('/api/fst/events/graph')
    if (!r.ok) return
    graphData.value = await r.json()
    await nextTick()
    await initCy()
  } catch (e) {
    console.error('[EventGraph] loadGraph error:', e)
  } finally {
    graphLoading.value = false
  }
}

async function initCy() {
  if (!cyContainer.value || !graphData.value) return

  const [
    cytoscapeLib,
    fcose,
    dagre,
    cytoDagre,
  ] = await Promise.all([
    import('cytoscape'),
    import('cytoscape-fcose'),
    import('dagre'),
    import('cytoscape-dagre'),
  ])

  const Cytoscape = cytoscapeLib.default
  Cytoscape.use(fcose.default)
  Cytoscape.use(cytoDagre.default)

  if (cy) { cy.destroy(); cy = null }

  const elements = []

  for (const node of graphData.value.nodes) {
    elements.push({
      data: {
        id:    node.id,
        label: truncate(node.label, 22),
        type:  node.type,
        color: NODE_COLORS[node.type] || '#94a3b8',
        size:  node.type === 'event' ? 30 : node.type === 'actor' ? 40 : 22,
        ...node.data,
      }
    })
  }
  for (const edge of graphData.value.edges) {
    elements.push({
      data: {
        id:     `e_${edge.source}_${edge.target}_${edge.relation}`,
        source: edge.source,
        target: edge.target,
        relation: edge.relation,
        color: EDGE_COLORS[edge.relation] || '#94a3b833',
        width: edge.relation === 'causes' ? 2.5 : 1.5,
      }
    })
  }

  cy = Cytoscape({
    container: cyContainer.value,
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color':  'data(color)',
          'label':             'data(label)',
          'color':             '#ffffff',
          'font-size':         10,
          'text-valign':       'center',
          'text-halign':       'center',
          'text-wrap':         'wrap',
          'text-max-width':    60,
          'width':             'data(size)',
          'height':            'data(size)',
          'border-width':      2,
          'border-color':      'data(color)',
          'border-opacity':    0.6,
          'text-background-color': '#1e293b',
          'text-background-opacity': 0.7,
          'text-background-padding': '2px',
          'text-background-shape':   'roundrectangle',
          'overlay-padding':   4,
        }
      },
      {
        selector: 'node[type = "actor"]',
        style: {
          'shape': 'ellipse',
          'font-size': 11,
          'font-weight': 'bold',
        }
      },
      {
        selector: 'node[type = "event"]',
        style: { 'shape': 'diamond' }
      },
      {
        selector: 'node[type = "concept"]',
        style: { 'shape': 'round-rectangle', 'font-size': 9 }
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 3,
          'border-color': '#ffffff',
          'border-opacity': 1,
        }
      },
      {
        selector: 'edge',
        style: {
          'line-color':          'data(color)',
          'target-arrow-color':  'data(color)',
          'target-arrow-shape':  'triangle',
          'arrow-scale':         0.8,
          'curve-style':         'bezier',
          'width':               'data(width)',
          'opacity':             0.8,
        }
      },
      {
        selector: 'edge[relation = "causes"]',
        style: {
          'line-style': 'dashed',
          'line-dash-pattern': [6, 3],
        }
      },
    ],
    layout: buildLayout(layoutName.value),
    wheelSensitivity: 0.3,
  })

  cy.on('tap', 'node', (evt) => {
    const node = evt.target
    selectedNode.value = {
      id:    node.id(),
      label: node.data('label'),
      type:  node.data('type'),
      data:  node.data(),
    }
  })
  cy.on('tap', (evt) => {
    if (evt.target === cy) selectedNode.value = null
  })
}

function buildLayout(name) {
  if (name === 'fcose') {
    return {
      name: 'fcose',
      quality: 'default',
      randomize: true,
      animate: true,
      animationDuration: 800,
      nodeSeparation: 100,
      idealEdgeLength: 120,
    }
  }
  if (name === 'dagre') {
    return {
      name: 'dagre',
      rankDir: 'LR',
      animate: true,
      animationDuration: 600,
      nodeSep: 50,
      rankSep: 120,
    }
  }
  return { name, animate: true, animationDuration: 600 }
}

function reLayout() {
  if (!cy) return
  cy.layout(buildLayout(layoutName.value)).run()
}

function cyZoom(factor) {
  if (!cy) return
  cy.zoom({ level: cy.zoom() * factor, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } })
}
function cyFit() {
  if (!cy) return
  cy.fit(undefined, 40)
}

function truncate(str, n) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadGraph()
  await loadBacktest()
})

watch(activeTab, async (tab) => {
  if (tab === 'graph' && !graphData.value) {
    await loadGraph()
  } else if (tab === 'graph' && graphData.value && !cy) {
    await nextTick()
    await initCy()
  }
})

onBeforeUnmount(() => {
  if (cy) { cy.destroy(); cy = null }
})
</script>

<style scoped>
.eg-metrics { margin: -20px -20px 0; border-bottom: 1px solid var(--p-content-border-color); }

/* ── GRAPH TAB ── */
.eg-graph-wrap {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: calc(100vh - 220px);
  min-height: 500px;
  padding-top: 12px;
  position: relative;
}

.eg-graph-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 10px;
  gap: 12px;
  flex-shrink: 0;
}

.eg-graph-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.eg-legend {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.eg-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.eg-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.eg-cy-container {
  flex: 1;
  border-radius: 12px;
  border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
  position: relative;
  overflow: hidden;
}

.eg-cy-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--p-text-muted-color);
  font-size: 14px;
  background: var(--p-surface-card);
  z-index: 2;
}

.eg-node-panel {
  position: absolute;
  bottom: 24px;
  right: 12px;
  width: 280px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 14px;
  z-index: 10;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}
.eg-node-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.eg-node-close {
  background: none;
  border: none;
  color: var(--p-text-muted-color);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}
.eg-node-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 8px;
  line-height: 1.4;
}
.eg-node-field {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.eg-node-key { font-weight: 600; }

/* ── BACKTEST TAB ── */
.eg-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}
.eg-row {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 16px;
}
.page-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 20px;
}
.eg-col-right { display: flex; flex-direction: column; gap: 16px; }

.eg-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--p-text-muted-color);
  margin-bottom: 14px;
}

.eg-matrix-wrap { overflow-x: auto; }
.eg-matrix { border-collapse: collapse; width: 100%; font-size: 13px; }
.eg-matrix th, .eg-matrix td { padding: 8px 12px; text-align: center; border: 1px solid var(--p-content-border-color); }
.eg-matrix-corner { text-align: left; font-size: 11px; color: var(--p-text-muted-color); min-width: 150px; }
.eg-matrix-colhead { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--p-text-muted-color); }
.eg-matrix-rowhead { font-size: 11px; font-weight: 700; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; color: var(--p-text-muted-color); }
.eg-matrix-cell { min-width: 56px; font-variant-numeric: tabular-nums; transition: background 0.2s; }
.eg-matrix-empty { color: var(--p-text-muted-color); opacity: 0.3; }

.eg-type-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.eg-type-table th { text-align: left; padding: 6px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-content-border-color); }
.eg-type-table td { padding: 8px; border-bottom: 1px solid color-mix(in srgb, var(--p-content-border-color) 50%, transparent); }
.eg-type-table tr:last-child td { border-bottom: none; }

.eg-type-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; }

.eg-interp-badge { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; margin-bottom: 12px; }
.eg-interp--good { background: color-mix(in srgb, var(--fst-green) 12%, transparent); color: var(--fst-green); }
.eg-interp--ok   { background: color-mix(in srgb, var(--fst-brand) 12%, transparent); color: var(--fst-brand); }
.eg-interp--weak { background: color-mix(in srgb, var(--fst-red)   12%, transparent); color: var(--fst-red); }
.eg-interp-desc  { font-size: 13px; color: var(--p-text-color); margin: 0 0 8px; line-height: 1.5; }
.eg-interp-date  { font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 0; }

.eg-detail-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.eg-detail-table th { text-align: left; padding: 6px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-content-border-color); }
.eg-detail-table td { padding: 10px; border-bottom: 1px solid color-mix(in srgb, var(--p-content-border-color) 50%, transparent); vertical-align: middle; }
.eg-detail-table tr:last-child td { border-bottom: none; }
.eg-company-name { font-weight: 500; }

.eg-hit { font-size: 12px; font-weight: 600; }
.eg-hit--ok      { color: var(--fst-green); }
.eg-hit--partial { color: var(--fst-brand); }
.eg-hit--miss    { color: var(--fst-red); }

.eg-empty { color: var(--p-text-muted-color); }

.eg-empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; color: var(--p-text-muted-color); }

@media (max-width: 900px) {
  .eg-row { grid-template-columns: 1fr; }
  .eg-graph-controls { flex-direction: column; align-items: flex-start; }
}
</style>
