<template>
  <div class="fst-hub">

    <!-- ══════════════════════════════════════════════════════════ HERO -->
    <div class="fst-hero">
      <div class="fst-hero-grid"></div>
      <div class="fst-hero-glow fst-hero-glow--1"></div>
      <div class="fst-hero-glow fst-hero-glow--2"></div>
      <div class="fst-hero-glow fst-hero-glow--3"></div>

      <div class="fst-hero-inner">
        <div class="fst-hero-eyebrow">
          <span class="fst-live-dot"></span>
          <span>Система активна</span>
          <span class="fst-eyebrow-sep">·</span>
          <span>{{ now }}</span>
        </div>

        <h1 class="fst-hero-title">
          <span class="fst-hero-title-line">Фонд Суверенных</span>
          <span class="fst-hero-title-line fst-hero-title-line--accent">Технологий НТИ</span>
        </h1>

        <p class="fst-hero-sub">
          Инвесткомитет нового поколения.<br>
          <strong>48 часов</strong> от заявки до решения вместо 3–6 месяцев.
        </p>

        <div class="fst-hero-actions" data-tour="hero-actions">
          <LearnTooltip
            label="Подать заявку"
            what="Переход на форму подачи заявки в ФСТ НТИ для стартапов и компаний"
            when="Для подачи проекта на рассмотрение фондом"
            :terms="['Заявка', 'Application', 'Скрининг']"
            position="bottom"
          >
            <button class="fst-btn-primary" @click="go('/fst-apply')">
              <i class="pi pi-file-plus"></i>
              Подать заявку
            </button>
          </LearnTooltip>
          <LearnTooltip
            label="Запустить инвесткомитет"
            what="Запуск симуляции заседания AI-инвесткомитета из 6 агентов для оценки проекта"
            when="Для демонстрации процесса оценки заявок или реального анализа проекта"
            :terms="['Инвесткомитет', 'AI-агенты', 'Дебаты', 'Решение']"
            hotkey="Ctrl+K"
            position="bottom"
          >
            <button class="fst-btn-ghost" @click="go('/fst-committee')">
              <i class="pi pi-play-circle"></i>
              Запустить инвесткомитет
            </button>
          </LearnTooltip>
        </div>

        <!-- Stats strip -->
        <div class="fst-hero-stats" data-tour="hero-stats">
          <LearnTooltip
            v-for="s in heroStats"
            :key="s.label"
            :label="s.label"
            :what="s.tooltip?.what"
            :when="s.tooltip?.when"
            :terms="s.tooltip?.terms"
            position="bottom"
          >
            <div class="fst-hero-stat">
              <div class="fst-hero-stat-val" :class="{ 'fst-skeleton': statsLoading }">{{ s.val }}</div>
              <div class="fst-hero-stat-label">{{ s.label }}</div>
            </div>
          </LearnTooltip>
        </div>
      </div>

      <!-- Floating orbit decoration -->
      <div class="fst-hero-orbit" data-tour="orbit">
        <div class="fst-orbit-ring fst-orbit-ring--1">
          <div class="fst-orbit-dot" style="--angle:0deg"><i class="pi pi-users"></i></div>
          <div class="fst-orbit-dot" style="--angle:120deg"><i class="pi pi-chart-line"></i></div>
          <div class="fst-orbit-dot" style="--angle:240deg"><i class="pi pi-shield"></i></div>
        </div>
        <div class="fst-orbit-ring fst-orbit-ring--2">
          <div class="fst-orbit-dot" style="--angle:60deg"><i class="pi pi-bolt"></i></div>
          <div class="fst-orbit-dot" style="--angle:180deg"><i class="pi pi-desktop"></i></div>
        </div>
        <div class="fst-orbit-core">
          <i class="pi pi-building"></i>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════ PIPELINE -->
    <div class="fst-pipeline-wrap">
      <div class="fst-section-label">Жизненный цикл инвестиции</div>
      <div class="fst-pipeline" data-tour="pipeline">
        <LearnTooltip
          v-for="(step, idx) in pipeline"
          :key="step.id"
          :label="step.name"
          :what="step.tooltip?.what"
          :when="step.tooltip?.when"
          :terms="step.tooltip?.terms"
          position="top"
        >
          <div
            class="fst-pipe-step"
            :style="{ '--c': step.color }"
            @click="go(step.path)"
          >
            <div v-if="idx > 0" class="fst-pipe-connector">
              <svg width="40" height="2" viewBox="0 0 40 2"><line x1="0" y1="1" x2="40" y2="1" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/></svg>
            </div>
            <div class="fst-pipe-card">
              <div class="fst-pipe-num">{{ String(idx + 1).padStart(2, '0') }}</div>
              <div class="fst-pipe-icon"><i :class="step.icon"></i></div>
              <div class="fst-pipe-name">{{ step.name }}</div>
              <div class="fst-pipe-sub">{{ step.sub }}</div>
            </div>
          </div>
        </LearnTooltip>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════ BEFORE/AFTER -->
    <div class="fst-transform" data-tour="transform">
      <div class="fst-section-label" style="padding:0 32px">Как мы перестроили процесс</div>
      <div class="fst-transform-grid">

        <div class="fst-transform-col fst-transform-col--before">
          <div class="fst-transform-header">
            <div class="fst-transform-icon fst-transform-icon--bad"><i class="pi pi-times"></i></div>
            <span>Традиционный фонд</span>
          </div>
          <ul class="fst-transform-list">
            <li v-for="s in beforeSteps" :key="s">{{ s }}</li>
          </ul>
          <div class="fst-transform-result fst-transform-result--bad">
            <i class="pi pi-clock"></i>
            3–6 месяцев · решение без объяснений
          </div>
        </div>

        <div class="fst-transform-arrow">
          <div class="fst-arrow-line"></div>
          <i class="pi pi-arrow-right"></i>
        </div>

        <div class="fst-transform-col fst-transform-col--after">
          <div class="fst-transform-header">
            <div class="fst-transform-icon fst-transform-icon--good"><i class="pi pi-check"></i></div>
            <span>ФСТ НТИ</span>
          </div>
          <ul class="fst-transform-list">
            <li v-for="s in afterSteps" :key="s">{{ s }}</li>
          </ul>
          <div class="fst-transform-result fst-transform-result--good">
            <i class="pi pi-bolt"></i>
            48 часов · протокол дебатов доступен стартапу
          </div>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════ KEY MODULES -->
    <div class="fst-modules" data-tour="modules">
      <div class="fst-section-label" style="padding: 0 32px">Ключевые модули</div>
      <div class="fst-modules-grid">
        <div
          v-for="mod in modules"
          :key="mod.id"
          class="fst-mod-card"
          :class="{ 'fst-mod-card--hero': mod.featured }"
          :style="{ '--mc': mod.color }"
          @click="go(mod.path)"
        >
          <div class="fst-mod-glow"></div>
          <div class="fst-mod-top">
            <div class="fst-mod-icon"><i :class="mod.icon"></i></div>
            <div class="fst-mod-badges">
              <span v-if="mod.featured" class="fst-badge fst-badge--key">Ключевой</span>
              <span class="fst-badge fst-badge--live">{{ statusLabel(mod.status) }}</span>
            </div>
          </div>
          <div class="fst-mod-phase">{{ mod.phase }}</div>
          <div class="fst-mod-name">{{ mod.name }}</div>
          <div class="fst-mod-desc">{{ mod.desc }}</div>
          <div class="fst-mod-tags">
            <span v-for="t in mod.tags" :key="t" class="fst-tag">{{ t }}</span>
          </div>
          <div class="fst-mod-footer">
            <code class="fst-mod-path">{{ mod.path }}</code>
            <i class="pi pi-arrow-up-right fst-mod-arrow"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ TOOLS -->
    <div class="fst-tools-wrap" data-tour="tools">
      <div class="fst-section-label" style="padding: 0 32px">Экосистема</div>
      <div class="fst-tools">
        <div v-for="tool in tools" :key="tool.id" class="fst-tool" @click="go(tool.path)">
          <div class="fst-tool-icon" :style="{ color: tool.color }"><i :class="tool.icon"></i></div>
          <div class="fst-tool-body">
            <div class="fst-tool-name">{{ tool.name }}</div>
            <div class="fst-tool-desc">{{ tool.desc }}</div>
          </div>
          <i class="pi pi-arrow-up-right fst-tool-arrow"></i>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════ GLOSSARY DEMO -->
    <div class="fst-glossary-demo-wrap">
      <div class="fst-section-label" style="padding: 0 32px">Обучение</div>
      <div class="fst-glossary-demo">
        <div class="fst-glossary-demo-content">
          <h3 class="fst-glossary-demo-title">
            <i class="pi pi-book"></i>
            Интерактивный глоссарий венчурных терминов
          </h3>
          <p class="fst-glossary-demo-desc">
            В ФСТ НТИ мы оцениваем проекты по ключевым финансовым метрикам, таким как
            <Term id="irr" @open="openTermModal">IRR</Term>,
            <Term id="moic" @open="openTermModal">MOIC</Term> и
            <Term id="tvpi" @open="openTermModal">TVPI</Term>.
            После одобрения инвесткомитетом мы готовим
            <Term id="term-sheet" @open="openTermModal">Term Sheet</Term>,
            создаём <Term id="spv" @open="openTermModal">SPV</Term>
            для сделки и согласовываем
            <Term id="cap-table" @open="openTermModal">Cap Table</Term>.
            Управляющая компания (<Term id="gp" @open="openTermModal">GP</Term>)
            получает <Term id="management-fee" @open="openTermModal">management fee</Term>
            и <Term id="carried-interest" @open="openTermModal">carried interest</Term>
            согласно <Term id="waterfall" @open="openTermModal">waterfall</Term>-модели
            распределения доходов с ограниченными партнёрами
            (<Term id="lp" @open="openTermModal">LP</Term>).
          </p>
          <div class="fst-glossary-demo-actions">
            <button class="fst-btn-primary" @click="go('/fst-glossary')">
              <i class="pi pi-book"></i>
              Открыть полный глоссарий
            </button>
            <span class="fst-glossary-demo-hint">
              <i class="pi pi-info-circle"></i>
              Кликните на подчёркнутые термины для подробного объяснения
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════ FOOTER -->
    <div class="fst-footer">
      <div class="fst-footer-brand">
        <i class="pi pi-shield"></i>
        <span>ФСТ НТИ</span>
        <span class="fst-footer-sep">·</span>
        <span class="fst-footer-motto">Перестраиваем процессы, а не автоматизируем их</span>
      </div>
      <div class="fst-footer-right">Powered by DronDoc Platform · v2026.03</div>
    </div>

    <!-- Term Modal -->
    <TermModal
      v-model:visible="termModalVisible"
      :termId="selectedTermId"
      @navigate="navigateToTerm"
    />

    <!-- Page Tutor -->
    <PageTutorButton pageId="fst-hub" :getContext="getPageContext" />

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFstData } from '@/composables/useFstData.js'
import { useProductTour } from '@/composables/useProductTour'
import PageTutorButton from '@/components/PageTutorButton.vue'
import { useOnboardingStore } from '@/stores/onboardingStore'
import LearnTooltip from '@/components/LearnTooltip.vue'
import Term from '@/components/Term.vue'
import TermModal from '@/components/TermModal.vue'

const router = useRouter()
const now = ref(new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }))

// Glossary term modal
const termModalVisible = ref(false)
const selectedTermId = ref(null)

function go(path) { router.push(path) }
function statusLabel(s) { return { live: 'Live', demo: 'Demo', beta: 'Beta' }[s] || s }

function openTermModal(termId) {
  selectedTermId.value = termId
  termModalVisible.value = true
}

function navigateToTerm(termId) {
  selectedTermId.value = termId
}

// ── Page Tutor Context ────────────────────────────────────────────
function getPageContext() {
  return {
    currentPage: 'ФСТ НТИ Хаб',
    stats: stats.value,
    availableModules: modules.map(m => m.name)
  }
}

// ── Load FST Data from API ─────────────────────────────────────────
const { stats, statsLoading, loadStats } = useFstData()

// ── Product Tour ───────────────────────────────────────────────────
const { startFstHubTour, shouldStartTour } = useProductTour()
const onboardingStore = useOnboardingStore()

// Load stats on component mount
onMounted(() => {
  loadStats()

  // Auto-start tour if not completed yet
  if (shouldStartTour('fst-hub') && onboardingStore.preferences.autoStart) {
    setTimeout(() => {
      startFstHubTour()
    }, 1000) // Delay to let page fully render
  }
})

// Computed hero stats based on API data
const heroStats = computed(() => {
  if (!stats.value) {
    // Default skeleton/loading state
    return [
      { val: '...', label: 'Среднее время решения', tooltip: null },
      { val: '...', label: 'AI-агентов ИК', tooltip: null },
      { val: '...', label: 'Прозрачность', tooltip: null },
      { val: '...', label: 'Суверенность', tooltip: null },
    ]
  }

  const { aum, portfolioCount, subfundCount, avgIRR } = stats.value

  return [
    {
      val: '48 ч',
      label: 'Среднее время решения',
      tooltip: {
        what: 'Среднее время от подачи заявки до решения инвесткомитета',
        when: 'Показывает скорость принятия решений по сравнению с традиционными фондами (3-6 месяцев)',
        terms: ['Инвесткомитет', 'Due Diligence', 'AI-агенты']
      }
    },
    {
      val: `${portfolioCount}`,
      label: 'Портфельных компаний',
      tooltip: {
        what: 'Количество активных проектов в портфеле фонда',
        when: 'Для понимания размера и диверсификации портфеля',
        terms: ['Портфель', 'Диверсификация', 'Портфельные компании']
      }
    },
    {
      val: `${subfundCount}`,
      label: 'Субфонда',
      tooltip: {
        what: 'Количество специализированных субфондов (БАС, РОБО, МЭ)',
        when: 'Для выбора правильного субфонда при подаче заявки',
        terms: ['Субфонд', 'БАС', 'РОБО', 'МЭ']
      }
    },
    {
      val: `${(avgIRR * 100).toFixed(0)}%`,
      label: 'Средний IRR прогноз',
      tooltip: {
        what: 'IRR (Internal Rate of Return) — годовая доходность инвестиций с учетом времени',
        when: 'Ключевая метрика эффективности венчурного фонда',
        terms: ['IRR', 'Доходность', 'ROI', 'Метрики фонда']
      }
    },
  ]
})

const beforeSteps = [
  'Стартап шлёт PDF на email',
  'Менеджер вручную вносит в Excel',
  'Скоринг по чужому шаблону',
  'Закрытое совещание без фиксации',
  'Решение: «одобрено» или «отказано»',
]

const afterSteps = [
  'Стартап заполняет структурированную форму',
  'AI строит карту проекта по онтологии',
  'Инвесткомитет: 6 AI-агентов дебатируют',
  'Протокол с аргументами каждого агента',
  'Решение + обоснование доступны стартапу',
]

const pipeline = [
  {
    id: 1, name: 'Заявка', sub: 'Компания подаёт проект', icon: 'pi pi-file-plus', color: '#38bdf8', path: '/fst-apply',
    tooltip: { what: 'Стартап заполняет структурированную заявку на финансирование', when: 'Первый этап взаимодействия с фондом', terms: ['Application', 'Заявка', 'Intake'] }
  },
  {
    id: 2, name: 'Инвесткомитет', sub: '6 AI-агентов дебатируют', icon: 'pi pi-users', color: '#a78bfa', path: '/fst-committee',
    tooltip: { what: '6 специализированных AI-агентов проводят многораундовые дебаты и выносят решение', when: 'После первичного скрининга заявки', terms: ['IC', 'AI-агенты', 'Дебаты', 'Due Diligence'] }
  },
  {
    id: 3, name: 'Сделка', sub: 'Term Sheet · SPV · Транши', icon: 'pi pi-file-edit', color: '#fb923c', path: '/fst-deal',
    tooltip: { what: 'Оформление юридических документов и структуры сделки', when: 'После одобрения проекта инвесткомитетом', terms: ['Term Sheet', 'SPV', 'Транши', 'Legal'] }
  },
  {
    id: 4, name: 'Исполнение', sub: 'Задачи · KPI · Транши', icon: 'pi pi-list-check', color: '#34d399', path: '/fst-execution',
    tooltip: { what: 'Управление задачами и отслеживание выполнения условий траншей', when: 'После закрытия сделки, в процессе реализации проекта', terms: ['Execution', 'KPI', 'Milestones'] }
  },
  {
    id: 5, name: 'Мониторинг', sub: 'Онлайн-риски · Светофор', icon: 'pi pi-chart-scatter', color: '#22d3ee', path: '/fst-portfolio',
    tooltip: { what: 'Система мониторинга портфеля в режиме реального времени', when: 'Постоянный процесс отслеживания здоровья портфельных компаний', terms: ['Portfolio monitoring', 'Risk management', 'Dashboard'] }
  },
  {
    id: 6, name: 'Выход', sub: 'MOIC · IRR · DPI', icon: 'pi pi-flag', color: '#f87171', path: '/fst-fund',
    tooltip: {
      what: 'Планирование и реализация выхода из инвестиций с расчетом финальной доходности',
      when: 'На этапе зрелости компании или достижения целевых показателей',
      terms: ['MOIC (Multiple on Invested Capital)', 'IRR (Internal Rate of Return)', 'DPI (Distribution to Paid-In)', 'Exit']
    }
  },
]

const modules = [
  {
    id: 'sourcing',
    name: 'AI Deal Sourcing',
    phase: 'Фаза 0 — Поиск стартапов',
    icon: 'pi pi-search',
    color: '#667eea',
    path: '/fst-sourcing',
    featured: true,
    status: 'live',
    desc: 'Автоматический мониторинг открытых источников: Telegram, HH.ru, ЕГРЮЛ, ФИПС, Сколково, GitHub, СМИ. AI-скоринг релевантности, суверенности, сигналов роста. Быстрое добавление в воронку.',
    tags: ['AI', 'Парсинг', 'Автоматизация', 'Скоринг', 'Sourcing'],
  },
  {
    id: 'committee',
    name: 'AI Инвесткомитет',
    phase: 'Фаза 1 — Оценка проекта',
    icon: 'pi pi-users',
    color: '#a78bfa',
    path: '/fst-committee',
    featured: true,
    status: 'live',
    desc: '6 AI-агентов дебатируют проект: технолог, финансист, суверенность, риск, стратег, адвокат дьявола. Многораундовые дебаты, голосование, решение ИК.',
    tags: ['AI', 'Дебаты', 'Голосование', 'Суверенность', 'TRL/MRL'],
  },
  {
    id: 'protocol',
    name: 'Протоколы ИК',
    phase: 'Фаза 1 — Оценка проекта',
    icon: 'pi pi-file-check',
    color: '#ffa726',
    path: '/fst-protocol',
    featured: false,
    status: 'live',
    desc: 'История всех заседаний инвесткомитета с полными протоколами дебатов AI-агентов. Прозрачные, сохранённые, воспроизводимые решения.',
    tags: ['Протокол', 'История', 'Прозрачность', 'AI', 'Дебаты'],
  },
  {
    id: 'deal',
    name: 'Доведение сделки',
    phase: 'Фаза 2 — Структурирование',
    icon: 'pi pi-file-edit',
    color: '#fb923c',
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
    color: '#34d399',
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
    color: '#22d3ee',
    path: '/fst-portfolio',
    featured: true,
    status: 'live',
    desc: 'Светофор рисков по всем компаниям, датчики ЕГРЮЛ / Роспатент / HH.ru, прогресс KPI, AI-еженедельный отчёт, созыв ИК при критических рисках.',
    tags: ['Светофор', 'ЕГРЮЛ', 'AI-отчёт', 'Runway', 'Риски'],
  },
  {
    id: 'intelligence',
    name: 'Portfolio Intelligence',
    phase: 'Фаза 4 — Онлайн-мониторинг',
    icon: 'pi pi-chart-line',
    color: '#5c6bc0',
    path: '/fst-intelligence',
    featured: true,
    status: 'live',
    desc: 'Еженедельный AI-отчёт по портфелю: Executive Digest, компании в зоне риска, рыночная разведка БАС/РОБО/МЭ, прогноз на следующую неделю. Доставка на email и Telegram.',
    tags: ['AI-отчёт', 'Аналитика', 'Риски', 'Прогноз', 'Разведка'],
  },
  {
    id: 'allocation',
    name: 'Оптимизация аллокации',
    phase: 'Фаза 5 — Фонд-индекс',
    icon: 'pi pi-chart-pie',
    color: '#ab47bc',
    path: '/fst-allocation',
    featured: true,
    status: 'live',
    desc: 'Black-Litterman оптимизация распределения NAV между субфондами. Граница эффективности, матрица корреляций, стресс-тесты, концентрация рисков. Аналог BlackRock Aladdin.',
    tags: ['Black-Litterman', 'Оптимизация', 'Риск', 'NAV', 'Sharpe'],
  },
  {
    id: 'founders',
    name: 'Founders CRM & Mentors',
    phase: 'Фаза 4 — Онлайн-мониторинг',
    icon: 'pi pi-users',
    color: '#667eea',
    path: '/fst-founders',
    featured: true,
    status: 'live',
    desc: 'CRM основателей портфельных компаний: профили, история взаимодействий, теги. База менторов Фонда с AI-матчингом. Alumni network и тематические встречи.',
    tags: ['CRM', 'Founders', 'Менторы', 'AI-матчинг', 'Alumni', 'Networking'],
  },
  {
    id: 'benchmark',
    name: 'Бенчмаркинг портфеля',
    phase: 'Фаза 4 — Онлайн-мониторинг',
    icon: 'pi pi-chart-bar',
    color: '#ff9800',
    path: '/fst-benchmark',
    featured: true,
    status: 'live',
    desc: 'Сравнение портфельных компаний с рыночными аналогами и отраслевыми мультипликаторами. Radar chart, исторические тренды 2020-2026, справедливая оценка, фондовые бенчмарки vs Cambridge Associates и РАВИ.',
    tags: ['Мультипликаторы', 'EV/Revenue', 'Валюация', 'IRR', 'Бенчмарки', 'Radar', 'Rule of 40'],
  },
  {
    id: 'secondary',
    name: 'Secondary Market',
    phase: 'Фаза 6 — Ликвидность',
    icon: 'pi pi-refresh',
    color: '#26c6da',
    path: '/fst-secondary',
    featured: true,
    status: 'live',
    desc: 'Управление вторичными сделками: продажа доли фонда другим инвесторам. Оценка NAV/DCF/Comparable, сеть покупателей (Ростех, Роскосмос, ВЭБ), LOI, переговоры, история сделок с money multiple.',
    tags: ['Secondary', 'Вторичные сделки', 'NAV', 'DCF', 'Госкорпорации', 'LOI', 'Ликвидность'],
  },
  {
    id: 'fund',
    name: 'Цифровой двойник фонда',
    phase: 'Фаза 5 — Фонд-индекс',
    icon: 'pi pi-building',
    color: '#38bdf8',
    path: '/fst-fund',
    featured: false,
    status: 'live',
    desc: 'NAV · ROI · матрица здоровья · квартальные чарты · AI-прогноз IRR/DPI 2026–2027. 3 субфонда: БАС, РОБО, МЭ.',
    tags: ['NAV', 'IRR', 'DPI', 'Субфонды', 'ЦД'],
  },
  {
    id: 'twin',
    name: 'Цифровой двойник компании',
    phase: 'Фаза 3 — Микро-мониторинг',
    icon: 'pi pi-desktop',
    color: '#f87171',
    path: '/fst-twin',
    featured: false,
    status: 'live',
    desc: 'Live-симуляция АвиаЛогик: выручка, burn rate, TRL/MRL/суверенность, датчики рисков, смарт-контракт с траншами, AI-прогноз выживаемости.',
    tags: ['Симуляция', 'Tick-engine', 'Смарт-контракт', 'AI'],
  },
  {
    id: 'transparency',
    name: 'Публичная витрина фонда',
    phase: 'Фаза 5 — LP Relations',
    icon: 'pi pi-shield',
    color: '#42a5f5',
    path: '/fst-transparency',
    featured: true,
    status: 'live',
    desc: 'Публичная демонстрация прозрачности по стандарту Santiago Principles® (IFSWF): структура фонда, стратегия, команда, ESG и compliance, investor data room для потенциальных LP.',
    tags: ['Santiago Principles', 'LP Relations', 'Прозрачность', 'ESG', 'Compliance', 'Data Room'],
  },
  {
    id: 'administration',
    name: 'Бэк-офис фонда',
    phase: 'Фаза 5 — Fund Operations',
    icon: 'pi pi-building',
    color: '#7c3aed',
    path: '/fst-administration',
    featured: true,
    status: 'live',
    desc: 'Управленческий учёт и соответствие ФСБУ 4/2023: Management Fee & Carry, расходы фонда, расчёт NAV, банковские операции, аудиторская поддержка, финансовая отчётность.',
    tags: ['ФСБУ 4/2023', 'Management Fee', 'NAV', 'Аудит', 'Back Office', 'Accounting'],
  },
]

const tools = [
  { id: 'simulator', name: 'НТИ Фонд Симулятор', desc: 'Стратегическая игра: 9 рынков НТИ, Wright\'s Law, Леонтьев, фонд-индекс', icon: 'pi pi-server', color: '#a78bfa', path: '/nti-simulator' },
  { id: 'presentation', name: 'НТИ Презентация', desc: 'Инвестиционная презентация для Малкова и Пескова', icon: 'pi pi-bookmark', color: '#38bdf8', path: '/nti-presentation' },
  { id: 'finmodel', name: 'Редактор финмоделей', desc: 'Полный блочный редактор с HyperFormula (389 Excel-функций)', icon: 'pi pi-table', color: '#34d399', path: '/finmodel' },
  { id: 'onto', name: 'Онтология БПЛА', desc: '~1140 концептов, граф связей, SKOS, импорт OWL', icon: 'pi pi-sitemap', color: '#fb923c', path: '/onto' },
]
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════ BASE */
.fst-hub {
  min-height: 100vh;
  background: #05080f;
  color: #e2e8f0;
  font-family: var(--p-font-family, 'Inter', sans-serif);
}

/* ═══════════════════════════════════════════════════════════ HERO */
.fst-hero {
  position: relative;
  min-height: 560px;
  display: flex;
  align-items: center;
  overflow: hidden;
  padding: 64px 48px 56px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

/* Animated grid */
.fst-hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(56,189,248,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse 70% 80% at 50% 50%, black 30%, transparent 100%);
}

/* Glow blobs */
.fst-hero-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
}
.fst-hero-glow--1 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%);
  top: -100px; left: -100px;
  animation: glowFloat 8s ease-in-out infinite;
}
.fst-hero-glow--2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(56,189,248,0.14) 0%, transparent 70%);
  bottom: -80px; left: 200px;
  animation: glowFloat 10s ease-in-out infinite reverse;
}
.fst-hero-glow--3 {
  width: 300px; height: 300px;
  background: radial-gradient(circle, rgba(251,146,60,0.12) 0%, transparent 70%);
  top: 50px; right: 200px;
  animation: glowFloat 12s ease-in-out infinite 2s;
}
@keyframes glowFloat {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-30px) scale(1.05); }
}

/* Hero inner */
.fst-hero-inner {
  position: relative;
  z-index: 2;
  max-width: 680px;
}

.fst-hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(148,163,184,0.9);
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  padding: 5px 16px;
  margin-bottom: 28px;
  backdrop-filter: blur(8px);
}
.fst-live-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 8px #34d399;
  animation: livePulse 2s infinite;
}
@keyframes livePulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 8px #34d399; }
  50% { opacity: 0.6; box-shadow: 0 0 16px #34d399; }
}
.fst-eyebrow-sep { opacity: 0.3; }

.fst-hero-title {
  display: flex;
  flex-direction: column;
  margin: 0 0 20px;
  line-height: 1.1;
}
.fst-hero-title-line {
  font-size: clamp(32px, 4vw, 52px);
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #f1f5f9;
}
.fst-hero-title-line--accent {
  background: linear-gradient(135deg, #a78bfa 0%, #38bdf8 50%, #34d399 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.fst-hero-sub {
  font-size: 17px;
  color: #94a3b8;
  line-height: 1.7;
  margin: 0 0 32px;
}
.fst-hero-sub strong { color: #f59e0b; font-weight: 700; }

/* CTA buttons */
.fst-hero-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 40px;
  flex-wrap: wrap;
}
.fst-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 28px;
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 24px rgba(124,58,237,0.4);
}
.fst-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(124,58,237,0.6);
}
.fst-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 28px;
  background: rgba(255,255,255,0.05);
  color: #e2e8f0;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(8px);
}
.fst-btn-ghost:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(167,139,250,0.5);
  transform: translateY(-2px);
}

/* Hero stats */
.fst-hero-stats {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
}
.fst-hero-stat-val {
  font-size: 24px;
  font-weight: 800;
  color: #f1f5f9;
  letter-spacing: -0.02em;
  line-height: 1;
}
.fst-hero-stat-label {
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Orbit decoration */
.fst-hero-orbit {
  position: absolute;
  right: 80px;
  top: 50%;
  transform: translateY(-50%);
  width: 300px;
  height: 300px;
  z-index: 1;
  display: none;
}
@media (min-width: 1100px) { .fst-hero-orbit { display: block; } }

.fst-orbit-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.06);
}
.fst-orbit-ring--1 {
  inset: 0;
  animation: orbitSpin 20s linear infinite;
}
.fst-orbit-ring--2 {
  inset: 50px;
  animation: orbitSpin 14s linear infinite reverse;
}
@keyframes orbitSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.fst-orbit-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #94a3b8;
  transform:
    rotate(var(--angle))
    translateX(135px)
    rotate(calc(-1 * var(--angle)));
  backdrop-filter: blur(4px);
}
.fst-orbit-ring--2 .fst-orbit-dot {
  transform:
    rotate(var(--angle))
    translateX(85px)
    rotate(calc(-1 * var(--angle)));
}
.fst-orbit-core {
  position: absolute;
  inset: 105px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(167,139,250,0.2), rgba(56,189,248,0.2));
  border: 1px solid rgba(167,139,250,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #a78bfa;
  box-shadow:
    0 0 30px rgba(167,139,250,0.2),
    inset 0 0 30px rgba(167,139,250,0.05);
}

/* ═════════════════════════════════════════════════ SHARED LABELS */
.fst-section-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #475569;
  margin-bottom: 20px;
}

/* ═══════════════════════════════════════════════════════ PIPELINE */
.fst-pipeline-wrap {
  padding: 40px 32px 36px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: rgba(255,255,255,0.015);
}
.fst-pipeline {
  display: flex;
  align-items: flex-start;
  gap: 0;
  overflow-x: auto;
  padding-bottom: 4px;
}
.fst-pipe-step {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
}
.fst-pipe-connector {
  color: rgba(255,255,255,0.15);
  padding: 0 4px;
  margin-top: -24px;
  flex-shrink: 0;
}
.fst-pipe-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 20px 14px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-top: 2px solid var(--c);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 120px;
  position: relative;
  text-align: center;
}
.fst-pipe-card:hover {
  background: rgba(255,255,255,0.07);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 20px color-mix(in srgb, var(--c) 20%, transparent);
}
.fst-pipe-num {
  position: absolute;
  top: 8px;
  right: 10px;
  font-size: 10px;
  font-weight: 700;
  color: var(--c);
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.fst-pipe-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--c) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  color: var(--c);
  margin-bottom: 8px;
  box-shadow: 0 0 12px color-mix(in srgb, var(--c) 25%, transparent);
}
.fst-pipe-name {
  font-size: 13px;
  font-weight: 700;
  color: #e2e8f0;
}
.fst-pipe-sub {
  font-size: 10px;
  color: #64748b;
  margin-top: 3px;
  line-height: 1.3;
}

/* ════════════════════════════════════════════════ BEFORE / AFTER */
.fst-transform {
  padding: 40px 0 40px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.fst-transform-grid {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 0 32px;
  margin-top: 4px;
}
.fst-transform-col {
  flex: 1;
  min-width: 0;
  padding: 24px;
  border-radius: 12px;
}
.fst-transform-col--before {
  background: rgba(239,68,68,0.04);
  border: 1px solid rgba(239,68,68,0.12);
}
.fst-transform-col--after {
  background: rgba(52,211,153,0.04);
  border: 1px solid rgba(52,211,153,0.12);
}
.fst-transform-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  color: #475569;
  gap: 4px;
  flex-shrink: 0;
}
.fst-arrow-line {
  width: 1px;
  flex: 1;
  background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent);
  margin-bottom: 4px;
}
.fst-transform-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 16px;
}
.fst-transform-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}
.fst-transform-icon--bad { background: rgba(239,68,68,0.15); color: #f87171; }
.fst-transform-icon--good { background: rgba(52,211,153,0.15); color: #34d399; }
.fst-transform-col--before .fst-transform-header { color: #f87171; }
.fst-transform-col--after .fst-transform-header { color: #34d399; }

.fst-transform-list {
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fst-transform-list li {
  font-size: 13px;
  color: #94a3b8;
  padding: 8px 12px;
  border-radius: 6px;
  line-height: 1.4;
}
.fst-transform-col--before li {
  background: rgba(239,68,68,0.05);
  border-left: 2px solid rgba(239,68,68,0.25);
}
.fst-transform-col--after li {
  background: rgba(52,211,153,0.05);
  border-left: 2px solid rgba(52,211,153,0.3);
  color: #cbd5e1;
}
.fst-transform-result {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  padding: 10px 14px;
  border-radius: 8px;
}
.fst-transform-result--bad {
  background: rgba(239,68,68,0.1);
  color: #f87171;
  border: 1px solid rgba(239,68,68,0.2);
}
.fst-transform-result--good {
  background: rgba(52,211,153,0.1);
  color: #34d399;
  border: 1px solid rgba(52,211,153,0.2);
}

/* ═══════════════════════════════════════════════════════ MODULES */
.fst-modules {
  padding: 40px 0 36px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.fst-modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  padding: 0 32px;
}
.fst-mod-card {
  position: relative;
  overflow: hidden;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  padding: 22px;
  cursor: pointer;
  transition: all 0.25s;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fst-mod-card--hero {
  border-color: rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
}
.fst-mod-card:hover {
  border-color: color-mix(in srgb, var(--mc) 40%, transparent);
  transform: translateY(-4px);
  box-shadow:
    0 12px 40px rgba(0,0,0,0.4),
    0 0 0 1px color-mix(in srgb, var(--mc) 20%, transparent),
    0 0 40px color-mix(in srgb, var(--mc) 8%, transparent);
}
.fst-mod-glow {
  position: absolute;
  top: 0; right: 0;
  width: 120px; height: 120px;
  background: radial-gradient(circle at top right, color-mix(in srgb, var(--mc) 12%, transparent), transparent 70%);
  pointer-events: none;
  transition: opacity 0.25s;
}
.fst-mod-card:hover .fst-mod-glow { opacity: 1.5; }

.fst-mod-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.fst-mod-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--mc) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--mc) 25%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--mc);
}
.fst-mod-badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}
.fst-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 10px;
}
.fst-badge--key {
  background: rgba(167,139,250,0.15);
  color: #a78bfa;
  border: 1px solid rgba(167,139,250,0.25);
}
.fst-badge--live {
  background: rgba(52,211,153,0.12);
  color: #34d399;
  border: 1px solid rgba(52,211,153,0.2);
}
.fst-mod-phase {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #475569;
}
.fst-mod-name {
  font-size: 18px;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1.2;
}
.fst-mod-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.65;
  flex: 1;
}
.fst-mod-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.fst-tag {
  font-size: 10px;
  padding: 3px 9px;
  border-radius: 20px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: #64748b;
}
.fst-mod-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.fst-mod-path {
  font-size: 11px;
  color: color-mix(in srgb, var(--mc) 80%, #94a3b8);
  font-family: monospace;
}
.fst-mod-arrow {
  font-size: 12px;
  color: #475569;
  transition: color 0.2s, transform 0.2s;
}
.fst-mod-card:hover .fst-mod-arrow {
  color: var(--mc);
  transform: translate(2px, -2px);
}

/* ════════════════════════════════════════════════════════ TOOLS */
.fst-tools-wrap {
  padding: 36px 0 32px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.fst-tools {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  padding: 0 32px;
}
.fst-tool {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.18s;
}
.fst-tool:hover {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.12);
  transform: translateX(4px);
}
.fst-tool-icon {
  font-size: 20px;
  flex-shrink: 0;
  width: 36px;
  text-align: center;
}
.fst-tool-body { flex: 1; min-width: 0; }
.fst-tool-name {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}
.fst-tool-desc {
  font-size: 11px;
  color: #475569;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fst-tool-arrow {
  font-size: 11px;
  color: #334155;
  flex-shrink: 0;
  transition: color 0.15s;
}
.fst-tool:hover .fst-tool-arrow { color: #94a3b8; }

/* ════════════════════════════════════════════════════════ FOOTER */
.fst-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  background: rgba(255,255,255,0.02);
  border-top: 1px solid rgba(255,255,255,0.05);
  font-size: 12px;
  color: #334155;
  flex-wrap: wrap;
  gap: 8px;
}
.fst-footer-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fst-footer-brand .pi-shield { color: #a78bfa; }
.fst-footer-brand span:first-of-type { color: #64748b; font-weight: 600; }
.fst-footer-sep { opacity: 0.3; }
.fst-footer-motto { color: #334155; font-style: italic; }
.fst-footer-right { color: #1e293b; }

/* ══════════════════════════════════════════════ GLOSSARY DEMO */
.fst-glossary-demo-wrap {
  padding: 48px 0;
}
.fst-glossary-demo {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 32px;
}
.fst-glossary-demo-content {
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%);
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 12px;
  padding: 2rem;
}
.fst-glossary-demo-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: var(--p-text-color);
}
.fst-glossary-demo-title i {
  color: #a78bfa;
  font-size: 1.75rem;
}
.fst-glossary-demo-desc {
  line-height: 1.8;
  font-size: 1.05rem;
  color: var(--p-text-color);
  margin: 0 0 1.5rem 0;
}
.fst-glossary-demo-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}
.fst-glossary-demo-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}
.fst-glossary-demo-hint i {
  color: #a78bfa;
}

/* ══════════════════════════════════════════════════ RESPONSIVE */
@media (max-width: 768px) {
  .fst-hero { padding: 40px 20px 40px; min-height: auto; }
  .fst-hero-title-line { font-size: 28px; }
  .fst-transform-grid { flex-direction: column; gap: 12px; padding: 0 16px; }
  .fst-transform-arrow { flex-direction: row; padding: 0; justify-content: center; }
  .fst-arrow-line { display: none; }
  .fst-modules { padding: 32px 0; }
  .fst-modules-grid { padding: 0 16px; gap: 12px; grid-template-columns: 1fr; }
  .fst-tools { padding: 0 16px; }
  .fst-pipeline-wrap { padding: 24px 16px; }
  .fst-footer { padding: 14px 16px; }
  .fst-hero-orbit { display: none; }
}

/* ══════════════════════════════════════════════════ SKELETON LOADER */
.fst-skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
  color: transparent !important;
}
@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
