/**
 * YouTube AI Composable
 *
 * Composable for AI-powered YouTube Analytics features
 *
 * Issue #1542: Added graceful error handling when AI backend is unavailable
 */

import { ref } from 'vue'
import * as aiService from '@/services/aiService'
import { useToast } from 'primevue/usetoast'

/**
 * Parse AI backend error and return user-friendly message
 * @param {Error} error - Error from AI service
 * @returns {Object} { summary, detail, severity }
 */
function parseAIError(error) {
  const errorMessage = error.message || error.toString()

  // Check for structured error types
  if (errorMessage.includes('AI_BACKEND_NOT_FOUND')) {
    return {
      summary: 'AI Backend недоступен',
      detail: 'Сервер AI не найден. Обратитесь к администратору для настройки AI функций.',
      severity: 'warn'
    }
  }

  if (errorMessage.includes('AI_BACKEND_ERROR')) {
    return {
      summary: 'Ошибка конфигурации AI',
      detail: 'Сервер AI не настроен правильно. База данных или миграции могут быть не применены. Обратитесь к администратору.',
      severity: 'error'
    }
  }

  if (errorMessage.includes('AI_BACKEND_OFFLINE')) {
    return {
      summary: 'AI Backend оффлайн',
      detail: 'Не удается подключиться к серверу AI. Проверьте, что backend запущен.',
      severity: 'warn'
    }
  }

  // Generic error
  return {
    summary: 'Ошибка AI сервиса',
    detail: errorMessage,
    severity: 'error'
  }
}

export function useYouTubeAI() {
  const toast = useToast()

  // State
  const sentimentAnalysis = ref(null)
  const trendPredictions = ref(null)
  const contentRecommendations = ref(null)
  const competitorAnalysis = ref(null)
  const analyzingSentiment = ref(false)
  const predictingTrends = ref(false)
  const generatingRecommendations = ref(false)
  const analyzingCompetitors = ref(false)

  /**
   * Analyze comment sentiment
   * @param {Array<Object>} comments - Comments to analyze
   * @param {string} model - AI model to use
   */
  async function analyzeSentiment(comments, model = 'deepseek-chat') {
    if (!comments || comments.length === 0) {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет комментариев для анализа',
        life: 3000
      })
      return null
    }

    analyzingSentiment.value = true
    try {
      const response = await aiService.analyzeCommentSentiment(comments, model)

      // Transform backend response to expected format
      const data = response.data || response
      const totalComments = data.total_comments_analyzed || comments.length

      const result = {
        positive_percent: Math.round((data.overall_sentiment?.positive || 0) * 100),
        positive_count: Math.round(totalComments * (data.overall_sentiment?.positive || 0)),
        neutral_percent: Math.round((data.overall_sentiment?.neutral || 0) * 100),
        neutral_count: Math.round(totalComments * (data.overall_sentiment?.neutral || 0)),
        negative_percent: Math.round((data.overall_sentiment?.negative || 0) * 100),
        negative_count: Math.round(totalComments * (data.overall_sentiment?.negative || 0)),
        insights: data.summary || 'Анализ тональности завершен',
        key_topics: data.key_topics || [],
        sample_comments: data.sample_comments || {}
      }

      sentimentAnalysis.value = result

      toast.add({
        severity: 'success',
        summary: 'Анализ завершен',
        detail: `Проанализировано ${comments.length} комментариев`,
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Sentiment analysis error:', error)

      // Use structured error parsing for better user feedback
      const errorInfo = parseAIError(error)
      toast.add({
        severity: errorInfo.severity,
        summary: errorInfo.summary,
        detail: errorInfo.detail,
        life: 5000 // Longer duration for error messages
      })
      return null
    } finally {
      analyzingSentiment.value = false
    }
  }

  /**
   * Predict trends based on channel data
   * @param {Object} channelData - Channel performance data
   * @param {string} model - AI model to use
   */
  async function predictTrends(channelData, model = 'deepseek-chat') {
    if (!channelData) {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет данных канала для анализа',
        life: 3000
      })
      return null
    }

    predictingTrends.value = true
    try {
      const response = await aiService.predictTrends(channelData, model)

      // Transform backend response to expected format
      const data = response.data || response
      const predictions = data.predictions || {}

      const result = {
        predictions: [
          {
            icon: '📈',
            title: 'Прогноз роста подписчиков',
            description: `Ожидаемый рост: ${predictions.growth_forecast?.next_30_days || 'н/д'} за 30 дней, ${predictions.growth_forecast?.next_90_days || 'н/д'} за 90 дней`,
            confidence: predictions.growth_forecast?.confidence > 0.7 ? 'high' : 'medium'
          },
          ...(predictions.trending_topics || []).map(topic => ({
            icon: '🔥',
            title: `Трендовая тема: ${topic.topic}`,
            description: `Потенциал: ${topic.potential}`,
            confidence: topic.potential === 'high' ? 'high' : 'medium'
          })),
          ...(predictions.recommended_actions || []).map(action => ({
            icon: '💡',
            title: 'Рекомендуемое действие',
            description: action,
            confidence: 'medium'
          }))
        ],
        summary: `Прогноз на основе анализа данных канала. Модель: ${data.model_used || model}`
      }

      trendPredictions.value = result

      toast.add({
        severity: 'success',
        summary: 'Прогноз готов',
        detail: 'Трендовые прогнозы сгенерированы',
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Trend prediction error:', error)

      // Use structured error parsing for better user feedback
      const errorInfo = parseAIError(error)
      toast.add({
        severity: errorInfo.severity,
        summary: errorInfo.summary,
        detail: errorInfo.detail,
        life: 5000
      })
      return null
    } finally {
      predictingTrends.value = false
    }
  }

  /**
   * Generate content recommendations
   * @param {Object} channelAnalytics - Channel analytics data
   * @param {Object} options - Generation options
   */
  async function generateRecommendations(channelAnalytics, options = {}) {
    if (!channelAnalytics) {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет аналитики для генерации рекомендаций',
        life: 3000
      })
      return null
    }

    generatingRecommendations.value = true
    try {
      const response = await aiService.generateContentRecommendations(channelAnalytics, options)

      // Transform backend response to expected format
      const data = response.data || response
      const recs = data.recommendations || {}

      const result = {
        recommendations: [
          ...(recs.topics || []).map(topic => ({
            category: 'Темы контента',
            title: topic.title,
            description: topic.reason,
            actions: ['Создать видео на эту тему', 'Изучить аудиторию интереса'],
            expected_impact: 'Увеличение просмотров и вовлеченности',
            priority: 'high'
          })),
          {
            category: 'Расписание публикаций',
            title: 'Оптимальное время публикаций',
            description: `Лучшие дни: ${recs.timing?.best_days?.join(', ') || 'н/д'}. Лучшее время: ${recs.timing?.best_hours?.join(', ') || 'н/д'}`,
            actions: [
              `Публиковать ${recs.timing?.frequency || '2-3 раза в неделю'}`,
              'Придерживаться графика публикаций'
            ],
            expected_impact: 'Стабильный рост аудитории',
            priority: 'medium'
          },
          {
            category: 'Формат видео',
            title: 'Рекомендации по формату',
            description: recs.format?.recommended_style || 'Образовательный контент',
            actions: [
              `Оптимальная длина: ${recs.format?.optimal_length || '10-15 минут'}`,
              `Миниатюры: ${recs.format?.thumbnail_tips || 'Яркие и информативные'}`
            ],
            expected_impact: 'Повышение кликабельности и удержания',
            priority: 'medium'
          }
        ]
      }

      contentRecommendations.value = result

      toast.add({
        severity: 'success',
        summary: 'Рекомендации готовы',
        detail: 'Рекомендации по контенту сгенерированы',
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Recommendations error:', error)

      // Use structured error parsing for better user feedback
      const errorInfo = parseAIError(error)
      toast.add({
        severity: errorInfo.severity,
        summary: errorInfo.summary,
        detail: errorInfo.detail,
        life: 5000
      })
      return null
    } finally {
      generatingRecommendations.value = false
    }
  }

  /**
   * Analyze competitors
   * @param {Array<Object>} competitors - Competitor channel data
   * @param {Object} ownChannel - Own channel data
   */
  async function analyzeCompetitorChannels(competitors, ownChannel) {
    if (!competitors || competitors.length === 0) {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет данных конкурентов для анализа',
        life: 3000
      })
      return null
    }

    analyzingCompetitors.value = true
    try {
      const response = await aiService.analyzeCompetitors(competitors, ownChannel)

      // Transform backend response to expected format
      const data = response.data || response
      const analysis = data.analysis || {}

      const result = {
        strengths: analysis.strengths || [],
        weaknesses: analysis.weaknesses || [],
        opportunities: analysis.opportunities || [],
        summary: `Ваша конкурентная позиция: ${analysis.competitive_position || 'средняя'}. ${analysis.competitor_insights?.map(c => c.lessons_learned).join('. ') || ''}`
      }

      competitorAnalysis.value = result

      toast.add({
        severity: 'success',
        summary: 'Анализ завершен',
        detail: `Проанализировано ${competitors.length} конкурентов`,
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Competitor analysis error:', error)

      // Use structured error parsing for better user feedback
      const errorInfo = parseAIError(error)
      toast.add({
        severity: errorInfo.severity,
        summary: errorInfo.summary,
        detail: errorInfo.detail,
        life: 5000
      })
      return null
    } finally {
      analyzingCompetitors.value = false
    }
  }

  /**
   * Clear all AI analysis results
   */
  function clearAnalysis() {
    sentimentAnalysis.value = null
    trendPredictions.value = null
    contentRecommendations.value = null
    competitorAnalysis.value = null
  }

  return {
    // State
    sentimentAnalysis,
    trendPredictions,
    contentRecommendations,
    competitorAnalysis,
    analyzingSentiment,
    predictingTrends,
    generatingRecommendations,
    analyzingCompetitors,

    // Methods
    analyzeSentiment,
    predictTrends,
    generateRecommendations,
    analyzeCompetitorChannels,
    clearAnalysis
  }
}
