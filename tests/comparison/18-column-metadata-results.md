# 18-column-metadata — Column Metadata Operations

19 MATCH / 0 DIFF out of 19 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 POST /_d_alias (set alias) | 200 | 200 | MATCH |
| 2 | #2 POST /_d_alias (number alias) | 200 | 200 | MATCH |
| 3 | #3 POST /_d_alias (clear alias) | 200 | 200 | MATCH |
| 4 | #4 POST /_d_alias (set again) | 200 | 200 | MATCH |
| 5 | #5 POST /_d_null (set NOT NULL) | 200 | 200 | MATCH |
| 6 | #6 POST /_d_null (toggle off) | 200 | 200 | MATCH |
| 7 | #7 POST /_d_multi (set MULTI) | 200 | 200 | MATCH |
| 8 | #8 POST /_d_multi (toggle off) | 200 | 200 | MATCH |
| 9 | #9 POST /_d_ord (move to pos 1) | 200 | 200 | MATCH |
| 10 | #10 GET /metadata (after reorder) | 200 | 200 | MATCH |
| 11 | #11 POST /_d_up (move col up) | 200 | 200 | MATCH |
| 12 | #12 GET /metadata (after move up) | 200 | 200 | MATCH |
| 13 | #13 POST /_d_attrs (set attrs) | 200 | 200 | MATCH |
| 14 | #14 POST /_d_attrs (clear attrs) | 200 | 200 | MATCH |
| 15 | #15 POST /_d_del_req (delete column) | 200 | 200 | MATCH |
| 16 | #16 GET /metadata (after delete col) | 200 | 200 | MATCH |
| 17 | #17 POST /_d_del_req (already deleted) | 200 | 200 | MATCH |
| 18 | #18 GET /edit_types (full state) | 200 | 200 | MATCH |
| 19 | #19 GET /metadata (final) | 200 | 200 | MATCH |