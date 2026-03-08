# Multi-Agent Orchestrator — AI Инвесткомитет ФСТ НТИ

## Концепция

Каждый агент инвесткомитета — это независимая "сессия" с собственными инструментами.
Агенты работают **параллельно**, пишут в общий **Debate Room** и видят аргументы друг друга между итерациями.

Вместо одного LLM-вызова на аргумент:

```
Раньше:  Agent → 1x LLM call → argument text

Теперь:  Agent → think
                → tool_call: query_data(trl, irr)   ← реальные данные из БД
                → observe: { trl: 5, irr: 34% }
                → tool_call: calc_npv(cf, wacc=0.18) ← расчёт
                → observe: { npv: +14.2 млн }
                → tool_call: read_room()             ← что сказали коллеги
                → observe: "tech-агент: TRL 5 — риск R&D..."
                → publish: "IRR 34% при TRL 5: NPV +14.2 млн только в базовом
                            сценарии. При провале R&D → -100 млн. DEFER."
```

Аргументы содержат **реальные числа из инструментов**, а не шаблонный текст.

---

## Архитектура

```
FstCommittee.vue
  ↓ useAgentLoop=true (по умолчанию)
FstCommitteeEngine
  ├── DebateRoom              ← shared message bus
  ├── _phasePrimaryPositions  ← Promise.all(agents) — параллельно
  ├── _phaseCrossDebate       ← параллельные challengers в каждом раунде
  ├── _phaseFinalPositions    ← Promise.all(agents) — параллельно
  └── _agentSpeak(agent)
        └── AgentLoop.runAgentLoop()
              ├── getToolsForAgent(agentId)
              ├── loop (max 4 итерации):
              │     ├── callLLM(systemPrompt + tools + history)
              │     ├── parse: tool_call | publish
              │     └── executeTool(name, args) → result
              └── publish to DebateRoom
```

---

## Файлы

| Файл | Назначение |
|------|-----------|
| `DebateRoom.js` | Shared message bus. Агенты публикуют и читают зал |
| `AgentToolRegistry.js` | Схемы инструментов + матрица агент→инструменты + вычислительные движки |
| `AgentLoop.js` | Agentic loop: think→tool→observe→publish. Системные промпты агентов |
| `FstCommitteeEngine.js` | Движок сессии. Создаёт DebateRoom, запускает параллельные фазы |
| `fstCommitteeAI.js` | Классический single-call (fallback). AGENT_SYSTEM_PROMPTS теперь export |
| `fstCommitteeModelOrchestrator.js` | Выбор модели по роли + профилю скорости |

---

## DebateRoom

```js
import { DebateRoom } from './DebateRoom.js'

const room = new DebateRoom(onPublishCallback)
room.setPhase('PRIMARY_POSITIONS')

// Агент публикует
room.publish('finance', { text: '...', dimension: 'finance', stance: 'DEFER' })

// Агент читает зал
room.format(8, 'finance')     // последние 8 сообщений, не считая своих
room.getUnchallengedArgs('devil')  // что ещё никто не оспорил

// Лог tool calls (идёт в граф событий)
room.logToolCall('finance', 'calc_irr', args, result, 42)
room.toolCalls  // массив для DebateGraphPanel
```

**onPublishCallback** → `FstCommitteeEngine.emit('AgentLoopPublished', {...})`
→ `DebateGraphPanel` показывает на графе в реальном времени.

---

## AgentToolRegistry — инструменты по роли

| Инструмент | Описание | Агенты |
|-----------|---------|--------|
| `read_room` | Читать зал дебатов (последние N сообщений) | Все |
| `query_data` | Поля проекта из БД: trl, irr, marketSize, risks... | Все |
| `calc_irr` | IRR по денежным потокам (метод Ньютона) | finance, monte_carlo, real_options |
| `calc_npv` | NPV при заданном WACC | finance, real_options |
| `calc_monte_carlo` | 1000 симуляций: P(успех), медианный IRR, VaR | monte_carlo |
| `calc_power_score` | 7 Powers (Hamilton Helmer): Scale, Network, Branding... | power_score |
| `calc_bayesian` | Теорема Байеса: prior + evidence → posterior | bayesian |
| `search_precedents` | Прецеденты из KAG по прошлым решениям ИК | risk, portfolio, market_timing, bayesian |

### Матрица агент → инструменты

```
tech:          read_room, query_data
finance:       read_room, query_data, calc_irr, calc_npv
sovereignty:   read_room, query_data
risk:          read_room, query_data, search_precedents
portfolio:     read_room, query_data, search_precedents
devil:         read_room, query_data
monte_carlo:   read_room, query_data, calc_monte_carlo, calc_irr
real_options:  read_room, query_data, calc_irr, calc_npv
market_timing: read_room, query_data, search_precedents
bayesian:      read_room, query_data, calc_bayesian, search_precedents
power_score:   read_room, query_data, calc_power_score
game_theory:   read_room, query_data
```

---

## AgentLoop — протокол

Работает через `/api/ai-tokens/chat` — **любая модель** (Qwen, Gemini, DeepSeek, Claude).
Использует **structured prompting** вместо нативного function calling → совместим со всеми.

### System prompt (упрощённо)

```
[Роль агента]

ТЕКУЩАЯ ФАЗА: ПЕРВИЧНЫЕ ПОЗИЦИИ — дай свою первичную позицию...

ДАННЫЕ ПРОЕКТА:
Проект: АэроТех-2025
TRL: 5 / MRL: 4
IRR прогноз: 34%
...

ТВОИ ИНСТРУМЕНТЫ:
• read_room: Прочитать последние сообщения...
• query_data: Получить конкретные поля проекта...
• calc_irr: Рассчитать IRR...
• calc_npv: Рассчитать NPV...

ПРОТОКОЛ ОТВЕТА (СТРОГО JSON):

Если нужен инструмент:
{"action": "tool_call", "tool": "calc_irr", "args": {...}, "reasoning": "зачем"}

Если готов к публикации:
{"action": "publish", "text": "...", "dimension": "finance", "confidence": 0.8, "stance": "DEFER"}
```

### Loop (max 4 итерации)

```
iter 1: LLM → tool_call: query_data([trl, projectedIRR, marketSize])
              → result: {trl: 5, projectedIRR: 0.34, marketSize: 8.2e9}

iter 2: LLM → tool_call: calc_npv(cf=[15,22,31], ic=100, wacc=0.18)
              → result: {npv: 14.2, pi: 1.14}

iter 3: LLM → tool_call: read_room(n=6)
              → result: {messages: "[tech]: TRL 5 — риск выхода из R&D..."}

iter 4: LLM → publish
              → text: "NPV +14.2 млн при WACC 18% выглядит скромно. TRL 5 → R&D риск.
                        Рекомендую DEFER до достижения TRL 7."
              → dimension: finance, confidence: 0.78, stance: DEFER
```

Результат попадает в `session.arguments` с флагами `agentLoop: true`, `toolsUsed: [...]`, `iterCount: 3`.

---

## Параллельность

### PRIMARY_POSITIONS и FINAL_POSITIONS

```js
// Все агенты запускаются одновременно
await Promise.all(AGENTS.map(agent => this._agentSpeak(agent, 'OPENING')))
```

Агенты пишут в DebateRoom по мере завершения своих итераций.
Последний агент, читающий зал (iter 3), уже видит аргументы тех, кто завершил быстрее.

### CROSS_DEBATE

```js
// Каждый раунд: challengers параллельно, затем counters параллельно
for (let round = 0; round < 3; round++) {
  await Promise.all(challengers.map(agent => challenge + counter))
}
```

---

## Граф событий

Новые типы узлов в DebateGraphPanel при `useAgentLoop=true`:

- **`AgentToolsUsed`** → TOOL-узлы на графе (calc_irr, read_room, etc.) с дугами от AGENT_OP
- **`AgentLoopPublished`** → событие публикации из зала, дополняет `ArgumentRaised`

Аргументы, сгенерированные через loop, на графе отличаются: `agentLoop: true` → в dark-теме double border.

---

## Включение / отключение

В `FstCommittee.vue` → страница настройки сессии → переключатель **"Multi-Agent Loop"**.

По умолчанию: **включён** (`useAgentLoop = ref(true)`).

При выключении — откат к классическому `generateArgumentAI()` (один LLM-вызов).
При `useAI=false` — шаблонный fallback без LLM.

### Создание сессии

```js
const session = createSession(project, {
  useAI:          true,
  useAgentLoop:   true,            // Multi-agent orchestrator
  speedProfile:   'balanced',      // fast | balanced | quality
  modelOverrides: { devil: 'polza/qwen/qwen-turbo' },
})
```

---

## Fallback-цепочка

```
useAgentLoop=true  → runAgentLoop()     → аргумент с tool results
  ↓ (fail/null)
useAI=true         → generateArgumentAI() → аргумент из одного LLM-вызова
  ↓ (fail/null)
                   → generateArgument()   → шаблонный аргумент (всегда работает)
```

Сессия **никогда не падает**: есть всегда минимум два уровня fallback.

---

## Расширение

### Добавить новый инструмент

1. В `AgentToolRegistry.js` → добавить схему в `TOOL_SCHEMAS`
2. Добавить вычислительную функцию `exec*` в том же файле
3. Добавить инструмент в `AGENT_TOOLS[agentId]`
4. В `AgentLoop.js` → добавить case в `executeTool()`

### Добавить нового агента

1. В `FstCommitteeConfig.js` → добавить агента в `AGENTS`
2. В `AgentLoop.js` → добавить системный промпт в `LOOP_SYSTEM_PROMPTS`
3. В `AgentToolRegistry.js` → добавить набор инструментов в `AGENT_TOOLS`
4. В `fstCommitteeModelOrchestrator.js` → добавить строку в `AGENT_MODEL_MATRIX`

### Перейти на нативный function calling

Когда понадобится (для Claude/GPT-4o с явным tool_use API):
- Заменить `callLLM()` в `AgentLoop.js` на вызов с `tools` в теле запроса
- Парсинг `tool_use` блоков вместо JSON из text-поля
- Остальная архитектура не меняется

### Распределённые агенты (разные процессы/серверы)

Заменить `DebateRoom` (in-memory) на:
- **Redis pub/sub** — для нескольких Node.js процессов
- **Socket.io room** — для browser ↔ server агентов
- **Integram** — для персистентных дебатов с историей

API DebateRoom намеренно минимальный (`publish`, `readLatest`, `format`) — замена прозрачна.

---

## Связанные документы

- `docs/COMMITTEE_MODEL_ORCHESTRATOR.md` — выбор моделей по роли
- `docs/committee-debate-framework.md` — фреймворк дебатов (фазы, аргументы)
- `docs/architecture.md` — общая архитектура платформы
- `src/components/fst-committee/FstCommitteeEngine.js` — движок сессии
- `src/components/fst-committee/AgentLoop.js` — loop с инструментами
- `src/components/fst-committee/DebateRoom.js` — шина сообщений
- `src/components/fst-committee/AgentToolRegistry.js` — инструменты агентов
