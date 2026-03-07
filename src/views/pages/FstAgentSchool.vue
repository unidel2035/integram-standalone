<template>
  <div class="agent-school fst-page-bg">
    <!-- Header -->
    <div class="school-header">
      <div class="header-left">
        <span class="school-icon">🎓</span>
        <div>
          <h1>Школа агентов ИК</h1>
          <p class="subtitle">Тренировка прогностики на рынках предсказаний и крипто</p>
        </div>
      </div>
      <div class="header-stats">
        <div class="stat-pill" v-for="s in globalStats" :key="s.label">
          <span class="stat-val">{{ s.value }}</span>
          <span class="stat-lbl">{{ s.label }}</span>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="school-tabs">
      <button v-for="tab in tabs" :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id">
        <i :class="tab.icon" />
        {{ tab.label }}
        <span v-if="tabBadge[tab.id]" class="tab-badge">{{ tabBadge[tab.id] }}</span>
      </button>
    </div>

    <!-- ── Tab: Leaderboard ── -->
    <div v-if="activeTab === 'leaderboard'" class="tab-content">
      <div class="leaderboard-grid">
        <div v-for="(agent, idx) in rankedAgents" :key="agent.id"
          :class="['agent-card', `rank-${idx + 1}`]"
          :style="{ '--agent-color': agent.color }">
          <div class="agent-rank">{{ idx + 1 }}</div>
          <div class="agent-avatar">{{ agent.avatar }}</div>
          <div class="agent-info">
            <div class="agent-name">{{ agent.name }}</div>
            <div class="agent-algo">{{ agent.algorithm }}</div>
          </div>
          <div class="agent-metrics">
            <div class="metric" :class="brierClass(agent.stats?.avgBrier)">
              <span class="m-val">{{ agent.stats?.avgBrier?.toFixed(3) ?? '—' }}</span>
              <span class="m-lbl">Brier ↓</span>
            </div>
            <div class="metric">
              <span class="m-val">{{ agent.stats?.accuracy ?? '—' }}%</span>
              <span class="m-lbl">Точность</span>
            </div>
            <div class="metric">
              <span class="m-val">{{ agent.stats?.total ?? 0 }}</span>
              <span class="m-lbl">Ставок</span>
            </div>
            <div class="metric skill" :class="skillClass(agent.stats?.brierSkill)">
              <span class="m-val">{{ agent.stats?.brierSkill != null ? agent.stats.brierSkill + '%' : '—' }}</span>
              <span class="m-lbl">Skill</span>
            </div>
          </div>
          <div class="agent-spark">
            <div class="spark-bar" v-for="(b, i) in (agent.stats?.recentBriers || [])" :key="i"
              :style="{ height: Math.round(b * 200) + '%', background: brierColor(b) }" />
          </div>
          <button class="btn-predict" @click="quickPredict(agent)" :disabled="predicting === agent.id">
            <i :class="predicting === agent.id ? 'pi pi-spin pi-spinner' : 'pi pi-play'" />
            {{ predicting === agent.id ? 'Думает...' : 'Предсказать' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Tab: Markets ── -->
    <div v-if="activeTab === 'markets'" class="tab-content">
      <div class="markets-toolbar">
        <button v-for="src in ['all', 'manifold', 'metaculus', 'crypto']" :key="src"
          :class="['filter-btn', { active: marketFilter === src }]"
          @click="marketFilter = src">
          {{ srcLabel(src) }}
        </button>
        <button class="btn-refresh" @click="loadMarkets" :disabled="loadingMarkets">
          <i :class="loadingMarkets ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'" />
          Обновить
        </button>
      </div>

      <div class="markets-grid">
        <div v-for="m in filteredMarkets" :key="m.id" class="market-card">
          <div class="market-platform">
            <span :class="platformIcon(m.platform)" />
            {{ m.platform }}
            <span class="market-cat">{{ m.category }}</span>
          </div>
          <div class="market-title">{{ m.title }}</div>
          <div class="market-prob-bar">
            <div class="prob-fill" :style="{ width: m.probability + '%', background: probColor(m.probability) }" />
          </div>
          <div class="market-meta">
            <span class="market-prob">{{ m.probability }}% YES</span>
            <span v-if="m.closeTime" class="market-close">
              до {{ new Date(m.closeTime).toLocaleDateString('ru') }}
            </span>
          </div>
          <!-- Agent predictions on this market -->
          <div class="market-agent-preds" v-if="marketPredictions[m.id]?.length">
            <div v-for="p in marketPredictions[m.id]" :key="p.agentId"
              class="mini-pred" :title="p.reasoning">
              <span class="mini-avatar">{{ agentById(p.agentId)?.avatar }}</span>
              <span :class="['mini-prob', p.probability > 50 ? 'bull' : 'bear']">{{ p.probability }}%</span>
            </div>
          </div>
          <div class="market-actions">
            <button class="btn-sm" @click="selectMarket(m)">
              <i class="pi pi-chart-scatter" /> Турнир агентов
            </button>
            <a v-if="m.url" :href="m.url" target="_blank" class="btn-sm link">
              <i class="pi pi-external-link" /> Открыть
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Tab: Crypto Live ── -->
    <div v-if="activeTab === 'crypto'" class="tab-content">
      <div class="crypto-header">
        <h3>Крипто-трекер предсказаний</h3>
        <button class="btn-refresh" @click="loadCrypto" :disabled="loadingCrypto">
          <i :class="loadingCrypto ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'" />
          Цены
        </button>
      </div>
      <div class="crypto-grid">
        <div v-for="coin in cryptoPrices" :key="coin.id" class="coin-card">
          <div class="coin-header">
            <span class="coin-symbol">{{ coin.symbol?.toUpperCase() }}</span>
            <span class="coin-name">{{ coin.name }}</span>
          </div>
          <div class="coin-price">${{ coin.current_price?.toLocaleString() }}</div>
          <div class="coin-changes">
            <span :class="['change', coin.price_change_percentage_24h > 0 ? 'up' : 'down']">
              24h: {{ coin.price_change_percentage_24h?.toFixed(2) }}%
            </span>
            <span :class="['change', (coin.price_change_percentage_7d_in_currency || 0) > 0 ? 'up' : 'down']">
              7d: {{ (coin.price_change_percentage_7d_in_currency || 0).toFixed(2) }}%
            </span>
          </div>
          <!-- Agent forecasts for this coin -->
          <div class="coin-forecasts">
            <div v-if="coinForecasts[coin.id]?.length" class="forecast-list">
              <div v-for="f in coinForecasts[coin.id]" :key="f.agentId" class="forecast-row">
                <span class="f-avatar">{{ agentById(f.agentId)?.avatar }}</span>
                <span class="f-name">{{ agentById(f.agentId)?.shortName }}</span>
                <span :class="['f-pred', f.probability > 50 ? 'bull' : 'bear']">
                  {{ f.probability }}% ↑
                </span>
                <span class="f-conf" :title="f.reasoning">{{ f.confidence }}% увер.</span>
              </div>
            </div>
            <button v-else class="btn-sm" @click="runCoinTournament(coin)" :disabled="tourney === coin.id">
              <i :class="tourney === coin.id ? 'pi pi-spin pi-spinner' : 'pi pi-bolt'" />
              {{ tourney === coin.id ? 'Анализ...' : 'Предсказать всеми агентами' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Tab: History ── -->
    <div v-if="activeTab === 'history'" class="tab-content">
      <div class="history-filters">
        <select v-model="historyAgent" class="flt-select">
          <option value="">Все агенты</option>
          <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.avatar }} {{ a.name }}</option>
        </select>
        <select v-model="historyStatus" class="flt-select">
          <option value="">Все статусы</option>
          <option value="open">Открытые</option>
          <option value="correct">Верные ✓</option>
          <option value="wrong">Неверные ✗</option>
        </select>
        <select v-model="historyCategory" class="flt-select">
          <option value="">Все категории</option>
          <option v-for="c in ['crypto','startup','macro','tech','other']" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <div class="predictions-table">
        <div class="pred-header">
          <span>Агент</span><span>Предсказание</span><span>Алгоритм</span>
          <span>Ставка</span><span>Исход</span><span>Brier</span><span>Статус</span>
        </div>
        <div v-if="filteredHistory.length === 0" class="no-data">
          Нет предсказаний. Запустите агентов на рынках!
        </div>
        <div v-for="p in filteredHistory" :key="p._id" class="pred-row">
          <span class="pred-agent">
            <span class="agent-av">{{ agentById(p.agentId)?.avatar }}</span>
            {{ agentById(p.agentId)?.shortName }}
          </span>
          <span class="pred-title" :title="p.reasoning">{{ p.title }}</span>
          <span class="pred-algo">{{ p.algorithm }}</span>
          <span class="pred-prob">{{ p.probability }}%</span>
          <span class="pred-outcome">{{ p.actualOutcome || '?' }}%</span>
          <span class="pred-brier" :class="brierClass(p.brierScore)">
            {{ p.brierScore ? p.brierScore.toFixed(3) : '—' }}
          </span>
          <span :class="['pred-status', p.status]">
            {{ { open: '⏳', correct: '✓', wrong: '✗', resolved: '•' }[p.status] || '?' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Tournament Modal -->
    <Teleport to="body">
    <div v-if="showTournament" class="modal-overlay" @click.self="showTournament = false">
      <div class="tournament-modal">
        <div class="modal-header">
          <h3>Турнир агентов: <em>{{ selectedMarket?.title }}</em></h3>
          <button @click="showTournament = false"><i class="pi pi-times" /></button>
        </div>
        <div class="modal-body">
          <div v-if="tournamentRunning" class="tournament-progress">
            <div v-for="a in agents" :key="a.id" class="agent-progress-row">
              <span class="ap-avatar">{{ a.avatar }}</span>
              <span class="ap-name">{{ a.name }}</span>
              <span class="ap-status">
                <i v-if="tournamentDone[a.id] === 'pending'" class="pi pi-spin pi-spinner" />
                <span v-else-if="tournamentDone[a.id]">{{ tournamentDone[a.id].probability }}%</span>
                <span v-else>—</span>
              </span>
            </div>
          </div>
          <div v-else-if="tournamentResults.length" class="tournament-results">
            <div v-for="r in tournamentResults" :key="r.agent.id" class="result-row"
              :style="{ '--agent-color': r.agent.color }">
              <span class="r-avatar">{{ r.agent.avatar }}</span>
              <span class="r-name">{{ r.agent.name }}</span>
              <div class="r-prob-bar">
                <div class="r-prob-fill" :style="{ width: r.prediction.probability + '%', background: probColor(r.prediction.probability) }" />
              </div>
              <span class="r-prob">{{ r.prediction.probability }}% YES</span>
              <span class="r-conf">conf: {{ r.prediction.confidence }}%</span>
              <div class="r-reasoning" v-if="expandedResult === r.agent.id">
                {{ r.prediction.reasoning }}
              </div>
              <button class="r-expand" @click="expandedResult = expandedResult === r.agent.id ? null : r.agent.id">
                {{ expandedResult === r.agent.id ? '▲' : '▼' }}
              </button>
            </div>
            <!-- Aggregated view -->
            <div class="tournament-aggregate">
              <div class="agg-label">Медианная ставка агентов:</div>
              <div class="agg-prob" :style="{ color: probColor(medianPrediction) }">
                {{ medianPrediction }}% YES
              </div>
              <div class="agg-spread">Разброс: {{ spreadPrediction }}% — {{ spreadMax }}%</div>
              <div class="agg-nash" v-if="nashResult">
                Nash Equilibrium: {{ nashResult.isNash ? '✓ Достигнут' : '⚠ Не достигнут' }}
                {{ nashResult.consensus === 'approve' ? '(консенсус: ДА)' : '(консенсус: НЕТ)' }}
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn-save" @click="saveAllPredictions">
                <i class="pi pi-database" /> Сохранить все предсказания
              </button>
            </div>
          </div>
        </div>
        <div v-if="!tournamentRunning && !tournamentResults.length" class="modal-footer">
          <button class="btn-primary" @click="startTournament">
            <i class="pi pi-bolt" /> Запустить турнир агентов
          </button>
        </div>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { AGENTS } from '@/components/fst-committee/FstCommitteeConfig.js'
import {
  fetchManifoldMarkets, fetchMetaculusQuestions,
  buildCryptoMarkets, fetchCryptoPrices,
  savePrediction, loadPredictions, computeAgentStats,
} from '@/components/fst-school/fstPredictionService.js'
import {
  generatePrediction, runAgentTournament,
} from '@/components/fst-school/fstAgentPredictionEngine.js'
import { checkNashEquilibrium } from '@/components/fst-committee/fstAgentConfigService.js'

// ── State ─────────────────────────────────────────────────────────────────────

const activeTab = ref('leaderboard')
const agents = ref(AGENTS)
const allPredictions = ref([])
const agentStats = ref({})
const markets = ref([])
const cryptoPrices = ref([])
const cryptoMarkets = ref([])
const coinForecasts = ref({})
const marketPredictions = ref({})
const marketFilter = ref('all')
const historyAgent = ref('')
const historyStatus = ref('')
const historyCategory = ref('')

const loadingMarkets = ref(false)
const loadingCrypto = ref(false)
const predicting = ref(null)
const tourney = ref(null)
const showTournament = ref(false)
const selectedMarket = ref(null)
const tournamentRunning = ref(false)
const tournamentDone = ref({})
const tournamentResults = ref([])
const expandedResult = ref(null)

const tabs = [
  { id: 'leaderboard', label: 'Рейтинг агентов', icon: 'pi pi-trophy' },
  { id: 'markets', label: 'Рынки предсказаний', icon: 'pi pi-chart-scatter' },
  { id: 'crypto', label: 'Крипто', icon: 'pi pi-bitcoin' },
  { id: 'history', label: 'История', icon: 'pi pi-history' },
]

const tabBadge = computed(() => ({
  markets: markets.value.length || null,
  history: allPredictions.value.length || null,
}))

// ── Computed ──────────────────────────────────────────────────────────────────

const rankedAgents = computed(() => {
  return [...agents.value]
    .map(a => ({
      ...a,
      stats: agentStats.value[a.id] || null,
      algorithm: _algoName(a.id),
    }))
    .sort((a, b) => {
      const ba = a.stats?.avgBrier ?? 999
      const bb = b.stats?.avgBrier ?? 999
      if (ba !== bb) return ba - bb
      return (b.stats?.total || 0) - (a.stats?.total || 0)
    })
})

const filteredMarkets = computed(() => {
  if (marketFilter.value === 'all') return markets.value
  return markets.value.filter(m => m.platform === marketFilter.value)
})

const filteredHistory = computed(() => {
  return allPredictions.value.filter(p => {
    if (historyAgent.value && p.agentId !== historyAgent.value) return false
    if (historyStatus.value && p.status !== historyStatus.value) return false
    if (historyCategory.value && p.category !== historyCategory.value) return false
    return true
  })
})

const globalStats = computed(() => {
  const total = allPredictions.value.length
  const resolved = allPredictions.value.filter(p => p.status !== 'open').length
  const correct = allPredictions.value.filter(p => p.status === 'correct').length
  const allBriers = allPredictions.value.filter(p => p.brierScore > 0).map(p => p.brierScore)
  const avgBrier = allBriers.length ? (allBriers.reduce((s, b) => s + b, 0) / allBriers.length).toFixed(3) : '—'
  return [
    { label: 'Предсказаний', value: total },
    { label: 'Разрешено', value: resolved },
    { label: 'Верных', value: correct },
    { label: 'Avg Brier', value: avgBrier },
  ]
})

const medianPrediction = computed(() => {
  const probs = tournamentResults.value.map(r => r.prediction.probability).sort((a, b) => a - b)
  if (!probs.length) return 50
  const mid = Math.floor(probs.length / 2)
  return probs.length % 2 ? probs[mid] : Math.round((probs[mid - 1] + probs[mid]) / 2)
})
const spreadPrediction = computed(() => Math.min(...tournamentResults.value.map(r => r.prediction.probability)))
const spreadMax = computed(() => Math.max(...tournamentResults.value.map(r => r.prediction.probability)))
const nashResult = computed(() => {
  if (!tournamentResults.value.length) return null
  const votes = {}
  for (const r of tournamentResults.value) votes[r.agent.id] = r.prediction.probability / 100
  return checkNashEquilibrium(votes)
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([loadHistory(), loadMarkets(), loadCrypto()])
})

async function loadHistory() {
  try {
    allPredictions.value = await loadPredictions()
    agentStats.value = computeAgentStats(allPredictions.value)
    // Build per-market predictions map
    const mmap = {}
    for (const p of allPredictions.value) {
      if (!mmap[p.marketId]) mmap[p.marketId] = []
      mmap[p.marketId].push(p)
    }
    marketPredictions.value = mmap
  } catch (e) {
    console.warn('loadHistory:', e.message)
  }
}

async function loadMarkets() {
  loadingMarkets.value = true
  try {
    const [manifold, metaculus, crypto] = await Promise.all([
      fetchManifoldMarkets('', 12),
      fetchMetaculusQuestions(6),
      buildCryptoMarkets(),
    ])
    markets.value = [...manifold, ...metaculus, ...crypto.slice(0, 6)]
  } finally {
    loadingMarkets.value = false
  }
}

async function loadCrypto() {
  loadingCrypto.value = true
  try {
    cryptoPrices.value = await fetchCryptoPrices()
    cryptoMarkets.value = await buildCryptoMarkets()
  } finally {
    loadingCrypto.value = false
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function quickPredict(agent) {
  predicting.value = agent.id
  try {
    // Pick a random market
    const market = markets.value[Math.floor(Math.random() * markets.value.length)]
    if (!market) return
    const memory = allPredictions.value.filter(p => p.agentId === agent.id)
    const stats = agentStats.value[agent.id] || {}
    const pred = await generatePrediction(agent.id, market, memory, stats)
    await savePrediction(pred)
    await loadHistory()
    activeTab.value = 'history'
  } finally {
    predicting.value = null
  }
}

function selectMarket(market) {
  selectedMarket.value = market
  tournamentResults.value = []
  tournamentDone.value = {}
  showTournament.value = true
}

async function startTournament() {
  if (!selectedMarket.value) return
  tournamentRunning.value = true
  tournamentResults.value = []

  // Initialize pending state
  for (const a of agents.value) tournamentDone.value[a.id] = 'pending'

  try {
    for (const agent of agents.value) {
      const memory = allPredictions.value.filter(p => p.agentId === agent.id)
      const stats = agentStats.value[agent.id] || {}
      try {
        const pred = await generatePrediction(agent.id, selectedMarket.value, memory, stats)
        tournamentDone.value[agent.id] = pred
        tournamentResults.value.push({ agent, prediction: pred })
      } catch {
        tournamentDone.value[agent.id] = { probability: '?' }
      }
      await new Promise(r => setTimeout(r, 200))
    }
  } finally {
    tournamentRunning.value = false
  }
}

async function saveAllPredictions() {
  for (const r of tournamentResults.value) {
    try { await savePrediction(r.prediction) } catch { /* skip */ }
  }
  await loadHistory()
  showTournament.value = false
}

async function runCoinTournament(coin) {
  tourney.value = coin.id
  try {
    const market = cryptoMarkets.value.find(m => m.coinId === coin.id && m.horizon === '24h')
    if (!market) return
    const results = []
    for (const agent of agents.value.slice(0, 6)) {
      try {
        const pred = await generatePrediction(agent.id, market, [], {})
        results.push(pred)
      } catch { /* skip */ }
      await new Promise(r => setTimeout(r, 200))
    }
    coinForecasts.value[coin.id] = results
  } finally {
    tourney.value = null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function agentById(id) { return agents.value.find(a => a.id === id) }
function brierClass(b) { if (!b) return ''; return b < 0.1 ? 'good' : b < 0.2 ? 'ok' : 'bad' }
function skillClass(s) { if (s == null) return ''; return s > 30 ? 'good' : s > 0 ? 'ok' : 'bad' }
function brierColor(b) { return b < 0.1 ? '#4caf50' : b < 0.2 ? '#ffa726' : '#ef5350' }
function probColor(p) { return p > 65 ? '#4caf50' : p < 35 ? '#ef5350' : '#ffa726' }
function srcLabel(src) { return { all: 'Все', manifold: '🎯 Manifold', metaculus: '📊 Metaculus', crypto: '₿ Крипто' }[src] || src }
function platformIcon(p) { return p === 'crypto' ? 'pi pi-bitcoin' : 'pi pi-chart-scatter' }
function _algoName(id) {
  const map = {
    monte_carlo: 'Monte Carlo', bayesian: 'Bayesian', market_timing: 'Цикл Маркса',
    real_options: 'Real Options', power_score: '7 Powers', game_theory: 'Nash Theory',
    finance: 'DCF/IRR', risk: 'VaR/FMEA', tech: 'TRL/MRL',
    sovereignty: 'Geopolitics', portfolio: 'Portfolio Theory', devil: "Devil's Advocate",
  }
  return map[id] || id
}
</script>

<style scoped>
.fst-page-bg { background: var(--p-surface-ground); min-height: 100vh; }
.agent-school { padding: 1.5rem; max-width: 1400px; margin: 0 auto; color: var(--p-text-color); }

.school-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap;
}
.header-left { display: flex; align-items: center; gap: 1rem; }
.school-icon { font-size: 2.5rem; }
h1 { font-size: 1.6rem; font-weight: 700; margin: 0; }
.subtitle { color: var(--p-text-muted-color); font-size: 0.9rem; margin: 0.2rem 0 0; }
.header-stats { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.stat-pill {
  display: flex; flex-direction: column; align-items: center;
  background: var(--p-surface-card); border: 1px solid var(--p-surface-border);
  border-radius: 0.75rem; padding: 0.5rem 1rem;
}
.stat-val { font-size: 1.3rem; font-weight: 700; line-height: 1; }
.stat-lbl { font-size: 0.7rem; color: var(--p-text-muted-color); margin-top: 0.2rem; }

/* Tabs */
.school-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.tab-btn {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.6rem 1rem; border-radius: 0.5rem; border: 1px solid var(--p-surface-border);
  background: var(--p-surface-card); cursor: pointer; font-size: 0.9rem;
  color: var(--p-text-color); transition: all 0.2s;
}
.tab-btn.active { background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color); }
.tab-badge {
  background: var(--p-primary-color); color: #fff; border-radius: 50%;
  font-size: 0.7rem; min-width: 1.2rem; height: 1.2rem;
  display: flex; align-items: center; justify-content: center; padding: 0 0.2rem;
}

/* Leaderboard */
.leaderboard-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.agent-card {
  background: var(--p-surface-card); border: 1px solid var(--p-surface-border);
  border-left: 4px solid var(--agent-color, #78909c);
  border-radius: 0.75rem; padding: 1rem; position: relative;
  display: flex; flex-direction: column; gap: 0.75rem;
}
.rank-1 { box-shadow: 0 0 20px rgba(255, 215, 0, 0.3); }
.rank-2 { box-shadow: 0 0 15px rgba(192, 192, 192, 0.3); }
.rank-3 { box-shadow: 0 0 10px rgba(205, 127, 50, 0.3); }
.agent-rank {
  position: absolute; top: 0.75rem; right: 0.75rem;
  font-size: 1.2rem; font-weight: 700; opacity: 0.5;
}
.agent-avatar { font-size: 2rem; }
.agent-name { font-weight: 700; font-size: 1rem; }
.agent-algo { font-size: 0.75rem; color: var(--p-text-muted-color); }
.agent-metrics { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.metric { display: flex; flex-direction: column; align-items: center; min-width: 3.5rem; }
.m-val { font-size: 1rem; font-weight: 700; }
.m-lbl { font-size: 0.65rem; color: var(--p-text-muted-color); }
.metric.good .m-val { color: #4caf50; }
.metric.ok .m-val { color: #ffa726; }
.metric.bad .m-val { color: #ef5350; }
.skill.good .m-val { color: #4caf50; }
.skill.ok .m-val { color: #ffa726; }
.skill.bad .m-val { color: #ef5350; }
.agent-spark { display: flex; align-items: flex-end; height: 24px; gap: 2px; }
.spark-bar { width: 6px; border-radius: 2px; min-height: 2px; transition: height 0.3s; }
.btn-predict {
  padding: 0.4rem 0.75rem; border-radius: 0.4rem; border: none; cursor: pointer;
  background: var(--agent-color, var(--p-primary-color)); color: #fff; font-size: 0.82rem;
  display: flex; align-items: center; gap: 0.4rem;
}
.btn-predict:disabled { opacity: 0.6; cursor: wait; }

/* Markets */
.markets-toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center; }
.filter-btn {
  padding: 0.4rem 0.9rem; border-radius: 0.4rem; border: 1px solid var(--p-surface-border);
  background: var(--p-surface-card); cursor: pointer; font-size: 0.85rem; color: var(--p-text-color);
}
.filter-btn.active { background: var(--p-primary-color); color: #fff; border-color: transparent; }
.btn-refresh {
  margin-left: auto; padding: 0.4rem 0.9rem; border-radius: 0.4rem;
  background: var(--p-surface-section, var(--p-surface-50, rgba(0,0,0,0.04))); border: 1px solid var(--p-surface-border);
  cursor: pointer; display: flex; align-items: center; gap: 0.4rem; color: var(--p-text-color);
}
.markets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
.market-card {
  background: var(--p-surface-card); border: 1px solid var(--p-surface-border);
  border-radius: 0.75rem; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem;
}
.market-platform { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: var(--p-text-muted-color); }
.market-cat {
  margin-left: auto; background: var(--p-surface-section, var(--p-surface-50, rgba(0,0,0,0.04))); border-radius: 0.3rem;
  padding: 0.1rem 0.4rem; font-size: 0.7rem;
}
.market-title { font-weight: 600; font-size: 0.9rem; line-height: 1.3; }
.market-prob-bar { height: 6px; background: var(--p-surface-border, rgba(0,0,0,0.1)); border-radius: 3px; overflow: hidden; }
.prob-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.market-meta { display: flex; justify-content: space-between; font-size: 0.8rem; }
.market-close { color: var(--p-text-muted-color); }
.market-agent-preds { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.mini-pred { display: flex; align-items: center; gap: 0.2rem; font-size: 0.8rem; }
.mini-prob.bull { color: #4caf50; }
.mini-prob.bear { color: #ef5350; }
.market-actions { display: flex; gap: 0.5rem; }
.btn-sm {
  flex: 1; padding: 0.35rem; border-radius: 0.35rem; border: 1px solid var(--p-surface-border);
  background: var(--p-surface-section, var(--p-surface-50, rgba(0,0,0,0.04))); cursor: pointer; font-size: 0.78rem;
  display: flex; align-items: center; justify-content: center; gap: 0.3rem; color: var(--p-text-color);
  text-decoration: none;
}
.btn-sm.link:hover { background: var(--p-surface-border, rgba(0,0,0,0.1)); }

/* Crypto */
.crypto-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.crypto-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
.coin-card {
  background: var(--p-surface-card); border: 1px solid var(--p-surface-border);
  border-radius: 0.75rem; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem;
}
.coin-header { display: flex; align-items: center; gap: 0.5rem; }
.coin-symbol { font-weight: 800; font-size: 1.1rem; }
.coin-name { color: var(--p-text-muted-color); font-size: 0.85rem; }
.coin-price { font-size: 1.6rem; font-weight: 700; }
.coin-changes { display: flex; gap: 0.75rem; }
.change { font-size: 0.85rem; font-weight: 600; }
.change.up { color: #4caf50; }
.change.down { color: #ef5350; }
.forecast-list { display: flex; flex-direction: column; gap: 0.4rem; }
.forecast-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; }
.f-avatar { font-size: 1rem; }
.f-name { flex: 1; color: var(--p-text-muted-color); }
.f-pred { font-weight: 700; }
.f-pred.bull { color: #4caf50; }
.f-pred.bear { color: #ef5350; }
.f-conf { color: var(--p-text-muted-color); font-size: 0.75rem; }

/* History */
.history-filters { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
.flt-select {
  padding: 0.4rem 0.75rem; border-radius: 0.4rem; border: 1px solid var(--p-surface-border);
  background: var(--p-surface-card); color: var(--p-text-color); font-size: 0.85rem;
}
.predictions-table { display: flex; flex-direction: column; gap: 0; }
.pred-header, .pred-row {
  display: grid;
  grid-template-columns: 100px 1fr 140px 60px 60px 70px 60px;
  gap: 0.5rem; padding: 0.5rem 0.75rem; align-items: center; font-size: 0.82rem;
}
.pred-header { background: var(--p-surface-section, var(--p-surface-50, rgba(0,0,0,0.04))); border-radius: 0.5rem; font-weight: 600; color: var(--p-text-muted-color); }
.pred-row { border-bottom: 1px solid var(--p-surface-border); }
.pred-row:hover { background: var(--p-surface-section, var(--p-surface-50, rgba(0,0,0,0.04))); }
.pred-agent { display: flex; align-items: center; gap: 0.3rem; }
.agent-av { font-size: 1.1rem; }
.pred-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pred-brier.good { color: #4caf50; }
.pred-brier.ok { color: #ffa726; }
.pred-brier.bad { color: #ef5350; }
.pred-status.correct { color: #4caf50; }
.pred-status.wrong { color: #ef5350; }
.no-data { text-align: center; padding: 2rem; color: var(--p-text-muted-color); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}
.tournament-modal {
  background: var(--p-surface-card); border-radius: 1rem; max-width: 700px; width: 95%;
  max-height: 85vh; overflow-y: auto; display: flex; flex-direction: column;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--p-surface-border);
}
.modal-header h3 { margin: 0; font-size: 1rem; flex: 1; }
.modal-header em { color: var(--p-text-muted-color); }
.modal-body { padding: 1.25rem 1.5rem; flex: 1; display: flex; flex-direction: column; gap: 0.75rem; }
.modal-footer { padding: 1rem 1.5rem; border-top: 1px solid var(--p-surface-border); }
.agent-progress-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.4rem 0; font-size: 0.88rem; }
.result-row {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.5rem; border-radius: 0.5rem; border: 1px solid var(--p-surface-border);
  border-left: 3px solid var(--agent-color); flex-wrap: wrap;
}
.r-avatar { font-size: 1.3rem; }
.r-name { min-width: 120px; font-weight: 600; }
.r-prob-bar { flex: 1; height: 8px; background: var(--p-surface-border, rgba(0,0,0,0.1)); border-radius: 4px; overflow: hidden; min-width: 60px; }
.r-prob-fill { height: 100%; border-radius: 4px; }
.r-prob { font-weight: 700; min-width: 50px; }
.r-conf { font-size: 0.75rem; color: var(--p-text-muted-color); }
.r-reasoning { width: 100%; font-size: 0.8rem; color: var(--p-text-muted-color); padding: 0.4rem; background: var(--p-surface-section, var(--p-surface-50, rgba(0,0,0,0.04))); border-radius: 0.3rem; }
.r-expand { border: none; background: none; cursor: pointer; color: var(--p-text-muted-color); font-size: 0.7rem; margin-left: auto; }
.tournament-aggregate {
  background: var(--p-surface-section, var(--p-surface-50, rgba(0,0,0,0.04))); border-radius: 0.5rem; padding: 1rem;
  display: flex; flex-direction: column; gap: 0.4rem;
}
.agg-prob { font-size: 2rem; font-weight: 800; }
.agg-label, .agg-spread, .agg-nash { font-size: 0.85rem; color: var(--p-text-muted-color); }
.modal-actions { display: flex; justify-content: flex-end; }
.btn-save {
  padding: 0.6rem 1.2rem; border-radius: 0.5rem; background: var(--p-primary-color);
  color: #fff; border: none; cursor: pointer; font-size: 0.9rem;
  display: flex; align-items: center; gap: 0.5rem;
}
.btn-primary {
  padding: 0.7rem 1.5rem; border-radius: 0.5rem; background: var(--p-primary-color);
  color: #fff; border: none; cursor: pointer; font-size: 0.95rem;
  display: flex; align-items: center; gap: 0.5rem;
}
</style>
