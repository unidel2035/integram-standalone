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
  }
}
