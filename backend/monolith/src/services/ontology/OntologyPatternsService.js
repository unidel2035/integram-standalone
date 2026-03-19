/**
 * OntologyPatternsService — Ontology Design Patterns library
 *
 * Pre-built patterns: Observation (SSN), Event, Provenance (PROV), Agent, Part-Whole
 */

import { getOntologyService } from './IntegramOntologyService.js'
import logger from '../../utils/logger.js'

const PATTERNS = [
  {
    id: 'observation-ssn',
    name: 'Observation (SSN/SOSA)',
    description: 'Sensor observation pattern: Sensor → Observation → ObservableProperty → Result',
    category: 'IoT/Sensors',
    concepts: [
      { tempId: 'sensor', label: 'Sensor', notation: 'ssn:Sensor', definition: 'Device that observes a property' },
      { tempId: 'observation', label: 'Observation', notation: 'sosa:Observation', definition: 'Act of observing a property' },
      { tempId: 'observable-property', label: 'ObservableProperty', notation: 'sosa:ObservableProperty', definition: 'Quality that can be observed' },
      { tempId: 'result', label: 'Result', notation: 'sosa:Result', definition: 'Output of an observation' },
      { tempId: 'platform', label: 'Platform', notation: 'sosa:Platform', definition: 'Entity hosting sensors (e.g. drone)' },
    ],
    relations: [
      { source: 'sensor', target: 'observation', type: 'produces' },
      { source: 'observation', target: 'observable-property', type: 'related' },
      { source: 'observation', target: 'result', type: 'produces' },
      { source: 'platform', target: 'sensor', type: 'part_of' },
    ],
  },
  {
    id: 'event-pattern',
    name: 'Event Pattern',
    description: 'Temporal event: Event → Agent, Place, Time, Outcome',
    category: 'Temporal',
    concepts: [
      { tempId: 'event', label: 'Event', notation: 'event:Event', definition: 'Something that happens at a time and place' },
      { tempId: 'agent', label: 'Agent', notation: 'event:Agent', definition: 'Entity participating in the event' },
      { tempId: 'place', label: 'Place', notation: 'event:Place', definition: 'Location of the event' },
      { tempId: 'time-interval', label: 'TimeInterval', notation: 'event:TimeInterval', definition: 'Duration of the event' },
      { tempId: 'outcome', label: 'Outcome', notation: 'event:Outcome', definition: 'Result of the event' },
    ],
    relations: [
      { source: 'event', target: 'agent', type: 'related' },
      { source: 'event', target: 'place', type: 'related' },
      { source: 'event', target: 'time-interval', type: 'related' },
      { source: 'event', target: 'outcome', type: 'produces' },
    ],
  },
  {
    id: 'provenance-prov',
    name: 'Provenance (PROV-O)',
    description: 'Data lineage: Entity → Activity → Agent, with generation and usage',
    category: 'Data Management',
    concepts: [
      { tempId: 'entity', label: 'Entity', notation: 'prov:Entity', definition: 'Physical or digital thing' },
      { tempId: 'activity', label: 'Activity', notation: 'prov:Activity', definition: 'Process that creates or transforms entities' },
      { tempId: 'prov-agent', label: 'Agent', notation: 'prov:Agent', definition: 'Entity responsible for an activity' },
      { tempId: 'plan', label: 'Plan', notation: 'prov:Plan', definition: 'Set of instructions for an activity' },
    ],
    relations: [
      { source: 'entity', target: 'activity', type: 'related' },
      { source: 'activity', target: 'prov-agent', type: 'related' },
      { source: 'activity', target: 'plan', type: 'uses' },
      { source: 'activity', target: 'entity', type: 'produces' },
    ],
  },
  {
    id: 'agent-pattern',
    name: 'Agent Pattern',
    description: 'AI/Human agent: Agent → Capability, Goal, Task, Role',
    category: 'AI/Agents',
    concepts: [
      { tempId: 'ai-agent', label: 'Agent', notation: 'agent:Agent', definition: 'Autonomous entity (AI or human)' },
      { tempId: 'capability', label: 'Capability', notation: 'agent:Capability', definition: 'What the agent can do' },
      { tempId: 'goal', label: 'Goal', notation: 'agent:Goal', definition: 'Desired outcome' },
      { tempId: 'task', label: 'Task', notation: 'agent:Task', definition: 'Unit of work' },
      { tempId: 'role', label: 'Role', notation: 'agent:Role', definition: 'Function within a system' },
    ],
    relations: [
      { source: 'ai-agent', target: 'capability', type: 'related' },
      { source: 'ai-agent', target: 'goal', type: 'related' },
      { source: 'ai-agent', target: 'task', type: 'produces' },
      { source: 'ai-agent', target: 'role', type: 'is_a' },
    ],
  },
  {
    id: 'part-whole',
    name: 'Part-Whole (Mereology)',
    description: 'Decomposition: Whole → Part → SubPart, with composition types',
    category: 'Structural',
    concepts: [
      { tempId: 'whole', label: 'Whole', notation: 'mereology:Whole', definition: 'Composite entity' },
      { tempId: 'part', label: 'Part', notation: 'mereology:Part', definition: 'Component of a whole' },
      { tempId: 'sub-part', label: 'SubPart', notation: 'mereology:SubPart', definition: 'Component of a part' },
      { tempId: 'composition-type', label: 'CompositionType', notation: 'mereology:CompositionType', definition: 'Type of part-whole relation' },
    ],
    relations: [
      { source: 'whole', target: 'part', type: 'part_of' },
      { source: 'part', target: 'sub-part', type: 'part_of' },
      { source: 'part', target: 'composition-type', type: 'is_a' },
    ],
  },
]

class OntologyPatternsService {
  constructor() {
    this.patterns = PATTERNS
  }

  getPatterns() {
    return this.patterns.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      conceptCount: p.concepts.length,
      relationCount: p.relations.length,
      concepts: p.concepts.map(c => ({ label: c.label, notation: c.notation })),
      relations: p.relations.map(r => ({
        source: p.concepts.find(c => c.tempId === r.source)?.label,
        target: p.concepts.find(c => c.tempId === r.target)?.label,
        type: r.type,
      })),
    }))
  }

  async applyPattern(patternId) {
    const pattern = this.patterns.find(p => p.id === patternId)
    if (!pattern) throw new Error(`Pattern ${patternId} not found`)

    const svc = getOntologyService()
    await svc.initialize()

    const tempIdToRealId = {}
    const created = []

    // Create concepts
    for (const concept of pattern.concepts) {
      try {
        const result = await svc.createConcept({
          label: concept.label,
          notation: concept.notation,
          definition: concept.definition,
        })
        tempIdToRealId[concept.tempId] = result.id
        created.push({ tempId: concept.tempId, realId: result.id, label: concept.label })
      } catch (error) {
        logger.warn(`[PatternsService] Failed to create concept ${concept.label}:`, error.message)
      }
    }

    // Create relations
    const createdRelations = []
    for (const rel of pattern.relations) {
      const sourceId = tempIdToRealId[rel.source]
      const targetId = tempIdToRealId[rel.target]
      if (!sourceId || !targetId) continue

      try {
        await svc.createRelation(sourceId, targetId, rel.type)
        createdRelations.push({
          source: rel.source,
          target: rel.target,
          type: rel.type,
        })
      } catch (error) {
        logger.warn(`[PatternsService] Failed to create relation:`, error.message)
      }
    }

    // Invalidate RDF cache
    const { getRdfGraphService } = await import('./RdfGraphService.js')
    getRdfGraphService().invalidate()

    logger.info(`[PatternsService] Applied pattern "${pattern.name}": ${created.length} concepts, ${createdRelations.length} relations`)

    return {
      pattern: pattern.name,
      conceptsCreated: created.length,
      relationsCreated: createdRelations.length,
      concepts: created,
      relations: createdRelations,
    }
  }
}

let instance = null

export function getOntologyPatternsService() {
  if (!instance) {
    instance = new OntologyPatternsService()
  }
  return instance
}

export default OntologyPatternsService
