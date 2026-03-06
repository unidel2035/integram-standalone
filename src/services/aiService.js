/**
 * AI Service
 *
 * Unified AI service for all AI-powered features across the application
 * Supports multiple AI providers (OpenAI, Anthropic, etc.) and various use cases
 * Issue #1529 - Updated to use token-based orchestrator authentication
 */

import { getDefaultToken, getCurrentUserId } from './aiTokenService'
import { getApiUrl } from '../utils/apiConfig'

const API_BASE_URL = getApiUrl('/api')

/**
 * Get auth token from storage (for Integram/user auth)
 * @private
 * @returns {string} Auth token
 */
function getAuthToken() {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || ''
}

/**
 * Get AI access token for making AI API calls
 * This retrieves the default DronDoc AI token for the current user
 *
 * Issue #1542: Enhanced error handling with specific error types
 *
 * @private
 * @returns {Promise<string>} AI access token
 * @throws {Error} Structured error with type prefix (AI_BACKEND_*)
 */
async function getAIAccessToken() {
  try {
    const userId = getCurrentUserId()
    const { token } = await getDefaultToken(userId)
    return token.id // Return the token ID (not the actual token value)
  } catch (error) {
    console.error('Failed to get AI access token:', error)

    // Pass through structured errors from aiTokenService
    if (error.message.startsWith('AI_BACKEND_')) {
      throw error
    }

    // Generic error
    throw new Error('AI_SERVICE_ERROR: AI service authentication failed. Please ensure AI backend is running and configured.')
  }
}

// ==================== YouTube Analytics AI Features ====================

/**
 * Analyze comment sentiment for YouTube videos
 * @param {Array<Object>} comments - Array of comments to analyze
 * @param {string} model - AI model to use (default: deepseek-chat)
 * @returns {Promise<Object>} Sentiment analysis results
 */
export async function analyzeCommentSentiment(comments, model = 'deepseek-v3.2') {
  // Get AI access token for authentication
  const aiAccessToken = await getAIAccessToken()

  const response = await fetch(`${API_BASE_URL}/ai/youtube/sentiment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiAccessToken}`
    },
    body: JSON.stringify({ comments, model })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to analyze sentiment' }))
    throw new Error(error.detail || 'Failed to analyze sentiment')
  }

  return response.json()
}

/**
 * Predict trends based on YouTube channel data
 * @param {Object} channelData - Channel performance data
 * @param {string} model - AI model to use
 * @returns {Promise<Object>} Trend predictions
 */
export async function predictTrends(channelData, model = 'deepseek-chat') {
  // Get AI access token for authentication
  const aiAccessToken = await getAIAccessToken()

  const response = await fetch(`${API_BASE_URL}/ai/youtube/trends`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiAccessToken}`
    },
    body: JSON.stringify({ channel_data: channelData, model })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to predict trends' }))
    throw new Error(error.detail || 'Failed to predict trends')
  }

  return response.json()
}

/**
 * Generate content recommendations for YouTube channel
 * @param {Object} channelAnalytics - Channel analytics data
 * @param {Object} options - Recommendation options
 * @returns {Promise<Object>} Content recommendations
 */
export async function generateContentRecommendations(channelAnalytics, options = {}) {
  // Get AI access token for authentication
  const aiAccessToken = await getAIAccessToken()

  const response = await fetch(`${API_BASE_URL}/ai/youtube/recommendations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiAccessToken}`
    },
    body: JSON.stringify({
      analytics: channelAnalytics,
      model: options.model || 'deepseek-chat',
      focus_areas: options.focus_areas || ['topics', 'timing', 'format']
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to generate recommendations' }))
    throw new Error(error.detail || 'Failed to generate recommendations')
  }

  return response.json()
}

/**
 * Generate competitor analysis summary
 * @param {Array<Object>} competitors - Competitor channel data
 * @param {Object} ownChannel - Own channel data for comparison
 * @returns {Promise<Object>} Competitor analysis
 */
export async function analyzeCompetitors(competitors, ownChannel) {
  // Get AI access token for authentication
  const aiAccessToken = await getAIAccessToken()

  const response = await fetch(`${API_BASE_URL}/ai/youtube/competitors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiAccessToken}`
    },
    body: JSON.stringify({
      competitors,
      own_channel: ownChannel,
      model: 'deepseek-chat'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to analyze competitors' }))
    throw new Error(error.detail || 'Failed to analyze competitors')
  }

  return response.json()
}

// ==================== Agents Module AI Features ====================

/**
 * Generate AI agent configuration
 * @param {Object} requirements - Agent requirements and description
 * @returns {Promise<Object>} Generated agent configuration
 */
export async function generateAgentConfig(requirements) {
  const response = await fetch(`${API_BASE_URL}/ai/agents/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      requirements,
      model: 'gpt-4'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to generate agent config' }))
    throw new Error(error.detail || 'Failed to generate agent config')
  }

  return response.json()
}

/**
 * Suggest agent improvements based on performance
 * @param {Object} agentData - Current agent configuration and performance metrics
 * @returns {Promise<Object>} Improvement suggestions
 */
export async function suggestAgentImprovements(agentData) {
  const response = await fetch(`${API_BASE_URL}/ai/agents/improve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      agent_data: agentData,
      model: 'gpt-4'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to suggest improvements' }))
    throw new Error(error.detail || 'Failed to suggest improvements')
  }

  return response.json()
}

/**
 * Create AI agent from natural language description
 * @param {string} description - Natural language description of desired agent
 * @returns {Promise<Object>} Created agent specification
 */
export async function createAgentFromDescription(description) {
  const response = await fetch(`${API_BASE_URL}/ai/agents/from-description`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      description,
      model: 'gpt-4'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to create agent from description' }))
    throw new Error(error.detail || 'Failed to create agent from description')
  }

  return response.json()
}

// ==================== Workflows Module AI Features ====================

/**
 * Generate workflow from description
 * @param {string} description - Workflow description
 * @returns {Promise<Object>} Generated workflow configuration
 */
export async function generateWorkflow(description) {
  const response = await fetch(`${API_BASE_URL}/ai/workflows/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      description,
      model: 'gpt-4'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to generate workflow' }))
    throw new Error(error.detail || 'Failed to generate workflow')
  }

  return response.json()
}

/**
 * Optimize existing workflow
 * @param {Object} workflowData - Current workflow configuration
 * @returns {Promise<Object>} Optimized workflow
 */
export async function optimizeWorkflow(workflowData) {
  const response = await fetch(`${API_BASE_URL}/ai/workflows/optimize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      workflow: workflowData,
      model: 'gpt-4'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to optimize workflow' }))
    throw new Error(error.detail || 'Failed to optimize workflow')
  }

  return response.json()
}

/**
 * Suggest workflow automation opportunities
 * @param {Array<Object>} processes - Current manual processes
 * @returns {Promise<Object>} Automation suggestions
 */
export async function suggestWorkflowAutomation(processes) {
  const response = await fetch(`${API_BASE_URL}/ai/workflows/suggest-automation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      processes,
      model: 'gpt-4'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to suggest automation' }))
    throw new Error(error.detail || 'Failed to suggest automation')
  }

  return response.json()
}

// ==================== Tables Module AI Features ====================

/**
 * Execute natural language query on table data
 * @param {string} query - Natural language query
 * @param {Object} tableData - Table data to query
 * @returns {Promise<Object>} Query results
 */
export async function executeNaturalLanguageQuery(query, tableData) {
  const response = await fetch(`${API_BASE_URL}/ai/tables/nl-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      query,
      table_data: tableData,
      model: 'gpt-4'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to execute query' }))
    throw new Error(error.detail || 'Failed to execute query')
  }

  return response.json()
}

/**
 * Generate insights from table data
 * @param {Object} tableData - Table data to analyze
 * @returns {Promise<Object>} Generated insights
 */
export async function generateTableInsights(tableData) {
  const response = await fetch(`${API_BASE_URL}/ai/tables/insights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      table_data: tableData,
      model: 'gpt-4'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to generate insights' }))
    throw new Error(error.detail || 'Failed to generate insights')
  }

  return response.json()
}

/**
 * Suggest data transformations
 * @param {Object} tableData - Table data
 * @param {string} goal - Transformation goal
 * @returns {Promise<Object>} Transformation suggestions
 */
export async function suggestDataTransformations(tableData, goal) {
  const response = await fetch(`${API_BASE_URL}/ai/tables/transformations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      table_data: tableData,
      goal,
      model: 'gpt-4'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to suggest transformations' }))
    throw new Error(error.detail || 'Failed to suggest transformations')
  }

  return response.json()
}

// ==================== Echo Editor AI Features ====================

/**
 * Generate content based on prompt
 * @param {string} prompt - Content generation prompt
 * @param {Object} options - Generation options (tone, length, format)
 * @returns {Promise<Object>} Generated content
 */
export async function generateContent(prompt, options = {}) {
  const response = await fetch(`${API_BASE_URL}/ai/content/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      prompt,
      model: options.model || 'gpt-4',
      tone: options.tone || 'professional',
      length: options.length || 'medium',
      format: options.format || 'markdown'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to generate content' }))
    throw new Error(error.detail || 'Failed to generate content')
  }

  return response.json()
}

/**
 * Improve existing content
 * @param {string} content - Content to improve
 * @param {Array<string>} improvements - Types of improvements (clarity, grammar, style, etc.)
 * @returns {Promise<Object>} Improved content
 */
export async function improveContent(content, improvements = ['clarity', 'grammar']) {
  const response = await fetch(`${API_BASE_URL}/ai/content/improve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      content,
      improvements,
      model: 'gpt-4'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to improve content' }))
    throw new Error(error.detail || 'Failed to improve content')
  }

  return response.json()
}

/**
 * Summarize content
 * @param {string} content - Content to summarize
 * @param {string} length - Summary length (short, medium, long)
 * @returns {Promise<Object>} Summarized content
 */
export async function summarizeContent(content, length = 'medium') {
  const response = await fetch(`${API_BASE_URL}/ai/content/summarize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      content,
      length,
      model: 'gpt-3.5-turbo'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to summarize content' }))
    throw new Error(error.detail || 'Failed to summarize content')
  }

  return response.json()
}

/**
 * Translate content
 * @param {string} content - Content to translate
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<Object>} Translated content
 */
export async function translateContent(content, targetLanguage) {
  const response = await fetch(`${API_BASE_URL}/ai/content/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      content,
      target_language: targetLanguage,
      model: 'gpt-3.5-turbo'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to translate content' }))
    throw new Error(error.detail || 'Failed to translate content')
  }

  return response.json()
}

/**
 * Expand content with additional details
 * @param {string} content - Content to expand
 * @param {string} direction - Expansion direction (deeper, broader, examples)
 * @returns {Promise<Object>} Expanded content
 */
export async function expandContent(content, direction = 'broader') {
  const response = await fetch(`${API_BASE_URL}/ai/content/expand`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      content,
      direction,
      model: 'gpt-4'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to expand content' }))
    throw new Error(error.detail || 'Failed to expand content')
  }

  return response.json()
}

// ==================== Agriculture Module AI Features ====================

/**
 * Generate technical specification (TZ) for agricultural order
 * @param {Object} orderData - Order data including field, service, weather, recipe
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated technical specification
 */
export async function generateAgriculturalTZ(orderData, options = {}) {
  const response = await fetch(`${API_BASE_URL}/ai/agriculture/generate-tz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      order_data: orderData,
      model: options.model || 'gpt-4',
      language: options.language || 'ru',
      detail_level: options.detail_level || 'comprehensive'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to generate TZ' }))
    throw new Error(error.detail || 'Failed to generate technical specification')
  }

  return response.json()
}

/**
 * Validate generated TZ against requirements
 * @param {Object} tzData - Generated TZ data
 * @returns {Promise<Object>} Validation results
 */
export async function validateAgriculturalTZ(tzData) {
  const response = await fetch(`${API_BASE_URL}/ai/agriculture/validate-tz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ tz_data: tzData })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to validate TZ' }))
    throw new Error(error.detail || 'Failed to validate technical specification')
  }

  return response.json()
}

/**
 * Regenerate specific section of TZ
 * @param {string} tzId - TZ identifier
 * @param {string} sectionName - Section to regenerate
 * @param {Object} additionalContext - Additional context for regeneration
 * @returns {Promise<Object>} Regenerated section
 */
export async function regenerateTZSection(tzId, sectionName, additionalContext = {}) {
  const response = await fetch(`${API_BASE_URL}/ai/agriculture/regenerate-tz-section`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({
      tz_id: tzId,
      section_name: sectionName,
      additional_context: additionalContext,
      model: 'gpt-4'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to regenerate section' }))
    throw new Error(error.detail || 'Failed to regenerate TZ section')
  }

  return response.json()
}

// ==================== General AI Features ====================

/**
 * Chat with AI assistant
 * @param {Array<Object>} messages - Chat history
 * @param {string} model - AI model to use
 * @returns {Promise<Object>} AI response
 */
export async function chat(messages, model = 'gpt-4') {
  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ messages, model })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to chat with AI' }))
    throw new Error(error.detail || 'Failed to chat with AI')
  }

  return response.json()
}

/**
 * Get available AI models
 * Issue #1540 - Now fetches from DronDoc API via ai-tokens/models endpoint
 * @param {string} [provider] - Optional provider filter
 * @returns {Promise<Array>} List of available models
 */
export async function getAvailableModels(provider = null) {
  const url = provider
    ? `${API_BASE_URL}/ai-tokens/models?provider=${encodeURIComponent(provider)}`
    : `${API_BASE_URL}/ai-tokens/models`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch models' }))
    throw new Error(error.error || error.detail || 'Failed to fetch models')
  }

  const result = await response.json()
  return result.data || result
}
