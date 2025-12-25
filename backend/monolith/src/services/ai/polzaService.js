/**
 * Polza AI Service
 * 
 * Сервис для работы с агрегатором моделей ИИ polza.ai
 * Использует OpenAI-совместимый API для унификации интерфейса
 * 
 * Документация: https://docs.polza.ai/docs
 * Base URL: https://api.polza.ai/api/v1
 */

import OpenAI from 'openai'
import logger from '../../utils/logger.js'

class PolzaService {
  constructor() {
    this.client = new OpenAI({
      baseURL: 'https://api.polza.ai/api/v1',
      apiKey: process.env.POLZA_AI_API_KEY || 'ak_0xCOU-hEsCsImB6r-dg7GChm2LFPQOUL9ROwExY8WBo'
    })
    
    this.availableModels = [
      // Модель по умолчанию - Claude Sonnet 4.5
      { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'polza', context_length: 200000 },

      // Проверенные рабочие модели в Polza.ai
      { id: 'openai/gpt-5.1', name: 'GPT-5.1', provider: 'polza', context_length: 128000 },
      { id: 'openai/gpt-5.1-chat', name: 'GPT-5.1 Chat', provider: 'polza', context_length: 128000 },
      { id: 'openai/gpt-5.1-codex', name: 'GPT-5.1 Codex', provider: 'polza', context_length: 128000 },
      { id: 'openai/gpt-5.1-codex-mini', name: 'GPT-5.1 Codex Mini', provider: 'polza', context_length: 128000 },
      { id: 'amazon/nova-premier-v1', name: 'Nova Premier V1', provider: 'polza', context_length: 200000 },

      // Дополнительные модели из списка
      { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', provider: 'polza', context_length: 1000000 },
      { id: 'moonshotai/kimi-k2-thinking', name: 'Kimi K2 Thinking', provider: 'polza', context_length: 131072 },
      { id: 'openrouter/sherlock-dash-alpha', name: 'Sherlock Dash Alpha', provider: 'polza', context_length: 131072 },
      { id: 'openrouter/sherlock-think-alpha', name: 'Sherlock Think Alpha', provider: 'polza', context_length: 131072 }
    ]
  }

  /**
   * Получить список доступных моделей
   */
  getAvailableModels() {
    return this.availableModels
  }

  /**
   * Получить модель по ID
   */
  getModelById(modelId) {
    return this.availableModels.find(model => model.id === modelId)
  }

  /**
   * Создать чат-комплишн
   */
  async createChatCompletion(model, messages, options = {}) {
    try {
      // Log exact request payload being sent to polza.io
      const requestPayload = {
        model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
        stream: false
      }

      // Add tools if provided (Polza API handles conversion for different providers)
      if (options.tools && options.tools.length > 0) {
        requestPayload.tools = options.tools
        logger.info('🔧 Tools added to Polza API request:', {
          toolsCount: options.tools.length,
          toolNames: options.tools.map(t => t.function?.name || t.name)
        })
      }

      logger.info('🔍 Polza.io API Request Details (non-streaming):', {
        url: this.client.baseURL,
        model: requestPayload.model,
        messageCount: messages.length,
        temperature: requestPayload.temperature,
        max_tokens: requestPayload.max_tokens,
        fullPayload: JSON.stringify(requestPayload, null, 2)
      })

      const response = await this.client.chat.completions.create(requestPayload)

      // Issue: Log model mismatch between request and response
      if (response.model && response.model !== model) {
        logger.warn('⚠️ MODEL MISMATCH:', {
          requested: model,
          actuallyUsed: response.model,
          note: 'Polza.io used different model than requested'
        })
      }

      // Извлекаем информацию об использовании токенов
      const usage = response.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }

      logger.info('Chat completion created', {
        model,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      })

      return {
        success: true,
        data: {
          choices: response.choices,
          usage: usage,
          model: response.model,
          created: response.created
        }
      }
    } catch (error) {
      logger.error('Polza chat completion failed', {
        model,
        error: error.message
      })

      return {
        success: false,
        error: error.message || 'Polza API error'
      }
    }
  }

  /**
   * Создать чат-комплишн с потоковой передачей (streaming)
   */
  async createChatCompletionStream(model, messages, options = {}) {
    try {
      // Log exact request payload being sent to polza.io
      const requestPayload = {
        model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens,
        top_p: options.topP || 1,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
        stream: true,
        stream_options: { include_usage: true }
      }

      logger.info('🔍 Polza.io API Request Details:', {
        url: this.client.baseURL,
        model: requestPayload.model,
        messageCount: messages.length,
        temperature: requestPayload.temperature,
        max_tokens: requestPayload.max_tokens,
        fullPayload: JSON.stringify(requestPayload, null, 2)
      })

      const stream = await this.client.chat.completions.create(requestPayload)

      return {
        success: true,
        stream: stream,
        requestedModel: model // Track requested model for mismatch detection
      }
    } catch (error) {
      logger.error('Polza streaming chat completion failed', {
        model,
        error: error.message
      })

      return {
        success: false,
        error: error.message || 'Polza API streaming error'
      }
    }
  }

  /**
   * Создать комплишн с текстом (для совместимости)
   */
  async createCompletion(prompt, model, options = {}) {
    try {
      logger.info('Creating text completion', { model, promptLength: prompt.length })

      const response = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens,
        top_p: options.topP || 1
      })

      const usage = response.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }

      logger.info('Text completion created', {
        model,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens
      })

      return {
        success: true,
        data: {
          text: response.choices[0].message.content,
          usage: usage,
          model: response.model
        }
      }
    } catch (error) {
      logger.error('Polza text completion failed', {
        model,
        error: error.message
      })

      return {
        success: false,
        error: error.message || 'Polza API error'
      }
    }
  }

  /**
   * Упрощенный метод chat для совместимости с кодом в ai-tokens.js
   * Оборачивает createChatCompletion и возвращает нужный формат
   */
  async chat(params) {
    const { model, messages, temperature, maxTokens, stream } = params

    if (stream) {
      const result = await this.createChatCompletionStream(model, messages, {
        temperature,
        maxTokens
      })
      return result
    } else {
      const result = await this.createChatCompletion(model, messages, {
        temperature,
        maxTokens
      })

      if (!result.success) {
        throw new Error(result.error || 'Polza chat failed')
      }

      // Преобразуем в формат, ожидаемый фронтендом
      const response = result.data.choices[0]?.message?.content || ''

      return {
        response, // Текст ответа
        usage: result.data.usage,
        model: result.data.model,
        created: result.data.created,
        choices: result.data.choices
      }
    }
  }

  /**
   * Проверить доступность сервиса
   */
  async healthCheck() {
    try {
      const response = await this.createChatCompletion(
        'anthropic/claude-sonnet-4.5',
        [{ role: 'user', content: 'Hi' }],
        { maxTokens: 5 }
      )

      return {
        healthy: response.success,
        latency: Date.now(),
        error: response.error
      }
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now(),
        error: error.message
      }
    }
  }

  /**
   * Получить информацию о провайдере
   */
  getProviderInfo() {
    return {
      name: 'polza.ai',
      displayName: 'Polza AI',
      description: 'Агрегатор моделей ИИ с единым API',
      website: 'https://polza.ai',
      documentation: 'https://docs.polza.ai/docs',
      models: this.availableModels.length,
      supportedFeatures: ['chat', 'completion', 'streaming'],
      rateLimits: {
        requestsPerMinute: 100,
        tokensPerMinute: 10000
      }
    }
  }
}

// Экспортируем singleton instance
export default new PolzaService()