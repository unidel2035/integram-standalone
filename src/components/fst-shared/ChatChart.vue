<template>
  <div class="chat-chart-wrap">
    <canvas ref="canvasEl"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { loadChartJS } from '@/utils/lazyLoadChartJS'

const props = defineProps({
  chartData: { type: Object, required: true }
})

const canvasEl = ref(null)
let chartInstance = null

async function render() {
  if (!canvasEl.value || !props.chartData) return
  const { Chart } = await loadChartJS()

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  const cfg = buildConfig(props.chartData)
  if (!cfg) return

  chartInstance = new Chart(canvasEl.value, cfg)
}

function buildConfig(raw) {
  // raw может быть Chart.js-конфиг или упрощённый формат { type, labels, datasets|data }
  if (raw.data?.datasets) {
    // Уже Chart.js формат
    return {
      type: raw.type || 'bar',
      data: raw.data,
      options: defaultOptions(raw.type)
    }
  }
  // Упрощённый: { type, labels, values, title }
  if (raw.labels && raw.values) {
    return {
      type: raw.type || 'bar',
      data: {
        labels: raw.labels,
        datasets: [{
          label: raw.title || 'Данные',
          data: raw.values,
          ...datasetStyle(raw.type)
        }]
      },
      options: defaultOptions(raw.type, raw.title)
    }
  }
  return null
}

function datasetStyle(type) {
  if (type === 'line') return {
    borderColor: '#7c3aed',
    backgroundColor: 'rgba(124,58,237,0.15)',
    fill: true, tension: 0.4, pointRadius: 4
  }
  if (type === 'pie' || type === 'doughnut') return {
    backgroundColor: ['#7c3aed','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4']
  }
  // bar default
  return { backgroundColor: 'rgba(124,58,237,0.7)', borderRadius: 4 }
}

function defaultOptions(type, title) {
  const base = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: type === 'pie' || type === 'doughnut' },
      title: title ? { display: true, text: title, font: { size: 13 } } : { display: false }
    }
  }
  if (type !== 'pie' && type !== 'doughnut') {
    base.scales = {
      x: { grid: { color: 'rgba(128,128,128,0.15)' } },
      y: { grid: { color: 'rgba(128,128,128,0.15)' }, beginAtZero: true }
    }
  }
  return base
}

onMounted(render)
watch(() => props.chartData, render, { deep: true })
onBeforeUnmount(() => { chartInstance?.destroy() })
</script>

<style scoped>
.chat-chart-wrap {
  margin-top: 12px;
  padding: 12px;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  max-width: 520px;
}
.chat-chart-wrap canvas {
  max-height: 240px;
}
</style>
