/**
 * BlockDependencyStore — реактивный граф зависимостей между блоками
 *
 * Гибридный подход (как selectorState + selectorStore):
 * - Module-level reactive state — доступен из суб-приложений без Pinia
 * - Pinia store — computed свойства, топологическая сортировка, каскадное обновление
 *
 * Поддерживаемые типы блоков:
 * - finmodel  — FinModel (P&L, Cash Flow и т.д.)
 * - osint     — OSINT метрики (MetricsExtractor)
 * - ontology  — Онтология БПЛА (SKOS таксономия)
 * - ecosystem — Экосистема бизнесов (Leontief, CLD, value streams)
 * - table     — Integram таблица
 * - selector  — Блок-селектор (фильтр)
 *
 * Синтаксис кросс-блочных ссылок:
 *   @[Block "P&L"].Revenue.2025           — FinModel (существующий)
 *   @[OSINT "chyxx"].MarketVolume.latest  — OSINT метрики
 *   @[Ontology "БПЛА"].agriculture.count  — Онтология
 *
 * Issue #7157: Реактивные связанные блоки
 *
 * @module stores/blockDependencyStore
 */

import { reactive, ref, computed } from 'vue'
import { defineStore } from 'pinia'

// ── Module-level reactive state ─────────────────────────────────────────
// Доступен из ЛЮБОГО Vue app instance (включая sub-apps без Pinia)

export const blockDepState = reactive({
  /**
   * Зарегистрированные блоки
   * Map<blockId, BlockInfo>
   *
   * BlockInfo: {
   *   id: string,
   *   name: string,           // человеческое имя ("P&L", "Статьи chyxx")
   *   type: string,           // 'finmodel' | 'osint' | 'ontology' | 'table' | 'selector'
   *   outputs: Object,        // { [path]: value } — экспортируемые значения
   *   meta: Object            // произвольные метаданные (typeId, database и т.д.)
   * }
   */
  blocks: new Map(),

  /**
   * Рёбра графа зависимостей (DAG)
   * Map<edgeId, Edge>
   *
   * Edge: {
   *   id: string,
   *   from: string,           // blockId источника
   *   fromPath: string,       // путь в outputs источника
   *   to: string,             // blockId приёмника
   *   toPath: string,         // путь во входах приёмника
   *   transform: Function|null // опциональная трансформация значения
   * }
   */
  edges: new Map(),

  /**
   * Счётчик версий — инкрементируется при каждом изменении
   * для trigger reactivity (как в selectorState)
   */
  version: 0
})

// ── Module-level functions ──────────────────────────────────────────────

/**
 * Зарегистрировать блок в графе зависимостей
 */
export function registerBlock(blockId, name, type, outputs = {}, meta = {}) {
  blockDepState.blocks.set(blockId, { id: blockId, name, type, outputs, meta })
  blockDepState.version++
}

/**
 * Обновить экспортируемые значения блока
 * @param {string} blockId
 * @param {Object} outputs - { [path]: value }
 */
export function updateBlockOutputs(blockId, outputs) {
  const block = blockDepState.blocks.get(blockId)
  if (!block) return
  block.outputs = { ...block.outputs, ...outputs }
  blockDepState.version++
}

/**
 * Получить значение из блока по blockId и path
 */
export function getBlockValue(blockId, path) {
  const block = blockDepState.blocks.get(blockId)
  if (!block) return null
  return block.outputs[path] ?? null
}

/**
 * Найти блок по имени и типу
 */
export function findBlock(name, type = null) {
  for (const block of blockDepState.blocks.values()) {
    if (block.name === name && (!type || block.type === type)) {
      return block
    }
  }
  return null
}

/**
 * Удалить блок и все его рёбра
 */
export function unregisterBlock(blockId) {
  blockDepState.blocks.delete(blockId)
  // Удалить рёбра, связанные с этим блоком
  for (const [edgeId, edge] of blockDepState.edges) {
    if (edge.from === blockId || edge.to === blockId) {
      blockDepState.edges.delete(edgeId)
    }
  }
  blockDepState.version++
}

/**
 * Добавить ребро (зависимость) между блоками
 */
export function addEdge(fromBlockId, fromPath, toBlockId, toPath, transform = null) {
  const edgeId = `${fromBlockId}:${fromPath}->${toBlockId}:${toPath}`

  // Проверка на цикл
  if (wouldCreateCycle(fromBlockId, toBlockId)) {
    console.warn(`[BlockDependencyStore] Отклонено: ребро ${fromBlockId}->${toBlockId} создаёт цикл`)
    return null
  }

  const edge = { id: edgeId, from: fromBlockId, fromPath, to: toBlockId, toPath, transform }
  blockDepState.edges.set(edgeId, edge)
  blockDepState.version++
  return edgeId
}

/**
 * Удалить ребро
 */
export function removeEdge(edgeId) {
  blockDepState.edges.delete(edgeId)
  blockDepState.version++
}

/**
 * Проверить, создаст ли новое ребро цикл (DFS)
 */
export function wouldCreateCycle(fromBlockId, toBlockId) {
  if (fromBlockId === toBlockId) return true

  // DFS от toBlockId — проверяем, можем ли дойти до fromBlockId
  const visited = new Set()
  const stack = [toBlockId]

  while (stack.length > 0) {
    const current = stack.pop()
    if (current === fromBlockId) return true
    if (visited.has(current)) continue
    visited.add(current)

    // Найти все исходящие рёбра от current
    for (const edge of blockDepState.edges.values()) {
      if (edge.from === current) {
        stack.push(edge.to)
      }
    }
  }

  return false
}

/**
 * Топологическая сортировка (алгоритм Кана)
 * @returns {string[]} blockIds в порядке зависимостей (источники первыми)
 */
export function topologicalSort() {
  const inDegree = new Map()
  const adjacency = new Map()

  // Инициализация
  for (const blockId of blockDepState.blocks.keys()) {
    inDegree.set(blockId, 0)
    adjacency.set(blockId, [])
  }

  // Подсчёт входящих рёбер
  for (const edge of blockDepState.edges.values()) {
    if (inDegree.has(edge.from) && inDegree.has(edge.to)) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
      adjacency.get(edge.from).push(edge.to)
    }
  }

  // Очередь из узлов с нулевой входной степенью
  const queue = []
  for (const [blockId, degree] of inDegree) {
    if (degree === 0) queue.push(blockId)
  }

  const sorted = []
  while (queue.length > 0) {
    const current = queue.shift()
    sorted.push(current)

    for (const neighbor of adjacency.get(current) || []) {
      const newDegree = inDegree.get(neighbor) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  return sorted
}

/**
 * Получить все downstream-блоки (зависящие от данного)
 */
export function getDownstream(blockId) {
  const result = new Set()
  const queue = [blockId]

  while (queue.length > 0) {
    const current = queue.shift()
    for (const edge of blockDepState.edges.values()) {
      if (edge.from === current && !result.has(edge.to)) {
        result.add(edge.to)
        queue.push(edge.to)
      }
    }
  }

  return Array.from(result)
}

/**
 * Получить все upstream-блоки (от которых зависит данный)
 */
export function getUpstream(blockId) {
  const result = new Set()
  const queue = [blockId]

  while (queue.length > 0) {
    const current = queue.shift()
    for (const edge of blockDepState.edges.values()) {
      if (edge.to === current && !result.has(edge.from)) {
        result.add(edge.from)
        queue.push(edge.from)
      }
    }
  }

  return Array.from(result)
}

/**
 * Каскадное обновление: пересчитать все downstream-блоки после изменения
 * Возвращает список обновлённых blockId для уведомления
 */
export function propagate(sourceBlockId) {
  const sorted = topologicalSort()
  const sourceIndex = sorted.indexOf(sourceBlockId)
  if (sourceIndex === -1) return []

  const updated = []

  // Обновляем только блоки после sourceBlockId в топологическом порядке
  for (let i = sourceIndex + 1; i < sorted.length; i++) {
    const blockId = sorted[i]
    const block = blockDepState.blocks.get(blockId)
    if (!block) continue

    // Найти входящие рёбра для этого блока
    const incomingEdges = []
    for (const edge of blockDepState.edges.values()) {
      if (edge.to === blockId) {
        incomingEdges.push(edge)
      }
    }

    // Проверить, зависит ли от обновлённых блоков
    const dependsOnUpdated = incomingEdges.some(
      e => e.from === sourceBlockId || updated.includes(e.from)
    )

    if (dependsOnUpdated) {
      // Пересчитать входные значения
      for (const edge of incomingEdges) {
        const sourceBlock = blockDepState.blocks.get(edge.from)
        if (!sourceBlock) continue

        let value = sourceBlock.outputs[edge.fromPath] ?? null
        if (edge.transform && value !== null) {
          try {
            value = edge.transform(value)
          } catch (e) {
            console.error(`[BlockDependencyStore] Transform error on edge ${edge.id}:`, e)
          }
        }

        // Записываем значение во входы приёмника
        if (!block.outputs.__inputs) block.outputs.__inputs = {}
        block.outputs.__inputs[edge.toPath] = value
      }

      updated.push(blockId)
    }
  }

  blockDepState.version++
  return updated
}

// ── Extended cross-block reference pattern ──────────────────────────────

/**
 * Расширенный паттерн кросс-блочных ссылок:
 *   @[Block "Name"].path.subpath       — FinModel (существующий)
 *   @[OSINT "Name"].path.subpath      — OSINT метрики
 *   @[Ontology "Name"].path.subpath   — Онтология
 *   @[Ecosystem "Name"].path.subpath  — Экосистема
 *   @[Table "Name"].path.subpath      — Integram таблица
 */
export const EXTENDED_CROSS_BLOCK_PATTERN = /@\[(Block|OSINT|Ontology|Ecosystem|Table)\s+"([^"]+)"\]\.([^\s,)]+)/

const TYPE_MAP = {
  'Block': 'finmodel',
  'OSINT': 'osint',
  'Ontology': 'ontology',
  'Ecosystem': 'ecosystem',
  'Table': 'table'
}

/**
 * Распарсить расширенную кросс-блочную ссылку
 */
export function parseExtendedRef(refStr) {
  const match = EXTENDED_CROSS_BLOCK_PATTERN.exec(refStr)
  if (!match) return null

  const blockType = TYPE_MAP[match[1]] || match[1].toLowerCase()
  const blockName = match[2]
  const fullPath = match[3]

  // Разделить путь на части
  const pathParts = fullPath.split('.')

  return {
    blockType,
    blockName,
    fullPath,
    path: pathParts[0],
    subPath: pathParts.slice(1).join('.') || null
  }
}

/**
 * Разрешить расширенную кросс-блочную ссылку
 */
export function resolveExtendedRef(refStr) {
  const parsed = parseExtendedRef(refStr)
  if (!parsed) return null

  const block = findBlock(parsed.blockName, parsed.blockType)
  if (!block) return null

  // Попробовать полный путь, потом частичный
  return block.outputs[parsed.fullPath]
    ?? block.outputs[parsed.path]
    ?? null
}

/**
 * Подставить все расширенные ссылки в формуле
 */
export function substituteExtendedRefs(formula) {
  if (!formula) return formula

  const globalRe = new RegExp(EXTENDED_CROSS_BLOCK_PATTERN.source, 'g')
  return formula.replace(globalRe, (match) => {
    const val = resolveExtendedRef(match)
    return val !== null ? String(val) : '0'
  })
}

// ── Pinia Store ─────────────────────────────────────────────────────────

export const useBlockDependencyStore = defineStore('blockDependency', () => {
  // Реактивный trigger — следит за изменениями module-level state
  const _version = computed(() => blockDepState.version)

  // Computed: список зарегистрированных блоков
  const registeredBlocks = computed(() => {
    void _version.value // dependency tracking
    return Array.from(blockDepState.blocks.values()).map(b => ({
      id: b.id,
      name: b.name,
      type: b.type,
      outputKeys: Object.keys(b.outputs)
    }))
  })

  // Computed: топологический порядок
  const sortedBlockIds = computed(() => {
    void _version.value
    return topologicalSort()
  })

  // Computed: есть ли циклы (sorted < total blocks)
  const hasCycles = computed(() => {
    void _version.value
    return topologicalSort().length < blockDepState.blocks.size
  })

  // Computed: количество рёбер
  const edgeCount = computed(() => {
    void _version.value
    return blockDepState.edges.size
  })

  // Computed: граф для визуализации
  const graphData = computed(() => {
    void _version.value
    const nodes = Array.from(blockDepState.blocks.values()).map(b => ({
      id: b.id,
      label: b.name,
      type: b.type,
      group: b.type
    }))

    const edges = Array.from(blockDepState.edges.values()).map(e => ({
      id: e.id,
      source: e.from,
      target: e.to,
      label: `${e.fromPath} → ${e.toPath}`
    }))

    return { nodes, edges }
  })

  // ── Actions ──

  /**
   * Обновить outputs блока и каскадно пересчитать зависимые
   * @returns {string[]} список обновлённых blockId
   */
  function updateAndPropagate(blockId, outputs) {
    updateBlockOutputs(blockId, outputs)
    return propagate(blockId)
  }

  /**
   * Получить все доступные значения для автокомплита
   */
  function getSuggestions(input) {
    if (!input || !input.includes('@')) return []

    const suggestions = []
    const typeLabels = { finmodel: 'Block', osint: 'OSINT', ontology: 'Ontology', ecosystem: 'Ecosystem', table: 'Table' }

    for (const block of blockDepState.blocks.values()) {
      const label = typeLabels[block.type] || 'Block'
      for (const path of Object.keys(block.outputs)) {
        if (path.startsWith('__')) continue // пропустить внутренние
        suggestions.push({
          ref: `@[${label} "${block.name}"].${path}`,
          value: block.outputs[path],
          blockName: block.name,
          blockType: block.type,
          path
        })
      }
    }

    // Фильтр по input
    const search = input.toLowerCase()
    return suggestions.filter(s =>
      s.ref.toLowerCase().includes(search) ||
      s.blockName.toLowerCase().includes(search)
    )
  }

  /**
   * Сбросить всё (для тестов)
   */
  function reset() {
    blockDepState.blocks.clear()
    blockDepState.edges.clear()
    blockDepState.version++
  }

  return {
    // State (read from module-level)
    _version,
    registeredBlocks,
    sortedBlockIds,
    hasCycles,
    edgeCount,
    graphData,

    // Actions (delegates to module-level)
    registerBlock,
    unregisterBlock,
    updateBlockOutputs,
    updateAndPropagate,
    addEdge,
    removeEdge,
    getBlockValue,
    findBlock,
    getDownstream,
    getUpstream,
    getSuggestions,
    resolveExtendedRef,
    substituteExtendedRefs,
    reset,

    // Direct access to module state (for advanced use)
    state: blockDepState
  }
})
