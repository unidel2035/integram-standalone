# 02-ddl — Type/Column DDL

14 MATCH / 1 DIFF out of 15 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | POST /_d_new (SHORT type) | 200 | 200 | MATCH |
| 2 | POST /_d_new (NUMBER type) | 200 | 200 | MATCH |
| 3 | POST /_d_new (DATE type) | 200 | 200 | MATCH |
| 4 | POST /_d_new (duplicate name) | 200 | 200 | MATCH |
| 5 | POST /_d_new (unique=1) | 200 | 200 | MATCH |
| 6 | POST /_d_new (empty name) | 200 | 200 | MATCH |
| 7 | POST /_d_save (rename) | 200 | 200 | MATCH |
| 8 | POST /_d_save (unique=1) | 200 | 200 | MATCH |
| 9 | POST /_d_req (text column) | 200 | 200 | MATCH |
| 10 | POST /_d_req (number column) | 200 | 200 | MATCH |
| 11 | POST /_d_ref (reference column) | 200 | 200 | MATCH |
| 12 | POST /_d_null (required=1) | 500 | 200 | DIFF: status: PHP=500 Node=200 |
| 13 | POST /_d_multi (multi=1) | 200 | 200 | MATCH |
| 14 | POST /_d_del (empty type) | 200 | 200 | MATCH |
| 15 | POST /_d_del (non-existent) | 200 | 200 | MATCH |

## Diffs Detail

### POST /_d_null (required=1)

- status: PHP=500 Node=200
- format: PHP=text Node=JSON
- PHP: ``
- Node: `[{"error":"Wrong id: nan"}]`
