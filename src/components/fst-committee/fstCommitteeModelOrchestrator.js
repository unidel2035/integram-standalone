/**
 * fstCommitteeModelOrchestrator.js
 *
 * Оркестратор выбора AI-моделей для инвесткомитета.
 * Каждый агент получает оптимальную модель исходя из:
 *   - роли агента (финансист, техник, критик...)
 *   - типа задачи (первичная позиция, контраргумент, синтез...)
 *   - приоритета скорости (fast / balanced / quality)
 *
 * Формат модели: "polza/provider/model-id" → маршрутизируется через polza.ai
 */

// ── Доступные модели (упорядочены по скорости) ────────────────────────────────

export const COMMITTEE_MODELS = [
  {
    id: 'polza/qwen/qwen-turbo',
    label: '⚡ Qwen Turbo',
    description: '~1.5с · дешевле всего · 131K контекст',
    speed: 'fast',
    quality: 'medium',
    supportsJson: true,
  },
  {
    id: 'polza/google/gemini-2.5-flash-lite',
    label: '⚡ Gemini 2.5 Flash Lite',
    description: '~1.9с · отличный баланс · 1М контекст',
    speed: 'fast',
    quality: 'high',
    supportsJson: true,
  },
  {
    id: 'polza/google/gemini-2.0-flash-lite-001',
    label: '⚡ Gemini 2.0 Flash Lite',
    description: '~3.8с · стабильный · 1М контекст',
    speed: 'medium',
    quality: 'medium',
    supportsJson: true,
  },
  {
    id: 'polza/mistralai/ministral-3b-2512',
    label: '⚡ Ministral 3B',
    description: '~2с · ультралёгкий · для коротких реплик',
    speed: 'fast',
    quality: 'low',
    supportsJson: false,
  },
  {
    id: 'deepseek-chat',
    label: 'DeepSeek Chat',
    description: '~10с · надёжный · хорошая логика',
    speed: 'slow',
    quality: 'high',
    supportsJson: true,
  },
  {
    id: 'polza/anthropic/claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    description: '~15с · наилучшее качество · дорогой',
    speed: 'slowest',
    quality: 'highest',
    supportsJson: true,
  },
]

// Быстрый доступ по id
export const MODEL_MAP = Object.fromEntries(COMMITTEE_MODELS.map(m => [m.id, m]))

// ── Профили скорости ──────────────────────────────────────────────────────────

export const SPEED_PROFILES = {
  fast: {
    label: '⚡ Максимальная скорость',
    description: 'Qwen Turbo для всех агентов (~1.5с/аргумент)',
    default: 'polza/qwen/qwen-turbo',
    synthesis: 'polza/google/gemini-2.5-flash-lite',
    maxIter: 2,
    debateRounds: 2,
    challengersPerRound: 2,
  },
  balanced: {
    label: '⚖️ Баланс',
    description: 'Gemini Flash Lite для анализа, Qwen для реплик',
    default: 'polza/google/gemini-2.5-flash-lite',
    synthesis: 'polza/google/gemini-2.5-flash-lite',
    maxIter: 3,
    debateRounds: 3,
    challengersPerRound: 2,
  },
  quality: {
    label: '🎯 Качество',
    description: 'DeepSeek для анализа, Claude для синтеза',
    default: 'deepseek-chat',
    synthesis: 'polza/anthropic/claude-sonnet-4.6',
    maxIter: 5,
    debateRounds: 3,
    challengersPerRound: 3,
  },
}

// ── Матрица оптимальных моделей по роли агента ───────────────────────────────
// Определяет предпочтение модели исходя из типа задачи агента:
//   OPENING = первичная позиция (развёрнутая, аналитическая)
//   CHALLENGE = атака/вызов (короткая, агрессивная)
//   COUNTER = контраргумент (быстрый, точный)
//   SYNTHESIS = финальная позиция (взвешенная, обобщающая)

export const AGENT_MODEL_MATRIX = {
  // Технический аналитик: много чисел, требует точности
  tech: {
    OPENING:   { fast: 'polza/google/gemini-2.5-flash-lite', balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
    CHALLENGE: { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'deepseek-chat' },
    COUNTER:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'polza/google/gemini-2.5-flash-lite' },
    SYNTHESIS: { fast: 'polza/google/gemini-2.5-flash-lite', balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
    default:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
  },
  // Финансовый аналитик: числа и логика
  finance: {
    OPENING:   { fast: 'polza/google/gemini-2.5-flash-lite', balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
    CHALLENGE: { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'deepseek-chat' },
    COUNTER:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'polza/google/gemini-2.5-flash-lite' },
    SYNTHESIS: { fast: 'polza/google/gemini-2.5-flash-lite', balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
    default:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
  },
  // Эксперт суверенности: доменные знания, относительно простые оценки
  sovereignty: {
    OPENING:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'polza/google/gemini-2.5-flash-lite' },
    CHALLENGE: { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'polza/qwen/qwen-turbo' },
    COUNTER:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'polza/qwen/qwen-turbo' },
    SYNTHESIS: { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
    default:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'polza/google/gemini-2.5-flash-lite' },
  },
  // Риск-менеджер: длинные списки рисков, структура PMBOK
  risk: {
    OPENING:   { fast: 'polza/google/gemini-2.5-flash-lite', balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
    CHALLENGE: { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'polza/google/gemini-2.5-flash-lite' },
    COUNTER:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'polza/qwen/qwen-turbo' },
    SYNTHESIS: { fast: 'polza/google/gemini-2.5-flash-lite', balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
    default:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
  },
  // Стратег портфеля: высокоуровневое стратегическое мышление
  portfolio: {
    OPENING:   { fast: 'polza/google/gemini-2.5-flash-lite', balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
    CHALLENGE: { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
    COUNTER:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'polza/google/gemini-2.5-flash-lite' },
    SYNTHESIS: { fast: 'polza/google/gemini-2.5-flash-lite', balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'polza/anthropic/claude-sonnet-4.6' },
    default:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
  },
  // Критический аналитик: короткие провокационные реплики
  devil: {
    OPENING:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'polza/google/gemini-2.5-flash-lite' },
    CHALLENGE: { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'polza/qwen/qwen-turbo' },
    COUNTER:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'polza/qwen/qwen-turbo' },
    SYNTHESIS: { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/google/gemini-2.5-flash-lite', quality: 'deepseek-chat' },
    default:   { fast: 'polza/qwen/qwen-turbo',              balanced: 'polza/qwen/qwen-turbo',              quality: 'polza/google/gemini-2.5-flash-lite' },
  },
}

// ── Ядро оркестратора ─────────────────────────────────────────────────────────

/**
 * Возвращает оптимальную модель для агента + задачи.
 *
 * @param {string} agentId    — id агента (tech, finance, ...)
 * @param {string} taskType   — тип задачи (OPENING, CHALLENGE, COUNTER, SYNTHESIS, CLOSING)
 * @param {string} profile    — профиль скорости: 'fast' | 'balanced' | 'quality'
 * @param {Object} overrides  — пользовательские переопределения { [agentId]: modelId }
 * @returns {string}          — полный model id для API
 */
export function resolveModel(agentId, taskType, profile = 'fast', overrides = {}) {
  // 1. Пользовательское переопределение — наивысший приоритет
  if (overrides[agentId]) return overrides[agentId]

  // 2. Матрица: агент + задача + профиль
  const agentMatrix = AGENT_MODEL_MATRIX[agentId]
  if (agentMatrix) {
    const taskRow = agentMatrix[taskType] || agentMatrix.default
    if (taskRow && taskRow[profile]) return taskRow[profile]
  }

  // 3. Дефолт профиля
  return SPEED_PROFILES[profile]?.default || 'polza/qwen/qwen-turbo'
}

/**
 * Генерирует карту моделей для всех агентов при данном профиле.
 * Используется для отображения в UI и для логирования.
 *
 * @param {string[]} agentIds   — список id агентов
 * @param {string}   profile    — 'fast' | 'balanced' | 'quality'
 * @param {Object}   overrides  — пользовательские переопределения
 * @returns {Object}            — { [agentId]: modelId }
 */
export function buildModelMap(agentIds, profile = 'fast', overrides = {}) {
  return Object.fromEntries(
    agentIds.map(id => [id, resolveModel(id, 'OPENING', profile, overrides)])
  )
}

/**
 * Возвращает статистику: сколько агентов на каких моделях.
 * Для отображения итоговой строки "X агентов: Qwen Turbo, Y: Gemini..."
 */
export function getModelSummary(modelMap) {
  const counts = {}
  for (const modelId of Object.values(modelMap)) {
    const label = MODEL_MAP[modelId]?.label || modelId.split('/').pop()
    counts[label] = (counts[label] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => `${n}× ${label}`)
    .join(', ')
}
