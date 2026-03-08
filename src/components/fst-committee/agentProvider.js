/**
 * agentProvider.js — Reactive agent provider for committee engine
 *
 * Wraps fstAgentConfigService.getICAgents() into a synchronous-accessible ref.
 * Starts with static AGENTS from FstCommitteeConfig.js, then updates from DB.
 *
 * Usage:
 *   import { agents, loadAgents, getAgents } from './agentProvider.js'
 *   await loadAgents()        // call once on mount
 *   getAgents()               // synchronous array (for engine)
 *   agents.value              // reactive ref (for Vue templates)
 */

import { ref } from 'vue'
import { AGENTS as STATIC_AGENTS } from './FstCommitteeConfig.js'
import { getICAgents } from './fstAgentConfigService.js'

const agents = ref(STATIC_AGENTS)
let _loaded = false

/**
 * Load agents from Integram DB (with cache + fallback to static).
 * Safe to call multiple times — only fetches once.
 */
export async function loadAgents() {
  if (_loaded) return agents.value
  try {
    agents.value = await getICAgents()
    _loaded = true
  } catch (err) {
    console.warn('[agentProvider] DB load failed, using static:', err.message)
  }
  return agents.value
}

/** Synchronous accessor for non-Vue consumers (engine, AgentLoop) */
export function getAgents() {
  return agents.value
}

/** Force reload from DB on next call */
export function reloadAgents() {
  _loaded = false
}

export { agents }
