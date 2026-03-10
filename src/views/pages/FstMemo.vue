<template>
  <FstPageLayout title="AI Инвест-меморандум" subtitle="Генерация профессионального инвестиционного меморандума за 60 секунд">
    <template #actions>
      <Button icon="pi pi-file-pdf" label="Экспорт PDF" size="small" severity="secondary" :disabled="!generated" @click="exportPdf" />
      <Button icon="pi pi-sparkles" :label="generating ? 'Генерация...' : 'Сгенерировать за 60 сек'" size="small" severity="success" :loading="generating" @click="generate" />
    </template>

    <!-- ─── Metrics strip ─── -->
    <div class="memo-metrics fst-metrics-strip">
      <div class="fst-metric-item">
        <i class="pi pi-microchip fst-metric-item-icon" :style="{ color: trlColor }"></i>
        <div class="fst-metric-item-val">{{ params.trl }}/9</div>
        <div class="fst-metric-item-label">TRL</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-shield fst-metric-item-icon" :style="{ color: sovColor }"></i>
        <div class="fst-metric-item-val">{{ params.sovereignty }}/9</div>
        <div class="fst-metric-item-label">Суверенность</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-chart-bar fst-metric-item-icon" style="color:var(--fst-blue)"></i>
        <div class="fst-metric-item-val">{{ params.marketSize }} млрд</div>
        <div class="fst-metric-item-label">Рынок TAM</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-wallet fst-metric-item-icon" :style="{ color: runwayColor }"></i>
        <div class="fst-metric-item-val">{{ params.runway }} мес</div>
        <div class="fst-metric-item-label">Runway</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-money-bill fst-metric-item-icon" style="color:var(--fst-green)"></i>
        <div class="fst-metric-item-val">{{ params.revenue }} млн</div>
        <div class="fst-metric-item-label">Выручка TTM</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-users fst-metric-item-icon" style="color:var(--fst-purple)"></i>
        <div class="fst-metric-item-val">{{ params.teamSize }} чел</div>
        <div class="fst-metric-item-label">Команда</div>
      </div>
    </div>

    <!-- ─── Форма параметров ─── -->
    <template v-if="!generated && !generating">
      <div class="fst-section-label" style="padding: 0 24px">ПАРАМЕТРЫ ПРОЕКТА</div>
      <div class="memo-form">
        <div class="memo-grid">
          <div class="memo-field"><label>Название компании</label><input v-model="params.company" type="text" placeholder="ООО АвиаТех" /></div>
          <div class="memo-field"><label>Отрасль / субфонд</label>
            <select v-model="params.subfund">
              <option>БАС — Беспилотные авиасистемы</option>
              <option>РОБО — Робототехника</option>
              <option>МЭ — Микроэлектроника</option>
            </select>
          </div>
          <div class="memo-field"><label>Запрашиваемые инвестиции, млн ₽</label><input v-model.number="params.amount" type="number" /></div>
          <div class="memo-field"><label>Тип финансирования</label>
            <select v-model="params.finType"><option>Equity</option><option>CLN</option><option>Грант</option></select>
          </div>
          <div class="memo-field"><label>TRL (1–9)</label><input v-model.number="params.trl" type="number" min="1" max="9" /></div>
          <div class="memo-field"><label>Суверенность (0–9)</label><input v-model.number="params.sovereignty" type="number" min="0" max="9" /></div>
          <div class="memo-field"><label>Объём рынка, млрд ₽</label><input v-model.number="params.marketSize" type="number" /></div>
          <div class="memo-field"><label>Выручка TTM, млн ₽</label><input v-model.number="params.revenue" type="number" /></div>
          <div class="memo-field"><label>Runway, мес</label><input v-model.number="params.runway" type="number" /></div>
          <div class="memo-field"><label>Команда (чел.)</label><input v-model.number="params.teamSize" type="number" /></div>
          <div class="memo-field memo-wide"><label>Краткое описание продукта</label><textarea v-model="params.description" rows="3" placeholder="Что делает компания, для кого, в чём уникальность..."></textarea></div>
          <div class="memo-field memo-wide"><label>Ключевые достижения</label><textarea v-model="params.achievements" rows="2" placeholder="Патенты, контракты, пилоты, награды..."></textarea></div>
        </div>
      </div>
    </template>

    <!-- ─── Прогресс генерации ─── -->
    <div v-if="generating" class="memo-progress">
      <div class="fst-section-label" style="padding: 0 24px; margin-bottom: 12px">ГЕНЕРАЦИЯ МЕМОРАНДУМА</div>
      <div class="memo-progress-wrap">
        <div class="memo-progress-bar" :style="{ width: progress + '%' }"></div>
      </div>
      <div class="memo-progress-steps">
        <span v-for="step in genSteps" :key="step.id"
          :class="{ done: step.done, active: step.active }">
          <i :class="step.done ? 'pi pi-check-circle' : step.active ? 'pi pi-spin pi-spinner' : 'pi pi-circle'" style="font-size:11px"></i>
          {{ step.label }}
        </span>
      </div>
    </div>

    <!-- ─── Сгенерированный меморандум ─── -->
    <template v-if="generated && !generating">
      <div class="fst-section-label" style="padding: 0 24px">ИНВЕСТИЦИОННЫЙ МЕМОРАНДУМ</div>
      <div class="memo-doc">
        <div class="memo-doc-header">
          <div class="memo-doc-logo">ФСТ НТИ</div>
          <div class="memo-doc-meta">
            <div class="memo-doc-title">ИНВЕСТИЦИОННЫЙ МЕМОРАНДУМ</div>
            <div class="memo-doc-subtitle">{{ params.company }} | {{ new Date().toLocaleDateString('ru') }}</div>
          </div>
          <div class="memo-doc-conf">КОНФИДЕНЦИАЛЬНО</div>
        </div>

        <div class="memo-doc-body">
          <!-- Executive Summary -->
          <div class="memo-chapter">
            <div class="memo-chapter-title">1. Executive Summary</div>
            <div class="memo-chapter-body">{{ memoText.executive }}</div>
            <div class="memo-kpi-row">
              <div class="memo-kpi" v-for="k in memoKpis" :key="k.label">
                <div class="memo-kpi-val" :style="{ color: k.color }">{{ k.value }}</div>
                <div class="memo-kpi-label">{{ k.label }}</div>
              </div>
            </div>
          </div>

          <!-- Рынок -->
          <div class="memo-chapter">
            <div class="memo-chapter-title">2. Анализ рынка</div>
            <div class="memo-chapter-body">{{ memoText.market }}</div>
            <div class="memo-market-bar">
              <div class="memo-market-seg memo-market-tam">
                <span>TAM: {{ params.marketSize }} млрд ₽</span>
              </div>
              <div class="memo-market-seg memo-market-sam">
                <span>SAM: {{ Math.round(params.marketSize * 0.3) }} млрд ₽</span>
              </div>
              <div class="memo-market-seg memo-market-som">
                <span>SOM: {{ Math.round(params.marketSize * 0.08) }} млрд ₽</span>
              </div>
            </div>
          </div>

          <!-- Технология -->
          <div class="memo-chapter">
            <div class="memo-chapter-title">3. Технология и суверенность</div>
            <div class="memo-chapter-body">{{ memoText.technology }}</div>
            <div class="memo-badges">
              <span class="memo-badge" :style="{ background: trlColor }">TRL {{ params.trl }} — {{ trlLabel }}</span>
              <span class="memo-badge" :style="{ background: sovColor }">Суверенность {{ params.sovereignty }}/9 — {{ sovLabel }}</span>
            </div>
          </div>

          <!-- Финансы -->
          <div class="memo-chapter">
            <div class="memo-chapter-title">4. Финансовая модель</div>
            <div class="memo-chapter-body">{{ memoText.finance }}</div>
            <table class="memo-table">
              <thead><tr><th>Год</th><th>Выручка</th><th>EBITDA</th><th>ARR роста</th></tr></thead>
              <tbody>
                <tr v-for="row in financialTable" :key="row.year">
                  <td>{{ row.year }}</td><td>{{ row.revenue }} млн ₽</td><td>{{ row.ebitda }} млн ₽</td><td>{{ row.growth }}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Риски -->
          <div class="memo-chapter">
            <div class="memo-chapter-title">5. Риски и митигация</div>
            <div class="memo-risks-table">
              <div class="memo-risk-row" v-for="r in memoRisks" :key="r.risk">
                <span class="memo-risk-level" :style="{ background: r.color }">{{ r.level }}</span>
                <span class="memo-risk-text">{{ r.risk }}</span>
                <span class="memo-risk-mit">{{ r.mitigation }}</span>
              </div>
            </div>
          </div>

          <!-- Рекомендация -->
          <div class="memo-chapter memo-recommendation" :class="overallOk ? 'ok' : 'warn'">
            <div class="memo-chapter-title">6. Рекомендация ФСТ НТИ</div>
            <div class="memo-rec-verdict">
              <span class="memo-rec-icon">{{ overallOk ? '✅' : '⚠️' }}</span>
              <span class="memo-rec-text">{{ memoText.recommendation }}</span>
            </div>
            <div class="memo-rec-conditions">
              <div v-for="c in memoConditions" :key="c" class="memo-rec-cond">→ {{ c }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'

const params = ref({
  company: 'ООО АвиаЛогик',
  subfund: 'БАС — Беспилотные авиасистемы',
  amount: 130,
  finType: 'Equity',
  trl: 6,
  sovereignty: 7,
  marketSize: 85,
  revenue: 18,
  runway: 14,
  teamSize: 11,
  description: 'Разработка систем управления роем БПЛА для логистики и мониторинга инфраструктуры. Патентованная технология координации до 50 аппаратов.',
  achievements: '2 патента РФ, LOI с ГТЛК и Газпромнефть, TRL 6 подтверждён лабораторными испытаниями'
})

const generating = ref(false)
const generated  = ref(false)
const progress   = ref(0)

const genSteps = ref([
  { id: 1, label: 'Анализ рынка',              done: false, active: false },
  { id: 2, label: 'Финансовое моделирование',  done: false, active: false },
  { id: 3, label: 'Оценка суверенности',       done: false, active: false },
  { id: 4, label: 'Анализ рисков',             done: false, active: false },
  { id: 5, label: 'Формирование рекомендации', done: false, active: false }
])

async function generate() {
  generating.value = true
  generated.value  = false
  progress.value   = 0
  genSteps.value.forEach(s => { s.done = false; s.active = false })
  for (let i = 0; i < genSteps.value.length; i++) {
    genSteps.value[i].active = true
    await new Promise(r => setTimeout(r, 700 + Math.random() * 600))
    genSteps.value[i].active = false
    genSteps.value[i].done   = true
    progress.value = ((i + 1) / genSteps.value.length) * 100
  }
  await new Promise(r => setTimeout(r, 400))
  generating.value = false
  generated.value  = true
}

// ── Computed colors ──────────────────────────────────────────────────────────
const trlColor    = computed(() => params.value.trl >= 7        ? 'var(--fst-green)' : params.value.trl >= 5        ? 'var(--fst-brand)' : 'var(--fst-red)')
const sovColor    = computed(() => params.value.sovereignty >= 7 ? 'var(--fst-green)' : params.value.sovereignty >= 5 ? 'var(--fst-brand)' : 'var(--fst-red)')
const runwayColor = computed(() => params.value.runway >= 12     ? 'var(--fst-green)' : params.value.runway >= 6      ? 'var(--fst-brand)' : 'var(--fst-red)')
const overallOk   = computed(() => params.value.trl >= 5 && params.value.sovereignty >= 6 && params.value.marketSize >= 5)
const trlLabel    = computed(() => ['', 'Принципы', 'Концепция', 'Proof of Concept', 'Лаб. валидация', 'Натурные испытания', 'Лётные испытания', 'Демонстрация', 'Квалификация', 'Серия'][params.value.trl] || '')
const sovLabel    = computed(() => params.value.sovereignty >= 8 ? 'Высокая' : params.value.sovereignty >= 6 ? 'Соответствует ФСТ' : 'Ниже порога')

// ── Memo content ─────────────────────────────────────────────────────────────
const memoText = computed(() => ({
  executive: `${params.value.company} — высокотехнологичная компания в сегменте «${params.value.subfund}». Запрашивает ${params.value.amount} млн ₽ (${params.value.finType}) для достижения TRL ${Math.min(params.value.trl + 1, 9)} и масштабирования продаж. Выручка TTM: ${params.value.revenue} млн ₽. Runway: ${params.value.runway} мес. ${params.value.achievements}`,
  market:    `Объём целевого рынка (TAM) оценивается в ${params.value.marketSize} млрд ₽ с CAGR 28% (2025–2030). Нацпроект БАС 2024–2030 создаёт гарантированный спрос от государственных заказчиков на сумму не менее 170 млрд ₽ до 2030 года. SAM: ${Math.round(params.value.marketSize * 0.3)} млрд ₽, реалистичный SOM: ${Math.round(params.value.marketSize * 0.08)} млрд ₽ в 3-летнем горизонте.`,
  technology:`TRL ${params.value.trl} подтверждён испытаниями. Индекс суверенности ${params.value.sovereignty}/9 ${params.value.sovereignty >= 7 ? 'соответствует приоритетам ФСТ (≥ 6/9)' : 'требует повышения до порогового значения 6/9'}. Команда: ${params.value.teamSize} чел. ${params.value.description}`,
  finance:   `Прогноз выручки построен на консервативной базе (рост 60%/год от ${params.value.revenue} млн ₽ TTM). EBITDA-позитивность ожидается на 3-й год. Инвестиции ${params.value.amount} млн ₽ обеспечивают runway ${params.value.runway} мес. и достижение TRL ${Math.min(params.value.trl + 1, 9)} + MRL 6.`,
  recommendation: params.value.trl >= 5 && params.value.sovereignty >= 6 && params.value.marketSize >= 5
    ? `РЕКОМЕНДОВАТЬ к одобрению на инвесткомитете ФСТ НТИ. Проект соответствует всем gate-критериям: TRL ≥ 5, суверенность ≥ 6/9, рынок ≥ ${params.value.marketSize} млрд ₽.`
    : `ТРЕБУЕТ ДОРАБОТКИ перед рассмотрением на ИК. Необходимо: ${params.value.trl < 5 ? 'повысить TRL до 5; ' : ''}${params.value.sovereignty < 6 ? 'повысить суверенность до 6/9; ' : ''}${params.value.marketSize < 5 ? 'подтвердить объём рынка ≥ 5 млрд ₽' : ''}`
}))

const memoKpis = computed(() => [
  { label: 'Инвестиции',  value: params.value.amount + ' млн ₽',     color: 'var(--fst-blue)'   },
  { label: 'TRL',         value: params.value.trl + '/9',             color: 'var(--fst-purple)' },
  { label: 'Суверенность',value: params.value.sovereignty + '/9',     color: 'var(--fst-cyan)'   },
  { label: 'Рынок TAM',   value: params.value.marketSize + ' млрд',   color: 'var(--fst-brand)'  },
  { label: 'Выручка TTM', value: params.value.revenue + ' млн',       color: 'var(--fst-green)'  },
  { label: 'Runway',      value: params.value.runway + ' мес',        color: runwayColor.value   },
])

const financialTable = computed(() => {
  const base = params.value.revenue
  return [2026, 2027, 2028, 2029, 2030].map((year, i) => ({
    year,
    revenue: Math.round(base * Math.pow(1.6, i)),
    ebitda:  Math.round(base * Math.pow(1.6, i) * (i < 2 ? -0.3 : 0.15 + i * 0.05)),
    growth:  i === 0 ? '—' : 60 + Math.round(Math.random() * 20)
  }))
})

const memoRisks = computed(() => [
  { level: 'ВЫСОКИЙ', color: 'var(--fst-red)',   risk: 'Регуляторный: изменения в 114-П Росавиации',     mitigation: 'Участие в рабочей группе Росавиации, лоббирование через АэроНет' },
  { level: 'СРЕДНИЙ', color: 'var(--fst-brand)',  risk: 'MRL 4 — нет серийного производства',            mitigation: 'Транш 2 привязан к MRL 5, LOI с производственным партнёром' },
  { level: 'НИЗКИЙ',  color: 'var(--fst-green)',  risk: 'Конкуренция с иностранными системами',          mitigation: 'Суверенность 7/9 + нацпроектный спрос создают защищённый сегмент' },
])

const memoConditions = computed(() => [
  `Достижение TRL ${Math.min(params.value.trl + 1, 9)} до выплаты транша 2`,
  'Подписание LOI с двумя государственными заказчиками',
  'Найм CTO с опытом серийного производства (MRL 5+)',
  'Ежеквартальная отчётность через систему мониторинга ФСТ',
])

function exportPdf() { window.print() }
</script>

<style scoped>
/* ── Form ── */
.memo-form {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 20px 24px;
  margin: 0 0 4px;
}
.memo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.memo-wide { grid-column: 1 / -1; }
.memo-field { display: flex; flex-direction: column; gap: 4px; }
.memo-field label { font-size: 0.78rem; color: var(--p-text-muted-color); }
.memo-field input,
.memo-field select,
.memo-field textarea {
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  padding: 8px;
  color: var(--p-text-color);
  font-size: 0.85rem;
  outline: none;
  font-family: inherit;
}
.memo-field input:focus,
.memo-field select:focus,
.memo-field textarea:focus { border-color: var(--p-primary-color); }

/* ── Progress ── */
.memo-progress { padding: 0 24px 20px; }
.memo-progress-wrap { height: 6px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; margin-bottom: 14px; }
.memo-progress-bar { height: 100%; background: var(--p-primary-color); border-radius: 3px; transition: width .4s; }
.memo-progress-steps { display: flex; gap: 20px; flex-wrap: wrap; }
.memo-progress-steps span { font-size: 0.82rem; color: var(--p-text-muted-color); display: flex; align-items: center; gap: 5px; }
.memo-progress-steps span.done   { color: var(--fst-green); }
.memo-progress-steps span.active { color: var(--p-primary-color); }

/* ── Document ── */
.memo-doc {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  overflow: hidden;
}
.memo-doc-header {
  background: color-mix(in srgb, var(--fst-blue) 70%, var(--p-surface-card));
  color: white;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 20px;
}
.memo-doc-logo    { font-size: 1.2rem; font-weight: 900; letter-spacing: 1px; opacity: .9; }
.memo-doc-title   { font-size: 1.1rem; font-weight: 800; letter-spacing: 2px; }
.memo-doc-subtitle{ font-size: 0.82rem; opacity: .8; margin-top: 2px; }
.memo-doc-conf    { margin-left: auto; background: color-mix(in srgb, white 15%, transparent); border-radius: 4px; padding: 4px 10px; font-size: 0.72rem; letter-spacing: 1px; }
.memo-doc-body    { padding: 24px; display: flex; flex-direction: column; gap: 20px; }

/* ── Chapters ── */
.memo-chapter { border-left: 3px solid var(--p-primary-color); padding-left: 16px; }
.memo-chapter-title { font-size: 1rem; font-weight: 700; color: var(--p-text-color); margin-bottom: 8px; }
.memo-chapter-body  { font-size: 0.88rem; color: var(--p-text-muted-color); line-height: 1.6; }

/* KPIs */
.memo-kpi-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
.memo-kpi { background: var(--p-surface-ground); border-radius: 8px; padding: 10px 14px; text-align: center; min-width: 95px; }
.memo-kpi-val   { font-size: 1.15rem; font-weight: 700; }
.memo-kpi-label { font-size: 0.7rem; color: var(--p-text-muted-color); margin-top: 2px; }

/* Market bar */
.memo-market-bar { margin-top: 12px; display: flex; flex-direction: column; gap: 4px; }
.memo-market-seg { color: white; font-size: 0.78rem; padding: 6px 12px; border-radius: 4px; }
.memo-market-tam { background: var(--fst-blue-dark); width: 100%; }
.memo-market-sam { background: var(--fst-blue);      width: 30%; }
.memo-market-som { background: var(--fst-cyan);      width: 8%; }

/* Badges */
.memo-badges { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.memo-badge { color: white; font-size: 0.8rem; padding: 4px 12px; border-radius: 20px; }

/* Financial table */
.memo-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.85rem; }
.memo-table th,
.memo-table td  { padding: 8px 12px; border: 1px solid var(--p-content-border-color); text-align: right; }
.memo-table th  { background: var(--p-surface-ground); color: var(--p-text-muted-color); font-weight: 600; text-align: center; }
.memo-table td:first-child { text-align: center; font-weight: 600; }

/* Risks */
.memo-risks-table { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.memo-risk-row    { display: flex; align-items: flex-start; gap: 10px; font-size: 0.84rem; }
.memo-risk-level  { color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; white-space: nowrap; min-width: 80px; text-align: center; }
.memo-risk-text   { color: var(--p-text-color); flex: 1; }
.memo-risk-mit    { color: var(--p-text-muted-color); flex: 2; }

/* Recommendation */
.memo-recommendation.ok   { border-left-color: var(--fst-green); }
.memo-recommendation.warn { border-left-color: var(--fst-brand); }
.memo-rec-verdict    { display: flex; align-items: flex-start; gap: 10px; font-size: 0.92rem; font-weight: 600; color: var(--p-text-color); margin-bottom: 12px; }
.memo-rec-icon       { font-size: 1.2rem; }
.memo-rec-conditions { display: flex; flex-direction: column; gap: 4px; }
.memo-rec-cond       { font-size: 0.82rem; color: var(--p-text-muted-color); padding-left: 12px; }

/* ── Mobile ── */
@media (max-width: 768px) {
  .memo-grid    { grid-template-columns: 1fr; }
  .memo-table   { display: block; overflow-x: auto; }
  .memo-market-sam { width: 50%; }
  .memo-market-som { width: 20%; }
}
</style>
