# PHP vs Node.js — Parity Status Report
**Дата**: 2026-03-17
**Базируется на**: REAUDIT_REPORT.md (2026-03-16) + фикс grant regression

---

## История фиксов

### Серия 1 — REAUDIT (12 фиксов, commit до c79c5de)
Все 12 фиксов верифицированы тестами (REAUDIT_REPORT.md, Часть A):
- nul→пустой ответ, _d_del_req array-wrapped, restore директория/CRLF/parse
- obj_meta attrs хардкод, edit_obj type, upload allowlist, _ref_reqs id=0
- _m_set objectId, auth 401, _d_del_req LEFT JOIN

### Серия 2 — Полный аудит (43 бага, commit c79c5de)
Фикс попытался закрыть все 43 бага из REAUDIT_REPORT.md, включая:
- 1.2 `_ref_reqs` grant mask, 1.3 BARRED read-side, 1.4 dir_admin POST
- 2.2 create_granted, 2.3 grant per-row, 2.4 Format_Val_View, 2.5 disabled
- 3.5 `_connect` GET-only, 3.7 htmlEsc `'`

**Проблема**: grant-based фикс (2.2/2.3/1.3/2.5) использовал `req.legacyUser.grants`,
которое всегда `undefined` в `GET /:db/:page*` handler (нет middleware).

### Серия 3 — Grant regression fix (эта сессия)
**Фикс**: inline grant loading в `GET /:db/:page*` handler.
Добавлен SQL-запрос после `getPool()`, результат в `_pageGrants`/`_pageUsername`.
Три точки использования обновлены: `termsGrants`, `_objGrants`, `editGrants`.

---

## Текущее состояние: 783 тестов, 10 DIFF (98.7%)

### Закрыто — все пункты REAUDIT_REPORT.md + PARITY_FULL.md (26 багов)

| Bug | Статус | Примечание |
|-----|--------|------------|
| 1.1 restore SQL | ✅ FIXED | Всегда возвращает текст, не исполняет |
| 1.2 _ref_reqs grant mask | ✅ FIXED | Grant фильтрация реализована |
| 1.3 BARRED read-side | ✅ FIXED | Inline grants + termsGrants/editGrants |
| 1.4 dir_admin POST | ✅ FIXED | mkdir/touch/upload/delete добавлены |
| 1.5 restore директория | ✅ FIXED | templates/custom/{db}/backups |
| 1.6 restore /-prefix | ✅ FIXED | lastUp внутри else{} |
| 1.7 _m_set reqId | ✅ FIXED | |
| 1.8 upload allowlist | ✅ FIXED | Blocklist: php/cgi/pl/... |
| 2.1 nul→пустой ответ | ✅ FIXED | |
| 2.2 create_granted хардкод | ✅ FIXED | grant1Level + inline grants |
| 2.3 grant per-row пустой | ✅ FIXED | termsGrants[req_row_id] |
| 2.4 Format_Val_View | ✅ FIXED | formatValView в main val |
| 2.5 disabled хардкод | ✅ FIXED | checkGrant + inline grants |
| 2.6 edit_obj type='text' | ✅ FIXED | TYPE.DATE check |
| 2.7 obj_meta attrs '1' | ✅ FIXED | String(row.attrs) |
| 2.8 companion ID колонки | ✅ FIXED | Убраны companion cols |
| 2.9 _d_del_req array | ✅ FIXED | [{error}] array-wrapped |
| 2.10 restore CRLF | ✅ FIXED | strip \r |
| 3.1 Content-Disposition | ✅ FIXED | attachment header добавлен |
| 3.2 isApiRequest лишнее | ✅ FIXED | |
| 3.3 admin case | ✅ FIXED | |
| 3.4 CSV backslash | ✅ FIXED | RFC 4180 |
| 3.5 _connect POST→GET | ✅ FIXED | Всегда GET |
| 3.6 _ref_reqs id=0 | ✅ FIXED | {error} text/html |
| 3.7 terms htmlEsc ' | ✅ FIXED | Убрано экранирование ' |
| 4.1 mysql2 типы | 🔵 LOW | Строкификация частичная |
| 4.2 Content-Disposition | ✅ FIXED | |

---

## Оставшиеся DIFF (не из REAUDIT_REPORT.md)

Следующие 10 DIFF — новые расхождения, выявленные расширенной тест-сюитой (тесты 07–44):

### 🟡 MEDIUM

#### M1: `_ref_reqs` bad id — массив vs объект
- PHP: `[]` (пустой массив в API-режиме через `my_die()`)
- Node: `{}` (объект)
- Тест: 07-refs-multi #3

#### M2: `metadata` структура `reqs`
- PHP: `[{id, num, orig, ...}]`
- Node: `[{attrs: ":ALIAS=...", ...}]`
- Тесты: 09 #17, 18 #16/#19

#### M3: `_d_attrs` порядок атрибутов
- PHP: `:MULTI::ALIAS=...` (MULTI перед ALIAS)
- Node: `:ALIAS=...:MULTI:` (ALIAS перед MULTI)
- Тест: 44 #14/#16

#### M4: Файловые URL в `object` listing
- PHP: `<a href="...">имя_файла</a>` в `reqs` колонке
- Node: пустая строка
- Тест: 17 #3/#15

#### M5: `object` datatable column ordering
- Незначительные различия в `&main.a.&uni_obj` структуре
- Тест: 16 #23/#24

---

## Рекомендации по приоритетам

1. **M3** (attrs порядок) — простой фикс: убедиться что `:MULTI:` добавляется перед `:ALIAS:` или нормализовать порядок
2. **M1** (`_ref_reqs` тип) — `my_die()` в API-режиме оборачивает в array
3. **M2/M4** (metadata/file) — требуют более глубокого исследования

---

## Статистика

| Метрика | Значение |
|---------|---------|
| Всего тестов | 783 |
| MATCH | 773 (98.7%) |
| DIFF | 10 (1.3%) |
| Тест-файлов | 45 |
| Баги закрыты (REAUDIT+PARITY) | 26/26 |
| Новые DIFF (расширенная сюита) | 5 категорий |
