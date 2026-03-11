<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { CROSS_ENTITY_LINKS, ENTITY_TYPES } from '@/services/crossEntityReactor.js'
import { useEventStore } from '@/stores/eventStore.js'

const props = defineProps({
  dealId:  { type: String, required: true },
  stages:  { type: Array, default: () => [] },
})

const router = useRouter()
const eventStore = useEventStore()

// Какие события уже произошли в этой сделке (deal + session + company + fund)
const allOccurred = computed(() => {
  const types = new Set()
  for (const et of ['deal', 'session', 'company', 'fund', 'project']) {
    for (const e of eventStore.getTimeline(et, props.dealId)) {
      types.add(e.type)
    }
  }
  return types
})

// Фильтруем связи: триггер уже произошёл ИЛИ может произойти скоро
const activeLinks = computed(() => {
  return CROSS_ENTITY_LINKS.map(link => {
    const triggered = allOccurred.value.has(link.trigger.eventType)
    const enabled   = allOccurred.value.has(link.enables.eventType)
    return {
      ...link,
      triggered,
      enabled,
      status: enabled ? 'done' : triggered ? 'ready' : 'pending',
    }
  }).filter(l => l.status !== 'pending' || props.stages.flatMap(s => s.nextPossible).some(e => e.type === l.trigger.eventType))
})

const triggeredLinks  = computed(() => activeLinks.value.filter(l => l.status === 'done'))
const readyLinks      = computed(() => activeLinks.value.filter(l => l.status === 'ready'))

function entityIcon(entityType) {
  return ENTITY_TYPES[entityType]?.icon || 'pi pi-circle'
}
function entityColor(entityType) {
  return ENTITY_TYPES[entityType]?.color || 'var(--p-text-muted-color)'
}
function entityPath(entityType) {
  return ENTITY_TYPES[entityType]?.path || null
}
function entityLabel(entityType) {
  return ENTITY_TYPES[entityType]?.label || entityType
}
</script>

<template>
  <div class="pcl-panel">
    <div class="pcl-header">
      <i class="pi pi-share-alt pcl-icon"></i>
      <span class="pcl-title">Кросс-сущностные связи</span>
      <Tag :value="`${activeLinks.length}`" severity="secondary" />
    </div>

    <!-- Готовые к активации -->
    <div v-if="readyLinks.length" class="pcl-section">
      <div class="pcl-section-label">
        <i class="pi pi-bolt" style="color: var(--fst-brand)"></i>
        Готово к активации
      </div>
      <div v-for="link in readyLinks" :key="link.id" class="pcl-link pcl-link--ready">
        <div class="pcl-flow">
          <div class="pcl-node" :style="{ borderColor: entityColor(link.trigger.entityType) }">
            <i :class="entityIcon(link.trigger.entityType)" :style="{ color: entityColor(link.trigger.entityType) }"></i>
            <span>{{ link.trigger.eventType.replace(/_/g, ' ') }}</span>
            <Tag :value="entityLabel(link.trigger.entityType)" severity="secondary" class="pcl-entity-tag" />
          </div>
          <div class="pcl-arrow">
            <i class="pi pi-arrow-right"></i>
          </div>
          <div class="pcl-node pcl-node--target" :style="{ borderColor: entityColor(link.enables.entityType) }">
            <i :class="entityIcon(link.enables.entityType)" :style="{ color: entityColor(link.enables.entityType) }"></i>
            <span>{{ link.enables.eventType.replace(/_/g, ' ') }}</span>
            <Tag :value="entityLabel(link.enables.entityType)" severity="secondary" class="pcl-entity-tag" />
          </div>
        </div>
        <div class="pcl-link-label">{{ link.label }}</div>
        <Button
          v-if="entityPath(link.enables.entityType)"
          :label="`Перейти → ${entityLabel(link.enables.entityType)}`"
          severity="secondary"
          size="small"
          text
          class="pcl-goto"
          @click="router.push(entityPath(link.enables.entityType))"
        />
      </div>
    </div>

    <!-- Выполненные связи -->
    <div v-if="triggeredLinks.length" class="pcl-section">
      <div class="pcl-section-label">
        <i class="pi pi-check-circle" style="color: var(--fst-green)"></i>
        Активированные цепочки
      </div>
      <div v-for="link in triggeredLinks" :key="link.id" class="pcl-link pcl-link--done">
        <div class="pcl-link-label pcl-link-label--done">
          <i class="pi pi-check" style="color: var(--fst-green)"></i>
          {{ link.label }}
        </div>
        <div class="pcl-link-desc">{{ link.description }}</div>
      </div>
    </div>

    <div v-if="!activeLinks.length" class="pcl-empty">
      <i class="pi pi-share-alt" style="font-size: 22px; opacity: 0.3"></i>
      <span>Связи активируются по мере прохождения конвейера</span>
    </div>
  </div>
</template>

<style scoped>
.pcl-panel {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  overflow: hidden;
}

.pcl-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-surface-ground);
}

.pcl-icon {
  font-size: 14px;
  color: var(--fst-purple);
}

.pcl-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
}

.pcl-section {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-bottom: 1px solid var(--p-content-border-color);
}

.pcl-section:last-child {
  border-bottom: none;
}

.pcl-section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-text-muted-color);
}

.pcl-link {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--p-content-border-color);
}

.pcl-link--ready {
  border-color: var(--fst-brand);
  background: color-mix(in srgb, var(--fst-brand) 5%, transparent);
}

.pcl-link--done {
  opacity: 0.7;
}

.pcl-flow {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.pcl-node {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border: 1px solid;
  border-radius: 6px;
  font-size: 10px;
  background: var(--p-surface-card);
  flex-wrap: wrap;
}

.pcl-node--target {
  background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
}

.pcl-entity-tag {
  font-size: 9px !important;
}

.pcl-arrow {
  font-size: 11px;
  color: var(--p-text-muted-color);
}

.pcl-link-label {
  font-size: 12px;
  font-weight: 500;
}

.pcl-link-label--done {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.pcl-link-desc {
  font-size: 11px;
  color: var(--p-text-muted-color);
}

.pcl-goto {
  align-self: flex-start;
  font-size: 11px !important;
}

.pcl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;
  color: var(--p-text-muted-color);
  font-size: 12px;
  text-align: center;
}
</style>
