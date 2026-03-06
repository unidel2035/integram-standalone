/**
 * Agent AI Composable
 *
 * Composable for AI-powered Agent creation and management
 */

import { ref } from 'vue'
import * as aiService from '@/services/aiService'
import { useToast } from 'primevue/usetoast'

export function useAgentAI() {
  const toast = useToast()

  // State
  const generatedAgent = ref(null)
  const agentImprovements = ref(null)
  const generatingAgent = ref(false)
  const analyzingAgent = ref(false)

  /**
   * Generate AI agent from description
   * @param {string} description - Natural language description of desired agent
   * @returns {Promise<Object>} Generated agent specification
   */
  async function generateAgent(description) {
    if (!description || description.trim() === '') {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Введите описание агента',
        life: 3000
      })
      return null
    }

    generatingAgent.value = true
    try {
      const result = await aiService.createAgentFromDescription(description)
      generatedAgent.value = result

      toast.add({
        severity: 'success',
        summary: 'Агент создан',
        detail: 'AI агент успешно сгенерирован',
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Agent generation error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось создать агента',
        life: 3000
      })
      return null
    } finally {
      generatingAgent.value = false
    }
  }

  /**
   * Generate agent configuration from requirements
   * @param {Object} requirements - Agent requirements
   * @returns {Promise<Object>} Agent configuration
   */
  async function generateAgentConfig(requirements) {
    if (!requirements) {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Укажите требования к агенту',
        life: 3000
      })
      return null
    }

    generatingAgent.value = true
    try {
      const result = await aiService.generateAgentConfig(requirements)
      generatedAgent.value = result

      toast.add({
        severity: 'success',
        summary: 'Конфигурация готова',
        detail: 'Конфигурация агента сгенерирована',
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Config generation error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось создать конфигурацию',
        life: 3000
      })
      return null
    } finally {
      generatingAgent.value = false
    }
  }

  /**
   * Suggest improvements for existing agent
   * @param {Object} agentData - Current agent data with performance metrics
   * @returns {Promise<Object>} Improvement suggestions
   */
  async function suggestImprovements(agentData) {
    if (!agentData) {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет данных агента для анализа',
        life: 3000
      })
      return null
    }

    analyzingAgent.value = true
    try {
      const result = await aiService.suggestAgentImprovements(agentData)
      agentImprovements.value = result

      toast.add({
        severity: 'success',
        summary: 'Анализ завершен',
        detail: 'Рекомендации по улучшению готовы',
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Improvement analysis error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось проанализировать агента',
        life: 3000
      })
      return null
    } finally {
      analyzingAgent.value = false
    }
  }

  /**
   * Clear all generated data
   */
  function clearGeneratedData() {
    generatedAgent.value = null
    agentImprovements.value = null
  }

  return {
    // State
    generatedAgent,
    agentImprovements,
    generatingAgent,
    analyzingAgent,

    // Methods
    generateAgent,
    generateAgentConfig,
    suggestImprovements,
    clearGeneratedData
  }
}
