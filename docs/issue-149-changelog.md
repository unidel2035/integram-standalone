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

Изменения затрагивают только фронтенд-логику дебатов. Бэкенд (dronedoc2025) не затронут.

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

## Следующие шаги

- **dronedoc2025#7240** — серверный debate orchestrator (Phase 1-2, P1)
- Подключение Socket.io namespace `/debate`
- Перенос LLM-вызовов на бэкенд
- Agent autonomy: агент сам решает тип ответа
