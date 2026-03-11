<script setup>
defineProps({
  summary: { type: Object, required: true },
})
</script>

<template>
  <div class="pm-strip">
    <div class="pm-item">
      <i class="pi pi-map pm-icon"></i>
      <div class="pm-val">{{ summary.currentPhase?.split(':')[0] || '—' }}</div>
      <div class="pm-label">{{ summary.currentPhase?.split(': ').slice(1).join(': ') || 'Текущая фаза' }}</div>
    </div>
    <div class="pm-divider"></div>
    <div class="pm-item">
      <i class="pi pi-percentage pm-icon"></i>
      <div class="pm-val">{{ summary.completionPct }}%</div>
      <div class="pm-label">Выполнено ({{ summary.doneCount }}/{{ summary.totalCount }} ПП)</div>
    </div>
    <div class="pm-divider"></div>
    <div class="pm-item">
      <i class="pi pi-calendar pm-icon"></i>
      <div class="pm-val">{{ summary.totalDays || 0 }}</div>
      <div class="pm-label">Дней в работе</div>
    </div>
    <div class="pm-divider"></div>
    <div class="pm-item" :class="{ 'pm-item--alert': summary.blockerCount > 0 }">
      <i class="pi pi-exclamation-triangle pm-icon"></i>
      <div class="pm-val" :style="{ color: summary.blockerCount > 0 ? 'var(--fst-red)' : 'inherit' }">
        {{ summary.blockerCount }}
      </div>
      <div class="pm-label">Блокировщиков</div>
    </div>
    <div class="pm-divider"></div>
    <div class="pm-item" :class="{ 'pm-item--alert': summary.slaExceeded > 0 }">
      <i class="pi pi-clock pm-icon"></i>
      <div class="pm-val" :style="{ color: summary.slaExceeded > 0 ? 'var(--fst-brand)' : 'var(--fst-green)' }">
        {{ summary.slaExceeded > 0 ? 'Просрочен' : 'В норме' }}
      </div>
      <div class="pm-label">SLA статус</div>
    </div>
    <div class="pm-divider"></div>
    <div class="pm-item pm-next">
      <i class="pi pi-arrow-right pm-icon"></i>
      <div class="pm-val pm-next-val">{{ summary.nextAction || '—' }}</div>
      <div class="pm-label">Следующий шаг</div>
    </div>
  </div>
</template>

<style scoped>
.pm-strip {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
  overflow-x: auto;
}

.pm-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 20px;
  min-width: 120px;
  gap: 4px;
  transition: background 0.15s;
}

.pm-item:hover {
  background: var(--p-surface-ground);
}

.pm-item--alert {
  background: color-mix(in srgb, var(--fst-red) 5%, transparent);
}

.pm-icon {
  font-size: 15px;
  opacity: 0.6;
  margin-bottom: 2px;
}

.pm-val {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.pm-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  text-align: center;
}

.pm-divider {
  width: 1px;
  background: var(--p-content-border-color);
  margin: 12px 0;
  flex-shrink: 0;
}

.pm-next {
  flex: 1;
  min-width: 180px;
}

.pm-next-val {
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
