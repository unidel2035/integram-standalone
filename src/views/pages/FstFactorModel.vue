<template>
  <FstPageLayout
    title="Факторная модель"
    subtitle="T·S·M·G·E — Aladdin для ФСТ НТИ"
    icon="pi pi-chart-bar"
  >
    <template #actions>
      <Button label="Рассчитать" icon="pi pi-play" size="small" severity="success"
        @click="runScore" :loading="scoring" />
      <Button label="Стресс-тест" icon="pi pi-bolt" size="small" severity="secondary"
        @click="runStress" :loading="stressing" :disabled="!result" />
      <Button label="Портфель" icon="pi pi-chart-pie" size="small" severity="secondary"
        @click="showPortfolio = !showPortfolio" />
      <Button v-if="result" label="На ИК →" icon="pi pi-users" size="small" severity="primary"
        @click="sendToCommittee" />
    </template>

    <!-- Metrics strip -->
    <div class="fm-metrics fst-metrics-strip" v-if="result">
      <div class="fst-metric-item">
        <i class="pi pi-star fst-metric-item-icon"></i>
        <div class="fst-metric-item-val" :style="{ color: gradeColor(result.grade) }">{{ result.grade }}</div>
        <div class="fst-metric-item-label">Рейтинг</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-chart-bar fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ result.composite?.toFixed(2) }}/10</div>
        <div class="fst-metric-item-label">Composite Score</div>
      </div>
      <div class="fst-metric-item" v-for="(f, key) in result.factors" :key="key">
        <i class="pi pi-circle-fill fst-metric-item-icon"></i>
        <div class="fst-metric-item-val" :style="{ color: scoreColor(f.score) }">{{ f.score?.toFixed(1) }}</div>
        <div class="fst-metric-item-label">{{ key }}</div>
      </div>
    </div>
    <div class="fm-metrics fst-metrics-strip" v-else>
      <div class="fst-metric-item" v-for="k in ['T','S','M','G','E','Total']" :key="k">
        <i class="pi pi-circle fst-metric-item-icon"></i>
        <div class="fst-metric-item-val" style="color:var(--p-text-muted-color)">—</div>
        <div class="fst-metric-item-label">{{ k }}</div>
      </div>
    </div>

    <div class="fm-body">

      <!-- LEFT: Input form -->
      <div class="fm-col fm-col--input">
        <div class="fm-panel">
          <div class="fm-panel-title">
            <i class="pi pi-building" style="color:var(--fst-blue)"></i> Параметры сделки
          </div>

          <div class="fm-field">
            <label>Компания</label>
            <InputText v-model="deal.companyName" placeholder="ООО «АвиаЛогик»" fluid />
          </div>
          <div class="fm-field">
            <label>Описание (для AI-оценки отсутствующих факторов)</label>
            <Textarea v-model="deal.description" rows="3" fluid
              placeholder="Беспилотники для логистики, российские компоненты, TRL 6..." />
          </div>

          <div class="fm-row">
            <div class="fm-field">
              <label>TRL (1–9)</label>
              <InputNumber v-model="deal.trl" :min="1" :max="9" fluid />
            </div>
            <div class="fm-field">
              <label>Рост TRL за год</label>
              <InputNumber v-model="deal.trlGrowth" :min="0" :max="5" fluid />
            </div>
          </div>

          <div class="fm-field">
            <label>Суверенность (% российских компонентов)</label>
            <div class="fm-slider-row">
              <Slider v-model="deal.sovereignPercent" :min="0" :max="100" style="flex:1" />
              <span class="fm-slider-val">{{ deal.sovereignPercent }}%</span>
            </div>
          </div>

          <div class="fm-row">
            <div class="fm-field">
              <label>Инвестиции всего (млн ₽)</label>
              <InputNumber v-model="deal.totalInvestment" :min="0" fluid />
            </div>
            <div class="fm-field">
              <label>Доля ФСТ (млн ₽)</label>
              <InputNumber v-model="deal.fstInvestment" :min="0" fluid />
            </div>
          </div>

          <div class="fm-field">
            <label>GR-покрытие (доля цепочки с государством)</label>
            <div class="fm-slider-row">
              <Slider v-model="deal.grChainCoverage" :min="0" :max="1" :step="0.05" style="flex:1" />
              <span class="fm-slider-val">{{ Math.round(deal.grChainCoverage * 100) }}%</span>
            </div>
          </div>

          <div class="fm-field">
            <label>Экспортный потенциал</label>
            <Select v-model="deal.exportPotential" :options="exportOptions"
              optionLabel="label" optionValue="value" fluid />
          </div>

          <Button label="Рассчитать факторы" icon="pi pi-play" :loading="scoring"
            @click="runScore" fluid severity="success" style="margin-top:8px" />
        </div>

        <!-- Multiplier hint -->
        <div class="fm-panel fm-panel--hint" v-if="deal.totalInvestment && deal.fstInvestment">
          <div class="fm-hint-row">
            <span>Мультипликатор</span>
            <strong :style="{ color: multiplierColor }">
              1 : {{ multiplier.toFixed(1) }}
            </strong>
          </div>
          <div class="fm-hint-row">
            <span>Целевой ФСТ</span>
            <strong>≥ 1 : 3</strong>
          </div>
          <div class="fm-hint-badge" :style="{ background: multiplierBg }">
            {{ multiplier >= 3 ? '✓ Соответствует стандарту ФСТ' : '⚠ Ниже целевого мультипликатора ФСТ' }}
          </div>
        </div>
      </div>

      <!-- CENTER: Radar + score breakdown -->
      <div class="fm-col fm-col--radar">
        <div class="fm-panel">
          <div class="fm-panel-title">
            <i class="pi pi-chart-bar" style="color:var(--fst-purple)"></i> Radar T·S·M·G·E
          </div>

          <div v-if="!result && !scoring" class="fm-empty">
            <i class="pi pi-chart-bar" style="font-size:40px;color:var(--p-text-muted-color)"></i>
            <div>Заполните параметры и нажмите «Рассчитать»</div>
          </div>

          <div v-else-if="scoring" class="fm-loading">
            <ProgressSpinner style="width:40px;height:40px" />
            <div>AI рассчитывает факторы...</div>
          </div>

          <template v-else-if="result">
            <FactorRadar
              :factors="result.factors"
              :composite="result.composite"
              :grade="result.grade"
            />

            <!-- Recommendation -->
            <div class="fm-recommendation" :class="`fm-rec--${recClass}`">
              <i :class="recIcon"></i>
              <div>
                <div class="fm-rec-title">{{ recLabel }}</div>
                <div class="fm-rec-sub">Composite: {{ result.composite?.toFixed(2) }} / Grade: {{ result.grade }}</div>
              </div>
            </div>

            <!-- Red flags -->
            <div v-if="result.redFlags?.length" class="fm-flags">
              <div class="fm-flags-title">Красные флаги</div>
              <div v-for="f in result.redFlags" :key="f" class="fm-flag">
                <i class="pi pi-exclamation-triangle" style="color:var(--fst-red);font-size:11px"></i>
                {{ f }}
              </div>
            </div>

            <!-- Strengths -->
            <div v-if="result.strengths?.length" class="fm-strengths">
              <div class="fm-strengths-title">Сильные стороны</div>
              <div v-for="s in result.strengths" :key="s" class="fm-strength">
                <i class="pi pi-check" style="color:var(--fst-green);font-size:11px"></i>
                {{ s }}
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- RIGHT: Factor breakdown + Stress test -->
      <div class="fm-col fm-col--detail">

        <!-- Factor detail -->
        <div class="fm-panel" v-if="result">
          <div class="fm-panel-title">
            <i class="pi pi-list" style="color:var(--fst-blue)"></i> Детализация факторов
          </div>
          <div class="fm-factor-list">
            <div v-for="(f, key) in result.factors" :key="key" class="fm-factor-item">
              <div class="fm-factor-header">
                <span class="fm-factor-key">{{ key }}</span>
                <span class="fm-factor-name">{{ f.label }}</span>
                <span class="fm-factor-score" :style="{ color: scoreColor(f.score) }">
                  {{ f.score?.toFixed(1) }}/10
                </span>
              </div>
              <div class="fm-factor-bar">
                <div class="fm-factor-fill" :style="{
                  width: `${(f.score/10)*100}%`,
                  background: scoreColor(f.score)
                }"></div>
              </div>
              <div v-if="f.reasoning" class="fm-factor-reason">{{ f.reasoning }}</div>
            </div>
          </div>

          <div class="fm-weights">
            <div class="fm-weights-title">Веса факторов</div>
            <div class="fm-weights-row" v-for="(w, k) in weights" :key="k">
              <span>{{ k }}</span>
              <div class="fm-weight-bar">
                <div class="fm-weight-fill" :style="{ width: `${w*100}%` }"></div>
              </div>
              <span>{{ Math.round(w*100) }}%</span>
            </div>
          </div>
        </div>

        <!-- Stress test results -->
        <div class="fm-panel" v-if="stressResult">
          <div class="fm-panel-title">
            <i class="pi pi-bolt" style="color:var(--fst-brand)"></i> Стресс-тест (5 сценариев)
          </div>
          <div class="fm-stress-summary">
            Худший сценарий: <strong>{{ stressResult.summary.worstLabel }}</strong><br>
            Composite → <span :style="{ color: scoreColor(stressResult.summary.worstCompositeAfter) }">
              {{ stressResult.summary.worstCompositeAfter?.toFixed(2) }}
            </span>
            (Δ {{ stressResult.summary.worstDelta?.toFixed(2) }})
          </div>
          <div class="fm-stress-list">
            <div v-for="s in stressResult.scenarios" :key="s.scenarioId" class="fm-stress-row"
              :class="{ 'fm-stress-row--critical': s.gradeDegraded }">
              <div class="fm-stress-label">{{ s.label }}</div>
              <div class="fm-stress-scores">
                <span class="fm-stress-base">{{ s.baseComposite?.toFixed(1) }}</span>
                <i class="pi pi-arrow-right" style="font-size:10px;color:var(--p-text-muted-color)"></i>
                <span class="fm-stress-after" :style="{ color: scoreColor(s.stressedComposite) }">
                  {{ s.stressedComposite?.toFixed(1) }}
                </span>
                <span class="fm-stress-delta" :style="{ color: s.compositeDelta < 0 ? 'var(--fst-red)' : 'var(--fst-green)' }">
                  {{ s.compositeDelta > 0 ? '+' : '' }}{{ s.compositeDelta?.toFixed(2) }}
                </span>
                <Tag v-if="s.gradeDegraded" value="Деградация" severity="danger" style="font-size:9px;padding:1px 4px" />
              </div>
            </div>
          </div>
          <Button label="Обновить стресс-тест" icon="pi pi-refresh" size="small" severity="secondary" text
            @click="runStress" :loading="stressing" style="margin-top:8px;width:100%" />
        </div>

        <div class="fm-panel" v-else-if="result">
          <div class="fm-panel-title">
            <i class="pi pi-bolt" style="color:var(--fst-brand)"></i> Стресс-тест
          </div>
          <div class="fm-empty" style="padding:20px">
            <div>Запустите стресс-тест чтобы увидеть поведение сделки при 5 сценариях</div>
            <Button label="Запустить" icon="pi pi-bolt" size="small" severity="secondary"
              @click="runStress" :loading="stressing" style="margin-top:8px" />
          </div>
        </div>

        <!-- Portfolio impact -->
        <div class="fm-panel" v-if="showPortfolio && portfolioImpact">
          <div class="fm-panel-title">
            <i class="pi pi-chart-pie" style="color:var(--fst-cyan)"></i> Влияние на портфель
          </div>
          <div class="fm-impact-row" v-for="(d, k) in portfolioImpact.delta" :key="k">
            <span class="fm-impact-key">{{ k }}</span>
            <span class="fm-impact-delta"
              :style="{ color: d > 0 ? 'var(--fst-green)' : d < 0 ? 'var(--fst-red)' : 'var(--p-text-muted-color)' }">
              {{ d > 0 ? '+' : '' }}{{ typeof d === 'number' ? d.toFixed(2) : d }}
            </span>
          </div>
          <div v-if="portfolioImpact.warnings?.length" style="margin-top:8px">
            <div v-for="w in portfolioImpact.warnings" :key="w" class="fm-flag">
              <i class="pi pi-exclamation-triangle" style="color:var(--fst-brand);font-size:11px"></i>
              {{ w }}
            </div>
          </div>
          <div v-if="portfolioImpact.improvements?.length" style="margin-top:6px">
            <div v-for="s in portfolioImpact.improvements" :key="s" class="fm-strength">
              <i class="pi pi-check" style="color:var(--fst-green);font-size:11px"></i>
              {{ s }}
            </div>
          </div>
        </div>

      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import FactorRadar from '@/components/fst-factor/FactorRadar.vue'
import Button from 'primevue/button'
import { useProjectStore } from '@/stores/projectStore.js'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Slider from 'primevue/slider'
import Select from 'primevue/select'
import ProgressSpinner from 'primevue/progressspinner'
import Tag from 'primevue/tag'

const router    = useRouter()
const projStore = useProjectStore()

// ── State ────────────────────────────────────────────────────────────────────
const scoring   = ref(false)
const stressing = ref(false)
const result    = ref(null)
const stressResult = ref(null)
const weights   = ref({ T: 0.25, S: 0.35, M: 0.20, G: 0.10, E: 0.10 })
const showPortfolio = ref(false)
const portfolioImpact = ref(null)

const deal = ref({
  companyName:      '',
  description:      '',
  trl:              5,
  trlGrowth:        1,
  sovereignPercent: 60,
  totalInvestment:  150,
  fstInvestment:    50,
  grChainCoverage:  0.5,
  exportPotential:  'medium',
})

const exportOptions = [
  { label: 'Высокий (БРИКС+)', value: 'high' },
  { label: 'Средний',          value: 'medium' },
  { label: 'Низкий',           value: 'low' },
  { label: 'Нет',              value: 'none' },
]

// ── Demo portfolio (for impact calc) ─────────────────────────────────────────
const demoPortfolio = [
  { dealId: 'deal-001', sector: 'БАС', weight: 50, factors: { T: { score: 7 }, S: { score: 8 }, M: { score: 6 }, G: { score: 5 }, E: { score: 5 } } },
  { dealId: 'deal-002', sector: 'РОБО', weight: 40, factors: { T: { score: 6 }, S: { score: 7 }, M: { score: 7 }, G: { score: 6 }, E: { score: 4 } } },
  { dealId: 'deal-003', sector: 'МЭ', weight: 30, factors: { T: { score: 8 }, S: { score: 9 }, M: { score: 5 }, G: { score: 7 }, E: { score: 6 } } },
]

// ── Computed ──────────────────────────────────────────────────────────────────
const multiplier = computed(() => {
  const total = deal.value.totalInvestment || 0
  const fst   = deal.value.fstInvestment   || 1
  return (total - fst) / fst
})

const multiplierColor = computed(() => multiplier.value >= 3 ? 'var(--fst-green)' : multiplier.value >= 1 ? 'var(--fst-brand)' : 'var(--fst-red)')
const multiplierBg    = computed(() => `color-mix(in srgb, ${multiplierColor.value} 15%, transparent)`)

const REC_MAP = {
  STRONG_INVEST:             { label: 'Одобрить — сильная сделка',        icon: 'pi pi-check-circle', cls: 'green' },
  INVEST:                    { label: 'Одобрить',                          icon: 'pi pi-check',        cls: 'green' },
  PROCEED_WITH_CONDITIONS:   { label: 'Одобрить с условиями',              icon: 'pi pi-info-circle',  cls: 'brand' },
  HOLD_FOR_REVISION:         { label: 'Доработать и переоценить',          icon: 'pi pi-clock',        cls: 'brand' },
  REJECT:                    { label: 'Отклонить',                         icon: 'pi pi-times-circle', cls: 'red'   },
}

const recLabel = computed(() => REC_MAP[result.value?.recommendation]?.label || result.value?.recommendation || '')
const recIcon  = computed(() => REC_MAP[result.value?.recommendation]?.icon  || 'pi pi-circle')
const recClass = computed(() => REC_MAP[result.value?.recommendation]?.cls   || 'brand')

// ── Actions ───────────────────────────────────────────────────────────────────
async function runScore() {
  scoring.value = true
  stressResult.value = null
  portfolioImpact.value = null
  try {
    const r = await fetch('/api/factor/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal: deal.value }),
    })
    if (r.ok) result.value = await r.json()

    // Auto-fetch portfolio impact
    if (result.value) await runPortfolioImpact()
  } finally {
    scoring.value = false
  }
}

async function runStress() {
  if (!result.value) return
  stressing.value = true
  try {
    const r = await fetch('/api/factor/stress-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal: deal.value }),
    })
    if (r.ok) stressResult.value = await r.json()
  } finally {
    stressing.value = false
  }
}

async function runPortfolioImpact() {
  if (!result.value) return
  try {
    const r = await fetch('/api/factor/portfolio-impact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newDeal: { ...deal.value, factors: result.value.factors },
        portfolio: demoPortfolio,
      }),
    })
    if (r.ok) portfolioImpact.value = await r.json()
  } catch { /* silent */ }
}

onMounted(async () => {
  // Если пришли с другой страницы с контекстом — предзаполняем форму
  const ap = projStore.activeProject
  if (ap) {
    if (ap.company || ap.name)  deal.value.companyName      = ap.company || ap.name
    if (ap.trl)                 deal.value.trl              = ap.trl
    if (ap.sovereignty)         deal.value.sovereignPercent = ap.sovereignty * 11
    if (ap.subfund)             deal.value.sector           = ap.subfund
    if (ap.askMln)              deal.value.fstInvestment    = ap.askMln
    if (ap.description)         deal.value.description      = ap.description
  }

  // Load actual weights from backend (Integram DB)
  try {
    const r = await fetch('/api/factor/config')
    if (r.ok) {
      const cfg = await r.json()
      if (cfg.weights) weights.value = cfg.weights
    }
  } catch { /* use defaults */ }
})

function sendToCommittee() {
  projStore.setActive({
    ...(projStore.activeProject || {}),
    company:     deal.value.companyName,
    name:        deal.value.companyName,
    trl:         deal.value.trl,
    subfund:     deal.value.sector || deal.value.subfund,
    askMln:      deal.value.fstInvestment,
    description: deal.value.description,
    _factorResult: result.value,
    _source:     'factor',
  })
  router.push('/fst-committee')
}

// ── Color helpers ─────────────────────────────────────────────────────────────
function scoreColor(s) {
  if (s === null || s === undefined) return 'var(--p-text-muted-color)'
  if (s >= 7) return 'var(--fst-green)'
  if (s >= 4) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}

const GRADE_COLORS = { 'A+': 'var(--fst-green)', 'A': 'var(--fst-green)', 'B+': 'var(--fst-brand)', 'B': 'var(--fst-brand)', 'C+': 'var(--fst-red)', 'C': 'var(--fst-red)', 'D': 'var(--fst-red)' }
function gradeColor(g) { return GRADE_COLORS[g] || 'var(--p-text-muted-color)' }
</script>

<style scoped>
.fm-body {
  display: grid;
  grid-template-columns: 300px 1fr 1fr;
  gap: 16px;
  padding: 16px 0 0;
}

.fm-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fm-panel {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 14px;
}

.fm-panel--hint {
  background: color-mix(in srgb, var(--fst-purple) 5%, transparent);
  border-color: color-mix(in srgb, var(--fst-purple) 30%, transparent);
}

.fm-panel-title {
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.fm-field {
  margin-bottom: 10px;
}
.fm-field label {
  display: block;
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}

.fm-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.fm-slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.fm-slider-val {
  font-size: 12px;
  font-weight: 700;
  min-width: 36px;
  text-align: right;
}

.fm-hint-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 3px 0;
}
.fm-hint-badge {
  margin-top: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  text-align: center;
}

.fm-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 30px;
  color: var(--p-text-muted-color);
  font-size: 13px;
  text-align: center;
}

.fm-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 30px;
  font-size: 13px;
  color: var(--p-text-muted-color);
}

.fm-recommendation {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
}
.fm-recommendation i { font-size: 18px; }
.fm-rec-title { font-weight: 600; }
.fm-rec-sub   { font-size: 11px; color: var(--p-text-muted-color); }
.fm-rec--green  { background: color-mix(in srgb, var(--fst-green) 12%, transparent); }
.fm-rec--brand  { background: color-mix(in srgb, var(--fst-brand) 12%, transparent); }
.fm-rec--red    { background: color-mix(in srgb, var(--fst-red)   12%, transparent); }

.fm-flags, .fm-strengths {
  margin-top: 10px;
}
.fm-flags-title, .fm-strengths-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}
.fm-flag, .fm-strength {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 11px;
  color: var(--p-text-muted-color);
  padding: 2px 0;
}

/* Factor detail */
.fm-factor-list { display: flex; flex-direction: column; gap: 10px; }
.fm-factor-item {}
.fm-factor-header {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 3px;
}
.fm-factor-key {
  font-weight: 800;
  font-size: 13px;
  min-width: 16px;
}
.fm-factor-name {
  flex: 1;
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.fm-factor-score {
  font-size: 13px;
  font-weight: 700;
}
.fm-factor-bar {
  height: 4px;
  background: var(--p-content-border-color);
  border-radius: 2px;
  overflow: hidden;
}
.fm-factor-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s;
}
.fm-factor-reason {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-top: 3px;
  line-height: 1.4;
}

.fm-weights {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--p-content-border-color);
}
.fm-weights-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
}
.fm-weights-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  margin-bottom: 4px;
}
.fm-weights-row span:first-child {
  min-width: 16px;
  font-weight: 700;
}
.fm-weight-bar {
  flex: 1;
  height: 4px;
  background: var(--p-content-border-color);
  border-radius: 2px;
  overflow: hidden;
}
.fm-weight-fill {
  height: 100%;
  background: var(--fst-purple);
  border-radius: 2px;
}
.fm-weights-row span:last-child {
  min-width: 28px;
  text-align: right;
  color: var(--p-text-muted-color);
}

/* Stress test */
.fm-stress-summary {
  font-size: 12px;
  padding: 8px;
  background: color-mix(in srgb, var(--fst-brand) 8%, transparent);
  border-radius: 4px;
  margin-bottom: 10px;
  line-height: 1.5;
}
.fm-stress-list { display: flex; flex-direction: column; gap: 6px; }
.fm-stress-row {
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--p-surface-ground);
  border: 1px solid transparent;
}
.fm-stress-row--critical {
  border-color: color-mix(in srgb, var(--fst-red) 30%, transparent);
}
.fm-stress-label { font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 3px; }
.fm-stress-scores {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
}
.fm-stress-base { color: var(--p-text-muted-color); }
.fm-stress-delta { font-size: 11px; margin-left: auto; }

/* Portfolio impact */
.fm-impact-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid var(--p-content-border-color);
  font-size: 12px;
}
.fm-impact-key { font-weight: 600; }
.fm-impact-delta { font-weight: 700; }

/* Metrics override */
.fm-metrics {
  margin: -20px -20px 0;
}
</style>
