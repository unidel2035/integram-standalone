<template>
  <div class="land">

    <!-- ═══════════════════════════════════════════ TOPBAR -->
    <header class="land-nav">
      <div class="land-nav-logo">
        <div class="land-logo-mark">ФСТ</div>
        <div class="land-logo-text">
          <span>Фонд Суверенных</span>
          <span>Технологий НТИ</span>
        </div>
      </div>
      <nav class="land-nav-links">
        <a href="#process">Процесс</a>
        <a href="#support">Сопровождение</a>
        <a href="#modules">Модули</a>
        <a href="#numbers">Показатели</a>
      </nav>
      <div class="land-nav-actions">
        <button class="land-nav-btn" @click="go('/fst-hub')">Войти в систему</button>
        <button class="land-nav-cta" @click="go('/fst-apply')">Подать заявку</button>
      </div>
    </header>

    <!-- ═══════════════════════════════════════════ HERO -->
    <section class="land-hero">
      <!-- Background layers -->
      <div class="land-bg-grid"></div>
      <div class="land-bg-glow land-bg-glow--v"></div>
      <div class="land-bg-glow land-bg-glow--b"></div>
      <div class="land-bg-noise"></div>

      <!-- Floating orbs -->
      <div class="land-orb land-orb--1"></div>
      <div class="land-orb land-orb--2"></div>
      <div class="land-orb land-orb--3"></div>

      <div class="land-hero-inner">
        <div class="land-hero-badge">
          <span class="land-live"></span>
          Система активна · {{ now }}
          <span class="land-hero-badge-sep"></span>
          <span class="land-hero-badge-tag">v2026</span>
        </div>

        <h1 class="land-hero-h1">
          <span class="land-h1-line">Инвестиции в суверенные</span>
          <span class="land-h1-line land-h1-accent">технологии будущего</span>
        </h1>

        <p class="land-hero-p">
          Первый в России AI-инвесткомитет с прозрачными решениями.<br>
          <strong>Упаковываем стартапы</strong> и берём на себя все задачи роста —<br>
          от юридики до финмодели. Френдли структура без скрытых условий.<br>
          От заявки до ответа — <strong>48 часов</strong> вместо 3–6 месяцев.
        </p>

        <div class="land-hero-btns">
          <button class="land-btn-hero" @click="go('/fst-apply')">
            <i class="pi pi-file-plus"></i>
            Подать заявку в фонд
          </button>
          <button class="land-btn-hero-ghost" @click="go('/fst-committee')">
            <i class="pi pi-play-circle"></i>
            Смотреть инвесткомитет
          </button>
        </div>

        <!-- Stats row -->
        <div class="land-hero-stats">
          <div v-for="s in stats" :key="s.label" class="land-stat">
            <div class="land-stat-val">{{ s.val }}</div>
            <div class="land-stat-label">{{ s.label }}</div>
          </div>
        </div>
      </div>

      <!-- Scroll hint -->
      <div class="land-scroll-hint">
        <div class="land-scroll-line"></div>
        <span>Прокрутите</span>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════ PILLARS -->
    <section class="land-pillars">
      <div class="land-pillars-inner">
        <div v-for="p in pillars" :key="p.id" class="land-pillar" :style="{ '--pc': p.color }">
          <div class="land-pillar-icon"><i :class="p.icon"></i></div>
          <div class="land-pillar-title">{{ p.title }}</div>
          <div class="land-pillar-text">{{ p.text }}</div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════ PROCESS -->
    <section id="process" class="land-process">
      <div class="land-section-eyebrow">Как работает ФСТ НТИ</div>
      <h2 class="land-section-h2">Мы переписали логику,<br><span>а не автоматизировали старую</span></h2>
      <p class="land-section-sub">Автоматизация встраивает агентов в существующие процессы. Мы перестроили сам процесс — от карты знаний рынка до протокола инвесткомитета.</p>

      <div class="land-compare">
        <div class="land-compare-col land-compare-col--old">
          <div class="land-compare-header">
            <span class="land-compare-dot land-compare-dot--red"></span>
            Традиционный венчурный фонд
          </div>
          <div class="land-compare-steps">
            <div v-for="(s,i) in oldProcess" :key="i" class="land-compare-step land-compare-step--old">
              <span class="land-step-num">{{ String(i+1).padStart(2,'0') }}</span>
              <span>{{ s }}</span>
            </div>
          </div>
          <div class="land-compare-outcome land-compare-outcome--bad">
            <i class="pi pi-clock"></i>
            <strong>3–6 месяцев</strong> · решение без объяснений
          </div>
        </div>

        <div class="land-compare-vs">
          <div class="land-vs-line"></div>
          <div class="land-vs-badge">VS</div>
          <div class="land-vs-line"></div>
        </div>

        <div class="land-compare-col land-compare-col--new">
          <div class="land-compare-header">
            <span class="land-compare-dot land-compare-dot--green"></span>
            ФСТ НТИ
          </div>
          <div class="land-compare-steps">
            <div v-for="(s,i) in newProcess" :key="i" class="land-compare-step land-compare-step--new">
              <span class="land-step-num">{{ String(i+1).padStart(2,'0') }}</span>
              <span>{{ s }}</span>
            </div>
          </div>
          <div class="land-compare-outcome land-compare-outcome--good">
            <i class="pi pi-bolt"></i>
            <strong>48 часов</strong> · протокол дебатов доступен стартапу
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════ PIPELINE -->
    <section class="land-pipeline-section">
      <div class="land-section-eyebrow">Жизненный цикл инвестиции</div>
      <h2 class="land-section-h2">От идеи до выхода —<br><span>6 прозрачных этапов</span></h2>
      <div class="land-pipeline">
        <div v-for="(step, idx) in pipeline" :key="step.id" class="land-pipe-item" :style="{ '--sc': step.color }">
          <div class="land-pipe-num">{{ String(idx+1).padStart(2,'0') }}</div>
          <div class="land-pipe-icon-wrap">
            <div class="land-pipe-icon"><i :class="step.icon"></i></div>
            <div v-if="idx < pipeline.length-1" class="land-pipe-connector"></div>
          </div>
          <div class="land-pipe-name">{{ step.name }}</div>
          <div class="land-pipe-sub">{{ step.sub }}</div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════ NUMBERS -->
    <section id="numbers" class="land-numbers">
      <div class="land-numbers-bg"></div>
      <div class="land-numbers-inner">
        <div class="land-section-eyebrow" style="color:var(--fst-dim-text)">В цифрах</div>
        <h2 class="land-section-h2">Суверенный фонд<br><span>нового поколения</span></h2>
        <div class="land-numbers-grid">
          <div v-for="n in numbers" :key="n.label" class="land-number">
            <div class="land-number-val" :style="{ color: n.color }">{{ n.val }}</div>
            <div class="land-number-label">{{ n.label }}</div>
            <div class="land-number-desc">{{ n.desc }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════ SUPPORT -->
    <section id="support" class="land-support-section">
      <div class="land-section-eyebrow">Партнёрская модель</div>
      <h2 class="land-section-h2">Мы с вами до выхода —<br><span>не просто финансируем</span></h2>
      <p class="land-section-sub">ФСТ НТИ не просто даёт деньги. Мы берём на себя всю операционную нагрузку, чтобы фаундеры занимались продуктом.</p>
      <div class="land-support-grid">
        <div v-for="s in support" :key="s.id" class="land-support-card" :style="{ '--supc': s.color }">
          <div class="land-support-icon"><i :class="s.icon"></i></div>
          <div class="land-support-title">{{ s.title }}</div>
          <div class="land-support-text">{{ s.text }}</div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════ MODULES -->
    <section id="modules" class="land-modules-section">
      <div class="land-section-eyebrow">Платформа</div>
      <h2 class="land-section-h2">Полный стек инструментов<br><span>для суверенного инвестора</span></h2>
      <div class="land-modules">
        <div v-for="m in modules" :key="m.id" class="land-module" :style="{ '--mc': m.color }" @click="go(m.path)">
          <div class="land-module-glow"></div>
          <div class="land-module-icon"><i :class="m.icon"></i></div>
          <div class="land-module-name">{{ m.name }}</div>
          <div class="land-module-desc">{{ m.desc }}</div>
          <div class="land-module-arrow"><i class="pi pi-arrow-up-right"></i></div>
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════ CTA -->
    <section class="land-cta-section">
      <div class="land-cta-bg"></div>
      <div class="land-cta-glow"></div>
      <div class="land-cta-inner">
        <div class="land-cta-badge">Готовы начать?</div>
        <h2 class="land-cta-h2">Подайте заявку в ФСТ НТИ</h2>
        <p class="land-cta-sub">
          Поделитесь ссылками на проект — AI-агент сам соберёт данные,<br>
          оценит команду и за 48 часов подготовит протокол инвесткомитета.
        </p>
        <div class="land-cta-btns">
          <button class="land-btn-cta" @click="go('/fst-apply')">
            <i class="pi pi-file-plus"></i>
            Подать заявку
          </button>
          <button class="land-btn-cta-ghost" @click="go('/fst-hub')">
            <i class="pi pi-th-large"></i>
            Открыть платформу
          </button>
        </div>
        <div class="land-cta-note">
          Бесплатно для стартапов БАС · Суверенные технологии · Фонд НТИ
        </div>
      </div>
    </section>

    <!-- ═══════════════════════════════════════════ FOOTER -->
    <footer class="land-footer">
      <div class="land-footer-inner">
        <div class="land-footer-brand">
          <div class="land-logo-mark land-logo-mark--sm">ФСТ</div>
          <div>
            <div class="land-footer-name">Фонд Суверенных Технологий НТИ</div>
            <div class="land-footer-sub">Перестраиваем процессы, а не автоматизируем их · v2026.03</div>
          </div>
        </div>
        <div class="land-footer-links">
          <span @click="go('/fst-hub')" class="land-footer-link">Платформа</span>
          <span @click="go('/fst-committee')" class="land-footer-link">Инвесткомитет</span>
          <span @click="go('/fst-apply')" class="land-footer-link">Подать заявку</span>
          <span @click="go('/fst-portfolio')" class="land-footer-link">Портфель</span>
        </div>
        <div class="land-footer-right">Powered by DronDoc Platform</div>
      </div>
    </footer>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const now = ref(new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }))
function go(path) { router.push(path) }

const stats = [
  { val: '48 ч', label: 'Среднее время решения' },
  { val: '6', label: 'AI-агентов ИК' },
  { val: '3', label: 'Субфонда' },
  { val: '100%', label: 'Прозрачность' },
]

const pillars = [
  { id: 1, icon: 'pi pi-eye', color: '#a78bfa', title: 'Прозрачность', text: 'Каждое решение сопровождается протоколом дебатов. Стартап видит аргументы каждого из 6 AI-агентов.' },
  { id: 2, icon: 'pi pi-bolt', color: '#f59e0b', title: 'Скорость', text: '48 часов вместо 3–6 месяцев. AI-агент парсит данные → строит предметную карту → инвесткомитет → решение.' },
  { id: 3, icon: 'pi pi-shield', color: '#34d399', title: 'Суверенность', text: 'Единственный фонд, где суверенность (0–9) является обязательным критерием оценки каждой заявки.' },
  { id: 4, icon: 'pi pi-sitemap', color: '#38bdf8', title: 'Карта знаний', text: 'Вместо PDF и Excel — цифровой профиль проекта по доменной модели рынка НТИ. Агенты работают с контекстом, а не с текстом.' },
  { id: 5, icon: 'pi pi-compass', color: '#22d3ee', title: 'Сопровождение', text: 'Упаковываем стартап: юридика, финмодель, IR-материалы, менторство. Помогаем решить все задачи на пути к росту.' },
  { id: 6, icon: 'pi pi-thumbs-up', color: '#fb923c', title: 'Френдли структура', text: 'Условия, понятные основателям. Открытый Term Sheet, партнёрская модель, без скрытых ковенантов и давления.' },
]

const oldProcess = [
  'Стартап шлёт PDF на email',
  'Менеджер вручную переносит в Excel',
  'Скоринг по чужому шаблону',
  'Закрытое совещание без фиксации',
  'Решение: «одобрено» или «отказано»',
]

const newProcess = [
  'AI-агент парсит данные из открытых источников',
  'Оценка психотипов команды по интервью',
  'AI строит цифровой профиль проекта по карте рынка',
  'Инвесткомитет: 6 AI-агентов дебатируют',
  'Решение + протокол дебатов доступны стартапу',
]

const pipeline = [
  { id: 1, name: 'Заявка', sub: 'AI-парсинг · Интервью команды', icon: 'pi pi-file-plus', color: '#38bdf8', path: '/fst-apply' },
  { id: 2, name: 'Инвесткомитет', sub: '6 AI-агентов дебатируют', icon: 'pi pi-users', color: '#a78bfa', path: '/fst-committee' },
  { id: 3, name: 'Term Sheet', sub: 'Equity / CLN / Грант', icon: 'pi pi-file-edit', color: '#fb923c', path: '/fst-deal' },
  { id: 4, name: 'Исполнение', sub: 'KPI-транши · Kanban', icon: 'pi pi-list-check', color: '#34d399', path: '/fst-execution' },
  { id: 5, name: 'Мониторинг', sub: 'Светофор рисков · ЕГРЮЛ', icon: 'pi pi-chart-scatter', color: '#22d3ee', path: '/fst-portfolio' },
  { id: 6, name: 'Выход', sub: 'MOIC · IRR · DPI', icon: 'pi pi-flag', color: '#f87171', path: '/fst-fund' },
]

const numbers = [
  { val: '48 ч', label: 'Время решения', desc: 'Среднее время от заявки до протокола ИК', color: '#a78bfa' },
  { val: '6', label: 'AI-агентов', desc: 'Технолог, финансист, суверенность, риск, стратег, критический аналитик', color: '#38bdf8' },
  { val: '9D', label: 'Суверенность', desc: 'Девятимерная матрица оценки суверенности технологии', color: '#34d399' },
  { val: '3', label: 'Субфонда', desc: 'БАС · Робототехника · Машиностроение', color: '#fb923c' },
  { val: 'AI+Ч', label: 'Управление', desc: 'Когнитивные цепочки 6 агентов + финальное решение человека. Governance смешанной среды.', color: '#f59e0b' },
  { val: 'AI+', label: 'Карта знаний', desc: 'Цифровые профили рынка НТИ — агенты работают с контекстом, а не с текстом PDF', color: '#f87171' },
]

const support = [
  { id: 1, icon: 'pi pi-box', color: '#a78bfa', title: 'Упаковка стартапа', text: 'Питч-дек, финансовая модель, дью-дилидженс — готовим полный пакет материалов для инвесторов и партнёров.' },
  { id: 2, icon: 'pi pi-verified', color: '#34d399', title: 'Юридика и SPV', text: 'Структурирование сделки, SPV, Term Sheet, корпоративные документы. Совместно с доверенными партнёрами.' },
  { id: 3, icon: 'pi pi-chart-line', color: '#38bdf8', title: 'Финансовая модель', text: 'AI строит и актуализирует финмодель. Сценарный анализ, прогноз runway, оценка стоимости — в реальном времени.' },
  { id: 4, icon: 'pi pi-users', color: '#fb923c', title: 'Оценка команды', text: 'Психотипирование основателей по интервью, карта компетенций, анализ gap-ов. Не форма — живая беседа с AI.' },
  { id: 5, icon: 'pi pi-globe', color: '#22d3ee', title: 'Выход на рынок', text: 'Помогаем найти первых клиентов, партнёров по интеграции и государственных заказчиков в экосистеме НТИ.' },
  { id: 6, icon: 'pi pi-comments', color: '#f59e0b', title: 'Менторство', text: 'Доступ к сети экспертов фонда: технологи, CTO, серийные предприниматели. Регулярные сессии и разборы.' },
]

const modules = [
  { id: 1, icon: 'pi pi-users', color: '#a78bfa', name: 'AI Инвесткомитет', desc: '6 агентов · Многораундовые дебаты · Голосование', path: '/fst-committee' },
  { id: 2, icon: 'pi pi-file-edit', color: '#fb923c', name: 'Доведение сделки', desc: 'Term Sheet · SPV · Транши с KPI-триггерами', path: '/fst-deal' },
  { id: 3, icon: 'pi pi-list-check', color: '#34d399', name: 'Исполнение', desc: 'Kanban · KPI · Разблокировка транша 2', path: '/fst-execution' },
  { id: 4, icon: 'pi pi-chart-scatter', color: '#22d3ee', name: 'Портфельный монитор', desc: 'Светофор · ЕГРЮЛ · HH.ru · AI-отчёт', path: '/fst-portfolio' },
  { id: 5, icon: 'pi pi-building', color: '#38bdf8', name: 'Цифровой двойник фонда', desc: 'NAV · IRR · DPI · 3 субфонда', path: '/fst-fund' },
  { id: 6, icon: 'pi pi-desktop', color: '#f87171', name: 'Цифровой двойник компании', desc: 'Live-симуляция · Burn rate · Survival AI', path: '/fst-twin' },
]
</script>

<style scoped>
/* ════════════════════════════════════════════════════════ BASE */
.land {
  background: var(--p-surface-card);
  color: var(--p-text-color);
  font-family: 'Onest', -apple-system, sans-serif;
  min-height: 100vh;
  overflow-x: hidden;
}

/* ════════════════════════════════════════════════════════ NAV */
.land-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 0 48px;
  height: 64px;
  background: var(--fst-nav-backdrop);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--fst-glass-xs);
}
.land-nav-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 48px;
}
.land-logo-mark {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 900;
  color: #fff;
  letter-spacing: -0.02em;
  flex-shrink: 0;
}
.land-logo-mark--sm { width: 32px; height: 32px; font-size: 11px; border-radius: 8px; }
.land-logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.land-logo-text span:first-child { font-size: 12px; color: var(--p-text-muted-color); }
.land-logo-text span:last-child { font-size: 13px; font-weight: 700; color: var(--p-text-color); }

.land-nav-links {
  display: flex;
  gap: 32px;
  flex: 1;
}
.land-nav-links a {
  font-size: 13px;
  color: var(--p-text-muted-color);
  text-decoration: none;
  transition: color 0.15s;
}
.land-nav-links a:hover { color: var(--p-text-color); }

.land-nav-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
.land-nav-btn {
  padding: 7px 18px;
  background: transparent;
  border: 1px solid var(--fst-glass-md);
  border-radius: 8px;
  color: var(--p-text-muted-color);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.land-nav-btn:hover { border-color: var(--fst-glass-xl); color: var(--p-text-color); }
.land-nav-cta {
  padding: 7px 18px;
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 2px 12px rgba(124,58,237,0.4);
}
.land-nav-cta:hover { box-shadow: 0 4px 20px rgba(124,58,237,0.6); transform: translateY(-1px); }

/* ════════════════════════════════════════════════════════ HERO */
.land-hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 64px 48px 80px;
}

.land-bg-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(124,58,237,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(124,58,237,0.06) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
}
.land-bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
}
.land-bg-glow--v {
  width: 700px; height: 700px;
  background: radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 60%);
  top: -150px; left: -150px;
  animation: heroGlow1 12s ease-in-out infinite;
}
.land-bg-glow--b {
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 60%);
  bottom: -100px; right: -100px;
  animation: heroGlow2 15s ease-in-out infinite;
}
@keyframes heroGlow1 {
  0%, 100% { transform: translate(0,0) scale(1); }
  50% { transform: translate(60px, 40px) scale(1.1); }
}
@keyframes heroGlow2 {
  0%, 100% { transform: translate(0,0) scale(1); }
  50% { transform: translate(-40px, -30px) scale(1.08); }
}
.land-bg-noise {
  position: absolute; inset: 0;
  opacity: 0.02;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
}

.land-orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.land-orb--1 {
  width: 280px; height: 280px;
  background: radial-gradient(circle, rgba(124,58,237,0.12), transparent 70%);
  top: 20%; right: 15%;
  animation: orbFloat 10s ease-in-out infinite;
}
.land-orb--2 {
  width: 180px; height: 180px;
  background: radial-gradient(circle, rgba(37,99,235,0.1), transparent 70%);
  top: 60%; right: 25%;
  animation: orbFloat 14s ease-in-out infinite reverse;
}
.land-orb--3 {
  width: 120px; height: 120px;
  background: radial-gradient(circle, rgba(52,211,153,0.08), transparent 70%);
  bottom: 20%; left: 20%;
  animation: orbFloat 8s ease-in-out infinite 2s;
}
@keyframes orbFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-40px); }
}

.land-hero-inner {
  position: relative;
  z-index: 2;
  text-align: center;
  max-width: 860px;
}

.land-hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--p-text-muted-color);
  background: var(--fst-glass-xs);
  border: 1px solid var(--fst-glass-md);
  border-radius: 100px;
  padding: 6px 18px;
  margin-bottom: 40px;
  backdrop-filter: blur(8px);
}
.land-live {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 10px #34d399;
  animation: livePulse 2s infinite;
  flex-shrink: 0;
}
@keyframes livePulse {
  0%,100% { box-shadow: 0 0 6px #34d399; }
  50% { box-shadow: 0 0 16px #34d399; }
}
.land-hero-badge-sep { width: 1px; height: 12px; background: var(--fst-glass-lg); }
.land-hero-badge-tag {
  background: rgba(124,58,237,0.2);
  color: #a78bfa;
  padding: 1px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}

.land-hero-h1 {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0 0 28px;
  line-height: 1.05;
  letter-spacing: -0.03em;
}
.land-h1-line {
  font-size: clamp(40px, 6vw, 80px);
  font-weight: 900;
  color: var(--p-text-color);
}
.land-h1-accent {
  background: linear-gradient(135deg, #a78bfa 0%, #38bdf8 40%, #34d399 80%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.land-hero-p {
  font-size: clamp(16px, 2vw, 20px);
  color: var(--p-text-muted-color);
  line-height: 1.7;
  margin: 0 0 40px;
}
.land-hero-p strong { color: #f59e0b; font-weight: 700; }

.land-hero-btns {
  display: flex;
  gap: 14px;
  justify-content: center;
  margin-bottom: 56px;
  flex-wrap: wrap;
}
.land-btn-hero {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 36px;
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 32px rgba(124,58,237,0.45);
}
.land-btn-hero:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 48px rgba(124,58,237,0.65);
}
.land-btn-hero-ghost {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 36px;
  background: var(--fst-glass-xs);
  border: 1px solid var(--fst-glass-md);
  border-radius: 12px;
  color: var(--p-text-color);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(8px);
}
.land-btn-hero-ghost:hover {
  background: var(--fst-glass-md);
  border-color: rgba(167,139,250,0.4);
  transform: translateY(-3px);
}

/* Stats */
.land-hero-stats {
  display: flex;
  gap: 0;
  justify-content: center;
  border: 1px solid var(--fst-glass-sm);
  border-radius: 16px;
  background: var(--fst-glass-xs);
  backdrop-filter: blur(8px);
  overflow: hidden;
  max-width: 600px;
  margin: 0 auto;
}
.land-stat {
  flex: 1;
  padding: 20px 16px;
  text-align: center;
  border-right: 1px solid var(--fst-glass-xs);
}
.land-stat:last-child { border-right: none; }
.land-stat-val {
  font-size: 26px;
  font-weight: 800;
  color: var(--p-text-color);
  letter-spacing: -0.02em;
  line-height: 1;
}
.land-stat-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-top: 5px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

/* Scroll hint */
.land-scroll-hint {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--p-text-muted-color);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  animation: scrollBounce 2s ease-in-out infinite;
}
.land-scroll-line {
  width: 1px;
  height: 32px;
  background: linear-gradient(to bottom, transparent, #334155);
}
@keyframes scrollBounce {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(6px); }
}

/* ════════════════════════════════════════════════════ PILLARS */
.land-pillars {
  padding: 80px 48px;
  background: rgba(255,255,255,0.015);
  border-top: 1px solid var(--fst-glass-xs);
  border-bottom: 1px solid var(--fst-glass-xs);
}
.land-pillars-inner {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  max-width: 1100px;
  margin: 0 auto;
}
.land-pillar {
  padding: 32px;
  border: 1px solid var(--fst-glass-sm);
  border-top: 3px solid var(--pc);
  border-radius: 14px;
  background: var(--fst-glass-xs);
  transition: all 0.2s;
}
.land-pillar:hover {
  background: var(--fst-glass-xs);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 24px color-mix(in srgb, var(--pc) 10%, transparent);
}
.land-pillar-icon {
  width: 48px; height: 48px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--pc) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--pc) 25%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--pc);
  margin-bottom: 16px;
}
.land-pillar-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 10px;
}
.land-pillar-text {
  font-size: 14px;
  color: var(--p-text-muted-color);
  line-height: 1.7;
}

/* ════════════════════════════════════════════════ SECTION SHARED */
.land-section-eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
  margin-bottom: 16px;
  text-align: center;
}
.land-section-h2 {
  font-size: clamp(28px, 4vw, 48px);
  font-weight: 800;
  color: var(--p-text-color);
  text-align: center;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 0 0 56px;
}
.land-section-h2 span {
  background: linear-gradient(135deg, #a78bfa, #38bdf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.land-section-sub {
  font-size: 16px;
  color: var(--p-text-muted-color);
  text-align: center;
  max-width: 620px;
  margin: -36px auto 48px;
  line-height: 1.7;
}

/* ════════════════════════════════════════════════ PROCESS */
.land-process {
  padding: 100px 48px;
  max-width: 1200px;
  margin: 0 auto;
}
.land-compare {
  display: flex;
  gap: 0;
  align-items: stretch;
}
.land-compare-col {
  flex: 1;
  padding: 32px;
  border-radius: 16px;
}
.land-compare-col--old {
  background: rgba(239,68,68,0.04);
  border: 1px solid rgba(239,68,68,0.1);
}
.land-compare-col--new {
  background: rgba(52,211,153,0.04);
  border: 1px solid rgba(52,211,153,0.1);
}
.land-compare-vs {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  gap: 12px;
  flex-shrink: 0;
}
.land-vs-line {
  width: 1px; flex: 1;
  background: linear-gradient(to bottom, transparent, var(--fst-glass-md), transparent);
}
.land-vs-badge {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--p-text-muted-color);
  background: var(--fst-glass-xs);
  border: 1px solid var(--fst-glass-sm);
  border-radius: 6px;
  padding: 4px 8px;
}
.land-compare-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 20px;
}
.land-compare-col--old .land-compare-header { color: #f87171; }
.land-compare-col--new .land-compare-header { color: #34d399; }
.land-compare-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
}
.land-compare-dot--red { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
.land-compare-dot--green { background: #34d399; box-shadow: 0 0 8px #34d399; }
.land-compare-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.land-compare-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.4;
}
.land-compare-step--old {
  background: rgba(239,68,68,0.05);
  border-left: 2px solid rgba(239,68,68,0.2);
  color: var(--p-text-muted-color);
}
.land-compare-step--new {
  background: rgba(52,211,153,0.05);
  border-left: 2px solid rgba(52,211,153,0.3);
  color: var(--p-text-color);
}
.land-step-num {
  font-size: 11px;
  font-weight: 700;
  color: var(--p-text-muted-color);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  margin-top: 1px;
}
.land-compare-outcome {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 14px;
  margin-top: 4px;
}
.land-compare-outcome--bad {
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.2);
  color: #f87171;
}
.land-compare-outcome--good {
  background: rgba(52,211,153,0.1);
  border: 1px solid rgba(52,211,153,0.2);
  color: #34d399;
}
.land-compare-outcome strong { font-weight: 800; }

/* ════════════════════════════════════════════════ PIPELINE */
.land-pipeline-section {
  padding: 100px 48px;
  border-top: 1px solid var(--fst-glass-xs);
  border-bottom: 1px solid var(--fst-glass-xs);
  background: var(--fst-glass-xs);
}
.land-pipeline {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
  max-width: 1200px;
  margin: 0 auto;
  overflow-x: auto;
  padding-bottom: 8px;
}
.land-pipe-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  flex-shrink: 0;
}
.land-pipe-num {
  font-size: 11px;
  font-weight: 700;
  color: var(--sc);
  opacity: 0.6;
  margin-bottom: 8px;
  font-variant-numeric: tabular-nums;
}
.land-pipe-icon-wrap {
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: center;
  margin-bottom: 12px;
}
.land-pipe-icon {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--sc) 12%, transparent);
  border: 2px solid color-mix(in srgb, var(--sc) 30%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  color: var(--sc);
  box-shadow: 0 0 24px color-mix(in srgb, var(--sc) 20%, transparent);
  transition: all 0.2s;
  cursor: pointer;
  flex-shrink: 0;
}
.land-pipe-icon:hover {
  box-shadow: 0 0 40px color-mix(in srgb, var(--sc) 40%, transparent);
  transform: scale(1.1);
}
.land-pipe-connector {
  flex: 1;
  height: 2px;
  min-width: 40px;
  max-width: 80px;
  background: repeating-linear-gradient(
    to right,
    var(--fst-glass-lg) 0px, var(--fst-glass-lg) 4px,
    transparent 4px, transparent 10px
  );
}
.land-pipe-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--p-text-color);
  padding: 0 12px;
}
.land-pipe-sub {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-top: 4px;
  padding: 0 12px;
  line-height: 1.3;
}

/* ════════════════════════════════════════════════ NUMBERS */
.land-numbers {
  position: relative;
  padding: 100px 48px;
  overflow: hidden;
}
.land-numbers-bg {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent, rgba(124,58,237,0.06) 50%, transparent);
}
.land-numbers-inner {
  position: relative;
  max-width: 1100px;
  margin: 0 auto;
}
.land-numbers-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  background: var(--fst-glass-xs);
  border: 1px solid var(--fst-glass-sm);
  border-radius: 16px;
  overflow: hidden;
}
.land-number {
  padding: 36px 32px;
  background: rgba(3,6,15,0.8);
  transition: background 0.2s;
}
.land-number:hover { background: var(--fst-glass-xs); }
.land-number-val {
  font-size: 52px;
  font-weight: 900;
  letter-spacing: -0.04em;
  line-height: 1;
  margin-bottom: 8px;
}
.land-number-label {
  font-size: 16px;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 6px;
}
.land-number-desc {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

/* ════════════════════════════════════════════════ SUPPORT */
.land-support-section {
  padding: 100px 48px;
  border-top: 1px solid var(--fst-glass-xs);
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}
.land-support-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 56px;
}
.land-support-card {
  padding: 28px;
  background: rgba(255,255,255,0.025);
  border: 1px solid var(--fst-glass-sm);
  border-top: 3px solid var(--supc);
  border-radius: 14px;
  text-align: left;
  transition: all 0.2s;
}
.land-support-card:hover {
  box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 20px color-mix(in srgb, var(--supc) 10%, transparent);
  transform: translateY(-3px);
}
.land-support-icon {
  width: 44px; height: 44px;
  border-radius: 11px;
  background: color-mix(in srgb, var(--supc) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--supc) 25%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--supc);
  margin-bottom: 16px;
}
.land-support-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 8px;
}
.land-support-text {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.7;
}

/* ════════════════════════════════════════════════ MODULES */
.land-modules-section {
  padding: 100px 48px;
  border-top: 1px solid var(--fst-glass-xs);
  max-width: 1200px;
  margin: 0 auto;
}
.land-modules {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.land-module {
  position: relative;
  overflow: hidden;
  padding: 28px;
  background: rgba(255,255,255,0.025);
  border: 1px solid var(--fst-glass-sm);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.25s;
}
.land-module:hover {
  border-color: color-mix(in srgb, var(--mc) 40%, transparent);
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.4), 0 0 30px color-mix(in srgb, var(--mc) 8%, transparent);
}
.land-module-glow {
  position: absolute;
  top: 0; right: 0;
  width: 100px; height: 100px;
  background: radial-gradient(circle at top right, color-mix(in srgb, var(--mc) 15%, transparent), transparent 70%);
  pointer-events: none;
}
.land-module-icon {
  width: 48px; height: 48px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--mc) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--mc) 25%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--mc);
  margin-bottom: 16px;
}
.land-module-name {
  font-size: 17px;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 8px;
}
.land-module-desc {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.55;
}
.land-module-arrow {
  position: absolute;
  bottom: 20px; right: 20px;
  font-size: 14px;
  color: var(--p-text-muted-color);
  transition: color 0.2s, transform 0.2s;
}
.land-module:hover .land-module-arrow {
  color: var(--mc);
  transform: translate(2px, -2px);
}

/* ════════════════════════════════════════════════ CTA */
.land-cta-section {
  position: relative;
  padding: 120px 48px;
  text-align: center;
  overflow: hidden;
  border-top: 1px solid var(--fst-glass-xs);
}
.land-cta-bg {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 80% 60% at 50% 50%, rgba(124,58,237,0.1), transparent 70%);
}
.land-cta-glow {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(124,58,237,0.08), transparent 60%);
  filter: blur(60px);
  pointer-events: none;
}
.land-cta-inner { position: relative; max-width: 700px; margin: 0 auto; }
.land-cta-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #a78bfa;
  background: rgba(167,139,250,0.1);
  border: 1px solid rgba(167,139,250,0.2);
  border-radius: 100px;
  padding: 5px 16px;
  margin-bottom: 24px;
}
.land-cta-h2 {
  font-size: clamp(32px, 5vw, 56px);
  font-weight: 900;
  color: var(--p-text-color);
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin: 0 0 20px;
}
.land-cta-sub {
  font-size: 17px;
  color: var(--p-text-muted-color);
  line-height: 1.7;
  margin: 0 0 40px;
}
.land-cta-btns {
  display: flex;
  gap: 14px;
  justify-content: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.land-btn-cta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 40px;
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 40px rgba(124,58,237,0.5);
}
.land-btn-cta:hover { transform: translateY(-3px); box-shadow: 0 8px 56px rgba(124,58,237,0.7); }
.land-btn-cta-ghost {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 16px 40px;
  background: var(--fst-glass-xs);
  border: 1px solid var(--fst-glass-md);
  border-radius: 12px;
  color: var(--p-text-color);
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.land-btn-cta-ghost:hover { background: var(--fst-glass-md); transform: translateY(-3px); }
.land-cta-note {
  font-size: 12px;
  color: var(--p-text-muted-color);
}

/* ════════════════════════════════════════════════ FOOTER */
.land-footer {
  padding: 32px 48px;
  border-top: 1px solid var(--fst-glass-xs);
  background: var(--fst-glass-xs);
}
.land-footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  max-width: 1200px;
  margin: 0 auto;
}
.land-footer-brand { display: flex; align-items: center; gap: 12px; }
.land-footer-name { font-size: 14px; font-weight: 700; color: var(--p-text-muted-color); }
.land-footer-sub { font-size: 11px; color: var(--p-text-muted-color); margin-top: 2px; }
.land-footer-links { display: flex; gap: 24px; }
.land-footer-link {
  font-size: 13px;
  color: var(--p-text-muted-color);
  cursor: pointer;
  transition: color 0.15s;
}
.land-footer-link:hover { color: var(--p-text-muted-color); }
.land-footer-right { font-size: 12px; color: #1e293b; }

/* ════════════════════════════════════════════════ RESPONSIVE */
@media (max-width: 1024px) {
  .land-numbers-grid { grid-template-columns: repeat(2, 1fr); }
  .land-modules { grid-template-columns: repeat(2, 1fr); }
  .land-pillars-inner { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .land-nav { padding: 0 20px; }
  .land-nav-links { display: none; }
  .land-hero { padding: 80px 20px 60px; }
  .land-process { padding: 60px 20px; }
  .land-compare { flex-direction: column; gap: 16px; }
  .land-compare-vs { flex-direction: row; padding: 8px 0; }
  .land-vs-line { width: 40px; height: 1px; flex: none; background: var(--fst-glass-md); }
  .land-pipeline-section { padding: 60px 20px; }
  .land-numbers { padding: 60px 20px; }
  .land-numbers-grid { grid-template-columns: 1fr; }
  .land-support-section { padding: 60px 20px; }
  .land-support-grid { grid-template-columns: 1fr; }
  .land-modules-section { padding: 60px 20px; max-width: 100%; }
  .land-modules { grid-template-columns: 1fr; }
  .land-cta-section { padding: 80px 20px; }
  .land-footer { padding: 24px 20px; }
  .land-footer-inner { flex-direction: column; align-items: flex-start; gap: 16px; }
}
</style>
