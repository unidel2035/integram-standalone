# Integram API Findings & Issues

## CRITICAL: `_d_req` rejects base type IDs

**Date:** 2026-03-15
**Severity:** Critical for all DDL tests

### Problem
PHP's `_d_req` endpoint (add column/requisite to type) rejects **base type IDs** like:
- `3` (SHORT), `2` (LONG), `4` (DATETIME), `7` (BOOL), `11` (NUMBER), `9` (DATE), etc.

Error: `"Некорректный тип 3 - это базовый тип"`

### Root cause
In `integram-server/index.php:8572`:
```php
if($row["t"] == $t)
    my_die(t9n("[RU]Некорректный тип $t - это базовый тип"));
```
Base types in the database are self-referencing (`id == t`), e.g. type 3 has `t=3`. This check prevents using base type IDs directly.

### Solution
Use **concrete type IDs** — types that have the desired base type but are not themselves base types.
For example, to create a SHORT column: use `t=43` (type "class" with `type=3`), not `t=3`.

### Impact
- `lib.js` `addColumn()` was passing base types → always returned NaN on PHP
- All tests using `addColumn()` silently skipped column-dependent tests (e.g. `_m_set`, `_d_null`, `_d_multi`)
- The 97.5% parity score was artificially high — column-dependent tests were never running
- Fixed in lib.js by building `concreteTypes` map from `/terms` during `setup()`

### Node.js behavior
Node.js `_d_req` has the same check (`reqTypeMeta[0].t === reqType`) — both servers reject base types identically. No parity issue here, but both need concrete type IDs.

### How dronedoc2025 handles this
`integramApiClient.addRequisite(typeId, 3)` — passes base type 3 directly. This only works via Node.js backend (which also rejects it). The documented API comment `const textCol = await client.addRequisite(tableId, 3) // SHORT text` is **incorrect** and will fail on both servers.

**Real API usage for column creation requires a concrete type ID, not a base type ID.**

---

## `_d_new` vs `_d_req` for columns

### `_d_new` (Create type)
- `POST /_d_new` with `t=3` → creates **new type** with base type SHORT
- Works with base type IDs (3, 2, 4, etc.)
- Used to create tables/types

### `_d_req` (Add column/requisite)
- `POST /_d_req/{parentTypeId}` with `t={concreteTypeId}` → adds column to existing type
- **DOES NOT work** with base type IDs
- `t` must be an existing type's ID where `id != t` (not a base type)
- The column inherits the base type of the concrete type used

### `_d_ref` (Add reference column)
- `POST /_d_ref/{parentTypeId}` with `t={targetTableId}` → adds reference column
- Used for foreign-key columns (dropdowns, multiselect)

---

## Response format differences

### `_d_save` (Rename type)
- PHP returns **array** `[{"id":..., "obj":...}]`
- Node returns **object** `{"id":..., "obj":...}`
- **DIFF** — needs fixing in Node.js

### `_d_del_req` (Delete non-existent requisite)
- PHP returns **object** `{"error":"..."}`
- Node returns **array** `[{"error":"..."}]`
- **DIFF** — needs fixing in Node.js

### `metadata/{typeId}` endpoint
- PHP returns: `{id, reqs, type, unique, up, val}` — the type's own metadata
- Node returns: `{&main.&top_menu, &main.myrolemenu}` — full page template
- **MAJOR DIFF** — Node endpoint may be using wrong handler

---

## Duplicate type creation warnings

### `_d_new` with existing name
- When creating a type that already exists, both servers return the existing type's ID with a warning
- But the warning text differs:
  - PHP: `"Тип __name__ уже существует!"`
  - Node: `"Тип __name__ уже существует!"`
- When running tests that create types, residual types from previous runs can cause this
- `preCleanup(PREFIX)` removes stale test types before tests run

---

## Multiselect flow

### How to add multiselect items
1. Create reference column with `_d_ref`
2. Toggle multiselect with `POST /_d_multi/{colId}` → changes column to multiselect
3. Add items with `POST /_m_set/{objectId}` + `t{colId}={targetObjId}`
4. Response contains multiselect item ID (different from object ID or target ID)
5. Remove items with `POST /_m_del/{msItemId}` — NOT the object ID, NOT the target ID

### How to read multiselect data
- `GET /edit_obj/{objectId}` → contains multiselect items in response
- `GET /_ref_reqs/{colId}?id={objectId}` → shows available options (with selected state)

---

## Filter patterns (from DataTable.vue)

### F_T (Text search)
- `GET /object/{typeId}?F_T=query` → search main value
- `POST /object/{typeId}` + `F_T[reqId]=query` → search specific field

### F_I (Exact match)
- `POST /object/{typeId}` + `F_I[reqId]=value` → exact match on requisite
- For references: `F_I[refColId]=targetObjId`
- For booleans: `F_I[boolColId]=1` or `F_I[boolColId]=0`

### F_U (Parent filter)
- `GET /object/{childTypeId}?F_U={parentObjId}` → list children of parent

### Sorting
- `?sort=val&asc=1` → sort by main value ascending
- `?sort={reqId}&desc=1` → sort by requisite descending

### Pagination
- `?LIMIT=20&pg=1` → 20 items per page, page 1
- `?LIMIT=0` → return count only (no objects)

---

## Date format

**CRITICAL:** Dates must be in ISO format with dashes: `YYYY-MM-DD HH:MM:SS`
- `"2025-03-15 10:00:00"` → correct
- `"20250315"` → interpreted as Unix timestamp → wrong date!

---

## Report structure

- Reports are objects of type 22
- Report columns are objects of type 28, subordinate to report (up=reportId)
- Report FROM clauses are objects of type 44, subordinate to report
- Execute report: `GET /report/{reportId}?JSON=1`
- CSV export: `GET /report/{reportId}?csv=1`

---

## Test Results Summary (2026-03-15)

### New test suites (from Vue component patterns):

| Suite | Tests | Match | Diff | Score |
|-------|-------|-------|------|-------|
| 09-tables-crud | 25 | 19 | 6 | 76% |
| 10-objects-lifecycle | 28 | 18 | 10 | 64% |
| 11-directories | 22 | 22 | 0 | **100%** |
| 12-subordinates | 27 | 21 | 6 | 78% |
| 13-filtering | 28 | 0 | 28 | 0%* |
| 14-multiselect | 18 | 18 | 0 | **100%** |
| 15-reports-advanced | 20 | 10 | 10 | 50% |
| 16-datatable-patterns | 24 | 14 | 10 | 58% |
| **TOTAL** | **192** | **122** | **70** | **63.5%** |

### Recurring diff categories

**1. `/metadata/{typeId}` endpoint (Node bug)**
- PHP returns: `{id, reqs, type, unique, up, val}` — type structure JSON
- Node returns: `{&main.&top_menu, &main.myrolemenu}` — full HTML template
- Node is not parsing the metadata endpoint correctly

**2. `_m_set` / `_m_save` response type mismatch**
- PHP returns: `{"id":..., "obj":...}` (object)
- Node returns: `[{"id":..., "obj":...}]` (array wrapping)
- Affects: title cells, long text, clear field, full row save

**3. `object_view_reqs` align values**
- PHP: `["LEFT","CENTER","CENTER","LEFT",...]`
- Node: `["LEFT","LEFT","LEFT","LEFT",...]`
- PHP uses CENTER for NUMBER and BOOL columns, Node always LEFT

**4. `filter_req_rcm` array lengths differ**
- PHP returns more filter columns than Node
- Related to how column metadata is collected for the filter header

**5. `edit_obj` missing blocks in Node**
- PHP includes: `&buttons`, `&editreq_boolean`, `&editreq_datetime`
- Node omits these blocks
- Affects: boolean checkboxes, datetime pickers, action buttons

**6. `reqs` data format differences**
- PHP includes `"***"` for some reference values (password masking?)
- Node shows actual values
- PHP normalizes `attrs` field to `"1"`, Node keeps original ID

**7. POST `/object/` with F_I/F_T — 500/404 on both servers**
- POST method with body for filter params doesn't work
- Filters must be passed as GET query parameters
- Tests need to use GET with URL-encoded F_I/F_T params

**8. `edit_obj` for subordinate objects — PHP 500**
- `GET /edit_obj/{childId}` returns 500 on PHP
- Node returns 200 with proper JSON
- PHP bug with subordinate object edit rendering

**9. Report `_m_new/44` (FROM) and `_m_new/28` (columns) val differs**
- PHP: returns table name in val (e.g. "TableName -> ColumnName")
- Node: returns `"__ORD__"` (numeric order value)
- Normalization issue — `val` looks like an ordinal in Node

**10. F_I/F_T filtering — PHP 500 on all filter requests**
- `GET /object/{typeId}?F_I[reqId]=value` → PHP returns 500
- `GET /object/{typeId}?F_T=query` → PHP returns 500
- Node handles all filters correctly (200)
- **Likely cause:** PHP built-in server (`php -S`) doesn't handle `[]` in query params properly
- **Impact:** ALL filter tests fail with PHP 500 — this is a PHP server limitation, not a parity issue
- Need to test with nginx+php-fpm to verify

**11. Boolean display: PHP `"X"` vs Node `"1"`**
- In `&object_reqs` block, boolean values:
  - PHP: displays as `"X"` (human-readable)
  - Node: displays as `"1"` (raw value)
- Not critical but causes false diffs in object list comparison

**12. `edit_obj` for subordinate objects — PHP 500**
- `GET /edit_obj/{childObjectId}` → PHP returns 500 (fatal error)
- Node returns 200 with proper JSON
- PHP bug: can't render edit form for subordinate objects on built-in server
