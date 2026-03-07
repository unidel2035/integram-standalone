/**
 * fstCommitteeOntology.js — Событийная онтология Инвесткомитета ФСТ НТИ
 *
 * Каждое событие дебатов — типизированная сущность с семантическими отношениями.
 * Позволяет строить граф аргументов, анализировать логические цепочки,
 * сохранять протокол в базу знаний.
 */

// ── Типы событий ─────────────────────────────────────────────────────────────

export const EVENT_TYPES = {
  // Сессия
  SESSION_STARTED:    'session:started',
  SESSION_CONCLUDED:  'session:concluded',

  // Фазы
  PHASE_ENTERED:      'phase:entered',
  PHASE_COMPLETED:    'phase:completed',

  // Агент
  AGENT_THINKING:     'agent:thinking',
  AGENT_READY:        'agent:ready',

  // Аргументы (ядро онтологии)
  ARGUMENT_OPENING:   'argument:opening',    // первичная позиция
  ARGUMENT_CHALLENGE: 'argument:challenge',  // атака на уязвимость
  ARGUMENT_COUNTER:   'argument:counter',    // ответ на вызов
  ARGUMENT_SUPPORT:   'argument:support',    // поддержка чужого аргумента
  ARGUMENT_SYNTHESIS: 'argument:synthesis',  // финальная позиция агента

  // Голосование
  VOTE_CAST:          'vote:cast',
  VOTE_FINAL:         'vote:final',

  // Решение
  DECISION_SYNTH:     'decision:synthesized',
  DECISION_HUMAN:     'decision:human:approved',
}

// ── Типы отношений между событиями ───────────────────────────────────────────

export const RELATIONS = {
  IS_RESPONSE_TO: 'isResponseTo',  // аргумент является ответом на
  CHALLENGES:     'challenges',     // атакует / оспаривает
  SUPPORTS:       'supports',       // поддерживает / соглашается с
  SYNTHESIZES:    'synthesizes',    // обобщает группу аргументов
  VOTES_ON:       'votesOn',        // голос относится к сессии/фазе
  CONTRADICTS:    'contradicts',    // прямое противоречие
}

// ── Маппинг phase/type → ontotype ────────────────────────────────────────────

export function argOntotype(argType) {
  return {
    OPENING:   EVENT_TYPES.ARGUMENT_OPENING,
    CHALLENGE: EVENT_TYPES.ARGUMENT_CHALLENGE,
    COUNTER:   EVENT_TYPES.ARGUMENT_COUNTER,
    SUPPORT:   EVENT_TYPES.ARGUMENT_SUPPORT,
    SYNTHESIS: EVENT_TYPES.ARGUMENT_SYNTHESIS,
    CLOSING:   EVENT_TYPES.ARGUMENT_SYNTHESIS,
  }[argType] || 'argument:generic'
}

// ── Вычислить отношения нового аргумента ─────────────────────────────────────

export function inferRelations(arg, allArgs) {
  const rels = []

  if (arg.targetArgId) {
    const target = allArgs.find(a => a.id === arg.targetArgId)
    if (target) {
      if (arg.type === 'COUNTER') {
        // Проверяем: агент соглашается или оспаривает
        const isAgreeing = arg.stance && target.agentId !== arg.agentId &&
          arg.stance === target.stance
        rels.push({
          type: isAgreeing ? RELATIONS.SUPPORTS : RELATIONS.IS_RESPONSE_TO,
          targetId: arg.targetArgId,
        })
        if (arg.isContradiction) {
          rels.push({ type: RELATIONS.CONTRADICTS, targetId: arg.targetArgId })
        }
      } else if (arg.type === 'CHALLENGE') {
        rels.push({ type: RELATIONS.CHALLENGES, targetId: arg.targetArgId })
      } else if (arg.type === 'SUPPORT') {
        rels.push({ type: RELATIONS.SUPPORTS, targetId: arg.targetArgId })
      } else {
        rels.push({ type: RELATIONS.IS_RESPONSE_TO, targetId: arg.targetArgId })
      }
    }
  }

  if (arg.type === 'SYNTHESIS' || arg.type === 'CLOSING') {
    // Синтез обобщает все аргументы этого агента
    const agentArgs = allArgs.filter(a => a.agentId === arg.agentId && a.id !== arg.id)
    for (const prev of agentArgs.slice(-3)) {
      rels.push({ type: RELATIONS.SYNTHESIZES, targetId: prev.id })
    }
  }

  return rels
}

// ── Граф дебатов ─────────────────────────────────────────────────────────────

export function buildDebateGraph(events) {
  const nodes = events.filter(e => e.type?.startsWith('argument:') || e.type === 'vote:cast')
  const edges = []

  for (const node of nodes) {
    for (const rel of (node.relations || [])) {
      edges.push({ from: node.id, to: rel.targetId, type: rel.type })
    }
  }

  return { nodes, edges }
}

// ── Аннотация аргумента (добавляем онтологические поля) ──────────────────────

export function annotateArg(arg, allArgs) {
  return {
    ...arg,
    ontotype:  argOntotype(arg.type),
    relations: inferRelations(arg, allArgs),
  }
}

// ── Экспорт протокола в структуру для KAG ────────────────────────────────────

export function exportToKagEntities(session) {
  const entities = []

  // Сессия
  entities.push({
    name:         `ИК: ${session.project?.title || session.projectId}`,
    entityType:   'CommitteeSession',
    observations: [
      `Проект: ${session.project?.title}`,
      `Субфонд: ${session.project?.subFund}`,
      `Решение: ${session.decision?.recommendation}`,
      `Балл: ${session.decision?.aggregatedScore?.toFixed(2)}`,
      `Раундов: ${session.roundNumber}`,
      `Аргументов: ${session.arguments?.length}`,
    ],
  })

  // Аргументы (только ключевые)
  for (const arg of (session.arguments || [])) {
    if (arg.strength > 0.75 || arg.aiGenerated) {
      entities.push({
        name:       `Аргумент ${arg.id.slice(-6)}`,
        entityType: 'CommitteeArgument',
        observations: [
          `Агент: ${arg.agentId}`,
          `Тип: ${arg.ontotype || arg.type}`,
          `Измерение: ${arg.dimension}`,
          `Уверенность: ${arg.confidence?.toFixed(2) || arg.strength?.toFixed(2)}`,
          `Текст: ${arg.text?.slice(0, 200)}`,
        ],
      })
    }
  }

  return entities
}
