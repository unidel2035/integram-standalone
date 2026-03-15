# PHP vs Node.js Comparison Test Report (Round 2)

**Date:** 2026-03-15
**Branch:** master (after PRs #499-#503 merged)
**Servers:** PHP 127.0.0.1:8082, Node 127.0.0.1:8081
**Database:** my, User: testbot

## Summary

| Suite | Tests | Match | Diff | Score |
|-------|-------|-------|------|-------|
| 01-auth | 15 | 14 | 1 | 93% |
| 02-ddl | 15 | 14 | 1 | 93% |
| 03-dml | 13 | 9 | 4 | 69% |
| 04-listing | 16 | 2 | 14 | 13% |
| 05-reports | 11 | 11 | 0 | **100%** |
| 06-admin | 16 | 13 | 3 | 81% |
| 07-refs-multi | 19 | 8 | 11 | 42% |
| 08-export | 11 | 10 | 1 | 91% |
| **TOTAL** | **116** | **81** | **35** | **70%** |

**Progress: 54% → 70% (+16 points, +18 tests fixed)**

## Remaining Issues

| Issue | Category | Diffs | Tests |
|-------|----------|-------|-------|
| [#504](../../issues/504) | object?JSON extra keys (f_i, f_u, filter) | ~15 | 04-listing, 07-refs-multi |
| [#505](../../issues/505) | edit_obj?JSON extra keys (base_typ, disabled) | 2 | 04-listing, 07-refs-multi |
| [#506](../../issues/506) | edit_types missing &editables block | 2 | 04-listing, 06-admin |
| [#507](../../issues/507) | _list/_list_join PHP returns null | 7 | 04-listing, 07-refs-multi |
| [#508](../../issues/508) | Minor: obj_meta key order, _m_set, _m_move | 5 | 06-admin, 07-refs-multi |

### Not-a-bug diffs (4 total)
- `POST /auth nonexistent db` — PHP 500 (built-in server limitation)
- `POST /_d_null` — PHP 500 (built-in server limitation)
- `POST /_m_new` ord — auto-increment gap (expected)
- `POST /_m_save` F_I — different object IDs on each server (expected)
- `GET /csv_all` — PHP 500 (built-in server limitation)

## What's Working (81/116 MATCH)

- **Reports** — 100% (all JSON formats, pagination, CSV, counting)
- **Auth** — 93% (login, xsrf, jwt, exit, validate, getcode, checkcode)
- **DDL** — 93% (type/column CRUD, ref, multi, rename)
- **Export** — 91% (backup, export, bki-export, login pages)
- **Admin** — 81% (terms, dict, types, form, sql, grants, validate)
- **DML** — 69% (move, order, delete, _m_id all match)

## Individual Suite Reports

- [01-auth-results.md](01-auth-results.md)
- [02-ddl-results.md](02-ddl-results.md)
- [03-dml-results.md](03-dml-results.md)
- [04-listing-results.md](04-listing-results.md)
- [05-reports-results.md](05-reports-results.md)
- [06-admin-results.md](06-admin-results.md)
- [07-refs-multi-results.md](07-refs-multi-results.md)
- [08-export-results.md](08-export-results.md)
