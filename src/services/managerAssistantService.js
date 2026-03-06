/**
 * Manager Assistant Service
 *
 * Service for the Manager Assistant Agent that communicates with Integram
 * via MCP (Model Context Protocol) server to analyze financial models and
 * investment metrics.
 *
 * Issue #3548 - Manager Assistant Agent
 */

import { getApiUrl } from '../utils/apiConfig'

const MCP_BASE_URL = getApiUrl('/api/mcp/integram')

/**
 * Chat with Integram MCP server
 *
 * @param {string} message - User message/question
 * @param {Object} config - Integram connection config
 * @param {Array} conversationHistory - Previous conversation messages
 * @returns {Promise<Object>} Response with AI-generated answer and optional chart/table data
 */
export async function chatWithIntegram(message, config, conversationHistory = []) {
  try {
    const response = await fetch(`${MCP_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        serverURL: config.serverURL,
        database: config.database,
        login: config.login,
        password: config.password,
        conversationHistory: conversationHistory,
        systemPrompt: buildSystemPrompt()
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Failed to get response from Integram')
    }

    return {
      success: true,
      response: data.response,
      conversationHistory: data.conversationHistory || [],
      token: data.token,
      xsrfToken: data.xsrfToken,
      data: extractStructuredData(data.response)
    }
  } catch (error) {
    console.error('Chat with Integram error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Execute a specific Integram MCP tool
 *
 * @param {string} toolName - Name of the MCP tool to execute
 * @param {Object} toolArgs - Tool arguments
 * @param {Object} config - Integram connection config
 * @returns {Promise<Object>} Tool execution result
 */
export async function executeIntegramTool(toolName, toolArgs, config) {
  try {
    // First authenticate if needed
    let authResult = null
    if (toolName !== 'integram_authenticate') {
      authResult = await authenticate(config)
      if (!authResult.success) {
        throw new Error('Authentication failed')
      }
    }

    const response = await fetch(`${MCP_BASE_URL}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        toolName: toolName,
        args: {
          ...toolArgs,
          ...(authResult ? {
            serverURL: config.serverURL,
            database: config.database
          } : {})
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Tool execution failed')
    }

    return {
      success: true,
      result: data.result
    }
  } catch (error) {
    console.error(`Execute tool ${toolName} error:`, error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Authenticate with Integram
 *
 * @param {Object} config - Connection config
 * @returns {Promise<Object>} Authentication result with tokens
 */
async function authenticate(config) {
  try {
    const result = await executeIntegramTool('integram_authenticate', {
      serverURL: config.serverURL,
      database: config.database,
      login: config.login,
      password: config.password
    }, config)

    if (result.success && result.result && result.result.content) {
      const content = result.result.content[0]?.text
      if (content) {
        const authData = JSON.parse(content)
        return {
          success: true,
          token: authData.token,
          xsrfToken: authData.xsrf,
          userId: authData.userId
        }
      }
    }

    return {
      success: false,
      error: 'Invalid authentication response'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Get dictionary of types from Integram
 *
 * @param {Object} config - Connection config
 * @returns {Promise<Object>} Dictionary with types list
 */
export async function getIntegramDictionary(config) {
  return executeIntegramTool('integram_get_dictionary', {}, config)
}

/**
 * Get type metadata
 *
 * @param {number} typeId - Type ID
 * @param {Object} config - Connection config
 * @returns {Promise<Object>} Type metadata with requisites
 */
export async function getIntegramTypeMetadata(typeId, config) {
  return executeIntegramTool('integram_get_type_metadata', { typeId }, config)
}

/**
 * Get object list for a type
 *
 * @param {number} typeId - Type ID
 * @param {Object} params - Query parameters
 * @param {Object} config - Connection config
 * @returns {Promise<Object>} List of objects
 */
export async function getIntegramObjectList(typeId, params, config) {
  return executeIntegramTool('integram_get_object_list', {
    typeId,
    params: params || {}
  }, config)
}

/**
 * Execute a report
 *
 * @param {number} reportId - Report ID
 * @param {Object} params - Report parameters
 * @param {Object} config - Connection config
 * @returns {Promise<Object>} Report results
 */
export async function executeIntegramReport(reportId, params, config) {
  return executeIntegramTool('integram_execute_report', {
    reportId,
    params: params || {}
  }, config)
}

/**
 * Build system prompt for the manager assistant
 *
 * @returns {string} System prompt
 */
function buildSystemPrompt() {
  return `Ты — ассистент руководителя, специализирующийся на анализе финансовых моделей и инвестиционных показателей.

Твои задачи:
1. Анализировать финансовые данные из базы Integram (https://app.integram.io/positrack)
2. Сравнивать плановые и фактические показатели
3. Выявлять отклонения от инвестиционных планов
4. Предоставлять рекомендации по корректировке стратегии
5. Визуализировать данные в виде графиков и таблиц

Доступные инструменты MCP Integram:
- integram_get_dictionary - получить список всех типов (таблиц)
- integram_get_type_metadata - получить структуру типа
- integram_get_object_list - получить список объектов
- integram_execute_report - выполнить отчет
- И другие для работы с данными

Когда пользователь задает вопрос:
1. Определи, какие данные нужны для ответа
2. Используй соответствующие инструменты Integram для получения данных
3. Проанализируй полученные данные
4. Предоставь ясный, структурированный ответ
5. Если возможно, предложи визуализацию (график или таблицу)

Формат ответа:
- Краткое резюме ситуации
- Ключевые показатели
- Выявленные отклонения (если есть)
- Рекомендации (если применимо)
- [CHART_DATA] или [TABLE_DATA] для визуализации (если нужно)

Отвечай на русском языке. Будь конкретным и ориентированным на действия.`
}

/**
 * Extract structured data (charts, tables) from AI response
 *
 * @param {string} response - AI response text
 * @returns {Object} Extracted structured data
 */
function extractStructuredData(response) {
  const data = {}

  // Check for chart data markers
  const chartMatch = response.match(/\[CHART_DATA\](.*?)\[\/CHART_DATA\]/s)
  if (chartMatch) {
    try {
      data.chartData = JSON.parse(chartMatch[1])
    } catch (e) {
      console.warn('Failed to parse chart data:', e)
    }
  }

  // Check for table data markers
  const tableMatch = response.match(/\[TABLE_DATA\](.*?)\[\/TABLE_DATA\]/s)
  if (tableMatch) {
    try {
      data.tableData = JSON.parse(tableMatch[1])
    } catch (e) {
      console.warn('Failed to parse table data:', e)
    }
  }

  return data
}

/**
 * Generate chart data from financial metrics
 *
 * @param {Array} metrics - Array of financial metrics
 * @param {string} chartType - Chart type (line, bar, pie, etc.)
 * @returns {Object} Chart.js compatible data structure
 */
export function generateChartData(metrics, chartType = 'line') {
  if (!metrics || metrics.length === 0) {
    return null
  }

  // Extract labels and values
  const labels = metrics.map(m => m.label || m.name || m.period)
  const values = metrics.map(m => m.value || m.amount || 0)

  if (chartType === 'pie') {
    return {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
            '#FF9F40'
          ]
        }]
      }
    }
  } else if (chartType === 'bar') {
    return {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Значение',
          data: values,
          backgroundColor: '#36A2EB'
        }]
      }
    }
  } else {
    // Default: line chart
    return {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Динамика',
          data: values,
          borderColor: '#36A2EB',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          fill: true,
          tension: 0.4
        }]
      }
    }
  }
}

/**
 * Generate table data from array of objects
 *
 * @param {Array} items - Array of items
 * @param {Array} columns - Column definitions
 * @returns {Object} Table data structure
 */
export function generateTableData(items, columns) {
  if (!items || items.length === 0) {
    return null
  }

  return {
    columns: columns || Object.keys(items[0]).map(key => ({
      field: key,
      header: key.charAt(0).toUpperCase() + key.slice(1)
    })),
    data: items
  }
}

/**
 * Analyze financial deviations
 *
 * @param {Array} planFactData - Array with plan and fact values
 * @returns {Object} Deviation analysis
 */
export function analyzeDeviations(planFactData) {
  if (!planFactData || planFactData.length === 0) {
    return {
      hasDeviations: false,
      significantDeviations: [],
      summary: 'Недостаточно данных для анализа'
    }
  }

  const significantDeviations = []
  const threshold = 0.1 // 10% deviation threshold

  planFactData.forEach(item => {
    const plan = item.plan || 0
    const fact = item.fact || 0

    if (plan === 0) return

    const deviation = (fact - plan) / plan
    const deviationPercent = deviation * 100

    if (Math.abs(deviation) > threshold) {
      significantDeviations.push({
        item: item.name || item.label,
        plan: plan,
        fact: fact,
        deviation: deviationPercent.toFixed(1),
        status: deviation > 0 ? 'превышение' : 'недовыполнение'
      })
    }
  })

  return {
    hasDeviations: significantDeviations.length > 0,
    significantDeviations: significantDeviations,
    summary: significantDeviations.length > 0
      ? `Обнаружено ${significantDeviations.length} значительных отклонений от плана`
      : 'Все показатели в пределах нормы'
  }
}
