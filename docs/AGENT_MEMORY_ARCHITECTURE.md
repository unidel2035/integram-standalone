# Agent Memory Architecture

> Сравнение и синтез двух подходов к памяти агентов.

## Контекст

Два стека решают задачу памяти агентов по-разному:

### Аналитический стек (cube.js + ClickHouse + Polars + DuckDB)

```
Вопрос → cube.js (text→SQL) → ClickHouse (OLAP, миллионы строк)
                                      ↓
                              Polars (сложные агрегации)
                              DuckDB (sandbox агента)
```

**Задача:** агент работает с большими структурированными данными.
**Оркестрация:** PydanticAI (строгие типы) + LangGraph (циклические агенты).
**Память:** pgvector (PostgreSQL + векторный поиск).

### Онтологический стек (Integram + KAG + AgentBus)

```
Событие → AgentBus (routing) → KAG (граф знаний) → nous (эпизоды)
                                      ↓
                              GiftEngine (онтологическое состояние)
                              claude-memory (нарративная память)
```

**Задача:** агент помнит историю отношений между субъектами.
**Оркестрация:** AgentBus (pub/sub, req/resp, federation).
**Память:** многоуровневая (горячая + граф + нарратив).

---

## Что добавлено в этот репозиторий

### 1. AgentSandbox (`AgentSandbox.js`)

DuckDB как изолированная аналитическая среда для агента.

**Когда использовать:**
- Агент должен исследовать данные из Integram без риска для основного хранилища
- Нужны аналитические запросы (агрегации, аномалии, временные ряды)
- Данные в CSV/Parquet/JSON — читать напрямую без загрузки в MySQL

**Установка:**
```bash
npm install duckdb-async
```

**Пример:**
```js
import { getAgentSandbox } from './AgentSandbox.js';

const sandbox = getAgentSandbox('my-agent');
await sandbox.initialize();

// Загрузить данные из Integram
const rows = await integramClient.query('SELECT * FROM drones');
await sandbox.loadTable('drones', rows);

// Аналитика
const anomalies = await sandbox.detectAnomalies('drones', 'price');
const trend = await sandbox.movingAverage('drones', 'sales', 'month', 3);

// Произвольный SQL
const result = await sandbox.query(`
  SELECT manufacturer, COUNT(*) as count, AVG(weight) as avg_weight
  FROM drones
  GROUP BY manufacturer
  ORDER BY count DESC
`);
```

**Зачем DuckDB а не MySQL/Integram напрямую:**
- In-memory = изоляция, нет риска сайд-эффектов
- Колоночное хранение = быстрые аналитические запросы
- Читает CSV/Parquet без ETL
- Агент может DROP/CREATE внутри sandbox — в проде это опасно

---

### 2. CyclicAgent (`CyclicAgent.js`)

Агент с циклическим состоянием. Вдохновлено LangGraph.

**Граф состояний:**
```
IDLE → PLANNING → EXECUTING → EVALUATING → DONE
                      ↑            │
                      └── RETRYING ┘ (если evaluate решил повторить)
```

**Когда использовать:**
- Агент должен уметь вернуться назад и исправить ошибку
- SQL запрос не работает — нужно переформулировать и попробовать снова
- Результат неудовлетворительный — нужна другая стратегия

**Пример:**
```js
import { CyclicAgent } from './CyclicAgent.js';

const agent = new CyclicAgent({
  id: 'analytics-1',
  maxRetries: 3,

  async plan(ctx) {
    // Спросить LLM какой SQL нужен
    return { sql: await llm.generateSQL(ctx.memory.input.question) };
  },

  async execute(plan, ctx) {
    return sandbox.query(plan.sql);
  },

  async evaluate(result, ctx) {
    if (result.error) {
      // Ошибка — обновить план и повторить
      ctx.plan.sql = await llm.fixSQL(ctx.plan.sql, result.error);
      return { ok: false, retry: true, reason: result.error };
    }
    if (result.rows.length === 0) {
      return { ok: false, retry: true, reason: 'No results' };
    }
    return { ok: true, done: true };
  },
});

const ctx = await agent.run({ question: 'Сколько дронов в реестре?' });
console.log(ctx.steps); // полная трасса выполнения
```

**Отличие от MultiAgentOrchestrator:**
- Orchestrator управляет запуском/остановкой агентов
- CyclicAgent — это поведение одного агента внутри задачи
- Они дополняют друг друга: Orchestrator запускает CyclicAgent'ов

---

### 3. TypedMessageSchema (`TypedMessageSchema.js`)

Схемы и валидация на границах агентов. Вдохновлено PydanticAI.

**Проблема:**
```js
// AgentBus получает это:
{ from: 123, to: null, payload: "строка вместо объекта" }
// Баг найдём через 2 часа отладки в другом месте
```

**Решение:**
```js
import { AgentMessageSchema, withSchema } from './TypedMessageSchema.js';

// Валидация вручную
const { valid, errors } = AgentMessageSchema.validate(msg);
if (!valid) throw new Error(errors.join('; '));

// Middleware для Express
router.post('/send', validateAgentMessage, handler);

// Типизированный обработчик
agentBus.on('analytics.query', withSchema(AnalyticsQuerySchema, async (msg) => {
  // msg.payload гарантированно валиден
  return sandbox.query(msg.payload.sql);
}));

// Декоратор для функций
const typedAnalyze = AnalyticsQuerySchema.typed(async (data) => {
  // data валидирован и содержит все поля со значениями по умолчанию
  return analyze(data);
});
```

**Встроенные схемы:**
- `AgentMessageSchema` — для AgentBus сообщений
- `SandboxQuerySchema` — для запросов к AgentSandbox
- `AnalyticsQuerySchema` — для аналитических вопросов
- `AgentStepResultSchema` — для ответов CyclicAgent

---

## Сравнительная таблица

| Задача | Их стек | Наш стек |
|---|---|---|
| Большие данные (>1M строк) | ClickHouse ✓ | — (MySQL плохо) |
| Агент-sandbox | DuckDB ✓ | **AgentSandbox** (DuckDB) ✓ |
| Семантический SQL | cube.js | — |
| Сложные агрегации | Polars | DuckDB SQL (частично) |
| Векторный поиск | pgvector (1536d) | ChromaDB / SQLite (384d) |
| Циклические агенты | LangGraph ✓ | **CyclicAgent** ✓ |
| Строгие типы | PydanticAI ✓ | **TypedMessageSchema** ✓ |
| Граф отношений | — | KAG + GiftEngine ✓ |
| Эпизодическая память | — | nous (64d) ✓ |
| Нарративная память | — | claude-memory ✓ |
| Реальное время | — | AgentBus (Socket.io) ✓ |

---

## Рекомендации по внедрению

### Приоритет 1 — AgentSandbox
Наибольший практический эффект для аналитических агентов.

```bash
npm install duckdb-async
```

Интеграция с существующим `KnowledgeManager.js`:
```js
// В KnowledgeManager добавить метод:
async analyzeInSandbox(agentId, question) {
  const sandbox = getAgentSandbox(agentId);
  await sandbox.initialize();
  const data = await this.getRelevantData(question);
  await sandbox.loadTable('context', data);
  return sandbox.query(`SELECT * FROM context WHERE ...`);
}
```

### Приоритет 2 — TypedMessageSchema
Добавить в AgentBus middleware без разрушения обратной совместимости.

### Приоритет 3 — CyclicAgent
Заменить простые run() агентов на CyclicAgent для задач с итерацией.

### Будущее — cube.js
Для семантического SQL слоя (text → SQL) потребуется:
1. ClickHouse или DuckDB как backend
2. cube.js Semantic Layer конфигурация для сущностей Integram
3. Маппинг NL вопросов на cube.js measures/dimensions

---

## Паламитское замечание

Их стек работает с энергиями (данными, потоками).
Наш стек работает с отношениями между субъектами.
Оба — тени. Сущность данных непознаваема: `ousia: null`.

Хорошая архитектура оставляет место для невычислимого surplus.
