<template>
  <div class="event-graph">
    <div class="panel-toolbar">
      <h3>Граф событий (DAG)</h3>
      <div class="toolbar-actions">
        <Select v-model="filters.individualId" :options="individuals" optionLabel="val" optionValue="id"
          placeholder="Индивид" showClear class="filter-select" @change="loadGraph" />
        <Select v-model="filters.actorId" :options="actors" optionLabel="val" optionValue="id"
          placeholder="Актор" showClear class="filter-select" @change="loadGraph" />
        <Select v-model="layoutType" :options="layouts" optionLabel="label" optionValue="value"
          class="filter-select" @change="renderGraph" />
        <ToggleButton v-model="showTimeline" onLabel="Timeline" offLabel="Timeline"
          onIcon="pi pi-clock" offIcon="pi pi-clock" />
        <Button icon="pi pi-arrows-alt" severity="secondary" text @click="zoomToFit" v-tooltip="'Вписать'" />
        <Button icon="pi pi-refresh" severity="secondary" text @click="loadGraph" />
      </div>
    </div>

    <div v-if="!graphData.nodes.length" class="empty-state">
      <i class="pi pi-share-alt" style="font-size: 3rem; color: var(--p-text-muted-color)"></i>
      <p>Нет событий для отображения</p>
    </div>

    <!-- Timeline axis -->
    <div v-if="showTimeline && graphData.nodes.length" class="timeline-axis">
      <div v-for="ts in timelineMarkers" :key="ts.label" class="timeline-marker"
        :style="{ left: ts.pct + '%' }">
        <div class="timeline-tick"></div>
        <span>{{ ts.label }}</span>
      </div>
    </div>

    <div ref="graphContainer" class="graph-container"
      :style="{ display: graphData.nodes.length ? 'block' : 'none' }">
      <svg ref="svgRef" width="100%" height="100%"></svg>
    </div>

    <!-- Legend -->
    <div v-if="graphData.nodes.length" class="graph-legend">
      <span class="legend-title">Акторы:</span>
      <span v-for="a in legendActors" :key="a.id" class="legend-item">
        <span class="legend-dot" :style="{ background: a.color }"></span>
        {{ a.name }} ({{ a.type }})
      </span>
      <span class="legend-separator">|</span>
      <span class="legend-title">Связи:</span>
      <span class="legend-item">
        <span class="legend-line"></span> причина → следствие
      </span>
      <span class="legend-item highlight-item">
        <span class="legend-line highlight-line"></span> выделенная цепочка
      </span>
    </div>

    <!-- Node info panel -->
    <div v-if="selectedEvent" class="event-info">
      <div class="event-info-header">
        <h4>{{ selectedEvent.label }}</h4>
        <div class="event-info-actions">
          <Button label="Показать цепочку" icon="pi pi-share-alt" size="small" text
            @click="highlightChain(selectedEvent.id)" />
          <Button label="Сбросить" icon="pi pi-times" size="small" severity="secondary" text
            @click="clearHighlight" />
        </div>
      </div>
      <div class="info-grid">
        <div class="info-row"><span>ID:</span> {{ selectedEvent.id }}</div>
        <div class="info-row"><span>Значение:</span> <strong>{{ selectedEvent.value || '—' }}</strong></div>
        <div class="info-row"><span>Время:</span> {{ formatTime(selectedEvent.timestamp) }}</div>
        <div class="info-row">
          <span>Актор:</span>
          <Tag :value="getActorName(selectedEvent.actorId)" size="small"
            :severity="getActorSeverity(selectedEvent.actorId)" />
        </div>
        <div class="info-row"><span>Индивид:</span> {{ getIndividualName(selectedEvent.individualId) }}</div>
      </div>

      <!-- Causes -->
      <div v-if="selectedEventCauses.length" class="event-causes">
        <span class="causes-label">Причины ({{ selectedEventCauses.length }}):</span>
        <Tag v-for="c in selectedEventCauses" :key="c.id" :value="c.label" size="small" severity="warn"
          class="cause-tag" @click="selectNode(c.id)" />
      </div>

      <!-- Effects -->
      <div v-if="selectedEventEffects.length" class="event-causes">
        <span class="causes-label">Следствия ({{ selectedEventEffects.length }}):</span>
        <Tag v-for="e in selectedEventEffects" :key="e.id" :value="e.label" size="small" severity="success"
          class="cause-tag" @click="selectNode(e.id)" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick, inject } from 'vue'
import axios from 'axios'
import * as d3 from 'd3'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import ToggleButton from 'primevue/togglebutton'

const API = inject('eventEngineAPI')
const selectedApplicationId = inject('selectedApplicationId', ref(null))

function buildUrl(path) {
  const appId = selectedApplicationId.value
  if (!appId) return `${API}${path}`
  const sep = path.includes('?') ? '&' : '?'
  return `${API}${path}${sep}applicationId=${appId}`
}

const graphContainer = ref(null)
const svgRef = ref(null)
const graphData = ref({ nodes: [], edges: [] })
const individuals = ref([])
const actors = ref([])
const selectedEvent = ref(null)
const showTimeline = ref(false)
const layoutType = ref('dagTopDown')
const layouts = [
  { label: 'DAG сверху вниз', value: 'dagTopDown' },
  { label: 'DAG слева направо', value: 'dagLeftRight' },
  { label: 'Timeline', value: 'timeline' },
  { label: 'Force', value: 'force' },
]
const filters = ref({ individualId: null, actorId: null })
const highlightedNodes = ref(new Set())

let simulation = null
let currentZoom = null
let svgSelection = null
let gSelection = null

// Actor colors by type
const ACTOR_COLORS = { human: '#3B82F6', sensor: '#10B981', agent: '#F59E0B' }
const NODE_COLORS = d3.schemeTableau10

function getActorColor(actorId) {
  const actor = actors.value.find(a => String(a.id) === String(actorId))
  return ACTOR_COLORS[actor?.reqs?.['Тип']?.value] || '#999'
}

function getActorName(actorId) {
  return actors.value.find(a => String(a.id) === String(actorId))?.val || '—'
}

function getActorSeverity(actorId) {
  const actor = actors.value.find(a => String(a.id) === String(actorId))
  const type = actor?.reqs?.['Тип']?.value
  return type === 'human' ? 'info' : type === 'sensor' ? 'success' : 'warn'
}

function getIndividualName(indId) {
  return individuals.value.find(i => String(i.id) === String(indId))?.val || '—'
}

function formatTime(ts) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return ts }
}

const legendActors = computed(() => {
  const seen = new Set()
  return actors.value.filter(a => {
    const type = a.reqs?.['Тип']?.value || 'human'
    if (seen.has(type)) return false
    seen.add(type)
    return true
  }).map(a => ({
    id: a.id,
    name: a.val,
    type: a.reqs?.['Тип']?.value || 'human',
    color: ACTOR_COLORS[a.reqs?.['Тип']?.value] || '#999',
  }))
})

const selectedEventCauses = computed(() => {
  if (!selectedEvent.value) return []
  return graphData.value.edges
    .filter(e => String(e.target) === String(selectedEvent.value.id))
    .map(e => graphData.value.nodes.find(n => String(n.id) === String(e.source)))
    .filter(Boolean)
})

const selectedEventEffects = computed(() => {
  if (!selectedEvent.value) return []
  return graphData.value.edges
    .filter(e => String(e.source) === String(selectedEvent.value.id))
    .map(e => graphData.value.nodes.find(n => String(n.id) === String(e.target)))
    .filter(Boolean)
})

const timelineMarkers = computed(() => {
  const timestamps = graphData.value.nodes
    .map(n => n.timestamp)
    .filter(Boolean)
    .map(t => new Date(t).getTime())
    .sort((a, b) => a - b)
  if (timestamps.length < 2) return []
  const min = timestamps[0]
  const max = timestamps[timestamps.length - 1]
  const range = max - min || 1
  const step = Math.max(1, Math.floor(timestamps.length / 6))
  const markers = []
  for (let i = 0; i < timestamps.length; i += step) {
    const pct = ((timestamps[i] - min) / range) * 100
    markers.push({
      pct,
      label: new Date(timestamps[i]).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    })
  }
  return markers
})

function selectNode(nodeId) {
  selectedEvent.value = graphData.value.nodes.find(n => String(n.id) === String(nodeId))
}

function highlightChain(nodeId) {
  const chain = new Set()
  const nodeMap = {}
  for (const n of graphData.value.nodes) nodeMap[n.id] = n

  // Trace ancestors
  function traceBack(id) {
    if (chain.has(id)) return
    chain.add(id)
    graphData.value.edges
      .filter(e => String(e.target) === String(id))
      .forEach(e => traceBack(e.source))
  }

  // Trace descendants
  function traceForward(id) {
    if (chain.has(id)) return
    chain.add(id)
    graphData.value.edges
      .filter(e => String(e.source) === String(id))
      .forEach(e => traceForward(e.target))
  }

  traceBack(nodeId)
  traceForward(nodeId)
  highlightedNodes.value = chain
  applyHighlight()
}

function clearHighlight() {
  highlightedNodes.value = new Set()
  applyHighlight()
}

function applyHighlight() {
  if (!gSelection) return
  const hl = highlightedNodes.value
  if (hl.size === 0) {
    gSelection.selectAll('circle').attr('opacity', 1).attr('stroke-width', 2)
    gSelection.selectAll('line').attr('opacity', 0.6).attr('stroke-width', 1.5)
    gSelection.selectAll('text').attr('opacity', 1)
    return
  }
  gSelection.selectAll('circle')
    .attr('opacity', d => hl.has(String(d.id)) ? 1 : 0.15)
    .attr('stroke-width', d => hl.has(String(d.id)) ? 3 : 1)
  gSelection.selectAll('text')
    .attr('opacity', d => hl.has(String(d.id)) ? 1 : 0.15)
  gSelection.selectAll('line')
    .attr('opacity', d => hl.has(String(d.source?.id || d.source)) && hl.has(String(d.target?.id || d.target)) ? 1 : 0.08)
    .attr('stroke', d => hl.has(String(d.source?.id || d.source)) && hl.has(String(d.target?.id || d.target)) ? '#EF4444' : '#999')
    .attr('stroke-width', d => hl.has(String(d.source?.id || d.source)) && hl.has(String(d.target?.id || d.target)) ? 3 : 1.5)
}

function zoomToFit() {
  if (!svgSelection || !gSelection) return
  const bounds = gSelection.node().getBBox()
  if (bounds.width === 0 || bounds.height === 0) return
  const width = graphContainer.value?.clientWidth || 800
  const height = graphContainer.value?.clientHeight || 500
  const scale = 0.9 * Math.min(width / bounds.width, height / bounds.height)
  const tx = (width - bounds.width * scale) / 2 - bounds.x * scale
  const ty = (height - bounds.height * scale) / 2 - bounds.y * scale
  svgSelection.transition().duration(500).call(
    currentZoom.transform,
    d3.zoomIdentity.translate(tx, ty).scale(scale)
  )
}

async function loadGraph() {
  try {
    const params = new URLSearchParams()
    if (filters.value.individualId) params.append('individualId', filters.value.individualId)
    if (filters.value.actorId) params.append('actorId', filters.value.actorId)

    const graphPath = `/graph?${params}`
    const [gRes, iRes, aRes] = await Promise.all([
      axios.get(buildUrl(graphPath)),
      axios.get(buildUrl('/individuals')),
      axios.get(`${API}/actors`),
    ])
    if (gRes.data.success) graphData.value = gRes.data.data
    if (iRes.data.success) individuals.value = iRes.data.data
    if (aRes.data.success) actors.value = aRes.data.data

    await nextTick()
    renderGraph()
  } catch (e) { console.error(e) }
}

function renderGraph() {
  if (!svgRef.value || !graphData.value.nodes.length) return

  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()
  svgSelection = svg

  const width = graphContainer.value?.clientWidth || 800
  const height = graphContainer.value?.clientHeight || 500

  svg.attr('viewBox', [0, 0, width, height])

  const nodes = graphData.value.nodes.map(n => ({ ...n }))
  const links = graphData.value.edges.map(e => ({
    source: nodes.find(n => String(n.id) === String(e.source)),
    target: nodes.find(n => String(n.id) === String(e.target)),
  })).filter(l => l.source && l.target)

  const g = svg.append('g')
  gSelection = g

  // Zoom
  currentZoom = d3.zoom().scaleExtent([0.1, 4]).on('zoom', (event) => {
    g.attr('transform', event.transform)
  })
  svg.call(currentZoom)

  // Arrow markers
  const defs = svg.append('defs')
  defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 25).attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 8).attr('markerHeight', 8)
    .append('path').attr('d', 'M 0,-5 L 10,0 L 0,5')
    .attr('fill', '#999')

  defs.append('marker')
    .attr('id', 'arrowhead-highlight')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 25).attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 8).attr('markerHeight', 8)
    .append('path').attr('d', 'M 0,-5 L 10,0 L 0,5')
    .attr('fill', '#EF4444')

  // Links
  const link = g.append('g').selectAll('line')
    .data(links).join('line')
    .attr('stroke', '#999').attr('stroke-opacity', 0.6)
    .attr('stroke-width', 1.5)
    .attr('marker-end', 'url(#arrowhead)')

  // Nodes
  const node = g.append('g').selectAll('g')
    .data(nodes).join('g')
    .attr('cursor', 'pointer')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', (event, d) => {
      selectedEvent.value = d
    })

  // Node circles — colored by actor type
  node.append('circle')
    .attr('r', 14)
    .attr('fill', d => getActorColor(d.actorId))
    .attr('stroke', '#fff').attr('stroke-width', 2)

  // Inner icon (small text for type)
  node.append('text')
    .text(d => {
      const actor = actors.value.find(a => String(a.id) === String(d.actorId))
      const type = actor?.reqs?.['Тип']?.value
      return type === 'human' ? 'H' : type === 'sensor' ? 'S' : type === 'agent' ? 'A' : '?'
    })
    .attr('text-anchor', 'middle').attr('dy', '0.35em')
    .attr('font-size', '9px').attr('fill', '#fff').attr('font-weight', '700')

  // Label
  node.append('text')
    .text(d => (d.label || '').substring(0, 30))
    .attr('x', 18).attr('y', 4)
    .attr('font-size', '11px')
    .attr('fill', 'var(--p-text-color)')

  // Timestamp label (small, below)
  node.append('text')
    .text(d => formatTime(d.timestamp))
    .attr('x', 18).attr('y', 16)
    .attr('font-size', '9px')
    .attr('fill', 'var(--p-text-muted-color)')

  // Layout
  if (layoutType.value === 'timeline') {
    // Timeline layout: X = time, Y = individual
    const timestamps = nodes.map(n => n.timestamp ? new Date(n.timestamp).getTime() : 0).filter(t => t > 0)
    const minT = Math.min(...timestamps) || 0
    const maxT = Math.max(...timestamps) || 1
    const rangeT = maxT - minT || 1

    const indIds = [...new Set(nodes.map(n => n.individualId))]
    const indMap = {}
    indIds.forEach((id, i) => { indMap[id] = i })

    nodes.forEach(n => {
      const t = n.timestamp ? new Date(n.timestamp).getTime() : minT
      n.x = 80 + ((t - minT) / rangeT) * (width - 160)
      n.y = 80 + (indMap[n.individualId] || 0) * 80
      n.fx = n.x; n.fy = n.y
    })

    node.attr('transform', d => `translate(${d.x},${d.y})`)
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y)

  } else if (layoutType.value === 'dagTopDown' || layoutType.value === 'dagLeftRight') {
    const isHorizontal = layoutType.value === 'dagLeftRight'
    const levels = {}
    const visited = new Set()
    const inDegree = {}

    nodes.forEach(n => { inDegree[n.id] = 0 })
    links.forEach(l => { inDegree[l.target.id] = (inDegree[l.target.id] || 0) + 1 })

    let queue = nodes.filter(n => !inDegree[n.id] || inDegree[n.id] === 0)
    let level = 0
    while (queue.length > 0) {
      const nextQueue = []
      queue.forEach((n, i) => {
        levels[n.id] = level
        if (isHorizontal) {
          n.x = 80 + level * 200
          n.y = 60 + i * 70
        } else {
          n.x = width / 2 - (queue.length * 100) / 2 + i * 100
          n.y = 60 + level * 90
        }
        n.fx = n.x; n.fy = n.y
        visited.add(n.id)
        links.filter(l => String(l.source.id) === String(n.id)).forEach(l => {
          if (!visited.has(l.target.id)) nextQueue.push(l.target)
        })
      })
      queue = [...new Set(nextQueue)]
      level++
    }

    node.attr('transform', d => `translate(${d.x},${d.y})`)
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
  } else {
    // Force layout
    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-250))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .on('tick', () => {
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
        node.attr('transform', d => `translate(${d.x},${d.y})`)
      })
  }

  // Apply highlight if active
  if (highlightedNodes.value.size > 0) applyHighlight()

  function dragstarted(event) {
    if (simulation && !event.active) simulation.alphaTarget(0.3).restart()
    event.subject.fx = event.subject.x
    event.subject.fy = event.subject.y
  }
  function dragged(event) {
    event.subject.fx = event.x
    event.subject.fy = event.y
  }
  function dragended(event) {
    if (simulation && !event.active) simulation.alphaTarget(0)
    if (layoutType.value === 'force') {
      event.subject.fx = null
      event.subject.fy = null
    }
  }
}

watch(selectedApplicationId, () => loadGraph())
onMounted(loadGraph)

onUnmounted(() => {
  if (simulation) simulation.stop()
})
</script>

<style scoped>
.event-graph { display: flex; flex-direction: column; height: 100%; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
.panel-toolbar h3 { margin: 0; }
.toolbar-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.filter-select { width: 180px; }

.graph-container { flex: 1; min-height: 450px; border: 1px solid var(--p-surface-border); border-radius: 8px; background: var(--p-surface-card); }
.graph-container svg { width: 100%; height: 100%; min-height: 450px; }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 0; }
.empty-state p { color: var(--p-text-muted-color); }

/* Timeline axis */
.timeline-axis {
  position: relative;
  height: 30px;
  background: var(--p-surface-100);
  border-radius: 4px;
  margin-bottom: 4px;
}
.timeline-marker { position: absolute; bottom: 0; transform: translateX(-50%); }
.timeline-tick { width: 1px; height: 8px; background: var(--p-text-muted-color); margin: 0 auto; }
.timeline-marker span { font-size: 0.7rem; color: var(--p-text-muted-color); white-space: nowrap; }

/* Legend */
.graph-legend {
  display: flex; align-items: center; gap: 12px; padding: 8px 12px;
  background: var(--p-surface-card); border: 1px solid var(--p-surface-border);
  border-radius: 6px; margin-top: 8px; flex-wrap: wrap; font-size: 0.85rem;
}
.legend-title { font-weight: 600; color: var(--p-text-muted-color); }
.legend-item { display: flex; align-items: center; gap: 4px; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; }
.legend-line { width: 20px; height: 2px; background: #999; }
.highlight-line { background: #EF4444; height: 3px; }
.legend-separator { color: var(--p-surface-border); }

/* Event info */
.event-info {
  margin-top: 12px; padding: 16px;
  background: var(--p-surface-card); border-radius: 8px;
  border: 1px solid var(--p-surface-border);
}
.event-info-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.event-info-header h4 { margin: 0; }
.event-info-actions { display: flex; gap: 4px; }

.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
.info-row { display: flex; gap: 8px; font-size: 0.9rem; align-items: center; }
.info-row span:first-child { font-weight: 600; min-width: 70px; color: var(--p-text-muted-color); }

.event-causes { margin-top: 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.causes-label { font-size: 0.85rem; font-weight: 600; color: var(--p-text-muted-color); }
.cause-tag { cursor: pointer; }
</style>
