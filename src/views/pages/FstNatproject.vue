<template>
  <div class="np-root">
    <div class="np-header">
      <div>
        <h1>Нацпроект БАС 2024–2030</h1>
        <span class="np-sub">Соответствие портфеля ФСТ НТИ целевым показателям Национального проекта</span>
      </div>
      <div class="np-actions">
        <button class="np-btn secondary" @click="exportReport">Отчёт соответствия</button>
      </div>
    </div>

    <!-- Прогресс по годам -->
    <div class="np-timeline">
      <div v-for="year in years" :key="year.y" class="np-year" :class="{ current: year.current, past: year.y < 2026 }">
        <div class="ny-label">{{ year.y }}</div>
        <div class="ny-bar">
          <div class="ny-fill" :style="{ height: year.pct + '%', background: year.current ? 'var(--p-primary-color)' : year.y < 2026 ? '#66bb6a' : 'var(--p-surface-border)' }"></div>
        </div>
        <div class="ny-pct">{{ year.pct }}%</div>
      </div>
    </div>

    <!-- KPI Нацпроекта -->
    <div class="np-kpis">
      <div v-for="kpi in natkpis" :key="kpi.label" class="np-kpi-card">
        <div class="nk-header">
          <div class="nk-label">{{ kpi.label }}</div>
          <span class="nk-status" :class="kpiStatus(kpi)">{{ kpiStatusLabel(kpi) }}</span>
        </div>
        <div class="nk-progress">
          <div class="nk-bar-track">
            <div class="nk-bar" :style="{ width: Math.min(100, kpi.current / kpi.target2030 * 100) + '%', background: kpiColor(kpi) }"></div>
            <div class="nk-target-mark" :style="{ left: kpi.target2026 / kpi.target2030 * 100 + '%' }" :title="'2026: ' + kpi.target2026 + kpi.unit"></div>
          </div>
        </div>
        <div class="nk-vals">
          <div class="nk-current">Факт: <strong>{{ kpi.current }}{{ kpi.unit }}</strong></div>
          <div class="nk-target26">Цель 2026: {{ kpi.target2026 }}{{ kpi.unit }}</div>
          <div class="nk-target30">Цель 2030: {{ kpi.target2030 }}{{ kpi.unit }}</div>
        </div>
        <div class="nk-portfolio">Вклад портфеля ФСТ: {{ kpi.fstContrib }}{{ kpi.unit }}</div>
      </div>
    </div>

    <!-- Таблица соответствия -->
    <div class="np-section">
      <h2>Мероприятия Нацпроекта — портфель ФСТ</h2>
      <table class="np-table">
        <thead>
          <tr>
            <th>Мероприятие НП</th>
            <th>Компания ФСТ</th>
            <th>Роль</th>
            <th>Вклад</th>
            <th>Статус</th>
            <th>Срок</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in measures" :key="m.id">
            <td class="m-name">{{ m.measure }}</td>
            <td class="m-co">{{ m.company }}</td>
            <td class="m-role">{{ m.role }}</td>
            <td class="m-contrib">{{ m.contribution }}</td>
            <td><span class="m-status" :class="m.status">{{ mStatusLabel(m.status) }}</span></td>
            <td class="m-date">{{ m.deadline }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Структура НП -->
    <div class="np-section">
      <h2>Федеральные проекты Нацпроекта БАС</h2>
      <div class="fp-grid">
        <div v-for="fp in fedProjects" :key="fp.name" class="fp-card">
          <div class="fp-code">{{ fp.code }}</div>
          <div class="fp-name">{{ fp.name }}</div>
          <div class="fp-budget">{{ fp.budget }} млрд ₽</div>
          <div class="fp-desc">{{ fp.desc }}</div>
          <div class="fp-fst" v-if="fp.fstRelevant">
            <span class="fp-badge">Портфель ФСТ участвует</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const years = ref([
  { y: 2024, pct: 100, current: false },
  { y: 2025, pct: 100, current: false },
  { y: 2026, pct: 42,  current: true  },
  { y: 2027, pct: 0,   current: false },
  { y: 2028, pct: 0,   current: false },
  { y: 2029, pct: 0,   current: false },
  { y: 2030, pct: 0,   current: false }
])

const natkpis = ref([
  { label: 'Производство БПЛА в РФ, тыс. ед./год',   current: 32,   target2026: 75,   target2030: 900,  unit: 'тыс.', fstContrib: 4 },
  { label: 'Объём рынка БАС, млрд ₽',                current: 28,   target2026: 60,   target2030: 1000, unit: 'млрд', fstContrib: 6 },
  { label: 'Эксплуатационные компании в реестре',    current: 1240, target2026: 3000, target2030: 20000, unit: '',    fstContrib: 8 },
  { label: 'Испытательных полигонов',                 current: 4,    target2026: 10,   target2030: 30,   unit: '',    fstContrib: 1 },
  { label: 'Подготовлено пилотов, тыс. чел.',        current: 8,    target2026: 20,   target2030: 100,  unit: 'тыс.', fstContrib: 0.5 },
  { label: 'Инвестиции в сектор, млрд ₽/год',       current: 12,   target2026: 30,   target2030: 250,  unit: 'млрд', fstContrib: 2.1 }
])

function kpiStatus(k) {
  const ratio = k.current / k.target2026
  return ratio >= 0.7 ? 'on-track' : ratio >= 0.4 ? 'lagging' : 'critical'
}
function kpiStatusLabel(k) {
  return { 'on-track': 'По плану', lagging: 'Отставание', critical: 'Критично' }[kpiStatus(k)]
}
function kpiColor(k) {
  const s = kpiStatus(k)
  return { 'on-track': '#66bb6a', lagging: '#ff9800', critical: '#ef5350' }[s]
}

const measures = ref([
  { id: 1, measure: 'Создание производственных кластеров БАС',    company: 'АгроДрон',       role: 'Резидент кластера',    contribution: 'БПЛА для АПК',       status: 'active',  deadline: '2027-12' },
  { id: 2, measure: 'Реестр отечественных БПЛА (ПП-1726)',        company: 'DroneLogistics', role: 'Заявитель',            contribution: 'Грузовая платформа', status: 'review',  deadline: '2026-06' },
  { id: 3, measure: 'Развитие инфраструктуры (U-space)',          company: 'CyberPilot',     role: 'Разработчик ПО UTM',   contribution: 'UTM-система',        status: 'active',  deadline: '2028-12' },
  { id: 4, measure: 'Подготовка кадров (образоват. программы)',   company: 'МедТех БПЛА',    role: 'Партнёр программы',    contribution: 'Стажировки 50/год',  status: 'planned', deadline: '2027-01' },
  { id: 5, measure: 'НИОКР суверенных компонентов',               company: 'RoboFarm',       role: 'Исполнитель НИОКР',    contribution: 'Российские актуат.', status: 'active',  deadline: '2026-12' },
  { id: 6, measure: 'Экспортный трек (дружественные страны)',    company: 'АгроДрон',       role: 'Экспортёр',            contribution: 'Пилот ОАЭ/Египет',  status: 'planned', deadline: '2027-06' }
])

function mStatusLabel(s) { return { active: 'Активно', review: 'На проверке', planned: 'Запланировано', done: 'Выполнено' }[s] || s }

const fedProjects = ref([
  { code: 'ФП-1', name: 'Стимулирование спроса',        budget: 45.2, desc: 'Госзакупки БПЛА, субсидии для применения в госсекторе', fstRelevant: true  },
  { code: 'ФП-2', name: 'Развитие производства',        budget: 62.8, desc: 'Кластеры, НИОКР, инфраструктура производства БПЛА',    fstRelevant: true  },
  { code: 'ФП-3', name: 'Инфраструктура (U-space)',     budget: 38.1, desc: 'Системы управления воздушным пространством, UTM',      fstRelevant: true  },
  { code: 'ФП-4', name: 'Кадры для БАС',               budget: 18.4, desc: 'Образовательные программы, профессиональные стандарты', fstRelevant: false },
  { code: 'ФП-5', name: 'Нормативная база',             budget: 5.6,  desc: 'Разработка НПА, ГОСТов, сертификационных процедур',    fstRelevant: false },
  { code: 'ФП-6', name: 'Экспортный потенциал',        budget: 12.0, desc: 'Международное продвижение российских БПЛА',             fstRelevant: true  }
])

function exportReport() { alert('Экспорт отчёта соответствия Нацпроекту БАС') }
</script>

<style scoped>
.np-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--p-surface-ground); }
.np-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.np-header h1 { margin: 0; font-size: 1.75rem; color: var(--p-text-color); }
.np-sub { font-size: 0.9375rem; color: var(--p-text-muted-color); }
.np-actions { display: flex; gap: 8px; }
.np-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.np-btn.secondary { background: var(--p-surface-card); color: var(--p-text-color); border: 1px solid var(--p-surface-border); }

.np-timeline { display: flex; align-items: flex-end; gap: 8px; background: var(--p-content-background); border: 1px solid var(--p-surface-border); border-radius: 10px; padding: 20px; height: 160px; }
.np-year { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; height: 100%; }
.ny-label { font-size: 0.75rem; font-weight: 600; color: var(--p-text-color); }
.ny-bar { flex: 1; width: 32px; background: var(--p-surface-border); border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
.ny-fill { width: 100%; border-radius: 4px; transition: height 0.5s; }
.np-year.current .ny-bar { border: 2px solid var(--p-primary-color); }
.ny-pct { font-size: 0.68rem; color: var(--p-text-muted-color); }

.np-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.np-kpi-card { background: var(--p-content-background); border: 1px solid var(--p-surface-border); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.nk-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.nk-label { font-weight: 600; font-size: 0.83rem; color: var(--p-text-color); flex: 1; }
.nk-status { font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
.nk-status.on-track { background: #66bb6a22; color: #66bb6a; }
.nk-status.lagging  { background: #ff980022; color: #ff9800; }
.nk-status.critical { background: #ef535022; color: #ef5350; }
.nk-bar-track { position: relative; height: 10px; background: var(--p-surface-border); border-radius: 5px; overflow: hidden; }
.nk-bar { height: 100%; border-radius: 5px; transition: width 0.5s; }
.nk-target-mark { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--p-text-muted-color); border-radius: 1px; }
.nk-vals { display: flex; gap: 10px; font-size: 0.72rem; flex-wrap: wrap; }
.nk-current { color: var(--p-text-color); }
.nk-current strong { color: var(--p-primary-color); }
.nk-target26, .nk-target30 { color: var(--p-text-muted-color); }
.nk-portfolio { font-size: 0.72rem; color: var(--p-primary-color); font-weight: 600; border-top: 1px solid var(--p-surface-border); padding-top: 6px; }

.np-section { background: var(--p-content-background); border: 1px solid var(--p-surface-border); border-radius: 10px; padding: 18px; overflow-x: auto; }
.np-section h2 { margin: 0 0 14px; font-size: 1.05rem; color: var(--p-text-color); }
.np-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 640px; }
.np-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-surface-border); font-size: 0.72rem; }
.np-table td { padding: 8px 10px; border-bottom: 1px solid var(--p-surface-border); color: var(--p-text-color); }
.m-name { font-weight: 600; }
.m-co { font-size: 0.75rem; color: var(--p-primary-color); font-weight: 600; }
.m-role, .m-contrib { font-size: 0.75rem; color: var(--p-text-muted-color); }
.m-date { font-size: 0.75rem; color: var(--p-text-muted-color); }
.m-status { padding: 2px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; }
.m-status.active  { background: #66bb6a22; color: #66bb6a; }
.m-status.review  { background: #42a5f522; color: #42a5f5; }
.m-status.planned { background: var(--p-surface-ground); color: var(--p-text-muted-color); border: 1px solid var(--p-surface-border); }
.m-status.done    { background: #66bb6a44; color: #66bb6a; }

.fp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.fp-card { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 5px; }
.fp-code { font-weight: 900; font-size: 0.82rem; color: var(--p-primary-color); }
.fp-name { font-weight: 700; font-size: 0.88rem; color: var(--p-text-color); }
.fp-budget { font-size: 1rem; font-weight: 700; color: var(--p-text-color); }
.fp-desc { font-size: 0.72rem; color: var(--p-text-muted-color); }
.fp-badge { display: inline-block; font-size: 0.65rem; padding: 2px 8px; border-radius: 4px; background: var(--p-primary-color); color: #fff; margin-top: 4px; }
</style>
