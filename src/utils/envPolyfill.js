/**
 * Environment Variable Polyfill
 *
 * This module provides runtime polyfills for environment variables that support "auto" mode.
 * It must be imported early in the application initialization (in main.js).
 *
 * Issue #6346: Support automatic hostname detection for multi-domain deployments
 */

import { getBaseApiUrl, getOrchestratorUrl, getWebSocketUrl } from './apiConfig.js'

/**
 * Initialize environment variable polyfills
 * This function overrides import.meta.env values at runtime if they're set to "auto"
 */
export function initEnvPolyfills() {
  // In LOCAL dev mode (localhost), use Vite proxy and skip polyfills
  // But if running on a remote server (dev.drondoc.ru, proxy.drondoc.ru), apply polyfills even in dev mode
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

  if (import.meta.env.DEV && isLocalhost) {
    console.log('[EnvPolyfill] Running in Vite dev mode on localhost, using proxy')
    return
  }

  // If we're on a remote server (even in dev mode), apply hostname detection
  if (!isLocalhost) {
    console.log('[EnvPolyfill] Running on remote server, applying hostname detection')
  }

  // Check if VITE_API_URL is set to "auto"
  if (import.meta.env.VITE_API_URL === 'auto') {
    const detectedApiUrl = getBaseApiUrl()
    console.log('[EnvPolyfill] Auto-detected API URL:', detectedApiUrl, 'from hostname:', window.location.hostname)

    // Override the environment variable
    // Note: import.meta.env is read-only, so we need to use a different approach
    // We'll store it in a global variable that components can access
    window.__DRONDOC_API_URL__ = detectedApiUrl
  } else {
    // Use the configured value
    window.__DRONDOC_API_URL__ = import.meta.env.VITE_API_URL || '/api'
  }

  // Check if VITE_ORCHESTRATOR_URL is set to "auto"
  if (import.meta.env.VITE_ORCHESTRATOR_URL === 'auto') {
    const detectedOrchestratorUrl = getOrchestratorUrl()
    console.log('[EnvPolyfill] Auto-detected Orchestrator URL:', detectedOrchestratorUrl, 'from hostname:', window.location.hostname)
    window.__DRONDOC_ORCHESTRATOR_URL__ = detectedOrchestratorUrl
  } else {
    window.__DRONDOC_ORCHESTRATOR_URL__ = import.meta.env.VITE_ORCHESTRATOR_URL || ''
  }

  // Check if VITE_WS_URL is set to "auto"
  if (import.meta.env.VITE_WS_URL === 'auto') {
    const detectedWsUrl = getWebSocketUrl()
    console.log('[EnvPolyfill] Auto-detected WebSocket URL:', detectedWsUrl, 'from hostname:', window.location.hostname)
    window.__DRONDOC_WS_URL__ = detectedWsUrl
  } else {
    window.__DRONDOC_WS_URL__ = import.meta.env.VITE_WS_URL || ''
  }
}

/**
 * Get the API URL (with auto-detection support)
 * Use this instead of directly accessing import.meta.env.VITE_API_URL
 *
 * @returns {string} The API URL (e.g., https://proxy.drondoc.ru/api)
 */
export function getApiUrlEnv() {
  // If polyfill was applied, use the global variable
  if (window.__DRONDOC_API_URL__) {
    return window.__DRONDOC_API_URL__
  }

  // If explicitly set to a real URL (not "auto"), use it
  if (import.meta.env.VITE_API_URL &&
      import.meta.env.VITE_API_URL !== 'auto' &&
      import.meta.env.VITE_API_URL !== '') {
    return import.meta.env.VITE_API_URL
  }

  // Always use auto-detection as fallback
  return getBaseApiUrl()
}

/**
 * Get the Orchestrator URL (with auto-detection support)
 *
 * @returns {string} The orchestrator URL
 */
export function getOrchestratorUrlEnv() {
  if (window.__DRONDOC_ORCHESTRATOR_URL__) {
    return window.__DRONDOC_ORCHESTRATOR_URL__
  }

  // If explicitly set to a real URL (not "auto"), use it
  if (import.meta.env.VITE_ORCHESTRATOR_URL &&
      import.meta.env.VITE_ORCHESTRATOR_URL !== 'auto' &&
      import.meta.env.VITE_ORCHESTRATOR_URL !== '') {
    return import.meta.env.VITE_ORCHESTRATOR_URL
  }

  // Always use auto-detection as fallback
  return getOrchestratorUrl()
}

/**
 * Get the WebSocket URL (with auto-detection support)
 *
 * @returns {string} The WebSocket URL
 */
export function getWebSocketUrlEnv() {
  if (window.__DRONDOC_WS_URL__) {
    return window.__DRONDOC_WS_URL__
  }

  // If explicitly set to a real URL (not "auto"), use it
  if (import.meta.env.VITE_WS_URL &&
      import.meta.env.VITE_WS_URL !== 'auto' &&
      import.meta.env.VITE_WS_URL !== '') {
    return import.meta.env.VITE_WS_URL
  }

  // Always use auto-detection as fallback
  return getWebSocketUrl()
}
