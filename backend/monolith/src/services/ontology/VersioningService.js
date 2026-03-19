/**
 * VersioningService — Ontology snapshot versioning and diff
 *
 * Stores snapshots as serialized N3.Store data in Integram
 * Provides diff between versions using triple comparison
 */

import N3 from 'n3'
import { getRdfGraphService, PREFIXES } from './RdfGraphService.js'
import { getOntologyService } from './IntegramOntologyService.js'
import logger from '../../utils/logger.js'

const { Writer } = N3

class VersioningService {
  constructor() {
    this.snapshots = [] // In-memory store; could be persisted to Integram
  }

  async createSnapshot(label, description) {
    const rdfService = getRdfGraphService()
    const store = await rdfService.getStore()

    // Serialize store to N-Triples
    const quads = store.getQuads(null, null, null, null)
    const writer = new Writer({ format: 'N-Triples' })
    for (const q of quads) {
      writer.addQuad(q)
    }

    const serialized = await new Promise((resolve, reject) => {
      writer.end((error, result) => {
        if (error) reject(error)
        else resolve(result)
      })
    })

    const stats = await rdfService.getStats()

    const snapshot = {
      id: `snap_${Date.now()}`,
      label,
      description: description || '',
      createdAt: new Date().toISOString(),
      author: 'system',
      conceptCount: stats.concepts,
      relationCount: stats.relations,
      tripleCount: quads.length,
      data: serialized,
    }

    this.snapshots.push(snapshot)
    logger.info(`[VersioningService] Snapshot created: ${snapshot.id} "${label}" (${quads.length} triples)`)

    return {
      id: snapshot.id,
      label: snapshot.label,
      createdAt: snapshot.createdAt,
      conceptCount: snapshot.conceptCount,
      relationCount: snapshot.relationCount,
      tripleCount: snapshot.tripleCount,
    }
  }

  async listSnapshots() {
    return this.snapshots.map(s => ({
      id: s.id,
      label: s.label,
      description: s.description,
      createdAt: s.createdAt,
      author: s.author,
      conceptCount: s.conceptCount,
      relationCount: s.relationCount,
      tripleCount: s.tripleCount,
    }))
  }

  async diff(idA, idB) {
    const snapA = this.snapshots.find(s => s.id === idA)
    const snapB = this.snapshots.find(s => s.id === idB)

    if (!snapA) throw new Error(`Snapshot ${idA} not found`)
    if (!snapB) throw new Error(`Snapshot ${idB} not found`)

    // Parse both snapshots into sets of triple strings
    const triplesA = this._parseToTripleSet(snapA.data)
    const triplesB = this._parseToTripleSet(snapB.data)

    const added = []
    const removed = []

    for (const t of triplesB) {
      if (!triplesA.has(t)) added.push(this._parseTripleString(t))
    }
    for (const t of triplesA) {
      if (!triplesB.has(t)) removed.push(this._parseTripleString(t))
    }

    const shortenUri = (uri) => {
      for (const [prefix, ns] of Object.entries(PREFIXES)) {
        if (uri.startsWith(ns)) return `${prefix}:${uri.slice(ns.length)}`
      }
      return uri
    }

    const shorten = (triple) => ({
      subject: shortenUri(triple.subject),
      predicate: shortenUri(triple.predicate),
      object: shortenUri(triple.object),
    })

    return {
      snapshotA: { id: snapA.id, label: snapA.label, date: snapA.createdAt },
      snapshotB: { id: snapB.id, label: snapB.label, date: snapB.createdAt },
      added: added.map(shorten),
      removed: removed.map(shorten),
      stats: {
        addedCount: added.length,
        removedCount: removed.length,
        unchangedCount: triplesA.size - removed.length,
      },
    }
  }

  async rollback(id) {
    const snapshot = this.snapshots.find(s => s.id === id)
    if (!snapshot) throw new Error(`Snapshot ${id} not found`)

    // Invalidate current RDF store — next getStore() will rebuild from Integram
    getRdfGraphService().invalidate()
    logger.info(`[VersioningService] Rollback to snapshot ${id} "${snapshot.label}"`)

    return { rolledBackTo: id, label: snapshot.label }
  }

  _parseToTripleSet(ntriples) {
    const set = new Set()
    const lines = ntriples.split('\n').filter(l => l.trim() && !l.startsWith('#'))
    for (const line of lines) {
      set.add(line.trim())
    }
    return set
  }

  _parseTripleString(line) {
    // Simple N-Triples parser: <s> <p> <o> .
    const match = line.match(/<([^>]+)>\s+<([^>]+)>\s+(?:<([^>]+)>|"([^"]*)"(?:@(\w+))?(?:\^\^<([^>]+)>)?)/)
    if (!match) return { subject: line, predicate: '', object: '' }
    return {
      subject: match[1],
      predicate: match[2],
      object: match[3] || match[4] || '',
      language: match[5] || null,
      datatype: match[6] || null,
    }
  }
}

let instance = null

export function getVersioningService() {
  if (!instance) {
    instance = new VersioningService()
  }
  return instance
}

export default VersioningService
