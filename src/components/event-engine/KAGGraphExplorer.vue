<template>
  <div class="kag-graph-explorer">
    <div class="panel-toolbar">
      <h3>Граф знаний KAG</h3>
      <div class="toolbar-actions">
        <InputText v-model="searchQuery" placeholder="Поиск..." class="filter-input"
          @keyup.enter="searchEntities" />
        <Button icon="pi pi-search" severity="secondary" text @click="searchEntities" />
        <Select v-model="filterType" :options="entityTypes" placeholder="Тип"
          showClear class="filter-select" @change="filterGraph" />
        <Select v-model="layoutType" :options="layouts" optionLabel="label" optionValue="value"
          class="filter-select" @change="applyLayout" />
        <Button icon="pi pi-arrows-alt" severity="secondary" text @click="zoomToFit" v-tooltip="'Вписать'" />
        <Button icon="pi pi-refresh" severity="secondary" text @click="loadGraph" :loading="loading" />
      </div>
    </div>

    <div class="graph-stats">
      <Tag :value="`${stats.totalEntities} сущностей`" severity="info" />
      <Tag :value="`${stats.totalRelations} связей`" severity="success" />
      <Tag :value="`${visibleNodes.length} видимых`" severity="warn" />
      <Tag v-if="stats.storage?.dbSizeMB" :value="`${stats.storage.dbSizeMB} MB`" />
    </div>

    <div v-if="visibleNodes.length === 0 && !loading" class="empty-state">
      <i class="pi pi-share-alt" style="font-size: 3rem; color: var(--p-text-muted-color)"></i>
      <p>Введите запрос или выберите тип для визуализации графа</p>
    </div>

    <div ref="graphContainer" class="graph-container"
      :style="{ display: visibleNodes.length ? 'block' : 'none' }">
      <svg ref="svgRef" width="100%" height="100%"></svg>
    </div>

    <!-- Legend -->
    <div v-if="visibleNodes.length" class="graph-legend">
      <span class="legend-title">Типы:</span>
      <span v-for="t in activeLegend" :key="t.type" class="legend-item"
        @click="filterType = t.type; filterGraph()" style="cursor: pointer">
        <span class="legend-dot" :style="{ background: t.color }"></span>
        {{ t.type }} ({{ t.count }})
      </span>
    </div>

    <!-- Node detail panel -->
    <div v-if="selectedEntity" class="entity-detail">
      <div class="entity-detail-header">
        <h4>{{ selectedEntity.name }}</h4>
        <Button icon="pi pi-times" text rounded size="small" @click="selectedEntity = null" />
      </div>
      <div class="entity-detail-body">
        <div class="detail-row">
          <span class="detail-label">Тип:</span>
          <Tag :value="selectedEntity.type" :severity="getTypeSeverity(selectedEntity.type)" />
        </div>
        <div class="detail-row" v-if="selectedEntity.source">
          <span class="detail-label">Источник:</span>
          <span>{{ selectedEntity.source }}</span>
        </div>
        <div class="detail-row" v-if="selectedEntity.properties?.wikidataUrl">
          <span class="detail-label">Wikidata:</span>
          <a :href="selectedEntity.properties.wikidataUrl" target="_blank">
            {{ selectedEntity.properties.wikidataId }}
          </a>
        </div>
        <div class="detail-row" v-if="selectedEntity.properties?.population">
          <span class="detail-label">Население:</span>
          <span>{{ Number(selectedEntity.properties.population).toLocaleString() }}</span>
        </div>
        <div v-if="selectedEntity.observations?.length" class="detail-observations">
          <span class="detail-label">Описание:</span>
          <p v-for="(obs, i) in selectedEntity.observations.slice(0, 3)" :key="i">{{ obs }}</p>
        </div>
        <div v-if="selectedRelations.length" class="detail-relations">
          <span class="detail-label">Связи ({{ selectedRelations.length }}):</span>
          <div v-for="rel in selectedRelations.slice(0, 10)" :key="rel.id" class="relation-item"
            @click="navigateToEntity(rel.from_id === selectedEntity.id ? rel.to_id : rel.from_id)">
            <i class="pi pi-arrow-right" style="font-size: 0.7rem"></i>
            <Tag :value="rel.type" size="small" severity="secondary" />
            <span>{{ getEntityName(rel.from_id === selectedEntity.id ? rel.to_id : rel.from_id) }}</span>
          </div>
        </div>
        <Button label="Раскрыть связи" icon="pi pi-sitemap" size="small" class="mt-2"
          @click="expandEntity(selectedEntity.id)" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as d3 from 'd3'
import axios from 'axios'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'

const API = '/api/kag'

// State
const loading = ref(false)
const searchQuery = ref('')
const filterType = ref(null)
const layoutType = ref('force')
const selectedEntity = ref(null)
const selectedRelations = ref([])
const stats = ref({ totalEntities: 0, totalRelations: 0, entityTypes: {}, storage: {} })

// Graph data
const allNodes = ref([])
const allLinks = ref([])
const visibleNodes = ref([])
const visibleLinks = ref([])
const entityMap = ref(new Map())

// D3 refs
const graphContainer = ref(null)
const svgRef = ref(null)
let simulation = null
let svg = null
let g = null
let zoom = null

const layouts = [
  { label: 'Force', value: 'force' },
  { label: 'Radial', value: 'radial' },
  { label: 'Grid', value: 'grid' }
]

const entityTypes = computed(() => {
  const types = Object.keys(stats.value.entityTypes || {})
  return types.sort()
})

const TYPE_COLORS = {
  UAV: '#e74c3c',
  Manufacturer: '#3498db',
  City: '#2ecc71',
  Agriculture: '#27ae60',
  Sensor: '#9b59b6',
  OntologyClass: '#f39c12',
  OntologyProperty: '#e67e22',
  OntologyConcept: '#1abc9c',
  AviationTechnology: '#e91e63',
  ScientificPaper: '#00bcd4',
  Researcher: '#607d8b',
  NewsArticle: '#ff9800',
  GeoFeature: '#4caf50',
  AgricultureConcept: '#8bc34a',
  WebPage: '#795548',
  Concept: '#9e9e9e'
}

function getColor(type) {
  return TYPE_COLORS[type] || '#' + ((Math.abs(hashStr(type)) % 0xFFFFFF) | 0x404040).toString(16)
}

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i)
  return h
}

const activeLegend = computed(() => {
  const counts = {}
  for (const n of visibleNodes.value) {
    counts[n.type] = (counts[n.type] || 0) + 1
  }
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count, color: getColor(type) }))
    .sort((a, b) => b.count - a.count)
})

function getTypeSeverity(type) {
  const map = { UAV: 'danger', Manufacturer: 'info', City: 'success', Sensor: 'warn' }
  return map[type] || 'secondary'
}

function getEntityName(id) {
  return entityMap.value.get(id)?.name || id
}

// ============================================================
// Data loading
// ============================================================

async function loadStats() {
  try {
    const { data } = await axios.get(`${API}/stats`)
    if (data.success) stats.value = data.stats
  } catch {}
}

async function searchEntities() {
  if (!searchQuery.value.trim()) return
  loading.value = true

  try {
    const { data } = await axios.post(`${API}/search`, {
      query: searchQuery.value,
      mode: 'keyword',
      limit: 100
    })

    if (data.success && data.results?.length) {
      const entities = data.results.map(r => r.entity)
      setGraphData(entities)

      // Load relations for found entities
      await loadRelationsForEntities(entities.map(e => e.id))
    }
  } catch (err) {
    console.error('Search failed:', err)
  } finally {
    loading.value = false
  }
}

async function loadGraph() {
  loading.value = true
  await loadStats()

  try {
    // Load entities by type or all
    const type = filterType.value
    const { data } = await axios.post(`${API}/search`, {
      query: type || '*',
      mode: 'keyword',
      limit: 200
    })

    if (data.success && data.results?.length) {
      const entities = data.results.map(r => r.entity)
      setGraphData(entities)
      await loadRelationsForEntities(entities.map(e => e.id))
    }
  } catch (err) {
    console.error('loadGraph failed:', err)
  } finally {
    loading.value = false
  }
}

async function loadRelationsForEntities(entityIds) {
  const links = []

  for (const id of entityIds.slice(0, 50)) {
    try {
      const { data } = await axios.get(`${API}/entity/${encodeURIComponent(id)}`)
      if (data.success && data.relations) {
        for (const rel of data.relations) {
          const fromId = rel.from || rel.from_id
          const toId = rel.to || rel.to_id
          if (entityMap.value.has(fromId) && entityMap.value.has(toId)) {
            links.push({
              source: fromId,
              target: toId,
              type: rel.type,
              id: rel.id
            })
          }
        }
      }
    } catch {}
  }

  allLinks.value = links
  visibleLinks.value = links
  renderGraph()
}

async function expandEntity(entityId) {
  try {
    const { data } = await axios.get(`${API}/entity/${encodeURIComponent(entityId)}`)
    if (data.success) {
      const newEntities = []
      if (data.relations) {
        for (const rel of data.relations) {
          const otherId = rel.from === entityId ? rel.to : rel.from
          if (!entityMap.value.has(otherId)) {
            try {
              const { data: eData } = await axios.get(`${API}/entity/${encodeURIComponent(otherId)}`)
              if (eData.success && eData.entity) {
                newEntities.push(eData.entity)
              }
            } catch {}
          }
        }
      }

      if (newEntities.length) {
        const combined = [...visibleNodes.value, ...newEntities]
        setGraphData(combined)
        await loadRelationsForEntities(combined.map(e => e.id))
      }
    }
  } catch (err) {
    console.error('expandEntity failed:', err)
  }
}

function navigateToEntity(entityId) {
  const entity = entityMap.value.get(entityId)
  if (entity) {
    selectedEntity.value = entity
    loadEntityRelations(entityId)
  }
}

async function loadEntityRelations(entityId) {
  try {
    const { data } = await axios.get(`${API}/entity/${encodeURIComponent(entityId)}`)
    selectedRelations.value = data.success ? (data.relations || []) : []
  } catch {
    selectedRelations.value = []
  }
}

// ============================================================
// Graph rendering
// ============================================================

function setGraphData(entities) {
  entityMap.value.clear()
  const nodes = []

  for (const e of entities) {
    if (entityMap.value.has(e.id)) continue
    entityMap.value.set(e.id, e)
    nodes.push({
      id: e.id,
      name: e.name || e.id,
      type: e.type || 'Entity',
      source_name: e.source || '',
      radius: getRadius(e.type),
      color: getColor(e.type)
    })
  }

  allNodes.value = nodes
  visibleNodes.value = nodes
}

function getRadius(type) {
  const sizes = { City: 8, Manufacturer: 7, UAV: 6, OntologyClass: 6, ScientificPaper: 5 }
  return sizes[type] || 5
}

function filterGraph() {
  if (filterType.value) {
    visibleNodes.value = allNodes.value.filter(n => n.type === filterType.value)
    const ids = new Set(visibleNodes.value.map(n => n.id))
    visibleLinks.value = allLinks.value.filter(l =>
      ids.has(typeof l.source === 'object' ? l.source.id : l.source) &&
      ids.has(typeof l.target === 'object' ? l.target.id : l.target)
    )
  } else {
    visibleNodes.value = [...allNodes.value]
    visibleLinks.value = [...allLinks.value]
  }
  renderGraph()
}

function renderGraph() {
  if (!svgRef.value || !graphContainer.value) return

  const container = graphContainer.value
  const width = container.clientWidth || 800
  const height = container.clientHeight || 600

  // Clear
  d3.select(svgRef.value).selectAll('*').remove()

  svg = d3.select(svgRef.value)
    .attr('viewBox', [0, 0, width, height])

  // Zoom
  zoom = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => g.attr('transform', event.transform))

  svg.call(zoom)

  g = svg.append('g')

  // Arrowhead marker
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#666')

  const nodes = visibleNodes.value.map(n => ({ ...n }))
  const links = visibleLinks.value.map(l => ({
    ...l,
    source: typeof l.source === 'object' ? l.source.id : l.source,
    target: typeof l.target === 'object' ? l.target.id : l.target
  }))

  // Links
  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.4)
    .attr('stroke-width', 1)
    .attr('marker-end', 'url(#arrowhead)')

  // Link labels
  const linkLabel = g.append('g')
    .selectAll('text')
    .data(links)
    .join('text')
    .text(d => d.type)
    .attr('font-size', '8px')
    .attr('fill', '#888')
    .attr('text-anchor', 'middle')

  // Nodes
  const node = g.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', (event, d) => {
      event.stopPropagation()
      const entity = entityMap.value.get(d.id)
      if (entity) {
        selectedEntity.value = entity
        loadEntityRelations(d.id)
      }
    })

  node.append('circle')
    .attr('r', d => d.radius)
    .attr('fill', d => d.color)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)

  node.append('text')
    .text(d => d.name.length > 20 ? d.name.substring(0, 20) + '…' : d.name)
    .attr('dx', d => d.radius + 3)
    .attr('dy', 3)
    .attr('font-size', '10px')
    .attr('fill', 'var(--p-text-color, #333)')

  // Tooltip
  node.append('title')
    .text(d => `${d.name}\nТип: ${d.type}\nИсточник: ${d.source_name}`)

  // Simulation
  if (simulation) simulation.stop()

  if (layoutType.value === 'force') {
    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.radius + 5))
      .on('tick', () => {
        link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
        linkLabel
          .attr('x', d => (d.source.x + d.target.x) / 2)
          .attr('y', d => (d.source.y + d.target.y) / 2)
        node.attr('transform', d => `translate(${d.x},${d.y})`)
      })
  } else if (layoutType.value === 'radial') {
    applyRadialLayout(nodes, width, height)
    updatePositions(link, linkLabel, node)
  } else if (layoutType.value === 'grid') {
    applyGridLayout(nodes, width, height)
    updatePositions(link, linkLabel, node)
  }

  // Click on background to deselect
  svg.on('click', () => {
    selectedEntity.value = null
    selectedRelations.value = []
  })
}

function applyRadialLayout(nodes, width, height) {
  const cx = width / 2, cy = height / 2
  const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1)
  const radius = Math.min(width, height) / 3

  nodes.forEach((n, i) => {
    n.x = cx + radius * Math.cos(i * angleStep)
    n.y = cy + radius * Math.sin(i * angleStep)
  })
}

function applyGridLayout(nodes, width, height) {
  const cols = Math.ceil(Math.sqrt(nodes.length))
  const cellW = width / (cols + 1)
  const cellH = height / (Math.ceil(nodes.length / cols) + 1)

  nodes.forEach((n, i) => {
    n.x = (i % cols + 1) * cellW
    n.y = (Math.floor(i / cols) + 1) * cellH
  })
}

function updatePositions(link, linkLabel, node) {
  link.attr('x1', d => d.source.x || 0).attr('y1', d => d.source.y || 0)
      .attr('x2', d => d.target.x || 0).attr('y2', d => d.target.y || 0)
  linkLabel
    .attr('x', d => ((d.source.x || 0) + (d.target.x || 0)) / 2)
    .attr('y', d => ((d.source.y || 0) + (d.target.y || 0)) / 2)
  node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`)
}

function dragstarted(event, d) {
  if (simulation) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }
}

function dragged(event, d) {
  d.fx = event.x
  d.fy = event.y
}

function dragended(event, d) {
  if (simulation) {
    if (!event.active) simulation.alphaTarget(0)
    d.fx = null
    d.fy = null
  }
}

function zoomToFit() {
  if (!svg || !g) return
  const bounds = g.node()?.getBBox()
  if (!bounds || bounds.width === 0) return

  const container = graphContainer.value
  const fullW = container.clientWidth
  const fullH = container.clientHeight
  const midX = bounds.x + bounds.width / 2
  const midY = bounds.y + bounds.height / 2
  const scale = 0.9 / Math.max(bounds.width / fullW, bounds.height / fullH)

  svg.transition().duration(500).call(
    zoom.transform,
    d3.zoomIdentity.translate(fullW / 2 - midX * scale, fullH / 2 - midY * scale).scale(scale)
  )
}

function applyLayout() {
  renderGraph()
}

// ============================================================
// Lifecycle
// ============================================================

onMounted(async () => {
  await loadStats()
})

onUnmounted(() => {
  if (simulation) simulation.stop()
})
</script>

<style scoped>
.kag-graph-explorer {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--p-surface-200);
  flex-shrink: 0;
}

.panel-toolbar h3 {
  margin: 0;
  font-size: 1rem;
}

.toolbar-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.filter-input {
  width: 200px;
  font-size: 0.85rem;
}

.filter-select {
  width: 150px;
  font-size: 0.85rem;
}

.graph-stats {
  display: flex;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
  flex-shrink: 0;
}

.graph-container {
  flex: 1;
  overflow: hidden;
  background: var(--p-surface-50);
  position: relative;
}

.graph-container svg {
  width: 100%;
  height: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 1rem;
  color: var(--p-text-muted-color);
}

.graph-legend {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 1rem;
  font-size: 0.8rem;
  border-top: 1px solid var(--p-surface-200);
  overflow-x: auto;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.legend-title {
  font-weight: 600;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.entity-detail {
  position: absolute;
  right: 1rem;
  top: 5rem;
  width: 320px;
  max-height: calc(100% - 8rem);
  overflow-y: auto;
  background: var(--p-surface-0);
  border: 1px solid var(--p-surface-200);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

.entity-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--p-surface-200);
}

.entity-detail-header h4 {
  margin: 0;
  font-size: 0.95rem;
}

.entity-detail-body {
  padding: 0.75rem 1rem;
}

.detail-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.4rem;
  font-size: 0.85rem;
}

.detail-label {
  font-weight: 600;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

.detail-observations p {
  font-size: 0.8rem;
  color: var(--p-text-secondary-color);
  margin: 0.25rem 0;
  line-height: 1.3;
}

.detail-relations {
  margin-top: 0.5rem;
}

.relation-item {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  padding: 0.2rem 0;
  font-size: 0.8rem;
  cursor: pointer;
}

.relation-item:hover {
  color: var(--p-primary-color);
}

.mt-2 {
  margin-top: 0.5rem;
}
</style>
