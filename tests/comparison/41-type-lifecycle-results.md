# 41-type-lifecycle — Full Type Lifecycle

19 MATCH / 0 DIFF out of 19 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #1 GET /terms (after create) | 200 | 200 | MATCH |
| 2 | #2 GET /metadata (after SHORT col) | 200 | 200 | MATCH |
| 3 | #3 GET /metadata (after NUMBER col) | 200 | 200 | MATCH |
| 4 | #4 GET /metadata (after DATETIME col) | 200 | 200 | MATCH |
| 5 | #5 GET /metadata (after REF col) | 200 | 200 | MATCH |
| 6 | #6 POST /_d_save (rename type) | 200 | 200 | MATCH |
| 7 | #7 POST /_d_alias (rename col1) | 200 | 200 | MATCH |
| 8 | #8 GET /metadata (after renames) | 200 | 200 | MATCH |
| 9 | #9 POST /_d_null (set NOT NULL) | 200 | 200 | MATCH |
| 10 | #10 POST /_d_multi (set MULTI) | 200 | 200 | MATCH |
| 11 | #11 GET /metadata (after modifiers) | 200 | 200 | MATCH |
| 12 | #12 POST /_d_null (remove NOT NULL) | 200 | 200 | MATCH |
| 13 | #13 POST /_d_up (move col2 up) | 200 | 200 | MATCH |
| 14 | #14 GET /metadata (after reorder) | 200 | 200 | MATCH |
| 15 | #15 POST /_d_del_req (delete DATETIME) | 200 | 200 | MATCH |
| 16 | #16 GET /metadata (after del col) | 200 | 200 | MATCH |
| 17 | #17 POST /_d_del (forced) | 200 | 200 | MATCH |
| 18 | #18 GET /terms (after delete) | 200 | 200 | MATCH |
| 19 | #19 GET /edit_types (after delete) | 200 | 200 | MATCH |