/**
 * SwrlService — SWRL-like rule support for ontology reasoning
 *
 * Parses simple SWRL-like syntax and converts rules to SPARQL CONSTRUCT
 * queries for execution against the RDF store.
 *
 * Syntax: Concept(?x) ∧ hasProperty(?x, ?v) ∧ greaterThan(?v, 100) → BigConcept(?x)
 */

import N3 from 'n3'
import { getRdfGraphService } from './RdfGraphService.js'
import logger from '../../utils/logger.js'

const DD = 'https://drondoc.ru/ontology/'
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'

const BUILTIN_COMPARATORS = new Set([
  'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual', 'equal', 'notEqual',
])

const FILTER_OP_MAP = {
  greaterThan: '>',
  lessThan: '<',
  greaterThanOrEqual: '>=',
  lessThanOrEqual: '<=',
  equal: '=',
  notEqual: '!=',
}

/**
 * Parse a single SWRL atom like Concept(?x) or hasProperty(?x, ?y) or greaterThan(?v, 100)
 */
function parseAtom(raw) {
  const s = raw.trim()
  const parenIdx = s.indexOf('(')
  if (parenIdx === -1) return null

  const predicate = s.substring(0, parenIdx).trim()
  const argsStr = s.substring(parenIdx + 1, s.lastIndexOf(')')).trim()
  const args = argsStr.split(',').map(a => a.trim())

  return { predicate, args }
}

/**
 * Parse a full SWRL rule body into antecedent and consequent atoms.
 * Body format: Atom1 ∧ Atom2 ∧ ... → Consequent
 */
function parseSwrlBody(body) {
  const arrowIdx = body.indexOf('→')
  if (arrowIdx === -1) {
    throw new Error('Rule must contain → separating antecedent and consequent')
  }

  const antecedentStr = body.substring(0, arrowIdx).trim()
  const consequentStr = body.substring(arrowIdx + 1).trim()

  const antecedentParts = antecedentStr.split('∧').map(p => p.trim()).filter(Boolean)
  const antecedent = antecedentParts.map(parseAtom).filter(Boolean)
  const consequent = parseAtom(consequentStr)

  if (!consequent) {
    throw new Error('Failed to parse consequent: ' + consequentStr)
  }
  if (antecedent.length === 0) {
    throw new Error('Rule must have at least one antecedent atom')
  }

  return { antecedent, consequent }
}

/**
 * Convert parsed SWRL atoms into a SPARQL CONSTRUCT query.
 */
function swrlToSparql(antecedent, consequent) {
  const wherePatterns = []
  const filterClauses = []

  for (const atom of antecedent) {
    const { predicate, args } = atom

    if (BUILTIN_COMPARATORS.has(predicate)) {
      const left = args[0]
      const right = args[1]
      const op = FILTER_OP_MAP[predicate]
      filterClauses.push(`FILTER (${left} ${op} ${right})`)
      continue
    }

    if (args.length === 1) {
      // Unary atom: Concept(?x) → ?x rdf:type dd:Concept
      wherePatterns.push(`${args[0]} a <${DD}${predicate}> .`)
    } else if (args.length === 2) {
      // Binary atom: hasProperty(?x, ?v) → ?x dd:hasProperty ?v
      const obj = args[1].startsWith('?') ? args[1] : `"${args[1]}"`
      wherePatterns.push(`${args[0]} <${DD}${predicate}> ${obj} .`)
    }
  }

  // Build CONSTRUCT consequent
  let constructTriple
  if (consequent.args.length === 1) {
    constructTriple = `${consequent.args[0]} a <${DD}${consequent.predicate}> .`
  } else {
    const obj = consequent.args[1].startsWith('?') ? consequent.args[1] : `"${consequent.args[1]}"`
    constructTriple = `${consequent.args[0]} <${DD}${consequent.predicate}> ${obj} .`
  }

  const where = [...wherePatterns, ...filterClauses].join('\n    ')

  return `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX dd: <${DD}>
CONSTRUCT {
    ${constructTriple}
}
WHERE {
    ${where}
}`
}

// ----- Built-in UAV domain rules -----

const BUILTIN_RULES = [
  {
    id: 'builtin-heavy-drone',
    name: 'Heavy Drone Classification',
    body: 'Drone(?x) ∧ weight(?x, ?w) ∧ greaterThan(?w, 25) → HeavyDrone(?x)',
    description: 'Classifies drones with weight exceeding 25 kg as HeavyDrone',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'builtin-long-range',
    name: 'Long Range Drone Classification',
    body: 'Drone(?x) ∧ range(?x, ?r) ∧ greaterThan(?r, 50) → LongRangeDrone(?x)',
    description: 'Classifies drones with range exceeding 50 km as LongRangeDrone',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'builtin-military',
    name: 'Military Drone Classification',
    body: 'Drone(?x) ∧ hasWeapon(?x, ?w) → MilitaryDrone(?x)',
    description: 'Classifies drones with weapons as MilitaryDrone',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'builtin-commercial',
    name: 'Commercial Drone Classification',
    body: 'Drone(?x) ∧ hasPayload(?x, ?p) ∧ hasCamera(?x, ?c) → CommercialDrone(?x)',
    description: 'Classifies drones with payload and camera as CommercialDrone',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'builtin-autonomous',
    name: 'Autonomous Drone Classification',
    body: 'Drone(?x) ∧ hasAutopilot(?x, ?a) ∧ hasGPS(?x, ?g) → AutonomousDrone(?x)',
    description: 'Classifies drones with autopilot and GPS as AutonomousDrone',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
]

class SwrlService {
  constructor() {
    this.rules = [...BUILTIN_RULES]
    logger.info('[SwrlService] Initialized with %d built-in rules', BUILTIN_RULES.length)
  }

  /**
   * List all registered rules.
   */
  listRules() {
    return this.rules.map(r => ({ ...r }))
  }

  /**
   * Get a single rule by id.
   */
  getRule(id) {
    const rule = this.rules.find(r => r.id === id)
    return rule ? { ...rule } : null
  }

  /**
   * Add a new user-defined rule.
   * @param {{ name: string, body: string, description?: string }} rule
   */
  addRule(rule) {
    if (!rule.name || !rule.body) {
      throw new Error('Rule must have a name and body')
    }

    // Validate parsing
    parseSwrlBody(rule.body)

    const entry = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: rule.name,
      body: rule.body,
      description: rule.description || '',
      createdAt: new Date().toISOString(),
    }

    this.rules.push(entry)
    logger.info('[SwrlService] Added rule: %s (%s)', entry.name, entry.id)
    return { ...entry }
  }

  /**
   * Delete a rule by id. Built-in rules can also be removed.
   */
  deleteRule(id) {
    const idx = this.rules.findIndex(r => r.id === id)
    if (idx === -1) return false

    const removed = this.rules.splice(idx, 1)[0]
    logger.info('[SwrlService] Deleted rule: %s (%s)', removed.name, removed.id)
    return true
  }

  /**
   * Execute a rule by id — convert to SPARQL CONSTRUCT, run against the RDF store,
   * and return inferred triples.
   */
  async executeRule(id) {
    const rule = this.rules.find(r => r.id === id)
    if (!rule) {
      throw new Error(`Rule not found: ${id}`)
    }

    logger.info('[SwrlService] Executing rule: %s (%s)', rule.name, rule.id)

    const { antecedent, consequent } = parseSwrlBody(rule.body)
    const sparql = swrlToSparql(antecedent, consequent)

    logger.debug('[SwrlService] Generated SPARQL:\n%s', sparql)

    const rdfService = getRdfGraphService()
    const result = await rdfService.executeSparql(sparql)

    logger.info('[SwrlService] Rule %s produced %d inferred triples in %dms',
      rule.name, result.results.length, result.stats.timeMs)

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      sparql,
      inferred: result.results,
      stats: result.stats,
    }
  }
}

let instance = null

export function getSwrlService() {
  if (!instance) {
    instance = new SwrlService()
  }
  return instance
}

export default SwrlService
