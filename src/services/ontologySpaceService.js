/**
 * Ontology Space Service (Issue #7201)
 *
 * Unified API service for all ontology tables in kval.
 * Provides global search across all ontologies and CRUD for concepts/relations.
 *
 * Tables:
 *   1673250 — Онтология БПЛА (основные концепты)
 *   1673287 — Связи онтологии (рёбра графа)
 *   1673242 — Тип связи (метаданные рёбер)
 *   1708619 — Событийная онтология
 *   1708645 — Связи СО
 *   1709562 — СОД Концепты
 *   1731380 — Дроны
 *   1731375 — Производители БПЛА
 *   1731606 — Применения БПЛА
 */

import axios from 'axios'

const API_BASE = '/api/ontology'

// kval table IDs for each ontology section
export const ONTOLOGY_TABLES = {
  bpla: { id: 1673250, name: 'Онтология БПЛА', icon: 'pi pi-sitemap', color: '#6366f1' },
  relations: { id: 1673287, name: 'Связи онтологии', icon: 'pi pi-share-alt', color: '#8b5cf6' },
  relationType: { id: 1673242, name: 'Тип связи', icon: 'pi pi-tag', color: '#a78bfa' },
  events: { id: 1708619, name: 'Событийная онтология', icon: 'pi pi-calendar', color: '#f59e0b' },
  eventRelations: { id: 1708645, name: 'Связи СО', icon: 'pi pi-arrows-h', color: '#fbbf24' },
  sod: { id: 1709562, name: 'СОД Концепты', icon: 'pi pi-book', color: '#10b981' },
  drones: { id: 1731380, name: 'Дроны', icon: 'pi pi-send', color: '#3b82f6' },
  manufacturers: { id: 1731375, name: 'Производители БПЛА', icon: 'pi pi-building', color: '#06b6d4' },
  applications: { id: 1731606, name: 'Применения БПЛА', icon: 'pi pi-th-large', color: '#14b8a6' },
}

/**
 * Get all concepts from a specific ontology
 * @param {string} section - ontology section key from ONTOLOGY_TABLES
 * @param {Object} params - optional query params
 */
export async function getConcepts(section, params = {}) {
  const tableId = ONTOLOGY_TABLES[section]?.id
  if (!tableId) throw new Error(`Unknown ontology section: ${section}`)

  try {
    const res = await axios.get(`${API_BASE}/concepts`, {
      params: { typeId: tableId, ...params },
    })
    return res.data
  } catch (err) {
    console.error(`[ontologySpaceService] getConcepts(${section}) failed:`, err)
    throw err
  }
}

/**
 * Get full graph for BPLA ontology (nodes + edges)
 */
export async function getBplaGraph() {
  try {
    const res = await axios.get(`${API_BASE}/graph`)
    return res.data
  } catch (err) {
    console.error('[ontologySpaceService] getBplaGraph failed:', err)
    throw err
  }
}

/**
 * Get relation types
 */
export async function getRelationTypes() {
  try {
    const res = await axios.get(`${API_BASE}/relation-types`)
    return res.data
  } catch (err) {
    console.error('[ontologySpaceService] getRelationTypes failed:', err)
    return []
  }
}

/**
 * Global search across all ontology tables simultaneously
 * @param {string} query - search string
 * @returns {Promise<{results: Array<{section, id, label, label_en, type, domain}>}>}
 */
export async function globalOntologySearch(query) {
  if (!query || query.trim().length < 2) return { results: [] }

  const sections = ['bpla', 'events', 'sod', 'drones']
  const promises = sections.map(async (section) => {
    try {
      const data = await getConcepts(section, { search: query, limit: 20 })
      const items = data.concepts || data.items || data || []
      return items.map((c) => ({
        section,
        sectionName: ONTOLOGY_TABLES[section].name,
        sectionColor: ONTOLOGY_TABLES[section].color,
        sectionIcon: ONTOLOGY_TABLES[section].icon,
        id: c.id,
        label: c.label || c.prefLabel || c.name || c.value || String(c.id),
        label_en: c.label_en || c.prefLabel_en || '',
        notation: c.notation || '',
        domain: c.domain || '',
        description: c.definition || c.description || '',
      }))
    } catch {
      return []
    }
  })

  // Also search via the dedicated search endpoint if available
  let dedicatedResults = []
  try {
    const res = await axios.get(`${API_BASE}/search`, { params: { q: query } })
    dedicatedResults = (res.data.results || []).map((r) => ({
      ...r,
      section: r.section || 'bpla',
      sectionName: ONTOLOGY_TABLES[r.section || 'bpla']?.name || 'Онтология БПЛА',
      sectionColor: ONTOLOGY_TABLES[r.section || 'bpla']?.color || '#6366f1',
      sectionIcon: ONTOLOGY_TABLES[r.section || 'bpla']?.icon || 'pi pi-sitemap',
    }))
  } catch {
    // dedicated search endpoint optional
  }

  const sectionResults = await Promise.all(promises)
  const allResults = dedicatedResults.length > 0
    ? dedicatedResults
    : sectionResults.flat()

  // Deduplicate by id+section
  const seen = new Set()
  const unique = allResults.filter((r) => {
    const key = `${r.section}:${r.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { results: unique }
}

/**
 * Get stats for all ontology sections
 * @returns {Promise<Object>} - { bpla: { count, name }, events: ..., ... }
 */
export async function getOntologyStats() {
  try {
    const res = await axios.get(`${API_BASE}/stats`)
    return res.data
  } catch {
    // Fallback: collect stats individually
    const stats = {}
    for (const [key, meta] of Object.entries(ONTOLOGY_TABLES)) {
      stats[key] = { count: null, name: meta.name }
    }
    return stats
  }
}

/**
 * Get single concept by ID (from BPLA ontology by default)
 */
export async function getConcept(conceptId, section = 'bpla') {
  try {
    const res = await axios.get(`${API_BASE}/concepts/${conceptId}`, {
      params: { typeId: ONTOLOGY_TABLES[section]?.id },
    })
    return res.data.concept || res.data
  } catch (err) {
    console.error(`[ontologySpaceService] getConcept(${conceptId}) failed:`, err)
    throw err
  }
}

/**
 * Get relations for a specific concept
 */
export async function getConceptRelations(conceptId) {
  try {
    const res = await axios.get(`${API_BASE}/relations`, {
      params: { conceptId },
    })
    return res.data.relations || res.data || []
  } catch (err) {
    console.error(`[ontologySpaceService] getConceptRelations(${conceptId}) failed:`, err)
    return []
  }
}

/**
 * Create a concept in the specified section
 */
export async function createConcept(section, conceptData) {
  const tableId = ONTOLOGY_TABLES[section]?.id
  const res = await axios.post(`${API_BASE}/concept`, {
    ...conceptData,
    typeId: tableId,
  })
  return res.data
}

/**
 * Update a concept
 */
export async function updateConcept(conceptId, updates) {
  const res = await axios.put(`${API_BASE}/concepts/${conceptId}`, updates)
  return res.data
}

/**
 * Delete a concept
 */
export async function deleteConcept(conceptId) {
  const res = await axios.delete(`${API_BASE}/concept/${conceptId}`)
  return res.data
}

/**
 * Create a relation between two concepts
 */
export async function createRelation(sourceId, targetId, relationTypeId) {
  const res = await axios.post(`${API_BASE}/link`, {
    sourceId,
    targetId,
    relationTypeId,
  })
  return res.data
}

/**
 * Delete a relation
 */
export async function deleteRelation(relationId) {
  const res = await axios.delete(`${API_BASE}/link/${relationId}`)
  return res.data
}
