<!-- GrDensityChart — плотность событий во времени (событийная онтология) -->
<template>
  <div class="gr-density">
    <div class="gr-density-title">
      <i class="pi pi-chart-bar" style="font-size:11px" />
      Плотность событий по неделям
      <span class="gr-density-total">{{ events.length }} событий</span>
    </div>
    <div v-if="!buckets.length" class="gr-density-empty">нет данных</div>
    <div v-else class="gr-density-chart">
      <svg :width="chartW" height="80" class="gr-density-svg">
        <!-- Bars -->
        <g v-for="(b, i) in buckets" :key="i">
          <rect
            :x="i * barW + 1"
            :y="80 - barH(b.count) - 18"
            :width="barW - 2"
            :height="barH(b.count)"
            :fill="barColor(b.count)"
            rx="2"
          />
          <text v-if="b.count > 2"
            :x="i * barW + barW / 2"
            :y="80 - barH(b.count) - 20"
            text-anchor="middle"
            font-size="8"
            fill="var(--p-text-muted-color)">{{ b.count }}</text>
        </g>
        <!-- Date labels -->
        <text v-if="buckets.length"
          x="2" y="78"
          font-size="8" fill="var(--p-text-muted-color)">{{ fmtDate(buckets[0].date) }}</text>
        <text v-if="buckets.length > 1"
          :x="chartW - 2" y="78"
          text-anchor="end"
          font-size="8" fill="var(--p-text-muted-color)">{{ fmtDate(buckets[buckets.length - 1].date) }}</text>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { eventDensity } from '@/services/grEventEngine.js'

const props = defineProps({
  events: { type: Array, default: () => [] },
})

const buckets = computed(() => eventDensity(props.events, 7))
const maxCount = computed(() => Math.max(1, ...buckets.value.map(b => b.count)))
const chartW = computed(() => Math.max(200, buckets.value.length * 20))
const barW = computed(() => buckets.value.length ? chartW.value / buckets.value.length : 20)

function barH(count) {
  return Math.max(2, (count / maxCount.value) * 50)
}

function barColor(count) {
  const ratio = count / maxCount.value
  if (ratio > 0.7) return 'var(--p-primary-color)'
  if (ratio > 0.3) return 'var(--p-primary-color)'
  return 'var(--p-primary-color)'
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
</script>

<style scoped>
.gr-density {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 10px 14px;
}
.gr-density-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}
.gr-density-total {
  margin-left: auto;
  font-size: 10px;
  font-weight: 400;
  color: var(--p-primary-color);
}
.gr-density-empty {
  font-size: 11px;
  color: var(--p-text-muted-color);
  font-style: italic;
  padding: 8px 0;
}
.gr-density-chart { overflow-x: auto; }
.gr-density-svg { display: block; }
</style>
