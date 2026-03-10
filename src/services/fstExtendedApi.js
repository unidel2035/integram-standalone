/**
 * fstExtendedApi.js — Extended FST API for Committee and Hub data
 *
 * Issue #83: Remove hardcoded data from FstHub and FstCommittee
 *
 * This module extends fstApi.js with methods to:
 * - Fetch enriched project data with TRL, MRL, sovereignty, IRR, etc.
 * - Fetch subfund metadata (budget, color, icon)
 * - Calculate aggregate stats for FstHub
 * - Seed demo data from FstCommitteeConfig.js constants
 *
 * Data Strategy:
 * - Use existing Integram type 1155 for projects
 * - Store extended fields as JSON in HTML requisites
 * - Parse on read, stringify on write
 */

import {
  authenticate,
  getProjects as getBasicProjects,
  createProject,
  getCommitteeSessions,
  TYPE_PROJECTS
} from './fstApi.js'

const FST_SERVER = import.meta.env.VITE_FST_SERVER || 'https://api.ai2o.ru'
const FST_DB = import.meta.env.VITE_FST_DB || 'fst'

// Re-export for convenience
export { authenticate, TYPE_PROJECTS }

// ── Extended Project Fields Mapping ───────────────────────────────

/**
 * Extended project schema stored as JSON in description (t1158)
 * Format: { description: "...", extended: { trl, mrl, ... } }
 */
const EXTENDED_FIELDS = [
  'trl',              // NUMBER (1-9)
  'mrl',              // NUMBER (1-10)
  'sovereigntyScore', // NUMBER (0-9)
  'localizationRatio',// NUMBER (0-1)
  'marketSize',       // NUMBER (rubles)
  'projectedIRR',     // NUMBER (0-1)
  'teamStrength',     // NUMBER (0-1)
  'employees',        // NUMBER
  'founded',          // NUMBER (year)
  'patents',          // NUMBER
  'market',           // STRING
  'strengths',        // ARRAY of strings
  'risks',            // ARRAY of strings
  'documents'         // ARRAY of strings
]

// ── Subfunds Constants ────────────────────────────────────────────

/**
 * Subfund metadata stored in code (can be moved to Integram later)
 * Integram refs: БАС=1096, РОБО=1098, МЭ=1100
 */
export const SUBFUNDS_METADATA = {
  1096: { // БАС
    id: 1096,
    key: 'bas',
    name: 'Субфонд БАС',
    shortName: 'БАС',
    color: '#42a5f5',
    icon: 'pi pi-send',
    budget: 3_200_000_000,
    deployedRatio: 0.31,
    description: 'Беспилотные авиационные системы',
    marketFocus: ['aeronet']
  },
  1098: { // РОБО
    id: 1098,
    key: 'robot',
    name: 'Субфонд Робот',
    shortName: 'Робот',
    color: '#66bb6a',
    icon: 'pi pi-cog',
    budget: 1_800_000_000,
    deployedRatio: 0.18,
    description: 'Робототехника и автономные системы',
    marketFocus: ['autonet']
  },
  1100: { // МЭ
    id: 1100,
    key: 'me',
    name: 'Субфонд МЭ',
    shortName: 'МЭ',
    color: '#ffa726',
    icon: 'pi pi-chip',
    budget: 1_400_000_000,
    deployedRatio: 0.22,
    description: 'Микро- и радиоэлектроника',
    marketFocus: ['neuronet', 'energynet']
  }
}

// ── Helper Functions ──────────────────────────────────────────────

/**
 * Parse extended project data from description field
 */
function parseExtendedData(descriptionHtml) {
  if (!descriptionHtml) return { description: '', extended: {} }

  try {
    // Check if description contains JSON marker
    if (descriptionHtml.includes('<!--FST_EXTENDED_DATA:')) {
      const match = descriptionHtml.match(/<!--FST_EXTENDED_DATA:(.*?)-->/)
      if (match) {
        const extended = JSON.parse(match[1])
        const description = descriptionHtml.replace(/<!--FST_EXTENDED_DATA:.*?-->/, '').replace(/<!--FST_FULL_APPLICATION:.*?-->/, '').trim()
        return { description, extended }
      }
    }
  } catch (e) {
    console.warn('[fstExtendedApi] Failed to parse extended data:', e)
  }

  return { description: descriptionHtml.replace(/<!--FST_FULL_APPLICATION:.*?-->/, '').trim(), extended: {} }
}

/**
 * Serialize extended project data into description field
 */
function serializeExtendedData(description, extended) {
  const json = JSON.stringify(extended)
  return `${description}\n<!--FST_EXTENDED_DATA:${json}-->`
}

/**
 * Estimate IRR from extended project data when not stored (issue #151)
 */
export function estimateIRRFromExtended(ext, proj) {
  const trl = ext.trl || 5
  const marketSize = ext.marketSize || 10_000_000_000
  const amount = proj.amount || 100_000_000

  // Higher market/amount ratio → higher IRR potential
  const marketRatio = marketSize / Math.max(amount, 1)
  let irr = 0.25

  if (marketRatio > 200) irr = 0.45
  else if (marketRatio > 100) irr = 0.35
  else if (marketRatio > 50) irr = 0.28
  else irr = 0.20

  // TRL adjustment
  if (trl >= 7) irr -= 0.04
  else if (trl <= 3) irr += 0.06

  return Math.round(Math.min(0.65, Math.max(0.12, irr)) * 100) / 100
}

// ── API Methods ───────────────────────────────────────────────────

/**
 * Get enriched projects with all extended fields
 * @returns {Promise<Array>} Projects with TRL, MRL, sovereignty, etc.
 */
export async function getEnrichedProjects() {
  const basicProjects = await getBasicProjects()

  return basicProjects.map(proj => {
    const { description, extended } = parseExtendedData(proj.description)

    // Issue #157: prefer DB numeric fields (proj.*) over HTML-parsed (extended.*)
    const trl = proj.trl || extended.trl || 5
    const mrl = proj.mrl || extended.mrl || 3
    const sovereigntyScore = proj.sovereigntyScore || extended.sovereigntyScore || 6
    const marketSizeMln = proj.marketSizeMln || Math.round((extended.marketSize || 10_000_000_000) / 1_000_000)
    const projectedIRR = proj.projectedIRR
      ? proj.projectedIRR / 100     // DB stores as % -> convert to 0-1
      : (extended.projectedIRR || estimateIRRFromExtended(extended, proj))
    const teamStrength = proj.teamStrength
      ? proj.teamStrength / 10      // DB stores as 0-10 -> convert to 0-1
      : (extended.teamStrength || 0.7)

    return {
      id: proj.id,
      title: extended.title || proj.name,
      company: proj.name,
      subFund: getSubfundKey(proj.subfundId),
      market: extended.market || '',
      stage: getStageKey(proj.stageId),
      requestedAmount: proj.amount,
      ogrn: proj.ogrn,
      submittedAt: proj.submittedAt,
      statusId: proj.statusId,
      description,

      // Numeric fields: DB first, fallback to HTML-parsed
      trl,
      mrl,
      sovereigntyScore,
      localizationRatio: extended.localizationRatio || 0.5,
      marketSize: marketSizeMln * 1_000_000,
      projectedIRR,
      teamStrength,
      employees: proj.employees || extended.employees || 15,
      founded: proj.foundedYear || extended.founded || 2020,
      patents: proj.patents || extended.patents || 1,
      strengths: extended.strengths || [],
      risks: extended.risks || [],
      documents: extended.documents || []
    }
  })
}

/**
 * Get subfunds with metadata
 * @returns {Array} Subfunds array
 */
export function getSubfunds() {
  return Object.values(SUBFUNDS_METADATA)
}

/**
 * Get subfunds as object keyed by string ID (for FstCommitteeConfig compat)
 * @returns {Object} Subfunds object { bas: {...}, robot: {...}, me: {...} }
 */
export function getSubfundsObject() {
  const result = {}
  Object.values(SUBFUNDS_METADATA).forEach(sf => {
    result[sf.key] = sf
  })
  return result
}

/**
 * Get aggregate stats for FstHub dashboard
 * @returns {Promise<Object>} { aum, portfolioCount, subfundCount, avgIRR }
 */
export async function getStats() {
  const subfunds = getSubfunds()
  const [projects, sessions] = await Promise.all([
    getEnrichedProjects(),
    getCommitteeSessions().catch(() => [])
  ])

  // Calculate AUM (Assets Under Management)
  const aum = subfunds.reduce((sum, sf) => sum + (sf.budget * sf.deployedRatio), 0)

  // Count portfolio companies (projects with status "В работе" = 1125)
  const portfolioCount = projects.filter(p => p.statusId === 1125).length

  // Subfund count
  const subfundCount = subfunds.length

  // Committee sessions count
  const committeeCount = sessions.length

  // Average projected IRR
  const validProjects = projects.filter(p => p.projectedIRR > 0)
  const avgIRR = validProjects.length > 0
    ? validProjects.reduce((sum, p) => sum + p.projectedIRR, 0) / validProjects.length
    : 0.35

  return {
    aum,
    portfolioCount,
    subfundCount,
    committeeCount,
    avgIRR,
    projects,
    subfunds
  }
}

/**
 * Create enriched project with extended data
 * @param {Object} data - Project data with extended fields
 * @returns {Promise<Object>} Created project
 */
export async function createEnrichedProject(data) {
  const {
    name,
    ogrn,
    amount,
    title,
    description,
    submittedAt,
    subfundId,
    stageId,
    statusId,
    ...extendedFields
  } = data

  // Extract only valid extended fields
  const extended = { title }
  EXTENDED_FIELDS.forEach(field => {
    if (extendedFields[field] !== undefined) {
      extended[field] = extendedFields[field]
    }
  })

  // Serialize extended data into description
  const serializedDescription = serializeExtendedData(description || '', extended)

  return createProject({
    name: name || title,
    ogrn,
    amount,
    description: serializedDescription,
    submittedAt,
    subfundId,
    stageId,
    statusId,
    // Issue #157: write to dedicated DB fields
    trl: extended.trl || null,
    mrl: extended.mrl || null,
    sovereigntyScore: extended.sovereigntyScore || null,
    projectedIRR: extended.projectedIRR ? Math.round(extended.projectedIRR * 100) : null,
    marketSizeMln: extended.marketSize ? Math.round(extended.marketSize / 1_000_000) : null,
    teamStrength: extended.teamStrength ? Math.round(extended.teamStrength * 10) : null,
    employees: extended.employees || null,
    patents: extended.patents || null,
    foundedYear: extended.founded || null,
  })
}

// ── Helper Converters ─────────────────────────────────────────────

function getSubfundKey(subfundId) {
  const mapping = {
    1096: 'bas',
    1098: 'robot',
    1100: 'me'
  }
  return mapping[subfundId] || 'bas'
}

function getStageKey(stageId) {
  const mapping = {
    1102: 'Pre-seed',
    1103: 'Seed',
    1104: 'Round A',
    1105: 'Round B',
    1106: 'Round C'
  }
  return mapping[stageId] || 'Seed'
}

function getSubfundId(subfundKey) {
  const mapping = {
    'bas': 1096,
    'robot': 1098,
    'me': 1100
  }
  return mapping[subfundKey] || 1096
}

function getStageId(stageKey) {
  const mapping = {
    'Pre-seed': 1102,
    'Seed': 1103,
    'Round A': 1104,
    'Series A': 1104,
    'Round B': 1105,
    'Round C': 1106
  }
  return mapping[stageKey] || 1103
}

function getStatusId(statusKey) {
  const mapping = {
    'Новый': 1115,
    'На рассмотрении ИК': 1117,
    'Одобрен': 1119,
    'На доработке': 1123,
    'В работе': 1125,
    'Закрыт': 1127
  }
  return mapping[statusKey] || 1115
}

// ── Seed Demo Data ────────────────────────────────────────────────

/**
 * Seed database with demo projects from FstCommitteeConfig.js
 * @param {Array} demoProjects - Array of project objects from PROJECTS_POOL
 * @returns {Promise<Array>} Created project IDs
 */
export async function seedDemoProjects(demoProjects) {
  const results = []

  for (const proj of demoProjects) {
    try {
      const created = await createEnrichedProject({
        name: proj.company,
        title: proj.title,
        amount: proj.requestedAmount,
        description: proj.description,
        subfundId: getSubfundId(proj.subFund),
        stageId: getStageId(proj.stage),
        statusId: getStatusId('Новый'),
        submittedAt: new Date().toISOString(),

        // Extended fields
        trl: proj.trl,
        mrl: proj.mrl,
        sovereigntyScore: proj.sovereigntyScore,
        localizationRatio: proj.localizationRatio,
        marketSize: proj.marketSize,
        projectedIRR: proj.projectedIRR,
        teamStrength: proj.teamStrength,
        employees: proj.employees,
        founded: proj.founded,
        patents: proj.patents,
        market: proj.market,
        strengths: proj.strengths,
        risks: proj.risks,
        documents: proj.documents
      })

      results.push(created)
      console.log(`[seedDemoProjects] Created: ${proj.title}`)
    } catch (error) {
      console.error(`[seedDemoProjects] Failed to create ${proj.title}:`, error)
    }
  }

  return results
}
