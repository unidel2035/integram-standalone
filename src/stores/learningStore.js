/**
 * Learning Store
 *
 * Manages user learning progress across all educational resources:
 * tours, videos, quizzes, scenarios, glossary.
 * Integrates with onboardingStore for tour progress.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'ventureOS_learning_v2'

export const useLearningStore = defineStore('learning', () => {
  // User identity
  const userName = ref('')
  const userRole = ref(null) // 'analyst' | 'manager' | 'director' | null

  // Resource completion tracking
  const completedTours = ref([])     // array of tour IDs
  const completedVideos = ref([])    // array of video IDs
  const completedQuizzes = ref([])   // array of quiz IDs
  const completedScenarios = ref([]) // array of scenario IDs
  const viewedGlossaryTerms = ref([]) // array of term IDs

  // Activity log
  const activityLog = ref([]) // { type, resourceId, resourceTitle, timestamp }

  // Available resources catalog
  const tours = ref([
    { id: 'tour-hub',         title: 'Главная ФСТ',           route: '/fst-hub',        duration: '5 мин',  icon: 'pi pi-home' },
    { id: 'tour-committee',   title: 'AI-инвесткомитет',      route: '/fst-committee',  duration: '10 мин', icon: 'pi pi-users' },
    { id: 'tour-deal',        title: 'Сделка и финмодель',    route: '/fst-deal',       duration: '8 мин',  icon: 'pi pi-file-edit' },
    { id: 'tour-portfolio',   title: 'Портфельный монитор',   route: '/fst-portfolio',  duration: '7 мин',  icon: 'pi pi-briefcase' },
    { id: 'tour-dealflow',    title: 'Воронка сделок',        route: '/fst-dealflow',   duration: '6 мин',  icon: 'pi pi-filter' },
    { id: 'tour-waterfall',   title: 'Waterfall Калькулятор', route: '/fst-waterfall',  duration: '9 мин',  icon: 'pi pi-chart-bar' },
  ])

  const videos = ref([
    // Плейлист: Начало работы
    {
      id: 'video-intro',
      title: 'Введение в VentureOS: обзор платформы',
      duration: '3:20',
      tag: 'Обзор',
      playlist: 'onboarding',
      playlistTag: 'Начало работы',
      notes: 'Обзор всех модулей платформы — от подачи заявки до мониторинга портфеля.',
      moduleRoute: '/fst-hub',
      moduleLabel: 'Открыть хаб фонда',
      chapters: [
        { time: 0,   label: 'Введение' },
        { time: 45,  label: 'Структура платформы' },
        { time: 130, label: 'Ключевые модули' },
        { time: 185, label: 'Следующие шаги' },
      ],
    },
    {
      id: 'video-hub-tour',
      title: 'Первый вход: навигация и настройка профиля',
      duration: '2:45',
      tag: 'Начало',
      playlist: 'onboarding',
      playlistTag: 'Начало работы',
      notes: 'Как войти в систему, настроить роль и получить персонализированный план обучения.',
      moduleRoute: '/fst-hub',
      moduleLabel: 'Открыть хаб',
    },
    {
      id: 'video-terminal',
      title: 'Claude CLI: прямой разговор с кодом платформы',
      duration: '4:10',
      tag: 'Claude',
      playlist: 'onboarding',
      playlistTag: 'Начало работы',
      notes: 'Как использовать встроенный терминал для задач разработки и AI-автоматизации.',
      moduleRoute: '/fst-terminal',
      moduleLabel: 'Открыть терминал',
      chapters: [
        { time: 0,   label: 'Что такое Claude CLI' },
        { time: 60,  label: 'Первый запрос' },
        { time: 155, label: 'Полезные команды' },
        { time: 210, label: 'Интеграция с фондом' },
      ],
    },

    // Плейлист: Сделки и ИК
    {
      id: 'video-committee',
      title: 'Как работает AI-инвесткомитет: 6 агентов',
      duration: '5:45',
      tag: 'Инвесткомитет',
      playlist: 'deals',
      playlistTag: 'Сделки и ИК',
      notes: 'Разбор ролей 6 AI-агентов ИК: аналитик, юрист, рискменеджер, технолог, маркетолог, CFO.',
      moduleRoute: '/fst-committee',
      moduleLabel: 'Открыть инвесткомитет',
      chapters: [
        { time: 0,   label: 'Структура ИК' },
        { time: 80,  label: 'Роли агентов' },
        { time: 200, label: 'Процедура голосования' },
        { time: 290, label: 'Выгрузка протокола' },
      ],
    },
    {
      id: 'video-deal',
      title: 'Жизненный цикл сделки: от заявки до подписания',
      duration: '6:10',
      tag: 'Сделки',
      playlist: 'deals',
      playlistTag: 'Сделки и ИК',
      notes: 'Путь проекта через воронку: заявка → скоринг → ИК → Term Sheet → закрытие сделки.',
      moduleRoute: '/fst-deal',
      moduleLabel: 'Открыть модуль Сделки',
      chapters: [
        { time: 0,   label: 'Заявка и скоринг' },
        { time: 90,  label: 'Инвесткомитет' },
        { time: 210, label: 'Term Sheet' },
        { time: 300, label: 'Закрытие сделки' },
      ],
    },
    {
      id: 'video-dealflow',
      title: 'Воронка сделок: управление Deal Flow',
      duration: '4:00',
      tag: 'Воронка',
      playlist: 'deals',
      playlistTag: 'Сделки и ИК',
      notes: 'Как отслеживать входящий поток, расставлять приоритеты и не пропустить лучшие сделки.',
      moduleRoute: '/fst-dealflow',
      moduleLabel: 'Открыть Deal Flow',
    },
    {
      id: 'video-protocol',
      title: 'Протоколы ИК: как читать и использовать',
      duration: '3:30',
      tag: 'Протокол',
      playlist: 'deals',
      playlistTag: 'Сделки и ИК',
      notes: 'Структура протокола заседания ИК, экспорт в PDF, хранение решений.',
      moduleRoute: '/fst-protocol',
      moduleLabel: 'Открыть протоколы',
    },
    {
      id: 'video-sourcing',
      title: 'AI Deal Sourcing: автоматический поиск проектов',
      duration: '5:00',
      tag: 'Sourcing',
      playlist: 'deals',
      playlistTag: 'Сделки и ИК',
      notes: 'Как AI автоматически ищет и ранжирует стартапы по параметрам вашего фонда.',
      moduleRoute: '/fst-sourcing',
      moduleLabel: 'Открыть Deal Sourcing',
    },

    // Плейлист: Финансы фонда
    {
      id: 'video-portfolio',
      title: 'Светофор портфеля: метрики и датчики',
      duration: '4:30',
      tag: 'Портфель',
      playlist: 'finance',
      playlistTag: 'Финансы фонда',
      notes: 'Система «светофор»: зелёный/жёлтый/красный статус по ключевым KPI каждой компании.',
      moduleRoute: '/fst-portfolio',
      moduleLabel: 'Открыть портфель',
      chapters: [
        { time: 0,   label: 'Система светофора' },
        { time: 80,  label: 'Датчики метрик' },
        { time: 180, label: 'AI-отчёты' },
        { time: 240, label: 'Действия по триггерам' },
      ],
    },
    {
      id: 'video-finmodel',
      title: 'Финансовая модель в HyperFormula',
      duration: '5:20',
      tag: 'Финмодель',
      playlist: 'finance',
      playlistTag: 'Финансы фонда',
      notes: 'Как строить финансовые модели: DCF, P&L, Cash Flow — прямо в браузере.',
      moduleRoute: '/fst-deal',
      moduleLabel: 'Открыть модуль Сделки',
    },
    {
      id: 'video-waterfall',
      title: 'Waterfall: распределение прибыли фонда',
      duration: '4:50',
      tag: 'Waterfall',
      playlist: 'finance',
      playlistTag: 'Финансы фонда',
      notes: 'Как работает каскадное распределение (hurdle rate, carried interest, catch-up).',
      moduleRoute: '/fst-waterfall',
      moduleLabel: 'Открыть Waterfall',
    },
    {
      id: 'video-lp',
      title: 'LP Кабинет: прозрачность для инвесторов',
      duration: '3:50',
      tag: 'LP',
      playlist: 'finance',
      playlistTag: 'Финансы фонда',
      notes: 'LP-отчётность, ILPA-стандарты, NAV и IRR в реальном времени.',
      moduleRoute: '/fst-lp',
      moduleLabel: 'Открыть LP Кабинет',
    },

    // Плейлист: AI-инструменты
    {
      id: 'video-ai-overview',
      title: 'AI-агенты платформы: обзор возможностей',
      duration: '4:20',
      tag: 'AI',
      playlist: 'ai',
      playlistTag: 'AI-инструменты',
      notes: 'Какие AI-агенты встроены в платформу и как они помогают принимать решения.',
      moduleRoute: '/fst-hub',
      moduleLabel: 'Открыть хаб',
    },
    {
      id: 'video-digital-twin',
      title: 'Цифровой двойник компании: tick-engine',
      duration: '5:10',
      tag: 'ЦД',
      playlist: 'ai',
      playlistTag: 'AI-инструменты',
      notes: 'Как симулятор tick-engine моделирует развитие стартапа и помогает тестировать сценарии.',
      moduleRoute: '/fst-twin',
      moduleLabel: 'Открыть ЦД компании',
      chapters: [
        { time: 0,   label: 'Что такое ЦД' },
        { time: 75,  label: 'Tick-engine' },
        { time: 190, label: 'Сценарии симуляции' },
        { time: 275, label: 'Анализ результатов' },
      ],
    },
    {
      id: 'video-mcp',
      title: 'MCP-инструменты: AI работает с данными фонда',
      duration: '3:40',
      tag: 'MCP',
      playlist: 'ai',
      playlistTag: 'AI-инструменты',
      notes: '60+ инструментов Integram MCP: как AI-агент читает и пишет данные фонда.',
      moduleRoute: '/fst-dev-guide',
      moduleLabel: 'Открыть Центр обучения',
    },
  ])

  // Video playlists metadata
  const videoPlaylists = [
    {
      id: 'onboarding',
      label: 'Начало работы',
      icon: 'pi pi-play-circle',
      description: '3 урока • ~10 мин',
    },
    {
      id: 'deals',
      label: 'Сделки и ИК',
      icon: 'pi pi-briefcase',
      description: '5 уроков • ~20 мин',
    },
    {
      id: 'finance',
      label: 'Финансы фонда',
      icon: 'pi pi-chart-bar',
      description: '4 урока • ~15 мин',
    },
    {
      id: 'ai',
      label: 'AI-инструменты',
      icon: 'pi pi-microchip-ai',
      description: '3 урока • ~12 мин',
    },
  ]

  const quizzes = ref([
    { id: 'quiz-basics',     title: 'Основы венчурного инвестирования', questions: 10, tag: 'Основы' },
    { id: 'quiz-committee',  title: 'AI-инвесткомитет: процедуры',      questions: 8,  tag: 'ИК' },
    { id: 'quiz-metrics',    title: 'Финансовые метрики фонда',          questions: 12, tag: 'Финансы' },
    { id: 'quiz-esg',        title: 'ESG и суверенность',                questions: 8,  tag: 'ESG' },
    { id: 'quiz-legal',      title: 'Юридические аспекты сделок',        questions: 10, tag: 'Юридика' },
  ])

  const scenarios = ref([
    { id: 'scenario-first-deal',  title: 'Первая сделка: от заявки до подписания', steps: 7, tag: 'Сделки' },
    { id: 'scenario-ik-session',  title: 'Провести заседание ИК',                  steps: 5, tag: 'ИК' },
    { id: 'scenario-exit',        title: 'Подготовить сценарии выхода',             steps: 6, tag: 'Выход' },
    { id: 'scenario-lp-report',   title: 'Сформировать отчёт для LP',               steps: 4, tag: 'LP' },
  ])

  // Roles for quick start
  const availableRoles = [
    { id: 'analyst',  label: 'Аналитик',           icon: 'pi pi-chart-line', description: 'Оцениваю проекты, готовлю меморандумы' },
    { id: 'manager',  label: 'Управляющий',         icon: 'pi pi-briefcase',  description: 'Управляю портфелем и сделками' },
    { id: 'director', label: 'Исполнительный директор', icon: 'pi pi-star', description: 'Стратегия, ИК, LP-отношения' },
    { id: 'founder',  label: 'Основатель стартапа', icon: 'pi pi-lightbulb',  description: 'Подаю заявку, слежу за статусом' },
  ]

  // Quick start tasks per role
  const quickStartTasks = computed(() => {
    const role = userRole.value
    const base = [
      { title: 'Пройти тур по главной', icon: 'pi pi-home', route: '/fst-hub', tourId: 'tour-hub' },
    ]
    if (role === 'analyst') return [
      ...base,
      { title: 'Изучить AI-инвесткомитет', icon: 'pi pi-users', route: '/fst-committee', tourId: 'tour-committee' },
      { title: 'Создать инвест-меморандум', icon: 'pi pi-file', route: '/fst-memo', tourId: null },
      { title: 'Пройти квиз: финметрики', icon: 'pi pi-question-circle', route: '/fst-quiz', tourId: null },
    ]
    if (role === 'manager') return [
      ...base,
      { title: 'Изучить воронку сделок', icon: 'pi pi-filter', route: '/fst-dealflow', tourId: 'tour-dealflow' },
      { title: 'Открыть портфельный монитор', icon: 'pi pi-briefcase', route: '/fst-portfolio', tourId: 'tour-portfolio' },
      { title: 'Настроить Waterfall', icon: 'pi pi-chart-bar', route: '/fst-waterfall', tourId: 'tour-waterfall' },
    ]
    if (role === 'director') return [
      ...base,
      { title: 'Провести заседание ИК', icon: 'pi pi-users', route: '/fst-committee', tourId: 'tour-committee' },
      { title: 'LP Кабинет', icon: 'pi pi-wallet', route: '/fst-lp', tourId: null },
      { title: 'ILPA-отчётность', icon: 'pi pi-file-export', route: '/fst-ilpa', tourId: null },
    ]
    if (role === 'founder') return [
      ...base,
      { title: 'Подать заявку', icon: 'pi pi-send', route: '/fst-apply', tourId: null },
      { title: 'Следить за статусом', icon: 'pi pi-eye', route: '/fst-committee', tourId: 'tour-committee' },
    ]
    return [
      ...base,
      { title: 'Пройти тур: инвесткомитет', icon: 'pi pi-users', route: '/fst-committee', tourId: 'tour-committee' },
      { title: 'Пройти тур: сделка', icon: 'pi pi-file-edit', route: '/fst-deal', tourId: 'tour-deal' },
      { title: 'Изучить глоссарий', icon: 'pi pi-book', route: '/fst-glossary', tourId: null },
    ]
  })

  // Computed: overall progress percentage
  const overallProgress = computed(() => {
    const total =
      tours.value.length +
      videos.value.length +
      quizzes.value.length +
      scenarios.value.length
    const done =
      completedTours.value.length +
      completedVideos.value.length +
      completedQuizzes.value.length +
      completedScenarios.value.length
    if (total === 0) return 0
    return Math.round((done / total) * 100)
  })

  // Computed: next recommended resource
  const nextRecommended = computed(() => {
    const incompleteTour = tours.value.find(t => !completedTours.value.includes(t.id))
    if (incompleteTour) return { type: 'tour', ...incompleteTour }
    const incompleteQuiz = quizzes.value.find(q => !completedQuizzes.value.includes(q.id))
    if (incompleteQuiz) return { type: 'quiz', ...incompleteQuiz }
    return null
  })

  // Recent activities (last 5)
  const recentActivities = computed(() =>
    [...activityLog.value]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5)
  )

  // Actions
  function setUserName(name) {
    userName.value = name
    saveToStorage()
  }

  function setRole(role) {
    userRole.value = role
    saveToStorage()
  }

  function completeTour(tourId) {
    if (!completedTours.value.includes(tourId)) {
      completedTours.value.push(tourId)
      const tour = tours.value.find(t => t.id === tourId)
      logActivity('tour', tourId, tour?.title || tourId)
      saveToStorage()
    }
  }

  function completeVideo(videoId) {
    if (!completedVideos.value.includes(videoId)) {
      completedVideos.value.push(videoId)
      const video = videos.value.find(v => v.id === videoId)
      logActivity('video', videoId, video?.title || videoId)
      saveToStorage()
    }
  }

  function completeQuiz(quizId) {
    if (!completedQuizzes.value.includes(quizId)) {
      completedQuizzes.value.push(quizId)
      const quiz = quizzes.value.find(q => q.id === quizId)
      logActivity('quiz', quizId, quiz?.title || quizId)
      saveToStorage()
    }
  }

  function completeScenario(scenarioId) {
    if (!completedScenarios.value.includes(scenarioId)) {
      completedScenarios.value.push(scenarioId)
      const scenario = scenarios.value.find(s => s.id === scenarioId)
      logActivity('scenario', scenarioId, scenario?.title || scenarioId)
      saveToStorage()
    }
  }

  function viewGlossaryTerm(termId) {
    if (!viewedGlossaryTerms.value.includes(termId)) {
      viewedGlossaryTerms.value.push(termId)
      saveToStorage()
    }
  }

  function logActivity(type, resourceId, resourceTitle) {
    activityLog.value.push({
      type,
      resourceId,
      resourceTitle,
      timestamp: new Date().toISOString(),
    })
    // Keep only last 50 entries
    if (activityLog.value.length > 50) {
      activityLog.value = activityLog.value.slice(-50)
    }
  }

  function saveToStorage() {
    const data = {
      userName: userName.value,
      userRole: userRole.value,
      completedTours: completedTours.value,
      completedVideos: completedVideos.value,
      completedQuizzes: completedQuizzes.value,
      completedScenarios: completedScenarios.value,
      viewedGlossaryTerms: viewedGlossaryTerms.value,
      activityLog: activityLog.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  function loadFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const data = JSON.parse(stored)
        userName.value = data.userName || ''
        userRole.value = data.userRole || null
        completedTours.value = data.completedTours || []
        completedVideos.value = data.completedVideos || []
        completedQuizzes.value = data.completedQuizzes || []
        completedScenarios.value = data.completedScenarios || []
        viewedGlossaryTerms.value = data.viewedGlossaryTerms || []
        activityLog.value = data.activityLog || []
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  function resetProgress() {
    completedTours.value = []
    completedVideos.value = []
    completedQuizzes.value = []
    completedScenarios.value = []
    viewedGlossaryTerms.value = []
    activityLog.value = []
    saveToStorage()
  }

  // Initialize from storage
  loadFromStorage()

  return {
    // State
    userName,
    userRole,
    completedTours,
    completedVideos,
    completedQuizzes,
    completedScenarios,
    viewedGlossaryTerms,
    activityLog,

    // Catalogs
    tours,
    videos,
    videoPlaylists,
    quizzes,
    scenarios,
    availableRoles,

    // Computed
    overallProgress,
    nextRecommended,
    recentActivities,
    quickStartTasks,

    // Actions
    setUserName,
    setRole,
    completeTour,
    completeVideo,
    completeQuiz,
    completeScenario,
    viewGlossaryTerm,
    resetProgress,
  }
})
