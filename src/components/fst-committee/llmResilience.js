/**
 * llmResilience.js — Circuit Breaker + Retry + Model Failover для LLM-вызовов ИК
 *
 * Три механизма:
 *   1. Circuit Breaker — отслеживает ошибки/таймауты модели, при пороге переключает на fallback
 *   2. Retry с exponential backoff — повторяет неудачный вызов 1-2 раза с задержкой
 *   3. Model Failover — если основная модель в circuit breaker OPEN, пробует fallback-модель
 */

// ── Fallback-цепочки моделей ────────────────────────────────────────────────
// Если основная модель не отвечает → пробуем следующую в цепочке
const MODEL_FALLBACK_CHAIN = {
  'polza/google/gemini-2.5-flash-lite':     ['polza/qwen/qwen-turbo'],
  'polza/google/gemini-2.0-flash-lite-001': ['polza/qwen/qwen-turbo'],
  'deepseek-chat':                           ['polza/google/gemini-2.5-flash-lite', 'polza/qwen/qwen-turbo'],
  'polza/anthropic/claude-sonnet-4.6':       ['deepseek-chat', 'polza/google/gemini-2.5-flash-lite'],
  'polza/mistralai/ministral-3b-2512':       ['polza/qwen/qwen-turbo'],
  // qwen-turbo — конечная точка, нет fallback (самая быстрая и надёжная)
}

// ── Circuit Breaker ─────────────────────────────────────────────────────────

const BREAKER_THRESHOLD = 3      // Количество ошибок подряд для размыкания
const BREAKER_RESET_MS  = 60_000 // Через сколько мс пробуем снова (half-open)

const _breakers = new Map()

function _getBreaker(modelId) {
  if (!_breakers.has(modelId)) {
    _breakers.set(modelId, { state: 'closed', failures: 0, lastFailure: 0 })
  }
  return _breakers.get(modelId)
}

export function isModelAvailable(modelId) {
  const b = _getBreaker(modelId)
  if (b.state === 'closed') return true
  if (b.state === 'open') {
    if (Date.now() - b.lastFailure >= BREAKER_RESET_MS) {
      b.state = 'half-open'
      return true
    }
    return false
  }
  return true // half-open
}

export function recordSuccess(modelId) {
  const b = _getBreaker(modelId)
  b.state = 'closed'
  b.failures = 0
}

export function recordFailure(modelId) {
  const b = _getBreaker(modelId)
  b.failures++
  b.lastFailure = Date.now()
  if (b.failures >= BREAKER_THRESHOLD) {
    b.state = 'open'
    console.warn(`[CircuitBreaker] Model ${modelId} → OPEN (${b.failures} consecutive failures)`)
  }
}

export function getBreakerStates() {
  const result = {}
  for (const [modelId, b] of _breakers) {
    if (b.failures > 0) result[modelId] = { ...b }
  }
  return result
}

// ── Retry с exponential backoff ─────────────────────────────────────────────

const MAX_RETRIES   = 2
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS  = 4000

function _backoffDelay(attempt) {
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS)
  const jitter = delay * (0.75 + Math.random() * 0.5)
  return Math.round(jitter)
}

export async function withRetry(fetchFn, maxRetries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await fetchFn()
    if (result !== null) return result

    if (attempt < maxRetries) {
      const delay = _backoffDelay(attempt)
      console.debug(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  return null
}

// ── Model Failover ──────────────────────────────────────────────────────────

export function resolveAvailableModel(primaryModelId) {
  if (isModelAvailable(primaryModelId)) return primaryModelId

  const chain = MODEL_FALLBACK_CHAIN[primaryModelId] || []
  for (const fallbackId of chain) {
    if (isModelAvailable(fallbackId)) {
      console.info(`[Failover] ${primaryModelId} → ${fallbackId} (circuit breaker open)`)
      return fallbackId
    }
  }

  const lastResort = 'polza/qwen/qwen-turbo'
  if (lastResort !== primaryModelId) {
    console.warn(`[Failover] All fallbacks exhausted, using last resort: ${lastResort}`)
    return lastResort
  }

  console.warn(`[Failover] All models in circuit breaker, forcing ${primaryModelId}`)
  return primaryModelId
}

/**
 * Комбинированная обёртка: failover + retry + circuit breaker.
 *
 * @param {string}   primaryModelId — модель из resolveModel()
 * @param {Function} fetchFn        — async (modelId) => result | null
 * @param {Object}   opts           — { maxRetries }
 * @returns {{ result: *, modelUsed: string }}
 */
export async function withResilience(primaryModelId, fetchFn, opts = {}) {
  const maxRetries = opts.maxRetries ?? 1
  const modelId = resolveAvailableModel(primaryModelId)

  // Попытка с выбранной моделью + retry
  const result = await withRetry(() => fetchFn(modelId), maxRetries)

  if (result !== null) {
    recordSuccess(modelId)
    return { result, modelUsed: modelId }
  }

  // Модель не ответила — записываем failure
  recordFailure(modelId)

  // Если это уже был fallback → сдаёмся
  if (modelId !== primaryModelId) {
    return { result: null, modelUsed: modelId }
  }

  // Попытка с fallback-моделью (single shot, без retry)
  const chain = MODEL_FALLBACK_CHAIN[primaryModelId] || []
  for (const fallbackId of chain) {
    if (!isModelAvailable(fallbackId)) continue
    console.info(`[Failover] Trying fallback ${fallbackId} after ${primaryModelId} failed`)
    const fbResult = await fetchFn(fallbackId)
    if (fbResult !== null) {
      recordSuccess(fallbackId)
      return { result: fbResult, modelUsed: fallbackId }
    }
    recordFailure(fallbackId)
  }

  return { result: null, modelUsed: modelId }
}
