<template>
  <div class="ont-next-steps" v-if="hasSteps">
    <div class="ont-next-steps__header">
      <i class="pi pi-compass" />
      <span>Следующий шаг</span>
      <Tag v-if="currentPhaseLabel" :value="currentPhaseLabel" severity="secondary" class="ont-phase-tag" />
    </div>

    <!-- Последнее событие -->
    <div class="ont-last-event" v-if="lastEvent">
      <i :class="lastEvent.icon" :style="{ color: lastEvent.color }" />
      <span class="ont-last-event__label">{{ lastEvent.label }}</span>
      <span class="ont-last-event__ago">{{ timeAgo(lastEvent.ts) }}</span>
    </div>

    <!-- Intra-entity: следующие события внутри сущности -->
    <div v-if="intraSteps.length" class="ont-section">
      <div class="ont-section__title">В этой сущности</div>
      <div
        v-for="step in intraSteps"
        :key="step.id"
        class="ont-step ont-step--intra"
      >
        <div class="ont-step__icon-wrap">
          <i :class="step.icon" :style="{ color: step.color }" />
        </div>
        <div class="ont-step__body">
          <div class="ont-step__label">{{ step.label }}</div>
          <div v-if="step.subject" class="ont-step__meta">{{ step.subject }} → {{ step.object }}</div>
          <div v-if="step.enables?.length" class="ont-step__enables">
            <span>открывает:</span>
            <span v-for="e in step.enables.slice(0, 3)" :key="e" class="ont-step__enable-tag">
              {{ getLabel(e) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Cross-entity: события в других сущностях -->
    <div v-if="crossSteps.length" class="ont-section">
      <div class="ont-section__title">Это затронет</div>
      <div
        v-for="link in crossSteps"
        :key="link.id"
        class="ont-step ont-step--cross"
      >
        <div class="ont-step__icon-wrap" :style="{ background: entityColor(link.enables.entityType) + '22' }">
          <i :class="entityIcon(link.enables.entityType)" :style="{ color: entityColor(link.enables.entityType) }" />
        </div>
        <div class="ont-step__body">
          <div class="ont-step__label">
            <span class="ont-entity-badge" :style="{ color: entityColor(link.enables.entityType) }">
              {{ entityLabel(link.enables.entityType) }}
            </span>
            {{ getLabel(link.enables.eventType) }}
          </div>
          <div class="ont-step__meta">{{ link.label }}</div>
          <div v-if="link.condition" class="ont-step__condition">
            <i class="pi pi-filter" style="font-size:10px" />
            если {{ link.condition.field }}: {{ link.condition.values.join(' / ') }}
          </div>
          <div class="ont-step__cardinality">{{ link.cardinality }}</div>
        </div>
      </div>
    </div>

    <!-- Нет событий — пустое состояние -->
    <div v-if="!lastEvent && !intraSteps.length && !crossSteps.length" class="ont-empty">
      <i class="pi pi-clock" />
      <span>Ожидание первого события</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useEventStore } from '@/stores/eventStore.js'
import { getEventDef, EVENT_REGISTRY } from '@/config/eventRegistry.js'
import { nextCrossEntityEvents, ENTITY_TYPES } from '@/services/crossEntityReactor.js'

const props = defineProps({
  entityType: { type: String, required: true },
  entityId:   { type: String, required: true },
})

const eventStore = useEventStore()

// ─── Данные ───────────────────────────────────────────────────────────────────

const timeline = computed(() => eventStore.getTimeline(props.entityType, props.entityId))
const lastEvent = computed(() => {
  const e = timeline.value.at(-1)
  if (!e) return null
  const def = getEventDef(e.type)
  return { ...e, ...def }
})

const currentPhaseLabel = computed(() => {
  const state = eventStore.getState(props.entityType, props.entityId)
  return state?.phase || null
})

// ─── Intra-entity next steps ──────────────────────────────────────────────────
// Берём enables последнего события → резолвим определения

const intraSteps = computed(() => {
  if (!lastEvent.value) return []
  const enables = lastEvent.value.enables || []
  return enables
    .map(id => {
      // enables может быть "MEASURE_APPLIED:fasie-umnik" — берём только тип
      const eventType = id.includes(':') ? id.split(':')[0] : id
      return EVENT_REGISTRY[eventType]
    })
    .filter(Boolean)
    .filter(def => def.entityType === props.entityType || !def.entityType)
    .slice(0, 4)
})

// ─── Cross-entity next steps ──────────────────────────────────────────────────

const crossSteps = computed(() => {
  if (!lastEvent.value) return []
  return nextCrossEntityEvents({
    entityType: props.entityType,
    type: lastEvent.value.type,
    data: lastEvent.value.data || {},
  })
})

const hasSteps = computed(() =>
  lastEvent.value || intraSteps.value.length || crossSteps.value.length
)

// ─── Хелперы ──────────────────────────────────────────────────────────────────

function getLabel(eventType) {
  const clean = eventType?.includes(':') ? eventType.split(':')[0] : eventType
  return EVENT_REGISTRY[clean]?.label || clean
}

function entityLabel(et) {
  return ENTITY_TYPES[et]?.label || et
}
function entityIcon(et) {
  return ENTITY_TYPES[et]?.icon || 'pi pi-circle'
}
function entityColor(et) {
  return ENTITY_TYPES[et]?.color || '#94a3b8'
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(diff / 3_600_000)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(diff / 86_400_000)
  return `${d} дн назад`
}
</script>

<style scoped>
.ont-next-steps {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 13px;
}

.ont-next-steps__header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 12px;
}
.ont-next-steps__header .pi-compass {
  color: var(--p-primary-color);
  font-size: 15px;
}
.ont-phase-tag {
  margin-left: auto;
  font-size: 11px;
}

/* Last event */
.ont-last-event {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--p-surface-card);
  border-radius: 6px;
  margin-bottom: 12px;
}
.ont-last-event__label {
  flex: 1;
  font-weight: 500;
}
.ont-last-event__ago {
  color: var(--p-text-muted-color);
  font-size: 11px;
  white-space: nowrap;
}

/* Sections */
.ont-section {
  margin-bottom: 10px;
}
.ont-section__title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
}

/* Steps */
.ont-step {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 8px 10px;
  border-radius: 7px;
  margin-bottom: 4px;
  transition: background 0.15s;
}
.ont-step:hover {
  background: var(--p-surface-card);
}
.ont-step--intra {
  border-left: 2px solid var(--p-primary-color);
}
.ont-step--cross {
  border-left: 2px solid var(--p-content-border-color);
}

.ont-step__icon-wrap {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--p-surface-card);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
}

.ont-step__body {
  flex: 1;
  min-width: 0;
}
.ont-step__label {
  font-weight: 500;
  color: var(--p-text-color);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.ont-entity-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.ont-step__meta {
  color: var(--p-text-muted-color);
  font-size: 11px;
  margin-top: 2px;
}
.ont-step__enables {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 4px;
  font-size: 11px;
  color: var(--p-text-muted-color);
}
.ont-step__enable-tag {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 10px;
  color: var(--p-text-color);
}
.ont-step__condition {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.ont-step__cardinality {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}

/* Empty */
.ont-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--p-text-muted-color);
  font-size: 12px;
  padding: 8px 0;
}
</style>
