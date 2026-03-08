# Multi-Agent Orchestrator — Архитектура и тестирование

## Обзор

VentureOS использует мульти-агентную архитектуру для AI-инвесткомитета. Оркестратор назначает задачи агентам, каждый агент вызывает свои инструменты и видит что пишут остальные через "зал дебатов" (DebateRoom).

## Архитектура

### Компоненты

```
┌──────────────────────────────────────────────────────┐
│                  FstCommitteeEngine                   │
│  (Оркестратор фаз: IDLE → OPENING → DEBATE → VOTE)  │
├──────────┬───────────┬───────────┬───────────────────┤
│          │           │           │                    │
│  AgentLoop.js        │  fstCommitteeModelOrchestrator│
│  (Agentic Loop)      │  (Выбор AI-моделей)          │
│                      │                               │
│  AgentToolRegistry   │  DebateRoom                   │
│  (Инструменты)       │  (Общий зал — агенты видят    │
│                      │   сообщения друг друга)        │
└──────────────────────────────────────────────────────┘
```

### Паттерн AgentLoop (Think → Act → Observe → Repeat)

Каждый агент проходит цикл:

1. **Think**: LLM получает системный промпт с ролью + инструменты + контекст проекта
2. **Act**: LLM отвечает JSON:
   - `{"action": "tool_call", "tool": "calc_irr", "args": {...}, "reasoning": "..."}` — вызов инструмента
   - `{"action": "publish", "text": "...", "dimension": "...", "confidence": 0.85, "stance": "APPROVE"}` — публикация аргумента
3. **Observe**: Результат инструмента добавляется в историю
4. **Repeat**: До MAX_ITER (настраивается) или до publish

### Инструменты агентов

| Инструмент | Описание | Агенты |
|-----------|----------|--------|
| `read_room` | Прочитать последние сообщения коллег из зала дебатов | ВСЕ |
| `query_data` | Получить данные проекта (TRL, IRR, market size...) | ВСЕ |
| `web_search` | Поиск в интернете (конкуренты, тренды) | ВСЕ |
| `memory_search` | Семантический поиск в KAG (база знаний) | ВСЕ |
| `exec_code` | Произвольный JS-расчёт (sandbox) | ВСЕ |
| `calc_irr` | IRR по денежным потокам (Ньютон) | finance, monte_carlo, real_options |
| `calc_npv` | NPV при заданном WACC | finance, real_options |
| `calc_monte_carlo` | Монте-Карло 1000 симуляций | monte_carlo |
| `calc_power_score` | 7 Powers (Hamilton Helmer) | power_score |
| `calc_bayesian` | Байесовское обновление P(успех) | bayesian |
| `search_precedents` | Прецеденты из KAG | risk, portfolio, market_timing, bayesian |

### Агенты инвесткомитета

| ID | Роль | Фокус |
|----|------|-------|
| `tech` | Технический аналитик | TRL/MRL, патенты, цепочки поставок |
| `finance` | Финансовый аналитик | IRR/NPV, unit economics, burn rate |
| `sovereignty` | Эксперт суверенности | 9-мерная матрица, импортозамещение |
| `risk` | Риск-менеджер | Реестр рисков PMBOK |
| `portfolio` | Стратег портфеля | Синергии, стратегия НТИ 2030 |
| `devil` | Критический аналитик | Слабые места, контраргументы |
| `monte_carlo` | Квантовый риск-аналитик | P(успех), VaR, MOIC |
| `real_options` | Аналитик реальных опционов | ROV, staged financing |
| `market_timing` | Аналитик рыночного цикла | Шкала Маркса, "Почему сейчас?" |
| `bayesian` | Байесовский аналитик | Reference Class, P(успех|данные) |
| `power_score` | Аналитик стратегического моата | 7 Powers Score |

### Выбор AI-моделей (ModelOrchestrator)

Матрица `агент × задача × профиль скорости`:

| Профиль | Модель по умолчанию | Синтез | Max итераций |
|---------|-------------------|--------|-------------|
| ⚡ fast | Qwen Turbo (~1.5с) | Gemini Flash Lite | 2 |
| ⚖️ balanced | Gemini Flash Lite (~1.9с) | Gemini Flash Lite | 3 |
| 🎯 quality | DeepSeek Chat (~10с) | Claude Sonnet 4.6 | 5 |

### Видимость между агентами

Агенты видят друг друга через `read_room` — инструмент, читающий последние N сообщений из зала дебатов (DebateRoom). Каждый аргумент, опубликованный любым агентом, попадает в общий зал. Это позволяет:
- Не повторять уже высказанные позиции
- Строить контраргументы на конкретные тезисы коллег
- Формировать consensus/dissent органически

### Параллельная работа

`runParallelAgents()` запускает батчи по `MAX_PARALLEL=4` агента одновременно. Это ограничение — чтобы не перегружать backend LLM-запросами.

## Тестирование

### Модульные тесты (Vitest)

**3 файла, 69 тестов — все пройдены ✅**

#### 1. `orchestratorService.spec.js` — 22 теста
- Корректность API-вызовов (execute, status, start/stop/restart)
- Валидация входных данных (пустой query, null)
- Обработка ошибок (сетевые, API)
- Интеграционный сценарий: start → execute → status → stop
- Параллельные запросы

#### 2. `agentToolRegistry.spec.js` — 28 тестов
- Полнота схем инструментов (11 инструментов)
- Наборы инструментов по ролям (все агенты имеют базовые, специалисты — дополнительные)
- `getToolsForAgent()` — известные и неизвестные агенты
- `formatToolsForPrompt()` — форматирование для system prompt
- **Расчётные движки:**
  - `execCalcIrr`: простые CF, break-even, высокая доходность
  - `execCalcNpv`: положительный/отрицательный NPV, zero WACC
  - `execMonteCarlo`: валидность результатов, направленность, VaR < медиана
  - `execPowerScore`: сильный/средний/слабый моат, пустые поля
  - `execBayesian`: позитивные/негативные свидетельства, clamp [0.001, 0.999], интерпретации

#### 3. `agentLoop.spec.js` — 19 тестов
- **ModelOrchestrator:**
  - resolveModel: override > матрица > профиль > fallback
  - buildModelMap: для всех агентов, с переопределениями
  - getModelSummary: статистика распределения моделей
  - SPEED_PROFILES: полнота, обязательные поля, порядок итераций
  - COMMITTEE_MODELS: количество, обязательные поля
- **AgentLoop:**
  - Null response → null результат
  - Publish response → корректный аргумент с полями
  - Tool call → publish последовательность
  - Clamp confidence [0, 1]
  - Валидация stance (APPROVE/DEFER/REJECT)
  - Параллельный запуск: graceful failure при отказе всех агентов

### Запуск тестов

```bash
# Все тесты оркестратора
npx vitest run src/services/__tests__/orchestratorService.spec.js
npx vitest run src/services/__tests__/agentToolRegistry.spec.js
npx vitest run src/services/__tests__/agentLoop.spec.js

# Все три вместе
npx vitest run src/services/__tests__/orchestratorService.spec.js src/services/__tests__/agentToolRegistry.spec.js src/services/__tests__/agentLoop.spec.js
```

## Связь с Claude Agent SDK

VentureOS реализует паттерн, аналогичный Claude Agent Teams:

| Claude Agent Teams | VentureOS ИК |
|-------------------|--------------|
| Team lead (orchestrator) | FstCommitteeEngine |
| Teammates (specialists) | 11 агентов (tech, finance, risk...) |
| Shared task list | DebateRoom (зал дебатов) |
| Mailbox system | `read_room` инструмент |
| Tool restrictions per agent | `AGENT_TOOLS` матрица |
| Agent SDK subagents | `runAgentLoop()` — отдельная сессия на агента |

Ключевое отличие: VentureOS использует text-based tool use протокол (JSON в ответе LLM), что работает с **любой** моделью (Qwen, Gemini, DeepSeek, Claude), а не только с native tool use API.

## Результат запуска инвесткомитета

### Параметры сессии
- **Проект**: АО МикроСхема (субфонд БАС)
- **Запрос**: 15 млн ₽
- **TRL**: 5 | **MRL**: — | **Суверенность**: 6/9
- **Пользователь**: d (login: d)
- **Дата**: 2026-03-08
- **Событий в дебатах**: 121

### Итоговое решение

| Метрика | Значение |
|---------|----------|
| **Агрегированный скоринг** | **59/100** |
| **Рекомендация** | Утверждение с модерацией |
| **Голоса: Одобрить** | 4 |
| **Голоса: Отложить** | 8 |

### Голоса агентов

| Агент | Скоринг | Вердикт |
|-------|---------|---------|
| Портфель | 74/100 | Одобрить |
| Одобрить (агрегированный) | 77/100 | Одобрить |
| ТИ (Game Theory) | 77/100 | Одобрить |
| ROV (Real Options) | 70/100 | Одобрить |
| Monte Carlo | 60/100 | Отложить |
| Timing | 56/100 | Отложить |
| Критик | 54/100 | Отложить |
| Байес. | 51/100 | Отложить |
| Рисков. | — | Отложить |
| Суверен. | — | Отложить |
| Фин. | — | Отложить |
| Тех. | — | Отложить |

### Условия одобрения
1. Предоставить план сертификации продукции с конкретными сроками
2. Подтвердить TRL 5 → 6 у аккредитованной лаборатории

### Фазы сессии
1. ✅ Анализ документов — сбор данных проекта, тег онтологии
2. ✅ Первичные позиции — 11 агентов дали первичные аргументы
3. ✅ Перекрёстные дебаты — challenge/counter аргументы
4. ✅ Финальные позиции — итоговые позиции агентов
5. ✅ Голосование — формульное/гибридное
6. ✅ Синтез решения — ConditionalDecisionReady
7. ✅ DecisionPublished — решение опубликовано
8. ⏳ Ожидание утверждения председателем комитета

### Наблюдения
- Агенты активно используют инструменты: `query_data`, `web_search`, `read_room`
- Видна живая лента tool calls в реальном времени
- Критик и Риск-менеджер консервативны (Отложить), Портфель и ROV оптимистичны (Одобрить)
- Belief Drift: некоторые агенты изменили позиции в ходе дебатов
- TRL=5 стал ключевым фактором для условного одобрения (порог TRL≥6)
