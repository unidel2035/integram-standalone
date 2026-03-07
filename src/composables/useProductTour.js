/**
 * Product Tour Composable
 *
 * Provides interactive guided tours using driver.js
 * Implements the interactive product tour feature from Issue #72
 */

import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useToast } from 'primevue/usetoast'

export function useProductTour() {
  const onboardingStore = useOnboardingStore()
  const toast = useToast()

  /**
   * Dashboard tour configuration
   */
  const dashboardTourSteps = [
    {
      element: '[data-tour="sidebar"]',
      popover: {
        title: 'Боковая панель',
        description: 'Здесь находится главное меню навигации. Вы можете переключаться между различными разделами приложения.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="dashboard-header"]',
      popover: {
        title: 'Заголовок дашборда',
        description: 'Здесь отображается важная информация и быстрый доступ к действиям.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="workspaces"]',
      popover: {
        title: 'Рабочие пространства',
        description: 'Создавайте и управляйте рабочими пространствами для организации ваших проектов.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: '[data-tour="agents"]',
      popover: {
        title: 'Агенты',
        description: 'Управляйте AI-агентами для автоматизации задач.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: '[data-tour="user-menu"]',
      popover: {
        title: 'Меню пользователя',
        description: 'Доступ к настройкам профиля, уведомлениям и выходу из системы.',
        side: 'bottom',
        align: 'end',
      },
    },
  ]

  /**
   * Agent constructor tour configuration
   */
  const agentConstructorTourSteps = [
    {
      element: '[data-tour="agent-name"]',
      popover: {
        title: 'Имя агента',
        description: 'Дайте вашему агенту понятное имя.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="agent-type"]',
      popover: {
        title: 'Тип агента',
        description: 'Выберите тип агента в зависимости от задачи.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="agent-settings"]',
      popover: {
        title: 'Настройки агента',
        description: 'Настройте параметры работы агента.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: '[data-tour="agent-save"]',
      popover: {
        title: 'Сохранение',
        description: 'Не забудьте сохранить вашего агента!',
        side: 'top',
        align: 'end',
      },
    },
  ]

  /**
   * Workflow builder tour configuration
   */
  const workflowBuilderTourSteps = [
    {
      element: '[data-tour="workflow-canvas"]',
      popover: {
        title: 'Холст workflow',
        description: 'Перетаскивайте блоки и соединяйте их для создания рабочих процессов.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="workflow-nodes"]',
      popover: {
        title: 'Узлы workflow',
        description: 'Выберите узлы для добавления на холст.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="workflow-controls"]',
      popover: {
        title: 'Управление',
        description: 'Управляйте масштабом и навигацией по холсту.',
        side: 'left',
        align: 'start',
      },
    },
  ]

  /**
   * Initialize driver.js instance
   */
  const createDriver = (steps, options = {}) => {
    return driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Далее',
      prevBtnText: 'Назад',
      doneBtnText: 'Готово',
      closeBtnText: 'Закрыть',
      progressText: '{{current}} из {{total}}',
      overlayColor: 'rgba(0, 0, 0, 0.5)',
      popoverClass: 'driverjs-theme',
      onDestroyStarted: () => {
        if (!driver.hasNextStep()) {
          // Tour completed
          handleTourComplete(options.tourId)
        }
      },
      onDestroyed: () => {
        if (options.onDestroyed) {
          options.onDestroyed()
        }
      },
      steps,
      ...options,
    })
  }

  /**
   * Handle tour completion
   */
  const handleTourComplete = (tourId) => {
    if (tourId) {
      onboardingStore.completeTourStep(tourId)

      toast.add({
        severity: 'success',
        summary: 'Тур завершен!',
        detail: 'Отличная работа! Вы завершили этот этап обучения.',
        life: 3000,
      })
    }
  }

  /**
   * Start dashboard tour
   */
  const startDashboardTour = () => {
    const driverInstance = createDriver(dashboardTourSteps, {
      tourId: 'dashboard',
    })

    driverInstance.drive()
  }

  /**
   * Start agent constructor tour
   */
  const startAgentConstructorTour = () => {
    const driverInstance = createDriver(agentConstructorTourSteps, {
      tourId: 'agents',
    })

    driverInstance.drive()
  }

  /**
   * Start workflow builder tour
   */
  const startWorkflowBuilderTour = () => {
    const driverInstance = createDriver(workflowBuilderTourSteps, {
      tourId: 'workflow',
    })

    driverInstance.drive()
  }

  /**
   * Start custom tour with provided steps
   */
  const startCustomTour = (steps, tourId = null) => {
    const driverInstance = createDriver(steps, {
      tourId,
    })

    driverInstance.drive()
  }

  /**
   * FST Hub tour configuration (10 steps)
   */
  const fstHubTourSteps = [
    {
      popover: {
        title: 'Добро пожаловать в ФСТ НТИ! 🚀',
        description: 'Давайте познакомимся с главной страницей платформы. Вы увидите воронку инвестиций, ключевые метрики и модули фонда.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="hero-stats"]',
      popover: {
        title: 'Ключевые метрики фонда',
        description: 'Здесь отображаются основные показатели: среднее время решения (48 часов!), количество портфельных компаний, субфондов и прогнозный IRR.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="hero-actions"]',
      popover: {
        title: 'Быстрые действия',
        description: 'Подайте заявку на инвестиции или запустите AI-инвесткомитет прямо отсюда.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="pipeline"]',
      popover: {
        title: 'Жизненный цикл инвестиции',
        description: 'Весь путь от заявки до выхода: Заявка → ИК → Сделка → Исполнение → Мониторинг → Выход. Каждый этап оптимизирован AI.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="transform"]',
      popover: {
        title: 'Как мы перестроили процесс',
        description: 'Сравните традиционный фонд (3-6 месяцев, без объяснений) и ФСТ НТИ (48 часов, прозрачный протокол дебатов).',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="modules"]',
      popover: {
        title: 'Ключевые модули платформы',
        description: 'Здесь представлены все модули фонда: от AI Deal Sourcing до водопада выплат. Нажмите на любой модуль, чтобы перейти.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '.fst-mod-card--hero:first-child',
      popover: {
        title: 'Модуль с меткой "Ключевой"',
        description: 'Модули с этой меткой — основа платформы. Начните знакомство с них.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: '[data-tour="tools"]',
      popover: {
        title: 'Экосистема инструментов',
        description: 'Дополнительные инструменты для управления фондом: AML/KYC, юридика, гранты, ESG и другие.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="orbit"]',
      popover: {
        title: 'Digital Twin фонда',
        description: 'Наша платформа создаёт цифровой двойник фонда — живую модель всех процессов, портфеля и прогнозов.',
        side: 'left',
        align: 'center',
      },
    },
    {
      popover: {
        title: 'Готово! 🎉',
        description: 'Теперь вы знаете структуру платформы. Изучите модули Инвесткомитета, Сделки и Портфеля для полного понимания.',
        side: 'bottom',
        align: 'center',
      },
    },
  ]

  /**
   * FST Committee tour configuration (8 steps)
   */
  const fstCommitteeTourSteps = [
    {
      popover: {
        title: 'AI Инвесткомитет 🤖',
        description: '6 AI-агентов анализируют проект, дебатируют и принимают решение за 48 часов вместо 3-6 месяцев.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="committee-agents"]',
      popover: {
        title: '6 AI-агентов ИК',
        description: 'Технолог, Финансист, Эксперт по суверенности, Риск-аналитик, Стратег и Адвокат дьявола. Каждый оценивает проект со своей стороны.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="committee-project"]',
      popover: {
        title: 'Выбор проекта',
        description: 'Выберите проект из дилфлоу для рассмотрения на инвесткомитете.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="committee-start"]',
      popover: {
        title: 'Запуск заседания ИК',
        description: 'Нажмите эту кнопку, чтобы запустить AI-дебаты. Агенты начнут многораундовое обсуждение проекта.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="committee-debate"]',
      popover: {
        title: 'Протокол дебатов',
        description: 'Здесь отображается ход дебатов: аргументы каждого агента, раунды обсуждений, консенсус или противоречия.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: '[data-tour="committee-voting"]',
      popover: {
        title: 'Голосование агентов',
        description: 'После дебатов каждый агент голосует: ЗА, ПРОТИВ или ВОЗДЕРЖАЛСЯ. Решение принимается на основе взвешенного консенсуса.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: '[data-tour="committee-decision"]',
      popover: {
        title: 'Итоговое решение ИК',
        description: 'Финальное решение с обоснованием: почему одобрено или отклонено, ключевые риски, рекомендации.',
        side: 'top',
        align: 'center',
      },
    },
    {
      popover: {
        title: 'Прозрачный процесс! ✅',
        description: 'Весь протокол дебатов доступен стартапу — это революция в прозрачности венчурных инвестиций.',
        side: 'bottom',
        align: 'center',
      },
    },
  ]

  /**
   * FST Deal tour configuration (7 steps)
   */
  const fstDealTourSteps = [
    {
      popover: {
        title: 'Структурирование сделки 📋',
        description: 'Модуль ведения сделки: SPV, транши, Term Sheet, финансовая модель и юридические документы.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="deal-header"]',
      popover: {
        title: 'Карточка проекта',
        description: 'Основная информация о компании, сумма инвестиции, доля, оценка (pre/post-money).',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="deal-spv"]',
      popover: {
        title: 'SPV (Special Purpose Vehicle)',
        description: 'Создание отдельной инвестиционной структуры для сделки. Указываются субфонд, LP-инвесторы, доли.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="deal-tranches"]',
      popover: {
        title: 'Траншевая структура',
        description: 'Разбивка инвестиции на транши с условиями выплаты (milestones, KPI, сроки). Снижение рисков для фонда.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: '[data-tour="deal-termsheet"]',
      popover: {
        title: 'Term Sheet',
        description: 'Основные условия сделки: тип инструмента (акции/SAFE/конверт), права, преференции, антиразмытие.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: '[data-tour="deal-finmodel"]',
      popover: {
        title: 'Финансовая модель',
        description: 'Интерактивная модель прогноза: выручка, расходы, EBITDA, burn rate, runway, сценарии развития.',
        side: 'top',
        align: 'center',
      },
    },
    {
      popover: {
        title: 'Сделка готова! 🤝',
        description: 'Все документы и модели можно экспортировать в PDF. Далее — Исполнение и Мониторинг портфеля.',
        side: 'bottom',
        align: 'center',
      },
    },
  ]

  /**
   * FST Portfolio tour configuration (6 steps)
   */
  const fstPortfolioTourSteps = [
    {
      popover: {
        title: 'Мониторинг портфеля 📊',
        description: 'Онлайн-трекинг всех портфельных компаний: светофор рисков, датчики здоровья, AI-отчёты.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="portfolio-grid"]',
      popover: {
        title: 'Список портфельных компаний',
        description: 'Все компании в портфеле с ключевыми показателями: статус, риски, NAV, IRR, последнее обновление.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="portfolio-traffic-light"]',
      popover: {
        title: 'Светофор рисков 🚦',
        description: 'Красный = высокий риск, жёлтый = средний, зелёный = норма. AI анализирует burn rate, runway, выполнение KPI.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: '[data-tour="portfolio-sensors"]',
      popover: {
        title: 'Датчики здоровья компании',
        description: 'Выручка, расходы, клиенты, команда, технологический прогресс (TRL/MRL), runway — всё в реальном времени.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: '[data-tour="portfolio-ai-reports"]',
      popover: {
        title: 'AI-отчёты и рекомендации',
        description: 'AI автоматически генерирует квартальные отчёты, выявляет тревожные сигналы и предлагает действия.',
        side: 'top',
        align: 'center',
      },
    },
    {
      popover: {
        title: 'Портфель под контролем! 🎯',
        description: 'Теперь вы знаете, как мониторить портфель в режиме реального времени и реагировать на риски.',
        side: 'bottom',
        align: 'center',
      },
    },
  ]

  /**
   * FST Dealflow tour configuration (5 steps)
   */
  const fstDealflowTourSteps = [
    {
      popover: {
        title: 'Воронка заявок (Dealflow) 🔍',
        description: 'Все заявки от стартапов: фильтрация, скоринг, статусы, быстрый переход к рассмотрению.',
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="dealflow-filters"]',
      popover: {
        title: 'Фильтры и поиск',
        description: 'Фильтруйте заявки по статусу (новая, на рассмотрении, одобрена, отклонена), отрасли, суверенности, сумме инвестиции.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="dealflow-table"]',
      popover: {
        title: 'Таблица заявок',
        description: 'Список всех проектов с ключевыми данными: название, отрасль, запрашиваемая сумма, AI-скоринг, статус.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="dealflow-scoring"]',
      popover: {
        title: 'AI-скоринг проекта',
        description: 'Автоматическая оценка проекта по критериям: технология, рынок, команда, финансы, суверенность (0-100 баллов).',
        side: 'left',
        align: 'start',
      },
    },
    {
      popover: {
        title: 'Дилфлоу готов! 📌',
        description: 'Выберите проект и отправьте его на AI-инвесткомитет одним кликом.',
        side: 'bottom',
        align: 'center',
      },
    },
  ]

  /**
   * Start FST Hub tour
   */
  const startFstHubTour = () => {
    const driverInstance = createDriver(fstHubTourSteps, {
      tourId: 'fst-hub',
    })
    driverInstance.drive()
  }

  /**
   * Start FST Committee tour
   */
  const startFstCommitteeTour = () => {
    const driverInstance = createDriver(fstCommitteeTourSteps, {
      tourId: 'fst-committee',
    })
    driverInstance.drive()
  }

  /**
   * Start FST Deal tour
   */
  const startFstDealTour = () => {
    const driverInstance = createDriver(fstDealTourSteps, {
      tourId: 'fst-deal',
    })
    driverInstance.drive()
  }

  /**
   * Start FST Portfolio tour
   */
  const startFstPortfolioTour = () => {
    const driverInstance = createDriver(fstPortfolioTourSteps, {
      tourId: 'fst-portfolio',
    })
    driverInstance.drive()
  }

  /**
   * Start FST Dealflow tour
   */
  const startFstDealflowTour = () => {
    const driverInstance = createDriver(fstDealflowTourSteps, {
      tourId: 'fst-dealflow',
    })
    driverInstance.drive()
  }

  /**
   * Highlight a specific element
   */
  const highlightElement = (selector, options = {}) => {
    const driverInstance = driver({
      showButtons: ['close'],
      closeBtnText: 'Закрыть',
      overlayColor: 'rgba(0, 0, 0, 0.5)',
      ...options,
    })

    driverInstance.highlight({
      element: selector,
      popover: options.popover || {
        title: 'Обратите внимание',
        description: 'Этот элемент может быть вам полезен',
      },
    })
  }

  /**
   * Check if tour should be started automatically
   */
  const shouldStartTour = (tourId) => {
    if (onboardingStore.preferences.skipTour) {
      return false
    }

    const tourStep = onboardingStore.tourSteps.find(step => step.id === tourId)
    return tourStep && !tourStep.completed
  }

  /**
   * Get tour progress
   */
  const getTourProgress = () => {
    return {
      completed: onboardingStore.completedTourStepsCount,
      total: onboardingStore.tourSteps.length,
      percentage: onboardingStore.tourProgress,
    }
  }

  return {
    startDashboardTour,
    startAgentConstructorTour,
    startWorkflowBuilderTour,
    startCustomTour,
    highlightElement,
    shouldStartTour,
    getTourProgress,
    // FST module tours (Issue #108)
    startFstHubTour,
    startFstCommitteeTour,
    startFstDealTour,
    startFstPortfolioTour,
    startFstDealflowTour,
  }
}
