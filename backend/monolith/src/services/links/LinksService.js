/**
 * fstLinksService.js — Links Platform для ФСТ НТИ
 *
 * Реализует модель LinksPlatform (github.com/konard/LinksPlatform):
 * всё — дублет (source → target), связи — первоклассные объекты,
 * связи могут ссылаться на другие связи (гипер-граф).
 *
 * Хранение: таблица "Связь" (typeId 4049) в базе fst (Integram)
 *
 * Типы источников/целей:
 *   'company'   — компания портфеля (fst)
 *   'deal'      — сделка (fst)
 *   'concept'   — концепт онтологии БПЛА (kval, typeId 1673250)
 *   'fund'      — фонд (fst)
 *   'session'   — сессия инвесткомитета
 *   'link'      — ссылка на другую связь (гипер-граф)
 *
 * Типы связей:
 *   'uses'        — использует технологию
 *   'produces'    — производит продукт
 *   'part-of'     — входит в состав
 *   'is-a'        — является разновидностью
 *   'applies-to'  — применяется в области
 *   'competes'    — конкурирует с
 *   'invests-in'  — инвестирует в
 *   'related'     — общая связь
 */

import integramApiClient from './integramApiClient'

const LINKS_TYPE_ID = 4049
const LINKS_DATABASE = 'fst'

const R = {
  SOURCE_ID:   '4051',
  SOURCE_TYPE: '4053',
  TARGET_ID:   '4055',
  TARGET_TYPE: '4057',
  LINK_TYPE:   '4059',
  WEIGHT:      '4061',
  META:        '4063',
}

export const LINK_TYPES = {
  'uses':       { label: 'Использует', icon: 'pi pi-wrench',     color: '#6366f1' },
  'produces':   { label: 'Производит', icon: 'pi pi-box',        color: '#10b981' },
  'part-of':    { label: 'Входит в',   icon: 'pi pi-sitemap',    color: '#f59e0b' },
  'is-a':       { label: 'Является',   icon: 'pi pi-tag',        color: '#8b5cf6' },
  'applies-to': { label: 'Применяется',icon: 'pi pi-th-large',   color: '#14b8a6' },
  'competes':   { label: 'Конкурирует',icon: 'pi pi-arrows-h',   color: '#ef4444' },
  'invests-in': { label: 'Инвестирует',icon: 'pi pi-chart-line', color: '#3b82f6' },
  'related':    { label: 'Связано',    icon: 'pi pi-link',       color: '#6b7280' },
}

async function ensureDb() {
  if (!integramApiClient.isAuthenticated()) {
    integramApiClient.loadSession()
  }
  if (!integramApiClient.isAuthenticated()) {
    // Auto-auth with system credentials (no user login required)
    const login = import.meta.env.VITE_INTEGRAM_LOGIN || import.meta.env.VITE_FST_LOGIN || ''
    const password = import.meta.env.VITE_INTEGRAM_PASSWORD || import.meta.env.VITE_FST_PASSWORD || ''
    if (login && password) {
      try {
        await integramApiClient.authenticate(LINKS_DATABASE, login, password)
      } catch {}
    }
  }
  if (integramApiClient.isAuthenticated() && integramApiClient.getDatabase() !== LINKS_DATABASE) {
    integramApiClient.setDatabase(LINKS_DATABASE)
  }
  return integramApiClient.isAuthenticated()
}

/**
 * Создать связь между двумя сущностями
 * @param {number|string} sourceId
 * @param {string} sourceType  — 'company' | 'deal' | 'concept' | ...
 * @param {number|string} targetId
 * @param {string} targetType
 * @param {string} linkType    — ключ из LINK_TYPES
 * @param {number} weight      — 0–100, уверенность/сила связи
 * @param {object} meta        — произвольные данные
 * @returns {object} созданная связь
 */
export async function createLink(sourceId, sourceType, targetId, targetType, linkType = 'related', weight = 50, meta = {}) {
  await ensureDb()
  const label = `${sourceType}:${sourceId} → ${targetType}:${targetId}`
  const result = await integramApiClient.createObject(LINKS_TYPE_ID, label, {
    [R.SOURCE_ID]:   String(sourceId),
    [R.SOURCE_TYPE]: sourceType,
    [R.TARGET_ID]:   String(targetId),
    [R.TARGET_TYPE]: targetType,
    [R.LINK_TYPE]:   linkType,
    [R.WEIGHT]:      String(weight),
    [R.META]:        JSON.stringify(meta),
  })
  return { id: result.id, sourceId, sourceType, targetId, targetType, linkType, weight, meta }
}

/**
 * Гипер-связь: связь между двумя уже существующими связями
 * (реализует LinksPlatform принцип — связи сами могут быть источником/целью)
 */
export async function linkLinks(linkId1, linkId2, linkType = 'related', weight = 50) {
  return createLink(linkId1, 'link', linkId2, 'link', linkType, weight)
}

/**
 * Получить все связи для сущности (в любую сторону)
 */
export async function getLinks(entityId, entityType = null) {
  await ensureDb()
  try {
    const bySource = await integramApiClient.getObjectList(LINKS_TYPE_ID, {
      [`r${R.SOURCE_ID}`]: String(entityId),
      ...(entityType ? { [`r${R.SOURCE_TYPE}`]: entityType } : {}),
      limit: 200,
    })
    const byTarget = await integramApiClient.getObjectList(LINKS_TYPE_ID, {
      [`r${R.TARGET_ID}`]: String(entityId),
      ...(entityType ? { [`r${R.TARGET_TYPE}`]: entityType } : {}),
      limit: 200,
    })

    const parse = (response, direction) =>
      (response?.object || []).map(obj => {
        const reqs = response.reqs?.[obj.id] || {}
        return {
          id: obj.id,
          direction,
          sourceId:   reqs[R.SOURCE_ID],
          sourceType: reqs[R.SOURCE_TYPE],
          targetId:   reqs[R.TARGET_ID],
          targetType: reqs[R.TARGET_TYPE],
          linkType:   reqs[R.LINK_TYPE] || 'related',
          weight:     Number(reqs[R.WEIGHT] || 50),
          meta:       tryParse(reqs[R.META]),
        }
      })

    return [
      ...parse(bySource, 'outgoing'),
      ...parse(byTarget, 'incoming'),
    ]
  } catch {
    return []
  }
}

/**
 * Получить все концепты онтологии БПЛА, связанные с компанией
 */
export async function getConceptsForCompany(companyId) {
  const links = await getLinks(companyId, 'company')
  return links
    .filter(l => l.targetType === 'concept' || l.sourceType === 'concept')
    .map(l => ({
      conceptId: l.targetType === 'concept' ? l.targetId : l.sourceId,
      linkType:  l.linkType,
      weight:    l.weight,
      direction: l.direction,
      linkId:    l.id,
    }))
}

/**
 * Получить все компании, связанные с концептом онтологии
 */
export async function getCompaniesForConcept(conceptId) {
  const links = await getLinks(conceptId, 'concept')
  return links
    .filter(l => l.targetType === 'company' || l.sourceType === 'company')
    .map(l => ({
      companyId: l.targetType === 'company' ? l.targetId : l.sourceId,
      linkType:  l.linkType,
      weight:    l.weight,
      linkId:    l.id,
    }))
}

/**
 * Удалить связь
 */
export async function deleteLink(linkId) {
  await ensureDb()
  return integramApiClient.deleteObject(linkId)
}

/**
 * Получить все связи (для визуализации графа)
 */
export async function getAllLinks(limit = 500) {
  await ensureDb()
  try {
    const response = await integramApiClient.getObjectList(LINKS_TYPE_ID, { limit })
    return (response?.object || []).map(obj => {
      const reqs = response.reqs?.[obj.id] || {}
      return {
        id:         obj.id,
        sourceId:   reqs[R.SOURCE_ID],
        sourceType: reqs[R.SOURCE_TYPE],
        targetId:   reqs[R.TARGET_ID],
        targetType: reqs[R.TARGET_TYPE],
        linkType:   reqs[R.LINK_TYPE] || 'related',
        weight:     Number(reqs[R.WEIGHT] || 50),
        meta:       tryParse(reqs[R.META]),
      }
    })
  } catch {
    return []
  }
}

// ── Subfund → UAV ontology concept mapping ───────────────────
const SUBFUND_CONCEPTS = {
  'БАС':  [
    { id: 1673296, name: 'БПЛА / Дрон' },
    { id: 1673319, name: 'Промышленный БПЛА' },
    { id: 1673303, name: 'Гражданский БПЛА' },
  ],
  'МЭ':   [
    { id: 1697337, name: 'Компонент' },
    { id: 1692129, name: 'Сенсоры и полезная нагрузка' },
    { id: 1692121, name: 'Навигация (GNSS/RTK)' },
  ],
  'РОБО': [
    { id: 1673326, name: 'С/х БПЛА' },
    { id: 1692160, name: 'Сельское хозяйство' },
    { id: 1692184, name: 'Мониторинг и инспекция' },
  ],
  'НТИ':  [
    { id: 1692145, name: 'ИИ и машинное зрение' },
    { id: 1692113, name: 'Автопилот / Полётный контроллер' },
    { id: 1692106, name: 'Технологии БПЛА' },
  ],
}

/**
 * Авто-тег: создать связи session → ontology concepts по субфонду
 * Вызывается в фазе LOADING инвесткомитета
 */
export async function tagSessionWithConcepts(sessionId, subFund) {
  const concepts = SUBFUND_CONCEPTS[subFund] || SUBFUND_CONCEPTS['БАС']
  const results = []
  for (const c of concepts) {
    try {
      const link = await createLink(sessionId, 'session', c.id, 'concept', 'applies-to', 80, {
        conceptName: c.name, subFund
      })
      results.push(link)
    } catch {}
  }
  return results
}

/**
 * Детектировать пересечения проекта с портфелем по онтологии
 * Возвращает: [{ companyId, companyName, conceptId, conceptName, linkType, overlap }]
 */
export async function detectPortfolioOverlap(subFund) {
  await ensureDb()
  try {
    const allLinks = await getAllLinks(500)
    const projectConcepts = (SUBFUND_CONCEPTS[subFund] || []).map(c => String(c.id))

    // Найти компании, у которых те же концепты
    const overlaps = allLinks.filter(l =>
      l.sourceType === 'company' && l.targetType === 'concept' &&
      projectConcepts.includes(String(l.targetId))
    )

    return overlaps.map(l => ({
      companyId:   l.sourceId,
      companyName: l.meta?.companyName || `Компания #${l.sourceId}`,
      conceptId:   l.targetId,
      conceptName: l.meta?.conceptName || `Концепт #${l.targetId}`,
      linkType:    l.linkType,
      weight:      l.weight,
    }))
  } catch {
    return []
  }
}

/**
 * Связать аргумент дебатов с концептом онтологии
 * Реализует гипер-граф: аргумент → концепт
 */
export async function linkArgumentToConcept(argId, conceptId, conceptName, weight = 60) {
  return createLink(argId, 'argument', conceptId, 'concept', 'references', weight, { conceptName })
}

/**
 * После APPROVE: зафиксировать решение ИК как связь session → company
 */
export async function recordSessionDecision(sessionId, companyId, companyName, verdict, score) {
  const linkType = verdict === 'APPROVE' ? 'invests-in' : 'related'
  return createLink(sessionId, 'session', companyId, 'company', linkType, score, {
    verdict, score, companyName, sessionId, decidedAt: new Date().toISOString()
  })
}

/**
 * Получить полный граф: компании + концепты + сессии + аргументы
 * для визуализации LinksGraphViz
 */
export async function getFullGraph() {
  const links = await getAllLinks(1000)
  const nodes = new Map()
  const edges = []

  const typeColors = {
    company:  '#3b82f6',
    concept:  '#8b5cf6',
    session:  '#f59e0b',
    argument: '#6b7280',
    link:     '#14b8a6',
  }
  const typeIcons = {
    company:  '🏢',
    concept:  '🔷',
    session:  '⚖️',
    argument: '💬',
  }

  for (const l of links) {
    const sid = `${l.sourceType}:${l.sourceId}`
    const tid = `${l.targetType}:${l.targetId}`

    if (!nodes.has(sid)) {
      nodes.set(sid, {
        id:    sid,
        label: l.meta?.companyName || l.meta?.conceptName || `${typeIcons[l.sourceType] || ''}#${l.sourceId}`,
        type:  l.sourceType,
        color: typeColors[l.sourceType] || '#6b7280',
      })
    }
    if (!nodes.has(tid)) {
      nodes.set(tid, {
        id:    tid,
        label: l.meta?.conceptName || l.meta?.companyName || `${typeIcons[l.targetType] || ''}#${l.targetId}`,
        type:  l.targetType,
        color: typeColors[l.targetType] || '#6b7280',
      })
    }

    edges.push({
      id:     String(l.id),
      source: sid,
      target: tid,
      label:  LINK_TYPES[l.linkType]?.label || l.linkType,
      color:  LINK_TYPES[l.linkType]?.color || '#6b7280',
      weight: l.weight,
    })
  }

  return { nodes: [...nodes.values()], edges }
}

function tryParse(str) {
  try { return str ? JSON.parse(str) : {} }
  catch { return {} }
}
