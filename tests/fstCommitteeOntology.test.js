/**
 * Unit tests for fstCommitteeOntology.js
 */

import { describe, it, expect } from 'vitest'
import {
  EVENT_TYPES,
  RELATIONS,
  EPISTEMIC_STANCE,
  TOULMIN_FIELDS,
  CONDITION_TYPES,
  CONDITION_PRIORITY,
  toulminStrength,
  weakestComponent,
  argOntotype,
  inferRelations,
  buildIBISGraph,
  buildDebateGraph,
  annotateArg,
  detectContradictions,
  deriveConditionsFromContradictions,
  assembleConditionalDecision,
  createCondition,
  createContradiction,
  exportToKagEntities,
} from '../src/components/fst-committee/fstCommitteeOntology.js'

describe('fstCommitteeOntology — Constants', () => {
  it('EVENT_TYPES has session/phase/argument/vote events', () => {
    expect(EVENT_TYPES.SESSION_STARTED).toBe('session:started')
    expect(EVENT_TYPES.ARGUMENT_OPENING).toBe('argument:opening')
    expect(EVENT_TYPES.ARGUMENT_CHALLENGE).toBe('argument:challenge')
    expect(EVENT_TYPES.VOTE_CAST).toBe('vote:cast')
    expect(EVENT_TYPES.CONTRADICTION_FOUND).toBe('contradiction:found')
    expect(EVENT_TYPES.ISSUE_RAISED).toBe('ibis:issue:raised')
  })

  it('RELATIONS has semantic relationship types', () => {
    expect(RELATIONS.IS_RESPONSE_TO).toBe('isResponseTo')
    expect(RELATIONS.CHALLENGES).toBe('challenges')
    expect(RELATIONS.SUPPORTS).toBe('supports')
    expect(RELATIONS.CONTRADICTS).toBe('contradicts')
    expect(RELATIONS.RESOLVES).toBe('resolves')
  })

  it('EPISTEMIC_STANCE has 4 states', () => {
    expect(Object.keys(EPISTEMIC_STANCE)).toHaveLength(4)
    expect(EPISTEMIC_STANCE.ROLE).toBe('ROLE')
    expect(EPISTEMIC_STANCE.DEVIL_ADV).toBe('DEVIL_ADV')
  })

  it('TOULMIN_FIELDS has 6 components', () => {
    expect(TOULMIN_FIELDS).toEqual(['claim', 'data', 'warrant', 'backing', 'qualifier', 'rebuttal'])
  })

  it('CONDITION_TYPES has deal condition categories', () => {
    expect(CONDITION_TYPES.MILESTONE).toBe('MILESTONE')
    expect(CONDITION_TYPES.FINANCIAL).toBe('FINANCIAL')
    expect(CONDITION_TYPES.TRANCHE).toBe('TRANCHE')
  })

  it('CONDITION_PRIORITY has 4 levels', () => {
    expect(Object.keys(CONDITION_PRIORITY)).toHaveLength(4)
    expect(CONDITION_PRIORITY.BLOCKER).toBe('BLOCKER')
  })
})

describe('fstCommitteeOntology — toulminStrength', () => {
  it('returns confidence when no warrant', () => {
    expect(toulminStrength({ confidence: 0.8 })).toBe(0.8)
  })

  it('returns strength when no warrant and no confidence', () => {
    expect(toulminStrength({ strength: 0.6 })).toBe(0.6)
  })

  it('returns 0.5 default when nothing present', () => {
    expect(toulminStrength({})).toBe(0.5)
  })

  it('adds 0.1 for data when warrant present', () => {
    const arg = { warrant: 'logic', data: 'numbers', qualifier: 0.7 }
    expect(toulminStrength(arg)).toBeCloseTo(0.8, 2)
  })

  it('adds 0.05 for backing', () => {
    const arg = { warrant: 'logic', backing: 'authority', qualifier: 0.7 }
    expect(toulminStrength(arg)).toBeCloseTo(0.75, 2)
  })

  it('subtracts 0.05 for rebuttal', () => {
    const arg = { warrant: 'logic', rebuttal: 'limitation', qualifier: 0.7 }
    expect(toulminStrength(arg)).toBeCloseTo(0.65, 2)
  })

  it('clamps to [0, 1]', () => {
    const high = { warrant: 'w', data: 'd', backing: 'b', qualifier: 0.95 }
    expect(toulminStrength(high)).toBeLessThanOrEqual(1)
    const low = { warrant: 'w', rebuttal: 'r', qualifier: 0.02 }
    expect(toulminStrength(low)).toBeGreaterThanOrEqual(0)
  })
})

describe('fstCommitteeOntology — weakestComponent', () => {
  it('returns warrant when missing', () => {
    expect(weakestComponent({})).toBe('warrant')
  })

  it('returns data when warrant exists but data missing', () => {
    expect(weakestComponent({ warrant: 'w' })).toBe('data')
  })

  it('returns backing when warrant and data exist', () => {
    expect(weakestComponent({ warrant: 'w', data: 'd' })).toBe('backing')
  })

  it('returns claim when all components exist', () => {
    expect(weakestComponent({ warrant: 'w', data: 'd', backing: 'b' })).toBe('claim')
  })
})

describe('fstCommitteeOntology — argOntotype', () => {
  it('maps OPENING to argument:opening', () => {
    expect(argOntotype('OPENING')).toBe('argument:opening')
  })

  it('maps CHALLENGE to argument:challenge', () => {
    expect(argOntotype('CHALLENGE')).toBe('argument:challenge')
  })

  it('maps SYNTHESIS to argument:synthesis', () => {
    expect(argOntotype('SYNTHESIS')).toBe('argument:synthesis')
  })

  it('maps CLOSING to argument:synthesis', () => {
    expect(argOntotype('CLOSING')).toBe('argument:synthesis')
  })

  it('maps QUESTION to argument:question', () => {
    expect(argOntotype('QUESTION')).toBe('argument:question')
  })

  it('returns generic for unknown type', () => {
    expect(argOntotype('UNKNOWN')).toBe('argument:generic')
  })
})

describe('fstCommitteeOntology — inferRelations', () => {
  const makeArg = (overrides) => ({
    id: 'arg1', agentId: 'tech', type: 'OPENING', text: 'test',
    stance: null, targetArgId: null, ...overrides,
  })

  it('returns empty for arg without target', () => {
    expect(inferRelations(makeArg({}), [])).toEqual([])
  })

  it('COUNTER with same stance -> SUPPORTS', () => {
    const target = makeArg({ id: 'target', agentId: 'finance', stance: 'APPROVE' })
    const counter = makeArg({ id: 'c1', agentId: 'tech', type: 'COUNTER', targetArgId: 'target', stance: 'APPROVE' })
    const rels = inferRelations(counter, [target, counter])
    expect(rels[0].type).toBe(RELATIONS.SUPPORTS)
  })

  it('COUNTER with different stance -> IS_RESPONSE_TO', () => {
    const target = makeArg({ id: 'target', agentId: 'finance', stance: 'APPROVE' })
    const counter = makeArg({ id: 'c1', agentId: 'tech', type: 'COUNTER', targetArgId: 'target', stance: 'REJECT' })
    const rels = inferRelations(counter, [target, counter])
    expect(rels[0].type).toBe(RELATIONS.IS_RESPONSE_TO)
  })

  it('COUNTER with isContradiction -> adds CONTRADICTS', () => {
    const target = makeArg({ id: 'target', agentId: 'finance', stance: 'APPROVE' })
    const counter = makeArg({ id: 'c1', type: 'COUNTER', targetArgId: 'target', stance: 'REJECT', isContradiction: true })
    const rels = inferRelations(counter, [target, counter])
    expect(rels.some(r => r.type === RELATIONS.CONTRADICTS)).toBe(true)
  })

  it('CHALLENGE -> attacks weakest component', () => {
    const target = makeArg({ id: 'target', warrant: 'logic' })
    const challenge = makeArg({ id: 'ch1', type: 'CHALLENGE', targetArgId: 'target' })
    const rels = inferRelations(challenge, [target, challenge])
    expect(rels[0].type).toBe(RELATIONS.CHALLENGES_DATA)
    expect(rels[0].attackedComponent).toBe('data')
  })

  it('CHALLENGE target without warrant -> CHALLENGES_WARRANT', () => {
    const target = makeArg({ id: 'target' })
    const challenge = makeArg({ id: 'ch1', type: 'CHALLENGE', targetArgId: 'target' })
    const rels = inferRelations(challenge, [target, challenge])
    expect(rels[0].type).toBe(RELATIONS.CHALLENGES_WARRANT)
  })

  it('SUPPORT -> SUPPORTS', () => {
    const target = makeArg({ id: 'target' })
    const support = makeArg({ id: 's1', type: 'SUPPORT', targetArgId: 'target' })
    const rels = inferRelations(support, [target, support])
    expect(rels[0].type).toBe(RELATIONS.SUPPORTS)
  })

  it('CONCESSION -> CONCEDES_TO + SUPPORTS', () => {
    const target = makeArg({ id: 'target' })
    const concession = makeArg({ id: 'cn1', type: 'CONCESSION', targetArgId: 'target' })
    const rels = inferRelations(concession, [target, concession])
    expect(rels).toHaveLength(2)
    expect(rels[0].type).toBe(RELATIONS.CONCEDES_TO)
    expect(rels[1].type).toBe(RELATIONS.SUPPORTS)
  })

  it('RETRACTION -> RETRACTS', () => {
    const target = makeArg({ id: 'target' })
    const retraction = makeArg({ id: 'r1', type: 'RETRACTION', targetArgId: 'target' })
    const rels = inferRelations(retraction, [target, retraction])
    expect(rels[0].type).toBe(RELATIONS.RETRACTS)
  })

  it('COMMITMENT -> COMMITS_ON', () => {
    const target = makeArg({ id: 'target' })
    const commit = makeArg({ id: 'cm1', type: 'COMMITMENT', targetArgId: 'target' })
    const rels = inferRelations(commit, [target, commit])
    expect(rels[0].type).toBe(RELATIONS.COMMITS_ON)
  })

  it('SYNTHESIS -> synthesizes last 3 agent args', () => {
    const a1 = makeArg({ id: 'a1', agentId: 'tech' })
    const a2 = makeArg({ id: 'a2', agentId: 'tech' })
    const a3 = makeArg({ id: 'a3', agentId: 'tech' })
    const a4 = makeArg({ id: 'a4', agentId: 'tech' })
    const synth = makeArg({ id: 'synth', agentId: 'tech', type: 'SYNTHESIS' })
    const rels = inferRelations(synth, [a1, a2, a3, a4, synth])
    expect(rels.every(r => r.type === RELATIONS.SYNTHESIZES)).toBe(true)
    expect(rels).toHaveLength(3)
  })

  it('QUESTION -> CHALLENGES', () => {
    const target = makeArg({ id: 'target' })
    const question = makeArg({ id: 'q1', type: 'QUESTION', targetArgId: 'target' })
    const rels = inferRelations(question, [target, question])
    expect(rels[0].type).toBe(RELATIONS.CHALLENGES)
  })
})

describe('fstCommitteeOntology — buildIBISGraph', () => {
  it('returns empty issues for no challenges', () => {
    const graph = buildIBISGraph([{ id: 'a1', type: 'OPENING', agentId: 'tech', text: 'Good' }])
    expect(graph.issues).toHaveLength(0)
  })

  it('creates issue from CHALLENGE', () => {
    const args = [
      { id: 'a1', type: 'OPENING', agentId: 'tech', text: 'TRL is 7', stance: 'APPROVE' },
      { id: 'a2', type: 'CHALLENGE', agentId: 'risk', text: 'TRL flawed', targetArgId: 'a1', dimension: 'trl' },
    ]
    const graph = buildIBISGraph(args)
    expect(graph.issues).toHaveLength(1)
    expect(graph.issues[0].raisedBy).toBe('risk')
    expect(graph.issues[0].dimension).toBe('trl')
  })

  it('merges challenges from same agent on same target', () => {
    const args = [
      { id: 'a1', type: 'OPENING', agentId: 'tech', text: 'Base' },
      { id: 'c1', type: 'CHALLENGE', agentId: 'risk', text: 'Challenge 1', targetArgId: 'a1' },
      { id: 'c2', type: 'CHALLENGE', agentId: 'risk', text: 'Challenge 2', targetArgId: 'a1' },
    ]
    const graph = buildIBISGraph(args)
    expect(graph.issues).toHaveLength(1)
    expect(graph.issues[0].relatedArgIds).toContain('c2')
  })

  it('uses claim if available for issue text', () => {
    const args = [{ id: 'c1', type: 'CHALLENGE', agentId: 'risk', claim: 'TRL underestimated', text: 'Long text' }]
    const graph = buildIBISGraph(args)
    expect(graph.issues[0].text).toBe('TRL underestimated')
  })

  it('truncates long text to 100 chars', () => {
    const longText = 'A'.repeat(200)
    const args = [{ id: 'c1', type: 'CHALLENGE', agentId: 'risk', text: longText }]
    const graph = buildIBISGraph(args)
    expect(graph.issues[0].text.length).toBeLessThanOrEqual(101)
  })
})

describe('fstCommitteeOntology — buildDebateGraph', () => {
  it('builds nodes from argument events', () => {
    const events = [
      { id: 'e1', type: 'argument:opening', relations: [] },
      { id: 'e2', type: 'argument:challenge', relations: [{ targetId: 'e1', type: 'challenges' }] },
      { id: 'e3', type: 'vote:cast', relations: [] },
      { id: 'e4', type: 'session:started' },
    ]
    const { nodes, edges } = buildDebateGraph(events)
    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toEqual({ from: 'e2', to: 'e1', type: 'challenges' })
  })
})

describe('fstCommitteeOntology — annotateArg', () => {
  it('adds ontological fields', () => {
    const arg = { id: 'a1', agentId: 'tech', type: 'OPENING', text: 'test', confidence: 0.8 }
    const annotated = annotateArg(arg, [arg])
    expect(annotated.ontotype).toBe('argument:opening')
    expect(annotated.epistemicStance).toBe('ROLE')
    expect(annotated.toulminStrength).toBe(0.8)
    expect(annotated.weakComponent).toBe('warrant')
  })

  it('infers DEVIL_ADV stance for devil agent', () => {
    const arg = { id: 'a1', agentId: 'devil', type: 'CHALLENGE', text: 'test' }
    expect(annotateArg(arg, [arg]).epistemicStance).toBe('DEVIL_ADV')
  })

  it('infers DOUBT for QUESTION type', () => {
    const arg = { id: 'a1', agentId: 'tech', type: 'QUESTION', text: 'test' }
    expect(annotateArg(arg, [arg]).epistemicStance).toBe('DOUBT')
  })

  it('infers PERSONAL for CONCESSION', () => {
    const arg = { id: 'a1', agentId: 'tech', type: 'CONCESSION', text: 'test' }
    expect(annotateArg(arg, [arg]).epistemicStance).toBe('PERSONAL')
  })

  it('preserves existing epistemicStance', () => {
    const arg = { id: 'a1', agentId: 'tech', type: 'OPENING', text: 'test', epistemicStance: 'PERSONAL' }
    expect(annotateArg(arg, [arg]).epistemicStance).toBe('PERSONAL')
  })
})

describe('fstCommitteeOntology — createCondition', () => {
  it('creates condition with all fields', () => {
    const cond = createCondition({
      proposedBy: 'risk', type: CONDITION_TYPES.MILESTONE, priority: CONDITION_PRIORITY.BLOCKER,
      text: 'Achieve TRL=7', metric: 'trl', threshold: 7, deadline: '6 months',
      resolves: ['contr_1'], dealImpact: { riskDelta: -0.1 },
    })
    expect(cond.id).toMatch(/^cond_/)
    expect(cond.proposedBy).toBe('risk')
    expect(cond.status).toBe('PROPOSED')
    expect(cond.votes).toEqual({})
  })

  it('uses HIGH priority as default', () => {
    const cond = createCondition({ proposedBy: 'tech', type: 'REPORTING', text: 'test' })
    expect(cond.priority).toBe('HIGH')
  })
})

describe('fstCommitteeOntology — createContradiction', () => {
  it('creates contradiction with defaults', () => {
    const contr = createContradiction({
      thesis: { agentId: 'tech', argId: 'a1', claim: 'ok', stance: 'APPROVE' },
      antithesis: { agentId: 'risk', argId: 'a2', claim: 'bad', stance: 'REJECT' },
      dimension: 'trl',
    })
    expect(contr.id).toMatch(/^contr_/)
    expect(contr.severity).toBe(0.5)
    expect(contr.status).toBe('OPEN')
    expect(contr.resolution).toBeNull()
  })
})

describe('fstCommitteeOntology — detectContradictions', () => {
  it('finds contradiction between APPROVE and REJECT on same dimension', () => {
    const args = [
      { id: 'a1', agentId: 'tech', stance: 'APPROVE', dimension: 'trl', confidence: 0.8, text: 'TRL ok' },
      { id: 'a2', agentId: 'risk', stance: 'REJECT', dimension: 'trl', confidence: 0.7, text: 'TRL bad' },
    ]
    const contrs = detectContradictions(args)
    expect(contrs).toHaveLength(1)
    expect(contrs[0].dimension).toBe('trl')
  })

  it('ignores same agent opposing itself', () => {
    const args = [
      { id: 'a1', agentId: 'tech', stance: 'APPROVE', dimension: 'trl', text: 'ok' },
      { id: 'a2', agentId: 'tech', stance: 'REJECT', dimension: 'trl', text: 'bad' },
    ]
    expect(detectContradictions(args)).toHaveLength(0)
  })

  it('finds cross-dimension contradictions for high-confidence args', () => {
    const args = [
      { id: 'a1', agentId: 'tech', stance: 'APPROVE', dimension: 'trl', confidence: 0.7, text: 'ok' },
      { id: 'a2', agentId: 'risk', stance: 'REJECT', dimension: 'finance', confidence: 0.8, text: 'bad' },
    ]
    const contrs = detectContradictions(args)
    expect(contrs).toHaveLength(1)
    expect(contrs[0].dimension).toBe('finance')
  })

  it('skips cross-dimension when confidence is low', () => {
    const args = [
      { id: 'a1', agentId: 'tech', stance: 'APPROVE', dimension: 'trl', confidence: 0.3, text: 'ok' },
      { id: 'a2', agentId: 'risk', stance: 'REJECT', dimension: 'finance', confidence: 0.4, text: 'bad' },
    ]
    expect(detectContradictions(args)).toHaveLength(0)
  })

  it('sorts by severity descending', () => {
    const args = [
      { id: 'a1', agentId: 'tech', stance: 'APPROVE', dimension: 'trl', confidence: 0.5, text: 'ok' },
      { id: 'a2', agentId: 'risk', stance: 'REJECT', dimension: 'trl', confidence: 0.5, text: 'bad' },
      { id: 'a3', agentId: 'finance', stance: 'APPROVE', dimension: 'finance', confidence: 0.9, text: 'ok' },
      { id: 'a4', agentId: 'devil', stance: 'REJECT', dimension: 'finance', confidence: 0.9, text: 'bad' },
    ]
    const contrs = detectContradictions(args)
    expect(contrs.length).toBeGreaterThanOrEqual(2)
    expect(contrs[0].severity).toBeGreaterThanOrEqual(contrs[1].severity)
  })

  it('ignores args without stance or dimension', () => {
    const args = [
      { id: 'a1', agentId: 'tech', stance: 'APPROVE', text: 'ok' },
      { id: 'a2', agentId: 'risk', dimension: 'trl', text: 'bad' },
    ]
    expect(detectContradictions(args)).toHaveLength(0)
  })
})

describe('fstCommitteeOntology — deriveConditionsFromContradictions', () => {
  const project = { trl: 4, mrl: 3, projectedIRR: 0.25, sovereigntyScore: 5, teamStrength: 0.5 }

  function makeContr(dim) {
    return createContradiction({
      thesis: { agentId: 'tech', argId: 'a1', claim: 'ok', stance: 'APPROVE' },
      antithesis: { agentId: 'risk', argId: 'a2', claim: 'bad', stance: 'REJECT' },
      dimension: dim,
    })
  }

  it('generates MILESTONE condition for TRL', () => {
    const contrs = [makeContr('trl')]
    const conds = deriveConditionsFromContradictions(contrs, project)
    expect(conds).toHaveLength(1)
    expect(conds[0].type).toBe('MILESTONE')
    expect(conds[0].priority).toBe('BLOCKER')
    expect(conds[0].metric).toBe('trl')
    expect(conds[0].threshold).toBe(6)
    expect(contrs[0].status).toBe('RESOLVED_BY_CONDITION')
  })

  it('generates FINANCIAL condition for finance', () => {
    const contrs = [makeContr('finance')]
    const conds = deriveConditionsFromContradictions(contrs, project)
    expect(conds[0].type).toBe('FINANCIAL')
    expect(conds[0].metric).toBe('projectedIRR')
  })

  it('generates SOVEREIGNTY condition', () => {
    const contrs = [makeContr('sovereignty')]
    const conds = deriveConditionsFromContradictions(contrs, project)
    expect(conds[0].type).toBe('SOVEREIGNTY')
    expect(conds[0].threshold).toBe(7)
  })

  it('generates TEAM condition', () => {
    const conds = deriveConditionsFromContradictions([makeContr('team')], project)
    expect(conds[0].type).toBe('TEAM')
  })

  it('generates REPORTING condition for market', () => {
    const conds = deriveConditionsFromContradictions([makeContr('market')], project)
    expect(conds[0].type).toBe('REPORTING')
  })

  it('generates generic REPORTING for unknown dimension', () => {
    const conds = deriveConditionsFromContradictions([makeContr('exotic')], project)
    expect(conds[0].type).toBe('REPORTING')
    expect(conds[0].text).toContain('exotic')
  })

  it('deduplicates same dimension', () => {
    const contrs = [makeContr('trl'), makeContr('trl')]
    const conds = deriveConditionsFromContradictions(contrs, project)
    expect(conds).toHaveLength(1)
    expect(contrs[1].status).toBe('RESOLVED_BY_CONDITION')
  })
})

describe('fstCommitteeOntology — assembleConditionalDecision', () => {
  const project = { requestedAmount: 100_000_000, projectedIRR: 0.25, exitYear: 5 }
  const decision = { recommendation: 'APPROVE', aggregatedScore: 0.72 }

  it('upgrades APPROVE to CONDITIONAL_APPROVE with blockers', () => {
    const blocker = createCondition({
      proposedBy: 'risk', type: 'MILESTONE', priority: 'BLOCKER',
      text: 'TRL=7', resolves: [], dealImpact: { riskDelta: -0.1 },
    })
    const result = assembleConditionalDecision({ decision, contradictions: [], conditions: [blocker], project })
    expect(result.recommendation).toBe('CONDITIONAL_APPROVE')
  })

  it('keeps REJECT as REJECT regardless of blockers', () => {
    const blocker = createCondition({
      proposedBy: 'risk', type: 'MILESTONE', priority: 'BLOCKER',
      text: 'TRL=7', resolves: [], dealImpact: {},
    })
    const result = assembleConditionalDecision({
      decision: { recommendation: 'REJECT' }, contradictions: [], conditions: [blocker], project,
    })
    expect(result.recommendation).toBe('REJECT')
  })

  it('generates 3 scenarios', () => {
    const result = assembleConditionalDecision({ decision, contradictions: [], conditions: [], project })
    expect(result.scenarios.BASE).toBeDefined()
    expect(result.scenarios.OPTIMISTIC).toBeDefined()
    expect(result.scenarios.PESSIMISTIC).toBeDefined()
    expect(result.scenarios.BASE.probability).toBe(0.50)
  })

  it('applies dealImpact to terms', () => {
    const cond = createCondition({
      proposedBy: 'risk', type: 'FINANCIAL', priority: 'HIGH',
      text: 'test', resolves: [], dealImpact: { irrDelta: -0.03 },
    })
    const result = assembleConditionalDecision({ decision, contradictions: [], conditions: [cond], project })
    expect(result.dealTerms.adjustedIRR).toBe(Math.round((0.25 - 0.03) * 100))
  })

  it('creates tranche structure from TRANCHE condition', () => {
    const trancheCond = createCondition({
      proposedBy: 'risk', type: 'TRANCHE', priority: 'BLOCKER',
      text: 'Staged financing: TRL milestone', resolves: [],
      dealImpact: { trancheFraction: 0.3 },
    })
    const result = assembleConditionalDecision({ decision, contradictions: [], conditions: [trancheCond], project })
    expect(result.dealTerms.trancheStructure).toHaveLength(2)
    expect(result.dealTerms.trancheStructure[0].fraction).toBe(0.3)
    expect(result.dealTerms.trancheStructure[1].fraction).toBe(0.7)
  })

  it('generates smartContractSkeleton', () => {
    const cond = createCondition({
      proposedBy: 'tech', type: 'MILESTONE', priority: 'BLOCKER',
      text: 'TRL=7', metric: 'trl', threshold: 7, deadline: '6 months',
      resolves: [], dealImpact: {},
    })
    const result = assembleConditionalDecision({ decision, contradictions: [], conditions: [cond], project })
    expect(result.smartContractSkeleton).toHaveLength(1)
    expect(result.smartContractSkeleton[0].IF).toBe('trl >= 7')
    expect(result.smartContractSkeleton[0].BY).toBe('6 months')
  })

  it('single tranche when no tranche condition', () => {
    const result = assembleConditionalDecision({ decision, contradictions: [], conditions: [], project })
    expect(result.dealTerms.trancheStructure).toHaveLength(1)
    expect(result.dealTerms.trancheStructure[0].fraction).toBe(1)
  })
})

describe('fstCommitteeOntology — exportToKagEntities', () => {
  it('exports session entity', () => {
    const session = {
      project: { title: 'DroneX' }, projectId: 'px1',
      decision: { recommendation: 'APPROVE', aggregatedScore: 0.8 },
      roundNumber: 3, arguments: [], speedProfile: 'fast',
    }
    const entities = exportToKagEntities(session)
    expect(entities.length).toBeGreaterThanOrEqual(1)
    expect(entities[0].entityType).toBe('CommitteeSession')
    expect(entities[0].name).toContain('DroneX')
  })

  it('exports high-strength arguments', () => {
    const session = {
      project: { title: 'Test' }, decision: { recommendation: 'APPROVE', aggregatedScore: 0.7 },
      roundNumber: 1,
      arguments: [
        { id: 'arg_abc123', agentId: 'tech', type: 'OPENING', dimension: 'trl', text: 'TRL great', strength: 0.9, model: 'polza/qwen/qwen-turbo' },
        { id: 'arg_def456', agentId: 'finance', type: 'OPENING', dimension: 'finance', text: 'Low IRR', strength: 0.4 },
      ],
    }
    const entities = exportToKagEntities(session)
    const argEntities = entities.filter(e => e.entityType === 'CommitteeArgument')
    expect(argEntities).toHaveLength(1)
    expect(argEntities[0].observations).toContain('Агент: tech')
  })

  it('exports AI-generated arguments regardless of strength', () => {
    const session = {
      project: { title: 'Test' }, decision: { recommendation: 'APPROVE', aggregatedScore: 0.7 },
      roundNumber: 1,
      arguments: [{ id: 'arg_low', agentId: 'tech', type: 'OPENING', dimension: 'trl', text: 'test', strength: 0.3, aiGenerated: true }],
    }
    const entities = exportToKagEntities(session)
    expect(entities.filter(e => e.entityType === 'CommitteeArgument')).toHaveLength(1)
  })

  it('exports IBIS issues from challenges', () => {
    const session = {
      project: { title: 'Test' }, decision: { recommendation: 'DEFER', aggregatedScore: 0.5 },
      roundNumber: 2,
      arguments: [
        { id: 'a1', agentId: 'tech', type: 'OPENING', text: 'TRL ok', stance: 'APPROVE' },
        { id: 'c1', agentId: 'risk', type: 'CHALLENGE', text: 'TRL bad', targetArgId: 'a1', dimension: 'trl', stance: 'REJECT' },
      ],
    }
    const entities = exportToKagEntities(session)
    const issues = entities.filter(e => e.entityType === 'DebateIssue')
    expect(issues).toHaveLength(1)
  })

  it('includes model usage in session entity', () => {
    const session = {
      project: { title: 'Test' }, decision: { recommendation: 'APPROVE', aggregatedScore: 0.8 },
      roundNumber: 1,
      arguments: [
        { id: 'a1', agentId: 'tech', model: 'polza/qwen/qwen-turbo', text: 'x', strength: 0.9 },
        { id: 'a2', agentId: 'tech', model: 'polza/qwen/qwen-turbo', text: 'y', strength: 0.9 },
        { id: 'a3', agentId: 'finance', model: 'deepseek-chat', text: 'z', strength: 0.9 },
      ],
    }
    const entities = exportToKagEntities(session)
    const sessionEntity = entities.find(e => e.entityType === 'CommitteeSession')
    const modelObs = sessionEntity.observations.find(o => o.startsWith('Модели агентов:'))
    expect(modelObs).toBeDefined()
    expect(modelObs).toContain('tech:')
  })
})
