<template>
  <div class="kanban-panel">
    <div class="panel-toolbar">
      <h3><i class="pi pi-th-large"></i> Канбан FSM</h3>
      <div class="kanban-controls">
        <Select v-model="selectedDomain" :options="domainOptions" optionLabel="label" optionValue="value"
          placeholder="Домен" class="domain-select" @change="loadFSM" />
        <Button icon="pi pi-refresh" severity="secondary" text @click="loadFSM" :loading="loading" />
      </div>
    </div>

    <div v-if="!selectedDomain" class="empty-state">
      <i class="pi pi-th-large"></i>
      <p>Выберите домен для отображения канбан-борда</p>
    </div>

    <div v-else class="kanban-board">
      <div v-for="col in columns" :key="col.state" class="kanban-column"
        :class="{ 'is-over': dragOverColumn === col.state }"
        @dragover.prevent="dragOverColumn = col.state"
        @dragleave="dragOverColumn = null"
        @drop="onDrop($event, col.state)">
        <div class="column-header" :style="{ borderBottomColor: col.color }">
          <span class="col-name">{{ col.state }}</span>
          <span class="col-count">{{ col.cards.length }}</span>
        </div>
        <div class="column-body">
          <div v-for="card in col.cards" :key="card.id" class="kanban-card"
            draggable="true"
            @dragstart="onDragStart($event, card)"
            @click="selectedCard = card">
            <div class="card-type">{{ card.lastEvent }}</div>
            <div class="card-title">{{ card.title }}</div>
            <div class="card-meta">
              <span v-if="card.actor" class="card-actor"><i class="pi pi-user"></i> {{ card.actor }}</span>
              <span class="card-time">{{ card.lastTime }}</span>
            </div>
          </div>
          <div v-if="col.cards.length === 0" class="col-empty">Пусто</div>
        </div>
      </div>
    </div>

    <!-- Card detail -->
    <Dialog v-model:visible="showCardDetail" :header="selectedCard?.title || 'Индивид'" modal
      :style="{ width: '500px' }">
      <div v-if="selectedCard" class="card-detail">
        <div class="cd-row"><span>ID:</span> #{{ selectedCard.id }}</div>
        <div class="cd-row"><span>Состояние:</span> <Tag :value="selectedCard.currentState" /></div>
        <div class="cd-row"><span>Последнее событие:</span> {{ selectedCard.lastEvent }}</div>
        <div class="cd-row"><span>Время:</span> {{ selectedCard.lastTime }}</div>
        <div class="cd-row" v-if="selectedCard.actor"><span>Актор:</span> {{ selectedCard.actor }}</div>
        <div class="cd-row" v-if="selectedCard.value"><span>Значение:</span> {{ selectedCard.value }}</div>
        <h5>Возможные переходы</h5>
        <div v-for="tr in selectedCard.transitions" :key="tr.to" class="cd-transition"
          @click="executeTransition(selectedCard, tr)">
          <i class="pi pi-arrow-right"></i>
          {{ tr.event || '?' }} → <strong>{{ tr.to }}</strong>
          <span v-if="tr.guard" class="cd-guard">[{{ tr.guard }}]</span>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'

const api = inject('eventEngineApi')
const loading = ref(false)
const selectedDomain = ref(null)
const fsmStates = ref([])
const fsmTransitions = ref([])
const individuals = ref([])
const selectedCard = ref(null)
const showCardDetail = ref(false)
const dragOverColumn = ref(null)
let draggedCard = null

const STATE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
]

const domainOptions = [
  { label: 'DevOps', value: 'devops' },
  { label: 'Operations', value: 'operations' },
  { label: 'Monitoring', value: 'monitoring' },
  { label: 'Digital Twin', value: 'digital-twin' },
  { label: 'Regulatory', value: 'regulatory' },
  { label: 'Insurance', value: 'insurance' },
  { label: 'Marketplace', value: 'marketplace' },
  { label: 'Swarm', value: 'swarm' },
  { label: 'Training', value: 'training' },
]

const columns = computed(() => {
  if (fsmStates.value.length === 0) return []

  // Group individuals by their current FSM state
  const stateMap = {}
  for (const state of fsmStates.value) {
    stateMap[state] = []
  }
  // Add "unassigned" column for individuals without state
  stateMap['(без состояния)'] = []

  for (const ind of individuals.value) {
    const state = ind.currentState || '(без состояния)'
    if (!stateMap[state]) stateMap[state] = []
    stateMap[state].push(ind)
  }

  return Object.entries(stateMap)
    .filter(([, cards]) => cards.length > 0 || fsmStates.value.includes(arguments[0]))
    .map(([state, cards], idx) => ({
      state,
      color: STATE_COLORS[idx % STATE_COLORS.length],
      cards,
    }))
})

async function loadFSM() {
  if (!selectedDomain.value) return
  loading.value = true
  try {
    // Load FSM states and transitions from domain
    const [fsmResp, eventsResp] = await Promise.all([
      api.get(`/fsm?domain=${selectedDomain.value}`),
      api.get(`/events?limit=500`),
    ])

    if (fsmResp.data.success) {
      const fsm = fsmResp.data.data
      fsmStates.value = fsm.states || []
      fsmTransitions.value = fsm.transitions || []
    }

    // Build individual cards from events
    if (eventsResp.data.success) {
      const domainPrefix = {
        devops: 'dev.', operations: 'ops.', monitoring: 'infra.',
        'digital-twin': 'twin.', regulatory: 'reg.', insurance: 'risk.',
        marketplace: 'market.', swarm: 'swarm.', training: 'train.',
      }[selectedDomain.value] || ''

      const domainEvents = (eventsResp.data.data || [])
        .filter(e => (e.val || '').startsWith(domainPrefix))

      // Group by individual
      const indMap = {}
      for (const ev of domainEvents) {
        const indId = ev.reqs?.['Индивид']?.value
        if (!indId) continue
        if (!indMap[indId]) indMap[indId] = { id: indId, events: [] }
        indMap[indId].events.push(ev)
      }

      // Determine current state from last event
      individuals.value = Object.values(indMap).map(ind => {
        const sorted = ind.events.sort((a, b) => {
          const tA = a.reqs?.['Временная метка']?.value || ''
          const tB = b.reqs?.['Временная метка']?.value || ''
          return tB.localeCompare(tA)
        })
        const last = sorted[0]
        const lastType = last?.val || ''
        const value = last?.reqs?.['Значение']?.value || ''
        const title = value.split('\n')[0].substring(0, 60) || lastType

        // Map event type to FSM state
        const currentState = this_mapEventToState(lastType, fsmStates.value)

        // Available transitions from current state
        const transitions = fsmTransitions.value.filter(t => t.from === currentState)

        return {
          id: ind.id,
          title,
          lastEvent: lastType,
          lastTime: last?.reqs?.['Временная метка']?.value || '',
          actor: last?.reqs?.['Актор']?.displayValue || null,
          value: value.substring(0, 100),
          currentState,
          transitions,
          eventCount: ind.events.length,
        }
      })
    }
  } catch (e) { console.error('Kanban load error', e) }
  loading.value = false
}

function this_mapEventToState(eventType, states) {
  // Try to find a matching state name from the event type
  const shortType = eventType.includes('.') ? eventType.split('.').slice(1).join('.') : eventType
  // Direct match
  for (const s of states) {
    if (s.toLowerCase() === shortType.toLowerCase()) return s
    if (shortType.includes(s.toLowerCase())) return s
  }
  // Heuristic mapping
  const heuristics = {
    'issue_opened': 'open', 'task_started': 'in_progress', 'code_committed': 'in_progress',
    'build_succeeded': 'review', 'pr_opened': 'review', 'pr_merged': 'done',
    'deployed': 'done', 'build_failed': 'blocked', 'task_blocked': 'blocked',
    'mission_created': 'planning', 'mission_started': 'active', 'mission_completed': 'done',
  }
  const mapped = heuristics[shortType]
  if (mapped) {
    const found = states.find(s => s.toLowerCase().includes(mapped))
    if (found) return found
  }
  return states[0] || '(без состояния)'
}

function onDragStart(event, card) {
  draggedCard = card
  event.dataTransfer.effectAllowed = 'move'
}

async function onDrop(event, targetState) {
  dragOverColumn.value = null
  if (!draggedCard || draggedCard.currentState === targetState) return

  // Find transition
  const transition = draggedCard.transitions?.find(t => t.to === targetState)
  if (transition) {
    await executeTransition(draggedCard, transition)
  } else {
    // Force move (admin override)
    draggedCard.currentState = targetState
  }
  draggedCard = null
}

async function executeTransition(card, transition) {
  try {
    const eventType = `${selectedDomain.value === 'devops' ? 'dev' : selectedDomain.value}.${transition.event || 'state_changed'}`
    await api.post('/events', {
      name: eventType,
      individualId: card.id,
      value: `FSM transition: ${card.currentState} → ${transition.to}`,
    })
    await loadFSM()
    showCardDetail.value = false
  } catch (e) {
    console.error('Transition failed', e)
  }
}

watch(selectedCard, (card) => {
  if (card) showCardDetail.value = true
})

onMounted(() => {
  if (selectedDomain.value) loadFSM()
})
</script>

<style scoped>
.kanban-panel {
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

.kanban-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.domain-select { width: 180px; }

.kanban-board {
  display: flex;
  gap: 12px;
  flex: 1;
  overflow-x: auto;
  padding-bottom: 12px;
}

.kanban-column {
  min-width: 220px;
  max-width: 280px;
  flex: 1;
  background: var(--p-surface-50);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  transition: background 0.2s;
}

.kanban-column.is-over {
  background: var(--p-primary-50);
}

.column-header {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 3px solid;
  font-weight: 600;
  font-size: 0.85rem;
}

.col-count {
  background: var(--p-surface-200);
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
}

.column-body {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kanban-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 6px;
  padding: 8px 10px;
  cursor: grab;
  transition: box-shadow 0.2s;
}

.kanban-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.kanban-card:active { cursor: grabbing; }

.card-type {
  font-size: 0.7rem;
  color: var(--p-primary-color);
  font-weight: 600;
  margin-bottom: 2px;
}

.card-title {
  font-size: 0.8rem;
  line-height: 1.3;
  margin-bottom: 4px;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
}

.card-actor {
  display: flex;
  align-items: center;
  gap: 3px;
}

.col-empty {
  text-align: center;
  padding: 20px;
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

/* Card detail dialog */
.card-detail {}

.cd-row {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  font-size: 0.9rem;
}

.cd-row span:first-child {
  font-weight: 600;
  min-width: 120px;
  color: var(--p-text-muted-color);
}

.cd-transition {
  padding: 6px 10px;
  margin: 4px 0;
  background: var(--p-surface-50);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s;
}

.cd-transition:hover { background: var(--p-primary-50); }

.cd-guard {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  margin-left: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px;
  color: var(--p-text-muted-color);
}

.empty-state i { font-size: 3rem; margin-bottom: 12px; }
</style>
