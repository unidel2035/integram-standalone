# PHP vs Node.js Comparison Test Report

**Date:** 2026-03-15
**Branch:** master (after merging PRs #455-#492, 38 total)
**Servers:** PHP 127.0.0.1:8082, Node 127.0.0.1:8081
**Database:** my, User: testbot

## Summary

| Suite | Tests | Match | Diff | Score |
|-------|-------|-------|------|-------|
| 01-auth | 15 | 11 | 4 | 73% |
| 02-ddl | 15 | 13 | 2 | 87% |
| 03-dml | 13 | 7 | 6 | 54% |
| 04-listing | 16 | 1 | 15 | 6% |
| 05-reports | 11 | 10 | 1 | 91% |
| 06-admin | 16 | 8 | 8 | 50% |
| 07-refs-multi | 19 | 6 | 13 | 32% |
| 08-export | 11 | 7 | 4 | 64% |
| **TOTAL** | **116** | **63** | **53** | **54%** |

## Diff Analysis by Category

### Category 1: Template/Page Rendering (object/edit_obj/edit_types) — ~25 diffs
The largest group. PHP uses its template engine to render `object`, `edit_obj`, `edit_types` pages as JSON (via `&main.a.*` blocks). Node has a different implementation that includes extra keys (`base`, `base_typ`, `disabled`) and different key ordering. These are **structural parity issues** in the template rendering layer, not bugs in individual endpoints.

**Affected tests:** 04-listing (14 of 15 diffs), 06-admin `edit_types`, 07-refs-multi (object/edit_obj views)

### Category 2: Response Format Mismatch (text vs JSON) — ~12 diffs
PHP returns plain text (often `die()` output) where Node returns `res.json()`:
- `_list`, `_list_join` — PHP returns newline-separated text, Node returns JSON array
- `obj_meta` — PHP returns JSON, Node returns text (reversed)
- `dir_admin`, `validate`, `grants`, `check_grant` — PHP returns text, Node returns JSON
- `csv_all` — PHP returns 500 (built-in server limitation), Node returns 200

### Category 3: Status Code Differences — ~5 diffs
- `GET /login` — PHP 302 redirect, Node 200 (serves page directly)
- `GET /backup` — PHP 302, Node 200
- `POST /auth (nonexistent db)` — PHP 404 text, Node 200 JSON error

### Category 4: Value Differences (minor) — ~8 diffs
- `_m_new` ord values differ (PHP=1, Node=4/5) — auto-increment gap
- `_m_save` F_I values differ — different object IDs on each server
- `_m_id` — PHP returns array, Node returns object
- `_m_set` — PHP returns array, Node returns object
- `_d_new` duplicate warning — language difference (Russian vs English)
- `_d_null` — PHP 500 (built-in server issue), Node 200
- `_d_del_req` — obj field: PHP=null, Node=ID
- `_m_move` — different error messages

### Category 5: Pre-existing PHP Server Limitations — ~3 diffs
PHP's built-in dev server (`php -S`) has known issues:
- `csv_all` returns 500
- `_d_null` returns 500
- These would pass with Apache/nginx

## What's Working Well (63 MATCH)

- **Auth flow**: login, wrong password, empty fields, XSRF token, JWT, exit — all match
- **DDL**: type create/save/delete, column add, reference add, multi toggle — mostly match
- **DML**: move, order, delete — match
- **Reports**: All 5 JSON formats (JSON, JSON_DATA, JSON_KV, JSON_CR, JSON_HR), pagination, record count — all match
- **Export**: type export, BKI export — match
- **Misc**: info, root page, main page, upload — match

## Priority Fixes for Next Iteration

1. **Template rendering parity** (object/edit_obj pages) — biggest impact, ~25 tests
2. **`_list`/`_list_join` format** — should return newline-separated text like PHP
3. **`/login` redirect** — Node should 302 redirect like PHP
4. **`/auth` nonexistent DB** — Node should return 404 plain text
5. **`_m_id`/`_m_set` array vs object** — PHP returns `[]` array, Node returns `{}` object

## Individual Suite Reports

See detailed per-test results in:
- [01-auth-results.md](01-auth-results.md)
- [02-ddl-results.md](02-ddl-results.md)
- [03-dml-results.md](03-dml-results.md)
- [04-listing-results.md](04-listing-results.md)
- [05-reports-results.md](05-reports-results.md)
- [06-admin-results.md](06-admin-results.md)
- [07-refs-multi-results.md](07-refs-multi-results.md)
- [08-export-results.md](08-export-results.md)
