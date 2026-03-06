<template>
  <div class="metrics-dashboard">
    <div class="dashboard-header">
      <h3>Метрики производительности</h3>
    </div>

    <!-- Real-time metrics cards -->
    <div class="metrics-grid">
      <!-- Performance metric -->
      <div class="metric-card">
        <div class="metric-icon" style="background: #eff6ff; color: #3b82f6">
          <i class="pi pi-bolt"></i>
        </div>
        <div class="metric-content">
          <div class="metric-label">Производительность</div>
          <div class="metric-value-group">
            <div v-for="(agent, index) in agents" :key="agent.id" class="agent-metric">
              <span class="agent-name">{{ agent.name }}:</span>
              <span class="metric-value">
                {{ metrics[agent.id]?.performance || 0 }}
                <span class="metric-unit">строк/сек</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Memory metric -->
      <div class="metric-card">
        <div class="metric-icon" style="background: #f5f3ff; color: #8b5cf6">
          <i class="pi pi-database"></i>
        </div>
        <div class="metric-content">
          <div class="metric-label">Использование памяти</div>
          <div class="metric-value-group">
            <div v-for="(agent, index) in agents" :key="agent.id" class="agent-metric">
              <span class="agent-name">{{ agent.name }}:</span>
              <span class="metric-value">
                {{ metrics[agent.id]?.memoryUsage || 0 }}
                <span class="metric-unit">MB</span>
              </span>
            </div>
            <div class="total-metric">
              <span class="agent-name">Общее:</span>
              <span class="metric-value">
                {{ totalMemory }}
                <span class="metric-unit">MB / {{ maxMemory }} MB</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Queue metric -->
      <div class="metric-card">
        <div class="metric-icon" style="background: #ecfdf5; color: #10b981">
          <i class="pi pi-list"></i>
        </div>
        <div class="metric-content">
          <div class="metric-label">Очередь задач</div>
          <div class="metric-value-group">
            <div class="queue-stats">
              <div class="stat-item">
                <span class="stat-label">В ожидании:</span>
                <span class="stat-value">{{ queueStats.pending }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">В работе:</span>
                <span class="stat-value">{{ queueStats.running }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Завершено:</span>
                <span class="stat-value">{{ queueStats.completed }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Ошибок:</span>
                <span class="stat-value error">{{ queueStats.errors }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Simple charts visualization -->
    <div class="charts-section">
      <div class="chart-card">
        <h4>Производительность во времени</h4>
        <div class="simple-chart">
          <canvas ref="performanceChart"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <h4>Использование памяти</h4>
        <div class="simple-chart">
          <canvas ref="memoryChart"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  agents: {
    type: Array,
    default: () => []
  },
  metrics: {
    type: Object,
    default: () => ({})
  },
  queueStats: {
    type: Object,
    default: () => ({
      pending: 0,
      running: 0,
      completed: 0,
      errors: 0
    })
  },
  maxMemory: {
    type: Number,
    default: 512
  }
})

const performanceChart = ref(null)
const memoryChart = ref(null)
const performanceHistory = ref([])
const memoryHistory = ref([])
const maxHistoryPoints = 30

// Calculate total memory
const totalMemory = computed(() => {
  return Object.values(props.metrics).reduce((sum, m) => sum + (m.memoryUsage || 0), 0)
})

// Update charts with simple canvas drawing
const drawPerformanceChart = () => {
  const canvas = performanceChart.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const width = canvas.width = canvas.offsetWidth * 2
  const height = canvas.height = 200

  ctx.clearRect(0, 0, width, height)

  // Draw grid
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const y = (i / 5) * height
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  // Draw lines for each agent
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
  props.agents.forEach((agent, agentIndex) => {
    const agentData = performanceHistory.value
      .map(entry => entry[agent.id] || 0)
      .slice(-maxHistoryPoints)

    if (agentData.length < 2) return

    ctx.strokeStyle = colors[agentIndex % colors.length]
    ctx.lineWidth = 3
    ctx.beginPath()

    const maxValue = Math.max(...agentData, 50)
    agentData.forEach((value, index) => {
      const x = (index / (maxHistoryPoints - 1)) * width
      const y = height - (value / maxValue) * height * 0.9
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()
  })
}

const drawMemoryChart = () => {
  const canvas = memoryChart.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const width = canvas.width = canvas.offsetWidth * 2
  const height = canvas.height = 200

  ctx.clearRect(0, 0, width, height)

  // Draw grid
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const y = (i / 5) * height
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  // Draw stacked area chart
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
  const historyData = memoryHistory.value.slice(-maxHistoryPoints)

  if (historyData.length < 2) return

  props.agents.forEach((agent, agentIndex) => {
    ctx.fillStyle = colors[agentIndex % colors.length] + '40'
    ctx.strokeStyle = colors[agentIndex % colors.length]
    ctx.lineWidth = 2
    ctx.beginPath()

    historyData.forEach((entry, index) => {
      const x = (index / (maxHistoryPoints - 1)) * width
      const value = entry[agent.id] || 0
      const y = height - (value / props.maxMemory) * height * 0.9

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    ctx.lineTo(width, height)
    ctx.lineTo(0, height)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  })
}

// Update history
const updateHistory = () => {
  const perfEntry = {}
  const memEntry = {}

  props.agents.forEach(agent => {
    perfEntry[agent.id] = props.metrics[agent.id]?.performance || 0
    memEntry[agent.id] = props.metrics[agent.id]?.memoryUsage || 0
  })

  performanceHistory.value.push(perfEntry)
  memoryHistory.value.push(memEntry)

  if (performanceHistory.value.length > maxHistoryPoints) {
    performanceHistory.value.shift()
  }
  if (memoryHistory.value.length > maxHistoryPoints) {
    memoryHistory.value.shift()
  }

  drawPerformanceChart()
  drawMemoryChart()
}

// Watch metrics for updates
watch(() => props.metrics, updateHistory, { deep: true })

// Resize handler
const handleResize = () => {
  drawPerformanceChart()
  drawMemoryChart()
}

onMounted(() => {
  drawPerformanceChart()
  drawMemoryChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.metrics-dashboard {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.dashboard-header h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.metric-card {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1.25rem;
  border: 1px solid #e5e7eb;
}

.metric-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.metric-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 0.75rem;
}

.metric-value-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.agent-metric,
.total-metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.agent-name {
  color: #6b7280;
  font-weight: 500;
}

.metric-value {
  font-weight: 700;
  color: #1f2937;
  font-family: 'Consolas', 'Monaco', monospace;
}

.metric-unit {
  font-size: 0.75rem;
  font-weight: 400;
  color: #9ca3af;
  margin-left: 0.25rem;
}

.total-metric {
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
  margin-top: 0.25rem;
  font-weight: 600;
}

.queue-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #9ca3af;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  font-family: 'Consolas', 'Monaco', monospace;
}

.stat-value.error {
  color: #ef4444;
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.chart-card {
  background: #f9fafb;
  border-radius: 8px;
  padding: 1.25rem;
  border: 1px solid #e5e7eb;
}

.chart-card h4 {
  margin: 0 0 1rem 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #374151;
}

.simple-chart {
  position: relative;
  width: 100%;
  height: 200px;
}

.simple-chart canvas {
  width: 100%;
  height: 100%;
}

@media (max-width: 768px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .queue-stats {
    grid-template-columns: 1fr;
  }

  .charts-section {
    grid-template-columns: 1fr;
  }
}
</style>
