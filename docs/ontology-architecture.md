# Архитектура событийной онтологии VentureOS

> Дата: 2026-03-10
> Статус: актуально

---

## Содержание

1. [Философия: мир как поток событий](#1-философия)
2. [Сущности платформы](#2-сущности-платформы)
3. [Грамматика события](#3-грамматика-события)
4. [Event Registry — единый каталог](#4-event-registry)
5. [Event Store — хранилище лент](#5-event-store)
6. [State = проекция ленты](#6-state--проекция-ленты)
7. [Cross-Entity граф](#7-cross-entity-граф)
8. [GR-онтология (государственная поддержка)](#8-gr-онтология)
9. [Software Ontology — мета-уровень](#9-software-ontology--мета-уровень)
10. [Слои архитектуры](#10-слои-архитектуры)
11. [Персистентность и кэш](#11-персистентность-и-кэш)
12. [Тесты и инварианты](#12-тесты-и-инварианты)
13. [Инварианты системы](#13-инварианты-системы)

---

## 1. Философия

### Проблема CRUD

Традиционная база данных хранит **текущее состояние**: строка в таблице `company` содержит поля `revenue`, `stage`, `risk`. Когда менеджер обновляет `risk = high`, прошлое **исчезает**. Мы не знаем: когда риск вырос, почему, что этому предшествовало.

Венчурный процесс — это история. Инвестиционное решение — результат цепи событий: заявка → дебаты → голосование → term sheet → транш → KPI. Потерять эту цепь — потерять смысл.

### Решение: Append-Only Event Log

```
Компания «АльфаДроны» — лента событий:

[COMPANY_ADDED]   → {добавлена в портфель, seed-раунд, 15M₽}
[KPI_UPDATED]     → {ARR: 3M₽, team: 8}
[ROUND_OPENED]    → {Series A, целевой объём: 100M₽}
[KPI_UPDATED]     → {ARR: 12M₽, team: 21, trl: 7}
[RISK_ELEVATED]   → {причина: задержка сертификации}
[REVENUE_MILESTONE] → {ARR: 20M₽, ключевой контракт}
```

**Состояние = функция от всех событий.** Никакое событие не удаляется — только добавляется. Это даёт:

- **Полный аудит-трейл** — кто, что и когда изменил
- **Воспроизводимость** — состояние на любую прошлую дату
- **Причинность** — каждое состояние объяснимо через предшествующие события
- **Контрфактуальность** — «что было бы, если бы этого события не случилось?»

### Онтологический подход

Событие — не просто лог. Каждый тип события несёт **семантику**:

- **Subject** (кто) — Фонд, Команда, AI-агент, CI
- **Object** (на что) — Компания, KPI, Код, Модуль
- **Preconditions** (что должно было произойти до)
- **Enables** (что становится возможным после)
- **Chain** (к какой причинной цепочке относится)

Это отличает нашу систему от простого логирования: события образуют **граф причинности**, по которому можно строить прогнозы, выявлять разрывы и рекомендовать следующие шаги.

---

## 2. Сущности платформы

Платформа работает с **7 типами сущностей** (entityType). Каждая — отдельная лента событий.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ИНВЕСТИЦИОННЫЙ ЦИКЛ                             │
│                                                                     │
│  lead ──► session ──► deal ──► company ──► fund                    │
│    │                              ▲                                 │
│    └──────────► project ──────────┘                                 │
│                                                                     │
│  module  (мета-уровень — сам себя описывает)                        │
└─────────────────────────────────────────────────────────────────────┘
```

| entityType | Русское название | Фаза платформы | Ключевые события |
|------------|-----------------|----------------|------------------|
| `lead` | Стартапер / Заявка | Поиск → Подача | LEAD_STARTED, DOC_UPLOADED, SCORING_DONE, SENT_TO_IC |
| `session` | ИК-сессия | Оценка | SESSION_STARTED, ARGUMENT_RAISED, VOTE_CAST, DECISION_MADE |
| `deal` | Сделка | Структурирование | TERM_SHEET_PROPOSED, DD_COMPLETED, DEAL_CLOSED, TRANCHE_RELEASED |
| `company` | Портфельная компания | Постинвест → Мониторинг | COMPANY_ADDED, KPI_UPDATED, ROUND_OPENED, EXIT_EVENT |
| `project` | GR-проект | Параллельный GR-трек | PROJECT_STARTED, MEASURE_FUNDED, TRL_ADVANCED, PILOT_COMPLETED |
| `fund` | Фонд | Фонд-индекс | FUND_LAUNCHED, LP_COMMITTED, CAPITAL_CALLED, NAV_UPDATED |
| `module` | Модуль ПО | Мета-уровень | MODULE_BORN, FEATURE_ADDED, TEST_ADDED, DEPLOYED |

---

## 3. Грамматика события

Каждое событие в системе — объект со строгой структурой:

```javascript
{
  id:         'evt_1709123456789_a3f2',  // уникальный ID (ts + random)
  entityType: 'company',                 // к какой сущности
  entityId:   'company-42',              // ID конкретного объекта
  type:       'KPI_UPDATED',             // тип из EVENT_REGISTRY
  label:      'KPI обновлён',            // человекочитаемое название
  icon:       'pi pi-chart-bar',         // иконка для UI
  color:      '#3b82f6',                 // цвет в визуализации
  subject:    'Команда / Портал',        // кто инициировал
  data: {                                // произвольные данные события
    irr: 18.5,
    arr: 12_000_000,
    team: 21,
  },
  meta:       {},                        // метаданные (версия, источник)
  ts:         1709123456789,             // unix timestamp мс
}
```

### Определение типа события (Event Registry)

```javascript
// src/config/eventRegistry.js
KPI_UPDATED: {
  id:           'KPI_UPDATED',
  label:        'KPI обновлён',
  icon:         'pi pi-chart-bar',
  color:        '#3b82f6',
  subject:      'Команда / Портал',
  object:       'KPI',
  entityType:   'company',
  phase:        'monitor',
  preconditions: ['COMPANY_ADDED'],
  enables:      ['REVENUE_MILESTONE', 'RISK_ELEVATED'],
}
```

Поля `preconditions` и `enables` образуют **граф достижимости**: что должно произойти до, что становится возможным после.

---

## 4. Event Registry

**Файл:** `src/config/eventRegistry.js`

Единый каталог всех типов событий всех сущностей платформы. Собирает события из нескольких онтологий:

```javascript
import { GR_EVENT_TYPES }   from './grEventTypes.js'      // GR-онтология (~80 типов)
import { SOFT_EVENT_TYPES } from './softEventTypes.js'    // Soft-онтология (14 типов)

// + PORTFOLIO_EVENT_TYPES, DEAL_EVENT_TYPES, SESSION_EVENT_TYPES,
//   FUND_EVENT_TYPES, LEAD_EVENT_TYPES — здесь же

export const EVENT_REGISTRY = {
  ...GR_EVENT_TYPES,
  ...PORTFOLIO_EVENT_TYPES,
  ...DEAL_EVENT_TYPES,
  ...SESSION_EVENT_TYPES,
  ...FUND_EVENT_TYPES,
  ...LEAD_EVENT_TYPES,
  ...SOFT_EVENT_TYPES_TAGGED,
}
```

Все типы событий доступны через:

```javascript
import { getEventDef, EVENT_REGISTRY, PHASES } from '@/config/eventRegistry.js'

const def = getEventDef('DECISION_MADE')
// → { label, icon, color, subject, enables, ... }
```

---

## 5. Event Store

**Файл:** `src/stores/eventStore.js`
**Тип:** Pinia store

Центральное хранилище всех лент событий. Структура — словарь `"entityType:entityId" → Event[]`.

```
timelines: {
  "lead:lead-001":           [...],
  "session:ic-2026-03":      [...],
  "deal:deal-7":             [...],
  "company:company-42":      [...],
  "project:project-bas-01":  [...],
  "fund:subfund-bas":        [...],
  "module:FstCommittee":     [...],
}
```

### Ключевые операции

```javascript
const store = useEventStore()

// Добавить событие (append-only)
store.add('company', 'company-42', 'KPI_UPDATED', { irr: 18.5 })

// Получить ленту (отсортирована по ts)
store.getTimeline('company', 'company-42')  // → Event[]

// Проекция состояния
store.getState('company', 'company-42')     // → { kpi: {...}, risk: 'low', ... }

// Загрузить из Integram (single entity или '_all')
await store.load('company', 'company-42')
await store.load('company', '_all')

// Статистика
store.getStats('company', 'company-42')
// → { total: 12, byType: { KPI_UPDATED: 5, ... }, firstTs, lastTs, state }
```

### Персистентность

Каждое событие при добавлении **fire-and-forget** отправляется в backend:

```
store.add() → persistEvent() → POST /api/events → eventLogService → Integram fst.EventLog
```

Загрузка: `GET /api/events/:entityType/:entityId` или `GET /api/events/:entityType` (все ленты типа).

---

## 6. State = проекция ленты

Состояние любой сущности — **детерминированная функция её ленты событий**. Нет отдельной "текущей записи" в БД.

### Редьюсеры (src/stores/eventStore.js → REDUCERS)

```javascript
company: (events) => events.reduce((state, event) => {
  if (event.type === 'COMPANY_ADDED')     return { ...state, ...event.data, added: event.ts }
  if (event.type === 'KPI_UPDATED')       return { ...state, kpi: { ...state.kpi, ...event.data } }
  if (event.type === 'ROUND_OPENED')      return { ...state, stage: event.data?.round }
  if (event.type === 'EXIT_EVENT')        return { ...state, exited: true, exitTs: event.ts }
  return state
}, { kpi: {}, risk: 'low' })
```

Одинаковый паттерн для всех 7 entity types: `project`, `company`, `deal`, `session`, `fund`, `lead`, `module`.

### Преимущества редьюсеров

- **Детерминизм** — одна и та же лента всегда даёт одно и то же состояние
- **Тестируемость** — редьюсер — чистая функция, тест = массив событий → ожидаемый объект
- **Воспроизводимость** — можно получить состояние на любой момент, срезав ленту по ts

---

## 7. Cross-Entity граф

**Файл:** `src/services/crossEntityReactor.js`

Внутри одного entityType события связаны через `preconditions/enables` в Event Registry. Но **платформа — это сеть сущностей**: стартапер становится заявкой, заявка — сессией ИК, сессия — сделкой, сделка — компанией в портфеле.

Cross-Entity Reactor делает эти переходы **явными и запрашиваемыми**.

### Граф связей (CROSS_ENTITY_LINKS)

```
lead.SENT_TO_IC         ──────────────► session.SESSION_STARTED
lead.GRANTS_MATCHED     ──────────────► project.PROJECT_STARTED

session.DECISION_MADE   (APPROVE/COND) ► deal.TERM_SHEET_PROPOSED

deal.DEAL_CLOSED        ──────────────► company.COMPANY_ADDED
deal.DEAL_CLOSED        ──────────────► fund.CAPITAL_CALLED
deal.TRANCHE_RELEASED   ──────────────► company.KPI_UPDATED

company.EXIT_EVENT      ──────────────► deal.CONDITION_FULFILLED
company.ROUND_OPENED    ──────────────► fund.NAV_UPDATED

project.MEASURE_FUNDED  ──────────────► company.KPI_UPDATED
```

Каждая связь содержит:

```javascript
{
  id:          'session→deal:approve',
  trigger:     { entityType: 'session', eventType: 'DECISION_MADE' },
  enables:     { entityType: 'deal',    eventType: 'TERM_SHEET_PROPOSED' },
  label:       'Решение ИК → Term Sheet',
  cardinality: '1:1',
  condition:   { field: 'verdict', values: ['APPROVE', 'CONDITIONAL'] },  // фильтр по данным
}
```

### API реактора

```javascript
import { nextCrossEntityEvents, getUpstream, getDownstream, fullChain } from '@/services/crossEntityReactor.js'

// Что открывает это событие в других сущностях?
nextCrossEntityEvents({ entityType: 'deal', type: 'DEAL_CLOSED', data: {} })
// → [link(deal→company), link(deal→fund)]

// Откуда пришло это событие?
getUpstream('deal', 'TERM_SHEET_PROPOSED')
// → [link(session→deal:approve)]

// Весь граф для визуализации
const { nodes, edges } = fullChain()

// Проверка валидности против EVENT_REGISTRY
const problems = validateLinks(EVENT_REGISTRY)  // → []
```

### Полная цепочка платформы

```
Стартапер подаёт заявку
    │  lead.SENT_TO_IC
    ▼
ИК открывает сессию
    │  session.DECISION_MADE (APPROVE)
    ▼
Открыта сделка
    │  deal.DEAL_CLOSED
    ├──────────────────────► fund.CAPITAL_CALLED  (деньги изъяты из фонда)
    ▼
Компания в портфеле
    │  company.ROUND_OPENED
    ▼
NAV фонда пересчитан

Параллельно:
    lead.GRANTS_MATCHED
    ▼
project.PROJECT_STARTED ──► project.MEASURE_FUNDED ──► company.KPI_UPDATED
```

---

## 8. GR-онтология

**Файл:** `src/config/grEventTypes.js` + `src/services/grEventEngine.js`

Государственная поддержка (гранты, субсидии, лицензии) — отдельная событийная онтология для entity type `project`. Принцип тот же: провалы рынка → инструменты господдержки → меры → результаты.

### Причинные цепочки

```
PROJECT_STARTED
    │
    ├── MARKET_FAILURE_DETECTED    ──► MEASURE_APPLIED:fasie-umnik
    │                                  ──► MEASURE_APPROVED
    │                                  ──► MEASURE_FUNDED
    │                                  ──► TRL_ADVANCED
    │
    ├── TECH_GAP_DETECTED          ──► MEASURE_APPLIED:minpromtorg-...
    │
    ├── REGULATORY_BARRIER_DETECTED ──► MEASURE_APPLIED:rosstandart-...
    │
    └── INFRA_GAP_DETECTED         ──► MEASURE_APPLIED:rosinfra-...
```

### grEventEngine — чистые функции

```javascript
// src/services/grEventEngine.js

projectState(events)          // редьюсер состояния GR-проекта
nextPossibleEvents(events)     // следующие события, отсортированные по probability
timelineStats(events)          // статистика: funded, approved, trl, total
findTemporalGaps(events)       // временные разрывы: подал → ещё нет ответа > 30 дней
buildCausalDag(events)         // граф причинности событий
counterfactual(events, type)   // что было бы без этого типа события
eventDensity(events, nBuckets) // распределение активности по времени
```

---

## 9. Software Ontology — мета-уровень

**Файлы:** `src/config/softEventTypes.js`, `src/services/softModel.js`, `src/stores/softEventStore.js`

Та же архитектура, применённая к **самой себе**. Каждый модуль платформы — сущность с entity type `module`, имеющая ленту событий своего жизненного цикла.

### Зачем это нужно

Без мета-уровня мы не знаем:
- Какие модули не покрыты тестами?
- Где нет EventStore (состояние теряется при перезагрузке)?
- Какой модуль «заброшен» — ни один тест не проходил несколько месяцев?

С мета-уровнем всё видно через **тот же API**, что и для компаний и сделок.

### События модуля

```
MODULE_BORN         → модуль создан
FEATURE_ADDED       → добавлена функциональность
EVENT_CONNECTED     → подключён eventStore (закрывает gap: no_event_store)
AI_CONNECTED        → подключён AI-роутер (закрывает gap: no_ai)
TEST_ADDED          → написан автотест (закрывает gap: no_tests)
TEST_PASSED         → тест прошёл в CI
BUG_FOUND           → обнаружена ошибка
BUG_FIXED           → ошибка исправлена
DEPLOYED            → задеплоено в production
COVERAGE_GAP        → обнаружен архитектурный пробел
GAP_CLOSED          → пробел устранён
```

### softModel — чистые функции

```javascript
// src/services/softModel.js

moduleState(events)          // { name, phase, featureCount, hasEventStore, hasAI, hasTested, ... }
moduleHealth(events)         // health score 0–100
healthColor(score)           // '#22c55e' | '#f59e0b' | '#ef4444'
findModuleGaps(events)       // [{ type: 'no_tests', severity: 'high', ... }]
nextPossibleActions(events)  // список действий, отсортированных по приоритету
platformStats(timelines)     // { total, withEventStore, withTests, withAI, deployed, openBugs }
counterfactual(events, type) // что было бы без этого типа событий
```

### Формула health score

```
health = 0
+ 25  если hasEventStore
+ 20  если hasTested
+ 10  если hasAI
+ 10  если isDeployed
+ 1   за каждую фичу (max 10)
- 15  за каждый незакрытый баг
```

### Текущее состояние платформы (23 модуля)

| Метрика | Значение |
|---------|---------|
| EventStore подключён | 14 из 23 (64%) |
| Тесты написаны | 4 из 23 (17%) |
| AI подключён | 6 из 23 (26%) |
| Задеплоено | 23 из 23 (100%) |
| Открытые баги | 0 |

Модули с тестами: `grEventEngine` (38), `softModel` (47), `eventStore` (32), `crossEntityReactor` (27) — итого **144 теста**.

---

## 10. Слои архитектуры

```
┌───────────────────────────────────────────────────────────────────────┐
│  МЕТА-УРОВЕНЬ (Software Ontology)                                     │
│  softEventTypes.js → softModel.js → softEventStore.js                │
│  FstSoftModel.vue  ← визуализация состояния платформы                │
├───────────────────────────────────────────────────────────────────────┤
│  ОНТОЛОГИЯ СОБЫТИЙ (Event Schema)                                     │
│  grEventTypes.js + softEventTypes.js + PORTFOLIO/DEAL/SESSION/...     │
│  → EVENT_REGISTRY (единый каталог всех типов событий)                │
├───────────────────────────────────────────────────────────────────────┤
│  CROSS-ENTITY ГРАФ                                                    │
│  crossEntityReactor.js → CROSS_ENTITY_LINKS                          │
│  связи lead→session, session→deal, deal→company, company→fund        │
├───────────────────────────────────────────────────────────────────────┤
│  EVENT STORE (Pinia)                                                  │
│  eventStore.js — timelines: { "entityType:id": Event[] }             │
│  REDUCERS per entityType → getState() = f(events)                    │
├───────────────────────────────────────────────────────────────────────┤
│  ДВИЖКИ ЧИСТЫХ ФУНКЦИЙ                                                │
│  grEventEngine.js    — GR-проект: nextPossible, causal DAG, gaps     │
│  softModel.js        — модуль ПО: health, gaps, actions              │
├───────────────────────────────────────────────────────────────────────┤
│  ПЕРСИСТЕНТНОСТЬ                                                      │
│  backend/src/api/routes/events.js    — REST /api/events               │
│  backend/src/services/eventLogService.js — Integram fst.EventLog     │
│    TTL-кэш 30с, инвалидация при записи                               │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 11. Персистентность и кэш

### Схема Integram (таблица EventLog, typeId 7847)

| Реквизит ID | Поле | Тип |
|-------------|------|-----|
| 7849 | eventId | string (уникальный, `evt_...`) |
| 7851 | entityType | string |
| 7853 | entityId | string |
| 7855 | eventType | string |
| 7857 | data | JSON-строка |
| 7859 | ts | число (unix ms) |

### TTL-кэш в eventLogService

`fetchAllRows()` загружает все события постранично (по 500). При 1000+ событий — медленно. Решение: кэш с TTL 30 сек, инвалидируется при каждом `appendEvent()`.

```javascript
const CACHE_TTL_MS = 30_000
let _cache = null, _cacheTs = 0

function invalidateCache() { _cache = null; _cacheTs = 0 }

async function fetchAllRows() {
  if (_cache && Date.now() - _cacheTs < CACHE_TTL_MS) return _cache
  // ... загрузка ...
  _cache = rows; _cacheTs = Date.now()
  return rows
}
```

### Merge-логика при загрузке

Remote — источник истины. Локальные события, созданные после последнего remote timestamp, сохраняются поверх:

```javascript
const lastRemoteTs = remote.at(-1)?.ts || 0
const localNew = (timelines.value[k] || []).filter(e => e.ts > lastRemoteTs)
timelines.value[k] = [...remote, ...localNew]
```

---

## 12. Тесты и инварианты

### Покрытие тестами (144 теста, Vitest)

| Файл тестов | Модуль | Тестов |
|-------------|--------|--------|
| `grEventEngine.spec.js` | grEventEngine.js | 38 |
| `softModel.spec.js` | softModel.js | 47 |
| `eventStore.spec.js` | eventStore.js (store) | 32 |
| `crossEntityReactor.spec.js` | crossEntityReactor.js | 27 |

### Что тестируется

**grEventEngine (38 тестов):**
- Редьюсер `projectState` — все типы событий
- `nextPossibleEvents` — сортировка по probability, фильтрация по состоянию
- `timelineStats` — агрегация финансов, TRL, количества
- `findTemporalGaps` — временные разрывы в цепочках мер
- `buildCausalDag` — граф причинности, топологический порядок
- `counterfactual` — что было бы без X
- `eventDensity` — распределение по временным бакетам

**softModel (47 тестов):**
- `moduleState` — все 14 типов soft-событий
- `moduleHealth` — формула 0–100, учёт багов
- `healthColor` — пороговые цвета
- `findModuleGaps` — все 4 типа gap
- `nextPossibleActions` — сортировка по приоритету (проверка `??` вместо `||`)
- `platformStats` — агрегация по всем модулям
- `counterfactual` — для модулей

**eventStore (32 теста):**
- Все 6 редьюсеров (project, company, deal, session, fund, lead, module)
- add/getTimeline/remove/clear/getIds
- getLastEvent, getStats
- load — merge remote+local
- load('_all') — режим всех лент типа
- grTimelines computed — совместимость с grEventStore

**crossEntityReactor (27 тестов):**
- Структура CROSS_ENTITY_LINKS — уникальность id, полнота полей
- nextCrossEntityEvents — все основные переходы + условия
- getUpstream/getDownstream
- fullChain — nodes, edges, покрытие всех 6 entityType
- validateLinks — отсутствие «висячих» событий в реестре
- Полная цепочка lead→session→deal→company→fund

### Запуск

```bash
# Только онтологические тесты
npx vitest run src/services/__tests__/ src/stores/__tests__/eventStore.spec.js

# Все тесты
npx vitest run
```

---

## 13. Инварианты системы

Правила, которые всегда должны выполняться:

1. **Append-only** — события не редактируются и не удаляются из ленты (только через прямое API для коррекции данных)

2. **Детерминизм** — `getState(entityType, entityId)` всегда возвращает один и тот же результат для одной и той же ленты событий

3. **Реестр полон** — все типы событий в CROSS_ENTITY_LINKS и в EVENT_REGISTRY (проверяется `validateLinks()`)

4. **Сортировка по `??`** — при сортировке событий по числовым приоритетам использовать `??` (nullish coalescing), не `||` (falsy). `priority = 0` — валидное значение

5. **persistEvent — fire-and-forget** — запись в Integram не блокирует UI. Ошибки персистентности логируются, но не прерывают поток событий

6. **TTL-кэш инвалидируется при записи** — `appendEvent()` всегда вызывает `invalidateCache()`

7. **entityType в каждом событии** — каждый event содержит корректный `entityType`, соответствующий ключу ленты

---

## Связанные файлы

```
src/
├── config/
│   ├── eventRegistry.js      ← единый каталог всех типов событий
│   ├── grEventTypes.js        ← GR-онтология (~80 типов)
│   └── softEventTypes.js      ← Software-онтология (14 типов)
├── services/
│   ├── crossEntityReactor.js  ← граф cross-entity связей
│   ├── grEventEngine.js       ← чистые функции для GR-проектов
│   └── softModel.js           ← чистые функции для модулей ПО
│   └── __tests__/
│       ├── crossEntityReactor.spec.js
│       ├── grEventEngine.spec.js
│       └── softModel.spec.js
├── stores/
│   ├── eventStore.js           ← универсальное хранилище лент
│   ├── softEventStore.js       ← Pinia store для модулей (делегирует eventStore)
│   └── __tests__/
│       └── eventStore.spec.js
└── views/pages/
    └── FstSoftModel.vue        ← визуализация Software Ontology

backend/src/
├── api/routes/events.js        ← REST /api/events (CRUD лент)
└── services/eventLogService.js ← Integram fst.EventLog + TTL-кэш
```

---

_Обновлено: 2026-03-10_
