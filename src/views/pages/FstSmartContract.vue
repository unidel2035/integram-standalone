<template>
  <div class="fst-contract">
    <div v-if="loading" class="fst-contract-loading">
      <ProgressSpinner strokeWidth="3" />
      <p>Загрузка контракта...</p>
    </div>

    <div v-else-if="error" class="fst-contract-error">
      <Message severity="error">{{ error }}</Message>
      <Button label="Назад" icon="pi pi-arrow-left" @click="$router.push('/fst-committee')" />
    </div>

    <template v-else>
      <!-- Header -->
      <div class="fst-contract-header">
        <div class="fst-contract-title">
          <Button icon="pi pi-arrow-left" text rounded @click="$router.back()" />
          <h2>{{ contract?.name || 'Смарт контракт' }}</h2>
          <Tag :value="nodes.length + ' сценариев'" severity="info" />
        </div>
      </div>

      <!-- Scenario Tabs -->
      <TabView v-if="nodes.length" v-model:activeIndex="activeTab">
        <TabPanel v-for="node in nodes" :key="node.id" :header="node.scenario">
          <div class="fst-scenario-grid">
            <!-- Key Metrics -->
            <div class="fst-metrics-row">
              <div class="fst-metric-card">
                <span class="fst-metric-label">Инвестиции (IC)</span>
                <span class="fst-metric-value">{{ fmt(node.ic) }} ₽</span>
              </div>
              <div class="fst-metric-card">
                <span class="fst-metric-label">NPV</span>
                <span class="fst-metric-value" :class="node.npv >= 0 ? 'positive' : 'negative'">
                  {{ fmt(node.npv) }} ₽
                </span>
              </div>
              <div class="fst-metric-card">
                <span class="fst-metric-label">IRR</span>
                <span class="fst-metric-value">{{ node.irr.toFixed(1) }}%</span>
              </div>
              <div class="fst-metric-card">
                <span class="fst-metric-label">ROI / MOIC</span>
                <span class="fst-metric-value">{{ node.roi.toFixed(2) }}x</span>
              </div>
              <div class="fst-metric-card">
                <span class="fst-metric-label">DPP</span>
                <span class="fst-metric-value">{{ node.dpp.toFixed(1) }} лет</span>
              </div>
              <div class="fst-metric-card">
                <span class="fst-metric-label">PI</span>
                <span class="fst-metric-value">{{ node.pi.toFixed(2) }}</span>
              </div>
              <div class="fst-metric-card">
                <span class="fst-metric-label">WACC</span>
                <span class="fst-metric-value">{{ node.wacc }}%</span>
              </div>
              <div class="fst-metric-card">
                <span class="fst-metric-label">Вероятность</span>
                <span class="fst-metric-value">{{ node.probability }}%</span>
              </div>
            </div>

            <!-- Cashflow Chart -->
            <div class="fst-chart-section">
              <h3>Денежные потоки по годам</h3>
              <canvas :ref="el => setChartRef(node.id, el)"></canvas>
            </div>

            <!-- Conditions -->
            <div v-if="conditionsMap[node.id]?.length" class="fst-conditions-section">
              <h3>Условия ({{ conditionsMap[node.id].length }})</h3>
              <DataTable :value="conditionsMap[node.id]" size="small" stripedRows>
                <Column field="text" header="Условие" />
                <Column field="priority" header="Приоритет" style="width: 120px">
                  <template #body="{ data }">
                    <Tag :value="data.priority" :severity="prioritySeverity(data.priority)" />
                  </template>
                </Column>
                <Column field="status" header="Статус" style="width: 140px">
                  <template #body="{ data }">
                    <Tag :value="data.status" :severity="statusSeverity(data.status)" />
                  </template>
                </Column>
                <Column field="deadline" header="Срок" style="width: 120px" />
              </DataTable>
            </div>
          </div>
        </TabPanel>
      </TabView>

      <Message v-else severity="warn">Нет сценариев в контракте</Message>

      <!-- Summary: all scenarios comparison -->
      <div v-if="nodes.length > 1" class="fst-summary-section">
        <h3>Сравнение сценариев</h3>
        <DataTable :value="nodes" size="small" stripedRows>
          <Column field="scenario" header="Сценарий" />
          <Column header="IC">
            <template #body="{ data }">{{ fmt(data.ic) }}</template>
          </Column>
          <Column header="NPV">
            <template #body="{ data }">
              <span :class="data.npv >= 0 ? 'positive' : 'negative'">{{ fmt(data.npv) }}</span>
            </template>
          </Column>
          <Column header="IRR">
            <template #body="{ data }">{{ data.irr.toFixed(1) }}%</template>
          </Column>
          <Column header="ROI">
            <template #body="{ data }">{{ data.roi.toFixed(2) }}x</template>
          </Column>
          <Column header="Вероятность">
            <template #body="{ data }">{{ data.probability }}%</template>
          </Column>
        </DataTable>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import Chart from 'chart.js/auto'
import { loadContract, loadContractNodes, loadConditions } from '@/services/fstApi.js'

import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const route = useRoute()
const loading = ref(true)
const error = ref(null)
const contract = ref(null)
const nodes = ref([])
const conditionsMap = ref({})
const activeTab = ref(0)

const chartRefs = {}
const chartInstances = {}

function setChartRef(nodeId, el) {
  chartRefs[nodeId] = el
}

function fmt(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)
}

function prioritySeverity(p) {
  return p === 'HIGH' ? 'danger' : p === 'LOW' ? 'success' : 'warn'
}

function statusSeverity(s) {
  if (s === 'MET' || s === 'COMPLETED') return 'success'
  if (s === 'FAILED' || s === 'REJECTED') return 'danger'
  return 'info'
}

function renderChart(nodeId) {
  const el = chartRefs[nodeId]
  if (!el) return
  const node = nodes.value.find(n => n.id === nodeId)
  if (!node) return

  if (chartInstances[nodeId]) {
    chartInstances[nodeId].destroy()
  }

  const labels = node.cashflows.map((_, i) => 'Год ' + (i + 1))
  labels.unshift('IC')
  const data = [-node.ic, ...node.cashflows]

  chartInstances[nodeId] = new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Денежный поток, ₽',
        data,
        backgroundColor: data.map(v => v >= 0 ? 'rgba(76,175,80,0.7)' : 'rgba(244,67,54,0.7)'),
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => fmt(ctx.raw) + ' ₽'
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: v => fmt(v)
          }
        }
      }
    }
  })
}

function renderActiveChart() {
  const node = nodes.value[activeTab.value]
  if (node) {
    nextTick(() => renderChart(node.id))
  }
}

watch(activeTab, renderActiveChart)

onMounted(async () => {
  const id = route.params.id
  if (!id) {
    error.value = 'ID контракта не указан'
    loading.value = false
    return
  }

  try {
    contract.value = await loadContract(id)
    if (!contract.value) {
      error.value = 'Контракт #' + id + ' не найден'
      loading.value = false
      return
    }

    nodes.value = await loadContractNodes(id)

    // Load conditions for all nodes in parallel
    const condResults = await Promise.all(
      nodes.value.map(n => loadConditions(n.id).then(c => [n.id, c]))
    )
    const cMap = {}
    for (const [nid, conds] of condResults) {
      if (conds.length) cMap[nid] = conds
    }
    conditionsMap.value = cMap

    loading.value = false
    nextTick(() => renderActiveChart())
  } catch (err) {
    console.error('[FstSmartContract] load error:', err)
    error.value = err.message
    loading.value = false
  }
})
</script>

<style scoped>
.fst-contract {
  padding: 1.5rem;
}

.fst-contract-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
}

.fst-contract-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}

.fst-contract-header {
  margin-bottom: 1.5rem;
}

.fst-contract-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.fst-contract-title h2 {
  margin: 0;
  font-size: 1.4rem;
}

.fst-metrics-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.fst-metric-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.fst-metric-label {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.fst-metric-value {
  font-size: 1.2rem;
  font-weight: 600;
}

.fst-metric-value.positive { color: var(--p-green-500); }
.fst-metric-value.negative { color: var(--p-red-500); }

.fst-chart-section {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.fst-chart-section h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.fst-chart-section canvas {
  max-height: 300px;
}

.fst-conditions-section {
  margin-bottom: 1.5rem;
}

.fst-conditions-section h3 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}

.fst-summary-section {
  margin-top: 2rem;
}

.fst-summary-section h3 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}

.positive { color: var(--p-green-500); }
.negative { color: var(--p-red-500); }
</style>
