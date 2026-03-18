<template>
  <!-- Badge size -->
  <div v-if="size === 'badge'" class="sod-widget sod-badge" :title="tooltipText">
    <i class="pi pi-bolt"></i>
    <span class="badge-count">{{ totalEvents }}</span>
  </div>

  <!-- Card size -->
  <div v-else-if="size === 'card'" class="sod-widget sod-card">
    <div class="card-header">
      <span class="card-domain">{{ domain || 'СОД' }}</span>
      <span class="card-total">{{ totalEvents }}</span>
    </div>
    <div class="card-events">
      <div v-for="ev in recentEvents" :key="ev.id" class="card-event">
        <span class="ce-type">{{ ev.shortType }}</span>
        <span class="ce-time">{{ ev.time }}</span>
      </div>
    </div>
  </div>

  <!-- Panel size -->
  <div v-else class="sod-widget sod-panel">
    <div class="panel-header">
      <h4><i class="pi pi-bolt"></i> {{ domain ? domain.toUpperCase() : 'СОД' }}</h4>
      <span class="panel-total">{{ totalEvents }} событий</span>
    </div>
    <div class="panel-stats">
      <div v-for="(count, type) in topTypes" :key="type" class="panel-stat">
        <div class="ps-bar" :style="{ width: (count / maxTypeCount * 100) + '%' }"></div>
        <span class="ps-type">{{ type }}</span>
        <span class="ps-count">{{ count }}</span>
      </div>
    </div>
    <div class="panel-events">
      <div v-for="ev in recentEvents" :key="ev.id" class="panel-event">
        <span class="pe-time">{{ ev.time }}</span>
        <span class="pe-type" :class="'sev-' + ev.severity">{{ ev.shortType }}</span>
        <span class="pe-value">{{ ev.title }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

const props = defineProps({
  domain: { type: String, default: null },
  size: { type: String, default: 'card' }, // badge, card, panel
  limit: { type: Number, default: 5 },
  apiBase: { type: String, default: '/api/event-engine' },
  refreshInterval: { type: Number, default: 30000 },
})

const events = ref([])
const totalEvents = ref(0)
let interval = null

const recentEvents = computed(() => events.value.slice(0, props.limit))

const topTypes = computed(() => {
  const counts = {}
  for (const ev of events.value) {
    counts[ev.shortType] = (counts[ev.shortType] || 0) + 1
  }
  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  )
})

const maxTypeCount = computed(() => {
  const vals = Object.values(topTypes.value)
  return vals.length ? Math.max(...vals) : 1
})

const tooltipText = computed(() =>
  `${totalEvents.value} событий${props.domain ? ' в ' + props.domain : ''}`
)

function parseEvent(raw) {
  const type = raw.val || ''
  const shortType = type.includes('.') ? type.split('.').slice(1).join('.') : type
  const value = raw.reqs?.['Значение']?.value || ''
  const title = value.split('\n')[0].substring(0, 60)
  const ts = raw.reqs?.['Временная метка']?.value || ''
  const time = ts.includes(' ') ? ts.split(' ')[1] : ts
  const severity = type.includes('failed') || type.includes('blocked') ? 'error'
    : type.includes('succeeded') || type.includes('deployed') ? 'success' : 'info'
  return { id: raw.id, type, shortType, title, time, severity }
}

async function load() {
  try {
    const url = props.domain
      ? `${props.apiBase}/events?limit=${props.limit * 2}&domain=${props.domain}`
      : `${props.apiBase}/events?limit=${props.limit * 2}`
    const { data } = await axios.get(url)
    if (data.success) {
      const all = (data.data || [])
      if (props.domain) {
        events.value = all.filter(e => (e.val || '').startsWith(props.domain + '.')).map(parseEvent)
      } else {
        events.value = all.map(parseEvent)
      }
      totalEvents.value = events.value.length
    }
  } catch {}
}

onMounted(() => {
  load()
  if (props.refreshInterval > 0) {
    interval = setInterval(load, props.refreshInterval)
  }
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<style scoped>
/* Badge */
.sod-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--p-primary-50);
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-primary-color);
  cursor: default;
}

.badge-count {
  background: var(--p-primary-color);
  color: white;
  padding: 0 5px;
  border-radius: 8px;
  font-size: 0.7rem;
}

/* Card */
.sod-card {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-card);
  padding: 8px 12px;
  min-width: 200px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.card-domain {
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  color: var(--p-primary-color);
}

.card-total {
  font-size: 0.75rem;
  background: var(--p-surface-100);
  padding: 1px 6px;
  border-radius: 8px;
}

.card-event {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
  font-size: 0.75rem;
}

.ce-type { font-weight: 500; }
.ce-time { color: var(--p-text-muted-color); }

/* Panel */
.sod-panel {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-card);
  padding: 12px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.panel-header h4 {
  margin: 0;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

.panel-total {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.panel-stats { margin-bottom: 8px; }

.panel-stat {
  position: relative;
  display: flex;
  align-items: center;
  padding: 2px 6px;
  margin: 1px 0;
  font-size: 0.75rem;
}

.ps-bar {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  background: var(--p-primary-50);
  border-radius: 3px;
}

.ps-type { position: relative; flex: 1; }
.ps-count { position: relative; font-weight: 600; }

.panel-events {
  border-top: 1px solid var(--p-surface-100);
  padding-top: 6px;
}

.panel-event {
  display: flex;
  gap: 6px;
  padding: 2px 0;
  font-size: 0.75rem;
}

.pe-time {
  font-family: monospace;
  color: var(--p-text-muted-color);
  min-width: 50px;
}

.pe-type { font-weight: 500; min-width: 100px; }
.pe-type.sev-error { color: #ef4444; }
.pe-type.sev-success { color: #10b981; }

.pe-value {
  flex: 1;
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
