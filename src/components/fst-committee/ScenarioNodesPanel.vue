<template>
  <div class="snp-root">
    <!-- Заголовок -->
    <div class="snp-header">
      <div class="snp-title-block">
        <i class="pi pi-sitemap" style="color:var(--p-primary-color)"></i>
        <span class="snp-title">Цифровой двойник контракта</span>
        <span class="snp-subtitle">Сценарии сделки — три ноды контракта</span>
      </div>
      <div class="snp-actions">
        <!-- Авто-режим: ноды пришли от движка -->
        <template v-if="autoMode">
          <span v-if="negotiating" class="snp-status-badge snp-status-negotiating">
            <i class="pi pi-spin pi-spinner"></i> Агенты согласуют ноды...
          </span>
          <span v-else-if="approved" class="snp-status-badge snp-status-approved">
            <i class="pi pi-check-circle"></i> Ноды утверждены единогласно · сохранено в БД
          </span>
        </template>
        <!-- Ручной режим -->
        <template v-else>
          <button class="snp-btn snp-btn-ai" :disabled="filling" @click="fillWithAI">
            <i :class="filling ? 'pi pi-spin pi-spinner' : 'pi pi-sparkles'"></i>
            {{ filling ? 'Агенты анализируют...' : 'AI-заполнение' }}
          </button>
          <button class="snp-btn snp-btn-save" :disabled="saving || saved" @click="saveToDB">
            <i :class="saving ? 'pi pi-spin pi-spinner' : saved ? 'pi pi-check-circle' : 'pi pi-database'"></i>
            {{ saving ? 'Сохраняется...' : saved ? `Сохранено #${savedId}` : 'Сохранить в БД' }}
          </button>
        </template>
      </div>
    </div>

    <!-- Ход переговоров агентов (авто-режим) -->
    <div v-if="autoMode && nodeProposals.length" class="snp-negotiation-log">
      <div class="snp-neg-title">Ход согласования нод ({{ nodeProposals.length }} предложений от агентов):</div>
      <div v-for="(p, i) in nodeProposals" :key="i" class="snp-neg-item">
        <span class="snp-neg-agent">{{ agentName(p.agentId) }}</span>
        <span class="snp-neg-round">R{{ p.round }}</span>
        <span class="snp-neg-params">
          IC {{ p.nodes?.base?.ic }}млн · WACC {{ p.nodes?.base?.wacc }}% · IRR≈{{ p.nodes?.base?.expectedIrr }}%
        </span>
      </div>
      <div v-if="nodeVotes.length" class="snp-neg-votes">
        <span v-for="v in uniqueNodeVotes" :key="v.agentId"
          class="snp-vote-chip" :class="v.verdict === 'ACCEPT' ? 'vote-accept' : 'vote-reject'">
          {{ agentName(v.agentId) }}: {{ v.verdict === 'ACCEPT' ? '✓' : '✗' }}
        </span>
      </div>
    </div>

    <!-- Сетка сценариев -->
    <div class="snp-grid">

      <!-- Левая колонка — метки строк -->
      <div class="snp-labels-col">
        <div class="snp-col-header snp-col-header-labels">Параметр</div>

        <!-- Требования -->
        <template v-if="requirements.length">
          <div class="snp-section-label">Условия / пороги</div>
          <div v-for="req in requirements" :key="req.id" class="snp-row-label">
            <span class="snp-req-name" :title="req.name">{{ req.name }}</span>
            <span class="snp-req-unit" v-if="req.unit">{{ req.unit }}</span>
            <span class="snp-req-prio" :class="`prio-${(req.priority || '').toLowerCase()}`">
              {{ req.priority }}
            </span>
          </div>
        </template>

        <!-- Финансовые входы -->
        <div class="snp-section-label">Финансовые параметры</div>
        <div class="snp-row-label">IC, млн ₽</div>
        <div class="snp-row-label">WACC, %</div>
        <div class="snp-row-label">Горизонт, лет</div>
        <div v-for="i in maxHorizon" :key="`lbl_cf${i}`" class="snp-row-label snp-cf-row-label">CF Год {{ i }}</div>

        <!-- Метрики -->
        <div class="snp-section-label">Результаты</div>
        <div class="snp-row-label snp-metric-row">NPV, млн ₽</div>
        <div class="snp-row-label snp-metric-row">IRR, %</div>
        <div class="snp-row-label snp-metric-row">ROI, %</div>
        <div class="snp-row-label snp-metric-row">DPP, лет</div>
        <div class="snp-row-label snp-metric-row">PI</div>
        <div class="snp-row-label">Вероятность, %</div>
        <div class="snp-row-label snp-gate-row-label">Вердикт</div>
      </div>

      <!-- Сценарий-колонки -->
      <div
        v-for="sc in scenarios"
        :key="sc.id"
        class="snp-scenario-col"
      >
        <div class="snp-col-header" :style="{ borderBottomColor: sc.color }">
          <span class="snp-sc-badge" :style="{ background: sc.color }">{{ sc.label }}</span>
          <span class="snp-sc-mult">×{{ sc.mult }}</span>
        </div>

        <!-- Пороговые значения требований -->
        <template v-if="requirements.length">
          <div class="snp-section-spacer"></div>
          <div v-for="req in requirements" :key="req.id" class="snp-cell">
            <input
              v-model="reqValues[sc.id][req.id]"
              class="snp-cell-input"
              :placeholder="req.threshold != null ? String(req.threshold) : '—'"
              @change="markDirty"
            />
          </div>
        </template>

        <!-- Финансовые входы -->
        <div class="snp-section-spacer"></div>
        <div class="snp-cell">
          <input v-model.number="sc.params.ic" type="number" step="10"
            class="snp-cell-input" @input="recalc(sc)" />
        </div>
        <div class="snp-cell">
          <input v-model.number="sc.params.wacc" type="number" step="0.5"
            class="snp-cell-input" @input="recalc(sc)" />
        </div>
        <div class="snp-cell">
          <input v-model.number="sc.params.n" type="number" min="1" max="10"
            class="snp-cell-input" @input="recalcN(sc)" />
        </div>
        <div v-for="i in maxHorizon" :key="`cf${i}_${sc.id}`" class="snp-cell">
          <input
            v-if="i <= sc.params.n"
            v-model.number="sc.params.cashflows[i - 1]"
            type="number" step="5"
            class="snp-cell-input"
            @input="recalc(sc)"
          />
          <span v-else class="snp-cell-na">—</span>
        </div>

        <!-- Расчётные метрики -->
        <div class="snp-section-spacer"></div>
        <div class="snp-cell snp-metric-cell" :class="sc.metrics.npv > 0 ? 'cell-ok' : 'cell-fail'">
          {{ fmt(sc.metrics.npv) }}
        </div>
        <div class="snp-cell snp-metric-cell" :class="sc.metrics.irr * 100 > sc.params.wacc ? 'cell-ok' : 'cell-fail'">
          {{ sc.metrics.irr != null ? (sc.metrics.irr * 100).toFixed(1) + '%' : '—' }}
        </div>
        <div class="snp-cell snp-metric-cell" :class="sc.metrics.roi > 0 ? 'cell-ok' : 'cell-warn'">
          {{ sc.metrics.roi != null ? sc.metrics.roi.toFixed(1) + '%' : '—' }}
        </div>
        <div class="snp-cell snp-metric-cell" :class="sc.metrics.dpp != null ? 'cell-ok' : 'cell-warn'">
          {{ sc.metrics.dpp ?? '> гор.' }}
        </div>
        <div class="snp-cell snp-metric-cell" :class="sc.metrics.pi > 1 ? 'cell-ok' : 'cell-fail'">
          {{ fmt(sc.metrics.pi) }}
        </div>

        <div class="snp-cell">
          <input v-model.number="sc.probability" type="number" min="0" max="100"
            class="snp-cell-input" style="width:55px" @input="markDirty" />
        </div>

        <div class="snp-gate-cell" :class="sc.metrics.npv > 0 ? 'gate-pass' : 'gate-fail'">
          {{ sc.metrics.npv > 0 ? '✓ Проходит' : '✗ Не проходит' }}
        </div>
      </div>
    </div>

    <!-- Ожидаемое NPV -->
    <div class="snp-ev-row">
      <span class="snp-ev-label">Ожидаемое NPV (взвешенное по вероятности)</span>
      <span class="snp-ev-value" :class="expectedNpv > 0 ? 'ev-positive' : 'ev-negative'">
        {{ fmt(expectedNpv) }} млн ₽
      </span>
    </div>

    <!-- Ошибка -->
    <div v-if="saveError" class="snp-error">
      <i class="pi pi-exclamation-triangle"></i> {{ saveError }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { authenticate } from '@/services/fstApi.js'

// ── ID типов и реквизитов Integram ────────────────────────────────────────────
const CONTRACT_TYPE_ID = 3995
const NODE_TYPE_ID     = 3996
const REQ_TYPE_ID      = 3999

const NODE_REQS = {
  scenario:    4008,
  ic:          4010,
  wacc:        4012,
  horizon:     4014,
  cf1:         4016,
  cf2:         4018,
  cf3:         4020,
  cf4:         4022,
  cf5:         4024,
  npv:         4026,
  irr:         4028,
  roi:         4030,
  dpp:         4032,
  pi:          4034,
  probability: 4036,
  status:      4038,
}
const REQ_REQS = {
  value:     4002,
  threshold: 4040,
  deadline:  4042,
  priority:  4044,
  status:    4046,
  agent:     4048,
}

// ── Props ─────────────────────────────────────────────────────────────────────
const props = defineProps({
  decision:      { type: Object,  default: null },
  project:       { type: Object,  default: () => ({}) },
  // Авто-режим: передаются от движка
  contractNodes: { type: Array,   default: null },   // финальные ноды от движка
  nodeProposals: { type: Array,   default: () => [] },
  nodeVotes:     { type: Array,   default: () => [] },
  negotiating:   { type: Boolean, default: false },  // идёт фаза NODE_NEGOTIATION/NODE_VOTING
  approved:      { type: Boolean, default: false },  // ноды утверждены
})

// Авто-режим: когда ноды пришли от движка
const autoMode = computed(() => props.contractNodes !== null)

const AGENT_NAMES = {
  tech: 'Техн.аналитик', finance: 'Фин.аналитик', sovereignty: 'Эксперт сувер.',
  risk: 'Риск-менеджер', portfolio: 'Стратег', devil: 'Критик',
}
function agentName(id) { return AGENT_NAMES[id] || id }

// Последний голос от каждого агента
const uniqueNodeVotes = computed(() => {
  const map = {}
  for (const v of props.nodeVotes) map[v.agentId] = v
  return Object.values(map)
})

// ── Требования из условий ConditionalDecision ─────────────────────────────────
const requirements = computed(() => {
  if (!props.decision?.conditions?.length) return []
  return props.decision.conditions.map((c, i) => ({
    id:        c.id || `cond_${i}`,
    name:      c.text || `Условие ${i + 1}`,
    unit:      c.metric || '',
    threshold: c.threshold ?? null,
    deadline:  c.deadline || '',
    priority:  c.priority || 'MEDIUM',
    agent:     c.proposedBy || '',
  }))
})

// ── Сценарии ──────────────────────────────────────────────────────────────────
const scenarios = ref([
  {
    id:          'pessimistic',
    label:       'Консервативный',
    mult:        0.6,
    color:       '#ef5350',
    probability: 25,
    params:      { ic: 120, wacc: 20, n: 5, cashflows: [5, 10, 20, 30, 30] },
    metrics:     { npv: 0, irr: null, roi: null, dpp: null, pi: 0 },
  },
  {
    id:          'base',
    label:       'Базовый',
    mult:        1.0,
    color:       '#42a5f5',
    probability: 50,
    params:      { ic: 100, wacc: 18, n: 5, cashflows: [10, 20, 40, 60, 60] },
    metrics:     { npv: 0, irr: null, roi: null, dpp: null, pi: 0 },
  },
  {
    id:          'optimistic',
    label:       'Оптимистичный',
    mult:        1.4,
    color:       '#66bb6a',
    probability: 25,
    params:      { ic: 80, wacc: 15, n: 5, cashflows: [15, 30, 60, 90, 100] },
    metrics:     { npv: 0, irr: null, roi: null, dpp: null, pi: 0 },
  },
])

// Если пришли ноды от движка — применяем их к сценариям
watch(() => props.contractNodes, (nodes) => {
  if (!nodes?.length) return
  for (const sc of scenarios.value) {
    const node = nodes.find(n => n.scenario === sc.id)
    if (!node) continue
    sc.params.ic = node.ic
    sc.params.wacc = node.wacc
    sc.params.n = node.n || node.cashflows?.length || 5
    sc.params.cashflows = [...(node.cashflows || [])]
    sc.probability = node.probability ?? sc.probability
    recalc(sc)
  }
}, { immediate: true })

// Подгружаем данные из decision.scenarios при наличии
watch(() => props.decision, (d) => {
  if (!d?.scenarios) return
  const KEY = { pessimistic: 'PESSIMISTIC', base: 'BASE', optimistic: 'OPTIMISTIC' }
  for (const sc of scenarios.value) {
    const ds = d.scenarios[KEY[sc.id]]
    if (!ds) continue
    const ic = ds.amount ? Math.round(ds.amount / 1_000_000) : sc.params.ic
    const irrHint = (ds.irr || 25) / 100
    sc.params.ic = ic
    sc.params.cashflows = sc.params.cashflows.map((_, i) =>
      Math.round(ic * irrHint * sc.mult * (i + 1) / sc.params.n * 10) / 10
    )
    if (ds.probability) sc.probability = Math.round(ds.probability * 100)
    recalc(sc)
  }
}, { immediate: true })

// ── Значения требований per-сценарий ──────────────────────────────────────────
const reqValues = ref({ pessimistic: {}, base: {}, optimistic: {} })

watch(requirements, (reqs) => {
  for (const scKey of ['pessimistic', 'base', 'optimistic']) {
    for (const req of reqs) {
      if (reqValues.value[scKey][req.id] === undefined) {
        reqValues.value[scKey][req.id] = req.threshold != null ? String(req.threshold) : ''
      }
    }
  }
}, { immediate: true })

// ── Финансовые расчёты ────────────────────────────────────────────────────────
const maxHorizon = computed(() => Math.max(...scenarios.value.map(s => s.params.n), 1))

function calcNpv(cf, ic, r) {
  return cf.reduce((acc, c, t) => acc + c / Math.pow(1 + r, t + 1), -ic)
}

function calcIrr(cf, ic) {
  let r = 0.1
  for (let i = 0; i < 200; i++) {
    const f  = calcNpv(cf, ic, r)
    const df = cf.reduce((acc, c, t) => acc - (t + 1) * c / Math.pow(1 + r, t + 2), 0)
    if (Math.abs(df) < 1e-12) break
    const rNew = r - f / df
    if (Math.abs(rNew - r) < 1e-6) { r = rNew; break }
    r = Math.max(rNew, -0.99)
  }
  return r
}

function calcDpp(cf, ic, r) {
  let cum = -ic
  for (let t = 0; t < cf.length; t++) {
    const disc = cf[t] / Math.pow(1 + r, t + 1)
    if (cum + disc >= 0) return +(t + 1 - cum / (disc || 1)).toFixed(1)
    cum += disc
  }
  return null
}

function recalc(sc) {
  const { ic, wacc, n, cashflows } = sc.params
  const cf  = cashflows.slice(0, n)
  const r   = wacc / 100
  const npv = calcNpv(cf, ic, r)
  const irr = calcIrr(cf, ic)
  const dpp = calcDpp(cf, ic, r)
  const roi = ((cf.reduce((a, b) => a + b, 0) - ic) / ic) * 100
  const pi  = (npv + ic) / ic
  sc.metrics = { npv, irr, roi, dpp, pi }
}

function recalcN(sc) {
  const n = sc.params.n
  while (sc.params.cashflows.length < n) sc.params.cashflows.push(0)
  sc.params.cashflows = sc.params.cashflows.slice(0, n)
  recalc(sc)
}

onMounted(() => scenarios.value.forEach(recalc))

// ── Ожидаемое NPV ─────────────────────────────────────────────────────────────
const expectedNpv = computed(() => {
  const sum = scenarios.value.reduce((s, sc) => s + sc.metrics.npv * (sc.probability / 100), 0)
  return +sum.toFixed(1)
})

function fmt(v) { return v == null ? '—' : v.toFixed(1) }

// ── Сохранение в Integram ─────────────────────────────────────────────────────
const saving    = ref(false)
const saved     = ref(false)
const savedId   = ref(null)
const saveError = ref('')
const dirty     = ref(false)

function markDirty() { dirty.value = true }

async function saveToDB() {
  saving.value = true
  saveError.value = ''
  try {
    const { token, xsrf } = await authenticate()
    const db = import.meta.env.VITE_FST_DB || 'fst-api'

    async function post(path, fields) {
      const body = new URLSearchParams()
      for (const [k, v] of Object.entries(fields)) {
        if (v != null && v !== '') body.set(k, String(v))
      }
      body.set('_xsrf', xsrf)
      const r = await fetch(`/${db}/${path}?JSON_KV`, {
        method: 'POST',
        headers: { 'X-Authorization': token, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      return r.json()
    }

    // 1. Создаём Смарт контракт
    const title = props.project?.title || 'Проект'
    const cData = await post(`_m_new/${CONTRACT_TYPE_ID}`, {
      [`t${CONTRACT_TYPE_ID}`]: `Смарт контракт — ${title}`,
    })
    const contractId = cData.obj || cData.id
    if (!contractId) throw new Error('Не удалось создать смарт контракт: ' + JSON.stringify(cData))

    // 2. Создаём Ноду для каждого сценария
    for (const sc of scenarios.value) {
      const { ic, wacc, n, cashflows } = sc.params
      const cf = cashflows.slice(0, n)
      const nData = await post(`_m_new/${NODE_TYPE_ID}`, {
        [`t${NODE_TYPE_ID}`]:           sc.label,
        [`t${NODE_REQS.scenario}`]:     sc.id,
        [`t${NODE_REQS.ic}`]:           ic,
        [`t${NODE_REQS.wacc}`]:         wacc,
        [`t${NODE_REQS.horizon}`]:      n,
        [`t${NODE_REQS.cf1}`]:          cf[0] ?? 0,
        [`t${NODE_REQS.cf2}`]:          cf[1] ?? 0,
        [`t${NODE_REQS.cf3}`]:          cf[2] ?? 0,
        [`t${NODE_REQS.cf4}`]:          cf[3] ?? 0,
        [`t${NODE_REQS.cf5}`]:          cf[4] ?? 0,
        [`t${NODE_REQS.npv}`]:          +(sc.metrics.npv ?? 0).toFixed(2),
        [`t${NODE_REQS.irr}`]:          sc.metrics.irr != null ? +(sc.metrics.irr * 100).toFixed(1) : 0,
        [`t${NODE_REQS.roi}`]:          sc.metrics.roi != null ? +sc.metrics.roi.toFixed(1) : 0,
        [`t${NODE_REQS.dpp}`]:          sc.metrics.dpp ?? 0,
        [`t${NODE_REQS.pi}`]:           +(sc.metrics.pi ?? 0).toFixed(2),
        [`t${NODE_REQS.probability}`]:  sc.probability,
        [`t${NODE_REQS.status}`]:       'draft',
        up: contractId,
      })
      const nodeId = nData.obj || nData.id
      if (!nodeId) continue

      // 3. Требования под нодой
      for (const req of requirements.value) {
        const val = reqValues.value[sc.id]?.[req.id] ?? ''
        await post(`_m_new/${REQ_TYPE_ID}`, {
          [`t${REQ_TYPE_ID}`]:          req.name,
          [`t${REQ_REQS.value}`]:       val,
          [`t${REQ_REQS.threshold}`]:   req.threshold ?? '',
          [`t${REQ_REQS.deadline}`]:    req.deadline,
          [`t${REQ_REQS.priority}`]:    req.priority,
          [`t${REQ_REQS.status}`]:      'PROPOSED',
          [`t${REQ_REQS.agent}`]:       req.agent,
          up: nodeId,
        })
      }
    }

    savedId.value = contractId
    saved.value = true
    dirty.value = false
  } catch (e) {
    saveError.value = e.message
    console.error('[ScenarioNodesPanel.saveToDB]', e)
  } finally {
    saving.value = false
  }
}

// ── AI-заполнение ─────────────────────────────────────────────────────────────
const filling = ref(false)

async function fillWithAI() {
  filling.value = true
  saveError.value = ''
  try {
    const conds = requirements.value.map(r =>
      `• ${r.name} [${r.priority}]${r.unit ? ', ед: ' + r.unit : ''}${r.threshold != null ? ', мин. порог: ' + r.threshold : ''}`
    ).join('\n')

    const projectCtx = props.project?.title
      ? `Проект: ${props.project.title}. Отрасль: ${props.project.industry || 'БПЛА/беспилотники'}.`
      : 'Венчурный проект в области БПЛА.'

    const prompt = `${projectCtx}

Условия инвесткомитета:
${conds || '(условия не определены)'}

Предложи численные параметры для трёх сценариев сделки.

Ответь ТОЛЬКО в JSON (без markdown):
{
  "pessimistic": { "ic": N, "wacc": N, "cf": [N,N,N,N,N], "thresholds": { "<имя_условия>": "<значение>" } },
  "base":        { "ic": N, "wacc": N, "cf": [N,N,N,N,N], "thresholds": { "<имя_условия>": "<значение>" } },
  "optimistic":  { "ic": N, "wacc": N, "cf": [N,N,N,N,N], "thresholds": { "<имя_условия>": "<значение>" } }
}`

    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId:      'deepseek/deepseek-chat',
        prompt,
        systemPrompt: 'Ты — аналитик венчурного фонда. Отвечай только в формате JSON без markdown-блоков.',
        application:  'ScenarioNodesPanel',
      }),
    })
    const { response } = await res.json()

    const m = response.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('Модель вернула неверный формат')
    const data = JSON.parse(m[0])

    for (const sc of scenarios.value) {
      const d = data[sc.id]
      if (!d) continue
      if (d.ic)   sc.params.ic   = d.ic
      if (d.wacc) sc.params.wacc = d.wacc
      if (Array.isArray(d.cf) && d.cf.length) {
        sc.params.n = d.cf.length
        sc.params.cashflows = [...d.cf]
      }
      if (d.thresholds) {
        for (const req of requirements.value) {
          const val = d.thresholds[req.name] ?? d.thresholds[req.id]
          if (val != null) reqValues.value[sc.id][req.id] = String(val)
        }
      }
      recalc(sc)
    }
    dirty.value = true
  } catch (e) {
    saveError.value = 'AI-заполнение: ' + e.message
    console.error('[ScenarioNodesPanel.fillWithAI]', e)
  } finally {
    filling.value = false
  }
}
</script>

<style scoped>
.snp-root {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-x: auto;
}

.snp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.snp-title-block {
  display: flex;
  align-items: center;
  gap: 8px;
}
.snp-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--p-text-color);
}
.snp-subtitle {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}
.snp-actions { display: flex; gap: 8px; align-items: center; }

.snp-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--surface-border);
  border-radius: 7px;
  padding: 5px 12px;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
}
.snp-btn:disabled { opacity: 0.5; cursor: default; }
.snp-btn-ai { background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color); }
.snp-btn-ai:hover:not(:disabled) { opacity: 0.85; }
.snp-btn-save { background: var(--surface-ground); color: var(--p-text-color); }
.snp-btn-save:hover:not(:disabled) { background: var(--surface-hover); }

/* Сетка */
.snp-grid { display: flex; gap: 0; min-width: 620px; }

.snp-labels-col {
  flex: 0 0 185px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--surface-border);
}

.snp-col-header {
  height: 48px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--surface-border);
  font-weight: 600;
  font-size: 0.8rem;
}
.snp-col-header-labels {
  justify-content: flex-start;
  padding-left: 4px;
  color: var(--p-text-muted-color);
}
.snp-sc-badge {
  border-radius: 5px;
  padding: 2px 7px;
  color: #fff;
  font-size: 0.73rem;
  font-weight: 600;
}
.snp-sc-mult { font-size: 0.68rem; color: var(--p-text-muted-color); }

.snp-section-label {
  font-size: 0.67rem;
  font-weight: 700;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 7px 4px 2px;
  border-top: 1px solid var(--surface-border);
  margin-top: 2px;
}
.snp-section-spacer {
  height: 28px;
  border-top: 1px solid var(--surface-border);
  margin-top: 2px;
}

.snp-row-label {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 0 4px;
  font-size: 0.78rem;
  color: var(--p-text-color);
  border-bottom: 1px solid var(--p-surface-50, rgba(0,0,0,0.04));
}
.snp-cf-row-label { color: var(--p-text-muted-color); font-size: 0.72rem; }
.snp-metric-row { font-weight: 600; }
.snp-gate-row-label { font-weight: 700; }
.snp-req-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.snp-req-unit { font-size: 0.67rem; color: var(--p-text-muted-color); }
.snp-req-prio {
  font-size: 0.6rem;
  border-radius: 3px;
  padding: 1px 4px;
  flex-shrink: 0;
}
.prio-blocker { background: #ef535022; color: #ef5350; }
.prio-high    { background: #ff702222; color: #ff7022; }
.prio-medium  { background: #42a5f522; color: #42a5f5; }
.prio-low     { background: #66bb6a22; color: #66bb6a; }

.snp-scenario-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--surface-border);
}
.snp-scenario-col:last-child { border-right: none; }

.snp-cell {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border-bottom: 1px solid var(--p-surface-50, rgba(0,0,0,0.04));
}
.snp-cell-input {
  background: var(--surface-ground);
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 3px 5px;
  color: var(--p-text-color);
  font-size: 0.77rem;
  width: 88%;
  text-align: center;
  outline: none;
  transition: border-color 0.15s;
}
.snp-cell-input:focus { border-color: var(--p-primary-color); }
.snp-cell-na { font-size: 0.7rem; color: var(--p-text-muted-color); }

.snp-metric-cell { font-weight: 700; font-size: 0.83rem; }
.cell-ok   { color: #66bb6a; }
.cell-fail { color: #ef5350; }
.cell-warn { color: #ffa726; }

.snp-gate-cell {
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.73rem;
  font-weight: 700;
  margin: 4px;
  border-radius: 6px;
}
.gate-pass { background: #66bb6a18; color: #66bb6a; border: 1px solid #66bb6a44; }
.gate-fail { background: #ef535018; color: #ef5350; border: 1px solid #ef535044; }

.snp-ev-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface-ground);
  border-radius: 8px;
  padding: 10px 16px;
  border: 1px solid var(--surface-border);
}
.snp-ev-label { font-size: 0.8rem; color: var(--p-text-muted-color); }
.snp-ev-value { font-size: 1.1rem; font-weight: 700; }
.ev-positive { color: #66bb6a; }
.ev-negative { color: #ef5350; }

.snp-error {
  font-size: 0.78rem;
  color: #ef5350;
  background: #ef535011;
  border: 1px solid #ef535033;
  border-radius: 6px;
  padding: 6px 10px;
  display: flex;
  gap: 6px;
  align-items: center;
}

/* Авто-режим */
.snp-status-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
  border-radius: 7px;
  padding: 4px 10px;
}
.snp-status-negotiating {
  background: #7e57c222;
  color: #7e57c2;
  border: 1px solid #7e57c244;
}
.snp-status-approved {
  background: #66bb6a22;
  color: #66bb6a;
  border: 1px solid #66bb6a44;
}

.snp-negotiation-log {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.snp-neg-title { font-weight: 700; color: var(--p-text-muted-color); margin-bottom: 4px; }
.snp-neg-item { display: flex; align-items: center; gap: 6px; color: var(--p-text-color); }
.snp-neg-agent { font-weight: 600; min-width: 110px; }
.snp-neg-round { background: var(--surface-border); border-radius: 4px; padding: 1px 5px; font-size: 0.68rem; color: var(--p-text-muted-color); }
.snp-neg-params { color: var(--p-text-muted-color); }
.snp-neg-votes { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--surface-border); }
.snp-vote-chip { font-size: 0.7rem; border-radius: 4px; padding: 2px 7px; }
.vote-accept { background: #66bb6a22; color: #66bb6a; }
.vote-reject { background: #ef535022; color: #ef5350; }
</style>
