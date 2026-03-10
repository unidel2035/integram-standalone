<template>
  <div class="causal" v-if="chain.length > 0">
    <div class="causal__header">
      <i class="pi pi-sitemap" style="color:var(--p-primary-color)" />
      <span>Почему так?</span>
    </div>

    <div v-for="node in chain" :key="node.eventTs + node.eventType" class="causal-node causal-node--root">
      <div class="causal-event">
        <i :class="node.icon" :style="{ color: node.color }" />
        <span class="causal-label">{{ node.label }}</span>
        <span class="causal-date">{{ fmtDate(node.eventTs) }}</span>
      </div>

      <div v-if="node.upstream?.length" class="causal-upstream">
        <div v-for="up in node.upstream" :key="up.eventTs + up.eventType" class="causal-node causal-node--up">
          <div class="causal-connector"><i class="pi pi-arrow-up-left" /></div>
          <div class="causal-event">
            <i :class="entityIcon(up.entityType)" :style="{ color: entityColor(up.entityType) }" />
            <span class="causal-entity-badge" :style="{ color: entityColor(up.entityType) }">
              {{ entityLabel(up.entityType) }}
            </span>
            <span class="causal-label">{{ up.label }}</span>
            <span class="causal-date">{{ fmtDate(up.eventTs) }}</span>
          </div>

          <!-- One more level -->
          <div v-if="up.upstream?.length" class="causal-upstream causal-upstream--deep">
            <div v-for="deep in up.upstream" :key="deep.eventTs" class="causal-node causal-node--deep">
              <div class="causal-connector"><i class="pi pi-arrow-up-left" /></div>
              <div class="causal-event">
                <i :class="entityIcon(deep.entityType)" :style="{ color: entityColor(deep.entityType) }" />
                <span class="causal-entity-badge" :style="{ color: entityColor(deep.entityType) }">
                  {{ entityLabel(deep.entityType) }}
                </span>
                <span class="causal-label">{{ deep.label }}</span>
                <span class="causal-date">{{ fmtDate(deep.eventTs) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useEventStore } from '@/stores/eventStore.js'
import { explainState } from '@/services/causalExplainer.js'
import { ENTITY_TYPES } from '@/services/crossEntityReactor.js'

const props = defineProps({
  entityType: { type: String, required: true },
  entityId:   { type: String, required: true },
})

const eventStore = useEventStore()

const chain = computed(() => {
  const timeline = eventStore.getTimeline(props.entityType, props.entityId)
  if (!timeline.length) return []
  try {
    return explainState(props.entityType, props.entityId, timeline, eventStore.timelines)
  } catch { return [] }
})

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
function entityLabel(et) { return ENTITY_TYPES[et]?.label || et }
function entityIcon(et)  { return ENTITY_TYPES[et]?.icon  || 'pi pi-circle' }
function entityColor(et) { return ENTITY_TYPES[et]?.color || '#94a3b8' }
</script>

<style scoped>
.causal {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
}
.causal__header {
  display: flex; align-items: center; gap: 8px;
  font-weight: 600; margin-bottom: 10px;
}

.causal-node { }
.causal-node--root { margin-bottom: 8px; }

.causal-event {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--p-surface-ground);
}
.causal-label  { flex: 1; font-weight: 500; }
.causal-date   { color: var(--p-text-muted-color); font-size: 11px; white-space: nowrap; }
.causal-entity-badge {
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.3px;
}

.causal-upstream {
  padding-left: 20px;
  margin-top: 4px;
  border-left: 2px solid var(--p-content-border-color);
  margin-left: 14px;
}
.causal-upstream--deep {
  padding-left: 16px;
}

.causal-connector {
  color: var(--p-text-muted-color);
  font-size: 10px;
  margin-bottom: 2px;
  margin-top: 4px;
}

.causal-node--up   { margin-bottom: 4px; }
.causal-node--deep { margin-bottom: 2px; }
</style>
