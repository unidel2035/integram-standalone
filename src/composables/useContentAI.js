/**
 * Content AI Composable
 *
 * Composable for AI-powered content generation and improvement (Echo Editor)
 */

import { ref } from 'vue'
import * as aiService from '@/services/aiService'
import { useToast } from 'primevue/usetoast'

export function useContentAI() {
  const toast = useToast()

  // State
  const generatedContent = ref(null)
  const improvedContent = ref(null)
  const summarizedContent = ref(null)
  const translatedContent = ref(null)
  const expandedContent = ref(null)
  const generatingContent = ref(false)
  const improvingContent = ref(false)
  const summarizingContent = ref(false)
  const translatingContent = ref(false)
  const expandingContent = ref(false)

  /**
   * Generate content based on prompt
   * @param {string} prompt - Content generation prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated content
   */
  async function generateContent(prompt, options = {}) {
    if (!prompt || prompt.trim() === '') {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Введите запрос для генерации контента',
        life: 3000
      })
      return null
    }

    generatingContent.value = true
    try {
      const result = await aiService.generateContent(prompt, options)
      generatedContent.value = result

      toast.add({
        severity: 'success',
        summary: 'Контент создан',
        detail: 'Контент успешно сгенерирован',
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Content generation error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось создать контент',
        life: 3000
      })
      return null
    } finally {
      generatingContent.value = false
    }
  }

  /**
   * Improve existing content
   * @param {string} content - Content to improve
   * @param {Array<string>} improvements - Types of improvements
   * @returns {Promise<Object>} Improved content
   */
  async function improveContent(content, improvements = ['clarity', 'grammar']) {
    if (!content || content.trim() === '') {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет контента для улучшения',
        life: 3000
      })
      return null
    }

    improvingContent.value = true
    try {
      const result = await aiService.improveContent(content, improvements)
      improvedContent.value = result

      toast.add({
        severity: 'success',
        summary: 'Контент улучшен',
        detail: 'Улучшения применены',
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Content improvement error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось улучшить контент',
        life: 3000
      })
      return null
    } finally {
      improvingContent.value = false
    }
  }

  /**
   * Summarize content
   * @param {string} content - Content to summarize
   * @param {string} length - Summary length
   * @returns {Promise<Object>} Summarized content
   */
  async function summarizeContent(content, length = 'medium') {
    if (!content || content.trim() === '') {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет контента для сокращения',
        life: 3000
      })
      return null
    }

    summarizingContent.value = true
    try {
      const result = await aiService.summarizeContent(content, length)
      summarizedContent.value = result

      toast.add({
        severity: 'success',
        summary: 'Резюме готово',
        detail: 'Контент успешно сокращен',
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Content summarization error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось создать резюме',
        life: 3000
      })
      return null
    } finally {
      summarizingContent.value = false
    }
  }

  /**
   * Translate content
   * @param {string} content - Content to translate
   * @param {string} targetLanguage - Target language code
   * @returns {Promise<Object>} Translated content
   */
  async function translateContent(content, targetLanguage) {
    if (!content || content.trim() === '') {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет контента для перевода',
        life: 3000
      })
      return null
    }

    if (!targetLanguage) {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Выберите язык перевода',
        life: 3000
      })
      return null
    }

    translatingContent.value = true
    try {
      const result = await aiService.translateContent(content, targetLanguage)
      translatedContent.value = result

      toast.add({
        severity: 'success',
        summary: 'Перевод готов',
        detail: `Контент переведен на ${targetLanguage}`,
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Content translation error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось перевести контент',
        life: 3000
      })
      return null
    } finally {
      translatingContent.value = false
    }
  }

  /**
   * Expand content with additional details
   * @param {string} content - Content to expand
   * @param {string} direction - Expansion direction
   * @returns {Promise<Object>} Expanded content
   */
  async function expandContent(content, direction = 'broader') {
    if (!content || content.trim() === '') {
      toast.add({
        severity: 'warn',
        summary: 'Предупреждение',
        detail: 'Нет контента для расширения',
        life: 3000
      })
      return null
    }

    expandingContent.value = true
    try {
      const result = await aiService.expandContent(content, direction)
      expandedContent.value = result

      toast.add({
        severity: 'success',
        summary: 'Контент расширен',
        detail: 'Добавлены дополнительные детали',
        life: 3000
      })

      return result
    } catch (error) {
      console.error('Content expansion error:', error)
      toast.add({
        severity: 'error',
        summary: 'Ошибка',
        detail: error.message || 'Не удалось расширить контент',
        life: 3000
      })
      return null
    } finally {
      expandingContent.value = false
    }
  }

  /**
   * Clear all generated content
   */
  function clearGeneratedContent() {
    generatedContent.value = null
    improvedContent.value = null
    summarizedContent.value = null
    translatedContent.value = null
    expandedContent.value = null
  }

  return {
    // State
    generatedContent,
    improvedContent,
    summarizedContent,
    translatedContent,
    expandedContent,
    generatingContent,
    improvingContent,
    summarizingContent,
    translatingContent,
    expandingContent,

    // Methods
    generateContent,
    improveContent,
    summarizeContent,
    translateContent,
    expandContent,
    clearGeneratedContent
  }
}
