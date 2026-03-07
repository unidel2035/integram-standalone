/**
 * fstCommitteeOntology.js — Событийная онтология Инвесткомитета ФСТ НТИ
 *
 * Теоретические основания:
 *   — СМД Щедровицкого: Мышление → Мыслекоммуникация → Мыследействие
 *   — Модель Тулмина (1958): claim / data / warrant / qualifier / rebuttal
 *   — Прагма-диалектика ван Эмерена: типология речевых актов
 *   — IBIS (Rittel, 1970): Issue → Position → Argument
 *   — Эпистемические состояния: KNOWLEDGE / BELIEF / ADVOCACY / DOUBT
 *
 * Каждое событие дебатов — типизированная сущность с семантическими отношениями.
 * Позволяет строить граф аргументов, анализировать логические цепочки,
 * сохранять протокол в базу знаний.
 *
 * @see docs/committee-debate-framework.md
 */

// ── Типы событий ─────────────────────────────────────────────────────────────

export const EVENT_TYPES = {
  // Сессия
  SESSION_STARTED:    'session:started',
  SESSION_CONCLUDED:  'session:concluded',

  // Фазы (прагма-диалектика: Opening → Argumentation → Concluding)
  PHASE_ENTERED:      'phase:entered',
  PHASE_COMPLETED:    'phase:completed',

  // Агент — слой М (Мышление по Щедровицкому, невидимый)
  AGENT_THINKING:     'agent:thinking',
  AGENT_READY:        'agent:ready',

  // ── Аргументы — слой МК (Мыслекоммуникация) ─────────────────────────────
  // Базовые типы (assertive speech acts по Сёрлю)
  ARGUMENT_OPENING:   'argument:opening',    // первичная позиция
  ARGUMENT_CHALLENGE: 'argument:challenge',  // атака на уязвимость
  ARGUMENT_COUNTER:   'argument:counter',    // ответ на вызов
  ARGUMENT_SUPPORT:   'argument:support',    // поддержка чужого аргумента
  ARGUMENT_SYNTHESIS: 'argument:synthesis',  // финальная позиция агента

  // Расширенные речевые акты (Этап 2)
  // directive: агент требует прояснения
  ARGUMENT_QUESTION:    'argument:question',    // "Как вы считали IRR?"
  // commissive: агент берёт условное обязательство
  ARGUMENT_COMMITMENT:  'argument:commitment',  // "Если X — изменю позицию"
  // expressive: частичное признание правоты оппонента
  ARGUMENT_CONCESSION:  'argument:concession',  // "Согласен в части X, но..."
  // retraction: агент отзывает свой предыдущий аргумент
  ARGUMENT_RETRACTION:  'argument:retraction',  // пересмотр позиции

  // Голосование — слой МД (Мыследействие по Щедровицкому)
  VOTE_CAST:          'vote:cast',
  VOTE_FINAL:         'vote:final',

  // Решение
  DECISION_SYNTH:     'decision:synthesized',
  DECISION_HUMAN:     'decision:human:approved',

  // Оркестратор моделей
  MODEL_ASSIGNED:     'model:assigned',
  MODEL_OVERRIDE:     'model:override',

  // IBIS-события (Этап 3)
  ISSUE_RAISED:       'ibis:issue:raised',    // зафиксировано разногласие
  ISSUE_RESOLVED:     'ibis:issue:resolved',  // разногласие снято
  POSITION_FORMED:    'ibis:position:formed', // агент занял позицию по Issue

  // Противоречия и условия — Т-схема Переслегина (Этап 4)
  CONTRADICTION_FOUND:    'contradiction:found',      // обнаружено неснимаемое противоречие
  CONDITION_PROPOSED:     'condition:proposed',        // агент предлагает условие снятия
  CONDITION_ACCEPTED:     'condition:accepted',        // условие принято большинством
  CONDITION_REJECTED:     'condition:rejected',        // условие отклонено
  SYNTHESIS_FORMED:       'synthesis:formed',          // T-синтез: противоречие снято условием
  DEAL_TERMS_ASSEMBLED:   'deal:terms:assembled',      // сформирована модель условий сделки
  SCENARIO_COMPUTED:      'scenario:computed',         // вычислен сценарий при данных условиях
}

// ── Типы отношений между событиями ───────────────────────────────────────────

export const RELATIONS = {
  // Базовые (реализованы)
  IS_RESPONSE_TO: 'isResponseTo',  // аргумент является ответом на
  CHALLENGES:     'challenges',    // атакует / оспаривает warrant или claim
  SUPPORTS:       'supports',      // поддерживает / соглашается с
  SYNTHESIZES:    'synthesizes',   // обобщает группу аргументов
  VOTES_ON:       'votesOn',       // голос относится к сессии/фазе
  CONTRADICTS:    'contradicts',   // прямое противоречие

  // Тулминовские отношения (Этап 1) — атака на конкретный компонент
  CHALLENGES_WARRANT:  'challengesWarrant',  // оспаривает логическую связку
  CHALLENGES_DATA:     'challengesData',     // оспаривает данные
  CHALLENGES_BACKING:  'challengesBacking',  // оспаривает авторитет

  // Эпистемические отношения (Этап 2)
  CONCEDES_TO:    'concedesTo',    // частично соглашается
  RETRACTS:       'retracts',      // отзывает собственный аргумент
  COMMITS_ON:     'commitsOn',     // условное обязательство по аргументу

  // IBIS-отношения (Этап 3)
  RAISES_ISSUE:   'raisesIssue',   // аргумент поднимает Issue
  TAKES_POSITION: 'takesPosition', // аргумент выражает Position по Issue

  // Отношения условий и противоречий (Этап 4)
  RESOLVES:       'resolves',      // условие снимает противоречие (Т-синтез)
  IMPLIES:        'implies',       // аргумент подразумевает условие
  CONSTRAINS:     'constrains',    // условие ограничивает параметр сделки
  ENABLES:        'enables',       // выполнение условия открывает следующий транш
}

// ── Эпистемические состояния агента (по Щедровицкому: М-слой) ───────────────
//
// ROLE         — агент говорит строго с позиции функциональной роли
//                (Юрист не выражает личное мнение — он говорит о праве)
// PERSONAL     — агент выходит из роли и говорит от себя (редко, сильно)
// DEVIL_ADV    — агент намеренно оппонирует для усиления дебатов
//                (может не совпадать с личным убеждением)
// DOUBT        — агент выражает suspension of judgment (данных недостаточно)

export const EPISTEMIC_STANCE = {
  ROLE:        'ROLE',        // с позиции роли (большинство аргументов)
  PERSONAL:    'PERSONAL',    // личная позиция (вне роли)
  DEVIL_ADV:   'DEVIL_ADV',   // дьявольский адвокат
  DOUBT:       'DOUBT',       // воздержание от суждения
}

// ── Тулминовская структура аргумента ─────────────────────────────────────────
//
// Каждый аргумент имеет анатомию:
//   claim    → что утверждается (тезис)
//   data     → на каких данных основано
//   warrant  → логическая связь data → claim
//   backing  → авторитет/прецедент для warrant
//   qualifier → степень уверенности в логике (0–1)
//   rebuttal → при каких условиях тезис неверен
//
// text = развёрнутое изложение всех компонентов (для отображения)
//
// Поля claim/data/warrant/rebuttal добавляются LLM в Этапе 1.
// До Этапа 1 — только text + confidence (текущее состояние).

export const TOULMIN_FIELDS = ['claim', 'data', 'warrant', 'backing', 'qualifier', 'rebuttal']

// Сила аргумента по Тулмину (чем выше — тем труднее опровергнуть)
export function toulminStrength(arg) {
  if (!arg.warrant) return arg.confidence || arg.strength || 0.5
  let score = arg.qualifier ?? arg.confidence ?? 0.7
  if (arg.data)     score += 0.1
  if (arg.backing)  score += 0.05
  if (arg.rebuttal) score -= 0.05  // признание ограничений снижает уязвимость
  return Math.min(1, Math.max(0, score))
}

// Возвращает компонент аргумента, наиболее уязвимый для атаки
export function weakestComponent(arg) {
  if (!arg.warrant)  return 'warrant'   // нет логической связки → атакуй её
  if (!arg.data)     return 'data'      // нет данных → оспаривай основание
  if (!arg.backing)  return 'backing'   // нет авторитета → оспаривай прецедент
  return 'claim'                        // всё есть → атакуй сам тезис
}

// ── Маппинг phase/type → ontotype ────────────────────────────────────────────

export function argOntotype(argType) {
  return {
    OPENING:    EVENT_TYPES.ARGUMENT_OPENING,
    CHALLENGE:  EVENT_TYPES.ARGUMENT_CHALLENGE,
    COUNTER:    EVENT_TYPES.ARGUMENT_COUNTER,
    SUPPORT:    EVENT_TYPES.ARGUMENT_SUPPORT,
    SYNTHESIS:  EVENT_TYPES.ARGUMENT_SYNTHESIS,
    CLOSING:    EVENT_TYPES.ARGUMENT_SYNTHESIS,
    QUESTION:   EVENT_TYPES.ARGUMENT_QUESTION,
    COMMITMENT: EVENT_TYPES.ARGUMENT_COMMITMENT,
    CONCESSION: EVENT_TYPES.ARGUMENT_CONCESSION,
    RETRACTION: EVENT_TYPES.ARGUMENT_RETRACTION,
  }[argType] || 'argument:generic'
}

// ── Вычислить отношения нового аргумента ─────────────────────────────────────
//
// Логика:
//   1. Базовое отношение по типу аргумента
//   2. Тулминовская атака: если цель имеет слабый компонент → уточняем что атакуем
//   3. Эпистемические отношения: CONCESSION, RETRACTION, COMMITMENT
//   4. Синтез: обобщает последние аргументы своего агента

export function inferRelations(arg, allArgs) {
  const rels = []

  if (arg.targetArgId) {
    const target = allArgs.find(a => a.id === arg.targetArgId)
    if (target) {
      if (arg.type === 'COUNTER') {
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
        // Тулмин: определяем что именно атакуется (Этап 1)
        const weak = weakestComponent(target)
        const relType = {
          warrant: RELATIONS.CHALLENGES_WARRANT,
          data:    RELATIONS.CHALLENGES_DATA,
          backing: RELATIONS.CHALLENGES_BACKING,
        }[weak] || RELATIONS.CHALLENGES
        rels.push({ type: relType, targetId: arg.targetArgId, attackedComponent: weak })

      } else if (arg.type === 'SUPPORT') {
        rels.push({ type: RELATIONS.SUPPORTS, targetId: arg.targetArgId })

      } else if (arg.type === 'CONCESSION') {
        // Частичное согласие (Этап 2)
        rels.push({ type: RELATIONS.CONCEDES_TO, targetId: arg.targetArgId })
        rels.push({ type: RELATIONS.SUPPORTS,    targetId: arg.targetArgId })

      } else if (arg.type === 'COMMITMENT') {
        // Условное обязательство привязано к целевому аргументу (Этап 2)
        rels.push({ type: RELATIONS.COMMITS_ON, targetId: arg.targetArgId })

      } else if (arg.type === 'RETRACTION') {
        // Отзыв собственного аргумента (Этап 2)
        rels.push({ type: RELATIONS.RETRACTS, targetId: arg.targetArgId })

      } else if (arg.type === 'QUESTION') {
        // Вопрос привязан к аргументу который вызвал вопрос
        rels.push({ type: RELATIONS.CHALLENGES, targetId: arg.targetArgId })

      } else {
        rels.push({ type: RELATIONS.IS_RESPONSE_TO, targetId: arg.targetArgId })
      }
    }
  }

  if (arg.type === 'SYNTHESIS' || arg.type === 'CLOSING' || arg.type === 'SUMMARY') {
    // Синтез обобщает последние аргументы этого агента
    const agentArgs = allArgs.filter(a => a.agentId === arg.agentId && a.id !== arg.id)
    for (const prev of agentArgs.slice(-3)) {
      rels.push({ type: RELATIONS.SYNTHESIZES, targetId: prev.id })
    }
  }

  return rels
}

// ── IBIS: извлечение Issues из дебатов (Этап 3) ──────────────────────────────
//
// Issue = разногласие, зафиксированное как вопрос.
// Строится автоматически после CROSS_DEBATE на основе CHALLENGE-аргументов.
//
// ibisGraph: { issues: [{ id, text, raisedBy, positions: [{agentId, stance, argIds}] }] }

export function buildIBISGraph(args) {
  const issues = []
  const challenges = args.filter(a => a.type === 'CHALLENGE')

  for (const ch of challenges) {
    const existingIssue = issues.find(i => i.raisedBy === ch.agentId &&
      ch.targetArgId && i.relatedArgIds.includes(ch.targetArgId))
    if (existingIssue) {
      // Добавляем аргумент к существующему Issue
      existingIssue.relatedArgIds.push(ch.id)
      continue
    }

    // Новый Issue
    const issue = {
      id:            `issue_${ch.id}`,
      raisedBy:      ch.agentId,
      dimension:     ch.dimension || 'general',
      relatedArgIds: [ch.id, ch.targetArgId].filter(Boolean),
      // text формируется из claim если есть, иначе из первых 100 символов
      text: ch.claim
        ? ch.claim
        : (ch.text || '').slice(0, 100) + ((ch.text || '').length > 100 ? '…' : ''),
      positions: [],
    }

    // Собираем позиции: все агенты которые высказались по связанным аргументам
    const relatedArgs = args.filter(a =>
      a.id === ch.targetArgId || a.targetArgId === ch.id || a.id === ch.id
    )
    const agentsSeen = new Set()
    for (const ra of relatedArgs) {
      if (agentsSeen.has(ra.agentId)) continue
      agentsSeen.add(ra.agentId)
      issue.positions.push({
        agentId: ra.agentId,
        stance:  ra.stance || 'UNKNOWN',
        argIds:  relatedArgs.filter(x => x.agentId === ra.agentId).map(x => x.id),
      })
    }

    issues.push(issue)
  }

  return { issues }
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
//
// Добавляет:
//   ontotype        — онтологический тип (event type URI)
//   relations       — семантические отношения к другим аргументам
//   epistemicStance — слой М по Щедровицкому (ROLE / PERSONAL / DEVIL_ADV / DOUBT)
//   toulminStrength — сила аргумента по Тулмину (0–1)
//   weakComponent   — наиболее уязвимый компонент для атаки

export function annotateArg(arg, allArgs) {
  // Эпистемический статус: если явно не задан — выводим из типа агента и типа аргумента
  const epistemicStance = arg.epistemicStance || inferEpistemicStance(arg)

  return {
    ...arg,
    ontotype:        argOntotype(arg.type),
    relations:       inferRelations(arg, allArgs),
    epistemicStance,
    toulminStrength: toulminStrength(arg),
    weakComponent:   weakestComponent(arg),
  }
}

// Вывод эпистемического статуса по умолчанию
function inferEpistemicStance(arg) {
  if (arg.agentId === 'devil') return EPISTEMIC_STANCE.DEVIL_ADV
  if (arg.type === 'QUESTION') return EPISTEMIC_STANCE.DOUBT
  if (arg.type === 'CONCESSION' || arg.type === 'RETRACTION') return EPISTEMIC_STANCE.PERSONAL
  return EPISTEMIC_STANCE.ROLE
}

// ══════════════════════════════════════════════════════════════════════════════
// МОДЕЛЬ УСЛОВИЙ СДЕЛКИ — Т-схема Переслегина
// ══════════════════════════════════════════════════════════════════════════════
//
// Философское основание:
//   Переслегин: противоречие — не помеха, а ИСТОЧНИК проекта.
//   Т-схема проектности: Тезис ↔ Антитезис → Синтез через Условие.
//
//   В контексте ИК:
//     "TRL слишком низкий" (Tech → REJECT)     ← Тезис
//     "Рынок огромный" (Portfolio → APPROVE)    ← Антитезис
//     Синтез: CONDITIONAL_APPROVE:              ← Условие снимает противоречие
//       "Транш A только после TRL=6 к Q3 2025"
//
//   Это не голосование — это сборка модели условий сделки.
//   Условия → параметры → сценарии → цифровой двойник сделки.
//   Сценарии с порогами → скелет смарт-контракта.

// ── Типы условий (по природе ограничения) ────────────────────────────────────

export const CONDITION_TYPES = {
  MILESTONE:    'MILESTONE',    // достижение технологической вехи (TRL, MRL)
  FINANCIAL:    'FINANCIAL',    // финансовый показатель (IRR floor, burn rate cap)
  GOVERNANCE:   'GOVERNANCE',   // управление (право вето, наблюдатель в совете)
  REPORTING:    'REPORTING',    // отчётность (KPI, частота, аудит)
  TRANCHE:      'TRANCHE',      // структура транша (поэтапное финансирование)
  SOVEREIGNTY:  'SOVEREIGNTY',  // суверенность (локализация, сертификация)
  TEAM:         'TEAM',         // команда (найм, замена, vesting)
  EXIT:         'EXIT',         // условия выхода (право тега, драга, опцион)
}

// ── Приоритет условия ─────────────────────────────────────────────────────────

export const CONDITION_PRIORITY = {
  BLOCKER:  'BLOCKER',   // без выполнения — нет сделки
  HIGH:     'HIGH',      // существенное, влияет на оценку
  MEDIUM:   'MEDIUM',    // рекомендуемое
  LOW:      'LOW',       // пожелание
}

// ── Конструктор Condition ─────────────────────────────────────────────────────
//
// Condition — единица модели условий сделки.
// Каждое условие:
//   - предложено конкретным агентом
//   - привязано к измерению (trl, finance, team...)
//   - имеет порог и дедлайн (→ смарт-контракт)
//   - влияет на параметры сделки (amount, irr, tranche)
//   - снимает одно или несколько противоречий

export function createCondition({
  proposedBy,
  type,
  priority = CONDITION_PRIORITY.HIGH,
  text,
  metric      = null,   // что измеряем (trl, irr, localizationRatio...)
  threshold   = null,   // пороговое значение
  deadline    = null,   // срок (ISO string или '6 months')
  resolves    = [],     // IDs противоречий которые снимает
  dealImpact  = {},     // { amountDelta, irrDelta, riskDelta, trancheFraction }
}) {
  return {
    id:         `cond_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    proposedBy,
    type,
    priority,
    text,
    metric,
    threshold,
    deadline,
    resolves,
    dealImpact,
    status:     'PROPOSED',  // PROPOSED | ACCEPTED | REJECTED | FULFILLED
    votes:      {},          // { [agentId]: 'FOR' | 'AGAINST' | 'ABSTAIN' }
  }
}

// ── Конструктор Contradiction ─────────────────────────────────────────────────
//
// Contradiction — неснимаемое противоречие между позициями агентов.
// Выявляется автоматически после CROSS_DEBATE.
//
// Т-схема: thesis ↔ antithesis → resolution (условие или синтез)

export function createContradiction({ thesis, antithesis, dimension, severity = 0.5 }) {
  return {
    id:         `contr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    thesis,     // { agentId, argId, claim, stance }
    antithesis, // { agentId, argId, claim, stance }
    dimension,
    severity,   // 0–1: насколько непримиримы позиции
    resolution: null,  // Condition | { type: 'SYNTHESIS', text }
    status:     'OPEN', // OPEN | RESOLVED_BY_CONDITION | RESOLVED_BY_SYNTHESIS | DEFERRED
  }
}

// ── Обнаружение противоречий из дебатов ──────────────────────────────────────
//
// Ищет пары аргументов где:
//   1. Разные агенты, разные stance (один APPROVE, другой REJECT)
//   2. Одинаковое dimension (оба о TRL, или оба о финансах)
//   3. Есть явная связь (challengesWarrant/contradicts) или пересечение измерений

export function detectContradictions(args) {
  const contradictions = []
  const approvers = args.filter(a => a.stance === 'APPROVE' && a.dimension)
  const rejecters = args.filter(a => a.stance === 'REJECT'  && a.dimension)

  for (const pro of approvers) {
    for (const con of rejecters) {
      if (pro.agentId === con.agentId) continue

      const sameDim = pro.dimension === con.dimension

      // Явное противоречие через relations
      const explicitContra = (pro.relations || []).some(r =>
        r.type === 'contradicts' && r.targetId === con.id
      ) || (con.relations || []).some(r =>
        r.type === 'contradicts' && r.targetId === pro.id
      )

      // Перекрёстное противоречие: агенты с полярными stance на разных измерениях.
      // Суть: один говорит "дать деньги" (APPROVE), другой "не давать" (REJECT) —
      // даже если о разных аспектах. Dimension берём от REJECT-агента
      // (он блокирующий — его проблема важнее для разрешения).
      const crossDim = !sameDim && !explicitContra &&
        (pro.toulminStrength || pro.confidence || 0) > 0.55 &&
        (con.toulminStrength || con.confidence || 0) > 0.65

      if (!sameDim && !explicitContra && !crossDim) continue

      // Измерение противоречия: общее > блокирующее (REJECT) > одобряющее
      const dimKey = sameDim ? pro.dimension : con.dimension

      // Уже нашли такое противоречие?
      const exists = contradictions.find(c => c.dimension === dimKey &&
        ((c.thesis.agentId === pro.agentId && c.antithesis.agentId === con.agentId) ||
         (c.thesis.agentId === con.agentId && c.antithesis.agentId === pro.agentId)))
      if (exists) continue

      const severity = ((pro.toulminStrength || pro.confidence || 0.6) +
                        (con.toulminStrength || con.confidence || 0.6)) / 2

      contradictions.push(createContradiction({
        thesis:     { agentId: pro.agentId, argId: pro.id, claim: pro.claim || pro.text?.slice(0, 80), stance: 'APPROVE' },
        antithesis: { agentId: con.agentId, argId: con.id, claim: con.claim || con.text?.slice(0, 80), stance: 'REJECT' },
        dimension:  dimKey,
        severity,
      }))
    }
  }

  // Сортируем по тяжести — самые острые первыми
  return contradictions.sort((a, b) => b.severity - a.severity)
}

// ── Генерация условий из противоречий ────────────────────────────────────────
//
// Для каждого противоречия предлагает условие которое его снимает.
// В Этапе 4 это делает LLM; сейчас — детерминированная логика по измерению.

export function deriveConditionsFromContradictions(contradictions, project) {
  const conditions = []
  const seenDims = new Set()  // одно условие на измерение

  for (const contr of contradictions) {
    const dim = contr.dimension
    // Пропускаем если это измерение уже закрыто условием
    if (seenDims.has(dim)) {
      // Но помечаем что это противоречие тоже снято тем же условием
      const existing = conditions.find(c => c.resolves[0] && contradictions.find(x => x.id === c.resolves[0] && x.dimension === dim))
      if (existing) {
        existing.resolves.push(contr.id)
        contr.resolution = { type: 'CONDITION', conditionId: existing.id }
        contr.status = 'RESOLVED_BY_CONDITION'
      }
      continue
    }
    seenDims.add(dim)
    let cond = null

    if (dim === 'trl' || dim === 'mrl') {
      const target = dim === 'trl' ? Math.max((project.trl || 4) + 2, 6) : Math.max((project.mrl || 3) + 2, 5)
      cond = createCondition({
        proposedBy:  contr.antithesis.agentId,  // кто был против → предлагает условие
        type:        CONDITION_TYPES.MILESTONE,
        priority:    CONDITION_PRIORITY.BLOCKER,
        text:        `Достичь ${dim.toUpperCase()}=${target} до начала Транша A (независимая экспертиза)`,
        metric:      dim,
        threshold:   target,
        deadline:    '6 months',
        resolves:    [contr.id],
        dealImpact:  { riskDelta: -0.15, trancheFraction: 0.3 }, // первый транш 30% до вехи
      })
    } else if (dim === 'finance') {
      cond = createCondition({
        proposedBy:  contr.antithesis.agentId,
        type:        CONDITION_TYPES.FINANCIAL,
        priority:    CONDITION_PRIORITY.HIGH,
        text:        `Подтвердить финансовую модель у 2 независимых аналитиков. IRR floor ${Math.round((project.projectedIRR || 0.25) * 100 * 0.8)}%`,
        metric:      'projectedIRR',
        threshold:   (project.projectedIRR || 0.25) * 0.8,
        deadline:    '3 months',
        resolves:    [contr.id],
        dealImpact:  { irrDelta: -0.03 },
      })
    } else if (dim === 'sovereignty') {
      cond = createCondition({
        proposedBy:  contr.antithesis.agentId,
        type:        CONDITION_TYPES.SOVEREIGNTY,
        priority:    CONDITION_PRIORITY.HIGH,
        text:        `Разработать план импортозамещения критических компонентов до Транша A. Целевой балл суверенности ≥7/9`,
        metric:      'sovereigntyScore',
        threshold:   7,
        deadline:    '4 months',
        resolves:    [contr.id],
        dealImpact:  { riskDelta: -0.1 },
      })
    } else if (dim === 'market') {
      cond = createCondition({
        proposedBy:  contr.antithesis.agentId,
        type:        CONDITION_TYPES.REPORTING,
        priority:    CONDITION_PRIORITY.MEDIUM,
        text:        `Предоставить LOI (письма о намерениях) от 2+ якорных клиентов до Транша B`,
        metric:      'anchorClients',
        threshold:   2,
        deadline:    '9 months',
        resolves:    [contr.id],
        dealImpact:  { irrDelta: 0.03 },
      })
    } else if (dim === 'team') {
      cond = createCondition({
        proposedBy:  contr.antithesis.agentId,
        type:        CONDITION_TYPES.TEAM,
        priority:    CONDITION_PRIORITY.HIGH,
        text:        `Усилить команду: найм CTO/COO с трек-рекордом до начала финансирования. Vesting 4 года`,
        metric:      'teamStrength',
        threshold:   0.7,
        deadline:    '3 months',
        resolves:    [contr.id],
        dealImpact:  { riskDelta: -0.08 },
      })
    } else {
      // Общее условие для неизвестного измерения
      cond = createCondition({
        proposedBy:  contr.antithesis.agentId,
        type:        CONDITION_TYPES.REPORTING,
        priority:    CONDITION_PRIORITY.MEDIUM,
        text:        `Ежеквартальный KPI-отчёт по направлению "${dim}" с правом пересмотра условий`,
        metric:      dim,
        deadline:    'ongoing',
        resolves:    [contr.id],
        dealImpact:  {},
      })
    }

    if (cond) {
      contr.resolution = { type: 'CONDITION', conditionId: cond.id }
      contr.status = 'RESOLVED_BY_CONDITION'
      conditions.push(cond)
    }
  }

  return conditions
}

// ── Сборка модели условий сделки (ConditionalDecision) ────────────────────────
//
// Выход ИК — не просто APPROVE/REJECT, а ConditionalDecision:
//   recommendation: CONDITIONAL_APPROVE | APPROVE | DEFER | REJECT
//   conditions: условия сделки (блокирующие + рекомендательные)
//   dealTerms: параметры сделки с учётом условий
//   scenarios: BASE / OPTIMISTIC / PESSIMISTIC при разных наборах условий
//   contradictions: карта противоречий которые нашли
//
// Это цифровой двойник сделки в момент решения ИК.
// Conditions с metric/threshold/deadline → скелет смарт-контракта.

export function assembleConditionalDecision({ decision, contradictions, conditions, project }) {
  // Принимаем блокирующие условия автоматически, остальные — на усмотрение
  const blockers  = conditions.filter(c => c.priority === CONDITION_PRIORITY.BLOCKER)
  const highConds = conditions.filter(c => c.priority === CONDITION_PRIORITY.HIGH)
  const medConds  = conditions.filter(c => c.priority === CONDITION_PRIORITY.MEDIUM)

  // Финальная рекомендация: если есть блокеры → CONDITIONAL, иначе исходная
  const hasBlockers = blockers.length > 0
  const recommendation = hasBlockers && decision.recommendation === 'APPROVE'
    ? 'CONDITIONAL_APPROVE'
    : decision.recommendation

  // Применяем dealImpact условий к базовым параметрам проекта
  const baseAmount = project.requestedAmount || 0
  const baseIRR    = project.projectedIRR    || 0.25
  let   adjAmount  = baseAmount
  let   adjIRR     = baseIRR
  let   adjRisk    = 0

  for (const cond of [...blockers, ...highConds]) {
    if (cond.dealImpact?.amountDelta)    adjAmount += cond.dealImpact.amountDelta
    if (cond.dealImpact?.irrDelta)       adjIRR    += cond.dealImpact.irrDelta
    if (cond.dealImpact?.riskDelta)      adjRisk   += cond.dealImpact.riskDelta
  }

  // Трансевая структура: если есть TRANCHE условие → разбиваем
  const trancheCond = conditions.find(c => c.type === CONDITION_TYPES.TRANCHE ||
    c.dealImpact?.trancheFraction)
  const trancheStructure = trancheCond
    ? [
        { label: 'Транш A', fraction: trancheCond.dealImpact?.trancheFraction || 0.4, trigger: 'Подписание' },
        { label: 'Транш B', fraction: 1 - (trancheCond.dealImpact?.trancheFraction || 0.4), trigger: trancheCond.text?.slice(0, 60) },
      ]
    : [{ label: 'Полный транш', fraction: 1.0, trigger: 'Подписание' }]

  // Сценарии: BASE / OPTIMISTIC (все условия выполнены) / PESSIMISTIC (блокеры не выполнены)
  const scenarios = {
    BASE: {
      label:       'Базовый',
      probability: 0.50,
      irr:         Math.round(adjIRR * 100),
      amount:      adjAmount,
      exitYear:    project.exitYear || 5,
      description: 'Выполнены блокирующие и HIGH-условия',
    },
    OPTIMISTIC: {
      label:       'Оптимистичный',
      probability: 0.25,
      irr:         Math.round((adjIRR + 0.08) * 100),
      amount:      adjAmount,
      exitYear:    (project.exitYear || 5) - 1,
      description: 'Все условия выполнены досрочно, рынок вырос',
    },
    PESSIMISTIC: {
      label:       'Консервативный',
      probability: 0.25,
      irr:         Math.round((adjIRR - 0.06) * 100),
      amount:      adjAmount * 0.7,   // частичное финансирование
      exitYear:    (project.exitYear || 5) + 2,
      description: 'Блокирующие условия выполнены частично',
    },
  }

  return {
    ...decision,
    recommendation,
    contradictions,
    conditions: [...blockers, ...highConds, ...medConds],
    dealTerms: {
      requestedAmount:  baseAmount,
      adjustedAmount:   adjAmount,
      adjustedIRR:      Math.round(adjIRR * 100),
      adjustedRisk:     adjRisk,
      trancheStructure,
      blockerConditions: blockers.map(c => c.id),
    },
    scenarios,
    // Для смарт-контракта: условия с порогами и дедлайнами
    smartContractSkeleton: conditions
      .filter(c => c.metric && c.threshold !== null)
      .map(c => ({
        conditionId: c.id,
        IF:   `${c.metric} >= ${c.threshold}`,
        BY:   c.deadline,
        THEN: c.type === CONDITION_TYPES.TRANCHE ? 'releaseNextTranche()' : 'flagMilestone()',
        ELSE: 'notifyFund()',
      })),
  }
}

// ── Экспорт протокола в структуру для KAG ────────────────────────────────────

export function exportToKagEntities(session) {
  const entities = []

  // Собираем статистику использования моделей по агентам
  const modelUsage = {}
  for (const arg of (session.arguments || [])) {
    if (arg.model && arg.agentId) {
      if (!modelUsage[arg.agentId]) modelUsage[arg.agentId] = {}
      const shortModel = arg.model.split('/').pop()
      modelUsage[arg.agentId][shortModel] = (modelUsage[arg.agentId][shortModel] || 0) + 1
    }
  }
  const modelSummary = Object.entries(modelUsage)
    .map(([agent, models]) => `${agent}: ${Object.entries(models).map(([m,n]) => `${m}×${n}`).join(',')}`)
    .join(' | ')

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
      `Профиль моделей: ${session.speedProfile || 'fast'}`,
      ...(modelSummary ? [`Модели агентов: ${modelSummary}`] : []),
    ],
  })

  // Аргументы (только ключевые — сила по Тулмину или AI-генерированные)
  for (const arg of (session.arguments || [])) {
    const strength = arg.toulminStrength ?? arg.strength ?? arg.confidence ?? 0
    if (strength > 0.75 || arg.aiGenerated) {
      entities.push({
        name:       `Аргумент ${arg.id.slice(-6)}`,
        entityType: 'CommitteeArgument',
        observations: [
          `Агент: ${arg.agentId}`,
          `Тип речевого акта: ${arg.ontotype || arg.type}`,
          `Эпистемич. статус: ${arg.epistemicStance || 'ROLE'}`,
          `Измерение: ${arg.dimension}`,
          `Тулмин-сила: ${(arg.toulminStrength || strength).toFixed(2)}`,
          ...(arg.claim    ? [`Тезис: ${arg.claim}`] : []),
          ...(arg.warrant  ? [`Логика: ${arg.warrant}`] : []),
          ...(arg.rebuttal ? [`Ограничение: ${arg.rebuttal}`] : []),
          ...(arg.model ? [`Модель: ${arg.model.split('/').pop()}`] : []),
          `Текст: ${arg.text?.slice(0, 200)}`,
        ],
      })
    }
  }

  // IBIS-Issues (если построен граф)
  const ibis = buildIBISGraph(session.arguments || [])
  for (const issue of ibis.issues) {
    entities.push({
      name:       `Issue: ${issue.text.slice(0, 60)}`,
      entityType: 'DebateIssue',
      observations: [
        `Поднято агентом: ${issue.raisedBy}`,
        `Измерение: ${issue.dimension}`,
        `Позиций: ${issue.positions.length}`,
        `Позиции: ${issue.positions.map(p => `${p.agentId}→${p.stance}`).join(', ')}`,
      ],
    })
  }

  return entities
}
