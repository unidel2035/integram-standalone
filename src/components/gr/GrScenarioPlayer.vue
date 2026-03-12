<!--
  GrScenarioPlayer — сценарии выхода на рынок через раунды финансирования
  Структура: Раунд → капитал → микро-шаги → корректировка → следующий раунд
-->
<template>
  <div class="gsp-wrap">

    <!-- ── Шапка ─────────────────────────────────────────────────── -->
    <div class="gsp-header">
      <div class="gsp-company">
        <span class="gsp-company-name">{{ company?.name || 'Проект' }}</span>
        <span class="gsp-badge gsp-badge--sub">{{ company?.subfund || 'БАС' }}</span>
        <span class="gsp-badge gsp-badge--trl">TRL {{ company?.trl || 4 }}</span>
        <span v-if="activeBossCount" class="gsp-badge gsp-badge--warn">
          {{ activeBossCount }} барьер{{ activeBossCount > 1 ? 'а' : '' }}
        </span>
      </div>
      <button class="gsp-gen-btn" :disabled="loading" @click="generate">
        <span v-if="loading" class="gsp-spin">⟳</span>
        <span v-else>⚡</span>
        {{ loading ? 'AI строит сценарии...' : 'Построить карту операции' }}
      </button>
    </div>

    <!-- ── Пустое состояние ──────────────────────────────────────── -->
    <div v-if="!scenarios && !loading" class="gsp-empty">
      <div class="gsp-empty-icon">🗺️</div>
      <div class="gsp-empty-title">Карта операции не построена</div>
      <div class="gsp-empty-sub">
        AI выстроит путь через раунды финансирования: деньги → шаги → корректировка → следующий раунд
      </div>
      <button class="gsp-gen-btn gsp-gen-btn--big" @click="generate">
        ⚡ Построить карту операции
      </button>
    </div>

    <!-- ── Скелетон ──────────────────────────────────────────────── -->
    <div v-else-if="loading" class="gsp-scenarios">
      <div v-for="i in 3" :key="i" class="gsp-scenario gsp-scenario--loading">
        <div class="gsp-skel gsp-skel--h24 w60" />
        <div class="gsp-skel gsp-skel--h14 w40" />
        <div class="gsp-skel gsp-skel--metrics" />
        <div v-for="j in 4" :key="j" class="gsp-skel gsp-skel--phase" />
      </div>
    </div>

    <!-- ── Три сценария ──────────────────────────────────────────── -->
    <div v-else-if="scenarios" class="gsp-scenarios">
      <div v-for="sc in scenarios" :key="sc.type"
           :class="['gsp-scenario', `gsp-scenario--${sc.type}`]">

        <!-- Заголовок -->
        <div class="gsp-sc-head">
          <span class="gsp-sc-icon">{{ sc.icon }}</span>
          <div>
            <div class="gsp-sc-name">{{ sc.name }}</div>
            <div class="gsp-sc-subtitle">{{ sc.subtitle }}</div>
          </div>
        </div>

        <!-- Метрики -->
        <div class="gsp-metrics">
          <div class="gsp-metric">
            <div class="gsp-metric-val" :style="{ color: sc.color }">{{ sc.irr }}x</div>
            <div class="gsp-metric-lbl">IRR</div>
          </div>
          <div class="gsp-metric">
            <div class="gsp-metric-val" :style="{ color: sc.color }">
              {{ sc.months ? sc.months + ' мес' : '∞' }}
            </div>
            <div class="gsp-metric-lbl">До рынка</div>
          </div>
          <div class="gsp-metric">
            <div class="gsp-metric-val" :style="{ color: sc.color }">
              {{ sc.totalFunding || '—' }}
            </div>
            <div class="gsp-metric-lbl">Привлечено</div>
          </div>
          <div class="gsp-metric">
            <div class="gsp-metric-val" :style="{ color: sc.color }">
              {{ sc.phases ? sc.phases.length : 0 }}
            </div>
            <div class="gsp-metric-lbl">Раундов</div>
          </div>
        </div>

        <!-- Связь с боссами — какие барьеры этот сценарий пробьёт -->
        <div v-if="sc.type !== 'stagnation'" class="gsp-boss-preview">
          <span class="gsp-boss-preview-lbl">Пробивает барьеры:</span>
          <template v-if="bossesForScenario(sc).length">
            <span v-for="b in bossesForScenario(sc)" :key="b.id"
                  class="gsp-boss-tag"
                  :style="{ borderColor: b.color + '55', color: b.color,
                             background: b.color + '12' }">
              {{ b.emoji }} {{ b.name }}
            </span>
          </template>
          <span v-else class="gsp-boss-tag gsp-boss-tag--none">
            барьеры не обнаружены — запусти диагностику
          </span>
        </div>

        <!-- Раунды (фазы) -->
        <div class="gsp-phases">
          <div v-for="(phase, pi) in sc.phases" :key="pi" class="gsp-phase">

            <!-- Заголовок раунда -->
            <div class="gsp-phase-head" :style="{ borderColor: sc.color + '60' }">
              <div class="gsp-phase-badge" :style="{ background: sc.color + '20', color: sc.color }">
                Раунд {{ phase.round }}
              </div>
              <div class="gsp-phase-info">
                <span class="gsp-phase-label">{{ phase.label }}</span>
                <span class="gsp-phase-dur">{{ phase.duration }}</span>
              </div>
              <div class="gsp-phase-capital" :style="{ color: sc.color }">{{ phase.capital }}</div>
            </div>

            <!-- Шаги раунда -->
            <div class="gsp-timeline">
              <div v-for="(step, si) in phase.steps" :key="si"
                   :class="['gsp-step', step.virtual && 'gsp-step--virt', step.tunnel && 'gsp-step--tunnel', step.crisis && 'gsp-step--crisis']">

                <div class="gsp-step-time">{{ step.month === 0 ? 'Сейчас' : '+' + step.month + 'м' }}</div>

                <div :class="['gsp-step-icon', step.virtual && 'gsp-step-icon--virt', step.tunnel && 'gsp-step-icon--tunnel', step.crisis && 'gsp-step-icon--crisis']">
                  {{ step.virtual ? '🌐' : step.tunnel ? '⚛' : step.crisis ? '💀' : step.eventType ? '⚡' : '●' }}
                </div>

                <div class="gsp-step-body">
                  <div class="gsp-step-desc">{{ step.description }}</div>
                  <div v-if="step.detail" class="gsp-step-detail">{{ step.detail }}</div>
                  <div v-if="step.actor" class="gsp-step-actor">{{ step.actor }}</div>
                  <div v-if="step.virtual" class="gsp-step-tag gsp-step-tag--virt">
                    🌐 Виртуальный рынок · регулятор ещё не здесь
                  </div>
                  <div v-if="step.tunnel" class="gsp-step-tag gsp-step-tag--tunnel">
                    ⚛ Квантовый туннель · обход до реакции врага
                  </div>
                </div>
              </div>
            </div>

            <!-- Чекпоинт / решение -->
            <div v-if="phase.checkpoint" class="gsp-checkpoint" :style="{ borderColor: sc.color + '40' }">
              <div class="gsp-checkpoint-head">
                <span class="gsp-checkpoint-icon">🔄</span>
                <span class="gsp-checkpoint-label">Корректировка · {{ phase.checkpoint.decision }}</span>
              </div>
              <div v-if="phase.checkpoint.metrics?.length" class="gsp-checkpoint-metrics">
                <span v-for="m in phase.checkpoint.metrics" :key="m" class="gsp-checkpoint-metric">{{ m }}</span>
              </div>
              <div v-if="phase.checkpoint.trigger" class="gsp-checkpoint-trigger">
                → {{ phase.checkpoint.trigger }}
              </div>
            </div>

            <!-- Стрелка к следующему раунду (кроме последнего) -->
            <div v-if="pi < sc.phases.length - 1" class="gsp-phase-arrow" :style="{ color: sc.color }">
              ↓ {{ sc.phases[pi + 1]?.label }}
            </div>

          </div>
        </div>

        <!-- Итог -->
        <div :class="['gsp-result', `gsp-result--${sc.outcome}`]">
          {{ sc.resultText }}
        </div>

        <!-- Применить -->
        <button v-if="sc.type !== 'stagnation'"
                class="gsp-apply"
                :class="`gsp-apply--${sc.type}`"
                :disabled="applying === sc.type"
                @click="applyScenario(sc)">
          {{ applying === sc.type ? '⟳ Применяю...' : 'Применить этот путь →' }}
        </button>
      </div>
    </div>

    <!-- ── AI-нарратив ───────────────────────────────────────────── -->
    <div v-if="narrative" class="gsp-narrative">
      <div class="gsp-narrative-head">
        <i class="pi pi-sparkles" style="color:#fbbf24" /> Ситуационный анализ
      </div>
      {{ narrative }}
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { GR_BOSSES, getBossState } from '@/config/grBosses.js'
import { GR_MEASURES } from '@/config/grMeasuresData.js'

const props = defineProps({
  company:  { type: Object, default: null },
  events:   { type: Array,  default: () => [] },
  possible: { type: Array,  default: () => [] },
})
const emit = defineEmits(['apply'])

const loading   = ref(false)
const scenarios = ref(null)
const narrative = ref('')
const applying  = ref(null)

// ─── Контекст компании ────────────────────────────────────────────────────────
const bossStates = computed(() => {
  const m = {}
  for (const b of GR_BOSSES) m[b.id] = getBossState(b, props.events)
  return m
})
const activeBossCount = computed(() =>
  GR_BOSSES.filter(b => bossStates.value[b.id]?.triggered && !bossStates.value[b.id]?.defeated).length
)

const relevantMeasures = computed(() => {
  const trl  = props.company?.trl || 4
  const sub  = (props.company?.subfund || '').toLowerCase()
  const isBas = sub.includes('бас') || sub.includes('бпла') || sub.includes('аэро')
  return GR_MEASURES.filter(m => {
    const trlOk  = m.trl_min <= trl && m.trl_max >= trl
    const sectOk = !m.sector || m.sector.some(s =>
      s.toLowerCase().includes('все') ||
      s.toLowerCase().includes('бпла') ||
      s.toLowerCase().includes('промышлен') ||
      (isBas && (s.toLowerCase().includes('аэро') || s.toLowerCase().includes('бас')))
    )
    return trlOk && sectOk
  }).slice(0, 10)
})

// ─── Связь сценарий → боссы ──────────────────────────────────────────────────
function bossesForScenario(sc) {
  const types = new Set(
    (sc.phases || []).flatMap(ph => (ph.steps || []).map(s => s.eventType).filter(Boolean))
  )
  return GR_BOSSES.filter(boss =>
    boss.attacks.some(a => types.has(a.type)) &&
    (bossStates.value[boss.id]?.triggered || !bossStates.value[boss.id])
  )
}

// ─── Генерация через AI ───────────────────────────────────────────────────────
async function generate() {
  if (!props.company) return
  loading.value   = true
  scenarios.value = null
  narrative.value = ''

  const activeBosses = GR_BOSSES
    .filter(b => bossStates.value[b.id]?.triggered && !bossStates.value[b.id]?.defeated)
    .map(b => `${b.emoji} ${b.name}`)

  const measuresCtx = relevantMeasures.value
    .map(m => `${m.name} (${m.amount}, ${m.operator}, TRL ${m.trl_min}-${m.trl_max})`)
    .join('\n')

  const systemPrompt = `Ты — стратег-эксперт по GR для венчурного фонда. Знаешь все российские программы поддержки инноваций.
Отвечай ТОЛЬКО валидным JSON без markdown-обёртки. Давай предельно конкретные шаги: реальные программы, точные суммы, реальные сроки, конкретные операторы.
Структура: каждый сценарий делится на РАУНДЫ ФИНАНСИРОВАНИЯ. Каждый раунд = отдельная фаза: получили деньги → сделали шаги → корректировка → следующий раунд.`

  const prompt = `Компания: ${props.company.name}
Субфонд/сектор: ${props.company.subfund || 'БПЛА / БАС'}
TRL: ${props.company.trl || 4} · Стадия: ${props.company.stage || 'Посевная'}
Runway: ${props.company.runway || 12} мес
Активные барьеры: ${activeBosses.join(', ') || 'не выявлены'}

Доступные GR-меры:
${measuresCtx}

Построй три сценария с разбивкой по РАУНДАМ ФИНАНСИРОВАНИЯ.
Логика: деньги → конкретные шаги которые они разблокируют → корректировка по результатам → следующий раунд.

Для сценария "Стратегия Шлимана" найди конкретный регуляторный вакуум (ОЭЗ / ЭПР / ведомственные зоны / класс БПЛА по весу).

Верни JSON:
{
  "narrative": "3-4 предложения: ситуация, почему застряли, что разблокирует",
  "scenarios": [
    {
      "type": "stagnation",
      "name": "Без GR", "subtitle": "что происходит", "icon": "❌", "color": "#ef4444",
      "irr": 1.0, "months": null, "totalFunding": "0 ₽", "outcome": "fail",
      "resultText": "конкретный итог: что теряем",
      "phases": [
        {
          "round": 0, "label": "Собственные средства", "capital": "500 тыс. ₽", "duration": "0-3 мес",
          "steps": [
            { "month": 0, "description": "конкретная проблема", "detail": "НПА, срок", "actor": "орган", "eventType": null, "virtual": false, "tunnel": false, "crisis": true }
          ],
          "checkpoint": {
            "decision": "Стагнация",
            "metrics": ["Выручка: 0", "Сертификат: нет"],
            "trigger": "Runway исчерпан → принудительный выход"
          }
        }
      ]
    },
    {
      "type": "basic",
      "name": "Базовый GR", "subtitle": "системное прохождение барьеров", "icon": "✓", "color": "#22c55e",
      "irr": 1.8, "months": 11, "totalFunding": "38 млн ₽", "outcome": "success",
      "resultText": "конкретный итог: первый контракт",
      "phases": [
        {
          "round": 0, "label": "Pre-seed / Сколково", "capital": "800 тыс./год экономии", "duration": "0-3 мес",
          "steps": [
            { "month": 1, "description": "Подача на Сколково", "detail": "30 дней · НДС 0%, налог прибыль 0%", "actor": "Команда", "eventType": "MEASURE_APPLIED", "virtual": false, "tunnel": false, "crisis": false }
          ],
          "checkpoint": {
            "decision": "Продолжить → раунд ФАСИЕ",
            "metrics": ["Сколково: статус получен", "Экономия: 800 тыс./год"],
            "trigger": "Статус Сколково → открывает подачу на СТАРТ-1"
          }
        }
      ]
    },
    {
      "type": "schlimann",
      "name": "Стратегия Шлимана", "subtitle": "виртуальный рынок в вакууме", "icon": "⚡", "color": "#06b6d4",
      "irr": 2.4, "months": 5, "totalFunding": "4.5 млн ₽", "outcome": "breakthru",
      "resultText": "конкретный итог: ниша занята, выручка",
      "phases": [
        {
          "round": 0, "label": "Нулевой капитал — вакуум", "capital": "0 ₽ (правовой вакуум)", "duration": "0-1 мес",
          "steps": [
            { "month": 0, "description": "КОНКРЕТНЫЙ вакуум: где нет регулирования", "detail": "Норма · Зона · Класс", "actor": "Команда", "eventType": null, "virtual": true, "tunnel": false, "crisis": false }
          ],
          "checkpoint": {
            "decision": "Валидация рынка",
            "metrics": ["Первая выручка", "Конкурент не реагировал N дней"],
            "trigger": "Выручка есть → подача УМНИК/СТАРТ-1 с кейсом"
          }
        }
      ]
    }
  ]
}`

  try {
    const resp = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId:     'deepseek/deepseek-chat',
        prompt,
        systemPrompt,
        application: 'GrScenarioPlayer',
      }),
    })
    const { response } = await resp.json()
    const m = response.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('no json')
    const data = JSON.parse(m[0])
    narrative.value  = data.narrative || ''
    scenarios.value  = data.scenarios || []
  } catch (e) {
    console.error('GrScenarioPlayer:', e)
    scenarios.value = buildDemoScenarios()
    narrative.value = buildDemoNarrative()
  } finally {
    loading.value = false
  }
}

// ─── Применить сценарий ───────────────────────────────────────────────────────
async function applyScenario(sc) {
  applying.value = sc.type
  const evts = (sc.phases || [])
    .flatMap(ph => ph.steps || [])
    .filter(s => s.eventType)
    .map(s => ({
      type:    s.eventType,
      label:   s.description,
      subject: `Сценарий: ${sc.name}`,
      ts:      new Date(Date.now() + s.month * 30 * 86400000).toISOString(),
      data:    { scenario: sc.type, detail: s.detail, actor: s.actor },
    }))
  emit('apply', evts)
  await new Promise(r => setTimeout(r, 800))
  applying.value = null
}

// ─── Демо-сценарии (конкретные для БПЛА/БАС) ─────────────────────────────────
function buildDemoNarrative() {
  const n = props.company?.name || 'Проект'
  return `${n} работает в секторе БПЛА/БАС с TRL ${props.company?.trl || 4}. ` +
    `Ключевой барьер — отсутствие сертификата типа ВС (Приказ МТ №285): Росавиация выдаёт 18+ мес. ` +
    `Без GR runway кончится раньше сертификации. ` +
    `Стратегия Шлимана: БПЛА до 30 кг в агро-зонах работают без сертификата (Постановление №1148 п.5) — это первые деньги.`
}

function buildDemoScenarios() {
  const n = props.company?.name || 'Проект'
  return [
    {
      type: 'stagnation', name: 'Без GR', icon: '❌', color: '#ef4444',
      subtitle: 'ждём сертификата — теряем рынок',
      irr: 1.0, months: null, totalFunding: '0 ₽', outcome: 'fail',
      resultText: `${n} теряет нишу. ZALA Aero (Ростех) занимает рынок при поддержке Минпромторга.`,
      phases: [
        {
          round: 0,
          label: 'Собственные средства',
          capital: '500 тыс. ₽',
          duration: '0-3 мес',
          steps: [
            { month: 0, description: 'Росавиация: сертификат типа ВС обязателен', detail: 'Приказ МТ №285 · срок 18-24 мес · стоимость 3-7 млн ₽', actor: 'Росавиация', eventType: null, virtual: false, tunnel: false, crisis: true },
            { month: 2, description: 'ГК Почта России приостанавливает переговоры', detail: 'Требование: сертификат + страхование + разрешение ГКРЧ на частоты', actor: 'Потенциальный заказчик', eventType: null, virtual: false, tunnel: false, crisis: true },
          ],
          checkpoint: {
            decision: 'Стагнация — нет денег на следующий шаг',
            metrics: ['Выручка: 0 ₽', 'Сертификат: 18+ мес', 'Runway: -3 мес'],
            trigger: 'Конкурент с GR-поддержкой Ростеха опережает на 9 мес',
          },
        },
        {
          round: 1,
          label: 'Потеря позиций',
          capital: '0 ₽ (runway критический)',
          duration: '3-12 мес',
          steps: [
            { month: 5, description: 'Конкурент ZALA Aero получает тестовые полёты в Татарстане', detail: 'Минпромторг субсидия 180 млн ₽ · Постановление №3255', actor: 'ZALA Aero / Ростех', eventType: null, virtual: false, tunnel: false, crisis: true },
            { month: 9, description: 'Инвестор переводит в watchlist: нет выручки 9 мес', detail: 'Новый раунд невозможен без трекшна · Runway: 3 мес', actor: 'Инвестор', eventType: null, virtual: false, tunnel: false, crisis: true },
            { month: 12, description: 'Runway = 0. Ликвидация или вынужденный pivot.', detail: 'Потеря команды, IP, рыночной позиции. Выход фонда с убытком.', actor: null, eventType: null, virtual: false, tunnel: false, crisis: true },
          ],
          checkpoint: {
            decision: 'Конец — выход с убытком',
            metrics: ['Потеря: 100% вложений', 'Рынок: занят конкурентом'],
            trigger: null,
          },
        },
      ],
    },
    {
      type: 'basic', name: 'Базовый GR', icon: '✓', color: '#22c55e',
      subtitle: 'системное прохождение барьеров',
      irr: 1.8, months: 11, totalFunding: '38 млн ₽', outcome: 'success',
      resultText: `${n} выходит через 11 мес. Контракт: Почта России 15 млн ₽/год.`,
      phases: [
        {
          round: 0,
          label: 'Pre-seed / Сколково',
          capital: '800 тыс. ₽/год экономии',
          duration: '0-3 мес',
          steps: [
            { month: 1, description: 'Подача на статус участника Сколково', detail: 'НДС 0%, страховые взносы 7.6%, налог 0% · Срок 30 дней · Экономия ~800 тыс./год', actor: 'Команда + юрист', eventType: 'MEASURE_APPLIED', virtual: false, tunnel: false, crisis: false },
            { month: 2, description: 'Сколково статус получен', detail: 'Открывает доступ к грантам Сколково и снижает burn rate', actor: 'Сколково', eventType: 'MEASURE_APPROVED', virtual: false, tunnel: false, crisis: false },
          ],
          checkpoint: {
            decision: 'Продолжить → Раунд ФАСИЕ СТАРТ-1',
            metrics: ['Статус Сколково: ✓', 'Экономия: 800 тыс./год', 'Burn rate: -12%'],
            trigger: 'Статус Сколково → усиливает заявку СТАРТ-1',
          },
        },
        {
          round: 1,
          label: 'ФАСИЕ СТАРТ-1 — 4 млн ₽',
          capital: '4 млн ₽ (грант)',
          duration: '2-5 мес',
          steps: [
            { month: 1, description: 'ФАСИЕ СТАРТ-1: подача заявки', detail: '4 млн ₽ · ФАСИЕ · Срок рассмотрения 45 дней · TRL 4→5 прототип', actor: 'Команда + фонд', eventType: 'MEASURE_APPLIED', virtual: false, tunnel: false, crisis: false },
            { month: 3, description: 'СТАРТ-1 одобрен: 4 млн ₽ получено', detail: 'Направление: НИОКР прототипа TRL5 · Открывает СТАРТ-2 через 6 мес', actor: 'ФАСИЕ', eventType: 'MEASURE_FUNDED', virtual: false, tunnel: false, crisis: false },
            { month: 4, description: 'НТИ Аэронет: включение в рабочую группу Минэкономразвития', detail: 'Заседание раз в квартал · Прямой выход на Росавиацию · Ускорение сертификации', actor: 'АНО Платформа НТИ', eventType: 'WORKING_GROUP_FORMED', virtual: false, tunnel: false, crisis: false },
          ],
          checkpoint: {
            decision: 'Скорректировать TRL-роадмап → подавать на ЭПР и ФРП',
            metrics: ['Прототип: TRL5', 'Грант: 4 млн ₽', 'НТИ рабочая группа: ✓'],
            trigger: 'Прототип TRL5 + НТИ членство → открывает ФРП НИОКР 30 млн',
          },
        },
        {
          round: 2,
          label: 'ФРП НИОКР — 30 млн ₽ @ 3%',
          capital: '30 млн ₽ (займ @ 3%)',
          duration: '5-9 мес',
          steps: [
            { month: 6, description: 'ЭПР подан в Минэкономразвития (ФЗ-258)', detail: 'Зона пилотных полётов 50 км² · Срок рассмотрения 90 дней', actor: 'Команда + юрист', eventType: 'MEASURE_APPLIED', virtual: false, tunnel: false, crisis: false },
            { month: 7, description: 'ФРП займ «НИОКР» одобрен: 30 млн ₽ @ 3%', detail: 'ФРП · Производство 10 ед./мес · Требует: патент + партнёрство с вузом', actor: 'ФРП + Минпромторг', eventType: 'MEASURE_FUNDED', virtual: false, tunnel: false, crisis: false },
            { month: 9, description: 'ЭПР одобрён: коммерческие полёты в ОЭЗ Иннополис', detail: 'Без сертификата типа ВС · 50 км² · 3 года · B2G сбыт разрешён', actor: 'Минэкономразвития', eventType: 'MEASURE_APPROVED', virtual: false, tunnel: false, crisis: false },
          ],
          checkpoint: {
            decision: 'Запуск продаж → Серия A',
            metrics: ['ЭПР: ✓', 'Производство: 10 ед./мес', 'Займ ФРП: 30 млн @ 3%'],
            trigger: 'ЭПР + производство → первый коммерческий контракт → Серия A',
          },
        },
        {
          round: 3,
          label: 'Первые продажи → Серия A',
          capital: '15 млн ₽/год (выручка)',
          duration: '9-12 мес',
          steps: [
            { month: 11, description: 'Первый контракт: Почта России — 15 млн ₽/год', detail: 'Доставка в ЯНАО · ЭПР + страхование · Базис для Серии A', actor: 'ГК Почта России', eventType: null, virtual: false, tunnel: false, crisis: false },
          ],
          checkpoint: {
            decision: 'Серия A: 150-300 млн ₽',
            metrics: ['Выручка: 15 млн/год', 'IRR фонда: 1.8x', 'Клиенты: 1+'],
            trigger: 'Контракт Почта России → Серия A от венчурных фондов',
          },
        },
      ],
    },
    {
      type: 'schlimann', name: 'Стратегия Шлимана', icon: '⚡', color: '#06b6d4',
      subtitle: 'виртуальный рынок — выручка до прихода регулятора',
      irr: 2.4, months: 5, totalFunding: '4.5 млн ₽', outcome: 'breakthru',
      resultText: `${n} занимает нишу за 5 мес с 430 тыс./мес до прихода конкурента. IRR 2.4x.`,
      phases: [
        {
          round: 0,
          label: 'Нулевой капитал — правовой вакуум',
          capital: '0 ₽ (вакуум = актив)',
          duration: '0-1 мес',
          steps: [
            { month: 0, description: 'Вакуум найден: БПЛА до 30 кг в агро-зонах без сертификата', detail: 'Постановление №1148 п.5 · Белгородская, Воронежская обл. · 3-5 тыс. ₽/га · 8 млн га рынка', actor: 'Команда (GAP-анализ)', eventType: null, virtual: true, tunnel: false, crisis: false },
            { month: 0, description: 'Первые платные полёты: агро-клиенты Белгородской обл.', detail: 'Мониторинг + опрыскивание · 280 тыс. ₽/мес · Конкурент в очереди к Росавиации', actor: 'Команда', eventType: 'PROJECT_INITIATED', virtual: true, tunnel: false, crisis: false },
          ],
          checkpoint: {
            decision: 'Валидация — есть реальные деньги',
            metrics: ['Первая выручка: 280 тыс./мес', 'Реакция конкурента: 0 дней'],
            trigger: 'Выручка в кармане → подача УМНИК с боевым кейсом',
          },
        },
        {
          round: 1,
          label: 'УМНИК — 0.5 млн ₽ + второй вакуум',
          capital: '500 тыс. ₽ + 150 тыс./мес новых',
          duration: '1-3 мес',
          steps: [
            { month: 1, description: 'Второй вакуум: ведомственный воздух РЖД', detail: 'Закрытые зоны РЖД — не нужно согласование Росавиации · Мониторинг ЛЭП/путей · +150 тыс./мес', actor: 'Команда + BD', eventType: 'MEASURE_APPLIED', virtual: true, tunnel: false, crisis: false },
            { month: 1, description: 'ФАСИЕ УМНИК подан (500 тыс. ₽)', detail: '30 дней · В заявке — реальная выручка 280 тыс./мес · Шанс одобрения 3× выше', actor: 'Основатель (до 30 лет)', eventType: 'MEASURE_APPLIED', virtual: false, tunnel: false, crisis: false },
            { month: 2, description: 'Квантовый туннель: НТИ Аэронет песочница — 15 площадок без сертификации', detail: 'АНО Платформа НТИ · Срок подключения: 14 дней · Доступ к 15 площадкам по всей России', actor: 'АНО Платформа НТИ', eventType: 'WORKING_GROUP_FORMED', virtual: false, tunnel: true, crisis: false },
          ],
          checkpoint: {
            decision: 'Расширить присутствие → подача СТАРТ-1',
            metrics: ['Выручка: 430 тыс./мес', 'Рынки: агро + РЖД + НТИ', 'УМНИК: ожидаем'],
            trigger: 'Реальная выручка → СТАРТ-1 с пакетом данных → 3× быстрее одобрение',
          },
        },
        {
          round: 2,
          label: 'СТАРТ-1 — 4 млн ₽ (с доказательной базой)',
          capital: '4.5 млн ₽ (УМНИК + СТАРТ-1)',
          duration: '2-5 мес',
          steps: [
            { month: 2, description: 'ФАСИЕ СТАРТ-1 подан — с реальной выручкой в заявке', detail: '4 млн ₽ · 200+ реальных полётов убеждают комиссию · Одобрение 28 дней вместо 45', actor: 'Команда + фонд', eventType: 'MEASURE_APPLIED', virtual: false, tunnel: false, crisis: false },
            { month: 3, description: 'УМНИК: 500 тыс. · СТАРТ-1: 4 млн — получено', detail: 'Быстрее среднего: 28 дней за счёт выручки · Итого 4.5 млн за 3 месяца', actor: 'ФАСИЕ', eventType: 'MEASURE_FUNDED', virtual: false, tunnel: false, crisis: false },
            { month: 4, description: '4 корпоративных клиента: агро / РЖД / ЖКХ / лесохозяйство', detail: 'Суммарная выручка 430 тыс./мес · Регулятор только формирует комиссию по БПЛА', actor: 'Команда (продажи)', eventType: null, virtual: false, tunnel: false, crisis: false },
          ],
          checkpoint: {
            decision: 'Кристаллизация позиции → ЭПР пока регулятор не пришёл',
            metrics: ['Выручка: 430 тыс./мес', 'Клиенты: 4', 'Грант: 4.5 млн ₽'],
            trigger: 'Данные из 200+ полётов → ЭПР за 60 дней вместо 90+ (конкурент опаздывает)',
          },
        },
        {
          round: 3,
          label: 'ЭПР → Серия A (раньше конкурента)',
          capital: 'Серия A: 100-200 млн ₽',
          duration: '5-8 мес',
          steps: [
            { month: 5, description: 'ЭПР подан с пакетом реальных данных — 60 дней вместо 90+', detail: '200+ полётов · Регулятор видит рабочую модель · Конкурент подаёт ЭПР на 3 мес позже', actor: 'Команда + Минэкономразвития', eventType: 'MEASURE_APPLIED', virtual: false, tunnel: false, crisis: false },
          ],
          checkpoint: {
            decision: 'Серия A на 3 мес раньше конкурента',
            metrics: ['IRR: 2.4x', 'Выручка: 430 тыс./мес', 'Опережение: 3 мес'],
            trigger: 'ЭПР одобрён + выручка → Серия A от топ-фондов',
          },
        },
      ],
    },
  ]
}
</script>

<style scoped>
.gsp-wrap { display: flex; flex-direction: column; gap: 14px; }

/* ── Шапка ── */
.gsp-header {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
}
.gsp-company { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.gsp-company-name { font-size: 15px; font-weight: 700; }
.gsp-badge {
  font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 8px;
}
.gsp-badge--warn { background: #ef444418; color: #ef4444; }
.gsp-badge--sub  { background: #3b82f618; color: #3b82f6; }
.gsp-badge--trl  { background: #f59e0b18; color: #f59e0b; }

.gsp-gen-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer;
  background: var(--p-primary-color); color: white;
  font-size: 13px; font-weight: 600;
  transition: opacity .2s, transform .1s;
}
.gsp-gen-btn:hover   { opacity: .88; transform: translateY(-1px); }
.gsp-gen-btn:disabled { opacity: .5; cursor: default; transform: none; }
.gsp-gen-btn--big    { padding: 12px 24px; font-size: 15px; margin: 0 auto; }
.gsp-spin { display: inline-block; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Пустое состояние ── */
.gsp-empty {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 40px 20px; text-align: center;
  border: 1px dashed var(--p-content-border-color); border-radius: 12px;
}
.gsp-empty-icon  { font-size: 40px; }
.gsp-empty-title { font-size: 16px; font-weight: 700; }
.gsp-empty-sub   { font-size: 12px; color: var(--p-text-muted-color); max-width: 400px; line-height: 1.6; }

/* ── Три колонки ── */
.gsp-scenarios {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
}
@media (max-width: 900px) { .gsp-scenarios { grid-template-columns: 1fr; } }

/* ── Одна колонка-сценарий ── */
.gsp-scenario {
  display: flex; flex-direction: column; gap: 10px;
  padding: 14px; border-radius: 12px;
  border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
}
.gsp-scenario--stagnation { border-color: #ef444428; background: linear-gradient(160deg,#ef444406,var(--p-surface-card)); }
.gsp-scenario--basic      { border-color: #22c55e28; background: linear-gradient(160deg,#22c55e06,var(--p-surface-card)); }
.gsp-scenario--schlimann  { border-color: #06b6d428; background: linear-gradient(160deg,#06b6d406,var(--p-surface-card)); box-shadow: 0 0 24px #06b6d40a; }

/* Скелетон */
.gsp-scenario--loading { animation: sk-pulse 1.4s ease-in-out infinite; }
@keyframes sk-pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
.gsp-skel { border-radius: 4px; background: var(--p-content-border-color); margin-bottom: 6px; }
.gsp-skel--h24 { height: 24px; } .gsp-skel--h14 { height: 14px; }
.gsp-skel--metrics { height: 42px; border-radius: 8px; }
.gsp-skel--phase { height: 80px; border-radius: 8px; margin-bottom: 8px; }
.w60 { width: 60%; } .w40 { width: 40%; }

/* ── Заголовок сценария ── */
.gsp-sc-head { display: flex; align-items: flex-start; gap: 8px; }
.gsp-sc-icon { font-size: 22px; flex-shrink: 0; }
.gsp-sc-name { font-size: 14px; font-weight: 700; }
.gsp-sc-subtitle { font-size: 10px; color: var(--p-text-muted-color); }

/* ── Метрики ── */
.gsp-metrics {
  display: flex; gap: 0;
  background: var(--p-surface-hover, #ffffff08);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px; overflow: hidden;
}
.gsp-metric {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  padding: 6px 4px; gap: 2px;
  border-right: 1px solid var(--p-content-border-color);
}
.gsp-metric:last-child { border-right: none; }
.gsp-metric-val { font-size: 14px; font-weight: 900; }
.gsp-metric-lbl { font-size: 9px; color: var(--p-text-muted-color); }

/* ── Раунды ── */
.gsp-phases { display: flex; flex-direction: column; gap: 0; flex: 1; }

.gsp-phase { display: flex; flex-direction: column; gap: 6px; }

.gsp-phase-head {
  display: flex; align-items: center; gap: 7px;
  padding: 6px 8px; border-radius: 7px;
  border: 1px solid; flex-wrap: wrap;
  background: var(--p-surface-hover, #ffffff05);
}
.gsp-phase-badge {
  font-size: 9px; font-weight: 900; padding: 2px 7px; border-radius: 6px;
  white-space: nowrap; flex-shrink: 0;
}
.gsp-phase-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.gsp-phase-label { font-size: 10px; font-weight: 700; }
.gsp-phase-dur   { font-size: 9px; color: var(--p-text-muted-color); }
.gsp-phase-capital { font-size: 10px; font-weight: 900; white-space: nowrap; }

/* ── Таймлайн шагов ── */
.gsp-timeline { display: flex; flex-direction: column; gap: 0; }
.gsp-step {
  display: grid;
  grid-template-columns: 42px 18px 1fr;
  gap: 6px;
  padding: 6px 0 6px 0;
  border-left: 2px solid var(--p-content-border-color);
  margin-left: 9px;
  padding-left: 10px;
  position: relative;
}
.gsp-step--virt   { border-left-color: #f59e0b50; background: #f59e0b04; border-radius: 0 6px 6px 0; }
.gsp-step--tunnel { border-left-color: #06b6d450; background: #06b6d404; border-radius: 0 6px 6px 0; }
.gsp-step--crisis { border-left-color: #ef444450; background: #ef444404; border-radius: 0 6px 6px 0; }

.gsp-step-time {
  font-size: 9px; font-weight: 700; color: var(--p-text-muted-color);
  padding-top: 3px; text-align: right; white-space: nowrap;
}
.gsp-step-icon {
  position: absolute; left: -10px; top: 8px;
  width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; background: var(--p-surface-card);
  border: 2px solid var(--p-content-border-color); border-radius: 50%;
}
.gsp-step-icon--virt   { border-color: #f59e0b; background: #f59e0b18; font-size: 10px; }
.gsp-step-icon--tunnel { border-color: #06b6d4; background: #06b6d418; font-size: 10px; }
.gsp-step-icon--crisis { border-color: #ef4444; background: #ef444418; font-size: 10px; }

.gsp-step-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.gsp-step-desc { font-size: 11px; font-weight: 600; color: var(--p-text-color); line-height: 1.4; }
.gsp-step-detail { font-size: 10px; color: var(--p-text-muted-color); line-height: 1.4; }
.gsp-step-actor  { font-size: 9px; color: var(--p-text-muted-color); font-style: italic; }
.gsp-step-tag {
  font-size: 9px; font-weight: 700; border-radius: 4px; padding: 1px 5px;
  width: fit-content; margin-top: 1px;
}
.gsp-step-tag--virt   { background: #f59e0b14; color: #f59e0b; }
.gsp-step-tag--tunnel { background: #06b6d414; color: #06b6d4; }

/* ── Чекпоинт ── */
.gsp-checkpoint {
  margin: 2px 0 2px 9px;
  padding: 7px 10px;
  border: 1px solid; border-radius: 6px;
  background: var(--p-surface-hover, #ffffff06);
  display: flex; flex-direction: column; gap: 4px;
}
.gsp-checkpoint-head {
  display: flex; align-items: center; gap: 5px;
}
.gsp-checkpoint-icon { font-size: 11px; }
.gsp-checkpoint-label { font-size: 10px; font-weight: 700; color: var(--p-text-color); }
.gsp-checkpoint-metrics {
  display: flex; flex-wrap: wrap; gap: 4px;
}
.gsp-checkpoint-metric {
  font-size: 9px; padding: 1px 5px; border-radius: 4px;
  background: var(--p-content-border-color); color: var(--p-text-muted-color);
}
.gsp-checkpoint-trigger {
  font-size: 9px; color: var(--p-text-muted-color); font-style: italic; line-height: 1.4;
}

/* ── Стрелка к следующему раунду ── */
.gsp-phase-arrow {
  text-align: center; font-size: 10px; font-weight: 700;
  padding: 4px 0; opacity: .7;
}

/* ── Итог ── */
.gsp-result {
  font-size: 11px; font-weight: 600; padding: 7px 10px;
  border-radius: 6px; line-height: 1.4;
}
.gsp-result--fail     { background: #ef444412; color: #ef4444; }
.gsp-result--success  { background: #22c55e12; color: #22c55e; }
.gsp-result--breakthru { background: #06b6d412; color: #06b6d4; }

/* ── Применить ── */
.gsp-apply {
  padding: 8px 12px; border-radius: 7px; border: none;
  cursor: pointer; font-size: 11px; font-weight: 700;
  transition: opacity .2s, transform .1s; margin-top: auto;
}
.gsp-apply:hover   { opacity: .85; transform: translateY(-1px); }
.gsp-apply:disabled { opacity: .5; cursor: default; transform: none; }
.gsp-apply--basic     { background: color-mix(in srgb, var(--fst-green) 12%, transparent); color: var(--fst-green); border: 1px solid color-mix(in srgb, var(--fst-green) 30%, transparent); }
.gsp-apply--schlimann { background: color-mix(in srgb, var(--fst-cyan) 12%, transparent); color: var(--fst-cyan); border: 1px solid color-mix(in srgb, var(--fst-cyan) 30%, transparent); }

/* ── Boss preview ── */
.gsp-boss-preview {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  padding: 8px 0; border-top: 1px solid var(--p-content-border-color);
  border-bottom: 1px solid var(--p-content-border-color);
  margin-bottom: 4px;
}
.gsp-boss-preview-lbl {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--p-text-muted-color); flex-shrink: 0;
}
.gsp-boss-tag {
  font-size: 10px; font-weight: 600; padding: 2px 8px;
  border-radius: 8px; border: 1px solid var(--p-content-border-color);
  color: var(--p-text-muted-color);
}
.gsp-boss-tag--none {
  font-size: 10px; color: var(--p-text-muted-color); font-style: italic;
  border: none; padding: 0;
}

/* ── Нарратив ── */
.gsp-narrative {
  padding: 10px 14px; background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px; border-left: 3px solid #fbbf24;
  font-size: 12px; line-height: 1.7; color: var(--p-text-color);
}
.gsp-narrative-head {
  font-size: 10px; font-weight: 700; color: #fbbf24;
  display: flex; align-items: center; gap: 5px; margin-bottom: 5px;
}
</style>
