import { defineStore } from 'pinia'

export const useAgentTrainingStore = defineStore('agentTraining', {
  state: () => ({
    answers: [], // История ответов { query, selectedAgent, correctAgent, isCorrect, timestamp }
    completedCategories: [], // Пройденные категории
    lastSessionDate: null
  }),

  getters: {
    hasProgress: (state) => state.answers.length > 0,

    correctAnswers: (state) => state.answers.filter(a => a.isCorrect).length,

    wrongAnswers: (state) => state.answers.filter(a => !a.isCorrect).length,

    totalAnswers: (state) => state.answers.length,

    successRate: (state) => {
      if (state.answers.length === 0) return 0
      return Math.round((state.answers.filter(a => a.isCorrect).length / state.answers.length) * 100)
    },

    completionPercentage: (state) => {
      // Assume 100 questions total for completion
      const targetQuestions = 100
      return Math.min(100, Math.round((state.answers.length / targetQuestions) * 100))
    },

    // Статистика по категориям
    categoryStats: (state) => {
      const stats = {}
      state.answers.forEach(answer => {
        const category = answer.category || 'Other'
        if (!stats[category]) {
          stats[category] = { correct: 0, wrong: 0, total: 0 }
        }
        stats[category].total++
        if (answer.isCorrect) {
          stats[category].correct++
        } else {
          stats[category].wrong++
        }
      })
      return stats
    },

    // Последние ошибки для анализа
    recentMistakes: (state) => {
      return state.answers
        .filter(a => !a.isCorrect)
        .slice(-10)
        .reverse()
    },

    // Прогресс за последнюю неделю
    weeklyProgress: (state) => {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      return state.answers.filter(a => new Date(a.timestamp) > weekAgo)
    }
  },

  actions: {
    recordAnswer(query, selectedAgent, isCorrect, correctAgent = null, category = null) {
      this.answers.push({
        query,
        selectedAgent,
        correctAgent: correctAgent || selectedAgent,
        isCorrect,
        category,
        timestamp: new Date().toISOString()
      })

      this.saveProgress()
    },

    markCategoryCompleted(categoryName) {
      if (!this.completedCategories.includes(categoryName)) {
        this.completedCategories.push(categoryName)
        this.saveProgress()
      }
    },

    resetProgress() {
      this.answers = []
      this.completedCategories = []
      this.lastSessionDate = null
      this.saveProgress()
    },

    saveProgress() {
      localStorage.setItem('agentTrainingProgress', JSON.stringify({
        answers: this.answers,
        completedCategories: this.completedCategories,
        lastSessionDate: new Date().toISOString()
      }))
    },

    loadProgress() {
      const saved = localStorage.getItem('agentTrainingProgress')
      if (saved) {
        const data = JSON.parse(saved)
        this.answers = data.answers || []
        this.completedCategories = data.completedCategories || []
        this.lastSessionDate = data.lastSessionDate
      }
    },

    // Получить рекомендации на основе ошибок
    getRecommendations() {
      const mistakes = this.recentMistakes
      const recommendations = []

      // Анализируем частые ошибки
      const errorAgents = {}
      mistakes.forEach(m => {
        const agent = m.correctAgent
        errorAgents[agent] = (errorAgents[agent] || 0) + 1
      })

      // Топ-3 агента с наибольшим количеством ошибок
      const topErrors = Object.entries(errorAgents)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)

      topErrors.forEach(([agent, count]) => {
        recommendations.push({
          agent,
          errorCount: count,
          recommendation: `Рекомендуем изучить триггеры агента "${agent}" - ${count} ошибок`
        })
      })

      return recommendations
    }
  }
})
