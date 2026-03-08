<template>
  <div class="hub" :class="{ 'sandbox-mode': sandboxStore.isSandboxMode }">

    <!-- ══════════════════════════════════════════════ SANDBOX BANNER -->
    <SandboxBanner @open-scenarios="showScenarios = true" />

    <!-- ══════════════════════════════════════════════ TOP BAR -->
    <div class="hub-topbar">
      <div class="hub-topbar-left">
        <span class="hub-live-dot"></span>
        <span class="hub-fund-name">ФСТ НТИ</span>
        <span class="hub-sep">·</span>
        <span class="hub-date">{{ now }}</span>
      </div>
      <div class="hub-topbar-actions">
        <!-- Sandbox Toggle -->
        <button
          class="hub-btn hub-btn-sandbox"
          :class="{ 'active': sandboxStore.isSandboxMode }"
          @click="sandboxStore.toggleSandbox"
          :title="sandboxStore.modeName"
        >
          <i :class="sandboxStore.isSandboxMode ? 'pi pi-graduation-cap' : 'pi pi-building'"></i>
          <span class="hub-btn-label">{{ sandboxStore.isSandboxMode ? 'Обучение' : 'Боевой' }}</span>
        </button>
        <button class="hub-btn" @click="go('/fst-apply')" title="Новая заявка">
          <i class="pi pi-file-plus"></i><span class="hub-btn-label"> Новая заявка</span>
        </button>
        <button class="hub-btn hub-btn--accent" @click="go('/fst-committee')" title="Запустить ИК">
          <i class="pi pi-play-circle"></i><span class="hub-btn-label"> Запустить ИК</span>
        </button>
        <button class="hub-btn" @click="toggleHelp" title="Помощь по странице">
          <i class="pi pi-question-circle"></i>
        </button>
      </div>
    </div>

    <!-- ══════════════════════════════════════════ METRICS -->
    <div class="hub-metrics">
      <div v-for="m in metrics" :key="m.label" class="hub-metric">
        <i :class="m.icon" class="hub-metric-icon"></i>
        <div class="hub-metric-val" :class="{ 'hub-skeleton': statsLoading }">{{ m.val }}</div>
        <div class="hub-metric-label">{{ m.label }}</div>
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
        <div v-for="group in modulesByPhase" :key="group.phase" class="hub-phase-group">
          <div class="hub-phase-label">{{ group.phase }}</div>
          <div
            v-for="mod in group.items"
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
            </div>
            <div class="hub-mod-right">
              <span class="hub-mod-status" :class="'hub-mod-status--' + mod.status">{{ mod.status }}</span>
              <i class="pi pi-chevron-right hub-mod-arrow"></i>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- Page Help Drawer -->
  <PageHelpDrawer v-model:visible="helpOpen" :page-help="pageHelp" />

  <!-- Practice Scenarios Dialog -->
  <PracticeScenariosDialog v-model:visible="showScenarios" />
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFstData } from '@/composables/useFstData.js'
import { useSandboxStore } from '@/stores/sandboxStore'
import PageHelpDrawer from '@/components/PageHelpDrawer.vue'
import SandboxBanner from '@/components/SandboxBanner.vue'
import PracticeScenariosDialog from '@/components/PracticeScenariosDialog.vue'
import { usePageHelp } from '@/composables/usePageHelp'

const router = useRouter()
const sandboxStore = useSandboxStore()
const now = ref(new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }))
const showScenarios = ref(false)

function go(path) { router.push(path) }

// Page Help
const { isOpen: helpOpen, pageHelp, toggleHelp } = usePageHelp('fst')

const { stats, statsLoading, loadStats } = useFstData()
onMounted(() => { loadStats() })

const metrics = computed(() => {
  const s = stats.value
  return [
    { icon: 'pi pi-users',        color: '#a78bfa', val: statsLoading.value ? '...' : `${s?.committeeCount ?? 0}`,  label: 'Заседаний ИК' },
    { icon: 'pi pi-sitemap',      color: '#38bdf8', val: statsLoading.value ? '...' : `${s?.subfundCount ?? 3}`,    label: 'Субфонда' },
    { icon: 'pi pi-briefcase',    color: '#34d399', val: statsLoading.value ? '...' : `${s?.portfolioCount ?? 0}`, label: 'Компаний в портфеле' },
    { icon: 'pi pi-check-circle', color: '#fb923c', val: statsLoading.value ? '...' : `${s?.dealsCount ?? 9}`,     label: 'Закрытых сделок' },
    { icon: 'pi pi-chart-line',   color: '#f87171', val: statsLoading.value ? '...' : `${s?.avgIRR ? (s.avgIRR * 100).toFixed(0) + '%' : '—'}`, label: 'Средний IRR' },
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

const phaseNames = {
  'Фаза 0': 'Поиск',
  'Фаза 1': 'Оценка',
  'Фаза 2': 'Структурирование',
  'Фаза 3': 'Постинвестмент',
  'Фаза 4': 'Мониторинг',
  'Фаза 5': 'Управление фондом',
  'Фаза 6': 'Ликвидность',
}

const modulesByPhase = computed(() => {
  const order = []
  const map = {}
  for (const mod of modules) {
    const key = mod.phase.replace(/\s*—.*/, '')
    if (!map[key]) {
      map[key] = { phase: `${key} · ${phaseNames[key] || ''}`, items: [] }
      order.push(key)
    }
    map[key].items.push(mod)
  }
  return order.map(k => map[k])
})

</script>

<style scoped>
/* ═══════════════════════════════════════════════ BASE */
.hub {
  min-height: 100vh;
  background: var(--surface-ground);
  color: var(--p-text-color);
  font-family: var(--p-font-family, 'Onest', 'Inter', sans-serif);
}

/* ═══════════════════════════════════════════════ TOP BAR */
.hub-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--p-content-border-color);
  background: transparent;
  position: sticky;
  top: 0;
  z-index: 10;
}
.hub-topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--p-text-muted-color);
}
.hub-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--p-primary-color);
  box-shadow: 0 0 6px var(--p-primary-color);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.hub-fund-name { font-weight: 600; color: var(--p-text-color); font-size: 14px; }
.hub-sep { color: var(--p-text-muted-color); }
.hub-date { color: var(--p-text-muted-color); }

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
  border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-section);
  color: var(--p-text-color);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.hub-btn:hover { background: var(--surface-hover); }
.hub-btn--accent {
  background: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
  border-color: color-mix(in srgb, var(--p-primary-color) 40%, transparent);
  color: var(--p-primary-color);
}
.hub-btn--accent:hover { background: color-mix(in srgb, var(--p-primary-color) 25%, transparent); }
.hub-btn-sandbox {
  font-weight: 600;
}
.hub-btn-sandbox.active {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-color: #d97706;
  color: #78350f;
}
.hub-btn-sandbox.active:hover {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

/* Sandbox mode styling */
.hub.sandbox-mode {
  box-shadow: inset 0 0 0 4px #fbbf24;
}

/* ═══════════════════════════════════════════════ METRICS */
.hub-metrics {
  display: flex;
  padding: 20px 24px;
  gap: 16px;
}
.hub-metric {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 14px 8px;
  background: var(--surface-ground);
  border-bottom: 2px solid transparent;
}
.hub-metric-icon {
  font-size: 16px;
  margin-bottom: 8px;
  opacity: 0.7;
}
.hub-metric-val {
  font-size: 22px;
  font-weight: 700;
  color: var(--p-text-color);
  line-height: 1;
}
.hub-metric-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.hub-skeleton {
  color: transparent !important;
  background: var(--p-content-border-color);
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* ═══════════════════════════════════════════════ SECTION */
.hub-section {
  padding: 20px 24px;
  border-bottom: 1px solid var(--p-content-border-color);
}
.hub-section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
  margin-bottom: 14px;
}

/* ═══════════════════════════════════════════════ PIPELINE */
.hub-pipeline {
  display: flex;
  align-items: stretch;
  gap: 0;
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  overflow: hidden;
}
.hub-pipe-step {
  flex: 1;
  position: relative;
  padding: 16px 14px;
  cursor: pointer;
  border-right: 1px solid var(--p-content-border-color);
  transition: background 0.2s, box-shadow 0.2s, transform 0.2s;
  background: transparent;
  min-width: 110px;
}
.hub-pipe-step:last-child { border-right: none; }
.hub-pipe-step:hover {
  background: color-mix(in srgb, var(--c, #38bdf8) 8%, var(--surface-card));
  box-shadow: inset 0 -3px 0 var(--c, #38bdf8);
}
.hub-pipe-step:hover .hub-pipe-name {
  color: var(--c, #38bdf8);
}
.hub-pipe-num {
  font-size: 10px;
  color: var(--p-text-muted-color);
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
  color: var(--p-text-color);
  margin-bottom: 3px;
}
.hub-pipe-sub {
  font-size: 11px;
  color: var(--p-text-muted-color);
}
.hub-pipe-arrow {
  position: absolute;
  right: -8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--p-text-muted-color);
  font-size: 12px;
  z-index: 1;
  display: none;
}

/* ═══════════════════════════════════════════════ MODULES */
.hub-modules {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.hub-phase-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hub-phase-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color);
  letter-spacing: 0.03em;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--p-content-border-color);
  margin-bottom: 4px;
}
.hub-mod {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 12px;
  margin: 0 -12px;
  border-radius: 6px;
  cursor: pointer;
  border-left: 3px solid transparent;
  border-right: 3px solid transparent;
  transition: all 0.15s;
}
.hub-mod:hover {
  background: color-mix(in srgb, var(--mc, #38bdf8) 8%, var(--surface-card));
  border-left-color: var(--mc, #38bdf8);
  border-right-color: var(--mc, #38bdf8);
}
.hub-mod:hover .hub-mod-name {
  color: var(--mc, #38bdf8);
}
.hub-mod-left {
  flex-shrink: 0;
}
.hub-mod-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--surface-ground);
  border: 1px solid var(--p-content-border-color);
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
  color: var(--p-text-color);
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
  background: rgba(34,211,238,0.15);
  color: #22d3ee;
  border: 1px solid rgba(34,211,238,0.3);
}
.hub-mod-status--beta {
  background: rgba(251,191,36,0.15);
  color: #fbbf24;
  border: 1px solid rgba(251,191,36,0.3);
}
.hub-mod-arrow {
  color: var(--p-text-muted-color);
  font-size: 12px;
}


/* ═══════════════════════════════════════════════ RESPONSIVE */
@media (max-width: 768px) {
  /* Top bar: stack left/right, make actions full-width */
  .hub-topbar {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 16px;
  }
  .hub-topbar-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 6px;
  }
  /* Show only icon on small buttons, keep text on key actions */
  .hub-btn {
    padding: 7px 10px;
    font-size: 12px;
  }

  /* Metrics: 2 columns */
  .hub-metrics {
    flex-wrap: wrap;
    padding: 12px 16px;
    gap: 8px;
  }
  .hub-metric {
    flex: 1 1 calc(50% - 8px);
    min-width: 0;
  }

  /* Sections */
  .hub-section {
    padding: 16px;
  }

  /* Pipeline: vertical list */
  .hub-pipeline {
    flex-direction: column;
    border-radius: 8px;
  }
  .hub-pipe-step {
    border-right: none;
    border-bottom: 1px solid var(--p-content-border-color);
    min-width: 0;
    padding: 12px 14px;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }
  .hub-pipe-step:last-child {
    border-bottom: none;
  }
  .hub-pipe-num {
    margin-bottom: 0;
    min-width: 20px;
  }
  .hub-pipe-icon {
    margin-bottom: 0;
    font-size: 16px;
    flex-shrink: 0;
  }
  .hub-pipe-name {
    margin-bottom: 0;
    font-size: 13px;
  }
  .hub-pipe-sub {
    flex: 1;
    font-size: 11px;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Modules: fix negative margin overflow */
  .hub-mod {
    margin: 0;
    padding: 10px 10px;
    border-left-width: 2px;
    border-right: none;
  }
  .hub-mod:hover {
    border-right-color: transparent;
  }
}

@media (max-width: 480px) {
  /* Extra small: hide button labels, show only icons for secondary actions */
  .hub-btn-sandbox span,
  .hub-btn-label {
    display: none;
  }
  .hub-btn {
    padding: 7px 9px;
  }
  .hub-topbar-left {
    font-size: 12px;
    gap: 6px;
  }
  .hub-fund-name {
    font-size: 13px;
  }
  .hub-date {
    display: none;
  }

  /* Metrics: tighter */
  .hub-metrics {
    gap: 6px;
    padding: 10px 12px;
  }
  .hub-metric {
    padding: 10px 6px;
  }
  .hub-metric-val {
    font-size: 18px;
  }
  .hub-metric-label {
    font-size: 10px;
  }

  /* Sections */
  .hub-section {
    padding: 12px;
  }
}

</style>
