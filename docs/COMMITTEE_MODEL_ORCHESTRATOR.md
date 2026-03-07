# AI Инвесткомитет — Оркестратор моделей

## Концепция

Каждый агент инвесткомитета использует оптимальную AI-модель, выбранную исходя из:
- **Роли агента** (финансист, технический, критик...)
- **Типа задачи** (первичная позиция, контраргумент, финальный синтез)
- **Профиля скорости** (fast / balanced / quality)
- **Ручного переопределения** пользователем

## Архитектура

```
FstCommittee.vue
  → selectedSpeedProfile + agentModelOverrides
  ↓
createSession(project, { speedProfile, modelOverrides })
  ↓
FstCommitteeEngine → generateArgumentAI(agent, type, ..., opts)
  ↓
fstCommitteeModelOrchestrator.resolveModel(agentId, taskType, profile, overrides)
  → modelId: "polza/qwen/qwen-turbo"
  ↓
/api/ai-tokens/chat { modelId }
  ↓
TokenBasedLLMCoordinator → polza.ai API
```

## Профили скорости

| Профиль | Дефолтная модель | Синтез | Скорость |
|---------|-----------------|--------|----------|
| `fast`  | Qwen Turbo | Gemini 2.5 Flash Lite | ~1.5с/аргумент |
| `balanced` | Gemini 2.5 Flash Lite | Gemini 2.5 Flash Lite | ~1.9с/аргумент |
| `quality` | DeepSeek Chat | Claude Sonnet 4.6 | ~10с/аргумент |

## Матрица выбора модели по агенту и задаче (профиль: fast)

| Агент | OPENING | CHALLENGE | COUNTER | SYNTHESIS |
|-------|---------|-----------|---------|-----------|
| tech | gemini-2.5-flash-lite | qwen-turbo | qwen-turbo | gemini-2.5-flash-lite |
| finance | gemini-2.5-flash-lite | qwen-turbo | qwen-turbo | gemini-2.5-flash-lite |
| sovereignty | qwen-turbo | qwen-turbo | qwen-turbo | qwen-turbo |
| risk | gemini-2.5-flash-lite | qwen-turbo | qwen-turbo | gemini-2.5-flash-lite |
| portfolio | gemini-2.5-flash-lite | gemini-2.5-flash-lite | qwen-turbo | gemini-2.5-flash-lite |
| devil | qwen-turbo | qwen-turbo | qwen-turbo | qwen-turbo |

**Rationale:** Технические и финансовые агенты требуют более качественной аналитики → gemini-flash.
Критик и эксперт суверенности делают короткие реплики → qwen-turbo (скорость).

## Онтологическая модель

```
CommitteeSession
  ├── speedProfile: "fast" | "balanced" | "quality"
  ├── modelOverrides: { [agentId]: modelId }
  └── events[]
        └── CommitteeArgument
              ├── model: "qwen/qwen-turbo"  ← какая модель сгенерировала
              ├── agentId
              ├── type: OPENING|CHALLENGE|COUNTER|SYNTHESIS
              └── dimension
```

Типы событий онтологии:
- `model:assigned` — оркестратор назначил модель агенту
- `model:override` — пользователь вручную переопределил модель

## Требования (зафиксированы в онтологии)

### Функциональные
1. Каждый агент должен иметь возможность работать на независимой модели
2. Пользователь может выбрать профиль (fast/balanced/quality) одним кликом
3. Пользователь может переопределить модель для любого конкретного агента
4. Использованная модель сохраняется в метаданных каждого аргумента
5. Метаданные моделей экспортируются в KAG при сохранении сессии

### Нефункциональные
- В профиле `fast`: суммарное время сессии < 60с (при 6 агентах × ~4 аргумента)
- Таймаут на один AI-вызов: 30с (снижен с 60с для быстрых моделей)
- Fallback: при ошибке AI — шаблонный аргумент (не блокирует сессию)

## Файлы

| Файл | Назначение |
|------|-----------|
| `fstCommitteeModelOrchestrator.js` | Оркестратор: модели, матрица, профили, resolveModel() |
| `fstCommitteeAI.js` | Вызовы AI — принимает opts.speedProfile + opts.modelOverrides |
| `FstCommitteeEngine.js` | Движок — хранит speedProfile/modelOverrides в session |
| `FstCommittee.vue` | UI — панель выбора профиля и моделей по агентам |
| `fstCommitteeOntology.js` | Онтология — EVENT_TYPES.MODEL_ASSIGNED, exportToKagEntities с моделями |
