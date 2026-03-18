<template>
  <div class="timeline-panel">
    <div class="panel-toolbar">
      <h3><i class="pi pi-calendar"></i> Timeline</h3>
      <div class="timeline-controls">
        <SelectButton v-model="period" :options="periods" optionLabel="label" optionValue="value" />
        <Button icon="pi pi-refresh" severity="secondary" text @click="loadData" :loading="loading" />
      </div>
    </div>

    <!-- Trend summary -->
    <div v-if="trends" class="trend-summary">
      <div class="trend-badge" :class="'trend-' + trends.trend">
        <i :class="trendIcon"></i>
        {{ trends.trend === 'rising' ? 'Рост' : trends.trend === 'falling' ? 'Спад' : 'Стабильно' }}
        <span v-if="trends.changePercent">{{ trends.changePercent > 0 ? '+' : '' }}{{ trends.changePercent }}%</span>
      </div>
      <span class="trend-info">{{ trends.eventsAnalyzed }} событий</span>
    </div>

    <!-- Swim lanes -->
    <div class="swim-lanes" ref="lanesEl">
      <div class="time-axis">
        <div v-for="t in timeLabels" :key="t.key" class="time-label" :style="{ left: t.left + '%' }">
          {{ t.label }}
        </div>
      </div>

      <div v-for="lane in lanes" :key="lane.domain" class="swim-lane">
        <div class="lane-header" :style="{ borderLeftColor: lane.color }">
          <span class="lane-name">{{ lane.domain }}</span>
          <span class="lane-count">{{ lane.events.length }}</span>
        </div>
        <div class="lane-body">
          <div v-for="ev in lane.events" :key="ev.id" class="lane-event"
            :class="'severity-' + ev.severity"
            :style="{ left: ev.position + '%' }"
            :title="ev.type + '\n' + ev.timestamp + '\n' + ev.title"
            @click="selectedEvent = ev">
            <div class="event-dot" :style="{ background: lane.color }"></div>
          </div>
        </div>
      </div>

      <div v-if="lanes.length === 0 && !loading" class="empty-state">
        <i class="pi pi-calendar"></i>
        <p>Нет событий для отображения</p>
      </div>
    </div>

    <!-- Top types chart -->
    <div v-if="trends?.topTypes?.length" class="top-types">
      <h4>Топ типов за последний период</h4>
      <div v-for="t in trends.topTypes" :key="t.type" class="type-bar-row">
        <span class="type-name">{{ t.type }}</span>
        <div class="type-bar">
          <div class="type-fill" :style="{ width: (t.count / maxTypeCount * 100) + '%', background: getDomainColor(t.type) }"></div>
        </div>
        <span class="type-count">{{ t.count }}</span>
      </div>
    </div>

    <!-- Selected event -->
    <div v-if="selectedEvent" class="selected-info">
      <div class="si-header">
        <strong>{{ selectedEvent.type }}</strong>
        <Button icon="pi pi-times" text size="small" @click="selectedEvent = null" />
      </div>
      <div class="si-body">
        <div>{{ selectedEvent.timestamp }}</div>
        <div v-if="selectedEvent.title" class="si-title">{{ selectedEvent.title }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'

const api = inject('eventEngineApi')
const loading = ref(false)
const period = ref('day')
const events = ref([])
const trends = ref(null)
const selectedEvent = ref(null)

const periods = [
  { label: 'Час', value: 'hour' },
  { label: 'День', value: 'day' },
  { label: 'Неделя', value: 'week' },
  { label: 'Месяц', value: 'month' },
]

const DOMAIN_COLORS = {
  dev: '#3b82f6', ops: '#10b981', infra: '#f59e0b', twin: '#8b5cf6',
  reg: '#ef4444', risk: '#f97316', market: '#06b6d4', swarm: '#ec4899',
  train: '#84cc16', strategy: '#6366f1', session: '#94a3b8', content: '#78716c',
}

function getDomainColor(type) {
  const domain = type.includes('.') ? type.split('.')[0] : 'other'
  return DOMAIN_COLORS[domain] || '#64748b'
}

function parseTimestamp(ts) {
  if (!ts) return 0
  if (ts.includes('T')) return new Date(ts).getTime()
  const [datePart, timePart] = ts.split(' ')
  if (!datePart) return 0
  const [d, m, y] = datePart.split('.')
  if (!y) return 0
  return new Date(`${y}-${m}-${d}T${timePart || '00:00:00'}`).getTime()
}

function getSeverity(type) {
  if (type.includes('failed') || type.includes('blocked')) return 'error'
  if (type.includes('warning') || type.includes('anomaly')) return 'warn'
  if (type.includes('succeeded') || type.includes('deployed')) return 'success'
  return 'info'
}

const trendIcon = computed(() => {
  if (!trends.value) return 'pi pi-minus'
  return trends.value.trend === 'rising' ? 'pi pi-arrow-up' :
    trends.value.trend === 'falling' ? 'pi pi-arrow-down' : 'pi pi-minus'
})

const maxTypeCount = computed(() => {
  if (!trends.value?.topTypes?.length) return 1
  return Math.max(...trends.value.topTypes.map(t => t.count))
})

// Compute swim lanes from events
const lanes = computed(() => {
  const domainMap = {}
  let minTs = Infinity, maxTs = -Infinity

  for (const ev of events.value) {
    const ts = parseTimestamp(ev.reqs?.['Временная метка']?.value)
    if (!ts || ts < 1000000000000) continue // skip epoch 0
    if (ts < minTs) minTs = ts
    if (ts > maxTs) maxTs = ts

    const type = ev.val || ''
    const domain = type.includes('.') ? type.split('.')[0] : 'other'
    if (!domainMap[domain]) domainMap[domain] = []

    domainMap[domain].push({
      id: ev.id,
      type,
      domain,
      timestamp: ev.reqs?.['Временная метка']?.value,
      ts,
      title: (ev.reqs?.['Значение']?.value || '').split('\n')[0].substring(0, 80),
      severity: getSeverity(type),
    })
  }

  const range = maxTs - minTs || 1

  return Object.entries(domainMap)
    .map(([domain, evts]) => ({
      domain,
      color: DOMAIN_COLORS[domain] || '#64748b',
      events: evts.map(e => ({
        ...e,
        position: ((e.ts - minTs) / range) * 100,
      })).sort((a, b) => a.ts - b.ts),
    }))
    .sort((a, b) => b.events.length - a.events.length)
})

// Time axis labels
const timeLabels = computed(() => {
  const allTs = events.value
    .map(e => parseTimestamp(e.reqs?.['Временная метка']?.value))
    .filter(t => t > 1000000000000)

  if (allTs.length < 2) return []
  const min = Math.min(...allTs)
  const max = Math.max(...allTs)
  const range = max - min || 1
  const steps = 6
  const labels = []

  for (let i = 0; i <= steps; i++) {
    const ts = min + (range * i / steps)
    const d = new Date(ts)
    const label = period.value === 'hour'
      ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
      : period.value === 'day'
        ? `${d.getHours()}:00`
        : `${d.getDate()}.${d.getMonth() + 1}`

    labels.push({ key: i, left: (i / steps) * 100, label })
  }

  return labels
})

async function loadData() {
  loading.value = true
  try {
    const [evResp, trResp] = await Promise.all([
      api.get('/events?limit=500'),
      api.get(`/predictions/trends?period=${period.value}`),
    ])
    if (evResp.data.success) events.value = evResp.data.data || []
    if (trResp.data.success) trends.value = trResp.data.data
  } catch (e) { console.error('Timeline load error', e) }
  loading.value = false
}

onMounted(loadData)
</script>

<style scoped>
.timeline-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.panel-toolbar h3 {
  margin: 0;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.trend-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  background: var(--p-surface-50);
  border-radius: 8px;
  margin-bottom: 8px;
}

.trend-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.trend-rising { background: #dcfce7; color: #16a34a; }
.trend-falling { background: #fef2f2; color: #dc2626; }
.trend-stable { background: #f1f5f9; color: #64748b; }
.trend-info { font-size: 0.8rem; color: var(--p-text-muted-color); }

/* Swim lanes */
.swim-lanes {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-card);
  position: relative;
}

.time-axis {
  position: sticky;
  top: 0;
  z-index: 2;
  height: 24px;
  background: var(--p-surface-50);
  border-bottom: 1px solid var(--p-surface-border);
}

.time-label {
  position: absolute;
  top: 4px;
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  transform: translateX(-50%);
}

.swim-lane {
  display: flex;
  border-bottom: 1px solid var(--p-surface-100);
  min-height: 36px;
}

.lane-header {
  width: 80px;
  min-width: 80px;
  padding: 4px 8px;
  border-left: 3px solid;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--p-surface-50);
}

.lane-name {
  font-size: 0.75rem;
  font-weight: 600;
}

.lane-count {
  font-size: 0.65rem;
  color: var(--p-text-muted-color);
}

.lane-body {
  flex: 1;
  position: relative;
  padding: 4px 0;
}

.lane-event {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  cursor: pointer;
  z-index: 1;
}

.event-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: transform 0.15s;
}

.lane-event:hover .event-dot {
  transform: scale(2);
  box-shadow: 0 0 6px rgba(0,0,0,0.3);
}

.lane-event.severity-error .event-dot { box-shadow: 0 0 4px #ef4444; }
.lane-event.severity-success .event-dot { box-shadow: 0 0 4px #10b981; }

/* Top types */
.top-types {
  margin-top: 8px;
  padding: 8px 0;
}

.top-types h4 {
  margin: 0 0 8px;
  font-size: 0.9rem;
}

.type-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.type-name {
  font-size: 0.8rem;
  min-width: 160px;
  text-align: right;
  color: var(--p-text-muted-color);
}

.type-bar {
  flex: 1;
  height: 14px;
  background: var(--p-surface-100);
  border-radius: 4px;
  overflow: hidden;
}

.type-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.type-count {
  font-size: 0.8rem;
  font-weight: 600;
  min-width: 30px;
}

/* Selected event */
.selected-info {
  margin-top: 8px;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-card);
}

.si-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  border-bottom: 1px solid var(--p-surface-100);
}

.si-body { padding: 6px 12px; font-size: 0.85rem; }
.si-title { color: var(--p-text-muted-color); margin-top: 4px; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: var(--p-text-muted-color);
}

.empty-state i { font-size: 2rem; margin-bottom: 8px; }
</style>
