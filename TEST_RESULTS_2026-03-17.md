# PHP vs Node.js — Full Test Suite Results
**Дата**: 2026-03-17
**Тестов всего**: 783 (45 файлов, тесты 01–45)
**Серверы**: PHP 8082, Node 8081
**Исправление в этой сессии**: inline grant loading в `GET /:db/:page*` handler

---

## Итог: 773 MATCH, 10 DIFF (98.7%)

| # | Тест | Pass | Fail | Всего |
|---|------|------|------|-------|
| 01 | auth | 15 | 0 | 15 |
| 02 | ddl | 20 | 0 | 20 |
| 03 | dml | 16 | 0 | 16 |
| 04 | listing | 21 | 0 | 21 |
| 05 | reports | 13 | 0 | 13 |
| 06 | admin | 16 | 0 | 16 |
| 07 | refs-multi | 18 | **1** | 19 |
| 08 | export | 11 | 0 | 11 |
| 09 | tables-crud | 24 | **1** | 25 |
| 10 | objects-lifecycle | 28 | 0 | 28 |
| 11 | directories | 22 | 0 | 22 |
| 12 | subordinates | 24 | 0 | 24 |
| 13 | filtering | 14 | 0 | 14 |
| 14 | multiselect | 18 | 0 | 18 |
| 15 | reports-advanced | 20 | 0 | 20 |
| 16 | datatable-patterns | 22 | **2** | 24 |
| 17 | file-upload | 5 | **2** | 7 |
| 18 | column-metadata | 17 | **2** | 19 |
| 19 | auth-password | 21 | 0 | 21 |
| 20 | row-operations | 17 | 0 | 17 |
| 21 | subordinate-tables | 8 | 0 | 8 |
| 22 | directories-multiselect | 22 | 0 | 22 |
| 23 | inline-editing | 18 | 0 | 18 |
| 24 | reports-filters | 17 | 0 | 17 |
| 25 | admin-endpoints | 19 | 0 | 19 |
| 26 | json-formats | 24 | 0 | 24 |
| 27 | reference-search | 13 | 0 | 13 |
| 28 | date-formats | 14 | 0 | 14 |
| 29 | object-count-pagination | 17 | 0 | 17 |
| 30 | special-operations | 14 | 0 | 14 |
| 31 | list-dict-connect | 17 | 0 | 17 |
| 32 | session-exit-jwt | 14 | 0 | 14 |
| 33 | error-handling-edge | 20 | 0 | 20 |
| 34 | ref-search-filters | 20 | 0 | 20 |
| 35 | metadata-obj-meta | 14 | 0 | 14 |
| 36 | multifield-save | 15 | 0 | 15 |
| 37 | report-listing-export | 20 | 0 | 20 |
| 38 | subordinate-ordering | 10 | 0 | 10 |
| 39 | encoding-escaping | 15 | 0 | 15 |
| 40 | grants-permissions | 14 | 0 | 14 |
| 41 | type-lifecycle | 19 | 0 | 19 |
| 42 | bulk-operations | 15 | 0 | 15 |
| 43 | my-database | 28 | 0 | 28 |
| 44 | d-req-attrs-ord | 26 | **2** | 28 |
| 45 | m-id-validate-auth | 22 | 0 | 22 |
| **ИТОГО** | | **773** | **10** | **783** |

---

## Оставшиеся 10 DIFF (6 тестов)

### 07: `GET /_ref_reqs (bad id)` — 1 DIFF
- PHP возвращает `[]` (array), Node возвращает `{}` (object) при невалидном id
- Известная проблема: PHP `my_die()` оборачивает в array в API-режиме

### 09: `GET /metadata (single type)` — 1 DIFF
- `val[reqs]` — структура реквизитов в ответе metadata отличается (id/num/orig)

### 16: `GET /object (datatable, final state)` — 2 DIFF
- `&main.a.&uni_obj` и `object` ключи: различия в column ordering/alignment данных

### 17: `GET /object (listing with file)` — 2 DIFF
- `val[reqs]` — PHP возвращает HTML ссылку на файл, Node возвращает пустую строку
- Генерация файловых URL после загрузки

### 18: `GET /metadata (column ops)` — 2 DIFF
- Структура реквизитов после операций над колонками: `{id, num, orig}` vs `{attrs}`

### 44: `GET /metadata (after _d_attrs / after multi)` — 2 DIFF
- Порядок атрибутов в строке `attrs`: `:MULTI::ALIAS=...` (PHP) vs `:ALIAS=...:MULTI:` (Node)

---

## Исправление этой сессии: inline grant loading

**Проблема**: commit `c79c5de` добавил grant-based проверки (`create_granted`, BARRED, `parentDisabled`),
но `GET /:db/:page*` handler не имеет `legacyAuthMiddleware` → `req.legacyUser` всегда `undefined` → гранты всегда `{}`.

**Симптомы**:
- `create_granted`: PHP=`block`, Node=`none` (у testbot ROOT WRITE грант, но он не загружался)
- `disabled`: PHP=`''`, Node=`'DISABLED'` (та же причина)
- BARRED фильтрация: всегда пустые гранты → фильтрация не работала

**Фикс** (`legacy-compat.js`, строки 5243–5260):
- После `const pool = getPool()` добавлен inline SQL-запрос, загружающий `roleId` и `username` из токена
- Вызов `getGrants(pool, db, roleId, ...)` — тот же код, что в `legacyAuthMiddleware`
- Результат в `_pageGrants` / `_pageUsername`, используется во всех трёх точках
  (lines 5558 `termsGrants`, 5893–5894 `_objGrants/_objUsername`, 6337–6340 `editGrants/_editUn`)
