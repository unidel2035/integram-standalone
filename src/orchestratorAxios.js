/**
 * Axios client for Monolithic Backend (Orchestrator) API
 *
 * This client is specifically for communicating with the monolithic backend.
 * Backend URL is configured via environment variables (see .env.example).
 *
 * DO NOT use this for legacy Integram API calls (fields, harvests, etc.)
 * For Integram API, use @/axios or @/axios2 instead.
 *
 * Endpoints handled by this client:
 * - /api/ai-tokens/*
 * - /api/youtube/*
 * - /api/recording/*
 * - /api/scraper/*
 * - /api/voice-agent/*
 * - /api/agriculture/*
 * - /api/mcp/*
 * - /api/accounting/*
 * - etc.
 */

import axios from 'axios'

let activeRequests = 0
const loaders = new Map()

export const registerLoaderCallbacks = (show, hide, loaderId) => {
  loaders.set(loaderId, { show, hide })
  return () => loaders.delete(loaderId)
}

const updateLoaders = isLoading => {
  loaders.forEach(loader => {
    isLoading ? loader.show() : loader.hide()
  })
}

/**
 * Get the base URL for the monolithic backend
 *
 * Uses environment variables or constructs URL from VITE_BACKEND_* variables
 * For local development with Vite proxy, returns empty string to use relative URLs
 *
 * Issue #5036: Fixed to use current origin when VITE_ORCHESTRATOR_URL is not set
 * This prevents CORS errors on dev.drondoc.ru and other deployments
 */
const getBaseURL = () => {
  const configUrl = (import.meta.env.VITE_ORCHESTRATOR_URL || '').trim()
  // If VITE_ORCHESTRATOR_URL is set, not empty, and not the sentinel value 'auto', use it directly
  if (configUrl && configUrl !== 'auto') {
    return configUrl
  }

  // In development mode, use relative URLs to leverage Vite proxy
  // This avoids CORS and HTTPS/HTTP protocol issues
  if (import.meta.env.DEV) {
    return '' // Empty string = relative URL, goes through Vite proxy
  }

  // In production, if no VITE_ORCHESTRATOR_URL set, use current origin
  // This allows the app to work on any domain (drondoc.ru, dev.drondoc.ru, etc.)
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin
  }

  // Fallback: construct from individual components
  const protocol = import.meta.env.VITE_BACKEND_PROTOCOL || 'https'
  const host = import.meta.env.VITE_BACKEND_HOST || 'drondoc.ru'
  const port = import.meta.env.VITE_BACKEND_PORT

  // Only add port if it's explicitly set and not default (80/443)
  if (port && port !== '80' && port !== '443') {
    return `${protocol}://${host}:${port}`
  }

  return `${protocol}://${host}`
}

const orchestratorClient = axios.create({
  baseURL: getBaseURL(),
  timeout: 180000, // 180 seconds for AI operations (increased for RAG chat with large context)
  headers: {
    'Content-Type': 'application/json',
  },
})

orchestratorClient.interceptors.request.use(
  config => {
    // Add DronDoc admin token if available
    // This token is used to authenticate with DronDoc API
    const ddAdminToken = localStorage.getItem('ddadmin_token')
    if (ddAdminToken) {
      config.headers['X-Authorization'] = ddAdminToken
    }

    // Add Integram token for general-chat API
    // Use X-Authorization header (same as Profile.vue)
    if (config.url && config.url.includes('/api/general-chat')) {
      const integramToken = localStorage.getItem('token')
      if (integramToken) {
        config.headers['X-Authorization'] = integramToken
      }
    }

    activeRequests++
    if (activeRequests === 1) updateLoaders(true)
    return config
  },
  error => {
    activeRequests = Math.max(0, activeRequests - 1)
    if (activeRequests === 0) updateLoaders(false)

    // Handle request error
    if (window.errorHandler) {
      window.errorHandler.handle(error, { source: 'orchestrator-axios-request' })
    }

    return Promise.reject(error)
  },
)

orchestratorClient.interceptors.response.use(
  response => {
    activeRequests = Math.max(0, activeRequests - 1)
    if (activeRequests === 0) updateLoaders(false)
    return response
  },
  error => {
    activeRequests = Math.max(0, activeRequests - 1)
    if (activeRequests === 0) updateLoaders(false)

    // Handle response error
    if (window.errorHandler) {
      window.errorHandler.handle(error, {
        source: 'orchestrator-axios-response',
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status
      })
    }

    return Promise.reject(error)
  },
)

export default orchestratorClient
