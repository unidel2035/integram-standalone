<script setup>
/**
 * EntityContext — виджет "Где я нахожусь в онтологии"
 *
 * Встраивается в ЛЮБУЮ страницу. Показывает:
 * - текущую сущность (deal/company/session)
 * - текущую фазу в онтологии (ПП-3: ИК-1)
 * - следующее возможное событие (кнопка)
 * - переход к Command Center
 *
 * Это реализует принцип: "каждая страница знает своё место в графе"
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useEventStore } from '@/stores/eventStore.js'
import { buildPipelineStages } from '@/services/pipelineService.js'
import { ENTITY_LENSES } from '@/services/platformStateService.js'

const props = defineProps({
  entityType: { type: String, required: true },
  entityId:   { type: String, required: true },
  compact:    { type: Boolean, default: false },
})

const emit   = defineEmits(['action'])
const router = useRouter()
const store  = useEventStore()

const timeline = computed(() => store.getTimeline(props.entityType, props.entityId))
const state    = computed(() => store.getState(props.entityType, props.entityId))
const lens     = computed(() => ENTITY_LENSES[props.entityType] || {})

const pipelineStage = computed(() => {
  if (props.entityType !== 'deal') return null
  const stages = buildPipelineStages(props.entityId, store)
  return stages.find(s => s.status === 'active') || null
})

const nextAction = computed(() => pipelineStage.value?.nextPossible?.[0] || null)

const lastEvent = computed(() => timeline.value.at(-1) || null)
const eventsCount = computed(() => timeline.value.length)

function doAction() {
  if (nextAction.value) emit('action', nextAction.value)
}
</script>

<template>
  <div class="ec-widget" :class="{ 'ec-compact': compact }">
    <!-- Entity type badge -->
    <div class="ec-type" :style="{ color: lens.color }">
      <i :class="lens.icon"></i>
      <span>{{ lens.label }}</span>
      <code class="ec-id">{{ entityId }}</code>
    </div>

    <!-- Pipeline phase (для deal) -->
    <div v-if="pipelineStage" class="ec-phase">
      <i :class="pipelineStage.icon" :style="{ color: pipelineStage.color }"></i>
      <span>{{ pipelineStage.label }}: {{ pipelineStage.name }}</span>
    </div>

    <!-- Last event -->
    <div v-if="lastEvent" class="ec-last">
      <i :class="lastEvent.icon || 'pi pi-circle-fill'" style="font-size:9px; opacity:0.5"></i>
      <span>{{ lastEvent.label }}</span>
    </div>

    <!-- Next action button -->
    <div v-if="nextAction && !compact" class="ec-next">
      <Button
        :label="nextAction.label"
        :icon="nextAction.icon"
        size="small"
        severity="secondary"
        @click="doAction"
      />
    </div>

    <!-- Nav to CC -->
    <Button
      v-if="!compact"
      icon="pi pi-sitemap"
      severity="secondary"
      size="small"
      text
      title="Command Center"
      @click="router.push('/fst-cc')"
    />
  </div>
</template>

<style scoped>
.ec-widget {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  font-size: 12px;
  flex-wrap: wrap;
}

.ec-compact {
  padding: 4px 8px;
  gap: 6px;
}

.ec-type {
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.05em;
}

.ec-id {
  font-family: monospace;
  font-size: 9px;
  background: var(--p-surface-card);
  padding: 1px 4px;
  border-radius: 3px;
  color: var(--fst-purple);
}

.ec-phase {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--p-text-muted-color);
}

.ec-last {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--p-text-muted-color);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ec-next {
  margin-left: auto;
}
</style>
