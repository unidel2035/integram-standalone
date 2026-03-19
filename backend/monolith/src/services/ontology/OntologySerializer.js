/**
 * OntologySerializer — Export ontology in professional formats
 * Supports: Turtle (.ttl), RDF/XML, N-Triples, OWL/XML
 * Compatible with Protege and other ontology tools
 */

import { getOntologyService } from './IntegramOntologyService.js'

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

export class OntologySerializer {
  constructor() {
    this.baseURI = 'https://drondoc.ru/ontology/'
  }

  async loadData() {
    const svc = getOntologyService()
    await svc.initialize()
    const concepts = await svc.getConcepts({ limit: 10000 })
    const relations = await svc.getAllRelations()

    const g = (c, alias) => {
      for (const r of Object.values(c.reqs || {})) {
        if (r.alias === alias || r.name === alias) return r.value || ''
      }
      return ''
    }

    return {
      nodes: concepts.map(c => ({
        id: c.id, name_ru: c.val || '', name_en: g(c, 'prefLabel_en'), name_zh: g(c, 'prefLabel_zh'),
        altLabels_en: g(c, 'altLabels_en'), altLabels_zh: g(c, 'altLabels_zh'),
        notation: g(c, 'notation'), definition: g(c, 'definition'),
        exactMatch: g(c, 'exactMatch'), broaderId: c.up > 1 ? c.up : null,
      })),
      edges: relations.map(r => ({ id: r.id, sourceId: r.sourceId, targetId: r.targetId, type: r.typeLabel || 'related' })),
    }
  }

  _et(s) { return !s ? '' : s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '') }
  _ex(s) { return !s ? '' : s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

  async toTurtle() {
    const { nodes, edges } = await this.loadData()
    const L = []
    for (const [p, u] of Object.entries(PREFIXES)) L.push(`@prefix ${p}: <${u}> .`)
    L.push('', `<${this.baseURI}> a owl:Ontology ;`, `    dc:title "DronDoc UAV Ontology"@en ;`,
      `    dc:title "Онтология БПЛА DronDoc"@ru ;`, `    dcterms:created "${new Date().toISOString().split('T')[0]}"^^xsd:date .`, '')

    for (const n of nodes) {
      const u = `dd:concept_${n.id}`, t = [`${u} a skos:Concept`]
      if (n.name_ru) t.push(`    skos:prefLabel "${this._et(n.name_ru)}"@ru`)
      if (n.name_en) t.push(`    skos:prefLabel "${this._et(n.name_en)}"@en`)
      if (n.name_zh) t.push(`    skos:prefLabel "${this._et(n.name_zh)}"@zh`)
      if (n.altLabels_en) t.push(`    skos:altLabel "${this._et(n.altLabels_en)}"@en`)
      if (n.altLabels_zh) t.push(`    skos:altLabel "${this._et(n.altLabels_zh)}"@zh`)
      if (n.notation) t.push(`    skos:notation "${this._et(n.notation)}"`)
      if (n.definition) t.push(`    skos:definition "${this._et(n.definition)}"@ru`)
      if (n.exactMatch) t.push(`    skos:exactMatch <${n.exactMatch}>`)
      if (n.broaderId) t.push(`    skos:broader dd:concept_${n.broaderId}`)
      L.push(t.join(' ;\n') + ' .', '')
    }

    const RM = { uses:'dd:uses', part_of:'dd:partOf', hasComponent:'dd:hasComponent', hasMission:'dd:hasMission',
      related:'skos:related', broader:'skos:broader', is_a:'skos:broader', exactMatch:'skos:exactMatch',
      closeMatch:'skos:closeMatch', relatedMatch:'skos:relatedMatch', appliedIn:'dd:appliedIn', enables:'dd:enables' }
    for (const e of edges) L.push(`dd:concept_${e.sourceId} ${RM[e.type] || `dd:${e.type}`} dd:concept_${e.targetId} .`)
    return L.join('\n')
  }

  async toRdfXml() {
    const { nodes } = await this.loadData()
    const L = ['<?xml version="1.0" encoding="UTF-8"?>', '<rdf:RDF']
    for (const [p, u] of Object.entries(PREFIXES)) L.push(`    xmlns:${p}="${u}"`)
    L.push('>', '', `  <owl:Ontology rdf:about="${this.baseURI}">`,
      `    <dc:title xml:lang="en">DronDoc UAV Ontology</dc:title>`,
      `    <dc:title xml:lang="ru">Онтология БПЛА DronDoc</dc:title>`, `  </owl:Ontology>`, '')

    for (const n of nodes) {
      L.push(`  <skos:Concept rdf:about="${this.baseURI}concept/${n.id}">`)
      if (n.name_ru) L.push(`    <skos:prefLabel xml:lang="ru">${this._ex(n.name_ru)}</skos:prefLabel>`)
      if (n.name_en) L.push(`    <skos:prefLabel xml:lang="en">${this._ex(n.name_en)}</skos:prefLabel>`)
      if (n.name_zh) L.push(`    <skos:prefLabel xml:lang="zh">${this._ex(n.name_zh)}</skos:prefLabel>`)
      if (n.notation) L.push(`    <skos:notation>${this._ex(n.notation)}</skos:notation>`)
      if (n.definition) L.push(`    <skos:definition xml:lang="ru">${this._ex(n.definition)}</skos:definition>`)
      if (n.broaderId) L.push(`    <skos:broader rdf:resource="${this.baseURI}concept/${n.broaderId}"/>`)
      if (n.exactMatch) L.push(`    <skos:exactMatch rdf:resource="${this._ex(n.exactMatch)}"/>`)
      L.push(`  </skos:Concept>`, '')
    }
    L.push('</rdf:RDF>')
    return L.join('\n')
  }

  async toNTriples() {
    const { nodes, edges } = await this.loadData()
    const L = []
    const u = id => `<${this.baseURI}concept/${id}>`
    const p = v => `<${v}>`
    const l = (v, lang) => lang ? `"${this._et(v)}"@${lang}` : `"${this._et(v)}"`

    for (const n of nodes) {
      const s = u(n.id)
      L.push(`${s} ${p(PREFIXES.rdf + 'type')} ${p(PREFIXES.skos + 'Concept')} .`)
      if (n.name_ru) L.push(`${s} ${p(PREFIXES.skos + 'prefLabel')} ${l(n.name_ru, 'ru')} .`)
      if (n.name_en) L.push(`${s} ${p(PREFIXES.skos + 'prefLabel')} ${l(n.name_en, 'en')} .`)
      if (n.name_zh) L.push(`${s} ${p(PREFIXES.skos + 'prefLabel')} ${l(n.name_zh, 'zh')} .`)
      if (n.notation) L.push(`${s} ${p(PREFIXES.skos + 'notation')} ${l(n.notation)} .`)
      if (n.broaderId) L.push(`${s} ${p(PREFIXES.skos + 'broader')} ${u(n.broaderId)} .`)
    }
    for (const e of edges) {
      L.push(`${u(e.sourceId)} ${p(e.type === 'related' ? PREFIXES.skos + 'related' : this.baseURI + e.type)} ${u(e.targetId)} .`)
    }
    return L.join('\n')
  }

  async toOwlXml() {
    const { nodes } = await this.loadData()
    const L = ['<?xml version="1.0" encoding="UTF-8"?>',
      `<Ontology xmlns="http://www.w3.org/2002/07/owl#" xml:base="${this.baseURI}" ontologyIRI="${this.baseURI}">`, '',
      '  <Declaration><AnnotationProperty IRI="http://www.w3.org/2004/02/skos/core#prefLabel"/></Declaration>',
      '  <Declaration><AnnotationProperty IRI="http://www.w3.org/2004/02/skos/core#notation"/></Declaration>', '']

    for (const n of nodes) {
      const iri = `${this.baseURI}concept/${n.id}`
      L.push(`  <Declaration><NamedIndividual IRI="${iri}"/></Declaration>`)
      L.push(`  <ClassAssertion><Class IRI="http://www.w3.org/2004/02/skos/core#Concept"/><NamedIndividual IRI="${iri}"/></ClassAssertion>`)
      if (n.name_ru) L.push(`  <AnnotationAssertion><AnnotationProperty IRI="http://www.w3.org/2004/02/skos/core#prefLabel"/><IRI>${iri}</IRI><Literal xml:lang="ru">${this._ex(n.name_ru)}</Literal></AnnotationAssertion>`)
      if (n.name_en) L.push(`  <AnnotationAssertion><AnnotationProperty IRI="http://www.w3.org/2004/02/skos/core#prefLabel"/><IRI>${iri}</IRI><Literal xml:lang="en">${this._ex(n.name_en)}</Literal></AnnotationAssertion>`)
    }
    L.push('</Ontology>')
    return L.join('\n')
  }
}

let instance = null
export function getOntologySerializer() {
  if (!instance) instance = new OntologySerializer()
  return instance
}
export default OntologySerializer
