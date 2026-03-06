/**
 * Quality and Feedback Service
 * Handles feedback collection, sentiment analysis, quality metrics, and survey management
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

class FeedbackService {
  /**
   * Feedback Collection
   */

  async collectFeedback(feedbackData) {
    const response = await axios.post(`${API_BASE_URL}/feedback/collect`, feedbackData)
    return response.data
  }

  async getFeedback(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback`, { params: options })
    return response.data
  }

  async getFeedbackById(feedbackId) {
    const response = await axios.get(`${API_BASE_URL}/feedback/${feedbackId}`)
    return response.data
  }

  async updateFeedback(feedbackId, updates) {
    const response = await axios.patch(`${API_BASE_URL}/feedback/${feedbackId}`, updates)
    return response.data
  }

  async deleteFeedback(feedbackId) {
    const response = await axios.delete(`${API_BASE_URL}/feedback/${feedbackId}`)
    return response.data
  }

  /**
   * Sentiment Analysis
   */

  async analyzeSentiment(text, options = {}) {
    const response = await axios.post(`${API_BASE_URL}/feedback/analyze-sentiment`, {
      text,
      ...options
    })
    return response.data
  }

  async getSentimentTrends(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/sentiment-trends`, { params: options })
    return response.data
  }

  async extractTopics(text) {
    const response = await axios.post(`${API_BASE_URL}/feedback/extract-topics`, { text })
    return response.data
  }

  /**
   * Surveys
   */

  async createSurvey(surveyData) {
    const response = await axios.post(`${API_BASE_URL}/feedback/surveys`, surveyData)
    return response.data
  }

  async getSurveys(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/surveys`, { params: options })
    return response.data
  }

  async getSurveyById(surveyId) {
    const response = await axios.get(`${API_BASE_URL}/feedback/surveys/${surveyId}`)
    return response.data
  }

  async updateSurvey(surveyId, updates) {
    const response = await axios.patch(`${API_BASE_URL}/feedback/surveys/${surveyId}`, updates)
    return response.data
  }

  async deleteSurvey(surveyId) {
    const response = await axios.delete(`${API_BASE_URL}/feedback/surveys/${surveyId}`)
    return response.data
  }

  async distributeSurvey(surveyId, distribution) {
    const response = await axios.post(`${API_BASE_URL}/feedback/surveys/${surveyId}/distribute`, distribution)
    return response.data
  }

  async submitSurveyResponse(surveyId, responseData) {
    const response = await axios.post(`${API_BASE_URL}/feedback/surveys/${surveyId}/responses`, responseData)
    return response.data
  }

  async getSurveyResponses(surveyId, options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/surveys/${surveyId}/responses`, { params: options })
    return response.data
  }

  async getSurveyAnalytics(surveyId) {
    const response = await axios.get(`${API_BASE_URL}/feedback/surveys/${surveyId}/analytics`)
    return response.data
  }

  /**
   * Quality Metrics
   */

  async getQualityMetrics(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/quality-metrics`, { params: options })
    return response.data
  }

  async recordQualityMetric(metricData) {
    const response = await axios.post(`${API_BASE_URL}/feedback/quality-metrics`, metricData)
    return response.data
  }

  async getQualityTrends(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/quality-trends`, { params: options })
    return response.data
  }

  async scoreInteraction(interactionId, scoreData) {
    const response = await axios.post(`${API_BASE_URL}/feedback/score-interaction`, {
      interactionId,
      ...scoreData
    })
    return response.data
  }

  /**
   * Action Items
   */

  async getActionItems(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/action-items`, { params: options })
    return response.data
  }

  async createActionItem(actionData) {
    const response = await axios.post(`${API_BASE_URL}/feedback/action-items`, actionData)
    return response.data
  }

  async updateActionItem(actionId, updates) {
    const response = await axios.patch(`${API_BASE_URL}/feedback/action-items/${actionId}`, updates)
    return response.data
  }

  async assignActionItem(actionId, assigneeId) {
    const response = await axios.post(`${API_BASE_URL}/feedback/action-items/${actionId}/assign`, {
      assigneeId
    })
    return response.data
  }

  async completeActionItem(actionId, resolution) {
    const response = await axios.post(`${API_BASE_URL}/feedback/action-items/${actionId}/complete`, {
      resolution
    })
    return response.data
  }

  /**
   * Dashboard and Analytics
   */

  async getDashboard(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/dashboard`, { params: options })
    return response.data
  }

  async getInsights(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/insights`, { params: options })
    return response.data
  }

  async getTopIssues(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/top-issues`, { params: options })
    return response.data
  }

  async getChurnPrediction(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/churn-prediction`, { params: options })
    return response.data
  }

  /**
   * NPS & CSAT
   */

  async calculateNPS(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/nps`, { params: options })
    return response.data
  }

  async calculateCSAT(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/csat`, { params: options })
    return response.data
  }

  async getNPSTrends(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/nps-trends`, { params: options })
    return response.data
  }

  async getCSATTrends(options = {}) {
    const response = await axios.get(`${API_BASE_URL}/feedback/csat-trends`, { params: options })
    return response.data
  }

  /**
   * Export and Integration
   */

  async exportFeedback(format, options = {}) {
    const response = await axios.post(`${API_BASE_URL}/feedback/export`, {
      format,
      ...options
    }, {
      responseType: format === 'csv' || format === 'xlsx' ? 'blob' : 'json'
    })
    return response.data
  }

  async integrateWithSystem(system, config) {
    const response = await axios.post(`${API_BASE_URL}/feedback/integrations/${system}`, config)
    return response.data
  }

  /**
   * Helper Methods
   */

  formatSentimentScore(score) {
    if (score >= 0.6) return 'positive'
    if (score >= 0.4) return 'neutral'
    return 'negative'
  }

  getSentimentColor(sentiment) {
    const colors = {
      positive: '#22C55E',
      neutral: '#F59E0B',
      negative: '#EF4444'
    }
    return colors[sentiment] || '#6B7280'
  }

  getSentimentIcon(sentiment) {
    const icons = {
      positive: 'pi-thumbs-up',
      neutral: 'pi-minus',
      negative: 'pi-thumbs-down'
    }
    return icons[sentiment] || 'pi-circle'
  }

  formatNPSScore(score) {
    // NPS ranges from -100 to 100
    if (score >= 50) return { category: 'Excellent', color: '#22C55E' }
    if (score >= 30) return { category: 'Great', color: '#84CC16' }
    if (score >= 0) return { category: 'Good', color: '#F59E0B' }
    if (score >= -30) return { category: 'Needs Improvement', color: '#F97316' }
    return { category: 'Critical', color: '#EF4444' }
  }

  formatCSATScore(score) {
    // CSAT is typically a percentage
    if (score >= 80) return { category: 'Excellent', color: '#22C55E' }
    if (score >= 70) return { category: 'Good', color: '#84CC16' }
    if (score >= 60) return { category: 'Fair', color: '#F59E0B' }
    return { category: 'Poor', color: '#EF4444' }
  }
}

export default new FeedbackService()
