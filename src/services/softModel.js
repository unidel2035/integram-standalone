/**
 * Software Model — движок событийной онтологии для самого ПО VentureOS
 *
 * Аналог grEventEngine.js — но субъект наблюдения это сами модули платформы.
 *
 * API:
 *   moduleState(events)          → текущее состояние модуля
 *   moduleHealth(events)         → health score 0–100
 *   findModuleGaps(events)       → пробелы в покрытии
 *   nextPossibleActions(events)  → что нужно сделать дальше
 *   platformStats(timelines)     → агрегат по всей платформе
 */

import { SOFT_GAP_TYPES } from '@/config/softEventTypes.js'

// ─── Проекция: лента событий → состояние модуля ───────────────────────────────

export function moduleState(events = []) {
  return events.reduce((state, evt) => {
    switch (evt.type) {
      case 'MODULE_BORN':
        return { ...state, created: evt.ts, name: evt.data?.name || state.name, path: evt.data?.path, phase: evt.data?.phase }

      case 'FEATURE_ADDED':
        return { ...state, featureCount: (state.featureCount || 0) + 1, lastActivity: evt.ts }

      case 'EVENT_CONNECTED':
        return { ...state, hasEventStore: true }

      case 'AI_CONNECTED':
        return { ...state, hasAI: true }

      case 'STORE_CONNECTED':
        return { ...state, hasStore: true }

      case 'TEST_ADDED':
        return { ...state, testCount: (state.testCount || 0) + 1 }

      case 'TEST_PASSED':
        return { ...state, testsPassedCount: (state.testsPassedCount || 0) + 1 }

      case 'BUG_FOUND':
        return { ...state, openBugs: (state.openBugs || 0) + 1 }

      case 'BUG_FIXED':
        return { ...state, openBugs: Math.max(0, (state.openBugs || 0) - 1) }

      case 'INTEGRATION_ADDED':
        return { ...state, integrations: [...(state.integrations || []), evt.data?.with].filter(Boolean) }

      case 'DEPLOYED':
        return { ...state, lastDeploy: evt.ts, isDeployed: true }

      case 'COVERAGE_GAP':
        return {
          ...state,
          detectedGaps: [...new Set([...(state.detectedGaps || []), evt.data?.gap].filter(Boolean))],
        }

      case 'GAP_CLOSED':
        return { ...state, detectedGaps: (state.detectedGaps || []).filter(g => g !== evt.data?.gap) }

      case 'REFACTOR_DONE':
        return { ...state, refactorCount: (state.refactorCount || 0) + 1 }

      default:
        return state
    }
  }, {
    featureCount: 0,
    testCount: 0,
    testsPassedCount: 0,
    openBugs: 0,
    hasEventStore: false,
    hasAI: false,
    hasStore: false,
    isDeployed: false,
    integrations: [],
    detectedGaps: [],
    refactorCount: 0,
  })
}

// ─── Health score 0–100 ───────────────────────────────────────────────────────

export function moduleHealth(events = []) {
  const state = moduleState(events)
  let score = 20 // baseline существования

  if (state.hasEventStore)                  score += 25
  if (state.testCount > 0)                  score += 20
  if (state.testsPassedCount > 0)           score += 10
  if (state.hasAI)                          score += 10
  if (state.isDeployed)                     score += 10
  if ((state.integrations || []).length > 0) score += 5
  if (state.openBugs > 0)                   score -= state.openBugs * 15
  if ((state.detectedGaps || []).length > 0) score -= state.detectedGaps.length * 5

  return Math.max(0, Math.min(100, score))
}

// ─── Цвет по health score ─────────────────────────────────────────────────────

export function healthColor(score) {
  if (score >= 80) return '#4caf50'
  if (score >= 60) return '#8bc34a'
  if (score >= 40) return '#ffc107'
  if (score >= 20) return '#ff9800'
  return '#f44336'
}

// ─── Gap-анализ ───────────────────────────────────────────────────────────────

export function findModuleGaps(events = []) {
  const state = moduleState(events)
  const gaps = []

  if (!state.hasEventStore) {
    gaps.push({ ...SOFT_GAP_TYPES.no_event_store })
  }
  if (state.testCount === 0 && state.featureCount > 0) {
    gaps.push({ ...SOFT_GAP_TYPES.no_tests })
  }
  if (!state.hasAI) {
    gaps.push({ ...SOFT_GAP_TYPES.no_ai })
  }
  if (state.openBugs > 0) {
    gaps.push({ ...SOFT_GAP_TYPES.open_bugs, count: state.openBugs })
  }

  return gaps
}

// ─── Следующие возможные действия ────────────────────────────────────────────

export function nextPossibleActions(events = []) {
  const state = moduleState(events)
  const hasModule = events.some(e => e.type === 'MODULE_BORN')
  const possible = []

  if (!hasModule) return possible

  if (!state.hasEventStore) {
    possible.push({
      type: 'EVENT_CONNECTED',
      priority: 'critical',
      label: 'Подключить EventStore',
      reason: 'Состояние теряется при перезагрузке — события не персистентны',
      icon: 'pi pi-link',
      color: '#ef4444',
    })
  }

  if (state.testCount === 0 && state.featureCount > 0) {
    possible.push({
      type: 'TEST_ADDED',
      priority: 'high',
      label: 'Написать тесты',
      reason: `${state.featureCount} фич без тестов — регрессии найдёт только продакшн`,
      icon: 'pi pi-check-square',
      color: '#fbbf24',
    })
  }

  if (!state.hasAI) {
    possible.push({
      type: 'AI_CONNECTED',
      priority: 'medium',
      label: 'Добавить AI',
      reason: 'Модуль без AI — пропущена ключевая ценность платформы VentureOS',
      icon: 'pi pi-microchip-ai',
      color: '#f59e0b',
    })
  }

  if (state.openBugs > 0) {
    possible.push({
      type: 'BUG_FIXED',
      priority: 'critical',
      label: `Закрыть ${state.openBugs} баг(ов)`,
      reason: 'Открытые баги снижают надёжность и пользовательский опыт',
      icon: 'pi pi-wrench',
      color: '#ef4444',
    })
  }

  if (state.hasEventStore && state.testCount === 0) {
    possible.push({
      type: 'TEST_ADDED',
      priority: 'high',
      label: 'Тест для eventStore интеграции',
      reason: 'EventStore подключён, но нет теста что события реально сохраняются',
      icon: 'pi pi-check-square',
      color: '#22c55e',
    })
  }

  const order = { critical: 0, high: 1, medium: 2, low: 3 }
  return possible.sort((a, b) => (order[a.priority] ?? 99) - (order[b.priority] ?? 99))
}

// ─── Контрфактика: что если бы это событие не произошло? ─────────────────────

export function counterfactual(events, removeType) {
  const without = events.filter(e => e.type !== removeType)
  return {
    removedType: removeType,
    removedCount: events.length - without.length,
    stateBefore: moduleState(without),
    stateAfter: moduleState(events),
    healthDelta: moduleHealth(events) - moduleHealth(without),
    gapsBefore: findModuleGaps(without),
    gapsAfter: findModuleGaps(events),
  }
}

// ─── Платформенная агрегация ──────────────────────────────────────────────────

export function platformStats(moduleTimelines) {
  const modules = Object.entries(moduleTimelines).map(([id, events]) => {
    const state = moduleState(events)
    const health = moduleHealth(events)
    const gaps = findModuleGaps(events)
    const next = nextPossibleActions(events)
    return { id, state, health, gaps, next, eventCount: events.length }
  })

  const total = modules.length
  if (!total) return { total: 0, modules: [] }

  const withEventStore = modules.filter(m => m.state.hasEventStore).length
  const withTests      = modules.filter(m => m.state.testCount > 0).length
  const withAI         = modules.filter(m => m.state.hasAI).length
  const deployed       = modules.filter(m => m.state.isDeployed).length
  const totalBugs      = modules.reduce((s, m) => s + (m.state.openBugs || 0), 0)
  const avgHealth      = Math.round(modules.reduce((s, m) => s + m.health, 0) / total)
  const criticalGaps   = modules.reduce((s, m) => s + m.gaps.filter(g => g.severity === 'critical').length, 0)
  const criticalModules = modules.filter(m => m.health < 40)

  return {
    total,
    withEventStore,
    withTests,
    withAI,
    deployed,
    totalBugs,
    avgHealth,
    criticalGaps,
    criticalModules: criticalModules.map(m => m.id),
    coverage: {
      eventStore: Math.round(withEventStore / total * 100),
      tests:      Math.round(withTests / total * 100),
      ai:         Math.round(withAI / total * 100),
      deploy:     Math.round(deployed / total * 100),
    },
    modules: modules.sort((a, b) => b.health - a.health),
  }
}
