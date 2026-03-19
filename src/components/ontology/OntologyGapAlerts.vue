<template>
  <div class="ont-gaps" v-if="gaps.length > 0">
    <div class="ont-gaps__header">
      <i class="pi pi-exclamation-triangle" :style="{ color: headerColor }" />
      <span>Застрявшие процессы</span>
      <Badge :value="gaps.length" :severity="headerSeverity" />
    </div>

    <div
      v-for="gap in gaps"
      :key="`${gap.entityType}:${gap.entityId}`"
      class="ont-gap-row"
      :class="`ont-gap-row--${gap.severity}`"
    >
      <div class="ont-gap-icon">
        <i :class="entityIcon(gap.entityType)" :style="{ color: entityColor(gap.entityType) }" />
      </div>
      <div class="ont-gap-body">
        <div class="ont-gap-title">
          <span class="ont-gap-entity">{{ entityLabel(gap.entityType) }}</span>
          <span class="ont-gap-id">{{ gap.entityId }}</span>
        </div>
        <div class="ont-gap-detail">
          <span class="ont-gap-last">{{ getLabel(gap.lastEventType) }}</span>
          <span class="ont-gap-arrow">→</span>
          <span class="ont-gap-expected">{{ getLabel(gap.expectedNext) || 'следующий шаг' }}</span>
        </div>
      </div>
      <div class="ont-gap-days" :class="`ont-gap-days--${gap.severity}`">
        {{ Math.floor(gap.daysSince) }}д
      </div>
    </div>
  </div>

  <div v-else-if="showEmpty" class="ont-gaps-ok">
    <i class="pi pi-check-circle" style="color:#22c55e" />
    <span>Все процессы в норме</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Badge from 'primevue/badge'
import { useEventStore } from '@/stores/eventStore.js'
import { detectPlatformGaps } from '@/services/platformGapDetector.js'
import { getEventDef, EVENT_REGISTRY } from '@/config/eventRegistry.js'
import { ENTITY_TYPES } from '@/services/crossEntityReactor.js'

const props = defineProps({
  showEmpty: { type: Boolean, default: false },
  maxItems:  { type: Number, default: 10 },
})

const eventStore = useEventStore()

const gaps = computed(() => {
  const tl = {}
  for (const [k, v] of Object.entries(eventStore.timelines)) {
    tl[k] = v
  }
  return detectPlatformGaps(tl).slice(0, props.maxItems)
})

const headerSeverity = computed(() => {
  if (gaps.value.some(g => g.severity === 'critical')) return 'danger'
  if (gaps.value.some(g => g.severity === 'high'))     return 'warn'
  return 'secondary'
})

const headerColor = computed(() => {
  if (gaps.value.some(g => g.severity === 'critical')) return '#ef4444'
  if (gaps.value.some(g => g.severity === 'high'))     return '#f59e0b'
  return '#94a3b8'
})

function getLabel(type) {
  if (!type) return ''
  const clean = type.includes(':') ? type.split(':')[0] : type
  return EVENT_REGISTRY[clean]?.label || clean
}
function entityLabel(et) { return ENTITY_TYPES[et]?.label || et }
function entityIcon(et)  { return ENTITY_TYPES[et]?.icon  || 'pi pi-circle' }
function entityColor(et) { return ENTITY_TYPES[et]?.color || '#94a3b8' }
</script>

<style scoped>
.ont-gaps {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
}

.ont-gaps__header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 10px;
}

.ont-gap-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 7px;
  margin-bottom: 4px;
  border-left: 3px solid transparent;
}
.ont-gap-row--critical { border-left-color: #ef4444; background: #ef444408; }
.ont-gap-row--high     { border-left-color: #f59e0b; background: #f59e0b08; }
.ont-gap-row--medium   { border-left-color: #94a3b8; background: transparent; }

.ont-gap-icon {
  width: 26px; height: 26px;
  border-radius: 6px;
  background: var(--p-surface-card);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 12px;
}

.ont-gap-body { flex: 1; min-width: 0; }
.ont-gap-title {
  display: flex; gap: 6px; align-items: center;
}
.ont-gap-entity {
  font-weight: 600; font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.3px; color: var(--p-text-muted-color);
}
.ont-gap-id { font-size: 11px; color: var(--p-text-muted-color); }

.ont-gap-detail {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; margin-top: 2px;
  color: var(--p-text-color);
}
.ont-gap-arrow { color: var(--p-text-muted-color); }
.ont-gap-expected { color: var(--p-text-muted-color); font-style: italic; }

.ont-gap-days {
  font-weight: 700; font-size: 12px; white-space: nowrap;
}
.ont-gap-days--critical { color: #ef4444; }
.ont-gap-days--high     { color: #f59e0b; }
.ont-gap-days--medium   { color: var(--p-text-muted-color); }

.ont-gaps-ok {
  display: flex; align-items: center; gap: 8px;
  color: var(--p-text-muted-color); font-size: 13px; padding: 8px 0;
}
</style>
