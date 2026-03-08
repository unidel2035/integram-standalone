<template>
  <div class="fst-protocol">
    <Toast position="bottom-center" />

    <!-- Header -->
    <div class="fst-proto-header">
      <div class="fst-proto-header-left">
        <div class="fst-proto-logo">
          <i class="pi pi-file-check" style="color:#ffa726;font-size:20px"></i>
          <span>ФСТ НТИ · <b>Протоколы инвесткомитета</b></span>
          <Tag :value="`${sessions.length} сессий`" severity="info" style="font-size:11px" />
        </div>
        <div class="fst-proto-subtitle">
          История всех заседаний AI-инвесткомитета с полными дебатами агентов
        </div>
      </div>
      <div class="fst-proto-header-right">
        <Button icon="pi pi-refresh" label="Обновить" size="small" severity="secondary"
          @click="loadSessions" :loading="loading" />
        <Button icon="pi pi-building" label="Новая сессия" size="small" severity="success"
          @click="$router.push('/fst-committee')" />
      </div>
    </div>

    <!-- Filters -->
    <div class="fst-proto-filters">
      <Select v-model="filterDecision" :options="decisionOptions" placeholder="Все решения"
        class="fst-filter-sel" size="small" />
      <span class="fst-search-wrap">
        <i class="pi pi-search" style="font-size:12px;color:var(--p-text-muted-color)" />
        <InputText v-model="searchQuery" placeholder="Поиск по проекту..." size="small" class="fst-search" />
      </span>
    </div>

    <!-- Sessions List -->
    <div class="fst-proto-body">
      <div v-if="loading" class="fst-proto-loading">
        <i class="pi pi-spin pi-spinner" style="font-size:24px;color:#ffa726"></i>
        <p>Загрузка протоколов...</p>
      </div>

      <div v-else-if="filteredSessions.length === 0" class="fst-proto-empty">
        <i class="pi pi-inbox" style="font-size:48px;color:#666"></i>
        <p>Нет протоколов инвесткомитета</p>
        <Button label="Запустить первую сессию" icon="pi pi-play" severity="success"
          @click="$router.push('/fst-committee')" />
      </div>

      <div v-else class="fst-proto-sessions">
        <div v-for="session in filteredSessions" :key="session.id"
          class="fst-proto-session-card"
          @click="selectSession(session)">
          <div class="fst-proto-card-header">
            <div class="fst-proto-card-project">
              <i class="pi pi-briefcase" style="color:#42a5f5"></i>
              {{ session.protocol?.decision?.projectName || session.projectName || session.name }}
            </div>
            <div class="fst-proto-card-badges">
              <div class="fst-proto-score" :style="{ color: scoreColor(session.protocol?.decision?.aggregatedScore || session.aggregatedScore) }">
                {{ session.protocol?.decision?.aggregatedScore || session.aggregatedScore || 0 }}/100
              </div>
              <Tag :value="decisionLabel((session.protocol?.decision?.recommendation || session.recommendation))"
                :severity="decisionSeverity((session.protocol?.decision?.recommendation || session.recommendation))"
                :style="{ background: decisionColor((session.protocol?.decision?.recommendation || session.recommendation)) }" />
            </div>
          </div>

          <div class="fst-proto-card-meta">
            <span class="fst-proto-meta-item">
              <i class="pi pi-calendar"></i>
              {{ formatDate(session.meetingDate) }}
            </span>
            <span class="fst-proto-meta-item">
              <i class="pi pi-users"></i>
              {{ session.protocol?.votes?.length || 0 }} голосов
            </span>
            <span class="fst-proto-meta-item">
              <i class="pi pi-comments"></i>
              {{ session.protocol?.arguments?.length || 0 }} аргументов
            </span>
            <span class="fst-proto-meta-item" v-if="session.votesAgainst > 0" style="color:#ef5350">
              <i class="pi pi-times-circle"></i>
              {{ session.votesAgainst }} против
            </span>
          </div>

          <div v-if="session.protocol?.decision?.conditions?.length" class="fst-proto-card-conditions">
            <i class="pi pi-info-circle" style="color:#ffa726"></i>
            <span>{{ session.protocol.decision.conditions.length }} условий одобрения</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Session Detail Dialog -->
    <Dialog v-model:visible="detailVisible" :header="selectedSession?.name" modal
      :style="{ width: '1200px', maxWidth: '95vw' }">
      <div v-if="selectedSession?.protocol" class="fst-proto-detail">

        <!-- Decision Summary -->
        <div class="fst-proto-detail-section">
          <div class="fst-proto-detail-title">Решение комитета</div>
          <div class="fst-proto-decision-summary">
            <div class="fst-proto-decision-score">
              <div class="fst-proto-score-big" :style="{ color: scoreColor(selectedSession.protocol.decision.aggregatedScore) }">
                {{ selectedSession.protocol.decision.aggregatedScore }}
              </div>
              <div class="fst-proto-score-label">Итоговый балл</div>
            </div>
            <div class="fst-proto-decision-verdict">
              <Tag :value="decisionLabel(selectedSession.protocol.decision.recommendation)"
                :severity="decisionSeverity(selectedSession.protocol.decision.recommendation)"
                :style="{ background: decisionColor(selectedSession.protocol.decision.recommendation), fontSize: '16px', padding: '8px 16px' }" />
              <div v-if="selectedSession.protocol.humanApproval" class="fst-proto-human-approval">
                <i class="pi pi-check-circle" style="color:#4caf50"></i>
                Утверждено: {{ selectedSession.protocol.humanApproval.approvedBy }}
                <span v-if="selectedSession.protocol.humanApproval.comment" class="fst-proto-human-comment">
                  "{{ selectedSession.protocol.humanApproval.comment }}"
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Vote Distribution -->
        <div class="fst-proto-detail-section">
          <div class="fst-proto-detail-title">Распределение голосов агентов</div>
          <div class="fst-proto-votes">
            <div v-for="vote in selectedSession.protocol.votes" :key="vote.agentId" class="fst-proto-vote">
              <div class="fst-proto-vote-agent">
                <span class="fst-proto-vote-emoji">{{ getAgentEmoji(vote.agentId) }}</span>
                <span class="fst-proto-vote-name">{{ getAgentName(vote.agentId) }}</span>
              </div>
              <div class="fst-proto-vote-verdict">
                <Tag :value="decisionLabel(vote.verdict)" :severity="decisionSeverity(vote.verdict)"
                  :style="{ background: decisionColor(vote.verdict) }" />
              </div>
              <div class="fst-proto-vote-score">{{ vote.score }}/100</div>
              <div class="fst-proto-vote-conf">
                <div class="fst-proto-conf-bar-bg">
                  <div class="fst-proto-conf-bar" :style="{ width: (vote.confidence * 100) + '%' }"></div>
                </div>
                <span class="fst-proto-conf-val">{{ Math.round(vote.confidence * 100) }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Conditions -->
        <div v-if="selectedSession.protocol.decision.conditions?.length" class="fst-proto-detail-section">
          <div class="fst-proto-detail-title">Условия одобрения</div>
          <ul class="fst-proto-list">
            <li v-for="(c, i) in selectedSession.protocol.decision.conditions" :key="i">
              <i class="pi pi-angle-right" style="color:#ffa726"></i> {{ c }}
            </li>
          </ul>
        </div>

        <!-- Risks -->
        <div v-if="selectedSession.protocol.decision.risks?.length" class="fst-proto-detail-section">
          <div class="fst-proto-detail-title">Ключевые риски</div>
          <ul class="fst-proto-list">
            <li v-for="(r, i) in selectedSession.protocol.decision.risks" :key="i">
              <i class="pi pi-exclamation-triangle" style="color:#ef5350"></i> {{ r }}
            </li>
          </ul>
        </div>

        <!-- Arguments Timeline -->
        <div class="fst-proto-detail-section">
          <div class="fst-proto-detail-title">
            Аргументы дебатов
            <span style="font-size:12px;color:var(--p-text-muted-color);margin-left:8px">
              ({{ selectedSession.protocol.arguments.length }} сообщений)
            </span>
          </div>
          <div class="fst-proto-arguments">
            <div v-for="arg in selectedSession.protocol.arguments" :key="arg.id" class="fst-proto-arg">
              <div class="fst-proto-arg-header">
                <span class="fst-proto-arg-emoji">{{ getAgentEmoji(arg.agentId) }}</span>
                <span class="fst-proto-arg-agent">{{ getAgentName(arg.agentId) }}</span>
                <span class="fst-proto-arg-type">{{ argTypeLabel(arg.type) }}</span>
                <span class="fst-proto-arg-dim">{{ arg.dimension }}</span>
              </div>
              <div class="fst-proto-arg-text">{{ arg.text }}</div>
            </div>
          </div>
        </div>

        <!-- Policy Settings -->
        <div v-if="selectedSession.protocol.policy" class="fst-proto-detail-section">
          <div class="fst-proto-detail-title">Параметры оценки ФСТ</div>
          <div class="fst-proto-policy">
            <div v-for="(val, key) in selectedSession.protocol.policy" :key="key" class="fst-proto-policy-item">
              <span class="fst-proto-policy-key">{{ formatPolicyKey(key) }}</span>
              <span class="fst-proto-policy-val">{{ formatPolicyValue(key, val) }}</span>
            </div>
          </div>
        </div>

      </div>
    </Dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { agents as agentsList, loadAgents } from '@/components/fst-committee/agentProvider.js'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { getCommitteeSessions } from '@/services/fstApi'

const router = useRouter()
const toast = useToast()

// ── State ─────────────────────────────────────────────────────────

const sessions = ref([])
const loading = ref(false)
const detailVisible = ref(false)
const selectedSession = ref(null)
const filterDecision = ref(null)
const searchQuery = ref('')

// ── Options ───────────────────────────────────────────────────────

const decisionOptions = [
  { label: 'Все решения', value: null },
  { label: 'Одобрено', value: 'APPROVE' },
  { label: 'Отклонено', value: 'REJECT' },
  { label: 'На доработку', value: 'DEFER' }
]

// Agent metadata from DB (reactive)
const AGENTS_MAP = computed(() => {
  const map = {}
  for (const a of agentsList.value) {
    map[a.id] = { name: a.shortName || a.name, emoji: a.avatar || '🤖' }
  }
  return map
})

// ── Computed ──────────────────────────────────────────────────────

const filteredSessions = computed(() => {
  let result = sessions.value

  // Filter by decision
  if (filterDecision.value) {
    result = result.filter(s => s.protocol?.decision?.recommendation === filterDecision.value)
  }

  // Filter by search query
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.protocol?.decision?.projectName?.toLowerCase().includes(q)
    )
  }

  // Sort by date (newest first)
  return result.sort((a, b) => new Date(b.meetingDate) - new Date(a.meetingDate))
})

// ── Methods ───────────────────────────────────────────────────────

async function loadSessions() {
  loading.value = true
  try {
    sessions.value = await getCommitteeSessions()
  } catch (err) {
    console.error('Failed to load committee sessions:', err)
    toast.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось загрузить протоколы', life: 3000 })
  } finally {
    loading.value = false
  }
}

function selectSession(session) {
  selectedSession.value = session
  detailVisible.value = true
}

function scoreColor(score) {
  if (!score) return '#666'
  if (score >= 72) return '#4caf50'
  if (score >= 50) return '#ffa726'
  return '#ef5350'
}

function decisionLabel(decision) {
  const labels = {
    'APPROVE': 'Одобрено',
    'APPROVE_CONDITIONAL': 'Одобрено с условиями',
    'REJECT': 'Отклонено',
    'DEFER': 'На доработку'
  }
  return labels[decision] || decision
}

function decisionColor(decision) {
  const colors = {
    'APPROVE': '#4caf50',
    'APPROVE_CONDITIONAL': '#66bb6a',
    'REJECT': '#ef5350',
    'DEFER': '#ffa726'
  }
  return colors[decision] || '#666'
}

function decisionSeverity(decision) {
  const severity = {
    'APPROVE': 'success',
    'APPROVE_CONDITIONAL': 'success',
    'REJECT': 'danger',
    'DEFER': 'warn'
  }
  return severity[decision] || 'secondary'
}

function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('ru', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getAgentEmoji(agentId) {
  return AGENTS_MAP.value[agentId]?.emoji || '🤖'
}

function getAgentName(agentId) {
  return AGENTS_MAP.value[agentId]?.name || agentId
}

function argTypeLabel(type) {
  const labels = {
    'OPENING': 'Позиция',
    'CHALLENGE': 'Вызов',
    'COUNTER': 'Контр',
    'SUMMARY': 'Итог'
  }
  return labels[type] || type
}

function formatPolicyKey(key) {
  const labels = {
    minTRL: 'Мин. TRL',
    minMRL: 'Мин. MRL',
    minSovereignty: 'Мин. суверенность',
    wacc: 'WACC',
    minIRR: 'Мин. IRR',
    maxDilution: 'Макс. размывание'
  }
  return labels[key] || key
}

function formatPolicyValue(key, val) {
  if (val == null) return '—'
  if (key === 'minTRL' || key === 'minMRL' || key === 'minSovereignty') return val.toString()
  return (val * 100).toFixed(0) + '%'
}

// ── Lifecycle ─────────────────────────────────────────────────────

onMounted(() => {
  loadAgents()
  loadSessions()
})
</script>

<style scoped>
/* ── Root ─────────────────────────────────────────────────────── */
.fst-protocol {
  min-height: 100vh;
  background: var(--surface-ground);
  padding: 20px;
}

/* ── Header ───────────────────────────────────────────────────── */
.fst-proto-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--surface-border);
}

.fst-proto-header-left {
  flex: 1;
}

.fst-proto-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 500;
  color: var(--p-text-color);
  margin-bottom: 6px;
}

.fst-proto-subtitle {
  font-size: 13px;
  color: var(--p-text-muted-color);
  margin-left: 32px;
}

.fst-proto-header-right {
  display: flex;
  gap: 8px;
}

/* ── Filters ──────────────────────────────────────────────────── */
.fst-proto-filters {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.fst-filter-sel {
  width: 180px;
}

.fst-search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
}

.fst-search {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  width: 240px;
}

/* ── Body ─────────────────────────────────────────────────────── */
.fst-proto-body {
  min-height: 400px;
}

.fst-proto-loading,
.fst-proto-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 16px;
  color: var(--p-text-muted-color);
}

/* ── Sessions ─────────────────────────────────────────────────── */
.fst-proto-sessions {
  display: grid;
  gap: 16px;
}

.fst-proto-session-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.fst-proto-session-card:hover {
  border-color: #ffa726;
  box-shadow: 0 2px 8px rgba(255, 167, 38, 0.2);
}

.fst-proto-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.fst-proto-card-project {
  font-size: 16px;
  font-weight: 600;
  color: var(--p-text-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.fst-proto-card-badges {
  display: flex;
  gap: 12px;
  align-items: center;
}

.fst-proto-score {
  font-size: 20px;
  font-weight: 700;
}

.fst-proto-card-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--p-text-muted-color);
  margin-bottom: 12px;
}

.fst-proto-meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fst-proto-card-conditions {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #ffa726;
  background: rgba(255, 167, 38, 0.1);
  padding: 6px 10px;
  border-radius: 4px;
}

/* ── Detail Dialog ────────────────────────────────────────────── */
.fst-proto-detail {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-height: 70vh;
  overflow-y: auto;
}

.fst-proto-detail-section {
  background: var(--surface-card);
  border-radius: 8px;
  padding: 16px;
}

.fst-proto-detail-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 12px;
  border-bottom: 1px solid var(--surface-border);
  padding-bottom: 8px;
}

.fst-proto-decision-summary {
  display: flex;
  gap: 24px;
  align-items: center;
}

.fst-proto-decision-score {
  text-align: center;
}

.fst-proto-score-big {
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
}

.fst-proto-score-label {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-top: 4px;
}

.fst-proto-decision-verdict {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fst-proto-human-approval {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--p-text-muted-color);
}

.fst-proto-human-comment {
  font-style: italic;
  margin-left: 8px;
}

/* ── Votes ────────────────────────────────────────────────────── */
.fst-proto-votes {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fst-proto-vote {
  display: grid;
  grid-template-columns: 1fr auto auto 1fr;
  gap: 16px;
  align-items: center;
  background: var(--surface-card);
  padding: 12px;
  border-radius: 6px;
}

.fst-proto-vote-agent {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.fst-proto-vote-emoji {
  font-size: 20px;
}

.fst-proto-vote-score {
  font-size: 16px;
  font-weight: 600;
  color: var(--p-text-color);
}

.fst-proto-vote-conf {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fst-proto-conf-bar-bg {
  width: 100px;
  height: 6px;
  background: var(--surface-card);
  border-radius: 3px;
  overflow: hidden;
}

.fst-proto-conf-bar {
  height: 100%;
  background: #42a5f5;
  transition: width 0.3s;
}

.fst-proto-conf-val {
  font-size: 12px;
  color: var(--p-text-muted-color);
  min-width: 40px;
}

/* ── Lists ────────────────────────────────────────────────────── */
.fst-proto-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fst-proto-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  color: var(--p-text-color);
}

/* ── Arguments ────────────────────────────────────────────────── */
.fst-proto-arguments {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.fst-proto-arg {
  background: var(--surface-card);
  border-left: 3px solid #42a5f5;
  border-radius: 4px;
  padding: 10px 12px;
}

.fst-proto-arg-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
}

.fst-proto-arg-emoji {
  font-size: 16px;
}

.fst-proto-arg-agent {
  font-weight: 600;
  color: var(--p-text-color);
}

.fst-proto-arg-type {
  background: var(--surface-card);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  color: var(--p-text-muted-color);
}

.fst-proto-arg-dim {
  color: var(--p-text-muted-color);
  font-size: 11px;
}

.fst-proto-arg-text {
  font-size: 14px;
  color: var(--p-text-color);
  line-height: 1.5;
}

/* ── Policy ───────────────────────────────────────────────────── */
.fst-proto-policy {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.fst-proto-policy-item {
  background: var(--surface-card);
  padding: 10px 12px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.fst-proto-policy-key {
  font-size: 13px;
  color: var(--p-text-muted-color);
}

.fst-proto-policy-val {
  font-size: 14px;
  font-weight: 600;
  color: var(--p-text-color);
}
</style>
