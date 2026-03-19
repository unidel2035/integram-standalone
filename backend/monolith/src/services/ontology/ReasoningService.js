/**
 * ReasoningService — Forward-chaining OWL/RDFS/SKOS rule engine
 *
 * Implements:
 * - RDFS: subClassOf transitivity, domain/range inference
 * - OWL: inverseOf, TransitiveProperty, SymmetricProperty
 * - SKOS: broader↔narrower, related symmetry
 */

import N3 from 'n3'
import { getRdfGraphService, PREFIXES } from './RdfGraphService.js'
import logger from '../../utils/logger.js'

const { DataFactory, Store } = N3
const { namedNode } = DataFactory

const MAX_ITERATIONS = 100
const MAX_NEW_TRIPLES = 10000

const RULES = [
  {
    id: 'rdfs-subclass-transitivity',
    name: 'RDFS subClassOf Transitivity',
    description: 'If A rdfs:subClassOf B and B rdfs:subClassOf C, then A rdfs:subClassOf C',
    category: 'RDFS',
    enabled: true,
  },
  {
    id: 'skos-broader-narrower',
    name: 'SKOS broader↔narrower',
    description: 'If A skos:broader B, then B skos:narrower A',
    category: 'SKOS',
    enabled: true,
  },
  {
    id: 'skos-broader-transitivity',
    name: 'SKOS broader Transitivity',
    description: 'If A skos:broader B and B skos:broader C, then A skos:broader C',
    category: 'SKOS',
    enabled: true,
  },
  {
    id: 'skos-related-symmetry',
    name: 'SKOS related Symmetry',
    description: 'If A skos:related B, then B skos:related A',
    category: 'SKOS',
    enabled: true,
  },
  {
    id: 'owl-inverse',
    name: 'OWL inverseOf',
    description: 'If P owl:inverseOf Q and A P B, then B Q A',
    category: 'OWL',
    enabled: true,
  },
  {
    id: 'owl-symmetric',
    name: 'OWL SymmetricProperty',
    description: 'If P is owl:SymmetricProperty and A P B, then B P A',
    category: 'OWL',
    enabled: true,
  },
  {
    id: 'owl-transitive',
    name: 'OWL TransitiveProperty',
    description: 'If P is owl:TransitiveProperty and A P B and B P C, then A P C',
    category: 'OWL',
    enabled: true,
  },
  {
    id: 'rdfs-domain',
    name: 'RDFS domain inference',
    description: 'If P rdfs:domain C and A P B, then A rdf:type C',
    category: 'RDFS',
    enabled: true,
  },
  {
    id: 'rdfs-range',
    name: 'RDFS range inference',
    description: 'If P rdfs:range C and A P B, then B rdf:type C',
    category: 'RDFS',
    enabled: true,
  },
]

class ReasoningService {
  constructor() {
    this.rules = RULES.map(r => ({ ...r }))
    this.lastInferred = []
    this.inferenceLog = []
  }

  async infer(store) {
    const rdfStore = store || await getRdfGraphService().getStore()
    const start = Date.now()
    const inferred = []
    let totalAdded = 0
    let iterations = 0

    const addIfNew = (s, p, o, ruleId) => {
      if (!rdfStore.has(s, p, o) && totalAdded < MAX_NEW_TRIPLES) {
        rdfStore.addQuad(s, p, o)
        const triple = {
          subject: s.value,
          predicate: p.value,
          object: o.value,
          rule: ruleId,
        }
        inferred.push(triple)
        totalAdded++
        return true
      }
      return false
    }

    const enabledRules = this.rules.filter(r => r.enabled)

    for (iterations = 0; iterations < MAX_ITERATIONS; iterations++) {
      let addedThisIteration = 0

      for (const rule of enabledRules) {
        switch (rule.id) {
          case 'rdfs-subclass-transitivity': {
            const subClassPred = namedNode(`${PREFIXES.rdfs}subClassOf`)
            const quads = rdfStore.getQuads(null, subClassPred, null, null)
            for (const q1 of quads) {
              const q2s = rdfStore.getQuads(q1.object, subClassPred, null, null)
              for (const q2 of q2s) {
                if (addIfNew(q1.subject, subClassPred, q2.object, rule.id)) addedThisIteration++
              }
            }
            break
          }

          case 'skos-broader-narrower': {
            const broaderPred = namedNode(`${PREFIXES.skos}broader`)
            const narrowerPred = namedNode(`${PREFIXES.skos}narrower`)
            const quads = rdfStore.getQuads(null, broaderPred, null, null)
            for (const q of quads) {
              if (addIfNew(q.object, narrowerPred, q.subject, rule.id)) addedThisIteration++
            }
            // Reverse too
            const nQuads = rdfStore.getQuads(null, narrowerPred, null, null)
            for (const q of nQuads) {
              if (addIfNew(q.object, broaderPred, q.subject, rule.id)) addedThisIteration++
            }
            break
          }

          case 'skos-broader-transitivity': {
            const broaderPred = namedNode(`${PREFIXES.skos}broader`)
            const quads = rdfStore.getQuads(null, broaderPred, null, null)
            for (const q1 of quads) {
              const q2s = rdfStore.getQuads(q1.object, broaderPred, null, null)
              for (const q2 of q2s) {
                if (addIfNew(q1.subject, broaderPred, q2.object, rule.id)) addedThisIteration++
              }
            }
            break
          }

          case 'skos-related-symmetry': {
            const relatedPred = namedNode(`${PREFIXES.skos}related`)
            const quads = rdfStore.getQuads(null, relatedPred, null, null)
            for (const q of quads) {
              if (addIfNew(q.object, relatedPred, q.subject, rule.id)) addedThisIteration++
            }
            break
          }

          case 'owl-inverse': {
            const inversePred = namedNode(`${PREFIXES.owl}inverseOf`)
            const inverseQuads = rdfStore.getQuads(null, inversePred, null, null)
            for (const inv of inverseQuads) {
              const p = inv.subject
              const q = inv.object
              const pQuads = rdfStore.getQuads(null, p, null, null)
              for (const pq of pQuads) {
                if (addIfNew(pq.object, q, pq.subject, rule.id)) addedThisIteration++
              }
            }
            break
          }

          case 'owl-symmetric': {
            const symType = namedNode(`${PREFIXES.owl}SymmetricProperty`)
            const typePred = namedNode(`${PREFIXES.rdf}type`)
            const symProps = rdfStore.getQuads(null, typePred, symType, null)
            for (const sp of symProps) {
              const prop = sp.subject
              const quads = rdfStore.getQuads(null, prop, null, null)
              for (const q of quads) {
                if (addIfNew(q.object, prop, q.subject, rule.id)) addedThisIteration++
              }
            }
            break
          }

          case 'owl-transitive': {
            const transType = namedNode(`${PREFIXES.owl}TransitiveProperty`)
            const typePred = namedNode(`${PREFIXES.rdf}type`)
            const transProps = rdfStore.getQuads(null, typePred, transType, null)
            for (const tp of transProps) {
              const prop = tp.subject
              const quads = rdfStore.getQuads(null, prop, null, null)
              for (const q1 of quads) {
                const q2s = rdfStore.getQuads(q1.object, prop, null, null)
                for (const q2 of q2s) {
                  if (addIfNew(q1.subject, prop, q2.object, rule.id)) addedThisIteration++
                }
              }
            }
            break
          }

          case 'rdfs-domain': {
            const domainPred = namedNode(`${PREFIXES.rdfs}domain`)
            const typePred = namedNode(`${PREFIXES.rdf}type`)
            const domainQuads = rdfStore.getQuads(null, domainPred, null, null)
            for (const dq of domainQuads) {
              const prop = dq.subject
              const cls = dq.object
              const propQuads = rdfStore.getQuads(null, prop, null, null)
              for (const pq of propQuads) {
                if (addIfNew(pq.subject, typePred, cls, rule.id)) addedThisIteration++
              }
            }
            break
          }

          case 'rdfs-range': {
            const rangePred = namedNode(`${PREFIXES.rdfs}range`)
            const typePred = namedNode(`${PREFIXES.rdf}type`)
            const rangeQuads = rdfStore.getQuads(null, rangePred, null, null)
            for (const rq of rangeQuads) {
              const prop = rq.subject
              const cls = rq.object
              const propQuads = rdfStore.getQuads(null, prop, null, null)
              for (const pq of propQuads) {
                if (addIfNew(pq.object, typePred, cls, rule.id)) addedThisIteration++
              }
            }
            break
          }
        }
      }

      if (addedThisIteration === 0) break
    }

    this.lastInferred = inferred

    const stats = {
      iterations: iterations + 1,
      triplesAdded: totalAdded,
      storeSize: rdfStore.size,
      timeMs: Date.now() - start,
      rulesApplied: enabledRules.length,
    }

    // Shorten URIs for display
    const shortenUri = (uri) => {
      for (const [prefix, ns] of Object.entries(PREFIXES)) {
        if (uri.startsWith(ns)) return `${prefix}:${uri.slice(ns.length)}`
      }
      return uri
    }

    const displayInferred = inferred.map(t => ({
      subject: shortenUri(t.subject),
      predicate: shortenUri(t.predicate),
      object: shortenUri(t.object),
      rule: t.rule,
    }))

    logger.info(`[ReasoningService] Inferred ${totalAdded} triples in ${iterations + 1} iterations (${stats.timeMs}ms)`)

    return { inferred: displayInferred, stats }
  }

  async explain(triple) {
    const { subject, predicate, object } = triple
    const matching = this.lastInferred.filter(t => {
      const matchS = t.subject.includes(subject) || subject.includes(t.subject)
      const matchP = t.predicate.includes(predicate) || predicate.includes(t.predicate)
      const matchO = t.object.includes(object) || object.includes(t.object)
      return matchS && matchP && matchO
    })

    if (matching.length === 0) {
      return { found: false, message: 'Triple not found in last inference run. Run inference first.' }
    }

    const rule = this.rules.find(r => r.id === matching[0].rule)
    return {
      found: true,
      triple: matching[0],
      rule: rule || { id: matching[0].rule, description: 'Unknown rule' },
      chain: [`Applied rule: ${rule?.name || matching[0].rule}`, `Result: ${matching[0].subject} → ${matching[0].predicate} → ${matching[0].object}`],
    }
  }

  async materialize() {
    logger.info(`[ReasoningService] Materializing ${this.lastInferred.length} inferred triples`)
    // Inferred triples are already in the N3.Store from infer()
    // In a full implementation, would also save to Integram
    return { materialized: this.lastInferred.length }
  }

  getRules() {
    return this.rules
  }

  setRuleEnabled(ruleId, enabled) {
    const rule = this.rules.find(r => r.id === ruleId)
    if (rule) rule.enabled = enabled
  }
}

let instance = null

export function getReasoningService() {
  if (!instance) {
    instance = new ReasoningService()
  }
  return instance
}

export default ReasoningService
