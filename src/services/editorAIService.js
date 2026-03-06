/**
 * Editor AI Service
 *
 * Provides AI completions for the rich text Editor component
 * Uses DronDoc's token-based AI service for authentication
 */

import { getDefaultToken, getCurrentUserId } from './aiTokenService'
import { getApiUrl } from '../utils/apiConfig'

const API_BASE_URL = getApiUrl('/api')

/**
 * Get AI access token for making AI API calls
 * @private
 * @returns {Promise<string>} AI access token
 */
async function getAIAccessToken() {
  try {
    const userId = getCurrentUserId()
    const { token } = await getDefaultToken(userId)
    return token.id
  } catch (error) {
    console.error('Failed to get AI access token:', error)
    throw new Error('AI_SERVICE_ERROR: AI service authentication failed')
  }
}

/**
 * Get AI completions as a stream
 *
 * @param {Array<Object>} messages - Array of messages in OpenAI format [{role, content}]
 * @param {AbortSignal} signal - AbortSignal for cancellation
 * @param {Object} options - Options for the completion
 * @param {number} options.temperature - Temperature (0-2)
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @returns {Promise<ReadableStream>} Stream of completion chunks
 */
export async function getAICompletions(messages, signal, options = {}) {
  const {
    temperature = 0.7,
    maxTokens = 2048,
    model = 'deepseek-chat'
  } = options

  // Get AI access token
  const aiAccessToken = await getAIAccessToken()

  const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiAccessToken}`
    },
    body: JSON.stringify({
      messages,
      model,
      temperature,
      max_tokens: maxTokens,
      stream: true,
      application: 'Editor'
    }),
    signal
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'AI request failed' }))
    throw new Error(error.error || error.message || 'Failed to get AI completions')
  }

  return response.body
}

/**
 * Get a single AI completion (non-streaming)
 *
 * @param {Array<Object>} messages - Array of messages
 * @param {Object} options - Options for the completion
 * @returns {Promise<string>} Completion text
 */
export async function getAICompletion(messages, options = {}) {
  const {
    temperature = 0.7,
    maxTokens = 2048,
    model = 'deepseek-chat'
  } = options

  const aiAccessToken = await getAIAccessToken()

  const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiAccessToken}`
    },
    body: JSON.stringify({
      messages,
      model,
      temperature,
      max_tokens: maxTokens,
      stream: false,
      application: 'Editor'
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'AI request failed' }))
    throw new Error(error.error || error.message || 'Failed to get AI completion')
  }

  const result = await response.json()
  return result.choices?.[0]?.message?.content || ''
}

export default {
  getAICompletions,
  getAICompletion
}
