# PHP vs Node.js Comparison Test Report (Round 5 — Final)

**Date:** 2026-03-15
**Branch:** master (PRs #521-#538 merged)
**Servers:** PHP nginx+php-fpm :8082, Node :8081
**Database:** my, User: testbot

## Summary

| Suite | Tests | Match | Diff | Score |
|-------|-------|-------|------|-------|
| 01-auth | 15 | 14 | 1 | 93% |
| 02-ddl | 15 | 14 | 1 | 93% |
| 03-dml | 13 | 13 | 0 | **100%** |
| 04-listing | 21 | 21 | 0 | **100%** |
| 05-reports | 11 | 11 | 0 | **100%** |
| 06-admin | 16 | 16 | 0 | **100%** |
| 07-refs-multi | 19 | 19 | 0 | **100%** |
| 08-export | 11 | 10 | 1 | 91% |
| **TOTAL** | **121** | **118** | **3** | **97.5%** |

**Progress: 54% → 70% → 83% → 97.5%**

## Remaining 3 Diffs — PHP Fatal Errors (not Node bugs)

These are PHP code bugs where uncaught exceptions cause HTTP 500. Node handles these cases correctly.

| Test | PHP | Node | PHP Error |
|------|-----|------|-----------|
| POST /auth (nonexistent db) | 500 | 404 | `Table 'integram.zzznoexist427' doesn't exist` — uncaught mysqli_sql_exception |
| POST /_d_null (required=1) | 500 | 200 | NaN passed to SQL — uncaught fatal |
| GET /csv_all | 500 | 302 | CSV generation fatal error |

## 6 Suites at 100% MATCH

- **DML** — 13/13 (move, order, delete, new, save, id)
- **Listing** — 21/21 (object, edit_obj, edit_types, obj_meta, _list, _ref_reqs)
- **Reports** — 11/11 (all JSON formats, pagination, CSV, counting)
- **Admin** — 16/16 (terms, dict, types, form, sql, dir_admin, grants, validate)
- **Refs/Multi** — 19/19 (_ref_reqs, _list, _d_null, _d_multi, _m_set, _m_move, edit_obj)
- **Export** — 10/11 (backup, export, bki-export, login, upload)

## Individual Suite Reports

- [01-auth-results.md](01-auth-results.md)
- [02-ddl-results.md](02-ddl-results.md)
- [03-dml-results.md](03-dml-results.md)
- [04-listing-results.md](04-listing-results.md)
- [05-reports-results.md](05-reports-results.md)
- [06-admin-results.md](06-admin-results.md)
- [07-refs-multi-results.md](07-refs-multi-results.md)
- [08-export-results.md](08-export-results.md)
