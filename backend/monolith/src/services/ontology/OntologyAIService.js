/**
 * OntologyAIService — AI-powered ontology assistant
 *
 * Provides AI-driven querying, concept suggestion, quality analysis,
 * and path explanation for the DronDoc ontology platform.
 * Uses TokenBasedLLMCoordinator for LLM access.
 */

import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js'
import { getOntologyService } from './IntegramOntologyService.js'
import logger from '../../utils/logger.js'

let instance = null

export class OntologyAIService {
  constructor(config = {}) {
    this.llmCoordinator = new TokenBasedLLMCoordinator({ db: config.db || null })
    this.model = config.model || 'Kodacode/KodaAgent'
    this.graphCache = null
    this.graphCacheTime = 0
    this.CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  }

  async getGraphContext() {
    if (this.graphCache && Date.now() - this.graphCacheTime < this.CACHE_TTL) {
      return this.graphCache
    }

    const ontologyService = getOntologyService()
    await ontologyService.initialize()

    const concepts = await ontologyService.getConcepts({ limit: 10000 })
    const relations = await ontologyService.getAllRelations()

    const getByAlias = (concept, alias) => {
      const reqs = concept.reqs || {}
      for (const req of Object.values(reqs)) {
        if (req.alias === alias) return req.value || ''
      }
      return ''
    }

    const nodes = concepts.map(c => ({
      id: c.id,
      name: c.val || '',
      en: getByAlias(c, 'prefLabel_en'),
      notation: getByAlias(c, 'notation'),
      definition: getByAlias(c, 'definition'),
      domain: this._getDomain(getByAlias(c, 'notation')),
      broaderId: c.up > 1 ? c.up : null,
    }))

    const edges = relations.map(r => ({
      id: r.id,
      source: r.sourceId,
      target: r.targetId,
      type: r.typeLabel || 'related',
    }))

    this.graphCache = { nodes, edges, totalConcepts: nodes.length, totalRelations: edges.length }
    this.graphCacheTime = Date.now()
    return this.graphCache
  }

  _getDomain(notation) {
    if (!notation) return 'other'
    const DOMAIN_MAP = {
      'dront:': 'dronetology', 'o4d:': 'onto4drone', 'trs:': 'transport',
      'agro:': 'agriculture', 'grid:': 'energy', 'atm:': 'aviation',
      'aio:': 'ai', 'swo:': 'software', 'bc:': 'blockchain',
      'bim:': 'construction', 'env:': 'environment', 'lt:': 'physics',
      'dat:': 'data', 'act:': 'activity', 'com:': 'telecom',
      'edu:': 'education', 'ssn:': 'sensor', 'fro:': 'regulatory',
    }
    for (const [prefix, domain] of Object.entries(DOMAIN_MAP)) {
      if (notation.startsWith(prefix)) return domain
    }
    return 'other'
  }

  _buildGraphSummary(graph) {
    const domainCounts = {}
    for (const n of graph.nodes) {
      domainCounts[n.domain] = (domainCounts[n.domain] || 0) + 1
    }
    const topConcepts = graph.nodes
      .filter(n => !n.broaderId)
      .slice(0, 30)
      .map(n => `${n.name}${n.en ? ` (${n.en})` : ''}`)
      .join(', ')

    const relTypes = {}
    for (const e of graph.edges) relTypes[e.type] = (relTypes[e.type] || 0) + 1

    return `Онтология БПЛА/дронов (SKOS): ${graph.totalConcepts} концептов, ${graph.totalRelations} связей.
Домены: ${Object.entries(domainCounts).map(([d, c]) => `${d}(${c})`).join(', ')}.
Типы связей: ${Object.entries(relTypes).map(([t, c]) => `${t}(${c})`).join(', ')}.
Примеры корневых концептов: ${topConcepts}.`
  }

  async query(question, options = {}) {
    const graph = await this.getGraphContext()
    const summary = this._buildGraphSummary(graph)

    const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const relevantConcepts = graph.nodes.filter(n => {
      const text = `${n.name} ${n.en} ${n.notation} ${n.definition}`.toLowerCase()
      return keywords.some(k => text.includes(k))
    }).slice(0, 50)

    const conceptsList = relevantConcepts.map(n =>
      `[ID:${n.id}] ${n.name}${n.en ? ` / ${n.en}` : ''} (${n.domain}${n.notation ? `, ${n.notation}` : ''})`
    ).join('\n')

    const systemPrompt = `Ты — AI-ассистент онтологии БПЛА (дронов). Анализируешь SKOS-онтологию.

${summary}

Правила:
1. Отвечай на русском
2. Для концептов включай ID: [nodeId:XXXX]
3. Будь конкретным, ссылайся на реальные концепты`

    const userMessage = relevantConcepts.length > 0
      ? `Вопрос: ${question}\n\nРелевантные концепты:\n${conceptsList}`
      : `Вопрос: ${question}\n\nОнтология: ${graph.totalConcepts} концептов.`

    const response = await this.llmCoordinator.chatWithToken(
      'agent_internal', options.model || this.model,
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
      { application: 'OntologyAI', operation: 'query', maxTokens: 2048 }
    )

    const answer = response.content || ''
    const nodeIdMatches = answer.match(/\[nodeId:(\d+)\]/g) || []
    const highlightIds = nodeIdMatches.map(m => m.match(/\d+/)[0])

    return {
      answer: answer.replace(/\[nodeId:\d+\]/g, ''),
      highlightIds: [...new Set([...highlightIds, ...relevantConcepts.slice(0, 10).map(n => String(n.id))])],
      relevantConcepts: relevantConcepts.slice(0, 10).map(n => ({
        id: String(n.id), name: n.name, en: n.en, domain: n.domain
      })),
    }
  }

  async suggest(domain, options = {}) {
    const graph = await this.getGraphContext()
    const existing = graph.nodes
      .filter(n => n.domain === domain || domain === 'all')
      .map(n => n.name).slice(0, 100)

    const response = await this.llmCoordinator.chatWithToken(
      'agent_internal', options.model || this.model,
      [
        { role: 'system', content: `Эксперт по онтологиям БПЛА. Предложи новые концепты. JSON: [{"name_ru":"","name_en":"","notation":"prefix:Term","domain":"","reason":""}]\nДомены и префиксы: dronetology(dront:), onto4drone(o4d:), transport(trs:), agriculture(agro:), energy(grid:), aviation(atm:), ai(aio:), software(swo:), construction(bim:), environment(env:), sensor(ssn:), regulatory(fro:)` },
        { role: 'user', content: `Домен: ${domain}\nСуществующие (${existing.length}): ${existing.join(', ')}\n\nПредложи 5-10 новых.` },
      ],
      { application: 'OntologyAI', operation: 'suggest', maxTokens: 2048 }
    )

    let suggestions = []
    try {
      const m = (response.content || '').match(/\[[\s\S]*\]/)
      if (m) suggestions = JSON.parse(m[0])
    } catch (err) {
      logger.warn('[OntologyAI] Failed to parse suggestions', err.message)
    }
    return { suggestions, domain }
  }

  async analyze(options = {}) {
    const graph = await this.getGraphContext()

    const connectedIds = new Set()
    for (const e of graph.edges) {
      connectedIds.add(String(e.source))
      connectedIds.add(String(e.target))
    }
    for (const n of graph.nodes) {
      if (n.broaderId) {
        connectedIds.add(String(n.id))
        connectedIds.add(String(n.broaderId))
      }
    }

    const orphans = graph.nodes.filter(n => !connectedIds.has(String(n.id)))
    const missingEn = graph.nodes.filter(n => !n.en)
    const missingDef = graph.nodes.filter(n => !n.definition)

    const dupes = []
    const seen = {}
    for (const n of graph.nodes) {
      const key = (n.name || '').toLowerCase().trim()
      if (key && seen[key]) dupes.push({ id1: seen[key], id2: n.id, name: key })
      else if (key) seen[key] = n.id
    }

    const domainCounts = {}
    for (const n of graph.nodes) domainCounts[n.domain] = (domainCounts[n.domain] || 0) + 1

    const degreeMap = {}
    for (const e of graph.edges) {
      degreeMap[e.source] = (degreeMap[e.source] || 0) + 1
      degreeMap[e.target] = (degreeMap[e.target] || 0) + 1
    }
    const degrees = Object.values(degreeMap)
    const avgDeg = degrees.length ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0
    const maxDeg = degrees.length ? Math.max(...degrees) : 0

    let aiSummary = null
    if (options.withAI) {
      const r = await this.llmCoordinator.chatWithToken(
        'agent_internal', options.model || this.model,
        [
          { role: 'system', content: 'Эксперт по качеству онтологий. Проанализируй и дай рекомендации на русском. До 200 слов.' },
          { role: 'user', content: `${graph.totalConcepts} конц., ${graph.totalRelations} связей. Орфаны: ${orphans.length}, Без EN: ${missingEn.length}, Без определения: ${missingDef.length}, Дубликаты: ${dupes.length}. Домены: ${JSON.stringify(domainCounts)}.` },
        ],
        { application: 'OntologyAI', operation: 'analyze', maxTokens: 1024 }
      )
      aiSummary = r.content
    }

    const tc = graph.totalConcepts
    return {
      totalConcepts: tc, totalRelations: graph.totalRelations,
      orphans: orphans.slice(0, 100).map(n => ({ id: String(n.id), name: n.name, domain: n.domain })),
      orphanCount: orphans.length, missingEn: missingEn.length, missingDefinition: missingDef.length,
      duplicates: dupes.slice(0, 20), domainDistribution: domainCounts,
      connectivity: { avgDegree: parseFloat(avgDeg.toFixed(2)), maxDegree: maxDeg, connectedNodes: connectedIds.size },
      completeness: {
        withEnLabel: ((tc - missingEn.length) / tc * 100).toFixed(1),
        withDefinition: ((tc - missingDef.length) / tc * 100).toFixed(1),
        withRelations: (connectedIds.size / tc * 100).toFixed(1),
      },
      aiSummary,
    }
  }

  async explainPath(sourceId, targetId, options = {}) {
    const graph = await this.getGraphContext()

    const adjMap = {}
    for (const e of graph.edges) {
      const s = String(e.source), t = String(e.target)
      if (!adjMap[s]) adjMap[s] = []
      if (!adjMap[t]) adjMap[t] = []
      adjMap[s].push({ target: t, type: e.type })
      adjMap[t].push({ target: s, type: e.type })
    }
    for (const n of graph.nodes) {
      if (n.broaderId) {
        const s = String(n.id), t = String(n.broaderId)
        if (!adjMap[s]) adjMap[s] = []
        if (!adjMap[t]) adjMap[t] = []
        adjMap[s].push({ target: t, type: 'broader' })
        adjMap[t].push({ target: s, type: 'narrower' })
      }
    }

    const src = String(sourceId), tgt = String(targetId)
    const visited = new Set([src])
    const queue = [[src]]
    let path = null

    while (queue.length > 0 && !path) {
      const cur = queue.shift()
      const last = cur[cur.length - 1]
      for (const { target } of (adjMap[last] || [])) {
        if (visited.has(target)) continue
        visited.add(target)
        const np = [...cur, target]
        if (target === tgt) { path = np; break }
        if (np.length < 8) queue.push(np)
      }
    }

    if (!path) return { found: false, message: 'Путь не найден', path: [], highlightIds: [src, tgt] }

    const nodeMap = Object.fromEntries(graph.nodes.map(n => [String(n.id), n]))
    const pathDetails = path.map(id => ({
      id, name: nodeMap[id]?.name || id, en: nodeMap[id]?.en || '', domain: nodeMap[id]?.domain || 'other',
    }))

    const r = await this.llmCoordinator.chatWithToken(
      'agent_internal', options.model || this.model,
      [
        { role: 'system', content: 'Эксперт по онтологиям БПЛА. Объясни связь на русском, 2-3 предложения.' },
        { role: 'user', content: `Путь: ${pathDetails.map(p => p.name).join(' → ')}` },
      ],
      { application: 'OntologyAI', operation: 'explainPath', maxTokens: 512 }
    )

    return { found: true, path: pathDetails, highlightIds: path, length: path.length, explanation: r.content }
  }

  clearCache() { this.graphCache = null; this.graphCacheTime = 0 }
}

export function getOntologyAIService(config = {}) {
  if (!instance) instance = new OntologyAIService(config)
  return instance
}

export default OntologyAIService
