/**
 * fstAgentConfigService.js — Dynamic agent config loader from Integram DB
 *
 * Loads IC agents from Integram DB:
 *   Type 3674 "Агенты ИК"       — main agent records (name, bias, prompts, weights)
 *   Type 4238 "Настройки агента ИК" — extended: new scoring dims + game theory
 *
 * Falls back to static FstCommitteeConfig.js on any error (offline / first load).
 *
 * Field map (type 3674):
 *   3676=agent_id  3678=specialization  3680=systemPrompt  3682=bias
 *   3684=icon      3686=color           3688=avatar
 *   3692=wTRL      3694=wMRL            3696=wSov          3698=wMarket
 *   3700=wFinance  3702=wRisk           3704=wTeam         3706=thinkingPhrases
 *
 * Field map (type 4238, subordinate):
 *   4239=voiceWeight  4241=wMoat     4243=wTiming    4245=wPowerlaw
 *   4247=wBayesianP   4249=sortOrder 4250=description
 *   4252=gameRole     4254=nashStrategy  4256=innerMotivation
 *   4258=utilityFn    4260=nashType   4262=shapleyPriority  4264=focusJson
 */

import { authenticate } from '@/services/fstApi.js'
import { AGENTS as STATIC_AGENTS } from './FstCommitteeConfig.js'

const FST_DB = import.meta.env.VITE_FST_DB || 'fst-api'
const AGENT_TYPE_ID   = 3674
const SETTINGS_TYPE_ID = 4238
const CACHE_TTL = 5 * 60 * 1000 // 5 min

let _cache = null
let _loadPromise = null
let _cacheTime = 0

// ─── Public API ──────────────────────────────────────────────────────────────

/** Returns array of agents. Falls back to static if DB unavailable. */
export async function getICAgents() {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache
  if (_loadPromise) return _loadPromise

  _loadPromise = _loadFromDB()
    .then(agents => {
      _cache = agents
      _cacheTime = Date.now()
      _loadPromise = null
      return agents
    })
    .catch(err => {
      console.warn('[AgentConfig] DB unavailable, using static config:', err.message)
      _loadPromise = null
      return STATIC_AGENTS
    })

  return _loadPromise
}

export function invalidateAgentCache() {
  _cache = null
  _cacheTime = 0
}

// ─── DB Loader ───────────────────────────────────────────────────────────────

async function _loadFromDB() {
  const { token } = await authenticate()

  // Load agents and settings in parallel
  const [agentsData, settingsData] = await Promise.all([
    _fetchType(token, AGENT_TYPE_ID),
    _fetchType(token, SETTINGS_TYPE_ID, 30),
  ])

  if (!agentsData?.object?.length) throw new Error('No agents in DB')

  // Build parentId → settings map
  const settingsMap = {}
  for (const obj of (settingsData?.object || [])) {
    // up field = parentId for subordinate objects
    const pid = String(obj.up || '')
    if (pid && pid !== '1') {
      settingsMap[pid] = settingsData.reqs?.[obj.id] || {}
    }
  }

  return _mapAgents(agentsData.object, agentsData.reqs || {}, settingsMap)
}

async function _fetchType(token, typeId, limit = 20) {
  const res = await fetch(`/${FST_DB}/object/${typeId}?JSON_KV&l=${limit}`, {
    headers: { 'X-Authorization': token },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for type ${typeId}`)
  return res.json()
}

function _mapAgents(objects, reqs, settingsMap) {
  return objects
    .map(obj => {
      const r = reqs[obj.id] || {}
      const settings = settingsMap[String(obj.id)] || {}
      const agentId = r['3676'] || ''
      if (!agentId) return null

      const staticAgent = STATIC_AGENTS.find(a => a.id === agentId)
      const sw = staticAgent?.scoringWeights || {}

      const n = (key, fb = 0) => {
        const v = parseFloat(r[key] || 0) || parseFloat(settings[key] || 0)
        return v || fb
      }

      return {
        id: agentId,
        name: obj.val,
        shortName: staticAgent?.shortName || obj.val.split(' ')[0],
        role: staticAgent?.role || agentId.toUpperCase(),
        avatar: r['3688'] || staticAgent?.avatar || '🤖',
        color: r['3686'] || staticAgent?.color || '#78909c',
        bias: r['3682'] || 'neutral',
        weight: parseFloat(settings['4239'] || 0) || staticAgent?.weight || 0.08,
        focus: _parseJson(settings['4264'], staticAgent?.focus || []),
        description: settings['4250'] || staticAgent?.description || '',

        scoringWeights: {
          trl:        n('3692') || sw.trl        || 0.10,
          mrl:        n('3694') || sw.mrl        || 0.08,
          sovereignty:n('3696') || sw.sovereignty|| 0.10,
          market:     n('3698') || sw.market     || 0.15,
          finance:    n('3700') || sw.finance    || 0.20,
          risk:       n('3702') || sw.risk       || 0.20,
          team:       n('3704') || sw.team       || 0.10,
          moat:       parseFloat(settings['4241'] || 0) || sw.moat     || 0,
          timing:     parseFloat(settings['4243'] || 0) || sw.timing   || 0,
          powerlaw:   parseFloat(settings['4245'] || 0) || sw.powerlaw || 0,
          bayesian_p: parseFloat(settings['4247'] || 0) || sw.bayesian_p || 0,
        },

        thinkingPhrases: _parseLines(r['3706'], staticAgent?.thinkingPhrases || []),

        gameTheory: {
          role:            settings['4252'] || staticAgent?.gameTheory?.role || '',
          nashStrategy:    settings['4254'] || staticAgent?.gameTheory?.nashStrategy || '',
          innerMotivation: settings['4256'] || '',
          utilityFunction: settings['4258'] || staticAgent?.gameTheory?.utilityFunction || '',
          nashType:        settings['4260'] || staticAgent?.gameTheory?.nashType || 'cooperative',
          shapleyPriority: settings['4262'] || staticAgent?.gameTheory?.shapleyPriority || 'medium',
          sortOrder:       parseInt(settings['4249'] || 99),
        },

        _dbId: obj.id,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.gameTheory.sortOrder - b.gameTheory.sortOrder)
}

function _parseJson(str, fallback) {
  if (!str) return fallback
  try { return JSON.parse(str) } catch { return fallback }
}

function _parseLines(str, fallback) {
  if (!str) return fallback
  const lines = str.split('\n').map(l => l.trim()).filter(Boolean)
  return lines.length ? lines : fallback
}

// ─── Game Theory Engine ───────────────────────────────────────────────────────

/**
 * Shapley weight estimation based on historical accuracy.
 * In repeated rounds, agents that predicted correctly gain weight (Tit-for-Tat).
 *
 * @param {Array}  agents        - agent objects
 * @param {Object} history       - { [agentId]: { predictions: N, correct: N } }
 * @returns {Object}             - { [agentId]: normalizedWeight }
 */
export function computeShapleyWeights(agents, history = {}) {
  const raw = {}
  let total = 0

  for (const agent of agents) {
    const h = history[agent.id] || { predictions: 0, correct: 0 }
    const accuracy = h.predictions > 0 ? h.correct / h.predictions : 0.5
    // Tit-for-Tat: accurate agents get bonus weight
    const w = agent.weight * (1 + accuracy * 0.5)
    raw[agent.id] = w
    total += w
  }

  const result = {}
  for (const [id, w] of Object.entries(raw)) {
    result[id] = w / total
  }
  return result
}

/**
 * Check if current agent votes form a Nash Equilibrium.
 * Nash Equilibrium: no agent wants to unilaterally deviate.
 * Simplified: stable if ≥80% consensus.
 *
 * @param {Object} votes  - { [agentId]: score 0-1 }
 * @returns {{ isNash, unstableAgents, consensus }}
 */
export function checkNashEquilibrium(votes) {
  const vals = Object.values(votes)
  const n = vals.length
  if (!n) return { isNash: true, unstableAgents: [], consensus: 'unknown' }

  const forN    = vals.filter(v => v > 0.5).length
  const againstN = n - forN
  const majority = forN >= againstN ? 'approve' : 'reject'
  const majorityShare = Math.max(forN, againstN) / n

  const unstable = Object.entries(votes)
    .filter(([, v]) => majority === 'approve' ? v <= 0.5 : v > 0.5)
    .map(([id]) => id)

  return {
    isNash: majorityShare >= 0.8,
    unstableAgents: unstable,
    consensus: majority,
    majorityShare,
  }
}

/**
 * Update agent weights after a round result is known (Tit-for-Tat / repeated game).
 * Agents whose vote aligned with actual outcome get +5% weight, others -5%.
 *
 * @param {Array}  agents          - agent objects
 * @param {Object} currentWeights  - { [agentId]: weight }
 * @param {Object} accuracyUpdates - { [agentId]: { wasCorrect: bool } }
 * @returns {Object}               - new normalized weights
 */
export function updateWeightsTitForTat(agents, currentWeights, accuracyUpdates) {
  const DELTA = 0.05
  const MAX_W = 0.30
  const MIN_W = 0.04

  const next = { ...currentWeights }

  for (const agent of agents) {
    const u = accuracyUpdates[agent.id]
    if (!u) continue
    const cur = next[agent.id] ?? agent.weight
    next[agent.id] = u.wasCorrect
      ? Math.min(MAX_W, cur * (1 + DELTA))
      : Math.max(MIN_W, cur * (1 - DELTA))
  }

  // Renormalize
  const sum = Object.values(next).reduce((s, w) => s + w, 0)
  for (const id of Object.keys(next)) next[id] /= sum
  return next
}
