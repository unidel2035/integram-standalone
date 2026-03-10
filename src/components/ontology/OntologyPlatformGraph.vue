<template>
  <div class="ont-graph">
    <div class="ont-graph__header">
      <i class="pi pi-share-alt" style="color:var(--p-primary-color)" />
      <span>Граф платформы</span>
      <div class="ont-graph__legend">
        <span v-for="et in visibleEntities" :key="et"
          class="ont-legend-dot"
          :style="{ background: ENTITY_TYPES[et]?.color }"
          :title="ENTITY_TYPES[et]?.label"
        />
      </div>
      <Button icon="pi pi-expand" size="small" text severity="secondary"
        @click="toggleFullscreen" style="margin-left:auto" />
    </div>

    <div ref="cyContainer" class="ont-graph__canvas" :class="{ fullscreen: isFullscreen }" />

    <!-- Selected node detail -->
    <div v-if="selected" class="ont-graph__detail">
      <i :class="entityIcon(selected.entityType)" :style="{ color: entityColor(selected.entityType) }" />
      <div>
        <div class="ont-graph__detail-label">{{ selected.label }}</div>
        <div class="ont-graph__detail-sub">{{ entityLabel(selected.entityType) }}</div>
      </div>
      <Button icon="pi pi-times" size="small" text severity="secondary"
        @click="selected = null" style="margin-left:auto" />
    </div>

    <!-- Upstream / downstream for selected -->
    <div v-if="selected" class="ont-graph__chains">
      <div v-if="upstreamLinks.length" class="ont-chain-col">
        <div class="ont-chain-title"><i class="pi pi-arrow-left" />Откуда</div>
        <div v-for="l in upstreamLinks" :key="l.id" class="ont-chain-item">
          <i :class="entityIcon(l.trigger.entityType)" :style="{ color: entityColor(l.trigger.entityType) }" />
          <span>{{ entityLabel(l.trigger.entityType) }} / {{ getLabel(l.trigger.eventType) }}</span>
        </div>
      </div>
      <div v-if="downstreamLinks.length" class="ont-chain-col">
        <div class="ont-chain-title">Куда<i class="pi pi-arrow-right" /></div>
        <div v-for="l in downstreamLinks" :key="l.id" class="ont-chain-item">
          <i :class="entityIcon(l.enables.entityType)" :style="{ color: entityColor(l.enables.entityType) }" />
          <span>{{ entityLabel(l.enables.entityType) }} / {{ getLabel(l.enables.eventType) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import Button from 'primevue/button'
import cytoscape from 'cytoscape'
import dagre from 'cytoscape-dagre'
import { fullChain, ENTITY_TYPES, getUpstream, getDownstream } from '@/services/crossEntityReactor.js'
import { getEventDef, EVENT_REGISTRY } from '@/config/eventRegistry.js'

cytoscape.use(dagre)

// ─── Data ─────────────────────────────────────────────────────────────────────

const { nodes, edges } = fullChain()
const visibleEntities = [...new Set(nodes.map(n => n.entityType))]

const cyContainer = ref(null)
let cy = null
const selected  = ref(null)
const isFullscreen = ref(false)

const upstreamLinks   = computed(() => selected.value
  ? getUpstream(selected.value.entityType, selected.value.eventType)
  : [])
const downstreamLinks = computed(() => selected.value
  ? getDownstream(selected.value.entityType, selected.value.eventType)
  : [])

// ─── Build cytoscape elements ─────────────────────────────────────────────────

function buildElements() {
  const cyNodes = nodes.map(n => ({
    data: {
      id:         n.id,
      label:      n.eventType.replace(/_/g, ' '),
      entityType: n.entityType,
      eventType:  n.eventType,
      color:      ENTITY_TYPES[n.entityType]?.color || '#94a3b8',
    },
  }))
  const cyEdges = edges.map(e => ({
    data: {
      id:     e.id,
      source: e.from,
      target: e.to,
      label:  e.condition ? `[${e.condition.values.join('/')}]` : '',
    },
  }))
  return [...cyNodes, ...cyEdges]
}

// ─── Init cytoscape ───────────────────────────────────────────────────────────

function initCy() {
  if (!cyContainer.value) return
  cy = cytoscape({
    container: cyContainer.value,
    elements:  buildElements(),
    style: [
      {
        selector: 'node',
        style: {
          'background-color':   'data(color)',
          'label':              'data(label)',
          'font-size':          9,
          'color':              '#ffffff',
          'text-valign':        'center',
          'text-halign':        'center',
          'text-wrap':          'wrap',
          'text-max-width':     70,
          'width':              80,
          'height':             30,
          'shape':              'round-rectangle',
          'border-width':       0,
          'padding':            6,
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 2,
          'border-color': '#ffffff',
          'opacity': 1,
        },
      },
      {
        selector: 'node.dimmed',
        style: { 'opacity': 0.25 },
      },
      {
        selector: 'node.highlighted',
        style: { 'border-width': 2, 'border-color': '#fff', 'opacity': 1 },
      },
      {
        selector: 'edge',
        style: {
          'width':               2,
          'line-color':          '#4b5563',
          'target-arrow-color':  '#4b5563',
          'target-arrow-shape':  'triangle',
          'curve-style':         'bezier',
          'label':               'data(label)',
          'font-size':           8,
          'color':               '#94a3b8',
          'text-background-color': 'transparent',
        },
      },
      {
        selector: 'edge.dimmed',
        style: { 'opacity': 0.15 },
      },
      {
        selector: 'edge.highlighted',
        style: { 'line-color': '#60a5fa', 'target-arrow-color': '#60a5fa', 'opacity': 1 },
      },
    ],
    layout: {
      name:      'dagre',
      rankDir:   'LR',
      nodeSep:   20,
      rankSep:   80,
      padding:   16,
    },
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: false,
  })

  cy.on('tap', 'node', evt => {
    const node = evt.target
    const d = node.data()
    selected.value = { id: d.id, label: d.label, entityType: d.entityType, eventType: d.eventType }

    // Highlight upstream/downstream, dim rest
    cy.elements().addClass('dimmed').removeClass('highlighted')
    const connected = node.connectedEdges().connectedNodes().add(node).add(node.connectedEdges())
    connected.removeClass('dimmed').addClass('highlighted')
  })

  cy.on('tap', evt => {
    if (evt.target === cy) {
      selected.value = null
      cy.elements().removeClass('dimmed highlighted')
    }
  })
}

onMounted(() => { initCy() })
onUnmounted(() => { cy?.destroy() })

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  setTimeout(() => cy?.resize()?.fit(), 50)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLabel(type) {
  const clean = type?.includes(':') ? type.split(':')[0] : type
  return EVENT_REGISTRY[clean]?.label || clean
}
function entityLabel(et) { return ENTITY_TYPES[et]?.label || et }
function entityIcon(et)  { return ENTITY_TYPES[et]?.icon  || 'pi pi-circle' }
function entityColor(et) { return ENTITY_TYPES[et]?.color || '#94a3b8' }
</script>

<style scoped>
.ont-graph {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  overflow: hidden;
  font-size: 13px;
}

.ont-graph__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--p-content-border-color);
  font-weight: 600;
}
.ont-graph__legend {
  display: flex;
  gap: 5px;
  margin-left: 8px;
}
.ont-legend-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.ont-graph__canvas {
  width: 100%;
  height: 340px;
  background: var(--p-surface-ground);
  transition: height 0.2s;
}
.ont-graph__canvas.fullscreen {
  height: 600px;
}

.ont-graph__detail {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-top: 1px solid var(--p-content-border-color);
  font-size: 13px;
}
.ont-graph__detail-label { font-weight: 600; }
.ont-graph__detail-sub   { color: var(--p-text-muted-color); font-size: 11px; }

.ont-graph__chains {
  display: flex;
  gap: 0;
  border-top: 1px solid var(--p-content-border-color);
}
.ont-chain-col {
  flex: 1;
  padding: 8px 14px;
}
.ont-chain-col + .ont-chain-col {
  border-left: 1px solid var(--p-content-border-color);
}
.ont-chain-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.ont-chain-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 3px 0;
  color: var(--p-text-color);
}
</style>
