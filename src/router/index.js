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
