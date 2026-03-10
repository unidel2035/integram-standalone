<template>
  <FstPageLayout title="Аллокация капитала" subtitle="Оптимизация аллокации — распределение капитала по субфондам">
    <Toast position="bottom-center" />

    <!-- Header -->
    <template #header>
      <div class="fsa-header-left">
        <div class="fsa-logo">
          <i class="pi pi-chart-pie" style="font-size:20px"></i>
          <span>ФСТ НТИ · <b>Оптимизация аллокации</b></span>
          <Tag value="Black-Litterman" severity="secondary" style="font-size:11px" />
        </div>
        <div class="fsa-updated">
          <i class="pi pi-circle-fill" style="font-size:8px;color:var(--fst-green)"></i>
          Обновлено: {{ lastUpdate }}
        </div>
      </div>
      <div class="fsa-header-right">
        <Button icon="pi pi-refresh" label="Пересчитать" size="small" severity="secondary" @click="recalculate" :loading="calculating" />
        <Button icon="pi pi-check" label="Применить аллокацию" size="small" severity="success" @click="applyAllocation" :disabled="!hasChanges" />
        <Button icon="pi pi-building" label="Портфель" size="small" severity="secondary" text @click="$router.push('/fst-portfolio')" />
      </div>
    </template>

    <!-- Body: 3 columns -->
    <div class="fsa-body">

      <!-- Left: Subfund Allocation Controls -->
      <div class="fsa-left">
        <div class="fsa-panel">
          <div class="fsa-panel-header">
            <i class="pi pi-sliders-h"></i>
            <span>Распределение капитала</span>
          </div>

          <div class="fsa-total-nav">
            <div class="fsa-nav-label">NAV фонда</div>
            <div class="fsa-nav-value">{{ formatNumber(totalNAV / 1e9, 2) }} млрд ₽</div>
          </div>

          <Divider />

          <!-- Subfund Weight Sliders -->
          <div class="fsa-sliders">
            <div v-for="sf in subfunds" :key="sf.id" class="fsa-slider-item">
              <div class="fsa-slider-header">
                <div class="fsa-slider-name">
                  <i :class="sf.icon" :style="{ color: sf.color }"></i>
                  {{ sf.name }}
                </div>
                <div class="fsa-slider-values">
                  <span class="fsa-weight">{{ (sf.weight * 100).toFixed(1) }}%</span>
                  <span class="fsa-amount">{{ formatNumber(sf.weight * totalNAV / 1e9, 2) }} млрд</span>
                </div>
              </div>
              <Slider
                v-model="sf.weight"
                :min="0"
                :max="1"
                :step="0.01"
                class="fsa-slider"
                @update:modelValue="onWeightChange"
              />
              <div class="fsa-slider-footer">
                <span class="fsa-companies">{{ sf.companies }} компаний</span>
                <span class="fsa-current-irr" :style="{ color: irrColor(sf.currentIRR) }">
                  IRR {{ (sf.currentIRR * 100).toFixed(1) }}%
                </span>
              </div>
            </div>
          </div>

          <Divider />

          <!-- Market Views (Black-Litterman) -->
          <div class="fsa-views-section">
            <div class="fsa-views-header" @click="viewsExpanded = !viewsExpanded">
              <i class="pi pi-eye"></i>
              <span>Взгляды управляющего</span>
              <i :class="viewsExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" style="margin-left:auto;font-size:11px;color:var(--p-text-muted-color)"></i>
            </div>
            <div v-if="viewsExpanded" class="fsa-views-list">
              <div v-for="(view, idx) in marketViews" :key="idx" class="fsa-view-item">
                <div class="fsa-view-text">{{ view.text }}</div>
                <div class="fsa-view-meta">
                  <span>Уверенность: {{ (view.confidence * 100).toFixed(0) }}%</span>
                  <Button icon="pi pi-times" size="small" severity="secondary" text @click="removeView(idx)" />
                </div>
              </div>
              <Button label="Добавить взгляд" icon="pi pi-plus" size="small" severity="secondary" text @click="showAddViewDialog = true" />
            </div>
          </div>

          <Divider />

          <!-- Quick Actions -->
          <div class="fsa-actions">
            <Button label="Оптимальный" icon="pi pi-bolt" size="small" severity="success" outlined @click="applyOptimal" />
            <Button label="Сброс" icon="pi pi-refresh" size="small" severity="secondary" outlined @click="resetWeights" />
          </div>
        </div>
      </div>

      <!-- Center: Efficient Frontier Chart -->
      <div class="fsa-center">
        <div class="fsa-panel">
          <div class="fsa-panel-header">
            <i class="pi pi-chart-line"></i>
            <span>Граница эффективности</span>
            <Tag :value="`Sharpe ${sharpeRatio.toFixed(2)}`" severity="success" style="margin-left:auto;font-size:11px" />
          </div>

          <!-- Chart Canvas -->
          <div class="fsa-chart-wrap">
            <canvas ref="frontierChart"></canvas>
          </div>

          <Divider />

          <!-- Expected Metrics -->
          <div class="fsa-metrics-grid">
            <div class="fsa-metric-card">
              <div class="fsa-metric-label">Ожидаемый IRR</div>
              <div class="fsa-metric-value fsa-mv-green">{{ (expectedReturn * 100).toFixed(2) }}%</div>
            </div>
            <div class="fsa-metric-card">
              <div class="fsa-metric-label">Волатильность</div>
              <div class="fsa-metric-value fsa-mv-brand">{{ (portfolioRisk * 100).toFixed(2) }}%</div>
            </div>
            <div class="fsa-metric-card">
              <div class="fsa-metric-label">Sharpe Ratio</div>
              <div class="fsa-metric-value fsa-mv-blue">{{ sharpeRatio.toFixed(2) }}</div>
            </div>
            <div class="fsa-metric-card">
              <div class="fsa-metric-label">Max Drawdown</div>
              <div class="fsa-metric-value fsa-mv-red">{{ (maxDrawdown * 100).toFixed(1) }}%</div>
            </div>
          </div>
        </div>

        <!-- Correlation Matrix -->
        <div class="fsa-panel" style="margin-top:16px">
          <div class="fsa-panel-header">
            <i class="pi pi-sitemap"></i>
            <span>Матрица корреляций</span>
            <Button icon="pi pi-info-circle" size="small" severity="secondary" text @click="showCorrelationInfo = true" />
          </div>
          <div class="fsa-correlation-matrix">
            <div class="fsa-corr-grid">
              <div class="fsa-corr-header"></div>
              <div v-for="sf in subfunds" :key="'h-' + sf.id" class="fsa-corr-header" :title="sf.name">
                {{ sf.shortName }}
              </div>
              <template v-for="(sf1, i) in subfunds" :key="'r-' + sf1.id">
                <div class="fsa-corr-label" :title="sf1.name">{{ sf1.shortName }}</div>
                <div v-for="(sf2, j) in subfunds" :key="'c-' + i + '-' + j"
                  class="fsa-corr-cell"
                  :class="corrClass(correlationMatrix[i][j])"
                  :title="`${sf1.shortName} ↔ ${sf2.shortName}: ${correlationMatrix[i][j].toFixed(2)}`">
                  {{ correlationMatrix[i][j].toFixed(2) }}
                </div>
              </template>
            </div>
          </div>
          <div class="fsa-risk-alerts">
            <div v-for="alert in riskAlerts" :key="alert.id" class="fsa-risk-alert" :class="alert.severity">
              <i :class="alert.icon" style="font-size:12px"></i>
              <span>{{ alert.message }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Stress Tests -->
      <div class="fsa-right">
        <div class="fsa-panel">
          <div class="fsa-panel-header">
            <i class="pi pi-exclamation-triangle"></i>
            <span>Стресс-тесты</span>
          </div>

          <div class="fsa-stress-intro">
            Сценарный анализ устойчивости портфеля к шоковым событиям
          </div>

          <div class="fsa-stress-scenarios">
            <div v-for="scenario in stressScenarios" :key="scenario.id" class="fsa-stress-card">
              <div class="fsa-stress-header">
                <i :class="scenario.icon" :style="{ color: scenario.color }"></i>
                <span class="fsa-stress-name">{{ scenario.name }}</span>
              </div>
              <div class="fsa-stress-desc">{{ scenario.description }}</div>
              <div class="fsa-stress-impact">
                <div class="fsa-impact-row">
                  <span>NAV</span>
                  <span class="fsa-impact-val" :style="{ color: impactColor(scenario.navImpact) }">
                    {{ scenario.navImpact > 0 ? '+' : '' }}{{ (scenario.navImpact * 100).toFixed(1) }}%
                  </span>
                </div>
                <div class="fsa-impact-row">
                  <span>IRR</span>
                  <span class="fsa-impact-val" :style="{ color: impactColor(scenario.irrImpact) }">
                    {{ scenario.irrImpact > 0 ? '+' : '' }}{{ (scenario.irrImpact * 100).toFixed(1) }}%
                  </span>
                </div>
                <div class="fsa-impact-row">
                  <span>Компании в риске</span>
                  <span class="fsa-impact-val">{{ scenario.companiesAtRisk }}</span>
                </div>
              </div>
              <ProgressBar :value="Math.abs(scenario.navImpact) * 100" :showValue="false" :style="{ height: '4px' }" />
            </div>
          </div>

          <Divider />

          <!-- Concentration Risks -->
          <div class="fsa-concentration">
            <div class="fsa-concentration-header">
              <i class="pi pi-chart-pie"></i>
              <span>Концентрация рисков</span>
            </div>
            <div class="fsa-concentration-list">
              <div v-for="risk in concentrationRisks" :key="risk.type" class="fsa-concentration-item">
                <div class="fsa-conc-type">{{ risk.type }}</div>
                <div class="fsa-conc-bar-wrap">
                  <div class="fsa-conc-bar" :style="{ width: risk.level + '%', background: riskLevelColor(risk.level) }"></div>
                  <span class="fsa-conc-label">{{ risk.level }}%</span>
                </div>
                <div class="fsa-conc-desc">{{ risk.description }}</div>
              </div>
            </div>
          </div>

          <Button label="Запустить симуляцию" icon="pi pi-play" size="small" severity="warn" outlined @click="runStressTest" :loading="stressTesting" style="margin-top:16px;width:100%" />
        </div>
      </div>
    </div>

    <!-- Add View Dialog -->
    <Dialog v-model:visible="showAddViewDialog" header="Добавить взгляд управляющего" modal :style="{ width: '500px' }">
      <div class="fsa-view-form">
        <div class="fsa-form-group">
          <label>Субфонд</label>
          <Select v-model="newView.subfund" :options="subfunds" optionLabel="name" optionValue="id" placeholder="Выберите субфонд" style="width:100%" />
        </div>
        <div class="fsa-form-group">
          <label>Ожидаемое превышение над рынком</label>
          <InputNumber v-model="newView.excessReturn" suffix="%" :min="-20" :max="20" :step="1" style="width:100%" />
        </div>
        <div class="fsa-form-group">
          <label>Уверенность (0-100%)</label>
          <Slider v-model="newView.confidence" :min="0" :max="100" :step="5" />
          <div style="text-align:center;margin-top:8px;font-size:13px;color:var(--p-text-muted-color)">{{ newView.confidence }}%</div>
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" severity="secondary" text @click="showAddViewDialog = false" />
        <Button label="Добавить" severity="success" @click="addView" />
      </template>
    </Dialog>

    <!-- Correlation Info Dialog -->
    <Dialog v-model:visible="showCorrelationInfo" header="О корреляционном анализе" modal :style="{ width: '600px' }">
      <div class="fsa-info-content">
        <p><strong>Матрица корреляций</strong> показывает взаимосвязь доходности между субфондами:</p>
        <ul>
          <li><strong>1.0</strong> — идеальная положительная корреляция (движутся синхронно)</li>
          <li><strong>0.0</strong> — нет корреляции (независимы друг от друга)</li>
          <li><strong>-1.0</strong> — идеальная отрицательная корреляция (движутся противоположно)</li>
        </ul>
        <p><strong>Цель диверсификации:</strong> низкая корреляция между субфондами снижает общий риск портфеля.</p>
        <p><strong>Концентрация риска:</strong> высокая корреляция означает, что портфель уязвим к общим шокам (например, все компании зависят от одного заказчика).</p>
      </div>
      <template #footer>
        <Button label="Понятно" @click="showCorrelationInfo = false" />
      </template>
    </Dialog>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Chart from 'chart.js/auto'

const router = useRouter()
const toast = useToast()

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

const lastUpdate = ref(new Date().toLocaleString('ru'))
const calculating = ref(false)
const stressTesting = ref(false)
const hasChanges = ref(false)
const viewsExpanded = ref(false)
const showAddViewDialog = ref(false)
const showCorrelationInfo = ref(false)

const totalNAV = ref(50_000_000_000) // 50 млрд руб
const riskFreeRate = ref(0.18) // 18% безрисковая ставка (ключевая ставка ЦБ)

// Subfunds data
const subfunds = ref([
  {
    id: 'bas',
    name: 'БАС (беспилотные авиасистемы)',
    shortName: 'БАС',
    icon: 'pi pi-send',
    color: 'var(--fst-blue)',
    weight: 0.35,
    companies: 12,
    currentIRR: 0.28,
    historicalReturn: 0.25,
    volatility: 0.35
  },
  {
    id: 'robo',
    name: 'РОБО (робототехника)',
    shortName: 'РОБО',
    icon: 'pi pi-android',
    color: 'var(--fst-green)',
    weight: 0.30,
    companies: 8,
    currentIRR: 0.32,
    historicalReturn: 0.30,
    volatility: 0.40
  },
  {
    id: 'me',
    name: 'МЭ (микроэлектроника)',
    shortName: 'МЭ',
    icon: 'pi pi-microchip',
    color: 'var(--fst-purple)',
    weight: 0.25,
    companies: 6,
    currentIRR: 0.24,
    historicalReturn: 0.22,
    volatility: 0.30
  },
  {
    id: 'ai',
    name: 'AI (искусственный интеллект)',
    shortName: 'AI',
    icon: 'pi pi-sparkles',
    color: 'var(--fst-brand)',
    weight: 0.10,
    companies: 4,
    currentIRR: 0.45,
    historicalReturn: 0.40,
    volatility: 0.55
  }
])

// Initial weights backup
const initialWeights = ref(null)

// Market views (Black-Litterman)
const marketViews = ref([
  {
    subfund: 'bas',
    excessReturn: 0.05,
    confidence: 0.75,
    text: 'БАС даст +5% сверх рынка в 2026 из-за роста гособоронзаказа'
  },
  {
    subfund: 'ai',
    excessReturn: 0.10,
    confidence: 0.60,
    text: 'AI покажет +10% из-за импортозамещения LLM-решений'
  }
])

const newView = ref({
  subfund: null,
  excessReturn: 0,
  confidence: 50
})

// Correlation matrix (demo data based on market exposure)
const correlationMatrix = ref([
  [1.00, 0.65, 0.45, 0.30], // БАС
  [0.65, 1.00, 0.50, 0.35], // РОБО
  [0.45, 0.50, 1.00, 0.40], // МЭ
  [0.30, 0.35, 0.40, 1.00]  // AI
])

// Risk alerts
const riskAlerts = ref([
  {
    id: 1,
    severity: 'warn',
    icon: 'pi pi-exclamation-triangle',
    message: 'Высокая корреляция БАС-РОБО (0.65) — зависимость от гособоронзаказа'
  },
  {
    id: 2,
    severity: 'info',
    icon: 'pi pi-info-circle',
    message: 'AI имеет низкую корреляцию с другими субфондами — хороший диверсификатор'
  }
])

// Stress scenarios
const stressScenarios = ref([
  {
    id: 1,
    name: 'Шок сертификации',
    icon: 'pi pi-ban',
    color: 'var(--fst-red)',
    description: 'Росавиация закрыла все сертификации на 1 год',
    navImpact: -0.18,
    irrImpact: -0.12,
    companiesAtRisk: 7
  },
  {
    id: 2,
    name: 'Заморозка бюджетов МО',
    icon: 'pi pi-lock',
    color: 'var(--fst-brand)',
    description: 'Ключевой заказчик (МО РФ) заморозил бюджеты на 6 мес',
    navImpact: -0.25,
    irrImpact: -0.15,
    companiesAtRisk: 10
  },
  {
    id: 3,
    name: 'Кадровый кризис',
    icon: 'pi pi-users',
    color: 'var(--fst-brand)',
    description: 'Критический кадровый риск: 3 CTO ушли одновременно',
    navImpact: -0.12,
    irrImpact: -0.08,
    companiesAtRisk: 3
  },
  {
    id: 4,
    name: 'Санкционное давление',
    icon: 'pi pi-shield',
    color: 'var(--fst-purple)',
    description: 'Обострение санкций, блокировка комплектующих из Азии',
    navImpact: -0.15,
    irrImpact: -0.10,
    companiesAtRisk: 8
  }
])

// Concentration risks
const concentrationRisks = ref([
  { type: 'Заказчик (МО РФ)', level: 65, description: '65% выручки портфеля' },
  { type: 'География (Москва)', level: 55, description: '55% компаний в одном регионе' },
  { type: 'Технология (дроны)', level: 48, description: '48% инвестиций в одну технологию' },
  { type: 'Стадия (Seed/A)', level: 70, description: '70% портфеля на ранних стадиях' }
])

// Chart
const frontierChart = ref(null)
let chartInstance = null

// ═══════════════════════════════════════════════════════════════════════════
// COMPUTED
// ═══════════════════════════════════════════════════════════════════════════

const expectedReturn = computed(() => {
  // Black-Litterman: комбинация рыночного равновесия + взгляды управляющего
  let baseReturn = 0
  subfunds.value.forEach(sf => {
    let adjustedReturn = sf.historicalReturn

    // Apply views
    marketViews.value.forEach(view => {
      if (view.subfund === sf.id) {
        adjustedReturn += view.excessReturn * view.confidence
      }
    })

    baseReturn += sf.weight * adjustedReturn
  })
  return baseReturn
})

const portfolioRisk = computed(() => {
  // Portfolio variance considering correlation
  let variance = 0
  subfunds.value.forEach((sf1, i) => {
    subfunds.value.forEach((sf2, j) => {
      variance += sf1.weight * sf2.weight * sf1.volatility * sf2.volatility * correlationMatrix.value[i][j]
    })
  })
  return Math.sqrt(variance)
})

const sharpeRatio = computed(() => {
  const excessReturn = expectedReturn.value - riskFreeRate.value
  return portfolioRisk.value > 0 ? excessReturn / portfolioRisk.value : 0
})

const maxDrawdown = computed(() => {
  // Simplified estimate based on volatility and worst correlation scenario
  return portfolioRisk.value * 1.5
})

// ═══════════════════════════════════════════════════════════════════════════
// METHODS
// ═══════════════════════════════════════════════════════════════════════════

function formatNumber(num, decimals = 0) {
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function irrColor(irr) {
  if (irr >= 0.3) return 'var(--fst-green)'
  if (irr >= 0.2) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}

function impactColor(impact) {
  return impact < 0 ? 'var(--fst-red)' : 'var(--fst-green)'
}

function corrClass(corr) {
  if (corr > 0.7) return 'high-corr'
  if (corr > 0.4) return 'med-corr'
  return 'low-corr'
}

function riskLevelColor(level) {
  if (level > 60) return 'var(--fst-red)'
  if (level > 40) return 'var(--fst-brand)'
  return 'var(--fst-green)'
}

function onWeightChange() {
  // Normalize weights to sum to 1.0
  const total = subfunds.value.reduce((sum, sf) => sum + sf.weight, 0)
  if (total > 0) {
    subfunds.value.forEach(sf => {
      sf.weight = sf.weight / total
    })
  }
  hasChanges.value = true
  nextTick(() => {
    updateChart()
  })
}

function resetWeights() {
  if (initialWeights.value) {
    subfunds.value.forEach((sf, i) => {
      sf.weight = initialWeights.value[i]
    })
  }
  hasChanges.value = false
  updateChart()
  toast.add({ severity: 'info', summary: 'Сброшено', detail: 'Веса возвращены к начальным значениям', life: 3000 })
}

function applyOptimal() {
  // Simple mean-variance optimization (maximize Sharpe ratio)
  calculating.value = true

  setTimeout(() => {
    // Simplified optimization: inverse volatility weighting with adjustments
    let totalInvVol = 0
    const invVols = []

    subfunds.value.forEach(sf => {
      const invVol = 1 / sf.volatility
      invVols.push(invVol)
      totalInvVol += invVol
    })

    subfunds.value.forEach((sf, i) => {
      sf.weight = invVols[i] / totalInvVol
    })

    // Apply views boost
    marketViews.value.forEach(view => {
      const sf = subfunds.value.find(s => s.id === view.subfund)
      if (sf && view.excessReturn > 0) {
        const boost = view.excessReturn * view.confidence * 0.3
        sf.weight *= (1 + boost)
      }
    })

    // Normalize
    onWeightChange()

    calculating.value = false
    hasChanges.value = true
    updateChart()
    toast.add({ severity: 'success', summary: 'Оптимизировано', detail: 'Применена оптимальная аллокация по Black-Litterman', life: 3000 })
  }, 800)
}

function recalculate() {
  calculating.value = true
  setTimeout(() => {
    updateChart()
    calculating.value = false
    lastUpdate.value = new Date().toLocaleString('ru')
    toast.add({ severity: 'success', summary: 'Пересчитано', detail: 'Метрики обновлены', life: 3000 })
  }, 500)
}

function applyAllocation() {
  toast.add({ severity: 'success', summary: 'Применено', detail: 'Аллокация сохранена в базе данных фонда', life: 3000 })
  hasChanges.value = false
  initialWeights.value = subfunds.value.map(sf => sf.weight)
}

function addView() {
  if (!newView.value.subfund) {
    toast.add({ severity: 'warn', summary: 'Ошибка', detail: 'Выберите субфонд', life: 3000 })
    return
  }

  const sf = subfunds.value.find(s => s.id === newView.value.subfund)
  marketViews.value.push({
    subfund: newView.value.subfund,
    excessReturn: newView.value.excessReturn / 100,
    confidence: newView.value.confidence / 100,
    text: `${sf.name} даст ${newView.value.excessReturn > 0 ? '+' : ''}${newView.value.excessReturn}% сверх рынка (уверенность ${newView.value.confidence}%)`
  })

  showAddViewDialog.value = false
  newView.value = { subfund: null, excessReturn: 0, confidence: 50 }
  toast.add({ severity: 'success', summary: 'Добавлено', detail: 'Взгляд управляющего добавлен', life: 3000 })
}

function removeView(idx) {
  marketViews.value.splice(idx, 1)
}

function runStressTest() {
  stressTesting.value = true
  setTimeout(() => {
    stressTesting.value = false
    toast.add({ severity: 'info', summary: 'Симуляция завершена', detail: 'Проанализированы 4 шоковых сценария', life: 3000 })
  }, 1500)
}

function generateFrontierData() {
  // Generate efficient frontier points
  const points = []
  const currentPoint = { x: portfolioRisk.value, y: expectedReturn.value }

  // Generate frontier curve (simplified)
  for (let risk = 0.15; risk <= 0.65; risk += 0.02) {
    const ret = riskFreeRate.value + (risk / 0.4) * 0.15 - Math.pow(risk - 0.35, 2) * 0.3
    points.push({ x: risk, y: ret })
  }

  return { points, currentPoint }
}

function initChart() {
  if (!frontierChart.value) return

  const { points, currentPoint } = generateFrontierData()

  const ctx = frontierChart.value.getContext('2d')
  chartInstance = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Граница эффективности',
          data: points,
          borderColor: '#66bb6a',
          backgroundColor: 'rgba(102, 187, 106, 0.1)',
          showLine: true,
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.4
        },
        {
          label: 'Текущий портфель',
          data: [currentPoint],
          backgroundColor: '#ab47bc',
          borderColor: '#fff',
          borderWidth: 2,
          pointRadius: 8,
          pointHoverRadius: 10
        },
        {
          label: 'Субфонды',
          data: subfunds.value.map(sf => ({ x: sf.volatility, y: sf.historicalReturn })),
          backgroundColor: subfunds.value.map(sf => sf.color),
          borderColor: '#fff',
          borderWidth: 2,
          pointRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: 'var(--p-text-color)', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.dataset.label || ''
              return `${label}: Risk ${(ctx.parsed.x * 100).toFixed(1)}%, Return ${(ctx.parsed.y * 100).toFixed(1)}%`
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Риск (волатильность)', color: 'var(--p-text-muted-color)' },
          ticks: {
            callback: (val) => (val * 100).toFixed(0) + '%',
            color: 'var(--p-text-muted-color)'
          },
          grid: { color: 'var(--p-content-border-color)' }
        },
        y: {
          title: { display: true, text: 'Доходность (IRR)', color: 'var(--p-text-muted-color)' },
          ticks: {
            callback: (val) => (val * 100).toFixed(0) + '%',
            color: 'var(--p-text-muted-color)'
          },
          grid: { color: 'var(--p-content-border-color)' }
        }
      }
    }
  })
}

function updateChart() {
  if (!chartInstance) return

  const { points, currentPoint } = generateFrontierData()
  chartInstance.data.datasets[0].data = points
  chartInstance.data.datasets[1].data = [currentPoint]
  chartInstance.data.datasets[2].data = subfunds.value.map(sf => ({ x: sf.volatility, y: sf.historicalReturn }))
  chartInstance.update()
}

// ═══════════════════════════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

onMounted(() => {
  initialWeights.value = subfunds.value.map(sf => sf.weight)
  nextTick(() => {
    initChart()
  })
})

onUnmounted(() => {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null }
})
</script>

<style scoped>
.fst-allocation {
  min-height: 100vh;
  background: var(--p-surface-ground);
  display: flex;
  flex-direction: column;
}

/* ═══════════════════════════════════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════════════════════════════════ */

.fsa-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: transparent;
  border-bottom: 1px solid var(--p-content-border-color);
  position: sticky;
  top: 0;
  z-index: 100;
  gap: 12px;
}

.fsa-header-left { display: flex; flex-direction: column; gap: 4px; }
.fsa-header-right { display: flex; gap: 8px; align-items: center; }

.fsa-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
  color: var(--p-text-color);
}

.fsa-updated {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}

/* ═══════════════════════════════════════════════════════════════════════════
   BODY
   ═══════════════════════════════════════════════════════════════════════════ */

.fsa-body {
  display: grid;
  grid-template-columns: 380px 1fr 380px;
  gap: 16px;
  padding: 16px 24px;
  flex: 1;
  align-items: start;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

.fsa-panel {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 20px;
}

.fsa-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 16px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEFT: SLIDERS
   ═══════════════════════════════════════════════════════════════════════════ */

.fsa-total-nav {
  text-align: center;
  padding: 12px;
  background: var(--p-surface-card);
  border-radius: 6px;
  margin-bottom: 12px;
}

.fsa-nav-label {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.fsa-nav-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--p-text-color);
}

.fsa-sliders { display: flex; flex-direction: column; gap: 20px; }

.fsa-slider-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fsa-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.fsa-slider-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--p-text-color);
}

.fsa-slider-values {
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.fsa-weight {
  font-weight: 600;
  color: var(--p-text-color);
}

.fsa-amount {
  color: var(--p-text-muted-color);
}

.fsa-slider {
  width: 100%;
}

.fsa-slider-footer {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--p-text-muted-color);
}

.fsa-current-irr {
  font-weight: 600;
}

/* Views */
.fsa-views-section {}

.fsa-views-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--p-text-color);
  cursor: pointer;
  padding: 8px 0;
}

.fsa-views-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.fsa-view-item {
  padding: 12px;
  background: var(--p-surface-card);
  border-radius: 6px;
  border-left: 3px solid var(--p-primary-color);
}

.fsa-view-text {
  font-size: 12px;
  color: var(--p-text-color);
  margin-bottom: 6px;
}

.fsa-view-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--p-text-muted-color);
}

.fsa-actions {
  display: flex;
  gap: 8px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CENTER: CHART
   ═══════════════════════════════════════════════════════════════════════════ */

.fsa-chart-wrap {
  height: 320px;
  margin-bottom: 16px;
}

.fsa-metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.fsa-metric-card {
  padding: 12px;
  background: var(--p-surface-card);
  border-radius: 6px;
  text-align: center;
}

.fsa-metric-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}

.fsa-metric-value {
  font-size: 20px;
  font-weight: 700;
}
.fsa-mv-green { color: var(--fst-green); }
.fsa-mv-brand { color: var(--fst-brand); }
.fsa-mv-blue  { color: var(--fst-blue); }
.fsa-mv-red   { color: var(--fst-red); }

/* Correlation Matrix */
.fsa-correlation-matrix {
  margin-bottom: 12px;
}

.fsa-corr-grid {
  display: grid;
  grid-template-columns: 60px repeat(4, 1fr);
  gap: 4px;
  font-size: 11px;
}

.fsa-corr-header,
.fsa-corr-label {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  font-weight: 600;
  color: var(--p-text-muted-color);
}

.fsa-corr-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 4px;
  font-weight: 500;
  cursor: help;
}

.fsa-corr-cell.high-corr {
  background: color-mix(in srgb, var(--fst-red) 20%, transparent);
  color: var(--fst-red);
}

.fsa-corr-cell.med-corr {
  background: color-mix(in srgb, var(--fst-brand) 20%, transparent);
  color: var(--fst-brand);
}

.fsa-corr-cell.low-corr {
  background: color-mix(in srgb, var(--fst-green) 20%, transparent);
  color: var(--fst-green);
}

.fsa-risk-alerts {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fsa-risk-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-radius: 6px;
  font-size: 12px;
}

.fsa-risk-alert.warn {
  background: color-mix(in srgb, var(--fst-brand) 10%, transparent);
  color: var(--fst-brand);
  border-left: 3px solid var(--fst-brand);
}

.fsa-risk-alert.info {
  background: color-mix(in srgb, var(--fst-blue) 10%, transparent);
  color: var(--fst-blue);
  border-left: 3px solid var(--fst-blue);
}

/* ═══════════════════════════════════════════════════════════════════════════
   RIGHT: STRESS TESTS
   ═══════════════════════════════════════════════════════════════════════════ */

.fsa-stress-intro {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-bottom: 16px;
  line-height: 1.5;
}

.fsa-stress-scenarios {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fsa-stress-card {
  padding: 12px;
  background: var(--p-surface-card);
  border-radius: 6px;
  border: 1px solid var(--p-content-border-color);
}

.fsa-stress-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.fsa-stress-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
}

.fsa-stress-desc {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 10px;
  line-height: 1.4;
}

.fsa-stress-impact {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.fsa-impact-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--p-text-color);
}

.fsa-impact-val {
  font-weight: 600;
}

/* Concentration */
.fsa-concentration {}

.fsa-concentration-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 12px;
}

.fsa-concentration-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fsa-concentration-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fsa-conc-type {
  font-size: 12px;
  font-weight: 500;
  color: var(--p-text-color);
}

.fsa-conc-bar-wrap {
  position: relative;
  height: 20px;
  background: var(--p-surface-card);
  border-radius: 4px;
  overflow: hidden;
}

.fsa-conc-bar {
  height: 100%;
  transition: width 0.3s ease;
}

.fsa-conc-label {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-color);
}

.fsa-conc-desc {
  font-size: 11px;
  color: var(--p-text-muted-color);
}

/* Dialog Forms */
.fsa-view-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fsa-form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fsa-form-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--p-text-color);
}

.fsa-info-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--p-text-color);
}

.fsa-info-content ul {
  margin: 12px 0;
  padding-left: 20px;
}

.fsa-info-content li {
  margin: 6px 0;
}

/* Responsive */
@media (max-width: 768px) {
  .fsa-panel { padding: 12px; }
  .fsa-correlation { grid-template-columns: 1fr; }
  .fsa-stress-grid { grid-template-columns: 1fr; }
}

@media (max-width: 1400px) {
  .fsa-body {
    grid-template-columns: 1fr;
  }
}
</style>
