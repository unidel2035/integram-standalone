/**
 * OntologyRulesService — Rule engine for ontology auto-classification and enrichment
 */

import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js'
import { getOntologyService } from './IntegramOntologyService.js'
import logger from '../../utils/logger.js'

let instance = null

export class OntologyRulesService {
  constructor(config = {}) {
    this.llmCoordinator = new TokenBasedLLMCoordinator({ db: config.db || null })
    this.model = config.model || 'Kodacode/KodaAgent'
    this.rules = new Map()
    this.nextRuleId = 1
  }

  createRule(rule) {
    const id = String(this.nextRuleId++)
    const r = {
      id, name: rule.name || `Rule ${id}`, description: rule.description || '',
      condition: rule.condition, action: rule.action,
      enabled: rule.enabled !== false, createdAt: new Date().toISOString(),
      lastExecuted: null, executionCount: 0,
    }
    this.rules.set(id, r)
    return r
  }

  getRules() { return Array.from(this.rules.values()) }
  getRule(id) { return this.rules.get(id) || null }
  deleteRule(id) { return this.rules.delete(id) }

  async executeRule(ruleId) {
    const rule = this.rules.get(ruleId)
    if (!rule) throw new Error(`Rule ${ruleId} not found`)

    const svc = getOntologyService()
    await svc.initialize()
    const concepts = await svc.getConcepts({ limit: 10000 })

    const g = (c, alias) => {
      for (const r of Object.values(c.reqs || {})) {
        if (r.alias === alias || r.name === alias) return r.value || ''
      }
      return ''
    }

    const getDomain = (notation) => {
      if (!notation) return 'other'
      const P = { 'dront:':'dronetology','o4d:':'onto4drone','trs:':'transport','agro:':'agriculture','grid:':'energy','atm:':'aviation' }
      for (const [p, d] of Object.entries(P)) if (notation.startsWith(p)) return d
      return 'other'
    }

    const matching = concepts.filter(c => {
      const cond = rule.condition
      let v
      switch (cond.field) {
        case 'domain': v = getDomain(g(c, 'notation')); break
        case 'name': v = c.val || ''; break
        case 'name_en': v = g(c, 'prefLabel_en'); break
        case 'notation': v = g(c, 'notation'); break
        case 'definition': v = g(c, 'definition'); break
        default: v = g(c, cond.field) || ''
      }
      switch (cond.operator) {
        case 'equals': return v === cond.value
        case 'not_equals': return v !== cond.value
        case 'contains': return v.toLowerCase().includes((cond.value || '').toLowerCase())
        case 'starts_with': return v.startsWith(cond.value || '')
        case 'is_empty': return !v
        case 'is_not_empty': return !!v
        default: return false
      }
    })

    rule.lastExecuted = new Date().toISOString()
    rule.executionCount++
    return {
      ruleId, ruleName: rule.name, matchCount: matching.length, preview: true,
      results: matching.slice(0, 200).map(c => ({
        id: c.id, name: c.val, currentValue: g(c, rule.action.field || '') || c.val,
        newValue: rule.action.value || '', action: rule.action.type,
      })),
    }
  }

  async autoClassify(options = {}) {
    const svc = getOntologyService()
    await svc.initialize()
    const concepts = await svc.getConcepts({ limit: 10000 })
    const g = (c, a) => { for (const r of Object.values(c.reqs || {})) if (r.alias === a) return r.value || ''; return '' }

    const unclassified = concepts.filter(c => !g(c, 'notation')).slice(0, options.limit || 50)
    if (!unclassified.length) return { classified: [], message: 'Все концепты классифицированы' }

    const names = unclassified.map(c => `[ID:${c.id}] ${c.val}${g(c, 'prefLabel_en') ? ` / ${g(c, 'prefLabel_en')}` : ''}`).join('\n')

    const resp = await this.llmCoordinator.chatWithToken('agent_internal', options.model || this.model,
      [
        { role: 'system', content: 'Классифицируй концепты БПЛА. JSON: [{"id":"X","domain":"d","notation":"pfx:Term"}]\nДомены: dronetology(dront:), agriculture(agro:), aviation(atm:), ai(aio:), sensor(ssn:), software(swo:), construction(bim:), environment(env:), regulatory(fro:), transport(trs:), energy(grid:)' },
        { role: 'user', content: `Классифицируй:\n${names}` },
      ],
      { application: 'OntologyAI', operation: 'auto-classify', maxTokens: 4096 })

    let classified = []
    try { const m = (resp.content || '').match(/\[[\s\S]*\]/); if (m) classified = JSON.parse(m[0]) }
    catch (e) { logger.warn('[OntologyRules] Parse error', e.message) }
    return { classified, total: unclassified.length, preview: true }
  }

  async autoTranslate(targetLang = 'en', options = {}) {
    const svc = getOntologyService()
    await svc.initialize()
    const concepts = await svc.getConcepts({ limit: 10000 })
    const g = (c, a) => { for (const r of Object.values(c.reqs || {})) if (r.alias === a) return r.value || ''; return '' }

    const alias = targetLang === 'en' ? 'prefLabel_en' : 'prefLabel_zh'
    const missing = concepts.filter(c => c.val && !g(c, alias)).slice(0, options.limit || 50)
    if (!missing.length) return { translations: [], message: `Все переведены на ${targetLang}` }

    const lang = targetLang === 'en' ? 'английский' : 'китайский'
    const resp = await this.llmCoordinator.chatWithToken('agent_internal', options.model || this.model,
      [
        { role: 'system', content: `Переведи концепты БПЛА на ${lang}. JSON: [{"id":"X","translation":"T"}]` },
        { role: 'user', content: missing.map(c => `[ID:${c.id}] ${c.val}`).join('\n') },
      ],
      { application: 'OntologyAI', operation: 'auto-translate', maxTokens: 4096 })

    let translations = []
    try { const m = (resp.content || '').match(/\[[\s\S]*\]/); if (m) translations = JSON.parse(m[0]) }
    catch (e) { logger.warn('[OntologyRules] Parse error', e.message) }
    return { translations, targetLang, total: missing.length, preview: true }
  }
}

export function getOntologyRulesService(config = {}) {
  if (!instance) instance = new OntologyRulesService(config)
  return instance
}
export default OntologyRulesService
