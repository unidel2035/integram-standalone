/**
 * Sandbox AI Interceptor
 * Intercepts AI API calls in sandbox mode and returns mock responses
 */

import { useSandboxStore } from '@/stores/sandboxStore'
import { useSandboxData } from '@/composables/useSandboxData'

/**
 * Wraps fetch to intercept AI calls in sandbox mode
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Response or mock response
 */
export async function sandboxFetch(url, options = {}) {
  const sandboxStore = useSandboxStore()

  // If not in sandbox mode, use regular fetch
  if (!sandboxStore.isSandboxMode) {
    return fetch(url, options)
  }

  // Check if this is an AI-related endpoint
  const isAIEndpoint = url.includes('/api/ai-tokens/chat') ||
                       url.includes('/api/mcp/integram')

  if (!isAIEndpoint) {
    return fetch(url, options)
  }

  // Parse request body
  let requestData = {}
  try {
    if (options.body && typeof options.body === 'string') {
      requestData = JSON.parse(options.body)
    }
  } catch (e) {
    console.warn('Failed to parse request body:', e)
  }

  // Generate mock response
  const { getMockAPIResponse } = useSandboxData()
  const mockData = getMockAPIResponse(url, requestData)

  // Return mock response in fetch format
  return new Response(
    JSON.stringify(mockData),
    {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json',
        'X-Sandbox-Mode': 'true'
      }
    }
  )
}

/**
 * Helper to wrap existing service calls
 * Usage:
 *   const response = await sandboxAwareCall(() => fetch('/api/ai-tokens/chat', {...}))
 */
export async function sandboxAwareCall(fetchFn) {
  const sandboxStore = useSandboxStore()

  if (sandboxStore.isSandboxMode) {
    // Extract URL and options from the fetch call
    // This is a simplified implementation
    // In practice, you'd want to intercept at a lower level
    try {
      return await fetchFn()
    } catch (error) {
      console.log('[Sandbox Mode] Call intercepted:', error)
      // Return mock response
      return new Response(
        JSON.stringify({
          response: 'Демо-режим: данные не сохранены',
          success: true,
          sandboxMode: true
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  return fetchFn()
}

/**
 * Delay simulation for demo mode (makes it feel more realistic)
 */
export function demoDelay(ms = 800) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default {
  sandboxFetch,
  sandboxAwareCall,
  demoDelay
}
