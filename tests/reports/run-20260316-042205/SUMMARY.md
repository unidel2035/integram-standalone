# Run 2026-03-16 — Full Suite Results

**45 tests, all MATCH (0 DIFF)**

| Test | Tests | Result |
|------|-------|--------|
| 01-auth | 15 | ✅ |
| 02-ddl | 20 | ✅ |
| 03-dml | 16 | ✅ |
| 04-listing | 21 | ✅ |
| 05-reports | 13 | ✅ |
| 06-admin | 16 | ✅ |
| 07-refs-multi | 19 | ✅ |
| 08-export | 11 | ✅ |
| 09-tables-crud | 25 | ✅ |
| 10-objects-lifecycle | 27 | ✅ |
| 11-directories | 22 | ✅ |
| 12-subordinates | 24 | ✅ |
| 13-filtering | 14 | ✅ |
| 14-multiselect | 18 | ✅ |
| 15-reports-advanced | 20 | ✅ |
| 16-datatable-patterns | 24 | ✅ |
| 17-file-upload | 7 | ✅ |
| 18-column-metadata | 19 | ✅ |
| 19-auth-password | 21 | ✅ |
| 20-row-operations | 17 | ✅ |
| 21-subordinate-tables | 8 | ✅ |
| 22-directories-multiselect | 22 | ✅ |
| 23-inline-editing | 18 | ✅ |
| 24-reports-filters | 17 | ✅ |
| 25-admin-endpoints | 19 | ✅ |
| 26-json-formats | 24 | ✅ |
| 27-reference-search | 13 | ✅ |
| 28-date-formats | 14 | ✅ |
| 29-object-count-pagination | 17 | ✅ |
| 30-special-operations | 14 | ✅ |
| 31-list-dict-connect | 17 | ✅ |
| 32-session-exit-jwt | 14 | ✅ |
| 33-error-handling-edge | 20 | ✅ |
| 34-ref-search-filters | 20 | ✅ |
| 35-metadata-obj-meta | 14 | ✅ |
| 36-multifield-save | 15 | ✅ |
| 37-report-listing-export | 20 | ✅ |
| 38-subordinate-ordering | 10 | ✅ |
| 39-encoding-escaping | 15 | ✅ |
| 40-grants-permissions | 14 | ✅ |
| 41-type-lifecycle | 19 | ✅ |
| 42-bulk-operations | 15 | ✅ |
| 43-my-database | 28 | ✅ |
| 44-d-req-attrs-ord | 28 | ✅ |
| 45-m-id-validate-auth | 22 | ✅ |

**Note:** Tests must be run sequentially. Parallel execution causes race conditions
(shared auth token invalidated by test 32 /exit).
