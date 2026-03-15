# PHP vs Node.js Comparison Test Report (Round 4)

**Date:** 2026-03-15
**Branch:** master (after PRs #521-#524 merged)
**Servers:** PHP 127.0.0.1:8082, Node 127.0.0.1:8081
**Database:** my, User: testbot

## Summary

| Suite | Tests | Match | Diff | Score |
|-------|-------|-------|------|-------|
| 01-auth | 15 | 14 | 1 | 93% |
| 02-ddl | 15 | 14 | 1 | 93% |
| 03-dml | 13 | 9 | 4 | 69% |
| 04-listing | 21 | 14 | 7 | 67% |
| 05-reports | 11 | 11 | 0 | **100%** |
| 06-admin | 16 | 14 | 2 | 88% |
| 07-refs-multi | 19 | 14 | 5 | 74% |
| 08-export | 11 | 10 | 1 | 91% |
| **TOTAL** | **121** | **100** | **21** | **83%** |

**Progress: 54% → 70% → 83% (Round 3-4 stabilized)**

## Remaining Issues by Category

### Not-a-bug diffs (7 total)
- `POST /auth nonexistent db` — PHP 500 (built-in server limitation)
- `POST /_d_null` — PHP 500 (built-in server limitation)
- `GET /csv_all` — PHP 500 (built-in server limitation)
- `POST /_m_new` ord — auto-increment gap (expected)
- `POST /_m_new (empty)` ord — auto-increment gap (expected)
- `POST /_m_save (rename)` F_I — different object IDs (expected)
- `POST /_m_save (copy)` F_I — different object IDs (expected)

### Real diffs requiring fixes (14 total)

| Category | Diffs | Tests |
|----------|-------|-------|
| object?JSON — &object_reqs/&uni_object_view_reqs missing | ~5 | 04-listing (#3-6) |
| object?JSON — _noobj F_U block | 2 | 04-listing (#5-6) |
| object?JSON — F_U=0 returns empty | 1 | 04-listing (#6) |
| edit_obj — auto-increment ID arrays | 2 | 04-listing (#11), 07-refs-multi (#19) |
| edit_types — ACTIVITY race condition | 2 | 04-listing (#12), 06-admin (#6) |
| dir_admin — HTML body diff | 1 | 06-admin (#12) |
| object sub-type/col-as-table — template keys | 2 | 07-refs-multi (#9, #17) |
| _d_del_req — test data race | 1 | 07-refs-multi (#18) |
| object F_I — ID normalization | 1 | 04-listing (#7) |

## What's Working (100/121 MATCH)

- **Reports** — 100% (all JSON formats, pagination, CSV, counting)
- **Auth** — 93% (login, xsrf, jwt, exit, validate, getcode, checkcode)
- **DDL** — 93% (type/column CRUD, ref, multi, rename)
- **Export** — 91% (backup, export, bki-export, login pages)
- **Admin** — 88% (terms, dict, types, form, sql, grants, validate)
- **Refs/Multi** — 74% (_ref_reqs, _list, _list_join, _d_null, _d_multi, _m_set, _m_move)
- **DML** — 69% (_m_up, _m_ord, _m_move, _m_id, _m_del all match)
- **Listing** — 67% (JSON, JSON_DATA, filters, sorting, obj_meta)

## Individual Suite Reports

- [01-auth-results.md](01-auth-results.md)
- [02-ddl-results.md](02-ddl-results.md)
- [03-dml-results.md](03-dml-results.md)
- [04-listing-results.md](04-listing-results.md)
- [05-reports-results.md](05-reports-results.md)
- [06-admin-results.md](06-admin-results.md)
- [07-refs-multi-results.md](07-refs-multi-results.md)
- [08-export-results.md](08-export-results.md)
