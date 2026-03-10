/**
 * Software Event Store — онтология самого программного обеспечения VentureOS
 *
 * Каждый модуль платформы = сущность под entity-типом 'module' в eventStore.
 * Применяем тот же append-only log + state projection что и для GR-проектов.
 */

import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useEventStore } from './eventStore.js'
import { moduleState, moduleHealth, findModuleGaps, nextPossibleActions, platformStats } from '@/services/softModel.js'

// ─── Реестр всех известных модулей платформы ─────────────────────────────────
// Это первичный snapshot состояния, полученный из анализа кодовой базы.
// Каждый модуль seed-ируется при первом открытии FstSoftModel.

export const KNOWN_MODULES = [
  // Страницы — Фаза 0: Поиск
  { id: 'FstHub',          name: 'FstHub',          path: '/fst-hub',          phase: 'Поиск',          hasEventStore: true,  hasAI: false, featureCount: 5,  tags: ['page'] },
  { id: 'FstStartuper',    name: 'FstStartuper',    path: '/fst-startuper',    phase: 'Поиск',          hasEventStore: true,  hasAI: true,  featureCount: 8,  tags: ['page', 'ai'] },
  { id: 'FstSourcing',     name: 'FstSourcing',     path: '/fst-sourcing',     phase: 'Поиск',          hasEventStore: true,  hasAI: true,  featureCount: 4,  tags: ['page', 'ai'] },
  { id: 'FstApply',        name: 'FstApply',        path: '/fst-apply',        phase: 'Подача',         hasEventStore: true,  hasAI: false, featureCount: 4,  tags: ['page'] },
  // Страницы — Фаза 1: Оценка
  { id: 'FstCommittee',    name: 'FstCommittee',    path: '/fst-committee',    phase: 'Оценка',         hasEventStore: true,  hasAI: true,  featureCount: 10, tags: ['page', 'ai', 'core'] },
  { id: 'FstProtocol',     name: 'FstProtocol',     path: '/fst-protocol',     phase: 'Оценка',         hasEventStore: true,  hasAI: false, featureCount: 3,  tags: ['page'] },
  { id: 'FstDuediligence', name: 'FstDuediligence', path: '/fst-dd',           phase: 'Оценка',         hasEventStore: true,  hasAI: false, featureCount: 3,  tags: ['page'] },
  // Страницы — Фаза 2: Структурирование
  { id: 'FstDeal',         name: 'FstDeal',         path: '/fst-deal',         phase: 'Структурир.',    hasEventStore: true,  hasAI: false, featureCount: 6,  tags: ['page'] },
  // Страницы — Фаза 3: Постинвест
  { id: 'FstExecution',    name: 'FstExecution',    path: '/fst-execution',    phase: 'Постинвест',     hasEventStore: true,  hasAI: false, featureCount: 5,  tags: ['page'] },
  // Страницы — Фаза 4: Мониторинг
  { id: 'FstPortfolio',    name: 'FstPortfolio',    path: '/fst-portfolio',    phase: 'Мониторинг',     hasEventStore: true,  hasAI: false, featureCount: 7,  tags: ['page'] },
  { id: 'FstDigitalTwin',  name: 'FstDigitalTwin',  path: '/fst-twin',         phase: 'Мониторинг',     hasEventStore: true,  hasAI: false, featureCount: 6,  tags: ['page', 'simulation'] },
  // Страницы — Фаза 5: Управление фондом
  { id: 'FstFundTwin',     name: 'FstFundTwin',     path: '/fst-fund',         phase: 'Фонд-индекс',    hasEventStore: true,  hasAI: false, featureCount: 5,  tags: ['page', 'simulation'] },
  { id: 'FstGov',          name: 'FstGov',          path: '/fst-gov',          phase: 'Управление',     hasEventStore: true,  hasAI: true,  featureCount: 9,  tags: ['page', 'ai', 'game'] },
  { id: 'FstGrants',       name: 'FstGrants',       path: '/fst-grants',       phase: 'Управление',     hasEventStore: true,  hasAI: false, featureCount: 3,  tags: ['page'] },
  // Ядро — Stores
  { id: 'eventStore',          name: 'eventStore',          path: 'src/stores/eventStore.js',          phase: 'Ядро', hasEventStore: false, hasAI: false, featureCount: 8, testCount: 32, tags: ['store', 'core'] },
  { id: 'grEventStore',        name: 'grEventStore',        path: 'src/stores/grEventStore.js',        phase: 'Ядро', hasEventStore: false, hasAI: false, featureCount: 5,  tags: ['store'] },
  // Ядро — Сервисы
  { id: 'grEventEngine',         name: 'grEventEngine',         path: 'src/services/grEventEngine.js',         phase: 'Ядро', hasEventStore: false, hasAI: false, featureCount: 7,  testCount: 38, tags: ['service', 'core'] },
  { id: 'grMeasuresService',     name: 'grMeasuresService',     path: 'src/services/grMeasuresService.js',     phase: 'Ядро', hasEventStore: false, hasAI: false, featureCount: 4,  tags: ['service'] },
  { id: 'grOntologyGraph',       name: 'grOntologyGraph',       path: 'src/services/grOntologyGraph.js',       phase: 'Ядро', hasEventStore: false, hasAI: false, featureCount: 5,  tags: ['service', 'graph'] },
  { id: 'softModel',             name: 'softModel',             path: 'src/services/softModel.js',             phase: 'Ядро', hasEventStore: false, hasAI: false, featureCount: 5,  testCount: 47, tags: ['service', 'meta'] },
  { id: 'crossEntityReactor',    name: 'crossEntityReactor',    path: 'src/services/crossEntityReactor.js',    phase: 'Ядро', hasEventStore: false, hasAI: false, featureCount: 5,  testCount: 27, tags: ['service', 'graph', 'core'] },
  // Компоненты
  { id: 'GrBossArena',         name: 'GrBossArena',         path: 'src/components/gr/GrBossArena.vue', phase: 'Компонент', hasEventStore: false, hasAI: false, featureCount: 4, tags: ['component', 'game'] },
  { id: 'FstCommitteeEngine',  name: 'FstCommitteeEngine',  path: 'src/components/fst-committee/FstCommitteeEngine.js', phase: 'Компонент', hasEventStore: false, hasAI: true, featureCount: 6, tags: ['service', 'ai', 'core'] },
]

export const useSoftEventStore = defineStore('softEvents', () => {
  const eventStore = useEventStore()

  // ─── Делегация хранения ─────────────────────────────────────────────────────

  function getTimeline(moduleId) {
    return eventStore.getTimeline('module', moduleId)
  }

  function addEvent(moduleId, type, data = {}) {
    return eventStore.add('module', moduleId, type, data)
  }

  // ─── Проекции ───────────────────────────────────────────────────────────────

  function getState(moduleId) {
    return moduleState(getTimeline(moduleId))
  }

  function getHealth(moduleId) {
    return moduleHealth(getTimeline(moduleId))
  }

  function getGaps(moduleId) {
    return findModuleGaps(getTimeline(moduleId))
  }

  function getNextActions(moduleId) {
    return nextPossibleActions(getTimeline(moduleId))
  }

  // ─── Seed: первичный импорт состояния из кодовой базы ─────────────────────

  function seedModule(mod) {
    const existing = getTimeline(mod.id)
    if (existing.length > 0) return // уже есть данные

    addEvent(mod.id, 'MODULE_BORN', { name: mod.name, path: mod.path, phase: mod.phase, tags: mod.tags })

    for (let i = 0; i < (mod.featureCount || 0); i++) {
      addEvent(mod.id, 'FEATURE_ADDED', { auto: true, index: i + 1 })
    }

    if (mod.hasEventStore) {
      addEvent(mod.id, 'EVENT_CONNECTED', { auto: true })
    } else {
      addEvent(mod.id, 'COVERAGE_GAP', { gap: 'no_event_store', auto: true })
    }

    if (mod.hasAI) {
      addEvent(mod.id, 'AI_CONNECTED', { auto: true })
    }

    if (mod.testCount > 0) {
      addEvent(mod.id, 'TEST_ADDED', { count: mod.testCount, auto: true })
      addEvent(mod.id, 'TEST_PASSED', { count: mod.testCount, auto: true })
    }

    // Все модули задеплоены (платформа живая)
    addEvent(mod.id, 'DEPLOYED', { env: 'production', url: 'ai2fund.ru', auto: true })
  }

  function seedAll() {
    for (const mod of KNOWN_MODULES) {
      seedModule(mod)
    }
  }

  // ─── Платформенная статистика ────────────────────────────────────────────────

  const stats = computed(() => {
    const timelines = {}
    for (const mod of KNOWN_MODULES) {
      timelines[mod.id] = getTimeline(mod.id)
    }
    return platformStats(timelines)
  })

  // Список всех module-id из eventStore
  const moduleIds = computed(() => eventStore.getIds('module'))

  async function load() {
    return eventStore.load('module', '_all')
  }

  // ─── Ручное добавление события для модуля ─────────────────────────────────

  function recordBugFound(moduleId, description) {
    addEvent(moduleId, 'BUG_FOUND', { description })
  }

  function recordBugFixed(moduleId, description) {
    addEvent(moduleId, 'BUG_FIXED', { description })
  }

  function recordTestAdded(moduleId, name) {
    addEvent(moduleId, 'TEST_ADDED', { name })
  }

  function recordTestPassed(moduleId, name) {
    addEvent(moduleId, 'TEST_PASSED', { name })
  }

  function recordFeature(moduleId, description) {
    addEvent(moduleId, 'FEATURE_ADDED', { description })
  }

  return {
    getTimeline,
    addEvent,
    getState,
    getHealth,
    getGaps,
    getNextActions,
    seedAll,
    seedModule,
    stats,
    moduleIds,
    load,
    recordBugFound,
    recordBugFixed,
    recordTestAdded,
    recordTestPassed,
    recordFeature,
    KNOWN_MODULES,
  }
})
