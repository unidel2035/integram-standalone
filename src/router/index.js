import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/layout/AppLayout.vue'

const routes = [
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', redirect: '/fst-hub' },
      { path: 'fst-hub', component: () => import('@/views/pages/FstHub.vue'), meta: { title: 'ФСТ НТИ — Главная' } },
      { path: 'fst-committee', component: () => import('@/views/pages/FstCommittee.vue'), meta: { title: 'AI-инвесткомитет' } },
      { path: 'fst-protocol', component: () => import('@/views/pages/FstProtocol.vue'), meta: { title: 'Протоколы инвесткомитета' } },
      { path: 'fst-deal', component: () => import('@/views/pages/FstDeal.vue'), meta: { title: 'Доведение сделки' } },
      { path: 'fst-portfolio', component: () => import('@/views/pages/FstPortfolio.vue'), meta: { title: 'Портфельный монитор' } },
      { path: 'fst-twin', component: () => import('@/views/pages/FstDigitalTwin.vue'), meta: { title: 'Цифровой двойник компании' } },
      { path: 'fst-fund', component: () => import('@/views/pages/FstFundTwin.vue'), meta: { title: 'Цифровой двойник фонда' } },
      { path: 'fst-execution', component: () => import('@/views/pages/FstExecution.vue'), meta: { title: 'Исполнение сделок' } },
      { path: 'fst-dealflow', component: () => import('@/views/pages/FstDealflow.vue'), meta: { title: 'Воронка сделок' } },
      { path: 'fst-sourcing', component: () => import('@/views/pages/FstSourcing.vue'), meta: { title: 'AI Deal Sourcing' } },
      { path: 'fst-intelligence', component: () => import('@/views/pages/FstIntelligence.vue'), meta: { title: 'Portfolio Intelligence' } },
      { path: 'fst-memo', component: () => import('@/views/pages/FstMemo.vue'), meta: { title: 'AI Инвест-меморандум' } },
      { path: 'fst-lp', component: () => import('@/views/pages/FstLp.vue'), meta: { title: 'LP Dashboard' } },
      { path: 'fst-captable', component: () => import('@/views/pages/FstCaptable.vue'), meta: { title: 'Cap Table' } },
      { path: 'fst-waterfall', component: () => import('@/views/pages/FstWaterfall.vue'), meta: { title: 'Waterfall Калькулятор' } },
      { path: 'fst-gov', component: () => import('@/views/pages/FstGov.vue'), meta: { title: 'GR-Панель' } },
      { path: 'fst-ilpa', component: () => import('@/views/pages/FstIlpa.vue'), meta: { title: 'ILPA Отчётность' } },
      { path: 'fst-benchmark', component: () => import('@/views/pages/FstBenchmark.vue'), meta: { title: 'Бенчмаркинг портфеля' } },
      { path: 'fst-exit', component: () => import('@/views/pages/FstExit.vue'), meta: { title: 'Сценарии выхода' } },
      { path: 'fst-sovereignty', component: () => import('@/views/pages/FstSovereignty.vue'), meta: { title: 'Аудит суверенности 9D' } },
      { path: 'fst-apply', component: () => import('@/views/pages/FstApply.vue'), meta: { title: 'Подать заявку в ФСТ НТИ' } },
      { path: 'fst-esg', component: () => import('@/views/pages/FstEsg.vue'), meta: { title: 'ESG-скоринг портфеля' } },
      { path: 'fst-compliance', component: () => import('@/views/pages/FstCompliance.vue'), meta: { title: 'AML/KYC Комплаенс' } },
      { path: 'fst-grants', component: () => import('@/views/pages/FstGrants.vue'), meta: { title: 'Трекер грантов' } },
      { path: 'fst-natproject', component: () => import('@/views/pages/FstNatproject.vue'), meta: { title: 'Нацпроект БАС 2024–2030' } },
      { path: 'fst-transparency', component: () => import('@/views/pages/FstTransparency.vue'), meta: { title: 'Публичная витрина' } },
      { path: 'fst-administration', component: () => import('@/views/pages/FstAdministration.vue'), meta: { title: 'Бэк-офис' } },
      { path: 'fst-board', component: () => import('@/views/pages/FstBoard.vue'), meta: { title: 'Совет директоров' } },
      { path: 'fst-syndication', component: () => import('@/views/pages/FstSyndication.vue'), meta: { title: 'Со-инвестирование' } },
      { path: 'fst-duediligence', component: () => import('@/views/pages/FstDuediligence.vue'), meta: { title: 'AI Due Diligence' } },
      { path: 'fst-legal', component: () => import('@/views/pages/FstLegal.vue'), meta: { title: 'Юридические документы' } },
      { path: 'fst-registry', component: () => import('@/views/pages/FstRegistry.vue'), meta: { title: 'Реестр производителей БПЛА' } },
    ]
  },
  { path: '/fst', component: () => import('@/views/pages/FstLanding.vue'), meta: { title: 'ФСТ НТИ — Платформа' } },
  { path: '/login', component: () => import('@/views/pages/FstLogin.vue'), meta: { title: 'Вход', public: true } },
  { path: '/:pathMatch(.*)*', redirect: '/fst-hub' }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})


router.beforeEach((to) => {
  if (to.meta.public) return true
  const token = localStorage.getItem('token')
  if (!token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | ФСТ НТИ` : 'ФСТ НТИ'
})

export default router

export function clearUserCache() {}
