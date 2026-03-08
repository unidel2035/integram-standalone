<template>
  <div class="fst-transparency-root">
    <!-- Header -->
    <div class="fst-tr-header">
      <div class="fst-tr-header-left">
        <div class="fst-tr-logo">
          <i class="pi pi-shield" style="color:#42a5f5;font-size:20px"></i>
          <span>ФСТ НТИ · <b>Публичная витрина</b></span>
          <Tag value="Santiago Principles®" severity="success" style="font-size:11px" />
        </div>
        <div class="fst-tr-updated">
          <i class="pi pi-circle-fill" :style="{ color: '#66bb6a', fontSize:'8px' }"></i>
          Обновлено: {{ lastUpdate }}
        </div>
      </div>
      <div class="fst-tr-header-right">
        <Button icon="pi pi-download" label="Скачать IM" size="small" severity="secondary" @click="downloadIM" />
        <Button icon="pi pi-lock" label="Investor Data Room" size="small" severity="info" @click="showDataRoom = true" />
      </div>
    </div>

    <!-- Hero Section -->
    <div class="fst-tr-hero">
      <div class="fst-tr-hero-content">
        <h1 class="fst-tr-hero-title">Фонд Суверенных Технологий НТИ</h1>
        <p class="fst-tr-hero-subtitle">
          Государственный венчурный фонд, инвестирующий в суверенные технологии критических отраслей России.
          Полное соответствие стандарту Santiago Principles® (IFSWF).
        </p>
        <div class="fst-tr-hero-stats">
          <div v-for="s in heroStats" :key="s.label" class="fst-tr-stat">
            <div class="fst-tr-stat-val">{{ s.val }}</div>
            <div class="fst-tr-stat-label">{{ s.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="fst-tr-main">

      <!-- Fund Overview -->
      <div class="fst-tr-panel">
        <div class="fst-tr-panel-title">
          <i class="pi pi-building-columns" style="color:#42a5f5"></i> Обзор фонда
        </div>
        <div class="fst-tr-overview-grid">
          <div v-for="item in fundOverview" :key="item.label" class="fst-tr-overview-item">
            <div class="fst-tr-ov-label">{{ item.label }}</div>
            <div class="fst-tr-ov-val">{{ item.value }}</div>
          </div>
        </div>
      </div>

      <!-- Strategy -->
      <div class="fst-tr-panel">
        <div class="fst-tr-panel-title">
          <i class="pi pi-compass" style="color:#66bb6a"></i> Инвестиционная стратегия
        </div>
        <div class="fst-tr-strategy">
          <div v-for="s in strategy" :key="s.name" class="fst-tr-strategy-item">
            <div class="fst-tr-strategy-header">
              <i :class="s.icon" :style="{ color: s.color }"></i>
              <b>{{ s.name }}</b>
            </div>
            <div class="fst-tr-strategy-desc">{{ s.desc }}</div>
          </div>
        </div>
      </div>

      <!-- Santiago Principles Compliance -->
      <div class="fst-tr-panel">
        <div class="fst-tr-panel-title">
          <i class="pi pi-verified" style="color:#ffa726"></i> Santiago Principles® Compliance
        </div>
        <div class="fst-tr-principles">
          <div v-for="p in santiagoPrinciples" :key="p.code" class="fst-tr-principle">
            <div class="fst-tr-pr-header">
              <div class="fst-tr-pr-code">{{ p.code }}</div>
              <div class="fst-tr-pr-status" :class="statusClass(p.status)">
                <i :class="statusIcon(p.status)"></i>
                {{ statusLabel(p.status) }}
              </div>
            </div>
            <div class="fst-tr-pr-title">{{ p.title }}</div>
            <div class="fst-tr-pr-doc">{{ p.document }}</div>
          </div>
        </div>
      </div>

      <!-- ESG & Compliance -->
      <div class="fst-tr-panel">
        <div class="fst-tr-panel-title">
          <i class="pi pi-shield" style="color:#ab47bc"></i> ESG и соответствие регулированию
        </div>
        <div class="fst-tr-esg-grid">
          <div v-for="item in esgCompliance" :key="item.title" class="fst-tr-esg-item">
            <div class="fst-tr-esg-icon" :style="{ background: item.color + '20', color: item.color }">
              <i :class="item.icon"></i>
            </div>
            <div class="fst-tr-esg-body">
              <div class="fst-tr-esg-title">{{ item.title }}</div>
              <div class="fst-tr-esg-desc">{{ item.desc }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Governance Structure -->
      <div class="fst-tr-panel">
        <div class="fst-tr-panel-title">
          <i class="pi pi-sitemap" style="color:#26c6da"></i> Структура управления
        </div>
        <div class="fst-tr-governance">
          <div v-for="g in governance" :key="g.role" class="fst-tr-gov-item">
            <div class="fst-tr-gov-role">{{ g.role }}</div>
            <div class="fst-tr-gov-body">{{ g.body }}</div>
            <div class="fst-tr-gov-desc">{{ g.desc }}</div>
          </div>
        </div>
      </div>

      <!-- Team -->
      <div class="fst-tr-panel">
        <div class="fst-tr-panel-title">
          <i class="pi pi-users" style="color:#ef5350"></i> Команда
        </div>
        <div class="fst-tr-team-grid">
          <div v-for="m in team" :key="m.name" class="fst-tr-team-member">
            <div class="fst-tr-tm-avatar">
              <i class="pi pi-user"></i>
            </div>
            <div class="fst-tr-tm-name">{{ m.name }}</div>
            <div class="fst-tr-tm-role">{{ m.role }}</div>
            <div class="fst-tr-tm-bio">{{ m.bio }}</div>
          </div>
        </div>
      </div>

      <!-- Regulatory Status -->
      <div class="fst-tr-panel">
        <div class="fst-tr-panel-title">
          <i class="pi pi-file-check" style="color:#7e57c2"></i> Регуляторный статус
        </div>
        <div class="fst-tr-regulatory">
          <div v-for="r in regulatoryStatus" :key="r.title" class="fst-tr-reg-item">
            <div class="fst-tr-reg-icon">
              <i :class="r.icon" :style="{ color: r.color }"></i>
            </div>
            <div class="fst-tr-reg-body">
              <div class="fst-tr-reg-title">{{ r.title }}</div>
              <div class="fst-tr-reg-desc">{{ r.desc }}</div>
              <div class="fst-tr-reg-status" :style="{ color: r.color }">{{ r.status }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contact & Data Room Access -->
      <div class="fst-tr-panel">
        <div class="fst-tr-panel-title">
          <i class="pi pi-envelope" style="color:#ffa726"></i> Контакты для инвесторов
        </div>
        <div class="fst-tr-contact">
          <p>Для получения доступа к защищённому Investor Data Room и детальной информации о фонде, пожалуйста, свяжитесь с нами:</p>
          <div class="fst-tr-contact-info">
            <div class="fst-tr-contact-item">
              <i class="pi pi-envelope"></i>
              <span>lp@fst-nti.ru</span>
            </div>
            <div class="fst-tr-contact-item">
              <i class="pi pi-phone"></i>
              <span>+7 (495) 123-45-67</span>
            </div>
            <div class="fst-tr-contact-item">
              <i class="pi pi-map-marker"></i>
              <span>Москва, ул. Профсоюзная 65</span>
            </div>
          </div>
          <Button label="Запросить доступ к Data Room" icon="pi pi-lock-open" severity="info" @click="requestAccess" />
        </div>
      </div>

    </div>

    <!-- Data Room Dialog -->
    <Dialog v-model:visible="showDataRoom" modal header="Investor Data Room" :style="{ width: '50vw' }">
      <div class="fst-tr-dataroom">
        <p style="margin-bottom:16px">Защищённый раздел для потенциальных LP. Доступ предоставляется после подписания NDA.</p>
        <div class="fst-tr-dataroom-sections">
          <div v-for="sec in dataRoomSections" :key="sec.title" class="fst-tr-dr-section">
            <i :class="sec.icon" style="font-size:18px;color:#42a5f5;margin-right:10px"></i>
            <div>
              <div style="font-weight:600;margin-bottom:4px">{{ sec.title }}</div>
              <div style="font-size:12px;color:var(--p-text-muted-color)">{{ sec.desc }}</div>
            </div>
          </div>
        </div>
        <Message severity="info" :closable="false">
          Для получения доступа отправьте запрос на lp@fst-nti.ru с темой "Investor Data Room Access"
        </Message>
      </div>
    </Dialog>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'

const toast = useToast()

const lastUpdate = ref(new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }))
const showDataRoom = ref(false)

const heroStats = ref([
  { val: '6,4 млрд ₽', label: 'AUM (активы под управлением)' },
  { val: '7', label: 'Портфельных компаний' },
  { val: '3', label: 'Субфонда (БАС, РОБО, МЭ)' },
  { val: '24/24', label: 'Santiago Principles' },
])

const fundOverview = ref([
  { label: 'Размер фонда', value: '6,4 млрд ₽' },
  { label: 'Горизонт инвестирования', value: '7 лет (2025–2032)' },
  { label: 'Стратегия', value: 'Venture capital в суверенные технологии' },
  { label: 'Стадия инвестиций', value: 'Pre-seed, Seed, Series A' },
  { label: 'Средний чек', value: '60–450 млн ₽' },
  { label: 'Управляющая компания', value: 'ООО «УК ФСТ НТИ»' },
  { label: 'Регулятор', value: 'Банк России (лицензия УК № 1234-ЦБ)' },
  { label: 'Целевой IRR', value: '22–28% (gross)' },
])

const strategy = ref([
  {
    name: 'Беспилотные авиационные системы (БАС)',
    icon: 'pi pi-send',
    color: '#42a5f5',
    desc: 'Инвестиции в разработку гражданских и двойного назначения БПЛА, навигационных систем, ПО и сенсоров. Фокус на TRL 4–7, суверенность компонентов >70%.'
  },
  {
    name: 'Робототехника (РОБО)',
    icon: 'pi pi-cog',
    color: '#66bb6a',
    desc: 'Промышленные роботы, коботы, автономные системы для агросектора и логистики. Акцент на локализацию приводов, контроллеров и vision-систем.'
  },
  {
    name: 'Микроэлектроника (МЭ)',
    icon: 'pi pi-microchip',
    color: '#ffa726',
    desc: 'Отечественные полупроводники, сенсоры, FPGA, аналоговая электроника. Поддержка переноса на российские фабрики (процессы ≥65нм–180нм).'
  },
])

const santiagoPrinciples = ref([
  { code: 'SP-1', title: 'Правовая база', status: 'compliant', document: 'Лицензия ЦБ РФ № 1234-ЦБ, ФЗ-156 «Об инвестиционных фондах»' },
  { code: 'SP-2', title: 'Цели фонда', status: 'compliant', document: 'Инвестиционная декларация утверждена 01.01.2025' },
  { code: 'SP-3', title: 'Независимость операционной деятельности', status: 'compliant', document: 'Политика управления конфликтами интересов' },
  { code: 'SP-6', title: 'Система управления рисками', status: 'compliant', document: 'Риск-менеджмент стандарт ISO 31000' },
  { code: 'SP-12', title: 'Структура управления', status: 'partial', document: 'Политика управления (обновление Q2 2026)' },
  { code: 'SP-15', title: 'Вознаграждение инвесткомитета', status: 'compliant', document: 'Раскрыто в ежегодной отчётности' },
  { code: 'SP-18', title: 'Инвестиционная политика', status: 'compliant', document: 'Investment Memorandum опубликован' },
  { code: 'SP-19', title: 'Публичное раскрытие активов', status: 'compliant', document: 'Портфель раскрыт (без конфиденциальных данных)' },
  { code: 'SP-22', title: 'ESG политика', status: 'partial', document: 'ESG Policy (утверждение Q3 2026)' },
  { code: 'SP-24', title: 'Ежегодная отчётность', status: 'compliant', document: 'Публикуется на сайте ежегодно (аудированная)' },
])

const esgCompliance = ref([
  {
    icon: 'pi pi-globe',
    color: '#66bb6a',
    title: 'ESG Policy',
    desc: 'Критерии социальной и экологической ответственности при оценке портфельных компаний. Carbon neutrality target 2030.'
  },
  {
    icon: 'pi pi-shield',
    color: '#ef5350',
    title: 'AML/KYC процедуры',
    desc: 'Полная проверка бенефициаров и источников финансирования согласно 115-ФЗ и рекомендациям FATF.'
  },
  {
    icon: 'pi pi-verified',
    color: '#42a5f5',
    title: 'Compliance',
    desc: 'Соблюдение требований Банка России, ФНС, ФСБУ 4/2023 (учёт инвестиций), МСФО 13 (справедливая стоимость).'
  },
  {
    icon: 'pi pi-book',
    color: '#ffa726',
    title: 'Кодекс поведения',
    desc: 'Этический кодекс сотрудников, политика нулевой толерантности к коррупции и конфликтам интересов.'
  },
])

const governance = ref([
  {
    role: 'Совет директоров',
    body: '7 членов (4 независимых)',
    desc: 'Стратегические решения, утверждение инвестиционной политики, контроль УК, ежеквартальный надзор.'
  },
  {
    role: 'Инвестиционный комитет',
    body: '6 AI-агентов + эксперты',
    desc: 'Оценка проектов, многораундовые дебаты, голосование по каждой сделке. Протоколы доступны стартапам.'
  },
  {
    role: 'Управляющая компания',
    body: 'ООО «УК ФСТ НТИ»',
    desc: 'Операционное управление, due diligence, постинвестиционный мониторинг, отчётность перед Советом директоров.'
  },
  {
    role: 'Комитет по рискам',
    body: '3 эксперта + CRO',
    desc: 'Ежемесячный мониторинг рисков портфеля, стресс-тесты, контроль концентрации, одобрение крупных сделок.'
  },
])

const team = ref([
  {
    name: 'Алексей Петров',
    role: 'Управляющий партнёр',
    bio: '15 лет в венчурных инвестициях, ранее — партнёр РВК. MBA Stanford.'
  },
  {
    name: 'Мария Смирнова',
    role: 'Инвестиционный директор (БАС)',
    bio: 'PhD Aerospace Engineering, 8 лет в разработке БПЛА в «Кронштадт».'
  },
  {
    name: 'Дмитрий Иванов',
    role: 'Инвестиционный директор (РОБО/МЭ)',
    bio: 'Ex-глава R&D в Ростех, 12 лет опыта в микроэлектронике и робототехнике.'
  },
  {
    name: 'Елена Соколова',
    role: 'CFO',
    bio: 'CFA, 10 лет в KPMG (audit & advisory), опыт IPO российских техкомпаний.'
  },
])

const regulatoryStatus = ref([
  {
    icon: 'pi pi-building',
    color: '#42a5f5',
    title: 'Лицензия УК',
    desc: 'Лицензия Банка России на осуществление деятельности по управлению инвестиционными фондами, паевыми инвестиционными фондами и негосударственными пенсионными фондами',
    status: '✅ № 1234-ЦБ (бессрочная)'
  },
  {
    icon: 'pi pi-shield',
    color: '#66bb6a',
    title: 'Регистрация фонда',
    desc: 'Закрытый паевой инвестиционный фонд особо рисковых (венчурных) инвестиций',
    status: '✅ Зарегистрирован в Банке России'
  },
  {
    icon: 'pi pi-file-check',
    color: '#ffa726',
    title: 'Аудит',
    desc: 'Независимый аудит финансовой отчётности по МСФО и РСБУ',
    status: '✅ Аудитор: Deloitte & Touche'
  },
  {
    icon: 'pi pi-verified',
    color: '#ab47bc',
    title: 'Раскрытие информации',
    desc: 'Соблюдение Указания ЦБ РФ № 5790-У о раскрытии информации УК',
    status: '✅ Публикуется ежеквартально'
  },
])

const dataRoomSections = ref([
  {
    icon: 'pi pi-book',
    title: 'Инвестиционный меморандум',
    desc: 'Детальное описание стратегии, track record команды, структура фонда, условия для LP'
  },
  {
    icon: 'pi pi-chart-line',
    title: 'Аудированная отчётность',
    desc: 'Финансовые отчёты МСФО за 2024–2025 годы, заключение Deloitte'
  },
  {
    icon: 'pi pi-briefcase',
    title: 'Track record портфеля',
    desc: 'Детальная информация по портфельным компаниям, MOIC, IRR, статус выходов'
  },
  {
    icon: 'pi pi-phone',
    title: 'Reference calls',
    desc: 'Контакты действующих LP для обратной связи (с согласия LP)'
  },
  {
    icon: 'pi pi-file-pdf',
    title: 'Правовая документация',
    desc: 'Устав фонда, ДУ, rules, политика инвестиций, compliance документы'
  },
])

function downloadIM() {
  toast.add({
    severity: 'info',
    summary: 'Инвестиционный меморандум',
    detail: 'Для получения полного IM отправьте запрос на lp@fst-nti.ru',
    life: 4000
  })
}

function requestAccess() {
  toast.add({
    severity: 'success',
    summary: 'Запрос отправлен',
    detail: 'Мы свяжемся с вами в течение 2 рабочих дней для согласования NDA',
    life: 4000
  })
  showDataRoom.value = false
}

function statusClass(status) {
  return {
    'fst-tr-status-ok': status === 'compliant',
    'fst-tr-status-partial': status === 'partial',
    'fst-tr-status-pending': status === 'pending'
  }
}

function statusIcon(status) {
  if (status === 'compliant') return 'pi pi-check-circle'
  if (status === 'partial') return 'pi pi-clock'
  return 'pi pi-exclamation-circle'
}

function statusLabel(status) {
  if (status === 'compliant') return 'Соответствует'
  if (status === 'partial') return 'Частично'
  return 'В процессе'
}
</script>

<style scoped>
.fst-transparency-root {
  background: var(--surface-ground);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--p-font-family);
}

/* Header */
.fst-tr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;
  gap: 12px;
  flex-wrap: wrap;
}
.fst-tr-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--p-text-color);
}
.fst-tr-updated {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.fst-tr-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Hero */
.fst-tr-hero {
  background: linear-gradient(135deg, rgba(66,165,245,0.08) 0%, rgba(102,187,106,0.08) 100%);
  border-bottom: 1px solid var(--surface-border);
  padding: 40px 24px;
}
.fst-tr-hero-content {
  max-width: 900px;
  margin: 0 auto;
}
.fst-tr-hero-title {
  font-size: 32px;
  font-weight: 800;
  color: var(--p-text-color);
  margin: 0 0 12px;
  letter-spacing: -0.02em;
}
.fst-tr-hero-subtitle {
  font-size: 16px;
  color: var(--p-text-muted-color);
  line-height: 1.6;
  margin: 0 0 32px;
}
.fst-tr-hero-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 20px;
}
.fst-tr-stat {
  text-align: center;
  padding: 16px;
  background: var(--surface-card);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}
.fst-tr-stat-val {
  font-size: 24px;
  font-weight: 700;
  color: var(--p-primary-color);
  margin-bottom: 6px;
}
.fst-tr-stat-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Main Content */
.fst-tr-main {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

/* Panel */
.fst-tr-panel {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 16px;
}
.fst-tr-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--surface-border);
}

/* Overview Grid */
.fst-tr-overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}
.fst-tr-overview-item {
  padding: 12px;
  background: var(--surface-ground);
  border-radius: 6px;
  border: 1px solid var(--surface-border);
}
.fst-tr-ov-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
  font-weight: 600;
}
.fst-tr-ov-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--p-text-color);
}

/* Strategy */
.fst-tr-strategy {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fst-tr-strategy-item {
  padding: 14px;
  background: var(--surface-ground);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
  border-left: 3px solid currentColor;
}
.fst-tr-strategy-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 8px;
}
.fst-tr-strategy-desc {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

/* Santiago Principles */
.fst-tr-principles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.fst-tr-principle {
  padding: 12px;
  background: var(--surface-ground);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}
.fst-tr-pr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.fst-tr-pr-code {
  font-size: 12px;
  font-weight: 700;
  color: var(--p-primary-color);
  font-family: monospace;
}
.fst-tr-pr-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
}
.fst-tr-status-ok {
  background: rgba(102,187,106,0.15);
  color: #66bb6a;
}
.fst-tr-status-partial {
  background: rgba(255,167,38,0.15);
  color: #ffa726;
}
.fst-tr-status-pending {
  background: rgba(239,83,80,0.15);
  color: #ef5350;
}
.fst-tr-pr-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 6px;
}
.fst-tr-pr-doc {
  font-size: 11px;
  color: var(--p-text-muted-color);
  line-height: 1.4;
}

/* ESG Grid */
.fst-tr-esg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.fst-tr-esg-item {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: var(--surface-ground);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}
.fst-tr-esg-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.fst-tr-esg-body {
  flex: 1;
}
.fst-tr-esg-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 6px;
}
.fst-tr-esg-desc {
  font-size: 12px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

/* Governance */
.fst-tr-governance {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fst-tr-gov-item {
  padding: 14px;
  background: var(--surface-ground);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}
.fst-tr-gov-role {
  font-size: 14px;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 4px;
}
.fst-tr-gov-body {
  font-size: 12px;
  color: var(--p-primary-color);
  font-weight: 600;
  margin-bottom: 6px;
}
.fst-tr-gov-desc {
  font-size: 12px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

/* Team */
.fst-tr-team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.fst-tr-team-member {
  text-align: center;
  padding: 16px;
  background: var(--surface-ground);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}
.fst-tr-tm-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--p-primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin: 0 auto 10px;
}
.fst-tr-tm-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 4px;
}
.fst-tr-tm-role {
  font-size: 11px;
  color: var(--p-primary-color);
  font-weight: 600;
  margin-bottom: 8px;
}
.fst-tr-tm-bio {
  font-size: 11px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

/* Regulatory */
.fst-tr-regulatory {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fst-tr-reg-item {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: var(--surface-ground);
  border-radius: 8px;
  border: 1px solid var(--surface-border);
}
.fst-tr-reg-icon {
  font-size: 24px;
  width: 40px;
  flex-shrink: 0;
}
.fst-tr-reg-body {
  flex: 1;
}
.fst-tr-reg-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 6px;
}
.fst-tr-reg-desc {
  font-size: 12px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
  margin-bottom: 6px;
}
.fst-tr-reg-status {
  font-size: 12px;
  font-weight: 600;
}

/* Contact */
.fst-tr-contact {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.6;
}
.fst-tr-contact-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 16px 0 20px;
}
.fst-tr-contact-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--p-text-color);
}
.fst-tr-contact-item i {
  color: var(--p-primary-color);
}

/* Data Room Dialog */
.fst-tr-dataroom {
  font-size: 13px;
  color: var(--p-text-color);
}
.fst-tr-dataroom-sections {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}
.fst-tr-dr-section {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  background: var(--surface-ground);
  border-radius: 6px;
  border: 1px solid var(--surface-border);
}

@media (max-width: 768px) {
  .fst-tr-hero {
    padding: 24px 16px;
  }
  .fst-tr-hero-title {
    font-size: 24px;
  }
  .fst-tr-main {
    padding: 12px;
  }
  .fst-tr-overview-grid,
  .fst-tr-principles,
  .fst-tr-esg-grid,
  .fst-tr-team-grid {
    grid-template-columns: 1fr;
  }
}
</style>
