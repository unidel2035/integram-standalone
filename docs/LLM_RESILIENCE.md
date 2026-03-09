# LLM Resilience — Circuit Breaker, Retry, Model Failover

## Проблема

При проведении AI-инвесткомитета (12 агентов, десятки LLM-вызовов) отдельные модели периодически не отвечают:
- Пустой ответ от LLM (`no response from LLM`)
- Таймаут (модель перегружена)
- 5xx ошибки провайдера

**До внедрения:** каждый сбой = потерянный аргумент агента. Из 12 аргументов можно было потерять 2-3.

**После внедрения:** 0 потерянных аргументов. Retry + failover подхватывают сбои прозрачно.

---

## Архитектура

```
┌──────────────────────────────────────────────────┐
│  AgentLoop.callLLM() / fstCommitteeAI.generate() │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │           withResilience(modelId, fn)         │  │
│  │                                                │  │
│  │  1. resolveAvailableModel(modelId)            │  │
│  │     └─ Circuit Breaker: модель доступна?      │  │
│  │        ├─ CLOSED → используем                 │  │
│  │        ├─ OPEN → пробуем fallback             │  │
│  │        └─ HALF-OPEN → пробуем (1 раз)        │  │
│  │                                                │  │
│  │  2. withRetry(fn, maxRetries=1)               │  │
│  │     └─ Exponential backoff: 1-4с + jitter     │  │
│  │                                                │  │
│  │  3. Если всё равно fail → fallback-цепочка    │  │
│  │     └─ Пробуем каждую модель по очереди       │  │
│  └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## Три механизма

### 1. Circuit Breaker

Отслеживает последовательные сбои каждой модели. При достижении порога — блокирует модель на 60 секунд.

| Параметр | Значение |
|----------|----------|
| Порог (failures) | 3 подряд |
| Время блокировки | 60 сек |
| Состояния | `closed` → `open` → `half-open` → `closed` |

**Состояния:**
- **CLOSED** — модель работает нормально
- **OPEN** — 3+ ошибки подряд, запросы идут в fallback
- **HALF-OPEN** — прошло 60с, пробуем 1 запрос; успех → closed, fail → open

### 2. Retry с Exponential Backoff

Повторяет неудачный вызов с нарастающей задержкой и jitter (±25%) для предотвращения thundering herd.

| Параметр | Значение |
|----------|----------|
| Max retries | 1-2 (настраивается) |
| Base delay | 1000 мс |
| Max delay | 4000 мс |
| Jitter | ±25% от расчётной задержки |

**Формула задержки:**
```
delay = min(1000 * 2^attempt, 4000) * (0.75 + random * 0.5)
```

### 3. Model Failover

Если основная модель недоступна (circuit breaker OPEN), запрос автоматически переключается на fallback-модель.

**Цепочки:**

| Основная модель | Fallback 1 | Fallback 2 |
|----------------|------------|------------|
| Gemini 2.5 Flash Lite | Qwen Turbo | — |
| Gemini 2.0 Flash Lite | Qwen Turbo | — |
| DeepSeek Chat | Gemini Flash Lite | Qwen Turbo |
| Claude Sonnet 4.6 | DeepSeek Chat | Gemini Flash Lite |
| Ministral 3B | Qwen Turbo | — |

**Last resort:** `polza/qwen/qwen-turbo` — самая быстрая и надёжная модель, конечная точка всех цепочек.

---

## Файлы

| Файл | Роль |
|------|------|
| `src/components/fst-committee/llmResilience.js` | Модуль resilience (CB + retry + failover) |
| `src/components/fst-committee/AgentLoop.js` | Интеграция в `callLLM()` |
| `src/components/fst-committee/fstCommitteeAI.js` | Интеграция в `generateArgumentAI()` |

---

## API

```javascript
import {
  withResilience,        // Комбинированная обёртка
  withRetry,             // Только retry
  resolveAvailableModel, // Выбрать доступную модель
  isModelAvailable,      // Проверить circuit breaker
  recordSuccess,         // Записать успех
  recordFailure,         // Записать сбой
  getBreakerStates       // Дебаг: текущее состояние breakers
} from './llmResilience.js'

// Основной паттерн использования:
const { result, modelUsed } = await withResilience(modelId, async (actualModelId) => {
  const response = await fetch('/api/ai-tokens/chat', {
    method: 'POST',
    body: JSON.stringify({ modelId: actualModelId, prompt, systemPrompt })
  })
  if (!response.ok) return null
  const data = await response.json()
  return data.response || null
}, { maxRetries: 1 })
```

---

## Результаты тестирования

**Тест: АО МикроСхема (12 агентов, qwen-turbo)**

- Несколько LLM-вызовов вернули пустой ответ
- Retry подхватил все сбои
- **Итог: 12/12 аргументов сгенерированы, 0 потерь**

**До resilience:** пустой ответ = потерянный аргумент, агент выпадал из голосования.
**После:** retry повторяет запрос через 1-4с, при системном сбое модели — failover на Qwen Turbo.

---

## Логирование

В консоли браузера:

```
[Retry] Attempt 1/1 failed, retrying in 1200ms
[Failover] gemini-2.5-flash-lite → polza/qwen/qwen-turbo (circuit breaker open)
[CircuitBreaker] Model gemini-2.5-flash-lite → OPEN (3 consecutive failures)
[AgentLoop] analyst: failover gemini-2.5-flash-lite → polza/qwen/qwen-turbo
```
