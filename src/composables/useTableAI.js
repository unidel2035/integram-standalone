/**
 * Table AI Composable
 *
 * Composable for AI-powered Table analysis and natural language queries
 */

import { ref } from 'vue'
import * as aiService from '@/services/aiService'
import { useToast } from 'primevue/usetoast'

export function useTableAI() {
  const toast = useToast()

  // State
  const queryResult = ref(null)
  const tableInsights = ref(null)
  const transformationSuggestions = ref(null)
  const executingQuery = ref(false)
  const generatingInsights = ref(false)
  const analyzingTransformations = ref(false)

  /**
   * Execute natural language query on table data
   * @param {string} query - Natural language query
   * @param {Object} tableData - Table data to query
   * @returns {Promise<Object>} Query results
   */
  async function executeNaturalLanguageQuery(query, tableData) {
    if (!query || query.trim() === '') {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Введите запрос',
        life: 3000
      })
      return null
    }

    if (!tableData || !tableData.data || tableData.data.length === 0) {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет данных таблицы для запроса',
        life: 3000
      })
      return null
    }

    executingQuery.value = true
    try {
      const result = await aiService.executeNaturalLanguageQuery(query, tableData)
      queryResult.value = result

      toast.add({
        severity: 'success',
        summary: 'Запрос выполнен',
        detail: 'Результаты готовы',
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Query execution error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось выполнить запрос',
        life: 3000
      })
      return null
    } finally {
      executingQuery.value = false
    }
  }

  /**
   * Generate insights from table data
   * @param {Object} tableData - Table data to analyze
   * @returns {Promise<Object>} Generated insights
   */
  async function generateInsights(tableData) {
    if (!tableData || !tableData.data || tableData.data.length === 0) {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет данных для анализа',
        life: 3000
      })
      return null
    }

    generatingInsights.value = true
    try {
      const result = await aiService.generateTableInsights(tableData)
      tableInsights.value = result

      toast.add({
        severity: 'success',
        summary: 'Анализ завершен',
        detail: `Сгенерировано ${result.insights?.length || 0} инсайтов`,
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Insights generation error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось сгенерировать инсайты',
        life: 3000
      })
      return null
    } finally {
      generatingInsights.value = false
    }
  }

  /**
   * Suggest data transformations
   * @param {Object} tableData - Table data
   * @param {string} goal - Transformation goal
   * @returns {Promise<Object>} Transformation suggestions
   */
  async function suggestTransformations(tableData, goal) {
    if (!tableData || !tableData.data || tableData.data.length === 0) {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет данных для анализа',
        life: 3000
      })
      return null
    }

    if (!goal || goal.trim() === '') {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Укажите цель трансформации',
        life: 3000
      })
      return null
    }

    analyzingTransformations.value = true
    try {
      const result = await aiService.suggestDataTransformations(tableData, goal)
      transformationSuggestions.value = result

      toast.add({
        severity: 'success',
        summary: 'Рекомендации готовы',
        detail: `Предложено ${result.transformations?.length || 0} трансформаций`,
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Transformation suggestion error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось создать рекомендации',
        life: 3000
      })
      return null
    } finally {
      analyzingTransformations.value = false
    }
  }

  /**
   * Clear all results
   */
  function clearResults() {
    queryResult.value = null
    tableInsights.value = null
    transformationSuggestions.value = null
  }

  return {
    // State
    queryResult,
    tableInsights,
    transformationSuggestions,
    executingQuery,
    generatingInsights,
    analyzingTransformations,

    // Methods
    executeNaturalLanguageQuery,
    generateInsights,
    suggestTransformations,
    clearResults
  }
}
