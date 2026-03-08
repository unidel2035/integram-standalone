# Issue #149 — Smart targeting, sequential debate, ConditionalDecision

## Дата: 2026-03-08
## PR: #150 (merged)
## Связанные issues: #148, #149, dronedoc2025#7240

---

## Что изменено

### 1. Fix typo в DebateRoom.js
- **Метод:** `getUnchallengeddArgs` → `getUnchallengedArgs` (двойная 'd')
- **Файл:** `src/components/fst-committee/DebateRoom.js:83`

### 2. Smart targeting в _phaseCrossDebate()
- **Было:** случайный выбор цели (`Math.random()`) и контр-агента (`Math.random() > 0.5`)
- **Стало:** weakness-first через `getUnchallengedArgs()` + сортировка по `toulminStrength`
- **Контр-агент:** владелец атакуемого аргумента вместо случайного
- **Файл:** `src/components/fst-committee/FstCommitteeEngine.js:330-365`

### 3. Sequential cross-debate
- **Было:** `Promise.all(challengers.map(...))` — все агенты стартуют одновременно, видят замороженный снимок
- **Стало:** `for..of` — каждый агент видит свежие сообщения предыдущих
- **Обе ветки** (useAgentLoop и default) теперь используют одинаковую логику
- **Файл:** `src/components/fst-committee/FstCommitteeEngine.js:330-365`

### 4. ConditionalDecision wiring
- **Было:** `detectContradictions` и `assembleConditionalDecision` экспортировались из `fstCommitteeOntology.js`, но нигде не использовались
- **Стало:** подключены в `_phaseSynthesis()` после формирования решения
- **Событие:** `ConditionalDecisionReady` эмитится с полной структурой противоречий
- **Файл:** `src/components/fst-committee/FstCommitteeEngine.js:495-528`

---

## Архитектурное влияние

Фронтенд + бэкенд. Сессии дебатов синхронизируются на сервер через REST + Socket.IO.

```
DebateRoom.publish()
    ↓
FstCommitteeEngine._phaseCrossDebate()  ← smart targeting + sequential
    ↓
FstCommitteeEngine._phaseSynthesis()    ← ConditionalDecision wiring
    ↓
emit('ConditionalDecisionReady')        ← новое событие
```

## ConditionalDecision структура

```javascript
{
  verdict: 'INVEST' | 'DEFER' | 'REJECT',
  score: 0-100,
  contradictions: [
    { argA: { agentId, text }, argB: { agentId, text }, dimension, severity }
  ],
  conditions: [
    { type: 'MANDATORY' | 'RECOMMENDED', text, source: 'contradiction' | 'agent' }
  ],
  dealTerms: { ... },
  scenarios: { best: {...}, base: {...}, worst: {...} }
}
```



---

## Что НЕ изменено (вопреки issue #148)

- **Problem 3 (AbortSignal)** — верификация показала что все fetch вызовы в AgentLoop.js уже имеют правильные abort-сигналы. Изменения не требуются.

---

## Тестирование

Проверено через Playwright на http://173.249.2.184:5174/fst-committee:
- Полная сессия ИК: 42 аргумента, 92 события, 12 голосов
- CHALLENGE направлены на слабые аргументы (подтверждено цитированием)
- COUNTER приходит от владельца атакованного аргумента
- Fallback-шаблоны отработали корректно при 502 от API

---

## Следующие шаги (ВЫПОЛНЕНО)

### dronedoc2025 PR #7241 (merged)

**Бэкенд — 3 новых файла:**
- `backend/monolith/src/core/DebateSession.js` — in-memory session model (TTL 30мин, smart targeting, messagesSince)
- `backend/monolith/src/api/routes/debate.js` — REST CRUD: 6 endpoints /api/debate/sessions
- `backend/monolith/src/sockets/debateNamespace.js` — Socket.IO namespace /debate (join, message, vote, phase-change, end)

**Фронтенд fund:**
- `src/services/debateSessionService.js` — REST клиент + Socket.IO коннектор
- `src/components/fst-committee/FstCommitteeEngine.js` — авто-создание бэкенд-сессии, синхронизация фаз/сообщений/голосов

**Тест после интеграции:**
- 159 событий, 42 аргумента, 12 голосов
- Бэкенд-сессия синхронизирована: phase HUMAN_APPROVAL, 42 messages
- Решение: DEFER 61/100
- Все 3 сервиса работают: backend:8082, dronedoc-frontend:5173, fst-frontend:5174
