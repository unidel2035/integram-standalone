/**
 * ShaclService — SHACL validation for ontology quality
 *
 * Default shapes enforce SKOS best practices:
 * - Concepts must have prefLabel
 * - Notation format validation
 * - Multilingual label checks
 * - Relation integrity
 */

import { getRdfGraphService, PREFIXES } from './RdfGraphService.js'
import logger from '../../utils/logger.js'

const SEVERITY = {
  VIOLATION: 'Violation',
  WARNING: 'Warning',
  INFO: 'Info',
}

class ShaclService {
  constructor() {
    this.customShapesTurtle = null
  }

  async validate(store) {
    const rdfStore = store || await getRdfGraphService().getStore()
    const violations = []

    // Get all concepts
    const concepts = rdfStore.getQuads(null,
      { termType: 'NamedNode', value: `${PREFIXES.rdf}type` },
      { termType: 'NamedNode', value: `${PREFIXES.skos}Concept` },
      null
    )

    for (const conceptQuad of concepts) {
      const node = conceptQuad.subject
      const nodeId = node.value

      // Extract a human-readable label
      const labelQuads = rdfStore.getQuads(node,
        { termType: 'NamedNode', value: `${PREFIXES.skos}prefLabel` },
        null, null
      )
      const ruLabel = labelQuads.find(q => q.object.language === 'ru')
      const enLabel = labelQuads.find(q => q.object.language === 'en')
      const anyLabel = labelQuads[0]
      const displayLabel = (ruLabel || anyLabel)?.object?.value || nodeId

      // Shape 1: Must have at least one prefLabel
      if (labelQuads.length === 0) {
        violations.push({
          focusNode: nodeId,
          focusNodeLabel: displayLabel,
          path: 'skos:prefLabel',
          severity: SEVERITY.VIOLATION,
          message: 'Concept must have at least one skos:prefLabel',
          shape: 'ConceptLabelShape',
        })
      }

      // Shape 2: Should have Russian label
      if (!ruLabel) {
        violations.push({
          focusNode: nodeId,
          focusNodeLabel: displayLabel,
          path: 'skos:prefLabel@ru',
          severity: SEVERITY.VIOLATION,
          message: 'Concept should have a Russian label (prefLabel@ru)',
          shape: 'RussianLabelShape',
        })
      }

      // Shape 3: Should have English label (warning)
      if (!enLabel) {
        violations.push({
          focusNode: nodeId,
          focusNodeLabel: displayLabel,
          path: 'skos:prefLabel@en',
          severity: SEVERITY.WARNING,
          message: 'Concept should have an English label (prefLabel@en)',
          shape: 'EnglishLabelShape',
        })
      }

      // Shape 4: Notation format check
      const notationQuads = rdfStore.getQuads(node,
        { termType: 'NamedNode', value: `${PREFIXES.skos}notation` },
        null, null
      )
      for (const nq of notationQuads) {
        const notation = nq.object.value
        if (!/^[a-z][a-z0-9_]*:[a-zA-Z0-9_.-]+$/.test(notation)) {
          violations.push({
            focusNode: nodeId,
            focusNodeLabel: displayLabel,
            path: 'skos:notation',
            severity: SEVERITY.WARNING,
            message: `Notation "${notation}" should match pattern "prefix:localName"`,
            shape: 'NotationFormatShape',
          })
        }
      }

      // Shape 5: Should have definition (info)
      const defQuads = rdfStore.getQuads(node,
        { termType: 'NamedNode', value: `${PREFIXES.skos}definition` },
        null, null
      )
      if (defQuads.length === 0) {
        violations.push({
          focusNode: nodeId,
          focusNodeLabel: displayLabel,
          path: 'skos:definition',
          severity: SEVERITY.INFO,
          message: 'Concept should have a definition',
          shape: 'DefinitionShape',
        })
      }
    }

    // Shape 6: Relation integrity — check broader targets exist
    const broaderQuads = rdfStore.getQuads(null,
      { termType: 'NamedNode', value: `${PREFIXES.skos}broader` },
      null, null
    )
    const conceptUris = new Set(concepts.map(q => q.subject.value))

    for (const bq of broaderQuads) {
      if (!conceptUris.has(bq.object.value)) {
        const srcLabels = rdfStore.getQuads(bq.subject,
          { termType: 'NamedNode', value: `${PREFIXES.skos}prefLabel` }, null, null)
        const srcLabel = srcLabels[0]?.object?.value || bq.subject.value

        violations.push({
          focusNode: bq.subject.value,
          focusNodeLabel: srcLabel,
          path: 'skos:broader',
          severity: SEVERITY.VIOLATION,
          message: `Broader target ${bq.object.value} does not exist as a Concept`,
          shape: 'RelationIntegrityShape',
        })
      }
    }

    const conforms = violations.filter(v => v.severity === SEVERITY.VIOLATION).length === 0

    const summary = {
      violations: violations.filter(v => v.severity === SEVERITY.VIOLATION).length,
      warnings: violations.filter(v => v.severity === SEVERITY.WARNING).length,
      infos: violations.filter(v => v.severity === SEVERITY.INFO).length,
      totalConcepts: concepts.length,
    }

    logger.info(`[ShaclService] Validation: conforms=${conforms}, violations=${summary.violations}, warnings=${summary.warnings}`)

    return { conforms, violations, summary }
  }

  getShapes() {
    return {
      builtIn: [
        { id: 'ConceptLabelShape', description: 'Every concept must have at least one prefLabel', severity: SEVERITY.VIOLATION },
        { id: 'RussianLabelShape', description: 'Every concept should have prefLabel@ru', severity: SEVERITY.VIOLATION },
        { id: 'EnglishLabelShape', description: 'Every concept should have prefLabel@en', severity: SEVERITY.WARNING },
        { id: 'NotationFormatShape', description: 'Notation should match prefix:localName pattern', severity: SEVERITY.WARNING },
        { id: 'DefinitionShape', description: 'Every concept should have a definition', severity: SEVERITY.INFO },
        { id: 'RelationIntegrityShape', description: 'Relation targets must exist', severity: SEVERITY.VIOLATION },
      ],
      custom: this.customShapesTurtle,
    }
  }

  setCustomShapes(turtle) {
    this.customShapesTurtle = turtle
    logger.info('[ShaclService] Custom shapes updated')
  }
}

let instance = null

export function getShaclService() {
  if (!instance) {
    instance = new ShaclService()
  }
  return instance
}

export default ShaclService
