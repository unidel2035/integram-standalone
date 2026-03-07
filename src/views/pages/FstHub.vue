<template>
  <div class="hub">

    <!-- ══════════════════════════════════════════════ TOP BAR -->
    <div class="hub-topbar">
      <div class="hub-topbar-left">
        <span class="hub-live-dot"></span>
        <span class="hub-fund-name">ФСТ НТИ</span>
        <span class="hub-sep">·</span>
        <span class="hub-date">{{ now }}</span>
      </div>
      <div class="hub-topbar-actions">
        <button class="hub-btn" @click="go('/fst-apply')">
          <i class="pi pi-file-plus"></i> Новая заявка
        </button>
        <button class="hub-btn hub-btn--accent" @click="go('/fst-committee')">
          <i class="pi pi-play-circle"></i> Запустить ИК
        </button>
      </div>
    </div>

    <!-- ══════════════════════════════════════════ METRICS -->
    <div class="hub-metrics">
      <div v-for="m in metrics" :key="m.label" class="hub-metric">
        <div class="hub-metric-icon" :style="{ color: m.color }"><i :class="m.icon"></i></div>
        <div class="hub-metric-body">
          <div class="hub-metric-val" :class="{ 'hub-skeleton': statsLoading }">{{ m.val }}</div>
          <div class="hub-metric-label">{{ m.label }}</div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════ PIPELINE -->
    <div class="hub-section">
      <div class="hub-section-label">Воронка инвестиций</div>
      <div class="hub-pipeline">
        <div
          v-for="(step, idx) in pipeline"
          :key="step.id"
          class="hub-pipe-step"
          :style="{ '--c': step.color }"
          @click="go(step.path)"
        >
          <div class="hub-pipe-num">{{ String(idx + 1).padStart(2, '0') }}</div>
          <div class="hub-pipe-icon"><i :class="step.icon"></i></div>
          <div class="hub-pipe-name">{{ step.name }}</div>
          <div class="hub-pipe-sub">{{ step.sub }}</div>
          <div v-if="idx < pipeline.length - 1" class="hub-pipe-arrow">
            <i class="pi pi-angle-right"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════ MODULES -->
    <div class="hub-section">
      <div class="hub-section-label">Модули платформы</div>
      <div class="hub-modules">
        <div
          v-for="mod in modules"
          :key="mod.id"
          class="hub-mod"
          :style="{ '--mc': mod.color }"
          @click="go(mod.path)"
        >
          <div class="hub-mod-left">
            <div class="hub-mod-icon"><i :class="mod.icon"></i></div>
          </div>
          <div class="hub-mod-body">
            <div class="hub-mod-name">{{ mod.name }}</div>
            <div class="hub-mod-phase">{{ mod.phase }}</div>
          </div>
          <div class="hub-mod-right">
            <span class="hub-mod-status" :class="'hub-mod-status--' + mod.status">{{ mod.status }}</span>
            <i class="pi pi-chevron-right hub-mod-arrow"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════ TOOLS -->
    <div class="hub-section">
      <div class="hub-section-label">Инструменты</div>
      <div class="hub-tools">
        <div v-for="tool in tools" :key="tool.id" class="hub-tool" @click="go(tool.path)">
          <div class="hub-tool-icon" :style="{ color: tool.color }"><i :class="tool.icon"></i></div>
          <div class="hub-tool-name">{{ tool.name }}</div>
          <div class="hub-tool-desc">{{ tool.desc }}</div>
        </div>
      </div>
    </div>

    <div class="hub-footer">ФСТ НТИ · DronDoc Platform · v2026.03</div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFstData } from '@/composables/useFstData.js'

const router = useRouter()
const now = ref(new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }))

function go(path) { router.push(path) }

const { stats, statsLoading, loadStats } = useFstData()
onMounted(() => { loadStats() })

const metrics = computed(() => {
  const s = stats.value
  return [
    { icon: 'pi pi-clock',       color: '#38bdf8', val: '48 ч',                             label: 'Среднее время решения' },
    { icon: 'pi pi-sitemap',     color: '#a78bfa', val: statsLoading.value ? '...' : `${s?.subfundCount ?? 3}`,    label: 'Субфонда' },
    { icon: 'pi pi-briefcase',   color: '#34d399', val: statsLoading.value ? '...' : `${s?.portfolioCount ?? 0}`, label: 'Компаний в портфеле' },
    { icon: 'pi pi-handshake',   color: '#fb923c', val: statsLoading.value ? '...' : `${s?.dealsCount ?? 9}`,     label: 'Закрытых сделок' },
    { icon: 'pi pi-chart-line',  color: '#f87171', val: statsLoading.value ? '...' : `${s?.avgIRR ? (s.avgIRR * 100).toFixed(0) + '%' : '—'}`, label: 'Средний IRR' },
  ]
})

const pipeline = [
  { id: 1, name: 'Заявка',        sub: 'Подача проекта',          icon: 'pi pi-file-plus',    color: '#38bdf8', path: '/fst-apply' },
  { id: 2, name: 'Инвесткомитет', sub: '6 AI-агентов дебатируют', icon: 'pi pi-users',        color: '#a78bfa', path: '/fst-committee' },
  { id: 3, name: 'Сделка',        sub: 'Term Sheet · SPV',        icon: 'pi pi-file-edit',    color: '#fb923c', path: '/fst-deal' },
  { id: 4, name: 'Исполнение',    sub: 'KPI · Транши',            icon: 'pi pi-list-check',   color: '#34d399', path: '/fst-execution' },
  { id: 5, name: 'Мониторинг',    sub: 'Светофор рисков',         icon: 'pi pi-chart-scatter',color: '#22d3ee', path: '/fst-portfolio' },
  { id: 6, name: 'Выход',         sub: 'MOIC · IRR · DPI',        icon: 'pi pi-flag',         color: '#f87171', path: '/fst-fund' },
]

const modules = [
  { id: 'sourcing',       name: 'AI Deal Sourcing',       phase: 'Фаза 0 — Поиск',           icon: 'pi pi-search',        color: '#667eea', path: '/fst-sourcing',       status: 'live' },
  { id: 'committee',      name: 'AI Инвесткомитет',       phase: 'Фаза 1 — Оценка',          icon: 'pi pi-users',         color: '#a78bfa', path: '/fst-committee',      status: 'live' },
  { id: 'protocol',       name: 'Протоколы ИК',           phase: 'Фаза 1 — Оценка',          icon: 'pi pi-file-check',    color: '#ffa726', path: '/fst-protocol',       status: 'live' },
  { id: 'deal',           name: 'Доведение сделки',       phase: 'Фаза 2 — Структурирование', icon: 'pi pi-file-edit',     color: '#fb923c', path: '/fst-deal',           status: 'live' },
  { id: 'execution',      name: 'Исполнение сделки',      phase: 'Фаза 3 — Постинвест',      icon: 'pi pi-list-check',    color: '#34d399', path: '/fst-execution',      status: 'live' },
  { id: 'twin',           name: 'Цифровой двойник',       phase: 'Фаза 3 — Микро-монит.',    icon: 'pi pi-desktop',       color: '#f87171', path: '/fst-twin',           status: 'live' },
  { id: 'portfolio',      name: 'Портфельный монитор',    phase: 'Фаза 4 — Мониторинг',      icon: 'pi pi-chart-scatter', color: '#22d3ee', path: '/fst-portfolio',      status: 'live' },
  { id: 'intelligence',   name: 'Portfolio Intelligence', phase: 'Фаза 4 — Мониторинг',      icon: 'pi pi-chart-line',    color: '#5c6bc0', path: '/fst-intelligence',   status: 'live' },
  { id: 'benchmark',      name: 'Бенчмаркинг портфеля',  phase: 'Фаза 4 — Мониторинг',      icon: 'pi pi-chart-bar',     color: '#ff9800', path: '/fst-benchmark',      status: 'live' },
  { id: 'founders',       name: 'Founders CRM',           phase: 'Фаза 4 — Мониторинг',      icon: 'pi pi-users',         color: '#667eea', path: '/fst-founders',       status: 'live' },
  { id: 'allocation',     name: 'Оптимизация аллокации',  phase: 'Фаза 5 — Фонд-индекс',    icon: 'pi pi-chart-pie',     color: '#ab47bc', path: '/fst-allocation',     status: 'live' },
  { id: 'transparency',   name: 'Публичная витрина',      phase: 'Фаза 5 — LP Relations',    icon: 'pi pi-shield',        color: '#42a5f5', path: '/fst-transparency',   status: 'live' },
  { id: 'administration', name: 'Бэк-офис фонда',         phase: 'Фаза 5 — Fund Operations', icon: 'pi pi-building',      color: '#7c3aed', path: '/fst-administration', status: 'live' },
  { id: 'secondary',      name: 'Secondary Market',       phase: 'Фаза 6 — Ликвидность',    icon: 'pi pi-refresh',       color: '#26c6da', path: '/fst-secondary',      status: 'live' },
  { id: 'fund',           name: 'Цифровой двойник фонда', phase: 'Фаза 5 — Фонд-индекс',    icon: 'pi pi-building',      color: '#38bdf8', path: '/fst-fund',           status: 'live' },
]

const tools = [
  { id: 'simulator',    name: 'НТИ Симулятор',     desc: '9 рынков · Wright\'s Law · Леонтьев',  icon: 'pi pi-server',   color: '#a78bfa', path: '/nti-simulator' },
  { id: 'presentation', name: 'НТИ Презентация',   desc: 'Для Малкова и Пескова',                icon: 'pi pi-bookmark', color: '#38bdf8', path: '/nti-presentation' },
  { id: 'finmodel',     name: 'Редактор финмоделей',desc: 'HyperFormula · 389 функций',           icon: 'pi pi-table',    color: '#34d399', path: '/finmodel' },
  { id: 'onto',         name: 'Онтология БПЛА',    desc: '~1140 концептов · SKOS · OWL',         icon: 'pi pi-sitemap',  color: '#fb923c', path: '/onto' },
]
</script>

<style scoped>
/* ═══════════════════════════════════════════════ BASE */
.hub {
  min-height: 100vh;
  background: #05080f;
  color: #e2e8f0;
  font-family: var(--p-font-family, 'Onest', 'Inter', sans-serif);
}

/* ═══════════════════════════════════════════════ TOP BAR */
.hub-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.02);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(8px);
}
.hub-topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #94a3b8;
}
.hub-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22d3ee;
  box-shadow: 0 0 6px #22d3ee;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.hub-fund-name { font-weight: 600; color: #e2e8f0; font-size: 14px; }
.hub-sep { color: #475569; }
.hub-date { color: #64748b; }

.hub-topbar-actions {
  display: flex;
  gap: 8px;
}
.hub-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  color: #cbd5e1;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.hub-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }
.hub-btn--accent {
  background: rgba(167,139,250,0.15);
  border-color: rgba(167,139,250,0.4);
  color: #c4b5fd;
}
.hub-btn--accent:hover { background: rgba(167,139,250,0.25); }

/* ═══════════════════════════════════════════════ METRICS */
.hub-metrics {
  display: flex;
  gap: 1px;
  background: rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.hub-metric {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: #05080f;
  transition: background 0.2s;
}
.hub-metric:hover { background: rgba(255,255,255,0.02); }
.hub-metric-icon {
  font-size: 20px;
  opacity: 0.8;
}
.hub-metric-val {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1;
}
.hub-metric-label {
  font-size: 11px;
  color: #64748b;
  margin-top: 3px;
  white-space: nowrap;
}
.hub-skeleton {
  color: #334155 !important;
  background: #1e293b;
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* ═══════════════════════════════════════════════ SECTION */
.hub-section {
  padding: 24px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.hub-section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #475569;
  margin-bottom: 16px;
}

/* ═══════════════════════════════════════════════ PIPELINE */
.hub-pipeline {
  display: flex;
  align-items: stretch;
  gap: 0;
  overflow-x: auto;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  overflow: hidden;
}
.hub-pipe-step {
  flex: 1;
  position: relative;
  padding: 16px 14px;
  cursor: pointer;
  border-right: 1px solid rgba(255,255,255,0.06);
  transition: background 0.2s;
  background: rgba(255,255,255,0.01);
  min-width: 110px;
}
.hub-pipe-step:last-child { border-right: none; }
.hub-pipe-step:hover { background: rgba(var(--c-rgb, 56,189,248), 0.06); }
.hub-pipe-num {
  font-size: 10px;
  color: #475569;
  font-weight: 600;
  margin-bottom: 8px;
}
.hub-pipe-icon {
  font-size: 18px;
  color: var(--c, #38bdf8);
  margin-bottom: 6px;
}
.hub-pipe-name {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 3px;
}
.hub-pipe-sub {
  font-size: 11px;
  color: #64748b;
}
.hub-pipe-arrow {
  position: absolute;
  right: -8px;
  top: 50%;
  transform: translateY(-50%);
  color: #334155;
  font-size: 12px;
  z-index: 1;
  display: none;
}

/* ═══════════════════════════════════════════════ MODULES */
.hub-modules {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hub-mod {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}
.hub-mod:hover {
  background: rgba(255,255,255,0.03);
  border-color: rgba(255,255,255,0.08);
}
.hub-mod-left {
  flex-shrink: 0;
}
.hub-mod-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: var(--mc, #38bdf8);
}
.hub-mod-body { flex: 1; min-width: 0; }
.hub-mod-name {
  font-size: 14px;
  font-weight: 500;
  color: #e2e8f0;
}
.hub-mod-phase {
  font-size: 11px;
  color: #64748b;
  margin-top: 1px;
}
.hub-mod-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.hub-mod-status {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.hub-mod-status--live {
  background: rgba(34,211,238,0.1);
  color: #22d3ee;
  border: 1px solid rgba(34,211,238,0.2);
}
.hub-mod-status--beta {
  background: rgba(251,191,36,0.1);
  color: #fbbf24;
  border: 1px solid rgba(251,191,36,0.2);
}
.hub-mod-arrow {
  color: #334155;
  font-size: 12px;
}
.hub-mod:hover .hub-mod-arrow { color: #64748b; }

/* ═══════════════════════════════════════════════ TOOLS */
.hub-tools {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.hub-tool {
  padding: 16px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
  cursor: pointer;
  transition: all 0.2s;
}
.hub-tool:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.14);
}
.hub-tool-icon {
  font-size: 20px;
  margin-bottom: 10px;
}
.hub-tool-name {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 4px;
}
.hub-tool-desc {
  font-size: 11px;
  color: #64748b;
}

/* ═══════════════════════════════════════════════ FOOTER */
.hub-footer {
  text-align: center;
  padding: 20px;
  font-size: 11px;
  color: #334155;
}

/* ═══════════════════════════════════════════════ RESPONSIVE */
@media (max-width: 768px) {
  .hub-metrics { flex-wrap: wrap; }
  .hub-metric { flex: 1 1 50%; }
  .hub-pipeline { flex-direction: column; }
  .hub-pipe-step { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .hub-topbar { flex-direction: column; gap: 10px; align-items: flex-start; }
}
</style>
