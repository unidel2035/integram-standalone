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
      <span class="fst-bc-cat">{{ crumb.category }}</span>
    </template>

    <!-- Current page -->
    <i class="pi pi-chevron-right fst-bc-sep"></i>
    <span class="fst-bc-current">{{ crumb.title }}</span>

    <!-- Pipeline nav: prev / next -->
    <div class="fst-bc-pipeline" v-if="prevStep || nextStep">
      <router-link v-if="prevStep" :to="prevStep.path" class="fst-bc-nav fst-bc-nav--prev" :title="prevStep.title">
        <i class="pi pi-chevron-left"></i>
        {{ prevStep.shortTitle }}
      </router-link>
      <router-link v-if="nextStep" :to="nextStep.path" class="fst-bc-nav fst-bc-nav--next" :title="nextStep.title">
        {{ nextStep.shortTitle }}
        <i class="pi pi-chevron-right"></i>
      </router-link>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isFstPage = computed(() =>
  route.path.startsWith('/fst-') && route.path !== '/fst-hub'
)

// Категории страниц
const CATEGORIES = {
  // Воронка сделок
  'fst-sourcing':     'Сорсинг',
  'fst-apply':        'Заявки',
  'fst-dealflow':     'Воронка',
  'fst-duediligence': 'Оценка',
  'fst-committee':    'Оценка',
  'fst-protocol':     'Оценка',
  'fst-memo':         'Оценка',
  'fst-sovereignty':  'Оценка',
  // Структурирование сделки
  'fst-deal':         'Сделка',
  'fst-captable':     'Сделка',
  'fst-waterfall':    'Сделка',
  'fst-legal':        'Сделка',
  'fst-syndication':  'Сделка',
  // Портфель
  'fst-execution':    'Портфель',
  'fst-portfolio':    'Портфель',
  'fst-twin':         'Портфель',
  'fst-exit':         'Портфель',
  // Фонд
  'fst-fund':         'Фонд',
  'fst-lp':           'Фонд',
  'fst-ilpa':         'Фонд',
  'fst-gov':          'Фонд',
  'fst-benchmark':    'Аналитика',
  'fst-esg':          'Аналитика',
  'fst-compliance':   'Аналитика',
  'fst-grants':       'Господдержка',
  'fst-natproject':   'Господдержка',
  'fst-registry':     'Господдержка',
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

const crumb = computed(() => ({
  title:    route.meta?.title || slug.value,
  category: CATEGORIES[slug.value] || null,
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
  gap: 6px;
  padding: 8px 24px;
  background: var(--p-content-background);
  border-bottom: 1px solid var(--p-surface-border);
  font-size: 0.8125rem;
  min-height: 38px;
  flex-wrap: wrap;
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
.fst-bc-home .pi-home { font-size: 12px; }

.fst-bc-sep {
  font-size: 10px;
  color: var(--p-text-muted-color);
  opacity: 0.4;
}

.fst-bc-cat {
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

.fst-bc-current {
  color: var(--p-text-color);
  font-weight: 600;
  white-space: nowrap;
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
</style>
