/**
 * useEventChain — composable для работы с событийной цепочкой ИК
 *
 * Экспортирует generateEventChain() — полный async pipeline:
 *   filterCandidateNodes → buildEnrichPrompt → AI → mergeWithOntology
 *
 * Паттерн: онтология → фильтрация → AI обогащение → ноды
 *
 * AI НЕ придумывает события с нуля.
 * Он оценивает вероятности и горизонты для типизированных событий из grEventTypes.
 */

import { GR_EVENT_TYPES } from '@/config/grEventTypes.js'

// ─── Метаданные цепочек ───────────────────────────────────────────────────────

export const CHAIN_META = {
  market_failure:     { label: 'Рын. провал',  color: 'var(--fst-red)',    icon: 'pi pi-chart-line' },
  tech_gap:           { label: 'Тех. разрыв',  color: 'var(--fst-brand)',  icon: 'pi pi-microchip' },
  regulatory_barrier: { label: 'Регулятор.',   color: 'var(--fst-purple)', icon: 'pi pi-shield' },
  infrastructure_gap: { label: 'Инфра.',       color: 'var(--fst-cyan)',   icon: 'pi pi-server' },
  core:               { label: 'Ключевое',     color: 'var(--fst-blue)',   icon: 'pi pi-star' },
}

// ─── Фильтрация кандидатных нод из онтологии ─────────────────────────────────

/**
 * Отбирает события из GR_EVENT_TYPES, релевантные для данного проекта.
 * Возвращает массив eventDef с сохранённым id.
 */
export function filterCandidateNodes(project = {}) {
  const sectorRaw = (
    project.subfund || project.industry || project.sector || 'БАС'
  ).toUpperCase()

  const isBAS  = sectorRaw.includes('БАС') || sectorRaw.includes('БПЛА') || sectorRaw.includes('ДРОН')
  const isRobo = sectorRaw.includes('РОБ')
  const trl    = parseInt(project.trl) || 4
  const stage  = (project.stage || '').toLowerCase()
  const isEarly = trl <= 5 || stage.includes('pre') || stage.includes('seed')

  const ids = new Set([
    // Ключевые вехи — всегда
    'PROJECT_STARTED',
    'TRL_ADVANCED',
    'PILOT_LAUNCHED',
    'PILOT_COMPLETED',
    'CONTRACT_SIGNED',
    'SCALE_READY',
    'TEAM_HIRED',
  ])

  if (isEarly) {
    // Ранние стадии → диагностика + меры актуальны
    ids.add('MARKET_FAILURE_DETECTED')
    ids.add('TECH_GAP_DETECTED')
    ids.add('MEASURE_APPLIED')
    ids.add('MEASURE_APPROVED')
    ids.add('MEASURE_FUNDED')
    ids.add('MEASURE_REJECTED')
    ids.add('REJECTION_ANALYZED')
  }

  if (isBAS) {
    // БПЛА/БАС → регуляторика критична
    ids.add('REGULATORY_BARRIER_DETECTED')
    ids.add('CERTIFICATION_OBTAINED')
  }

  if (isRobo || !isBAS) {
    // Роботы и другие → инфраструктурный пробел
    ids.add('INFRA_GAP_DETECTED')
  }

  return [...ids]
    .map(id => ({ id, ...(GR_EVENT_TYPES[id] || {}) }))
    .filter(def => def.label) // только реально существующие в онтологии
}

// ─── Промпт для AI-обогащения ─────────────────────────────────────────────────

/**
 * Строит промпт для AI.
 * AI только оценивает вероятности/горизонты/условия — не придумывает новые события.
 */
export function buildEnrichPrompt(candidateNodes, project, decision) {
  const proj = project || {}
  const dec  = decision || {}

  const conditions = (dec.conditions || [])
    .map(c => (typeof c === 'string' ? c : c.text || ''))
    .filter(Boolean)
    .join('; ')

  const nodesList = candidateNodes.map(n =>
    `- id:"${n.id}" label:"${n.label}" phase:"${n.phase}" chain:"${n.chain || 'core'}"`
  ).join('\n')

  return `Ты — AI-аналитик венчурного фонда. Оцени события-вехи стартапа из нашей событийной онтологии.

ПРОЕКТ:
- Название: ${proj.title || proj.name || proj.company || 'стартап'}
- Субфонд / Отрасль: ${proj.subfund || proj.industry || 'БПЛА / БАС'}
- TRL: ${proj.trl || '4-5'}
- Стадия: ${proj.stage || 'Seed'}
- Раунд: ${proj.askRub ? (proj.askRub / 1e6).toFixed(1) + ' млн ₽' : proj.askAmount || 'не указан'}
- Описание: ${proj.description || proj.problem || ''}

УСЛОВИЯ ИК: ${conditions || 'не определены'}

СОБЫТИЯ ИЗ ОНТОЛОГИИ (использовать только эти id — без добавления новых):
${nodesList}

ЗАДАЧА: для каждого события укажи:
1. path — к какому сценарию относится:
   "all" = есть во всех сценариях (стартовые события, диагностика)
   "optimistic" = только в лучшем (SCALE_READY, CERTIFICATION_OBTAINED, крупные контракты)
   "base" = средний вероятный (PILOT_COMPLETED, CONTRACT_SIGNED, TRL_ADVANCED)
   "pessimistic" = риск/неудача (MEASURE_REJECTED и т.п.)
2. probability — вероятность (0-100%), реалистично для этого проекта
3. horizonMonths — горизонт в месяцах от сейчас (0-48)
4. conditions — 2-3 конкретных условия возникновения для данного проекта
5. impact — финансовый/технологический эффект

Не добавляй события, которых нет в списке выше. Используй только указанные id.

Ответь СТРОГО в JSON (без markdown):
{
  "events": [
    {
      "id": "<точный id из списка>",
      "path": "all|optimistic|base|pessimistic",
      "probability": 70,
      "horizonMonths": 6,
      "conditions": [
        { "type": "precondition|trigger|financial|regulatory|tech|market", "text": "Конкретное условие" }
      ],
      "impact": { "revenue": "+30%", "valuation": "+1.5x", "trl": "+1" }
    }
  ]
}`
}

// ─── Мерж AI-ответа с онтологией ─────────────────────────────────────────────

/**
 * Объединяет AI-оценки с онтологическими определениями.
 * Возвращает ноды для ScenarioEventChainPanel.
 */
export function mergeWithOntology(aiEvents, candidateNodes) {
  if (!Array.isArray(aiEvents)) return []

  return aiEvents
    .map((aiEvt, i) => {
      const def = candidateNodes.find(n => n.id === aiEvt.id) || {}
      return {
        id:            aiEvt.id || `e${i}`,
        eventTypeId:   aiEvt.id,
        chain:         def.chain  || null,
        phase:         def.phase  || 'outcome',
        label:         def.label  || aiEvt.id,
        description:   def.description || '',
        icon:          def.icon   || 'pi pi-circle',
        subject:       def.subject || '',
        path:          aiEvt.path || 'base',
        probability:   aiEvt.probability   ?? 60,
        horizonMonths: aiEvt.horizonMonths ?? (i + 1) * 4,
        conditions:    aiEvt.conditions    || [],
        impact:        aiEvt.impact        || {},
        agentVotes:    [],
        // Граф: связи из онтологии (для будущей DAG-визуализации #195)
        enables:       def.enables       || [],
        preconditions: def.preconditions || [],
      }
    })
    .sort((a, b) => a.horizonMonths - b.horizonMonths)
}

// ─── Полный pipeline генерации цепочки ───────────────────────────────────────

/**
 * Генерирует событийную цепочку для проекта через AI.
 * Используется как для авто-старта из FstCommittee, так и вручную из панели.
 *
 * @param {Object} project  — данные проекта
 * @param {Object} decision — решение ИК (опционально)
 * @returns {Promise<ChainNode[]>}
 */
export async function generateEventChain(project, decision = null) {
  const candidates = filterCandidateNodes(project)
  const prompt     = buildEnrichPrompt(candidates, project, decision)

  const res = await fetch('/api/ai-tokens/chat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      modelId:      'anthropic/claude-sonnet-4-20250514',
      prompt,
      systemPrompt: 'Ты — аналитик венчурного фонда. Отвечай только в JSON без markdown.',
      application:  'useEventChain.generateEventChain',
    }),
  })

  const { response } = await res.json()
  const m = response.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('AI вернул неверный формат')

  const data = JSON.parse(m[0])
  if (!data.events?.length) throw new Error('AI вернул пустую цепочку')

  return mergeWithOntology(data.events, candidates)
}
