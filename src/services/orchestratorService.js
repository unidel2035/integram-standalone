/**
 * Orchestrator Service - Frontend API для MultiAgentOrchestrator
 *
 * Предоставляет методы для выполнения запросов через мульти-агентный оркестратор.
 * Оркестратор автоматически:
 * 1. Планирует, какие агенты нужны для выполнения запроса
 * 2. Выполняет агентов последовательно или параллельно
 * 3. Синтезирует результаты в финальный ответ
 *
 * Issue #5632 - Unified agent orchestration
 *
 * @example
 * import { executeQuery } from '@/services/orchestratorService'
 *
 * const result = await executeQuery('Проверь компанию ИНН 7707083893', {
 *   accessToken: 'dd_tok_xxx',
 *   userId: 'user123'
 * })
 *
 * console.log(result.answer) // Финальный ответ
 * console.log(result.sources) // Использованные агенты
 * console.log(result.data) // Данные от всех агентов
 */

import axios from 'axios'
import { getBaseApiUrl } from '@/utils/apiConfig'

const API_BASE_URL = import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== 'auto'
  ? import.meta.env.VITE_API_URL
  : getBaseApiUrl()

/**
 * Выполнить запрос через MultiAgentOrchestrator
 *
 * @param {string} query - Пользовательский запрос
 * @param {Object} options - Опции выполнения
 * @param {string} options.accessToken - AI токен для LLM вызовов
 * @param {string} options.userId - ID пользователя для трекинга
 * @param {boolean} options.includeTrace - Включить execution trace в ответ
 * @param {Object} options.metadata - Дополнительные метаданные
 * @returns {Promise<Object>} Результат выполнения
 *
 * @example
 * const result = await executeQuery('Какой курс доллара?', {
 *   accessToken: 'dd_tok_xxx'
 * })
 *
 * // result = {
 * //   success: true,
 * //   query: 'Какой курс доллара?',
 * //   answer: 'Курс доллара США: 95.50 руб...',
 * //   data: { cbr: { rate: 95.50, currency: 'USD', date: '2026-01-05' } },
 * //   sources: ['cbr'],
 * //   steps: 1,
 * //   executionTime: 1234
 * // }
 */
export async function executeQuery(query, options = {}) {
  try {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Query is required and must be a non-empty string')
    }

    console.log('[OrchestratorService] Executing query:', query.substring(0, 100))

    const response = await axios.post(`${API_BASE_URL}/orchestrator/execute`, {
      query,
      options
    })

    console.log('[OrchestratorService] Query executed successfully:', {
      success: response.data.success,
      steps: response.data.steps,
      sources: response.data.sources?.length || 0,
      executionTime: response.data.executionTime
    })

    return response.data
  } catch (error) {
    console.error('[OrchestratorService] executeQuery error:', error)

    // Return error in consistent format
    return {
      success: false,
      query,
      error: error.response?.data?.error || error.message,
      executionTime: 0
    }
  }
}

/**
 * Получить статус оркестратора
 *
 * @returns {Promise<Object>} Статус оркестратора
 */
export async function getOrchestratorStatus() {
  try {
    const response = await axios.get(`${API_BASE_URL}/orchestrator/status`)
    return response.data
  } catch (error) {
    console.error('[OrchestratorService] getOrchestratorStatus error:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message
    }
  }
}

/**
 * Получить dependency graph агентов
 *
 * @returns {Promise<Object>} Dependency graph
 */
export async function getDependencyGraph() {
  try {
    const response = await axios.get(`${API_BASE_URL}/orchestrator/dependency-graph`)
    return response.data
  } catch (error) {
    console.error('[OrchestratorService] getDependencyGraph error:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message
    }
  }
}

/**
 * Запустить оркестратор
 *
 * @returns {Promise<Object>} Результат запуска
 */
export async function startOrchestrator() {
  try {
    const response = await axios.post(`${API_BASE_URL}/orchestrator/start`)
    return response.data
  } catch (error) {
    console.error('[OrchestratorService] startOrchestrator error:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message
    }
  }
}

/**
 * Остановить оркестратор
 *
 * @returns {Promise<Object>} Результат остановки
 */
export async function stopOrchestrator() {
  try {
    const response = await axios.post(`${API_BASE_URL}/orchestrator/stop`)
    return response.data
  } catch (error) {
    console.error('[OrchestratorService] stopOrchestrator error:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message
    }
  }
}

/**
 * Перезапустить оркестратор
 *
 * @returns {Promise<Object>} Результат перезапуска
 */
export async function restartOrchestrator() {
  try {
    const response = await axios.post(`${API_BASE_URL}/orchestrator/restart`)
    return response.data
  } catch (error) {
    console.error('[OrchestratorService] restartOrchestrator error:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message
    }
  }
}

export default {
  executeQuery,
  getOrchestratorStatus,
  getDependencyGraph,
  startOrchestrator,
  stopOrchestrator,
  restartOrchestrator
}
