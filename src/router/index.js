import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/layout/AppLayout.vue'

const routes = [
  { path: '/', component: () => import('@/views/pages/FstRoot.vue'), meta: { title: 'ФСТ НТИ', public: true } },
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: 'fst-hub', component: () => import('@/views/pages/FstHub.vue'), meta: { title: 'ФСТ НТИ — Главная' } },
      { path: 'fst-committee', component: () => import('@/views/pages/FstCommittee.vue'), meta: { title: 'AI-инвесткомитет' } },
      { path: 'fst-protocol', component: () => import('@/views/pages/FstProtocol.vue'), meta: { title: 'Протоколы инвесткомитета' } },
      { path: 'fst-contract/:id', component: () => import('@/views/pages/FstSmartContract.vue'), meta: { title: 'Смарт контракт' } },
      { path: 'fst-deal', component: () => import('@/views/pages/FstDeal.vue'), meta: { title: 'Доведение сделки' } },
      { path: 'fst-portfolio', component: () => import('@/views/pages/FstPortfolio.vue'), meta: { title: 'Портфельный монитор' } },
      { path: 'fst-twin', component: () => import('@/views/pages/FstDigitalTwin.vue'), meta: { title: 'Цифровой двойник компании' } },
      { path: 'fst-fund', component: () => import('@/views/pages/FstFundTwin.vue'), meta: { title: 'Цифровой двойник фонда' } },
      { path: 'fst-execution', component: () => import('@/views/pages/FstExecution.vue'), meta: { title: 'Исполнение сделок' } },
      { path: 'fst-learning', component: () => import('@/views/pages/FstLearning.vue'), meta: { title: 'Нейрокогнитивное ядро' } },
      { path: 'fst-dealflow', component: () => import('@/views/pages/FstDealflow.vue'), meta: { title: 'Воронка сделок' } },
      { path: 'fst-sourcing', component: () => import('@/views/pages/FstSourcing.vue'), meta: { title: 'AI Deal Sourcing' } },
      { path: 'fst-memo', component: () => import('@/views/pages/FstMemo.vue'), meta: { title: 'AI Инвест-меморандум' } },
      { path: 'fst-lp', component: () => import('@/views/pages/FstLp.vue'), meta: { title: 'LP Dashboard' } },
      { path: 'fst-captable', component: () => import('@/views/pages/FstCaptable.vue'), meta: { title: 'Cap Table' } },
      { path: 'fst-secondary', component: () => import('@/views/pages/FstSecondary.vue'), meta: { title: 'Secondary Market' } },
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
      { path: 'fst-syndication', component: () => import('@/views/pages/FstSyndication.vue'), meta: { title: 'Со-инвестирование' } },
      { path: 'fst-duediligence', component: () => import('@/views/pages/FstDuediligence.vue'), meta: { title: 'AI Due Diligence' } },
      { path: 'fst-legal', component: () => import('@/views/pages/FstLegal.vue'), meta: { title: 'Юридические документы' } },
      { path: 'fst-registry', component: () => import('@/views/pages/FstRegistry.vue'), meta: { title: 'Реестр производителей БПЛА' } },
      { path: 'fst-intelligence', component: () => import('@/views/pages/FstIntelligence.vue'), meta: { title: 'Portfolio Intelligence' } },
      { path: 'fst-allocation', component: () => import('@/views/pages/FstAllocation.vue'), meta: { title: 'Оптимизация аллокации' } },
      { path: 'fst-founders', component: () => import('@/views/pages/FstFounders.vue'), meta: { title: 'Founders CRM & Mentors' } },
      { path: 'fst-board', component: () => import('@/views/pages/FstBoard.vue'), meta: { title: 'Совет директоров' } },
      { path: 'fst-transparency', component: () => import('@/views/pages/FstTransparency.vue'), meta: { title: 'Публичная витрина фонда' } },
      { path: 'fst-administration', component: () => import('@/views/pages/FstAdministration.vue'), meta: { title: 'Бэк-офис фонда' } },
      { path: 'fst-glossary', component: () => import('@/views/pages/FstGlossary.vue'), meta: { title: 'Глоссарий венчурных терминов' } },
      { path: 'fst-quiz', component: () => import('@/views/pages/FstQuizDemo.vue'), meta: { title: 'Мини-квизы — закрепление знаний' } },
      { path: 'fst-dev-guide', component: () => import('@/views/pages/FstDevGuide.vue'), meta: { title: 'Центр обучения ФСТ НТИ' } },
      { path: 'fst-learning-progress', component: () => import('@/views/pages/FstLearningProgress.vue'), meta: { title: 'Мой прогресс обучения' } },
      { path: 'fst-school', component: () => import('@/views/pages/FstAgentSchool.vue'), meta: { title: 'Школа агентов ИК' } },
      { path: 'fst-miniapp', component: () => import('@/views/pages/FstMiniApp.vue'), meta: { title: 'Telegram Mini App' } },
      { path: 'fst-network', component: () => import('@/views/pages/FstNetwork.vue'), meta: { title: 'Сеть контактов' } },
      { path: 'fst-terminal', component: () => import('@/views/pages/FstTerminal.vue'), meta: { title: 'Claude Code CLI' } },
      { path: 'fst-startuper', component: () => import('@/views/pages/FstStartuper.vue'), meta: { title: 'Стартапер' } },
      { path: 'fst-pitch', component: () => import('@/views/pages/FstPitch.vue'), meta: { title: 'ai2fund — Инвестиционный питч' } },
      { path: 'fst-room', component: () => import('@/views/pages/FstRoom.vue'), meta: { title: 'Agent Room — живой чат агентов' } },
      { path: 'fst-soft-model', component: () => import('@/views/pages/FstSoftModel.vue'), meta: { title: 'Software Ontology Model' } },
    ]
  },
  { path: '/fst', component: () => import('@/views/pages/FstLanding.vue'), meta: { title: 'ФСТ НТИ', public: true } },
  { path: '/login', component: () => import('@/views/pages/FstLogin.vue'), meta: { title: 'Вход', public: true } },
  { path: '/:pathMatch(.*)*', component: () => import('@/views/pages/NotFound.vue'), meta: { title: '404', public: true } }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (to.meta.public) return true
  if (!token) return { path: '/login', query: { redirect: to.fullPath } }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | ФСТ НТИ` : 'ФСТ НТИ'
})

export function clearUserCache() {
  // Placeholder for clearing router-level user cache
  // Called on session expiry (Issue #3700)
}

export default router
