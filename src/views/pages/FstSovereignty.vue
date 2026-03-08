<template>
  <div class="sv-root">
    <div class="sv-header">
      <div>
        <h1>Аудит суверенности 9D</h1>
        <span class="sv-sub">Комплексная оценка технологической независимости по 9 измерениям</span>
      </div>
      <div class="sv-actions">
        <select v-model="selectedCo" class="sv-select">
          <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <button class="sv-btn primary" @click="generateReport">Сформировать отчёт</button>
      </div>
    </div>

    <!-- Радарный итог -->
    <div class="sv-summary-bar">
      <div class="sv-total-score" :class="scoreClass(totalScore)">
        <div class="ts-val">{{ totalScore }}</div>
        <div class="ts-lbl">Общий балл / 100</div>
        <div class="ts-verdict" :class="scoreClass(totalScore)">{{ verdict }}</div>
      </div>
      <div class="sv-dims-overview">
        <div v-for="d in dimensions" :key="d.id" class="dim-chip">
          <div class="dim-chip-score" :class="scoreClass(d.score * 10)">{{ d.score }}/10</div>
          <div class="dim-chip-name">{{ d.shortName }}</div>
        </div>
      </div>
    </div>

    <!-- 9 измерений -->
    <div class="sv-dims-grid">
      <div v-for="d in dimensions" :key="d.id" class="dim-card" :class="{ critical: d.score <= 3 }">
        <div class="dim-header">
          <div class="dim-num">D{{ d.id }}</div>
          <div class="dim-info">
            <div class="dim-name">{{ d.name }}</div>
            <div class="dim-desc">{{ d.desc }}</div>
          </div>
          <div class="dim-score-wrap">
            <input
              v-model.number="d.score"
              type="range"
              min="1"
              max="10"
              step="1"
              class="dim-slider"
              @input="recalc"
            />
            <div class="dim-score" :class="scoreClass(d.score * 10)">{{ d.score }}/10</div>
          </div>
        </div>
        <div class="dim-criteria">
          <div v-for="c in d.criteria" :key="c.label" class="criterion">
            <input type="checkbox" v-model="c.met" @change="recalc" />
            <span>{{ c.label }}</span>
            <span class="crit-weight">+{{ c.weight }} б.</span>
          </div>
        </div>
        <div v-if="d.score <= 4" class="dim-risk-alert">
          Критический риск: {{ d.riskDesc }}
        </div>
        <div class="dim-recommendation">
          <div class="dr-title">Рекомендация:</div>
          <div class="dr-text">{{ d.recommendation }}</div>
        </div>
      </div>
    </div>

    <!-- Сравнение с требованиями НПА -->
    <div class="sv-compliance">
      <h2>Соответствие регуляторным требованиям</h2>
      <table class="sv-table">
        <thead>
          <tr>
            <th>НПА</th>
            <th>Требование к суверенности</th>
            <th>Текущий балл</th>
            <th>Порог</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in regulatoryReqs" :key="r.npa">
            <td class="npa-code">{{ r.npa }}</td>
            <td>{{ r.requirement }}</td>
            <td class="num" :class="totalScore >= r.threshold ? 'green' : 'red'">{{ relevantScore(r.dims) }}</td>
            <td class="num">≥ {{ r.threshold }}</td>
            <td><span class="req-status" :class="totalScore >= r.threshold ? 'pass' : 'fail'">{{ totalScore >= r.threshold ? 'Соответствует' : 'Доработка' }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Дорожная карта улучшений -->
    <div class="sv-roadmap">
      <h2>Дорожная карта повышения суверенности</h2>
      <div class="rm-steps">
        <div v-for="(step, i) in roadmapSteps" :key="i" class="rm-step">
          <div class="rm-phase">{{ step.phase }}</div>
          <div class="rm-content">
            <div class="rm-title">{{ step.title }}</div>
            <div class="rm-dims">Измерения: {{ step.dims.join(', ') }}</div>
            <div class="rm-impact">+{{ step.scoreGain }} баллов к общему</div>
          </div>
          <div class="rm-deadline">{{ step.deadline }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const selectedCo = ref('agrodr')
const companies = ref([
  { id: 'agrodr',  name: 'АгроДрон'      },
  { id: 'robofarm', name: 'RoboFarm'      },
  { id: 'medtech', name: 'МедТех БПЛА'   }
])

const dimensions = ref([
  {
    id: 1, shortName: 'ПО',       name: 'D1 — Программное обеспечение',
    desc: 'Доля отечественного ПО в стеке компании',
    score: 7,
    riskDesc: 'Критическая зависимость от иностранного ПО',
    recommendation: 'Переход на РедОС/Astra Linux, замена СУБД на Postgres Pro',
    criteria: [
      { label: 'ОС на отечественной основе (РедОС/Astra)',     met: true,  weight: 2 },
      { label: 'СУБД отечественная (PostgresPro/YDB)',          met: true,  weight: 2 },
      { label: 'IDE и DevTools — российские аналоги',          met: false, weight: 1 },
      { label: 'ML-фреймворки без иностранной зависимости',    met: true,  weight: 2 },
      { label: 'Репозиторий кода на отечественном сервере',    met: true,  weight: 1 }
    ]
  },
  {
    id: 2, shortName: 'Железо',   name: 'D2 — Аппаратное обеспечение',
    desc: 'Российские чипы, сенсоры и комплектующие',
    score: 5,
    riskDesc: 'Зависимость от импортных микроконтроллеров',
    recommendation: 'Переход на Эльбрус/МЦСТ для наземных систем, российские БИНС',
    criteria: [
      { label: 'Процессоры российского производства',           met: false, weight: 3 },
      { label: 'Российские инерциальные датчики (БИНС)',       met: true,  weight: 2 },
      { label: 'Отечественные камеры/оптика',                   met: true,  weight: 2 },
      { label: 'Радиомодули российских производителей',        met: false, weight: 2 }
    ]
  },
  {
    id: 3, shortName: 'Данные',   name: 'D3 — Данные и облако',
    desc: 'Хранение и обработка данных на российской инфраструктуре',
    score: 8,
    riskDesc: 'Данные хранятся за рубежом',
    recommendation: 'Перевод на Яндекс.Облако или SberCloud, шифрование ГОСТ',
    criteria: [
      { label: 'Все данные хранятся в РФ',                     met: true,  weight: 3 },
      { label: 'Облачный провайдер российский (Яндекс/СБ)',    met: true,  weight: 2 },
      { label: 'Шифрование по ГОСТ 34.10/28147',               met: false, weight: 2 },
      { label: 'Резервное копирование в РФ',                   met: true,  weight: 1 }
    ]
  },
  {
    id: 4, shortName: 'Связь',    name: 'D4 — Коммуникации и связь',
    desc: 'Использование российских протоколов и операторов связи',
    score: 6,
    riskDesc: 'GPS-зависимость в навигации',
    recommendation: 'Интеграция ГЛОНАСС, российские SDK для связи, LoRa на российских чипах',
    criteria: [
      { label: 'ГЛОНАСС как основной навигационный сигнал',    met: true,  weight: 3 },
      { label: 'Российские операторы связи (МТС/Ростелеком)', met: true,  weight: 1 },
      { label: 'Отечественный стек шифрования каналов',        met: false, weight: 2 },
      { label: 'Работа без внешних сетей (offline режим)',      met: false, weight: 2 }
    ]
  },
  {
    id: 5, shortName: 'Кадры',    name: 'D5 — Кадры и компетенции',
    desc: 'Локализация ключевых компетенций в РФ',
    score: 9,
    riskDesc: 'Зависимость от иностранных специалистов',
    recommendation: 'Поддерживать текущий уровень, развивать школу наставничества',
    criteria: [
      { label: '>90% R&D команды — граждане РФ',               met: true,  weight: 3 },
      { label: 'Партнёрство с российскими вузами (МФТИ/МГУ)', met: true,  weight: 2 },
      { label: 'Программа подготовки внутри компании',         met: true,  weight: 2 },
      { label: 'Нет критической зависимости от 1 специалиста', met: true,  weight: 1 }
    ]
  },
  {
    id: 6, shortName: 'Финансы',  name: 'D6 — Финансовая независимость',
    desc: 'Независимость от иностранного финансирования',
    score: 10,
    riskDesc: 'Иностранные инвесторы с правом блокировки',
    recommendation: 'Поддерживать 100% российское финансирование',
    criteria: [
      { label: '100% инвесторов — российские юрлица',          met: true,  weight: 3 },
      { label: 'Расчёты в рублях / криптовалюта РФ',           met: true,  weight: 2 },
      { label: 'Банковские счета в российских банках',          met: true,  weight: 2 },
      { label: 'Нет иностранных займов',                        met: true,  weight: 1 }
    ]
  },
  {
    id: 7, shortName: 'IP',       name: 'D7 — Интеллектуальная собственность',
    desc: 'Патенты и ИС зарегистрированы в России',
    score: 7,
    riskDesc: 'Риск потери ИС при санкциях',
    recommendation: 'Регистрация ключевых алгоритмов в Роспатент, защита ноу-хау',
    criteria: [
      { label: 'Патенты в Роспатент (>3)',                     met: true,  weight: 3 },
      { label: 'Open-source компоненты проверены на лицензии', met: true,  weight: 1 },
      { label: 'Trade secrets в российской юрисдикции',        met: false, weight: 2 },
      { label: 'NDA и трудовые договора по ГК РФ',             met: true,  weight: 1 }
    ]
  },
  {
    id: 8, shortName: 'Производство', name: 'D8 — Производственная база',
    desc: 'Локализация производства БПЛА в России',
    score: 6,
    riskDesc: 'Зависимость от зарубежных комплектующих >40%',
    recommendation: 'Сертификация в реестре отечественных БПЛА (ПП-1726), локализация >80%',
    criteria: [
      { label: 'Производство на российских мощностях',         met: true,  weight: 3 },
      { label: 'Локализация >60% по стоимости',                met: false, weight: 3 },
      { label: 'Включён в реестр отечественных БПЛА',          met: false, weight: 2 }
    ]
  },
  {
    id: 9, shortName: 'Стандарты', name: 'D9 — Стандарты и сертификация',
    desc: 'Соответствие российским ГОСТам и нормативам',
    score: 5,
    riskDesc: 'Отсутствие российской сертификации',
    recommendation: 'Прохождение ГОСТ Р сертификации для коммерческой эксплуатации',
    criteria: [
      { label: 'ГОСТ Р сертификация пройдена',                 met: false, weight: 4 },
      { label: 'Соответствие требованиям Росавиации',           met: true,  weight: 3 },
      { label: 'ISO 9001 или аналог (СМК)',                    met: false, weight: 1 }
    ]
  }
])

const totalScore = computed(() => {
  return Math.round(dimensions.value.reduce((s, d) => s + d.score, 0) / dimensions.value.length * 10)
})

function scoreClass(score) {
  if (score >= 70) return 'score-high'
  if (score >= 50) return 'score-mid'
  return 'score-low'
}

const verdict = computed(() => {
  if (totalScore.value >= 80) return 'СУВЕРЕННЫЙ'
  if (totalScore.value >= 60) return 'В ПРОЦЕССЕ'
  if (totalScore.value >= 40) return 'ЗАВИСИМЫЙ'
  return 'КРИТИЧЕСКАЯ ЗАВИСИМОСТЬ'
})

const regulatoryReqs = ref([
  { npa: 'НПА-34 Суверен. ПО', requirement: 'ПО D1 ≥ 6/10', dims: [1], threshold: 60 },
  { npa: 'ПП-1726 Реестр БПЛА', requirement: 'Производство D8 ≥ 7/10', dims: [8], threshold: 70 },
  { npa: 'ФЗ-149 ИБ',          requirement: 'Данные+Связь D3+D4 ≥ 7', dims: [3, 4], threshold: 70 }
])

function relevantScore(dims) {
  const relevant = dimensions.value.filter(d => dims.includes(d.id))
  return Math.round(relevant.reduce((s, d) => s + d.score, 0) / relevant.length * 10)
}

const roadmapSteps = ref([
  { phase: 'Q2 2026', title: 'Сертификация ГОСТ Р и Росавиация',            dims: ['D9'], scoreGain: 4, deadline: 'Июнь 2026' },
  { phase: 'Q3 2026', title: 'Переход на российские процессоры (Эльбрус)', dims: ['D2'], scoreGain: 3, deadline: 'Сент. 2026' },
  { phase: 'Q4 2026', title: 'Включение в реестр отечественных БПЛА',      dims: ['D8'], scoreGain: 5, deadline: 'Дек. 2026' },
  { phase: 'Q1 2027', title: 'Шифрование ГОСТ + offline-режим связи',      dims: ['D3', 'D4'], scoreGain: 4, deadline: 'Март 2027' }
])

function recalc() {}
function generateReport() { window.print() }
</script>

<style scoped>
.sv-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--surface-ground); }
.sv-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.sv-header h1 { margin: 0; font-size: 1.75rem; color: var(--p-text-color); }
.sv-sub { font-size: 0.9375rem; color: var(--p-text-muted-color); }
.sv-actions { display: flex; gap: 8px; align-items: center; }
.sv-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.sv-btn.primary { background: var(--p-primary-color); color: #fff; }
.sv-select { padding: 7px 10px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-color); font-size: 0.83rem; }

.sv-summary-bar { display: flex; align-items: center; gap: 20px; background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 16px 20px; flex-wrap: wrap; }
.sv-total-score { text-align: center; min-width: 90px; }
.ts-val { font-size: 2.5rem; font-weight: 900; }
.ts-lbl { font-size: 0.72rem; color: var(--p-text-muted-color); }
.ts-verdict { font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 4px; display: inline-block; }
.score-high .ts-val { color: #66bb6a; }
.score-high .ts-verdict { background: #66bb6a22; color: #66bb6a; }
.score-mid  .ts-val { color: #ff9800; }
.score-mid  .ts-verdict { background: #ff980022; color: #ff9800; }
.score-low  .ts-val { color: #ef5350; }
.score-low  .ts-verdict { background: #ef535022; color: #ef5350; }

.sv-dims-overview { display: flex; gap: 8px; flex-wrap: wrap; flex: 1; }
.dim-chip { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.dim-chip-score { font-size: 0.78rem; font-weight: 700; padding: 3px 6px; border-radius: 4px; }
.dim-chip-score.score-high { background: #66bb6a22; color: #66bb6a; }
.dim-chip-score.score-mid  { background: #ff980022; color: #ff9800; }
.dim-chip-score.score-low  { background: #ef535022; color: #ef5350; }
.dim-chip-name { font-size: 0.65rem; color: var(--p-text-muted-color); }

.sv-dims-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
.dim-card { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.dim-card.critical { border-color: #ef5350; }
.dim-header { display: flex; align-items: flex-start; gap: 10px; }
.dim-num { font-size: 1rem; font-weight: 900; color: var(--p-primary-color); min-width: 28px; }
.dim-info { flex: 1; }
.dim-name { font-weight: 700; font-size: 0.88rem; color: var(--p-text-color); }
.dim-desc { font-size: 0.72rem; color: var(--p-text-muted-color); margin-top: 2px; }
.dim-score-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; min-width: 80px; }
.dim-slider { width: 70px; accent-color: var(--p-primary-color); }
.dim-score { font-size: 0.85rem; font-weight: 700; }
.dim-score.score-high { color: #66bb6a; }
.dim-score.score-mid  { color: #ff9800; }
.dim-score.score-low  { color: #ef5350; }

.dim-criteria { display: flex; flex-direction: column; gap: 5px; }
.criterion { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--p-text-color); }
.criterion input { accent-color: var(--p-primary-color); }
.crit-weight { margin-left: auto; font-size: 0.68rem; color: var(--p-text-muted-color); white-space: nowrap; }
.dim-risk-alert { background: #ef535018; border: 1px solid #ef535044; border-radius: 6px; padding: 6px 10px; font-size: 0.75rem; color: #ef5350; }
.dim-recommendation { background: var(--surface-ground); border-radius: 6px; padding: 8px 10px; }
.dr-title { font-size: 0.68rem; color: var(--p-text-muted-color); font-weight: 700; margin-bottom: 2px; }
.dr-text  { font-size: 0.75rem; color: var(--p-text-color); }

.sv-compliance, .sv-roadmap { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 18px; }
.sv-compliance h2, .sv-roadmap h2 { margin: 0 0 14px; font-size: 1.05rem; color: var(--p-text-color); }
.sv-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
.sv-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--surface-border); font-size: 0.75rem; }
.sv-table td { padding: 8px 10px; border-bottom: 1px solid var(--surface-border); color: var(--p-text-color); }
.npa-code { font-weight: 600; color: var(--p-primary-color); }
.num { text-align: right; } .green { color: #66bb6a; } .red { color: #ef5350; }
.req-status { padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; }
.req-status.pass { background: #66bb6a22; color: #66bb6a; }
.req-status.fail { background: #ef535022; color: #ef5350; }

.rm-steps { display: flex; flex-direction: column; gap: 8px; }
.rm-step { display: flex; align-items: center; gap: 14px; background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 12px; }
.rm-phase { font-size: 0.72rem; font-weight: 700; color: var(--p-primary-color); min-width: 70px; }
.rm-content { flex: 1; }
.rm-title { font-weight: 600; font-size: 0.85rem; color: var(--p-text-color); }
.rm-dims { font-size: 0.72rem; color: var(--p-text-muted-color); }
.rm-impact { font-size: 0.72rem; color: #66bb6a; margin-top: 2px; }
.rm-deadline { font-size: 0.72rem; color: var(--p-text-muted-color); white-space: nowrap; }
</style>
