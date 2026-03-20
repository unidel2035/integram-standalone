<template>
  <div class="fst-metrics-strip gift-metrics">
    <div class="fst-metric-item">
      <i class="pi pi-users fst-metric-item-icon gift-icon--purple" />
      <div class="fst-metric-item-val">{{ stats.stakeholders ?? 0 }}</div>
      <div class="fst-metric-item-label">Участников</div>
    </div>
    <div class="fst-metric-item">
      <i class="pi pi-arrows-h fst-metric-item-icon gift-icon--cyan" />
      <div class="fst-metric-item-val">{{ stats.exchanges ?? 0 }}</div>
      <div class="fst-metric-item-label">Вкладов</div>
    </div>
    <div class="fst-metric-item">
      <i class="pi pi-check-circle fst-metric-item-icon gift-icon--green" />
      <div class="fst-metric-item-val">{{ acceptanceDisplay }}</div>
      <div class="fst-metric-item-label">Принято</div>
    </div>
    <div class="fst-metric-item">
      <i class="pi pi-sitemap fst-metric-item-icon gift-icon--blue" />
      <div class="fst-metric-item-val">{{ densityDisplay }}</div>
      <div class="fst-metric-item-label">Плотность связей</div>
    </div>
    <div class="fst-metric-item">
      <i class="pi pi-replay fst-metric-item-icon gift-icon--brand" />
      <div class="fst-metric-item-val">{{ stats.mutualCycles ?? 0 }}</div>
      <div class="fst-metric-item-label">Циклов взаимности</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  stats: {
    type: Object,
    default: () => ({
      stakeholders: 0,
      exchanges: 0,
      acceptanceRate: 0,
      density: 0,
      mutualCycles: 0
    })
  }
});

const acceptanceDisplay = computed(() => {
  const rate = props.stats.acceptanceRate ?? 0;
  return `${Math.round(rate)}%`;
});

const densityDisplay = computed(() => {
  const d = props.stats.density ?? 0;
  return d.toFixed(2);
});
</script>

<style scoped>
.gift-metrics {
  margin: -20px -20px 0;
  border-bottom: 1px solid var(--p-content-border-color);
}

.gift-icon--purple { color: var(--fst-purple); }
.gift-icon--cyan   { color: var(--fst-cyan); }
.gift-icon--green  { color: var(--fst-green); }
.gift-icon--blue   { color: var(--fst-blue); }
.gift-icon--brand  { color: var(--fst-brand); }
</style>
