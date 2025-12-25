/**
 * AI Provider Service
 * 
 * Централизованный сервис для работы с различными AI провайдерами
 * Поддерживает: polza.ai, deepseek, openai, anthropic и другие
 */

import polzaService from './polzaService.js'
import logger from '../../utils/logger.js'
import ddadminService from '../ddadmin/ddadminService.js'

class AIProviderService {
  constructor() {
    this.providers = {
      polza: polzaService
      // Здесь можно добавить другие провайдеры:
      // deepseek: deepseekService,
      // openai: openaiService,
      // anthropic: anthropicService
    }

    this.defaultProvider = 'polza'
  }

  /**
   * Получить все доступные провайдеры
   */
  getAvailableProviders() {
    return Object.keys(this.providers).map(providerKey => {
      const provider = this.providers[providerKey]
      return {
        key: providerKey,
        name: provider.getProviderInfo?.()?.displayName || providerKey,
        ...provider.getProviderInfo?.()
      }
    })
  }

  /**
   * Получить все доступные модели
   */
  getAllModels() {
    const allModels = []
    
    for (const [providerKey, provider] of Object.entries(this.providers)) {
      if (provider.getAvailableModels) {
        const models = provider.getAvailableModels().map(model => ({
          ...model,
          provider: providerKey,
          providerName: provider.getProviderInfo?.()?.displayName || providerKey
        }))
        allModels.push(...models)
      }
    }
    
    return allModels
  }

  /**
   * Получить модели по провайдеру
   */
  getModelsByProvider(providerKey) {
    const provider = this.providers[providerKey]
    if (!provider) {
      throw new Error(`Provider ${providerKey} not found`)
    }
    
    return provider.getAvailableModels().map(model => ({
      ...model,
      provider: providerKey,
      providerName: provider.getProviderInfo?.()?.displayName || providerKey
    }))
  }

  /**
   * Выполнить AI операцию
   */
  async performAIOperation(operation) {
    const { provider = this.defaultProvider, model, messages, prompt, options = {}, tokenId, userId } = operation

    try {
      const aiProvider = this.providers[provider]
      if (!aiProvider) {
        throw new Error(`Provider ${provider} not found`)
      }

      logger.info('Performing AI operation', {
        provider,
        model,
        tokenId,
        userId
      })

      let result
      let usage = { totalTokens: 0, promptTokens: 0, completionTokens: 0 }

      // Выполняем операцию в зависимости от типа
      if (messages && Array.isArray(messages)) {
        // Chat completion
        result = await aiProvider.createChatCompletion(model, messages, options)
      } else if (prompt) {
        // Text completion
        result = await aiProvider.createCompletion(prompt, model, options)
      } else {
        throw new Error('Either messages or prompt must be provided')
      }

      if (!result.success) {
        throw new Error(result.error)
      }

      // Извлекаем usage информацию
      usage = result.data.usage || usage

      // Записываем использование в базу данных
      await this.recordUsage({
        tokenId,
        userId,
        provider,
        model,
        operation: operation.operation || 'chat',
        prompt: prompt || JSON.stringify(messages),
        response: result.data.choices?.[0]?.message?.content || result.data.text || '',
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        cost: this.calculateCost(usage, model),
        application: operation.application || 'orchestrator',
        timestamp: new Date().toISOString()
      })

      logger.info('AI operation completed', {
        provider,
        model,
        totalTokens: usage.total_tokens,
        tokenId
      })

      return {
        success: true,
        data: result.data,
        usage: usage,
        provider: provider,
        model: model
      }

    } catch (error) {
      logger.error('AI operation failed', {
        provider,
        model,
        error: error.message,
        tokenId
      })

      return {
        success: false,
        error: error.message || 'AI operation failed'
      }
    }
  }

  /**
   * Записать использование в базу данных ddadmin
   */
  async recordUsage(usageData) {
    try {
      // Проверяем, аутентифицированы ли мы с ddadmin
      if (!ddadminService.isAuthenticated()) {
        logger.warn('DDAdmin not authenticated, skipping usage recording')
        return { success: false, error: 'DDAdmin not authenticated' }
      }

      return await ddadminService.recordTokenUsage(usageData)
    } catch (error) {
      logger.error('Failed to record usage', { error: error.message })
      return { success: false, error: error.message }
    }
  }

  /**
   * Рассчитать стоимость операции
   */
  calculateCost(usage, model) {
    // Примерная стоимость за 1K токенов для разных моделей
    const costPer1kTokens = {
      'openai/gpt-4o': 0.005,
      'openai/gpt-4o-mini': 0.00015,
      'openai/gpt-4-turbo': 0.01,
      'openai/gpt-3.5-turbo': 0.0015,
      'anthropic/claude-3-5-sonnet-20241022': 0.003,
      'anthropic/claude-3-5-haiku-20241022': 0.00025,
      'google/gemini-1-5-pro': 0.0035,
      'google/gemini-1-5-flash': 0.00035,
      'deepseek/deepseek-chat': 0.00014,
      'deepseek/deepseek-coder': 0.00014
    }

    const rate = costPer1kTokens[model] || 0.001 // Default rate
    const totalTokens = usage.total_tokens || 0
    
    return (totalTokens / 1000) * rate
  }

  /**
   * Проверить доступность всех провайдеров
   */
  async healthCheck() {
    const results = {}

    for (const [providerKey, provider] of Object.entries(this.providers)) {
      try {
        if (provider.healthCheck) {
          results[providerKey] = await provider.healthCheck()
        } else {
          results[providerKey] = { healthy: true, message: 'No health check available' }
        }
      } catch (error) {
        results[providerKey] = {
          healthy: false,
          error: error.message
        }
      }
    }

    return results
  }

  /**
   * Аутентификация с DDAdmin
   */
  async authenticateDDAdmin(username, password) {
    try {
      return await ddadminService.authenticate(username, password)
    } catch (error) {
      logger.error('DDAdmin authentication failed', { error: error.message })
      throw error
    }
  }

  /**
   * Получить информацию о провайдере
   */
  getProviderInfo(providerKey) {
    const provider = this.providers[providerKey]
    if (!provider) {
      throw new Error(`Provider ${providerKey} not found`)
    }

    return provider.getProviderInfo()
  }
}

// Экспортируем singleton instance
export default new AIProviderService()