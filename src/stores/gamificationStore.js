import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * Gamification Store
 * Manages XP points, badges, streaks, and leaderboard for learning system
 */
export const useGamificationStore = defineStore('gamification', () => {
  // State
  const totalXP = ref(0)
  const unlockedBadges = ref([])
  const quizHistory = ref([])
  const currentStreak = ref(0)
  const lastActivityDate = ref(null)
  const xpHistory = ref([])

  // Load from localStorage on initialization
  loadFromStorage()

  // Computed
  const level = computed(() => {
    return Math.floor(totalXP.value / 100) + 1
  })

  const xpToNextLevel = computed(() => {
    const currentLevel = level.value
    const nextLevelXP = currentLevel * 100
    const currentLevelXP = (currentLevel - 1) * 100
    return nextLevelXP - totalXP.value
  })

  const levelProgress = computed(() => {
    const currentLevel = level.value
    const currentLevelXP = (currentLevel - 1) * 100
    const nextLevelXP = currentLevel * 100
    const progress = ((totalXP.value - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
    return Math.min(Math.round(progress), 100)
  })

  const allBadges = computed(() => {
    return BADGE_DEFINITIONS.map(badge => ({
      ...badge,
      unlocked: unlockedBadges.value.some(b => b.id === badge.id),
      unlockedAt: unlockedBadges.value.find(b => b.id === badge.id)?.unlockedAt
    }))
  })

  const quizCompletionCount = computed(() => {
    return quizHistory.value.length
  })

  const averageQuizScore = computed(() => {
    if (quizHistory.value.length === 0) return 0
    const total = quizHistory.value.reduce((sum, quiz) => sum + quiz.score, 0)
    return Math.round(total / quizHistory.value.length)
  })

  const perfectScoreCount = computed(() => {
    return quizHistory.value.filter(quiz => quiz.score === 100).length
  })

  // Actions
  function addXP(amount, source = 'unknown') {
    totalXP.value += amount
    xpHistory.value.push({
      amount,
      source,
      timestamp: new Date().toISOString(),
      totalXP: totalXP.value
    })
    updateStreak()
    saveToStorage()
    checkLevelUpBadges()
  }

  function unlockBadge(badgeId) {
    const badge = BADGE_DEFINITIONS.find(b => b.id === badgeId)
    if (!badge) return null

    const alreadyUnlocked = unlockedBadges.value.some(b => b.id === badgeId)
    if (alreadyUnlocked) return null

    const unlockedBadge = {
      ...badge,
      unlockedAt: new Date().toISOString()
    }
    unlockedBadges.value.push(unlockedBadge)
    saveToStorage()
    return unlockedBadge
  }

  function recordQuizCompletion(moduleId, quizData) {
    quizHistory.value.push({
      moduleId,
      ...quizData,
      completedAt: new Date().toISOString()
    })
    updateStreak()
    saveToStorage()
    checkQuizBadges()
  }

  function updateStreak() {
    const today = new Date().toDateString()
    const lastDate = lastActivityDate.value ? new Date(lastActivityDate.value).toDateString() : null

    if (lastDate === today) {
      // Already counted today
      return
    }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toDateString()

    if (lastDate === yesterdayStr) {
      // Continue streak
      currentStreak.value++
    } else if (lastDate !== today) {
      // Reset streak (missed a day or first time)
      currentStreak.value = 1
    }

    lastActivityDate.value = new Date().toISOString()
    saveToStorage()
    checkStreakBadges()
  }

  function checkLevelUpBadges() {
    const currentLevel = level.value
    if (currentLevel >= 5 && !unlockedBadges.value.some(b => b.id === 'level-5')) {
      unlockBadge('level-5')
    }
    if (currentLevel >= 10 && !unlockedBadges.value.some(b => b.id === 'level-10')) {
      unlockBadge('level-10')
    }
    if (currentLevel >= 20 && !unlockedBadges.value.some(b => b.id === 'level-20')) {
      unlockBadge('level-20')
    }
  }

  function checkQuizBadges() {
    // First quiz badge
    if (quizCompletionCount.value >= 1 && !unlockedBadges.value.some(b => b.id === 'first-quiz')) {
      unlockBadge('first-quiz')
    }

    // Quiz master badge (10 quizzes)
    if (quizCompletionCount.value >= 10 && !unlockedBadges.value.some(b => b.id === 'quiz-master')) {
      unlockBadge('quiz-master')
    }

    // Perfect score badge (5 perfect scores)
    if (perfectScoreCount.value >= 5 && !unlockedBadges.value.some(b => b.id === 'perfectionist')) {
      unlockBadge('perfectionist')
    }

    // High achiever (average 80%+)
    if (quizCompletionCount.value >= 5 && averageQuizScore.value >= 80 && !unlockedBadges.value.some(b => b.id === 'high-achiever')) {
      unlockBadge('high-achiever')
    }
  }

  function checkStreakBadges() {
    if (currentStreak.value >= 3 && !unlockedBadges.value.some(b => b.id === 'streak-3')) {
      unlockBadge('streak-3')
    }
    if (currentStreak.value >= 7 && !unlockedBadges.value.some(b => b.id === 'streak-7')) {
      unlockBadge('streak-7')
    }
    if (currentStreak.value >= 30 && !unlockedBadges.value.some(b => b.id === 'streak-30')) {
      unlockBadge('streak-30')
    }
  }

  function resetProgress() {
    totalXP.value = 0
    unlockedBadges.value = []
    quizHistory.value = []
    currentStreak.value = 0
    lastActivityDate.value = null
    xpHistory.value = []
    saveToStorage()
  }

  function saveToStorage() {
    const data = {
      totalXP: totalXP.value,
      unlockedBadges: unlockedBadges.value,
      quizHistory: quizHistory.value,
      currentStreak: currentStreak.value,
      lastActivityDate: lastActivityDate.value,
      xpHistory: xpHistory.value
    }
    localStorage.setItem('ventureOS_gamification', JSON.stringify(data))
  }

  function loadFromStorage() {
    const stored = localStorage.getItem('ventureOS_gamification')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        totalXP.value = data.totalXP || 0
        unlockedBadges.value = data.unlockedBadges || []
        quizHistory.value = data.quizHistory || []
        currentStreak.value = data.currentStreak || 0
        lastActivityDate.value = data.lastActivityDate || null
        xpHistory.value = data.xpHistory || []
      } catch (error) {
        console.error('Error loading gamification data:', error)
      }
    }
  }

  function getModuleQuizHistory(moduleId) {
    return quizHistory.value
      .filter(q => q.moduleId === moduleId)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
  }

  function getBestModuleScore(moduleId) {
    const moduleQuizzes = getModuleQuizHistory(moduleId)
    if (moduleQuizzes.length === 0) return null
    return Math.max(...moduleQuizzes.map(q => q.score))
  }

  return {
    // State
    totalXP,
    unlockedBadges,
    quizHistory,
    currentStreak,
    lastActivityDate,
    xpHistory,

    // Computed
    level,
    xpToNextLevel,
    levelProgress,
    allBadges,
    quizCompletionCount,
    averageQuizScore,
    perfectScoreCount,

    // Actions
    addXP,
    unlockBadge,
    recordQuizCompletion,
    updateStreak,
    resetProgress,
    getModuleQuizHistory,
    getBestModuleScore
  }
})

/**
 * Badge Definitions
 */
const BADGE_DEFINITIONS = [
  // Quiz-related badges
  {
    id: 'first-quiz',
    name: 'Первый шаг',
    icon: '🎯',
    description: 'Завершите свой первый квиз',
    category: 'quiz'
  },
  {
    id: 'quiz-master',
    name: 'Мастер квизов',
    icon: '🏆',
    description: 'Завершите 10 квизов',
    category: 'quiz'
  },
  {
    id: 'perfectionist',
    name: 'Перфекционист',
    icon: '💎',
    description: 'Получите 5 идеальных результатов (100%)',
    category: 'quiz'
  },
  {
    id: 'high-achiever',
    name: 'Отличник',
    icon: '⭐',
    description: 'Средний балл выше 80% (минимум 5 квизов)',
    category: 'quiz'
  },

  // Level badges
  {
    id: 'level-5',
    name: 'Уровень 5',
    icon: '🔥',
    description: 'Достигните 5 уровня',
    category: 'level'
  },
  {
    id: 'level-10',
    name: 'Уровень 10',
    icon: '⚡',
    description: 'Достигните 10 уровня',
    category: 'level'
  },
  {
    id: 'level-20',
    name: 'Уровень 20',
    icon: '👑',
    description: 'Достигните 20 уровня',
    category: 'level'
  },

  // Streak badges
  {
    id: 'streak-3',
    name: '3 дня подряд',
    icon: '🔥',
    description: 'Занимайтесь 3 дня подряд',
    category: 'streak'
  },
  {
    id: 'streak-7',
    name: 'Неделя подряд',
    icon: '🌟',
    description: 'Занимайтесь 7 дней подряд',
    category: 'streak'
  },
  {
    id: 'streak-30',
    name: 'Месяц подряд',
    icon: '💪',
    description: 'Занимайтесь 30 дней подряд',
    category: 'streak'
  },

  // Module-specific perfect badges
  {
    id: 'perfect-fst-committee',
    name: 'Эксперт по инвесткомитету',
    icon: '🏆',
    description: '100% в квизе по модулю AI-инвесткомитет',
    category: 'module'
  },
  {
    id: 'perfect-fst-deal',
    name: 'Эксперт по сделкам',
    icon: '💼',
    description: '100% в квизе по модулю Сделка',
    category: 'module'
  },
  {
    id: 'perfect-fst-portfolio',
    name: 'Эксперт по портфелю',
    icon: '📊',
    description: '100% в квизе по модулю Портфель',
    category: 'module'
  },
  {
    id: 'perfect-fst-waterfall',
    name: 'Эксперт по Waterfall',
    icon: '💰',
    description: '100% в квизе по модулю Waterfall',
    category: 'module'
  },
  {
    id: 'perfect-fst-ilpa',
    name: 'Эксперт по ILPA',
    icon: '📋',
    description: '100% в квизе по модулю ILPA',
    category: 'module'
  }
]
