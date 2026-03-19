/**
 * RdfGraphService — RDF foundation for SPARQL, SHACL, OWL Reasoning
 *
 * Converts Integram concepts/relations → RDF quads in N3.Store
 * Provides SPARQL execution via Comunica QueryEngine
 */

import N3 from 'n3'
import { QueryEngine } from '@comunica/query-sparql'
import { getOntologyService } from './IntegramOntologyService.js'
import logger from '../../utils/logger.js'

const { DataFactory, Store } = N3
const { namedNode, literal } = DataFactory

const PREFIXES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  dc: 'http://purl.org/dc/elements/1.1/',
  dcterms: 'http://purl.org/dc/terms/',
  dd: 'https://drondoc.ru/ontology/',
}

const SPARQL_PREFIX_HEADER = Object.entries(PREFIXES)
  .map(([k, v]) => `PREFIX ${k}: <${v}>`)
  .join('\n')

const RELATION_TYPE_MAP = {
  is_a: `${PREFIXES.rdfs}subClassOf`,
  part_of: `${PREFIXES.dcterms}hasPart`,
  related: `${PREFIXES.skos}related`,
  broader: `${PREFIXES.skos}broader`,
  narrower: `${PREFIXES.skos}narrower`,
  exact_match: `${PREFIXES.skos}exactMatch`,
  close_match: `${PREFIXES.skos}closeMatch`,
  depends_on: `${PREFIXES.dd}dependsOn`,
  uses: `${PREFIXES.dd}uses`,
  produces: `${PREFIXES.dd}produces`,
  regulates: `${PREFIXES.dd}regulates`,
  implements: `${PREFIXES.dd}implements`,
  requires: `${PREFIXES.dd}requires`,
}

const TTL = 5 * 60 * 1000

class RdfGraphService {
  constructor() {
    this.store = null
    this.engine = new QueryEngine()
    this.lastBuild = null
    this.building = false
    this.conceptCount = 0
    this.relationCount = 0
  }

  async rebuild() {
    if (this.building) return
    this.building = true

    try {
      const svc = getOntologyService()
      await svc.initialize()

      const [concepts, relations] = await Promise.all([
        svc.getConcepts({ limit: 10000 }),
        svc.getAllRelations(),
      ])

      const store = new Store()
      this.conceptCount = concepts.length
      this.relationCount = relations.length

      store.addQuad(
        namedNode(`${PREFIXES.dd}UAVOntology`),
        namedNode(`${PREFIXES.rdf}type`),
        namedNode(`${PREFIXES.owl}Ontology`)
      )

      for (const concept of concepts) {
        const uri = namedNode(`${PREFIXES.dd}concept/${concept.id}`)

        store.addQuad(uri, namedNode(`${PREFIXES.rdf}type`), namedNode(`${PREFIXES.skos}Concept`))
        store.addQuad(uri, namedNode(`${PREFIXES.skos}inScheme`), namedNode(`${PREFIXES.dd}UAVOntology`))

        if (concept.val) {
          store.addQuad(uri, namedNode(`${PREFIXES.skos}prefLabel`), literal(concept.val, 'ru'))
        }

        const reqs = concept.reqs || {}
        for (const [, reqData] of Object.entries(reqs)) {
          const val = typeof reqData === 'object' ? reqData.value : reqData
          if (!val) continue
          const alias = typeof reqData === 'object' ? reqData.alias : ''

          if (alias === 'prefLabel_en' || alias === 'en_label') {
            store.addQuad(uri, namedNode(`${PREFIXES.skos}prefLabel`), literal(val, 'en'))
          } else if (alias === 'prefLabel_zh' || alias === 'zh_label') {
            store.addQuad(uri, namedNode(`${PREFIXES.skos}prefLabel`), literal(val, 'zh'))
          } else if (alias === 'notation') {
            store.addQuad(uri, namedNode(`${PREFIXES.skos}notation`), literal(val))
          } else if (alias === 'definition') {
            store.addQuad(uri, namedNode(`${PREFIXES.skos}definition`), literal(val, 'ru'))
          } else if (alias === 'broader' && reqData.isRef) {
            const broaderId = typeof reqData.value === 'string' && reqData.value.includes(':')
              ? reqData.value.split(':')[1] : reqData.value
            if (broaderId) {
              store.addQuad(uri, namedNode(`${PREFIXES.skos}broader`),
                namedNode(`${PREFIXES.dd}concept/${broaderId}`))
            }
          }
        }
      }

      for (const rel of relations) {
        if (!rel.sourceId || !rel.targetId) continue
        const subject = namedNode(`${PREFIXES.dd}concept/${rel.sourceId}`)
        const object = namedNode(`${PREFIXES.dd}concept/${rel.targetId}`)
        const typeLabel = (rel.typeLabel || 'related').toLowerCase().replace(/\s+/g, '_')
        const predicateUri = RELATION_TYPE_MAP[typeLabel] || `${PREFIXES.dd}${typeLabel}`
        store.addQuad(subject, namedNode(predicateUri), object)
      }

      this.store = store
      this.lastBuild = Date.now()
      logger.info(`[RdfGraphService] Rebuilt: ${concepts.length} concepts, ${relations.length} relations, ${store.size} triples`)
    } catch (error) {
      logger.error('[RdfGraphService] Rebuild failed', error)
      throw error
    } finally {
      this.building = false
    }
  }

  async getStore() {
    if (!this.store || !this.lastBuild || (Date.now() - this.lastBuild) > TTL) {
      await this.rebuild()
    }
    return this.store
  }

  invalidate() {
    this.store = null
    this.lastBuild = null
    logger.info('[RdfGraphService] Cache invalidated')
  }

  async executeSparql(query) {
    const store = await this.getStore()
    const start = Date.now()
    const fullQuery = query.includes('PREFIX') ? query : `${SPARQL_PREFIX_HEADER}\n${query}`

    try {
      const queryType = this._detectQueryType(query)

      if (queryType === 'SELECT') {
        const bindingsStream = await this.engine.queryBindings(fullQuery, { sources: [store] })
        const bindings = await bindingsStream.toArray()
        const variables = bindings.length > 0
          ? [...bindings[0].keys()].map(k => k.value)
          : []

        const results = bindings.map(binding => {
          const row = {}
          for (const v of variables) {
            const term = binding.get(v)
            row[v] = term ? this._termToString(term) : null
          }
          return row
        })

        return {
          type: 'SELECT', variables, results,
          stats: { count: results.length, timeMs: Date.now() - start, storeSize: store.size }
        }
      }

      if (queryType === 'ASK') {
        const result = await this.engine.queryBoolean(fullQuery, { sources: [store] })
        return {
          type: 'ASK', result,
          stats: { timeMs: Date.now() - start, storeSize: store.size }
        }
      }

      if (queryType === 'CONSTRUCT' || queryType === 'DESCRIBE') {
        const quadsStream = await this.engine.queryQuads(fullQuery, { sources: [store] })
        const quads = await quadsStream.toArray()
        const results = quads.map(q => ({
          subject: this._termToString(q.subject),
          predicate: this._termToString(q.predicate),
          object: this._termToString(q.object),
        }))

        return {
          type: queryType, results,
          stats: { count: results.length, timeMs: Date.now() - start, storeSize: store.size }
        }
      }

      throw new Error(`Unsupported query type: ${queryType}`)
    } catch (error) {
      logger.error('[RdfGraphService] SPARQL failed', { query: query.substring(0, 200), error: error.message })
      throw error
    }
  }

  async getStats() {
    const store = await this.getStore()
    return {
      totalTriples: store.size,
      concepts: this.conceptCount,
      relations: this.relationCount,
      lastBuild: this.lastBuild ? new Date(this.lastBuild).toISOString() : null,
    }
  }

  getPrefixes() {
    return { map: PREFIXES, header: SPARQL_PREFIX_HEADER }
  }

  _detectQueryType(query) {
    const cleaned = query.replace(/PREFIX\s+\w+:\s*<[^>]+>\s*/gi, '').trim().toUpperCase()
    if (cleaned.startsWith('SELECT')) return 'SELECT'
    if (cleaned.startsWith('ASK')) return 'ASK'
    if (cleaned.startsWith('CONSTRUCT')) return 'CONSTRUCT'
    if (cleaned.startsWith('DESCRIBE')) return 'DESCRIBE'
    return 'SELECT'
  }

  _termToString(term) {
    if (!term) return null
    if (term.termType === 'NamedNode') {
      for (const [prefix, uri] of Object.entries(PREFIXES)) {
        if (term.value.startsWith(uri)) {
          return `${prefix}:${term.value.slice(uri.length)}`
        }
      }
      return term.value
    }
    if (term.termType === 'Literal') {
      return term.language ? `${term.value}@${term.language}` : term.value
    }
    return term.value
  }
}

let instance = null

export function getRdfGraphService() {
  if (!instance) {
    instance = new RdfGraphService()
  }
  return instance
}

export { PREFIXES, SPARQL_PREFIX_HEADER, RELATION_TYPE_MAP }
export default RdfGraphService
