# PHP vs Node.js Comparison Test Report — Round 6 (Extended)

**Date:** 2026-03-15
**Branch:** master
**Servers:** PHP `php -S` :8082, Node :8081
**Database:** my, User: testbot

## Summary — Original Suites (01-08)

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
| **Subtotal** | **121** | **118** | **3** | **97.5%** |

## Summary — New Suites (09-16, from Vue component patterns)

| Suite | Tests | Match | Diff | Score | Notes |
|-------|-------|-------|------|-------|-------|
| 09-tables-crud | 25 | 19 | 6 | 76% | metadata, _d_save, _d_del_req format |
| 10-objects-lifecycle | 28 | 18 | 10 | 64% | align, filter_rcm, buttons, reqs format |
| 11-directories | 22 | 22 | 0 | **100%** | Справочники perfect! |
| 12-subordinates | 27 | 21 | 6 | 78% | metadata, edit_obj PHP 500 |
| 13-filtering | 28 | 0 | 28 | 0%* | *PHP 500 on all F_I/F_T — php -S bug |
| 14-multiselect | 18 | 18 | 0 | **100%** | Multiselect perfect! |
| 15-reports-adv | 20 | 10 | 10 | 50% | val format, buttons, metadata |
| 16-datatable | 24 | 14 | 10 | 58% | align, buttons, boolean display |
| **Subtotal** | **192** | **122** | **70** | **63.5%** |

*`13-filtering`: ALL 28 diffs caused by PHP `php -S` server crashing on `[]` in query params. Not a Node parity issue. Needs nginx+php-fpm testing.

## Combined Total

| | Tests | Match | Diff | Score |
|--|-------|-------|------|-------|
| Original (01-08) | 121 | 118 | 3 | 97.5% |
| New (09-16) | 192 | 122 | 70 | 63.5% |
| **Grand Total** | **313** | **240** | **73** | **76.7%** |

## Diff Categories (New Suites)

### Category A: PHP Server Limitations (not Node bugs)
- **28 diffs** from 13-filtering: PHP `php -S` returns 500 on `F_I[]`/`F_T[]` query params
- **2 diffs** from 12-subordinates: `edit_obj` for child objects PHP 500

### Category B: `/metadata/{typeId}` endpoint (Node bug)
- **4 diffs**: Node returns HTML template instead of JSON metadata
- Affected: 09 #17, 12 #1-#3, 16 #21

### Category C: Response type mismatch — object vs array
- **6 diffs**: `_m_set`/`_m_save` — PHP returns object, Node returns array
- **2 diffs**: `_d_save`/`_d_del_req` — same issue
- Affected: 09 #21/#23, 10 #6/#8/#13/#14, 16 #6/#12

### Category D: Template rendering differences
- **~20 diffs**: `align` arrays (PHP CENTER vs Node LEFT for NUMBER/BOOL)
- `filter_req_rcm` different column counts
- `&buttons` block present in PHP, absent in Node
- `&editreq_boolean`/`&editreq_datetime` blocks missing in Node
- Boolean display: PHP `"X"` vs Node `"1"`

### Category E: Report val format
- **4 diffs**: `_m_new/44` and `_m_new/28` — PHP returns name, Node returns ordinal

## Key Findings

1. **`_d_req` rejects base type IDs** — Fixed in lib.js by mapping to concrete types
2. **Filtering completely broken on PHP built-in server** — `[]` in URLs causes fatal error
3. **11-directories (22/22) and 14-multiselect (18/18) are 100% MATCH** — справочники and multiselect work perfectly
4. **Core CRUD operations match well** — create, save, set, delete, move, order all work
5. **Template rendering is the main gap** — align, buttons, filter blocks differ

## Files

- `API-FINDINGS.md` — Detailed technical documentation of all findings
- `09-tables-crud-results.md` through `16-datatable-patterns-results.md` — Individual test reports
- `lib.js` — Updated with concrete type mapping for `addColumn()`
