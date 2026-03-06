/**
 * Workflow AI Composable
 *
 * Composable for AI-powered Workflow generation and optimization
 */

import { ref } from 'vue'
import * as aiService from '@/services/aiService'
import { useToast } from 'primevue/usetoast'

export function useWorkflowAI() {
  const toast = useToast()

  // State
  const generatedWorkflow = ref(null)
  const optimizedWorkflow = ref(null)
  const automationSuggestions = ref(null)
  const generatingWorkflow = ref(false)
  const optimizingWorkflow = ref(false)
  const analyzingAutomation = ref(false)

  /**
   * Generate workflow from description
   * @param {string} description - Workflow description
   * @returns {Promise<Object>} Generated workflow
   */
  async function generateWorkflow(description) {
    if (!description || description.trim() === '') {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Введите описание workflow',
        life: 3000
      })
      return null
    }

    generatingWorkflow.value = true
    try {
      const result = await aiService.generateWorkflow(description)
      generatedWorkflow.value = result

      toast.add({
        severity: 'success',
        summary: 'Workflow создан',
        detail: 'Workflow успешно сгенерирован',
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Workflow generation error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось создать workflow',
        life: 3000
      })
      return null
    } finally {
      generatingWorkflow.value = false
    }
  }

  /**
   * Optimize existing workflow
   * @param {Object} workflowData - Current workflow configuration
   * @returns {Promise<Object>} Optimized workflow
   */
  async function optimizeWorkflow(workflowData) {
    if (!workflowData) {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет данных workflow для оптимизации',
        life: 3000
      })
      return null
    }

    optimizingWorkflow.value = true
    try {
      const result = await aiService.optimizeWorkflow(workflowData)
      optimizedWorkflow.value = result

      toast.add({
        severity: 'success',
        summary: 'Оптимизация завершена',
        detail: 'Workflow успешно оптимизирован',
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Workflow optimization error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось оптимизировать workflow',
        life: 3000
      })
      return null
    } finally {
      optimizingWorkflow.value = false
    }
  }

  /**
   * Suggest automation opportunities
   * @param {Array<Object>} processes - Current manual processes
   * @returns {Promise<Object>} Automation suggestions
   */
  async function suggestAutomation(processes) {
    if (!processes || processes.length === 0) {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет процессов для анализа',
        life: 3000
      })
      return null
    }

    analyzingAutomation.value = true
    try {
      const result = await aiService.suggestWorkflowAutomation(processes)
      automationSuggestions.value = result

      toast.add({
        severity: 'success',
        summary: 'Анализ завершен',
        detail: `Найдено ${result.suggestions?.length || 0} возможностей для автоматизации`,
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Automation analysis error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось проанализировать процессы',
        life: 3000
      })
      return null
    } finally {
      analyzingAutomation.value = false
    }
  }

  /**
   * Clear all generated data
   */
  function clearGeneratedData() {
    generatedWorkflow.value = null
    optimizedWorkflow.value = null
    automationSuggestions.value = null
  }

  return {
    // State
    generatedWorkflow,
    optimizedWorkflow,
    automationSuggestions,
    generatingWorkflow,
    optimizingWorkflow,
    analyzingAutomation,

    // Methods
    generateWorkflow,
    optimizeWorkflow,
    suggestAutomation,
    clearGeneratedData
  }
}
