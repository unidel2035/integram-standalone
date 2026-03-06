<template>
  <div class="hub-root">

    <!-- Атмосферный фон -->
    <div class="hub-bg">
      <div class="hub-bg-grid"></div>
      <div class="hub-glow hub-glow--1"></div>
      <div class="hub-glow hub-glow--2"></div>
      <div class="hub-glow hub-glow--3"></div>
    </div>

    <!-- ═══════════════════════════════════════ COMMAND BAR -->
    <div class="hub-bar">
      <div class="hub-bar-brand">
        <div class="hub-brand-mark"><i class="pi pi-shield"></i></div>
        <div class="hub-brand-text">
          <span class="hub-brand-name">ФСТ НТИ</span>
          <span class="hub-brand-sub">Центр управления</span>
        </div>
      </div>
      <div class="hub-bar-center">
        <span class="hub-live-dot"></span>
        <span class="hub-bar-time">{{ now }}</span>
        <span class="hub-bar-sep">·</span>
        <span class="hub-bar-status">Система активна</span>
      </div>
      <div class="hub-bar-actions">
        <button class="hub-action-btn hub-action-btn--ghost" @click="go('/fst-apply')">
          <i class="pi pi-file-plus"></i> Заявка
        </button>
        <button class="hub-action-btn hub-action-btn--primary" @click="go('/fst-committee')">
          <i class="pi pi-play-circle"></i> Инвесткомитет
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════ KPI STRIP -->
    <div class="hub-kpi-strip">
      <div v-for="k in kpis" :key="k.label" class="hub-kpi" :style="{ '--kc': k.color }">
        <div class="hub-kpi-icon"><i :class="k.icon"></i></div>
        <div class="hub-kpi-body">
          <div class="hub-kpi-val">
            <span v-if="loading" class="hub-skel hub-skel--val"></span>
            <span v-else>{{ k.val }}</span>
          </div>
          <div class="hub-kpi-label">{{ k.label }}</div>
        </div>
        <div v-if="k.badge" class="hub-kpi-badge" :class="k.badgeClass">{{ k.badge }}</div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════ MAIN GRID -->
    <div class="hub-main">

      <!-- ── Левая колонка: Воронка + Быстрые действия ── -->
      <div class="hub-col hub-col--left">

        <!-- Воронка проектов -->
        <div class="hub-card">
          <div class="hub-card-title">
            <i class="pi pi-filter" style="color:#a78bfa"></i>
            Воронка проектов
          </div>
          <div class="hub-funnel">
            <div
              v-for="stage in funnel"
              :key="stage.status"
              class="hub-funnel-row"
              :style="{ '--fc': stage.color }"
              @click="go('/fst-dealflow')"
            >
              <div class="hub-funnel-dot"></div>
              <div class="hub-funnel-label">{{ stage.status }}</div>
              <div class="hub-funnel-bar-wrap">
                <div
                  class="hub-funnel-bar"
                  :style="{ width: funnelBarWidth(stage.count) + '%' }"
                ></div>
              </div>
              <div class="hub-funnel-count">{{ stage.count }}</div>
            </div>
          </div>
          <div class="hub-card-footer">
            Всего проектов: <strong>{{ totalProjects }}</strong>
            <span class="hub-link" @click="go('/fst-dealflow')">
              Воронка → <i class="pi pi-arrow-up-right"></i>
            </span>
          </div>
        </div>

        <!-- Последние решения ИК -->
        <div class="hub-card">
          <div class="hub-card-title">
            <i class="pi pi-file-check" style="color:#ffa726"></i>
            Последние решения ИК
          </div>
          <div v-if="loading" class="hub-skeleton-list">
            <div v-for="i in 3" :key="i" class="hub-skel hub-skel--row"></div>
          </div>
          <div v-else-if="recentDecisions.length === 0" class="hub-empty">
            <i class="pi pi-inbox"></i> Заседаний пока не проводилось
          </div>
          <div v-else class="hub-decisions">
            <div v-for="d in recentDecisions" :key="d.id" class="hub-decision-row">
              <div class="hub-dec-verdict" :style="{ background: verdictColor(d.verdict) }">
                <i :class="verdictIcon(d.verdict)"></i>
              </div>
              <div class="hub-dec-body">
                <div class="hub-dec-name">{{ d.projectName }}</div>
                <div class="hub-dec-meta">{{ d.verdict }} · {{ d.date }}</div>
              </div>
              <div class="hub-dec-score" v-if="d.score">{{ d.score }}/100</div>
            </div>
          </div>
          <div class="hub-card-footer">
            <span class="hub-link" @click="go('/fst-protocol')">
              Все протоколы → <i class="pi pi-arrow-up-right"></i>
            </span>
          </div>
        </div>

      </div>

      <!-- ── Правая колонка: Портфель + Тревоги ── -->
      <div class="hub-col hub-col--right">

        <!-- Портфельные компании -->
        <div class="hub-card hub-card--wide">
          <div class="hub-card-title">
            <i class="pi pi-building" style="color:#22d3ee"></i>
            Портфель — здоровье компаний
          </div>
          <div v-if="loading" class="hub-skeleton-list">
            <div v-for="i in 3" :key="i" class="hub-skel hub-skel--company"></div>
          </div>
          <div v-else-if="portfolio.length === 0" class="hub-empty">
            <i class="pi pi-briefcase"></i> Портфельных компаний нет
          </div>
          <div v-else class="hub-companies">
            <div
              v-for="co in portfolio"
              :key="co.id"
              class="hub-company-row"
              :style="{ '--hs': healthColor(co.health) }"
              @click="go('/fst-portfolio')"
            >
              <div class="hub-co-indicator"></div>
              <div class="hub-co-body">
                <div class="hub-co-name">{{ co.name }}</div>
                <div class="hub-co-meta">
                  <span>{{ co.subfund }}</span>
                  <span class="hub-co-dot">·</span>
                  <span>{{ co.stage }}</span>
                  <span v-if="co.runway" class="hub-co-dot">·</span>
                  <span v-if="co.runway" :class="['hub-runway', co.runway < 4 ? 'hub-runway--red' : co.runway < 7 ? 'hub-runway--yellow' : '']">
                    Runway: {{ co.runway }}м
                  </span>
                </div>
              </div>
              <div class="hub-co-kpi">
                <div class="hub-co-kpi-bar">
                  <div class="hub-co-kpi-fill" :style="{ width: co.kpi + '%' }"></div>
                </div>
                <div class="hub-co-kpi-val">{{ co.kpi }}%</div>
              </div>
              <div class="hub-co-health" :title="healthLabel(co.health)">
                <i :class="healthIcon(co.health)"></i>
              </div>
            </div>
          </div>
          <div class="hub-card-footer">
            <span class="hub-link" @click="go('/fst-portfolio')">
              Портфельный монитор → <i class="pi pi-arrow-up-right"></i>
            </span>
            <span class="hub-link" @click="go('/fst-fund')">
              Цифровой двойник фонда → <i class="pi pi-arrow-up-right"></i>
            </span>
          </div>
        </div>

        <!-- Тревоги и уведомления -->
        <div class="hub-card" v-if="alerts.length > 0">
          <div class="hub-card-title">
            <i class="pi pi-exclamation-triangle" style="color:#ef5350"></i>
            Требуют внимания
          </div>
          <div class="hub-alerts">
            <div v-for="a in alerts" :key="a.id" class="hub-alert-row" :class="`hub-alert--${a.level}`" @click="go(a.path)">
              <i :class="a.icon"></i>
              <div class="hub-alert-text">
                <strong>{{ a.company }}</strong> — {{ a.text }}
              </div>
              <i class="pi pi-chevron-right hub-alert-arrow"></i>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ═══════════════════════════════════════ MODULE GRID -->
    <div class="hub-modules">
      <div class="hub-modules-title">Все модули платформы</div>
      <div class="hub-modules-grid">
        <div
          v-for="mod in modules"
          :key="mod.path"
          class="hub-mod"
          :style="{ '--mc': mod.color }"
          @click="go(mod.path)"
        >
          <div class="hub-mod-icon"><i :class="mod.icon"></i></div>
          <div class="hub-mod-name">{{ mod.name }}</div>
          <div class="hub-mod-sub">{{ mod.sub }}</div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getProjects, getPortfolio, getCommitteeSessions, STATUSES } from '@/services/fstApi.js'

const router = useRouter()
const now = ref(new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }))

function go(path) { router.push(path) }

// ── Data ───────────────────────────────────────────────────────────────────
const loading = ref(true)
const projects = ref([])
const portfolio = ref([])
const decisions = ref([])

onMounted(async () => {
  try {
    const [proj, port, sess] = await Promise.all([
      getProjects().catch(() => []),
      getPortfolio().catch(() => []),
      getCommitteeSessions().catch(() => []),
    ])
    projects.value = proj
    portfolio.value = port
    decisions.value = sess
  } finally {
    loading.value = false
  }
})

// ── KPI strip ──────────────────────────────────────────────────────────────
const kpis = computed(() => {
  const totalAum = portfolio.value.reduce((s, c) => s + (c.nav || 0), 0)
  const totalInvested = portfolio.value.reduce((s, c) => s + (c.invested || 0), 0)
  const onIc = projects.value.filter(p =>
    ['На рассмотрении ИК', String(STATUSES['На рассмотрении ИК'])].includes(String(p.statusId))
  ).length
  const approved = portfolio.value.length

  return [
    {
      label: 'NAV портфеля',
      val: totalAum > 0 ? `${(totalAum / 1e6).toFixed(0)} млн ₽` : '—',
      icon: 'pi pi-chart-line',
      color: '#22d3ee',
    },
    {
      label: 'Инвестировано',
      val: totalInvested > 0 ? `${(totalInvested / 1e6).toFixed(0)} млн ₽` : '—',
      icon: 'pi pi-dollar',
      color: '#34d399',
    },
    {
      label: 'Портфельных компаний',
      val: approved || '—',
      icon: 'pi pi-building',
      color: '#a78bfa',
    },
    {
      label: 'На рассмотрении ИК',
      val: onIc || '—',
      icon: 'pi pi-users',
      color: '#ffa726',
      badge: onIc > 0 ? 'Ожидают' : null,
      badgeClass: 'hub-badge--warn',
    },
    {
      label: 'Всего заявок',
      val: projects.value.length || '—',
      icon: 'pi pi-file-plus',
      color: '#f87171',
    },
    {
      label: 'Решений ИК',
      val: decisions.value.length || '—',
      icon: 'pi pi-file-check',
      color: '#fb923c',
    },
  ]
})

// ── Funnel ─────────────────────────────────────────────────────────────────
const FUNNEL_STAGES = [
  { status: 'Новые заявки',       match: ['Новый'],                   color: '#38bdf8' },
  { status: 'На рассмотрении ИК', match: ['На рассмотрении ИК'],      color: '#a78bfa' },
  { status: 'Одобрены',           match: ['Одобрен'],                  color: '#34d399' },
  { status: 'В работе',           match: ['В работе'],                 color: '#ffa726' },
  { status: 'Закрыты',            match: ['Закрыт'],                   color: '#ef5350' },
]

const funnel = computed(() => {
  return FUNNEL_STAGES.map(s => {
    const count = projects.value.filter(p =>
      s.match.some(m => String(p.statusId) === String(STATUSES[m]) || p.statusName === m)
    ).length
    return { ...s, count }
  })
})

const totalProjects = computed(() => projects.value.length)

function funnelBarWidth(count) {
  const max = Math.max(...funnel.value.map(s => s.count), 1)
  return Math.round((count / max) * 100)
}

// ── Recent IC decisions ────────────────────────────────────────────────────
const recentDecisions = computed(() =>
  [...decisions.value]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 5)
    .map(d => ({
      id:          d.id,
      projectName: d.projectName || d.name || 'Проект',
      verdict:     d.recommendation || d.decision || 'Неизвестно',
      date:        d.date ? new Date(d.date).toLocaleDateString('ru-RU') : '',
      score:       d.aggregatedScore ? Math.round(d.aggregatedScore) : null,
    }))
)

function verdictColor(v) {
  if (!v) return '#78909c'
  const u = v.toUpperCase()
  if (u.includes('ОДОБР') || u.includes('INVEST') || u.includes('APPROVE')) return '#43a047'
  if (u.includes('ОТКЛО') || u.includes('REJECT') || u.includes('PASS'))   return '#ef5350'
  return '#ffa726'
}
function verdictIcon(v) {
  if (!v) return 'pi pi-minus'
  const u = v.toUpperCase()
  if (u.includes('ОДОБР') || u.includes('INVEST') || u.includes('APPROVE')) return 'pi pi-check'
  if (u.includes('ОТКЛО') || u.includes('REJECT') || u.includes('PASS'))   return 'pi pi-times'
  return 'pi pi-clock'
}

// ── Portfolio health ───────────────────────────────────────────────────────
function healthColor(h) {
  if (!h || h === 'unknown') return '#78909c'
  if (h === 'green')  return '#43a047'
  if (h === 'yellow') return '#ffa726'
  if (h === 'red')    return '#ef5350'
  // numeric 0-1
  const n = parseFloat(h)
  if (!isNaN(n)) return n >= 0.7 ? '#43a047' : n >= 0.4 ? '#ffa726' : '#ef5350'
  return '#78909c'
}
function healthIcon(h) {
  const c = healthColor(h)
  if (c === '#43a047') return 'pi pi-check-circle'
  if (c === '#ef5350') return 'pi pi-times-circle'
  if (c === '#ffa726') return 'pi pi-exclamation-circle'
  return 'pi pi-minus-circle'
}
function healthLabel(h) {
  const c = healthColor(h)
  if (c === '#43a047') return 'Норма'
  if (c === '#ef5350') return 'Критично'
  if (c === '#ffa726') return 'Требует внимания'
  return 'Нет данных'
}

// ── Alerts ─────────────────────────────────────────────────────────────────
const alerts = computed(() => {
  const list = []
  for (const co of portfolio.value) {
    if (co.runway != null && co.runway < 4) {
      list.push({
        id:      `runway-${co.id}`,
        level:   'error',
        icon:    'pi pi-exclamation-triangle',
        company: co.name,
        text:    `Runway < 4 мес (${co.runway} мес) — срочно`,
        path:    '/fst-portfolio',
      })
    } else if (co.health === 'red' || (typeof co.riskLevel === 'string' && co.riskLevel.toLowerCase().includes('критич'))) {
      list.push({
        id:      `health-${co.id}`,
        level:   'error',
        icon:    'pi pi-exclamation-triangle',
        company: co.name,
        text:    'Критический риск — созыв ИК',
        path:    '/fst-portfolio',
      })
    } else if (co.health === 'yellow' || co.kpi < 50) {
      list.push({
        id:      `kpi-${co.id}`,
        level:   'warn',
        icon:    'pi pi-exclamation-circle',
        company: co.name,
        text:    `KPI прогресс ${co.kpi}% — ниже нормы`,
        path:    '/fst-execution',
      })
    }
  }
  return list.slice(0, 5)
})

// ── Module nav grid ────────────────────────────────────────────────────────
const modules = [
  { name: 'Сорсинг',             sub: 'AI-поиск стартапов',         icon: 'pi pi-search',             color: '#667eea', path: '/fst-sourcing' },
  { name: 'Заявки',              sub: 'Подача и статус',             icon: 'pi pi-file-plus',           color: '#38bdf8', path: '/fst-apply' },
  { name: 'Воронка',             sub: 'CRM сделок',                  icon: 'pi pi-filter',              color: '#a78bfa', path: '/fst-dealflow' },
  { name: 'Инвесткомитет',       sub: '6 AI-агентов',                icon: 'pi pi-users',               color: '#a78bfa', path: '/fst-committee' },
  { name: 'Протоколы ИК',        sub: 'История решений',             icon: 'pi pi-file-check',          color: '#ffa726', path: '/fst-protocol' },
  { name: 'Due Diligence',       sub: 'Проверка проектов',           icon: 'pi pi-list-check',          color: '#fb923c', path: '/fst-duediligence' },
  { name: 'Сделка',              sub: 'Term Sheet · SPV · Транши',   icon: 'pi pi-file-edit',           color: '#fb923c', path: '/fst-deal' },
  { name: 'Cap Table',           sub: 'Структура капитала',          icon: 'pi pi-sitemap',             color: '#7e57c2', path: '/fst-captable' },
  { name: 'Исполнение',          sub: 'KPI · Kanban · Транши',       icon: 'pi pi-list-check',          color: '#34d399', path: '/fst-execution' },
  { name: 'Портфель',            sub: 'Светофор рисков',             icon: 'pi pi-chart-scatter',       color: '#22d3ee', path: '/fst-portfolio' },
  { name: 'Цифровой двойник',    sub: 'Live-данные компании',        icon: 'pi pi-desktop',             color: '#f87171', path: '/fst-twin' },
  { name: 'Фонд (NAV/IRR)',      sub: '3 субфонда · DPI',            icon: 'pi pi-building-columns',    color: '#38bdf8', path: '/fst-fund' },
  { name: 'Выход',               sub: 'MOIC · Waterfall',            icon: 'pi pi-flag',                color: '#f87171', path: '/fst-exit' },
  { name: 'Бенчмарки',           sub: 'Отраслевые сравнения',        icon: 'pi pi-chart-bar',           color: '#26c6da', path: '/fst-benchmark' },
  { name: 'ESG',                 sub: 'Устойчивое развитие',         icon: 'pi pi-leaf',                color: '#4caf50', path: '/fst-esg' },
  { name: 'Compliance',          sub: 'Регуляторный контроль',       icon: 'pi pi-shield',              color: '#ab47bc', path: '/fst-compliance' },
  { name: 'Синдикация',          sub: 'Со-инвесторы',                icon: 'pi pi-share-alt',           color: '#ff7043', path: '/fst-syndication' },
  { name: 'LP-кабинет',          sub: 'Отчётность LP',               icon: 'pi pi-briefcase',           color: '#26a69a', path: '/fst-lp' },
  { name: 'Господдержка',        sub: 'Гранты и субсидии',           icon: 'pi pi-gift',                color: '#66bb6a', path: '/fst-grants' },
  { name: 'Нацпроекты',          sub: 'Интеграция с НП',             icon: 'pi pi-globe',               color: '#42a5f5', path: '/fst-natproject' },
  { name: 'Суверенность 9D',     sub: 'Матрица суверенности',        icon: 'pi pi-lock',                color: '#ffa726', path: '/fst-sovereignty' },
  { name: 'Юридика',             sub: 'Документы и СПВ',             icon: 'pi pi-book',                color: '#8d6e63', path: '/fst-legal' },
  { name: 'Госуправление',       sub: 'KPI фонда',                   icon: 'pi pi-building',            color: '#5c6bc0', path: '/fst-gov' },
  { name: 'Меморандум',          sub: 'Инвест-меморандум',           icon: 'pi pi-align-left',          color: '#78909c', path: '/fst-memo' },
]
</script>

<style scoped>
/* ═══════════════════════════════════════════ BASE */
.hub-root {
  min-height: 100vh;
  background: var(--p-surface-ground);
  color: var(--p-text-color);
  font-family: var(--p-font-family, 'Inter', sans-serif);
  position: relative;
}

/* ═══════════════════════════════════════════ BG */
.hub-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.hub-bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--fst-glass-xs) 1px, transparent 1px),
    linear-gradient(90deg, var(--fst-glass-xs) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 0%, transparent 100%);
}
.hub-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  animation: hubGlowFloat 12s ease-in-out infinite;
}
.hub-glow--1 {
  width: 600px; height: 400px;
  background: radial-gradient(ellipse, rgba(167,139,250,0.12) 0%, transparent 70%);
  top: -100px; left: -80px;
}
.hub-glow--2 {
  width: 400px; height: 400px;
  background: radial-gradient(ellipse, rgba(56,189,248,0.10) 0%, transparent 70%);
  top: -60px; right: 100px;
  animation-delay: -5s;
}
.hub-glow--3 {
  width: 300px; height: 300px;
  background: radial-gradient(ellipse, rgba(255,167,38,0.08) 0%, transparent 70%);
  top: 200px; left: 40%;
  animation-delay: -9s;
}
@keyframes hubGlowFloat {
  0%, 100% { transform: translateY(0) scale(1); }
  50%       { transform: translateY(-20px) scale(1.04); }
}

/* ═══════════════════════════════════════════ COMMAND BAR */
.hub-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: var(--fst-nav-backdrop);
  border-bottom: 1px solid var(--p-surface-border);
  backdrop-filter: blur(12px);
}
.hub-bar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.hub-brand-mark {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  flex-shrink: 0;
}
.hub-brand-name {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--p-text-color);
  line-height: 1.1;
  display: block;
}
.hub-brand-sub {
  font-size: 0.6875rem;
  color: var(--p-text-muted-color);
  display: block;
}
.hub-bar-center {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
  flex: 1;
  justify-content: center;
}
.hub-bar-sep { opacity: 0.3; }
.hub-bar-status { color: #34d399; font-weight: 500; }
.hub-live-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 8px #34d399;
  animation: livePulse 2.5s infinite;
  flex-shrink: 0;
}
@keyframes livePulse {
  0%, 100% { box-shadow: 0 0 8px #34d399; }
  50%       { box-shadow: 0 0 18px #34d399; }
}
.hub-bar-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.hub-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 8px;
  border: none;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.hub-action-btn--ghost {
  background: var(--fst-glass-sm);
  border: 1px solid var(--p-surface-border);
  color: var(--p-text-color);
}
.hub-action-btn--ghost:hover { background: var(--fst-glass-md); }
.hub-action-btn--primary {
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  color: #fff;
  box-shadow: 0 2px 16px rgba(124,58,237,0.35);
}
.hub-action-btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 24px rgba(124,58,237,0.55);
}

/* ═══════════════════════════════════════════ KPI STRIP */
.hub-kpi-strip {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1px;
  background: var(--p-surface-border);
  border-bottom: 1px solid var(--p-surface-border);
}
.hub-kpi {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: var(--p-surface-ground);
  transition: background 0.15s;
  cursor: default;
  position: relative;
  overflow: hidden;
}
.hub-kpi::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: var(--kc, #ffa726);
  opacity: 0.4;
}
.hub-kpi:hover { background: var(--p-surface-card); }
.hub-kpi-icon {
  width: 36px; height: 36px;
  border-radius: 9px;
  background: var(--fst-glass-sm);
  border: 1px solid var(--p-surface-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--kc, #ffa726);
  font-size: 15px;
  flex-shrink: 0;
}
.hub-kpi-val {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--p-text-color);
  line-height: 1;
  letter-spacing: -0.02em;
}
.hub-kpi-label {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 3px;
  font-weight: 500;
}
.hub-kpi-badge {
  margin-left: auto;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 20px;
  flex-shrink: 0;
}
.hub-badge--warn { background: rgba(255,167,38,0.18); color: #ffa726; }

/* ═══════════════════════════════════════════ SKELETON */
.hub-skel {
  background: var(--fst-glass-md);
  border-radius: 6px;
  animation: skelPulse 1.6s ease-in-out infinite;
}
@keyframes skelPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.hub-skel--val { display: inline-block; width: 60px; height: 22px; }
.hub-skel--row { height: 48px; margin-bottom: 6px; }
.hub-skel--company { height: 56px; margin-bottom: 8px; }
.hub-skeleton-list { display: flex; flex-direction: column; }

/* ═══════════════════════════════════════════ MAIN GRID */
.hub-main {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 16px;
  padding: 20px 24px;
}
@media (max-width: 900px) {
  .hub-main { grid-template-columns: 1fr; }
  .hub-kpi-strip { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 560px) {
  .hub-kpi-strip { grid-template-columns: repeat(2, 1fr); }
}
.hub-col { display: flex; flex-direction: column; gap: 16px; }

/* ═══════════════════════════════════════════ CARD */
.hub-card {
  background: var(--p-content-background);
  border: 1px solid var(--p-surface-border);
  border-radius: 14px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.hub-card-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--p-text-color);
  display: flex;
  align-items: center;
  gap: 8px;
}
.hub-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  padding-top: 4px;
  border-top: 1px solid var(--p-surface-border);
  flex-wrap: wrap;
  gap: 8px;
}
.hub-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #a78bfa;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: opacity 0.15s;
}
.hub-link:hover { opacity: 0.75; }
.hub-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
  padding: 12px 0;
}

/* ═══════════════════════════════════════════ FUNNEL */
.hub-funnel { display: flex; flex-direction: column; gap: 6px; }
.hub-funnel-row {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 7px;
  transition: background 0.1s;
}
.hub-funnel-row:hover { background: var(--fst-glass-xs); }
.hub-funnel-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--fc, #78909c);
  flex-shrink: 0;
}
.hub-funnel-label { font-size: 0.8rem; color: var(--p-text-color); width: 160px; flex-shrink: 0; }
.hub-funnel-bar-wrap {
  flex: 1;
  height: 5px;
  background: var(--fst-glass-sm);
  border-radius: 3px;
  overflow: hidden;
}
.hub-funnel-bar {
  height: 100%;
  background: var(--fc, #78909c);
  border-radius: 3px;
  transition: width 0.6s ease;
}
.hub-funnel-count {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--fc, #78909c);
  width: 20px;
  text-align: right;
  flex-shrink: 0;
}

/* ═══════════════════════════════════════════ DECISIONS */
.hub-decisions { display: flex; flex-direction: column; gap: 6px; }
.hub-decision-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--fst-glass-xs);
  border-radius: 9px;
  border: 1px solid var(--p-surface-border);
}
.hub-dec-verdict {
  width: 28px; height: 28px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  font-size: 11px;
  flex-shrink: 0;
}
.hub-dec-name { font-size: 0.8375rem; font-weight: 600; color: var(--p-text-color); }
.hub-dec-meta { font-size: 0.75rem; color: var(--p-text-muted-color); }
.hub-dec-score {
  margin-left: auto;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

/* ═══════════════════════════════════════════ COMPANIES */
.hub-companies { display: flex; flex-direction: column; gap: 8px; }
.hub-company-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--fst-glass-xs);
  border: 1px solid var(--p-surface-border);
  border-left: 3px solid var(--hs, #78909c);
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.15s;
}
.hub-company-row:hover { background: var(--fst-glass-sm); }
.hub-co-indicator {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--hs, #78909c);
  flex-shrink: 0;
}
.hub-co-body { flex: 1; min-width: 0; }
.hub-co-name { font-size: 0.875rem; font-weight: 600; color: var(--p-text-color); }
.hub-co-meta {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
}
.hub-co-dot { opacity: 0.4; }
.hub-runway { font-weight: 600; }
.hub-runway--red    { color: #ef5350; }
.hub-runway--yellow { color: #ffa726; }
.hub-co-kpi { display: flex; flex-direction: column; gap: 3px; align-items: flex-end; flex-shrink: 0; }
.hub-co-kpi-bar {
  width: 60px; height: 4px;
  background: var(--fst-glass-md);
  border-radius: 2px;
  overflow: hidden;
}
.hub-co-kpi-fill {
  height: 100%;
  background: var(--hs, #78909c);
  border-radius: 2px;
  transition: width 0.6s;
}
.hub-co-kpi-val { font-size: 0.7rem; color: var(--p-text-muted-color); }
.hub-co-health { font-size: 16px; color: var(--hs, #78909c); flex-shrink: 0; }

/* ═══════════════════════════════════════════ ALERTS */
.hub-alerts { display: flex; flex-direction: column; gap: 6px; }
.hub-alert-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 9px;
  border-left: 3px solid;
  cursor: pointer;
  font-size: 0.8125rem;
  transition: opacity 0.15s;
}
.hub-alert-row:hover { opacity: 0.8; }
.hub-alert--error { background: rgba(239,83,80,0.1); border-color: #ef5350; color: var(--p-text-color); }
.hub-alert--warn  { background: rgba(255,167,38,0.1); border-color: #ffa726; color: var(--p-text-color); }
.hub-alert-text { flex: 1; }
.hub-alert-arrow { font-size: 10px; color: var(--p-text-muted-color); }

/* ═══════════════════════════════════════════ MODULE GRID */
.hub-modules {
  position: relative;
  z-index: 1;
  padding: 4px 24px 32px;
}
.hub-modules-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--p-text-muted-color);
  margin-bottom: 12px;
}
.hub-modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}
.hub-mod {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: var(--p-content-background);
  border: 1px solid var(--p-surface-border);
  border-radius: 11px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
  overflow: hidden;
}
.hub-mod::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--mc, #ffa726);
  opacity: 0;
  transition: opacity 0.15s;
}
.hub-mod:hover {
  background: var(--p-surface-card);
  border-color: var(--mc, #ffa726);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px var(--fst-glass-md);
}
.hub-mod:hover::before { opacity: 1; }
.hub-mod-icon {
  font-size: 18px;
  color: var(--mc, #ffa726);
  margin-bottom: 2px;
}
.hub-mod-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--p-text-color);
  line-height: 1.2;
}
.hub-mod-sub {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  line-height: 1.3;
}
</style>
