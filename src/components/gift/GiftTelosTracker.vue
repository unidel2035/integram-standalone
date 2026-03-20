<template>
  <div class="gtt-root">
    <div class="fst-section-title">
      <i class="pi pi-compass" />
      Телос-трекер
    </div>
    <div v-if="goals.length" class="gtt-list">
      <div v-for="g in goals" :key="g.id" class="gtt-card">
        <div class="gtt-header">
          <span class="gtt-name">{{ g.name }}</span>
          <Tag :value="statusLabel(g.status)" :severity="statusSeverity(g.status)" class="gtt-status-tag" />
        </div>
        <p v-if="g.description" class="gtt-desc">{{ g.description }}</p>
        <ProgressBar
          :value="g.progress"
          :showValue="true"
          class="gtt-progress"
          :style="{ '--gtt-bar-color': progressColor(g.progress) }"
        />
        <div class="gtt-footer">
          <span class="gtt-stakeholders">
            <i class="pi pi-users" />
            {{ g.stakeholders ?? 0 }} участн.
          </span>
          <span class="gtt-percent">{{ g.progress ?? 0 }}%</span>
        </div>
      </div>
    </div>
    <div v-else class="gtt-empty">
      <i class="pi pi-flag" />
      <span>Целей пока нет</span>
    </div>
  </div>
</template>

<script setup>
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';

const props = defineProps({
  goals: { type: Array, default: () => [] }
});

function progressColor(val) {
  if (val < 30) return 'var(--fst-red)';
  if (val <= 70) return 'var(--fst-brand)';
  return 'var(--fst-green)';
}

function statusLabel(status) {
  const map = {
    active: 'Активна',
    paused: 'Пауза',
    completed: 'Завершена',
    draft: 'Черновик'
  };
  return map[status] || status || 'Неизвестно';
}

function statusSeverity(status) {
  const map = {
    active: 'success',
    paused: 'warn',
    completed: 'info',
    draft: 'secondary'
  };
  return map[status] || 'secondary';
}
</script>

<style scoped>
.gtt-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gtt-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gtt-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  transition: border-color 0.15s;
}

.gtt-card:hover {
  border-color: var(--fst-green);
}

.gtt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.gtt-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
}

.gtt-status-tag {
  font-size: 10px;
  flex-shrink: 0;
}

.gtt-desc {
  margin: 0;
  font-size: 12px;
  color: var(--p-text-muted-color);
  line-height: 1.4;
}

.gtt-progress {
  height: 8px;
  border-radius: 4px;
}

.gtt-progress :deep(.p-progressbar-value) {
  background: var(--gtt-bar-color, var(--fst-green));
  border-radius: 4px;
}

.gtt-progress :deep(.p-progressbar-label) {
  display: none;
}

.gtt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gtt-stakeholders {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--p-text-muted-color);
}

.gtt-stakeholders i {
  font-size: 11px;
  color: var(--fst-purple);
}

.gtt-percent {
  font-size: 11px;
  font-weight: 700;
  color: var(--p-text-color);
}

.gtt-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--p-text-muted-color);
  font-size: 13px;
}
</style>
