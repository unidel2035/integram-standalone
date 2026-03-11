<script setup>
import { computed } from 'vue'

const props = defineProps({
  stage: { type: Object, required: true },
  active: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

const statusConfig = {
  done:    { label: 'Завершён', severity: 'success', icon: 'pi pi-check-circle' },
  active:  { label: 'Активен',  severity: 'info',    icon: 'pi pi-spin pi-spinner' },
  blocked: { label: 'Блокировщик', severity: 'danger', icon: 'pi pi-times-circle' },
  pending: { label: 'Ожидает',  severity: 'secondary', icon: 'pi pi-circle' },
}

const statusCfg = computed(() => statusConfig[props.stage.status] || statusConfig.pending)

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <div
    class="ps-card"
    :class="[`ps-status-${stage.status}`, { 'ps-active': active }]"
    @click="emit('select', stage.id)"
  >
    <!-- Левая цветная полоса -->
    <div class="ps-bar" :style="{ background: stage.color }"></div>

    <div class="ps-body">
      <!-- Заголовок -->
      <div class="ps-header">
        <div class="ps-header-left">
          <i :class="stage.icon" class="ps-subprocess-icon" :style="{ color: stage.color }"></i>
          <span class="ps-subprocess-label">{{ stage.label }}</span>
          <span class="ps-subprocess-name">{{ stage.name }}</span>
        </div>
        <div class="ps-header-right">
          <Tag :value="statusCfg.label" :severity="statusCfg.severity" class="ps-status-tag" />
          <span v-if="stage.elapsedDays" class="ps-days">{{ stage.elapsedDays }} дн.</span>
        </div>
      </div>

      <!-- Событийная лента (завершившиеся) -->
      <div v-if="stage.events.length" class="ps-events">
        <div v-for="evt in stage.events" :key="evt.id" class="ps-event">
          <i :class="evt.icon || 'pi pi-circle-fill'" class="ps-event-icon"></i>
          <span class="ps-event-label">{{ evt.label }}</span>
          <span class="ps-event-date">{{ fmtDate(evt.ts) }}</span>
        </div>
      </div>

      <!-- Следующие возможные события (только если активна) -->
      <div v-if="stage.status === 'active' && stage.nextPossible.length" class="ps-next">
        <div class="ps-next-label">Возможные следующие:</div>
        <div v-for="next in stage.nextPossible.slice(0, 3)" :key="next.type" class="ps-next-item">
          <i :class="next.icon || 'pi pi-arrow-right'" class="ps-next-icon" :style="{ color: next.color }"></i>
          <span>{{ next.label }}</span>
        </div>
      </div>

      <!-- SLA предупреждение -->
      <div v-if="stage.status === 'active' && stage.slaDays" class="ps-sla"
        :class="{ 'ps-sla--warn': stage.sla.exceeded || (stage.sla.remaining !== null && stage.sla.remaining <= 5) }">
        <i class="pi pi-clock"></i>
        <span v-if="stage.sla.exceeded">
          SLA превышен на {{ Math.abs(stage.sla.remaining) }} дн.
        </span>
        <span v-else-if="stage.sla.remaining !== null">
          До дедлайна: {{ stage.sla.remaining }} дн. (лимит {{ stage.slaDays }} р.д.)
        </span>
        <span v-else>
          Лимит: {{ stage.slaDays }} р.д. (регламент {{ stage.reglamentRef }})
        </span>
      </div>

      <!-- Участники -->
      <div class="ps-footer">
        <div class="ps-actors">
          <span v-for="actor in stage.actors" :key="actor" class="ps-actor">{{ actor }}</span>
        </div>
        <span class="ps-reglament">{{ stage.reglamentRef }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ps-card {
  display: flex;
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  background: var(--p-surface-card);
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
  overflow: hidden;
}

.ps-card:hover,
.ps-active {
  border-color: var(--p-primary-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--p-primary-color) 15%, transparent);
}

.ps-status-done   { opacity: 0.85; }
.ps-status-pending { opacity: 0.6; }
.ps-status-blocked { border-color: var(--fst-red); }

.ps-bar {
  width: 4px;
  flex-shrink: 0;
}

.ps-body {
  flex: 1;
  padding: 12px 14px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ps-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ps-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ps-subprocess-icon {
  font-size: 15px;
  flex-shrink: 0;
}

.ps-subprocess-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.ps-subprocess-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ps-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ps-status-tag {
  font-size: 10px !important;
}

.ps-days {
  font-size: 11px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

/* События */
.ps-events {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ps-event {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.ps-event-icon {
  font-size: 10px;
  color: var(--fst-green);
  flex-shrink: 0;
}

.ps-event-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ps-event-date {
  font-size: 10px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

/* Следующие */
.ps-next {
  border-top: 1px dashed var(--p-content-border-color);
  padding-top: 6px;
}

.ps-next-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}

.ps-next-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--p-text-muted-color);
  padding: 1px 0;
}

.ps-next-icon { font-size: 10px; }

/* SLA */
.ps-sla {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--p-text-muted-color);
  background: var(--p-surface-ground);
  border-radius: 6px;
  padding: 4px 8px;
}

.ps-sla--warn {
  color: var(--fst-brand);
  background: color-mix(in srgb, var(--fst-brand) 10%, transparent);
}

/* Footer */
.ps-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}

.ps-actors {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.ps-actor {
  font-size: 10px;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  padding: 1px 6px;
  color: var(--p-text-muted-color);
}

.ps-reglament {
  font-size: 10px;
  color: var(--p-text-muted-color);
  font-style: italic;
}
</style>
