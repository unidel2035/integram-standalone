<template>
  <div class="fst-hub">
    <!-- Hero -->
    <div class="fst-hub-hero">
      <div class="fst-hub-hero-bg"></div>
      <div class="fst-hub-hero-content">
        <div class="fst-hub-badge">
          <span class="fst-hub-badge-dot"></span>
          Система активна · {{ now }}
        </div>
        <h1 class="fst-hub-title">Фонд Суверенных Технологий НТИ</h1>
        <p class="fst-hub-subtitle">
          AI-платформа управления венчурным портфелем: от оценки заявок до мониторинга компаний в реальном времени
        </p>
        <div class="fst-hub-stats">
          <div class="fst-hub-stat">
            <span class="fst-hub-stat-val">6.4 млрд ₽</span>
            <span class="fst-hub-stat-label">AUM портфеля</span>
          </div>
          <div class="fst-hub-stat-sep"></div>
          <div class="fst-hub-stat">
            <span class="fst-hub-stat-val">7</span>
            <span class="fst-hub-stat-label">Портфельных компаний</span>
          </div>
          <div class="fst-hub-stat-sep"></div>
          <div class="fst-hub-stat">
            <span class="fst-hub-stat-val">3</span>
            <span class="fst-hub-stat-label">Субфонда</span>
          </div>
          <div class="fst-hub-stat-sep"></div>
          <div class="fst-hub-stat">
            <span class="fst-hub-stat-val">38%</span>
            <span class="fst-hub-stat-label">IRR прогноз</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Pipeline flow -->
    <div class="fst-hub-pipeline">
      <div v-for="(step, idx) in pipeline" :key="step.id" class="fst-pipeline-step" @click="go(step.path)">
        <div class="fst-pipeline-arrow" v-if="idx > 0">
          <i class="pi pi-arrow-right"></i>
        </div>
        <div class="fst-pipeline-card" :style="{ borderTopColor: step.color }">
          <div class="fst-pipeline-icon" :style="{ background: step.color + '20', color: step.color }">
            <i :class="step.icon"></i>
          </div>
          <div class="fst-pipeline-num">{{ idx + 1 }}</div>
          <div class="fst-pipeline-name">{{ step.name }}</div>
          <div class="fst-pipeline-sub">{{ step.sub }}</div>
        </div>
      </div>
    </div>

    <!-- Main modules grid -->
    <div class="fst-hub-body">
      <div class="fst-hub-section-title">Модули платформы</div>
      <div class="fst-hub-grid">
        <div v-for="mod in modules" :key="mod.id"
          class="fst-hub-card" :class="{ featured: mod.featured }"
          @click="go(mod.path)">
          <div class="fst-hub-card-header">
            <div class="fst-hub-card-icon" :style="{ background: mod.color + '18', color: mod.color }">
              <i :class="mod.icon" style="font-size:22px"></i>
            </div>
            <div class="fst-hub-card-badges">
              <span v-if="mod.featured" class="fst-hub-badge-featured">Ключевой</span>
              <span class="fst-hub-status" :class="mod.status">{{ statusLabel(mod.status) }}</span>
            </div>
          </div>
          <div class="fst-hub-card-phase">{{ mod.phase }}</div>
          <div class="fst-hub-card-name">{{ mod.name }}</div>
          <div class="fst-hub-card-desc">{{ mod.desc }}</div>
          <div class="fst-hub-card-tags">
            <span v-for="t in mod.tags" :key="t" class="fst-hub-tag">{{ t }}</span>
          </div>
          <div class="fst-hub-card-footer">
            <span class="fst-hub-card-path">{{ mod.path }}</span>
            <i class="pi pi-arrow-up-right" style="font-size:12px;color:var(--p-text-muted-color)"></i>
          </div>
        </div>
      </div>

      <!-- Supporting tools -->
      <div class="fst-hub-section-title" style="margin-top:24px">Дополнительные инструменты</div>
      <div class="fst-hub-tools">
        <div v-for="tool in tools" :key="tool.id" class="fst-hub-tool" @click="go(tool.path)">
          <i :class="tool.icon" :style="{ color: tool.color, fontSize:'18px' }"></i>
          <div class="fst-hub-tool-info">
            <div class="fst-hub-tool-name">{{ tool.name }}</div>
            <div class="fst-hub-tool-desc">{{ tool.desc }}</div>
          </div>
          <i class="pi pi-chevron-right" style="font-size:11px;color:var(--p-text-muted-color);margin-left:auto"></i>
        </div>
      </div>
    </div>

    <!-- Footer nav -->
    <div class="fst-hub-footer">
      <div class="fst-hub-footer-left">
        <i class="pi pi-shield" style="color:#ffa726"></i>
        <span>ФСТ НТИ · Суверенная AI-платформа управления активами · <b>v2026.03</b></span>
      </div>
      <div class="fst-hub-footer-right">
        <span style="color:var(--p-text-muted-color);font-size:11px">Powered by DronDoc Platform</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const now = ref(new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }))

function go(path) {
  router.push(path)
}

function statusLabel(s) {
  return { live: 'Live', demo: 'Demo', beta: 'Beta' }[s] || s
}

const pipeline = [
  { id: 1, name: 'Заявка', sub: 'Компания подаёт проект', icon: 'pi pi-file', color: '#42a5f5', path: '/fst-committee' },
  { id: 2, name: 'Инвесткомитет', sub: '6 AI-агентов дебатируют', icon: 'pi pi-users', color: '#ab47bc', path: '/fst-committee' },
  { id: 3, name: 'Сделка', sub: 'Term Sheet · SPV · Транши', icon: 'pi pi-file-edit', color: '#ffa726', path: '/fst-deal' },
  { id: 4, name: 'Исполнение', sub: 'Задачи · KPI · Транши', icon: 'pi pi-list-check', color: '#26c6da', path: '/fst-execution' },
  { id: 5, name: 'Мониторинг', sub: 'Онлайн-риски · Светофор', icon: 'pi pi-chart-scatter', color: '#66bb6a', path: '/fst-portfolio' },
  { id: 6, name: 'Выход', sub: 'MOIC · IRR · DPI', icon: 'pi pi-flag', color: '#ef5350', path: '/fst-fund' },
]

const modules = [
  {
    id: 'committee',
    name: 'AI Инвесткомитет',
    phase: 'Фаза 1 — Оценка проекта',
    icon: 'pi pi-users',
    color: '#ab47bc',
    path: '/fst-committee',
    featured: true,
    status: 'live',
    desc: '6 AI-агентов дебатируют проект: технолог, финансист, суверенность, риск, стратег, адвокат дьявола. Многораундовые дебаты, голосование, решение ИК.',
    tags: ['AI', 'Дебаты', 'Голосование', 'Суверенность', 'TRL/MRL'],
  },
  {
    id: 'deal',
    name: 'Доведение сделки',
    phase: 'Фаза 2 — Структурирование',
    icon: 'pi pi-file-edit',
    color: '#ffa726',
    path: '/fst-deal',
    featured: true,
    status: 'live',
    desc: 'Параметры equity/CLN/грант, SPV, транши с KPI-триггерами, права инвестора, автогенерация Term Sheet. Встроенная финмодель с NPV / MOIC / IRR.',
    tags: ['Term Sheet', 'SPV', 'Транши', 'Финмодель', 'AI'],
  },
  {
    id: 'execution',
    name: 'Исполнение сделки',
    phase: 'Фаза 3 — Постинвестиционная',
    icon: 'pi pi-list-check',
    color: '#26c6da',
    path: '/fst-execution',
    featured: true,
    status: 'live',
    desc: 'Kanban задач компании по 6 категориям, KPI-прогресс по месяцам, условия разблокировки транша 2, действия ФСТ (предупреждение, ментор, блокировка).',
    tags: ['Задачи', 'KPI', 'Транши', 'Симуляция', 'Мониторинг'],
  },
  {
    id: 'portfolio',
    name: 'Портфельный монитор',
    phase: 'Фаза 4 — Онлайн-мониторинг',
    icon: 'pi pi-chart-scatter',
    color: '#66bb6a',
    path: '/fst-portfolio',
    featured: true,
    status: 'live',
    desc: 'Светофор рисков по всем компаниям, датчики ЕГРЮЛ / Роспатент / HH.ru, прогресс KPI, AI-еженедельный отчёт, созыв ИК при критических рисках.',
    tags: ['Светофор', 'ЕГРЮЛ', 'AI-отчёт', 'Runway', 'Риски'],
  },
  {
    id: 'fund',
    name: 'Цифровой двойник фонда',
    phase: 'Фаза 5 — Фонд-индекс',
    icon: 'pi pi-building',
    color: '#42a5f5',
    path: '/fst-fund',
    featured: false,
    status: 'live',
    desc: '7 компаний · 3 субфонда (БАС/РОБО/МЭ) · NAV · ROI · матрица здоровья · квартальные чарты · AI-прогноз IRR/DPI 2026-2027.',
    tags: ['NAV', 'IRR', 'DPI', 'Субфонды', 'ЦД'],
  },
  {
    id: 'twin',
    name: 'Цифровой двойник компании',
    phase: 'Фаза 3 — Микро-мониторинг',
    icon: 'pi pi-desktop',
    color: '#ef5350',
    path: '/fst-twin',
    featured: false,
    status: 'live',
    desc: 'Live-симуляция АвиаЛогик: выручка, burn rate, TRL/MRL/суверенность, датчики рисков, смарт-контракт с траншами, AI-прогноз выживаемости.',
    tags: ['Симуляция', 'Tick-engine', 'Смарт-контракт', 'AI'],
  },
]

const tools = [
  {
    id: 'simulator',
    name: 'НТИ Фонд Симулятор',
    desc: 'Стратегическая игра: 9 рынков НТИ, Wright\'s Law, Леонтьев, фонд-индекс',
    icon: 'pi pi-server',
    color: '#78909c',
    path: '/nti-simulator',
  },
  {
    id: 'presentation',
    name: 'НТИ Презентация',
    desc: 'Инвестиционная презентация для Малкова и Пескова',
    icon: 'pi pi-bookmark',
    color: '#78909c',
    path: '/nti-presentation',
  },
  {
    id: 'finmodel',
    name: 'Редактор финмоделей',
    desc: 'Полный блочный редактор с HyperFormula (389 Excel-функций)',
    icon: 'pi pi-table',
    color: '#78909c',
    path: '/finmodel',
  },
  {
    id: 'onto',
    name: 'Онтология БПЛА',
    desc: '~1140 концептов, граф связей, SKOS, импорт OWL',
    icon: 'pi pi-sitemap',
    color: '#78909c',
    path: '/onto',
  },
]
</script>

<style scoped>
.fst-hub {
  background: var(--p-surface-ground);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--p-font-family);
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
.fst-hub-hero {
  position: relative;
  padding: 48px 32px 40px;
  overflow: hidden;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-surface-border);
}
.fst-hub-hero-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 80% at 80% 50%, rgba(255,167,38,0.08) 0%, transparent 70%),
    radial-gradient(ellipse 40% 60% at 20% 30%, rgba(66,165,245,0.07) 0%, transparent 60%);
  pointer-events: none;
}
.fst-hub-hero-content {
  position: relative;
  max-width: 900px;
}
.fst-hub-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--p-text-muted-color);
  background: var(--p-surface-ground);
  border: 1px solid var(--p-surface-border);
  border-radius: 20px;
  padding: 4px 14px;
  margin-bottom: 16px;
}
.fst-hub-badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #66bb6a;
  box-shadow: 0 0 6px #66bb6a;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.fst-hub-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--p-text-color);
  margin: 0 0 10px;
  line-height: 1.2;
}
.fst-hub-subtitle {
  font-size: 15px;
  color: var(--p-text-muted-color);
  margin: 0 0 24px;
  max-width: 620px;
  line-height: 1.6;
}
.fst-hub-stats {
  display: flex;
  align-items: center;
  gap: 0;
  flex-wrap: wrap;
}
.fst-hub-stat { padding: 0 24px 0 0; }
.fst-hub-stat:first-child { padding-left: 0; }
.fst-hub-stat-val {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: var(--p-text-color);
  line-height: 1.2;
}
.fst-hub-stat-label {
  display: block;
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}
.fst-hub-stat-sep {
  width: 1px;
  height: 36px;
  background: var(--p-surface-border);
  margin-right: 24px;
}

/* ── Pipeline ─────────────────────────────────────────────────────────────── */
.fst-hub-pipeline {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  background: var(--p-surface-card);
  border-bottom: 2px solid var(--p-surface-border);
  overflow-x: auto;
  gap: 0;
  flex-shrink: 0;
}
.fst-pipeline-step {
  display: flex;
  align-items: center;
  gap: 0;
}
.fst-pipeline-arrow {
  font-size: 12px;
  color: var(--p-text-muted-color);
  padding: 0 8px;
  flex-shrink: 0;
}
.fst-pipeline-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 18px;
  background: var(--p-surface-ground);
  border-radius: 8px;
  border-top: 3px solid #78909c;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 110px;
  position: relative;
}
.fst-pipeline-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}
.fst-pipeline-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  margin-bottom: 6px;
}
.fst-pipeline-num {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 10px;
  color: var(--p-text-muted-color);
  font-weight: 600;
}
.fst-pipeline-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
  text-align: center;
}
.fst-pipeline-sub {
  font-size: 10px;
  color: var(--p-text-muted-color);
  text-align: center;
  margin-top: 2px;
}

/* ── Body ─────────────────────────────────────────────────────────────────── */
.fst-hub-body {
  padding: 24px;
  flex: 1;
}
.fst-hub-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-muted-color);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 14px;
}

/* ── Module Cards ─────────────────────────────────────────────────────────── */
.fst-hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}
.fst-hub-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  padding: 18px;
  cursor: pointer;
  transition: all 0.18s;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fst-hub-card:hover {
  border-color: var(--p-primary-color);
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(0,0,0,0.1);
}
.fst-hub-card.featured {
  border-left: 3px solid var(--p-primary-color);
}
.fst-hub-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.fst-hub-card-icon {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fst-hub-card-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-direction: column;
  align-items: flex-end;
}
.fst-hub-badge-featured {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(var(--p-primary-rgb), 0.15);
  color: var(--p-primary-color);
  font-weight: 600;
}
.fst-hub-status {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}
.fst-hub-status.live { background: rgba(102,187,106,0.15); color: #66bb6a; }
.fst-hub-status.demo { background: rgba(255,167,38,0.15); color: #ffa726; }
.fst-hub-status.beta { background: rgba(66,165,245,0.15); color: #42a5f5; }

.fst-hub-card-phase {
  font-size: 10px;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 500;
}
.fst-hub-card-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--p-text-color);
  line-height: 1.2;
}
.fst-hub-card-desc {
  font-size: 12px;
  color: var(--p-text-muted-color);
  line-height: 1.6;
  flex: 1;
}
.fst-hub-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.fst-hub-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-surface-border);
  color: var(--p-text-muted-color);
}
.fst-hub-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid var(--p-surface-border);
}
.fst-hub-card-path {
  font-size: 11px;
  color: var(--p-primary-color);
  font-family: monospace;
}

/* ── Tools ────────────────────────────────────────────────────────────────── */
.fst-hub-tools {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 700px;
}
.fst-hub-tool {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.fst-hub-tool:hover {
  border-color: var(--p-primary-color);
  background: var(--p-surface-ground);
}
.fst-hub-tool-info { flex: 1; }
.fst-hub-tool-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
}
.fst-hub-tool-desc {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-top: 1px;
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
.fst-hub-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-top: 1px solid var(--p-surface-border);
  background: var(--p-surface-card);
  font-size: 12px;
  color: var(--p-text-muted-color);
  flex-wrap: wrap;
  gap: 8px;
}
.fst-hub-footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .fst-hub-hero { padding: 24px 16px; }
  .fst-hub-title { font-size: 22px; }
  .fst-hub-body { padding: 16px; }
  .fst-hub-pipeline { padding: 10px 12px; }
}
</style>
