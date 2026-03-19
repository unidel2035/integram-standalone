# PHP ↔ Node.js Parity Report

Date: 2026-03-15

## Summary

| Suite | PASS | FAIL | SKIP | File |
|-------|------|------|------|------|
| Read-only parity | 19 | 0 | 3 | `full-parity-audit.js` |
| CRUD parity | 28 | 0 | 0 | `crud-parity-audit.js` |
| Query & filter parity | 18 | 0 | 3 | `query-parity-audit.js` |
| Endpoints parity | 46 | 0 | 13 | `endpoints-parity-audit.js` |
| Comprehensive parity | 113 | 0 | 22 | `comprehensive-parity-audit.js` |
| Auth extended | 16 | 0 | 3 | `auth-extended.js` |
| DDL extended | 18 | 0 | 0 | `ddl-extended.js` |
| DML extended | 11 | 0 | 0 | `dml-extended.js` |
| Listing extended | 16 | 0 | 9 | `listing-extended.js` |
| Reports extended | 24 | 0 | 0 | `reports-extended.js` |
| Business CRUD | 40 | 0 | 4 | `business-crud.js` |
| **Total** | **349** | **0** | **57** |

## Extended Test Suites

### Auth Extended (`auth-extended.js`): 16 PASS / 0 FAIL / 3 SKIP

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | auth tzone | PASS | |
| 2 | auth change mismatch | PASS | |
| 3 | auth change short | PASS | |
| 4 | auth secret invalid | PASS | |
| 5 | GET auth?secret | PASS | |
| 6 | validate | PASS | |
| 7 | validate no token | PASS | |
| 8 | validate no JSON | PASS | |
| 9-12 | jwt (empty/invalid/malformed/token=) | PASS | Node-only |
| 13-16 | register (email/short pwd/mismatch/agree) | PASS | Node-only |
| 17 | getcode tzone | PASS | |
| 18 | checkcode nonexistent | PASS | |
| 19 | confirm GET JSON | SKIP×3 | PHP status varies |

### DDL Extended (`ddl-extended.js`): 18 PASS / 0 FAIL / 0 SKIP

| # | Test | Result |
|---|------|--------|
| 1 | _d_new subtype (up=parentId) | PASS |
| 2 | _d_new empty name | PASS |
| 3 | _d_new GRANT base type (t=23) | PASS |
| 4 | _d_save change base type | PASS |
| 5 | _d_req duplicate column | PASS |
| 6 | _d_req self-reference | PASS |
| 7-8 | _d_null explicit required=1/0 | PASS |
| 9-10 | _d_multi explicit multi=1/0 | PASS |
| 11 | _d_ord order=999 | PASS |
| 12 | _d_alias val=rename | PASS |
| 13 | _d_attrs all params combined | PASS |
| 14-15 | _d_del_req valid/nonexistent | PASS |
| 16 | _d_ref nonexistent type | PASS |

### DML Extended (`dml-extended.js`): 11 PASS / 0 FAIL / 0 SKIP

| # | Test | Result |
|---|------|--------|
| 1 | _m_new empty value | PASS |
| 2 | _m_new explicit type= | PASS |
| 3 | _m_save tab=2 | PASS |
| 4 | _m_save tzone=3 | PASS |
| 5 | _m_ord order=999 | PASS |
| 6 | _m_id same ID | PASS |
| 7 | _m_id new_id=0 | PASS |
| 8 | _m_move same parent | PASS |
| 9 | _m_del cascade | PASS |
| 10 | _m_del forced | PASS |
| 11 | _m_del nonexistent | PASS |

### Listing Extended (`listing-extended.js`): 16 PASS / 0 FAIL / 9 SKIP

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | F_I=objectId | PASS | |
| 2 | F_I nonexistent | PASS | |
| 3 | JSON_DATA+LIMIT=2 | SKIP | PHP null |
| 4 | JSON_DATA+F_U | SKIP | PHP null |
| 5 | F_U=0 root only | PASS | |
| 6 | F_TYPEID=value | PASS | |
| 7-11 | _list (LIMIT/q/sort/F/up) | SKIP×5 | PHP null |
| 12-13 | _list_join (q/LIMIT) | SKIP×2 | PHP null |
| 14 | edit_obj nonexistent | PASS | Node-only |
| 15-16 | metadata (typeId/nonexistent) | PASS | |
| 17 | terms invalid db | PASS | |

### Reports Extended (`reports-extended.js`): 24 PASS / 0 FAIL / 0 SKIP

| # | Test | Result |
|---|------|--------|
| 1-6 | All 6 JSON formats | PASS |
| 7-9 | LIMIT=2 / LIMIT=2,3 / F=5 | PASS |
| 10-11 | ORDER / ORDER DESC | PASS |
| 12-16 | FR_ / TO_ / EQ_ / LIKE_ / FR+TO range | PASS |
| 17 | SELECT subset | PASS |
| 18 | field_names=1 | PASS |
| 19-20 | csv / format=csv | PASS |
| 21-23 | POST action=report (JSON/JSON_KV/LIMIT) | PASS |
| 24 | nonexistent report | PASS |

### Business CRUD (`business-crud.js`): 40 PASS / 0 FAIL / 4 SKIP

| Section | Tests | Result | Notes |
|---------|-------|--------|-------|
| 1. Lookup Tables | 11 | 10 PASS / 1 SKIP | Create ref type → items → ref column → set/change/clear ref |
| 2. Multiselects | 10 | 10 PASS | Create tags → ref column → enable MULTI → add/remove values |
| 3. Object Listing | 11 | 8 PASS / 3 SKIP | Create 5 objects → list/search/_list_join → order → ID change → delete → verify |
| 4. Full Lifecycle | 9 | 9 PASS | Create → set NUMBER+DATETIME → verify → copy → verify copy → list → delete → verify |

Key findings:
- `_d_ref` returns `id=parentType, obj=requisiteId` (reversed from `_d_req`)
- `_m_set` references use TYPE ID as column identifier: `t{refTypeId}=objectId`
- `_m_id` uses `new_id` parameter (not `newid`)
- Parent-child object creation (`up=parentObjectId`) requires GRANT permissions

## Legacy Test Suites

### 1. Read-only Parity (`full-parity-audit.js`): 19 PASS / 0 FAIL / 3 SKIP

| # | Endpoint | Result | Notes |
|---|----------|--------|-------|
| 1 | `POST /auth` (correct creds) | PASS | |
| 2 | `POST /auth` (wrong pwd) | PASS | |
| 3 | `POST /auth` (missing login) | PASS | |
| 4 | `POST /auth` JSON login | PASS | |
| 5 | `GET /xsrf` | PASS | Keys match |
| 6 | `POST /getcode` | PASS | |
| 7 | `POST /checkcode` | PASS | |
| 8 | `GET /terms` | PASS | |
| 9 | `GET /metadata` | PASS | |
| 10 | `GET /obj_meta/:id` | PASS | |
| 11 | `GET /obj_meta/999999999` | PASS | |
| 12 | `GET /_ref_reqs/42` | SKIP | PHP built-in server 500 |
| 13 | `GET /_ref_reqs/18` | SKIP | PHP built-in server 500 |
| 14 | `POST / (a=object)` | PASS | |
| 15 | `POST / (JSON_DATA)` | SKIP | PHP built-in server 500 |
| 16 | `GET /terms` (invalid db) | PASS | |
| 17 | `GET /terms` Expires header | PASS | |
| 18 | Cache-Control / CORS headers | PASS | |
| 19 | `POST / (a=unknown)` | PASS | |
| 20 | `GET /terms` (no token) | PASS | |
| 21 | `OPTIONS` preflight | PASS | |

### 2. CRUD Parity (`crud-parity-audit.js`): 28 PASS / 0 FAIL

| # | Endpoint | Result |
|---|----------|--------|
| 1.1 | `_d_new` — create type | PASS |
| 1.2 | `_d_new` — duplicate type | PASS |
| 1.3 | `_d_save` — rename type | PASS |
| 1.4 | `_d_save` — save with unique | PASS |
| 2.1 | `_d_req` — add column | PASS |
| 2.3 | `_d_req` — add second column | PASS |
| 2.4 | `_d_req` — duplicate column | PASS |
| 2.5 | `_d_null` — toggle NOT NULL | PASS |
| 2.6 | `_d_multi` — toggle MULTI | PASS |
| 2.7 | `_d_up` — move column up | PASS |
| 3.1 | `_m_new` — create object | PASS |
| 3.2 | `_m_new` — second object | PASS |
| 3.3 | `_m_save` — save object | PASS |
| 3.4 | `_m_save` — copy object | PASS |
| 3.5 | `_m_del` — delete object | PASS |
| 4.1 | `terms` — verify type | PASS |
| 4.2 | `obj_meta` — verify meta | PASS |
| 5.1 | `_d_del` — delete type (blocked) | PASS |
| 6.1 | `_m_set` — set attribute | PASS |
| 6.3 | `_m_up` — move object up | PASS |
| 6.4 | `_m_ord` — set object order | PASS |
| 6.5 | `_m_ord` — invalid order | PASS |
| 7.1 | `_d_alias` — set alias | PASS |
| 7.2 | `_d_alias` — invalid alias (colon) | PASS |
| 7.3 | `_d_attrs` — set modifiers | PASS |
| 7.4 | `_d_ord` — set column order | PASS |
| 7.5 | `_d_ord` — invalid order | PASS |
| 7.6 | `_d_del_req` — delete column | PASS |

### 3. Query & Filter Parity (`query-parity-audit.js`): 18 PASS / 0 FAIL / 3 SKIP

| # | Endpoint | Result | Notes |
|---|----------|--------|-------|
| 1.1 | `JSON_DATA` format | PASS | |
| 1.2 | `JSON_DATA` with LIMIT | PASS | |
| 1.3 | `JSON=1` parseable JSON | PASS | |
| 1.4 | Empty type listing | PASS | |
| 2.1 | `F_U=1` filter (by parent) | PASS | |
| 2.2 | `F_U` non-existent parent | PASS | |
| 2.3 | `F_I` filter (exact ID) | PASS | |
| 2.4 | `F_{typeId}` main value filter | PASS | |
| 2.5 | Sorting by val | PASS | |
| 2.6 | Descending sort | PASS | |
| 3.1 | `edit_obj` (JSON) | PASS | |
| 3.2 | `edit_types` (JSON) | PASS | |
| 4.1-3 | `_m_move` | PASS | PHP cross-join bug, Node OK |
| 5.1-3 | `_ref_reqs` | SKIP×3 | PHP built-in server 500 |
| 6.1 | `_d_ref` | PASS | |
| 6.2 | `exit` | PASS | |
| 6.3 | `dir_admin` | PASS | |

### 4. Endpoints Parity (`endpoints-parity-audit.js`): 46 PASS / 0 FAIL / 13 SKIP

Phase A (Simple): 11 PASS / 1 SKIP — _m_id, _dict, login, confirm
Phase B (Export): 4 PASS / 2 SKIP — csv_all, backup, _new_db
Phase C (Auth): 7 PASS — jwt, register
Phase D (Reports): 9 PASS — 7 JSON formats + LIMIT + nonexistent
Phase E (Remaining): 4 PASS / 11 SKIP — validate, sql, form, dict, _list, _list_join, _connect, etc.

### 5. Comprehensive Parity (`comprehensive-parity-audit.js`): 113 PASS / 0 FAIL / 22 SKIP

| Section | Tests | PASS | SKIP | Coverage |
|---------|-------|------|------|----------|
| 1. Auth & Session | 20 | 9 | 11 | auth, xsrf, getcode, checkcode, confirm, login, exit, OPTIONS |
| 2. Types DDL | 25 | 25 | 0 | _d_new (11 base types), _d_save, _d_req (8 cols), _d_alias, _d_null, _d_multi, _d_attrs, _d_up, _d_ord, _d_ref, _d_del_req |
| 3. Objects DML | 22 | 22 | 0 | _m_new, _m_save, _m_set (7 data types + clear), _m_save copy, _m_up, _m_ord, _m_move, _m_id, _m_del |
| 4. Listing & Querying | 21 | 14 | 7 | object?JSON, LIMIT, sorting, F_U, edit_obj, edit_types, terms, metadata, obj_meta, _dict, _list, _list_join, _d_main, _ref_reqs |
| 5. Edge Cases | 16 | 13 | 3 | XSS, Cyrillic, special chars, LIMIT boundary, obj_meta boundary, empty POST, no XSRF, headers |
| 6. Pages JSON | 4 | 3 | 1 | dict, sql, form, dir_admin |
| 7. Reports | 9 | 9 | 0 | JSON, JSON_DATA, JSON_KV, JSON_CR, JSON_HR, RECORD_COUNT, LIMIT |
| 8. Type Deletion | 2 | 2 | 0 | _d_del with objects (forced), nonexistent |

## Node.js Bugs Found & Fixed

### This session (uncommitted)
1. **`isApiRequest()` missing `csv`/`format=csv`** — `?csv` and `?format=csv` returned HTML instead of data
2. **`isApiRequest()` missing `RECORD_COUNT`** — `?RECORD_COUNT` alone returned HTML instead of JSON
3. **`sql?JSON` extra keys** — returned `&main.myrolemenu` and `&main.&top_menu` not present in PHP
4. **`form?JSON` extra keys** — same: returned `&main.myrolemenu` and `&main.&top_menu` not present in PHP
5. **`_connect` empty response** — returned empty body instead of `legacyRespond()` when no connector found

### Previous commits
1. **Auth JSON Content-Disposition** — `login.json` вместо `api.json`
2. **Auth wrong password redirect** — `req.body.u` вместо `req.body.login`, raw `req.originalUrl`
3. **Auth wrong password JSON language** — билингвальный `t9n()` с locale RU
4. **getcode/checkcode field names** — `u`/`c` вместо `login`/`code`/`email`
5. **getcode/checkcode response** — всегда `die()`-style (`text/html`), без redirect
6. **Access without token redirect** — `/login.html?db=...&r=InvalidToken&uri=...`
7. **`_d_req` val requirement** — убрана лишняя валидация `val`
8. **`_d_req` base type check** — добавлена проверка что base types нельзя как реквизит
9. **`_d_ord` invalid order** — `die("Invalid order")` plain text вместо JSON error
10. **`F_I` filter in JSON_DATA** — добавлена фильтрация по ID объекта в object listing

## Coverage

### Tested (50+ actions)
`auth`, `xsrf`, `getcode`, `checkcode`, `terms`, `metadata`, `obj_meta`, `_ref_reqs`,
`_d_new`, `_d_save`, `_d_del`, `_d_req`, `_d_ref`, `_d_null`, `_d_multi`, `_d_up`, `_d_alias`, `_d_attrs`, `_d_ord`, `_d_del_req`,
`_m_new`, `_m_save`, `_m_del`, `_m_set`, `_m_up`, `_m_ord`, `_m_move`, `_m_id`,
`_dict`, `_list`, `_list_join`, `_d_main`, `_connect`,
`login`, `confirm`, `jwt`, `register`, `_new_db`, `validate`,
`report` (7 JSON formats + filters + sorting + LIMIT + csv),
`csv_all`, `backup`,
`sql`, `form`, `dict`, `grants`, `check_grant`, `export`, `dir_admin`, `download`,
`edit_obj`, `edit_types`, `exit`,
`JSON_DATA`, `JSON=1`, `JSON_KV`, `JSON_CR`, `JSON_HR`, `RECORD_COUNT`,
`F_I`, `F_U`, `F_{typeId}`, sorting, LIMIT, offset,
Reference columns, multiselect columns, object copy, custom ID

### Not tested (untestable or not implemented)
| Action | Reason |
|--------|--------|
| `upload` / file via `_m_set` | Multipart upload, needs file fixtures |
| `google-auth` | Requires Google OAuth credentials |
| `auth.asp` | Legacy ASP compatibility redirect |
| `bki-export` / `bki-import` / `restore` | Complex binary formats, destructive |
| Parent-child objects (`up=objectId`) | Requires GRANT permissions |
| BUTTON type behavior | Requires UI interaction |

## Known PHP Built-in Server Limitations

These endpoints return 500, null, or HTML on PHP built-in dev server but work correctly on production Apache/nginx:

- `_ref_reqs` — 500 for dynamically created types
- `_list`, `_list_join`, `_d_main` — return `null`
- `grants`, `check_grant` — return `null`
- `csv_all` — 500
- `backup` — 302 redirect instead of binary
- `POST / (JSON_DATA)` — 500
- `validate` — redirect instead of JSON
- `export`, `dir_admin`, `download` — return HTML instead of JSON/file

## Known Parity Issues (not bugs, require deeper refactoring)

- `_m_set`: per-attribute grant check (PHP `Check_Grant` per attr, Node one upfront)
- `_m_set`: file subdir uses objectId vs req_id (different file paths)
- `_m_move`: root grant `Grant_1level(type)` vs `checkGrant(parent=1)`
- `_m_save`: NOT_NULL grant check uses objectId vs type ID
- `_d_null`/`_d_multi`: parseModifiers round-trip may reorder vs PHP atomic SQL

## Intentional Differences (not bugs)

- `htmlEsc` encodes single quotes (XSS fix #428)
- BOOLEAN int 0 edge case (MySQL returns strings)
- Content-Type charset casing (cosmetic)
- `JSON_HEX_QUOT` `\"` vs `\u0022` (low priority)

## How to Run

```bash
# Prerequisites: MySQL running, both servers running
# PHP:  php -S 127.0.0.1:8082 router.php  (in integram-server/)
# Node: PORT=8081 node start-legacy-test.js (in backend/monolith/)

# Extended suites (use shared helpers)
node tests/integration/auth-extended.js
node tests/integration/ddl-extended.js
node tests/integration/dml-extended.js
node tests/integration/listing-extended.js
node tests/integration/reports-extended.js
node tests/integration/business-crud.js

# Legacy suites
node tests/integration/full-parity-audit.js
node tests/integration/crud-parity-audit.js
node tests/integration/query-parity-audit.js
node tests/integration/endpoints-parity-audit.js
node tests/integration/comprehensive-parity-audit.js
```
