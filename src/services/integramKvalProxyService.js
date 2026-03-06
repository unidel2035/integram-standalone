/**
 * integramKvalProxyService.js
 *
 * Issue #6740: Shared helper for initialising the kval-proxy in integramApiClient.
 *
 * IntegramDataTableWrapper already initialises the proxy on mount, but
 * IntegramCardsEmbed and CardEditDialog did not — causing API calls to build
 * wrong URLs (e.g. /kval/edit_obj/… instead of /api/kval-proxy/edit_obj/…)
 * and receive 404s.
 *
 * Usage:
 *   import { ensureKvalProxy } from '@/services/integramKvalProxyService'
 *   await ensureKvalProxy()   // no-op if already initialised
 */

import integramApiClient from './integramApiClient'

/**
 * Ensure integramApiClient has proxyPath set for kval.
 *
 * - If proxyPath is already set, returns immediately (idempotent).
 * - Otherwise authenticates through the backend kval-proxy (server-side auth)
 *   and stores the resulting token + proxyPath on the shared client instance.
 *
 * @returns {Promise<boolean>} true if proxy is ready, false if auth failed
 */
export async function ensureKvalProxy() {
  // Already initialised — nothing to do
  if (integramApiClient.proxyPath) {
    return true
  }

  try {
    const apiBase = '/api'
    const resp = await fetch(`${apiBase}/kval-proxy/auth`).then(r => r.json())

    if (resp && resp.token) {
      integramApiClient.proxyPath = `${apiBase}/kval-proxy`
      integramApiClient.setDatabase('kval')
      integramApiClient.databases = integramApiClient.databases || {}
      integramApiClient.databases['kval'] = {
        token: resp.token,
        xsrfToken: resp._xsrf || resp.xsrf || '',
        userId: resp.id || '',
        userName: 'd',
        userRole: 'admin',
        ownedDatabases: []
      }
      integramApiClient.token = resp.token
      integramApiClient.xsrfToken = resp._xsrf || resp.xsrf || ''
      return true
    }

    console.warn('[integramKvalProxyService] kval-proxy/auth did not return a token')
    return false
  } catch (err) {
    console.warn('[integramKvalProxyService] kval-proxy auth failed:', err.message)
    return false
  }
}
