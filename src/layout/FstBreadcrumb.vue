<template>
  <nav v-if="isFstPage" class="fst-bc">
    <!-- Home -->
    <router-link to="/fst-hub" class="fst-bc-home" title="ФСТ НТИ — Главная">
      <i class="pi pi-home"></i>
      <span>ФСТ НТИ</span>
    </router-link>

    <!-- Category (if any) -->
    <template v-if="crumb.category">
      <i class="pi pi-chevron-right fst-bc-sep"></i>
      <router-link :to="crumb.categoryLink" class="fst-bc-cat">{{ crumb.category }}</router-link>
    </template>

    <!-- Current page -->
    <i class="pi pi-chevron-right fst-bc-sep"></i>
    <span class="fst-bc-current">{{ crumb.title }}</span>

  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isFstPage = computed(() =>
  route.path.startsWith('/fst-') && route.path !== '/fst-hub'
)

// Категории — синхронизированы с fstMenuConfig.js
const CATEGORIES = {
  // Обзор
  'fst-portfolio':      'Обзор',
  'fst-twin':           'Обзор',
  'fst-fund':           'Обзор',
  'fst-transparency':   'Обзор',
  // Сделки
  'fst-dealflow':       'Сделки',
  'fst-memo':           'Сделки',
  'fst-committee':      'Сделки',
  'fst-protocol':       'Сделки',
  'fst-deal':           'Сделки',
  'fst-board':          'Сделки',
  'fst-sourcing':       'Сделки',
  'fst-execution':      'Сделки',
  'fst-founders':       'Сделки',
  // Финансы
  'fst-lp':             'Финансы',
  'fst-captable':       'Финансы',
  'fst-secondary':      'Финансы',
  'fst-waterfall':      'Финансы',
  'fst-exit':           'Финансы',
  'fst-benchmark':      'Финансы',
  'fst-allocation':     'Финансы',
  // Аналитика
  'fst-esg':            'Аналитика',
  'fst-sovereignty':    'Аналитика',
  'fst-natproject':     'Аналитика',
  'fst-gov':            'Аналитика',
  'fst-intelligence':   'Аналитика',
  // Инфраструктура
  'fst-ilpa':           'Инфраструктура',
  'fst-compliance':     'Инфраструктура',
  'fst-grants':         'Инфраструктура',
  'fst-syndication':    'Инфраструктура',
  'fst-duediligence':   'Инфраструктура',
  'fst-legal':          'Инфраструктура',
  'fst-registry':       'Инфраструктура',
  'fst-administration': 'Инфраструктура',
  // Подача заявок
  'fst-apply':          'Подача заявок',
  // Обучение
  'fst-dev-guide':      'Обучение',
  'fst-glossary':       'Обучение',
  'fst-quiz':           'Обучение',
  'fst-school':         'Обучение',
  'fst-learning':       'Обучение',
}

// Первый маршрут каждой категории (для клика по хлебной крошке)
const CATEGORY_LINKS = {
  'Обзор':          '/fst-portfolio',
  'Сделки':         '/fst-dealflow',
  'Финансы':        '/fst-lp',
  'Аналитика':      '/fst-esg',
  'Инфраструктура': '/fst-ilpa',
  'Подача заявок':  '/fst-apply',
  'Обучение':       '/fst-dev-guide',
}

// Линейный пайплайн для prev/next навигации
const PIPELINE = [
  { path: '/fst-sourcing',     shortTitle: 'Сорсинг',       title: 'AI Deal Sourcing' },
  { path: '/fst-apply',        shortTitle: 'Заявка',         title: 'Подать заявку' },
  { path: '/fst-dealflow',     shortTitle: 'Воронка',        title: 'Воронка сделок' },
  { path: '/fst-duediligence', shortTitle: 'Due Diligence',  title: 'AI Due Diligence' },
  { path: '/fst-committee',    shortTitle: 'Инвесткомитет',  title: 'AI Инвесткомитет' },
  { path: '/fst-protocol',     shortTitle: 'Протоколы',      title: 'Протоколы ИК' },
  { path: '/fst-deal',         shortTitle: 'Сделка',         title: 'Доведение сделки' },
  { path: '/fst-captable',     shortTitle: 'Cap Table',      title: 'Cap Table' },
  { path: '/fst-execution',    shortTitle: 'Исполнение',     title: 'Исполнение сделки' },
  { path: '/fst-portfolio',    shortTitle: 'Портфель',       title: 'Портфельный монитор' },
  { path: '/fst-twin',         shortTitle: 'Двойник',        title: 'Цифровой двойник' },
  { path: '/fst-exit',         shortTitle: 'Выход',          title: 'Сценарии выхода' },
  { path: '/fst-fund',         shortTitle: 'Фонд',           title: 'Цифровой двойник фонда' },
]

const slug = computed(() => route.path.replace('/', ''))

const category = computed(() => CATEGORIES[slug.value] || null)

const crumb = computed(() => ({
  title:        route.meta?.title || slug.value,
  category:     category.value,
  categoryLink: CATEGORY_LINKS[category.value] || '/fst-hub',
}))

const pipelineIdx = computed(() =>
  PIPELINE.findIndex(s => s.path === route.path)
)
const prevStep = computed(() =>
  pipelineIdx.value > 0 ? PIPELINE[pipelineIdx.value - 1] : null
)
const nextStep = computed(() =>
  pipelineIdx.value >= 0 && pipelineIdx.value < PIPELINE.length - 1
    ? PIPELINE[pipelineIdx.value + 1]
    : null
)
</script>

<style scoped>
.fst-bc {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  background: var(--p-content-background);
  border-bottom: 1px solid var(--p-surface-border);
  font-size: 0.75rem;
  min-height: 30px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.fst-bc-home {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.15s;
  white-space: nowrap;
}
.fst-bc-home:hover { color: #ffa726; }
.fst-bc-home .pi-home { font-size: 11px; }

.fst-bc-sep {
  font-size: 9px;
  color: var(--p-text-muted-color);
  opacity: 0.4;
  flex-shrink: 0;
}

.fst-bc-cat {
  color: var(--p-text-muted-color);
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.15s;
}
.fst-bc-cat:hover { color: #ffa726; }

.fst-bc-current {
  color: var(--p-text-color);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Pipeline prev/next */
.fst-bc-pipeline {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.fst-bc-nav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid var(--p-surface-border);
  background: var(--p-surface-ground);
  color: var(--p-text-muted-color);
  text-decoration: none;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.15s;
  white-space: nowrap;
}
.fst-bc-nav:hover {
  border-color: #ffa726;
  color: #ffa726;
  background: rgba(255,167,38,0.07);
}
.fst-bc-nav .pi { font-size: 9px; }

@media (max-width: 1400px) {
  .fst-bc { padding: 4px 10px; min-height: 28px; font-size: 0.7rem; gap: 4px; }
  .fst-bc-home .pi-home { font-size: 10px; }
  .fst-bc-sep { font-size: 8px; }
  .fst-bc-nav { padding: 2px 8px; font-size: 0.7rem; }
}
</style>
