<template>
  <nav v-if="isFstPage" class="fst-bc">
    <!-- Home -->
    <router-link to="/fst-hub" class="fst-bc-home" title="ФСТ НТИ — Главная">
      <i class="pi pi-home"></i>
    </router-link>

    <!-- Category -->
    <template v-if="crumb.category">
      <i class="pi pi-chevron-right fst-bc-sep"></i>
      <router-link v-if="crumb.categoryRoute" :to="crumb.categoryRoute" class="fst-bc-cat fst-bc-cat--link">
        {{ crumb.category }}
      </router-link>
      <span v-else class="fst-bc-cat">{{ crumb.category }}</span>
    </template>

    <!-- Current page -->
    <i class="pi pi-chevron-right fst-bc-sep"></i>
    <span class="fst-bc-current">{{ crumb.title }}</span>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { fstMenuConfig } from '@/config/fstMenuConfig'

const route = useRoute()

const isFstPage = computed(() =>
  route.path.startsWith('/fst-') && route.path !== '/fst-hub'
)

// Строим маппинг slug → { category, categoryRoute, isFirst } из fstMenuConfig
const CRUMB_MAP = {}
for (const group of fstMenuConfig) {
  if (!group.items) continue
  const firstRoute = group.items.find(i => i.to)?.to || null
  for (const item of group.items) {
    if (!item.to) continue
    const slug = item.to.replace('/', '')
    CRUMB_MAP[slug] = {
      category: group.label,
      categoryRoute: firstRoute,
      isFirst: item.to === firstRoute
    }
  }
}

// Маршруты-сироты: есть в роутере, но нет в сайдбар-меню
const ORPHAN_MAP = {
  'fst-protocol':       { category: 'Сделки',         categoryRoute: '/fst-dealflow' },
  'fst-sourcing':       { category: 'Сделки',         categoryRoute: '/fst-dealflow' },
  'fst-execution':      { category: 'Сделки',         categoryRoute: '/fst-dealflow' },
  'fst-founders':       { category: 'Сделки',         categoryRoute: '/fst-dealflow' },
  'fst-fund':           { category: 'Обзор',           categoryRoute: '/fst-hub' },
  'fst-transparency':   { category: 'Инфраструктура', categoryRoute: '/fst-ilpa' },
  'fst-administration': { category: 'Инфраструктура', categoryRoute: '/fst-ilpa' },
  'fst-intelligence':   { category: 'Аналитика',      categoryRoute: '/fst-esg' },
  'fst-allocation':     { category: 'Финансы',        categoryRoute: '/fst-lp' },
  'fst-learning':       { category: 'Обучение',       categoryRoute: '/fst-dev-guide' },
}

const slug = computed(() => route.path.replace('/', ''))

const crumb = computed(() => {
  const s = slug.value
  const mapped = CRUMB_MAP[s]
  const orphan = ORPHAN_MAP[s]

  if (mapped) {
    return {
      title: route.meta?.title || s,
      category: mapped.category,
      // Если текущая страница — первая в группе, категория не кликабельна
      categoryRoute: mapped.isFirst ? null : mapped.categoryRoute,
    }
  }

  if (orphan) {
    return {
      title: route.meta?.title || s,
      category: orphan.category,
      categoryRoute: orphan.categoryRoute,
    }
  }

  return {
    title: route.meta?.title || s,
    category: null,
    categoryRoute: null,
  }
})
</script>

<style scoped>
.fst-bc {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 0.75rem;
  font-size: 0.8125rem;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.fst-bc-home {
  display: inline-flex;
  align-items: center;
  color: var(--p-text-muted-color);
  text-decoration: none;
  transition: color 0.15s;
  flex-shrink: 0;
}
.fst-bc-home:hover { color: var(--p-primary-color); }
.fst-bc-home .pi-home { font-size: 12px; }

.fst-bc-sep {
  font-size: 10px;
  color: var(--p-text-muted-color);
  opacity: 0.4;
  flex-shrink: 0;
}

.fst-bc-cat {
  color: var(--p-text-muted-color);
  white-space: nowrap;
  flex-shrink: 0;
}

.fst-bc-cat--link {
  text-decoration: none;
  cursor: pointer;
  transition: color 0.15s;
}
.fst-bc-cat--link:hover { color: var(--p-primary-color); }

.fst-bc-current {
  color: var(--p-text-color);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 576px) {
  .fst-bc { display: none; }
}
</style>
