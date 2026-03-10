/**
 * GR Measures Service — сервис мер государственной поддержки
 *
 * Данные хранятся локально в grMeasuresData.js (обновляются вместе с кодом)
 * При наличии бэкенда — доопциональный refresh из /api/fst/gr/measures
 */

import { GR_MEASURES, matchMeasuresForProject as _matchLocal } from '@/config/grMeasuresData.js'
import { EVENT_CHAINS } from '@/config/grOntology.js'
import { createOntologyGraph } from './grOntologyGraph.js'

// Singleton граф — строится один раз при первом вызове
let _graph = null
function graph() {
  if (!_graph) _graph = createOntologyGraph(GR_MEASURES, EVENT_CHAINS)
  return _graph
}

// ─── Логический вывод (новый основной метод) ──────────────────────────────────

/**
 * Логический вывод применимых мер по профилю проекта
 * Возвращает структуру с цепочками, шагами и пробелами — не просто массив
 *
 * @param {object} project { trl, sector, triggers?, hasCertification?, hasInfra? }
 * @returns {{ chains, allMeasures, gaps }}
 */
export function inferMeasures(project) {
  return graph().infer(project)
}

/**
 * Найти пробелы — шаги цепочек без мер для данного профиля
 */
export function findGaps(project) {
  return graph().findGaps(project)
}

/**
 * Следующие меры после данной (навигация по графу)
 */
export function getNextSteps(measureId) {
  return graph().nextSteps(measureId)
}

/**
 * Маршрут финансирования от текущего TRL к целевому
 */
export function buildRoute(project, targetTrl = 9) {
  return graph().buildRoute(project, targetTrl)
}

// ─── Основные методы ──────────────────────────────────────────────────────────

export function getMeasures(filters = {}) {
  let list = [...GR_MEASURES]
  if (filters.type) list = list.filter(m => m.type === filters.type)
  if (filters.sector) list = list.filter(m => m.sector?.includes(filters.sector))
  if (filters.trl !== undefined) list = list.filter(m => filters.trl >= (m.trl_min || 0) && filters.trl <= (m.trl_max || 9))
  if (filters.search) {
    const q = filters.search.toLowerCase()
    list = list.filter(m => m.name.toLowerCase().includes(q) || (m.operator || '').toLowerCase().includes(q))
  }
  return list
}

export function matchMeasures(project) {
  return _matchLocal(project)
}

/**
 * Группировка по оператору/источнику
 */
export function groupBySource(measures) {
  const groups = {}
  for (const m of measures) {
    if (!groups[m.source]) groups[m.source] = { source: m.source, source_name: m.source_name, items: [] }
    groups[m.source].items.push(m)
  }
  return Object.values(groups)
}

/**
 * Получить уникальные значения для фильтров
 */
export function getFilterOptions(measures = GR_MEASURES) {
  const types = [...new Set(measures.map(m => m.type).filter(Boolean))]
  const sectors = [...new Set(measures.flatMap(m => m.sector || []).filter(Boolean))]
  const sources = [...new Set(measures.map(m => m.source_name).filter(Boolean))]
  return { types, sectors, sources }
}
