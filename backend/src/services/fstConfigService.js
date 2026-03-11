/**
 * FST Config Service — конфигурация из Integram БД, не хардкод
 *
 * Все веса, сценарии, реестр экспертов и пороги хранятся в Integram.
 * Этот сервис читает их с кэшом (TTL 5 мин) и предоставляет синхронный
 * геттер с fallback на встроенные дефолты.
 *
 * Integram type structure (БД fst):
 *   FST_CONFIG_TYPE_ID (из env или дефолт 7900) — объекты вида:
 *     name  = ключ конфига (e.g. "factor_weights", "stress_scenarios", "expert_registry")
 *     data  = JSON-строка с содержимым
 *
 * Если тип не создан — используются встроенные дефолты.
 */

import { authenticateIntegram } from '../api/middleware/auth.js'

const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const INTEGRAM_DB = 'fst'
const CONFIG_TYPE_ID = parseInt(process.env.FST_CONFIG_TYPE_ID || '7900', 10)

const CACHE_TTL_MS = 5 * 60 * 1000
let _cache = {}
let _cacheTs = 0
let _loading = false

// ── Встроенные дефолты ─────────────────────────────────────────────────────

const DEFAULTS = {
  factor_weights: {
    T: 0.25,  // TRL Momentum
    S: 0.35,  // Sovereign Score (главный фильтр ФСТ)
    M: 0.20,  // Multiplier Score
    G: 0.10,  // GR Coverage
    E: 0.10,  // Export Readiness
  },

  factor_labels: {
    T: 'TRL Momentum',
    S: 'Sovereign Score',
    M: 'Multiplier Score',
    G: 'GR Coverage',
    E: 'Export Readiness',
  },

  grade_thresholds: [
    [9,  'A+'],
    [8,  'A'],
    [7,  'B+'],
    [6,  'B'],
    [5,  'C+'],
    [4,  'C'],
    [-Infinity, 'D'],
  ],

  recommendation_map: {
    'A+': 'STRONG_INVEST',
    'A':  'INVEST',
    'B+': 'PROCEED_WITH_CONDITIONS',
    'B':  'PROCEED_WITH_CONDITIONS',
    'C+': 'HOLD_FOR_REVISION',
    'C':  'HOLD_FOR_REVISION',
    'D':  'REJECT',
  },

  stress_scenarios: {
    sanctions_components: {
      label: 'Санкции на компоненты',
      description: 'Запрет импорта микроэлектроники и контроллеров',
      factorImpact: { T: -1.5, S: +1.0, M: -0.5, G: -0.5, E: -1.0 },
      condition: 'sovereignPercent < 70',
    },
    goz_reduction_30: {
      label: 'Снижение ГОЗ на 30%',
      description: 'Государственный оборонный заказ сокращён',
      factorImpact: { T: 0, S: 0, M: -2.0, G: -1.5, E: +0.5 },
      condition: 'always',
    },
    regulator_bas: {
      label: 'Ужесточение регуляторики БАС',
      description: 'Новый ФАП, требования сертификации выросли',
      factorImpact: { T: -1.0, S: 0, M: -0.5, G: +1.0, E: -0.5 },
      condition: 'always',
    },
    competitor_entry: {
      label: 'Выход крупного конкурента',
      description: 'Госкорпорация входит в ту же нишу',
      factorImpact: { T: 0, S: 0, M: -1.5, G: 0, E: -1.0 },
      condition: 'always',
    },
    lp_exit: {
      label: 'Выход якорного LP',
      description: 'Якорный LP не продлевает обязательства',
      factorImpact: { T: 0, S: 0, M: -3.0, G: 0, E: 0 },
      condition: 'always',
    },
  },

  expert_registry: {
    analyst: {
      name: 'AI-Аналитик',
      role: 'Количественный анализ и финансовые метрики',
      avatar: 'pi pi-chart-bar',
      cognitiveStyle: {
        primaryFocus: 'financial_metrics',
        decisionWeight: 0.35,
        riskTolerance: 'low',
        typicalQuestions: [
          'Какой IRR при базовом сценарии?',
          'Как соотносятся TRL и запрашиваемый объём?',
          'Каков мультипликатор при консервативных допущениях?',
        ],
      },
    },
    risk: {
      name: 'AI-Рисковик',
      role: 'Идентификация и управление рисками',
      avatar: 'pi pi-shield',
      cognitiveStyle: {
        primaryFocus: 'risk_identification',
        decisionWeight: 0.30,
        riskTolerance: 'very_low',
        typicalQuestions: [
          'Какова зависимость от иностранных компонентов?',
          'Насколько реалистична дорожная карта?',
          'Есть ли регуляторные риски по БАС?',
        ],
      },
    },
    market: {
      name: 'AI-Маркетолог',
      role: 'Оценка рынка и конкурентной среды',
      avatar: 'pi pi-globe',
      cognitiveStyle: {
        primaryFocus: 'market_dynamics',
        decisionWeight: 0.20,
        riskTolerance: 'medium',
        typicalQuestions: [
          'Каков размер адресного рынка?',
          'Есть ли экспортный потенциал?',
          'Кто основные конкуренты?',
        ],
      },
    },
    technology: {
      name: 'AI-Технолог',
      role: 'Техническая экспертиза и TRL-оценка',
      avatar: 'pi pi-cog',
      cognitiveStyle: {
        primaryFocus: 'technology_readiness',
        decisionWeight: 0.15,
        riskTolerance: 'medium',
        typicalQuestions: [
          'Подтверждён ли TRL независимым тестированием?',
          'Какова патентная защита ключевых технологий?',
          'Есть ли технологический долг?',
        ],
      },
    },
  },
}

// ── Загрузка из Integram ───────────────────────────────────────────────────

async function loadFromIntegram() {
  try {
    const { token } = await authenticateIntegram()
    const url = `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_d_req/${CONFIG_TYPE_ID}?JSON_KV&l=200`
    const res = await fetch(url, {
      headers: { 'X-Authorization': token, 'Cookie': `${INTEGRAM_DB}=${token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return {}
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return {}

    const result = {}
    for (const row of rows) {
      const key = row.name || row.t7901
      const raw = row.data || row.t7902 || row.t7903
      if (!key || !raw) continue
      try {
        result[key] = JSON.parse(raw)
      } catch {
        result[key] = raw
      }
    }
    return result
  } catch (err) {
    console.warn('[FstConfig] Integram load failed, using defaults:', err.message)
    return {}
  }
}

// ── Публичный API ──────────────────────────────────────────────────────────

/**
 * Обновить кэш из Integram (при старте и каждые 5 мин).
 * Неблокирующий — ошибки не бросает.
 */
export async function refreshConfig() {
  if (_loading) return
  _loading = true
  try {
    const loaded = await loadFromIntegram()
    _cache = loaded
    _cacheTs = Date.now()
    if (Object.keys(loaded).length > 0) {
      console.log('[FstConfig] Loaded', Object.keys(loaded).length, 'keys from Integram')
    }
  } finally {
    _loading = false
  }
}

/**
 * Получить значение конфига (синхронно, с fallback).
 * @param {string} key — например 'factor_weights'
 * @param {*} fallback — переопределить дефолт если нужно
 */
export function getConfig(key, fallback = undefined) {
  // Инициировать обновление в фоне если кэш устарел
  if (Date.now() - _cacheTs > CACHE_TTL_MS && !_loading) {
    refreshConfig().catch(() => {})
  }

  if (_cache[key] !== undefined) return _cache[key]
  if (fallback !== undefined) return fallback
  return DEFAULTS[key]
}

/**
 * Сохранить значение конфига в Integram.
 * Если объект с таким ключом уже есть — обновить, иначе создать.
 */
export async function saveConfig(key, value) {
  const { token, xsrf } = await authenticateIntegram()
  const headers = { 'X-Authorization': token, 'Cookie': `${INTEGRAM_DB}=${token}` }
  const jsonStr = JSON.stringify(value)

  // Проверяем: есть ли уже объект с таким ключом
  const listRes = await fetch(
    `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_d_req/${CONFIG_TYPE_ID}?JSON_KV&l=200`,
    { headers }
  )
  const rows = listRes.ok ? await listRes.json() : []
  const existing = Array.isArray(rows)
    ? rows.find(r => (r.name || r.t7901) === key)
    : null

  if (existing) {
    // Обновить
    const body = new URLSearchParams({ _xsrf: xsrf, t7902: jsonStr, up: '1' })
    await fetch(`${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_set/${existing.id}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } else {
    // Создать
    const body = new URLSearchParams({
      _xsrf: xsrf,
      [`t${CONFIG_TYPE_ID}`]: key,
      t7902: jsonStr,
      up: '1',
    })
    await fetch(`${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_new/${CONFIG_TYPE_ID}?JSON_KV`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  }

  // Инвалидируем кэш
  _cache[key] = value
  _cacheTs = Date.now()
}

/**
 * Список всех ключей в конфиге (из кэша + дефолты).
 */
export function listConfigKeys() {
  const keys = new Set([...Object.keys(DEFAULTS), ...Object.keys(_cache)])
  return Array.from(keys)
}

export { DEFAULTS }
