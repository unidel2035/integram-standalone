import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/fst-hub'
  },
  {
    path: '/fst-hub',
    component: () => import('@/views/pages/FstHub.vue'),
    meta: { title: 'ФСТ НТИ — Главная' }
  },
  {
    path: '/fst-committee',
    component: () => import('@/views/pages/FstCommittee.vue'),
    meta: { title: 'AI-инвесткомитет' }
  },
  {
    path: '/fst-deal',
    component: () => import('@/views/pages/FstDeal.vue'),
    meta: { title: 'Доведение сделки' }
  },
  {
    path: '/fst-portfolio',
    component: () => import('@/views/pages/FstPortfolio.vue'),
    meta: { title: 'Портфельный монитор' }
  },
  {
    path: '/fst-twin',
    component: () => import('@/views/pages/FstDigitalTwin.vue'),
    meta: { title: 'Цифровой двойник компании' }
  },
  {
    path: '/fst-fund',
    component: () => import('@/views/pages/FstFundTwin.vue'),
    meta: { title: 'Цифровой двойник фонда' }
  },
  {
    path: '/fst-execution',
    component: () => import('@/views/pages/FstExecution.vue'),
    meta: { title: 'Исполнение сделок' }
  },
  {
    path: '/fst-dealflow',
    component: () => import('@/views/pages/FstDealflow.vue'),
    meta: { title: 'Воронка сделок' }
  },
  {
    path: '/fst-memo',
    component: () => import('@/views/pages/FstMemo.vue'),
    meta: { title: 'AI Инвест-меморандум' }
  },
  {
    path: '/fst-lp',
    component: () => import('@/views/pages/FstLp.vue'),
    meta: { title: 'LP Dashboard' }
  },
  {
    path: '/fst-captable',
    component: () => import('@/views/pages/FstCaptable.vue'),
    meta: { title: 'Cap Table' }
  },
  {
    path: '/fst-waterfall',
    component: () => import('@/views/pages/FstWaterfall.vue'),
    meta: { title: 'Waterfall Калькулятор' }
  },
  {
    path: '/fst-gov',
    component: () => import('@/views/pages/FstGov.vue'),
    meta: { title: 'GR-Панель' }
  },
  {
    path: '/fst-ilpa',
    component: () => import('@/views/pages/FstIlpa.vue'),
    meta: { title: 'ILPA Отчётность' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/fst-hub'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | ФСТ НТИ` : 'ФСТ НТИ'
})

export default router
